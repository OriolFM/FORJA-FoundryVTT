/**
 * DataModel per a Trets (S-04).
 * Un tret és un avantatge, desavantatge o habilitat especial
 * que el personatge compra amb PC i que té efectes mecànics.
 *
 * `efecte` (opcional) codifica l'efecte mecànic del tret sobre els stats
 * derivats de l'actor (aplicat a `_prepararDerivats`, actor-personatge.mjs):
 *   - `{ stat: "reaccionsMax", delta: 1 }` — suma `delta` a un stat derivat
 *     numèric (whitelist: reaccionsMax, latenciaBase, defensa, reduccioDany).
 *   - `{ flag: "ignoraPenalitzacioFerides" }` — activa un indicador booleà
 *     consultat explícitament al càlcul de derivats.
 * Un tret sense `efecte` (o `null`) és purament descriptiu — la majoria.
 */
export default class ItemTret extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      cost:      new fields.NumberField({ integer: true, initial: 0, nullable: false }),
      descripcio: new fields.HTMLField({ initial: "" }),
      efecte:    new fields.ObjectField({ required: false, nullable: true, initial: null })
    };
  }
}
