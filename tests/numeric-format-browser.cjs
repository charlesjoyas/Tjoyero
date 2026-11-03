"use strict";
const { chromium } = require("playwright");
const { createApp } = require("../server.cjs");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "aurea-numeros-")),
    app = createApp({ dataDir });
  let browser;
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + app.server.address().port;
  try {
    browser = await chromium.launch({
      headless: true,
      channel: process.env.TALLER_BROWSER || "msedge",
    });
    const context = await browser.newContext({ locale: "es-CO" });
    await context.request.post(base + "/api/setup", {
      data: {
        workshop: "Formato de prueba",
        name: "Administrador",
        username: "formato@example.test",
        password: "1234",
      },
    });
    const page = await context.newPage({
        viewport: { width: 1440, height: 1000 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/#clients");
    await page.locator("#page h1").waitFor();
    const click = async (action) =>
      page
        .locator('[data-action="' + action + '"]')
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
    await click("new-client");
    await page.locator("#dialog [name=name]").fill("Cliente numérico");
    await page.locator("[name=document]").fill("0012345678");
    await page.locator("[name=phone]").fill("03101234567");
    await submit();
    assert.match(await page.locator("#page").innerText(), /0012345678/);
    await page.locator("[data-nav=orders]").click();
    await click("receive");
    await page
      .locator("[name=clientId]")
      .selectOption({ label: "Cliente numérico · 0012345678" });
    await page
      .locator("[name=description]")
      .fill("Trabajo con formato colombiano");
    await page.locator("[name=condition]").fill("Pieza revisada");
    const labor = page.locator("[name=labor]"),
      weight = page.locator("[name=receivedWeight]");
    assert.equal(await labor.inputValue(), "0,00");
    assert.equal(await weight.inputValue(), "0,000");
    await labor.fill("");
    await labor.pressSequentially("1234567");
    assert.equal(await labor.inputValue(), "1.234.567");
    await labor.press("Tab");
    assert.equal(await labor.inputValue(), "1.234.567,00");
    await labor.fill("1.234,50");
    assert.match(
      await labor.evaluate((el) => el.validationMessage),
      /pesos enteros/,
    );
    await labor.fill("1,234.56");
    assert.match(
      await labor.evaluate((el) => el.validationMessage),
      /formato colombiano/,
    );
    await labor.fill("$ 1.234.567,00 COP");
    assert.equal(await labor.inputValue(), "1.234.567,00");
    await weight.fill("1234,567");
    await weight.press("Tab");
    assert.equal(await weight.inputValue(), "1.234,567");
    await weight.fill("1,2345");
    assert.match(
      await weight.evaluate((el) => el.validationMessage),
      /precisión/,
    );
    await weight.fill("1234,567");
    await page.locator("[name=materialPrice]").fill("45000");
    await page.locator("[name=taxPercent]").fill("19,00");
    await page.locator("[name=purity]").fill("750,00");
    assert.equal(await page.locator("input[type=number]").count(), 0);
    await page.locator("#receive-form button[type=submit]").click();
    await page.locator("h1").filter({ hasText: "T-0001" }).waitFor();
    let data = (await (await context.request.get(base + "/api/state")).json())
      .state;
    assert.equal(data.clients[0].document, "0012345678");
    assert.equal(data.clients[0].phone, "03101234567");
    assert.equal(data.orders[0].receivedMg, 1234567);
    assert.equal(data.orders[0].labor, 1234567);
    assert.equal(data.orders[0].taxPercent, 19);
    assert.equal(data.orders[0].purity, 750);
    assert.equal(data.orders[0].tax, 243118);
    assert.match(await page.locator("#page").innerText(), /1\.522\.685,00/);
    assert.match(await page.locator("#page").innerText(), /1\.234,567 g/);
    assert.match(await page.locator("#page").innerText(), /750,00/);
    assert.match(
      await page.locator(".timeline").innerText(),
      /1\.522\.685,00 COP/,
    );
    await click("edit-order");
    assert.equal(await labor.inputValue(), "1.234.567,00");
    await page.locator("#dialog [name=labor]").fill("1234568");
    await page.locator("#dialog [name=reason]").fill("Revisión de importe");
    await submit();
    await page.locator("[data-nav=cash]").click();
    await click("open-shift");
    await page.locator("[name=opening]").fill("2000000");
    await page.locator("[name=opening]").press("Tab");
    assert.equal(
      await page.locator("[name=opening]").inputValue(),
      "2.000.000,00",
    );
    await submit();
    await page.locator("[data-nav=payments]").click();
    await click("new-payment");
    await page.locator("[name=cash]").fill("2000000");
    await submit();
    data = (await (await context.request.get(base + "/api/state")).json())
      .state;
    assert.equal(data.payments[0].cash, 2000000);
    assert.equal(data.payments[0].applied, 1522686);
    assert.equal(data.payments[0].change, 477314);
    await click("print-payment");
    assert.match(await page.locator(".receipt").innerText(), /2\.000\.000,00/);
    assert.match(await page.locator(".receipt").innerText(), /477\.314,00/);
    await click("close-modal");
    const downloading = page.waitForEvent("download");
    await click("export-payments");
    const file = await downloading;
    assert.match(file.suggestedFilename(), /\.xlsx$/);
    const book = new (require("../exceljs.min.js").Workbook)();
    await book.xlsx.load(fs.readFileSync(await file.path()));
    assert.equal(book.worksheets[0].getCell("D2").value, 2000000);
    assert.equal(book.worksheets[0].getCell("J2").value, 477314);
    assert.equal(book.worksheets[0].getCell("D2").numFmt, "[$-es-CO]#,##0.00");
    await page.locator("[data-nav=settings]").click();
    const percent = page.locator("[name=lossNormal]");
    await percent.fill("");
    await percent.pressSequentially("2.5");
    await percent.press("Tab");
    assert.equal(await percent.inputValue(), "2,50");
    await percent.press("ArrowUp");
    assert.equal(await percent.inputValue(), "2,51");
    page.once("dialog", (d) => d.accept());
    await page.locator("[data-nav=dashboard]").click();
    fs.mkdirSync(path.join(__dirname, "../test-results"), { recursive: true });
    await page.screenshot({
      path: path.join(__dirname, "../test-results/formato-numerico.png"),
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    console.log(
      "Formato global verificado: miles, decimales, edición, coma y teclado decimal, precisión, moneda entera, gramos, porcentajes, comprobantes, Excel e identificadores intactos.",
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
