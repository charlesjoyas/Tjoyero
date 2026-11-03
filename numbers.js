(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TallerNumbers = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const cache = new Map();
  function format(value, minimum = 2, maximum = minimum) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    const key = minimum + "|" + maximum;
    if (!cache.has(key))
      cache.set(
        key,
        new Intl.NumberFormat("es-CO", {
          useGrouping: true,
          minimumFractionDigits: minimum,
          maximumFractionDigits: maximum,
        }),
      );
    return cache.get(key).format(Object.is(n, -0) ? 0 : n);
  }
  function parts(value) {
    const text = String(value ?? "")
      .trim()
      .replace(/^\$\s*/, "")
      .replace(/\s*COP$/i, "")
      .trim();
    if (!text) return null;
    const match = text.match(/^([+-]?)(\d+(?:\.\d{3})*)(?:,(\d*))?$/);
    if (!match) return null;
    const integer = match[2].replace(/\./g, "").replace(/^0+(?=\d)/, "");
    return {
      sign: match[1],
      integer,
      fraction: match[3],
      number: Number(
        match[1] +
          integer +
          (match[3] !== undefined ? "." + (match[3] || "0") : ""),
      ),
    };
  }
  function parse(value) {
    const p = parts(value);
    return p && Number.isFinite(p.number) ? p.number : NaN;
  }
  function editing(value, regroup = false) {
    let candidate = String(value ?? "");
    if (regroup && /^[+-]?[\d.]+(?:,\d*)?$/.test(candidate)) {
      const split = candidate.split(",");
      candidate =
        split[0].replace(/\./g, "") + (split.length > 1 ? "," + split[1] : "");
    }
    const p = parts(candidate);
    if (!p) return null;
    return (
      p.sign +
      p.integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".") +
      (p.fraction === undefined ? "" : "," + p.fraction)
    );
  }
  function tax(base, percent) {
    if (!Number.isSafeInteger(base) || base < 0 || base > 1e12)
      throw new Error("El subtotal debe estar entre cero y un billón de COP, en pesos enteros.");
    if (typeof percent !== "number" || !Number.isFinite(percent) || percent < 0 || percent > 100)
      throw new Error("El impuesto debe estar entre 0 y 100 %.");
    const basisPoints = Math.round(percent * 100);
    if (Math.abs(percent * 100 - basisPoints) > 0.000001)
      throw new Error("El impuesto admite hasta 2 decimales.");
    return Number((BigInt(base) * BigInt(basisPoints) + 5000n) / 10000n);
  }
  return { format, parse, editing, tax };
});
