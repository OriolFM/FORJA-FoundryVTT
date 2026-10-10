/**
 * Acció declarada damunt del token en passar el ratolí (funció pura; el
 * dibuix és a `canvas/token.mjs`). Amb molts combatents iguals costava
 * recordar què havia declarat cadascú (Oriol FM, 2026-10-10).
 *
 * La declaració és pública (surt al xat en declarar-la), de manera que es
 * mostra a tothom qui veu el token.
 */

import { normalitzarMoviment, permisMoviment } from "./moviment.mjs";

/** Nom curt de cada moviment per a l'indicador (Oriol FM, 2026-10-10: el text sencer era massa llarg). */
const NOM_MOVIMENT = {
  basic: "FORJA.Indicador.Moviment",
  rapid: "FORJA.Indicador.MovimentRapid",
  especial: "FORJA.Indicador.MovimentEspecial",
  carrega: "FORJA.Indicador.Carrega"
};

/**
 * Línies de text de l'acció pendent.
 * @param {object|null} pendent   `flags.forja.accioPendent` del combatent
 * @param {object} p
 * @param {number|null} [p.posicio]   Tic on actuarà (`initiative`)
 * @param {{nom:string, fletxa?:string, distancia?:number|null, aTocar?:boolean}|null} [p.objectiu]
 * @param {{caminar:number, correr:number}|null} [p.distancies]  `actor.system.moviment`
 * @param {(clau:string, dades?:object) => string} p.t  Traducció (`game.i18n.format`)
 * @returns {string[]}  Buida si no té cap acció declarada
 */
export function liniesAccio(pendent, { posicio = null, objectiu = null, distancies = null, t }) {
  if (!pendent?.tipus) return [];
  let primera;
  if (pendent.tipus === "moviment") {
    // Només el tipus de moviment i la distància: «Moviment 5 m», «Moviment ràpid 13 m».
    const mov = normalitzarMoviment(pendent.moviment);
    const metres = distancies ? permisMoviment(mov, distancies) : null;
    primera = `${t(NOM_MOVIMENT[mov] ?? NOM_MOVIMENT.basic)}${metres ? ` ${metres} m` : ""}`;
  } else {
    const tipus = t(`FORJA.Combat.Accio.${pendent.tipus.charAt(0).toUpperCase()}${pendent.tipus.slice(1)}`);
    const detall = pendent.etiqueta || pendent.label;
    primera = detall && detall !== tipus ? `${tipus}: ${detall}` : tipus;
  }
  if (posicio != null) primera += ` · ${t("FORJA.Combat.Tic", { n: posicio })}`;
  const linies = [primera];
  if (objectiu?.nom) {
    const lloc = objectiu.aTocar ? t("FORJA.Combat.ObjectiuATocar") : (objectiu.distancia != null ? `${objectiu.distancia} m` : "");
    const detallObj = [objectiu.fletxa, lloc].filter(Boolean).join(" ");
    linies.push(`→ ${objectiu.nom}${detallObj ? ` (${detallObj})` : ""}`);
  }
  return linies;
}
