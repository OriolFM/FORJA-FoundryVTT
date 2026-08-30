/**
 * Rang i abast (S-12, manual p. 675-699 per a distància; p. 609-613 per a
 * cos a cos). El moviment dels tokens el gestiona Foundry de manera nativa
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
 * Distància entre dos tokens (en unitats de l'escena — normalment metres),
 * mesurada centre a centre amb la graella de la escena activa (funciona amb
 * graella quadrada, hexagonal o sense graella).
 * @param {Token} tokenA
 * @param {Token} tokenB
 * @returns {number}
 */
export function distanciaEntreTokens(tokenA, tokenB) {
  return canvas.grid.measurePath([tokenA.center, tokenB.center]).distance;
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
 * @param {ForjaActor} [atacant]  Necessari només si l'arma té rang limitat
 *   (`rangMultFor > 0`), per llegir-ne la FOR.
 * @returns {{banda:string, dificultat:number}|null}
 *   `null` si l'abast és 0 i l'arma no té `rangMultFor` (rang realment
 *   desconegut, p. ex. "Armes pesants" — "varia" segons l'arma concreta,
 *   cal dificultat manual), o si l'objectiu és fora d'abast (més enllà del
 *   rang llarg, o de l'extrem si l'arma en té).
 */
export function bandaDistancia(distancia, arma, defensaBasica, atacant = null) {
  const multFor = arma.system.rangMultFor ?? 0;
  const curt = multFor > 0 ? (atacant?.system?.atributs?.FOR ?? 0) * multFor : arma.system.abast;
  if (!curt) return null;

  if (distancia <= 0) {
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
 * l'objectiu: cal que la distància actual no superi una casella de graella
 * (manual: "a tocar").
 * @param {number} distancia
 * @returns {boolean}
 */
export function estaAlAbastCosACos(distancia) {
  return distancia <= (canvas.grid?.distance ?? 1);
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
