# Progrés del Desenvolupament - FORJA Foundry VTT

## Estat General: Fases 1-6 completes, Fase 7 pendent

---

## Fase 1: Scaffold i Manifest — COMPLETADA
- [x] `system.json` — Manifest complet amb 4 Actor types, 6 Item types, 3 idiomes, 6 compendiums
- [x] `forja.mjs` — Entry point amb registre de DataModels, Documents, Sheets, Handlebars helpers
- [x] `module/helpers/config.mjs` — Totes les constants (costos, modificadors, taules, categories)
- [x] Estructura de directoris completa

## Fase 2: Data Models — COMPLETADA
- [x] `module/data-models/actor/_base.mjs` — Model base amb atributs, salut, derivats, punts
- [x] `module/data-models/actor/character.mjs` — PJ (concepte, origen, recursos, guanxi)
- [x] `module/data-models/actor/npc.mjs` — PNJ (amb tier: nemesis/antagonist/extra)
- [x] `module/data-models/actor/creature.mjs` — Criatura
- [x] `module/data-models/actor/animal.mjs` — Animal
- [x] `module/data-models/item/skill.mjs` — Habilitat (skillId, type, relatedAttribute, level)
- [x] `module/data-models/item/trait.mjs` — Tret (cost fix, paramètric, variable; incompatibilitats)
- [x] `module/data-models/item/weapon.mjs` — Arma (tipus, atac, dany, latència, munició)
- [x] `module/data-models/item/armor.mjs` — Armadura (protecció, latència, equipped)
- [x] `module/data-models/item/artifact.mjs` — Artefacte (activació, càrregues, efectes)
- [x] `module/data-models/item/supernatural-effect.mjs` — Efecte sobrenatural (do, dificultat, equilibri)
- [x] `module/documents/actor.mjs` — ForjaActor amb rollAttribute, rollSkill, rollAttack, _rollForjaPool
- [x] `module/documents/item.mjs` — ForjaItem amb toChat()

## Fase 3: Fitxes de Personatge — COMPLETADA
- [x] `module/sheets/actor/character-sheet.mjs` — Fitxa PJ amb 7 pestanyes
- [x] `module/sheets/actor/npc-sheet.mjs` — Fitxa PNJ compacta
- [x] `module/sheets/actor/creature-sheet.mjs` — Fitxa Criatura
- [x] `module/sheets/actor/animal-sheet.mjs` — Fitxa Animal mínima
- [x] `module/sheets/item/skill-sheet.mjs` — Fitxa Habilitat
- [x] `module/sheets/item/trait-sheet.mjs` — Fitxa Tret
- [x] `module/sheets/item/weapon-sheet.mjs` — Fitxa Arma
- [x] `module/sheets/item/armor-sheet.mjs` — Fitxa Armadura
- [x] `module/sheets/item/artifact-sheet.mjs` — Fitxa Artefacte
- [x] `module/sheets/item/supernatural-effect-sheet.mjs` — Fitxa Efecte Sobrenatural
- [x] Templates Handlebars (25 fitxers .hbs): actor sheets, item sheets, partials, dice, combat
- [x] `styles/forja.css` — Estils complets (tema teal/fosc, daus, combat, trackers)
- [x] `module/helpers/templates.mjs` — Handlebars helpers (times, ifeq, percentage, levelDots, etc.)
- [x] `templates/dice/roll-dialog.hbs` — Diàleg de tirada
- [x] `templates/dice/roll-result.hbs` — Targeta de xat per resultats
- [x] `templates/combat/combat-tracker.hbs` — UI del combat tracker

## Fase 4: Mecànica de Daus — COMPLETADA
- [x] `module/dice/forja-roll.mjs` — Roll customitzat amb fites, pífies, modificadors de trets (adept/inept/specialist/titanic)
- [x] `module/dice/roll-dialog.mjs` — Diàleg de tirada (DialogV2)
- [x] `module/helpers/calculations.mjs` — parseDamageFormula, calculateAttackDice, calculateFites, getDieClass

## Fase 5: Sistema de Combat — COMPLETADA
- [x] `module/documents/combat.mjs` — ForjaCombat (latència, ordenació, rollInitiative sense daus)
- [x] `module/documents/combatant.mjs` — ForjaCombatant (declareAction, position, side, reactions)
- [x] `module/combat/latency-clock.mjs` — getDeclarationOrder, calculateActionPosition, advanceClock, calculateDamage
- [x] `module/combat/combat-tracker.mjs` — CombatTracker personalitzat

## Fase 6: Compendiums i i18n — COMPLETADA
- [x] `lang/ca.json` — Traduccions en català (207 claus)
- [x] `lang/es.json` — Traduccions en castellà (207 claus)
- [x] `lang/en.json` — Traduccions en anglès (207 claus)
- [x] `scripts/build-packs.mjs` — Script per generar compendiums LevelDB des de dades FORJAPP
- [x] `package.json` — Configuració npm amb classic-level per generar packs
- [x] Compendiums generats (219 items totals):
  - `packs/skills/` — 46 habilitats (41 bàsiques + 5 restringides)
  - `packs/traits/` — 95 trets (positius i negatius, totes les categories)
  - `packs/weapons/` — 29 armes (7 naturals + 10 cos a cos + 12 distància)
  - `packs/armor/` — 6 armadures
  - `packs/artifacts/` — 15 artefactes
  - `packs/supernatural-effects/` — 28 efectes sobrenaturals (màgia, psi, qi)

## Fase 7: Test i Poliment — PENDENT
- [ ] Provar creació d'actors i derivats
- [ ] Provar arrossegament d'items des de compendiums
- [ ] Provar tirades de daus
- [ ] Provar combat complet
- [ ] Verificar traduccions ca/es/en
- [ ] Verificar barres de tokens
- [ ] Poliment visual
- [ ] Icones per cada tipus d'item

---

## Properes Tasques Prioritàries
1. Provar el sistema a Foundry VTT v13
2. Corregir errors i polir
3. Afegir icones personalitzades per cada tipus d'item
