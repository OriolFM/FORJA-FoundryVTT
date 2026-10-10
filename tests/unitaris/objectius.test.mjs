// Etiquetes dels objectius d'atac (combat/objectius.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { fletxaDireccio, etiquetarObjectius } from "../../module/combat/objectius.mjs";

test("fletxa de direcció (y cap avall)", () => {
  assert.equal(fletxaDireccio(10, 0), "→");
  assert.equal(fletxaDireccio(0, 10), "↓");
  assert.equal(fletxaDireccio(-10, 0), "←");
  assert.equal(fletxaDireccio(0, -10), "↑");
  assert.equal(fletxaDireccio(10, -10), "↗");
  assert.equal(fletxaDireccio(-10, 10), "↙");
  assert.equal(fletxaDireccio(0, 0), "");
});

test("noms repetits numerats, amb direcció i distància", () => {
  const r = etiquetarObjectius([
    { nom: "Guàrdia", distancia: 0, aTocar: true, dx: 100, dy: 0 },
    { nom: "Gòlem", distancia: 4, aTocar: false, dx: 0, dy: -400 },
    { nom: "Guàrdia", distancia: 6, aTocar: false, dx: 300, dy: -300 }
  ], { aTocar: "a tocar" });
  assert.deepEqual(r.map(o => o.etiqueta), ["Guàrdia nº 1 (→ a tocar)", "Gòlem (↑ 4 m)", "Guàrdia nº 2 (↗ 6 m)"]);
});
