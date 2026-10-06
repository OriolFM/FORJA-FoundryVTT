/**
 * Motor de paràmetres per construir efectes sobrenaturals a mida (S-23,
 * manual p. 642-1160). El cost total és la suma del cost de cada paràmetre
 * triat; la dificultat i la latència, igual (manual p. 687-695: "El cost
 * total es calcula afegint el cost acumulat de cadascun dels paràmetres
 * rellevants... la dificultat es calcula afegint el cost acumulat de la
 * dificultat per cadascun dels paràmetres rellevants").
 *
 * **Categories cobertes**: les bàsiques (abast, objectius, durada, ús, tipus
 * efecte/ritual), les cinc més freqüents al catàleg real (S-25): Dany,
 * Curació, Protecció, Estats, Habilitats — i les vuit "exòtiques" que
 * faltaven (afegides en una sessió posterior, mateix patró exacte):
 * Percepció i il·lusions, Alteració, Transformació, Translocació, Mentals,
 * Teletracció/telecinesi, Replicació/Conjuració, Creació de
 * constructes/Invocació. Amb això, el motor cobreix totes les categories de
 * paràmetres del manual (cap. 4, p. 642-1160).
 *
 * Tres d'aquestes vuit no encaixen en el patró de "taula amb id a triar"
 * de la resta perquè depenen d'un número extern que el manual demana
 * consultar en un altre document (el cost en PC d'un tret, d'un alter ego,
 * o d'una criatura invocada) — es demana a l'usuari que l'introdueixi a mà
 * (DA-5), no s'intenta enllaçar amb cap catàleg/fitxa real:
 *   - **Alteració**: "Tret" — cost = valor absolut del cost del tret
 *     (manual p. 987, sempre positiu, tant per afegir com per treure'n un).
 *   - **Transformació**: cost = 0,25 PC per cada PC de cost de l'alter ego
 *     (manual p. 1001) — caldria "un full de PJ completament separat" que
 *     aquest constructor no gestiona.
 *   - **Creació de constructes/Invocació**: cost = 15 + (0,25 PC per cada
 *     PC de cost de la criatura invocada), dificultat 4, latència 15
 *     (manual p. 1156-1158).
 *
 * **Artefactes (S-30)**: el mateix motor de paràmetres es reutilitza per
 * dissenyar artefactes — es construeixen amb els mateixos blocs bàsics
 * (abast/objectius/durada/dany/curació/protecció/estats/habilitats) més dos
 * paràmetres exclusius d'artefacte (`seleccio.artefacte`, opcional):
 * `activacioId` (`CONFIG.FORJA.PARAMETRES.artefacteActivacio` — normal/trivial) i
 * `modeEsperaId` (`CONFIG.FORJA.PARAMETRES.artefacteModeEspera` — si cal invertir
 * temps mantenint-lo preparat perquè l'activació sigui trivial). **No
 * confondre amb el `carrega.modeEspera` de S-26** (`combat/artefactes.mjs`):
 * aquell és un booleà d'estat en joc (recàrrega manual vs. automàtica per
 * torn); aquest és un paràmetre de disseny (cost en PC), conceptes diferents
 * que el manual només comparteix de nom.
 */

/**
 * @typedef {object} SeleccioConstruccio
 * @property {string} tipus       "efecte" | "ritual"
 * @property {string} abast       id de `CONFIG.FORJA.PARAMETRES.abast`
 * @property {string} objectius   id de `CONFIG.FORJA.PARAMETRES.objectius`
 * @property {string} durada      id de `CONFIG.FORJA.PARAMETRES.durada`
 * @property {string} usTemps     id de `CONFIG.FORJA.PARAMETRES.usTemps`
 * @property {string} usAccio     id de `CONFIG.FORJA.PARAMETRES.usAccio`
 * @property {{categoria:string, tipus:string, nivell:number}|null} dany
 * @property {{tipus:string, nivell:number, extra:string[]}|null} curacio
 * @property {{tipus:string, nivell:number}|null} proteccio
 * @property {Array<{id:string, nivell:number}>} estats
 * @property {Array<{id:string, nivell:number}>} habilitats
 * @property {{activacioId:string, modeEsperaId:string}|null} [artefacte]
 * @property {{tipus:string, nivell:number}|null} [percepcio]
 * @property {{mode:"atribut"|"tret", nivellAtribut:number, costTret:number}|null} [alteracio]
 * @property {{costAlterEgo:number}|null} [transformacio]
 * @property {{tipus:string, distancia:string}|null} [translocacio]
 * @property {{tipus:string}|null} [mentals]
 * @property {{categoria:string}|null} [telecinesi]
 * @property {{massa:string, complexitat:string}|null} [replicacio]
 * @property {{costCriatura:number}|null} [invocacio]
 */

/**
 * **Fase 2 (2026-10-06): llista de paràmetres.** Els artefactes i els efectes
 * es descriuen com una llista de paràmetres (`system.parametres`), igual que
 * el skill de referència `skills/forja-parametres` (que reprodueix les 83
 * plantilles del manual). Cada paràmetre és `{ tipus, ...dades }`; vegeu
 * `costParametre` per als tipus. Es poden repetir (diverses capacitats
 * mentals, atribut i tret alhora, dues eines…).
 *
 * Ajustos finals (`calcularParametres`), manual › Dificultat (l. 4758) i
 * › Latència (l. 4776):
 *   - **Dificultat declarada**: −5 PC per cada punt per sobre de la
 *     calculada, +5 per cada punt per sota (comptant des de la calculada,
 *     encara que sigui 0 o negativa). Mínim 1, excepte els artefactes
 *     permanents (sense tirada d'activació: no hi ha ajust).
 *   - **Latència declarada**: −2 PC per punt per sobre de la calculada, +2
 *     per punt per sota. Modificació màxima ±12 (avís si se supera).
 *   - Sense dificultat declarada (armes, armadures i artefactes sense
 *     tirada d'activació): sense ajust; amb `autoDificultat`, una dificultat
 *     calculada inferior a 1 puja a 1 i retorna 5 PC per punt (decisió de
 *     disseny, 4/10/2026; és el que fa el constructor).
 *   - El cost s'arrodoneix cap amunt.
 */

function _buscar(llista, id) {
  return (llista ?? []).find(e => e.id === id) ?? null;
}

/** Tipus de paràmetre que el constructor sap afegir (ordre del formulari). */
export const TIPUS_PARAMETRE = [
  "ritual", "narratiu", "reaccio", "distancia", "usuari", "area", "durada",
  "activacio", "recarrega", "acumulador", "espera",
  "arma", "armaduraBase",
  "dany", "cura", "curaEstats", "curaMalalties",
  "armadura", "egida", "barrera",
  "eina", "autoeina", "alterarPercepcio", "illusio",
  "estat", "atribut", "tret", "transformacio", "translocacio",
  "mental", "telecinesi", "replicacio", "invocacio"
];

/** Valors per defecte de cada tipus de paràmetre (en afegir-ne un de nou). */
export const PARAMETRE_PER_DEFECTE = {
  activacio:        { mode: "trivial" },
  recarrega:        { unitats: 1 },
  acumulador:       { carregues: 1 },
  arma:             { base: "espasa", latencia: 1, dany: 2 },
  armaduraBase:     { base: "lleugera-flexible", latencia: 0, proteccio: 1 },
  dany:             { categoria: "indirecte", nivell: 1, danyTipus: "fatiga" },
  cura:             { nivell: 1, pista: "fatiga" },
  armadura:         { nivell: 1 },
  egida:            { nivell: 1 },
  barrera:          { nivell: 1 },
  eina:             { nivell: 1, segona: false, habilitat: null },
  autoeina:         { nivell: 1, segona: false, habilitat: null },
  alterarPercepcio: { nivell: 1 },
  illusio:          { nivell: 0 },
  estat:            { estat: "atordit", nivell: 0 },
  atribut:          { nivell: 1, atribut: null },
  tret:             { tret: null, cost: 0 },
  transformacio:    { costAlterEgo: 0 },
  translocacio:     { mode: "translocacio", distancia: "curta" },
  mental:           { mode: "llegir" },
  telecinesi:       { categoria: "alfa" },
  replicacio:       { massa: "menys-1kg", complexitat: "materia-primera" },
  invocacio:        { costCriatura: 0, criatura: null }
};

const N = (v, min = 0) => Math.max(min, Number(v) || 0);

/**
 * Cost, dificultat i latència d'un paràmetre (taula de paràmetres del manual,
 * cap. 4, l. 4696–5360; `config/dades/parametres.json`). Mateixos valors que
 * `skills/forja-parametres/motor/forja_parametres.py`.
 * @param {object} param  `{ tipus, ... }`
 * @param {object} [P=CONFIG.FORJA.PARAMETRES]
 * @returns {{etiqueta:string, cost:number, dificultat:number, latencia:number}|null}
 */
export function costParametre(param, P = CONFIG.FORJA.PARAMETRES) {
  const r = (etiqueta, cost = 0, dificultat = 0, latencia = 0) => ({ etiqueta, cost, dificultat, latencia });
  const t = (llista, id) => _buscar(P[llista], id);
  switch (param?.tipus) {
    case "ritual":    { const e = t("tipusEfecte", "ritual"); return r(e.nom, e.cost, e.dificultat, e.latencia); }
    case "narratiu":  { const e = t("usTemps", "narratiu"); return r(e.nom, e.cost, e.dificultat); }
    case "reaccio":   { const e = t("usAccio", "reaccio"); return r(e.nom, e.cost); }
    case "distancia": { const e = t("abast", "distancia"); return r(`Abast: ${e.nom}`, e.cost, e.dificultat); }
    case "usuari":    { const e = t("objectius", "usuari"); return r(`Objectius: ${e.nom}`, e.cost, e.dificultat); }
    case "area":      { const e = t("objectius", "area"); return r(`Objectius: ${e.nom}`, e.cost, e.dificultat); }
    case "durada":    { const e = t("durada", "escena"); return r(e.nom, e.cost, e.dificultat); }
    case "activacio": {
      const e = t("artefacteActivacio", param.mode);
      return e ? r(e.nom, e.cost, e.dificultat ?? 0) : null;
    }
    case "recarrega": {
      const u = N(param.unitats);
      return r(`Recàrrega: ${u}`, (P.artefacteCarrega?.recarregaPerUnitat ?? -2) * u);
    }
    case "acumulador": {
      const c = N(param.carregues);
      return r(`Acumulador: +${c} càrregues`, (P.artefacteCarrega?.acumuladorPerCarrega ?? 3) * c);
    }
    case "espera":    { const e = t("artefacteModeEspera", "espera"); return r(e.nom, e.cost); }
    case "arma": {
      const b = t("armesBase", param.base);
      if (!b) return null;
      const lat = Number(param.latencia) || 0, dany = Number(param.dany) || 0;
      return r(`${b.nom} (latència ${lat}, dany +${dany})`, 2 * Math.max(0, dany - b.dany) - 2 * (lat - b.latencia), 0, lat);
    }
    case "armaduraBase": {
      const b = t("armaduresBase", param.base);
      if (!b) return null;
      const lat = Number(param.latencia) || 0, prot = Number(param.proteccio) || 0;
      return r(`Armadura ${b.nom} (latència ${lat}, protecció ${prot})`, 2 * (prot - b.proteccio) - 2 * (lat - b.latencia), 0, lat);
    }
    case "dany": {
      const cat = t("danyCategoria", param.categoria), tip = t("danyTipus", param.danyTipus);
      if (!cat) return null;
      const n = N(param.nivell);
      return r(`Dany ${cat.nom.toLowerCase()} +${n}${tip ? ` (${tip.nom.toLowerCase()})` : ""}`,
        cat.costBase + cat.costPerNivell * n + (tip?.cost ?? 0), cat.dificultat);
    }
    case "cura": {
      const c = t("curacio", param.pista);
      if (!c) return null;
      const n = N(param.nivell);
      return r(`Curació ${n} (${c.nom.toLowerCase()})`, c.costBase + c.costPerNivell * n);
    }
    case "curaEstats":    { const e = t("curacioExtra", "estats-negatius"); return r(e.nom, e.cost); }
    case "curaMalalties": { const e = t("curacioExtra", "malalties"); return r(e.nom, e.cost); }
    case "armadura":
    case "egida":
    case "barrera": {
      const id = { armadura: "armadura", egida: "egida", barrera: "barrera-fisica" }[param.tipus];
      const e = t("proteccio", id), n = N(param.nivell);
      return r(`${e.nom} ${n}`, e.costBase + e.costPerNivell * n);
    }
    case "eina":
    case "autoeina": {
      const id = `${param.tipus}-${param.segona ? 2 : 1}`;
      const e = t("habilitats", id), n = N(param.nivell);
      const hab = param.habilitat ? ` — ${param.habilitat}` : "";
      return r(`${e.nom}: ${param.tipus === "eina" ? "+" : ""}${n}${param.tipus === "autoeina" ? " fites" : ""}${hab}`,
        e.costBase + e.costPerNivell * n, e.dificultat, e.latencia);
    }
    case "alterarPercepcio":
    case "illusio": {
      const e = t("percepcio", param.tipus === "illusio" ? "illusio" : "alterar"), n = N(param.nivell);
      return r(`${e.nom} +${n}`, e.costBase + e.costPerNivell * n, e.dificultat);
    }
    case "estat": {
      const id = param.estat === "malaltia-toxina" ? "malaltia" : param.estat;
      const e = t("estats", id), n = N(param.nivell);
      if (!e) return null;
      return r(`Estat: ${e.nom} (+${n})`, e.costBase + e.costPerNivell * n, e.dificultat);
    }
    case "atribut": {
      const n = N(param.nivell, 1);
      return r(`Atribut${param.atribut ? ` ${param.atribut}` : ""} +${n}`, 5 + 5 * n);
    }
    case "tret":          return r(`Tret: ${param.tret ?? "?"}`, Math.abs(Number(param.cost) || 0));
    case "transformacio": return r(`Transformació (alter ego ${N(param.costAlterEgo)} PC)`, 0.25 * N(param.costAlterEgo));
    case "translocacio": {
      const a = t("translocacioTipus", param.mode), b = t("translocacioDistancia", param.distancia);
      if (!a || !b) return null;
      return r(`${a.nom}: ${b.nom.toLowerCase()}`, a.cost + b.cost, a.dificultat + b.dificultat, a.latencia + b.latencia);
    }
    case "mental": {
      const e = t("mentals", param.mode);
      return e ? r(e.nom, e.cost, e.dificultat) : null;
    }
    case "telecinesi": {
      const e = t("telecinesi", param.categoria);
      return e ? r(`Telecinesi ${e.nom.toLowerCase()} (dany ${e.danyBasic})`, e.cost, e.dificultat) : null;
    }
    case "replicacio": {
      const a = t("replicacioMassa", param.massa), b = t("replicacioComplexitat", param.complexitat);
      if (!a || !b) return null;
      return r(`Replicació: ${a.nom.toLowerCase()}, ${b.nom.toLowerCase()}`, a.cost + b.cost, a.dificultat + b.dificultat, a.latencia + b.latencia);
    }
    case "invocacio": {
      const c = N(param.costCriatura);
      return r(`Invocació (criatura de ${c} PC)`, 15 + 0.25 * c, 4, 15);
    }
    default: return null;
  }
}

/**
 * Cost, dificultat i latència d'una llista de paràmetres, amb els ajustos de
 * dificultat i latència declarades (vegeu la capçalera).
 * @param {object[]} parametres
 * @param {object} [opcions]
 * @param {number|null} [opcions.dificultatDeclarada=null]
 * @param {number|null} [opcions.latenciaDeclarada=null]
 * @param {boolean} [opcions.permanent=false]
 * @param {boolean} [opcions.autoDificultat=false]  Puja a 1 una dificultat calculada inferior.
 * @param {object} [P=CONFIG.FORJA.PARAMETRES]
 * @returns {{cost:number, dificultat:number|null, latencia:number, dificultatCalculada:number,
 *   latenciaCalculada:number, desglossament:Array<{etiqueta:string, cost:number, dificultat:number, latencia:number}>, avisos:string[]}}
 */
export function calcularParametres(parametres, {
  dificultatDeclarada = null, latenciaDeclarada = null, permanent = false, autoDificultat = false
} = {}, P = CONFIG.FORJA.PARAMETRES) {
  const desglossament = [];
  const avisos = [];
  for (const param of parametres ?? []) {
    const linia = costParametre(param, P);
    if (linia) desglossament.push(linia);
    else avisos.push(`Paràmetre desconegut: ${JSON.stringify(param)}`);
  }
  const suma = (k) => desglossament.reduce((acc, l) => acc + l[k], 0);
  let cost = suma("cost");
  const dificultatCalculada = suma("dificultat");
  const latenciaCalculada = suma("latencia");

  let dificultat = dificultatDeclarada;
  if (dificultat == null && autoDificultat && !permanent && dificultatCalculada < 1) dificultat = 1;
  if (dificultat != null && !permanent && dificultat !== dificultatCalculada) {
    const ajust = -5 * (dificultat - dificultatCalculada);
    desglossament.push({ etiqueta: `Dificultat ${dificultatCalculada} → ${dificultat}`, cost: ajust, dificultat: 0, latencia: 0 });
    cost += ajust;
  }
  if (dificultat != null && dificultat < 1 && !permanent) avisos.push("La dificultat no pot ser inferior a 1 (excepte artefactes permanents).");

  let latencia = latenciaCalculada;
  if (latenciaDeclarada != null && latenciaDeclarada !== latenciaCalculada) {
    const ajust = -2 * (latenciaDeclarada - latenciaCalculada);
    desglossament.push({ etiqueta: `Latència ${latenciaCalculada} → ${latenciaDeclarada}`, cost: ajust, dificultat: 0, latencia: 0 });
    cost += ajust;
    latencia = latenciaDeclarada;
    if (Math.abs(latenciaDeclarada - latenciaCalculada) > 12) avisos.push("La latència es pot modificar com a màxim ±12.");
  }

  return {
    cost: Math.ceil(cost - 1e-9),
    dificultat: dificultat ?? (permanent ? null : Math.max(1, dificultatCalculada)),
    latencia,
    dificultatCalculada,
    latenciaCalculada,
    desglossament,
    avisos
  };
}

/**
 * Converteix la selecció antiga del constructor (un bloc per categoria) en
 * una llista de paràmetres.
 * @param {SeleccioConstruccio} s
 * @returns {object[]}
 */
export function seleccioAParametres(s) {
  const llista = [];
  if (s.tipus === "ritual") llista.push({ tipus: "ritual" });
  if (s.usTemps === "narratiu") llista.push({ tipus: "narratiu" });
  if (s.usAccio === "reaccio") llista.push({ tipus: "reaccio" });
  if (s.abast === "distancia") llista.push({ tipus: "distancia" });
  if (s.objectius === "usuari") llista.push({ tipus: "usuari" });
  if (s.objectius === "area") llista.push({ tipus: "area" });
  if (s.durada === "escena") llista.push({ tipus: "durada" });
  if (s.artefacte?.activacioId && s.artefacte.activacioId !== "normal") llista.push({ tipus: "activacio", mode: s.artefacte.activacioId });
  if (s.artefacte?.modeEsperaId === "espera") llista.push({ tipus: "espera" });
  if (s.dany) llista.push({ tipus: "dany", categoria: s.dany.categoria, nivell: s.dany.nivell, danyTipus: s.dany.tipus });
  if (s.curacio) {
    llista.push({ tipus: "cura", nivell: s.curacio.nivell, pista: s.curacio.tipus });
    for (const extra of s.curacio.extra ?? []) llista.push({ tipus: extra === "malalties" ? "curaMalalties" : "curaEstats" });
  }
  if (s.proteccio) {
    const tipus = { armadura: "armadura", egida: "egida", "barrera-fisica": "barrera" }[s.proteccio.tipus];
    if (tipus) llista.push({ tipus, nivell: s.proteccio.nivell });
  }
  for (const e of s.estats ?? []) llista.push({ tipus: "estat", estat: e.id, nivell: e.nivell });
  for (const h of s.habilitats ?? []) {
    const [tipus, ordre] = h.id.split("-");
    llista.push({ tipus, nivell: h.nivell, segona: ordre === "2", habilitat: h.habilitat ?? null });
  }
  if (s.percepcio) llista.push({ tipus: s.percepcio.tipus === "illusio" ? "illusio" : "alterarPercepcio", nivell: s.percepcio.nivell });
  if (s.alteracio) {
    llista.push(s.alteracio.mode === "tret"
      ? { tipus: "tret", tret: null, cost: s.alteracio.costTret }
      : { tipus: "atribut", nivell: s.alteracio.nivellAtribut, atribut: null });
  }
  if (s.transformacio) llista.push({ tipus: "transformacio", costAlterEgo: s.transformacio.costAlterEgo });
  if (s.translocacio) llista.push({ tipus: "translocacio", mode: s.translocacio.tipus, distancia: s.translocacio.distancia });
  if (s.mentals) llista.push({ tipus: "mental", mode: s.mentals.tipus });
  if (s.telecinesi) llista.push({ tipus: "telecinesi", categoria: s.telecinesi.categoria });
  if (s.replicacio) llista.push({ tipus: "replicacio", massa: s.replicacio.massa, complexitat: s.replicacio.complexitat });
  if (s.invocacio) llista.push({ tipus: "invocacio", costCriatura: s.invocacio.costCriatura });
  return llista;
}

/**
 * Compatibilitat: calcula una selecció antiga del constructor (vegeu
 * `seleccioAParametres`), amb la dificultat mínima 1 automàtica.
 * @param {SeleccioConstruccio} seleccio
 * @returns {ReturnType<typeof calcularParametres>}
 */
export function calcularConstruccio(seleccio) {
  return calcularParametres(seleccioAParametres(seleccio), { autoDificultat: true });
}
