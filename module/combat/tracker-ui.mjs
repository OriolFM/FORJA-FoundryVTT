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
import { restriccionsEstats, tipusAccioBloquejats } from "../estats/regles-estats.mjs";
import { restriccionsActor, comprovarEstat, tirarEstat } from "../estats/aplicacio-estats.mjs";
import { manifestarIAplicar, usarArtefacte, objectiusMarcats } from "./usar-efecte.mjs";
import DiategManifestar from "../apps/dialeg-manifestar.mjs";
import { modesDisponibles, regleArea, MODES_TRET } from "./modes-tret.mjs";
import { atacArea, combinacio, contraatacar } from "./atac-multi.mjs";
import { aplicarEfecteManiobra, resoldrePuntadaDePeuGiratoria, resoldreLlancament } from "./maniobres.mjs";
import { eliminarEmbegutsComGM } from "../xarxa/socket.mjs";
import { teProprietat } from "./propietats.mjs";
import { etiquetarObjectius, marcarObjectiu } from "./objectius.mjs";
import {
  tirarDefensaCompleta, desarDefensaCompleta, defensaCompletaDe, combatantDe, resolucioDefensaCompleta
} from "./defensa-completa.mjs";

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
      forjaResoldreAccio: ForjaCombatTracker.#onResoldreAccio,
      forjaAvancarTemps: ForjaCombatTracker.#onAvancarTemps
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

    // Capçalera: el títol natiu ("Round N", irrellevant a FORJA) passa a ser
    // el tic del rellotge de temps actiu (o la fase de declaració), i el DJ hi
    // té el botó d'avançar el temps fins a la propera casella ocupada.
    this.element.querySelectorAll(".forja-marcador-temps, .forja-avancar-temps").forEach(el => el.remove());
    const titol = this.element.querySelector(".encounter-title");
    const textTitol = combat.fase === "declaracio"
      ? game.i18n.localize("FORJA.Combat.FaseDeclaracio")
      : (combat.started ? game.i18n.format("FORJA.Combat.Tic", { n: marcador }) : null);
    if (titol && textTitol) {
      titol.textContent = textTitol;
      titol.title = game.i18n.localize("FORJA.Combat.MarcadorDesc");
    }
    if (game.user.isGM && combat.started && titol) {
      const potAvancar = _potAvancarTemps(combat);
      const boto = document.createElement("button");
      boto.type = "button";
      boto.dataset.action = "forjaAvancarTemps";
      boto.className = "forja-avancar-temps inline-control" + (potAvancar ? " forja-destacat" : "");
      boto.disabled = !potAvancar;
      boto.title = game.i18n.localize(potAvancar ? "FORJA.Combat.AvancarTemps" : "FORJA.Combat.AvancarTempsEspera");
      boto.innerHTML = `<i class="fas fa-forward-step"></i> ${game.i18n.localize("FORJA.Combat.AvancarTempsCurt")}`;
      titol.insertAdjacentElement("afterend", boto);
    }

    for (const li of this.element.querySelectorAll(".combatant")) {
      const combatantId = li.dataset.combatantId;
      const combatant   = combat.combatants?.get(combatantId);
      if (!combatant) continue;
      if (li.querySelector(".forja-controls")) continue;

      const posicio = combatant.initiative;
      li.classList.toggle("forja-a-la-casella", posicio !== null && posicio !== undefined && posicio === marcador);
      // Només qui ha d'actuar ara apareix habilitat (manual › Temps actiu).
      const habilitat = _estaHabilitat(combat, combatant);
      li.classList.toggle("forja-inactiu", !habilitat);

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
        const destacar = _iconaDestacada(combat, combatant);
        html += `
        <a class="forja-declarar${destacar === "declarar" ? " forja-destacat" : ""}${habilitat ? "" : " forja-deshabilitat"}" data-action="forjaDeclararAccio" data-combatant-id="${combatantId}"
           title="${game.i18n.localize("FORJA.Combat.Declarar")}">
          <i class="fas fa-stopwatch"></i>
        </a>
        <a class="forja-resoldre${destacar === "resoldre" ? " forja-destacat" : ""}${_potResoldre(combat, combatant) ? "" : " forja-deshabilitat"}" data-action="forjaResoldreAccio" data-combatant-id="${combatantId}"
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
    if (!_estaHabilitat(combat, combatant)) {
      ui.notifications?.warn(game.i18n.format("FORJA.Combat.NoEsElSeuTorn", { nom: combatant.name }));
      return;
    }

    const actor = combatant.actor;
    const sys   = actor.system;
    if (sys.salut?.foraDeCombat) {
      ui.notifications?.warn(game.i18n.format("FORJA.Combat.ForaDeCombat", { nom: actor.name }));
      return;
    }

    // Estats (Fase 1): qui no pot actuar no declara. Marejat (manual l. 3644):
    // pot provar de vèncer el mareig amb una tirada; si la supera, declara.
    let restriccions = restriccionsActor(actor);
    if (!restriccions.potActuar) {
      if (restriccions.motiuActuar !== "marejat") {
        comprovarEstat(actor, restriccions.motiuActuar, "FORJA.Estats.Accio.Declarar");
        return;
      }
      const tirada = await tirarEstat(actor, "marejat");
      if (!tirada?.exit) return;
      restriccions = restriccionsEstats([...actor.statuses].filter(id => id !== "marejat"));
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
          // Fase 6: modes de tret (ràfega, automàtic) i atacs d'àrea.
          modes:         modesDisponibles(i.system.propietats ?? []),
          area:          !!regleArea(i.system.propietats ?? []),
          // B16: retard voluntari de barallar-se (fins al nivell d'habilitat).
          retardMax: retardMaximBarallarse({ habId }, habilitat("barallar-se"))
        };
      });

    // Fase 3: efectes que es poden manifestar en temps actiu (no rituals ni
    // només narratius, manual › Ús, l. 4796) i artefactes que s'activen
    // (no sempre actius ni d'activació complexa).
    const efectes = sys.dotat ? actor.items
      .filter(i => i.type === "efecte" && i.system.us?.actiu !== false && i.system.tipus !== "ritual")
      .map(i => ({ id: i.id, nom: i.name, dificultat: i.system.dificultat, modLatencia: i.system.modLatencia ?? 0 })) : [];
    const artefactes = actor.items
      .filter(i => i.type === "artefacte" && ["normal", "trivial"].includes(i.system.activacio?.tipus) && i.system.us?.actiu !== false && !i.system.construccio?.permanent)
      .map(i => ({ id: i.id, nom: i.name, modLatencia: i.system.us?.modLatencia ?? 0 }));

    // Font única de les opcions de defensa (B7): acció defensiva declarada.
    const defenses = opcionsDefensa(actor, undefined, { declarada: true });

    // Objectius possibles de l'atac: els altres combatents amb token a
    // l'escena. Es declaren ara (el manual declara l'acció completa) i
    // l'atac es resol contra aquest token, encara que s'hagi mogut.
    const objectius = _objectiusDeclarables(combat, combatant);
    // Última declaració d'aquest combatent en aquest combat (valors per defecte).
    const ultima = combatant.getFlag("forja", "ultimaDeclaracio") ?? null;

    const config = await DiategDeclararAccio.obrir({
      nom:          combatant.name,
      marcador:     combat.marcador ?? 0,
      posicioActual: combatant.initiative ?? "—",
      latenciaBase: Math.max(1, (sys.latenciaBase ?? 0) + modEstats),
      armes,
      defenses,
      maniobres:    CONFIG.FORJA?.LLISTA_MANIOBRES ?? [],
      efectes, artefactes,
      concentrat:   !!sys.concentrat,
      distancies:   sys.moviment ?? distanciesMoviment(sys.atributs?.AGI ?? 0, sys.mida ?? 3),
      objectius,
      objectiuPerDefecte: _objectiuPerDefecte(objectius, ultima?.objectiuTokenId),
      ultima,
      // Estats (Fase 1): tipus d'acció i moviments que no es poden triar.
      restriccions,
      bloquejats:   tipusAccioBloquejats(restriccions),
      onBloqueig:   (estat) => comprovarEstat(actor, estat, "FORJA.Estats.Accio.Declarar"),
      nomsEstats:   Object.fromEntries([...actor.statuses].map(id => [id, game.i18n.localize(`FORJA.Estat.${id}`)]))
    });
    if (!config) return;
    await combatant.setFlag("forja", "ultimaDeclaracio", {
      tipus: config.tipus, armaId: config.armaId, maniobraId: config.maniobraId,
      defensaId: config.defensa?.id ?? ultima?.defensaId ?? null,
      moviment: config.moviment, retard: config.retardBarallarse ?? 0,
      objectiuTokenId: config.objectiuTokenId ?? ultima?.objectiuTokenId ?? null,
      modeTret: config.modeTret ?? null, dimMak: config.dimMak ?? null,
      efecteId: config.efecteId ?? ultima?.efecteId ?? null,
      artefacteId: config.artefacteId ?? ultima?.artefacteId ?? null
    });

    // WP-M: si el combatent declara durant el seu propi torn, la nova acció
    // és per al proper torn; el moviment del torn en curs (el de l'acció que
    // s'està resolent) es conserva a `movimentEnCurs` perquè el permís de
    // moviment d'ara no canviï (vegeu `movimentDelTorn`, combat/moviment.mjs).
    const anterior = combatant.getFlag("forja", "accioPendent") ?? null;
    const actiuAra = (combat.combatentActiuId ?? combat.combatant?.id) === combatantId;
    const marcadorDeclaracio = combat.marcador ?? 0;

    await combat.declararAccio(combatantId, config.latencia);
    // Defensa completa: sempre concentrada, però el dau es suma a la tirada de
    // defensa que es fa ara mateix (defensa-completa.mjs), no a una acció futura.
    await establirConcentracio(actor, config.tipus === "defensa" ? false : config.concentrar);
    // Declarar la propera acció tanca el torn: la defensa completa anterior s'acaba.
    await desarDefensaCompleta(combatant, null);

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
      // Fase 6: mode de tret i Dim Mak.
      if (config.modeTret) pendent = { ...pendent, modeTret: config.modeTret };
      if (config.dimMak) pendent = { ...pendent, dimMak: config.dimMak };
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
    } else if (config.tipus === "manifestar" || config.tipus === "artefacte") {
      pendent = { ...pendent, efecteId: config.efecteId ?? null, artefacteId: config.artefacteId ?? null, label: config.etiqueta };
      const objectiuDeclarat = objectius.find(o => o.tokenId === config.objectiuTokenId);
      if (objectiuDeclarat) pendent = { ...pendent, objectiuTokenId: objectiuDeclarat.tokenId, objectiuNom: objectiuDeclarat.nom };
    } else if (config.tipus === "defensa") {
      const def = defenses.find(d => d.id === config.defensa?.id);
      if (def) pendent = { ...pendent, ...def, label: def.nom };
      // La tirada de defensa es fa en declarar i val per a tots els atacs
      // fins al final del seu torn.
      await desarDefensaCompleta(combatant, await tirarDefensaCompleta(actor, def, combat));
    }
    // `setFlag` FUSIONA objectes: sense esborrar-la abans, claus d'una
    // declaració anterior (maniobraId, retardBarallarse, movimentEnCurs...)
    // quedarien a la nova acció.
    if (anterior) await combatant.unsetFlag("forja", "accioPendent");
    await combatant.setFlag("forja", "accioPendent", pendent);
    // Fase 6: Contraatac (› Arts marcials): es posa en guàrdia fins al seu torn.
    if (config.tipus === "atac" && config.maniobraId === "contraatac") {
      await combatant.setFlag("forja", "contraatac", { combatId: combat.id, armaId: config.armaId });
    } else if (combatant.getFlag("forja", "contraatac")) {
      await combatant.unsetFlag("forja", "contraatac");
    }
    // Si declara durant el seu propi torn, la nova acció és per al proper:
    // ja només li queda passar el torn (icona destacada, `_iconaDestacada`).
    if (actiuAra && combat.started) await combatant.setFlag("forja", "estatTorn", "redeclarada");
    else await combatant.unsetFlag("forja", "estatTorn");

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
    if (!_potResoldre(combat, combatant)) {
      ui.notifications?.warn(game.i18n.format("FORJA.Combat.NoEsElSeuTorn", { nom: combatant.name }));
      return;
    }

    const actor   = combatant.actor;
    const sys     = actor.system;
    const pendent = combatant.getFlag("forja", "accioPendent");

    if (sys.salut?.foraDeCombat) {
      ui.notifications?.warn(game.i18n.format("FORJA.Combat.ForaDeCombat", { nom: actor.name }));
      return;
    }

    // Estats (Fase 1): qui no pot actuar no resol; i si un estat guanyat
    // després de declarar impedeix aquesta acció (p. ex. acovardit i un atac),
    // l'acció es perd.
    const restriccions = restriccionsActor(actor);
    if (!comprovarEstat(actor, restriccions.motiuActuar, "FORJA.Estats.Accio.Actuar")) return;
    const bloqueigTipus = pendent?.tipus ? tipusAccioBloquejats(restriccions)[pendent.tipus] : null;
    if (bloqueigTipus) {
      comprovarEstat(actor, bloqueigTipus, "FORJA.Estats.Accio.Resoldre");
      await _marcarResolta(combat, combatant);
      return;
    }

    // WP-M: una acció de només moviment no té tirada: es fa movent el token.
    if (pendent?.tipus === "moviment") {
      ui.notifications?.info(game.i18n.format("FORJA.Moviment.ResoldreMoviment", { nom: combatant.name }));
      await _marcarResolta(combat, combatant);
      return;
    }

    // Fase 3: manifestar un efecte o activar un artefacte declarats. Els
    // objectius són el declarat (si n'hi ha) o els marcats al canvas.
    if (pendent?.tipus === "manifestar" || pendent?.tipus === "artefacte") {
      const tokenDeclarat = _tokenObjectiuDeclarat(pendent);
      const objectius = tokenDeclarat?.actor ? [tokenDeclarat.actor] : objectiusMarcats();
      if (pendent.tipus === "artefacte") {
        const item = actor.items.get(pendent.artefacteId);
        if (!item) return;
        await usarArtefacte(actor, item, { objectius });
      } else {
        const eleccio = await DiategManifestar.obrir({
          nomActor: actor.name,
          donNom:   game.i18n.localize(`FORJA.Sobrenatural.Do.${sys.dotat}`),
          eqActual: sys.equilibri.actual,
          eqMax:    sys.equilibri.max,
          nomObjectiu: objectius.map(o => o.name).join(", ") || null,
          efectes:  actor.items.filter(i => i.type === "efecte").map(i => ({ id: i.id, nom: i.name, tipus: i.system.tipus, dificultat: i.system.dificultat })),
          efectePerDefecte: pendent.efecteId
        });
        if (!eleccio) return;
        await manifestarIAplicar(actor, eleccio, { objectius });
      }
      await _marcarResolta(combat, combatant);
      return;
    }

    // Defensa completa: ja es va tirar en declarar; al seu torn només declara.
    if (pendent?.tipus === "defensa") {
      ui.notifications?.info(game.i18n.format("FORJA.Combat.DefensaCompletaJaTirada", { nom: combatant.name }));
      await _marcarResolta(combat, combatant);
      return;
    }

    if (!pendent || pendent.tipus === "altra" || (pendent.tipus === "defensa" && pendent.senseTirada)) {
      if (pendent?.senseTirada) {
        ui.notifications?.info(game.i18n.format("FORJA.Combat.BlocarSenseAccio", { nom: combatant.name }));
      }
      actor.sheet?.render(true);
      if (pendent) await _marcarResolta(combat, combatant);
      return;
    }

    // Valors ACTUALS de l'actor (poden haver canviat des de la declaració).
    const atributVal = sys.atributs?.[pendent.atribut] ?? pendent.atributVal ?? 0;
    const habNivell  = pendent.habId ? (sys.habilitats?.[pendent.habId]?.nivell ?? pendent.habNivell ?? 0) : 0;
    const poolFinal  = atributVal + habNivell;

    if (pendent.tipus === "atac") {
      const arma          = actor.items.get(pendent.id);

      // Fase 6: Contraatac declarat. En arribar el seu torn, ja ha actuat
      // (si l'han atacat i ha parat o blocat, ja ha contraatacat).
      if (pendent.maniobraId === "contraatac") {
        await combatant.unsetFlag("forja", "contraatac");
        ui.notifications?.info(game.i18n.format("FORJA.Combat.ContraatacFinal", { nom: combatant.name }));
        await _marcarResolta(combat, combatant);
        return;
      }
      // Fase 6: armes feixugues (› A Distància): no disparen si s'ha mogut.
      if (arma && teProprietat(arma, "feixuga") && metresMogutsAquestTorn(combatant.token) > 0) {
        ui.notifications?.warn(game.i18n.format("FORJA.Combat.Feixuga", { arma: arma.name }));
        return;
      }
      const modeTret = pendent.modeTret ?? "tret";
      const bonusMode = MODES_TRET[modeTret] ?? null;
      // Fase 6: atacs d'àrea (escopetes, dispersió, automàtic, foc automàtic).
      if (arma && regleArea(arma.system.propietats ?? [], modeTret)) {
        const fet = await atacArea({ combat, combatant, actor, arma, poolFinal, mode: modeTret,
          extra: { bonusMode, label: pendent.label } });
        if (fet) await _marcarResolta(combat, combatant);
        return;
      }
      // L'objectiu és el declarat (si n'hi ha); si no, el marcat al canvas; i
      // si tampoc n'hi ha cap, es demana ara (excepte Puntada de peu
      // giratòria, que és autocentrada).
      let tokenObjectiu = _tokenObjectiuDeclarat(pendent) ?? [...game.user.targets][0];
      if (!tokenObjectiu && pendent.maniobraId !== "puntada-de-peu-giratoria") {
        tokenObjectiu = await _demanarObjectiu(combat, combatant);
        if (tokenObjectiu === undefined) return; // cancel·lat
      }
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
          demanarDefensa: async (obj, tokenObj) => {
            const categoriaAtac = arma.system.categoria ?? null;
            const dc = defensaCompletaDe(combat, combatantDe(combat, tokenObj, obj));
            if (dc) {
              const { eleccio, resolucio } = resolucioDefensaCompleta(dc, { objectiu: obj, defensaBasica: obj.system.defensa ?? 0, categoriaAtac });
              return { ...eleccio, preresolta: resolucio };
            }
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
        await _marcarResolta(combat, combatant);
        return;
      }

      // Fase 6: Combinació (dos cops, una tirada; la defensa per separat).
      if (arma && objectiu && maniobra?.id === "combinacio") {
        await combinacio({ combat, combatant, actor, arma, poolFinal, tokenObjectiu, objectiu, maniobra,
          extra: { label: pendent.label } });
        await _marcarResolta(combat, combatant);
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

        // Defensa completa declarada: ja està tirada, l'atac s'hi resol
        // directament (sense preguntar ni gastar reaccions).
        const defensaCompleta = defensaCompletaDe(combat, combatantDe(combat, tokenObjectiu, objectiu));
        let eleccio, resolucio, qui = objectiu;
        if (defensaCompleta) {
          ({ eleccio, resolucio } = resolucioDefensaCompleta(defensaCompleta, { objectiu, defensaBasica, categoriaAtac }));
        } else {
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
          eleccio = decisio.eleccio;

          // Si s'ha triat interposar-se, qui rep la tirada/reacció I el dany
          // és el protector, no l'objectiu original.
          qui = eleccio.interposant ?? objectiu;

          resolucio = await resoldreOpcioDefensa(qui, eleccio, { nomAtacant: combatant.name });
          if (!resolucio) {
            ui.notifications?.warn(game.i18n.format("FORJA.Combat.SenseReaccioDisponible", { nom: qui.name }));
            return;
          }
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
          label:      pendent.label,
          bonusMode,
          dimMak:     maniobra?.id === "dim-mak" ? (pendent.dimMak ?? "ferides") : null
        });
        // Fase 6: si el defensor era en guàrdia (Contraatac) i ha parat o
        // blocat l'atac, contraataca immediatament.
        if (resultatAtac && !resultatAtac.exit && ["parar", "blocar"].includes(eleccio.id)) {
          await contraatacar({ combat, defensor: qui, combatantDefensor: combatantDe(combat, tokenObjectiu, qui),
            atacant: actor, tokenAtacant });
        }
        if (maniobra && resultatAtac?.exit) await aplicarEfecteManiobra(maniobra, qui);
        if (maniobra?.id === "llancament" && resultatAtac?.exit) {
          const combatantQui = combat.combatants.find(c => c.actor?.id === qui.id);
          const tokenQui = combatantQui?.token?.object ?? tokenObjectiu;
          await resoldreLlancament({ actorAtacant: combatant.actor, tokenAtacant, tokenObjectiu: tokenQui });
        }
        await _marcarResolta(combat, combatant);
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
    await _marcarResolta(combat, combatant);
  }

  /**
   * DJ: avança el rellotge fins a la propera casella ocupada (`nextTurn`),
   * només quan ningú ha d'actuar al tic actual (`_potAvancarTemps`).
   */
  static async #onAvancarTemps(event, target) {
    const combat = this.viewed;
    if (!combat || !game.user.isGM) return;
    if (!_potAvancarTemps(combat)) {
      ui.notifications?.warn(game.i18n.localize("FORJA.Combat.AvancarTempsEspera"));
      return;
    }
    await combat.nextTurn();
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
  const llista = combat.combatants
    .filter(c => c.id !== combatant.id && !c.isDefeated && c.token?.object)
    .map(c => {
      const token = c.token.object;
      const distancia = tokenPropi ? Math.round(distanciaEntreTokens(tokenPropi, token) * 10) / 10 : null;
      return {
        tokenId: token.id,
        nom:     c.name,
        // Direcció des de l'atacant (fletxa a l'etiqueta, combat/objectius.mjs).
        dx: tokenPropi ? token.center.x - tokenPropi.center.x : 0,
        dy: tokenPropi ? token.center.y - tokenPropi.center.y : 0,
        distancia,
        aTocar:  tokenPropi ? tokensATocar(tokenPropi, token) : false,
        marcat:  marcats.has(token.id)
      };
    })
    .sort((a, b) => (a.distancia ?? Infinity) - (b.distancia ?? Infinity));
  return etiquetarObjectius(llista, { aTocar: game.i18n.localize("FORJA.Combat.ObjectiuATocar") });
}

/** Objectiu preseleccionat: el marcat amb Target, si no l'últim declarat, si no el més proper. */
function _objectiuPerDefecte(objectius, ultimTokenId = null) {
  return (objectius.find(o => o.marcat) ?? objectius.find(o => o.tokenId === ultimTokenId) ?? objectius[0])?.tokenId ?? null;
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

/**
 * Quina icona del combatent cal destacar al tracker:
 *  - fase de declaració: "declarar" si encara no té posició al rellotge;
 *  - temps actiu, combatent actiu: "resoldre" si té l'acció per resoldre,
 *    "declarar" si ja l'ha resolta (li toca declarar la propera).
 * @param {Combat} combat
 * @param {Combatant} combatant
 * @returns {"declarar"|"resoldre"|null}
 */
function _iconaDestacada(combat, combatant) {
  if (!combat.started && combat.fase !== "declaracio") return null;
  if (_potResoldre(combat, combatant)) return "resoldre";
  return _estaHabilitat(combat, combatant) ? "declarar" : null;
}

/** El combatent encara no té posició al rellotge (no ha declarat mai). */
function _senseDeclarar(combatant) {
  return combatant.initiative === null || combatant.initiative === undefined;
}

/**
 * El combatent ha d'actuar ara (fila habilitada, pot declarar):
 *  - fase de declaració: si encara no ha declarat;
 *  - temps actiu: si és el combatent actiu i és a la casella del marcador i
 *    encara no ha declarat la propera acció; o si s'ha afegit al combat sense
 *    posició (ha de declarar per entrar al rellotge).
 * Abans de començar el combat, tothom pot declarar.
 * @param {Combat} combat
 * @param {Combatant} combatant
 * @returns {boolean}
 */
function _estaHabilitat(combat, combatant) {
  // Inconscient o incapacitat: no pot fer res (el DJ en passa el torn sol,
  // `iniciTornEstats`). Marejat sí: pot provar de vèncer el mareig.
  const r = restriccionsActor(combatant.actor);
  if (!r.potActuar && r.motiuActuar !== "marejat") return false;
  if (combat.fase === "declaracio") return _senseDeclarar(combatant);
  if (!combat.started) return true;
  if (_senseDeclarar(combatant)) return true;
  return combat.combatant?.id === combatant.id
    && combatant.initiative === combat.marcador
    && combatant.getFlag("forja", "estatTorn") !== "redeclarada";
}

/** El combatent actiu té una acció pendent per resoldre en aquest tic. */
function _potResoldre(combat, combatant) {
  if (!combat.started || combat.fase === "declaracio") return false;
  if (combatant.getFlag("forja", "accioPendent")?.tipus === "defensa") return false;
  if (combat.combatant?.id !== combatant.id || combatant.initiative !== combat.marcador) return false;
  if (["resolta", "redeclarada"].includes(combatant.getFlag("forja", "estatTorn"))) return false;
  return !!combatant.getFlag("forja", "accioPendent");
}

/** Ningú ha d'actuar al tic actual: el DJ pot avançar el rellotge. */
function _potAvancarTemps(combat) {
  if (!combat.started || combat.fase === "declaracio") return false;
  return !combat.combatants.contents.some(c => !c.isDefeated && _estaHabilitat(combat, c));
}

/**
 * Marca que el combatent actiu ja ha resolt la seva acció en aquest torn
 * (només si és el seu torn; fora de torn no canvia res).
 * @param {Combat} combat
 * @param {Combatant} combatant
 */
async function _marcarResolta(combat, combatant) {
  if (!combat.started || combat.combatant?.id !== combatant.id) return;
  await combatant.setFlag("forja", "estatTorn", "resolta");
}

/**
 * Demana l'objectiu d'un atac que no en té (ni declarat ni marcat).
 * @param {Combat} combat
 * @param {Combatant} combatant
 * @returns {Promise<Token|null|undefined>}  El token triat; `null` = sense
 *   objectiu (només tirada); `undefined` = cancel·lat.
 */
async function _demanarObjectiu(combat, combatant) {
  const objectius = _objectiusDeclarables(combat, combatant);
  if (!objectius.length) return null;
  const opcions = objectius.map(o => `<option value="${o.tokenId}">${Handlebars.escapeExpression(o.etiqueta)}</option>`).join("");
  const triat = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.format("FORJA.Combat.TriaObjectiuTitol", { nom: combatant.name }) },
    content: `<div class="form-group"><label>${game.i18n.localize("FORJA.Combat.Objectiu")}</label>
      <select name="objectiu">${opcions}</select></div>`,
    ok: {
      label: game.i18n.localize("FORJA.Combat.Resoldre"),
      callback: (ev, button) => button.form.elements.objectiu.value
    },
    rejectClose: false,
    // L'objectiu triat es marca al mapa (combat/objectius.mjs).
    render: (event, dialeg) => {
      const sel = dialeg.element.querySelector("select[name='objectiu']");
      marcarObjectiu(sel?.value);
      sel?.addEventListener("change", ev => marcarObjectiu(ev.target.value, { ping: true }));
    }
  });
  if (!triat) return undefined;
  return canvas.tokens?.get(triat) ?? null;
}
