import ForjaRoll from "../dice/forja-roll.mjs";
import { aplicarDanyAPista } from "./dany.mjs";

/**
 * Manifestar un efecte sobrenatural (S-21, manual p. 508-608).
 *
 * Abast d'aquesta implementació: **manifestar** i **resistir** (`resistencia.mjs`)
 * — el nucli de com un dotat fa servir el seu do i com un objectiu s'hi pot
 * oposar. **Contrarestar** i **desfer** (manual p. 568-600) queden
 * deliberadament fora d'abast per ara: són fluxos multi-tirada amb estat
 * propi (control en disputa entre dos dotats, concentració especial) que
 * mereixen la seva pròpia peça — es documenten com a pendents.
 *
 * Interpretacions preses on el manual és ambigu (elevades implícitament,
 * documentades aquí en lloc de decidir-les en silenci):
 *   - **Cost d'equilibri en cas de fallada**: el manual diu "quan un PJ
 *     MANIFESTA un efecte... ha de marcar tantes caselles com la dificultat"
 *     (p. 260) — s'interpreta que l'intent en si (no només l'èxit) té cost,
 *     perquè altrament un dotat podria reintentar gratis indefinidament.
 *     El cost es cobra sempre, exit o no.
 *   - **Dificultat quan hi ha resistència**: la dificultat pròpia de
 *     l'efecte i les fites de qui resisteix no se sumen ni són alternatives
 *     soltes — es fa servir la MÉS ALTA de les dues, i cal SUPERAR-la (mai
 *     només igualar, empat guanya qui resisteix) sempre que hi hagi
 *     resistència activa. Sense resistència, la tirada és estàndard (≥).
 */

/** @returns {boolean} Si l'actor és dotat (S-20) i pot manifestar efectes. */
export function potManifestar(actor) {
  return !!actor.system.dotat;
}

/**
 * @param {object} p
 * @param {ForjaActor} p.actor            Qui manifesta l'efecte.
 * @param {number} p.dificultatBase       Dificultat bàsica de l'efecte (manual p. 522).
 * @param {number} [p.modDaus=0]          Modificador de daus manual (ressonància, S-20 A0/A1).
 * @param {number} [p.modDificultat=0]    Modificador de dificultat manual (abast/durada/ressonància).
 * @param {number} [p.puntsExtra=0]       Punts d'equilibri addicionals gastats voluntàriament (manual p. 266-272).
 * @param {"cap"|"reduirDificultat"|"afegirDau"} [p.usPuntsExtra="cap"]
 *   Només afecta la tirada; estendre durada o afegir objectius/àrees (les altres
 *   opcions del manual) són conseqüències narratives que el DJ aplica a mà.
 * @param {{dificultat:number, exigirSuperar:boolean, roll:ForjaRoll}|null} [p.resistencia=null]
 *   Resultat de `resoldreResistir` (resistencia.mjs), si l'objectiu ha resistit activament.
 * @param {string} [p.label]              Etiqueta de l'efecte per al xat.
 * @param {ForjaActor} [p.objectiu]       Objectiu de l'efecte, només per al xat.
 * @returns {Promise<object|null>} `null` si l'actor no és dotat.
 */
export async function manifestarEfecte({
  actor, dificultatBase, modDaus = 0, modDificultat = 0,
  puntsExtra = 0, usPuntsExtra = "cap", resistencia = null,
  label = "", objectiu = null
}) {
  const sys = actor.system;
  const don = sys.dotat;
  if (!don) return null;

  const donCfg = CONFIG.FORJA.DONS[don];
  const atribut = donCfg.atribut ?? sys.qiAtribut;
  const atributVal = sys.atributs[atribut] ?? 0;
  const habNivell = sys.habilitats[donCfg.habilitat]?.nivell ?? 0;

  const reduccioDificultat = usPuntsExtra === "reduirDificultat" ? puntsExtra : 0;
  const bonusDauPunts      = usPuntsExtra === "afegirDau" ? puntsExtra : 0;

  const dificultatPropia = Math.max(1, dificultatBase + modDificultat - reduccioDificultat);
  const exigirSuperar = !!resistencia;
  const dificultatTirada = resistencia ? Math.max(dificultatPropia, resistencia.dificultat) : dificultatPropia;

  const poolFinal = Math.max(0, atributVal + habNivell + modDaus + bonusDauPunts);
  const roll = new ForjaRoll(`${Math.max(1, poolFinal)}d10`, {}, { forja: { dificultat: dificultatTirada } });
  await roll.evaluate();

  const { fites, pifia } = roll.forjaResults;
  const exit     = !pifia && (exigirSuperar ? fites > dificultatTirada : fites >= dificultatTirada);
  const excedent = exit ? Math.max(0, fites - dificultatTirada) : 0;

  // Cost d'equilibri: sempre es cobra (vegeu nota d'interpretació de dalt),
  // basat en la dificultat PRÒPIA de l'efecte (no inflada per la resistència
  // d'un objectiu concret) + els punts extra gastats voluntàriament.
  const cost = dificultatPropia + puntsExtra;
  const eq = sys.equilibri;
  const jaEraNegatiu = (eq.actual ?? 0) < 0;
  const nouGastat = (eq.gastat ?? 0) + cost;
  await actor.update({ "system.equilibri.gastat": nouGastat });
  // Marca que ha manifestat aquest torn perquè `recuperarEquilibri` (crida
  // al final del torn, forja.mjs) no li doni la recuperació automàtica —
  // el manual només la concedeix als torns en què NO es fa cap efecte.
  await actor.setFlag("forja", "manifestatAquestTorn", true);

  const nouActual = eq.max - nouGastat;
  const zona = nouActual > 0 ? "normal" : nouActual > -eq.max ? "fatiga" : "ferides";
  let dany = null;
  if (zona !== "normal") {
    const pista = zona === "fatiga" ? "fatiga" : "ferides";
    const marcatsActuals = actor.system.salut[pista].marcats;
    const nousMarcats = aplicarDanyAPista({ [pista]: { marcats: marcatsActuals } }, pista, 1);
    await actor.update({ [`system.salut.${pista}.marcats`]: nousMarcats });
    dany = { pista, quantitat: 1 };
  }

  const content = await foundry.applications.handlebars.renderTemplate("systems/forja/templates/combat/missatge-manifestar.hbs", {
    label,
    nomActor: actor.name,
    nomObjectiu: objectiu?.name ?? null,
    don: game.i18n.localize(`FORJA.Sobrenatural.Do.${don}`),
    dificultat: dificultatTirada,
    resistit: !!resistencia,
    cost, nouActual, eqMax: eq.max,
    dany, jaEraNegatiu,
    ...roll.forjaResults,
    exit, excedent
  });

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    rolls: [roll],
    sound: CONFIG.sounds.dice
  });

  return { roll, exit, excedent, cost, nouActual, dany, jaEraNegatiu };
}

/**
 * Recupera 1 punt d'equilibri (fins al màxim EQ) per a un dotat que NO ha
 * manifestat cap efecte durant el seu torn (manual p. 260). Cridat des del
 * hook `updateCombat` (forja.mjs), mateix patró que `reiniciarReaccions`.
 * @param {ForjaActor} actor
 */
export async function recuperarEquilibri(actor) {
  if (!actor.system.dotat) return;
  if (actor.getFlag("forja", "manifestatAquestTorn")) {
    await actor.unsetFlag("forja", "manifestatAquestTorn");
    return;
  }
  const eq = actor.system.equilibri;
  if ((eq.gastat ?? 0) <= 0) return;
  await actor.update({ "system.equilibri.gastat": Math.max(0, eq.gastat - 1) });
}
