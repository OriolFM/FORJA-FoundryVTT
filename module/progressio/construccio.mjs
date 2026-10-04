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
 * `activacioId` (`FORJA.PARAMETRES.artefacteActivacio` — normal/trivial) i
 * `modeEsperaId` (`FORJA.PARAMETRES.artefacteModeEspera` — si cal invertir
 * temps mantenint-lo preparat perquè l'activació sigui trivial). **No
 * confondre amb el `carrega.modeEspera` de S-26** (`combat/artefactes.mjs`):
 * aquell és un booleà d'estat en joc (recàrrega manual vs. automàtica per
 * torn); aquest és un paràmetre de disseny (cost en PC), conceptes diferents
 * que el manual només comparteix de nom.
 */

/**
 * @typedef {object} SeleccioConstruccio
 * @property {string} tipus       "efecte" | "ritual"
 * @property {string} abast       id de `FORJA.PARAMETRES.abast`
 * @property {string} objectius   id de `FORJA.PARAMETRES.objectius`
 * @property {string} durada      id de `FORJA.PARAMETRES.durada`
 * @property {string} usTemps     id de `FORJA.PARAMETRES.usTemps`
 * @property {string} usAccio     id de `FORJA.PARAMETRES.usAccio`
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

function _buscar(llista, id) {
  return llista.find(e => e.id === id) ?? null;
}

/**
 * Calcula el cost, dificultat i latència totals d'una selecció de
 * paràmetres, i un desglossament línia a línia (per mostrar a la UI i per
 * generar el text de `mecanica` automàticament).
 * @param {SeleccioConstruccio} seleccio
 * @returns {{cost:number, dificultat:number, latencia:number, desglossament:Array<{etiqueta:string, cost:number, dificultat:number, latencia:number}>}}
 */
export function calcularConstruccio(seleccio) {
  const P = CONFIG.FORJA.PARAMETRES;
  const linies = [];
  const afegir = (etiqueta, cost = 0, dificultat = 0, latencia = 0) => {
    if (cost || dificultat || latencia) linies.push({ etiqueta, cost, dificultat, latencia });
  };

  // ── Bàsics ──
  const tipusEfecte = _buscar(P.tipusEfecte, seleccio.tipus ?? "efecte");
  if (tipusEfecte) afegir(tipusEfecte.nom, tipusEfecte.cost, tipusEfecte.dificultat, tipusEfecte.latencia);

  const abast = _buscar(P.abast, seleccio.abast ?? "toc");
  if (abast) afegir(`Abast: ${abast.nom}`, abast.cost, abast.dificultat);

  const objectius = _buscar(P.objectius, seleccio.objectius ?? "individuals");
  if (objectius) afegir(`Objectius: ${objectius.nom}`, objectius.cost, objectius.dificultat);

  const durada = _buscar(P.durada, seleccio.durada ?? "instantania");
  if (durada) afegir(`Durada: ${durada.nom}`, durada.cost, durada.dificultat);

  const usTemps = _buscar(P.usTemps, seleccio.usTemps ?? "ambdos");
  if (usTemps) afegir(`Ús: ${usTemps.nom}`, usTemps.cost, usTemps.dificultat);

  const usAccio = _buscar(P.usAccio, seleccio.usAccio ?? "accio");
  if (usAccio) afegir(usAccio.nom, usAccio.cost);

  // ── Artefacte (S-30) ──
  if (seleccio.artefacte) {
    const activacio = _buscar(P.artefacteActivacio, seleccio.artefacte.activacioId ?? "normal");
    if (activacio) afegir(`Activació: ${activacio.nom}`, activacio.cost, activacio.dificultat ?? 0);
    const modeEspera = _buscar(P.artefacteModeEspera, seleccio.artefacte.modeEsperaId ?? "cap");
    if (modeEspera) afegir(modeEspera.nom, modeEspera.cost);
  }

  // ── Dany ──
  if (seleccio.dany) {
    const cat = _buscar(P.danyCategoria, seleccio.dany.categoria);
    const tip = _buscar(P.danyTipus, seleccio.dany.tipus);
    const nivell = Math.max(1, seleccio.dany.nivell ?? 1);
    if (cat) {
      afegir(`Dany (${cat.nom}, nivell ${nivell})`, cat.costBase + cat.costPerNivell * nivell, cat.dificultat);
    }
    if (tip) afegir(`Tipus de dany: ${tip.nom}`, tip.cost);
  }

  // ── Curació ──
  if (seleccio.curacio) {
    const tip = _buscar(P.curacio, seleccio.curacio.tipus);
    const nivell = Math.max(1, seleccio.curacio.nivell ?? 1);
    if (tip) afegir(`Curació (${tip.nom}, nivell ${nivell})`, tip.costBase + tip.costPerNivell * nivell);
    for (const extraId of seleccio.curacio.extra ?? []) {
      const extra = _buscar(P.curacioExtra, extraId);
      if (extra) afegir(extra.nom, extra.cost);
    }
  }

  // ── Protecció ──
  if (seleccio.proteccio) {
    const tip = _buscar(P.proteccio, seleccio.proteccio.tipus);
    const nivell = Math.max(1, seleccio.proteccio.nivell ?? 1);
    if (tip) afegir(`Protecció (${tip.nom}, nivell ${nivell})`, tip.costBase + tip.costPerNivell * nivell);
  }

  // ── Estats ──
  for (const e of seleccio.estats ?? []) {
    const est = _buscar(P.estats, e.id);
    if (!est) continue;
    const nivell = Math.max(1, e.nivell ?? 1);
    afegir(`Estat: ${est.nom} (nivell ${nivell})`, est.costBase + est.costPerNivell * nivell, est.dificultat);
  }

  // ── Habilitats ──
  for (const h of seleccio.habilitats ?? []) {
    const hab = _buscar(P.habilitats, h.id);
    if (!hab) continue;
    const nivell = Math.max(1, h.nivell ?? 1);
    afegir(`${hab.nom} (nivell ${nivell})`, hab.costBase + hab.costPerNivell * nivell, hab.dificultat, hab.latencia);
  }

  // ── Percepció i il·lusions (manual p. 938-946) ──
  if (seleccio.percepcio) {
    const tip = _buscar(P.percepcio, seleccio.percepcio.tipus);
    const nivell = Math.max(1, seleccio.percepcio.nivell ?? 1);
    if (tip) afegir(`${tip.nom} (nivell ${nivell})`, tip.costBase + tip.costPerNivell * nivell, tip.dificultat);
  }

  // ── Alteració (manual p. 976-988) ──
  if (seleccio.alteracio) {
    if (seleccio.alteracio.mode === "tret") {
      const cost = Math.abs(seleccio.alteracio.costTret ?? 0);
      if (cost) afegir("Alteració: tret (afegir/treure)", cost);
    } else {
      const nivell = Math.max(1, seleccio.alteracio.nivellAtribut ?? 1);
      afegir(`Alteració: atribut (${nivell} punt${nivell > 1 ? "s" : ""})`, 5 + 5 * nivell);
    }
  }

  // ── Transformació (manual p. 989-1003) ──
  if (seleccio.transformacio) {
    const costAlterEgo = Math.max(0, seleccio.transformacio.costAlterEgo ?? 0);
    if (costAlterEgo) afegir(`Transformació (alter ego ${costAlterEgo} PC)`, 0.25 * costAlterEgo);
  }

  // ── Translocació (manual p. 1004-1028) ──
  if (seleccio.translocacio) {
    const tip = _buscar(P.translocacioTipus, seleccio.translocacio.tipus);
    if (tip) afegir(tip.nom, tip.cost, tip.dificultat, tip.latencia);
    const dist = _buscar(P.translocacioDistancia, seleccio.translocacio.distancia);
    if (dist) afegir(`Distància: ${dist.nom}`, dist.cost, dist.dificultat, dist.latencia);
  }

  // ── Mentals (manual p. 1029-1064) ──
  if (seleccio.mentals) {
    const tip = _buscar(P.mentals, seleccio.mentals.tipus);
    if (tip) afegir(tip.nom, tip.cost, tip.dificultat);
  }

  // ── Teletracció/telecinesi (manual p. 1065-1108) ──
  if (seleccio.telecinesi) {
    const cat = _buscar(P.telecinesi, seleccio.telecinesi.categoria);
    if (cat) afegir(`Telecinesi: ${cat.nom} (dany ${cat.danyBasic})`, cat.cost, cat.dificultat);
  }

  // ── Replicació/Conjuració (manual p. 1109-1133) ──
  if (seleccio.replicacio) {
    const massa = _buscar(P.replicacioMassa, seleccio.replicacio.massa);
    if (massa) afegir(`Massa: ${massa.nom}`, massa.cost, massa.dificultat, massa.latencia);
    const complexitat = _buscar(P.replicacioComplexitat, seleccio.replicacio.complexitat);
    if (complexitat) afegir(`Complexitat: ${complexitat.nom}`, complexitat.cost, complexitat.dificultat, complexitat.latencia);
  }

  // ── Creació de constructes/Invocació (manual p. 1134-1158) ──
  if (seleccio.invocacio) {
    const costCriatura = Math.max(0, seleccio.invocacio.costCriatura ?? 0);
    afegir(`Invocació (criatura ${costCriatura} PC)`, 15 + 0.25 * costCriatura, 4, 15);
  }

  const total = linies.reduce((acc, l) => ({
    cost:       acc.cost + l.cost,
    dificultat: acc.dificultat + l.dificultat,
    latencia:   acc.latencia + l.latencia
  }), { cost: 0, dificultat: 0, latencia: 0 });

  // La dificultat mai pot baixar d'1, llevat d'artefactes permanents
  // (manual p. 704). Si la calculada és 0 o menys, pujar-la fins a 1 retorna
  // 5 PC per punt, igual que qualsevol altre increment de dificultat
  // (decisió de disseny, 4/10/2026).
  if (total.dificultat < 1) {
    const ajust = -5 * (1 - total.dificultat);
    linies.push({ etiqueta: `Dificultat ${total.dificultat} → 1`, cost: ajust, dificultat: 1 - total.dificultat, latencia: 0 });
    total.cost += ajust;
    total.dificultat = 1;
  }

  return {
    // Arrodoniment cap amunt (invocacions i transformacions donen fraccions).
    cost: Math.ceil(total.cost - 1e-9),
    dificultat: total.dificultat,
    latencia: total.latencia,
    desglossament: linies
  };
}
