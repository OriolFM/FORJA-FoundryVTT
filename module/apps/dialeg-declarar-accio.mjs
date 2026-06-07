const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Diàleg de declaració d'acció (S-10, DA-5): tria el tipus d'acció
 * (atac / defensa completa / altra acció) i en calcula la latència
 * corresponent — editable abans de confirmar.
 */
export default class DiategDeclararAccio extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "forja-dialeg-declarar-accio",
    classes: ["forja", "forja-dialog", "dialeg-declarar-accio"],
    tag: "form",
    position: { width: 360 },
    window: { resizable: false },
    form: { closeOnSubmit: true, handler: DiategDeclararAccio._onSubmit }
  };

  static PARTS = {
    form: { template: "systems/forja/templates/combat/dialeg-declarar-accio.hbs" }
  };

  #config    = null;
  #resolve   = null;
  #tipus     = "atac";
  #armaId    = null;
  #defensaId = null;

  constructor(config, options = {}) {
    super(options);
    this.#config    = config;
    this.#armaId    = config.armes?.[0]?.id ?? null;
    this.#defensaId = config.defenses?.[0]?.id ?? null;
    if (!config.armes?.length) this.#tipus = "defensa";
  }

  get title() {
    return game.i18n.format("FORJA.Combat.DeclararAccioTitol", { nom: this.#config?.nom ?? "" });
  }

  async _prepareContext(options) {
    const c = this.#config;
    return {
      nom:           c.nom,
      marcador:      c.marcador,
      posicioActual: c.posicioActual,
      latenciaBase:  c.latenciaBase,
      armes:         c.armes ?? [],
      defenses:      c.defenses ?? [],
      tipus:         this.#tipus,
      armaId:        this.#armaId,
      defensaId:     this.#defensaId,
      latencia:      this.#calcularLatencia()
    };
  }

  #calcularLatencia() {
    const c = this.#config;
    if (this.#tipus === "atac") {
      const arma = c.armes?.find(a => a.id === this.#armaId);
      return arma?.latenciaTotal ?? c.latenciaBase;
    }
    if (this.#tipus === "defensa") return c.latenciaBase;
    return c.latenciaBase;
  }

  async _onRender(context, options) {
    super._onRender?.(context, options);
    const el = this.element;

    const inputLatencia = el.querySelector("[name='latencia']");
    const inputMod      = el.querySelector("[name='modificador']");

    const recalcular = () => {
      let valor = this.#calcularLatencia();
      if (this.#tipus === "altra") valor += parseInt(inputMod?.value) || 0;
      if (inputLatencia) inputLatencia.value = Math.max(1, valor);
    };

    el.querySelectorAll("input[name='tipus']").forEach(radio => {
      radio.addEventListener("change", ev => {
        this.#tipus = ev.target.value;
        this.render(false);
      });
    });

    el.querySelector("[name='armaId']")?.addEventListener("change", ev => {
      this.#armaId = ev.target.value;
      recalcular();
    });

    el.querySelector("[name='defensaId']")?.addEventListener("change", ev => {
      this.#defensaId = ev.target.value;
      this.render(false);
    });

    inputMod?.addEventListener("input", recalcular);
  }

  static async _onSubmit(event, form, formData) {
    const d     = formData.object;
    const tipus   = d.tipus ?? "altra";
    const arma    = tipus === "atac"    ? this.#config.armes?.find(a => a.id === d.armaId) : null;
    const defensa = tipus === "defensa" ? this.#config.defenses?.find(x => x.id === d.defensaId) : null;

    let etiqueta;
    if (tipus === "atac")         etiqueta = arma?.nom ?? game.i18n.localize("FORJA.Combat.Accio.Atac");
    else if (tipus === "defensa") etiqueta = defensa?.nom ?? game.i18n.localize("FORJA.Combat.Accio.Defensa");
    else                          etiqueta = game.i18n.localize("FORJA.Combat.Accio.Altra");

    this.#resolve?.({
      latencia:   Math.max(1, parseInt(d.latencia) || 1),
      tipus,
      armaId:     arma?.id ?? null,
      defensa:    defensa ?? null,
      etiqueta,
      descripcio: (d.descripcio ?? "").trim()
    });
  }

  async close(options = {}) {
    this.#resolve?.(null);
    return super.close(options);
  }

  static obrir(config) {
    return new Promise(resolve => {
      const dlg = new DiategDeclararAccio(config);
      dlg.#resolve = resolve;
      dlg.render(true);
    });
  }
}
