/**
 * Textos flotants al costat del token (Oriol FM, 2026-10-06): quan un actor
 * guanya o perd un estat, quan rep fatiga, ferides o curació, i quan intenta
 * una acció que un estat li impedeix. Com als videojocs: text i número de
 * colors que puja des del token i s'esvaeix.
 *
 * Fa servir `canvas.interface.createScrollingText` (nucli de Foundry), que
 * només dibuixa al client local; per això els canvis d'estat i de salut
 * s'escolten amb hooks a TOTS els clients (`registrarNotificacions`), i no
 * escriuen res a cap document.
 */

/** Estats que són bons per a qui els té (es mostren en verd). */
const ESTATS_POSITIUS = new Set(["vigilant", "rapid", "recuperacio", "berserc", "concentrat"]);

/** Colors dels textos (hex per a PIXI). */
export const COLORS = {
  estatNegatiu: 0xff7043,
  estatPositiu: 0x66dd88,
  estatPerdut:  0xcfd8dc,
  bloqueig:     0xff3b3b,
  fatiga:       0xffb74d,
  ferides:      0xff4d4d,
  cura:         0x7cfc9a
};

/**
 * Mostra un text flotant sobre els tokens visibles de l'actor (només en
 * aquest client).
 * @param {Actor} actor
 * @param {string} text
 * @param {object} [opcions]
 * @param {number} [opcions.color=0xffffff]
 * @param {number} [opcions.mida=30]  Mida de la lletra.
 * @param {"amunt"|"avall"} [opcions.direccio="amunt"]
 */
export function textFlotant(actor, text, { color = 0xffffff, mida = 30, direccio = "amunt" } = {}) {
  if (!actor || !text || !canvas?.ready || !canvas.interface?.createScrollingText) return;
  const ancoratges = CONST.TEXT_ANCHOR_POINTS;
  for (const token of actor.getActiveTokens?.(true) ?? []) {
    if (!token.visible || token.document?.isSecret) continue;
    canvas.interface.createScrollingText(token.center, text, {
      anchor: ancoratges.TOP,
      direction: direccio === "avall" ? ancoratges.BOTTOM : ancoratges.TOP,
      distance: 2 * token.h,
      fontSize: mida,
      fill: color,
      stroke: 0x000000,
      strokeThickness: 5,
      jitter: 0.25,
      duration: 2500
    });
  }
}

/** Nom traduït d'un estat (amb el valor X dels parametritzats, si en té). */
function nomEstat(estatId, valorX = null) {
  const nom = game.i18n.localize(`FORJA.Estat.${estatId}`);
  return valorX != null ? `${nom.replace(/\/X$/, "")}/${valorX}` : nom;
}

/**
 * Text flotant d'un estat guanyat o perdut.
 * @param {Actor} actor
 * @param {string} estatId
 * @param {boolean} guanyat
 * @param {number|null} [valorX]
 */
export function mostrarCanviEstat(actor, estatId, guanyat, valorX = null) {
  const nom = nomEstat(estatId, valorX);
  if (guanyat) {
    const positiu = ESTATS_POSITIUS.has(estatId);
    textFlotant(actor, `${positiu ? "▲" : "▼"} ${nom}`, { color: positiu ? COLORS.estatPositiu : COLORS.estatNegatiu, mida: 32 });
  } else {
    textFlotant(actor, `✕ ${nom}`, { color: COLORS.estatPerdut, mida: 26, direccio: "avall" });
  }
}

/**
 * Text flotant (i avís) quan un estat impedeix el que l'usuari intenta fer.
 * Només en aquest client: és qui ha intentat l'acció.
 * @param {Actor} actor
 * @param {string} estatId   Estat que ho impedeix.
 * @param {string} [clauAccio]  Clau i18n de l'acció impedida (p. ex. "FORJA.Estats.Accio.Moure").
 */
export function avisarBloqueigEstat(actor, estatId, clauAccio = "FORJA.Estats.Accio.Actuar") {
  textFlotant(actor, `⛔ ${nomEstat(estatId)}`, { color: COLORS.bloqueig, mida: 36 });
  ui.notifications?.warn(game.i18n.format("FORJA.Estats.Bloqueig", {
    nom: actor.name,
    accio: game.i18n.localize(clauAccio),
    estat: nomEstat(estatId)
  }));
}

/**
 * Text flotant d'un canvi de salut: dany (caselles marcades de més) o
 * curació (de menys).
 * @param {Actor} actor
 * @param {"fatiga"|"ferides"} pista
 * @param {number} delta  Caselles marcades de més (positiu = dany).
 */
export function mostrarCanviSalut(actor, pista, delta) {
  if (!delta) return;
  const nomPista = game.i18n.localize(pista === "ferides" ? "FORJA.Salut.Ferides" : "FORJA.Salut.Fatiga").toLowerCase();
  if (delta > 0) {
    textFlotant(actor, `−${delta} ${nomPista}`, { color: pista === "ferides" ? COLORS.ferides : COLORS.fatiga, mida: 34 });
  } else {
    textFlotant(actor, `+${-delta} ${nomPista}`, { color: COLORS.cura, mida: 30 });
  }
}

/**
 * Salut que aquest client ha vist per últim cop a l'actor, per calcular la
 * diferència quan s'actualitza. Es guarda a la mateixa instància (també als
 * actors sintètics dels tokens no enllaçats).
 * @param {Actor} actor
 * @returns {{fatiga:number, ferides:number}}
 */
function salutActual(actor) {
  const s = actor.system?.salut;
  return { fatiga: s?.fatiga?.marcats ?? 0, ferides: s?.ferides?.marcats ?? 0 };
}

/** Primera lectura de la salut d'un actor (abans de cap canvi). */
export function recordarSalut(actor) {
  if (actor && !actor._forjaSalutVista) actor._forjaSalutVista = salutActual(actor);
}

/**
 * Registra els hooks dels textos flotants (a tots els clients). Cridar a
 * l'init. També silencia el text flotant natiu dels efectes, perquè no surti
 * dues vegades (`ActiveEffect#_displayScrollingStatus`).
 */
export function registrarNotificacions() {
  const Base = CONFIG.ActiveEffect.documentClass;
  CONFIG.ActiveEffect.documentClass = class ForjaActiveEffect extends Base {
    /** @override — el text flotant dels estats el mostra FORJA (`registrarNotificacions`). */
    _displayScrollingStatus(enabled) {
      if (this.statuses?.size) return;
      return super._displayScrollingStatus?.(enabled);
    }
  };

  const perEstats = (efecte, guanyat) => {
    const actor = efecte.parent;
    if (!(actor instanceof Actor)) return;
    for (const estatId of efecte.statuses ?? []) {
      mostrarCanviEstat(actor, estatId, guanyat, efecte.getFlag?.("forja", "valorX") ?? null);
    }
  };
  Hooks.on("createActiveEffect", efecte => perEstats(efecte, true));
  Hooks.on("deleteActiveEffect", efecte => perEstats(efecte, false));

  // Les dades de l'actor ja estan actualitzades quan arriba el hook: la
  // diferència es calcula amb l'última salut que aquest client havia vist.
  Hooks.on("updateActor", (actor, changes) => {
    if (!foundry.utils.hasProperty(changes, "system.salut")) return;
    const abans = actor._forjaSalutVista ?? null;
    const ara = salutActual(actor);
    actor._forjaSalutVista = ara;
    if (!abans) return;
    mostrarCanviSalut(actor, "fatiga", ara.fatiga - abans.fatiga);
    mostrarCanviSalut(actor, "ferides", ara.ferides - abans.ferides);
  });
}
