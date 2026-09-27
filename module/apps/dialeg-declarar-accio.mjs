import { retardMaximBarallarse, limitarRetardBarallarse } from "../combat/atac.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Diàleg de declaració d'acció (S-10, DA-5): tria el tipus d'acció
 * (atac / defensa completa / altra acció) i en calcula la latència
 * corresponent — editable abans de confirmar.
 *
 * - Defensa completa (B7): la llista arriba ja construïda per
 *   `opcionsDefensa(actor, …, { declarada: true })` (combat/defensa.mjs), la
 *   mateixa font que el diàleg de defensa en resoldre un atac.
 * - Maniobres d'arts marcials (B6; manual FC001CA › SISTEMES › Combat › Cos a
 *   cos, taules "Armes naturals" — Cop: "Arts Marcials (+1 dificultat) —
 *   Escull un moviment de la taula" — i "Arts Marcials"): només per a l'atac
 *   "Cop" i si l'actor té Arts Marcials (vegeu `tracker-ui.mjs`). No
 *   modifiquen la latència ("no la penalitzen en velocitat", › Temps actiu ›
 *   Accions).
 * - Concentració (B5; › Gestió del temps de joc › Concentració: "En declarar,
 *   un jugador pot indicar que el seu PJ es concentra en la seva acció"):
 *   casella que fixa `system.concentrat` (+1 dau a la propera tirada, sense
 *   reaccions fins llavors).
 * - Retard de barallar-se (B16; › Cos a cos, "Barallar-se" i taula "Armes
 *   naturals", Cop): per als atacs amb armes naturals tirats amb
 *   barallar-se (sense maniobra), es pot afegir fins a `nivell de
 *   barallar-se` ticks de latència; cada tick dona +1 dau a l'atac. Cada arma
 *   porta `retardMax` (0 = no s'hi pot retardar), calculat a `tracker-ui.mjs`.
 */
export default class DiategDeclararAccio extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "forja-dialeg-declarar-accio-{id}",
    classes: ["forja", "forja-dialog", "dialeg-declarar-accio"],
    tag: "form",
    position: { width: 380 },
    window: { resizable: false },
    form: { closeOnSubmit: true, handler: DiategDeclararAccio._onSubmit }
  };

  static PARTS = {
    form: { template: "systems/forja/templates/combat/dialeg-declarar-accio.hbs" }
  };

  #config     = null;
  #resolve    = null;
  #tipus      = "atac";
  #armaId     = null;
  #defensaId  = null;
  #maniobraId = "";
  #concentrar = false;
  #descripcio = "";
  #retard     = 0;

  constructor(config, options = {}) {
    super(options);
    this.#config     = config;
    this.#armaId     = config.armes?.[0]?.id ?? null;
    this.#defensaId  = config.defenses?.[0]?.id ?? null;
    this.#concentrar = !!config.concentrat;
    if (!config.armes?.length) this.#tipus = "defensa";
  }

  get title() {
    return game.i18n.format("FORJA.Combat.DeclararAccioTitol", { nom: this.#config?.nom ?? "" });
  }

  /** Arma triada (entrada de `config.armes`). */
  #arma() {
    return this.#config.armes?.find(a => a.id === this.#armaId) ?? null;
  }

  /** Màxim de ticks de retard de barallar-se per a l'atac triat (B16). */
  #retardMax() {
    if (this.#tipus !== "atac") return 0;
    const arma = this.#arma();
    return retardMaximBarallarse(arma, arma?.retardMax ?? 0, !!this.#maniobraId);
  }

  /** Retard efectiu, limitat al màxim actual (B16). */
  #retardEfectiu() {
    return limitarRetardBarallarse(this.#retard, this.#retardMax());
  }

  async _prepareContext(options) {
    const c = this.#config;
    const arma = this.#arma();
    const permetManiobres = this.#tipus === "atac" && !!arma?.permetManiobres;
    const maniobres = permetManiobres ? (c.maniobres ?? []) : [];
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
      permetManiobres,
      maniobres,
      maniobraId:    this.#maniobraId,
      maniobra:      maniobres.find(m => m.id === this.#maniobraId) ?? null,
      concentrar:    this.#concentrar,
      descripcio:    this.#descripcio,
      retardMax:     this.#retardMax(),
      retard:        this.#retardEfectiu(),
      latencia:      this.#calcularLatencia()
    };
  }

  #calcularLatencia() {
    const c = this.#config;
    if (this.#tipus === "atac") return (this.#arma()?.latenciaTotal ?? c.latenciaBase) + this.#retardEfectiu();
    return c.latenciaBase;
  }

  async _onRender(context, options) {
    await super._onRender?.(context, options);
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
      if (!this.#arma()?.permetManiobres) this.#maniobraId = "";
      this.render(false);
    });

    el.querySelector("[name='maniobraId']")?.addEventListener("change", ev => {
      this.#maniobraId = ev.target.value ?? "";
      this.render(false);
    });

    el.querySelector("[name='retardBarallarse']")?.addEventListener("change", ev => {
      this.#retard = limitarRetardBarallarse(ev.target.value, this.#retardMax());
      this.render(false);
    });

    el.querySelector("[name='defensaId']")?.addEventListener("change", ev => {
      this.#defensaId = ev.target.value;
      this.render(false);
    });

    el.querySelector("[name='concentrar']")?.addEventListener("change", ev => {
      this.#concentrar = ev.target.checked;
    });

    el.querySelector("[name='descripcio']")?.addEventListener("input", ev => {
      this.#descripcio = ev.target.value;
    });

    inputMod?.addEventListener("input", recalcular);
  }

  static async _onSubmit(event, form, formData) {
    const d     = formData.object;
    const tipus   = d.tipus ?? "altra";
    const arma    = tipus === "atac"    ? this.#config.armes?.find(a => a.id === d.armaId) : null;
    const defensa = tipus === "defensa" ? this.#config.defenses?.find(x => x.id === d.defensaId) : null;
    const maniobra = (arma?.permetManiobres && d.maniobraId)
      ? (this.#config.maniobres ?? []).find(m => m.id === d.maniobraId) ?? null
      : null;

    let etiqueta;
    if (tipus === "atac")         etiqueta = arma?.nom ?? game.i18n.localize("FORJA.Combat.Accio.Atac");
    else if (tipus === "defensa") etiqueta = defensa?.nom ?? game.i18n.localize("FORJA.Combat.Accio.Defensa");
    else                          etiqueta = game.i18n.localize("FORJA.Combat.Accio.Altra");
    if (maniobra) etiqueta = `${etiqueta} — ${maniobra.nom}`;

    // B16: el retard només val per a atacs de barallar-se sense maniobra.
    const retardBarallarse = arma
      ? limitarRetardBarallarse(d.retardBarallarse, retardMaximBarallarse(arma, arma.retardMax ?? 0, !!maniobra))
      : 0;
    if (retardBarallarse > 0) {
      etiqueta = `${etiqueta} — ${game.i18n.format("FORJA.Combat.RetardBarallarseEtiqueta", { n: retardBarallarse })}`;
    }

    this.#resolve?.({
      // B16: el retard declarat no es pot "desfer" editant la latència a mà.
      latencia:   Math.max(1, parseInt(d.latencia) || 1,
                           retardBarallarse > 0 ? (arma.latenciaTotal ?? 0) + retardBarallarse : 1),
      tipus,
      armaId:     arma?.id ?? null,
      defensa:    defensa ?? null,
      maniobraId: maniobra?.id ?? null,
      retardBarallarse,
      concentrar: !!d.concentrar,
      etiqueta,
      descripcio: (d.descripcio ?? "").trim()
    });
    this.#resolve = null;
  }

  async close(options = {}) {
    this.#resolve?.(null);
    this.#resolve = null;
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
