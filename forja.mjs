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
import { crearTokenDocumentForja } from "./module/documents/token.mjs";
import { crearTokenForja } from "./module/canvas/token.mjs";
import ForjaCombatTracker  from "./module/combat/tracker-ui.mjs";
import FullPersonatge      from "./module/apps/full-personatge.mjs";
import FullPNJ             from "./module/apps/full-pnj.mjs";
import FullItem            from "./module/apps/full-item.mjs";
import ForjaRoll           from "./module/dice/forja-roll.mjs";
import { registrarSocket } from "./module/xarxa/socket.mjs";
import { registrarPreguntaDefensa } from "./module/combat/decisio-defensa.mjs";
import { registrarPreguntaResistencia } from "./module/combat/decisio-resistencia.mjs";
import { assegurarAtacsAutomatics, eliminarArmaNaturalDelTret } from "./module/combat/equipament-automatic.mjs";
import { recuperarEquilibri } from "./module/combat/manifestar.mjs";
import { anunciarCanvisCombat } from "./module/combat/anuncis.mjs";
import { avancarRecarregaActor } from "./module/combat/artefactes.mjs";
import { registrarEstats } from "./module/estats/estats.mjs";
import { registrarHookValorX, aplicarTicsEstats } from "./module/estats/estats-parametritzats.mjs";
import { registrarNotificacions } from "./module/estats/notificacions.mjs";
import { sincronitzarEstatsSalut, iniciTornEstats } from "./module/estats/aplicacio-estats.mjs";
import { registrarMigracio, executarMigracions } from "./module/migracio/migracio.mjs";
import { sincronitzarVinculats, eliminarVinculats } from "./module/combat/artefactes-vinculats.mjs";
import DiategRepartirPX from "./module/apps/dialeg-repartir-px.mjs";
import { resoldreSegonCopCombinacio } from "./module/combat/atac-multi.mjs";

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

  // Moviment (WP-M): bloqueig entre tokens, pathfinding (A*) i límit de
  // moviment per torn. S'estenen les classes que Foundry fa servir per defecte.
  CONFIG.Token.documentClass = crearTokenDocumentForja(CONFIG.Token.documentClass);
  CONFIG.Token.objectClass   = crearTokenForja(CONFIG.Token.objectClass);

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

  // Fitxa d'Item (C3): una classe per als 5 tipus (Fase 2: també efectes), una plantilla cadascun
  // (templates/item/*.hbs) — reemplaça la fitxa genèrica de Foundry, que no
  // sap res dels camps `system` de FORJA.
  DocumentSheetConfig.registerSheet(Item, "forja", FullItem, {
    types:       ["tret", "arma", "armadura", "artefacte", "efecte"],
    makeDefault: true,
    label:       "FORJA.Sheet.Item"
  });

  // Estats (S-16): catàleg com a CONFIG.statusEffects (HUD del token / fitxa)
  registrarEstats();
  // Tics d'estats parametritzats (M-05): demana X en marcar Lent/Ràpid/
  // Recuperació/Sagnant des del HUD del token.
  registrarHookValorX();
  // Textos flotants al costat del token: estats guanyats i perduts, fatiga,
  // ferides i curació (Fase 1; Oriol FM, 2026-10-06). A tots els clients.
  registrarNotificacions();

  // Handlebars helpers
  _registrarHelpers();

  // Migracions de dades dels mons existents (s'executen a `ready`).
  registrarMigracio();

  console.log("FORJA RPG | Sistema inicialitzat");
});

Hooks.once("ready", () => {
  // Relé d'autoritat del DJ (A2): escriptures a documents d'altri.
  registrarSocket();
  registrarPreguntaDefensa();
  registrarPreguntaResistencia();
  // Fase 2: paràmetres als efectes i artefactes antics (només el DJ actiu).
  executarMigracions().catch(err => console.error("FORJA | Error a la migració", err));
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
  if (!actor) return;
  if (item.type === "artefacte") return sincronitzarVinculats(item);
  if (item.type !== "tret") return;
  await assegurarAtacsAutomatics(actor);
});

// Fase 3: armes i armadures que són artefactes (objectes vinculats). Només el
// client que ha fet el canvi (A1).
Hooks.on("updateItem", async (item, _changes, _options, userId) => {
  if (userId !== game.user.id || item.type !== "artefacte" || !item.parent) return;
  await sincronitzarVinculats(item);
});

// B11: en eliminar un tret d'"Armament Natural", elimina l'arma natural que
// concedia (llevat que un altre tret restant la segueixi concedint). Només
// el client que ha fet l'eliminació ho fa (mateix criteri A1 que a dalt).
Hooks.on("deleteItem", async (item, _options, userId) => {
  if (userId !== game.user.id) return;
  if (item.type === "artefacte") return eliminarVinculats(item);
  if (item.type !== "tret") return;
  await eliminarArmaNaturalDelTret(item);
});

// Reaccions i concentració (S-11): qui acaba el seu torn recupera reaccions.
// Només al DJ actiu (A1). El combatent que acaba el passa `ForjaCombat#nextTurn`
// a les opcions de l'update (es difonen a tots els clients); per a canvis de
// torn d'altres orígens, s'usa l'estat previ que Foundry desa a `combat.previous`.
// Anuncis sobre la pantalla (fase de declaració, inici del temps actiu,
// avanç del rellotge): a TOTS els clients.
Hooks.on("updateCombat", (combat, changes, options) => anunciarCanvisCombat(combat, changes, options));

// Fase de declaració: quan l'últim combatent declara, comença el temps actiu.
// Només al DJ actiu (és qui pot escriure el combat).
Hooks.on("updateCombatant", async (combatant, changes) => {
  if (!game.users.activeGM?.isSelf || !("initiative" in changes)) return;
  const combat = combatant.parent;
  if (combat?.fase === "declaracio" && combat.totsHanDeclarat) await combat.iniciarTempsActiu();
});

// Fase del torn de cada combatent (per destacar les icones del tracker):
// en acabar el torn es neteja (`estatTorn`, tracker-ui.mjs).
Hooks.on("updateCombat", async (combat, changes, options) => {
  if (!game.users.activeGM?.isSelf) return;
  const sortint = options?.forja?.combatentSortint;
  if (sortint) await combat.combatants.get(sortint)?.unsetFlag("forja", "estatTorn");
});

Hooks.on("updateCombat", async (combat, changes, options) => {
  if (!game.users.activeGM?.isSelf) return;
  const canviTorn = ("turn" in changes) || ("round" in changes);
  const sortintId = options?.forja?.combatentSortint
    ?? (canviTorn ? combat.previous?.combatantId : null);
  if (sortintId) {
    const combatant = combat.combatants.get(sortintId);
    if (combatant && typeof combat.fiDeTorn === "function") await combat.fiDeTorn(combatant);
    // Equilibri (S-20) i recàrrega d'artefactes (S-26) del combatent que acaba.
    if (combatant?.actor) {
      await recuperarEquilibri(combatant.actor);
      await avancarRecarregaActor(combatant.actor);
    }
  }

  // Tics d'estats parametritzats (M-05, Sagnant/Recuperació): aquí interessa
  // el combatent ENTRANT — "cada cop que li toca actuar". `combat.combatant`
  // ja és fiable perquè `turn` està re-apuntat al flag `actiu` (A3).
  if (canviTorn) {
    const actorEntrant = combat.combatant?.actor;
    if (actorEntrant) {
      await aplicarTicsEstats(actorEntrant);
      // Estats (Fase 1): el sagnat pot haver-lo deixat inconscient; i atordit,
      // marejat, inconscient o incapacitat li fan perdre l'acció.
      await sincronitzarEstatsSalut(actorEntrant);
      await iniciTornEstats(combat, combat.combatant);
      // Fase 6: el segon cop d'una Combinació impacta al torn següent.
      await resoldreSegonCopCombinacio(combat, combat.combatant);
    }
  }
});

// Estats per salut (Fase 1): nivell 7 de fatiga → inconscient; de ferides →
// incapacitat; i es treuen en curar-se. Només al DJ actiu (A1).
Hooks.on("updateActor", async (actor, changes) => {
  if (!game.users.activeGM?.isSelf) return;
  if (!foundry.utils.hasProperty(changes, "system.salut")) return;
  await sincronitzarEstatsSalut(actor);
});
// Tokens no enllaçats: el canvi de salut arriba com a delta del token.
Hooks.on("updateToken", async (token, changes) => {
  if (!game.users.activeGM?.isSelf) return;
  if (!foundry.utils.hasProperty(changes, "delta.system.salut")) return;
  if (token.actor) await sincronitzarEstatsSalut(token.actor);
});

// Fase 4: botó del DJ per repartir PX al directori d'actors.
Hooks.on("renderActorDirectory", (app, html) => {
  if (!game.user.isGM) return;
  const arrel = html instanceof HTMLElement ? html : html?.[0];
  if (!arrel || arrel.querySelector(".forja-repartir-px")) return;
  const boto = document.createElement("button");
  boto.type = "button";
  boto.className = "forja-repartir-px";
  boto.innerHTML = `<i class="fas fa-star"></i> ${game.i18n.localize("FORJA.Experiencia.Boto")}`;
  boto.addEventListener("click", () => new DiategRepartirPX().render(true));
  (arrel.querySelector(".header-actions") ?? arrel.querySelector(".directory-header") ?? arrel).append(boto);
});

/* ---- Helpers Handlebars ----
 * `eq`, `lt`, `or` són de Foundry i `lookup` és nadiu de Handlebars (A7):
 * no es tornen a registrar (el `or` de 2 arguments trencava plantilles del nucli). */
function _registrarHelpers() {
  Handlebars.registerHelper("add",     (a, b) => (a ?? 0) + (b ?? 0));
  Handlebars.registerHelper("concat",  (...args) => args.slice(0, -1).join(""));
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
