import ForjaRoll from "../dice/forja-roll.mjs";
import { aplicarDanyAPista } from "./dany.mjs";
import { consumirConcentracio } from "./reaccions.mjs";
import { actualitzarComGM, alternarEstatComGM } from "../xarxa/socket.mjs";

/**
 * Curació i recuperació (S-17, manual p. 1049-1178).
 *
 * Abast d'aquesta implementació (A1, "automatitza el càlcul, mai la
 * decisió"): es resolen les dues accions actives de tractament —
 * **Primers auxilis** (dificultat 1) i **Tractament mèdic** (dificultat 2) —
 * amb una tirada INT + habilitat que guareix `excedent` punts a la pista
 * triada i neteja els estats associats en cas d'èxit. També s'ofereix
 * **Repòs** com a aplicació manual (activada pel DJ/jugador quan decideix
 * que ha passat prou temps narratiu) de la recuperació natural per període
 * (CON per fatiga / mida per ferides), sense simular el pas del temps.
 *
 * Deliberadament NO s'automatitza (queda manual/DJ, com el rang variable de
 * S-12): la variant de mecanoides amb enginyeria/nyaps que exigeix declarar
 * per endavant els punts a reparar i escala la dificultat en conseqüència
 * (manual p. 1178), ni l'efecte que "nyaps" trenca l'autoreparació de
 * ferides fins a una revisió amb enginyeria — són matisos narratius que
 * necessiten judici del DJ, no un càlcul mecànic net.
 */

const ESTATS_PRIMERS_AUXILIS  = ["atordit", "marejat", "sagnant"];

/**
 * Nivell mínim de l'habilitat de curació per a cada tractament (B17).
 * Manual FC001CA › SISTEMES › Salut › Primers auxilis: "pot ser atès per
 * qualsevol PJ amb l'habilitat de medicina 1 o superior (enginyeria o nyaps,
 * en el cas dels mecanoides)"; › Tractament mèdic: "Per tractar algú cal un
 * mínim de 2 en l'habilitat de medicina (enginyeria o nyaps en el cas de
 * mecanoides)".
 */
export const NIVELL_MINIM_CURACIO = Object.freeze({
  "primers-auxilis":  1,
  "tractament-medic": 2
});

/**
 * Comprova si una acció de curació es pot fer (B17, funció pura).
 *
 *  - Habilitat: `nivell` ≥ `NIVELL_MINIM_CURACIO[tipus]` (la de
 *    `habilitatCuracio`: medicina, o la millor d'enginyeria/nyaps si
 *    l'objectiu és mecanoide).
 *  - Autotractament (› Primers auxilis): "En casos extrems, i si el DJ ho
 *    aprova, un PJ pot provar de fer-se primers auxilis a si mateix."
 *    Decisió d'implementació: l'aprovació del DJ = que sigui el DJ qui
 *    llança l'acció (`esGM`); un jugador rep un avís i l'acció es bloca. El
 *    manual només ho preveu per als primers auxilis ("Per tractar algú" al
 *    tractament mèdic): tractar-se a si mateix amb tractament mèdic queda
 *    també reservat al DJ, com a excepció seva.
 *
 * @param {object} p
 * @param {"primers-auxilis"|"tractament-medic"} p.tipus
 * @param {number}  p.nivell          Nivell de l'habilitat de curació del guaridor
 * @param {boolean} p.autotractament  Guaridor i objectiu són el mateix actor
 * @param {boolean} p.esGM            L'usuari que fa l'acció és el DJ
 * @returns {{permes:boolean, motiu:null|"habilitat"|"autotractament", minim:number}}
 */
export function comprovarRequisitsCuracio({ tipus, nivell, autotractament, esGM }) {
  const minim = NIVELL_MINIM_CURACIO[tipus] ?? 1;
  if ((nivell ?? 0) < minim) return { permes: false, motiu: "habilitat", minim };
  if (autotractament && !esGM) return { permes: false, motiu: "autotractament", minim };
  return { permes: true, motiu: null, minim };
}
const ESTATS_TRACTAMENT_MEDIC = ["inconscient", "incapacitat"];

/**
 * Determina si l'objectiu pot recuperar-se per si sol descansant (manual
 * p. 1049-1178): la fatiga només queda bloquejada al nivell 7 (inconscient),
 * mentre que les ferides queden bloquejades ja des del nivell 5 (malferit) —
 * llindars diferents per a cada pista.
 * @param {ForjaActor} objectiu
 * @param {"fatiga"|"ferides"} pista
 * @returns {boolean}
 */
export function potReferSePerSiSol(objectiu, pista) {
  const nivell = objectiu.system.salut[pista]?.nivellActiu ?? 1;
  return pista === "fatiga" ? nivell < 7 : nivell < 5;
}

/**
 * Escull la millor habilitat de curació disponible del guaridor, segons
 * l'espècie de l'objectiu (manual p. 1049-1178): medicina per a espècies
 * orgàniques, enginyeria o nyaps (la millor de les dues) per a mecanoides.
 * @param {ForjaActor} guaridor
 * @param {string} especieObjectiu
 * @returns {{id:string, nivell:number}}
 */
export function habilitatCuracio(guaridor, especieObjectiu) {
  const nivell = (id) => guaridor.system.habilitats?.[id]?.nivell ?? 0;
  if (especieObjectiu === "mecanoide") {
    return ["enginyeria", "nyaps"]
      .map(id => ({ id, nivell: nivell(id) }))
      .sort((a, b) => b.nivell - a.nivell)[0];
  }
  return { id: "medicina", nivell: nivell("medicina") };
}

/**
 * Aplica la recuperació natural d'un període de repòs (manual, taules
 * "Refer-se"): el DJ decideix QUAN s'ha complert el temps de la taula (no
 * simulat aquí); aquesta funció només aplica el càlcul un cop pertoca.
 * @param {ForjaActor} objectiu
 * @param {"fatiga"|"ferides"} pista
 * @returns {Promise<number>} Punts efectivament recuperats (0 si bloquejat)
 */
export async function aplicarReposNatural(objectiu, pista) {
  if (!potReferSePerSiSol(objectiu, pista)) return 0;

  const ritme = pista === "fatiga" ? (objectiu.system.constitucio ?? 0) : (objectiu.system.mida ?? 0);
  if (ritme <= 0) return 0;

  const abans = objectiu.system.salut[pista].marcats;
  const salut = { [pista]: { marcats: abans } };
  const nous  = aplicarDanyAPista(salut, pista, -ritme);
  await actualitzarComGM(objectiu, { [`system.salut.${pista}.marcats`]: nous });
  return abans - nous;
}

/**
 * Resol una acció de curació activa: primers auxilis (dificultat 1) o
 * tractament mèdic (dificultat 2). Tira INT + habilitat de curació; si
 * supera la dificultat, l'excedent es guareix immediatament a la pista
 * triada i es netegen els estats que aquell tractament resol.
 *
 * @param {object} p
 * @param {ForjaActor} p.guaridor
 * @param {ForjaActor} p.objectiu
 * @param {"primers-auxilis"|"tractament-medic"} p.tipus
 * @param {"fatiga"|"ferides"} p.pista
 * @returns {Promise<{roll:ForjaRoll, exit:boolean, excedent:number, hab:{id:string,nivell:number}}|null>}
 *   `null` si el guaridor està fora de combat (nivell 7 de salut) o no compleix
 *   els requisits (B17).
 *
 * B1 (FC001CA › Salut › Fatiga i ferides): la penalització de salut del
 * GUARIDOR s'afegeix a la dificultat, i al nivell 7 no pot actuar. B5: si
 * s'havia concentrat, +1 dau (i es consumeix). B17: sense el nivell mínim
 * d'habilitat, o si un jugador es vol tractar a si mateix sense el DJ, avisa
 * i retorna `null` (vegeu `comprovarRequisitsCuracio`).
 */
export async function ferCuracio({ guaridor, objectiu, tipus, pista }) {
  if (guaridor.system.salut?.foraDeCombat) {
    ui.notifications?.warn(game.i18n.format("FORJA.Combat.ForaDeCombat", { nom: guaridor.name }));
    return null;
  }
  const hab = habilitatCuracio(guaridor, objectiu.system.especie);
  const requisits = comprovarRequisitsCuracio({
    tipus,
    nivell: hab.nivell,
    autotractament: _mateixActor(guaridor, objectiu),
    esGM: !!game.user?.isGM
  });
  if (!requisits.permes) {
    const habNom = game.i18n.localize(CONFIG.FORJA.LLISTA_HABILITATS.find(h => h.id === hab.id)?.nom ?? hab.id);
    const tipusNom = game.i18n.localize(tipus === "tractament-medic" ? "FORJA.Curacio.TractamentMedic" : "FORJA.Curacio.PrimersAuxilis");
    ui.notifications?.warn(requisits.motiu === "habilitat"
      ? game.i18n.format("FORJA.Curacio.HabilitatInsuficient", { nom: guaridor.name, hab: habNom, minim: requisits.minim, tipus: tipusNom })
      : game.i18n.format("FORJA.Curacio.AutotractamentDJ", { nom: guaridor.name }));
    return null;
  }

  const penalSalut = guaridor.system.salut?.penalitzacio ?? 0;
  const dificultat = (tipus === "tractament-medic" ? 2 : 1) + penalSalut;
  const dauConcentracio = await consumirConcentracio(guaridor);
  const poolFinal = Math.max(1, (guaridor.system.atributs?.INT ?? 0) + hab.nivell + dauConcentracio);

  const roll = new ForjaRoll(`${poolFinal}d10`, {}, { forja: { dificultat } });
  await roll.evaluate();

  const { exit, excedent } = roll.forjaResults;

  if (excedent > 0) {
    const abans = objectiu.system.salut[pista].marcats;
    const salut = { [pista]: { marcats: abans } };
    const nous  = aplicarDanyAPista(salut, pista, -excedent);
    await actualitzarComGM(objectiu, { [`system.salut.${pista}.marcats`]: nous });
  }

  if (exit) {
    const estats = tipus === "tractament-medic" ? ESTATS_TRACTAMENT_MEDIC : ESTATS_PRIMERS_AUXILIS;
    for (const id of estats) {
      if (objectiu.statuses?.has(id)) await alternarEstatComGM(objectiu, id, false);
    }
  }

  const content = await foundry.applications.handlebars.renderTemplate("systems/forja/templates/combat/missatge-curacio.hbs", {
    nomGuaridor:  guaridor.name,
    nomObjectiu:  objectiu.name,
    tipus, pista, dificultat, penalSalut,
    concentrat: dauConcentracio > 0,
    habNom: game.i18n.localize(CONFIG.FORJA.LLISTA_HABILITATS.find(h => h.id === hab.id)?.nom ?? hab.id),
    ...roll.forjaResults,
    exit, excedent
  });

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: guaridor }),
    content,
    rolls:   [roll],
    sound:   CONFIG.sounds.dice
  });

  return { roll, exit, excedent, hab };
}

/**
 * Guaridor i objectiu són el mateix actor (autotractament, B17). Es compara
 * per `uuid` (els tokens sense enllaçar tenen un actor sintètic propi).
 * @param {ForjaActor} a
 * @param {ForjaActor} b
 * @returns {boolean}
 */
function _mateixActor(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  return !!a.uuid && a.uuid === b.uuid;
}
