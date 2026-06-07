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

  /** Classe CSS per a cada dau */
  static getDieClass(value) {
    if (value === 1)   return "dau-pifia";
    if (value >= 10)   return "dau-doble";
    if (value >= 6)    return "dau-fita";
    return "dau-neutre";
  }
}
