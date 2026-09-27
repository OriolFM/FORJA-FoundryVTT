#!/usr/bin/env node
import { fileURLToPath } from "node:url";
// Arrel del repo, relativa a aquest fitxer (tests/unitaris/ → ../../).
const REPO = fileURLToPath(new URL("../../", import.meta.url)).replace(/\/$/, "");
/**
 * Llista totes les claus i18n (FORJA.x i TYPES.x) que el codi de FORJA-FoundryVTT
 * fa servir, expandint les famílies dinàmiques a partir de les dades reals
 * (constants.mjs, data models, JSON de catàlegs), i les compara amb
 * lang/ca.json, lang/es.json, lang/en.json.
 *
 * Ús: node claus-i18n.mjs /ruta/al/repo
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.argv[2] || REPO;

function walk(dir, exts, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, exts, out);
    else if (exts.some(e => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

const mjsFiles = [
  ...walk(path.join(ROOT, "module"), [".mjs"]),
  path.join(ROOT, "forja.mjs")
];
const hbsFiles = walk(path.join(ROOT, "templates"), [".hbs"]);
const allTextFiles = [...mjsFiles, ...hbsFiles];

const used = new Set(); // literal keys found directly
const families = {}; // familyPrefix -> Set of full keys (after expansion)

function addUsed(k) { if (k) used.add(k); }

// ---- 1. Literal "FORJA.…" / "TYPES.…" strings (quoted) ----
// Exclude: keys ending in "." (a `concat`/`localize (concat "FORJA.X." var)`
// prefix, not a real key on its own) and keys containing "_" (those are
// CONFIG.FORJA data-table names mentioned in JSDoc/comments via backticks,
// e.g. `FORJA.ATAC_PER_ARMA`, `FORJA.CATALEG_ESTATS` — never i18n keys, which
// in this codebase always use PascalCase/hyphenated segments, no underscore).
const literalRe = /["'`]((?:FORJA|TYPES)\.[A-Za-zÀ-ÿ0-9_.]+)["'`]/g;
for (const f of allTextFiles) {
  const txt = fs.readFileSync(f, "utf8");
  let m;
  while ((m = literalRe.exec(txt))) {
    const k = m[1];
    if (k.endsWith(".") || k.includes("_")) continue;
    addUsed(k);
  }
}

// system.json labels
{
  const sys = JSON.parse(fs.readFileSync(path.join(ROOT, "system.json"), "utf8"));
  for (const pack of sys.packs ?? []) {
    // pack.label is plain text (not an i18n key) here, skip.
  }
}

// ---- 2. Dynamic families, expanded from real data ----

// FORJA.Hab.<id> from LLISTA_HABILITATS (constants.mjs)
const constantsTxt = fs.readFileSync(path.join(ROOT, "module/config/constants.mjs"), "utf8");
{
  const habIds = [...constantsTxt.matchAll(/id:\s*"([a-z-]+)",\s*nom:\s*"FORJA\.Hab\.[a-z-]+"/g)].map(m => m[1]);
  for (const id of habIds) addUsed(`FORJA.Hab.${id}`);
}

// FORJA.Mida.1-5, FORJA.Constitucio.1-5 (_opcionsNumeriques(prefix,1,5))
for (let i = 1; i <= 5; i++) { addUsed(`FORJA.Mida.${i}`); addUsed(`FORJA.Constitucio.${i}`); }

// FORJA.NivellFatiga.1-7, FORJA.NivellFerides.1-7 (nivell 1..7, veure actor-personatge.mjs)
for (let i = 1; i <= 7; i++) { addUsed(`FORJA.NivellFatiga.${i}`); addUsed(`FORJA.NivellFerides.${i}`); }

// FORJA.Attr.<attr> from FORJA.ATRIBUTS + Especie/Mida/Constitucio (already literal in template as FORJA.Attr.Especie etc.)
const atributsMatch = constantsTxt.match(/FORJA\.ATRIBUTS\s*=\s*\[([^\]]+)\]/);
if (atributsMatch) {
  for (const a of atributsMatch[1].match(/"([A-Z]+)"/g) ?? []) {
    addUsed(`FORJA.Attr.${a.replace(/"/g, "")}`);
  }
}

// FORJA.Especie.<id> from COST_ESPECIE keys
const especieMatch = constantsTxt.match(/FORJA\.COST_ESPECIE\s*=\s*\{([^}]+)\}/);
if (especieMatch) {
  for (const k of especieMatch[1].matchAll(/([a-z]+):\s*-?\d+/g)) addUsed(`FORJA.Especie.${k[1]}`);
}

// FORJA.TierOpcio.<id> from actor-pnj.mjs choices
const pnjTxt = fs.readFileSync(path.join(ROOT, "module/data/actor-pnj.mjs"), "utf8");
{
  const choicesMatch = pnjTxt.match(/tier:[\s\S]*?choices:\s*\[([^\]]+)\]/);
  if (choicesMatch) {
    for (const c of choicesMatch[1].match(/"([a-z]+)"/g) ?? []) addUsed(`FORJA.TierOpcio.${c.replace(/"/g, "")}`);
  }
}

// FORJA.Arma.Categoria.<id> from item-arma.mjs choices
const armaTxt = fs.readFileSync(path.join(ROOT, "module/data/item-arma.mjs"), "utf8");
{
  const m = armaTxt.match(/categoria:[\s\S]*?choices:\s*\[([^\]]+)\]/);
  if (m) for (const c of m[1].match(/"(\w+)"/g) ?? []) addUsed(`FORJA.Arma.Categoria.${c.replace(/"/g, "")}`);
}

// FORJA.Armadura.Tipus.<id> from item-armadura.mjs choices
const armaduraTxt = fs.readFileSync(path.join(ROOT, "module/data/item-armadura.mjs"), "utf8");
{
  const m = armaduraTxt.match(/tipus:[\s\S]*?choices:\s*\[([^\]]+)\]/);
  if (m) for (const c of m[1].match(/"(\w+)"/g) ?? []) addUsed(`FORJA.Armadura.Tipus.${c.replace(/"/g, "")}`);
}

// FORJA.Artefacte.Categoria.<id> / FORJA.Artefacte.Activacio.<id> from item-artefacte.mjs choices
const artefacteTxt = fs.readFileSync(path.join(ROOT, "module/data/item-artefacte.mjs"), "utf8");
{
  const mCat = artefacteTxt.match(/categoria:\s*new fields\.StringField\(\{[\s\S]*?choices:\s*\[([^\]]+)\]/);
  if (mCat) for (const c of mCat[1].match(/"(\w+)"/g) ?? []) addUsed(`FORJA.Artefacte.Categoria.${c.replace(/"/g, "")}`);
  const mAct = artefacteTxt.match(/tipus:\s*new fields\.StringField\(\{[\s\S]*?choices:\s*\[([^\]]+)\]/);
  if (mAct) for (const c of mAct[1].match(/"(\w+)"/g) ?? []) addUsed(`FORJA.Artefacte.Activacio.${c.replace(/"/g, "")}`);
}

// FORJA.Combat.Rang.<banda> from abast.mjs BANDES_DISTANCIA ids
const abastTxt = fs.readFileSync(path.join(ROOT, "module/combat/abast.mjs"), "utf8");
for (const m of abastTxt.matchAll(/\{\s*id:\s*"([a-zA-Z]+)"/g)) addUsed(`FORJA.Combat.Rang.${m[1]}`);

// FORJA.Estat.<id> from estats.json + the hardcoded "mort"
const estatsJson = JSON.parse(fs.readFileSync(path.join(ROOT, "module/config/dades/estats.json"), "utf8"));
addUsed("FORJA.Estat.mort");
for (const e of estatsJson) addUsed(`FORJA.Estat.${e.id}`);

// FORJA.Combat.Defensa.<id>Desc / <id>ReaccioDesc  (defensa.mjs: desc(id) called with "Esquivar","Parar","Blocar")
for (const id of ["Esquivar", "Parar", "Blocar"]) {
  addUsed(`FORJA.Combat.Defensa.${id}Desc`);
  addUsed(`FORJA.Combat.Defensa.${id}ReaccioDesc`);
}
addUsed("FORJA.Combat.Defensa.Passiva");
addUsed("FORJA.Combat.Defensa.PassivaReaccioDesc");
addUsed("FORJA.Combat.Defensa.Esquivar");
addUsed("FORJA.Combat.Defensa.Parar");
addUsed("FORJA.Combat.Defensa.Blocar");

// FORJA.Combat.Blocar.Mitja.<id> from propietats.mjs mitjansBlocar ids
addUsed("FORJA.Combat.Blocar.Mitja.resistencia");
addUsed("FORJA.Combat.Blocar.Mitja.escut");
addUsed("FORJA.Combat.Blocar.Mitja.improvisat");

// FORJA.Salut.<pista> from full-actor-base.mjs `FORJA.Salut.${pista}` (pista = "fatiga"|"ferides")
addUsed("FORJA.Salut.fatiga");
addUsed("FORJA.Salut.ferides");

// TYPES.Actor.* / TYPES.Item.* from system.json documentTypes + forja.mjs dataModels
const sys = JSON.parse(fs.readFileSync(path.join(ROOT, "system.json"), "utf8"));
for (const actorType of Object.keys(sys.documentTypes?.Actor ?? {})) addUsed(`TYPES.Actor.${actorType}`);
for (const itemType of Object.keys(sys.documentTypes?.Item ?? {})) addUsed(`TYPES.Item.${itemType}`);

// concat (TYPES.Item.<type>) in item-body.hbs -- already covered by TYPES.Item.* above

// ---- Load lang files ----
function loadLang(name) {
  const p = path.join(ROOT, "lang", name);
  const txt = fs.readFileSync(p, "utf8");
  return { keys: new Set(Object.keys(JSON.parse(txt))), data: JSON.parse(txt), text: txt };
}

const ca = loadLang("ca.json");
const es = loadLang("es.json");
const en = loadLang("en.json");

// `_opcionsNumeriques("FORJA.Mida", 1, 5)` / `("FORJA.Constitucio", 1, 5)` in
// full-actor-base.mjs pass the literal string as a PREFIX (`${prefix}.${i}`,
// expanded above as FORJA.Mida.1..5 / FORJA.Constitucio.1..5), not a key on
// its own — drop the bare prefix forms picked up by the literal-string scan.
used.delete("FORJA.Mida");
used.delete("FORJA.Constitucio");

const usedSorted = [...used].sort();

console.log(`Total claus USADES (literal+dinàmiques, expandides): ${usedSorted.length}`);
console.log(`ca.json: ${ca.keys.size} claus`);
console.log(`es.json: ${es.keys.size} claus`);
console.log(`en.json: ${en.keys.size} claus`);

const missingInCa = usedSorted.filter(k => !ca.keys.has(k));
console.log(`\n=== Claus usades que FALTEN a ca.json (${missingInCa.length}) ===`);
missingInCa.forEach(k => console.log(" -", k));

const unusedInCa = [...ca.keys].filter(k => !used.has(k)).sort();
console.log(`\n=== Claus de ca.json MAI usades pel codi (${unusedInCa.length}) ===`);
unusedInCa.forEach(k => console.log(" -", k));

// Key-set parity across the three files
const caKeys = [...ca.keys].sort();
const esKeys = [...es.keys].sort();
const enKeys = [...en.keys].sort();
const missingEs = caKeys.filter(k => !es.keys.has(k));
const missingEn = caKeys.filter(k => !en.keys.has(k));
const extraEs = esKeys.filter(k => !ca.keys.has(k));
const extraEn = enKeys.filter(k => !ca.keys.has(k));
console.log(`\n=== Paritat de claus ===`);
console.log(`es.json: falten ${missingEs.length}, sobren ${extraEs.length}`);
console.log(`en.json: falten ${missingEn.length}, sobren ${extraEn.length}`);
if (missingEs.length) console.log("  falten a es:", missingEs.slice(0, 20));
if (missingEn.length) console.log("  falten a en:", missingEn.slice(0, 20));
if (extraEs.length) console.log("  sobren a es:", extraEs);
if (extraEn.length) console.log("  sobren a en:", extraEn);

// Placeholder parity {xxx}
function placeholders(str) {
  return new Set([...String(str).matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map(m => m[1]));
}
console.log(`\n=== Paritat de placeholders {…} ===`);
let phProblems = 0;
for (const k of caKeys) {
  const caPh = placeholders(ca.data[k]);
  if (caPh.size === 0) continue;
  for (const [langName, lang] of [["es", es], ["en", en]]) {
    if (!(k in lang.data)) continue; // reported above as missing
    const otherPh = placeholders(lang.data[k]);
    const missing = [...caPh].filter(p => !otherPh.has(p));
    const extra = [...otherPh].filter(p => !caPh.has(p));
    if (missing.length || extra.length) {
      phProblems++;
      console.log(` - ${k} (${langName}): ca={${[...caPh]}} ${langName}={${[...otherPh]}}${missing.length ? " MISSING:" + missing : ""}${extra.length ? " EXTRA:" + extra : ""}`);
    }
  }
}
if (!phProblems) console.log("Cap problema de placeholders.");

// JSON parse validity
for (const [name, obj] of [["ca.json", ca], ["es.json", es], ["en.json", en]]) {
  try { JSON.parse(obj.text); console.log(`${name}: JSON vàlid.`); }
  catch (e) { console.log(`${name}: JSON INVALID -- ${e.message}`); }
}

process.exitCode = (missingInCa.length || missingEs.length || missingEn.length || extraEs.length || extraEn.length || phProblems) ? 1 : 0;
