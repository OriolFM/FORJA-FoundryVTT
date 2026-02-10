/**
 * Base data model shared by all FORJA actor types.
 * Ported from FORJAPP src/types/character.ts and src/utils/calculations.ts
 */
export default class ForjaActorBase extends foundry.abstract.TypeDataModel {

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      // Species
      species: new fields.StringField({
        required: true,
        initial: "humanoid",
        choices: ["humanoid", "animal", "arthropod", "construct", "plant", "incorporeal", "mechanoid", "cephalopod"]
      }),

      // Physical characteristics
      size: new fields.NumberField({ required: true, integer: true, min: 1, max: 5, initial: 3 }),
      constitution: new fields.NumberField({ required: true, integer: true, min: 1, max: 5, initial: 3 }),

      // Primary attributes: FOR, DES, AGI, PER, INT, APL (0-5)
      attributes: new fields.SchemaField({
        FOR: new fields.SchemaField({
          value: new fields.NumberField({ required: true, integer: true, min: 0, max: 5, initial: 1 })
        }),
        DES: new fields.SchemaField({
          value: new fields.NumberField({ required: true, integer: true, min: 0, max: 5, initial: 1 })
        }),
        AGI: new fields.SchemaField({
          value: new fields.NumberField({ required: true, integer: true, min: 0, max: 5, initial: 1 })
        }),
        PER: new fields.SchemaField({
          value: new fields.NumberField({ required: true, integer: true, min: 0, max: 5, initial: 1 })
        }),
        INT: new fields.SchemaField({
          value: new fields.NumberField({ required: true, integer: true, min: 0, max: 5, initial: 1 })
        }),
        APL: new fields.SchemaField({
          value: new fields.NumberField({ required: true, integer: true, min: 0, max: 5, initial: 1 })
        })
      }),

      // Health tracking
      health: new fields.SchemaField({
        wounds: new fields.SchemaField({
          value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
          max: new fields.NumberField({ required: true, integer: true, min: 0, initial: 30 })
        }),
        fatigue: new fields.SchemaField({
          value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
          max: new fields.NumberField({ required: true, integer: true, min: 0, initial: 30 })
        })
      }),

      // Point buy
      totalPoints: new fields.NumberField({ required: true, integer: true, min: 0, initial: 100 }),

      // Equilibrium (supernatural resource)
      equilibrium: new fields.SchemaField({
        value: new fields.NumberField({ integer: true, min: 0, initial: 0 }),
        max: new fields.NumberField({ integer: true, min: 0, initial: 0 })
      }),

      // Biography/Notes (HTML)
      biography: new fields.HTMLField({ initial: "" })
    };
  }

  /**
   * Prepare derived data. Called after the data model is constructed.
   * Ports: calculateDefense, calculateLatency, calculateDamageReduction,
   *        calculateReaction, calculateMaxWounds, calculateMaxFatigue,
   *        calculateTotalProtection, calculateTotalSpent
   */
  prepareDerivedData() {
    const cfg = CONFIG.FORJA;
    if (!cfg) return;
    const attrs = this.attributes;

    // Max wounds = size × 10
    this.health.wounds.max = this.size * 10;

    // Max fatigue = constitution × 10
    this.health.fatigue.max = this.constitution * 10;

    // Defense = AGI + size defense modifier
    this.defense = attrs.AGI.value + (cfg.sizeDefenseModifiers[this.size] ?? 0);

    // Latency = max(1, 10 + size - AGI × 2 + armorLatencyMod)
    const armorLatencyMod = this._getArmorLatencyMod();
    this.latency = Math.max(1, 10 + this.size - (attrs.AGI.value * 2) + armorLatencyMod);

    // Damage reduction = FOR
    this.damageReduction = attrs.FOR.value;

    // Reaction = 1 base (modified by traits on the actor)
    this.reaction = this._calculateReaction();

    // Total protection from equipped armor, natural armor trait, and artifacts
    this.protection = this._calculateProtection();

    // Point costs
    this._calculatePoints();

    // Wound and fatigue levels
    this.woundLevel = this._getWoundLevel();
    this.fatigueLevel = this._getFatigueLevel();
  }

  /**
   * Get latency modifier from equipped armor.
   */
  _getArmorLatencyMod() {
    let mod = 0;
    const items = this.parent?.items;
    if (!items) return mod;
    for (const item of items) {
      if (item.type === "armor" && item.system.equipped) {
        mod += item.system.latencyMod ?? 0;
      }
    }
    return mod;
  }

  /**
   * Calculate reaction: 1 base + trait modifiers.
   * reflexos-rapids: +1, lent: -1
   */
  _calculateReaction() {
    let reaction = 1;
    const items = this.parent?.items;
    if (items) {
      for (const item of items) {
        if (item.type !== "trait") continue;
        const traitId = item.system.traitId;
        if (traitId === "reflexos-rapids") reaction += 1;
        if (traitId === "lent") reaction -= 1;
      }
    }
    return Math.max(0, reaction);
  }

  /**
   * Calculate total protection from equipped armor + natural armor trait + artifact protection.
   */
  _calculateProtection() {
    let protection = 0;
    const items = this.parent?.items;
    if (!items) return protection;

    for (const item of items) {
      if (item.type === "armor" && item.system.equipped) {
        protection += item.system.protection ?? 0;
      }
      if (item.type === "trait" && item.system.traitId === "armadura-natural") {
        protection += item.system.level ?? 0;
      }
      if (item.type === "artifact" && item.system.protection) {
        protection += item.system.protection;
      }
    }
    return protection;
  }

  /**
   * Calculate point costs for all categories.
   */
  _calculatePoints() {
    const cfg = CONFIG.FORJA;
    if (!cfg) return;
    const items = this.parent?.items;

    // Attribute costs
    let attributesCost = 0;
    for (const attr of Object.values(this.attributes)) {
      attributesCost += cfg.attributeCosts[attr.value] ?? 0;
    }

    // Species cost
    const speciesCost = cfg.speciesCosts[this.species] ?? 0;

    // Size cost
    const sizeCost = cfg.sizeCosts[this.size] ?? 0;

    // Constitution cost
    const constitutionCost = cfg.constitutionCosts[this.constitution] ?? 0;

    // Skills, traits, artifacts, effects costs from items
    let skillsCost = 0;
    let traitsCost = 0;
    let artifactsCost = 0;
    let effectsCost = 0;

    if (items) {
      for (const item of items) {
        switch (item.type) {
          case "skill":
            skillsCost += cfg.skillCostTable[item.system.level] ?? 0;
            break;
          case "trait":
            traitsCost += item.system.computedCost ?? 0;
            break;
          case "artifact":
            artifactsCost += item.system.cost ?? 0;
            break;
          case "supernaturalEffect":
            effectsCost += item.system.cost ?? 0;
            break;
        }
      }
    }

    this.spentPoints = attributesCost + speciesCost + sizeCost + constitutionCost
      + skillsCost + traitsCost + artifactsCost + effectsCost;
    this.availablePoints = this.totalPoints - this.spentPoints;

    // Store breakdown for the sheet
    this.pointBreakdown = {
      attributes: attributesCost,
      species: speciesCost,
      size: sizeCost,
      constitution: constitutionCost,
      skills: skillsCost,
      traits: traitsCost,
      artifacts: artifactsCost,
      effects: effectsCost
    };
  }

  /**
   * Determine wound level from current wounds vs max.
   */
  _getWoundLevel() {
    const { value, max } = this.health.wounds;
    if (max === 0 || value === 0) return "illes";
    const ratio = value / max;
    if (ratio >= 0.84) return "incapacitat";
    if (ratio >= 0.67) return "critic";
    if (ratio >= 0.51) return "malferit";
    if (ratio >= 0.34) return "ferit";
    if (ratio >= 0.17) return "nafrat";
    if (ratio > 0) return "masegat";
    return "illes";
  }

  /**
   * Determine fatigue level from current fatigue vs max.
   */
  _getFatigueLevel() {
    const { value, max } = this.health.fatigue;
    if (max === 0 || value === 0) return "reposat";
    const ratio = value / max;
    if (ratio >= 0.84) return "inconscient";
    if (ratio >= 0.67) return "rebentat";
    if (ratio >= 0.51) return "exhaurit";
    if (ratio >= 0.34) return "defallit";
    if (ratio >= 0.17) return "cansat";
    if (ratio > 0) return "afeblit";
    return "reposat";
  }
}
