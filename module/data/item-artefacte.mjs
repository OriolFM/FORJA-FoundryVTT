/**
 * DataModel per a Artefactes (S-24): peces de tecnologia avançada del
 * catàleg del manual (cap. 4, "Plantilles d'artefacte").
 *
 * Abast deliberat ("dades estàtiques", 🟢 reaprofitable): cada artefacte és
 * mecànicament molt heterogeni (arma, armadura, dispositiu actiu, bonificació
 * permanent...) i depèn del motor de paràmetres d'efectes/artefactes (S-23,
 * encara no implementat) per automatitzar-se de veritat pel que fa als seus
 * EFECTES — el DJ els aplica manualment, com sempre. **S-26 n'és l'excepció:
 * la CÀRREGA sí que és prou senzilla i uniforme (consum/recàrrega d'un
 * comptador) per automatitzar-se sense el motor de paràmetres** — vegeu
 * `module/combat/artefactes.mjs` i els camps `carrega.actual`/
 * `carrega.tornsAcumulats` de sota.
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
        modeEspera:     new fields.BooleanField({ initial: false }),
        // S-26: estat mutable de càrrega real (l'usosPerCarrega/tornsRecarrega
        // de dalt són dades del catàleg, fixes). `actual` és `null` fins al
        // primer consum/recàrrega — es tracta com a "ple" (=usosPerCarrega)
        // fins llavors, per no haver de migrar els artefactes ja creats.
        actual:         new fields.NumberField({ integer: true, min: 0, initial: null, nullable: true }),
        tornsAcumulats: new fields.NumberField({ integer: true, min: 0, initial: 0, nullable: false })
      }),
      mecanica:   new fields.HTMLField({ initial: "" }),
      descripcio: new fields.HTMLField({ initial: "" })
    };
  }
}
