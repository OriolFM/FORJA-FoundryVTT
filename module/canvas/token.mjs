import { bloquejaPas, impedeixAcabar, cercarCami, simplificarCami } from "../combat/moviment.mjs";
import { liniesAccio } from "../combat/indicador-accio.mjs";
import { fletxaDireccio } from "../combat/objectius.mjs";
import { distanciaEntreTokens, tokensATocar } from "../combat/abast.mjs";
import { textPenalitzacio, liniesSalut } from "../estats/indicador-salut.mjs";

/**
 * Token del canvas de FORJA (WP-M): bloqueig entre tokens i pathfinding.
 *
 * Queixa de l'Oriol FM (2026-09-27): "ho compta tot en línia recta; la gent
 * es mou TRAVESSANT els altres". Aquí:
 * - `_getMovementCostFunction`: les caselles ocupades per tokens que
 *   bloquegen (regla `bloquejaPas`, combat/moviment.mjs) costen `Infinity`,
 *   així `constrainMovementPath` (el nucli de Foundry, en arrossegar i en
 *   `TokenDocument#_preUpdate`) atura el moviment abans d'entrar-hi.
 * - `findMovementPath`: si el camí directe no arriba (parets o tokens que
 *   bloquegen, o destinació ocupada), busca una ruta amb A* sobre la
 *   quadrícula (quadrada o hexagonal) entre cada parell de punts de pas.
 *   En escenes sense quadrícula, el comportament natiu.
 *
 * API de Foundry confirmada a la font (v13 `client/canvas/placeables/token.mjs`
 * i `common/documents/token.mjs`; v14 equivalents):
 * - `Token#_getMovementCostFunction(options)` → `(from, to, distance, segment)`,
 *   on `from`/`to` són offsets de casella; per a tokens de més d'una casella,
 *   el nucli la crida per a cada casella ocupada (v13 `documents/token.mjs`,
 *   `#createSquareMovementCostFunction` / `#createHexagonalMovementCostFunction`).
 * - `Token#findMovementPath(waypoints, options)` → `{result, promise, cancel}`.
 *   v13: `options.{ignoreWalls, ignoreCost, history, preview}`; v14:
 *   `options.{preview, terrainOptions, constrainOptions, measureOptions}`
 *   (les claus antigues hi són com a getters obsolets).
 * - `TokenDocument#_positionToGridOffset` / `_gridOffsetToPosition` /
 *   `getOccupiedGridSpaceOffsets`, `BaseGrid#getAdjacentOffsets`,
 *   `Token#checkCollision(destination, {origin, type, mode})`.
 */

/** Límit d'expansions de l'A* per segment (no pot congelar mai el client). */
const MAX_NODES = 1500;
/** Marge (en caselles) de la finestra de cerca al voltant dels dos extrems. */
const MARGE_FINESTRA = 12;

/**
 * Clau d'una casella de la quadrícula.
 * @param {{i:number, j:number}} o
 * @returns {string}
 */
export function clauCasella(o) {
  return `${o.i},${o.j}`;
}

/**
 * L'usuari actual no ha de saber que aquest token hi és (amagat pel DJ o fora
 * de la visió del jugador): no bloqueja ni ocupa (Oriol FM, 2026-09-27: els
 * tokens amagats no es revelen).
 * @param {TokenDocument} t
 * @returns {boolean}
 */
function _amagatPerUsuari(t) {
  if (game.user.isGM) return false;
  if (t.hidden) return true;
  const obj = t.object;
  return !!(obj && obj.isVisible === false);
}

/**
 * Descriu un altre token per a les regles de `combat/moviment.mjs`.
 * @param {TokenDocument} t
 * @returns {{mida:number|undefined, disposicio:number, mort:boolean, amagat:boolean}}
 */
export function descriureToken(t) {
  const idMort = CONFIG.specialStatusEffects?.DEFEATED ?? "dead";
  const mort = !!(t.actor?.statuses?.has?.(idMort) || t.hasStatusEffect?.(idMort));
  return {
    mida:       t.actor?.system?.mida,
    disposicio: t.disposition,
    mort,
    amagat:     _amagatPerUsuari(t)
  };
}

/**
 * Caselles de l'escena que el token `doc` no pot travessar (`bloquejades`) i
 * on no pot acabar el moviment (`ocupades`), segons la regla de bloqueig de
 * l'Oriol FM (2026-09-27). Les caselles que ocupa el mateix token a la seva
 * posició actual no bloquegen mai (si ha quedat encavalcat amb un altre, no
 * es queda encallat).
 * @param {TokenDocument} doc
 * @returns {{bloquejades:Set<string>, ocupades:Set<string>}}
 */
export function ocupacioEscena(doc) {
  const bloquejades = new Set();
  const ocupades = new Set();
  const escena = doc?.parent;
  const grid = escena?.grid;
  if (!escena || !grid || grid.isGridless) return { bloquejades, ocupades };

  for (const t of escena.tokens) {
    if (t.id === doc.id) continue;
    const altre = descriureToken(t);
    const bloqueja = bloquejaPas({ disposicioMou: doc.disposition, altre });
    const ocupa = impedeixAcabar(altre);
    if (!bloqueja && !ocupa) continue;
    for (const o of t.getOccupiedGridSpaceOffsets()) {
      const k = clauCasella(o);
      if (bloqueja) bloquejades.add(k);
      if (ocupa) ocupades.add(k);
    }
  }
  for (const o of doc.getOccupiedGridSpaceOffsets()) bloquejades.delete(clauCasella(o));
  return { bloquejades, ocupades };
}

/**
 * El token `doc` acabaria el moviment damunt d'un altre token a la posició
 * donada? (Oriol FM, 2026-09-27: cap token pot acabar a l'espai d'un altre.)
 * @param {TokenDocument} doc
 * @param {object} posicio   {x, y, width?, height?, shape?}
 * @param {Set<string>} [ocupades]
 * @returns {boolean}
 */
export function posicioOcupada(doc, posicio, ocupades = ocupacioEscena(doc).ocupades) {
  if (!ocupades.size || doc?.parent?.grid?.isGridless) return false;
  const dades = _dimensions(doc, posicio);
  return doc.getOccupiedGridSpaceOffsets({ x: posicio.x, y: posicio.y, ...dades })
    .some(o => ocupades.has(clauCasella(o)));
}

/** Amplada/alçada/forma d'una posició, amb les del token per defecte. */
function _dimensions(doc, p = {}) {
  const s = doc._source;
  return { width: p.width ?? s.width, height: p.height ?? s.height, shape: p.shape ?? s.shape };
}

/**
 * Opcions de restricció (parets / cost) de `findMovementPath`, compatible
 * v13 (claus planes) i v14 (`constrainOptions`), sense tocar els getters
 * obsolets de v14.
 * @param {object} options
 * @returns {{ignoreWalls:boolean, ignoreCost:boolean}}
 */
function _opcionsRestriccio(options = {}) {
  const c = ("constrainOptions" in options) ? (options.constrainOptions ?? {}) : options;
  return { ignoreWalls: !!c.ignoreWalls, ignoreCost: !!c.ignoreCost };
}

/**
 * Crea la classe de Token de FORJA a partir de la que fa servir Foundry
 * (`CONFIG.Token.objectClass`).
 * @param {typeof foundry.canvas.placeables.Token} Base
 * @returns {typeof foundry.canvas.placeables.Token}
 */
/**
 * Defensa completa vigent del combatent d'aquest token, en qualsevol combat
 * (`flags.forja.defensaCompleta`, `combat/defensa-completa.mjs`), o null.
 * @param {TokenDocument} doc
 * @returns {object|null}
 */
export function defensaCompletaDelToken(doc) {
  for (const combat of game.combats ?? []) {
    const c = combat.combatants.find(x => x.tokenId === doc.id);
    const dc = c?.getFlag("forja", "defensaCompleta");
    if (dc && dc.combatId === combat.id) return dc;
  }
  return null;
}

/**
 * Combatent d'aquest token en un combat en marxa (començat o en
 * declaració), o en qualsevol combat si no n'hi ha cap en marxa.
 * @param {TokenDocument} doc
 * @returns {Combatant|null}
 */
function combatantDelTokenCanvas(doc) {
  let trobat = null;
  for (const combat of game.combats ?? []) {
    const c = combat.combatants.find(x => x.tokenId === doc.id);
    if (!c) continue;
    if (combat.started || combat.getFlag("forja", "fase") === "declaracio") return c;
    trobat ??= c;
  }
  return trobat;
}

/**
 * Redibuixa els indicadors dels tokens quan canvia un combatent (p. ex. la
 * defensa completa) o s'acaba un combat. Només dibuixa al client local.
 */
export function registrarIndicadorsCombat() {
  const refrescar = (combatant) => {
    const token = combatant?.token?.object;
    token?._forjaDibuixarSalut?.();
    token?._forjaDibuixarAccio?.();
  };
  Hooks.on("updateCombatant", refrescar);
  Hooks.on("deleteCombatant", refrescar);
  Hooks.on("deleteCombat", (combat) => { for (const c of combat.combatants) refrescar(c); });
}

export function crearTokenForja(Base) {
  return class TokenForja extends Base {

    /** Indicadors de salut (`estats/indicador-salut.mjs`): insígnia de penalització i resum en passar el ratolí. */
    async _draw(options) {
      await super._draw(options);
      this.forjaSalut = this.addChild(new PIXI.Container());
      this.forjaSalut.eventMode = "none";
      this.forjaOrientacio = this.addChild(new PIXI.Graphics());
      this.forjaOrientacio.eventMode = "none";
      this.forjaAccio = this.addChild(new PIXI.Container());
      this.forjaAccio.eventMode = "none";
      this._forjaDibuixarSalut();
      this._forjaDibuixarOrientacio();
    }

    /**
     * @override — el dibuix del token es queda sempre dret; l'orientació
     * (`document.rotation`, que Foundry canvia en moure'l o amb Ctrl/Maj +
     * roda del ratolí) es marca amb un triangle a la vora (Oriol FM, 2026-10-10).
     */
    _refreshRotation() {
      this.mesh.angle = 0;
      this._forjaDibuixarOrientacio();
    }

    /**
     * Triangle d'orientació: a la vora del token, apuntant cap a on mira.
     * A Foundry, la rotació 0 mira cap avall (sud) i creix en sentit horari.
     * Sense triangle si el token té la rotació bloquejada.
     */
    _forjaDibuixarOrientacio() {
      const g = this.forjaOrientacio;
      if (!g || g.destroyed) return;
      g.clear();
      g.visible = !this.document.lockRotation && !this.document.isSecret;
      if (!g.visible) return;
      const r = Math.min(this.w, this.h) / 2;
      const mida = Math.max(7, r * 0.22);
      g.lineStyle(2, 0x000000, 0.9).beginFill(0xffffff, 0.95)
        .drawPolygon([-mida, r - 2, mida, r - 2, 0, r + mida * 1.1])
        .endFill();
      g.position.set(this.w / 2, this.h / 2);
      g.angle = this.document.rotation ?? 0;
    }

    /** @override — es redibuixen quan canvia la salut (barres), els estats o el hover. */
    _applyRenderFlags(flags) {
      super._applyRenderFlags(flags);
      if (flags.refreshBars || flags.refreshEffects || flags.redrawEffects || flags.refreshSize || flags.refreshState || flags.refreshNameplate) {
        this._forjaDibuixarSalut();
        this._forjaDibuixarAccio();
      }
      if (flags.refreshSize || flags.refreshState) this._forjaDibuixarOrientacio();
    }

    /**
     * Acció declarada en passar el ratolí (`combat/indicador-accio.mjs`): el
     * text a sobre del token i una línia fins a l'objectiu. La declaració és
     * pública (surt al xat), així que la veu tothom qui veu el token.
     */
    _forjaDibuixarAccio() {
      const c = this.forjaAccio;
      if (!c || c.destroyed) return;
      for (const fill of c.removeChildren()) fill.destroy({ children: true });
      c.visible = !this.document.isSecret && !!(this.hover || this.layer?.highlightObjects);
      if (!c.visible) return;
      const combatant = combatantDelTokenCanvas(this.document);
      const pendent = combatant?.getFlag("forja", "accioPendent");
      if (!pendent) return;
      const objectiu = pendent.objectiuTokenId ? canvas.tokens?.get(pendent.objectiuTokenId) : null;
      const linies = liniesAccio(pendent, {
        posicio: combatant.initiative ?? null,
        objectiu: objectiu ? {
          nom: objectiu.name,
          fletxa: fletxaDireccio(objectiu.center.x - this.center.x, objectiu.center.y - this.center.y),
          distancia: Math.round(distanciaEntreTokens(this, objectiu) * 10) / 10,
          aTocar: tokensATocar(this, objectiu)
        } : (pendent.objectiuNom ? { nom: pendent.objectiuNom } : null),
        t: (k, d) => game.i18n.format(k, d)
      });
      if (objectiu && objectiu !== this) {
        const linia = new PIXI.Graphics();
        const fi = { x: objectiu.center.x - this.x, y: objectiu.center.y - this.y };
        // Des de la vora del token (no per damunt del dibuix).
        const dx = fi.x - this.w / 2, dy = fi.y - this.h / 2, llarg = Math.hypot(dx, dy) || 1;
        const r = Math.min(this.w, this.h) / 2;
        const inici = { x: this.w / 2 + dx / llarg * r, y: this.h / 2 + dy / llarg * r };
        linia.lineStyle(4, 0x000000, 0.6).moveTo(inici.x, inici.y).lineTo(fi.x, fi.y);
        linia.lineStyle(2, 0xf59e0b, 0.95).moveTo(inici.x, inici.y).lineTo(fi.x, fi.y);
        linia.lineStyle(2, 0x000000, 0.8).beginFill(0xf59e0b).drawCircle(fi.x, fi.y, Math.max(6, this.w * 0.07)).endFill();
        c.addChild(linia);
      }
      const PreciseText = foundry.canvas.containers.PreciseText;
      const s = CONFIG.canvasTextStyle.clone();
      s.fontSize = Math.max(12, Math.round(this.h * 0.14)); s.fill = 0xfde68a; s.fontWeight = "bold";
      s.stroke = 0x000000; s.strokeThickness = 4; s.align = "center";
      const text = new PreciseText(linies.join("\n"), s);
      text.anchor.set(0.5, 1);
      text.position.set(this.w / 2, -6);
      c.addChild(text);
    }

    /**
     * Només per a qui pot veure la fitxa de l'actor (el DJ, el propietari i
     * els observadors): la salut dels enemics no es revela als jugadors.
     */
    _forjaDibuixarSalut() {
      const c = this.forjaSalut;
      if (!c || c.destroyed) return;
      for (const fill of c.removeChildren()) fill.destroy({ children: true });
      const actor = this.actor;
      c.visible = !!actor && !this.document.isSecret && actor.testUserPermission(game.user, "OBSERVER");
      if (!c.visible) return;
      const salut = actor.system?.salut;
      const PreciseText = foundry.canvas.containers.PreciseText;
      const estil = (mida) => {
        const s = CONFIG.canvasTextStyle.clone();
        s.fontSize = mida; s.fill = 0xffffff; s.fontWeight = "bold"; s.stroke = 0x000000; s.strokeThickness = 4;
        return s;
      };

      // Insígnia vermella a la cantonada superior dreta, com un exponent.
      const pen = textPenalitzacio(salut);
      if (pen) {
        const r = Math.max(11, Math.round(Math.min(this.w, this.h) * 0.17));
        const insignia = new PIXI.Graphics();
        insignia.lineStyle(2, 0x000000, 0.9).beginFill(0xb91c1c).drawCircle(0, 0, r).endFill();
        insignia.position.set(this.w - r * 0.35, r * 0.35);
        const text = new PreciseText(pen, estil(Math.round(r * 1.15)));
        text.anchor.set(0.5);
        text.position.copyFrom(insignia.position);
        c.addChild(insignia, text);
      }

      // Defensa completa declarada (i tirada): escut amb la puntuació a dalt a
      // l'esquerra, fins que declara la propera acció (Oriol FM, 2026-10-10).
      const dc = defensaCompletaDelToken(this.document);
      if (dc) {
        const m = Math.max(12, Math.round(Math.min(this.w, this.h) * 0.19));
        const escut = new PIXI.Graphics();
        escut.lineStyle(2, 0x000000, 0.9).beginFill(0x0d9488)
          .drawPolygon([-m, -m, m, -m, m, m * 0.15, 0, m * 1.15, -m, m * 0.15])
          .endFill();
        escut.position.set(m * 0.35, m * 0.35);
        const text = new PreciseText(String(dc.dificultat ?? "?"), estil(Math.round(m * 1.05)));
        text.anchor.set(0.5);
        text.position.set(escut.x, escut.y + m * 0.02);
        c.addChild(escut, text);
      }

      // Resum en passar el ratolí: sota el nom (o sota el token).
      if (this.hover || this.layer?.highlightObjects) {
        const linies = liniesSalut(salut, actor.statuses, (k, d) => game.i18n.format(k, d));
        if (linies.length) {
          const text = new PreciseText(linies.join("\n"), estil(Math.max(12, Math.round(this.h * 0.14))));
          text.style.align = "center";
          text.anchor.set(0.5, 0);
          const sotaNom = this.nameplate?.visible ? this.nameplate.y + this.nameplate.height / 2 + 2 : this.h + 4;
          text.position.set(this.w / 2, sotaNom);
          c.addChild(text);
        }
      }
    }

    /**
     * @override — les caselles ocupades per tokens que bloquegen tenen cost
     * infinit; la resta, el cost natiu (terreny + acció). No s'aplica als
     * salts de teletransport ni al DJ amb "moviment sense restriccions".
     */
    _getMovementCostFunction(options) {
      const base = super._getMovementCostFunction(options);
      const grid = this.document.parent?.grid;
      if (!grid || grid.isGridless) return base;
      if (game.user.isGM && game.settings.get("core", "unconstrainedMovement")) return base;
      const { bloquejades } = ocupacioEscena(this.document);
      if (!bloquejades.size) return base;
      return (from, to, distance, segment) => {
        if (!segment?.teleport && bloquejades.has(clauCasella(to))) return Infinity;
        return (typeof base === "function") ? base(from, to, distance, segment) : distance;
      };
    }

    /**
     * @override — ruta al voltant de parets i tokens que bloquegen (A*).
     * Primer prova el camí natiu (directe); només si no arriba al darrer punt
     * de pas, o hi arriba però acabaria damunt d'un altre token, busca una
     * ruta. Qualsevol error torna al comportament natiu.
     */
    findMovementPath(waypoints, options = {}) {
      const directe = super.findMovementPath(waypoints, options);
      const grid = this.document.parent?.grid;
      if (!grid || grid.isGridless || (waypoints?.length ?? 0) < 2) return directe;
      const { ignoreWalls, ignoreCost } = _opcionsRestriccio(options);
      if (ignoreWalls && ignoreCost) return directe;
      if (directe.result === undefined) return directe;   // cerca asíncrona d'un altre mòdul

      try {
        const ocupacio = ocupacioEscena(this.document);
        if (this.#camiAcceptable(directe.result, waypoints, ocupacio, ignoreCost)) return directe;
        const cami = this.#construirCami(waypoints, { ignoreWalls, ignoreCost, ocupacio });
        if (!cami) return directe;
        return super.findMovementPath(cami, options);
      } catch (err) {
        console.error("FORJA | Error cercant el camí del token", err);
        return directe;
      }
    }

    /**
     * El camí natiu arriba al darrer punt de pas i no hi acaba damunt d'un altre token?
     * @param {object[]} resultat
     * @param {object[]} waypoints
     * @param {{ocupades:Set<string>}} ocupacio
     * @param {boolean} ignoreCost
     * @returns {boolean}
     */
    #camiAcceptable(resultat, waypoints, ocupacio, ignoreCost) {
      const darrer = resultat?.at(-1);
      const objectiu = waypoints.at(-1);
      if (!darrer || !objectiu) return true;
      const x = objectiu.x ?? darrer.x, y = objectiu.y ?? darrer.y;
      if (Math.round(darrer.x) !== Math.round(x) || Math.round(darrer.y) !== Math.round(y)) return false;
      if (ignoreCost) return true;
      return !posicioOcupada(this.document, { ...objectiu, x, y }, ocupacio.ocupades);
    }

    /**
     * Construeix la llista de punts de pas amb els punts intermedis de l'A*
     * (només on el camí gira). Si un segment no arriba al seu destí, el camí
     * s'hi talla (el nucli ho mostra com a punts inabastables).
     * @returns {object[]|null}
     */
    #construirCami(waypoints, { ignoreWalls, ignoreCost, ocupacio }) {
      const doc = this.document;
      const src = doc._source;
      const cami = [{ ...waypoints[0] }];
      let anterior = { x: src.x, y: src.y, ...waypoints[0] };

      for (let n = 1; n < waypoints.length; n++) {
        const wp = { ...waypoints[n] };
        wp.x ??= anterior.x;
        wp.y ??= anterior.y;
        const accio = wp.action ?? anterior.action ?? doc.movementAction;
        const configAccio = CONFIG.Token.movement.actions[accio];
        if (configAccio?.teleport) {                       // salt directe, sense ruta
          cami.push(wp);
          anterior = wp;
          continue;
        }
        const esDarrer = n === waypoints.length - 1;
        const segment = this.#cercarSegment(anterior, wp, {
          ignoreWalls, ignoreCost, ocupacio, esDarrer,
          tipusParet: ignoreWalls ? null : (configAccio?.walls ?? "move")
        });
        const intermedis = segment.punts.map(p => ({
          ...wp, x: p.x, y: p.y, snapped: true, explicit: false, checkpoint: false
        }));
        if (segment.complet) {
          cami.push(...intermedis.slice(0, -1), wp);
          anterior = { ...wp, action: accio };
        } else {
          cami.push(...intermedis);
          break;
        }
      }
      return cami.length > 1 ? cami : null;
    }

    /**
     * A* entre dues posicions del token, sobre offsets de la casella superior
     * esquerra (com fa el nucli per mesurar). Suporta tokens de diverses
     * caselles (totes les caselles ocupades han de ser lliures) i quadrícules
     * quadrades i hexagonals.
     * @returns {{punts:Array<{x:number,y:number}>, complet:boolean}}
     */
    #cercarSegment(a, b, { ignoreCost, ocupacio, esDarrer, tipusParet }) {
      const doc = this.document;
      const grid = doc.parent.grid;
      const dims = _dimensions(doc, b);
      const elevacio = b.elevation ?? a.elevation ?? doc._source.elevation;
      const inici = doc._positionToGridOffset({ x: a.x, y: a.y, elevation: elevacio, ...dims });
      const objectiu = doc._positionToGridOffset({ x: b.x, y: b.y, elevation: elevacio, ...dims });
      const k2 = o => ({ i: o.i, j: o.j });

      const posicio = (o) => {
        const p = doc._gridOffsetToPosition({ i: o.i, j: o.j, k: 0 }, dims);
        return { x: Math.round(p.x), y: Math.round(p.y) };
      };
      const centre = (o) => {
        const p = posicio(o);
        return doc.getCenterPoint({ x: p.x, y: p.y, elevation: elevacio, ...dims });
      };
      const cellesLliures = (o, conjunt) => {
        if (!conjunt.size) return true;
        const p = posicio(o);
        return !doc.getOccupiedGridSpaceOffsets({ x: p.x, y: p.y, ...dims })
          .some(c => conjunt.has(clauCasella(c)));
      };

      // Finestra de cerca: rectangle d'offsets al voltant dels dos extrems.
      const di = Math.abs(objectiu.i - inici.i), dj = Math.abs(objectiu.j - inici.j);
      const marge = Math.max(MARGE_FINESTRA, Math.ceil(Math.max(di, dj) / 2));
      const fin = {
        i0: Math.min(inici.i, objectiu.i) - marge, i1: Math.max(inici.i, objectiu.i) + marge,
        j0: Math.min(inici.j, objectiu.j) - marge, j1: Math.max(inici.j, objectiu.j) + marge
      };
      const rect = canvas.dimensions.rect;

      // Cost d'un pas (distància de la quadrícula entre centres), en memòria cau per direcció.
      const costosPas = new Map();
      const costPas = (o, v) => {
        const k = grid.isSquare ? `${v.i - o.i},${v.j - o.j}` : "hex";
        let c = costosPas.get(k);
        if (c === undefined) {
          c = grid.measurePath([grid.getCenterPoint(o), grid.getCenterPoint(v)]).distance || grid.distance;
          costosPas.set(k, c);
        }
        return c;
      };
      const heuristica = (o) => grid.measurePath([grid.getCenterPoint(o), grid.getCenterPoint(objectiu)]).distance;

      const paretEntre = (o, v) => {
        if (!tipusParet) return false;
        const c0 = centre(o), c1 = centre(v);
        const qt = canvas.walls?.quadtree;
        if (qt) {
          const r = new PIXI.Rectangle(Math.min(c0.x, c1.x) - 2, Math.min(c0.y, c1.y) - 2,
            Math.abs(c1.x - c0.x) + 4, Math.abs(c1.y - c0.y) + 4);
          if (!qt.getObjects(r).size) return false;
        }
        return !!this.checkCollision(c1, { origin: c0, type: tipusParet, mode: "any" });
      };

      const res = cercarCami({
        inici: k2(inici),
        objectiu: k2(objectiu),
        clau: clauCasella,
        maxNodes: MAX_NODES,
        heuristica,
        esFinalValid: (o) => ignoreCost || !esDarrer || cellesLliures(o, ocupacio.ocupades),
        veins: (o) => {
          const out = [];
          for (const v0 of grid.getAdjacentOffsets(o)) {
            const v = k2(v0);
            if (v.i < fin.i0 || v.i > fin.i1 || v.j < fin.j0 || v.j > fin.j1) continue;
            const c = centre(v);
            if (!rect.contains(c.x, c.y)) continue;
            if (!ignoreCost && !cellesLliures(v, ocupacio.bloquejades)) continue;
            if (paretEntre(o, v)) continue;
            // Quadrícula quadrada: un pas en diagonal només si els dos passos rectes
            // que l'envolten també són lliures (sense "retallar" cantonades). Evita
            // passar just per l'extrem d'una paret, que el nucli considera col·lisió
            // quan valida el camí i el tallaria (trobat a les proves de joc, M9).
            if (grid.isSquare && v.i !== o.i && v.j !== o.j) {
              const h = { i: o.i, j: v.j }, w = { i: v.i, j: o.j };
              if (paretEntre(o, h) || paretEntre(h, v) || paretEntre(o, w) || paretEntre(w, v)) continue;
            }
            out.push({ node: v, cost: costPas(o, v) });
          }
          return out;
        }
      });

      const punts = simplificarCami(res.cami.map(posicio)).slice(1);
      return { punts, complet: res.complet };
    }
  };
}
