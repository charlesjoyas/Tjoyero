"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const D = require("../domain.cjs");
const admin = {name:"Admin",role:"admin"};
function fixture() {
  const s = D.initialState();
  const act = (action, data, actor=admin) => {
    const next = structuredClone(s), result = D.execute(next, action, data, actor);
    D.validateState(next);
    Object.assign(s, next);
    return result;
  };
  const client = act("client.save", {name:"Cliente con oro"});
  act("client.save", {id:client.id,name:client.name,custody:{weight:10,purity:750,note:"Entrega inicial"}});
  act("client.save", {id:client.id,name:client.name,custody:{weight:3,purity:585,note:"Otra ley"}});
  const smith = act("smith.save", {name:"Orfebre",bench:"Mesa 1"});
  const order = (extra={}) => act("order.create", {clientId:client.id,type:"Fabricación",description:"Anillo",condition:"Oro de la custodia previa",metal:"oro",purity:750,receivedWeight:7,dueDate:"2026-12-01",labor:0,taxPercent:0,useClientCustody:true,...extra});
  const available = (purity=750) => D.balance(s,"custody","oro",purity,"cliente:"+client.id);
  const reverse = (type,id,extra={}) => act("operation.reverse", {type,id,reason:"Devolución comprobada",confirmed:true,...extra});
  return {s,act,client,smith,order,available,reverse};
}
test("Custodia previa: reserva gramos sin duplicar oro, cobrarlo ni afectar bodega/caja; anular los libera", () => {
  const f = fixture(), before = structuredClone(f.s);
  const o = f.order();
  assert.equal(f.available(),3000);
  assert.equal(f.available(585),3000);
  assert.equal(D.balance(f.s,"custody","oro",750,o.id),7000);
  assert.equal(f.s.ledger.filter(x=>x.from==="cliente").length,2);
  assert.equal(D.balances(f.s).filter(x=>x.metal==="oro").reduce((sum,x)=>sum+x.mg,0),13000);
  assert.equal(D.total(o),0);
  assert.deepEqual(f.s.cashEntries,before.cashEntries);
  assert.equal(D.balance(f.s,"own","oro",750),0);
  D.validateState(structuredClone(f.s),{backup:true});
  f.act("order.cancel",{id:o.id,reason:"No se realizará"});
  assert.equal(f.available(),10000);
  assert.equal(D.balance(f.s,"custody","oro",750,o.id),0);
  assert.match(f.s.orders[0].history.at(-1).text,/oro liberado a la custodia disponible/);
  assert.match(f.s.reversals.at(-1).summary,/oro liberado a la custodia disponible/);
});

test("Custodia previa: varias reservas fraccionarias y otros metales propios mantienen separados los saldos", () => {
  const f=fixture(),first=f.order({receivedWeight:7.999}),second=f.order({receivedWeight:2.001});
  assert.equal(f.available(),0);
  const before=structuredClone(f.s);
  assert.throws(()=>f.order({receivedWeight:.001}),/Existencia insuficiente/);
  assert.deepEqual(f.s,before);
  f.act("inventory.adjust",{account:"own",metal:"oro",purity:585,weight:1,reason:"Metal del taller"});
  f.act("inventory.adjust",{account:"own",metal:"plata",purity:925,weight:2,reason:"Plata del taller"});
  f.act("order.assign",{id:first.id,smithId:f.smith.id,customerWeight:7.999,ownWeight:.5,ownPurity:585,ownMetals:[{metal:"plata",purity:925,weight:1,source:"own"}]});
  f.reverse("order",first.id,{metalReturns:[{metal:"oro",purity:750,pieceWeight:7.9,scrapWeight:.05},{metal:"oro",purity:585,pieceWeight:.49,scrapWeight:.005},{metal:"plata",purity:925,pieceWeight:.98,scrapWeight:.01}]});
  assert.equal(f.available(),7950);
  assert.equal(D.balance(f.s,"own","oro",585),990);
  assert.equal(D.balance(f.s,"scrap","oro",585),5);
  assert.equal(D.balance(f.s,"own","plata",925),1980);
  assert.equal(D.balance(f.s,"scrap","plata",925),10);
  assert.equal(D.balance(f.s,"custody","oro",750,second.id),2001);
  f.act("order.cancel",{id:second.id,reason:"Liberar segunda reserva"});
  assert.equal(f.available(),9951);
  assert.equal(f.available(585),3000,"El oro del cliente de otra ley no se mezcla con la bodega");
  D.validateState(structuredClone(f.s),{backup:true});
});
test("Custodia previa: cliente, ley, gramos y joya recibida se validan sin descontar en un fallo", () => {
  const f=fixture(), other=f.act("client.save",{name:"Otro cliente"}),before=structuredClone(f.s);
  for(const extra of [{clientId:other.id},{purity:999},{receivedWeight:10.001},{receivedWeight:0},{metal:"plata"},{type:"Producción propia",receivedWeight:0},{hasStones:true,grossWeight:8,weightStatus:"confirmed"}]) {
    assert.throws(()=>f.order(extra));
    assert.deepEqual(f.s,before);
  }
  const o=f.order();
  const reserved=structuredClone(f.s);
  assert.throws(()=>f.act("gem.weight",{orderId:o.id,grossWeight:9,netWeight:9,weightStatus:"confirmed",reason:"Cambio"}),/custodia/);
  assert.deepEqual(f.s,reserved);
  const fresh=f.order({useClientCustody:false,receivedWeight:1});
  assert.equal(fresh.custodyFromClient,undefined);
  assert.equal(f.available(),3000);
  assert.equal(D.balance(f.s,"custody","oro",750,fresh.id),1000);
});
test("Custodia previa: producción parcial, entrega y reversión recuperan solo los gramos reales", () => {
  const f=fixture(),o=f.order();
  f.act("order.assign",{id:o.id,smithId:f.smith.id,customerWeight:5});
  f.reverse("assignment",o.id);
  assert.equal(f.available(),3000);
  assert.equal(D.balance(f.s,"custody","oro",750,o.id),7000);
  f.act("order.assign",{id:o.id,smithId:f.smith.id,customerWeight:5});
  f.act("order.return",{id:o.id,pieceWeight:4.9,scrapWeight:0.05});
  f.act("order.quality",{id:o.id,checks:[true,true,true]});
  f.act("order.deliver",{id:o.id,acceptance:"Cliente"});
  assert.equal(f.available(),3000);
  assert.equal(D.balance(f.s,"custody","oro",750,o.id),0);
  f.reverse("sale",o.id);
  f.reverse("order",o.id);
  assert.equal(f.available(),9950,"La merma no regresa a la custodia");
  assert.equal(D.balance(f.s,"custody","oro",750,o.id),0);
  assert.equal(D.balance(f.s,"scrap","oro",750,o.id),0);
  D.validateState(structuredClone(f.s),{backup:true});
});
test("Custodia previa: eliminar una orden o cerrar en producción libera el saldo una sola vez", () => {
  const f=fixture(),o=f.order();
  f.act("order.assign",{id:o.id,smithId:f.smith.id,customerWeight:7});
  f.reverse("order",o.id,{metalReturns:[{metal:"oro",purity:750,pieceWeight:6.9,scrapWeight:0.05}]});
  assert.equal(f.available(),9950);
  f.act("operation.delete",{type:"order",id:o.id,reason:"Retirar orden compensada",confirmed:true,confirmation:"ELIMINAR"});
  assert.equal(f.available(),9950);
  assert.ok(f.s.orders[0].deletedAt);
  assert.throws(()=>f.reverse("order",o.id));
});
test("Custodia previa: rechaza respaldos con traslados incompletos, ajenos o pesos alterados", () => {
  const f=fixture();f.order();
  const index=f.s.ledger.findIndex(x=>x.custodyTransferId);
  for(const corrupt of [s=>s.ledger.splice(index,1),s=>{s.ledger[index+1].mg++;s.ledger[index+1].fineUg+=750;},s=>{s.orders[0].receivedMg++;},s=>{s.orders[0].custodyFromClient=false;},s=>{s.ledger[index].from="own";},s=>{s.ledger[index+1].custodyOrderId="otra";}]) {
    const bad=structuredClone(f.s);corrupt(bad);
    assert.throws(()=>D.validateState(bad,{backup:true}));
  }
});
