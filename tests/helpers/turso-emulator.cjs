"use strict";
// Emula el protocolo HTTP de libSQL para probar el SDK real sin credenciales de producción.
const http = require("node:http");
const { DatabaseSync } = require("node:sqlite");
const { randomUUID } = require("node:crypto");
async function createTursoEmulator(file) {
  const streams = new Map();
  const decode = (v) =>
    v.type === "null"
      ? null
      : v.type === "integer" || v.type === "float"
        ? Number(v.value)
        : v.type === "blob"
          ? Buffer.from(v.base64, "base64")
          : v.value;
  const encode = (v) =>
    v === null
      ? { type: "null" }
      : typeof v === "number"
        ? Number.isInteger(v)
          ? { type: "integer", value: String(v) }
          : { type: "float", value: v }
        : typeof v === "bigint"
          ? { type: "integer", value: String(v) }
          : Buffer.isBuffer(v) || v instanceof Uint8Array
            ? { type: "blob", base64: Buffer.from(v).toString("base64") }
            : { type: "text", value: v };
  function execute(stream, stmt) {
    const sql = stmt.sql ?? stream.sql.get(stmt.sql_id);
    const prepared = stream.db.prepare(sql);
    const cols = prepared.columns();
    const args = (stmt.args || []).map(decode);
    let rows = [],
      changes = 0,
      lastId = null;
    if (cols.length)
      rows = prepared
        .all(...args)
        .map((row) => cols.map((c) => encode(row[c.name])));
    else {
      const result = prepared.run(...args);
      changes = Number(result.changes);
      lastId = String(result.lastInsertRowid);
    }
    return {
      cols: cols.map((c) => ({ name: c.name, decltype: c.type })),
      rows,
      affected_row_count: changes,
      last_insert_rowid: lastId,
      rows_read: rows.length,
      rows_written: changes,
    };
  }
  function condition(c, results, errors, stream) {
    if (!c) return true;
    if (c.type === "ok") return results[c.step] != null;
    if (c.type === "error") return errors[c.step] != null;
    if (c.type === "not") return !condition(c.cond, results, errors, stream);
    if (c.type === "and")
      return c.conds.every((x) => condition(x, results, errors, stream));
    if (c.type === "or")
      return c.conds.some((x) => condition(x, results, errors, stream));
    if (c.type === "is_autocommit") return !stream.db.isTransaction;
    throw new Error("Condición no implementada en el emulador: " + c.type);
  }
  const errorOf = (e) => ({
    message: e.message,
    code:
      e.errcode === 5
        ? "SQLITE_BUSY"
        : e.errcode === 19
          ? "SQLITE_CONSTRAINT"
          : "SQLITE_ERROR",
  });
  const server = http.createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const input = JSON.parse(Buffer.concat(chunks).toString());
      if (!req.headers.authorization) {
        res.writeHead(401);
        res.end();
        return;
      }
      let baton = input.baton,
        stream = baton ? streams.get(baton) : null;
      if (!stream) {
        baton = randomUUID();
        stream = { db: new DatabaseSync(file), sql: new Map() };
        stream.db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=0;");
        streams.set(baton, stream);
      }
      const results = [];
      for (const request of input.requests) {
        try {
          let response;
          if (request.type === "execute")
            response = {
              type: "execute",
              result: execute(stream, request.stmt),
            };
          else if (request.type === "sequence") {
            stream.db.exec(request.sql ?? stream.sql.get(request.sql_id));
            response = { type: "sequence" };
          } else if (request.type === "store_sql") {
            stream.sql.set(request.sql_id, request.sql);
            response = { type: "store_sql" };
          } else if (request.type === "close_sql") {
            stream.sql.delete(request.sql_id);
            response = { type: "close_sql" };
          } else if (request.type === "get_autocommit")
            response = {
              type: "get_autocommit",
              is_autocommit: !stream.db.isTransaction,
            };
          else if (request.type === "batch") {
            const step_results = [],
              step_errors = [];
            for (const step of request.batch.steps) {
              if (
                !condition(step.condition, step_results, step_errors, stream)
              ) {
                step_results.push(null);
                step_errors.push(null);
                continue;
              }
              try {
                step_results.push(execute(stream, step.stmt));
                step_errors.push(null);
              } catch (e) {
                step_results.push(null);
                step_errors.push(errorOf(e));
              }
            }
            response = { type: "batch", result: { step_results, step_errors } };
          } else if (request.type === "close") {
            stream.db.close();
            streams.delete(baton);
            baton = null;
            response = { type: "close" };
          } else throw new Error("Petición no implementada: " + request.type);
          results.push({ type: "ok", response });
        } catch (e) {
          results.push({ type: "error", error: errorOf(e) });
        }
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ baton, base_url: null, results }));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: error.message }));
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return {
    url: "http://127.0.0.1:" + server.address().port,
    async close() {
      await new Promise((r) => server.close(r));
      for (const stream of streams.values()) stream.db.close();
      streams.clear();
    },
  };
}
module.exports = { createTursoEmulator };
