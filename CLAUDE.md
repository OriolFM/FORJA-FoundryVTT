# FORJA RPG - Foundry VTT System

## Projecte
Sistema oficial de FORJA RPG per Foundry VTT v13. Permet jugar a FORJA directament a Foundry amb suport complet per ca/es/en.

## Tecnologies
- Foundry VTT v13 (API v13)
- ES Modules (.mjs)
- Handlebars (.hbs) per plantilles
- CSS custom properties per temes
- DataModels moderns (foundry.abstract.TypeDataModel)
- ApplicationV2 (foundry.applications.sheets.ActorSheetV2)

## Estructura del Projecte
```
forja-foundryvtt/
├── system.json          # Manifest del sistema
├── forja.mjs            # Entry point (registra tot a Hooks.once("init"))
├── module/
│   ├── data-models/     # DataModels v13 per actors i items
│   │   ├── actor/       # _base.mjs, character.mjs, npc.mjs, creature.mjs, animal.mjs
│   │   └── item/        # skill.mjs, trait.mjs, weapon.mjs, armor.mjs, artifact.mjs, supernatural-effect.mjs
│   ├── documents/       # Document classes (ForjaActor, ForjaItem, ForjaCombat, ForjaCombatant)
│   ├── sheets/          # Sheet classes (ApplicationV2)
│   │   ├── actor/       # character-sheet.mjs, npc-sheet.mjs, creature-sheet.mjs, animal-sheet.mjs
│   │   └── item/        # Una sheet per tipus d'item
│   ├── dice/            # forja-roll.mjs (d10 pool), roll-dialog.mjs
│   ├── combat/          # combat-tracker.mjs, latency-clock.mjs
│   └── helpers/         # config.mjs (constants), calculations.mjs, templates.mjs (Handlebars helpers)
├── templates/           # Plantilles Handlebars
│   ├── actor/           # character-sheet.hbs + parts/*.hbs
│   │   └── parts/       # Parcials: attributes, skills-list, traits-list, etc.
│   ├── item/            # Una plantilla per tipus d'item
│   ├── dice/            # roll-dialog.hbs, roll-result.hbs
│   └── combat/          # combat-tracker.hbs
├── styles/forja.css     # Estils (tema teal/fosc)
├── lang/                # i18n: ca.json, es.json, en.json
├── packs/               # Compendiums LevelDB (skills, traits, weapons, armor, artifacts, supernatural-effects)
├── scripts/             # build-packs.mjs (genera compendiums)
├── assets/icons/        # Icones del sistema
└── docs/                # Documentació del projecte
    ├── PLAN.md          # Pla d'implementació complet
    ├── PROGRESS.md      # Estat actual del desenvolupament
    └── FORJA-RULES.md   # Resum de les regles del joc
```

## Patrons Importants
- **CONFIG.FORJA** — Objecte global amb totes les constants del sistema (costos, modificadors, taules)
- **prepareDerivedData()** — A `_base.mjs`, calcula stats derivats (defensa, latència, protecció, punts gastats)
- **Items com a dades** — Skills, traits, weapons, armor, artifacts i efectes sobrenaturals són Items que s'arrosseguen als actors
- **i18n amb `{{localize "FORJA.key"}}`** — Totes les cadenes de text passen per Foundry i18n
- **Actions amb `data-action`** — Les interaccions de les sheets usen el sistema d'actions d'ApplicationV2
- **Fites i Pífies** — Sistema de daus D10: 6-9=1 èxit, 10=2 èxits, 1+0 fites=pífia
- **Latència** — Combat sense tirada d'iniciativa, basat en latència calculada dels stats

## Relació amb FORJAPP
FORJAPP (React/Firebase) és l'app companion. Les dades de referència (habilitats, trets, armes, artefactes, efectes) es van transferir des de:
- `FORJAPP/src/data/skills.ts` → 46 habilitats
- `FORJAPP/src/data/traits.ts` → ~70+ trets
- `FORJAPP/src/data/equipment.ts` → 32 armes + 6 armadures
- `FORJAPP/src/data/artifacts.ts` → ~14 artefactes
- `FORJAPP/src/data/supernaturalEffects.ts` → ~25 efectes sobrenaturals
- `FORJAPP/src/utils/calculations.ts` → Fórmules de derivats
- `FORJAPP/src/utils/combatEngine.ts` → Lògica del rellotge de latència

Per generar els compendiums des d'aquestes fonts, executar `scripts/build-packs.mjs`.

## Actor Types
| Tipus | DataModel | Sheet | Descripció |
|-------|-----------|-------|------------|
| character | CharacterData | ForjaCharacterSheet | Personatge Jugador (PJ) |
| npc | NPCData | ForjaNPCSheet | Personatge No Jugador (PNJ) |
| creature | CreatureData | ForjaCreatureSheet | Criatura |
| animal | AnimalData | ForjaAnimalSheet | Animal |

## Item Types
| Tipus | DataModel | Compendium |
|-------|-----------|------------|
| skill | SkillData | packs/skills |
| trait | TraitData | packs/traits |
| weapon | WeaponData | packs/weapons |
| armor | ArmorData | packs/armor |
| artifact | ArtifactData | packs/artifacts |
| supernaturalEffect | SupernaturalEffectData | packs/supernatural-effects |

## Derivats (calculats a _base.mjs prepareDerivedData)
- `defense = AGI + sizeDefenseModifier`
- `latency = max(1, 10 + size - AGI*2)`
- `damageReduction = FOR`
- `reaction = 1 + trait_mods` (reflexos-rapids: +1, lent: -1)
- `health.wounds.max = size * 10`
- `health.fatigue.max = constitution * 10`
- `protection = equippedArmor + armadura-natural + artifactProtection`
- `spentPoints = sum(atributs + espècie + mida + constitució + habilitats + trets + artefactes + efectes)`

## Verificació / Test
1. Copiar/symlink la carpeta a `{FoundryData}/Data/systems/forja`
2. Crear un World nou amb sistema "FORJA RPG"
3. Crear actors, arrossegar items dels compendiums
4. Provar tirades, combat, canvi d'idioma
