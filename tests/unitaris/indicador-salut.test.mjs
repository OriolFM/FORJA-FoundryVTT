// Indicadors de salut damunt del token (estats/indicador-salut.mjs): funcions pures.
import { test } from "node:test";
import assert from "node:assert/strict";
import { textPenalitzacio, liniesSalut } from "../../module/estats/indicador-salut.mjs";

test("insígnia: penalització positiva, «✕» fora de combat, res sense penalització", () => {
  assert.equal(textPenalitzacio({ penalitzacio: 2 }), "+2");
  assert.equal(textPenalitzacio({ penalitzacio: 4 }), "+4");
  assert.equal(textPenalitzacio({ penalitzacio: 0 }), null);
  assert.equal(textPenalitzacio({ penalitzacio: null, foraDeCombat: true }), "✕");
  assert.equal(textPenalitzacio(null), null);
});

test("resum: nivell de fatiga i de ferides i estats actius", () => {
  const t = (k) => k.split(".").at(-1);
  const salut = { fatiga: { nivellActiu: 1 }, ferides: { nivellActiu: 5 } };
  assert.deepEqual(liniesSalut(salut, new Set(["abatut", "dead"]), t), ["Fatiga 1 · 1", "Ferides 5 · 5", "abatut, mort"]);
  assert.deepEqual(liniesSalut(salut, [], t), ["Fatiga 1 · 1", "Ferides 5 · 5"]);
});
