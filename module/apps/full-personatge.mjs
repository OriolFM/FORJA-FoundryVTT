import { ferTirada }  from "../dice/tirada.mjs";
import DiategTrets    from "./dialeg-trets.mjs";
import DiategEquipament from "./dialeg-equipament.mjs";
import DiategCuracio  from "./dialeg-curacio.mjs";
import DiategMillora  from "./dialeg-millora.mjs";
import AssistentCreacio from "./assistent-creacio.mjs";
import DiategManifestar from "./dialeg-manifestar.mjs";
import DiategConstructor from "./dialeg-constructor.mjs";
import DiategResistir  from "./dialeg-resistir.mjs";
import { manifestarEfecte, potManifestar } from "../combat/manifestar.mjs";
import { opcioResistir, resoldreResistir } from "../combat/resistencia.mjs";
import { opcioContrarestar, resoldreContrarestar } from "../combat/contrarestar.mjs";
import { desferEfecte } from "../combat/desfer.mjs";
import DiategDesfer from "./dialeg-desfer.mjs";
import { resoldreDanyArma } from "../combat/dany.mjs";
import { teCarrega, carregaActual, activarArtefacte, recarregarArtefacte } from "../combat/artefactes.mjs";
import { assegurarAtacsAutomatics } from "../combat/equipament-automatic.mjs";
import { avisosCoherencia } from "../validacio/coherencia.mjs";
import { ferCuracio, habilitatCuracio, aplicarReposNatural, potReferSePerSiSol } from "../combat/curacio.mjs";
import {
  costSeguentAtribut, costSeguentHabilitat,
  millorarAtribut, millorarHabilitat, afegirTretPositiuAmbPX, treureTretNegatiuAmbPX
} from "../progressio/millora.mjs";
import {
  provarManifestacio, aplicarPenalitzacioFallada, aplicarEfecteProgressio
} from "../progressio/progressio-sobrenatural.mjs";
import { esPrototip, provarPrototip, repararPrototip, marcarProduccio } from "../progressio/rd-artefactes.mjs";
import { costTotalModular, afegirModul, treureModul } from "../progressio/modular.mjs";
import DiategProvarPrototip from "./dialeg-provar-prototip.mjs";
import DiategAccionsComplexes from "./dialeg-accions-complexes.mjs";

const HAB_PER_CATEGORIA = {
  natural:   "barallar-se",
  cosAcos:   "armes-cos-a-cos",
  distancia: "armes-distancia"
};
const { HandlebarsApplicationMixin } = foundry.applications.api;

export default class FullPersonatge extends HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {

  _acordio    = new Map();
  _seleccio   = { atribut: null, habId: null, armaId: null };
  _modeEdicio = false;

  static DEFAULT_OPTIONS = {
    classes: ["forja", "full-personatge"],
    position: { width: 680, height: 720 },
    window: { resizable: true },
    actions: {
      toggleSalut:     FullPersonatge._onToggleSalut,
      toggleMarca:     FullPersonatge._onToggleMarca,
      toggleSection:   FullPersonatge._onToggleSection,
      toggleModeEdicio: FullPersonatge._onToggleModeEdicio,
      // Mode joc
      selectAtribut:   FullPersonatge._onSelectAtribut,
      selectHabilitat: FullPersonatge._onSelectHabilitat,
      selectArma:      FullPersonatge._onSelectArma,
      // Mode edició
      ajustarAtribut:  FullPersonatge._onAjustarAtribut,
      ajustarHabilitat: FullPersonatge._onAjustarHabilitat,
      // Trets
      crearTret:       FullPersonatge._onCrearTret,
      eliminarTret:    FullPersonatge._onEliminarTret,
      editarTret:      FullPersonatge._onEditarTret,
      // Equipament
      crearArma:       FullPersonatge._onCrearArma,
      eliminarArma:    FullPersonatge._onEliminarItem,
      crearArmadura:   FullPersonatge._onCrearArmadura,
      eliminarArmadura: FullPersonatge._onEliminarItem,
      crearArtefacte:   FullPersonatge._onCrearArtefacte,
      eliminarArtefacte: FullPersonatge._onEliminarItem,
      crearEfecte:      FullPersonatge._onCrearEfecte,
      eliminarEfecte:   FullPersonatge._onEliminarItem,
      forjaObrirConstructor: FullPersonatge._onObrirConstructor,
      editarItem:      FullPersonatge._onEditarItem,
      // Curació (S-17)
      forjaObrirCuracio: FullPersonatge._onObrirCuracio,
      forjaDescansar:    FullPersonatge._onDescansar,
      // Millora amb PX (S-28)
      forjaObrirMillora: FullPersonatge._onObrirMillora,
      // Assistent de creació (M-03)
      forjaObrirAssistent: FullPersonatge._onObrirAssistent,
      // Sobrenatural (S-20/S-21)
      toggleEquilibri:      FullPersonatge._onToggleEquilibri,
      forjaObrirManifestar: FullPersonatge._onObrirManifestar,
      forjaObrirProgressio: FullPersonatge._onObrirProgressio,
      // Artefactes: càrrega (S-26)
      forjaActivarArtefacte:    FullPersonatge._onActivarArtefacte,
      forjaRecarregarArtefacte: FullPersonatge._onRecarregarArtefacte,
      // Artefactes: R+D (S-30)
      forjaObrirDissenyArtefacte: FullPersonatge._onObrirDissenyArtefacte,
      forjaProvarPrototip:        FullPersonatge._onProvarPrototip,
      forjaRepararPrototip:       FullPersonatge._onRepararPrototip,
      forjaMarcarProduccio:       FullPersonatge._onMarcarProduccio,
      // Artefactes: modulars (S-30)
      forjaToggleModular: FullPersonatge._onToggleModular,
      forjaAfegirModul:   FullPersonatge._onAfegirModul,
      forjaTreureModul:   FullPersonatge._onTreureModul,
      // Accions complexes (S-08)
      forjaObrirAccionsComplexes: FullPersonatge._onObrirAccionsComplexes,
      // Desfer un efecte (S-21)
      forjaObrirDesfer: FullPersonatge._onObrirDesfer
    },
    form: { submitOnChange: true }
  };

  static PARTS = {
    header: { template: "systems/forja/templates/actor/personatge-header.hbs" },
    body:   { template: "systems/forja/templates/actor/personatge-body.hbs" }
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
      efectes:    _prepEfectes(this.actor),
      pc: {
        total:   sys.pc,
        gastats: sys.pcGastats ?? 0,
        lliures: sys.pcLliures ?? 0
      },
      px: {
        total:   sys.px.total,
        gastats: sys.px.gastats ?? 0,
        lliures: sys.px.lliures ?? 0
      },
      avisos: avisosCoherencia(this.actor)
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

  // ── Progressió sobrenatural (S-29) ───────────────────────────────────────

  static async _onObrirProgressio(event, target) {
    const actor = this.actor;
    if (!potManifestar(actor)) return;

    const efectesActor = actor.items.filter(i => i.type === "efecte");
    let itemExistent = null;

    if (efectesActor.length) {
      const opcions = efectesActor
        .map(i => `<option value="${i.id}">${i.name} (${i.system.cost} PC)</option>`)
        .join("");
      const content = `
        <form class="forja-progressio-tria">
          <div class="form-group">
            <label><input type="radio" name="mode" value="nou" checked> ${game.i18n.localize("FORJA.Progressio.Nou")}</label>
          </div>
          <div class="form-group">
            <label><input type="radio" name="mode" value="millorar"> ${game.i18n.localize("FORJA.Progressio.Millorar")}</label>
            <select name="itemId">${opcions}</select>
          </div>
          <p class="dm-desc">${game.i18n.localize("FORJA.Progressio.AvisRecerca")}</p>
        </form>`;
      const tria = await foundry.applications.api.DialogV2.prompt({
        window: { title: game.i18n.localize("FORJA.Progressio.TitolTria") },
        content,
        ok: {
          label: game.i18n.localize("FORJA.Progressio.Continuar"),
          callback: (ev, button) => ({
            mode:   button.form.elements.mode.value,
            itemId: button.form.elements.itemId.value
          })
        }
      });
      if (!tria) return;
      if (tria.mode === "millorar") itemExistent = actor.items.get(tria.itemId) ?? null;
    } else {
      const continuar = await foundry.applications.api.DialogV2.confirm({
        window: { title: game.i18n.localize("FORJA.Progressio.TitolTria") },
        content: `<p class="dm-desc">${game.i18n.localize("FORJA.Progressio.AvisRecerca")}</p>`
      });
      if (!continuar) return;
    }

    const construit = await DiategConstructor.obrir();
    if (!construit) return;

    let exit = false;
    while (!exit) {
      const resultat = await provarManifestacio(actor, construit.dificultat, construit.nom);
      if (!resultat) return;
      exit = resultat.exit;
      if (!exit) {
        const continuar = await foundry.applications.api.DialogV2.confirm({
          window: { title: game.i18n.localize("FORJA.Progressio.TitolFallada") },
          content: `<p>${game.i18n.localize("FORJA.Progressio.TextFallada")}</p>`
        });
        if (!continuar) return;
        const penalitzacio = await aplicarPenalitzacioFallada(actor);
        if (penalitzacio.error === "px") {
          ui.notifications?.warn(game.i18n.localize("FORJA.Millora.PXInsuficients"));
          return;
        }
      }
    }

    const aplicat = await aplicarEfecteProgressio(actor, construit, itemExistent);
    if (aplicat.error === "px") {
      ui.notifications?.warn(game.i18n.localize("FORJA.Millora.PXInsuficients"));
      return;
    }
    ui.notifications?.info(game.i18n.format("FORJA.Progressio.Aplicat", { nom: construit.nom, cost: aplicat.cost }));
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

  /**
   * L'objectiu a guarir és el marcat al canvas (o el mateix personatge si
   * ningú està marcat, per permetre l'autotractament). El guaridor és
   * sempre el propietari de la fitxa on es prem el botó.
   */
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

  /**
   * Repòs (manual "Refer-se"): aplicació manual de la recuperació natural
   * per període — el DJ decideix QUAN s'ha complert el temps de la taula
   * (no es simula el pas del temps), aquest botó només aplica el càlcul.
   */
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

  // ── Millora amb PX (S-28) ────────────────────────────────────────────────

  static async _onObrirMillora(event, target) {
    const actor = this.actor;
    const sys   = actor.system;
    const cfg   = CONFIG.FORJA;

    const atributs = cfg.ATRIBUTS.map(attr => {
      const actual = sys.atributs[attr] ?? 0;
      return {
        id: attr, nom: game.i18n.localize(`FORJA.Attr.${attr}`),
        actual, seguent: actual + 1, cost: costSeguentAtribut(actual)
      };
    });

    const habilitats = cfg.LLISTA_HABILITATS.map(h => {
      const actual = sys.habilitats[h.id]?.nivell ?? 0;
      return {
        id: h.id, nom: game.i18n.localize(h.nom),
        actual, seguent: actual + 1, cost: costSeguentHabilitat(actual)
      };
    }).sort((a, b) => a.nom.localeCompare(b.nom, "ca"));

    const tretsNegatius = actor.items
      .filter(i => i.type === "tret" && (i.system.cost ?? 0) < 0)
      .map(i => ({ id: i.id, nom: i.name, cost: -(i.system.cost ?? 0) }));

    const eleccio = await DiategMillora.obrir({
      nomActor: actor.name,
      pxLliures: sys.px?.lliures ?? 0,
      atributs, habilitats, tretsNegatius
    });
    if (!eleccio) return;

    let resultat = null;
    if (eleccio.categoria === "atribut") {
      resultat = await millorarAtribut(actor, eleccio.attrId);
    } else if (eleccio.categoria === "habilitat") {
      resultat = await millorarHabilitat(actor, eleccio.habId);
    } else if (eleccio.categoria === "tret-afegir") {
      const tret = await DiategTrets.obrir();
      if (!tret) return;
      resultat = await afegirTretPositiuAmbPX(actor, tret);
    } else if (eleccio.categoria === "tret-treure") {
      const item = actor.items.get(eleccio.tretNegatiuId);
      if (!item) return;
      resultat = await treureTretNegatiuAmbPX(actor, item);
    }

    if (!resultat) return;
    if (resultat.error === "max") {
      ui.notifications?.warn(game.i18n.localize("FORJA.Millora.JaAlMaxim"));
    } else if (resultat.error === "px") {
      ui.notifications?.warn(game.i18n.localize("FORJA.Millora.PXInsuficients"));
    } else if (resultat.error === "negatiu") {
      ui.notifications?.warn(game.i18n.localize("FORJA.Millora.NomesTretsPositius"));
    } else if (resultat.error === "positiu") {
      ui.notifications?.warn(game.i18n.localize("FORJA.Millora.NomesTretsNegatius"));
    } else {
      ui.notifications?.info(game.i18n.format("FORJA.Millora.Aplicada", { nom: actor.name, cost: resultat.cost }));
    }
  }

  // ── Assistent de creació (M-03) ──────────────────────────────────────────

  static async _onObrirAssistent(event, target) {
    AssistentCreacio.obrir(this.actor);
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
      if (opcioResistirId === null) return; // diàleg cancel·lat
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
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

export function _opcionsNumeriques(prefix, min, max) {
  const opts = [];
  for (let i = min; i <= max; i++)
    opts.push({ val: i, nom: game.i18n.localize(`${prefix}.${i}`) });
  return opts;
}

export function _prepSalut(sys) {
  const cfg = CONFIG.FORJA;
  const constitucio = sys.constitucio ?? 3;
  const mida        = sys.mida        ?? 3;
  const fatMarcats  = sys.salut.fatiga.marcats  ?? 0;
  const ferMarcats  = sys.salut.ferides.marcats ?? 0;
  const penalStr = n => {
    const p = cfg.SALUT_PENALITZACIO[n];
    return p == null ? "" : p === 0 ? "(+0)" : `(+${p})`;
  };
  const taula = [];
  for (let n = 1; n <= 6; n++) {
    const fatCaselles = [];
    for (let c = 1; c <= constitucio; c++) {
      const idx = (n - 1) * constitucio + c;
      fatCaselles.push({ idx, marcat: idx <= fatMarcats });
    }
    const ferCaselles = [];
    for (let c = 1; c <= mida; c++) {
      const idx = (n - 1) * mida + c;
      ferCaselles.push({ idx, marcat: idx <= ferMarcats });
    }
    taula.push({
      num: n, penalStr: penalStr(n), terminal: false,
      fatiga:  { nom: game.i18n.localize(`FORJA.NivellFatiga.${n}`),  caselles: fatCaselles },
      ferides: { nom: game.i18n.localize(`FORJA.NivellFerides.${n}`), caselles: ferCaselles }
    });
  }
  const idxF7 = 6 * constitucio + 1;
  const idxW7 = 6 * mida + 1;
  taula.push({
    num: 7, terminal: true,
    fatiga:  { casella: { idx: idxF7, marcat: fatMarcats >= idxF7 } },
    ferides: { casella: { idx: idxW7, marcat: ferMarcats >= idxW7 } }
  });
  return { taula, nivellEfectiu: sys.salut.nivellEfectiu ?? 1, penalitzacio: sys.salut.penalitzacio ?? 0 };
}

/**
 * Prepara la pista d'Equilibri (S-20) per a la fitxa. Mateix patró que
 * `_prepSalut`: caselles clicables 1..N que representen `equilibri.gastat`
 * (0 = ple). Es mostren com a mínim `max*2` caselles (tram normal + tram de
 * fatiga, manual p. 256-258) i més si el gastat ja les supera (tram de
 * ferides, sense límit fix al manual).
 * @returns {object|null} `null` si l'actor no és dotat (secció amagada).
 */
export function _prepSobrenatural(sys) {
  if (!sys.dotat) return null;
  const max    = sys.equilibri.max ?? 0;
  const gastat = sys.equilibri.gastat ?? 0;
  const total  = Math.max(gastat, max * 2, 1);

  const caselles = [];
  for (let i = 1; i <= total; i++) {
    const zona = i > max * 2 ? "ferides" : i > max ? "fatiga" : "normal";
    caselles.push({ idx: i, marcat: i <= gastat, zona });
  }

  return {
    don:    sys.dotat,
    donNom: game.i18n.localize(`FORJA.Sobrenatural.Do.${sys.dotat}`),
    max, gastat,
    actual: sys.equilibri.actual,
    zona:   sys.equilibri.zona,
    caselles
  };
}

export function _prepHabilitats(sys, cfg) {
  const tots = cfg.LLISTA_HABILITATS.map(h => ({
    id:           h.id,
    nom:          game.i18n.localize(h.nom),
    tipus:        h.tipus,
    attr:         h.attr,
    nivell:       sys.habilitats[h.id]?.nivell       ?? 0,
    marca:        sys.habilitats[h.id]?.marca         ?? "",
    especialitat: sys.habilitats[h.id]?.especialitat  ?? ""
  })).sort((a, b) => a.nom.localeCompare(b.nom, "ca"));

  const meitat = Math.ceil(tots.length / 2);
  return { esquerra: tots.slice(0, meitat), dreta: tots.slice(meitat) };
}

export function _prepItems(actor, type) {
  const sys = actor.system;
  return actor.items
    .filter(i => i.type === type)
    .map(i => {
      const dades = {
        id:          i.id,
        nom:         i.name,
        categoria:   i.system?.categoria,
        tipus:       i.system?.tipus,
        modLatencia: i.system?.modLatencia ?? 0,
        abast:       i.system?.abast,
        danyBase:    i.system?.danyBase,
        reduccio:    i.system?.reduccio,
        maniobra:    i.system?.maniobra ?? "",
        descripcio:  i.system?.descripcio ?? ""
      };
      if (type === "arma") {
        const habId    = HAB_PER_CATEGORIA[dades.categoria] ?? "barallar-se";
        const atribut  = dades.categoria === "distancia" ? "DES" : "FOR";
        const atributVal = sys.atributs?.[atribut] ?? 0;
        const habNivell  = sys.habilitats?.[habId]?.nivell ?? 0;
        const { valor: dany } = resoldreDanyArma(dades.danyBase, actor);
        dades.tirada = {
          atribut, atributVal, habId, habNivell,
          pool: atributVal + habNivell
        };
        dades.danyValor = dany;
        dades.latenciaTotal = (sys.latenciaBase ?? 0) + dades.modLatencia;
      }
      return dades;
    })
    .sort((a, b) => a.nom.localeCompare(b.nom, "ca"));
}

export function _prepArtefactes(actor) {
  return actor.items
    .filter(i => i.type === "artefacte")
    .map(i => ({
      id:         i.id,
      nom:        i.name,
      cost:       i.system?.cost ?? 0,
      categoria:  i.system?.categoria ?? "dispositiu",
      activacio:  i.system?.activacio ?? {},
      us:         i.system?.us ?? {},
      carrega:    i.system?.carrega ?? {},
      teCarrega:  teCarrega(i),
      carregaActual: carregaActual(i),
      mecanica:   i.system?.mecanica ?? "",
      descripcio: i.system?.descripcio ?? "",
      fase:       i.system?.fase ?? "produccio",
      trencat:    i.system?.trencat ?? false,
      esPrototip: esPrototip(i),
      modular:    i.system?.modular ?? false,
      moduls:     (i.system?.moduls ?? []).map((m, idx) => ({ ...m, idx })),
      totalModular: costTotalModular(i)
    }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "ca"));
}

export function _prepEfectes(actor) {
  return actor.items
    .filter(i => i.type === "efecte")
    .map(i => ({
      id:          i.id,
      nom:         i.name,
      cost:        i.system?.cost ?? 0,
      do:          i.system?.do,
      tipus:       i.system?.tipus ?? "efecte",
      dificultat:  i.system?.dificultat ?? 1,
      modLatencia: i.system?.modLatencia ?? 0,
      us:          i.system?.us ?? {},
      mecanica:    i.system?.mecanica ?? "",
      descripcio:  i.system?.descripcio ?? ""
    }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "ca"));
}

export function _prepTrets(actor) {
  return actor.items
    .filter(i => i.type === "tret")
    .map(i => ({
      id:        i.id,
      nom:       i.name,
      cost:      i.system?.cost      ?? 0,
      descripcio: i.system?.descripcio ?? ""
    }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "ca"));
}
