"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { DatabaseSync } = require("node:sqlite");
const D = require("./domain.cjs");
const SCHEMA = require("./storage-schema.cjs");
const { createTransfers } = require("./transfers.cjs");
function createApp(options = {}) {
  const cloud = !!options.storage;
  if (process.env.VERCEL && !cloud)
    throw new Error(
      "Vercel requiere una base persistente. Configura TURSO_DATABASE_URL y TURSO_AUTH_TOKEN.",
    );
  const root = __dirname,
    dataDir =
      options.dataDir || process.env.TALLER_DATA_DIR || path.join(root, "data");
  if (!cloud)
    fs.mkdirSync(dataDir, {
      recursive: true,
    });
  if (!cloud)
    fs.mkdirSync(path.join(dataDir, "backups"), {
      recursive: true,
    });
  const db =
    options.storage || new DatabaseSync(path.join(dataDir, "taller.sqlite"));
  if (!cloud) {
    db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;" +
        SCHEMA,
    );
    db.prepare("INSERT OR IGNORE INTO state(id,json) VALUES(1,?)").run(
      JSON.stringify(D.initialState()),
    );
  }
  const read = async () =>
    JSON.parse(
      (await db.prepare("SELECT json FROM state WHERE id=1").get()).json,
    );
  const save = async (s) => {
    D.validateState(s);
    await db
      .prepare("UPDATE state SET json=? WHERE id=1")
      .run(JSON.stringify(s));
  };
  async function rollback() {
    try {
      await db.exec("ROLLBACK");
    } catch (e) {
      // SQLite puede haber revertido la transacción al quedarse sin espacio.
      if (!/no transaction is active/.test(e.message)) console.error(e);
    }
  }
  const audit = async (a, action, detail) =>
    await db
      .prepare("INSERT INTO audit(at,actor,action,details) VALUES(?,?,?,?)")
      .run(D.now(), a.name, action, JSON.stringify(detail));
  const publicUser = (u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    role: u.role,
    active: !!u.active,
  });
  const users = async () =>
    (await db.prepare("SELECT * FROM users ORDER BY name").all()).map(
      publicUser,
    );
  const hash = (password, salt) =>
    crypto.scryptSync(password, salt, 64).toString("hex");
  const passwordValid = (password, u) =>
    typeof password === "string" &&
    password.length <= 1024 &&
    crypto.timingSafeEqual(
      Buffer.from(hash(password, u.salt), "hex"),
      Buffer.from(u.hash, "hex"),
    );
  const checkPassword = (p) => {
    D.assert(
      typeof p === "string" && p.length >= 4 && p.length <= 128,
      "Usa una contraseña de al menos 4 caracteres. Puede contener solo letras o números.",
    );
    return p;
  };
  async function newUser(b) {
    const username = D.str(
      b.username,
      "Usuario o correo electrónico",
      254,
    ).toLowerCase();
    D.assert(
      /^[a-z0-9._-]{3,60}$/.test(username) ||
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username),
      "Usuario o correo electrónico: escribe un correo válido o un nombre de usuario de al menos 3 caracteres, sin espacios.",
    );
    D.assert(Object.hasOwn(D.ROLES, b.role), "Rol inválido.");
    D.assert(
      !(await db
        .prepare("SELECT id FROM users WHERE username=?")
        .get(username)),
      "El usuario ya existe.",
    );
    const salt = crypto.randomBytes(16).toString("hex"),
      x = {
        id: D.id(),
        name: D.str(b.name, "Nombre", 120),
        username,
        role: b.role,
        salt,
        hash: hash(checkPassword(b.password), salt),
      };
    await db
      .prepare(
        "INSERT INTO users(id,name,username,role,salt,hash) VALUES(?,?,?,?,?,?)",
      )
      .run(x.id, x.name, x.username, x.role, x.salt, x.hash);
    return publicUser({
      ...x,
      active: 1,
    });
  }
  async function backup() {
    const ownTransaction = cloud && !db.inTransaction;
    if (ownTransaction) await db.exec("BEGIN READ");
    try {
      const content = {
        format: "aurea-taller-v1",
        at: D.now(),
        state: await read(),
        audit: await db.prepare("SELECT * FROM audit ORDER BY id").all(),
      };
      const file = {
        ...content,
        checksum: crypto
          .createHash("sha256")
          .update(JSON.stringify(content))
          .digest("hex"),
      };
      if (ownTransaction) await db.exec("COMMIT");
      return file;
    } catch (error) {
      if (ownTransaction) await rollback();
      throw error;
    }
  }
  async function dailyBackup() {
    if (cloud) return db.dailyBackup(backup);
    const file = path.join(dataDir, "backups", `taller-${D.day()}.json`);
    if (!fs.existsSync(file))
      fs.writeFileSync(file, JSON.stringify(await backup()), {
        flag: "wx",
      });
  }
  const ready = dailyBackup();
  ready.catch(() => {});
  const transfers = createTransfers(db);
  const parsedBodies = new WeakMap();
  const attempts = new Map();
  const securityHeaders = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    "Permissions-Policy": "camera=(self), serial=(self), microphone=()",
  };
  async function json(res, status, body, headers = {}) {
    let payload = JSON.stringify(body);
    res.writeHead(status, {
      ...securityHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    });
    if (cloud && Buffer.byteLength(payload) > 1024 * 1024) {
      const bytes = Buffer.from(payload);
      await pipeline(
        Readable.from(
          (function* () {
            for (let i = 0; i < bytes.length; i += 64 * 1024)
              yield bytes.subarray(i, i + 64 * 1024);
          })(),
        ),
        res,
      );
    } else res.end(payload);
  }
  async function body(req) {
    if (parsedBodies.has(req)) {
      const cached = parsedBodies.get(req);
      if (cached.error) throw cached.error;
      return cached.value;
    }
    let size = 0;
    const chunks = [];
    if (req.body !== undefined) {
      const data =
        typeof req.body === "string" || Buffer.isBuffer(req.body)
          ? req.body
          : JSON.stringify(req.body);
      chunks.push(Buffer.from(data));
      size = chunks[0].length;
    } else
      for await (const chunk of req) {
        size += chunk.length;
        D.assert(size <= 25 * 1024 * 1024, "El archivo supera los 25 MB.", 413);
        chunks.push(chunk);
      }
    D.assert(
      size <= (cloud ? 4 * 1024 * 1024 : 25 * 1024 * 1024),
      "La solicitud es demasiado grande. Usa la transferencia por fragmentos.",
      413,
    );
    let parsed;
    try {
      parsed = JSON.parse(Buffer.concat(chunks).toString() || "{}");
    } catch {
      D.fail("JSON inválido.");
    }
    D.assert(
      parsed !== null && typeof parsed === "object" && !Array.isArray(parsed),
      "La solicitud debe contener un objeto JSON válido.",
    );
    return parsed;
  }
  async function actor(req) {
    const cookie = (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("aurea_session="));
    if (!cookie) return null;
    const token = cookie.slice(14);
    return await db
      .prepare(
        "SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>? AND active=1",
      )
      .get(crypto.createHash("sha256").update(token).digest("hex"), Date.now());
  }
  async function session(res, u, status = 200) {
    const token = crypto.randomBytes(32).toString("hex");
    await db
      .prepare("INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)")
      .run(
        crypto.createHash("sha256").update(token).digest("hex"),
        u.id,
        Date.now() + 12 * 3600000,
      );
    await json(
      res,
      status,
      {
        user: publicUser(u),
      },
      {
        "Set-Cookie": `aurea_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${cloud ? "; Secure" : ""}`,
      },
    );
  }
  const rawHandler = async (req, res) => {
    try {
      await ready;
      const url = new URL(req.url, "http://localhost"),
        pathname = url.pathname;
      if (pathname.startsWith("/api/")) {
        if (req.method !== "GET") {
          const origin = req.headers.origin;
          D.assert(
            !origin || new URL(origin).host === req.headers.host,
            "Origen no permitido.",
            403,
          );
          D.assert(
            req.headers["content-type"]?.startsWith("application/json"),
            "Se requiere application/json.",
            415,
          );
        }
        const hasUsers = !!(await db
          .prepare("SELECT id FROM users LIMIT 1")
          .get());
        let a = await actor(req);
        if (pathname === "/api/session" && req.method === "GET")
          return await json(res, 200, {
            setupRequired: !hasUsers,
            setupKeyRequired: cloud && !hasUsers,
            environment: cloud ? "cloud" : "local",
            user: a ? publicUser(a) : null,
          });
        if (pathname === "/api/setup" && req.method === "POST") {
          D.assert(!hasUsers, "El taller ya fue configurado.", 409);
          const b = await body(req);
          if (cloud)
            D.assert(
              options.setupKey &&
                typeof b.setupKey === "string" &&
                crypto.timingSafeEqual(
                  crypto.createHash("sha256").update(options.setupKey).digest(),
                  crypto.createHash("sha256").update(b.setupKey).digest(),
                ),
              "La clave de puesta en marcha no coincide. Revisa TALLER_SETUP_KEY en Vercel.",
              403,
            );
          await db.exec("BEGIN IMMEDIATE");
          try {
            D.assert(
              !(await db.prepare("SELECT id FROM users LIMIT 1").get()),
              "El taller ya fue configurado.",
              409,
            );
            const u = await newUser({
              ...b,
              role: "admin",
            });
            const s = await read();
            s.settings.name = D.str(b.workshop, "Nombre del taller", 160);
            s.revision++;
            await save(s);
            await audit(u, "setup", {
              workshop: s.settings.name,
            });
            await db.exec("COMMIT");
            return await session(res, u, 201);
          } catch (e) {
            await rollback();
            throw e;
          }
        }
        if (pathname === "/api/login" && req.method === "POST") {
          const b = await body(req),
            key = crypto
              .createHash("sha256")
              .update(
                String(
                  cloud
                    ? req.headers["x-vercel-forwarded-for"] ||
                        req.headers["x-forwarded-for"] ||
                        req.socket.remoteAddress
                    : req.socket.remoteAddress,
                ),
              )
              .digest("hex"),
            entry = (cloud
              ? await db
                  .prepare(
                    "SELECT count,until_ms AS until FROM login_attempts WHERE key=?",
                  )
                  .get(key)
              : attempts.get(key)) || {
              count: 0,
              until: Date.now() + 900000,
            };
          if (entry.until < Date.now()) {
            entry.count = 0;
            entry.until = Date.now() + 900000;
          }
          D.assert(
            entry.count < 10,
            "Demasiados intentos. Intenta de nuevo en 15 minutos.",
            429,
          );
          const u = await db
            .prepare("SELECT * FROM users WHERE username=? AND active=1")
            .get(
              String(b.username || "")
                .toLowerCase()
                .trim(),
            );
          if (!u || !passwordValid(b.password, u)) {
            entry.count++;
            if (cloud)
              await db
                .prepare(
                  "INSERT INTO login_attempts(key,count,until_ms) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN login_attempts.until_ms<? THEN 1 ELSE login_attempts.count+1 END, until_ms=CASE WHEN login_attempts.until_ms<? THEN excluded.until_ms ELSE login_attempts.until_ms END",
                )
                .run(key, entry.count, entry.until, Date.now(), Date.now());
            else attempts.set(key, entry);
            D.fail("Usuario o contraseña incorrectos.", 401);
          }
          if (cloud)
            await db.prepare("DELETE FROM login_attempts WHERE key=?").run(key);
          else attempts.delete(key);
          await audit(u, "login", {});
          return await session(res, u);
        }
        D.assert(a, "Inicia sesión para continuar.", 401);
        if (pathname === "/api/transfers" && req.method === "POST") {
          const b = await body(req);
          return await json(
            res,
            201,
            await transfers.create(
              a.id,
              "upload",
              b.bytes,
              b.parts,
              b.checksum,
            ),
          );
        }
        const fragment = pathname.match(
          /^\/api\/transfers\/([a-f0-9-]{36})\/parts\/(\d+)$/,
        );
        if (fragment) {
          if (req.method === "POST") {
            await transfers.upload(
              a.id,
              fragment[1],
              Number(fragment[2]),
              (await body(req)).payload,
            );
            return await json(res, 200, {
              ok: true,
            });
          }
          D.fail("Método no permitido.", 405);
        }
        if (pathname === "/api/logout" && req.method === "POST") {
          const c = (req.headers.cookie || "")
            .split(";")
            .map((x) => x.trim())
            .find((x) => x.startsWith("aurea_session="));
          if (c)
            await db
              .prepare("DELETE FROM sessions WHERE token=?")
              .run(
                crypto.createHash("sha256").update(c.slice(14)).digest("hex"),
              );
          return await json(
            res,
            200,
            {
              ok: true,
            },
            {
              "Set-Cookie":
                "aurea_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" +
                (cloud ? "; Secure" : ""),
            },
          );
        }
        if (pathname === "/api/state" && req.method === "GET") {
          const s = await read();
          return await json(res, 200, {
            state: s,
            environment: cloud ? "cloud" : "local",
            user: publicUser(a),
            users: a.role === "admin" ? await users() : [],
            audit: ["admin", "contador"].includes(a.role)
              ? await db
                  .prepare("SELECT * FROM audit ORDER BY id DESC LIMIT 2000")
                  .all()
              : [],
            accounts: D.ACCOUNTS,
            permissions: D.ROLES[a.role],
          });
        }
        if (pathname === "/api/backup" && req.method === "GET") {
          D.permit(a, "settings");
          await audit(a, "backup.download", {});
          return await json(res, 200, await backup(), {
            "Content-Disposition": `attachment; filename="aurea-taller-${D.day()}.json"`,
          });
        }
        if (pathname === "/api/password" && req.method === "POST") {
          const b = await body(req);
          D.assert(
            passwordValid(b.current, a),
            "La contraseña actual no coincide.",
            403,
          );
          const salt = crypto.randomBytes(16).toString("hex");
          await db
            .prepare("UPDATE users SET salt=?,hash=? WHERE id=?")
            .run(salt, hash(checkPassword(b.password), salt), a.id);
          await db.prepare("DELETE FROM sessions WHERE user_id=?").run(a.id);
          await audit(a, "password.change", {});
          return await session(res, a);
        }
        if (pathname === "/api/action" && req.method === "POST") {
          let b = await body(req);
          if (b.__upload) b = await transfers.readUpload(a.id, b.__upload);
          D.assert(
            typeof b.action === "string" &&
              b.action.length > 0 &&
              (b.data === undefined ||
                (b.data !== null &&
                  typeof b.data === "object" &&
                  !Array.isArray(b.data))),
            "La operación y sus datos no tienen una estructura válida.",
          );
          b.data ??= {};
          const key = D.str(
              req.headers["idempotency-key"],
              "Identificador de operación",
              100,
            ),
            fp = crypto
              .createHash("sha256")
              .update(JSON.stringify(b))
              .digest("hex"),
            existing = await db
              .prepare("SELECT * FROM requests WHERE key=?")
              .get(key);
          if (existing) {
            D.assert(
              existing.user_id === a.id && existing.fingerprint === fp,
              "El identificador ya pertenece a otra operación.",
              409,
            );
            return await json(res, 200, JSON.parse(existing.response));
          }
          await dailyBackup();
          await db.exec("BEGIN IMMEDIATE");
          try {
            // Otra instancia puede haber confirmado el mismo envío mientras esperábamos el bloqueo.
            const confirmed = await db
              .prepare("SELECT * FROM requests WHERE key=?")
              .get(key);
            if (confirmed) {
              D.assert(
                confirmed.user_id === a.id && confirmed.fingerprint === fp,
                "El identificador ya pertenece a otra operación.",
                409,
              );
              await db.exec("COMMIT");
              return await json(res, 200, JSON.parse(confirmed.response));
            }
            a = await actor(req);
            D.assert(a, "Inicia sesión para continuar.", 401);
            const s = await read();
            D.assert(
              String(s.revision) === req.headers["if-match"],
              "Los datos cambiaron en otra sesión. Actualiza y vuelve a revisar la operación.",
              409,
            );
            let result;
            if (b.action === "user.create") {
              D.permit(a, "users");
              result = await newUser(b.data);
            } else if (b.action === "user.update") {
              D.permit(a, "users");
              const x = await db
                .prepare("SELECT * FROM users WHERE id=?")
                .get(b.data.id);
              D.assert(x, "Usuario no encontrado.", 404);
              D.assert(Object.hasOwn(D.ROLES, b.data.role), "Rol inválido.");
              D.assert(
                x.id !== a.id ||
                  (b.data.active !== false && b.data.role === "admin"),
                "No puedes desactivar tu propio acceso de administrador.",
              );
              const inactive =
                b.data.active === false || b.data.active === "false";
              D.assert(
                x.id !== a.id || !inactive,
                "No puedes desactivar tu propio acceso.",
              );
              await db
                .prepare("UPDATE users SET name=?,role=?,active=? WHERE id=?")
                .run(
                  D.str(b.data.name, "Nombre", 120),
                  b.data.role,
                  inactive ? 0 : 1,
                  x.id,
                );
              if (b.data.password) {
                const salt = crypto.randomBytes(16).toString("hex");
                await db
                  .prepare("UPDATE users SET salt=?,hash=? WHERE id=?")
                  .run(salt, hash(checkPassword(b.data.password), salt), x.id);
              }
              if (x.id !== a.id)
                await db
                  .prepare("DELETE FROM sessions WHERE user_id=?")
                  .run(x.id);
              result = {
                id: x.id,
              };
            } else if (b.action === "backup.restore") {
              D.permit(a, "settings");
              D.assert(
                passwordValid(b.data.password, a),
                "Contraseña de administrador incorrecta.",
                403,
              );
              const file = b.data.backup;
              D.assert(
                file?.format === "aurea-taller-v1" && file.state?.version === 1,
                "Copia de seguridad no compatible.",
              );
              const { checksum, ...content } = file;
              D.assert(
                checksum ===
                  crypto
                    .createHash("sha256")
                    .update(JSON.stringify(content))
                    .digest("hex"),
                "La copia está incompleta o fue modificada.",
              );
              for (const [k, v] of Object.entries(D.initialState()))
                D.assert(
                  k in file.state &&
                    (Array.isArray(v)
                      ? Array.isArray(file.state[k])
                      : typeof v === typeof file.state[k]),
                  "Estructura de copia inválida: " + k,
                );
              for (const x of file.state.ledger)
                D.assert(
                  Number.isSafeInteger(x.mg) &&
                    x.mg > 0 &&
                    Number.isInteger(x.purity) &&
                    x.purity > 0 &&
                    x.purity <= 1000,
                  "Libro de metal inválido.",
                );
              D.assert(
                D.balances(file.state).every((x) => x.mg >= 0),
                "La copia contiene existencias negativas.",
              );
              if (cloud)
                await db.storeBackup(
                  "antes-de-restaurar-" + crypto.randomUUID(),
                  await backup(),
                );
              else
                fs.writeFileSync(
                  path.join(
                    dataDir,
                    "backups",
                    `antes-de-restaurar-${Date.now()}.json`,
                  ),
                  JSON.stringify(await backup()),
                );
              const revision = s.revision;
              Object.assign(s, file.state);
              s.revision = revision;
              if (Array.isArray(file.audit)) {
                const statements = [];
                for (const event of file.audit) {
                  D.assert(
                    event &&
                      typeof event.at === "string" &&
                      typeof event.actor === "string" &&
                      typeof event.action === "string" &&
                      typeof event.details === "string",
                    "Auditoría de copia inválida.",
                  );
                  statements.push({
                    sql: "INSERT INTO audit(at,actor,action,details) VALUES(?,?,?,?)",
                    args: [
                      event.at,
                      event.actor,
                      "restaurado." + event.action,
                      event.details,
                    ],
                  });
                }
                if (cloud && statements.length) await db.batch(statements);
                else
                  for (const stmt of statements)
                    await db.prepare(stmt.sql).run(...stmt.args);
              }
              result = {
                restoredAt: D.now(),
              };
            } else result = D.execute(s, b.action, b.data || {}, a);
            s.revision++;
            await save(s);
            await audit(a, b.action, {
              reference: result?.code || result?.id || null,
              data:
                b.action === "backup.restore"
                  ? {
                      backupAt: b.data.backup.at,
                    }
                  : Object.fromEntries(
                      Object.entries(b.data || {}).filter(
                        ([k]) => !/password|photo/i.test(k),
                      ),
                    ),
            });
            const response = {
              result,
              revision: s.revision,
            };
            await db
              .prepare(
                "INSERT INTO requests(key,user_id,fingerprint,response,at) VALUES(?,?,?,?,?)",
              )
              .run(key, a.id, fp, JSON.stringify(response), Date.now());
            await db
              .prepare("DELETE FROM requests WHERE at<?")
              .run(Date.now() - 30 * 86400000);
            await db.exec("COMMIT");
            return await json(res, 200, response);
          } catch (e) {
            await rollback();
            throw e;
          }
        }
        D.fail("Ruta no encontrada.", 404);
      }
      D.assert(
        req.method === "GET" || req.method === "HEAD",
        "Método no permitido.",
        405,
      );
      const files = {
        "/": ["index.html", "text/html; charset=utf-8"],
        "/index.html": ["index.html", "text/html; charset=utf-8"],
        "/app.js": ["app.js", "text/javascript; charset=utf-8"],
        "/numbers.js": ["numbers.js", "text/javascript; charset=utf-8"],
        "/transport.js": ["transport.js", "text/javascript; charset=utf-8"],
        "/styles.css": ["styles.css", "text/css; charset=utf-8"],
        "/icon.svg": ["icon.svg", "image/svg+xml"],
      };
      const file = files[pathname];
      D.assert(file, "Recurso no encontrado.", 404);
      const content = fs.readFileSync(path.join(root, file[0]));
      res.writeHead(200, {
        ...securityHeaders,
        "Content-Type": file[1],
        "Cache-Control": "no-cache",
      });
      res.end(req.method === "HEAD" ? undefined : content);
    } catch (e) {
      if (
        e.code === "ENOSPC" ||
        (e.code === "ERR_SQLITE_ERROR" && e.errcode === 13)
      ) {
        e.status = 507;
        e.message =
          "No hay espacio suficiente para completar la operación. Libera espacio en el disco y vuelve a intentar.";
      }
      if (!e.status) console.error(e);
      if (!res.headersSent)
        await json(res, e.status || 500, {
          error: e.status
            ? e.message
            : "No se pudo completar la operación. Revisa el registro del servidor.",
        });
      else res.end();
    }
  };
  let queue = Promise.resolve();
  const handler = async (req, res) => {
    // Leer el cuerpo antes del bloqueo evita que un envío lento frene a los demás operadores.
    if (
      req.method === "POST" &&
      req.headers["content-type"]?.startsWith("application/json")
    ) {
      try {
        parsedBodies.set(req, {
          value: await body(req),
        });
      } catch (error) {
        parsedBodies.set(req, {
          error,
        });
      }
    }
    const work = queue.then(() => rawHandler(req, res));
    queue = work.catch(() => {});
    return work;
  };
  const server = http.createServer(handler);
  server.on("close", () => db.close());
  return {
    server,
    db,
    dataDir,
    handler,
    ready,
  };
}
function createLegacyRedirectServer(targetPort = 4183) {
  return http.createServer((req, res) => {
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405, {
        "Content-Type": "text/plain; charset=utf-8",
        Allow: "GET, HEAD",
      });
      res.end("Abre el taller en http://127.0.0.1:" + targetPort);
      return;
    }
    try {
      const target = new URL(req.url, "http://127.0.0.1:" + targetPort);
      res.writeHead(307, {
        Location:
          "http://127.0.0.1:" + targetPort + target.pathname + target.search,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end();
    } catch {
      res.writeHead(400);
      res.end();
    }
  });
}
if (require.main === module) {
  const { server } = createApp(),
    port = Number(process.env.PORT || 4183),
    host = process.env.HOST || "127.0.0.1";
  const legacy = port === 4183 ? createLegacyRedirectServer(port) : null;
  legacy?.on("error", (e) =>
    console.warn(
      e.code === "EADDRINUSE"
        ? "El acceso antiguo 4182 está ocupado; usa http://127.0.0.1:4183."
        : e.message,
    ),
  );
  server.listen(port, host, () => {
    legacy?.listen(4182, "127.0.0.1");
    console.log(
      `ÁUREA TALLER · http://${host}:${server.address().port}\nDatos: ${process.env.TALLER_DATA_DIR || path.join(__dirname, "data")}\nCtrl+C para detener.`,
    );
  });
  server.on("error", (e) => {
    console.error(
      e.code === "EADDRINUSE"
        ? `El puerto ${port} ya está ocupado. Cierra el servidor anterior o define PORT.`
        : e.message,
    );
    process.exitCode = 1;
    server.close();
  });
  const close = () => {
    legacy?.close();
    server.close();
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
}
module.exports = {
  createApp,
  createLegacyRedirectServer,
};
