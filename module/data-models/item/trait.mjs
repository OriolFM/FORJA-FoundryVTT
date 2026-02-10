/**
 * Data model for Trait items.
 * Ported from FORJAPP src/types/character.ts (Trait, CharacterTrait)
 */
export default class TraitData extends foundry.abstract.TypeDataModel {

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      traitId: new fields.StringField({ required: true, initial: "" }),
      traitType: new fields.StringField({
        required: true,
        initial: "positive",
        choices: ["positive", "negative"]
      }),
      category: new fields.StringField({ initial: "general" }),
      cost: new fields.NumberField({ integer: true, initial: 0 }),
      isParametric: new fields.BooleanField({ initial: false }),
      baseCost: new fields.NumberField({ initial: 0 }),
      factorCost: new fields.NumberField({ initial: 0 }),
      maxLevel: new fields.NumberField({ integer: true, initial: 0 }),
      level: new fields.NumberField({ integer: true, min: 0, initial: 0 }),
      variantCost: new fields.NumberField({ integer: true, initial: 0 }),
      isVariable: new fields.BooleanField({ initial: false }),
      incompatibleWith: new fields.ArrayField(new fields.StringField()),
      forbiddenSpecies: new fields.ArrayField(new fields.StringField()),
      notes: new fields.StringField({ initial: "" })
    };
  }

  prepareDerivedData() {
    // Compute the effective cost for point calculations
    if (this.isParametric && this.level > 0) {
      this.computedCost = Math.round(this.baseCost + this.factorCost * this.level);
    } else if (this.isVariable && this.variantCost !== 0) {
      this.computedCost = this.variantCost;
    } else {
      this.computedCost = this.cost;
    }
  }
}
