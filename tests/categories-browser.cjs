"use strict";
const { chromium }=require("playwright");
const {createApp}=require("../server.cjs");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const assert=require("node:assert/strict");
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"aurea-categorias-ui-"));
  const app=createApp({dataDir:dir});
  await new Promise(r=>app.server.listen(0,"127.0.0.1",r));
  const base="http://127.0.0.1:"+app.server.address().port;
  let browser;
  try {
    browser=await chromium.launch({headless:true,channel:"msedge"});
    const context=await browser.newContext({viewport:{width:1440,height:1000},locale:"es-CO"});
    await context.request.post(base+"/api/setup",{data:{workshop:"Taller",name:"Admin",username:"admin",password:"1234"}});
    const page=await context.newPage();const errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.goto(base+"/#categories");
    await page.locator('[data-action="new-category"]').click();
    await page.locator('#modal-form [name="name"]').fill("Oro 16k especial");
    await page.locator('#modal-form [name="purity"]').fill("667");
    await page.locator('#modal-form button[type="submit"]').click();
    await page.locator('#dialog').waitFor({state:"hidden"});
    await page.reload();
    await page.locator('#page').getByText("Oro 16k especial",{exact:true}).waitFor();
    const state=(await (await context.request.get(base+"/api/state")).json()).state;
    const category=state.settings.goldCategories.find(x=>x.name==="Oro 16k especial");
    for (const width of [1440,768,390,320]) {
      await page.setViewportSize({width,height:950});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,"Overflow categorías "+width);
      await page.locator('[data-action="new-category"]').click();
      assert.equal(await page.locator('#dialog').evaluate(el=>el.scrollWidth>el.clientWidth),false,"Overflow formulario categoría "+width);
      await page.keyboard.press("Escape");
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(base+"/#receive");
    await page.locator('[data-gold-category="purity"]').selectOption(category.id);
    assert.equal(await page.locator('#receive-form [name="purity"]').inputValue(),"667,00");
    await page.locator('#receive-form [name="purity"]').fill("750");
    assert.equal(await page.locator('[data-gold-category="purity"]').inputValue(),"");
    await page.locator('[data-gold-category="purity"]').selectOption(category.id);
    await page.locator('#receive-form [name="metal"]').selectOption("plata");
    assert.equal(await page.locator('[data-gold-category="purity"]').inputValue(),"");
    // Navigate without the unsaved-form prompt affecting this test.
    await page.reload();
    await page.locator('[data-action="open-shift"]').first().click();
    await page.locator('[name="mode"]').selectOption("gold");
    await page.locator('[data-gold-category="openingPurity-0"]').selectOption(category.id);
    assert.equal(await page.locator('[name="openingPurity-0"]').inputValue(),"667,00");
    await page.goto(base+"/#categories");
    await page.reload();
    await page.locator(`[data-action="edit-category"][data-id="${category.id}"]`).click();
    await page.locator('#modal-form [name="active"]').selectOption("false");
    await page.locator('#modal-form button[type="submit"]').click();
    await page.locator('#dialog').waitFor({state:"hidden"});
    await page.goto(base+"/#receive");
    assert.equal(await page.locator(`[data-gold-category="purity"] option[value="${category.id}"]`).count(),0);
    assert.deepEqual(errors,[]);
    console.log("Categorías UI: creación persistente, selección de ley, edición manual, cambio de metal, caja, desactivación y responsive correctos.");
  } finally {if(browser)await browser.close();await new Promise(r=>app.server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
