"use strict";
const fs = require("node:fs");
const { createCloudStorage, unpack } = require("../cloud-storage.cjs");
(async () => {
  const [name, destination] = process.argv.slice(2);
  const storage = await createCloudStorage();
  try {
    if (!name) {
      console.table(
        await storage
          .prepare("SELECT name,at FROM cloud_backups ORDER BY at DESC")
          .all(),
      );
      return;
    }
    if (!destination)
      throw new Error("Indica el nombre de la copia y la ruta de salida JSON.");
    const row = await storage
      .prepare("SELECT json FROM cloud_backups WHERE name=?")
      .get(name);
    if (!row) throw new Error("No existe una copia con ese nombre.");
    fs.writeFileSync(destination, unpack(row.json), { flag: "wx" });
    console.log("Copia exportada a", destination);
  } finally {
    storage.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
