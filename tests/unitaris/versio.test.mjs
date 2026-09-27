import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
// Arrel del repo, relativa a aquest fitxer (tests/unitaris/ → ../../).
const REPO = fileURLToPath(new URL("../../", import.meta.url)).replace(/\/$/, "");
const llegeix = (f) => readFileSync(`${REPO}/${f}`, "utf8");

// Control de versions (docs/VERSIONS.md): una sola versió, present al CHANGELOG.
const versioSistema = JSON.parse(llegeix("system.json")).version;
const versioPaquet  = JSON.parse(llegeix("package.json")).version;
assert.match(versioSistema, /^\d+\.\d+\.\d+$/, "system.json: la versió ha de ser X.Y.Z");
assert.equal(versioPaquet, versioSistema, "package.json i system.json han de tenir la mateixa versió");

const log = llegeix("CHANGELOG.md");
assert.ok(log.includes("## [Pendent]"), "CHANGELOG.md ha de tenir una secció [Pendent]");
assert.ok(log.includes(`## [${versioSistema}] - `), `CHANGELOG.md no té cap entrada per a la versió ${versioSistema}`);
// Les versions del CHANGELOG van de la més nova a la més antiga.
const versions = [...log.matchAll(/^## \[(\d+\.\d+\.\d+)\]/gm)].map(m => m[1].split(".").map(Number));
for (let i = 1; i < versions.length; i++) {
  const [a, b] = [versions[i - 1], versions[i]];
  const mesNova = a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  assert.ok(mesNova > 0, `CHANGELOG.md: ${a.join(".")} hauria d'anar abans que ${b.join(".")}`);
}
assert.equal(versions[0].join("."), versioSistema, "la versió més recent del CHANGELOG ha de ser la de system.json");

console.log(`versió ${versioSistema}: OK`);
