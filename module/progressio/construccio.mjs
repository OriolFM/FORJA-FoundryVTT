/**
 * Motor de paràmetres per construir efectes sobrenaturals a mida (S-23,
 * manual p. 642-1160). El cost total és la suma del cost de cada paràmetre
 * triat; la dificultat i la latència, igual (manual p. 687-695: "El cost
 * total es calcula afegint el cost acumulat de cadascun dels paràmetres
 * rellevants... la dificultat es calcula afegint el cost acumulat de la
 * dificultat per cadascun dels paràmetres rellevants").
 *
 * **Abast d'aquesta implementació ("nucli")**: només les categories base
 * (abast, objectius, durada, ús, tipus efecte/ritual) i les cinc categories
 * d'efecte més freqüents al catàleg real (S-25): Dany, Curació, Protecció,
 * Estats, Habilitats. El manual en descriu ~20 més (Alteració,
 * Transformació, Translocació, Mentals, Teletracció/telecinesi,
 * Replicació/Conjuració, Creació de constructes/Invocació, Percepció i
 * il·lusions...) — cadascuna prou diferent i específica com per merèixer la
 * seva pròpia secció de UI i el seu propi tros de validació; queden
 * documentades com a pendents (`09_CONTEXT_SESSIONS.md`) enlloc
 * d'implementar-se de pressa i malament. Afegir-ne una de nova és estendre
 * `parametres.json` amb la taula corresponent i un bloc més aquí, seguint
 * exactament el mateix patró que les cinc ja fetes.
 *
 * Només construeix **efectes** (no artefactes): és el camí que alimenta
 * directament `manifestarEfecte` (S-21), l'ús més freqüent. El constructor
 * d'artefactes (paràmetres d'activació/càrrega/acumulador, ja modelats a
 * `parametres.json` com `artefacteActivacio`/`artefacteModeEspera` per quan
 * es faci) queda pendent — mateix criteri de "nucli abans que exhaustivitat".
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

  const total = linies.reduce((acc, l) => ({
    cost:       acc.cost + l.cost,
    dificultat: acc.dificultat + l.dificultat,
    latencia:   acc.latencia + l.latencia
  }), { cost: 0, dificultat: 0, latencia: 0 });

  return {
    cost: Math.round(total.cost),
    // La dificultat mai pot baixar d'1, llevat d'artefactes permanents
    // (manual p. 704) — un efecte construït sempre necessita com a mínim
    // una fita per manifestar-se.
    dificultat: Math.max(1, total.dificultat),
    latencia: total.latencia,
    desglossament: linies
  };
}
