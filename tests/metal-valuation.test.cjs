"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),N=require("../numbers.js"),D=require("../domain.cjs");
test("Valoración de metales: suma tarifas independientes y separa propiedad sin modificar saldos",()=>{
  const rows=[{account:"own",metal:"oro",owner:"taller",fineUg:7500000},{account:"process",metal:"plata",owner:"taller",fineUg:3700000},{account:"custody",metal:"oro",owner:"cliente",fineUg:1500000}],before=structuredClone(rows);
  const result=N.metalValuation(rows,{oro:1000000,plata:10000});
  assert.equal(result.total,9037000n);assert.equal(result.own,7537000n);assert.equal(result.clients,1500000n);assert.deepEqual(result.missing,[]);assert.deepEqual(rows,before);
  assert.deepEqual(result.rows.map(x=>x.estimatedCop),[7500000n,37000n,1500000n]);
});
test("Valoración: redondeo exacto y totales que concilian con cada ubicación y propietario",()=>{
  const rows=Array.from({length:9},(_,i)=>({account:i%2?"own":"process",metal:"oro",owner:i%3?"taller":"cliente",fineUg:1}));
  const result=N.metalValuation(rows,{oro:500000});
  assert.equal(result.total,5n);assert.equal(result.rows.reduce((sum,x)=>sum+x.estimatedCop,0n),5n);assert.equal(result.own+result.clients,result.total);
  assert.ok(result.rows.every(x=>x.estimatedCop===0n||x.estimatedCop===1n));
  assert.equal(N.metalValuation([{metal:"oro",owner:"taller",fineUg:Number.MAX_SAFE_INTEGER}],{oro:1000000000000}).total,9007199254740991000000n);
});
test("Valoración: los traslados internos no duplican valor y los metales sin tarifa no valen cero",()=>{
  const s=D.initialState(),actor={role:"admin",name:"Admin"};s.settings.rate.oro=1000000;
  D.execute(s,"inventory.adjust",{account:"own",metal:"oro",purity:750,weight:10,reason:"Inicial"},actor);
  const before=N.metalValuation(D.balances(s),s.settings.rate);
  D.execute(s,"inventory.transfer",{from:"own",to:"melt",metal:"oro",purity:750,weight:3,reason:"Apartado"},actor);
  const after=N.metalValuation(D.balances(s),s.settings.rate);assert.equal(after.total,before.total);assert.equal(after.own,before.own);
  D.execute(s,"inventory.adjust",{account:"own",metal:"platino",purity:950,weight:2,reason:"Inicial"},actor);
  const partial=N.metalValuation(D.balances(s),s.settings.rate);assert.equal(partial.total,before.total);assert.deepEqual(partial.missing,["platino"]);assert.equal(partial.rows.find(x=>x.metal==="platino").estimatedCop,null);
  assert.equal(N.metalValuation([],{}).total,0n);assert.throws(()=>N.metalValuation([{metal:"oro",fineUg:-1}],{oro:1000}),/inválido/);
});
