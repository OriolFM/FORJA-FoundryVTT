/**
 * Custom Combatant document for the FORJA system.
 * Stores additional combat state: declared action, position, reactions.
 */
export default class ForjaCombatant extends Combatant {

  /**
   * Get the combatant's current latency position on the clock.
   */
  get position() {
    return this.getFlag("forja", "position") ?? this.initiative ?? 10;
  }

  /**
   * Get the combatant's declared action for the current round.
   */
  get declaredAction() {
    return this.getFlag("forja", "declaredAction") ?? null;
  }

  /**
   * Get the combatant's side in combat.
   */
  get side() {
    return this.getFlag("forja", "side") ?? "players";
  }

  /**
   * Get the number of reactions used this round.
   */
  get reactionsUsed() {
    return this.getFlag("forja", "reactionsUsed") ?? 0;
  }

  /**
   * Get the maximum number of reactions available.
   */
  get maxReactions() {
    return this.actor?.system?.reaction ?? 1;
  }

  /**
   * Declare an action for this combatant.
   * @param {object} action - The action to declare
   * @param {string} action.type - 'attack' | 'defend_self' | 'defend_ally' | 'movement' | 'other'
   * @param {number} action.latencyModifier - Additional latency from the action
   * @param {string} [action.targetId] - Target combatant ID
   * @param {string} [action.description] - Action description
   */
  async declareAction(action) {
    const position = (this.actor?.system?.latency ?? 10) + (action.latencyModifier ?? 0);
    await this.setFlag("forja", "declaredAction", action);
    await this.setFlag("forja", "position", position);
  }

  /**
   * Use one reaction (for active defense).
   */
  async useReaction() {
    const used = this.reactionsUsed + 1;
    await this.setFlag("forja", "reactionsUsed", used);
  }

  /**
   * Reset combat state for a new round.
   */
  async resetRound() {
    await this.setFlag("forja", "declaredAction", null);
    await this.setFlag("forja", "reactionsUsed", 0);
  }
}
