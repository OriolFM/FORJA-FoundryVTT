// Fase 3: què fan els paràmetres d'un efecte o artefacte quan s'usen.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  pistesDany, bonificacionsDeParametres, resumParametres, estatDeParametre,
  danyDeEfecte, armaDeArtefacte, armaduresDeArtefacte, artefacteSempreActiu, sumarBonificacions, bonificacionsBuides
} from "../../module/combat/resultat-parametres.mjs";
import { calcularDany } from "../../module/combat/dany.mjs";

const llegir = (nom) => JSON.parse(readFileSync(new URL(`../../module/config/dades/${nom}.json`, import.meta.url), "utf8"));
const armes = llegir("armes");
const artefactes = Object.fromEntries(llegir("artefactes").map(a => [a.id, { name: a.nom, system: a }]));
const efectes = Object.fromEntries(llegir("efectes").map(e => [e.id, e]));

test("pistes del dany", () => {
  assert.deepEqual(pistesDany("foc"), ["ferides"]);
  assert.deepEqual(pistesDany("fred"), ["fatiga"]);
  assert.deepEqual(pistesDany("explosio"), ["fatiga", "ferides"]);
  assert.deepEqual(pistesDany("fatiga-o-ferides", "fatiga"), ["fatiga"]);
  assert.deepEqual(pistesDany("fatiga-o-ferides"), ["ferides"]);
});

test("Bola de foc: àrea a distància, dany indirecte de foc +5", () => {
  const r = resumParametres(efectes["bola-de-foc"].parametres);
  assert.equal(r.objectius, "area");
  assert.equal(r.distancia, true);
  assert.equal(r.durada, "instantania");
  assert.deepEqual(r.dany, { categoria: "indirecte", nivell: 5, danyTipus: "foc" });
  // 5 + excedent 2 = 7; armadura 3 → 4; reducció 2 → 2
  const d = danyDeEfecte(r.dany, 2);
  assert.equal(d.directe, false);
  assert.equal(calcularDany({ ...d, reduccioDany: 2, armadura: 3 }).danyFinal, 2);
});

test("Mot destructiu: dany directe 9, ignora armadura i reducció", () => {
  const r = resumParametres(efectes["mot-destructiu"].parametres);
  const d = danyDeEfecte(r.dany, 1);
  assert.equal(d.directe, true);
  assert.equal(calcularDany({ ...d, reduccioDany: 0, armadura: 0 }).danyFinal, 10);
});

test("estats: X als parametritzats, modificador als altres", () => {
  assert.deepEqual(estatDeParametre({ estat: "sagnant", nivell: 3 }), { id: "sagnant", valorX: 3, modificador: 0 });
  assert.deepEqual(estatDeParametre({ estat: "atordit", nivell: 3 }), { id: "atordit", valorX: null, modificador: 3 });
  const r = resumParametres(efectes["rigor-mortis"].parametres);
  assert.deepEqual(r.estats.map(e => e.id), ["immobilitzat", "lent"]);
  assert.equal(r.durada, "escena");
});

test("curació: Guarir cura 10 ferides, estats i malalties", () => {
  const r = resumParametres(efectes["guarir"].parametres);
  assert.deepEqual(r.cura, { nivell: 10, pista: "ferides", estats: true, malalties: true });
});

test("bonificacions: Servoarmadura FOR +3, força bruta +3, resistència +4", () => {
  const b = bonificacionsDeParametres(artefactes["servoarmadura-dassalt"].system.parametres);
  assert.deepEqual(b.atributs, { FOR: 3 });
  assert.deepEqual(b.habilitats, { "forca-bruta": 3, resistencia: 4 });
  const suma = sumarBonificacions(bonificacionsBuides(), b);
  sumarBonificacions(suma, { atributs: { FOR: 1 }, habilitats: {}, armadura: 2, egida: 0, trets: ["levitar"], estats: [] });
  assert.equal(suma.atributs.FOR, 4);
  assert.equal(suma.armadura, 2);
  assert.deepEqual(suma.trets, ["levitar"]);
});

test("Espasa d'energia com a arma: FOR+8 directe, latència 1", () => {
  const a = armaDeArtefacte(artefactes["espasa-energia"], armes);
  assert.equal(a.categoria, "cosAcos");
  assert.equal(a.danyBase, "FOR+8");
  assert.equal(a.modLatencia, 1);
  assert.ok(a.propietats.includes("directe"));
  assert.equal(a.pista, "ferides");
});

test("Espasa serra com a arma: FOR+4 i sagnant/3 (exemple de la Trace)", () => {
  const a = armaDeArtefacte(artefactes["espasa-serra"], armes);
  assert.equal(a.danyBase, "FOR+4");
  assert.deepEqual(a.estatsImpacte, [{ id: "sagnant", valorX: 3, modificador: 0 }]);
});

test("Holocapa: armadura flexible de protecció 3 i latència 2", () => {
  const [arm] = armaduresDeArtefacte(artefactes["holocapa"]);
  assert.equal(arm.tipus, "flexible");
  assert.equal(arm.reduccio, 3);
  assert.equal(arm.modLatencia, 2);
});

test("Espasa pretoriana: ègida 9; Ciberbraç: armadura natural 2", () => {
  const eg = armaduresDeArtefacte(artefactes["espasa-pretoriana-de-terra"]);
  assert.equal(eg.length, 1);
  assert.equal(eg[0].egida.absorcio, 9);
  const cb = armaduresDeArtefacte(artefactes["ciberbrac"]);
  assert.deepEqual(cb.map(a => [a.tipus, a.reduccio]), [["natural", 2]]);
});

test("sempre actius: permanents, armes i armadures; no els dispositius", () => {
  assert.equal(artefacteSempreActiu(artefactes["servoarmadura-dassalt"]), true);
  assert.equal(artefacteSempreActiu(artefactes["espasa-serra"]), true);
  assert.equal(artefacteSempreActiu(artefactes["cibermodem"]), false);
  assert.equal(artefacteSempreActiu({ system: { ...artefactes["holocapa"].system, equipat: false } }), false);
});
