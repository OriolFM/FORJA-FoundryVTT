/**
 * Guanyar punts d'experiència (Fase 4; manual › Experiència i millores ›
 * Guanyar punts d'experiència, l. 6577–6665). Funcions pures: la taula de
 * recompenses, les virtuts i l'historial de PX. El diàleg del DJ és a
 * `apps/dialeg-repartir-px.mjs`.
 *
 * Automatitza el càlcul, no la decisió: el DJ tria quins objectius s'han
 * acomplert i quines virtuts s'han interpretat; el codi en suma els PX.
 */

/**
 * Taula de recompenses (l. ~6640). Objectius de grup i individuals, al final
 * de la campanya o mòdul; virtuts, +1 PX al final de la sessió.
 */
export const RECOMPENSES_PX = {
  grup:       { menor: 4, rutinari: 8, major: 16, epic: 32 },
  individual: { menor: 2, rutinari: 4, major: 8,  epic: 16 },
  virtut: 1
};

/** Nivells d'objectiu (l. 6589–6593). */
export const NIVELLS_OBJECTIU = ["menor", "rutinari", "major", "epic"];

/** Virtuts (l. 6603–6633). «Només una per categoria i només una per jugador» a cada sessió. */
export const VIRTUTS = [
  "altruisme", "compassio", "determinacio", "eloquencia", "fiabilitat", "honor", "humor", "inventiva",
  "justicia", "lleialtat", "moderacio", "portent", "responsabilitat", "saviesa", "unitat", "valor"
];

/**
 * PX d'un objectiu.
 * @param {"grup"|"individual"} tipus
 * @param {string} nivell
 * @returns {number}
 */
export function pxObjectiu(tipus, nivell) {
  return RECOMPENSES_PX[tipus]?.[nivell] ?? 0;
}

/**
 * Recompenses d'un PJ en un repartiment.
 * @param {object} p
 * @param {Array<{nivell:string, descripcio?:string}>} [p.grup=[]]        Objectius de grup acomplerts.
 * @param {Array<{nivell:string, descripcio?:string}>} [p.individuals=[]]  Objectius individuals del PJ.
 * @param {string|null} [p.virtut=null]  Virtut interpretada (com a màxim una per jugador i sessió).
 * @param {number} [p.altres=0]          PX addicionals a criteri del DJ.
 * @returns {{total:number, linies:Array<{px:number, motiu:object}>}}
 */
export function recompensesPJ({ grup = [], individuals = [], virtut = null, altres = 0 } = {}) {
  const linies = [];
  for (const o of grup) {
    const px = pxObjectiu("grup", o.nivell);
    if (px) linies.push({ px, motiu: { tipus: "grup", nivell: o.nivell, descripcio: o.descripcio ?? "" } });
  }
  for (const o of individuals) {
    const px = pxObjectiu("individual", o.nivell);
    if (px) linies.push({ px, motiu: { tipus: "individual", nivell: o.nivell, descripcio: o.descripcio ?? "" } });
  }
  if (virtut && VIRTUTS.includes(virtut)) linies.push({ px: RECOMPENSES_PX.virtut, motiu: { tipus: "virtut", virtut } });
  const extra = Math.trunc(Number(altres) || 0);
  if (extra) linies.push({ px: extra, motiu: { tipus: "altres", descripcio: "" } });
  return { total: linies.reduce((s, l) => s + l.px, 0), linies };
}

/**
 * Comprova la regla de les virtuts d'una sessió: cada virtut només la pot
 * rebre un PJ (l. 6639: «només una per cada categoria i només una per jugador»).
 * @param {Record<string, string|null>} virtutsPerPJ  id del PJ → virtut
 * @returns {string[]}  Virtuts repetides
 */
export function virtutsRepetides(virtutsPerPJ) {
  const vistes = new Map();
  for (const v of Object.values(virtutsPerPJ ?? {})) {
    if (!v) continue;
    vistes.set(v, (vistes.get(v) ?? 0) + 1);
  }
  return [...vistes].filter(([, n]) => n > 1).map(([v]) => v);
}

/**
 * Afegeix entrades a l'historial de PX (la més nova al final), limitat a les
 * `maxim` darreres.
 * @param {object[]} historial
 * @param {Array<{px:number, motiu:object}>} linies  px positiu = guanyat, negatiu = gastat
 * @param {number} [data=Date.now()]
 * @param {number} [maxim=200]
 * @returns {object[]}
 */
export function afegirHistorial(historial, linies, data = Date.now(), maxim = 200) {
  const nou = [...(historial ?? []), ...linies.map(l => ({ data, px: l.px, motiu: l.motiu }))];
  return nou.slice(-maxim);
}
