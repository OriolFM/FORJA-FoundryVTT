import ForjaRoll from "./forja-roll.mjs";
import DiategTirada from "./dialeg-tirada.mjs";

/**
 * Obre el diàleg de configuració i executa la tirada.
 *
 * @param {object} p
 * @param {Actor}  p.actor
 * @param {string} p.atribut      - Codi atribut (e.g. "AGI")
 * @param {number} p.atributVal   - Valor numèric de l'atribut
 * @param {string|null} p.habId   - ID habilitat (null = tirada solo d'atribut)
 * @param {number} p.habNivell    - Nivell de l'habilitat (0 si no n'hi ha)
 * @param {string} p.label        - Etiqueta per al xat ("AGI" o "AGI + Medicina")
 */
export async function ferTirada({ actor, atribut, atributVal, habId = null, habNivell = 0, label }) {
  const sys      = actor.system;
  const penal    = sys.salut?.penalitzacio ?? 0;
  const poolBase = atributVal + habNivell;

  // Obrir diàleg de configuració
  const config = await DiategTirada.obrir({
    label,
    atribut,
    atributVal,
    habId,
    habNivell,
    poolBase,
    penalSalut: penal,
    concentrat: sys.concentrat ?? false
  });

  if (!config) return null; // cancel·lat

  const poolFinal = Math.max(1, poolBase + config.modDaus + (config.concentrat ? 1 : 0));
  const difFinal  = Math.max(1, config.dificultat + penal + config.modDificultat);

  // Tirar
  const roll = new ForjaRoll(`${poolFinal}d10`, {}, {
    forja: { dificultat: difFinal }
  });
  await roll.evaluate();

  // Missatge de xat
  const content = await renderTemplate(ForjaRoll.CHAT_TEMPLATE, {
    label,
    atribut,
    habId,
    poolFinal,
    dificultat:    difFinal,
    penalSalut:    penal,
    concentrat:    config.concentrat,
    modDaus:       config.modDaus,
    modDificultat: config.modDificultat,
    ...roll.forjaResults
  });

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    rolls:   [roll],
    sound:   CONFIG.sounds.dice
  });

  return roll;
}
