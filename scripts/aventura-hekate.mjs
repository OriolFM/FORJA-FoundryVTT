/**
 * Actors de l'aventura «La porta d'Hèkate» (moduls/forja-la-porta-dhekate/font)
 * per a `scripts/build-packs.mjs` (Oriol FM, 2026-10-06).
 *
 * El mòdul (esborrany v0.2) fa servir una versió anterior de les regles. Es
 * converteix així (decisió de l'Oriol FM, 2026-10-06):
 * - Constitució, esglaó a esglaó: feble → magra (2), saludable → saludable (3),
 *   robusta → ferma (4), massissa → robusta (5).
 * - Mida: col·losal → enorme (5); la resta, pel nom.
 * - Es mantenen atributs, habilitats i trets; el cost i els derivats es
 *   recalculen amb les regles actuals i les diferències es publiquen a
 *   `moduls/forja-la-porta-dhekate/CONVERSIO.md`.
 *
 * Torna blocs amb la mateixa forma que `analitzarManual` (els trets ja
 * reescrits amb la sintaxi del manual), més `aventura`, `prefixSlug` i
 * `pcInicials`.
 */
import fs from "node:fs";
import path from "node:path";

export const AVENTURA = {
  id: "hekate",
  nom: "La porta d'Hèkate",
  font: "moduls/forja-la-porta-dhekate/font",
  informe: "moduls/forja-la-porta-dhekate/CONVERSIO.md"
};

const CONSTITUCIO = {
  feble: ["magra", 2], saludable: ["saludable", 3], robusta: ["ferma", 4], massissa: ["robusta", 5],
  // Noms que ja són de les regles actuals (alguns PJ pregenerats els fan servir).
  nyicris: ["nyicris", 1], magra: ["magra", 2], ferma: ["ferma", 4]
};
const MIDA = {
  diminuta: ["diminuta", 1], petita: ["petita", 2], mitjana: ["mitjana", 3],
  gran: ["gran", 4], enorme: ["enorme", 5], "col·losal": ["enorme", 5]
};
const ARMA_NATURAL = { ullals: "mossegada", urpes: "urpes", pinces: "pinces", banyes: "banyes", fiblons: "fiblons" };
const ESPECIE_PER_ETIQUETA = { androide: "mecanoide" };

const treuHTML = t => t.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const majuscula = t => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * Reescriu un tret del mòdul amb la sintaxi del manual. Torna `{ tret }`,
 * `{ especie }` o `{ tret, nota }`.
 */
export function reescriureTret(text) {
  let t = text.trim().replace(/\.$/, "");
  let m;
  if ((m = t.match(/^espècie\s*[-/]\s*(.+)$/i))) return { especie: m[1].trim() };
  if ((m = t.match(/^arma natural\s*-\s*(.+)$/i))) {
    const arma = ARMA_NATURAL[m[1].trim().toLowerCase()];
    return arma ? { tret: `armament natural/${arma}` } : { tret: t };
  }
  if ((m = t.match(/^membres addicionals\s*-\s*braços\s*\/\s*(\d+)$/i))) return { tret: `braços addicionals/${m[1]}` };
  if ((m = t.match(/^membres addicionals\s*-\s*cames o potes\s*\/\s*(\d+)$/i))) return { tret: `potes addicionals/${m[1]}` };
  if ((m = t.match(/^aparença(?: alterada)?\s*\/\s*(.+)$/i))) return { tret: `aparença/${m[1].trim()}` };
  if ((m = t.match(/^(adepte|inepte|recursos)\s*[-/]\s*(.+)$/i))) return { tret: `${m[1]}/${m[2].trim()}` };
  if ((m = t.match(/^curació ràpida\s*\/\s*$/i))) return { tret: "curació ràpida/1", nota: "«curació ràpida/» sense valor: s'ha pres X=1" };
  if ((m = t.match(/^reflexes ràpids(?:\s*\/\s*\d+)?$/i))) return { tret: "reflexos ràpids" };
  if ((m = t.match(/^especialista\s*\/\s*\d+$/i))) return { tret: "especialista" };
  return { tret: t };
}

/**
 * Atributs secundaris en el format del manual a partir del text del mòdul
 * («mida mitjana, constitució saludable, …, latència 7, defensa 11, …»).
 * @returns {{ secundaris: string|null, notes: string[] }}
 */
function secundarisDe(text, especie) {
  const notes = [];
  const mm = text.match(/mida ([a-zà-ú·]+)/i);
  const mc = text.match(/constitució ([a-zà-ú·]+)/i);
  const num = re => text.match(re)?.[1];
  const mida = MIDA[mm?.[1]?.toLowerCase()];
  const cons = CONSTITUCIO[mc?.[1]?.toLowerCase()];
  if (!mida || !cons) return { secundaris: null, notes };
  if (mm[1].toLowerCase() !== mida[0]) notes.push(`mida «${mm[1]}» → ${mida[0]} (${mida[1]})`);
  if (mc[1].toLowerCase() !== cons[0]) notes.push(`constitució «${mc[1]}» → ${cons[0]} (${cons[1]})`);
  const secundaris = `${majuscula(especie)}. Constitució ${cons[0]} (${cons[1]}), mida ${mida[0]} (${mida[1]}), ` +
    `latència ${num(/latència (\d+)/)}, defensa ${num(/defensa (-?\d+)/)}, ` +
    `reducció de dany ${num(/reducció de dany (\d+)/)}, reacció ${num(/reacció (\d+)/) ?? 1}`;
  return { secundaris, notes };
}

/** Separa trets en espècie i trets reescrits (amb notes). */
function processarTrets(text, especiePerDefecte) {
  let especie = especiePerDefecte;
  const trets = [];
  const notes = [];
  for (const tros of text.replace(/\.$/, "").split(",")) {
    if (!tros.trim()) continue;
    const r = reescriureTret(tros);
    if (r.especie) { especie = r.especie; continue; }
    trets.push(r.tret);
    if (r.nota) notes.push(r.nota);
  }
  return { especie, trets: trets.join(", "), notes };
}

/** PJ pregenerats: taules HTML del capítol d'introducció. */
function analitzarPregenerats(text, fitxer) {
  const blocs = [];
  for (const taula of text.match(/<table>[\s\S]*?<\/table>/g) ?? []) {
    const files = [...taula.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(m => m[1]);
    const cap = treuHTML(files[0] ?? "").match(/^(.*?)\s+(\d+)\s*PC$/i);
    if (!cap || files.length < 6) continue;
    const nom = cap[1].split(" ").map(p => /^[A-ZÀ-Ú]+$/.test(p) ? majuscula(p.toLowerCase()) : p).join(" ");
    const cel = f => [...f.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => treuHTML(m[1]));
    const descripcio = [...(files[1].match(/<p>([\s\S]*?)<\/p>/g) ?? [])].map(treuHTML);
    const primaris = cel(files[2]).join(", ");
    const secText = cel(files[3])[0] ?? "";
    const habilitats = cel(files[4])[0] ?? "";
    const tretsText = cel(files[5])[0] ?? "";
    const equip = files[6] ? cel(files[6])[0] : "";
    const { especie, trets, notes } = processarTrets(tretsText, secText.match(/espècie\/([a-zà-ú]+)/i)?.[1] ?? "humanoide");
    const sec = secundarisDe(secText, especie);
    blocs.push({
      nom, etiqueta: "Personatge Jugador", cost: parseInt(cap[2], 10), linia: 0, fitxer,
      primaris, secundaris: sec.secundaris, habilitats, trets, equip: [],
      descripcio: [], previ: [...descripcio, ...(equip ? [equip] : [])], prosa: "",
      seccio: "pj", notesConversio: [...sec.notes, ...notes], pcInicials: parseInt(cap[2], 10)
    });
  }
  return blocs;
}

/** PNJ i criatures: blocs «### Nom» amb camps en negreta. */
function analitzarPNJ(text, fitxer) {
  const blocs = [];
  const linies = text.split("\n");
  let grup = "";
  for (let i = 0; i < linies.length; i++) {
    const g = linies[i].match(/^## (.+)$/);
    if (g) { grup = g[1].trim(); continue; }
    const h = linies[i].match(/^### (.+)$/);
    if (!h) continue;
    let fi = i + 1;
    while (fi < linies.length && !/^#{2,3} /.test(linies[fi])) fi++;
    const cos = linies.slice(i + 1, fi).join("\n");
    const camp = nom => cos.match(new RegExp(`\\*\\*\\*${nom}\\*\\*\\*:\\s*(.+)`, "i"))?.[1]?.trim() ?? null;
    const liniaCost = cos.split("\n").find(l => /Cost/i.test(l)) ?? "";
    const cost = parseInt(liniaCost.match(/Cost[*:\s]*(\d+)\s*PC/i)?.[1], 10);
    const etiqueta = liniaCost.replace(/\*/g, "").replace(/\.?\s*Cost.*$/i, "").trim();
    const atributs = camp("Atributs");
    if (!atributs || !Number.isFinite(cost)) continue;
    const primaris = (atributs.match(/\b(FOR|DES|AGI|PER|INT|APL)\s+\d\b/g) ?? []).join(", ");
    const tipus = normalitzarEtiqueta(etiqueta);
    const esCriatura = grup === "Criatures";
    const especieEtiqueta = ESPECIE_PER_ETIQUETA[etiqueta.split(",")[1]?.trim().toLowerCase()];
    const { especie, trets, notes } = processarTrets(camp("Trets") ?? "", especieEtiqueta ?? "humanoide");
    const sec = secundarisDe(atributs, especie);
    const equip = [];
    for (const clau of ["Artefactes", "Efectes"]) {
      if (camp(clau)) equip.push({ etiqueta: clau, text: camp(clau).replace(/Cibermòdem \(interfície neural directa\)/g, "Cibermòdem d'interfície neural directa") });
    }
    const descripcio = [];
    const equipText = camp("Equipament") ?? camp("Equip");
    if (equipText) descripcio.push(`Equipament: ${equipText}`);
    const iNotes = cos.search(/\*\*\*Notes\*\*\*:/i);
    if (iNotes >= 0) {
      for (const p of cos.slice(iNotes).replace(/\*\*\*Notes\*\*\*:\s*/i, "").split(/\n\s*\n/)) {
        const net = p.replace(/\n/g, " ").trim();
        if (net) descripcio.push(net);
      }
    }
    blocs.push({
      nom: h[1].trim().replace(/\s+\d+\s*PC$/i, ""), etiqueta: esCriatura ? "Criatura" : "Personatge No Jugador",
      cost, linia: 0, fitxer, primaris, secundaris: sec.secundaris,
      habilitats: camp("Habilitats"), trets, equip, descripcio, previ: [], prosa: "",
      seccio: esCriatura ? "criatures" : tipus, grup,
      notesConversio: [...sec.notes, ...notes]
    });
  }
  return blocs;
}

/** «Secundària, dèlfica» → secundaris; «Figurant(s)» → figurants; «Nèmesi» → nemesis. */
function normalitzarEtiqueta(etiqueta) {
  const e = etiqueta.toLowerCase();
  if (e.startsWith("figurant")) return "figurants";
  if (e.startsWith("nèmesi")) return "nemesis";
  return "secundaris";
}

/**
 * Tots els blocs d'actor de l'aventura.
 * @param {string} arrel  Arrel del repositori.
 */
export function analitzarAventura(arrel) {
  const dir = path.join(arrel, AVENTURA.font);
  if (!fs.existsSync(dir)) return [];
  const blocs = [];
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".md")).sort()) {
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    const rel = `${AVENTURA.font}/${f}`;
    blocs.push(...analitzarPregenerats(text, rel), ...analitzarPNJ(text, rel));
  }
  for (const b of blocs) {
    b.aventura = AVENTURA.id;
    b.prefixSlug = `${AVENTURA.id}-`;
  }
  return blocs;
}
