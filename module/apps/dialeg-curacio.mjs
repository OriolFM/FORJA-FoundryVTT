import { NIVELL_MINIM_CURACIO } from "../combat/curacio.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Diàleg de curació (S-17): tria entre primers auxilis (dificultat 1) i
 * tractament mèdic (dificultat 2), i la pista de salut a guarir.
 *
 * B17 (FC001CA › Salut › Primers auxilis / Tractament mèdic): si el cridant
 * passa `habNivell`, els tractaments que demanen més nivell (1 i 2) es
 * mostren desactivats; si passa `autotractament: true` i l'usuari no és el
 * DJ, s'avisa que cal l'aprovació del DJ. La comprovació definitiva la fa
 * sempre `ferCuracio` (`comprovarRequisitsCuracio`), encara que el cridant no
 * passi aquests camps.
 */
export default class DiategCuracio extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "forja-dialeg-curacio-{id}",
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
    // Si primers auxilis no està permès però tractament mèdic sí (no passa amb
    // els mínims 1/2, però es manté genèric), comença pel permès.
    if (!this.#permes("primers-auxilis") && this.#permes("tractament-medic")) this.#tipus = "tractament-medic";
  }

  /** B17: el tipus és permès pel nivell d'habilitat (si es coneix). */
  #permes(tipus) {
    const nivell = this.#config?.habNivell;
    if (typeof nivell !== "number") return true;
    return nivell >= (NIVELL_MINIM_CURACIO[tipus] ?? 1);
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
      dificultat,
      permesPrimersAuxilis:  this.#permes("primers-auxilis"),
      permesTractamentMedic: this.#permes("tractament-medic"),
      minimTipus:            NIVELL_MINIM_CURACIO[this.#tipus] ?? 1,
      tipusPermes:           this.#permes(this.#tipus),
      avisAutotractament:    !!c.autotractament && !game.user?.isGM
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
    this.#resolve = null;
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
