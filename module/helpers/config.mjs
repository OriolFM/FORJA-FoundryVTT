/**
 * FORJA RPG system configuration constants.
 * Ported from FORJAPP src/utils/calculations.ts and src/data/skills.ts
 */
export const FORJA = {};

// Attribute keys
FORJA.attributes = {
  FOR: "FORJA.Attributes.FOR",
  DES: "FORJA.Attributes.DES",
  AGI: "FORJA.Attributes.AGI",
  PER: "FORJA.Attributes.PER",
  INT: "FORJA.Attributes.INT",
  APL: "FORJA.Attributes.APL"
};

// Attribute costs (PC) by level
FORJA.attributeCosts = {
  0: -5,
  1: 0,
  2: 10,
  3: 20,
  4: 30,
  5: 50
};

// Species types
FORJA.species = {
  humanoid: "FORJA.Species.humanoid",
  animal: "FORJA.Species.animal",
  arthropod: "FORJA.Species.arthropod",
  construct: "FORJA.Species.construct",
  plant: "FORJA.Species.plant",
  incorporeal: "FORJA.Species.incorporeal",
  mechanoid: "FORJA.Species.mechanoid",
  cephalopod: "FORJA.Species.cephalopod"
};

// Species costs (PC)
FORJA.speciesCosts = {
  humanoid: 0,
  animal: -15,
  arthropod: 5,
  construct: 10,
  plant: 10,
  incorporeal: 15,
  mechanoid: 20,
  cephalopod: 25
};

// Size labels (1-5)
FORJA.sizes = {
  1: "FORJA.Size.1",
  2: "FORJA.Size.2",
  3: "FORJA.Size.3",
  4: "FORJA.Size.4",
  5: "FORJA.Size.5"
};

// Size costs (PC)
FORJA.sizeCosts = {
  1: -20,
  2: -10,
  3: 0,
  4: 10,
  5: 20
};

// Size defense modifiers
FORJA.sizeDefenseModifiers = {
  1: 2,
  2: 1,
  3: 0,
  4: -1,
  5: -2
};

// Constitution labels (1-5)
FORJA.constitutions = {
  1: "FORJA.Constitution.1",
  2: "FORJA.Constitution.2",
  3: "FORJA.Constitution.3",
  4: "FORJA.Constitution.4",
  5: "FORJA.Constitution.5"
};

// Constitution costs (PC)
FORJA.constitutionCosts = {
  1: -20,
  2: -10,
  3: 0,
  4: 10,
  5: 20
};

// Skill cost table by level (cumulative PC cost)
FORJA.skillCostTable = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55];

// Weapon attack types
FORJA.attackTypes = {
  melee: "FORJA.AttackType.melee",
  ranged: "FORJA.AttackType.ranged",
  natural: "FORJA.AttackType.natural",
  brawl: "FORJA.AttackType.brawl",
  martial: "FORJA.AttackType.martial"
};

// Activation types
FORJA.activationTypes = {
  trivial: "FORJA.Activation.trivial",
  normal: "FORJA.Activation.normal",
  complex: "FORJA.Activation.complex",
  ritual: "FORJA.Activation.ritual",
  permanent: "FORJA.Activation.permanent"
};

// Range types
FORJA.rangeTypes = {
  touch: "FORJA.Range.touch",
  short: "FORJA.Range.short",
  medium: "FORJA.Range.medium",
  long: "FORJA.Range.long",
  extreme: "FORJA.Range.extreme",
  multiversal: "FORJA.Range.multiversal"
};

// Target types
FORJA.targetTypes = {
  self: "FORJA.Target.self",
  individual: "FORJA.Target.individual",
  area: "FORJA.Target.area"
};

// Duration types
FORJA.durationTypes = {
  instant: "FORJA.Duration.instant",
  scene: "FORJA.Duration.scene",
  sustained: "FORJA.Duration.sustained",
  permanent: "FORJA.Duration.permanent"
};

// Damage types
FORJA.damageTypes = {
  fatigue: "FORJA.DamageType.fatigue",
  wounds: "FORJA.DamageType.wounds",
  fatigue_or_wounds: "FORJA.DamageType.fatigue_or_wounds",
  fatigue_and_wounds: "FORJA.DamageType.fatigue_and_wounds",
  acid: "FORJA.DamageType.acid",
  fire: "FORJA.DamageType.fire",
  electricity: "FORJA.DamageType.electricity",
  explosion: "FORJA.DamageType.explosion",
  cold: "FORJA.DamageType.cold",
  disease: "FORJA.DamageType.disease",
  radiation: "FORJA.DamageType.radiation"
};

// Supernatural gift types
FORJA.giftTypes = {
  canalitzador: "FORJA.Gift.canalitzador",
  magus: "FORJA.Gift.magus",
  psiquic: "FORJA.Gift.psiquic",
  qi: "FORJA.Gift.qi"
};

// Trait categories
FORJA.traitCategories = {
  atributs: "FORJA.TraitCategory.atributs",
  habilitats: "FORJA.TraitCategory.habilitats",
  addiccions: "FORJA.TraitCategory.addiccions",
  allergies: "FORJA.TraitCategory.allergies",
  fisica: "FORJA.TraitCategory.fisica",
  armament_natural: "FORJA.TraitCategory.armament_natural",
  combat: "FORJA.TraitCategory.combat",
  salut: "FORJA.TraitCategory.salut",
  percepcio: "FORJA.TraitCategory.percepcio",
  social: "FORJA.TraitCategory.social",
  recursos: "FORJA.TraitCategory.recursos",
  discapacitat: "FORJA.TraitCategory.discapacitat",
  companys: "FORJA.TraitCategory.companys",
  longevitat: "FORJA.TraitCategory.longevitat",
  sobrenatural: "FORJA.TraitCategory.sobrenatural",
  sort: "FORJA.TraitCategory.sort",
  especial: "FORJA.TraitCategory.especial",
  general: "FORJA.TraitCategory.general"
};

// Trait types
FORJA.traitTypes = {
  positive: "FORJA.TraitType.positive",
  negative: "FORJA.TraitType.negative"
};

// Skill types
FORJA.skillTypes = {
  basic: "FORJA.SkillType.basic",
  restricted: "FORJA.SkillType.restricted"
};

// Wound levels: each level holds 'size' points; penalty per FORJA rules
// Level determination is done in _base.mjs based on value / size
FORJA.woundLevels = {
  illes:       { level: 1, penalty: 0, label: "FORJA.WoundLevel.illes" },
  masegat:     { level: 2, penalty: 0, label: "FORJA.WoundLevel.masegat" },
  nafrat:      { level: 3, penalty: 0, label: "FORJA.WoundLevel.nafrat" },
  ferit:       { level: 4, penalty: 1, label: "FORJA.WoundLevel.ferit" },
  malferit:    { level: 5, penalty: 2, label: "FORJA.WoundLevel.malferit" },
  critic:      { level: 6, penalty: 3, label: "FORJA.WoundLevel.critic" },
  incapacitat: { level: 7, penalty: null, label: "FORJA.WoundLevel.incapacitat" }
};

// Fatigue levels: each level holds 'constitution' points; penalty per FORJA rules
FORJA.fatigueLevels = {
  reposat:     { level: 1, penalty: 0, label: "FORJA.FatigueLevel.reposat" },
  afeblit:     { level: 2, penalty: 0, label: "FORJA.FatigueLevel.afeblit" },
  cansat:      { level: 3, penalty: 0, label: "FORJA.FatigueLevel.cansat" },
  defallit:    { level: 4, penalty: 1, label: "FORJA.FatigueLevel.defallit" },
  exhaurit:    { level: 5, penalty: 2, label: "FORJA.FatigueLevel.exhaurit" },
  rebentat:    { level: 6, penalty: 3, label: "FORJA.FatigueLevel.rebentat" },
  inconscient: { level: 7, penalty: null, label: "FORJA.FatigueLevel.inconscient" }
};

// Attack formula mapping: attackType -> { attribute, skill }
FORJA.attackFormulas = {
  melee: { attribute: "DES", skill: "armes-cos-a-cos" },
  ranged: { attribute: "DES", skill: "armes-distancia" },
  rangedThrown: { attribute: "AGI", skill: "armes-distancia" },
  brawl: { attribute: "FOR", skill: "barallar-se" },
  martial: { attribute: "DES", skill: "arts-marcials" },
  natural: { attribute: "FOR", skill: "barallar-se" }
};

// Base weapon stats for artifact weapons that reference a base weapon type.
// Maps artifact.system.baseWeapon → weapon profile (attack type, latency, reach, damage).
// The artifact's own damageValue is added on top as a bonus.
FORJA.weaponBaseStats = {
  "espasa":       { weaponType: "melee",  attackType: "melee", latencyMod: 1, reach: "+1",     damage: "FOR+2" },
  "espasa-llarga":{ weaponType: "melee",  attackType: "melee", latencyMod: 2, reach: "+1",     damage: "FOR+3" },
  "basto":        { weaponType: "melee",  attackType: "melee", latencyMod: 2, reach: "+1",     damage: "FOR+2" },
  "guant":        { weaponType: "melee",  attackType: "brawl", latencyMod: 0, reach: "A tocar",damage: "FOR+1" }
};

// Default natural weapon (all actors always have this)
FORJA.copWeapon = {
  id: "cop", nameKey: "FORJA.Natural.Cop", damage: "FOR+1",
  latencyMod: 0, reach: "0", attackType: "brawl", specialKey: ""
};

// Natural weapon definitions keyed by trait ID
// Actors with these trait IDs show the corresponding natural weapon in combat
FORJA.naturalWeaponTraits = {
  "armament-natural-banyes":    { id: "banyes",    nameKey: "FORJA.Natural.Banyes",    damage: "FOR+3", latencyMod: 1, reach: "1", attackType: "natural", specialKey: "" },
  "armament-natural-urpes":     { id: "urpes",     nameKey: "FORJA.Natural.Urpes",     damage: "FOR+2", latencyMod: 1, reach: "0", attackType: "natural", specialKey: "" },
  "armament-natural-mossegada": { id: "ullals",    nameKey: "FORJA.Natural.Mossegada", damage: "FOR+2", latencyMod: 1, reach: "0", attackType: "natural", specialKey: "" },
  "armament-natural-pinces":    { id: "pinces",    nameKey: "FORJA.Natural.Pinces",    damage: "FOR+3", latencyMod: 1, reach: "0", attackType: "natural", specialKey: "" },
  "armament-natural-fiblo":     { id: "fiblons",   nameKey: "FORJA.Natural.Fiblo",     damage: "FOR+2", latencyMod: 0, reach: "0", attackType: "natural", specialKey: "FORJA.Natural.FibloSpecial" },
  "tentacles":                  { id: "tentacles", nameKey: "FORJA.Natural.Tentacles", damage: "FOR+2", latencyMod: 0, reach: "0", attackType: "natural", specialKey: "" }
};
