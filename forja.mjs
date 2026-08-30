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
import ItemEfecte          from "./module/data/item-efecte.mjs";
import ForjaActor          from "./module/documents/actor.mjs";
import ForjaCombat         from "./module/documents/combat.mjs";
import ForjaCombatTracker  from "./module/combat/tracker-ui.mjs";
import FullPersonatge      from "./module/apps/full-personatge.mjs";
import FullPNJ             from "./module/apps/full-pnj.mjs";
import ForjaRoll           from "./module/dice/forja-roll.mjs";
import { reiniciarReaccions } from "./module/combat/reaccions.mjs";
import { recuperarEquilibri } from "./module/combat/manifestar.mjs";
import { avancarRecarregaActor } from "./module/combat/artefactes.mjs";
import { assegurarAtacsAutomatics } from "./module/combat/equipament-automatic.mjs";
import { registrarEstats } from "./module/estats/estats.mjs";
import { registrarHookValorX, aplicarTicsEstats } from "./module/estats/estats-parametritzats.mjs";
import { potMoureToken } from "./module/combat/restriccio-moviment.mjs";

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
    artefacte: ItemArtefacte,
    efecte:    ItemEfecte
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

  // Estats (S-16): catàleg com a CONFIG.statusEffects (HUD del token / fitxa)
  registrarEstats();
  // Tics d'estats parametritzats (M-05): demana X en marcar Lent/Ràpid/
  // Recuperació/Sagnant des del HUD del token.
  registrarHookValorX();

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
// El combatent SORTINT es captura a `ForjaCombat#declararAccio` (l'únic punt
// on la identitat és inequívoca), no aquí: en el moment en què arriba aquest
// update de `turn`/`round`, `setupTurns()` ja pot haver reordenat `this.turns`
// (declararAccio el crida abans de `nextTurn`), de manera que `combat.combatant`
// (índex `this.turn` contra `this.turns`) ja no és fiable.
Hooks.on("updateCombat", async (combat, changes) => {
  if (!changes || !(("turn" in changes) || ("round" in changes))) return;
  const combatantId = combat._forjaCombatentDeclarant;
  combat._forjaCombatentDeclarant = null;
  const actor = combatantId ? combat.combatants.get(combatantId)?.actor : null;
  if (actor) {
    await reiniciarReaccions(actor);
    await recuperarEquilibri(actor);
    await avancarRecarregaActor(actor);
  }

  // Tics d'estats parametritzats (M-05, Sagnant/Recuperació): a diferència
  // del bloc de dalt, aquí SÍ interessa el combatent ENTRANT — "cada cop
  // que li toca actuar" — i `combat.combatant` ja és fiable en aquest punt
  // perquè `this.turns`/`this.turn` ja reflecteixen el nou torn (és
  // exactament per això que no ho és per identificar el SORTINT, de dalt).
  const actorEntrant = combat.combatant?.actor;
  if (actorEntrant) await aplicarTicsEstats(actorEntrant);
});

// Restricció de moviment en temps actiu (manual p. 359-361, 483-487):
// només es pot moure el combatent que el rellotge té actiu ara mateix.
// El DJ n'és sempre exempt. Vegeu `combat/restriccio-moviment.mjs`.
Hooks.on("preUpdateToken", (tokenDocument, changes) => {
  if (game.user.isGM) return;
  const esMoviment = ("x" in changes) || ("y" in changes) || ("elevation" in changes);
  if (!esMoviment) return;
  if (!potMoureToken(tokenDocument)) {
    ui.notifications?.warn(game.i18n.format("FORJA.Combat.NoEsElTeuTorn", { nom: tokenDocument.name }));
    return false;
  }
});

/* ---- Helpers Handlebars ---- */
function _registrarHelpers() {
  Handlebars.registerHelper("add",     (a, b) => (a ?? 0) + (b ?? 0));
  Handlebars.registerHelper("lt",      (a, b) => a < b);
  Handlebars.registerHelper("eq",      (a, b) => a === b);
  Handlebars.registerHelper("concat",  (...args) => args.slice(0, -1).join(""));
  Handlebars.registerHelper("lookup",  (obj, key) => obj?.[key]);
  Handlebars.registerHelper("or",  (a, b) => !!a || !!b);
  Handlebars.registerHelper("range", (n) => Array.from({ length: n }, (_, i) => i));
  Handlebars.registerHelper("includes", (arr, val) => Array.isArray(arr) && arr.includes(val));
  Handlebars.registerHelper("lookupNom", (llista, id) => llista?.find?.(e => e.id === id)?.nom ?? id);
  Handlebars.registerHelper("dieClass", (val) => {
    if (val === 1)  return "dau-pifia";
    if (val >= 10)  return "dau-doble";
    if (val >= 6)   return "dau-fita";
    return "dau-neutre";
  });
}
