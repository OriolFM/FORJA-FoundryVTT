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
    await combatant.update({ initiative: this.marcador });
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
    await combatant.update({ initiative: valor });
    return this.setupTurns();
  }

  /**
   * Declara una acció: suma la latència calculada (DA-5, editable) a la
   * posició actual del combatent i reordena el rellotge.
   * @param {string} combatantId
   * @param {number} latencia
   */
  async declararAccio(combatantId, latencia) {
    const combatant = this.combatants.get(combatantId);
    if (!combatant) return;
    const novaPosicio = (combatant.initiative ?? this.marcador) + latencia;
    await combatant.update({ initiative: novaPosicio });
    return this.setupTurns();
  }

  /**
   * Avança el marcador de temps fins a la propera posició ocupada del
   * rellotge i hi situa el torn (ordre ascendent).
   * @override
   */
  async nextTurn() {
    const ocupades = this.turns.filter(c => c.initiative !== null && c.initiative !== undefined);
    if (!ocupades.length) return this;

    const actual = this.marcador;
    const properes = ocupades.filter(c => c.initiative > actual || (c.initiative === actual && c !== this.combatant));
    const propera = properes.length
      ? properes.reduce((min, c) => (c.initiative < min.initiative ? c : min))
      : ocupades.reduce((min, c) => (c.initiative < min.initiative ? c : min));

    const novoTorn = this.turns.findIndex(c => c.id === propera.id);
    await this.setFlag("forja", "marcador", propera.initiative ?? actual);

    let avancRonda = false;
    if (this.turn !== null && novoTorn <= this.turn) avancRonda = true;

    return this.update({
      round: avancRonda ? this.round + 1 : this.round,
      turn:  novoTorn
    });
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
    await this.setFlag("forja", "marcador", 0);
    return super.startCombat();
  }
}
