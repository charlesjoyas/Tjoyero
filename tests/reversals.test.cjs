"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),{randomUUID}=require("node:crypto");
const D=require("../domain.cjs"),{createApp}=require("../server.cjs");
const a={role:"admin",name:"Admin"};
function fixture(){
  const s=D.initialState();s.settings.rate.oro=100000;
  const act=(action,b)=>{const x=D.execute(s,action,b,a);D.validateState(s);return x;};
  const c=act("client.save",{name:"Cliente"}),smith=act("smith.save",{name:"Orfebre",bench:"Mesa"}),supplier=act("supplier.save",{name:"Proveedor"});
  act("shift.open",{opening:2000000});
  act("inventory.adjust",{account:"own",metal:"oro",purity:750,weight:10,reason:"Existencia inicial"});
  const order=(extra={})=>act("order.create",{clientId:c.id,type:"Reparación",description:"Anillo",condition:"Recibido",metal:"oro",purity:750,receivedWeight:2,dueDate:"2026-12-01",labor:200000,materialPrice:0,goldPrice:0,taxPercent:0,...extra});
  const ready=(o,own=0)=>{
    act("order.assign",{id:o.id,smithId:smith.id,customerWeight:o.receivedMg/1000,ownWeight:own,smithFee:10000});
    const weight=o.receivedMg/1000+own;
    act("order.return",{id:o.id,pieceWeight:weight-0.1,scrapWeight:0.05,reason:"Merma ensayada"});
    act("order.quality",{id:o.id,checks:[true,true,true],note:"Revisado"});
  };
  const reverse=(type,id,extra={})=>act("operation.reverse",{type,id,reason:"Corrección verificada",reference:"DEV-001",confirmed:true,...extra});
  const blocked=(type,id,pattern,extra={})=>assert.throws(()=>D.execute(structuredClone(s),"operation.reverse",{type,id,reason:"Corrección",reference:"DEV-001",confirmed:true,...extra},a),pattern);
  const close=()=>act("shift.close",{counted:D.cashExpected(s,s.shifts.find(x=>!x.closedAt)),goldCounts:D.cashMetals(s).map(x=>({metal:x.metal,purity:x.purity,weight:x.mg/1000})),receiver:"Admin",reason:"Conciliado"});
  return {s,act,c,smith,supplier,order,ready,reverse,blocked,close};
}
test("Reversión de compra: exige devolver pagos, conserva documentos y restituye caja y metal",()=>{
  const f=fixture(),{s,act,reverse,blocked}=f;
  const p=act("purchase.create",{supplierId:f.supplier.id,document:"F-001",metal:"oro",purity:750,weight:2,rate:100000,dueDate:"2026-12-01"});
  const pay=act("supplier.pay",{id:p.id,amount:50000,method:"cash",reference:"REC-001"});
  blocked("purchase",p.id,/pagos/);
  reverse("supplierPayment",pay.id);
  assert.equal(D.cashExpected(s,s.shifts[0]),2000000);
  reverse("purchase",p.id);assert.equal(D.balance(s,"own","oro",750),10000);
  assert.equal(p.total,150000);assert.ok(p.reversedAt);assert.ok(pay.reversedAt);
  blocked("purchase",p.id,/ya fue/);
  assert.throws(()=>act("supplier.pay",{id:p.id,amount:1,method:"bank",reference:"x"}),/reversada/);
  assert.equal(s.reversals.length,2);
});
test("Reversión de cobro anterior: compensa turno actual y metal de bodega sin alterar el cierre",()=>{
  const f=fixture(),{s,act,reverse,blocked}=f,o=f.order({labor:300000});
  const p=act("payment.create",{orderId:o.id,cash:50000,bank:100000,bankRef:"B-001",goldWeight:1,metal:"oro",purity:750,rate:100000});
  f.close();const closed=JSON.stringify(s.shifts[0]);
  act("shift.open",{opening:200000});
  blocked("payment",p.id,/Existencia insuficiente/);
  blocked("payment",p.id,/soporte/,{metalSource:"own",reference:""});
  reverse("payment",p.id,{metalSource:"own"});
  assert.equal(JSON.stringify(s.shifts[0]),closed);
  assert.equal(D.cashExpected(s,s.shifts[1]),150000);
  assert.equal(D.balance(s,"own","oro",750),10000);
  assert.equal(D.paid(s,o),0);assert.ok(p.voidedAt);
  blocked("payment",p.id,/anulado|reversado/);
});
test("Venta: devuelve entrega exacta, conserva cobros y documentos históricos y soporta una nueva entrega",()=>{
  const f=fixture(),{s,act,reverse,blocked}=f,o=f.order();f.ready(o,1);
  const p=act("payment.create",{orderId:o.id,cash:200000});
  act("order.deliver",{id:o.id,acceptance:"Cliente"});const invoice=o.invoice;
  blocked("payment",p.id,/entrega/);
  const r=reverse("sale",o.id);assert.equal(r.original.invoice,invoice);
  assert.equal(o.status,"ready");assert.equal(o.invoice,null);assert.equal(D.paid(s,o),200000);
  const custody=D.balance(s,"custody","oro",750,o.id);
  reverse("payment",p.id);assert.equal(D.paid(s,o),0);
  assert.throws(()=>act("order.deliver",{id:o.id,acceptance:"Cliente"}),/saldo/);
  act("payment.create",{orderId:o.id,cash:200000});
  act("order.deliver",{id:o.id,acceptance:"Cliente segunda entrega"});assert.notEqual(o.invoice,invoice);
  reverse("sale",o.id);assert.equal(D.balance(s,"custody","oro",750,o.id),custody);
  assert.equal(s.reversals.filter(x=>x.type==="sale").length,2);
  blocked("sale",o.id,/vigente/);
});
test("Caja y libro: compensaciones seguras, sin saldos negativos ni reversión de movimientos automáticos",()=>{
  const f=fixture(),{s,act,reverse,blocked}=f;
  act("cash.entry",{amount:30000,type:"expense",note:"Gasto mal registrado"});
  const entry=s.cashEntries.at(-1);reverse("cash",entry.id);assert.equal(D.cashExpected(s,s.shifts[0]),2000000);
  blocked("cash",s.cashEntries.at(-1).id,/automáticos/);
  act("inventory.transfer",{from:"own",to:"scrap",metal:"oro",purity:750,weight:2,reason:"Traslado erróneo"});
  const movement=s.ledger.at(-1);reverse("ledger",movement.id);
  assert.equal(D.balance(s,"own","oro",750),10000);assert.equal(D.balance(s,"scrap","oro",750),0);
  blocked("ledger",movement.id,/ya fue/);
  blocked("ledger",s.ledger.at(-1).id,/original/);
  act("inventory.adjust",{account:"own",metal:"oro",purity:750,weight:12,reason:"Error de conteo"});
  reverse("ledger",s.ledger.at(-1).id);assert.equal(D.balance(s,"own","oro",750),10000);
});
test("Insumos: revierte consumos previos al retorno y entradas en orden, restaurando costo y cantidades",()=>{
  const f=fixture(),{s,act,reverse,blocked}=f,o=f.order();
  const m=act("material.save",{name:"Piedra",unit:"pieza",quantity:10,unitCost:100,min:0});
  const use=act("material.use",{orderId:o.id,materialId:m.id,quantity:2});
  reverse("material",use.id);assert.equal(m.quantity,10);assert.ok(o.materialUsage[0].reversedAt);
  reverse("order",o.id);assert.equal(o.status,"cancelled");
  act("material.restock",{id:m.id,quantity:2,unitCost:200,note:"Entrada A"});const first=s.materialMoves.at(-1);
  act("material.restock",{id:m.id,quantity:3,unitCost:300,note:"Entrada B"});const second=s.materialMoves.at(-1);
  blocked("material",first.id,/posteriores/);
  reverse("material",second.id);assert.equal(m.unitCost,200);assert.equal(m.quantity,12);
  reverse("material",first.id);assert.equal(m.unitCost,100);assert.equal(m.quantity,10);
  const done=f.order();act("material.use",{orderId:done.id,materialId:m.id,quantity:1});const used=s.materialMoves.at(-1);
  f.ready(done);blocked("material",used.id,/producción terminada/);
});
test("Piezas: retornos de transferencias restauran unidades, peso y costo; ingreso depende de esos retornos",()=>{
  const f=fixture(),{s,act,reverse,blocked}=f,o=f.order({type:"Producción propia",receivedWeight:0});f.ready(o,3);
  const stock=act("stock.receive",{id:o.id,quantity:2,cost:100001,price:90000});
  act("stock.transfer",{id:stock.id,quantity:1,weight:1.4,destination:"Joyería A"});const first=stock.transfers.at(-1);
  act("stock.transfer",{id:stock.id,quantity:1,weight:1.5,destination:"Joyería B"});const second=stock.transfers.at(-1);
  blocked("stockReceive",stock.id,/transferencias/);
  reverse("stockTransfer",first.id);reverse("stockTransfer",second.id);
  assert.equal(stock.available,2);assert.equal(stock.remainingMg,2900);assert.equal(stock.remainingCost,100001);
  blocked("stockTransfer",first.id,/ya fue/);
  reverse("stockReceive",stock.id);assert.equal(o.status,"ready");assert.equal(stock.available,0);
  act("stock.receive",{id:o.id,quantity:2,cost:100001,price:90000});
  assert.equal(s.stock.filter(x=>!x.reversedAt).length,1);
  assert.equal(D.balance(s,"finished","oro",750),2900);
});
test("Honorarios, permisos y límites físicos: deuda se reabre y procesos físicos no se inventan",()=>{
  const f=fixture(),{s,act,reverse,blocked}=f,o=f.order();f.ready(o);
  const p=act("smith.settle",{smithId:f.smith.id,method:"bank",reference:"BANCO"});
  blocked("settlement",p.id,/soporte/,{reference:""});reverse("settlement",p.id);
  const again=act("smith.settle",{smithId:f.smith.id,method:"cash",reference:"EFECTIVO"});assert.equal(again.amount,10000);
  assert.throws(()=>D.execute(s,"operation.reverse",{type:"settlement",id:again.id,confirmed:true,reason:"x"},{role:"recepcion"}),e=>e.status===403);
  blocked("melt",randomUUID(),/no admite/);
  blocked("settlement",again.id,/Confirma/,{confirmed:false});
  D.validateState(JSON.parse(JSON.stringify(s)));
});
test("Producción: solo deshace asignaciones inmediatas y aprobaciones; conserva pesajes físicos",()=>{
  const f=fixture(),{s,act,reverse,blocked}=f,o=f.order();
  act("order.assign",{id:o.id,smithId:f.smith.id,customerWeight:2,ownWeight:1,smithFee:10000});
  reverse("assignment",o.id);assert.equal(o.status,"received");
  assert.equal(D.balance(s,"custody","oro",750,o.id),2000);assert.equal(D.balance(s,"own","oro",750),10000);
  act("order.assign",{id:o.id,smithId:f.smith.id,customerWeight:2,ownWeight:0});
  act("order.progress",{id:o.id,note:"Comenzó soldadura"});
  blocked("assignment",o.id,/actividad posterior/);
  act("order.return",{id:o.id,pieceWeight:1.95,scrapWeight:0.03,reason:"Verificado"});
  act("order.quality",{id:o.id,checks:[true,true,true]});
  const weights=JSON.stringify(o.returned);reverse("quality",o.id);
  assert.equal(o.status,"quality");assert.equal(JSON.stringify(o.returned),weights);
});
test("Revisión: una compensación no puede desbordar el saldo que admite el cierre de caja",()=>{
  const f=fixture(),{s,act,blocked}=f;
  act("cash.entry",{type:"expense",amount:100,note:"Gasto"});const expense=s.cashEntries.at(-1);
  act("cash.entry",{type:"income",amount:1e12-D.cashExpected(s,s.shifts[0]),note:"Base en el límite"});
  assert.equal(D.cashExpected(s,s.shifts[0]),1e12);
  blocked("cash",expense.id,/Saldo resultante de caja/);
  assert.throws(()=>act("cash.entry",{type:"income",amount:1,note:"Desborde"}),/Saldo resultante de caja/);
  f.close();assert.equal(s.shifts[0].counted,1e12);
});
test("Revisión: las entradas de insumos con consumos posteriores se revierten en orden",()=>{
  const f=fixture(),{s,act,reverse,blocked}=f,o=f.order();
  const m=act("material.save",{name:"Piedra",unit:"pieza",quantity:20,unitCost:100,min:0});
  act("material.restock",{id:m.id,quantity:5,unitCost:200,note:"Nueva entrada"});const entry=s.materialMoves.at(-1);
  const usage=act("material.use",{orderId:o.id,materialId:m.id,quantity:1});
  assert.equal(m.quantity,24);
  blocked("material",entry.id,/consumos posteriores/);
  reverse("material",usage.id);reverse("material",entry.id);
  assert.equal(m.quantity,20);assert.equal(m.unitCost,100);
});
test("Revisión: referencias duplicadas o incompletas no fabrican metal al reversar una entrega",()=>{
  const f=fixture(),{s,act}=f,o=f.order();f.ready(o,1);
  act("payment.create",{orderId:o.id,cash:200000});act("order.deliver",{id:o.id,acceptance:"Cliente"});
  for(const ids of [[],[o.deliveryLedgerIds[0],o.deliveryLedgerIds[0]],[o.deliveryLedgerIds[0]]]) {
    const copy=structuredClone(s);copy.orders[0].deliveryLedgerIds=ids;
    assert.throws(()=>D.execute(copy,"operation.reverse",{type:"sale",id:o.id,confirmed:true,reason:"Revisión"},a),/completos y únicos|no concilian/);
  }
  const assign=fixture(),job=assign.order();assign.act("order.assign",{id:job.id,smithId:assign.smith.id,customerWeight:2,ownWeight:0});
  const copy=structuredClone(assign.s);copy.orders[0].assignmentLedgerIds.push(copy.orders[0].assignmentLedgerIds[0]);
  assert.throws(()=>D.execute(copy,"operation.reverse",{type:"assignment",id:job.id,confirmed:true,reason:"Revisión"},a),/duplicados/);
});
test("Revisión: las anulaciones existentes también quedan en el historial global, sin duplicar registros",()=>{
  const f=fixture(),{s,act,reverse}=f;
  const o=f.order();act("order.cancel",{id:o.id,reason:"Cliente desistió"});
  assert.equal(s.reversals.length,1);assert.equal(s.reversals[0].type,"order");
  const job=f.order(),p=act("payment.create",{orderId:job.id,cash:10000});
  act("payment.void",{id:p.id,reason:"Cobro equivocado"});
  assert.equal(s.reversals.length,2);assert.equal(s.reversals[1].targetId,p.id);
  reverse("order",job.id);assert.equal(s.reversals.length,3);
  assert.equal(s.reversals.filter(x=>x.targetId===job.id).length,1);
});
test("API: vista previa sin cambios, concurrencia, idempotencia y fallos atómicos",async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"aurea-reversas-")),app=createApp({dataDir:dir});
  await new Promise(r=>app.server.listen(0,"127.0.0.1",r));const base="http://127.0.0.1:"+app.server.address().port;
  try {
    const setup=await fetch(base+"/api/setup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workshop:"Taller",name:"Admin",username:"admin",password:"1234"})});
    const cookie=setup.headers.get("set-cookie").split(";")[0];
    const state=async()=>(await (await fetch(base+"/api/state",{headers:{Cookie:cookie}})).json()).state;
    const post=async(url,data,headers={})=>{const r=await fetch(base+url,{method:"POST",headers:{Cookie:cookie,"Content-Type":"application/json",...headers},body:JSON.stringify(data)});return {status:r.status,body:await r.json()};};
    const act=async(action,data,key=randomUUID(),revision)=>(await post("/api/action",{action,data},{"If-Match":String(revision??(await state()).revision),"Idempotency-Key":key}));
    await act("shift.open",{opening:100000});await act("cash.entry",{type:"expense",amount:20000,note:"Prueba"});
    const before=await state(),entry=before.cashEntries.at(-1),payload={type:"cash",id:entry.id,reason:"Corregir gasto",confirmed:true};
    const preview=await post("/api/reversal-preview",payload);assert.equal(preview.status,200);assert.equal(preview.body.cashDelta,20000);assert.deepEqual(await state(),before);
    assert.equal((await post("/api/reversal-preview",null)).status,400);
    const key=randomUUID();const results=await Promise.all([act("operation.reverse",payload,key,before.revision),act("operation.reverse",payload,key,before.revision)]);
    assert.deepEqual(results.map(x=>x.status),[200,200]);
    const after=await state();assert.equal(after.reversals.length,1);assert.equal(after.cashEntries.length,before.cashEntries.length+1);
    assert.equal((await act("operation.reverse",payload)).status,409);assert.deepEqual(await state(),after);
    const missing={type:"purchase",id:randomUUID(),reason:"No existe",confirmed:true};assert.equal((await act("operation.reverse",missing)).status,404);assert.deepEqual(await state(),after);
    await act("cash.entry",{type:"expense",amount:1000,note:"Dos aprobaciones"});
    const concurrent=await state(),target=concurrent.cashEntries.at(-1),request={type:"cash",id:target.id,reason:"Revisado por dos sesiones",confirmed:true};
    const races=await Promise.all([act("operation.reverse",request,randomUUID(),concurrent.revision),act("operation.reverse",request,randomUUID(),concurrent.revision)]);
    assert.deepEqual(races.map(x=>x.status).sort(),[200,409]);assert.equal((await state()).reversals.length,2);
    // El metal se intentaría devolver antes del efectivo: el fallo de caja no debe guardar nada.
    const f=fixture(),o=f.order();
    const payment=f.act("payment.create",{orderId:o.id,cash:20000,goldWeight:1,metal:"oro",purity:750,rate:100000});
    f.act("cash.entry",{amount:2020000,type:"expense",note:"Caja agotada"});
    app.db.prepare("UPDATE state SET json=? WHERE id=1").run(JSON.stringify(f.s));
    const emptyCash=await state(),reversePayment={type:"payment",id:payment.id,reason:"Devolución",confirmed:true};
    assert.equal((await act("operation.reverse",reversePayment)).status,400);
    assert.deepEqual(await state(),emptyCash);
    assert.equal((await post("/api/reversal-preview",reversePayment)).status,400);
    assert.deepEqual(await state(),emptyCash);
  } finally {await new Promise(r=>app.server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
});
