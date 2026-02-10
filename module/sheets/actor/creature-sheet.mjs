import ForjaNPCSheet from "./npc-sheet.mjs";

/**
 * Sheet for Creatures (Criatura). Reuses NPC sheet with different styling.
 */
export default class ForjaCreatureSheet extends ForjaNPCSheet {

  static DEFAULT_OPTIONS = {
    ...ForjaNPCSheet.DEFAULT_OPTIONS,
    classes: ["forja", "sheet", "actor", "creature"]
  };

  static PARTS = {
    sheet: { template: "systems/forja/templates/actor/creature-sheet.hbs", scrollable: [""] }
  };
}
