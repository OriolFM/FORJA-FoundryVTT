import { campsBase } from "./_camps.mjs";
import { FORJA } from "../config/constants.mjs";
import { distanciesMoviment } from "../combat/moviment.mjs";
import { restriccionsEstats } from "../estats/regles-estats.mjs";
import { recordarSalut } from "../estats/notificacions.mjs";
import {
  bonificacionsBuides, bonificacionsDeParametres, sumarBonificacions, artefacteSempreActiu
} from "../combat/resultat-parametres.mjs";
import { costTotalModular } from "../progressio/modular.mjs";

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
 * Atributs i habilitats base de l'actor, sense les bonificacions d'efectes i
 * artefactes que `_prepararDerivats` hi suma (Fase 3). És el que s'edita, es
 * millora amb PX i es paga amb PC.
 * @param {Actor} actor
 * @returns {{atributs:Record<string,number>, habilitats:Record<string,{nivell:number}>}}
 */
export function valorsBase(actor) {
  const font = actor?._source?.system ?? {};
  return {
    atributs:   font.atributs ?? actor?.system?.atributs ?? {},
    habilitats: font.habilitats ?? actor?.system?.habilitats ?? {}
  };
}

/**
 * Càlcul de tots els derivats. Compartit per personatge i pnj.
 * @param {TypeDataModel} sys
 */
export function _prepararDerivats(sys) {
  const cfg = CONFIG.FORJA;
  if (!cfg) return;

  const { atributs, mida, constitucio, salut } = sys;

  // --- PC gastats (abans de cap bonificació: es paguen els valors base) ---
  _calcularPunts(sys, cfg);

  // --- Bonificacions d'efectes i artefactes (Fase 3) ---
  // Atributs i habilitats que donen els artefactes sempre actius (equipats) i
  // els efectes temporals (ActiveEffect amb `flags.forja.bonus`). Se sumen
  // als valors (dades derivades, no es desen); la fitxa edita els valors base
  // (`_source`). L'armadura i l'ègida van per objectes vinculats
  // (`combat/artefactes-vinculats.mjs`).
  sys.bonus = _bonificacions(sys.parent);
  for (const [attr, n] of Object.entries(sys.bonus.atributs)) {
    if (attr in atributs) atributs[attr] = (atributs[attr] ?? 0) + n;
  }
  for (const [habId, n] of Object.entries(sys.bonus.habilitats)) {
    if (sys.habilitats[habId]) sys.habilitats[habId].nivell = (sys.habilitats[habId].nivell ?? 0) + n;
  }

  // --- Derivats de combat ---
  // Incorporis (manual › Espècie, l. ~1220): no tenen atributs físics; els
  // atributs secundaris es calculen amb PER en lloc d'AGI i APL en lloc de FOR.
  const incorpori = sys.especie === "incorpori";
  const agiDerivats = incorpori ? (atributs.PER ?? 0) : atributs.AGI;
  const forDerivats = incorpori ? (atributs.APL ?? 0) : atributs.FOR;
  sys.latenciaBase = Math.max(1, 10 + mida - agiDerivats * 2);
  sys.defensa      = agiDerivats + (cfg.MIDA_DEFENSA[mida] ?? 0);
  sys.reduccioDany = forDerivats;
  sys.reaccionsMax = 1;

  // --- Efectes mecànics dels trets (S-04, Onada 3) ---
  const flagsEfecte = _aplicarEfectesTrets(sys);

  // --- Modificador de latència de les armadures equipades (B2) ---
  // Una armadura sense el camp `equipada` (encara no migrada per WP-G) es
  // tracta com a equipada — `!== false`, no `=== true`. Si n'hi ha varies
  // equipades alhora, les penalitzacions de latència s'apilen senceres
  // (manual l. 3337); la protecció la calcula `proteccioArmadura` (dany.mjs).
  const items = sys.parent?.items;
  if (items) {
    for (const item of items) {
      if (item.type === "armadura" && item.system.equipada !== false) {
        sys.latenciaBase += item.system.modLatencia ?? 0;
      }
    }
  }

  // --- Escut (Fase 6; manual › Cos a cos, taula d'armes, Escuts, l. 2985) ---
  // «Quan es porta un escut que no s'està fent servir en una acció, el PJ rep
  // un increment de +1 a la seva defensa bàsica.» Simplificació: es compta
  // sempre que porti un escut (el sistema no sap quina arma fa servir ara).
  if (items && [...items].some(i => i.type === "arma" && (i.system.esEscut || (i.system.propietats ?? []).includes("escut")))) {
    sys.defensa += 1;
  }

  // --- Estats (Fase 1; manual › Salut › Estats) ---
  // Abatut: +2 a la latència de qualsevol acció; Vigilant: +1 reacció.
  // `actor.statuses` ja és a punt: Foundry aplica els efectes actius
  // (`prepareEmbeddedDocuments`) abans de `prepareDerivedData`.
  const restriccions = restriccionsEstats(sys.parent?.statuses ?? []);
  sys.latenciaBase += restriccions.latenciaExtra;
  sys.reaccionsMax += restriccions.reaccionsExtra;

  sys.latenciaBase = Math.max(1, sys.latenciaBase);
  sys.reaccionsMax = Math.max(0, sys.reaccionsMax);

  // --- Moviment (WP-M): caminar / córrer / saltar, en metres ---
  // Fórmules de l'Oriol FM (2026-09-27), no del manual (l. 2668: "el DJ
  // decideix [...] en base a la seva mida i AGI"). Vegeu combat/moviment.mjs.
  sys.moviment = distanciesMoviment(agiDerivats, mida);

  // --- Salut: derivats (S-15) ---
  salut.fatiga.perNivell  = constitucio;
  salut.ferides.perNivell = mida;

  salut.fatiga.nivellActiu  = _nivellActiu(salut.fatiga.marcats,  constitucio);
  salut.ferides.nivellActiu = _nivellActiu(salut.ferides.marcats, mida);
  salut.nivellEfectiu       = Math.max(salut.fatiga.nivellActiu, salut.ferides.nivellActiu);

  // --- Salut: {value, max} per a les barres de token (A6) ---
  // Derivats, no camps d'schema: `max` són les caselles totals de la pista
  // (6 nivells complets + la casella terminal del nivell 7) i `value` són
  // les caselles que queden per marcar (el que ha de mostrar la barra).
  salut.fatiga.max    = 6 * salut.fatiga.perNivell + 1;
  salut.fatiga.value  = Math.max(0, salut.fatiga.max - salut.fatiga.marcats);
  salut.ferides.max   = 6 * salut.ferides.perNivell + 1;
  salut.ferides.value = Math.max(0, salut.ferides.max - salut.ferides.marcats);

  // Nivell 7 = "fora de combat" (manual): ja no pot actuar (vegeu B1, WP-F).
  salut.foraDeCombat = salut.nivellEfectiu >= 7;

  // "Dur de pelar" (ignoraPenalitzacioFerides): la pista de ferides no
  // contribueix a la penalització de dificultat, tot i que segueix comptant
  // per a nivellEfectiu (visual/estat terminal) — no és invulnerabilitat.
  const nivellPerPenalitzacio = flagsEfecte.has("ignoraPenalitzacioFerides")
    ? salut.fatiga.nivellActiu
    : salut.nivellEfectiu;
  salut.penalitzacio = cfg.SALUT_PENALITZACIO[nivellPerPenalitzacio];

  // No-Mort (manual p. 244): "no pateix cap mena de limitació per dany" —
  // exempció total (no només de ferides), a diferència de "Dur de pelar".
  sys.noMort = flagsEfecte.has("noMort");
  if (sys.noMort) salut.penalitzacio = 0;
  // Berserc (l. 3578): «dur de pelar i incansable» → cap penalització de salut.
  if (restriccions.ignoraPenalitzacio && salut.penalitzacio != null) salut.penalitzacio = 0;

  // Textos flotants de salut (estats/notificacions.mjs): primera lectura.
  recordarSalut(sys.parent);

  // --- PX lliures (S-28) ---
  sys.px.lliures = (sys.px.total ?? 0) - (sys.px.gastats ?? 0);

  // --- Sobrenatural: dotat / equilibri (S-20, Onada 4) ---
  _prepararSobrenatural(sys, cfg);
}

/**
 * Determina el "do" del PJ a partir dels trets sobrenaturals que posseeix
 * (FORJA.TRETS_DO) i, si n'és dotat, calcula el seu Equilibri (EQ = atribut
 * principal del do + habilitat del do, manual p. 250). L'equilibri actual
 * es guarda com a "gastat" (caselles marcades, 0 = ple), exactament amb el
 * mateix patró que `salut.fatiga`/`salut.ferides` — permet reaprofitar la
 * mateixa UI de pista clicable. Zones (manual p. 260-264):
 *   - `actual > 0`: normal, sense conseqüència.
 *   - `0 >= actual > -max`: 1 punt de dany directe de fatiga en manifestar.
 *   - `actual <= -max`: 1 punt de dany directe de ferides en manifestar.
 * (L'aplicació del dany és responsabilitat de qui invoca `manifestarEfecte`,
 * no d'aquí — aquesta funció només calcula l'estat, mai en muta res.)
 */
function _prepararSobrenatural(sys, cfg) {
  const items = sys.parent?.items;
  const idsTrets = new Set();
  if (items) {
    for (const item of items) {
      if (item.type !== "tret") continue;
      const catalegId = item.getFlag("forja", "catalegId");
      if (catalegId) idsTrets.add(catalegId);
    }
  }

  const dons = new Set();
  for (const id of idsTrets) {
    const don = cfg.TRETS_DO[id];
    if (don) dons.add(don);
  }
  // Mútuament excloents (manual p. 168) — si n'hi ha més d'un per error de
  // creació, es fa servir el primer per calcular l'equilibri; avisosCoherencia
  // (S-05) ja n'avisa per separat.
  //
  // Mecanoide (manual p. 88): "no poden tenir cap tret sobrenatural" — es
  // bloqueja aquí, al càlcul de `dotat`, en lloc de només avisar (com fa
  // `validacio/coherencia.mjs`, que és no-bloquejant per disseny, DA-5/G-3):
  // aquesta regla no és cap judici del DJ sobre si el tret és adequat, és
  // una incompatibilitat categòrica d'espècie — el mateix tipus de regla
  // dura que ja aplica INEPTE/ADEPTE. El tret pot seguir comprat i pagat
  // (l'avís de coherència ho continua senyalant), però no dona `dotat`:
  // no es pot manifestar ni contrarestar (ambdós consulten `sys.dotat`),
  // i la secció Sobrenatural de la fitxa queda oculta (`_prepSobrenatural`).
  const dotatDo = (sys.especie !== "mecanoide" && dons.size) ? [...dons][0] : null;
  sys.dotat = dotatDo;

  if (!dotatDo) {
    sys.equilibri.max = 0;
    sys.equilibri.actual = 0;
    sys.equilibri.zona = "normal";
    return;
  }

  const donCfg = cfg.DONS[dotatDo];
  const atributDo = donCfg.atribut ?? sys.qiAtribut ?? "FOR";
  const habNivell = sys.habilitats[donCfg.habilitat]?.nivell ?? 0;
  const max = (sys.atributs[atributDo] ?? 0) + habNivell;

  sys.equilibri.max       = max;
  sys.equilibri.atribut   = atributDo;
  sys.equilibri.habilitat = donCfg.habilitat;

  const actual = max - (sys.equilibri.gastat ?? 0);
  sys.equilibri.actual = actual;
  sys.equilibri.zona = actual > 0 ? "normal" : actual > -max ? "fatiga" : "ferides";
}

/**
 * Bonificacions actives de l'actor (Fase 3): artefactes sempre actius
 * equipats i efectes temporals amb `flags.forja.bonus`.
 * @param {Actor|undefined} actor
 * @returns {object}
 */
function _bonificacions(actor) {
  const total = bonificacionsBuides();
  for (const item of actor?.items ?? []) {
    if (item.type === "artefacte" && artefacteSempreActiu(item)) {
      sumarBonificacions(total, bonificacionsDeParametres(item.system.parametres));
    }
  }
  for (const efecte of actor?.effects ?? []) {
    if (efecte.disabled) continue;
    const bonus = efecte.flags?.forja?.bonus;
    if (bonus) sumarBonificacions(total, bonus);
  }
  return total;
}

/** Stats derivats que un tret pot modificar amb `efecte.stat`/`efecte.delta`. */
const STATS_MODIFICABLES_PER_TRETS = new Set(["reaccionsMax", "latenciaBase", "defensa", "reduccioDany"]);

/**
 * Aplica els efectes mecànics (`system.efecte`) dels trets de l'actor als
 * stats derivats ja calculats. Vegeu la documentació a `item-tret.mjs`.
 * @param {TypeDataModel} sys
 * @returns {Set<string>} flags actius (`efecte.flag`) entre els trets de l'actor
 */
function _aplicarEfectesTrets(sys) {
  const flags = new Set();
  const items = sys.parent?.items;
  if (!items) return flags;

  const aplicar = (efecte) => {
    if (!efecte) return;
    if (efecte.stat && STATS_MODIFICABLES_PER_TRETS.has(efecte.stat) && Number.isFinite(efecte.delta)) {
      sys[efecte.stat] = (sys[efecte.stat] ?? 0) + efecte.delta;
    }
    if (efecte.flag) flags.add(efecte.flag);
  };
  for (const item of items) {
    if (item.type === "tret") aplicar(item.system?.efecte);
  }
  // Fase 3: trets temporals d'efectes i artefactes (p. ex. Benedicció del
  // fanàtic → dur de pelar), amb l'efecte mecànic del catàleg.
  const propis = new Set(items.filter(i => i.type === "tret").map(i => i.getFlag?.("forja", "catalegId")));
  for (const id of sys.bonus?.trets ?? []) {
    if (propis.has(id)) continue;
    aplicar(CONFIG.FORJA?.LLISTA_TRETS?.find(t => t.id === id)?.efecte);
  }
  return flags;
}

/**
 * Retorna el nivell actiu (1–7) donats els marcats i els punts per nivell.
 * Nivell 1 si no hi ha cap casella marcada.
 *
 * Als múltiples EXACTES de `perNivell` (haver omplert un nivell sencer),
 * es considera que ja s'ha passat al nivell següent (pitjor) — floor+1
 * enlloc de ceil. Decisió confirmada contra l'exemple "Yoko vs gólems"
 * (09_CONTEXT_SESSIONS.md): 4 ferides amb perNivell=4 dona nivell 2
 * (masegat), no nivell 1; 16 dona nivell 5 (malferit), no nivell 4.
 */
function _nivellActiu(marcats, perNivell) {
  if (marcats <= 0 || perNivell <= 0) return 1;
  return Math.min(7, Math.floor(marcats / perNivell) + 1);
}

/**
 * Calcula el cost en PC de la construcció actual del personatge i en
 * dedueix els PC gastats/lliures del pressupost de creació (S-05).
 *
 * A4 (pla de revisió): `costTotal` és el cost de TOT el que hi ha ara mateix
 * al full (atributs, espècie, mida, constitució, habilitats, trets,
 * efectes i artefactes que no són prototips) —
 * inclou tant el que es va triar a la creació com qualsevol millora
 * comprada més tard amb PX (`millora.mjs` fa servir exactament les
 * mateixes taules de cost). Com que aquell PX ja s'ha pagat amb
 * `sys.px.gastats`, cal restar-lo de `costTotal` abans de comparar-lo amb
 * el pressupost de PC (`sys.pc`) — si no, cada millora amb PX també
 * consumiria pressupost de PC (comptat dues vegades) i l'avís de
 * "pressupost excedit" saltaria sense que el jugador hagi tocat cap PC.
 *
 *   pcGastats = costTotal − px.gastats
 *   pcLliures = pc − pcGastats
 *
 * Això cancel·la exactament les quatre operacions de `millora.mjs`:
 *   - Pujar un atribut/habilitat: costTotal puja en `cost` PX i
 *     `px.gastats` puja en el mateix `cost` → pcGastats no canvia.
 *   - Afegir un tret positiu amb PX: costTotal puja en `tret.cost` i
 *     `px.gastats` puja en el mateix `tret.cost` → pcGastats no canvia.
 *   - Treure un tret negatiu amb PX (cost negatiu, p. ex. −10): costTotal
 *     puja en −(−10) = 10 (desapareix el −10 de la suma) i `px.gastats`
 *     puja en `cost = -costTret = 10` → pcGastats no canvia.
 *
 * Límit conegut: aquest càlcul no distingeix un canvi fet a mà en mode
 * edició (p. ex. el DJ puja un atribut directament al full) d'una compra
 * per punts de creació — qualsevol pujada de valor es compta com a "PC
 * gastat" llevat que es compensi pujant `px.gastats` (que és exactament el
 * que fa `millora.mjs`). Editar camps directament sense passar per
 * `millora.mjs` es continua comptant com a despesa de PC.
 * @param {TypeDataModel} sys
 * @param {object} cfg CONFIG.FORJA
 */
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

  // Trets, efectes i artefactes: el manual els compta dins els PC del
  // personatge (cap. 2, exemple de l'Anya Barker, l. 2098: 163 + 37 dels
  // efectes = 200 PC). Un efecte après amb PX (`progressio-sobrenatural.mjs`)
  // suma el mateix a `px.gastats`, i es cancel·la. Els prototips (R+D, fets
  // en joc, sense PC ni PX) no compten; un artefacte de producció trobat en
  // joc sí: és el límit conegut de més avall (el DJ ho decideix).
  const items = sys.parent?.items;
  if (items) {
    for (const item of items) {
      if (item.type === "tret" || item.type === "efecte") cost += item.system.cost ?? 0;
      else if (item.type === "artefacte" && (item.system.fase ?? "produccio") === "produccio") {
        cost += costTotalModular(item).cost;
      }
    }
  }

  sys.costTotal = cost;
  sys.pcGastats = cost - (sys.px?.gastats ?? 0);
  sys.pcLliures = sys.pc - sys.pcGastats;
}
