import {
  calcularParametres, TIPUS_PARAMETRE, PARAMETRE_PER_DEFECTE
} from "../progressio/construccio.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Constructor d'efectes sobrenaturals i artefactes a mida (S-23/S-30; Fase 2,
 * 2026-10-06). Treballa amb una **llista de paràmetres**, com el skill de
 * referència `skills/forja-parametres` (`progressio/construccio.mjs`): s'hi
 * afegeixen paràmetres de qualsevol tipus, es poden repetir (diverses
 * capacitats mentals, dues eines, atribut i tret…), i es pot declarar la
 * dificultat i la latència (±5 i ±2 PC per punt, manual l. 4758 i 4776).
 * Inclou els paràmetres d'artefacte que faltaven: recàrrega, acumulador,
 * armes i armadures base (cost 0, només es paga el que s'hi afegeix) i
 * artefactes permanents.
 *
 * Recalcula cost, dificultat i latència en directe a cada canvi (re-render
 * complet).
 *
 * `obrir({ esArtefacte, inicial })`:
 *   - `esArtefacte`: mode artefacte (categoria, activació, permanent) o
 *     efecte (do).
 *   - `inicial`: `{ nom, do, parametres, construccio, categoria }` per partir
 *     d'un efecte o artefacte existent (p. ex. per millorar-lo).
 * Resol amb `{ nom, cost, dificultat, modLatencia, us, mecanica, parametres,
 * construccio, ... }`, o `null` si es tanca.
 */
export default class DiategConstructor extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "forja-dialeg-constructor-{id}",
    classes: ["forja", "forja-dialog", "dialeg-constructor"],
    tag: "form",
    position: { width: 560, height: 720 },
    window: { title: "FORJA.Construccio.Titol", resizable: true },
    form: { closeOnSubmit: true, handler: DiategConstructor._onSubmit },
    actions: {
      afegirParametre: DiategConstructor._onAfegirParametre,
      treureParametre: DiategConstructor._onTreureParametre
    }
  };

  static PARTS = {
    form: { template: "systems/forja/templates/actor/dialeg-constructor.hbs", scrollable: [".dc-cos"] }
  };

  #resolve = null;
  #esArtefacte = false;
  #nom = "";
  #do = "canalitzacio";
  #categoria = "dispositiu";
  #parametres = [];
  #dificultatDeclarada = null;
  #latenciaDeclarada = null;
  #permanent = false;

  constructor(config = {}, options = {}) {
    super(options);
    this.#esArtefacte = !!config.esArtefacte;
    const i = config.inicial ?? {};
    this.#nom = i.nom ?? "";
    this.#do = i.do ?? "canalitzacio";
    this.#categoria = i.categoria ?? "dispositiu";
    this.#parametres = foundry.utils.deepClone(i.parametres ?? []);
    this.#dificultatDeclarada = i.construccio?.dificultatDeclarada ?? null;
    this.#latenciaDeclarada = i.construccio?.latenciaDeclarada ?? null;
    this.#permanent = !!i.construccio?.permanent;
  }

  get title() {
    return game.i18n.localize(this.#esArtefacte ? "FORJA.Construccio.TitolArtefacte" : "FORJA.Construccio.Titol");
  }

  /** Resultat del càlcul amb l'estat actual. */
  #calcular() {
    return calcularParametres(this.#parametres, {
      dificultatDeclarada: this.#dificultatDeclarada,
      latenciaDeclarada: this.#latenciaDeclarada,
      permanent: this.#esArtefacte && this.#permanent,
      // Efectes i artefactes amb tirada: dificultat mínima 1. Les armes i
      // armadures (s'activen amb l'atac o sempre actives) no en tenen.
      autoDificultat: !this.#esArtefacte || this.#categoria === "dispositiu"
    });
  }

  /** Opcions `{id, nom}` d'una taula de `CONFIG.FORJA.PARAMETRES`. */
  static #opcions(llista) {
    return (llista ?? []).map(e => ({ id: e.id, nom: e.nom }));
  }

  /**
   * Camps editables de cada tipus de paràmetre: `{ camp, etiqueta, tipus,
   * valor, opcions }` (`tipus`: "number", "select" o "checkbox").
   */
  #campsParametre(param) {
    const P = CONFIG.FORJA.PARAMETRES;
    const op = DiategConstructor.#opcions;
    const habilitats = [{ id: "", nom: game.i18n.localize("FORJA.Construccio.ATriar") },
      ...CONFIG.FORJA.LLISTA_HABILITATS.map(h => ({ id: h.id, nom: game.i18n.localize(h.nom) }))];
    const atributs = [{ id: "", nom: game.i18n.localize("FORJA.Construccio.ATriar") },
      ...CONFIG.FORJA.ATRIBUTS.map(a => ({ id: a, nom: a }))];
    const trets = [{ id: "", nom: game.i18n.localize("FORJA.Construccio.ATriar") },
      ...(CONFIG.FORJA.LLISTA_TRETS ?? []).map(t => ({ id: t.id, nom: `${t.nom} (${t.cost})` }))];
    const num = (camp, min = 0) => ({ camp, tipus: "number", min });
    const sel = (camp, opcions) => ({ camp, tipus: "select", opcions });
    const definicio = {
      activacio:        [sel("mode", op(P.artefacteActivacio).filter(o => o.id !== "normal"))],
      recarrega:        [num("unitats")],
      acumulador:       [num("carregues")],
      arma:             [sel("base", op(P.armesBase)), num("latencia", -12), num("dany")],
      armaduraBase:     [sel("base", op(P.armaduresBase)), num("latencia", -12), num("proteccio")],
      dany:             [sel("categoria", op(P.danyCategoria)), num("nivell"), sel("danyTipus", op(P.danyTipus))],
      cura:             [sel("pista", op(P.curacio)), num("nivell")],
      armadura:         [num("nivell")],
      egida:            [num("nivell")],
      barrera:          [num("nivell")],
      eina:             [sel("habilitat", habilitats), num("nivell"), { camp: "segona", tipus: "checkbox" }],
      autoeina:         [sel("habilitat", habilitats), num("nivell"), { camp: "segona", tipus: "checkbox" }],
      alterarPercepcio: [num("nivell")],
      illusio:          [num("nivell")],
      estat:            [sel("estat", op(P.estats)), num("nivell")],
      atribut:          [sel("atribut", atributs), num("nivell", 1)],
      tret:             [sel("tret", trets), num("cost", -100)],
      transformacio:    [num("costAlterEgo")],
      translocacio:     [sel("mode", op(P.translocacioTipus)), sel("distancia", op(P.translocacioDistancia))],
      mental:           [sel("mode", op(P.mentals))],
      telecinesi:       [sel("categoria", op(P.telecinesi))],
      replicacio:       [sel("massa", op(P.replicacioMassa)), sel("complexitat", op(P.replicacioComplexitat))],
      invocacio:        [num("costCriatura")]
    }[param.tipus] ?? [];
    return definicio.map(c => ({
      ...c,
      etiqueta: game.i18n.localize(`FORJA.Construccio.Camp.${c.camp}`),
      valor: param[c.camp] ?? (c.tipus === "checkbox" ? false : "")
    }));
  }

  async _prepareContext(options) {
    const resultat = this.#calcular();
    const tipusPermesos = TIPUS_PARAMETRE.filter(t => this.#esArtefacte
      || !["activacio", "recarrega", "acumulador", "espera", "arma", "armaduraBase"].includes(t));
    return {
      esArtefacte: this.#esArtefacte,
      nom: this.#nom,
      do: this.#do,
      categoria: this.#categoria,
      categories: ["dispositiu", "arma", "armadura", "permanent"].map(id => ({
        id, nom: game.i18n.localize(`FORJA.Artefacte.Categoria.${id}`)
      })),
      permanent: this.#permanent,
      dificultatDeclarada: this.#dificultatDeclarada,
      latenciaDeclarada: this.#latenciaDeclarada,
      declaraDificultat: this.#dificultatDeclarada != null,
      declaraLatencia: this.#latenciaDeclarada != null,
      dons: ["canalitzacio", "magia", "psi", "qi"].map(id => ({ id, nom: game.i18n.localize(`FORJA.Sobrenatural.Do.${id}`) })),
      files: this.#parametres.map((param, idx) => ({
        idx,
        nom: game.i18n.localize(`FORJA.Construccio.Param.${param.tipus}`),
        camps: this.#campsParametre(param)
      })),
      tipusPermesos: tipusPermesos.map(id => ({ id, nom: game.i18n.localize(`FORJA.Construccio.Param.${id}`) })),
      resultat
    };
  }

  async _onRender(context, options) {
    await super._onRender?.(context, options);
    const el = this.element;
    const reRender = () => this.render(false);
    const enter = (v) => (v === "" || v == null ? null : parseInt(v));

    el.querySelector("input[name='nom']")?.addEventListener("change", ev => { this.#nom = ev.target.value; });
    el.querySelector("select[name='do']")?.addEventListener("change", ev => { this.#do = ev.target.value; });
    el.querySelector("select[name='categoria']")?.addEventListener("change", ev => { this.#categoria = ev.target.value; reRender(); });
    el.querySelector("input[name='permanent']")?.addEventListener("change", ev => { this.#permanent = ev.target.checked; reRender(); });

    el.querySelector("input[name='declaraDificultat']")?.addEventListener("change", ev => {
      this.#dificultatDeclarada = ev.target.checked ? (this.#calcular().dificultatCalculada || 1) : null;
      reRender();
    });
    el.querySelector("input[name='dificultatDeclarada']")?.addEventListener("change", ev => {
      this.#dificultatDeclarada = enter(ev.target.value); reRender();
    });
    el.querySelector("input[name='declaraLatencia']")?.addEventListener("change", ev => {
      this.#latenciaDeclarada = ev.target.checked ? this.#calcular().latenciaCalculada : null;
      reRender();
    });
    el.querySelector("input[name='latenciaDeclarada']")?.addEventListener("change", ev => {
      this.#latenciaDeclarada = enter(ev.target.value); reRender();
    });

    // Camps dels paràmetres: data-idx (fila) i data-camp (clau del paràmetre).
    el.querySelectorAll("[data-camp]").forEach(input => {
      input.addEventListener("change", ev => {
        const param = this.#parametres[Number(input.dataset.idx)];
        if (!param) return;
        const camp = input.dataset.camp;
        let valor;
        if (input.type === "checkbox") valor = input.checked;
        else if (input.type === "number") valor = parseInt(input.value) || 0;
        else valor = input.value || null;
        param[camp] = valor;
        // Tret: el cost és el del catàleg (en valor absolut, manual › Alteració).
        if (param.tipus === "tret" && camp === "tret") {
          param.cost = Math.abs(CONFIG.FORJA.LLISTA_TRETS?.find(t => t.id === valor)?.cost ?? 0);
        }
        reRender();
      });
    });
  }

  static _onAfegirParametre(event, target) {
    const tipus = this.element.querySelector("select[name='nouParametre']")?.value;
    if (!tipus) return;
    this.#parametres.push({ tipus, ...foundry.utils.deepClone(PARAMETRE_PER_DEFECTE[tipus] ?? {}) });
    this.render(false);
  }

  static _onTreureParametre(event, target) {
    this.#parametres.splice(Number(target.dataset.idx), 1);
    this.render(false);
  }

  static async _onSubmit(event, form, formData) {
    const resultat = this.#calcular();
    const tipusParams = new Set(this.#parametres.map(p => p.tipus));
    const nom = this.#nom?.trim() || game.i18n.localize(
      this.#esArtefacte ? "FORJA.Construccio.ArtefacteSenseNom" : "FORJA.Construccio.EfecteSenseNom"
    );
    const mecanica = resultat.desglossament.map(l => l.etiqueta).join(". ") + ".";
    const us = { narratiu: true, actiu: !tipusParams.has("narratiu") && !tipusParams.has("ritual") };
    const comu = {
      nom, cost: resultat.cost, dificultat: resultat.dificultat, modLatencia: resultat.latencia, us, mecanica,
      parametres: foundry.utils.deepClone(this.#parametres),
      construccio: {
        dificultatDeclarada: this.#dificultatDeclarada,
        latenciaDeclarada: this.#latenciaDeclarada,
        permanent: this.#esArtefacte && this.#permanent
      }
    };

    if (this.#esArtefacte) {
      const activacio = this.#parametres.find(p => p.tipus === "activacio")?.mode;
      const senseTirada = this.#permanent || this.#categoria === "arma" || this.#categoria === "armadura";
      this.#resolve?.({
        ...comu,
        esArtefacte: true,
        categoria: this.#permanent && this.#categoria === "dispositiu" ? "permanent" : this.#categoria,
        activacioId: this.#permanent ? "permanent" : (activacio ?? (senseTirada ? "cap" : "normal")),
        dificultat: senseTirada ? null : resultat.dificultat
      });
      this.#resolve = null;
      return;
    }

    this.#resolve?.({ ...comu, do: this.#do, tipus: tipusParams.has("ritual") ? "ritual" : "efecte" });
    this.#resolve = null;
  }

  async close(options = {}) {
    this.#resolve?.(null);
    this.#resolve = null;
    return super.close(options);
  }

  static obrir(config = {}) {
    return new Promise(resolve => {
      const dlg = new DiategConstructor(config);
      dlg.#resolve = resolve;
      dlg.render(true);
    });
  }
}
