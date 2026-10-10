// Tret del catàleg per identificador o per nom (data/trets-cataleg.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { tretDelCataleg } from "../../module/data/trets-cataleg.mjs";

const llista = [{ id: "dur-de-pelar", nom: "Dur de Pelar", efecte: { flag: "ignoraPenalitzacioFerides" } }, { id: "vigilant", nom: "Vigilant" }];

test("per identificador, per nom (sense majúscules) o res", () => {
  assert.equal(tretDelCataleg({ name: "x", flags: { forja: { catalegId: "dur-de-pelar" } } }, llista).id, "dur-de-pelar");
  assert.equal(tretDelCataleg({ name: "Dur de Pelar" }, llista).id, "dur-de-pelar");
  assert.equal(tretDelCataleg({ name: "  dur de pelar " }, llista).id, "dur-de-pelar");
  assert.equal(tretDelCataleg({ name: "Inventat" }, llista), null);
  assert.equal(tretDelCataleg({ name: "Vigilant", flags: { forja: { catalegId: "no-existeix" } } }, llista), null);
});
