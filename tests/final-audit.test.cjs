"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),{randomUUID,createHash}=require("node:crypto");
const D=require("../domain.cjs"),{createApp}=require("../server.cjs");
test("Restaurar una copia anterior reemplaza gastos y reversiones, sin mezclar estados",async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"aurea-restauracion-final-")),app=createApp({dataDir:dir});
  await new Promise(r=>app.server.listen(0,"127.0.0.1",r));const base="http://127.0.0.1:"+app.server.address().port;
  try {
    const setup=await fetch(base+"/api/setup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workshop:"Taller",name:"Admin",username:"admin",password:"1234"})});
    const cookie=setup.headers.get("set-cookie").split(";")[0];
    const get=async(url)=>(await (await fetch(base+url,{headers:{Cookie:cookie}})).json());
    const action=async(action,data,key=randomUUID())=>{const current=(await get("/api/state")).state;const r=await fetch(base+"/api/action",{method:"POST",headers:{Cookie:cookie,"Content-Type":"application/json","If-Match":String(current.revision),"Idempotency-Key":key},body:JSON.stringify({action,data})});return {status:r.status,body:await r.json()};};
    const backup=await get("/api/backup");
    const priorKey=randomUUID(),priorData={name:"Cliente registrado después de la copia"};
    assert.equal((await action("client.save",priorData,priorKey)).status,200);
    await action("shift.open",{opening:100000});
    const expense=await action("expense.create",{category:"Arriendo",concept:"Gasto después de la copia",amount:20000,method:"cash"});
    assert.equal(expense.status,200);
    await action("operation.reverse",{type:"expense",id:expense.body.result.id,reason:"Prueba",confirmed:true});
    const before=(await get("/api/state")).state;assert.equal(before.expenses.length,1);assert.equal(before.reversals.length,1);
    const restoreKey=randomUUID();
    const restored=await action("backup.restore",{backup,password:"1234"},restoreKey);
    assert.equal(restored.status,200,JSON.stringify(restored.body));
    const after=(await get("/api/state")).state;
    assert.equal(after.expenses,undefined);assert.equal(after.reversals,undefined);
    assert.equal(after.shifts.length,0);assert.equal(after.cashEntries.length,0);
    assert.equal(after.revision,before.revision+1);D.validateState(after);
    const repeatedRestore=await action("backup.restore",{backup,password:"1234"},restoreKey);
    assert.equal(repeatedRestore.status,200);assert.deepEqual((await get("/api/state")).state,after);
    const repeatedPrior=await action("client.save",priorData,priorKey);
    assert.equal(repeatedPrior.status,409);assert.match(repeatedPrior.body.error,/restauró/);
    assert.deepEqual((await get("/api/state")).state,after);
    for(const corrupt of [x=>x.counters=null,x=>x.settings=null,x=>x.settings.rate=null,x=>x.counters.order=-1]){
      const bad=structuredClone(backup);corrupt(bad.state);const {checksum,...content}=bad;
      bad.checksum=createHash("sha256").update(JSON.stringify(content)).digest("hex");
      const rejected=await action("backup.restore",{backup:bad,password:"1234"});
      assert.equal(rejected.status,400,JSON.stringify(rejected.body));assert.deepEqual((await get("/api/state")).state,after);
    }
  } finally {await new Promise(r=>app.server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
});
test("Impuestos: redondeo exacto de medio peso con porcentajes de dos decimales",()=>{
  const s=D.initialState(),a={role:"admin",name:"Admin"};
  const c=D.execute(s,"client.save",{name:"Cliente"},a);
  const data={clientId:c.id,type:"Reparación",description:"Trabajo",condition:"Recibido",metal:"oro",purity:750,receivedWeight:1,dueDate:"2026-12-01",labor:5000,materialPrice:0,goldPrice:0};
  for(const [taxPercent,expected] of [[0.57,29],[0.69,35],[1.13,57],[19,950]]){
    const o=D.execute(s,"order.create",{...data,taxPercent},a);assert.equal(o.tax,expected,"Impuesto "+taxPercent);
  }
  assert.throws(()=>D.execute(s,"order.create",{...data,taxPercent:1.234},a),/decimales/);
});
function ownProduction(s,a,smith,weight,smithFee=0){
  const o=D.execute(s,"order.create",{type:"Producción propia",description:"Lote",condition:"Producción interna",metal:"oro",purity:750,receivedWeight:0,dueDate:"2026-12-01",labor:0,materialPrice:0,goldPrice:0,taxPercent:0},a);
  D.execute(s,"order.assign",{id:o.id,smithId:smith.id,ownWeight:weight,customerWeight:0,smithFee},a);
  D.execute(s,"order.return",{id:o.id,pieceWeight:weight,scrapWeight:0},a);
  D.execute(s,"order.quality",{id:o.id,checks:[true,true,true]},a);return o;
}
test("Inventario: el costo de una transferencia se reparte sin perder un peso por precisión",()=>{
  const s=D.initialState(),a={role:"admin",name:"Admin"};
  const smith=D.execute(s,"smith.save",{name:"Orfebre"},a);
  D.execute(s,"inventory.adjust",{account:"own",metal:"oro",purity:750,weight:9.311,reason:"Inventario de prueba"},a);
  const o=ownProduction(s,a,smith,9.311),stock=D.execute(s,"stock.receive",{id:o.id,quantity:9311,cost:989269924652,price:1},a);
  const first=D.execute(s,"stock.transfer",{id:stock.id,quantity:6014,weight:6.014,destination:"Joyería"},a);
  assert.equal(first.cost,638972111143);
  const last=D.execute(s,"stock.transfer",{id:stock.id,quantity:3297,weight:3.297,destination:"Joyería"},a);
  assert.equal(first.cost+last.cost,stock.cost);
  D.execute(s,"operation.reverse",{type:"stockTransfer",id:first.id,reason:"Retorno verificado",confirmed:true},a);
  D.execute(s,"operation.reverse",{type:"stockTransfer",id:last.id,reason:"Retorno verificado",confirmed:true},a);
  assert.equal(stock.remainingCost,stock.cost);assert.equal(stock.remainingMg,stock.mg);assert.equal(stock.available,stock.quantity);D.validateState(s);
  const bad=structuredClone(s);bad.stock[0].remainingCost--;
  assert.throws(()=>D.validateState(bad),/costo|concilia/);
});
test("Honorarios: no registra una liquidación bancaria que supere el límite monetario",()=>{
  const s=D.initialState(),a={role:"admin",name:"Admin"},smith=D.execute(s,"smith.save",{name:"Orfebre"},a);
  D.execute(s,"inventory.adjust",{account:"own",metal:"oro",purity:750,weight:2,reason:"Inventario de prueba"},a);
  ownProduction(s,a,smith,1,600000000000);ownProduction(s,a,smith,1,600000000000);
  assert.throws(()=>D.execute(s,"smith.settle",{smithId:smith.id,method:"bank",reference:"Banco"},a),/honorarios.*rango/i);
  assert.equal(s.settlements.length,0);
});
test("Insumos: conserva el costo exacto al consumir cantidades decimales",()=>{
  const s=D.initialState(),a={role:"admin",name:"Admin"};
  const c=D.execute(s,"client.save",{name:"Cliente"},a),o=D.execute(s,"order.create",{clientId:c.id,type:"Reparación",description:"Trabajo",condition:"Recibido",metal:"oro",purity:750,dueDate:"2026-12-01"},a);
  const m=D.execute(s,"material.save",{name:"Insumo fraccionado",unit:"ml",quantity:1,unitCost:50},a);
  const usage=D.execute(s,"material.use",{orderId:o.id,materialId:m.id,quantity:0.57},a);
  assert.equal(usage.cost,29);assert.equal(m.quantity,0.43);D.validateState(s);
});
