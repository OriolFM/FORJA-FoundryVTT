import ForjaRoll from "../dice/forja-roll.mjs";

/**
 * Desfer un efecte actiu (S-21, manual p. 590-601).
 *
 * Qualsevol PJ amb coneixement del do (l'habilitat, no cal ser-ne dotat) pot
 * provar-ho, un cop analitzat l'efecte (el temps d'anàlisi depèn de la
 * complexitat/fites originals — el manual no en dona cap fórmula, és temps
 * de joc narratiu, com el "temps de recerca" de S-29). Cal una tirada
 * d'atribut+habilitat "pertinents" (el manual tampoc en fixa cap — DA-5, es
 * deixa triar) que ha de **superar** (mai només igualar) el nombre de fites
 * amb què es va manifestar l'efecte originalment.
 *
 * **Abast d'aquesta implementació ("nucli")**: la tirada final contra la
 * dificultat (introduïda a mà — no hi ha cap registre persistent de "fites
 * amb què es va manifestar cada efecte actiu" per buscar-la automàticament;
 * el manual mateix preveu que el DJ l'informi si no se sap: "si no se sap,
 * el DJ informarà els jugadors del nombre pertinent"). El temps d'anàlisi
 * previ i les "conseqüències molt desagradables" d'una pífia queden a
 * discreció del DJ — es mostra un avís, no s'aplica cap penalització
 * automàtica (no hi ha cap fórmula al manual per fer-ho).
 */

/**
 * @param {object} p
 * @param {ForjaActor} p.actor
 * @param {number} p.dificultat        Fites que cal superar (introduïdes a mà).
 * @param {string} p.atribut
 * @param {number} p.atributVal
 * @param {string|null} p.habId
 * @param {number} p.habNivell
 * @param {number} [p.modDaus=0]
 * @param {number} [p.modDificultat=0]
 * @param {string} [p.label]           Descripció de l'efecte que es prova de desfer.
 * @returns {Promise<{roll:ForjaRoll, exit:boolean, pifia:boolean}>}
 */
export async function desferEfecte({
  actor, dificultat, atribut, atributVal, habId, habNivell,
  modDaus = 0, modDificultat = 0, label = ""
}) {
  const dificultatTirada = Math.max(1, dificultat + modDificultat);
  const pool = Math.max(1, atributVal + habNivell + modDaus);

  const roll = new ForjaRoll(`${pool}d10`, {}, { forja: { dificultat: dificultatTirada } });
  await roll.evaluate();

  const { fites, pifia } = roll.forjaResults;
  const exit = !pifia && fites > dificultatTirada;

  const habNom = habId ? game.i18n.localize(CONFIG.FORJA.LLISTA_HABILITATS.find(h => h.id === habId)?.nom ?? habId) : null;
  const content = await foundry.applications.handlebars.renderTemplate("systems/forja/templates/combat/missatge-desfer.hbs", {
    nomActor: actor.name,
    label,
    etiquetaTirada: habNom ? `${atribut} + ${habNom}` : atribut,
    dificultat: dificultatTirada,
    ...roll.forjaResults,
    exit
  });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    rolls: [roll],
    sound: CONFIG.sounds.dice
  });

  return { roll, exit, pifia };
}
