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

// Combat UI (hook-based injection)
import { registerCombatHooks } from "./module/combat/combat-tracker.mjs";

// Import
import ForjaCharacterImporter from "./module/import/character-importer.mjs";

// Apps
import { AntagonistQuickCreator } from "./module/apps/antagonist-quick-creator.mjs";
import { CharacterCreationWizard } from "./module/apps/character-creation-wizard.mjs";

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

  // Register FORJA combat tracker hooks (inject UI into default tracker)
  registerCombatHooks();

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

  // Register Actor sheets (makeDefault: true overrides core sheets)
  const { DocumentSheetConfig } = foundry.applications.apps;

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

  // Register Item sheets (makeDefault: true overrides core sheets)
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

  // Register world settings
  game.settings.register("forja", "forjappApiKey", {
    name: "FORJA.Settings.ForjappApiKey",
    hint: "FORJA.Settings.ForjappApiKeyHint",
    scope: "world",
    config: true,
    type: String,
    default: ""
  });

  game.settings.register("forja", "forjappProjectId", {
    name: "FORJA.Settings.ForjAppProjectId",
    hint: "FORJA.Settings.ForjAppProjectIdHint",
    scope: "world",
    config: true,
    type: String,
    default: "forjapp"
  });

  game.settings.register("forja", "forjappUserId", {
    name: "FORJA.Settings.ForjAppUserId",
    hint: "FORJA.Settings.ForjAppUserIdHint",
    scope: "client",
    config: true,
    type: String,
    default: ""
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
/*  Actor Directory - Import Button             */
/* -------------------------------------------- */

Hooks.on("getActorDirectoryEntryContext", () => {});
Hooks.on("renderActorDirectory", (app, html) => {
  const root = html[0] ?? html;

  // Avoid duplicating buttons on re-renders
  if (root.querySelector?.(".forja-import-btn")) return;

  // Import button
  const importBtn = document.createElement("button");
  importBtn.classList.add("forja-import-btn");
  importBtn.type = "button";
  importBtn.innerHTML = `<i class="fas fa-file-import"></i> ${game.i18n.localize("FORJA.Import.Title")}`;
  importBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    ForjaCharacterImporter.showImportDialog();
  });

  // Antagonist quick creator button (GM only)
  const antagonistBtn = document.createElement("button");
  antagonistBtn.classList.add("forja-antagonist-btn");
  antagonistBtn.type = "button";
  antagonistBtn.innerHTML = `<i class="fas fa-user-secret"></i> ${game.i18n.localize("FORJA.Antagonist.QuickCreate")}`;
  antagonistBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    new AntagonistQuickCreator().render(true);
  });

  // Try multiple selectors for v13 compatibility
  const container = root.querySelector?.(".header-actions")
    ?? root.querySelector?.(".action-buttons")
    ?? root.querySelector?.(".directory-header")
    ?? html.find?.(".header-actions")?.[0]
    ?? html.find?.(".directory-header")?.[0];

  if (container) {
    container.appendChild(importBtn);
    if (game.user.isGM) container.appendChild(antagonistBtn);
  } else {
    console.warn("FORJA | Could not find header container in ActorDirectory, appending to root");
    const target = root.querySelector?.(".directory") ?? root;
    target.prepend(antagonistBtn);
    target.prepend(importBtn);
  }
});

/* -------------------------------------------- */
/*  Character Creation Wizard Hook              */
/* -------------------------------------------- */

Hooks.on("preCreateActor", (doc, data, options, userId) => {
  if (data.type !== "character") return true;
  if (options.skipWizard) return true;
  if (userId !== game.user.id) return true;
  new CharacterCreationWizard({ actorName: data.name ?? "" }).render(true);
  return false;
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
    "systems/forja/templates/dice/roll-result.hbs",

    // Apps
    "systems/forja/templates/apps/forjapp-character-picker.hbs",
    "systems/forja/templates/apps/antagonist-quick-creator.hbs",
    "systems/forja/templates/apps/character-creation-wizard.hbs",

    // Combat
    "systems/forja/templates/combat/combat-tracker.hbs",
    "systems/forja/templates/combat/start-combat-dialog.hbs",
    "systems/forja/templates/combat/declare-action-dialog.hbs",
    "systems/forja/templates/combat/defense-dialog.hbs",
    "systems/forja/templates/combat/damage-confirm-dialog.hbs",
    "systems/forja/templates/combat/area-damage-confirm-dialog.hbs"
  ];

  return foundry.applications.handlebars.loadTemplates(templatePaths);
}
