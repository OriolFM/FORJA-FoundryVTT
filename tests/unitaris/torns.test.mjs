import assert from "node:assert/strict";


// ---- Stubs mínims de Foundry ----
import { fileURLToPath } from "node:url";
// Arrel del repo, relativa a aquest fitxer (tests/unitaris/ → ../../).
const REPO = fileURLToPath(new URL("../../", import.meta.url)).replace(/\/$/, "");
const get = (o, p) => p.split(".").reduce((x, k) => x?.[k], o);
const set = (o, p, v) => { const ks = p.split("."); let x = o; for (const k of ks.slice(0, -1)) x = (x[k] ??= {}); x[ks.at(-1)] = v; };
globalThis.foundry = { utils: { hasProperty: (o, p) => get(o, p) !== undefined, setProperty: set, getProperty: get } };
globalThis.game = { users: { activeGM: null } };

// Core v13 Combat (simplificat): setupTurns conserva l'ÍNDEX.
globalThis.Combat = class {
  constructor(combatants) {
    this.combatants = new Map(combatants.map(c => [c.id, c]));
    this.combatants.contents = combatants;
    this.flags = { forja: { marcador: 0 } };
    this.turn = 0; this.round = 1; this.turns = [];
    this.settings = {};
  }
  getFlag(s, k) { return this.flags[s]?.[k]; }
  get combatant() { return this.turn !== null ? this.turns[this.turn] : undefined; }
  _getCurrentState(c) { return { round: this.round, turn: this.turn, combatantId: c?.id ?? null }; }
  setupTurns() {
    const turns = [...this.combatants.values()].sort((a, b) => this._sortCombatants(a, b));
    if (this.turn !== null && this.turn >= turns.length) { this.turn = 0; this.round++; }
    this.current = this._getCurrentState(turns[this.turn]);
    return this.turns = turns;
  }
  prepareDerivedData() {}
  async _preUpdate() {}
  // Aplica un update com ho faria el servidor + _preUpdate (sense diff)
  async update(flat, options) {
    const changes = {}; for (const [k, v] of Object.entries(flat)) set(changes, k, v);   // expandObject
    await this._preUpdate(changes, options, null);
    const merge = (dst, src) => { for (const [k, v] of Object.entries(src)) {
      if (v && typeof v === "object" && !Array.isArray(v)) merge(dst[k] ??= {}, v); else dst[k] = v; } };
    merge(this, changes);
    this.lastOptions = options;
    this.prepareDerivedData();
  }
  get isOwner() { return true; }
};

const { default: ForjaCombat, calcularSeguentTorn } = await import(`${REPO}/module/documents/combat.mjs`);

const mk = (id, initiative, lat = 0) => ({ id, initiative, actor: { system: { latenciaBase: lat } },
  async update(ch) { Object.assign(this, ch); }, get isOwner() { return true; } });

function nouCombat(llista) {
  const c = new ForjaCombat(llista);
  for (const x of llista) { const up = x.update.bind(x); x.update = async ch => { await up(ch); c.setupTurns(); }; }
  c.setupTurns();
  return c;
}
const ordre = c => c.turns.map(t => `${t.id}${t.initiative}`).join(",");

// 1. Escenari del pla: A i B a 0, A actua → 5; el següent ha de ser B.
{
  const A = mk("A", 0, 2), B = mk("B", 0, 1);            // A declara primer (més latència base)
  const c = nouCombat([A, B]);
  c.flags.forja.actiu = "A"; c.setupTurns();
  assert.equal(c.combatant.id, "A");
  await c.declararAccio("A", 5);
  assert.equal(ordre(c), "B0,A5");
  assert.equal(c.combatant.id, "A", "després de reordenar, el torn continua sent d'A");
  await c.nextTurn();
  assert.equal(c.combatant.id, "B", "B no es salta");
  assert.equal(c.lastOptions.forja.combatentSortint, "A", "el reset de reaccions és per a A");
  assert.equal(c.flags.forja.marcador, 0);
  await c.declararAccio("B", 3);
  assert.equal(c.combatant.id, "B");
  await c.nextTurn();
  assert.equal(c.combatant.id, "B"); assert.equal(c.flags.forja.marcador, 3);
  assert.equal(c.lastOptions.forja.combatentSortint, "B");
  await c.declararAccio("B", 4);  // B → 7
  await c.nextTurn();
  assert.equal(c.combatant.id, "A"); assert.equal(c.flags.forja.marcador, 5);
}

// 2. Tres a la mateixa casella; qui no declara no torna a actuar a la mateixa casella (no hi ha bucle).
{
  const A = mk("A", 0, 3), B = mk("B", 0, 2), C = mk("C", 0, 1);
  const c = nouCombat([A, B, C]);
  c.flags.forja.actiu = "A"; c.setupTurns();
  await c.declararAccio("A", 5);
  await c.nextTurn(); assert.equal(c.combatant.id, "B");
  await c.nextTurn(); assert.equal(c.combatant.id, "C");         // B no ha declarat
  await c.nextTurn(); assert.equal(c.combatant.id, "A");         // B i C ja han actuat a 0 → marcador 5
  assert.equal(c.flags.forja.marcador, 5);
  assert.deepEqual(c.flags.forja.actuats, []);
}

// 3. Qui declara a mig torn d'un altre (no actiu) no canvia el combatent actiu.
{
  const A = mk("A", 2), B = mk("B", 4), C = mk("C", 6);
  const c = nouCombat([A, B, C]);
  c.flags.forja.actiu = "B"; c.setupTurns();
  assert.equal(c.combatant.id, "B");
  await c.declararAccio("C", -5);   // C → 1, passa al davant
  assert.equal(ordre(c), "C1,A2,B4");
  assert.equal(c.combatant.id, "B");
}

// 4. Funció pura: sense ningú al davant → nova ronda des de la posició més baixa.
{
  const t = [{ id: "A", initiative: 0 }, { id: "B", initiative: 0 }];
  const r = calcularSeguentTorn({ turns: t, marcador: 0, actuats: ["A"], actualId: "B", actualIndex: 1 });
  assert.deepEqual(r, { id: "A", index: 0, marcador: 0, actuats: [], avancRonda: true });
  assert.equal(calcularSeguentTorn({ turns: [{ id: "A", initiative: null }], marcador: 0, actualId: null, actualIndex: 0 }), null);
}

// 5. _preUpdate: un canvi de `turn` sense flag fixa el combatent actiu.
{
  const A = mk("A", 1), B = mk("B", 2);
  const c = nouCombat([A, B]);
  const ch = { turn: 1 };
  await c._preUpdate(ch, {}, null);
  assert.equal(ch.flags.forja.actiu, "B");
}
console.log("OK: tots els tests de torns passen");
