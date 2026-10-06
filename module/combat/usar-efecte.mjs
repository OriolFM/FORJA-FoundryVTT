import ForjaRoll from "../dice/forja-roll.mjs";
import { manifestarEfecte } from "./manifestar.mjs";
import { oferirControlSiEscau } from "./control-efecte.mjs";
import { decidirResistencia } from "./decisio-resistencia.mjs";
import { aplicarResultatEfecte } from "./aplicar-efecte.mjs";
import { activarArtefacte, teCarrega } from "./artefactes.mjs";
import { resumParametres } from "./resultat-parametres.mjs";
import { consumirConcentracio } from "./reaccions.mjs";
import { darreraPlantilla, actorsDinsPlantilla, consumirPlantilla } from "./plantilla.mjs";

/**
 * Objectius d'un efecte o artefacte d'àrea: els tokens dins la darrera
 * plantilla que ha dibuixat l'usuari (que es consumeix); si no n'hi ha cap,
 * els marcats.
 * @param {Actor[]} perDefecte
 * @returns {Promise<Actor[]>}
 */
async function objectiusArea(perDefecte) {
  const plantilla = canvas?.ready ? darreraPlantilla() : null;
  if (!plantilla) {
    ui.notifications?.info(game.i18n.localize("FORJA.Efecte.AreaSensePlantilla"));
    return perDefecte;
  }
  const actors = actorsDinsPlantilla(plantilla);
  await consumirPlantilla(plantilla);
  return actors;
}

/**
 * Fer servir un efecte o un artefacte de principi a fi (Fase 3): la tirada,
 * la resistència dels objectius i el resultat (`aplicar-efecte.mjs`). El fan
 * servir la fitxa i el tracker (acció declarada).
 */

/**
 * Objectius de l'usuari actual (tokens marcats), com a actors.
 * @returns {Actor[]}
 */
export function objectiusMarcats() {
  return [...(game.user?.targets ?? [])].map(t => t.actor).filter(Boolean);
}

/**
 * Manifesta un efecte (manual › Manifestar un efecte, l. 4572) i n'aplica el
 * resultat.
 * - Resistència (l. 4622): per a cada objectiu, decideix el seu jugador o el
 *   DJ (`decidirResistencia`). Amb un sol objectiu, la resistència entra a la
 *   tirada com fins ara (i permet prendre el control de l'efecte si l'ha
 *   contrarestat); amb diversos, cada objectiu queda afectat si qui el
 *   manifesta treu més fites que la seva resistència.
 * - Només usuari: no es pregunta resistència.
 * @param {Actor} actor
 * @param {object} eleccio  Resultat de `DiategManifestar` (dificultat, mods, efecteId…).
 * @param {object} [opcions]
 * @param {Actor[]} [opcions.objectius]  Per defecte, els tokens marcats.
 * @returns {Promise<object|null>}
 */
export async function manifestarIAplicar(actor, eleccio, { objectius = objectiusMarcats() } = {}) {
  const efecte = eleccio.efecteId ? actor.items.get(eleccio.efecteId) : null;
  const resum = efecte?.system?.parametres?.length ? resumParametres(efecte.system.parametres) : null;
  if (resum?.objectius === "area") objectius = await objectiusArea(objectius);
  const dests = resum?.objectius === "usuari" ? [] : objectius;

  const resistencies = new Map();
  for (const obj of dests) {
    if (obj === actor) continue;
    const r = await decidirResistencia(obj, { nomActor: actor.name, don: actor.system.dotat });
    if (r) resistencies.set(obj, r);
  }
  const unic = dests.length === 1 ? (resistencies.get(dests[0]) ?? null) : null;

  const resultat = await manifestarEfecte({
    actor,
    dificultatBase: eleccio.dificultatBase,
    modDaus:        eleccio.modDaus,
    modDificultat:  eleccio.modDificultat,
    puntsExtra:     eleccio.puntsExtra,
    usPuntsExtra:   eleccio.usPuntsExtra,
    resistencia:    unic,
    label:          eleccio.descripcio || efecte?.name || "",
    objectiu:       dests[0] ?? null
  });
  if (!resultat) return null;

  if (dests.length === 1) {
    await oferirControlSiEscau({
      resultat, resistencia: unic, dificultatBase: eleccio.dificultatBase,
      atacant: actor, defensor: dests[0], label: eleccio.descripcio
    });
  }

  if (resultat.exit && efecte && resum) {
    const fites = resultat.roll.forjaResults.fites;
    const afectats = dests.filter(o => !resistencies.has(o) || dests.length === 1 || fites > resistencies.get(o).dificultat);
    const resistits = dests.filter(o => !afectats.includes(o)).map(o => o.name);
    await aplicarResultatEfecte({
      actor, font: efecte, objectius: afectats, excedent: resultat.excedent,
      dificultat: eleccio.dificultatBase, eleccioPista: eleccio.eleccioPista, resistits
    });
  }
  return resultat;
}

/**
 * Demana l'atribut i l'habilitat de la tirada d'activació d'un artefacte que
 * no els té definits.
 * @returns {Promise<{atribut:string, habilitat:string}|null>}
 */
async function demanarTiradaActivacio(item) {
  const atributs = CONFIG.FORJA.ATRIBUTS.map(a => `<option value="${a}">${a}</option>`).join("");
  const habilitats = CONFIG.FORJA.LLISTA_HABILITATS
    .map(h => ({ id: h.id, nom: game.i18n.localize(h.nom) }))
    .sort((a, b) => a.nom.localeCompare(b.nom))
    .map(h => `<option value="${h.id}">${h.nom}</option>`).join("");
  return foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.format("FORJA.Artefacte.TiradaActivacioTitol", { nom: item.name }) },
    content: `<p>${game.i18n.localize("FORJA.Artefacte.TiradaActivacioDesc")}</p>
      <div class="form-group"><label>${game.i18n.localize("FORJA.Dice.Atribut")}</label><select name="atribut">${atributs}</select></div>
      <div class="form-group"><label>${game.i18n.localize("FORJA.Construccio.Camp.habilitat")}</label><select name="habilitat">${habilitats}</select></div>`,
    ok: {
      label: game.i18n.localize("FORJA.Estats.Tirar"),
      callback: (ev, button) => ({ atribut: button.form.elements.atribut.value, habilitat: button.form.elements.habilitat.value })
    },
    rejectClose: false
  });
}

/**
 * Activa un artefacte (manual › Activar un artefacte, l. 4139) i n'aplica el
 * resultat:
 *   - sempre actius (permanents, armes, armadures): no s'activen (les armes
 *     s'usen atacant);
 *   - trencat (prototip): no funciona fins que s'hi facin ajustos;
 *   - gasta una càrrega, si en té (S-26);
 *   - activació normal o complexa: tirada d'atribut + habilitat contra la
 *     dificultat d'activació (amb la penalització de salut i la concentració);
 *     un prototip que pifia queda trencat (› Fabricació, l. 4749);
 *   - activació trivial: sense tirada.
 * @param {Actor} actor
 * @param {Item} item
 * @param {object} [opcions]
 * @param {Actor[]} [opcions.objectius]
 * @returns {Promise<{exit:boolean}|null>}
 */
export async function usarArtefacte(actor, item, { objectius = objectiusMarcats() } = {}) {
  const s = item.system;
  const tipus = s.activacio?.tipus ?? "normal";
  if (["cap", "permanent"].includes(tipus) || s.construccio?.permanent) {
    ui.notifications?.info(game.i18n.format("FORJA.Artefacte.SempreActiu", { nom: item.name }));
    return null;
  }
  if (s.trencat) {
    ui.notifications?.warn(game.i18n.format("FORJA.Artefacte.TrencatNoFunciona", { nom: item.name }));
    return null;
  }

  let exit = true, excedent = 0;
  const dificultat = Math.max(1, s.activacio?.dificultat ?? 1);
  if (tipus === "normal" || tipus === "complexa") {
    let atribut = s.activacio?.atribut, habilitat = s.activacio?.habilitat;
    if (!atribut) {
      const tria = await demanarTiradaActivacio(item);
      if (!tria) return null;
      ({ atribut, habilitat } = tria);
    }
    if (teCarrega(item)) {
      const c = await activarArtefacte(item);
      if (!c.ok) { ui.notifications?.warn(game.i18n.format("FORJA.Artefacte.SenseCarrega", { nom: item.name })); return null; }
    }
    const sys = actor.system;
    const penal = sys.salut?.penalitzacio ?? 0;
    const dau = await consumirConcentracio(actor);
    const pool = Math.max(1, (sys.atributs?.[atribut] ?? 0) + (habilitat ? (sys.habilitats?.[habilitat]?.nivell ?? 0) : 0) + dau);
    const difFinal = dificultat + penal;
    const roll = new ForjaRoll(`${pool}d10`, {}, { forja: { dificultat: difFinal } });
    await roll.evaluate();
    ({ exit, excedent } = roll.forjaResults);
    const habNom = habilitat ? game.i18n.localize(`FORJA.Hab.${habilitat}`) : "";
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: game.i18n.format("FORJA.Artefacte.TiradaActivacioXat", {
        nom: item.name, tirada: habNom ? `${atribut} + ${habNom}` : atribut, dificultat: difFinal,
        resultat: game.i18n.localize(exit ? "FORJA.Efecte.Resultat.exit" : (roll.forjaResults.pifia ? "FORJA.Efecte.Resultat.pifia" : "FORJA.Efecte.Resultat.fracas"))
      })
    });
    if (roll.forjaResults.pifia && s.fase !== "produccio") {
      await item.update({ "system.trencat": true });
      ui.notifications?.warn(game.i18n.format("FORJA.Artefacte.PrototipTrencat", { nom: item.name }));
    }
  } else if (teCarrega(item)) {
    const c = await activarArtefacte(item);
    if (!c.ok) { ui.notifications?.warn(game.i18n.format("FORJA.Artefacte.SenseCarrega", { nom: item.name })); return null; }
  }

  if (exit) {
    if ((s.parametres ?? []).some(p => p.tipus === "area")) objectius = await objectiusArea(objectius);
    const res = await aplicarResultatEfecte({ actor, font: item, objectius, excedent, dificultat });
    if (!res) {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="forja-missatge-accio">${game.i18n.format("FORJA.Artefacte.ActivatManual", { nom: item.name })}</div>`
      });
    }
  }
  return { exit };
}
