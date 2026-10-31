"use strict";
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { createApp } = require("../server.cjs");
const D = require("../domain.cjs");
const folders = [];
after(() => {
  for (const dir of folders) fs.rmSync(dir, { recursive: true, force: true });
});
async function fixture(password = "pruebas-seguras-123", username = "admin") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aurea-test-"));
  folders.push(dir);
  const app = createApp({ dataDir: dir });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + app.server.address().port;
  let cookie = "",
    revision = 0;
  async function request(url, method = "GET", data, headers = {}) {
    const r = await fetch(base + url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        ...headers,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    const c = r.headers.get("set-cookie");
    if (c) cookie = c.split(";")[0];
    return { status: r.status, data: await r.json() };
  }
  async function state() {
    const r = await request("/api/state");
    assert.equal(r.status, 200, JSON.stringify(r.data));
    revision = r.data.state.revision;
    return r.data.state;
  }
  async function action(
    action,
    data = {},
    expected = 200,
    key = randomUUID(),
    rev = revision,
  ) {
    const r = await request(
      "/api/action",
      "POST",
      { action, data },
      { "If-Match": String(rev), "Idempotency-Key": key },
    );
    assert.equal(r.status, expected, JSON.stringify(r.data));
    if (r.status === 200) revision = r.data.revision;
    return r.data.result ?? r.data;
  }
  const setup = await request("/api/setup", "POST", {
    workshop: "Taller de pruebas",
    name: "Admin Pruebas",
    username,
    password,
  });
  assert.equal(setup.status, 201);
  await state();
  await action("settings.save", {
    name: "Taller de pruebas",
    goldRate: 610000,
    silverRate: 6000,
    platinumRate: 180000,
    taxPercent: 0,
    lossNormal: 2,
    lossWarning: 3.5,
    tolerance: 0.005,
    printWidth: 80,
    baudRate: 9600,
    reason: "Tarifas fijadas para pruebas controladas",
  });
  return {
    ...app,
    base,
    request,
    action,
    state,
    stop: () => new Promise((resolve) => app.server.close(resolve)),
    setCookie: (v) => (cookie = v),
  };
}
const clientData = {
  name: "Ana Joyera",
  document: "101001",
  phone: "573101234567",
  email: "ana@example.test",
  notes: "Cliente de pruebas",
};
const orderData = (clientId) => ({
  clientId,
  type: "Fabricación",
  description: "Argollas 18k",
  condition: "Retal sin piedras, verificado",
  notes: "Talla 12",
  metal: "oro",
  purity: 750,
  receivedWeight: 5.2,
  dueDate: "2026-11-02",
  labor: 450000,
  materialPrice: 10000,
  goldPrice: 900000,
  taxPercent: 19,
});
async function baseData(f) {
  const c = await f.action("client.save", clientData),
    smith = await f.action("smith.save", {
      name: "Pedro Orfebre",
      bench: "Mesa 1",
    });
  await f.action("inventory.adjust", {
    account: "own",
    metal: "oro",
    purity: 750,
    weight: 100,
    reason: "Saldo inicial pesado y verificado",
  });
  return { c, smith };
}

test("Contraseñas simples de cuatro caracteres permiten registro, acceso, cambio y creación de usuarios", async () => {
  const f = await fixture("1234");
  try {
    await f.request("/api/logout", "POST", {});
    const login = await f.request("/api/login", "POST", {
      username: "admin",
      password: "1234",
    });
    assert.equal(login.status, 200);
    const tooShort = await f.request("/api/password", "POST", {
      current: "1234",
      password: "123",
    });
    assert.equal(tooShort.status, 400);
    assert.match(tooShort.data.error, /4 caracteres/);
    const changed = await f.request("/api/password", "POST", {
      current: "1234",
      password: "abcd",
    });
    assert.equal(changed.status, 200);
    await f.request("/api/logout", "POST", {});
    assert.equal(
      (
        await f.request("/api/login", "POST", {
          username: "admin",
          password: "abcd",
        })
      ).status,
      200,
    );
    await f.action("user.create", {
      name: "Usuario simple",
      username: "simple",
      role: "consulta",
      password: "4321",
    });
    await f.request("/api/logout", "POST", {});
    assert.equal(
      (
        await f.request("/api/login", "POST", {
          username: "simple",
          password: "4321",
        })
      ).status,
      200,
    );
  } finally {
    await f.stop();
  }
});

test("El administrador y los nuevos usuarios pueden registrarse e iniciar sesión con su correo", async () => {
  const f = await fixture("1234", "admin.taller+prueba@example.test");
  try {
    await f.request("/api/logout", "POST", {});
    assert.equal(
      (
        await f.request("/api/login", "POST", {
          username: " ADMIN.TALLER+PRUEBA@EXAMPLE.TEST ",
          password: "1234",
        })
      ).status,
      200,
    );
    await f.action("user.create", {
      name: "Recepción por correo",
      username: "recepcion@example.test",
      role: "recepcion",
      password: "abcd",
    });
    await f.action(
      "user.create",
      {
        name: "Duplicado",
        username: "RECEPCION@EXAMPLE.TEST",
        role: "consulta",
        password: "abcd",
      },
      400,
    );
    await f.action(
      "user.create",
      {
        name: "Inválido",
        username: "correo@invalido",
        role: "consulta",
        password: "abcd",
      },
      400,
    );
    await f.request("/api/logout", "POST", {});
    assert.equal(
      (
        await f.request("/api/login", "POST", {
          username: "recepcion@example.test",
          password: "abcd",
        })
      ).status,
      200,
    );
  } finally {
    await f.stop();
  }
});

test("Fabricación mixta: custodia y oro propio, consumo, retorno, abonos y entrega sin duplicar existencias", async () => {
  const f = await fixture();
  try {
    const { c, smith } = await baseData(f),
      o = await f.action("order.create", orderData(c.id));
    await f.action("order.assign", {
      id: o.id,
      smithId: smith.id,
      customerWeight: 5.2,
      ownWeight: 7.2,
      source: "own",
      smithFee: 120000,
    });
    await f.action("order.deliver", { id: o.id, acceptance: "Ana" }, 400);
    const material = await f.action("material.save", {
      name: "Soldadura",
      unit: "porción",
      quantity: 10,
      unitCost: 3000,
      min: 2,
    });
    await f.action("material.use", {
      orderId: o.id,
      materialId: material.id,
      quantity: 2,
    });
    await f.action("order.progress", {
      id: o.id,
      note: "Armado y soldadura completos",
    });
    await f.action("order.return", {
      id: o.id,
      pieceWeight: 11.96,
      scrapWeight: 0.25,
      reason: "Retorno pesado en balanza",
    });
    let s = await f.state(),
      order = s.orders[0];
    assert.equal(order.returned.lossMg, 190);
    assert.equal(
      order.returned.pieces.reduce((v, x) => v + x, 0),
      11960,
    );
    assert.equal(D.balance(s, "process", "oro", 750, o.id), 0);
    assert.equal(D.balance(s, "process", "oro", 750, "taller"), 0);
    await f.action(
      "order.return",
      { id: o.id, pieceWeight: 11.96, scrapWeight: 0.25 },
      400,
    );
    await f.action(
      "order.quality",
      { id: o.id, checks: [true, false, true] },
      400,
    );
    await f.action("order.quality", { id: o.id, checks: [true, true, true] });
    await f.action("order.deliver", { id: o.id, acceptance: "Ana" }, 400);
    await f.action("payment.create", { orderId: o.id, cash: 100000 }, 400);
    await f.action("shift.open", { opening: 300000 });
    const total = D.total(order);
    await f.action("payment.create", { orderId: o.id, cash: 500000 });
    await f.action("payment.create", {
      orderId: o.id,
      bank: total - 500000,
      bankRef: "TRF-001",
    });
    const delivered = await f.action("order.deliver", {
      id: o.id,
      acceptance: "Ana Joyera · CC 101001",
    });
    assert.match(delivered.invoice, /^V-/);
    s = await f.state();
    assert.equal(D.due(s, s.orders[0]), 0);
    assert(
      s.ledger.every(
        (x) => Number.isSafeInteger(x.mg) && Number.isSafeInteger(x.fineUg),
      ),
    );
    assert(D.balances(s).every((x) => x.mg >= 0));
    assert.equal(
      D.balances(s).filter((x) => x.owner === o.id).length,
      0,
      "No queda metal de esta cliente retenido",
    );
    assert.equal(s.materials[0].quantity, 8);
    assert.equal(D.balance(s, "finished", "oro", 750), 0);
    assert.equal(D.balance(s, "own", "oro", 750), 92800);
    await f.action("order.deliver", { id: o.id, acceptance: "Ana" }, 400);
  } finally {
    await f.stop();
  }
});

test("Cobro con oro: fino sin redondeo prematuro, vueltas, reversión, arqueo y traspaso", async () => {
  const f = await fixture();
  try {
    const c = await f.action("client.save", clientData),
      o = await f.action("order.create", {
        ...orderData(c.id),
        labor: 220000,
        materialPrice: 0,
        goldPrice: 0,
        taxPercent: 0,
      });
    await f.action("shift.open", { opening: 300000 });
    const p = await f.action("payment.create", {
      orderId: o.id,
      goldWeight: 0.65,
      metal: "oro",
      purity: 750,
    });
    assert.equal(
      p.goldValue,
      297375,
      "0.650 × 0.750 × 610000 = 297375, sin redondear fino a 0.488",
    );
    assert.equal(p.change, 77375);
    assert.equal(p.applied, 220000);
    let s = await f.state();
    assert.equal(D.cashExpected(s, s.shifts[0]), 222625);
    assert.equal(D.balance(s, "payment", "oro", 750), 650);
    await f.action("payment.void", {
      id: p.id,
      reason: "Cliente devuelve vueltas y retira el arete",
    });
    s = await f.state();
    assert.equal(D.paid(s, s.orders[0]), 0);
    assert.equal(D.cashExpected(s, s.shifts[0]), 300000);
    assert.equal(D.balance(s, "payment", "oro", 750), 0);
    const second = await f.action("payment.create", {
      orderId: o.id,
      goldWeight: 0.65,
      metal: "oro",
      purity: 750,
    });
    await f.action(
      "shift.close",
      { counted: 222625, receiver: "Bodeguero", goldCounts: [] },
      400,
    );
    const shift = await f.action("shift.close", {
      counted: 222625,
      receiver: "Bodeguero",
      goldCounts: [{ metal: "oro", purity: 750, weight: 0.65 }],
    });
    assert.equal(shift.review, false);
    s = await f.state();
    assert.equal(D.balance(s, "payment", "oro", 750), 0);
    assert.equal(D.balance(s, "own", "oro", 750), 650);
    await f.action(
      "payment.void",
      { id: second.id, reason: "Intento tardío" },
      400,
    );
  } finally {
    await f.stop();
  }
});

test("Compras, pagos de proveedor, fundición, producción propia y transferencia de piezas", async () => {
  const f = await fixture();
  try {
    const supplier = await f.action("supplier.save", {
      name: "Refinadora",
      document: "900001",
      phone: "3100000000",
    });
    const p = await f.action("purchase.create", {
      supplierId: supplier.id,
      document: "FA-1",
      metal: "oro",
      purity: 1000,
      weight: 15,
      rate: 500000,
      dueDate: "2026-11-15",
    });
    assert.equal(p.total, 7500000);
    await f.action(
      "purchase.create",
      {
        supplierId: supplier.id,
        document: "FA-1",
        metal: "oro",
        purity: 1000,
        weight: 15,
        rate: 500000,
        dueDate: "2026-11-15",
      },
      400,
    );
    await f.action("supplier.pay", {
      id: p.id,
      amount: 1000000,
      method: "bank",
      reference: "Banco-001",
    });
    await f.action(
      "supplier.pay",
      { id: p.id, amount: 8000000, method: "bank", reference: "Exceso" },
      400,
    );
    const melt = await f.action("melt.create", {
      source: "own",
      metal: "oro",
      inputPurity: 1000,
      inputWeight: 15,
      alloyWeight: 5,
      outputWeight: 19.88,
      outputPurity: 750,
      notes: "Ensayo 750",
    });
    assert.equal(melt.fineLossUg, 90000);
    const smith = await f.action("smith.save", { name: "Pedro", bench: "1" }),
      o = await f.action("order.create", {
        ...orderData(null),
        type: "Producción propia",
        receivedWeight: 0,
        labor: 0,
        materialPrice: 0,
        goldPrice: 0,
        taxPercent: 0,
      });
    await f.action("order.assign", {
      id: o.id,
      smithId: smith.id,
      customerWeight: 0,
      ownWeight: 15,
      source: "melt",
      smithFee: 360000,
    });
    await f.action("order.return", {
      id: o.id,
      pieceWeight: 14.48,
      scrapWeight: 0.31,
      reason: "Retorno pesado",
    });
    await f.action("order.quality", { id: o.id, checks: [true, true, true] });
    const stock = await f.action("stock.receive", {
      id: o.id,
      quantity: 3,
      cost: 8000000,
      price: 4200000,
    });
    assert.equal(stock.available, 3);
    await f.action("stock.transfer", {
      id: stock.id,
      quantity: 1,
      weight: 4.8,
      destination: "Joyería receptora · María",
    });
    let s = await f.state();
    assert.equal(s.stock[0].available, 2);
    assert.equal(s.stock[0].remainingMg, 9680);
    await f.action(
      "stock.transfer",
      {
        id: stock.id,
        quantity: 2,
        weight: 8,
        destination: "Joyería receptora · María",
      },
      400,
    );
    await f.action("stock.transfer", {
      id: stock.id,
      quantity: 2,
      weight: 9.68,
      destination: "Joyería receptora · María",
    });
    s = await f.state();
    assert.equal(s.stock[0].available, 0);
    assert.equal(D.balance(s, "finished", "oro", 750), 0);
    assert(D.balances(s).every((x) => x.mg >= 0));
  } finally {
    await f.stop();
  }
});

test("Fallos atómicos, concurrencia, idempotencia y protección del servidor", async () => {
  const f = await fixture();
  try {
    const { c, smith } = await baseData(f),
      o = await f.action("order.create", orderData(c.id));
    let s = await f.state(),
      before = JSON.stringify(s);
    await f.action(
      "order.assign",
      {
        id: o.id,
        smithId: smith.id,
        customerWeight: 5.2,
        ownWeight: 500,
        source: "own",
      },
      400,
    );
    s = await f.state();
    assert.equal(
      JSON.stringify(s),
      before,
      "Fallo revierte también la salida de custodia",
    );
    const rev = s.revision,
      key = randomUUID(),
      data = { opening: 100000 };
    const first = await f.action("shift.open", data, 200, key, rev),
      repeat = await f.action("shift.open", data, 200, key, rev);
    assert.equal(first.id, repeat.id);
    s = await f.state();
    assert.equal(s.shifts.length, 1);
    await f.action(
      "cash.entry",
      { type: "income", amount: 10, note: "Antiguo" },
      409,
      randomUUID(),
      rev,
    );
    await f.action(
      "cash.entry",
      { type: "income", amount: 10, note: "Diferente" },
      409,
      key,
    );
    await f.action(
      "inventory.adjust",
      {
        account: "own",
        metal: "oro",
        purity: 750,
        weight: 1.2345,
        reason: "Precisión inválida",
      },
      400,
    );
    for (const url of [
      "/server.cjs",
      "/domain.cjs",
      "/data/taller.sqlite",
      "/%2e%2e/domain.cjs",
    ]) {
      const r = await fetch(f.base + url);
      assert.equal(r.status, 404, url);
    }
    const cross = await f.request(
      "/api/action",
      "POST",
      {
        action: "cash.entry",
        data: { type: "income", amount: 100, note: "Cruzado" },
      },
      {
        Origin: "https://evil.test",
        "If-Match": String(s.revision),
        "Idempotency-Key": randomUUID(),
      },
    );
    assert.equal(cross.status, 403);
  } finally {
    await f.stop();
  }
});

test("Roles: restricciones reales, diferencias autorizadas y usuarios desactivados", async () => {
  const f = await fixture();
  try {
    const { c, smith } = await baseData(f),
      o = await f.action("order.create", orderData(c.id));
    await f.action("order.assign", {
      id: o.id,
      smithId: smith.id,
      customerWeight: 5.2,
      ownWeight: 0,
    });
    const u = await f.action("user.create", {
      name: "Recepción",
      username: "recepcion",
      role: "recepcion",
      password: "recepcion-segura-123",
    });
    await f.action("user.create", {
      name: "Producción",
      username: "produccion",
      role: "produccion",
      password: "produccion-segura-123",
    });
    await f.request("/api/login", "POST", {
      username: "recepcion",
      password: "recepcion-segura-123",
    });
    await f.action(
      "inventory.adjust",
      {
        account: "own",
        metal: "oro",
        purity: 750,
        weight: 1,
        reason: "Sin permiso",
      },
      403,
    );
    await f.action("settings.save", {}, 403);
    await f.action("user.create", {}, 403);
    await f.action("shift.open", { opening: 100000 });
    await f.action(
      "shift.close",
      { counted: 90000, goldCounts: [], reason: "Faltante" },
      403,
    );
    await f.request("/api/login", "POST", {
      username: "produccion",
      password: "produccion-segura-123",
    });
    await f.action(
      "order.return",
      { id: o.id, pieceWeight: 4, scrapWeight: 0.1, reason: "Merma crítica" },
      403,
    );
    await f.request("/api/login", "POST", {
      username: "admin",
      password: "pruebas-seguras-123",
    });
    await f.action("order.return", {
      id: o.id,
      pieceWeight: 4,
      scrapWeight: 0.1,
      reason: "Merma crítica autorizada con incidente",
    });
    await f.action("user.update", {
      id: u.id,
      name: u.name,
      role: u.role,
      active: "false",
    });
    const login = await f.request("/api/login", "POST", {
      username: "recepcion",
      password: "recepcion-segura-123",
    });
    assert.equal(login.status, 401);
    const closed = await f.action("shift.close", {
      counted: 90000,
      goldCounts: [],
      reason: "Incidente de diferencia documentado",
    });
    assert.equal(closed.review, true);
    assert.equal(closed.difference, -10000);
  } finally {
    await f.stop();
  }
});

test("Persistencia tras reinicio y restauración de copia con historial y contraseñas conservadas", async () => {
  const f = await fixture();
  let stopped = false;
  try {
    await f.action("client.save", clientData);
    const copy = await f.request("/api/backup");
    assert.equal(copy.status, 200);
    await f.action("client.save", {
      ...clientData,
      name: "Otra cliente",
      document: "202002",
    });
    const bad = structuredClone(copy.data);
    bad.state.clients = [];
    await f.action(
      "backup.restore",
      { backup: bad, password: "pruebas-seguras-123" },
      400,
    );
    await f.action(
      "backup.restore",
      { backup: copy.data, password: "incorrecta" },
      403,
    );
    await f.action("backup.restore", {
      backup: copy.data,
      password: "pruebas-seguras-123",
    });
    let s = await f.state();
    assert.equal(s.clients.length, 1);
    const full = await f.request("/api/state");
    assert(full.data.audit.some((x) => x.action.startsWith("restaurado.")));
    assert(
      fs
        .readdirSync(path.join(f.dataDir, "backups"))
        .some((x) => x.startsWith("antes-de-restaurar")),
    );
    await f.stop();
    stopped = true;
    const reopened = createApp({ dataDir: f.dataDir });
    await new Promise((resolve) =>
      reopened.server.listen(0, "127.0.0.1", resolve),
    );
    try {
      const base = "http://127.0.0.1:" + reopened.server.address().port;
      const login = await fetch(base + "/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "admin",
          password: "pruebas-seguras-123",
        }),
      });
      assert.equal(login.status, 200);
      const r = await fetch(base + "/api/state", {
        headers: { Cookie: login.headers.get("set-cookie").split(";")[0] },
      });
      const data = await r.json();
      assert.equal(data.state.clients[0].name, "Ana Joyera");
    } finally {
      await new Promise((resolve) => reopened.server.close(resolve));
    }
  } finally {
    if (!stopped) await f.stop();
  }
});

test("Devolución de anticipo en un turno posterior y anulación de orden sin perder trazabilidad", async () => {
  const f = await fixture();
  try {
    const c = await f.action("client.save", clientData),
      o = await f.action("order.create", {
        ...orderData(c.id),
        labor: 100000,
        materialPrice: 0,
        goldPrice: 0,
        taxPercent: 0,
      });
    await f.action("shift.open", { opening: 0 });
    const p = await f.action("payment.create", { orderId: o.id, cash: 100000 });
    await f.action("shift.close", { counted: 100000, goldCounts: [] });
    await f.action("shift.open", { opening: 100000 });
    await f.action(
      "payment.refund",
      { orderId: o.id, cash: 150000, reason: "Exceso" },
      400,
    );
    const r = await f.action("payment.refund", {
      orderId: o.id,
      cash: 100000,
      reason: "Cliente cancela el trabajo; anticipo devuelto",
    });
    assert.equal(r.applied, -100000);
    await f.action("payment.void", { id: r.id, reason: "No permitido" }, 400);
    await f.action("payment.void", { id: p.id, reason: "No permitido" }, 400);
    await f.action("order.cancel", {
      id: o.id,
      reason: "Cliente retira la pieza y cancela la fabricación",
    });
    const s = await f.state();
    assert.equal(D.paid(s, s.orders[0]), 0);
    assert.equal(s.orders[0].status, "cancelled");
    assert.equal(D.balances(s).filter((x) => x.owner === o.id).length, 0);
    assert.equal(
      D.cashExpected(
        s,
        s.shifts.find((x) => !x.closedAt),
      ),
      0,
    );
  } finally {
    await f.stop();
  }
});

test("Distribución de retornos conserva peso y propiedad con leyes libres y miligramos impares", () => {
  const a = { name: "Auditor", role: "admin" };
  for (let n = 1; n <= 75; n++) {
    const s = D.initialState(),
      m = ["oro", "plata", "platino"][n % 3],
      p = [417, 585, 712, 750, 925, 999][n % 6],
      customer = 1 + ((n * 173) % 17000),
      own = 1 + ((n * 97) % 21000),
      base = customer + own,
      piece = Math.floor(base * 0.945),
      scrap = Math.floor(base * 0.039),
      run = (action, data) => D.execute(s, action, data, a);
    const c = run("client.save", { name: "Cliente " + n }),
      smith = run("smith.save", { name: "Orfebre" });
    run("inventory.adjust", {
      account: "own",
      metal: m,
      purity: p,
      weight: own / 1000,
      reason: "Saldo inicial",
    });
    const o = run("order.create", {
      ...orderData(c.id),
      metal: m,
      purity: p,
      receivedWeight: customer / 1000,
      labor: 0,
      materialPrice: 0,
      goldPrice: 0,
      taxPercent: 0,
    });
    run("order.assign", {
      id: o.id,
      smithId: smith.id,
      customerWeight: customer / 1000,
      ownWeight: own / 1000,
    });
    run("order.return", {
      id: o.id,
      pieceWeight: piece / 1000,
      scrapWeight: scrap / 1000,
      reason: "Retorno verificado",
    });
    assert.equal(
      o.returned.pieces.reduce((v, x) => v + x, 0),
      piece,
    );
    assert.equal(
      o.returned.scraps.reduce((v, x) => v + x, 0),
      scrap,
    );
    assert.equal(D.balance(s, "process", m, p, o.id), 0);
    assert.equal(D.balance(s, "process", m, p), 0);
    assert(D.balances(s).every((x) => x.mg >= 0));
    run("order.quality", { id: o.id, checks: [true, true, true] });
    run("order.deliver", { id: o.id, acceptance: "Cliente " + n });
    assert.equal(D.balances(s).filter((x) => x.owner === o.id).length, 0);
  }
});

test("Validaciones de fechas, precios extremos, fotografía y roles no admitidos", async () => {
  const f = await fixture();
  try {
    const c = await f.action("client.save", clientData);
    await f.action(
      "order.create",
      { ...orderData(c.id), dueDate: "2026-02-30" },
      400,
    );
    await f.action(
      "order.create",
      { ...orderData(c.id), photo: "javascript:alert(1)" },
      400,
    );
    await f.action(
      "order.create",
      { ...orderData(c.id), labor: 1000000000000, goldPrice: 1000000000000 },
      400,
    );
    await f.action(
      "user.create",
      {
        name: "Inválido",
        username: "invalido",
        password: "pruebas-seguras-123",
        role: "toString",
      },
      400,
    );
    const supplier = await f.action("supplier.save", { name: "Proveedor" });
    await f.action(
      "purchase.create",
      {
        supplierId: supplier.id,
        document: "EXTREMO",
        dueDate: "2026-11-01",
        metal: "oro",
        purity: 1000,
        weight: 1000000,
        rate: 1000000000000,
      },
      400,
    );
    const s = await f.state();
    assert.equal(s.orders.length, 0);
    assert.equal(s.purchases.length, 0);
    assert.equal(s.ledger.length, 0);
  } finally {
    await f.stop();
  }
});
