"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const D = require("../domain.cjs");
const { createApp } = require("../server.cjs");
test(
  "Volumen: 3000 órdenes cobradas conservan caja, copias y consulta completa",
  { timeout: 60000 },
  async (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aurea-volumen-"));
    const app = createApp({ dataDir: dir });
    await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
    t.after(async () => {
      await new Promise((r) => app.server.close(r));
      fs.rmSync(dir, { recursive: true, force: true });
    });
    const base = "http://127.0.0.1:" + app.server.address().port;
    const setup = await fetch(base + "/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workshop: "Volumen",
        name: "Admin",
        username: "admin",
        password: "1234",
      }),
    });
    const Cookie = setup.headers.get("set-cookie").split(";")[0];
    const s = JSON.parse(
      app.db.prepare("SELECT json FROM state WHERE id=1").get().json,
    );
    const a = { name: "Admin", role: "admin" };
    const run = (action, data) => D.execute(s, action, data, a);
    const clients = Array.from({ length: 100 }, (_, i) =>
      run("client.save", {
        name: "Cliente " + i,
        document: String(i).padStart(10, "0"),
      }),
    );
    const shift = run("shift.open", { opening: 1000000 });
    for (let i = 0; i < 3000; i++) {
      const o = run("order.create", {
        clientId: clients[i % clients.length].id,
        type: "Reparación",
        description: "Orden de volumen " + i,
        condition: "Sin piedras",
        metal: "oro",
        purity: 750,
        receivedWeight: 1,
        labor: 1000,
        dueDate: "2026-11-30",
      });
      run("payment.create", { orderId: o.id, cash: 1000 });
    }
    D.validateState(s);
    app.db.prepare("UPDATE state SET json=? WHERE id=1").run(JSON.stringify(s));
    const started = performance.now();
    const response = await fetch(base + "/api/state", { headers: { Cookie } });
    assert.equal(response.status, 200);
    const state = (await response.json()).state;
    const stateMs = Math.round(performance.now() - started);
    assert.equal(state.orders.length, 3000);
    assert.equal(state.payments.length, 3000);
    assert.equal(D.cashExpected(state, shift), 4000000);
    assert.equal(
      D.balance(state, "custody", "oro", 750, state.orders[0].id),
      1000,
    );
    const backupResponse = await fetch(base + "/api/backup", {
      headers: { Cookie },
    });
    assert.equal(backupResponse.status, 200);
    const backup = await backupResponse.json();
    assert.deepEqual(backup.state, state);
    D.validateState(backup.state);
    const mutation = await fetch(base + "/api/action", {
      method: "POST",
      headers: {
        Cookie,
        "Content-Type": "application/json",
        "If-Match": String(state.revision),
        "Idempotency-Key": require("node:crypto").randomUUID(),
      },
      body: JSON.stringify({
        action: "client.save",
        data: {
          id: clients[0].id,
          name: "Cliente actualizado con carga",
          document: clients[0].document,
        },
      }),
    });
    assert.equal(mutation.status, 200);
    const after = (
      await (await fetch(base + "/api/state", { headers: { Cookie } })).json()
    ).state;
    assert.equal(after.orders.length, 3000);
    assert.equal(
      after.clients.find((x) => x.id === clients[0].id).name,
      "Cliente actualizado con carga",
    );
    assert.equal(D.cashExpected(after, shift), 4000000);
    console.log(
      "VOLUMEN: " +
        JSON.stringify({
          orders: 3000,
          payments: 3000,
          stateMs,
          backupBytes: Buffer.byteLength(JSON.stringify(backup)),
        }),
    );
  },
);
