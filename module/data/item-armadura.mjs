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
      // Armadura equipada (contracte de l'ona 2, WP-B/WP-F/WP-G): només les
      // armadures equipades compten per protecció/latència (B2, B3, Q3). Els
      // lectors han de tractar un valor absent (items antics, pre-migració)
      // com a equipat: `system.equipada !== false`, mai `=== true`.
      equipada:     new fields.BooleanField({ initial: true }),
      egida: new fields.SchemaField({
        activa:        new fields.BooleanField({ initial: false }),
        absorcio:      new fields.NumberField({ integer: true, initial: 0, nullable: false }),
        tornsInactiva: new fields.NumberField({ integer: true, initial: 0, nullable: false })
      }),
      descripcio:   new fields.HTMLField({ initial: "" })
    };
  }
}
