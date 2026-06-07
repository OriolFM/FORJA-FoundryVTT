import { FORJA } from "../config/constants.mjs";

/**
 * Mapeig tret d'armament natural (manual, cap. Trets) → arma del catàleg
 * que tot actor que el posseeixi hauria de tenir.
 */
export const ARMAMENT_NATURAL_PER_TRET = {
  "armament-urpes":     "urpes",
  "armament-mossegada": "ullals",
  "armament-banyes":    "banyes",
  "armament-pinces":    "pinces",
  "armament-fiblons":   "fiblons-i-espines"
};

/**
 * Afegeix a l'actor l'arma `catalegId` del catàleg si encara no la té
 * (es marca amb el flag `forja.catalegId` per evitar duplicats).
 */
export async function afegirArmaDelCataleg(actor, catalegId, { basic = false } = {}) {
  if (actor.items.some(i => i.type === "arma" && i.getFlag("forja", "catalegId") === catalegId)) return;
  const entrada = FORJA.CATALEG_ARMES.find(a => a.id === catalegId);
  if (!entrada) return;
  await actor.createEmbeddedDocuments("Item", [{
    name: entrada.nom,
    type: "arma",
    system: {
      categoria:   entrada.categoria,
      modLatencia: entrada.modLatencia,
      abast:       entrada.abast,
      danyBase:    entrada.danyBase,
      maniobra:    entrada.maniobra ?? "",
      rangExtrem:  entrada.rangExtrem ?? false,
      basic,
      descripcio:  entrada.descripcio ?? ""
    },
    flags: { forja: { catalegId } }
  }]);
}

/**
 * Comprova que l'actor disposi de l'atac bàsic "Cop" i de l'atac natural
 * corresponent a cada tret d'"Armament Natural" que tingui, afegint-los
 * si manquen. Útil tant en crear l'actor/tret com per "reparar" personatges
 * ja existents (p. ex. en entrar en mode d'edició).
 */
export async function assegurarAtacsAutomatics(actor) {
  if (!["personatge", "pnj"].includes(actor.type)) return;

  await afegirArmaDelCataleg(actor, "cop", { basic: true });

  for (const tret of actor.items.filter(i => i.type === "tret")) {
    const nom = (tret.name ?? "").toLowerCase();
    const catalegId = Object.entries(ARMAMENT_NATURAL_PER_TRET).find(([tretId]) =>
      nom.includes(tretId.replace("armament-", ""))
    )?.[1];
    if (catalegId) await afegirArmaDelCataleg(actor, catalegId);
  }
}
