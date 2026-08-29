const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Diàleg per declarar la manifestació d'un efecte sobrenatural (S-21).
 * Sense catàleg d'efectes encara (S-25, pendent), la dificultat bàsica i la
 * descripció s'introdueixen a mà — mateix criteri que "Altra acció" al
 * diàleg de declarar acció de combat (DA-5: automatitza el càlcul, mai la
 * decisió/contingut).
 */
export default class DiategManifestar extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "forja-dialeg-manifestar",
    classes: ["forja", "forja-dialog", "dialeg-manifestar"],
    tag: "form",
    position: { width: 420 },
    window: { resizable: false },
    form: { closeOnSubmit: true, handler: DiategManifestar._onSubmit }
  };

  static PARTS = {
    form: { template: "systems/forja/templates/combat/dialeg-manifestar.hbs" }
  };

  #config  = null;
  #resolve = null;
  #usPuntsExtra = "cap";

  constructor(config, options = {}) {
    super(options);
    this.#config = config;
  }

  get title() {
    return game.i18n.format("FORJA.Sobrenatural.ManifestarTitol", { nom: this.#config?.nomActor ?? "" });
  }

  async _prepareContext(options) {
    const c = this.#config;
    return {
      nomActor: c.nomActor,
      donNom:   c.donNom,
      eqActual: c.eqActual,
      eqMax:    c.eqMax,
      nomObjectiu: c.nomObjectiu ?? null,
      usPuntsExtra: this.#usPuntsExtra
    };
  }

  async _onRender(context, options) {
    super._onRender?.(context, options);
    this.element.querySelectorAll("input[name='usPuntsExtra']").forEach(radio => {
      radio.addEventListener("change", ev => { this.#usPuntsExtra = ev.target.value; });
    });
  }

  static async _onSubmit(event, form, formData) {
    const d = formData.object;
    this.#resolve?.({
      dificultatBase: Math.max(1, parseInt(d.dificultatBase) || 1),
      modDaus:        parseInt(d.modDaus) || 0,
      modDificultat:  parseInt(d.modDificultat) || 0,
      puntsExtra:     Math.max(0, parseInt(d.puntsExtra) || 0),
      usPuntsExtra:   d.usPuntsExtra ?? this.#usPuntsExtra,
      descripcio:     d.descripcio ?? ""
    });
  }

  async close(options = {}) {
    this.#resolve?.(null);
    return super.close(options);
  }

  static obrir(config) {
    return new Promise(resolve => {
      const dlg = new DiategManifestar(config);
      dlg.#resolve = resolve;
      dlg.render(true);
    });
  }
}
