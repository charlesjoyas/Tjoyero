(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TallerProductionMetals = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const identity = (order, allocation) => ({ metal: allocation.metal ?? order.metal, purity: allocation.purity ?? order.purity });
  const key = value => JSON.stringify([value?.metal, value?.purity]);
  function groups(order) {
    const result = new Map();
    order.allocations.forEach((allocation, index) => {
      const item = identity(order, allocation), id = key(item);
      if (!result.has(id)) result.set(id, { ...item, mg: 0, indexes: [] });
      const group = result.get(id); group.mg += allocation.mg; group.indexes.push(index);
    });
    return [...result.values()];
  }
  function pieces(order) {
    return groups(order).map(group => ({ metal: group.metal, purity: group.purity,
      mg: group.indexes.reduce((sum, index) => sum + (order.returned?.pieces[index] || 0), 0),
    })).filter(group => group.mg > 0);
  }
  const components = stock => stock.components || [{ metal: stock.metal, purity: stock.purity, mg: stock.mg, remainingMg: stock.remainingMg ?? stock.mg }];
  function cost(order) {
    let value = 0n;
    order.allocations.forEach((allocation, index) => {
      if (allocation.owner !== "taller") return;
      const item = identity(order, allocation), used = allocation.mg - (order.returned?.scraps[index] || 0);
      const rate = allocation.rateSnapshot ?? (item.metal === order.metal ? order.rateSnapshot || 0 : 0);
      value += BigInt(used) * BigInt(item.purity) * BigInt(rate);
    });
    return Number((value + 500000n) / 1000000n);
  }
  return { identity, key, groups, pieces, components, cost };
});
