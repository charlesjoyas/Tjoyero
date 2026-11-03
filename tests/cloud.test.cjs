"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { randomUUID, createHash } = require("node:crypto");
const { createClient } = require("@libsql/client/web");
const { createTursoEmulator } = require("./helpers/turso-emulator.cjs");
const { createCloudStorage } = require("../cloud-storage.cjs");
const { createApp } = require("../server.cjs");
const { PART_BYTES } = require("../transfers.cjs");
const setupKey = "clave-de-puesta-en-marcha-pruebas-123456";
test("Nube: gastos bancarios persistentes y reversión sin descontar efectivo",async(t)=>{
  const f=await fixture(t);
  await f.request("/api/setup",{workshop:"Gastos nube",name:"Admin",username:"admin",password:"1234",setupKey});
  const expense=(await f.act("expense.create",{category:"Arriendo",concept:"Arriendo del taller",amount:75000,method:"bank",reference:"BANCO-001"})).body.result;
  let state=await f.state();assert.equal(state.expenses.length,1);assert.equal(state.cashEntries.length,0);
  await f.open();assert.equal((await f.state()).expenses[0].id,expense.id);
  const payload={type:"expense",id:expense.id,reason:"Devolución verificada",reference:"DEV-001",confirmed:true};
  const preview=await f.request("/api/reversal-preview",payload);assert.equal(preview.status,200);assert.equal(preview.body.bankDelta,75000);assert.equal(preview.body.cashDelta,0);
  assert.equal((await f.act("operation.reverse",payload)).status,200);
  state=await f.state();assert.ok(state.expenses[0].reversedAt);assert.equal(state.cashEntries.length,0);
});

test("Nube: reversión previsualizada sin escritura y compensación persistente tras reiniciar",async(t)=>{
  const f=await fixture(t);
  assert.equal((await f.request("/api/setup",{workshop:"Reversiones nube",name:"Admin",username:"admin",password:"1234",setupKey})).status,201);
  const supplier=(await f.act("supplier.save",{name:"Proveedor nube"})).body.result;
  const purchase=(await f.act("purchase.create",{supplierId:supplier.id,document:"NUBE-001",metal:"oro",purity:750,weight:2,rate:100000,dueDate:"2026-12-01"})).body.result;
  const before=await f.state(),payload={type:"purchase",id:purchase.id,reason:"Ingreso erróneo verificado",confirmed:true};
  const preview=await f.request("/api/reversal-preview",payload);assert.equal(preview.status,200);
  assert.equal(preview.body.movements.length,1);assert.deepEqual(await f.state(),before);
  assert.equal((await f.act("operation.reverse",payload)).status,200);
  const after=await f.state();assert.equal(after.reversals.length,1);assert.ok(after.purchases[0].reversedAt);
  await f.open();assert.deepEqual(await f.state(),after);
});

async function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aurea-cloud-"));
  const emulator = await createTursoEmulator(
    path.join(dir, "persistente.sqlite"),
  );
  const url = emulator.url;
  let app;
  const instances = [];
  async function open() {
    const storage = await createCloudStorage({
      url,
      client: createClient({
        url,
        authToken: "token-de-prueba",
        intMode: "number",
      }),
    });
    app = createApp({
      storage,
      setupKey,
      dataDir: path.join(dir, "no-debe-crearse"),
    });
    instances.push(app);
    await app.ready;
    await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
    return app;
  }
  await open();
  t.after(async () => {
    for (const item of instances)
      if (item.server.listening) await new Promise((r) => item.server.close(r));
    await emulator.close();
    fs.rmSync(dir, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  });
  let cookie = "";
  async function request(route, data, extra = {}) {
    const r = await fetch(
      "http://127.0.0.1:" + app.server.address().port + route,
      {
        method: data === undefined ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
          ...extra,
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      },
    );
    const setCookie = r.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    return { status: r.status, body: await r.json(), headers: r.headers };
  }
  const state = async () => (await request("/api/state")).body.state;
  async function act(action, data, key = randomUUID(), revision) {
    return request(
      "/api/action",
      { action, data },
      {
        "If-Match": String(revision ?? (await state()).revision),
        "Idempotency-Key": key,
      },
    );
  }
  return {
    dir,
    open,
    request,
    state,
    act,
    app: () => app,
    cookie: () => cookie,
  };
}

test("Nube: primer administrador protegido, sesión persistente y datos conservados entre instancias", async (t) => {
  const f = await fixture(t);
  const session = await f.request("/api/session");
  assert.equal(session.body.environment, "cloud");
  assert.equal(session.body.setupKeyRequired, true);
  const data = {
    workshop: "Taller nube",
    name: "Admin",
    username: "admin",
    password: "1234",
  };
  assert.equal((await f.request("/api/setup", data)).status, 403);
  const setup = await f.request("/api/setup", { ...data, setupKey });
  assert.equal(setup.status, 201, JSON.stringify(setup.body));
  assert(setup.headers.get("set-cookie").includes("Secure"));
  const key = randomUUID(),
    revision = (await f.state()).revision;
  const first = await f.act(
    "client.save",
    { name: "Cliente persistente" },
    key,
    revision,
  );
  assert.equal(first.status, 200);
  await new Promise((r) => f.app().server.close(r));
  await f.open();
  assert.equal((await f.request("/api/session")).body.setupRequired, false);
  assert.equal((await f.state()).clients.length, 1);
  const retry = await f.act(
    "client.save",
    { name: "Cliente persistente" },
    key,
    revision,
  );
  assert.equal(retry.status, 200);
  assert.equal(retry.body.result.id, first.body.result.id);
  assert.equal((await f.state()).clients.length, 1);
  assert.equal(fs.existsSync(path.join(f.dir, "no-debe-crearse")), false);
  const backups = await f
    .app()
    .db.prepare("SELECT name FROM cloud_backups")
    .all();
  assert(backups.some((x) => x.name.startsWith("taller-")));
  const { createServerlessHandler } = require("../api/index.js");
  const http = require("node:http");
  const bridge = http.createServer(async (req, res) => {
    if (req.method === "POST") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      req.body = JSON.parse(Buffer.concat(chunks).toString());
    }
    return createServerlessHandler(async () => f.app())(req, res);
  });
  await new Promise((r) => bridge.listen(0, "127.0.0.1", r));
  try {
    const base = "http://127.0.0.1:" + bridge.address().port;
    const response = await fetch(base + "/api/index?__route=session");
    assert.equal(response.status, 200);
    assert.equal((await response.json()).environment, "cloud");
    const created = await fetch(base + "/api/index?__route=action", {
      method: "POST",
      headers: {
        Cookie: f.cookie(),
        "Content-Type": "application/json",
        "If-Match": String((await f.state()).revision),
        "Idempotency-Key": randomUUID(),
      },
      body: JSON.stringify({
        action: "client.save",
        data: { name: "Cuerpo procesado por Vercel" },
      }),
    });
    assert.equal(created.status, 200, await created.text());
  } finally {
    await new Promise((r) => bridge.close(r));
  }
});

test("Nube: límites de acceso sobreviven a un nuevo proceso del servicio", async (t) => {
  const f = await fixture(t);
  await f.request("/api/setup", {
    workshop: "Taller",
    name: "Admin",
    username: "admin",
    password: "1234",
    setupKey,
  });
  for (let i = 0; i < 6; i++)
    assert.equal(
      (await f.request("/api/login", { username: "admin", password: "mal" }))
        .status,
      401,
    );
  await new Promise((r) => f.app().server.close(r));
  await f.open();
  for (let i = 0; i < 4; i++)
    assert.equal(
      (await f.request("/api/login", { username: "admin", password: "mal" }))
        .status,
      401,
    );
  assert.equal(
    (await f.request("/api/login", { username: "admin", password: "1234" }))
      .status,
    429,
  );
});

test("Nube: restauración mayor de 4,5 MB por fragmentos y respuesta transmitida sin límite de búfer", async (t) => {
  const f = await fixture(t);
  await f.request("/api/setup", {
    workshop: "Taller",
    name: "Admin",
    username: "admin",
    password: "1234",
    setupKey,
  });
  const backup = (await f.request("/api/backup")).body;
  backup.state.clients = Array.from({ length: 2600 }, (_, i) => ({
    id: randomUUID(),
    name: "Cliente " + i,
    document: String(i),
    phone: "",
    email: "",
    notes: "áéíóú ñ ".repeat(200),
    createdAt: new Date().toISOString(),
  }));
  const { checksum, ...content } = backup;
  backup.checksum = createHash("sha256")
    .update(JSON.stringify(content))
    .digest("hex");
  const bytes = Buffer.from(
    JSON.stringify({
      action: "backup.restore",
      data: { backup, password: "1234" },
    }),
  );
  assert(bytes.length > 4.5 * 1024 * 1024);
  const parts = Math.ceil(bytes.length / PART_BYTES),
    hash = createHash("sha256").update(bytes).digest("hex");
  const upload = await f.request("/api/transfers", {
    bytes: bytes.length,
    parts,
    checksum: hash,
  });
  assert.equal(upload.status, 201);
  const id = upload.body.id;
  for (let i = 0; i < parts; i++)
    assert.equal(
      (
        await f.request("/api/transfers/" + id + "/parts/" + i, {
          payload: bytes
            .subarray(i * PART_BYTES, (i + 1) * PART_BYTES)
            .toString("base64"),
        })
      ).status,
      200,
    );
  const revision = (await f.state()).revision;
  const response = await f.request(
    "/api/action",
    { __upload: id },
    { "If-Match": String(revision), "Idempotency-Key": randomUUID() },
  );
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const state = await f.request("/api/state");
  assert.equal(state.status, 200);
  assert.equal(state.body.state.clients.length, 2600);
  assert.equal(state.headers.get("content-length"), null);
  assert.equal(state.headers.get("transfer-encoding"), "chunked");
  assert(
    (await f.app().db.prepare("SELECT name FROM cloud_backups").all()).some(
      (x) => x.name.startsWith("antes-de-restaurar-"),
    ),
  );
});

test("Nube: el adaptador de producción rechaza usar un archivo efímero como base", async () => {
  await assert.rejects(
    createCloudStorage({ url: "file:/tmp/taller.sqlite", authToken: "token" }),
    /remota/,
  );
});

test("Nube: dos instancias independientes no duplican un cobro ni pisan una revisión", async (t) => {
  const f = await fixture(t);
  await f.request("/api/setup", {
    workshop: "Taller",
    name: "Admin",
    username: "admin",
    password: "1234",
    setupKey,
  });
  const client = (await f.act("client.save", { name: "Cliente compartido" }))
    .body.result;
  const order = (
    await f.act("order.create", {
      clientId: client.id,
      type: "Reparación",
      description: "Reparar",
      condition: "Sin piedras",
      metal: "oro",
      purity: 750,
      receivedWeight: 1,
      labor: 100000,
      dueDate: "2026-11-30",
    })
  ).body.result;
  await f.act("shift.open", { opening: 0 });
  const first = f.app(),
    second = await f.open();
  const revision = (await f.state()).revision,
    key = randomUUID();
  const operations = await Promise.all(
    Array.from({ length: 8 }, async (_, i) => {
      const instance = i % 2 ? first : second;
      const r = await fetch(
        "http://127.0.0.1:" + instance.server.address().port + "/api/action",
        {
          method: "POST",
          headers: {
            Cookie: f.cookie(),
            "Content-Type": "application/json",
            "If-Match": String(revision),
            "Idempotency-Key": key,
          },
          body: JSON.stringify({
            action: "payment.create",
            data: { orderId: order.id, cash: 100000 },
          }),
        },
      );
      return { status: r.status, body: await r.json() };
    }),
  );
  assert(
    operations.every((x) => x.status === 200),
    JSON.stringify(operations),
  );
  assert.equal(new Set(operations.map((x) => x.body.result.id)).size, 1);
  const state = await f.state();
  assert.equal(state.payments.length, 1);
  assert.equal(
    state.cashEntries.reduce((v, x) => v + x.amount, 0),
    100000,
  );
});

test("Migración: conserva datos y contraseñas, y rechaza un destino con registros", async t => {
  const f = await fixture(t);
  const { migrate } = require("../scripts/migrate-turso.cjs");
  const { scryptSync } = require("node:crypto");
  const D = require("../domain.cjs");
  const sourceDir = path.join(f.dir, "origen");
  const local = createApp({ dataDir: sourceDir });
  await local.ready;
  const salt = "salt-de-prueba";
  local.db.prepare("INSERT INTO users(id,name,username,role,salt,hash,active) VALUES(?,?,?,?,?,?,?)").run(randomUUID(), "Admin migrado", "migrado", "admin", salt, scryptSync("1234", salt, 64).toString("hex"), 1);
  const original = D.initialState(); original.revision = 42;
  const admin = { name: "Admin migrado", role: "admin" };
  const client = D.execute(original, "client.save", { name: "Cliente migrado", document: "000123" }, admin);
  D.execute(original, "order.create", { clientId: client.id, type: "Reparación", description: "Orden migrada", condition: "Sin piedras", metal: "oro", purity: 750, receivedWeight: 2.5, labor: 120000, dueDate: "2026-11-30" }, admin);
  local.db.prepare("UPDATE state SET json=? WHERE id=1").run(JSON.stringify(original));
  local.db.close();
  const source = path.join(sourceDir, "taller.sqlite");
  const result = await migrate({ source, storage: f.app().db });
  assert.equal(result.orders, 1); assert.equal(result.users, 1);
  assert.equal((await f.request("/api/login", { username: "migrado", password: "1234" })).status, 200);
  assert.deepEqual(await f.state(), original);
  await assert.rejects(migrate({ source, storage: f.app().db }), /ya contiene datos/);
  assert.deepEqual(await f.state(), original);
});
