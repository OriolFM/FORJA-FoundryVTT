import ForjaActorBase from "./_base.mjs";

/**
 * Data model for Non-Player Characters (PNJ).
 */
export default class NPCData extends ForjaActorBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      ...super.defineSchema(),
      concept: new fields.StringField({ initial: "" }),
      origin: new fields.StringField({ initial: "" }),
      notes: new fields.HTMLField({ initial: "" }),
      tier: new fields.StringField({
        initial: "antagonist",
        choices: ["nemesis", "antagonist", "extra"]
      })
    };
  }
}
