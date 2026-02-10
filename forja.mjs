/**
 * FORJA RPG - Foundry VTT System
 * Main entry point. Registers all data models, documents, sheets, and configuration.
 */

// Configuration
import { FORJA } from "./module/helpers/config.mjs";
import { registerHandlebarsHelpers } from "./module/helpers/templates.mjs";

// Data Models - Actors
import CharacterData from "./module/data-models/actor/character.mjs";
import NPCData from "./module/data-models/actor/npc.mjs";
import CreatureData from "./module/data-models/actor/creature.mjs";
import AnimalData from "./module/data-models/actor/animal.mjs";

// Data Models - Items
import SkillData from "./module/data-models/item/skill.mjs";
import TraitData from "./module/data-models/item/trait.mjs";
import WeaponData from "./module/data-models/item/weapon.mjs";
import ArmorData from "./module/data-models/item/armor.mjs";
import ArtifactData from "./module/data-models/item/artifact.mjs";
import SupernaturalEffectData from "./module/data-models/item/supernatural-effect.mjs";

// Document classes
import ForjaActor from "./module/documents/actor.mjs";
import ForjaItem from "./module/documents/item.mjs";
import ForjaCombat from "./module/documents/combat.mjs";
import ForjaCombatant from "./module/documents/combatant.mjs";

// Dice
import ForjaRoll from "./module/dice/forja-roll.mjs";

// Combat UI
import ForjaCombatTracker from "./module/combat/combat-tracker.mjs";

// Actor Sheets
import ForjaCharacterSheet from "./module/sheets/actor/character-sheet.mjs";
import ForjaNPCSheet from "./module/sheets/actor/npc-sheet.mjs";
import ForjaCreatureSheet from "./module/sheets/actor/creature-sheet.mjs";
import ForjaAnimalSheet from "./module/sheets/actor/animal-sheet.mjs";

// Item Sheets
import ForjaSkillSheet from "./module/sheets/item/skill-sheet.mjs";
import ForjaTraitSheet from "./module/sheets/item/trait-sheet.mjs";
import ForjaWeaponSheet from "./module/sheets/item/weapon-sheet.mjs";
import ForjaArmorSheet from "./module/sheets/item/armor-sheet.mjs";
import ForjaArtifactSheet from "./module/sheets/item/artifact-sheet.mjs";
import ForjaSupernaturalEffectSheet from "./module/sheets/item/supernatural-effect-sheet.mjs";

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once("init", () => {
  console.log("FORJA RPG | Initializing FORJA RPG system");

  // Store system config on the global CONFIG object
  CONFIG.FORJA = FORJA;

  // Register document classes
  CONFIG.Actor.documentClass = ForjaActor;
  CONFIG.Item.documentClass = ForjaItem;
  CONFIG.Combat.documentClass = ForjaCombat;
  CONFIG.Combatant.documentClass = ForjaCombatant;

  // Register custom Roll class
  CONFIG.Dice.rolls.push(ForjaRoll);

  // Register custom Combat Tracker UI
  CONFIG.ui.combat = ForjaCombatTracker;

  // Register data models
  CONFIG.Actor.dataModels = {
    character: CharacterData,
    npc: NPCData,
    creature: CreatureData,
    animal: AnimalData
  };

  CONFIG.Item.dataModels = {
    skill: SkillData,
    trait: TraitData,
    weapon: WeaponData,
    armor: ArmorData,
    artifact: ArtifactData,
    supernaturalEffect: SupernaturalEffectData
  };

  // Configure trackable attributes for token bars
  CONFIG.Actor.trackableAttributes = {
    character: {
      bar: ["health.wounds", "health.fatigue"],
      value: ["latency", "defense"]
    },
    npc: {
      bar: ["health.wounds", "health.fatigue"],
      value: ["latency", "defense"]
    },
    creature: {
      bar: ["health.wounds", "health.fatigue"],
      value: ["latency", "defense"]
    },
    animal: {
      bar: ["health.wounds", "health.fatigue"],
      value: ["latency", "defense"]
    }
  };

  // Register Actor sheets
  DocumentSheetConfig.unregisterSheet(Actor, "core", ActorSheet);

  DocumentSheetConfig.registerSheet(Actor, "forja", ForjaCharacterSheet, {
    types: ["character"],
    makeDefault: true,
    label: "FORJA.Sheet.Character"
  });

  DocumentSheetConfig.registerSheet(Actor, "forja", ForjaNPCSheet, {
    types: ["npc"],
    makeDefault: true,
    label: "FORJA.Sheet.NPC"
  });

  DocumentSheetConfig.registerSheet(Actor, "forja", ForjaCreatureSheet, {
    types: ["creature"],
    makeDefault: true,
    label: "FORJA.Sheet.Creature"
  });

  DocumentSheetConfig.registerSheet(Actor, "forja", ForjaAnimalSheet, {
    types: ["animal"],
    makeDefault: true,
    label: "FORJA.Sheet.Animal"
  });

  // Register Item sheets
  DocumentSheetConfig.unregisterSheet(Item, "core", ItemSheet);

  DocumentSheetConfig.registerSheet(Item, "forja", ForjaSkillSheet, {
    types: ["skill"],
    makeDefault: true,
    label: "FORJA.Sheet.Skill"
  });

  DocumentSheetConfig.registerSheet(Item, "forja", ForjaTraitSheet, {
    types: ["trait"],
    makeDefault: true,
    label: "FORJA.Sheet.Trait"
  });

  DocumentSheetConfig.registerSheet(Item, "forja", ForjaWeaponSheet, {
    types: ["weapon"],
    makeDefault: true,
    label: "FORJA.Sheet.Weapon"
  });

  DocumentSheetConfig.registerSheet(Item, "forja", ForjaArmorSheet, {
    types: ["armor"],
    makeDefault: true,
    label: "FORJA.Sheet.Armor"
  });

  DocumentSheetConfig.registerSheet(Item, "forja", ForjaArtifactSheet, {
    types: ["artifact"],
    makeDefault: true,
    label: "FORJA.Sheet.Artifact"
  });

  DocumentSheetConfig.registerSheet(Item, "forja", ForjaSupernaturalEffectSheet, {
    types: ["supernaturalEffect"],
    makeDefault: true,
    label: "FORJA.Sheet.SupernaturalEffect"
  });

  // Register Handlebars helpers
  registerHandlebarsHelpers();

  // Preload Handlebars templates
  _preloadHandlebarsTemplates();

  console.log("FORJA RPG | System initialization complete");
});

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once("ready", () => {
  console.log("FORJA RPG | System ready");
});

/* -------------------------------------------- */
/*  Handlebars Templates                        */
/* -------------------------------------------- */

async function _preloadHandlebarsTemplates() {
  const templatePaths = [
    // Actor partials
    "systems/forja/templates/actor/parts/character-header.hbs",
    "systems/forja/templates/actor/parts/attributes.hbs",
    "systems/forja/templates/actor/parts/derived-stats.hbs",
    "systems/forja/templates/actor/parts/skills-list.hbs",
    "systems/forja/templates/actor/parts/traits-list.hbs",
    "systems/forja/templates/actor/parts/weapons-list.hbs",
    "systems/forja/templates/actor/parts/armor-display.hbs",
    "systems/forja/templates/actor/parts/combat-info.hbs",
    "systems/forja/templates/actor/parts/equipment-tab.hbs",
    "systems/forja/templates/actor/parts/effects-list.hbs",
    "systems/forja/templates/actor/parts/wound-fatigue-tracker.hbs",
    "systems/forja/templates/actor/parts/biography-tab.hbs",

    // Item sheets
    "systems/forja/templates/item/skill-sheet.hbs",
    "systems/forja/templates/item/trait-sheet.hbs",
    "systems/forja/templates/item/weapon-sheet.hbs",
    "systems/forja/templates/item/armor-sheet.hbs",
    "systems/forja/templates/item/artifact-sheet.hbs",
    "systems/forja/templates/item/supernatural-effect-sheet.hbs",

    // Dice
    "systems/forja/templates/dice/roll-dialog.hbs",
    "systems/forja/templates/dice/roll-result.hbs"
  ];

  return loadTemplates(templatePaths);
}
