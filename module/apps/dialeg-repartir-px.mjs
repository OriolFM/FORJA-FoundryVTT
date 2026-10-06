import {
  recompensesPJ, virtutsRepetides, afegirHistorial, NIVELLS_OBJECTIU, VIRTUTS, RECOMPENSES_PX
} from "../progressio/experiencia.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Eina del DJ per repartir PX al final d'una sessió o d'un mòdul (Fase 4;
 * manual › Guanyar punts d'experiència, l. 6577–6665): objectius de grup
 * (per a tots els PJ triats), objectius individuals, una virtut per PJ i PX
 * addicionals. Calcula els PX amb la taula del manual, els suma a
 * `px.total`, els anota a l'historial i ho publica al xat.
 *
 * S'obre des del directori d'actors (botó del DJ, `forja.mjs`).
 */
export default class DiategRepartirPX extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "forja-dialeg-repartir-px",
    classes: ["forja", "forja-dialog", "dialeg-repartir-px"],
    tag: "form",
    position: { width: 640, height: "auto" },
    window: { title: "FORJA.Experiencia.Titol", resizable: true },
    form: { closeOnSubmit: true, handler: DiategRepartirPX._onSubmit },
    actions: {
      afegirObjectiuGrup: DiategRepartirPX._onAfegirObjectiuGrup,
      treureObjectiuGrup: DiategRepartirPX._onTreureObjectiuGrup
    }
  };

  static PARTS = {
    form: { template: "systems/forja/templates/actor/dialeg-repartir-px.hbs" }
  };

  /** Objectius de grup: [{nivell, descripcio}] */
  #grup = [];
  /** Per PJ (id): {inclou, nivell, descripcio, virtut, altres} */
  #pjs = new Map();

  constructor(options = {}) {
    super(options);
    for (const a of DiategRepartirPX.#candidats()) {
      this.#pjs.set(a.id, { inclou: true, nivell: "", descripcio: "", virtut: "", altres: 0 });
    }
  }

  /** PJ amb jugador (els que reben PX). */
  static #candidats() {
    return game.actors.filter(a => a.type === "personatge" && a.hasPlayerOwner);
  }

  /** Recompenses d'un PJ segons el formulari. */
  #recompenses(id) {
    const p = this.#pjs.get(id);
    if (!p?.inclou) return { total: 0, linies: [] };
    return recompensesPJ({
      grup: this.#grup.filter(o => o.nivell),
      individuals: p.nivell ? [{ nivell: p.nivell, descripcio: p.descripcio }] : [],
      virtut: p.virtut || null,
      altres: p.altres
    });
  }

  async _prepareContext(options) {
    const nivells = NIVELLS_OBJECTIU.map(id => ({ id, nom: game.i18n.localize(`FORJA.Experiencia.Nivell.${id}`) }));
    const virtuts = VIRTUTS.map(id => ({ id, nom: game.i18n.localize(`FORJA.Experiencia.Virtut.${id}`) }));
    const repetides = virtutsRepetides(Object.fromEntries([...this.#pjs].filter(([, p]) => p.inclou).map(([id, p]) => [id, p.virtut || null])));
    return {
      taula: RECOMPENSES_PX,
      nivells, virtuts,
      grup: this.#grup.map((o, idx) => ({ ...o, idx })),
      pjs: DiategRepartirPX.#candidats().map(a => ({
        id: a.id, nom: a.name, ...this.#pjs.get(a.id), total: this.#recompenses(a.id).total,
        pxActuals: a.system.px?.total ?? 0
      })),
      repetides: repetides.map(v => game.i18n.localize(`FORJA.Experiencia.Virtut.${v}`)).join(", ")
    };
  }

  async _onRender(context, options) {
    await super._onRender?.(context, options);
    this.element.querySelectorAll("[data-grup]").forEach(el => el.addEventListener("change", ev => {
      const o = this.#grup[Number(el.dataset.grup)];
      if (o) o[el.dataset.camp] = ev.target.value;
      this.render(false);
    }));
    this.element.querySelectorAll("[data-pj]").forEach(el => el.addEventListener("change", ev => {
      const p = this.#pjs.get(el.dataset.pj);
      if (!p) return;
      const camp = el.dataset.camp;
      p[camp] = el.type === "checkbox" ? el.checked : camp === "altres" ? (parseInt(el.value) || 0) : el.value;
      this.render(false);
    }));
  }

  static _onAfegirObjectiuGrup() {
    this.#grup.push({ nivell: "menor", descripcio: "" });
    this.render(false);
  }

  static _onTreureObjectiuGrup(event, target) {
    this.#grup.splice(Number(target.dataset.idx), 1);
    this.render(false);
  }

  static async _onSubmit() {
    const files = [];
    const data = Date.now();
    for (const actor of DiategRepartirPX.#candidats()) {
      const { total, linies } = this.#recompenses(actor.id);
      if (!total) continue;
      await actor.update({
        "system.px.total": (actor.system.px?.total ?? 0) + total,
        "system.px.historial": afegirHistorial(actor.system.px?.historial, linies, data)
      });
      files.push(`<li><strong>${Handlebars.escapeExpression(actor.name)}</strong>: +${total} PX</li>`);
    }
    if (!files.length) return;
    await ChatMessage.create({
      content: `<div class="forja-missatge-accio"><strong>${game.i18n.localize("FORJA.Experiencia.Repartits")}</strong><ul>${files.join("")}</ul></div>`
    });
  }
}
