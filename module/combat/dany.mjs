/**
 * Pipeline de dany (S-14, A2). Verificat contra el manual (FORJA_03_SISTEMES.md, p. 92-94;
 * FC001CA: SISTEMES › Dany › Protecció / Reducció de dany / Dany mínim):
 *
 *   danyTotal = danyBaseArma(resolt) + excedentAtac
 *
 *   1. Ègida (si n'hi ha i és efectiva contra el tipus de dany):
 *      - danyTotal ≤ protecció ègida → dany final 0, ègida intacta
 *      - danyTotal > protecció ègida → ègida es trenca (queda inactiva
 *        `danyTotal − protecció` torns); l'objectiu rep el DANY MÍNIM
 *        com si fos dany directe, IGNORANT armadura i reducció
 *
 *   2. Armadura: restant = danyTotal − armadura
 *      - restant ≤ 0 → l'armadura ATURA l'atac per complet, dany final 0
 *        (no s'aplica el dany mínim — l'armadura ha parat l'atac, no la reducció)
 *
 *   3. Reducció de dany: final = restant − reduccioDany
 *      - si final ≤ 0 → ha estat la REDUCCIÓ qui ha portat el dany a zero
 *        (l'armadura no ha aturat l'atac del tot): s'aplica el DANY MÍNIM
 *        = 1 + bonificador fix de l'arma (o moviment especial)
 *      - si no, `final` és el dany que es marca a la pista corresponent
 */

/**
 * Resol la fórmula de dany d'una arma (p. ex. "FOR+2", "DES+1", "3") contra
 * un actor, retornant tant el valor total com el bonificador fix (la part
 * numèrica constant, necessària per calcular el Dany mínim).
 *
 * @param {string} formula
 * @param {ForjaActor} [actor]
 * @returns {{valor:number, bonificador:number}}
 */
export function resoldreDanyArma(formula, actor) {
  const text = String(formula ?? "").trim().toUpperCase();
  const m = text.match(/^(?:([A-Z]{3})\s*(?:\+\s*(\d+))?|(\d+))$/);
  if (!m) return { valor: 0, bonificador: 0 };

  const [, atribut, bonusAmbAtribut, bonusSol] = m;
  const bonificador = Number(bonusAmbAtribut ?? bonusSol ?? 0);
  const base = atribut ? (actor?.system?.atributs?.[atribut] ?? 0) : 0;

  return { valor: base + bonificador, bonificador };
}

/**
 * Calcula el dany final que rep un objectiu, aplicant ègida, armadura i
 * reducció de dany pel mateix ordre i casuística que el manual.
 *
 * @param {object}  config
 * @param {number}  config.danyBaseArma   Dany base de l'arma ja resolt (valor de `resoldreDanyArma`)
 * @param {number}  config.bonificadorArma Bonificador fix de l'arma/moviment especial (per al Dany mínim)
 * @param {number}  config.excedentAtac   Excedent de la tirada d'atac sobre la dificultat
 * @param {number}  config.reduccioDany   Reducció de dany del defensor (= FOR)
 * @param {number}  [config.armadura=0]   Protecció de l'armadura del defensor (si escau pel tipus)
 * @param {object}  [config.egida]        `{ activa, absorcio, tornsInactiva }` — ègida efectiva contra aquest tipus de dany
 * @returns {{danyTotal:number, danyFinal:number, egidaTrencada:boolean, tornsInactivaEgida:number}}
 */
export function calcularDany({
  danyBaseArma,
  bonificadorArma = 0,
  excedentAtac,
  reduccioDany,
  armadura = 0,
  egida = null
}) {
  const danyTotal = danyBaseArma + excedentAtac;
  const danyMinim = 1 + bonificadorArma;

  // 1. Ègida
  if (egida?.activa && egida.absorcio > 0) {
    if (danyTotal <= egida.absorcio) {
      return { danyTotal, danyFinal: 0, egidaTrencada: false, tornsInactivaEgida: 0 };
    }
    return {
      danyTotal,
      danyFinal: danyMinim,
      egidaTrencada: true,
      tornsInactivaEgida: danyTotal - egida.absorcio
    };
  }

  // 2. Armadura
  const restantArmadura = danyTotal - armadura;
  if (restantArmadura <= 0) {
    return { danyTotal, danyFinal: 0, egidaTrencada: false, tornsInactivaEgida: 0 };
  }

  // 3. Reducció de dany — el Dany mínim només s'aplica si la reducció (no l'armadura) porta el dany a zero
  const restantReduccio = restantArmadura - reduccioDany;
  const danyFinal = restantReduccio > 0 ? restantReduccio : danyMinim;

  return { danyTotal, danyFinal, egidaTrencada: false, tornsInactivaEgida: 0 };
}

/**
 * Encamina i marca el dany a la pista de salut corresponent (fatiga o ferides),
 * a partir del nivell actiu cap avall (regla d'arrossegament del manual).
 *
 * @param {object} salut       `system.salut` de l'actor objectiu
 * @param {"fatiga"|"ferides"} pista
 * @param {number} quantitat   Caselles a marcar
 * @returns {number} Total de caselles marcades després d'aplicar el dany
 */
export function aplicarDanyAPista(salut, pista, quantitat) {
  const linia = salut[pista];
  linia.marcats = Math.max(0, linia.marcats + quantitat);
  return linia.marcats;
}

/* -------------------------------------------- */
/*  Armadures i ègides (B3, B4)                 */
/* -------------------------------------------- */

/**
 * Una armadura compta si està equipada. Les armadures d'abans del camp
 * `equipada` (WP-G) es consideren equipades (`!== false`).
 * @param {{type:string, system:object}} item
 * @returns {boolean}
 */
export function esArmaduraEquipada(item) {
  return item?.type === "armadura" && item.system?.equipada !== false;
}

/**
 * Protecció d'armadura efectiva d'un objectiu (B3, funció pura).
 *
 * Manual FC001CA, SISTEMES › Dany › Protecció i › Armadures i ègides ›
 * Armadures: la protecció es resta del dany total. Decisió del dissenyador
 * (Q3, Oriol FM): amb diverses armadures equipades, protegeix NOMÉS la
 * millor; les latències s'apilen (ja ho fa `actor-personatge.mjs`).
 *
 * El manual no lliga el tipus d'armadura a la categoria de l'arma; només
 * alguns moviments especials en fan cas (p.ex. la maniobra d'arts marcials
 * "Cop penetrant" ignora les armadures naturals i flexibles) — d'aquí
 * `ignorarTipus`.
 *
 * @param {Iterable<{type:string, system:object}>} items  Ítems de l'objectiu
 * @param {object} [opcions]
 * @param {string[]} [opcions.ignorarTipus=[]]  Tipus d'armadura (`fisica`/`flexible`/`natural`) que no compten
 * @returns {number}
 */
export function proteccioArmadura(items, { ignorarTipus = [] } = {}) {
  let millor = 0;
  for (const item of items ?? []) {
    if (!esArmaduraEquipada(item)) continue;
    if (ignorarTipus.includes(item.system.tipus)) continue;
    millor = Math.max(millor, item.system.reduccio ?? 0);
  }
  return millor;
}

/**
 * Tria l'ègida activa d'un objectiu (B4, funció pura): la de més protecció
 * entre les armadures equipades amb l'ègida activa i `absorcio > 0`.
 * @param {Iterable<{type:string, system:object}>} items
 * @returns {object|null}  L'ítem d'armadura que la porta, o `null`
 */
export function itemEgidaActiva(items) {
  let millor = null;
  for (const item of items ?? []) {
    if (!esArmaduraEquipada(item)) continue;
    const e = item.system.egida;
    if (!e?.activa || !(e.absorcio > 0)) continue;
    if (!millor || e.absorcio > millor.system.egida.absorcio) millor = item;
  }
  return millor;
}

/**
 * Tick del rellotge en què una ègida trencada torna a ser efectiva (B4,
 * funció pura). Manual FC001CA, › Dany › Protecció: "l'ègida es trenca i
 * roman inactiva un nombre de torns equivalent al dany que la sobrepassa";
 * el dissenyador (Q2, Oriol FM) confirma que aquests torns són caselles del
 * rellotge de temps actiu, no torns del portador.
 * @param {number} marcador  Posició actual del marcador de temps
 * @param {number} tornsInactiva
 * @returns {number}
 */
export function tickReactivacioEgida(marcador, tornsInactiva) {
  return (marcador ?? 0) + Math.max(0, tornsInactiva ?? 0);
}

/**
 * Decideix si una ègida trencada s'ha de reactivar ara (B4, funció pura): té
 * un tick de reactivació desat (`flags.forja.egidaReactivaAlTick`), el
 * marcador l'ha assolit (o passat) i l'ègida encara té protecció
 * (`absorcio > 0`). El tick només es desa si el portador és combatent d'un
 * combat començat; en esborrar-lo o en començar-ne un altre, el DJ neteja els
 * ticks pendents (`ForjaCombat`), de manera que no queden ticks d'altres combats.
 * @param {{type:string, system:object, flags?:object}} item
 * @param {number} marcador
 * @returns {boolean}
 */
export function egidaHaDeReactivar(item, marcador) {
  if (item?.type !== "armadura") return false;
  const e = item.system?.egida;
  if (!e || e.activa || !(e.absorcio > 0)) return false;
  const tick = item.flags?.forja?.egidaReactivaAlTick;
  if (typeof tick !== "number") return false;
  return marcador >= tick;
}

/* -------------------------------------------- */
/*  Concentració (B5)                           */
/* -------------------------------------------- */

/**
 * Efecte del dany sobre un personatge concentrat (B5, funció pura).
 * Manual FC001CA, SISTEMES › Gestió del temps de joc › Concentració: "Si un
 * PJ pateix dany mentre està concentrat, perdrà la concentració i els
 * beneficis que n'extreu"; › Salut › Estats › Concentrat: "Si un PJ concentrat
 * rep més punts de dany que la seva FOR, se'l considera atordit, l'acció per
 * la que es concentrava fracassa, i haurà de tornar a declarar".
 * @param {boolean} concentrat
 * @param {number} danyFinal
 * @param {number} forca  FOR de l'objectiu
 * @returns {{trenca:boolean, atordit:boolean}}
 */
export function efecteDanyConcentracio(concentrat, danyFinal, forca) {
  if (!concentrat || !(danyFinal > 0)) return { trenca: false, atordit: false };
  return { trenca: true, atordit: danyFinal > (forca ?? 0) };
}
