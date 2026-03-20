const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Wizard de creació de personatge (PJ) pas a pas — 7 passos.
 * S'activa via el hook preCreateActor quan type === "character".
 *
 * Passos: 1=Concepte  2=Cos/Espècie/Atributs  3=Habilitats  4=Trets
 *         5=Equipament  6=Efectes sobrenaturals (salt si no hi ha do)  7=Resum
 */
export class CharacterCreationWizard extends HandlebarsApplicationMixin(ApplicationV2) {

  // ── Estat intern ──────────────────────────────────────────────────────────

  #currentStep = 1;

  // Pas 1: Concepte
  #name = "";
  #concept = "";
  #origin = "";
  #gender = "";
  #age = 0;
  #totalPoints = 100;

  // Pas 2: Espècie, Cos i Atributs (fusionats)
  #species = "humanoid";
  #size = 3;
  #constitution = 3;
  #attributes = { FOR: 1, DES: 1, AGI: 1, PER: 1, INT: 1, APL: 1 };

  // Pas 3: Habilitats
  #skillFilter = "";
  #selectedSkills = new Map(); // skillId → { doc, level }

  // Pas 4: Trets
  #traitFilter = "";
  #traitCategoryFilter = "all";
  #selectedTraits = new Map(); // traitId → { doc, level, variantCost }

  // Pas 5: Equipament
  #weaponFilter = "";
  #weaponTypeFilter = "all"; // "all" | "melee" | "ranged"
  #armorFilter = "";
  #artifactFilter = "";
  #selectedWeapons   = new Set(); // doc.id
  #selectedArmors    = new Set(); // doc.id
  #selectedArtifacts = new Set(); // doc.id

  // Pas 6: Efectes sobrenaturals
  #effectFilter = "";
  #selectedEffects = new Set(); // doc.id

  // Caché de compendiums
  #skillDocs    = [];
  #traitDocs    = [];
  #weaponDocs   = [];
  #armorDocs    = [];
  #artifactDocs = [];
  #effectDocs   = [];
  #dataLoaded   = false;

  // ── Opcions estàtiques ─────────────────────────────────────────────────────

  static DEFAULT_OPTIONS = {
    id: "forja-character-creation-wizard",
    classes: ["forja", "character-creation-wizard"],
    window: { title: "FORJA.Wizard.Title" },
    position: { width: 800, height: 660 },
    actions: {
      nextStep:        CharacterCreationWizard._onNextStep,
      prevStep:        CharacterCreationWizard._onPrevStep,
      goToStep:        CharacterCreationWizard._onGoToStep,
      attrDec:         CharacterCreationWizard._onAttrDec,
      attrInc:         CharacterCreationWizard._onAttrInc,
      addSkill:        CharacterCreationWizard._onAddSkill,
      removeSkill:     CharacterCreationWizard._onRemoveSkill,
      addTrait:        CharacterCreationWizard._onAddTrait,
      removeTrait:     CharacterCreationWizard._onRemoveTrait,
      addWeapon:       CharacterCreationWizard._onAddWeapon,
      removeWeapon:    CharacterCreationWizard._onRemoveWeapon,
      addArmor:        CharacterCreationWizard._onAddArmor,
      removeArmor:     CharacterCreationWizard._onRemoveArmor,
      addArtifact:     CharacterCreationWizard._onAddArtifact,
      removeArtifact:  CharacterCreationWizard._onRemoveArtifact,
      addEffect:       CharacterCreationWizard._onAddEffect,
      removeEffect:    CharacterCreationWizard._onRemoveEffect,
      createCharacter: CharacterCreationWizard._onCreateCharacter
    }
  };

  static PARTS = {
    wizard: { template: "systems/forja/templates/apps/character-creation-wizard.hbs" }
  };

  // ── Constructor ────────────────────────────────────────────────────────────

  constructor(options = {}) {
    super(options);
    if (options.actorName) this.#name = options.actorName;
  }

  // ── Context ─────────────────────────────────────────────────────────────────

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    if (!this.#dataLoaded) await this._loadCompendiumData();

    const costs    = this._computeCosts();
    const derived  = this._computeDerived();
    const warnings = this._computeIncompatibilityWarnings();
    const stepValid = this._validateCurrentStep(warnings);
    const hasGift  = this._hasGiftTrait();

    const autoWeapons = this._computeAutoWeapons();

    return {
      ...context,

      // Navegació
      currentStep: this.#currentStep,
      stepLabels:  this._getStepLabels(),
      canPrev:     this.#currentStep > 1,
      canNext:     this.#currentStep < 7 && stepValid,
      canFinish:   this.#currentStep === 7
                   && this.#name.trim().length > 0
                   && warnings.length === 0,
      hasGift,

      // Pas 1
      name:        this.#name,
      concept:     this.#concept,
      origin:      this.#origin,
      gender:      this.#gender,
      age:         this.#age,
      totalPoints: this.#totalPoints,

      // Pas 2 (espècie + cos + atributs)
      species:             this.#species,
      size:                this.#size,
      constitution:        this.#constitution,
      speciesOptions:      this._buildSpeciesOptions(),
      sizeOptions:         this._buildRangeOptions(CONFIG.FORJA.sizes,         CONFIG.FORJA.sizeCosts),
      constitutionOptions: this._buildRangeOptions(CONFIG.FORJA.constitutions, CONFIG.FORJA.constitutionCosts),
      attributeRows:       this._buildAttributeRows(),

      // Pas 3
      skillFilter:        this.#skillFilter,
      filteredSkills:     this._filterSkills(),
      selectedSkillCount: this.#selectedSkills.size,

      // Pas 4
      traitFilter:             this.#traitFilter,
      traitCategoryFilter:     this.#traitCategoryFilter,
      traitCategories:         this._buildTraitCategoryOptions(),
      filteredTraits:          this._filterTraits(),
      selectedTraitCount:      this.#selectedTraits.size,
      incompatibilityWarnings: warnings,

      // Pas 5
      weaponFilter:     this.#weaponFilter,
      weaponTypeFilter: this.#weaponTypeFilter,
      armorFilter:      this.#armorFilter,
      artifactFilter:   this.#artifactFilter,
      filteredWeapons:  this._filterWeapons(autoWeapons),
      filteredArmors:   this._filterArmors(),
      filteredArtifacts: this._filterArtifacts(),
      autoWeapons:      autoWeapons.map(doc => ({ id: doc.id, name: doc.name })),
      selectedWeaponCount:   this.#selectedWeapons.size,
      selectedArmorCount:    this.#selectedArmors.size,
      selectedArtifactCount: this.#selectedArtifacts.size,

      // Pas 6
      effectFilter:     this.#effectFilter,
      filteredEffects:  this._filterEffects(),
      selectedEffectCount: this.#selectedEffects.size,

      // Pas 7 (resum)
      summarySkills: Array.from(this.#selectedSkills.values()).map(({ doc, level }) => ({
        name: doc.name,
        level,
        cost: CONFIG.FORJA.skillCostTable[level] ?? 0
      })),
      summaryTraits: Array.from(this.#selectedTraits.values()).map(({ doc, level, variantCost }) => ({
        name: doc.name,
        isParametric: doc.system.isParametric,
        isVariable:   doc.system.isVariable,
        level,
        variantCost,
        computedCost: this._computeTraitCost(doc, level, variantCost)
      })),
      summaryWeapons: [
        ...autoWeapons.map(doc => ({ name: doc.name, isAuto: true })),
        ...[...this.#selectedWeapons].map(id => {
          const doc = this.#weaponDocs.find(d => d.id === id);
          return doc ? { name: doc.name, isAuto: false } : null;
        }).filter(Boolean)
      ],
      summaryArmors: [...this.#selectedArmors].map(id => {
        const doc = this.#armorDocs.find(d => d.id === id);
        return doc ? { name: doc.name } : null;
      }).filter(Boolean),
      summaryArtifacts: [...this.#selectedArtifacts].map(id => {
        const doc = this.#artifactDocs.find(d => d.id === id);
        return doc ? { name: doc.name, cost: doc.system.cost ?? 0 } : null;
      }).filter(Boolean),
      summaryEffects: [...this.#selectedEffects].map(id => {
        const doc = this.#effectDocs.find(d => d.id === id);
        return doc ? { name: doc.name, cost: doc.system.cost ?? 0 } : null;
      }).filter(Boolean),

      // Sempre visible
      costs,
      derived
    };
  }

  // ── Càrrega de compendiums ─────────────────────────────────────────────────

  async _loadCompendiumData() {
    const packs = {
      skills:               game.packs.get("forja.skills"),
      traits:               game.packs.get("forja.traits"),
      weapons:              game.packs.get("forja.weapons"),
      armor:                game.packs.get("forja.armor"),
      artifacts:            game.packs.get("forja.artifacts"),
      "supernatural-effects": game.packs.get("forja.supernatural-effects")
    };

    const sortByName = docs => docs.sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));

    if (packs.skills) {
      this.#skillDocs = sortByName(await packs.skills.getDocuments());
    } else console.warn("FORJA | Wizard: Pack 'forja.skills' no trobat");

    if (packs.traits) {
      this.#traitDocs = sortByName(await packs.traits.getDocuments());
    } else console.warn("FORJA | Wizard: Pack 'forja.traits' no trobat");

    if (packs.weapons) {
      this.#weaponDocs = sortByName(await packs.weapons.getDocuments());
    } else console.warn("FORJA | Wizard: Pack 'forja.weapons' no trobat");

    if (packs.armor) {
      this.#armorDocs = sortByName(await packs.armor.getDocuments());
    } else console.warn("FORJA | Wizard: Pack 'forja.armor' no trobat");

    if (packs.artifacts) {
      this.#artifactDocs = sortByName(await packs.artifacts.getDocuments());
    } else console.warn("FORJA | Wizard: Pack 'forja.artifacts' no trobat");

    if (packs["supernatural-effects"]) {
      this.#effectDocs = sortByName(await packs["supernatural-effects"].getDocuments());
    } else console.warn("FORJA | Wizard: Pack 'forja.supernatural-effects' no trobat");

    this.#dataLoaded = true;
  }

  // ── Càlculs de punts ───────────────────────────────────────────────────────

  _computeCosts() {
    const cfg = CONFIG.FORJA;

    const attributes = Object.values(this.#attributes)
      .reduce((sum, v) => sum + (cfg.attributeCosts[v] ?? 0), 0);

    const species      = cfg.speciesCosts[this.#species]           ?? 0;
    const size         = cfg.sizeCosts[this.#size]                 ?? 0;
    const constitution = cfg.constitutionCosts[this.#constitution] ?? 0;

    let skills = 0;
    for (const { level } of this.#selectedSkills.values()) {
      skills += cfg.skillCostTable[level] ?? 0;
    }

    let traits = 0;
    for (const { doc, level, variantCost } of this.#selectedTraits.values()) {
      traits += this._computeTraitCost(doc, level, variantCost);
    }

    let artifacts = 0;
    for (const id of this.#selectedArtifacts) {
      const doc = this.#artifactDocs.find(d => d.id === id);
      if (doc) artifacts += doc.system.cost ?? 0;
    }

    let effects = 0;
    for (const id of this.#selectedEffects) {
      const doc = this.#effectDocs.find(d => d.id === id);
      if (doc) effects += doc.system.cost ?? 0;
    }

    const spent     = attributes + species + size + constitution + skills + traits + artifacts + effects;
    const available = this.#totalPoints - spent;

    return {
      attributes, species, size, constitution, skills, traits, artifacts, effects,
      spent, available, isOver: available < 0
    };
  }

  _computeTraitCost(doc, level, variantCost) {
    const s = doc.system;
    if (s.isParametric && level > 0) return Math.round(s.baseCost + s.factorCost * level);
    if (s.isVariable && variantCost !== 0) return variantCost;
    return s.cost ?? 0;
  }

  _computeDerived() {
    const cfg     = CONFIG.FORJA;
    const agi     = this.#attributes.AGI;
    const forAttr = this.#attributes.FOR;
    return {
      defense:         agi + (cfg.sizeDefenseModifiers[this.#size] ?? 0),
      latency:         Math.max(1, 10 + this.#size - agi * 2),
      damageReduction: forAttr,
      reaction:        1,
      woundsMax:       this.#size * 6,
      fatigueMax:      this.#constitution * 6
    };
  }

  // ── Gift trait helpers ─────────────────────────────────────────────────────

  _hasGiftTrait() {
    const giftIds = Object.keys(CONFIG.FORJA.giftTypes);
    for (const { doc } of this.#selectedTraits.values()) {
      if (doc.system.category === "sobrenatural" && giftIds.includes(doc.system.traitId)) {
        return true;
      }
    }
    return false;
  }

  _getSelectedGiftTraitIds() {
    const giftIds = Object.keys(CONFIG.FORJA.giftTypes);
    const result = [];
    for (const { doc } of this.#selectedTraits.values()) {
      if (doc.system.category === "sobrenatural" && giftIds.includes(doc.system.traitId)) {
        result.push(doc.system.traitId);
      }
    }
    return result;
  }

  // ── Armes automàtiques per habilitats ─────────────────────────────────────

  _computeAutoWeapons() {
    const hasMartial = this.#selectedSkills.has("arts-marcials");
    const hasBrawl   = this.#selectedSkills.has("barallar-se");
    if (!hasMartial && !hasBrawl) return [];
    return this.#weaponDocs.filter(doc => {
      const at = doc.system.attackType;
      return (at === "martial" && hasMartial) || (at === "brawl" && hasBrawl);
    });
  }

  // ── Constructors d'opcions per a la plantilla ──────────────────────────────

  _buildSpeciesOptions() {
    const cfg = CONFIG.FORJA;
    return Object.entries(cfg.species).map(([key, i18nKey]) => ({
      key,
      label:    game.i18n.localize(i18nKey),
      cost:     cfg.speciesCosts[key] ?? 0,
      selected: key === this.#species
    }));
  }

  _buildRangeOptions(labelsCfg, costsCfg) {
    return Object.entries(labelsCfg).map(([k, i18nKey]) => ({
      value: Number(k),
      label: game.i18n.localize(i18nKey),
      cost:  costsCfg[k] ?? 0
    }));
  }

  _buildAttributeRows() {
    const cfg = CONFIG.FORJA;
    return Object.entries(cfg.attributes).map(([key, i18nKey]) => ({
      key,
      label: game.i18n.localize(i18nKey),
      value: this.#attributes[key],
      cost:  cfg.attributeCosts[this.#attributes[key]] ?? 0,
      atMin: this.#attributes[key] <= 0,
      atMax: this.#attributes[key] >= 5
    }));
  }

  _buildTraitCategoryOptions() {
    const cfg = CONFIG.FORJA;
    return [
      { key: "all", label: game.i18n.localize("FORJA.Wizard.AllCategories") },
      ...Object.entries(cfg.traitCategories).map(([key, i18nKey]) => ({
        key,
        label: game.i18n.localize(i18nKey)
      }))
    ];
  }

  _getStepLabels() {
    const hasGift = this._hasGiftTrait();
    const steps = [
      { k: "Concept",      step: 1 },
      { k: "Body",         step: 2 },
      { k: "Skills",       step: 3 },
      { k: "Traits",       step: 4 },
      { k: "Equipment",    step: 5 },
      { k: "Supernatural", step: 6, skippable: true },
      { k: "Summary",      step: 7 }
    ];
    return steps.map(({ k, step, skippable }) => ({
      step,
      label:   game.i18n.localize(`FORJA.Wizard.Step.${k}`),
      active:  this.#currentStep === step,
      done:    this.#currentStep > step,
      skipped: !!(skippable && !hasGift)
    }));
  }

  // ── Navegació amb salt de pas 6 ────────────────────────────────────────────

  _getNextStep() {
    if (this.#currentStep === 5 && !this._hasGiftTrait()) return 7;
    return Math.min(7, this.#currentStep + 1);
  }

  _getPrevStep() {
    if (this.#currentStep === 7 && !this._hasGiftTrait()) return 5;
    return Math.max(1, this.#currentStep - 1);
  }

  // ── Filtres de llistes ─────────────────────────────────────────────────────

  _filterSkills() {
    const filter = this.#skillFilter.toLowerCase();
    return this.#skillDocs
      .filter(doc => !filter || doc.name.toLowerCase().includes(filter))
      .map(doc => {
        const selected = this.#selectedSkills.get(doc.system.skillId);
        const level    = selected?.level ?? 0;
        return {
          skillId:          doc.system.skillId,
          name:             doc.name,
          relatedAttribute: doc.system.relatedAttribute,
          maxLevel:         doc.system.maxLevel,
          isSelected:       !!selected,
          level,
          cost: CONFIG.FORJA.skillCostTable[level] ?? 0
        };
      });
  }

  _filterTraits() {
    const filter    = this.#traitFilter.toLowerCase();
    const catFilter = this.#traitCategoryFilter;

    return this.#traitDocs
      .filter(doc => {
        if (filter && !doc.name.toLowerCase().includes(filter)) return false;
        if (catFilter !== "all" && doc.system.category !== catFilter) return false;
        return true;
      })
      .map(doc => {
        const s           = doc.system;
        const selected    = this.#selectedTraits.get(s.traitId);
        const level       = selected?.level ?? 0;
        const variantCost = selected?.variantCost ?? 0;
        const isForbidden   = s.forbiddenSpecies?.includes(this.#species) ?? false;
        const isIncompatible = !selected && this._isTraitIncompatible(s.traitId);

        return {
          traitId:      s.traitId,
          name:         doc.name,
          traitType:    s.traitType,
          category:     s.category,
          isParametric: s.isParametric,
          factorCost:   s.factorCost,
          maxLevel:     s.maxLevel || 1,
          isVariable:   s.isVariable,
          isSelected:   !!selected,
          level,
          variantCost,
          computedCost: selected ? this._computeTraitCost(doc, level, variantCost) : (s.cost ?? 0),
          displayCost:  s.isParametric
                          ? `${s.baseCost}+${s.factorCost}×n`
                          : s.isVariable ? "variable" : `${s.cost ?? 0} PC`,
          isForbidden,
          isIncompatible,
          canAdd: !isForbidden && !isIncompatible && !selected
        };
      });
  }

  _filterWeapons(autoWeapons) {
    const filter     = this.#weaponFilter.toLowerCase();
    const typeFilter = this.#weaponTypeFilter;
    const autoIds    = new Set((autoWeapons ?? this._computeAutoWeapons()).map(d => d.id));

    return this.#weaponDocs
      .filter(doc => {
        if (autoIds.has(doc.id)) return false; // mostrades apart
        if (filter && !doc.name.toLowerCase().includes(filter)) return false;
        if (typeFilter !== "all" && doc.system.weaponType !== typeFilter) return false;
        return true;
      })
      .map(doc => ({
        id:         doc.id,
        name:       doc.name,
        weaponType: doc.system.weaponType,
        attackType: doc.system.attackType,
        isSelected: this.#selectedWeapons.has(doc.id)
      }));
  }

  _filterArmors() {
    const filter = this.#armorFilter.toLowerCase();
    return this.#armorDocs
      .filter(doc => !filter || doc.name.toLowerCase().includes(filter))
      .map(doc => ({
        id:         doc.id,
        name:       doc.name,
        isSelected: this.#selectedArmors.has(doc.id)
      }));
  }

  _filterArtifacts() {
    const filter = this.#artifactFilter.toLowerCase();
    return this.#artifactDocs
      .filter(doc => !filter || doc.name.toLowerCase().includes(filter))
      .map(doc => ({
        id:         doc.id,
        name:       doc.name,
        cost:       doc.system.cost ?? 0,
        isSelected: this.#selectedArtifacts.has(doc.id)
      }));
  }

  _filterEffects() {
    const filter  = this.#effectFilter.toLowerCase();
    const giftIds = this._getSelectedGiftTraitIds();

    return this.#effectDocs
      .filter(doc => {
        if (filter && !doc.name.toLowerCase().includes(filter)) return false;
        const rg = doc.system.requiredGift;
        if (rg && !giftIds.includes(rg)) return false;
        return true;
      })
      .map(doc => ({
        id:           doc.id,
        name:         doc.name,
        requiredGift: doc.system.requiredGift,
        cost:         doc.system.cost ?? 0,
        isSelected:   this.#selectedEffects.has(doc.id)
      }));
  }

  _isTraitIncompatible(traitId) {
    for (const { doc } of this.#selectedTraits.values()) {
      if (doc.system.incompatibleWith?.includes(traitId)) return true;
    }
    const thisDoc = this.#traitDocs.find(d => d.system.traitId === traitId);
    if (thisDoc) {
      for (const incompId of thisDoc.system.incompatibleWith ?? []) {
        if (this.#selectedTraits.has(incompId)) return true;
      }
    }
    return false;
  }

  _computeIncompatibilityWarnings() {
    const warnings = [];
    const seen = new Set();

    for (const [traitId, { doc }] of this.#selectedTraits) {
      for (const incompId of doc.system.incompatibleWith ?? []) {
        if (this.#selectedTraits.has(incompId)) {
          const key = [traitId, incompId].sort().join("||");
          if (!seen.has(key)) {
            seen.add(key);
            const other = this.#selectedTraits.get(incompId)?.doc;
            warnings.push({ type: "incompatible", trait1: doc.name, trait2: other?.name ?? incompId });
          }
        }
      }
      if (doc.system.forbiddenSpecies?.includes(this.#species)) {
        warnings.push({
          type: "species",
          trait1: doc.name,
          speciesLabel: game.i18n.localize(CONFIG.FORJA.species[this.#species] ?? this.#species)
        });
      }
    }

    return warnings;
  }

  // ── Validació ──────────────────────────────────────────────────────────────

  _validateCurrentStep(warnings) {
    switch (this.#currentStep) {
      case 1: return this.#name.trim().length > 0;
      case 4: return (warnings ?? this._computeIncompatibilityWarnings()).length === 0;
      default: return true;
    }
  }

  // ── Render hook ────────────────────────────────────────────────────────────

  _onRender(context, options) {
    // Attach 'input' listeners to filter text fields for live search
    for (const input of this.element.querySelectorAll("input[data-live-filter]")) {
      input.addEventListener("input", event => this._onChangeForm({}, event));
    }
    // Attach 'change' listeners to number inputs (level, variantCost, totalPoints)
    // in case ApplicationV2 doesn't catch them without a <form> element
    for (const input of this.element.querySelectorAll("input[type='number']")) {
      input.addEventListener("change", event => this._onChangeForm({}, event));
    }
  }

  // ── Gestió del formulari ───────────────────────────────────────────────────

  _onChangeForm(formConfig, event) {
    const { name, value } = event.target ?? {};
    if (!name) return;

    switch (true) {
      case name === "wizard-name":            this.#name = value; break;
      case name === "wizard-concept":         this.#concept = value; break;
      case name === "wizard-origin":          this.#origin = value; break;
      case name === "wizard-gender":          this.#gender = value; break;
      case name === "wizard-age":             this.#age = parseInt(value) || 0; break;
      case name === "wizard-totalPoints":     this.#totalPoints = Math.max(0, parseInt(value) || 100); break;
      case name === "wizard-species":         this.#species = value; break;
      case name === "wizard-size":            this.#size = parseInt(value); break;
      case name === "wizard-constitution":    this.#constitution = parseInt(value); break;
      case name === "wizard-skill-filter":    this.#skillFilter = value; break;
      case name === "wizard-trait-filter":    this.#traitFilter = value; break;
      case name === "wizard-trait-category":  this.#traitCategoryFilter = value; break;
      case name === "wizard-weapon-filter":   this.#weaponFilter = value; break;
      case name === "wizard-weapon-type":     this.#weaponTypeFilter = value; break;
      case name === "wizard-armor-filter":    this.#armorFilter = value; break;
      case name === "wizard-artifact-filter": this.#artifactFilter = value; break;
      case name === "wizard-effect-filter":   this.#effectFilter = value; break;

      case name.startsWith("wizard-skill-level-"): {
        const skillId = name.slice("wizard-skill-level-".length);
        const entry = this.#selectedSkills.get(skillId);
        if (entry) {
          const max = entry.doc.system.maxLevel ?? 5;
          this.#selectedSkills.set(skillId, { ...entry, level: Math.clamp(parseInt(value) || 1, 1, max) });
        }
        break;
      }

      case name.startsWith("wizard-trait-level-"): {
        const traitId = name.slice("wizard-trait-level-".length);
        const entry = this.#selectedTraits.get(traitId);
        if (entry) {
          const max = entry.doc.system.maxLevel || 10;
          this.#selectedTraits.set(traitId, { ...entry, level: Math.clamp(parseInt(value) || 1, 1, max) });
        }
        break;
      }

      case name.startsWith("wizard-trait-variantcost-"): {
        const traitId = name.slice("wizard-trait-variantcost-".length);
        const entry = this.#selectedTraits.get(traitId);
        if (entry) {
          this.#selectedTraits.set(traitId, { ...entry, variantCost: parseInt(value) || 0 });
        }
        break;
      }
    }

    this.render();
  }

  // ── Accions estàtiques ─────────────────────────────────────────────────────

  static _onNextStep(event, target) {
    if (this.#currentStep >= 7) return;
    if (!this._validateCurrentStep()) return;
    this.#currentStep = this._getNextStep();
    this.render();
  }

  static _onPrevStep(event, target) {
    if (this.#currentStep <= 1) return;
    this.#currentStep = this._getPrevStep();
    this.render();
  }

  static _onGoToStep(event, target) {
    const step = parseInt(target.dataset.step);
    if (isNaN(step) || step < 1 || step >= this.#currentStep) return;
    this.#currentStep = step;
    this.render();
  }

  // Atributs: botons + i -
  static _onAttrDec(event, target) {
    const key = target.dataset.attrKey;
    if (key && key in this.#attributes) {
      this.#attributes[key] = Math.max(0, this.#attributes[key] - 1);
      this.render();
    }
  }

  static _onAttrInc(event, target) {
    const key = target.dataset.attrKey;
    if (key && key in this.#attributes) {
      this.#attributes[key] = Math.min(5, this.#attributes[key] + 1);
      this.render();
    }
  }

  // Habilitats
  static _onAddSkill(event, target) {
    const skillId = target.dataset.skillId;
    if (!skillId || this.#selectedSkills.has(skillId)) return;
    const doc = this.#skillDocs.find(d => d.system.skillId === skillId);
    if (!doc) return;
    this.#selectedSkills.set(skillId, { doc, level: 1 });
    this.render();
  }

  static _onRemoveSkill(event, target) {
    const skillId = target.dataset.skillId;
    if (skillId) { this.#selectedSkills.delete(skillId); this.render(); }
  }

  // Trets
  static _onAddTrait(event, target) {
    const traitId = target.dataset.traitId;
    if (!traitId || this.#selectedTraits.has(traitId)) return;
    const doc = this.#traitDocs.find(d => d.system.traitId === traitId);
    if (!doc) return;

    if (doc.system.forbiddenSpecies?.includes(this.#species)) {
      ui.notifications.warn(
        game.i18n.format("FORJA.Wizard.TraitForbiddenForSpecies", {
          trait:   doc.name,
          species: game.i18n.localize(CONFIG.FORJA.species[this.#species] ?? this.#species)
        })
      );
      return;
    }

    const level = doc.system.isParametric ? 1 : 0;
    this.#selectedTraits.set(traitId, { doc, level, variantCost: 0 });
    this.render();
  }

  static _onRemoveTrait(event, target) {
    const traitId = target.dataset.traitId;
    if (traitId) { this.#selectedTraits.delete(traitId); this.render(); }
  }

  // Armes
  static _onAddWeapon(event, target) {
    const id = target.dataset.weaponId;
    if (id) { this.#selectedWeapons.add(id); this.render(); }
  }

  static _onRemoveWeapon(event, target) {
    const id = target.dataset.weaponId;
    if (id) { this.#selectedWeapons.delete(id); this.render(); }
  }

  // Armadures
  static _onAddArmor(event, target) {
    const id = target.dataset.armorId;
    if (id) { this.#selectedArmors.add(id); this.render(); }
  }

  static _onRemoveArmor(event, target) {
    const id = target.dataset.armorId;
    if (id) { this.#selectedArmors.delete(id); this.render(); }
  }

  // Artefactes
  static _onAddArtifact(event, target) {
    const id = target.dataset.artifactId;
    if (id) { this.#selectedArtifacts.add(id); this.render(); }
  }

  static _onRemoveArtifact(event, target) {
    const id = target.dataset.artifactId;
    if (id) { this.#selectedArtifacts.delete(id); this.render(); }
  }

  // Efectes sobrenaturals
  static _onAddEffect(event, target) {
    const id = target.dataset.effectId;
    if (id) { this.#selectedEffects.add(id); this.render(); }
  }

  static _onRemoveEffect(event, target) {
    const id = target.dataset.effectId;
    if (id) { this.#selectedEffects.delete(id); this.render(); }
  }

  // Creació final
  static async _onCreateCharacter(event, target) {
    if (!this.#name.trim()) {
      ui.notifications.error(game.i18n.localize("FORJA.Wizard.NameRequired"));
      return;
    }
    if (this._computeIncompatibilityWarnings().length > 0) {
      ui.notifications.error(game.i18n.localize("FORJA.Wizard.ResolveWarnings"));
      return;
    }

    const btn = this.element?.querySelector("[data-action='createCharacter']");
    if (btn) btn.disabled = true;

    try {
      const actor = await Actor.create({
        name: this.#name.trim(),
        type: "character",
        system: {
          species:      this.#species,
          size:         this.#size,
          constitution: this.#constitution,
          totalPoints:  this.#totalPoints,
          concept:      this.#concept,
          origin:       this.#origin,
          gender:       this.#gender,
          age:          this.#age,
          attributes: {
            FOR: { value: this.#attributes.FOR },
            DES: { value: this.#attributes.DES },
            AGI: { value: this.#attributes.AGI },
            PER: { value: this.#attributes.PER },
            INT: { value: this.#attributes.INT },
            APL: { value: this.#attributes.APL }
          }
        }
      }, { skipWizard: true, renderSheet: false });

      if (!actor) throw new Error("Actor.create() ha retornat null");

      const items = this._buildItemsToCreate();
      if (items.length) await actor.createEmbeddedDocuments("Item", items);

      actor.sheet.render(true);
      ui.notifications.info(game.i18n.format("FORJA.Wizard.Created", { name: actor.name }));
      this.close();
    } catch (e) {
      console.error("FORJA | Error al wizard de creació:", e);
      ui.notifications.error(`FORJA: ${e.message}`);
      if (btn) btn.disabled = false;
    }
  }

  // ── Construcció dels items a crear ─────────────────────────────────────────

  _buildItemsToCreate() {
    const items = [];

    // Habilitats seleccionades
    for (const { doc, level } of this.#selectedSkills.values()) {
      const data = doc.toObject();
      data.system.level = level;
      delete data._id;
      items.push(data);
    }

    // Trets seleccionats
    for (const { doc, level, variantCost } of this.#selectedTraits.values()) {
      const data = doc.toObject();
      if (doc.system.isParametric) data.system.level = level;
      if (doc.system.isVariable)   data.system.variantCost = variantCost;
      delete data._id;
      items.push(data);
    }

    // Armes automàtiques (de skills arts-marcials / barallar-se)
    const autoWeapons = this._computeAutoWeapons();
    const autoIds = new Set(autoWeapons.map(d => d.id));
    for (const doc of autoWeapons) {
      const data = doc.toObject();
      delete data._id;
      items.push(data);
    }

    // Armes seleccionades manualment (evita duplicats amb auto)
    for (const id of this.#selectedWeapons) {
      if (autoIds.has(id)) continue;
      const doc = this.#weaponDocs.find(d => d.id === id);
      if (!doc) continue;
      const data = doc.toObject();
      delete data._id;
      items.push(data);
    }

    // Armadures
    for (const id of this.#selectedArmors) {
      const doc = this.#armorDocs.find(d => d.id === id);
      if (!doc) continue;
      const data = doc.toObject();
      delete data._id;
      items.push(data);
    }

    // Artefactes
    for (const id of this.#selectedArtifacts) {
      const doc = this.#artifactDocs.find(d => d.id === id);
      if (!doc) continue;
      const data = doc.toObject();
      delete data._id;
      items.push(data);
    }

    // Efectes sobrenaturals
    for (const id of this.#selectedEffects) {
      const doc = this.#effectDocs.find(d => d.id === id);
      if (!doc) continue;
      const data = doc.toObject();
      delete data._id;
      items.push(data);
    }

    return items;
  }
}
