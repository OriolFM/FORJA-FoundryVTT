/**
 * Plantilles predefinides per a la creació ràpida d'antagonistes.
 *
 * Cada plantilla defineix:
 *   - label:      Nom visible al selector
 *   - type:       Tipus Foundry (npc | creature | animal)
 *   - tier:       Nivell de PNJ (extra | antagonist | nemesis)
 *   - attributes: { FOR, DES, AGI, PER, INT, APL }
 *   - skills:     { skillId: level }  — s'intenta cercar als compendiums
 *   - traitIds:   [traitId]           — s'intenta cercar als compendiums
 *   - weaponIds:  [weaponId]          — s'intenta cercar als compendiums
 */
export const ANTAGONIST_TEMPLATES = {

  // ── FIGURANTS (Extras) ─────────────────────────────────────────────────

  civil: {
    label: "FORJA.Antagonist.Template.civil",
    type: "npc",
    tier: "extra",
    attributes: { FOR: 1, DES: 1, AGI: 2, PER: 2, INT: 2, APL: 1 },
    skills: {},
    traitIds: [],
    weaponIds: []
  },

  guarda_basic: {
    label: "FORJA.Antagonist.Template.guarda_basic",
    type: "npc",
    tier: "extra",
    attributes: { FOR: 2, DES: 2, AGI: 2, PER: 1, INT: 1, APL: 1 },
    skills: { "armes-cos-a-cos": 1 },
    traitIds: [],
    weaponIds: []
  },

  tecnic: {
    label: "FORJA.Antagonist.Template.tecnic",
    type: "npc",
    tier: "extra",
    attributes: { FOR: 1, DES: 2, AGI: 1, PER: 2, INT: 3, APL: 1 },
    skills: {},
    traitIds: [],
    weaponIds: []
  },

  // ── ANTAGONISTES (Secundaris) ──────────────────────────────────────────

  soldat: {
    label: "FORJA.Antagonist.Template.soldat",
    type: "npc",
    tier: "antagonist",
    attributes: { FOR: 3, DES: 3, AGI: 2, PER: 2, INT: 2, APL: 2 },
    skills: { "armes-cos-a-cos": 2, "armes-distancia": 2 },
    traitIds: [],
    weaponIds: []
  },

  assassi: {
    label: "FORJA.Antagonist.Template.assassi",
    type: "npc",
    tier: "antagonist",
    attributes: { FOR: 2, DES: 4, AGI: 3, PER: 3, INT: 2, APL: 2 },
    skills: { "armes-cos-a-cos": 3, "esquivar": 2 },
    traitIds: ["reflexos-rapids"],
    weaponIds: []
  },

  mag_menor: {
    label: "FORJA.Antagonist.Template.mag_menor",
    type: "npc",
    tier: "antagonist",
    attributes: { FOR: 1, DES: 2, AGI: 1, PER: 3, INT: 3, APL: 2 },
    skills: {},
    traitIds: [],
    weaponIds: []
  },

  mercenari: {
    label: "FORJA.Antagonist.Template.mercenari",
    type: "npc",
    tier: "antagonist",
    attributes: { FOR: 3, DES: 3, AGI: 3, PER: 2, INT: 2, APL: 2 },
    skills: { "armes-cos-a-cos": 2, "armes-distancia": 3, "esquivar": 1 },
    traitIds: [],
    weaponIds: []
  },

  // ── NÈMESIS ────────────────────────────────────────────────────────────

  caporal_elit: {
    label: "FORJA.Antagonist.Template.caporal_elit",
    type: "npc",
    tier: "nemesis",
    attributes: { FOR: 4, DES: 4, AGI: 3, PER: 3, INT: 3, APL: 3 },
    skills: { "armes-cos-a-cos": 4, "armes-distancia": 3, "esquivar": 2 },
    traitIds: ["reflexos-rapids"],
    weaponIds: []
  },

  gran_mag: {
    label: "FORJA.Antagonist.Template.gran_mag",
    type: "npc",
    tier: "nemesis",
    attributes: { FOR: 2, DES: 3, AGI: 2, PER: 4, INT: 4, APL: 4 },
    skills: {},
    traitIds: [],
    weaponIds: []
  },

  // ── CRIATURES ──────────────────────────────────────────────────────────

  criatura_petita: {
    label: "FORJA.Antagonist.Template.criatura_petita",
    type: "creature",
    tier: "extra",
    attributes: { FOR: 2, DES: 3, AGI: 4, PER: 3, INT: 1, APL: 1 },
    skills: {},
    traitIds: [],
    weaponIds: [],
    size: 2,
    species: "animal"
  },

  criatura_gran: {
    label: "FORJA.Antagonist.Template.criatura_gran",
    type: "creature",
    tier: "antagonist",
    attributes: { FOR: 4, DES: 2, AGI: 2, PER: 2, INT: 1, APL: 1 },
    skills: {},
    traitIds: [],
    weaponIds: [],
    size: 4,
    species: "animal"
  }
};

/**
 * Grups de plantilles per tipus de PNJ, en ordre de visualització.
 */
export const TEMPLATE_GROUPS = [
  {
    labelKey: "FORJA.Antagonist.Tier.extra",
    tier: "extra",
    templates: ["civil", "guarda_basic", "tecnic", "criatura_petita"]
  },
  {
    labelKey: "FORJA.Antagonist.Tier.antagonist",
    tier: "antagonist",
    templates: ["soldat", "assassi", "mercenari", "mag_menor", "criatura_gran"]
  },
  {
    labelKey: "FORJA.Antagonist.Tier.nemesis",
    tier: "nemesis",
    templates: ["caporal_elit", "gran_mag"]
  }
];
