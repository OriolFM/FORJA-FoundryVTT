import ForjaCharacterSheet from "./character-sheet.mjs";

/**
 * Sheet for Creatures (Criatura). Uses the same tab-based layout as the character sheet.
 */
export default class ForjaCreatureSheet extends ForjaCharacterSheet {

  static DEFAULT_OPTIONS = {
    ...ForjaCharacterSheet.DEFAULT_OPTIONS,
    classes: ["forja", "sheet", "actor", "creature"],
    position: { width: 860, height: 860 }
  };
}
