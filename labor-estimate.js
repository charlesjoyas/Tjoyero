(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TallerLabor = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function scaled(value, label, scale, min, max) {
    if (!(["number", "string"].includes(typeof value)) ||
        (typeof value === "string" && !/^\d+(?:\.\d+)?$/.test(value.trim())))
      throw new Error(label + ": ingresa un número válido.");
    const n = Number(value), integer = Math.round(n * scale);
    if (!Number.isFinite(n) || n < min || n > max)
      throw new Error(label + ": fuera de rango.");
    if (!Number.isSafeInteger(integer) || Math.abs(n * scale - integer) > 0.00001)
      throw new Error(label + ": revisa la precisión decimal.");
    return integer;
  }
  function calculate(data) {
    if (!data || typeof data !== "object" || Array.isArray(data) || !["time", "weight"].includes(data.mode))
      throw new Error("Selecciona cálculo por horas o por gramos.");
    const quantity = scaled(data.quantity, "Cantidad estimada", 1000, 0.001, 1000000);
    const rate = scaled(data.rate, "Costo por hora o gramo", 1, 1, 1e12);
    const overhead = scaled(data.overhead ?? 0, "Costos indirectos", 1, 0, 1e12);
    const markup = scaled(data.markup ?? 0, "Recargo sobre costo", 100, 0, 1000);
    const minimum = scaled(data.minimum ?? 0, "Cobro mínimo", 1, 0, 1e12);
    const direct = BigInt(quantity) * BigInt(rate);
    const cost = direct + BigInt(overhead) * 1000n;
    const priced = (cost * BigInt(10000 + markup) + 9999999n) / 10000000n;
    const suggested = priced > BigInt(minimum) ? priced : BigInt(minimum);
    if (suggested > 1000000000000n)
      throw new Error("El estimado supera el máximo permitido de un billón de COP.");
    const baseCost = Number((cost + 999n) / 1000n);
    return {
      mode: data.mode, quantity: quantity / 1000, rate, overhead,
      markup: markup / 100, minimum,
      directCost: Number((direct + 999n) / 1000n),
      baseCost, suggested: Number(suggested),
      difference: Number(suggested) - baseCost,
    };
  }
  return { calculate };
});
