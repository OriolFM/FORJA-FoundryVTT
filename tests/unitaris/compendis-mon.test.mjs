// Eina del DJ (module/contingut/compendis-mon.mjs): a quin compendi del món va cada actor.
import { test } from "node:test";
import assert from "node:assert/strict";
import { categoriaCompendi, nomCompendiMon, TIPUS_NOU_ACTOR } from "../../module/contingut/compendis-mon.mjs";

test("categoria del compendi segons el tipus i el tier, com els del sistema", () => {
  assert.equal(categoriaCompendi("personatge"), "pj");
  assert.equal(categoriaCompendi("pnj", "extra"), "pnj");
  assert.equal(categoriaCompendi("pnj", "antagonista"), "pnj");
  assert.equal(categoriaCompendi("pnj", "nemesis"), "pnj");
  assert.equal(categoriaCompendi("pnj", "criatura"), "criatures");
  assert.equal(categoriaCompendi("pnj", "animal"), "animals");
  assert.equal(categoriaCompendi("pnj"), "pnj");
  assert.equal(nomCompendiMon("criatures"), "forja-criatures");
});

test("cada tipus del diàleg de creació va al compendi que li toca", () => {
  const cat = Object.fromEntries(Object.entries(TIPUS_NOU_ACTOR).map(([k, d]) => [k, categoriaCompendi(d.type, d.tier)]));
  assert.deepEqual(cat, { pj: "pj", extra: "pnj", antagonista: "pnj", nemesis: "pnj", criatura: "criatures", animal: "animals" });
});
