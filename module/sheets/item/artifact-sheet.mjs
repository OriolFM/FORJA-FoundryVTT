const { HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Item sheet for Artifacts.
 */
export default class ForjaArtifactSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["forja", "sheet", "item", "artifact"],
    position: { width: 520, height: 550 },
    form: { submitOnChange: true }
  };

  static PARTS = {
    sheet: { template: "systems/forja/templates/item/artifact-sheet.hbs" }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return {
      ...context,
      system: this.document.system,
      cfg: CONFIG.FORJA,
      enrichedDescription: await TextEditor.enrichHTML(this.document.system.notes, { async: true })
    };
  }
}
