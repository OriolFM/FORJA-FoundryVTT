/**
 * DataModel per a Armes (S-18).
 * Aporta latència, abast i dany base a l'acció d'atac.
 */
export default class ItemArma extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      categoria:    new fields.StringField({
        initial: "cosAcos",
        choices: ["natural", "cosAcos", "distancia"]
      }),
      modLatencia:  new fields.NumberField({ integer: true, initial: 0, nullable: false }),
      abast:        new fields.NumberField({ integer: true, initial: 1, nullable: false }),
      danyBase:     new fields.StringField({ initial: "FOR" }),
      maniobra:     new fields.StringField({ initial: "" }),
      rangExtrem:   new fields.BooleanField({ initial: false }),
      basic:        new fields.BooleanField({ initial: false }),
      descripcio:   new fields.HTMLField({ initial: "" })
    };
  }
}
