/**
 * Relé d'autoritat del DJ (REVIEW-PLAN A2, contracte WP-A).
 *
 * Un jugador no és propietari dels actors dels altres (p.ex. PNJ): quan el seu
 * atac, defensa o curació ha d'escriure a l'objectiu, l'escriptura es demana al
 * DJ actiu per `game.socket` (canal `"system.forja"`, requereix
 * `"socket": true` a `system.json`). El DJ resol els documents per UUID, aplica
 * el canvi i respon; la Promise del sol·licitant es resol quan arriba la
 * resposta (que el servidor entrega DESPRÉS de difondre el canvi de document,
 * de manera que en resoldre's la còpia local ja està actualitzada).
 *
 * Contracte exportat:
 *   - actualitzarComGM(document, changes[, options])
 *   - crearEmbegutsComGM(actor, type, data[])
 *   - eliminarEmbegutsComGM(actor, type, ids[])
 *   - alternarEstatComGM(actor, statusId, active)
 * Totes actuen directament si l'usuari actual és propietari del document.
 *
 * `registrarSocket()` s'ha de cridar a `ready` (forja.mjs).
 */

const CANAL = "system.forja";

/** Temps màxim (ms) d'espera de la resposta del DJ. */
const TEMPS_ESPERA = 15000;

/** Tipus de document que el DJ accepta modificar per encàrrec. */
const TIPUS_PERMESOS = new Set(["Actor", "Item", "ActiveEffect", "Combat", "Combatant"]);

/**
 * Llista blanca de camps que el DJ accepta escriure per encàrrec d'un usuari
 * que NO és propietari del document (peticions "actualitzar", A2).
 *
 * NOMÉS s'aplica als usuaris no-GM (regla del DJ, vegeu `_atendrePeticio`): el
 * propi DJ, i qualsevol usuari que ja sigui propietari del document, actuen
 * directament sense passar pel relé i mai arriben a aquesta llista.
 *
 * Cada entrada és una ruta exacta en notació de punts (com la que produeix
 * `foundry.utils.flattenObject`) o un prefix acabat en `".*"` que permet
 * qualsevol subclau sota aquell camp (p.ex. `"flags.forja.*"` permet
 * `"flags.forja.marcador"`, `"flags.forja.actiu"`, etc.).
 *
 * Amplia AQUESTA llista quan un nou flux legítim necessiti escriure un camp
 * addicional a través del relé — no relaxis les comprovacions de context de
 * combat (`_validarContextCombat`) per compensar una llista massa curta.
 *
 * Orígens actuals de cada camp (per referència, verificar amb grep si canvia):
 *   - Actor `system.salut.{fatiga,ferides}.marcats` — dany/curació:
 *     `combat/atac.mjs`, `combat/curacio.mjs`, `documents/actor.mjs`.
 *   - Actor `system.reaccions.gastades` — `combat/reaccions.mjs`.
 *   - Actor `system.concentrat` — `combat/reaccions.mjs`.
 *   - Item `system.egida.*` — ègida que es trenca en rebre un cop:
 *     `combat/atac.mjs` (i la reactivació temporitzada, B4/Q2).
 *   - Item `flags.forja.egidaReactivaAlTick` — marca del tick de reactivació
 *     de l'ègida (B4/Q2, WP-F).
 *   - Combatant `initiative` i `flags.forja.*` — rellotge de temps:
 *     `documents/combat.mjs` (`marcarEmboscada`, `situarCombatent`, `declararAccio`).
 *   - Combat `turn`, `round`, `flags.forja.*` — `documents/combat.mjs#nextTurn`.
 *   - ActiveEffect: cap flux actual n'escriu per encàrrec a un document que no
 *     es posseeix; llista buida a propòsit (DJ/propietari únicament).
 */
const CAMPS_PERMESOS_PER_TIPUS = {
  Actor: [
    "system.salut.fatiga.marcats",
    "system.salut.ferides.marcats",
    "system.reaccions.gastades",
    "system.concentrat"
  ],
  Item: [
    "system.egida.*",
    "flags.forja.egidaReactivaAlTick"
  ],
  Combatant: [
    "initiative",
    "flags.forja.*"
  ],
  Combat: [
    "turn",
    "round",
    "flags.forja.*"
  ],
  ActiveEffect: []
};

/** Peticions en curs d'aquest client: id → {resolve, reject, timer}. */
const _pendents = new Map();

/* -------------------------------------------- */
/*  API pública                                 */
/* -------------------------------------------- */

/**
 * Actualitza un document (actor, ítem, combat…) com a DJ si cal.
 * @param {foundry.abstract.Document} document
 * @param {object} changes
 * @param {object} [options]  Opcions d'update (es reenvien, p.ex. `forja` al combat)
 * @returns {Promise<foundry.abstract.Document>}  El document (ja actualitzat)
 */
export async function actualitzarComGM(document, changes, options = {}) {
  if (document.isOwner) {
    await document.update(changes, options);
    return document;
  }
  await _demanar("actualitzar", { uuid: document.uuid, changes, options });
  return document;
}

/**
 * Crea documents embeguts (p.ex. "Item", "ActiveEffect") a un actor com a DJ si cal.
 * @param {Actor} actor
 * @param {string} type
 * @param {object[]} data
 * @returns {Promise<foundry.abstract.Document[]>}  Els documents creats (còpies locals)
 */
export async function crearEmbegutsComGM(actor, type, data) {
  if (actor.isOwner) return actor.createEmbeddedDocuments(type, data);
  const ids = await _demanar("crear", { uuid: actor.uuid, type, data });
  const col = actor.getEmbeddedCollection(type);
  return (ids ?? []).map(id => col.get(id)).filter(Boolean);
}

/**
 * Elimina documents embeguts d'un actor com a DJ si cal.
 * @param {Actor} actor
 * @param {string} type
 * @param {string[]} ids
 * @returns {Promise<string[]>}  Ids eliminats
 */
export async function eliminarEmbegutsComGM(actor, type, ids) {
  if (actor.isOwner) {
    const docs = await actor.deleteEmbeddedDocuments(type, ids);
    return docs.map(d => d.id);
  }
  return (await _demanar("eliminar", { uuid: actor.uuid, type, ids })) ?? [];
}

/**
 * Activa/desactiva un estat (CONFIG.statusEffects) d'un actor com a DJ si cal.
 * @param {Actor} actor
 * @param {string} statusId
 * @param {boolean} active
 * @returns {Promise<boolean>}  `true` si l'estat queda actiu
 */
export async function alternarEstatComGM(actor, statusId, active) {
  if (actor.isOwner) {
    await actor.toggleStatusEffect(statusId, { active });
  } else {
    await _demanar("estat", { uuid: actor.uuid, statusId, active });
  }
  return actor.statuses?.has(statusId) ?? active;
}

/** Registra l'escoltador del canal. Cridar un sol cop a `ready`. */
export function registrarSocket() {
  game.socket.on(CANAL, _rebre);
}

/* -------------------------------------------- */
/*  Sol·licitant                                */
/* -------------------------------------------- */

/**
 * Envia una petició al DJ actiu i espera la seva resposta.
 * @param {string} accio
 * @param {object} dades
 * @returns {Promise<any>}  El resultat retornat pel DJ
 */
function _demanar(accio, dades) {
  const gm = game.users.activeGM;
  if (!gm) {
    ui.notifications.error("FORJA.Socket.SenseDJ", { localize: true });
    return Promise.reject(new Error("FORJA | Cap DJ connectat per aplicar el canvi."));
  }

  const id = foundry.utils.randomID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      _pendents.delete(id);
      ui.notifications.error("FORJA.Socket.TempsEsgotat", { localize: true });
      reject(new Error(`FORJA | El DJ no ha respost a la petició "${accio}".`));
    }, TEMPS_ESPERA);
    _pendents.set(id, { resolve, reject, timer });
    game.socket.emit(CANAL, {
      tipus: "peticio", id, accio, dades,
      usuari: game.user.id,
      gm:     gm.id
    });
  });
}

/* -------------------------------------------- */
/*  Recepció                                    */
/* -------------------------------------------- */

async function _rebre(msg) {
  if (!msg || typeof msg !== "object") return;
  if (msg.tipus === "resposta") return _rebreResposta(msg);
  if (msg.tipus === "peticio")  return _atendrePeticio(msg);
}

function _rebreResposta(msg) {
  if (msg.usuari !== game.user.id) return;
  const pendent = _pendents.get(msg.id);
  if (!pendent) return;
  _pendents.delete(msg.id);
  clearTimeout(pendent.timer);
  if (msg.ok) pendent.resolve(msg.resultat);
  else {
    ui.notifications.error(game.i18n.format("FORJA.Socket.Error", { error: msg.error ?? "" }));
    pendent.reject(new Error(`FORJA | El DJ no ha pogut aplicar el canvi: ${msg.error}`));
  }
}

/* -------------------------------------------- */
/*  Autorització (DJ)                           */
/* -------------------------------------------- */

/**
 * Comprova si `clau` (una ruta de `flattenObject`, p.ex. `"flags.forja.actiu"`)
 * està coberta per algun patró de la llista blanca.
 * @param {string[]} patrons
 * @param {string} clau
 * @returns {boolean}
 */
function _campPermes(patrons, clau) {
  return patrons.some(patro => patro.endsWith(".*") ? clau.startsWith(patro.slice(0, -1)) : clau === patro);
}

/**
 * Rebutja la petició si algun camp de `pla` (canvis ja aplanats) no és a la
 * llista blanca del tipus de document. GM i propietaris no passen per aquí
 * (vegeu `_aplicar`).
 * @param {foundry.abstract.Document} doc
 * @param {Record<string, unknown>} pla
 * @param {User} user
 */
function _validarCampsPermesos(doc, pla, user) {
  const patrons = CAMPS_PERMESOS_PER_TIPUS[doc.documentName] ?? [];
  const rebutjats = Object.keys(pla).filter(clau => !_campPermes(patrons, clau));
  if (rebutjats.length) {
    console.warn(`FORJA | Socket: petició rebutjada de ${user.name} — camps no permesos a ${doc.documentName} (${doc.uuid})`, rebutjats);
    throw new Error(`camps no permesos: ${rebutjats.join(", ")}`);
  }
}

/**
 * Regla de context de combat (A2, "no permetre res que un jugador no pugui
 * justificar des de la interfície"): els camps d'Actor/Item de la llista
 * blanca només representen mecàniques de combat (dany, reaccions,
 * concentració, ègida). Per a un usuari no-GM que no posseeix el document:
 *   - si hi ha un combat en marxa (`game.combats.active.started`), s'accepta
 *     qualsevol camp de la llista blanca (és l'ús normal en combat);
 *   - si NO hi ha combat en marxa, només s'accepta que una pista de salut
 *     BAIXI (curació — primers auxilis, tractament mèdic i repòs es fan
 *     sovint fora de combat, `apps/full-personatge.mjs`/`full-pnj.mjs`); calen
 *     valors de baixada o iguals, mai de pujada.
 * Regla deliberadament simple: no intenta comprovar qui és "l'atacant" ni si
 * l'objectiu és al combat — només si hi ha combat actiu o si l'escriptura és
 * inequívocament una curació.
 * @param {foundry.abstract.Document} doc
 * @param {Record<string, unknown>} pla
 * @param {User} user
 */
function _validarContextCombat(doc, pla, user) {
  if (!["Actor", "Item"].includes(doc.documentName)) return;
  if (game.combats?.active?.started) return;

  const rebutjats = Object.entries(pla).filter(([clau, valor]) => {
    if (clau !== "system.salut.fatiga.marcats" && clau !== "system.salut.ferides.marcats") return true;
    const actual = Number(foundry.utils.getProperty(doc, clau));
    return !(Number(valor) <= actual);
  }).map(([clau]) => clau);

  if (rebutjats.length) {
    console.warn(`FORJA | Socket: petició rebutjada de ${user.name} — canvis de combat sense combat actiu a ${doc.documentName} (${doc.uuid})`, rebutjats);
    throw new Error(`aquest canvi només es permet dins d'un combat actiu: ${rebutjats.join(", ")}`);
  }
}

/**
 * Executada al DJ destinatari: resol el document per UUID i aplica el canvi.
 * El canal no és autenticat pel servidor: es valida que l'usuari existeixi, que
 * el tipus de document sigui un dels previstos i, per al combat, que qui ho
 * demana sigui propietari del combatent en torn. Els usuaris GM salten totes
 * les comprovacions d'autorització d'aquesta funció (es confia en el propi
 * client GM).
 */
async function _atendrePeticio(msg) {
  if (!game.user.isGM || msg.gm !== game.user.id) return;
  const resposta = { tipus: "resposta", id: msg.id, usuari: msg.usuari };
  try {
    resposta.resultat = await _aplicar(msg);
    resposta.ok = true;
  } catch (err) {
    console.error("FORJA | Error aplicant una petició del socket", msg, err);
    resposta.ok = false;
    resposta.error = err?.message ?? String(err);
  }
  game.socket.emit(CANAL, resposta);
}

async function _aplicar({ accio, dades, usuari }) {
  const user = game.users.get(usuari);
  if (!user) throw new Error(`usuari desconegut (${usuari})`);

  const doc = await fromUuid(dades.uuid);
  if (!doc) throw new Error(`document no trobat (${dades.uuid})`);
  if (!TIPUS_PERMESOS.has(doc.documentName)) throw new Error(`tipus no permès (${doc.documentName})`);

  switch (accio) {
    case "actualitzar": {
      if (!user.isGM) {
        if (doc.documentName === "Combat" && !doc.combatant?.testUserPermission(user, "OWNER")) {
          throw new Error("només el propietari del combatent en torn pot avançar el combat");
        }
        if (doc.documentName === "Combatant" && !doc.testUserPermission(user, "OWNER")) {
          throw new Error(`no es pot reposicionar un combatent que l'usuari no posseeix (${doc.uuid})`);
        }
        const pla = foundry.utils.flattenObject(dades.changes ?? {});
        _validarCampsPermesos(doc, pla, user);
        _validarContextCombat(doc, pla, user);
      }
      await doc.update(dades.changes, dades.options ?? {});
      return true;
    }
    case "crear": {
      if (!user.isGM && !doc.testUserPermission(user, "OWNER")) {
        console.warn(`FORJA | Socket: petició rebutjada de ${user.name} — crear documents encastats a un actor que no posseeix (${doc.uuid})`);
        throw new Error(`cap flux permet crear documents encastats en un actor que l'usuari no posseeix (${doc.uuid})`);
      }
      const creats = await doc.createEmbeddedDocuments(dades.type, dades.data);
      return creats.map(d => d.id);
    }
    case "eliminar": {
      if (!user.isGM && !doc.testUserPermission(user, "OWNER")) {
        console.warn(`FORJA | Socket: petició rebutjada de ${user.name} — eliminar documents encastats d'un actor que no posseeix (${doc.uuid})`);
        throw new Error(`cap flux permet eliminar documents encastats d'un actor que l'usuari no posseeix (${doc.uuid})`);
      }
      const eliminats = await doc.deleteEmbeddedDocuments(dades.type, dades.ids);
      return eliminats.map(d => d.id);
    }
    case "estat": {
      if (!user.isGM && !CONFIG.statusEffects?.some(e => e.id === dades.statusId)) {
        console.warn(`FORJA | Socket: petició rebutjada de ${user.name} — estat no reconegut (${dades.statusId})`);
        throw new Error(`estat no permès (${dades.statusId})`);
      }
      await doc.toggleStatusEffect(dades.statusId, { active: dades.active });
      return true;
    }
    default:
      throw new Error(`acció desconeguda (${accio})`);
  }
}
