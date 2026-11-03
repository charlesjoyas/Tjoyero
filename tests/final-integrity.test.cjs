"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),D=require("../domain.cjs");
function reconcile(s){
  const expected=new Map(),add=(account,metal,purity,owner,mg)=>{if(mg){const key=[account,metal,purity,owner].join("|");expected.set(key,(expected.get(key)||0)+mg);}};
  for(const o of s.orders){
    const customer=o.allocations.findIndex(x=>x.owner===o.id),own=o.allocations.findIndex(x=>x.owner==="taller");
    const assigned=customer<0?0:o.allocations[customer].mg;
    if(o.status==="in_progress")for(const x of o.allocations)add("process",o.metal,o.purity,x.owner,x.mg);
    if(["received","in_progress"].includes(o.status))add("custody",o.metal,o.purity,o.id,o.receivedMg-assigned);
    if(["quality","ready"].includes(o.status)&&o.returned){
      add("custody",o.metal,o.purity,o.id,o.receivedMg-assigned+(customer<0?0:o.returned.pieces[customer]));
      add("scrap",o.metal,o.purity,o.id,customer<0?0:o.returned.scraps[customer]);
      add("finished",o.metal,o.purity,"taller",own<0?0:o.returned.pieces[own]);
    }
  }
  for(const stock of s.stock.filter(x=>!x.reversedAt))add("finished",stock.metal,stock.purity,"taller",stock.remainingMg??stock.mg);
  const actual=new Map();
  for(const x of D.balances(s))if(["process","custody","finished"].includes(x.account)||(x.account==="scrap"&&x.owner!=="taller"))actual.set([x.account,x.metal,x.purity,x.owner].join("|"),x.mg);
  assert.deepEqual([...actual].sort(),[...expected].sort(),"Los procesos, custodias y piezas deben conciliar con sus órdenes y lotes");
  for(const m of s.materials){
    const quantity=s.materialMoves.filter(x=>x.materialId===m.id).reduce((v,x)=>v+BigInt(Math.round(x.quantity*1e6)),0n);
    assert.equal(quantity,BigInt(Math.round(m.quantity*1e6)),"Existencias de insumos conciliadas con movimientos originales y compensatorios");
  }
}
test("Diez jornadas integrales concilian inventario, caja, gastos y reversiones después de cada operación",()=>{
  const s=D.initialState(),a={role:"admin",name:"Admin"};s.settings.rate.oro=100000;let operations=0;
  const run=(action,data)=>{const x=D.execute(s,action,data,a);operations++;D.validateState(s);reconcile(s);return x;};
  const reverse=(type,id)=>run("operation.reverse",{type,id,reason:"Devolución física verificada",reference:"DEV-001",confirmed:true});
  const client=run("client.save",{name:"Cliente"}),smith=run("smith.save",{name:"Orfebre",bench:"Mesa"}),supplier=run("supplier.save",{name:"Proveedor"});
  const material=run("material.save",{name:"Insumo",unit:"ml",quantity:1000,unitCost:50,min:1});
  run("inventory.adjust",{account:"own",metal:"oro",purity:750,weight:20,reason:"Base inicial pesada"});
  let carry=2000000;const closed=[];
  for(let day=1;day<=10;day++){
    let expectedCash=carry;
    const shift=run("shift.open",{opening:carry,mode:day%2?"mixed":"cash",openingGold:day%2?[{purity:750,weight:1}]:[]});
    const purchase=run("purchase.create",{supplierId:supplier.id,document:"FACT-"+day,metal:"oro",purity:750,weight:2,rate:100000,dueDate:"2026-12-01"});
    const supplierCash=run("supplier.pay",{id:purchase.id,amount:50000,method:"cash",reference:"CAJA"});expectedCash-=50000;
    run("supplier.pay",{id:purchase.id,amount:100000,method:"bank",reference:"BANCO"});
    if(day%3===0){reverse("supplierPayment",supplierCash.id);expectedCash+=50000;run("supplier.pay",{id:purchase.id,amount:50000,method:"cash",reference:"CORREGIDO"});expectedCash-=50000;}
    let expense=run("expense.create",{category:"Servicios públicos",concept:"Gasto diario",amount:5000,method:"cash"});expectedCash-=5000;
    run("expense.create",{category:"Otros",concept:"Gasto por banco",amount:7000,method:"bank",reference:"BANCO"});
    if(day%3===0){reverse("expense",expense.id);expectedCash+=5000;expense=run("expense.create",{category:"Servicios públicos",concept:"Gasto corregido",amount:5000,method:"cash"});expectedCash-=5000;}
    run("cash.entry",{type:"expense",amount:2000,note:"Transporte"});expectedCash-=2000;const legacy=s.cashEntries.at(-1);
    const entries=s.cashEntries.length;run("expense.classify",{cashEntryId:legacy.id,category:"Transporte",concept:"Transporte",amount:2000,method:"cash"});assert.equal(s.cashEntries.length,entries);
    if(day%2===0){const extra=run("purchase.create",{supplierId:supplier.id,document:"EXTRA-"+day,metal:"oro",purity:750,weight:0.01,rate:100000,dueDate:"2026-12-01"});const pay=run("supplier.pay",{id:extra.id,amount:750,method:"bank",reference:"BANCO"});reverse("supplierPayment",pay.id);reverse("purchase",extra.id);}
    for(let j=0;j<4;j++){
      const own=j===3,weight=own?0.7:j<2?1.3:1;
      const o=run("order.create",{clientId:client.id,type:own?"Producción propia":"Reparación",description:"Trabajo jornada "+day,condition:"Recibido",metal:"oro",purity:750,receivedWeight:own?0:1,labor:own?0:120000,materialPrice:0,goldPrice:0,taxPercent:0,dueDate:"2026-12-01"});
      const assignment={id:o.id,smithId:smith.id,customerWeight:own?0:1,ownWeight:own?0.7:j<2?0.3:0,smithFee:1000};
      run("order.assign",assignment);
      if(day%5===0&&j===0){reverse("assignment",o.id);run("order.assign",assignment);}
      let used=run("material.use",{orderId:o.id,materialId:material.id,quantity:0.57});assert.equal(used.cost,29);
      if(day%4===0&&j===0){reverse("material",used.id);used=run("material.use",{orderId:o.id,materialId:material.id,quantity:0.57});}
      run("order.return",{id:o.id,pieceWeight:Number((weight-0.02).toFixed(3)),scrapWeight:0.01,reason:"Pesado y verificado"});
      run("order.quality",{id:o.id,checks:[true,true,true]});
      if(day%4===0&&j===1){reverse("quality",o.id);run("order.quality",{id:o.id,checks:[true,true,true]});}
      if(own){
        const stock=run("stock.receive",{id:o.id,quantity:2,cost:52779,price:90000});
        let first=run("stock.transfer",{id:stock.id,quantity:1,weight:0.34,destination:"Joyería A"});
        const second=run("stock.transfer",{id:stock.id,quantity:1,weight:0.34,destination:"Joyería B"});
        if(day%3===0){reverse("stockTransfer",first.id);first=run("stock.transfer",{id:stock.id,quantity:1,weight:0.34,destination:"Entrega corregida"});}
        if(day%5===0){reverse("stockTransfer",first.id);reverse("stockTransfer",second.id);reverse("stockReceive",stock.id);run("stock.receive",{id:o.id,quantity:2,cost:52779,price:90000});}
      }else{
        const payment={orderId:o.id,cash:j===0?120000:j===1?60000:122500,bank:j===1?60000:0,bankRef:j===1?"BANCO":"",goldWeight:j===2?0.1:0,metal:"oro",purity:750,rate:100000};
        const p=run("payment.create",payment);expectedCash+=j===0?120000:j===1?60000:112500;
        run("order.deliver",{id:o.id,acceptance:"Cliente"});
        if(day%2===0&&j===1){reverse("sale",o.id);reverse("payment",p.id);expectedCash-=60000;run("payment.create",payment);expectedCash+=60000;run("order.deliver",{id:o.id,acceptance:"Cliente, entrega corregida"});}
      }
    }
    const settlement=run("smith.settle",{smithId:smith.id,method:"cash",reference:"RECIBO"});assert.equal(settlement.amount,4000);expectedCash-=4000;
    assert.equal(D.cashExpected(s,shift),expectedCash,"Caja conciliada con un cálculo independiente");
    run("shift.close",{shiftId:shift.id,counted:expectedCash,goldCounts:D.cashMetals(s).map(x=>({metal:x.metal,purity:x.purity,weight:x.mg/1000})),receiver:"Bodega",reason:"Conciliación diaria"});
    carry=expectedCash;closed.push(JSON.stringify(shift));
    assert.deepEqual(s.shifts.map(x=>JSON.stringify(x)),closed,"Los cierres anteriores permanecen intactos");
    assert.equal(D.balance(s,"own","oro",750),20000+day*800,"Oro propio conciliado con compras, aportes y metal recibido como pago");
  }
  assert.equal(carry,4315000);assert.equal(D.balance(s,"scrap","oro",750),140);
  assert.equal(D.balance(s,"finished","oro",750),1360);assert.equal(s.orders.length,40);
  assert.equal(D.balances(s).filter(x=>x.owner!=="taller").length,0);
  console.log("REVISIÓN INTEGRAL:",JSON.stringify({days:10,operations,orders:s.orders.length,cash:carry,ownMg:D.balance(s,"own","oro",750),finishedMg:D.balance(s,"finished","oro",750),reversals:s.reversals.length,expenses:s.expenses.length}));
});
