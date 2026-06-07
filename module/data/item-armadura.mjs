/**
 * DataModel per a Armadures (S-18).
 * Aporta reducció de dany i modificador de latència; opcionalment ègida.
 */
export default class ItemArmadura extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      tipus:        new fields.StringField({
        initial: "fisica",
        choices: ["fisica", "flexible", "natural"]
      }),
      reduccio:     new fields.NumberField({ integer: true, initial: 0, nullable: false }),
      modLatencia:  new fields.NumberField({ integer: true, initial: 0, nullable: false }),
      egida: new fields.SchemaField({
        activa:        new fields.BooleanField({ initial: false }),
        absorcio:      new fields.NumberField({ integer: true, initial: 0, nullable: false }),
        tornsInactiva: new fields.NumberField({ integer: true, initial: 0, nullable: false })
      }),
      descripcio:   new fields.HTMLField({ initial: "" })
    };
  }
}
