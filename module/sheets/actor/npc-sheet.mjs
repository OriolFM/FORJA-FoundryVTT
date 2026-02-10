/**
 * Simplified sheet for NPCs (PNJ).
 */
export default class ForjaNPCSheet extends foundry.applications.sheets.ActorSheetV2 {

  static DEFAULT_OPTIONS = {
    classes: ["forja", "sheet", "actor", "npc"],
    position: { width: 620, height: 700 },
    actions: {
      rollAttribute: ForjaNPCSheet.#onRollAttribute,
      rollSkill: ForjaNPCSheet.#onRollSkill,
      rollAttack: ForjaNPCSheet.#onRollAttack,
      adjustTracker: ForjaNPCSheet.#onAdjustTracker,
      toggleEquip: ForjaNPCSheet.#onToggleEquip
    },
    form: { submitOnChange: true }
  };

  static PARTS = {
    sheet: { template: "systems/forja/templates/actor/npc-sheet.hbs", scrollable: [""] }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.document.system;

    const skills = this.document.items.filter(i => i.type === "skill" && i.system.level > 0);
    const traits = this.document.items.filter(i => i.type === "trait");
    const weapons = this.document.items.filter(i => i.type === "weapon");
    const armor = this.document.items.filter(i => i.type === "armor");
    const artifacts = this.document.items.filter(i => i.type === "artifact");
    const supernaturalEffects = this.document.items.filter(i => i.type === "supernaturalEffect");

    return {
      ...context,
      system,
      cfg: CONFIG.FORJA,
      skills: skills.sort((a, b) => a.name.localeCompare(b.name)),
      traits,
      weapons,
      armor,
      artifacts,
      supernaturalEffects
    };
  }

  static #onRollAttribute(event, target) {
    const attr = target.dataset.attribute;
    if (attr) this.document.rollAttribute(attr);
  }

  static #onRollSkill(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    if (itemId) this.document.rollSkill(itemId);
  }

  static #onRollAttack(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    if (itemId) this.document.rollAttack(itemId);
  }

  static #onAdjustTracker(event, target) {
    const tracker = target.dataset.tracker;
    const delta = parseInt(target.dataset.delta);
    if (!tracker || isNaN(delta)) return;
    const current = this.document.system.health[tracker].value;
    const max = this.document.system.health[tracker].max;
    this.document.update({ [`system.health.${tracker}.value`]: Math.clamp(current + delta, 0, max) });
  }

  static #onToggleEquip(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    const item = this.document.items.get(itemId);
    if (item) item.update({ "system.equipped": !item.system.equipped });
  }
}
