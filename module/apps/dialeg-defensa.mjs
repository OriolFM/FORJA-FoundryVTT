const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Diàleg de defensa (S-13): quan es resol un atac contra un objectiu, el DJ
 * tria en nom seu com es defensa — passiva, activa (esquivar/parar, gasta
 * reacció) o blocar (gasta reacció, sense tirada, suma resistència).
 */
export default class DiategDefensa extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "forja-dialeg-defensa",
    classes: ["forja", "forja-dialog", "dialeg-defensa"],
    tag: "form",
    position: { width: 380 },
    window: { resizable: false },
    form: { closeOnSubmit: true, handler: DiategDefensa._onSubmit }
  };

  static PARTS = {
    form: { template: "systems/forja/templates/combat/dialeg-defensa.hbs" }
  };

  #config  = null;
  #resolve = null;
  #opcioId = null;

  constructor(config, options = {}) {
    super(options);
    this.#config = config;
    this.#opcioId = config.opcions.find(o => o.disponible)?.id ?? config.opcions[0]?.id ?? null;
  }

  get title() {
    return game.i18n.format("FORJA.Combat.DefensaTitol", { nom: this.#config?.nomDefensor ?? "" });
  }

  async _prepareContext(options) {
    const c = this.#config;
    return {
      nomAtacant:  c.nomAtacant,
      nomDefensor: c.nomDefensor,
      opcions:     c.opcions,
      opcioId:     this.#opcioId
    };
  }

  async _onRender(context, options) {
    super._onRender?.(context, options);
    this.element.querySelectorAll("input[name='opcioId']").forEach(radio => {
      radio.addEventListener("change", ev => {
        this.#opcioId = ev.target.value;
        this.render(false);
      });
    });
  }

  static async _onSubmit(event, form, formData) {
    const opcioId = formData.object.opcioId;
    const opcio = this.#config.opcions.find(o => o.id === opcioId);
    this.#resolve?.(opcio ?? null);
  }

  async close(options = {}) {
    this.#resolve?.(null);
    return super.close(options);
  }

  static obrir(config) {
    return new Promise(resolve => {
      const dlg = new DiategDefensa(config);
      dlg.#resolve = resolve;
      dlg.render(true);
    });
  }
}
