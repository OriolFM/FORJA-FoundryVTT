/**
 * Pipeline de dany (S-14, A2). Verificat contra el manual (FORJA_03_SISTEMES.md, p. 92-94;
 * FC001CA: SISTEMES › Dany › Protecció / Reducció de dany / Dany mínim):
 *
 *   danyTotal = danyBaseArma(resolt) + excedentAtac
 *
 *   1. Ègida (si n'hi ha i és efectiva contra el tipus de dany):
 *      - danyTotal ≤ protecció ègida → dany final 0, ègida intacta
 *      - danyTotal > protecció ègida → ègida es trenca (queda inactiva
 *        `danyTotal − protecció` torns); l'objectiu rep el DANY MÍNIM
 *        com si fos dany directe, IGNORANT armadura i reducció
 *
 *   2. Armadura: restant = danyTotal − armadura
 *      - restant ≤ 0 → l'armadura ATURA l'atac per complet, dany final 0
 *        (no s'aplica el dany mínim — l'armadura ha parat l'atac, no la reducció)
 *
 *   3. Reducció de dany: final = restant − reduccioDany
 *      - si final ≤ 0 → ha estat la REDUCCIÓ qui ha portat el dany a zero
 *        (l'armadura no ha aturat l'atac del tot): s'aplica el DANY MÍNIM
 *        = 1 + bonificador fix de l'arma (o moviment especial)
 *      - si no, `final` és el dany que es marca a la pista corresponent
 */

/**
 * Resol la fórmula de dany d'una arma (p. ex. "FOR+2", "DES+1", "3") contra
 * un actor, retornant tant el valor total com el bonificador fix (la part
 * numèrica constant, necessària per calcular el Dany mínim).
 *
 * @param {string} formula
 * @param {ForjaActor} [actor]
 * @returns {{valor:number, bonificador:number}}
 */
export function resoldreDanyArma(formula, actor) {
  const text = String(formula ?? "").trim().toUpperCase();
  const m = text.match(/^(?:([A-Z]{3})\s*(?:\+\s*(\d+))?|(\d+))$/);
  if (!m) return { valor: 0, bonificador: 0 };

  const [, atribut, bonusAmbAtribut, bonusSol] = m;
  const bonificador = Number(bonusAmbAtribut ?? bonusSol ?? 0);
  const base = atribut ? (actor?.system?.atributs?.[atribut] ?? 0) : 0;

  return { valor: base + bonificador, bonificador };
}

/**
 * Calcula el dany final que rep un objectiu, aplicant ègida, armadura i
 * reducció de dany pel mateix ordre i casuística que el manual.
 *
 * @param {object}  config
 * @param {number}  config.danyBaseArma   Dany base de l'arma ja resolt (valor de `resoldreDanyArma`)
 * @param {number}  config.bonificadorArma Bonificador fix de l'arma/moviment especial (per al Dany mínim)
 * @param {number}  config.excedentAtac   Excedent de la tirada d'atac sobre la dificultat
 * @param {number}  config.reduccioDany   Reducció de dany del defensor (= FOR)
 * @param {number}  [config.armadura=0]   Protecció de l'armadura del defensor (si escau pel tipus)
 * @param {object}  [config.egida]        `{ activa, absorcio, tornsInactiva }` — ègida efectiva contra aquest tipus de dany
 * @param {number}  [config.danyExtra=0]  Dany addicional que REP el defensor si l'atac impacta
 *   (B14: pífia en esquivar, +1 per cada 1 de la tirada espifiada — vegeu `danyExtraPifiaEsquivar`).
 *   Manual l. ~4018: "rebria més mal (un punt més de dany per cada resultat de 1)": se suma al
 *   dany final, DESPRÉS d'ègida, armadura i reducció (s'ha posat a la trajectòria de l'atac).
 * @returns {{danyTotal:number, danyFinal:number, egidaTrencada:boolean, tornsInactivaEgida:number}}
 */
export function calcularDany({
  danyBaseArma,
  bonificadorArma = 0,
  excedentAtac,
  reduccioDany,
  armadura = 0,
  egida = null,
  danyExtra = 0
}) {
  const resultat = _calcularDanyBase({ danyBaseArma, bonificadorArma, excedentAtac, reduccioDany, armadura, egida });
  const extra = Math.max(0, danyExtra ?? 0);
  return extra ? { ...resultat, danyFinal: resultat.danyFinal + extra } : resultat;
}

function _calcularDanyBase({ danyBaseArma, bonificadorArma, excedentAtac, reduccioDany, armadura, egida }) {
  const danyTotal = danyBaseArma + excedentAtac;
  const danyMinim = 1 + bonificadorArma;

  // 1. Ègida
  if (egida?.activa && egida.absorcio > 0) {
    if (danyTotal <= egida.absorcio) {
      return { danyTotal, danyFinal: 0, egidaTrencada: false, tornsInactivaEgida: 0 };
    }
    return {
      danyTotal,
      danyFinal: danyMinim,
      egidaTrencada: true,
      tornsInactivaEgida: danyTotal - egida.absorcio
    };
  }

  // 2. Armadura
  const restantArmadura = danyTotal - armadura;
  if (restantArmadura <= 0) {
    return { danyTotal, danyFinal: 0, egidaTrencada: false, tornsInactivaEgida: 0 };
  }

  // 3. Reducció de dany — el Dany mínim només s'aplica si la reducció (no l'armadura) porta el dany a zero
  const restantReduccio = restantArmadura - reduccioDany;
  const danyFinal = restantReduccio > 0 ? restantReduccio : danyMinim;

  return { danyTotal, danyFinal, egidaTrencada: false, tornsInactivaEgida: 0 };
}

/**
 * Encamina i marca el dany a la pista de salut corresponent (fatiga o ferides),
 * a partir del nivell actiu cap avall (regla d'arrossegament del manual).
 *
 * @param {object} salut       `system.salut` de l'actor objectiu
 * @param {"fatiga"|"ferides"} pista
 * @param {number} quantitat   Caselles a marcar (negatiu per curar)
 * @param {object} [opcions]
 * @param {boolean} [opcions.noMort=false]  Manual p. 244: un No-Mort només
 *   guanya la meitat de fatiga (arrodonint cap amunt) per atacs o efectes.
 *   No afecta ferides ni curació (quantitat negativa).
 * @returns {number} Total de caselles marcades després d'aplicar el dany
 */
export function aplicarDanyAPista(salut, pista, quantitat, { noMort = false } = {}) {
  const linia = salut[pista];
  const quantitatFinal = (noMort && pista === "fatiga" && quantitat > 0)
    ? Math.ceil(quantitat / 2)
    : quantitat;
  linia.marcats = Math.max(0, linia.marcats + quantitatFinal);
  return linia.marcats;
}

/* -------------------------------------------- */
/*  Armadures i ègides (B3, B4)                 */
/* -------------------------------------------- */

/**
 * Una armadura compta si està equipada. Les armadures d'abans del camp
 * `equipada` (WP-G) es consideren equipades (`!== false`).
 * @param {{type:string, system:object}} item
 * @returns {boolean}
 */
export function esArmaduraEquipada(item) {
  return item?.type === "armadura" && item.system?.equipada !== false;
}

/**
 * Protecció d'armadura efectiva d'un objectiu (B3, funció pura).
 *
 * Manual FC001CA, SISTEMES › Armadures (l. 3337): "Si un PJ vol portar dues
 * armadures, pot combinar-ne una de flexible amb una de rígida [...]. La
 * flexible suma la meitat de la protecció habitual a la rígida (arrodonint
 * cap amunt), però afegeix la penalització completa a la latència". Per tant:
 * la base és la millor armadura no flexible (rígida o natural) — o la millor
 * flexible si no n'hi ha cap altra — i la millor flexible restant hi suma la
 * meitat (amunt) de la seva protecció, encara que protegeixi més que la base. Exemples del manual:
 * 5 (cuirassa) + ⌈3/2⌉ (capa) = 7; 1 + ⌈1/2⌉ = 2. Dues rígides no s'apilen.
 * Les latències s'apilen senceres (ja ho fa `actor-personatge.mjs`).
 * La restricció "flexible de la mateixa categoria o més lleugera" no es
 * comprova: el model de dades no té categoria de pes.
 * (Substitueix la decisió provisional Q3 "només la millor": l'Oriol FM va
 * confirmar el 2026-09-27 que mana el manual.)
 *
 * El manual no lliga el tipus d'armadura a la categoria de l'arma; només
 * alguns moviments especials en fan cas (p.ex. la maniobra d'arts marcials
 * "Cop penetrant" ignora les armadures naturals i flexibles) — d'aquí
 * `ignorarTipus`.
 *
 * B13 (Escopetes, "Poca penetració -- Les armadures rígides ofereixen el
 * doble de protecció contra escopetes"): amb `dobleRigida`, les armadures
 * rígides (`tipus: "fisica"`) compten el doble abans de triar la millor.
 *
 * @param {Iterable<{type:string, system:object}>} items  Ítems de l'objectiu
 * @param {object} [opcions]
 * @param {string[]} [opcions.ignorarTipus=[]]  Tipus d'armadura (`fisica`/`flexible`/`natural`) que no compten
 * @param {boolean}  [opcions.dobleRigida=false]  L'atac és d'escopeta (B13)
 * @returns {number}
 */
export function proteccioArmadura(items, { ignorarTipus = [], dobleRigida = false } = {}) {
  const peces = [];
  for (const item of items ?? []) {
    if (!esArmaduraEquipada(item)) continue;
    if (ignorarTipus.includes(item.system.tipus)) continue;
    const base = item.system.reduccio ?? 0;
    peces.push({
      flexible:  item.system.tipus === "flexible",
      proteccio: (dobleRigida && esArmaduraRigida(item)) ? base * 2 : base
    });
  }
  if (!peces.length) return 0;
  peces.sort((a, b) => b.proteccio - a.proteccio);
  // La base és la millor armadura no flexible (rígida o natural); si només
  // n'hi ha de flexibles, la millor d'elles. Una altra flexible hi suma la meitat.
  const principal = peces.find(p => !p.flexible) ?? peces[0];
  const flexible  = peces.find(p => p.flexible && p !== principal);
  return principal.proteccio + (flexible ? Math.ceil(flexible.proteccio / 2) : 0);
}

/**
 * Armadura rígida (B13): al model de dades, `tipus === "fisica"` (vegeu
 * `item-armadura.mjs`: `fisica` / `flexible` / `natural`).
 * @param {{system:object}} item
 * @returns {boolean}
 */
export function esArmaduraRigida(item) {
  return item?.system?.tipus === "fisica";
}

/**
 * Dany extra per una pífia en esquivar (B14, funció pura).
 *
 * Manual FC001CA › Exemple de combat › "Esquivar o defensa bàsica?": "Si la
 * Yoko hagués espifiat la tirada, voldria dir que s'ha col·locat en la
 * trajectòria de l'atac, i que rebria més mal (un punt més de dany per cada
 * resultat de 1 a la tirada espifiada)". Pífia = cap fita i almenys un 1
 * (› Tirades › Pífies).
 *
 * Lectura: només per a ESQUIVAR (el manual no ho diu de parar ni blocar);
 * només s'aplica si l'atac impacta; el dany extra se suma al dany total
 * abans d'ègida/armadura/reducció, com qualsevol altre "+X al dany" (p. ex.
 * la ràfega de les armes d'assalt).
 *
 * @param {{pifia:boolean, dice:number[]}} resultats  `roll.forjaResults`
 * @returns {number}
 */
export function danyExtraPifiaEsquivar(resultats) {
  if (!resultats?.pifia) return 0;
  return (resultats.dice ?? []).filter(d => d === 1).length;
}

/**
 * Tria l'ègida activa d'un objectiu (B4, funció pura): la de més protecció
 * entre les armadures equipades amb l'ègida activa i `absorcio > 0`.
 * @param {Iterable<{type:string, system:object}>} items
 * @returns {object|null}  L'ítem d'armadura que la porta, o `null`
 */
export function itemEgidaActiva(items) {
  let millor = null;
  for (const item of items ?? []) {
    if (!esArmaduraEquipada(item)) continue;
    const e = item.system.egida;
    if (!e?.activa || !(e.absorcio > 0)) continue;
    if (!millor || e.absorcio > millor.system.egida.absorcio) millor = item;
  }
  return millor;
}

/**
 * Tick del rellotge en què una ègida trencada torna a ser efectiva (B4,
 * funció pura). Manual FC001CA, › Dany › Protecció: "l'ègida es trenca i
 * roman inactiva un nombre de torns equivalent al dany que la sobrepassa";
 * el dissenyador (Q2, Oriol FM) confirma que aquests torns són caselles del
 * rellotge de temps actiu, no torns del portador.
 * @param {number} marcador  Posició actual del marcador de temps
 * @param {number} tornsInactiva
 * @returns {number}
 */
export function tickReactivacioEgida(marcador, tornsInactiva) {
  return (marcador ?? 0) + Math.max(0, tornsInactiva ?? 0);
}

/**
 * Decideix si una ègida trencada s'ha de reactivar ara (B4, funció pura): té
 * un tick de reactivació desat (`flags.forja.egidaReactivaAlTick`), el
 * marcador l'ha assolit (o passat) i l'ègida encara té protecció
 * (`absorcio > 0`). El tick només es desa si el portador és combatent d'un
 * combat començat; en esborrar-lo o en començar-ne un altre, el DJ neteja els
 * ticks pendents (`ForjaCombat`), de manera que no queden ticks d'altres combats.
 * @param {{type:string, system:object, flags?:object}} item
 * @param {number} marcador
 * @returns {boolean}
 */
export function egidaHaDeReactivar(item, marcador) {
  if (item?.type !== "armadura") return false;
  const e = item.system?.egida;
  if (!e || e.activa || !(e.absorcio > 0)) return false;
  const tick = item.flags?.forja?.egidaReactivaAlTick;
  if (typeof tick !== "number") return false;
  return marcador >= tick;
}

/* -------------------------------------------- */
/*  Concentració (B5)                           */
/* -------------------------------------------- */

/**
 * Efecte del dany sobre un personatge concentrat (B5, funció pura).
 * Manual FC001CA, SISTEMES › Gestió del temps de joc › Concentració: "Si un
 * PJ pateix dany mentre està concentrat, perdrà la concentració i els
 * beneficis que n'extreu"; › Salut › Estats › Concentrat: "Si un PJ concentrat
 * rep més punts de dany que la seva FOR, se'l considera atordit, l'acció per
 * la que es concentrava fracassa, i haurà de tornar a declarar".
 * @param {boolean} concentrat
 * @param {number} danyFinal
 * @param {number} forca  FOR de l'objectiu
 * @returns {{trenca:boolean, atordit:boolean}}
 */
export function efecteDanyConcentracio(concentrat, danyFinal, forca) {
  if (!concentrat || !(danyFinal > 0)) return { trenca: false, atordit: false };
  return { trenca: true, atordit: danyFinal > (forca ?? 0) };
}
