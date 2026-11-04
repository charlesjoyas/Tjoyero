"use strict";
const {chromium}=require("playwright"),{createApp}=require("../server.cjs"),D=require("../domain.cjs");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),assert=require("node:assert/strict");
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),"aurea-valor-metales-ui-")),app=createApp({dataDir:dir});await new Promise(r=>app.server.listen(0,"127.0.0.1",r));const base="http://127.0.0.1:"+app.server.address().port;let browser;
try{
  browser=await chromium.launch({headless:true,channel:"msedge"});const context=await browser.newContext({viewport:{width:1440,height:1000},locale:"es-CO"});
  await context.request.post(base+"/api/setup",{data:{workshop:"Valor metales",name:"Admin",username:"admin",password:"1234"}});
  const s=JSON.parse(app.db.prepare("SELECT json FROM state WHERE id=1").get().json),actor={role:"admin",name:"Admin"};s.settings.rate.oro=1000000;s.settings.rate.plata=10000;
  const act=(action,data)=>D.execute(s,action,data,actor),save=()=>{D.validateState(s);app.db.prepare("UPDATE state SET json=? WHERE id=1").run(JSON.stringify(s));};
  const client=act("client.save",{name:"Cliente"}),smith=act("smith.save",{name:"Orfebre",bench:"Mesa"});
  act("inventory.adjust",{account:"own",metal:"oro",purity:750,weight:10,reason:"Inicial"});act("inventory.adjust",{account:"own",metal:"plata",purity:925,weight:4,reason:"Inicial"});
  const o=act("order.create",{clientId:client.id,type:"Reparación",description:"Cadena",condition:"Recibida",metal:"oro",purity:750,receivedWeight:2,dueDate:"2026-12-01",labor:0,taxPercent:0});
  act("order.assign",{id:o.id,smithId:smith.id,customerWeight:1,ownWeight:2});save();
  const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));await page.goto(base+"/#gold");
  const values=page.locator('#metal-valuation .kpi-value');await values.first().waitFor();assert.deepEqual(await values.allTextContents(),["$ 9.037.000,00","$ 7.537.000,00","$ 1.500.000,00"]);
  assert.equal(await page.locator('[data-metal-account="own"] [data-account-value]').innerText(),"$ 6.037.000,00");assert.equal(await page.locator('[data-metal-account="process"] [data-account-value]').innerText(),"$ 2.250.000,00");assert.equal(await page.locator('[data-metal-account="custody"] [data-account-value]').innerText(),"$ 750.000,00");
  const metalTable=page.locator('section.card').filter({has:page.getByRole('heading',{name:"Valor por metal",exact:true})}).locator('table');
  assert.match(await metalTable.innerText(),/Oro[\s\S]*7\.500\.000,00[\s\S]*1\.500\.000,00[\s\S]*9\.000\.000,00/);assert.match(await metalTable.innerText(),/Plata[\s\S]*37\.000,00/);
  const details=page.locator('section.card').filter({has:page.getByRole('heading',{name:"Existencias detalladas",exact:true})});assert.match(await details.innerText(),/Valor estimado COP/i);
  const before=JSON.stringify(s);await page.locator('[data-filter="ledgerMetal"]').selectOption("plata");assert.equal(await values.first().innerText(),"$ 9.037.000,00");assert.equal(JSON.stringify(s),before);
  act("inventory.transfer",{from:"own",to:"melt",metal:"oro",purity:750,weight:2,reason:"Apartado"});save();await page.reload();await values.first().waitFor();assert.equal(await values.first().innerText(),"$ 9.037.000,00");assert.equal(await page.locator('[data-metal-account="melt"] [data-account-value]').innerText(),"$ 1.500.000,00");
  act("inventory.adjust",{account:"own",metal:"platino",purity:950,weight:2,reason:"Inicial"});save();await page.reload();await values.first().waitFor();assert.match(await page.locator('#metal-valuation').innerText(),/Valoración incompleta/);assert.match(await page.locator('#metal-valuation').innerText(),/Platino/);assert.match(await values.first().innerText(),/parcial/);
  s.settings.rate.platino=100000;save();await page.reload();await values.first().waitFor();assert.equal(await values.first().innerText(),"$ 9.227.000,00");assert.doesNotMatch(await page.locator('#metal-valuation').innerText(),/Valoración incompleta/);
  s.settings.rate.oro=1000000000000;act("inventory.adjust",{account:"own",metal:"oro",purity:750,weight:1000000,reason:"Volumen extremo"});save();await page.reload();await values.first().waitFor();assert.doesNotMatch(await values.first().innerText(),/NaN|Infinity|e\+/);
  for(const width of[1440,768,390,320]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,"Valor de metales "+width);}
  assert.deepEqual(errors,[]);console.log("Valoración UI: total general, propio/clientes, metales, ubicaciones, fino y tarifa, traslado sin duplicar, tarifas faltantes, valores grandes y móvil correctos.");
}finally{if(browser)await browser.close();await new Promise(r=>app.server.close(r));fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
