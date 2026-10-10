/**
 * Entrada del catàleg de trets (`trets.json`) que correspon a un ítem de tret
 * (funció pura): per `flags.forja.catalegId` o, si no en té (trets creats a
 * mà abans que el catàleg ho fixés), pel nom exacte, sense distingir
 * majúscules. Oriol FM, 2026-10-11: la Yoko tenia «Dur de Pelar» sense
 * identificador ni efecte, i no ignorava la penalització per ferides.
 * @param {{name?:string, flags?:object}} item
 * @param {Array<{id:string, nom:string}>} [llista]  `CONFIG.FORJA.LLISTA_TRETS`
 * @returns {object|null}
 */
export function tretDelCataleg(item, llista = globalThis.CONFIG?.FORJA?.LLISTA_TRETS ?? []) {
  const id = item?.flags?.forja?.catalegId;
  if (id) return llista.find(t => t.id === id) ?? null;
  const nom = String(item?.name ?? "").trim().toLowerCase();
  return nom ? (llista.find(t => String(t.nom).trim().toLowerCase() === nom) ?? null) : null;
}
