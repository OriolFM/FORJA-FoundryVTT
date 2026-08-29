import { calcularConstruccio } from "../progressio/construccio.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Constructor d'efectes sobrenaturals a mida (S-23, "nucli" — vegeu
 * `progressio/construccio.mjs` per l'abast exacte de categories cobertes).
 * Recalcula cost/dificultat/latència en directe a cada canvi (re-render
 * complet: hi ha massa camps interdependents per pedaçar el DOM a mà, a
 * diferència dels diàlegs més petits com `DiategManifestar`).
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
  #nom = "";
  #seleccio = {
    tipus: "efecte", abast: "toc", objectius: "individuals", durada: "instantania",
    usTemps: "ambdos", usAccio: "accio",
    danyActiu: false, dany: { categoria: "indirecte", tipus: "fatiga", nivell: 1 },
    curacioActiva: false, curacio: { tipus: "fatiga", nivell: 1, extra: [] },
    proteccioActiva: false, proteccio: { tipus: "armadura", nivell: 1 },
    estats: [],
    habilitats: []
  };

  get title() {
    return game.i18n.localize("FORJA.Construccio.Titol");
  }

  async _prepareContext(options) {
    const P = CONFIG.FORJA.PARAMETRES;
    const s = this.#seleccio;

    // Selecció efectiva per calcular (només inclou dany/curació/protecció si estan actius)
    const perCalcul = {
      ...s,
      dany:      s.danyActiu ? s.dany : null,
      curacio:   s.curacioActiva ? s.curacio : null,
      proteccio: s.proteccioActiva ? s.proteccio : null
    };
    const resultat = calcularConstruccio(perCalcul);

    return {
      nom: this.#nom,
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
      dany:      s.danyActiu ? s.dany : null,
      curacio:   s.curacioActiva ? s.curacio : null,
      proteccio: s.proteccioActiva ? s.proteccio : null
    };
    const resultat = calcularConstruccio(perCalcul);
    const nom = this.#nom?.trim() || game.i18n.localize("FORJA.Construccio.EfecteSenseNom");
    const mecanica = resultat.desglossament.map(l => l.etiqueta).join(". ") + ".";

    this.#resolve?.({
      nom,
      do: formData.object.do,
      tipus: s.tipus,
      dificultat: resultat.dificultat,
      modLatencia: resultat.latencia,
      cost: resultat.cost,
      us: { narratiu: s.usTemps !== "actiu-nomes", actiu: s.usTemps !== "narratiu" },
      mecanica
    });
  }

  async close(options = {}) {
    this.#resolve?.(null);
    return super.close(options);
  }

  static obrir() {
    return new Promise(resolve => {
      const dlg = new DiategConstructor();
      dlg.#resolve = resolve;
      dlg.render(true);
    });
  }
}
