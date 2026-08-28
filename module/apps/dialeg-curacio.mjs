const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Diàleg de curació (S-17): tria entre primers auxilis (dificultat 1) i
 * tractament mèdic (dificultat 2), i la pista de salut a guarir.
 */
export default class DiategCuracio extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "forja-dialeg-curacio",
    classes: ["forja", "forja-dialog", "dialeg-curacio"],
    tag: "form",
    position: { width: 380 },
    window: { resizable: false },
    form: { closeOnSubmit: true, handler: DiategCuracio._onSubmit }
  };

  static PARTS = {
    form: { template: "systems/forja/templates/combat/dialeg-curacio.hbs" }
  };

  #config  = null;
  #resolve = null;
  #tipus   = "primers-auxilis";
  #pista   = "ferides";

  constructor(config, options = {}) {
    super(options);
    this.#config = config;
    this.#pista  = config.pistaPerDefecte ?? "ferides";
  }

  get title() {
    return game.i18n.format("FORJA.Curacio.Titol", { nom: this.#config?.nomObjectiu ?? "" });
  }

  async _prepareContext(options) {
    const c = this.#config;
    const dificultat = this.#tipus === "tractament-medic" ? 2 : 1;
    return {
      nomGuaridor: c.nomGuaridor,
      nomObjectiu: c.nomObjectiu,
      habNom:      c.habNom,
      poolFinal:   c.poolFinal,
      tipus:       this.#tipus,
      pista:       this.#pista,
      dificultat
    };
  }

  async _onRender(context, options) {
    super._onRender?.(context, options);
    this.element.querySelectorAll("input[name='tipus']").forEach(radio => {
      radio.addEventListener("change", ev => { this.#tipus = ev.target.value; this.render(false); });
    });
    this.element.querySelectorAll("input[name='pista']").forEach(radio => {
      radio.addEventListener("change", ev => { this.#pista = ev.target.value; this.render(false); });
    });
  }

  static async _onSubmit(event, form, formData) {
    const d = formData.object;
    this.#resolve?.({ tipus: d.tipus ?? this.#tipus, pista: d.pista ?? this.#pista });
  }

  async close(options = {}) {
    this.#resolve?.(null);
    return super.close(options);
  }

  static obrir(config) {
    return new Promise(resolve => {
      const dlg = new DiategCuracio(config);
      dlg.#resolve = resolve;
      dlg.render(true);
    });
  }
}
