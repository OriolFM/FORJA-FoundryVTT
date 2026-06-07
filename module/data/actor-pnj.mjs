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
      notes: new fields.HTMLField({ initial: "" })
    };
  }

  /** @override */
  prepareDerivedData() {
    _prepararDerivats(this);
  }
}
