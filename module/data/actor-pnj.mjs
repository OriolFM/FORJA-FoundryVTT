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
      // Tier narratiu del PNJ (per gestió de DJ)
      tier: new fields.StringField({
        initial: "extra",
        choices: ["extra", "antagonista", "nemesis"]
      }),
      notes: new fields.HTMLField({ initial: "" })
    };
  }

  /** @override */
  prepareDerivedData() {
    _prepararDerivats(this);
  }
}
