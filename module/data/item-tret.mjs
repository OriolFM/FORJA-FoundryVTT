/**
 * DataModel per a Trets (S-04).
 * Un tret és un avantatge, desavantatge o habilitat especial
 * que el personatge compra amb PC i que té efectes mecànics.
 */
export default class ItemTret extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      cost:      new fields.NumberField({ integer: true, initial: 0, nullable: false }),
      descripcio: new fields.HTMLField({ initial: "" })
    };
  }
}
