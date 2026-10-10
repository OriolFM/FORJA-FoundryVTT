#!/usr/bin/env node
/**
 * Compila tots els compendis (LevelDB) a partir de les fonts JSON:
 *   packs/_source/<compendi>/                       → packs/<compendi>/
 *   moduls/<mòdul>/packs/_source/<compendi>/        → moduls/<mòdul>/packs/<compendi>/
 *
 * Els compendis compilats NO van a git (Oriol FM, 2026-10-10): Foundry els
 * reescriu cada cop que s'obre el món, i sortien sempre com a canvis pendents.
 * A git només hi ha les fonts. Cal executar-lo després de clonar el
 * repositori, quan canvien les fonts i abans de fer el paquet d'una versió
 * (`npm run versio` el crida). Amb el món obert, Foundry té els compendis
 * bloquejats: cal tancar-lo abans.
 *
 * No regenera les fonts (això ho fan `build:packs`, `build:manual-docs`…).
 *
 * Ús: npm run compila
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compilePack } from "@foundryvtt/foundryvtt-cli";

const ARREL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Carpetes `packs` amb fonts: la del sistema i les dels mòduls d'aventura. */
function carpetesPacks() {
  const carpetes = [path.join(ARREL, "packs")];
  const moduls = path.join(ARREL, "moduls");
  if (fs.existsSync(moduls)) {
    for (const m of fs.readdirSync(moduls)) {
      const p = path.join(moduls, m, "packs");
      if (fs.existsSync(path.join(p, "_source"))) carpetes.push(p);
    }
  }
  return carpetes;
}

let total = 0, errors = 0;
for (const carpeta of carpetesPacks()) {
  const fonts = path.join(carpeta, "_source");
  for (const nom of fs.readdirSync(fonts).filter(n => fs.statSync(path.join(fonts, n)).isDirectory()).sort()) {
    const desti = path.join(carpeta, nom);
    try {
      fs.rmSync(desti, { recursive: true, force: true });
      await compilePack(path.join(fonts, nom), desti, { log: false });
      total++;
      console.log(`✔ ${path.relative(ARREL, desti)}`);
    } catch (err) {
      errors++;
      console.error(`✖ ${path.relative(ARREL, desti)}: ${err.message}`);
      if (/lock/i.test(err.message)) console.error("  Sembla que Foundry té el món obert: tanca'l i torna-ho a provar.");
    }
  }
}
console.log(`${total} compendis compilats${errors ? `, ${errors} amb errors` : ""}.`);
process.exitCode = errors ? 1 : 0;
