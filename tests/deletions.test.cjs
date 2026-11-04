"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),D=require("../domain.cjs");
const admin={role:"admin",name:"Admin"};
function fixture(){const s=D.initialState();s.settings.rate.oro=100000;const act=(action,data,actor=admin)=>{const next=structuredClone(s),result=D.execute(next,action,data,actor);D.validateState(next);Object.keys(s).forEach(k=>delete s[k]);Object.assign(s,next);return result;};
const supplier=act("supplier.save",{name:"Proveedor"}),client=act("client.save",{name:"Cliente"}),smith=act("smith.save",{name:"Orfebre",bench:"Mesa"});act("shift.open",{opening:1000000});act("inventory.adjust",{account:"own",metal:"oro",purity:750,weight:10,reason:"Inicial"});
const remove=(type,id,extra={})=>act("operation.delete",{type,id,reason:"Registro a retirar con devolución comprobada",confirmed:true,confirmation:"ELIMINAR",reference:"DEV-001",...extra});
const reverse=(type,id)=>act("operation.reverse",{type,id,reason:"Devolución comprobada",confirmed:true,reference:"DEV-001"});
const purchase=doc=>act("purchase.create",{supplierId:supplier.id,document:doc,metal:"oro",purity:750,weight:2,rate:100000,dueDate:"2026-12-01"});
const order=()=>act("order.create",{clientId:client.id,type:"Reparación",description:"Trabajo",condition:"Recibido",metal:"oro",purity:750,receivedWeight:2,dueDate:"2026-12-01",labor:20000,taxPercent:0});
return{s,act,remove,reverse,purchase,order,smith};}
test("Eliminar compra exige confirmación, compensa inventario y conserva una única evidencia",()=>{
 const f=fixture(),{s,act,remove}=f,p=f.purchase("F-001"),before=structuredClone(s);
 for(const confirmation of[undefined,"","eliminar","BORRAR"]) {assert.throws(()=>remove("purchase",p.id,{confirmation}),/ELIMINAR/);assert.deepEqual(s,before);}
 assert.throws(()=>act("operation.delete",{type:"purchase",id:p.id,confirmed:true,confirmation:"ELIMINAR",reason:"Prueba"},{role:"contador",name:"Contador"}),/rol/);
 remove("purchase",p.id);assert.equal(D.balance(s,"own","oro",750),10000);assert.ok(s.purchases[0].deletedAt);assert.ok(s.purchases[0].reversedAt);assert.equal(s.deletions.length,1);assert.ok(s.reversals[0].deletedAt);
 const closed=structuredClone(s);assert.throws(()=>remove("purchase",p.id),/eliminado/);assert.deepEqual(s,closed);D.validateState(JSON.parse(JSON.stringify(s)));
 const invalid=structuredClone(s);delete invalid.deletions;assert.throws(()=>D.validateState(invalid),/evidencia/);
});
test("Eliminar un registro ya reversado no repite devolución; dependencias y vínculos erróneos bloquean",()=>{
 const f=fixture(),{s,act,remove,reverse}=f,p=f.purchase("F-002");const pay=act("supplier.pay",{id:p.id,amount:10000,method:"cash",reference:"REC"});
 const blocked=structuredClone(s);assert.throws(()=>remove("purchase",p.id),/pagos/);assert.deepEqual(s,blocked);
 remove("supplierPayment",pay.id);const r=reverse("purchase",p.id),ledger=s.ledger.length,cash=s.cashEntries.length;
 remove("purchase",p.id,{reversalId:r.id});assert.equal(s.ledger.length,ledger);assert.equal(s.cashEntries.length,cash);
 const another=f.purchase("F-003");assert.throws(()=>remove("purchase",another.id,{reversalId:r.id}),/corresponde/);
});
test("Eliminar gastos, caja, metal e insumos conserva saldos y no borra los movimientos contables",()=>{
 const f=fixture(),{s,act,remove}=f;
 const expense=act("expense.create",{category:"Otros",concept:"Gasto a eliminar",amount:20000,method:"cash"});remove("expense",expense.id);assert.equal(D.cashExpected(s,s.shifts[0]),1000000);assert.ok(s.expenses[0].deletedAt);assert.ok(s.cashEntries[0].deletedAt);
 act("cash.entry",{type:"expense",amount:10000,note:"Manual"});const cash=s.cashEntries.at(-1);remove("cash",cash.id);assert.equal(D.cashExpected(s,s.shifts[0]),1000000);
 act("inventory.transfer",{from:"own",to:"melt",metal:"oro",purity:750,weight:1,reason:"Apartado"});const movement=s.ledger.at(-1);remove("ledger",movement.id);assert.equal(D.balance(s,"own","oro",750),10000);assert.equal(D.balance(s,"melt","oro",750),0);
 const material=act("material.save",{name:"Broche",unit:"pieza",quantity:2,unitCost:100,min:0});act("material.restock",{id:material.id,quantity:1,unitCost:100,note:"Entrada"});const entry=s.materialMoves.at(-1);remove("material",entry.id);assert.equal(s.materials[0].quantity,2);assert.ok(s.materialMoves.find(x=>x.id===entry.id).deletedAt);
});
test("Eliminar entregas y etapas conserva la orden reabierta; eliminar la orden completa la retira",()=>{
 const f=fixture(),{s,act,remove,reverse,smith}=f,o=f.order();act("order.assign",{id:o.id,smithId:smith.id,customerWeight:2});
 remove("assignment",o.id);assert.equal(s.orders[0].status,"received");assert.equal(s.orders[0].deletedAt,undefined);
 act("order.assign",{id:o.id,smithId:smith.id,customerWeight:2});act("order.return",{id:o.id,pieceWeight:2,scrapWeight:0});act("order.quality",{id:o.id,checks:[true,true,true]});
 const quality=reverse("quality",o.id);act("order.quality",{id:o.id,checks:[true,true,true]});remove("quality",o.id,{reversalId:quality.id});assert.equal(s.orders[0].status,"ready","Borrar una aprobación antigua no revierte la nueva");
 act("payment.create",{orderId:o.id,cash:20000});act("order.deliver",{id:o.id,acceptance:"Cliente"});remove("sale",o.id);assert.equal(s.orders[0].status,"ready");assert.equal(s.orders[0].deletedAt,undefined);
 act("order.deliver",{id:o.id,acceptance:"Nueva entrega"});remove("order",o.id,{refundMethod:"cash"});assert.equal(s.orders[0].status,"cancelled");assert.ok(s.orders[0].deletedAt);assert.equal(D.paid(s,s.orders[0]),0);assert.ok(s.reversals.filter(x=>x.targetId===o.id).every(x=>x.deletedAt));
});
