// Recompte de fites i adepte/inepte per àmbits (module/dice/fites.mjs).
// Manual › Tirades; › Trets (Adepte l. 1332, Inepte l. 1597), per àmbits (Oriol FM, 2026-10-06).
import { test } from "node:test";
import assert from "node:assert/strict";
import { comptarFites, aptitudsDelsTrets, AMBITS } from "../../module/dice/fites.mjs";

test("tirada normal: ≥6 una fita, 10 dues, pífia sense fites i amb algun 1", () => {
  assert.deepEqual(comptarFites([6, 10, 3]), { fites: 3, hasOnes: false, pifia: false, unsRestats: 0 });
  assert.equal(comptarFites([1, 2, 5]).pifia, true);
  assert.equal(comptarFites([1, 6]).pifia, false);
});

test("inepte: el 10 val una fita i cada 1 en resta una", () => {
  assert.equal(comptarFites([10, 7], { inepte: true }).fites, 2);
  assert.deepEqual(comptarFites([10, 7, 1], { inepte: true }), { fites: 1, hasOnes: true, pifia: false, unsRestats: 1 });
  // Més 1 que fites: pífia encara que hi hagi alguna fita (Oriol FM, 2026-10-06).
  assert.deepEqual(comptarFites([6, 1, 1], { inepte: true }), { fites: 0, hasOnes: true, pifia: true, unsRestats: 1 });
  assert.equal(comptarFites([6, 7, 1], { inepte: true }).pifia, false);   // 2 fites − 1 = 1 fita
  assert.equal(comptarFites([6, 7, 1, 1], { inepte: true }).pifia, true);  // tants 1 com fites: cap fita i algun 1
});

test("aptituds dels trets: només adepte/inepte d'un àmbit vàlid", () => {
  const items = [
    { type: "tret", flags: { forja: { catalegId: "adepte-social" } } },
    { type: "tret", flags: { forja: { catalegId: "inepte-tecnic" } } },
    { type: "tret", flags: { forja: { catalegId: "adepte-for" } } },
    { type: "arma", flags: { forja: { catalegId: "adepte-mental" } } }
  ];
  assert.deepEqual(aptitudsDelsTrets(items), [{ tipus: "adepte", ambit: "social" }, { tipus: "inepte", ambit: "tecnic" }]);
  assert.deepEqual(AMBITS, ["fisic", "mental", "social", "tecnic"]);
});
