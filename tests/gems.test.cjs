"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),D=require("../domain.cjs");
const admin={name:"Admin",role:"admin"};
function fixture(){
 const s=D.initialState();
 const act=(action,b,a=admin)=>{const next=structuredClone(s),result=D.execute(next,action,b,a);D.validateState(next);Object.keys(s).forEach(k=>delete s[k]);Object.assign(s,next);return result;};
 const client=act("client.save",{name:"Cliente"}),smith=act("smith.save",{name:"Orfebre",bench:"Mesa"});act("shift.open",{opening:1000000});
 act("inventory.adjust",{account:"own",metal:"oro",purity:750,weight:100,reason:"Saldo inicial"});
 const order=(b={})=>act("order.create",{clientId:client.id,type:"Reparación",description:"Anillo con gema",condition:"Recibido",metal:"oro",purity:750,receivedWeight:2,dueDate:"2026-12-01",labor:10000,taxPercent:19,...b});
 const lot=(b={})=>act("gem.lot",{name:"Esmeralda",quantity:3,carats:1.2,cost:100001,unitPrice:60000,...b});
 const own=(o,l,b={})=>act("gem.add",{orderId:o.id,owner:"taller",stockId:l.id,quantity:1,carats:.4,price:60000,...b});
 const get=id=>s.orders.find(x=>x.id===id);
 const assign=o=>act("order.assign",{id:o.id,smithId:smith.id,customerWeight:o.type==="Producción propia"?0:2,ownWeight:o.type==="Producción propia"?2:0});
 const back=o=>act("order.return",{id:o.id,pieceWeight:2,scrapWeight:0});
 const customer=(o,b={})=>act("gem.add",{orderId:o.id,owner:"cliente",name:"Rubí del cliente",quantity:1,carats:1,condition:"Sin fisuras visibles",includedInPiece:true,mounted:true,...b});
 return {s,act,order,lot,own,get,assign,back,customer,smith};
}
test("Gemas: custodia separada del patrimonio; peso bruto o estimado nunca se cuenta como oro",()=>{
 const f=fixture(),o=f.order({hasStones:true,grossWeight:2.2,receivedWeight:1.8,weightStatus:"estimated"});
 assert.equal(o.receivedMg,0);assert.equal(D.balance(f.s,"custody","oro",750,o.id),0);
 f.customer(o);assert.equal(f.s.gemstoneLots,undefined);assert.equal(f.get(o.id).materialPrice,0);
 assert.throws(()=>f.assign(o),/confirma el peso neto/);
 f.act("gem.weight",{orderId:o.id,grossWeight:2.2,netWeight:2,weightStatus:"confirmed",reason:"Piedra retirada, metal pesado por separado"});
 assert.equal(D.balance(f.s,"custody","oro",750,o.id),2000);f.assign(f.get(o.id));f.back(o);f.act("order.quality",{id:o.id,checks:[true,true,true]});
 assert.equal(D.balance(f.s,"finished","oro",750),0);assert.equal(f.get(o.id).stones[0].cost,0);
});
test("Gemas: validación de bruto, neto, quilates, registro y permisos",()=>{
 const f=fixture();assert.throws(()=>f.order({hasStones:true,grossWeight:1,weightStatus:"confirmed"}),/no puede superar/);
 const o=f.order();assert.throws(()=>f.customer(o),/peso bruto/);
 f.act("gem.weight",{orderId:o.id,grossWeight:2.1,netWeight:2,weightStatus:"confirmed",reason:"Pesaje verificado"});
 assert.throws(()=>f.customer(o),/supera el peso bruto/);
 f.customer(o,{carats:"",includedInPiece:false,mounted:false});assert.equal(f.get(o.id).stones[0].caratMilli,null);
 assert.throws(()=>f.lot({quantity:2,individual:true}),/individual/);assert.throws(()=>f.lot({carats:0.0001}),/fuera de rango|decimales/);
 assert.throws(()=>f.act("gem.lot",{name:"Diamante",quantity:1,carats:1,cost:0,unitPrice:0},{name:"Recepción",role:"recepcion"}),/permiso|permite|autorizado/i);
 assert.throws(()=>f.lot({photo:"data:image/svg+xml;base64,aaa"}),/Fotografía/);
});
test("Gemas: salida parcial y devolución física conservan unidades, quilates, costos y precio una sola vez",()=>{
 const f=fixture(),o=f.order(),l=f.lot(),x=f.own(o,l);
 assert.equal(f.s.gemstoneLots[0].available,2);assert.equal(f.s.gemstoneLots[0].remainingCaratMilli,800);assert.equal(x.cost,33334);
 assert.equal(f.get(o.id).materialPrice,60000);assert.equal(f.get(o.id).tax,13300);
 const second=f.own(o,l,{quantity:2,carats:.8,price:120000});assert.equal(second.cost,66667);assert.equal(f.s.gemstoneLots[0].remainingCost,0);
 assert.throws(()=>f.own(o,l),/suficientes/);
 assert.throws(()=>f.act("gem.return",{orderId:o.id,id:x.id,reason:"Devuelta"}),/Confirma/);
 f.act("gem.return",{orderId:o.id,id:x.id,reason:"Contada físicamente en bodega",confirmed:true});
 assert.equal(f.get(o.id).materialPrice,120000);assert.equal(f.s.gemstoneLots[0].available,1);assert.equal(f.s.gemstoneLots[0].remainingCost,33334);
 assert.throws(()=>f.act("gem.return",{orderId:o.id,id:x.id,reason:"Reintento",confirmed:true}),/no está disponible/);
 f.act("operation.reverse",{type:"order",id:o.id,reason:"Cliente canceló, todas las piedras recuperadas",confirmed:true});
 assert.equal(f.get(o.id).materialPrice,0);assert.equal(f.s.gemstoneLots[0].remainingCost,100001);assert.equal(f.s.gemstoneLots[0].available,3);
});
test("Gemas: montaje, calidad, entrega, reversión y cierre completo con reembolso",()=>{
 const f=fixture(),o=f.order(),l=f.lot(),x=f.own(o,l);f.assign(o);f.back(o);
 assert.throws(()=>f.act("order.quality",{id:o.id,checks:[true,true,true]}),/piedras pendientes/);
 f.act("gem.mount",{orderId:o.id,id:x.id,reason:"Engaste y cantidad verificados"});f.act("order.quality",{id:o.id,checks:[true,true,true]});
 const amount=D.total(f.get(o.id));f.act("payment.create",{orderId:o.id,cash:amount});f.act("order.deliver",{id:o.id,acceptance:"Cliente"});
 assert.equal(f.get(o.id).stones[0].status,"delivered");assert.equal(f.s.gemstoneLots[0].available,2);
 f.act("operation.reverse",{type:"sale",id:o.id,reason:"Pieza devuelta íntegra",confirmed:true});assert.equal(f.get(o.id).stones[0].status,"mounted");
 assert.equal(f.s.gemstoneLots[0].available,2,"Devolver la pieza no desmonta ni restituye automáticamente sus piedras");
 f.act("operation.reverse",{type:"order",id:o.id,reason:"Piedra desmontada y recuperada físicamente",confirmed:true,refundMethod:"cash"});
 assert.equal(f.get(o.id).status,"cancelled");assert.equal(f.get(o.id).stones[0].status,"returned");assert.equal(f.s.gemstoneLots[0].available,3);assert.equal(D.paid(f.s,f.get(o.id)),0);
});
test("Gemas: devolución o pérdida respeta anticipos, conserva el costo perdido y bloquea cambios tras calidad",()=>{
 const f=fixture(),o=f.order(),l=f.lot(),x=f.own(o,l);f.act("payment.create",{orderId:o.id,cash:D.total(f.get(o.id))});
 assert.throws(()=>f.act("gem.loss",{orderId:o.id,id:x.id,confirmed:true,reason:"Pérdida documentada"}),/exceso de anticipo/);
 f.act("payment.refund",{orderId:o.id,cash:71400,reason:"Se retira piedra del presupuesto"});
 f.act("gem.loss",{orderId:o.id,id:x.id,confirmed:true,reason:"Pérdida física documentada por administrador"});
 assert.equal(f.get(o.id).materialPrice,0);assert.equal(f.s.gemstoneLots[0].available,2);assert.equal(f.get(o.id).stones[0].cost,33334);
 f.assign(o);f.back(o);f.act("order.quality",{id:o.id,checks:[true,true,true]});assert.throws(()=>f.act("gem.return",{orderId:o.id,id:x.id,confirmed:true,reason:"Apareció"}),/calidad/);
});
test("Gemas: producción propia individual, transferencia y devolución conservan la piedra dentro de la pieza",()=>{
 const f=fixture(),o=f.order({type:"Producción propia",receivedWeight:0,labor:0,taxPercent:0}),l=f.lot({quantity:1,individual:true,carats:1.2}),x=f.own(o,l,{carats:1.2,price:0});
 f.assign(o);f.act("gem.mount",{orderId:o.id,id:x.id,reason:"Montada"});f.back(o);f.act("order.quality",{id:o.id,checks:[true,true,true]});
 assert.throws(()=>f.act("stock.receive",{id:o.id,quantity:2,cost:100001,price:200000}),/individualmente/);
 const stock=f.act("stock.receive",{id:o.id,quantity:1,cost:100001,price:200000}),t=f.act("stock.transfer",{id:stock.id,quantity:1,weight:2,destination:"Joyería"});
 assert.equal(f.get(o.id).stones[0].status,"delivered");assert.throws(()=>f.act("operation.reverse",{type:"order",id:o.id,confirmed:true,reason:"Cancelada"}),/transferencias/);
 f.act("operation.reverse",{type:"stockTransfer",id:t.id,confirmed:true,reason:"Pieza recibida íntegra"});assert.equal(f.get(o.id).stones[0].status,"mounted");
 f.act("operation.reverse",{type:"order",id:o.id,confirmed:true,reason:"Piedra recuperada y devuelta a bodega"});assert.equal(f.s.gemstoneLots[0].available,1);
});
test("Gemas: restauración rechaza saldos, precios e historiales inconsistentes y acepta copias anteriores",()=>{
 const f=fixture();D.validateState(f.s);const o=f.order(),l=f.lot();f.own(o,l);
 for(const corrupt of [s=>s.gemstoneLots[0].available++,s=>s.gemstoneLots[0].remainingCost++,s=>s.orders[0].stones[0].events[0].to="returned",s=>s.orders[0].materialPrice=0,s=>s.orders[0].stones.push(structuredClone(s.orders[0].stones[0]))]){const bad=structuredClone(f.s);corrupt(bad);assert.throws(()=>D.validateState(bad));}
 const copy=JSON.parse(JSON.stringify(f.s));D.validateState(copy);assert.deepEqual(copy,f.s);
});
test("Gemas: desmontaje, piedras sueltas y pérdida del cliente requieren resolución y constancia",()=>{
 const f=fixture(),o=f.order({hasStones:true,grossWeight:2.2,weightStatus:"confirmed"}),x=f.customer(o);
 f.act("gem.unmount",{orderId:o.id,id:x.id,reason:"Retirada de la pieza para reparar engaste"});f.assign(o);f.back(o);
 assert.throws(()=>f.act("order.quality",{id:o.id,checks:[true,true,true]}),/pendientes/);
 f.act("gem.loss",{orderId:o.id,id:x.id,confirmed:true,reason:"Incidente documentado y comunicado"});
 assert.throws(()=>f.act("order.quality",{id:o.id,checks:[true,true,true]}),/cliente fue informado/);
 f.act("order.quality",{id:o.id,checks:[true,true,true],stoneIncidentAcknowledged:true});assert.equal(f.get(o.id).quality.stoneIncidentAcknowledged,true);
 const bad=structuredClone(f.s);delete bad.orders[0].quality.stoneIncidentAcknowledged;assert.throws(()=>D.validateState(bad),/incidente/);
});
test("Gemas: entrada solo se reversa con todas sus piedras recuperadas; eliminar no compensa dos veces",()=>{
 const f=fixture(),o=f.order(),lot=f.lot(),x=f.own(o,lot);
 const payload={type:"gemLot",id:lot.id,reason:"Lote completo devuelto al proveedor",confirmed:true};
 assert.throws(()=>f.act("operation.reverse",payload),/Recupera físicamente/);
 f.act("gem.return",{orderId:o.id,id:x.id,reason:"Recibida físicamente en bodega",confirmed:true});
 const r=f.act("operation.reverse",payload);assert.equal(f.s.gemstoneLots[0].available,0);assert.ok(f.s.gemstoneLots[0].reversedAt);
 f.act("operation.delete",{...payload,reversalId:r.id,confirmation:"ELIMINAR"});assert.equal(f.s.gemstoneLots[0].available,0);assert.equal(f.s.reversals.length,1);
 assert.throws(()=>f.own(o,lot),/suficientes/);
});
test("Gemas: cuarenta salidas, costos impares y recuperaciones mantienen conservación exacta",()=>{
 const f=fixture(),lot=f.lot({quantity:40,carats:4.017,cost:1000000000000}),ids=[];
 for(let i=0;i<40;i++){const o=f.order(),x=f.own(o,lot,{carats:i===39?.117:.1,price:1});ids.push([o.id,x.id]);}
 assert.equal(f.s.gemstoneLots[0].remainingCost,0);assert.equal(f.s.orders.reduce((sum,o)=>sum+o.stones[0].cost,0),1000000000000);
 for(const [orderId,id]of ids.reverse())f.act("gem.return",{orderId,id,confirmed:true,reason:"Contada y pesada al recuperar"});
 assert.equal(f.s.gemstoneLots[0].available,40);assert.equal(f.s.gemstoneLots[0].remainingCaratMilli,4017);assert.equal(f.s.gemstoneLots[0].remainingCost,1000000000000);
});
