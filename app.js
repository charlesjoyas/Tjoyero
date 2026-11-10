"use strict";
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const E = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const N = window.TallerNumbers;
const PM = window.TallerProductionMetals;
const number = (v, minimum = 2, maximum = minimum) =>
  N.format(v, minimum, maximum);
const quantity = (v) => number(v, 2, 6);
function timelineText(value) {
  if (
    !/^(Orden recibida; presupuesto |Asignada a |Retorno: |Aporte adicional: |Pago P-|Anticipo devuelto: |Consumo de )/.test(
      value,
    )
  )
    return value;
  const split = value.indexOf(". "),
    head = split < 0 ? value : value.slice(0, split),
    tail = split < 0 ? "" : value.slice(split);
  return (
    head
      .replace(
        /(?<![\d.,])(-?\d+(?:\.\d+)?) (COP|g)(?=\b)/g,
        (_, n, unit) =>
          (unit === "COP" ? number(Number(n)) : number(Number(n), 3)) +
          " " +
          unit,
      )
      .replace(
        /\((\d+(?:\.\d+)?)%\)/g,
        (_, n) => "(" + number(Number(n)) + " %)",
      )
      .replace(
        /^Consumo de (\d+(?:\.\d+)?) /,
        (_, n) => "Consumo de " + quantity(Number(n)) + " ",
      ) + tail
  );
}
function auditDetails(value) {
  const numericKey =
    /^(opening|cash|bank|amount|labor|materialPrice|goldPrice|taxPercent|.*Rate|rate|.*Weight|weight|purity|.*Purity|quantity|min|unitCost|cost|price|smithFee|lossNormal|lossWarning|tolerance|printWidth|.*Mg|.*Ug)$/;
  return JSON.stringify(
    value,
    (key, v) =>
      numericKey.test(key) &&
      (typeof v === "number" ||
        (typeof v === "string" &&
          v.trim() !== "" &&
          Number.isFinite(Number(v))))
        ? quantity(Number(v))
        : v,
    2,
  );
}
const cop = (v) => "$ " + number(Math.round(v || 0));
const weight = (mg) => number(Number(mg || 0) / 1000, 3) + " g";
const fine = (ug) => number(Number(ug || 0) / 1e6, 3, 6) + " g fino";
function measurementNote(value) {
  return String(value ?? "").replace(
    /^Metal recibido como pago; tarifa (\d+(?:\.\d+)?) COP\/g fino$/,
    (_, n) =>
      "Metal recibido como pago; tarifa " + number(Number(n)) + " COP/g fino",
  );
}
const dt = (v) =>
  v
    ? new Intl.DateTimeFormat("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Bogota",
      }).format(new Date(v))
    : "—";
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(
    new Date(),
  );
const dayKey = (v) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(
    new Date(v),
  );
const dateLabel = (v) =>
  v
    ? new Intl.DateTimeFormat("es-CO", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(v + "T12:00:00Z"))
    : "Sin fecha";
const icons = {
  home: '<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
  orders:
    '<rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 3h6v4H9zM9 12h6M9 16h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  gold: '<path d="m12 3 9 5-9 5-9-5zM3 8v9l9 5 9-5V8M12 13v9"/>',
  smith: '<path d="m14 4 6 6-3 3-6-6zM13 11l-9 9M4 16l4 4M4 4l4 4"/>',
  clients:
    '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6M18 13a5 5 0 0 1 3 5v3"/>',
  cash: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/>',
  chart: '<path d="M4 3v18h17M8 16v-5M13 16V7M18 16V4"/>',
  settings:
    '<path d="m12 2 3 3 4 1 1 4 2 2-2 3-1 4-4 1-3 2-3-2-4-1-1-4-2-3 2-2 1-4 4-1z"/><circle cx="12" cy="12" r="3"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  alert: '<path d="m12 3 10 18H2zM12 9v5M12 17h.01"/>',
  box: '<path d="m12 3 9 5-9 5-9-5zM3 8v9l9 5 9-5V8M12 13v9M7 5l10 5"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  print: '<path d="M6 8V3h12v5M6 17H3V8h18v9h-3M6 14h12v7H6zM17 11h1"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  refresh: '<path d="M20 7a8 8 0 1 0 1 8M20 3v5h-5"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  logout: '<path d="M9 3H4v18h5M9 12h12m-4-4 4 4-4 4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  gem: '<path d="m7 3-5 7 10 12 10-12-5-7zM2 10h20M7 3l5 19 5-19"/>',
  shield:
    '<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6z"/><path d="m8 12 3 3 5-6"/>',
  spark: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>',
  file: '<path d="M5 2h9l5 5v15H5zM14 2v6h5M8 12h8M8 16h8"/>',
  camera: '<path d="M3 7h4l2-3h6l2 3h4v14H3z"/><circle cx="12" cy="13" r="4"/>',
};
const icon = (n) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[n] || icons.box}</svg>`;
let modalBusy = false;
let mainBusy = false;
let cloudMode = false;
let setupKeyRequired = false;
const mainFormAttempts = new Map();
function mainSubmissionKey(form, data) {
  const signature = JSON.stringify(data);
  let attempt = mainFormAttempts.get(form.id);
  if (!attempt || attempt.signature !== signature) {
    attempt = { signature, key: crypto.randomUUID() };
    mainFormAttempts.set(form.id, attempt);
  }
  return attempt.key;
}
let lastPageHash = location.hash || "#dashboard";
let S = null,
  U = null,
  USERS = [],
  AUDIT = [],
  ACC = {},
  PERM = [],
  setup = false,
  view = "dashboard",
  selected = "",
  filters = {},
  connection = true,
  dirty = false,
  serialPort = null,
  serialReader = null,
  scaleReading = null,
  scaleTime = 0,
  scaleStable = false,
  serialBuffer = "";
const statusNames = {
  received: "Recibida",
  in_progress: "En mesa",
  quality: "Control de calidad",
  ready: "Lista para entregar",
  delivered: "Entregada",
  cancelled: "Anulada",
};
const statusColors = {
  received: "gray",
  in_progress: "blue",
  quality: "amber",
  ready: "",
  delivered: "gray",
  cancelled: "red",
};
const roleNames = {
  admin: "Administrador",
  recepcion: "Recepción y caja",
  produccion: "Producción y bodega",
  contador: "Contabilidad",
  consulta: "Solo consulta",
};
const can = (p) => PERM.includes(p);
const find = (coll, id) => S[coll].find((x) => x.id === id);
const client = (o) => find("clients", o.clientId)?.name || "Cliente";
const smith = (o) => find("smiths", o.smithId)?.name || "Sin asignar";
const total = (o) => o.labor + o.materialPrice + o.goldPrice + o.tax;
const paid = (o) =>
  S.payments
    .filter((x) => x.orderId === o.id && !x.voidedAt)
    .reduce((a, x) => a + x.applied, 0);
const due = (o) => total(o) - paid(o);
const active = (o) => !["delivered", "cancelled"].includes(o.status);
const badge = (label, color = "") =>
  `<span class="badge ${color}"><i></i>${E(label)}</span>`;
const status = (o) => badge(statusNames[o.status], statusColors[o.status]);
const button = (text, action, ic = "", cls = "", id = "") =>
  `<button type="button" class="btn ${cls}" data-action="${action}"${id ? ` data-id="${E(id)}"` : ""}>${ic ? icon(ic) : ""}${E(text)}</button>`;
const allowed = (p, ...args) => (can(p) ? button(...args) : "");
const option = (val, label, selected) =>
  `<option value="${E(val)}"${String(val) === String(selected) ? " selected" : ""}>${E(typeof val === "number" && String(label) === String(val) ? number(val) : label)}</option>`;
const select = (name, label, options, value, help = "") =>
  `<label class="field"><span>${E(label)}</span><select name="${name}" required>${options.map((x) => option(Array.isArray(x) ? x[0] : x, Array.isArray(x) ? x[1] : x, value)).join("")}</select>${help ? `<small>${E(help)}</small>` : ""}</label>`;
const field = (name, label, type = "text", value = "", extra = "") => {
  if (type === "number") {
    const step = extra.match(/step="([^"]+)"/)?.[1] || "1";
    const decimals = extra.includes("weight-value") ? 3 : 2;
    const maximum = Math.max(decimals, (step.split(".")[1] || "").length);
    return `<label class="field"><span>${E(label)}</span><input name="${name}" type="text" inputmode="decimal" data-number="true" data-decimals="${decimals}" data-maximum-decimals="${maximum}" value="${value === "" ? "" : E(number(Number(value), decimals, maximum))}" ${extra.replace(/inputmode="[^"]*"/g, "")}></label>`;
  }
  if (type === "password") {
    return `<div class="field password-field"><label for="password-${name}">${E(label)}</label><div class="password-entry"><input id="password-${name}" name="${name}" type="password" value="${E(value)}" ${extra}><button type="button" data-action="toggle-password" aria-controls="password-${name}" aria-pressed="false">Mostrar</button></div>${extra.includes("new-password") ? "<small>Mínimo 4 caracteres. Puedes usar solo letras o números.</small>" : ""}</div>`;
  }
  return `<label class="field"><span>${E(label)}</span><input name="${name}" type="${type}" value="${E(value)}" ${extra}></label>`;
};
const text = (name, label, value = "", extra = "") =>
  `<label class="field ${extra}"><span>${E(label)}</span><textarea name="${name}" rows="3">${E(value)}</textarea></label>`;
const moneyField = (name, label, val = 0) =>
  field(
    name,
    label,
    "number",
    val,
    'min="0" max="1000000000000" step="1" required data-number-kind="money"',
  );
const weightField = (name, label, val = "", zero = false) =>
  '<div class="weight-control">' +
  field(
    name,
    label,
    "number",
    val,
    `min="${zero ? 0 : 0.001}" step="0.001" required class="weight-value" inputmode="decimal"`,
  ) +
  (serialPort
    ? '<div class="actions" style="margin-top:6px">' +
      button("Capturar lectura", "capture-weight", "gold", "small", name) +
      "</div>"
    : "") +
  "</div>";
const metals = () => S?.settings?.metals || [];
let expenseCategories = [];
const metalSelect = (value = "oro", label = "Metal") =>
  select("metal", label, metals().map((x) => [x.id, x.name]), value);
const goldCategories = () => S?.settings?.goldCategories || [];
const categorySelect = (name) =>
  `<div class="field"><label for="category-${E(name)}">Categoría de oro</label><select class="control" id="category-${E(name)}" data-gold-category="${E(name)}"><option value="">Elegir categoría / ley manual</option>${goldCategories().filter((x) => x.active).map((x) => `<option value="${E(x.id)}">${E(x.name)} · ley ${number(x.purity)}</option>`).join("")}</select></div>`;
const goldLawOptions = () => goldCategories().filter((x) => x.active).map((x) => `<option value="${number(x.purity)}">${E(x.name)}</option>`).join("");
const puritySelect = (name = "purity", value = 750) =>
  categorySelect(name) +
  field(
    name,
    "Ley ensayada (milésimas)",
    "number",
    value,
    'min="1" max="1000" step="1" required list="purities-' + name + '"',
  ) +
  '<datalist id="purities-' +
  name +
  '">' + goldLawOptions() + '<option value="925,00">Plata 925</option><option value="950,00">950</option></datalist>';
const empty = (title, desc, action = "") =>
  `<div class="empty">${icon("gem")}<h3>${E(title)}</h3><p>${E(desc)}</p>${action}</div>`;
const notice = (title, desc = "", color = "") =>
  `<div class="notice ${color}">${icon(color === "amber" || color === "red" ? "alert" : "shield")}<div><strong>${E(title)}</strong>${E(desc)}</div></div>`;
const card = (title, sub, content, action = "") =>
  `<section class="card"><div class="card-head"><div><h2>${E(title)}</h2>${sub ? `<p>${E(sub)}</p>` : ""}</div>${action}</div>${content}</section>`;
const row = (label, value, cls = "") =>
  `<div class="summary-row ${cls}"><span>${E(label)}</span><strong>${typeof value === "number" ? number(value) : value}</strong></div>`;
const table = (headers, rows, no = "No hay registros todavía.") =>
  `<div class="table-wrap"><table><thead><tr>${headers.map((x) => `<th>${E(x)}</th>`).join("")}</tr></thead><tbody>${rows || `<tr><td colspan="${headers.length}">${empty("Todo en su lugar", no)}</td></tr>`}</tbody></table></div>`;
const tr = (cells, open = "") =>
  `<tr${open ? ` data-open="${E(open)}" tabindex="0" role="link" aria-label="Abrir orden"` : ""}>${cells.map((x) => `<td>${typeof x === "number" ? number(x) : x}</td>`).join("")}</tr>`;
const kpi = (label, value, sub, ic, hi = false) =>
  `<div class="kpi ${hi ? "highlight" : ""}"><div class="kpi-label">${E(label)}${icon(ic)}</div><div class="kpi-value">${typeof value === "number" ? number(value) : value}</div><small>${sub}</small></div>`;
const head = (label, title, desc, actions = "") =>
  `<div class="page-head"><div><div class="eyebrow">${E(label)}</div><h1>${E(title)}</h1><p>${E(desc)}</p></div><div class="actions">${actions}</div></div>`;
const formWrap = (id, html, submit = "Guardar cambios") =>
  `<form id="${id}" class="operational-form">${html}<div class="form-error" role="alert"></div><div class="form-footer"><button class="btn primary" type="submit">${icon("check")}${E(submit)}</button></div></form>`;
function inputData(form) {
  const values = Object.fromEntries(new FormData(form));
  for (const el of $$("[data-number]", form))
    if (Object.hasOwn(values, el.name)) {
      const value = N.parse(el.value);
      values[el.name] = Number.isFinite(value) ? String(value) : "";
    }
  return values;
}
function numericValue(el) {
  const n = el?.hasAttribute("data-number")
    ? N.parse(el.value)
    : Number(el?.value);
  return Number.isFinite(n) ? n : 0;
}
function setNumericValue(el, value) {
  el.value =
    value === ""
      ? ""
      : number(
          Number(value),
          Number(el.dataset.decimals || 2),
          Number(el.dataset.maximumDecimals || 2),
        );
  validateNumericInput(el);
}
function validateNumericInput(el) {
  el.setCustomValidity("");
  if (!el.value.trim()) return true;
  const n = N.parse(el.value);
  if (!Number.isFinite(n)) {
    el.setCustomValidity(
      "Escribe el número en formato colombiano: 1.234.567,00.",
    );
    return false;
  }
  if (Math.abs(n) > Number.MAX_SAFE_INTEGER) {
    el.setCustomValidity("El valor supera el rango numérico permitido.");
    return false;
  }
  const min = el.getAttribute("min"),
    max = el.getAttribute("max"),
    step = Number(el.getAttribute("step") || 1);
  let error = "";
  const precision = (String(el.getAttribute("step") || "1").split(".")[1] || "")
    .length;
  const excess = (el.value.split(",")[1] || "").slice(precision);
  if (min !== null && n < Number(min))
    error =
      "El valor mínimo es " +
      number(
        Number(min),
        Number(el.dataset.decimals),
        Number(el.dataset.maximumDecimals),
      ) +
      ".";
  else if (max !== null && n > Number(max))
    error =
      "El valor máximo es " +
      number(
        Number(max),
        Number(el.dataset.decimals),
        Number(el.dataset.maximumDecimals),
      ) +
      ".";
  else if (
    /[1-9]/.test(excess) ||
    (Number.isFinite(step) &&
      step > 0 &&
      Math.abs(n / step - Math.round(n / step)) > 0.00001)
  )
    error =
      el.dataset.numberKind === "money"
        ? "Los importes se registran en pesos enteros; usa decimales ,00."
        : step === 1
          ? "Este campo admite valores enteros, con decimales ,00."
          : "La precisión permitida es " +
            number(
              step,
              Number(el.dataset.decimals),
              Number(el.dataset.maximumDecimals),
            ) +
            ".";
  el.setCustomValidity(error);
  return !error;
}
function formatNumericInput(el, complete = false, regroup = false) {
  if (complete) {
    if (validateNumericInput(el) && el.value.trim())
      setNumericValue(el, N.parse(el.value));
    return;
  }
  const raw = el.value,
    caret = el.selectionStart ?? raw.length,
    meaningful = raw.slice(0, caret).replace(/\./g, "").length;
  const formatted = N.editing(raw, regroup);
  if (formatted !== null && formatted !== raw) {
    el.value = formatted;
    let count = 0,
      pos = 0;
    while (pos < formatted.length && count < meaningful) {
      if (formatted[pos] !== ".") count++;
      pos++;
    }
    el.setSelectionRange(pos, pos);
  }
  validateNumericInput(el);
}
function toast(message, error = false) {
  const el = $("#toast");
  el.textContent = message;
  el.className = "visible" + (error ? " error" : "");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.className = ""), 4500);
}
async function api(url, opts = {}) {
  try {
    const data = await window.TallerTransport.request(url, opts);
    connection = true;
    return data;
  } catch (e) {
    if (!e.status) {
      connection = false;
      throw new Error(
        "No hay conexión con el servidor. Conserva este formulario y vuelve a intentar.",
      );
    }
    if (e.status === 401 && S) {
      modalBusy = false;
      mainBusy = false;
      $("#dialog").close();
      S = null;
      U = null;
      dirty = false;
      renderAuth();
      toast("Tu sesión terminó. Inicia sesión para continuar.", true);
    }
    throw e;
  }
}
async function load({ ifIdle = false } = {}) {
  const d = await api("/api/state");
  if (ifIdle && (dirty || mainBusy || $("#dialog").open)) return false;
  S = d.state;
  cloudMode = d.environment === "cloud";
  U = d.user;
  USERS = d.users;
  AUDIT = d.audit;
  ACC = d.accounts;
  PERM = d.permissions;
  expenseCategories = d.expenseCategories || [];
  return true;
}
async function mutate(action, data, key = crypto.randomUUID(), revision = S.revision) {
  try {
    const r = await api("/api/action", {
      method: "POST",
      headers: { "If-Match": String(revision), "Idempotency-Key": key },
      body: JSON.stringify({ action, data }),
    });
    await load();
    return r.result;
  } catch (e) {
    if (e.status === 409) {
      await load();
      toast(
        "Datos actualizados. Revisa el formulario antes de volver a guardar.",
        true,
      );
    }
    throw e;
  }
}
function modal(title, html, submitFn = null, submitLabel = "Guardar") {
  const d = $("#dialog");
  if (d.open) d.close();
  d.innerHTML = `<div class="dialog-head"><h2 id="dialog-title">${E(title)}</h2>${button("", "close-modal", "close", "", "")}</div><div class="dialog-body">${submitFn ? `<form id="modal-form">${html}<div class="form-error" role="alert"></div><div class="form-footer">${button("Cancelar", "close-modal")}<button class="btn primary" type="submit">${icon("check")}${E(submitLabel)}</button></div></form>` : html}</div>`;
  d.showModal();
  syncMetalFields($("#modal-form"));
  if (submitFn) {
    let previous = "",
      key = crypto.randomUUID();
    $("#modal-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      if (!f.reportValidity()) return;
      const b = inputData(f),
        sig = JSON.stringify(b);
      if (sig !== previous) {
        key = crypto.randomUUID();
        previous = sig;
      }
      const controls = $$("input, textarea, select, button", d).map((el) => ({
        el,
        disabled: el.disabled,
      }));
      modalBusy = true;
      controls.forEach(({ el }) => {
        el.disabled = true;
      });
      $(".form-error", f).textContent = "";
      try {
        const result = await submitFn(b, f, key);
        if (result !== false) {
          d.close();
          render();
          toast("Guardado correctamente.");
        }
      } catch (err) {
        $(".form-error", f).textContent = err.message;
      } finally {
        modalBusy = false;
        controls.forEach(({ el, disabled }) => {
          el.disabled = disabled;
        });
      }
    });
  }
}
function closeModal() {
  if (modalBusy) return;
  $("#dialog").close();
}
$("#dialog").addEventListener("cancel", (e) => {
  if (modalBusy) e.preventDefault();
});
function getBalances() {
  const m = new Map();
  for (const x of S.ledger)
    for (const [account, sign] of [
      [x.to, 1],
      [x.from, -1],
    ])
      if (ACC[account]) {
        const key = [account, x.metal, x.purity, x.owner].join("|"),
          r = m.get(key) || {
            account,
            metal: x.metal,
            purity: x.purity,
            owner: x.owner,
            mg: 0,
            fineUg: 0,
          };
        r.mg += sign * x.mg;
        r.fineUg += sign * x.mg * x.purity;
        m.set(key, r);
      }
  return [...m.values()].filter((x) => x.mg);
}
function balance(account, metal, purity, owner = "taller") {
  return getBalances()
    .filter(
      (x) =>
        x.account === account &&
        x.metal === metal &&
        x.purity === Number(purity) &&
        x.owner === owner,
    )
    .reduce((v, x) => v + x.mg, 0);
}
function currentShift() {
  return S.shifts.find((x) => !x.closedAt);
}
function expectedCash(shift) {
  return (
    shift.opening +
    S.cashEntries
      .filter((x) => x.shiftId === shift.id)
      .reduce((v, x) => v + x.amount, 0)
  );
}
function cashMetals() {
  const grouped = new Map();
  for (const x of getBalances().filter(
    (x) => ["cashGold", "payment"].includes(x.account) && x.owner === "taller",
  )) {
    const key = x.metal + "|" + x.purity,
      row = grouped.get(key) || {
        metal: x.metal,
        purity: x.purity,
        mg: 0,
        fineUg: 0,
        openingMg: 0,
        receivedMg: 0,
      };
    row.mg += x.mg;
    row.fineUg += x.fineUg;
    if (x.account === "cashGold") row.openingMg += x.mg;
    else row.receivedMg += x.mg;
    grouped.set(key, row);
  }
  return [...grouped.values()].sort(
    (a, b) => a.metal.localeCompare(b.metal) || a.purity - b.purity,
  );
}
const openingModeLabel = (shift) =>
  ({ cash: "Efectivo", gold: "Oro", mixed: "Mixto" })[
    shift.openingMode || "cash"
  ];
function route(page, id = "") {
  if (mainBusy) return toast("Espera a que termine el guardado.");
  if (
    dirty &&
    !confirm("Hay cambios sin guardar. ¿Quieres salir de este formulario?")
  )
    return;
  if (view === "receive" && page !== "receive") discardReceptionDraft();
  dirty = false;
  location.hash = page + (id ? "/" + id : "");
  if (view === page && selected === id) render();
}
function renderAuth() {
  document.title = "Áurea · Acceso al taller";
  $("#app").innerHTML =
    `<main class="login"><section class="login-art"><div class="wordmark">áurea<span>GESTIÓN QUE BRILLA</span></div><div><div class="eyebrow" style="color:#b9c6a5;margin-bottom:20px">HECHO PARA EL OFICIO</div><h1>Cada pieza tiene<br>una historia.<br>Cada gramo, su lugar.</h1><p>El cuidado de tu taller, desde la primera recepción hasta la última entrega.</p></div><small style="color:#b9c6a5">JOYERÍA & ORFEBRERÍA · ÁUREA TALLER</small></section><section class="login-form"><div><div class="wordmark">áurea<span>TALLER JOYERO</span></div><div class="eyebrow">${setup ? "TU TALLER COMIENZA AQUÍ" : "BIENVENIDO A TU TALLER"}</div><h2>${setup ? "Démosle forma." : "Todo listo para crear."}</h2><p>${setup ? "Crea tu acceso de administrador. Los registros empiezan vacíos para que puedas trabajar con los datos de tu taller." : "Ingresa con tu usuario para continuar la jornada."}</p><form id="auth-form">${setup ? field("workshop", "Nombre del taller", "text", "", 'required maxlength="160" autocomplete="organization"') + field("name", "Tu nombre", "text", "", 'required maxlength="120" autocomplete="name"') : ""}${setup && setupKeyRequired ? field("setupKey", "Clave de puesta en marcha", "password", "", 'required minlength="24" autocomplete="off"') : ""}${field("username", "Usuario o correo electrónico", "text", "", 'required minlength="3" maxlength="254" autocomplete="username"')}${field("password", "Contraseña", "password", "", `required ${setup ? 'minlength="4"' : ""} maxlength="128" autocomplete="${setup ? "new-password" : "current-password"}"`)}<div class="form-error" role="alert"></div><button type="submit" class="btn primary">${E(setup ? "Crear mi taller" : "Entrar al taller")}${icon("arrow")}</button></form><footer>${cloudMode ? "Tus datos se guardan en una base de datos persistente en la nube.<br>Necesitas conexión a internet para trabajar en esta versión." : "Los datos se guardan en este servidor con SQLite.<br>Sin conexión a internet, tu taller sigue funcionando en la red local."}</footer></div></section></main>`;
  $("#auth-form").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target,
      b = inputData(f),
      btn = $("button[type=submit]", f);
    btn.disabled = true;
    try {
      await api(setup ? "/api/setup" : "/api/login", {
        method: "POST",
        body: JSON.stringify(b),
      });
      await load();
      setup = false;
      view = "dashboard";
      render();
    } catch (err) {
      $(".form-error", f).textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  };
}
const navGroups = [
  [
    "GENERAL",
    [
      ["dashboard", "Vista general", "home"],
      ["orders", "Órdenes de trabajo", "orders"],
      ["clients", "Clientes y custodias", "clients"],
    ],
  ],
  [
    "OPERACIÓN",
    [
      ["gold", "Libro de metales", "gold"],
      ["production", "Producción", "gem"],
      ["smiths", "Orfebres", "smith"],
      ["materials", "Piedras e insumos", "box"],
    ],
  ],
  [
    "ADMINISTRACIÓN",
    [
      ["payments", "Cobros y cartera", "cash"],
      ["cash", "Caja y turnos", "cash"],
      ["expenses", "Gastos del taller", "cash"],
      ["purchases", "Órdenes de compra", "box"],
      ["stock", "Piezas terminadas", "gem"],
      ["reports", "Reportes y auditoría", "chart"],
      ["reversals", "Reversiones", "refresh"],
      ["assistant", "Análisis del taller", "spark"],
    ],
  ],
  [
    "SISTEMA",
    [
      ["users", "Usuarios y acceso", "shield"],
      ["categories", "Categorías", "gold"],
      ["settings", "Configuración", "settings"],
    ],
  ],
];
function render() {
  if (!S) return renderAuth();
  const oldForm = $(".operational-form"),
    snapshot = oldForm
      ? {
          id: oldForm.id,
          values: [...oldForm.elements]
            .filter((el) => el.name && el.type !== "file")
            .map((el) => ({
              name: el.name,
              value: el.value,
              checked: el.checked,
            })),
        }
      : null;
  const nav = navGroups
    .map(
      ([label, pages]) =>
        `<div class="navgroup"><span class="eyebrow">${label}</span>${pages
          .filter((x) => x[0] !== "users" || can("users"))
          .filter((x) => x[0] !== "settings" || can("settings"))
          .filter((x) => x[0] !== "categories" || can("settings"))
          .filter((x) => x[0] !== "reports" || can("reports"))
          .filter((x) => x[0] !== "reversals" || can("adjust"))
          .filter((x) => x[0] !== "expenses" || can("cash"))
          .map(
            ([key, label, ic]) =>
              `<button class="navbutton ${view === key ? "active" : ""}" data-nav="${key}">${icon(ic)}<span>${label}</span>${key === "orders" && S.orders.some(active) ? `<span class="count">${number(S.orders.filter(active).length)}</span>` : ""}</button>`,
          )
          .join("")}</div>`,
    )
    .join("");
  const pageTitle =
    navGroups.flatMap((x) => x[1]).find((x) => x[0] === view)?.[1] ||
    (view === "receive" ? "Nueva recepción" : "Orden de trabajo");
  $("#app").innerHTML =
    `<div class="shell"><aside class="sidebar"><div class="wordmark">áurea<span>TALLER JOYERO</span></div><div class="workspace"><span>${icon("gem")}</span><div><strong>${E(S.settings.name)}</strong><small>${currentShift() ? "Turno abierto · " + E(currentShift().code) : "Sin turno de caja abierto"}</small></div></div><nav>${nav}</nav><div class="sidebar-bottom"><span class="dot"></span><span class="connection-status">Servidor disponible</span><div style="margin-top:7px;color:#a0a993">Gestión que brilla.</div></div></aside><div class="main">${!connection ? '<div class="offline">Sin conexión con el servidor. Los cambios no se han guardado.</div>' : ""}<header class="topbar"><div class="crumb">${button("", "menu", "menu", "icon-button mobile-menu")}<span>Mi taller</span>${icon("chevron")}<strong>${E(pageTitle)}</strong></div><div class="top-actions">${allowed("cash", currentShift() ? "Cerrar caja" : "Abrir caja", currentShift() ? "close-shift" : "open-shift", "cash", "cash-shortcut primary")}<div class="rate"><small>TARIFA ORO · GRAMO FINO</small><strong>${cop(S.settings.rate.oro)} <span class="muted">COP</span></strong></div><button class="icon-button" data-action="refresh" title="Actualizar datos" aria-label="Actualizar datos">${icon("refresh")}</button><button class="user-button" data-action="account"><div class="avatar">${E(
      U.name
        .split(" ")
        .map((x) => x[0])
        .slice(0, 2)
        .join("")
        .toUpperCase(),
    )}</div><div><strong>${E(U.name)}</strong><small>${E(roleNames[U.role])}</small></div></button></div></header><main class="content" id="page">${renderPage()}<footer class="footer-note"><span>ÁUREA TALLER · GESTIÓN QUE BRILLA</span><span>Guardado en SQLite · revisión ${S.revision} · ${new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" }).format(new Date())}</span></footer></main></div></div>`;
  if (snapshot && $("#" + snapshot.id))
    for (const { name, value, checked } of snapshot.values) {
      const el = $(`[name="${name}"]`, $("#" + snapshot.id));
      if (el && el.type !== "file") {
        el.value = value;
        if (["checkbox", "radio"].includes(el.type)) el.checked = checked;
        if (el.hasAttribute("data-number")) validateNumericInput(el);
      }
    }
  bindPage();
  document.title = `${pageTitle} · Áurea Taller`;
}
function renderPage() {
  switch (view) {
    case "dashboard":
      return dashboard();
    case "orders":
      return selected ? orderDetail(find("orders", selected)) : ordersPage();
    case "receive":
      return receivePage();
    case "clients":
      return clientsPage();
    case "gold":
      return goldPage();
    case "production":
      return productionPage();
    case "smiths":
      return smithsPage();
    case "payments":
      return paymentsPage();
    case "cash":
      return cashPage();
    case "expenses":
      return can("cash") ? expensesPage() : notice("Acceso restringido");
    case "purchases":
      return purchasesPage();
    case "materials":
      return materialsPage();
    case "stock":
      return stockPage();
    case "reports":
      return can("reports")
        ? reportsPage()
        : notice(
            "Acceso restringido",
            "Tu usuario no tiene permiso para ver reportes.",
            "amber",
          );
    case "users":
      return can("users") ? usersPage() : notice("Acceso restringido");
    case "settings":
      return can("settings") ? settingsPage() : notice("Acceso restringido");
    case "reversals":
      return can("adjust") ? reversalsPage() : notice("Acceso restringido");
    case "categories":
      return can("settings") ? categoriesPage() : notice("Acceso restringido");
    case "assistant":
      return assistantPage();
    default:
      return dashboard();
  }
}
function orderTable(orders) {
  return table(
    ["Orden / trabajo", "Cliente", "Prometida", "Estado", "Saldo", ""],
    orders
      .filter(o=>!o.deletedAt)
      .map((o) =>
        tr(
          [
            `<strong>${E(o.code)}</strong><small>${E(o.description.slice(0, 45))}</small>`,
            E(client(o)),
            `<span class="${active(o) && o.dueDate < today() ? "bad" : ""}">${dateLabel(o.dueDate)}</span>`,
            status(o),
            `<span style="color:${due(o) > 0 ? "var(--debt)" : "inherit"}">${cop(due(o))}</span>`,
            button("Ver orden", "open-order", "arrow", "link", o.id),
          ],
          o.id,
        ),
      )
      .join(""),
    "Las órdenes que registres aparecerán aquí.",
  );
}
function alerts() {
  const result = [];
  for (const o of S.orders.filter(active)) {
    if (o.dueDate <= today())
      result.push({
        title: `${o.code} · ${o.dueDate < today() ? "Entrega vencida" : "Entrega para hoy"}`,
        text: client(o) + " · " + o.description,
        id: o.id,
        icon: "clock",
      });
    if (
      o.status === "in_progress" &&
      Date.now() - Date.parse(o.updatedAt) > 3 * 86400000
    )
      result.push({
        title: `${o.code} · Metal sin avance por más de 3 días`,
        text: smith(o) + " tiene la orden en mesa.",
        id: o.id,
        icon: "alert",
      });
    if ((o.returned?.maxPercent ?? o.returned?.percent) > S.settings.lossWarning)
      result.push({
        title: `${o.code} · Merma fuera de rango`,
        text: number(o.returned.percent) + " % · " + smith(o),
        id: o.id,
        icon: "alert",
      });
  }
  for (const x of S.materials.filter((x) => x.quantity <= x.min))
    result.push({
      title: "Existencia baja · " + x.name,
      text: quantity(x.quantity) + " " + x.unit + " disponibles.",
      icon: "box",
      page: "materials",
    });
  return result;
}
function dashboard() {
  const act = S.orders.filter(active),
    sales = S.orders.filter(
      (o) => o.invoice && dayKey(o.deliveredAt) === today(),
    ),
    owned = getBalances().filter(
      (x) => x.owner === "taller" && ["own", "melt"].includes(x.account),
    ),
    value = owned.reduce(
      (v, x) => v + (x.fineUg * S.settings.rate[x.metal]) / 1e6,
      0,
    ),
    a = alerts(),
    newOrder = allowed("orders", "Nueva orden", "receive", "plus", "primary");
  const hour = Number(
    new Intl.DateTimeFormat("en", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "America/Bogota",
    }).format(new Date()),
  );
  const chartDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today() + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - 6 + i);
    const key = d.toISOString().slice(0, 10);
    return {
      label: new Intl.DateTimeFormat("es", {
        weekday: "short",
        timeZone: "UTC",
      }).format(d),
      value: S.orders
        .filter((o) => o.invoice && dayKey(o.deliveredAt) === key)
        .reduce((v, o) => v + total(o), 0),
    };
  });
  const max = Math.max(1, ...chartDays.map((x) => x.value));
  const start =
    S.clients.length === 0 || S.smiths.length === 0 || !S.settings.updatedAt;
  return (
    head(
      "TU TALLER, EN PERSPECTIVA",
      `${hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches"}, ${U.name.split(" ")[0]}.`,
      "Una mirada a tus piezas, tus metales y lo que viene hoy.",
      button("Ver órdenes", "orders", "orders") + newOrder,
    ) +
    `<div class="kpis">${kpi("Ventas entregadas hoy", cop(sales.reduce((v, o) => v + total(o), 0)), `${number(sales.length)} órdenes entregadas · COP`, "chart", true)}${kpi("Órdenes en taller", act.length, `${number(act.filter((o) => o.status === "in_progress").length)} en mesa de trabajo`, "orders")}${kpi("Metal propio en bodega", cop(value), "Valor a tarifas actuales · COP", "gold")}${kpi("Listas para entregar", act.filter((o) => o.status === "ready").length, `${number(act.filter((o) => o.dueDate === today()).length)} órdenes prometidas para hoy`, "gem")}</div>` +
    (start
      ? `<div class="section-gap">${card(
          "Prepara tu taller",
          "Unos pasos para comenzar con tus propios datos.",
          [
            ["Clientes", S.clients.length > 0, "new-client", "clients"],
            ["Orfebres", S.smiths.length > 0, "new-smith", "production"],
            ["Turno de caja", !!currentShift(), "open-shift", "cash"],
            [
              "Tarifas y datos del taller",
              !!S.settings.updatedAt,
              "settings",
              "settings",
            ],
          ]
            .map(
              ([label, done, action, perm], i) =>
                `<div class="setup-check ${done ? "done" : ""}"><span>${done ? "✓" : i + 1}</span><strong>${label}</strong>${can(perm) ? button(done ? "Revisar" : "Configurar", action, "", "link") : ""}</div>`,
            )
            .join(""),
        )}</div>`
      : "") +
    `<div class="dashboard-columns"><div class="grid">${card("Actividad de los últimos 7 días", "Ventas reconocidas al entregar, en COP.", `<div class="chart">${chartDays.map((x) => `<div class="chart-column" title="${E(x.label + " · " + cop(x.value))}"><div class="chart-bar" style="height:${Math.max(1, (x.value / max) * 100)}%"></div><small>${x.label}</small></div>`).join("")}</div><div class="legend"><span><i class="dot"></i>Ventas entregadas</span><span>Total: ${cop(chartDays.reduce((v, x) => v + x.value, 0))}</span></div>`, badge("Última semana", "gray"))}<section class="card table-card"><div class="card-head"><div><h2>Órdenes en movimiento</h2><p>Los próximos compromisos de tu taller.</p></div>${button("Ver todas", "orders", "arrow", "link")}</div>${orderTable(act.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5))}</section></div><div class="grid" style="align-content:start">${card(
      "Requieren tu atención",
      `${number(a.length)} asuntos para revisar`,
      a.length
        ? a
            .slice(0, 5)
            .map(
              (x) =>
                `<div class="alert-row"><span class="alert-icon">${icon(x.icon)}</span><div><strong>${E(x.title)}</strong><p>${E(x.text)}</p>${button("Revisar", x.page || "open-order", "arrow", "link", x.id || "")}</div></div>`,
            )
            .join("")
        : empty(
            "La jornada está en orden",
            "Aquí verás entregas próximas, órdenes detenidas y alertas de existencias.",
          ),
      icon("alert"),
    )}${card(
      "El pulso del taller",
      "Estado de las órdenes activas.",
      `<div class="progress-list">${[
        "received",
        "in_progress",
        "quality",
        "ready",
      ]
        .map((st) => {
          const n = act.filter((o) => o.status === st).length;
          return `<div>${row(statusNames[st], n)}<div class="balance-bar"><div style="width:${act.length ? (n / act.length) * 100 : 0}%"></div></div></div>`;
        })
        .join("")}</div>`,
    )}</div></div>`
  );
}
function ordersPage() {
  const q = (filters.orderQ || "").toLowerCase(),
    st = filters.orderStatus === "cancelled" ? "" : filters.orderStatus || "",
    orders = S.orders.filter(
      (o) =>
        o.status !== "cancelled" &&
        (!st || o.status === st) &&
        `${o.code} ${o.description} ${client(o)}`.toLowerCase().includes(q),
    );
  return (
    head(
      "DEL MOSTRADOR A LA ENTREGA",
      "Órdenes de trabajo",
      "Cada pieza, su historia completa.",
      allowed("orders", "Nueva orden", "receive", "plus", "primary"),
    ) +
    `<section class="card table-card"><div class="filters"><div class="search-box">${icon("search")}<input class="control" id="order-search" data-filter="orderQ" placeholder="Buscar por orden, cliente o trabajo…" value="${E(filters.orderQ || "")}"></div><select class="control" data-filter="orderStatus" aria-label="Filtrar por estado">${option("", "Todos los estados", st)}${Object.entries(
      statusNames,
    )
      .filter(([key]) => key !== "cancelled")
      .map(([k, v]) => option(k, v, st))
      .join(
        "",
      )}</select><div class="filter-tabs">${button("Lista", "order-list", "", "small " + (!filters.board ? "active" : ""))}${button("Tablero", "order-board", "", "small " + (filters.board ? "active" : ""))}</div></div>${
      filters.board
        ? `<div class="kanban" style="padding:0 20px 20px">${[
            "received",
            "in_progress",
            "quality",
            "ready",
            "delivered",
          ]
            .map(
              (st) =>
                `<section class="kanban-col"><h3>${statusNames[st]}<span>${number(orders.filter((o) => o.status === st).length)}</span></h3>${orders
                  .filter((o) => o.status === st)
                  .map(
                    (o) =>
                      `<article class="order-tile" data-open="${o.id}" tabindex="0" role="link"><strong>${E(o.code)}</strong><h3>${E(o.description)}</h3><p>${E(client(o))}<br>${E(smith(o))}</p><footer><span>${dateLabel(o.dueDate)}</span><strong>${cop(due(o))}</strong></footer></article>`,
                  )
                  .join("")}</section>`,
            )
            .join("")}</div>`
        : orderTable([...orders].reverse())
    }</section>`
  );
}
function receptionStoneWeightFields() {
  return `<div class="span-2" id="receive-stone-controls"><label class="check"><input name="hasStones" type="checkbox">La joya del cliente trae piedras.</label><div class="form-grid" id="receive-stone-weights" hidden>${weightField("grossWeight","Peso bruto de la joya, con piedras (g)","")}${select("weightStatus","Peso neto del metal",[["pending","Pendiente de pesar"],["estimated","Estimado; no ingresa al libro"],["confirmed","Pesado y confirmado"]],"pending")}<p class="muted span-2">Registra el detalle de las piedras del cliente en la ficha del trabajo. Un peso neto pendiente o estimado no entra como oro ni permite asignar a mesa.</p></div></div>`;
}
function receptionOwnStonesControls() {
  return `<div class="span-2 form-section" id="receive-own-stones-section"><h3>Piedras que aporta el taller (opcional)</h3><p>Selecciona tus piedras disponibles y su precio total para este trabajo. Se suman al presupuesto y se descuentan del inventario al guardar la orden.</p><div class="actions">${button("Añadir piedra del taller","receive-own-gem","gem","small")}</div><input type="hidden" name="ownStones" value="[]"><div id="receive-own-stones"></div></div>`;
}
function receptionStonesTable(items) {
  return items.length?table(["Piedra del taller","Unidades / quilates","Precio total incluido",""],items.map(x=>tr([E(x.name),number(x.quantity)+" · "+ctLabel(x.caratMilli),cop(x.price),button("Editar","edit-receive-gem","","small",x.id)+button("Quitar","remove-receive-gem","","small danger",x.id)])).join("")):"";
}
function setReceptionStones(form,items) {
  const old=JSON.parse(form.elements.ownStones.value||"[]"),oldTotal=old.reduce((v,x)=>v+x.price,0),newTotal=items.reduce((v,x)=>v+x.price,0),current=numericValue(form.elements.materialPrice);
  if(current<oldTotal)throw new Error("Piedras e insumos debe incluir las piedras ya seleccionadas. Revisa ese importe antes de cambiar el detalle.");
  if(!Number.isSafeInteger(newTotal)||current-oldTotal+newTotal>1e12)throw new Error("El precio de las piedras supera el máximo permitido.");
  form.elements.ownStones.value=JSON.stringify(items);setNumericValue(form.elements.materialPrice,current-oldTotal+newTotal);dirty=true;quotePreview(form);
}
function receptionGemModal(id) {
  const reception=$("#receive-form"),items=JSON.parse(reception.elements.ownStones.value||"[]"),item=items.find(x=>x.id===id);
  const lots=(S.gemstoneLots||[]).filter(x=>!x.reversedAt&&!x.deletedAt).map(x=>{const selected=items.filter(y=>y.id!==id&&y.stockId===x.id);return {...x,available:x.available-selected.reduce((v,y)=>v+y.quantity,0),remainingCaratMilli:x.remainingCaratMilli-selected.reduce((v,y)=>v+y.caratMilli,0)};}).filter(x=>x.available>0);
  if(!lots.length)return modal("Sin piedras propias disponibles",notice("Registra tus piedras","En Piedras e insumos registra primero un lote o una piedra del taller. Las piedras seleccionadas en este formulario también se tienen en cuenta al mostrar la disponibilidad.","amber"));
  modal(item?"Editar piedra del presupuesto":"Añadir piedra del taller al trabajo",notice("Precio incluido en el presupuesto","Selecciona la piedra, las unidades, sus quilates totales y el precio total acordado para esta línea. El precio sugerido se puede modificar. El inventario se descuenta al guardar la orden completa.","blue")+`<div class="form-grid"><div class="span-2">${select("stockId","Piedra / lote disponible",lots.map(x=>[x.id,x.code+" · "+x.name+" · "+number(x.available)+" und. · "+ctLabel(x.remainingCaratMilli)]),item?.stockId||lots[0].id)}</div>${field("quantity","Cantidad de piedras","number",item?.quantity||1,'required min="1" max="1000000" step="1"')}${field("carats","Quilates totales de esta línea · ct","number",item?item.caratMilli/1000:"",'required min="0.001" max="1000000" step="0.001"')}<div class="span-2">${moneyField("price","Precio total de estas piedras · COP",item?.price||0)}</div></div>`,b=>{
    if(!item&&items.length>=200)throw new Error("Máximo 200 líneas de piedras por orden.");
    const lot=lots.find(x=>x.id===b.stockId),qty=Number(b.quantity),ct=Number(b.carats)*1000,price=Number(b.price);
    if(!lot||!Number.isSafeInteger(qty)||qty<1||qty>lot.available)throw new Error("Revisa las unidades disponibles de esta piedra.");
    if(!Number.isFinite(ct)||Math.abs(ct-Math.round(ct))>.00001||ct<qty||ct>lot.remainingCaratMilli||lot.remainingCaratMilli-Math.round(ct)<lot.available-qty||(qty===lot.available&&Math.round(ct)!==lot.remainingCaratMilli))throw new Error("Revisa los quilates: deben corresponder a las piedras retiradas y conservar el saldo del lote.");
    if(!Number.isSafeInteger(price)||price<0||price>1e12)throw new Error("Precio total de las piedras inválido.");
    const next={id:item?.id||crypto.randomUUID(),stockId:lot.id,name:lot.code+" · "+lot.name,quantity:qty,caratMilli:Math.round(ct),carats:Math.round(ct)/1000,price};
    setReceptionStones(reception,item?items.map(x=>x.id===id?next:x):[...items,next]);
  },"Añadir al presupuesto");
  const form=$("#modal-form"),update=()=>{const lot=lots.find(x=>x.id===form.elements.stockId.value);setNumericValue(form.elements.quantity,1);setNumericValue(form.elements.carats,lot.available===1?lot.remainingCaratMilli/1000:"");setNumericValue(form.elements.price,lot.unitPrice);};
  form.elements.stockId.addEventListener("change",update);
  form.elements.quantity.addEventListener("input",()=>{const lot=lots.find(x=>x.id===form.elements.stockId.value);setNumericValue(form.elements.price,lot.unitPrice*numericValue(form.elements.quantity));});
  if(!item)update();
}
function receivePage() {
  if (!can("orders")) return notice("Acceso restringido");
  return (
    head(
      "UNA NUEVA HISTORIA",
      "Recibir un trabajo",
      "Registra la pieza y su estado antes de que entre al taller.",
      button("Volver a órdenes", "orders", "orders"),
    ) +
    (S.clients.length
      ? ""
      : notice(
          "Primero registra al cliente",
          "Usa el botón «Nuevo cliente» y vuelve a esta recepción.",
          "amber",
        )) +
    formWrap(
      "receive-form",
      `<div class="grid two"><section class="card"><div class="card-head"><div><h2 id="reception-owner-title">1. Lo que trae el cliente</h2><p id="reception-owner-help">Describe la pieza recibida. Este metal pertenece al cliente y no sale de tu bodega.</p></div>${button("Nuevo cliente", "new-client", "plus", "small")}</div><div class="form-grid">${select("clientId", "Cliente", [["", "Seleccionar cliente"], ...S.clients.map((c) => [c.id, c.name + " · " + (c.document || c.phone || "Sin documento")])], "")}${select("type", "Tipo de trabajo", ["Reparación", "Fabricación", "Arreglo / talla", "Producción propia"], "Reparación")}<div class="span-2">${field("description", "Trabajo solicitado", "text", "", 'required maxlength="2000" placeholder="Ej. Soldadura de cadena y cambio de broche"')}</div>${metalSelect("oro", "Metal de la pieza recibida")}${puritySelect()}${weightField("receivedWeight", "Peso neto del metal recibido, sin piedras (g)", 0, true)}${receptionStoneWeightFields()}<div class="field"><span>Captura de peso</span>${button("Usar lectura de balanza", "capture-received", "gold", "")}<small class="scale-status">${scaleStatus()}</small></div><div class="span-2">${text("condition", "Estado de la pieza, piedras y accesorios recibidos")}<small>Describe rayones, faltantes, gemas, grabados y lo que queda bajo custodia.</small></div><div class="span-2">${field("photo", "Fotografía de recepción (opcional)", "file", "", 'accept="image/*" capture="environment"')}<div id="photo-preview"></div></div></div></section><section class="card"><div class="card-head"><div><h2 id="reception-budget-title">2. Lo que le cobras al cliente</h2><p id="reception-budget-help">Mano de obra, insumos y metal vendido. Importes antes de impuestos, en pesos colombianos.</p></div></div><div class="form-grid">${moneyField("labor", "Mano de obra · COP")}<div class="field"><span>Ayuda para cotizar</span>${button("Estimar mano de obra", "estimate-labor", "chart", "")}<input type="hidden" name="laborEstimate" value=""></div><div id="labor-estimate-summary" class="span-2"></div>${receptionOwnStonesControls()}${moneyField("materialPrice", "Piedras e insumos · COP")}<div class="span-2 form-section"><h3>Metal que vende el taller (opcional)</h3><p>Si solo reparas la pieza del cliente, no necesitas añadir metal al presupuesto.</p></div><div class="span-2 actions">${button("Añadir metal a cobrar", "new-order-metal", "plus", "small")}</div><input type="hidden" name="orderMetals" value="[]"><div id="order-metal-list" class="span-2"></div>${moneyField("goldPrice", "Total a cobrar por metal · COP")}<div class="span-2">${notice("3. Cómo se mueve el inventario", "Añadir un cobro al presupuesto no descuenta gramos. Para usar metal propio, registra su peso en Asignar a mesa: allí se traslada del origen elegido al trabajo.", "blue")}</div>${field("taxPercent", "Impuesto configurado (%)", "number", S.settings.taxPercent, 'min="0" max="100" step="0.01" required')}${field("dueDate", "Fecha prometida", "date", today(), "required")}${select("priority", "Prioridad", ["Normal", "Urgente"], "Normal")}<div class="span-2">${text("notes", "Ficha técnica: medidas, talla, diseño y observaciones")}</div><div id="quote-preview" class="span-2 calculator"></div><div class="span-2">${notice("Anticipos y pagos", "Después de guardar la orden podrás registrar dinero o metal como pago, con su comprobante y turno de caja.")}</div></div></section></div>`,
      "Registrar orden y abrir detalle",
    )
  );
}
function updateReceptionType(form) {
  const own = form.elements.type.value === "Producción propia";
  $("#reception-owner-title",form).textContent=own?"1. Pieza que fabrica el taller":"1. Lo que trae el cliente";
  $("#reception-owner-help",form).textContent=own?"El taller es el propietario. Los gramos de metal propio se registran al asignar a mesa.":"Describe la pieza recibida. Este metal pertenece al cliente y no sale de tu bodega.";
  $("#reception-budget-title",form).textContent=own?"2. Presupuesto interno de producción":"2. Lo que le cobras al cliente";
  $("#reception-budget-help",form).textContent=own?"Valores de referencia para esta pieza. Se ingresa a inventario después de producción y calidad.":"Mano de obra, insumos y metal vendido. Importes antes de impuestos, en pesos colombianos.";
  form.elements.clientId.closest(".field").hidden=own;
  form.elements.receivedWeight.closest(".weight-control").hidden=own;
  const capture=$("[data-action=capture-received]",form);
  capture.disabled=own;capture.closest(".field").hidden=own;
  form.elements.clientId.required = !own;
  form.elements.clientId.disabled = own;
  const stoneControls=$("#receive-stone-controls",form);
  if(stoneControls) {
    stoneControls.hidden=own;
    const enabled=!own&&form.elements.hasStones.checked;
    form.elements.hasStones.disabled=own;
    $("#receive-stone-weights",form).hidden=!enabled;
    form.elements.grossWeight.required=enabled;
    form.elements.grossWeight.disabled=!enabled;
    form.elements.weightStatus.disabled=!enabled;
    if(own)form.elements.hasStones.checked=false;
  }
  if (own) {
    setNumericValue(form.elements.receivedWeight, 0);
    form.elements.receivedWeight.readOnly = true;
  } else form.elements.receivedWeight.readOnly = false;
}
function quotePreview(form) {
  const b = inputData(form),
    base =
      Number(b.labor || 0) +
      Number(b.materialPrice || 0) +
      Number(b.goldPrice || 0);
  const el = $("#quote-preview");
  if (el) {
    try {
      const tax=N.tax(base,Number(b.taxPercent||0));
      if(base+tax>1e12)throw new Error("El presupuesto supera el máximo de un billón de COP.");
      el.innerHTML = `Subtotal ${cop(base)} · Impuesto ${cop(tax)}<strong>Presupuesto total: ${cop(base + tax)}</strong>`;
    } catch(e){el.textContent=e.message;}
  }
  const summary = $("#labor-estimate-summary", form);
  if (summary) {
    const estimate = form.elements.laborEstimate.value;
    summary.innerHTML = estimate ? laborEstimateSummary(JSON.parse(estimate), Number(b.labor || 0)) : "";
  }
  const metalsList = $("#order-metal-list", form);
  if (metalsList) metalsList.innerHTML = orderMetalsTable(JSON.parse(form.elements.orderMetals.value || "[]"), true);
  const stonesList=$("#receive-own-stones",form);
  if(stonesList)stonesList.innerHTML=receptionStonesTable(JSON.parse(form.elements.ownStones.value||"[]"));
}
function orderMetalsTable(items, editable = false) {
  if (!items.length) return "";
  return card("Detalle de metal cobrado", "Estos precios están incluidos en el total a cobrar por metal. Añadirlos no descuenta inventario.", table(["Metal / descripción", "Precio total · COP", ...(editable ? [""] : [])], items.map((x)=>tr([E(x.name), cop(x.price), ...(editable ? [`<div class="actions">${button("Editar","edit-order-metal","edit","small",x.id)}${button("Quitar","remove-order-metal","","small danger",x.id)}</div>`] : [])])).join("")));
}
function setOrderMetals(form, items) {
  const oldItems = JSON.parse(form.elements.orderMetals.value || "[]");
  const oldTotal = oldItems.reduce((v,x)=>v+Number(x.price),0);
  const newTotal = items.reduce((v,x)=>v+Number(x.price),0);
  const currentTotal = numericValue(form.elements.goldPrice);
  if (currentTotal < oldTotal) throw new Error("Revisa el total de metal vendido antes de modificar el detalle.");
  const total = currentTotal - oldTotal + newTotal;
  if (total > 1e12) throw new Error("El total de metales supera el máximo permitido.");
  form.elements.orderMetals.value = JSON.stringify(items);
  setNumericValue(form.elements.goldPrice, total);
  dirty = true;
  quotePreview(form);
}
function budgetMetalOptions(current="") {
  const options=[...goldCategories().filter(x=>x.active).map(x=>[x.name,x.name+" · ley "+number(x.purity)]),...metals().filter(x=>x.id!=="oro").map(x=>[x.name,x.name])];
  if(current&&!options.some(x=>x[0]===current))options.push([current,current+" (registrado anteriormente)"]);
  return [["","Seleccionar metal / categoría"],...options];
}
function orderMetalModal(id) {
  const form = $("#receive-form");
  if (!form) return;
  const items = JSON.parse(form.elements.orderMetals.value || "[]");
  const item = items.find((x)=>x.id===id);
  modal(item ? "Editar metal de esta orden" : "Añadir metal al presupuesto", `<p class="muted">Selecciona el metal o una categoría registrada y su precio total para este trabajo.</p><div class="form-grid section-gap"><div class="span-2">${select("name","Metal / categoría",budgetMetalOptions(item?.name),item?.name || "")}</div><div class="span-2">${moneyField("price","Precio total de este metal · COP",item?.price ?? 0)}</div><p class="muted span-2">Se suma una sola vez al total de metal vendido de esta orden. No cambia el catálogo, las tarifas ni el inventario general.</p></div>`, (b)=>{
    if (!item && items.length >= 50) throw new Error("Puedes detallar hasta 50 metales por orden.");
    const price = Number(b.price);
    if (!Number.isSafeInteger(price) || price < 0 || price > 1e12) throw new Error("Precio total del metal inválido.");
    const next = {id:item?.id || crypto.randomUUID(),name:b.name.trim(),price};
    setOrderMetals(form,item ? items.map((x)=>x.id===item.id ? next : x) : [...items,next]);
  }, "Guardar en esta orden");
}
function removeOrderMetal(id) {
  const form = $("#receive-form");
  const items = JSON.parse(form.elements.orderMetals.value || "[]");
  setOrderMetals(form,items.filter((x)=>x.id!==id));
}
function inlineOrderMetal(x) {
  return `<section class="span-2" data-order-metal-row="${E(x.id)}"><div class="form-grid">${select("orderMetalName-"+x.id,"Metal / categoría",budgetMetalOptions(x.name),x.name)}${moneyField("orderMetalPrice-"+x.id,"Precio total · COP",x.price)}<div class="span-2">${button("Quitar metal","remove-inline-metal","","small danger",x.id)}</div></div></section>`;
}
function readInlineMetals(form) {
  return $$("[data-order-metal-row]",form).map((row)=>({id:row.dataset.orderMetalRow,name:$("[name^=orderMetalName-]",row).value.trim(),price:numericValue($("[name^=orderMetalPrice-]",row))}));
}
function updateInlineMetalTotal(form) {
  const total = readInlineMetals(form).reduce((v,x)=>v+x.price,0);
  const previous = Number(form.dataset.metalTotal || 0);
  setNumericValue(form.elements.goldPrice, Math.max(0,numericValue(form.elements.goldPrice) - previous + total));
  form.dataset.metalTotal = String(total);
}
function laborEstimateSummary(x, charged, expanded = false) {
  const unit = x.mode === "weight" ? "g" : "horas";
  return `<details class="calculator"${expanded ? " open" : ""}><summary>Estimado de mano de obra: ${cop(x.suggested)}</summary>${row("Base de cálculo", number(x.quantity, 3) + " " + unit + " × " + cop(x.rate))}${row("Costo directo estimado", cop(x.directCost))}${row("Costos indirectos", cop(x.overhead))}${row("Costo base estimado", cop(x.baseCost))}${row("Recargo sobre costo", number(x.markup) + " %")}${row("Cobro mínimo", cop(x.minimum))}${row("Sugerido antes de impuestos", cop(x.suggested))}${charged !== undefined && charged !== x.suggested ? `<p class="muted">El valor de mano de obra se ajustó manualmente a ${cop(charged)}.</p>` : ""}</details>`;
}
function estimateLaborModal() {
  const reception = $("#receive-form");
  if (!reception) return;
  const x = reception.elements.laborEstimate.value ? JSON.parse(reception.elements.laborEstimate.value) : {};
  modal("Estimar mano de obra", `<p class="muted">Calcula el costo del trabajo por horas o gramos. Usa los costos reales de tu taller; el recargo se aplica sobre el costo, antes de impuestos. El metal y los insumos se cotizan por separado.</p><div class="form-grid section-gap">${select("mode", "Base de cálculo", [["time", "Por horas"], ["weight", "Por gramos"]], x.mode || "time")}${field("quantity", "Horas estimadas", "number", x.quantity ?? 1, 'min="0.001" max="1000000" step="0.001" required')}${moneyField("rate", "Costo de mano de obra por hora · COP", x.rate ?? 0)}${moneyField("overhead", "Costos indirectos de este trabajo · COP", x.overhead ?? 0)}${field("markup", "Recargo sobre costo (%)", "number", x.markup ?? 0, 'min="0" max="1000" step="0.01" required')}${moneyField("minimum", "Cobro mínimo de mano de obra · COP", x.minimum ?? 0)}<div id="labor-preview" class="span-2"></div><p class="muted span-2">Sugerido = máximo entre el cobro mínimo y (cantidad × costo unitario + costos indirectos) × (1 + recargo / 100). Se redondea hacia arriba a pesos enteros. Usa 0,50 horas para media hora.</p></div>`, (b) => {
    const estimate = window.TallerLabor.calculate(b);
    setNumericValue(reception.elements.labor, estimate.suggested);
    reception.elements.laborEstimate.value = JSON.stringify(estimate);
    dirty = true;
    quotePreview(reception);
  }, "Aplicar estimado al presupuesto");
  $("#modal-form").elements.rate.setAttribute("min", "1");
  updateLaborPreview();
}
function updateLaborPreview() {
  const form = $("#modal-form");
  if (!form || !$("#labor-preview", form)) return;
  const byWeight = form.elements.mode.value === "weight";
  form.elements.quantity.closest("label").querySelector("span").textContent = byWeight ? "Gramos a trabajar (estimados)" : "Horas estimadas";
  form.elements.rate.closest("label").querySelector("span").textContent = byWeight ? "Costo de mano de obra por gramo · COP" : "Costo de mano de obra por hora · COP";
  try {
    const estimate = window.TallerLabor.calculate(inputData(form));
    $("#labor-preview", form).innerHTML = laborEstimateSummary(estimate, undefined, true);
  } catch (e) {
    $("#labor-preview", form).innerHTML = notice("Completa el cálculo", e.message, "amber");
  }
}
function orderDetail(o) {
  if (!o || o.deletedAt)
    return notice(
      "La orden no existe",
      "Vuelve al listado de órdenes.",
      "amber",
    );
  let operations = "";
  if (o.status === "received")
    operations =
      allowed(
        "production",
        "Asignar a mesa",
        "assign-order",
        "smith",
        "primary",
        o.id,
      ) +
      allowed(
        "orders",
        "Anular y devolver",
        "cancel-order",
        "",
        "danger",
        o.id,
      );
  if (o.status === "in_progress")
    operations =
      allowed(
        "production",
        "Registrar avance",
        "progress-order",
        "",
        "",
        o.id,
      ) +
      allowed("production", "Aportar metal", "add-metal", "plus", "", o.id) +
      allowed(
        "production",
        "Pesar retorno",
        "return-order",
        "gold",
        "primary",
        o.id,
      );
  if (o.status === "quality")
    operations = allowed(
      "production",
      "Aprobar calidad",
      "quality-order",
      "check",
      "primary",
      o.id,
    );
  if (o.status === "ready")
    operations =
      o.type === "Producción propia"
        ? allowed(
            "production",
            "Recibir piezas en inventario",
            "receive-stock",
            "box",
            "primary",
            o.id,
          )
        : allowed(
            "orders",
            "Entregar pieza",
            "deliver-order",
            "gem",
            "primary",
            o.id,
          );
  if (active(o) && due(o) > 0 && o.type !== "Producción propia")
    operations += allowed(
      "payments",
      "Registrar abono",
      "pay-order",
      "cash",
      "gold",
      o.id,
    );
  if (["received", "in_progress"].includes(o.status))
    operations += allowed(
      "production",
      "Consumir insumos",
      "use-material",
      "box",
      "",
      o.id,
    );
  if (active(o) && paid(o) > 0)
    operations += allowed(
      "adjust",
      "Devolver anticipo",
      "refund-order",
      "cash",
      "",
      o.id,
    );
  if (o.status === "delivered" && o.invoice) operations += reversalButton("sale",o.id);
  if (o.status === "in_progress") operations += reversalButton("assignment",o.id);
  if (o.status === "ready") operations += reversalButton("quality",o.id);
  if (o.status !== "cancelled") operations += allowed("adjust","Reversar orden completa","reverse-operation","refresh","danger","order|"+o.id);
  if (find("clients", o.clientId)?.phone)
    operations += button("Preparar mensaje WhatsApp", "whatsapp", "", "", o.id);
  const sum = (owner) =>
    o.allocations
      .filter((x) => !owner || x.owner === owner)
      .reduce((v, x) => v + x.mg, 0);
  let reception =
    row("Cliente", E(client(o))) +
    row("Metal en custodia", weight(o.receivedMg)) +
    row("Ley", E(o.metal) + " · " + number(o.purity));
  reception +=
    '<div style="font-size:12px;line-height:1.9;margin-top:16px"><strong>Estado recibido</strong><p>' +
    E(o.condition) +
    '</p><br><strong>Medidas y observaciones</strong><p style="white-space:pre-wrap">' +
    E(o.notes || "Sin observaciones adicionales.") +
    "</p></div>";
  if (o.photo)
    reception +=
      '<img class="photo-preview section-gap" src="' +
      E(o.photo) +
      '" alt="Pieza recibida">';
  let production =
    row("Metal enviado a mesa", weight(sum())) +
    row("Del cliente", weight(sum(o.id))) +
    row("Del taller", weight(sum("taller")));
  production += o.allocations.map(x=>{const item=PM.identity(o,x);return row(E(item.metal)+" · ley "+number(item.purity)+" · "+(x.owner==="taller"?"Taller":"Cliente"),weight(x.mg));}).join("");
  const ret = o.returned;
  if (ret) {
    production += PM.groups(o).map(g=>row(E(g.metal)+" · ley "+number(g.purity)+" · pieza / limalla",weight(g.indexes.reduce((sum,i)=>sum+ret.pieces[i],0))+" / "+weight(g.indexes.reduce((sum,i)=>sum+ret.scraps[i],0)))).join("");
    production +=
      row("Metal neto en pieza terminada", weight(ret.pieceMg)) +
      row("Limalla recuperada", weight(ret.scrapMg)) +
      row(
        "Merma definitiva",
        weight(ret.lossMg) + " · " + number(ret.percent) + " %",
      );
    production +=
      '<div class="section-gap">' +
      badge(
        (ret.maxPercent ?? ret.percent) > S.settings.lossWarning
          ? "Fuera de rango"
          : (ret.maxPercent ?? ret.percent) > S.settings.lossNormal
            ? "Por revisar"
            : "Normal",
        (ret.maxPercent ?? ret.percent) > S.settings.lossWarning
          ? "red"
          : (ret.maxPercent ?? ret.percent) > S.settings.lossNormal
            ? "amber"
            : "",
      ) +
      '</div><p class="muted" style="font-size:11px;margin-top:12px">Absorción: ' +
      E(ret.absorption) +
      " · " +
      E(ret.reason) +
      "</p>";
  } else
    production +=
      '<p class="muted section-gap" style="font-size:12px">El retorno exige pesajes separados de la pieza y la limalla.</p>';
  let account =
    row("Mano de obra", cop(o.labor)) +
    row("Piedras e insumos", cop(o.materialPrice)) +
    row("Metal del taller", cop(o.goldPrice)) +
    row("Impuesto (" + number(o.taxPercent) + " %)", cop(o.tax)) +
    row("Total", cop(total(o)), "total") +
    row("Abonos", cop(paid(o))) +
    row("Saldo", cop(due(o)), "debt");
  if (o.laborEstimate) account += laborEstimateSummary(o.laborEstimate, o.labor);
  if (o.orderMetals?.length) account += orderMetalsTable(o.orderMetals);
  const ownIssued = o.allocations.filter(x=>x.owner==="taller").reduce((v,x)=>v+x.mg,0);
  account += ownIssued
    ? notice("Salida de metal propio registrada", o.allocations.filter(x=>x.owner==="taller").map(x=>{const item=PM.identity(o,x);return `${weight(x.mg)} de ${item.metal}, ley ${number(item.purity)}`;}).join("; ")+". Estos gramos se descontaron del inventario y pasaron a producción.", "blue")
    : notice("Sin salida de metal propio registrada", "El presupuesto no retira gramos de tu inventario. Si usarás metal del taller, registra su peso en Asignar a mesa.", "blue");
  if (o.invoice) account += row("Comprobante de entrega", E(o.invoice));
  account +=
    '<p class="muted section-gap" style="font-size:10px">La venta se reconoce al entregar. El metal del cliente no se cobra como venta.</p>';
  const history =
    '<div class="timeline">' +
    [...o.history]
      .reverse()
      .map(
        (x) =>
          '<div class="timeline-item"><p>' +
          E(timelineText(x.text)) +
          "</p><small>" +
          dt(x.at) +
          " · " +
          E(x.actor) +
          "</small></div>",
      )
      .join("") +
    "</div>";
  const pays = S.payments.filter((x) => x.orderId === o.id && !x.deletedAt);
  const payments = pays
    .map(
      (x) =>
        '<div class="summary-row"><span><strong>' +
        E(x.code) +
        "</strong><small>" +
        dt(x.at) +
        (x.voidedAt ? " · ANULADO" : "") +
        '</small></span><div class="actions">' +
        cop(x.applied) +
        button("Imprimir", "print-payment", "print", "small", x.id) +
        (!x.voidedAt && can("adjust") && active(o)
          ? reversalButton("payment",x.id)
          : "") +
        "</div></div>",
    )
    .join("");
  const stages = ["received", "in_progress", "quality", "ready", "delivered"];
  const stageHtml =
    '<div class="stages">' +
    stages
      .map(
        (st, i) =>
          '<div class="stage ' +
          (i < stages.indexOf(o.status)
            ? "done"
            : st === o.status
              ? "current"
              : "") +
          '">' +
          (i + 1) +
          ". " +
          statusNames[st] +
          "</div>",
      )
      .join("") +
    "</div>";
  return (
    head(
      "TRAZABILIDAD DE LA PIEZA",
      o.code,
      o.type + " · Creada " + dt(o.createdAt),
      button("Órdenes", "orders", "orders") +
        button("Comprobante", "print-order", "print", "", o.id) +
        (active(o)
          ? allowed("orders", "Editar ficha", "edit-order", "", "", o.id)
          : ""),
    ) +
    '<section class="order-header"><div><div class="eyebrow">' +
    E(client(o)) +
    "</div><h2>" +
    E(o.description) +
    "</h2><p>" +
    E(o.metal) +
    " · Ley " +
    number(o.purity) +
    " · Prometida " +
    dateLabel(o.dueDate) +
    "<br>" +
    E(smith(o)) +
    '</p></div><div class="number">' +
    status(o) +
    '<div class="kpi-value">' +
    cop(due(o)) +
    "</div><small>Saldo por cobrar · COP</small></div></section>" +
    (active(o) && o.dueDate < today()
      ? notice(
          "La fecha prometida ya pasó",
          "Revisa el avance y acuerda la entrega con el cliente.",
          "amber",
        )
      : "") +
    '<div class="actions" style="margin-bottom:22px">' +
    operations +
    "</div>" +
    stageHtml +
    '<div class="grid two"><div class="grid" style="align-content:start">' +
    card(
      "Recepción y ficha técnica",
      "Lo acordado con el cliente.",
      reception,
    ) +
    card(
      "Metal y producción",
      "Propiedad separada durante todo el proceso.",
      production,
    ) +
    orderStonesCard(o) +
    (o.materialUsage.filter(x=>!x.deletedAt).length
      ? card(
          "Piedras e insumos utilizados",
          "Consumos descontados de inventario.",
          o.materialUsage
            .filter(x=>!x.deletedAt)
            .map((x) => row(x.name, E(quantity(x.quantity) + " " + x.unit) + reversalBadge(x)))
            .join(""),
        )
      : "") +
    '</div><div class="grid" style="align-content:start">' +
    card("Cuenta del trabajo", "Presupuesto y abonos registrados.", account) +
    card(
      "Historia de la orden",
      "Cada cambio conserva su responsable.",
      history,
    ) +
    (pays.length
      ? card("Comprobantes de cobro", "Abonos de esta orden.", payments)
      : "") +
    "</div></div>"
  );
}

function clientsPage() {
  const q = (filters.clientQ || "").toLowerCase(),
    list = S.clients.filter((c) =>
      `${c.name} ${c.document} ${c.phone}`.toLowerCase().includes(q),
    );
  return (
    head(
      "RELACIONES QUE PERDURAN",
      "Clientes y custodias",
      "Datos de contacto, piezas bajo cuidado y cuentas pendientes.",
      allowed("clients", "Nuevo cliente", "new-client", "plus", "primary"),
    ) +
    `<section class="card table-card"><div class="filters"><div class="search-box">${icon("search")}<input id="client-search" data-filter="clientQ" class="control" placeholder="Buscar nombre, documento o teléfono…" value="${E(filters.clientQ || "")}"></div></div>${table(
      [
        "Cliente",
        "Documento / contacto",
        "Órdenes activas",
        "Metal en custodia",
        "Saldo",
        "",
      ],
      list
        .map((c) => {
          const orders = S.orders.filter(
              (o) => o.clientId === c.id && active(o),
            ),
            ids = orders.map((o) => o.id),
            custody = getBalances().filter(
              (x) =>
                ids.includes(x.owner) &&
                ["custody", "process", "scrap"].includes(x.account),
            );
          return tr([
            `<strong>${E(c.name)}</strong><small>${E(c.notes.slice(0, 65))}</small>`,
            E(c.document || "—") +
              `<small>${E(c.phone || "Sin teléfono")}</small>`,
            orders.length,
            custody.length
              ? custody
                  .map(
                    (x) =>
                      `${weight(x.mg)} ${E(x.metal)} · ${number(x.purity)}`,
                  )
                  .join("<br>")
              : "—",
            `<span style="color:var(--debt)">${cop(orders.reduce((v, o) => v + due(o), 0))}</span>`,
            button("Expediente", "client-detail", "", "small", c.id) +
              allowed("clients", "Editar", "edit-client", "", "small", c.id),
          ]);
        })
        .join(""),
      "Registra el primer cliente para recibir un trabajo.",
    )}</section>`
  );
}
const metalCop = value => "$ " + new Intl.NumberFormat("es-CO",{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
function valuationLabel(rows) {
  if(rows.length&&rows.every(x=>x.estimatedCop===null))return "Sin tarifa configurada";
  const value=rows.reduce((sum,x)=>sum+(x.estimatedCop??0n),0n);
  return metalCop(value)+(rows.some(x=>x.estimatedCop===null)?" · parcial, falta tarifa":"");
}
function goldPage() {
  const valuation=N.metalValuation(getBalances(),S.settings.rate),balances = valuation.rows,
    q = filters.ledgerAccount || "",
    m = filters.ledgerMetal || "",
    p = filters.ledgerPurity || "",
    owner = filters.ledgerOwner || "",
    from = filters.ledgerFrom || "",
    to = filters.ledgerTo || "";
  const ledger = S.ledger.filter(
    (x) =>
      !x.deletedAt &&
      (!q || x.from === q || x.to === q) &&
      (!m || x.metal === m) &&
      (!p || x.purity === Number(p)) &&
      (!owner ||
        (owner === "taller" ? x.owner === "taller" : x.owner !== "taller")) &&
      (!from || dayKey(x.at) >= from) &&
      (!to || dayKey(x.at) <= to),
  );
  return (
    head(
      "CADA GRAMO, EN SU LUGAR",
      "Libro de metales",
      "Existencias por metal, ley, propietario y ubicación.",
      allowed("inventory", "Trasladar metal", "transfer-metal", "arrow") +
        allowed(
          "adjust",
          "Conteo / saldo inicial",
          "adjust-metal",
          "gold",
          "primary",
        ),
    ) +
    notice(
      "Custodia y patrimonio separados",
      "Las existencias de cada metal se muestran por separado. El fino no se suma entre metales distintos.",
      "blue",
    ) +
    `<section id="metal-valuation" class="section-gap"><div class="kpis">${kpi("Valor general en taller",valuationLabel(balances),"Todas las ubicaciones · tarifas actuales","gold",true)}${kpi("Valor del metal propio",valuationLabel(balances.filter(x=>x.owner==="taller")),"Patrimonio del taller · COP","chart")}${kpi("Valor del metal de clientes",valuationLabel(balances.filter(x=>x.owner!=="taller")),"Custodia y trabajo · propiedad de clientes","shield")}</div><p class="muted section-gap">Valoración estimada: gramos finos de cada metal × su tarifa actual en Configuración. Incluye solo las existencias actuales, sin duplicar los traslados entre ubicaciones.</p>${valuation.missing.length?notice("Valoración incompleta","Falta configurar una tarifa mayor que cero para: "+valuation.missing.map(id=>metals().find(x=>x.id===id)?.name||id).join(", ")+". Estos metales conservan sus gramos y no se consideran de valor cero.","amber"):""}</section>`+
    card("Valor por metal","Total de cada metal en todas las ubicaciones del taller.",table(["Metal","Peso bruto","Fino","Tarifa COP / g fino","Propio COP","Clientes COP","Total COP"],[...new Set(balances.map(x=>x.metal))].map(id=>{
      const rows=balances.filter(x=>x.metal===id);
      return tr([E(metals().find(x=>x.id===id)?.name||id),weight(rows.reduce((sum,x)=>sum+x.mg,0)),fine(rows.reduce((sum,x)=>sum+x.fineUg,0)),S.settings.rate[id]>0?cop(S.settings.rate[id]):"Sin tarifa",valuationLabel(rows.filter(x=>x.owner==="taller")),valuationLabel(rows.filter(x=>x.owner!=="taller")),valuationLabel(rows)]);
    }).join(""),"Las existencias registradas aparecerán aquí con su valoración."))+
    `<div class="grid three">${Object.entries(ACC)
      .map(([acc, label]) => {
        const b = balances.filter((x) => x.account === acc);
        return `<section class="card account-card section-gap" data-metal-account="${acc}" ${acc === "own" ? 'style="background:var(--green);color:white"' : ""}><div class="kpi-label" ${acc === "own" ? 'style="color:#d0deca"' : ""}>${E(label)}${icon("gold")}</div><div class="section-gap"><small>Valor total de esta ubicación</small><div class="kpi-value" data-account-value>${valuationLabel(b)}</div></div>${
          b.length
            ? [...new Set(b.map(x=>x.metal))]
                .filter((m) => b.some((x) => x.metal === m))
                .map((m) => {
                  const bs = b.filter((x) => x.metal === m),
                    mg = bs.reduce((v, x) => v + x.mg, 0),
                    ug = bs.reduce((v, x) => v + x.fineUg, 0);
                  return `<div class="kpi-value">${weight(mg)} <span style="font-size:11px">${E(m)}</span></div><small>${fine(ug)} · ${valuationLabel(bs)}</small>`;
                })
                .join("")
            : '<div class="kpi-value">0,000 g</div><small>Sin existencias registradas</small>'
        }${acc === "custody" ? `<div>${badge("Propiedad del cliente", "blue")}</div>` : ""}${b.some((x) => x.owner !== "taller") && acc !== "custody" ? `<div>${badge("Incluye metal de clientes", "blue")}</div>` : ""}${button("Ver movimientos", "filter-account", "arrow", "link", acc)}</section>`;
      })
      .join(
        "",
      )}</div><section id="metal-movements" class="card table-card section-gap" aria-labelledby="metal-movements-title"><div class="card-head"><div><h2 id="metal-movements-title" tabindex="-1">Movimientos de metal</h2><p>${E(q?ACC[q]:"Todas las cuentas")} · ${number(ledger.length)} movimientos · historial sin borrado.</p></div>${button("Exportar Excel", "export-ledger", "download", "small")}</div><div class="filters"><select class="control" data-filter="ledgerAccount" aria-label="Cuenta">${option("", "Todas las cuentas", q)}${Object.entries(
      ACC,
    )
      .map(([k, v]) => option(k, v, q))
      .join(
        "",
      )}</select><select class="control" data-filter="ledgerMetal" aria-label="Metal">${option("", "Todos los metales", m)}${metals().map((x) => option(x.id, x.name, m)).join("")}</select><select class="control" data-filter="ledgerPurity" aria-label="Ley">${option("", "Todas las leyes", p)}${[
      ...new Set(S.ledger.map((x) => x.purity)),
    ]
      .sort()
      .map((x) => option(x, x, p))
      .join(
        "",
      )}</select><select class="control" data-filter="ledgerOwner" aria-label="Propietario">${option("", "Todos los propietarios", owner)}${option("taller", "Taller", owner)}${option("clientes", "Clientes", owner)}</select><input class="control" type="date" data-filter="ledgerFrom" value="${E(from)}" aria-label="Desde"><input class="control" type="date" data-filter="ledgerTo" value="${E(to)}" aria-label="Hasta"></div>${table(
      [
        "Fecha / referencia",
        "Ruta",
        "Metal / ley",
        "Peso bruto",
        "Fino",
        "Propietario",
        "",
      ],
      [...ledger]
        .reverse()
        .slice(0, 500)
        .map((x) =>
          tr([
            `<strong>${E(x.ref)}</strong><small>${dt(x.at)}</small>`,
            `<span>${E(ACC[x.from] || x.from)}</span><small>→ ${E(ACC[x.to] || x.to)}</small>`,
            E(x.metal) + " · " + number(x.purity),
            weight(x.mg),
            fine(x.fineUg),
            x.owner === "taller"
              ? "Taller"
              : badge(find("orders", x.owner)?.code || "Cliente", "blue"),
            button("Detalle", "movement-detail", "", "small", x.id) + (x.reversedAt ? reversalBadge(x) : ["TRASLADO","CONCILIACIÓN"].includes(x.ref) ? reversalButton("ledger",x.id) : ""),
          ]),
        )
        .join(""),
      "No hay movimientos que coincidan con los filtros.",
    )}</section>${card("Existencias detalladas", "Conciliación por metal, ley y propietario.", table(["Cuenta", "Metal", "Ley", "Propietario", "Bruto", "Fino", "Valor estimado COP"], balances.map((x) => tr([E(ACC[x.account]), E(x.metal), x.purity, x.owner === "taller" ? "Taller" : E(find("orders", x.owner)?.code || "Cliente"), weight(x.mg), fine(x.fineUg), valuationLabel([x])])).join("")))}`
  );
}
function productionPage() {
  const list = S.orders.filter((o) =>
    ["received", "in_progress", "quality", "ready"].includes(o.status),
  );
  return (
    head(
      "DEL DISEÑO A LA PIEZA",
      "Producción del taller",
      "Asignaciones, ficha técnica, etapas, pesajes y control de calidad.",
      allowed(
        "orders",
        "Nueva fabricación",
        "new-production",
        "plus",
        "primary",
      ),
    ) +
    `<div class="kpis">${kpi("Por asignar", list.filter((o) => o.status === "received").length, "Órdenes recibidas", "orders")}${kpi("En mesas", list.filter((o) => o.status === "in_progress").length, "Con orfebre asignado", "smith", true)}${kpi("Control de calidad", list.filter((o) => o.status === "quality").length, "Retorno pesado y liquidado", "gem")}${kpi("Listas", list.filter((o) => o.status === "ready").length, "Pendientes de entrega o inventario", "check")}</div><div class="section-gap card table-card"><div class="card-head"><div><h2>Carga de producción</h2><p>Abre una orden para operar sobre sus materiales y etapas.</p></div></div>${table(["Orden / trabajo", "Orfebre", "Metal entregado", "Estado", "Prometida", ""], list.map((o) => tr([`<strong>${E(o.code)}</strong><small>${E(o.description)}</small>`, E(smith(o)), weight(o.allocations.reduce((v, x) => v + x.mg, 0)), status(o), dateLabel(o.dueDate), button("Abrir ficha", "open-order", "arrow", "link", o.id)], o.id)).join(""), "Las órdenes recibidas aparecerán en la carga de producción.")}</div><div class="section-gap">${card(
      "Fundición y aleaciones",
      "Registra la carga, la liga sin metal precioso y el resultado ensayado.",
      table(
        ["Lote", "Metal", "Entrada", "Liga", "Salida", "Pérdida de fino"],
        [...S.melts]
          .reverse()
          .map((x) =>
            tr([
              `<strong>${E(x.code)}</strong><small>${dt(x.at)}</small>`,
              E(x.metal),
              weight(x.inputMg) + " · " + x.inputPurity,
              weight(x.alloyMg),
              weight(x.outputMg) + " · " + x.outputPurity,
              fine(x.fineLossUg),
            ]),
          )
          .join(""),
        "Todavía no hay fundiciones registradas.",
      ),
      allowed("inventory", "Nueva fundición", "new-melt", "plus", "primary"),
    )}</div>`
  );
}
function smithsPage() {
  return (
    head(
      "EL OFICIO, EN BUENAS MANOS",
      "Orfebres y rendimiento",
      "Metal bajo responsabilidad y honorarios pendientes.",
      allowed(
        "production",
        "Registrar orfebre",
        "new-smith",
        "plus",
        "primary",
      ),
    ) +
    `<div class="grid two">${
      S.smiths
        .map((x) => {
          const orders = S.orders.filter((o) => o.smithId === x.id),
            inBench = orders.filter((o) => o.status === "in_progress"),
            liquidated = orders.filter((o) => o.returned),
            assigned = liquidated.reduce(
              (v, o) => v + o.allocations.reduce((a, x) => a + x.mg, 0),
              0,
            ),
            lost = liquidated.reduce((v, o) => v + o.returned.lossMg, 0),
            pending = liquidated
              .filter(
                (o) => !S.settlements.some((x) => !x.reversedAt && x.orderIds.includes(o.id)),
              )
              .reduce((v, o) => v + o.smithFee, 0);
          return card(
            x.name,
            x.bench,
            row("Órdenes en mesa", inBench.length) +
              row("Honorarios pendientes", cop(pending)) +
              row(
                "Merma ponderada",
                assigned
                  ? number((lost * 100) / assigned) + " %"
                  : "Sin liquidaciones",
              ) +
              inBench
                .map(
                  (o) =>
                    `<div class="summary-row"><span>${E(o.code)}<small>${E(o.description)}</small></span>${button("Abrir ficha", "open-order", "arrow", "small", o.id)}</div>`,
                )
                .join("") +
              `<div class="actions section-gap">${allowed("production", "Editar", "edit-smith", "", "small", x.id)}${pending ? allowed("cash", "Liquidar honorarios", "settle-smith", "cash", "primary small", x.id) : ""}</div>`,
          );
        })
        .join("") ||
      card(
        "Tu equipo de taller",
        "",
        empty(
          "Registra a tus orfebres",
          "Cada asignación y liquidación quedará ligada a su responsable.",
        ),
      )
    }</div><section class="card table-card section-gap"><div class="card-head"><h2>Pagos de honorarios</h2></div>${table(
      ["Fecha", "Orfebre", "Órdenes", "Valor", "Medio / soporte"],
      [...S.settlements.filter(x=>!x.deletedAt)]
        .reverse()
        .map((x) =>
          tr([
            dt(x.at),
            E(find("smiths", x.smithId)?.name),
            x.orderIds.map((id) => E(find("orders", id)?.code)).join(", "),
            cop(x.amount),
            E(x.method === "cash" ? "Efectivo" : "Transferencia") +
              `<small>${E(x.reference)}</small>` + (x.reversedAt ? reversalBadge(x) : reversalButton("settlement",x.id)),
          ]),
        )
        .join(""),
    )}</section>`
  );
}
function paymentsPage() {
  const outstanding = S.orders.filter(
    (o) => active(o) && o.type !== "Producción propia" && due(o) > 0,
  );
  return (
    head(
      "CUENTAS CLARAS",
      "Cobros y cartera",
      "Abonos en dinero o metal, con tarifa y vueltas registradas.",
      allowed("payments", "Registrar pago", "new-payment", "plus", "primary"),
    ) +
    `<div class="kpis">${kpi("Cartera de trabajos abiertos", cop(outstanding.reduce((v, o) => v + due(o), 0)), `${number(outstanding.length)} órdenes con saldo`, "cash", true)}${kpi("Cobrado hoy", cop(S.payments.filter((x) => !x.voidedAt && dayKey(x.at) === today()).reduce((v, x) => v + x.applied, 0)), "Abonos aplicados · COP", "chart")}${kpi("Comprobantes de cobro", S.payments.filter((x) => !x.voidedAt).length, "Con trazabilidad de caja", "file")}${kpi("Órdenes pagadas por entregar", S.orders.filter((o) => active(o) && due(o) === 0 && o.type !== "Producción propia").length, "Saldo en cero", "gem")}</div><section class="card table-card section-gap"><div class="card-head"><h2>Trabajos pendientes de cobro</h2></div>${orderTable(outstanding)}</section><section class="card table-card section-gap"><div class="card-head"><h2>Historial de cobros</h2>${button("Exportar Excel", "export-payments", "download", "small")}</div>${table(
      [
        "Comprobante / fecha",
        "Orden",
        "Efectivo",
        "Transferencia",
        "Metal recibido",
        "Vueltas",
        "Abono aplicado",
        "",
      ],
      [...S.payments.filter(x=>!x.deletedAt)]
        .reverse()
        .map((x) =>
          tr([
            `<strong>${E(x.code)}</strong>${x.voidedAt ? badge("Anulado", "red") : ""}<small>${dt(x.at)}</small>`,
            E(find("orders", x.orderId)?.code),
            cop(x.cash),
            cop(x.bank),
            x.goldMg
              ? `${weight(x.goldMg)} ${E(x.metal)} · ${number(x.purity)}<small>${cop(x.goldValue)}</small>`
              : "—",
            cop(x.change),
            cop(x.applied),
            button("Comprobante", "print-payment", "print", "small", x.id) + (!x.voidedAt ? reversalButton("payment",x.id) : ""),
          ]),
        )
        .join(""),
    )}</section>`
  );
}
function expenseRows() {
  const recorded=(S.expenses||[]).filter(x=>!x.deletedAt).map(x=>({...x,kind:"expense",key:"expense|"+x.id,legacy:false}));
  const previous=S.cashEntries.filter(x=>!x.deletedAt&&x.ref==="CAJA"&&x.amount<0&&!x.expenseId).map(x=>({...x,kind:"cash",key:"cash|"+x.id,legacy:true,code:"Salida de caja",expenseDate:dayKey(x.at),concept:x.note,category:"Sin clasificar",beneficiary:"",reference:"",method:"cash",amount:-x.amount}));
  return [...recorded,...previous].sort((a,b)=>a.at.localeCompare(b.at));
}
function filteredExpenses() {
  const from=filters.expenseFrom||"",to=filters.expenseTo||"";
  return expenseRows().filter(x=>(!from||x.expenseDate>=from)&&(!to||x.expenseDate<=to)&&(!filters.expenseMethod||x.method===filters.expenseMethod)&&(!filters.expenseCategory||x.category===filters.expenseCategory));
}
function expensesPage() {
  const rows=filteredExpenses(),active=rows.filter(x=>!x.reversedAt&&!x.legacy),sum=items=>items.reduce((v,x)=>v+x.amount,0);
  const filtered=!!(filters.expenseFrom||filters.expenseTo||filters.expenseMethod||filters.expenseCategory);
  return head("EL DÍA A DÍA DEL TALLER","Gastos del taller","Registra lo pagado, conserva el soporte y revisa de dónde salió el dinero.",allowed("cash","Registrar gasto","new-expense","plus","primary")+button("Exportar Excel","export-expenses","download"))+
    notice("Una sola salida de dinero","Un gasto en efectivo descuenta la caja abierta. Un gasto bancario no toca el efectivo. Las salidas antiguas se pueden clasificar sin descontarlas otra vez.","blue")+
    `<div class="filters card section-gap">${field("expenseFrom","Desde (opcional)","date",filters.expenseFrom||"",'data-filter="expenseFrom"')}${field("expenseTo","Hasta (opcional)","date",filters.expenseTo||"",'data-filter="expenseTo"')}<label class="field"><span>Medio de pago</span><select data-filter="expenseMethod">${[["","Todos"],["cash","Efectivo"],["bank","Banco"]].map(x=>option(x[0],x[1],filters.expenseMethod||"")).join("")}</select></label><label class="field"><span>Categoría</span><select data-filter="expenseCategory">${[["","Todas"],...expenseCategories.map(x=>[x,x]),["Sin clasificar","Sin clasificar"]].map(x=>option(x[0],x[1],filters.expenseCategory||"")).join("")}</select></label>${filtered?button("Ver todo el historial","reset-expense-filters","refresh","small"):""}</div>`+
    `<p class="muted section-gap">${filtered?"Mostrando "+number(rows.length)+" de "+number(expenseRows().length)+" registros según los filtros seleccionados.":"Mostrando todo el historial de gastos, incluidos los meses anteriores."}</p>`+
    `<div class="kpis">${kpi("Gastos clasificados",cop(sum(active)),"Del período · sin reversados","cash",true)}${kpi("Pagados desde caja",cop(sum(active.filter(x=>x.method==="cash"))),"Ya descontados del efectivo","cash")}${kpi("Pagados por banco",cop(sum(active.filter(x=>x.method==="bank"))),"No descuentan caja","file")}${kpi("Salidas sin clasificar",cop(sum(rows.filter(x=>x.legacy&&!x.reversedAt))),"Movimientos anteriores de caja","chart")}</div>`+
    card("Historial de gastos y salidas","Las compras de metal y los pagos a proveedores u orfebres se registran en sus módulos, para no duplicar salidas.",table(["Fecha / comprobante","Categoría / concepto","Pagado a / soporte","Medio","Valor · COP","Estado / acciones"],[...rows].reverse().map(x=>tr([dateLabel(x.expenseDate)+"<small>"+E(x.code)+" · "+E(x.actor)+"</small>",E(x.category)+"<small>"+E(x.concept)+"</small>",E(x.beneficiary||"—")+"<small>"+E(x.reference)+"</small>",x.method==="cash"?"Efectivo":"Banco",cop(x.amount),`<div class="actions">${x.reversedAt?reversalBadge(x):x.legacy?allowed("cash","Clasificar gasto","classify-expense","edit","small",x.id):badge("Registrado","blue")}${button("Comprobante","print-expense","print","small",x.key)}${!x.reversedAt?reversalButton(x.kind,x.id):""}</div>`])).join("")));
}
function expenseModal(cashEntryId) {
  const original=cashEntryId?S.cashEntries.find(x=>x.id===cashEntryId):null,shift=currentShift();
  if(cashEntryId&&!original)throw new Error("Salida de caja no encontrada.");
  modal(original?"Clasificar gasto ya pagado":"Registrar gasto del taller",`<div class="form-grid">${select("category","Categoría",expenseCategories,"Otros")}${field("expenseDate","Fecha del gasto","date",original?dayKey(original.at):today(),`required max="${today()}"`)}<div class="span-2">${field("concept","Concepto del gasto","text",original?.note||"",'required maxlength="1000" placeholder="Ej. Energía del taller, transporte o reparación de herramienta"')}</div>${moneyField("amount","Valor pagado · COP",original?-original.amount:"")}${select("method","Pagado con",[["cash","Efectivo de caja"],["bank","Banco / transferencia"]],original||shift?"cash":"bank")}<div class="span-2">${field("beneficiary","Pagado a (opcional)","text","",'maxlength="120"')}</div><div class="span-2">${field("reference","Comprobante / referencia de pago","text","",'maxlength="200"')}</div><div id="expense-preview" class="span-2" data-classification="${!!original}"></div></div>`,(b,form,key)=>mutate(original?"expense.classify":"expense.create",{...b,method:original?"cash":b.method,...(original?{cashEntryId:original.id}:{shiftId:shift?.id??null})},key),original?"Guardar clasificación sin descontar":"Registrar gasto");
  if(original){$("#modal-form").elements.method.disabled=true;$("#modal-form").elements.amount.readOnly=true;}
  $("#modal-form").elements.amount.setAttribute("min","1");
  updateExpensePreview();
}
function updateExpensePreview() {
  const form=$("#modal-form"),target=$("#expense-preview",form);
  if(!target)return;
  const classified=target.dataset.classification==="true",cash=form.elements.method.value==="cash";
  form.elements.reference.required=!cash;
  if(classified)target.innerHTML=notice("Este dinero ya salió de caja","Solo vas a clasificar la salida existente. El saldo y el cierre original no se modifican.","blue");
  else if(!cash)target.innerHTML=notice("Pago bancario","Se registra el gasto y su soporte. No descuenta efectivo ni ejecuta una transferencia en tu banco.","blue");
  else if(!currentShift())target.innerHTML=notice("Abre un turno antes de pagar en efectivo","No hay una caja abierta para registrar esta salida.","amber");
  else {const available=expectedCash(currentShift()),amount=numericValue(form.elements.amount);target.innerHTML=`<div class="calculator">${row("Efectivo disponible",cop(available))}${row("Efectivo después del gasto",cop(available-amount))}${amount>available?'<p class="error">El gasto supera el efectivo disponible.</p>':""}</div>`;}
}
function printExpense(key) {
  const x=expenseRows().find(x=>x.key===key);if(!x)throw new Error("Gasto no encontrado.");
  showReceipt("Comprobante de gasto",receiptHeader("COMPROBANTE DE GASTO")+`<hr><strong>${E(x.code)}</strong>${x.reversedAt?" · REVERSADO":""}<br>Fecha del gasto: ${dateLabel(x.expenseDate)}<br>Registrado: ${dt(x.at)}<br>Responsable: ${E(x.actor)}<hr>Categoría: ${E(x.category)}<p class="receipt-pre">${E(x.concept)}</p>Pagado a: ${E(x.beneficiary||"No indicado")}<br>Medio: ${x.method==="cash"?"Efectivo de caja":"Banco / transferencia"}<br>Soporte: ${E(x.reference||"No indicado")}<hr>${row("VALOR PAGADO",cop(x.amount))}<small>${x.method==="cash"?"La salida está registrada en su turno de caja.":"Este gasto no descuenta efectivo de caja."}</small>`);
}
function exportExpenses() {
  if (filters.expenseFrom && filters.expenseTo && filters.expenseFrom > filters.expenseTo) throw new Error("La fecha inicial no puede superar la fecha final.");
  return excel("gastos-taller",["Comprobante","Fecha gasto","Fecha registro","Categoría","Concepto","Pagado a","Medio","Valor COP","Soporte","Responsable","Turno de caja","Estado"],filteredExpenses().map(x=>[x.code,window.TallerExcel.date(x.expenseDate),window.TallerExcel.date(x.at),x.category,x.concept,x.beneficiary,x.method==="cash"?"Efectivo":"Banco",x.amount,x.reference,x.actor,find("shifts",x.shiftId)?.code||"",x.reversedAt?"Reversado":x.legacy?"Sin clasificar":"Registrado"]));
}
function cashPage() {
  const shift = currentShift(),
    gold = cashMetals();
  return (
    head(
      "EL CIERRE DE UNA BUENA JORNADA",
      "Caja y turnos",
      "Arqueo de efectivo y metal, cada uno por separado.",
      shift
        ? allowed("cash", "Cerrar y arquear", "close-shift", "check", "primary")
        : allowed("cash", "Abrir turno", "open-shift", "plus", "primary"),
    ) +
    (shift
      ? `<div class="kpis">${kpi("Efectivo esperado", cop(expectedCash(shift)), shift.code + " · " + shift.actor, "cash", true)}${kpi("Base inicial de efectivo", cop(shift.opening), "Apertura: " + openingModeLabel(shift), "cash")}${kpi("Movimientos del turno", S.cashEntries.filter((x) => x.shiftId === shift.id && !x.deletedAt).length, "Cobros, gastos y pagos", "file")}${kpi("Lotes de metal en caja", gold.length, "Base inicial y recaudo · por ley", "gold")}</div><div class="actions section-gap">${badge("Apertura en " + openingModeLabel(shift), "blue")}${allowed("cash", "Registrar gasto", "new-expense", "plus") + allowed("cash", "Ingreso adicional", "cash-entry", "plus")}${button("Imprimir resumen", "print-shift", "print", "", shift.id)}</div><div class="grid two section-gap">${card("Metal en caja", "Base de apertura y metal recibido como pago.", gold.length ? gold.map((x) => row(x.metal + " · ley " + number(x.purity), weight(x.mg)) + `<p class="balance-details muted">Base en caja: ${weight(x.openingMg)} · Recaudo: ${weight(x.receivedMg)}<br>${fine(x.fineUg)}</p>`).join("") : empty("No hay metal en caja", "La base de oro y los cobros en metal aparecerán aquí."))}${card(
          "Movimientos de efectivo",
          shift.code,
          table(
            ["Hora", "Concepto", "Importe", "Estado / acción"],
            S.cashEntries
              .filter((x) => x.shiftId === shift.id && !x.deletedAt)
              .reverse()
              .map((x) =>
                tr([
                  dt(x.at),
                  E(measurementNote(x.note)) + (x.ref === "CAJA" && x.amount > 0 ? "<small>Ingreso adicional</small>" : ""),
                  `<span style="color:${x.amount < 0 ? "var(--red)" : "var(--green)"}">${x.amount < 0 ? "−" : "+"}${cop(Math.abs(x.amount))}</span>`,
                  x.reversedAt ? reversalBadge(x) : x.expenseId ? reversalButton("expense",x.expenseId) : x.ref === "CAJA" ? reversalButton("cash",x.id) : "",
                ]),
              )
              .join(""),
          ),
        )}</div>`
      : notice(
          "No hay turno abierto",
          "Abre un turno para recibir pagos, registrar gastos o hacer pagos en efectivo.",
          "amber",
        )) +
    `<section class="card table-card section-gap"><div class="card-head"><h2>Historial de turnos</h2></div>${table(
      [
        "Turno / apertura",
        "Responsable",
        "Cierre",
        "Efectivo esperado",
        "Efectivo contado",
        "Base inicial de oro",
        "Estado",
        "",
      ],
      [...S.shifts]
        .reverse()
        .map((x) =>
          tr([
            `<strong>${E(x.code)}</strong><small>${dt(x.openedAt)}</small>${badge(openingModeLabel(x), "gray")}`,
            E(x.actor),
            dt(x.closedAt),
            cop(x.closedAt ? x.expected : expectedCash(x)),
            x.closedAt ? cop(x.counted) : "—",
            (x.openingGold || [])
              .map((g) => weight(g.mg) + " · ley " + number(g.purity))
              .join("<br>") || "—",
            x.closedAt
              ? badge(
                  x.review ? "Por revisar" : "Conciliado",
                  x.review ? "amber" : "",
                )
              : badge("Abierto", "blue"),
            button("Acta", "print-shift", "print", "small", x.id),
          ]),
        )
        .join(""),
    )}</section>`
  );
}
const purchaseItems = p => p.items || [{metal:p.metal,purity:p.purity,mg:p.mg,unitPrice:p.rate,total:p.total,categoryName:p.metal+" · ley "+number(p.purity)}];
function purchasePending(p) {return p.reversedAt?0:p.total-S.supplierPayments.filter(x=>x.purchaseId===p.id&&!x.reversedAt).reduce((sum,x)=>sum+x.amount,0);}
function purchasesPage() {
  return (
    head(
      "EL ORIGEN DE TUS MATERIALES",
      "Órdenes de compra y proveedores",
      "Compra de oro por categoría, ingreso a bodega y cuentas por pagar.",
      allowed("purchases", "Nuevo proveedor", "new-supplier", "plus") +
        allowed("purchases", "Compra de otro metal", "new-metal-purchase", "gold") +
        allowed(
          "purchases",
          "Nueva orden de compra",
          "new-purchase",
          "plus",
          "primary",
        ) + button("Exportar Excel","export-purchases","download"),
    ) +
    `<section class="card table-card"><div class="card-head"><div><h2>Órdenes de compra recibidas</h2><p>La compra registra el ingreso. Su pago se registra por separado.</p></div></div>${table(
      [
        "Orden / documento",
        "Proveedor",
        "Metal / ley",
        "Peso",
        "Total",
        "Pendiente",
        "",
      ],
      [...S.purchases.filter(x=>!x.deletedAt)]
        .reverse()
        .map((x) => {
          const pending = x.reversedAt ? 0 :
            x.total -
            S.supplierPayments
              .filter((p) => p.purchaseId === x.id && !p.reversedAt)
              .reduce((v, p) => v + p.amount, 0);
          return tr([
            `<strong>${E(x.code)}</strong>${reversalBadge(x)}<small>${E(x.document)} · ${dt(x.at)}</small>`,
            E(find("suppliers", x.supplierId)?.name),
            purchaseItems(x).map(item=>`<div>${E(item.categoryName)}<small>${weight(item.mg)} · ley ${number(item.purity)}</small></div>`).join(""),
            weight(x.mg),
            cop(x.total),
            `<span style="color:var(--debt)">${cop(pending)}</span>`,
            button("Comprobante","print-purchase","print","small",x.id) + (x.reversedAt ? reversalBadge(x) : ((pending
              ? allowed(
                  "purchases",
                  "Pagar",
                  "pay-supplier",
                  "cash",
                  "small",
                  x.id,
                )
              : badge("Pagada")) + reversalButton("purchase",x.id))),
          ]);
        })
        .join(""),
    )}</section><div class="grid two section-gap">${card("Proveedores", "Contactos del taller.", S.suppliers.map((x) => `<div class="summary-row"><span><strong>${E(x.name)}</strong><small>${E(x.document)} · ${E(x.phone)}</small></span>${allowed("purchases", "Editar", "edit-supplier", "", "small", x.id)}</div>`).join("") || empty("Registra tu primer proveedor", "Su documento y teléfono quedarán disponibles al comprar."))}${card(
      "Pagos realizados",
      "Soportes ligados a cada compra.",
      table(
        ["Fecha", "Compra", "Valor", "Soporte", "Estado / acción"],
        [...S.supplierPayments.filter(x=>!x.deletedAt)]
          .reverse()
          .map((x) =>
            tr([
              dt(x.at),
              E(find("purchases", x.purchaseId)?.code),
              cop(x.amount),
              E(x.reference),
              x.reversedAt ? reversalBadge(x) : reversalButton("supplierPayment",x.id),
            ]),
          )
          .join(""),
      ),
    )}</div>`
  );
}
const stoneStatuses={held:"Pendiente de montar / devolver",mounted:"Montada en la pieza",returned:"Devuelta físicamente",delivered:"Entregada en la pieza",lost:"Pérdida documentada"};
const ctLabel=x=>x===null?"Quilates sin determinar":number(x/1000,3)+" ct";
function stoneInventory() {
  const lots=(S.gemstoneLots||[]).filter(x=>!x.deletedAt);
  return card("Piedras preciosas del taller","Existencias propias. Las piedras del cliente se registran en su orden y nunca aumentan este inventario.",
    `<div class="actions">${allowed("inventory","Registrar lote o piedra","new-gem","plus","primary")}${button("Excel de piedras","export-gems","download")}${button("Piedras por trabajo","export-gem-orders","download")}</div>`+
    row("Costo disponible en bodega",cop(lots.reduce((sum,x)=>sum+x.remainingCost,0)))+
    table(["Código / piedra","Disponibles","Quilates disponibles","Costo disponible","Precio sugerido / unidad",""],lots.map(x=>tr([`<strong>${E(x.code)} · ${E(x.name)}</strong><small>${E(x.individual?"Piedra individual":"Lote")}${x.certificate?" · "+E(x.certificate):""}</small>`,number(x.available),ctLabel(x.remainingCaratMilli),cop(x.remainingCost),cop(x.unitPrice),button("Ficha","gem-lot-detail","","small",x.id)+(x.reversedAt?reversalBadge(x):reversalButton("gemLot",x.id))])).join(""),"Registra piedras con sus quilates y costo. Se descuentan al añadirlas a una orden."));
}
function stoneReceipt(o) {
  if(!(o.stones||[]).length&&!o.gemWeight)return "";
  return "<hr><strong>PIEDRAS DEL TRABAJO</strong>"+(o.gemWeight?row("Peso bruto recibido",weight(o.gemWeight.grossMg))+row("Peso neto del metal",o.gemWeight.status==="confirmed"?weight(o.receivedMg):"Pendiente de confirmar") : "")+
    (o.stones||[]).map(x=>`<p class="receipt-pre"><strong>${E(x.name)}</strong> · ${x.owner==="cliente"?"Del cliente · custodia":"Del taller"}<br>${number(x.quantity)} unidades · ${E(ctLabel(x.caratMilli))}<br>${E(stoneStatuses[x.status])}${x.certificate?"<br>Certificado: "+E(x.certificate):""}${x.condition?"<br>Estado recibido: "+E(x.condition):""}${x.price?"<br>Precio acordado original: "+cop(x.price):""}</p>`).join("");
}
function orderStonesCard(o) {
  const editable=["received","in_progress"].includes(o.status),change=["received","in_progress","quality"].includes(o.status);
  const w=o.gemWeight,weightInfo=w?notice("Peso bruto y metal neto separados",`Peso bruto recibido: ${weight(w.grossMg)}. Metal neto: ${weight(w.netMg)} · ${({pending:"pendiente de pesar",estimated:"estimado, sin ingresar al libro",confirmed:"confirmado e ingresado al libro"})[w.status]}. Las piedras no se contabilizan como oro.`,w.status==="confirmed"?"blue":"amber"):"";
  return card("Piedras de este trabajo","Una línea por piedra individual o grupo con el mismo destino. Los precios de piedras propias se suman una sola vez a Piedras e insumos.",weightInfo+
    `<div class="actions">${o.status==="received"&&o.type!=="Producción propia"?allowed("orders",w?"Revisar peso neto":"Joya con piedras: registrar pesos","gem-weight","","",o.id):""}${o.status==="received"&&o.type!=="Producción propia"?allowed("orders","Recibir piedras del cliente","gem-customer","plus","",o.id):""}${editable?allowed("production","Añadir piedras del taller","gem-own","plus","",o.id):""}</div>`+
    table(["Piedra / propietario","Cantidad / peso","Estado","Precio total incluido",""],(o.stones||[]).map(x=>tr([`<strong>${E(x.name)}</strong><small>${x.owner==="cliente"?"Cliente · en custodia":"Taller · descontada de inventario"}</small>`,number(x.quantity)+"<small>"+E(ctLabel(x.caratMilli))+"</small>",badge(stoneStatuses[x.status],x.status==="lost"?"red":x.status==="held"?"amber":""),x.owner==="cliente"?"No se cobra":cop(["returned","lost"].includes(x.status)?0:x.price),`<div class="actions">${button("Ficha","gem-detail","","small",o.id+"|"+x.id)}${change&&["held","mounted"].includes(x.status)?(x.status==="held"&&o.status!=="received"?allowed("production","Montar","gem-mount","","small",o.id+"|"+x.id):"")+(x.status==="mounted"?allowed("production","Desmontar","gem-unmount","","small",o.id+"|"+x.id):"")+allowed("production",x.owner==="taller"?"Recuperar a inventario":"Devolver al cliente","gem-return","","small",o.id+"|"+x.id)+allowed("adjust","Registrar pérdida","gem-loss","","small danger",o.id+"|"+x.id):""}</div>`])).join(""),"Sin piedras registradas para este trabajo."));
}
function gemDetailHtml(x) {
  return row("Piedra",E(x.name))+row("Cantidad",number(x.quantity))+row("Quilates totales",E(ctLabel(x.caratMilli)))+row("Talla",E(x.cut||"Sin registrar"))+row("Medidas",E(x.measurements||"Sin registrar"))+row("Certificado / código",E(x.certificate||"Sin registrar"))+(x.condition?row("Estado recibido",E(x.condition)):"")+`<p class="receipt-pre">${E(x.notes||"")}</p>`+(x.photo?`<img class="photo-preview" src="${E(x.photo)}" alt="Piedra registrada">`:"")+(x.events||[]).map(e=>`<p class="muted">${dt(e.at)} · ${E(e.actor)} · ${E(stoneStatuses[e.to])}<br>${E(e.note)}</p>`).join("");
}
function gemFields() {
  return `${field("name","Tipo / nombre (esmeralda, rubí…)","text","",'required maxlength="160"')}${field("cut","Talla","text","",'maxlength="100"')}${field("measurements","Medidas (ej. 5 × 4 mm)","text","",'maxlength="100"')}${field("certificate","Certificado o código individual","text","",'maxlength="200"')}<div class="span-2">${text("notes","Observaciones")}${field("gemPhoto","Fotografía de la piedra","file","",'accept="image/*"')}</div>`;
}
async function gemPhoto(form) {
  const file=form.elements.gemPhoto?.files[0];if(!file)return undefined;
  if(!file.type.startsWith("image/")||file.size>20*1024*1024)throw new Error("Selecciona una fotografía de hasta 20 MB.");
  const bitmap=await createImageBitmap(file);
  try {const factor=Math.min(1,1000/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*factor));canvas.height=Math.max(1,Math.round(bitmap.height*factor));canvas.getContext("2d").drawImage(bitmap,0,0,canvas.width,canvas.height);const data=canvas.toDataURL("image/jpeg",.75);if(data.length>=1500000)throw new Error("La fotografía es demasiado grande. Usa una imagen más pequeña.");return data;}finally{bitmap.close();}
}
function newGemModal() {
  modal("Registrar piedras del taller",notice("Entrada de piedras propias","Registra un lote nuevo en cada compra o entrada. El costo es el total del lote; el precio sugerido es por unidad. Este registro no descuenta caja: registra el pago como gasto, si corresponde.","blue")+`<div class="form-grid">${gemFields()}${field("quantity","Cantidad de piedras","number",1,'required min="1" max="1000000" step="1"')}${field("carats","Quilates totales del lote · ct","number","",'required min="0.001" max="1000000" step="0.001"')}${moneyField("cost","Costo total del lote · COP",0)}${moneyField("unitPrice","Precio sugerido por piedra · COP",0)}<label class="check span-2"><input type="checkbox" name="individual">Es una piedra individual identificada (una unidad).</label></div>`,async(b,f,key)=>{delete b.gemPhoto;return mutate("gem.lot",{...b,individual:!!b.individual,photo:await gemPhoto(f)},key);});
}
function gemWeightModal(id) {
  const o=find("orders",id),w=o.gemWeight;
  modal("Peso de la joya y metal neto · "+o.code,notice("No registres el peso de las piedras como oro","El peso bruto incluye piedras y accesorios. Solo el metal neto confirmado entra a custodia. Si aún no puedes medirlo, déjalo pendiente o estimado y confírmalo antes de asignar a mesa.","amber")+`<div class="form-grid">${weightField("grossWeight","Peso bruto de la joya recibida (g)",w?w.grossMg/1000:"")}${weightField("netWeight","Peso neto del metal, sin piedras (g)",w?w.netMg/1000:o.receivedMg/1000,true)}${select("weightStatus","Comprobación del metal neto",[["pending","Pendiente de pesar"],["estimated","Estimado; no entra al libro"],["confirmed","Pesado y confirmado"]],w?.status||"pending")}<div class="span-2">${field("reason","Cómo se verificó / motivo de la corrección","text","",'required maxlength="1000"')}</div></div>`,(b,f,key)=>mutate("gem.weight",{...b,orderId:id},key),"Guardar pesaje");
}
function addGemModal(id,owner) {
  const o=find("orders",id),own=owner==="taller";
  if(!own&&!o.gemWeight)return gemWeightModal(id);
  const lots=(S.gemstoneLots||[]).filter(x=>x.available>0);
  if(own&&!lots.length)return modal("Sin piedras propias disponibles",notice("Registra primero la entrada","Ve a Piedras e insumos y registra el lote con su cantidad, quilates y costo.","amber"));
  modal((own?"Añadir piedras del taller":"Recibir piedras del cliente")+" · "+o.code,notice(own?"Esta salida sí descuenta inventario":"Custodia del cliente",own?"Se descuentan unidades, quilates y costo del lote. El precio total se añade a Piedras e insumos del presupuesto. Para destinos distintos, registra líneas separadas.":"Describe el estado y toma una foto. Estas piedras no son patrimonio ni venta del taller. Los quilates pueden quedar sin determinar.","blue")+`<div class="form-grid">${own?select("stockId","Lote / piedra disponible",lots.map(x=>[x.id,x.code+" · "+x.name+" · "+number(x.available)+" und. · "+ctLabel(x.remainingCaratMilli)]),lots[0]?.id):gemFields()}${field("quantity","Cantidad de piedras","number",1,'required min="1" max="1000000" step="1"')}${field("carats","Quilates totales de esta línea · ct","number","",`${own?"required ":""}min="0.001" max="1000000" step="0.001"`)}${own?moneyField("price","Precio total de estas piedras · COP",0):`<div class="span-2">${field("condition","Estado recibido (fisuras, color, engaste…)","text","",'required maxlength="2000"')}</div><label class="check span-2"><input type="checkbox" name="includedInPiece" checked>Incluidas en el peso bruto de la joya recibida.</label><label class="check span-2"><input type="checkbox" name="mounted" checked>Ya vienen montadas en la pieza.</label>`}</div>`,async(b,f,key)=>{delete b.gemPhoto;return mutate("gem.add",{...b,owner,orderId:id,includedInPiece:!!b.includedInPiece,mounted:!!b.mounted,...(!own?{photo:await gemPhoto(f)}:{})},key);},own?"Descontar y añadir al trabajo":"Registrar en custodia");
  if(own){const f=$("#modal-form"),update=()=>{const lot=lots.find(x=>x.id===f.elements.stockId.value);if(!lot)return;setNumericValue(f.elements.quantity,1);setNumericValue(f.elements.carats,lot.available===1?lot.remainingCaratMilli/1000:"");setNumericValue(f.elements.price,lot.unitPrice);};f.elements.stockId.addEventListener("change",update);update();}
}
function stoneActionModal(action,key) {
  const [orderId,id]=key.split("|"),o=find("orders",orderId),x=o.stones.find(v=>v.id===id),returning=action==="return",loss=action==="loss",unmount=action==="unmount";
  modal((returning?"Confirmar devolución / recuperación":loss?"Documentar pérdida de piedras":unmount?"Confirmar desmontaje":"Confirmar montaje")+" · "+x.name,
    notice(returning?"Comprueba físicamente las piedras":loss?"La pérdida no regresa existencias":unmount?"La piedra sigue en custodia del trabajo":"Comprueba el engaste",returning?"Confirma que recuperaste todas las unidades de esta línea, incluso si estaban montadas. Las propias vuelven a bodega y se retira su precio del presupuesto; las del cliente se entregan a su propietario.":loss?"Se conserva el costo real perdido. Se retira su precio de venta. Devuelve antes cualquier exceso de anticipo y registra el soporte del incidente.":unmount?"Confirma que retiraste la piedra de la pieza. Sigue vinculada al trabajo; no regresa a inventario hasta recuperarla físicamente.":"Verifica cantidad, estado y firmeza. La piedra permanece vinculada a esta pieza hasta su entrega.","amber")+field("reason",returning?"Motivo y responsable de recibir las piedras":loss?"Incidente y soporte":"Verificación del montaje","text","",'required maxlength="1000"')+(returning||loss?'<label class="check"><input name="confirmed" type="checkbox" required>Confirmo la comprobación física y el registro descrito.</label>':""),(b,f,k)=>mutate("gem."+action,{...b,orderId,id,confirmed:!!b.confirmed},k));
}
function materialsPage() {
  return (
    head(
      "LOS DETALLES QUE COMPLETAN LA PIEZA",
      "Piedras e insumos",
      "Existencias de gemas, rodio, herramientas y otros materiales.",
      allowed(
        "inventory",
        "Registrar insumo",
        "new-material",
        "plus",
        "primary",
      ),
    ) +
    stoneInventory() +
    `<section class="card table-card"><div class="card-head"><div><h2>Inventario de insumos</h2><p>El metal precioso se controla en el Libro de metales.</p></div></div>${table(["Insumo", "Existencia", "Mínimo", "Costo unitario", "Estado", ""], S.materials.map((x) => tr([`<strong>${E(x.name)}</strong>`, E(quantity(x.quantity) + " " + x.unit), E(quantity(x.min) + " " + x.unit), cop(x.unitCost), badge(x.quantity <= x.min ? "Existencia baja" : "Disponible", x.quantity <= x.min ? "amber" : ""), allowed("inventory", "Registrar entrada", "restock-material", "plus", "small", x.id)])).join(""), "Crea los materiales que utilizas; luego descuéntalos desde la orden de trabajo.")}</section><section class="card table-card section-gap"><div class="card-head"><h2>Movimientos de insumos</h2></div>${table(
      ["Fecha", "Insumo", "Cantidad", "Referencia", "Responsable", "Estado / acción"],
      [...S.materialMoves.filter(x=>!x.deletedAt)]
        .reverse()
        .slice(0, 300)
        .map((x) =>
          tr([
            dt(x.at),
            E(find("materials", x.materialId)?.name),
            E(
              quantity(x.quantity) +
                " " +
                (find("materials", x.materialId)?.unit || ""),
            ),
            E(measurementNote(x.note)),
            E(x.actor),
            x.reversedAt ? reversalBadge(x) : !x.reversalId ? reversalButton("material",x.id) : "",
          ]),
        )
        .join(""),
    )}</section>`
  );
}
function stockPage() {
  return (
    head(
      "PIEZAS QUE SALEN DE TU TALLER",
      "Inventario de piezas terminadas",
      "Producción propia recibida y transferencias con soporte exportable.",
    ) +
    notice(
      "Entrega a la joyería minorista",
      "Cada transferencia descuenta las piezas y el metal de este taller. Descarga el soporte Excel para ingresarlo en el sistema receptor.",
      "blue",
    ) +
    `<section class="card table-card"><div class="card-head"><h2>Existencias de piezas</h2></div>${table(["Código / pieza", "Origen", "Unidades", "Peso disponible", "Costo total lote", "Precio sugerido unit.", ""], S.stock.filter(x=>!x.deletedAt).map((x) => tr([`<strong>${E(x.sku)}</strong><small>${E(x.description)}</small>`, E(find("orders", x.orderId)?.code), number(x.available) + " / " + number(x.quantity), weight(x.remainingMg ?? x.mg) + (x.components ? x.components.map(item=>`<small>${E(item.metal)} · ley ${number(item.purity)} · ${weight(item.remainingMg)}</small>`).join("") : ""), cop(x.cost), cop(x.price), x.reversedAt ? reversalBadge(x) : (x.available ? allowed("inventory", "Transferir", "transfer-stock", "arrow", "small", x.id) : badge("Transferida", "gray")) + reversalButton("stockReceive",x.id)])).join(""), "Para ingresar piezas, crea una orden de producción propia y completa su control de calidad.")}</section><section class="card table-card section-gap"><div class="card-head"><h2>Transferencias registradas</h2></div>${table(
      ["Referencia", "Fecha", "Pieza", "Unidades", "Peso", "Destino", ""],
      S.stock
        .flatMap((x) =>
          x.transfers.filter(t=>!t.deletedAt).map((t) =>
            tr([
              E(t.code),
              dt(t.at),
              E(x.sku),
              t.quantity,
              weight(t.mg) + (t.components ? t.components.map(item=>`<small>${E(item.metal)} · ley ${number(item.purity)} · ${weight(item.mg)}</small>`).join("") : ""),
              E(t.destination),
              button("Excel", "export-transfer", "download", "small", t.id) + (t.reversedAt ? reversalBadge(t) : reversalButton("stockTransfer",t.id)),
            ]),
          ),
        )
        .reverse()
        .join(""),
    )}</section>`
  );
}
function reportsPage() {
  const from = filters.reportFrom || today().slice(0, 7) + "-01",
    to = filters.reportTo || today(),
    inRange = (d) => d && dayKey(d) >= from && dayKey(d) <= to,
    sales = S.orders.filter((o) => o.invoice && inRange(o.deliveredAt)),
    liquidations = S.orders.filter((o) => o.returned && inRange(o.returned.at)),
    gross = sales.reduce((v, o) => v + total(o), 0),
    tax = sales.reduce((v, o) => v + o.tax, 0),
    cost = sales.reduce((v, o) => v + estimatedCost(o), 0),
    expenses = (S.expenses||[]).filter(x=>!x.reversedAt&&x.expenseDate>=from&&x.expenseDate<=to),
    expenseTotal = expenses.reduce((v,x)=>v+x.amount,0),
    unclassified = expenseRows().filter(x=>x.legacy&&!x.reversedAt&&x.expenseDate>=from&&x.expenseDate<=to).reduce((v,x)=>v+x.amount,0);
  return (
    head(
      "DECISIONES CON FUNDAMENTO",
      "Reportes y auditoría",
      "Resultados de las órdenes entregadas y trazabilidad de los registros.",
      button("Ventas Excel", "export-sales", "download") +
        button("Auditoría Excel", "export-audit", "download"),
    ) +
    `<div class="filters report-filters card">${field("reportFrom", "Desde", "date", from, 'data-filter="reportFrom"')}${field("reportTo", "Hasta", "date", to, 'data-filter="reportTo"')}</div><div class="kpis">${kpi("Ventas entregadas", cop(gross), sales.length + " comprobantes comerciales", "chart", true)}${kpi("Impuestos registrados", cop(tax), "Según presupuesto de cada orden", "file")}${kpi("Costo operativo estimado", cop(cost), "Tarifa histórica + insumos + orfebre", "gold")}${kpi("Margen estimado", cop(gross - tax - cost), "Antes de gastos generales", "chart")}${kpi("Gastos del taller", cop(expenseTotal), "Clasificados · sin reversados", "cash")}${kpi("Resultado después de gastos", cop(gross - tax - cost - expenseTotal), "Estimado del período", "chart")}</div><div class="section-gap">${notice("Cómo se estima el costo", "Metal propio consumido (incluida su merma) a la tarifa guardada al recibir la orden, más insumos y honorarios. No equivale a contabilidad fiscal ni incluye todos los gastos del negocio.", "blue")}</div>${unclassified ? `<div class="section-gap">${notice("Salidas de caja pendientes de clasificar", "Hay " + cop(unclassified) + " en salidas anteriores sin clasificar. Revisa Gastos del taller; todavía no se restan del resultado después de gastos.", "amber")}</div>` : ""}<section class="card table-card"><div class="card-head"><h2>Rendimiento de orfebres en el período</h2></div>${table(
      [
        "Orfebre",
        "Órdenes liquidadas",
        "Entregado",
        "Piezas",
        "Limalla",
        "Merma",
        "Merma %",
      ],
      S.smiths
        .map((x) => {
          const list = liquidations.filter((o) => o.smithId === x.id),
            assigned = list.reduce(
              (v, o) => v + o.allocations.reduce((a, x) => a + x.mg, 0),
              0,
            ),
            lost = list.reduce((v, o) => v + o.returned.lossMg, 0);
          return tr([
            E(x.name),
            list.length,
            weight(assigned),
            weight(list.reduce((v, o) => v + o.returned.pieceMg, 0)),
            weight(list.reduce((v, o) => v + o.returned.scrapMg, 0)),
            weight(lost),
            assigned ? number((lost * 100) / assigned) + " %" : "—",
          ]);
        })
        .join(""),
    )}</section><section class="card table-card section-gap"><div class="card-head"><h2>Ventas del período</h2></div>${table(["Comprobante", "Fecha", "Orden", "Cliente", "Base", "Impuesto", "Total", "Costo estimado"], sales.map((o) => tr([E(o.invoice), dt(o.deliveredAt), E(o.code), E(client(o)), cop(total(o) - o.tax), cop(o.tax), cop(total(o)), cop(estimatedCost(o))])).join(""))}</section><section class="card table-card section-gap"><div class="card-head"><div><h2>Registro de auditoría</h2><p>Vista de los últimos 2.000 eventos. Excel exporta todo el período seleccionado.</p></div></div>${table(
      ["Fecha", "Responsable", "Acción", "Referencia", ""],
      AUDIT.filter((x) => inRange(x.at))
        .slice(0, 300)
        .map((x) => {
          let d = {};
          try {
            d = JSON.parse(x.details);
          } catch {}
          return tr([
            dt(x.at),
            E(x.actor),
            E(actionLabel(x.action)),
            E(d.reference || "—"),
            button("Detalle", "audit-detail", "", "small", x.id),
          ]);
        })
        .join(""),
    )}</section>`
  );
}
function estimatedCost(o) {
  return (
    PM.cost(o) +
    o.materialUsage.filter(x=>!x.reversedAt).reduce((v, x) => v + x.cost, 0) +
    (o.stones||[]).filter(x=>x.owner==="taller"&&x.status!=="returned").reduce((sum,x)=>sum+x.cost,0) +
    o.smithFee
  );
}
function usersPage() {
  return (
    head(
      "UN ACCESO PARA CADA RESPONSABILIDAD",
      "Usuarios y permisos",
      "Todos los usuarios pueden consultar la operación; los roles limitan quién puede modificarla.",
      button("Crear usuario", "new-user", "plus", "primary"),
    ) +
    `<section class="card table-card">${table(["Nombre", "Usuario", "Rol", "Estado", ""], USERS.map((x) => tr([`<strong>${E(x.name)}</strong>`, E(x.username), E(roleNames[x.role]), badge(x.active ? "Activo" : "Desactivado", x.active ? "" : "gray"), button("Editar acceso", "edit-user", "", "small", x.id)])).join(""))}</section><section class="card section-gap"><div class="card-head"><h2>Permisos por rol</h2></div>${table(
      ["Rol", "Puede modificar"],
      [
        [
          "Administrador",
          "Toda la operación, usuarios, tarifas, restauración y ajustes.",
        ],
        [
          "Recepción y caja",
          "Clientes, órdenes, cobros y turnos sin diferencias.",
        ],
        [
          "Producción y bodega",
          "Orfebres, asignaciones, avances, insumos, retornos y fundiciones.",
        ],
        ["Contabilidad", "Compras, proveedores, pagos, caja y reportes."],
        ["Solo consulta", "Lectura de la operación. No modifica registros."],
      ]
        .map((x) => tr(x.map(E)))
        .join(""),
    )}<p class="muted section-gap" style="font-size:11px">Los retornos con merma crítica, las diferencias de caja y los ajustes de existencias requieren un administrador.</p></section>`
  );
}
const reversalTypes = [
  ["gemLot","Entrada de piedras propias"],
  ["expense","Gasto del taller"],
  ["purchase","Compra de metal"],["supplierPayment","Pago a proveedor"],
  ["sale","Entrega / venta al cliente"],["payment","Cobro o devolución al cliente"],
  ["order","Orden de trabajo completa"],["cash","Ingreso / gasto manual de caja"],
  ["ledger","Traslado / ajuste de metal"],["material","Entrada / consumo de insumos"],
  ["stockTransfer","Transferencia de piezas"],["stockReceive","Ingreso de piezas terminadas"],
  ["settlement","Pago al orfebre"],
  ["assignment","Asignación a mesa sin actividad posterior"],["quality","Aprobación de calidad"],
];
const reversalButton = (type,id) => allowed("adjust","Reversar","reverse-operation","refresh","small danger",type+"|"+id);
const reversalBadge = (x) => x.reversedAt ? badge("Reversada", "red") : "";
function reversalCandidates(type) {
  let rows=[];
  if(type==="gemLot")rows=(S.gemstoneLots||[]).filter(x=>!x.reversedAt).map(x=>[x.id,x.code+" · "+x.name+" · "+number(x.available)+" und."]);
  if(type==="purchase")rows=S.purchases.filter(x=>!x.reversedAt).map(x=>[x.id,x.code+" · "+x.document+" · "+cop(x.total)]);
  if(type==="expense")rows=(S.expenses||[]).filter(x=>!x.reversedAt).map(x=>[x.id,x.code+" · "+x.concept+" · "+cop(x.amount)]);
  if(type==="supplierPayment")rows=S.supplierPayments.filter(x=>!x.reversedAt).map(x=>[x.id,(find("purchases",x.purchaseId)?.code||"")+" · "+cop(x.amount)+" · "+x.reference]);
  if(type==="sale")rows=S.orders.filter(x=>x.status==="delivered"&&x.invoice&&x.type!=="Producción propia").map(x=>[x.id,x.invoice+" · "+x.code+" · "+client(x)]);
  if(type==="payment")rows=S.payments.filter(x=>!x.voidedAt&&!x.reversedAt).map(x=>[x.id,x.code+" · "+cop(x.applied)+" · "+(find("orders",x.orderId)?.code||"")]);
  if(type==="order")rows=S.orders.filter(x=>x.status!=="cancelled").map(x=>[x.id,x.code+" · "+statusNames[x.status]+" · "+x.description]);
  if(type==="cash")rows=S.cashEntries.filter(x=>x.ref==="CAJA"&&!x.expenseId&&!x.reversedAt).map(x=>[x.id,dt(x.at)+" · "+x.note+" · "+cop(x.amount)]);
  if(type==="ledger")rows=S.ledger.filter(x=>["TRASLADO","CONCILIACIÓN"].includes(x.ref)&&!x.reversedAt).map(x=>[x.id,dt(x.at)+" · "+x.ref+" · "+x.metal+" · "+weight(x.mg)]);
  if(type==="material")rows=S.materialMoves.filter(x=>!x.reversedAt&&!x.reversalId).map(x=>[x.id,dt(x.at)+" · "+(find("materials",x.materialId)?.name||"")+" · "+quantity(x.quantity)+" · "+x.note]);
  if(type==="stockTransfer")rows=S.stock.flatMap(x=>x.transfers.filter(t=>!t.reversedAt).map(t=>[t.id,t.code+" · "+x.sku+" · "+t.destination]));
  if(type==="stockReceive")rows=S.stock.filter(x=>!x.reversedAt).map(x=>[x.id,x.sku+" · "+x.description]);
  if(type==="settlement")rows=S.settlements.filter(x=>!x.reversedAt).map(x=>[x.id,(find("smiths",x.smithId)?.name||"")+" · "+cop(x.amount)+" · "+x.reference]);
  if(type==="assignment")rows=S.orders.filter(x=>x.status==="in_progress").map(x=>[x.id,x.code+" · "+x.description]);
  if(type==="quality")rows=S.orders.filter(x=>x.status==="ready").map(x=>[x.id,x.code+" · "+x.description]);
  return rows.reverse().filter(([id])=>!operationSource(type,id)?.deletedAt);
}
function operationSource(type,id) {
  if(type==="stockTransfer")return S.stock.flatMap(x=>x.transfers).find(x=>x.id===id);
  const collection={gemLot:"gemstoneLots",expense:"expenses",purchase:"purchases",supplierPayment:"supplierPayments",payment:"payments",order:"orders",sale:"orders",assignment:"orders",quality:"orders",cash:"cashEntries",ledger:"ledger",material:"materialMoves",stockReceive:"stock",settlement:"settlements"}[type];
  return S[collection]?.find(x=>x.id===id);
}
function deletionCandidates(type) {
  return [...reversalCandidates(type),...[...(S.reversals||[])].reverse().filter(r=>r.type===type&&!r.deletedAt&&!operationSource(type,r.targetId)?.deletedAt).map(r=>["history:"+r.id,reversalReference(r)+" · ya reversada · "+dt(r.at)])];
}
function reversalsPage() {
  return head("CORREGIR CON TRAZABILIDAD","Reversiones","Revisa la operación, su efecto y el soporte antes de confirmar.",button("Reversar operación","reverse-operation","refresh","primary")+button("Eliminar operación","delete-operation","","danger-solid"))+
    notice("Se conserva el movimiento original","Las reversiones registran movimientos contrarios. Los cierres de caja anteriores no se reabren; las devoluciones en efectivo se registran en el turno abierto.","blue")+
    notice("Para retirar un trabajo completo","Elige «Orden de trabajo completa». Incluye trabajos recibidos, en mesa, en calidad, listos o entregados. Revisa los pesos y el saldo a devolver antes de confirmar; la orden saldrá del listado y conservará su historial.","blue")+
    `<div class="grid two section-gap">${card("Compras y pagos","",'<p>Primero revierte los pagos de una compra y después la compra, si el metal sigue disponible. En pagos bancarios registra el soporte real de la devolución.</p>')}${card("Ventas y devoluciones","",'<p>Reversar una entrega devuelve la pieza y los sobrantes registrados y reabre la orden. Los cobros se conservan: revierte o devuelve los pagos por separado.</p>')}</div>`+
    `<div class="section-gap">${notice("Operaciones que requieren revisión","Una fundición, una merma física, la producción ya terminada y los cierres de caja no se deshacen automáticamente. El sistema bloquea reversiones sin existencias, duplicadas o con operaciones dependientes.","amber")}</div>`+
    card("Historial de reversiones","Se conserva también en las copias de seguridad y la auditoría.",table(["Fecha / responsable","Operación","Resultado","Motivo / soporte",""],[...(S.reversals||[])].filter(x=>!x.deletedAt).reverse().map(x=>tr([dt(x.at)+"<small>"+E(x.actor)+"</small>",E(reversalTypes.find(t=>t[0]===x.type)?.[1]||x.type)+"<small>"+E(reversalReference(x))+"</small>",E(x.summary),E(x.reason)+"<small>"+E(x.reference)+"</small>",button("Eliminar","delete-operation","","small danger",x.type+"|history:"+x.id)])).join("")));
}
function reversalReference(r) {
  const collections={gemLot:"gemstoneLots",expense:"expenses",purchase:"purchases",supplierPayment:"supplierPayments",sale:"orders",payment:"payments",order:"orders",assignment:"orders",quality:"orders",cash:"cashEntries",ledger:"ledger",material:"materialMoves",stockReceive:"stock",settlement:"settlements"};
  if(r.type==="stockTransfer")return S.stock.flatMap(x=>x.transfers).find(x=>x.id===r.targetId)?.code||r.targetId;
  const source=S[collections[r.type]]?.find(x=>x.id===r.targetId);
  return r.original?.invoice||source?.code||source?.sku||source?.reference||source?.note||r.targetId;
}
function reverseOperationModal(type="purchase",targetId="",mode="reverse") {
  const deleting=mode==="delete",candidates=deleting?deletionCandidates:reversalCandidates,rows=candidates(type);
  let prepared=null;
  modal(deleting?"Eliminar operación":"Revisar reversión",notice("Verifica la devolución real","Esta pantalla registra la corrección; no mueve dinero en tu banco ni devuelve físicamente una pieza. Confirma solo después de comprobar lo sucedido.","amber")+
    `<div class="form-grid section-gap">${select("type","Tipo de operación",reversalTypes,type)}${select("id","Registro original",rows.length?rows:[["","No hay registros disponibles"]],targetId||rows[0]?.[0]||"")}<div id="reverse-metal-source" class="span-2">${select("metalSource","Origen del metal a devolver al cliente",[["payment","Metal recibido como pago en caja"],["own","Metal propio en bodega"]],"payment")}</div><div class="span-2">${field("reason","Motivo de la reversión","text","",'required maxlength="1000"')}</div><div class="span-2">${field("reference","Soporte de devolución (obligatorio para banco)","text","",'maxlength="200"')}</div><label class="check span-2"><input type="checkbox" name="confirmed" required>He verificado el registro y la devolución de dinero, piezas o material, o que se trata de un registro erróneo sin movimiento físico.</label><div id="reversal-preview" class="span-2"></div></div>`,async(b,form,key)=>{
      const historical=deleting&&b.id.startsWith("history:")?(S.reversals||[]).find(x=>x.id===b.id.slice(8)):null;
      if(deleting&&b.id.startsWith("history:")&&!historical)throw new Error("El registro cambió. Actualiza la selección.");
      const order=b.type==="order"&&!historical?find("orders",b.id):null;
      const payload={...b,mode,confirmed:true,...(historical?{id:historical.targetId,reversalId:historical.id}:{}),...(order?.status==="in_progress"&&!order.returned?{metalReturns:PM.groups(order).map((g,i)=>({metal:g.metal,purity:g.purity,pieceWeight:b["reversePiece-"+i],scrapWeight:b["reverseScrap-"+i]}))}:{})},signature=JSON.stringify(payload);
      if(!prepared||prepared.signature!==signature) {
        const preview=await api("/api/reversal-preview",{method:"POST",body:JSON.stringify(payload)});
        prepared={signature,preview};
        $("#reversal-preview",form).innerHTML=card("Efecto de la reversión","Todavía no se ha guardado.",`<p>${E(preview.summary)}</p>${row("Cambio de efectivo en el turno abierto",cop(preview.cashDelta))}${preview.bankDelta ? row("Movimiento bancario respaldado",cop(preview.bankDelta)) : ""}${preview.movements.map(x=>row((ACC[x.from]||x.from)+" → "+(ACC[x.to]||x.to),weight(x.mg)+" · "+E(x.metal)+" · ley "+number(x.purity))).join("")}${preview.materials.map(x=>row("Existencia resultante: "+x.name,quantity(x.quantity)+" "+E(x.unit))).join("")}${preview.stock.map(x=>row("Unidades disponibles: "+x.sku,number(x.available))).join("")}${(preview.gems||[]).map(x=>row("Piedras en bodega: "+x.name,number(x.available)+" und. · "+number(x.carats,3)+" ct · "+cop(x.cost))).join("")}${(preview.stones||[]).map(x=>row(x.order+" · "+x.name,E(stoneStatuses[x.status]))).join("")}`);
        $('button[type="submit"]',form).textContent=deleting?"Confirmar eliminación":"Confirmar reversión";
        return false;
      }
      try {return await mutate(deleting?"operation.delete":"operation.reverse",payload,key,prepared.preview.revision);}
      catch(e){prepared=null;$("#reversal-preview",form).replaceChildren();$('button[type="submit"]',form).textContent=deleting?"Revisar eliminación":"Revisar reversión";throw e;}
    },deleting?"Revisar eliminación":"Revisar reversión");
  const form=$("#modal-form");
  if(deleting){
    $('button[type="submit"]',form).classList.remove("primary");$('button[type="submit"]',form).classList.add("danger-solid");
    $("[name=confirmed]",form).closest("label").insertAdjacentHTML("beforebegin",notice("Eliminar retira el registro de los listados","Primero se compensa la operación si aún está vigente. Una operación ya reversada no mueve dinero ni metal otra vez. La evidencia se conserva en auditoría y copias de seguridad.","red")+field("confirmation","Escribe ELIMINAR para continuar","text","",'required pattern="ELIMINAR" autocomplete="off"'));
  }
  $("[name=confirmed]",form).closest("label").insertAdjacentHTML("beforebegin",'<div id="reverse-order-options" class="span-2"></div>');
  function updateSource(){
    const payment=S.payments.find(x=>x.id===form.elements.id.value);
    $("#reverse-metal-source",form).hidden=form.elements.type.value!=="payment"||!payment?.goldMg;
    const panel=$("#reverse-order-options",form),order=form.elements.type.value==="order"?find("orders",form.elements.id.value):null;
    panel.hidden=!order;
    if(order&&panel.dataset.orderId!==order.id){
      panel.dataset.orderId=order.id;
      panel.innerHTML=notice("Reversión completa de "+order.code,"La orden se retira de trabajos. Devuelve la pieza y los sobrantes del cliente; recupera en bodega el metal propio de la pieza. Las mermas, insumos consumidos y honorarios reales no se borran.","amber")+
        (paid(order)>0?`<div class="form-grid section-gap">${select("refundMethod","Devolver saldo abonado: "+cop(paid(order)),[["cash","Efectivo del turno abierto"],["bank","Banco / transferencia en COP"]],"cash")}</div><p class="muted">La devolución es en pesos, incluso si el abono original incluía metal. Banco exige soporte. Debe existir un turno de caja abierto.</p>`:notice("Sin saldo abonado pendiente","No se generará una segunda devolución.","blue"))+
        (order.status==="in_progress"&&!order.returned?PM.groups(order).map((g,i)=>`<section class="card section-gap"><h3>${E(g.metal)} · ley ${number(g.purity)}</h3><p>Entregado a mesa: ${weight(g.mg)}. Registra los pesos reales que regresan.</p><div class="form-grid">${weightField("reversePiece-"+i,"Metal devuelto en pieza / sin trabajar (g)","",true)}${weightField("reverseScrap-"+i,"Limalla devuelta (g)",0,true)}</div></section>`).join(""):"");
    }
    $$("input,select",panel).forEach(input=>{input.disabled=!order;});
  }
  updateSource();
  form.addEventListener("change",e=>{
    if(e.target.name==="type"){
      const options=candidates(form.elements.type.value);
      form.elements.id.innerHTML=(options.length?options:[["","No hay registros disponibles"]]).map(x=>option(x[0],x[1],options[0]?.[0])).join("");
    }
    updateSource();
  });
  form.addEventListener("input",()=>{
    prepared=null;$("#reversal-preview",form).replaceChildren();
    $('button[type="submit"]',form).textContent=deleting?"Revisar eliminación":"Revisar reversión";
  });
}
function categoriesPage() {
  return head("EL ORO DE TU TALLER", "Categorías de oro", "Define los tipos de oro y su ley en milésimas para usarlos en las operaciones del taller.", button("Nueva categoría", "new-category", "plus", "primary")) +
    card("Catálogo de oro", "La ley determina el contenido de oro fino. Editar o eliminar una categoría conserva las leyes de los movimientos ya registrados.", table(["Categoría", "Ley (milésimas)", "Estado", ""], goldCategories().map((x) => tr([E(x.name), number(x.purity), badge(x.active ? "Activa" : "Inactiva", x.active ? "green" : "amber"), `<div class="actions">${button("Editar", "edit-category", "edit", "small", x.id)}${button("Eliminar", "delete-category", "", "small danger", x.id)}</div>`])).join("")));
}
function categoryModal(id) {
  const x = goldCategories().find((x) => x.id === id) || {};
  simpleModal(id ? "Editar categoría de oro" : "Nueva categoría de oro", "category.save",
    `<div class="form-grid"><div class="span-2">${field("name", "Nombre de la categoría", "text", x.name || "", 'required maxlength="80" placeholder="Ej. Oro 16k"')}</div>${field("purity", "Ley en milésimas", "number", x.purity ?? 750, 'min="1" max="1000" step="1" required')}${select("active", "Estado", [["true", "Activa"], ["false", "Inactiva"]], String(x.active ?? true))}<p class="muted span-2">Ejemplos: oro 18k = 750; oro 14k = 585. Usa la ley ensayada de tu material. Las categorías inactivas dejan de aparecer en los formularios.</p></div>`, id ? {id} : {});
}
function syncMetalFields(form) {
  if (!form?.elements.metal) return;
  const isGold = form.elements.metal.value === "oro";
  $$("[data-gold-category]", form).forEach((el) => {
    el.closest(".field").hidden = !isGold;
    el.disabled = !isGold;
  });
}
function settingsPage() {
  const x = S.settings;
  return (
    head(
      "A LA MEDIDA DE TU TALLER",
      "Configuración",
      "Datos del negocio, tarifas de metales, tolerancias y respaldo.",
    ) +
    formWrap(
      "settings-form",
      `<div class="grid two">${card(
        "Identidad del taller",
        "Se imprime en cada comprobante.",
        `<div class="form-grid"><div class="span-2">${field("name", "Nombre comercial", "text", x.name, 'required maxlength="160"')}</div>${field("nit", "NIT / documento", "text", x.nit, 'maxlength="60"')}${field("phone", "Teléfono", "text", x.phone, 'maxlength="50"')}<div class="span-2">${field("address", "Dirección", "text", x.address, 'maxlength="250"')}</div><div class="span-2">${text("warranty", "Condiciones de custodia / garantía", x.warranty)}</div>${select(
          "printWidth",
          "Ancho de papel (mm)",
          [
            [80, number(80) + " mm"],
            [58, number(58) + " mm"],
          ],
          x.printWidth,
        )}${field("taxPercent", "Impuesto por defecto (%)", "number", x.taxPercent, 'min="0" max="100" step="0.01" required')}</div>`,
      )}${card("Tarifas y control de peso", "Tarifa comercial de compra por gramo fino de cada metal.", `<div class="form-grid">${moneyField("goldRate", "Oro · COP / g fino", x.rate.oro)}${moneyField("silverRate", "Plata · COP / g fino", x.rate.plata)}${moneyField("platinumRate", "Platino · COP / g fino", x.rate.platino)}${weightField("tolerance", "Tolerancia de conteo (g)", x.toleranceMg / 1000, true)}${field("lossNormal", "Merma normal hasta (%)", "number", x.lossNormal, 'min="0" max="100" step="0.01" required')}${field("lossWarning", "Merma crítica por encima de (%)", "number", x.lossWarning, 'min="0" max="100" step="0.01" required')}<div class="span-2">${field("reason", "Motivo de actualización", "text", "", 'required maxlength="1000"')}</div></div><p class="muted section-gap" style="font-size:11px;line-height:1.8">Las tarifas nuevas se aplican a los cobros futuros. Los comprobantes conservan la tarifa aplicada en su momento.</p>`)}</div><input type="hidden" name="baudRate" value="${x.baudRate}">`,
      "Guardar configuración",
    ) +
    `<div class="grid two section-gap">${card(
      "Balanza e impresión",
      "Captura manual o puerto serial del navegador.",
      `<p class="muted" style="font-size:12px;line-height:1.8">Usa Chrome o Edge en localhost o HTTPS. La balanza debe enviar lecturas de texto en gramos por un puerto serial. Las órdenes se pueden pesar manualmente si el equipo no es compatible.</p><div class="summary-row"><span>Estado real</span><strong class="scale-status">${scaleStatus()}</strong></div><div class="actions section-gap">${button("Conectar balanza", "connect-scale", "gold")}${serialPort ? button("Desconectar", "disconnect-scale") : ""}${button("Probar impresión", "test-print", "print")}</div><div class="section-gap">${select(
        "serialBaud",
        "Velocidad del puerto",
        [
          [1200, "1200"],
          [2400, "2400"],
          [4800, "4800"],
          [9600, "9600"],
          [19200, "19200"],
          [38400, "38400"],
          [115200, "115200"],
        ],
        x.baudRate,
      )}</div>`,
    )}${card("Copias de seguridad", "Protege los datos del taller.", `<p class="muted" style="font-size:12px;line-height:1.8">${cloudMode ? "Se conserva una copia diaria en la base persistente de nube. Descarga también una copia al terminar la jornada y guárdala en otro lugar." : "Se crea una copia automática al iniciar y antes del primer cambio de cada día en data/backups. Descarga una copia después de la jornada y guárdala también fuera de este computador."}</p><div class="actions section-gap">${button("Descargar copia", "download-backup", "download", "primary")}${button("Restaurar copia", "restore-backup", "refresh")}</div><p class="muted section-gap" style="font-size:10px;line-height:1.8">${cloudMode ? "Las copias JSON contienen la operación y auditoría. Los accesos permanecen en la base de nube; una restauración mantiene los usuarios actuales." : "Las copias JSON contienen la operación y auditoría. Conserva la carpeta data completa para recuperar también usuarios y contraseñas. Una restauración de operación mantiene los accesos actuales."}</p>`)}</div>`
  );
}
function assistantPage() {
  const a = alerts(),
    liquidated = S.orders
      .filter((o) => o.returned)
      .sort((a, b) => b.returned.percent - a.returned.percent),
    late = S.orders.filter((o) => active(o) && o.dueDate < today());
  return (
    head(
      "UNA PAUSA PARA MIRAR EL TALLER",
      "Análisis operativo",
      "Lectura automática de tus registros actuales, disponible sin servicios externos.",
    ) +
    notice(
      "Análisis local",
      "Estos indicadores se calculan a partir de tus datos. No se envía información del taller a proveedores de inteligencia artificial.",
      "blue",
    ) +
    card(
      "Lo que muestran tus registros",
      "Actualizado al consultar esta vista.",
      `<div class="analysis-line"><strong>${number(late.length)} órdenes con fecha vencida</strong>${late.length ? late.map((o) => `${E(o.code)} · ${E(client(o))} · ${E(statusNames[o.status])}`).join("<br>") : "No hay entregas vencidas."}</div><div class="analysis-line"><strong>Metal inmovilizado en mesas</strong>${
        S.orders
          .filter((o) => o.status === "in_progress")
          .map(
            (o) =>
              `${E(o.code)} · ${E(smith(o))} · ${PM.groups(o).map(g=>weight(g.mg)+" de "+E(g.metal)+" · ley "+number(g.purity)).join("; ")}`,
          )
          .join("<br>") || "No hay órdenes en mesa."
      }</div><div class="analysis-line"><strong>Mayor merma registrada</strong>${liquidated.length ? `${E(liquidated[0].code)} · ${E(smith(liquidated[0]))} · ${number(liquidated[0].returned.percent)} %` : "Registra retornos de piezas para analizar las mermas."}</div><div class="analysis-line"><strong>${number(a.length)} alertas de operación</strong>${a.map((x) => E(x.title)).join("<br>") || "La operación está al día."}</div>`,
    )
  );
}
function actionLabel(a) {
  const labels = {
    "expense.create":"Gasto registrado",
    "expense.classify":"Gasto clasificado sin nueva salida",
    "operation.reverse": "Operación reversada",
    "operation.delete": "Operación eliminada",
    "category.delete": "Categoría eliminada",
    "category.save": "Categoría guardada",
    "client.save": "Cliente guardado",
    "order.create": "Orden recibida",
    "gem.lot": "Entrada de piedras propias",
    "gem.add": "Piedras registradas en el trabajo",
    "gem.weight": "Peso bruto y metal neto verificados",
    "gem.mount": "Piedras montadas en la pieza",
    "gem.unmount": "Piedras desmontadas de la pieza",
    "gem.return": "Piedras recuperadas y devueltas físicamente",
    "gem.loss": "Incidente de pérdida de piedras",
    "order.assign": "Asignación a mesa",
    "order.return": "Retorno y merma",
    "order.deliver": "Entrega de pieza",
    "payment.create": "Cobro registrado",
    "payment.void": "Cobro anulado",
    "shift.open": "Apertura de caja",
    "shift.close": "Cierre de caja",
    "settings.save": "Configuración actualizada",
    "inventory.adjust": "Conciliación de metal",
    "purchase.create": "Compra de metal",
    "backup.restore": "Copia restaurada",
  };
  return labels[a] || a;
}

function simpleModal(title, action, html, fixed = {}, submit = "Guardar") {
  modal(
    title,
    html,
    (b, f, key) => mutate(action, { ...fixed, ...b }, key),
    submit,
  );
}
function clientModal(id) {
  const c = id ? find("clients", id) : {};
  simpleModal(
    id ? "Editar cliente" : "Nuevo cliente",
    "client.save",
    `<div class="form-grid"><div class="span-2">${field("name", "Nombre completo", "text", c.name, 'required maxlength="120"')}</div>${field("document", "Documento", "text", c.document, 'maxlength="50"')}${field("phone", "Teléfono con indicativo de país", "tel", c.phone, 'maxlength="40" placeholder="573101234567"')}<div class="span-2">${field("email", "Correo electrónico", "email", c.email, 'maxlength="120"')}</div><div class="span-2">${text("notes", "Notas del cliente", c.notes)}</div></div>`,
    id ? { id } : {},
  );
}
function smithModal(id) {
  const x = id ? find("smiths", id) : {};
  simpleModal(
    id ? "Editar orfebre" : "Registrar orfebre",
    "smith.save",
    `<div class="form-grid">${field("name", "Nombre del orfebre", "text", x.name, 'required maxlength="120"')}${field("bench", "Banco / especialidad", "text", x.bench, 'maxlength="160"')}</div>`,
    id ? { id } : {},
  );
}
function supplierModal(id) {
  const x = id ? find("suppliers", id) : {};
  simpleModal(
    id ? "Editar proveedor" : "Nuevo proveedor",
    "supplier.save",
    `<div class="form-grid"><div class="span-2">${field("name", "Razón social / nombre", "text", x.name, 'required maxlength="160"')}</div>${field("document", "NIT / documento", "text", x.document, 'maxlength="60"')}${field("phone", "Teléfono", "text", x.phone, 'maxlength="40"')}</div>`,
    id ? { id } : {},
  );
}
function editOrder(id) {
  const o = find("orders", id);
  modal(
    "Editar ficha · " + o.code,
    `<div class="form-grid"><div class="span-2">${field("description", "Trabajo", "text", o.description, 'required maxlength="2000"')}</div>${field("dueDate", "Prometida", "date", o.dueDate, "required")}${select("priority", "Prioridad", ["Normal", "Urgente"], o.priority)}${moneyField("labor", "Mano de obra · COP", o.labor)}${moneyField("materialPrice", "Insumos · COP", o.materialPrice)}${moneyField("goldPrice", "Metal del taller · COP", o.goldPrice)}${field("taxPercent", "Impuesto (%)", "number", o.taxPercent, 'min="0" max="100" step="0.01" required')}<div class="span-2">${text("notes", "Ficha técnica", o.notes)}</div><div class="span-2">${field("reason", "Motivo del cambio", "text", "", 'required maxlength="1000"')}</div></div>`,
    (b, form, key) => mutate("order.edit", {...b,id,orderMetals:readInlineMetals(form)}, key),
  );
  const form = $("#modal-form");
  const items = o.orderMetals || [];
  form.dataset.metalTotal = String(items.reduce((v,x)=>v+x.price,0));
  $(".form-grid", form).insertAdjacentHTML("beforeend", `<div class="span-2 form-section"><h3>Metal cobrado en esta orden</h3><p>Incluido en el presupuesto. No descuenta inventario: los gramos usados se registran al asignar a mesa.</p></div><div id="edit-order-metals" class="span-2 form-grid">${items.map(inlineOrderMetal).join("")}</div><div class="span-2">${button("Añadir metal a cobrar","add-inline-metal","plus","small")}</div>`);
}
let assignmentMetalIndex = 0;
function assignmentMetalRow(index) {
  return `<section class="card section-gap own-assignment-row" data-metal-index="${index}"><div class="card-head"><h3>Metal propio adicional</h3>${button("Quitar","remove-assignment-metal","","small",String(index))}</div><div class="form-grid">${select("ownMetal-"+index,"Metal",metals().map(x=>[x.id,x.name]),"oro")}${field("ownPurity-"+index,"Ley (milésimas)","number",750,'required min="1" max="1000" step="1"')}${weightField("ownWeight-"+index,"Peso a mesa (g)","")}${select("ownSource-"+index,"Origen",[["own","Bodega propia"],["payment","Recibido como pago"],["melt","Fundido / aleado"]],"own")}</div><p class="muted" data-assignment-available></p></section>`;
}
function updateAssignmentAvailability() {
  const form=$("#modal-form");if(!form)return;
  $$(".own-assignment-row",form).forEach(row=>{
    const i=row.dataset.metalIndex,metal=form.elements["ownMetal-"+i].value,purity=numericValue(form.elements["ownPurity-"+i]),source=form.elements["ownSource-"+i].value;
    $("[data-assignment-available]",row).textContent="Disponible en el origen: "+weight(balance(source,metal,purity));
  });
}
function assignmentPurityOptions(balances, orderPurity, source, selected = orderPurity) {
  const available = balances.filter(row => row.account === source);
  const laws = [...new Set([orderPurity, Number(selected), ...available.map(row => row.purity)])];
  return laws.map(law => [
    law,
    "Ley " + number(law) + " · " + weight(available.find(row => row.purity === law)?.mg ?? 0) + " disponibles",
  ]);
}
function assignOrder(id) {
  const o = find("orders", id);
  if (!S.smiths.length)
    return modal(
      "Registra primero al orfebre",
      empty(
        "Tu equipo aún está vacío",
        "Registra al responsable de la mesa antes de asignar metal.",
        button("Registrar orfebre", "new-smith", "plus", "primary"),
      ),
    );
  assignmentMetalIndex=0;
  const stock = getBalances().filter(row => row.owner === "taller" && row.metal === o.metal && row.mg > 0);
  modal(
    "Asignar a mesa · " + o.code,
    notice(
      `${o.metal} · Ley ${number(o.purity)}`,
      `Custodia del cliente disponible: ${weight(balance("custody", o.metal, o.purity, o.id))}. Para metal propio, elige el origen y la ley que pesaste.`,
      "blue",
    ) +
      notice("Al confirmar se registra la salida de inventario", "Los gramos de metal propio salen del origen elegido y pasan a la mesa de trabajo. El metal del cliente sale de su custodia, sin reducir tu bodega propia.", "blue") +
      `<div class="form-grid">${select(
        "smithId",
        "Orfebre",
        S.smiths.map((x) => [x.id, x.name + " · " + x.bench]),
        "",
      )}${moneyField("smithFee", "Honorarios de este trabajo · COP", 0)}<div class="span-2">${weightField("customerWeight", "Metal del cliente a mesa (g)", balance("custody", o.metal, o.purity, o.id) / 1000, true)}</div>${select(
        "source",
        "Origen del metal propio",
        [
          ["own", "Bodega propia"],
          ["payment", "Metal recibido como pago"],
          ["melt", "Fundido / aleado"],
        ],
        "own",
      )}${select("ownPurity", "Ley del metal propio", assignmentPurityOptions(stock, o.purity, "own"), o.purity)}${weightField("ownWeight", "Metal propio a mesa (g)", 0, true)}<div class="span-2"><div id="assignment-metals"></div>${button("Añadir otro metal propio","add-assignment-metal","plus","small")}</div></div>`,
    (b,form,key)=>mutate("order.assign",{id,smithId:b.smithId,smithFee:b.smithFee,customerWeight:b.customerWeight,ownWeight:b.ownWeight,ownPurity:b.ownPurity,source:b.source,
      ownMetals: $$(".own-assignment-row",form).map(row=>{const i=row.dataset.metalIndex;return {metal:b["ownMetal-"+i],purity:b["ownPurity-"+i],weight:b["ownWeight-"+i],source:b["ownSource-"+i]};})},key),
    "Registrar salida y asignar",
  );
  const form = $("#modal-form");
  form.elements.source.addEventListener("change", () => {
    const law = form.elements.ownPurity;
    const selected = law.value;
    const options = assignmentPurityOptions(stock, o.purity, form.elements.source.value, selected);
    law.innerHTML = options.map(([value, label]) => option(value, label, selected)).join("");
  });
  $("#modal-form").addEventListener("input",updateAssignmentAvailability);
  $("#modal-form").addEventListener("change",updateAssignmentAvailability);
}
function returnOrder(id) {
  const o = find("orders", id),
    base = o.allocations.reduce((v, x) => v + x.mg, 0);
  const groups=PM.groups(o);
  if(groups.length>1){
    modal("Pesar retorno · "+o.code,
      notice("Retorno de una pieza con varios metales","Registra cuánto de cada metal queda en la pieza y su limalla. No se convierte un metal en otro.","blue")+
      groups.map((g,i)=>`<section class="card section-gap"><div class="card-head"><h3>${E(g.metal)} · ley ${number(g.purity)}</h3></div><p>Entregado: ${weight(g.mg)}</p><div class="form-grid">${weightField("pieceWeight-"+i,"Metal en la pieza terminada (g)","",true)}${weightField("scrapWeight-"+i,"Limalla recuperada (g)",0,true)}</div><p class="muted" data-return-preview="${i}"></p></section>`).join("")+text("reason","Observaciones / justificación de merma"),
      (b,form,key)=>mutate("order.return",{id,reason:b.reason,metalReturns:groups.map((g,i)=>({metal:g.metal,purity:g.purity,pieceWeight:b["pieceWeight-"+i],scrapWeight:b["scrapWeight-"+i]}))},key),"Liquidar metales y enviar a calidad");
    const form=$("#modal-form");const update=()=>groups.forEach((g,i)=>{
      const lost=g.mg-Math.round(numericValue(form.elements["pieceWeight-"+i])*1000)-Math.round(numericValue(form.elements["scrapWeight-"+i])*1000);
      $("[data-return-preview='"+i+"']",form).textContent="Merma: "+weight(lost)+" · "+number(lost*100/g.mg)+" %"+(lost<0?" · Revisa los pesos.":lost*100/g.mg>S.settings.lossWarning?" · Requiere administrador.":"");
    });form.addEventListener("input",update);update();return;
  }
  simpleModal(
    "Pesar retorno · " + o.code,
    "order.return",
    notice(
      "Metal entregado: " + weight(base),
      "Pesa por separado la pieza y la limalla. La merma que exceda el umbral crítico requiere un administrador.",
    ) +
      `<div class="form-grid">${weightField("pieceWeight", "Metal neto en pieza terminada, sin piedras (g)", "")}${weightField("scrapWeight", "Limalla / polvo recuperable (g)", 0, true)}<div class="span-2 calculator" id="loss-preview" data-base="${base}">Ingresa los dos pesos para liquidar.</div><div class="span-2">${text("reason", "Observaciones / justificación si hay exceso de merma")}</div></div>`,
    { id },
    "Liquidar metal y enviar a calidad",
  );
}
function payOrder(id) {
  const o = id ? find("orders", id) : null;
  if (!currentShift())
    return (
      modal(
        "Primero abre un turno",
        notice(
          "No hay turno de caja abierto",
          "Todos los cobros quedan ligados a un turno.",
        ),
        null,
      ) + void toast("Abre el turno desde Caja y turnos.", true)
    );
  const list = S.orders.filter(
    (o) => active(o) && due(o) > 0 && o.type !== "Producción propia",
  );
  if (!list.length)
    return modal(
      "Cobros",
      empty(
        "No hay saldos pendientes",
        "Las órdenes que tengan saldo aparecerán aquí.",
      ),
    );
  const target = o || list[0];
  modal(
    "Registrar pago" + (o ? " · " + o.code : ""),
    `<div class="form-grid"><div class="span-2">${select(
      "orderId",
      "Orden a abonar",
      list.map((o) => [o.id, o.code + " · " + client(o) + " · " + cop(due(o))]),
      target.id,
    )}</div>${moneyField("cash", "Efectivo recibido · COP", 0)}${moneyField("bank", "Transferencia recibida · COP", 0)}<div class="span-2">${field("bankRef", "Referencia bancaria (si aplica)", "text", "", 'maxlength="150"')}</div><div class="span-2 form-section"><h3>Metal recibido como pago</h3><p>Su valor pasa a ser abono; el metal pasa a ser propiedad del taller.</p></div>${metalSelect()}${puritySelect()}${weightField("goldWeight", "Peso del metal como pago (g)", 0, true)}${moneyField("rate", "Tarifa aplicada · COP / g fino", S.settings.rate.oro)}<div class="span-2" id="payment-preview"></div>${can("adjust") ? `<div class="span-2">${field("reason", "Motivo si cambia la tarifa oficial", "text", "", 'maxlength="1000"')}</div>` : ""}</div>`,
    (b, f, key) => mutate("payment.create", b, key),
    "Registrar cobro",
  );
  updatePaymentPreview();
}
function updatePaymentPreview() {
  const f = $("#modal-form");
  if (!f || !$("#payment-preview")) return;
  const b = inputData(f),
    o = find("orders", b.orderId);
  if (!o) return;
  const goldMg = Math.round(Number(b.goldWeight || 0) * 1000),
    fineUg = goldMg * Number(b.purity),
    gold = Math.round((fineUg * Number(b.rate || 0)) / 1e6),
    received = Number(b.cash || 0) + Number(b.bank || 0) + gold,
    owed = due(o);
  $("#payment-preview").innerHTML =
    `<div class="calculator">${weight(goldMg)} ${E(b.metal)} × ${number(Number(b.purity) / 1000, 3)} = ${fine(fineUg)}<br>Valor del metal: ${cop(gold)}${row("Saldo actual", cop(owed))}${row("Total recibido", cop(received))}${row("Abono aplicado", cop(Math.min(owed, received)))}${row("Vueltas en efectivo", cop(Math.max(0, received - owed)))}${row("Saldo restante", cop(Math.max(0, owed - received)), "debt")}</div>`;
}
let openingGoldRowId = 0;
function openingGoldRow(index) {
  return `<section class="gold-opening-row" data-opening-row="${index}"><div class="card-head"><h3>Oro de apertura</h3>${index ? button("Quitar", "remove-opening-gold", "", "small", String(index)) : ""}</div><div class="form-grid">${categorySelect("openingPurity-" + index)}${field("openingPurity-" + index, "Ley del oro (milésimas)", "number", 750, 'min="1" max="1000" step="1" required list="opening-gold-laws"')}${weightField("openingWeight-" + index, "Base inicial de oro (g)", "")}</div><p class="balance-details muted" data-gold-availability></p></section>`;
}
function openShiftModal() {
  openingGoldRowId = 0;
  modal(
    "Abrir turno de caja",
    `<div class="form-grid"><div class="span-2">${select(
      "mode",
      "Tipo de apertura",
      [
        ["cash", "Solo efectivo"],
        ["gold", "Solo oro (gramaje)"],
        ["mixed", "Mixto: efectivo y oro"],
      ],
      "cash",
    )}</div><div class="span-2" data-opening-cash>${moneyField("opening", "Base física inicial de efectivo · COP", 0)}</div><div class="span-2" data-opening-gold hidden>${notice("El oro se traslada de bodega a caja", "Usa oro propio ya registrado en el Libro de metales. La apertura conserva el inventario total y no cuenta como venta ni abono.", "blue")}<datalist id="opening-gold-laws">${goldLawOptions()}</datalist><div id="opening-gold-rows">${openingGoldRow(0)}</div><div class="actions section-gap">${button("Agregar otra ley", "add-opening-gold", "plus", "small")}</div></div><div id="opening-preview" class="calculator span-2"></div></div>`,
    (b, f, key) => {
      const openingGold =
        b.mode === "cash"
          ? []
          : $$("[data-opening-row]", f).map((el) => ({
              metal: "oro",
              purity: b["openingPurity-" + el.dataset.openingRow],
              weight: b["openingWeight-" + el.dataset.openingRow],
            }));
      return mutate(
        "shift.open",
        {
          mode: b.mode,
          opening: b.mode === "gold" ? 0 : b.opening,
          openingGold,
        },
        key,
      );
    },
    "Abrir turno",
  );
  updateShiftOpening();
}
function updateShiftOpening() {
  const f = $("#modal-form");
  if (!f?.elements.mode || !$("#opening-preview")) return;
  const mode = f.elements.mode.value,
    withGold = mode !== "cash",
    withCash = mode !== "gold";
  $("[data-opening-cash]", f).hidden = !withCash;
  $("[data-opening-gold]", f).hidden = !withGold;
  f.elements.opening.disabled = !withCash;
  f.elements.opening.min = mode === "mixed" ? "1" : "0";
  validateNumericInput(f.elements.opening);
  $$("input,select,button", $("[data-opening-gold]", f)).forEach((el) => {
    el.disabled = !withGold;
  });
  let mg = 0,
    ug = 0;
  for (const el of $$("[data-opening-row]", f)) {
    const p = numericValue($("[name^=openingPurity]", el)),
      w = Math.round(numericValue($("[name^=openingWeight]", el)) * 1000);
    const available = balance("own", "oro", p);
    $("[data-gold-availability]", el).textContent =
      "Disponible en bodega: " +
      weight(available) +
      (w > available ? " · El peso supera la existencia." : "");
    if (withGold && p >= 1 && p <= 1000 && w > 0) {
      mg += w;
      ug += w * p;
    }
  }
  $("#opening-preview").innerHTML =
    row(
      "Base de efectivo",
      cop(withCash ? numericValue(f.elements.opening) : 0),
    ) +
    row("Base de oro", weight(mg)) +
    (withGold ? row("Oro fino equivalente", fine(ug)) : "") +
    "<small>El efectivo y el oro se arquean por separado al cerrar.</small>";
}
function additionalCashIncome() {
  const shift = currentShift();
  if (!shift) throw new Error("Abre un turno para registrar el ingreso.");
  modal(
    "Ingreso adicional de caja · " + shift.code,
    `<div class="form-grid">${moneyField("amount", "Efectivo recibido · COP", "")}${field("note", "Concepto y soporte", "text", "", 'required maxlength="1000"')}<div id="cash-income-preview" class="calculator span-2" data-shift-id="${E(shift.id)}"></div></div>`,
    async (data, form, key) => {
      try {
        return await mutate("cash.entry", { ...data, type: "income", shiftId: shift.id }, key);
      } catch (error) {
        updateCashIncomePreview();
        throw error;
      }
    },
    "Registrar ingreso en caja",
  );
  updateCashIncomePreview();
}
function updateCashIncomePreview() {
  const preview = $("#cash-income-preview");
  if (!preview) return;
  const shift = currentShift();
  if (!shift || shift.id !== preview.dataset.shiftId) {
    preview.textContent = "El turno cambió. Cierra el formulario y vuelve a abrirlo.";
    return;
  }
  const before = expectedCash(shift);
  const income = numericValue($("#modal-form").elements.amount);
  preview.innerHTML =
    row("Efectivo esperado antes del ingreso", cop(before)) +
    row("Efectivo esperado después del ingreso", cop(before + income), "total");
}
function closeShift() {
  const shift = currentShift(),
    gold = cashMetals();
  modal(
    "Arqueo y cierre · " + shift.code,
    notice(
      "Confirma el conteo físico",
      "Registra lo que realmente contaste. Las diferencias requieren motivo y autorización de administrador.",
      "amber",
    ) +
      `<div class="form-grid">${field("expected", "Efectivo esperado · COP", "text", cop(expectedCash(shift)), "readonly")}${moneyField("counted", "Efectivo contado · COP", "")}<div class="span-2 form-section"><h3>Arqueo de metales</h3><p>Pesa la base inicial más el metal recaudado de cada ley. La cantidad contada se traspasa a bodega al confirmar.</p></div>${gold.map((x, i) => weightField("gold-" + i, `${x.metal} ley ${number(x.purity)} · esperado ${weight(x.mg)}`, "", true)).join("") || '<p class="muted span-2">No hay metal en caja para trasladar.</p>'}<div class="span-2">${field("receiver", "Responsable que recibe el metal en bodega", "text", "", `${gold.length ? "required " : ""}maxlength="150"`)}</div><div class="span-2">${text("reason", "Justificación de cualquier diferencia")}</div></div>`,
    (b, f, key) =>
      mutate(
        "shift.close",
        {
          shiftId: shift.id,
          counted: b.counted,
          receiver: b.receiver,
          reason: b.reason,
          goldCounts: gold.map((x, i) => ({
            metal: x.metal,
            purity: x.purity,
            weight: b["gold-" + i],
          })),
        },
        key,
      ),
    "Confirmar cierre",
  );
}
let purchaseRowIndex=0;
function purchaseCategoryRow(index) {
  return `<section class="card section-gap" data-purchase-row="${index}"><div class="card-head"><h3>Oro a comprar</h3>${button("Quitar","remove-purchase-row","","small",String(index))}</div><div class="form-grid">${select("purchaseCategory-"+index,"Categoría de oro",[["","Elegir categoría"],...goldCategories().filter(x=>x.active).map(x=>[x.id,x.name+" · ley "+number(x.purity)])],"")}${weightField("purchaseWeight-"+index,"Peso recibido (g)","")}${moneyField("purchasePrice-"+index,"Precio por gramo de esta categoría · COP","")}<div class="field"><span>Valor de esta categoría</span><strong data-purchase-subtotal>${cop(0)}</strong></div></div><p class="muted">El total se calcula con el peso recibido de esta categoría. El fino se registra aparte.</p></section>`;
}
function updatePurchaseOrderPreview() {
  const form=$("#modal-form"),target=$("#purchase-order-preview",form);if(!target)return;
  let total=0,mg=0;const weights=new Map();
  try{
    $$("[data-purchase-row]",form).forEach(row=>{
      const index=row.dataset.purchaseRow,category=goldCategories().find(x=>x.id===form.elements["purchaseCategory-"+index].value);
      const rawWeight=numericValue(form.elements["purchaseWeight-"+index]),weight=Math.round(rawWeight*1000),price=numericValue(form.elements["purchasePrice-"+index]);
      const value=N.weightPrice(weight,price);total+=value;mg+=weight;
      if(total>1e12||mg>1e9)throw new Error("El total o el peso de la compra supera el máximo permitido.");
      $("[data-purchase-subtotal]",row).textContent=cop(value);
      if(category){const key=category.purity;weights.set(key,(weights.get(key)||0)+weight);}
    });
    target.innerHTML=row("Peso total recibido",weight(mg))+row("TOTAL ORDEN DE COMPRA",cop(total),"total")+[...weights].map(([purity,mg])=>row("Ingreso a bodega · oro ley "+number(purity),weight(mg))).join("");
  }catch(error){target.textContent=error.message;}
}
function newPurchase() {
  if(!S.suppliers.length)return newMetalPurchase();
  if(!goldCategories().some(x=>x.active))return modal("Necesitas una categoría de oro",notice("No hay categorías activas","Activa o registra una categoría de oro antes de comprar.","amber")+allowed("settings","Nueva categoría","new-category","plus","primary"));
  purchaseRowIndex=1;
  modal("Nueva orden de compra de oro",
    notice("Compra recibida: ingresa al inventario al confirmar","Los gramos de cada categoría se registran en bodega propia con su ley. La compra crea una cuenta por pagar; el pago al proveedor se registra por separado.","blue")+
    `<div class="form-grid"><div class="span-2">${select("supplierId","Proveedor",S.suppliers.map(x=>[x.id,x.name]),S.suppliers[0].id)}</div>${field("document","Documento / soporte de compra","text","",'required maxlength="100"')}${field("dueDate","Fecha de vencimiento","date",today(),"required")}</div><div id="purchase-category-rows">${purchaseCategoryRow(0)}</div><div class="actions section-gap">${button("Añadir categoría","add-purchase-row","plus","small")}</div><div id="purchase-order-preview" class="calculator section-gap"></div>`,
    (b,form,key)=>mutate("purchase.create",{supplierId:b.supplierId,document:b.document,dueDate:b.dueDate,
      items:$$("[data-purchase-row]",form).map(row=>{const i=row.dataset.purchaseRow;return {categoryId:b["purchaseCategory-"+i],weight:b["purchaseWeight-"+i],unitPrice:b["purchasePrice-"+i]};})},key),"Confirmar compra e ingresar a inventario");
  const form=$("#modal-form");
  form.addEventListener("change",event=>{
    if(event.target.name?.startsWith("purchaseCategory-")){
      const i=event.target.name.slice("purchaseCategory-".length),category=goldCategories().find(x=>x.id===event.target.value);
      if(category)setNumericValue(form.elements["purchasePrice-"+i],Math.round(S.settings.rate.oro*category.purity/1000));
    }
    updatePurchaseOrderPreview();
  });
  form.addEventListener("input",updatePurchaseOrderPreview);updatePurchaseOrderPreview();
}
function newMetalPurchase() {
  if (!S.suppliers.length)
    return modal(
      "Primero registra al proveedor",
      empty(
        "Aún no hay proveedores",
        "El soporte de compra necesita un proveedor.",
        button("Registrar proveedor", "new-supplier", "plus", "primary"),
      ),
    );
  simpleModal(
    "Compra e ingreso de metal",
    "purchase.create",
    `<div class="form-grid"><div class="span-2">${select(
      "supplierId",
      "Proveedor",
      S.suppliers.map((x) => [x.id, x.name]),
      "",
    )}</div>${field("document", "Número del documento de compra", "text", "", 'required maxlength="100"')}${field("dueDate", "Fecha de vencimiento", "date", today(), "required")}${metalSelect()}${puritySelect()}${weightField("weight", "Peso recibido (g)")}${moneyField("rate", "Precio por gramo fino · COP", S.settings.rate.oro)}<div id="purchase-preview" class="calculator span-2">Ingresa peso y tarifa para ver el total.</div></div>`,
    {},
    "Registrar compra e ingresar a bodega",
  );
}
function adjustMetal() {
  simpleModal(
    "Conteo físico / existencia inicial",
    "inventory.adjust",
    notice(
      "El ajuste conserva su motivo en auditoría",
      "Ingresa el total físico de esa cuenta, metal y ley. El conteo deja ese saldo final. Para una existencia inicial, escribe «Saldo inicial» con el soporte.",
      "amber",
    ) +
      `<div class="form-grid">${select(
        "account",
        "Cuenta",
        [
          ["own", "Bodega propia"],
          ["scrap", "Limalla propia"],
          ["melt", "Fundido / aleado"],
        ],
        "own",
      )}${metalSelect()}${puritySelect()}${weightField("weight", "Existencia física contada (g)", "", true)}<div id="adjust-preview" class="calculator span-2"></div><div class="span-2">${text("reason", "Justificación y soporte obligatorio")}</div></div>`,
    {},
    "Asentar conciliación",
  );
  updateAdjustPreview();
}
function updateAdjustPreview() {
  if (!$("#adjust-preview")) return;
  const b = inputData($("#modal-form")),
    expected = balance(b.account, b.metal, b.purity),
    counted = Math.round(Number(b.weight || 0) * 1000);
  $("#adjust-preview").innerHTML =
    `Saldo contable: ${weight(expected)}<strong>Diferencia: ${counted - expected < 0 ? "−" : "+"}${weight(Math.abs(counted - expected))}</strong>`;
}
function newMelt() {
  simpleModal(
    "Registrar fundición / aleación",
    "melt.create",
    notice(
      "Registra leyes ensayadas",
      "La ley de salida debe corresponder al ensayo del botón. La liga agregada aquí no contiene el metal precioso seleccionado.",
      "blue",
    ) +
      `<div class="form-grid">${metalSelect()}${select(
        "source",
        "Cuenta de origen",
        [
          ["own", "Bodega propia"],
          ["scrap", "Limalla propia"],
          ["melt", "Fundido / aleado"],
        ],
        "own",
      )}${puritySelect("inputPurity", 999)}${weightField("inputWeight", "Metal de entrada (g)")}${puritySelect("outputPurity", 750)}${weightField("alloyWeight", "Liga agregada, sin metal precioso (g)", 0, true)}${weightField("outputWeight", "Botón fundido pesado (g)")}<div class="calculator" id="melt-preview">Calcula la liga teórica al ingresar el peso de entrada.</div><div class="span-2">${text("notes", "Resultado de ensayo / crisol / soporte")}</div></div>`,
    {},
    "Asentar fundición",
  );
}
function newUser(id) {
  const u = id ? USERS.find((x) => x.id === id) : {};
  simpleModal(
    id ? "Editar acceso" : "Crear usuario",
    id ? "user.update" : "user.create",
    `<div class="form-grid">${field("name", "Nombre", "text", u.name, 'required maxlength="120"')}${id ? field("username", "Usuario o correo electrónico", "text", u.username, "readonly") : field("username", "Usuario o correo electrónico", "text", "", 'required minlength="3" maxlength="254" autocomplete="off"')}${select("role", "Rol", Object.entries(roleNames), "role" in u ? u.role : "consulta")}${field("password", id ? "Nueva contraseña (dejar vacía para conservar)" : "Contraseña", "password", "", `${id ? "" : "required "}minlength="4" maxlength="128" autocomplete="new-password"`)}${
      id
        ? select(
            "active",
            "Estado",
            [
              ["true", "Activo"],
              ["false", "Desactivado"],
            ],
            String(u.active),
          )
        : ""
    }</div>`,
    id ? { id } : {},
  );
}
function clientDetail(id) {
  const c = find("clients", id),
    orders = S.orders.filter((o) => o.clientId === id);
  modal(
    c.name,
    `<p class="muted">${E(c.document)} · ${E(c.phone)} · ${E(c.email)}</p><p style="font-size:12px;line-height:1.8">${E(c.notes)}</p><div class="section-gap">${orderTable(orders)}</div>`,
  );
}
function materialModal() {
  simpleModal(
    "Registrar insumo",
    "material.save",
    `<div class="form-grid"><div class="span-2">${field("name", "Nombre del material", "text", "", 'required maxlength="160"')}</div>${field("unit", "Unidad (pieza, ml, ct, g…)", "text", "pieza", 'required maxlength="30"')}${field("quantity", "Existencia inicial", "number", 0, 'min="0" step="0.001" required')}${moneyField("unitCost", "Costo por unidad · COP", 0)}${field("min", "Existencia mínima", "number", 0, 'min="0" step="0.001" required')}</div>`,
  );
}
function useMaterial(id) {
  if (!S.materials.length)
    return modal(
      "Registra tus materiales",
      empty(
        "No hay insumos registrados",
        "Crea el insumo en Piedras e insumos antes de consumirlo.",
      ),
    );
  simpleModal(
    "Consumir material · " + find("orders", id).code,
    "material.use",
    `<div class="form-grid">${select(
      "materialId",
      "Material",
      S.materials.map((x) => [
        x.id,
        x.name + " · " + quantity(x.quantity) + " " + x.unit,
      ]),
      "",
    )}${field("quantity", "Cantidad a consumir", "number", "", 'required min="0.001" step="0.001"')}</div>`,
    { orderId: id },
    "Descontar y asociar a orden",
  );
}
function receiveStock(id) {
  const o = find("orders", id);
  simpleModal(
    "Recibir producción propia",
    "stock.receive",
    notice(
      o.code + " · " + o.description,
      "Peso terminado: " + weight(o.returned.pieceMg),
    ) +
      `<div class="form-grid">${field("quantity", "Unidades producidas", "number", 1, 'min="1" max="10000" step="1" required')}${moneyField("cost", "Costo total del lote · COP", estimatedCost(o))}${moneyField("price", "Precio sugerido por pieza · COP", 0)}</div>`,
    { id },
    "Ingresar piezas a inventario",
  );
}
function transferStock(id) {
  const x = find("stock", id);
  const components=PM.components(x);
  modal(
    "Transferir piezas · " + x.sku,
    notice(
      "Salida del taller hacia el minorista",
      "Esta acción registra la entrega física y descuenta existencias. El soporte Excel se descarga desde el historial.",
      "amber",
    ) +
      `<div class="form-grid">${field("quantity", "Unidades a transferir", "number", x.available, `min="1" max="${x.available}" step="1" required`)}${x.components?components.map((item,i)=>weightField("componentWeight-"+i,item.metal+" · ley "+number(item.purity)+" a transferir (g)",item.remainingMg/1000,true)).join(""):weightField("weight", "Metal neto de las piezas, sin piedras (g)", (x.remainingMg ?? x.mg) / 1000)}<div class="span-2">${field("destination", "Joyería de destino y responsable que recibe", "text", "", 'required maxlength="250"')}</div></div>`,
    (b,form,key)=>{
      const parts=x.components?components.map((item,i)=>({metal:item.metal,purity:item.purity,weight:b["componentWeight-"+i]})):undefined;
      return mutate("stock.transfer",{id,quantity:b.quantity,destination:b.destination,weight:parts?parts.reduce((sum,item)=>sum+Math.round(item.weight*1000),0)/1000:b.weight,...(parts?{components:parts}:{})},key);
    },
    "Registrar transferencia",
  );
}
function restoreBackup() {
  modal(
    "Restaurar operación del taller",
    notice(
      "Reemplaza los registros actuales",
      "Se guardará una copia antes de restaurar. Los usuarios y contraseñas actuales se conservan.",
      "amber",
    ) +
      `${field("backup", "Copia de seguridad JSON", "file", "", 'accept=".json,application/json" required')}${field("password", "Confirma tu contraseña de administrador", "password", "", 'required autocomplete="current-password"')}<label class="check"><input type="checkbox" name="confirmed" required>He verificado que esta copia corresponde al taller y deseo reemplazar la operación actual.</label>`,
    async (b, f, key) => {
      let backup;
      try {
        backup = JSON.parse(await f.elements.backup.files[0].text());
      } catch {
        throw new Error("El archivo no es una copia JSON válida.");
      }
      await mutate("backup.restore", { backup, password: b.password }, key);
    },
    "Restaurar datos",
  );
}

let receivedPhoto = null,
  photoPromise = null,
  photoGeneration = 0;
function discardReceptionDraft() {
  mainFormAttempts.delete("receive-form");
  photoGeneration++;
  receivedPhoto = null;
  photoPromise = null;
}
function lockMainForm(form) {
  mainBusy = true;
  $(".form-error", form).textContent = "";
  const elements = $$("input, textarea, select, button", form);
  if (form.id === "settings-form" && $("[name=serialBaud]"))
    elements.push($("[name=serialBaud]"));
  const states = elements.map((el) => ({ el, disabled: el.disabled }));
  states.forEach(({ el }) => {
    el.disabled = true;
  });
  return () => {
    mainBusy = false;
    states.forEach(({ el, disabled }) => {
      el.disabled = disabled;
    });
  };
}
function bindPage() {
  $$("form").forEach(syncMetalFields);
  const f = $("#receive-form");
  if (f) {
    f.elements.hasStones.addEventListener("change",()=>updateReceptionType(f));
    updateReceptionType(f);
    quotePreview(f);
    if (receivedPhoto)
      $("#photo-preview").innerHTML =
        `<img class="photo-preview section-gap" src="${E(receivedPhoto)}" alt="Fotografía seleccionada">`;
    f.onsubmit = async (e) => {
      e.preventDefault();
      if (mainBusy) return;
      const b = inputData(f),
        unlock = lockMainForm(f);
      try {
        if (b.laborEstimate) b.laborEstimate = JSON.parse(b.laborEstimate);
        else delete b.laborEstimate;
        b.orderMetals = JSON.parse(b.orderMetals || "[]");
        b.ownStones=JSON.parse(b.ownStones||"[]");
        b.hasStones=!!b.hasStones;
        if (photoPromise) await photoPromise;
        delete b.photo;
        b.photo = receivedPhoto;
        const key = mainSubmissionKey(f, b);
        const o = await mutate("order.create", b, key);
        unlock();
        dirty = false;
        discardReceptionDraft();
        route("orders", o.id);
        toast("Orden " + o.code + " registrada.");
      } catch (err) {
        $(".form-error", f).textContent = err.message;
      } finally {
        unlock();
      }
    };
  }
  const config = $("#settings-form");
  if (config) {
    if ($("[name=serialBaud]"))
      $("[name=serialBaud]").value = config.elements.baudRate.value;
    config.onsubmit = async (e) => {
      e.preventDefault();
      if (mainBusy) return;
      const b = inputData(config),
        unlock = lockMainForm(config);
      try {
        const key = mainSubmissionKey(config, b);
        await mutate("settings.save", b, key);
        mainFormAttempts.delete(config.id);
        unlock();
        dirty = false;
        render();
        toast("Configuración guardada.");
      } catch (err) {
        $(".form-error", config).textContent = err.message;
      } finally {
        unlock();
      }
    };
  }
}
async function processPhoto(file, generation = photoGeneration) {
  if (!file) {
    receivedPhoto = null;
    return;
  }
  if (!file.type.startsWith("image/"))
    throw new Error("Selecciona una fotografía válida.");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("La imagen supera los 20 MB.");
  const bitmap = await createImageBitmap(file),
    factor = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height)),
    canvas = document.createElement("canvas");
  if (generation !== photoGeneration || view !== "receive") {
    bitmap.close();
    return;
  }
  canvas.width = Math.round(bitmap.width * factor);
  canvas.height = Math.round(bitmap.height * factor);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  receivedPhoto = canvas.toDataURL("image/jpeg", 0.78);
  bitmap.close();
  if ($("#photo-preview"))
    $("#photo-preview").innerHTML =
      `<img class="photo-preview section-gap" src="${receivedPhoto}" alt="Fotografía seleccionada">`;
}
function scaleStatus() {
  return serialPort
    ? scaleReading !== null
      ? `${weight(Math.round(scaleReading * 1000))} · ${scaleStable ? "Estable" : "Lectura no confirmada"} · ${Date.now() - scaleTime < 5000 ? "En vivo" : "Lectura antigua"}`
      : "Puerto abierto · esperando lectura"
    : "Captura manual · balanza sin conectar";
}
function updateScaleStatus() {
  $$(".scale-status").forEach((el) => (el.textContent = scaleStatus()));
  const connect = $("[data-action=connect-scale]");
  if (connect) {
    connect.disabled = !!serialPort;
    const disconnect = $("[data-action=disconnect-scale]");
    if (serialPort && !disconnect)
      connect.insertAdjacentHTML(
        "afterend",
        button("Desconectar", "disconnect-scale"),
      );
    if (!serialPort && disconnect) disconnect.remove();
  }
}
async function connectScale() {
  if (!("serial" in navigator))
    throw new Error(
      "Este navegador no admite Web Serial. Abre la aplicación con Chrome o Edge.",
    );
  if (serialPort) return toast("La balanza ya está conectada.");
  const baud = Number($("[name=serialBaud]")?.value || S.settings.baudRate);
  const port = await navigator.serial.requestPort();
  await port.open({
    baudRate: baud,
    dataBits: 8,
    stopBits: 1,
    parity: "none",
    flowControl: "none",
  });
  serialPort = port;
  serialBuffer = "";
  toast("Puerto abierto. Esperando lectura de la balanza.");
  updateScaleStatus();
  readScale().catch((e) => toast(e.message, true));
}
async function readScale() {
  const decoder = new TextDecoder();
  serialReader = serialPort.readable.getReader();
  try {
    while (serialPort) {
      const { value, done } = await serialReader.read();
      if (done) break;
      serialBuffer += decoder.decode(value, { stream: true });
      const lines = serialBuffer.split(/[\r\n]+/);
      serialBuffer = lines.pop().slice(-1000);
      for (const line of lines) {
        const match = line.match(
          /(?:^|[\s,])([+-]?\s*\d+(?:[.,]\d+)?)\s*(kg|mg|g)(?:\s|$)/i,
        );
        if (!match) continue;
        const unit = match[2].toLowerCase(),
          v =
            Number(match[1].replace(/\s/g, "").replace(",", ".")) *
            (unit === "kg" ? 1000 : unit === "mg" ? 0.001 : 1);
        if (Number.isFinite(v)) {
          scaleReading = v;
          scaleTime = Date.now();
          scaleStable =
            /(?:^|\s)(?:ST|S|stable)(?:\s|,|$)/i.test(line) &&
            !/(?:^|\s)(?:US|unstable)(?:\s|,|$)/i.test(line);
          updateScaleStatus();
        }
      }
    }
  } finally {
    serialReader?.releaseLock();
    serialReader = null;
    const port = serialPort;
    serialPort = null;
    scaleReading = null;
    try {
      await port?.close();
    } catch {}
    updateScaleStatus();
  }
}
async function disconnectScale() {
  if (serialReader) await serialReader.cancel();
  else if (serialPort) {
    await serialPort.close();
    serialPort = null;
  }
  updateScaleStatus();
}
function captureWeight(name) {
  if (scaleReading === null || Date.now() - scaleTime > 5000)
    throw new Error(
      "No hay una lectura reciente. Conecta la balanza o ingresa el peso manualmente.",
    );
  if (!scaleStable)
    throw new Error(
      "La balanza no ha marcado una lectura estable (ST / S). Usa el peso manual y verifica la estabilidad en el equipo.",
    );
  const el = $(`[name="${name}"]`);
  if (el) {
    setNumericValue(el, scaleReading);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    toast("Lectura estable capturada.");
  }
}
function receiptHeader(title) {
  return `<h2>áurea</h2><h3>${E(S.settings.name)}</h3><div class="center">${E(S.settings.nit)}<br>${E(S.settings.address)}<br>${E(S.settings.phone)}</div><hr><h3>${E(title)}</h3>`;
}
function showReceipt(title, html) {
  modal(
    title,
    `<div class="receipt" style="width:${S.settings.printWidth === 58 ? "210" : "302"}px">${html}</div><div class="actions section-gap" style="justify-content:center">${button("Imprimir / Guardar PDF", "print-current", "print", "primary")}</div>`,
  );
}
function printOrder(id) {
  const o = find("orders", id),
    c = find("clients", o.clientId);
  showReceipt(
    "Comprobante · " + o.code,
    receiptHeader(
      o.invoice ? "COMPROBANTE COMERCIAL DE ENTREGA" : "RECIBO DE CUSTODIA",
    ) +
      stoneReceipt(o) +
      (o.returned && PM.groups(o).length>1 ? "<hr><strong>METALES EN LA PIEZA</strong>"+PM.pieces(o).map(item=>row(E(item.metal)+" · ley "+number(item.purity),weight(item.mg))).join("") : "") +
      `<hr><strong>${E(o.invoice || o.code)}</strong><br>Orden: ${E(o.code)}<br>Emitido: ${dt(o.deliveredAt || o.createdAt)}<br>Cliente: ${E(c?.name)}<br>Documento: ${E(c?.document)}<br>Prometida: ${dateLabel(o.dueDate)}<hr><strong>TRABAJO SOLICITADO</strong><p class="receipt-pre">${E(o.description)}</p><br>Estado recibido: ${E(o.condition)}<br>Metal cliente: ${weight(o.receivedMg)}<br>${E(o.metal)} · Ley ${number(o.purity)}${o.returned ? `<br>Metal neto en pieza terminada: ${weight(o.returned.pieceMg)}<br>Limalla del cliente: ${weight(o.returned.scraps[o.allocations.findIndex((x) => x.owner === o.id)] || 0)}<br>Sobrante sin procesar: ${weight(Math.max(0, o.receivedMg - o.allocations.filter((x) => x.owner === o.id).reduce((v, x) => v + x.mg, 0)))}` : ""}<hr>${row("Mano de obra", cop(o.labor))}${row("Insumos", cop(o.materialPrice))}${row("Metal del taller", cop(o.goldPrice))}${(o.orderMetals || []).map((x)=>`<p class="receipt-pre">${E(x.name)}: ${cop(x.price)}</p>`).join("")}${row("Impuesto " + number(o.taxPercent) + " %", cop(o.tax))}${row("TOTAL", cop(total(o)))}${row("Abonos", cop(paid(o)))}${row("SALDO", cop(due(o)))}<hr><small>El metal en custodia es propiedad del cliente y no constituye pago.</small><p class="receipt-pre">${E(S.settings.warranty)}</p><div class="signature"></div><div class="center">${o.acceptance ? E(o.acceptance) : "Firma de conformidad del cliente"}</div><hr><small>Comprobante comercial. Sin validación de factura electrónica DIAN.</small>`,
  );
}
function printPurchase(id) {
  const p=find("purchases",id);if(!p)throw new Error("Orden de compra no encontrada.");
  const supplier=find("suppliers",p.supplierId);
  showReceipt("Orden de compra · "+p.code,receiptHeader("ORDEN DE COMPRA · METAL RECIBIDO")+
    `<hr><strong>${E(p.code)}</strong>${p.reversedAt?" · REVERSADA":""}<br>Fecha: ${dt(p.at)}<br>Proveedor: ${E(supplier?.name)}<br>Documento proveedor: ${E(supplier?.document)}<br>Soporte: ${E(p.document)}<br>Vencimiento: ${dateLabel(p.dueDate)}<hr>`+
    purchaseItems(p).map(item=>`<p class="receipt-pre"><strong>${E(item.categoryName)}</strong><br>${E(item.metal)} · ley ${number(item.purity)}<br>Peso recibido: ${weight(item.mg)}<br>Fino: ${fine(item.mg*item.purity)}<br>Precio por ${p.priceBasis==="gross"?"gramo de la categoría":"gramo fino"}: ${cop(item.unitPrice)}<br>Subtotal: ${cop(item.total)}</p>`).join("<hr>")+
    `<hr>${row("TOTAL COMPRA",cop(p.total))}${row("SALDO POR PAGAR",cop(purchasePending(p)))}<hr><small>${p.reversedAt?"Compra reversada. Consulta su devolución en el libro de metales.":"La compra ingresó el metal a bodega propia, separado por ley. El pago se registra aparte."}</small><br>Registró: ${E(p.actor)}`);
}
function printPayment(id) {
  const p = find("payments", id),
    o = find("orders", p.orderId);
  showReceipt(
    "Cobro · " + p.code,
    receiptHeader(
      p.refund ? "DEVOLUCIÓN DE ANTICIPO" : "COMPROBANTE DE COBRO",
    ) +
      `<hr><strong>${E(p.code)} ${p.voidedAt ? "· ANULADO" : ""}</strong><br>${dt(p.at)}<br>Orden: ${E(o.code)}<br>Cliente: ${E(client(o))}<br>Responsable: ${E(p.actor)}<hr>${row("Efectivo recibido", cop(p.cash))}${row("Transferencia", cop(p.bank))}${p.bankRef ? `Ref.: ${E(p.bankRef)}<br>` : ""}${p.goldMg ? `<hr>Metal: ${E(p.metal)} · Ley ${number(p.purity)}<br>Bruto: ${weight(p.goldMg)}<br>Fino: ${fine(p.goldMg * p.purity)}<br>Tarifa: ${cop(p.rate)} / g fino${row("Valor del metal", cop(p.goldValue))}<small>El metal recibido como pago pasa a ser propiedad del taller.</small><hr>` : ""}${row("Total recibido", cop(p.received))}${row("Vueltas en efectivo", cop(p.change))}${row("ABONO APLICADO", cop(p.applied))}<hr><small>Conserve este comprobante. El abono no acredita la entrega de la pieza.</small>`,
  );
}
function printShift(id) {
  const x = find("shifts", id);
  const metals = x.closedAt ? x.goldCounts || [] : cashMetals();
  showReceipt(
    "Acta · " + x.code,
    receiptHeader(
      x.closedAt ? "ACTA DE ARQUEO DUAL" : "RESUMEN DE TURNO ABIERTO",
    ) +
      `<hr><strong>${E(x.code)}</strong><br>Cajero: ${E(x.actor)}<br>Apertura: ${dt(x.openedAt)}<br>Cierre: ${dt(x.closedAt)}<br>Modalidad de apertura: ${E(openingModeLabel(x))}<hr>${row("Base inicial de efectivo", cop(x.opening))}${(x.openingGold || []).map((g) => `<p>Base inicial de oro · ley ${number(g.purity)}<br>${weight(g.mg)} · ${fine(g.fineUg)}</p>`).join("")}${row("Efectivo esperado", cop(x.closedAt ? x.expected : expectedCash(x)))}${x.closedAt ? row("Efectivo contado", cop(x.counted)) + row("Diferencia", cop(x.difference)) : ""}${metals.map((g) => `<hr>${E(g.metal)} · Ley ${number(g.purity)}<br>Base en caja: ${weight(g.openingMg || 0)}<br>Recaudo en caja: ${weight(g.receivedMg ?? g.mg)}<br>Esperado: ${weight(g.mg)}${x.closedAt ? `<br>Contado: ${weight(g.countedMg)}<br>Diferencia: ${weight(g.countedMg - g.mg)}` : ""}`).join("")}<hr>${x.closedAt ? (x.review ? "POR REVISAR" : "Sin diferencias registradas") : "Turno abierto · conteo pendiente"}<br>${E(x.reason || "")}<br>Metal recibido por: ${E(x.receiver || "No aplica")}<div class="signature"></div><div class="center">Firma del responsable</div>`,
  );
}
function download(name, content, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function excel(name, headers, rows) {
  const content = await window.TallerExcel.write(name, headers, rows, { workshop: S.settings.name });
  download(
    name + "-" + today() + ".xlsx",
    content,
    window.TallerExcel.MIME,
  );
}
async function exportData(type, id) {
  const from = filters.reportFrom || today().slice(0, 7) + "-01",
    to = filters.reportTo || today(),
    inRange = (at) => at && dayKey(at) >= from && dayKey(at) <= to;
  if(type==="gems")return excel("inventario-piedras",["Código","Piedra","Tipo","Cantidad inicial","Cantidad disponible","Quilates iniciales ct","Quilates disponibles ct","Costo total COP","Costo disponible COP","Precio sugerido unidad COP","Talla","Medidas","Certificado","Observaciones","Estado entrada"],(S.gemstoneLots||[]).filter(x=>!x.deletedAt).map(x=>[x.code,x.name,x.individual?"Individual":"Lote",x.quantity,x.available,x.caratMilli/1000,x.remainingCaratMilli/1000,x.cost,x.remainingCost,x.unitPrice,x.cut,x.measurements,x.certificate,x.notes,x.reversedAt?"Reversada":"Vigente"]));
  if(type==="gem-orders")return excel("piedras-por-trabajo",["Orden","Cliente","Piedra","Propietario","Unidades","Quilates ct","Estado","Costo COP","Precio acordado COP","Precio incluido COP","Lote propio","Certificado","Estado recibido","Talla","Medidas","Observaciones"],S.orders.filter(o=>!o.deletedAt).flatMap(o=>(o.stones||[]).map(x=>[o.code,client(o),x.name,x.owner==="cliente"?"Cliente · custodia":"Taller",x.quantity,x.caratMilli===null?null:x.caratMilli/1000,stoneStatuses[x.status],x.cost,x.price,x.owner==="taller"&&!["returned","lost"].includes(x.status)?x.price:0,(S.gemstoneLots||[]).find(l=>l.id===x.stockId)?.code||"",x.certificate,x.condition||"",x.cut,x.measurements,x.notes])));
  if(type==="purchases")return excel("ordenes-compra",["Orden","Fecha","Proveedor","Documento","Categoría / metal","Ley","Peso g","Precio por gramo COP","Base del precio","Subtotal COP","Total orden COP","Saldo pendiente COP","Vencimiento","Estado"],
    S.purchases.filter(p=>!p.deletedAt).flatMap(p=>purchaseItems(p).map((item,index)=>[p.code,window.TallerExcel.date(p.at),find("suppliers",p.supplierId)?.name,p.document,item.categoryName,item.purity,item.mg/1000,item.unitPrice,p.priceBasis==="gross"?"Gramo recibido de la categoría":"Gramo fino",item.total,index===0?p.total:null,index===0?purchasePending(p):null,window.TallerExcel.date(p.dueDate),p.reversedAt?"Reversada":"Recibida · inventario ingresado"])));
  if (type === "ledger") {
    const f = filters;
    if (f.ledgerFrom && f.ledgerTo && f.ledgerFrom > f.ledgerTo) throw new Error("La fecha inicial no puede superar la fecha final.");
    return excel(
      "libro-metales",
      [
        "Fecha",
        "Referencia",
        "Origen",
        "Destino",
        "Metal",
        "Ley milesimas",
        "Peso bruto g",
        "Fino g",
        "Propietario",
        "Responsable",
        "Motivo",
        "Estado",
      ],
      S.ledger
        .filter(
          (x) =>
            !x.deletedAt &&
            (!f.ledgerAccount ||
              x.from === f.ledgerAccount ||
              x.to === f.ledgerAccount) &&
            (!f.ledgerMetal || x.metal === f.ledgerMetal) &&
            (!f.ledgerPurity || x.purity === Number(f.ledgerPurity)) &&
            (!f.ledgerOwner ||
              (f.ledgerOwner === "taller"
                ? x.owner === "taller"
                : x.owner !== "taller")) &&
            (!f.ledgerFrom || dayKey(x.at) >= f.ledgerFrom) &&
            (!f.ledgerTo || dayKey(x.at) <= f.ledgerTo),
        )
        .map((x) => [
          window.TallerExcel.date(x.at),
          x.ref,
          ACC[x.from] || x.from,
          ACC[x.to] || x.to,
          x.metal,
          x.purity,
          x.mg / 1000,
          x.fineUg / 1e6,
          x.owner === "taller" ? "Taller" : find("orders", x.owner)?.code,
          x.actor,
          x.note,
          x.reversedAt ? "Reversado" : x.ref?.startsWith("REV-") ? "Compensación" : "Registrado",
        ]),
    );
  }
  if (type === "payments")
    return excel(
      "cobros",
      [
        "Comprobante",
        "Fecha",
        "Orden",
        "Efectivo COP",
        "Transferencia COP",
        "Metal",
        "Ley",
        "Metal g",
        "Valor metal COP",
        "Vueltas COP",
        "Abono COP",
        "Anulado",
        "Cliente",
        "Soporte bancario",
        "Responsable",
        "Turno de caja",
      ],
      S.payments.filter(x=>!x.deletedAt).map((x) => [
        x.code,
        window.TallerExcel.date(x.at),
        find("orders", x.orderId)?.code,
        x.cash,
        x.bank,
        x.metal,
        x.purity,
        x.goldMg / 1000,
        x.goldValue,
        x.change,
        x.applied,
        x.voidedAt ? "Sí" : "No",
        find("orders", x.orderId) ? client(find("orders", x.orderId)) : "",
        x.bankRef,
        x.actor,
        find("shifts", x.shiftId)?.code,
      ]),
    );
  if (["sales", "audit"].includes(type) && from > to) throw new Error("La fecha inicial no puede superar la fecha final.");
  if (type === "sales")
    return excel(
      "ventas",
      [
        "Comprobante",
        "Fecha",
        "Orden",
        "Cliente",
        "Base COP",
        "Impuesto COP",
        "Total COP",
        "Costo estimado COP",
      ],
      S.orders
        .filter((o) => o.invoice && inRange(o.deliveredAt))
        .map((o) => [
          o.invoice,
          window.TallerExcel.date(o.deliveredAt),
          o.code,
          client(o),
          total(o) - o.tax,
          o.tax,
          total(o),
          estimatedCost(o),
        ]),
    );
  if (type === "audit") {
    const rows = [];
    let before = null;
    do {
      const page = await api("/api/audit-export?" + new URLSearchParams({ from, to, ...(before ? { before } : {}) }));
      rows.push(...page.rows);
      if (page.next && before && page.next >= before) throw new Error("No se pudo continuar la exportación de auditoría.");
      before = page.next;
    } while (before);
    return excel(
      "auditoria",
      ["ID", "Fecha", "Responsable", "Acción", "Detalle"],
      rows.map((x) => [
        x.id,
        window.TallerExcel.date(x.at),
        x.actor,
        x.action,
        x.details,
      ]),
    );
  }
  if (type === "transfer") {
    for (const s of S.stock) {
      const t = s.transfers.find((x) => x.id === id);
      if (t)
        return excel(
          "traslado-" + t.code,
          [
            "Referencia",
            "Fecha",
            "Código",
            "Descripción",
            "Unidades",
            "Metal",
            "Ley",
            "Peso g",
            "Costo transferido COP",
            "Precio unitario sugerido COP",
            "Destino",
            "Entrega",
            "Estado",
            "Composición por metal",
            "Piedras incluidas en la pieza",
          ],
          [
            [
              t.code,
              window.TallerExcel.date(t.at),
              s.sku,
              s.description,
              t.quantity,
              t.components ? t.components.map(item=>item.metal).join(" + ") : s.metal,
              t.components ? null : s.purity,
              t.mg / 1000,
              t.cost,
              s.price,
              t.destination,
              t.actor,
              t.reversedAt ? "Reversada" : "Vigente",
              (t.components||[{metal:s.metal,purity:s.purity,mg:t.mg}]).map(item=>item.metal+" · ley "+number(item.purity)+" · "+weight(item.mg)).join("; "),
              (find("orders",s.orderId)?.stones||[]).filter(x=>x.events.some(e=>e.to==="delivered"&&e.ref===t.code)).map(x=>x.name+" · "+number(x.quantity)+" und. · "+ctLabel(x.caratMilli)+(x.certificate?" · "+x.certificate:"")).join("; "),
            ],
          ],
        );
    }
    throw new Error("Traslado no encontrado. Actualiza el inventario y vuelve a intentar.");
  }
  throw new Error("Exportación no disponible.");
}
function whatsapp(id) {
  const o = find("orders", id),
    c = find("clients", o.clientId),
    phone = c.phone.replace(/\D/g, "");
  const message = `Hola ${c.name}, te saludamos de ${S.settings.name}. Tu trabajo ${o.code} (${o.description}) ${o.status === "ready" ? "está listo para retirar" : "se encuentra en estado: " + statusNames[o.status]}. Saldo pendiente: ${cop(due(o))} COP. ${S.settings.address}`;
  modal(
    "Preparar mensaje al cliente",
    `<p class="muted">Revisa el mensaje. El envío se realiza desde tu WhatsApp.</p>${text("whatsappText", "Mensaje", message)}<div class="actions section-gap">${button("Copiar mensaje", "copy-whatsapp", "file")}${phone.length >= 10 ? `<a class="btn primary" id="whatsapp-link" href="https://wa.me/${E(phone)}?text=${encodeURIComponent(message)}" target="_blank" rel="noopener noreferrer">Abrir WhatsApp ${icon("arrow")}</a>` : '<p class="muted">Registra un teléfono con indicativo de país para abrir WhatsApp.</p>'}</div>`,
  );
}
let exportBusy = false;
async function handleAction(action, id, el) {
  if (mainBusy) return toast("Espera a que termine el guardado.");
  if (action.startsWith("export-")) {
    if (exportBusy) return toast("Se está preparando el archivo Excel.");
    exportBusy = true;
    if (el) el.disabled = true;
    try {
      toast("Preparando archivo Excel…");
      if (action === "export-expenses") await exportExpenses();
      else await exportData(action.slice(7), id);
      toast("Archivo Excel preparado.");
    } finally {
      exportBusy = false;
      if (el) el.disabled = false;
    }
    return;
  }
  if (
    [
      "dashboard",
      "orders",
      "clients",
      "gold",
      "production",
      "smiths",
      "payments",
      "cash",
      "purchases",
      "materials",
      "stock",
      "reports",
      "assistant",
      "users",
      "settings",
      "receive",
    ].includes(action)
  ) {
    route(action);
    return;
  }
  switch (action) {
    case "toggle-password": {
      const input = el.closest(".password-entry").querySelector("input");
      const reveal = input.type === "password";
      input.type = reveal ? "text" : "password";
      el.textContent = reveal ? "Ocultar" : "Mostrar";
      el.setAttribute("aria-pressed", String(reveal));
      break;
    }
    case "menu":
      $(".shell").classList.toggle("menu-open");
      break;
    case "close-modal":
      closeModal();
      break;
    case "refresh":
      if (dirty) throw new Error("Guarda el formulario antes de actualizar.");
      await load();
      render();
      toast("Datos actualizados.");
      break;
    case "open-order":
      closeModal();
      route("orders", id);
      break;
    case "new-gem":newGemModal();break;
    case "receive-own-gem":receptionGemModal();break;
    case "edit-receive-gem":receptionGemModal(id);break;
    case "remove-receive-gem":{const f=$("#receive-form");setReceptionStones(f,JSON.parse(f.elements.ownStones.value||"[]").filter(x=>x.id!==id));break;}
    case "gem-weight":gemWeightModal(id);break;
    case "gem-customer":addGemModal(id,"cliente");break;
    case "gem-own":addGemModal(id,"taller");break;
    case "gem-mount":stoneActionModal("mount",id);break;
    case "gem-unmount":stoneActionModal("unmount",id);break;
    case "gem-return":stoneActionModal("return",id);break;
    case "gem-loss":stoneActionModal("loss",id);break;
    case "gem-detail":{const [orderId,stoneId]=id.split("|");modal("Ficha de piedra",gemDetailHtml(find("orders",orderId).stones.find(x=>x.id===stoneId)));break;}
    case "gem-lot-detail":{const x=(S.gemstoneLots||[]).find(x=>x.id===id);modal("Ficha de lote · "+x.code,gemDetailHtml(x)+row("Costo total original",cop(x.cost))+row("Costo disponible",cop(x.remainingCost))+S.orders.flatMap(o=>(o.stones||[]).filter(v=>v.stockId===id).map(v=>`<div class="summary-row"><span>${E(o.code)} · ${number(v.quantity)} · ${E(stoneStatuses[v.status])}</span>${button("Ver trabajo","open-order","","small",o.id)}</div>`)).join(""));break;}
    case "new-production":
      route("receive");
      setTimeout(() => {
        const f = $("#receive-form");
        if (f) {
          f.elements.type.value = "Fabricación";
        }
      }, 0);
      break;
    case "new-client":
      clientModal();
      break;
    case "edit-client":
      clientModal(id);
      break;
    case "client-detail":
      clientDetail(id);
      break;
    case "new-smith":
      smithModal();
      break;
    case "edit-smith":
      smithModal(id);
      break;
    case "new-supplier":
      supplierModal();
      break;
    case "delete-operation": {
      if(!can("adjust"))throw new Error("Solo el administrador puede eliminar operaciones.");
      const [type,targetId]=(id||"purchase|").split("|");
      reverseOperationModal(type,targetId,"delete");
      break;
    }
    case "reverse-operation": {
      const [type,target]=id ? id.split("|") : ["purchase",""];
      reverseOperationModal(type,target);
      break;
    }
    case "new-category":
      categoryModal();
      break;
    case "new-order-metal":
      orderMetalModal();
      break;
    case "edit-order-metal":
      orderMetalModal(id);
      break;
    case "remove-order-metal":
      removeOrderMetal(id);
      break;
    case "add-inline-metal": {
      const form = $("#modal-form");
      $("#edit-order-metals", form).insertAdjacentHTML("beforeend", inlineOrderMetal({id:crypto.randomUUID(),name:"",price:0}));
      break;
    }
    case "remove-inline-metal": {
      const form = $("#modal-form");
      $$('[data-order-metal-row]',form).find((x)=>x.dataset.orderMetalRow===id)?.remove();
      updateInlineMetalTotal(form);
      break;
    }
    case "edit-category":
      categoryModal(id);
      break;
    case "delete-category": {
      const category = goldCategories().find((x) => x.id === id);
      if (!category) throw new Error("Categoría no encontrada.");
      simpleModal("Eliminar categoría de oro", "category.delete", notice("¿Eliminar " + category.name + "?", "Dejará de aparecer en el catálogo y en los formularios. Las órdenes, los saldos y los movimientos anteriores conservan su ley original.", "amber"), { id }, "Eliminar categoría");
      break;
    }
    case "edit-supplier":
      supplierModal(id);
      break;
    case "add-purchase-row":
      if($$("[data-purchase-row]").length>=50)throw new Error("Puedes añadir hasta 50 categorías por compra.");
      $("#purchase-category-rows").insertAdjacentHTML("beforeend",purchaseCategoryRow(purchaseRowIndex++));
      updatePurchaseOrderPreview();
      break;
    case "remove-purchase-row":
      if($$("[data-purchase-row]").length<=1)throw new Error("La compra necesita al menos una categoría.");
      el.closest("[data-purchase-row]").remove();updatePurchaseOrderPreview();
      break;
    case "print-purchase":
      printPurchase(id);
      break;
    case "new-metal-purchase":
      newMetalPurchase();
      break;
    case "new-purchase":
      newPurchase();
      break;
    case "estimate-labor":
      estimateLaborModal();
      break;
    case "edit-order":
      editOrder(id);
      break;
    case "add-assignment-metal":
      if ($$(".own-assignment-row").length>=50) throw new Error("Puedes añadir hasta 50 aportes.");
      $("#assignment-metals").insertAdjacentHTML("beforeend",assignmentMetalRow(assignmentMetalIndex++));
      updateAssignmentAvailability();
      break;
    case "remove-assignment-metal":
      el.closest(".own-assignment-row").remove();
      break;
    case "assign-order":
      assignOrder(id);
      break;
    case "return-order":
      returnOrder(id);
      break;
    case "progress-order":
      simpleModal(
        "Registrar avance · " + find("orders", id).code,
        "order.progress",
        text("note", "Etapa completada / pesaje de control / observación"),
        { id },
        "Registrar avance",
      );
      break;
    case "add-metal":
      simpleModal(
        "Aportar metal · " + find("orders", id).code,
        "order.addMetal",
        `<div class="form-grid">${metalSelect(find("orders",id).metal)}${field("purity","Ley (milésimas)","number",find("orders",id).purity,'required min="1" max="1000" step="1"')}${weightField("weight", "Aporte adicional (g)")}${select(
          "source",
          "Origen",
          [
            ["own", "Bodega propia"],
            ["payment", "Recibido como pago"],
            ["melt", "Fundido / aleado"],
          ],
          "own",
        )}<div class="span-2">${field("reason", "Motivo / soporte", "text", "", 'required maxlength="1000"')}</div></div>`,
        { id },
        "Registrar aporte",
      );
      break;
    case "quality-order":
      modal(
        "Control de calidad · " + find("orders", id).code,
        `<p class="muted">Verifica físicamente la pieza antes de marcarla como lista.</p><label class="check"><input name="size" type="checkbox" required>Medidas, talla y peso verificados.</label><label class="check"><input name="finish" type="checkbox" required>Acabado, pulido y ley conformes con lo acordado.</label><label class="check"><input name="gems" type="checkbox" required>Piedras, broches y ensambles firmes y completos.</label>${(find("orders",id).stones||[]).some(x=>x.owner==="cliente"&&x.status==="lost")?'<label class="check"><input name="stoneIncident" type="checkbox" required>Cliente informado y soporte de la pérdida de sus piedras registrado.</label>':""}${text("note", "Observaciones de calidad")}`,
        (b, f, key) =>
          mutate(
            "order.quality",
            { id, checks: [!!b.size, !!b.finish, !!b.gems], note: b.note, stoneIncidentAcknowledged:!!b.stoneIncident },
            key,
          ),
        "Aprobar y dejar lista",
      );
      break;
    case "deliver-order": {
      const o = find("orders", id);
      if (due(o) > 0)
        throw new Error(
          "La orden tiene saldo pendiente. Registra el cobro antes de entregar.",
        );
      simpleModal(
        "Entregar pieza · " + o.code,
        "order.deliver",
        notice(
          "Confirma la entrega física",
          "Con esta acción se reconoce la venta y se descarga la custodia. Entrega también la limalla y sobrantes que sean propiedad del cliente.",
          "amber",
        ) +
          field(
            "acceptance",
            "Nombre y documento de quien recibe",
            "text",
            "",
            'required maxlength="250"',
          ),
        { id },
        "Confirmar entrega de pieza",
      );
      break;
    }
    case "cancel-order":
      simpleModal(
        "Anular orden y devolver custodia",
        "order.cancel",
        notice(
          "Devuelve la pieza al cliente",
          "Confirma la devolución física de la pieza y de todas sus piedras. Las piedras propias recuperadas vuelven a bodega; las del cliente se entregan a su dueño. Solo se permite sin producción ni pagos.",
          "amber",
        ) +
          field(
            "reason",
            "Motivo de anulación y soporte de devolución",
            "text",
            "",
            'required maxlength="1000"',
          ),
        { id, confirmed:true },
        "Anular orden",
      );
      break;
    case "refund-order":
      simpleModal(
        "Devolver anticipo",
        "payment.refund",
        notice(
          "Abonos disponibles: " + cop(paid(find("orders", id))),
          "Devuelve dinero por caja o transferencia. El metal recibido como pago conserva su registro como metal adquirido por el taller.",
          "amber",
        ) +
          '<div class="form-grid">' +
          moneyField("cash", "Efectivo a devolver · COP", 0) +
          moneyField("bank", "Transferencia a devolver · COP", 0) +
          '<div class="span-2">' +
          field(
            "bankRef",
            "Referencia bancaria si aplica",
            "text",
            "",
            'maxlength="150"',
          ) +
          '</div><div class="span-2">' +
          field(
            "reason",
            "Motivo y soporte de devolución",
            "text",
            "",
            'required maxlength="1000"',
          ) +
          "</div></div>",
        { orderId: id },
        "Registrar devolución",
      );
      break;
    case "pay-order":
      payOrder(id);
      break;
    case "new-payment":
      payOrder();
      break;
    case "void-payment":
      simpleModal(
        "Anular comprobante de cobro",
        "payment.void",
        notice(
          "Reversión de dinero y metal",
          "Solo se permite en el turno original abierto, con orden sin entregar y metal disponible. Confirma la devolución física de los medios recibidos.",
          "amber",
        ) +
          field(
            "reason",
            "Motivo y soporte de la devolución",
            "text",
            "",
            'required maxlength="1000"',
          ),
        { id },
        "Anular y revertir",
      );
      break;
    case "open-shift":
      openShiftModal();
      break;
    case "add-opening-gold":
      if ($$("[data-opening-row]", $("#dialog")).length >= 20)
        throw new Error("Puedes registrar hasta 20 leyes de oro.");
      $("#opening-gold-rows").insertAdjacentHTML(
        "beforeend",
        openingGoldRow(++openingGoldRowId),
      );
      updateShiftOpening();
      break;
    case "remove-opening-gold":
      $('[data-opening-row="' + id + '"]', $("#dialog"))?.remove();
      updateShiftOpening();
      break;
    case "close-shift":
      closeShift();
      break;
    case "cash-entry":
      additionalCashIncome();
      break;
    case "reset-expense-filters":
      for (const key of ["expenseFrom","expenseTo","expenseMethod","expenseCategory"]) delete filters[key];
      render();
      break;
    case "new-expense":
      expenseModal();
      break;
    case "classify-expense":
      expenseModal(id);
      break;
    case "print-expense":
      printExpense(id);
      break;
    case "transfer-metal":
      simpleModal(
        "Traslado de metal propio",
        "inventory.transfer",
        `<div class="form-grid">${select(
          "from",
          "Origen",
          [
            ["own", "Bodega propia"],
            ["scrap", "Limalla propia"],
            ["melt", "Fundido / aleado"],
          ],
          "own",
        )}${select(
          "to",
          "Destino",
          [
            ["own", "Bodega propia"],
            ["scrap", "Limalla propia"],
            ["melt", "Fundido / aleado"],
          ],
          "melt",
        )}${metalSelect()}${puritySelect()}${weightField("weight", "Peso a trasladar (g)")}<div class="span-2">${field("reason", "Motivo", "text", "", 'required maxlength="1000"')}</div></div>`,
        {},
        "Registrar traslado",
      );
      break;
    case "adjust-metal":
      adjustMetal();
      break;
    case "new-melt":
      newMelt();
      break;
    case "new-material":
      materialModal();
      break;
    case "restock-material": {
      const m = find("materials", id);
      simpleModal(
        "Entrada de " + m.name,
        "material.restock",
        `<div class="form-grid">${field("quantity", "Cantidad a ingresar (" + m.unit + ")", "number", "", 'min="0.001" step="0.001" required')}${moneyField("unitCost", "Costo unitario · COP", m.unitCost)}<div class="span-2">${field("note", "Proveedor / documento / soporte de entrada", "text", "", 'required maxlength="1000"')}</div></div>`,
        { id },
        "Ingresar material",
      );
      break;
    }
    case "use-material":
      useMaterial(id);
      break;
    case "receive-stock":
      receiveStock(id);
      break;
    case "transfer-stock":
      transferStock(id);
      break;
    case "pay-supplier": {
      const p = find("purchases", id),
        pending =
          p.total -
          S.supplierPayments
            .filter((x) => x.purchaseId === id && !x.reversedAt)
            .reduce((v, x) => v + x.amount, 0);
      simpleModal(
        "Pago proveedor · " + p.code,
        "supplier.pay",
        `<div class="form-grid">${moneyField("amount", "Pago · COP", pending)}${select(
          "method",
          "Medio",
          [
            ["cash", "Efectivo en caja"],
            ["bank", "Transferencia bancaria"],
          ],
          "bank",
        )}<div class="span-2">${field("reference", "Comprobante / referencia de pago", "text", "", 'required maxlength="200"')}</div></div>`,
        { id },
        "Registrar pago",
      );
      break;
    }
    case "settle-smith": {
      const s = find("smiths", id),
        orders = S.orders.filter(
          (o) =>
            o.smithId === id &&
            o.returned &&
            !S.settlements.some((x) => !x.reversedAt && x.orderIds.includes(o.id)),
        );
      simpleModal(
        "Liquidar honorarios · " + s.name,
        "smith.settle",
        notice(
          "Honorarios pendientes: " +
            cop(orders.reduce((v, o) => v + o.smithFee, 0)),
          orders.map((o) => o.code).join(", "),
        ) +
          `<div class="form-grid">${select(
            "method",
            "Medio de pago",
            [
              ["cash", "Efectivo en caja"],
              ["bank", "Transferencia bancaria"],
            ],
            "bank",
          )}${field("reference", "Comprobante / soporte", "text", "", 'required maxlength="200"')}</div>`,
        { smithId: id },
        "Registrar pago de honorarios",
      );
      break;
    }
    case "new-user":
      newUser();
      break;
    case "edit-user":
      newUser(id);
      break;
    case "filter-account":
      for (const key of ["ledgerMetal","ledgerPurity","ledgerOwner","ledgerFrom","ledgerTo"]) delete filters[key];
      filters.ledgerAccount = id;
      render();
      $("#metal-movements-title")?.focus({preventScroll:true});
      $("#metal-movements")?.scrollIntoView({behavior:"smooth",block:"start"});
      break;
    case "order-board":
      filters.board = true;
      render();
      break;
    case "order-list":
      filters.board = false;
      render();
      break;
    case "movement-detail": {
      const x = find("ledger", id);
      modal(
        "Movimiento · " + x.ref,
        row("Fecha", dt(x.at)) +
          row("Responsable", E(x.actor)) +
          row("Origen", E(ACC[x.from] || x.from)) +
          row("Destino", E(ACC[x.to] || x.to)) +
          row("Metal y ley", E(x.metal) + " · " + number(x.purity)) +
          row("Peso bruto", weight(x.mg)) +
          row("Fino equivalente", fine(x.fineUg)) +
          row(
            "Propietario",
            E(x.owner === "taller" ? "Taller" : find("orders", x.owner)?.code),
          ) +
          `<p class="muted section-gap">${E(measurementNote(x.note))}</p>`,
      );
      break;
    }
    case "audit-detail": {
      const x = AUDIT.find((x) => String(x.id) === id);
      modal(
        actionLabel(x.action),
        row("Fecha", dt(x.at)) +
          row("Responsable", E(x.actor)) +
          `<pre style="white-space:pre-wrap;font-size:11px;line-height:1.8;word-break:break-word">${E(auditDetails(JSON.parse(x.details)))}</pre>`,
      );
      break;
    }
    case "print-order":
      printOrder(id);
      break;
    case "print-payment":
      printPayment(id);
      break;
    case "print-shift":
      printShift(id);
      break;
    case "print-current":
      $("#print-area").innerHTML = $(".receipt", $("#dialog")).outerHTML;
      $("#print-area").style.setProperty(
        "--paper-width",
        S.settings.printWidth === 58 ? "46mm" : "68mm",
      );
      window.print();
      break;
    case "test-print":
      showReceipt(
        "Prueba de impresión",
        receiptHeader("PRUEBA DE IMPRESIÓN") +
          `<hr>${dt(new Date().toISOString())}<br>Peso: 12,400 g · Ley 750<br>Fino: 9,300000 g<br>Valor: ${cop(5673000)}<hr><div class="center">Sin efecto en caja ni inventario.</div>`,
      );
      break;
    case "download-backup": {
      const b = await api("/api/backup");
      download(
        "aurea-taller-" + today() + ".json",
        JSON.stringify(b, null, 2),
        "application/json",
      );
      toast("Copia de seguridad descargada.");
      break;
    }
    case "restore-backup":
      restoreBackup();
      break;
    case "whatsapp":
      whatsapp(id);
      break;
    case "copy-whatsapp":
      await navigator.clipboard.writeText($("[name=whatsappText]").value);
      toast("Mensaje copiado.");
      break;
    case "connect-scale":
      await connectScale();
      break;
    case "disconnect-scale":
      await disconnectScale();
      break;
    case "capture-weight":
      captureWeight(id);
      break;
    case "capture-received":
      captureWeight("receivedWeight");
      break;
    case "account":
      modal(
        "Tu cuenta",
        row("Nombre", E(U.name)) +
          row("Rol", E(roleNames[U.role])) +
          `<div class="actions section-gap">${button("Cambiar contraseña", "change-password", "shield")}${button("Cerrar sesión", "logout", "logout")}</div>`,
      );
      break;
    case "change-password":
      modal(
        "Cambiar tu contraseña",
        field(
          "current",
          "Contraseña actual",
          "password",
          "",
          'required autocomplete="current-password"',
        ) +
          field(
            "password",
            "Nueva contraseña (mínimo 4 caracteres)",
            "password",
            "",
            'required minlength="4" maxlength="128" autocomplete="new-password"',
          ),
        async (b) => {
          await api("/api/password", {
            method: "POST",
            body: JSON.stringify(b),
          });
        },
        "Cambiar contraseña",
      );
      break;
    case "logout":
      if (dirty && !confirm("Hay un formulario sin guardar. ¿Cerrar sesión?"))
        return;
      await api("/api/logout", { method: "POST", body: "{}" });
      await disconnectScale();
      closeModal();
      S = null;
      U = null;
      dirty = false;
      renderAuth();
      break;
    default:
      toast("Acción no disponible.", true);
  }
}
document.addEventListener("click", async (e) => {
  const nav = e.target.closest("[data-nav]"),
    btn = e.target.closest("[data-action]"),
    open = e.target.closest("[data-open]");
  try {
    if (nav) {
      route(nav.dataset.nav);
      $(".shell")?.classList.remove("menu-open");
    } else if (btn) {
      e.preventDefault();
      await handleAction(btn.dataset.action, btn.dataset.id || "", btn);
    } else if (open) {
      closeModal();
      route("orders", open.dataset.open);
    }
  } catch (err) {
    toast(err.message, true);
  }
});
document.addEventListener("keydown", (e) => {
  if (
    e.target.matches("[data-number]") &&
    ["ArrowUp", "ArrowDown"].includes(e.key)
  ) {
    e.preventDefault();
    const el = e.target,
      step = Number(el.getAttribute("step") || 1),
      min = el.getAttribute("min"),
      max = el.getAttribute("max");
    let value = Number(
      (numericValue(el) + (e.key === "ArrowUp" ? step : -step)).toFixed(6),
    );
    if (min !== null) value = Math.max(Number(min), value);
    if (max !== null) value = Math.min(Number(max), value);
    setNumericValue(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-open]")) {
    e.preventDefault();
    closeModal();
    route("orders", e.target.dataset.open);
  }
});
document.addEventListener("beforeinput", (e) => {
  const el = e.target;
  if (!el.matches("[data-number]") || e.isComposing || e.data !== ".") return;
  e.preventDefault();
  const start = el.selectionStart ?? el.value.length,
    end = el.selectionEnd ?? start;
  if (!el.value.includes(",") || el.value.slice(start, end).includes(",")) {
    el.setRangeText(",", start, end, "end");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
});
document.addEventListener("focusout", (e) => {
  if (e.target.matches("[data-number]")) formatNumericInput(e.target, true);
});
document.addEventListener(
  "submit",
  (e) => {
    let valid = true;
    for (const el of $$("[data-number]", e.target).filter(
      (el) => !el.disabled,
    )) {
      if (!validateNumericInput(el)) valid = false;
      else formatNumericInput(el, true);
    }
    if (!valid) {
      e.preventDefault();
      e.stopImmediatePropagation();
      e.target.reportValidity();
    }
  },
  true,
);
document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.name && el.form) {
    const categoryField = [...el.form.querySelectorAll("[data-gold-category]")].find((x) => x.dataset.goldCategory === el.name);
    const category = goldCategories().find((x) => x.id === categoryField?.value);
    if (category && numericValue(el) !== category.purity) categoryField.value = "";
  }
  if (el.matches("[data-number]"))
    formatNumericInput(
      el,
      false,
      e.inputType?.startsWith("delete") ||
        (e.inputType === "insertText" && /^[0-9]$/.test(e.data || "")),
    );
  if (el.closest(".operational-form")) dirty = true;
  if (el.closest("#receive-form")) {
    quotePreview($("#receive-form"));
    if (el.name === "type") updateReceptionType($("#receive-form"));
  }
  if (
    el.matches("[data-filter]") &&
    !["date", "select-one"].includes(el.type)
  ) {
    const start = el.selectionStart,
      end = el.selectionEnd,
      key = el.dataset.filter;
    filters[key] = el.value;
    const id = el.id;
    render();
    const target = id ? $("#" + id) : $(`[data-filter="${key}"]`);
    if (target) {
      target.focus();
      target.setSelectionRange?.(start, end);
    }
    return;
  }
  if (el.closest("#modal-form")) updateModalCalculations(el);
  if (el.name === "whatsappText") {
    const link = $("#whatsapp-link");
    if (link) {
      const url = new URL(link.href);
      url.searchParams.set("text", el.value);
      link.href = url.toString();
    }
  }
});
document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.name === "metal") syncMetalFields(el.form);
  if (el.name === "metal" && el.value !== "oro") {
    el.form?.querySelectorAll("[data-gold-category]").forEach((x) => { x.value = ""; });
  }
  if (el.matches("[data-gold-category]")) {
    const category = goldCategories().find((x) => x.id === el.value && x.active);
    const form = el.closest("form");
    if (category && form) {
      const target = form.elements.namedItem(el.dataset.goldCategory);
      if (target) {
        setNumericValue(target, category.purity);
        if (form.elements.metal) {
          form.elements.metal.value = "oro";
          form.elements.metal.dispatchEvent(new Event("change", { bubbles: true }));
        }
        target.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
  }
  if (el.name === "serialBaud" && $("#settings-form")) {
    $("#settings-form").elements.baudRate.value = el.value;
    dirty = true;
  }
  if (el.matches("[data-filter]") && ["date", "select-one"].includes(el.type)) {
    filters[el.dataset.filter] = el.value;
    render();
  }
  if (el.name === "photo" && el.files) {
    const generation = ++photoGeneration;
    receivedPhoto = null;
    $("#photo-preview")?.replaceChildren();
    photoPromise = processPhoto(el.files[0], generation).catch((err) => {
      if (generation !== photoGeneration) return;
      receivedPhoto = null;
      $("#photo-preview")?.replaceChildren();
      toast(err.message, true);
      throw err;
    });
    photoPromise.catch(() => {});
  }
  if (el.closest("#receive-form") && el.name === "type")
    updateReceptionType($("#receive-form"));
  if (el.closest("#modal-form")) updateModalCalculations(el);
});
function updateModalCalculations(el) {
  const f = $("#modal-form");
  if (!f) return;
  const b = inputData(f);
  if($("#expense-preview",f))updateExpensePreview();
  if ($("#cash-income-preview", f)) updateCashIncomePreview();
  if (el.name?.startsWith("orderMetalPrice-")) updateInlineMetalTotal(f);
  if ($("#labor-preview", f)) updateLaborPreview();
  if ($("#opening-preview")) updateShiftOpening();
  if ($("#payment-preview")) {
    if (el.name === "metal")
      setNumericValue(f.elements.rate, S.settings.rate[b.metal]);
    updatePaymentPreview();
  }
  if ($("#loss-preview")) {
    const base = Number($("#loss-preview").dataset.base),
      loss =
        base -
        Math.round(Number(b.pieceWeight || 0) * 1000) -
        Math.round(Number(b.scrapWeight || 0) * 1000);
    $("#loss-preview").innerHTML =
      `Metal entregado ${weight(base)}<strong>Merma: ${weight(loss)} · ${number((loss * 100) / base)} %</strong>${loss < 0 ? "El retorno supera la entrega. Revisa los pesos." : (loss * 100) / base > S.settings.lossWarning ? "Fuera de rango · requiere administrador." : "Absorción: taller en costo."}`;
  }
  if ($("#purchase-preview")) {
    if (el.name === "metal") setNumericValue(f.elements.rate, S.settings.rate[b.metal]);
    const value = Math.round(
      (Number(b.weight || 0) *
        1000 *
        Number(b.purity || 0) *
        Number(b.rate || 0)) /
        1e6,
    );
    $("#purchase-preview").innerHTML =
      `Fino: ${fine(Math.round(Number(b.weight || 0) * 1000) * Number(b.purity || 0))}<strong>Total compra: ${cop(value)}</strong>`;
  }
  updateAdjustPreview();
  if ($("#melt-preview")) {
    const input = Number(b.inputWeight || 0),
      target = Number(b.outputPurity || 750),
      theoretical = (input * Number(b.inputPurity || 999)) / target;
    $("#melt-preview").innerHTML =
      `Peso teórico a ley ${number(target)}: ${weight(Math.round(theoretical * 1000))}<strong>Liga teórica: ${weight(Math.round((theoretical - input) * 1000))}</strong><small>El registro usa el peso real y la ley ensayada de salida.</small>`;
  }
}
window.addEventListener("hashchange", () => {
  if (
    modalBusy ||
    mainBusy ||
    (dirty &&
      !confirm("Hay cambios sin guardar. ¿Quieres salir de este formulario?"))
  ) {
    history.pushState(null, "", lastPageHash);
    return;
  }
  dirty = false;
  closeModal();
  lastPageHash = location.hash || "#dashboard";
  const [v, id] = location.hash.slice(1).split("/");
  if (view !== (v || "dashboard")) mainFormAttempts.clear();
  if (view === "receive" && v !== "receive") discardReceptionDraft();
  view = v || "dashboard";
  selected = id || "";
  render();
  window.scrollTo(0, 0);
});
window.addEventListener("beforeunload", (e) => {
  if (dirty || mainBusy) {
    e.preventDefault();
    e.returnValue = "";
  }
});
window.addEventListener("offline", () => {
  connection = false;
  $$(".connection-status").forEach(
    (x) => (x.textContent = "Sin conexión · no se guardan cambios"),
  );
  toast("Se perdió la conexión. Conserva el formulario abierto.", true);
});
async function boot() {
  try {
    const session = await api("/api/session");
    cloudMode = session.environment === "cloud";
    setupKeyRequired = !!session.setupKeyRequired;
    setup = session.setupRequired;
    if (session.user) {
      await load();
      const [v, id] = location.hash.slice(1).split("/");
      view = v || "dashboard";
      selected = id || "";
      render();
    } else renderAuth();
  } catch (e) {
    $("#app").innerHTML =
      `<div class="boot"><div class="wordmark">áurea<span>TALLER JOYERO</span></div>${notice("No se pudo abrir el taller", e.message, "red")}${button("Reintentar", "reload", "refresh", "primary")}</div>`;
    const b = $("[data-action=reload]");
    if (b) b.onclick = () => location.reload();
  }
}
setInterval(updateScaleStatus, 2000);
setInterval(async () => {
  if (!S || dirty || $("#dialog").open) return;
  try {
    const previous = S.revision;
    if (!(await load({ ifIdle: true }))) return;
    $$(".connection-status").forEach(
      (x) => (x.textContent = "Servidor disponible"),
    );
    if (S.revision !== previous) render();
  } catch (e) {
    $$(".connection-status").forEach(
      (x) => (x.textContent = "Sin conexión con el servidor"),
    );
  }
}, 30000);
boot();
