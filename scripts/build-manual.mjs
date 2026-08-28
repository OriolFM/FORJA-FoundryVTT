#!/usr/bin/env node
/**
 * Genera les fonts JSON del compendi "Manual FORJA" (S-24 → S-32) a partir
 * dels capítols en Markdown ja convertits del manual complet
 * (E:\Onedrive\HOBBIES\FORJA_RPG\FOUNDRY\MD\*.md).
 *
 * Cada fitxer .md esdevé un JournalEntry (el seu `# Títol` és el nom);
 * cada secció de nivell 2 (`## ...`) esdevé una JournalEntryPage — el text
 * introductori abans de la primera secció (si n'hi ha) esdevé la pàgina
 * "Introducció". No hi ha automatització de regles aquí: és purament
 * transcripció de contingut de referència per al DJ (S-32, 🟢 reaprofitable).
 *
 * Ús: node scripts/build-manual.mjs
 * Requereix: npm install (marked). El pas de compilació a LevelDB
 * (`npx @foundryvtt/foundryvtt-cli package pack ...`) és un pas separat,
 * encadenat a `npm run build:manual`.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { marked } from "marked";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT       = resolve(__dirname, "..");
const MD_DIR     = resolve(ROOT, "../../FOUNDRY/MD");
const OUT_DIR    = resolve(ROOT, "packs/_source/manual");

marked.setOptions({ gfm: true, breaks: false });

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** Genera un id de 16 caràcters determinista (estable entre regeneracions) a partir d'una clau. */
function deterministicId(key) {
  const hash = createHash("sha1").update(key).digest();
  let id = "";
  for (let i = 0; i < 16; i++) id += ID_CHARS[hash[i] % ID_CHARS.length];
  return id;
}

function mdToHtml(md) {
  return marked.parse(md.trim());
}

/**
 * Divideix el cos d'un capítol (sense la línia `# Títol`) en seccions per
 * capçalera de nivell 2. Retorna [{ nom, markdown }], amb "Introducció"
 * com a primera entrada si hi ha contingut abans de la primera `##`.
 */
function dividirEnSeccions(body, titolCapitol) {
  const linies = body.split("\n");
  const seccions = [];
  let actual = { nom: "Introducció", linies: [] };

  for (const linia of linies) {
    const m = linia.match(/^##\s+(.+?)\s*$/);
    if (m) {
      if (actual.linies.some(l => l.trim())) seccions.push(actual);
      actual = { nom: m[1].replace(/\*\*/g, ""), linies: [] };
      continue;
    }
    actual.linies.push(linia);
  }
  if (actual.linies.some(l => l.trim())) seccions.push(actual);

  if (seccions.length === 0) seccions.push({ nom: titolCapitol, linies: body.split("\n") });

  return seccions.map(s => ({ nom: s.nom, markdown: s.linies.join("\n") }));
}

function construirJournalEntry(fitxer) {
  const text = readFileSync(resolve(MD_DIR, fitxer), "utf8");
  const linies = text.split("\n");

  const capçaleraIdx = linies.findIndex(l => /^#\s+/.test(l));
  const titol = capçaleraIdx >= 0 ? linies[capçaleraIdx].replace(/^#\s+/, "").trim() : basename(fitxer, ".md");
  const body = linies.slice(capçaleraIdx + 1).join("\n");

  const seccions = dividirEnSeccions(body, titol);
  const journalId = deterministicId(`journal:${fitxer}`);

  const pages = seccions.map((s, idx) => {
    const pageId = deterministicId(`page:${fitxer}:${s.nom}:${idx}`);
    return {
      _id: pageId,
      _key: `!journal.pages!${journalId}.${pageId}`,
      name: s.nom.slice(0, 128) || `Secció ${idx + 1}`,
      type: "text",
      title: { show: true, level: 1 },
      text: { format: 1, content: mdToHtml(s.markdown) },
      sort: (idx + 1) * 100000,
      flags: {}
    };
  });

  return {
    _id: journalId,
    _key: `!journal!${journalId}`,
    name: titol,
    pages,
    folder: null,
    sort: 0,
    ownership: { default: 0 },
    flags: {}
  };
}

function main() {
  if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const fitxers = readdirSync(MD_DIR).filter(f => f.endsWith(".md")).sort();
  let totalPagines = 0;

  for (const fitxer of fitxers) {
    const entry = construirJournalEntry(fitxer);
    const nomSortida = basename(fitxer, ".md").toLowerCase() + ".json";
    writeFileSync(resolve(OUT_DIR, nomSortida), JSON.stringify(entry, null, 2), "utf8");
    totalPagines += entry.pages.length;
    console.log(`${fitxer} -> ${nomSortida} (${entry.pages.length} pàgines)`);
  }

  console.log(`\n${fitxers.length} capítols, ${totalPagines} pàgines totals -> ${OUT_DIR}`);
}

main();
