"use strict";
// Las gemas tienen unidades y quilates propios; nunca forman parte del libro de metal.
const STATES = ["held", "mounted", "returned", "delivered", "lost"];
const charged = x => x.owner === "taller" && !["returned", "lost"].includes(x.status);
const stonePrice = o => (o.stones || []).filter(charged).reduce((v, x) => v + x.price, 0);
function photo(value, D) {
  if (!value) return undefined;
  D.assert(typeof value === "string" && value.length < 1500000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value), "Fotografía de la piedra inválida o demasiado grande.");
  return value;
}
function details(b, D) {
  return { name:D.str(b.name,"Tipo / nombre de piedra",160),cut:D.str(b.cut,"Talla",100,false),measurements:D.str(b.measurements,"Medidas",100,false),certificate:D.str(b.certificate,"Certificado / código",200,false),notes:D.str(b.notes,"Observaciones de la piedra",2000,false),...(b.photo ? {photo:photo(b.photo,D)} : {}) };
}
function integer(v, label, D, min=0, max=1e9) {
  const n = D.num(v,label,min,max);D.assert(Number.isSafeInteger(n),label+": usa unidades enteras.");return n;
}
function carats(v,D,optional=false) {
  if (optional && (v === "" || v === undefined || v === null)) return null;
  return D.grams(v,"Quilates (ct)");
}
function transition(x, status, a, D, note, ref="") {
  x.events.push({id:D.id(),at:D.now(),actor:a.name,from:x.status,to:status,note,ref});x.status=status;
}
function weightCheck(o,D) {
  if (!o.gemWeight) return;
  const w=o.gemWeight;
  D.assert(["pending","estimated","confirmed"].includes(w.status),"Estado del peso neto inválido.");
  D.assert(Number.isSafeInteger(w.grossMg)&&w.grossMg>0,"Peso bruto de la joya inválido.");
  D.assert(Number.isSafeInteger(w.netMg)&&w.netMg>=0&&w.netMg<=w.grossMg,"El metal neto no puede superar el peso bruto de la joya.");
  D.assert(o.receivedMg===(w.status==="confirmed"?w.netMg:0),"El peso pendiente / estimado no puede entrar al libro como metal confirmado.");
  const known=(o.stones||[]).filter(x=>x.owner==="cliente"&&x.includedInPiece&&x.caratMilli!==null).reduce((v,x)=>v+x.caratMilli,0);
  D.assert(BigInt(w.status==="confirmed"?w.netMg:0)*1000n+BigInt(known)*200n<=BigInt(w.grossMg)*1000n+1000n,"El peso de las piedras y del metal supera el peso bruto recibido. Revisa el pesaje y los quilates.");
}
function ready(o,D) {
  weightCheck(o,D);
  if (o.gemWeight) D.assert(o.gemWeight.status==="confirmed" && (o.stones||[]).some(x=>x.owner==="cliente"),"Registra las piedras del cliente y confirma el peso neto del metal antes de producir.");
}
function resolved(o,D) {
  ready(o,D);D.assert(!(o.stones||[]).some(x=>x.status==="held"),"Hay piedras pendientes: registra su montaje, devolución o pérdida antes de aprobar calidad o entregar.");
}
function priceChange(s,o,delta,D) {
  const next=D.money(o.materialPrice+delta,"Piedras e insumos");
  const base=D.money(o.labor+next+o.goldPrice,"Subtotal del presupuesto");
  const tax=D.Numbers.tax(base,o.taxPercent);
  D.money(o.labor+next+o.goldPrice+tax,"Total del presupuesto");
  D.assert(o.labor+next+o.goldPrice+tax>=D.paid(s,o),"Devuelve primero el exceso de anticipo antes de retirar el precio de esta piedra.");
  o.materialPrice=next;o.tax=tax;
}
function returnStone(s,o,x,b,a,D) {
  D.assert(["held","mounted"].includes(x.status),"La piedra no está disponible en el taller para devolverla.");
  D.assert(b.confirmed===true,"Confirma la recuperación física de todas las piedras de esta línea.");
  const reason=D.str(b.reason,"Motivo y comprobación de la devolución",1000);
  if(charged(x))priceChange(s,o,-x.price,D);
  if(x.owner==="taller") {
    const lot=s.gemstoneLots.find(v=>v.id===x.stockId);
    D.assert(lot,"Lote de piedras no encontrado.");
    lot.available+=x.quantity;lot.remainingCaratMilli+=x.caratMilli;lot.remainingCost+=x.cost;
  }
  transition(x,"returned",a,D,reason);D.timeline(o,a,"Piedras físicamente recuperadas y devueltas: "+x.name+". "+reason);
}
function execute(s,action,b,a,D,options={}) {
  if(action==="gem.lot") {
    D.permit(a,"inventory");
    const quantity=integer(b.quantity,"Cantidad de piedras",D,1,1000000), ct=carats(b.carats,D);
    D.assert(ct>=quantity,"Registra al menos 0,001 ct por unidad o separa los lotes.");
    const individual=b.individual===true;
    D.assert(!individual||quantity===1,"Una piedra individual debe tener una sola unidad.");
    const x={...details(b,D),id:D.id(),code:D.seq(s,"gemstone","PG"),quantity,available:quantity,caratMilli:ct,remainingCaratMilli:ct,cost:D.money(b.cost??0,"Costo total del lote"),unitPrice:D.money(b.unitPrice??0,"Precio sugerido por piedra"),individual,at:D.now(),actor:a.name};x.remainingCost=x.cost;
    (s.gemstoneLots??=[]).push(x);return x;
  }
  const o=D.get(s,"orders",b.orderId);
  D.assert(!["delivered","cancelled"].includes(o.status),"La orden está cerrada. Reversa primero su entrega.");
  if(action==="gem.weight") {
    D.permit(a,"orders");D.assert(o.status==="received"&&!o.allocations.length,"Confirma el peso neto antes de asignar a mesa.");
    const grossMg=D.grams(b.grossWeight,"Peso bruto de la joya"),netMg=D.grams(b.netWeight??0,"Peso neto del metal",true),status=b.weightStatus;
    const next={grossMg,netMg,status};
    const receivedMg=status==="confirmed"?netMg:0;
    weightCheck({...o,receivedMg,gemWeight:next},D);
    const reason=D.str(b.reason,"Comprobación del peso neto",1000);
    if(o.receivedMg)D.move(s,a,"custody","cliente",o.receivedMg,o.metal,o.purity,o.id,o.code,"Corrección respaldada del peso neto: "+reason);
    o.gemWeight=next;o.receivedMg=receivedMg;
    if(receivedMg)D.move(s,a,"cliente","custody",receivedMg,o.metal,o.purity,o.id,o.code,"Peso neto confirmado, excluyendo piedras: "+reason);
    D.timeline(o,a,"Pesaje de joya con piedras: "+status+". "+reason);return o;
  }
  if(action==="gem.add") {
    const owner=b.owner;
    D.assert(["cliente","taller"].includes(owner),"Selecciona de quién es la piedra.");
    D.permit(a,owner==="cliente"||options.reception===true?"orders":"production");
    D.assert(["received","in_progress"].includes(o.status),"Añade piedras antes del retorno de producción.");
    D.assert((o.stones||[]).length<200,"Máximo 200 líneas de piedras por trabajo.");
    const quantity=integer(b.quantity,"Cantidad de piedras",D,1,1000000);
    let x;
    if(owner==="taller") {
      const lot=(s.gemstoneLots||[]).find(x=>x.id===b.stockId);D.assert(lot,"Selecciona un lote de piedras del taller.");
      const ct=carats(b.carats,D);
      D.assert(quantity<=lot.available&&ct<=lot.remainingCaratMilli,"No hay suficientes unidades / quilates de esta piedra.");
      D.assert(ct>=quantity&&lot.remainingCaratMilli-ct>=lot.available-quantity,"Conserva al menos 0,001 ct por unidad restante.");
      D.assert(quantity!==lot.available||ct===lot.remainingCaratMilli,"Al retirar las últimas piedras retira todos los quilates del lote.");
      const cost=quantity===lot.available?lot.remainingCost:Number((BigInt(lot.remainingCost)*BigInt(ct)*2n+BigInt(lot.remainingCaratMilli))/(2n*BigInt(lot.remainingCaratMilli)));
      x={...details(lot,D),stockId:lot.id,caratMilli:ct,cost,price:D.money(b.price??0,"Precio total de las piedras")};
      priceChange(s,o,x.price,D);
      lot.available-=quantity;lot.remainingCaratMilli-=ct;lot.remainingCost-=cost;
    } else {
      D.assert(o.type!=="Producción propia"&&o.status==="received","Recibe las piedras del cliente antes de asignar el trabajo a mesa.");
      D.assert(o.gemWeight,"Registra primero el peso bruto y el peso neto del metal; no cuentes las piedras como oro.");
      x={...details(b,D),caratMilli:carats(b.carats,D,true),cost:0,price:0,condition:D.str(b.condition,"Estado de las piedras recibidas",2000),includedInPiece:b.includedInPiece===true};
    }
    Object.assign(x,{id:D.id(),owner,quantity,status:b.mounted===true&&owner==="cliente"?"mounted":"held",at:D.now(),actor:a.name,events:[]});
    x.events.push({id:D.id(),at:x.at,actor:a.name,from:owner==="taller"?"stock":"cliente",to:x.status,note:owner==="taller"?"Salida de inventario a trabajo":"Recibida en custodia",ref:o.code});
    (o.stones??=[]).push(x);weightCheck(o,D);D.timeline(o,a,"Piedras registradas: "+x.name+" · "+quantity+" · "+owner);return x;
  }
  const x=(o.stones||[]).find(x=>x.id===b.id);D.assert(x,"Piedra de la orden no encontrada.");
  D.permit(a,"production");
  D.assert(!["ready"].includes(o.status),"Reversa la aprobación de calidad antes de cambiar las piedras.");
  if(action==="gem.return")return returnStone(s,o,x,b,a,D)||x;
  if(action==="gem.unmount") {
    D.assert(x.status==="mounted","Solo se desmontan piedras que están en la pieza.");
    transition(x,"held",a,D,D.str(b.reason,"Verificación del desmontaje",1000));
  }else if(action==="gem.mount") {
    D.assert(x.status==="held","Solo se montan piedras pendientes.");D.assert(o.status!=="received","Asigna el trabajo a mesa antes de montar piedras.");
    transition(x,"mounted",a,D,D.str(b.reason,"Comprobación del montaje",1000));
  }else if(action==="gem.loss") {
    D.permit(a,"adjust");D.assert(["held","mounted"].includes(x.status),"Piedra no disponible para registrar el incidente.");D.assert(b.confirmed===true,"Confirma la pérdida y conserva el soporte del incidente.");
    const reason=D.str(b.reason,"Incidente de piedra",1000);if(charged(x))priceChange(s,o,-x.price,D);transition(x,"lost",a,D,reason);
  }else D.assert(false,"Acción de piedras desconocida.");
  D.timeline(o,a,"Piedras: "+x.name+" · "+x.status+" · "+b.reason);return x;
}
function finish(o,ref,a,D,undo=false) {
  for(const x of o.stones||[]) {
    if(undo&&x.status==="delivered"&&x.events.at(-1)?.ref===ref)transition(x,"mounted",a,D,"Pieza recibida físicamente de vuelta",ref);
    else if(!undo&&x.status==="mounted")transition(x,"delivered",a,D,"Piedra entregada montada en la pieza",ref);
  }
}
function close(s,o,b,a,D) {
  for(const x of o.stones||[])if(["held","mounted"].includes(x.status))returnStone(s,o,x,b,a,D);
}
function validate(s,D) {
  const lots=s.gemstoneLots??[];D.assert(Array.isArray(lots),"Inventario de piedras inválido.");
  const ids=new Set(),stones=new Set();
  for(const l of lots) {
    D.assert(l&&typeof l.id==="string"&&!ids.has(l.id),"Lote de piedras duplicado o inválido.");ids.add(l.id);details(l,D);
    for(const k of ["quantity","available","caratMilli","remainingCaratMilli","cost","remainingCost","unitPrice"])D.assert(Number.isSafeInteger(l[k])&&l[k]>=0&&l[k]<=1e12,"Saldo de piedras inválido: "+k);
    D.assert(l.quantity>0&&l.caratMilli>=l.quantity&&typeof l.individual==="boolean"&&(!l.individual||l.quantity===1),"Lote de piedras inválido.");
  }
  const active=new Map(lots.map(l=>[l.id,{quantity:0,ct:0,cost:0}]));
  for(const o of s.orders) {
    D.assert(o.stones===undefined||Array.isArray(o.stones)&&o.stones.length<=200,"Piedras del trabajo inválidas.");weightCheck(o,D);
    for(const x of o.stones||[]) {
      D.assert(x&&typeof x.id==="string"&&!stones.has(x.id),"Piedra de trabajo duplicada.");stones.add(x.id);details(x,D);
      D.assert(["cliente","taller"].includes(x.owner)&&STATES.includes(x.status)&&Number.isSafeInteger(x.quantity)&&x.quantity>0&&x.quantity<=1000000,"Cantidad / estado de piedras inválido.");
      D.assert(x.caratMilli===null||Number.isSafeInteger(x.caratMilli)&&x.caratMilli>0&&x.caratMilli<=1e9,"Quilates de piedras inválidos.");
      D.money(x.cost,"Costo de piedras");D.money(x.price,"Precio de piedras");
      D.assert(Number.isSafeInteger(x.cost)&&Number.isSafeInteger(x.price),"Importes de piedras inválidos.");
      D.assert(Array.isArray(x.events)&&x.events.length>0&&x.events.at(-1).to===x.status,"Historial de piedras incompleto.");
      const events=new Set();let previous=x.owner==="taller"?"stock":"cliente";
      const routes={stock:["held"],cliente:["held","mounted"],held:["mounted","returned","lost"],mounted:["held","returned","delivered","lost"],delivered:["mounted"],returned:[],lost:[]};
      for(const e of x.events){D.assert(e&&typeof e.id==="string"&&!events.has(e.id)&&e.from===previous&&routes[previous]?.includes(e.to)&&Number.isFinite(Date.parse(e.at))&&typeof e.actor==="string"&&typeof e.note==="string", "Historial de piedras inconsistente.");events.add(e.id);previous=e.to;}
      if(x.owner==="taller") {
        D.assert(ids.has(x.stockId)&&x.caratMilli!==null&&x.caratMilli>=x.quantity,"La piedra propia no corresponde a su lote.");
        if(x.status!=="returned"){const v=active.get(x.stockId);v.quantity+=x.quantity;v.ct+=x.caratMilli;v.cost+=x.cost;}
      }else D.assert(o.gemWeight&&o.type!=="Producción propia"&&x.cost===0&&x.price===0&&typeof x.includedInPiece==="boolean"&&typeof x.condition==="string"&&x.condition.trim(),"La piedra en custodia no es patrimonio ni venta del taller; registra el peso bruto y neto.");
      if(x.status==="delivered") {
        const ref=o.type==="Producción propia"?s.stock.find(l=>l.id===o.stockId)?.transfers.find(t=>!t.reversedAt)?.code:o.invoice;
        D.assert(o.status==="delivered"&&ref&&x.events.at(-1).ref===ref,"La piedra entregada no concilia con la entrega vigente de su pieza.");
      }
      if(o.status==="delivered"&&o.type!=="Producción propia")D.assert(x.status!=="mounted","La venta conserva una piedra sin registrar su entrega.");
      if(o.status==="cancelled")D.assert(["returned","lost"].includes(x.status),"Una orden anulada conserva piedras pendientes de devolver.");
      if(o.status==="ready"||o.status==="delivered")D.assert(x.status!=="held","Una orden aprobada conserva piedras pendientes.");
    }
    D.assert(stonePrice(o)<=o.materialPrice,"El presupuesto no incluye todas las piedras vendidas.");
    if(["in_progress","quality","ready","delivered"].includes(o.status))ready(o,D);
    if(["ready","delivered"].includes(o.status)&&(o.stones||[]).some(x=>x.owner==="cliente"&&x.status==="lost"))D.assert(o.quality?.stoneIncidentAcknowledged===true,"Falta la comprobación del incidente de piedras del cliente.");
  }
  for(const l of lots){const v=active.get(l.id);D.assert(l.reversedAt?l.available===0&&l.remainingCaratMilli===0&&l.remainingCost===0&&v.quantity===0:l.available+v.quantity===l.quantity&&l.remainingCaratMilli+v.ct===l.caratMilli&&l.remainingCost+v.cost===l.cost,"El inventario de piedras no concilia en unidades, quilates o costo.");D.assert(l.remainingCaratMilli>=l.available&&(l.available!==0||l.remainingCaratMilli===0&&l.remainingCost===0),"Saldo de lote de piedras incompleto.");}
}
module.exports={execute,validate,ready,resolved,finish,close,weightCheck,stonePrice};
