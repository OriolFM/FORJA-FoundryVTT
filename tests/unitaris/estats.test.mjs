// Regles dels estats (Fase 1, docs/PLA-MANUAL-COMPLET.md; manual l. 3546–3695).
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  restriccionsEstats, tipusAccioBloquejats, movimentsPermesosPerEstats,
  estatsPerSalut, pistaRecuperacio, marcatsDespresRecuperacio, poolTiradaEstat
} from "../../module/estats/regles-estats.mjs";

test("sense estats: ho pot fer tot", () => {
  const r = restriccionsEstats([]);
  assert.equal(r.potActuar, true);
  assert.equal(r.potMoure, true);
  assert.equal(r.potCorrer, true);
  assert.equal(r.potEsquivar, true);
  assert.equal(r.potDefensaActiva, true);
  assert.equal(r.latenciaExtra, 0);
  assert.equal(r.reaccionsExtra, 0);
  assert.deepEqual(tipusAccioBloquejats(r), { atac: null, defensa: null, moviment: null, altra: null, manifestar: null, artefacte: null });
});

test("abatut: +2 latència, no corre ni esquiva, però es mou i para", () => {
  const r = restriccionsEstats(["abatut"]);
  assert.equal(r.latenciaExtra, 2);
  assert.equal(r.potMoure, true);
  assert.equal(r.potCorrer, false);
  assert.equal(r.motiuCorrer, "abatut");
  assert.equal(r.potEsquivar, false);
  assert.equal(r.potDefensaActiva, true);
  assert.deepEqual(movimentsPermesosPerEstats(["basic", "rapid", "especial", "carrega"], r), ["basic", "especial"]);
});

test("atrapat: no es mou ni esquiva, pot parar i blocar", () => {
  const r = restriccionsEstats(["atrapat"]);
  assert.equal(r.potMoure, false);
  assert.equal(r.motiuMoure, "atrapat");
  assert.equal(r.potEsquivar, false);
  assert.equal(r.potDefensaActiva, true);
  assert.equal(r.defensaBasica1, false);
  assert.equal(tipusAccioBloquejats(r).moviment, "atrapat");
  assert.deepEqual(movimentsPermesosPerEstats(["basic", "rapid", "especial"], r), ["basic"]);
});

test("immobilitzat: no es mou, defensa bàsica 1, pot esquivar? no s'hi diu: sí", () => {
  const r = restriccionsEstats(["immobilitzat"]);
  assert.equal(r.potMoure, false);
  assert.equal(r.defensaBasica1, true);
  assert.equal(r.potDefensaActiva, true);
});

test("inconscient, incapacitat i marejat: no poden actuar", () => {
  for (const id of ["inconscient", "incapacitat", "marejat"]) {
    const r = restriccionsEstats([id]);
    assert.equal(r.potActuar, false, id);
    assert.equal(r.motiuActuar, id);
    assert.equal(r.potMoure, false, id);
    assert.equal(r.potDefensaActiva, false, id);
    const t = tipusAccioBloquejats(r);
    assert.deepEqual(Object.values(t), [id, id, id, id, id, id]);
  }
});

test("acovardit: només defensa o moviment", () => {
  const t = tipusAccioBloquejats(restriccionsEstats(["acovardit"]));
  assert.equal(t.atac, "acovardit");
  assert.equal(t.altra, "acovardit");
  assert.equal(t.defensa, null);
  assert.equal(t.moviment, null);
});

test("berserc: cap defensa activa, sense penalització de salut", () => {
  const r = restriccionsEstats(["berserc"]);
  assert.equal(r.potDefensaActiva, false);
  assert.equal(r.potEsquivar, false);
  assert.equal(r.potConcentrar, false);
  assert.equal(r.ignoraPenalitzacio, true);
  assert.equal(tipusAccioBloquejats(r).defensa, "berserc");
  assert.equal(tipusAccioBloquejats(r).atac, null);
});

test("vigilant: +1 reacció; atordit: perd l'acció", () => {
  assert.equal(restriccionsEstats(["vigilant"]).reaccionsExtra, 1);
  assert.equal(restriccionsEstats(["atordit"]).perdAccio, true);
});

test("salut: fatiga 7 → inconscient; ferides 7 → incapacitat", () => {
  assert.deepEqual(estatsPerSalut(7, 3), { inconscient: true, incapacitat: false });
  assert.deepEqual(estatsPerSalut(2, 7), { inconscient: false, incapacitat: true });
  assert.deepEqual(estatsPerSalut(6, 6), { inconscient: false, incapacitat: false });
});

test("recuperació: la condició més greu; si empaten, la fatiga", () => {
  const s = (fn, fm, rn, rm) => ({ fatiga: { nivellActiu: fn, marcats: fm }, ferides: { nivellActiu: rn, marcats: rm } });
  assert.equal(pistaRecuperacio(s(3, 8, 3, 7)), "fatiga");
  assert.equal(pistaRecuperacio(s(2, 4, 3, 7)), "ferides");
  assert.equal(pistaRecuperacio(s(1, 0, 1, 2)), "ferides");
  assert.equal(pistaRecuperacio(s(1, 0, 1, 0)), null);
});

test("recuperació: des del nivell 7 passa al 6; si no, resta X", () => {
  assert.equal(marcatsDespresRecuperacio(18, 3, 2), 17); // 6×3 = nivell 7 → 17 (nivell 6)
  assert.equal(marcatsDespresRecuperacio(19, 3, 2), 17);
  assert.equal(marcatsDespresRecuperacio(10, 3, 2), 8);
  assert.equal(marcatsDespresRecuperacio(1, 3, 2), 0);
});

test("tirada d'atrapat: la millor alternativa", () => {
  const sys = {
    atributs: { FOR: 2, DES: 4 },
    habilitats: { "forca-bruta": { nivell: 1 }, "arts-marcials": { nivell: 2 } }
  };
  assert.deepEqual(poolTiradaEstat("atrapat", sys), { pool: 6, atribut: "DES", habilitat: "arts-marcials" });
  assert.equal(poolTiradaEstat("abatut", sys), null);
});
