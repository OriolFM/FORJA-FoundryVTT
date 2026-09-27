import ForjaRoll from "../dice/forja-roll.mjs";
import { gastarReaccio, potReaccionar } from "./reaccions.mjs";

/**
 * Defensa (S-13, manual p. 703-817; FC001CA, SISTEMES › Combat › Defensar-se).
 * Font ÚNICA de les opcions de defensa (B7): la fan servir tant el diàleg de
 * defensa en resoldre un atac (reaccions) com el diàleg de declarar acció
 * (acció defensiva completa, `declarada: true`).
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
 * Salut (B1; FC001CA › Salut › Fatiga i ferides): la penalització del
 * DEFENSOR s'aplica a la seva tirada d'esquivar/parar restant-la de les
 * fites (en una tirada enfrontada, +X a la dificultat pròpia equival a X
 * fites menys). Un defensor fora de combat (nivell 7: inconscient/
 * incapacitat) no pot defensar-se activament i la seva defensa bàsica és 1
 * (› Defensar-se › Defensa bàsica: "Si l'objectiu ... l'han immobilitzat o
 * incapacitat ... la defensa bàsica és de 1").
 *
 * @param {ForjaActor} objectiu
 * @param {number} [defensaBasica]  Defensa bàsica a fer servir com a base per a
 *   passiva/blocar i com a mínim d'esquivar/parar. Per defecte `objectiu.system.defensa`;
 *   els atacs a distància hi passen la dificultat ja resolta per rang (S-12,
 *   `combat/abast.mjs`) enlloc de la defensa bàsica sense modificar.
 * @param {object} [opcions]
 * @param {boolean} [opcions.declarada=false]  Opcions per a una acció defensiva
 *   DECLARADA (no reacció): sense "passiva", no gasten reacció i sempre disponibles
 *   (llevat que l'actor estigui fora de combat).
 * @returns {Array<object>} opcions amb `id`, `nom`, `descripcio`, `disponible`, etc.
 */
export function opcionsDefensa(objectiu, defensaBasica = objectiu.system.defensa ?? 0, { declarada = false } = {}) {
  const sys = objectiu.system;
  const habilitat = (id) => sys.habilitats?.[id]?.nivell ?? 0;
  const reduccioNatural = sys.reduccioDany ?? 0;
  const foraDeCombat = !!sys.salut?.foraDeCombat;
  const penalSalut   = sys.salut?.penalitzacio ?? 0;
  if (foraDeCombat) defensaBasica = 1;
  const actiuDisponible = !foraDeCombat && (declarada || potReaccionar(objectiu));
  const desc = (id) => game.i18n.localize(`FORJA.Combat.Defensa.${id}${declarada ? "Desc" : "ReaccioDesc"}`);

  // Parar (manual p. 805): "DES + Armes cos a cos (si porta armes) o DES +
  // Arts Marcials/Barallar-se (si no en porta)". No es guarda enlloc quina
  // arma es porta "equipada" en aquest sistema, així que es fa servir la
  // millor de les tres habilitats de combat de l'objectiu — coincideix amb
  // l'exemple del manual (el gólem sense armes-cos-a-cos ni arts-marcials
  // para amb barallar-se, p. 1348 de l'exemple de combat).
  const parar = ["armes-cos-a-cos", "arts-marcials", "barallar-se"]
    .map(id => ({ id, nivell: habilitat(id) }))
    .sort((a, b) => b.nivell - a.nivell)[0];

  const opcions = [
    {
      id: "passiva", gastaReaccio: false, disponible: true, senseTirada: true,
      nom:        game.i18n.localize("FORJA.Combat.Defensa.Passiva"),
      descripcio: game.i18n.localize("FORJA.Combat.Defensa.PassivaReaccioDesc"),
      dificultat: defensaBasica,
      exigirSuperar: false
    },
    {
      id: "esquivar", gastaReaccio: true, disponible: actiuDisponible, senseTirada: false,
      nom:        game.i18n.localize("FORJA.Combat.Defensa.Esquivar"),
      descripcio: desc("Esquivar"), penalSalut,
      atribut: "AGI", atributVal: sys.atributs?.AGI ?? 0,
      habId: "esquivar", habNivell: habilitat("esquivar"),
      pool: (sys.atributs?.AGI ?? 0) + habilitat("esquivar"),
      exigirSuperar: true,
      dificultatMinima: defensaBasica + 1
    },
    {
      id: "parar", gastaReaccio: true, disponible: actiuDisponible, senseTirada: false,
      nom:        game.i18n.localize("FORJA.Combat.Defensa.Parar"),
      descripcio: desc("Parar"), penalSalut,
      atribut: "DES", atributVal: sys.atributs?.DES ?? 0,
      habId: parar.id, habNivell: parar.nivell,
      pool: (sys.atributs?.DES ?? 0) + parar.nivell,
      exigirSuperar: true,
      dificultatMinima: defensaBasica + 1
    },
    {
      id: "blocar", gastaReaccio: true, disponible: actiuDisponible, senseTirada: true,
      nom:        game.i18n.localize("FORJA.Combat.Defensa.Blocar"),
      descripcio: desc("Blocar"),
      dificultat: defensaBasica,
      exigirSuperar: true,
      reduccioExtra: Math.min(habilitat("resistencia"), reduccioNatural)
    }
  ];

  if (!declarada) return opcions;
  return opcions
    .filter(o => o.id !== "passiva")
    .map(o => ({ ...o, gastaReaccio: false }));
}

/**
 * Defensa resultant d'una tirada d'esquivar/parar (funció pura, B1/S-13):
 * fites menys la penalització de salut del defensor, amb un mínim de
 * `defensa bàsica + 1` (FC001CA › Defensar-se › Esquivar / Parar).
 * @param {number} fites
 * @param {number} penalSalut
 * @param {number} dificultatMinima
 * @returns {number}
 */
export function resultatDefensaActiva(fites, penalSalut, dificultatMinima) {
  return Math.max(Math.max(0, fites - (penalSalut ?? 0)), dificultatMinima ?? 0);
}

/**
 * Resol l'opció de defensa triada: gasta la reacció si escau i, si és
 * esquivar/parar, fa la tirada que fixarà la dificultat de l'atacant i la
 * publica al xat (B10).
 *
 * @param {ForjaActor} objectiu
 * @param {object} opcio  Una de les entrades de `opcionsDefensa`
 * @param {object} [context]
 * @param {string} [context.nomAtacant]  Per al missatge de xat
 * @returns {Promise<{dificultat:number, exigirSuperar:boolean, reduccioExtra:number, roll:ForjaRoll|null}|null>}
 *   `null` si calia gastar una reacció i l'objectiu ja no en té disponible (concurrència).
 */
export async function resoldreOpcioDefensa(objectiu, opcio, { nomAtacant = null } = {}) {
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

  const penalSalut = opcio.penalSalut ?? 0;
  const dificultat = resultatDefensaActiva(roll.forjaResults.fites, penalSalut, opcio.dificultatMinima);

  const content = await foundry.applications.handlebars.renderTemplate("systems/forja/templates/combat/missatge-defensa.hbs", {
    nomDefensor: objectiu.name,
    nomAtacant,
    nomOpcio:    opcio.nom,
    atribut:     opcio.atribut,
    habId:       opcio.habId,
    penalSalut,
    dificultatMinima: opcio.dificultatMinima ?? 0,
    minimAplicat: (roll.forjaResults.fites - penalSalut) < (opcio.dificultatMinima ?? 0),
    dificultat,
    ...roll.forjaResults
  });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: objectiu }),
    content,
    rolls:   [roll],
    sound:   CONFIG.sounds.dice
  });

  return {
    dificultat,
    exigirSuperar: opcio.exigirSuperar,
    reduccioExtra: 0,
    roll
  };
}
