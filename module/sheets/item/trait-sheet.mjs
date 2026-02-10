/**
 * Item sheet for Traits.
 */
export default class ForjaTraitSheet extends foundry.applications.sheets.ItemSheetV2 {

  static DEFAULT_OPTIONS = {
    classes: ["forja", "sheet", "item", "trait"],
    position: { width: 480, height: 450 },
    form: { submitOnChange: true }
  };

  static PARTS = {
    sheet: { template: "systems/forja/templates/item/trait-sheet.hbs" }
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
