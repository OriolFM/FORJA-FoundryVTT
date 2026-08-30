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
  #puntsDeclarats = 1;

  constructor(config, options = {}) {
    super(options);
    this.#config = config;
    this.#pista  = config.pistaPerDefecte ?? "ferides";
    this.#puntsDeclarats = Math.max(1, config.marcatsPerDefecte ?? 1);
  }

  get title() {
    return game.i18n.format("FORJA.Curacio.Titol", { nom: this.#config?.nomObjectiu ?? "" });
  }

  async _prepareContext(options) {
    const c = this.#config;
    // Mecanoides (manual p. 1138): dificultat = 2 + punts declarats a
    // reparar, no la dificultat fixa 1/2 de primers auxilis/tractament
    // mèdic (que només s'aplica a espècies orgàniques).
    const dificultat = c.esMecanoide
      ? 2 + this.#puntsDeclarats
      : (this.#tipus === "tractament-medic" ? 2 : 1);
    return {
      nomGuaridor: c.nomGuaridor,
      nomObjectiu: c.nomObjectiu,
      habNom:      c.habNom,
      poolFinal:   c.poolFinal,
      esMecanoide: c.esMecanoide,
      marcatsPista: c.marcatsPerPista?.[this.#pista] ?? 0,
      puntsDeclarats: this.#puntsDeclarats,
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
      radio.addEventListener("change", ev => {
        this.#pista = ev.target.value;
        this.#puntsDeclarats = Math.max(1, this.#config.marcatsPerPista?.[this.#pista] ?? 1);
        this.render(false);
      });
    });
    this.element.querySelector("input[name='puntsDeclarats']")?.addEventListener("input", ev => {
      this.#puntsDeclarats = Math.max(0, parseInt(ev.target.value) || 0);
      this.render(false);
    });
  }

  static async _onSubmit(event, form, formData) {
    const d = formData.object;
    this.#resolve?.({
      tipus: d.tipus ?? this.#tipus,
      pista: d.pista ?? this.#pista,
      puntsDeclarats: this.#puntsDeclarats
    });
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
