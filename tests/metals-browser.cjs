"use strict";
const {chromium}=require("playwright"),{createApp}=require("../server.cjs");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),assert=require("node:assert/strict");
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"aurea-metales-")),app=createApp({dataDir:dir});
  await new Promise(r=>app.server.listen(0,"127.0.0.1",r));
  const base="http://127.0.0.1:"+app.server.address().port;let browser;
  try {
    browser=await chromium.launch({headless:true,channel:"msedge"});
    const context=await browser.newContext({viewport:{width:1440,height:1000},locale:"es-CO"});
    await context.request.post(base+"/api/setup",{data:{workshop:"Taller",name:"Admin",username:"admin",password:"1234"}});
    const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.goto(base+"/#receive");
    const main=page.locator("#receive-form"),modal=page.locator("#modal-form");
    await main.locator('[name="description"]').fill("Anillo de paladio");
    await main.locator('[name="labor"]').fill("50000");
    await page.locator('[data-action="new-metal"]').click();
    await modal.locator('[name="name"]').fill("Paladio");
    await modal.locator('[name="rate"]').fill("200000");
    for(const width of [1440,768,390,320]){
      await page.setViewportSize({width,height:950});
      assert.equal(await page.locator('#dialog').evaluate(el=>el.scrollWidth>el.clientWidth),false);
    }
    await modal.locator('button[type="submit"]').click();await page.locator('#dialog').waitFor({state:"hidden"});
    assert.equal(await main.locator('[name="metal"]').inputValue(),"paladio");
    assert.equal(await main.locator('[name="description"]').inputValue(),"Anillo de paladio");
    assert.equal(await main.locator('[name="labor"]').inputValue(),"50.000,00");
    assert.equal(await main.locator('[data-gold-category="purity"]').isVisible(),false);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('[data-action="new-client"]').click();
    await modal.locator('[name="name"]').fill("Cliente paladio");
    await modal.locator('button[type="submit"]').click();await page.locator('#dialog').waitFor({state:"hidden"});
    await main.locator('[name="clientId"]').selectOption({label:"Cliente paladio · Sin documento"});
    await main.locator('[name="purity"]').fill("950");
    await main.locator('[name="receivedWeight"]').fill("3");
    await main.locator('[name="condition"]').fill("Anillo recibido");
    await main.locator('button[type="submit"]').click();await page.locator('h1').filter({hasText:"T-0001"}).waitFor();
    await page.goto(base+"/#gold");
    await page.locator('[data-filter="ledgerMetal"]').selectOption("paladio");
    assert.match(await page.locator('#page').innerText(),/paladio/);
    await page.goto(base+"/#categories");
    await page.locator('[data-action="edit-metal"][data-id="paladio"]').click();
    await modal.locator('[name="rate"]').fill("210000");
    await modal.locator('button[type="submit"]').click();await page.locator('#dialog').waitFor({state:"hidden"});
    await page.reload();await page.locator('[data-action="edit-metal"][data-id="paladio"]').waitFor();
    const state=(await (await context.request.get(base+"/api/state")).json()).state;
    assert.equal(state.orders[0].metal,"paladio");assert.equal(state.orders[0].rateSnapshot,200000);
    assert.equal(state.settings.rate.paladio,210000);
    assert.deepEqual(errors,[]);
    console.log("Metales UI: alta desde recepción, borrador conservado, selección automática, custodia, filtro, tarifa persistente y móvil correctos.");
  } finally {if(browser)await browser.close();await new Promise(r=>app.server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
