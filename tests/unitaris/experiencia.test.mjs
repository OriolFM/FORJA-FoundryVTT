// Fase 4: guanyar PX (manual › Guanyar punts d'experiència, l. 6577).
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  pxObjectiu, recompensesPJ, virtutsRepetides, afegirHistorial, VIRTUTS
} from "../../module/progressio/experiencia.mjs";

test("taula de recompenses", () => {
  assert.equal(pxObjectiu("grup", "menor"), 4);
  assert.equal(pxObjectiu("grup", "epic"), 32);
  assert.equal(pxObjectiu("individual", "major"), 8);
  assert.equal(pxObjectiu("individual", "res"), 0);
  assert.equal(VIRTUTS.length, 16);
});

test("recompenses d'un PJ: grup rutinari + individual menor + virtut", () => {
  const r = recompensesPJ({ grup: [{ nivell: "rutinari" }], individuals: [{ nivell: "menor" }], virtut: "valor" });
  assert.equal(r.total, 8 + 2 + 1);
  assert.equal(r.linies.length, 3);
  assert.equal(recompensesPJ({ virtut: "inventada" }).total, 0);
  assert.equal(recompensesPJ({ altres: 3 }).total, 3);
});

test("cada virtut només a un PJ per sessió", () => {
  assert.deepEqual(virtutsRepetides({ a: "valor", b: "valor", c: "humor", d: null }), ["valor"]);
  assert.deepEqual(virtutsRepetides({ a: "valor" }), []);
});

test("historial: s'afegeix al final i es limita", () => {
  const h = afegirHistorial([{ data: 1, px: 4, motiu: {} }], [{ px: -3, motiu: { tipus: "atribut" } }], 2, 2);
  assert.deepEqual(h.map(e => e.px), [4, -3]);
  assert.equal(afegirHistorial(h, [{ px: 1, motiu: {} }], 3, 2).length, 2);
});
