/**
 * Pipeline de dany (S-14, A2). Verificat contra el manual (FORJA_03_SISTEMES.md, p. 92-94):
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
