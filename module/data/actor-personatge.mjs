import { campsBase } from "./_camps.mjs";
import { FORJA } from "../config/constants.mjs";

/**
 * DataModel per a Personatges Jugadors (PJ).
 * Inclou camps exclusius del PJ i hereda tots els camps base.
 */
export default class ActorPersonatge extends foundry.abstract.TypeDataModel {

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      ...campsBase(fields),
      // Camps exclusius del PJ
      concepte: new fields.StringField({ initial: "" }),
      origen:   new fields.StringField({ initial: "" }),
      genere:   new fields.StringField({ initial: "" }),
      edat:     new fields.NumberField({ integer: true, min: 0, initial: 0 }),
      recursos: new fields.StringField({ initial: "" }),
      guanxi:   new fields.StringField({ initial: "" })
    };
  }

  /** @override */
  prepareDerivedData() {
    _prepararDerivats(this);
  }
}

/**
 * Càlcul de tots els derivats. Compartit per personatge i pnj.
 * @param {TypeDataModel} sys
 */
export function _prepararDerivats(sys) {
  const cfg = CONFIG.FORJA;
  if (!cfg) return;

  const { atributs, mida, constitucio, salut } = sys;

  // --- Derivats de combat ---
  sys.latenciaBase = Math.max(1, 10 + mida - atributs.AGI * 2);
  sys.defensa      = atributs.AGI + (cfg.MIDA_DEFENSA[mida] ?? 0);
  sys.reduccioDany = atributs.FOR;
  sys.reaccionsMax = 1; // modificat per trets (Onada 3)

  // --- Salut: derivats (S-15) ---
  salut.fatiga.perNivell  = constitucio;
  salut.ferides.perNivell = mida;

  salut.fatiga.nivellActiu  = _nivellActiu(salut.fatiga.marcats,  constitucio);
  salut.ferides.nivellActiu = _nivellActiu(salut.ferides.marcats, mida);
  salut.nivellEfectiu       = Math.max(salut.fatiga.nivellActiu, salut.ferides.nivellActiu);
  salut.penalitzacio        = cfg.SALUT_PENALITZACIO[salut.nivellEfectiu];

  // --- PC gastats ---
  _calcularPunts(sys, cfg);
}

/**
 * Retorna el nivell actiu (1–7) donats els marcats i els punts per nivell.
 * Nivell 1 si no hi ha cap casella marcada.
 */
function _nivellActiu(marcats, perNivell) {
  if (marcats <= 0 || perNivell <= 0) return 1;
  return Math.min(7, Math.ceil(marcats / perNivell));
}

function _calcularPunts(sys, cfg) {
  let cost = 0;

  // Atributs
  for (const val of Object.values(sys.atributs)) {
    cost += cfg.COST_ATRIBUT[val] ?? 0;
  }
  // Espècie + Mida + Constitució
  cost += cfg.COST_ESPECIE[sys.especie]         ?? 0;
  cost += cfg.COST_MIDA[sys.mida]               ?? 0;
  cost += cfg.COST_CONSTITUCIO[sys.constitucio] ?? 0;

  // Habilitats
  for (const hab of Object.values(sys.habilitats)) {
    cost += cfg.COST_HABILITAT[hab.nivell] ?? 0;
  }

  // Trets com a Items (Onada 3+)
  const items = sys.parent?.items;
  if (items) {
    for (const item of items) {
      if (item.type === "tret") cost += item.system.cost ?? 0;
    }
  }

  sys.pcGastats = cost;
  sys.pcLliures = sys.pc - cost;
}
