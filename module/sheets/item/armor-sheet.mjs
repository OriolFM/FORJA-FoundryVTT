/**
 * Item sheet for Armor.
 */
export default class ForjaArmorSheet extends foundry.applications.sheets.ItemSheetV2 {

  static DEFAULT_OPTIONS = {
    classes: ["forja", "sheet", "item", "armor"],
    position: { width: 420, height: 350 },
    form: { submitOnChange: true }
  };

  static PARTS = {
    sheet: { template: "systems/forja/templates/item/armor-sheet.hbs" }
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
