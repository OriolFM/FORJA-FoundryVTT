import ForjaActorBase from "./_base.mjs";

/**
 * Data model for Creatures (Criatura).
 */
export default class CreatureData extends ForjaActorBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      ...super.defineSchema(),
      notes: new fields.HTMLField({ initial: "" })
    };
  }
}
