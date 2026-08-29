const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Diàleg per declarar la manifestació d'un efecte sobrenatural (S-21).
 * Si l'actor té efectes après (S-25, `system.efectes` a la fitxa), es pot
 * triar-ne un del desplegable perquè precarregui la dificultat bàsica i la
 * descripció — sempre editables després (DA-5: automatitza el càlcul, mai
 * la decisió). Sense triar-ne cap (o si l'actor no en té cap après), la
 * dificultat i la descripció s'introdueixen a mà, mateix criteri que "Altra
 * acció" al diàleg de declarar acció de combat.
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
  #efecteId = "";

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
      efectes:  c.efectes ?? [],
      efecteId: this.#efecteId,
      usPuntsExtra: this.#usPuntsExtra
    };
  }

  async _onRender(context, options) {
    super._onRender?.(context, options);
    this.element.querySelectorAll("input[name='usPuntsExtra']").forEach(radio => {
      radio.addEventListener("change", ev => { this.#usPuntsExtra = ev.target.value; });
    });
    this.element.querySelector("select[name='efecteId']")?.addEventListener("change", ev => {
      this.#efecteId = ev.target.value;
      const efecte = (this.#config.efectes ?? []).find(e => e.id === this.#efecteId);
      const avisRitual = this.element.querySelector(".dm-ritual-avis");
      if (efecte) {
        const dificultatInput  = this.element.querySelector("input[name='dificultatBase']");
        const descripcioInput  = this.element.querySelector("input[name='descripcio']");
        if (dificultatInput) dificultatInput.value = efecte.dificultat;
        if (descripcioInput && !descripcioInput.value) descripcioInput.value = efecte.nom;
      }
      // S-22 (Rituals): l'automatització real (modificadors per ressonància,
      // assistents i materials/sacrificis) és, segons el propi manual
      // (p. 616-624), sempre a discreció del DJ — no hi ha res a calcular.
      // L'única aportació sensata aquí és recordar-ho i apuntar als camps
      // que ja existeixen (Mod. daus / Mod. dificultat) perquè el DJ hi
      // sumi el que decideixi, en lloc d'inventar un mecanisme nou.
      if (avisRitual) avisRitual.hidden = efecte?.tipus !== "ritual";
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
