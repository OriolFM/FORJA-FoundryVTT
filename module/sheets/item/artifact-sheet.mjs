const { HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Item sheet for Artifacts.
 */
export default class ForjaArtifactSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["forja", "sheet", "item", "artifact"],
    position: { width: 520, height: 700 },
    form: { submitOnChange: true },
    actions: {
      addSkillBonus: ForjaArtifactSheet._addSkillBonus,
      removeSkillBonus: ForjaArtifactSheet._removeSkillBonus,
      addStateApplied: ForjaArtifactSheet._addStateApplied,
      removeStateApplied: ForjaArtifactSheet._removeStateApplied,
      addTraitGranted: ForjaArtifactSheet._addTraitGranted,
      removeTraitGranted: ForjaArtifactSheet._removeTraitGranted
    }
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

  static async _addSkillBonus(event, target) {
    const current = this.document.system.skillBonus ?? [];
    await this.document.update({ "system.skillBonus": [...current, { skillId: "", bonus: 0 }] });
  }

  static async _removeSkillBonus(event, target) {
    const idx = parseInt(target.dataset.index);
    const current = [...(this.document.system.skillBonus ?? [])];
    current.splice(idx, 1);
    await this.document.update({ "system.skillBonus": current });
  }

  static async _addStateApplied(event, target) {
    const current = this.document.system.statesApplied ?? [];
    await this.document.update({ "system.statesApplied": [...current, { stateId: "", value: 0 }] });
  }

  static async _removeStateApplied(event, target) {
    const idx = parseInt(target.dataset.index);
    const current = [...(this.document.system.statesApplied ?? [])];
    current.splice(idx, 1);
    await this.document.update({ "system.statesApplied": current });
  }

  static async _addTraitGranted(event, target) {
    const current = this.document.system.traitsGranted ?? [];
    await this.document.update({ "system.traitsGranted": [...current, ""] });
  }

  static async _removeTraitGranted(event, target) {
    const idx = parseInt(target.dataset.index);
    const current = [...(this.document.system.traitsGranted ?? [])];
    current.splice(idx, 1);
    await this.document.update({ "system.traitsGranted": current });
  }
}
