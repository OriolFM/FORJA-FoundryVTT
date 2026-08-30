import { ferAtac } from "./atac.mjs";
import { opcionsDefensa, resoldreOpcioDefensa } from "./defensa.mjs";
import { objectiusEsferic } from "./area.mjs";

/**
 * Maniobres d'Arts Marcials (S-12, manual p. 631-651). Només disponibles
 * atacant amb "Cop" (l'única arma natural que la taula del manual llista
 * amb l'opció d'Arts Marcials — la resta d'armes naturals tenen el seu
 * propi moviment especial, diferent per a cadascuna i encara sense fer).
 *
 * Abast d'aquesta peça: els efectes que es poden aplicar com a pas
 * POSTERIOR a un `ferAtac` normal ja reeixit (aplicar un estat, o
 * —Puntada de peu giratòria— repetir la resolució contra més d'un
 * objectiu) — i que per tant no calia tocar `ferAtac`/`calcularDany` per
 * dins. **Deliberadament fora d'aquesta peça** (necessiten tocar el
 * pipeline de dany o l'economia de reaccions per dins, cadascuna amb el
 * seu propi matís, documentat com a pendent):
 *   - Cop penetrant (ignora armadura natural/flexible): el sistema
 *     actual no distingeix TIPUS d'armadura enlloc (`_armaduraEfectiva`
 *     a atac.mjs sempre fa servir la primera armadura que trobi, sense
 *     mirar `fisica`/`flexible`/`natural`) — caldria primer fer que
 *     l'armadura es filtri per tipus abans de poder "ignorar-ne només
 *     alguns tipus".
 *   - Dim Mak (triar dany a ferides o el doble a fatiga): toca el
 *     pipeline de dany per dins.
 *   - Combinació (2 cops en 2 torns consecutius): estat entre activacions.
 *   - Contraatac (reacció fora de seqüència): s'ha d'enganxar al flux
 *     de `resoldreOpcioDefensa`, no al de declarar.
 *   - Llançament (moviment del token + xoc amb murs/altres tokens):
 *     peça pròpia, no una maniobra d'atac normal.
 */

/** Maniobres que apliquen un estat senzill en impactar (Dislocar, Engrapar, Interrupció). */
export async function aplicarEfecteManiobra(maniobra, objectiu) {
  if (!maniobra?.estat) return;
  if (!objectiu.statuses?.has(maniobra.estat)) {
    await objectiu.toggleStatusEffect(maniobra.estat, { active: true });
  }
  // Interrupció (manual p. 641): a més de l'atordit, +2 de llatència a la
  // PROPERA acció de l'objectiu — reaprofita el mateix mecanisme de
  // Lent/X (M-05, estats-parametritzats.mjs) amb una marca `autoconsum`
  // perquè es retiri sol un cop usat (consumit a `tracker-ui.mjs`, quan
  // l'objectiu torna a declarar).
  if (maniobra.id === "interrupcio") {
    await objectiu.createEmbeddedDocuments("ActiveEffect", [{
      name: game.i18n.format("FORJA.Combat.LentPerManiobra", { nom: maniobra.nom }),
      statuses: ["lent"],
      img: "icons/svg/downgrade.svg",
      flags: { forja: { valorX: 2, autoconsum: true } }
    }]);
  }
}

/**
 * Puntada de peu giratòria (manual p. 651): esfèric radi 2 centrat en
 * l'atacant (només caselles adjacents — radi 2 = l'atacant, que no
 * s'afecta, + 1 anell), resolt SEQÜENCIALMENT (no tots els objectius
 * alhora): continua colpejant fins que s'acaben els objectius o algun
 * PARA o BLOCA el cop (esquivar-lo NO l'atura — l'atac segueix girant
 * cap al següent).
 *
 * Per cada objectiu es mostra el mateix diàleg de defensa que un atac
 * normal (mateixa `opcionsDefensa`/`DiategDefensa`/`resoldreOpcioDefensa`
 * ja existents) — l'única diferència és que s'encadenen diversos, un
 * darrere l'altre, en lloc d'un de sol.
 *
 * @param {object} p
 * @param {ForjaActor} p.actor       Atacant
 * @param {Token} p.tokenAtacant
 * @param {Item} p.arma              Ha de ser "Cop"
 * @param {number} p.poolFinal       Ja calculat amb Arts Marcials + maniobra
 * @param {object} p.maniobra
 * @param {(objectiu:ForjaActor)=>Promise<object|null>} p.demanarDefensa
 *   Crida que obre el diàleg de defensa per a `objectiu` i retorna
 *   l'opció triada (o `null` si es cancel·la) — injectada des de
 *   `tracker-ui.mjs` perquè aquest mòdul no depengui de `DiategDefensa`.
 * @returns {Promise<{resultats:Array<object>, aturat:boolean}>}
 */
export async function resoldrePuntadaDePeuGiratoria({ actor, tokenAtacant, arma, poolFinal, maniobra, demanarDefensa }) {
  const centreOffset = canvas.grid.getOffset({ x: tokenAtacant.center.x, y: tokenAtacant.center.y });
  const objectius = objectiusEsferic({
    origen: tokenAtacant.center,
    centreOffset,
    radi: 2,
    excloure: [tokenAtacant]
  });

  const resultats = [];
  let aturat = false;

  for (const tokenObjectiu of objectius) {
    const objectiu = tokenObjectiu.actor;
    if (!objectiu) continue;

    const eleccio = await demanarDefensa(objectiu);
    if (!eleccio) continue; // DJ ha cancel·lat aquest objectiu concret, continua amb el següent

    const resolucio = await resoldreOpcioDefensa(objectiu, eleccio);
    if (!resolucio) continue;

    const resultat = await ferAtac({
      actor, objectiu, arma, poolFinal,
      dificultat: resolucio.dificultat,
      exigirSuperar: resolucio.exigirSuperar,
      reduccioExtra: resolucio.reduccioExtra,
      maniobra,
      etiquetaDefensa: eleccio.nom,
      label: arma.name
    });
    resultats.push({ objectiu, eleccio, resultat });

    // Manual: "continua impactant fins que... li parin o bloquin el cop"
    // — esquivar NO l'atura (encara que l'esquivada tingui èxit), només
    // parar/blocar que aconsegueixin fer fallar l'atac ho fan.
    if ((eleccio.id === "parar" || eleccio.id === "blocar") && !resultat.exit) {
      aturat = true;
      break;
    }
  }

  return { resultats, aturat };
}
