/**
 * Con d'un tret d'àrea en forma de llàgrima (escopeta, arma de dispersió),
 * calculat pel sistema: Foundry v14 ja no deixa dibuixar plantilles de mesura
 * (`TemplateLayer` «@deprecated since v14», controls amagats). Oriol FM,
 * 2026-10-10: arc de 15°, amb la llargada de l'abast de l'arma (escopeta, 10 m).
 * Funcions pures (coordenades del canvas: x cap a la dreta, y cap avall;
 * angles en graus, 0 = cap a la dreta, sentit horari).
 */

/** Obertura del con (graus). */
export const OBERTURA_CON = 15;

/**
 * Direcció (graus) de l'origen cap a un punt.
 * @param {{x:number,y:number}} origen
 * @param {{x:number,y:number}} punt
 * @returns {number}
 */
export function direccioCap(origen, punt) {
  return Math.atan2(punt.y - origen.y, punt.x - origen.x) * 180 / Math.PI;
}

/**
 * Direcció (graus) cap on mira un token segons la seva rotació de Foundry
 * (0 = cap avall, sentit horari).
 * @param {number} rotacio
 * @returns {number}
 */
export function direccioDeRotacio(rotacio) {
  return ((rotacio ?? 0) + 90) % 360;
}

/**
 * El punt és dins el con?
 * @param {{origen:{x:number,y:number}, direccio:number, llargada:number, obertura?:number}} con  llargada en píxels
 * @param {{x:number,y:number}} punt
 * @returns {boolean}
 */
export function dinsCon({ origen, direccio, llargada, obertura = OBERTURA_CON }, punt) {
  const dx = punt.x - origen.x, dy = punt.y - origen.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return false;
  if (dist > llargada) return false;
  let diferencia = Math.abs(((Math.atan2(dy, dx) * 180 / Math.PI) - direccio) % 360);
  if (diferencia > 180) diferencia = 360 - diferencia;
  return diferencia <= obertura / 2;
}

/**
 * Vèrtexs del con per dibuixar-lo (polígon: origen i l'arc).
 * @param {{origen:{x:number,y:number}, direccio:number, llargada:number, obertura?:number}} con
 * @param {number} [segments=12]
 * @returns {number[]}  [x0, y0, x1, y1, …]
 */
export function poligonCon({ origen, direccio, llargada, obertura = OBERTURA_CON }, segments = 12) {
  const punts = [origen.x, origen.y];
  for (let i = 0; i <= segments; i++) {
    const a = (direccio - obertura / 2 + (obertura * i) / segments) * Math.PI / 180;
    punts.push(origen.x + Math.cos(a) * llargada, origen.y + Math.sin(a) * llargada);
  }
  return punts;
}
