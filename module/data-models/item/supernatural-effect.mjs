/**
 * Data model for Supernatural Effect items.
 * Ported from FORJAPP src/types/character.ts (CharacterSupernaturalEffect)
 */
export default class SupernaturalEffectData extends foundry.abstract.TypeDataModel {

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      cost: new fields.NumberField({ integer: true, initial: 0 }),
      requiredGift: new fields.StringField({
        required: true,
        initial: "magus",
        choices: ["canalitzador", "magus", "psiquic", "qi"]
      }),
      activation: new fields.StringField({
        initial: "normal",
        choices: ["trivial", "normal", "complex", "ritual", "permanent"]
      }),
      difficulty: new fields.NumberField({ integer: true, min: 0, initial: 0 }),
      equilibriumCost: new fields.NumberField({ integer: true, min: 0, initial: 0 }),
      latencyMod: new fields.NumberField({ integer: true, initial: 0 }),
      range: new fields.StringField({
        initial: "",
        choices: ["", "touch", "short", "medium", "long", "extreme", "multiversal"]
      }),
      target: new fields.StringField({
        initial: "",
        choices: ["", "self", "individual", "area"]
      }),
      duration: new fields.StringField({
        initial: "",
        choices: ["", "instant", "scene", "sustained", "permanent"]
      }),
      damageValue: new fields.NumberField({ integer: true, initial: 0 }),
      damageType: new fields.StringField({ initial: "" }),
      healingValue: new fields.NumberField({ integer: true, initial: 0 }),
      protection: new fields.NumberField({ integer: true, initial: 0 }),
      skillBonus: new fields.ArrayField(new fields.SchemaField({
        skillId: new fields.StringField({ initial: "" }),
        bonus: new fields.NumberField({ integer: true, initial: 0 })
      })),
      statesApplied: new fields.ArrayField(new fields.SchemaField({
        stateId: new fields.StringField({ initial: "" }),
        value: new fields.NumberField({ integer: true, initial: 0 })
      })),
      traitsGranted: new fields.ArrayField(new fields.StringField()),
      mentalEffect: new fields.StringField({
        initial: "",
        choices: ["", "read", "project", "emotional", "suggestion", "control"]
      }),
      notes: new fields.StringField({ initial: "" })
    };
  }
}
