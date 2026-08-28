const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Diàleg de millora amb PX (S-28): tria entre pujar un atribut, pujar una
 * habilitat, afegir un tret positiu o treure un tret negatiu existent.
 */
export default class DiategMillora extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "forja-dialeg-millora",
    classes: ["forja", "forja-dialog", "dialeg-millora"],
    tag: "form",
    position: { width: 420 },
    window: { resizable: false },
    form: { closeOnSubmit: true, handler: DiategMillora._onSubmit }
  };

  static PARTS = {
    form: { template: "systems/forja/templates/actor/dialeg-millora.hbs" }
  };

  #config    = null;
  #resolve   = null;
  #categoria = "atribut";
  #attrId    = null;
  #habId     = null;
  #tretNegatiuId = null;

  constructor(config, options = {}) {
    super(options);
    this.#config = config;
    this.#attrId = config.atributs.find(a => a.cost != null)?.id ?? config.atributs[0]?.id ?? null;
    this.#habId  = config.habilitats.find(h => h.cost != null)?.id ?? config.habilitats[0]?.id ?? null;
    this.#tretNegatiuId = config.tretsNegatius[0]?.id ?? null;
  }

  get title() {
    return game.i18n.format("FORJA.Millora.Titol", { nom: this.#config?.nomActor ?? "" });
  }

  async _prepareContext(options) {
    const c = this.#config;
    return {
      nomActor:      c.nomActor,
      pxLliures:     c.pxLliures,
      atributs:      c.atributs,
      habilitats:    c.habilitats,
      tretsNegatius: c.tretsNegatius,
      categoria:     this.#categoria,
      attrId:        this.#attrId,
      habId:         this.#habId,
      tretNegatiuId: this.#tretNegatiuId
    };
  }

  async _onRender(context, options) {
    super._onRender?.(context, options);
    const el = this.element;

    el.querySelectorAll("input[name='categoria']").forEach(radio => {
      radio.addEventListener("change", ev => { this.#categoria = ev.target.value; this.render(false); });
    });
    el.querySelectorAll("input[name='attrId']").forEach(radio => {
      radio.addEventListener("change", ev => { this.#attrId = ev.target.value; });
    });
    el.querySelector("select[name='habId']")?.addEventListener("change", ev => { this.#habId = ev.target.value; });
    el.querySelectorAll("input[name='tretNegatiuId']").forEach(radio => {
      radio.addEventListener("change", ev => { this.#tretNegatiuId = ev.target.value; });
    });
  }

  static async _onSubmit(event, form, formData) {
    const d = formData.object;
    this.#resolve?.({
      categoria:     d.categoria ?? this.#categoria,
      attrId:        d.attrId ?? this.#attrId,
      habId:         d.habId ?? this.#habId,
      tretNegatiuId: d.tretNegatiuId ?? this.#tretNegatiuId
    });
  }

  async close(options = {}) {
    this.#resolve?.(null);
    return super.close(options);
  }

  static obrir(config) {
    return new Promise(resolve => {
      const dlg = new DiategMillora(config);
      dlg.#resolve = resolve;
      dlg.render(true);
    });
  }
}
