"use strict";
const {chromium}=require("playwright"),{createApp}=require("../server.cjs");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),assert=require("node:assert/strict");
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"aurea-metales-orden-")),app=createApp({dataDir:dir});
  await new Promise(r=>app.server.listen(0,"127.0.0.1",r));
  const base="http://127.0.0.1:"+app.server.address().port;let browser;
  try {
    browser=await chromium.launch({headless:true,channel:"msedge"});
    const context=await browser.newContext({viewport:{width:1440,height:1000},locale:"es-CO"});
    await context.request.post(base+"/api/setup",{data:{workshop:"Taller",name:"Admin",username:"admin",password:"1234"}});
    const state=async()=>(await (await context.request.get(base+"/api/state")).json()).state;
    await action("category.save",{name:"Oro 16k especial",purity:667});
    await action("category.save",{id:"gold-10k",name:"Oro 10k",purity:417,active:false});
    const before=await state();
    const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.goto(base+"/#receive");
    const main=page.locator("#receive-form"),modal=page.locator("#modal-form");
    assert.match(await main.innerText(),/1\. Lo que trae el cliente/);
    assert.match(await main.innerText(),/2\. Lo que le cobras al cliente/);
    assert.equal(await main.locator('.card').first().locator('[data-action="new-order-metal"]').count(),0);
    assert.match(await main.innerText(),/Añadir un cobro al presupuesto no descuenta gramos/);
    await main.locator('[name="description"]').fill("Trabajo con metal vendido");
    await main.locator('[name="labor"]').fill("50000");
    await main.locator('[name="goldPrice"]').fill("10000");
    async function add(name,price){
      await page.locator('[data-action="new-order-metal"]').click();
      await modal.locator('select[name="name"]').selectOption(name);
      assert.equal(await modal.locator('select[name="name"] option[value="Oro 10k"]').count(),0);
      await modal.locator('[name="price"]').fill(price);
      await modal.locator('button[type="submit"]').click();
      await page.locator('#dialog').waitFor({state:"hidden"});
    }
    await add("Oro 16k especial","20000");
    await add("Plata","5000");
    assert.equal(await main.locator('[name="goldPrice"]').inputValue(),"35.000,00");
    assert.match(await main.locator('#order-metal-list').innerText(),/Oro 16k especial/);
    assert.match(await main.locator('#order-metal-list').innerText(),/20\.000,00/);
    assert.deepEqual((await state()).settings,before.settings);
    assert.equal((await state()).revision,before.revision,"Añadir un renglón no guarda cambios globales");
    await main.locator('[data-action="edit-order-metal"]').first().click();
    await modal.locator('[name="price"]').fill("25000");
    for(const width of [1440,768,390,320]){
      await page.setViewportSize({width,height:950});
      assert.equal(await page.locator('#dialog').evaluate(el=>el.scrollWidth>el.clientWidth),false);
    }
    await modal.locator('button[type="submit"]').click();await page.locator('#dialog').waitFor({state:"hidden"});
    assert.equal(await main.locator('[name="goldPrice"]').inputValue(),"40.000,00");
    await main.locator('[data-action="remove-order-metal"]').last().click();
    assert.equal(await main.locator('[name="goldPrice"]').inputValue(),"35.000,00");
    await add("Plata","5000");
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) console.log(await page.evaluate(()=>[...document.querySelectorAll('#page *')].filter(el=>el.getBoundingClientRect().right>innerWidth).slice(0,12).map(el=>({tag:el.tagName,cls:el.className,width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right}))));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('[data-action="new-client"]').click();
    await modal.locator('[name="name"]').fill("Cliente metales");
    await modal.locator('button[type="submit"]').click();await page.locator('#dialog').waitFor({state:"hidden"});
    assert.equal(await main.locator('[name="goldPrice"]').inputValue(),"40.000,00");
    await main.locator('[name="clientId"]').selectOption({label:"Cliente metales · Sin documento"});
    await main.locator('[name="condition"]').fill("Pieza recibida");
    await main.locator('[name="taxPercent"]').fill("19");
    await main.locator('button[type="submit"]').click();await page.locator('h1').filter({hasText:"T-0001"}).waitFor();
    await page.reload();await page.locator('h1').filter({hasText:"T-0001"}).waitFor();
    let saved=await state();
    assert.equal(saved.orders[0].orderMetals.length,2);
    assert.equal(saved.orders[0].goldPrice,40000);
    assert.equal(saved.orders[0].tax,17100);
    assert.deepEqual(saved.settings,before.settings);
    assert.equal(saved.ledger.length,0,"El detalle comercial no genera inventario");
    assert.match(await page.locator('#page').innerText(),/Oro 16k especial/);
    assert.match(await page.locator('#page').innerText(),/Sin salida de metal propio registrada/);
    for(const width of [390,320]) {
      await page.setViewportSize({width,height:950});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,"Detalle de orden en móvil");
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('[data-action="print-order"]').first().click();
    assert.match(await page.locator('#dialog').innerText(),/Plata/);
    await page.keyboard.press("Escape");
    await page.locator('[data-action="edit-order"]').click();
    await modal.locator('[name^="orderMetalPrice-"]').first().fill("30000");
    assert.equal(await modal.locator('[name="goldPrice"]').inputValue(),"45.000,00");
    await modal.locator('[data-action="remove-inline-metal"]').last().click();
    assert.equal(await modal.locator('[name="goldPrice"]').inputValue(),"40.000,00");
    await modal.locator('[name="reason"]').fill("Metal acordado actualizado");
    await page.setViewportSize({width:320,height:950});
    assert.equal(await page.locator('#dialog').evaluate(el=>el.scrollWidth>el.clientWidth),false,"Edición de metales en móvil");
    await modal.locator('button[type="submit"]').click();await page.locator('#dialog').waitFor({state:"hidden"});
    saved=await state();assert.equal(saved.orders[0].orderMetals.length,1);
    assert.equal(saved.orders[0].orderMetals[0].price,30000);
    assert.equal(saved.orders[0].goldPrice,40000);
    async function action(action,data) {
      const current=await state();
      const r=await context.request.post(base+"/api/action",{headers:{"If-Match":String(current.revision),"Idempotency-Key":crypto.randomUUID()},data:{action,data}});
      assert.equal(r.status(),200,await r.text());return (await r.json()).result;
    }
    const smith=await action("smith.save",{name:"Orfebre",bench:"Mesa"});
    await action("inventory.adjust",{account:"own",metal:"oro",purity:750,weight:5,reason:"Existencia de prueba"});
    await action("order.assign",{id:saved.orders[0].id,smithId:smith.id,ownWeight:2,customerWeight:0,source:"own",smithFee:0});
    await page.reload();await page.locator('h1').filter({hasText:"T-0001"}).waitFor();
    assert.match(await page.locator('#page').innerText(),/Salida de metal propio registrada/);
    assert.match(await page.locator('#page').innerText(),/2,000 g de oro/);
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(base+"/#receive");
    assert.equal(await main.locator('[name="orderMetals"]').inputValue(),"[]");
    assert.equal(await main.locator('[name="goldPrice"]').inputValue(),"0,00");
    assert.equal(await main.locator('[name="metal"] option').filter({hasText:"Oro 16k especial"}).count(),0);
    assert.deepEqual(errors,[]);
    console.log("Metales por orden: detalle y precio total, suma única, edición, eliminación, comprobante, móvil y aislamiento entre órdenes/catálogo/inventario correctos.");
  } finally {if(browser)await browser.close();await new Promise(r=>app.server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
