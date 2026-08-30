/**
 * Assistent de creació de PJ (M-03, 07_MILLORES_FUTUR.md): interfície pas a
 * pas sobre la validació ja existent (S-05, `avisosCoherencia`). No introdueix
 * cap regla nova ni cap camp nou a l'actor — muta l'actor directament amb els
 * mateixos camins que ja fa servir la fitxa en mode edició (`actor.update`,
 * `createEmbeddedDocuments`), només organitzats en passos guiats amb el cost
 * acumulat sempre visible. Mai bloqueja: es pot avançar de pas encara que el
 * pressupost estigui excedit (DA-5/G-3, "automatitza el càlcul, mai la
 * decisió") — els avisos de coherència ja existents se segueixen mostrant.
 */
import { FORJA } from "../config/constants.mjs";
import DiategTrets from "./dialeg-trets.mjs";
import DiategEquipament from "./dialeg-equipament.mjs";
import { avisosCoherencia } from "../validacio/coherencia.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const PASOS = ["identitat", "atributs", "cos", "habilitats", "trets", "equipament", "resum"];
const TITOL_PAS = {
  identitat:  "FORJA.Section.Identitat",
  atributs:   "FORJA.Section.Atributs",
  cos:        "FORJA.Section.AtributsSecundaris",
  habilitats: "FORJA.Tab.Habilitats",
  trets:      "FORJA.Section.Trets",
  equipament: "FORJA.Assistent.PasEquipament",
  resum:      "FORJA.Assistent.PasResum"
};

export default class AssistentCreacio extends HandlebarsApplicationMixin(ApplicationV2) {

  /** @type {ForjaActor} */
  #actor;
  /** @type {number} */
  #pasIdx = 0;

  static DEFAULT_OPTIONS = {
    id: "forja-assistent-creacio",
    tag: "div",
    classes: ["forja", "forja-assistent"],
    window: { title: "FORJA.Assistent.Boto", resizable: true },
    position: { width: 620, height: 640 },
    actions: {
      pasSeguent:       AssistentCreacio._onPasSeguent,
      pasEnrere:        AssistentCreacio._onPasEnrere,
      ajustarAtribut:   AssistentCreacio._onAjustarAtribut,
      aplicarDistribucioAtributs: AssistentCreacio._onAplicarDistribucioAtributs,
      ajustarMida:      AssistentCreacio._onAjustarMida,
      ajustarConstitucio: AssistentCreacio._onAjustarConstitucio,
      ajustarHabilitat: AssistentCreacio._onAjustarHabilitat,
      aplicarPaquetHabilitats: AssistentCreacio._onAplicarPaquetHabilitats,
      crearTret:        AssistentCreacio._onCrearTret,
      eliminarTret:     AssistentCreacio._onEliminarTret,
      crearArma:        AssistentCreacio._onCrearArma,
      crearArmadura:    AssistentCreacio._onCrearArmadura,
      crearArtefacte:   AssistentCreacio._onCrearArtefacte,
      eliminarItem:     AssistentCreacio._onEliminarItem,
      finalitzar:       AssistentCreacio._onFinalitzar
    }
  };

  static PARTS = {
    body: { template: "systems/forja/templates/actor/assistent-creacio.hbs", scrollable: [".as-cos"] }
  };

  constructor(actor, options = {}) {
    super(options);
    this.#actor = actor;
  }

  get title() {
    return game.i18n.format("FORJA.Assistent.Titol", { nom: this.#actor.name });
  }

  static obrir(actor) {
    const dlg = new AssistentCreacio(actor);
    dlg.render(true);
    return dlg;
  }

  // ── Context ─────────────────────────────────────────────────────────────

  async _prepareContext(options) {
    const actor = this.#actor;
    const sys   = actor.system;
    const cfg   = CONFIG.FORJA;
    const pas   = PASOS[this.#pasIdx];

    return {
      pas,
      pasIdx:    this.#pasIdx,
      pasTotal:  PASOS.length,
      pasTitol:  game.i18n.localize(TITOL_PAS[pas]),
      esPrimer:  this.#pasIdx === 0,
      esDarrer:  this.#pasIdx === PASOS.length - 1,
      actor,
      sys,
      pc: { total: sys.pc, gastats: sys.pcGastats ?? 0, lliures: sys.pcLliures ?? 0 },

      // Pas: identitat
      nom: actor.name,

      // Pas: atributs
      atributs: cfg.ATRIBUTS.map(attr => ({
        id: attr,
        nom: game.i18n.localize(`FORJA.Attr.${attr}`),
        val: sys.atributs[attr] ?? 0,
        cost: cfg.COST_ATRIBUT[sys.atributs[attr] ?? 0] ?? 0
      })),
      costAtributs: Object.values(sys.atributs).reduce((s, v) => s + (cfg.COST_ATRIBUT[v] ?? 0), 0),
      tramsAtribut: [0, 1, 2, 3, 4, 5].map(v => ({ val: v, cost: cfg.COST_ATRIBUT[v] })),
      distribucionsAtribut: Object.entries(cfg.DISTRIBUCIONS_ATRIBUT).map(([id, d]) => ({
        id, nom: game.i18n.localize(d.nom),
        cost: d.valors.reduce((s, v) => s + (cfg.COST_ATRIBUT[v] ?? 0), 0)
      })),

      // Pas: cos (espècie / mida / constitució)
      especies: Object.keys(cfg.COST_ESPECIE).map(id => ({
        id, nom: game.i18n.localize(`FORJA.Especie.${id}`), cost: cfg.COST_ESPECIE[id]
      })),
      mida:        { val: sys.mida,        cost: cfg.COST_MIDA[sys.mida]               ?? 0, nom: game.i18n.localize(`FORJA.Mida.${sys.mida}`) },
      constitucio: { val: sys.constitucio, cost: cfg.COST_CONSTITUCIO[sys.constitucio] ?? 0, nom: game.i18n.localize(`FORJA.Constitucio.${sys.constitucio}`) },
      costEspecie: cfg.COST_ESPECIE[sys.especie] ?? 0,

      // Pas: habilitats
      habilitats: _prepHabilitatsAssistent(sys, cfg),
      costHabilitats: Object.values(sys.habilitats).reduce((s, h) => s + (cfg.COST_HABILITAT[h.nivell] ?? 0), 0),
      paquetsHabilitat: Object.entries(cfg.PAQUETS_HABILITAT).map(([id, p]) => ({
        id, nom: game.i18n.localize(p.nom),
        cost: p.valors.reduce((s, v) => s + (cfg.COST_HABILITAT[v] ?? 0), 0)
      })),

      // Pas: trets
      trets: _prepTretsAssistent(actor),
      costTrets: actor.items.filter(i => i.type === "tret").reduce((s, i) => s + (i.system.cost ?? 0), 0),
      esDotatQi: sys.dotat === "qi",
      qiAtribut: sys.qiAtribut,

      // Pas: equipament
      armes:      actor.items.filter(i => i.type === "arma").map(_prepItemSimple),
      armadures:  actor.items.filter(i => i.type === "armadura").map(_prepItemSimple),
      artefactes: actor.items.filter(i => i.type === "artefacte").map(_prepItemSimple),

      // Pas: resum
      avisos: avisosCoherencia(actor)
    };
  }

  async _onRender(context, options) {
    super._onRender?.(context, options);
    const nomInput = this.element.querySelector("input[name='nom']");
    nomInput?.addEventListener("change", async ev => {
      await this.#actor.update({ name: ev.target.value });
      this.render(false);
    });
    const concepteInput = this.element.querySelector("input[name='system.concepte']");
    concepteInput?.addEventListener("change", async ev => {
      await this.#actor.update({ "system.concepte": ev.target.value });
    });
    const origenInput = this.element.querySelector("input[name='system.origen']");
    origenInput?.addEventListener("change", async ev => {
      await this.#actor.update({ "system.origen": ev.target.value });
    });
    const genereInput = this.element.querySelector("input[name='system.genere']");
    genereInput?.addEventListener("change", async ev => {
      await this.#actor.update({ "system.genere": ev.target.value });
    });
    const edatInput = this.element.querySelector("input[name='system.edat']");
    edatInput?.addEventListener("change", async ev => {
      await this.#actor.update({ "system.edat": parseInt(ev.target.value) || 0 });
    });
    const recursosInput = this.element.querySelector("input[name='system.recursos']");
    recursosInput?.addEventListener("change", async ev => {
      await this.#actor.update({ "system.recursos": ev.target.value });
    });
    const guanxiInput = this.element.querySelector("input[name='system.guanxi']");
    guanxiInput?.addEventListener("change", async ev => {
      await this.#actor.update({ "system.guanxi": ev.target.value });
    });
    const especieSelect = this.element.querySelector("select[name='system.especie']");
    especieSelect?.addEventListener("change", async ev => {
      await this.#actor.update({ "system.especie": ev.target.value });
      this.render(false);
    });
    const qiAtributSelect = this.element.querySelector("select[name='system.qiAtribut']");
    qiAtributSelect?.addEventListener("change", async ev => {
      await this.#actor.update({ "system.qiAtribut": ev.target.value });
    });
  }

  // ── Navegació ───────────────────────────────────────────────────────────

  static async _onPasSeguent() {
    this.#pasIdx = Math.min(PASOS.length - 1, this.#pasIdx + 1);
    this.render(false);
  }

  static async _onPasEnrere() {
    this.#pasIdx = Math.max(0, this.#pasIdx - 1);
    this.render(false);
  }

  static async _onFinalitzar() {
    this.close();
  }

  // ── Atributs / cos ──────────────────────────────────────────────────────

  static async _onAjustarAtribut(event, target) {
    const attr   = target.dataset.attr;
    const delta  = parseInt(target.dataset.delta);
    const actual = this.#actor.system.atributs[attr] ?? 0;
    const nou    = Math.max(0, Math.min(5, actual + delta));
    await this.#actor.update({ [`system.atributs.${attr}`]: nou });
    this.render(false);
  }

  /**
   * Drecera de creació (manual p. 354-361): aplica d'un cop els 6 valors
   * d'una distribució predefinida, en l'ordre de `FORJA.ATRIBUTS`. Punt de
   * partida ràpid, no una assignació definitiva — el jugador els pot seguir
   * reassignant amb els steppers normals, exactament igual que si els
   * hagués triat un a un.
   */
  static async _onAplicarDistribucioAtributs(event, target) {
    const dist = CONFIG.FORJA.DISTRIBUCIONS_ATRIBUT[target.dataset.distribucio];
    if (!dist) return;
    const updates = {};
    CONFIG.FORJA.ATRIBUTS.forEach((attr, i) => {
      updates[`system.atributs.${attr}`] = dist.valors[i] ?? 0;
    });
    await this.#actor.update(updates);
    this.render(false);
  }

  static async _onAjustarMida(event, target) {
    const delta  = parseInt(target.dataset.delta);
    const actual = this.#actor.system.mida ?? 3;
    const nou    = Math.max(1, Math.min(5, actual + delta));
    await this.#actor.update({ "system.mida": nou });
    this.render(false);
  }

  static async _onAjustarConstitucio(event, target) {
    const delta  = parseInt(target.dataset.delta);
    const actual = this.#actor.system.constitucio ?? 3;
    const nou    = Math.max(1, Math.min(5, actual + delta));
    await this.#actor.update({ "system.constitucio": nou });
    this.render(false);
  }

  static async _onAjustarHabilitat(event, target) {
    const habId  = target.dataset.habId;
    const delta  = parseInt(target.dataset.delta);
    const actual = this.#actor.system.habilitats[habId]?.nivell ?? 0;
    const nou    = Math.max(0, Math.min(10, actual + delta));
    await this.#actor.update({ [`system.habilitats.${habId}.nivell`]: nou });
    this.render(false);
  }

  /**
   * Drecera de creació (manual p. 400-421): aplica els valors d'un paquet
   * a les primeres habilitats BÀSIQUES encara a 0 (mateix ordre alfabètic
   * que mostra la UI). Només toca habilitats a 0 perquè es puguin combinar
   * diversos paquets sense sumar mai sobre la mateixa habilitat (regla del
   * manual: "sempre que no sumeu valors d'habilitat"). Les restringides
   * queden sempre fora — exigeixen tret/formació previs (manual p. 128).
   */
  static async _onAplicarPaquetHabilitats(event, target) {
    const pkg = CONFIG.FORJA.PAQUETS_HABILITAT[target.dataset.paquet];
    if (!pkg) return;
    const disponibles = _prepHabilitatsAssistent(this.#actor.system, CONFIG.FORJA)
      .filter(h => h.tipus === "basica" && h.nivell === 0);
    const updates = {};
    pkg.valors.forEach((val, i) => {
      const h = disponibles[i];
      if (h) updates[`system.habilitats.${h.id}.nivell`] = val;
    });
    if (Object.keys(updates).length) await this.#actor.update(updates);
    this.render(false);
  }

  // ── Trets ───────────────────────────────────────────────────────────────

  static async _onCrearTret() {
    const tret = await DiategTrets.obrir();
    if (!tret) return;
    await this.#actor.createEmbeddedDocuments("Item", [{
      name: tret.nom,
      type: "tret",
      system: { cost: tret.cost, descripcio: tret.descripcio ?? "", efecte: tret.efecte ?? null },
      flags: { forja: { catalegId: tret.id } }
    }]);
    this.render(false);
  }

  static async _onEliminarTret(event, target) {
    await this.#actor.deleteEmbeddedDocuments("Item", [target.dataset.tretId]);
    this.render(false);
  }

  // ── Equipament ──────────────────────────────────────────────────────────

  static async _onCrearArma() {
    const sel = await DiategEquipament.obrir("arma");
    if (!sel) return;
    const e = sel.entrada;
    await this.#actor.createEmbeddedDocuments("Item", [{
      name: e.nom, type: "arma",
      system: {
        categoria: e.categoria, modLatencia: e.modLatencia, abast: e.abast,
        danyBase: e.danyBase, maniobra: e.maniobra ?? "", rangExtrem: e.rangExtrem ?? false,
        descripcio: e.descripcio ?? ""
      }
    }]);
    this.render(false);
  }

  static async _onCrearArmadura() {
    const sel = await DiategEquipament.obrir("armadura");
    if (!sel) return;
    const e = sel.entrada;
    await this.#actor.createEmbeddedDocuments("Item", [{
      name: e.nom, type: "armadura",
      system: {
        tipus: e.tipus, reduccio: e.reduccio, modLatencia: e.modLatencia,
        egida: e.egida ?? { activa: false, absorcio: 0, tornsInactiva: 0 },
        descripcio: e.descripcio ?? ""
      }
    }]);
    this.render(false);
  }

  static async _onCrearArtefacte() {
    const sel = await DiategEquipament.obrir("artefacte");
    if (!sel) return;
    const e = sel.entrada;
    await this.#actor.createEmbeddedDocuments("Item", [{
      name: e.nom, type: "artefacte",
      system: {
        cost: e.cost, categoria: e.categoria, activacio: e.activacio ?? {},
        us: e.us ?? {}, carrega: e.carrega ?? {}, mecanica: e.mecanica ?? "",
        descripcio: e.descripcio ?? ""
      }
    }]);
    this.render(false);
  }

  static async _onEliminarItem(event, target) {
    await this.#actor.deleteEmbeddedDocuments("Item", [target.dataset.itemId]);
    this.render(false);
  }
}

/* ── Helpers de context ─────────────────────────────────────────────────── */

function _prepHabilitatsAssistent(sys, cfg) {
  return cfg.LLISTA_HABILITATS.map(h => ({
    id:     h.id,
    nom:    game.i18n.localize(h.nom),
    tipus:  h.tipus,
    nivell: sys.habilitats[h.id]?.nivell ?? 0,
    cost:   cfg.COST_HABILITAT[sys.habilitats[h.id]?.nivell ?? 0] ?? 0
  })).sort((a, b) => a.nom.localeCompare(b.nom, "ca"));
}

function _prepTretsAssistent(actor) {
  return actor.items
    .filter(i => i.type === "tret")
    .map(i => ({ id: i.id, nom: i.name, cost: i.system?.cost ?? 0 }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "ca"));
}

function _prepItemSimple(i) {
  return { id: i.id, nom: i.name };
}
