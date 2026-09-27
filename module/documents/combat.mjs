import { actualitzarComGM } from "../xarxa/socket.mjs";
import { reiniciarReaccions } from "../combat/reaccions.mjs";

/**
 * ForjaCombat (S-10) — rellotge de temps actiu net (sense reaccions).
 *
 * Model (D-B/D-B1):
 * - `Combatant#initiative` és la POSICIÓ al rellotge (tick on actuarà), no un
 *   ordre d'iniciativa descendent a l'estil D&D. Representació lineal numerada
 *   (el "rellotge de 24 caselles" del manual és metàfora visual).
 * - Ordre ascendent: actua primer qui té la posició més baixa.
 * - Avançar mou el "marcador de temps" (`flags.forja.marcador`) fins a la
 *   propera posició ocupada i hi resol l'actuació.
 * - Declarar una acció suma la latència de l'acció a la posició actual del
 *   combatent, reordenant el rellotge.
 */

/**
 * Índex a `turns` del combatent actiu (per id). Si no hi és (flag buit o
 * combatent eliminat), conserva l'índex actual.
 * @param {Array<{id:string}>} turns
 * @param {string|null} actiuId
 * @param {number} turnActual
 * @returns {number}
 */
export function indexCombatentActiu(turns, actiuId, turnActual) {
  if (!actiuId) return turnActual;
  const idx = turns.findIndex(c => c.id === actiuId);
  return idx >= 0 ? idx : turnActual;
}

/**
 * Tria el proper combatent del rellotge (funció pura, S-10 / REVIEW-PLAN A3).
 *
 * 1. Primer, qui és a la casella del marcador i encara no hi ha actuat
 *    (`actuats` + el combatent que acaba), en l'ordre de `turns` — així tots
 *    els empatats a la casella tenen torn, encara que el que acaba s'hagi mogut.
 * 2. Si no n'hi ha cap, el marcador avança a la propera casella ocupada
 *    (posició més baixa > marcador; empat → ordre de `turns`) i la llista
 *    d'actuats es reinicia.
 * 3. Si ningú és per davant, es torna a començar per la posició més baixa
 *    (nova ronda).
 * La ronda també avança, com abans, quan el nou índex no és posterior a
 * l'actual (garanteix que cada avançament canviï `turn` o `round`).
 *
 * @param {object} p
 * @param {Array<{id:string, initiative:number|null}>} p.turns  Candidats (ordenats)
 * @param {Array<{id:string}>} [p.ordre=p.turns]  Llista completa de torns (per calcular l'índex)
 * @param {number} p.marcador
 * @param {string[]} [p.actuats=[]]  Ids que ja han actuat a la casella del marcador
 * @param {string|null} p.actualId      Combatent que acaba el torn
 * @param {number|null} p.actualIndex   Índex actual (corregit) a `ordre`
 * @returns {{id:string, index:number, marcador:number, actuats:string[], avancRonda:boolean}|null}
 */
export function calcularSeguentTorn({ turns, ordre = turns, marcador, actuats = [], actualId, actualIndex }) {
  const ocupades = turns.filter(c => c.initiative !== null && c.initiative !== undefined);
  if (!ocupades.length) return null;

  const fets = new Set(actuats);
  if (actualId) fets.add(actualId);

  let propera = ocupades.find(c => c.initiative === marcador && !fets.has(c.id));
  let nouMarcador = marcador;
  let nousActuats = [...fets];
  let wrap = false;

  if (!propera) {
    const davant = ocupades.filter(c => c.initiative > marcador);
    if (davant.length) {
      propera = davant.reduce((min, c) => (c.initiative < min.initiative ? c : min));
    } else {
      propera = ocupades.reduce((min, c) => (c.initiative < min.initiative ? c : min));
      wrap = true;
    }
    nouMarcador = propera.initiative;
    nousActuats = [];
  }

  const index = ordre.findIndex(c => c.id === propera.id);
  const avancRonda = wrap || (actualIndex !== null && actualIndex !== undefined && index <= actualIndex);
  return { id: propera.id, index, marcador: nouMarcador, actuats: nousActuats, avancRonda };
}

export default class ForjaCombat extends Combat {

  /** Posició actual del marcador de temps (tick). */
  get marcador() {
    return this.getFlag("forja", "marcador") ?? 0;
  }

  /**
   * @override — ordre ascendent: la posició (tick) més baixa actua primer.
   * En cas d'empat a la mateixa casella, declara abans qui té més latència
   * base (és a dir, qui reacciona/actua "de forma més lenta" per naturalesa
   * decideix primer com ocupa el seu torn).
   */
  _sortCombatants(a, b) {
    const ia = a.initiative ?? Infinity;
    const ib = b.initiative ?? Infinity;
    if (ia !== ib) return ia - ib;
    const la = a.actor?.system?.latenciaBase ?? 0;
    const lb = b.actor?.system?.latenciaBase ?? 0;
    if (la !== lb) return lb - la;
    return (a.id > b.id) ? 1 : -1;
  }

  /**
   * Marca un combatent del bàndol que prepara l'emboscada (manual, p. 477-481):
   * els integrants del bàndol preparat executen la seva primera acció
   * SIMULTÀNIAMENT a la primera casella del rellotge (la mateixa posició on
   * comença el marcador). El bàndol sorprès encara no hi és — no es col·loca
   * al rellotge fins que es resol aquest primer torn, moment en què tothom
   * ja declara amb normalitat.
   *
   * Excepció (manual, p. 481): un PJ sorprès amb el tret "sentit del perill"
   * sí que detecta l'emboscada i pot reaccionar-hi amb normalitat — en aquest
   * cas, no l'amaguis del rellotge: situa'l també a la posició inicial.
   * @param {string} combatantId
   */
  async marcarEmboscada(combatantId) {
    const combatant = this.combatants.get(combatantId);
    if (!combatant) return;
    await actualitzarComGM(combatant, { initiative: this.marcador });
    return this.setupTurns();
  }

  /**
   * Situa un combatent al rellotge a una posició concreta (entrada en combat
   * o re-situació manual). Si no se'n dona cap, es col·loca al marcador actual.
   * @param {string} combatantId
   * @param {number} [posicio]
   */
  async situarCombatent(combatantId, posicio) {
    const combatant = this.combatants.get(combatantId);
    if (!combatant) return;
    const valor = posicio ?? this.marcador;
    await actualitzarComGM(combatant, { initiative: valor });
    return this.setupTurns();
  }

  /**
   * Declara una acció: suma la latència calculada (DA-5, editable) a la
   * posició actual del combatent i reordena el rellotge. El combatent en torn
   * es manté (vegeu `setupTurns`), encara que el reordenament canviï el seu índex.
   * @param {string} combatantId
   * @param {number} latencia
   */
  async declararAccio(combatantId, latencia) {
    const combatant = this.combatants.get(combatantId);
    if (!combatant) return;
    const novaPosicio = (combatant.initiative ?? this.marcador) + latencia;
    await actualitzarComGM(combatant, { initiative: novaPosicio });
    return this.setupTurns();
  }

  /* -------------------------------------------- */
  /*  Ordre de torns (REVIEW-PLAN A3)             */
  /* -------------------------------------------- */

  /**
   * Id del combatent que té el torn, persistit a `flags.forja.actiu`.
   * Foundry només desa l'ÍNDEX (`turn`), que deixa d'apuntar al mateix
   * combatent quan una declaració reordena el rellotge; aquest flag és la
   * font de veritat i `turn` s'hi re-apunta localment a cada client.
   * @type {string|null}
   */
  get combatentActiuId() {
    return this.getFlag("forja", "actiu") ?? null;
  }

  /**
   * @override — després d'ordenar, re-apunta `turn` al combatent actiu
   * (flag) en lloc de conservar l'índex antic.
   */
  setupTurns() {
    const turns = super.setupTurns();
    const idx = this._forjaRepuntarTorn();
    if (idx !== null) {
      const c = turns[idx];
      this.current = (typeof this._getCurrentState === "function")
        ? this._getCurrentState(c)
        : { round: this.round, turn: idx, combatantId: c?.id ?? null, tokenId: c?.tokenId ?? null };
    }
    return turns;
  }

  /**
   * @override — cada cop que es reinicialitzen les dades (p.ex. `reset()`),
   * `turn` torna al valor desat; es torna a apuntar al combatent actiu.
   * No es toca `this.current` aquí: `Combat#_onUpdate` en captura l'estat previ.
   */
  prepareDerivedData() {
    super.prepareDerivedData();
    if (this.turns?.length) this._forjaRepuntarTorn();
  }

  /**
   * Ajusta `this.turn` (només localment) a l'índex del combatent actiu.
   * @returns {number|null}  Nou índex si s'ha canviat, `null` si no cal
   * @private
   */
  _forjaRepuntarTorn() {
    if (this.turn === null || this.turn === undefined) return null;
    const idx = indexCombatentActiu(this.turns ?? [], this.combatentActiuId, this.turn);
    if (idx === this.turn) return null;
    this.turn = idx;
    return idx;
  }

  /**
   * @override — qualsevol canvi de `turn` que no porti el flag (p.ex. l'ajust
   * natiu en eliminar combatents) actualitza també el combatent actiu.
   */
  async _preUpdate(changed, options, user) {
    const allowed = await super._preUpdate(changed, options, user);
    if (allowed === false) return false;
    // `changed` ja arriba expandit; es comprova també la clau plana per si de cas.
    const actiuCanviat = ("flags.forja.actiu" in changed) || foundry.utils.hasProperty(changed, "flags.forja.actiu");
    if (("turn" in changed) && !actiuCanviat) {
      const c = (changed.turn === null) ? null : this.turns?.[changed.turn];
      foundry.utils.setProperty(changed, "flags.forja.actiu", c?.id ?? null);
    }
  }

  /**
   * Avança el marcador de temps fins al proper combatent que hi ha d'actuar
   * (vegeu `calcularSeguentTorn`) i hi situa el torn. Marcador, combatent
   * actiu, torn i ronda s'escriuen en un sol `update` (D5). El combatent que
   * acaba viatja a `options.forja.combatentSortint` perquè el DJ actiu li
   * reiniciï les reaccions (hook `updateCombat`, forja.mjs → `fiDeTorn`).
   * Els jugadors ho fan passar pel DJ (`actualitzarComGM`), ja que no poden
   * escriure flags del combat.
   * @override
   */
  async nextTurn() {
    const sortint = this.combatant ?? null;
    const seguent = calcularSeguentTorn({
      turns:       this.turns.filter(c => !(this.settings?.skipDefeated && c.isDefeated)),
      ordre:       this.turns,
      marcador:    this.marcador,
      actuats:     this.getFlag("forja", "actuats") ?? [],
      actualId:    sortint?.id ?? null,
      actualIndex: this.turn
    });
    if (!seguent) return this;

    const changes = {
      round: seguent.avancRonda ? this.round + 1 : this.round,
      turn:  seguent.index,
      "flags.forja.marcador": seguent.marcador,
      "flags.forja.actiu":    seguent.id,
      "flags.forja.actuats":  seguent.actuats
    };
    // `diff: false`: `turn` desat pot coincidir amb el nou índex tot i canviar
    // de combatent (l'índex local està re-apuntat); així el canvi de torn es
    // difon igualment.
    const options = { direction: 1, diff: false, forja: { combatentSortint: sortint?.id ?? null } };
    await actualitzarComGM(this, changes, options);
    return this;
  }

  /**
   * Final del torn d'un combatent (executat només al DJ actiu, des del hook
   * `updateCombat`): recupera les reaccions (S-11). Punt d'extensió per a
   * altres efectes de final de torn (p.ex. ègida, B4).
   * @param {Combatant} combatant
   */
  async fiDeTorn(combatant) {
    const actor = combatant?.actor;
    if (actor) await reiniciarReaccions(actor);
  }

  /** @override — el rellotge de FORJA no recula; cada combatent decideix la seva pròxima posició. */
  async previousTurn() {
    return this;
  }

  /**
   * @override — FORJA no tira iniciativa amb daus: "tirar iniciativa" només
   * situa el combatent al rellotge (a la posició actual del marcador), tal
   * com fa l'entrada en combat normal. Es manté per compatibilitat amb el
   * flux natiu (p.ex. en afegir combatents nous), però sense cap tirada.
   * @override
   */
  async rollInitiative(ids, options = {}) {
    const llista = Array.isArray(ids) ? ids : [ids];
    for (const id of llista) await this.situarCombatent(id);
    return this;
  }

  /** @override — comença el rellotge amb el marcador a zero. */
  async startCombat() {
    // `actiu` buit: el `turn: 0` de l'inici el fixa a `_preUpdate`.
    await this.update({ "flags.forja": { marcador: 0, actiu: null, actuats: [] } });
    return super.startCombat();
  }
}
