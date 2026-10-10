import { retardMaximBarallarse, limitarRetardBarallarse } from "../combat/atac.mjs";
import { latenciaExtraMoviment, normalitzarMoviment, permisMoviment } from "../combat/moviment.mjs";
import { movimentsPermesosPerEstats } from "../estats/regles-estats.mjs";
import { MODES_TRET } from "../combat/modes-tret.mjs";
import { marcarObjectiu } from "../combat/objectius.mjs";

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
 * - Objectiu de l'atac: es declara aquí (llista de combatents amb la distància
 *   vora a vora); l'atac es resol contra aquest token. Si és cos a cos i no
 *   és a tocar, s'avisa que caldrà apropar-s'hi amb el moviment del torn.
 * - Moviment (WP-M; manual › Moviment dels PJ, l. 2678–2694, i › Temps actiu
 *   › Moviment, l. 2790–2794; Oriol FM, 2026-09-27): tota acció porta
 *   implícit un moviment bàsic (caminar). Es pot canviar per un moviment
 *   especial (+2 de latència, cal tirada que no s'automatitza) o, en un atac
 *   cos a cos / natural, per una càrrega (córrer + atac, +2 de latència). El
 *   moviment ràpid (córrer) no es pot combinar amb cap altra acció: només
 *   s'ofereix amb el tipus d'acció "Només moviment".
 * - Estats (Fase 1, `estats/regles-estats.mjs`): els tipus d'acció i els
 *   moviments que els estats impedeixen surten deshabilitats, amb l'estat que
 *   ho impedeix (`config.bloquejats`, `config.restriccions`).
 */
/** Clau i18n de cada tipus de moviment (literals, per a la prova de paritat i18n). */
const ETIQUETES_MOVIMENT = {
  basic:    "FORJA.Moviment.Basic",
  rapid:    "FORJA.Moviment.Rapid",
  especial: "FORJA.Moviment.Especial",
  carrega:  "FORJA.Moviment.Carrega"
};

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
  #moviment   = "basic";
  #objectiuTokenId = null;
  #efecteId   = null;
  #modeTret   = "tret";
  #dimMak     = "ferides";
  #artefacteId = null;

  constructor(config, options = {}) {
    super(options);
    this.#config     = config;
    this.#armaId     = config.armes?.[0]?.id ?? null;
    this.#defensaId  = config.defenses?.[0]?.id ?? null;
    this.#concentrar = !!config.concentrat;
    this.#objectiuTokenId = config.objectiuPerDefecte ?? null;
    this.#efecteId    = config.efectes?.[0]?.id ?? null;
    this.#artefacteId = config.artefactes?.[0]?.id ?? null;
    // Durant el combat es proposa el que es va triar l'últim cop (si encara val).
    const u = config.ultima;
    if (u) {
      if (u.tipus === "atac" ? config.armes?.length
        : u.tipus === "manifestar" ? config.efectes?.length
        : u.tipus === "artefacte" ? config.artefactes?.length
        : ["defensa", "moviment", "altra"].includes(u.tipus)) this.#tipus = u.tipus;
      if (config.efectes?.some(e => e.id === u.efecteId)) this.#efecteId = u.efecteId;
      if (config.artefactes?.some(a => a.id === u.artefacteId)) this.#artefacteId = u.artefacteId;
      if (config.armes?.some(a => a.id === u.armaId)) this.#armaId = u.armaId;
      if (config.defenses?.some(d => d.id === u.defensaId)) this.#defensaId = u.defensaId;
      if (u.maniobraId && this.#arma()?.permetManiobres) this.#maniobraId = u.maniobraId;
      if (u.moviment) this.#moviment = normalitzarMoviment(u.moviment);
      if (u.retard) this.#retard = u.retard;
      if (u.modeTret) this.#modeTret = u.modeTret;
      if (u.dimMak) this.#dimMak = u.dimMak;
    }
    if (!config.armes?.length) this.#tipus = "defensa";
    // Estats: si el tipus proposat està bloquejat, el primer permès.
    if (this.#bloqueig(this.#tipus)) {
      this.#tipus = ["atac", "defensa", "moviment", "altra", "manifestar", "artefacte"]
        .find(t => !this.#bloqueig(t) && (t !== "atac" || config.armes?.length)) ?? this.#tipus;
    }
  }

  /** Estat que impedeix el tipus d'acció `tipus`, o null. */
  #bloqueig(tipus) {
    return this.#config.bloquejats?.[tipus] ?? null;
  }

  /** Es pot concentrar amb el tipus triat (berserc: només en atac, l. 3578). */
  #potConcentrar() {
    const r = this.#config.restriccions;
    return !r || r.potConcentrar || this.#tipus === "atac";
  }

  get title() {
    return game.i18n.format("FORJA.Combat.DeclararAccioTitol", { nom: this.#config?.nom ?? "" });
  }

  /** Arma triada (entrada de `config.armes`). */
  #arma() {
    return this.#config.armes?.find(a => a.id === this.#armaId) ?? null;
  }

  /** Mode de tret efectiu (Fase 6): el triat, si l'arma el permet. */
  #modeEfectiu() {
    const modes = this.#tipus === "atac" ? (this.#arma()?.modes ?? []) : [];
    return modes.includes(this.#modeTret) ? this.#modeTret : "tret";
  }

  /** Màxim de ticks de retard de barallar-se per a l'atac triat (B16). */
  #retardMax() {
    if (this.#tipus !== "atac") return 0;
    const arma = this.#arma();
    return retardMaximBarallarse(arma, arma?.retardMax ?? 0, !!this.#maniobraId);
  }

  /**
   * Moviments que es poden triar amb el tipus d'acció i l'arma actuals (WP-M).
   * El ràpid només sol (acció "moviment"); la càrrega només amb atac cos a
   * cos o natural (manual l. 2794: "combina un moviment ràpid amb un atac cos a cos").
   * @returns {string[]}
   */
  #movimentsPermesos() {
    if (this.#tipus === "moviment") {
      const llista = ["basic", "rapid", "especial"];
      return this.#config.restriccions ? movimentsPermesosPerEstats(llista, this.#config.restriccions) : llista;
    }
    const llista = ["basic", "especial"];
    const categoria = this.#arma()?.categoria;
    if (this.#tipus === "atac" && (categoria === "cosAcos" || categoria === "natural")) llista.push("carrega");
    return this.#config.restriccions ? movimentsPermesosPerEstats(llista, this.#config.restriccions) : llista;
  }

  /** Moviment triat, limitat als permesos ara mateix (WP-M). */
  #movimentEfectiu() {
    const m = normalitzarMoviment(this.#moviment);
    return this.#movimentsPermesos().includes(m) ? m : "basic";
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
      concentrar:    this.#concentrar && this.#potConcentrar(),
      potConcentrar: this.#potConcentrar(),
      // Fase 3: manifestar un efecte i activar un artefacte com a acció declarada.
      efectes:       c.efectes ?? [],
      artefactes:    c.artefactes ?? [],
      efecteId:      this.#efecteId,
      artefacteId:   this.#artefacteId,
      ambObjectiu:   ["atac", "manifestar", "artefacte"].includes(this.#tipus),
      // Fase 6: modes de tret i Dim Mak.
      modesTret:     (this.#tipus === "atac" ? (arma?.modes ?? []) : []).map(id => ({ id, nom: game.i18n.localize(`FORJA.Combat.ModeTret.${id}`) })),
      modeTret:      this.#modeEfectiu(),
      armaArea:      this.#tipus === "atac" && !!arma?.area,
      esDimMak:      this.#maniobraId === "dim-mak",
      dimMak:        this.#dimMak,
      bloqueigTipus: Object.fromEntries(["atac", "defensa", "moviment", "altra", "manifestar", "artefacte"].map(t => {
        const estat = this.#bloqueig(t);
        return [t, estat ? game.i18n.format("FORJA.Estats.ImpedeixTitol", { estat: c.nomsEstats?.[estat] ?? estat }) : null];
      })),
      estatsActius:  Object.values(c.nomsEstats ?? {}).join(", "),
      noEsMou:       c.restriccions ? !c.restriccions.potMoure : false,
      descripcio:    this.#descripcio,
      retardMax:     this.#retardMax(),
      retard:        this.#retardEfectiu(),
      moviments:     this.#movimentsPermesos(),
      moviment:      this.#movimentEfectiu(),
      metresMoviment: permisMoviment(this.#movimentEfectiu(), c.distancies ?? {}),
      objectius:     c.objectius ?? [],
      objectiuTokenId: this.#objectiuTokenId,
      avisObjectiu:  this.#avisObjectiu(),
      latencia:      this.#calcularLatencia()
    };
  }

  /**
   * Avís si l'atac triat és cos a cos (o natural) i l'objectiu no és a tocar:
   * l'atacant s'hi haurà d'apropar amb el moviment d'aquest torn.
   * @returns {string|null}
   */
  #avisObjectiu() {
    if (this.#tipus !== "atac") return null;
    const obj = this.#config.objectius?.find(o => o.tokenId === this.#objectiuTokenId);
    const categoria = this.#arma()?.categoria;
    if (!obj || obj.aTocar || categoria === "distancia") return null;
    return game.i18n.format("FORJA.Combat.ObjectiuNoATocar", {
      nom: obj.nomNumerat ?? obj.nom,
      distancia: obj.distancia ?? "?",
      metres: permisMoviment(this.#movimentEfectiu(), this.#config.distancies ?? {})
    });
  }

  #calcularLatencia() {
    const c = this.#config;
    const extraMoviment = latenciaExtraMoviment(this.#movimentEfectiu());
    if (this.#tipus === "atac") {
      return (this.#arma()?.latenciaTotal ?? c.latenciaBase) + this.#retardEfectiu() + extraMoviment
        + (MODES_TRET[this.#modeEfectiu()]?.latencia ?? 0);
    }
    // Fase 3: latència bàsica + modificador de l'efecte o de l'artefacte
    // (manual › Latència, l. 4776: «cal afegir a la latència bàsica de l'usuari»).
    if (this.#tipus === "manifestar") {
      return Math.max(1, c.latenciaBase + (c.efectes?.find(e => e.id === this.#efecteId)?.modLatencia ?? 0)) + extraMoviment;
    }
    if (this.#tipus === "artefacte") {
      return Math.max(1, c.latenciaBase + (c.artefactes?.find(a => a.id === this.#artefacteId)?.modLatencia ?? 0)) + extraMoviment;
    }
    // Moviment i defensa completa: latència bàsica (manual p. 483-487,
    // "els moviments bàsics i ràpids es fan amb la latència bàsica del PJ"),
    // més el +2 del moviment especial / càrrega (WP-M).
    return c.latenciaBase + extraMoviment;
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

    // Estats: en intentar triar un tipus bloquejat, torna a sortir l'estat al
    // costat del token (Oriol FM, 2026-10-06).
    el.querySelectorAll("label.dda-radio").forEach(label => {
      label.addEventListener("click", () => {
        const tipus = label.querySelector("input[name='tipus']")?.value;
        const estat = tipus ? this.#bloqueig(tipus) : null;
        if (estat) this.#config.onBloqueig?.(estat);
      });
    });

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

    el.querySelector("[name='modeTret']")?.addEventListener("change", ev => {
      this.#modeTret = ev.target.value || "tret";
      this.render(false);
    });
    el.querySelector("[name='dimMak']")?.addEventListener("change", ev => {
      this.#dimMak = ev.target.value || "ferides";
    });

    el.querySelector("[name='efecteId']")?.addEventListener("change", ev => {
      this.#efecteId = ev.target.value || null;
      this.render(false);
    });
    el.querySelector("[name='artefacteId']")?.addEventListener("change", ev => {
      this.#artefacteId = ev.target.value || null;
      this.render(false);
    });

    // L'objectiu triat es marca al mapa (amb un «ping» en canviar-lo).
    const selObjectiu = el.querySelector("[name='objectiuTokenId']");
    if (selObjectiu) marcarObjectiu(selObjectiu.value || null);
    selObjectiu?.addEventListener("change", ev => {
      this.#objectiuTokenId = ev.target.value || null;
      marcarObjectiu(this.#objectiuTokenId, { ping: true });
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

    el.querySelector("[name='moviment']")?.addEventListener("change", ev => {
      this.#moviment = normalitzarMoviment(ev.target.value);
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
    // Estats: un tipus bloquejat no es pot declarar (el formulari ja el deshabilita).
    if (this.#bloqueig(tipus)) return;
    const arma    = tipus === "atac"    ? this.#config.armes?.find(a => a.id === d.armaId) : null;
    const defensa = tipus === "defensa" ? this.#config.defenses?.find(x => x.id === d.defensaId) : null;
    const maniobra = (arma?.permetManiobres && d.maniobraId)
      ? (this.#config.maniobres ?? []).find(m => m.id === d.maniobraId) ?? null
      : null;

    // WP-M: el moviment triat, validat contra els permesos per a aquesta acció.
    const moviment = this.#movimentEfectiu();

    let etiqueta;
    if (tipus === "atac")          etiqueta = arma?.nom ?? game.i18n.localize("FORJA.Combat.Accio.Atac");
    else if (tipus === "defensa")  etiqueta = defensa?.nom ?? game.i18n.localize("FORJA.Combat.Accio.Defensa");
    else if (tipus === "moviment") etiqueta = game.i18n.localize("FORJA.Combat.Accio.Moviment");
    else if (tipus === "manifestar") etiqueta = this.#config.efectes?.find(e => e.id === d.efecteId)?.nom ?? game.i18n.localize("FORJA.Combat.Accio.Manifestar");
    else if (tipus === "artefacte")  etiqueta = this.#config.artefactes?.find(a => a.id === d.artefacteId)?.nom ?? game.i18n.localize("FORJA.Combat.Accio.Artefacte");
    else                           etiqueta = game.i18n.localize("FORJA.Combat.Accio.Altra");
    if (maniobra) etiqueta = `${etiqueta} — ${maniobra.nom}`;
    if (moviment !== "basic" || tipus === "moviment") {
      etiqueta = `${etiqueta} — ${game.i18n.localize(ETIQUETES_MOVIMENT[moviment])}`;
    }

    // B16: el retard només val per a atacs de barallar-se sense maniobra.
    const retardBarallarse = arma
      ? limitarRetardBarallarse(d.retardBarallarse, retardMaximBarallarse(arma, arma.retardMax ?? 0, !!maniobra))
      : 0;
    if (retardBarallarse > 0) {
      etiqueta = `${etiqueta} — ${game.i18n.format("FORJA.Combat.RetardBarallarseEtiqueta", { n: retardBarallarse })}`;
    }

    // Latència mínima que la tria obliga a pagar (no es pot "desfer" editant
    // la latència a mà): retard de barallar-se (B16) i +2 del moviment
    // especial / càrrega (WP-M, manual l. 2792).
    const extraMoviment = latenciaExtraMoviment(moviment);
    const minimObligat = arma
      ? (retardBarallarse > 0 || extraMoviment > 0 || this.#modeEfectiu() !== "tret"
        ? (arma.latenciaTotal ?? 0) + retardBarallarse + extraMoviment + (MODES_TRET[this.#modeEfectiu()]?.latencia ?? 0) : 1)
      : (extraMoviment > 0 ? (this.#config.latenciaBase ?? 0) + extraMoviment : 1);

    this.#resolve?.({
      latencia:   Math.max(1, parseInt(d.latencia) || 1, minimObligat),
      tipus,
      armaId:     arma?.id ?? null,
      defensa:    defensa ?? null,
      maniobraId: maniobra?.id ?? null,
      objectiuTokenId: ["atac", "manifestar", "artefacte"].includes(tipus) ? (d.objectiuTokenId || null) : null,
      modeTret:    arma ? this.#modeEfectiu() : null,
      dimMak:      maniobra?.id === "dim-mak" ? (d.dimMak || "ferides") : null,
      efecteId:    tipus === "manifestar" ? (d.efecteId || null) : null,
      artefacteId: tipus === "artefacte" ? (d.artefacteId || null) : null,
      retardBarallarse,
      moviment,
      concentrar: !!d.concentrar && this.#potConcentrar(),
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
