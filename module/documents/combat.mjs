/**
 * Custom Combat document for the FORJA system.
 * Uses latency-based initiative: lower latency = acts first.
 * Ported from FORJAPP src/utils/turnQueue.ts and src/utils/combatEngine.ts
 */
export default class ForjaCombat extends Combat {

  /**
   * Sort combatants by latency (ascending), then AGI (descending), then random.
   * @override
   */
  _sortCombatants(a, b) {
    const ia = Number.isNumeric(a.initiative) ? a.initiative : Infinity;
    const ib = Number.isNumeric(b.initiative) ? b.initiative : Infinity;
    if (ia !== ib) return ia - ib;

    // Tiebreak: higher AGI first (lower latency)
    const agiA = a.actor?.system?.attributes?.AGI?.value ?? 0;
    const agiB = b.actor?.system?.attributes?.AGI?.value ?? 0;
    if (agiA !== agiB) return agiB - agiA;

    // Final tiebreak: compare IDs for deterministic order
    return a.id > b.id ? 1 : -1;
  }

  /**
   * Roll initiative for combatants.
   * In FORJA, initiative = latency (deterministic, no dice roll).
   * @override
   */
  async rollInitiative(ids, { formula = null, updateTurn = true, messageOptions = {} } = {}) {
    const updates = [];
    for (const id of ids) {
      const combatant = this.combatants.get(id);
      if (!combatant?.actor) continue;
      const latency = combatant.actor.system.latency ?? 10;
      updates.push({ _id: id, initiative: latency });
    }
    if (updates.length) {
      await this.updateEmbeddedDocuments("Combatant", updates);
    }
    return this;
  }

  /**
   * Roll initiative for all combatants at once.
   * @override
   */
  async rollAll(options = {}) {
    const ids = this.combatants.map(c => c.id);
    return this.rollInitiative(ids, options);
  }

  /**
   * Roll initiative for NPC combatants only.
   * @override
   */
  async rollNPC(options = {}) {
    const ids = this.combatants.filter(c => !c.isOwner || c.actor?.type !== "character").map(c => c.id);
    return this.rollInitiative(ids, options);
  }
}
