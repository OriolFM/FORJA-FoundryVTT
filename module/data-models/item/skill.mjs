/**
 * Data model for Skill items.
 * Ported from FORJAPP src/types/character.ts (Skill, CharacterSkill)
 */
export default class SkillData extends foundry.abstract.TypeDataModel {

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      skillId: new fields.StringField({ required: true, initial: "" }),
      skillType: new fields.StringField({
        required: true,
        initial: "basic",
        choices: ["basic", "restricted"]
      }),
      relatedAttribute: new fields.StringField({
        required: true,
        initial: "FOR",
        choices: ["FOR", "DES", "AGI", "PER", "INT", "APL"]
      }),
      level: new fields.NumberField({ required: true, integer: true, min: 0, max: 10, initial: 0 }),
      maxLevel: new fields.NumberField({ integer: true, initial: 5 }),
      notes: new fields.StringField({ initial: "" })
    };
  }
}
