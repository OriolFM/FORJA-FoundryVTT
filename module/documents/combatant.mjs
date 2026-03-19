/**
 * Custom Combatant document for the FORJA system.
 * Stores combat state: declared action, position, reactions.
 *
 * Flags stored on the Combatant:
 *   forja.position: number (action latency = position on the timeline)
 *   forja.declaredAction: { type, weaponId, targetId, defenseType, moveType, description, latencyModifier, icon, totalLatency }
 *   forja.side: "players" | "antagonists"
 *   forja.reactionsUsed: number
 */

const LOG = (...args) => console.log("FORJA Combatant |", ...args);

/** Latency modifiers per action type. */
const ACTION_LATENCY_MODS = {
  simple: 0,
  defensive: 0,
  movement: 0,
  special_movement: 2,
  concentrate: 0,
  other: 0
};

export default class ForjaCombatant extends Combatant {

  /* ---------------------------------------- */
  /*  Getters                                 */
  /* ---------------------------------------- */

  /** Current position on the timeline (= declared action latency). */
  get position() {
    return this.getFlag("forja", "position") ?? this.initiative ?? 0;
  }

  /** Declared action object, or null. */
  get declaredAction() {
    return this.getFlag("forja", "declaredAction") ?? null;
  }

  /** Combat side: "players" or "antagonists". */
  get side() {
    return this.getFlag("forja", "side") ?? "players";
  }

  /** Number of reactions used this turn. */
  get reactionsUsed() {
    return this.getFlag("forja", "reactionsUsed") ?? 0;
  }

  /** Maximum reactions available (from actor's reaction stat). */
  get maxReactions() {
    return this.actor?.system?.reaction ?? 1;
  }

  /** Whether this combatant can still react. */
  get canReact() {
    if (this.isConcentrating) return false;
    return this.reactionsUsed < this.maxReactions;
  }

  /** Whether this combatant is concentrating (cannot react). */
  get isConcentrating() {
    return this.declaredAction?.type === "concentrate";
  }

  /** Whether this combatant is currently in active resolution (guard against double-acting). */
  get isResolving() {
    return this.getFlag("forja", "resolving") ?? false;
  }

  /* ---------------------------------------- */
  /*  Actions                                 */
  /* ---------------------------------------- */

  /**
   * Declare an action for this combatant.
   * Calculates position (latency base + modifiers) and updates initiative
   * so the combatant list reorders by position.
   *
   * For re-declarations after acting, the new position is ADDED to the
   * existing position (the combatant is further along the timeline).
   */
  async declareAction(action) {
    const baseLatency = this.actor?.system?.latency ?? 10;
    const latencyMod = action.latencyModifier ?? 0;
    const actionLatency = Math.max(1, baseLatency + latencyMod);

    // If re-declaring after resolution: add to current position (position accumulates)
    // First declaration (currentPos=0):
    //   - If joining mid-combat: start from current clock position (late entry)
    //   - If first round: use base latency from position 0
    const currentPos = this.getFlag("forja", "position") ?? 0;
    let newPosition;
    if (currentPos > 0) {
      // Continuing combatant: accumulate
      newPosition = currentPos + actionLatency;
    } else {
      const clockPos = this.parent?.getFlag("forja", "currentClockPosition") ?? 0;
      if (clockPos > 0) {
        // Late entry: start counting from the current clock position
        newPosition = clockPos + actionLatency;
        LOG(`${this.name} late entry at clock=${clockPos}`);
      } else {
        // First round (clock hasn't advanced): use base latency
        newPosition = actionLatency;
      }
    }
    LOG(`${this.name} declareAction: base=${baseLatency}, mod=${latencyMod}, actionLatency=${actionLatency}, currentPos=${currentPos}, newPos=${newPosition}`);

    // Single batched update → one re-render instead of three
    await this.update({
      initiative: newPosition,
      "flags.forja.position": newPosition,
      "flags.forja.declaredAction": {
        type: action.type,
        weaponId: action.weaponId ?? null,
        targetId: action.targetId ?? null,
        defenseType: action.defenseType ?? null,
        moveType: action.moveType ?? "none",
        hexCount: action.hexCount ?? 0,
        description: action.description ?? "",
        icon: action.icon ?? "fa-question",
        latencyModifier: latencyMod,
        totalLatency: actionLatency,
        rolled: false
      }
    });
  }

  /**
   * Use one reaction (for active defense out of sequence).
   * @returns {boolean} Whether the reaction was successfully used
   */
  async useReaction() {
    if (!this.canReact) return false;
    await this.setFlag("forja", "reactionsUsed", this.reactionsUsed + 1);
    return true;
  }

  /**
   * Reset combat state for a new declaration cycle.
   */
  async resetRound() {
    await this.setFlag("forja", "declaredAction", null);
    await this.setFlag("forja", "reactionsUsed", 0);
    await this.setFlag("forja", "position", 0);
  }

  /**
   * Get the action latency modifier for an action type.
   * @param {string} actionType
   * @returns {number}
   */
  static getActionLatencyMod(actionType) {
    return ACTION_LATENCY_MODS[actionType] ?? 0;
  }
}
