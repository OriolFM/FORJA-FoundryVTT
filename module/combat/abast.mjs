/**
 * Rang i abast (S-12, manual p. 675-699 per a distància; p. 609-613 per a
 * cos a cos; manual FC001CA, SISTEMES › Combat › Atacar / Cos a cos / A Distància).
 * Les distàncies es mesuren VORA A VORA entre tokens (B9). El moviment dels tokens el gestiona Foundry de manera nativa
 * (arrossegar-los pel canvas) — aquest mòdul només LLEGEIX la posició
 * actual dels tokens en el moment de resoldre i en tradueix la distància a
 * les regles de FORJA (banda de rang, dificultat bàsica, o si l'atac
 * simplement no pot arribar a l'objectiu).
 *
 * "automatitza el càlcul, mai la decisió" (DA-5/G-3): si l'objectiu és
 * fora d'abast, aquest mòdul no decideix per què (terreny, fugida...) —
 * simplement ho informa perquè el DJ mogui el token si escau i torni a
 * resoldre, o consideri l'acció perduda si no és versemblant poder-hi
 * arribar (el jugador ho torna a declarar al proper torn).
 */

/** Bandes de rang per a armes a distància (manual p. 705-715). */
const BANDES_DISTANCIA = [
  { id: "bocaCano", multiplicador: 0, dificultat: (def) => Math.ceil(def / 2) },
  { id: "curt",     multiplicador: 1, dificultat: (def) => def },
  { id: "mitja",    multiplicador: 2, dificultat: (def) => def + 1 },
  { id: "llarg",    multiplicador: 4, dificultat: (def) => def + 2 },
  { id: "extrem",   multiplicador: 8, dificultat: (def) => def + 3 }
];

/**
 * Rectangle (en píxels del canvas) que ocupa un token: `token.bounds` si hi és
 * (Token de v13), o calculat a partir del document (x, y, amplada/alçada en
 * caselles × mida de casella).
 * @param {Token} token
 * @returns {{x:number, y:number, width:number, height:number}}
 */
export function rectangleToken(token) {
  const b = token?.bounds;
  if (b && Number.isFinite(b.width) && b.width > 0) {
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  }
  const doc  = token?.document ?? token;
  const mida = canvas?.grid?.size ?? canvas?.dimensions?.size ?? 100;
  return { x: doc.x, y: doc.y, width: (doc.width ?? 1) * mida, height: (doc.height ?? 1) * mida };
}

/**
 * Punts més propers entre dos rectangles alineats amb els eixos (funció pura).
 * Si els intervals d'un eix se superposen, tots dos punts comparteixen
 * coordenada en aquell eix (la separació en aquell eix és 0).
 * @param {{x:number,y:number,width:number,height:number}} a
 * @param {{x:number,y:number,width:number,height:number}} b
 * @returns {[{x:number,y:number},{x:number,y:number}]}
 */
export function puntsMesPropers(a, b) {
  const eix = (a0, a1, b0, b1) => {
    if (a1 < b0) return [a1, b0];          // a queda abans que b
    if (b1 < a0) return [a0, b1];          // b queda abans que a
    const m = (Math.max(a0, b0) + Math.min(a1, b1)) / 2;  // superposats
    return [m, m];
  };
  const [ax, bx] = eix(a.x, a.x + a.width,  b.x, b.x + b.width);
  const [ay, by] = eix(a.y, a.y + a.height, b.y, b.y + b.height);
  return [{ x: ax, y: ay }, { x: bx, y: by }];
}

/**
 * Separació vora a vora entre dos rectangles, en caselles de graella
 * (funció pura, B9). Es pren el màxim de la separació horitzontal i
 * vertical (una diagonal que toca per una cantonada compta com a 0).
 * @param {{x:number,y:number,width:number,height:number}} a
 * @param {{x:number,y:number,width:number,height:number}} b
 * @param {number} midaCasella  Píxels per casella
 * @returns {number}
 */
export function separacioEnCaselles(a, b, midaCasella) {
  const gapX = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.width,  b.x + b.width));
  const gapY = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height));
  return Math.max(gapX, gapY) / (midaCasella || 1);
}

/**
 * Dos rectangles estan "a tocar" (manual, "Atacar": combat cos a cos quan
 * els antagonistes "es troben a tocar l'un de l'altre"; "A Distància": boca de
 * canó = objectiu "a tocar") si no hi ha cap casella sencera entre les seves
 * vores. Es tolera mitja casella perquè els tokens no sempre estan
 * perfectament encaixats a la graella (funció pura, B9).
 * @param {{x:number,y:number,width:number,height:number}} a
 * @param {{x:number,y:number,width:number,height:number}} b
 * @param {number} midaCasella
 * @returns {boolean}
 */
export function rectanglesATocar(a, b, midaCasella) {
  return separacioEnCaselles(a, b, midaCasella) < 0.5;
}

/**
 * Distància entre dos tokens (en unitats de l'escena — normalment metres),
 * mesurada VORA A VORA (B9): des del punt més proper de l'un fins al punt
 * més proper de l'altre, amb la graella de l'escena activa (quadrada,
 * hexagonal o sense graella). Així, dos tokens grans (mida 4-5, més d'una
 * casella) que es toquen estan a distància 0, com dos tokens d'1×1 adjacents.
 * @param {Token} tokenA
 * @param {Token} tokenB
 * @returns {number}
 */
export function distanciaEntreTokens(tokenA, tokenB) {
  const [pA, pB] = puntsMesPropers(rectangleToken(tokenA), rectangleToken(tokenB));
  if (pA.x === pB.x && pA.y === pB.y) return 0;
  return canvas.grid.measurePath([pA, pB]).distance;
}

/**
 * Comprova si dos tokens estan a tocar (vora a vora, B9).
 * @param {Token} tokenA
 * @param {Token} tokenB
 * @returns {boolean}
 */
export function tokensATocar(tokenA, tokenB) {
  const mida = canvas?.grid?.size ?? canvas?.dimensions?.size ?? 100;
  return rectanglesATocar(rectangleToken(tokenA), rectangleToken(tokenB), mida);
}

/**
 * Determina la banda de rang i la dificultat bàsica resultant per a un atac
 * a distància, segons l'abast curt de l'arma (`item.system.abast`, en
 * metres) i si té rang extrem (`rangExtrem`).
 *
 * Rang limitat (manual p. 725-731, armes improvisades a distància,
 * mecàniques —arcs/fones— i llancívoles): el rang curt no és un valor fix
 * sinó "la FOR del personatge" ×1/×3/×5 — `abast` es queda a 0 i
 * `rangMultFor` (1/3/5) ho fa calculable a partir de la FOR de l'atacant.
 *
 * @param {number} distancia      Distància actual entre atacant i objectiu
 * @param {Item}   arma           Arma a distància (`system.abast`, `system.rangExtrem`, `system.rangMultFor`)
 * @param {number} defensaBasica  Defensa bàsica de l'objectiu
 * @param {boolean} [aTocar]      Si l'objectiu és a tocar (vora a vora, `tokensATocar`) → boca de canó
 * @param {ForjaActor} [atacant]  Necessari només si l'arma té rang limitat
 *   (`rangMultFor > 0`), per llegir-ne la FOR.
 * @returns {{banda:string, dificultat:number}|null}
 *   `null` si l'abast és 0 i l'arma no té `rangMultFor` (rang realment
 *   desconegut, p. ex. "Armes pesants" — "varia" segons l'arma concreta,
 *   cal dificultat manual), o si l'objectiu és fora d'abast (més enllà del
 *   rang llarg, o de l'extrem si l'arma en té).
 */
export function bandaDistancia(distancia, arma, defensaBasica, aTocar = distancia <= 0, atacant = null) {
  const multFor = arma.system.rangMultFor ?? 0;
  const curt = multFor > 0 ? (atacant?.system?.atributs?.FOR ?? 0) * multFor : arma.system.abast;
  if (!curt) return null;

  if (aTocar || distancia <= 0) {
    return { banda: "bocaCano", dificultat: BANDES_DISTANCIA[0].dificultat(defensaBasica) };
  }

  for (const b of BANDES_DISTANCIA) {
    if (b.id === "bocaCano") continue;
    if (b.id === "extrem" && !arma.system.rangExtrem) continue;
    if (distancia <= curt * b.multiplicador) {
      return { banda: b.id, dificultat: b.dificultat(defensaBasica) };
    }
  }
  return null;
}

/**
 * Comprova si un atac cos a cos o d'armament natural pot arribar a
 * l'objectiu a partir d'una distància vora a vora ja mesurada
 * (`distanciaEntreTokens`): cal que no hi hagi cap casella sencera entre els
 * dos tokens (manual, "Atacar": "a tocar"). Preferiu `tokensATocar` quan es
 * tenen els tokens.
 * @param {number} distancia  Distància vora a vora (unitats d'escena)
 * @returns {boolean}
 */
export function estaAlAbastCosACos(distancia) {
  return distancia < (canvas.grid?.distance ?? 1);
}

/**
 * Avantatge d'abast en cos a cos (manual p. 609-613): "la puntuació
 * d'abast... és irrellevant quan els dos contrincants fan servir armes del
 * mateix abast. Si els abasts són diferents, el contendent amb l'abast més
 * gros... rep +1 a les tirades d'atac i defensa." Com que aquest sistema
 * no guarda quina arma concreta té cada PJ "equipada" (mateixa limitació
 * ja documentada a `defensa.mjs` per a Parar/Blocar), es compara l'arma
 * que l'atacant fa servir per atacar contra la millor (major abast) de les
 * armes cos a cos/naturals que el defensor posseeix.
 *
 * **Simplificació deliberada**: el manual permet "recuperar l'avantatge"
 * declarant un moviment per retallar distàncies — no s'intenta seguir
 * aquest estat persistent (qui té l'avantatge "ara mateix" segons quin
 * bàndol s'ha mogut últim); es recalcula de zero a cada atac, comparant
 * només les armes en joc en aquell moment.
 *
 * @param {Item} armaAtacant           Arma que fa servir l'atacant
 * @param {ForjaActor} defensor
 * @returns {{atacantAvantatge:boolean, defensorAvantatge:boolean}}
 */
export function avantatgeAbastCosACos(armaAtacant, defensor) {
  const abastAtacant = armaAtacant?.system?.abast ?? 0;
  const abastDefensor = Math.max(0, ...(defensor?.items ?? [])
    .filter(i => i.type === "arma" && i.system.categoria !== "distancia")
    .map(i => i.system.abast ?? 0));
  return {
    atacantAvantatge:  abastAtacant  > abastDefensor,
    defensorAvantatge: abastDefensor > abastAtacant
  };
}
