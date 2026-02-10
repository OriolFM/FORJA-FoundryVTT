const { HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Item sheet for Skills.
 */
export default class ForjaSkillSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["forja", "sheet", "item", "skill"],
    position: { width: 480, height: 400 },
    form: { submitOnChange: true }
  };

  static PARTS = {
    sheet: { template: "systems/forja/templates/item/skill-sheet.hbs" }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return {
      ...context,
      system: this.document.system,
      cfg: CONFIG.FORJA
    };
  }
}
