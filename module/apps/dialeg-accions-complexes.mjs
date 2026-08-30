import { calcularGraons } from "../progressio/accions-complexes.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Calculadora d'accions complexes (S-08): purament informativa, no toca
 * cap actor ni document — vegeu `progressio/accions-complexes.mjs` per la
 * regla i per què no hi ha cap acció a "confirmar" aquí (DA-5: el DJ
 * decideix sempre a quin graó es queda, aquesta eina només mostra els
 * graons possibles).
 */
export default class DiategAccionsComplexes extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "forja-dialeg-accions-complexes",
    classes: ["forja", "forja-dialog", "dialeg-accions-complexes"],
    position: { width: 420 },
    window: { title: "FORJA.AccionsComplexes.Titol", resizable: true }
  };

  static PARTS = {
    form: { template: "systems/forja/templates/actor/dialeg-accions-complexes.hbs" }
  };

  #dificultatBase = 8;

  async _prepareContext(options) {
    return {
      dificultatBase: this.#dificultatBase,
      graons: calcularGraons(this.#dificultatBase)
    };
  }

  async _onRender(context, options) {
    super._onRender?.(context, options);
    this.element.querySelector("input[name='dificultatBase']")?.addEventListener("input", ev => {
      this.#dificultatBase = Math.max(1, parseInt(ev.target.value) || 1);
      this.render(false);
    });
  }

  static obrir() {
    return new DiategAccionsComplexes().render(true);
  }
}
