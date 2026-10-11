/**
 * Lògica pura del contingut dels compendis (actors i items en el format de les
 * fonts `packs/_source`), de `scripts/build-packs.mjs` i d'altres eines (també
 * al navegador). Sense dependències de Node ni de Foundry: només dades.
 *
 * Les regles de cost i derivats són les del sistema (CLAUDE.md › Derivats;
 * manual › Creació de personatges). `cfg` és el que retorna `carregarConfig()`
 * de build-packs (taules de cost de `module/config/constants.mjs`).
 */

export const PACKS_ACTOR = ["pj", "pnj", "animals", "criatures"];
export const PACKS_ITEM = ["trets", "armes", "armadures", "artefactes", "efectes"];

/** Tipus d'Item de cada compendi (i de cada catàleg) d'items. */
export const TIPUS_PER_PACK = { trets: "tret", armes: "arma", armadures: "armadura", artefactes: "artefacte", efectes: "efecte" };

/** Minúscules, sense accents ni signes: per comparar noms del manual i dels catàlegs. */
export function normalitzar(text) {
  return String(text).normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function slug(text) {
  return normalitzar(text).replace(/ /g, "-");
}

/** Cost d'un tret per al valor X indicat (mateixa fórmula que `DiategTrets#calcularCost`). */
export function costTret(entrada, valorX) {
  if (entrada.multiplicador) return entrada.multiplicador * Math.max(1, valorX ?? 1);
  if (entrada.divisor) return Math.round(Math.max(0, valorX ?? 0) / entrada.divisor);
  return entrada.cost;
}

/** Camps de `system` per tipus: còpia de `_dadesSystemPerTipus` (equipament-automatic.mjs). */
export function dadesSystem(tipus, e) {
  switch (tipus) {
    case "arma":
      return {
        categoria: e.categoria, modLatencia: e.modLatencia, abast: e.abast,
        rangMultFor: e.rangMultFor ?? 0, esEscut: e.esEscut ?? false,
        danyBase: e.danyBase, pista: e.pista ?? "", maniobra: e.maniobra ?? "", rangExtrem: e.rangExtrem ?? false,
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

/**
 * Document Item (font de compendi) a partir d'una entrada de catàleg.
 * @param {object} p
 * @param {string} p.id          _id de l'item
 * @param {string} p.tipus       tipus d'Item
 * @param {string} p.nom
 * @param {object} p.system
 * @param {string} p.catalegId
 * @param {object} [p.extraFlags]
 * @param {string|null} [p.actorId]  Si és un item d'un actor (canvia la `_key`).
 */
export function documentItem({ id, tipus, nom, system, catalegId, extraFlags = {}, actorId = null }) {
  return {
    _id: id,
    _key: actorId ? `!actors.items!${actorId}.${id}` : `!items!${id}`,
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

/**
 * Item d'un actor a partir d'una entrada de catàleg (tret, arma, armadura,
 * artefacte o efecte), com fa `build-packs` amb els actors del manual: els
 * trets de cost variable porten el valor X al nom i a `flags.forja.valorX`.
 */
export function itemActorDesDeCataleg({ id, actorId, tipus, entrada, valorX = null }) {
  if (tipus === "tret") {
    const variable = !!(entrada.multiplicador || entrada.divisor);
    const x = variable ? (valorX ?? 1) : null;
    return documentItem({
      id, actorId, tipus, catalegId: entrada.id,
      nom: variable ? `${entrada.nom} (${x})` : entrada.nom,
      system: { cost: costTret(entrada, x), descripcio: entrada.descripcio ?? "", efecte: entrada.efecte ?? null },
      extraFlags: variable ? { valorX: x } : {}
    });
  }
  return documentItem({ id, actorId, tipus, nom: entrada.nom, catalegId: entrada.id, system: dadesSystem(tipus, entrada) });
}

/** Actor nou buit (atributs 1, humanoide, mida 3, constitució 3) per a un compendi. */
export function nouActor({ id, pack, nom }) {
  const pj = pack === "pj";
  const tier = { pnj: "extra", animals: "animal", criatures: "criatura" }[pack];
  return {
    _id: id,
    _key: `!actors!${id}`,
    name: nom,
    type: pj ? "personatge" : "pnj",
    system: {
      atributs: { FOR: 1, DES: 1, AGI: 1, PER: 1, INT: 1, APL: 1 },
      especie: pack === "animals" ? "animal" : "humanoide",
      mida: 3,
      constitucio: 3,
      habilitats: {},
      pc: 0,
      ...(pj ? { biografia: "" } : { tier, notes: "" })
    },
    prototypeToken: { name: nom, actorLink: pj, disposition: pj ? 1 : -1 },
    items: [],
    effects: [],
    folder: null,
    sort: 0,
    ownership: { default: 0 },
    flags: { forja: {} }
  };
}

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
  // PER enlloc d'AGI i APL com si fos FOR.
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

/** Tret d'armament natural → arma del catàleg (`ARMAMENT_NATURAL_PER_TRET`, equipament-automatic.mjs). */
export const ARMAMENT_NATURAL_PER_TRET = {
  "armament-urpes": "urpes",
  "armament-mossegada": "ullals",
  "armament-banyes": "banyes",
  "armament-pinces": "pinces",
  "armament-fiblons": "fiblons-i-espines"
};

/**
 * Afegeix a un actor els atacs automàtics que el sistema crea sol
 * (`assegurarAtacsAutomatics`): el «Cop» bàsic i l'arma natural de cada tret
 * d'armament natural, si encara no hi són. Modifica i retorna l'actor.
 * @param {object} actor
 * @param {object[]} armes   Catàleg d'armes (`armes.json`).
 * @param {() => string} nouId
 */
export function completarAtacsAutomatics(actor, armes, nouId) {
  actor.items ??= [];
  const afegir = [["cop", true]];
  for (const it of actor.items) {
    const arma = it.type === "tret" && ARMAMENT_NATURAL_PER_TRET[it.flags?.forja?.catalegId];
    if (arma) afegir.push([arma, false]);
  }
  for (const [catalegId, basic] of afegir) {
    if (actor.items.some(i => i.type === "arma" && i.flags?.forja?.catalegId === catalegId)) continue;
    const e = armes.find(a => a.id === catalegId);
    if (!e) continue;
    const item = itemActorDesDeCataleg({ id: nouId(), actorId: actor._id, tipus: "arma", entrada: e });
    if (basic) item.system.basic = true;
    actor.items.push(item);
  }
  return actor;
}
