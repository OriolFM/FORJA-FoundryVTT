import ForjaRoll from "../dice/forja-roll.mjs";
import { gastarReaccio, potReaccionar } from "./reaccions.mjs";

/**
 * Defensa (S-13, manual p. 703-817). Genera les opcions de reacció
 * defensiva disponibles per a un objectiu atacat:
 *
 *   - **Passiva**: valor `defensa` fix, sense cost ni tirada.
 *   - **Esquivar** / **Parar**: gasten una reacció i fan una tirada — el
 *     resultat (fites, amb un mínim de `defensa bàsica + 1`, manual p. 793/805)
 *     esdevé la dificultat que ha de SUPERAR l'atacant (no només igualar-la;
 *     empat → guanya el defensor, manual p. 777).
 *   - **Blocar**: gasta una reacció, sense tirada (dificultat = defensa
 *     bàsica, també cal superar-la), i suma resistència a la reducció de
 *     dany del defensor — fins a duplicar-la com a màxim (manual p. 817).
 *
 * @param {ForjaActor} objectiu
 * @returns {Array<object>} opcions amb `id`, `nom`, `descripcio`, `disponible`, etc.
 */
export function opcionsDefensa(objectiu) {
  const sys = objectiu.system;
  const habilitat = (id) => sys.habilitats?.[id]?.nivell ?? 0;
  const reduccioNatural = sys.reduccioDany ?? 0;
  const potReacc = potReaccionar(objectiu);

  return [
    {
      id: "passiva", gastaReaccio: false, disponible: true, senseTirada: true,
      nom:        game.i18n.localize("FORJA.Combat.Defensa.Passiva"),
      descripcio: game.i18n.localize("FORJA.Combat.Defensa.PassivaReaccioDesc"),
      dificultat: sys.defensa ?? 0,
      exigirSuperar: false
    },
    {
      id: "esquivar", gastaReaccio: true, disponible: potReacc, senseTirada: false,
      nom:        game.i18n.localize("FORJA.Combat.Defensa.Esquivar"),
      descripcio: game.i18n.localize("FORJA.Combat.Defensa.EsquivarReaccioDesc"),
      atribut: "AGI", atributVal: sys.atributs?.AGI ?? 0,
      habId: "esquivar", habNivell: habilitat("esquivar"),
      pool: (sys.atributs?.AGI ?? 0) + habilitat("esquivar"),
      exigirSuperar: true,
      dificultatMinima: (sys.defensa ?? 0) + 1
    },
    {
      id: "parar", gastaReaccio: true, disponible: potReacc, senseTirada: false,
      nom:        game.i18n.localize("FORJA.Combat.Defensa.Parar"),
      descripcio: game.i18n.localize("FORJA.Combat.Defensa.PararReaccioDesc"),
      atribut: "DES", atributVal: sys.atributs?.DES ?? 0,
      habId: "armes-cos-a-cos", habNivell: habilitat("armes-cos-a-cos"),
      pool: (sys.atributs?.DES ?? 0) + habilitat("armes-cos-a-cos"),
      exigirSuperar: true,
      dificultatMinima: (sys.defensa ?? 0) + 1
    },
    {
      id: "blocar", gastaReaccio: true, disponible: potReacc, senseTirada: true,
      nom:        game.i18n.localize("FORJA.Combat.Defensa.Blocar"),
      descripcio: game.i18n.localize("FORJA.Combat.Defensa.BlocarReaccioDesc"),
      dificultat: sys.defensa ?? 0,
      exigirSuperar: true,
      reduccioExtra: Math.min(habilitat("resistencia"), reduccioNatural)
    }
  ];
}

/**
 * Resol l'opció de defensa triada: gasta la reacció si escau i, si és
 * esquivar/parar, fa la tirada que fixarà la dificultat de l'atacant.
 *
 * @param {ForjaActor} objectiu
 * @param {object} opcio  Una de les entrades de `opcionsDefensa`
 * @returns {Promise<{dificultat:number, exigirSuperar:boolean, reduccioExtra:number, roll:ForjaRoll|null}|null>}
 *   `null` si calia gastar una reacció i l'objectiu ja no en té disponible (concurrència).
 */
export async function resoldreOpcioDefensa(objectiu, opcio) {
  if (opcio.gastaReaccio) {
    const ok = await gastarReaccio(objectiu);
    if (!ok) return null;
  }

  if (opcio.senseTirada) {
    return {
      dificultat:    opcio.dificultat,
      exigirSuperar: opcio.exigirSuperar,
      reduccioExtra: opcio.reduccioExtra ?? 0,
      roll: null
    };
  }

  const roll = new ForjaRoll(`${Math.max(1, opcio.pool)}d10`, {}, { forja: { dificultat: 1 } });
  await roll.evaluate();

  return {
    dificultat:    Math.max(roll.forjaResults.fites, opcio.dificultatMinima ?? 0),
    exigirSuperar: opcio.exigirSuperar,
    reduccioExtra: 0,
    roll
  };
}
