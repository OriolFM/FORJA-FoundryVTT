/**
 * Constants del sistema FORJA.
 * Font de veritat: manual FORJA_02_PERSONATGE.md (G-2 del document de disseny).
 */
export const FORJA = {};

/* ---------- Atributs ---------- */
FORJA.ATRIBUTS = ["FOR", "DES", "AGI", "PER", "INT", "APL"];

FORJA.COST_ATRIBUT = { 0: -5, 1: 0, 2: 10, 3: 20, 4: 30, 5: 50 };

/* ---------- Espècie ---------- */
FORJA.COST_ESPECIE = {
  humanoide:   0,
  animal:    -15,   // G-2: font canònica és el skill (−15), no la taula ràpida (+5)
  artropode:   5,
  cefalopode: 25,
  constructe: 10,
  incorpori:  15,
  mecanoide:  20,
  vegetal:    10
};

/* ---------- Mida ---------- */
FORJA.COST_MIDA = { 1: -20, 2: -10, 3: 0, 4: 10, 5: 20 };
FORJA.MIDA_DEFENSA = { 1: 2, 2: 1, 3: 0, 4: -1, 5: -2 };

/* ---------- Constitució ---------- */
FORJA.COST_CONSTITUCIO = { 1: -20, 2: -10, 3: 0, 4: 10, 5: 20 };

/* ---------- Habilitats ---------- */
// Cost acumulat per nivell (índex = nivell 0–10)
FORJA.COST_HABILITAT = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55];

FORJA.LLISTA_HABILITATS = [
  // Bàsiques
  { id: "acrobacies",      nom: "FORJA.Hab.acrobacies",      attr: "AGI", tipus: "basica" },
  { id: "actuar",          nom: "FORJA.Hab.actuar",          attr: "APL", tipus: "basica" },
  { id: "amagar-se",       nom: "FORJA.Hab.amagar-se",       attr: "AGI", tipus: "basica" },
  { id: "armes-distancia", nom: "FORJA.Hab.armes-distancia", attr: "DES", tipus: "basica" },
  { id: "armes-cos-a-cos", nom: "FORJA.Hab.armes-cos-a-cos", attr: "DES", tipus: "basica" },
  { id: "armes-improvisades", nom: "FORJA.Hab.armes-improvisades", attr: "DES", tipus: "basica" },
  { id: "art",             nom: "FORJA.Hab.art",             attr: "APL", tipus: "basica" },
  { id: "barallar-se",     nom: "FORJA.Hab.barallar-se",     attr: "FOR", tipus: "basica" },
  { id: "cercar",          nom: "FORJA.Hab.cercar",          attr: "PER", tipus: "basica" },
  { id: "ciencia",         nom: "FORJA.Hab.ciencia",         attr: "INT", tipus: "basica" },
  { id: "consciencia",     nom: "FORJA.Hab.consciencia",     attr: "PER", tipus: "basica" },
  { id: "correr",          nom: "FORJA.Hab.correr",          attr: "AGI", tipus: "basica" },
  { id: "disfressar-se",   nom: "FORJA.Hab.disfressar-se",   attr: "APL", tipus: "basica" },
  { id: "enginyeria",      nom: "FORJA.Hab.enginyeria",      attr: "INT", tipus: "basica" },
  { id: "enigmes",         nom: "FORJA.Hab.enigmes",         attr: "INT", tipus: "basica" },
  { id: "equilibri",       nom: "FORJA.Hab.equilibri",       attr: "AGI", tipus: "basica" },
  { id: "equitacio",       nom: "FORJA.Hab.equitacio",       attr: "AGI", tipus: "basica" },
  { id: "escalada",        nom: "FORJA.Hab.escalada",        attr: "FOR", tipus: "basica" },
  { id: "esquitllar-se",   nom: "FORJA.Hab.esquitllar-se",   attr: "AGI", tipus: "basica" },
  { id: "esquivar",        nom: "FORJA.Hab.esquivar",        attr: "AGI", tipus: "basica" },
  { id: "explosius",       nom: "FORJA.Hab.explosius",       attr: "INT", tipus: "basica" },
  { id: "forca-bruta",     nom: "FORJA.Hab.forca-bruta",     attr: "FOR", tipus: "basica" },
  { id: "humanitats",      nom: "FORJA.Hab.humanitats",      attr: "INT", tipus: "basica" },
  { id: "informatica",     nom: "FORJA.Hab.informatica",     attr: "INT", tipus: "basica" },
  { id: "intimidacio",     nom: "FORJA.Hab.intimidacio",     attr: "APL", tipus: "basica" },
  { id: "jocs-de-mans",    nom: "FORJA.Hab.jocs-de-mans",    attr: "DES", tipus: "basica" },
  { id: "lideratge",       nom: "FORJA.Hab.lideratge",       attr: "APL", tipus: "basica" },
  { id: "medicina",        nom: "FORJA.Hab.medicina",        attr: "INT", tipus: "basica" },
  { id: "navegacio",       nom: "FORJA.Hab.navegacio",       attr: "INT", tipus: "basica" },
  { id: "nedar",           nom: "FORJA.Hab.nedar",           attr: "FOR", tipus: "basica" },
  { id: "negociacio",      nom: "FORJA.Hab.negociacio",      attr: "APL", tipus: "basica" },
  { id: "nyaps",           nom: "FORJA.Hab.nyaps",           attr: "DES", tipus: "basica" },
  { id: "ofici",           nom: "FORJA.Hab.ofici",           attr: "DES", tipus: "basica" },
  { id: "oratoria",        nom: "FORJA.Hab.oratoria",        attr: "APL", tipus: "basica" },
  { id: "persuasio",       nom: "FORJA.Hab.persuasio",       attr: "APL", tipus: "basica" },
  { id: "resistencia",     nom: "FORJA.Hab.resistencia",     attr: "FOR", tipus: "basica" },
  { id: "supervivencia",   nom: "FORJA.Hab.supervivencia",   attr: "INT", tipus: "basica" },
  { id: "tactica",         nom: "FORJA.Hab.tactica",         attr: "INT", tipus: "basica" },
  { id: "tracte-animals",  nom: "FORJA.Hab.tracte-animals",  attr: "APL", tipus: "basica" },
  { id: "vehicle",         nom: "FORJA.Hab.vehicle",         attr: "DES", tipus: "basica" },
  { id: "xerrameca",       nom: "FORJA.Hab.xerrameca",       attr: "APL", tipus: "basica" },
  // Restringides
  { id: "arts-marcials",   nom: "FORJA.Hab.arts-marcials",   attr: "DES", tipus: "restringida" },
  { id: "canalitzacio",    nom: "FORJA.Hab.canalitzacio",    attr: "APL", tipus: "restringida" },
  { id: "magia",           nom: "FORJA.Hab.magia",           attr: "INT", tipus: "restringida" },
  { id: "psi",             nom: "FORJA.Hab.psi",             attr: "INT", tipus: "restringida" },
  { id: "qi",              nom: "FORJA.Hab.qi",              attr: "APL", tipus: "restringida" }
];

/* ---------- Trets ---------- */
// Dades carregades des d'un fitxer JSON editable, perquè es pugui ampliar/corregir
// sense tocar codi (i, més endavant, des d'una interfície d'edició).
// Format de cada entrada: { id, nom, cost, positiu, descripcio, costVariable?, multiplicador?, divisor?, etiquetaX? }
FORJA.LLISTA_TRETS = await fetch("systems/forja/module/config/dades/trets.json")
  .then(r => r.json())
  .catch(err => { console.error("FORJA | No s'ha pogut carregar trets.json", err); return []; });

/* ---------- Catàleg d'equipament (S-18) ---------- */
// Igual que els trets: dades en JSON editable, sense res hard-codejat.
// Serveixen com a base per generar Items (i, més endavant, des d'una interfície externa).
FORJA.CATALEG_ARMES = await fetch("systems/forja/module/config/dades/armes.json")
  .then(r => r.json())
  .catch(err => { console.error("FORJA | No s'ha pogut carregar armes.json", err); return []; });

FORJA.CATALEG_ARMADURES = await fetch("systems/forja/module/config/dades/armadures.json")
  .then(r => r.json())
  .catch(err => { console.error("FORJA | No s'ha pogut carregar armadures.json", err); return []; });

// Maniobres d'arts marcials (manual): seleccionables en declarar un atac de "Cop"
// amb la maniobra "Arts Marcials" (+1 dificultat, escull un moviment de la taula).
FORJA.LLISTA_MANIOBRES = await fetch("systems/forja/module/config/dades/maniobres-arts-marcials.json")
  .then(r => r.json())
  .catch(err => { console.error("FORJA | No s'ha pogut carregar maniobres-arts-marcials.json", err); return []; });

/* ---------- Salut ---------- */
// Penalització per nivell efectiu de salut (1–6→0/0/0/1/2/4, 7→null=fora de combat)
FORJA.SALUT_PENALITZACIO = { 1: 0, 2: 0, 3: 0, 4: 1, 5: 2, 6: 4, 7: null };
