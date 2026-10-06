import ForjaRoll from "./forja-roll.mjs";
import DiategTirada from "./dialeg-tirada.mjs";
import { consumirConcentracio } from "../combat/reaccions.mjs";
import { aptitudsDelsTrets } from "./fites.mjs";

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
 *
 * Salut (B1; manual FC001CA › SISTEMES › Salut › Fatiga i ferides): la
 * penalització de salut s'afegeix a la dificultat; al nivell 7
 * (inconscient/incapacitat) el personatge no pot actuar i la tirada es bloqueja.
 * Concentració (B5; › Gestió del temps de joc › Concentració): si l'actor
 * s'havia concentrat en declarar, la tirada rep +1 dau i la concentració es
 * consumeix. El diàleg ja no ofereix el +1 dau lliure; només en mostra l'estat.
 * Adepte/inepte (manual › Trets, l. 1332 i 1597; per àmbits, Oriol FM
 * 2026-10-06): si l'actor en té, el diàleg deixa marcar que la tirada és de
 * l'àmbit (ho decideix el jugador o el DJ); adepte repeteix els 1 (`r1`),
 * inepte fa que els 10 no comptin doble i que cada 1 resti una fita.
 */
export async function ferTirada({ actor, atribut, atributVal, habId = null, habNivell = 0, label }) {
  const sys      = actor.system;
  if (sys.salut?.foraDeCombat) {
    ui.notifications?.warn(game.i18n.format("FORJA.Combat.ForaDeCombat", { nom: actor.name }));
    return null;
  }
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
    concentrat: sys.concentrat ?? false,
    aptituds:   aptitudsDelsTrets(actor.items)
  });

  if (!config) return null; // cancel·lat

  // La concentració es llegeix de nou (pot haver-se trencat mentre el diàleg era obert).
  const dauConcentracio = await consumirConcentracio(actor);
  const poolFinal = Math.max(1, poolBase + config.modDaus + dauConcentracio);
  const difFinal  = Math.max(1, config.dificultat + penal + config.modDificultat);

  // Tirar (adepte: repeteix un cop els 1; inepte: es compta a ForjaRoll)
  const aptitud = config.aptitud;
  const roll = new ForjaRoll(`${poolFinal}d10${aptitud?.tipus === "adepte" ? "r1" : ""}`, {}, {
    forja: { dificultat: difFinal, inepte: aptitud?.tipus === "inepte" }
  });
  await roll.evaluate();

  // Missatge de xat
  const content = await foundry.applications.handlebars.renderTemplate(ForjaRoll.CHAT_TEMPLATE, {
    label,
    atribut,
    habId,
    poolFinal,
    dificultat:    difFinal,
    penalSalut:    penal,
    concentrat:    dauConcentracio > 0,
    modDaus:       config.modDaus,
    modDificultat: config.modDificultat,
    aptitud:       aptitud ? game.i18n.format(`FORJA.Aptitud.${aptitud.tipus === "adepte" ? "Adepte" : "Inepte"}`,
      { ambit: game.i18n.localize(`FORJA.Aptitud.Ambit.${aptitud.ambit}`) }) : "",
    inepteSenseNivell: aptitud?.tipus === "inepte" && !!habId && !habNivell,
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
