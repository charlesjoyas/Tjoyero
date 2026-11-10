"use strict";
const { chromium } = require("playwright");
const { createApp } = require("../server.cjs");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "aurea-apertura-ui-")),
    app = createApp({ dataDir });
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
        workshop: "Caja de prueba",
        name: "Administrador",
        username: "admin",
        password: "1234",
      },
    });
    let revision = 1;
    async function act(action, data) {
      const r = await context.request.post(base + "/api/action", {
        headers: {
          "If-Match": String(revision),
          "Idempotency-Key": crypto.randomUUID(),
        },
        data: { action, data },
      });
      const b = await r.json();
      assert.equal(r.status(), 200, JSON.stringify(b));
      revision = b.revision;
      return b.result;
    }
    await act("settings.save", {
      name: "Caja de prueba",
      goldRate: 610000,
      silverRate: 0,
      platinumRate: 0,
      taxPercent: 0,
      lossNormal: 2,
      lossWarning: 3.5,
      tolerance: 0.005,
      printWidth: 80,
      baudRate: 9600,
      reason: "Tarifas de prueba",
    });
    for (const purity of [750, 585])
      await act("inventory.adjust", {
        account: "own",
        metal: "oro",
        purity,
        weight: 20,
        reason: "Saldo inicial",
      });
    const client = await act("client.save", { name: "Cliente de prueba" });
    await act("order.create", {
      clientId: client.id,
      type: "Reparación",
      description: "Broche reparado",
      condition: "Sin piedras",
      metal: "oro",
      purity: 750,
      receivedWeight: 3,
      labor: 60000,
      dueDate: "2026-11-30",
    });
    const page = await context.newPage({
        viewport: { width: 1440, height: 1000 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/#dashboard");
    await page.locator("#page h1").waitFor();
    const click = async (name) =>
      page
        .locator('[data-action="' + name + '"]')
        .first()
        .click();
    async function submit() {
      await page.locator("#modal-form button[type=submit]").click();
      await page.waitForFunction(
        () =>
          !document.querySelector("#dialog").open ||
          !!document.querySelector("#modal-form .form-error")?.textContent,
      );
      if (await page.locator("#dialog").isVisible())
        throw new Error(
          await page.locator("#modal-form .form-error").innerText(),
        );
    }
    const shortcut = page.locator(".topbar .cash-shortcut");
    assert.equal(await shortcut.innerText(), "Abrir caja");
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      const box = await shortcut.boundingBox();
      assert(box && box.x >= 0 && box.x + box.width <= width);
      assert(await shortcut.isVisible());
    }
    await shortcut.click();
    assert.equal(await page.locator("[name=mode]").inputValue(), "cash");
    assert(await page.locator("[data-opening-gold]").isHidden());
    await page.locator("[name=opening]").fill("300000");
    await submit();
    assert.equal(await shortcut.innerText(), "Cerrar caja");
    assert.equal(new URL(page.url()).hash, "#dashboard");
    await page.goto(base + "/#clients");
    await shortcut.click();
    await page.locator("[name=counted]").fill("300000");
    await submit();
    assert.equal(await shortcut.innerText(), "Abrir caja");
    assert.equal(new URL(page.url()).hash, "#clients");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + "/#cash");
    await page.locator("#page h1").waitFor();
    await click("open-shift");
    await page.locator("[name=mode]").selectOption("gold");
    assert(await page.locator("[name=opening]").isDisabled());
    assert(await page.locator("[data-opening-cash]").isHidden());
    await page.locator('[name="openingWeight-0"]').fill("5,2");
    assert.match(await page.locator("#opening-preview").innerText(), /5,200 g/);
    await submit();
    await click("print-shift");
    assert.match(
      await page.locator(".receipt").innerText(),
      /Modalidad de apertura: Oro/,
    );
    assert.match(await page.locator(".receipt").innerText(), /5,200 g/);
    await click("close-modal");
    await page.locator("[data-nav=payments]").click();
    await click("new-payment");
    await page.locator("[name=cash]").fill("20000");
    await page.locator("[name=goldWeight]").fill("0,1");
    await submit();
    await page.locator("[data-nav=cash]").click();
    await page.waitForFunction(
      () => document.querySelector("#page h1")?.textContent === "Caja y turnos",
    );
    assert.match(await page.locator("#page").innerText(), /5,300 g/);
    await click("close-shift");
    await page.locator("[name=counted]").fill("14250");
    await page.locator('[name="gold-0"]').fill("5,3");
    await page.locator("[name=receiver]").fill("Bodeguero");
    await submit();
    await click("open-shift");
    await page.locator("[name=mode]").selectOption("mixed");
    await page.locator("[name=opening]").fill("100000");
    await page.locator('[name="openingWeight-0"]').fill("3");
    await click("add-opening-gold");
    const extra = page.locator("[data-opening-row]").nth(1);
    await extra.locator("input[name^=openingPurity]").fill("585");
    await extra.locator("input[name^=openingWeight]").fill("2");
    assert.match(
      await page.locator("#opening-preview").innerText(),
      /3,420 g fino/,
    );
    await submit();
    fs.mkdirSync(path.join(__dirname, "../test-results"), { recursive: true });
    await page.screenshot({
      path: path.join(__dirname, "../test-results/caja-mixta.png"),
      fullPage: true,
    });
    await click("cash-entry");
    await page.locator("#modal-form [name=amount]").fill("25.000");
    await page.locator("#modal-form [name=note]").fill("Ingreso de prueba");
    assert.match(await page.locator("#cash-income-preview").innerText(), /125\.000,00/);
    await submit();
    await page.reload();
    const income = page.locator("tr").filter({ hasText: "Ingreso de prueba" });
    await income.waitFor();
    assert.equal(await income.count(), 1);
    assert.match(await income.innerText(), /Ingreso adicional/);
    await click("close-shift");
    assert.match(await page.locator("[name=expected]").inputValue(), /125\.000,00/);
    await page.locator("[name=counted]").fill("125000");
    await page.locator('[name="gold-0"]').fill("2");
    await page.locator('[name="gold-1"]').fill("3");
    await page.locator("[name=receiver]").fill("Bodeguero");
    await submit();
    assert.equal(await page.locator("section.table-card tbody tr").count(), 3);
    await page
      .locator("section.table-card [data-action=print-shift]")
      .first()
      .click();
    assert.match(
      await page.locator(".receipt").innerText(),
      /Modalidad de apertura: Mixto/,
    );
    assert.match(
      await page.locator(".receipt").innerText(),
      /Base inicial de oro · ley 585/,
    );
    await click("close-modal");
    for (const width of [768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await click("open-shift");
      await page.locator("[name=mode]").selectOption("mixed");
      await page.locator("[name=opening]").fill("100000");
      await page.locator('[name="openingWeight-0"]').fill("3,254");
      await click("add-opening-gold");
      await page
        .locator("[data-opening-row]")
        .nth(1)
        .locator("input[name^=openingPurity]")
        .fill("585");
      await page
        .locator("[data-opening-row]")
        .nth(1)
        .locator("input[name^=openingWeight]")
        .fill("1,25");
      const dim = await page.locator("#dialog").evaluate((el) => ({
        scroll: el.scrollWidth,
        width: el.clientWidth,
        box: el.getBoundingClientRect().width,
      }));
      assert(
        dim.scroll <= dim.width + 1 && dim.box <= width,
        "El formulario debe ajustarse al dispositivo",
      );
      await click("remove-opening-gold");
      assert.equal(await page.locator("[data-opening-row]").count(), 1);
      if (width === 390)
        await page.screenshot({
          path: path.join(
            __dirname,
            "../test-results/apertura-mixta-movil.png",
          ),
          fullPage: true,
        });
      await click("close-modal");
    }
    const s = (await (await context.request.get(base + "/api/state")).json())
      .state;
    assert.equal(s.shifts.length, 3);
    assert(s.shifts.every((x) => x.closedAt));
    assert.equal(s.shifts.at(-1).expected, 125000);
    assert.equal(s.shifts.at(-1).difference, 0);
    assert.equal(s.payments.length, 1);
    assert.deepEqual(errors, []);
    console.log(
      "Verificado en navegador: efectivo, oro, apertura mixta con varias leyes, recaudo, arqueo, impresión y responsive.",
    );
  } finally {
    await browser?.close();
    await new Promise((r) => app.server.close(r));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
