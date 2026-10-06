#!/usr/bin/env node
/**
 * Fase 5 (pla del manual complet): genera les fonts JSON dels compendis de
 * contingut del sistema (`packs/_source/<pack>/<slug>.json`) a partir del
 * manual (`docs/FORJA_FC001CA_CORE.md`) i dels catàlegs de
 * `module/config/dades/*.json`, perquè el contingut estigui disponible a
 * Foundry sense FORJAPP/Firebase.
 *
 * Compendis d'Actor:  pj, pnj, animals, criatures  (blocs d'estadístiques del manual)
 * Compendis d'Item:   trets, armes, armadures, artefactes, efectes  (catàlegs)
 * (Les maniobres d'arts marcials NO són un tipus d'Item: només són una llista
 * de dades consultada en declarar un "Cop" -- `FORJA.LLISTA_MANIOBRES` --, per
 * això no tenen compendi.)
 *
 * Sense dependències (només mòduls natius de Node). Tot allò que no es pot
 * mapar es registra a `docs/CONTINGUT-INFORME.md`; mai s'ometen dades en silenci.
 *
 * Ús:  node scripts/build-packs.mjs
 * L'empaquetat a LevelDB el fa `npm run build:packs` (CLI de Foundry).
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { AVENTURA, analitzarAventura } from "./aventura-hekate.mjs";

const ARREL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANUAL = path.join(ARREL, "docs/FORJA_FC001CA_CORE.md");
const DADES = path.join(ARREL, "module/config/dades");
const FONTS = path.join(ARREL, "packs/_source");
const INFORME = path.join(ARREL, "docs/CONTINGUT-INFORME.md");
const TOKENS = path.join(ARREL, "assets/tokens");

export const PACKS_ACTOR = ["pj", "pnj", "animals", "criatures"];
export const PACKS_ITEM = ["trets", "armes", "armadures", "artefactes", "efectes"];

/* ------------------------------------------------------------------ */
/* Utilitats                                                           */
/* ------------------------------------------------------------------ */

const llegirJSON = f => JSON.parse(fs.readFileSync(path.join(DADES, f), "utf8"));

/** Minúscules, sense accents ni signes: per comparar noms del manual i dels catàlegs. */
export function normalitzar(text) {
  return String(text).normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function slug(text) {
  return normalitzar(text).replace(/ /g, "-");
}

const ALFABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** _id determinista de 16 caràcters alfanumèrics a partir d'una clau (hash). */
export function idDeterminista(clau) {
  const hash = crypto.createHash("sha256").update(clau).digest();
  let id = "";
  for (let i = 0; i < 16; i++) id += ALFABET[hash[i] % ALFABET.length];
  return id;
}

/** Treu escapaments i marques de Markdown del text del manual. */
function netejarText(text) {
  return text
    .replace(/\\\.\.\./g, "…")
    .replace(/\\([\\'"`*_{}\[\]()#+\-.!~|<>])/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\{\.[^}]*\}/g, "$1")
    .replace(/\s+/g, " ").trim();
}

const escapaHTML = t => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const aHTML = paragrafs => paragrafs.map(p => `<p>${escapaHTML(netejarText(p))}</p>`).join("");

/* ------------------------------------------------------------------ */
/* Configuració (taules de cost), llegida de constants.mjs              */
/* ------------------------------------------------------------------ */

/**
 * constants.mjs fa un `await fetch` de nivell superior i no es pot importar
 * a Node: se n'extreuen les taules amb una regex (font única de veritat).
 */
export function carregarConfig() {
  const font = fs.readFileSync(path.join(ARREL, "module/config/constants.mjs"), "utf8");
  const extreu = nom => {
    const m = font.match(new RegExp(`FORJA\\.${nom}\\s*=\\s*([\\s\\S]*?);\\s*\\n`));
    if (!m) throw new Error(`No es troba FORJA.${nom} a constants.mjs`);
    return Function(`"use strict"; return (${m[1]});`)();
  };
  const habs = [...font.matchAll(/\{ id: "([a-z-]+)",\s+nom: "FORJA\.Hab\.[a-z-]+",\s+attr: "[A-Z]{3}", tipus: "(?:basica|restringida)" \}/g)]
    .map(m => m[1]);
  return {
    COST_ATRIBUT: extreu("COST_ATRIBUT"),
    COST_ESPECIE: extreu("COST_ESPECIE"),
    COST_MIDA: extreu("COST_MIDA"),
    COST_CONSTITUCIO: extreu("COST_CONSTITUCIO"),
    COST_HABILITAT: extreu("COST_HABILITAT"),
    MIDA_DEFENSA: extreu("MIDA_DEFENSA"),
    HABILITATS: habs
  };
}

/* ------------------------------------------------------------------ */
/* Catàlegs                                                            */
/* ------------------------------------------------------------------ */

export function carregarCatalegs() {
  return {
    trets: llegirJSON("trets.json"),
    armes: llegirJSON("armes.json"),
    armadures: llegirJSON("armadures.json"),
    artefactes: llegirJSON("artefactes.json"),
    efectes: llegirJSON("efectes.json")
  };
}

/** Mateix mapeig que `ARMAMENT_NATURAL_PER_TRET` (module/combat/equipament-automatic.mjs). */
const ARMAMENT_NATURAL_PER_TRET = {
  "armament-urpes": "urpes",
  "armament-mossegada": "ullals",
  "armament-banyes": "banyes",
  "armament-pinces": "pinces",
  "armament-fiblons": "fiblons-i-espines"
};

/** Camps de `system` per tipus: còpia de `_dadesSystemPerTipus` (equipament-automatic.mjs). */
export function dadesSystem(tipus, e) {
  switch (tipus) {
    case "arma":
      return {
        categoria: e.categoria, modLatencia: e.modLatencia, abast: e.abast,
        rangMultFor: e.rangMultFor ?? 0, esEscut: e.esEscut ?? false,
        danyBase: e.danyBase, maniobra: e.maniobra ?? "", rangExtrem: e.rangExtrem ?? false,
        basic: e.basic ?? false, propietats: e.propietats ?? [], descripcio: e.descripcio ?? ""
      };
    case "armadura":
      return {
        tipus: e.tipus, reduccio: e.reduccio, modLatencia: e.modLatencia, equipada: true,
        egida: e.egida ?? { activa: false, absorcio: 0, tornsInactiva: 0 },
        descripcio: e.descripcio ?? ""
      };
    case "artefacte":
      return {
        cost: e.cost, categoria: e.categoria, activacio: e.activacio ?? {}, us: e.us ?? {},
        carrega: e.carrega ?? {}, mecanica: e.mecanica ?? "", descripcio: e.descripcio ?? "",
        parametres: e.parametres ?? [], construccio: e.construccio ?? {}
      };
    case "efecte":
      return {
        cost: e.cost, do: e.do, tipus: e.tipus, dificultat: e.dificultat,
        modLatencia: e.modLatencia ?? 0, us: e.us ?? {}, mecanica: e.mecanica ?? "",
        descripcio: e.descripcio ?? "", parametres: e.parametres ?? [], construccio: e.construccio ?? {}
      };
    case "tret":
      return { cost: e.cost, descripcio: e.descripcio ?? "", efecte: e.efecte ?? null };
    default:
      throw new Error(`Tipus d'item desconegut: ${tipus}`);
  }
}

/** Document Item (font de compendi) a partir d'una entrada de catàleg. */
function crearItem({ clauId, tipus, nom, system, catalegId, extraFlags = {}, actorId = null }) {
  const _id = idDeterminista(clauId);
  return {
    _id,
    _key: actorId ? `!actors.items!${actorId}.${_id}` : `!items!${_id}`,
    name: nom,
    type: tipus,
    system,
    flags: { forja: { catalegId, ...extraFlags } },
    effects: [],
    folder: null,
    sort: 0,
    ownership: { default: 0 }
  };
}

/* ------------------------------------------------------------------ */
/* Resolució de noms del manual → catàleg                              */
/* ------------------------------------------------------------------ */

const ESPECIES = {
  humanoide: "humanoide", animal: "animal", artropode: "artropode", cefalopode: "cefalopode",
  constructe: "constructe", incorpori: "incorpori", mecanoide: "mecanoide", vegetal: "vegetal"
};

const ALIAS_HABILITAT = {
  "armes a distancia": "armes-distancia",
  "tracte amb animals": "tracte-animals"
};

/** Variant "mental" de l'inepte/adepte (cas únic del manual: "inepte/mental" → INT). */
const ALIAS_ATRIBUT = { mental: "int" };

/**
 * Resol un tret escrit al manual ("curació ràpida/1", "armament natural/urpes",
 * "braços addicionals (parell)/1", "sentit agut/olfacte i gust"...) contra
 * `trets.json`. Torna `{ entrada, valorX, nota }` o `null`.
 */
export function resoldreTret(text, trets) {
  const net = netejarText(text).replace(/\.$/, "");
  const m = net.match(/^(.*?)(?:\s*\(parell\))?\s*\/\s*(.+)$/);
  const base = normalitzar(m ? m[1] : net);
  const param = m ? normalitzar(m[2]) : "";
  const perId = id => trets.find(t => t.id === id) ?? null;
  const perNom = nom => trets.find(t => normalitzar(t.nom) === nom) ?? null;
  const res = (entrada, valorX = null, nota = "") => entrada ? { entrada, valorX, nota } : null;

  if (!m) return res(perNom(base));

  switch (base) {
    case "aparenca":
      return res(perId(`aparenca-${param}`));
    case "armadura natural":
      return res(perId(`armadura-nat-${param}`));
    case "armament natural": {
      const clau = { urpes: "urpes", mossegada: "mossegada", banyes: "banyes", pinces: "pinces", fiblons: "fiblons" }[param];
      return res(perId(`armament-${clau}`));
    }
    case "adepte":
    case "inepte": {
      const atr = ALIAS_ATRIBUT[param] ?? param;
      return res(perId(`${base}-${atr}`), null,
        ALIAS_ATRIBUT[param] ? `«${base}/${param}» s'ha interpretat com ${base} (${atr.toUpperCase()})` : "");
    }
    case "toxic":
      // Tòxic/X (aventura «La porta d'Hèkate», Nous trets): X és l'estat que causa.
      return res(perId(`toxic-${param.split(" ")[0]}`));
    case "recursos":
      return res(param.startsWith("pobre") ? perId("recursos-pobre") : perId(`recursos-${param}`));
    case "sentit agut":
      if (param === "tots") return res(perId("sentit-agut-tots"));
      return res(perId("sentit-agut-un"), null, `sentit concret: ${param}`);
    case "sentit atrofiat":
      return res(perId(`sentit-atrofiat-${param.replace(/ /g, "-")}`));
    default: {
      const entrada = perNom(base);
      if (!entrada || (!entrada.multiplicador && !entrada.divisor)) return null;
      const x = parseInt(param, 10);
      return res(entrada, Number.isFinite(x) ? x : null);
    }
  }
}

/** Cost d'un tret per al valor X indicat (mateixa fórmula que `DiategTrets#calcularCost`). */
export function costTret(entrada, valorX) {
  if (entrada.multiplicador) return entrada.multiplicador * Math.max(1, valorX ?? 1);
  if (entrada.divisor) return Math.round(Math.max(0, valorX ?? 0) / entrada.divisor);
  return entrada.cost;
}

/* ------------------------------------------------------------------ */
/* Anàlisi del manual                                                  */
/* ------------------------------------------------------------------ */

const ANCORA = /^(Personatge Jugador|Personatge No Jugador|Animal|Criatura) de cost (\d+) PC\.\s*$/;
const CLAUS_BLOC = [
  [/^Atributs primaris:\s*(.*)$/, "primaris"],
  [/^Atributs secundaris:\s*(.*)$/, "secundaris"],
  [/^Habilitats:\s*(.*)$/, "habilitats"],
  [/^Trets:\s*(.*)$/, "trets"],
  [/^((?:Artefactes|Efectes)[^:]*):\s*(.*)$/, "equip"]
];

/** Paràgrafs (separats per línia en blanc) de les línies [de, fins). */
function paragrafsDe(linies, de, fins) {
  const out = [];
  let actual = [];
  for (let j = de; j < fins; j++) {
    if (linies[j].trim() === "") { if (actual.length) out.push(actual.join(" ")); actual = []; }
    else actual.push(linies[j].trim());
  }
  if (actual.length) out.push(actual.join(" "));
  return out;
}

/** Extreu del manual tots els blocs d'estadístiques (cru, sense resoldre contra catàlegs). */
export function analitzarManual(text) {
  const linies = text.split("\n");
  const idx = re => linies.findIndex(l => re.test(l));
  const iSecundaris = idx(/^### Secundaris: aliats i antagonistes/);
  const iNemesis = idx(/^### Nèmesis/);
  const iAnimalsCriatures = idx(/^## Animals i criatures/);
  const blocs = [];

  for (let i = 0; i < linies.length; i++) {
    const m = linies[i].match(ANCORA);
    if (!m) continue;

    // Nom: encapçalament (### o ####) més proper cap amunt.
    let nom = null;
    let iNom = -1;
    for (let j = i - 1; j >= 0; j--) {
      const h = linies[j].match(/^#{3,4}\s+(.+)$/);
      if (h) { nom = netejarText(h[1]).replace(/^Exemple:\s*/, ""); iNom = j; break; }
    }

    // Després del bloc: paràgrafs fins al següent encapçalament o bloc.
    let fi = i + 1;
    while (fi < linies.length && !/^#{1,6}\s/.test(linies[fi]) && !ANCORA.test(linies[fi])) fi++;
    const paragrafs = paragrafsDe(linies, i + 1, fi);

    // PJ: text narratiu previ (fins al primer paràgraf que parla d'atributs) i
    // prosa sencera (on hi ha, p. ex., l'especialitat «ofici (magistrat)»).
    let previ = [];
    let prosa = "";
    if (m[1] === "Personatge Jugador") {
      const tots = paragrafsDe(linies, iNom + 1, i);
      previ = [];
      for (const p of tots) { if (/atribut/i.test(p)) break; previ.push(p); }
      prosa = tots.join(" ");
    }

    const bloc = {
      nom, etiqueta: m[1], cost: parseInt(m[2], 10), linia: i + 1,
      primaris: null, secundaris: null, habilitats: null, trets: null, equip: [],
      descripcio: [], previ, prosa
    };
    let enBloc = true;
    for (const p of paragrafs) {
      let trobada = false;
      if (enBloc) {
        for (const [re, clau] of CLAUS_BLOC) {
          const mm = p.match(re);
          if (!mm) continue;
          trobada = true;
          if (clau === "equip") bloc.equip.push({ etiqueta: mm[1], text: mm[2] });
          else bloc[clau] = mm[1];
          break;
        }
      }
      if (!trobada) { enBloc = false; bloc.descripcio.push(p); }
    }
    bloc.seccio =
      m[1] === "Personatge Jugador" ? "pj"
      : m[1] === "Animal" ? "animals"
      : i > iAnimalsCriatures ? "criatures"
      : i < iSecundaris ? "figurants"
      : i < iNemesis ? "secundaris"
      : "nemesis";
    blocs.push(bloc);
  }
  return blocs;
}

/* ------------------------------------------------------------------ */
/* Construcció dels actors                                             */
/* ------------------------------------------------------------------ */

/** Excepcions de format del manual, resoltes a mà i documentades a l'informe. */
const SUPOSICIONS_MANUAL = {
  // "Figurant (no combatent)": «Atributs primaris: un atribut a 2, la resta a 1.»
  "figurant-no-combatent": {
    primaris: { FOR: 1, DES: 2, AGI: 1, PER: 1, INT: 1, APL: 1 },
    nota: "El manual diu «un atribut a 2, la resta a 1» sense dir quin; s'ha posat DES a 2 (l'atribut de l'ofici). Latència 11, defensa 1 i reducció de dany 1 del manual només exigeixen AGI i FOR a 1."
  }
};

/** Noms del manual que difereixen del del catàleg (errata del bloc: «de Miyagi» / «d'en Miyagi»). */
const ALIAS_EQUIP = { "les mans de miyagi": "les mans d en miyagi" };

function trobarEquip(nom, cat) {
  const n = ALIAS_EQUIP[normalitzar(nom)] ?? normalitzar(nom);
  for (const [tipus, llista] of [["artefacte", cat.artefactes], ["efecte", cat.efectes]]) {
    const e = llista.find(x => normalitzar(x.nom) === n);
    if (e) return { tipus, entrada: e };
  }
  return null;
}

/**
 * Construeix el document Actor (amb Items embeguts) d'un bloc del manual.
 * Les incidències (no mapat, no analitzable, suposicions) s'afegeixen a `incidencies`.
 */
export function construirActor(bloc, cat, cfg, incidencies) {
  const slugActor = (bloc.prefixSlug ?? "") + slug(bloc.nom);
  const esPJ = bloc.seccio === "pj";
  const pack = esPJ ? "pj" : bloc.seccio === "animals" ? "animals" : bloc.seccio === "criatures" ? "criatures" : "pnj";
  const actorId = idDeterminista(`${pack}/${slugActor}`);
  const avisa = (tipus, text) => incidencies.push({ actor: bloc.nom, pack, tipus, text });

  // --- Atributs primaris ---
  let atributs = {};
  for (const [, a, v] of (bloc.primaris ?? "").matchAll(/\b(FOR|DES|AGI|PER|INT|APL)\s+(\d)\b/g)) atributs[a] = parseInt(v, 10);
  if (Object.keys(atributs).length !== 6) {
    const sup = SUPOSICIONS_MANUAL[slugActor];
    if (sup) { atributs = { ...sup.primaris }; avisa("suposicio", sup.nota); }
    else { avisa("no-analitzable", `Atributs primaris no analitzables: «${bloc.primaris}»`); atributs = { FOR: 1, DES: 1, AGI: 1, PER: 1, INT: 1, APL: 1 }; }
  }

  // --- Atributs secundaris ---
  const ms = (bloc.secundaris ?? "").match(
    /^([^.]+)\.\s*Constitució [^(]*\((\d)\),\s*mida [^(]*\((\d)\),\s*latència (\d+),\s*defensa (-?\d+),\s*reducció de dany (\d+),\s*reacció (\d+)/i);
  let especie = "humanoide", constitucio = 3, mida = 3;
  let derivatsManual = null;
  if (!ms) avisa("no-analitzable", `Atributs secundaris no analitzables: «${bloc.secundaris}»`);
  else {
    especie = ESPECIES[normalitzar(ms[1])];
    if (!especie) { avisa("no-mapat", `Espècie desconeguda «${ms[1]}»`); especie = "humanoide"; }
    constitucio = parseInt(ms[2], 10);
    mida = parseInt(ms[3], 10);
    derivatsManual = {
      latencia: parseInt(ms[4], 10), defensa: parseInt(ms[5], 10),
      reduccioDany: parseInt(ms[6], 10), reaccio: parseInt(ms[7], 10)
    };
  }

  // --- Habilitats ---
  // L'especialitat de l'ofici només surt a la prosa del PJ: «ofici (magistrat)».
  let especialitatOfici = "";
  for (const m of bloc.prosa.matchAll(/\bofici\s*\(([^)]+)\)/gi)) especialitatOfici = netejarText(m[1]);
  const habilitats = {};
  for (const tros of (bloc.habilitats ?? "").replace(/\.$/, "").split(",")) {
    const t = netejarText(tros);
    if (!t) continue;
    const mm = t.match(/^(.*?)\s+(\d+)$/);
    if (!mm) { avisa("no-analitzable", `Habilitat no analitzable: «${t}»`); continue; }
    // Especialitat entre parèntesis («armes cos a cos (ganivets) 4»), com a l'aventura.
    const me = mm[1].match(/^(.*?)\s*\(([^)]+)\)$/);
    const n = normalitzar(me ? me[1] : mm[1]);
    const id = ALIAS_HABILITAT[n] ?? n.replace(/ /g, "-");
    if (!cfg.HABILITATS.includes(id)) { avisa("no-mapat", `Habilitat desconeguda «${mm[1]}»`); continue; }
    const nivell = parseInt(mm[2], 10);
    if (habilitats[id]) {
      // Una sola habilitat per id al sistema: es queda el nivell més alt i s'ajunten les especialitats.
      avisa("nota", `Habilitat «${id}» repetida (${t}): es queda el nivell ${Math.max(nivell, habilitats[id].nivell)}`);
      habilitats[id].nivell = Math.max(nivell, habilitats[id].nivell);
      if (me) habilitats[id].especialitat = [habilitats[id].especialitat, netejarText(me[2])].filter(Boolean).join(", ");
      continue;
    }
    habilitats[id] = { nivell };
    if (me) habilitats[id].especialitat = netejarText(me[2]);
    else if (id === "ofici" && especialitatOfici) habilitats[id].especialitat = especialitatOfici;
  }

  // --- Items embeguts ---
  const items = [];
  const tretsActor = [];
  for (const tros of (bloc.trets ?? "").replace(/\.$/, "").split(",")) {
    const t = netejarText(tros);
    if (!t) continue;
    const r = resoldreTret(t, cat.trets);
    if (!r) { avisa("no-mapat", `Tret desconegut «${t}»`); continue; }
    if (r.nota) avisa("nota", `Tret «${t}»: ${r.nota}`);
    const e = r.entrada;
    const variable = Boolean(e.multiplicador || e.divisor);
    if (variable && r.valorX === null) avisa("nota", `Tret «${t}» sense valor X: s'ha pres X=1`);
    let nom = variable ? `${e.nom} (${r.valorX ?? 1})` : e.nom;
    if (e.id === "sentit-agut-un") nom = `Sentit Agut (${normalitzar(t.split("/")[1])})`;
    items.push(crearItem({
      clauId: `${pack}/${slugActor}/tret/${e.id}`, tipus: "tret", nom,
      system: { cost: costTret(e, r.valorX), descripcio: e.descripcio ?? "", efecte: e.efecte ?? null },
      catalegId: e.id, extraFlags: variable ? { valorX: r.valorX ?? 1 } : {}, actorId
    }));
    tretsActor.push(e.id);
  }

  // Atacs automàtics (assegurarAtacsAutomatics): "Cop" + una arma natural per tret d'armament natural.
  const armesAfegir = [["cop", true]];
  for (const id of tretsActor) if (ARMAMENT_NATURAL_PER_TRET[id]) armesAfegir.push([ARMAMENT_NATURAL_PER_TRET[id], false]);
  for (const [catalegId, basic] of armesAfegir) {
    if (items.some(i => i.type === "arma" && i.flags.forja.catalegId === catalegId)) continue;
    const e = cat.armes.find(a => a.id === catalegId);
    if (!e) { avisa("no-mapat", `Arma de catàleg «${catalegId}» no trobada`); continue; }
    items.push(crearItem({
      clauId: `${pack}/${slugActor}/arma/${catalegId}`, tipus: "arma", nom: e.nom,
      system: { ...dadesSystem("arma", e), ...(basic ? { basic: true } : {}) },
      catalegId, actorId
    }));
  }

  // Artefactes i efectes
  for (const eq of bloc.equip) {
    const text = netejarText(eq.text);
    // El nom pot portar parèntesis: «Ègida ancestral (energia) (28 PC)».
    const noms = [...text.matchAll(/\s*([^,]+?)\s*\((\d+)\s*PC\)/g)];
    if (!noms.length) avisa("no-analitzable", `${eq.etiqueta}: «${text}»`);
    for (const m of noms) {
      const nom = m[1].trim();
      const costManual = parseInt(m[2], 10);
      const trobat = trobarEquip(nom, cat);
      if (!trobat) { avisa("no-mapat", `${eq.etiqueta}: «${nom}» no és al catàleg d'artefactes ni d'efectes`); continue; }
      const { tipus, entrada } = trobat;
      if (entrada.cost !== costManual) avisa("cost-catalog", `${nom}: el manual diu ${costManual} PC i el catàleg ${entrada.cost} PC`);
      items.push(crearItem({
        clauId: `${pack}/${slugActor}/${tipus}/${entrada.id}`, tipus, nom: entrada.nom,
        system: dadesSystem(tipus, entrada), catalegId: entrada.id, actorId
      }));
    }
  }

  // --- Descripció ---
  const html = aHTML(esPJ ? bloc.previ : bloc.descripcio);
  const system = { atributs, especie, mida, constitucio, habilitats, pc: bloc.pcInicials ?? (esPJ ? 200 : bloc.cost) };
  if (esPJ) system.biografia = html;
  else {
    system.tier = bloc.seccio === "figurants" ? "extra"
      : bloc.seccio === "nemesis" ? "nemesis"
      : bloc.seccio === "animals" ? "animal"
      : bloc.seccio === "criatures" || bloc.etiqueta === "Criatura" ? "criatura"
      : "antagonista";
    system.notes = html;
    if (bloc.seccio === "secundaris" && bloc.etiqueta === "Criatura") {
      avisa("nota", "Bloc «Criatura de cost…» dins la secció de secundaris: es publica al compendi `pnj` amb tier «criatura».");
    }
  }

  // Token (scripts/generar-tokens.py): el dibuixat o el provisional gris.
  const token = fs.existsSync(path.join(TOKENS, pack, `${slugActor}.webp`))
    ? `systems/forja/assets/tokens/${pack}/${slugActor}.webp` : null;
  const actor = {
    _id: actorId,
    _key: `!actors!${actorId}`,
    name: bloc.nom,
    type: esPJ ? "personatge" : "pnj",
    ...(token ? { img: token } : {}),
    system,
    prototypeToken: {
      name: bloc.nom, actorLink: esPJ, disposition: esPJ ? 1 : -1,
      ...(token ? { texture: { src: token } } : {})
    },
    items,
    effects: [],
    folder: bloc.aventura ? idCarpeta(pack, bloc.aventura) : null,
    sort: 0,
    ownership: { default: 0 },
    flags: {
      forja: bloc.aventura
        ? { aventura: bloc.aventura, origen: bloc.fitxer, costManual: bloc.cost, derivatsManual }
        : { origenManual: `docs/FORJA_FC001CA_CORE.md l.${bloc.linia}`, costManual: bloc.cost, derivatsManual }
    }
  };
  return { pack, slug: slugActor, actor };
}

/* ------------------------------------------------------------------ */
/* Càlcul de cost i de derivats (mateixes regles que el sistema)        */
/* ------------------------------------------------------------------ */

/** Cost en PC d'un actor generat; el manual suma també els artefactes i efectes. */
export function calcularCost(actor, cfg, { inclouEquip = true } = {}) {
  const s = actor.system;
  let cost = 0;
  for (const v of Object.values(s.atributs)) cost += cfg.COST_ATRIBUT[v] ?? 0;
  cost += cfg.COST_ESPECIE[s.especie] ?? 0;
  cost += cfg.COST_MIDA[s.mida] ?? 0;
  cost += cfg.COST_CONSTITUCIO[s.constitucio] ?? 0;
  for (const h of Object.values(s.habilitats)) cost += cfg.COST_HABILITAT[h.nivell] ?? 0;
  for (const it of actor.items) {
    if (it.type === "tret") cost += it.system.cost ?? 0;
    else if (inclouEquip && (it.type === "artefacte" || it.type === "efecte")) cost += it.system.cost ?? 0;
  }
  return cost;
}

/** Derivats de combat (CLAUDE.md "Derivats"): latència, defensa, reducció de dany, reaccions. */
export function calcularDerivats(actor, cfg) {
  const s = actor.system;
  // Incorporis (manual l. 1218): sense atributs físics; per als derivats fan servir
  // PER enlloc d'AGI i APL com si fos FOR. El sistema (_prepararDerivats) NO ho implementa encara.
  const incorpori = s.especie === "incorpori";
  const agi = incorpori ? s.atributs.PER : s.atributs.AGI;
  const forca = incorpori ? s.atributs.APL : s.atributs.FOR;
  const d = {
    latencia: Math.max(1, 10 + s.mida - agi * 2),
    defensa: agi + (cfg.MIDA_DEFENSA[s.mida] ?? 0),
    reduccioDany: forca,
    reaccio: 1
  };
  const mapa = { latenciaBase: "latencia", defensa: "defensa", reduccioDany: "reduccioDany", reaccionsMax: "reaccio" };
  for (const it of actor.items) {
    if (it.type === "armadura" && it.system.equipada !== false) d.latencia += it.system.modLatencia ?? 0;
    const ef = it.type === "tret" ? it.system.efecte : null;
    if (ef?.stat && mapa[ef.stat] && Number.isFinite(ef.delta)) d[mapa[ef.stat]] += ef.delta;
  }
  d.latencia = Math.max(1, d.latencia);
  d.reaccio = Math.max(0, d.reaccio);
  return d;
}

/** Diferències entre el cost/derivats calculats i els del manual. */
export function trobarDiferencies(actors, cfg) {
  const dif = [];
  for (const { pack, slug: s, actor } of actors) {
    const f = actor.flags.forja;
    const cost = calcularCost(actor, cfg);
    if (cost !== f.costManual) dif.push({ actor: actor.name, pack, slug: s, camp: "cost", manual: f.costManual, calculat: cost });
    if (!f.derivatsManual) continue;
    const d = calcularDerivats(actor, cfg);
    for (const k of ["latencia", "defensa", "reduccioDany", "reaccio"]) {
      if (d[k] !== f.derivatsManual[k]) dif.push({ actor: actor.name, pack, slug: s, camp: k, manual: f.derivatsManual[k], calculat: d[k] });
    }
  }
  return dif;
}

/* ------------------------------------------------------------------ */
/* Escriptura                                                          */
/* ------------------------------------------------------------------ */

function escriure(pack, nomFitxer, doc) {
  const dir = path.join(FONTS, pack);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${nomFitxer}.json`), JSON.stringify(doc, null, 2) + "\n");
}

function netejarPack(pack) {
  const dir = path.join(FONTS, pack);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

/** _id de la carpeta d'una aventura dins un compendi d'actors. */
export function idCarpeta(pack, aventura) {
  return idDeterminista(`carpeta/${pack}/${aventura}`);
}

/** Document de carpeta (Folder) per a un compendi, en el format del CLI de Foundry. */
function carpeta(pack, aventura, nom) {
  const _id = idCarpeta(pack, aventura);
  return { _id, _key: `!folders!${_id}`, name: nom, type: "Actor", folder: null, sorting: "a", sort: 0, color: null, description: "", flags: {} };
}

/** Genera tot el contingut. Retorna `{ actors, incidencies, comptes, cat, cfg }`. */
export function generar({ escriureFitxers = true } = {}) {
  const cat = carregarCatalegs();
  const cfg = carregarConfig();
  const incidencies = [];
  const blocs = analitzarManual(fs.readFileSync(MANUAL, "utf8"));
  const actors = blocs.map(b => construirActor(b, cat, cfg, incidencies));
  // Aventura «La porta d'Hèkate»: incidències i diferències a part (CONVERSIO.md).
  const incidenciesAventura = [];
  const actorsAventura = analitzarAventura(ARREL).map(b => {
    const a = construirActor(b, cat, cfg, incidenciesAventura);
    for (const n of b.notesConversio ?? []) incidenciesAventura.push({ actor: b.nom, pack: a.pack, tipus: "suposicio", text: n });
    return a;
  });

  if (escriureFitxers) {
    for (const p of [...PACKS_ACTOR, ...PACKS_ITEM]) netejarPack(p);
    const vistos = new Set();
    for (const p of new Set(actorsAventura.map(a => a.pack))) escriure(p, `_carpeta-${AVENTURA.id}`, carpeta(p, AVENTURA.id, AVENTURA.nom));
    for (const a of [...actors, ...actorsAventura]) {
      const clau = `${a.pack}/${a.slug}`;
      if (vistos.has(clau)) throw new Error(`Slug duplicat: ${clau}`);
      vistos.add(clau);
      escriure(a.pack, a.slug, a.actor);
    }
  }
  const comptes = {};
  for (const p of PACKS_ACTOR) comptes[p] = actors.filter(a => a.pack === p).length;
  const comptesAventura = {};
  for (const p of PACKS_ACTOR) comptesAventura[p] = actorsAventura.filter(a => a.pack === p).length;

  const tipusPack = { trets: "tret", armes: "arma", armadures: "armadura", artefactes: "artefacte", efectes: "efecte" };
  for (const p of PACKS_ITEM) {
    const llista = cat[p];
    comptes[p] = llista.length;
    if (!escriureFitxers) continue;
    for (const e of llista) {
      escriure(p, e.id, crearItem({
        clauId: `${p}/${e.id}`, tipus: tipusPack[p], nom: e.nom,
        system: dadesSystem(tipusPack[p], e), catalegId: e.id
      }));
    }
  }
  return { actors, incidencies, comptes, cat, cfg, actorsAventura, incidenciesAventura, comptesAventura };
}

/* ------------------------------------------------------------------ */
/* Informe                                                             */
/* ------------------------------------------------------------------ */

function escriureInforme({ actors, incidencies, comptes, cfg }) {
  const dif = trobarDiferencies(actors, cfg);
  const L = [];
  L.push("# Informe del contingut dels compendis (Fase 5)");
  L.push("");
  L.push("Generat per `scripts/build-packs.mjs` (no s'edita a mà: es regenera). Fonts: `docs/FORJA_FC001CA_CORE.md` i `module/config/dades/*.json`.");
  L.push("");
  L.push("## Comptes");
  L.push("");
  L.push("| Compendi | Tipus | Documents |");
  L.push("|---|---|---|");
  for (const p of PACKS_ACTOR) L.push(`| \`${p}\` | Actor | ${comptes[p]} |`);
  for (const p of PACKS_ITEM) L.push(`| \`${p}\` | Item | ${comptes[p]} |`);
  L.push("");
  L.push("Les maniobres d'arts marcials (`maniobres-arts-marcials.json`) no tenen compendi: no són un tipus d'Item, només una llista de dades (`FORJA.LLISTA_MANIOBRES`) consultada en declarar un «Cop».");
  L.push("");

  const seccions = [
    ["no-mapat", "Elements que no s'han pogut mapar (no s'han inclòs)"],
    ["no-analitzable", "Línies no analitzables"],
    ["suposicio", "Suposicions preses per interpretar el manual"],
    ["cost-catalog", "Costos d'artefactes/efectes: manual contra catàleg"],
    ["nota", "Notes de mapeig"]
  ];
  for (const [tipus, titol] of seccions) {
    const llista = incidencies.filter(i => i.tipus === tipus);
    L.push(`## ${titol}`);
    L.push("");
    if (!llista.length) L.push("Cap.");
    for (const i of llista) L.push(`- **${i.actor}** (\`${i.pack}\`): ${i.text}`);
    L.push("");
  }

  L.push("## Observacions sobre el sistema (no són errors del contingut)");
  L.push("");
  L.push("- **Incorporis** (manual l. 1218): fan servir PER en lloc d'AGI i APL en lloc de FOR als atributs secundaris; `_prepararDerivats` ho aplica des de la Fase 7 (l'«IAssistent» surt amb latència 6, defensa 4 i reducció de dany 2, com al manual).");
  L.push("- **Armadura natural** (trets «armadura-nat-N»): el sistema no crea cap Item d'armadura natural en comprar el tret; als compendis només hi ha el tret, com fa el flux normal de la fitxa.");
  L.push("- **Tentacles** (Kraken): el tret «Tentacles» no és a `ARMAMENT_NATURAL_PER_TRET`, de manera que no s'hi ha afegit l'arma «Tentacles» del catàleg d'armes (és el que farien els hooks del sistema).");
  L.push("- **Biografia / notes**: als PJ, `system.biografia` conté els paràgrafs de presentació del manual que precedeixen la construcció; als PNJ, animals i criatures, `system.notes` conté el paràgraf descriptiu posterior al bloc.");
  L.push("");
  L.push("## Diferències entre el cost/derivats del manual i el càlcul amb les taules del sistema");
  L.push("");
  L.push("El cost recalculat suma atributs, espècie, mida, constitució, habilitats, trets i els artefactes/efectes (el manual els compta dins els PC: vegeu Anya Barker, 200 PC). Els derivats segueixen `_prepararDerivats`.");
  L.push("");
  if (!dif.length) L.push("Cap diferència.");
  else {
    L.push("| Actor | Compendi | Camp | Manual | Calculat | Diferència |");
    L.push("|---|---|---|---|---|---|");
    for (const d of dif) L.push(`| ${d.actor} | \`${d.pack}\` | ${d.camp} | ${d.manual} | ${d.calculat} | ${d.calculat - d.manual} |`);
  }
  L.push("");
  fs.writeFileSync(INFORME, L.join("\n"));
  return dif;
}

/** Informe de la conversió dels actors de l'aventura (regles antigues → actuals). */
function escriureInformeAventura({ actorsAventura, incidenciesAventura, comptesAventura, cfg }) {
  const dif = trobarDiferencies(actorsAventura, cfg);
  const L = [];
  L.push(`# ${AVENTURA.nom}: conversió dels actors`);
  L.push("");
  L.push("Generat per `scripts/build-packs.mjs` (no s'edita a mà). Font: `" + AVENTURA.font + "/`. Els actors són als compendis del sistema, dins la carpeta «" + AVENTURA.nom + "».");
  L.push("");
  L.push("El mòdul (esborrany v0.2) fa servir unes regles anteriors. Conversió decidida per l'Oriol FM (2026-10-06): constitució esglaó a esglaó (feble → magra, saludable → saludable, robusta → ferma, massissa → robusta), mida col·losal → enorme; es mantenen atributs, habilitats i trets, i el cost i els derivats es recalculen amb les regles actuals.");
  L.push("");
  L.push("| Compendi | Actors |");
  L.push("|---|---|");
  for (const [p, n] of Object.entries(comptesAventura)) if (n) L.push(`| \`${p}\` | ${n} |`);
  L.push("");
  const seccions = [
    ["no-mapat", "Trets, habilitats o equip que no s'han pogut mapar (no s'han inclòs)"],
    ["no-analitzable", "Línies no analitzables"],
    ["suposicio", "Conversions i suposicions"],
    ["cost-catalog", "Costos d'artefactes/efectes: mòdul contra catàleg"],
    ["nota", "Notes"]
  ];
  for (const [tipus, titol] of seccions) {
    const llista = incidenciesAventura.filter(i => i.tipus === tipus);
    L.push(`## ${titol}`);
    L.push("");
    if (!llista.length) L.push("Cap.");
    for (const i of llista) L.push(`- **${i.actor}** (\`${i.pack}\`): ${i.text}`);
    L.push("");
  }
  L.push("## Diferències amb el mòdul (cost i derivats recalculats)");
  L.push("");
  L.push("Esperables: la defensa, la salut i part dels costos canvien d'escala entre versions de les regles. Serveix per revisar cada actor.");
  L.push("");
  if (!dif.length) L.push("Cap diferència.");
  else {
    L.push("| Actor | Compendi | Camp | Mòdul | Calculat | Diferència |");
    L.push("|---|---|---|---|---|---|");
    for (const d of dif) L.push(`| ${d.actor} | \`${d.pack}\` | ${d.camp} | ${d.manual} | ${d.calculat} | ${d.calculat - d.manual} |`);
  }
  L.push("");
  fs.writeFileSync(path.join(ARREL, AVENTURA.informe), L.join("\n"));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = generar();
  const dif = escriureInforme(r);
  escriureInformeAventura(r);
  console.log("Compendis generats:", r.comptes);
  console.log(`Incidències: ${r.incidencies.length} (vegeu docs/CONTINGUT-INFORME.md)`);
  console.log(`Diferències cost/derivats: ${dif.length}`);
}
