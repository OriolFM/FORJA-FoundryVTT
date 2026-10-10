/**
 * Etiquetes dels objectius als desplegables d'atac (funcions pures). Amb
 * diversos PNJ amb el mateix nom no era evident quin es triava (Oriol FM,
 * 2026-10-10): es numeren els repetits i s'hi afegeix la direcció i la
 * distància des de l'atacant. El token triat, a més, es marca al mapa.
 */

const FLETXES = ["→", "↘", "↓", "↙", "←", "↖", "↑", "↗"];

/**
 * Fletxa de la direcció de l'objectiu vista des de l'atacant (coordenades del
 * canvas: x cap a la dreta, y cap avall).
 * @param {number} dx
 * @param {number} dy
 * @returns {string}  Una de 8 fletxes, o "" si és al mateix punt.
 */
export function fletxaDireccio(dx, dy) {
  if (!dx && !dy) return "";
  const angle = Math.atan2(dy, dx);                       // 0 = dreta, positiu = cap avall
  const sector = Math.round(angle / (Math.PI / 4));       // −4…4
  return FLETXES[(sector + 8) % 8];
}

/**
 * Afegeix a cada objectiu una `etiqueta`: el nom (numerat si es repeteix,
 * «nº 1», «nº 2»… en l'ordre de la llista, que és per distància), la fletxa
 * de direcció i la distància (o «a tocar»).
 * @param {Array<{nom:string, distancia:number|null, aTocar:boolean, dx?:number, dy?:number}>} objectius
 * @param {{aTocar:string}} textos  Text ja traduït per a «a tocar»
 * @returns {Array<object>}  Còpies amb `etiqueta`
 */
export function etiquetarObjectius(objectius, { aTocar = "a tocar" } = {}) {
  const total = new Map();
  for (const o of objectius) total.set(o.nom, (total.get(o.nom) ?? 0) + 1);
  const vist = new Map();
  return objectius.map(o => {
    const n = (vist.get(o.nom) ?? 0) + 1;
    vist.set(o.nom, n);
    const nom = total.get(o.nom) > 1 ? `${o.nom} nº ${n}` : o.nom;
    const fletxa = fletxaDireccio(o.dx ?? 0, o.dy ?? 0);
    const lloc = o.aTocar ? aTocar : (o.distancia != null ? `${o.distancia} m` : "");
    const detall = [fletxa, lloc].filter(Boolean).join(" ");
    return { ...o, nomNumerat: nom, etiqueta: detall ? `${nom} (${detall})` : nom };
  });
}

/**
 * Marca al mapa el token triat com a objectiu (punt de mira de Foundry) i,
 * si es demana, hi fa un «ping» perquè es vegi on és. Sense id, treu els
 * objectius marcats. (No és pura: toca el canvas.)
 * @param {string|null} tokenId
 * @param {{ping?: boolean}} [opcions]
 */
export function marcarObjectiu(tokenId, { ping = false } = {}) {
  if (!canvas?.ready) return;
  const token = tokenId ? canvas.tokens?.get(tokenId) : null;
  if (!token) {
    for (const t of [...(game.user?.targets ?? [])]) t.setTarget(false, { releaseOthers: false });
    return;
  }
  token.setTarget(true, { releaseOthers: true });
  if (ping) canvas.ping?.(token.center);
}
