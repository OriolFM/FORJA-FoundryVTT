import {
  calcularParametres, tipusParametrePermesos, valorsBaseParametre, PARAMETRE_PER_DEFECTE, TIPUS_NOMES_ARTEFACTE,
  CAMPS_PARAMETRE
} from "../progressio/construccio.mjs";
import { armaDeArtefacte, armaduresDeArtefacte } from "../combat/resultat-parametres.mjs";

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
 *   - `inicial`: `{ nom, do, parametres, construccio, categoria, descripcio }`
 *     per partir d'un efecte o artefacte existent (p. ex. per millorar-lo).
 * Resol amb `{ nom, cost, dificultat, modLatencia, us, mecanica, descripcio,
 * descripcioCanviada, parametres, construccio, ... }`, o `null` si es tanca.
 * `descripcio` és HTML (del quadre de text); `descripcioCanviada` diu si
 * l'usuari l'ha tocat, perquè en editar un ítem no se n'esborri el format.
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
      mostrarParametres: DiategConstructor._onMostrarParametres,
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
  #descripcio = "";
  #descripcioInicial = "";
  /** La llista de paràmetres per afegir és oberta (botó «Afegir»). */
  #mostrarLlista = false;

  constructor(config = {}, options = {}) {
    super(options);
    this.#esArtefacte = !!config.esArtefacte;
    const i = config.inicial ?? {};
    this.#nom = i.nom ?? "";
    this.#descripcio = this.#descripcioInicial = DiategConstructor.#htmlAText(i.descripcio ?? "");
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
    // Trets: positius i negatius per separat, cadascun per ordre alfabètic.
    const tretsDe = (positiu) => (CONFIG.FORJA.LLISTA_TRETS ?? [])
      .filter(t => (t.positiu ?? t.cost >= 0) === positiu)
      .map(t => ({ id: t.id, nom: `${t.nom} (${t.cost})` }))
      .sort(DiategConstructor.#perNom);
    const trets = [{ id: "", nom: game.i18n.localize("FORJA.Construccio.ATriar") }];
    const grupsTrets = [
      { nom: game.i18n.localize("FORJA.Construccio.TretsPositius"), opcions: tretsDe(true) },
      { nom: game.i18n.localize("FORJA.Construccio.TretsNegatius"), opcions: tretsDe(false) }
    ];
    // Definició compartida amb l'editor de compendis (construccio.mjs).
    const externes = { "@habilitats": habilitats, "@atributs": atributs, "@trets": trets };
    const definicio = (CAMPS_PARAMETRE[param.tipus] ?? []).map(c => {
      if (c.tipus !== "select") return c;
      const opcions = externes[c.taula] ?? op(P[c.taula]).filter(o => !c.exclou?.includes(o.id));
      return { ...c, opcions, grups: c.taula === "@trets" ? grupsTrets : null };
    });
    return definicio.map(c => ({
      ...c,
      etiqueta: game.i18n.localize(`FORJA.Construccio.Camp.${c.camp}`),
      valor: param[c.camp] ?? (c.tipus === "checkbox" ? false : "")
    }));
  }

  async _prepareContext(options) {
    const resultat = this.#calcular();
    // Ritual només per a efectes; activació, recàrrega, acumulador, mode
    // d'espera i armes/armadures base només per a artefactes.
    const tipusPermesos = tipusParametrePermesos(this.#esArtefacte);
    // Un paràmetre que no correspon (p. ex. d'un ítem antic) es mostra amb un avís.
    for (const p of this.#parametres) {
      if (!tipusPermesos.includes(p.tipus)) {
        resultat.avisos.push(game.i18n.format(
          this.#esArtefacte ? "FORJA.Construccio.NomesEfecte" : "FORJA.Construccio.NomesArtefacte",
          { param: game.i18n.localize(`FORJA.Construccio.Param.${p.tipus}`) }
        ));
      }
    }
    // Llista per afegir, per ordre alfabètic; als artefactes, els paràmetres
    // propis d'artefacte en un grup a part, al principi.
    const ambNom = (id) => ({ id, nom: game.i18n.localize(`FORJA.Construccio.Param.${id}`) });
    const grupsParametres = this.#esArtefacte
      ? [
        { nom: game.i18n.localize("FORJA.Construccio.GrupArtefacte"),
          tipus: tipusPermesos.filter(t => TIPUS_NOMES_ARTEFACTE.includes(t)).map(ambNom).sort(DiategConstructor.#perNom) },
        { nom: game.i18n.localize("FORJA.Construccio.GrupGeneral"),
          tipus: tipusPermesos.filter(t => !TIPUS_NOMES_ARTEFACTE.includes(t)).map(ambNom).sort(DiategConstructor.#perNom) }
      ]
      : [{ nom: null, tipus: tipusPermesos.map(ambNom).sort(DiategConstructor.#perNom) }];
    return {
      esArtefacte: this.#esArtefacte,
      nom: this.#nom,
      descripcio: this.#descripcio,
      mostrarLlista: this.#mostrarLlista,
      grupsParametres,
      resultants: this.#resultants(resultat),
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
      resultat
    };
  }

  /** Ordre alfabètic per `nom`, segons l'idioma de Foundry. */
  static #perNom(a, b) {
    return String(a.nom).localeCompare(String(b.nom), game.i18n.lang, { sensitivity: "base" });
  }

  /**
   * L'arma i l'armadura que en resultaran, amb la base i el que s'hi suma
   * (les mateixes funcions que fan servir els artefactes en joc).
   * @returns {string[]}
   */
  #resultants(resultat) {
    if (!this.#esArtefacte) return [];
    const artefacte = { system: { parametres: this.#parametres, us: { modLatencia: resultat.latencia } } };
    const linies = [];
    const arma = armaDeArtefacte(artefacte, CONFIG.FORJA.CATALEG_ARMES);
    if (arma) linies.push(game.i18n.format("FORJA.Construccio.ArmaResultant", { dany: arma.danyBase, latencia: arma.modLatencia }));
    const base = this.#parametres.some(p => p.tipus === "armaduraBase");
    const armadura = base ? armaduresDeArtefacte(artefacte)[0] : null;
    if (armadura) linies.push(game.i18n.format("FORJA.Construccio.ArmaduraResultant", { proteccio: armadura.reduccio, latencia: armadura.modLatencia }));
    return linies;
  }

  /** Text d'un camp HTML (descripció) per al quadre de text. */
  static #htmlAText(html) {
    if (!html) return "";
    const div = document.createElement("div");
    div.innerHTML = String(html).replace(/<\/p>\s*<p[^>]*>/gi, "\n\n").replace(/<br\s*\/?>/gi, "\n");
    return div.textContent.trim();
  }

  /** Text del quadre de descripció → HTML (un paràgraf per bloc). */
  static #textAHtml(text) {
    const esc = (s) => foundry.utils.escapeHTML ? foundry.utils.escapeHTML(s)
      : s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return String(text ?? "").trim().split(/\n\s*\n/).filter(Boolean)
      .map(p => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  }

  async _onRender(context, options) {
    await super._onRender?.(context, options);
    const el = this.element;
    const reRender = () => this.render(false);
    const enter = (v) => (v === "" || v == null ? null : parseInt(v));

    el.querySelector("input[name='nom']")?.addEventListener("input", ev => { this.#nom = ev.target.value; });
    el.querySelector("textarea[name='descripcio']")?.addEventListener("input", ev => { this.#descripcio = ev.target.value; });

    // Els botons no prenen el focus: si no, el clic que treu el focus d'un camp
    // editat el re-renderitza i el clic es perd (calia clicar dues vegades la creu).
    el.querySelectorAll("[data-action]").forEach(b => b.addEventListener("mousedown", ev => ev.preventDefault()));
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
      const llegir = () => {
        const param = this.#parametres[Number(input.dataset.idx)];
        if (!param) return null;
        const camp = input.dataset.camp;
        if (input.type === "checkbox") param[camp] = input.checked;
        else if (input.type === "number") param[camp] = parseInt(input.value) || 0;
        else param[camp] = input.value || null;
        return { param, camp, valor: param[camp] };
      };
      // Els números es desen mentre s'escriu (sense re-render) i es recalcula en sortir.
      if (input.type === "number") input.addEventListener("input", llegir);
      input.addEventListener("change", ev => {
        const l = llegir();
        if (!l) return;
        const { param, camp, valor } = l;
        // Tret: el cost és el del catàleg (en valor absolut, manual › Alteració).
        if (param.tipus === "tret" && camp === "tret") {
          param.cost = Math.abs(CONFIG.FORJA.LLISTA_TRETS?.find(t => t.id === valor)?.cost ?? 0);
        }
        // Arma o armadura base: es carreguen la latència i el dany/protecció de
        // la base (manual › Artefactes basats en armes i armadures, l. 4163).
        if (camp === "base") Object.assign(param, valorsBaseParametre(param.tipus, valor) ?? {});
        reRender();
      });
    });
  }

  /** Obre o tanca la llista de paràmetres per afegir. */
  static _onMostrarParametres(event, target) {
    this.#mostrarLlista = !this.#mostrarLlista;
    this.render(false);
  }

  /** Afegeix el paràmetre clicat a la llista (`data-tipus`) i la tanca. */
  static _onAfegirParametre(event, target) {
    const tipus = target.dataset.tipus;
    if (!tipus) return;
    this.#parametres.push({ tipus, ...foundry.utils.deepClone(PARAMETRE_PER_DEFECTE[tipus] ?? {}) });
    this.#mostrarLlista = false;
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
      descripcio: DiategConstructor.#textAHtml(this.#descripcio),
      descripcioCanviada: this.#descripcio.trim() !== this.#descripcioInicial.trim(),
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
