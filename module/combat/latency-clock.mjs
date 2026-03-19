/**
 * FORJA Latency Clock combat engine.
 * Ported from FORJAPP src/utils/combatEngine.ts
 *
 * The latency clock is a continuous timeline where entities declare actions
 * and resolve them based on their position (baseLatency + actionLatencyModifier).
 */

/**
 * Generate the declaration order: highest latency declares first.
 * Tiebreak: antagonists before players, lower AGI before higher, then random.
 * @param {ForjaCombatant[]} combatants - All combatants in the encounter
 * @returns {string[]} Ordered array of combatant IDs
 */
export function getDeclarationOrder(combatants) {
  const needDeclaration = combatants.filter(c => !c.declaredAction);

  const sorted = [...needDeclaration].sort((a, b) => {
    const latA = a.actor?.system?.latency ?? 10;
    const latB = b.actor?.system?.latency ?? 10;

    // Latency descending (highest first = slowest declares first)
    if (latA !== latB) return latB - latA;

    // Tiebreak 1: accumulated clock position descending
    // (who is further ahead on the timeline declares first among equals)
    const posA = a.getFlag("forja", "position") ?? 0;
    const posB = b.getFlag("forja", "position") ?? 0;
    if (posA !== posB) return posB - posA;

    // Tiebreak 2: antagonists declare first
    if (a.side !== b.side) {
      return a.side === "antagonists" ? -1 : 1;
    }

    // Tiebreak 3: lower AGI declares first (less agile declare earlier)
    const agiA = a.actor?.system?.attributes?.AGI?.value ?? 0;
    const agiB = b.actor?.system?.attributes?.AGI?.value ?? 0;
    if (agiA !== agiB) return agiA - agiB;

    // Random tiebreak
    return Math.random() - 0.5;
  });

  return sorted.map(c => c.id);
}

/**
 * Calculate a combatant's position on the clock after declaring an action.
 * Position = base latency + action's latency modifier (minimum 1).
 * @param {number} baseLatency - The combatant's latency stat
 * @param {number} actionLatencyMod - The action's latency modifier
 * @returns {number} Position on the clock
 */
export function calculateActionPosition(baseLatency, actionLatencyMod) {
  return Math.max(1, baseLatency + actionLatencyMod);
}

/**
 * Advance the clock: find minimum position among all declared combatants,
 * subtract it from all positions. Combatants at position 0 resolve.
 * @param {Map<string, number>} positions - Map of combatant ID -> position
 * @returns {{ positions: Map<string, number>, resolving: string[] }}
 */
export function advanceClock(positions) {
  if (positions.size === 0) return { positions, resolving: [] };

  // Find minimum position
  let minPosition = Infinity;
  for (const pos of positions.values()) {
    if (pos > 0 && pos < minPosition) minPosition = pos;
  }

  if (minPosition === Infinity) return { positions, resolving: [] };

  // Normalize positions and find resolving combatants
  const resolving = [];
  const updated = new Map();

  for (const [id, pos] of positions) {
    const newPos = pos - minPosition;
    updated.set(id, newPos);
    if (newPos === 0) resolving.push(id);
  }

  return { positions: updated, resolving };
}

/**
 * Get valid targets for an action.
 * Attacks target the opposite side; defend_ally targets the same side.
 * @param {ForjaCombatant[]} combatants - All combatants
 * @param {string} actorSide - 'players' or 'antagonists'
 * @param {string} actionType - 'attack' or 'defend_ally'
 * @returns {ForjaCombatant[]}
 */
export function getCombatTargets(combatants, actorSide, actionType) {
  if (actionType === "attack") {
    return combatants.filter(c => c.side !== actorSide);
  }
  return combatants.filter(c => c.side === actorSide);
}

/**
 * Calculate damage from an attack resolution (FORJA rules).
 *
 * Flow: Armor → DR → Minimum damage
 *   - If armor alone stops all damage → 0 (no minimum)
 *   - If armor partially stops it and DR reduces remainder to 0 → minimum damage (1 + weaponBonus)
 *   - If both can't stop it → full remaining damage
 *
 * @param {object} params
 * @param {number} params.weaponBaseDamage  - Weapon's base damage (without bonus)
 * @param {number} params.weaponBonus       - Fixed weapon bonus (claws +2, sword +3, etc.)
 * @param {number} params.attackExcess      - Net hits from attack roll (attackFites - defenseFites)
 * @param {number} params.armorProtection   - Defender's total armor protection
 * @param {number} params.damageReduction   - Defender's damage reduction (FOR)
 * @param {boolean} params.isHit            - Whether the attack hit
 * @returns {number} Final damage (0 if miss or fully stopped)
 */
export function calculateDamage({ weaponBaseDamage, weaponBonus = 0, attackExcess, armorProtection, damageReduction, isHit }) {
  if (!isHit) return 0;

  const totalRaw = weaponBaseDamage + weaponBonus + attackExcess;
  const minimumDamage = 1 + weaponBonus;

  // Step 1: Armor
  if (totalRaw <= armorProtection) {
    return 0; // Armor stops everything — no minimum
  }
  const afterArmor = totalRaw - armorProtection;

  // Step 2: Damage Reduction
  const afterDR = afterArmor - damageReduction;
  if (afterDR <= 0) {
    // DR reduces to 0, but armor did NOT stop it alone → apply minimum
    return minimumDamage;
  }

  return afterDR;
}
