"use strict";
const { gzipSync, gunzipSync } = require("node:zlib");
const { createClient } = require("@libsql/client/web");
const D = require("./domain.cjs");
const SCHEMA = require("./storage-schema.cjs");
const { setTimeout: delay } = require("node:timers/promises");
const pack = (value) =>
  "gzip:" + gzipSync(Buffer.from(value)).toString("base64");
const unpack = (value) =>
  value?.startsWith("gzip:")
    ? gunzipSync(Buffer.from(value.slice(5), "base64")).toString()
    : value;

async function createCloudStorage(options = {}) {
  const url = options.url || process.env.TURSO_DATABASE_URL;
  const authToken = options.authToken || process.env.TURSO_AUTH_TOKEN;
  if (!url || (!options.client && !authToken))
    throw new Error(
      "Configura TURSO_DATABASE_URL y TURSO_AUTH_TOKEN en las variables privadas de Vercel.",
    );
  if (!options.client && !/^(libsql|https):\/\//.test(url))
    throw new Error(
      "TURSO_DATABASE_URL debe ser una URL remota libsql:// o https://.",
    );
  const client =
    options.client || createClient({ url, authToken, intMode: "number" });
  await client.executeMultiple(SCHEMA);
  await client.execute({
    sql: "INSERT OR IGNORE INTO state(id,json) VALUES(1,?)",
    args: [pack(JSON.stringify(D.initialState()))],
  });
  let transaction = null;
  const target = () => transaction || client;
  const storage = {
    prepare(sql) {
      const run = async (...args) => {
        // Comprimir el estado evita transportar megabytes repetidos entre la función y Turso.
        if (/^(UPDATE state SET json|INSERT OR IGNORE INTO state)/i.test(sql))
          args[0] = pack(args[0]);
        return target().execute({ sql, args });
      };
      return {
        run,
        async get(...args) {
          const row = (await run(...args)).rows[0];
          if (row && /SELECT json FROM state/i.test(sql))
            return { ...row, json: unpack(row.json) };
          return row ? { ...row } : undefined;
        },
        async all(...args) {
          return (await run(...args)).rows.map((row) => ({ ...row }));
        },
      };
    },
    async exec(sql) {
      if (/^BEGIN/i.test(sql)) {
        if (transaction) throw new Error("Ya existe una transacción activa.");
        for (let attempt = 0; ; attempt++) {
          let candidate;
          try {
            candidate = await client.transaction(
              /READ/i.test(sql) ? "read" : "write",
            );
            // El SDK inicia la transacción al ejecutar la primera sentencia, no al crear el objeto.
            await candidate.execute("SELECT 1");
            transaction = candidate;
            break;
          } catch (error) {
            candidate?.close();
            if (attempt >= 5 || !/^SQLITE_(BUSY|LOCKED)/.test(error.code || ""))
              throw error;
            await delay(50 * 2 ** attempt);
          }
        }
      } else if (/^COMMIT/i.test(sql)) {
        const tx = transaction;
        try {
          await tx.commit();
        } finally {
          transaction = null;
          tx.close();
        }
      } else if (/^ROLLBACK/i.test(sql)) {
        const tx = transaction;
        transaction = null;
        if (tx) {
          try {
            await tx.rollback();
          } finally {
            tx.close();
          }
        }
      } else await target().executeMultiple(sql);
    },
    async batch(statements) {
      return target().batch(statements);
    },
    get inTransaction() {
      return transaction !== null;
    },
    async storeBackup(name, content) {
      await target().execute({
        sql: "INSERT OR IGNORE INTO cloud_backups(name,at,json) VALUES(?,?,?)",
        args: [name, D.now(), pack(JSON.stringify(content))],
      });
    },
    async dailyBackup(makeBackup) {
      const name = "taller-" + D.day();
      if (
        !(
          await target().execute({
            sql: "SELECT name FROM cloud_backups WHERE name=?",
            args: [name],
          })
        ).rows.length
      )
        await storage.storeBackup(name, await makeBackup());
    },
    close() {
      transaction?.close();
      transaction = null;
      client.close();
    },
  };
  return storage;
}
module.exports = { createCloudStorage, pack, unpack };
