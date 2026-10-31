"use strict";
const { chromium } = require("playwright");
const { createApp } = require("../server.cjs");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aurea-despliegue-ui-"));
  const app = createApp({ dataDir: dir });
  let browser;
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + app.server.address().port;
  try {
    const channels = ["msedge"];
    if (fs.existsSync("C:/Program Files/Google/Chrome/Application/chrome.exe"))
      channels.push("chrome");
    for (const channel of channels) {
      browser = await chromium.launch({ channel, headless: true });
      const context = await browser.newContext({ locale: "es-CO" });
      const api = context.request;
      if (channel === "msedge")
        assert.equal(
          (
            await api.post(base + "/api/setup", {
              data: {
                workshop: "Taller de despliegue",
                name: "Admin",
                username: "admin",
                password: "1234",
              },
            })
          ).status(),
          201,
        );
      else
        assert.equal(
          (
            await api.post(base + "/api/login", {
              data: { username: "admin", password: "1234" },
            })
          ).status(),
          200,
        );
      const action = async (action, data) => {
        const s = (await (await api.get(base + "/api/state")).json()).state;
        const response = await api.post(base + "/api/action", {
          headers: {
            "If-Match": String(s.revision),
            "Idempotency-Key": crypto.randomUUID(),
          },
          data: { action, data },
        });
        const body = await response.json();
        assert.equal(response.status(), 200, JSON.stringify(body));
        return body.result;
      };
      const c = await action("client.save", {
        name: '<img src=x onerror="window.inyectado=true">',
        document: "00012345" + channel,
      });
      const o = await action("order.create", {
        clientId: c.id,
        type: "Reparación",
        description: "Detalle del trabajo áéíóú ñ\n".repeat(40),
        condition: "Piedras y ensambles conservados",
        metal: "oro",
        purity: 750,
        receivedWeight: 1234.567,
        labor: 1000000000000,
        dueDate: "2026-11-30",
      });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      await page.addInitScript(() => {
        window.print = () => {};
      });
      const external = [],
        errors = [];
      await page.route("**/*", (route) => {
        if (new URL(route.request().url()).origin === base)
          return route.continue();
        external.push(route.request().url());
        return route.abort();
      });
      page.on("pageerror", (e) => errors.push(e.message));
      for (const printWidth of [58, 80]) {
        await action("settings.save", {
          name: "Taller instalado",
          goldRate: 610000,
          silverRate: 6000,
          platinumRate: 180000,
          taxPercent: 0,
          lossNormal: 2,
          lossWarning: 3.5,
          tolerance: 0.005,
          printWidth,
          baudRate: 9600,
          reason: "Formato de comprobante",
        });
        await page.goto(base + "/?papel=" + printWidth + "#orders/" + o.id);
        await page.locator("[data-action=print-order]").first().click();
        assert.equal(await page.evaluate(() => window.inyectado), undefined);
        assert.match(await page.locator(".receipt").innerText(), /00012345/);
        assert.match(
          await page.locator(".receipt").innerText(),
          /1\.000\.000\.000\.000,00/,
        );
        await page.locator("[data-action=print-current]").click();
        await page.emulateMedia({ media: "print" });
        const dims = await page
          .locator("#print-area .receipt")
          .evaluate((el) => ({
            width: el.clientWidth,
            scroll: el.scrollWidth,
          }));
        assert(
          dims.scroll <= dims.width + 1,
          JSON.stringify({ printWidth, dims }),
        );
        const pdf = await page.pdf({
          width: printWidth + "mm",
          height: "1000mm",
          printBackground: true,
        });
        assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
        assert(pdf.length > 1000);
        await page.emulateMedia({ media: "screen" });
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(
        external,
        [],
        "El funcionamiento local no debe depender de recursos de internet",
      );
      console.log(
        channel +
          ": acceso local sin recursos externos, textos escapados y PDF de 58/80 mm con cifras máximas y descripción extensa correctos.",
      );
      await browser.close();
      browser = null;
    }
  } finally {
    await browser?.close();
    await new Promise((r) => app.server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
