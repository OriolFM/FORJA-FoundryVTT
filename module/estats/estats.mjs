import { FORJA } from "../config/constants.mjs";

/**
 * Estats (S-16, manual cap. 3 p. 96-99).
 *
 * Registra el catàleg (`config/dades/estats.json`) com a `CONFIG.statusEffects`
 * de Foundry, perquè el DJ els pugui aplicar/treure des del HUD del token i de
 * la pestanya "Efectes" de la fitxa (Active Effects del nucli, tal com marca
 * 05_ESPECIFICACIONS.md §7 per als estats sense paràmetre).
 *
 * Abast d'aquesta Onada 3 ("versió bàsica"): els estats són purament
 * informatius/visuals — cap efecte mecànic automàtic (ni tan sols els que
 * semblen un simple +/-latència, com Lent/X o Ràpid/X). L'automatització
 * (aplicar l'efecte, decrementar-lo cada tick, autoeliminar-se) és feina de
 * M-05 i requereix abans decidir com s'evita la col·lisió de flags quan hi ha
 * més d'un estat parametritzat actiu alhora (vegeu 09_CONTEXT_SESSIONS.md).
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
  sagnant:          "icons/svg/bleeding-wound.svg",
  vigilant:         "icons/svg/eye.svg"
};

/** Registra `FORJA.CATALEG_ESTATS` com a `CONFIG.statusEffects`. Cridar a l'init. */
export function registrarEstats() {
  CONFIG.statusEffects = FORJA.CATALEG_ESTATS.map(estat => ({
    id:   estat.id,
    name: estat.nom,
    img:  ICONES[estat.id] ?? "icons/svg/aura.svg"
  }));
}
