import { actualitzarComGM } from "../xarxa/socket.mjs";

/**
 * Reaccions i concentració (S-11).
 *
 * - `reaccions.gastades` es reinicia al final del torn de l'actor (el manual diu
 *   que recuperen reaccions els qui han actuat).
 * - `concentrat`: dona +1 dau a la propera acció però bloqueja reaccionar; rebre
 *   cert dany o estats trenca la concentració i cancel·la l'acció en curs.
 *   (Manual FC001CA, SISTEMES › Gestió del temps de joc › Reaccions / Concentració;
 *   › Salut › Estats › Concentrat.) Es declara al diàleg de declarar acció, la
 *   consumeix la següent tirada (`consumirConcentracio`) i la trenca el dany
 *   (`atac.mjs`).
 *
 * Les escriptures passen per `actualitzarComGM` (A2): p.ex. qui defensa un
 * PNJ atacat per un jugador no n'és propietari.
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
  await actualitzarComGM(actor, { "system.reaccions.gastades": actor.system.reaccions.gastades + 1 });
  return true;
}

/**
 * Reinicia les reaccions gastades de l'actor (al final del seu torn).
 * @param {ForjaActor} actor
 */
export async function reiniciarReaccions(actor) {
  if (actor.system.reaccions.gastades === 0) return;
  await actualitzarComGM(actor, { "system.reaccions.gastades": 0 });
}

/**
 * Posa l'actor en estat de concentració (+1 dau a la propera acció,
 * bloqueja reaccionar fins que es trenqui o es resolgui l'acció).
 * @param {ForjaActor} actor
 */
export async function concentrar(actor) {
  await actualitzarComGM(actor, { "system.concentrat": true });
}

/**
 * Trenca la concentració de l'actor (per dany o estat) i cancel·la
 * qualsevol acció concentrada en curs.
 * @param {ForjaActor} actor
 * @returns {Promise<boolean>} `true` si l'actor estava concentrat (l'acció es cancel·la)
 */
export async function trencarConcentracio(actor) {
  if (!actor.system.concentrat) return false;
  await actualitzarComGM(actor, { "system.concentrat": false });
  return true;
}

/**
 * Consumeix la concentració en fer la tirada de l'acció declarada (B5).
 * Manual FC001CA, SISTEMES › Gestió del temps de joc › Concentració: el PJ que
 * es concentra "tira un dau addicional per fer la tasca, però no pot
 * reaccionar fins que la seva acció hagi acabat" — en tirar, l'acció acaba i
 * la concentració es neteja.
 * @param {ForjaActor} actor
 * @returns {Promise<number>} Daus addicionals a sumar a la tirada (1 si estava concentrat, 0 si no)
 */
export async function consumirConcentracio(actor) {
  if (!actor?.system?.concentrat) return 0;
  await actualitzarComGM(actor, { "system.concentrat": false });
  return 1;
}

/**
 * Fixa l'estat de concentració en declarar una acció (B5): `true` si el
 * jugador declara que s'hi concentra; `false` neteja una concentració
 * anterior que no s'hagués consumit.
 * @param {ForjaActor} actor
 * @param {boolean} valor
 */
export async function establirConcentracio(actor, valor) {
  if (!!actor.system.concentrat === !!valor) return;
  await actualitzarComGM(actor, { "system.concentrat": !!valor });
}
