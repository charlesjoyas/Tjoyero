"use strict";
module.exports = function reverse(s, b, a, D) {
  const {assert,get,str,id,now,move,cash,openShift,balance,paid,total,timeline,execute,materialQuantity,money,PM}=D;
  assert(b.confirmed === true, "Confirma la devolución física o la corrección real antes de reversar.");
  const reason=str(b.reason,"Motivo de reversión",1000);
  const reference=str(b.reference,"Soporte de devolución",200,false);
  const record={id:id(),type:b.type,targetId:b.id,at:now(),actor:a.name,reason,reference};
  const ref="REV-"+record.id;
  const mark=(x)=>Object.assign(x,{reversedAt:record.at,reversedBy:a.name,reverseReason:reason,reversalId:record.id});
  const live=(x)=>assert(!x.reversedAt,"La operación ya fue reversada.",409);
  const bankProof=(method)=>assert(method!=="bank" || reference,"Registra el soporte de la devolución bancaria.");
  const paidAmount=(p)=>{
    assert(["cash","bank"].includes(p.method),"El registro no conserva un medio de pago válido.");
    money(p.amount,"Importe del pago original");assert(p.amount>0,"El pago original debe ser mayor que cero.");
  };
  const cashBack=(amount,label)=>cash(s,a,openShift(s),amount,label+": "+reason,ref);
  const inverse=(x)=>move(s,a,x.to,x.from,x.mg,x.metal,x.purity,x.owner,ref,reason);
  switch(b.type) {
    case "expense": {
      const expense=get(s,"expenses",b.id);live(expense);paidAmount(expense);bankProof(expense.method);
      if(expense.method==="cash") {
        const entry=get(s,"cashEntries",expense.cashEntryId);
        assert(entry.expenseId===expense.id&&entry.amount===-expense.amount&&!entry.reversedAt,"El gasto no concilia con su salida original.");
        cashBack(expense.amount,"Reversión de gasto "+expense.code);mark(entry);
      }
      mark(expense);record.summary="Gasto "+expense.code+" reversado; devolución registrada por su medio original.";
      break;
    }
    case "purchase": {
      const p=get(s,"purchases",b.id);live(p);
      assert(!s.supplierPayments.some(x=>x.purchaseId===p.id&&!x.reversedAt),"Reversa primero los pagos de esta compra.");
      for(const item of p.items||[{metal:p.metal,purity:p.purity,mg:p.mg}])
        move(s,a,"own","proveedor",item.mg,item.metal,item.purity,"taller",ref,reason);
      mark(p);record.summary="Compra "+p.code+" reversada; metal devuelto al proveedor.";
      break;
    }
    case "supplierPayment": {
      const p=get(s,"supplierPayments",b.id);live(p);bankProof(p.method);
      paidAmount(p);
      if(p.method==="cash")cashBack(p.amount,"Devolución de pago a proveedor");
      mark(p);record.summary="Pago a proveedor reversado; la deuda vuelve a quedar pendiente.";
      break;
    }
    case "settlement": {
      const p=get(s,"settlements",b.id);live(p);bankProof(p.method);
      paidAmount(p);
      if(p.method==="cash")cashBack(p.amount,"Devolución de honorarios");
      mark(p);record.summary="Pago al orfebre reversado; los honorarios vuelven a quedar pendientes.";
      break;
    }
    case "payment": {
      const p=get(s,"payments",b.id),o=get(s,"orders",p.orderId);
      assert(!p.voidedAt&&!p.reversedAt,"El comprobante ya fue anulado o reversado.",409);
      assert([p.cash,p.bank,p.change,p.goldMg,p.goldValue,p.rate,p.applied,p.received].every(Number.isSafeInteger),"El comprobante no conserva importes válidos.");
      assert(p.change>=0&&p.goldMg>=0&&p.goldValue>=0&&p.rate>=0&&p.received===p.cash+p.bank+p.goldValue&&p.applied===p.received-p.change,"Los importes del comprobante original no concilian.");
      assert(p.refund ? p.cash<=0&&p.bank<=0&&p.change===0&&p.goldMg===0&&p.applied<0 : p.cash>=0&&p.bank>=0&&p.applied>0,"El sentido del comprobante original no es válido.");
      assert(!["delivered","cancelled"].includes(o.status),"Reversa primero la entrega de la venta. Una orden anulada no admite movimientos.");
      const remaining=paid(s,o)-p.applied;
      assert(remaining>=0&&remaining<=total(o),"Hay devoluciones o cobros posteriores incompatibles. Revisa los comprobantes dependientes.");
      if(p.bank)assert(reference,"Registra el soporte de la devolución bancaria.");
      if(p.goldMg) {
        const source=b.metalSource||"payment";
        assert(["payment","own"].includes(source),"Selecciona el origen del metal a devolver.");
        move(s,a,source,"cliente",p.goldMg,p.metal,p.purity,"taller",ref,reason);
      }
      const delta=-(p.cash-p.change);
      if(delta)cashBack(delta,"Reversión de "+p.code);
      mark(p);p.voidedAt=record.at;p.voidedBy=a.name;p.voidReason=reason;
      timeline(o,a,"Comprobante "+p.code+" reversado: "+reason);
      record.summary="Comprobante "+p.code+" reversado con devolución por sus medios originales.";
      break;
    }
    case "sale": {
      const o=get(s,"orders",b.id);
      assert(o.type!=="Producción propia"&&o.status==="delivered"&&o.invoice,"Solo se revierte una entrega de venta vigente.");
      record.original={invoice:o.invoice,deliveredAt:o.deliveredAt,acceptance:o.acceptance,total:total(o)};
      const rows=o.deliveryLedgerIds
        ? o.deliveryLedgerIds.map(key=>get(s,"ledger",key))
        : s.ledger.filter(x=>x.ref===o.code&&x.to==="cliente"&&["Devolución de pieza / sobrantes del cliente","Metal propio vendido en pieza"].includes(x.note));
      assert(rows.length>0&&new Set(rows.map(x=>x.id)).size===rows.length,"La entrega no conserva movimientos completos y únicos. Revisa el registro original.");
      assert(rows.every(x=>x.ref===o.code&&x.to==="cliente"&&["custody","scrap","finished"].includes(x.from)&&(x.owner===o.id||x.owner==="taller")),"Los movimientos no corresponden a esta entrega.");
      assert(o.returned&&Array.isArray(o.returned.pieces)&&Array.isArray(o.returned.scraps),"La entrega no conserva los pesajes de producción.");
      const expectedRoutes=[{owner:o.id,from:"custody",metal:o.metal,purity:o.purity,mg:o.receivedMg},{owner:o.id,from:"scrap",metal:o.metal,purity:o.purity,mg:0}];
      o.allocations.forEach((allocation,index)=>{
        const piece=o.returned.pieces[index],scrap=o.returned.scraps[index];
        assert(Number.isSafeInteger(piece)&&piece>=0&&Number.isSafeInteger(scrap)&&scrap>=0&&piece+scrap<=allocation.mg,"Pesajes de entrega inválidos.");
        if(allocation.owner===o.id){expectedRoutes[0].mg+=piece-allocation.mg;expectedRoutes[1].mg+=scrap;}
        else {const item=PM.identity(o,allocation);const found=expectedRoutes.find(x=>x.owner==="taller"&&PM.key(x)===PM.key(item));if(found)found.mg+=piece;else expectedRoutes.push({...item,owner:"taller",from:"finished",mg:piece});}
      });
      const matches=(route,x)=>x.owner===route.owner&&x.from===route.from&&PM.key(x)===PM.key(route);
      assert(expectedRoutes.every(route=>Number.isSafeInteger(route.mg)&&route.mg>=0&&rows.filter(x=>matches(route,x)).reduce((v,x)=>v+x.mg,0)===route.mg)&&rows.every(x=>expectedRoutes.some(route=>matches(route,x))),"Los movimientos de entrega no concilian con los pesajes originales.");
      for(const x of rows)inverse(x);
      o.status="ready";o.invoice=null;o.deliveredAt=null;o.acceptance=null;o.deliveryLedgerIds=[];
      timeline(o,a,"Entrega / venta "+record.original.invoice+" reversada: "+reason);
      record.summary="Venta "+record.original.invoice+" reversada; pieza y sobrantes recibidos de vuelta. La orden vuelve a lista para entrega. Los pagos se conservan y se devuelven por separado.";
      break;
    }
    case "order": {
      const o=get(s,"orders",b.id);
      assert(o.status!=="cancelled","La orden ya fue reversada.",409);
      record.original={status:o.status,invoice:o.invoice||null,deliveredAt:o.deliveredAt||null};
      if(o.stockId){
        const stock=get(s,"stock",o.stockId);
        assert(!stock.transfers.some(x=>!x.reversedAt),"Revierte primero las transferencias de piezas de esta orden y verifica su devolución al taller.");
        execute(s,"operation.reverse",{type:"stockReceive",id:stock.id,reason,reference,confirmed:true},a);
      }else if(o.status==="delivered"){
        assert(o.invoice,"La entrega no conserva un comprobante válido para reversarla.");
        execute(s,"operation.reverse",{type:"sale",id:o.id,reason,reference,confirmed:true},a);
      }
      if(o.status==="in_progress"&&!o.returned){
        assert(b.metalReturns!==undefined,"Registra los pesos devueltos de cada metal para cerrar la orden en producción.");
        execute(s,"order.return",{id:o.id,metalReturns:b.metalReturns,reason,closingOrder:true},a);
      }
      assert(o.status==="received"||(["quality","ready"].includes(o.status)&&o.returned),"La orden no tiene un retorno válido para cerrar sus metales.");
      const refund=paid(s,o);
      if(refund>0){
        assert(["cash","bank"].includes(b.refundMethod),"Elige cómo devolver el saldo abonado al cliente.");
        bankProof(b.refundMethod);
        const payment=execute(s,"payment.refund",{orderId:o.id,cash:b.refundMethod==="cash"?refund:0,bank:b.refundMethod==="bank"?refund:0,bankRef:reference,reason},a);
        record.refund={code:payment.code,amount:refund,method:b.refundMethod};
      }
      assert(paid(s,o)===0,"El saldo abonado debe quedar devuelto antes de cerrar la orden.");
      const recovered=[];
      if(o.returned)for(const group of PM.groups(o)){
        const mg=group.indexes.reduce((sum,index)=>sum+(o.allocations[index].owner==="taller"?o.returned.pieces[index]:0),0);
        if(mg){move(s,a,"finished","own",mg,group.metal,group.purity,"taller",ref,"Metal propio recuperado al reversar "+o.code+": "+reason);recovered.push({metal:group.metal,purity:group.purity,mg});}
      }
      for(const account of ["custody","scrap"]){
        // La custodia es exclusiva de esta orden; se devuelven pieza y sobrantes reales.
        const rows=D.balances(s).filter(x=>x.owner===o.id&&x.account===account);
        for(const x of rows)move(s,a,account,"cliente",x.mg,x.metal,x.purity,o.id,ref,"Devolución al reversar orden "+o.code+": "+reason);
      }
      o.status="cancelled";mark(o);record.recovered=recovered;
      timeline(o,a,"Orden reversada completamente y retirada de trabajos: "+reason);
      record.summary="Orden "+o.code+" reversada y retirada de las órdenes de trabajo. Pieza y sobrantes del cliente devueltos; metal propio de la pieza recuperado en bodega. "+(refund?"Saldo de "+refund+" COP devuelto en "+(b.refundMethod==="cash"?"efectivo":"banco")+". ":"Sin saldo abonado pendiente. ")+"La merma, los insumos consumidos y los honorarios de trabajo realizado se conservan; la limalla propia permanece en su cuenta.";
      break;
    }
    case "assignment": {
      const o=get(s,"orders",b.id);
      assert(o.status==="in_progress"&&!o.returned&&!o.materialUsage.some(x=>!x.reversedAt)&&o.history.at(-1)?.text.startsWith("Asignada a "),"Solo se reversa una asignación recién registrada, sin avances, insumos ni actividad posterior.");
      const rows=o.assignmentLedgerIds ? o.assignmentLedgerIds.map(key=>get(s,"ledger",key)) : s.ledger.filter(x=>x.ref===o.code&&x.to==="process"&&x.note.startsWith("Salida de "));
      assert(rows.length,"La asignación no conserva sus movimientos de origen.");
      assert(new Set(rows.map(x=>x.id)).size===rows.length,"La asignación tiene movimientos duplicados.");
      assert(rows.every(x=>x.ref===o.code&&x.to==="process"&&["custody","own","payment","melt"].includes(x.from)&&(x.owner===o.id||x.owner==="taller")),"Los movimientos no corresponden a esta asignación.");
      const matches=(allocation,x)=>x.owner===allocation.owner&&PM.key(x)===PM.key(PM.identity(o,allocation));
      assert(new Set(o.allocations.map(x=>x.owner+PM.key(PM.identity(o,x)))).size===o.allocations.length&&o.allocations.every(allocation=>rows.filter(x=>matches(allocation,x)).reduce((v,x)=>v+x.mg,0)===allocation.mg)&&rows.every(x=>o.allocations.some(allocation=>matches(allocation,x))&&(x.owner===o.id?x.from==="custody":["own","payment","melt"].includes(x.from))),"Los movimientos de asignación no concilian con los gramos originales.");
      record.original={smithId:o.smithId,smithFee:o.smithFee,allocations:structuredClone(o.allocations)};
      for(const x of rows)inverse(x);
      o.status="received";o.allocations=[];o.smithId=null;o.smithFee=0;o.assignmentLedgerIds=[];
      timeline(o,a,"Asignación a mesa reversada: "+reason);
      record.summary="Asignación de "+o.code+" reversada; el metal vuelve a sus cuentas de origen y la orden queda por asignar.";
      break;
    }
    case "quality": {
      const o=get(s,"orders",b.id);
      assert(o.status==="ready"&&o.returned&&o.quality&&!o.stockId,"Solo se reversa una aprobación vigente sin entrega ni ingreso de piezas posterior.");
      record.original={quality:structuredClone(o.quality)};
      o.status="quality";o.quality=null;
      timeline(o,a,"Aprobación de calidad reversada: "+reason);
      record.summary="La orden "+o.code+" vuelve a control de calidad. Se conservan los pesajes y la producción real.";
      break;
    }
    case "cash": {
      const x=get(s,"cashEntries",b.id);live(x);
      assert(x.ref==="CAJA","Los movimientos automáticos se revierten desde su operación original.");
      assert(!x.expenseId,"Esta salida corresponde a un gasto clasificado. Reversa el gasto original.");
      money(Math.abs(x.amount),"Importe del movimiento original");assert(x.amount!==0,"El movimiento original no tiene importe.");
      cashBack(-x.amount,"Reversión de movimiento manual de caja");mark(x);
      record.summary="Movimiento manual compensado en el turno abierto. Los cierres anteriores se conservan.";
      break;
    }
    case "ledger": {
      const x=get(s,"ledger",b.id);live(x);
      assert(["TRASLADO","CONCILIACIÓN"].includes(x.ref)&&x.owner==="taller","Este movimiento se revierte desde su compra, cobro o proceso original.");
      inverse(x);mark(x);record.summary="Movimiento de metal compensado con una ruta inversa en el libro.";
      break;
    }
    case "material": {
      const x=get(s,"materialMoves",b.id),m=get(s,"materials",x.materialId);live(x);
      assert(!x.reversalId,"No se reversan movimientos compensatorios.");
      if(x.orderId) {
        const o=get(s,"orders",x.orderId);
        assert(["received","in_progress"].includes(o.status)&&!o.returned,"El insumo ya pasó por producción terminada; no se devuelve automáticamente a existencias.");
        const usage=o.materialUsage.find(u=>u.id===x.id);
        assert(usage&&!usage.reversedAt&&x.quantity<0,"Consumo de insumo no reversible.");mark(usage);
        timeline(o,a,"Consumo de "+m.name+" reversado: "+reason);
      } else {
        assert(x.quantity>0,"Movimiento de insumo no reversible.");
        assert(m.quantity>=x.quantity,"El insumo ya fue consumido. No hay existencias para devolver esta entrada.");
        const after=s.materialMoves.slice(s.materialMoves.indexOf(x)+1).filter(y=>y.materialId===m.id&&!y.reversedAt&&!y.reversalId&&y.quantity>0);
        assert(!after.length,"Reversa primero las entradas posteriores de este insumo para conservar su costo.");
        const usedAfter=s.materialMoves.slice(s.materialMoves.indexOf(x)+1).some(y=>y.materialId===m.id&&!y.reversedAt&&!y.reversalId&&y.quantity<0);
        assert(!usedAfter,"La entrada tiene consumos posteriores. Reversa primero esos consumos si todavía es seguro hacerlo.");
        assert(x.previousUnitCost!==undefined||x.note==="Existencia inicial","Esta entrada antigua no conserva el costo anterior. Corrige el inventario mediante un registro respaldado.");
        if(x.previousUnitCost!==undefined)m.unitCost=x.previousUnitCost;
      }
      m.quantity=materialQuantity(Number((m.quantity-x.quantity).toFixed(6)),"Existencia resultante");
      s.materialMoves.push({id:id(),at:record.at,actor:a.name,materialId:m.id,quantity:-x.quantity,note:ref+" · "+reason,reversalId:record.id});
      mark(x);record.summary="Movimiento de "+m.name+" compensado en existencias.";
      break;
    }
    case "stockTransfer": {
      const stock=s.stock.find(x=>x.transfers.some(t=>t.id===b.id));assert(stock,"Transferencia no encontrada.",404);live(stock);
      const t=stock.transfers.find(x=>x.id===b.id);live(t);
      assert(Number.isSafeInteger(t.quantity)&&t.quantity>0&&Number.isSafeInteger(t.mg)&&t.mg>=t.quantity,"La transferencia no conserva unidades y peso válidos.");
      assert(Number.isSafeInteger(t.cost)&&t.cost>=0&&Number.isSafeInteger(stock.remainingCost??stock.cost),"Esta transferencia no conserva un costo válido para reversarla.");
      assert((stock.remainingCost??stock.cost)+t.cost<=stock.cost,"El costo devuelto supera el costo original del lote.");
      assert(stock.available+t.quantity<=stock.quantity&&(stock.remainingMg??stock.mg)+t.mg<=stock.mg,"La devolución supera las piezas o el peso original del lote.");
      for(const item of t.components||[{metal:stock.metal,purity:stock.purity,mg:t.mg}]){
        move(s,a,"minorista","finished",item.mg,item.metal,item.purity,"taller",ref,reason);
        if(stock.components){const original=stock.components.find(row=>PM.key(row)===PM.key(item));assert(original&&original.remainingMg+item.mg<=original.mg,"El retorno supera el metal original del lote.");original.remainingMg+=item.mg;}
      }
      stock.available+=t.quantity;stock.remainingMg=(stock.remainingMg??stock.mg)+t.mg;
      stock.remainingCost=(stock.remainingCost??stock.cost)+t.cost;
      mark(t);record.summary="Transferencia "+t.code+" reversada; unidades, peso y costo devueltos al lote "+stock.sku+".";
      break;
    }
    case "stockReceive": {
      const stock=get(s,"stock",b.id),o=get(s,"orders",stock.orderId);live(stock);
      assert(o.stockId===stock.id&&o.status==="delivered","El ingreso ya no corresponde al estado de esta producción.");
      assert(o.returned&&stock.mg===o.returned.pieceMg,"El peso del lote no coincide con la producción original.");
      assert(!stock.transfers.some(t=>!t.reversedAt)&&stock.available===stock.quantity&&(stock.remainingMg??stock.mg)===stock.mg,"Devuelve primero todas las transferencias de este lote.");
      assert(PM.components(stock).every(item=>balance(s,"finished",item.metal,item.purity)>=item.mg),"No está disponible todo el metal del lote.");
      if(stock.components)stock.components.forEach(item=>{item.remainingMg=0;});
      stock.available=0;stock.remainingMg=0;stock.remainingCost=0;mark(stock);
      o.status="ready";o.stockId=null;o.deliveredAt=null;
      timeline(o,a,"Ingreso a inventario de piezas "+stock.sku+" reversado: "+reason);
      record.summary="Ingreso del lote "+stock.sku+" reversado; la producción queda lista para registrar nuevamente. El metal permanece como pieza terminada.";
      break;
    }
    default: assert(false,"Esta operación no admite reversión automática.");
  }
  s.reversals??=[];s.reversals.push(record);
  return record;
};
