"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const D = require("../domain.cjs");
function fixture() {
  const s = D.initialState(),
    a = { name: "Administrador", role: "admin" },
    run = (action, data) => D.execute(s, action, data, a);
  s.settings.rate.oro = 610000;
  const client = run("client.save", { name: "Cliente de jornada" });
  const o = run("order.create", {
    clientId: client.id,
    type: "Reparación",
    description: "Reparar broche",
    condition: "Broche incompleto",
    metal: "oro",
    purity: 750,
    receivedWeight: 3.2,
    labor: 120000,
    dueDate: "2026-11-30",
  });
  return { s, run, o };
}
test("Un error de tarifa cero no recibe metal sin abonar su valor", () => {
  const { s, run, o } = fixture();
  run("shift.open", { opening: 300000 });
  assert.throws(
    () =>
      run("payment.create", {
        orderId: o.id,
        cash: 120000,
        goldWeight: 1,
        metal: "oro",
        purity: 750,
        rate: 0,
        reason: "Error de digitación",
      }),
    /tarifa.*mayor|mayor.*cero/i,
  );
  assert.equal(s.payments.length, 0);
  assert.equal(D.balance(s, "payment", "oro", 750), 0);
});
test("Las entradas fraccionarias de insumos conservan cantidades decimales limpias", () => {
  const { run } = fixture();
  const m = run("material.save", {
    name: "Rodio de prueba",
    unit: "ml",
    quantity: 0.1,
    unitCost: 10000,
  });
  run("material.restock", {
    id: m.id,
    quantity: 0.2,
    unitCost: 10000,
    note: "Compra de reposición",
  });
  assert.equal(m.quantity, 0.3);
});
test("No se anula como trabajo sin iniciar una orden con insumos ya consumidos", () => {
  const { s, run, o } = fixture();
  const m = run("material.save", {
    name: "Piedra",
    unit: "pieza",
    quantity: 2,
    unitCost: 10000,
  });
  run("material.use", { orderId: o.id, materialId: m.id, quantity: 1 });
  assert.throws(
    () =>
      run("order.cancel", {
        id: o.id,
        reason: "Intento de anular sin revisar consumo",
      }),
    /insumos|producción/i,
  );
  assert.equal(o.status, "received");
  assert.equal(D.balance(s, "custody", "oro", 750, o.id), 3200);
});
