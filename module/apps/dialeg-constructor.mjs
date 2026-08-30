import { calcularConstruccio } from "../progressio/construccio.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Constructor d'efectes sobrenaturals i artefactes a mida (S-23/S-30,
 * "nucli" — vegeu `progressio/construccio.mjs` per l'abast exacte de
 * categories cobertes). Recalcula cost/dificultat/latència en directe a
 * cada canvi (re-render complet: hi ha massa camps interdependents per
 * pedaçar el DOM a mà, a diferència dels diàlegs més petits com
 * `DiategManifestar`).
 *
 * `obrir({ esArtefacte: true })` (S-30) canvia el mode: s'amaga "Do" i
 * "Efecte/Ritual" (no apliquen a un artefacte, que és tecnologia, no un
 * do sobrenatural) i es mostren els paràmetres exclusius d'artefacte
 * (Activació, Mode d'espera). El mode es fixa en obrir el diàleg — no hi
 * ha manera de canviar-lo a mig formulari, cada mode té la seva pròpia
 * entrada des de la fitxa ("Construir efecte nou" / "Dissenyar artefacte
 * nou").
 */
export default class DiategConstructor extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "forja-dialeg-constructor",
    classes: ["forja", "forja-dialog", "dialeg-constructor"],
    tag: "form",
    position: { width: 520, height: 700 },
    window: { title: "FORJA.Construccio.Titol", resizable: true },
    form: { closeOnSubmit: true, handler: DiategConstructor._onSubmit },
    actions: {
      afegirEstat:    DiategConstructor._onAfegirEstat,
      treureEstat:    DiategConstructor._onTreureEstat,
      afegirHabilitat: DiategConstructor._onAfegirHabilitat,
      treureHabilitat: DiategConstructor._onTreureHabilitat
    }
  };

  static PARTS = {
    form: { template: "systems/forja/templates/actor/dialeg-constructor.hbs", scrollable: [".dc-cos"] }
  };

  #resolve = null;
  #esArtefacte = false;
  #nom = "";
  #do = "canalitzacio";
  #activacioId = "normal";
  #modeEsperaId = "cap";
  #seleccio = {
    tipus: "efecte", abast: "toc", objectius: "individuals", durada: "instantania",
    usTemps: "ambdos", usAccio: "accio",
    danyActiu: false, dany: { categoria: "indirecte", tipus: "fatiga", nivell: 1 },
    curacioActiva: false, curacio: { tipus: "fatiga", nivell: 1, extra: [] },
    proteccioActiva: false, proteccio: { tipus: "armadura", nivell: 1 },
    estats: [],
    habilitats: [],
    // ── Categories exòtiques (afegides després del nucli original) ──
    percepcioActiva:     false, percepcio:     { tipus: "alterar", nivell: 1 },
    alteracioActiva:     false, alteracio:     { mode: "atribut", nivellAtribut: 1, costTret: 0 },
    transformacioActiva: false, transformacio: { costAlterEgo: 0 },
    translocacioActiva:  false, translocacio:  { tipus: "translocacio", distancia: "curta" },
    mentalsActiu:        false, mentals:       { tipus: "llegir" },
    telecinesiActiva:    false, telecinesi:    { categoria: "alfa" },
    replicacioActiva:    false, replicacio:    { massa: "menys-1kg", complexitat: "materia-primera" },
    invocacioActiva:     false, invocacio:     { costCriatura: 0 }
  };

  constructor(config = {}, options = {}) {
    super(options);
    this.#esArtefacte = !!config.esArtefacte;
  }

  get title() {
    return game.i18n.localize(this.#esArtefacte ? "FORJA.Construccio.TitolArtefacte" : "FORJA.Construccio.Titol");
  }

  async _prepareContext(options) {
    const P = CONFIG.FORJA.PARAMETRES;
    const s = this.#seleccio;

    // Selecció efectiva per calcular (només inclou cada bloc si està actiu)
    const perCalcul = {
      ...s,
      dany:          s.danyActiu ? s.dany : null,
      curacio:       s.curacioActiva ? s.curacio : null,
      proteccio:     s.proteccioActiva ? s.proteccio : null,
      artefacte:     this.#esArtefacte ? { activacioId: this.#activacioId, modeEsperaId: this.#modeEsperaId } : null,
      percepcio:     s.percepcioActiva ? s.percepcio : null,
      alteracio:     s.alteracioActiva ? s.alteracio : null,
      transformacio: s.transformacioActiva ? s.transformacio : null,
      translocacio:  s.translocacioActiva ? s.translocacio : null,
      mentals:       s.mentalsActiu ? s.mentals : null,
      telecinesi:    s.telecinesiActiva ? s.telecinesi : null,
      replicacio:    s.replicacioActiva ? s.replicacio : null,
      invocacio:     s.invocacioActiva ? s.invocacio : null
    };
    const resultat = calcularConstruccio(perCalcul);

    return {
      esArtefacte: this.#esArtefacte,
      nom: this.#nom,
      do: this.#do,
      activacioId: this.#activacioId,
      modeEsperaId: this.#modeEsperaId,
      s,
      resultat,
      P,
      dons: ["canalitzacio", "magia", "psi", "qi"].map(id => ({ id, nom: game.i18n.localize(`FORJA.Sobrenatural.Do.${id}`) })),
      estatsDisponibles: P.estats.filter(e => !s.estats.some(sel => sel.id === e.id)),
      habilitatsTotes: CONFIG.FORJA.LLISTA_HABILITATS.map(h => ({ id: h.id, nom: game.i18n.localize(h.nom) })),
      habilitatsDisponibles: CONFIG.FORJA.LLISTA_HABILITATS
        .filter(h => !s.habilitats.some(sel => sel.id === h.id))
        .map(h => ({ id: h.id, nom: game.i18n.localize(h.nom) }))
    };
  }

  async _onRender(context, options) {
    super._onRender?.(context, options);
    const el = this.element;
    const reRender = () => this.render(false);

    el.querySelector("input[name='nom']")?.addEventListener("change", ev => { this.#nom = ev.target.value; });
    el.querySelector("select[name='do']")?.addEventListener("change", ev => { this.#do = ev.target.value; });
    el.querySelector("select[name='activacioId']")?.addEventListener("change", ev => { this.#activacioId = ev.target.value; reRender(); });
    el.querySelector("select[name='modeEsperaId']")?.addEventListener("change", ev => { this.#modeEsperaId = ev.target.value; reRender(); });

    const camps = ["tipus", "abast", "objectius", "durada", "usTemps", "usAccio"];
    for (const camp of camps) {
      el.querySelectorAll(`[name='${camp}']`).forEach(input => {
        input.addEventListener("change", ev => { this.#seleccio[camp] = ev.target.value; reRender(); });
      });
    }

    el.querySelector("input[name='danyActiu']")?.addEventListener("change", ev => { this.#seleccio.danyActiu = ev.target.checked; reRender(); });
    el.querySelector("select[name='dany.categoria']")?.addEventListener("change", ev => { this.#seleccio.dany.categoria = ev.target.value; reRender(); });
    el.querySelector("select[name='dany.tipus']")?.addEventListener("change", ev => { this.#seleccio.dany.tipus = ev.target.value; reRender(); });
    el.querySelector("input[name='dany.nivell']")?.addEventListener("change", ev => { this.#seleccio.dany.nivell = Math.max(1, parseInt(ev.target.value) || 1); reRender(); });

    el.querySelector("input[name='curacioActiva']")?.addEventListener("change", ev => { this.#seleccio.curacioActiva = ev.target.checked; reRender(); });
    el.querySelector("select[name='curacio.tipus']")?.addEventListener("change", ev => { this.#seleccio.curacio.tipus = ev.target.value; reRender(); });
    el.querySelector("input[name='curacio.nivell']")?.addEventListener("change", ev => { this.#seleccio.curacio.nivell = Math.max(1, parseInt(ev.target.value) || 1); reRender(); });
    el.querySelectorAll("input[name='curacio.extra']").forEach(input => {
      input.addEventListener("change", () => {
        this.#seleccio.curacio.extra = [...el.querySelectorAll("input[name='curacio.extra']:checked")].map(i => i.value);
        reRender();
      });
    });

    el.querySelector("input[name='proteccioActiva']")?.addEventListener("change", ev => { this.#seleccio.proteccioActiva = ev.target.checked; reRender(); });
    el.querySelector("select[name='proteccio.tipus']")?.addEventListener("change", ev => { this.#seleccio.proteccio.tipus = ev.target.value; reRender(); });
    el.querySelector("input[name='proteccio.nivell']")?.addEventListener("change", ev => { this.#seleccio.proteccio.nivell = Math.max(1, parseInt(ev.target.value) || 1); reRender(); });

    el.querySelectorAll(".dc-nivell-estat").forEach(input => {
      input.addEventListener("change", ev => {
        const id = ev.target.dataset.id;
        const entrada = this.#seleccio.estats.find(e => e.id === id);
        if (entrada) entrada.nivell = Math.max(1, parseInt(ev.target.value) || 1);
        reRender();
      });
    });
    el.querySelectorAll(".dc-nivell-habilitat").forEach(input => {
      input.addEventListener("change", ev => {
        const id = ev.target.dataset.id;
        const entrada = this.#seleccio.habilitats.find(h => h.id === id);
        if (entrada) entrada.nivell = Math.max(1, parseInt(ev.target.value) || 1);
        reRender();
      });
    });

    // ── Categories exòtiques ──
    el.querySelector("input[name='percepcioActiva']")?.addEventListener("change", ev => { this.#seleccio.percepcioActiva = ev.target.checked; reRender(); });
    el.querySelector("select[name='percepcio.tipus']")?.addEventListener("change", ev => { this.#seleccio.percepcio.tipus = ev.target.value; reRender(); });
    el.querySelector("input[name='percepcio.nivell']")?.addEventListener("change", ev => { this.#seleccio.percepcio.nivell = Math.max(1, parseInt(ev.target.value) || 1); reRender(); });

    el.querySelector("input[name='alteracioActiva']")?.addEventListener("change", ev => { this.#seleccio.alteracioActiva = ev.target.checked; reRender(); });
    el.querySelectorAll("input[name='alteracio.mode']").forEach(radio => {
      radio.addEventListener("change", ev => { this.#seleccio.alteracio.mode = ev.target.value; reRender(); });
    });
    el.querySelector("input[name='alteracio.nivellAtribut']")?.addEventListener("change", ev => { this.#seleccio.alteracio.nivellAtribut = Math.max(1, parseInt(ev.target.value) || 1); reRender(); });
    el.querySelector("input[name='alteracio.costTret']")?.addEventListener("change", ev => { this.#seleccio.alteracio.costTret = parseInt(ev.target.value) || 0; reRender(); });

    el.querySelector("input[name='transformacioActiva']")?.addEventListener("change", ev => { this.#seleccio.transformacioActiva = ev.target.checked; reRender(); });
    el.querySelector("input[name='transformacio.costAlterEgo']")?.addEventListener("change", ev => { this.#seleccio.transformacio.costAlterEgo = Math.max(0, parseInt(ev.target.value) || 0); reRender(); });

    el.querySelector("input[name='translocacioActiva']")?.addEventListener("change", ev => { this.#seleccio.translocacioActiva = ev.target.checked; reRender(); });
    el.querySelector("select[name='translocacio.tipus']")?.addEventListener("change", ev => { this.#seleccio.translocacio.tipus = ev.target.value; reRender(); });
    el.querySelector("select[name='translocacio.distancia']")?.addEventListener("change", ev => { this.#seleccio.translocacio.distancia = ev.target.value; reRender(); });

    el.querySelector("input[name='mentalsActiu']")?.addEventListener("change", ev => { this.#seleccio.mentalsActiu = ev.target.checked; reRender(); });
    el.querySelector("select[name='mentals.tipus']")?.addEventListener("change", ev => { this.#seleccio.mentals.tipus = ev.target.value; reRender(); });

    el.querySelector("input[name='telecinesiActiva']")?.addEventListener("change", ev => { this.#seleccio.telecinesiActiva = ev.target.checked; reRender(); });
    el.querySelector("select[name='telecinesi.categoria']")?.addEventListener("change", ev => { this.#seleccio.telecinesi.categoria = ev.target.value; reRender(); });

    el.querySelector("input[name='replicacioActiva']")?.addEventListener("change", ev => { this.#seleccio.replicacioActiva = ev.target.checked; reRender(); });
    el.querySelector("select[name='replicacio.massa']")?.addEventListener("change", ev => { this.#seleccio.replicacio.massa = ev.target.value; reRender(); });
    el.querySelector("select[name='replicacio.complexitat']")?.addEventListener("change", ev => { this.#seleccio.replicacio.complexitat = ev.target.value; reRender(); });

    el.querySelector("input[name='invocacioActiva']")?.addEventListener("change", ev => { this.#seleccio.invocacioActiva = ev.target.checked; reRender(); });
    el.querySelector("input[name='invocacio.costCriatura']")?.addEventListener("change", ev => { this.#seleccio.invocacio.costCriatura = Math.max(0, parseInt(ev.target.value) || 0); reRender(); });
  }

  static _onAfegirEstat(event, target) {
    const select = this.element.querySelector("select[name='novEstat']");
    const id = select?.value;
    if (!id || this.#seleccio.estats.some(e => e.id === id)) return;
    this.#seleccio.estats.push({ id, nivell: 1 });
    this.render(false);
  }

  static _onTreureEstat(event, target) {
    this.#seleccio.estats = this.#seleccio.estats.filter(e => e.id !== target.dataset.id);
    this.render(false);
  }

  static _onAfegirHabilitat(event, target) {
    if (this.#seleccio.habilitats.length >= 2) return; // taula "nucli" només cobreix 1a/2a habilitat
    const select = this.element.querySelector("select[name='novaHabilitat']");
    const id = select?.value;
    if (!id || this.#seleccio.habilitats.some(h => h.id === id)) return;
    this.#seleccio.habilitats.push({ id, nivell: 1 });
    this.render(false);
  }

  static _onTreureHabilitat(event, target) {
    this.#seleccio.habilitats = this.#seleccio.habilitats.filter(h => h.id !== target.dataset.id);
    this.render(false);
  }

  static async _onSubmit(event, form, formData) {
    const s = this.#seleccio;
    const perCalcul = {
      ...s,
      dany:          s.danyActiu ? s.dany : null,
      curacio:       s.curacioActiva ? s.curacio : null,
      proteccio:     s.proteccioActiva ? s.proteccio : null,
      artefacte:     this.#esArtefacte ? { activacioId: this.#activacioId, modeEsperaId: this.#modeEsperaId } : null,
      percepcio:     s.percepcioActiva ? s.percepcio : null,
      alteracio:     s.alteracioActiva ? s.alteracio : null,
      transformacio: s.transformacioActiva ? s.transformacio : null,
      translocacio:  s.translocacioActiva ? s.translocacio : null,
      mentals:       s.mentalsActiu ? s.mentals : null,
      telecinesi:    s.telecinesiActiva ? s.telecinesi : null,
      replicacio:    s.replicacioActiva ? s.replicacio : null,
      invocacio:     s.invocacioActiva ? s.invocacio : null
    };
    const resultat = calcularConstruccio(perCalcul);
    const nom = this.#nom?.trim() || game.i18n.localize(
      this.#esArtefacte ? "FORJA.Construccio.ArtefacteSenseNom" : "FORJA.Construccio.EfecteSenseNom"
    );
    const mecanica = resultat.desglossament.map(l => l.etiqueta).join(". ") + ".";
    const us = { narratiu: s.usTemps !== "actiu-nomes", actiu: s.usTemps !== "narratiu" };

    if (this.#esArtefacte) {
      this.#resolve?.({
        esArtefacte: true,
        nom,
        activacioId: this.#activacioId,
        dificultat: resultat.dificultat,
        modLatencia: resultat.latencia,
        cost: resultat.cost,
        us,
        mecanica
      });
      return;
    }

    this.#resolve?.({
      nom,
      do: formData.object.do,
      tipus: s.tipus,
      dificultat: resultat.dificultat,
      modLatencia: resultat.latencia,
      cost: resultat.cost,
      us,
      mecanica
    });
  }

  async close(options = {}) {
    this.#resolve?.(null);
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
