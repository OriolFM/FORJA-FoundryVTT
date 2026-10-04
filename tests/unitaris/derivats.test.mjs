// Test manual per WP-B (A4 PC/XP, A6 salut derivada, B2 modLatencia d'armadura).
// Stub de CONFIG.FORJA construït a mà a partir de module/config/constants.mjs
// (no s'importa directament perquè aquell fitxer fa un top-level await fetch).
import assert from "node:assert/strict";

// _camps.mjs (importat per actor-personatge.mjs) importa constants.mjs, que
// fa `foundry.abstract...` NO (això és a actor-personatge.mjs mateix) i un
// top-level `await fetch(...)`. Cal doncs:
//  1. Stubar `globalThis.foundry` ABANS de l'import (la clàusula `extends
//     foundry.abstract.TypeDataModel` s'avalua en definir la classe).
//  2. Stubar `globalThis.fetch` perquè el fetch de constants.mjs falli de
//     manera controlada (el propi mòdul ja captura l'error i torna `[]`).
//  3. Fer l'import de manera dinàmica, DESPRÉS d'aquests stubs — un import
//     estàtic es "hoisteja" per davant de qualsevol altra instrucció.
import { fileURLToPath } from "node:url";
// Arrel del repo, relativa a aquest fitxer (tests/unitaris/ → ../../).
const REPO = fileURLToPath(new URL("../../", import.meta.url)).replace(/\/$/, "");
globalThis.foundry = {
  abstract: { TypeDataModel: class TypeDataModel {} },
  data: { fields: {} }
};
globalThis.fetch = async () => { throw new Error("fetch no disponible en aquest test (esperat)"); };

globalThis.CONFIG = {
  FORJA: {
    COST_ATRIBUT: { 0: -5, 1: 0, 2: 10, 3: 20, 4: 30, 5: 50 },
    COST_ESPECIE: { humanoide: 0 },
    COST_MIDA: { 1: -20, 2: -10, 3: 0, 4: 10, 5: 20 },
    COST_CONSTITUCIO: { 1: -20, 2: -10, 3: 0, 4: 10, 5: 20 },
    COST_HABILITAT: [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55],
    MIDA_DEFENSA: { 1: 2, 2: 1, 3: 0, 4: -1, 5: -2 },
    SALUT_PENALITZACIO: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 2, 6: 4, 7: null }
  }
};

const { _prepararDerivats } = await import(
  `${REPO}/module/data/actor-personatge.mjs`
);

function novaHabilitats() {
  const h = {};
  for (const id of ["armes-cos-a-cos", "esquivar"]) {
    h[id] = { nivell: 0, marca: "", especialitat: "" };
  }
  return h;
}

function fakeSys({ items = [], pxGastats = 0, habNivell = 0, armaduraModLatencia = 0, armaduraEquipada = true } = {}) {
  const habilitats = novaHabilitats();
  habilitats["armes-cos-a-cos"].nivell = habNivell;

  const sys = {
    atributs: { FOR: 2, DES: 2, AGI: 2, PER: 2, INT: 2, APL: 2 },
    especie: "humanoide",
    mida: 3,
    constitucio: 3,
    habilitats,
    salut: {
      fatiga:  { marcats: 0 },
      ferides: { marcats: 0 }
    },
    equilibri: { gastat: 0 },
    pc: 200,
    px: { total: 100, gastats: pxGastats },
    parent: { items: [] }
  };

  if (armaduraModLatencia) {
    items = [...items, {
      type: "armadura",
      system: { modLatencia: armaduraModLatencia, ...(armaduraEquipada === false ? { equipada: false } : {}) }
    }];
  }
  // Items de Foundry: `getFlag` (el llegeix `_prepararSobrenatural` per als trets de do).
  sys.parent.items = items.map(i => ({ getFlag: (scope, key) => i.flags?.[scope]?.[key], ...i }));
  return sys;
}

// --- A4: cost base sense cap despesa de PX ---
{
  const sys = fakeSys();
  _prepararDerivats(sys);
  // cost = 6*10 (atributs a 2) + 0 (especie) + 0 (mida 3) + 0 (constitucio 3) + 0 (habilitats a 0) = 60
  assert.equal(sys.costTotal, 60);
  assert.equal(sys.pcGastats, 60);
  assert.equal(sys.pcLliures, 200 - 60);
  console.log("OK: cost base sense PX ->", sys.costTotal, sys.pcGastats, sys.pcLliures);
}

// --- A4: pujar un atribut amb PX (millorarAtribut FOR 2->3, cost 10) ---
{
  const abans = fakeSys();
  _prepararDerivats(abans);
  const pcGastatsAbans = abans.pcGastats;

  const despres = fakeSys({ pxGastats: 10 }); // simula millorarAtribut: px.gastats += 10
  despres.atributs.FOR = 3;                    // i l'atribut ja pujat
  _prepararDerivats(despres);

  assert.equal(despres.costTotal, abans.costTotal + 10);
  assert.equal(despres.pcGastats, pcGastatsAbans, "pcGastats no ha de canviar en pujar un atribut amb PX");
  console.log("OK: pujar atribut amb PX no infla pcGastats ->", pcGastatsAbans, "=", despres.pcGastats);
}

// --- A4: pujar una habilitat amb PX (nivell 0->1, cost 1) ---
{
  const abans = fakeSys();
  _prepararDerivats(abans);

  const despres = fakeSys({ pxGastats: 1, habNivell: 1 });
  _prepararDerivats(despres);

  assert.equal(despres.costTotal, abans.costTotal + 1);
  assert.equal(despres.pcGastats, abans.pcGastats, "pcGastats no ha de canviar en pujar una habilitat amb PX");
  console.log("OK: pujar habilitat amb PX no infla pcGastats ->", abans.pcGastats, "=", despres.pcGastats);
}

// --- A4: afegir tret positiu amb PX (cost 15) ---
{
  const abans = fakeSys();
  _prepararDerivats(abans);

  const despres = fakeSys({ pxGastats: 15, items: [{ type: "tret", system: { cost: 15 } }] });
  _prepararDerivats(despres);

  assert.equal(despres.costTotal, abans.costTotal + 15);
  assert.equal(despres.pcGastats, abans.pcGastats, "pcGastats no ha de canviar en afegir un tret positiu amb PX");
  console.log("OK: afegir tret positiu amb PX no infla pcGastats ->", abans.pcGastats, "=", despres.pcGastats);
}

// --- A4: treure tret negatiu amb PX (cost -10 al full, es paga 10 PX per treure'l) ---
{
  const ambTretNegatiu = fakeSys({ items: [{ type: "tret", system: { cost: -10 } }] });
  _prepararDerivats(ambTretNegatiu);

  const desprésDeTreureLo = fakeSys({ pxGastats: 10 }); // tret eliminat, px.gastats += 10
  _prepararDerivats(desprésDeTreureLo);

  assert.equal(desprésDeTreureLo.costTotal, ambTretNegatiu.costTotal + 10);
  assert.equal(desprésDeTreureLo.pcGastats, ambTretNegatiu.pcGastats, "pcGastats no ha de canviar en treure un tret negatiu amb PX");
  console.log("OK: treure tret negatiu amb PX no infla pcGastats ->", ambTretNegatiu.pcGastats, "=", desprésDeTreureLo.pcGastats);
}

// --- A6: camps de salut derivats per a les barres de token ---
{
  const sys = fakeSys();
  sys.constitucio = 3; // fatiga.perNivell
  sys.mida = 4;         // ferides.perNivell
  sys.salut.fatiga.marcats = 5;
  sys.salut.ferides.marcats = 0;
  _prepararDerivats(sys);

  assert.equal(sys.salut.fatiga.perNivell, 3);
  assert.equal(sys.salut.fatiga.max, 6 * 3 + 1); // 19
  assert.equal(sys.salut.fatiga.value, 19 - 5);  // 14
  assert.equal(sys.salut.ferides.perNivell, 4);
  assert.equal(sys.salut.ferides.max, 6 * 4 + 1); // 25
  assert.equal(sys.salut.ferides.value, 25 - 0);  // 25
  assert.equal(sys.salut.foraDeCombat, false);
  console.log("OK: salut.fatiga/ferides {value,max} ->", sys.salut.fatiga, sys.salut.ferides);
}

// --- A6: foraDeCombat quan nivellEfectiu arriba a 7 ---
{
  const sys = fakeSys();
  sys.constitucio = 2; // fatiga perNivell=2 -> nivell 7 quan marcats > 6*2=12
  sys.salut.fatiga.marcats = 13;
  _prepararDerivats(sys);
  assert.equal(sys.salut.fatiga.nivellActiu, 7);
  assert.equal(sys.salut.nivellEfectiu, 7);
  assert.equal(sys.salut.foraDeCombat, true);
  assert.equal(sys.salut.fatiga.value, Math.max(0, sys.salut.fatiga.max - 13));
  console.log("OK: foraDeCombat a nivell 7 ->", sys.salut.foraDeCombat, "value=", sys.salut.fatiga.value);
}

// --- B2: modLatencia d'una armadura equipada s'afegeix a latenciaBase ---
{
  const sense = fakeSys();
  _prepararDerivats(sense);

  const ambArmadura = fakeSys({ armaduraModLatencia: 3 });
  _prepararDerivats(ambArmadura);

  assert.equal(ambArmadura.latenciaBase, sense.latenciaBase + 3);
  console.log("OK: modLatencia d'armadura equipada suma a latenciaBase ->", sense.latenciaBase, "+3 =", ambArmadura.latenciaBase);
}

// --- B2: armadura amb equipada=false NO compta ---
{
  const sense = fakeSys();
  _prepararDerivats(sense);

  const ambArmaduraDesequipada = fakeSys({ armaduraModLatencia: 3, armaduraEquipada: false });
  _prepararDerivats(ambArmaduraDesequipada);

  assert.equal(ambArmaduraDesequipada.latenciaBase, sense.latenciaBase);
  console.log("OK: armadura amb equipada=false no afecta latenciaBase ->", ambArmaduraDesequipada.latenciaBase);
}

// --- B2: dues armadures equipades sumen els dos modificadors ---
{
  const sense = fakeSys();
  _prepararDerivats(sense);

  const duesArmadures = fakeSys();
  duesArmadures.parent.items = [
    { type: "armadura", system: { modLatencia: 2 } },
    { type: "armadura", system: { modLatencia: 4 } }
  ];
  _prepararDerivats(duesArmadures);

  assert.equal(duesArmadures.latenciaBase, sense.latenciaBase + 6);
  console.log("OK: dues armadures equipades sumen ->", sense.latenciaBase, "+6 =", duesArmadures.latenciaBase);
}

// --- B2: latenciaBase mai baixa d'1 (Math.max(1, ...) es manté amb modLatencia molt negatiu) ---
{
  const sys = fakeSys({ armaduraModLatencia: -50 });
  _prepararDerivats(sys);
  assert.equal(sys.latenciaBase, 1);
  console.log("OK: Math.max(1, ...) es respecta amb modLatencia molt negatiu ->", sys.latenciaBase);
}

console.log("\nTOTS ELS TESTS WP-B HAN PASSAT");
