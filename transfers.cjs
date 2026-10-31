"use strict";

const { randomUUID, createHash } = require("node:crypto");
const D = require("./domain.cjs");
const PART_BYTES = 256 * 1024;
const MAX_BYTES = 25 * 1024 * 1024;
const digest = (data) => createHash("sha256").update(data).digest("hex");
function createTransfers(db) {
  async function cleanup() {
    await db
      .prepare(
        "DELETE FROM transfer_parts WHERE transfer_id IN (SELECT id FROM transfers WHERE expires<?)",
      )
      .run(Date.now());
    await db.prepare("DELETE FROM transfers WHERE expires<?").run(Date.now());
  }
  async function metadata(id, userId, kind) {
    const m = await db
      .prepare(
        "SELECT * FROM transfers WHERE id=? AND user_id=? AND kind=? AND expires>?",
      )
      .get(id, userId, kind, Date.now());
    D.assert(
      m,
      "La transferencia venció o no pertenece a tu sesión. Vuelve a intentar.",
      410,
    );
    return m;
  }
  async function create(userId, kind, bytes, parts, checksum) {
    D.assert(
      Number.isSafeInteger(bytes) &&
        bytes > 0 &&
        bytes <= MAX_BYTES &&
        parts === Math.ceil(bytes / PART_BYTES) &&
        /^[a-f0-9]{64}$/.test(checksum),
      "Tamaño o integridad de transferencia inválidos.",
    );
    await cleanup();
    const id = randomUUID();
    await db
      .prepare(
        "INSERT INTO transfers(id,user_id,kind,parts,bytes,checksum,expires) VALUES(?,?,?,?,?,?,?)",
      )
      .run(id, userId, kind, parts, bytes, checksum, Date.now() + 10 * 60000);
    return {
      transport: "aurea-chunks-v1",
      id,
      parts,
      bytes,
      checksum,
      partBytes: PART_BYTES,
    };
  }
  async function upload(userId, id, position, payload) {
    const m = await metadata(id, userId, "upload");
    D.assert(
      Number.isInteger(position) &&
        position >= 0 &&
        position < m.parts &&
        typeof payload === "string" &&
        /^[A-Za-z0-9+/]*={0,2}$/.test(payload) &&
        payload.length <= Math.ceil(PART_BYTES / 3) * 4,
      "Fragmento de transferencia inválido.",
    );
    const decoded = Buffer.from(payload, "base64");
    D.assert(
      decoded.toString("base64") === payload &&
        decoded.length ===
          Math.min(PART_BYTES, m.bytes - position * PART_BYTES),
      "El tamaño del fragmento no coincide.",
    );
    await db
      .prepare(
        "INSERT INTO transfer_parts(transfer_id,position,payload) VALUES(?,?,?) ON CONFLICT(transfer_id,position) DO UPDATE SET payload=excluded.payload",
      )
      .run(id, position, payload);
  }
  async function readUpload(userId, id) {
    const m = await metadata(id, userId, "upload");
    const rows = await db
      .prepare(
        "SELECT position,payload FROM transfer_parts WHERE transfer_id=? ORDER BY position",
      )
      .all(id);
    D.assert(
      rows.length === m.parts && rows.every((r, i) => r.position === i),
      "Faltan fragmentos de la transferencia.",
    );
    const data = Buffer.concat(
      rows.map((r) => Buffer.from(r.payload, "base64")),
    );
    D.assert(
      data.length === m.bytes && digest(data) === m.checksum,
      "La transferencia está incompleta o modificada.",
    );
    let value;
    try {
      value = JSON.parse(data.toString());
    } catch {
      D.fail("La transferencia no contiene JSON válido.");
    }
    D.assert(
      value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        !value.__upload,
      "Solicitud transferida inválida.",
    );
    return value;
  }
  return {
    create,
    upload,
    readUpload,
  };
}
module.exports = {
  createTransfers,
  PART_BYTES,
  MAX_BYTES,
};
