import { FORJA } from "../config/constants.mjs";
import { pistaRecuperacio, marcatsDespresRecuperacio } from "./regles-estats.mjs";

/**
 * Automatització de tics dels 4 estats parametritzats (M-05, sobre la
 * convenció E-2 `flags.forja.valorX` — mateix nom que ja fa servir
 * `DiategTrets` per als trets amb "/X", per coherència).
 *
 * Fins ara els estats (S-16) eren purament informatius: es marcaven/es
 * desmarcaven des del HUD del token, sense cap efecte mecànic ni valor
 * de X emmagatzemat. Aquest mòdul hi afegeix:
 *
 *   - **Demanar X en marcar l'estat**: quan es crea l'ActiveEffect (HUD
 *     del token o pestanya Efectes) per a lent/ràpid/recuperació/sagnant,
 *     un diàleg curt demana el valor — es desa a `flags.forja.valorX` de
 *     l'ActiveEffect mateix. Com que cada ActiveEffect és un document
 *     independent, dues causes de Sagnant simultànies (cada una amb el
 *     seu propi valor de X) NO col·lideixen — cadascuna és el seu propi
 *     efecte, amb el seu propi tic (això resol el dubte de col·lisió de
 *     flags apuntat al comentari original de `estats.mjs`).
 *   - **Tic per torn** (`aplicarTicsEstats`, cridat des del hook
 *     `updateCombat` de `forja.mjs` sobre el combatent ENTRANT — "cada
 *     cop que li toca actuar"): Sagnant/X li resta X de fatiga; cada
 *     ActiveEffect de Recuperació/X porta el seu propi comptador
 *     (`flags.forja.comptador`) i, en arribar a 8, recupera X punts de
 *     la pista pitjor (fatiga o ferides, la de nivell més alt) i es
 *     reinicia. Cada tic genera un missatge de xat.
 *   - **Modificador de latència** (`modificadorLatenciaEstats`): Lent/X
 *     suma X, Ràpid/X en resta X — es llegeix a `dialeg-declarar-accio.mjs`.
 *
 * **Deliberadament NO automatitzat**: l'autoeliminació de l'estat en
 * "esgotar-se" — el manual lliga la fi de Lent/Ràpid/Recuperació a "que
 * la causa desaparegui", que és per definició un judici narratiu del DJ
 * (DA-5/G-3); i Sagnant ja es neteja automàticament en un tractament de
 * primers auxilis reeixit (`curacio.mjs`, ja implementat). Cap dels 4
 * estats parametritzats té una durada en torns definida pel manual, així
 * que no hi ha cap "esgotament" calculable a part d'aquests dos casos.
 */

const ESTATS_PARAMETRITZATS = new Set(["lent", "rapid", "recuperacio", "sagnant"]);

/** @returns {number} Suma de X de tots els ActiveEffects actius d'aquest estat sobre `actor` (0 si no n'hi ha). */
function sumaValorX(actor, estatId) {
  return (actor.effects?.filter(e => e.statuses?.has(estatId)) ?? [])
    .reduce((s, e) => s + (e.getFlag("forja", "valorX") ?? 0), 0);
}

/**
 * Demana el valor de X per a un ActiveEffect parametritzat acabat de crear.
 * @param {string} nomEstat
 * @returns {Promise<number>}
 */
async function demanarValorX(nomEstat) {
  return new Promise(resolve => {
    let resolt = false;
    foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.format("FORJA.Estats.ValorXTitol", { nom: nomEstat }) },
      content: `<div class="form-group"><label>${game.i18n.localize("FORJA.Estats.ValorX")}</label>
                 <input type="number" name="valorX" value="1" min="0" step="1" autofocus></div>`,
      buttons: [{
        action: "ok",
        label: game.i18n.localize("FORJA.Estats.Confirmar"),
        default: true,
        callback: (event, button) => {
          resolt = true;
          resolve(Math.max(0, parseInt(button.form.elements.valorX.value) || 0));
        }
      }],
      rejectClose: false,
      close: () => { if (!resolt) resolve(1); }
    });
  });
}

/**
 * Registra el hook que demana X en marcar un estat parametritzat.
 * Cridar un cop a l'init (`forja.mjs`).
 */
export function registrarHookValorX() {
  Hooks.on("createActiveEffect", async (effect, options, userId) => {
    if (game.user.id !== userId) return;
    const estatId = [...(effect.statuses ?? [])][0];
    if (!ESTATS_PARAMETRITZATS.has(estatId)) return;
    if (effect.getFlag("forja", "valorX") != null) return; // ja en té (duplicat/programàtic)

    const nomEstat = FORJA.CATALEG_ESTATS.find(e => e.id === estatId)?.nom ?? estatId;
    const valor = await demanarValorX(nomEstat);
    const update = { "flags.forja.valorX": valor, name: `${effect.name} (${valor})` };
    if (estatId === "recuperacio") update["flags.forja.comptador"] = 0;
    await effect.update(update);
  });
}

/**
 * Aplica els tics de Sagnant/X i Recuperació/X sobre `actor` — cridar
 * quan comença el seu torn al rellotge de temps actiu.
 * @param {ForjaActor} actor
 */
export async function aplicarTicsEstats(actor) {
  if (!actor) return;

  // Sagnant/X: cada efecte actiu és una font de sagnat independent (p.ex.
  // dues ferides sagnants alhora) — es sumen totes abans d'aplicar-les en
  // un sol update, per no encadenar escriptures innecessàries.
  const efectesSagnant = actor.effects?.filter(e => e.statuses?.has("sagnant")) ?? [];
  const totalSagnant = efectesSagnant.reduce((s, e) => s + (e.getFlag("forja", "valorX") ?? 1), 0);
  if (totalSagnant > 0) {
    const abans = actor.system.salut.fatiga.marcats;
    await actor.update({ "system.salut.fatiga.marcats": Math.max(0, abans + totalSagnant) });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: game.i18n.format("FORJA.Estats.SagnantTic", { nom: actor.name, x: totalSagnant })
    });
  }

  for (const efecteRecuperacio of actor.effects?.filter(e => e.statuses?.has("recuperacio")) ?? []) {
    const x = efecteRecuperacio.getFlag("forja", "valorX") ?? 1;
    const comptadorNou = (efecteRecuperacio.getFlag("forja", "comptador") ?? 0) + 1;

    if (comptadorNou >= 8) {
      // Manual l. 3676–3680: primer la condició més greu, la fatiga si
      // empaten; des del nivell 7 (inconscient/incapacitat) es passa al 6.
      const salut = actor.system.salut;
      const pista = pistaRecuperacio(salut);
      await efecteRecuperacio.setFlag("forja", "comptador", 0);
      if (!pista) continue;
      const abans = salut[pista].marcats;
      await actor.update({ [`system.salut.${pista}.marcats`]: marcatsDespresRecuperacio(abans, salut[pista].perNivell, x) });
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: game.i18n.format("FORJA.Estats.RecuperacioTic", {
          nom: actor.name, x, pista: game.i18n.localize(`FORJA.Salut.${pista === "ferides" ? "Ferides" : "Fatiga"}`)
        })
      });
    } else {
      await efecteRecuperacio.setFlag("forja", "comptador", comptadorNou);
    }
  }
}

/**
 * Modificador net de latència pels estats Lent/X (+X) i Ràpid/X (−X)
 * actualment actius sobre `actor` (manual: es poden tenir tots dos alhora
 * si venen de causes diferents; es sumen algebraicament).
 * @param {ForjaActor} actor
 * @returns {number}
 */
export function modificadorLatenciaEstats(actor) {
  if (!actor) return 0;
  return sumaValorX(actor, "lent") - sumaValorX(actor, "rapid");
}
