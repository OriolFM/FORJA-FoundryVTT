/**
 * Item sheet for Weapons.
 */
export default class ForjaWeaponSheet extends foundry.applications.sheets.ItemSheetV2 {

  static DEFAULT_OPTIONS = {
    classes: ["forja", "sheet", "item", "weapon"],
    position: { width: 480, height: 450 },
    form: { submitOnChange: true }
  };

  static PARTS = {
    sheet: { template: "systems/forja/templates/item/weapon-sheet.hbs" }
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
