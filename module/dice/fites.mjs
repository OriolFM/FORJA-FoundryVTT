/**
 * Recompte de fites d'una tirada de FORJA (funcions pures, sense Foundry).
 *
 * Manual › SISTEMES › Tirades: cada d10 ≥ 6 és una fita, el 10 en val dues
 * (doble fita) i hi ha pífia si no hi ha cap fita i almenys un 1.
 *
 * Adepte i inepte (manual › Trets, l. 1332 i 1597; per àmbits d'activitat,
 * Oriol FM 2026-10-06): s'apliquen a les tirades de l'àmbit que el jugador o
 * el DJ marquen al diàleg (el sistema no decideix si una activitat és «social»).
 * - Adepte: repeteix un cop els 1 (es fa amb el modificador `r1` de la
 *   fórmula; aquí només es compten els daus actius).
 * - Inepte: els 10 no compten doble, i cada 1 resta una fita. La pífia es
 *   mira després de restar-les: si hi ha més 1 que fites, és pífia encara
 *   que hi hagi alguna fita (Oriol FM, 2026-10-06; manual l. 1597).
 */

/** Àmbits d'adepte/inepte (`trets.json`: `adepte-<àmbit>`, `inepte-<àmbit>`). */
export const AMBITS = ["fisic", "mental", "social", "tecnic"];

/**
 * @param {number[]} daus  Resultats actius (sense els repetits per adepte).
 * @param {object} [opcions]
 * @param {boolean} [opcions.inepte=false]
 * @returns {{fites:number, hasOnes:boolean, pifia:boolean, unsRestats:number}}
 */
export function comptarFites(daus, { inepte = false } = {}) {
  let fites = 0;
  let uns = 0;
  for (const d of daus) {
    if (d === 10) fites += inepte ? 1 : 2;
    else if (d >= 6) fites += 1;
    if (d === 1) uns += 1;
  }
  const unsRestats = inepte ? Math.min(uns, fites) : 0;
  fites = Math.max(0, fites - unsRestats);
  return { fites, hasOnes: uns > 0, pifia: uns > 0 && fites === 0, unsRestats };
}

/**
 * Adepte/inepte que té un actor, a partir dels seus trets (catalegId).
 * @param {Array<{type:string, flags?:object}>} items
 * @returns {Array<{tipus:"adepte"|"inepte", ambit:string}>}
 */
export function aptitudsDelsTrets(items) {
  const resultat = [];
  for (const it of items ?? []) {
    if (it.type !== "tret") continue;
    const m = String(it.flags?.forja?.catalegId ?? "").match(/^(adepte|inepte)-(\w+)$/);
    if (m && AMBITS.includes(m[2])) resultat.push({ tipus: m[1], ambit: m[2] });
  }
  return resultat;
}
