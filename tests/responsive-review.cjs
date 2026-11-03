"use strict";
const { chromium } = require("playwright");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const { createApp } = require("../server.cjs");

(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "aurea-responsive-"));
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
        workshop: "Taller de revisión de interfaz",
        name: "Administrador",
        username: "revision@example.test",
        password: "1234",
      },
    });
    assert.equal(setup.status(), 201);
    let revision = 1;
    async function action(action, data) {
      const r = await context.request.post(base + "/api/action", {
        headers: {
          "If-Match": String(revision),
          "Idempotency-Key": crypto.randomUUID(),
        },
        data: { action, data },
      });
      const result = await r.json();
      assert.equal(r.status(), 200, JSON.stringify(result));
      revision = result.revision;
      return result.result;
    }
    const client = await action("client.save", {
      name: "Cliente de prueba con nombre y apellidos extensos para revisar tablas",
      document: "123456789",
      phone: "573101234567",
      notes: "Revisión interna",
    });
    const smith = await action("smith.save", {
      name: "Orfebre de revisión",
      bench: "Banco de trabajo número 1",
    });
    await action("settings.save", {
      name: "Taller de revisión de interfaz",
      goldRate: 610000,
      silverRate: 5000,
      platinumRate: 200000,
      taxPercent: 0,
      lossNormal: 2,
      lossWarning: 3.5,
      tolerance: 0.005,
      baudRate: 9600,
      printWidth: 80,
      reason: "Tarifas de revisión",
    });
    await action("inventory.adjust", {
      account: "own",
      metal: "oro",
      purity: 750,
      weight: 450,
      reason: "Existencia de prueba con importes grandes",
    });
    await action("shift.open", { opening: 1000000000 });
    for (let i = 0; i < 4; i++) {
      const o = await action("order.create", {
        clientId: client.id,
        type: "Reparación",
        description:
          "Reparación de cadena y revisión de broche con un texto largo para revisar el ajuste de los formularios y encabezados",
        condition: "Cadena con rayones y broche roto",
        metal: "oro",
        purity: 750,
        receivedWeight: 5,
        dueDate: "2026-11-01",
        labor: 120000,
      });
      if (i > 0)
        await action("order.assign", {
          id: o.id,
          smithId: smith.id,
          customerWeight: 5,
          ownWeight: 0,
        });
      if (i > 1)
        await action("order.return", {
          id: o.id,
          pieceWeight: 4.9,
          scrapWeight: 0.08,
        });
      if (i > 2)
        await action("order.quality", { id: o.id, checks: [true, true, true] });
    }
    const page = await context.newPage();
    const errors = [],
      issues = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const state = (
      await (await context.request.get(base + "/api/state")).json()
    ).state;
    const routes = [
      "dashboard",
      "orders",
      "orders/" + state.orders[0].id,
      "receive",
      "clients",
      "gold",
      "production",
      "smiths",
      "materials",
      "payments",
      "cash",
      "purchases",
      "stock",
      "reports",
      "assistant",
      "users",
      "settings",
      "categories",
      "expenses",
      "reversals",
    ];
    fs.mkdirSync(path.join(__dirname, "../test-results/review"), {
      recursive: true,
    });
    await page.goto(base);
    await page.locator("#page h1").waitFor();
    for (const width of [1440, 1024, 768, 390, 360, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of routes) {
        await page.evaluate((route) => {
          location.hash = route;
        }, route);
        await page.waitForTimeout(40);
        const dimensions = await page.evaluate(() => ({
          viewport: innerWidth,
          width: document.documentElement.scrollWidth,
        }));
        if (dimensions.width > width + 1) {
          issues.push({ width, route, dimensions });
          await page.screenshot({
            path: path.join(
              __dirname,
              "../test-results/review",
              width + "-" + route.replace("/", "-") + ".png",
            ),
            fullPage: true,
          });
        }
        assert.equal(await page.locator("#page h1").count(), 1, route);
        if (
          (width === 390 && route === "orders/" + state.orders[0].id) ||
          (width === 768 && route === "receive")
        ) {
          await page.screenshot({
            path: path.join(
              __dirname,
              "../test-results/review",
              width === 390 ? "orden-movil.png" : "recepcion-tablet.png",
            ),
            fullPage: true,
          });
        }
      }
      await page.evaluate(() => {
        location.hash = "clients";
      });
      await page.waitForTimeout(40);
      await page.locator("[data-action=new-client]").first().click();
      const dialog = await page
        .locator("#dialog")
        .evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
      if (dialog.scroll > dialog.client + 1)
        issues.push({ width, route: "modal-cliente", dimensions: dialog });
      await page.locator("#dialog [data-action=close-modal]").first().click();
    }
    // El botón Atrás debe respetar un formulario sin guardar.
    await page.evaluate(() => {
      location.hash = "receive";
    });
    await page.locator("#receive-form").waitFor();
    await page
      .locator("[name=description]")
      .fill("Trabajo pendiente de guardar");
    page.once("dialog", (d) => d.dismiss());
    await page.goBack();
    assert.equal(
      await page.locator("[name=description]").inputValue(),
      "Trabajo pendiente de guardar",
    );
    assert(page.url().endsWith("#receive"));
    page.once("dialog", (d) => d.accept());
    await page.evaluate(() => {
      location.hash = "clients";
    });
    await page.locator("[data-action=new-client]").first().waitFor();

    // Un guardado en curso no puede cerrarse y descartar otro formulario.
    let releaseSave;
    const saveHeld = new Promise((resolve) => {
      releaseSave = resolve;
    });
    await page.route("**/api/action", async (route) => {
      const response = await route.fetch();
      await saveHeld;
      await route.fulfill({ response });
    });
    await page.locator("[data-action=new-client]").first().click();
    await page
      .locator("#dialog [name=name]")
      .fill("Cliente de guardado en curso");
    await page.locator("#modal-form button[type=submit]").click();
    try {
      assert(
        await page
          .locator("#modal-form [data-action=close-modal]")
          .isDisabled(),
      );
      await page.keyboard.press("Escape");
      assert(await page.locator("#dialog").isVisible());
    } finally {
      releaseSave();
    }
    await page.locator("#dialog").waitFor({ state: "hidden" });
    await page.unroute("**/api/action");

    // Una sesión vencida no debe dejar un modal bloqueando el acceso.
    await page.locator("[data-action=new-client]").first().click();
    await page.locator("#dialog [name=name]").fill("Cliente sin sesión");
    await context.request.post(base + "/api/logout", { data: {} });
    await page.locator("#modal-form button[type=submit]").click();
    await page.locator("#auth-form").waitFor();
    assert(await page.locator("#dialog").isHidden());
    await context.clearCookies();
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base);
      await page.locator("#auth-form").waitFor();
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        )
      )
        issues.push({ width, route: "acceso" });
    }
    console.log(
      JSON.stringify(
        {
          screens: routes.length,
          widths: [1440, 1024, 768, 390, 360, 320],
          issues,
          errors,
        },
        null,
        2,
      ),
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(issues, [], "Desbordamientos en pantallas existentes");
  } finally {
    await browser?.close();
    await new Promise((resolve) => app.server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
