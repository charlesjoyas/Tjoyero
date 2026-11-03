"use strict";
const {chromium}=require("playwright");
const {createApp}=require("../server.cjs");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),assert=require("node:assert/strict");
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"aurea-mano-obra-"));
  const app=createApp({dataDir:dir});
  await new Promise(r=>app.server.listen(0,"127.0.0.1",r));
  const base="http://127.0.0.1:"+app.server.address().port;
  let browser;
  try {
    browser=await chromium.launch({headless:true,channel:"msedge"});
    const context=await browser.newContext({viewport:{width:1440,height:1000},locale:"es-CO"});
    await context.request.post(base+"/api/setup",{data:{workshop:"Taller",name:"Admin",username:"admin",password:"1234"}});
    const page=await context.newPage(),errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.goto(base+"/#receive");
    const main=page.locator("#receive-form");
    await main.locator('[name="labor"]').fill("12345");
    await page.locator('[data-action="estimate-labor"]').click();
    await page.keyboard.press("Escape");
    assert.equal(await main.locator('[name="labor"]').inputValue(),"12.345,00");
    await page.locator('[data-action="estimate-labor"]').click();
    const modal=page.locator("#modal-form");
    for(const [name,value] of Object.entries({quantity:"2,50",rate:"20000",overhead:"5000",markup:"30"}))
      await modal.locator(`[name="${name}"]`).fill(value);
    assert.match(await modal.locator("#labor-preview").innerText(),/71\.500,00/);
    for(const width of [1440,768,390,320]) {
      await page.setViewportSize({width,height:950});
      assert.equal(await page.locator('#dialog').evaluate(el=>el.scrollWidth>el.clientWidth),false,"Modal responsive "+width);
    }
    await modal.locator('button[type="submit"]').click();
    await page.locator('#dialog').waitFor({state:"hidden"});
    assert.equal(await main.locator('[name="labor"]').inputValue(),"71.500,00");
    await main.locator('[name="labor"]').fill("80000");
    assert.match(await main.locator('#labor-estimate-summary').innerHTML(),/ajustó manualmente/);
    await page.locator('[data-action="estimate-labor"]').click();
    assert.equal(await modal.locator('[name="quantity"]').inputValue(),"2,50");
    await modal.locator('[name="mode"]').selectOption("weight");
    assert.match(await modal.innerText(),/Gramos a trabajar/);
    for(const [name,value] of Object.entries({quantity:"3,25",rate:"12000",overhead:"5000",markup:"20",minimum:"60000"}))
      await modal.locator(`[name="${name}"]`).fill(value);
    await modal.locator('button[type="submit"]').click();
    await page.locator('#dialog').waitFor({state:"hidden"});
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('[data-action="new-client"]').click();
    await modal.locator('[name="name"]').fill("Cliente estimado");
    await modal.locator('button[type="submit"]').click();
    await page.locator('#dialog').waitFor({state:"hidden"});
    assert.equal(await main.locator('[name="labor"]').inputValue(),"60.000,00");
    assert.equal(JSON.parse(await main.locator('[name="laborEstimate"]').inputValue()).suggested,60000);
    await main.locator('[name="clientId"]').selectOption({label:"Cliente estimado · Sin documento"});
    for(const [name,value] of Object.entries({description:"Anillo a reparar",condition:"Pieza recibida",receivedWeight:"3,25",materialPrice:"5000",taxPercent:"19"}))
      await main.locator(`[name="${name}"]`).fill(value);
    await main.locator('button[type="submit"]').click();
    await page.locator("h1").filter({hasText:"T-0001"}).waitFor();
    await page.reload();
    await page.locator("h1").filter({hasText:"T-0001"}).waitFor();
    const state=(await (await context.request.get(base+"/api/state")).json()).state;
    const o=state.orders[0];
    assert.equal(o.labor,60000);assert.equal(o.tax,12350);
    assert.equal(o.laborEstimate.mode,"weight");assert.equal(o.laborEstimate.baseCost,44000);
    assert.equal(o.laborEstimate.suggested,60000);
    assert.match(await page.locator('#page').innerText(),/Estimado de mano de obra: \$ 60\.000,00/);
    assert.deepEqual(errors,[]);
    console.log("Mano de obra: cancelación, horas, gramos, mínimo, recargo, aplicación, ajuste manual, persistencia, presupuesto e impuestos y modal móvil correctos.");
  } finally {if(browser)await browser.close();await new Promise(r=>app.server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
