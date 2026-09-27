# FORJA-FoundryVTT — Code review and improvement plan

Branch: `Aw` · Review date: 2026-09-27 · Base commit: `f972f65`

The review was done by reading the code against the Foundry VTT v13 API. It was **not** run inside Foundry; every fix must be checked in a live world before merging to `main`.

Each finding has an ID. The plan section groups the IDs into work packages, each with an owner agent, a model, and the files it is allowed to touch.

---

## 1. Findings

### A. Bugs that break things

| ID | Where | Finding |
|----|-------|---------|
| A1 | `forja.mjs:88-116` | `createActor`, `createItem`, `preUpdateCombat`, `updateCombat` hooks run on **every connected client** with no `userId` / active-GM check. Several clients add the automatic "Cop" attack at once (duplicates), and non-owners get permission errors. |
| A2 | `combat/atac.mjs:60,66`, `combat/defensa.mjs:90`, `combat/curacio.mjs:77,107,113` | The acting user updates the **target** actor/items directly (damage, reactions, healing, ègida, statuses). Players do not own NPCs → permission errors; the flow only works when the GM clicks everything. `system.json` had `"socket": false`, so there is no GM relay. |
| A3 | `documents/combat.mjs:77-110`, `forja.mjs:99-110` | After `declararAccio` changes a combatant's `initiative`, Foundry re-sorts `turns` but keeps the same `turn` **index**, so `combat.combatant` now points at a different combatant. Example: A and B both at tick 0, A current; A declares latency 5 → order becomes B(0), A(5), index 0 = B. "Next turn" treats B as the one who just acted, excludes B, and jumps to A: **B's turn is skipped**. The reaction reset also targets the wrong actor. |
| A4 | `data/actor-personatge.mjs:116-142`, `progressio/millora.mjs` | PC spent is computed from the *current* build (attributes, skills, traits). Improvements bought with XP raise those values, so PC spent rises too and the "PC budget exceeded" warning fires. Removing a negative trait with XP also increases PC spent. |
| A5 | `scripts/build-manual.mjs:109-112` | The script deletes `packs/_source/manual` **before** checking that the input folder `../../FOUNDRY/MD` (outside the repo) exists. On any machine without it, `npm run build:manual` wipes the committed sources, then crashes. |
| A6 | `forja.mjs:47-55` | Token bars point at `salut.fatiga` / `salut.ferides`, which have no `{value, max}`. The bars can't render. |
| A7 | `forja.mjs:120-130` | The system re-registers Foundry/Handlebars helpers `eq`, `lt`, `or`, `concat`, `lookup` globally. The 2-argument `or` breaks core templates that pass more arguments. |
| A8 | `estats/estats.mjs:41` | `CONFIG.statusEffects` is replaced entirely, so there is no `dead` status (`CONFIG.specialStatusEffects.DEFEATED`). The tracker's "mark defeated" toggle will fail. |

### B. Game rules that are wrong or missing

| ID | Where | Finding |
|----|-------|---------|
| B1 | `dice/tirada.mjs:17` vs `combat/atac.mjs`, `defensa.mjs`, `curacio.mjs` | The health penalty only applies to rolls from the sheet dialog. Tracker attacks, defence rolls and healing ignore it. Level 7 ("out of combat") does not stop acting. |
| B2 | `data/actor-personatge.mjs` | Armour `modLatencia` is never applied to latency. |
| B3 | `combat/atac.mjs:106-109` | Only the first armour item counts; there is no "equipped" state, and the armour type parameter is unused. |
| B4 | `combat/atac.mjs:63-71` | A broken ègida sets `tornsInactiva`, but nothing counts it down or reactivates it. |
| B5 | `combat/reaccions.mjs:47-61`, `dice/dialeg-tirada` | Concentration is never set or broken (`concentrar` / `trencarConcentracio` are never called). The roll dialog's "concentrat" checkbox gives a free +1 die. |
| B6 | `config/constants.mjs:122`, `combat/atac.mjs:31` | Martial-arts manoeuvres are loaded, and `ferAtac` accepts one, but no UI offers them. |
| B7 | `combat/tracker-ui.mjs:117-138` vs `combat/defensa.mjs` | Two different defence calculations: the declare dialog parries with melee-weapons skill only and blocks with uncapped resistance; `defensa.mjs` uses the best of three skills and caps block at `min(resistència, FOR)`. |
| B8 | `apps/full-personatge.mjs:580`, `combat/tracker-ui.mjs:106` | Melee weapon attacks roll **FOR**, but the skill list gives *armes cos a cos* the attribute **DES**. **Open question for the designer (Q1)** — not changed until answered. |
| B9 | `combat/abast.mjs:76-78` | Melee reach is centre-to-centre ≤ 1 grid unit, so size 4–5 tokens (or any token larger than 1×1) can never be adjacent. |
| B10 | `combat/tracker-ui.mjs:247` | The defender's dodge/parry roll is never posted to chat. |
| B11 | `combat/equipament-automatic.mjs:51-57` | Natural-weapon traits are matched by name substring, not by `flags.forja.catalegId`; the weapon is not removed when the trait is deleted. |
| B12 | `apps/full-personatge.mjs:536-542` | When a track reaches level 7 (`marcats = 6 × perNivell`), the terminal box (index `6 × perNivell + 1`) is still drawn unmarked. |

### C. Inconsistencies and dead code

| ID | Where | Finding |
|----|-------|---------|
| C1 | `lang/` | `es.json` is `{}`. `en.json` has 151 of 288 keys. 14 used keys are missing everywhere (`FORJA.Dice.*`, `FORJA.Mida`, `FORJA.Constitucio`, …). Hard-coded strings ("concentrat +1d", "Secció", "Introducció"). Game data (traits, weapons, statuses) is Catalan-only. |
| C2 | `combat/tracker-ui.mjs:30-44,58-86` | `forjaMarcador` / `forjaPosicio` are computed but never rendered, so the time marker is invisible. FORJA controls are shown to every user for every combatant. |
| C3 | — | No item sheet is registered; "edit" opens Foundry's generic sheet, which cannot edit `system` fields. |
| C4 | `dice/roll-dialog.mjs`, `templates/actor/personatge-{principal,stats,habilitats,combat,dons}.hbs`, `config/dades/criatures-exemple.json`, `ForjaRoll.getDieClass` | Dead code (roll-dialog calls a non-existent `_rollForjaPool`). |
| C5 | `data/actor-personatge.mjs:15-20` | `biografia`, `genere`, `edat` exist in the data model but are not on the sheet. |
| C6 | `CLAUDE.md`, `README.md`, `package.json`, `system.json` | `CLAUDE.md` describes a different architecture; README is two lines; versions 0.1.0 vs 0.2.0; "v13"/"v14" mixed; `system.json` lacks `url`/`manifest`/`download`. |
| C7 | `packs/manual/LOCK`, `LOG`, `LOG.old` | LevelDB runtime files are committed. |

### D. Worth improving

| ID | Where | Finding |
|----|-------|---------|
| D1 | `apps/full-pnj.mjs` / `full-personatge.mjs` | ~350 of ~620 lines duplicated. |
| D2 | sheets ×2, `equipament-automatic.mjs` | Creating an item from a catalogue entry is written out in 4 places. |
| D3 | `full-personatge.mjs`, `tracker-ui.mjs`, `forja.mjs`, `forja-roll.mjs` | `HAB_PER_CATEGORIA` and the die-colour class each defined twice. |
| D4 | `config/constants.mjs:94-111` | Data loaded by top-level `await fetch` with a hard-coded `systems/forja/…` path and no `r.ok` check; the code's own comment says it can delay `init`. |
| D5 | `documents/combat.mjs:101-109` | `nextTurn` writes to the database twice per turn. |
| D6 | sheets | Deleting an item asks for no confirmation. |
| D7 | `apps/dialeg-*.mjs`, `dice/dialeg-tirada.mjs` | Dialogs use fixed `id`s; opening the same dialog twice misbehaves. |

### Open questions for the game designer

- **Q1 (B8): resolved from the manual, confirmed by Oriol FM on 2026-09-27** (melee: DES to hit, FOR for damage) ("Cos a cos", line ~2896; "A distància", line 3024).
  - Melee weapons roll **DES** + armes cos a cos (the code rolled FOR).
  - Martial arts roll **DES**; brawling and natural weapons roll **FOR**.
  - Ranged weapons roll **DES** + armes a distància, except thrown weapons (llancívoles), which roll **AGI**.
  - Implemented as `FORJA.ATAC_PER_CATEGORIA` / `FORJA.ATAC_PER_ARMA` plus the helper `atributIHabilitatAtac(item)` (WP-G), used by the sheets and the tracker (WP-F).
  - Still to confirm with the designer: improvised weapons are assumed to use the *armes improvisades* skill, and improvised thrown objects AGI.
  - The manual contradicts itself on ties against passive defence: line ~2904 says a tie misses, line 3143 says a tie is enough. The code follows line 3143.
- **Q2 (B4): answered by Oriol FM, 2026-09-27.** An ègida's inactive time counts in **clock ticks**, not the wearer's turns.
- **Q3 (B3): superseded.** Oriol first said "the best armour". Later on 2026-09-27 he ruled that **the manual prevails** unless it contradicts itself. The manual (line 3337) says a flexible armour adds **half** its protection (rounded up) to a rigid one, and latency penalties stack in full. `proteccioArmadura` now implements that.

---

## 2. Plan

### Shared rules for every agent

- Work in `/home/bonnie/projectes/ForjaVTT/FORJA-FoundryVTT` on branch `Aw`. **Do not run git commands** (no commit, checkout, stash, reset). The coordinator commits after each wave.
- Edit **only** the files your package owns. If you need a change elsewhere, write it under "Needs from others" in your report instead.
- **Rules reference:** `docs/manual/FORJA_FC001CA_CORE.md` is the physical game manual (Catalan) and the source of truth for every rule. Search it (e.g. `grep -n`) before implementing or changing any game mechanic, and cite the section in comments.
- Match the existing style: ES modules, Catalan identifiers and comments, JSDoc headers citing the manual/spec IDs.
- New UI strings go in `lang/ca.json` only (`FORJA.*` keys). Package D1 translates them afterwards. **Exception:** only the owner of `lang/ca.json` in a wave edits it; others list the keys and Catalan text in their report.
- Check every file you touch with `node --check <file>`. For pure functions, write a quick Node test in the scratchpad (`/tmp/claude-1000/-home-bonnie-projectes-ForjaVTT/ef039ca4-3800-4ff6-9c2d-e2341ab195a4/scratchpad`), not in the repo.
- Report: files changed, what was done per finding ID, anything not done and why, keys for `lang/ca.json`, and what needs testing in Foundry.

### Cross-package contracts (decided up front)

- **GM relay (from WP-A):** `module/xarxa/socket.mjs` exports
  `actualitzarComGM(document, changes)`, `crearEmbegutsComGM(actor, type, data[])`, `eliminarEmbegutsComGM(actor, type, ids[])` and `alternarEstatComGM(actor, statusId, active)`.
  Each one acts directly when `document.isOwner`, otherwise it asks the active GM through `game.socket` (`"system.forja"`) and resolves when the GM has applied it. Any code that changes a document the current user may not own must use these.
- **Derived health fields (from WP-B):** `salut.fatiga.value/max`, `salut.ferides.value/max` (`max = 6 × perNivell + 1`, `value = max(0, max − marcats)` = boxes left), and `salut.foraDeCombat = nivellEfectiu >= 7`.
- **Equipped armour (from WP-G):** `ItemArmadura.system.equipada` (Boolean, initial `true`). Readers must treat a missing value as equipped (`system.equipada !== false`).

### Wave 1 — run in parallel

**WP-A · Multiplayer authority and turn order — Opus** (A1, A2, A3, A7, D5)
Files: `forja.mjs`, `module/documents/combat.mjs`, `module/documents/actor.mjs`, new `module/xarxa/socket.mjs`, `module/combat/reaccions.mjs`, and in `combat/atac.mjs`, `combat/defensa.mjs`, `combat/curacio.mjs` **only** the lines that update documents.
1. Guard `createActor` / `createItem` with `userId === game.user.id`; run the combat hooks on the active GM only (`game.users.activeGM?.isSelf`).
2. Build the socket relay above and register it at `ready`; route every target update through it.
3. Fix turn order so `combat.combatant` stays the same combatant after a re-sort. For example, keep the acting combatant's id in `flags.forja` and re-point `turn` after `setupTurns`, or override `setupTurns` to preserve the current combatant. Make sure the reaction reset uses the combatant who actually finished.
4. `nextTurn`: write the marker flag and `turn`/`round` in one `update`.
5. Remove the overrides of `eq`, `lt`, `or`, `lookup` (templates keep working with core/builtin helpers); keep `add`, `concat`, `dieClass`.

**WP-B · Derived data and XP accounting — Sonnet** (A4, A6, B2, B1-data)
Files: `module/data/actor-personatge.mjs`, `module/data/_camps.mjs`, `module/progressio/millora.mjs`, `module/validacio/coherencia.mjs`.
1. PC spent for creation = full build cost − `px.gastats`. All XP spending uses the same cost tables, so this cancels XP purchases exactly, including removing negative traits. Update `coherencia.mjs` if needed.
2. Add the derived health fields from the contract (fixes token bars; `forja.mjs` already points at `salut.fatiga` / `salut.ferides`).
3. Add equipped armour `modLatencia` to latency (use `system.equipada !== false`), keeping `Math.max(1, …)`.

**WP-C · Build script and repo hygiene — Haiku** (A5, C7, part of C6)
Files: `scripts/build-manual.mjs`, `.gitignore`, `package.json`.
1. Read the input folder from env `FORJA_MD_DIR`, defaulting to the current path. Exit with a clear error **before** deleting anything if it does not exist or has no `.md` files.
2. Ignore `packs/*/LOCK`, `packs/*/LOG`, `packs/*/LOG.old`. (The coordinator untracks them.)
3. Set `package.json` version to `0.2.0`.

**WP-E · Data loading and status effects — Sonnet** (A8, D4)
Files: `module/config/constants.mjs`, `module/estats/estats.mjs`, `module/config/dades/estats.json`.
1. Keep loading all JSON in parallel. Build the URL from `import.meta.url` instead of a hard-coded `systems/forja/…` path, and check `r.ok`. Log clearly and fall back to `[]`.
2. Keep Foundry's `dead` status (append the core `dead` entry, or ensure `CONFIG.specialStatusEffects.DEFEATED` maps to an existing FORJA status). Status names should be `FORJA.Estat.<id>` i18n keys; list the Catalan strings in the report.

**WP-H · Dead code — Haiku** (C4, D3-part)
Files: `module/dice/roll-dialog.mjs`, the 5 unused `templates/actor/personatge-*.hbs`, `module/config/dades/criatures-exemple.json`, `module/dice/forja-roll.mjs`.
Delete the dead files and `ForjaRoll.getDieClass`. Use `grep` to confirm each has no remaining references before deleting.

### Wave 2 — after wave 1 is committed

**WP-F · Combat rules and tracker — Opus** (B1, B3, B4, B5, B6, B7, B9, B10, C2)
Files: `module/combat/atac.mjs`, `defensa.mjs`, `abast.mjs`, `dany.mjs`, `curacio.mjs`, `tracker-ui.mjs`, `module/apps/dialeg-declarar-accio.mjs`, `module/apps/dialeg-defensa.mjs`, `module/dice/tirada.mjs`, `module/dice/dialeg-tirada.mjs`, `module/documents/combat.mjs`, `templates/combat/*`, `templates/dice/*`, `lang/ca.json`.
1. Apply the health penalty to attack, defence and healing rolls; warn and block when `salut.foraDeCombat`.
2. Armour: use equipped armours; if several, the best one gives protection (Q3, confirmed). Latency penalties stack; WP-B already does this.
3. Ègida: the inactive time is measured in **clock ticks** (Q2). When it breaks, record the tick at which it reactivates (current marker + `tornsInactiva`). Reactivate it on the GM side when the combat marker reaches that tick, and only if `absorcio > 0`.
4. Concentration: a "concentrate" option when declaring an action sets `concentrat`; the next roll consumes it (+1 die, then clear); damage breaks it. Remove the free checkbox bonus.
5. Offer martial-arts manoeuvres in the declare dialog for natural/"Cop" attacks and pass them to `ferAtac`.
6. One source of truth for defence options: the declare dialog builds its list from `opcionsDefensa`.
7. Melee reach: measure edge to edge (token bounds), or subtract each token's half-size.
8. Post the defender's roll to chat.
9. Render the marker/position (small `<div>` injected in `_onRender`) and show FORJA controls only to the GM or the combatant's owner.
10. Use the WP-A socket helpers for every cross-actor write.
11. Leave B8 alone (Q1).

**WP-G · Sheets refactor and items — Sonnet** (D1, D2, D3-part, D6, C3, C5, B11, B12, equipped-armour field)
Files: `module/apps/full-personatge.mjs`, `module/apps/full-pnj.mjs`, new `module/apps/full-actor-base.mjs`, new `module/apps/full-item.mjs` + `templates/item/*.hbs`, `module/data/item-armadura.mjs`, `module/combat/equipament-automatic.mjs`, `templates/actor/*` (except dialogs owned elsewhere), `styles/forja.css`.
1. Extract a shared base sheet class; the PC and NPC sheets keep only their differences.
2. One `crearItemDesDeCataleg(actor, tipus, entrada)` helper (in `equipament-automatic.mjs`), used by both sheets; it always sets `flags.forja.catalegId`.
3. Move `HAB_PER_CATEGORIA` to `config/constants.mjs` as `FORJA.HAB_PER_CATEGORIA` (the only edit allowed in that file).
4. Confirm before deleting items (`DialogV2.confirm`).
5. One item sheet (ApplicationV2 `ItemSheetV2`) with a template per item type, registered in `forja.mjs` (the only edit allowed there).
6. Show `biografia`, `genere`, `edat` on the PC sheet.
7. Natural weapons are matched by `catalegId`, and removed when their trait is deleted (hook `deleteItem`, guarded by `userId`; add it to `forja.mjs`).
8. Health grid: mark the terminal box when `nivellActiu === 7`.
9. Add `equipada` to `item-armadura.mjs` and an equip toggle on the armour row.
10. New strings: list them in the report (WP-F owns `lang/ca.json` in wave 2).

### Wave 3 — after wave 2 is committed (`01fa086`)

WP-I and WP-D3 run in parallel. The translation and dialog packages move to wave 4, because WP-I adds new strings and edits dialogs.

**WP-I · Remaining manual rules — Opus** (B13–B17, added 2026-09-27 at the user's request)
Files: `module/combat/*` (except `equipament-automatic.mjs`), `module/apps/dialeg-declarar-accio.mjs`, `dialeg-defensa.mjs`, `dialeg-curacio.mjs`, `module/documents/combat.mjs`, `templates/combat/*`, `templates/dice/*`, `lang/ca.json`, `module/config/dades/armes.json` (only to add machine-readable flags).
Rules found by WP-F that are not automated yet. Each must follow the manual (`docs/manual/FORJA_FC001CA_CORE.md`):

| ID | Rule | Manual |
|----|------|--------|
| B13 | Shotguns, "Poca penetració": rigid armour gives double protection against shotguns. | weapon table, line ~3091 |
| B14 | Extra damage when a dodge is botched (pífia). | "Esquivar"/"Pífies", around line 3157; grep `pífia` |
| B15 | Blocking uses resistència without weapons, armes cos a cos with a shield, armes improvisades with other objects. Today it always uses resistència. | "Blocar", line 3181 |
| B16 | Brawling delay: an actor may delay a barallar-se action by up to their skill level in extra latency; each extra turn gives +1 to hit. | "Cos a cos", line 2902 |
| B17 | Healing requirements: first aid needs medicina ≥ 1 (enginyeria/nyaps for mecanoides); medical treatment needs ≥ 2. Treating yourself needs GM approval. | "Primers auxilis" / "Tractament mèdic", lines 3486–3502 |

- Any new relayed write paths must be reported, so the coordinator can extend `CAMPS_PERMESOS_PER_TIPUS` in `module/xarxa/socket.mjs`.
- Store weapon properties such as "shotgun" or "shield" as data (e.g. `propietats` in `armes.json` or a flag), not by matching names.

### Wave 4 — after wave 3 is committed (D2, then D1)

**WP-D1 · Translations — Sonnet** (C1)
Files: `lang/*.json`.
Add every key the code uses to `ca.json` (including the ones reported by WP-E/F/G). Then produce full `es.json` and `en.json` with the same key set. Verify with a script that all three files have identical keys and that every literal/dynamic key used in `module/` and `templates/` exists.

**WP-D2 · Dialog ids and hard-coded strings — Haiku** (D7, C1-part)
Files: `module/apps/dialeg-*.mjs`, `module/dice/dialeg-tirada.mjs`, templates with hard-coded text.
Remove fixed `id`s, or make them unique per instance. Replace hard-coded UI strings with `localize` keys, and hand the keys to WP-D1 (runs after D1, or append to all three lang files with the translations).

**WP-D3 · Documentation — Sonnet** (C6)
Files: `CLAUDE.md`, `README.md`, `system.json` (metadata only).
Rewrite `CLAUDE.md` from the actual code (types, files, patterns, socket relay, how to build/test). Write a real README (install, compatibility, build:manual with `FORJA_MD_DIR`). Align the v13/v14 wording, and add `url`/`manifest`/`download` placeholders for the owner to fill in.

### Model choice

- **Opus** for WP-A, WP-F and WP-I: multiplayer authority, turn order and combat resolution are the critical paths, where a subtle mistake corrupts game state.
- **Sonnet** for WP-B, E, G, D1, D3: well-specified work that needs judgement and reading surrounding code.
- **Haiku** for WP-C, H, D2: mechanical, fully specified edits.

### After all waves

- Run **graphify** over the whole project to build a queryable knowledge graph of the code (requested by the user). Keep the output out of the repo unless the user asks otherwise.
- Gameplay tests in a headless Foundry v13 on this machine (Playwright + headless Chromium, GM and player sessions). This needs the user's Foundry licence key and the timed Linux/NodeJS download link.

### Verification after all waves

- `node --check` on every `.mjs`; key-parity script on `lang/`.
- Manual test in Foundry v13 with a GM and one player account:
  1. Create a PC and an NPC: exactly one "Cop" each.
  2. Player attacks the NPC from the tracker: no permission errors, damage applied, defender roll in chat.
  3. Declare actions with tied positions: no skipped turns, reactions reset for the right actor.
  4. Spend XP: the PC budget warning does not appear.
  5. Token bars show remaining health.
  6. Mark a combatant defeated.
  7. Switch language to es/en: no raw keys.
