/**
 * Migracions de dades dels mons existents. S'executen al DJ actiu en
 * `ready` (`forja.mjs`), un sol cop per món: el número de l'última migració
 * feta es desa a la configuració del món (`forja.migracio`).
 *
 * 1. **Paràmetres d'efectes i artefactes** (Fase 2, 2026-10-06): els efectes
 *    i artefactes creats abans d'existir `system.parametres` el reben del
 *    catàleg (per `flags.forja.catalegId` o, si no en tenen, pel nom exacte).
 *    Només si encara no en tenen cap: mai sobreescriu una construcció pròpia.
 */
const MIGRACIO_ACTUAL = 1;

/** Registra la configuració. Cridar a l'init. */
export function registrarMigracio() {
  game.settings.register("forja", "migracio", {
    scope: "world", config: false, type: Number, default: 0
  });
}

/**
 * Entrada del catàleg que correspon a un item d'efecte o artefacte, o null.
 * @param {Item} item
 * @returns {object|null}
 */
export function entradaCatalegPerItem(item) {
  const cataleg = item.type === "efecte" ? CONFIG.FORJA.CATALEG_EFECTES
    : item.type === "artefacte" ? CONFIG.FORJA.CATALEG_ARTEFACTES : null;
  if (!cataleg?.length) return null;
  const id = item.getFlag?.("forja", "catalegId");
  return cataleg.find(e => (id && e.id === id) || e.nom === item.name) ?? null;
}

/**
 * Canvis per afegir els paràmetres del catàleg a un item que no en té.
 * @param {Item} item
 * @returns {object|null}
 */
function canvisParametres(item) {
  if (!["efecte", "artefacte"].includes(item.type)) return null;
  if ((item.system.parametres ?? []).length) return null;
  const entrada = entradaCatalegPerItem(item);
  if (!entrada?.parametres?.length) return null;
  const canvis = {
    _id: item.id,
    "system.parametres": foundry.utils.deepClone(entrada.parametres),
    "system.construccio": foundry.utils.deepClone(entrada.construccio ?? {}),
    "flags.forja.catalegId": entrada.id
  };
  if (item.type === "artefacte" && entrada.activacio?.atribut && !item.system.activacio?.atribut) {
    canvis["system.activacio.atribut"] = entrada.activacio.atribut;
    canvis["system.activacio.habilitat"] = entrada.activacio.habilitat ?? "";
  }
  return canvis;
}

/** Executa les migracions pendents (només el DJ actiu). */
export async function executarMigracions() {
  if (!game.users.activeGM?.isSelf) return;
  const feta = game.settings.get("forja", "migracio") ?? 0;
  if (feta >= MIGRACIO_ACTUAL) return;

  if (feta < 1) {
    let n = 0;
    const mundials = game.items.contents.map(canvisParametres).filter(Boolean);
    if (mundials.length) { await Item.updateDocuments(mundials); n += mundials.length; }
    for (const actor of game.actors) {
      const canvis = actor.items.contents.map(canvisParametres).filter(Boolean);
      if (canvis.length) { await actor.updateEmbeddedDocuments("Item", canvis); n += canvis.length; }
    }
    if (n) console.log(`FORJA | Migració 1: paràmetres afegits a ${n} efectes i artefactes`);
  }

  await game.settings.set("forja", "migracio", MIGRACIO_ACTUAL);
}
