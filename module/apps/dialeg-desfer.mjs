const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Diàleg per provar de desfer un efecte actiu (S-21): dificultat (fites
 * originals) i atribut/habilitat a triar a mà — el manual no en fixa cap
 * ("les habilitats pertinents"), mateix criteri DA-5 que
 * `DiategProvarPrototip` (S-30).
 */
export default class DiategDesfer extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "forja-dialeg-desfer",
    classes: ["forja", "forja-dialog", "dialeg-desfer"],
    tag: "form",
    position: { width: 380 },
    window: { title: "FORJA.Sobrenatural.DesferTitol", resizable: false },
    form: { closeOnSubmit: true, handler: DiategDesfer._onSubmit }
  };

  static PARTS = {
    form: { template: "systems/forja/templates/actor/dialeg-desfer.hbs" }
  };

  #resolve = null;
  #atribut = "APL";
  #habId   = "";

  async _prepareContext(options) {
    return {
      atributs:   CONFIG.FORJA.ATRIBUTS,
      habilitats: CONFIG.FORJA.LLISTA_HABILITATS,
      atribut:    this.#atribut,
      habId:      this.#habId
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
      dificultat:    Math.max(1, parseInt(d.dificultat) || 1),
      label:         d.label ?? "",
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

  static obrir() {
    return new Promise(resolve => {
      const dlg = new DiategDesfer();
      dlg.#resolve = resolve;
      dlg.render(true);
    });
  }
}
