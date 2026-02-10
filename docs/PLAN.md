# Pla d'Implementació - FORJA RPG per Foundry VTT v13

## Context

FORJA RPG és un joc de rol complet amb sistema de punts, 6 atributs, 46 habilitats, ~140 trets, combat per rellotge de latència i 4 dons sobrenaturals. L'app FORJAPP (React/TypeScript) ja implementa totes les mecàniques. Aquest projecte crea un sistema oficial per Foundry VTT v13.

**Target**: Foundry VTT v13 (DataModels moderns, ES Modules, ApplicationV2)

---

## Fases d'Implementació

### Fase 1: Scaffold i Manifest
- `system.json` — id "forja", compatibility v13, 3 idiomes, 6 compendiums, 4 Actor types, 6 Item types
- `forja.mjs` — Registra DataModels, Documents, Sheets, CONFIG.FORJA
- `module/helpers/config.mjs` — Constants del sistema

### Fase 2: Data Models
- `_base.mjs` — Esquema compartit: espècie, mida, constitució, 6 atributs (0-5), salut, punts
- `character.mjs` — Camps extra PJ: concepte, origen, recursos, guanxi
- `npc.mjs` — Camps PNJ: tier (nemesis/antagonist/extra)
- `creature.mjs`, `animal.mjs` — Simplificats
- 6 Item DataModels: skill, trait, weapon, armor, artifact, supernaturalEffect
- `ForjaActor` — prepareDerivedData, rollAttribute, rollSkill, rollAttack
- `ForjaItem` — toChat

### Fase 3: Fitxes de Personatge
- Fitxa PJ amb 7 pestanyes: Atributs, Habilitats, Combat, Trets, Equipament, Sobrenatural, Biografia
- Fitxes simplificades: NPC (compacta), Criatura (combat), Animal (mínima)
- 6 fitxes d'item
- CSS tema teal/fosc
- Handlebars helpers

### Fase 4: Mecànica de Daus
- ForjaRoll: D10 pool, fites (6-9=1, 10=2), pífia (1+0 fites)
- Modificadors: Adepte, Inepte, Especialista, Titànic
- Diàleg de tirada, targeta de xat

### Fase 5: Sistema de Combat
- ForjaCombat: latència determinista (sense tirada d'iniciativa)
- Rellotge de latència: declaració → avanç → resolució → redeclaració
- ForjaCombatant: declareAction, position, side, reactions
- Combat Tracker personalitzat

### Fase 6: Compendiums i i18n
- Script `build-packs.mjs` per generar compendiums LevelDB des de dades FORJAPP
- 6 compendiums: skills (46), traits (~70+), weapons (32), armor (6), artifacts (~14), effects (~25)
- 3 fitxers d'idioma: ca.json, es.json, en.json

### Fase 7: Test i Poliment
- Provar creació d'actors, items, tirades, combat
- Verificar traduccions, barres de tokens
- Poliment visual, icones

---

## Mapa de Migració des de FORJAPP

| Fitxer FORJAPP | Destí Foundry VTT | Contingut |
|---|---|---|
| `src/types/character.ts` | `module/data-models/**/*.mjs` | Interfícies → DataModel schemas |
| `src/utils/calculations.ts` | `module/helpers/calculations.mjs` + `_base.mjs` | Fórmules derivats + constants |
| `src/utils/combatEngine.ts` | `module/combat/latency-clock.mjs` + `combat.mjs` | Rellotge de combat |
| `src/utils/turnQueue.ts` | `module/documents/combat.mjs` | Ordenació per latència |
| `src/data/skills.ts` | `packs/skills/` + `lang/*.json` | 46 habilitats trilingües |
| `src/data/traits.ts` | `packs/traits/` + `lang/*.json` | ~70+ trets amb metadades |
| `src/data/equipment.ts` | `packs/weapons/` + `packs/armor/` | 32 armes + 6 armadures |
| `src/data/artifacts.ts` | `packs/artifacts/` | ~14 artefactes |
| `src/data/supernaturalEffects.ts` | `packs/supernatural-effects/` | ~25 efectes sobrenaturals |
| `DiceRollModal.tsx` | `module/dice/forja-roll.mjs` | calculateFites, isPifia |

---

## Verificació

1. Copiar/symlink la carpeta a `{FoundryData}/Data/systems/forja`
2. Crear un World nou seleccionant "FORJA RPG"
3. Crear actors, arrossegar items dels compendiums, fer tirades, iniciar combat
4. Canviar idioma a Settings → Language i verificar traduccions
