"use strict";
const { chromium } = require("playwright");
const { createApp } = require("../server.cjs");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "aurea-daily-ui-"));
  const app = createApp({ dataDir });
  let browser, releaseSave;
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + app.server.address().port;
  try {
    browser = await chromium.launch({
      headless: true,
      channel: process.env.TALLER_BROWSER || "msedge",
    });
    const context = await browser.newContext();
    await context.request.post(base + "/api/setup", {
      data: {
        workshop: "Jornada de prueba",
        name: "Recepción de prueba",
        username: "diario@example.test",
        password: "1234",
      },
    });
    await context.request.post(base + "/api/action", {
      headers: { "If-Match": "1", "Idempotency-Key": crypto.randomUUID() },
      data: {
        action: "client.save",
        data: { name: "Cliente de prueba", document: "SIM-1" },
      },
    });
    const page = await context.newPage({
        viewport: { width: 1366, height: 900 },
      }),
      issues = [],
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/#receive");
    await page.locator("#receive-form").waitFor();
    const picture = await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 16;
      c.height = 16;
      c.getContext("2d").fillRect(0, 0, 16, 16);
      return c.toDataURL("image/png").split(",")[1];
    });
    await page.locator("[name=photo]").setInputFiles({
      name: "pieza-del-cliente-anterior.png",
      mimeType: "image/png",
      buffer: Buffer.from(picture, "base64"),
    });
    await page.locator("#photo-preview img").waitFor();
    page.once("dialog", (d) => d.accept());
    await page.locator("[data-nav=orders]").click();
    await page.locator("[data-action=receive]").click();
    await page.locator("#receive-form").waitFor();
    if (await page.locator("#photo-preview img").count())
      issues.push(
        "Una recepción nueva hereda la foto de un borrador descartado.",
      );
    await page.locator("[name=photo]").setInputFiles([]);
    await page.waitForTimeout(80);
    if (await page.locator("#photo-preview img").count())
      issues.push(
        "Quitar el archivo de fotografía no elimina su vista previa.",
      );
    await page
      .locator("[name=clientId]")
      .selectOption({ label: "Cliente de prueba · SIM-1" });
    await page
      .locator("[name=description]")
      .fill("Trabajo del segundo cliente");
    await page
      .locator("[name=condition]")
      .fill("Pieza en buen estado, sin piedras");
    await page.locator("[name=receivedWeight]").fill("3,2");
    await page.locator("[name=labor]").fill("120000");
    // La decodificación de una foto también puede terminar después de abandonar el borrador.
    await page.evaluate(() => {
      window.realBitmap = createImageBitmap;
      window.createImageBitmap = async (...args) => {
        const bitmap = await window.realBitmap(...args);
        await new Promise((r) => {
          window.releasePhoto = r;
        });
        return bitmap;
      };
    });
    await page.locator("[name=photo]").setInputFiles({
      name: "foto-lenta.png",
      mimeType: "image/png",
      buffer: Buffer.from(picture, "base64"),
    });
    await page.waitForFunction(() => typeof window.releasePhoto === "function");
    page.once("dialog", (d) => d.accept());
    await page.locator("[data-nav=orders]").click();
    await page.locator("[data-action=receive]").click();
    await page.locator("#receive-form").waitFor();
    await page.evaluate(() => {
      window.releasePhoto();
      window.createImageBitmap = window.realBitmap;
    });
    await page.waitForTimeout(80);
    if (await page.locator("#photo-preview img").count())
      issues.push(
        "Una foto decodificada tarde contamina la siguiente recepción.",
      );
    await page
      .locator("[name=clientId]")
      .selectOption({ label: "Cliente de prueba · SIM-1" });
    await page
      .locator("[name=description]")
      .fill("Trabajo del segundo cliente");
    await page
      .locator("[name=condition]")
      .fill("Pieza en buen estado, sin piedras");
    await page.locator("[name=receivedWeight]").fill("3,2");
    await page.locator("[name=labor]").fill("120000");
    const held = new Promise((resolve) => {
      releaseSave = resolve;
    });
    await page.route("**/api/action", async (route) => {
      const response = await route.fetch();
      await held;
      await route.fulfill({ response });
    });
    await page.locator("#receive-form button[type=submit]").click();
    page.on("dialog", async (d) => {
      await d.accept();
    });
    await page.locator("[data-nav=clients]").click();
    if (!page.url().endsWith("#receive"))
      issues.push(
        "Se puede abandonar una recepción mientras su guardado sigue en curso.",
      );
    releaseSave();
    await page.waitForURL("**/#orders/*");
    await page.unroute("**/api/action");
    const response = await context.request.get(base + "/api/state");
    const data = await response.json();
    assert.equal(data.state.orders.length, 1);
    assert.equal(data.state.orders[0].photo, undefined);
    await page.locator("[data-action=print-order]").click();
    assert.match(
      await page.locator(".receipt").innerText(),
      /Trabajo del segundo cliente/,
    );
    await page.locator("#dialog [data-action=close-modal]").first().click();
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({ dailyBrowserIssues: issues, errors }, null, 2),
    );
    assert.deepEqual(issues, []);
  } finally {
    releaseSave?.();
    await browser?.close();
    await new Promise((r) => app.server.close(r));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
