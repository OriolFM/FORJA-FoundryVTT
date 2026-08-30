const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Selector de caselles per a àrees LLIURES (dispersió): l'usuari (jugador
 * o DJ) fa clic a les caselles del canvas fins a triar-ne exactament
 * `nMax` — el mateix nombre de caselles que cobriria un esfèric del
 * mateix cost (`nombreCaselesPerRadi`, area.mjs). No hi ha cap ajudant
 * natiu a Foundry per triar caselles arbitràries (només plantilles amb
 * formes fixes) — interacció pròpia, senzilla: aquest diàleg flotant no
 * bloqueja el canvas (no modal), i escolta els clics directament sobre
 * `canvas.stage` mentre està obert.
 *
 * Fer clic a una casella ja triada la desselecciona; fer clic quan ja
 * s'han triat `nMax` caselles no fa res fins que se'n desselecciona
 * alguna. Només es pot confirmar amb exactament `nMax` triades.
 */
export default class SelectorCaselesLliures extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "forja-selector-caselles",
    classes: ["forja", "forja-dialog", "selector-caselles"],
    tag: "form",
    position: { width: 320 },
    window: { resizable: false },
    form: { closeOnSubmit: true, handler: SelectorCaselesLliures._onSubmit }
  };

  static PARTS = {
    form: { template: "systems/forja/templates/combat/selector-caselles.hbs" }
  };

  #nMax = 1;
  #resolve = null;
  #seleccionades = new Map(); // "i,j" -> {i,j}
  #onClick = null;
  static #NOM_CAPA = "forja-selector-caselles";

  constructor(nMax, options = {}) {
    super(options);
    this.#nMax = nMax;
  }

  get title() {
    return game.i18n.format("FORJA.Combat.SelectorCaselesTitol", { n: this.#nMax });
  }

  async _prepareContext(options) {
    return { nMax: this.#nMax, actual: this.#seleccionades.size, completa: this.#seleccionades.size === this.#nMax };
  }

  /** Nomes s'executa un cop (Foundry): aquí es registra l'escolta de clics del canvas, no a `_onRender` (que es repeteix a cada re-render i duplicaria l'escolta). */
  async _onFirstRender(context, options) {
    super._onFirstRender?.(context, options);
    canvas.interface.grid.addHighlightLayer(SelectorCaselesLliures.#NOM_CAPA);
    this.#onClick = (event) => {
      const pos = event.getLocalPosition(canvas.stage);
      const offset = canvas.grid.getOffset(pos);
      const key = `${offset.i},${offset.j}`;
      if (this.#seleccionades.has(key)) {
        this.#seleccionades.delete(key);
      } else if (this.#seleccionades.size < this.#nMax) {
        this.#seleccionades.set(key, offset);
      }
      this.#redibuixarCaselles();
      this.render(false);
    };
    canvas.stage.on("pointerdown", this.#onClick);
  }

  async _onRender(context, options) {
    super._onRender?.(context, options);
    this.#redibuixarCaselles();
  }

  #redibuixarCaselles() {
    const capa = canvas.interface.grid;
    capa.clearHighlightLayer(SelectorCaselesLliures.#NOM_CAPA);
    for (const offset of this.#seleccionades.values()) {
      const tl = canvas.grid.getTopLeftPoint(offset);
      capa.highlightPosition(SelectorCaselesLliures.#NOM_CAPA, { x: tl.x, y: tl.y, color: 0x33bbff });
    }
  }

  #aturarEscolta() {
    if (this.#onClick) canvas.stage.off("pointerdown", this.#onClick);
    this.#onClick = null;
    canvas.interface.grid.clearHighlightLayer(SelectorCaselesLliures.#NOM_CAPA);
    canvas.interface.grid.destroyHighlightLayer(SelectorCaselesLliures.#NOM_CAPA);
  }

  static _onSubmit(event, form, formData) {
    if (this.#seleccionades.size !== this.#nMax) { this.render(false); return; }
    this.#aturarEscolta();
    this.#resolve?.([...this.#seleccionades.values()]);
    this.#resolve = null;
  }

  async close(options = {}) {
    this.#aturarEscolta();
    this.#resolve?.(null);
    this.#resolve = null;
    return super.close(options);
  }

  /**
   * @param {number} nMax
   * @returns {Promise<Array<{i:number,j:number}>|null>} null si es cancel·la
   */
  static obrir(nMax) {
    return new Promise(resolve => {
      const app = new SelectorCaselesLliures(nMax);
      app.#resolve = resolve;
      app.render(true);
    });
  }
}
