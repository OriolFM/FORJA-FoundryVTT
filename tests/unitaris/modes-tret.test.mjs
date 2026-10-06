// Fase 6: modes de tret i atacs d'àrea (manual › A Distància, l. 3075–3103).
import assert from "node:assert/strict";
import { test } from "node:test";
import { MODES_TRET, modesDisponibles, regleArea, dinsAbastArea, danyFuga } from "../../module/combat/modes-tret.mjs";

test("modes segons les propietats", () => {
  assert.deepEqual(modesDisponibles(["rafega"]), ["tret", "rafega-daus", "rafega-dany"]);
  assert.deepEqual(modesDisponibles(["rafega", "automatic"]), ["tret", "rafega-daus", "rafega-dany", "automatic"]);
  assert.deepEqual(modesDisponibles([]), []);
  assert.equal(MODES_TRET.automatic.latencia, 2);
  assert.equal(MODES_TRET["rafega-dany"].dany, 1);
});

test("regles d'àrea", () => {
  assert.equal(regleArea(["rafega"], "tret"), null);
  assert.equal(regleArea(["rafega", "automatic"], "automatic").defensa, "basica");
  assert.equal(regleArea(["focAutomatic"]).defensa, 5);
  const esc = regleArea(["escopeta"]);
  assert.equal(esc.defensa, 1);
  assert.equal(esc.potEsquivar, true);
  assert.equal(regleArea(["areaDispersio"]).distanciaMaxima, 15);
});

test("abast de l'àrea: escopeta fins al rang mitjà, dispersió fins a 15 m", () => {
  const esc = regleArea(["escopeta"]);
  assert.equal(dinsAbastArea(esc, { banda: "mitja" }, 15), true);
  assert.equal(dinsAbastArea(esc, { banda: "llarg" }, 30), false);
  assert.equal(dinsAbastArea(esc, null, 100), false);
  const disp = regleArea(["areaDispersio"]);
  assert.equal(dinsAbastArea(disp, { banda: "curt" }, 14), true);
  assert.equal(dinsAbastArea(disp, { banda: "curt" }, 16), false);
});

test("fuga de les armes de dispersió: 15 − habilitat", () => {
  assert.equal(danyFuga(3), 12);
  assert.equal(danyFuga(20), 0);
});
