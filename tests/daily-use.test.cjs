"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { createApp } = require("../server.cjs");
const D = require("../domain.cjs");

test("Dos operadores cobrando la misma orden simultáneamente no duplican dinero ni abonos", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aurea-concurrente-")),
    app = createApp({ dataDir: dir });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + app.server.address().port;
  try {
    let revision = 0;
    const users = {};
    async function request(url, method = "GET", data, cookie = "") {
      const response = await fetch(base + url, {
        method,
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: data ? JSON.stringify(data) : undefined,
      });
      return {
        status: response.status,
        body: await response.json(),
        cookie: response.headers.get("set-cookie")?.split(";")[0],
      };
    }
    const setup = await request("/api/setup", "POST", {
      workshop: "Caja compartida",
      name: "Administrador",
      username: "admin",
      password: "1234",
    });
    users.admin = setup.cookie;
    revision = 1;
    async function act(action, data, role = "admin", rev = revision) {
      const response = await fetch(base + "/api/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: users[role],
          "If-Match": String(rev),
          "Idempotency-Key": randomUUID(),
        },
        body: JSON.stringify({ action, data }),
      });
      const body = await response.json();
      if (response.status === 200) revision = body.revision;
      return { status: response.status, body };
    }
    await act("user.create", {
      name: "Segunda recepción",
      username: "recepcion",
      role: "recepcion",
      password: "1234",
    });
    users.recepcion = (
      await request("/api/login", "POST", {
        username: "recepcion",
        password: "1234",
      })
    ).cookie;
    const client = (await act("client.save", { name: "Cliente concurrente" }))
      .body.result;
    const order = (
      await act("order.create", {
        clientId: client.id,
        type: "Reparación",
        description: "Reparación compartida",
        condition: "Sin piedras",
        metal: "oro",
        purity: 750,
        receivedWeight: 3.2,
        labor: 120000,
        dueDate: "2026-11-30",
      })
    ).body.result;
    await act("shift.open", { opening: 0 });
    const sameRevision = revision;
    const result = await Promise.all([
      act(
        "payment.create",
        { orderId: order.id, cash: 120000 },
        "admin",
        sameRevision,
      ),
      act(
        "payment.create",
        { orderId: order.id, cash: 120000 },
        "recepcion",
        sameRevision,
      ),
    ]);
    assert.deepEqual(result.map((x) => x.status).sort(), [200, 409]);
    const s = (await request("/api/state", "GET", undefined, users.admin)).body
      .state;
    revision = s.revision;
    assert.equal(s.payments.length, 1);
    assert.equal(D.cashExpected(s, s.shifts[0]), 120000);
    assert.equal(D.due(s, s.orders[0]), 0);
    assert.equal(
      (
        await act(
          "payment.create",
          { orderId: order.id, cash: 120000 },
          "recepcion",
        )
      ).status,
      400,
    );
    const after = (await request("/api/state", "GET", undefined, users.admin))
      .body.state;
    assert.deepEqual(after, s);
  } finally {
    await new Promise((r) => app.server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("Cinco jornadas de taller con recepción, producción, caja, roles, reinicio y conciliación independiente", async (t) => {
  t.mock.timers.enable({
    apis: ["Date"],
    now: Date.parse("2026-11-02T13:00:00Z"),
  });
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "aurea-jornadas-"));
  let app,
    base,
    revision = 0,
    carry = 1000000;
  const cookies = {},
    stats = {
      days: 5,
      attempts: 0,
      blocked: 0,
      receipts: 0,
      deliveries: 0,
      cancellations: 0,
      stockLots: 0,
      restarts: 0,
    };
  const names = {
    admin: "Administración",
    recepcion: "Recepción",
    produccion: "Orfebrería",
    contador: "Contabilidad",
  };
  async function start() {
    app = createApp({ dataDir });
    await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
    base = "http://127.0.0.1:" + app.server.address().port;
  }
  async function request(
    url,
    method = "GET",
    data,
    role = "admin",
    headers = {},
  ) {
    const r = await fetch(base + url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: cookies[role] || "",
        ...headers,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    const cookie = r.headers.get("set-cookie");
    if (cookie) cookies[role] = cookie.split(";")[0];
    return { status: r.status, data: await r.json() };
  }
  async function state() {
    const r = await request("/api/state");
    assert.equal(r.status, 200, JSON.stringify(r.data));
    revision = r.data.state.revision;
    return r.data.state;
  }
  async function act(
    action,
    data = {},
    role = "admin",
    expected = 200,
    key = randomUUID(),
  ) {
    stats.attempts++;
    const r = await request("/api/action", "POST", { action, data }, role, {
      "If-Match": String(revision),
      "Idempotency-Key": key,
    });
    assert.equal(
      r.status,
      expected,
      `${action} (${role}): ${JSON.stringify(r.data)}`,
    );
    if (r.status === 200) revision = r.data.revision;
    else stats.blocked++;
    t.mock.timers.tick(700);
    return r.data.result;
  }
  async function loginAll() {
    for (const role of Object.keys(names)) {
      const r = await request(
        "/api/login",
        "POST",
        { username: role, password: "1234" },
        role,
      );
      assert.equal(r.status, 200);
    }
  }
  const tariff = (day, m) =>
    m === "oro"
      ? 610000 + day * 1000
      : m === "plata"
        ? 5000 + day * 100
        : 180000 + day * 1000;
  async function settings(day) {
    return act("settings.save", {
      name: "Taller de simulación",
      goldRate: tariff(day, "oro"),
      silverRate: tariff(day, "plata"),
      platinumRate: tariff(day, "platino"),
      taxPercent: 0,
      lossNormal: 2,
      lossWarning: 3.5,
      tolerance: 0.005,
      printWidth: 80,
      baudRate: 9600,
      reason: "Tarifas de la jornada " + (day + 1),
    });
  }
  const backlog = [],
    fees = new Map();
  let clients = [],
    smiths = [],
    supplier,
    material;
  try {
    await start();
    const setup = await request("/api/setup", "POST", {
      workshop: "Taller de simulación",
      name: names.admin,
      username: "admin",
      password: "1234",
    });
    assert.equal(setup.status, 201);
    await state();
    for (const role of ["recepcion", "produccion", "contador"])
      await act("user.create", {
        name: names[role],
        username: role,
        password: "1234",
        role,
      });
    await loginAll();
    await settings(0);
    for (let i = 0; i < 12; i++)
      clients.push(
        await act(
          "client.save",
          {
            name: "Cliente simulado " + (i + 1),
            document: "SIM-" + i,
            phone: "57310000" + String(i).padStart(4, "0"),
          },
          "recepcion",
        ),
      );
    for (let i = 0; i < 2; i++) {
      const x = await act(
        "smith.save",
        { name: "Orfebre " + (i + 1), bench: "Banco " + (i + 1) },
        "produccion",
      );
      smiths.push(x);
      fees.set(x.id, 0);
    }
    material = await act(
      "material.save",
      {
        name: "Insumo de prueba",
        unit: "porción",
        quantity: 1000,
        unitCost: 1000,
        min: 10,
      },
      "produccion",
    );
    supplier = await act(
      "supplier.save",
      { name: "Refinadora de simulación", document: "SIM-PROVEEDOR" },
      "contador",
    );
    for (const [metal, purity, weight] of [
      ["oro", 750, 500],
      ["plata", 925, 1000],
      ["platino", 950, 50],
      ["oro", 1000, 50],
    ])
      await act("inventory.adjust", {
        account: "own",
        metal,
        purity,
        weight,
        reason: "Apertura física verificada",
      });
    const purchase = await act(
      "purchase.create",
      {
        supplierId: supplier.id,
        document: "FA-SIM-01",
        metal: "oro",
        purity: 750,
        weight: 50,
        rate: 600000,
        dueDate: "2026-11-30",
      },
      "contador",
    );

    for (let day = 0; day < 5; day++) {
      if (day) {
        t.mock.timers.tick(86400000);
        await loginAll();
        await state();
        await settings(day);
      }
      await act("shift.open", { opening: carry }, "recepcion");
      let cash = carry;
      const metals = new Map();
      const currentDate = D.day();
      async function complete(entry) {
        let o = entry.order;
        const assigned = o.receivedMg + entry.ownMg;
        await act(
          "order.assign",
          {
            id: o.id,
            smithId: entry.smithId,
            customerWeight: o.receivedMg / 1000,
            ownWeight: entry.ownMg / 1000,
            smithFee: 10000,
          },
          "produccion",
        );
        if (entry.extra) {
          await act(
            "order.addMetal",
            {
              id: o.id,
              weight: 0.05,
              source: "own",
              reason: "Refuerzo autorizado del broche",
            },
            "produccion",
          );
          o = await act(
            "order.edit",
            {
              id: o.id,
              description: o.description,
              notes: o.notes,
              dueDate: o.dueDate,
              priority: o.priority,
              labor: o.labor,
              materialPrice: o.materialPrice,
              goldPrice:
                o.goldPrice +
                Math.round((50 * o.purity * tariff(day, o.metal)) / 1e6),
              taxPercent: o.taxPercent,
              reason: "Aporte adicional aprobado",
            },
            "recepcion",
          );
        }
        const baseMg = assigned + (entry.extra ? 50 : 0),
          scrapMg = Math.floor(baseMg * 0.01),
          lossMg = Math.max(1, Math.floor(baseMg * 0.01)),
          pieceMg = baseMg - scrapMg - lossMg;
        await act(
          "order.progress",
          { id: o.id, note: "Soldadura, ajuste y pulido completados" },
          "produccion",
        );
        const before = await state();
        await act(
          "order.return",
          { id: o.id, pieceWeight: (baseMg + 1) / 1000, scrapWeight: 0 },
          "produccion",
          400,
        );
        assert.deepEqual(await state(), before);
        await act(
          "order.return",
          {
            id: o.id,
            pieceWeight: pieceMg / 1000,
            scrapWeight: scrapMg / 1000,
          },
          "produccion",
        );
        fees.set(entry.smithId, fees.get(entry.smithId) + 10000);
        await act(
          "order.quality",
          {
            id: o.id,
            checks: [true, true, true],
            note: "Verificación de medidas y ensambles",
          },
          "produccion",
        );
        await act(
          "order.deliver",
          { id: o.id, acceptance: "Cliente" },
          "recepcion",
          400,
        );
        const remaining = D.due(
          await state(),
          (await state()).orders.find((x) => x.id === o.id),
        );
        let body = { orderId: o.id },
          deltaCash = 0;
        if (entry.method === 0) {
          body.cash = remaining + 5000;
          deltaCash = remaining;
        } else if (entry.method === 1) {
          body.bank = remaining;
          body.bankRef = "TRF-" + o.code;
        } else {
          const mg = 100,
            value = Math.round((mg * o.purity * tariff(day, o.metal)) / 1e6);
          body = {
            ...body,
            goldWeight: mg / 1000,
            metal: o.metal,
            purity: o.purity,
            cash: remaining - value + 5000,
          };
          deltaCash = remaining - value;
          const key = o.metal + "|" + o.purity;
          metals.set(key, (metals.get(key) || 0) + mg);
        }
        const key = randomUUID(),
          paid = await act("payment.create", body, "recepcion", 200, key);
        cash += deltaCash;
        const repeated = await act(
          "payment.create",
          body,
          "recepcion",
          200,
          key,
        );
        assert.equal(repeated.id, paid.id);
        await act(
          "order.deliver",
          { id: o.id, acceptance: "Cliente simulado · soporte de retiro" },
          "recepcion",
        );
        stats.deliveries++;
      }
      const waiting = backlog.splice(0);
      for (const entry of waiting) await complete(entry);
      for (let i = 0; i < 12; i++) {
        const metal = i % 7 === 0 ? "platino" : i % 4 === 0 ? "plata" : "oro",
          purity = metal === "oro" ? 750 : metal === "plata" ? 925 : 950,
          ownMg = i % 3 === 0 ? 1000 : 100;
        const o = await act(
          "order.create",
          {
            clientId: clients[(day * 12 + i) % clients.length].id,
            type: i % 3 === 0 ? "Fabricación" : "Reparación",
            description: `Jornada ${day + 1} · Trabajo ${i + 1}`,
            condition: "Pieza pesada, sin faltantes; estado anotado",
            notes: "Medidas y autorización del cliente",
            metal,
            purity,
            receivedWeight: 2 + i * 0.1,
            dueDate: currentDate,
            labor: 80000 + i * 1000,
            materialPrice: 10000,
            goldPrice: Math.round((ownMg * purity * tariff(day, metal)) / 1e6),
          },
          "recepcion",
        );
        stats.receipts++;
        await act(
          "payment.create",
          { orderId: o.id, cash: 20000 },
          "recepcion",
        );
        cash += 20000;
        if (i === 0 || i === 7) {
          await act("payment.refund", {
            orderId: o.id,
            cash: 20000,
            reason: "Cliente cancela antes de iniciar; dinero devuelto",
          });
          cash -= 20000;
          await act(
            "order.cancel",
            { id: o.id, reason: "Cliente retira pieza y cancela el trabajo" },
            "recepcion",
          );
          stats.cancellations++;
          continue;
        }
        if (i % 2 === 0)
          await act(
            "material.use",
            { orderId: o.id, materialId: material.id, quantity: 1 },
            "produccion",
          );
        const entry = {
          order: o,
          ownMg,
          smithId: smiths[i % 2].id,
          method: i % 3,
          extra: i === 2,
        };
        if (i % 5 === 1 && day < 4) backlog.push(entry);
        else await complete(entry);
      }
      const stockOrder = await act(
        "order.create",
        {
          type: "Producción propia",
          description: "Sortijas para vitrina · jornada " + (day + 1),
          condition: "Producción interna",
          metal: "oro",
          purity: 750,
          receivedWeight: 0,
          dueDate: currentDate,
        },
        "recepcion",
      );
      await act(
        "order.assign",
        {
          id: stockOrder.id,
          smithId: smiths[0].id,
          ownWeight: 1,
          customerWeight: 0,
          smithFee: 10000,
        },
        "produccion",
      );
      await act(
        "order.return",
        { id: stockOrder.id, pieceWeight: 0.98, scrapWeight: 0.01 },
        "produccion",
      );
      fees.set(smiths[0].id, fees.get(smiths[0].id) + 10000);
      await act(
        "order.quality",
        { id: stockOrder.id, checks: [true, true, true] },
        "produccion",
      );
      const stock = await act(
        "stock.receive",
        { id: stockOrder.id, quantity: 2, cost: 470000, price: 400000 },
        "produccion",
      );
      stats.stockLots++;
      await act(
        "stock.transfer",
        {
          id: stock.id,
          quantity: 1,
          weight: 0.49,
          destination: "Joyería · recibe persona autorizada",
        },
        "produccion",
      );
      await act(
        "stock.transfer",
        {
          id: stock.id,
          quantity: 1,
          weight: 0.49,
          destination: "Joyería · recibe persona autorizada",
        },
        "produccion",
      );
      await act(
        "supplier.pay",
        {
          id: purchase.id,
          amount: 200000,
          method: "bank",
          reference: "Abono proveedor jornada " + (day + 1),
        },
        "contador",
      );
      await act(
        "cash.entry",
        {
          type: "expense",
          amount: 50000,
          note: "Gastos de operación de la jornada",
        },
        "contador",
      );
      cash -= 50000;
      for (const smith of smiths) {
        const value = fees.get(smith.id);
        if (value) {
          const paid = await act(
            "smith.settle",
            {
              smithId: smith.id,
              method: "cash",
              reference: "Recibido de honorarios jornada " + (day + 1),
            },
            "contador",
          );
          assert.equal(paid.amount, value);
          cash -= value;
          fees.set(smith.id, 0);
        }
      }
      const s = await state(),
        shift = s.shifts.find((x) => !x.closedAt);
      assert.equal(
        D.cashExpected(s, shift),
        cash,
        "Caja coincide con cálculo independiente",
      );
      const actual = D.balances(s).filter((x) => x.account === "payment");
      assert.equal(actual.length, metals.size);
      for (const x of actual)
        assert.equal(x.mg, metals.get(x.metal + "|" + x.purity));
      const counts = [...metals].map(([key, mg]) => ({
        metal: key.split("|")[0],
        purity: Number(key.split("|")[1]),
        weight: mg / 1000,
      }));
      await act(
        "shift.close",
        {
          counted: cash - 100,
          goldCounts: counts,
          receiver: "Bodeguero",
          reason: "Intento con diferencia",
        },
        "recepcion",
        403,
      );
      const difference = day === 2 ? -100 : 0;
      const closed = await act(
        "shift.close",
        {
          counted: cash + difference,
          goldCounts: counts,
          receiver: "Bodeguero",
          reason: difference ? "Diferencia documentada y autorizada" : "",
        },
        difference ? "admin" : "recepcion",
      );
      assert.equal(closed.difference, difference);
      carry = cash + difference;
      const final = await state();
      D.validateState(final);
      assert.equal(
        D.balances(final).filter((x) => x.account === "payment").length,
        0,
      );
      assert(D.balances(final).every((x) => x.mg >= 0));
      assert.equal(
        app.db.prepare("PRAGMA integrity_check").get().integrity_check,
        "ok",
      );
      if (day === 2) {
        await new Promise((r) => app.server.close(r));
        await start();
        stats.restarts++;
        assert.deepEqual(
          await state(),
          final,
          "El reinicio conserva toda la operación",
        );
      }
    }
    const s = await state();
    assert.equal(backlog.length, 0);
    assert.equal(
      s.orders.filter((x) => !["delivered", "cancelled"].includes(x.status))
        .length,
      0,
    );
    assert.equal(D.balances(s).filter((x) => x.owner !== "taller").length, 0);
    assert.equal(
      D.balances(s).filter((x) =>
        ["process", "finished", "payment"].includes(x.account),
      ).length,
      0,
    );
    assert.equal(new Set(s.orders.map((x) => x.code)).size, s.orders.length);
    assert.equal(
      new Set(s.payments.map((x) => x.code)).size,
      s.payments.length,
    );
    assert.equal(s.shifts.length, 5);
    assert.equal(s.stock.length, 5);
    const backup = await request("/api/backup");
    assert.equal(backup.status, 200);
    assert.equal(backup.data.state.orders.length, 65);
    assert.equal(
      fs
        .readdirSync(path.join(dataDir, "backups"))
        .filter((x) => /^taller-/.test(x)).length,
      5,
    );
    fs.mkdirSync(path.join(__dirname, "../test-results"), { recursive: true });
    fs.writeFileSync(
      path.join(__dirname, "../test-results/daily-use.json"),
      JSON.stringify(
        {
          ...stats,
          orders: s.orders.length,
          payments: s.payments.length,
          ledgerMovements: s.ledger.length,
          lastCash: carry,
        },
        null,
        2,
      ),
    );
    console.log(
      "SIMULACIÓN DIARIA: " +
        JSON.stringify({
          ...stats,
          orders: s.orders.length,
          payments: s.payments.length,
          ledgerMovements: s.ledger.length,
        }),
    );
  } finally {
    await new Promise((r) => app.server.close(r));
    fs.rmSync(dataDir, { recursive: true, force: true });
    t.mock.timers.reset();
  }
});
