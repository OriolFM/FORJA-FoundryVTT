import DiategResistir from "../apps/dialeg-resistir.mjs";
import { publicarTirada } from "../dice/forja-roll.mjs";
import { opcioResistir, resoldreResistir } from "./resistencia.mjs";
import { opcioContrarestar, resoldreContrarestar } from "./contrarestar.mjs";
import { potReaccionar } from "./reaccions.mjs";
import { preguntarA, registrarPregunta } from "../xarxa/socket.mjs";
import { decisorDefensa } from "./decisio-defensa.mjs";

/**
 * Qui decideix si l'objectiu d'un efecte s'hi resisteix o el contraresta
 * (Fase 3): igual que la defensa (`decisio-defensa.mjs`), el jugador
 * propietari de l'objectiu si està connectat, o el DJ; mai qui manifesta
 * l'efecte. Resistir gasta una reacció (manual › Resistir un efecte, l. 4622),
 * de manera que sense reaccions no es pregunta.
 *
 * El destinatari obre el diàleg, fa la tirada (la publica al xat) i en
 * retorna les fites: l'efecte afecta l'objectiu si qui el manifesta en treu
 * més (› Resistir: «si obté tantes o més fites que l'atacant, resisteix»).
 */

const PREGUNTA = "resistirEfecte";

/** Registra el gestor de la pregunta a tots els clients. Cridar a `ready`. */
export function registrarPreguntaResistencia() {
  registrarPregunta(PREGUNTA, async ({ uuidObjectiu, nomActor, don }) => {
    const objectiu = await fromUuid(uuidObjectiu);
    if (!objectiu) throw new Error(`objectiu no trobat (${uuidObjectiu})`);
    const contra = don ? opcioContrarestar(objectiu, don) : null;
    const opcio = await DiategResistir.obrir({
      nomActor, nomObjectiu: objectiu.name,
      mental: opcioResistir(objectiu, "mental"),
      fisic: opcioResistir(objectiu, "fisic"),
      contrarestar: contra && contra.atribut !== "-" ? contra : null
    });
    let resultat = null;
    if (opcio === "mental" || opcio === "fisic") resultat = await resoldreResistir(objectiu, opcio);
    else if (opcio === "contrarestar") resultat = await resoldreContrarestar(objectiu, don);
    if (!resultat) return null;
    await publicarTirada(resultat.roll, {
      actor: objectiu,
      label: game.i18n.format(opcio === "contrarestar" ? "FORJA.Efecte.TiradaContrarestar" : "FORJA.Efecte.TiradaResistir", { nom: objectiu.name }),
      dificultat: "—", exit: true
    });
    return { dificultat: resultat.dificultat, exigirSuperar: true, tipus: opcio === "contrarestar" ? "contrarestar" : "resistir" };
  });
}

/**
 * Pregunta si l'objectiu es resisteix a l'efecte.
 * @param {Actor} objectiu
 * @param {{nomActor:string, don:string|null}} dades
 * @returns {Promise<{dificultat:number, exigirSuperar:boolean, tipus:string}|null>}  `null` = no es resisteix.
 */
export async function decidirResistencia(objectiu, { nomActor, don = null }) {
  if (!objectiu || !potReaccionar(objectiu)) return null;
  const desti = decisorDefensa(objectiu);
  if (!desti) return null;
  if (desti.id !== game.user.id) {
    ui.notifications?.info(game.i18n.format("FORJA.Efecte.EsperantResistencia", { nom: desti.name, objectiu: objectiu.name }));
  }
  try {
    return await preguntarA(desti, PREGUNTA, { uuidObjectiu: objectiu.uuid, nomActor, don });
  } catch (err) {
    console.warn(err);
    return null;
  }
}
