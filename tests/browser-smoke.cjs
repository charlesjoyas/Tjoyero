"use strict";
// Ejecutar con Playwright disponible en NODE_PATH o instalado como dependencia de desarrollo.
const { chromium } = require("playwright");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const { createApp } = require("../server.cjs");
(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "aurea-ui-")),
    app = createApp({ dataDir });
  let browser;
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + app.server.address().port;
  try {
    browser = await chromium.launch({
      headless: true,
      channel: process.env.TALLER_BROWSER || "msedge",
    });
    const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
        locale: "es-CO",
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto(base);
    await page
      .locator("[name=workshop]")
      .fill("Taller Áurea · Prueba de interfaz");
    await page.locator("[name=name]").fill("Carlos Duque");
    await page.locator("[name=username]").fill("admin.taller@example.test");
    await page.locator("[name=password]").fill("1234");
    await page.locator('[data-action="toggle-password"]').click();
    assert.equal(
      await page.locator("[name=password]").getAttribute("type"),
      "text",
    );
    await page.locator('[data-action="toggle-password"]').click();
    assert.equal(
      await page.locator("[name=password]").getAttribute("type"),
      "password",
    );
    await page.locator("#auth-form button[type=submit]").click();
    await page.locator("h1").filter({ hasText: "Carlos" }).waitFor();
    const click = async (action) => {
      await page.locator(`[data-action="${action}"]`).first().click();
    };
    const submit = async () => {
      await page.locator("#modal-form button[type=submit]").click();
      await page.locator("#dialog").waitFor({ state: "hidden" });
    };
    await page.locator("[data-nav=settings]").click();
    await page.locator("[name=goldRate]").fill("610000");
    await page
      .locator("[name=reason]")
      .fill("Tarifa del taller fijada por administrador para la prueba");
    const configSaved = page.waitForResponse(
      (r) => r.url().endsWith("/api/action") && r.request().method() === "POST",
    );
    await page.locator("#settings-form button[type=submit]").click();
    assert.equal((await configSaved).status(), 200);
    await page.locator("[data-nav=dashboard]").click();
    await click("new-client");
    await page.locator("#dialog [name=name]").fill("Lucía Restrepo");
    await page.locator("[name=document]").fill("43890112");
    await page.locator("[name=phone]").fill("573104459012");
    await submit();
    await click("new-smith");
    await page.locator("#dialog [name=name]").fill("Pedro Martínez");
    await page.locator("[name=bench]").fill("Banco 2 · Argollas y sortijas");
    await submit();
    await page.locator("[data-nav=cash]").click();
    await click("open-shift");
    await page.locator("[name=opening]").fill("300000");
    await submit();
    await page.locator("[data-nav=orders]").click();
    await click("receive");
    await page
      .locator("[name=clientId]")
      .selectOption({ label: "Lucía Restrepo · 43890112" });
    await page
      .locator("[name=description]")
      .fill("Soldadura de cadena y cambio de broche");
    await page.locator("[name=receivedWeight]").fill("4,800");
    await page
      .locator("[name=condition]")
      .fill("Cadena 18k con eslabón roto. Broche sin resorte; sin piedras.");
    await page.locator("[name=labor]").fill("95000");
    await page.locator("[name=materialPrice]").fill("25000");
    await page.locator("[name=dueDate]").fill("2026-11-05");
    await page.locator("#receive-form button[type=submit]").click();
    await page.locator("h1").filter({ hasText: "T-0001" }).waitFor();
    await click("assign-order");
    await page.locator("[name=smithId]").selectOption({
      label: "Pedro Martínez · Banco 2 · Argollas y sortijas",
    });
    await page.locator("[name=smithFee]").fill("40000");
    await submit();
    await click("progress-order");
    await page.locator("[name=note]").fill("Soldadura completada. En pulido.");
    await submit();
    await click("return-order");
    await page.locator("[name=pieceWeight]").fill("4,750");
    await page.locator("[name=scrapWeight]").fill("0,030");
    await submit();
    await click("quality-order");
    await page.locator("[name=size]").check();
    await page.locator("[name=finish]").check();
    await page.locator("[name=gems]").check();
    await submit();
    await click("pay-order");
    await page.locator("[name=cash]").fill("150000");
    assert.match(await page.locator("#payment-preview").innerText(), /30\.000/);
    await submit();
    await click("deliver-order");
    await page
      .locator("[name=acceptance]")
      .fill("Lucía Restrepo · CC 43890112");
    await submit();
    assert.match(await page.locator(".order-header").innerText(), /Entregada/);
    await click("print-order");
    assert.match(await page.locator(".receipt").innerText(), /V-0001/);
    await click("close-modal");
    await page.locator("[data-nav=materials]").click();
    await click("new-material");
    await page.locator("#dialog [name=name]").fill("Esmeralda de prueba");
    await page.locator("[name=quantity]").fill("5");
    await page.locator("[name=unitCost]").fill("100000");
    await submit();
    await page.locator("[data-nav=purchases]").click();
    await click("new-supplier");
    await page.locator("#dialog [name=name]").fill("Refinadora de prueba");
    await page.locator("[name=document]").fill("900001");
    await submit();
    await click("new-metal-purchase");
    await page.locator("[name=document]").fill("FA-100");
    await page.locator("[name=purity]").fill("1000");
    await page.locator("[name=weight]").fill("1");
    await page.locator("[name=rate]").fill("610000");
    await submit();
    await click("pay-supplier");
    await page.locator("[name=reference]").fill("TRF-PROV-1");
    await submit();
    await page.locator("[data-nav=production]").click();
    await click("new-melt");
    await page.locator("[name=inputPurity]").fill("1000");
    await page.locator("[name=inputWeight]").fill("1");
    await page.locator("[name=alloyWeight]").fill("0,333");
    await page.locator("[name=outputWeight]").fill("1,320");
    await page.locator("[name=notes]").fill("Ensayo 750 verificado");
    await submit();
    await page.locator("[data-nav=orders]").click();
    await click("receive");
    await page.locator("[name=type]").selectOption("Producción propia");
    assert(await page.locator("[name=clientId]").isDisabled());
    await page
      .locator("[name=description]")
      .fill("Sortija propia para vitrina");
    await page
      .locator("[name=condition]")
      .fill("Producción interna con metal de bodega");
    await page.locator("#receive-form button[type=submit]").click();
    await page.locator("h1").filter({ hasText: "T-0002" }).waitFor();
    await click("use-material");
    await page.locator("[name=quantity]").fill("1");
    await submit();
    await click("assign-order");
    await page.locator("[name=ownWeight]").fill("1");
    await page.locator("[name=source]").selectOption("melt");
    await page.locator("[name=smithFee]").fill("40000");
    await submit();
    await click("return-order");
    await page.locator("[name=pieceWeight]").fill("0,980");
    await page.locator("[name=scrapWeight]").fill("0,010");
    await submit();
    await click("quality-order");
    await page.locator("[name=size]").check();
    await page.locator("[name=finish]").check();
    await page.locator("[name=gems]").check();
    await submit();
    await click("receive-stock");
    await page.locator("[name=price]").fill("900000");
    await submit();
    await page.locator("[data-nav=stock]").click();
    await click("transfer-stock");
    await page
      .locator("[name=destination]")
      .fill("Joyería de prueba · Persona receptora");
    await submit();
    const transferDownload = page.waitForEvent("download");
    await click("export-transfer");
    assert.match((await transferDownload).suggestedFilename(), /traslado/);
    await page.locator("[data-nav=users]").click();
    await click("new-user");
    await page.locator("#dialog [name=name]").fill("Consulta de prueba");
    await page.locator("[name=username]").fill("consulta");
    await page.locator("[name=password]").fill("consulta-prueba-123");
    await submit();
    for (const route of [
      "dashboard",
      "orders",
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
    ]) {
      await page.locator(`[data-nav="${route}"]`).click();
      await page.waitForTimeout(70);
      assert(await page.locator("h1").count(), route);
    }
    await page.locator("[data-nav=orders]").click();
    await page.locator("#order-search").fill("Lucía");
    assert.match(await page.locator("tbody").innerText(), /T-0001/);
    await page.locator("#order-search").fill("no coincide");
    assert.match(await page.locator("tbody").innerText(), /Todo en su lugar/);
    await page.locator("#order-search").fill("");
    await page.locator("[data-nav=dashboard]").click();
    fs.mkdirSync(path.join(__dirname, "../test-results"), { recursive: true });
    await page.screenshot({
      path: path.join(__dirname, "../test-results/escritorio.png"),
      fullPage: true,
    });
    const downloadPromise = page.waitForEvent("download");
    await page.locator("[data-nav=settings]").click();
    await click("download-backup");
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /\.json$/);
    await page.locator("[data-nav=gold]").click();
    await click("adjust-metal");
    await page.locator("[name=weight]").fill("12,400");
    await page
      .locator("[name=reason]")
      .fill("Saldo inicial verificado en balanza");
    await submit();
    await page.locator("[data-nav=orders]").click();
    await page.locator("[data-action=order-board]").click();
    assert.equal(await page.locator(".kanban-col").count(), 5);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("[data-action=menu]").click();
    await page.locator("[data-nav=dashboard]").click();
    await page.screenshot({
      path: path.join(__dirname, "../test-results/movil.png"),
      fullPage: true,
    });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
      "La vista móvil no debe desbordar horizontalmente.",
    );
    await page.locator("[data-action=menu]").click();
    await page.locator("[data-nav=cash]").click();
    await click("close-shift");
    await page.locator("[name=counted]").fill("420000");
    await submit();
    assert.deepEqual(errors, [], "Errores de navegador");
    console.log(
      "Interfaz verificada: recepción, producción, insumos, cobros, entrega, compras, fundición, stock, transferencia, usuarios, copia, arqueo y diseño móvil.",
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
