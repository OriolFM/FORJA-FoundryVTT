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
 */
export default class FullItem extends HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["forja", "full-item"],
    position: { width: 480, height: "auto" },
    window: { resizable: true },
    form: { submitOnChange: true }
  };

  static PARTS = {
    body: { template: "systems/forja/templates/item/item-body.hbs" }
  };

  /** @override */
  async _prepareContext(options) {
    const ctx  = await super._prepareContext(options);
    const item = this.item;
    const sys  = item.system;

    const cosHtml = await renderTemplate(`systems/forja/templates/item/${item.type}.hbs`, {
      item, sys, cfg: CONFIG.FORJA,
      fields: sys.schema.fields,
      // Camp avançat (ObjectField, només tret): es mostra/edita com a JSON
      // pla — vegeu `_processSubmitData` per com es reinterpreta en desar.
      efecteJSON: item.type === "tret" ? JSON.stringify(sys.efecte ?? null, null, 2) : undefined
    });

    return { ...ctx, item, sys, cosHtml };
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
    return super._processSubmitData(event, form, submitData, options);
  }
}
