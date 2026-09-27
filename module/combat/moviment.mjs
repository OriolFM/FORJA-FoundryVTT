/**
 * Moviment (WP-M): lògica pura, sense globals de Foundry en importar-se.
 *
 * - Distàncies de caminar / córrer / saltar (derivats de l'actor).
 * - Regla de bloqueig entre tokens (qui es pot travessar i qui no).
 * - Tipus de moviment d'una acció declarada i el seu permís en metres.
 * - Cerca A* sobre un graf abstracte (veïns + cost), per al pathfinding del
 *   token (`module/canvas/token.mjs`).
 *
 * Manual FC001CA › "Moviment dels PJ" (l. 2666–2704) i › "Temps actiu" ›
 * "Moviment" (l. 2790–2794). Les fórmules de distància NO són del manual
 * (que només diu que "el DJ decideix [...] en base a la seva mida i AGI",
 * l. 2668): són les de la versió antiga, confirmades per l'Oriol FM
 * (2026-09-27).
 */

/* -------------------------------------------- */
/*  Distàncies                                   */
/* -------------------------------------------- */

/**
 * Distàncies de moviment en metres (Oriol FM, 2026-09-27). Mínim 1 m cadascuna.
 * - Caminar (moviment bàsic)          = AGI×2 + MID − 3
 * - Córrer (moviment ràpid i càrrega) = AGI×5 + (MID − 3)×2
 * - Saltar                            = AGI×3 + ⌈(MID − 3)/2⌉
 * @param {number} agi   Atribut AGI
 * @param {number} mida  Mida (1 diminuta … 5 enorme)
 * @returns {{caminar:number, correr:number, saltar:number}}
 */
export function distanciesMoviment(agi, mida) {
  const a = Number(agi) || 0;
  const m = Number(mida) || 0;
  return {
    caminar: Math.max(1, a * 2 + m - 3),
    correr:  Math.max(1, a * 5 + (m - 3) * 2),
    saltar:  Math.max(1, a * 3 + Math.ceil((m - 3) / 2))
  };
}

/* -------------------------------------------- */
/*  Bloqueig entre tokens                        */
/* -------------------------------------------- */

/** Disposicions de token (valors de `CONST.TOKEN_DISPOSITIONS`, repetits aquí per no dependre de Foundry). */
export const DISPOSICIO = Object.freeze({ SECRET: -2, HOSTILE: -1, NEUTRAL: 0, FRIENDLY: 1 });

/**
 * Dos tokens són enemics si un és amistós i l'altre hostil (Oriol FM,
 * 2026-09-27). Neutral i secret no són enemics de ningú.
 * @param {number} a  Disposició del token que es mou
 * @param {number} b  Disposició de l'altre token
 * @returns {boolean}
 */
export function sonEnemics(a, b) {
  return (a === DISPOSICIO.FRIENDLY && b === DISPOSICIO.HOSTILE)
      || (a === DISPOSICIO.HOSTILE && b === DISPOSICIO.FRIENDLY);
}

/**
 * Un token (`altre`) bloqueja el pas del que es mou? (Oriol FM, 2026-09-27)
 * - Els morts (estat "dead") no bloquegen.
 * - Els amagats no bloquegen per als jugadors (no es revelen).
 * - Mida ≥ 3 (mitjana o més gran): bloqueja sempre.
 * - Mida ≤ 2 (petita o diminuta): es pot travessar, tret que sigui enemic.
 * Un token sense actor (mida desconeguda) es tracta com a mida mitjana.
 *
 * @param {object} p
 * @param {number}  p.disposicioMou    Disposició del token que es mou
 * @param {object}  p.altre
 * @param {number}  [p.altre.mida=3]
 * @param {number}  p.altre.disposicio
 * @param {boolean} [p.altre.mort=false]
 * @param {boolean} [p.altre.amagat=false]  Amagat per a l'usuari actual
 * @returns {boolean}
 */
export function bloquejaPas({ disposicioMou, altre }) {
  if (!altre || altre.mort || altre.amagat) return false;
  const mida = Number.isFinite(altre.mida) ? altre.mida : 3;
  if (mida >= 3) return true;
  return sonEnemics(disposicioMou, altre.disposicio);
}

/**
 * Un token (`altre`) ocupa espai on no es pot acabar el moviment? Cap token
 * pot acabar el moviment a l'espai d'un altre (Oriol FM, 2026-09-27), tret
 * dels morts i dels que l'usuari no veu.
 * @param {{mort?:boolean, amagat?:boolean}} altre
 * @returns {boolean}
 */
export function impedeixAcabar(altre) {
  return !!altre && !altre.mort && !altre.amagat;
}

/* -------------------------------------------- */
/*  Tipus de moviment d'una acció                */
/* -------------------------------------------- */

/**
 * Tipus de moviment que es poden declarar amb una acció (manual l. 2678–2694,
 * 2746–2754 i 2792–2794; Oriol FM, 2026-09-27):
 * - `basic`: moviment bàsic (caminar). És el per defecte: en el seu torn, un
 *   personatge sempre pot caminar a més de fer l'acció declarada.
 * - `rapid`: moviment ràpid (córrer); no es pot combinar amb cap altra acció.
 * - `especial`: moviment especial (cal tirada, que no s'automatitza): +2 de
 *   latència, distància de caminar.
 * - `carrega`: moviment ràpid + atac cos a cos; +2 de latència i, si el
 *   moviment és de 2 m o més, +1 dau a l'atac i +1 al dany si impacta.
 */
export const TIPUS_MOVIMENT = Object.freeze(["basic", "rapid", "especial", "carrega"]);

/** Latència extra dels moviments especials (inclosa la càrrega), manual l. 2694 i 2792. */
export const LATENCIA_MOVIMENT_ESPECIAL = 2;

/** Metres mínims de moviment perquè la càrrega doni la bonificació (manual l. 2794). */
export const METRES_MINIMS_CARREGA = 2;

/**
 * Normalitza un tipus de moviment; qualsevol valor desconegut o absent és
 * `basic` (Oriol FM, 2026-09-27: el moviment bàsic va implícit en l'acció).
 * @param {string} [tipus]
 * @returns {"basic"|"rapid"|"especial"|"carrega"}
 */
export function normalitzarMoviment(tipus) {
  return TIPUS_MOVIMENT.includes(tipus) ? tipus : "basic";
}

/**
 * Latència extra que suma el moviment declarat (manual l. 2792: "Els
 * moviments bàsics i ràpids es fan amb la latència bàsica del PJ, però els
 * moviments especials afegeixen 2 punts"; l. 2794, càrrega).
 * @param {string} tipus
 * @returns {number}
 */
export function latenciaExtraMoviment(tipus) {
  const t = normalitzarMoviment(tipus);
  return (t === "especial" || t === "carrega") ? LATENCIA_MOVIMENT_ESPECIAL : 0;
}

/**
 * Metres que el tipus de moviment permet recórrer en un torn.
 * Caminar per a `basic` i `especial`; córrer per a `rapid` i `carrega`.
 * @param {string} tipus
 * @param {{caminar:number, correr:number}} distancies
 * @returns {number}
 */
export function permisMoviment(tipus, distancies) {
  const t = normalitzarMoviment(tipus);
  if (t === "rapid" || t === "carrega") return distancies?.correr ?? 0;
  return distancies?.caminar ?? 0;
}

/** Tolerància en metres per a errors d'arrodoniment de la mesura de Foundry. */
const TOLERANCIA_METRES = 1e-6;

/**
 * El permís és ACUMULATIU per a tot el torn (Oriol FM, 2026-09-27): el
 * jugador pot arrossegar el token tants cops com vulgui fins que exhaureix
 * la distància. `jaMogut` és tot el que s'ha mogut des que ha començat el
 * torn (historial de moviment del token, que Foundry buida a l'inici de cada
 * torn) i `nou` és el tram que es vol afegir.
 * @param {object} p
 * @param {number} p.jaMogut  Metres ja moguts aquest torn
 * @param {number} p.nou      Metres del moviment nou
 * @param {number} p.permis   Metres permesos
 * @returns {{permes:boolean, total:number, restant:number}}
 */
export function comprovarPermis({ jaMogut, nou, permis }) {
  const total = (Number(jaMogut) || 0) + (Number(nou) || 0);
  const perm  = Math.max(0, Number(permis) || 0);
  return {
    permes:  total <= perm + TOLERANCIA_METRES,
    total,
    restant: Math.max(0, perm - (Number(jaMogut) || 0))
  };
}

/**
 * Tipus de moviment que val per al torn que el combatent fa ARA.
 *
 * L'acció pendent (`flags.forja.accioPendent`) és la que es declara per al
 * PROPER torn; la que es resol ara és l'anterior. Si el combatent redeclara
 * durant el seu propi torn, el diàleg desa a la nova acció el moviment del
 * torn en curs (`movimentEnCurs`, amb el combat i el marcador on es va
 * declarar); així, declarar la propera acció no canvia el permís del torn
 * que encara s'està jugant.
 * @param {object|null} pendent        `flags.forja.accioPendent`
 * @param {string} combatId
 * @param {number} marcador            Marcador actual del rellotge
 * @returns {"basic"|"rapid"|"especial"|"carrega"}
 */
export function movimentDelTorn(pendent, combatId, marcador) {
  if (!pendent) return "basic";
  if (pendent.combatId === combatId && pendent.declaradaAlMarcador === marcador
      && pendent.movimentEnCurs != null) {
    return normalitzarMoviment(pendent.movimentEnCurs);
  }
  return normalitzarMoviment(pendent.moviment);
}

/**
 * Bonificació de càrrega (manual l. 2794): "Una càrrega és un moviment
 * especial que combina un moviment ràpid amb un atac cos a cos. Com a
 * moviment especial, afegeix 2 punts a la latència, i si el moviment és de 2
 * metres o més, dóna 1 dau addicional a la tirada d'atac i al dany (si
 * l'atac impacta)." El dany de FORJA no es tira (dany base + excedent), per
 * això el "dau addicional al dany" es tradueix en +1 al dany de l'atac.
 * @param {string} tipus       Moviment declarat
 * @param {number} metres      Metres moguts aquest torn
 * @returns {{daus:number, dany:number}}
 */
export function bonificacioCarrega(tipus, metres) {
  if (normalitzarMoviment(tipus) !== "carrega") return { daus: 0, dany: 0 };
  if (!((Number(metres) || 0) + TOLERANCIA_METRES >= METRES_MINIMS_CARREGA)) return { daus: 0, dany: 0 };
  return { daus: 1, dany: 1 };
}

/* -------------------------------------------- */
/*  A* abstracte                                 */
/* -------------------------------------------- */

/** Cua de prioritat mínima (heap binari) per a l'A*. */
class CuaPrioritat {
  #h = [];
  get mida() { return this.#h.length; }
  afegir(valor, prioritat) {
    const h = this.#h;
    h.push({ valor, prioritat });
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (h[p].prioritat <= h[i].prioritat) break;
      [h[p], h[i]] = [h[i], h[p]];
      i = p;
    }
  }
  treure() {
    const h = this.#h;
    const top = h[0];
    const last = h.pop();
    if (h.length && last) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < h.length && h[l].prioritat < h[m].prioritat) m = l;
        if (r < h.length && h[r].prioritat < h[m].prioritat) m = r;
        if (m === i) break;
        [h[m], h[i]] = [h[i], h[m]];
        i = m;
      }
    }
    return top?.valor;
  }
}

/**
 * Cerca A* sobre un graf abstracte (sense Foundry). Limitada a `maxNodes`
 * expansions perquè no pugui congelar mai el client.
 *
 * Si l'objectiu no és assolible (bloquejat o fora de límit), torna el camí
 * fins al node explorat més proper a l'objectiu (heurística mínima) que
 * sigui un final vàlid; si no n'hi ha cap, només l'inici.
 *
 * @template N
 * @param {object} p
 * @param {N} p.inici
 * @param {N} p.objectiu
 * @param {(n:N) => string} p.clau                          Identificador únic d'un node
 * @param {(n:N) => Array<{node:N, cost:number}>} p.veins   Veïns transitables i cost del pas
 * @param {(n:N) => number} p.heuristica                    Estimació del cost fins a l'objectiu
 * @param {(n:N) => boolean} [p.esFinalValid]               Si el moviment pot acabar en aquest node
 * @param {number} [p.maxNodes=2000]
 * @returns {{cami:N[], complet:boolean, cost:number, expandits:number}}
 */
export function cercarCami({ inici, objectiu, clau, veins, heuristica, esFinalValid = () => true, maxNodes = 2000 }) {
  const clauObjectiu = clau(objectiu);
  const clauInici = clau(inici);
  const g = new Map([[clauInici, 0]]);
  const pare = new Map();
  const nodes = new Map([[clauInici, inici]]);
  const tancats = new Set();
  const oberts = new CuaPrioritat();
  oberts.afegir(clauInici, heuristica(inici));

  let millor = null;           // node final vàlid més proper a l'objectiu
  let millorH = Infinity;
  let expandits = 0;

  const reconstruir = (k) => {
    const cami = [];
    for (let c = k; c !== undefined; c = pare.get(c)) cami.push(nodes.get(c));
    return cami.reverse();
  };

  while (oberts.mida && expandits < maxNodes) {
    const k = oberts.treure();
    if (tancats.has(k)) continue;
    tancats.add(k);
    const node = nodes.get(k);
    const valid = esFinalValid(node);

    if (k === clauObjectiu && valid) {
      return { cami: reconstruir(k), complet: true, cost: g.get(k), expandits };
    }
    if (valid) {
      const h = heuristica(node);
      if (h < millorH || (h === millorH && g.get(k) < g.get(millor))) { millor = k; millorH = h; }
    }
    expandits++;

    for (const { node: v, cost } of veins(node)) {
      if (!(cost < Infinity) || cost < 0) continue;
      const kv = clau(v);
      if (tancats.has(kv)) continue;
      const nouG = g.get(k) + cost;
      if (nouG < (g.get(kv) ?? Infinity)) {
        g.set(kv, nouG);
        pare.set(kv, k);
        nodes.set(kv, v);
        oberts.afegir(kv, nouG + heuristica(v));
      }
    }
  }

  if (millor === null) return { cami: [inici], complet: false, cost: 0, expandits };
  return { cami: reconstruir(millor), complet: false, cost: g.get(millor), expandits };
}

/**
 * Elimina els nodes intermedis alineats d'un camí (mateix vector de pas),
 * deixant només els punts on canvia de direcció.
 * @param {Array<{x:number, y:number}>} punts
 * @returns {Array<{x:number, y:number}>}
 */
export function simplificarCami(punts) {
  if (punts.length <= 2) return [...punts];
  const res = [punts[0]];
  for (let i = 1; i < punts.length - 1; i++) {
    const a = punts[i - 1], b = punts[i], c = punts[i + 1];
    const dx1 = b.x - a.x, dy1 = b.y - a.y, dx2 = c.x - b.x, dy2 = c.y - b.y;
    if (Math.abs(dx1 - dx2) > 0.5 || Math.abs(dy1 - dy2) > 0.5) res.push(b);
  }
  res.push(punts.at(-1));
  return res;
}
