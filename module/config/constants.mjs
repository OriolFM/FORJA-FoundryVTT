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

/* ---------- Dades del manual (JSON editable) ----------
   Externalitzades perquè es puguin ampliar/corregir sense tocar codi (i, més
   endavant, des d'una interfície d'edició). Es carreguen totes en paral·lel
   (Promise.all) enlloc de N await seqüencials — amb prou fitxers, la suma de
   round-trips seqüencials pot arribar a retardar l'evaluació del mòdul més
   enllà del que Foundry espera abans de disparar el hook "init" (vist en
   viu: amb 6 fetches seqüencials, `Hooks.once("init")` de forja.mjs a vegades
   no arribava a registrar-se a temps — vegeu 09_CONTEXT_SESSIONS.md). */
async function _carregarJSON(fitxer) {
  return fetch(`systems/forja/module/config/dades/${fitxer}`)
    .then(r => r.json())
    .catch(err => { console.error(`FORJA | No s'ha pogut carregar ${fitxer}`, err); return []; });
}

const [
  llistaTrets, catalegArmes, catalegArmadures, llistaManiobres,
  llistaIncompatibilitats, catalegEstats, catalegArtefactes
] = await Promise.all([
  _carregarJSON("trets.json"),
  _carregarJSON("armes.json"),
  _carregarJSON("armadures.json"),
  _carregarJSON("maniobres-arts-marcials.json"),
  _carregarJSON("incompatibilitats.json"),
  _carregarJSON("estats.json"),
  _carregarJSON("artefactes.json")
]);

// Format de cada entrada de trets: { id, nom, cost, positiu, descripcio, costVariable?, multiplicador?, divisor?, etiquetaX? }
FORJA.LLISTA_TRETS = llistaTrets;

/* ---------- Catàleg d'equipament (S-18) ---------- */
FORJA.CATALEG_ARMES     = catalegArmes;
FORJA.CATALEG_ARMADURES = catalegArmadures;

// Maniobres d'arts marcials (manual): seleccionables en declarar un atac de "Cop"
// amb la maniobra "Arts Marcials" (+1 dificultat, escull un moviment de la taula).
FORJA.LLISTA_MANIOBRES = llistaManiobres;

/* ---------- Incompatibilitats de trets (S-05) ---------- */
// Parelles [idA, idB] mútuament excloents (font: CORRECCIO_skill_forja-creator_regles.md,
// secció "Incompatibilitats de trets"). No inclou les parelles paramètriques on l'incompatible
// depèn d'un valor lliure encara no modelat (p. ex. Sentit Agut/Atrofiat del mateix sentit,
// quan "un sentit" no queda registrat a l'ítem) — es descarten per evitar falsos positius.
FORJA.LLISTA_INCOMPATIBILITATS = llistaIncompatibilitats;

// Trets que pressuposen un do actiu — incompatibles amb l'espècie Mecanoide (regles.md).
FORJA.TRETS_SOBRENATURALS = ["magus", "psiquic", "control-qi", "canalitzador", "oracle"];

/* ---------- Estats (S-16) ---------- */
// Catàleg dels estats del manual (cap. 3, p. 96-99). Format de cada entrada:
// { id, nom, parametritzat, descripcio }. "parametritzat" marca els estats
// amb valor X (Lent/X, Ràpid/X, Recuperació/X, Sagnant/X) — de moment només
// informatius (visuals) al tracker/fitxa; l'automatització mecànica és fora
// d'abast de l'Onada 3 (vegeu 09_CONTEXT_SESSIONS.md, secció "Onada 3 — Estats").
FORJA.CATALEG_ESTATS = catalegEstats;

/* ---------- Catàleg d'artefactes (S-24) ---------- */
// Plantilles d'artefacte del manual (cap. 4, "Plantilles d'artefacte"), com
// a dades estàtiques de referència — vegeu justificació de l'abast a
// item-artefacte.mjs.
FORJA.CATALEG_ARTEFACTES = catalegArtefactes;

/* ---------- Salut ---------- */
// Penalització per nivell efectiu de salut (1–6→0/0/0/1/2/4, 7→null=fora de combat)
FORJA.SALUT_PENALITZACIO = { 1: 0, 2: 0, 3: 0, 4: 1, 5: 2, 6: 4, 7: null };
