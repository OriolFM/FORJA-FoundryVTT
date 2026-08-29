import { manifestarEfecte } from "../combat/manifestar.mjs";

/**
 * Progressió sobrenatural (S-29, manual cap. 5 "Millorar efectes" /
 * "Aconseguir nous efectes", p. 542-563): cicle per pujar un efecte
 * existent o aprendre'n un de nou.
 *
 * Automatitza NOMÉS el càlcul (DA-5/G-3): el cost en PX (diferència entre
 * l'efecte actual i l'objectiu construït amb S-23, o el cost sencer si és
 * nou), la tirada de prova de manifestació (reutilitza S-21 sencer,
 * `manifestarEfecte`, incloent-hi el seu cost d'equilibri) i la
 * penalització de 2 PX per intent fallit (manual p. 550-552). El que NO
 * s'automatitza perquè el manual ho deixa a mans del DJ i és pura
 * narrativa, sense cap taula numèrica a convertir: l'aprovació prèvia del
 * DJ, la justificació dins la història, i el "temps de recerca" en
 * setmanes de joc — el manual hi remet a "la taula adjunta" (p. 554), que
 * no apareix enlloc al text convertit del manual (probablement una taula
 * en imatge, perduda en la conversió). Es mostra com a text informatiu al
 * diàleg, no com a comptador aplicat.
 *
 * "Convertir-se en dotat" (mateixa secció, p. 530-540) NO necessita cap
 * peça nova: mecànicament és pujar l'habilitat del do i comprar el tret
 * Dotat/X, tots dos ja coberts pel flux normal de compra de trets i
 * habilitats amb PX (S-28, `dialeg-millora.mjs` + `progressio/millora.mjs`).
 */

function pxLliures(actor) {
  return (actor.system.px?.total ?? 0) - (actor.system.px?.gastats ?? 0);
}

/**
 * Prova de manifestació d'un efecte objectiu (nou o millorat) que encara
 * no s'ha pagat ni desat. Mateixa mecànica que manifestar-lo de veritat
 * (S-21): tirada do+habilitat contra la seva dificultat, cost d'equilibri
 * sempre cobrat, possible dany si l'equilibri baixa de zona.
 * @returns {Promise<object|null>} `null` si l'actor no és dotat.
 */
export async function provarManifestacio(actor, dificultatBase, label) {
  return manifestarEfecte({ actor, dificultatBase, label });
}

/**
 * Aplica una penalització de 2 PX per un intent de prova fallit (manual
 * p. 550-552: "haurà de pagar 2 PX ... abans de tornar a provar-ho").
 * @returns {Promise<{cost:number}|{error:"px"}>}
 */
export async function aplicarPenalitzacioFallada(actor) {
  const PENALITZACIO = 2;
  if (PENALITZACIO > pxLliures(actor)) return { error: "px" };
  await actor.update({ "system.px.gastats": (actor.system.px.gastats ?? 0) + PENALITZACIO });
  return { cost: PENALITZACIO };
}

/**
 * Paga el cost final i desa l'efecte objectiu (crea l'Item si és nou,
 * l'actualitza si es millorava un d'existent).
 * @param {ForjaActor} actor
 * @param {object} construit      Resultat de `DiategConstructor.obrir()`.
 * @param {Item|null} itemExistent  Efecte que es millora, o `null` si és nou.
 * @returns {Promise<{cost:number}|{error:"px", cost:number}>}
 */
export async function aplicarEfecteProgressio(actor, construit, itemExistent = null) {
  const costActual = itemExistent?.system?.cost ?? 0;
  const cost = Math.max(0, construit.cost - costActual);
  if (cost > pxLliures(actor)) return { error: "px", cost };

  const dades = {
    cost:        construit.cost,
    do:          construit.do,
    tipus:       construit.tipus,
    dificultat:  construit.dificultat,
    modLatencia: construit.modLatencia,
    us:          construit.us,
    mecanica:    construit.mecanica
  };
  if (itemExistent) {
    await itemExistent.update({ name: construit.nom, system: dades });
  } else {
    await actor.createEmbeddedDocuments("Item", [{
      name: construit.nom, type: "efecte", system: { ...dades, descripcio: "" }
    }]);
  }
  await actor.update({ "system.px.gastats": (actor.system.px.gastats ?? 0) + cost });
  return { cost };
}
