import ForjaRoll from "../dice/forja-roll.mjs";
import { concentrar, trencarConcentracio } from "./reaccions.mjs";
import { actualitzarComGM } from "../xarxa/socket.mjs";

/**
 * Prendre el control d'un efecte (S-21, manual p. 580-588): quan un
 * contrarestar guanya la tirada enfrontada però l'atacant ja havia
 * assolit la dificultat pròpia de l'efecte (l'efecte s'ha manifestat,
 * només no ha arribat a l'objectiu — "es desvia", p. 578), el defensor
 * pot, en lloc de conformar-se amb la desviació, intentar prendre'n el
 * control. Llavors l'efecte queda en disputa diversos torns.
 *
 * Estat de la disputa: es guarda com a flag al document `Combat` actiu
 * (`combat.getFlag("forja","disputaControl")`), igual que
 * els flags del rellotge (`flags.forja.actiu`) — és l'únic lloc amb identitat inequívoca
 * de "quin combat" i sobreviu als re-renders de fitxa. Mentre duri, els
 * dos contendents estan CONCENTRATS (reaprofitant `concentrar`/
 * `trencarConcentracio` de S-11: +1 dau, sense reaccions — exactament
 * l'estat que demana el manual).
 *
 * Identitat pels dos contendents: `.id` de l'actor, MAI `.uuid`. Dos
 * motius: (1) un `.uuid` conté punts (`Actor.xxxx`), i qualsevol clau
 * d'objecte amb punts es corromp en passar per `combat.setFlag`/
 * `update` (Foundry ho interpreta com un camí, no una clau literal, i
 * l'"expandeix" en un objecte niat); (2) per a un token DESVINCULAT,
 * `combatant.actor` és un actor sintètic amb un UUID contextualitzat
 * al token (`Scene.X.Token.Y.Actor.Z`) que mai coincidiria amb
 * l'UUID pla d'un `game.actors.get(id)` — però `.id` és el mateix en
 * tots dos casos.
 *
 * Guanya qui superi les fites ACUMULADES de l'oponent en una quantitat
 * igual a la dificultat BASE de l'efecte (no la inflada per la
 * contrarestada). Cada actor pot "continuar" (tira de nou i acumula) o
 * "renunciar" (l'oponent guanya el control a l'instant) — només quan
 * els toca declarar (mateix criteri que la resta del rellotge de temps
 * actiu: `combat.combatant.id`). Si un dels dos perd la concentració
 * per una causa externa (dany, manual p. 588), l'altre guanya
 * automàticament — per això qualsevol punt on es crida
 * `trencarConcentracio` sobre un actor ha de comprovar-ho també amb
 * `resoldrePerRupturaConcentracio` (vegeu `atac.mjs` i els handlers
 * `_onToggleConcentracio` de les fitxes).
 *
 * **Deliberadament NO automatitzat**: què vol dir mecànicament "dirigir
 * l'efecte" un cop es guanya el control (redirigir dany, canviar
 * objectiu...) — depèn totalment de l'efecte concret i és, per
 * definició, la mateixa mena de judici narratiu que ja queda a mans
 * del DJ a la resta del sistema d'efectes (DA-5/G-3). Aquest mòdul
 * només calcula QUI guanya el control i QUAN — el que se'n fa després,
 * el DJ ho anuncia i ho aplica com correspongui.
 */

const SCOPE = "forja";
const KEY = "disputaControl";

/**
 * @returns {boolean} Si el defensor d'un contrarestar pot oferir-se a
 * prendre el control en lloc d'acceptar que l'efecte es desviï.
 */
export function potPrendreControl({ contrarestat, exit, manifestantFites, dificultatBase, contrarestantFites }) {
  if (!contrarestat || exit) return false;
  return manifestantFites > dificultatBase && manifestantFites <= contrarestantFites;
}

/** @returns {object|null} L'estat de la disputa activa d'aquest combat, si n'hi ha. */
export function disputaCombat(combat) {
  return combat?.getFlag(SCOPE, KEY) ?? null;
}

/** @returns {object|null} L'estat de la disputa, només si `actor` hi participa. */
export function disputaActor(combat, actor) {
  const estat = disputaCombat(combat);
  if (!estat || !actor) return null;
  return (estat.atacantId === actor.id || estat.defensorId === actor.id) ? estat : null;
}

/** @returns {boolean} Si és el torn d'`actor` al rellotge de temps actiu d'aquest combat. */
export function esElSeuTorn(combat, actor) {
  const combatant = combat?.combatants.find(c => c.actor?.id === actor?.id);
  return !!combatant && combat.combatant?.id === combatant.id;
}

/**
 * Inicia la disputa: guarda l'estat al combat i concentra els dos
 * contendents.
 * @param {object} p
 * @param {Combat} p.combat
 * @param {string} p.efecteNom
 * @param {number} p.dificultatBase
 * @param {ForjaActor} p.atacant     Qui manifestava l'efecte originalment.
 * @param {number} p.atacantFites    Fites de la tirada de manifestar.
 * @param {ForjaActor} p.defensor    Qui ha contrarestat i vol prendre'n el control.
 * @param {number} p.defensorFites   Fites de la tirada de contrarestar.
 */
export async function iniciarDisputaControl({ combat, efecteNom, dificultatBase, atacant, atacantFites, defensor, defensorFites }) {
  const estat = {
    efecteNom, dificultatBase,
    atacantId: atacant.id, atacantNom: atacant.name,
    defensorId: defensor.id, defensorNom: defensor.name,
    fites: { [atacant.id]: atacantFites, [defensor.id]: defensorFites }
  };
  await _desarDisputa(combat, estat);
  await concentrar(atacant);
  await concentrar(defensor);
  return estat;
}

/**
 * `actor` continua la disputa: tira de nou amb el seu do i acumula.
 * Si supera l'oponent per marge >= dificultatBase, guanya i es resol
 * la disputa.
 * @returns {Promise<{resolt:boolean, roll:ForjaRoll, fitesActor:number, fitesOponent:number, guanyador?:ForjaActor}|null>}
 */
export async function continuarDisputaControl(combat, actor) {
  const estat = disputaActor(combat, actor);
  if (!estat) return null;

  const don = actor.system.dotat;
  const donCfg = CONFIG.FORJA.DONS[don];
  const atribut = donCfg?.atribut ?? actor.system.qiAtribut;
  const atributVal = actor.system.atributs?.[atribut] ?? 0;
  const habNivell = actor.system.habilitats?.[donCfg?.habilitat]?.nivell ?? 0;
  const roll = new ForjaRoll(`${Math.max(1, atributVal + habNivell)}d10`, {}, { forja: { dificultat: 1 } });
  await roll.evaluate();

  const oponentId = estat.atacantId === actor.id ? estat.defensorId : estat.atacantId;
  const nousFites = { ...estat.fites, [actor.id]: (estat.fites[actor.id] ?? 0) + roll.forjaResults.fites };
  const fitesActor    = nousFites[actor.id];
  const fitesOponent  = nousFites[oponentId] ?? 0;

  if (fitesActor - fitesOponent >= estat.dificultatBase) {
    const resolucio = await _resoldreDisputa(combat, estat, actor.id);
    return { resolt: true, roll, fitesActor, fitesOponent, guanyador: resolucio.guanyador };
  }

  await _desarDisputa(combat, { ...estat, fites: nousFites });
  return { resolt: false, roll, fitesActor, fitesOponent };
}

/** `actor` renuncia: l'oponent guanya el control a l'instant. */
export async function renunciarDisputaControl(combat, actor) {
  const estat = disputaActor(combat, actor);
  if (!estat) return null;
  const oponentId = estat.atacantId === actor.id ? estat.defensorId : estat.atacantId;
  return _resoldreDisputa(combat, estat, oponentId);
}

/**
 * Comprova si `actor` és a mig d'una disputa quan se li acaba de trencar
 * la concentració (per qualsevol causa — dany o voluntària: si ja no
 * pot mantenir la concentració, no pot seguir disputant). Si hi és,
 * l'oponent guanya el control automàticament (manual p. 588).
 * Cridar sempre després de `trencarConcentracio(actor)`.
 */
export async function resoldrePerRupturaConcentracio(combat, actor) {
  const estat = disputaActor(combat, actor);
  if (!estat) return null;
  const oponentId = estat.atacantId === actor.id ? estat.defensorId : estat.atacantId;
  return _resoldreDisputa(combat, estat, oponentId);
}

/**
 * Orquestració completa de l'oferiment (manual p. 580, "si el defensor ho
 * desitja"): comprova elegibilitat després d'un `manifestarEfecte` resolt,
 * i si escau, pregunta al defensor si vol intentar prendre el control en
 * lloc d'acceptar que l'efecte es desviï. Cridar just després de
 * `manifestarEfecte` a l'orquestració de la fitxa (mateixa forma a PJ i
 * PNJ) — no fa res si no hi ha combat actiu (la disputa necessita el
 * rellotge de temps actiu per situar els "torns de declarar").
 * @param {object} p
 * @param {object} p.resultat        Retorn de `manifestarEfecte`.
 * @param {object|null} p.resistencia Paràmetre passat a `manifestarEfecte`.
 * @param {number} p.dificultatBase
 * @param {ForjaActor} p.atacant     Qui ha manifestat l'efecte.
 * @param {ForjaActor} p.defensor    Qui l'ha contrarestat (`objectiu`).
 * @param {string} p.label           Nom de l'efecte, per al xat.
 */
export async function oferirControlSiEscau({ resultat, resistencia, dificultatBase, atacant, defensor, label }) {
  const combat = game.combat;
  if (!combat || !defensor || !resultat?.roll) return;

  const elegible = potPrendreControl({
    contrarestat: resistencia?.tipus === "contrarestar",
    exit: resultat.exit,
    manifestantFites: resultat.roll.forjaResults.fites,
    dificultatBase,
    contrarestantFites: resistencia?.dificultat ?? 0
  });
  if (!elegible) return;

  const vol = await foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n.localize("FORJA.Sobrenatural.OferirControlTitol") },
    content: `<p>${game.i18n.format("FORJA.Sobrenatural.OferirControlText", { nom: defensor.name, efecte: label || "?" })}</p>`
  });
  if (!vol) return;

  await iniciarDisputaControl({
    combat, efecteNom: label || "?", dificultatBase,
    atacant, atacantFites: resultat.roll.forjaResults.fites,
    defensor, defensorFites: resistencia.dificultat
  });
}

/**
 * Desa (o esborra, amb `null`) l'estat de la disputa al combat. Un jugador no
 * pot escriure el document Combat: passa pel relé del DJ (`flags.forja.*`).
 * @param {Combat} combat
 * @param {object|null} estat
 */
async function _desarDisputa(combat, estat) {
  const canvi = estat === null ? { [`flags.${SCOPE}.-=${KEY}`]: null } : { [`flags.${SCOPE}.${KEY}`]: estat };
  await actualitzarComGM(combat, canvi);
}

async function _resoldreDisputa(combat, estat, guanyadorId) {
  await _desarDisputa(combat, null);
  const atacant  = game.actors.get(estat.atacantId);
  const defensor = game.actors.get(estat.defensorId);
  if (atacant)  await trencarConcentracio(atacant);
  if (defensor) await trencarConcentracio(defensor);

  const guanyador = guanyadorId === estat.atacantId ? atacant : defensor;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: guanyador }),
    content: game.i18n.format("FORJA.Sobrenatural.ControlGuanyat", {
      nom: guanyador?.name ?? "?", efecte: estat.efecteNom
    })
  });
  return { guanyador };
}
