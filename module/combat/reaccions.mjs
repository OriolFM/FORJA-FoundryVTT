/**
 * Reaccions i concentració (S-11).
 *
 * - `reaccions.gastades` es reinicia al final del torn de l'actor (el manual diu
 *   que recuperen reaccions els qui han actuat).
 * - `concentrat`: dona +1 dau a la propera acció però bloqueja reaccionar; rebre
 *   cert dany o estats trenca la concentració i cancel·la l'acció en curs.
 */

/**
 * Comprova si l'actor pot gastar una reacció (té reaccions disponibles i no
 * està concentrat — la concentració bloqueja reaccionar).
 * @param {ForjaActor} actor
 * @returns {boolean}
 */
export function potReaccionar(actor) {
  const sys = actor.system;
  if (sys.concentrat) return false;
  return sys.reaccions.gastades < (sys.reaccionsMax ?? 1);
}

/**
 * Gasta una reacció de l'actor, si en té disponible.
 * @param {ForjaActor} actor
 * @returns {Promise<boolean>} `true` si s'ha pogut gastar
 */
export async function gastarReaccio(actor) {
  if (!potReaccionar(actor)) return false;
  await actor.update({ "system.reaccions.gastades": actor.system.reaccions.gastades + 1 });
  return true;
}

/**
 * Reinicia les reaccions gastades de l'actor (al final del seu torn).
 * @param {ForjaActor} actor
 */
export async function reiniciarReaccions(actor) {
  if (actor.system.reaccions.gastades === 0) return;
  await actor.update({ "system.reaccions.gastades": 0 });
}

/**
 * Posa l'actor en estat de concentració (+1 dau a la propera acció,
 * bloqueja reaccionar fins que es trenqui o es resolgui l'acció).
 * @param {ForjaActor} actor
 */
export async function concentrar(actor) {
  await actor.update({ "system.concentrat": true });
}

/**
 * Trenca la concentració de l'actor (per dany o estat) i cancel·la
 * qualsevol acció concentrada en curs.
 * @param {ForjaActor} actor
 * @returns {Promise<boolean>} `true` si l'actor estava concentrat (l'acció es cancel·la)
 */
export async function trencarConcentracio(actor) {
  if (!actor.system.concentrat) return false;
  await actor.update({ "system.concentrat": false });
  return true;
}
