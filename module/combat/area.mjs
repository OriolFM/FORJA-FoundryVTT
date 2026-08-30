/**
 * Motor de resolució d'àrea (nou, general): reutilitzat per maniobres
 * (Puntada de peu giratòria), armes (dispersió, suport, escopetes),
 * efectes sobrenaturals i artefactes. El manual no defineix aquestes
 * formes explícitament (cap terme "esfèric"/"lliure"/"llàgrima" hi
 * apareix) — són una taxonomia pròpia del disseny, confirmada amb
 * l'Oriol abans d'implementar-la.
 *
 * Convenció de "radi": compta la casella d'origen/objectiu com a capa 1
 * (radi=1 -> només el centre; radi=2 -> centre + 1 anell de veïnes;
 * radi=3 -> +1 anell més...). Confirmat amb l'exemple del propi Oriol
 * ("radi bàsic de 2 = casella objectiu + una casella addicional").
 *
 * Tres formes:
 *   - **Esfèric**: centre + radi -> tots els tokens dins el radi.
 *   - **Lliure**: llista de caselles triades a mà (mateix nombre de
 *     caselles que un esfèric del mateix cost, segons `nombreCaselesPerRadi`).
 *   - **Llàgrima**: origen + destí -> tokens en línia, en ordre de
 *     distància, aturant-se al primer mur o al primer objectiu que "fa
 *     de pantalla" (mida estrictament més gran que el següent objectiu).
 *
 * Regla comuna a les tres formes (confirmada amb l'Oriol): un mur entre
 * el punt d'origen i una casella/objectiu concret el bloqueja igual que
 * bloquejaria una llàgrima — cada candidat es filtra individualment amb
 * `ClockwiseSweepPolygon.testCollision`, no només amb la forma geomètrica.
 * La "pantalla" per mida gran, en canvi, és NOMÉS per a la llàgrima (un
 * atac esfèric/lliure no es propaga seqüencialment, així que un objectiu
 * no en pot protegir un altre, només un mur ho fa).
 *
 * S'usa `canvas.grid.getAdjacentOffsets` (BFS anell a anell) enlloc d'una
 * fórmula tancada de coordenades hexagonals: funciona igual per a
 * graelles hexagonals i quadrades sense necessitat de detectar quin
 * tipus és, i evita re-derivar geometria hexagonal a mà.
 */

/**
 * Totes les caselles (offsets `{i,j}`) dins `radi` anells del centre,
 * incloent-hi el centre mateix.
 * @param {{i:number,j:number}} offsetCentre
 * @param {number} radi  1 = només el centre.
 * @returns {Array<{i:number,j:number}>}
 */
export function caselesDinsRadi(offsetCentre, radi) {
  const anells = Math.max(0, radi - 1);
  const key = (o) => `${o.i},${o.j}`;
  const visitats = new Map([[key(offsetCentre), offsetCentre]]);
  let frontera = [offsetCentre];

  for (let n = 0; n < anells; n++) {
    const propers = [];
    for (const o of frontera) {
      for (const veina of canvas.grid.getAdjacentOffsets(o)) {
        const k = key(veina);
        if (!visitats.has(k)) {
          visitats.set(k, veina);
          propers.push(veina);
        }
      }
    }
    frontera = propers;
  }
  return [...visitats.values()];
}

/**
 * Nombre de caselles que cobreix un esfèric d'aquest radi — mateix
 * nombre de caselles que ha de poder triar un "lliure" del mateix cost.
 * @param {number} radi
 * @returns {number}
 */
export function nombreCaselesPerRadi(radi) {
  return caselesDinsRadi({ i: 0, j: 0 }, radi).length;
}

/**
 * Si hi ha un mur entre dos punts (coordenades de píxel de l'escena).
 * @param {{x:number,y:number}} origen
 * @param {{x:number,y:number}} desti
 * @returns {boolean}
 */
export function hiHaMurEntre(origen, desti) {
  return foundry.canvas.geometry.ClockwiseSweepPolygon.testCollision(origen, desti, { type: "move", mode: "any" });
}

/**
 * Punt exacte (píxels) on el segment origen->desti topa amb el primer mur,
 * o `null` si no n'hi ha cap (S-12, Llançament: cal saber ON parar el
 * token, no només SI hi ha un mur pel mig).
 * @param {{x:number,y:number}} origen
 * @param {{x:number,y:number}} desti
 * @returns {{x:number,y:number}|null}
 */
export function puntColisio(origen, desti) {
  const r = foundry.canvas.geometry.ClockwiseSweepPolygon.testCollision(origen, desti, { type: "move", mode: "closest" });
  return r ? { x: r.x, y: r.y } : null;
}

/**
 * Tokens del canvas el centre dels quals cau dins alguna de les
 * `offsets` donades.
 * @param {Array<{i:number,j:number}>} offsets
 * @param {Token[]} [excloure]
 * @returns {Token[]}
 */
export function tokensEnCaselles(offsets, excloure = []) {
  const exclosos = new Set(excloure.map(t => t.id));
  const punts = offsets.map(o => canvas.grid.getCenterPoint(o));
  const resultat = new Set();
  for (const token of canvas.tokens.placeables) {
    if (exclosos.has(token.id)) continue;
    for (const p of punts) {
      if (token.bounds.contains(p.x, p.y)) { resultat.add(token); break; }
    }
  }
  return [...resultat];
}

/**
 * Objectius d'un atac ESFÈRIC: tots els tokens dins `radi` caselles del
 * `centreOffset`, exceptuant els que tinguin un mur pel mig respecte a
 * `origen` (el punt real des d'on es llança l'efecte/arma — normalment
 * el mateix centre, però es passa per separat perquè en pot no ser-ho).
 * @param {object} p
 * @param {{x:number,y:number}} p.origen
 * @param {{i:number,j:number}} p.centreOffset
 * @param {number} p.radi
 * @param {Token[]} [p.excloure]
 * @returns {Token[]}
 */
export function objectiusEsferic({ origen, centreOffset, radi, excloure = [] }) {
  const caselles = caselesDinsRadi(centreOffset, radi);
  const candidats = tokensEnCaselles(caselles, excloure);
  return candidats.filter(t => !hiHaMurEntre(origen, t.center));
}

/**
 * Objectius d'un atac LLIURE: mateix filtre de mur que l'esfèric, però
 * sobre una llista de caselles triada a mà (no generada per radi).
 * @param {object} p
 * @param {{x:number,y:number}} p.origen
 * @param {Array<{i:number,j:number}>} p.caselles
 * @param {Token[]} [p.excloure]
 * @returns {Token[]}
 */
export function objectiusLliure({ origen, caselles, excloure = [] }) {
  const candidats = tokensEnCaselles(caselles, excloure);
  return candidats.filter(t => !hiHaMurEntre(origen, t.center));
}

/**
 * Objectius d'un atac de LLÀGRIMA: tokens que cauen prop del segment
 * origen->destí (a mig gruix de casella de la línia com a màxim),
 * ordenats per distància a l'origen. S'atura la propagació (deixa de
 * considerar tokens més enllà) al primer mur, o just DESPRÉS del primer
 * objectiu la mida del qual sigui estrictament més gran que la del
 * següent objectiu de la línia (li fa de pantalla).
 * @param {object} p
 * @param {{x:number,y:number}} p.origen
 * @param {{x:number,y:number}} p.desti
 * @param {Token[]} [p.excloure]
 * @returns {Token[]}
 */
export function objectiusLlagrima({ origen, desti, excloure = [] }) {
  const exclosos = new Set(excloure.map(t => t.id));
  const gruixMaxim = (canvas.grid?.sizeX ?? canvas.grid?.size ?? 100) / 2;

  const dx = desti.x - origen.x, dy = desti.y - origen.y;
  const llargSegment2 = dx * dx + dy * dy;

  const candidats = [];
  for (const token of canvas.tokens.placeables) {
    if (exclosos.has(token.id)) continue;
    const c = token.center;
    // Projecció del centre del token sobre el segment origen->destí (0..1)
    const t = llargSegment2 > 0 ? Math.max(0, Math.min(1, ((c.x - origen.x) * dx + (c.y - origen.y) * dy) / llargSegment2)) : 0;
    const px = origen.x + t * dx, py = origen.y + t * dy;
    const distPerpendicular = Math.hypot(c.x - px, c.y - py);
    if (distPerpendicular > gruixMaxim) continue;
    const distOrigen = Math.hypot(c.x - origen.x, c.y - origen.y);
    candidats.push({ token, distOrigen });
  }
  candidats.sort((a, b) => a.distOrigen - b.distOrigen);

  const resultat = [];
  for (let i = 0; i < candidats.length; i++) {
    const { token } = candidats[i];
    if (hiHaMurEntre(origen, token.center)) break;
    resultat.push(token);
    const midaActual = token.actor?.system?.mida ?? 0;
    const seguent = candidats[i + 1]?.token;
    const midaSeguent = seguent?.actor?.system?.mida ?? 0;
    if (seguent && midaActual > midaSeguent) break; // fa de pantalla
  }
  return resultat;
}
