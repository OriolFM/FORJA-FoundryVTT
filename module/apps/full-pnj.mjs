import FullActorBase from "./full-actor-base.mjs";

/**
 * D1: fitxa de PNJ — mateix motor que la fitxa de Personatge (`FullActorBase`:
 * acordió, mode joc/edició, tirades, trets, equipament…), amb capçalera
 * pròpia (tier en lloc de concepte/origen/PC/PX) i sense millora amb PX.
 */
export default class FullPNJ extends FullActorBase {

  static DEFAULT_OPTIONS = {
    classes: ["forja", "full-pnj"]
  };

  static PARTS = {
    header: { template: "systems/forja/templates/actor/pnj-header.hbs" },
    body:   { template: "systems/forja/templates/actor/pnj-body.hbs" }
  };

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    return {
      ...ctx,
      tiers: ["extra", "antagonista", "nemesis", "criatura", "animal"],
      modesDefensa: ["", "passiva", "millor", "esquivar", "parar", "blocar"]
    };
  }
}
