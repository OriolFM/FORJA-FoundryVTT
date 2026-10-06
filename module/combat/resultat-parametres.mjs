/**
 * Què fan els paràmetres d'un efecte o artefacte quan s'usen (Fase 3,
 * `docs/PLA-MANUAL-COMPLET.md`). Funcions pures, sense globals de Foundry: la
 * part de Foundry és a `combat/aplicar-efecte.mjs` (resultat de manifestar un
 * efecte o activar un artefacte) i `combat/artefactes-vinculats.mjs` (armes i
 * armadures que són artefactes).
 *
 * Decisió de l'Oriol FM (2026-10-06): el resultat s'aplica automàticament,
 * com el dany dels atacs.
 *
 * Regles (manual, cap. 4 › Artefactes i efectes, l. 4696–5360):
 *   - **Dany** (l. 4949): com les armes convencionals, dany = modificador de
 *     l'efecte + excedent de la tirada (› Determinar el dany total, l. 3217).
 *     Indirecte: passa per l'ègida, l'armadura i la reducció de dany. Directe
 *     (l. 3283): ignora l'armadura i la reducció. Drenatge: directe, i
 *     l'usuari recupera tants punts com en causa.
 *   - **Curació** (l. 5011): cura els punts indicats (sense excedent).
 *   - **Estats** (l. 5087): aplica l'estat; als parametritzats (Lent/X…) el
 *     nivell és la X, i als altres és el modificador a la dificultat per
 *     resistir-lo.
 *   - **Protecció, eines, atributs, trets**: bonificacions mentre duri
 *     l'efecte (una escena si té durada) o mentre es porti l'artefacte.
 *   - La resta (percepció, il·lusions, mentals, telecinesi, translocació,
 *     replicació, transformació, barrera, invocació) és narrativa: el xat ho
 *     descriu i el DJ ho aplica.
 */

/** Estats amb valor X (el nivell del paràmetre és la X). */
const ESTATS_AMB_X = new Set(["lent", "rapid", "recuperacio", "sagnant"]);

/**
 * Pistes de salut de cada tipus de dany (manual › Tipus de dany, l. 3271).
 * `null` = fatiga o ferides, a triar en usar-lo.
 * **Interpretacions pròpies** (el manual no ho diu): àcid → ferides
 * («cremades químiques»), electricitat → ferides, malaltia → fatiga.
 */
export const PISTES_PER_TIPUS_DANY = {
  "fatiga":           ["fatiga"],
  "ferides":          ["ferides"],
  "fatiga-o-ferides": null,
  "fatiga-i-ferides": ["fatiga", "ferides"],
  "acid":             ["ferides"],
  "foc":              ["ferides"],
  "electricitat":     ["ferides"],
  "explosio":         ["fatiga", "ferides"],
  "fred":             ["fatiga"],
  "malaltia":         ["fatiga"],
  "radiacio":         ["fatiga", "ferides"]
};

/**
 * Pistes on va el dany d'un tipus.
 * @param {string} danyTipus
 * @param {"fatiga"|"ferides"} [eleccio="ferides"]  Per a «fatiga o ferides».
 * @returns {Array<"fatiga"|"ferides">}
 */
export function pistesDany(danyTipus, eleccio = "ferides") {
  const pistes = PISTES_PER_TIPUS_DANY[danyTipus];
  if (pistes === undefined) return ["ferides"];
  return pistes ?? [eleccio === "fatiga" ? "fatiga" : "ferides"];
}

/** Bonificacions buides. */
export function bonificacionsBuides() {
  return { atributs: {}, habilitats: {}, armadura: 0, egida: 0, trets: [], estats: [] };
}

/**
 * Suma unes bonificacions a unes altres (muta `a`).
 * @returns {object} `a`
 */
export function sumarBonificacions(a, b) {
  for (const [k, v] of Object.entries(b?.atributs ?? {})) a.atributs[k] = (a.atributs[k] ?? 0) + v;
  for (const [k, v] of Object.entries(b?.habilitats ?? {})) a.habilitats[k] = (a.habilitats[k] ?? 0) + v;
  a.armadura = Math.max(a.armadura, b?.armadura ?? 0);
  a.egida = Math.max(a.egida, b?.egida ?? 0);
  for (const t of b?.trets ?? []) if (!a.trets.includes(t)) a.trets.push(t);
  for (const e of b?.estats ?? []) a.estats.push(e);
  return a;
}

/**
 * Bonificacions que donen els paràmetres mentre l'efecte o l'artefacte és
 * actiu: eines (+nivell daus a l'habilitat), atributs, armadura (natural),
 * ègida i trets. Les eines i atributs sense habilitat o atribut definit
 * (p. ex. el Ciberbraç, «a escollir en instal·lar-lo») no compten fins que es
 * defineixin.
 * @param {object[]} parametres
 * @returns {{atributs:Record<string,number>, habilitats:Record<string,number>, armadura:number, egida:number, trets:string[], estats:object[]}}
 */
export function bonificacionsDeParametres(parametres) {
  const b = bonificacionsBuides();
  for (const p of parametres ?? []) {
    const n = Number(p.nivell) || 0;
    switch (p.tipus) {
      case "eina":     if (p.habilitat) b.habilitats[p.habilitat] = (b.habilitats[p.habilitat] ?? 0) + n; break;
      case "atribut":  if (p.atribut) b.atributs[p.atribut] = (b.atributs[p.atribut] ?? 0) + n; break;
      case "armadura": b.armadura = Math.max(b.armadura, n); break;
      case "egida":    b.egida = Math.max(b.egida, n); break;
      case "tret":     if (p.tret && !b.trets.includes(p.tret)) b.trets.push(p.tret); break;
    }
  }
  return b;
}

/** Tipus de paràmetre que el sistema no aplica sol (narratius). */
const NARRATIUS = new Set([
  "alterarPercepcio", "illusio", "mental", "telecinesi", "translocacio", "replicacio",
  "transformacio", "barrera", "invocacio"
]);

/**
 * Resum del que fa un efecte o artefacte en usar-lo.
 * @param {object[]} parametres
 * @returns {{
 *   objectius: "usuari"|"individuals"|"area", distancia: boolean, durada: "escena"|"instantania",
 *   reaccio: boolean, ritual: boolean, narratiu: boolean,
 *   dany: {categoria:string, nivell:number, danyTipus:string}|null,
 *   cura: {nivell:number, pista:string, estats:boolean, malalties:boolean}|null,
 *   estats: Array<{id:string, valorX:number|null, modificador:number}>,
 *   bonificacions: object, autoeines: Array<{habilitat:string|null, fites:number}>,
 *   narratius: object[], invocacio: {costCriatura:number, criatura:string|null}|null
 * }}
 */
export function resumParametres(parametres) {
  const tipus = new Set((parametres ?? []).map(p => p.tipus));
  const resum = {
    objectius: tipus.has("usuari") ? "usuari" : tipus.has("area") ? "area" : "individuals",
    distancia: tipus.has("distancia"),
    durada: tipus.has("durada") ? "escena" : "instantania",
    reaccio: tipus.has("reaccio"),
    ritual: tipus.has("ritual"),
    narratiu: tipus.has("narratiu") || tipus.has("ritual"),
    dany: null, cura: null, estats: [],
    bonificacions: bonificacionsDeParametres(parametres),
    autoeines: [], narratius: [], invocacio: null
  };
  for (const p of parametres ?? []) {
    switch (p.tipus) {
      case "dany":
        resum.dany = { categoria: p.categoria, nivell: Number(p.nivell) || 0, danyTipus: p.danyTipus };
        break;
      case "cura":
        resum.cura = { ...(resum.cura ?? { estats: false, malalties: false }), nivell: Number(p.nivell) || 0, pista: p.pista };
        break;
      case "curaEstats":    resum.cura = { nivell: 0, pista: null, malalties: false, ...(resum.cura ?? {}), estats: true }; break;
      case "curaMalalties": resum.cura = { nivell: 0, pista: null, estats: false, ...(resum.cura ?? {}), malalties: true }; break;
      case "estat":         resum.estats.push(estatDeParametre(p)); break;
      case "autoeina":      resum.autoeines.push({ habilitat: p.habilitat ?? null, fites: Number(p.nivell) || 0 }); break;
      case "invocacio":     resum.invocacio = { costCriatura: Number(p.costCriatura) || 0, criatura: p.criatura ?? null }; break;
    }
    if (NARRATIUS.has(p.tipus)) resum.narratius.push(p);
  }
  return resum;
}

/**
 * Estat que aplica un paràmetre `estat`: als parametritzats el nivell és la
 * X; als altres, el modificador a la dificultat per resistir-lo (l. 5091).
 * @param {{estat:string, nivell:number}} p
 * @returns {{id:string, valorX:number|null, modificador:number}}
 */
export function estatDeParametre(p) {
  const n = Number(p.nivell) || 0;
  return ESTATS_AMB_X.has(p.estat)
    ? { id: p.estat, valorX: n, modificador: 0 }
    : { id: p.estat, valorX: null, modificador: n };
}

/**
 * Dany d'un efecte que l'ha manifestat amb un cert excedent, preparat per a
 * `calcularDany` (combat/dany.mjs).
 * @param {{categoria:string, nivell:number}} dany
 * @param {number} excedent
 * @returns {{danyBaseArma:number, bonificadorArma:number, excedentAtac:number, directe:boolean, drenatge:boolean}}
 */
export function danyDeEfecte(dany, excedent) {
  const n = Math.max(0, Number(dany?.nivell) || 0);
  return {
    danyBaseArma: n,
    bonificadorArma: n,
    excedentAtac: Math.max(0, Number(excedent) || 0),
    directe: dany?.categoria === "directe" || dany?.categoria === "drenatge",
    drenatge: dany?.categoria === "drenatge"
  };
}

/**
 * Armes base dels artefactes (paràmetre `arma`) → arma del catàleg
 * (`armes.json`), per saber-ne la categoria, l'abast, l'atribut del dany i
 * les propietats (manual › Artefactes basats en armes, l. 4163: «pren les
 * característiques bàsiques de l'objecte en què es basa»).
 */
export const ARMA_CATALEG_PER_BASE = {
  "cop": "cop", "contundent": "contundents", "de-ma": "de-ma", "destral": "destrals",
  "escut": "escuts", "espasa": "espases", "fulla-curta": "fulla-curta", "fulla-llarga": "fulla-llarga",
  "llanca": "llances-i-armes-de-pal", "pic": "pics", "pistola": "pistoles", "subfusell": "subfusells",
  "arma-assalt": "armes-dassalt", "rifle": "rifles", "escopeta": "escopetes"
};

/**
 * Dades (`system`) de l'arma que representa un artefacte basat en una arma
 * (paràmetre `arma`): la del catàleg amb la latència de l'artefacte, el dany
 * de l'arma més el del paràmetre `dany` (Espasa d'energia: espasa +2 i dany
 * directe +6 → «8 de dany directe»), la pista segons el tipus de dany i els
 * estats que aplica en impactar.
 * @param {{system:object}} artefacte
 * @param {object[]} catalegArmes  `CONFIG.FORJA.CATALEG_ARMES`
 * @returns {object|null}
 */
export function armaDeArtefacte(artefacte, catalegArmes) {
  const parametres = artefacte?.system?.parametres ?? [];
  const pArma = parametres.find(p => p.tipus === "arma");
  if (!pArma) return null;
  const base = (catalegArmes ?? []).find(a => a.id === ARMA_CATALEG_PER_BASE[pArma.base]) ?? null;
  const pDany = parametres.find(p => p.tipus === "dany");
  const atribut = String(base?.danyBase ?? "FOR").match(/^[A-Z]{3}/)?.[0] ?? "FOR";
  const bonus = (Number(pArma.dany) || 0) + (Number(pDany?.nivell) || 0);
  const directe = pDany?.categoria === "directe" || pDany?.categoria === "drenatge";
  const pistes = pDany ? pistesDany(pDany.danyTipus) : ["ferides"];
  return {
    categoria:   base?.categoria ?? "cosAcos",
    modLatencia: artefacte.system.us?.modLatencia ?? Number(pArma.latencia) ?? 0,
    abast:       base?.abast ?? 0,
    rangMultFor: base?.rangMultFor ?? 0,
    esEscut:     base?.esEscut ?? false,
    danyBase:    `${atribut}+${bonus}`,
    propietats:  [...new Set([...(base?.propietats ?? []), ...(directe ? ["directe"] : [])])],
    pista:       pistes.length === 1 ? pistes[0] : "ambdues",
    estatsImpacte: parametres.filter(p => p.tipus === "estat").map(estatDeParametre),
    descripcio:  artefacte.system.mecanica ?? ""
  };
}

/**
 * Dades (`system`) de les armadures que representen un artefacte: la de la
 * base (paràmetre `armaduraBase`: flexible o rígida, amb la latència de
 * l'artefacte, com la Holocapa «latència +2 i protecció 3»), l'armadura
 * natural (paràmetre `armadura`, p. ex. el Ciberbraç) i l'ègida (paràmetre
 * `egida`, p. ex. l'Espasa pretoriana).
 * @param {{system:object}} artefacte
 * @returns {object[]}
 */
export function armaduresDeArtefacte(artefacte) {
  const parametres = artefacte?.system?.parametres ?? [];
  const sortida = [];
  const pBase = parametres.find(p => p.tipus === "armaduraBase");
  if (pBase) {
    sortida.push({
      tipus: String(pBase.base).includes("flexible") ? "flexible" : "fisica",
      reduccio: Number(pBase.proteccio) || 0,
      modLatencia: artefacte.system.us?.modLatencia ?? Number(pBase.latencia) ?? 0,
      egida: { activa: false, absorcio: 0, tornsInactiva: 0 }
    });
  }
  const b = bonificacionsDeParametres(parametres);
  if (b.armadura > 0) {
    sortida.push({ tipus: "natural", reduccio: b.armadura, modLatencia: 0, egida: { activa: false, absorcio: 0, tornsInactiva: 0 } });
  }
  if (b.egida > 0) {
    sortida.push({ tipus: "natural", reduccio: 0, modLatencia: 0, egida: { activa: true, absorcio: b.egida, tornsInactiva: 0 } });
  }
  return sortida;
}

/**
 * L'artefacte dona les seves bonificacions sense activar-lo: és permanent,
 * o és una arma o armadura (actives mentre es porten).
 * @param {{system:object}} artefacte
 * @returns {boolean}
 */
export function artefacteSempreActiu(artefacte) {
  const s = artefacte?.system ?? {};
  if (s.equipat === false || s.trencat) return false;
  return s.construccio?.permanent || s.activacio?.tipus === "permanent"
    || ["permanent", "arma", "armadura"].includes(s.categoria);
}
