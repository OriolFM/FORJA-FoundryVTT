/**
 * Classe Roll personalitzada pel sistema de daus d10 de FORJA.
 * S'estén de Roll per afegir comptatge de fites, pífia i resultat.
 *
 * Mecànica estàndard:
 *   d10 ≥ 6   → 1 fita
 *   d10 = 10  → 2 fites (doble fita)
 *   d10 = 1   → marca de pífia
 *   Pífia: cap fita + almenys un 1
 */
export default class ForjaRoll extends Roll {

  static CHAT_TEMPLATE = "systems/forja/templates/dice/missatge-tirada.hbs";

  async evaluate(options = {}) {
    await super.evaluate(options);
    this._computeForjaResults();
    return this;
  }

  _computeForjaResults() {
    const dice   = this.dice[0]?.results?.map(r => r.result) ?? [];
    const opts   = this.options.forja ?? {};
    const dif    = opts.dificultat ?? 1;

    let fites   = 0;
    let hasOnes = false;

    for (const d of dice) {
      if (d === 10)     fites += 2;
      else if (d >= 6)  fites += 1;
      if (d === 1)      hasOnes = true;
    }

    fites = Math.max(0, fites);
    const pifia    = hasOnes && fites === 0;
    const exit     = !pifia && fites >= dif;
    const excedent = exit ? fites - dif : 0;

    this.forjaResults = {
      dice, fites, hasOnes, pifia,
      dificultat: dif,
      exit, excedent,
      totalDice: dice.length
    };
  }
}

/**
 * Publica una tirada de FORJA al xat amb la plantilla pròpia
 * (`missatge-tirada.hbs`). `Roll#toMessage` no serveix: la plantilla
 * necessita les fites, els daus i la dificultat, que Foundry no hi passa.
 * @param {ForjaRoll} roll  Ja avaluada.
 * @param {object} p
 * @param {Actor} [p.actor]
 * @param {string} p.label
 * @param {number} [p.dificultat]  Per defecte, la de la tirada.
 * @param {boolean} [p.exit]       Per defecte, el de la tirada.
 * @param {boolean} [p.ambDificultat=true]  Mostrar la dificultat (no per a tirades enfrontades sense dificultat pròpia).
 * @returns {Promise<ChatMessage>}
 */
export async function publicarTirada(roll, { actor = null, label, dificultat, exit } = {}) {
  const r = roll.forjaResults ?? {};
  const content = await foundry.applications.handlebars.renderTemplate(ForjaRoll.CHAT_TEMPLATE, {
    label, poolFinal: r.totalDice, penalSalut: 0, concentrat: false, modDaus: 0, modDificultat: 0,
    ...r,
    dificultat: dificultat ?? r.dificultat,
    exit: exit ?? r.exit
  });
  return ChatMessage.create({
    speaker: actor ? ChatMessage.getSpeaker({ actor }) : ChatMessage.getSpeaker(),
    content, rolls: [roll], sound: CONFIG.sounds.dice
  });
}
