import assert from "node:assert/strict";
// Arrel del repo, relativa a aquest fitxer (tests/unitaris/ → ../../).
// URL file:// (no ruta): a Windows, import() no accepta rutes com E:\...
const REPO = new URL("../../", import.meta.url).href.replace(/\/$/, "");
globalThis.Roll = class {};
globalThis.game = { i18n: { localize: k => k, format: k => k } };
const { triarDefensaAutomatica } = await import(`${REPO}/module/combat/defensa.mjs`);

// Defensa automàtica dels PNJ (Oriol FM, 2026-09-27): tria sense preguntar.
const opcions = (disponible = true) => [
  { id: "passiva",  disponible: true },
  { id: "esquivar", disponible, pool: 4 },
  { id: "parar",    disponible, pool: 6 },
  { id: "blocar",   disponible }
];

assert.equal(triarDefensaAutomatica(opcions(), ""), null);              // sense mode → cal preguntar
assert.equal(triarDefensaAutomatica(opcions(), undefined), null);
assert.equal(triarDefensaAutomatica(opcions(), "passiva").id, "passiva");
assert.equal(triarDefensaAutomatica(opcions(), "millor").id, "parar");  // la de més daus
assert.equal(triarDefensaAutomatica(opcions(false), "millor").id, "passiva");  // sense reacció
assert.equal(triarDefensaAutomatica(opcions(), "esquivar").id, "esquivar");
assert.equal(triarDefensaAutomatica(opcions(false), "esquivar").id, "passiva");
assert.equal(triarDefensaAutomatica(opcions(), "blocar").id, "blocar");
// Empat de daus: es queda la primera (esquivar)
assert.equal(triarDefensaAutomatica([{ id: "passiva", disponible: true }, { id: "esquivar", disponible: true, pool: 5 }, { id: "parar", disponible: true, pool: 5 }], "millor").id, "esquivar");

console.log("defensa automàtica: OK");
