// Fase 2: el constructor (`calcularParametres`) reprodueix el cost, la
// dificultat i la latència de les 83 plantilles del manual (18 artefactes i
// 65 efectes), igual que el skill de referència skills/forja-parametres.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const llegir = (nom) => JSON.parse(readFileSync(new URL(`../../module/config/dades/${nom}.json`, import.meta.url), "utf8"));
const P = llegir("parametres");
const artefactes = llegir("artefactes");
const efectes = llegir("efectes");

const { calcularParametres, costParametre, seleccioAParametres, calcularConstruccio } =
  await import("../../module/progressio/construccio.mjs");
globalThis.CONFIG = { FORJA: { PARAMETRES: P } };

const calcula = (e) => calcularParametres(e.parametres, e.construccio, P);

test("hi ha 18 artefactes i 65 efectes, tots amb paràmetres", () => {
  assert.equal(artefactes.length, 18);
  assert.equal(efectes.length, 65);
  for (const e of [...artefactes, ...efectes]) {
    assert.ok(Array.isArray(e.parametres) && e.parametres.length, e.id);
    assert.ok(e.construccio, e.id);
  }
});

test("cap paràmetre desconegut", () => {
  for (const e of [...artefactes, ...efectes]) {
    for (const p of e.parametres) assert.ok(costParametre(p, P), `${e.id}: ${JSON.stringify(p)}`);
  }
});

test("cost de les 83 plantilles", () => {
  const errors = [...artefactes, ...efectes]
    .map(e => ({ id: e.id, esperat: e.cost, calculat: calcula(e).cost }))
    .filter(r => r.esperat !== r.calculat);
  assert.deepEqual(errors, []);
});

test("dificultat i latència dels efectes", () => {
  for (const e of efectes) {
    const r = calcula(e);
    assert.equal(r.dificultat, e.dificultat, `${e.id}: dificultat`);
    // Sense latència declarada (rituals i efectes només narratius), el manual no en dona.
    if (e.construccio.latenciaDeclarada != null) assert.equal(r.latencia, e.modLatencia, `${e.id}: latència`);
  }
});

test("dificultat i latència dels artefactes", () => {
  for (const e of artefactes) {
    const r = calcula(e);
    if (e.activacio.dificultat != null) assert.equal(r.dificultat, e.activacio.dificultat, `${e.id}: dificultat`);
    // Les armes i armadures porten la latència als paràmetres; els dispositius
    // només narratius (Autometge) no en tenen.
    if (e.us.actiu) assert.equal(r.latencia, e.us.modLatencia, `${e.id}: latència`);
  }
});

test("dificultat declarada: ±5 PC per punt; latència: ±2 PC per punt", () => {
  const base = [{ tipus: "dany", categoria: "indirecte", nivell: 4, danyTipus: "electricitat" }]; // 11 PC, dif 0
  assert.equal(calcularParametres(base, {}, P).cost, 11);
  assert.equal(calcularParametres(base, { dificultatDeclarada: 1 }, P).cost, 6);
  assert.equal(calcularParametres(base, { dificultatDeclarada: 2 }, P).cost, 1);
  assert.equal(calcularParametres(base, { latenciaDeclarada: 2 }, P).cost, 7);
  assert.equal(calcularParametres(base, { latenciaDeclarada: -1 }, P).cost, 13);
  assert.equal(calcularParametres(base, { autoDificultat: true }, P).dificultat, 1);
  assert.equal(calcularParametres(base, { dificultatDeclarada: 0, permanent: true }, P).cost, 11);
  assert.ok(calcularParametres(base, { latenciaDeclarada: 13 }, P).avisos.length);
});

test("recàrrega, acumulador i arma base", () => {
  assert.equal(costParametre({ tipus: "recarrega", unitats: 11 }, P).cost, -22);
  assert.equal(costParametre({ tipus: "acumulador", carregues: 3 }, P).cost, 9);
  // Espasa (latència 1, dany 2): sense canvis, cost 0; dany 4 i latència 2 → +4 −2
  assert.equal(costParametre({ tipus: "arma", base: "espasa", latencia: 1, dany: 2 }, P).cost, 0);
  assert.equal(costParametre({ tipus: "arma", base: "espasa", latencia: 2, dany: 4 }, P).cost, 2);
  assert.equal(costParametre({ tipus: "armaduraBase", base: "pesant", latencia: 0, proteccio: 10 }, P).cost, 16);
});

test("compatibilitat amb la selecció antiga del constructor", () => {
  const sel = {
    tipus: "efecte", abast: "distancia", objectius: "individuals", durada: "instantania",
    usTemps: "ambdos", usAccio: "accio", dany: { categoria: "indirecte", tipus: "electricitat", nivell: 4 },
    estats: [], habilitats: []
  };
  assert.deepEqual(seleccioAParametres(sel), [
    { tipus: "distancia" },
    { tipus: "dany", categoria: "indirecte", nivell: 4, danyTipus: "electricitat" }
  ]);
  // Descàrrega del manual sense la latència declarada (+2, −4 PC): 16 PC, dificultat 1
  const r = calcularConstruccio(sel);
  assert.equal(r.cost, 16);
  assert.equal(r.dificultat, 1);
});
