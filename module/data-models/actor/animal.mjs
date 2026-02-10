import ForjaActorBase from "./_base.mjs";

/**
 * Data model for Animals.
 */
export default class AnimalData extends ForjaActorBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      ...super.defineSchema(),
      notes: new fields.HTMLField({ initial: "" })
    };
  }

  /** Animals default to 'animal' species. */
  static migrateData(source) {
    if (!source.species) source.species = "animal";
    return super.migrateData(source);
  }
}
