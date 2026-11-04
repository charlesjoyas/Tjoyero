"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),D=require("../domain.cjs"),N=require("../numbers.js");
const actor={role:"admin",name:"Admin"};
function fixture(){const s=D.initialState();const act=(action,data,a=actor)=>{const copy=structuredClone(s),result=D.execute(copy,action,data,a);D.validateState(copy);Object.keys(s).forEach(k=>delete s[k]);Object.assign(s,copy);return result;};const supplier=act("supplier.save",{name:"Proveedor oro"});return{s,act,supplier,items:[{categoryId:"gold-18k",weight:2.345,unitPrice:300000},{categoryId:"gold-14k",weight:1.234,unitPrice:200000}]};}
test("Orden de compra: varias categorías ingresan inmediatamente a su ley y valoran gramos recibidos",()=>{
  const f=fixture(),{s,act,supplier,items}=f;
  const p=act("purchase.create",{supplierId:supplier.id,document:"FACT-001",dueDate:"2026-12-01",items});
  assert.equal(p.total,950300);assert.equal(p.mg,3579);assert.equal(p.priceBasis,"gross");assert.equal(p.items[0].total,703500);assert.equal(p.items[1].total,246800);
  assert.equal(D.balance(s,"own","oro",750),2345);assert.equal(D.balance(s,"own","oro",585),1234);
  assert.equal(s.cashEntries.length,0);assert.equal(s.supplierPayments.length,0);assert.equal(s.ledger[0].fineUg,1758750);assert.equal(s.ledger[1].fineUg,721890);
  const before=structuredClone(s);assert.throws(()=>act("purchase.create",{supplierId:supplier.id,document:"FACT-001",dueDate:"2026-12-01",items}),/registrado/);assert.deepEqual(s,before);
  act("category.save",{id:"gold-18k",name:"Categoría modificada",purity:751});act("category.delete",{id:"gold-14k"});
  assert.equal(s.purchases[0].items[0].categoryName,"Oro 18k");assert.equal(s.purchases[0].items[0].purity,750);D.validateState(JSON.parse(JSON.stringify(s)));
  act("operation.reverse",{type:"purchase",id:p.id,reason:"Compra devuelta físicamente",confirmed:true});
  assert.equal(D.balance(s,"own","oro",750),0);assert.equal(D.balance(s,"own","oro",585),0);assert.ok(s.purchases[0].reversedAt);
});
test("Orden de compra: pagos y reversión no duplican inventario y bloquean metal consumido",()=>{
  const f=fixture(),{s,act,supplier,items}=f,p=act("purchase.create",{supplierId:supplier.id,document:"FACT-002",dueDate:"2026-12-01",items});
  act("shift.open",{opening:1000000});const payment=act("supplier.pay",{id:p.id,amount:400000,method:"cash",reference:"REC-001"});
  assert.equal(D.cashExpected(s,s.shifts[0]),600000);assert.equal(D.balance(s,"own","oro",750),2345);
  assert.throws(()=>act("operation.reverse",{type:"purchase",id:p.id,reason:"Devolución",confirmed:true}),/pagos/);
  act("operation.reverse",{type:"supplierPayment",id:payment.id,reason:"Devuelto",confirmed:true});assert.equal(D.cashExpected(s,s.shifts[0]),1000000);
  act("inventory.transfer",{from:"own",to:"melt",metal:"oro",purity:585,weight:1,reason:"Apartado para fundición"});
  const before=structuredClone(s);assert.throws(()=>act("operation.reverse",{type:"purchase",id:p.id,reason:"Devolución",confirmed:true}),/insuficiente/);assert.deepEqual(s,before,"No devuelve la primera categoría si falta la segunda");
});
test("Orden de compra: rechaza categorías inválidas, importes, permisos y detalles corruptos",()=>{
  const f=fixture(),{s,act,supplier,items}=f,before=structuredClone(s),body={supplierId:supplier.id,document:"FACT-003",dueDate:"2026-12-01",items};
  for(const bad of [[],null,[null],[{...items[0],categoryId:"no-existe"}],[{...items[0],unitPrice:0}],[{...items[0],unitPrice:1.5}],[{...items[0],weight:0}],[{...items[0],weight:1.0001}],[{...items[0],weight:1000000,unitPrice:1000000000000}]]){assert.throws(()=>act("purchase.create",{...body,items:bad}));assert.deepEqual(s,before);}
  assert.throws(()=>act("purchase.create",body,{role:"recepcion",name:"Caja"}),/rol/);
  act("category.save",{id:"gold-18k",name:"Oro 18k",purity:750,active:false});assert.throws(()=>act("purchase.create",body),/inactiva/);
  const p=act("purchase.create",{...body,items:[items[1]]});const corrupted=structuredClone(s);corrupted.purchases[0].items[0].total++;assert.throws(()=>D.validateState(corrupted),/importe/);
  assert.equal(N.weightPrice(1,500),1,"Medio peso redondea con precisión exacta");assert.equal(N.weightPrice(1001,1000000),1001000);assert.ok(p.code.startsWith("CP-"));
});
