/**
 * Accions complexes (S-08, manual cap. 3, p. 67 i p. 501-517): intercanvi
 * temps↔dificultat per a tasques amb una dificultat superior al que és
 * assumible en una sola tirada.
 *
 * Pura calculadora (04_AUTOMATITZACIO.md la classifica "A1": "mostrar
 * graons temps↔dificultat"; l'inventari de sistemes ho remarca encara més
 * fort: "és una calculadora, no un sistema d'estat" — el DJ decideix sempre
 * si el temps disponible permet arribar a un graó concret, res d'això es
 * verifica ni es bloqueja aquí). No toca cap actor ni cap document: només
 * calcula.
 *
 * Regla (manual p. 117): "el jugador pot dividir la dificultat de la
 * tirada a la meitat (arrodonint cap amunt) a canvi de duplicar el temps
 * que hi dedica. Això es pot fer tants cops com calgui fins que la
 * dificultat sigui assequible en una sola tirada." — no hi ha cap llindar
 * numèric fix de "assequible" (depèn del pool real del PJ, que aquesta
 * calculadora no coneix), així que es mostren tots els graons fins a
 * dificultat 1.
 *
 * Regla de l'excedent (mateixa pàgina): "L'excedent també s'haurà de
 * dividir tants cops com la dificultat de la tirada" — es mostra el
 * divisor de cada graó perquè qui apliqui el resultat el faci servir
 * (2^n intents de dividir per la meitat = divisor 2^n).
 */

/**
 * @param {number} dificultatBase Dificultat original de la tasca (fites necessàries).
 * @returns {Array<{n:number, multiplicadorTemps:number, dificultat:number, divisorExcedent:number}>}
 *   Graó 0 = sense cap divisió (dificultat original). Cada graó següent
 *   duplica el temps i divideix la dificultat pel mig (arrodonint amunt),
 *   fins arribar a dificultat 1.
 */
export function calcularGraons(dificultatBase) {
  let dif = Math.max(1, Math.round(dificultatBase) || 1);
  const passos = [{ n: 0, multiplicadorTemps: 1, dificultat: dif, divisorExcedent: 1 }];

  let n = 0;
  while (dif > 1) {
    n++;
    dif = Math.ceil(dif / 2);
    passos.push({ n, multiplicadorTemps: 2 ** n, dificultat: dif, divisorExcedent: 2 ** n });
  }
  return passos;
}
