"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { createApp } = require("../server.cjs");
const D = require("../domain.cjs");
async function fixture() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "aurea-apertura-"));
  let app,
    base,
    cookie = "",
    revision = 0;
  async function start() {
    app = createApp({ dataDir });
    await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
    base = "http://127.0.0.1:" + app.server.address().port;
  }
  async function req(route, method = "GET", data, headers = {}) {
    const r = await fetch(base + route, {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        ...headers,
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    if (r.headers.get("set-cookie"))
      cookie = r.headers.get("set-cookie").split(";")[0];
    return { status: r.status, body: await r.json() };
  }
  async function state() {
    const r = await req("/api/state");
    assert.equal(r.status, 200);
    revision = r.body.state.revision;
    return r.body.state;
  }
  async function act(action, data, expected = 200) {
    const r = await req(
      "/api/action",
      "POST",
      { action, data },
      { "If-Match": String(revision), "Idempotency-Key": randomUUID() },
    );
    assert.equal(r.status, expected, JSON.stringify(r.body));
    if (r.status === 200) revision = r.body.revision;
    return r.body.result;
  }
  await start();
  const setup = await req("/api/setup", "POST", {
    workshop: "Aperturas de prueba",
    name: "Administrador",
    username: "admin",
    password: "1234",
  });
  assert.equal(setup.status, 201);
  await state();
  for (const p of [750, 585])
    await act("inventory.adjust", {
      account: "own",
      metal: "oro",
      purity: p,
      weight: 20,
      reason: "Existencia inicial verificada",
    });
  return {
    act,
    state,
    req,
    restart: async () => {
      await new Promise((r) => app.server.close(r));
      await start();
    },
    stop: async () => {
      await new Promise((r) => app.server.close(r));
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
}
test("Apertura solo en oro conserva patrimonio y se reconcilia junto con oro cobrado de la misma ley", async () => {
  const f = await fixture();
  try {
    await f.act("settings.save", {
      name: "Aperturas de prueba",
      goldRate: 610000,
      silverRate: 0,
      platinumRate: 0,
      taxPercent: 0,
      lossNormal: 2,
      lossWarning: 3.5,
      tolerance: 0.005,
      printWidth: 80,
      baudRate: 9600,
      reason: "Tarifa",
    });
    const shift = await f.act("shift.open", {
      mode: "gold",
      opening: 0,
      openingGold: [{ purity: 750, weight: 5.2 }],
    });
    assert.equal(shift.openingMode, "gold");
    assert.equal(shift.openingGold[0].fineUg, 3900000);
    let s = await f.state();
    assert.equal(D.balance(s, "own", "oro", 750), 14800);
    assert.equal(D.balance(s, "cashGold", "oro", 750), 5200);
    assert.equal(s.payments.length, 0);
    assert.equal(D.cashExpected(s, s.shifts[0]), 0);
    const client = await f.act("client.save", { name: "Cliente" }),
      o = await f.act("order.create", {
        clientId: client.id,
        type: "Reparación",
        description: "Trabajo",
        condition: "Pieza revisada",
        metal: "oro",
        purity: 750,
        receivedWeight: 3,
        labor: 60000,
        dueDate: "2026-11-30",
      });
    await f.act("payment.create", {
      orderId: o.id,
      goldWeight: 0.1,
      metal: "oro",
      purity: 750,
    });
    s = await f.state();
    const gold = D.cashMetals(s);
    assert.equal(gold.length, 1);
    assert.equal(gold[0].mg, 5300);
    assert.equal(gold[0].openingMg, 5200);
    assert.equal(gold[0].receivedMg, 100);
    await f.act("shift.close", {
      counted: 0,
      receiver: "Bodega",
      goldCounts: [{ metal: "oro", purity: 750, weight: 5.3 }],
    });
    s = await f.state();
    assert.equal(D.balance(s, "own", "oro", 750), 20100);
    assert.equal(D.cashMetals(s).length, 0);
    D.validateState(s);
  } finally {
    await f.stop();
  }
});
test("Apertura mixta con varias leyes persiste tras reiniciar y registra faltantes de oro", async () => {
  const f = await fixture();
  try {
    const shift = await f.act("shift.open", {
      mode: "mixed",
      opening: 150000,
      openingGold: [
        { purity: 750, weight: 3 },
        { purity: 585, weight: 2 },
      ],
    });
    const before = await f.state();
    await f.restart();
    assert.deepEqual(await f.state(), before);
    const closed = await f.act("shift.close", {
      counted: 150000,
      receiver: "Bodega",
      reason: "Faltante de 0,100 g verificado",
      goldCounts: [
        { metal: "oro", purity: 750, weight: 2.9 },
        { metal: "oro", purity: 585, weight: 2 },
      ],
    });
    assert.equal(closed.review, true);
    assert.equal(closed.goldCounts.length, 2);
    assert.equal(closed.goldCounts[0].openingMg, 2000);
    const s = await f.state();
    assert.equal(D.balance(s, "own", "oro", 750), 19900);
    assert.equal(D.balance(s, "own", "oro", 585), 20000);
    assert.equal(D.cashMetals(s).length, 0);
    assert.equal(s.shifts[0].id, shift.id);
  } finally {
    await f.stop();
  }
});
test("Aperturas inválidas no crean oro, no modifican bodega y no dejan turnos parciales", async () => {
  const f = await fixture();
  try {
    for (const data of [
      { mode: "gold", openingGold: [] },
      { mode: "mixed", opening: 0, openingGold: [{ purity: 750, weight: 1 }] },
      { mode: "cash", opening: 10, openingGold: [{ purity: 750, weight: 1 }] },
      { mode: "gold", opening: 1, openingGold: [{ purity: 750, weight: 1 }] },
      {
        mode: "gold",
        openingGold: [
          { purity: 750, weight: 1 },
          { purity: 585, weight: 21 },
        ],
      },
      {
        mode: "gold",
        openingGold: [
          { purity: 750, weight: 1 },
          { purity: 750, weight: 1 },
        ],
      },
      { mode: "gold", openingGold: [{ purity: 750, weight: -1 }] },
      { mode: "gold", openingGold: [{ purity: 750, weight: 0.0001 }] },
      {
        mode: "gold",
        openingGold: [{ metal: "plata", purity: 925, weight: 1 }],
      },
    ]) {
      const before = await f.state();
      await f.act("shift.open", data, 400);
      assert.deepEqual(await f.state(), before);
    }
    await f.act("shift.open", { opening: 0 });
    const s = await f.state();
    assert.equal(s.shifts[0].openingMode, "cash");
    assert.deepEqual(s.shifts[0].openingGold, []);
  } finally {
    await f.stop();
  }
});
test("El rol de caja puede trasladar oro propio, pero requiere administrador para cerrar con faltante fuera de tolerancia", async () => {
  const f = await fixture();
  try {
    await f.act("user.create", {
      name: "Recepción",
      username: "recepcion",
      password: "1234",
      role: "recepcion",
    });
    await f.req("/api/login", "POST", {
      username: "recepcion",
      password: "1234",
    });
    await f.act("shift.open", {
      mode: "gold",
      openingGold: [{ purity: 750, weight: 3 }],
    });
    const before = await f.state();
    await f.act(
      "shift.close",
      {
        counted: 0,
        receiver: "Bodega",
        reason: "Diferencia",
        goldCounts: [{ metal: "oro", purity: 750, weight: 2.9 }],
      },
      403,
    );
    assert.deepEqual(await f.state(), before);
    await f.act("shift.close", {
      counted: 0,
      receiver: "Bodega",
      goldCounts: [{ metal: "oro", purity: 750, weight: 3 }],
    });
    assert.equal(D.cashMetals(await f.state()).length, 0);
  } finally {
    await f.stop();
  }
});
