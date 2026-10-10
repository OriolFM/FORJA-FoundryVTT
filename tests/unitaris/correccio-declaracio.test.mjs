// Corregir una declaració i tornar a declarar si l'objectiu cau (combat/correccio-declaracio.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { potCorregir, posicioBaseRedeclaracio, posicioCorregida, potRedeclararPerObjectiu } from "../../module/combat/correccio-declaracio.mjs";

test("qui pot corregir: el DJ sempre; el declarant si el rellotge no s'ha mogut; ningú si ja s'ha resolt", () => {
  const pendent = { tipus: "atac", declaradaAlMarcador: 6 };
  assert.equal(potCorregir({ esDJ: true, pendent, marcador: 9 }), true);
  assert.equal(potCorregir({ esDJ: false, pendent, marcador: 6 }), true);
  assert.equal(potCorregir({ esDJ: false, pendent, marcador: 7 }), false);
  assert.equal(potCorregir({ esDJ: true, pendent, marcador: 6, estatTorn: "resolta" }), false);
  assert.equal(potCorregir({ esDJ: true, pendent: null, marcador: 6 }), false);
});

test("posició: des de la base de la declaració, mai enrere del marcador", () => {
  assert.equal(posicioBaseRedeclaracio({ posicioBase: 6, declaradaAlMarcador: 6 }, { marcador: 6, initiative: 13 }), 6);
  assert.equal(posicioBaseRedeclaracio({ declaradaAlMarcador: 4 }, { marcador: 6, initiative: 11 }), 4);   // declaracions antigues
  assert.equal(posicioBaseRedeclaracio({ posicioBase: 6, objectiuCaigutAl: 9 }, { marcador: 10, initiative: 13, perObjectiuCaigut: true }), 9);
  assert.equal(posicioCorregida(6, 5, 6), 11);
  assert.equal(posicioCorregida(2, 3, 9), 9);
});

test("tornar a declarar quan l'objectiu ha caigut", () => {
  assert.equal(potRedeclararPerObjectiu({ objectiuCaigutAl: 9 }), true);
  assert.equal(potRedeclararPerObjectiu({ objectiuCaigutAl: 0 }), true);
  assert.equal(potRedeclararPerObjectiu({}), false);
});
