// Etiquetes dels objectius d'atac (combat/objectius.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { fletxaDireccio, etiquetarObjectius, objectiuPerDefecte } from "../../module/combat/objectius.mjs";

test("objectiu per defecte: l'últim declarat, si no el marcat, si no el més proper", () => {
  const llista = [{ tokenId: "a" }, { tokenId: "b", marcat: true }, { tokenId: "c" }];
  // El marcat (p. ex. el de la declaració d'un altre combatent) no passa davant de l'últim propi.
  assert.equal(objectiuPerDefecte(llista, "c"), "c");
  assert.equal(objectiuPerDefecte(llista, "ja-no-hi-es"), "b");
  assert.equal(objectiuPerDefecte(llista, null), "b");
  assert.equal(objectiuPerDefecte([{ tokenId: "a" }, { tokenId: "c" }], null), "a");
  assert.equal(objectiuPerDefecte([], "c"), null);
});

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
