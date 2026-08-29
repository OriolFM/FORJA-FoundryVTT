const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Diàleg de resistència (S-21): quan es manifesta un efecte contra un
 * objectiu, el DJ tria en nom seu si resisteix (mental o físic, gasta
 * reacció) o no — mateix patró que `DiategDefensa` (S-13).
 */
export default class DiategResistir extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "forja-dialeg-resistir",
    classes: ["forja", "forja-dialog", "dialeg-resistir"],
    tag: "form",
    position: { width: 380 },
    window: { resizable: false },
    form: { closeOnSubmit: true, handler: DiategResistir._onSubmit }
  };

  static PARTS = {
    form: { template: "systems/forja/templates/combat/dialeg-resistir.hbs" }
  };

  #config  = null;
  #resolve = null;
  #opcioId = "cap";

  constructor(config, options = {}) {
    super(options);
    this.#config = config;
  }

  get title() {
    return game.i18n.format("FORJA.Sobrenatural.ResistirTitol", { nom: this.#config?.nomObjectiu ?? "" });
  }

  async _prepareContext(options) {
    const c = this.#config;
    return {
      nomActor:    c.nomActor,
      nomObjectiu: c.nomObjectiu,
      mental:      c.mental,
      fisic:       c.fisic,
      opcioId:     this.#opcioId
    };
  }

  async _onRender(context, options) {
    super._onRender?.(context, options);
    this.element.querySelectorAll("input[name='opcioId']").forEach(radio => {
      radio.addEventListener("change", ev => { this.#opcioId = ev.target.value; });
    });
  }

  static async _onSubmit(event, form, formData) {
    this.#resolve?.(formData.object.opcioId ?? this.#opcioId);
  }

  async close(options = {}) {
    this.#resolve?.(null);
    return super.close(options);
  }

  static obrir(config) {
    return new Promise(resolve => {
      const dlg = new DiategResistir(config);
      dlg.#resolve = resolve;
      dlg.render(true);
    });
  }
}
