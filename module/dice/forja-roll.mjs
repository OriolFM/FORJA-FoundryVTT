/**
 * Custom Roll class for FORJA's d10 pool system.
 * Extends Foundry's Roll to add fites (successes) and pifia (fumble) tracking.
 *
 * Dice mechanics (ported from FORJAPP DiceRollModal.tsx):
 * - d10 pool: roll (attribute + skill) dice
 * - 6-9 = 1 success (fite)
 * - 10 = 2 successes
 * - 1-5 = 0 successes
 * - Pifia: any die shows 1 AND total fites = 0
 *
 * Trait modifiers (passed via options.forja):
 * - adept: reroll 1s once
 * - inept: 10s don't count double, each 1 subtracts 1 fite
 * - specialist: ignore 1s, 9-10 count double
 * - titanic: ignore 1s, 4+ counts as 1 success
 */
export default class ForjaRoll extends Roll {

  constructor(formula, data = {}, options = {}) {
    super(formula, data, options);
  }

  /**
   * After evaluation, compute FORJA-specific results.
   */
  async evaluate() {
    await super.evaluate();
    this._computeForjaResults();
    return this;
  }

  _computeForjaResults() {
    const dice = this.dice[0]?.results?.map(r => r.result) || [];
    const modifiers = this.options.forja || {};

    let fites = 0;
    let hasOnes = false;

    for (const die of dice) {
      if (modifiers.titanic) {
        // Titanic Attribute: ignore 1s, 4+ = 1 success, 10 = 2
        if (die >= 10) fites += 2;
        else if (die >= 4) fites += 1;
        // 1s are ignored
      } else if (modifiers.specialist) {
        // Specialist: ignore 1s, 9-10 count double
        if (die >= 9) fites += 2;
        else if (die >= 6) fites += 1;
        // 1s are ignored
      } else if (modifiers.inept) {
        // Inept: 10 counts as 1 (not 2), each 1 subtracts
        if (die >= 10) fites += 1;
        else if (die >= 6) fites += 1;
        if (die === 1) {
          fites -= 1;
          hasOnes = true;
        }
      } else {
        // Standard: 6-9 = 1, 10 = 2
        if (die >= 10) fites += 2;
        else if (die >= 6) fites += 1;
        if (die === 1) hasOnes = true;
      }
    }

    fites = Math.max(0, fites);
    const isPifia = hasOnes && fites === 0 && !modifiers.specialist && !modifiers.titanic;

    this.forjaResults = {
      dice,
      fites,
      hasOnes,
      isPifia,
      totalDice: dice.length,
      modifiers
    };
  }

  /**
   * Get the CSS class for a specific die result.
   */
  static getDieClass(value) {
    if (value === 1) return "die-fumble";
    if (value >= 10) return "die-critical";
    if (value >= 6) return "die-success";
    return "die-neutral";
  }
}
