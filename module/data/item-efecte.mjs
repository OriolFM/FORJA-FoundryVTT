/**
 * DataModel per a Efectes sobrenaturals (S-25): plantilles de manifestació
 * dels quatre dons del catàleg del manual (cap. 4, "Plantilles d'efecte").
 *
 * Abast deliberat, mateix criteri que `item-artefacte.mjs` (S-24): els
 * paràmetres realment heterogenis d'un efecte (abast, objectius, durada,
 * àrea...) depenen del motor de paràmetres (S-23, encara no implementat)
 * per modelar-se de manera estructurada — es deixen dins el text de
 * `mecanica` perquè el DJ els apliqui manualment. Només es guarden
 * estructurats els camps que ja alimenten `manifestarEfecte` (S-21):
 * `dificultat` (precarrega el diàleg de manifestar) i `modLatencia`
 * (informatiu, encara no consumit automàticament — cap flux de temps
 * actiu llegeix `modLatencia` d'un efecte, a diferència de les armes).
 */
/**
 * Camps de construcció compartits per efectes i artefactes (Fase 2,
 * `progressio/construccio.mjs`): la llista de paràmetres (com al skill de
 * referència `forja-parametres`) i la dificultat i latència declarades. Amb
 * els paràmetres, el cost es pot recalcular i (Fase 3) el resultat de
 * l'efecte o l'artefacte s'aplica sol.
 * @param {typeof foundry.data.fields} fields
 */
export function campsConstruccio(fields) {
  return {
    parametres: new fields.ArrayField(new fields.ObjectField(), { initial: [] }),
    construccio: new fields.SchemaField({
      dificultatDeclarada: new fields.NumberField({ integer: true, initial: null, nullable: true }),
      latenciaDeclarada:   new fields.NumberField({ integer: true, initial: null, nullable: true }),
      permanent:           new fields.BooleanField({ initial: false })
    })
  };
}

export default class ItemEfecte extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      cost: new fields.NumberField({ integer: true, min: 0, initial: 0, nullable: false }),
      do: new fields.StringField({
        initial: "canalitzacio",
        choices: ["canalitzacio", "magia", "psi", "qi"]
      }),
      tipus: new fields.StringField({
        initial: "efecte",
        choices: ["efecte", "ritual"]
      }),
      // Mínim 0, no 1: la norma general del manual (p. 704) diu que la
      // dificultat d'un efecte no pot baixar d'1, però "L'armadura del
      // queloni" (efecte de Qi, reacció) es llista literalment amb
      // dificultat 0 — es respecta la dada real del catàleg per sobre de
      // la regla general.
      dificultat:  new fields.NumberField({ integer: true, min: 0, initial: 1, nullable: false }),
      modLatencia: new fields.NumberField({ integer: true, initial: 0, nullable: false }),
      us: new fields.SchemaField({
        narratiu: new fields.BooleanField({ initial: true }),
        actiu:    new fields.BooleanField({ initial: true })
      }),
      mecanica:   new fields.HTMLField({ initial: "" }),
      descripcio: new fields.HTMLField({ initial: "" }),
      ...campsConstruccio(fields)
    };
  }
}
