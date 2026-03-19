/**
 * Custom Combat document for the FORJA system.
 * Implements the FORJA latency-based combat flow:
 *   declaration → ordering → advance → resolution → apply damage → re-declare
 *
 * Flags stored on the Combat document:
 *   forja.phase: "idle" | "declaration" | "resolution" | "ambush_declaration" | "ambush_resolution"
 *   forja.resolvingIds: string[] (combatant IDs currently resolving)
 *   forja.isAmbush: boolean
 *   forja.ambushAdvantageIds: string[] (combatant IDs with ambush advantage)
 *   forja.pendingDamage: Array<{targetId, amount, sourceId, description}>
 */
import { getDeclarationOrder } from "../combat/latency-clock.mjs";
import { clearMovementVectors, drawActiveRings, clearActiveRings } from "../combat/combat-tracker.mjs";

const LOG = (...args) => console.log("FORJA Combat |", ...args);

export default class ForjaCombat extends Combat {

  /* ---------------------------------------- */
  /*  Getters                                 */
  /* ---------------------------------------- */

  /**
   * FORJA uses a latency clock, not a turn-based system.
   * Returning null here suppresses Foundry's native D20 "active turn" indicator
   * on all tokens — FORJA draws its own circles via drawActiveRings / PIXI.
   */
  get combatant() { return null; }

  get phase() {
    return this.getFlag("forja", "phase") ?? "idle";
  }

  get resolvingIds() {
    return this.getFlag("forja", "resolvingIds") ?? [];
  }

  get isAmbush() {
    return this.getFlag("forja", "isAmbush") ?? false;
  }

  get ambushAdvantageIds() {
    return this.getFlag("forja", "ambushAdvantageIds") ?? [];
  }

  get pendingDamage() {
    return this.getFlag("forja", "pendingDamage") ?? [];
  }

  /* ---------------------------------------- */
  /*  Sorting                                 */
  /* ---------------------------------------- */

  /**
   * Sort combatants by initiative (position) ascending, then AGI descending.
   * Lower initiative = acts first.
   * @override
   */
  _sortCombatants(a, b) {
    const ia = Number.isNumeric(a.initiative) ? a.initiative : Infinity;
    const ib = Number.isNumeric(b.initiative) ? b.initiative : Infinity;
    if (ia !== ib) return ia - ib;

    const agiA = a.actor?.system?.attributes?.AGI?.value ?? 0;
    const agiB = b.actor?.system?.attributes?.AGI?.value ?? 0;
    if (agiA !== agiB) return agiB - agiA;

    return a.id > b.id ? 1 : -1;
  }

  /* ---------------------------------------- */
  /*  Initiative                              */
  /* ---------------------------------------- */

  /**
   * Set initiative for combatants based on their latency stat.
   * In FORJA, initiative starts as base latency but changes when actions are declared.
   * @override
   */
  async rollInitiative(ids, { formula = null, updateTurn = true, messageOptions = {} } = {}) {
    LOG("rollInitiative called for", ids.length, "combatants");
    const updates = [];
    for (const id of ids) {
      const combatant = this.combatants.get(id);
      if (!combatant?.actor) continue;
      const latency = combatant.actor.system.latency ?? 10;
      updates.push({ _id: id, initiative: latency });
      LOG(`  ${combatant.name}: initiative = ${latency} (base latency)`);
    }
    if (updates.length) {
      await this.updateEmbeddedDocuments("Combatant", updates);
    }
    return this;
  }

  /** @override */
  async rollAll(options = {}) {
    const ids = this.combatants.map(c => c.id);
    return this.rollInitiative(ids, options);
  }

  /** @override */
  async rollNPC(options = {}) {
    const ids = this.combatants.filter(c => !c.isOwner || c.actor?.type !== "character").map(c => c.id);
    return this.rollInitiative(ids, options);
  }

  /* ---------------------------------------- */
  /*  Phase Management                        */
  /* ---------------------------------------- */

  /**
   * Start the combat. Shows ambush dialog, assigns sides, enters declaration phase.
   * Called by Foundry when "Begin Encounter" is clicked.
   * @override
   */
  async startCombat() {
    // If the combat is already running (round > 0), only initialize NEW combatants
    // and skip resetting existing ones (preserves declared actions and targets)
    const alreadyStarted = this.started;
    LOG("startCombat called (Begin Encounter)", alreadyStarted ? "(already running — protecting existing state)" : "");

    // Show ambush dialog only on FIRST start
    let isAmbush = false;
    let ambushAdvantageIds = [];
    if (game.user.isGM && !alreadyStarted) {
      const result = await this._showAmbushDialog();
      isAmbush = result.isAmbush;
      ambushAdvantageIds = result.advantageIds;
      LOG("Ambush dialog result:", { isAmbush, ambushAdvantageIds });
    }

    // Initialize combatant state — skip already-initialized combatants to preserve
    // declared actions and targets when a new PC is added mid-combat
    const updates = [];
    for (const c of this.combatants) {
      const hasForjaState = c.getFlag("forja", "side") != null;
      if (alreadyStarted && hasForjaState) {
        LOG(`  ${c.name}: already initialized, skipping`);
        continue;
      }
      const isPlayer = c.actor?.type === "character" && c.hasPlayerOwner;
      const side = isPlayer ? "players" : "antagonists";
      const latency = c.actor?.system?.latency ?? 10;
      // Late-joining combatant: start from current clock position
      const clockPos = alreadyStarted ? (this.getFlag("forja", "currentClockPosition") ?? 0) : 0;
      updates.push({
        _id: c.id,
        initiative: clockPos > 0 ? -(clockPos) : -latency,
        "flags.forja.side": side,
        "flags.forja.position": 0,
        "flags.forja.declaredAction": null,
        "flags.forja.reactionsUsed": 0,
        "flags.forja.pendingMove": null
      });
      LOG(`  ${c.name}: side=${side}, latency=${latency}${alreadyStarted ? " (late entry)" : ""}`);
    }
    if (updates.length) await this.updateEmbeddedDocuments("Combatant", updates);

    // Only set combat-level flags on the very first start
    if (!alreadyStarted) {
      await this.setFlag("forja", "isAmbush", isAmbush);
      await this.setFlag("forja", "ambushAdvantageIds", ambushAdvantageIds);
      await this.setFlag("forja", "pendingDamage", []);
      await this.setFlag("forja", "resolvingIds", []);
      const phase = (isAmbush && ambushAdvantageIds.length > 0) ? "ambush_declaration" : "declaration";
      await this.setFlag("forja", "phase", phase);
      LOG(`Combat initialized: phase=${phase}`);
    }

    // Call super so Foundry sets round=1, turn=0 and fires the combatStart hook
    return super.startCombat();
  }

  /**
   * Show the ambush selection dialog.
   * @returns {Promise<{isAmbush: boolean, advantageIds: string[]}>}
   * @private
   */
  async _showAmbushDialog() {
    LOG("Showing ambush dialog...");
    const combatants = this.combatants.map(c => ({
      id: c.id,
      name: c.name,
      img: c.img ?? c.actor?.img ?? "icons/svg/mystery-man.svg"
    }));

    const content = await foundry.applications.handlebars.renderTemplate(
      "systems/forja/templates/combat/start-combat-dialog.hbs",
      { combatants }
    );

    return new Promise(resolve => {
      new Dialog({
        title: game.i18n.localize("FORJA.Combat.Start"),
        content,
        buttons: {
          normal: {
            icon: '<i class="fas fa-play"></i>',
            label: game.i18n.localize("FORJA.Combat.StartNormal"),
            callback: () => {
              LOG("User chose: normal combat");
              resolve({ isAmbush: false, advantageIds: [] });
            }
          },
          ambush: {
            icon: '<i class="fas fa-eye-slash"></i>',
            label: game.i18n.localize("FORJA.Combat.StartAmbush"),
            callback: (html) => {
              const root = html[0] ?? html;
              const checked = root.querySelectorAll(".forja-ambush-check:checked");
              const advantageIds = Array.from(checked).map(cb => cb.dataset.combatantId);
              LOG("User chose: ambush. Advantage IDs:", advantageIds);
              resolve({ isAmbush: true, advantageIds });
            }
          }
        },
        default: "normal",
        close: () => resolve({ isAmbush: false, advantageIds: [] })
      }).render(true);
    });
  }

  /**
   * Check if all combatants that need to declare have done so.
   * In ambush_declaration, only ambush advantage combatants need to declare.
   */
  get allDeclared() {
    const phase = this.phase;
    return this.combatants
      .filter(c => !c.defeated && this._shouldDeclare(c, phase))
      .every(c => c.declaredAction != null);
  }

  /**
   * Whether a combatant should declare in the current phase.
   */
  _shouldDeclare(combatant, phase) {
    if (phase === "ambush_declaration") {
      return this.ambushAdvantageIds.includes(combatant.id);
    }
    // In normal declaration, those without an action need to declare
    return combatant.declaredAction == null;
  }

  /**
   * Get the declaration order for current phase.
   * Highest latency declares first (slowest reveals strategy first).
   */
  getDeclarationOrder() {
    const phase = this.phase;
    let candidates = this.combatants.contents.filter(c => !c.defeated);

    if (phase === "ambush_declaration") {
      candidates = candidates.filter(c => this.ambushAdvantageIds.includes(c.id));
    }

    return getDeclarationOrder(candidates);
  }

  /**
   * Advance to the next combatant(s) who act.
   * Finds the lowest position among all declared combatants and marks them as resolving.
   */
  async advanceToNext() {
    LOG("advanceToNext called");
    // Find the minimum position among combatants with declared actions
    let minPos = Infinity;
    for (const c of this.combatants) {
      if (c.defeated || !c.declaredAction) continue;
      const pos = c.position;
      LOG(`  ${c.name}: position=${pos}, action=${c.declaredAction?.type}`);
      if (pos > 0 && pos < minPos) minPos = pos;
    }

    if (minPos === Infinity) {
      LOG("No combatants with declared actions to advance to");
      return;
    }

    // All combatants at the minimum position resolve
    const resolving = [];
    for (const c of this.combatants) {
      if (c.defeated || !c.declaredAction) continue;
      if (c.position === minPos) resolving.push(c.id);
    }

    LOG(`Advancing to position ${minPos}. Resolving:`, resolving.map(id => this.combatants.get(id)?.name));
    const phase = this.phase === "ambush_declaration" ? "ambush_resolution" : "resolution";
    await this.setFlag("forja", "phase", phase);
    await this.setFlag("forja", "resolvingIds", resolving);
    await this.setFlag("forja", "pendingDamage", []);
    // Track current clock position so late-entry combatants start from here
    await this.setFlag("forja", "currentClockPosition", minPos);

    // Draw active rings around resolving combatant tokens
    await drawActiveRings(resolving, this);

    // Chat notification
    const names = resolving.map(id => this.combatants.get(id)?.name).filter(Boolean);
    if (names.length) {
      ChatMessage.create({
        content: `<strong>${game.i18n.localize("FORJA.Combat.PhaseResolution")}</strong>: ${names.join(", ")}`,
        speaker: { alias: "FORJA" }
      });
    }
  }

  /**
   * Add pending damage to be applied at end of turn.
   */
  async addPendingDamage(targetId, amount, sourceId = null, description = "") {
    const current = this.pendingDamage;
    current.push({ targetId, amount, sourceId, description });
    await this.setFlag("forja", "pendingDamage", current);
  }

  /**
   * Finish the current resolution: apply pending damage, clear actions
   * for combatants who acted, and return to declaration phase.
   */
  async finishResolution() {
    LOG("finishResolution called");
    const resolvingIds = this.resolvingIds;
    const pending = this.pendingDamage;
    LOG(`  Resolving: ${resolvingIds.length} combatants, Pending damage: ${pending.length}`);

    // Apply pending damage to actors
    for (const { targetId, amount } of pending) {
      const combatant = this.combatants.get(targetId);
      if (!combatant?.actor || amount <= 0) continue;
      const currentWounds = combatant.actor.system.health?.wounds?.value ?? 0;
      await combatant.actor.update({
        "system.health.wounds.value": currentWounds + amount
      });
    }

    // Apply any pending moves not yet applied manually ("Move now" button fallback)
    for (const id of resolvingIds) {
      const combatant = this.combatants.get(id);
      const pendingMove = combatant?.getFlag("forja", "pendingMove");
      if (pendingMove && combatant.token) {
        LOG(`  Auto-applying pending move for ${combatant.name}:`, pendingMove);
        await combatant.token.update(
          { x: pendingMove.x, y: pendingMove.y },
          { forjaApplyingMove: true }
        );
      }
    }
    // Clear movement vector drawings for resolving combatants
    await clearMovementVectors(resolvingIds, this);

    // Clear active resolution rings (were drawn in advanceToNext)
    await clearActiveRings();

    // Clear declared actions for resolving combatants, reset reactions, return to declaration order.
    // NOTE: "flags.forja.position" is intentionally NOT reset here — it keeps the accumulated
    // acting position so that the next declareAction() correctly adds to it (FORJA clock system).
    const updates = resolvingIds.map(id => {
      const c = this.combatants.get(id);
      const latency = c?.actor?.system?.latency ?? 10;
      return {
        _id: id,
        initiative: -latency, // Reset to negative for next declaration phase
        "flags.forja.declaredAction": null,
        "flags.forja.reactionsUsed": 0,
        "flags.forja.attackRolled": false,
        "flags.forja.pendingMove": null,
        "flags.forja.preRolledDefenseFites": null
        // position kept intentionally
      };
    });
    if (updates.length) {
      await this.updateEmbeddedDocuments("Combatant", updates);
    }

    // After ambush resolution, enter normal declaration (everyone declares)
    const wasAmbush = this.phase === "ambush_resolution";
    const flagUpdates = {
      "flags.forja.phase": "declaration",
      "flags.forja.resolvingIds": [],
      "flags.forja.pendingDamage": []
    };
    if (wasAmbush) {
      flagUpdates["flags.forja.isAmbush"] = false;
      flagUpdates["flags.forja.ambushAdvantageIds"] = [];
    }
    await this.update(flagUpdates);

    // Notify about applied damage
    if (pending.length > 0) {
      const lines = pending.map(({ targetId, amount, description }) => {
        const name = this.combatants.get(targetId)?.name ?? "?";
        return `${name}: ${amount} ${game.i18n.localize("FORJA.Combat.damage")}${description ? ` (${description})` : ""}`;
      });
      ChatMessage.create({
        content: `<strong>${game.i18n.localize("FORJA.Combat.DamageApplied")}</strong><br>${lines.join("<br>")}`,
        speaker: { alias: "FORJA" }
      });
    }
  }
}
