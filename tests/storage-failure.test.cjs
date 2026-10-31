"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { createApp } = require("../server.cjs");
test("Al agotar el espacio SQLite se conserva el estado y se puede guardar tras recuperar capacidad", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aurea-sin-espacio-"));
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
      workshop: "Almacenamiento",
      name: "Admin",
      username: "admin",
      password: "1234",
    }),
  });
  const Cookie = setup.headers.get("set-cookie").split(";")[0];
  const state = async () =>
    (await (await fetch(base + "/api/state", { headers: { Cookie } })).json())
      .state;
  const act = async (action, data) =>
    fetch(base + "/api/action", {
      method: "POST",
      headers: {
        Cookie,
        "Content-Type": "application/json",
        "If-Match": String((await state()).revision),
        "Idempotency-Key": randomUUID(),
      },
      body: JSON.stringify({ action, data }),
    });
  const client = (
    await (await act("client.save", { name: "Cliente de prueba" })).json()
  ).result;
  const before = await state();
  const pages = app.db.prepare("PRAGMA page_count").get().page_count;
  app.db.exec("PRAGMA max_page_count=" + pages);
  const order = {
    clientId: client.id,
    type: "Reparación",
    description: "Orden que no debe quedar parcial",
    condition: "Sin piedras",
    metal: "oro",
    purity: 750,
    receivedWeight: 1,
    labor: 1000,
    dueDate: "2026-11-30",
    photo: "data:image/jpeg;base64," + "A".repeat(700000),
  };
  const originalError = console.error,
    captured = [];
  console.error = (e) =>
    captured.push({ message: e.message, code: e.code, errcode: e.errcode });
  let failed;
  try {
    failed = await act("order.create", order);
  } finally {
    console.error = originalError;
  }
  assert.equal(failed.status, 507);
  assert.match((await failed.json()).error, /espacio.*vuelve a intentar/);
  assert.deepEqual(captured, []);
  assert.deepEqual(await state(), before);
  assert.equal(app.db.prepare("PRAGMA quick_check").get().quick_check, "ok");
  app.db.exec("PRAGMA max_page_count=1000000");
  assert.equal((await act("order.create", order)).status, 200);
  assert.equal((await state()).orders.length, 1);
});
