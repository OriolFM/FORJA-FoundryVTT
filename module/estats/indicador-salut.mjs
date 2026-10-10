/**
 * Indicadors de salut damunt del token (funcions pures; el dibuix és a
 * `canvas/token.mjs`). Oriol FM, 2026-10-10: la penalització per salut no es
 * veia mirant el mapa.
 *
 * - Insígnia: la penalització a la dificultat de les tirades (manual ›
 *   Salut, taula de nivells: +1 al 4, +2 al 5, +4 al 6) o «✕» al nivell 7
 *   (inconscient o incapacitat, fora de combat).
 * - En passar el ratolí: nivell de fatiga i de ferides i els estats actius.
 */

/**
 * Text de la insígnia de penalització, o `null` si no n'hi ha.
 * @param {object|null} salut  `actor.system.salut` (derivats: `penalitzacio`, `foraDeCombat`)
 * @returns {string|null}
 */
export function textPenalitzacio(salut) {
  if (!salut) return null;
  if (salut.foraDeCombat) return "✕";
  const p = Number(salut.penalitzacio ?? 0);
  return p > 0 ? `+${p}` : null;
}

/**
 * Línies del resum de salut i estats.
 * @param {object|null} salut  `actor.system.salut`
 * @param {Iterable<string>} estats  `actor.statuses`
 * @param {(clau:string, dades?:object) => string} t  Traducció (`game.i18n.format`)
 * @returns {string[]}
 */
export function liniesSalut(salut, estats, t) {
  const linies = [];
  if (salut) {
    const fatiga = salut.fatiga?.nivellActiu ?? 1;
    const ferides = salut.ferides?.nivellActiu ?? 1;
    linies.push(`${t("FORJA.Salut.Fatiga")} ${fatiga} · ${t(`FORJA.NivellFatiga.${fatiga}`)}`);
    linies.push(`${t("FORJA.Salut.Ferides")} ${ferides} · ${t(`FORJA.NivellFerides.${ferides}`)}`);
  }
  const noms = [...(estats ?? [])].map(id => t(`FORJA.Estat.${id === "dead" ? "mort" : id}`));
  if (noms.length) linies.push(noms.join(", "));
  return linies;
}
