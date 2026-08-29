import ForjaRoll from "../dice/forja-roll.mjs";

/**
 * Investigació i desenvolupament d'artefactes (S-30, manual p. 564-604).
 *
 * **Disseny**: reutilitza el motor de paràmetres sencer (S-23,
 * `progressio/construccio.mjs`, mode `artefacte`) — es crea des de
 * `DiategConstructor.obrir({ esArtefacte: true })`. No hi ha cap cost en PX
 * pel disseny en si (a diferència de S-29): el manual només parla de
 * "recursos i materials" narratius per a la fabricació, mai de PX.
 *
 * **Fabricació**: aquest mòdul en cobreix el "nucli" — la fiabilitat del
 * prototip (p. 598-602). Un artefacte nascut del constructor neix amb
 * `system.fase = "prototip1"`: "poc fiable durant tant de temps com es va
 * invertir en dissenyar-lo" — igual que el "temps de recerca" de S-29, el
 * manual no dona cap taula numèrica de setmanes per convertir, així que
 * aquest mòdul NO fa avançar `fase` sol; és sempre el DJ qui, a
 * `marcarProduccio`, decideix que el període de proves s'ha acabat.
 *
 * Mentre `fase !== "produccio"`, cada ús requereix una tirada de "les
 * habilitats pertinents" (el manual no en fixa cap — DA-5: es deixa triar
 * l'atribut/habilitat a `DiategProvarPrototip`) amb la dificultat = cost de
 * l'artefacte. Una pífia el marca `trencat`:
 *   - **`prototip1`**: pífia = destruït/inutilitzable (manual: "inutilitzarà
 *     o destruirà l'artefacte, i s'haurà de fer un segon prototipus"). Es
 *     modela igual que `prototip2` (només el flag `trencat`) perquè
 *     mecànicament Foundry no necessita esborrar l'Item — la diferència
 *     narrativa (cal material nou i refer-lo, vs. només "ajustos") la
 *     gestiona el DJ manualment amb `marcarProduccio`/`repararPrototip`.
 *   - **`prototip2`**: fiabilitat normal, però "cada pífia d'activació
 *     necessitarà ajustos abans que pugui tornar a funcionar" — mateix flag.
 *
 * `produccio` (per defecte a tots els artefactes ja existents, catàleg
 * inclòs) es comporta exactament com abans de S-30: sense tirada de prova,
 * sense `trencat`.
 */

/** @returns {boolean} Si l'artefacte encara és un prototip (fràgil). */
export function esPrototip(item) {
  return item.system.fase !== "produccio";
}

/**
 * Tirada de prova d'ús d'un prototip: dificultat = cost de l'artefacte,
 * atribut/habilitat triats per qui l'usa (manual: "les habilitats
 * pertinents", sense fixar quines). Una pífia marca l'artefacte `trencat`.
 * @param {ForjaActor} actor
 * @param {Item} item
 * @param {{atribut:string, atributVal:number, habId:string|null, habNivell:number, modDaus:number, modDificultat:number}} config
 * @returns {Promise<{roll:ForjaRoll, pifia:boolean, exit:boolean}>}
 */
export async function provarPrototip(actor, item, config) {
  const { atribut, atributVal, habId, habNivell, modDaus = 0, modDificultat = 0 } = config;
  const dificultat = Math.max(1, (item.system.cost ?? 0) + modDificultat);
  const pool = Math.max(1, atributVal + habNivell + modDaus);

  const roll = new ForjaRoll(`${pool}d10`, {}, { forja: { dificultat } });
  await roll.evaluate();
  const { pifia, exit } = roll.forjaResults;

  if (pifia) await item.update({ "system.trencat": true });

  const habNom = habId ? game.i18n.localize(CONFIG.FORJA.LLISTA_HABILITATS.find(h => h.id === habId)?.nom ?? habId) : null;
  const content = await foundry.applications.handlebars.renderTemplate("systems/forja/templates/combat/missatge-prototip.hbs", {
    nomActor: actor.name,
    nomArtefacte: item.name,
    fase: item.system.fase,
    label: habNom ? `${atribut} + ${habNom}` : atribut,
    ...roll.forjaResults
  });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    rolls: [roll],
    sound: CONFIG.sounds.dice
  });

  return { roll, pifia, exit };
}

/**
 * El DJ marca l'artefacte com a reparat/ajustat (neteja `trencat` sense
 * canviar de fase) — manual p. 600: un `prototip2` trencat "es pot reparar
 * com si fos un disseny de producció".
 * @param {Item} item
 */
export async function repararPrototip(item) {
  await item.update({ "system.trencat": false });
}

/**
 * El DJ dona per superat el període de proves: l'artefacte passa a
 * `produccio` (fiabilitat normal, sense tirades de prova) — manual p. 602:
 * "un cop acabat el temps de prova... l'aparell funcionarà normalment".
 * Decisió humana sempre (DA-5): no hi ha cap comptador que ho faci sol.
 * @param {Item} item
 */
export async function marcarProduccio(item) {
  await item.update({ "system.fase": "produccio", "system.trencat": false });
}
