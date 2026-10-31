"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { randomUUID, createHash } = require("node:crypto");
const { createApp } = require("../server.cjs");

async function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aurea-fallos-"));
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
      workshop: "Pruebas destructivas",
      name: "Admin",
      username: "admin",
      password: "1234",
    }),
  });
  assert.equal(setup.status, 201);
  const headers = {
    "Content-Type": "application/json",
    Cookie: setup.headers.get("set-cookie").split(";")[0],
  };
  const state = async () =>
    (await (await fetch(base + "/api/state", { headers })).json()).state;
  const post = async (payload, extra = {}) => {
    const r = await fetch(base + "/api/action", {
      method: "POST",
      headers: {
        ...headers,
        "If-Match": String((await state()).revision),
        "Idempotency-Key": randomUUID(),
        ...extra,
      },
      body: JSON.stringify(payload),
    });
    return { status: r.status, body: await r.json() };
  };
  const act = async (action, data = {}) => {
    const r = await post({ action, data });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.result;
  };
  return { base, headers, state, post, act };
}

test("Entradas numéricas malformadas se rechazan sin guardar ni avanzar la revisión", async (t) => {
  const f = await fixture(t);
  const before = await f.state();
  for (const opening of [
    true,
    false,
    [],
    [123],
    {},
    " ",
    "\t",
    -1,
    0.5,
    "Infinity",
    "NaN",
    "1.234,00",
    1e13,
  ]) {
    const r = await f.post({ action: "shift.open", data: { opening } });
    assert.equal(r.status, 400, JSON.stringify({ opening, ...r }));
    assert.deepEqual(await f.state(), before);
  }
});

test("Solicitudes JSON sin estructura reciben error de cliente y el servidor sigue disponible", async (t) => {
  const f = await fixture(t);
  const before = await f.state();
  for (const payload of [
    null,
    [],
    true,
    "texto",
    { action: "client.save", data: [] },
    { action: "user.update", data: null },
  ]) {
    const r = await f.post(payload);
    assert.equal(r.status, 400, JSON.stringify({ payload, ...r }));
    assert.deepEqual(await f.state(), before);
  }
});

test("Un cierre antiguo no puede cerrar el nuevo turno después de actualizar la revisión", async (t) => {
  const f = await fixture(t);
  const first = await f.act("shift.open", { opening: 1000 });
  await f.act("shift.close", {
    shiftId: first.id,
    counted: 1000,
    goldCounts: [],
  });
  const second = await f.act("shift.open", { opening: 2000 });
  const before = await f.state();
  const r = await f.post({
    action: "shift.close",
    data: { shiftId: first.id, counted: 2000, goldCounts: [] },
  });
  assert.equal(r.status, 409, JSON.stringify(r.body));
  assert.deepEqual(await f.state(), before);
  assert.equal(before.shifts.find((x) => !x.closedAt).id, second.id);
});

test("Treinta cobros simultáneos y reintentos perdidos conservan un único abono", async (t) => {
  const f = await fixture(t);
  const c = await f.act("client.save", { name: "Cliente concurrencia" });
  const o = await f.act("order.create", {
    clientId: c.id,
    type: "Reparación",
    description: "Reparación",
    condition: "Sin piedras",
    metal: "oro",
    purity: 750,
    receivedWeight: 1,
    labor: 100000,
    dueDate: "2026-11-30",
  });
  await f.act("shift.open", { opening: 0 });
  const revision = String((await f.state()).revision);
  const payload = {
    action: "payment.create",
    data: { orderId: o.id, cash: 100000 },
  };
  const key = randomUUID();
  const responses = await Promise.all(
    Array.from({ length: 30 }, (_, i) =>
      f.post(payload, {
        "If-Match": revision,
        "Idempotency-Key": i < 10 ? key : randomUUID(),
      }),
    ),
  );
  assert(responses.every((r) => [200, 409].includes(r.status)));
  assert.equal(responses.filter((r) => r.status === 200).length, 10);
  const state = await f.state();
  assert.equal(state.payments.length, 1);
  assert.equal(
    state.cashEntries.reduce((sum, x) => sum + x.amount, 0),
    100000,
  );
  const retry = await f.post(payload, {
    "If-Match": revision,
    "Idempotency-Key": key,
  });
  assert.equal(retry.status, 200);
  assert.equal(retry.body.result.id, state.payments[0].id);
  assert.deepEqual(await f.state(), state);
});

test("El rol de consulta no puede ejecutar ninguna operación ni descargar copias", async (t) => {
  const f = await fixture(t);
  await f.act("user.create", {
    name: "Consulta",
    username: "consulta",
    password: "1234",
    role: "consulta",
  });
  const login = await fetch(f.base + "/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "consulta", password: "1234" }),
  });
  const Cookie = login.headers.get("set-cookie").split(";")[0];
  const before = await f.state();
  const actions = [
    ...fs
      .readFileSync(path.join(__dirname, "../domain.cjs"), "utf8")
      .matchAll(/case "([^"]+)":/g),
  ].map((x) => x[1]);
  for (const action of [
    ...actions,
    "user.create",
    "user.update",
    "backup.restore",
  ]) {
    const r = await f.post({ action, data: {} }, { Cookie });
    assert.equal(r.status, 403, action + ": " + JSON.stringify(r));
  }
  const backup = await fetch(f.base + "/api/backup", { headers: { Cookie } });
  assert.equal(backup.status, 403);
  const view = await (
    await fetch(f.base + "/api/state", { headers: { Cookie } })
  ).json();
  assert.deepEqual(view.users, []);
  assert.deepEqual(view.audit, []);
  assert.deepEqual(await f.state(), before);
});

test("Una copia dañada o con historial inválido no reemplaza la operación actual", async (t) => {
  const f = await fixture(t);
  const client = await f.act("client.save", { name: "Cliente de copia" });
  await f.act("order.create", {
    clientId: client.id,
    type: "Reparación",
    description: "Reparar",
    condition: "Recibido",
    metal: "oro",
    purity: 750,
    receivedWeight: 1,
    labor: 1000,
    dueDate: "2026-11-30",
  });
  const backup = await (
    await fetch(f.base + "/api/backup", { headers: f.headers })
  ).json();
  const before = await f.state();
  for (const recalculate of [false, true]) {
    const file = structuredClone(backup);
    file.state.orders[0].history.push(null);
    if (recalculate) {
      const { checksum, ...content } = file;
      file.checksum = createHash("sha256")
        .update(JSON.stringify(content))
        .digest("hex");
    }
    const r = await f.post({
      action: "backup.restore",
      data: { password: "1234", backup: file },
    });
    assert.equal(r.status, 400, JSON.stringify(r.body));
    assert.deepEqual(await f.state(), before);
  }
});
