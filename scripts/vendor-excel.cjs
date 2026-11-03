"use strict";
// Copia reproducible del bundle oficial para funcionar también sin Internet.
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { createHash } = require("node:crypto"), { execFileSync } = require("node:child_process");
(async () => {
  const version = "4.4.0";
  const integrity = "XctvKaEMaj1Ii9oDOqbW/6e1gXknSY4g/aLCDicOXqBE4M0nRWkUu0PTp++UPNzoFY12BNHMfs/VadKIS6llvg==";
  const response = await fetch(`https://registry.npmjs.org/exceljs/-/exceljs-${version}.tgz`);
  if (!response.ok) throw new Error("No se pudo descargar ExcelJS.");
  const data = Buffer.from(await response.arrayBuffer());
  if (createHash("sha512").update(data).digest("base64") !== integrity) throw new Error("Integridad de ExcelJS incorrecta.");
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aurea-excel-vendor-"));
  try {
    const archive = path.join(temp, "exceljs.tgz");
    fs.writeFileSync(archive, data);
    execFileSync("tar", ["-xzf", archive, "-C", temp, "package/dist/exceljs.min.js", "package/LICENSE"], { windowsHide: true });
    const root = path.resolve(__dirname, "..");
    const license = fs.readFileSync(path.join(temp, "package/LICENSE"), "utf8").trimEnd();
    fs.writeFileSync(path.join(root, "exceljs.min.js"), "/*! ExcelJS " + version + " — MIT\n" + license.replace(/\*\//g, "* /") + "\n*/\n" + fs.readFileSync(path.join(temp, "package/dist/exceljs.min.js"), "utf8"));
    fs.writeFileSync(path.join(root, "EXCELJS-LICENSE.txt"), license + "\n");
    console.log("ExcelJS " + version + ": bundle oficial verificado y licencia copiados.");
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
