/**
 * Propietats d'arma llegibles per màquina (WP-I, B13/B15).
 *
 * Algunes regles depenen del TIPUS d'arma, no del seu nom: les escopetes
 * tenen "Poca penetració" (manual FC001CA › SISTEMES › Combat › A Distància,
 * taula d'armes a distància, Escopetes) i els escuts es poden fer servir per
 * blocar (› Defensar-se › Blocar; › Cos a cos, taula d'armes, Escuts).
 *
 * Les propietats es guarden com a dades a `module/config/dades/armes.json`
 * (`"propietats": ["escopeta"]`, `["escut"]`). Un ítem d'arma pot portar-les:
 *   1. a `system.propietats` (si el model de dades de l'arma té el camp),
 *   2. a `flags.forja.propietats` (per a armes fetes a mà),
 *   3. o, per a ítems ja creats sense cap dels dos, a l'entrada del catàleg
 *      indicada per `flags.forja.catalegId` — i, si el catàleg no hi és (p.
 *      ex. proves), a la taula de reserva `PROPIETATS_PER_CATALEG`.
 */

/** Reserva per a ítems antics sense propietats: catalegId → propietats. */
export const PROPIETATS_PER_CATALEG = Object.freeze({
  escopetes: ["escopeta"],
  escuts:    ["escut"]
});

/**
 * Totes les propietats d'un ítem d'arma (funció pura).
 * @param {{system?:object, flags?:object}} item
 * @param {Array<{id:string, propietats?:string[]}>} [cataleg]  Per defecte `CONFIG.FORJA.CATALEG_ARMES`
 * @returns {Set<string>}
 */
export function propietatsArma(item, cataleg = globalThis.CONFIG?.FORJA?.CATALEG_ARMES ?? []) {
  const props = new Set();
  const afegir = (llista) => { for (const p of llista ?? []) if (typeof p === "string") props.add(p); };
  afegir(item?.system?.propietats);
  afegir(item?.flags?.forja?.propietats);
  const catalegId = item?.flags?.forja?.catalegId;
  if (catalegId) {
    afegir(cataleg.find(e => e.id === catalegId)?.propietats);
    afegir(PROPIETATS_PER_CATALEG[catalegId]);
  }
  return props;
}

/**
 * @param {object} item
 * @param {string} propietat
 * @param {Array} [cataleg]
 * @returns {boolean}
 */
export function teProprietat(item, propietat, cataleg) {
  if (!item) return false;
  return propietatsArma(item, cataleg).has(propietat);
}

/**
 * Mitjans de blocatge disponibles per a un defensor (B15, funció pura).
 *
 * Manual FC001CA › Defensar-se › Blocar: "Consisteix interposar alguna part
 * del cos que pugui suportar el dany (en cas de lluita sense armes), o un
 * objecte adequat, com un escut (en el cas d'atacs amb armes, ja sigui cos a
 * cos o a distància) ... blocar afegeix resistència (sense armes), armes cos
 * a cos (per escuts) o armes improvisades (altres objectes) a la reducció de
 * dany del PJ". I: "El bonificador ... no pot superar la reducció de dany
 * natural del PJ, és a dir, ... podrà duplicar la seva reducció de dany".
 *
 * Lectura literal (documentada a l'informe de WP-I):
 *  - "sense armes" es refereix a l'ATAC: el cos (resistència) només bloca
 *    atacs d'armes naturals. Contra atacs amb armes (cos a cos o distància)
 *    cal un escut o un altre objecte.
 *  - L'escut només si el defensor té una arma amb la propietat `escut`.
 *  - "Altres objectes" (armes improvisades) sempre s'ofereix: el DJ decideix
 *    si hi ha un objecte adequat a mà.
 *  - Si no es coneix l'arma atacant (`categoriaAtac` nul, p. ex. acció
 *    defensiva declarada per endavant), s'ofereixen tots els mitjans.
 *
 * @param {object} p
 * @param {Iterable<object>} [p.items]         Ítems del defensor
 * @param {(id:string)=>number} p.habilitat    Nivell d'habilitat del defensor
 * @param {number} p.reduccioNatural           Reducció de dany natural (límit del bonificador)
 * @param {"natural"|"cosAcos"|"distancia"|null} [p.categoriaAtac]  Categoria de l'arma atacant
 * @param {Array} [p.cataleg]
 * @returns {Array<{id:string, habId:string, nivell:number, reduccioExtra:number, nomArma?:string}>}
 *   Ordenats de més a menys reducció extra.
 */
export function mitjansBlocar({ items = [], habilitat, reduccioNatural = 0, categoriaAtac = null, cataleg } = {}) {
  const cap = Math.max(0, reduccioNatural ?? 0);
  const mitja = (id, habId, extra = {}) => {
    const nivell = habilitat(habId) ?? 0;
    return { id, habId, nivell, reduccioExtra: Math.max(0, Math.min(nivell, cap)), ...extra };
  };

  const mitjans = [];
  const atacArmat = categoriaAtac === "cosAcos" || categoriaAtac === "distancia";
  if (!atacArmat) mitjans.push(mitja("resistencia", "resistencia"));

  const escut = [...(items ?? [])].find(i => i?.type === "arma" && teProprietat(i, "escut", cataleg));
  if (escut) mitjans.push(mitja("escut", "armes-cos-a-cos", { nomArma: escut.name }));

  mitjans.push(mitja("improvisat", "armes-improvisades"));

  return mitjans.sort((a, b) => b.reduccioExtra - a.reduccioExtra);
}
