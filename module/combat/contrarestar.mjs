import ForjaRoll from "../dice/forja-roll.mjs";
import { gastarReaccio, potReaccionar } from "./reaccions.mjs";

/**
 * Contrarestar un efecte (S-21, manual p. 568-588): un PJ amb el MATEIX do
 * que qui manifesta pot provar de contrarestar-lo en el moment de llançar-se,
 * declarant-ho com a acció o gastant una reacció.
 *
 * Mecànicament és idèntic a `resistencia.mjs`: qui contraresta tira el seu
 * propi atribut+habilitat i les seves fites esdevenen una dificultat que qui
 * manifesta ha de SUPERAR (mai només igualar — mateix `exigirSuperar` que
 * `resistencia.mjs`), consumit tal qual pel paràmetre `resistencia` que
 * `manifestarEfecte` ja accepta (S-21) — no calia tocar-lo. Per això aquest
 * mòdul només s'encarrega de calcular/tirar el pool de qui contraresta; la
 * resta (comparar amb la dificultat pròpia de l'efecte, aplicar el cost
 * d'equilibri de qui manifesta, etc.) ja el fa `manifestarEfecte`.
 *
 * **Abast d'aquesta implementació ("nucli")**: només la tirada del moment
 * de llançar-se (les tres conseqüències del manual: falla / es manifesta
 * amb normalitat / es manifesta però es desvia — aquesta última "a
 * discreció del DJ", sense cap fórmula més enllà de comparar fites). **NO**
 * inclou "prendre el control de l'efecte" (p. 580-588): un flux en disputa
 * que pot allargar-se diversos torns, amb el seu propi estat de
 * concentració especial (+1 dau, sense reaccions) i una condició de ruptura
 * (rebre un nivell de dany de cop dona la victòria automàtica a l'altre) —
 * prou diferent i amb prou estat propi com per merèixer la seva pròpia
 * peça, documentat com a pendent.
 *
 * **Simplificació deliberada**: el manual permet que "un PJ amb el mateix
 * do" contraresti encara que no sigui l'objectiu de l'efecte (un tercer
 * dotat que intervé). Aquí només es contempla que ho faci **l'objectiu
 * mateix** (reutilitzant `objectiu` del flux de `DiategManifestar`, ja
 * seleccionat via target) quan resulta ser dotat del mateix do que qui
 * manifesta — cobreix el cas més freqüent (autodefensa) sense necessitar
 * un selector de "qualsevol dotat present a l'escena". Ampliable més
 * endavant si cal.
 */

/** @returns {boolean} Si `objectiu` pot contrarestar (mateix do que l'atacant i li queda reacció). */
export function potContrarestar(objectiu, donAtacant) {
  const donObjectiu = objectiu?.system?.dotat;
  return !!donObjectiu && donObjectiu === donAtacant && potReaccionar(objectiu);
}

/** @returns {{disponible:boolean, atribut:string, atributVal:number, habilitat:string, habNivell:number, pool:number}} */
export function opcioContrarestar(objectiu, donAtacant) {
  const don = objectiu?.system?.dotat;
  if (!don || don !== donAtacant) {
    return { disponible: false, atribut: "-", atributVal: 0, habilitat: "-", habNivell: 0, pool: 0 };
  }

  const donCfg = CONFIG.FORJA.DONS[don];
  const atribut = donCfg.atribut ?? objectiu.system.qiAtribut;
  const atributVal = objectiu.system.atributs?.[atribut] ?? 0;
  const habNivell = objectiu.system.habilitats?.[donCfg.habilitat]?.nivell ?? 0;
  return {
    disponible: potReaccionar(objectiu),
    atribut, atributVal, habilitat: donCfg.habilitat, habNivell,
    pool: atributVal + habNivell
  };
}

/**
 * Gasta la reacció de l'objectiu i fa la tirada de contrarestar. Mateix
 * format de retorn que `resoldreResistir` (S-21) perquè `manifestarEfecte`
 * el consumeixi sense cap canvi.
 * @param {ForjaActor} objectiu
 * @param {string} donAtacant
 * @returns {Promise<{dificultat:number, exigirSuperar:boolean, roll:ForjaRoll}|null>}
 */
export async function resoldreContrarestar(objectiu, donAtacant) {
  const opcio = opcioContrarestar(objectiu, donAtacant);
  if (!opcio.disponible) return null;
  const ok = await gastarReaccio(objectiu);
  if (!ok) return null;

  const roll = new ForjaRoll(`${Math.max(1, opcio.pool)}d10`, {}, { forja: { dificultat: 1 } });
  await roll.evaluate();

  return { dificultat: roll.forjaResults.fites, exigirSuperar: true, roll, tipus: "contrarestar" };
}
