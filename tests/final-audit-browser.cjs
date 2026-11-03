"use strict";
const {chromium}=require("playwright"),{createApp}=require("../server.cjs");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),assert=require("node:assert/strict");
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"aurea-revision-final-ui-")),app=createApp({dataDir:dir});
  await new Promise(r=>app.server.listen(0,"127.0.0.1",r));const base="http://127.0.0.1:"+app.server.address().port;let browser;
  try {
    browser=await chromium.launch({headless:true,channel:"msedge"});
    const context=await browser.newContext({viewport:{width:1440,height:1000},locale:"es-CO"});
    await context.request.post(base+"/api/setup",{data:{workshop:"Taller pruebas",name:"Admin",username:"admin",password:"1234"}});
    const current=(await (await context.request.get(base+"/api/state")).json()).state;
    const response=await context.request.post(base+"/api/action",{headers:{"If-Match":String(current.revision),"Idempotency-Key":crypto.randomUUID()},data:{action:"client.save",data:{name:"Cliente"}}});
    const client=(await response.json()).result;
    const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.goto(base+"/#receive");const form=page.locator('#receive-form');
    await form.locator('[name="clientId"]').selectOption(client.id);
    await form.locator('[name="description"]').fill("Trabajo con impuesto fraccionado");await form.locator('[name="condition"]').fill("Pieza recibida");
    await form.locator('[name="labor"]').fill("5000");await form.locator('[name="taxPercent"]').fill("0,57");
    assert.match(await form.locator('#quote-preview').innerText(),/Impuesto \$ 29,00/);assert.match(await form.locator('#quote-preview').innerText(),/5\.029,00/);
    await form.locator('[name="labor"]').fill("1000000000001");assert.notEqual(await form.locator('[name="labor"]').evaluate(el=>el.validationMessage),"");
    await form.locator('[name="labor"]').fill("5000");await form.locator('button[type="submit"]').click();await page.locator('h1').filter({hasText:"T-0001"}).waitFor();
    await page.locator('[data-action="print-order"]').first().click();assert.match(await page.locator('#dialog').innerText(),/5\.029,00/);await page.keyboard.press("Escape");
    await page.goto(base+"/#receive");
    await form.locator('[name="type"]').selectOption("Producción propia");
    assert.match(await form.innerText(),/Pieza que fabrica el taller/);assert.match(await form.innerText(),/Presupuesto interno/);
    assert.equal(await form.locator('[name="clientId"]').isVisible(),false);assert.equal(await form.locator('[name="receivedWeight"]').isVisible(),false);
    assert.equal(await form.locator('[data-action="capture-received"]').isEnabled(),false);
    for(const width of [390,320]){await page.setViewportSize({width,height:950});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
    await form.locator('[name="description"]').fill("Pieza propia");await form.locator('[name="condition"]').fill("Diseño aprobado");
    await form.locator('button[type="submit"]').click();await page.locator('h1').filter({hasText:"T-0002"}).waitFor();
    const state=(await (await context.request.get(base+"/api/state")).json()).state;
    assert.equal(state.orders[0].tax,29);assert.equal(state.orders[1].receivedMg,0);assert.equal(state.orders[1].type,"Producción propia");assert.notEqual(state.orders[1].clientId,client.id);
    assert.deepEqual(errors,[]);console.log("Revisión final UI: impuesto exacto en presupuesto y comprobante, límites monetarios y fabricación propia sin custodia ficticia ni errores móviles.");
  } finally {if(browser)await browser.close();await new Promise(r=>app.server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
