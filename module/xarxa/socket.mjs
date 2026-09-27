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

/**
 * Executada al DJ destinatari: resol el document per UUID i aplica el canvi.
 * El canal no és autenticat pel servidor: es valida que l'usuari existeixi, que
 * el tipus de document sigui un dels previstos i, per al combat, que qui ho
 * demana sigui propietari del combatent en torn.
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
      if (doc.documentName === "Combat" && !user.isGM && !doc.combatant?.testUserPermission(user, "OWNER")) {
        throw new Error("només el propietari del combatent en torn pot avançar el combat");
      }
      await doc.update(dades.changes, dades.options ?? {});
      return true;
    }
    case "crear": {
      const creats = await doc.createEmbeddedDocuments(dades.type, dades.data);
      return creats.map(d => d.id);
    }
    case "eliminar": {
      const eliminats = await doc.deleteEmbeddedDocuments(dades.type, dades.ids);
      return eliminats.map(d => d.id);
    }
    case "estat": {
      await doc.toggleStatusEffect(dades.statusId, { active: dades.active });
      return true;
    }
    default:
      throw new Error(`acció desconeguda (${accio})`);
  }
}
