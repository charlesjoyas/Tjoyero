"use strict";
// Eliminación operativa: conserva los documentos y compensaciones necesarios para auditar saldos.
module.exports=function removeOperation(s,b,a,D){
  const {assert,get,str,id,now,execute}=D;
  assert(b.confirmed===true&&b.confirmation==="ELIMINAR","Escribe ELIMINAR y confirma la devolución real antes de eliminar.");
  const reason=str(b.reason,"Motivo de eliminación",1000),reference=str(b.reference,"Soporte",200,false);
  const collections={expense:"expenses",purchase:"purchases",supplierPayment:"supplierPayments",payment:"payments",order:"orders",cash:"cashEntries",ledger:"ledger",material:"materialMoves",stockReceive:"stock",settlement:"settlements"};
  const repeatable=["sale","assignment","quality"];
  assert(collections[b.type]||repeatable.includes(b.type)||b.type==="stockTransfer","Esta operación no admite eliminación.");
  let reversal;
  if(b.reversalId){
    reversal=(s.reversals||[]).find(x=>x.id===b.reversalId);
    assert(reversal&&reversal.type===b.type&&reversal.targetId===b.id,"La reversión seleccionada no corresponde al registro.",409);
    assert(!reversal.deletedAt,"La operación ya fue eliminada.",409);
  }
  let source;
  if(collections[b.type])source=get(s,collections[b.type],b.id);
  else if(b.type==="stockTransfer")source=s.stock.flatMap(x=>x.transfers).find(x=>x.id===b.id);
  if(!repeatable.includes(b.type))assert(source&&!source.deletedAt,"El registro no existe o ya fue eliminado.",409);
  if(reversal&&source)assert(source.reversedAt||source.voidedAt||(b.type==="order"&&source.status==="cancelled"),"El registro sigue vigente: debe compensarse antes de eliminarlo.",409);
  if(!reversal){
    const already=source&&(source.reversedAt||source.voidedAt||(b.type==="order"&&source.status==="cancelled"));
    if(already)reversal=[...(s.reversals||[])].reverse().find(x=>x.type===b.type&&x.targetId===b.id&&!x.deletedAt);
    if(!reversal)reversal=execute(s,"operation.reverse",{...b,reason,reference},a);
  }
  assert(reversal&&!reversal.deletedAt,"La operación ya fue eliminada.",409);
  const record={id:id(),at:now(),actor:a.name,type:b.type,targetId:b.id,reversalId:reversal.id,reason,reference,
    summary:"Registro eliminado de los listados operativos. "+reversal.summary};
  const mark=row=>{row.deletedAt=record.at;row.deletedBy=a.name;row.deletionId=record.id;};
  mark(reversal);
  if(b.type==="order")for(const row of s.reversals)if(row.targetId===b.id&&repeatable.includes(row.type)&&!row.deletedAt)mark(row);
  if(source)mark(source);
  if(b.type==="expense"&&source.cashEntryId){const entry=s.cashEntries.find(x=>x.id===source.cashEntryId);if(entry)mark(entry);}
  if(b.type==="material")for(const o of s.orders)for(const usage of o.materialUsage)if(usage.id===source.id)mark(usage);
  if(["cash","expense"].includes(b.type))for(const entry of s.cashEntries)if(entry.ref==="REV-"+reversal.id)mark(entry);
  if(b.type==="ledger")for(const entry of s.ledger)if(entry.ref==="REV-"+reversal.id)mark(entry);
  s.deletions??=[];s.deletions.push(record);
  return record;
};
