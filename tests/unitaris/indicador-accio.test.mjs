// Acció declarada damunt del token (combat/indicador-accio.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { liniesAccio } from "../../module/combat/indicador-accio.mjs";

const t = (k, d) => (k === "FORJA.Combat.Tic" ? `Tic ${d.n}` : k.split(".").at(-1));

test("atac amb objectiu: tipus, arma, tic i objectiu amb direcció", () => {
  const l = liniesAccio({ tipus: "atac", etiqueta: "Cop — Combinació" }, { posicio: 11, objectiu: { nom: "Guàrdia", fletxa: "↗", distancia: 3.8 }, t });
  assert.deepEqual(l, ["Atac: Cop — Combinació · Tic 11", "→ Guàrdia (↗ 3.8 m)"]);
});

test("sense detall ni objectiu, i sense acció declarada", () => {
  const d = { caminar: 5, correr: 13 };
  assert.deepEqual(liniesAccio({ tipus: "moviment", moviment: "basic", etiqueta: "Només moviment — Moviment bàsic (caminar)" }, { posicio: 9, distancies: d, t }), ["Moviment 5 m · Tic 9"]);
  assert.deepEqual(liniesAccio({ tipus: "moviment", moviment: "rapid" }, { posicio: 9, distancies: d, t }), ["MovimentRapid 13 m · Tic 9"]);
  assert.deepEqual(liniesAccio({ tipus: "moviment" }, { posicio: 7, t }), ["Moviment · Tic 7"]);
  assert.deepEqual(liniesAccio({ tipus: "atac", label: "Urpes" }, { objectiu: { nom: "Yoko-1", aTocar: true }, t }), ["Atac: Urpes", "→ Yoko-1 (ObjectiuATocar)"]);
  assert.deepEqual(liniesAccio(null, { t }), []);
});
