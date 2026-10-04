import { campsBase } from "./_camps.mjs";
import { _prepararDerivats } from "./actor-personatge.mjs";

/**
 * DataModel per a PNJ. Mateix motor de derivats que el personatge;
 * camps addicionals específics de PNJ.
 */
export default class ActorPNJ extends foundry.abstract.TypeDataModel {

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      ...campsBase(fields),
      // Classificació narrativa (manual, cap. 6: PNJ -figurant/antagonista/nèmesi-,
      // o Animal/Criatura — mecànicament tots comparteixen el mateix motor;
      // només els figurants tendeixen a fugir/rendir-se després d'un primer impacte).
      tier: new fields.StringField({
        initial: "extra",
        choices: ["extra", "antagonista", "nemesis", "criatura", "animal"]
      }),
      // Defensa automàtica (petició de l'Oriol FM, 2026-09-27): per als PNJ que
      // no mereixen un diàleg cada cop (sobretot figurants), el DJ pot fixar com
      // es defensen. "" = pregunta-ho al DJ amb un diàleg (per defecte).
      // "millor" = l'esquiva o parada amb més daus si té reacció; si no, passiva.
      defensaAutomatica: new fields.StringField({
        initial: "",
        blank: true,
        choices: ["", "passiva", "millor", "esquivar", "parar", "blocar"]
      }),
      notes: new fields.HTMLField({ initial: "" })
    };
  }

  /** @override */
  prepareDerivedData() {
    _prepararDerivats(this);
  }
}
