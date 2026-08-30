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
      descripcio: new fields.HTMLField({ initial: "" }),
      // S-30 (R+D d'artefactes, manual p. 592-604): estat de prototipatge.
      // "produccio" (per defecte, retrocompatible amb tots els artefactes
      // ja creats des del catàleg via S-19/S-24) es comporta exactament
      // com fins ara. Un artefacte dissenyat de nou amb el constructor
      // (`rd-artefactes.mjs`) neix en "prototip1": fràgil (una pífia el
      // "trenca"), fins que el DJ el marca manualment com a superat el
      // temps de prova — no hi ha cap temporitzador numèric al manual per
      // automatitzar aquest pas, vegeu `rd-artefactes.mjs`.
      fase: new fields.StringField({
        initial: "produccio",
        choices: ["prototip1", "prototip2", "produccio"]
      }),
      trencat: new fields.BooleanField({ initial: false }),
      // S-30 (artefactes modulars, manual p. 576-588): "cada mòdul agrupa
      // algunes de les característiques de l'artefacte... i té un cost en
      // punts determinat" — el manual no dona cap fórmula de quant "menys"
      // costa un mòdul respecte l'artefacte sencer ("acostumen a tenir un
      // cost baix", sense xifra), així que cada mòdul es construeix amb el
      // mateix motor de paràmetres que qualsevol altre artefacte (mode
      // `esArtefacte` del constructor, S-23) i el cost total de l'artefacte
      // modular és la suma del xassís (`cost`, de dalt) més tots els mòduls
      // instal·lats — vegeu `progressio/modular.mjs`.
      modular: new fields.BooleanField({ initial: false }),
      moduls: new fields.ArrayField(new fields.SchemaField({
        nom:         new fields.StringField({ initial: "" }),
        cost:        new fields.NumberField({ integer: true, min: 0, initial: 0, nullable: false }),
        dificultat:  new fields.NumberField({ integer: true, min: 0, initial: 0, nullable: false }),
        modLatencia: new fields.NumberField({ integer: true, initial: 0, nullable: false }),
        mecanica:    new fields.StringField({ initial: "" })
      }), { initial: [] })
    };
  }
}
