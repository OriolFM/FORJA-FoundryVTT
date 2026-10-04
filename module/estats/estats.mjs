import { FORJA } from "../config/constants.mjs";

/**
 * Estats (S-16, manual cap. 3 p. 96-99).
 *
 * Registra el catàleg (`config/dades/estats.json`) com a `CONFIG.statusEffects`
 * de Foundry, perquè el DJ els pugui aplicar/treure des del HUD del token i de
 * la pestanya "Efectes" de la fitxa (Active Effects del nucli, tal com marca
 * 05_ESPECIFICACIONS.md §7 per als estats sense paràmetre).
 *
 * Els estats SENSE paràmetre (aquest fitxer) continuen sent purament
 * informatius/visuals — cap efecte mecànic automàtic, tal com marca
 * 05_ESPECIFICACIONS.md §7. Els 4 estats PARAMETRITZATS (Lent/X, Ràpid/X,
 * Recuperació/X, Sagnant/X) sí tenen automatització (M-05): demanar X en
 * marcar-los, tic per torn, i modificador de latència — vegeu
 * `estats-parametritzats.mjs`.
 */
const ICONES = {
  abatut:           "icons/svg/falling.svg",
  acovardit:        "icons/svg/terror.svg",
  atordit:          "icons/svg/daze.svg",
  atrapat:          "icons/svg/net.svg",
  berserc:          "icons/svg/explosion.svg",
  concentrat:       "icons/svg/aura.svg",
  empes:            "icons/svg/wing.svg",
  immobilitzat:     "icons/svg/anchor.svg",
  incapacitat:      "icons/svg/unconscious.svg",
  inconscient:      "icons/svg/sleep.svg",
  lent:             "icons/svg/downgrade.svg",
  llancat:          "icons/svg/explosion.svg",
  "malaltia-toxina": "icons/svg/poison.svg",
  marejat:          "icons/svg/stoned.svg",
  esguerrat:        "icons/svg/degen.svg",
  rapid:            "icons/svg/upgrade.svg",
  recuperacio:      "icons/svg/regen.svg",
  sagnant:          "icons/svg/blood.svg",
  vigilant:         "icons/svg/eye.svg"
};

/**
 * Estat "Mort" del nucli de Foundry (`dead`, `CONFIG.specialStatusEffects.DEFEATED`),
 * usat pel Combat Tracker per marcar un combatent com a derrotat. El catàleg
 * FORJA (estats.json) no té cap entrada equivalent — "Inconscient" i
 * "Incapacitat" són estats diferents (encara actius, no derrotats) —, així que
 * es manté explícitament enlloc de perdre'l en substituir `CONFIG.statusEffects`.
 */
const ESTAT_MORT = { id: "dead", name: "FORJA.Estat.mort", img: "icons/svg/skull.svg" };

/** Registra `FORJA.CATALEG_ESTATS` com a `CONFIG.statusEffects`. Cridar a l'init. */
export function registrarEstats() {
  CONFIG.statusEffects = [
    ESTAT_MORT,
    ...FORJA.CATALEG_ESTATS.map(estat => ({
      id:   estat.id,
      name: `FORJA.Estat.${estat.id}`,
      img:  ICONES[estat.id] ?? "icons/svg/aura.svg"
    }))
  ];
  CONFIG.specialStatusEffects.DEFEATED = ESTAT_MORT.id;
}
