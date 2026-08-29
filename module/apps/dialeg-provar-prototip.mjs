const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Diàleg de prova d'ús d'un prototip d'artefacte (S-30): el manual no fixa
 * quin atribut/habilitat és "el pertinent" per a cada artefacte (varia
 * segons què sigui), així que es deixa triar aquí (DA-5) — mateix criteri
 * que `DiategManifestar` deixant la dificultat editable a mà.
 */
export default class DiategProvarPrototip extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "forja-dialeg-provar-prototip",
    classes: ["forja", "forja-dialog", "dialeg-provar-prototip"],
    tag: "form",
    position: { width: 380 },
    window: { resizable: false },
    form: { closeOnSubmit: true, handler: DiategProvarPrototip._onSubmit }
  };

  static PARTS = {
    form: { template: "systems/forja/templates/actor/dialeg-provar-prototip.hbs" }
  };

  #config  = null;
  #resolve = null;
  #atribut = "APL";
  #habId   = "";

  constructor(config, options = {}) {
    super(options);
    this.#config = config;
  }

  get title() {
    return game.i18n.format("FORJA.Artefacte.ProvarPrototipTitol", { nom: this.#config?.nomArtefacte ?? "" });
  }

  async _prepareContext(options) {
    const c = this.#config;
    return {
      nomArtefacte: c.nomArtefacte,
      cost:         c.cost,
      atributs:     CONFIG.FORJA.ATRIBUTS,
      habilitats:   CONFIG.FORJA.LLISTA_HABILITATS,
      atribut:      this.#atribut,
      habId:        this.#habId
    };
  }

  async _onRender(context, options) {
    super._onRender?.(context, options);
    const el = this.element;
    el.querySelector("select[name='atribut']")?.addEventListener("change", ev => { this.#atribut = ev.target.value; });
    el.querySelector("select[name='habId']")?.addEventListener("change", ev => { this.#habId = ev.target.value; });
  }

  static async _onSubmit(event, form, formData) {
    const d = formData.object;
    this.#resolve?.({
      atribut:       d.atribut ?? this.#atribut,
      habId:         d.habId || null,
      modDaus:       parseInt(d.modDaus) || 0,
      modDificultat: parseInt(d.modDificultat) || 0
    });
  }

  async close(options = {}) {
    this.#resolve?.(null);
    return super.close(options);
  }

  static obrir(config) {
    return new Promise(resolve => {
      const dlg = new DiategProvarPrototip(config);
      dlg.#resolve = resolve;
      dlg.render(true);
    });
  }
}
