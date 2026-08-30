const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Diàleg de maniobra d'Arts Marcials (S-12, manual p. 631-651): en atacar
 * amb "Cop" (l'única arma natural que la taula del manual permet fer
 * servir amb Arts Marcials — la resta d'armes naturals tenen el seu
 * propi moviment especial, encara no implementat), es pot triar entre
 * l'atac bàsic (Barallar-se) o una maniobra de la taula (Arts Marcials,
 * +1 dificultat, efecte propi).
 */
export default class DiategManiobra extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "forja-dialeg-maniobra",
    classes: ["forja", "forja-dialog", "dialeg-maniobra"],
    tag: "form",
    position: { width: 380 },
    window: { resizable: false },
    form: { closeOnSubmit: true, handler: DiategManiobra._onSubmit }
  };

  static PARTS = {
    form: { template: "systems/forja/templates/combat/dialeg-maniobra.hbs" }
  };

  #config  = null;
  #resolve = null;
  #maniobraId = "cap";

  constructor(config, options = {}) {
    super(options);
    this.#config = config;
  }

  get title() {
    return game.i18n.format("FORJA.Combat.ManiobraTitol", { nom: this.#config?.nom ?? "" });
  }

  async _prepareContext(options) {
    const c = this.#config;
    return {
      nom: c.nom,
      maniobres: c.maniobres,
      maniobraId: this.#maniobraId
    };
  }

  async _onRender(context, options) {
    super._onRender?.(context, options);
    this.element.querySelectorAll("input[name='maniobraId']").forEach(radio => {
      radio.addEventListener("change", ev => { this.#maniobraId = ev.target.value; this.render(false); });
    });
  }

  static async _onSubmit(event, form, formData) {
    const id = formData.object.maniobraId ?? this.#maniobraId;
    const maniobra = id === "cap" ? null : this.#config.maniobres.find(m => m.id === id) ?? null;
    this.#resolve?.(maniobra);
  }

  async close(options = {}) {
    this.#resolve?.(undefined); // undefined = cancel·lat (diferent de null = "cap", que és una tria vàlida)
    return super.close(options);
  }

  static obrir(config) {
    return new Promise(resolve => {
      const dlg = new DiategManiobra(config);
      dlg.#resolve = resolve;
      dlg.render(true);
    });
  }
}
