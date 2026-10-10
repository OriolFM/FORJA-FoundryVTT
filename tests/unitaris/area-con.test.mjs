// Con dels trets d'àrea en llàgrima (combat/area-con.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { dinsCon, direccioCap, direccioDeRotacio, poligonCon } from "../../module/combat/area-con.mjs";

const con = { origen: { x: 0, y: 0 }, direccio: 0, llargada: 1000, obertura: 15 };

test("dins: a l'eix, dins l'arc i la llargada; fora: massa lluny, massa obert, darrere", () => {
  assert.equal(dinsCon(con, { x: 500, y: 0 }), true);
  assert.equal(dinsCon(con, { x: 500, y: 60 }), true);     // ~6.8°
  assert.equal(dinsCon(con, { x: 500, y: 80 }), false);    // ~9.1° > 7.5°
  assert.equal(dinsCon(con, { x: 1100, y: 0 }), false);
  assert.equal(dinsCon(con, { x: -500, y: 0 }), false);
  assert.equal(dinsCon(con, { x: 0, y: 0 }), false);
});

test("direccions: cap a un punt, des de la rotació del token, i a través de 0°/360°", () => {
  assert.equal(direccioCap({ x: 0, y: 0 }, { x: 0, y: 10 }), 90);     // cap avall
  assert.equal(direccioDeRotacio(0), 90);                                // rotació 0 = mira avall
  assert.equal(direccioDeRotacio(90), 180);                              // mira a l'esquerra
  assert.equal(dinsCon({ ...con, direccio: 355 }, { x: 500, y: 20 }), true);
});

test("polígon: origen + arc", () => {
  const p = poligonCon(con, 2);
  assert.equal(p.length, 2 + 3 * 2);
  assert.deepEqual(p.slice(0, 2), [0, 0]);
});
