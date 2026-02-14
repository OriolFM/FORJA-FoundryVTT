const { HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Character sheet for Player Characters (PJ).
 * Uses Foundry v13 ApplicationV2 with HandlebarsApplicationMixin.
 */
export default class ForjaCharacterSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["forja", "sheet", "actor", "character"],
    position: { width: 720, height: 800 },
    actions: {
      rollAttribute: ForjaCharacterSheet.#onRollAttribute,
      rollSkill: ForjaCharacterSheet.#onRollSkill,
      rollAttack: ForjaCharacterSheet.#onRollAttack,
      adjustTracker: ForjaCharacterSheet.#onAdjustTracker,
      toggleEquip: ForjaCharacterSheet.#onToggleEquip,
      itemEdit: ForjaCharacterSheet.#onItemEdit,
      itemDelete: ForjaCharacterSheet.#onItemDelete
    },
    form: { submitOnChange: true }
  };

  static PARTS = {
    header: { template: "systems/forja/templates/actor/parts/character-header.hbs" },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    attributes: { template: "systems/forja/templates/actor/parts/attributes.hbs", scrollable: [""] },
    skills: { template: "systems/forja/templates/actor/parts/skills-list.hbs", scrollable: [""] },
    combat: { template: "systems/forja/templates/actor/parts/combat-info.hbs", scrollable: [""] },
    traits: { template: "systems/forja/templates/actor/parts/traits-list.hbs", scrollable: [""] },
    equipment: { template: "systems/forja/templates/actor/parts/equipment-tab.hbs", scrollable: [""] },
    supernatural: { template: "systems/forja/templates/actor/parts/effects-list.hbs", scrollable: [""] },
    biography: { template: "systems/forja/templates/actor/parts/biography-tab.hbs", scrollable: [""] }
  };

  static TABS = {
    primary: {
      tabs: [
        { id: "attributes", group: "primary", icon: "fas fa-dice-d20", label: "FORJA.Tabs.Attributes" },
        { id: "skills", group: "primary", icon: "fas fa-book", label: "FORJA.Tabs.Skills" },
        { id: "combat", group: "primary", icon: "fas fa-swords", label: "FORJA.Tabs.Combat" },
        { id: "traits", group: "primary", icon: "fas fa-star", label: "FORJA.Tabs.Traits" },
        { id: "equipment", group: "primary", icon: "fas fa-toolbox", label: "FORJA.Tabs.Equipment" },
        { id: "supernatural", group: "primary", icon: "fas fa-hat-wizard", label: "FORJA.Tabs.Supernatural" },
        { id: "biography", group: "primary", icon: "fas fa-feather", label: "FORJA.Tabs.Biography" }
      ],
      initial: "attributes"
    }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.document.system;
    const cfg = CONFIG.FORJA;
    const TextEditorImpl = foundry.applications.ux.TextEditor.implementation;

    // Group skills by related attribute
    const skillsByAttribute = {};
    for (const key of Object.keys(cfg.attributes)) {
      skillsByAttribute[key] = [];
    }
    for (const item of this.document.items) {
      if (item.type === "skill") {
        const attr = item.system.relatedAttribute;
        if (skillsByAttribute[attr]) {
          skillsByAttribute[attr].push(item);
        }
      }
    }
    // Sort skills alphabetically within each group
    for (const key of Object.keys(skillsByAttribute)) {
      skillsByAttribute[key].sort((a, b) => a.name.localeCompare(b.name));
    }

    // Group traits by category
    const traitsByCategory = {};
    for (const item of this.document.items) {
      if (item.type === "trait") {
        const cat = item.system.category || "general";
        if (!traitsByCategory[cat]) traitsByCategory[cat] = [];
        traitsByCategory[cat].push(item);
      }
    }

    // Weapons and armor
    const weapons = this.document.items.filter(i => i.type === "weapon");
    const armor = this.document.items.filter(i => i.type === "armor");
    const equippedArmor = armor.find(a => a.system.equipped);

    // Artifacts and supernatural effects
    const artifacts = this.document.items.filter(i => i.type === "artifact");
    const supernaturalEffects = this.document.items.filter(i => i.type === "supernaturalEffect");

    // Group supernatural effects by gift type
    const effectsByGift = {};
    for (const effect of supernaturalEffects) {
      const gift = effect.system.requiredGift || "magus";
      if (!effectsByGift[gift]) effectsByGift[gift] = [];
      effectsByGift[gift].push(effect);
    }

    // Prepare tab data for the tab navigation template
    const tabs = {};
    const activeTab = this.tabGroups?.primary ?? "attributes";
    for (const tab of this.constructor.TABS.primary.tabs) {
      tabs[tab.id] = {
        ...tab,
        active: tab.id === activeTab,
        cssClass: tab.id === activeTab ? "active" : ""
      };
    }

    return {
      ...context,
      system,
      cfg,
      tabs,
      // String versions for selectOptions comparison
      sizeStr: String(system.size),
      constitutionStr: String(system.constitution),
      skillsByAttribute,
      traitsByCategory,
      weapons,
      armor,
      equippedArmor,
      artifacts,
      supernaturalEffects,
      effectsByGift,
      enrichedBiography: await TextEditorImpl.enrichHTML(system.biography, { async: true }),
      enrichedNotes: await TextEditorImpl.enrichHTML(system.notes, { async: true })
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Activate the initial tab on first render
    const activeTab = this.tabGroups?.primary ?? "attributes";
    const tabContent = this.element?.querySelector(`.tab[data-tab="${activeTab}"]`);
    if (tabContent && !tabContent.classList.contains("active")) {
      // Deactivate all tabs, activate the current one
      this.element.querySelectorAll(".tab[data-group='primary']").forEach(t => t.classList.remove("active"));
      tabContent.classList.add("active");
    }
  }

  // --- Actions ---

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
    const tracker = target.dataset.tracker; // "wounds" or "fatigue"
    const delta = parseInt(target.dataset.delta);
    if (!tracker || isNaN(delta)) return;

    const current = this.document.system.health[tracker].value;
    const max = this.document.system.health[tracker].max;
    const newVal = Math.clamp(current + delta, 0, max);
    this.document.update({ [`system.health.${tracker}.value`]: newVal });
  }

  static #onToggleEquip(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    const item = this.document.items.get(itemId);
    if (!item) return;
    item.update({ "system.equipped": !item.system.equipped });
  }

  static #onItemEdit(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId ?? target.dataset.itemId;
    const item = this.document.items.get(itemId);
    if (item) item.sheet.render(true);
  }

  static #onItemDelete(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId ?? target.dataset.itemId;
    const item = this.document.items.get(itemId);
    if (item) item.deleteDialog();
  }
}
