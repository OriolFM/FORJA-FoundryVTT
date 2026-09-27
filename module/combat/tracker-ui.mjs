import DiategDeclararAccio from "../apps/dialeg-declarar-accio.mjs";
import DiategDefensa from "../apps/dialeg-defensa.mjs";
import { ferTirada } from "../dice/tirada.mjs";
import { ferAtac }  from "./atac.mjs";
import { opcionsDefensa, resoldreOpcioDefensa } from "./defensa.mjs";
import { distanciaEntreTokens, bandaDistancia, tokensATocar } from "./abast.mjs";
import { establirConcentracio } from "./reaccions.mjs";
// Espai de noms (no import amb nom): `atributIHabilitatAtac` l'afegeix WP-G;
// si encara no hi és, es fa servir `_atacPerDefecte` sense trencar el mòdul.
import * as equipament from "./equipament-automatic.mjs";

/** Reserva local si `CONFIG.FORJA.HAB_PER_CATEGORIA` encara no existeix (D3/WP-G). */
const HAB_PER_CATEGORIA_LOCAL = {
  natural:   "barallar-se",
  cosAcos:   "armes-cos-a-cos",
  distancia: "armes-distancia"
};

/**
 * Atribut + habilitat d'atac d'una arma (Q1, manual FC001CA › SISTEMES ›
 * Combat › Cos a cos / A Distància). La taula canònica és
 * `atributIHabilitatAtac` (WP-G, `equipament-automatic.mjs`); aquesta reserva
 * només s'usa si encara no existeix: barallar-se/naturals FOR, armes cos a cos
 * DES, a distància DES.
 * @param {Item} item
 * @returns {{atribut:string, habId:string}}
 */
function _atributIHabilitat(item) {
  const r = equipament.atributIHabilitatAtac?.(item);
  if (r?.atribut) return r;
  const taula = CONFIG.FORJA?.HAB_PER_CATEGORIA ?? HAB_PER_CATEGORIA_LOCAL;
  const cat = item.system.categoria;
  return { atribut: cat === "natural" ? "FOR" : "DES", habId: taula[cat] ?? "barallar-se" };
}

/**
 * L'atac bàsic "Cop" (catàleg `cop`, `system.basic`), l'única arma natural
 * que admet maniobres d'arts marcials (manual › Cos a cos, taula "Armes
 * naturals": Cop — "Arts Marcials (+1 dificultat) — Escull un moviment").
 * @param {Item} item
 * @returns {boolean}
 */
function _esCop(item) {
  return item.flags?.forja?.catalegId === "cop" || !!item.system.basic;
}

/** L'usuari actual pot fer servir els controls de FORJA d'aquest combatent (C2). */
function _potControlar(combatant) {
  return game.user.isGM || !!combatant?.isOwner;
}

/**
 * Extensió del Combat Tracker natiu (S-10): mostra la posició/tick de cada
 * combatent al rellotge de temps actiu i el marcador actual, i permet
 * declarar accions amb un diàleg que prefarceix la latència calculada.
 *
 * C2: el marcador de temps es mostra a la capçalera i la posició de cada
 * combatent a la seva fila (visible per a tothom); els botons de declarar /
 * resoldre / emboscada només els veu el DJ o el propietari del combatent.
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

  /** @override — afegeix el marcador de temps i els controls de FORJA (C2). */
  async _onRender(context, options) {
    await super._onRender(context, options);

    // FORJA no fa servir tirades d'iniciativa (S-10, rellotge de temps actiu):
    // s'eliminen els controls natius de "tirar iniciativa" (dau) de la
    // capçalera i de cada combatent, irrellevants en aquest sistema.
    const accionsIniciativa = ["rollInitiative", "rollAll", "rollNPC"];
    for (const accio of accionsIniciativa) {
      this.element.querySelectorAll(`[data-action="${accio}"]`).forEach(el => el.remove());
    }

    const combat = this.viewed;
    if (!combat) return;
    const marcador = combat.marcador ?? 0;

    // Marcador de temps actiu, a la capçalera del tracker.
    this.element.querySelectorAll(".forja-marcador-temps").forEach(el => el.remove());
    const capcalera = this.element.querySelector(".combat-tracker-header")
      ?? this.element.querySelector("header");
    if (capcalera) {
      const div = document.createElement("div");
      div.classList.add("forja-marcador-temps");
      div.title = game.i18n.localize("FORJA.Combat.MarcadorDesc");
      div.innerHTML = `<i class="fas fa-clock"></i> ${game.i18n.localize("FORJA.Combat.MarcadorActual")}: <strong>${marcador}</strong>`;
      capcalera.appendChild(div);
    }

    for (const li of this.element.querySelectorAll(".combatant")) {
      const combatantId = li.dataset.combatantId;
      const combatant   = combat.combatants?.get(combatantId);
      if (!combatant) continue;
      if (li.querySelector(".forja-controls")) continue;

      const posicio = combatant.initiative;
      li.classList.toggle("forja-a-la-casella", posicio !== null && posicio !== undefined && posicio === marcador);

      const div = document.createElement("div");
      div.classList.add("forja-controls");

      const concentrat = combatant.actor?.system?.concentrat
        ? `<i class="fas fa-bullseye forja-concentrat" title="${game.i18n.localize("FORJA.Dice.Concentrat")}"></i>`
        : "";
      const retard = (typeof posicio === "number") ? posicio - marcador : null;
      const titolPosicio = game.i18n.localize("FORJA.Combat.PosicioActual")
        + (retard !== null && retard > 0 ? ` (${game.i18n.format("FORJA.Combat.TicksFins", { n: retard })})` : "");
      let html = `
        <span class="forja-posicio" title="${titolPosicio}">
          <i class="fas fa-clock"></i> ${posicio ?? "—"}
        </span>${concentrat}`;

      if (_potControlar(combatant)) {
        html += `
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
        </a>`;
      }
      div.innerHTML = html;
      li.appendChild(div);
    }
  }

  /**
   * Obre el diàleg de declaració d'acció prefarcit amb la latència de l'actor
   * i suma el valor confirmat a la posició del combatent (S-10, DA-5).
   * B1: un actor fora de combat (nivell 7) no pot declarar. B5: concentració.
   * B6: maniobres d'arts marcials. B7: defenses des de `opcionsDefensa`.
   */
  static async #onDeclararAccio(event, target) {
    const combat = this.viewed;
    if (!combat) return;

    const combatantId = target.dataset.combatantId;
    const combatant   = combat.combatants.get(combatantId);
    if (!combatant?.actor || !_potControlar(combatant)) return;

    const actor = combatant.actor;
    const sys   = actor.system;
    if (sys.salut?.foraDeCombat) {
      ui.notifications?.warn(game.i18n.format("FORJA.Combat.ForaDeCombat", { nom: actor.name }));
      return;
    }

    const habilitat = (id) => sys.habilitats?.[id]?.nivell ?? 0;
    const potArtsMarcials = habilitat("arts-marcials") > 0;
    const armes = actor.items
      .filter(i => i.type === "arma")
      .map(i => {
        const { atribut, habId } = _atributIHabilitat(i);
        return {
          id:            i.id,
          nom:           i.name,
          latenciaTotal: (sys.latenciaBase ?? 0) + (i.system.modLatencia ?? 0),
          atribut, atributVal: sys.atributs?.[atribut] ?? 0,
          habId, habNivell: habilitat(habId),
          // Arts marcials: només amb l'atac "Cop" i si l'actor en té l'habilitat
          // (manual › Cos a cos: "Arts Marcials (DES): el PJ fa servir moviments especials").
          permetManiobres: _esCop(i) && potArtsMarcials
        };
      });

    // Font única de les opcions de defensa (B7): acció defensiva declarada.
    const defenses = opcionsDefensa(actor, undefined, { declarada: true });

    const config = await DiategDeclararAccio.obrir({
      nom:          combatant.name,
      marcador:     combat.marcador ?? 0,
      posicioActual: combatant.initiative ?? "—",
      latenciaBase: sys.latenciaBase ?? 0,
      armes,
      defenses,
      maniobres:    CONFIG.FORJA?.LLISTA_MANIOBRES ?? [],
      concentrat:   !!sys.concentrat
    });
    if (!config) return;

    await combat.declararAccio(combatantId, config.latencia);
    await establirConcentracio(actor, config.concentrar);

    // Desa l'acció declarada com a "pendent de resoldre" (DA-?): el botó de
    // resoldre obrirà directament la tirada corresponent, ja preseleccionada.
    let pendent = { tipus: config.tipus, etiqueta: config.etiqueta, descripcio: config.descripcio };
    if (config.tipus === "atac") {
      const arma = armes.find(a => a.id === config.armaId);
      if (arma) pendent = { ...pendent, ...arma, label: arma.nom };
      if (arma && config.maniobraId) {
        // Maniobra d'arts marcials: la tirada és DES + Arts Marcials (manual ›
        // Cos a cos), no la de l'arma "Cop" (FOR + barallar-se).
        pendent = {
          ...pendent,
          maniobraId: config.maniobraId,
          atribut: "DES", atributVal: sys.atributs?.DES ?? 0,
          habId: "arts-marcials", habNivell: habilitat("arts-marcials"),
          label: config.etiqueta
        };
      }
    } else if (config.tipus === "defensa") {
      const def = defenses.find(d => d.id === config.defensa?.id);
      if (def) pendent = { ...pendent, ...def, label: def.nom };
    }
    await combatant.setFlag("forja", "accioPendent", pendent);

    if (config.descripcio || config.etiqueta) {
      const concentra = config.concentrar ? ` <em>(${game.i18n.localize("FORJA.Combat.Concentrat")})</em>` : "";
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="forja-missatge-accio"><strong>${Handlebars.escapeExpression(config.etiqueta ?? "")}</strong>${concentra}${config.descripcio ? `<p>${Handlebars.escapeExpression(config.descripcio)}</p>` : ""}</div>`
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
    if (!combatant?.actor || !_potControlar(combatant)) return;

    const actor   = combatant.actor;
    const sys     = actor.system;
    const pendent = combatant.getFlag("forja", "accioPendent");

    if (sys.salut?.foraDeCombat) {
      ui.notifications?.warn(game.i18n.format("FORJA.Combat.ForaDeCombat", { nom: actor.name }));
      return;
    }

    if (!pendent || pendent.tipus === "altra" || (pendent.tipus === "defensa" && pendent.senseTirada)) {
      if (pendent?.senseTirada) {
        ui.notifications?.info(game.i18n.format("FORJA.Combat.BlocarSenseAccio", { nom: combatant.name }));
      }
      actor.sheet?.render(true);
      return;
    }

    // Valors ACTUALS de l'actor (poden haver canviat des de la declaració).
    const atributVal = sys.atributs?.[pendent.atribut] ?? pendent.atributVal ?? 0;
    const habNivell  = pendent.habId ? (sys.habilitats?.[pendent.habId]?.nivell ?? pendent.habNivell ?? 0) : 0;
    const poolFinal  = atributVal + habNivell;

    if (pendent.tipus === "atac") {
      const arma          = actor.items.get(pendent.id);
      const tokenObjectiu = [...game.user.targets][0];
      const objectiu      = tokenObjectiu?.actor;

      if (arma && objectiu) {
        // Rang i abast (S-12): es llegeix la posició ACTUAL dels tokens al
        // canvas (el moviment el fa el DJ/jugador arrossegant el token,
        // Foundry ja ho gestiona nativament) i es tradueix a les regles de
        // FORJA. Si l'objectiu és fora d'abast, l'acció s'anul·la aquí —
        // sense tirada ni conseqüències — fins que es mogui el token i es
        // torni a resoldre, o es doni per perduda i es declari una de nova.
        // Distàncies vora a vora (B9).
        const tokenAtacant = combatant.token?.object;
        let defensaBasica = objectiu.system.defensa ?? 0;
        let etiquetaRang = null;

        if (tokenAtacant && tokenObjectiu) {
          const aTocar = tokensATocar(tokenAtacant, tokenObjectiu);

          if (arma.system.categoria === "distancia") {
            if (arma.system.abast > 0) {
              const distancia = distanciaEntreTokens(tokenAtacant, tokenObjectiu);
              const banda = bandaDistancia(distancia, arma, defensaBasica, aTocar);
              if (!banda) {
                ui.notifications?.warn(game.i18n.format("FORJA.Combat.ForaAbast", { nom: objectiu.name }));
                return;
              }
              defensaBasica = banda.dificultat;
              etiquetaRang = game.i18n.localize(`FORJA.Combat.Rang.${banda.banda}`);
            }
            // Si l'abast és variable (Rang limitat: FOR/FORx3/FORx5, abast=0),
            // no es calcula banda automàticament — es manté la defensa bàsica.
          } else if (!aTocar) {
            ui.notifications?.warn(game.i18n.format("FORJA.Combat.ForaAbastCosACos", { nom: objectiu.name }));
            return;
          }
        }

        // Flux complet d'atac contra un objectiu (S-12/S-13): primer es
        // resol la reacció defensiva de l'objectiu (passiva / esquivar /
        // parar / blocar — gastant reacció i, si escau, tirant), i després
        // es tira l'atac contra la dificultat resultant.
        const opcions = opcionsDefensa(objectiu, defensaBasica);
        const eleccio = await DiategDefensa.obrir({
          nomAtacant:  combatant.name,
          nomDefensor: objectiu.name,
          foraDeCombat: !!objectiu.system.salut?.foraDeCombat,
          opcions
        });
        if (!eleccio) return;

        const resolucio = await resoldreOpcioDefensa(objectiu, eleccio, { nomAtacant: combatant.name });
        if (!resolucio) {
          ui.notifications?.warn(game.i18n.format("FORJA.Combat.SenseReaccioDisponible", { nom: objectiu.name }));
          return;
        }

        const maniobra = pendent.maniobraId
          ? (CONFIG.FORJA?.LLISTA_MANIOBRES ?? []).find(m => m.id === pendent.maniobraId) ?? null
          : null;

        await ferAtac({
          actor,
          objectiu,
          arma,
          poolFinal,
          dificultat:      resolucio.dificultat,
          exigirSuperar:   resolucio.exigirSuperar,
          reduccioExtra:   resolucio.reduccioExtra,
          etiquetaDefensa: eleccio.nom,
          etiquetaRang,
          maniobra,
          label:      pendent.label
        });
        return;
      }

      if (!objectiu) ui.notifications?.warn(game.i18n.localize("FORJA.Combat.SenseObjectiu"));
    }

    // Defensa activa (esquivar/parar) o atac sense objectiu seleccionat:
    // tirada simple, preseleccionada amb les dades de l'acció declarada.
    await ferTirada({
      actor,
      atribut:    pendent.atribut,
      atributVal,
      habId:      pendent.habId,
      habNivell,
      label:      pendent.label
    });
  }

  /** Marca el combatent com a part de l'emboscada (acció simultània a la primera casella). */
  static async #onMarcarEmboscada(event, target) {
    const combat = this.viewed;
    if (!combat) return;
    if (!_potControlar(combat.combatants.get(target.dataset.combatantId))) return;
    await combat.marcarEmboscada(target.dataset.combatantId);
  }
}
