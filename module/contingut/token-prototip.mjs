/**
 * Quan es canvia la imatge (retrat) d'un actor, Foundry no toca el token
 * prototip: en arrossegar l'actor a l'escena sortia el token antic (Oriol FM,
 * 2026-10-10, Katydid). Si el token prototip encara és el genèric de Foundry,
 * un dels tokens del sistema (`systems/forja/assets/tokens/`) o la mateixa
 * imatge que el retrat anterior, se li posa també la imatge nova. Un token
 * personalitzat (diferent del retrat) no es toca.
 *
 * Funció pura (provada a `tests/unitaris/token-prototip.test.mjs`).
 * @param {object} p
 * @param {string|null} p.imgAnterior   Retrat actual de l'actor
 * @param {string|null} p.imgNova       Retrat nou (`changes.img`)
 * @param {string|null} p.srcPrototip   `prototypeToken.texture.src` actual
 * @param {boolean} [p.canviaPrototip=false]  El mateix canvi ja toca la textura del prototip
 * @param {string} [p.perDefecte="icons/svg/mystery-man.svg"]  Token genèric de Foundry
 * @returns {string|null}  Textura nova per al prototip, o null si no s'ha de tocar
 */
export function texturaPrototipNova({ imgAnterior, imgNova, srcPrototip, canviaPrototip = false, perDefecte = "icons/svg/mystery-man.svg" }) {
  if (!imgNova || canviaPrototip || imgNova === srcPrototip) return null;
  const generic = !srcPrototip || srcPrototip === perDefecte;
  const delSistema = String(srcPrototip ?? "").startsWith("systems/forja/assets/tokens/");
  const igualAlRetrat = !!imgAnterior && srcPrototip === imgAnterior;
  return (generic || delSistema || igualAlRetrat) ? imgNova : null;
}

/** Registra el hook (`preUpdateActor`, al client que fa el canvi: modifica el mateix canvi). */
export function registrarTokenPrototip() {
  Hooks.on("preUpdateActor", (actor, changes) => {
    if (!("img" in changes)) return;
    const nova = texturaPrototipNova({
      imgAnterior: actor.img,
      imgNova: changes.img,
      srcPrototip: actor.prototypeToken?.texture?.src,
      canviaPrototip: foundry.utils.hasProperty(changes, "prototypeToken.texture.src"),
      perDefecte: CONST.DEFAULT_TOKEN
    });
    if (nova) foundry.utils.setProperty(changes, "prototypeToken.texture.src", nova);
  });
}
