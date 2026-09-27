import { ferTirada }  from "../dice/tirada.mjs";
import DiategTrets    from "./dialeg-trets.mjs";
import DiategEquipament from "./dialeg-equipament.mjs";
import DiategCuracio  from "./dialeg-curacio.mjs";
import { resoldreDanyArma } from "../combat/dany.mjs";
import {
  assegurarAtacsAutomatics, crearItemDesDeCataleg, atributIHabilitatAtac
} from "../combat/equipament-automatic.mjs";
import { ferCuracio, habilitatCuracio, aplicarReposNatural, potReferSePerSiSol } from "../combat/curacio.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * D1: base compartida entre `FullPersonatge` i `FullPNJ` — les dues fitxes
 * usen el mateix motor (acordió, mode joc/edició, selecció i tirades,
 * trets/equipament, salut, curació); només difereixen en la capçalera i en
 * els blocs exclusius del PJ (PC/PX, millora amb PX) o del PNJ (tier).
 *
 * Els subtipus defineixen el seu propi `static PARTS` (plantilles pròpies) i
 * amplien `static DEFAULT_OPTIONS`/`_prepareContext` — Foundry fusiona
 * `DEFAULT_OPTIONS` (incloent `actions`) de tota la cadena de classes, així
 * que només cal declarar-hi el que sigui propi de cada subtipus.
 */
export default class FullActorBase extends HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {

  _acordio    = new Map();
  _seleccio   = { atribut: null, habId: null, armaId: null };
  _modeEdicio = false;

  static DEFAULT_OPTIONS = {
    // `classes` es deixa als subtipus (FullPersonatge/FullPNJ): ApplicationV2
    // concatena `classes` de tota la cadena de classes, així que declarar-la
    // aquí també duplicaria "forja" al DOM sense cap benefici.
    position: { width: 680, height: 720 },
    window: { resizable: true },
    actions: {
      toggleSalut:      FullActorBase._onToggleSalut,
      toggleMarca:      FullActorBase._onToggleMarca,
      toggleSection:    FullActorBase._onToggleSection,
      toggleModeEdicio: FullActorBase._onToggleModeEdicio,
      // Mode joc
      selectAtribut:    FullActorBase._onSelectAtribut,
      selectHabilitat:  FullActorBase._onSelectHabilitat,
      selectArma:       FullActorBase._onSelectArma,
      // Mode edició
      ajustarAtribut:   FullActorBase._onAjustarAtribut,
      ajustarHabilitat: FullActorBase._onAjustarHabilitat,
      // Trets
      crearTret:        FullActorBase._onCrearTret,
      eliminarTret:     FullActorBase._onEliminarTret,
      editarTret:       FullActorBase._onEditarTret,
      // Equipament
      crearArma:         FullActorBase._onCrearArma,
      eliminarArma:      FullActorBase._onEliminarItem,
      crearArmadura:     FullActorBase._onCrearArmadura,
      eliminarArmadura:  FullActorBase._onEliminarItem,
      toggleEquipada:    FullActorBase._onToggleEquipada,
      crearArtefacte:    FullActorBase._onCrearArtefacte,
      eliminarArtefacte: FullActorBase._onEliminarItem,
      editarItem:        FullActorBase._onEditarItem,
      // Curació (S-17)
      forjaObrirCuracio: FullActorBase._onObrirCuracio,
      forjaDescansar:    FullActorBase._onDescansar
    },
    form: { submitOnChange: true }
  };

  /** @override Camps comuns a totes dues fitxes; els subtipus hi afegeixen els seus. */
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
      habilitats: _prepHabilitats(sys, cfg),
      trets:      _prepTrets(this.actor),
      armes:      _prepItems(this.actor, "arma"),
      armadures:  _prepItems(this.actor, "armadura"),
      artefactes: _prepArtefactes(this.actor)
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

  /** @override D6: confirmació abans d'eliminar (vàlida per a tot tipus d'item). */
  static async _onEliminarTret(event, target) {
    const id   = target.dataset.tretId;
    const item = this.actor.items.get(id);
    if (!(await this._confirmarEliminarItem(item))) return;
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
    await crearItemDesDeCataleg(this.actor, "arma", sel.entrada);
  }

  static async _onCrearArmadura(event, target) {
    const sel = await DiategEquipament.obrir("armadura");
    if (!sel) return;
    await crearItemDesDeCataleg(this.actor, "armadura", sel.entrada);
  }

  static async _onCrearArtefacte(event, target) {
    const sel = await DiategEquipament.obrir("artefacte");
    if (!sel) return;
    await crearItemDesDeCataleg(this.actor, "artefacte", sel.entrada);
  }

  /** @override D6: confirmació abans d'eliminar. */
  static async _onEliminarItem(event, target) {
    const id   = target.dataset.itemId;
    const item = this.actor.items.get(id);
    if (!(await this._confirmarEliminarItem(item))) return;
    await this.actor.deleteEmbeddedDocuments("Item", [id]);
  }

  static async _onEditarItem(event, target) {
    const id   = target.dataset.itemId;
    const item = this.actor.items.get(id);
    item?.sheet?.render(true);
  }

  /**
   * Equipar/desequipar una armadura (contracte ona 2): commuta
   * `system.equipada`, consultat per `_prepararDerivats` (protecció/latència)
   * i pel motor de combat (WP-F).
   */
  static async _onToggleEquipada(event, target) {
    const id   = target.dataset.itemId;
    const item = this.actor.items.get(id);
    if (!item) return;
    const equipadaAra = item.system.equipada !== false;
    await item.update({ "system.equipada": !equipadaAra });
  }

  /** D6: `DialogV2.confirm` abans d'eliminar qualsevol item de la fitxa. */
  async _confirmarEliminarItem(item) {
    if (!item) return false;
    return foundry.applications.api.DialogV2.confirm({
      window:  { title: game.i18n.localize("FORJA.Confirmar.EliminarTitol") },
      content: `<p>${game.i18n.format("FORJA.Confirmar.EliminarText", { nom: item.name })}</p>`,
      rejectClose: false,
      modal: true
    });
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
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

export function _opcionsNumeriques(prefix, min, max) {
  const opts = [];
  for (let i = min; i <= max; i++)
    opts.push({ val: i, nom: game.i18n.localize(`${prefix}.${i}`) });
  return opts;
}

/**
 * B12: la casella terminal (nivell 7, "fora de combat") es marca segons el
 * nivell actiu ja calculat a `_prepararDerivats` (`nivellActiu`), no segons
 * si `marcats` arriba a l'índex `6×perNivell+1` — aquest índex només existeix
 * per fer-hi clic (per tornar-hi enrere), però la pista arriba al nivell 7
 * en marcar la casella `6×perNivell` (la darrera del nivell 6), un abans.
 */
export function _prepSalut(sys) {
  const cfg = CONFIG.FORJA;
  const constitucio = sys.constitucio ?? 3;
  const mida        = sys.mida        ?? 3;
  const fatMarcats  = sys.salut.fatiga.marcats  ?? 0;
  const ferMarcats  = sys.salut.ferides.marcats ?? 0;
  const fatNivell   = sys.salut.fatiga.nivellActiu  ?? 1;
  const ferNivell   = sys.salut.ferides.nivellActiu ?? 1;
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
    fatiga:  { casella: { idx: idxF7, marcat: fatNivell === 7 } },
    ferides: { casella: { idx: idxW7, marcat: ferNivell === 7 } }
  });
  return { taula, nivellEfectiu: sys.salut.nivellEfectiu ?? 1, penalitzacio: sys.salut.penalitzacio ?? 0 };
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
        descripcio:  i.system?.descripcio ?? "",
        equipada:    i.system?.equipada !== false
      };
      if (type === "arma") {
        // B8/Q1 (resolt) i D3: atribut + habilitat via la taula central de
        // constants.mjs (categoria + excepcions per catàleg concret).
        const { atribut, habId } = atributIHabilitatAtac(i);
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
      mecanica:   i.system?.mecanica ?? "",
      descripcio: i.system?.descripcio ?? ""
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
