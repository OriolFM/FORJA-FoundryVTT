import ForjaNPCSheet from "./npc-sheet.mjs";

/**
 * Sheet for Animals. Minimal version of the NPC sheet.
 */
export default class ForjaAnimalSheet extends ForjaNPCSheet {

  static DEFAULT_OPTIONS = {
    ...ForjaNPCSheet.DEFAULT_OPTIONS,
    classes: ["forja", "sheet", "actor", "animal"],
    position: { width: 520, height: 600 }
  };

  static PARTS = {
    sheet: { template: "systems/forja/templates/actor/animal-sheet.hbs", scrollable: [""] }
  };
}
