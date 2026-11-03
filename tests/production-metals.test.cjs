"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const D=require("../domain.cjs"),PM=require("../production-metals.js");
const admin={name:"Admin",role:"admin"};
function fixture(){
  const s=D.initialState();s.settings.rate.oro=100000;s.settings.rate.plata=10000;
  const act=(action,data,actor=admin)=>{const next=structuredClone(s);const result=D.execute(next,action,data,actor);D.validateState(next);Object.keys(s).forEach(key=>delete s[key]);Object.assign(s,next);return result;};
  const client=act("client.save",{name:"Cliente"}),smith=act("smith.save",{name:"Orfebre",bench:"Mesa 1"});
  for(const [metal,purity,weight,account] of [["oro",750,20,"own"],["oro",585,10,"melt"],["plata",925,20,"own"]])act("inventory.adjust",{account,metal,purity,weight,reason:"Saldo inicial"});
  const order=(extra={})=>act("order.create",{clientId:client.id,type:"Reparación",description:"Pieza oro y plata",condition:"Recibida",metal:"oro",purity:750,receivedWeight:2,dueDate:"2026-12-01",labor:0,taxPercent:0,...extra});
  const reverse=(type,id)=>act("operation.reverse",{type,id,reason:"Verificado",confirmed:true});
  const get=id=>s.orders.find(x=>x.id===id);
  const assign=id=>act("order.assign",{id,smithId:smith.id,customerWeight:2,ownWeight:1,ownMetals:[{metal:"plata",purity:925,weight:3,source:"own"},{metal:"oro",purity:585,weight:1,source:"melt"}]});
  return {s,act,order,reverse,get,assign,smith};
}
test("Varios metales: asigna, aporta, liquida por ley, entrega y revierte sin convertir inventario",()=>{
  const f=fixture(),{s,act,reverse,get}=f,o=f.order();f.assign(o.id);
  assert.equal(D.balance(s,"own","oro",750),19000);assert.equal(D.balance(s,"own","plata",925),17000);assert.equal(D.balance(s,"melt","oro",585),9000);
  assert.equal(get(o.id).allocations.length,4);
  reverse("assignment",o.id);assert.equal(get(o.id).status,"received");assert.equal(D.balance(s,"own","plata",925),20000);assert.equal(D.balance(s,"melt","oro",585),10000);
  f.assign(o.id);act("order.addMetal",{id:o.id,metal:"plata",purity:925,weight:0.5,source:"own",reason:"Detalle adicional"});
  assert.equal(get(o.id).allocations.find(x=>x.metal==="plata").mg,3500);
  assert.throws(()=>act("order.return",{id:o.id,pieceWeight:7,scrapWeight:0.5}),/cada metal/);
  act("order.return",{id:o.id,metalReturns:[{metal:"oro",purity:750,pieceWeight:2.94,scrapWeight:0.04},{metal:"plata",purity:925,pieceWeight:3.43,scrapWeight:0.05},{metal:"oro",purity:585,pieceWeight:0.98,scrapWeight:0.01}]});
  const returned=get(o.id);assert.equal(returned.returned.pieceMg,7350);assert.equal(returned.returned.scrapMg,100);assert.equal(returned.returned.lossMg,50);
  for(const group of PM.groups(returned))assert.equal(D.balance(s,"process",group.metal,group.purity),0);
  const rates=PM.cost(returned);s.settings.rate.plata=500000;assert.equal(PM.cost(get(o.id)),rates,"Costo histórico no cambia con tarifas posteriores");
  act("order.quality",{id:o.id,checks:[true,true,true]});act("order.deliver",{id:o.id,acceptance:"Cliente"});
  assert.equal(D.balance(s,"finished","plata",925),0);assert.equal(D.balance(s,"finished","oro",585),0);
  reverse("sale",o.id);assert.equal(get(o.id).status,"ready");assert.equal(D.balance(s,"finished","plata",925),3430);assert.equal(D.balance(s,"finished","oro",585),980);
  act("order.deliver",{id:o.id,acceptance:"Cliente nuevamente"});assert.equal(D.balance(s,"finished","plata",925),0);
  D.validateState(JSON.parse(JSON.stringify(s)));
});
test("Varios metales: rechazos atómicos, duplicados, saldos y merma crítica por metal",()=>{
  const f=fixture(),{s,act,smith,get}=f,o=f.order();
  const before=structuredClone(s);
  for(const extra of [[{metal:"plata",purity:925,weight:21}], [{metal:"oro",purity:925,weight:1}], [{metal:"plata",purity:925,weight:-1}], [{metal:"desconocido",purity:925,weight:1}], [{metal:"plata",purity:925,weight:1,source:"custody"}]]){
    assert.throws(()=>act("order.assign",{id:o.id,smithId:smith.id,customerWeight:2,ownMetals:extra}));assert.deepEqual(s,before);
  }
  act("order.assign",{id:o.id,smithId:smith.id,customerWeight:2,ownMetals:[{metal:"plata",purity:925,weight:1},{metal:"plata",purity:925,weight:2}]});
  assert.equal(get(o.id).allocations.length,2);assert.equal(get(o.id).allocations[1].mg,3000);
  const inputs=[{metal:"oro",purity:750,pieceWeight:2,scrapWeight:0},{metal:"plata",purity:925,pieceWeight:2.8,scrapWeight:0}];
  const stable=structuredClone(s);
  assert.throws(()=>act("order.return",{id:o.id,reason:"Probado",metalReturns:inputs},{name:"Orfebre",role:"produccion"}),/rol/);assert.deepEqual(s,stable);
  assert.throws(()=>act("order.return",{id:o.id,metalReturns:[inputs[0],inputs[0]]}),/duplicado/);
  assert.throws(()=>act("order.return",{id:o.id,metalReturns:[null,null]}));
  assert.throws(()=>act("order.return",{id:o.id,metalReturns:[inputs[0],{...inputs[1],pieceWeight:3.1}]}),/superan/);
});
test("Producción propia con varios metales conserva composición, transferencias parciales y reversiones",()=>{
  const f=fixture(),{s,act,reverse,smith}=f,o=f.order({type:"Producción propia",receivedWeight:0});
  act("order.assign",{id:o.id,smithId:smith.id,ownWeight:2,ownMetals:[{metal:"plata",purity:925,weight:4}]});
  act("order.return",{id:o.id,metalReturns:[{metal:"oro",purity:750,pieceWeight:2,scrapWeight:0},{metal:"plata",purity:925,pieceWeight:4,scrapWeight:0}]});
  act("order.quality",{id:o.id,checks:[true,true,true]});
  const received=act("stock.receive",{id:o.id,quantity:2,cost:100001,price:100000}),stock=()=>s.stock.find(x=>x.id===received.id);
  assert.equal(stock().components.length,2);
  assert.throws(()=>act("stock.transfer",{id:received.id,quantity:1,weight:3,destination:"Joyería"}),/cada metal/);
  const transfer=act("stock.transfer",{id:received.id,quantity:1,weight:3,destination:"Joyería",components:[{metal:"oro",purity:750,weight:1},{metal:"plata",purity:925,weight:2}]});
  assert.equal(D.balance(s,"finished","oro",750),1000);assert.equal(D.balance(s,"finished","plata",925),2000);
  assert.equal(stock().remainingCost,50000);reverse("stockTransfer",transfer.id);
  assert.equal(stock().remainingCost,100001);assert.deepEqual(stock().components.map(x=>x.remainingMg),[2000,4000]);
  const all=act("stock.transfer",{id:received.id,quantity:2,weight:6,destination:"Joyería"});
  assert.deepEqual(stock().components.map(x=>x.remainingMg),[0,0]);
  reverse("stockTransfer",all.id);reverse("stockReceive",received.id);assert.equal(f.get(o.id).status,"ready");
  assert.deepEqual(stock().components.map(x=>x.remainingMg),[0,0]);assert.equal(D.balance(s,"finished","plata",925),4000);
});
