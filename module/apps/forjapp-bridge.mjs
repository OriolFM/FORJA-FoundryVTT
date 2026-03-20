/**
 * ForjAppBridge — Connector entre Foundry VTT i la BBDD Firestore de FORJApp.
 *
 * Delega totes les operacions Firestore a forjapp-service.mjs, que carrega
 * el Firebase SDK des de CDN i gestiona l'autenticació correctament.
 *
 * Flux d'autenticació:
 *   1. _ensureSignedIn() comprova si hi ha sessió activa (inclòs sessió persistent
 *      restaurada automàticament des de localStorage per Firebase SDK).
 *   2. Si no hi ha sessió, obre auth.html amb un sessionId únic i mostra un
 *      diàleg d'espera a Foundry.
 *   3. auth.html fa el login de Google i escriu els tokens a Firestore
 *      authSessions/{sessionId}.
 *   4. Foundry fa polling cada 2 s fins a trobar el document, el llegeix,
 *      l'esborra i autentica l'usuari. El diàleg d'espera es tanca sol.
 */

// Importem el service de manera lazy (no al cargar el mòdul)
async function _svc() {
  return import("../import/forjapp-service.mjs");
}

export class ForjAppBridge {

  // ── Autenticació ──────────────────────────────────────────────────────

  /**
   * Comprova si l'usuari té sessió activa a FORJApp.
   * Inicialitza Firebase si cal (restaura sessió persistent de localStorage).
   * @returns {Promise<object|null>} user o null
   */
  static async getCurrentUser() {
    const svc = await _svc();
    return svc.getCurrentUser();
  }

  /**
   * Assegura que l'usuari té sessió activa.
   * Si no, inicia el flux d'autenticació via Firestore polling:
   *   - Obre auth.html en una finestra emergent
   *   - Mostra un diàleg d'espera a Foundry
   *   - Polling automàtic fins que auth.html escriu a authSessions/
   * @throws {Error} si l'usuari cancel·la o el temps s'esgota
   * @returns {Promise<object>} user
   */
  static async _ensureSignedIn() {
    const svc = await _svc();

    // Inicialitzar Firebase i restaurar sessió persistent si existeix
    await svc.preload();

    const user = await svc.getCurrentUser();
    if (user) return user;

    // Cap sessió activa — iniciar flux de polling
    return this._showAuthWaiting(svc);
  }

  /**
   * Mostra el diàleg d'espera i fa polling a Firestore fins que
   * auth.html escriu els tokens a authSessions/{sessionId}.
   */
  static async _showAuthWaiting(svc) {
    const sessionId = foundry.utils.randomID(20);
    const apiKey    = game.settings.get("forja", "forjappApiKey") ?? "";
    const authUrl   = `/systems/forja/auth.html?session=${sessionId}&key=${encodeURIComponent(apiKey)}`;

    const cancelSignal = { cancelled: false };

    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (fn, val) => {
        if (settled) return;
        settled = true;
        fn(val);
      };

      const dlg = new Dialog({
        title: game.i18n.localize("FORJA.Auth.WaitingTitle"),
        content: `
          <div style="padding:12px 0;text-align:center">
            <p>
              <i class="fas fa-spinner fa-spin" style="margin-right:6px"></i>
              ${game.i18n.localize("FORJA.Auth.WaitingMessage")}
            </p>
            <p style="font-size:0.85em;color:#aaa;margin-top:8px">
              ${game.i18n.localize("FORJA.Auth.WaitingHint")}
            </p>
          </div>`,
        buttons: {
          cancel: {
            icon:  '<i class="fas fa-times"></i>',
            label: game.i18n.localize("Cancel"),
            callback: () => {
              cancelSignal.cancelled = true;
              settle(reject, new Error(game.i18n.localize("FORJA.Auth.Cancelled")));
            }
          }
        },
        close: () => {
          cancelSignal.cancelled = true;
          settle(reject, new Error(game.i18n.localize("FORJA.Auth.Cancelled")));
        }
      }, { classes: ["dialog", "forja-dialog"], width: 420 });

      dlg.render(true);

      // Obrir la finestra d'autenticació
      window.open(authUrl, "forja-auth", "width=500,height=600,menubar=no,toolbar=no,location=no");

      // Polling fins que auth.html escriu el document
      svc.authenticateViaPolling(sessionId, cancelSignal)
        .then(user => {
          settle(resolve, user);
          dlg.close();
        })
        .catch(err => {
          settle(reject, err);
          dlg.close();
        });
    });
  }

  // ── Conversió Actor Foundry → JSON FORJApp ────────────────────────────

  static _actorToForjApp(actor, userId) {
    const sys = actor.system;
    const now = new Date().toISOString();
    const forjappId = actor.getFlag("forja", "forjappId") ?? foundry.utils.randomID(20);

    const typeMap = { character: "PJ", npc: "PNJ", creature: "Criatura", animal: "Animal" };

    const skills = actor.items
      .filter(i => i.type === "skill")
      .map(i => ({
        skillId: i.system.skillId,
        level: i.system.level,
        ...(i.system.notes ? { notes: i.system.notes } : {})
      }));

    const traits = actor.items
      .filter(i => i.type === "trait")
      .map(i => ({
        traitId: i.system.traitId,
        ...(i.system.level ? { level: i.system.level } : {}),
        ...(i.system.variantCost ? { variantCost: i.system.variantCost } : {}),
        ...(i.system.notes ? { notes: i.system.notes } : {})
      }));

    const weapons = actor.items
      .filter(i => i.type === "weapon")
      .map(i => ({ id: i.id, name: i.name, ...i.system.toObject?.() ?? { ...i.system } }));

    const armorItem = actor.items.find(i => i.type === "armor" && i.system.equipped);
    const equippedArmor = armorItem ? {
      id: armorItem.id,
      name: armorItem.name,
      protection: armorItem.system.protection ?? 0,
      latencyMod: armorItem.system.latencyMod ?? 0
    } : undefined;

    const artifacts = actor.items
      .filter(i => i.type === "artifact")
      .map(i => ({ id: i.id, name: i.name, ...i.system.toObject?.() ?? { ...i.system } }));

    const supernaturalEffects = actor.items
      .filter(i => i.type === "supernaturalEffect")
      .map(i => ({ id: i.id, name: i.name, ...i.system.toObject?.() ?? { ...i.system } }));

    const data = {
      id: forjappId,
      characterType: typeMap[actor.type] ?? "PJ",
      userId,
      playerName: game.user.name,
      playerAlias: game.user.name,
      createdAt: actor.getFlag("forja", "forjappCreatedAt") ?? now,
      updatedAt: now,
      isUserCreated: true,
      name: actor.name,
      totalPoints: sys.totalPoints ?? 200,
      species: sys.species ?? "humanoid",
      size: sys.size ?? 3,
      constitution: sys.constitution ?? 3,
      attributes: {
        FOR: sys.attributes.FOR.value,
        DES: sys.attributes.DES.value,
        AGI: sys.attributes.AGI.value,
        PER: sys.attributes.PER.value,
        INT: sys.attributes.INT.value,
        APL: sys.attributes.APL.value
      },
      defense: sys.defense ?? 0,
      latency: sys.latency ?? 10,
      damageReduction: sys.damageReduction ?? 0,
      reaction: sys.reaction ?? 1,
      currentWounds: sys.health.wounds.value,
      maxWounds: sys.health.wounds.max,
      currentFatigue: sys.health.fatigue.value,
      maxFatigue: sys.health.fatigue.max,
      woundLevel: sys.woundLevel ?? "illes",
      fatigueLevel: sys.fatigueLevel ?? "reposat",
      skills,
      traits,
      weapons,
      artifacts,
      supernaturalEffects,
      effects: []
    };

    if (equippedArmor) data.equippedArmor = equippedArmor;

    // Camps exclusius de character
    if (actor.type === "character") {
      if (sys.concept) data.concept = sys.concept;
      if (sys.origin)  data.origin  = sys.origin;
      if (sys.gender)  data.gender  = sys.gender;
      if (sys.age)     data.age     = sys.age;
      if (sys.resources) data.resources = sys.resources;
      if (sys.guanxi)    data.guanxi    = sys.guanxi;
      if (sys.notes)     data.notes     = sys.notes;
    }

    return data;
  }

  // ── API pública ───────────────────────────────────────────────────────

  /**
   * Desa un Actor de Foundry a FORJApp (crea o sobreescriu).
   * Si no hi ha sessió activa, inicia el flux d'autenticació automàtic.
   * @param {Actor} actor
   * @returns {Promise<string>} forjappId
   */
  static async saveCharacter(actor) {
    const user = await this._ensureSignedIn();
    const svc  = await _svc();

    const data = this._actorToForjApp(actor, user.uid);
    await svc.saveCharacter(data);

    await actor.setFlag("forja", "forjappId", data.id);
    await actor.setFlag("forja", "forjappCreatedAt", data.createdAt);
    await actor.setFlag("forja", "forjappUpdatedAt", data.updatedAt);

    ui.notifications.info(
      game.i18n.format("FORJA.Notifications.SavedToForjApp", { name: actor.name })
    );
    return data.id;
  }

  /**
   * Carrega un personatge de FORJApp i crea un Actor nou a Foundry.
   * @param {string} forjappId - ID del document a Firestore
   * @returns {Promise<Actor>}
   */
  static async loadCharacter(forjappId) {
    const user = await this._ensureSignedIn();
    const svc  = await _svc();

    const chars    = await svc.getUserCharacters(user.uid);
    const charData = chars.find(c => c.id === forjappId);
    if (!charData) throw new Error(`Personatge ${forjappId} no trobat`);

    const { default: CharacterImporter } = await import("./character-importer.mjs");
    const actor = await CharacterImporter.importFromJSON(charData);

    await actor.setFlag("forja", "forjappId", forjappId);
    await actor.setFlag("forja", "forjappCreatedAt", charData.createdAt);

    ui.notifications.info(
      game.i18n.format("FORJA.Notifications.LoadedFromForjApp", { name: actor.name })
    );
    return actor;
  }

  /**
   * Llista els personatges de l'usuari actual a FORJApp.
   * Si no hi ha sessió activa, inicia el flux d'autenticació automàtic.
   * @returns {Promise<object[]>} Array de JSON de personatge
   */
  static async listUserCharacters() {
    const user = await this._ensureSignedIn();
    const svc  = await _svc();
    return svc.getUserCharacters(user.uid);
  }

  /**
   * Llista les plantilles públiques del sistema.
   * @returns {Promise<object[]>}
   */
  static async listSystemCharacters() {
    const svc = await _svc();
    return svc.getSystemCharacters();
  }
}
