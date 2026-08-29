/**
 * Activació i càrrega d'artefactes (S-26, manual p. 126-136, 798-834).
 *
 * Abast: només el comptador de càrrega (consum en usar-se, recàrrega amb el
 * pas del temps) — l'únic tros d'"artefactes" prou uniforme entre totes les
 * categories (arma/armadura/dispositiu/permanent) per automatitzar-se sense
 * el motor de paràmetres (S-23, encara no fet). La tirada d'activació en si
 * (quan l'artefacte és "normal", no trivial) NO la fa aquest mòdul: l'Item
 * no desa quin atribut/habilitat correspon a cada artefacte (és massa
 * heterogeni), així que el jugador la fa amb les eines genèriques de tirada
 * ja existents — aquest mòdul només gestiona si HI HA prou càrrega.
 *
 * **`modeEspera`** (camp ja existent des de S-24, mai documentat ni
 * consumit fins ara): interpretat aquí com "la recàrrega només avança
 * manualment (el DJ prem 'Recarregar' quan decideix que ha passat prou
 * temps narratiu, mateix patró que el 'Descansar' de S-17)" quan és `true`,
 * enfront de "es recarrega sol, un torn de temps actiu cada vegada, mentre
 * dura un combat" quan és `false`. Es dedueix dels dos únics exemples reals
 * del catàleg amb temps de recàrrega llarg (Espasa d'energia: 10 torns,
 * Generador de bretxa: 36 torns, tots dos `modeEspera:true` — massa llarg
 * per a un sol combat) enfront de l'únic amb temps curt (Ulleres
 * intel·ligents: 10 torns, `modeEspera:false` — factible dins una escena de
 * temps actiu). **Decisió elevable si mai es documenta el camp d'una altra
 * manera** — no hi havia cap altra font per confirmar-ho.
 */

/** @returns {boolean} Si l'artefacte té càrrega limitada (usosPerCarrega no nul). */
export function teCarrega(item) {
  return item.system.carrega?.usosPerCarrega != null;
}

/** @returns {number|null} Càrrega actual (ple per defecte si mai s'ha tocat), o `null` si no aplica. */
export function carregaActual(item) {
  const c = item.system.carrega;
  if (c.usosPerCarrega == null) return null;
  return c.actual ?? c.usosPerCarrega;
}

/**
 * Consumeix 1 càrrega. Bloqueja (retorna `ok:false`) si no en queda —
 * a diferència dels avisos de coherència (S-05), aquí és un recurs que
 * literalment no es pot gastar si no es té, mateix criteri que els PX
 * a `progressio/millora.mjs`.
 * @param {Item} item
 * @returns {Promise<{ok:boolean, restant:number|null}>}
 */
export async function activarArtefacte(item) {
  if (!teCarrega(item)) return { ok: true, restant: null };
  const actual = carregaActual(item);
  if (actual <= 0) return { ok: false, restant: 0 };
  await item.update({ "system.carrega.actual": actual - 1 });
  return { ok: true, restant: actual - 1 };
}

/**
 * Afegeix punts de càrrega manualment (botó "Recarregar", per a
 * `modeEspera:true` o per corregir a mà), sense superar el màxim.
 * @param {Item} item
 * @param {number} [punts=1]
 * @returns {Promise<number|null>} Nova càrrega, o `null` si l'artefacte no en té.
 */
export async function recarregarArtefacte(item, punts = 1) {
  if (!teCarrega(item)) return null;
  const max   = item.system.carrega.usosPerCarrega;
  const nou   = Math.min(max, carregaActual(item) + punts);
  await item.update({ "system.carrega.actual": nou, "system.carrega.tornsAcumulats": 0 });
  return nou;
}

/**
 * Avança un torn de temps actiu per a un artefacte amb recàrrega automàtica
 * (`modeEspera:false`): acumula torns i, quan arriba a `tornsRecarrega`,
 * afegeix 1 càrrega i reinicia el comptador. Cridat des d'`updateCombat`
 * (forja.mjs) per a cada artefacte amb càrrega de l'actor sortint, mateix
 * patró que `recuperarEquilibri`/`reiniciarReaccions`.
 * @param {Item} item
 */
export async function avancarRecarregaTorn(item) {
  const c = item.system.carrega;
  if (c.usosPerCarrega == null || c.modeEspera) return;
  if (carregaActual(item) >= c.usosPerCarrega) return; // ja ple
  if (!c.tornsRecarrega) return;

  const acumulats = (c.tornsAcumulats ?? 0) + 1;
  if (acumulats >= c.tornsRecarrega) {
    await item.update({
      "system.carrega.actual":         Math.min(c.usosPerCarrega, carregaActual(item) + 1),
      "system.carrega.tornsAcumulats": 0
    });
  } else {
    await item.update({ "system.carrega.tornsAcumulats": acumulats });
  }
}

/**
 * Avança la recàrrega automàtica de tots els artefactes amb càrrega de
 * l'actor (cridat un cop per torn, per l'actor sortint).
 * @param {ForjaActor} actor
 */
export async function avancarRecarregaActor(actor) {
  for (const item of actor.items) {
    if (item.type !== "artefacte" || !teCarrega(item)) continue;
    await avancarRecarregaTorn(item);
  }
}
