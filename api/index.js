"use strict";
const { createApp } = require("../server.cjs");
const { createCloudStorage } = require("../cloud-storage.cjs");
let application;
async function getApplication() {
  if (!application)
    application = (async () => {
      if (
        !process.env.TALLER_SETUP_KEY ||
        process.env.TALLER_SETUP_KEY.length < 24
      )
        throw new Error(
          "Configura TALLER_SETUP_KEY con al menos 24 caracteres aleatorios para proteger el primer administrador.",
        );
      const storage = await createCloudStorage();
      try {
        const app = createApp({
          storage,
          setupKey: process.env.TALLER_SETUP_KEY,
        });
        await app.ready;
        return app;
      } catch (error) {
        storage.close();
        throw error;
      }
    })().catch((error) => {
      application = null;
      throw error;
    });
  return application;
}
function createServerlessHandler(open = getApplication) {
  return async (req, res) => {
    try {
      const url = new URL(req.url, "https://localhost");
      if (url.pathname === "/api/index" && url.searchParams.has("__route")) {
        const route = url.searchParams.get("__route");
        url.searchParams.delete("__route");
        req.url = "/api/" + route + (url.search ? url.search : "");
      }
      await (await open()).handler(req, res);
    } catch (error) {
      console.error(
        "Áurea: no se pudo iniciar el servicio de nube.",
        /^(Configura |TURSO_DATABASE_URL)/.test(error.message || "")
          ? error.message
          : error.code || error.name,
      );
      res.writeHead(503, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Retry-After": "15",
      });
      res.end(
        JSON.stringify({
          error:
            "El servicio aún no está configurado o la base de datos no está disponible. Revisa las variables privadas y los registros del despliegue en Vercel.",
        }),
      );
    }
  };
}
module.exports = createServerlessHandler();
module.exports.createServerlessHandler = createServerlessHandler;
