"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const Labor = require("../labor-estimate.js");
const D = require("../domain.cjs");
const sample = {mode:"time",quantity:2.5,rate:20000,overhead:5000,markup:30,minimum:0};
test("Estimador: costos por hora y gramo, recargo, mínimo y redondeo exacto a pesos", () => {
  const estimate=Labor.calculate(sample);
  assert.equal(estimate.directCost,50000);
  assert.equal(estimate.baseCost,55000);
  assert.equal(estimate.suggested,71500);
  assert.equal(estimate.difference,16500);
  const weight=Labor.calculate({mode:"weight",quantity:3.25,rate:12000,overhead:5000,markup:20,minimum:60000});
  assert.equal(weight.baseCost,44000);
  assert.equal(weight.suggested,60000);
  assert.equal(Labor.calculate({...sample,quantity:0.001,rate:1,overhead:0,markup:0}).suggested,1);
  assert.equal(Labor.calculate({...sample,quantity:0.1,rate:333,overhead:0,markup:10}).suggested,37);
  assert.equal(Labor.calculate({...sample,quantity:1,rate:1e12,overhead:0,markup:0}).suggested,1e12);
  assert.equal(Labor.calculate({...sample,quantity:"2.500",markup:"30.00"}).suggested,71500);
});
test("Estimador: rechaza cantidades inválidas, centavos en costos, precisión y desbordamientos", () => {
  for (const data of [null,[],{}, {...sample,mode:"invalid"},
    ...[null,true,"",0,-1,Infinity,"2,50",1.0001].map(quantity=>({...sample,quantity})),
    ...[0,12.5,"abc",true].map(rate=>({...sample,rate})),
    {...sample,overhead:-1},{...sample,minimum:1.5},{...sample,markup:0.001},
    {...sample,markup:1001},{...sample,quantity:1000000,rate:1e12}])
    assert.throws(()=>Labor.calculate(data),undefined,JSON.stringify(data));
});
test("Orden: conserva el desglose, permite ajuste manual y valida estimados de copias", () => {
  const s=D.initialState(),a={role:"admin",name:"Administrador"};
  const c=D.execute(s,"client.save",{name:"Cliente"},a);
  const data={clientId:c.id,type:"Reparación",description:"Reparación",condition:"Pieza recibida",metal:"oro",purity:750,receivedWeight:3,dueDate:"2026-12-01",labor:80000,materialPrice:5000,goldPrice:0,taxPercent:19,laborEstimate:{...sample,suggested:1}};
  const o=D.execute(s,"order.create",data,a);
  assert.equal(o.laborEstimate.suggested,71500,"El servidor recalcula el estimado");
  assert.equal(o.labor,80000,"El cobro elegido puede diferir del estimado");
  assert.equal(o.tax,16150);
  D.validateState(s);
  const edited=D.execute(s,"order.edit",{...data,id:o.id,labor:90000,laborEstimate:undefined,reason:"Ajuste convenido"},a);
  assert.equal(edited.laborEstimate.suggested,71500);
  const restored=JSON.parse(JSON.stringify(s));
  D.validateState(restored);
  restored.orders[0].laborEstimate.suggested=1;
  assert.throws(()=>D.validateState(restored),/Estimado/);
  assert.throws(()=>D.execute(s,"order.create",{...data,laborEstimate:{...sample,quantity:-1}},a),e=>e.status===400);
  const legacy=structuredClone(s);
  delete legacy.orders[0].laborEstimate;
  D.validateState(legacy);
});
