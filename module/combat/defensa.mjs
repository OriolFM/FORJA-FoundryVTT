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
 * @param {number} [defensaBasica]  Defensa bàsica a fer servir com a base per a
 *   passiva/blocar i com a mínim d'esquivar/parar. Per defecte `objectiu.system.defensa`;
 *   els atacs a distància hi passen la dificultat ja resolta per rang (S-12,
 *   `combat/abast.mjs`) enlloc de la defensa bàsica sense modificar.
 * @returns {Array<object>} opcions amb `id`, `nom`, `descripcio`, `disponible`, etc.
 */
export function opcionsDefensa(objectiu, defensaBasica = objectiu.system.defensa ?? 0) {
  const sys = objectiu.system;
  const habilitat = (id) => sys.habilitats?.[id]?.nivell ?? 0;
  const reduccioNatural = sys.reduccioDany ?? 0;
  const potReacc = potReaccionar(objectiu);

  // Parar (manual p. 805): "DES + Armes cos a cos (si porta armes) o DES +
  // Arts Marcials/Barallar-se (si no en porta)". No es guarda enlloc quina
  // arma es porta "equipada" en aquest sistema, així que es fa servir la
  // millor de les tres habilitats de combat de l'objectiu — coincideix amb
  // l'exemple del manual (el gólem sense armes-cos-a-cos ni arts-marcials
  // para amb barallar-se, p. 1348 de l'exemple de combat).
  const parar = ["armes-cos-a-cos", "arts-marcials", "barallar-se"]
    .map(id => ({ id, nivell: habilitat(id) }))
    .sort((a, b) => b.nivell - a.nivell)[0];

  return [
    {
      id: "passiva", gastaReaccio: false, disponible: true, senseTirada: true,
      nom:        game.i18n.localize("FORJA.Combat.Defensa.Passiva"),
      descripcio: game.i18n.localize("FORJA.Combat.Defensa.PassivaReaccioDesc"),
      dificultat: defensaBasica,
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
      dificultatMinima: defensaBasica + 1
    },
    {
      id: "parar", gastaReaccio: true, disponible: potReacc, senseTirada: false,
      nom:        game.i18n.localize("FORJA.Combat.Defensa.Parar"),
      descripcio: game.i18n.localize("FORJA.Combat.Defensa.PararReaccioDesc"),
      atribut: "DES", atributVal: sys.atributs?.DES ?? 0,
      habId: parar.id, habNivell: parar.nivell,
      pool: (sys.atributs?.DES ?? 0) + parar.nivell,
      exigirSuperar: true,
      dificultatMinima: defensaBasica + 1
    },
    {
      id: "blocar", gastaReaccio: true, disponible: potReacc, senseTirada: true,
      nom:        game.i18n.localize("FORJA.Combat.Defensa.Blocar"),
      descripcio: game.i18n.localize("FORJA.Combat.Defensa.BlocarReaccioDesc"),
      dificultat: defensaBasica,
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
