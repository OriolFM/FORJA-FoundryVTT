import DiategDeclararAccio from "../apps/dialeg-declarar-accio.mjs";

/**
 * Extensió del Combat Tracker natiu (S-10): mostra la posició/tick de cada
 * combatent al rellotge de temps actiu i el marcador actual, i permet
 * declarar accions amb un diàleg que prefarceix la latència calculada.
 */
export default class ForjaCombatTracker extends foundry.applications.sidebar.tabs.CombatTracker {

  static DEFAULT_OPTIONS = {
    actions: {
      forjaDeclararAccio: ForjaCombatTracker.#onDeclararAccio,
      forjaMarcarEmboscada: ForjaCombatTracker.#onMarcarEmboscada
    }
  };

  /** @override */
  async _prepareTrackerContext(context, options) {
    await super._prepareTrackerContext(context, options);

    const combat = this.viewed;
    if (!combat) return context;

    context.forjaMarcador = combat.marcador ?? 0;

    for (const turn of context.turns ?? []) {
      const combatant = combat.combatants.get(turn.id);
      turn.forjaPosicio = combatant?.initiative ?? null;
    }

    return context;
  }

  /** @override — afegeix els controls de FORJA a cada fila del tracker. */
  async _onRender(context, options) {
    await super._onRender(context, options);

    // FORJA no fa servir tirades d'iniciativa (S-10, rellotge de temps actiu):
    // s'eliminen els controls natius de "tirar iniciativa" (dau) de la
    // capçalera i de cada combatent, irrellevants en aquest sistema.
    const accionsIniciativa = ["rollInitiative", "rollAll", "rollNPC"];
    for (const accio of accionsIniciativa) {
      this.element.querySelectorAll(`[data-action="${accio}"]`).forEach(el => el.remove());
    }

    for (const li of this.element.querySelectorAll(".combatant")) {
      const combatantId = li.dataset.combatantId;
      const combatant   = this.viewed?.combatants?.get(combatantId);
      if (!combatant) continue;

      if (li.querySelector(".forja-controls")) continue;

      const div = document.createElement("div");
      div.classList.add("forja-controls");
      div.innerHTML = `
        <span class="forja-posicio" title="${game.i18n.localize("FORJA.Combat.PosicioActual")}">
          <i class="fas fa-clock"></i> ${combatant.initiative ?? "—"}
        </span>
        <a class="forja-declarar" data-action="forjaDeclararAccio" data-combatant-id="${combatantId}"
           title="${game.i18n.localize("FORJA.Combat.Declarar")}">
          <i class="fas fa-stopwatch"></i>
        </a>
        <a class="forja-emboscada" data-action="forjaMarcarEmboscada" data-combatant-id="${combatantId}"
           title="${game.i18n.localize("FORJA.Combat.MarcarEmboscada")}">
          <i class="fas fa-user-ninja"></i>
        </a>
      `;
      li.appendChild(div);
    }
  }

  /**
   * Obre el diàleg de declaració d'acció prefarcit amb la latència de l'actor
   * i suma el valor confirmat a la posició del combatent (S-10, DA-5).
   */
  static async #onDeclararAccio(event, target) {
    const combat = this.viewed;
    if (!combat) return;

    const combatantId = target.dataset.combatantId;
    const combatant   = combat.combatants.get(combatantId);
    if (!combatant?.actor) return;

    const sys   = combatant.actor.system;
    const armes = combatant.actor.items
      .filter(i => i.type === "arma")
      .map(i => ({
        id:            i.id,
        nom:           i.name,
        latenciaTotal: (sys.latenciaBase ?? 0) + (i.system.modLatencia ?? 0)
      }));

    const habilitat = (id) => sys.habilitats?.[id]?.nivell ?? 0;
    const defenses = [
      {
        id: "esquivar", nom: game.i18n.localize("FORJA.Combat.Defensa.Esquivar"),
        descripcio: game.i18n.localize("FORJA.Combat.Defensa.EsquivarDesc"),
        atribut: "AGI", atributVal: sys.atributs?.AGI ?? 0,
        habId: "esquivar", habNivell: habilitat("esquivar"),
        pool: (sys.atributs?.AGI ?? 0) + habilitat("esquivar")
      },
      {
        id: "parar", nom: game.i18n.localize("FORJA.Combat.Defensa.Parar"),
        descripcio: game.i18n.localize("FORJA.Combat.Defensa.PararDesc"),
        atribut: "DES", atributVal: sys.atributs?.DES ?? 0,
        habId: "armes-cos-a-cos", habNivell: habilitat("armes-cos-a-cos"),
        pool: (sys.atributs?.DES ?? 0) + habilitat("armes-cos-a-cos")
      },
      {
        id: "blocar", nom: game.i18n.localize("FORJA.Combat.Defensa.Blocar"),
        descripcio: game.i18n.localize("FORJA.Combat.Defensa.BlocarDesc"),
        senseTirada: true,
        reduccioExtra: habilitat("resistencia")
      }
    ];

    const config = await DiategDeclararAccio.obrir({
      nom:          combatant.name,
      marcador:     combat.marcador ?? 0,
      posicioActual: combatant.initiative ?? "—",
      latenciaBase: sys.latenciaBase ?? 0,
      armes,
      defenses
    });
    if (!config) return;

    await combat.declararAccio(combatantId, config.latencia);

    if (config.descripcio || config.etiqueta) {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: combatant.actor }),
        content: `<div class="forja-missatge-accio"><strong>${config.etiqueta ?? ""}</strong>${config.descripcio ? `<p>${config.descripcio}</p>` : ""}</div>`
      });
    }
  }

  /** Marca el combatent com a part de l'emboscada (acció simultània a la primera casella). */
  static async #onMarcarEmboscada(event, target) {
    const combat = this.viewed;
    if (!combat) return;
    await combat.marcarEmboscada(target.dataset.combatantId);
  }
}
