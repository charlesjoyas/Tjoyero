"use strict";
const {chromium}=require("playwright"),{createApp}=require("../server.cjs"),D=require("../domain.cjs");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),assert=require("node:assert/strict");
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),"aurea-compras-ui-")),app=createApp({dataDir:dir});await new Promise(r=>app.server.listen(0,"127.0.0.1",r));const base="http://127.0.0.1:"+app.server.address().port;let browser;
try{
  browser=await chromium.launch({headless:true,channel:"msedge"});const context=await browser.newContext({viewport:{width:1440,height:1000},locale:"es-CO"});
  await context.request.post(base+"/api/setup",{data:{workshop:"Taller compras",name:"Admin",username:"admin",password:"1234"}});
  const state=async()=>(await(await context.request.get(base+"/api/state")).json()).state;
  async function act(action,data){const current=await state();const response=await context.request.post(base+"/api/action",{headers:{"If-Match":String(current.revision),"Idempotency-Key":crypto.randomUUID()},data:{action,data}});assert.equal(response.status(),200,await response.text());return(await response.json()).result;}
  await act("supplier.save",{name:"Proveedor oro",document:"000123"});const custom=await act("category.save",{name:"Oro 16k especial",purity:667});
  await act("category.save",{id:"gold-10k",name:"Oro 10k",purity:417,active:false});
  const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));await page.goto(base+"/#purchases");
  await page.locator('[data-action="new-purchase"]').click();const form=page.locator('#modal-form');
  assert.equal(await form.locator('[name="purchaseCategory-0"] option[value="gold-10k"]').count(),0);
  await form.locator('[name="document"]').fill("000987");await form.locator('[name="purchaseCategory-0"]').selectOption("gold-18k");await form.locator('[name="purchaseWeight-0"]').fill("2,345");await form.locator('[name="purchasePrice-0"]').fill("300000");
  await form.locator('[data-action="add-purchase-row"]').click();await form.locator('[name="purchaseCategory-1"]').selectOption(custom.id);await form.locator('[name="purchaseWeight-1"]').fill("1,234");await form.locator('[name="purchasePrice-1"]').fill("200000");
  assert.match(await form.locator('#purchase-order-preview').innerText(),/950\.300,00/);
  await form.locator('[data-action="add-purchase-row"]').click();await form.locator('[data-action="remove-purchase-row"][data-id="2"]').click();assert.equal(await form.locator('[data-purchase-row]').count(),2);
  for(const width of[1440,768,390,320]){await page.setViewportSize({width,height:950});assert.equal(await page.locator('#dialog').evaluate(el=>el.scrollWidth>el.clientWidth),false,"Orden de compra "+width);}
  await form.locator('button[type="submit"]').click();await page.locator('#dialog').waitFor({state:"hidden"});
  let s=await state();assert.equal(s.purchases.length,1);assert.equal(s.purchases[0].total,950300);assert.equal(D.balance(s,"own","oro",750),2345);assert.equal(D.balance(s,"own","oro",667),1234);assert.equal(s.cashEntries.length,0);
  assert.match(await page.locator('#page table').first().innerText(),/Oro 16k especial/);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,"Compras móvil");
  await page.setViewportSize({width:1440,height:1000});await page.locator('[data-action="print-purchase"]').click();assert.match(await page.locator('.receipt').innerText(),/000987/);assert.match(await page.locator('.receipt').innerText(),/Oro 16k especial/);assert.match(await page.locator('.receipt').innerText(),/950\.300,00/);await page.keyboard.press("Escape");
  const waiting=page.waitForEvent("download");await page.locator('[data-action="export-purchases"]').click();const file=await waiting,book=new(require("../exceljs.min.js").Workbook)();await book.xlsx.load(fs.readFileSync(await file.path()));const sheet=book.worksheets[0];
  assert.equal(sheet.rowCount,3);assert.equal(sheet.getCell("D2").value,"000987");assert.equal(sheet.getCell("H2").value,300000);assert.equal(sheet.getCell("J3").value,246800);assert.equal(sheet.getCell("K2").value,950300);assert.equal(sheet.getCell("K3").value,null);
  await page.goto(base+"/#gold");assert.match(await page.locator('#page').innerText(),/667,00/);
  await act("category.delete",{id:custom.id});await page.goto(base+"/#purchases");await page.reload();assert.match(await page.locator('#page table').first().innerText(),/Oro 16k especial/);
  assert.deepEqual(errors,[]);console.log("Órdenes de compra UI: categorías activas y personalizadas, varias leyes, cálculo exacto, ingreso inmediato, historial, comprobante, Excel, compatibilidad y móvil correctos.");
}finally{if(browser)await browser.close();await new Promise(r=>app.server.close(r));fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
