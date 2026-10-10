import {
  distanciesMoviment, permisMoviment, comprovarPermis, movimentDelTorn
} from "../combat/moviment.mjs";
import { posicioOcupada } from "../canvas/token.mjs";
import { restriccionsEstats } from "../estats/regles-estats.mjs";
import { avisarBloqueigEstat } from "../estats/notificacions.mjs";

/**
 * Metres que el token ha recorregut en el torn actual: la mesura del seu
 * historial de moviment, que Foundry buida a l'inici de cada torn del
 * combatent (v13 `client/documents/combat.mjs`, `#onStartTurn` →
 * `_clearMovementHistoryOnStartTurn` → `TokenDocument#clearMovementHistory`)
 * i només enregistra si el token és combatent d'un combat començat
 * (`TokenDocument#_shouldRecordMovementHistory`). Els salts de
 * teletransport ("displace") no compten (`measure: false`).
 * @param {TokenDocument|null} token
 * @returns {number}
 */
export function metresMogutsAquestTorn(token) {
  const historial = token?.movementHistory ?? [];
  if (historial.length < 2) return 0;
  try {
    return token.measureMovementPath(historial).distance ?? 0;
  } catch (err) {
    console.error("FORJA | No s'ha pogut mesurar el moviment del token", err);
    return 0;
  }
}

/**
 * Combatent d'un token. `TokenDocument#combatant` només el busca al combat que
 * mostra el tracker d'aquest client (`game.combat`); si no hi és, es busca als
 * altres combats de l'escena del token, primer els que estan en marxa. Sense
 * això, el límit de moviment i l'historial del torn no s'aplicaven si el
 * tracker mostrava un altre combat (combats paral·lels; proves 2026-10-10).
 * No se sobreescriu el getter natiu: Foundry suposa que, si n'hi ha, existeix `game.combat`.
 * @param {TokenDocument} doc
 * @returns {Combatant|null}
 */
export function combatantDelToken(doc) {
  const natiu = doc.combatant;
  if (natiu) return natiu;
  const escena = doc.parent?.id;
  let trobat = null;
  for (const combat of game.combats ?? []) {
    const c = combat.combatants.find(x => x.tokenId === doc.id && (!x.sceneId || x.sceneId === escena));
    if (!c) continue;
    if (combat.started || combat.getFlag("forja", "fase") === "declaracio") return c;
    trobat ??= c;
  }
  return trobat;
}

/**
 * Combatent actiu d'un combat de FORJA: el flag `actiu` és la font de
 * veritat (vegeu `ForjaCombat#combatentActiuId`); si no n'hi ha, el natiu.
 * @param {Combat} combat
 * @returns {string|null}
 */
function _idCombatentActiu(combat) {
  return combat?.combatentActiuId ?? combat?.combatant?.id ?? null;
}

/**
 * Motiu pel qual un jugador no pot fer aquest moviment, o `null` si pot.
 * Només en un combat començat (o en fase de declaració, on ningú no es mou) i
 * per a tokens que en són combatents; fora de
 * combat (o per a un token que no hi participa) no hi ha restriccions.
 *
 * - Només es pot moure qui té el torn ara (manual l. 2742–2772: els que són
 *   a la casella del marcador "actuen simultàniament i resolen les accions
 *   declarades"). Una reacció fora de torn no obre cap finestra de moviment.
 * - Permís ACUMULATIU per al torn (Oriol FM, 2026-09-27): el que ja s'ha
 *   mogut (historial) + el tram nou no pot superar la distància del moviment
 *   declarat (caminar per defecte; córrer amb moviment ràpid o càrrega).
 * - Cap token pot acabar el moviment damunt d'un altre (Oriol FM).
 * - Els salts de teletransport ("blink") no es permeten en combat: saltarien
 *   parets i tokens.
 *
 * @param {TokenDocument} doc
 * @param {object} move   `TokenMovementOperation` (v13 `documents/token.mjs`, `#preUpdateMovement`)
 * @returns {string|null} Missatge (ja traduït) o null
 */
export function motiuBloqueigMoviment(doc, move) {
  const combatant = combatantDelToken(doc);
  const combat = combatant?.parent;
  // Fase de declaració: ningú no es mou fins que comença el temps actiu; el
  // moviment va amb l'acció declarada (Oriol FM, 2026-10-10). El DJ, sí.
  if (combat?.getFlag("forja", "fase") === "declaracio") {
    return game.i18n.format("FORJA.Moviment.FaseDeclaracio", { nom: doc.name });
  }
  if (!combat?.started) return null;

  if (_idCombatentActiu(combat) !== combatant.id) {
    return game.i18n.format("FORJA.Moviment.NoEsElTeuTorn", { nom: doc.name });
  }

  const tots = [...(move.passed?.waypoints ?? []), ...(move.pending?.waypoints ?? [])];
  if (tots.some(w => CONFIG.Token.movement.actions[w.action]?.teleport && w.action !== "displace")) {
    return game.i18n.localize("FORJA.Moviment.SenseTeletransport");
  }

  const sys = doc.actor?.system;
  const distancies = sys?.moviment ?? distanciesMoviment(sys?.atributs?.AGI ?? 0, sys?.mida ?? 3);
  let tipus = movimentDelTorn(combatant.getFlag("forja", "accioPendent"), combat.id, combat.marcador);
  // Abatut (l. 3554): no pot córrer, encara que hagués declarat córrer.
  if (!restriccionsEstats(doc.actor?.statuses ?? []).potCorrer && (tipus === "rapid" || tipus === "carrega")) tipus = "basic";
  const permis = permisMoviment(tipus, distancies);
  const nou = (move.passed?.distance ?? 0) + (move.pending?.distance ?? 0);
  const r = comprovarPermis({ jaMogut: move.history?.distance ?? 0, nou, permis });
  if (!r.permes) {
    return game.i18n.format("FORJA.Moviment.PermisExhaurit", {
      nom: doc.name,
      restant: Math.round(r.restant * 10) / 10,
      permis
    });
  }

  const final = move.pending?.waypoints?.at(-1) ?? move.destination;
  if (final && posicioOcupada(doc, final)) {
    return game.i18n.localize("FORJA.Moviment.EspaiOcupat");
  }
  return null;
}

/**
 * Crea la classe de TokenDocument de FORJA a partir de la que fa servir
 * Foundry (`CONFIG.Token.documentClass`).
 *
 * `_preUpdateMovement(movement, operation)` (v13 `client/documents/token.mjs`,
 * l. ~1433; v14 l. ~1989) s'executa al client que inicia el moviment, dins
 * `TokenDocument#_preUpdate`, abans del hook `preMoveToken`; tornar `false`
 * cancel·la el moviment (el nucli treu x/y/elevació dels canvis). El DJ pot
 * moure sempre qualsevol token; desfer un moviment ("undo") sempre es permet.
 *
 * @param {typeof foundry.documents.TokenDocument} Base
 * @returns {typeof foundry.documents.TokenDocument}
 */
export function crearTokenDocumentForja(Base) {
  return class TokenDocumentForja extends Base {
    /**
     * @override — l'historial de moviment del torn també es desa si el
     * combat no és el que mostra el tracker d'aquest client (`combatantDelToken`).
     */
    _shouldRecordMovementHistory() {
      return !!combatantDelToken(this)?.parent?.started;
    }

    /** @override */
    async _preUpdateMovement(movement, operation) {
      const permes = await super._preUpdateMovement(movement, operation);
      if (permes === false) return false;
      if (game.user.isGM || movement.method === "undo") return permes;
      // Estats (Fase 1): atrapat, immobilitzat, inconscient, incapacitat i
      // marejat no es mouen, en combat o fora (el DJ sí que els pot moure).
      // L'estat torna a sortir al costat del token (Oriol FM, 2026-10-06).
      const estats = restriccionsEstats(this.actor?.statuses ?? []);
      if (!estats.potMoure) {
        avisarBloqueigEstat(this.actor, estats.motiuMoure, "FORJA.Estats.Accio.Moure");
        return false;
      }
      const motiu = motiuBloqueigMoviment(this, movement);
      if (motiu) {
        ui.notifications?.warn(motiu);
        return false;
      }
      return permes;
    }
  };
}
