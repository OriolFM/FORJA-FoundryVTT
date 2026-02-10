#!/usr/bin/env node
/**
 * Build script for FORJA RPG compendium packs.
 * Generates LevelDB compendium packs from FORJAPP data sources.
 *
 * Usage: npm run build:packs
 * Prerequisites: npm install
 */

import { ClassicLevel } from 'classic-level';
import { createHash } from 'node:crypto';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PACKS_DIR = resolve(ROOT, 'packs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deterministic 16-char hex ID from a namespace + source key */
function generateId(namespace, sourceId) {
  return createHash('md5')
    .update(`forja:${namespace}:${sourceId}`)
    .digest('hex')
    .slice(0, 16);
}

/** Build a complete Foundry Item document */
function createItem(id, name, type, img, systemData) {
  const now = Date.now();
  return {
    _id: id,
    name,
    type,
    img: img || 'icons/svg/item-bag.svg',
    system: systemData,
    effects: [],
    flags: {},
    sort: 0,
    ownership: { default: 0 },
    _stats: {
      systemId: 'forja',
      systemVersion: '0.1.0',
      coreVersion: '13',
      createdTime: now,
      modifiedTime: now,
      lastModifiedBy: 'forja-build-packs'
    }
  };
}

// ---------------------------------------------------------------------------
// SKILLS  (46 items — from FORJAPP src/data/skills.ts)
// ---------------------------------------------------------------------------

function buildSkills() {
  const skills = [
    { id: 'acrobacies', name: 'Acrobàcies', type: 'basic', attr: 'AGI' },
    { id: 'actuar', name: 'Actuar', type: 'basic', attr: 'APL' },
    { id: 'amagar-se', name: 'Amagar-se', type: 'basic', attr: 'AGI' },
    { id: 'armes-distancia', name: 'Armes a distància', type: 'basic', attr: 'DES' },
    { id: 'armes-cos-a-cos', name: 'Armes cos a cos', type: 'basic', attr: 'DES' },
    { id: 'armes-improvisades', name: 'Armes improvisades', type: 'basic', attr: 'DES' },
    { id: 'art', name: 'Art', type: 'basic', attr: 'APL' },
    { id: 'barallar-se', name: 'Barallar-se', type: 'basic', attr: 'FOR' },
    { id: 'cercar', name: 'Cercar', type: 'basic', attr: 'PER' },
    { id: 'ciencia', name: 'Ciència', type: 'basic', attr: 'INT' },
    { id: 'correr', name: 'Córrer', type: 'basic', attr: 'AGI' },
    { id: 'consciencia', name: 'Consciència', type: 'basic', attr: 'PER' },
    { id: 'disfressar-se', name: 'Disfressar-se', type: 'basic', attr: 'APL' },
    { id: 'enginyeria', name: 'Enginyeria', type: 'basic', attr: 'INT' },
    { id: 'enigmes', name: 'Enigmes', type: 'basic', attr: 'INT' },
    { id: 'equilibri', name: 'Equilibri', type: 'basic', attr: 'AGI' },
    { id: 'equitacio', name: 'Equitació', type: 'basic', attr: 'AGI' },
    { id: 'escalada', name: 'Escalada', type: 'basic', attr: 'FOR' },
    { id: 'esquitllar-se', name: 'Esquitllar-se', type: 'basic', attr: 'AGI' },
    { id: 'esquivar', name: 'Esquivar', type: 'basic', attr: 'AGI' },
    { id: 'explosius', name: 'Explosius', type: 'basic', attr: 'INT' },
    { id: 'forca-bruta', name: 'Força bruta', type: 'basic', attr: 'FOR' },
    { id: 'humanitats', name: 'Humanitats', type: 'basic', attr: 'INT' },
    { id: 'informatica', name: 'Informàtica', type: 'basic', attr: 'INT' },
    { id: 'intimidacio', name: 'Intimidació', type: 'basic', attr: 'APL' },
    { id: 'jocs-de-mans', name: 'Jocs de mans', type: 'basic', attr: 'DES' },
    { id: 'lideratge', name: 'Lideratge', type: 'basic', attr: 'APL' },
    { id: 'medicina', name: 'Medicina', type: 'basic', attr: 'INT' },
    { id: 'navegacio', name: 'Navegació', type: 'basic', attr: 'INT' },
    { id: 'nedar', name: 'Nedar', type: 'basic', attr: 'FOR' },
    { id: 'negociacio', name: 'Negociació', type: 'basic', attr: 'APL' },
    { id: 'nyaps', name: 'Nyaps', type: 'basic', attr: 'DES' },
    { id: 'ofici', name: 'Ofici', type: 'basic', attr: 'DES' },
    { id: 'oratoria', name: 'Oratòria', type: 'basic', attr: 'APL' },
    { id: 'persuasio', name: 'Persuasió', type: 'basic', attr: 'APL' },
    { id: 'resistencia', name: 'Resistència', type: 'basic', attr: 'FOR' },
    { id: 'supervivencia', name: 'Supervivència', type: 'basic', attr: 'INT' },
    { id: 'tactica', name: 'Tàctica', type: 'basic', attr: 'INT' },
    { id: 'tracte-animals', name: 'Tracte amb animals', type: 'basic', attr: 'APL' },
    { id: 'vehicle', name: 'Vehicle', type: 'basic', attr: 'DES' },
    { id: 'xerrameca', name: 'Xerrameca', type: 'basic', attr: 'APL' },
    // Restricted skills
    { id: 'arts-marcials', name: 'Arts Marcials', type: 'restricted', attr: 'DES' },
    { id: 'canalitzacio', name: 'Canalització', type: 'restricted', attr: 'APL' },
    { id: 'magia', name: 'Màgia', type: 'restricted', attr: 'INT' },
    { id: 'psi', name: 'Psi', type: 'restricted', attr: 'INT' },
    { id: 'qi', name: 'Qi', type: 'restricted', attr: 'APL' }
  ];

  return skills.map(s => createItem(
    generateId('skill', s.id),
    s.name,
    'skill',
    'icons/svg/book.svg',
    {
      skillId: s.id,
      skillType: s.type,
      relatedAttribute: s.attr,
      level: 0,
      maxLevel: 5,
      notes: ''
    }
  ));
}

// ---------------------------------------------------------------------------
// TRAITS  (~80 items — from FORJAPP src/data/traits.ts)
// ---------------------------------------------------------------------------

function buildTraits() {
  const traits = [
    // --- Attribute traits ---
    { id: 'adepte-for', name: 'Adepte/FOR', type: 'positive', cost: 15, cat: 'atribut', incompat: ['inepte-for'] },
    { id: 'adepte-des', name: 'Adepte/DES', type: 'positive', cost: 15, cat: 'atribut', incompat: ['inepte-des'] },
    { id: 'adepte-agi', name: 'Adepte/AGI', type: 'positive', cost: 15, cat: 'atribut', incompat: ['inepte-agi'] },
    { id: 'adepte-per', name: 'Adepte/PER', type: 'positive', cost: 15, cat: 'atribut', incompat: ['inepte-per'] },
    { id: 'adepte-int', name: 'Adepte/INT', type: 'positive', cost: 15, cat: 'atribut', incompat: ['inepte-int'] },
    { id: 'adepte-apl', name: 'Adepte/APL', type: 'positive', cost: 15, cat: 'atribut', incompat: ['inepte-apl'] },
    { id: 'inepte-for', name: 'Inepte/FOR', type: 'negative', cost: -15, cat: 'atribut', incompat: ['adepte-for'] },
    { id: 'inepte-des', name: 'Inepte/DES', type: 'negative', cost: -15, cat: 'atribut', incompat: ['adepte-des'] },
    { id: 'inepte-agi', name: 'Inepte/AGI', type: 'negative', cost: -15, cat: 'atribut', incompat: ['adepte-agi'] },
    { id: 'inepte-per', name: 'Inepte/PER', type: 'negative', cost: -15, cat: 'atribut', incompat: ['adepte-per'] },
    { id: 'inepte-int', name: 'Inepte/INT', type: 'negative', cost: -15, cat: 'atribut', incompat: ['adepte-int'] },
    { id: 'inepte-apl', name: 'Inepte/APL', type: 'negative', cost: -15, cat: 'atribut', incompat: ['adepte-apl'] },
    { id: 'atribut-titanic', name: 'Atribut titànic', type: 'positive', cost: 30, cat: 'atribut' },
    { id: 'especialista', name: 'Especialista', type: 'positive', cost: 20, cat: 'habilitat' },

    // --- Addiction traits ---
    { id: 'adiccio-lleu', name: 'Addicció/lleu', type: 'negative', cost: -2, cat: 'addiccio' },
    { id: 'adiccio-moderada', name: 'Addicció/moderada', type: 'negative', cost: -5, cat: 'addiccio' },
    { id: 'adiccio-severa', name: 'Addicció/severa', type: 'negative', cost: -10, cat: 'addiccio' },

    // --- Allergy traits ---
    { id: 'alergia-lleu', name: 'Al·lèrgia/lleu', type: 'negative', cost: -2, cat: 'alergia' },
    { id: 'alergia-moderada', name: 'Al·lèrgia/moderada', type: 'negative', cost: -5, cat: 'alergia' },
    { id: 'alergia-severa', name: 'Al·lèrgia/severa', type: 'negative', cost: -10, cat: 'alergia' },

    // --- Physical traits ---
    { id: 'amfibi', name: 'Amfibi', type: 'positive', cost: 10, cat: 'física' },
    { id: 'aquatic', name: 'Aquàtic', type: 'positive', cost: 5, cat: 'física' },
    { id: 'armadura-natural', name: 'Armadura natural', type: 'positive', cost: 0, cat: 'física', param: true, baseCost: 0, factorCost: 1, maxLevel: 10 },
    { id: 'bracos-addicionals', name: 'Braços addicionals', type: 'positive', cost: 0, cat: 'física', param: true, baseCost: 0, factorCost: 5, maxLevel: 5 },
    { id: 'potes-addicionals', name: 'Potes addicionals', type: 'positive', cost: 0, cat: 'física', param: true, baseCost: 0, factorCost: 5, maxLevel: 5 },
    { id: 'tentacles', name: 'Tentacles', type: 'positive', cost: 0, cat: 'física', param: true, baseCost: 0, factorCost: 5, maxLevel: 5 },
    { id: 'cua', name: 'Cua', type: 'positive', cost: 4, cat: 'física' },
    { id: 'coordinacio-millorada', name: 'Coordinació millorada', type: 'positive', cost: 15, cat: 'física', incompat: ['poca-traca'] },
    { id: 'flexible', name: 'Flexible', type: 'positive', cost: 5, cat: 'física', incompat: ['poca-traca'] },
    { id: 'gelatinos', name: 'Gelatinós', type: 'positive', cost: 10, cat: 'física' },
    { id: 'levitar', name: 'Levitar', type: 'positive', cost: 15, cat: 'física' },
    { id: 'volador', name: 'Volador', type: 'positive', cost: 25, cat: 'física' },
    { id: 'poca-traca', name: 'Poca-traça', type: 'negative', cost: -5, cat: 'física', incompat: ['coordinacio-millorada', 'flexible'] },

    // --- Natural weapon traits ---
    { id: 'armament-natural-banyes', name: 'Armament natural/banyes', type: 'positive', cost: 10, cat: 'combat' },
    { id: 'armament-natural-fiblo', name: 'Armament natural/fibló', type: 'positive', cost: 5, cat: 'combat' },
    { id: 'armament-natural-mossegada', name: 'Armament natural/mossegada', type: 'positive', cost: 5, cat: 'combat' },
    { id: 'armament-natural-pinces', name: 'Armament natural/pinces', type: 'positive', cost: 10, cat: 'combat' },
    { id: 'armament-natural-urpes', name: 'Armament natural/urpes', type: 'positive', cost: 5, cat: 'combat' },

    // --- Combat traits ---
    { id: 'arrauxat', name: 'Arrauxat', type: 'positive', cost: 10, cat: 'combat' },
    { id: 'reflexos-rapids', name: 'Reflexos ràpids', type: 'positive', cost: 30, cat: 'combat', incompat: ['lent'] },
    { id: 'lent', name: 'Lent', type: 'negative', cost: -10, cat: 'combat', incompat: ['reflexos-rapids'] },

    // --- Health traits ---
    { id: 'curacio-rapida', name: 'Curació ràpida', type: 'positive', cost: 0, cat: 'salut', param: true, baseCost: 0, factorCost: 15, maxLevel: 5, incompat: ['hemofílic'] },
    { id: 'dur-de-pelar', name: 'Dur de pelar', type: 'positive', cost: 15, cat: 'salut', incompat: ['figaflor', 'hemofílic'] },
    { id: 'incansable', name: 'Incansable', type: 'positive', cost: 10, cat: 'salut', incompat: ['figaflor'] },
    { id: 'regeneracio', name: 'Regeneració', type: 'positive', cost: 10, cat: 'salut', incompat: ['hemofílic'] },
    { id: 'figaflor', name: 'Figaflor', type: 'negative', cost: -10, cat: 'salut', incompat: ['dur-de-pelar', 'incansable'] },
    { id: 'hemofílic', name: 'Hemofílic', type: 'negative', cost: -15, cat: 'salut', incompat: ['curacio-rapida', 'regeneracio', 'dur-de-pelar'] },

    // --- Perception traits ---
    { id: 'sentit-agut-oida', name: 'Sentit agut/oïda', type: 'positive', cost: 10, cat: 'percepció', incompat: ['sentit-atrofiat-sord'] },
    { id: 'sentit-agut-olfacte', name: 'Sentit agut/olfacte i gust', type: 'positive', cost: 10, cat: 'percepció', incompat: ['sentit-atrofiat-olfacte'] },
    { id: 'sentit-agut-tacte', name: 'Sentit agut/tacte', type: 'positive', cost: 10, cat: 'percepció', incompat: ['sentit-atrofiat-tacte'] },
    { id: 'sentit-agut-vista', name: 'Sentit agut/vista', type: 'positive', cost: 10, cat: 'percepció', incompat: ['sentit-atrofiat-cec', 'sentit-atrofiat-borni'] },
    { id: 'sentits-aguts-tots', name: 'Sentits aguts/tots', type: 'positive', cost: 30, cat: 'percepció' },
    { id: 'sentit-del-perill', name: 'Sentit del perill', type: 'positive', cost: 20, cat: 'percepció' },
    { id: 'sonar', name: 'Sonar', type: 'positive', cost: 15, cat: 'percepció', incompat: ['sentit-atrofiat-sord'] },
    { id: 'visio-nocturna', name: 'Visió nocturna', type: 'positive', cost: 10, cat: 'percepció', incompat: ['sentit-atrofiat-cec'] },
    { id: 'visio-periferica', name: 'Visió perifèrica', type: 'positive', cost: 15, cat: 'percepció', incompat: ['sentit-atrofiat-borni', 'sentit-atrofiat-cec'] },
    { id: 'sentit-atrofiat-borni', name: 'Sentit atrofiat/borni', type: 'negative', cost: -5, cat: 'percepció' },
    { id: 'sentit-atrofiat-cec', name: 'Sentit atrofiat/cec', type: 'negative', cost: -25, cat: 'percepció' },
    { id: 'sentit-atrofiat-olfacte', name: 'Sentit atrofiat/olfacte i gust', type: 'negative', cost: -5, cat: 'percepció' },
    { id: 'sentit-atrofiat-sord', name: 'Sentit atrofiat/sord', type: 'negative', cost: -10, cat: 'percepció' },
    { id: 'sentit-atrofiat-tacte', name: 'Sentit atrofiat/tacte', type: 'negative', cost: -5, cat: 'percepció' },

    // --- Social & appearance traits ---
    { id: 'aparenca-agradable', name: 'Aparença/agradable', type: 'positive', cost: 2, cat: 'social' },
    { id: 'aparenca-neutra', name: 'Aparença/neutra', type: 'positive', cost: 0, cat: 'social' },
    { id: 'aparenca-desagradable', name: 'Aparença/desagradable', type: 'negative', cost: -2, cat: 'social' },
    { id: 'contactes', name: 'Contactes', type: 'positive', cost: 10, cat: 'social' },
    { id: 'encantador', name: 'Encantador', type: 'positive', cost: 2, cat: 'social', incompat: ['repulsiu'] },
    { id: 'estatus', name: 'Estatus', type: 'positive', cost: 10, cat: 'social' },
    { id: 'feromones', name: 'Feromones', type: 'positive', cost: 15, cat: 'social', incompat: ['sentit-atrofiat-olfacte'] },
    { id: 'linguista-natural', name: 'Lingüista natural', type: 'positive', cost: 15, cat: 'social' },
    { id: 'repulsiu', name: 'Repulsiu', type: 'negative', cost: -2, cat: 'social', incompat: ['encantador'] },
    { id: 'foraster', name: 'Foraster', type: 'negative', cost: -10, cat: 'social' },
    { id: 'impediment-parla', name: 'Impediment de la parla', type: 'negative', cost: -15, cat: 'social' },

    // --- Resource traits ---
    { id: 'recursos-professional', name: 'Recursos/professional', type: 'positive', cost: 0, cat: 'recursos' },
    { id: 'recursos-acomodat', name: 'Recursos/acomodat', type: 'positive', cost: 25, cat: 'recursos' },
    { id: 'recursos-elit', name: 'Recursos/elit', type: 'positive', cost: 50, cat: 'recursos' },
    { id: 'recursos-pobre', name: 'Recursos/pobre de solemnitat', type: 'negative', cost: -10, cat: 'recursos' },

    // --- Disability traits ---
    { id: 'discapacitat', name: 'Discapacitat', type: 'negative', cost: -5, cat: 'física' },
    { id: 'esguerrat-brac', name: 'Esguerrat/braç', type: 'negative', cost: -15, cat: 'física' },
    { id: 'esguerrat-cama', name: 'Esguerrat/cama', type: 'negative', cost: -5, cat: 'física' },
    { id: 'esguerrat-ma', name: 'Esguerrat/mà', type: 'negative', cost: -5, cat: 'física' },

    // --- Companion traits ---
    { id: 'company', name: 'Company', type: 'positive', cost: 0, cat: 'company', param: true, baseCost: 0, factorCost: 0.25, maxLevel: 400, variable: true },
    { id: 'familiar', name: 'Familiar', type: 'positive', cost: 0, cat: 'company', param: true, baseCost: 0, factorCost: 0.333, maxLevel: 300, variable: true },

    // --- Longevity traits ---
    { id: 'longeu', name: 'Longeu', type: 'positive', cost: 6, cat: 'longevitat', incompat: ['efímer', 'etern'] },
    { id: 'etern', name: 'Etern', type: 'positive', cost: 15, cat: 'longevitat', incompat: ['efímer', 'longeu'] },
    { id: 'efímer', name: 'Efímer', type: 'negative', cost: -10, cat: 'longevitat', incompat: ['longeu', 'etern'] },

    // --- Supernatural traits ---
    { id: 'canalitzador', name: 'Canalitzador', type: 'positive', cost: 20, cat: 'sobrenatural', forbidden: ['mechanoid'] },
    { id: 'control-qi', name: 'Control del Qi', type: 'positive', cost: 20, cat: 'sobrenatural', forbidden: ['mechanoid'] },
    { id: 'empata', name: 'Èmpata', type: 'positive', cost: 20, cat: 'sobrenatural', forbidden: ['mechanoid'] },
    { id: 'magus', name: 'Magus', type: 'positive', cost: 20, cat: 'sobrenatural', forbidden: ['mechanoid'] },
    { id: 'no-mort', name: 'No-mort', type: 'positive', cost: 20, cat: 'sobrenatural' },
    { id: 'oracle', name: 'Oracle', type: 'positive', cost: 30, cat: 'sobrenatural', forbidden: ['mechanoid'] },
    { id: 'psiquic', name: 'Psíquic', type: 'positive', cost: 20, cat: 'sobrenatural', forbidden: ['mechanoid'] },
    { id: 'processador-cortical', name: 'Processador cortical', type: 'positive', cost: 40, cat: 'sobrenatural' },

    // --- Luck traits ---
    { id: 'afortunat', name: 'Afortunat', type: 'positive', cost: 25, cat: 'sort' },

    // --- Special traits ---
    { id: 'dron', name: 'Dron', type: 'negative', cost: -30, cat: 'especial' }
  ];

  return traits.map(t => createItem(
    generateId('trait', t.id),
    t.name,
    'trait',
    t.type === 'positive' ? 'icons/svg/aura.svg' : 'icons/svg/downgrade.svg',
    {
      traitId: t.id,
      traitType: t.type,
      category: t.cat || 'general',
      cost: typeof t.cost === 'number' ? t.cost : 0,
      isParametric: t.param || false,
      baseCost: t.baseCost || 0,
      factorCost: t.factorCost || 0,
      maxLevel: t.maxLevel || 0,
      level: 0,
      variantCost: 0,
      isVariable: t.variable || false,
      incompatibleWith: t.incompat || [],
      forbiddenSpecies: t.forbidden || [],
      notes: ''
    }
  ));
}

// ---------------------------------------------------------------------------
// WEAPONS  (7 natural + 10 melee + 12 ranged = 29 items)
// ---------------------------------------------------------------------------

function buildWeapons() {
  const naturalWeapons = [
    { id: 'cop', name: 'Cop', wType: 'natural', aType: 'brawl', lat: 0, reach: '0', damage: 'FOR+1' },
    { id: 'tentacles', name: 'Tentacles', wType: 'natural', aType: 'natural', lat: 0, reach: '0', damage: 'FOR+2' },
    { id: 'urpes', name: 'Urpes', wType: 'natural', aType: 'natural', lat: 1, reach: '0', damage: 'FOR+2' },
    { id: 'ullals', name: 'Ullals', wType: 'natural', aType: 'natural', lat: 1, reach: '0', damage: 'FOR+2' },
    { id: 'banyes', name: 'Banyes', wType: 'natural', aType: 'natural', lat: 1, reach: '1', damage: 'FOR+3' },
    { id: 'pinces', name: 'Pinces', wType: 'natural', aType: 'natural', lat: 1, reach: '0', damage: 'FOR+3' },
    { id: 'fiblons', name: 'Fiblons i espines', wType: 'natural', aType: 'natural', lat: 0, reach: '0', damage: 'FOR+2' }
  ];

  const meleeWeapons = [
    { id: 'armes-improvisades-melee', name: 'Armes improvisades (cos a cos)', wType: 'melee', aType: 'melee', lat: 0, reach: 'Variable', damage: 'FOR+2' },
    { id: 'contundents', name: 'Contundents', wType: 'melee', aType: 'melee', lat: 2, reach: '+1', damage: 'FOR+2' },
    { id: 'armes-de-ma', name: 'Armes de mà', wType: 'melee', aType: 'melee', lat: 0, reach: 'A tocar', damage: 'FOR+1' },
    { id: 'destrals', name: 'Destrals', wType: 'melee', aType: 'melee', lat: 2, reach: '+1', damage: 'FOR+3' },
    { id: 'escuts', name: 'Escuts', wType: 'melee', aType: 'melee', lat: 1, reach: '+0', damage: 'FOR+2' },
    { id: 'espases', name: 'Espases', wType: 'melee', aType: 'melee', lat: 1, reach: '+1', damage: 'FOR+2' },
    { id: 'fulla-curta', name: 'Fulla curta', wType: 'melee', aType: 'melee', lat: 0, reach: 'A tocar', damage: 'FOR+1' },
    { id: 'fulla-llarga', name: 'Fulla llarga', wType: 'melee', aType: 'melee', lat: 2, reach: '+1', damage: 'FOR+3' },
    { id: 'llances', name: 'Llances i armes de pal', wType: 'melee', aType: 'melee', lat: 3, reach: '+2', damage: 'FOR+3' },
    { id: 'pics', name: 'Pics', wType: 'melee', aType: 'melee', lat: 3, reach: '+1', damage: 'FOR+3' }
  ];

  const rangedWeapons = [
    { id: 'distancia-improvisades', name: 'Armes improvisades (distància)', wType: 'ranged', aType: 'ranged', lat: 2, range: 'FOR m', damage: 'FOR+1', ammo: 0 },
    { id: 'arcs-fones', name: 'Arcs i fones', wType: 'ranged', aType: 'ranged', lat: 1, range: 'FOR x5 m', damage: 'DES+3', ammo: 0 },
    { id: 'ballestes', name: 'Ballestes', wType: 'ranged', aType: 'ranged', lat: 2, range: '20 m', damage: 'DES+4', ammo: 1 },
    { id: 'llancivoles', name: 'Llancívoles', wType: 'ranged', aType: 'ranged', lat: 0, range: 'FOR x3 m', damage: 'AGI+1', ammo: 0 },
    { id: 'pistoles', name: 'Pistoles', wType: 'ranged', aType: 'ranged', lat: 0, range: '15 m', damage: 'DES+2', ammo: 10 },
    { id: 'subfusells', name: 'Subfusells', wType: 'ranged', aType: 'ranged', lat: 1, range: '20 m', damage: 'DES+2', ammo: 30 },
    { id: 'armes-assalt', name: "Armes d'assalt", wType: 'ranged', aType: 'ranged', lat: 1, range: '30 m', damage: 'DES+3', ammo: 30 },
    { id: 'rifles', name: 'Rifles', wType: 'ranged', aType: 'ranged', lat: 2, range: '100 m', damage: 'DES+4', ammo: 5 },
    { id: 'escopetes', name: 'Escopetes', wType: 'ranged', aType: 'ranged', lat: 2, range: '10 m (AE)', damage: 'DES+3', ammo: 6 },
    { id: 'armes-dispersio', name: 'Armes de dispersió', wType: 'ranged', aType: 'ranged', lat: 3, range: '15 m (AE)', damage: 'DES+3', ammo: 40 },
    { id: 'armes-suport', name: 'Armes de suport', wType: 'ranged', aType: 'ranged', lat: 4, range: '80 m', damage: 'DES+5', ammo: 100 },
    { id: 'armes-pesants', name: 'Armes pesants', wType: 'ranged', aType: 'ranged', lat: 6, range: 'Variable', damage: 'DES+4', ammo: 0 }
  ];

  const allWeapons = [...naturalWeapons, ...meleeWeapons, ...rangedWeapons];
  const isMelee = w => w.wType === 'natural' || w.wType === 'melee';
  const icon = w => w.wType === 'ranged' ? 'icons/svg/target.svg' : 'icons/svg/sword.svg';

  return allWeapons.map(w => createItem(
    generateId('weapon', w.id),
    w.name,
    'weapon',
    icon(w),
    {
      weaponType: w.wType,
      attackType: w.aType,
      latencyMod: w.lat,
      reach: isMelee(w) ? (w.reach || '') : '',
      range: !isMelee(w) ? (w.range || '') : '',
      damage: w.damage,
      ammo: {
        value: w.ammo ?? 0,
        max: w.ammo ?? 0
      },
      special: '',
      quantity: 1,
      equipped: false
    }
  ));
}

// ---------------------------------------------------------------------------
// ARMOR  (6 items — from FORJAPP src/data/equipment.ts)
// ---------------------------------------------------------------------------

function buildArmor() {
  const armors = [
    { id: 'armadura-natural', name: 'Armadura natural', protection: 0, lat: 0, sizeMod: '±0' },
    { id: 'lleugera-flexible', name: 'Armadura lleugera, flexible', protection: 1, lat: 0, sizeMod: '±0' },
    { id: 'lleugera-rigida', name: 'Armadura lleugera, rígida', protection: 2, lat: 1, sizeMod: '±1' },
    { id: 'mitjana-flexible', name: 'Armadura mitjana, flexible', protection: 3, lat: 1, sizeMod: '±1' },
    { id: 'mitjana-rigida', name: 'Armadura mitjana, rígida', protection: 4, lat: 2, sizeMod: '±2' },
    { id: 'pesant', name: 'Armadura pesant', protection: 5, lat: 3, sizeMod: '±2' }
  ];

  return armors.map(a => createItem(
    generateId('armor', a.id),
    a.name,
    'armor',
    'icons/svg/shield.svg',
    {
      protection: a.protection,
      latencyMod: a.lat,
      sizeMod: a.sizeMod,
      equipped: false
    }
  ));
}

// ---------------------------------------------------------------------------
// ARTIFACTS  (14 items — from FORJAPP src/data/artifacts.ts)
// ---------------------------------------------------------------------------

function buildArtifacts() {
  const artifacts = [
    {
      id: 'autometge', name: 'Autometge', cost: 15, cat: 'tool',
      activation: 'normal', difficulty: 2, latencyMod: 0,
      target: 'individual', duration: 'scene',
      skillBonus: [{ skillId: 'medicina', bonus: 5 }]
    },
    {
      id: 'botes-antigravetat', name: 'Botes antigravetat', cost: 13, cat: 'device',
      activation: 'trivial', difficulty: 1, latencyMod: 2,
      target: 'self', duration: 'scene',
      traitsGranted: ['levitar']
    },
    {
      id: 'cibermodem', name: 'Cibermòdem', cost: 9, cat: 'device',
      activation: 'normal', difficulty: 1, latencyMod: 1,
      target: 'self', duration: 'scene',
      skillBonus: [{ skillId: 'informatica', bonus: 3 }]
    },
    {
      id: 'cibermodem-neural', name: "Cibermòdem d'interfície neural directa", cost: 15, cat: 'implant',
      activation: 'normal', difficulty: 1, latencyMod: 1,
      target: 'self', duration: 'scene',
      skillBonus: [{ skillId: 'informatica', bonus: 5 }]
    },
    {
      id: 'holocapa', name: 'Holocapa', cost: 21, cat: 'armor',
      activation: 'normal', difficulty: 1, latencyMod: 2,
      target: 'self', duration: 'scene',
      protection: 3,
      skillBonus: [{ skillId: 'amagar-se', bonus: 2 }, { skillId: 'esquitllar-se', bonus: 2 }]
    },
    {
      id: 'generador-bretxa', name: 'Generador compacte de bretxa', cost: 53, cat: 'device',
      activation: 'complex', difficulty: 3, latencyMod: 10,
      range: 'multiversal', target: 'area', duration: 'scene',
      charges: 1, rechargeRate: 36
    },
    {
      id: 'basto-neural', name: 'Bastó neural', cost: 10, cat: 'weapon',
      activation: 'permanent', latencyMod: 2, range: 'touch',
      damageValue: 2, damageType: 'fatigue', baseWeapon: 'basto',
      statesApplied: [{ stateId: 'atordit', value: 0 }, { stateId: 'lent', value: 2 }]
    },
    {
      id: 'espasa-energia', name: "Espasa d'energia", cost: 21, cat: 'weapon',
      activation: 'trivial', latencyMod: 1, range: 'touch',
      damageValue: 8, damageType: 'wounds', baseWeapon: 'espasa',
      charges: 5, rechargeRate: 10
    },
    {
      id: 'espasa-pretoriana', name: 'Espasa pretoriana de Terra', cost: 40, cat: 'weapon',
      activation: 'permanent', latencyMod: 3, range: 'touch',
      damageValue: 3, damageType: 'wounds', protection: 4, baseWeapon: 'espasa-llarga',
      skillBonus: [{ skillId: 'armes-cos-a-cos', bonus: 3 }],
      statesApplied: [{ stateId: 'sagnant', value: 2 }]
    },
    {
      id: 'espasa-serra', name: 'Espasa serra', cost: 11, cat: 'weapon',
      activation: 'permanent', latencyMod: 2, range: 'touch',
      damageValue: 4, damageType: 'wounds', baseWeapon: 'espasa',
      statesApplied: [{ stateId: 'sagnant', value: 3 }]
    },
    {
      id: 'guant-forca', name: 'Guant de força', cost: 11, cat: 'weapon',
      activation: 'permanent', latencyMod: 0, range: 'touch',
      damageValue: 5, damageType: 'electricity',
      statesApplied: [{ stateId: 'atordit', value: 2 }]
    },
    {
      id: 'martell-descarrega', name: 'Martell de descàrrega', cost: 14, cat: 'weapon',
      activation: 'permanent', latencyMod: 2, range: 'touch',
      damageValue: 5, damageType: 'electricity',
      statesApplied: [{ stateId: 'atordit', value: 2 }, { stateId: 'llancat', value: 2 }]
    },
    {
      id: 'ciberbrac', name: 'Ciberbraç', cost: 23, cat: 'implant',
      activation: 'permanent', latencyMod: 1,
      target: 'self', duration: 'permanent',
      protection: 2,
      skillBonus: [{ skillId: 'armes-cos-a-cos', bonus: 3 }]
    },
    {
      id: 'sonda-neural', name: 'Sonda neural', cost: 18, cat: 'device',
      activation: 'normal', difficulty: 2, latencyMod: 1,
      range: 'short', target: 'individual', duration: 'scene'
    },
    {
      id: 'servoarmadura-assalt', name: "Servoarmadura d'assalt", cost: 62, cat: 'armor',
      activation: 'permanent', latencyMod: 2,
      target: 'self', duration: 'permanent',
      protection: 10,
      skillBonus: [{ skillId: 'forca-bruta', bonus: 2 }, { skillId: 'resistencia', bonus: 2 }]
    }
  ];

  return artifacts.map(a => createItem(
    generateId('artifact', a.id),
    a.name,
    'artifact',
    'icons/svg/item-bag.svg',
    {
      cost: a.cost || 0,
      activation: a.activation || 'normal',
      difficulty: a.difficulty || 0,
      latencyMod: a.latencyMod || 0,
      range: a.range || '',
      target: a.target || '',
      duration: a.duration || '',
      charges: { value: a.charges || 0, max: a.charges || 0 },
      rechargeRate: a.rechargeRate || 0,
      damageValue: a.damageValue || 0,
      damageType: a.damageType || '',
      protection: a.protection || 0,
      skillBonus: a.skillBonus || [],
      statesApplied: a.statesApplied || [],
      traitsGranted: a.traitsGranted || [],
      baseWeapon: a.baseWeapon || '',
      notes: ''
    }
  ));
}

// ---------------------------------------------------------------------------
// SUPERNATURAL EFFECTS  (25 items — from FORJAPP src/data/supernaturalEffects.ts)
// ---------------------------------------------------------------------------

function buildSupernaturalEffects() {
  const effects = [
    // Magic effects
    {
      id: 'bola-foc', name: 'Bola de foc', cost: 17, gift: 'magus',
      activation: 'normal', difficulty: 2, latencyMod: 3, equilibrium: 3,
      range: 'medium', target: 'area', duration: 'instant',
      damageValue: 5, damageType: 'fire'
    },
    {
      id: 'con-ardent', name: 'Con ardent', cost: 12, gift: 'magus',
      activation: 'normal', difficulty: 1, latencyMod: 2, equilibrium: 2,
      range: 'short', target: 'area', duration: 'instant',
      damageValue: 4, damageType: 'fire'
    },
    {
      id: 'dalla-parca', name: 'La dalla de la parca', cost: 10, gift: 'magus',
      activation: 'normal', difficulty: 1, latencyMod: 0, equilibrium: 2,
      range: 'touch', target: 'self', duration: 'scene',
      damageValue: 3, damageType: 'fatigue_and_wounds'
    },
    {
      id: 'descarrega', name: 'Descàrrega', cost: 12, gift: 'magus',
      activation: 'normal', difficulty: 1, latencyMod: 2, equilibrium: 2,
      range: 'medium', target: 'individual', duration: 'instant',
      damageValue: 4, damageType: 'electricity'
    },
    {
      id: 'mot-destructiu', name: 'Mot destructiu', cost: 25, gift: 'magus',
      activation: 'ritual', difficulty: 3, latencyMod: 15, equilibrium: 5,
      range: 'medium', target: 'individual', duration: 'instant',
      damageValue: 10, damageType: 'wounds'
    },
    {
      id: 'mot-guaridor', name: 'Mot guaridor', cost: 20, gift: 'magus',
      activation: 'ritual', difficulty: 3, latencyMod: 10, equilibrium: 4,
      range: 'medium', target: 'individual', duration: 'instant',
      healingValue: 10
    },
    {
      id: 'passes-feli', name: 'Passes de felí', cost: 26, gift: 'magus',
      activation: 'normal', difficulty: 1, latencyMod: 4, equilibrium: 3,
      target: 'self', duration: 'scene',
      skillBonus: [{ skillId: 'esquitllar-se', bonus: 5 }]
    },
    {
      id: 'rigor-mortis', name: 'Rigor mortis', cost: 17, gift: 'magus',
      activation: 'normal', difficulty: 3, latencyMod: 5, equilibrium: 3,
      range: 'medium', target: 'individual', duration: 'scene',
      statesApplied: [{ stateId: 'immobilitzat', value: 3 }, { stateId: 'lent', value: 3 }]
    },
    {
      id: 'rostre-parca', name: 'El rostre de la parca', cost: 21, gift: 'magus',
      activation: 'normal', difficulty: 3, latencyMod: 0, equilibrium: 4,
      target: 'area', duration: 'scene',
      statesApplied: [{ stateId: 'acovardit', value: 2 }, { stateId: 'immobilitzat', value: 2 }]
    },
    {
      id: 'senyor-mosques', name: 'Senyor de les mosques', cost: 15, gift: 'magus',
      activation: 'normal', difficulty: 1, latencyMod: 0, equilibrium: 2,
      target: 'area', duration: 'instant',
      statesApplied: [{ stateId: 'atordit', value: 2 }]
    },

    // Psychic effects
    {
      id: 'abatre', name: 'Abatre', cost: 10, gift: 'psiquic',
      activation: 'normal', difficulty: 1, latencyMod: 0, equilibrium: 2,
      range: 'medium', target: 'individual', duration: 'instant',
      statesApplied: [{ stateId: 'abatut', value: 2 }]
    },
    {
      id: 'accelerar', name: 'Accelerar', cost: 12, gift: 'psiquic',
      activation: 'normal', difficulty: 3, latencyMod: 0, equilibrium: 3,
      target: 'self', duration: 'scene',
      statesApplied: [{ stateId: 'rapid', value: 2 }, { stateId: 'recuperacio', value: 1 }]
    },
    {
      id: 'cicatritzar', name: 'Cicatritzar', cost: 8, gift: 'psiquic',
      activation: 'normal', difficulty: 1, latencyMod: 2, equilibrium: 2,
      range: 'touch', target: 'individual', duration: 'instant',
      healingValue: 4
    },
    {
      id: 'enllac-mental', name: 'Enllaç mental', cost: 10, gift: 'psiquic',
      activation: 'normal', difficulty: 2, latencyMod: 5, equilibrium: 2,
      range: 'touch', target: 'individual', duration: 'scene',
      mentalEffect: 'read'
    },
    {
      id: 'imperatiu', name: 'Imperatiu', cost: 15, gift: 'psiquic',
      activation: 'normal', difficulty: 3, latencyMod: 5, equilibrium: 3,
      range: 'medium', target: 'individual', duration: 'scene',
      mentalEffect: 'suggestion'
    },
    {
      id: 'llancament', name: 'Llançament', cost: 13, gift: 'psiquic',
      activation: 'normal', difficulty: 1, latencyMod: 0, equilibrium: 2,
      range: 'medium', target: 'individual', duration: 'instant',
      statesApplied: [{ stateId: 'llancat', value: 5 }]
    },
    {
      id: 'matar-maquina', name: 'Matar màquina', cost: 14, gift: 'psiquic',
      activation: 'normal', difficulty: 2, latencyMod: 5, equilibrium: 3,
      range: 'touch', target: 'individual', duration: 'instant',
      skillBonus: [{ skillId: 'nyaps', bonus: 5 }]
    },
    {
      id: 'ment-materia', name: 'Ment sobre matèria', cost: 20, gift: 'psiquic',
      activation: 'normal', difficulty: 2, latencyMod: 0, equilibrium: 4,
      range: 'medium', target: 'individual', duration: 'scene'
    },
    {
      id: 'negar-dany', name: 'Negar el dany', cost: 15, gift: 'psiquic',
      activation: 'normal', difficulty: 1, latencyMod: 0, equilibrium: 3,
      isReaction: true, target: 'self', duration: 'instant',
      protection: 10
    },
    {
      id: 'pas-costat', name: 'Pas al costat', cost: 22, gift: 'psiquic',
      activation: 'normal', difficulty: 1, latencyMod: 0, equilibrium: 4,
      isReaction: true, range: 'short', target: 'self', duration: 'instant'
    },
    {
      id: 'projectil-psiquic', name: 'Projectil', cost: 20, gift: 'psiquic',
      activation: 'normal', difficulty: 1, latencyMod: 0, equilibrium: 4,
      range: 'medium', target: 'individual', duration: 'instant'
    },
    {
      id: 'sonda-mental', name: 'Sonda mental', cost: 10, gift: 'psiquic',
      activation: 'normal', difficulty: 2, latencyMod: 5, equilibrium: 2,
      range: 'medium', target: 'individual', duration: 'scene',
      mentalEffect: 'read'
    },
    {
      id: 'subjugar', name: 'Subjugar', cost: 15, gift: 'psiquic',
      activation: 'normal', difficulty: 3, latencyMod: 5, equilibrium: 3,
      range: 'medium', target: 'individual', duration: 'scene',
      mentalEffect: 'emotional'
    },

    // Qi effects
    {
      id: 'aleteig-grua', name: "L'aleteig de la grua", cost: 13, gift: 'qi',
      activation: 'normal', difficulty: 1, latencyMod: 0, equilibrium: 2,
      range: 'touch', target: 'area', duration: 'instant',
      statesApplied: [{ stateId: 'atordit', value: 0 }, { stateId: 'empes', value: 2 }]
    },
    {
      id: 'anticipacio-colibri', name: "L'anticipació del colibrí", cost: 12, gift: 'qi',
      activation: 'normal', difficulty: 1, latencyMod: 1, equilibrium: 2,
      target: 'self', duration: 'scene',
      skillBonus: [{ skillId: 'esquivar', bonus: 3 }],
      statesApplied: [{ stateId: 'vigilant', value: 0 }]
    },
    {
      id: 'armadura-queloni', name: "L'armadura del queloni", cost: 16, gift: 'qi',
      activation: 'normal', difficulty: 0, latencyMod: 0, equilibrium: 3,
      isReaction: true, target: 'self', duration: 'instant',
      protection: 8
    },
    {
      id: 'circulacio-qi', name: 'Circulació del Qi', cost: 16, gift: 'qi',
      activation: 'normal', difficulty: 2, latencyMod: 0, equilibrium: 3,
      range: 'touch', target: 'individual', duration: 'scene',
      statesApplied: [{ stateId: 'recuperacio', value: 4 }]
    },
    {
      id: 'cogitacio-asceta', name: "La cogitació de l'asceta", cost: 15, gift: 'qi',
      activation: 'ritual', difficulty: 1, latencyMod: 12, equilibrium: 3,
      target: 'self', duration: 'instant',
      skillBonus: [{ skillId: 'enigmes', bonus: 5 }]
    }
  ];

  return effects.map(e => createItem(
    generateId('effect', e.id),
    e.name,
    'supernaturalEffect',
    'icons/svg/lightning.svg',
    {
      cost: e.cost || 0,
      requiredGift: e.gift,
      activation: e.activation || 'normal',
      difficulty: e.difficulty || 0,
      equilibriumCost: e.equilibrium || 0,
      latencyMod: e.latencyMod || 0,
      range: e.range || '',
      target: e.target || '',
      duration: e.duration || '',
      damageValue: e.damageValue || 0,
      damageType: e.damageType || '',
      healingValue: e.healingValue || 0,
      protection: e.protection || 0,
      skillBonus: e.skillBonus || [],
      statesApplied: e.statesApplied || [],
      traitsGranted: [],
      mentalEffect: e.mentalEffect || '',
      notes: ''
    }
  ));
}

// ---------------------------------------------------------------------------
// PACK WRITER  (LevelDB via classic-level)
// ---------------------------------------------------------------------------

async function writePack(packName, items) {
  const packPath = resolve(PACKS_DIR, packName);

  // Clean existing pack data
  if (existsSync(packPath)) {
    rmSync(packPath, { recursive: true });
  }
  mkdirSync(packPath, { recursive: true });

  const db = new ClassicLevel(packPath, {
    keyEncoding: 'utf8',
    valueEncoding: 'utf8'
  });

  for (const item of items) {
    await db.put(`!items!${item._id}`, JSON.stringify(item));
  }

  // Write folders index (empty, no sub-folders used)
  await db.put('!folders!', '[]');

  await db.close();
  console.log(`  ${packName}: ${items.length} items`);
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main() {
  console.log('Building FORJA compendium packs...\n');

  await writePack('skills', buildSkills());
  await writePack('traits', buildTraits());
  await writePack('weapons', buildWeapons());
  await writePack('armor', buildArmor());
  await writePack('artifacts', buildArtifacts());
  await writePack('supernatural-effects', buildSupernaturalEffects());

  const totals = {
    skills: buildSkills().length,
    traits: buildTraits().length,
    weapons: buildWeapons().length,
    armor: buildArmor().length,
    artifacts: buildArtifacts().length,
    effects: buildSupernaturalEffects().length
  };
  const total = Object.values(totals).reduce((a, b) => a + b, 0);

  console.log(`\nDone! ${total} items generated across 6 packs.`);
}

main().catch(err => {
  console.error('Build failed:', err.message);
  if (err.code === 'ERR_MODULE_NOT_FOUND' || err.message.includes('classic-level')) {
    console.error('\nPlease install dependencies first: npm install');
  }
  process.exit(1);
});
