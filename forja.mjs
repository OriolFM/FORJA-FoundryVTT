/**
 * FORJA RPG — Foundry VTT v14
 * Bootstrap principal. Registra tot via CONFIG (DA-2).
 */

import { FORJA }          from "./module/config/constants.mjs";
import ActorPersonatge     from "./module/data/actor-personatge.mjs";
import ActorPNJ            from "./module/data/actor-pnj.mjs";
import ItemTret            from "./module/data/item-tret.mjs";
import ItemArma            from "./module/data/item-arma.mjs";
import ItemArmadura        from "./module/data/item-armadura.mjs";
import ForjaActor          from "./module/documents/actor.mjs";
import ForjaCombat         from "./module/documents/combat.mjs";
import ForjaCombatTracker  from "./module/combat/tracker-ui.mjs";
import FullPersonatge      from "./module/apps/full-personatge.mjs";
import FullPNJ             from "./module/apps/full-pnj.mjs";
import ForjaRoll           from "./module/dice/forja-roll.mjs";
import { reiniciarReaccions } from "./module/combat/reaccions.mjs";
import { assegurarAtacsAutomatics } from "./module/combat/equipament-automatic.mjs";

Hooks.once("init", () => {
  console.log("FORJA RPG | Inicialitzant sistema FORJA v0.2");

  // Taules de constants globals
  CONFIG.FORJA = FORJA;

  // Classe de tirada personalitzada
  CONFIG.Dice.rolls.push(ForjaRoll);

  // Document classes
  CONFIG.Actor.documentClass = ForjaActor;
  CONFIG.Combat.documentClass = ForjaCombat;
  CONFIG.ui.combat = ForjaCombatTracker;

  // DataModels
  CONFIG.Actor.dataModels = {
    personatge: ActorPersonatge,
    pnj:        ActorPNJ
  };
  CONFIG.Item.dataModels = {
    tret:     ItemTret,
    arma:     ItemArma,
    armadura: ItemArmadura
  };

  // Atributs de token
  CONFIG.Actor.trackableAttributes = {
    personatge: {
      bar:   ["salut.fatiga", "salut.ferides"],
      value: ["latenciaBase", "defensa"]
    },
    pnj: {
      bar:   ["salut.fatiga", "salut.ferides"],
      value: ["latenciaBase", "defensa"]
    }
  };

  // Fulls d'actor (ApplicationV2)
  const { DocumentSheetConfig } = foundry.applications.apps;

  DocumentSheetConfig.registerSheet(Actor, "forja", FullPersonatge, {
    types:       ["personatge"],
    makeDefault: true,
    label:       "FORJA.Sheet.Personatge"
  });

  DocumentSheetConfig.registerSheet(Actor, "forja", FullPNJ, {
    types:       ["pnj"],
    makeDefault: true,
    label:       "FORJA.Sheet.PNJ"
  });

  // Handlebars helpers
  _registrarHelpers();

  console.log("FORJA RPG | Sistema inicialitzat");
});

Hooks.once("ready", () => {
  console.log("FORJA RPG | Sistema llest");
});

// Tot personatge/PNJ disposa de l'atac bàsic "Cop", i de l'atac corresponent
// a cada tret d'"Armament Natural" que tingui (manual): s'afegeixen sols.
Hooks.on("createActor", async (actor) => {
  await assegurarAtacsAutomatics(actor);
});

Hooks.on("createItem", async (item) => {
  const actor = item.parent;
  if (!actor || item.type !== "tret") return;
  await assegurarAtacsAutomatics(actor);
});

// Reaccions i concentració (S-11): qui acaba el seu torn recupera reaccions.
// Cal capturar el combatent SORTINT abans que l'update canviï el torn.
Hooks.on("preUpdateCombat", (combat, changes) => {
  if (("turn" in changes) || ("round" in changes)) {
    combat._forjaCombatentSortint = combat.combatant ?? null;
  }
});

Hooks.on("updateCombat", async (combat, changes) => {
  if (!(("turn" in changes) || ("round" in changes))) return;
  const actor = combat._forjaCombatentSortint?.actor;
  combat._forjaCombatentSortint = null;
  if (actor) await reiniciarReaccions(actor);
});

/* ---- Helpers Handlebars ---- */
function _registrarHelpers() {
  Handlebars.registerHelper("add",     (a, b) => (a ?? 0) + (b ?? 0));
  Handlebars.registerHelper("lt",      (a, b) => a < b);
  Handlebars.registerHelper("eq",      (a, b) => a === b);
  Handlebars.registerHelper("concat",  (...args) => args.slice(0, -1).join(""));
  Handlebars.registerHelper("lookup",  (obj, key) => obj?.[key]);
  Handlebars.registerHelper("or",  (a, b) => !!a || !!b);
  Handlebars.registerHelper("dieClass", (val) => {
    if (val === 1)  return "dau-pifia";
    if (val >= 10)  return "dau-doble";
    if (val >= 6)   return "dau-fita";
    return "dau-neutre";
  });
}
