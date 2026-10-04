#!/usr/bin/env node
/**
 * Tanca una versió del sistema FORJA (vegeu docs/VERSIONS.md).
 *
 *   npm run versio -- patch|minor|major|X.Y.Z
 *
 * 1. Calcula la versió nova a partir de la de package.json.
 * 2. Escriu la versió a package.json i a system.json (mantenint el format).
 * 3. Al CHANGELOG.md, converteix el contingut de "## [Pendent]" en
 *    "## [X.Y.Z] - AAAA-MM-DD", deixa una secció "Pendent" buida i actualitza
 *    els enllaços de comparació del peu.
 *
 * 4. En els canvis MAJOR i MINOR, actualitza el graf de coneixement del codi
 *    amb graphify (`graphify update .`, local, sense cost d'API), si està
 *    instal·lat. La sortida (`graphify-out/`) no va a git.
 *
 * No fa cap commit ni cap etiqueta: mostra les ordres per fer-ho, perquè es
 * pugui revisar el canvi abans. S'atura si la secció "Pendent" és buida o si
 * la versió nova no és més gran que l'actual.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ARREL = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const camí  = (f) => resolve(ARREL, f);
const REPO_URL = "https://github.com/OriolFM/FORJA-FoundryVTT";

function error(msg) { console.error(`versio: ${msg}`); process.exit(1); }

const parse = (v) => {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v ?? "");
  if (!m) error(`versió no vàlida: "${v}" (cal X.Y.Z)`);
  return m.slice(1).map(Number);
};
const compara = (a, b) => { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };

const arg = process.argv[2];
if (!arg) error("indica patch, minor, major o una versió X.Y.Z");

const pkgText = readFileSync(camí("package.json"), "utf8");
const actual  = JSON.parse(pkgText).version;
const [ma, mi, pa] = parse(actual);
let nova;
if (arg === "patch") nova = `${ma}.${mi}.${pa + 1}`;
else if (arg === "minor") nova = `${ma}.${mi + 1}.0`;
else if (arg === "major") nova = `${ma + 1}.0.0`;
else nova = arg;
if (compara(parse(nova), parse(actual)) <= 0) error(`la versió nova (${nova}) ha de ser més gran que l'actual (${actual})`);

// --- CHANGELOG ---
const log = readFileSync(camí("CHANGELOG.md"), "utf8");
const inici = log.indexOf("## [Pendent]");
if (inici < 0) error("CHANGELOG.md no té cap secció \"## [Pendent]\"");
const despres = log.indexOf("\n## [", inici + 1);
const cosPendent = log.slice(inici + "## [Pendent]".length, despres < 0 ? undefined : despres).trim();
if (!cosPendent.replace(/^###.*$/gm, "").trim()) error("la secció \"Pendent\" del CHANGELOG és buida: no hi ha res a publicar");

const avui = new Date().toISOString().slice(0, 10);
let nouLog = log.slice(0, inici)
  + `## [Pendent]\n\n## [${nova}] - ${avui}\n\n${cosPendent}\n`
  + (despres < 0 ? "" : log.slice(despres));
nouLog = nouLog.replace(/^\[Pendent\]: .*$/m,
  `[Pendent]: ${REPO_URL}/compare/v${nova}...HEAD\n[${nova}]: ${REPO_URL}/compare/v${actual}...v${nova}`);

// --- package.json i system.json (substitució de text per no alterar el format) ---
const substitueixVersio = (fitxer) => {
  const text = readFileSync(camí(fitxer), "utf8");
  const nou = text.replace(/("version"\s*:\s*")[^"]*(")/, `$1${nova}$2`);
  if (nou === text) error(`no s'ha trobat "version" a ${fitxer}`);
  writeFileSync(camí(fitxer), nou);
};
substitueixVersio("package.json");
substitueixVersio("system.json");
writeFileSync(camí("CHANGELOG.md"), nouLog);

// --- graphify en els canvis grans (petició de l'usuari, 2026-09-27) ---
let notaGraf = "";
if (arg === "major" || arg === "minor" || parse(nova)[2] === 0) {
  const candidats = [process.env.GRAPHIFY, "graphify", resolve(homedir(), ".local/bin/graphify")].filter(Boolean);
  const bin = candidats.find(c => c.includes("/") ? existsSync(c) : spawnSync("which", [c]).status === 0);
  if (!bin) notaGraf = "\nAvís: graphify no està instal·lat; el graf no s'ha actualitzat (uv tool install graphifyy).";
  else {
    const r = spawnSync(bin, ["update", "."], { cwd: ARREL, stdio: "inherit" });
    notaGraf = r.status === 0 ? "\nGraf de coneixement actualitzat (graphify-out/)." : "\nAvís: graphify ha fallat; revisa-ho a mà (graphify update .).";
  }
}

console.log(`Versió ${actual} → ${nova}. Fitxers actualitzats: package.json, system.json, CHANGELOG.md.

Revisa el canvi i, si és correcte:
  npm test
  git add package.json system.json CHANGELOG.md
  git commit -m "Versió ${nova}"
  git tag -a v${nova} -m "Versió ${nova}"${notaGraf}`);
