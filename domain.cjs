"use strict";
const { randomUUID } = require("node:crypto");
const Labor = require("./labor-estimate.js");
const Numbers = require("./numbers.js");
const PM = require("./production-metals.js");
const id = () => randomUUID();
const now = () => new Date().toISOString();
const day = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(
    new Date(),
  );
const ACCOUNTS = {
  own: "Oro propio · Bodega",
  custody: "Custodia de clientes",
  payment: "Recibido como pago",
  cashGold: "Base de oro en caja",
  process: "En mesas de trabajo",
  scrap: "Limalla recuperable",
  melt: "Fundido / Aleado",
  finished: "Piezas terminadas propias",
};
const ROLES = {
  admin: [
    "clients",
    "orders",
    "production",
    "inventory",
    "payments",
    "cash",
    "purchases",
    "settings",
    "users",
    "adjust",
    "reports",
  ],
  recepcion: ["clients", "orders", "payments", "cash"],
  produccion: ["production", "inventory"],
  contador: ["purchases", "payments", "cash", "reports"],
  consulta: [],
};
const EXPENSE_CATEGORIES = ["Arriendo","Servicios públicos","Herramientas y mantenimiento","Transporte","Aseo y suministros","Personal y administración","Otros"];
function fail(message, status = 400) {
  const e = new Error(message);
  e.status = status;
  throw e;
}
function assert(ok, message, status) {
  if (!ok) fail(message, status);
}
function str(v, label, max = 500, required = true) {
  const x = String(v ?? "").trim();
  assert(
    (!required || x.length) && x.length <= max,
    `${label}: revisa el contenido (máximo ${max} caracteres).`,
  );
  return x;
}
function num(v, label, min = 0, max = 1e12) {
  assert(
    (typeof v === "number" ||
      (typeof v === "string" &&
        /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(v.trim()))) &&
      Number.isFinite(Number(v)),
    `${label}: ingresa un número válido.`,
  );
  const x = Number(v);
  assert(x >= min && x <= max, `${label}: fuera de rango.`);
  return x;
}
function money(v, label = "Valor") {
  const x = num(v, label);
  assert(Number.isSafeInteger(x), `${label}: usa pesos enteros, sin centavos.`);
  return x;
}
function materialQuantity(v, label = "Cantidad", min = 0) {
  const x = num(v, label, min, 1e9);
  assert(
    Math.abs(x * 1e6 - Math.round(x * 1e6)) < 0.00001,
    `${label}: máximo 6 decimales.`,
  );
  return x;
}
function metalValue(mg, p, r) {
  const v = (BigInt(mg) * BigInt(p) * BigInt(r) + 500000n) / 1000000n;
  assert(
    v <= 1000000000000n,
    "La valoración supera el máximo permitido de un billón de COP.",
  );
  return Number(v);
}
function grams(v, label = "Peso", zero = false) {
  const x = num(v, label, zero ? 0 : 0.001, 1000000);
  assert(
    Math.abs(x * 1000 - Math.round(x * 1000)) < 0.00001,
    `${label}: máximo 3 decimales.`,
  );
  return Math.round(x * 1000);
}
function purity(v) {
  const x = num(v, "Ley", 1, 1000);
  assert(Number.isInteger(x), "La ley se expresa en milésimas enteras.");
  return x;
}
function metal(v, s) {
  const metals = s.settings.metals ?? defaultMetals();
  assert(Array.isArray(metals) && metals.some((x) => x?.id === v), "Metal no válido.");
  return v;
}
function defaultMetals() {
  return [{id:"oro",name:"Oro"},{id:"plata",name:"Plata"},{id:"platino",name:"Platino"}];
}
function metalKey(name) {
  return name.normalize("NFKC").toLocaleLowerCase("es-CO").replace(/\s+/g, " ");
}
function date(v) {
  assert(
    /^\d{4}-\d{2}-\d{2}$/.test(v || "") &&
      !isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Fecha no válida.",
  );
  return v;
}
function get(s, coll, key) {
  const v = (s[coll] || []).find((x) => x.id === key);
  assert(v, "Registro no encontrado.", 404);
  return v;
}
function permit(actor, permission) {
  assert(
    ROLES[actor.role]?.includes(permission),
    "Tu rol no permite esta operación.",
    403,
  );
}
function defaultGoldCategories() {
  return [
    { id: "gold-24k", name: "Oro 24k", purity: 999, active: true },
    { id: "gold-22k", name: "Oro 22k", purity: 916, active: true },
    { id: "gold-18k", name: "Oro 18k", purity: 750, active: true },
    { id: "gold-14k", name: "Oro 14k", purity: 585, active: true },
    { id: "gold-10k", name: "Oro 10k", purity: 417, active: true },
    { id: "gold-fine", name: "Oro fino puro", purity: 1000, active: true },
  ];
}
function initialState() {
  return {
    version: 1,
    revision: 0,
    settings: {
      metals: defaultMetals(),
      goldCategories: defaultGoldCategories(),
      name: "Mi taller joyero",
      nit: "",
      phone: "",
      address: "",
      rate: { oro: 0, plata: 0, platino: 0 },
      taxPercent: 0,
      lossNormal: 2,
      lossWarning: 3.5,
      toleranceMg: 5,
      printWidth: 80,
      warranty: "Conserve este comprobante para retirar su pieza.",
      baudRate: 9600,
    },
    clients: [],
    smiths: [],
    suppliers: [],
    orders: [],
    ledger: [],
    payments: [],
    shifts: [],
    cashEntries: [],
    purchases: [],
    supplierPayments: [],
    melts: [],
    stock: [],
    materials: [],
    materialMoves: [],
    settlements: [],
    reconciliations: [],
    counters: {},
  };
}
function seq(s, key, prefix) {
  s.counters[key] = (s.counters[key] || 0) + 1;
  return `${prefix}-${String(s.counters[key]).padStart(4, "0")}`;
}
function balance(s, account, m, p, owner = "taller") {
  return s.ledger.reduce(
    (a, x) =>
      x.metal === m && x.purity === Number(p) && x.owner === owner
        ? a + (x.to === account ? x.mg : 0) - (x.from === account ? x.mg : 0)
        : a,
    0,
  );
}
function balances(s) {
  const map = new Map();
  for (const x of s.ledger)
    for (const [acc, sign] of [
      [x.to, 1],
      [x.from, -1],
    ])
      if (ACCOUNTS[acc]) {
        const k = [acc, x.metal, x.purity, x.owner].join("|");
        const row = map.get(k) || {
          account: acc,
          metal: x.metal,
          purity: x.purity,
          owner: x.owner,
          mg: 0,
          fineUg: 0,
        };
        row.mg += sign * x.mg;
        row.fineUg += sign * x.mg * x.purity;
        map.set(k, row);
      }
  return [...map.values()].filter((x) => x.mg !== 0);
}
function move(s, a, from, to, mg, m, p, owner, ref, note) {
  assert(Number.isSafeInteger(mg) && mg >= 0, "Movimiento de peso no válido.");
  if (!mg) return;
  assert(from !== to, "El origen y el destino deben ser distintos.");
  if (ACCOUNTS[from])
    assert(
      balance(s, from, m, p, owner) >= mg,
      `Existencia insuficiente en ${ACCOUNTS[from]} (${m}, ley ${p}).`,
    );
  s.ledger.push({
    id: id(),
    at: now(),
    actor: a.name,
    from,
    to,
    mg,
    fineUg: mg * p,
    metal: m,
    purity: p,
    owner,
    ref,
    note,
  });
}
function total(o) {
  return o.labor + o.materialPrice + o.goldPrice + o.tax;
}
function paid(s, o) {
  return s.payments
    .filter((x) => x.orderId === o.id && !x.voidedAt)
    .reduce((a, x) => a + x.applied, 0);
}
function due(s, o) {
  return total(o) - paid(s, o);
}
function openShift(s) {
  const x = s.shifts.find((x) => !x.closedAt);
  assert(x, "Abre un turno de caja antes de registrar este movimiento.");
  return x;
}
function rate(s, m) {
  const r = s.settings.rate[m];
  assert(r > 0, `Configura la tarifa de ${m} por gramo fino.`);
  return r;
}
function cashExpected(s, shift) {
  return (
    shift.opening +
    s.cashEntries
      .filter((x) => x.shiftId === shift.id)
      .reduce((a, x) => a + x.amount, 0)
  );
}
function cashMetals(s) {
  const grouped = new Map();
  for (const x of balances(s).filter(
    (x) => ["cashGold", "payment"].includes(x.account) && x.owner === "taller",
  )) {
    const key = x.metal + "|" + x.purity;
    const row = grouped.get(key) || {
      metal: x.metal,
      purity: x.purity,
      owner: "taller",
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
function cash(s, a, shift, amount, note, ref) {
  if (!amount) return;
  assert(
    cashExpected(s, shift) + amount >= 0,
    "La caja no tiene efectivo suficiente.",
  );
  money(cashExpected(s, shift) + amount, "Saldo resultante de caja");
  s.cashEntries.push({
    id: id(),
    at: now(),
    actor: a.name,
    shiftId: shift.id,
    amount,
    note,
    ref,
  });
}
function timeline(o, a, text) {
  o.updatedAt = now();
  o.history.push({ at: now(), actor: a.name, text });
}
function orderMetalItems(items) {
  assert(Array.isArray(items) && items.length <= 50, "Puedes detallar hasta 50 metales por orden.");
  const ids = new Set();
  const normalized = items.map((x) => {
    assert(x && typeof x.id === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(x.id) && !ids.has(x.id), "Identificador de metal de la orden inválido.");
    ids.add(x.id);
    return {id:x.id,name:str(x.name,"Nombre del metal de la orden",120),price:money(x.price,"Precio total del metal")};
  });
  money(normalized.reduce((v,x)=>v+x.price,0), "Total de metales de la orden");
  return normalized;
}
function taxAmount(base, percent) {
  try { return Numbers.tax(base,percent); }
  catch(e) { fail(e.message); }
}
function quote(s, b) {
  const labor = money(b.labor ?? 0, "Mano de obra"),
    materialPrice = money(b.materialPrice ?? 0, "Materiales"),
    goldPrice = money(b.goldPrice ?? 0, "Metal del taller");
  const taxPercent = num(
    b.taxPercent ?? s.settings.taxPercent,
    "Impuesto %",
    0,
    100,
  );
  const tax = taxAmount(labor + materialPrice + goldPrice, taxPercent);
  money(labor + materialPrice + goldPrice + tax, "Total del presupuesto");
  let laborEstimate;
  const items = b.orderMetals === undefined ? undefined : orderMetalItems(b.orderMetals);
  if (items) assert(items.reduce((v,x)=>v+x.price,0) <= goldPrice, "El total de metal vendido no puede ser menor que los metales detallados.");
  if (b.laborEstimate !== undefined) {
    try {
      laborEstimate = Labor.calculate(b.laborEstimate);
    } catch (e) { fail(e.message); }
  }
  return { labor, materialPrice, goldPrice, taxPercent, tax,
    ...(laborEstimate ? {laborEstimate} : {}),
    ...(items ? {orderMetals:items} : {}) };
}
function allocate(amount, caps) {
  const sum = caps.reduce((a, b) => a + b, 0);
  assert(amount <= sum, "Distribución de metal inválida.");
  if (!sum) return caps.map(() => 0);
  const result = caps.map((x) => Math.floor((amount * x) / sum));
  let rest = amount - result.reduce((a, b) => a + b, 0);
  const order = caps
    .map((x, i) => ({ i, fraction: (amount * x) % sum }))
    .sort((a, b) => b.fraction - a.fraction);
  for (const x of order)
    if (rest && result[x.i] < caps[x.i]) {
      result[x.i]++;
      rest--;
    }
  assert(!rest, "No fue posible distribuir el metal.");
  return result;
}
function execute(s, action, b, a) {
  switch (action) {
    case "operation.reverse": {
      permit(a,"adjust");
      return require("./reversals.cjs")(s,b,a,{assert,get,str,id,now,move,cash,openShift,balance,balances,paid,total,timeline,execute,materialQuantity,money,PM});
    }
    case "category.delete": {
      permit(a, "settings");
      const categories = s.settings.goldCategories || defaultGoldCategories();
      const category = categories.find((x) => x.id === b.id);
      assert(category, "Categoría no encontrada.", 404);
      s.settings.goldCategories = categories.filter((x) => x.id !== category.id);
      return { id: category.id, name: category.name };
    }
    case "category.save": {
      permit(a, "settings");
      const categories = s.settings.goldCategories || defaultGoldCategories();
      const existing = b.id ? categories.find((x) => x.id === b.id) : null;
      assert(!b.id || existing, "Categoría no encontrada.", 404);
      const name = str(b.name, "Nombre de la categoría", 80);
      assert(!categories.some((x) => x.id !== b.id && x.name.toLocaleLowerCase("es-CO") === name.toLocaleLowerCase("es-CO")), "Ya existe una categoría con ese nombre.");
      const law = purity(b.purity);
      assert(b.active === undefined || typeof b.active === "boolean" || ["true", "false"].includes(b.active), "Estado de categoría inválido.");
      assert(existing || categories.length < 200, "Puedes registrar hasta 200 categorías.");
      const category = { id: existing?.id || id(), name, purity: law, active: b.active !== false && b.active !== "false" };
      if (existing) Object.assign(existing, category);
      else categories.push(category);
      s.settings.goldCategories = categories;
      return category;
    }
    case "client.save": {
      permit(a, "clients");
      const existing = b.id ? get(s, "clients", b.id) : null;
      const doc = str(b.document, "Documento", 50, false);
      assert(
        !doc || !s.clients.some((x) => x.document === doc && x.id !== b.id),
        "Ya existe un cliente con ese documento.",
      );
      const x = {
        id: existing?.id || id(),
        name: str(b.name, "Nombre", 120),
        document: doc,
        phone: str(b.phone, "Teléfono", 40, false),
        email: str(b.email, "Correo", 120, false),
        notes: str(b.notes, "Notas", 2000, false),
        createdAt: existing?.createdAt || now(),
      };
      if (existing) Object.assign(existing, x);
      else s.clients.push(x);
      return x;
    }
    case "smith.save": {
      permit(a, "production");
      const x = b.id ? get(s, "smiths", b.id) : { id: id(), active: true };
      Object.assign(x, {
        name: str(b.name, "Nombre", 120),
        bench: str(b.bench, "Mesa / especialidad", 160, false),
      });
      if (!b.id) s.smiths.push(x);
      return x;
    }
    case "supplier.save": {
      permit(a, "purchases");
      const x = b.id ? get(s, "suppliers", b.id) : { id: id() };
      Object.assign(x, {
        name: str(b.name, "Proveedor", 160),
        document: str(b.document, "NIT / documento", 60, false),
        phone: str(b.phone, "Teléfono", 40, false),
      });
      if (!b.id) s.suppliers.push(x);
      return x;
    }
    case "order.create": {
      permit(a, "orders");
      assert(
        [
          "Reparación",
          "Fabricación",
          "Arreglo / talla",
          "Producción propia",
        ].includes(b.type),
        "Tipo de trabajo no válido.",
      );
      if (b.type === "Producción propia") {
        let internal = s.clients.find((x) => x.internal);
        if (!internal) {
          internal = {
            id: id(),
            name: s.settings.name + " · Producción interna",
            document: "",
            phone: "",
            email: "",
            notes: "Cuenta interna de fabricación propia.",
            createdAt: now(),
            internal: true,
          };
          s.clients.push(internal);
        }
        b = { ...b, clientId: internal.id };
      } else get(s, "clients", b.clientId);
      const x = {
        id: id(),
        code: seq(s, "order", "T"),
        clientId: b.clientId,
        type: b.type,
        description: str(b.description, "Trabajo solicitado", 2000),
        condition: str(
          b.condition,
          "Estado, piedras y accesorios recibidos",
          3000,
        ),
        notes: str(b.notes, "Ficha técnica / medidas", 4000, false),
        metal: metal(b.metal, s),
        purity: purity(b.purity),
        receivedMg: grams(b.receivedWeight ?? 0, "Peso recibido", true),
        dueDate: date(b.dueDate),
        priority: b.priority === "Urgente" ? "Urgente" : "Normal",
        ...quote(s, b),
        status: "received",
        createdAt: now(),
        updatedAt: now(),
        history: [],
        allocations: [],
        materialUsage: [],
        smithId: null,
        smithFee: 0,
        returned: null,
        invoice: null,
        rateSnapshot: s.settings.rate[b.metal],
      };
      assert(
        x.type !== "Producción propia" || x.receivedMg === 0,
        "La producción propia no recibe metal de clientes.",
      );
      if (b.photo) {
        assert(
          typeof b.photo === "string" &&
            b.photo.length < 1500000 &&
            /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(
              b.photo,
            ),
          "Fotografía inválida o demasiado grande.",
        );
        x.photo = b.photo;
      }
      if (x.receivedMg)
        move(
          s,
          a,
          "cliente",
          "custody",
          x.receivedMg,
          x.metal,
          x.purity,
          x.id,
          x.code,
          "Recepción en custodia; propiedad del cliente",
        );
      timeline(x, a, "Orden recibida; presupuesto " + total(x) + " COP.");
      s.orders.push(x);
      return x;
    }
    case "order.edit": {
      permit(a, "orders");
      const o = get(s, "orders", b.id);
      assert(
        !["delivered", "cancelled"].includes(o.status),
        "La orden está cerrada.",
      );
      const reason = str(b.reason, "Motivo", 1000);
      const q = quote(s, b);
      assert((q.orderMetals ?? o.orderMetals ?? []).reduce((v,x)=>v+x.price,0) <= q.goldPrice, "El total de metal vendido no puede ser menor que los metales detallados.");
      assert(
        q.labor + q.materialPrice + q.goldPrice + q.tax >= paid(s, o),
        "El presupuesto no puede ser menor a los abonos existentes.",
      );
      Object.assign(o, q, {
        description: str(b.description, "Descripción", 2000),
        notes: str(b.notes, "Ficha técnica", 4000, false),
        dueDate: date(b.dueDate),
        priority: b.priority === "Urgente" ? "Urgente" : "Normal",
      });
      timeline(o, a, "Presupuesto / ficha actualizados. Motivo: " + reason);
      return o;
    }
    case "order.assign": {
      permit(a, "production");
      const o = get(s, "orders", b.id);
      assert(o.status === "received", "Solo se asignan órdenes recibidas.");
      const smith = get(s, "smiths", b.smithId);
      const customer = grams(
          b.customerWeight ?? 0,
          "Metal cliente a mesa",
          true,
        ),
        own = grams(b.ownWeight ?? 0, "Metal propio a mesa", true);
      const source = b.source || "own";
      assert(["own", "payment", "melt"].includes(source), "Origen no válido.");
      const extra = b.ownMetals ?? [];
      assert(Array.isArray(extra) && extra.length <= 50, "Añade hasta 50 aportes de metal propio.");
      const contributions = [
        ...(own ? [{ metal: o.metal, purity: o.purity, mg: own, source }] : []),
        ...extra.map(x => {
          assert(x && typeof x === "object", "Aporte de metal inválido.");
          assert(["own", "payment", "melt"].includes(x.source || "own"), "Origen no válido.");
          return { metal: metal(x.metal,s), purity: purity(x.purity), mg: grams(x.weight), source: x.source || "own" };
        }),
      ];
      const assigned = customer + contributions.reduce((sum,x) => sum+x.mg,0);
      assert(assigned > 0 && assigned <= 1000000000, "Debes registrar metal a mesa, hasta 1.000.000 g por orden.");
      const assignmentStart = s.ledger.length;
      move(
        s,
        a,
        "custody",
        "process",
        customer,
        o.metal,
        o.purity,
        o.id,
        o.code,
        "Salida de custodia a " + smith.name,
      );
      o.allocations = customer ? [{ owner: o.id, mg: customer }] : [];
      for (const x of contributions) {
        move(s,a,x.source,"process",x.mg,x.metal,x.purity,"taller",o.code,"Salida de bodega a " + smith.name);
        const allocation = o.allocations.find(item => item.owner === "taller" && PM.key(PM.identity(o,item)) === PM.key(x));
        if (allocation) allocation.mg += x.mg;
        else o.allocations.push({ owner: "taller", mg: x.mg, metal: x.metal, purity: x.purity,
          rateSnapshot: x.metal === o.metal ? o.rateSnapshot : s.settings.rate[x.metal] });
      }
      o.assignmentLedgerIds = s.ledger.slice(assignmentStart).map(x=>x.id);
      o.smithId = smith.id;
      o.smithFee = money(b.smithFee ?? 0, "Honorarios de orfebre");
      o.status = "in_progress";
      timeline(
        o,
        a,
        `Asignada a ${smith.name}: ${(assigned / 1000).toFixed(3)} g.`,
      );
      return o;
    }
    case "order.progress": {
      permit(a, "production");
      const o = get(s, "orders", b.id);
      assert(o.status === "in_progress", "La orden no está en mesa.");
      timeline(o, a, str(b.note, "Avance de producción", 2000));
      return o;
    }
    case "order.return": {
      permit(a, "production");
      const o = get(s, "orders", b.id);
      assert(
        o.status === "in_progress" && !o.returned,
        "La orden ya fue liquidada o no está en mesa.",
      );
      const groups = PM.groups(o), inputs = b.metalReturns;
      assert(inputs === undefined || (Array.isArray(inputs) && inputs.length === groups.length), "Registra el retorno de cada metal y ley asignados.");
      assert(groups.length === 1 || inputs !== undefined, "Pesa por separado el retorno de cada metal y ley.");
      if (inputs) assert(new Set(inputs.map(x => PM.key(x))).size === inputs.length, "Retorno de metal duplicado.");
      const pieces = o.allocations.map(() => 0), scraps = o.allocations.map(() => 0);
      let piece = 0, scrap = 0, loss = 0, maxPercent = 0;
      for (const group of groups) {
        const input = inputs ? inputs.find(x => PM.key(x) === PM.key(group)) : b;
        assert(input, "Falta el retorno de un metal asignado.");
        const pieceMg = grams(input.pieceWeight, "Pieza terminada", true), scrapMg = grams(input.scrapWeight ?? 0, "Limalla", true);
        const lossMg = group.mg - pieceMg - scrapMg;
        assert(lossMg >= 0, "Pieza y limalla superan el metal entregado. Registra primero cualquier aporte adicional.");
        maxPercent = Math.max(maxPercent, lossMg * 100 / group.mg);
        const caps = group.indexes.map(index => o.allocations[index].mg), splitPieces = allocate(pieceMg, caps);
        const splitScraps = allocate(scrapMg, caps.map((value,index) => value-splitPieces[index]));
        group.indexes.forEach((index,i) => { pieces[index] = splitPieces[i]; scraps[index] = splitScraps[i]; });
        piece += pieceMg; scrap += scrapMg; loss += lossMg;
      }
      assert(piece > 0, "La pieza terminada debe tener peso mayor que cero.");
      const assigned = o.allocations.reduce((v,x) => v+x.mg,0), pct = loss * 100 / assigned;
      const reason = str(b.reason,"Observaciones de retorno",2000,maxPercent > s.settings.lossNormal);
      if (maxPercent > s.settings.lossWarning) permit(a,"adjust");
      for (let i = 0; i < o.allocations.length; i++) {
        const owner = o.allocations[i].owner, item = PM.identity(o,o.allocations[i]);
        move(
          s,
          a,
          "process",
          owner === "taller" ? "finished" : "custody",
          pieces[i],
          item.metal,
          item.purity,
          owner,
          o.code,
          "Pieza terminada",
        );
        move(
          s,
          a,
          "process",
          "scrap",
          scraps[i],
          item.metal,
          item.purity,
          owner,
          o.code,
          "Limalla recuperada",
        );
        move(
          s,
          a,
          "process",
          "merma",
          o.allocations[i].mg - pieces[i] - scraps[i],
          item.metal,
          item.purity,
          owner,
          o.code,
          "Merma definitiva · " + (reason || "Dentro de tolerancia"),
        );
      }
      o.returned = {
        pieceMg: piece,
        scrapMg: scrap,
        lossMg: loss,
        percent: pct,
        maxPercent,
        at: now(),
        reason,
        absorption: "Taller en costo",
        pieces,
        scraps,
      };
      o.status = "quality";
      timeline(
        o,
        a,
        `Retorno: pieza ${piece / 1000} g; limalla ${scrap / 1000} g; merma ${loss / 1000} g (${pct.toFixed(2)}%).`,
      );
      return o;
    }
    case "order.addMetal": {
      permit(a, "production");
      const o = get(s, "orders", b.id);
      assert(
        o.status === "in_progress",
        "Solo se agrega metal a órdenes en mesa.",
      );
      const mg = grams(b.weight),
        m = metal(b.metal ?? o.metal,s), p = purity(b.purity ?? o.purity),
        reason = str(b.reason, "Motivo del aporte", 1000),
        source = b.source || "own";
      assert(["own", "payment", "melt"].includes(source), "Origen no válido.");
      move(
        s,
        a,
        source,
        "process",
        mg,
        m,
        p,
        "taller",
        o.code,
        reason,
      );
      const alloc = o.allocations.find((x) => x.owner === "taller" && PM.key(PM.identity(o,x)) === PM.key({metal:m,purity:p}));
      if (alloc) alloc.mg += mg;
      else o.allocations.push({ owner: "taller", mg, metal:m, purity:p, rateSnapshot:m===o.metal?o.rateSnapshot:s.settings.rate[m] });
      timeline(o, a, `Aporte adicional: ${mg / 1000} g. ${reason}`);
      return o;
    }
    case "order.quality": {
      permit(a, "production");
      const o = get(s, "orders", b.id);
      assert(
        o.status === "quality" && o.returned,
        "Registra el retorno de metal primero.",
      );
      assert(
        Array.isArray(b.checks) &&
          b.checks.length === 3 &&
          b.checks.every((x) => x === true),
        "Verifica medidas, acabado y piedras / ensambles.",
      );
      o.quality = {
        at: now(),
        actor: a.name,
        note: str(b.note, "Control de calidad", 1500, false),
      };
      o.status = "ready";
      timeline(o, a, "Control de calidad aprobado. Lista para entrega.");
      return o;
    }
    case "order.deliver": {
      permit(a, "orders");
      const o = get(s, "orders", b.id);
      assert(
        o.status === "ready",
        "La orden debe pasar control de calidad antes de entregarse.",
      );
      assert(
        o.type !== "Producción propia",
        "La producción propia se traslada a existencias de piezas.",
      );
      assert(
        due(s, o) === 0,
        "Existe saldo pendiente. Registra el cobro antes de entregar.",
      );
      const deliveryStart = s.ledger.length;
      for (const x of balances(s).filter(
        (x) => x.owner === o.id && ["custody", "scrap"].includes(x.account),
      ))
        move(
          s,
          a,
          x.account,
          "cliente",
          x.mg,
          x.metal,
          x.purity,
          x.owner,
          o.code,
          "Devolución de pieza / sobrantes del cliente",
        );
      for (let ownIndex = 0; ownIndex < o.allocations.length; ownIndex++) {
        if (o.allocations[ownIndex].owner !== "taller") continue;
        const item = PM.identity(o,o.allocations[ownIndex]);
        move(
          s,
          a,
          "finished",
          "cliente",
          o.returned.pieces[ownIndex],
          item.metal,
          item.purity,
          "taller",
          o.code,
          "Metal propio vendido en pieza",
        );
      }
      o.deliveryLedgerIds = s.ledger.slice(deliveryStart).map(x=>x.id);
      o.status = "delivered";
      o.deliveredAt = now();
      o.invoice = seq(s, "sale", "V");
      o.acceptance = str(b.acceptance, "Recibido por / documento", 250);
      timeline(
        o,
        a,
        "Entregada a " + o.acceptance + ". Comprobante " + o.invoice + ".",
      );
      return o;
    }
    case "order.cancel": {
      permit(a, "orders");
      const o = get(s, "orders", b.id);
      assert(
        o.status === "received" && !paid(s, o),
        "Solo se anulan órdenes sin producción ni pagos.",
      );
      assert(
        !o.materialUsage.some(x=>!x.reversedAt),
        "La orden ya tiene insumos consumidos y actividad de producción; revisa sus consumos antes de anular.",
      );
      const reason = str(b.reason, "Motivo de anulación", 1000);
      if (o.receivedMg)
        move(
          s,
          a,
          "custody",
          "cliente",
          o.receivedMg,
          o.metal,
          o.purity,
          o.id,
          o.code,
          "Custodia devuelta al anular",
        );
      o.status = "cancelled";
      timeline(o, a, "Anulada y custodia devuelta: " + reason);
      s.reversals??=[];
      s.reversals.push({id:id(),type:"order",targetId:o.id,at:now(),actor:a.name,reason,reference:str(b.reference,"Soporte de devolución",200,false),summary:"Orden "+o.code+" anulada sin producción ni saldo abonado; custodia devuelta."});
      return o;
    }
    case "payment.create": {
      permit(a, "payments");
      const o = get(s, "orders", b.orderId);
      assert(
        !["delivered", "cancelled"].includes(o.status),
        "La orden está cerrada.",
      );
      assert(
        o.type !== "Producción propia",
        "La producción propia no recibe cobros de clientes.",
      );
      const shift = openShift(s);
      const cashValue = money(b.cash ?? 0, "Efectivo"),
        bank = money(b.bank ?? 0, "Transferencia"),
        weight = grams(b.goldWeight ?? 0, "Metal como pago", true),
        m = metal(b.metal || "oro", s),
        p = purity(b.purity || 750);
      const official = weight ? rate(s, m) : 0,
        r = weight ? money(b.rate ?? official, "Tarifa aplicada") : 0;
      assert(
        !weight || r > 0,
        "La tarifa del metal recibido como pago debe ser mayor que cero.",
      );
      let reason = "";
      if (weight && r !== official) {
        permit(a, "adjust");
        reason = str(b.reason, "Motivo de tarifa especial", 1000);
      }
      const value = metalValue(weight, p, r),
        received = money(cashValue + bank + value, "Total recibido"),
        owed = due(s, o);
      assert(owed > 0, "La orden ya está pagada.");
      assert(received > 0, "Ingresa un pago mayor que cero.");
      if (bank) str(b.bankRef, "Referencia de transferencia", 150);
      const change = Math.max(0, received - owed);
      assert(
        change <= cashExpected(s, shift) + cashValue,
        "No hay efectivo suficiente para dar las vueltas.",
      );
      const x = {
        id: id(),
        code: seq(s, "payment", "P"),
        orderId: o.id,
        shiftId: shift.id,
        at: now(),
        actor: a.name,
        cash: cashValue,
        bank,
        bankRef: str(b.bankRef, "Referencia", 150, false),
        goldMg: weight,
        metal: m,
        purity: p,
        rate: r,
        goldValue: value,
        received,
        change,
        applied: Math.min(received, owed),
        reason,
      };
      cash(
        s,
        a,
        shift,
        cashValue - change,
        "Cobro " + x.code + " / " + o.code,
        o.code,
      );
      move(
        s,
        a,
        "cliente",
        "payment",
        weight,
        m,
        p,
        "taller",
        x.code,
        "Metal recibido como pago; tarifa " + r + " COP/g fino",
      );
      s.payments.push(x);
      timeline(
        o,
        a,
        `Pago ${x.code}: ${x.applied} COP aplicados; vueltas ${change} COP.`,
      );
      return x;
    }
    case "payment.void": {
      permit(a, "adjust");
      const p = get(s, "payments", b.id),
        o = get(s, "orders", p.orderId),
        shift = openShift(s);
      assert(!p.voidedAt && !p.refund, "No se puede anular este comprobante.");
      assert(
        paid(s, o) >= p.applied,
        "Este abono ya tiene devoluciones asociadas; no se puede anular.",
      );
      assert(
        !["delivered", "cancelled"].includes(o.status),
        "La orden está cerrada.",
      );
      assert(
        shift.id === p.shiftId,
        "Solo se anulan cobros del turno original abierto.",
      );
      const reason = str(b.reason, "Motivo y soporte de devolución", 1000);
      move(
        s,
        a,
        "payment",
        "cliente",
        p.goldMg,
        p.metal,
        p.purity,
        "taller",
        p.code,
        "Anulación y devolución física del metal: " + reason,
      );
      cash(s, a, shift, -(p.cash - p.change), "Anulación " + p.code, o.code);
      p.voidedAt = now();
      p.voidedBy = a.name;
      p.voidReason = reason;
      timeline(o, a, "Cobro " + p.code + " anulado. " + reason);
      s.reversals??=[];
      s.reversals.push({id:id(),type:"payment",targetId:p.id,at:p.voidedAt,actor:a.name,reason,reference:str(b.reference,"Soporte de devolución",200,false),summary:"Cobro "+p.code+" anulado en su turno original con devolución de los medios recibidos."});
      return p;
    }
    case "payment.refund": {
      permit(a, "adjust");
      const o = get(s, "orders", b.orderId);
      assert(
        !["delivered", "cancelled"].includes(o.status),
        "La orden está cerrada.",
      );
      const shift = openShift(s),
        cashOut = money(b.cash ?? 0, "Devolución en efectivo"),
        bankOut = money(b.bank ?? 0, "Devolución por transferencia"),
        amount = cashOut + bankOut;
      assert(
        amount > 0 && amount <= paid(s, o),
        "La devolución debe ser mayor que cero y no superar el saldo abonado.",
      );
      const reason = str(b.reason, "Motivo de devolución", 1000),
        bankRef = str(
          b.bankRef,
          "Referencia de transferencia",
          150,
          bankOut > 0,
        );
      cash(s, a, shift, -cashOut, "Devolución anticipo " + o.code, o.code);
      const x = {
        id: id(),
        code: seq(s, "payment", "P"),
        orderId: o.id,
        shiftId: shift.id,
        at: now(),
        actor: a.name,
        cash: -cashOut,
        bank: -bankOut,
        bankRef,
        goldMg: 0,
        metal: o.metal,
        purity: o.purity,
        rate: 0,
        goldValue: 0,
        received: -amount,
        change: 0,
        applied: -amount,
        reason,
        refund: true,
      };
      s.payments.push(x);
      timeline(o, a, `Anticipo devuelto: ${amount} COP. ${reason}`);
      return x;
    }
    case "shift.open": {
      permit(a, "cash");
      assert(!s.shifts.some((x) => !x.closedAt), "Ya hay un turno abierto.");
      const opening = money(b.opening ?? 0, "Base inicial en efectivo");
      const rows = b.openingGold ?? [];
      assert(
        Array.isArray(rows) && rows.length <= 20,
        "La base de oro debe contener como máximo 20 leyes.",
      );
      const seen = new Set();
      const openingGold = rows.map((row) => {
        assert(
          row &&
            (row.metal ?? "oro") === "oro" &&
            (row.source ?? "own") === "own",
          "La base de apertura utiliza oro propio de bodega.",
        );
        const p = purity(row.purity),
          mg = grams(row.weight, "Base de oro");
        assert(
          !seen.has(p),
          "Cada ley de oro debe aparecer una sola vez en la apertura.",
        );
        seen.add(p);
        assert(
          balance(s, "own", "oro", p) >= mg,
          `Oro propio insuficiente en bodega para la ley ${p}. Registra o concilia primero la existencia real en el Libro de metales.`,
        );
        return { metal: "oro", purity: p, mg, fineUg: mg * p, source: "own" };
      });
      const mode =
        b.mode ||
        (openingGold.length ? (opening > 0 ? "mixed" : "gold") : "cash");
      assert(
        ["cash", "gold", "mixed"].includes(mode),
        "Tipo de apertura no válido.",
      );
      assert(
        mode !== "cash" || !openingGold.length,
        "La apertura en efectivo no incluye una base de oro.",
      );
      assert(
        mode !== "gold" || opening === 0,
        "La apertura solo en oro debe tener efectivo inicial en cero.",
      );
      assert(
        mode === "cash" || openingGold.length > 0,
        "Ingresa el gramaje y la ley del oro para abrir este turno.",
      );
      assert(
        mode !== "mixed" || opening > 0,
        "La apertura mixta requiere efectivo y oro mayores que cero.",
      );
      assert(
        !balances(s).some((x) => x.account === "cashGold"),
        "Existe una base de oro de caja pendiente de conciliar.",
      );
      const x = {
        id: id(),
        code: seq(s, "shift", "CJ"),
        openedAt: now(),
        actor: a.name,
        opening,
        openingGold,
        openingMode: mode,
        closedAt: null,
      };
      for (const row of openingGold)
        move(
          s,
          a,
          "own",
          "cashGold",
          row.mg,
          "oro",
          row.purity,
          "taller",
          x.code,
          "Base de apertura trasladada de bodega a caja",
        );
      s.shifts.push(x);
      return x;
    }
    case "cash.entry": {
      permit(a, "cash");
      const shift = openShift(s);
      const value = money(b.amount, "Importe");
      assert(value > 0, "El importe debe ser mayor que cero.");
      assert(
        ["expense", "income"].includes(b.type),
        "Tipo de movimiento inválido.",
      );
      cash(
        s,
        a,
        shift,
        b.type === "expense" ? -value : value,
        str(b.note, "Concepto", 1000),
        "CAJA",
      );
      return shift;
    }
    case "expense.create":
    case "expense.classify": {
      permit(a,"cash");
      const amount=money(b.amount,"Valor del gasto");assert(amount>0,"El gasto debe ser mayor que cero.");
      assert(EXPENSE_CATEGORIES.includes(b.category),"Selecciona una categoría de gasto válida.");
      assert(["cash","bank"].includes(b.method),"Medio de pago inválido.");
      const expenseDate=date(b.expenseDate??day());assert(typeof expenseDate==="string","Fecha del gasto inválida.");assert(expenseDate<=day(),"La fecha del gasto no puede estar en el futuro.");
      const x={id:id(),code:seq(s,"expense","G"),at:now(),actor:a.name,expenseDate,category:b.category,concept:str(b.concept,"Concepto del gasto",1000),beneficiary:str(b.beneficiary,"Pagado a",120,false),reference:str(b.reference,"Soporte / referencia",200,b.method==="bank"),method:b.method,amount,shiftId:null,cashEntryId:null};
      if(action==="expense.classify") {
        const entry=get(s,"cashEntries",b.cashEntryId);
        assert(entry.ref==="CAJA"&&entry.amount<0&&!entry.reversedAt&&!entry.expenseId,"La salida ya está clasificada, reversada o corresponde a otra operación.");
        assert(b.method==="cash"&&amount===-entry.amount,"El medio y el valor deben coincidir con la salida original.");
        x.cashEntryId=entry.id;x.shiftId=entry.shiftId;x.classifiedFromCash=true;entry.expenseId=x.id;
      } else if(x.method==="cash") {
        const shift=openShift(s);
        assert(b.shiftId===undefined||b.shiftId===shift.id,"El turno de caja cambió. Abre nuevamente el formulario y revisa el gasto.",409);
        cash(s,a,shift,-amount,"Gasto "+x.code+" · "+x.concept,x.code);
        const entry=s.cashEntries.at(-1);entry.expenseId=x.id;x.cashEntryId=entry.id;x.shiftId=shift.id;
      }
      s.expenses??=[];s.expenses.push(x);return x;
    }
    case "shift.close": {
      permit(a, "cash");
      const shift = openShift(s);
      assert(
        b.shiftId === undefined || b.shiftId === shift.id,
        "El turno de este formulario ya cambió. Cierra el formulario y revisa el turno actual antes de arquear.",
        409,
      );
      const expected = cashExpected(s, shift),
        counted = money(b.counted, "Efectivo contado");
      const gold = cashMetals(s);
      const counts = b.goldCounts || [];
      assert(
        Array.isArray(counts) &&
          counts.length === gold.length &&
          counts.every((x) => x && typeof x === "object" && !Array.isArray(x)),
        "Debes pesar cada metal y ley de la base inicial y del recaudo de caja.",
      );
      const results = gold.map((x) => {
        const count = counts.find(
          (c) => c.metal === x.metal && Number(c.purity) === x.purity,
        );
        assert(count, "Falta el pesaje de " + x.metal + " " + x.purity);
        return {
          ...x,
          countedMg: grams(count.weight, "Conteo físico de metal", true),
        };
      });
      const discrepancy =
        counted !== expected ||
        results.some(
          (x) => Math.abs(x.countedMg - x.mg) > s.settings.toleranceMg,
        );
      const reason = str(
        b.reason,
        "Justificación de diferencias",
        2000,
        discrepancy,
      );
      if (discrepancy) permit(a, "adjust");
      str(
        b.receiver,
        "Responsable que recibe el metal en bodega",
        150,
        results.length > 0,
      );
      // Los faltantes no se ocultan con ajustes automáticos: el acta conserva lo esperado y lo contado.
      for (const x of results) {
        assert(x.countedMg === x.mg || reason, "Justifica la diferencia.");
        if (x.countedMg !== x.mg) {
          const delta = x.countedMg - x.mg;
          if (delta > 0)
            move(
              s,
              a,
              "ajuste",
              "cashGold",
              delta,
              x.metal,
              x.purity,
              "taller",
              shift.code,
              reason,
            );
          else {
            let missing = -delta;
            for (const account of ["payment", "cashGold"]) {
              const taken = Math.min(
                missing,
                balance(s, account, x.metal, x.purity),
              );
              move(
                s,
                a,
                account,
                "diferencia",
                taken,
                x.metal,
                x.purity,
                "taller",
                shift.code,
                reason,
              );
              missing -= taken;
            }
            assert(missing === 0, "No se pudo conciliar el faltante de metal.");
          }
        }
        for (const account of ["cashGold", "payment"])
          move(
            s,
            a,
            account,
            "own",
            balance(s, account, x.metal, x.purity),
            x.metal,
            x.purity,
            "taller",
            shift.code,
            "Cierre y traspaso a bodega; recibe " + b.receiver,
          );
      }
      Object.assign(shift, {
        closedAt: now(),
        closedBy: a.name,
        expected,
        counted,
        difference: counted - expected,
        goldCounts: results,
        reason,
        receiver: b.receiver || "",
        review: discrepancy,
      });
      return shift;
    }
    case "inventory.transfer": {
      permit(a, "inventory");
      assert(
        ["own", "melt", "scrap"].includes(b.from) &&
          ["own", "melt", "scrap"].includes(b.to),
        "Solo se trasladan saldos propios de bodega, fundido y limalla.",
      );
      const mg = grams(b.weight),
        m = metal(b.metal, s),
        p = purity(b.purity);
      move(
        s,
        a,
        b.from,
        b.to,
        mg,
        m,
        p,
        "taller",
        "TRASLADO",
        str(b.reason, "Motivo", 1000),
      );
      return { mg };
    }
    case "inventory.adjust": {
      permit(a, "adjust");
      assert(
        ["own", "melt", "scrap"].includes(b.account),
        "Los saldos ligados a clientes, mesas y caja se gestionan en su orden o turno.",
      );
      const m = metal(b.metal, s),
        p = purity(b.purity),
        expected = balance(s, b.account, m, p),
        counted = grams(b.weight, "Peso contado", true),
        diff = counted - expected,
        reason = str(b.reason, "Justificación obligatoria", 2000);
      move(
        s,
        a,
        diff >= 0 ? "ajuste" : b.account,
        diff >= 0 ? b.account : "diferencia",
        Math.abs(diff),
        m,
        p,
        "taller",
        "CONCILIACIÓN",
        reason,
      );
      const x = {
        id: id(),
        at: now(),
        actor: a.name,
        account: b.account,
        metal: m,
        purity: p,
        expectedMg: expected,
        countedMg: counted,
        differenceMg: diff,
        reason,
        review: diff !== 0,
      };
      s.reconciliations.push(x);
      return x;
    }
    case "purchase.create": {
      permit(a, "purchases");
      get(s, "suppliers", b.supplierId);
      let items, m, p, mg, unit, value;
      if(b.items!==undefined){
        assert(Array.isArray(b.items)&&b.items.length>0&&b.items.length<=50,"Añade entre una y 50 categorías a la orden de compra.");
        const categories=s.settings.goldCategories||defaultGoldCategories();
        items=b.items.map(input=>{
          assert(input&&typeof input==="object","Detalle de compra inválido.");
          const category=categories.find(x=>x.id===input.categoryId);
          assert(category&&category.active,"La categoría de oro no existe o está inactiva. Actualiza la orden.");
          const weight=grams(input.weight),price=money(input.unitPrice,"Precio por gramo de la categoría");
          assert(price>0,"El precio por gramo debe ser mayor a cero.");
          let total;try{total=Numbers.weightPrice(weight,price);}catch(error){fail(error.message);}
          assert(total>0,"El valor de cada categoría debe ser al menos un peso.");
          return {categoryId:category.id,categoryName:category.name,metal:"oro",purity:category.purity,mg:weight,unitPrice:price,total};
        });
        m="oro";p=items[0].purity;mg=items.reduce((sum,x)=>sum+x.mg,0);unit=items[0].unitPrice;
        assert(mg<=1000000000,"El peso total de la compra no puede superar 1.000.000 g.");
        value=money(items.reduce((sum,x)=>sum+x.total,0),"Total de la orden de compra");
      }else{
        m=metal(b.metal,s);p=purity(b.purity);mg=grams(b.weight);unit=money(b.rate,"Precio por gramo fino");
        assert(unit>0,"El precio debe ser mayor a cero.");value=metalValue(mg,p,unit);
      }
      const x = {
        id: id(),
        code: seq(s, "purchase", "CP"),
        at: now(),
        supplierId: b.supplierId,
        document: str(b.document, "Documento de compra", 100),
        metal: m,
        purity: p,
        mg,
        rate: unit,
        total: value,
        dueDate: date(b.dueDate),
        actor: a.name,
      };
      if(items){x.items=items;x.priceBasis="gross";}
      assert(
        !s.purchases.some(
          (y) => !y.reversedAt && y.supplierId === x.supplierId && y.document === x.document,
        ),
        "Este documento de compra ya fue registrado.",
      );
      for(const item of items||[{metal:m,purity:p,mg}])
        move(s,a,"proveedor","own",item.mg,item.metal,item.purity,"taller",x.code,"Compra "+x.document+(item.categoryName?" · "+item.categoryName:""));
      s.purchases.push(x);
      return x;
    }
    case "supplier.pay": {
      permit(a, "purchases");
      assert(!get(s,"purchases",b.id).reversedAt,"La compra está reversada.");
      const p = get(s, "purchases", b.id),
        pending =
          p.total -
          s.supplierPayments
            .filter((x) => x.purchaseId === p.id && !x.reversedAt)
            .reduce((v, x) => v + x.amount, 0),
        amount = money(b.amount, "Pago a proveedor");
      assert(
        amount > 0 && amount <= pending,
        "El pago supera el saldo o es cero.",
      );
      assert(["cash", "bank"].includes(b.method), "Medio de pago inválido.");
      const ref = str(b.reference, "Referencia / comprobante", 200);
      let shiftId = null;
      if (b.method === "cash") {
        const shift = openShift(s);
        shiftId = shift.id;
        cash(s, a, shift, -amount, "Pago proveedor " + p.code, p.code);
      }
      const x = {
        id: id(),
        at: now(),
        actor: a.name,
        purchaseId: p.id,
        amount,
        method: b.method,
        reference: ref,
        shiftId,
      };
      s.supplierPayments.push(x);
      return x;
    }
    case "melt.create": {
      permit(a, "inventory");
      const m = metal(b.metal, s),
        source = b.source || "own";
      assert(["own", "scrap", "melt"].includes(source), "Origen no válido.");
      const p = purity(b.inputPurity),
        target = purity(b.outputPurity),
        input = grams(b.inputWeight),
        output = grams(b.outputWeight),
        alloy = grams(b.alloyWeight ?? 0, "Liga sin metal precioso", true);
      assert(output <= input + alloy, "La salida supera la carga total.");
      assert(
        output * target <= input * p,
        "La salida contiene más metal fino que la entrada. Revisa las leyes y pesos.",
      );
      const x = {
        id: id(),
        code: seq(s, "melt", "F"),
        at: now(),
        actor: a.name,
        metal: m,
        inputMg: input,
        inputPurity: p,
        alloyMg: alloy,
        outputMg: output,
        outputPurity: target,
        lossMg: input + alloy - output,
        fineLossUg: input * p - output * target,
        notes: str(b.notes, "Ensayo / observaciones", 2000),
      };
      move(
        s,
        a,
        source,
        "crisol",
        input,
        m,
        p,
        "taller",
        x.code,
        "Carga de fundición",
      );
      move(
        s,
        a,
        "crisol",
        "melt",
        output,
        m,
        target,
        "taller",
        x.code,
        "Salida ensayada; " + x.notes,
      );
      s.melts.push(x);
      return x;
    }
    case "material.save": {
      permit(a, "inventory");
      const x = {
        id: id(),
        name: str(b.name, "Insumo / piedra", 160),
        unit: str(b.unit, "Unidad", 30),
        quantity: materialQuantity(b.quantity, "Existencia"),
        unitCost: money(b.unitCost, "Costo unitario"),
        min: materialQuantity(b.min ?? 0, "Mínimo"),
      };
      s.materials.push(x);
      s.materialMoves.push({
        id: id(),
        at: now(),
        actor: a.name,
        materialId: x.id,
        quantity: x.quantity,
        note: "Existencia inicial",
      });
      return x;
    }
    case "material.restock": {
      permit(a, "inventory");
      const x = get(s, "materials", b.id),
        qty = materialQuantity(b.quantity, "Cantidad", 0.001);
      const previousUnitCost = x.unitCost;
      x.quantity = materialQuantity(
        Number((x.quantity + qty).toFixed(6)),
        "Existencia resultante",
      );
      x.unitCost = money(b.unitCost, "Costo unitario");
      s.materialMoves.push({
        id: id(),
        at: now(),
        actor: a.name,
        materialId: x.id,
        quantity: qty,
        previousUnitCost,
        unitCostAfter: x.unitCost,
        note: str(b.note, "Soporte de entrada", 1000),
      });
      return x;
    }
    case "material.use": {
      permit(a, "production");
      const o = get(s, "orders", b.orderId),
        m = get(s, "materials", b.materialId);
      assert(
        ["received", "in_progress"].includes(o.status),
        "Solo se consumen insumos antes del retorno.",
      );
      const qty = materialQuantity(b.quantity, "Cantidad", 0.001);
      assert(qty <= m.quantity, "Insumo insuficiente.");
      const microUnits=BigInt(Math.round(qty*1000000));
      const cost = money(Number((microUnits*BigInt(m.unitCost)+500000n)/1000000n), "Costo de insumos");
      m.quantity = Number((m.quantity - qty).toFixed(6));
      const x = {
        id: id(),
        at: now(),
        materialId: m.id,
        name: m.name,
        quantity: qty,
        unit: m.unit,
        cost,
      };
      o.materialUsage.push(x);
      s.materialMoves.push({
        ...x,
        actor: a.name,
        quantity: -qty,
        orderId: o.id,
        note: o.code,
      });
      timeline(o, a, "Consumo de " + qty + " " + m.unit + " de " + m.name);
      return x;
    }
    case "stock.receive": {
      permit(a, "production");
      const o = get(s, "orders", b.id);
      assert(
        o.type === "Producción propia" && o.status === "ready",
        "Debe ser una producción propia aprobada en calidad.",
      );
      const qty = num(b.quantity, "Unidades", 1, 10000);
      assert(
        Number.isInteger(qty) && qty <= o.returned.pieceMg,
        "Unidades enteras; cada pieza debe pesar al menos 0,001 g.",
      );
      const cost = money(b.cost, "Costo total de producción"),
        price = money(b.price, "Precio sugerido");
      const x = {
        id: id(),
        sku: seq(s, "stock", "JOY"),
        orderId: o.id,
        description: o.description,
        quantity: qty,
        available: qty,
        mg: o.returned.pieceMg,
        metal: o.metal,
        purity: o.purity,
        cost,
        price,
        at: now(),
        transfers: [],
      };
      const components=PM.pieces(o);
      if(components.length>1 || components[0]?.metal!==x.metal || components[0]?.purity!==x.purity)
        x.components=components.map(item=>({...item,remainingMg:item.mg}));
      s.stock.push(x);
      o.status = "delivered";
      o.deliveredAt = now();
      o.stockId = x.id;
      timeline(o, a, "Producción recibida en inventario de piezas: " + x.sku);
      return x;
    }
    case "stock.transfer": {
      permit(a, "inventory");
      const x = get(s, "stock", b.id);
      assert(!x.reversedAt,"El ingreso de este lote está reversado.");
      const quantity = num(b.quantity, "Unidades", 1, x.available);
      assert(Number.isInteger(quantity), "Unidades enteras.");
      const mg = grams(b.weight, "Peso de las piezas a transferir");
      let components;
      if(x.components){
        const inputs=b.components ?? (quantity===x.available?x.components.map(item=>({...item,weight:item.remainingMg/1000})):null);
        assert(Array.isArray(inputs)&&inputs.length===x.components.length,"Registra el peso transferido de cada metal del lote.");
        assert(new Set(inputs.map(item=>PM.key(item))).size===inputs.length,"Metal de transferencia duplicado.");
        components=x.components.map(item=>{
          const input=inputs.find(row=>PM.key(row)===PM.key(item));assert(input,"Falta un metal del lote.");
          const weight=grams(input.weight,"Peso transferido por metal",true);
          assert(weight<=item.remainingMg&&(quantity!==x.available||weight===item.remainingMg),"El peso transferido supera o no coincide con el saldo de un metal.");
          return {metal:item.metal,purity:item.purity,mg:weight};
        });
        assert(components.reduce((sum,item)=>sum+item.mg,0)===mg,"Los pesos de los metales no coinciden con el peso de la transferencia.");
      }
      assert(
        quantity !== x.available || mg === (x.remainingMg ?? x.mg),
        "El peso contado de las últimas piezas debe coincidir con el saldo disponible. Revisa el pesaje antes de transferir.",
      );
      assert(
        mg >= quantity &&
          (x.remainingMg ?? x.mg) - mg >= x.available - quantity,
        "El peso debe corresponder a las unidades transferidas y conservar peso para las restantes.",
      );
      const transferCost =
        quantity === x.available
          ? (x.remainingCost ?? x.cost)
          : Number((BigInt(x.remainingCost??x.cost)*BigInt(quantity)*2n+BigInt(x.available))/(2n*BigInt(x.available)));
      x.remainingCost = (x.remainingCost ?? x.cost) - transferCost;
      const ref = seq(s, "stockTransfer", "TR");
      const destination=str(b.destination,"Destino y responsable",250);
      for(const item of components||[{metal:x.metal,purity:x.purity,mg}])
        move(s,a,"finished","minorista",item.mg,item.metal,item.purity,"taller",ref,destination);
      if(components)x.components.forEach((item,index)=>{item.remainingMg-=components[index].mg;});
      x.available -= quantity;
      x.remainingMg = (x.remainingMg ?? x.mg) - mg;
      assert(
        x.available > 0 || x.remainingMg === 0,
        "Debe transferirse todo el peso al retirar la última unidad.",
      );
      const transfer = {
        id: id(),
        code: ref,
        at: now(),
        actor: a.name,
        quantity,
        mg,
        cost: transferCost,
        destination: b.destination,
      };
      if(components)transfer.components=components;
      x.transfers.push(transfer);
      return { ...transfer, sku: x.sku, price: x.price };
    }
    case "smith.settle": {
      permit(a, "cash");
      const smith = get(s, "smiths", b.smithId);
      const orders = s.orders.filter(
        (o) =>
          o.smithId === smith.id &&
          o.returned &&
          !s.settlements.some((x) => !x.reversedAt && x.orderIds.includes(o.id)),
      );
      assert(orders.length, "No hay honorarios pendientes de liquidación.");
      const amount = money(orders.reduce((v, o) => v + o.smithFee, 0),"Total de honorarios");
      assert(amount > 0, "Los honorarios asignados son cero.");
      const method = b.method;
      assert(["cash", "bank"].includes(method), "Medio inválido.");
      const reference = str(b.reference, "Soporte de pago", 200);
      if (method === "cash")
        cash(
          s,
          a,
          openShift(s),
          -amount,
          "Liquidación orfebre " + smith.name,
          "ORFEBRE",
        );
      const x = {
        id: id(),
        at: now(),
        actor: a.name,
        smithId: smith.id,
        orderIds: orders.map((o) => o.id),
        amount,
        method,
        reference,
      };
      s.settlements.push(x);
      return x;
    }
    case "settings.save": {
      permit(a, "settings");
      const reason = str(b.reason, "Motivo de actualización", 1000);
      const lossNormal = num(b.lossNormal, "Merma normal %", 0, 100),
        lossWarning = num(b.lossWarning, "Merma crítica %", lossNormal, 100);
      const taxPercent = num(b.taxPercent,"Impuesto %",0,100);
      taxAmount(0,taxPercent);
      Object.assign(s.settings, {
        name: str(b.name, "Nombre del taller", 160),
        nit: str(b.nit, "NIT", 60, false),
        phone: str(b.phone, "Teléfono", 50, false),
        address: str(b.address, "Dirección", 250, false),
        rate: {
          ...s.settings.rate,
          oro: money(b.goldRate, "Tarifa oro"),
          plata: money(b.silverRate, "Tarifa plata"),
          platino: money(b.platinumRate, "Tarifa platino"),
        },
        taxPercent,
        lossNormal,
        lossWarning,
        toleranceMg: grams(b.tolerance, "Tolerancia", true),
        printWidth: Number(b.printWidth) === 58 ? 58 : 80,
        baudRate: num(b.baudRate, "Baudios", 300, 115200),
        warranty: str(
          b.warranty,
          "Condiciones de custodia / garantía",
          4000,
          false,
        ),
        updatedAt: now(),
        updatedBy: a.name,
        reason,
      });
      return s.settings;
    }
    default:
      fail("Acción desconocida.", 404);
  }
}
function validateState(s) {
  assert(
    s && typeof s === "object" && s.version === 1,
    "Base de datos no compatible.",
  );
  for (const [key, value] of Object.entries(initialState())) {
    assert(
      Object.hasOwn(s, key) &&
        (Array.isArray(value)
          ? Array.isArray(s[key])
          : value && typeof value === "object"
            ? s[key] !== null && typeof s[key] === "object" && !Array.isArray(s[key])
            : typeof s[key] === typeof value),
      "Estructura de datos inválida: " + key,
    );
    if (Array.isArray(value)) {
      const ids = new Set();
      for (const row of s[key]) {
        assert(
          row && typeof row.id === "string" && !ids.has(row.id),
          "Identificadores inválidos en " + key,
        );
        ids.add(row.id);
      }
    }
  }
  assert(s.settings.rate&&typeof s.settings.rate==="object"&&!Array.isArray(s.settings.rate),"Tarifas de metales inválidas.");
  assert(Object.values(s.counters).every(x=>Number.isSafeInteger(x)&&x>=0),"Contadores de comprobantes inválidos.");
  if (s.settings.goldCategories !== undefined) {
    const categories = s.settings.goldCategories;
    assert(Array.isArray(categories) && categories.length <= 200, "Catálogo de categorías inválido.");
    const categoryIds = new Set(), names = new Set();
    for (const x of categories) {
      assert(x && typeof x.id === "string" && x.id.length > 0 && !categoryIds.has(x.id), "Identificador de categoría inválido.");
      const name = str(x.name, "Nombre de la categoría", 80).toLocaleLowerCase("es-CO");
      assert(!names.has(name) && typeof x.active === "boolean", "Categoría duplicada o estado inválido.");
      purity(x.purity);
      categoryIds.add(x.id);
      names.add(name);
    }
  }
  if(s.reversals!==undefined) {
    assert(Array.isArray(s.reversals),"Historial de reversiones inválido.");
    const keys=new Set();
    for(const r of s.reversals) {
      assert(r&&typeof r.id==="string"&&!keys.has(r.id)&&typeof r.type==="string"&&typeof r.targetId==="string"&&typeof r.actor==="string"&&typeof r.summary==="string"&&Number.isFinite(Date.parse(r.at)),"Registro de reversión inválido.");
      str(r.reason,"Motivo de reversión",1000);keys.add(r.id);
    }
  }
  const ids = (collection) => new Set(s[collection].map((x) => x.id));
  const expensesByEntry = new Map();
  if(s.expenses!==undefined) {
    assert(Array.isArray(s.expenses),"Historial de gastos inválido.");
    const keys=new Set(),entries=new Set(),codes=new Set();
    for(const x of s.expenses) {
      assert(x&&typeof x.id==="string"&&x.id.length>0&&!keys.has(x.id)&&typeof x.code==="string"&&x.code.length>0&&!codes.has(x.code)&&typeof x.actor==="string"&&Number.isFinite(Date.parse(x.at)),"Registro de gasto inválido.");
      keys.add(x.id);codes.add(x.code);assert(typeof x.expenseDate==="string","Fecha del gasto inválida.");date(x.expenseDate);str(x.concept,"Concepto del gasto",1000);str(x.beneficiary,"Pagado a",120,false);str(x.reference,"Soporte del gasto",200,x.method==="bank");
      assert(EXPENSE_CATEGORIES.includes(x.category)&&["cash","bank"].includes(x.method),"Categoría o medio del gasto inválido.");money(x.amount,"Valor del gasto");assert(x.amount>0,"Gasto sin valor.");
      if(x.method==="cash") {
        const entry=s.cashEntries.find(e=>e.id===x.cashEntryId);
        assert(entry&&!entries.has(entry.id)&&entry.expenseId===x.id&&entry.amount===-x.amount&&entry.shiftId===x.shiftId&&(entry.ref===x.code||(x.classifiedFromCash===true&&entry.ref==="CAJA"))&&!!entry.reversedAt===!!x.reversedAt,"El gasto no concilia con su salida de caja.");
        entries.add(entry.id);
        expensesByEntry.set(entry.id,x);
      } else assert(x.cashEntryId===null&&x.shiftId===null,"Un gasto bancario no debe descontar caja.");
    }
  }
  const clients = ids("clients"),
    orders = ids("orders"),
    smiths = ids("smiths"),
    shifts = ids("shifts"),
    materials = ids("materials"),
    purchases = ids("purchases"),
    suppliers = ids("suppliers");
  assert(
    Number.isSafeInteger(s.revision) && s.revision >= 0,
    "Revisión inválida.",
  );
  if(s.lastRestoreRevision!==undefined)assert(Number.isSafeInteger(s.lastRestoreRevision)&&s.lastRestoreRevision>0&&s.lastRestoreRevision<=s.revision,"Marca de restauración inválida.");
  assert(
    s.shifts.filter((x) => !x.closedAt).length <= 1,
    "Hay varios turnos abiertos.",
  );
  for (const shift of s.shifts) {
    money(shift.opening, "Base inicial de efectivo");
    if (shift.openingGold !== undefined) {
      assert(Array.isArray(shift.openingGold), "Base inicial de oro inválida.");
      const laws = new Set();
      for (const x of shift.openingGold) {
        assert(
          x.metal === "oro" &&
            Number.isSafeInteger(x.mg) &&
            x.mg > 0 &&
            !laws.has(x.purity),
          "Base de oro inválida o repetida.",
        );
        purity(x.purity);
        assert(
          x.fineUg === x.mg * x.purity,
          "Fino de la base de oro inválido.",
        );
        laws.add(x.purity);
      }
    }
    if (shift.openingMode !== undefined)
      assert(
        ["cash", "gold", "mixed"].includes(shift.openingMode),
        "Tipo de apertura inválido.",
      );
  }
  for (const x of s.ledger) {
    assert(
      Number.isSafeInteger(x.mg) &&
        x.mg > 0 &&
        Number.isInteger(x.purity) &&
        x.purity > 0 &&
        x.purity <= 1000,
      "Peso o ley inválidos en el libro.",
    );
    metal(x.metal, s);
    assert(
      x.fineUg === x.mg * x.purity,
      "El fino del libro no corresponde al peso y la ley.",
    );
    assert(
      x.owner === "taller" || orders.has(x.owner),
      "Propietario de metal inexistente.",
    );
  }
  assert(
    balances(s).every((x) => Number.isSafeInteger(x.mg) && x.mg >= 0),
    "La base contiene existencias negativas.",
  );
  for (const o of s.orders) {
    assert(
      clients.has(o.clientId) && (!o.smithId || smiths.has(o.smithId)),
      "Cliente u orfebre inexistente en una orden.",
    );
    assert(
      [
        "received",
        "in_progress",
        "quality",
        "ready",
        "delivered",
        "cancelled",
      ].includes(o.status),
      "Estado de orden inválido.",
    );
    for (const key of [
      "labor",
      "materialPrice",
      "goldPrice",
      "tax",
      "smithFee",
    ])
      money(o[key], "Valor de orden");
    money(total(o), "Presupuesto total");
    if (o.orderMetals !== undefined) {
      const items = orderMetalItems(o.orderMetals);
      assert(items.reduce((v,x)=>v+x.price,0) <= o.goldPrice, "Detalle de metales incompatible con el presupuesto.");
    }
    if (o.laborEstimate !== undefined) {
      let calculated;
      try { calculated = Labor.calculate(o.laborEstimate); }
      catch (e) { fail(e.message); }
      for (const key of Object.keys(calculated))
        assert(o.laborEstimate[key] === calculated[key], "Estimado de mano de obra inválido.");
    }
    assert(
      paid(s, o) >= 0 && due(s, o) >= 0,
      "Abonos incompatibles con el presupuesto.",
    );
    assert(
      Array.isArray(o.history) &&
        Array.isArray(o.allocations) &&
        Array.isArray(o.materialUsage),
      "Ficha de orden incompleta.",
    );
    for (const event of o.history)
      assert(
        event &&
          typeof event.text === "string" &&
          typeof event.actor === "string" &&
          typeof event.at === "string" &&
          Number.isFinite(Date.parse(event.at)),
        "Historial de orden inválido.",
      );
    const allocationKeys = new Set();
    for (const allocation of o.allocations) {
      assert(
        allocation && (allocation.owner === o.id || allocation.owner === "taller") &&
          Number.isSafeInteger(allocation.mg) &&
          allocation.mg > 0,
        "Aporte de metal inválido.",
      );
      const item=PM.identity(o,allocation), key=allocation.owner+PM.key(item);
      metal(item.metal,s);purity(item.purity);
      assert(!allocationKeys.has(key),"Aporte de metal duplicado.");allocationKeys.add(key);
      if(allocation.owner===o.id)assert(item.metal===o.metal&&item.purity===o.purity,"La custodia no corresponde al metal del cliente.");
      if(allocation.rateSnapshot!==undefined)money(allocation.rateSnapshot,"Tarifa histórica del aporte");
    }
    if (o.returned) {
      const r = o.returned,
        base = o.allocations.reduce((v, x) => v + x.mg, 0);
      assert(
        [r.pieceMg, r.scrapMg, r.lossMg].every(
          (x) => Number.isSafeInteger(x) && x >= 0,
        ) && r.pieceMg + r.scrapMg + r.lossMg === base,
        "El retorno no conserva el peso entregado.",
      );
      assert(
        Array.isArray(r.pieces) &&
          Array.isArray(r.scraps) &&
          r.pieces.length === o.allocations.length &&
          r.scraps.length === o.allocations.length,
        "Distribución de retorno inválida.",
      );
      assert(r.pieces.every((x,i)=>Number.isSafeInteger(x)&&x>=0&&Number.isSafeInteger(r.scraps[i])&&r.scraps[i]>=0&&x+r.scraps[i]<=o.allocations[i].mg)&&r.pieces.reduce((sum,x)=>sum+x,0)===r.pieceMg&&r.scraps.reduce((sum,x)=>sum+x,0)===r.scrapMg,"Los pesajes por metal no concilian con el retorno.");
      if(r.maxPercent!==undefined){
        const expected=Math.max(...PM.groups(o).map(group=>(group.mg-group.indexes.reduce((sum,i)=>sum+r.pieces[i]+r.scraps[i],0))*100/group.mg));
        assert(Number.isFinite(r.maxPercent)&&Math.abs(expected-r.maxPercent)<1e-9,"Merma por metal inválida.");
      }
    }
  }
  for (const p of s.payments) {
    assert(
      orders.has(p.orderId) && shifts.has(p.shiftId),
      "Cobro sin orden o turno válido.",
    );
    assert(
      Number.isSafeInteger(p.applied) &&
        (p.refund ? p.applied < 0 : p.applied >= 0),
      "Importe de cobro inválido.",
    );
  }
  for (const m of s.materials) {
    assert(
      Number.isFinite(m.quantity) && m.quantity >= 0,
      "Existencia de insumo inválida.",
    );
    money(m.unitCost,"Costo unitario de insumo");
  }
  for (const x of s.materialMoves)
    assert(materials.has(x.materialId), "Movimiento de insumo inexistente.");
  for (const p of s.purchases) {
    assert(suppliers.has(p.supplierId), "Compra sin proveedor.");
    money(p.total, "Total de compra");
    if(p.items!==undefined){
      assert(Array.isArray(p.items)&&p.items.length>0&&p.items.length<=50&&p.priceBasis==="gross"&&p.metal==="oro","Detalle de orden de compra inválido.");
      for(const item of p.items){
        assert(item&&item.metal==="oro"&&typeof item.categoryId==="string"&&item.categoryId.length>0&&item.categoryId.length<=100,"Categoría de compra inválida.");
        str(item.categoryName,"Categoría histórica",80);purity(item.purity);money(item.unitPrice,"Precio por gramo");
        assert(Number.isSafeInteger(item.mg)&&item.mg>0&&item.mg<=1000000000&&item.unitPrice>0,"Peso o precio de compra inválido.");
        let calculated;try{calculated=Numbers.weightPrice(item.mg,item.unitPrice);}catch(error){fail(error.message);}
        assert(calculated===item.total&&item.total>0,"El importe por categoría no corresponde al peso y precio.");
      }
      assert(Number.isSafeInteger(p.mg)&&p.mg<=1000000000&&p.items.reduce((sum,item)=>sum+item.mg,0)===p.mg&&p.items.reduce((sum,item)=>sum+item.total,0)===p.total&&p.purity===p.items[0].purity&&p.rate===p.items[0].unitPrice,"Los detalles no concilian con el total de compra.");
    }
    assert(
      s.supplierPayments
        .filter((x) => x.purchaseId === p.id && !x.reversedAt)
        .reduce((v, x) => v + x.amount, 0) <= p.total,
      "Pagos superiores a la compra.",
    );
  }
  for (const p of s.supplierPayments)
    assert(purchases.has(p.purchaseId), "Pago de compra inexistente.");
  for (const x of s.cashEntries) {
    assert(
      shifts.has(x.shiftId) && Number.isSafeInteger(x.amount),
      "Movimiento de caja inválido.",
    );
    if(x.expenseId!==undefined)assert(expensesByEntry.get(x.id)?.id===x.expenseId,"Salida de caja sin su gasto correspondiente.");
  }
  const transferIds=new Set();
  for (const x of s.stock) {
    assert(
      orders.has(x.orderId) &&
        Number.isInteger(x.available) &&
        x.available >= 0 &&
        x.available <= x.quantity &&
        Number.isSafeInteger(x.remainingMg ?? x.mg) &&
        (x.remainingMg ?? x.mg) >= 0,
      "Existencia de piezas inválida.",
    );
    assert(Number.isSafeInteger(x.quantity)&&x.quantity>0&&Number.isSafeInteger(x.mg)&&x.mg>=x.quantity&&Array.isArray(x.transfers),"Lote de piezas inválido.");
    money(x.cost,"Costo del lote");money(x.price,"Precio de pieza");money(x.remainingCost??x.cost,"Costo disponible del lote");
    for(const t of x.transfers) {
      assert(t&&typeof t.id==="string"&&!transferIds.has(t.id)&&Number.isSafeInteger(t.quantity)&&t.quantity>0&&Number.isSafeInteger(t.mg)&&t.mg>=t.quantity,"Transferencia de piezas inválida.");
      transferIds.add(t.id);money(t.cost,"Costo de transferencia");
    }
    const active=x.transfers.filter(t=>!t.reversedAt);
    if(x.components!==undefined){
      assert(Array.isArray(x.components)&&x.components.length>0&&x.components.length<=100,"Composición del lote inválida.");
      const keys=new Set();
      for(const item of x.components){
        assert(item&&typeof item==="object","Composición del lote inválida.");
        metal(item.metal,s);purity(item.purity);
        assert(!keys.has(PM.key(item))&&Number.isSafeInteger(item.mg)&&item.mg>0&&Number.isSafeInteger(item.remainingMg)&&item.remainingMg>=0&&item.remainingMg<=item.mg,"Saldo por metal del lote inválido.");keys.add(PM.key(item));
      }
      assert(x.components.reduce((sum,item)=>sum+item.mg,0)===x.mg&&x.components.reduce((sum,item)=>sum+item.remainingMg,0)===(x.remainingMg??x.mg),"El peso del lote no concilia por metal.");
      for(const t of x.transfers){
        assert(Array.isArray(t.components)&&t.components.length===keys.size&&new Set(t.components.map(item=>PM.key(item))).size===keys.size&&t.components.every(item=>keys.has(PM.key(item))&&Number.isSafeInteger(item.mg)&&item.mg>=0)&&t.components.reduce((sum,item)=>sum+item.mg,0)===t.mg,"Composición de transferencia inválida.");
      }
      for(const item of x.components)assert(x.reversedAt?item.remainingMg===0:item.remainingMg+active.reduce((sum,t)=>sum+t.components.find(row=>PM.key(row)===PM.key(item)).mg,0)===item.mg,"Las transferencias no concilian con cada metal del lote.");
    }else assert(x.transfers.every(t=>t.components===undefined),"Transferencia con metales ajenos al lote.");
    if(x.reversedAt)assert(x.available===0&&(x.remainingMg??x.mg)===0&&(x.remainingCost??x.cost)===0&&active.length===0,"El lote reversado conserva existencias o transferencias.");
    else assert(x.available+active.reduce((v,t)=>v+t.quantity,0)===x.quantity&&(x.remainingMg??x.mg)+active.reduce((v,t)=>v+t.mg,0)===x.mg&&(x.remainingCost??x.cost)+active.reduce((v,t)=>v+t.cost,0)===x.cost,"Las unidades, el peso o el costo del lote no concilian con sus transferencias.");
  }
  const metals = s.settings.metals || defaultMetals(), metalIds = new Set();
  assert(Array.isArray(metals) && metals.length >= 3 && metals.length <= 100, "Catálogo de metales inválido.");
  for (const x of metals) {
    assert(x && typeof x.name === "string" && typeof x.id === "string" && x.id === metalKey(x.name) && /^[\p{L}\p{N}][\p{L}\p{N} .()-]{0,59}$/u.test(x.id) && !["constructor", "prototype", "__proto__"].includes(x.id) && !metalIds.has(x.id), "Metal duplicado o inválido.");
    metalIds.add(x.id);
    money(s.settings.rate[x.id], "Tarifa de " + x.name);
  }
  assert(defaultMetals().every((x) => metalIds.has(x.id)), "Faltan los metales base del taller.");
  return s;
}
module.exports = {
  EXPENSE_CATEGORIES,
  defaultMetals,
  defaultGoldCategories,
  validateState,
  initialState,
  execute,
  assert,
  fail,
  str,
  money,
  grams,
  id,
  now,
  day,
  total,
  paid,
  due,
  balances,
  balance,
  cashExpected,
  cashMetals,
  ACCOUNTS,
  ROLES,
  permit,
};
