"use strict";
const {chromium}=require("playwright"),{createApp}=require("../server.cjs"),D=require("../domain.cjs");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),assert=require("node:assert/strict");
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"aurea-multi-metals-ui-")),app=createApp({dataDir:dir});
  await new Promise(r=>app.server.listen(0,"127.0.0.1",r));const base="http://127.0.0.1:"+app.server.address().port;let browser;
  try{
    browser=await chromium.launch({headless:true,channel:"msedge"});const context=await browser.newContext({viewport:{width:1440,height:1000},locale:"es-CO"});
    await context.request.post(base+"/api/setup",{data:{workshop:"Taller multimetal",name:"Admin",username:"admin",password:"1234"}});
    const state=async()=>(await (await context.request.get(base+"/api/state")).json()).state;
    async function act(action,data){const s=await state();const r=await context.request.post(base+"/api/action",{headers:{"If-Match":String(s.revision),"Idempotency-Key":crypto.randomUUID()},data:{action,data}});assert.equal(r.status(),200,await r.text());return(await r.json()).result;}
    const client=await act("client.save",{name:"Cliente"});await act("smith.save",{name:"Orfebre",bench:"Mesa 1"});
    for(const [metal,purity]of[["oro",750],["plata",925]])await act("inventory.adjust",{account:"own",metal,purity,weight:10,reason:"Saldo inicial"});
    const o=await act("order.create",{clientId:client.id,type:"Reparación",description:"Anillo bimetálico",condition:"Recibido",metal:"oro",purity:750,receivedWeight:2,dueDate:"2026-12-01",labor:0,taxPercent:0});
    const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.goto(base+"/#orders/"+o.id);
    await page.locator('[data-action="assign-order"]').click();const form=page.locator("#modal-form");
    await form.locator('[name="ownWeight"]').fill("1");
    await form.locator('[data-action="add-assignment-metal"]').click();
    await form.locator('[name="ownMetal-0"]').selectOption("plata");await form.locator('[name="ownPurity-0"]').fill("925");await form.locator('[name="ownWeight-0"]').fill("3");
    assert.match(await form.locator('[data-assignment-available]').innerText(),/10,000/);
    await form.locator('[data-action="add-assignment-metal"]').click();await form.locator('[data-action="remove-assignment-metal"][data-id="1"]').click();assert.equal(await form.locator('.own-assignment-row').count(),1);
    for(const width of[768,390,320]){await page.setViewportSize({width,height:950});assert.equal(await page.locator('#dialog').evaluate(el=>el.scrollWidth>el.clientWidth),false,"Asignar a mesa "+width);}
    const submit=async()=>{await form.locator('button[type="submit"]').click();await page.locator('#dialog').waitFor({state:"hidden"});};
    await submit();let s=await state();assert.equal(s.orders[0].allocations.length,3);assert.equal(D.balance(s,"own","plata",925),7000);assert.equal(D.balance(s,"own","oro",750),9000);
    assert.match(await page.locator('#page').innerText(),/plata/);await page.setViewportSize({width:1440,height:1000});
    await page.locator('[data-action="return-order"]').click();
    await form.locator('[name="pieceWeight-0"]').fill("2,940");await form.locator('[name="scrapWeight-0"]').fill("0,040");
    await form.locator('[name="pieceWeight-1"]').fill("2,940");await form.locator('[name="scrapWeight-1"]').fill("0,040");
    for(const width of[390,320]){await page.setViewportSize({width,height:950});assert.equal(await page.locator('#dialog').evaluate(el=>el.scrollWidth>el.clientWidth),false,"Retorno por metal "+width);}
    await submit();s=await state();assert.equal(s.orders[0].returned.pieceMg,5880);assert.equal(D.balance(s,"finished","plata",925),2940);
    await page.reload();await page.locator('#page h1').waitFor();assert.match(await page.locator('#page').innerText(),/plata/);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.setViewportSize({width:1440,height:1000});await page.locator('[data-action="print-order"]').click();assert.match(await page.locator('.receipt').innerText(),/METALES EN LA PIEZA/);assert.match(await page.locator('.receipt').innerText(),/plata/);await page.keyboard.press("Escape");
    await act("order.quality",{id:o.id,checks:[true,true,true]});await act("order.deliver",{id:o.id,acceptance:"Cliente"});
    s=await state();assert.equal(D.balance(s,"finished","plata",925),0);
    const own=await act("order.create",{type:"Producción propia",description:"Lote oro y plata",condition:"Interno",metal:"oro",purity:750,receivedWeight:0,dueDate:"2026-12-01",taxPercent:0});
    await act("order.assign",{id:own.id,smithId:s.smiths[0].id,ownWeight:2,ownMetals:[{metal:"plata",purity:925,weight:4}]});
    await act("order.return",{id:own.id,metalReturns:[{metal:"oro",purity:750,pieceWeight:2},{metal:"plata",purity:925,pieceWeight:4}]});await act("order.quality",{id:own.id,checks:[true,true,true]});await act("stock.receive",{id:own.id,quantity:2,cost:100001,price:100000});
    await page.goto(base+"/#stock");await page.reload();await page.locator('[data-action="transfer-stock"]').click();
    await form.locator('[name="quantity"]').fill("1");await form.locator('[name="componentWeight-0"]').fill("1");await form.locator('[name="componentWeight-1"]').fill("2");await form.locator('[name="destination"]').fill("Joyería");await submit();
    s=await state();assert.deepEqual(s.stock[0].components.map(x=>x.remainingMg),[1000,2000]);
    const waiting=page.waitForEvent("download");await page.locator('[data-action="export-transfer"]').click();const download=await waiting;
    const book=new(require("../exceljs.min.js").Workbook)();await book.xlsx.load(fs.readFileSync(await download.path()));
    assert.equal(book.worksheets[0].getCell("F2").value,"oro + plata");assert.match(book.worksheets[0].getCell("N2").value,/plata/);assert.equal(book.worksheets[0].getCell("I2").value,50001);
    await act("inventory.adjust",{account:"own",metal:"oro",purity:715,weight:7,reason:"Saldo inicial"});
    await act("inventory.adjust",{account:"own",metal:"oro",purity:999,weight:10,reason:"Saldo inicial"});
    const differentLaw = await act("order.create",{
      clientId:client.id,type:"Fabricación",description:"Oro de bodega",condition:"Sin custodia",
      metal:"oro",purity:916,receivedWeight:0,dueDate:"2026-12-01",
    });
    await page.goto(base+"/#orders/"+differentLaw.id);
    await page.reload();
    await page.locator('[data-action="assign-order"]').click();
    const law = form.locator('[name="ownPurity"]');
    assert.equal(await law.inputValue(),"916");
    assert.match(await law.locator('option[value="916"]').innerText(),/0,000 g/);
    assert.match(await law.locator('option[value="715"]').innerText(),/7,000 g/);
    await law.selectOption("715");
    await form.locator('[name="source"]').selectOption("melt");
    assert.equal(await law.inputValue(),"715");
    assert.match(await law.locator('option[value="715"]').innerText(),/0,000 g/);
    await form.locator('[name="source"]').selectOption("own");
    await form.locator('[name="ownWeight"]').fill("2");
    await submit();
    s=await state();
    assert.equal(s.orders.find(order=>order.id===differentLaw.id).allocations[0].purity,715);
    assert.equal(D.balance(s,"own","oro",715),5000);
    assert.equal(D.balance(s,"own","oro",999),10000);
    assert.equal(D.balance(s,"process","oro",916),0);
    assert.deepEqual(errors,[]);console.log("Metales propios UI: añadir/quitar, existencias, varias leyes, retorno, entrega, composición de piezas, traslado, Excel, recarga y móvil correctos.");
  }finally{if(browser)await browser.close();await new Promise(r=>app.server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
