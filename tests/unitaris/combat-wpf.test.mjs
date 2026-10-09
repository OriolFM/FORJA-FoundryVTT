import assert from "node:assert/strict";
// Arrel del repo, relativa a aquest fitxer (tests/unitaris/ → ../../).
// URL file:// (no ruta): a Windows, import() no accepta rutes com E:\...
const REPO = new URL("../../", import.meta.url).href.replace(/\/$/, "");
globalThis.Roll = class {};
globalThis.game = { i18n: { localize: k => k, format: k => k } };
const R = `${REPO}/module/combat/`;
const dany  = await import(R + "dany.mjs");
const abast = await import(R + "abast.mjs");
const def   = await import(R + "defensa.mjs");

// --- calcularDany (manual examples)
// Trace vs mutant: dany 9, armadura 3, reducció 3 → 3
assert.equal(dany.calcularDany({ danyBaseArma: 6, excedentAtac: 3, reduccioDany: 3, armadura: 3 }).danyFinal, 3);
// mutant vs Trace: 6 dmg, armour 3, RD 3 → dany mínim 1+2 = 3
assert.equal(dany.calcularDany({ danyBaseArma: 5, bonificadorArma: 2, excedentAtac: 1, reduccioDany: 3, armadura: 3 }).danyFinal, 3);
// Nagata ègida 5, dany 7 → trencada 2 torns, dany mínim 1+2
let r = dany.calcularDany({ danyBaseArma: 4, bonificadorArma: 2, excedentAtac: 3, reduccioDany: 2, armadura: 0, egida: { activa: true, absorcio: 5 } });
assert.deepEqual([r.danyFinal, r.egidaTrencada, r.tornsInactivaEgida], [3, true, 2]);
assert.equal(dany.calcularDany({ danyBaseArma: 3, excedentAtac: 2, reduccioDany: 0, egida: { activa: true, absorcio: 5 } }).danyFinal, 0);
// armour stops fully
assert.equal(dany.calcularDany({ danyBaseArma: 2, excedentAtac: 0, reduccioDany: 5, armadura: 3 }).danyFinal, 0);

// --- proteccioArmadura (manual l. 3337)
const arm = (reduccio, tipus = "fisica", equipada, egida) => ({ type: "armadura", system: { reduccio, tipus, equipada, egida }, flags: {} });
const items = [arm(2), arm(5, "fisica", false), arm(3, "flexible"), { type: "arma", system: { reduccio: 9 } }];
assert.equal(dany.proteccioArmadura(items), 4); // manual l. 3337: rígida 2 + ⌈flexible 3 / 2⌉
assert.equal(dany.proteccioArmadura(items, { ignorarTipus: ["flexible", "natural"] }), 2);
assert.equal(dany.proteccioArmadura([]), 0);
assert.equal(dany.proteccioArmadura([arm(4, "fisica", undefined)]), 4); // sense camp → equipada

// --- ègida
const e1 = arm(0, "fisica", true, { activa: true, absorcio: 4 });
const e2 = arm(0, "fisica", true, { activa: true, absorcio: 6 });
const e3 = arm(0, "fisica", false, { activa: true, absorcio: 9 });
const e4 = arm(0, "fisica", true, { activa: true, absorcio: 0 });
assert.equal(dany.itemEgidaActiva([e1, e2, e3, e4]), e2);
assert.equal(dany.itemEgidaActiva([e4]), null);
assert.equal(dany.tickReactivacioEgida(12, 3), 15);
assert.equal(dany.tickReactivacioEgida(undefined, -2), 0);
const trencada = (absorcio, tick) => ({ type: "armadura", system: { egida: { activa: false, absorcio } }, flags: { forja: { egidaReactivaAlTick: tick } } });
assert.equal(dany.egidaHaDeReactivar(trencada(4, 15), 14), false);
assert.equal(dany.egidaHaDeReactivar(trencada(4, 15), 15), true);
assert.equal(dany.egidaHaDeReactivar(trencada(4, 15), 20), true);
assert.equal(dany.egidaHaDeReactivar(trencada(0, 15), 20), false);
assert.equal(dany.egidaHaDeReactivar(trencada(4, null), 20), false);
assert.equal(dany.egidaHaDeReactivar({ ...trencada(4, 1), system: { egida: { activa: true, absorcio: 4 } } }, 20), false);

// --- concentració
assert.deepEqual(dany.efecteDanyConcentracio(false, 5, 2), { trenca: false, atordit: false });
assert.deepEqual(dany.efecteDanyConcentracio(true, 0, 2), { trenca: false, atordit: false });
assert.deepEqual(dany.efecteDanyConcentracio(true, 2, 2), { trenca: true, atordit: false });
assert.deepEqual(dany.efecteDanyConcentracio(true, 3, 2), { trenca: true, atordit: true });

// --- abast vora a vora (B9)
const rect = (cx, cy, w = 1, h = 1) => ({ x: cx * 100, y: cy * 100, width: w * 100, height: h * 100 });
assert.equal(abast.separacioEnCaselles(rect(0, 0), rect(1, 0), 100), 0);         // adjacents
assert.equal(abast.separacioEnCaselles(rect(0, 0), rect(1, 1), 100), 0);         // diagonal
assert.equal(abast.separacioEnCaselles(rect(0, 0), rect(2, 0), 100), 1);         // una casella entre
assert.equal(abast.rectanglesATocar(rect(0, 0, 3, 3), rect(3, 1), 100), true);   // gran (3x3) i petit adjacents
assert.equal(abast.rectanglesATocar(rect(0, 0, 4, 4), rect(4, 4, 4, 4), 100), true);
assert.equal(abast.rectanglesATocar(rect(0, 0, 3, 3), rect(4, 1), 100), false);
assert.equal(abast.rectanglesATocar(rect(0, 0), rect(1.3, 0), 100), true);       // mal encaixat
let [pa, pb] = abast.puntsMesPropers(rect(0, 0, 2, 2), rect(4, 1));
assert.deepEqual([pa, pb], [{ x: 200, y: 150 }, { x: 400, y: 150 }]);
[pa, pb] = abast.puntsMesPropers(rect(0, 0), rect(1, 0));
assert.deepEqual(pa, { x: 100, y: 50 }); assert.deepEqual(pb, { x: 100, y: 50 });
// bandes
const arma = { system: { abast: 10, rangExtrem: false } };
assert.equal(abast.bandaDistancia(5, arma, 3, true).banda, "bocaCano");
assert.equal(abast.bandaDistancia(5, arma, 3, false).banda, "curt");
assert.equal(abast.bandaDistancia(15, arma, 3).dificultat, 4);
assert.equal(abast.bandaDistancia(50, arma, 3), null);

// --- opcions de defensa (B7/B1)
const actor = (extra = {}) => ({ system: {
  defensa: 3, reduccioDany: 2, concentrat: false, reaccions: { gastades: 0 }, reaccionsMax: 1,
  atributs: { AGI: 3, DES: 2 }, habilitats: { esquivar: { nivell: 2 }, "arts-marcials": { nivell: 3 }, resistencia: { nivell: 4 } },
  salut: { penalitzacio: 0, foraDeCombat: false }, ...extra } });
let ops = def.opcionsDefensa(actor());
assert.deepEqual(ops.map(o => o.id), ["passiva", "esquivar", "parar", "blocar"]);
assert.equal(ops.find(o => o.id === "parar").habId, "arts-marcials");
assert.equal(ops.find(o => o.id === "parar").pool, 5);
assert.equal(ops.find(o => o.id === "blocar").reduccioExtra, 2);            // min(resistència 4, FOR 2)
assert.equal(ops.find(o => o.id === "esquivar").dificultatMinima, 4);
let decl = def.opcionsDefensa(actor({ reaccions: { gastades: 1 } }), undefined, { declarada: true });
assert.deepEqual(decl.map(o => o.id), ["esquivar", "parar", "blocar"]);
assert.ok(decl.every(o => o.disponible && !o.gastaReaccio));
assert.ok(decl[0].descripcio.endsWith("EsquivarDesc"));
ops = def.opcionsDefensa(actor({ reaccions: { gastades: 1 } }));
assert.ok(!ops.find(o => o.id === "esquivar").disponible);
ops = def.opcionsDefensa(actor({ concentrat: true }));
assert.ok(!ops.find(o => o.id === "parar").disponible);
ops = def.opcionsDefensa(actor({ salut: { penalitzacio: 4, foraDeCombat: true } }));
assert.equal(ops[0].dificultat, 1);
assert.ok(ops.slice(1).every(o => !o.disponible));
ops = def.opcionsDefensa(actor({ salut: { penalitzacio: 2, foraDeCombat: false } }), 5);
assert.equal(ops.find(o => o.id === "esquivar").penalSalut, 2);
assert.equal(ops.find(o => o.id === "esquivar").dificultatMinima, 6);
assert.equal(def.resultatDefensaActiva(8, 2, 4), 6);
// Estats (Fase 1): abatut no esquiva; berserc cap defensa activa; immobilitzat defensa 1
const ambEstats = (...estats) => ({ ...actor(), statuses: new Set(estats) });
ops = def.opcionsDefensa(ambEstats("abatut"));
assert.ok(!ops.find(o => o.id === "esquivar").disponible);
assert.equal(ops.find(o => o.id === "esquivar").bloquejatPer, "abatut");
assert.ok(ops.find(o => o.id === "parar").disponible);
ops = def.opcionsDefensa(ambEstats("berserc"));
assert.ok(ops.slice(1).every(o => !o.disponible && o.bloquejatPer === "berserc"));
ops = def.opcionsDefensa(ambEstats("immobilitzat"));
assert.equal(ops[0].dificultat, 1);
assert.ok(ops.find(o => o.id === "parar").disponible);
assert.equal(def.resultatDefensaActiva(5, 2, 4), 4);
assert.equal(def.resultatDefensaActiva(1, 3, 0), 0);

console.log("WP-F: tots els tests OK");
