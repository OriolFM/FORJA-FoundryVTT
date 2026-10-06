import { armaDeArtefacte, armaduresDeArtefacte, artefacteSempreActiu } from "./resultat-parametres.mjs";

/**
 * Armes i armadures que són artefactes (Fase 3; manual › Artefactes basats en
 * armes i armadures, l. 4163: «cadascun pren les característiques bàsiques de
 * l'objecte en què es basa»).
 *
 * Un artefacte basat en una arma o armadura (paràmetres `arma`,
 * `armaduraBase`, `armadura` o `egida`) té **objectes vinculats** a l'actor:
 * una arma i/o armadures amb `flags.forja.artefacteId`, calculades amb
 * `armaDeArtefacte` i `armaduresDeArtefacte`. Així el combat les fa servir
 * com qualsevol arma o armadura (atac, dany, protecció, ègida que es trenca i
 * es reactiva). Es mantenen sincronitzades amb l'artefacte (crear, canviar,
 * equipar o treure, eliminar), al client que fa el canvi (`forja.mjs`). Si
 * l'artefacte no està equipat, o està trencat, no en té.
 */

/** Objectes vinculats a un artefacte. */
export function objectesVinculats(actor, artefacteId) {
  return actor?.items?.filter(i => i.flags?.forja?.artefacteId === artefacteId) ?? [];
}

/**
 * Objectes vinculats que hauria de tenir l'artefacte ara.
 * @param {Item} artefacte
 * @returns {object[]}  Dades d'Item per crear
 */
export function vinculatsDesitjats(artefacte) {
  if (!artefacteSempreActiu(artefacte)) return [];
  const flags = { forja: { artefacteId: artefacte.id, vinculat: true } };
  const sortida = [];
  const arma = armaDeArtefacte(artefacte, CONFIG.FORJA?.CATALEG_ARMES ?? []);
  if (arma) sortida.push({ name: artefacte.name, type: "arma", img: artefacte.img, system: arma, flags });
  for (const [i, armadura] of armaduresDeArtefacte(artefacte).entries()) {
    const sufix = armadura.egida?.activa ? ` (${game.i18n.localize("FORJA.Artefacte.Egida")})`
      : i > 0 ? ` (${game.i18n.localize("FORJA.Artefacte.ArmaduraNatural")})` : "";
    sortida.push({ name: `${artefacte.name}${sufix}`, type: "armadura", img: artefacte.img, system: { ...armadura, equipada: true }, flags });
  }
  return sortida;
}

/**
 * Sincronitza els objectes vinculats d'un artefacte: esborra els que hi ha i
 * crea els que toquen (si n'hi ha cap de diferent). Conserva l'estat de
 * l'ègida d'una armadura vinculada que ja existia (trencada o no).
 * @param {Item} artefacte
 */
export async function sincronitzarVinculats(artefacte) {
  const actor = artefacte?.parent;
  if (!actor || artefacte.type !== "artefacte") return;
  const actuals = objectesVinculats(actor, artefacte.id);
  const desitjats = vinculatsDesitjats(artefacte);
  const iguals = actuals.length === desitjats.length && desitjats.every(d => actuals.some(a =>
    a.type === d.type && a.name === d.name && _mateixSystem(a, d)));
  if (iguals) return;
  // Conserva l'ègida trencada (no es pot «reparar» canviant l'artefacte).
  for (const d of desitjats) {
    const anterior = actuals.find(a => a.type === "armadura" && a.system.egida?.absorcio > 0 && d.system.egida?.absorcio > 0);
    if (anterior && !anterior.system.egida.activa) {
      d.system.egida = { ...d.system.egida, activa: false, tornsInactiva: anterior.system.egida.tornsInactiva };
      d.flags.forja.egidaReactivaAlTick = anterior.flags?.forja?.egidaReactivaAlTick ?? null;
    }
  }
  if (actuals.length) await actor.deleteEmbeddedDocuments("Item", actuals.map(i => i.id));
  if (desitjats.length) await actor.createEmbeddedDocuments("Item", desitjats);
}

/** Les dades rellevants de l'objecte vinculat coincideixen amb les desitjades. */
function _mateixSystem(item, desitjat) {
  for (const [k, v] of Object.entries(desitjat.system)) {
    if (k === "egida") {
      if ((item.system.egida?.absorcio ?? 0) !== (v.absorcio ?? 0)) return false;
      continue;
    }
    if (JSON.stringify(item.system[k]) !== JSON.stringify(v)) return false;
  }
  return true;
}

/**
 * Esborra els objectes vinculats d'un artefacte que s'ha eliminat.
 * @param {Item} artefacte
 */
export async function eliminarVinculats(artefacte) {
  const actor = artefacte?.parent;
  if (!actor) return;
  const ids = objectesVinculats(actor, artefacte.id).map(i => i.id);
  if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
}

/**
 * Artefacte d'on ve una arma o armadura vinculada, o null.
 * @param {Item} item
 * @returns {Item|null}
 */
export function artefacteDe(item) {
  const id = item?.flags?.forja?.artefacteId;
  return id ? item.parent?.items?.get(id) ?? null : null;
}
