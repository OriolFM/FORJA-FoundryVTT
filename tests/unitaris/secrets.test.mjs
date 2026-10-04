// Cap fitxer del repositori pot contenir secrets (claus d'API, tokens,
// contrasenyes, claus privades). El repositori és públic: si aquesta prova
// falla, treu el secret, posa el fitxer al .gitignore i canvia la clau.
// (2026-10-04: es va pujar per error la clau de FORJAPP dins de la
// configuració del món de proves.)
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../", import.meta.url));

// Els patrons es construeixen per parts perquè aquest fitxer no es detecti a si mateix.
const PATRONS = [
  ["clau de Google/Firebase", new RegExp("AI" + "za[0-9A-Za-z_-]{30,}")],
  ["clau d'Anthropic",        new RegExp("sk-" + "ant-[A-Za-z0-9_-]{10,}")],
  ["clau d'OpenAI",           new RegExp("sk-" + "(proj-)?[A-Za-z0-9]{32,}")],
  ["token de GitHub",         new RegExp("gh" + "[pousr]_[A-Za-z0-9]{30,}")],
  ["token de Slack",          new RegExp("xox" + "[baprs]-[0-9A-Za-z-]{10,}")],
  ["clau privada",            new RegExp("-----BEGIN [A-Z ]*PRIV" + "ATE KEY-----")],
  ["clau d'AWS",              new RegExp("AK" + "IA[0-9A-Z]{16}")]
];

const fitxers = execSync("git ls-files -z", { cwd: REPO, encoding: "utf8" }).split("\0").filter(Boolean);
const trobats = [];
for (const f of fitxers) {
  let contingut;
  try { contingut = readFileSync(REPO + f).toString("latin1"); } catch { continue; } // esborrat a disc
  for (const [nom, re] of PATRONS) {
    if (re.test(contingut)) trobats.push(`${f}: ${nom}`);
  }
}

assert.deepEqual(trobats, [], `Secrets al repositori:\n  ${trobats.join("\n  ")}`);
console.log(`secrets: ${fitxers.length} fitxers revisats, cap secret`);
