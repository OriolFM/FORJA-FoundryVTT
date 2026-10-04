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
      // Rang limitat (manual p. 725-731): per a armes improvisades a
      // distància, mecàniques (arcs/fones) i llancívoles, el rang curt no
      // és un valor fix sinó "la FOR del personatge" ×1/×3/×5 — `abast`
      // es queda a 0 (variable) i aquest multiplicador ho fa calculable
      // (vegeu `combat/abast.mjs`). 0 = no aplica (rang fix o cos a cos).
      rangMultFor:  new fields.NumberField({ integer: true, initial: 0, nullable: false }),
      // Blocar (manual p. 815): amb escut fa servir armes cos a cos, no
      // resistència — vegeu `combat/defensa.mjs`.
      esEscut:      new fields.BooleanField({ initial: false }),
      danyBase:     new fields.StringField({ initial: "FOR" }),
      maniobra:     new fields.StringField({ initial: "" }),
      rangExtrem:   new fields.BooleanField({ initial: false }),
      basic:        new fields.BooleanField({ initial: false }),
      // Propietats de regla llegibles per màquina (WP-I, B13/B15): p. ex.
      // "escopeta" (poca penetració), "escut" (blocar amb armes cos a cos).
      // Vegeu module/combat/propietats.mjs.
      propietats:   new fields.ArrayField(new fields.StringField({ blank: false })),
      descripcio:   new fields.HTMLField({ initial: "" })
    };
  }
}
