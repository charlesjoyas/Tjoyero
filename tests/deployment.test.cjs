"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { randomUUID } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const D = require("../domain.cjs");

async function start(root, dataDir, extra = {}) {
  const child = spawn(process.execPath, [path.join(root, "server.cjs")], {
    cwd: root,
    windowsHide: true,
    env: {
      ...process.env,
      PORT: "0",
      HOST: "127.0.0.1",
      TALLER_DATA_DIR: dataDir,
      ...extra,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "",
    errors = "";
  child.stderr.on("data", (chunk) => {
    errors += chunk;
  });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("El servidor no inició: " + output + errors)),
      10000,
    );
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error("Arranque fallido " + code + ": " + errors));
    });
    child.stdout.on("data", (chunk) => {
      output += chunk;
      const m = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (m) {
        clearTimeout(timer);
        resolve("http://127.0.0.1:" + m[1]);
      }
    });
  });
  try {
    return { child, base: await ready, errors: () => errors };
  } catch (e) {
    child.kill();
    throw e;
  }
}
async function stop(processInfo) {
  if (
    !processInfo ||
    processInfo.child.exitCode !== null ||
    processInfo.child.signalCode !== null
  )
    return;
  const ended = once(processInfo.child, "exit");
  processInfo.child.kill("SIGKILL");
  await ended;
}

test(
  "Despliegue limpio sin dependencias, caída abrupta, reintento tras reinicio y recuperación completa",
  { timeout: 30000 },
  async (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aurea despliegue "));
    const root = path.join(dir, "Programa del taller"),
      dataDir = path.join(dir, "Datos del taller");
    fs.mkdirSync(root);
    for (const name of [
      "server.cjs",
      "domain.cjs",
      "gems.cjs",
      "reversals.cjs",
      "deletions.cjs",
      "app.js",
      "excel-export.js",
      "exceljs.min.js",
      "numbers.js",
      "labor-estimate.js",
      "production-metals.js",
    "transport.js",
    "transfers.cjs",
    "storage-schema.cjs",
      "index.html",
      "styles.css",
      "icon.svg",
    ])
      fs.copyFileSync(path.join(__dirname, "..", name), path.join(root, name));
    let running;
    t.after(async () => {
      await stop(running);
      fs.rmSync(dir, { recursive: true, force: true });
    });
    running = await start(root, dataDir);
    const request = async (url, method = "GET", body, headers = {}) => {
      const r = await fetch(running.base + url, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return {
        status: r.status,
        data: await r.json(),
        cookie: r.headers.get("set-cookie")?.split(";")[0],
      };
    };
    assert.equal((await request("/api/session")).data.setupRequired, true);
    const competing = spawn(process.execPath, [path.join(root, "server.cjs")], {
      cwd: root,
      windowsHide: true,
      stdio: "ignore",
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: new URL(running.base).port,
        TALLER_DATA_DIR: path.join(dir, "Segundo arranque"),
      },
    });
    const timeout = setTimeout(() => competing.kill("SIGKILL"), 5000);
    const [exitCode] = await once(competing, "exit");
    clearTimeout(timeout);
    assert.equal(
      exitCode,
      1,
      "Un arranque duplicado debe terminar con un error controlado, sin dejar otro servidor activo",
    );
    assert.equal((await request("/api/session")).status, 200);
    const setup = await request("/api/setup", "POST", {
      workshop: "Taller instalado",
      name: "Admin",
      username: "admin",
      password: "1234",
    });
    assert.equal(setup.status, 201);
    const headers = { Cookie: setup.cookie };
    const initial = (await request("/api/state", "GET", undefined, headers))
      .data.state;
    const key = randomUUID();
    const operation = {
      action: "client.save",
      data: { name: "Persistido antes de la caída", document: "000123" },
    };
    const mutationHeaders = {
      ...headers,
      "If-Match": String(initial.revision),
      "Idempotency-Key": key,
    };
    assert.equal(
      (await request("/api/action", "POST", operation, mutationHeaders)).status,
      200,
    );
    const snapshot = (await request("/api/state", "GET", undefined, headers))
      .data.state;
    await stop(running); // Sin cierre limpio: recuperación del WAL como tras terminar el proceso en Windows.
    running = await start(root, dataDir);
    assert.equal(
      (await request("/api/session", "GET", undefined, headers)).data
        .setupRequired,
      false,
    );
    assert.deepEqual(
      (await request("/api/state", "GET", undefined, headers)).data.state,
      snapshot,
    );
    assert.equal(
      (await request("/api/action", "POST", operation, mutationHeaders)).status,
      200,
    );
    assert.deepEqual(
      (await request("/api/state", "GET", undefined, headers)).data.state,
      snapshot,
    );
    for (const resource of [
      "/",
      "/app.js",
      "/excel-export.js",
      "/exceljs.min.js",
      "/numbers.js",
      "/labor-estimate.js",
      "/styles.css",
      "/icon.svg",
    ]) {
      const response = await fetch(running.base + resource);
      assert.equal(response.status, 200, resource);
      assert(
        !response.headers.get("content-type").includes("application/json"),
      );
    }
    const protectedFile = await fetch(running.base + "/data/taller.sqlite");
    assert.equal(protectedFile.status, 404);
    await stop(running);
    const recovered = path.join(dir, "Datos recuperados");
    fs.cpSync(dataDir, recovered, { recursive: true });
    const db = new DatabaseSync(path.join(recovered, "taller.sqlite"), {
      readOnly: true,
    });
    assert.equal(db.prepare("PRAGMA quick_check").get().quick_check, "ok");
    D.validateState(
      JSON.parse(db.prepare("SELECT json FROM state WHERE id=1").get().json),
    );
    db.close();
    running = await start(root, recovered);
    const login = await request("/api/login", "POST", {
      username: "admin",
      password: "1234",
    });
    assert.equal(login.status, 200);
    const restored = await request("/api/state", "GET", undefined, {
      Cookie: login.cookie,
    });
    assert.deepEqual(restored.data.state, snapshot);
    assert.equal(restored.data.users[0].username, "admin");
    const tooLarge = await fetch(running.base + "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "x".repeat(25 * 1024 * 1024),
        password: "1234",
      }),
    });
    assert.equal(tooLarge.status, 413);
    assert.equal((await request("/api/session")).status, 200);
    const backups = fs
      .readdirSync(path.join(recovered, "backups"))
      .filter((x) => x.endsWith(".json"));
    assert(backups.length > 0);
    assert.equal(running.errors(), "");
  },
);
