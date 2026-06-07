const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Diàleg de configuració de tirada FORJA.
 * L'atribut i habilitat ja vénen triats; aquí s'afegeixen modificadors (DA-5).
 */
export default class DiategTirada extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "forja-dialeg-tirada",
    classes: ["forja", "forja-dialog", "dialeg-tirada"],
    tag: "form",
    position: { width: 320 },
    window: { resizable: false },
    form: { closeOnSubmit: true, handler: DiategTirada._onSubmit }
  };

  static PARTS = {
    form: { template: "systems/forja/templates/dice/dialeg-tirada.hbs" }
  };

  #config  = null;
  #resolve = null;

  constructor(config, options = {}) {
    super(options);
    this.#config = config;
  }

  get title() {
    return this.#config?.label ?? game.i18n.localize("FORJA.Dice.Titol");
  }

  async _prepareContext(options) {
    const c = this.#config;
    return {
      label:      c.label,
      atribut:    c.atribut,
      atributVal: c.atributVal,
      habId:      c.habId,
      habNivell:  c.habNivell,
      poolBase:   c.poolBase,
      penalSalut: c.penalSalut,
      concentrat: c.concentrat,
      dificultat:    1,
      modDaus:       0,
      modDificultat: 0
    };
  }

  static async _onSubmit(event, form, formData) {
    const d = formData.object;
    this.#resolve?.({
      dificultat:    Math.max(1, parseInt(d.dificultat)    || 1),
      modDaus:       parseInt(d.modDaus)       || 0,
      modDificultat: parseInt(d.modDificultat) || 0,
      concentrat:    !!d.concentrat
    });
  }

  async close(options = {}) {
    this.#resolve?.(null);
    return super.close(options);
  }

  static obrir(config) {
    return new Promise(resolve => {
      const dlg = new DiategTirada(config);
      dlg.#resolve = resolve;
      dlg.render(true);
    });
  }
}
