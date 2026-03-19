import ForjaCharacterSheet from "./character-sheet.mjs";

/**
 * Sheet for Animals. Uses the same tab-based layout as the character sheet.
 */
export default class ForjaAnimalSheet extends ForjaCharacterSheet {

  static DEFAULT_OPTIONS = {
    ...ForjaCharacterSheet.DEFAULT_OPTIONS,
    classes: ["forja", "sheet", "actor", "animal"],
    position: { width: 860, height: 860 }
  };
}
