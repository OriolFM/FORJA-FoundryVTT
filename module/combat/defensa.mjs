import ForjaRoll from "../dice/forja-roll.mjs";

/**
 * Flux de defensa (S-13). Verificat contra el manual (FORJA_03_SISTEMES.md, p. 769-820).
 *
 * Totes les modalitats retornen `{ dificultat, exigirSuperar, ... }`:
 * - `dificultat`: el valor que l'atacant ha d'igualar (passiva) o superar (activa) per impactar.
 * - `exigirSuperar`: si `true`, és una tirada enfrontada — l'atacant ha de SUPERAR
 *   (no només igualar) la dificultat per impactar; en cas d'empat guanya el defensor (A1).
 *
 * Mínim de les defenses actives (esquivar/parar): `defensaBasica + 1`.
 */

/**
 * Defensa bàsica (p. 783): la dificultat mínima per impactar l'objectiu quan
 * és conscient de l'atac i pot moure's lliurement.
 *
 * @param {Actor} objectiu
 * @param {object} [opcions]
 * @param {boolean} [opcions.conscient=true]     Si l'objectiu és conscient de l'atac
 * @param {boolean} [opcions.immobilitzat=false] Immobilitzat/incapacitat
 * @param {boolean} [opcions.areaEfecte=false]   Atac d'arma de dispersió/àrea d'efecte
 * @param {boolean} [opcions.escut=false]        Porta un escut que no fa servir per atacar (+1)
 * @returns {{dificultat:number, exigirSuperar:boolean}}
 */
export function defensaPassiva(objectiu, { conscient = true, immobilitzat = false, areaEfecte = false, escut = false } = {}) {
  if (!conscient || immobilitzat || areaEfecte) {
    return { dificultat: 1, exigirSuperar: false };
  }
  const base = (objectiu.system.defensa ?? 0) + (escut ? 1 : 0);
  return { dificultat: base, exigirSuperar: false };
}

/**
 * Esquivar (p. 791): l'objectiu tira AGI + esquivar ABANS de l'atac; el
 * resultat (mai inferior a defensa bàsica + 1) substitueix la defensa bàsica.
 * @param {Actor} objectiu
 * @returns {Promise<{dificultat:number, exigirSuperar:boolean, roll:ForjaRoll}>}
 */
export async function esquivar(objectiu) {
  const sys      = objectiu.system;
  const nivell   = sys.habilitats?.esquivar?.nivell ?? 0;
  const pool     = Math.max(1, sys.atributs.AGI + nivell - (sys.salut?.penalitzacio ?? 0));
  const roll     = new ForjaRoll(`${pool}d10`, {}, { forja: { dificultat: 1 } });
  await roll.evaluate();

  const minim = (sys.defensa ?? 0) + 1;
  const dificultat = Math.max(roll.forjaResults.fites, minim);
  return { dificultat, exigirSuperar: true, roll };
}

/**
 * Parar (p. 800): el defensor tira DES + Armes cos a cos (armat) o
 * DES + Arts marcials/Barallar-se (desarmat) ABANS de l'atac; el resultat
 * (mai inferior a defensa bàsica + 1) és la nova defensa.
 * @param {Actor} objectiu
 * @param {boolean} [armat=true]
 * @returns {Promise<{dificultat:number, exigirSuperar:boolean, roll:ForjaRoll}>}
 */
export async function parar(objectiu, armat = true) {
  const sys = objectiu.system;
  const habId = armat
    ? "armes-cos-a-cos"
    : (sys.habilitats?.["arts-marcials"]?.nivell ? "arts-marcials" : "barallar-se");
  const nivell = sys.habilitats?.[habId]?.nivell ?? 0;
  const pool   = Math.max(1, sys.atributs.DES + nivell - (sys.salut?.penalitzacio ?? 0));
  const roll   = new ForjaRoll(`${pool}d10`, {}, { forja: { dificultat: 1 } });
  await roll.evaluate();

  const minim = (sys.defensa ?? 0) + 1;
  const dificultat = Math.max(roll.forjaResults.fites, minim);
  return { dificultat, exigirSuperar: true, roll };
}

/**
 * Blocar (p. 808): es resol contra la defensa bàsica però l'atacant ha de
 * SUPERAR-LA (no només igualar-la). Si l'atac impacta, blocar afegeix
 * resistència (sense armes) / armes cos a cos (escuts) / armes improvisades
 * (altres objectes) a la reducció de dany del defensor — amb un límit:
 * com a màxim es pot DUPLICAR la reducció de dany natural.
 *
 * @param {Actor} objectiu
 * @param {number} bonificadorBlocatge   Nivell de l'habilitat rellevant (resistència/armes cos a cos/armes improvisades)
 * @returns {{dificultat:number, exigirSuperar:boolean, reduccioExtra:number}}
 */
export function blocar(objectiu, bonificadorBlocatge) {
  const { dificultat } = defensaPassiva(objectiu);
  const reduccioNatural = objectiu.system.reduccioDany ?? 0;
  const reduccioExtra   = Math.min(bonificadorBlocatge, reduccioNatural);
  return { dificultat, exigirSuperar: true, reduccioExtra };
}
