import ForjaRoll from "../dice/forja-roll.mjs";
import { actualitzarComGM, alternarEstatComGM } from "../xarxa/socket.mjs";
import {
  restriccionsEstats, estatsPerSalut, poolTiradaEstat, TIRADES_ESTAT
} from "./regles-estats.mjs";
import { avisarBloqueigEstat, textFlotant, COLORS } from "./notificacions.mjs";

/**
 * Part de Foundry de les regles dels estats (Fase 1, `docs/PLA-MANUAL-COMPLET.md`).
 * Les regles són a `regles-estats.mjs` (funcions pures).
 *
 * - `restriccionsActor`: què pot fer l'actor amb els estats que té.
 * - `sincronitzarEstatsSalut` (DJ): inconscient/incapacitat segons la salut.
 * - `iniciTornEstats` (DJ): atordit, marejat, inconscient i incapacitat fan
 *   perdre l'acció quan arriba el torn.
 * - `tirarEstat`: tirades per sortir d'un estat o actuar malgrat l'estat.
 */

/**
 * @param {Actor} actor
 * @returns {ReturnType<typeof restriccionsEstats>}
 */
export function restriccionsActor(actor) {
  return restriccionsEstats(actor?.statuses ?? []);
}

/** L'estat existeix al catàleg registrat (`CONFIG.statusEffects`). */
function existeixEstat(estatId) {
  return !!CONFIG.statusEffects?.some(e => e.id === estatId);
}

/** Nom traduït d'un estat. */
function nomEstat(estatId) {
  return game.i18n.localize(`FORJA.Estat.${estatId}`);
}

/**
 * Posa o treu inconscient (fatiga al nivell 7) i incapacitat (ferides al
 * nivell 7) segons la salut (manual › Fatiga i ferides, l. 3426). Només el DJ
 * actiu (hook `updateActor`, `forja.mjs`).
 * @param {Actor} actor
 */
export async function sincronitzarEstatsSalut(actor) {
  const salut = actor?.system?.salut;
  if (!salut) return;
  const volgut = estatsPerSalut(salut.fatiga?.nivellActiu ?? 1, salut.ferides?.nivellActiu ?? 1);
  for (const [estatId, actiu] of Object.entries(volgut)) {
    if (!existeixEstat(estatId)) continue;
    if (!!actor.statuses?.has(estatId) === actiu) continue;
    await actor.toggleStatusEffect(estatId, { active: actiu });
  }
}

/**
 * Quan arriba el torn d'un combatent (DJ actiu, hook `updateCombat`):
 * - Atordit (l. 3564): perd l'acció declarada, ha de tornar a declarar ara
 *   (amb la latència habitual) i l'estat s'acaba.
 * - Marejat (l. 3640): perd l'acció. Per declarar-ne una altra ha de superar
 *   la tirada (vegeu `ForjaCombatTracker`).
 * - Inconscient/incapacitat: no pot actuar. Perd l'acció i passa el torn
 *   (es torna a situar al rellotge amb la seva latència bàsica, perquè el
 *   rellotge continuï i torni a tenir torn quan es recuperi).
 * @param {Combat} combat
 * @param {Combatant} combatant
 */
export async function iniciTornEstats(combat, combatant) {
  const actor = combatant?.actor;
  if (!actor || !combat?.started) return;
  if (combatant.initiative !== combat.marcador) return;
  const r = restriccionsActor(actor);
  const speaker = ChatMessage.getSpeaker({ actor });

  if (!r.potActuar && r.motiuActuar !== "marejat") {
    await combatant.unsetFlag("forja", "accioPendent");
    await combat.declararAccio(combatant.id, Math.max(1, actor.system.latenciaBase ?? 1));
    await combatant.setFlag("forja", "estatTorn", "redeclarada");
    await ChatMessage.create({
      speaker,
      content: game.i18n.format("FORJA.Estats.PerdTornNoActua", { nom: actor.name, estat: nomEstat(r.motiuActuar) })
    });
    return;
  }

  if (r.motiuActuar === "marejat" || r.perdAccio) {
    const estatId = r.motiuActuar === "marejat" ? "marejat" : "atordit";
    // L'atordiment dura fins a la següent acció: s'acaba ara, tant si tenia
    // una acció declarada (que perd) com si no.
    if (r.perdAccio) await actor.toggleStatusEffect("atordit", { active: false });
    if (!combatant.getFlag("forja", "accioPendent")) return;
    await combatant.unsetFlag("forja", "accioPendent");
    await combatant.unsetFlag("forja", "estatTorn");
    await ChatMessage.create({
      speaker,
      content: game.i18n.format(estatId === "atordit" ? "FORJA.Estats.PerdAccioAtordit" : "FORJA.Estats.PerdAccioMarejat", { nom: actor.name })
    });
  }
}

/**
 * Comprova que l'actor pot fer una cosa; si no, mostra l'estat que ho
 * impedeix (text flotant i avís) i retorna `false`.
 * @param {Actor} actor
 * @param {string|null} motiu  Estat que ho impedeix (de `restriccionsActor`).
 * @param {string} clauAccio   Clau i18n de l'acció.
 * @returns {boolean}
 */
export function comprovarEstat(actor, motiu, clauAccio) {
  if (!motiu) return true;
  avisarBloqueigEstat(actor, motiu, clauAccio);
  return false;
}

/**
 * Demana la dificultat d'una tirada d'estat (la posa el DJ o l'oponent).
 * @returns {Promise<number|null>}
 */
async function demanarDificultat(actor, estatId, pool) {
  const valor = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.format("FORJA.Estats.TiradaTitol", { nom: actor.name, estat: nomEstat(estatId) }) },
    content: `<p>${game.i18n.localize(`FORJA.Estats.TiradaDesc.${estatId}`)}</p>
      <p>${game.i18n.format("FORJA.Estats.TiradaPool", { pool })}</p>
      <div class="form-group"><label>${game.i18n.localize("FORJA.Dice.Dificultat")}</label>
      <input type="number" name="dificultat" value="1" min="1" step="1" autofocus></div>`,
    ok: {
      label: game.i18n.localize("FORJA.Estats.Tirar"),
      callback: (ev, button) => Math.max(1, parseInt(button.form.elements.dificultat.value) || 1)
    },
    rejectClose: false
  });
  return valor ?? null;
}

/**
 * Tirada d'estat (regles a `TIRADES_ESTAT`): escapar-se d'atrapat, superar
 * acovardit, mantenir-se dempeus en ser empès, resistir una malaltia o
 * toxina, actuar marejat o forçar una extremitat esguerrada.
 * - Atrapat: cal SUPERAR la tirada de qui atrapa (l. 3570).
 * - Èxit amb `treu`: s'acaba l'estat. Empès espifiat: queda abatut.
 * - Esguerrat: +1 fatiga per intent (l. 3662).
 * La penalització de salut s'aplica a la dificultat, com a qualsevol tirada.
 * @param {Actor} actor
 * @param {string} estatId
 * @param {object} [opcions]
 * @param {number} [opcions.dificultat]  Si no es dona, es demana.
 * @returns {Promise<{exit:boolean, roll:ForjaRoll}|null>}
 */
export async function tirarEstat(actor, estatId, { dificultat } = {}) {
  const def = TIRADES_ESTAT[estatId];
  const pool = poolTiradaEstat(estatId, actor?.system ?? {});
  if (!def || !pool) return null;

  dificultat ??= await demanarDificultat(actor, estatId, pool.pool);
  if (dificultat == null) return null;

  const penal = actor.system.salut?.penalitzacio ?? 0;
  const difFinal = Math.max(1, dificultat + penal);
  const exigirSuperar = estatId === "atrapat";
  const roll = new ForjaRoll(`${Math.max(1, pool.pool)}d10`, {}, { forja: { dificultat: difFinal } });
  await roll.evaluate();
  const { fites, pifia } = roll.forjaResults;
  const exit = !pifia && (exigirSuperar ? fites > difFinal : fites >= difFinal);

  const label = `${game.i18n.format("FORJA.Estats.TiradaTitol", { nom: actor.name, estat: nomEstat(estatId) })} — ${pool.atribut} + ${game.i18n.localize(`FORJA.Hab.${pool.habilitat}`)}`;
  const content = await foundry.applications.handlebars.renderTemplate(ForjaRoll.CHAT_TEMPLATE, {
    label, atribut: pool.atribut, habId: pool.habilitat, poolFinal: pool.pool,
    dificultat: difFinal, penalSalut: penal, concentrat: false, modDaus: 0, modDificultat: 0,
    ...roll.forjaResults, exit
  });
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content, rolls: [roll], sound: CONFIG.sounds.dice });

  if (exit && def.treu && actor.statuses?.has(estatId)) await alternarEstatComGM(actor, estatId, false);
  if (!exit && def.siFalla && existeixEstat(def.siFalla)) await alternarEstatComGM(actor, def.siFalla, true);
  if (def.fatigaPerIntent) {
    await actualitzarComGM(actor, {
      "system.salut.fatiga.marcats": (actor.system.salut?.fatiga?.marcats ?? 0) + def.fatigaPerIntent
    });
  }
  textFlotant(actor, exit ? `✔ ${nomEstat(estatId)}` : `✘ ${nomEstat(estatId)}`, {
    color: exit ? COLORS.cura : COLORS.bloqueig, mida: 28
  });
  return { exit, roll };
}

/**
 * Estats actius de l'actor per a la fitxa: nom (amb la X dels
 * parametritzats), si té tirada i l'id de l'ActiveEffect (per treure'l).
 * @param {Actor} actor
 * @returns {Array<{id:string, nom:string, efecteId:string, teTirada:boolean}>}
 */
export function estatsPerFitxa(actor) {
  const llista = [];
  for (const efecte of actor?.effects ?? []) {
    for (const estatId of efecte.statuses ?? []) {
      const x = efecte.getFlag?.("forja", "valorX");
      const nom = nomEstat(estatId);
      llista.push({
        id: estatId,
        nom: x != null ? `${nom.replace(/\/X$/, "")}/${x}` : nom,
        efecteId: efecte.id,
        teTirada: !!TIRADES_ESTAT[estatId]
      });
    }
  }
  return llista.sort((a, b) => a.nom.localeCompare(b.nom));
}
