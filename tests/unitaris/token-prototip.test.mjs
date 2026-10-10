// Token prototip que segueix el retrat de l'actor (contingut/token-prototip.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { texturaPrototipNova } from "../../module/contingut/token-prototip.mjs";

const SIS = "systems/forja/assets/tokens/criatures/hekate-katydid-acherontia-xj748.webp";

test("token del sistema, genèric o igual al retrat: segueix el retrat nou", () => {
  assert.equal(texturaPrototipNova({ imgAnterior: SIS, imgNova: "x/Katydid.png", srcPrototip: SIS }), "x/Katydid.png");
  assert.equal(texturaPrototipNova({ imgAnterior: "a.png", imgNova: "b.png", srcPrototip: "icons/svg/mystery-man.svg" }), "b.png");
  assert.equal(texturaPrototipNova({ imgAnterior: "a.png", imgNova: "b.png", srcPrototip: "a.png" }), "b.png");
});

test("token personalitzat, o el canvi ja toca el prototip: no es toca", () => {
  assert.equal(texturaPrototipNova({ imgAnterior: "a.png", imgNova: "b.png", srcPrototip: "tokens/propi.png" }), null);
  assert.equal(texturaPrototipNova({ imgAnterior: SIS, imgNova: "b.png", srcPrototip: SIS, canviaPrototip: true }), null);
  assert.equal(texturaPrototipNova({ imgAnterior: "a.png", imgNova: null, srcPrototip: "a.png" }), null);
});
