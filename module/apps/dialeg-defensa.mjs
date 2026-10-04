import { triarMitjaBlocar } from "../combat/defensa.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Diàleg de defensa (S-13): quan es resol un atac contra un objectiu, el DJ
 * tria en nom seu com es defensa — passiva, activa (esquivar/parar, gasta
 * reacció) o blocar (gasta reacció, sense tirada, suma resistència).
 * Les opcions arriben de `opcionsDefensa` (combat/defensa.mjs, font única, B7);
 * un defensor fora de combat (nivell 7) només té la defensa passiva a 1 (B1).
 *
 * B15 (FC001CA › Defensar-se › Blocar): si es tria blocar, el defensor tria
 * amb què bloca — cos (resistència), escut (armes cos a cos) o un altre
 * objecte (armes improvisades) — entre els mitjans que li ofereix
 * `mitjansBlocar`; l'opció retornada porta `mitjaId` i la `reduccioExtra`
 * d'aquell mitjà (`triarMitjaBlocar`).
 */
export default class DiategDefensa extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "forja-dialeg-defensa-{id}",
    classes: ["forja", "forja-dialog", "dialeg-defensa"],
    tag: "form",
    position: { width: 380 },
    window: { resizable: false },
    form: { closeOnSubmit: true, handler: DiategDefensa._onSubmit }
  };

  static PARTS = {
    form: { template: "systems/forja/templates/combat/dialeg-defensa.hbs" }
  };

  #config  = null;
  #resolve = null;
  #opcioId = null;
  #mitjaId = null;

  constructor(config, options = {}) {
    super(options);
    this.#config = config;
    // Per defecte, l'última defensa triada en aquest combat (si està disponible).
    const ultima = config.ultima;
    const ultimaOpcio = ultima && config.opcions.find(o => o.id === ultima.opcioId && o.disponible);
    this.#opcioId = ultimaOpcio?.id ?? config.opcions.find(o => o.disponible)?.id ?? config.opcions[0]?.id ?? null;
    const blocar = config.opcions.find(o => o.id === "blocar");
    this.#mitjaId = (ultima?.mitjaId && blocar?.mitjans?.some(m => m.id === ultima.mitjaId))
      ? ultima.mitjaId
      : (blocar?.mitjaId ?? null);
  }

  get title() {
    return game.i18n.format("FORJA.Combat.DefensaTitol", { nom: this.#config?.nomDefensor ?? "" });
  }

  async _prepareContext(options) {
    const c = this.#config;
    // Les opcions es mostren amb el mitjà de blocar triat (reducció extra actualitzada).
    const opcions = c.opcions.map(o => triarMitjaBlocar(o, this.#mitjaId));
    return {
      nomAtacant:  c.nomAtacant,
      nomDefensor: c.nomDefensor,
      foraDeCombat: !!c.foraDeCombat,
      opcions,
      opcioId:     this.#opcioId,
      mitjaId:     this.#mitjaId
    };
  }

  async _onRender(context, options) {
    super._onRender?.(context, options);
    this.element.querySelectorAll("input[name='opcioId']").forEach(radio => {
      radio.addEventListener("change", ev => {
        this.#opcioId = ev.target.value;
        this.render(false);
      });
    });
    this.element.querySelector("[name='mitjaId']")?.addEventListener("change", ev => {
      this.#mitjaId = ev.target.value;
      this.render(false);
    });
  }

  static async _onSubmit(event, form, formData) {
    const opcioId = formData.object.opcioId;
    const opcio = this.#config.opcions.find(o => o.id === opcioId);
    this.#resolve?.(opcio ? triarMitjaBlocar(opcio, formData.object.mitjaId ?? this.#mitjaId) : null);
    this.#resolve = null;
  }

  async close(options = {}) {
    this.#resolve?.(null);
    return super.close(options);
  }

  static obrir(config) {
    return new Promise(resolve => {
      const dlg = new DiategDefensa(config);
      dlg.#resolve = resolve;
      dlg.render(true);
    });
  }
}
