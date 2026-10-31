"use strict";
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const D = require("../domain.cjs");
const { createCloudStorage } = require("../cloud-storage.cjs");

async function migrate({ source, storage }) {
  const local = new DatabaseSync(path.resolve(source), { readOnly: true });
  let snapshot;
  try {
    local.exec("BEGIN");
    snapshot = {
      state: JSON.parse(
        local.prepare("SELECT json FROM state WHERE id=1").get().json,
      ),
      users: local.prepare("SELECT * FROM users").all(),
      audit: local
        .prepare("SELECT at,actor,action,details FROM audit ORDER BY id")
        .all(),
      requests: local.prepare("SELECT * FROM requests").all(),
    };
    D.validateState(snapshot.state);
    if (!snapshot.users.some((u) => u.role === "admin" && u.active))
      throw new Error("La base de origen no tiene un administrador activo.");
    local.exec("COMMIT");
  } finally {
    local.close();
  }
  await storage.exec("BEGIN IMMEDIATE");
  try {
    const target = JSON.parse(
      (await storage.prepare("SELECT json FROM state WHERE id=1").get()).json,
    );
    const users = await storage.prepare("SELECT id FROM users LIMIT 1").get();
    if (
      users ||
      target.revision !== 0 ||
      Object.values(target).some((v) => Array.isArray(v) && v.length)
    )
      throw new Error(
        "La base de destino ya contiene datos. Se canceló la migración sin reemplazarlos.",
      );
    const statements = [
      ...snapshot.users.map((u) => ({
        sql: "INSERT INTO users(id,name,username,role,salt,hash,active) VALUES(?,?,?,?,?,?,?)",
        args: [u.id, u.name, u.username, u.role, u.salt, u.hash, u.active],
      })),
      ...snapshot.audit.map((e) => ({
        sql: "INSERT INTO audit(at,actor,action,details) VALUES(?,?,?,?)",
        args: [e.at, e.actor, e.action, e.details],
      })),
      ...snapshot.requests.map((r) => ({
        sql: "INSERT INTO requests(key,user_id,fingerprint,response,at) VALUES(?,?,?,?,?)",
        args: [r.key, r.user_id, r.fingerprint, r.response, r.at],
      })),
    ];
    for (let i = 0; i < statements.length; i += 100)
      await storage.batch(statements.slice(i, i + 100));
    await storage
      .prepare("UPDATE state SET json=? WHERE id=1")
      .run(JSON.stringify(snapshot.state));
    await storage
      .prepare("INSERT INTO audit(at,actor,action,details) VALUES(?,?,?,?)")
      .run(
        D.now(),
        "Sistema",
        "deployment.migrate",
        JSON.stringify({
          users: snapshot.users.length,
          orders: snapshot.state.orders.length,
        }),
      );
    await storage.exec("COMMIT");
    return {
      users: snapshot.users.length,
      orders: snapshot.state.orders.length,
      clients: snapshot.state.clients.length,
      revision: snapshot.state.revision,
    };
  } catch (error) {
    await storage.exec("ROLLBACK");
    throw error;
  }
}

if (require.main === module)
  (async () => {
    const source = process.argv[2];
    if (!source)
      throw new Error(
        "Uso: node --env-file=.env.local scripts/migrate-turso.cjs ruta/al/taller.sqlite",
      );
    const storage = await createCloudStorage();
    try {
      console.log(
        "Migración completada; no se transfirieron sesiones abiertas:",
        await migrate({ source, storage }),
      );
    } finally {
      storage.close();
    }
  })().catch((error) => {
    console.error("Migración cancelada:", error.message);
    process.exitCode = 1;
  });

module.exports = { migrate };
