import ForjaCharacterSheet from "./character-sheet.mjs";

/**
 * Sheet for NPCs (PNJ). Uses the same tab-based layout as the character sheet.
 */
export default class ForjaNPCSheet extends ForjaCharacterSheet {

  static DEFAULT_OPTIONS = {
    ...ForjaCharacterSheet.DEFAULT_OPTIONS,
    classes: ["forja", "sheet", "actor", "npc"],
    position: { width: 860, height: 860 }
  };
}
