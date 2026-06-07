import { ferTirada }  from "../dice/tirada.mjs";
import DiategTrets    from "./dialeg-trets.mjs";
import DiategEquipament from "./dialeg-equipament.mjs";
import { _opcionsNumeriques, _prepSalut, _prepHabilitats, _prepTrets, _prepItems } from "./full-personatge.mjs";
import { assegurarAtacsAutomatics } from "../combat/equipament-automatic.mjs";
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
      editarItem:       FullPNJ._onEditarItem
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
      habilitats: _prepHabilitats(sys, cfg),
      trets:      _prepTrets(this.actor),
      armes:      _prepItems(this.actor, "arma"),
      armadures:  _prepItems(this.actor, "armadura")
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
        descripcio: tret.descripcio ?? ""
      }
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

  static async _onEliminarItem(event, target) {
    const id = target.dataset.itemId;
    await this.actor.deleteEmbeddedDocuments("Item", [id]);
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
}
