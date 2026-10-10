/**
 * Corregir una declaració i tornar a declarar quan l'objectiu cau (funcions
 * pures). Decisions de l'Oriol FM (2026-10-10):
 *  - El DJ pot corregir la declaració de qualsevol PJ o PNJ en qualsevol
 *    moment (abans de resoldre-la).
 *  - Qui la va declarar la pot corregir mentre el rellotge no s'hagi mogut
 *    des de la declaració (errors de clic, no canvis d'opinió).
 *  - Si l'objectiu de l'acció queda fora de combat, el declarant pot tornar a
 *    declarar des del moment en què l'objectiu ha caigut.
 * La posició nova es compta des d'on es va declarar (`posicioBase`), no des
 * de la posició ja sumada; si queda enrere del marcador, actua al marcador.
 */

/**
 * @param {object} p
 * @param {boolean} p.esDJ
 * @param {object|null} p.pendent   `flags.forja.accioPendent`
 * @param {number} p.marcador       Marcador actual del rellotge
 * @param {string|null} [p.estatTorn]  `flags.forja.estatTorn` ("resolta"…)
 * @returns {boolean}
 */
export function potCorregir({ esDJ, pendent, marcador, estatTorn = null }) {
  if (!pendent?.tipus || estatTorn === "resolta") return false;
  if (esDJ) return true;
  return pendent.declaradaAlMarcador === marcador;
}

/**
 * Posició des d'on es compta la latència de la declaració nova.
 * @param {object|null} pendent
 * @param {{marcador:number, initiative:number|null, perObjectiuCaigut?:boolean}} p
 * @returns {number}
 */
export function posicioBaseRedeclaracio(pendent, { marcador, initiative, perObjectiuCaigut = false }) {
  if (perObjectiuCaigut && pendent?.objectiuCaigutAl != null) return pendent.objectiuCaigutAl;
  return pendent?.posicioBase ?? pendent?.declaradaAlMarcador ?? initiative ?? marcador;
}

/**
 * Posició final: la base més la latència, i mai enrere del marcador.
 * @param {number} base
 * @param {number} latencia
 * @param {number} marcador
 * @returns {number}
 */
export function posicioCorregida(base, latencia, marcador) {
  return Math.max(base + latencia, marcador);
}

/**
 * L'objectiu declarat ha caigut i el declarant pot tornar a declarar.
 * @param {object|null} pendent
 * @returns {boolean}
 */
export function potRedeclararPerObjectiu(pendent) {
  return pendent?.objectiuCaigutAl != null;
}
