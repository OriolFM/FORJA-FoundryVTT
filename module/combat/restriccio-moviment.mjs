/**
 * Restricció de moviment en temps actiu (manual p. 359-361, 483-487):
 * "Un cop declarada l'acció, el marcador del PJ o PNJ es mou tantes
 * caselles com la latència de l'acció declarada" — el moviment és una
 * acció més que costa latència, no una cosa lliure i instantània. Sense
 * cap restricció, arrossegar un token al canvas en qualsevol moment
 * trenca completament la mecànica del rellotge (es pot reposicionar
 * gratis abans que et "toqui").
 *
 * Abast d'aquesta implementació: només QUI es pot moure i QUAN — es
 * bloqueja arrossegar (o qualsevol canvi de posició/elevació d') un
 * token que sigui combatent d'un combat en marxa, tret que sigui
 * precisament el combatent que el rellotge té actiu ara mateix
 * (`combat.combatant`). El DJ n'és sempre exempt (necessita control
 * total per corregir, moure PNJ, etc. — mateix criteri que la resta
 * del sistema li dona per defecte).
 *
 * **No s'intenta** limitar la DISTÀNCIA exacta que es pot recórrer
 * (moviment bàsic vs. ràpid vs. especial): el manual no dona cap
 * fórmula numèrica de velocitat (només qualitativa, "com més àgil,
 * més ràpid"), i el propi disseny del diàleg de Declarar acció —una
 * sola opció triada per activació— ja impedeix per si sol combinar un
 * Atac declarat amb un Moviment ràpid declarat a part en la mateixa
 * activació. Quina distància concreta és "bàsica" o "ràpida" queda a
 * criteri de la taula, com sempre que el manual no dona un número.
 */

/**
 * @param {TokenDocument} tokenDocument
 * @returns {boolean} Si aquest token es pot moure ara mateix.
 */
export function potMoureToken(tokenDocument) {
  const combat = game.combat;
  if (!combat?.started) return true;

  const combatant = combat.combatants.find(c => c.tokenId === tokenDocument.id);
  if (!combatant) return true; // no és combatent d'aquest combat — no l'afecta el rellotge

  return combat.combatant?.id === combatant.id;
}
