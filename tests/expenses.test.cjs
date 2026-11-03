"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),{randomUUID}=require("node:crypto");
const D=require("../domain.cjs"),{createApp}=require("../server.cjs");
const actor={role:"admin",name:"Admin"};
const expense=(extra={})=>({category:"Servicios públicos",concept:"Energía del taller",amount:20000,method:"cash",expenseDate:D.day(),beneficiary:"Empresa de energía",reference:"FACT-001",...extra});
const act=(s,action,data)=>{const x=D.execute(s,action,data,actor);D.validateState(s);return x;};
test("Gastos: efectivo descuenta una sola vez, banco se registra sin caja y los saldos se conservan",()=>{
  const s=D.initialState();act(s,"shift.open",{opening:100000});
  const e=act(s,"expense.create",expense());
  assert.equal(D.cashExpected(s,s.shifts[0]),80000);assert.equal(s.cashEntries.length,1);
  const orphan=structuredClone(s);orphan.expenses=[];
  assert.throws(()=>D.validateState(orphan),/sin su gasto/);
  assert.equal(s.cashEntries[0].expenseId,e.id);assert.equal(s.cashEntries[0].amount,-20000);
  const bank=act(s,"expense.create",expense({method:"bank",amount:40000,reference:"BANCO-001"}));
  assert.equal(bank.shiftId,null);assert.equal(bank.cashEntryId,null);
  assert.equal(D.cashExpected(s,s.shifts[0]),80000);assert.equal(s.cashEntries.length,1);
  D.validateState(JSON.parse(JSON.stringify(s)));
});
test("Gastos: bloquea saldo insuficiente, datos inválidos, turno equivocado y roles sin permisos",()=>{
  const s=D.initialState();act(s,"shift.open",{opening:10000});
  for(const data of [expense(),expense({amount:0}),expense({amount:1.5}),expense({method:"crypto"}),expense({method:"bank",reference:""}),expense({category:"No existe"}),expense({expenseDate:"2999-01-01"}),expense({expenseDate:[D.day()]})])
    assert.throws(()=>D.execute(structuredClone(s),"expense.create",data,actor));
  assert.throws(()=>D.execute(s,"expense.create",expense({amount:1,shiftId:"otro"}),actor),e=>e.status===409);
  for(const role of ["consulta","produccion"])
    assert.throws(()=>D.execute(s,"expense.create",expense(),{role}),e=>e.status===403);
  const noShift=D.initialState();assert.throws(()=>D.execute(noShift,"expense.create",expense(),actor),/turno/);
  act(noShift,"expense.create",expense({method:"bank"}));assert.equal(noShift.expenses.length,1);
});
test("Gastos anteriores: clasificar no duplica la salida ni modifica un cierre, y no se puede clasificar dos veces",()=>{
  const s=D.initialState();act(s,"shift.open",{opening:100000});
  act(s,"cash.entry",{type:"expense",amount:20000,note:"Factura antigua"});const original=s.cashEntries[0];
  act(s,"shift.close",{counted:80000,goldCounts:[],receiver:"Admin",reason:"Conciliado"});
  const closed=JSON.stringify(s.shifts[0]);
  const e=act(s,"expense.classify",expense({cashEntryId:original.id}));
  assert.equal(s.cashEntries.length,1);assert.equal(D.cashExpected(s,s.shifts[0]),80000);assert.equal(JSON.stringify(s.shifts[0]),closed);
  assert.equal(e.cashEntryId,original.id);assert.ok(e.classifiedFromCash);
  assert.throws(()=>D.execute(structuredClone(s),"expense.classify",expense({cashEntryId:original.id}),actor),/clasificada/);
  assert.throws(()=>D.execute(structuredClone(s),"operation.reverse",{type:"cash",id:original.id,reason:"Error",confirmed:true},actor),/clasificado/);
  act(s,"shift.open",{opening:50000});
  act(s,"operation.reverse",{type:"expense",id:e.id,reason:"Proveedor devolvió el dinero",confirmed:true});
  assert.equal(D.cashExpected(s,s.shifts[1]),70000);assert.equal(JSON.stringify(s.shifts[0]),closed);
  assert.ok(original.reversedAt&&e.reversedAt);
});
test("Reversión de gasto: reembolsa en el turno actual y exige soporte bancario",()=>{
  const s=D.initialState();act(s,"shift.open",{opening:50000});
  const e=act(s,"expense.create",expense());
  act(s,"operation.reverse",{type:"expense",id:e.id,reason:"Duplicado",confirmed:true});
  assert.equal(D.cashExpected(s,s.shifts[0]),50000);
  assert.throws(()=>D.execute(s,"operation.reverse",{type:"expense",id:e.id,reason:"Otra vez",confirmed:true},actor),/ya fue/);
  const bank=act(s,"expense.create",expense({method:"bank"}));
  assert.throws(()=>D.execute(structuredClone(s),"operation.reverse",{type:"expense",id:bank.id,reason:"Devolución",confirmed:true},actor),/soporte/);
  act(s,"operation.reverse",{type:"expense",id:bank.id,reason:"Devolución",reference:"DEV-BANCO",confirmed:true});
  assert.equal(D.cashExpected(s,s.shifts[0]),50000);
  const bad=structuredClone(s);bad.expenses[0].amount=30000;
  assert.throws(()=>D.validateState(bad),/no concilia/);
});
test("Gastos API: idempotencia, rollback, vista previa y persistencia",async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"aurea-gastos-api-")),app=createApp({dataDir:dir});
  await new Promise(r=>app.server.listen(0,"127.0.0.1",r));const base="http://127.0.0.1:"+app.server.address().port;
  try {
    const setup=await fetch(base+"/api/setup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workshop:"Taller",name:"Admin",username:"admin",password:"1234"})});
    const cookie=setup.headers.get("set-cookie").split(";")[0];
    const state=async()=>(await (await fetch(base+"/api/state",{headers:{Cookie:cookie}})).json()).state;
    const post=async(route,data,headers={})=>{const r=await fetch(base+route,{method:"POST",headers:{Cookie:cookie,"Content-Type":"application/json",...headers},body:JSON.stringify(data)});return {status:r.status,body:await r.json()};};
    const action=async(action,data,key=randomUUID(),revision)=>(await post("/api/action",{action,data},{"If-Match":String(revision??(await state()).revision),"Idempotency-Key":key}));
    await action("shift.open",{opening:50000});const before=await state(),key=randomUUID();
    const repeated=await Promise.all([action("expense.create",expense(),key,before.revision),action("expense.create",expense(),key,before.revision)]);
    assert.deepEqual(repeated.map(x=>x.status),[200,200]);
    const once=await state();assert.equal(once.expenses.length,1);assert.equal(once.cashEntries.length,1);
    assert.equal((await action("expense.create",expense({amount:40000}))).status,400);assert.deepEqual(await state(),once);
    const e=once.expenses[0],reverse={type:"expense",id:e.id,reason:"Devuelto",confirmed:true};
    const preview=await post("/api/reversal-preview",reverse);assert.equal(preview.status,200);assert.equal(preview.body.cashDelta,20000);assert.deepEqual(await state(),once);
    assert.equal((await action("operation.reverse",reverse)).status,200);
    const final=await state();assert.ok(final.expenses[0].reversedAt);D.validateState(final);
    const saved=JSON.parse(app.db.prepare("SELECT json FROM state WHERE id=1").get().json);assert.deepEqual(saved,final);
  } finally {await new Promise(r=>app.server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
});
