const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/** Ressonància (manual l. 4229): daus o dificultat que suma cada nivell. */
const RESSONANCIA = {
  "molt-favorable":    { daus: 2, dificultat: 0 },
  "favorable":         { daus: 1, dificultat: 0 },
  "neutra":            { daus: 0, dificultat: 0 },
  "desfavorable":      { daus: 0, dificultat: 1 },
  "molt-desfavorable": { daus: 0, dificultat: 2 }
};

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
    // Fase 3: efecte declarat al tracker (preseleccionat).
    this.#efecteId = config.efectePerDefecte ?? "";
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
      dificultatInicial: (c.efectes ?? []).find(e => e.id === this.#efecteId)?.dificultat ?? 1,
      descripcioInicial: (c.efectes ?? []).find(e => e.id === this.#efecteId)?.nom ?? "",
      usPuntsExtra: this.#usPuntsExtra,
      ressonancies: Object.keys(RESSONANCIA).map(id => ({ id, nom: game.i18n.localize(`FORJA.Sobrenatural.Ressonancia.${id}`) }))
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
    // Ressonància (manual › Ressonància, l. 4229): molt favorable +2 daus,
    // favorable +1 dau, desfavorable +1 dificultat, molt desfavorable +2.
    const ressonancia = RESSONANCIA[d.ressonancia] ?? RESSONANCIA.neutra;
    this.#resolve?.({
      efecteId:       d.efecteId || this.#efecteId || null,
      eleccioPista:   d.eleccioPista || null,
      ressonancia:    d.ressonancia ?? "neutra",
      dificultatBase: Math.max(1, parseInt(d.dificultatBase) || 1),
      modDaus:        (parseInt(d.modDaus) || 0) + ressonancia.daus,
      modDificultat:  (parseInt(d.modDificultat) || 0) + ressonancia.dificultat,
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
