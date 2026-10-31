"use strict";
const { chromium } = require("playwright");
const { createApp } = require("../server.cjs");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "aurea-settings-"));
  const app = createApp({ dataDir });
  let browser;
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + app.server.address().port;
  try {
    browser = await chromium.launch({
      headless: true,
      channel: process.env.TALLER_BROWSER || "msedge",
    });
    const context = await browser.newContext();
    const setup = await context.request.post(base + "/api/setup", {
      data: {
        workshop: "Revisión de controles",
        name: "Prueba",
        username: "prueba@example.test",
        password: "1234",
      },
    });
    assert.equal(setup.status(), 201);
    // Emula únicamente el transporte serial para probar el código de la aplicación.
    // Esta prueba no certifica una balanza ni una impresora físicas.
    await context.addInitScript(() => {
      let controller;
      Object.defineProperty(navigator, "serial", {
        configurable: true,
        value: {
          requestPort: async () => ({
            open: async (options) => {
              window.serialOptions = options;
            },
            close: async () => {
              window.serialClosed = true;
            },
            readable: new ReadableStream({
              start(c) {
                controller = c;
              },
              cancel() {},
            }),
          }),
        },
      });
      window.sendScaleLine = (line) =>
        controller.enqueue(new TextEncoder().encode(line + "\r\n"));
      window.print = () => {
        window.printRequested = true;
      };
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/#settings");
    await page.locator("#settings-form").waitFor();
    await page.locator("[name=serialBaud]").selectOption("19200");
    await page
      .locator("[name=reason]")
      .fill("Prueba de persistencia del puerto");
    await page.locator("#settings-form button[type=submit]").click();
    await page.waitForFunction(() =>
      document.querySelector(".footer-note").textContent.includes("revisión 2"),
    );
    await page.reload();
    await page.locator("#settings-form").waitFor();
    assert.equal(await page.locator("[name=serialBaud]").inputValue(), "19200");
    await page.locator("[data-action=connect-scale]").click();
    await page.locator("[data-action=disconnect-scale]").waitFor();
    assert.equal(
      await page.evaluate(() => window.serialOptions.baudRate),
      19200,
    );
    await page.evaluate(() => window.sendScaleLine("ST,GS,+00012.345 g"));
    await page.waitForFunction(() =>
      document.querySelector(".scale-status").textContent.includes("12,345"),
    );
    await page.evaluate(() => {
      location.hash = "receive";
    });
    await page.locator("#receive-form").waitFor();
    await page.locator("[data-action=capture-received]").click();
    assert.equal(
      await page.locator("[name=receivedWeight]").inputValue(),
      "12,345",
    );
    await page.evaluate(() => window.sendScaleLine("US,GS,+00020.000 g"));
    await page.waitForTimeout(80);
    await page.locator("[data-action=capture-received]").click();
    assert.equal(
      await page.locator("[name=receivedWeight]").inputValue(),
      "12,345",
    );
    assert.match(
      await page.locator("#toast").innerText(),
      /no ha marcado una lectura estable/,
    );
    page.once("dialog", (d) => d.accept());
    await page.locator("[data-nav=settings]").click();
    await page.locator("[data-action=disconnect-scale]").click();
    await page.waitForFunction(() =>
      document
        .querySelector(".scale-status")
        .textContent.includes("sin conectar"),
    );
    assert.equal(
      await page.locator("[data-action=disconnect-scale]").count(),
      0,
    );
    assert(!(await page.locator("[data-action=connect-scale]").isDisabled()));
    await page.locator("[data-action=test-print]").click();
    assert.match(
      await page.locator(".receipt").innerText(),
      /PRUEBA DE IMPRESIÓN/,
    );
    await page.locator("[data-action=print-current]").click();
    assert(await page.evaluate(() => window.printRequested === true));
    assert.match(await page.locator("#print-area").textContent(), /12,400 g/);
    await page.locator("#dialog [data-action=close-modal]").first().click();
    const downloaded = page.waitForEvent("download");
    await page.locator("[data-action=download-backup]").click();
    const file = await downloaded;
    const backup = JSON.parse(fs.readFileSync(await file.path(), "utf8"));
    assert.equal(backup.format, "aurea-taller-v1");
    assert.equal(backup.state.settings.baudRate, 19200);
    assert(
      fs
        .readdirSync(path.join(dataDir, "backups"))
        .some((x) => x.startsWith("taller-")),
    );
    assert.deepEqual(errors, []);
    console.log(
      "Controles verificados: velocidad persistente, conexión y captura serial emulada, rechazo de peso inestable, desconexión, impresión del navegador y descarga de copia.",
    );
  } finally {
    await browser?.close();
    await new Promise((resolve) => app.server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
