import { FORJA } from "../config/constants.mjs";

/**
 * Millora personal amb PX (S-28, manual cap. 5 "Millora personal"): els PX
 * es gasten pujant atributs/habilitats o adquirint/traient trets amb els
 * **mateixos costos que a la creació per punts** (S-05, reutilitza
 * `FORJA.COST_ATRIBUT`/`COST_HABILITAT`/el cost del tret).
 *
 * Automatitza NOMÉS el càlcul i l'aplicació del cost (DA-5/G-3): la decisió
 * de si es concedeix la millora — l'ha fet servir prou dins la partida,
 * hi ha una justificació narrativa acceptada pel DJ, etc. — és sempre
 * humana i no es comprova aquí. L'única cosa que aquestes funcions
 * verifiquen és que els PX disponibles alcancin el cost (no es pot gastar
 * el que no es té) i que el valor no superi el màxim (5 en atributs, 10
 * en habilitats).
 */

function pxLliures(actor) {
  return (actor.system.px?.total ?? 0) - (actor.system.px?.gastats ?? 0);
}

/** Cost en PX de pujar un atribut d'`actual` a `actual+1`, o `null` si ja és al màxim (5). */
export function costSeguentAtribut(actual) {
  const seguent = actual + 1;
  if (seguent > 5) return null;
  return FORJA.COST_ATRIBUT[seguent] - FORJA.COST_ATRIBUT[actual];
}

/** Cost en PX de pujar una habilitat d'`actual` a `actual+1`, o `null` si ja és al màxim (10). */
export function costSeguentHabilitat(actual) {
  const seguent = actual + 1;
  if (seguent > 10) return null;
  return FORJA.COST_HABILITAT[seguent] - FORJA.COST_HABILITAT[actual];
}

/**
 * Aplica la millora d'un atribut i en descompta el cost dels PX.
 * @returns {Promise<{cost:number, valorNou:number}|{error:"max"|"px"}>}
 */
export async function millorarAtribut(actor, attr) {
  const actual = actor.system.atributs[attr] ?? 0;
  const cost = costSeguentAtribut(actual);
  if (cost == null) return { error: "max" };
  if (cost > pxLliures(actor)) return { error: "px" };

  await actor.update({
    [`system.atributs.${attr}`]: actual + 1,
    "system.px.gastats": (actor.system.px.gastats ?? 0) + cost
  });
  return { cost, valorNou: actual + 1 };
}

/**
 * Aplica la millora d'una habilitat i en descompta el cost dels PX.
 * @returns {Promise<{cost:number, valorNou:number}|{error:"max"|"px"}>}
 */
export async function millorarHabilitat(actor, habId) {
  const actual = actor.system.habilitats[habId]?.nivell ?? 0;
  const cost = costSeguentHabilitat(actual);
  if (cost == null) return { error: "max" };
  if (cost > pxLliures(actor)) return { error: "px" };

  await actor.update({
    [`system.habilitats.${habId}.nivell`]: actual + 1,
    "system.px.gastats": (actor.system.px.gastats ?? 0) + cost
  });
  return { cost, valorNou: actual + 1 };
}

/**
 * Afegeix un tret POSITIU (manual: "es poden adquirir trets positius... amb
 * PX") i en descompta el cost. Rebutja trets negatius — el manual no dona
 * recompensa en PX per adquirir defectes.
 * @param {ForjaActor} actor
 * @param {{id:string, nom:string, cost:number, descripcio?:string, efecte?:object}} tretSeleccionat
 * @returns {Promise<{cost:number}|{error:"negatiu"|"px"}>}
 */
export async function afegirTretPositiuAmbPX(actor, tretSeleccionat) {
  if (!(tretSeleccionat.cost > 0)) return { error: "negatiu" };
  if (tretSeleccionat.cost > pxLliures(actor)) return { error: "px" };

  await actor.createEmbeddedDocuments("Item", [{
    name: tretSeleccionat.nom,
    type: "tret",
    system: {
      cost:       tretSeleccionat.cost,
      descripcio: tretSeleccionat.descripcio ?? "",
      efecte:     tretSeleccionat.efecte ?? null
    },
    flags: { forja: { catalegId: tretSeleccionat.id } }
  }]);
  await actor.update({ "system.px.gastats": (actor.system.px.gastats ?? 0) + tretSeleccionat.cost });
  return { cost: tretSeleccionat.cost };
}

/**
 * Elimina un tret NEGATIU existent (manual: "...o treure'n de negatius amb
 * PX") i en descompta el cost (el valor absolut del seu cost negatiu).
 * @param {ForjaActor} actor
 * @param {Item} itemTret
 * @returns {Promise<{cost:number}|{error:"positiu"|"px"}>}
 */
export async function treureTretNegatiuAmbPX(actor, itemTret) {
  const costTret = itemTret?.system?.cost ?? 0;
  if (!(costTret < 0)) return { error: "positiu" };
  const cost = -costTret;
  if (cost > pxLliures(actor)) return { error: "px" };

  await actor.deleteEmbeddedDocuments("Item", [itemTret.id]);
  await actor.update({ "system.px.gastats": (actor.system.px.gastats ?? 0) + cost });
  return { cost };
}
