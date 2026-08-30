import { ferTirada }  from "../dice/tirada.mjs";
import DiategTrets    from "./dialeg-trets.mjs";
import DiategEquipament from "./dialeg-equipament.mjs";
import DiategCuracio  from "./dialeg-curacio.mjs";
import { _opcionsNumeriques, _prepSalut, _prepSobrenatural, _prepHabilitats, _prepTrets, _prepItems, _prepArtefactes, _prepEfectes } from "./full-personatge.mjs";
import { assegurarAtacsAutomatics } from "../combat/equipament-automatic.mjs";
import { ferCuracio, habilitatCuracio, aplicarReposNatural, potReferSePerSiSol } from "../combat/curacio.mjs";
import DiategManifestar from "./dialeg-manifestar.mjs";
import DiategResistir  from "./dialeg-resistir.mjs";
import { manifestarEfecte, potManifestar } from "../combat/manifestar.mjs";
import { opcioResistir, resoldreResistir } from "../combat/resistencia.mjs";
import { opcioContrarestar, resoldreContrarestar } from "../combat/contrarestar.mjs";
import { desferEfecte } from "../combat/desfer.mjs";
import DiategDesfer from "./dialeg-desfer.mjs";
import { activarArtefacte, recarregarArtefacte } from "../combat/artefactes.mjs";
import DiategConstructor from "./dialeg-constructor.mjs";
import { esPrototip, provarPrototip, repararPrototip, marcarProduccio } from "../progressio/rd-artefactes.mjs";
import { costTotalModular, afegirModul, treureModul } from "../progressio/modular.mjs";
import DiategProvarPrototip from "./dialeg-provar-prototip.mjs";
import DiategAccionsComplexes from "./dialeg-accions-complexes.mjs";
const { HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Fitxa de PNJ — mateix estil i motor que la fitxa de Personatge
 * (acordió, mode joc/edició, tirades, trets…), amb capçalera pròpia
 * (tier en lloc de concepte/origen) i sense PC/recursos.
 */
export default class FullPNJ extends HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {

  _acordio    = new Map();
  _seleccio   = { atribut: null, habId: null, armaId: null };
  _modeEdicio = false;

  static DEFAULT_OPTIONS = {
    classes: ["forja", "full-pnj"],
    position: { width: 680, height: 720 },
    window: { resizable: true },
    actions: {
      toggleSalut:      FullPNJ._onToggleSalut,
      toggleMarca:      FullPNJ._onToggleMarca,
      toggleSection:    FullPNJ._onToggleSection,
      toggleModeEdicio: FullPNJ._onToggleModeEdicio,
      // Mode joc
      selectAtribut:    FullPNJ._onSelectAtribut,
      selectHabilitat:  FullPNJ._onSelectHabilitat,
      selectArma:       FullPNJ._onSelectArma,
      // Mode edició
      ajustarAtribut:   FullPNJ._onAjustarAtribut,
      ajustarHabilitat: FullPNJ._onAjustarHabilitat,
      // Trets
      crearTret:        FullPNJ._onCrearTret,
      eliminarTret:     FullPNJ._onEliminarTret,
      editarTret:       FullPNJ._onEditarTret,
      // Equipament
      crearArma:        FullPNJ._onCrearArma,
      eliminarArma:     FullPNJ._onEliminarItem,
      crearArmadura:    FullPNJ._onCrearArmadura,
      eliminarArmadura: FullPNJ._onEliminarItem,
      crearArtefacte:   FullPNJ._onCrearArtefacte,
      eliminarArtefacte: FullPNJ._onEliminarItem,
      crearEfecte:      FullPNJ._onCrearEfecte,
      eliminarEfecte:   FullPNJ._onEliminarItem,
      forjaObrirConstructor: FullPNJ._onObrirConstructor,
      editarItem:       FullPNJ._onEditarItem,
      // Curació (S-17)
      forjaObrirCuracio: FullPNJ._onObrirCuracio,
      forjaDescansar:    FullPNJ._onDescansar,
      // Sobrenatural (S-20/S-21)
      toggleEquilibri:      FullPNJ._onToggleEquilibri,
      forjaObrirManifestar: FullPNJ._onObrirManifestar,
      // Artefactes: càrrega (S-26)
      forjaActivarArtefacte:    FullPNJ._onActivarArtefacte,
      forjaRecarregarArtefacte: FullPNJ._onRecarregarArtefacte,
      // Artefactes: R+D (S-30)
      forjaObrirDissenyArtefacte: FullPNJ._onObrirDissenyArtefacte,
      forjaProvarPrototip:        FullPNJ._onProvarPrototip,
      forjaRepararPrototip:       FullPNJ._onRepararPrototip,
      forjaMarcarProduccio:       FullPNJ._onMarcarProduccio,
      // Artefactes: modulars (S-30)
      forjaToggleModular: FullPNJ._onToggleModular,
      forjaAfegirModul:   FullPNJ._onAfegirModul,
      forjaTreureModul:   FullPNJ._onTreureModul,
      // Accions complexes (S-08)
      forjaObrirAccionsComplexes: FullPNJ._onObrirAccionsComplexes,
      // Desfer un efecte (S-21)
      forjaObrirDesfer: FullPNJ._onObrirDesfer
    },
    form: { submitOnChange: true }
  };

  static PARTS = {
    header: { template: "systems/forja/templates/actor/pnj-header.hbs" },
    body:   { template: "systems/forja/templates/actor/pnj-body.hbs" }
  };

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const sys = this.actor.system;
    const cfg = CONFIG.FORJA;

    return {
      ...ctx,
      actor:      this.actor,
      sys,
      modeEdicio: this._modeEdicio,
      tiers: ["extra", "antagonista", "nemesis", "criatura", "animal"],
      campos: {
        especie:     Object.keys(cfg.COST_ESPECIE),
        atributs:    cfg.ATRIBUTS,
        mida:        _opcionsNumeriques("FORJA.Mida", 1, 5),
        constitucio: _opcionsNumeriques("FORJA.Constitucio", 1, 5)
      },
      derivats: {
        latenciaBase: sys.latenciaBase,
        defensa:      sys.defensa,
        reduccioDany: sys.reduccioDany,
        reaccionsMax: sys.reaccionsMax
      },
      salut:      _prepSalut(sys),
      sobrenatural: _prepSobrenatural(sys),
      habilitats: _prepHabilitats(sys, cfg),
      trets:      _prepTrets(this.actor),
      armes:      _prepItems(this.actor, "arma"),
      armadures:  _prepItems(this.actor, "armadura"),
      artefactes: _prepArtefactes(this.actor),
      efectes:    _prepEfectes(this.actor)
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    // Acordió
    for (const [id, obert] of this._acordio) {
      const el = this.element.querySelector(`.forja-seccio[data-seccio="${id}"]`);
      if (el) el.classList.toggle("tancada", !obert);
    }
    // Selecció (mode joc)
    this._aplicarSeleccioVisual();
    // Clic fora desselecciona
    this._clickForaHandler ??= (ev) => {
      if (!this.element.contains(ev.target)) this._clearSeleccio();
    };
    document.removeEventListener("click", this._clickForaHandler);
    document.addEventListener("click", this._clickForaHandler);
  }

  async close(options = {}) {
    document.removeEventListener("click", this._clickForaHandler);
    return super.close(options);
  }

  // ── Mode ─────────────────────────────────────────────────────────────────

  static async _onToggleModeEdicio(event, target) {
    this._modeEdicio = !this._modeEdicio;
    if (this._modeEdicio) {
      this._clearSeleccio();
      await assegurarAtacsAutomatics(this.actor);
    }
    await this.render();
  }

  // ── Selecció (mode joc) ──────────────────────────────────────────────────

  static async _onSelectAtribut(event, target) {
    if (this._modeEdicio) return;
    if (event.target.closest("input")) return;
    const attr = target.dataset.attr;
    const sel  = this._seleccio;
    if (sel.habId) {
      sel.atribut = attr;
      await this._obrarDialeg();
    } else if (sel.atribut === attr) {
      await this._obrarDialeg();
    } else {
      sel.atribut = attr;
      this._aplicarSeleccioVisual();
    }
  }

  static async _onSelectHabilitat(event, target) {
    if (this._modeEdicio) return;
    if (event.target.closest("input, button.hab-marca")) return;
    const habId = target.dataset.habId;
    const sel   = this._seleccio;
    if (sel.atribut) {
      sel.habId = habId;
      await this._obrarDialeg();
    } else if (sel.habId === habId) {
      this._clearSeleccio();
    } else {
      sel.habId = habId;
      this._aplicarSeleccioVisual();
    }
  }

  static async _onSelectArma(event, target) {
    if (this._modeEdicio) return;
    if (event.target.closest("button")) return;
    const id  = target.dataset.itemId;
    const sel = this._seleccio;
    if (sel.armaId === id) {
      await this._ferAtacArma(id);
    } else {
      this._clearSeleccio();
      sel.armaId = id;
      this._aplicarSeleccioVisual();
    }
  }

  async _ferAtacArma(id) {
    const item   = this.actor.items.get(id);
    const dades  = _prepItems(this.actor, "arma").find(a => a.id === id);
    this._clearSeleccio();
    if (!item || !dades) return;
    await ferTirada({
      actor:      this.actor,
      atribut:    dades.tirada.atribut,
      atributVal: dades.tirada.atributVal,
      habId:      dades.tirada.habId,
      habNivell:  dades.tirada.habNivell,
      label:      item.name
    });
  }

  async _obrarDialeg() {
    const sel        = this._seleccio;
    const sys        = this.actor.system;
    const cfg        = CONFIG.FORJA;
    const atribut    = sel.atribut;
    const atributVal = sys.atributs[atribut] ?? 0;
    const habId      = sel.habId ?? null;
    const habNivell  = habId ? (sys.habilitats[habId]?.nivell ?? 0) : 0;
    const habNom     = habId
      ? game.i18n.localize(cfg.LLISTA_HABILITATS.find(h => h.id === habId)?.nom ?? habId)
      : null;
    const label = habNom ? `${atribut} + ${habNom}` : atribut;
    this._clearSeleccio();
    await ferTirada({ actor: this.actor, atribut, atributVal, habId, habNivell, label });
  }

  _clearSeleccio() {
    this._seleccio = { atribut: null, habId: null, armaId: null };
    this._aplicarSeleccioVisual();
  }

  _aplicarSeleccioVisual() {
    const el = this.element;
    if (!el) return;
    const teSel = this._seleccio.atribut || this._seleccio.habId || this._seleccio.armaId;
    el.querySelectorAll(".forja-attr-box[data-attr]").forEach(box => {
      box.classList.toggle("seleccionat", box.dataset.attr === this._seleccio.atribut);
      box.classList.toggle("sel-activa",  !!teSel && box.dataset.attr !== this._seleccio.atribut);
    });
    el.querySelectorAll(".forja-hab-fila[data-hab-id]").forEach(fila => {
      fila.classList.toggle("seleccionat", fila.dataset.habId === this._seleccio.habId);
      fila.classList.toggle("sel-activa",  !!teSel && fila.dataset.habId !== this._seleccio.habId);
    });
    el.querySelectorAll(".forja-equip-fila[data-item-id]").forEach(fila => {
      fila.classList.toggle("seleccionat", fila.dataset.itemId === this._seleccio.armaId);
      fila.classList.toggle("sel-activa",  !!teSel && fila.dataset.itemId !== this._seleccio.armaId);
    });
  }

  // ── Edició (mode edició) ─────────────────────────────────────────────────

  static async _onAjustarAtribut(event, target) {
    const attr  = target.dataset.attr;
    const delta = parseInt(target.dataset.delta);
    const actual = this.actor.system.atributs[attr] ?? 0;
    const nou    = Math.max(0, Math.min(5, actual + delta));
    await this.actor.update({ [`system.atributs.${attr}`]: nou });
  }

  static async _onAjustarHabilitat(event, target) {
    const habId = target.dataset.habId;
    const delta = parseInt(target.dataset.delta);
    const actual = this.actor.system.habilitats[habId]?.nivell ?? 0;
    const nou    = Math.max(0, Math.min(10, actual + delta));
    await this.actor.update({ [`system.habilitats.${habId}.nivell`]: nou });
  }

  // ── Trets ────────────────────────────────────────────────────────────────

  static async _onCrearTret(event, target) {
    const tret = await DiategTrets.obrir();
    if (!tret) return;
    await this.actor.createEmbeddedDocuments("Item", [{
      name: tret.nom,
      type: "tret",
      system: {
        cost:      tret.cost,
        descripcio: tret.descripcio ?? "",
        efecte:    tret.efecte ?? null
      },
      flags: { forja: { catalegId: tret.id } }
    }]);
  }

  static async _onEliminarTret(event, target) {
    const id = target.dataset.tretId;
    await this.actor.deleteEmbeddedDocuments("Item", [id]);
  }

  static async _onEditarTret(event, target) {
    const id   = target.dataset.tretId;
    const item = this.actor.items.get(id);
    item?.sheet?.render(true);
  }

  // ── Equipament ───────────────────────────────────────────────────────────

  static async _onCrearArma(event, target) {
    const sel = await DiategEquipament.obrir("arma");
    if (!sel) return;
    const e = sel.entrada;
    await this.actor.createEmbeddedDocuments("Item", [{
      name: e.nom,
      type: "arma",
      system: {
        categoria:   e.categoria,
        modLatencia: e.modLatencia,
        abast:       e.abast,
        danyBase:    e.danyBase,
        maniobra:    e.maniobra ?? "",
        rangExtrem:  e.rangExtrem ?? false,
        descripcio:  e.descripcio ?? ""
      }
    }]);
  }

  static async _onCrearArmadura(event, target) {
    const sel = await DiategEquipament.obrir("armadura");
    if (!sel) return;
    const e = sel.entrada;
    await this.actor.createEmbeddedDocuments("Item", [{
      name: e.nom,
      type: "armadura",
      system: {
        tipus:       e.tipus,
        reduccio:    e.reduccio,
        modLatencia: e.modLatencia,
        egida:       e.egida ?? { activa: false, absorcio: 0, tornsInactiva: 0 },
        descripcio:  e.descripcio ?? ""
      }
    }]);
  }

  static async _onCrearArtefacte(event, target) {
    const sel = await DiategEquipament.obrir("artefacte");
    if (!sel) return;
    const e = sel.entrada;
    await this.actor.createEmbeddedDocuments("Item", [{
      name: e.nom,
      type: "artefacte",
      system: {
        cost:       e.cost,
        categoria:  e.categoria,
        activacio:  e.activacio ?? {},
        us:         e.us ?? {},
        carrega:    e.carrega ?? {},
        mecanica:   e.mecanica ?? "",
        descripcio: e.descripcio ?? ""
      }
    }]);
  }

  static async _onCrearEfecte(event, target) {
    const sel = await DiategEquipament.obrir("efecte");
    if (!sel) return;
    const e = sel.entrada;
    await this.actor.createEmbeddedDocuments("Item", [{
      name: e.nom,
      type: "efecte",
      system: {
        cost:        e.cost,
        do:          e.do,
        tipus:       e.tipus,
        dificultat:  e.dificultat,
        modLatencia: e.modLatencia ?? 0,
        us:          e.us ?? {},
        mecanica:    e.mecanica ?? "",
        descripcio:  e.descripcio ?? ""
      }
    }]);
  }

  static async _onEliminarItem(event, target) {
    const id = target.dataset.itemId;
    await this.actor.deleteEmbeddedDocuments("Item", [id]);
  }

  static async _onObrirConstructor(event, target) {
    const construit = await DiategConstructor.obrir();
    if (!construit) return;
    await this.actor.createEmbeddedDocuments("Item", [{
      name: construit.nom,
      type: "efecte",
      system: {
        cost:        construit.cost,
        do:          construit.do,
        tipus:       construit.tipus,
        dificultat:  construit.dificultat,
        modLatencia: construit.modLatencia,
        us:          construit.us,
        mecanica:    construit.mecanica,
        descripcio:  ""
      }
    }]);
  }

  static async _onEditarItem(event, target) {
    const id   = target.dataset.itemId;
    const item = this.actor.items.get(id);
    item?.sheet?.render(true);
  }

  // ── Salut / Marca ────────────────────────────────────────────────────────

  static async _onToggleSection(event, target) {
    const seccio = target.closest(".forja-seccio");
    if (!seccio) return;
    const id  = seccio.dataset.seccio;
    const ara = seccio.classList.toggle("tancada");
    this._acordio.set(id, !ara);
  }

  static async _onToggleSalut(event, target) {
    const track    = target.dataset.track;
    const idx      = parseInt(target.dataset.idx);
    const actual   = this.actor.system.salut[track].marcats;
    const nouValor = actual === idx ? idx - 1 : idx;
    await this.actor.update({ [`system.salut.${track}.marcats`]: Math.max(0, nouValor) });
  }

  static async _onToggleMarca(event, target) {
    const habId   = target.dataset.habId;
    const actual  = this.actor.system.habilitats[habId]?.marca ?? "";
    const seguent = { "": "B", "B": "R", "R": "" }[actual] ?? "";
    await this.actor.update({ [`system.habilitats.${habId}.marca`]: seguent });
  }

  // ── Curació (S-17) ───────────────────────────────────────────────────────

  static async _onObrirCuracio(event, target) {
    const guaridor = this.actor;
    const objectiu = [...game.user.targets][0]?.actor ?? guaridor;

    const pistaPerDefecte = (objectiu.system.salut.ferides.nivellActiu ?? 1) >= (objectiu.system.salut.fatiga.nivellActiu ?? 1)
      ? "ferides" : "fatiga";
    const hab = habilitatCuracio(guaridor, objectiu.system.especie);

    const eleccio = await DiategCuracio.obrir({
      nomGuaridor: guaridor.name,
      nomObjectiu: objectiu.name,
      habNom: game.i18n.localize(CONFIG.FORJA.LLISTA_HABILITATS.find(h => h.id === hab.id)?.nom ?? hab.id),
      poolFinal: (guaridor.system.atributs?.INT ?? 0) + hab.nivell,
      pistaPerDefecte
    });
    if (!eleccio) return;

    await ferCuracio({ guaridor, objectiu, tipus: eleccio.tipus, pista: eleccio.pista });
  }

  static async _onDescansar(event, target) {
    const objectiu = this.actor;
    const resultats = [];
    for (const pista of ["fatiga", "ferides"]) {
      if (!potReferSePerSiSol(objectiu, pista)) continue;
      const recuperats = await aplicarReposNatural(objectiu, pista);
      if (recuperats > 0) resultats.push(game.i18n.format("FORJA.Curacio.DescansResultat", {
        punts: recuperats, pista: game.i18n.localize(`FORJA.Salut.${pista}`)
      }));
    }
    if (resultats.length) {
      ui.notifications?.info(`${objectiu.name}: ${resultats.join(" — ")}`);
    } else {
      ui.notifications?.warn(game.i18n.format("FORJA.Curacio.DescansBloquejat", { nom: objectiu.name }));
    }
  }

  // ── Sobrenatural (S-20/S-21) ─────────────────────────────────────────────

  static async _onToggleEquilibri(event, target) {
    const idx      = parseInt(target.dataset.idx);
    const actual   = this.actor.system.equilibri.gastat;
    const nouValor = actual === idx ? idx - 1 : idx;
    await this.actor.update({ "system.equilibri.gastat": Math.max(0, nouValor) });
  }

  static async _onObrirManifestar(event, target) {
    const actor = this.actor;
    if (!potManifestar(actor)) return;
    const sys = actor.system;
    const objectiu = [...game.user.targets][0]?.actor ?? null;

    const eleccio = await DiategManifestar.obrir({
      nomActor: actor.name,
      donNom:   game.i18n.localize(`FORJA.Sobrenatural.Do.${sys.dotat}`),
      eqActual: sys.equilibri.actual,
      eqMax:    sys.equilibri.max,
      nomObjectiu: objectiu?.name ?? null,
      efectes:  _prepEfectes(actor)
    });
    if (!eleccio) return;

    let resistencia = null;
    if (objectiu) {
      const contrarestarOpcio = opcioContrarestar(objectiu, sys.dotat);
      const opcioResistirId = await DiategResistir.obrir({
        nomActor: actor.name,
        nomObjectiu: objectiu.name,
        mental: opcioResistir(objectiu, "mental"),
        fisic:  opcioResistir(objectiu, "fisic"),
        contrarestar: contrarestarOpcio.atribut !== "-" ? contrarestarOpcio : null
      });
      if (opcioResistirId === null) return;
      if (opcioResistirId === "mental" || opcioResistirId === "fisic") {
        resistencia = await resoldreResistir(objectiu, opcioResistirId);
      } else if (opcioResistirId === "contrarestar") {
        resistencia = await resoldreContrarestar(objectiu, sys.dotat);
      }
    }

    await manifestarEfecte({
      actor,
      dificultatBase: eleccio.dificultatBase,
      modDaus:        eleccio.modDaus,
      modDificultat:  eleccio.modDificultat,
      puntsExtra:     eleccio.puntsExtra,
      usPuntsExtra:   eleccio.usPuntsExtra,
      resistencia,
      label:    eleccio.descripcio,
      objectiu
    });
  }

  // ── Artefactes: càrrega (S-26) ───────────────────────────────────────────

  static async _onActivarArtefacte(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (!item) return;
    const resultat = await activarArtefacte(item);
    if (!resultat.ok) {
      ui.notifications?.warn(game.i18n.format("FORJA.Artefacte.SenseCarrega", { nom: item.name }));
      return;
    }
    if (resultat.restant !== null) {
      ui.notifications?.info(game.i18n.format("FORJA.Artefacte.Activat", {
        nom: item.name, restant: resultat.restant, max: item.system.carrega.usosPerCarrega
      }));
    }
  }

  static async _onRecarregarArtefacte(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (!item) return;
    const nou = await recarregarArtefacte(item, 1);
    if (nou !== null) {
      ui.notifications?.info(game.i18n.format("FORJA.Artefacte.Recarregat", {
        nom: item.name, actual: nou, max: item.system.carrega.usosPerCarrega
      }));
    }
  }

  // ── Artefactes: R+D (S-30) ───────────────────────────────────────────────

  static async _onObrirDissenyArtefacte(event, target) {
    const construit = await DiategConstructor.obrir({ esArtefacte: true });
    if (!construit) return;
    await this.actor.createEmbeddedDocuments("Item", [{
      name: construit.nom,
      type: "artefacte",
      system: {
        cost:       construit.cost,
        categoria:  "dispositiu",
        activacio:  { tipus: construit.activacioId, dificultat: construit.dificultat },
        us:         construit.us,
        mecanica:   construit.mecanica,
        descripcio: "",
        fase:       "prototip1"
      }
    }]);
  }

  static async _onProvarPrototip(event, target) {
    const actor = this.actor;
    const item  = actor.items.get(target.dataset.itemId);
    if (!item || !esPrototip(item)) return;

    const eleccio = await DiategProvarPrototip.obrir({ nomArtefacte: item.name, cost: item.system.cost });
    if (!eleccio) return;

    const atributVal = actor.system.atributs[eleccio.atribut] ?? 0;
    const habNivell   = eleccio.habId ? (actor.system.habilitats[eleccio.habId]?.nivell ?? 0) : 0;

    await provarPrototip(actor, item, {
      atribut: eleccio.atribut, atributVal,
      habId: eleccio.habId, habNivell,
      modDaus: eleccio.modDaus, modDificultat: eleccio.modDificultat
    });
  }

  static async _onRepararPrototip(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (!item) return;
    await repararPrototip(item);
    ui.notifications?.info(game.i18n.format("FORJA.Artefacte.Reparat", { nom: item.name }));
  }

  static async _onMarcarProduccio(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (!item) return;
    const confirmat = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.format("FORJA.Artefacte.MarcarProduccioTitol", { nom: item.name }) },
      content: `<p>${game.i18n.localize("FORJA.Artefacte.MarcarProduccioText")}</p>`
    });
    if (!confirmat) return;
    await marcarProduccio(item);
    ui.notifications?.info(game.i18n.format("FORJA.Artefacte.Produccio", { nom: item.name }));
  }

  // ── Artefactes: modulars (S-30) ──────────────────────────────────────────

  static async _onToggleModular(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (!item) return;
    await item.update({ "system.modular": !item.system.modular });
  }

  static async _onAfegirModul(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (!item) return;
    const construit = await DiategConstructor.obrir({ esArtefacte: true });
    if (!construit) return;
    await afegirModul(item, construit);
  }

  static async _onTreureModul(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (!item) return;
    await treureModul(item, parseInt(target.dataset.idx));
  }

  // ── Accions complexes (S-08) ─────────────────────────────────────────────

  static async _onObrirAccionsComplexes(event, target) {
    DiategAccionsComplexes.obrir();
  }

  // ── Desfer un efecte (S-21) ──────────────────────────────────────────────

  static async _onObrirDesfer(event, target) {
    const actor = this.actor;
    const eleccio = await DiategDesfer.obrir();
    if (!eleccio) return;

    const atributVal = actor.system.atributs[eleccio.atribut] ?? 0;
    const habNivell   = eleccio.habId ? (actor.system.habilitats[eleccio.habId]?.nivell ?? 0) : 0;

    await desferEfecte({
      actor,
      dificultat: eleccio.dificultat,
      label: eleccio.label,
      atribut: eleccio.atribut, atributVal,
      habId: eleccio.habId, habNivell,
      modDaus: eleccio.modDaus, modDificultat: eleccio.modDificultat
    });
  }
}
