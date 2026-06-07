import DiategDeclararAccio from "../apps/dialeg-declarar-accio.mjs";
import { ferTirada } from "../dice/tirada.mjs";
import { ferAtac }  from "./atac.mjs";

const HAB_PER_CATEGORIA = {
  natural:   "barallar-se",
  cosAcos:   "armes-cos-a-cos",
  distancia: "armes-distancia"
};

/**
 * Extensió del Combat Tracker natiu (S-10): mostra la posició/tick de cada
 * combatent al rellotge de temps actiu i el marcador actual, i permet
 * declarar accions amb un diàleg que prefarceix la latència calculada.
 */
export default class ForjaCombatTracker extends foundry.applications.sidebar.tabs.CombatTracker {

  static DEFAULT_OPTIONS = {
    actions: {
      forjaDeclararAccio: ForjaCombatTracker.#onDeclararAccio,
      forjaMarcarEmboscada: ForjaCombatTracker.#onMarcarEmboscada,
      forjaResoldreAccio: ForjaCombatTracker.#onResoldreAccio
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
        <a class="forja-resoldre" data-action="forjaResoldreAccio" data-combatant-id="${combatantId}"
           title="${game.i18n.localize("FORJA.Combat.Resoldre")}">
          <i class="fas fa-dice-d10"></i>
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
    const habilitat = (id) => sys.habilitats?.[id]?.nivell ?? 0;
    const armes = combatant.actor.items
      .filter(i => i.type === "arma")
      .map(i => {
        const habId      = HAB_PER_CATEGORIA[i.system.categoria] ?? "barallar-se";
        const atribut    = i.system.categoria === "distancia" ? "DES" : "FOR";
        const atributVal = sys.atributs?.[atribut] ?? 0;
        return {
          id:            i.id,
          nom:           i.name,
          latenciaTotal: (sys.latenciaBase ?? 0) + (i.system.modLatencia ?? 0),
          atribut, atributVal,
          habId, habNivell: habilitat(habId)
        };
      });

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

    // Desa l'acció declarada com a "pendent de resoldre" (DA-?): el botó de
    // resoldre obrirà directament la tirada corresponent, ja preseleccionada.
    let pendent = { tipus: config.tipus, etiqueta: config.etiqueta, descripcio: config.descripcio };
    if (config.tipus === "atac") {
      const arma = armes.find(a => a.id === config.armaId);
      if (arma) pendent = { ...pendent, ...arma, label: arma.nom };
    } else if (config.tipus === "defensa") {
      const def = defenses.find(d => d.id === config.defensa?.id);
      if (def) pendent = { ...pendent, ...def, label: def.nom };
    }
    await combatant.setFlag("forja", "accioPendent", pendent);

    if (config.descripcio || config.etiqueta) {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: combatant.actor }),
        content: `<div class="forja-missatge-accio"><strong>${config.etiqueta ?? ""}</strong>${config.descripcio ? `<p>${config.descripcio}</p>` : ""}</div>`
      });
    }
  }

  /**
   * Resol l'acció prèviament declarada: si té una tirada associada (atac o
   * defensa esquivar/parar), obre directament el diàleg simplificat de tirada
   * (DiategTirada via ferTirada) amb l'opció ja seleccionada. Si és "blocar"
   * (sense tirada) o "altra acció", no hi ha tirada precalculada — per a
   * "altra acció" cal fer servir la fitxa del personatge.
   */
  static async #onResoldreAccio(event, target) {
    const combat = this.viewed;
    if (!combat) return;
    const combatantId = target.dataset.combatantId;
    const combatant   = combat.combatants.get(combatantId);
    if (!combatant?.actor) return;

    const pendent = combatant.getFlag("forja", "accioPendent");

    if (!pendent || pendent.tipus === "altra" || (pendent.tipus === "defensa" && pendent.senseTirada)) {
      if (pendent?.senseTirada) {
        ui.notifications?.info(game.i18n.format("FORJA.Combat.BlocarSenseAccio", { nom: combatant.name }));
      }
      combatant.actor.sheet?.render(true);
      return;
    }

    const poolFinal = (pendent.atributVal ?? 0) + (pendent.habNivell ?? 0);

    if (pendent.tipus === "atac") {
      const arma     = combatant.actor.items.get(pendent.id);
      const objectiu = [...game.user.targets][0]?.actor;

      if (arma && objectiu) {
        // Flux complet d'atac contra un objectiu (S-12): tira, compara amb la
        // seva defensa BÀSICA (passiva) i resol el dany. La defensa ACTIVA
        // (esquivar/parar com a reacció enfrontada) encara no s'orquestra
        // automàticament — caldrà fer-ho a banda fins que hi hagi aquest flux.
        await ferAtac({
          actor:      combatant.actor,
          objectiu,
          arma,
          poolFinal,
          dificultat: objectiu.system.defensa ?? 0,
          label:      pendent.label
        });
        return;
      }

      if (!objectiu) ui.notifications?.warn(game.i18n.localize("FORJA.Combat.SenseObjectiu"));
    }

    // Defensa activa (esquivar/parar) o atac sense objectiu seleccionat:
    // tirada simple, preseleccionada amb les dades de l'acció declarada.
    await ferTirada({
      actor:      combatant.actor,
      atribut:    pendent.atribut,
      atributVal: pendent.atributVal,
      habId:      pendent.habId,
      habNivell:  pendent.habNivell,
      label:      pendent.label
    });
  }

  /** Marca el combatent com a part de l'emboscada (acció simultània a la primera casella). */
  static async #onMarcarEmboscada(event, target) {
    const combat = this.viewed;
    if (!combat) return;
    await combat.marcarEmboscada(target.dataset.combatantId);
  }
}
