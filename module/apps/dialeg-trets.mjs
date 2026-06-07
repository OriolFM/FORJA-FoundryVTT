/**
 * Diàleg per seleccionar i afegir trets predefinits del manual.
 * Flux en 2 passos: llista filtrable → detall/confirmació (amb càlcul de cost variable).
 */
import { FORJA } from "../config/constants.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class DiategTrets extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {function(object|null):void} */
  #resolve = null;

  /** @type {string} */
  #cerca = "";

  /** @type {object|null} tret seleccionat per a la pantalla de detall */
  #detall = null;

  /** @type {number} valor X introduït per l'usuari (trets de cost variable) */
  #valorX = 1;

  static DEFAULT_OPTIONS = {
    id:       "forja-dialeg-trets",
    tag:      "div",
    window: {
      title:     "FORJA.Tret.Seleccionar",
      resizable: true
    },
    position: { width: 560, height: 600 },
    actions: {
      seleccionarTret: DiategTrets._onSeleccionarTret,
      tornar:          DiategTrets._onTornar,
      confirmarTret:   DiategTrets._onConfirmarTret,
      tancar:          DiategTrets._onTancar
    }
  };

  static PARTS = {
    body: { template: "systems/forja/templates/actor/dialeg-trets.hbs", scrollable: [""] }
  };

  // ── API pública ─────────────────────────────────────────────────────────
  /**
   * Obre el diàleg i retorna una Promise resolta amb { nom, cost, descripcio } o null.
   * @returns {Promise<object|null>}
   */
  static async obrir() {
    return new Promise(resolve => {
      const dlg = new DiategTrets();
      dlg.#resolve = resolve;
      dlg.render(true);
    });
  }

  // ── Context ─────────────────────────────────────────────────────────────
  async _prepareContext(options) {
    if (this.#detall) {
      const t = this.#detall;
      const costCalculat = this.#calcularCost(t);
      return {
        detall: t,
        valorX: this.#valorX,
        costCalculat,
        costCalculatText: t.positiu ? `+${costCalculat} PC` : `${costCalculat} PC`
      };
    }

    const cerca = this.#cerca.toLowerCase().trim();
    const filtrats = cerca
      ? FORJA.LLISTA_TRETS.filter(t => t.nom.toLowerCase().includes(cerca))
      : FORJA.LLISTA_TRETS;

    return {
      cerca,
      cercaText: this.#cerca,
      positius: filtrats.filter(t => t.positiu),
      negatius: filtrats.filter(t => !t.positiu)
    };
  }

  /** Calcula el cost final d'un tret segons el valor X introduït. */
  #calcularCost(tret) {
    if (tret.multiplicador) return tret.multiplicador * Math.max(1, this.#valorX);
    if (tret.divisor)       return Math.round(Math.max(0, this.#valorX) / tret.divisor);
    return tret.cost;
  }

  // ── Listeners post-render ────────────────────────────────────────────────
  _onRender(context, options) {
    super._onRender?.(context, options);

    const cercaInput = this.element.querySelector(".dt-cerca-input");
    if (cercaInput) {
      cercaInput.addEventListener("input", ev => {
        this.#cerca = ev.target.value;
        this.render(false);
      });
      // Recuperem el focus i la posició del cursor després de cada re-render.
      cercaInput.focus();
      const pos = cercaInput.value.length;
      cercaInput.setSelectionRange(pos, pos);
    }

    const xInput = this.element.querySelector(".dt-valor-x");
    if (xInput) {
      xInput.addEventListener("input", ev => {
        this.#valorX = Math.max(0, parseInt(ev.target.value) || 0);
        this.render(false);
      });
    }
  }

  // ── Actions ──────────────────────────────────────────────────────────────
  static async _onSeleccionarTret(event, target) {
    const id = target.dataset.tretId;
    const tret = FORJA.LLISTA_TRETS.find(t => t.id === id);
    if (!tret) return;
    this.#detall = tret;
    this.#valorX = 1;
    this.render(false);
  }

  static _onTornar(event, target) {
    this.#detall = null;
    this.render(false);
  }

  static async _onConfirmarTret(event, target) {
    const t = this.#detall;
    if (!t) return;
    const cost = this.#calcularCost(t);
    let nom = t.nom;
    if (t.multiplicador || t.divisor) nom = `${t.nom} (${this.#valorX})`;
    this.#resolve({ nom, cost, descripcio: t.descripcio ?? "" });
    this.#resolve = null;
    this.close();
  }

  static _onTancar(event, target) {
    this.#resolve?.(null);
    this.#resolve = null;
    this.close();
  }

  async close(options = {}) {
    this.#resolve?.(null);
    this.#resolve = null;
    return super.close(options);
  }
}
