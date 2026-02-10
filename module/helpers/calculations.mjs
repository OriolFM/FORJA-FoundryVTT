/**
 * FORJA RPG calculation utilities.
 * Ported from FORJAPP src/utils/calculations.ts
 */

/**
 * Parse a damage formula like "FOR+2" and calculate the value.
 * @param {string} formula - e.g. "FOR+2", "DES+3", "5"
 * @param {object} attributes - Actor attributes { FOR: {value}, DES: {value}, ... }
 * @returns {{ formula: string, value: number }}
 */
export function parseDamageFormula(formula, attributes) {
  const match = formula.match(/^(FOR|DES|AGI|PER|INT|APL)([+-])(\d+)$/);

  if (match) {
    const attrKey = match[1];
    const operator = match[2];
    const modifier = parseInt(match[3]);
    const attrValue = attributes[attrKey]?.value ?? 1;

    const value = operator === "+"
      ? attrValue + modifier
      : attrValue - modifier;

    return { formula, value: Math.max(0, value) };
  }

  const numValue = parseInt(formula);
  if (!isNaN(numValue)) {
    return { formula, value: numValue };
  }

  return { formula, value: 0 };
}

/**
 * Calculate the attack dice pool for a weapon.
 * @param {object} actor - The ForjaActor
 * @param {string} attackType - 'melee' | 'ranged' | 'natural' | 'brawl' | 'martial'
 * @param {boolean} isThrown - If ranged weapon is thrown
 * @returns {{ dice: number, formula: string, attributeValue: number, skillValue: number }}
 */
export function calculateAttackDice(actor, attackType, isThrown = false) {
  const formulas = CONFIG.FORJA.attackFormulas;
  const key = (attackType === "ranged" && isThrown) ? "rangedThrown" : attackType;
  const formulaDef = formulas[key] || formulas.melee;

  const attrValue = actor.system.attributes[formulaDef.attribute]?.value ?? 1;

  let skillValue = 0;
  for (const item of actor.items) {
    if (item.type === "skill" && item.system.skillId === formulaDef.skill) {
      skillValue = item.system.level ?? 0;
      break;
    }
  }

  const dice = attrValue + skillValue;
  const attrLabel = game.i18n.localize(`FORJA.Attributes.${formulaDef.attribute}`);
  const formula = `${attrLabel} ${attrValue} + ${skillValue}`;

  return { dice, formula, attributeValue: attrValue, skillValue };
}

/**
 * Count successes (fites) from a set of d10 results.
 * 6-9 = 1 fite, 10 = 2 fites, 1-5 = 0 fites.
 * @param {number[]} dice - Array of d10 results
 * @returns {{ fites: number, hasOnes: boolean, isPifia: boolean }}
 */
export function calculateFites(dice) {
  let fites = 0;
  let hasOnes = false;

  for (const die of dice) {
    if (die >= 10) fites += 2;
    else if (die >= 6) fites += 1;
    if (die === 1) hasOnes = true;
  }

  const isPifia = hasOnes && fites === 0;
  return { fites, hasOnes, isPifia };
}

/**
 * Get the CSS class for a die result value.
 * @param {number} value - The d10 result (1-10)
 * @returns {string} CSS class name
 */
export function getDieClass(value) {
  if (value === 1) return "die-fumble";
  if (value >= 10) return "die-critical";
  if (value >= 6) return "die-success";
  return "die-neutral";
}
