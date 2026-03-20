const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Diàleg per seleccionar un personatge de FORJApp i carregar-lo a Foundry.
 * S'obre des del botó "Carregar de FORJApp" al full de PJ.
 */
export class ForjAppCharacterPicker extends HandlebarsApplicationMixin(ApplicationV2) {

  constructor(characters, options = {}) {
    super(options);
    this._characters = characters;
  }

  static DEFAULT_OPTIONS = {
    id: "forja-forjapp-picker",
    classes: ["forja", "forjapp-picker"],
    window: { title: "FORJA.ForjAppPicker.Title" },
    position: { width: 500, height: 520 },
    actions: {
      selectCharacter: ForjAppCharacterPicker._onSelectCharacter
    }
  };

  static PARTS = {
    picker: { template: "systems/forja/templates/apps/forjapp-character-picker.hbs" }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const typeLabels = { PJ: "PJ", PNJ: "PNJ", Criatura: "Criatura", Animal: "Animal" };

    return {
      ...context,
      characters: this._characters.map(c => ({
        id: c.id,
        name: c.name || game.i18n.localize("FORJA.Import.UnnamedCharacter"),
        type: typeLabels[c.characterType] ?? c.characterType ?? "PJ",
        species: c.species ?? "humanoid",
        updatedAt: c.updatedAt?.split("T")[0] ?? "—",
        hasForjappId: !!c.id
      })),
      isEmpty: !this._characters.length
    };
  }

  static async _onSelectCharacter(event, target) {
    const forjappId = target.dataset.characterId;
    if (!forjappId) return;

    const btn = target.closest("[data-action]");
    if (btn) btn.disabled = true;

    try {
      const { ForjAppBridge } = await import("./forjapp-bridge.mjs");
      await ForjAppBridge.loadCharacter(forjappId);
      this.close();
    } catch (e) {
      ui.notifications.error(`FORJApp: ${e.message}`);
      if (btn) btn.disabled = false;
    }
  }
}
