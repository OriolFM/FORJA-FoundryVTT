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
 * @param {number} distancia      Distància actual entre atacant i objectiu
 * @param {Item}   arma           Arma a distància (`system.abast`, `system.rangExtrem`)
 * @param {number} defensaBasica  Defensa bàsica de l'objectiu
 * @returns {{banda:string, dificultat:number}|null}
 *   `null` si l'abast de l'arma és variable (Rang limitat: FOR/FORx3/FORx5,
 *   `abast === 0`) — no es pot calcular automàticament, cal dificultat
 *   manual — o si l'objectiu és fora d'abast (més enllà del rang llarg, o
 *   de l'extrem si l'arma en té).
 */
export function bandaDistancia(distancia, arma, defensaBasica) {
  const curt = arma.system.abast;
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
