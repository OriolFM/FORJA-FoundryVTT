import ForjaRoll from "../dice/forja-roll.mjs";
import { ferAtac } from "./atac.mjs";
import { opcionsDefensa, resoldreOpcioDefensa } from "./defensa.mjs";
import { decidirDefensa } from "./decisio-defensa.mjs";
import { defensaCompletaDe, combatantDe, resolucioDefensaCompleta } from "./defensa-completa.mjs";
import { distanciaEntreTokens, bandaDistancia, tokensATocar } from "./abast.mjs";
import { regleArea, dinsAbastArea, danyFuga } from "./modes-tret.mjs";
import { darreraPlantilla, consumirPlantilla } from "./plantilla.mjs";
import { calcularDany, aplicarDanyAPista, proteccioArmadura } from "./dany.mjs";
import { consumirConcentracio } from "./reaccions.mjs";
import { activarArtefacte } from "./artefactes.mjs";
import { artefacteDe } from "./artefactes-vinculats.mjs";
import { actualitzarComGM } from "../xarxa/socket.mjs";

/**
 * Atacs amb una sola tirada contra diversos objectius o cops (Fase 6):
 * atacs d'àrea (escopetes, armes de dispersió, automàtic, foc automàtic),
 * la maniobra Combinació (dos cops, una tirada) i el Contraatac.
 * Cada objectiu (o cop) resol la seva defensa per separat (Oriol FM,
 * 2026-10-06): qui ha gastat la reacció en un cop ja no la té per al següent.
 */

/**
 * Tira els daus d'un atac una sola vegada (gasta la concentració i la
 * càrrega de l'artefacte, si en té), per fer-los servir contra diversos
 * objectius o cops amb `ferAtac({ rollPrevi })`.
 * @returns {Promise<ForjaRoll|null>}
 */
export async function tiradaUnica(actor, arma, pool) {
  const artefacte = artefacteDe(arma);
  if (artefacte) {
    const c = await activarArtefacte(artefacte);
    if (!c.ok) {
      ui.notifications?.warn(game.i18n.format("FORJA.Artefacte.SenseCarrega", { nom: artefacte.name }));
      return null;
    }
  }
  const dau = await consumirConcentracio(actor);
  const roll = new ForjaRoll(`${Math.max(1, pool + dau)}d10`, {}, { forja: { dificultat: 1 } });
  await roll.evaluate();
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: game.i18n.format("FORJA.Combat.TiradaUnica", { arma: arma.name }) });
  return roll;
}

/**
 * Resol la defensa d'un objectiu (defensa completa, o la tria del seu jugador
 * o del DJ) i hi fa l'atac.
 * @param {object} p
 * @param {Combat} p.combat
 * @param {Actor} p.actor           Atacant
 * @param {string} p.nomAtacant
 * @param {Item} p.arma
 * @param {number} p.poolFinal
 * @param {Actor} p.objectiu
 * @param {Token|null} p.tokenObjectiu
 * @param {number} p.defensaBasica  Defensa bàsica per a aquest atac (ja amb la distància).
 * @param {boolean} [p.defensaActiva=true]  Si pot esquivar, parar o blocar.
 * @param {string[]} [p.excloure=[]]        Opcions de defensa que no pot fer servir (p. ex. el contraatac no es para ni es bloca).
 * @param {boolean} [p.exigirSuperarPassiva=false]  Cal SUPERAR la defensa bàsica (automàtic).
 * @param {object} [p.extra={}]     Paràmetres addicionals de `ferAtac` (rollPrevi, maniobra, bonusMode…).
 * @returns {Promise<{resultat:object, eleccio:object}|null>}
 */
export async function atacarAmbDefensa({ combat, actor, nomAtacant, arma, poolFinal, objectiu, tokenObjectiu, defensaBasica,
  defensaActiva = true, excloure = [], exigirSuperarPassiva = false, extra = {} }) {
  const categoriaAtac = arma.system.categoria ?? null;
  let eleccio, resolucio;
  const dc = defensaActiva ? defensaCompletaDe(combat, combatantDe(combat, tokenObjectiu, objectiu)) : null;
  if (dc) {
    ({ eleccio, resolucio } = resolucioDefensaCompleta(dc, { objectiu, defensaBasica, categoriaAtac }));
  } else {
    let opcions = opcionsDefensa(objectiu, defensaBasica, { categoriaAtac });
    if (!defensaActiva) opcions = opcions.filter(o => o.id === "passiva");
    opcions = opcions.filter(o => !excloure.includes(o.id));
    const decisio = opcions.length > 1
      ? await decidirDefensa({ defensor: objectiu, opcions, defensaBasica, categoriaAtac, nomAtacant })
      : { eleccio: opcions[0] };
    if (!decisio?.eleccio) return null;
    eleccio = decisio.eleccio;
    resolucio = await resoldreOpcioDefensa(objectiu, eleccio, { nomAtacant });
    if (!resolucio) return null;
  }
  const passiva = eleccio.id === "passiva";
  const resultat = await ferAtac({
    actor, objectiu, arma, poolFinal,
    dificultat: resolucio.dificultat,
    exigirSuperar: resolucio.exigirSuperar || (passiva && exigirSuperarPassiva),
    reduccioExtra: resolucio.reduccioExtra,
    danyExtra: resolucio.danyExtra ?? 0,
    etiquetaDefensa: eleccio.nomMitja ? `${eleccio.nom} (${eleccio.nomMitja})` : eleccio.nom,
    ...extra
  });
  return { resultat, eleccio };
}

/**
 * Atac d'àrea amb una arma a distància (manual l. 3075–3103; decisions de
 * l'Oriol FM a `modes-tret.mjs`). Els objectius són els tokens dins la
 * plantilla que ha dibuixat l'usuari (que es consumeix), dins l'abast
 * permès; la defensa de cadascun és la fixa de l'arma (o la seva bàsica, a
 * l'automàtic), modificada per la distància. Una sola tirada.
 * @returns {Promise<boolean>}  `false` si no s'ha pogut fer (sense plantilla…).
 */
export async function atacArea({ combat, combatant, actor, arma, poolFinal, mode = "tret", extra = {} }) {
  const regla = regleArea(arma.system.propietats ?? [], mode);
  const plantilla = canvas?.ready ? darreraPlantilla() : null;
  if (!regla || !plantilla) {
    ui.notifications?.warn(game.i18n.localize("FORJA.Combat.AreaSensePlantilla"));
    return false;
  }
  const forma = plantilla.object?.shape;
  const tokenAtacant = combatant.token?.object;
  const tokens = (canvas.tokens?.placeables ?? []).filter(t => t.actor && t !== tokenAtacant
    && forma?.contains(t.center.x - plantilla.x, t.center.y - plantilla.y));
  await consumirPlantilla(plantilla);

  const roll = await tiradaUnica(actor, arma, poolFinal);
  if (!roll) return false;

  for (const token of tokens) {
    const objectiu = token.actor;
    const distancia = tokenAtacant ? distanciaEntreTokens(tokenAtacant, token) : 0;
    const aTocar = tokenAtacant ? tokensATocar(tokenAtacant, token) : false;
    const base = regla.defensa === "basica" ? (objectiu.system.defensa ?? 0) : regla.defensa;
    const banda = bandaDistancia(distancia, arma, base, aTocar, actor);
    if (!dinsAbastArea(regla, banda, distancia)) continue;
    await atacarAmbDefensa({
      combat, actor, nomAtacant: combatant.name, arma, poolFinal, objectiu, tokenObjectiu: token,
      defensaBasica: banda?.dificultat ?? base,
      defensaActiva: regla.potEsquivar,
      excloure: regla.potEsquivar ? ["parar", "blocar"] : [],
      exigirSuperarPassiva: regla.exigirSuperar,
      extra: { ...extra, rollPrevi: roll, etiquetaRang: banda ? game.i18n.localize(`FORJA.Combat.Rang.${banda.banda}`) : null }
    });
  }

  // Armes de dispersió perilloses (l. 3093): una pífia fa una fuga.
  if (roll.forjaResults.pifia && (arma.system.propietats ?? []).includes("perillosa")) {
    await fugaArmaDispersio(actor, tokenAtacant, arma);
  }
  return true;
}

/**
 * Fuga d'una arma de dispersió que pifia: 15 − habilitat de dany (ferides,
 * amb armadura i reducció) a l'usuari i als tokens adjacents.
 */
async function fugaArmaDispersio(actor, tokenAtacant, arma) {
  const habilitat = actor.system.habilitats?.["armes-distancia"]?.nivell ?? 0;
  const dany = danyFuga(habilitat);
  if (!dany) return;
  const afectats = [actor, ...(canvas.tokens?.placeables ?? [])
    .filter(t => t.actor && t !== tokenAtacant && tokenAtacant && tokensATocar(tokenAtacant, t)).map(t => t.actor)];
  const linies = [];
  for (const a of afectats) {
    const r = calcularDany({ danyBaseArma: dany, bonificadorArma: 0, excedentAtac: 0, reduccioDany: a.system.reduccioDany ?? 0, armadura: proteccioArmadura(a.items) });
    if (r.danyFinal > 0) {
      const marcats = aplicarDanyAPista({ ferides: { marcats: a.system.salut.ferides.marcats } }, "ferides", r.danyFinal);
      await actualitzarComGM(a, { "system.salut.ferides.marcats": marcats });
    }
    linies.push(`<li>${Handlebars.escapeExpression(a.name)}: ${r.danyFinal}</li>`);
  }
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="forja-missatge-accio">${game.i18n.format("FORJA.Combat.Fuga", { arma: arma.name, dany })}<ul>${linies.join("")}</ul></div>`
  });
}

/**
 * Combinació (› Arts marcials: «clava 2 cops; impacten en torns
 * consecutius»; Oriol FM: una tirada, la defensa per separat a cada cop).
 * Resol el primer cop ara i desa la tirada perquè el segon es resolgui en el
 * proper torn de l'atacant (`resoldreSegonCopCombinacio`).
 * @returns {Promise<void>}
 */
export async function combinacio({ combat, combatant, actor, arma, poolFinal, tokenObjectiu, objectiu, maniobra, extra = {} }) {
  const roll = await tiradaUnica(actor, arma, poolFinal);
  if (!roll) return;
  await atacarAmbDefensa({
    combat, actor, nomAtacant: combatant.name, arma, poolFinal, objectiu, tokenObjectiu,
    defensaBasica: objectiu.system.defensa ?? 0,
    extra: { ...extra, maniobra, rollPrevi: roll, label: `${maniobra.nom} (1/2)` }
  });
  await combatant.setFlag("forja", "combinacioPendent", {
    combatId: combat.id, roll: roll.toJSON(), armaId: arma.id, tokenId: tokenObjectiu?.id ?? null,
    poolFinal, maniobraId: maniobra.id
  });
}

/**
 * Segon cop d'una Combinació, al proper torn de l'atacant (DJ actiu, hook
 * `updateCombat`). Si l'objectiu ja no hi és, es perd.
 * @param {Combat} combat
 * @param {Combatant} combatant
 */
export async function resoldreSegonCopCombinacio(combat, combatant) {
  const dades = combatant?.getFlag("forja", "combinacioPendent");
  if (!dades || dades.combatId !== combat.id) return;
  await combatant.unsetFlag("forja", "combinacioPendent");
  const actor = combatant.actor;
  const arma = actor?.items.get(dades.armaId);
  const token = dades.tokenId ? canvas.tokens?.get(dades.tokenId) : null;
  if (!actor || !arma || !token?.actor) return;
  const roll = ForjaRoll.fromData(dades.roll);
  roll._computeForjaResults?.();
  const maniobra = (CONFIG.FORJA?.LLISTA_MANIOBRES ?? []).find(m => m.id === dades.maniobraId) ?? null;
  await atacarAmbDefensa({
    combat, actor, nomAtacant: combatant.name, arma, poolFinal: dades.poolFinal, objectiu: token.actor, tokenObjectiu: token,
    defensaBasica: token.actor.system.defensa ?? 0,
    extra: { maniobra, rollPrevi: roll, label: `${maniobra?.nom ?? ""} (2/2)` }
  });
}

/**
 * Contraatac (› Arts marcials: «es posa en guàrdia i espera un atac. Si el
 * pot parar o blocar, contraataca immediatament, fora de seqüència, i
 * l'oponent no pot parar ni blocar el contraatac»). Es crida després d'un
 * atac que el defensor en guàrdia ha parat o blocat i que no ha impactat.
 * @returns {Promise<boolean>}  `true` si ha contraatacat.
 */
export async function contraatacar({ combat, defensor, combatantDefensor, atacant, tokenAtacant }) {
  const dades = combatantDefensor?.getFlag("forja", "contraatac");
  if (!dades || dades.combatId !== combat.id) return false;
  const arma = defensor.items.get(dades.armaId);
  if (!arma) return false;
  await combatantDefensor.unsetFlag("forja", "contraatac");
  const sys = defensor.system;
  const poolFinal = (sys.atributs?.DES ?? 0) + (sys.habilitats?.["arts-marcials"]?.nivell ?? 0);
  const maniobra = (CONFIG.FORJA?.LLISTA_MANIOBRES ?? []).find(m => m.id === "contraatac") ?? null;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: defensor }),
    content: `<div class="forja-missatge-accio">${game.i18n.format("FORJA.Combat.Contraataca", { nom: defensor.name, objectiu: atacant.name })}</div>`
  });
  await atacarAmbDefensa({
    combat, actor: defensor, nomAtacant: defensor.name, arma, poolFinal, objectiu: atacant, tokenObjectiu: tokenAtacant,
    defensaBasica: atacant.system.defensa ?? 0,
    excloure: ["parar", "blocar"],
    extra: { maniobra, label: maniobra?.nom }
  });
  return true;
}
