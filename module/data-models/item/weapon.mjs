/**
 * Data model for Weapon items.
 * Ported from FORJAPP src/types/character.ts (CharacterWeapon) and src/data/equipment.ts
 */
export default class WeaponData extends foundry.abstract.TypeDataModel {

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      weaponType: new fields.StringField({
        required: true,
        initial: "melee",
        choices: ["natural", "melee", "ranged"]
      }),
      attackType: new fields.StringField({
        required: true,
        initial: "melee",
        choices: ["melee", "ranged", "natural", "brawl", "martial"]
      }),
      latencyMod: new fields.NumberField({ integer: true, initial: 0 }),
      reach: new fields.StringField({ initial: "" }),
      range: new fields.StringField({ initial: "" }),
      damage: new fields.StringField({ required: true, initial: "FOR+1" }),
      ammo: new fields.SchemaField({
        value: new fields.NumberField({ integer: true, min: 0, initial: 0 }),
        max: new fields.NumberField({ integer: true, min: 0, initial: 0 })
      }),
      special: new fields.StringField({ initial: "" }),
      quantity: new fields.NumberField({ integer: true, min: 1, initial: 1 }),
      equipped: new fields.BooleanField({ initial: false })
    };
  }
}
