// Proves de la lògica pura de moviment (WP-M): module/combat/moviment.mjs.
// No cal cap stub de Foundry: el mòdul no fa servir globals en importar-se.
import { test } from "node:test";
import assert from "node:assert/strict";

// URL file:// (no ruta): a Windows, import() no accepta rutes com E:\...
const REPO = new URL("../../", import.meta.url).href.replace(/\/$/, "");
const M = await import(`${REPO}/module/combat/moviment.mjs`);
const { DISPOSICIO: D } = M;

/* ---- Distàncies (Oriol FM, 2026-09-27) ---- */

test("distàncies: AGI 3 MID 3 → caminar 6, córrer 15, saltar 9", () => {
  assert.deepEqual(M.distanciesMoviment(3, 3), { caminar: 6, correr: 15, saltar: 9 });
});

test("distàncies: mida gran i petita", () => {
  // AGI 2 MID 5: 4+5-3=6; 10+4=14; 6+ceil(1)=7
  assert.deepEqual(M.distanciesMoviment(2, 5), { caminar: 6, correr: 14, saltar: 7 });
  // AGI 2 MID 2: 4+2-3=3; 10-2=8; 6+ceil(-0.5)=6 (ceil(-0.5) = -0)
  assert.deepEqual(M.distanciesMoviment(2, 2), { caminar: 3, correr: 8, saltar: 6 });
});

test("distàncies: es fixen a un mínim d'1 (AGI 1 MID 1 → caminar 1)", () => {
  const d = M.distanciesMoviment(1, 1);
  assert.equal(d.caminar, 1);          // 2 + 1 - 3 = 0 → 1
  assert.equal(d.correr, 1);           // 5 - 4 = 1
  assert.equal(d.saltar, 2);           // 3 + ceil(-1) = 2
  assert.deepEqual(M.distanciesMoviment(0, 1), { caminar: 1, correr: 1, saltar: 1 });
});

/* ---- Bloqueig ---- */

test("bloqueig: un aliat de mida 3 bloqueja", () => {
  assert.equal(M.bloquejaPas({ disposicioMou: D.FRIENDLY, altre: { mida: 3, disposicio: D.FRIENDLY } }), true);
});

test("bloqueig: un aliat de mida 2 es pot travessar", () => {
  assert.equal(M.bloquejaPas({ disposicioMou: D.FRIENDLY, altre: { mida: 2, disposicio: D.FRIENDLY } }), false);
  assert.equal(M.bloquejaPas({ disposicioMou: D.FRIENDLY, altre: { mida: 1, disposicio: D.NEUTRAL } }), false);
});

test("bloqueig: un enemic de mida 2 bloqueja", () => {
  assert.equal(M.bloquejaPas({ disposicioMou: D.FRIENDLY, altre: { mida: 2, disposicio: D.HOSTILE } }), true);
  assert.equal(M.bloquejaPas({ disposicioMou: D.HOSTILE, altre: { mida: 1, disposicio: D.FRIENDLY } }), true);
});

test("bloqueig: neutral no és enemic, però mida 3 neutral bloqueja", () => {
  assert.equal(M.bloquejaPas({ disposicioMou: D.NEUTRAL, altre: { mida: 2, disposicio: D.HOSTILE } }), false);
  assert.equal(M.bloquejaPas({ disposicioMou: D.FRIENDLY, altre: { mida: 3, disposicio: D.NEUTRAL } }), true);
});

test("bloqueig: els morts i els amagats no bloquegen; sense mida → mitjana", () => {
  assert.equal(M.bloquejaPas({ disposicioMou: D.FRIENDLY, altre: { mida: 4, disposicio: D.HOSTILE, mort: true } }), false);
  assert.equal(M.bloquejaPas({ disposicioMou: D.FRIENDLY, altre: { mida: 4, disposicio: D.HOSTILE, amagat: true } }), false);
  assert.equal(M.bloquejaPas({ disposicioMou: D.FRIENDLY, altre: { disposicio: D.FRIENDLY } }), true);
  assert.equal(M.impedeixAcabar({ mida: 1 }), true);
  assert.equal(M.impedeixAcabar({ mida: 1, mort: true }), false);
});

/* ---- Tipus de moviment i permís ---- */

const DIST = { caminar: 6, correr: 15 };

test("permís: caminar per a bàsic i especial, córrer per a ràpid i càrrega", () => {
  assert.equal(M.permisMoviment("basic", DIST), 6);
  assert.equal(M.permisMoviment("especial", DIST), 6);
  assert.equal(M.permisMoviment("rapid", DIST), 15);
  assert.equal(M.permisMoviment("carrega", DIST), 15);
  // "cap" ja no existeix (Oriol FM): tot allò desconegut és el bàsic implícit.
  assert.equal(M.permisMoviment("cap", DIST), 6);
  assert.equal(M.permisMoviment(undefined, DIST), 6);
});

test("latència extra: +2 només per a especial i càrrega", () => {
  assert.equal(M.latenciaExtraMoviment("basic"), 0);
  assert.equal(M.latenciaExtraMoviment("rapid"), 0);
  assert.equal(M.latenciaExtraMoviment("especial"), 2);
  assert.equal(M.latenciaExtraMoviment("carrega"), 2);
});

test("permís acumulatiu: caminar 6 → 2, 3 i 1 permesos; 1 més, bloquejat", () => {
  let jaMogut = 0;
  for (const tram of [2, 3, 1]) {
    const r = M.comprovarPermis({ jaMogut, nou: tram, permis: 6 });
    assert.equal(r.permes, true, `tram de ${tram} m després de ${jaMogut} m`);
    jaMogut += tram;
  }
  const r = M.comprovarPermis({ jaMogut, nou: 1, permis: 6 });
  assert.equal(r.permes, false);
  assert.equal(r.restant, 0);
});

test("permís: córrer permet més que caminar; tolerància d'arrodoniment", () => {
  assert.equal(M.comprovarPermis({ jaMogut: 0, nou: 10, permis: 6 }).permes, false);
  assert.equal(M.comprovarPermis({ jaMogut: 0, nou: 10, permis: 15 }).permes, true);
  assert.equal(M.comprovarPermis({ jaMogut: 5.9999999999, nou: 0, permis: 6 }).permes, true);
  assert.equal(M.comprovarPermis({ jaMogut: 4, nou: 1, permis: 6 }).restant, 2);
});

test("moviment del torn: acció pendent, o el desat si es redeclara en el mateix torn", () => {
  assert.equal(M.movimentDelTorn(null, "c1", 5), "basic");
  assert.equal(M.movimentDelTorn({ moviment: "rapid", combatId: "c1", declaradaAlMarcador: 2 }, "c1", 5), "rapid");
  const redeclarada = { moviment: "especial", combatId: "c1", declaradaAlMarcador: 5, movimentEnCurs: "carrega" };
  assert.equal(M.movimentDelTorn(redeclarada, "c1", 5), "carrega");
  // Al torn següent (un altre marcador), val la nova acció.
  assert.equal(M.movimentDelTorn(redeclarada, "c1", 9), "especial");
  // Un altre combat: no s'aplica el desat.
  assert.equal(M.movimentDelTorn(redeclarada, "c2", 5), "especial");
  // Sense moviment desat (null): la nova acció.
  assert.equal(M.movimentDelTorn({ ...redeclarada, movimentEnCurs: null }, "c1", 5), "especial");
});

test("càrrega: +1 dau i +1 dany només amb càrrega i 2 m o més (manual l. 2794)", () => {
  assert.deepEqual(M.bonificacioCarrega("carrega", 2), { daus: 1, dany: 1 });
  assert.deepEqual(M.bonificacioCarrega("carrega", 7.5), { daus: 1, dany: 1 });
  assert.deepEqual(M.bonificacioCarrega("carrega", 1), { daus: 0, dany: 0 });
  assert.deepEqual(M.bonificacioCarrega("rapid", 10), { daus: 0, dany: 0 });
});

/* ---- A* ---- */

/**
 * Quadrícula quadrada petita (8 veïns, cost 1 per pas) amb obstacles.
 * `mapa`: files de text, "#" = casella bloquejada.
 */
function graella(mapa) {
  const files = mapa.map(f => [...f]);
  const bloq = (i, j) => i < 0 || j < 0 || i >= files.length || j >= files[0].length || files[i][j] === "#";
  return {
    clau: o => `${o.i},${o.j}`,
    veins: o => {
      const out = [];
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue;
        const v = { i: o.i + di, j: o.j + dj };
        if (!bloq(v.i, v.j)) out.push({ node: v, cost: 1 });
      }
      return out;
    },
    heur: obj => o => Math.max(Math.abs(o.i - obj.i), Math.abs(o.j - obj.j))
  };
}

test("A*: rodeja un obstacle", () => {
  const g = graella([
    ".....",
    "..#..",
    "..#..",
    "..#..",
    "....."
  ]);
  const inici = { i: 2, j: 0 }, objectiu = { i: 2, j: 4 };
  const r = M.cercarCami({ inici, objectiu, clau: g.clau, veins: g.veins, heuristica: g.heur(objectiu) });
  assert.equal(r.complet, true);
  assert.deepEqual(r.cami[0], inici);
  assert.deepEqual(r.cami.at(-1), objectiu);
  assert.ok(r.cami.every(o => !(o.j === 2 && o.i >= 1 && o.i <= 3)), "no travessa la paret");
  assert.equal(r.cost, 4); // amb diagonals, rodejar-la costa el mateix que la recta (4 passos)
});

test("A*: completament bloquejat → camí parcial fins al punt més proper", () => {
  const g = graella([
    "..#..",
    "..#..",
    "..#.."
  ]);
  const inici = { i: 1, j: 0 }, objectiu = { i: 1, j: 4 };
  const r = M.cercarCami({ inici, objectiu, clau: g.clau, veins: g.veins, heuristica: g.heur(objectiu) });
  assert.equal(r.complet, false);
  assert.deepEqual(r.cami[0], inici);
  assert.equal(r.cami.at(-1).j, 1, "s'atura just abans de la paret");
});

test("A*: una destinació que no és final vàlid (ocupada) → s'atura al costat", () => {
  const g = graella(["....."]);
  const inici = { i: 0, j: 0 }, objectiu = { i: 0, j: 4 };
  const r = M.cercarCami({
    inici, objectiu, clau: g.clau, veins: g.veins, heuristica: g.heur(objectiu),
    esFinalValid: o => !(o.i === 0 && o.j === 4)
  });
  assert.equal(r.complet, false);
  assert.deepEqual(r.cami.at(-1), { i: 0, j: 3 });
});

test("A*: el límit de nodes evita cerques infinites", () => {
  // Graf infinit sense objectiu assolible.
  const r = M.cercarCami({
    inici: 0, objectiu: -1,
    clau: n => String(n),
    veins: n => [{ node: n + 1, cost: 1 }],
    heuristica: () => 1,
    esFinalValid: () => false,
    maxNodes: 50
  });
  assert.equal(r.complet, false);
  assert.ok(r.expandits <= 50);
  assert.deepEqual(r.cami, [0]);
});

test("simplificarCami: només deixa els girs", () => {
  const p = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 1 }, { x: 4, y: 2 }, { x: 4, y: 3 }];
  assert.deepEqual(M.simplificarCami(p), [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 4, y: 2 }, { x: 4, y: 3 }]);
});
