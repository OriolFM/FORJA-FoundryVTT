import assert from "node:assert/strict";

// Arrel del repo, relativa a aquest fitxer (tests/unitaris/ → ../../).
// URL file:// (no ruta): a Windows, import() no accepta rutes com E:\...
const REPO = new URL("../../", import.meta.url).href.replace(/\/$/, "");
/**
 * Test stub per a module/xarxa/socket.mjs — simula dos clients (jugador i DJ)
 * sobre el mateix "canal" en memòria i verifica l'autorització afegida al
 * costat del DJ (llista blanca de camps, context de combat, estats vàlids i
 * el bypass total per a peticions d'origen GM).
 */

const player = { id: "P", isGM: false };
const gm     = { id: "G", isGM: true };

function setProperty(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}
function flattenObject(obj, parent = "", out = {}) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = parent ? `${parent}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flattenObject(v, key, out);
    else out[key] = v;
  }
  return out;
}
function getProperty(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

const notes = [];
let listener;

function novaNpc() {
  return {
    uuid: "Actor.N",
    documentName: "Actor",
    isOwner: false,
    system: {
      salut: { ferides: { marcats: 0 }, fatiga: { marcats: 0 } },
      diners: 0,
      reaccions: { gastades: 0 },
      concentrat: false
    },
    statuses: new Set(),
    async update(changes) {
      for (const [k, v] of Object.entries(changes)) setProperty(this, k, v);
    },
    async toggleStatusEffect(id, { active }) {
      active ? this.statuses.add(id) : this.statuses.delete(id);
    }
  };
}

globalThis.foundry = { utils: { randomID: () => Math.random().toString(36).slice(2), flattenObject, getProperty, setProperty } };
globalThis.ui = { notifications: { error: (m) => notes.push(m) } };
globalThis.CONFIG = { statusEffects: [{ id: "atordit" }, { id: "cec" }] };

let npc;
globalThis.fromUuid = async (u) => (u === npc?.uuid ? npc : null);

globalThis.game = {
  user: player,
  users: { activeGM: gm, get: (id) => ({ P: player, G: gm })[id] },
  combats: [],
  i18n: { format: (k, d) => `${k}:${d.error}`, localize: (k) => k },
  socket: {
    on: (c, fn) => { listener = fn; },
    emit: (c, msg) => {
      // Difusió asíncrona a "l'altre" client: encamina segons qui n'és l'autor real.
      setTimeout(() => {
        game.user = (msg.tipus === "peticio") ? gm : (msg.usuari === gm.id ? gm : player);
        listener(msg);
      }, 0);
    }
  }
};

const S = await import(`${REPO}/module/xarxa/socket.mjs`);
S.registrarSocket();

// 1. Actualització permesa: camp de la llista blanca, amb combat en marxa (pot pujar dany).
npc = novaNpc();
game.user = player;
game.combats = [{ started: false }, { started: true }];   // qualsevol combat començat, en qualsevol escena
await S.actualitzarComGM(npc, { "system.salut.ferides.marcats": 5 });
assert.equal(npc.system.salut.ferides.marcats, 5, "l'actualització permesa hauria d'aplicar-se");

// 1b. Un combat en fase de declaració també compta (Oriol FM, 2026-10-10).
game.combats = [{ started: false, getFlag: (s, k) => (k === "fase" ? "declaracio" : null) }];
await S.actualitzarComGM(npc, { "system.salut.ferides.marcats": 6 });
assert.equal(npc.system.salut.ferides.marcats, 6, "un combat en declaració ha de comptar com a combat en marxa");
assert.equal(S.hiHaCombatEnMarxa([]), false);
assert.equal(S.hiHaCombatEnMarxa([{ started: false }]), false);
game.combats = [{ started: true }];

// 2. Camp fora de la llista blanca: rebutjat encara que hi hagi combat.
game.user = player;
await assert.rejects(
  S.actualitzarComGM(npc, { "system.diners": 999 }),
  /camps no permesos/,
  "un camp fora de la llista blanca s'ha de rebutjar"
);
assert.equal(npc.system.diners, 0, "el camp rebutjat no s'ha d'aplicar");

// 2b. Fora de combat, només es permet que la pista de salut BAIXI (curació).
game.combats = [];
game.user = player;
await assert.rejects(
  S.actualitzarComGM(npc, { "system.salut.ferides.marcats": 9 }),
  /combat actiu/,
  "pujar dany fora de combat s'ha de rebutjar"
);

// 2c. Sense combat, el DJ pot confirmar el dany (emboscades): sí → s'aplica; no → es rebutja.
const preguntes = [];
globalThis.foundry.applications = { api: { DialogV2: { confirm: async (o) => { preguntes.push(o.content); return globalThis._respostaDJ; } } } };
globalThis._respostaDJ = false;
await assert.rejects(S.actualitzarComGM(npc, { "system.salut.ferides.marcats": 9 }), /combat actiu/, "si el DJ diu que no, es rebutja");
globalThis._respostaDJ = true;
await S.actualitzarComGM(npc, { "system.salut.ferides.marcats": 9 });
assert.equal(npc.system.salut.ferides.marcats, 9, "si el DJ ho confirma, s'aplica");
assert.equal(preguntes.length, 2, "s'ha preguntat al DJ cada vegada");
assert.match(preguntes[0], /FORJA.Salut.Ferides/, "el diàleg mostra el nom del camp, no la clau interna");
delete globalThis.foundry.applications;
await S.actualitzarComGM(npc, { "system.salut.ferides.marcats": 2 });
assert.equal(npc.system.salut.ferides.marcats, 2, "baixar (curar) fora de combat s'ha de permetre");

// 3. Estat no reconegut (fora de CONFIG.statusEffects): rebutjat.
game.user = player;
await assert.rejects(
  S.alternarEstatComGM(npc, "estatInventat", true),
  /estat no permès/,
  "un estat fora de CONFIG.statusEffects s'ha de rebutjar"
);
assert.equal(npc.statuses.has("estatInventat"), false);

// 3b. Estat vàlid: permès.
assert.equal(await S.alternarEstatComGM(npc, "atordit", true), true);
assert.equal(npc.statuses.has("atordit"), true);

// 4. Petició d'origen GM: salta totes les comprovacions (camp fora de la llista blanca inclòs).
game.user = gm;
game.combats = [];
await S.actualitzarComGM(npc, { "system.diners": 42 });
assert.equal(npc.system.diners, 42, "el DJ pot escriure qualsevol camp, salta la llista blanca");

// Comprovacions prèvies conservades: document no trobat / cap DJ connectat.
game.user = player;
const inexistent = { ...npc, uuid: "Actor.X" };
await assert.rejects(S.actualitzarComGM(inexistent, {}), /no trobat/);

game.users.activeGM = null;
await assert.rejects(S.actualitzarComGM(npc, {}), /Cap DJ/);

console.log("OK socket", notes.length, "notificacions capturades");
