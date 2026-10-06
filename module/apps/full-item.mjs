import { calcularParametres } from "../progressio/construccio.mjs";
import DiategConstructor from "./dialeg-constructor.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * C3: fitxa d'Item. Substitueix la fitxa genèrica de Foundry (que no sap res
 * dels camps `system` propis de FORJA) per una que edita tots els camps de
 * cada DataModel (`module/data/item-*.mjs`) — una plantilla per tipus (tret,
 * arma, armadura, artefacte) sota `templates/item/`.
 *
 * Una sola classe serveix als quatre tipus (com Foundry permet registrar per
 * `types` a `DocumentSheetConfig.registerSheet`, forja.mjs): la plantilla
 * concreta es tria i es renderitza a `_prepareContext` (`item.type`) i s'injecta
 * ja renderitzada al part únic `body` (evita dependre de partials dinàmics
 * de Handlebars per triar plantilla per instància).
 *
 * Fase 2 (2026-10-06): també serveix els efectes, i els efectes i artefactes
 * mostren els seus paràmetres (`templates/item/parametres.hbs`) amb el cost
 * recalculat i un botó per editar-los amb el constructor.
 */
export default class FullItem extends HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["forja", "full-item"],
    position: { width: 480, height: "auto" },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      forjaEditarParametres: FullItem._onEditarParametres
    }
  };

  /** L'item té paràmetres de construcció (efectes i artefactes). */
  get #teParametres() {
    return ["efecte", "artefacte"].includes(this.item.type);
  }

  static PARTS = {
    body: { template: "systems/forja/templates/item/item-body.hbs" }
  };

  /** @override */
  async _prepareContext(options) {
    const ctx  = await super._prepareContext(options);
    const item = this.item;
    const sys  = item.system;

    let parametresHtml = "";
    if (this.#teParametres) {
      const r = calcularParametres(sys.parametres ?? [], { ...(sys.construccio ?? {}), autoDificultat: item.type === "efecte" });
      parametresHtml = await foundry.applications.handlebars.renderTemplate("systems/forja/templates/item/parametres.hbs", {
        resultat: r,
        teParametres: (sys.parametres ?? []).length > 0,
        quadra: r.cost === sys.cost,
        potEditar: this.isEditable
      });
    }

    const cosHtml = await foundry.applications.handlebars.renderTemplate(`systems/forja/templates/item/${item.type}.hbs`, {
      parametresHtml,
      atributs: CONFIG.FORJA.ATRIBUTS,
      habilitats: CONFIG.FORJA.LLISTA_HABILITATS.map(h => ({ id: h.id, nom: game.i18n.localize(h.nom) })),
      item, sys, cfg: CONFIG.FORJA,
      fields: sys.schema.fields,
      // Camp avançat (ObjectField, només tret): es mostra/edita com a JSON
      // pla — vegeu `_processSubmitData` per com es reinterpreta en desar.
      efecteJSON: item.type === "tret" ? JSON.stringify(sys.efecte ?? null, null, 2) : undefined,
      // Propietats d'arma (ArrayField) com a text separat per comes.
      propietatsText: item.type === "arma" ? (sys.propietats ?? []).join(", ") : undefined
    });

    return { ...ctx, item, sys, cosHtml };
  }

  /**
   * Obre el constructor amb els paràmetres de l'efecte o artefacte i en desa
   * el resultat (cost, dificultat, latència i paràmetres).
   */
  static async _onEditarParametres(event, target) {
    const item = this.item;
    const sys = item.system;
    const esArtefacte = item.type === "artefacte";
    const construit = await DiategConstructor.obrir({
      esArtefacte,
      inicial: {
        nom: item.name, do: sys.do, categoria: sys.categoria,
        parametres: sys.parametres ?? [], construccio: sys.construccio ?? {}
      }
    });
    if (!construit) return;
    const comu = { cost: construit.cost, parametres: construit.parametres, construccio: construit.construccio };
    if (esArtefacte) {
      await item.update({
        name: construit.nom,
        "system.cost": comu.cost,
        "system.parametres": comu.parametres,
        "system.construccio": comu.construccio,
        "system.categoria": construit.categoria,
        "system.activacio.tipus": construit.activacioId,
        "system.activacio.dificultat": construit.dificultat,
        "system.us.modLatencia": construit.modLatencia
      });
    } else {
      await item.update({
        name: construit.nom,
        system: { ...comu, do: construit.do, tipus: construit.tipus, dificultat: construit.dificultat, modLatencia: construit.modLatencia }
      });
    }
  }

  /**
   * @override `system.efecte` (ItemTret) és un `ObjectField` genèric que la
   * plantilla edita com a text JSON pla (`<textarea name="system.efecte">`);
   * aquí es reinterpreta abans de desar. Un JSON invàlid es descarta amb un
   * avís enlloc de trencar la resta del formulari o desar text brut.
   */
  async _processSubmitData(event, form, submitData, options) {
    const raw = submitData?.system?.efecte;
    if (typeof raw === "string") {
      const text = raw.trim();
      try {
        submitData.system.efecte = text ? JSON.parse(text) : null;
      } catch (err) {
        ui.notifications?.error(game.i18n.localize("FORJA.Item.EfecteJSONInvalid"));
        delete submitData.system.efecte;
      }
    }
    // `system.propietats` (ItemArma) s'edita com a text separat per comes.
    const props = submitData?.system?.propietats;
    if (typeof props === "string") {
      submitData.system.propietats = props.split(",").map(p => p.trim()).filter(Boolean);
    }
    return super._processSubmitData(event, form, submitData, options);
  }
}
