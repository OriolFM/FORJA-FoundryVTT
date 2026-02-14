/**
 * Custom Combat Tracker UI for the FORJA latency clock system.
 * Extends Foundry's default CombatTracker to show latency-based ordering
 * and support declaration/resolution phases.
 */
import { getDeclarationOrder, advanceClock } from "./latency-clock.mjs";

export default class ForjaCombatTracker extends foundry.applications.sidebar.tabs.CombatTracker {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: "systems/forja/templates/combat/combat-tracker.hbs"
    });
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html.find("[data-action='toggleDefeated']").on("click", this._onToggleDefeated.bind(this));
  }

  /**
   * Toggle the defeated status of a combatant.
   */
  async _onToggleDefeated(event) {
    event.preventDefault();
    event.stopPropagation();
    const li = event.currentTarget.closest("[data-combatant-id]");
    const combatantId = li?.dataset.combatantId;
    if (!combatantId) return;
    const combatant = this.viewed?.combatants.get(combatantId);
    if (!combatant) return;
    await combatant.update({ defeated: !combatant.defeated });
  }

  /** @override */
  async getData(options = {}) {
    const context = await super.getData(options);

    // Add FORJA-specific data
    if (context.combat) {
      const combatants = context.combat.combatants.contents;

      // Add latency and wound info to each turn
      for (const turn of context.turns) {
        const combatant = context.combat.combatants.get(turn.id);
        if (combatant?.actor) {
          const sys = combatant.actor.system;
          turn.latency = sys.latency ?? 10;
          turn.defense = sys.defense ?? 0;
          turn.woundLevel = sys.woundLevel ?? "illes";
          turn.fatigueLevel = sys.fatigueLevel ?? "reposat";
          turn.woundsPercent = sys.health?.wounds?.max
            ? Math.round((sys.health.wounds.value / sys.health.wounds.max) * 100)
            : 0;
          turn.fatiguePercent = sys.health?.fatigue?.max
            ? Math.round((sys.health.fatigue.value / sys.health.fatigue.max) * 100)
            : 0;
          turn.declaredAction = combatant.declaredAction;
          turn.side = combatant.side;
        }
      }

      // Sort turns by initiative (latency ascending)
      context.turns.sort((a, b) => (a.initiative ?? 99) - (b.initiative ?? 99));

      // Declaration order for GM reference
      context.declarationOrder = getDeclarationOrder(combatants);
    }

    return context;
  }
}
