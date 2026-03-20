const { HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Character sheet for Player Characters (PJ).
 * Uses Foundry v13 ApplicationV2 with HandlebarsApplicationMixin.
 */
export default class ForjaCharacterSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["forja", "sheet", "actor", "character"],
    position: { width: 860, height: 860 },
    actions: {
      editImage: ForjaCharacterSheet.#onEditImage,
      rollAttribute: ForjaCharacterSheet.#onRollAttribute,
      rollSkill: ForjaCharacterSheet.#onRollSkill,
      rollAttack: ForjaCharacterSheet.#onRollAttack,
      adjustTracker: ForjaCharacterSheet.#onAdjustTracker,
      toggleEquip: ForjaCharacterSheet.#onToggleEquip,
      itemEdit: ForjaCharacterSheet.#onItemEdit,
      itemDelete: ForjaCharacterSheet.#onItemDelete,
      addInventoryNote: ForjaCharacterSheet.#onAddInventoryNote,
      removeInventoryNote: ForjaCharacterSheet.#onRemoveInventoryNote,
      rollNaturalWeapon: ForjaCharacterSheet.#onRollNaturalWeapon,
      openArtifactPicker: ForjaCharacterSheet.#onOpenArtifactPicker,
      rollArtifactWeapon: ForjaCharacterSheet.#onRollArtifactWeapon,
      saveToForjApp: ForjaCharacterSheet.#onSaveToForjApp,
      loadFromForjApp: ForjaCharacterSheet.#onLoadForjAppList
    },
    form: { submitOnChange: true },
    dragDrop: [{ dropSelector: "form" }]
  };

  static PARTS = {
    header: { template: "systems/forja/templates/actor/parts/character-header.hbs" },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
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
        { id: "skills", group: "primary", icon: "fas fa-book", label: "FORJA.Tabs.Skills" },
        { id: "combat", group: "primary", icon: "fas fa-swords", label: "FORJA.Tabs.Combat" },
        { id: "traits", group: "primary", icon: "fas fa-star", label: "FORJA.Tabs.Traits" },
        { id: "equipment", group: "primary", icon: "fas fa-toolbox", label: "FORJA.Tabs.Equipment" },
        { id: "supernatural", group: "primary", icon: "fas fa-hat-wizard", label: "FORJA.Tabs.Supernatural" },
        { id: "biography", group: "primary", icon: "fas fa-feather", label: "FORJA.Tabs.Biography" }
      ],
      initial: "skills"
    }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.document.system;
    const cfg = CONFIG.FORJA;
    const TextEditorImpl = foundry.applications.ux.TextEditor.implementation;

    // Flat alphabetical list of skills
    const skills = this.document.items
      .filter(i => i.type === "skill")
      .sort((a, b) => a.name.localeCompare(b.name));

    // Flat alphabetical list of traits
    const traits = this.document.items
      .filter(i => i.type === "trait")
      .sort((a, b) => a.name.localeCompare(b.name));

    // Count skills and traits for empty-state display
    const hasSkills = this.document.items.some(i => i.type === "skill");
    const hasTraits = this.document.items.some(i => i.type === "trait");

    // Weapons and armor
    const weapons = this.document.items.filter(i => i.type === "weapon");
    const armor = this.document.items.filter(i => i.type === "armor");
    const equippedArmor = armor.find(a => a.system.equipped);

    // Artifacts and supernatural effects
    const artifacts = this.document.items.filter(i => i.type === "artifact");
    const supernaturalEffects = this.document.items.filter(i => i.type === "supernaturalEffect");

    // Weapon-type artifacts: artifacts with a damageValue or baseWeapon — shown in attack list
    const weaponArtifacts = artifacts
      .filter(a => a.system.damageValue > 0 || a.system.baseWeapon)
      .map(a => {
        const base = cfg.weaponBaseStats?.[a.system.baseWeapon] ?? null;
        const damage = base
          ? `${base.damage}${a.system.damageValue > 0 ? "+" + a.system.damageValue : ""}`
          : String(a.system.damageValue || 0);
        return {
          id: a.id,
          name: a.name,
          attackType: base?.attackType ?? "melee",
          damage,
          latencyMod: (base?.latencyMod ?? 0) + (a.system.latencyMod ?? 0),
          reach: base?.reach ?? (a.system.range === "touch" ? "A tocar" : ""),
          special: (a.system.statesApplied ?? []).map(s => `${s.stateId}/${s.value}`).join(", ")
        };
      });

    // Group supernatural effects by gift type
    const effectsByGift = {};
    for (const effect of supernaturalEffects) {
      const gift = effect.system.requiredGift || "magus";
      if (!effectsByGift[gift]) effectsByGift[gift] = [];
      effectsByGift[gift].push(effect);
    }

    // Prepare tab data for the tab navigation template
    const tabs = {};
    const activeTab = this.tabGroups?.primary ?? "skills";
    for (const tab of this.constructor.TABS.primary.tabs) {
      tabs[tab.id] = {
        ...tab,
        active: tab.id === activeTab,
        cssClass: tab.id === activeTab ? "active" : ""
      };
    }

    // Build health levels with squares for visual display
    // Each level (1-6) has exactly 'perLevel' squares. Level 7 (incapacitat/inconscient) has none.
    const buildHealthLevels = (value, perLevel, levels, labelPrefix) => {
      const entries = Object.entries(levels);
      const result = [];
      let consumed = 0;
      for (const [key, def] of entries) {
        // Level 7 (incapacitated/unconscious) has no squares
        const isLastLevel = def.penalty === null;
        const count = isLastLevel ? 0 : perLevel;
        const squares = [];
        for (let i = 0; i < count; i++) {
          squares.push({ filled: consumed + i < value });
        }
        consumed += count;

        // Color class for the level
        let colorClass = "healthy";
        if (def.penalty === null) colorClass = "incapacitated";
        else if (def.penalty >= 3) colorClass = "critical";
        else if (def.penalty >= 2) colorClass = "severe";
        else if (def.penalty >= 1) colorClass = "moderate";
        else if (def.level >= 3) colorClass = "light";

        const penaltyText = def.penalty === null
          ? game.i18n.localize("FORJA.Incapacitated")
          : def.penalty > 0 ? `+${def.penalty}` : "";

        // Show level 7 label only if actually in that state
        const isActive = isLastLevel
          ? value >= consumed
          : value > consumed - count;

        result.push({
          key,
          label: game.i18n.localize(`${labelPrefix}.${key}`),
          penalty: penaltyText,
          colorClass,
          squares,
          count,
          isLastLevel,
          isActive
        });
      }
      return result;
    };
    const woundLevels = buildHealthLevels(system.health.wounds.value, system.size, cfg.woundLevels, "FORJA.WoundLevel");
    const fatigueLevels = buildHealthLevels(system.health.fatigue.value, system.constitution, cfg.fatigueLevels, "FORJA.FatigueLevel");

    // Natural weapons: always Cop + any from armament_natural traits
    const naturalWeapons = [];
    naturalWeapons.push({
      id: "cop",
      name: game.i18n.localize("FORJA.Natural.Cop"),
      damage: "FOR+1",
      latencyMod: 0,
      reach: "0",
      attackType: "brawl",
      special: ""
    });
    const addedNaturalIds = new Set(["cop"]);
    for (const item of this.document.items) {
      if (item.type !== "trait") continue;
      const def = cfg?.naturalWeaponTraits?.[item.system.traitId];
      if (!def || addedNaturalIds.has(def.id)) continue;
      addedNaturalIds.add(def.id);
      naturalWeapons.push({
        id: def.id,
        name: game.i18n.localize(def.nameKey),
        damage: def.damage,
        latencyMod: def.latencyMod,
        reach: def.reach,
        attackType: def.attackType,
        special: def.specialKey ? game.i18n.localize(def.specialKey) : ""
      });
    }

    return {
      ...context,
      system,
      cfg,
      tabs,
      actorType: this.document.type,
      // String versions for selectOptions comparison
      sizeStr: String(system.size),
      constitutionStr: String(system.constitution),
      skills,
      hasSkills,
      traits,
      hasTraits,
      weapons,
      weaponArtifacts,
      naturalWeapons,
      armor,
      equippedArmor,
      naturalArmorLevel: this.document.items
        .filter(i => i.type === "trait" && i.system.traitId === "armadura-natural")
        .reduce((sum, i) => sum + (i.system.level ?? 0), 0),
      artifacts,
      supernaturalEffects,
      effectsByGift,
      woundLevels,
      fatigueLevels,
      // Penalty labels for wound/fatigue display (empty string = no penalty shown)
      woundPenaltyLabel: system.woundPenalty === null
        ? game.i18n.localize("FORJA.Incapacitated")
        : system.woundPenalty > 0 ? `+${system.woundPenalty}` : "",
      fatiguePenaltyLabel: system.fatiguePenalty === null
        ? game.i18n.localize("FORJA.Incapacitated")
        : system.fatiguePenalty > 0 ? `+${system.fatiguePenalty}` : "",
      inventoryNotes: system.inventoryNotes ?? [],
      enrichedBiography: await TextEditorImpl.enrichHTML(system.biography, { async: true }),
      enrichedNotes: await TextEditorImpl.enrichHTML(system.notes, { async: true })
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Activate the initial tab on first render
    const activeTab = this.tabGroups?.primary ?? "skills";
    const tabContent = this.element?.querySelector(`.tab[data-tab="${activeTab}"]`);
    if (tabContent && !tabContent.classList.contains("active")) {
      // Deactivate all tabs, activate the current one
      this.element.querySelectorAll(".tab[data-group='primary']").forEach(t => t.classList.remove("active"));
      tabContent.classList.add("active");
    }

    // Enter key on inventory input triggers add
    this.element?.querySelector(".forja-inventory__input")?.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        this.element.querySelector("[data-action='addInventoryNote']")?.click();
      }
    });
  }

  // --- Actions ---

  static #onEditImage(event, target) {
    const current = this.document.img;
    const fp = new FilePicker({
      type: "image",
      current,
      callback: (path) => {
        this.document.update({ img: path, "prototypeToken.texture.src": path });
      }
    });
    fp.render(true);
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

  static #onAddInventoryNote(event, target) {
    const input = this.element.querySelector(".forja-inventory__input");
    const text = input?.value?.trim();
    if (!text) return;
    const notes = [...(this.document.system.inventoryNotes ?? []), text];
    input.value = "";
    this.document.update({ "system.inventoryNotes": notes });
  }

  static #onRemoveInventoryNote(event, target) {
    const index = parseInt(target.dataset.index ?? target.closest("[data-index]")?.dataset.index);
    if (isNaN(index)) return;
    const notes = [...(this.document.system.inventoryNotes ?? [])];
    notes.splice(index, 1);
    this.document.update({ "system.inventoryNotes": notes });
  }

  static #onRollNaturalWeapon(event, target) {
    const weaponId = target.closest("[data-weapon-id]")?.dataset.weaponId;
    if (weaponId) this.document.rollNaturalWeapon(weaponId);
  }

  static #onRollArtifactWeapon(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId ?? target.dataset.itemId;
    if (itemId) this.document.rollAttack(itemId);
  }

  static async #onOpenArtifactPicker(event, target) {
    const pack = game.packs.get("forja.artifacts");
    if (!pack) {
      ui.notifications?.warn("Compendium forja.artifacts not found. Rebuild packs first.");
      return;
    }
    const docs = await pack.getDocuments();
    docs.sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));

    const cfg = CONFIG.FORJA;
    const activationLabel = (type) => {
      const key = cfg.activationTypes?.[type];
      return key ? game.i18n.localize(key) : (type ?? "");
    };

    const rows = docs.map(d => `
      <div class="forja-artifact-pick" data-id="${d.id}">
        <img src="${d.img}" class="forja-artifact-pick__img" />
        <div class="forja-artifact-pick__info">
          <div class="forja-artifact-pick__name">${d.name}</div>
          <div class="forja-artifact-pick__meta">${d.system.cost} pts · ${activationLabel(d.system.activation)}</div>
        </div>
        <i class="fas fa-plus forja-artifact-pick__add"></i>
      </div>
    `).join("");

    const searchPlaceholder = game.i18n.localize("FORJA.Search");
    const content = `
      <div class="forja-picker-search">
        <i class="fas fa-search forja-picker-search__icon"></i>
        <input type="text" class="forja-picker-search__input" placeholder="${searchPlaceholder}…" autocomplete="off" />
      </div>
      <div class="forja-artifact-picker">${rows}</div>`;

    const actor = this.document;
    const dialog = new Dialog({
      title: game.i18n.localize("FORJA.AddArtifact"),
      content,
      buttons: {
        close: { label: game.i18n.localize("Close"), icon: '<i class="fas fa-times"></i>' }
      },
      render: (html) => {
        html.find(".forja-picker-search__input").on("input", (ev) => {
          const q = ev.target.value.trim().toLowerCase();
          html.find(".forja-artifact-pick").each((_, el) => {
            const name = el.querySelector(".forja-artifact-pick__name")?.textContent.toLowerCase() ?? "";
            el.style.display = name.includes(q) ? "" : "none";
          });
        }).trigger("focus");

        html.find(".forja-artifact-pick").on("click", async (ev) => {
          const id = ev.currentTarget.dataset.id;
          const doc = docs.find(d => d.id === id);
          if (!doc) return;
          const itemData = doc.toObject();
          delete itemData._id;
          await actor.createEmbeddedDocuments("Item", [itemData]);
          dialog.close();
          ui.notifications?.info(game.i18n.format("FORJA.ArtifactAdded", { name: doc.name }));
        });
      }
    }, { classes: ["dialog", "forja-dialog"], width: 420 });
    dialog.render(true);
  }

  // ── ForjApp Bridge ────────────────────────────────────────────────────

  static async #onSaveToForjApp(event, target) {
    try {
      const { ForjAppBridge } = await import("../../apps/forjapp-bridge.mjs");
      await ForjAppBridge.saveCharacter(this.actor);
    } catch (e) {
      ui.notifications.error(`FORJApp: ${e.message}`);
    }
  }

  static async #onLoadForjAppList(event, target) {
    const btn = target;
    btn.disabled = true;
    try {
      const { ForjAppBridge } = await import("../../apps/forjapp-bridge.mjs");
      const { ForjAppCharacterPicker } = await import("../../apps/forjapp-character-picker.mjs");
      const chars = await ForjAppBridge.listUserCharacters();
      new ForjAppCharacterPicker(chars).render(true);
    } catch (e) {
      ui.notifications.error(`FORJApp: ${e.message}`);
    } finally {
      btn.disabled = false;
    }
  }
}
