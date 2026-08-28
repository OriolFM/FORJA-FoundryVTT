/**
 * DataModel per a Artefactes (S-24): peces de tecnologia avançada del
 * catàleg del manual (cap. 4, "Plantilles d'artefacte").
 *
 * Abast deliberat ("dades estàtiques", 🟢 reaprofitable): cada artefacte és
 * mecànicament molt heterogeni (arma, armadura, dispositiu actiu, bonificació
 * permanent...) i depèn del motor de paràmetres d'efectes/artefactes (S-23)
 * i de l'activació/càrrega (S-26) — cap dels dos implementat encara — per
 * automatitzar-se de veritat. Fins que hi siguin, aquest Item només desa i
 * mostra la informació del catàleg (cost, activació, ús, càrrega i el text
 * de regles/mecànica) perquè el DJ l'apliqui manualment; no calcula ni
 * aplica cap efecte per si sol.
 */
export default class ItemArtefacte extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      cost:      new fields.NumberField({ integer: true, min: 0, initial: 0, nullable: false }),
      categoria: new fields.StringField({
        initial: "dispositiu",
        choices: ["arma", "armadura", "dispositiu", "permanent"]
      }),
      activacio: new fields.SchemaField({
        tipus: new fields.StringField({
          initial: "normal",
          choices: ["cap", "trivial", "normal", "complexa", "permanent"]
        }),
        dificultat: new fields.NumberField({ integer: true, min: 0, initial: null, nullable: true })
      }),
      us: new fields.SchemaField({
        narratiu:    new fields.BooleanField({ initial: true }),
        actiu:       new fields.BooleanField({ initial: false }),
        modLatencia: new fields.NumberField({ integer: true, initial: 0, nullable: false })
      }),
      carrega: new fields.SchemaField({
        usosPerCarrega: new fields.NumberField({ integer: true, min: 0, initial: null, nullable: true }),
        tornsRecarrega: new fields.NumberField({ integer: true, min: 0, initial: null, nullable: true }),
        modeEspera:     new fields.BooleanField({ initial: false })
      }),
      mecanica:   new fields.HTMLField({ initial: "" }),
      descripcio: new fields.HTMLField({ initial: "" })
    };
  }
}
