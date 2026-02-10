/**
 * Data model for Armor items.
 * Ported from FORJAPP src/types/character.ts (CharacterArmor) and src/data/equipment.ts
 */
export default class ArmorData extends foundry.abstract.TypeDataModel {

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      protection: new fields.NumberField({ required: true, integer: true, min: 0, max: 10, initial: 0 }),
      latencyMod: new fields.NumberField({ integer: true, min: 0, initial: 0 }),
      sizeMod: new fields.StringField({ initial: "0" }),
      equipped: new fields.BooleanField({ initial: false })
    };
  }
}
