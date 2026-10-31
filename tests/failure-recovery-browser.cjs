"use strict";
const { chromium } = require("playwright");
const { createApp } = require("../server.cjs");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aurea-recuperacion-ui-"));
  const app = createApp({ dataDir: dir });
  let browser;
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
        workshop: "Fallos UI",
        name: "Admin",
        username: "admin",
        password: "1234",
      },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    await page.goto(base + "/#receive");
    const description = page.locator("#receive-form [name=description]");
    await description.fill("Borrador que debe conservarse");
    await page.locator("[name=receivedWeight]").fill("1,2345");
    await page.locator("[name=labor]").fill("1.234,50");
    await page.locator(".cash-shortcut").click();
    await page.locator("#dialog [name=opening]").fill("10000");
    await page.locator("#modal-form button[type=submit]").click();
    await page.locator("#dialog").waitFor({ state: "hidden" });
    assert.equal(
      await description.inputValue(),
      "Borrador que debe conservarse",
    );
    assert.equal(
      await page.locator("[name=receivedWeight]").inputValue(),
      "1,2345",
      "Guardar otra operación no debe redondear un gramaje inválido ni borrarlo",
    );
    assert.equal(await page.locator("[name=labor]").inputValue(), "1.234,50");
    assert.equal(
      await page
        .locator("[name=receivedWeight]")
        .evaluate((el) => el.validity.valid),
      false,
    );

    // El servidor guarda la operación, pero su respuesta se pierde en la red.
    await page.goto(base + "/#clients");
    await page.locator("[data-action=new-client]").first().click();
    await page.locator("#dialog [name=name]").fill("Una sola vez");
    let lost = false;
    await page.route("**/api/action", async (route) => {
      if (!lost) {
        lost = true;
        await route.fetch();
        await route.abort("failed");
      } else await route.continue();
    });
    await page.locator("#modal-form button[type=submit]").click();
    await page.waitForFunction(() =>
      document
        .querySelector("#modal-form .form-error")
        ?.textContent.includes("conexión"),
    );
    assert.equal(
      await page.locator("#dialog [name=name]").inputValue(),
      "Una sola vez",
    );
    await page.locator("#modal-form button[type=submit]").click();
    await page.locator("#dialog").waitFor({ state: "hidden" });
    await page.unroute("**/api/action");
    const state = (
      await (await context.request.get(base + "/api/state")).json()
    ).state;
    assert.equal(
      state.clients.filter((c) => c.name === "Una sola vez").length,
      1,
    );

    await page.goto(base + "/#receive");
    await page.locator("[name=clientId]").selectOption(state.clients[0].id);
    await page
      .locator("[name=description]")
      .fill("Recepción con respuesta perdida");
    await page.locator("[name=condition]").fill("Sin piedras");
    await page.locator("[name=receivedWeight]").fill("2,5");
    let lostOrder = false;
    await page.route("**/api/action", async (route) => {
      if (
        !lostOrder &&
        route.request().postDataJSON().action === "order.create"
      ) {
        lostOrder = true;
        await route.fetch();
        await route.abort("failed");
      } else await route.continue();
    });
    await page.locator("#receive-form button[type=submit]").click();
    await page.waitForFunction(() =>
      document
        .querySelector("#receive-form .form-error")
        ?.textContent.includes("conexión"),
    );
    // Otra operación provoca un render sin abandonar el borrador pendiente.
    await page.locator(".cash-shortcut").click();
    await page.locator("#dialog [name=counted]").fill("10000");
    await page.locator("#modal-form button[type=submit]").click();
    await page.waitForFunction(
      () =>
        !document.querySelector("#dialog").open ||
        !!document.querySelector("#modal-form .form-error")?.textContent,
    );
    if (await page.locator("#dialog").isVisible())
      await page.locator("#modal-form button[type=submit]").click();
    await page.locator("#dialog").waitFor({ state: "hidden" });
    await page.locator("#receive-form button[type=submit]").click();
    await page.waitForFunction(() => !document.querySelector("#receive-form"));
    await page.unroute("**/api/action");
    const afterRetry = (
      await (await context.request.get(base + "/api/state")).json()
    ).state;
    assert.equal(
      afterRetry.orders.filter(
        (o) => o.description === "Recepción con respuesta perdida",
      ).length,
      1,
      "El reintento debe conservar la misma clave incluso después de otro guardado",
    );

    async function externalAction(action, data) {
      const current = (
        await (await context.request.get(base + "/api/state")).json()
      ).state;
      const response = await context.request.post(base + "/api/action", {
        headers: {
          "If-Match": String(current.revision),
          "Idempotency-Key": crypto.randomUUID(),
        },
        data: { action, data },
      });
      const body = await response.json();
      assert.equal(response.status(), 200, JSON.stringify(body));
      return body.result;
    }
    const oldShift = await externalAction("shift.open", { opening: 10000 });
    await page.reload();
    await page.locator(".cash-shortcut").click();
    await page.locator("[name=counted]").fill("20000");
    await externalAction("shift.close", {
      shiftId: oldShift.id,
      counted: 10000,
      goldCounts: [],
    });
    const newShift = await externalAction("shift.open", { opening: 20000 });
    await page.locator("#modal-form button[type=submit]").click();
    await page.waitForFunction(
      () => !!document.querySelector("#modal-form .form-error")?.textContent,
    );
    await page.locator("#modal-form button[type=submit]").click();
    await page.waitForFunction(() =>
      document
        .querySelector("#modal-form .form-error")
        ?.textContent.includes("turno"),
    );
    const finalState = (
      await (await context.request.get(base + "/api/state")).json()
    ).state;
    assert.equal(finalState.shifts.find((x) => !x.closedAt).id, newShift.id);
    assert(await page.locator("#dialog").isVisible());
    assert.deepEqual(errors, []);
    console.log(
      "Recuperación verificada: borrador incompleto conservado y reintento tras pérdida de respuesta sin duplicar registros.",
    );
  } finally {
    await browser?.close();
    await new Promise((r) => app.server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
