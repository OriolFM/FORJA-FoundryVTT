import { opcionsDefensa, resoldreOpcioDefensa, triarMitjaBlocar } from "./defensa.mjs";

/**
 * Defensa completa declarada (manual › Defensar-se; Oriol FM, 2026-10-04).
 *
 * Quan un combatent declara una acció defensiva completa:
 *   1. La tirada de defensa es fa EN DECLARAR, sempre amb concentració
 *      (+1 dau). Blocar no tira daus.
 *   2. El resultat queda desat al combatent (`flags.forja.defensaCompleta`) i
 *      tots els atacs que rebi es resolen directament contra aquest resultat,
 *      sense preguntar ni gastar reaccions.
 *   3. Dura fins al final del seu propi torn: quan arriba la seva casella, els
 *      atacs del mateix tic es resolen abans (vegeu `_sortCombatants`), i en
 *      declarar la propera acció la defensa s'acaba.
 */

/** Clau del flag al Combatant. */
const FLAG = "defensaCompleta";

/** Dau addicional de la concentració (manual › Gestió del temps de joc › Concentració). */
export const DAUS_CONCENTRACIO = 1;

/**
 * Tira la defensa completa declarada i en retorna les dades a desar.
 * @param {ForjaActor} actor
 * @param {object} opcio      Opció de `opcionsDefensa(actor, …, { declarada: true })`
 * @param {Combat} combat
 * @returns {Promise<object|null>}
 */
export async function tirarDefensaCompleta(actor, opcio, combat) {
  if (!opcio) return null;
  const nom = game.i18n.format("FORJA.Combat.DefensaCompletaEtiqueta", { defensa: opcio.nom });
  const ambConcentracio = opcio.senseTirada ? opcio : { ...opcio, nom, pool: (opcio.pool ?? 0) + DAUS_CONCENTRACIO };
  const r = await resoldreOpcioDefensa(actor, { ...ambConcentracio, gastaReaccio: false });
  if (!r) return null;
  return {
    combatId:   combat.id,
    opcioId:    opcio.id,
    nom,
    senseTirada: !!opcio.senseTirada,
    dificultat: r.dificultat,
    danyExtra:  r.danyExtra ?? 0,
    mitjaId:    opcio.mitjaId ?? null
  };
}

/**
 * Desa (o esborra, amb `null`) la defensa completa del combatent.
 * @param {Combatant} combatant
 * @param {object|null} dades
 */
export async function desarDefensaCompleta(combatant, dades) {
  if (dades) await combatant.setFlag("forja", FLAG, dades);
  else if (combatant.getFlag("forja", FLAG)) await combatant.unsetFlag("forja", FLAG);
}

/**
 * Defensa completa vigent d'un combatent en aquest combat.
 * @param {Combat} combat
 * @param {Combatant|null} combatant
 * @returns {object|null}
 */
export function defensaCompletaDe(combat, combatant) {
  const dc = combatant?.getFlag("forja", FLAG);
  return (dc && dc.combatId === combat?.id) ? dc : null;
}

/**
 * Combatant d'un token (o, si no n'hi ha, del mateix actor) en un combat.
 * @param {Combat} combat
 * @param {Token|null} token
 * @param {Actor|null} actor
 * @returns {Combatant|null}
 */
export function combatantDe(combat, token, actor) {
  if (!combat) return null;
  return combat.combatants.find(c => token && c.tokenId === (token.id ?? token.document?.id))
    ?? combat.combatants.find(c => actor && c.actor?.id === actor.id)
    ?? null;
}

/**
 * Resolució d'un atac contra una defensa completa ja tirada. La dificultat
 * no baixa mai de la que correspon a l'atac concret (p. ex. la defensa bàsica
 * segons la banda de rang, +1 per a esquivar/parar).
 * @param {object} dc               Dades de `defensaCompletaDe`
 * @param {object} p
 * @param {ForjaActor} p.objectiu
 * @param {number} p.defensaBasica  Defensa bàsica per a aquest atac
 * @param {string|null} p.categoriaAtac
 * @returns {{eleccio:object, resolucio:object}}
 */
export function resolucioDefensaCompleta(dc, { objectiu, defensaBasica, categoriaAtac }) {
  if (dc.opcioId === "blocar") {
    // Blocar no té tirada: el mitjà depèn de l'arma atacant (B15).
    let bl = opcionsDefensa(objectiu, defensaBasica, { declarada: true, categoriaAtac }).find(o => o.id === "blocar");
    bl = bl ? triarMitjaBlocar(bl, dc.mitjaId) : null;
    return {
      eleccio: { id: "blocar", nom: dc.nom, nomMitja: bl?.nomMitja ?? null },
      resolucio: { dificultat: defensaBasica, exigirSuperar: true, reduccioExtra: bl?.reduccioExtra ?? 0, danyExtra: 0, roll: null }
    };
  }
  return {
    eleccio: { id: dc.opcioId, nom: dc.nom },
    resolucio: {
      dificultat:    Math.max(dc.dificultat ?? 0, defensaBasica + 1),
      exigirSuperar: true,
      reduccioExtra: 0,
      danyExtra:     dc.danyExtra ?? 0,
      roll: null
    }
  };
}
