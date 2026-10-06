/**
 * Regles dels estats (manual › SISTEMES › Salut › Estats, l. 3546–3695).
 * Funcions pures, sense globals de Foundry: reben els ids dels estats actius
 * (`actor.statuses`) i diuen què pot fer l'actor. La part de Foundry
 * (bloquejar, avisar, textos flotants) és a `estats/aplicacio-estats.mjs` i
 * `estats/notificacions.mjs`.
 *
 * Decisió de l'Oriol FM (2026-10-06): els efectes dels estats s'apliquen
 * (qui no es pot moure no es mou), i si el jugador ho intenta, es torna a
 * mostrar l'estat al costat del token.
 *
 * Què NO s'automatitza (judici del DJ, el manual no dona xifres):
 *   - Esguerrat: quina extremitat (braç o cama). Es demana en tirar
 *     «forçar l'extremitat»; les restriccions de cama no s'apliquen soles.
 *   - Malaltia/Toxina: els efectes depenen de cada malaltia.
 *   - Empès/Llançat: la distància i el dany addicional contra superfícies.
 *   - Acovardit: «allunyar-se» del que fa por (es permet el moviment).
 */

/**
 * Estats que impedeixen actuar del tot (no es pot declarar ni resoldre cap
 * acció). Inconscient (l. 3612: «no pot declarar cap acció»), incapacitat
 * (l. 3602: «no poden fer res més que demanar ajuda»), marejat (l. 3640:
 * «no pot actuar i perd totes les accions declarades»; per actuar cal una
 * tirada, vegeu `TIRADES_ESTAT.marejat`).
 */
const NO_ACTUA = ["inconscient", "incapacitat", "marejat"];

/** Estats que impedeixen moure's de la posició (atrapat l. 3566, immobilitzat l. 3596). */
const NO_ES_MOU = ["atrapat", "immobilitzat"];

/** Estats amb els quals la defensa bàsica és 1 (› Defensa bàsica, l. 3151). */
const DEFENSA_BASICA_1 = ["immobilitzat", "incapacitat", "inconscient"];

/**
 * Restriccions que imposen els estats actius.
 * Cada bloqueig porta l'estat que el causa (per tornar-lo a mostrar).
 *
 * @param {Iterable<string>} estats  Ids dels estats actius (`actor.statuses`).
 * @returns {{
 *   potActuar: boolean, motiuActuar: string|null,
 *   potMoure: boolean, motiuMoure: string|null,
 *   potCorrer: boolean, motiuCorrer: string|null,
 *   potEsquivar: boolean, motiuEsquivar: string|null,
 *   potDefensaActiva: boolean, motiuDefensaActiva: string|null,
 *   potConcentrar: boolean, motiuConcentrar: string|null,
 *   nomesDefensiva: boolean, motiuNomesDefensiva: string|null,
 *   defensaBasica1: boolean,
 *   latenciaExtra: number,
 *   reaccionsExtra: number,
 *   ignoraPenalitzacio: boolean,
 *   perdAccio: boolean
 * }}
 */
export function restriccionsEstats(estats) {
  const actius = new Set(estats ?? []);
  const primer = (llista) => llista.find(id => actius.has(id)) ?? null;

  const motiuActuar = primer(NO_ACTUA);
  const motiuMoure = motiuActuar ?? primer(NO_ES_MOU);
  // Abatut (l. 3554): «no pot córrer, saltar, ni esquivar».
  const motiuCorrer = motiuMoure ?? primer(["abatut"]);
  // Atrapat (l. 3568): «no pot esquivar altres atacs (pot parar i blocar)».
  // Berserc (l. 3578): cap acció defensiva.
  const motiuDefensaActiva = motiuActuar ?? primer(["berserc"]);
  const motiuEsquivar = motiuDefensaActiva ?? primer(["abatut", "atrapat"]);
  // Berserc: cap acció que necessiti concentració, «excepte si es concentra en atac».
  const motiuConcentrar = motiuActuar ?? primer(["berserc"]);
  // Acovardit (l. 3558): només accions defensives o allunyar-se.
  const motiuNomesDefensiva = primer(["acovardit"]);

  return {
    potActuar: !motiuActuar, motiuActuar,
    potMoure: !motiuMoure, motiuMoure,
    potCorrer: !motiuCorrer, motiuCorrer,
    potEsquivar: !motiuEsquivar, motiuEsquivar,
    potDefensaActiva: !motiuDefensaActiva, motiuDefensaActiva,
    potConcentrar: !motiuConcentrar, motiuConcentrar,
    nomesDefensiva: !!motiuNomesDefensiva, motiuNomesDefensiva,
    defensaBasica1: DEFENSA_BASICA_1.some(id => actius.has(id)),
    // Abatut: +2 a la latència de qualsevol acció, també aixecar-se (l. 3554).
    latenciaExtra: actius.has("abatut") ? 2 : 0,
    // Vigilant (l. 3692): un comptador de reacció addicional.
    reaccionsExtra: actius.has("vigilant") ? 1 : 0,
    // Berserc: «dur de pelar i incansable» → ignora les penalitzacions de
    // ferides i de fatiga (trets, l. 1557 i 1593).
    ignoraPenalitzacio: actius.has("berserc"),
    // Atordit (l. 3564): perd la següent acció i ha de tornar a declarar.
    perdAccio: actius.has("atordit")
  };
}

/**
 * Tipus d'acció del diàleg de declarar que permeten els estats, amb el motiu
 * dels que no.
 * - No pot actuar: cap.
 * - Acovardit: defensa i moviment (allunyar-se).
 * - Berserc: sense defensa completa.
 * - No es pot moure: sense «només moviment».
 * @param {ReturnType<typeof restriccionsEstats>} r
 * Manifestar un efecte i activar un artefacte compten com «altra acció».
 * @returns {Record<"atac"|"defensa"|"moviment"|"altra"|"manifestar"|"artefacte", string|null>}  null = permès; si no, l'estat que ho impedeix
 */
export function tipusAccioBloquejats(r) {
  const tots = { atac: null, defensa: null, moviment: null, altra: null, manifestar: null, artefacte: null };
  if (!r.potActuar) {
    for (const k of Object.keys(tots)) tots[k] = r.motiuActuar;
    return tots;
  }
  if (r.nomesDefensiva) {
    tots.atac = r.motiuNomesDefensiva;
    tots.altra = r.motiuNomesDefensiva;
    tots.manifestar = r.motiuNomesDefensiva;
    tots.artefacte = r.motiuNomesDefensiva;
  }
  if (!r.potDefensaActiva) tots.defensa = r.motiuDefensaActiva;
  if (!r.potMoure) tots.moviment = r.motiuMoure;
  return tots;
}

/**
 * Moviments del diàleg de declarar que permeten els estats (WP-M):
 * sense moure's, ni especial ni càrrega (el bàsic queda, però el token no es
 * podrà moure); sense córrer, ni ràpid ni càrrega.
 * @param {string[]} moviments  Moviments que permet l'acció triada.
 * @param {ReturnType<typeof restriccionsEstats>} r
 * @returns {string[]}
 */
export function movimentsPermesosPerEstats(moviments, r) {
  return moviments.filter(m => {
    if (m === "basic") return true;
    if (!r.potMoure) return false;
    if (!r.potCorrer && (m === "rapid" || m === "carrega")) return false;
    return true;
  });
}

/**
 * Estat que correspon a la salut (› Fatiga i ferides, l. 3426): nivell 7 de
 * fatiga → inconscient; nivell 7 de ferides → incapacitat.
 * @param {number} nivellFatiga
 * @param {number} nivellFerides
 * @returns {{inconscient: boolean, incapacitat: boolean}}
 */
export function estatsPerSalut(nivellFatiga, nivellFerides) {
  return { inconscient: nivellFatiga >= 7, incapacitat: nivellFerides >= 7 };
}

/**
 * Pista que cura Recuperació/X (l. 3678): primer la condició més greu (la de
 * nivell més alt); si són al mateix nivell, la fatiga.
 * @param {{fatiga:{nivellActiu:number, marcats:number}, ferides:{nivellActiu:number, marcats:number}}} salut
 * @returns {"fatiga"|"ferides"|null}  null si no hi ha res a curar
 */
export function pistaRecuperacio(salut) {
  const fat = salut.fatiga, fer = salut.ferides;
  if ((fat.marcats ?? 0) <= 0 && (fer.marcats ?? 0) <= 0) return null;
  if ((fer.marcats ?? 0) <= 0) return "fatiga";
  if ((fat.marcats ?? 0) <= 0) return "ferides";
  return (fer.nivellActiu ?? 1) > (fat.nivellActiu ?? 1) ? "ferides" : "fatiga";
}

/**
 * Caselles marcades després d'un tic de Recuperació/X sobre una pista (l. 3676):
 * normalment X punts menys; si la pista és al nivell 7 (inconscient o
 * incapacitat), passa al nivell superior (el 6, amb totes les caselles del
 * nivell 6 marcades) i a partir d'allà es cura normalment.
 * @param {number} marcats
 * @param {number} perNivell
 * @param {number} x
 * @returns {number}
 */
export function marcatsDespresRecuperacio(marcats, perNivell, x) {
  if (perNivell > 0 && marcats >= 6 * perNivell) return 6 * perNivell - 1;
  return Math.max(0, marcats - x);
}

/**
 * Tirades per sortir d'un estat o actuar malgrat l'estat (manual, cada estat).
 * `atributs`: s'agafa el més favorable; `habilitats`: la més alta (si n'hi ha
 * diverses alternatives). La dificultat la posa el DJ o l'oponent.
 * `treu`: si l'èxit treu l'estat.
 */
export const TIRADES_ESTAT = {
  // l. 3558: APL + resistència o APL + Psi; acaba l'estat.
  acovardit: { atributs: ["APL"], habilitats: ["resistencia", "psi"], treu: true },
  // l. 3570: FOR + força bruta o FOR/DES + arts marcials, contra la tirada de qui atrapa.
  atrapat: { alternatives: [
    { atributs: ["FOR"], habilitats: ["forca-bruta"] },
    { atributs: ["FOR", "DES"], habilitats: ["arts-marcials"] }
  ], treu: true },
  // l. 3592: AGI + acrobàcies o AGI + equilibri per mantenir-se dempeus; si falla, abatut.
  empes: { atributs: ["AGI"], habilitats: ["acrobacies", "equilibri"], treu: true, siFalla: "abatut" },
  // l. 3634: FOR + resistència contra la virulència (dificultat del DJ).
  "malaltia-toxina": { atributs: ["FOR"], habilitats: ["resistencia"], treu: false },
  // l. 3644: FOR o APL + resistència per actuar; un cop desapareix la causa, l'acaba.
  marejat: { atributs: ["FOR", "APL"], habilitats: ["resistencia"], treu: false },
  // l. 3662: FOR + resistència per ignorar l'estat una acció; +1 fatiga cada cop.
  esguerrat: { atributs: ["FOR"], habilitats: ["resistencia"], treu: false, fatigaPerIntent: 1 }
};

/**
 * Pool de daus d'una tirada d'estat: el millor atribut + la millor habilitat
 * de la (millor) alternativa.
 * @param {string} estatId
 * @param {{atributs:Record<string,number>, habilitats:Record<string,{nivell:number}>}} sys
 * @returns {{pool:number, atribut:string, habilitat:string}|null}
 */
export function poolTiradaEstat(estatId, sys) {
  const def = TIRADES_ESTAT[estatId];
  if (!def) return null;
  const alternatives = def.alternatives ?? [{ atributs: def.atributs, habilitats: def.habilitats }];
  let millor = null;
  for (const alt of alternatives) {
    const atribut = [...alt.atributs].sort((a, b) => (sys.atributs?.[b] ?? 0) - (sys.atributs?.[a] ?? 0))[0];
    const habilitat = [...alt.habilitats].sort((a, b) => (sys.habilitats?.[b]?.nivell ?? 0) - (sys.habilitats?.[a]?.nivell ?? 0))[0];
    const pool = (sys.atributs?.[atribut] ?? 0) + (sys.habilitats?.[habilitat]?.nivell ?? 0);
    if (!millor || pool > millor.pool) millor = { pool, atribut, habilitat };
  }
  return millor;
}
