import ForjaRoll from "../dice/forja-roll.mjs";
import { calcularDany, resoldreDanyArma, aplicarDanyAPista } from "./dany.mjs";

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
 */
export async function ferAtac({ actor, objectiu, arma, poolFinal, dificultat, exigirSuperar = false, reduccioExtra = 0, pista = "ferides", label, maniobra = null }) {
  const dificultatFinal = dificultat + (maniobra?.dificultat ?? 0);
  const roll = new ForjaRoll(`${Math.max(1, poolFinal)}d10`, {}, {
    forja: { dificultat: dificultatFinal }
  });
  await roll.evaluate();

  const { fites, pifia } = roll.forjaResults;
  const exit     = !pifia && (exigirSuperar ? fites > dificultatFinal : fites >= dificultatFinal);
  const excedent = exit ? Math.max(0, fites - dificultatFinal) : 0;

  let resultatDany = null;
  if (exit) {
    const { valor: danyBaseArma, bonificador: bonificadorArma } = resoldreDanyArma(arma.system.danyBase, actor);

    const armadura = _armaduraEfectiva(objectiu, arma.system.categoria);
    const egida    = _egidaEfectiva(objectiu);

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
      await objectiu.update({ [`system.salut.${pista}.marcats`]: nous });
    }

    if (resultatDany.egidaTrencada) {
      const armaduraObjectiu = objectiu.items.find(i => i.type === "armadura" && i.system.egida?.activa);
      if (armaduraObjectiu) {
        await armaduraObjectiu.update({
          "system.egida.activa": false,
          "system.egida.tornsInactiva": resultatDany.tornsInactivaEgida
        });
      }
    }
  }

  const content = await renderTemplate("systems/forja/templates/combat/missatge-atac.hbs", {
    label,
    nomAtacant:  actor.name,
    nomObjectiu: objectiu.name,
    nomArma:     arma.name,
    dificultat: dificultatFinal,
    maniobra,
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
 * Determina la protecció d'armadura efectiva contra una categoria d'arma
 * (manual: l'armadura redueix el dany segons el seu tipus de protecció).
 * @param {Actor} objectiu
 * @param {string} _categoriaArma
 * @returns {number}
 */
function _armaduraEfectiva(objectiu, _categoriaArma) {
  const armadura = objectiu.items.find(i => i.type === "armadura");
  return armadura?.system?.reduccio ?? 0;
}

/**
 * Retorna l'estat actual de l'ègida de l'objectiu, si en té una activa.
 * @param {Actor} objectiu
 * @returns {{activa:boolean, absorcio:number}|null}
 */
function _egidaEfectiva(objectiu) {
  const armadura = objectiu.items.find(i => i.type === "armadura" && i.system.egida?.activa);
  if (!armadura) return null;
  return { activa: true, absorcio: armadura.system.egida.absorcio };
}
