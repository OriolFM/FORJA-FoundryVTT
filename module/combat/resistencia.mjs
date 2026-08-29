import ForjaRoll from "../dice/forja-roll.mjs";
import { gastarReaccio, potReaccionar } from "./reaccions.mjs";

/**
 * Resistir un efecte sobrenatural (S-21, manual p. 558-566): un PJ que
 * intueix que l'afecta un efecte directament pot gastar una reacció per
 * resistir-s'hi. Igual que esquivar/parar (S-13, `defensa.mjs`), és una
 * tirada enfrontada: si l'objectiu obté tantes fites o més que qui manifesta
 * l'efecte, el resisteix — el manifestador ha de SUPERAR-les (empat guanya
 * qui resisteix), mateix patró `exigirSuperar` que la resta del sistema.
 *
 * @param {ForjaActor} objectiu
 * @param {"mental"|"fisic"} tipus  Mental → APL+resistència; físic → FOR+resistència (manual p. 562-564).
 * @returns {{disponible:boolean, atribut:string, pool:number}}
 */
export function opcioResistir(objectiu, tipus) {
  const sys = objectiu.system;
  const atribut = tipus === "mental" ? "APL" : "FOR";
  const habNivell = sys.habilitats?.resistencia?.nivell ?? 0;
  return {
    disponible: potReaccionar(objectiu),
    atribut,
    atributVal: sys.atributs?.[atribut] ?? 0,
    habNivell,
    pool: (sys.atributs?.[atribut] ?? 0) + habNivell
  };
}

/**
 * Gasta la reacció i fa la tirada de resistència. Retorna, en el mateix
 * format que `resoldreOpcioDefensa` (S-13), el que cal per orquestrar
 * `manifestarEfecte`: la dificultat que ha de superar qui manifesta l'efecte.
 *
 * @param {ForjaActor} objectiu
 * @param {"mental"|"fisic"} tipus
 * @returns {Promise<{dificultat:number, exigirSuperar:boolean, roll:ForjaRoll}|null>}
 *   `null` si no quedava cap reacció disponible (concurrència).
 */
export async function resoldreResistir(objectiu, tipus) {
  const opcio = opcioResistir(objectiu, tipus);
  const ok = await gastarReaccio(objectiu);
  if (!ok) return null;

  const roll = new ForjaRoll(`${Math.max(1, opcio.pool)}d10`, {}, { forja: { dificultat: 1 } });
  await roll.evaluate();

  return { dificultat: roll.forjaResults.fites, exigirSuperar: true, roll };
}
