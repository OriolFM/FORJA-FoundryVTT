/**
 * Acció declarada damunt del token en passar el ratolí (funció pura; el
 * dibuix és a `canvas/token.mjs`). Amb molts combatents iguals costava
 * recordar què havia declarat cadascú (Oriol FM, 2026-10-10).
 *
 * La declaració és pública (surt al xat en declarar-la), de manera que es
 * mostra a tothom qui veu el token.
 */

/**
 * Línies de text de l'acció pendent.
 * @param {object|null} pendent   `flags.forja.accioPendent` del combatent
 * @param {object} p
 * @param {number|null} [p.posicio]   Tic on actuarà (`initiative`)
 * @param {{nom:string, fletxa?:string, distancia?:number|null, aTocar?:boolean}|null} [p.objectiu]
 * @param {(clau:string, dades?:object) => string} p.t  Traducció (`game.i18n.format`)
 * @returns {string[]}  Buida si no té cap acció declarada
 */
export function liniesAccio(pendent, { posicio = null, objectiu = null, t }) {
  if (!pendent?.tipus) return [];
  const tipus = t(`FORJA.Combat.Accio.${pendent.tipus.charAt(0).toUpperCase()}${pendent.tipus.slice(1)}`);
  const detall = pendent.etiqueta || pendent.label;
  let primera = detall && detall !== tipus ? `${tipus}: ${detall}` : tipus;
  if (posicio != null) primera += ` · ${t("FORJA.Combat.Tic", { n: posicio })}`;
  const linies = [primera];
  if (objectiu?.nom) {
    const lloc = objectiu.aTocar ? t("FORJA.Combat.ObjectiuATocar") : (objectiu.distancia != null ? `${objectiu.distancia} m` : "");
    const detallObj = [objectiu.fletxa, lloc].filter(Boolean).join(" ");
    linies.push(`→ ${objectiu.nom}${detallObj ? ` (${detallObj})` : ""}`);
  }
  return linies;
}
