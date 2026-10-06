/**
 * Modes de tret i atacs d'àrea de les armes a distància (Fase 6; manual ›
 * A Distància, taula d'armes, l. 3075–3103). Funcions pures. Decisions de
 * l'Oriol FM (2026-10-06):
 *   - Escopetes («Dispersió»): llàgrima des de l'usuari fins al rang mitjà;
 *     els objectius de dins tenen defensa bàsica 1 (modificada per la
 *     distància) en lloc de la seva; poden esquivar.
 *   - Armes de dispersió: llàgrima de 15 m des de l'usuari; defensa 5,
 *     modificada per la distància. Pífia: fuga que fa 15 − habilitat de dany a
 *     l'usuari i als adjacents («Perilloses»).
 *   - Automàtic (armes d'assalt) i foc automàtic (armes de suport): l'usuari
 *     tria el punt objectiu i l'àrea es dibuixa a partir d'allà. Automàtic:
 *     +2 latència, +1 dany, impacta qui sigui al descobert si la tirada en
 *     SUPERA la defensa bàsica. Foc automàtic: defensa 5, modificada per la
 *     distància.
 *   - Ràfega: +1 latència i +1 dau a impactar o +1 al dany (cal declarar-ho).
 * L'àrea és la plantilla que dibuixa l'usuari (`plantilla.mjs`); el DJ en
 * valida la forma i la mida.
 */

/** Modes de tret: latència extra i bonificacions. */
export const MODES_TRET = {
  "tret":        { latencia: 0, daus: 0, dany: 0 },
  "rafega-daus": { latencia: 1, daus: 1, dany: 0 },
  "rafega-dany": { latencia: 1, daus: 0, dany: 1 },
  "automatic":   { latencia: 2, daus: 0, dany: 1, area: true }
};

/**
 * Modes que permet una arma segons les seves propietats.
 * @param {string[]} propietats
 * @returns {string[]}  Buit si l'arma no en té (només el tret normal).
 */
export function modesDisponibles(propietats = []) {
  const p = new Set(propietats);
  if (!p.has("rafega") && !p.has("automatic")) return [];
  const modes = ["tret"];
  if (p.has("rafega")) modes.push("rafega-daus", "rafega-dany");
  if (p.has("automatic")) modes.push("automatic");
  return modes;
}

/**
 * Regla d'àrea d'un atac, o null si és un atac normal contra un objectiu.
 * @param {string[]} propietats  Propietats de l'arma.
 * @param {string} [mode="tret"]
 * @returns {{tipus:string, defensa:number|"basica", exigirSuperar:boolean, potEsquivar:boolean,
 *   bandaMaxima:string|null, distanciaMaxima:number|null}|null}
 */
export function regleArea(propietats = [], mode = "tret") {
  const p = new Set(propietats);
  if (mode === "automatic") {
    return { tipus: "automatic", defensa: "basica", exigirSuperar: true, potEsquivar: false, bandaMaxima: null, distanciaMaxima: null };
  }
  if (p.has("focAutomatic")) {
    return { tipus: "focAutomatic", defensa: 5, exigirSuperar: false, potEsquivar: false, bandaMaxima: null, distanciaMaxima: null };
  }
  if (p.has("areaDispersio")) {
    return { tipus: "dispersio", defensa: 5, exigirSuperar: false, potEsquivar: false, bandaMaxima: null, distanciaMaxima: 15 };
  }
  if (p.has("escopeta")) {
    return { tipus: "escopeta", defensa: 1, exigirSuperar: false, potEsquivar: true, bandaMaxima: "mitja", distanciaMaxima: null };
  }
  return null;
}

/** Ordre de les bandes de rang (`abast.mjs`). */
const ORDRE_BANDES = ["bocaCano", "curt", "mitja", "llarg", "extrem"];

/**
 * L'objectiu és dins l'abast que permet la regla d'àrea.
 * @param {object} regla  `regleArea`
 * @param {{banda:string}|null} banda  `bandaDistancia`
 * @param {number} distancia
 * @returns {boolean}
 */
export function dinsAbastArea(regla, banda, distancia) {
  if (regla.distanciaMaxima != null && distancia > regla.distanciaMaxima) return false;
  if (regla.bandaMaxima) {
    if (!banda) return false;
    return ORDRE_BANDES.indexOf(banda.banda) <= ORDRE_BANDES.indexOf(regla.bandaMaxima);
  }
  return true;
}

/**
 * Dany de la fuga d'una arma de dispersió que pifia (l. 3093): 15 − habilitat.
 * @param {number} habilitat
 * @returns {number}
 */
export function danyFuga(habilitat) {
  return Math.max(0, 15 - (Number(habilitat) || 0));
}
