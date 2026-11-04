"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),D=require("../domain.cjs");
const admin={name:"Admin",role:"admin"};
test("Revisión: cancelar sin pieza conserva toda la limalla o la pérdida, sin crear metal",()=>{
 const f=fixture(),o=f.order();f.assign(o.id);
 f.reverse(o.id,{metalReturns:[{metal:"oro",purity:750,pieceWeight:0,scrapWeight:3},{metal:"plata",purity:925,pieceWeight:0,scrapWeight:1}]});
 assert.equal(f.get(o.id).status,"cancelled");assert.equal(f.get(o.id).returned.pieceMg,0);assert.equal(f.get(o.id).returned.scrapMg,4000);assert.equal(D.balance(f.s,"process","oro",750),0);assert.equal(D.balance(f.s,"finished","plata",925),0);
 const lost=f.order();f.assign(lost.id);f.reverse(lost.id,{metalReturns:[{metal:"oro",purity:750,pieceWeight:0,scrapWeight:0},{metal:"plata",purity:925,pieceWeight:0,scrapWeight:0}]});assert.equal(f.get(lost.id).returned.lossMg,4000);
 const open=f.order();f.assign(open.id);assert.throws(()=>f.act("order.return",{id:open.id,pieceWeight:0,scrapWeight:4}),/cada metal/);
 const before=structuredClone(f.s);assert.throws(()=>f.act("order.return",{id:open.id,closingOrder:true,metalReturns:[{metal:"oro",purity:750,pieceWeight:0,scrapWeight:3},{metal:"plata",purity:925,pieceWeight:0,scrapWeight:1}]}),/solo se admite/);assert.deepEqual(f.s,before,"No permite aprobar un retorno sin pieza fuera del cierre completo");
});
test("Revisión: el cierre completo admite el soporte bancario de 200 caracteres del formulario",()=>{
 const f=fixture(),o=f.order();f.act("payment.create",{orderId:o.id,bank:20000,bankRef:"ABONO"});const reference="A".repeat(200);
 f.reverse(o.id,{refundMethod:"bank",reference});assert.equal(f.get(o.id).status,"cancelled");assert.equal(f.s.payments.at(-1).bankRef,reference);
});
function fixture(){
  const s=D.initialState();s.settings.rate.oro=100000;s.settings.rate.plata=10000;
  const act=(action,data)=>{const next=structuredClone(s),result=D.execute(next,action,data,admin);D.validateState(next);Object.keys(s).forEach(key=>delete s[key]);Object.assign(s,next);return result;};
  const c=act("client.save",{name:"Cliente"}),smith=act("smith.save",{name:"Orfebre",bench:"Mesa"});
  act("shift.open",{opening:200000});
  for(const [metal,purity]of[["oro",750],["plata",925]])act("inventory.adjust",{account:"own",metal,purity,weight:20,reason:"Saldo inicial"});
  const order=(extra={})=>act("order.create",{clientId:c.id,type:"Reparación",description:"Pieza",condition:"Recibida",metal:"oro",purity:750,receivedWeight:2,dueDate:"2026-12-01",labor:20000,taxPercent:0,...extra});
  const reverse=(id,extra={})=>act("operation.reverse",{type:"order",id,reason:"Cliente cancela y devuelve materiales",confirmed:true,...extra});
  const get=id=>s.orders.find(x=>x.id===id);
  const assign=id=>act("order.assign",{id,smithId:smith.id,customerWeight:2,ownWeight:1,ownMetals:[{metal:"plata",purity:925,weight:1}],smithFee:5000});
  const returns=[{metal:"oro",purity:750,pieceWeight:2.94,scrapWeight:0.04},{metal:"plata",purity:925,pieceWeight:0.98,scrapWeight:0.01}];
  return {s,act,order,reverse,get,assign,returns,smith};
}
test("Reversión completa: calidad y devolución anterior como T-0001, sin cobrar ni devolver dos veces",()=>{
  const f=fixture(),{s,act,reverse,get}=f,o=f.order();
  act("payment.create",{orderId:o.id,cash:20000});f.assign(o.id);act("order.return",{id:o.id,metalReturns:f.returns});
  act("payment.refund",{orderId:o.id,cash:20000,reason:"Devolución ya realizada"});
  const cash=D.cashExpected(s,s.shifts[0]),paymentCount=s.payments.length,loss=s.ledger.filter(x=>x.to==="merma").reduce((sum,x)=>sum+x.mg,0);
  reverse(o.id);assert.equal(get(o.id).status,"cancelled");assert.equal(s.payments.length,paymentCount);assert.equal(D.cashExpected(s,s.shifts[0]),cash);
  assert.equal(D.balance(s,"custody","oro",750,o.id),0);assert.equal(D.balance(s,"scrap","oro",750,o.id),0);assert.equal(D.balance(s,"finished","plata",925),0);
  assert.equal(D.balance(s,"own","plata",925),19980);assert.equal(s.ledger.filter(x=>x.to==="merma").reduce((sum,x)=>sum+x.mg,0),loss);
  assert.equal(get(o.id).smithFee,5000);assert.ok(get(o.id).returned);assert.equal(D.paid(s,get(o.id)),0);
  const closed=structuredClone(s);assert.throws(()=>reverse(o.id),/ya fue/);assert.deepEqual(s,closed);
});
test("Reversión completa: venta vigente, reintegro bancario y conservación de insumos reales",()=>{
  const f=fixture(),{s,act,reverse,get}=f,o=f.order();f.assign(o.id);
  const material=act("material.save",{name:"Broche",unit:"pieza",quantity:3,unitCost:100,min:0});act("material.use",{orderId:o.id,materialId:material.id,quantity:1});
  act("order.return",{id:o.id,metalReturns:f.returns});act("order.quality",{id:o.id,checks:[true,true,true]});act("payment.create",{orderId:o.id,cash:20000});act("order.deliver",{id:o.id,acceptance:"Cliente"});
  const cash=D.cashExpected(s,s.shifts[0]);
  assert.throws(()=>reverse(o.id,{refundMethod:"bank"}),/soporte/);assert.equal(get(o.id).status,"delivered");
  reverse(o.id,{refundMethod:"bank",reference:"DEV-123"});
  assert.equal(get(o.id).status,"cancelled");assert.equal(get(o.id).invoice,null);assert.equal(D.paid(s,get(o.id)),0);assert.equal(s.payments.at(-1).bank,-20000);assert.equal(D.cashExpected(s,s.shifts[0]),cash);
  assert.equal(s.materials[0].quantity,2);assert.equal(get(o.id).materialUsage[0].reversedAt,undefined);
  assert.ok(s.reversals.some(x=>x.type==="sale"&&x.original.invoice));assert.equal(s.reversals.at(-1).type,"order");
});
test("Reversión completa: producción en mesa exige pesos reales y conserva pérdidas por metal",()=>{
  const f=fixture(),{s,act,reverse,get}=f,o=f.order();f.assign(o.id);act("order.progress",{id:o.id,note:"Trabajo iniciado"});
  const before=structuredClone(s);assert.throws(()=>reverse(o.id),/pesos/);assert.deepEqual(s,before);
  assert.throws(()=>reverse(o.id,{metalReturns:[{metal:"oro",purity:750,pieceWeight:4},{metal:"plata",purity:925,pieceWeight:1}]}),/superan/);assert.deepEqual(s,before);
  reverse(o.id,{metalReturns:f.returns});assert.equal(get(o.id).status,"cancelled");assert.equal(get(o.id).returned.lossMg,30);
  assert.equal(D.balance(s,"process","oro",750),0);assert.equal(D.balance(s,"process","plata",925),0);
  const unpaid=f.order();act("payment.create",{orderId:unpaid.id,cash:10000});assert.throws(()=>reverse(unpaid.id),/cómo devolver/);
  const cash=D.cashExpected(s,s.shifts[0]);reverse(unpaid.id,{refundMethod:"cash"});assert.equal(D.cashExpected(s,s.shifts[0]),cash-10000);
});
test("Reversión completa: producción propia exige regresar traslados antes de cerrar el lote",()=>{
  const f=fixture(),{s,act,reverse,get,smith}=f,o=f.order({type:"Producción propia",receivedWeight:0,labor:0});
  act("order.assign",{id:o.id,smithId:smith.id,ownWeight:2});act("order.return",{id:o.id,pieceWeight:2,scrapWeight:0});act("order.quality",{id:o.id,checks:[true,true,true]});
  const lot=act("stock.receive",{id:o.id,quantity:1,cost:20000,price:30000}),transfer=act("stock.transfer",{id:lot.id,quantity:1,weight:2,destination:"Joyería"});
  const before=structuredClone(s);assert.throws(()=>reverse(o.id),/transferencias/);assert.deepEqual(s,before);
  act("operation.reverse",{type:"stockTransfer",id:transfer.id,reason:"Pieza devuelta",confirmed:true});reverse(o.id);
  assert.equal(get(o.id).status,"cancelled");assert.ok(s.stock[0].reversedAt);assert.equal(s.stock[0].available,0);assert.equal(D.balance(s,"own","oro",750),20000);
});
