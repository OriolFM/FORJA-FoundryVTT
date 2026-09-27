import ForjaRoll from "../dice/forja-roll.mjs";
import {
  calcularDany, resoldreDanyArma, aplicarDanyAPista,
  proteccioArmadura, itemEgidaActiva, tickReactivacioEgida, efecteDanyConcentracio
} from "./dany.mjs";
import { consumirConcentracio, trencarConcentracio } from "./reaccions.mjs";
import { actualitzarComGM, alternarEstatComGM } from "../xarxa/socket.mjs";

/**
 * Flux d'atac (S-12): tira, compara amb la defensa de l'objectiu, i si
 * impacta, resol el pipeline de dany (S-14) i el marca a la pista corresponent.
 *
 * La dificultat de la tirada d'atac és la defensa bàsica de l'objectiu
 * (manual p. 703) — o, en cas de defensa activa, les fites obtingudes pel
 * defensor en la seva tirada enfrontada (`dificultat` es passa ja resolta
 * des de fora, perquè l'orquestració de la defensa és responsabilitat del
 * flux de defensa, S-13).
 *
 * @param {object}  p
 * @param {Actor}   p.actor          Atacant
 * @param {Actor}   p.objectiu       Defensor
 * @param {Item}    p.arma           Item `arma` fent servir
 * @param {number}  p.poolFinal      Nombre de daus de la tirada d'atac (ja calculat: atribut+habilitat+mods)
 * @param {number}  p.dificultat     Dificultat per impactar (defensa bàsica, o resultat de la defensa activa)
 * @param {boolean} [p.exigirSuperar=false]  Si és una tirada enfrontada (defensa activa): cal SUPERAR
 *   la dificultat per impactar, no només igualar-la — empat → guanya el defensor (manual p. 777, A1).
 * @param {number}  [p.reduccioExtra=0]      Reducció de dany addicional per blocatge (S-13)
 * @param {"fatiga"|"ferides"} [p.pista="ferides"]  Pista de salut a la qual s'encamina el dany
 * @param {string}  [p.label]        Etiqueta per al xat
 * @param {object}  [p.maniobra]     Maniobra d'arts marcials triada (de FORJA.LLISTA_MANIOBRES, manual p. 640):
 *   afegeix la seva dificultat a la tirada d'atac i s'anota a l'estat/xat resultant.
 * @param {string}  [p.etiquetaDefensa]  Nom de l'opció de defensa resolta (S-13), només per al xat.
 * @param {string}  [p.etiquetaRang]      Nom de la banda de rang resolta (S-12), només per al xat.
 * @returns {Promise<object|null>}  `null` si l'atacant està fora de combat (nivell 7 de salut)
 *
 * Regles aplicades (manual FC001CA):
 *  - SISTEMES › Salut › Fatiga i ferides: la penalització de salut de
 *    l'ATACANT s'afegeix a la dificultat (B1); al nivell 7 no pot actuar.
 *  - › Gestió del temps de joc › Concentració: si l'atacant s'havia
 *    concentrat, +1 dau i es consumeix (B5); si l'OBJECTIU concentrat rep
 *    dany, perd la concentració, i si en rep més que la seva FOR queda
 *    atordit (› Estats › Concentrat).
 *  - › Combat › Cos a cos (taula Arts Marcials): la maniobra suma +1 a la
 *    dificultat i, si l'atac impacta, aplica el seu estat (B6); "Cop
 *    penetrant" ignora les armadures naturals i flexibles.
 *  - › Dany › Protecció + decisió Q3: protegeix la millor armadura equipada (B3).
 *  - › Dany › Protecció + decisió Q2: l'ègida trencada es reactiva al tick
 *    del rellotge `marcador + torns` (B4, vegeu `ForjaCombat#reactivarEgides`).
 */
export async function ferAtac({ actor, objectiu, arma, poolFinal, dificultat, exigirSuperar = false, reduccioExtra = 0, pista = "ferides", label, maniobra = null, etiquetaDefensa = null, etiquetaRang = null }) {
  if (actor.system.salut?.foraDeCombat) {
    ui.notifications?.warn(game.i18n.format("FORJA.Combat.ForaDeCombat", { nom: actor.name }));
    return null;
  }

  const penalSalut      = actor.system.salut?.penalitzacio ?? 0;
  const dauConcentracio = await consumirConcentracio(actor);
  const dificultatFinal = dificultat + (maniobra?.dificultat ?? 0) + penalSalut;
  const pool            = Math.max(1, poolFinal + dauConcentracio);

  const roll = new ForjaRoll(`${pool}d10`, {}, {
    forja: { dificultat: dificultatFinal }
  });
  await roll.evaluate();

  const { fites, pifia } = roll.forjaResults;
  const exit     = !pifia && (exigirSuperar ? fites > dificultatFinal : fites >= dificultatFinal);
  const excedent = exit ? Math.max(0, fites - dificultatFinal) : 0;

  let resultatDany = null;
  const notes = [];
  if (exit) {
    const { valor: danyBaseArma, bonificador: bonificadorArma } = resoldreDanyArma(arma.system.danyBase, actor);

    // "Cop penetrant" (arts marcials) ignora les armadures naturals i flexibles.
    const ignorarTipus = maniobra?.id === "cop-penetrant" ? ["natural", "flexible"] : [];
    const armadura  = proteccioArmadura(objectiu.items, { ignorarTipus });
    const itemEgida = itemEgidaActiva(objectiu.items);
    const egida     = itemEgida ? { activa: true, absorcio: itemEgida.system.egida.absorcio } : null;

    // Estat previ a aplicar el dany (la còpia local es refresca després de l'update).
    const estavaConcentrat = !!objectiu.system.concentrat;

    resultatDany = calcularDany({
      danyBaseArma,
      bonificadorArma,
      excedentAtac: excedent,
      reduccioDany: (objectiu.system.reduccioDany ?? 0) + reduccioExtra,
      armadura,
      egida
    });

    if (resultatDany.danyFinal > 0) {
      const marcatsActuals = objectiu.system.salut[pista].marcats;
      const nous = aplicarDanyAPista({ [pista]: { marcats: marcatsActuals } }, pista, resultatDany.danyFinal);
      await actualitzarComGM(objectiu, { [`system.salut.${pista}.marcats`]: nous });
    }

    if (resultatDany.egidaTrencada && itemEgida) {
      const combat = _combatDe(objectiu);
      const reactivaAlTick = combat
        ? tickReactivacioEgida(combat.marcador ?? 0, resultatDany.tornsInactivaEgida)
        : null;
      await actualitzarComGM(itemEgida, {
        "system.egida.activa":        false,
        "system.egida.tornsInactiva": resultatDany.tornsInactivaEgida,
        "flags.forja.egidaReactivaAlTick": reactivaAlTick
      });
      resultatDany.egidaReactivaAlTick = reactivaAlTick;
      notes.push(reactivaAlTick !== null
        ? game.i18n.format("FORJA.Combat.EgidaReactivaAlTick", { tick: reactivaAlTick })
        : game.i18n.localize("FORJA.Combat.EgidaReactivacioManual"));
    }

    // Concentració de l'objectiu (B5).
    const conc = efecteDanyConcentracio(estavaConcentrat, resultatDany.danyFinal, objectiu.system.atributs?.FOR);
    if (conc.trenca) {
      await trencarConcentracio(objectiu);
      notes.push(game.i18n.format("FORJA.Combat.ConcentracioTrencada", { nom: objectiu.name }));
    }
    if (conc.atordit && _estatExisteix("atordit")) {
      await alternarEstatComGM(objectiu, "atordit", true);
      notes.push(game.i18n.format("FORJA.Combat.ConcentracioAtordit", { nom: objectiu.name }));
    }

    // Estat de la maniobra d'arts marcials (B6).
    if (maniobra?.estat && _estatExisteix(maniobra.estat)) {
      await alternarEstatComGM(objectiu, maniobra.estat, true);
      notes.push(game.i18n.format("FORJA.Combat.EstatAplicat", {
        nom: objectiu.name,
        estat: game.i18n.localize(`FORJA.Estat.${maniobra.estat}`)
      }));
    }
  }

  const content = await foundry.applications.handlebars.renderTemplate("systems/forja/templates/combat/missatge-atac.hbs", {
    label,
    nomAtacant:  actor.name,
    nomObjectiu: objectiu.name,
    nomArma:     arma.name,
    dificultat: dificultatFinal,
    etiquetaDefensa,
    etiquetaRang,
    maniobra,
    penalSalut,
    concentrat: dauConcentracio > 0,
    notes,
    dany: resultatDany,
    pista,
    ...roll.forjaResults,
    exit, excedent
  });

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    rolls:   [roll],
    sound:   CONFIG.sounds.dice
  });

  return { roll, dany: resultatDany, exit, excedent, maniobra };
}

/**
 * Combat començat on l'actor és combatent (per llegir-ne el marcador de
 * temps). Si no n'és combatent, `null`: l'ègida no es pot reactivar
 * automàticament (vegeu `ForjaCombat#reactivarEgides`), i es fa a mà — activar
 * una ègida és una acció lliure (manual FC001CA › Armadures i ègides › Ègides).
 * @param {Actor} actor
 * @returns {Combat|null}
 */
function _combatDe(actor) {
  const iniciats = game.combats?.filter(c => c.started) ?? [];
  return iniciats.find(c => c.combatants.some(cb => cb.actor?.uuid === actor.uuid)) ?? null;
}

/** @param {string} id  @returns {boolean} si l'estat existeix a CONFIG.statusEffects */
function _estatExisteix(id) {
  return !!CONFIG.statusEffects?.some(e => e.id === id);
}
