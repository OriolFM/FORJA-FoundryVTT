// Fase 5: contingut dels compendis (packs/_source/<pack>/*.json), generat per
// scripts/build-packs.mjs a partir del manual i dels catàlegs. Sense Foundry.
//
// Comprova els comptes, la forma dels documents (_id/_key per al CLI), i que
// cada actor, recalculat amb les taules de cost del sistema, té el cost i els
// derivats (latència, defensa, reducció de dany, reacció) que diu el manual.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { carregarConfig, generar } from "../../scripts/build-packs.mjs";

const ARREL = fileURLToPath(new URL("../../", import.meta.url));
const FONTS = path.join(ARREL, "packs/_source");
const cfg = carregarConfig();

function llegirPack(pack) {
  const dir = path.join(FONTS, pack);
  assert.ok(fs.existsSync(dir), `Falta packs/_source/${pack} (executa node scripts/build-packs.mjs)`);
  return fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort()
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))
    .filter(d => !d._key.startsWith("!folders!"));
}

const PACKS = {
  pj: llegirPack("pj"),
  pnj: llegirPack("pnj"),
  animals: llegirPack("animals"),
  criatures: llegirPack("criatures"),
  trets: llegirPack("trets"),
  armes: llegirPack("armes"),
  armadures: llegirPack("armadures"),
  artefactes: llegirPack("artefactes"),
  efectes: llegirPack("efectes")
};
// Tots els actors (proves d'estructura) i només els del manual (proves de fidelitat al manual).
// Els de l'aventura «La porta d'Hèkate» segueixen regles anteriors: les diferències
// es publiquen a moduls/forja-la-porta-dhekate/CONVERSIO.md.
const TOTS = ["pj", "pnj", "animals", "criatures"].flatMap(p => PACKS[p].map(a => ({ pack: p, actor: a })));
const ACTORS = TOTS.filter(a => !a.actor.flags.forja.aventura);
const AVENTURA = TOTS.filter(a => a.actor.flags.forja.aventura);
const delManual = pack => PACKS[pack].filter(a => !a.flags.forja.aventura);

/**
 * Excepcions conegudes (culpa del manual) al cost o als derivats:
 * clau `<pack>/<nom>/<camp>` -> motiu. Buit: avui totes les fitxes quadren.
 * Si el manual canvia i en surt alguna, s'ha d'afegir aquí amb el motiu i a
 * docs/CONTINGUT-INFORME.md, no es pot amagar.
 */
const EXCEPCIONS_CONEGUDES = {};

/* ---- càlcul independent del de l'script ---- */
function costActor(actor) {
  const s = actor.system;
  let cost = 0;
  for (const v of Object.values(s.atributs)) cost += cfg.COST_ATRIBUT[v];
  cost += cfg.COST_ESPECIE[s.especie] + cfg.COST_MIDA[s.mida] + cfg.COST_CONSTITUCIO[s.constitucio];
  for (const h of Object.values(s.habilitats)) cost += cfg.COST_HABILITAT[h.nivell];
  // Trets, artefactes i efectes compten dins els PC del manual (p. ex. Anya Barker: 200 PC).
  for (const it of actor.items) if (["tret", "artefacte", "efecte"].includes(it.type)) cost += it.system.cost;
  return cost;
}

function derivatsActor(actor) {
  const s = actor.system;
  // Incorporis (manual l. 1218): PER fa d'AGI i APL fa de FOR en els secundaris.
  const inc = s.especie === "incorpori";
  const agi = inc ? s.atributs.PER : s.atributs.AGI;
  const forca = inc ? s.atributs.APL : s.atributs.FOR;
  const d = {
    latencia: Math.max(1, 10 + s.mida - 2 * agi),
    defensa: agi + cfg.MIDA_DEFENSA[s.mida],
    reduccioDany: forca,
    reaccio: 1
  };
  for (const it of actor.items) {
    if (it.type === "armadura" && it.system.equipada !== false) d.latencia += it.system.modLatencia;
    const ef = it.type === "tret" ? it.system.efecte : null;
    if (!ef?.stat) continue;
    if (ef.stat === "latenciaBase") d.latencia += ef.delta;
    if (ef.stat === "defensa") d.defensa += ef.delta;
    if (ef.stat === "reduccioDany") d.reduccioDany += ef.delta;
    if (ef.stat === "reaccionsMax") d.reaccio += ef.delta;
  }
  d.latencia = Math.max(1, d.latencia);
  return d;
}

test("comptes de documents per compendi", () => {
  assert.equal(delManual("pj").length, 6);
  assert.equal(delManual("pnj").length, 25);
  assert.equal(delManual("animals").length, 7);
  assert.equal(delManual("criatures").length, 9);
  // La porta d'Hèkate: 8 PJ pregenerats, 13 PNJ i 4 criatures, en una carpeta de cada compendi.
  const perPack = p => AVENTURA.filter(a => a.pack === p).length;
  assert.deepEqual([perPack("pj"), perPack("pnj"), perPack("animals"), perPack("criatures")], [8, 13, 0, 4]);
  for (const { pack, actor } of AVENTURA) {
    const carpeta = JSON.parse(fs.readFileSync(path.join(FONTS, pack, "_carpeta-hekate.json"), "utf8"));
    assert.equal(actor.folder, carpeta._id);
    assert.equal(carpeta._key, `!folders!${carpeta._id}`);
  }
  assert.equal(PACKS.artefactes.length, 20); // 18 del manual + 2 ègides ancestrals (La porta d'Hèkate)
  assert.equal(PACKS.efectes.length, 65);
  assert.equal(PACKS.trets.length, 99); // 95 del manual + 4 variants de Tòxic (La porta d'Hèkate)
  assert.equal(PACKS.armes.length, 29); // 27 del manual + armes de dispersió i de suport (Fase 6)
  assert.equal(PACKS.armadures.length, 5);
});

test("els fitxers font coincideixen amb el que genera l'script (no estan desfasats)", () => {
  const { actors, comptes, actorsAventura } = generar({ escriureFitxers: false });
  assert.equal(actors.length, 47);
  assert.equal(comptes.pj, delManual("pj").length);
  const perId = new Map(TOTS.map(a => [a.actor._id, a.actor]));
  for (const { actor } of [...actors, ...actorsAventura]) {
    assert.deepEqual(perId.get(actor._id), actor, `${actor.name} desfasat: torna a executar node scripts/build-packs.mjs`);
  }
});

test("_id de 16 caràcters alfanumèrics, únics, i _key correctes", () => {
  const re = /^[A-Za-z0-9]{16}$/;
  const vistos = new Set();
  const unic = id => { assert.ok(!vistos.has(id), `_id duplicat ${id}`); vistos.add(id); };
  for (const p of ["trets", "armes", "armadures", "artefactes", "efectes"]) {
    for (const it of PACKS[p]) {
      assert.match(it._id, re);
      assert.equal(it._key, `!items!${it._id}`);
      assert.ok(it.flags?.forja?.catalegId, `${p}/${it.name} sense catalegId`);
      unic(`${p}${it._id}`);
    }
  }
  for (const { actor } of TOTS) {
    assert.match(actor._id, re);
    assert.equal(actor._key, `!actors!${actor._id}`);
    unic(`actor${actor._id}`);
    for (const it of actor.items) {
      assert.match(it._id, re);
      assert.equal(it._key, `!actors.items!${actor._id}.${it._id}`);
      assert.ok(it.flags?.forja?.catalegId, `${actor.name}/${it.name} sense catalegId`);
      unic(`${actor._id}${it._id}`);
    }
  }
});

test("tipus d'actor, tier i fitxa de token", () => {
  const tiers = { animals: "animal", criatures: "criatura" };
  for (const { pack, actor } of TOTS) {
    if (pack === "pj") {
      assert.equal(actor.type, "personatge");
      assert.equal(actor.prototypeToken.actorLink, true);
      assert.equal(actor.prototypeToken.disposition, 1);
      assert.equal(actor.system.pc, actor.flags.forja.aventura ? 150 : 200);
      assert.ok(actor.system.biografia.startsWith("<p>"), `${actor.name} sense biografia`);
    } else {
      assert.equal(actor.type, "pnj");
      assert.equal(actor.prototypeToken.actorLink, false);
      assert.equal(actor.prototypeToken.disposition, -1);
      assert.ok(["extra", "antagonista", "nemesis", "criatura", "animal"].includes(actor.system.tier));
      if (tiers[pack]) assert.equal(actor.system.tier, tiers[pack]);
    }
  }
  const nem = delManual("pnj").filter(a => a.system.tier === "nemesis");
  assert.deepEqual(nem.map(a => a.name), ["Renegat"]);
  assert.equal(delManual("pnj").filter(a => a.system.tier === "extra").length, 2);
});

test("totes les habilitats són ids vàlids i els valors són dins dels límits del DataModel", () => {
  for (const { actor } of TOTS) {
    const s = actor.system;
    for (const [id, h] of Object.entries(s.habilitats)) {
      assert.ok(cfg.HABILITATS.includes(id), `${actor.name}: habilitat ${id}`);
      assert.ok(h.nivell >= 0 && h.nivell <= 10);
    }
    for (const v of Object.values(s.atributs)) assert.ok(v >= 0 && v <= 5);
    assert.ok(s.mida >= 1 && s.mida <= 5 && s.constitucio >= 1 && s.constitucio <= 5);
    assert.ok(s.especie in cfg.COST_ESPECIE, `${actor.name}: espècie ${s.especie}`);
  }
  const nagata = PACKS.pj.find(a => a.name === "Magistrat Nagata");
  assert.equal(nagata.system.habilitats.ofici.especialitat, "magistrat");
});

test("cada actor té el 'Cop' bàsic i l'arma natural dels seus trets d'armament natural", () => {
  const natural = { "armament-urpes": "urpes", "armament-mossegada": "ullals", "armament-banyes": "banyes",
    "armament-pinces": "pinces", "armament-fiblons": "fiblons-i-espines" };
  for (const { actor } of TOTS) {
    const armes = actor.items.filter(i => i.type === "arma");
    const cop = armes.find(a => a.flags.forja.catalegId === "cop");
    assert.ok(cop?.system.basic, `${actor.name} sense Cop`);
    for (const t of actor.items.filter(i => i.type === "tret")) {
      const arma = natural[t.flags.forja.catalegId];
      if (arma) assert.ok(armes.some(a => a.flags.forja.catalegId === arma), `${actor.name}: falta l'arma ${arma}`);
    }
    // cap arma duplicada
    const ids = armes.map(a => a.flags.forja.catalegId);
    assert.equal(new Set(ids).size, ids.length);
  }
});

test("trets amb valor X: el cost embegut = multiplicador*X o X/divisor, i X és a flags.forja.valorX", () => {
  const cat = Object.fromEntries(PACKS.trets.map(t => [t.flags.forja.catalegId, t]));
  const mult = { "bracos-addicionals": 5, "potes-addicionals": 5, tentacles: 5, "curacio-rapida": 15 };
  for (const { actor } of TOTS) {
    for (const it of actor.items.filter(i => i.type === "tret")) {
      assert.ok(cat[it.flags.forja.catalegId], `${actor.name}: tret ${it.name} fora del catàleg`);
      const m = mult[it.flags.forja.catalegId];
      if (m) assert.equal(it.system.cost, m * Math.max(1, it.flags.forja.valorX));
    }
  }
});

test("cost en PC recalculat = cost del manual (cap excepció oculta)", () => {
  const fallades = [];
  for (const { pack, actor } of ACTORS) {
    const manual = actor.flags.forja.costManual;
    assert.ok(Number.isInteger(manual));
    const calc = costActor(actor);
    const clau = `${pack}/${actor.name}/cost`;
    if (calc !== manual) {
      if (!(clau in EXCEPCIONS_CONEGUDES)) fallades.push(`${clau}: manual ${manual}, calculat ${calc}`);
    } else {
      assert.ok(!(clau in EXCEPCIONS_CONEGUDES), `${clau} ja quadra: treu-la de les excepcions`);
    }
  }
  assert.deepEqual(fallades, []);
});

test("latència, defensa, reducció de dany i reacció recalculades = les del manual", () => {
  const fallades = [];
  for (const { pack, actor } of ACTORS) {
    const manual = actor.flags.forja.derivatsManual;
    assert.ok(manual, `${actor.name} sense derivats del manual`);
    const d = derivatsActor(actor);
    for (const camp of ["latencia", "defensa", "reduccioDany", "reaccio"]) {
      const clau = `${pack}/${actor.name}/${camp}`;
      if (d[camp] !== manual[camp] && !(clau in EXCEPCIONS_CONEGUDES)) {
        fallades.push(`${clau}: manual ${manual[camp]}, calculat ${d[camp]}`);
      }
    }
  }
  assert.deepEqual(fallades, []);
});

test("artefactes i efectes embeguts coincideixen amb el catàleg (cost i dades)", () => {
  const cat = { artefacte: PACKS.artefactes, efecte: PACKS.efectes };
  let total = 0;
  for (const { actor } of ACTORS) {
    for (const it of actor.items.filter(i => i.type === "artefacte" || i.type === "efecte")) {
      const ref = cat[it.type].find(c => c.flags.forja.catalegId === it.flags.forja.catalegId);
      assert.ok(ref, `${actor.name}: ${it.name} no és al catàleg`);
      assert.deepEqual(it.system, ref.system);
      total++;
    }
  }
  assert.ok(total >= 15, "s'esperen els artefactes i efectes dels blocs del manual");
  // Casos concrets: Anya Barker té tres efectes psíquics, Trace una espasa serra, Il·luminat errant dos efectes de Qi.
  const noms = n => PACKS.pj.concat(PACKS.pnj).find(a => a.name === n).items
    .filter(i => i.type === "artefacte" || i.type === "efecte").map(i => i.name).sort();
  assert.deepEqual(noms("Anya Barker"), ["Accelerar", "Negar el dany", "Sonda mental"]);
  assert.deepEqual(noms("Trace"), ["Espasa serra"]);
  assert.equal(noms("Il·luminat errant").length, 2);
});

test("la informació de l'informe és coherent: res no queda sense mapar", () => {
  const { incidencies } = generar({ escriureFitxers: false });
  const greus = incidencies.filter(i => ["no-mapat", "no-analitzable"].includes(i.tipus));
  assert.deepEqual(greus, []);
});
