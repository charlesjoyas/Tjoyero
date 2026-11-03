"use strict";
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "public");
fs.mkdirSync(output, { recursive: true });
const allowed = [
  "index.html",
  "app.js",
  "numbers.js",
  "labor-estimate.js",
  "production-metals.js",
  "transport.js",
  "excel-export.js",
  "exceljs.min.js",
  "styles.css",
  "icon.svg",
];
// Solo se publica esta lista; jamás se copian data, credenciales o código del servidor.
for (const entry of fs.readdirSync(output)) {
  if (!allowed.includes(entry))
    throw new Error(
      "El directorio public contiene un archivo ajeno al build: " + entry,
    );
}
for (const name of allowed)
  fs.copyFileSync(path.join(root, name), path.join(output, name));
console.log(
  "Build web listo: " +
    allowed.length +
    " archivos públicos. API en api/index.js.",
);
