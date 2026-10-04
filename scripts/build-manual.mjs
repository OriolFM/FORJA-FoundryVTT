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
 * M-13 (enllaços creuats): el manual original ja conté referències internes
 * explícites del tipus "Defensa (pàg. 40)" / "veure Reaccions a la pàg. 80".
 * Aquestes referències apunten sempre a subapartats `###`/`####` (no a les
 * pàgines `##` senceres, molt més genèriques — p. ex. tot "Combat" és una
 * sola pàgina de ~450 línies). Per això, en lloc de fer que cada `###`/`####`
 * sigui la seva pròpia pàgina (explotaria el nombre de pàgines i trencaria
 * la navegació ja validada de S-32), s'injecten ids d'ancoratge estables a
 * cada capçalera `###`/`####` dins l'HTML de cada pàgina, i les referències
 * "(pàg. N)" es converteixen en enllaços `@UUID[...]{...}` que Foundry
 * enriqueix en renderitzar — vegeu `_construirIndexCapcaleres`,
 * `_convertirReferencies` i `_slug`. Només es converteixen referències on
 * la frase prèvia coincideix EXACTAMENT (en majúscula) amb un títol
 * `##`/`###`/`####` ja existent — si no hi ha coincidència clara, es deixa
 * el text tal qual (millor cap enllaç que un d'incorrecte).
 *
 * Ús: node scripts/build-manual.mjs
 * Requereix: npm install (marked). El pas de compilació a LevelDB
 * (`npx @foundryvtt/foundryvtt-cli package pack ...`) és un pas separat,
 * encadenat a `npm run build:manual`.
 * Variable d'entorn FORJA_MD_DIR: ruta personalitzada a la carpeta de Markdown
 * (per defecte: ../../FOUNDRY/MD respecte al root del projecte).
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { marked } from "marked";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT       = resolve(__dirname, "..");
const MD_DIR     = process.env.FORJA_MD_DIR ? resolve(process.env.FORJA_MD_DIR) : resolve(ROOT, "../../FOUNDRY/MD");
const OUT_DIR    = resolve(ROOT, "packs/_source/manual");

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** Genera un id de 16 caràcters determinista (estable entre regeneracions) a partir d'una clau. */
function deterministicId(key) {
  const hash = createHash("sha1").update(key).digest();
  let id = "";
  for (let i = 0; i < 16; i++) id += ID_CHARS[hash[i] % ID_CHARS.length];
  return id;
}

/** Normalitza un text a un slug estable (minúscules, sense accents, guions). Fet
 *  servir tant per als ids d'ancoratge HTML com per fer coincidir referències. */
function _slug(s) {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\*\*/g, "")
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Divideix el cos d'un capítol (sense la línia `# Títol`) en seccions per
 * capçalera de nivell 2. Retorna [{ nom, linies: [{num, text}] }], amb
 * "Introducció" com a primera entrada si hi ha contingut abans de la
 * primera `##`. Cada línia porta el seu número original de fitxer (base 1,
 * comptant des de l'inici del fitxer, no del cos) per poder-hi assignar
 * després les capçaleres ###/#### trobades en un escaneig separat.
 */
function dividirEnSeccions(linies, offsetInicial, titolCapitol) {
  const seccions = [];
  let actual = { nom: "Introducció", linies: [] };

  linies.forEach((text, idx) => {
    const num = offsetInicial + idx + 1;
    const m = text.match(/^##\s+(.+?)\s*$/);
    if (m) {
      if (actual.linies.some(l => l.text.trim())) seccions.push(actual);
      actual = { nom: m[1].replace(/\*\*/g, ""), linies: [] };
      return;
    }
    actual.linies.push({ num, text });
  });
  if (actual.linies.some(l => l.text.trim())) seccions.push(actual);

  if (seccions.length === 0) {
    seccions.push({ nom: titolCapitol, linies: linies.map((text, idx) => ({ num: offsetInicial + idx + 1, text })) });
  }
  return seccions;
}

/**
 * PAS 1: llegeix tots els fitxers i construeix, per a cadascun, el trencat
 * en seccions `##` (amb journalId/pageId ja calculats), i alhora un índex
 * pla de TOTES les capçaleres ##/###/#### (necessari per fer coincidir
 * referències creuades i saber a quina pàgina/ancoratge apunta cadascuna).
 * S'exclou FORJA_README.md de l'índex de referències: és un sumari del
 * propi document de disseny, no contingut del manual, i els seus títols de
 * capítol duplicarien slugs amb els títols reals (p. ex. "Capítol 1 · ...").
 */
function construirIndex(fitxers) {
  const capitols = []; // { fitxer, titol, journalId, seccions: [{nom, pageId, idx, linies}] }
  const capcaleres = []; // { nivell, text, slug, fitxer, linia, journalId, pageId, ancoratge }

  for (const fitxer of fitxers) {
    const text = readFileSync(resolve(MD_DIR, fitxer), "utf8");
    const totesLinies = text.split("\n");
    const capçaleraIdx = totesLinies.findIndex(l => /^#\s+/.test(l));
    const titol = capçaleraIdx >= 0 ? totesLinies[capçaleraIdx].replace(/^#\s+/, "").trim() : basename(fitxer, ".md");
    const cosLinies = totesLinies.slice(capçaleraIdx + 1);
    const journalId = deterministicId(`journal:${fitxer}`);

    const seccionsRaw = dividirEnSeccions(cosLinies, capçaleraIdx + 1, titol);
    const seccions = seccionsRaw.map((s, idx) => ({
      nom: s.nom, idx, linies: s.linies,
      pageId: deterministicId(`page:${fitxer}:${s.nom}:${idx}`)
    }));
    capitols.push({ fitxer, titol, journalId, seccions });

    if (fitxer === "FORJA_README.md") continue;

    // Capçaleres de pàgina (##): l'ancoratge és null (la pàgina sencera ÉS el destí).
    for (const s of seccions) {
      capcaleres.push({
        nivell: 2, text: s.nom, slug: _slug(s.nom),
        fitxer, linia: s.linies[0]?.num ?? 0,
        journalId, pageId: s.pageId, ancoratge: null
      });
    }
    // Capçaleres ###/#### dins de cada secció: calen ancoratge d'id HTML.
    for (const s of seccions) {
      for (const { num, text: lTxt } of s.linies) {
        const m = lTxt.match(/^(#{3,4})\s+(.+?)\s*$/);
        if (!m) continue;
        const nivell = m[1].length;
        const titolText = m[2].replace(/\*\*/g, "");
        capcaleres.push({
          nivell, text: titolText, slug: _slug(titolText),
          fitxer, linia: num,
          journalId, pageId: s.pageId, ancoratge: _slug(titolText)
        });
      }
    }
  }

  // Per fer coincidir referències, preferim els títols MÉS LLARGS/específics
  // primer (evita que "Dany" es mengi una coincidència més precisa com
  // "Dany mínim" o "Tipus de dany" quan totes dues serien vàlides).
  capcaleres.sort((a, b) => b.slug.length - a.slug.length);

  return { capitols, capcaleres };
}

/**
 * Cerca totes les citacions "pàg. N" / "pàgina N" dins `linies` (array de
 * {num, text} d'UNA secció) i, per a cada una, l'ocurrència en MAJÚSCULA
 * d'un títol conegut que acaba més a prop (dins la mateixa frase, delimitada
 * per . ! ? o ") "). Retorna les línies amb les frases coincidents
 * embolcallades en `@UUID[...]{...}` (Foundry ho enriqueix en renderitzar).
 */
function convertirReferencies(linies, capcaleres, fitxerActual) {
  const reCitacio = /p[àa]g(?:ina)?\.?\s*(\d+|XXX)/gi;

  return linies.map(({ num, text: original }) => {
    // Mai reescriure una línia de capçalera.
    if (/^#{1,6}\s/.test(original)) return { num, text: original };
    if (!reCitacio.test(original)) return { num, text: original };

    // 1a passada (read-only, sobre el text ORIGINAL sense tocar): troba totes
    // les citacions i, per a cadascuna, el millor tram [inici,fi) a enllaçar.
    reCitacio.lastIndex = 0;
    const trams = []; // { inici, fi, capcalera }
    let cm;
    while ((cm = reCitacio.exec(original))) {
      const abansCitacio = original.slice(0, cm.index);
      const iniciFrase = Math.max(
        abansCitacio.lastIndexOf(". "), abansCitacio.lastIndexOf("! "),
        abansCitacio.lastIndexOf("? "), abansCitacio.lastIndexOf(") ")
      );
      const finestraInici = iniciFrase >= 0 ? iniciFrase + 2 : 0;
      const finestraText = original.slice(finestraInici, cm.index);

      let millor = null, millorInici = -1, millorFi = -1;
      for (const t of capcaleres) {
        if (t.fitxer === fitxerActual && t.linia === num) continue; // no auto-referència
        const escapat = t.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
        const re = new RegExp(`(?<![a-zà-ÿA-ZÀ-Ÿ])${escapat}(?![a-zà-ÿA-ZÀ-Ÿ])`, "g");
        let om;
        while ((om = re.exec(finestraText))) {
          if (!/^[A-ZÀ-Ý]/.test(om[0])) continue;
          const fi = om.index + om[0].length;
          if (fi > millorFi) { millorFi = fi; millorInici = om.index; millor = t; }
        }
      }
      if (millor) trams.push({ inici: finestraInici + millorInici, fi: finestraInici + millorFi, capcalera: millor });
    }
    if (!trams.length) return { num, text: original };

    // 2a passada: aplica els trams (com que no se superposen mai — cadascun
    // acaba abans de la seva pròpia citació i la citació següent comença
    // després—, es poden aplicar d'esquerra a dreta sense recalcular índexs
    // si ho fem construint el resultat de cop enlloc de mutar la cadena).
    let resultat = "";
    let cursor = 0;
    for (const { inici, fi, capcalera } of trams) {
      if (inici < cursor) continue; // seguretat: descarta solapaments inesperats
      const frase = original.slice(inici, fi);
      // Prefix "Compendium.forja.manual." obligatori: els destins viuen dins
      // el compendi, no com a documents de món — sense el prefix, Foundry
      // intenta resoldre l'UUID contra les col·leccions de món i l'enllaç
      // surt "broken" (detectat en viu, vegeu 09_CONTEXT_SESSIONS.md).
      const uuid = `Compendium.forja.manual.JournalEntry.${capcalera.journalId}.JournalEntryPage.${capcalera.pageId}` +
        (capcalera.ancoratge ? `#${capcalera.ancoratge}` : "");
      resultat += original.slice(cursor, inici) + `@UUID[${uuid}]{${frase}}`;
      cursor = fi;
    }
    resultat += original.slice(cursor);
    return { num, text: resultat };
  });
}

function mdToHtml(md) {
  // Renderer amb ids d'ancoratge estables (mateix `_slug` fet servir a
  // l'índex de capçaleres) per a h3/h4 — necessaris perquè els enllaços
  // amb "#ancoratge" generats a convertirReferencies puguin apuntar-hi.
  const renderer = new marked.Renderer();
  renderer.heading = ({ tokens, depth }) => {
    const text = renderer.parser.parseInline(tokens);
    const plain = tokens.map(t => t.raw ?? "").join("");
    const id = depth >= 3 ? ` id="${_slug(plain)}"` : "";
    return `<h${depth}${id}>${text}</h${depth}>\n`;
  };
  marked.setOptions({ gfm: true, breaks: false, renderer });
  return marked.parse(md.trim());
}

function main() {
  // Check if MD_DIR exists and contains .md files BEFORE any deletion
  if (!existsSync(MD_DIR)) {
    console.error(`No s'ha trobat la carpeta de Markdown: ${MD_DIR}. Defineix FORJA_MD_DIR.`);
    process.exit(1);
  }

  const fitxers = readdirSync(MD_DIR).filter(f => f.endsWith(".md")).sort();

  if (fitxers.length === 0) {
    console.error(`No s'ha trobat cap fitxer .md a: ${MD_DIR}. Defineix FORJA_MD_DIR.`);
    process.exit(1);
  }

  // Now safe to delete and recreate OUT_DIR
  if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const { capitols, capcaleres } = construirIndex(fitxers);

  let totalPagines = 0;
  let totalEnllacos = 0;

  for (const cap of capitols) {
    const pages = cap.seccions.map(s => {
      const liniesEnllacades = convertirReferencies(s.linies, capcaleres, cap.fitxer);
      totalEnllacos += liniesEnllacades.filter((l, i) => l.text !== s.linies[i].text).length;
      const markdown = liniesEnllacades.map(l => l.text).join("\n");
      return {
        _id: s.pageId,
        _key: `!journal.pages!${cap.journalId}.${s.pageId}`,
        name: s.nom.slice(0, 128) || `Secció ${s.idx + 1}`,
        type: "text",
        title: { show: true, level: 1 },
        text: { format: 1, content: mdToHtml(markdown) },
        sort: (s.idx + 1) * 100000,
        flags: {}
      };
    });

    const entry = {
      _id: cap.journalId,
      _key: `!journal!${cap.journalId}`,
      name: cap.titol,
      pages,
      folder: null,
      sort: 0,
      ownership: { default: 0 },
      flags: {}
    };

    const nomSortida = basename(cap.fitxer, ".md").toLowerCase() + ".json";
    writeFileSync(resolve(OUT_DIR, nomSortida), JSON.stringify(entry, null, 2), "utf8");
    totalPagines += pages.length;
    console.log(`${cap.fitxer} -> ${nomSortida} (${pages.length} pàgines)`);
  }

  console.log(`\n${fitxers.length} capítols, ${totalPagines} pàgines totals, ${totalEnllacos} línies amb enllaç(os) nou(s) -> ${OUT_DIR}`);
}

main();
