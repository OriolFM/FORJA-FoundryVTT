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
import ItemArtefacte       from "./module/data/item-artefacte.mjs";
import ForjaActor          from "./module/documents/actor.mjs";
import ForjaCombat         from "./module/documents/combat.mjs";
import ForjaCombatTracker  from "./module/combat/tracker-ui.mjs";
import FullPersonatge      from "./module/apps/full-personatge.mjs";
import FullPNJ             from "./module/apps/full-pnj.mjs";
import FullItem            from "./module/apps/full-item.mjs";
import ForjaRoll           from "./module/dice/forja-roll.mjs";
import { registrarSocket } from "./module/xarxa/socket.mjs";
import { assegurarAtacsAutomatics, eliminarArmaNaturalDelTret } from "./module/combat/equipament-automatic.mjs";
import { registrarEstats } from "./module/estats/estats.mjs";

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
    tret:      ItemTret,
    arma:      ItemArma,
    armadura:  ItemArmadura,
    artefacte: ItemArtefacte
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

  // Fitxa d'Item (C3): una classe per als 4 tipus, una plantilla cadascun
  // (templates/item/*.hbs) — reemplaça la fitxa genèrica de Foundry, que no
  // sap res dels camps `system` de FORJA.
  DocumentSheetConfig.registerSheet(Item, "forja", FullItem, {
    types:       ["tret", "arma", "armadura", "artefacte"],
    makeDefault: true,
    label:       "FORJA.Sheet.Item"
  });

  // Estats (S-16): catàleg com a CONFIG.statusEffects (HUD del token / fitxa)
  registrarEstats();

  // Handlebars helpers
  _registrarHelpers();

  console.log("FORJA RPG | Sistema inicialitzat");
});

Hooks.once("ready", () => {
  // Relé d'autoritat del DJ (A2): escriptures a documents d'altri.
  registrarSocket();
  console.log("FORJA RPG | Sistema llest");
});

// Tot personatge/PNJ disposa de l'atac bàsic "Cop", i de l'atac corresponent
// a cada tret d'"Armament Natural" que tingui (manual): s'afegeixen sols.
// Només el client que ha creat el document ho fa (A1), per evitar duplicats.
Hooks.on("createActor", async (actor, _options, userId) => {
  if (userId !== game.user.id) return;
  await assegurarAtacsAutomatics(actor);
});

Hooks.on("createItem", async (item, _options, userId) => {
  if (userId !== game.user.id) return;
  const actor = item.parent;
  if (!actor || item.type !== "tret") return;
  await assegurarAtacsAutomatics(actor);
});

// B11: en eliminar un tret d'"Armament Natural", elimina l'arma natural que
// concedia (llevat que un altre tret restant la segueixi concedint). Només
// el client que ha fet l'eliminació ho fa (mateix criteri A1 que a dalt).
Hooks.on("deleteItem", async (item, _options, userId) => {
  if (userId !== game.user.id) return;
  if (item.type !== "tret") return;
  await eliminarArmaNaturalDelTret(item);
});

// Reaccions i concentració (S-11): qui acaba el seu torn recupera reaccions.
// Només al DJ actiu (A1). El combatent que acaba el passa `ForjaCombat#nextTurn`
// a les opcions de l'update (es difonen a tots els clients); per a canvis de
// torn d'altres orígens, s'usa l'estat previ que Foundry desa a `combat.previous`.
Hooks.on("updateCombat", async (combat, changes, options) => {
  if (!game.users.activeGM?.isSelf) return;
  const sortintId = options?.forja?.combatentSortint
    ?? ((("turn" in changes) || ("round" in changes)) ? combat.previous?.combatantId : null);
  if (!sortintId) return;
  const combatant = combat.combatants.get(sortintId);
  if (combatant && typeof combat.fiDeTorn === "function") await combat.fiDeTorn(combatant);
});

/* ---- Helpers Handlebars ----
 * `eq`, `lt`, `or` són de Foundry i `lookup` és nadiu de Handlebars (A7):
 * no es tornen a registrar (el `or` de 2 arguments trencava plantilles del nucli). */
function _registrarHelpers() {
  Handlebars.registerHelper("add",     (a, b) => (a ?? 0) + (b ?? 0));
  Handlebars.registerHelper("concat",  (...args) => args.slice(0, -1).join(""));
  Handlebars.registerHelper("dieClass", (val) => {
    if (val === 1)  return "dau-pifia";
    if (val >= 10)  return "dau-doble";
    if (val >= 6)   return "dau-fita";
    return "dau-neutre";
  });
}
