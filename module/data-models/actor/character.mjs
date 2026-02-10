import ForjaActorBase from "./_base.mjs";

/**
 * Data model for Player Characters (PJ).
 */
export default class CharacterData extends ForjaActorBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      ...super.defineSchema(),
      concept: new fields.StringField({ initial: "" }),
      origin: new fields.StringField({ initial: "" }),
      gender: new fields.StringField({ initial: "" }),
      age: new fields.NumberField({ integer: true, min: 0, initial: 0 }),
      resources: new fields.StringField({ initial: "" }),
      guanxi: new fields.StringField({ initial: "" }),
      notes: new fields.HTMLField({ initial: "" }),
      isFavoriteForPlay: new fields.BooleanField({ initial: false })
    };
  }
}
