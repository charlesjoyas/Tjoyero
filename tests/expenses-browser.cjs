"use strict";
const {chromium}=require("playwright"),{createApp}=require("../server.cjs");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),assert=require("node:assert/strict");
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"aurea-gastos-ui-")),app=createApp({dataDir:dir});
  await new Promise(r=>app.server.listen(0,"127.0.0.1",r));const base="http://127.0.0.1:"+app.server.address().port;let browser;
  try {
    browser=await chromium.launch({headless:true,channel:"msedge"});
    const context=await browser.newContext({viewport:{width:1440,height:1000},locale:"es-CO"});
    await context.request.post(base+"/api/setup",{data:{workshop:"Taller pruebas",name:"Admin",username:"admin",password:"1234"}});
    const state=async()=>(await (await context.request.get(base+"/api/state")).json()).state;
    async function act(action,data){const current=await state();const r=await context.request.post(base+"/api/action",{headers:{"If-Match":String(current.revision),"Idempotency-Key":crypto.randomUUID()},data:{action,data}});assert.equal(r.status(),200,await r.text());return (await r.json()).result;}
    await act("shift.open",{opening:100000});await act("cash.entry",{type:"expense",amount:10000,note:"Transporte anterior"});
    const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.goto(base+"/#expenses");
    const modal=page.locator('#modal-form'),submit=modal.locator('button[type="submit"]');
    await page.locator('[data-action="new-expense"]').click();
    await modal.locator('[name="category"]').selectOption("Servicios públicos");await modal.locator('[name="concept"]').fill("Energía del taller");
    await modal.locator('[name="amount"]').fill("25000");await modal.locator('[name="beneficiary"]').fill("Empresa de energía");await modal.locator('[name="reference"]').fill("FAC-001");
    assert.match(await modal.locator('#expense-preview').innerText(),/65\.000,00/);
    for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:950});assert.equal(await page.locator('#dialog').evaluate(el=>el.scrollWidth>el.clientWidth),false,"Modal gastos "+width);}
    await submit.click();await page.locator('#dialog').waitFor({state:"hidden"});
    let saved=await state();const cashExpense=saved.expenses[0];assert.equal(saved.cashEntries.length,2);assert.equal(saved.cashEntries.reduce((v,x)=>v+x.amount,100000),65000);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,"Gastos móvil");
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('[data-action="new-expense"]').click();
    await modal.locator('[name="category"]').selectOption("Arriendo");await modal.locator('[name="concept"]').fill("Arriendo pagado por banco");await modal.locator('[name="amount"]').fill("60000");await modal.locator('[name="method"]').selectOption("bank");
    assert.equal(await modal.locator('[name="reference"]').getAttribute("required"),"");
    await modal.locator('[name="reference"]').fill("TR-001");await submit.click();await page.locator('#dialog').waitFor({state:"hidden"});
    saved=await state();const bankExpense=saved.expenses[1];assert.equal(saved.cashEntries.length,2);
    await page.locator('[data-action="classify-expense"]').click();
    assert.equal(await modal.locator('[name="amount"]').getAttribute("readonly"),"");
    await modal.locator('[name="category"]').selectOption("Transporte");await submit.click();await page.locator('#dialog').waitFor({state:"hidden"});
    saved=await state();assert.equal(saved.expenses.length,3);assert.equal(saved.cashEntries.length,2);
    await page.locator(`[data-action="print-expense"][data-id="expense|${cashExpense.id}"]`).click();
    assert.match(await page.locator('#dialog').innerText(),/Energía del taller/);assert.match(await page.locator('#dialog').innerText(),/25\.000,00/);await page.keyboard.press("Escape");
    const downloadPromise=page.waitForEvent("download");await page.locator('[data-action="export-expenses"]').click();const download=await downloadPromise;
    assert.match(download.suggestedFilename(),/\.xlsx$/);const excelPath=path.join(dir,"gastos.xlsx");await download.saveAs(excelPath);
    const book=new (require("../exceljs.min.js").Workbook)();await book.xlsx.load(fs.readFileSync(excelPath));assert.equal(book.worksheets[0].getCell("E2").value,"Energía del taller");assert.equal(book.worksheets[0].getCell("H2").value,25000);
    await page.goto(base+"/#reports");assert.match(await page.locator('.kpis').innerText(),/Gastos del taller[\s\S]*95\.000,00/);
    await page.goto(base+"/#expenses");
    async function reverse(id,reference){
      await page.locator(`[data-action="reverse-operation"][data-id="expense|${id}"]`).click();
      await modal.locator('[name="reason"]').fill("Pago devuelto y verificado");await modal.locator('[name="confirmed"]').check();
      if(reference)await modal.locator('[name="reference"]').fill(reference);
      await submit.click();await modal.locator('#reversal-preview h2').waitFor();await submit.click();await page.locator('#dialog').waitFor({state:"hidden"});
    }
    await reverse(cashExpense.id);await reverse(bankExpense.id,"DEV-BANCO");
    saved=await state();assert.equal(saved.cashEntries.reduce((v,x)=>v+x.amount,100000),90000);assert.equal(saved.expenses.filter(x=>!x.reversedAt).reduce((v,x)=>v+x.amount,0),10000);
    await page.reload();await page.locator('#page h1').waitFor();
    await page.locator('[data-filter="expenseMethod"]').selectOption("bank");assert.match(await page.locator('#page').innerText(),/Arriendo pagado por banco/);assert.doesNotMatch(await page.locator('#page table').innerText(),/Transporte anterior/);
    await page.locator('[data-filter="expenseMethod"]').selectOption("");
    for(const width of [390,320]){await page.setViewportSize({width,height:950});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,"Historial de gastos "+width);}
    const today=require("../domain.cjs").day(),monthStart=today.slice(0,7)+"-01";
    const previousMonth=new Date(Date.parse(monthStart+"T12:00:00Z")-86400000).toISOString().slice(0,10);
    await act("expense.create",{category:"Otros",concept:"Gasto de un mes anterior",amount:1000,method:"bank",reference:"TR-ANTERIOR",expenseDate:previousMonth});
    await page.reload();await page.locator('#page h1').waitFor();
    assert.equal(await page.locator('[data-filter="expenseFrom"]').inputValue(),"");assert.equal(await page.locator('[data-filter="expenseTo"]').inputValue(),"");
    assert.match(await page.locator('#page table').innerText(),/Gasto de un mes anterior/);assert.match(await page.locator('#page table').innerText(),/Energía del taller/);
    const beforeFiltering=await state(),allDownload=page.waitForEvent("download");await page.locator('[data-action="export-expenses"]').click();
    const historyBook=new(require("../exceljs.min.js").Workbook)();await historyBook.xlsx.load(fs.readFileSync(await(await allDownload).path()));
    assert.ok(historyBook.worksheets[0].getColumn(5).values.includes("Gasto de un mes anterior"),"Excel incluye los meses anteriores por defecto");
    await page.locator('[data-filter="expenseFrom"]').fill(monthStart);assert.doesNotMatch(await page.locator('#page table').innerText(),/Gasto de un mes anterior/);
    await page.locator('[data-filter="expenseFrom"]').fill("");assert.match(await page.locator('#page table').innerText(),/Gasto de un mes anterior/);
    await page.locator('[data-filter="expenseTo"]').fill(previousMonth);assert.match(await page.locator('#page table').innerText(),/Gasto de un mes anterior/);assert.doesNotMatch(await page.locator('#page table').innerText(),/Energía del taller/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,"Filtros e historial móvil");
    await page.locator('[data-action="reset-expense-filters"]').click();assert.equal(await page.locator('[data-filter="expenseTo"]').inputValue(),"");assert.match(await page.locator('#page table').innerText(),/Energía del taller/);
    assert.deepEqual(await state(),beforeFiltering,"Consultar y exportar el historial no altera caja ni gastos");
    await act("user.create",{name:"Producción",username:"produccion",password:"1234",role:"produccion"});
    const restricted=await browser.newContext();await restricted.request.post(base+"/api/login",{data:{username:"produccion",password:"1234"}});
    const restrictedPage=await restricted.newPage();await restrictedPage.goto(base+"/#expenses");await restrictedPage.locator('#page').waitFor();assert.equal(await restrictedPage.locator('[data-nav="expenses"]').count(),0);assert.match(await restrictedPage.locator('#page').innerText(),/Acceso restringido/);
    assert.deepEqual(errors,[]);
    console.log("Gastos UI: efectivo, banco, clasificación sin doble descuento, comprobantes, Excel, reportes, reversión, filtros, roles y móvil correctos.");
  } finally {if(browser)await browser.close();await new Promise(r=>app.server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
