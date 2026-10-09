import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
// Arrel del repo, relativa a aquest fitxer (tests/unitaris/ → ../../).
const REPO = fileURLToPath(new URL("../../", import.meta.url)).replace(/\/$/, "");
globalThis.Roll = class {};
globalThis.game = { i18n: { localize: k => k, format: (k, d) => `${k}|${JSON.stringify(d ?? {})}` }, user: { isGM: false } };

const R = new URL("../../module/combat/", import.meta.url).href; // URL file:// per a import() (Windows)
const dany = await import(R + "dany.mjs");
const def  = await import(R + "defensa.mjs");
const prop = await import(R + "propietats.mjs");
const atac = await import(R + "atac.mjs");
const cur  = await import(R + "curacio.mjs");
const cataleg = JSON.parse(readFileSync(REPO + "/module/config/dades/armes.json", "utf8"));
JSON.parse(readFileSync(REPO + "/lang/ca.json", "utf8"));

// ---------- propietats (B13/B15)
const arma = (catalegId, extra = {}) => ({ type: "arma", name: catalegId, system: { ...(extra.system ?? {}) }, flags: { forja: { catalegId, ...(extra.flags ?? {}) } } });
assert.ok(prop.teProprietat(arma("escopetes"), "escopeta", cataleg));
assert.ok(prop.teProprietat(arma("escopetes"), "escopeta", []));          // reserva sense catàleg
assert.ok(prop.teProprietat(arma("escuts"), "escut", cataleg));
assert.ok(!prop.teProprietat(arma("rifles"), "escopeta", cataleg));
assert.ok(prop.teProprietat({ type: "arma", system: {}, flags: { forja: { propietats: ["escut"] } } }, "escut", []));
assert.ok(prop.teProprietat({ type: "arma", system: { propietats: ["escopeta"] }, flags: {} }, "escopeta", []));
assert.ok(!prop.teProprietat(null, "escut"));
assert.deepEqual(cataleg.filter(e => e.propietats).map(e => e.id).sort(), ["armes-dassalt", "armes-de-dispersio", "armes-de-suport", "armes-pesants", "escopetes", "escuts", "subfusells"]);

// ---------- B13: poca penetració
const arm = (reduccio, tipus = "fisica", equipada) => ({ type: "armadura", system: { reduccio, tipus, equipada }, flags: {} });
assert.equal(dany.proteccioArmadura([arm(2)], { dobleRigida: true }), 4);
assert.equal(dany.proteccioArmadura([arm(3, "flexible")], { dobleRigida: true }), 3);
assert.equal(dany.proteccioArmadura([arm(3, "flexible"), arm(2)], { dobleRigida: true }), 6);  // manual l. 3337: rígida doblada 4 + ⌈3/2⌉
assert.equal(dany.proteccioArmadura([arm(3, "flexible"), arm(2)]), 4);  // rígida 2 + ⌈3/2⌉
assert.equal(dany.proteccioArmadura([arm(5), arm(3, "flexible")]), 7);  // exemple Von Blum
assert.equal(dany.proteccioArmadura([arm(1, "flexible"), arm(1, "flexible")]), 2);  // exemple Bauer
assert.equal(dany.proteccioArmadura([arm(3), arm(2)]), 3);  // dues rígides no s'apilen
assert.equal(dany.proteccioArmadura([arm(4, "natural")], { dobleRigida: true }), 4);
assert.equal(dany.proteccioArmadura([arm(5, "fisica", false)], { dobleRigida: true }), 0);
assert.equal(dany.proteccioArmadura([arm(2)], { dobleRigida: true, ignorarTipus: ["fisica"] }), 0);
// Exemple manual: Trace (escopeta, dany 9) vs armadura lleugera rígida 2, RD 3 → 9-4-3 = 2
assert.equal(dany.calcularDany({ danyBaseArma: 6, excedentAtac: 3, reduccioDany: 3, armadura: dany.proteccioArmadura([arm(2)], { dobleRigida: true }) }).danyFinal, 2);

// ---------- B14: pífia en esquivar
assert.equal(dany.danyExtraPifiaEsquivar({ pifia: true, dice: [1, 1, 3] }), 2);
assert.equal(dany.danyExtraPifiaEsquivar({ pifia: false, dice: [1, 6] }), 0);
assert.equal(dany.danyExtraPifiaEsquivar(null), 0);
assert.equal(dany.calcularDany({ danyBaseArma: 4, excedentAtac: 1, reduccioDany: 2, armadura: 1, danyExtra: 2 }).danyFinal, 4);  // pífia: +2 al dany final (manual l. ~4018)
assert.equal(dany.calcularDany({ danyBaseArma: 3, excedentAtac: 0, reduccioDany: 1, armadura: 5, danyExtra: 2 }).danyFinal, 2);  // encara que l'armadura aturi l'atac
assert.equal(dany.calcularDany({ danyBaseArma: 4, excedentAtac: 1, reduccioDany: 2, armadura: 1 }).danyFinal, 2);
assert.equal(dany.calcularDany({ danyBaseArma: 4, excedentAtac: 0, reduccioDany: 0, danyExtra: -3 }).danyTotal, 4);

// ---------- B15: mitjans de blocar
const hab = (lv) => (id) => lv[id] ?? 0;
let m = prop.mitjansBlocar({ items: [], habilitat: hab({ resistencia: 4, "armes-improvisades": 1 }), reduccioNatural: 2 });
assert.deepEqual(m.map(x => [x.id, x.reduccioExtra]), [["resistencia", 2], ["improvisat", 1]]);
m = prop.mitjansBlocar({ items: [], habilitat: hab({ resistencia: 4 }), reduccioNatural: 2, categoriaAtac: "cosAcos" });
assert.deepEqual(m.map(x => x.id), ["improvisat"]);                      // sense armes no: el cos no bloca armes
// Exemple del manual (l. 3832–3836): el gólem (urpes, resistència 4, reducció 3)
// bloca l'espasa de la Yoko amb el cos → +3 (limitat a la reducció natural).
const urpes = { type: "arma", name: "Urpes", system: { categoria: "natural" }, flags: { forja: { catalegId: "urpes" } } };
const cop   = { type: "arma", name: "Cop", system: { categoria: "natural", basic: true }, flags: { forja: { catalegId: "cop" } } };
m = prop.mitjansBlocar({ items: [urpes], habilitat: hab({ resistencia: 4 }), reduccioNatural: 3, categoriaAtac: "cosAcos" });
assert.deepEqual(m.map(x => [x.id, x.reduccioExtra]), [["resistencia", 3], ["improvisat", 0]]);
m = prop.mitjansBlocar({ items: [cop], habilitat: hab({ resistencia: 4 }), reduccioNatural: 3, categoriaAtac: "cosAcos" });
assert.deepEqual(m.map(x => x.id), ["improvisat"]);
m = prop.mitjansBlocar({ items: [arma("escuts")], habilitat: hab({ resistencia: 1, "armes-cos-a-cos": 3 }), reduccioNatural: 5, categoriaAtac: "distancia", cataleg });
assert.deepEqual(m.map(x => [x.id, x.reduccioExtra, x.nomArma]), [["escut", 3, "escuts"], ["improvisat", 0, undefined]]);
m = prop.mitjansBlocar({ items: [arma("escuts")], habilitat: hab({ resistencia: 2, "armes-cos-a-cos": 3 }), reduccioNatural: 5, categoriaAtac: "natural", cataleg });
assert.deepEqual(m.map(x => x.id), ["escut", "resistencia", "improvisat"]);

const actor = (extra = {}, items = []) => ({ items, system: {
  defensa: 3, reduccioDany: 2, concentrat: false, reaccions: { gastades: 0 }, reaccionsMax: 1,
  atributs: { AGI: 3, DES: 2 }, habilitats: { esquivar: { nivell: 2 }, "armes-cos-a-cos": { nivell: 1 }, resistencia: { nivell: 4 } },
  salut: { penalitzacio: 0, foraDeCombat: false }, ...extra } });
let ops = def.opcionsDefensa(actor({}, [arma("escuts")]), undefined, { categoriaAtac: "cosAcos" });
let bl = ops.find(o => o.id === "blocar");
assert.deepEqual(bl.mitjans.map(x => x.id), ["escut", "improvisat"]);
assert.equal(bl.mitjaId, "escut");
assert.equal(bl.reduccioExtra, 1);
let tri = def.triarMitjaBlocar(bl, "improvisat");
assert.equal(tri.reduccioExtra, 0);
assert.equal(tri.mitjaId, "improvisat");
assert.equal(def.triarMitjaBlocar(bl, "resistencia"), bl);            // no disponible → igual
assert.equal(def.triarMitjaBlocar(ops[0], "escut"), ops[0]);           // no és blocar
ops = def.opcionsDefensa(actor());                                     // atac desconegut
bl = ops.find(o => o.id === "blocar");
assert.equal(bl.mitjaId, "resistencia");
assert.equal(bl.reduccioExtra, 2);

// ---------- B16: retard de barallar-se
assert.equal(atac.retardMaximBarallarse({ habId: "barallar-se" }, 3), 3);
assert.equal(atac.retardMaximBarallarse({ habId: "barallar-se" }, 3, true), 0);
assert.equal(atac.retardMaximBarallarse({ habId: "armes-cos-a-cos" }, 3), 0);
assert.equal(atac.retardMaximBarallarse(null, 3), 0);
assert.equal(atac.limitarRetardBarallarse("2", 3), 2);
assert.equal(atac.limitarRetardBarallarse(5, 3), 3);
assert.equal(atac.limitarRetardBarallarse(-1, 3), 0);
assert.equal(atac.limitarRetardBarallarse("x", 3), 0);
assert.equal(atac.limitarRetardBarallarse(2, 0), 0);

// ---------- B17: requisits de curació
const req = cur.comprovarRequisitsCuracio;
assert.deepEqual(req({ tipus: "primers-auxilis", nivell: 0, autotractament: false, esGM: true }), { permes: false, motiu: "habilitat", minim: 1 });
assert.equal(req({ tipus: "primers-auxilis", nivell: 1, autotractament: false, esGM: false }).permes, true);
assert.deepEqual(req({ tipus: "tractament-medic", nivell: 1, autotractament: false, esGM: false }), { permes: false, motiu: "habilitat", minim: 2 });
assert.equal(req({ tipus: "tractament-medic", nivell: 2, autotractament: false, esGM: false }).permes, true);
assert.equal(req({ tipus: "primers-auxilis", nivell: 3, autotractament: true, esGM: false }).motiu, "autotractament");
assert.equal(req({ tipus: "primers-auxilis", nivell: 3, autotractament: true, esGM: true }).permes, true);
const guar = (m) => ({ system: { habilitats: m } });
assert.deepEqual(cur.habilitatCuracio(guar({ enginyeria: { nivell: 1 }, nyaps: { nivell: 2 }, medicina: { nivell: 3 } }), "mecanoide"), { id: "nyaps", nivell: 2 });
assert.deepEqual(cur.habilitatCuracio(guar({ medicina: { nivell: 3 } }), "huma"), { id: "medicina", nivell: 3 });

console.log("WP-I: tots els tests OK");
