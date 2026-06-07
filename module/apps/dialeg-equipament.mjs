/**
 * Diàleg per seleccionar armes o armadures estàndard del catàleg (manual)
 * i afegir-les com a ítem incrustat a l'actor.
 */
import { FORJA } from "../config/constants.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class DiategEquipament extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {function(object|null):void} */
  #resolve = null;

  /** @type {"arma"|"armadura"} */
  #tipus = "arma";

  /** @type {string} */
  #cerca = "";

  static DEFAULT_OPTIONS = {
    id:   "forja-dialeg-equipament",
    tag:  "div",
    window: { title: "FORJA.Equip.Seleccionar", resizable: true },
    position: { width: 520, height: 560 },
    actions: {
      seleccionar: DiategEquipament._onSeleccionar,
      tancar:      DiategEquipament._onTancar
    }
  };

  static PARTS = {
    body: { template: "systems/forja/templates/actor/dialeg-equipament.hbs", scrollable: [""] }
  };

  /**
   * Obre el diàleg per a un tipus d'equipament concret.
   * @param {"arma"|"armadura"} tipus
   * @returns {Promise<object|null>} entrada del catàleg seleccionada, o null
   */
  static async obrir(tipus = "arma") {
    return new Promise(resolve => {
      const dlg = new DiategEquipament();
      dlg.#tipus   = tipus;
      dlg.#resolve = resolve;
      dlg.render(true);
    });
  }

  async _prepareContext(options) {
    const cataleg = this.#tipus === "armadura" ? FORJA.CATALEG_ARMADURES : FORJA.CATALEG_ARMES;
    const cerca = this.#cerca.toLowerCase().trim();
    const entrades = (cerca ? cataleg.filter(e => e.nom.toLowerCase().includes(cerca)) : cataleg)
      .slice()
      .sort((a, b) => a.nom.localeCompare(b.nom, "ca"));

    return {
      tipus: this.#tipus,
      titol: this.#tipus === "armadura" ? "FORJA.Equip.Armadures" : "FORJA.Equip.Armes",
      cerca,
      cercaText: this.#cerca,
      entrades
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const cercaInput = this.element.querySelector(".de-cerca-input");
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
  }

  static async _onSeleccionar(event, target) {
    const id = target.dataset.id;
    const cataleg = this.#tipus === "armadura" ? FORJA.CATALEG_ARMADURES : FORJA.CATALEG_ARMES;
    const entrada = cataleg.find(e => e.id === id);
    if (!entrada) return;
    this.#resolve({ tipus: this.#tipus, entrada });
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
