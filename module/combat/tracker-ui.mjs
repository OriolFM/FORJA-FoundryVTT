import DiategDeclararAccio from "../apps/dialeg-declarar-accio.mjs";
import { ferTirada } from "../dice/tirada.mjs";
import { ferAtac, retardMaximBarallarse, limitarRetardBarallarse }  from "./atac.mjs";
import { opcionsDefensa, resoldreOpcioDefensa, opcionsInterposar } from "./defensa.mjs";
import { distanciaEntreTokens, bandaDistancia, tokensATocar, avantatgeAbastCosACos } from "./abast.mjs";
import { establirConcentracio } from "./reaccions.mjs";
// Atribut + habilitat d'atac d'una arma (Q1, manual FC001CA › SISTEMES ›
// Combat › Cos a cos / A Distància): taula canònica de WP-G.
import { atributIHabilitatAtac } from "./equipament-automatic.mjs";
import { decidirDefensa } from "./decisio-defensa.mjs";
import { movimentDelTorn, bonificacioCarrega, distanciesMoviment } from "./moviment.mjs";
import { metresMogutsAquestTorn } from "../documents/token.mjs";
import { modificadorLatenciaEstats } from "../estats/estats-parametritzats.mjs";
import { aplicarEfecteManiobra, resoldrePuntadaDePeuGiratoria, resoldreLlancament } from "./maniobres.mjs";
import { eliminarEmbegutsComGM } from "../xarxa/socket.mjs";

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
    // Lent/X i Ràpid/X (M-05, estats-parametritzats.mjs): modificador net
    // (+Lent -Ràpid) sobre qualsevol llatència d'aquest combatent.
    const modEstats = modificadorLatenciaEstats(actor);
    // Interrupció (maniobra d'Arts Marcials, maniobres.mjs): el Lent/2 que
    // aplica es "autoconsum" — un cop ja ha comptat per a AQUESTA
    // declaració (inclòs a `modEstats` de dalt), es retira perquè no
    // afecti la següent.
    const efectesAutoconsum = actor.effects?.filter(e => e.getFlag("forja", "autoconsum")) ?? [];
    if (efectesAutoconsum.length) {
      await eliminarEmbegutsComGM(actor, "ActiveEffect", efectesAutoconsum.map(e => e.id));
    }
    const potArtsMarcials = habilitat("arts-marcials") > 0;
    const armes = actor.items
      .filter(i => i.type === "arma")
      .map(i => {
        const { atribut, habId } = atributIHabilitatAtac(i);
        return {
          id:            i.id,
          nom:           i.name,
          latenciaTotal: Math.max(1, (sys.latenciaBase ?? 0) + (i.system.modLatencia ?? 0) + modEstats),
          atribut, atributVal: sys.atributs?.[atribut] ?? 0,
          habId, habNivell: habilitat(habId),
          // Arts marcials: només amb l'atac "Cop" i si l'actor en té l'habilitat
          // (manual › Cos a cos: "Arts Marcials (DES): el PJ fa servir moviments especials").
          permetManiobres: _esCop(i) && potArtsMarcials,
          // WP-M: la càrrega només amb armes cos a cos o naturals (manual l. 2794).
          categoria:     i.system.categoria ?? null,
          // B16: retard voluntari de barallar-se (fins al nivell d'habilitat).
          retardMax: retardMaximBarallarse({ habId }, habilitat("barallar-se"))
        };
      });

    // Font única de les opcions de defensa (B7): acció defensiva declarada.
    const defenses = opcionsDefensa(actor, undefined, { declarada: true });

    // Objectius possibles de l'atac: els altres combatents amb token a
    // l'escena. Es declaren ara (el manual declara l'acció completa) i
    // l'atac es resol contra aquest token, encara que s'hagi mogut.
    const objectius = _objectiusDeclarables(combat, combatant);

    const config = await DiategDeclararAccio.obrir({
      nom:          combatant.name,
      marcador:     combat.marcador ?? 0,
      posicioActual: combatant.initiative ?? "—",
      latenciaBase: Math.max(1, (sys.latenciaBase ?? 0) + modEstats),
      armes,
      defenses,
      maniobres:    CONFIG.FORJA?.LLISTA_MANIOBRES ?? [],
      concentrat:   !!sys.concentrat,
      distancies:   sys.moviment ?? distanciesMoviment(sys.atributs?.AGI ?? 0, sys.mida ?? 3),
      objectius,
      objectiuPerDefecte: _objectiuPerDefecte(objectius)
    });
    if (!config) return;

    // WP-M: si el combatent declara durant el seu propi torn, la nova acció
    // és per al proper torn; el moviment del torn en curs (el de l'acció que
    // s'està resolent) es conserva a `movimentEnCurs` perquè el permís de
    // moviment d'ara no canviï (vegeu `movimentDelTorn`, combat/moviment.mjs).
    const anterior = combatant.getFlag("forja", "accioPendent") ?? null;
    const actiuAra = (combat.combatentActiuId ?? combat.combatant?.id) === combatantId;
    const marcadorDeclaracio = combat.marcador ?? 0;

    await combat.declararAccio(combatantId, config.latencia);
    await establirConcentracio(actor, config.concentrar);

    // Desa l'acció declarada com a "pendent de resoldre" (DA-?): el botó de
    // resoldre obrirà directament la tirada corresponent, ja preseleccionada.
    let pendent = {
      tipus: config.tipus, etiqueta: config.etiqueta, descripcio: config.descripcio,
      // WP-M: moviment declarat (basic/rapid/especial/carrega) i on es va declarar.
      moviment: config.moviment ?? "basic",
      combatId: combat.id,
      declaradaAlMarcador: marcadorDeclaracio,
      movimentEnCurs: null
    };
    if (actiuAra && combat.started) {
      pendent.movimentEnCurs = movimentDelTorn(anterior, combat.id, marcadorDeclaracio);
    }
    if (config.tipus === "atac") {
      const arma = armes.find(a => a.id === config.armaId);
      if (arma) pendent = { ...pendent, ...arma, label: arma.nom };
      const objectiuDeclarat = objectius.find(o => o.tokenId === config.objectiuTokenId);
      if (objectiuDeclarat) {
        pendent = { ...pendent, objectiuTokenId: objectiuDeclarat.tokenId, objectiuNom: objectiuDeclarat.nom };
      }
      if (arma && config.retardBarallarse > 0 && !config.maniobraId) {
        pendent = { ...pendent, retardBarallarse: config.retardBarallarse, label: config.etiqueta };
      }
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
    // `setFlag` FUSIONA objectes: sense esborrar-la abans, claus d'una
    // declaració anterior (maniobraId, retardBarallarse, movimentEnCurs...)
    // quedarien a la nova acció.
    if (anterior) await combatant.unsetFlag("forja", "accioPendent");
    await combatant.setFlag("forja", "accioPendent", pendent);

    if (config.descripcio || config.etiqueta) {
      const concentra = config.concentrar ? ` <em>(${game.i18n.localize("FORJA.Combat.Concentrat")})</em>` : "";
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="forja-missatge-accio"><strong>${Handlebars.escapeExpression(config.etiqueta ?? "")}</strong>${concentra}${pendent.objectiuNom ? ` → ${Handlebars.escapeExpression(pendent.objectiuNom)}` : ""}${config.descripcio ? `<p>${Handlebars.escapeExpression(config.descripcio)}</p>` : ""}</div>`
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

    // WP-M: una acció de només moviment no té tirada: es fa movent el token.
    if (pendent?.tipus === "moviment") {
      ui.notifications?.info(game.i18n.format("FORJA.Moviment.ResoldreMoviment", { nom: combatant.name }));
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
      // L'objectiu és el declarat (si n'hi ha); si no, el marcat al canvas.
      const tokenObjectiu = _tokenObjectiuDeclarat(pendent) ?? [...game.user.targets][0];
      const objectiu      = tokenObjectiu?.actor;

      // Maniobres d'Arts Marcials (S-12/B6, maniobres.mjs): es trien en
      // declarar l'acció (`pendent.maniobraId`); el pool ja és DES + Arts
      // Marcials (vegeu #onDeclararAccio).
      const maniobra = pendent.maniobraId
        ? (CONFIG.FORJA?.LLISTA_MANIOBRES ?? []).find(m => m.id === pendent.maniobraId) ?? null
        : null;

      // Puntada de peu giratòria no necessita objectiu (és autocentrada).
      if (maniobra?.id === "puntada-de-peu-giratoria") {
        const tokenAtacant = combatant.token?.object;
        if (!tokenAtacant) return;
        // Nota: a diferència d'un atac normal, aquí NO s'ofereix la
        // opció d'interposar-se — combinar-la amb una puntada de peu
        // giratòria contra diversos objectius alhora és un cas que el
        // manual no contempla; es queda com a simplificació deliberada.
        const { resultats } = await resoldrePuntadaDePeuGiratoria({
          actor, tokenAtacant, arma, poolFinal, maniobra,
          demanarDefensa: async (obj) => {
            const categoriaAtac = arma.system.categoria ?? null;
            const decisio = await decidirDefensa({
              defensor: obj, opcions: opcionsDefensa(obj, undefined, { categoriaAtac }),
              categoriaAtac, nomAtacant: combatant.name
            });
            return decisio?.eleccio ?? null;
          }
        });
        for (const { objectiu: qui, eleccio, resultat } of resultats) {
          if (resultat.exit) await aplicarEfecteManiobra(maniobra, eleccio.interposant ?? qui);
        }
        return;
      }

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
        let poolFinalAtac = poolFinal;
        let bonusDauDefensa = 0;

        // Avantatge d'abast en cos a cos (manual p. 611, S-12): qui té
        // l'arma de major abast rep +1 dau tant a atacar com a defensar-se.
        if (arma.system.categoria !== "distancia") {
          const { atacantAvantatge, defensorAvantatge } = avantatgeAbastCosACos(arma, objectiu);
          if (atacantAvantatge) poolFinalAtac += 1;
          if (defensorAvantatge) bonusDauDefensa = 1;
        }

        if (tokenAtacant && tokenObjectiu) {
          const aTocar = tokensATocar(tokenAtacant, tokenObjectiu);

          if (arma.system.categoria === "distancia") {
            if (arma.system.abast > 0 || arma.system.rangMultFor > 0) {
              const distancia = distanciaEntreTokens(tokenAtacant, tokenObjectiu);
              const banda = bandaDistancia(distancia, arma, defensaBasica, aTocar, actor);
              if (!banda) {
                ui.notifications?.warn(game.i18n.format("FORJA.Combat.ForaAbast", { nom: objectiu.name }));
                return;
              }
              defensaBasica = banda.dificultat;
              etiquetaRang = game.i18n.localize(`FORJA.Combat.Rang.${banda.banda}`);
            }
            // Rang realment desconegut (abast=0 i rangMultFor=0, p. ex.
            // "Armes pesants" — "varia" segons l'arma concreta): no es
            // calcula banda automàticament, es manté la defensa bàsica.
          } else if (!aTocar) {
            ui.notifications?.warn(game.i18n.format("FORJA.Combat.ForaAbastCosACos", { nom: objectiu.name }));
            return;
          }
        }

        // Defensar els altres (manual p. 821-829, S-12): qualsevol altre
        // combatent a tocar de l'objectiu (no l'atacant, no l'objectiu
        // mateix) pot interposar-s'hi parant o blocant — reaprofita
        // `opcionsInterposar`, que ja filtra a parar/blocar únicament i
        // marca `interposant` amb l'actor que s'hi interposa.
        const protectors = [];
        if (tokenObjectiu) {
          for (const altre of combat.combatants) {
            if (altre.id === combatant.id || altre.actor?.id === objectiu.id) continue;
            const tokenAltre = altre.token?.object;
            if (!tokenAltre || !altre.actor) continue;
            if (!tokensATocar(tokenAltre, tokenObjectiu)) continue;
            protectors.push(altre.actor);
          }
        }

        // Flux complet d'atac contra un objectiu (S-12/S-13): primer es
        // resol la reacció defensiva de l'objectiu (passiva / esquivar /
        // parar / blocar / algú altre s'interposa — gastant reacció i, si
        // escau, tirant), i després es tira l'atac contra la dificultat
        // resultant.
        // B15: la categoria de l'arma atacant decideix amb què es pot blocar.
        const categoriaAtac = arma.system.categoria ?? null;
        const opcions = [
          ...opcionsDefensa(objectiu, defensaBasica, { categoriaAtac, bonusDauDefensa }),
          ...protectors.flatMap(p => opcionsInterposar(p, { categoriaAtac }))
        ];
        // Qui tria la defensa: la configuració automàtica del PNJ, el jugador
        // propietari del defensor o el DJ — mai el jugador que ataca un PNJ
        // (decisio-defensa.mjs; Oriol FM, 2026-09-27).
        const decisio = await decidirDefensa({
          defensor: objectiu, opcions, defensaBasica, categoriaAtac, bonusDauDefensa,
          protectors,
          nomAtacant: combatant.name
        });
        if (!decisio) return;
        const eleccio = decisio.eleccio;

        // Si s'ha triat interposar-se, qui rep la tirada/reacció I el dany
        // és el protector, no l'objectiu original.
        const qui = eleccio.interposant ?? objectiu;

        const resolucio = await resoldreOpcioDefensa(qui, eleccio, { nomAtacant: combatant.name });
        if (!resolucio) {
          ui.notifications?.warn(game.i18n.format("FORJA.Combat.SenseReaccioDisponible", { nom: qui.name }));
          return;
        }

        // B16: retard de barallar-se declarat (ja pagat en latència), limitat
        // al nivell ACTUAL de l'habilitat; no s'aplica amb maniobra.
        const retardBarallarse = (pendent.habId === "barallar-se" && !pendent.maniobraId)
          ? limitarRetardBarallarse(pendent.retardBarallarse, sys.habilitats?.["barallar-se"]?.nivell ?? 0)
          : 0;

        // WP-M: càrrega (manual l. 2794) — si el token s'ha mogut 2 m o més
        // aquest torn, +1 dau a l'atac i +1 al dany si impacta. Es mesura
        // l'historial de moviment del token (buidat a l'inici del torn).
        const movimentTorn = movimentDelTorn(pendent, combat.id, combat.marcador);
        const bonusCarrega = bonificacioCarrega(movimentTorn, metresMogutsAquestTorn(combatant.token));

        const resultatAtac = await ferAtac({
          actor,
          objectiu:   qui,
          arma,
          poolFinal:  poolFinalAtac,
          dificultat:      resolucio.dificultat,
          exigirSuperar:   resolucio.exigirSuperar,
          reduccioExtra:   resolucio.reduccioExtra,
          danyExtra:       resolucio.danyExtra ?? 0,
          retardBarallarse,
          bonusCarrega,
          etiquetaDefensa: eleccio.nomMitja ? `${eleccio.nom} (${eleccio.nomMitja})` : eleccio.nom,
          etiquetaRang,
          maniobra,
          label:      pendent.label
        });
        if (maniobra && resultatAtac.exit) await aplicarEfecteManiobra(maniobra, qui);
        if (maniobra?.id === "llancament" && resultatAtac.exit) {
          const combatantQui = combat.combatants.find(c => c.actor?.id === qui.id);
          const tokenQui = combatantQui?.token?.object ?? tokenObjectiu;
          await resoldreLlancament({ actorAtacant: combatant.actor, tokenAtacant, tokenObjectiu: tokenQui });
        }
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

/**
 * Combatents que es poden declarar com a objectiu d'un atac: els altres
 * combatents del combat amb token a l'escena actual. Inclou la distància vora
 * a vora (B9) i si són a tocar, per orientar qui declara.
 * @param {Combat} combat
 * @param {Combatant} combatant  Qui declara
 * @returns {Array<{tokenId:string, nom:string, distancia:number|null, aTocar:boolean, marcat:boolean}>}
 */
function _objectiusDeclarables(combat, combatant) {
  const tokenPropi = combatant.token?.object ?? null;
  const marcats = new Set([...game.user.targets].map(t => t.id));
  return combat.combatants
    .filter(c => c.id !== combatant.id && !c.isDefeated && c.token?.object)
    .map(c => {
      const token = c.token.object;
      const distancia = tokenPropi ? Math.round(distanciaEntreTokens(tokenPropi, token) * 10) / 10 : null;
      return {
        tokenId: token.id,
        nom:     c.name,
        distancia,
        aTocar:  tokenPropi ? tokensATocar(tokenPropi, token) : false,
        marcat:  marcats.has(token.id)
      };
    })
    .sort((a, b) => (a.distancia ?? Infinity) - (b.distancia ?? Infinity));
}

/** Objectiu preseleccionat: el marcat amb Target, o si no el més proper. */
function _objectiuPerDefecte(objectius) {
  return (objectius.find(o => o.marcat) ?? objectius[0])?.tokenId ?? null;
}

/**
 * Token de l'objectiu declarat a l'acció pendent, si encara és a l'escena.
 * Si ja no hi és, avisa i retorna `null` (es fa servir l'objectiu marcat).
 * @param {object} pendent
 * @returns {Token|null}
 */
function _tokenObjectiuDeclarat(pendent) {
  if (!pendent?.objectiuTokenId) return null;
  const token = canvas.tokens?.get(pendent.objectiuTokenId) ?? null;
  if (!token) {
    ui.notifications?.warn(game.i18n.format("FORJA.Combat.ObjectiuDeclaratNoTrobat", { nom: pendent.objectiuNom ?? "?" }));
  }
  return token;
}
