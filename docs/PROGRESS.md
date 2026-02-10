# Progrés del Desenvolupament - FORJA Foundry VTT

## Estat General: Fases 1-7a.2 completes (segona ronda de correccions)

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

## Fase 7a: Revisió de Codi i Correccions — COMPLETADA
- [x] Revisió de l'entry point i registraments (forja.mjs, system.json) — OK
- [x] Revisió de data models per correctesa de schema
- [x] Revisió de sheets (ApplicationV2) i templates (Handlebars)
- [x] Revisió del sistema de daus i combat
- [x] Verificació de consistència de claus i18n entre templates i fitxers de llengua
- [x] **FIX CRÍTIC**: Registre de ForjaRoll a forja.mjs (CONFIG.Dice.rolls) — sense això els modificadors de trets no s'aplicaven
- [x] **FIX CRÍTIC**: Refactorització de `_rollForjaPool` per usar ForjaRoll amb detecció automàtica de modificadors de trets (adepte, inepte, especialista, atribut-titànic)
- [x] **FIX CRÍTIC**: Afegits handlers `itemEdit` i `itemDelete` a character-sheet.mjs i npc-sheet.mjs — sense això no es podien editar/eliminar items de les fitxes
- [x] **FIX CRÍTIC**: Inclusió del modificador de latència de l'armadura al càlcul de latència (_base.mjs)
- [x] **FIX CRÍTIC**: Corregida expressió Handlebars trencada a wound-fatigue-tracker.hbs (ús de forjaLocalize en lloc de lookup encadenat)
- [x] **FIX CRÍTIC**: Guard de CONFIG.FORJA a prepareDerivedData i _calculatePoints
- [x] **FIX i18n**: Afegides ~80 claus de localització que faltaven als 3 fitxers de llengua (ca/es/en)
- [x] **FIX i18n**: Corregides 10 discrepàncies de majúscules/minúscules (Derived.defense→Defense, Health.wounds→Wounds, Points.total→Total, etc.)
- [x] **FIX i18n**: Eliminades claus `FORJA.Fields.*` duplicades, unificades amb les claus directes que usen els templates

## Fase 7a.2: Segona Revisió i Correccions — COMPLETADA
- [x] **FIX CRÍTIC**: Expressió Handlebars trencada `(lookup cfg.woundLevels x).label` → `forjaLocalize` a npc-sheet.hbs, creature-sheet.hbs, animal-sheet.hbs
- [x] **FIX i18n**: Corregides 4 claus en minúscula al combat-tracker.hbs (latency→Latency, defense→Defense, wounds→Wounds, fatigue→Fatigue)
- [x] **FIX**: Afegida clau `FORJA.Combat.defeated` als 3 fitxers de llengua
- [x] **FIX**: Registre de ForjaCombatTracker a forja.mjs (CONFIG.ui.combat) — el tracker custom no s'activava
- [x] **FIX**: Afegit handler `toggleDefeated` al CombatTracker amb `activateListeners`
- [x] **FIX API v13**: ForjaRoll.evaluate() ja no passa options a super.evaluate() (incompatible amb Foundry v13)
- [x] **FIX**: Afegida categoria `general` als traitCategories de config.mjs (faltava al dropdown)
- [x] **FIX**: Refactoritzat actor.mjs per usar `renderTemplate("roll-result.hbs")` en lloc de HTML inline — el template ja no és orfe
- [x] **FIX**: Actualitzat roll-result.hbs per usar dades pre-calculades (`{{this.class}}`, `{{this.value}}`) en lloc del helper inexistent `{{dieClass}}`
- [x] Validació final: 0 patrons trencats, 0 claus i18n en minúscula, 0 templates orfes

## Fase 7b: Test Manual a Foundry — PENDENT
- [ ] Provar creació d'actors i verificar derivats
- [ ] Provar arrossegament d'items des de compendiums
- [ ] Provar tirades de daus amb modificadors de trets
- [ ] Provar combat complet amb rellotge de latència
- [ ] Verificar traduccions ca/es/en (canvi d'idioma en viu)
- [ ] Verificar barres de tokens (ferides/fatiga)
- [ ] Poliment visual
- [ ] Icones per cada tipus d'item

---

## Properes Tasques Prioritàries
1. Provar el sistema a Foundry VTT v13
2. Afegir icones personalitzades per cada tipus d'item
3. Poliment de CSS i UX
