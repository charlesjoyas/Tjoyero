"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),D=require("../domain.cjs"),PM=require("../production-metals.js"),N=require("../numbers.js");
const actor={role:"admin",name:"Admin"},key=(metal,purity,owner)=>JSON.stringify([metal,purity,owner]);
function reconcile(s,initial){
 const expected=new Map(initial),positions=new Map();
 const add=(map,metal,purity,owner,mg,account)=>{if(!mg)return;const id=account?JSON.stringify([account,metal,purity,owner]):key(metal,purity,owner);map.set(id,(map.get(id)||0)+mg);};
 for(const p of s.purchases.filter(x=>!x.reversedAt))for(const item of p.items||[{metal:p.metal,purity:p.purity,mg:p.mg}])add(expected,item.metal,item.purity,"taller",item.mg);
 for(const p of s.payments.filter(x=>!x.voidedAt))add(expected,p.metal,p.purity,"taller",p.goldMg);
 for(const melt of s.melts){add(expected,melt.metal,melt.inputPurity,"taller",-melt.inputMg);add(expected,melt.metal,melt.outputPurity,"taller",melt.outputMg);}
 for(const o of s.orders){
  add(expected,o.metal,o.purity,o.id,o.receivedMg);
  const assigned=o.allocations.filter(x=>x.owner===o.id).reduce((sum,x)=>sum+x.mg,0),unassigned=o.receivedMg-assigned;
  if(["received","in_progress"].includes(o.status))add(positions,o.metal,o.purity,o.id,unassigned,"custody");
  if(o.status==="in_progress")for(const allocation of o.allocations){const item=PM.identity(o,allocation);add(positions,item.metal,item.purity,allocation.owner,allocation.mg,"process");}
  let customerReturned=unassigned;
  o.allocations.forEach((allocation,index)=>{
   const item=PM.identity(o,allocation);if(!o.returned)return;
   const piece=o.returned.pieces[index],scrap=o.returned.scraps[index],lost=allocation.mg-piece-scrap;
   add(expected,item.metal,item.purity,allocation.owner,-lost);
   if(allocation.owner===o.id)customerReturned+=piece+scrap;
   if(o.status==="delivered"&&o.type!=="Producción propia"&&allocation.owner==="taller")add(expected,item.metal,item.purity,"taller",-piece);
   if(["quality","ready"].includes(o.status)){
    add(positions,item.metal,item.purity,allocation.owner,piece,allocation.owner==="taller"?"finished":"custody");
    if(allocation.owner!=="taller")add(positions,item.metal,item.purity,allocation.owner,scrap,"scrap");
   }
  });
  if(["quality","ready"].includes(o.status))add(positions,o.metal,o.purity,o.id,unassigned,"custody");
  if(o.status==="cancelled"||(o.status==="delivered"&&o.type!=="Producción propia"))add(expected,o.metal,o.purity,o.id,-customerReturned);
 }
 for(const stock of s.stock){
  if(!stock.reversedAt)for(const item of PM.components(stock))add(positions,item.metal,item.purity,"taller",item.remainingMg,"finished");
  for(const transfer of stock.transfers.filter(x=>!x.reversedAt))for(const item of transfer.components||[{metal:stock.metal,purity:stock.purity,mg:transfer.mg}])add(expected,item.metal,item.purity,"taller",-item.mg);
 }
 const actual=new Map(),actualPositions=new Map();
 for(const row of D.balances(s)){
  add(actual,row.metal,row.purity,row.owner,row.mg);
  if(["process","custody","finished"].includes(row.account)||(row.account==="scrap"&&row.owner!=="taller"))add(actualPositions,row.metal,row.purity,row.owner,row.mg,row.account);
 }
 const clean=map=>[...map].filter(([,value])=>value!==0).sort(([a],[b])=>a.localeCompare(b));
 assert.deepEqual(clean(actual),clean(expected),"Los metales físicos concilian con compras, clientes, entregas, mermas y traslados externos");
 assert.deepEqual(clean(actualPositions),clean(positions),"Cada mesa, custodia y lote coincide con los trabajos activos");
 for(const material of s.materials){const moved=s.materialMoves.filter(x=>x.materialId===material.id).reduce((sum,x)=>sum+BigInt(Math.round(x.quantity*1e6)),0n);assert.equal(moved,BigInt(Math.round(material.quantity*1e6)));}
 const valuation=N.metalValuation(D.balances(s),s.settings.rate);assert.equal(valuation.total,valuation.own+valuation.clients);assert.equal(valuation.rows.reduce((sum,x)=>sum+(x.estimatedCop??0n),0n),valuation.total);
}
test("Revisión integral reciente: diez jornadas de compras por categoría, varios metales, cierres, eliminaciones y valoración",()=>{
 const s=D.initialState();s.settings.rate={oro:100000,plata:10000,platino:100000};const raw=(action,data)=>D.execute(s,action,data,actor);
 const client=raw("client.save",{name:"Cliente de prueba"}),smith=raw("smith.save",{name:"Orfebre",bench:"Mesa"}),supplier=raw("supplier.save",{name:"Proveedor"});
 const material=raw("material.save",{name:"Insumo",unit:"ml",quantity:1000,unitCost:50,min:1}),initial=new Map();
 for(const [metal,purity]of[["oro",750],["oro",585],["plata",925]]){raw("inventory.adjust",{account:"own",metal,purity,weight:30,reason:"Base pesada"});initial.set(key(metal,purity,"taller"),30000);}
 let operations=0,cash=0,carry=1000000;const closed=new Map();
 const run=(action,data,delta=0)=>{const next=structuredClone(s),result=D.execute(next,action,data,actor);D.validateState(next);Object.keys(s).forEach(k=>delete s[k]);Object.assign(s,next);operations++;
  cash=action==="shift.open"?data.opening:cash+delta;reconcile(s,initial);const shift=s.shifts.find(x=>!x.closedAt);if(shift)assert.equal(D.cashExpected(s,shift),cash,"Efectivo independiente");
  for(const [id,snapshot]of closed)assert.equal(JSON.stringify(s.shifts.find(x=>x.id===id)),snapshot,"Los cierres anteriores no cambian");return result;};
 const reverse=(type,id,extra={},delta=0)=>run("operation.reverse",{type,id,reason:"Corrección física verificada",reference:"DEV",confirmed:true,...extra},delta);
 const remove=(type,id,extra={},delta=0)=>run("operation.delete",{type,id,reason:"Retirar operación compensada",reference:"DEV",confirmed:true,confirmation:"ELIMINAR",...extra},delta);
 const make=(own=false)=>run("order.create",{clientId:client.id,type:own?"Producción propia":"Reparación",description:"Pieza de varios metales",condition:"Verificado",metal:"oro",purity:750,receivedWeight:own?0:1.001,dueDate:"2026-12-01",labor:own?0:25000,taxPercent:0});
 for(let day=1;day<=10;day++){
  const shift=run("shift.open",{opening:carry});
  const purchase=run("purchase.create",{supplierId:supplier.id,document:"OC-"+day,dueDate:"2026-12-01",items:[{categoryId:"gold-18k",weight:3.125,unitPrice:300000},{categoryId:"gold-14k",weight:1.375,unitPrice:200000}]});
  run("supplier.pay",{id:purchase.id,amount:40000,method:"cash",reference:"REC"},-40000);
  const silver=run("purchase.create",{supplierId:supplier.id,document:"PL-"+day,metal:"plata",purity:925,weight:2,rate:10000,dueDate:"2026-12-01"});run("supplier.pay",{id:silver.id,amount:18500,method:"bank",reference:"BANCO"});
  const expense=run("expense.create",{category:"Otros",concept:"Gasto diario",amount:500,method:"cash"},-500);
  if(day%2) {const r=reverse("expense",expense.id,{},500);remove("expense",expense.id,{reversalId:r.id});}else remove("expense",expense.id,{},500);
  run("cash.entry",{type:"income",amount:1500,note:"Ingreso"},1500);run("cash.entry",{type:"expense",amount:200,note:"Transporte"},-200);
  run("expense.classify",{cashEntryId:s.cashEntries.at(-1).id,category:"Transporte",concept:"Transporte",amount:200,method:"cash"});
  const extra=run("purchase.create",{supplierId:supplier.id,document:"ERR-"+day,dueDate:"2026-12-01",items:[{categoryId:"gold-18k",weight:0.05,unitPrice:100000}]});remove("purchase",extra.id);
  for(let j=0;j<4;j++){
   const o=make();run("order.assign",{id:o.id,smithId:smith.id,customerWeight:1.001,ownWeight:0.299,ownMetals:[{metal:"plata",purity:925,weight:0.5},{metal:"oro",purity:585,weight:0.2}],smithFee:1000});
   const used=run("material.use",{orderId:o.id,materialId:material.id,quantity:0.57});if(j===0){remove("material",used.id);run("material.use",{orderId:o.id,materialId:material.id,quantity:0.57});}
   run("order.return",{id:o.id,reason:"Retorno pesado",metalReturns:[{metal:"oro",purity:750,pieceWeight:1.274,scrapWeight:0.013},{metal:"plata",purity:925,pieceWeight:0.49,scrapWeight:0.005},{metal:"oro",purity:585,pieceWeight:0.196,scrapWeight:0.002}]});
   run("order.quality",{id:o.id,checks:[true,true,true]});run("payment.create",{orderId:o.id,cash:30000},25000);run("order.deliver",{id:o.id,acceptance:"Cliente"});
   if(j===0){reverse("sale",o.id);run("order.deliver",{id:o.id,acceptance:"Cliente nuevamente"});}
   if(j===1)remove("order",o.id,{refundMethod:"cash"},-25000);
   if(j===2){reverse("sale",o.id);run("payment.refund",{orderId:o.id,bank:25000,bankRef:"DEV",reason:"Ya devuelto"});reverse("quality",o.id);remove("order",o.id);}
  }
  const own=make(true);run("order.assign",{id:own.id,smithId:smith.id,ownWeight:0.6,ownMetals:[{metal:"plata",purity:925,weight:0.4}]});run("order.return",{id:own.id,metalReturns:[{metal:"oro",purity:750,pieceWeight:0.588,scrapWeight:0.006},{metal:"plata",purity:925,pieceWeight:0.392,scrapWeight:0.004}]});run("order.quality",{id:own.id,checks:[true,true,true]});
  const lot=run("stock.receive",{id:own.id,quantity:2,cost:100001,price:150000}),transfer=run("stock.transfer",{id:lot.id,quantity:1,weight:0.49,destination:"Joyería",components:[{metal:"oro",purity:750,weight:0.294},{metal:"plata",purity:925,weight:0.196}]});
  if(day%2===0){remove("stockTransfer",transfer.id);run("stock.transfer",{id:lot.id,quantity:2,weight:0.98,destination:"Joyería"});}
  if(day%3===0){const aborted=make();run("order.assign",{id:aborted.id,smithId:smith.id,customerWeight:1.001,ownWeight:0.299});remove("order",aborted.id,{metalReturns:[{metal:"oro",purity:750,pieceWeight:0,scrapWeight:day%2?1.3:0}]});}
  run("melt.create",{metal:"oro",source:"own",inputPurity:750,inputWeight:1,alloyWeight:0.3,outputPurity:585,outputWeight:1.28,notes:"Ensayo verificado"});
  const settlement=run("smith.settle",{smithId:smith.id,method:"bank",reference:"BANCO"});if(day===5){remove("settlement",settlement.id);run("smith.settle",{smithId:smith.id,method:"bank",reference:"REEMPLAZO"});}
  run("shift.close",{counted:cash,goldCounts:[],receiver:"Admin",reason:"Conteo conciliado"});assert.equal(s.shifts.at(-1).expected,cash);closed.set(shift.id,JSON.stringify(s.shifts.at(-1)));carry=cash;
 }
 console.log("AUDITORÍA MÓDULOS RECIENTES: "+JSON.stringify({days:10,operations,orders:s.orders.length,purchases:s.purchases.length,deletions:s.deletions.length,reversals:s.reversals.length,cash:carry,closedShifts:closed.size}));
});
