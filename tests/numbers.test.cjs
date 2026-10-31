"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const N = require("../numbers.js");
test("Formato colombiano agrupa miles y muestra decimales sin alterar valores", () => {
  assert.equal(N.format(1234567), "1.234.567,00");
  assert.equal(N.format(0), "0,00");
  assert.equal(N.format(-125000), "-125.000,00");
  assert.equal(N.format(1234.567, 3, 3), "1.234,567");
  assert.equal(N.format(0.000001, 3, 6), "0,000001");
  assert.equal(N.format(750), "750,00");
});
test("Lectura de entradas colombianas conserva gramajes y cantidades exactos", () => {
  for (const [input, expected] of [
    ["1.234.567,00", 1234567],
    ["1234567", 1234567],
    ["1.234,567", 1234.567],
    ["12,400", 12.4],
    ["0,001", 0.001],
    ["1.000", 1000],
    ["750,00", 750],
    ["$ 1.234,00 COP", 1234],
  ])
    assert.equal(N.parse(input), expected, input);
  for (const input of [
    "1,234.56",
    "1..234",
    "12.34",
    "1e3",
    "123abc",
    "NaN",
    "Infinity",
    "",
  ])
    assert(Number.isNaN(N.parse(input)), input);
});
test("Agrupación durante la escritura conserva los decimales que se están digitando", () => {
  assert.equal(N.editing("1234567"), "1.234.567");
  assert.equal(N.editing("1234,5"), "1.234,5");
  assert.equal(N.editing("1234,"), "1.234,");
  assert.equal(N.editing("0,001"), "0,001");
  assert.equal(N.editing("1,234.56"), null);
  assert.equal(N.editing("1.2345", true), "12.345");
  assert.equal(N.editing("1,234.56", true), null);
});
