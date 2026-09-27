# Registre de treball — revisió de la branca `Aw`

Aquest document recull **què s'ha fet, per què i què queda pendent**, per a referència futura. El detall de cada troballa (ID A1, B3, …) i el pla per paquets són a [`REVIEW-PLAN.md`](REVIEW-PLAN.md). La font de veritat de les regles és el manual: [`manual/FORJA_FC001CA_CORE.md`](manual/FORJA_FC001CA_CORE.md).

## Com s'ha treballat

1. **Revisió de codi** (2026-09-27) de tot el repositori, llegint el codi contra l'API de Foundry v13, sense executar-lo en un Foundry real.
2. **Pla per paquets** (WP-A … WP-I, WP-D1–D3). Cada paquet té els seus fitxers en exclusiva, perquè diversos agents puguin treballar alhora a la mateixa carpeta sense trepitjar-se.
3. **Agents per onades.**
   - Els agents no fan commits: el coordinador revisa cada onada, torna a passar les proves i en fa un sol commit.
   - Model per tasca: Opus per al que és crític (multijugador, torns, combat), Sonnet per a feina ben especificada que demana criteri, i Haiku per a canvis mecànics.
4. **Verificació.**
   - A cada onada: `node --check` de tots els `.mjs`, proves de Node de la lògica pura (a l'scratchpad, fora del repo) i comprovació que les plantilles i les `data-action` existeixen.
   - Les proves de joc a Foundry encara no s'han fet: vegeu "Pendent".

## Commits

| Commit | Contingut |
|--------|-----------|
| `156f185` | Revisió i pla (`docs/REVIEW-PLAN.md`); `system.json` amb `"socket": true`. |
| `76bfdbc` | **Onada 1.** Relé del DJ via socket (A2); hooks només al client que toca (A1); ordre de torns estable i `nextTurn` amb una sola escriptura (A3, D5); els PC ja no compten els PX (A4); barres de salut del token (A6); latència de les armadures (B2); càrrega de JSON robusta (D4); estat `dead` (A8); fora les sobreescriptures d'ajudants Handlebars (A7); codi mort eliminat (C4); fitxers LevelDB fora del repo (C7); `build-manual.mjs` ja no esborra les fonts (A5); manual del joc a `docs/manual/`. |
| `01fa086` | **Onada 2.** Regles de combat (WP-F: B1, B3–B7, B9, B10, C2); fitxes amb classe base comuna i fitxa d'objectes (WP-G: D1–D3, D6, C3, C5, B11, B12); atributs d'atac segons el manual (Q1); llista blanca de camps del relé del DJ. |
| `ac8f587` | **Onada 3.** Les cinc regles pendents del manual (WP-I: B13–B17), la documentació (`CLAUDE.md`, README i `system.json`, WP-D3) i el camp `propietats` de les armes, editable a la fitxa d'objecte. |
| `2660bc8` | **Onada 4a.** Identificadors de diàleg únics (`{id}`, D7) i textos fixos passats a claus de traducció (C1). |
| `4c44401` | **Traduccions completes** (WP-D1): `ca.json`, `es.json` i `en.json` amb les mateixes 401 claus. Totes les 386 claus que fa servir el codi hi són. |

## Decisions de disseny

| Tema | Decisió | Font |
|------|---------|------|
| Atribut dels atacs (Q1) | Armes cos a cos: **DES** + armes cos a cos. Arts marcials: **DES**. Barallar-se i armes naturals: **FOR**. Distància: **DES**, excepte les armes llancívoles, que van amb **AGI**. | Manual, "Cos a cos" (l. ~2896) i "A distància" (l. 3024) |
| Armes improvisades | Habilitat *armes improvisades*; si es llancen, AGI. **Interpretació pròpia, pendent de confirmar.** | — |
| Ègides (Q2) | El temps inactiu compta en **ticks del rellotge**. Fora de combat, s'avisa que cal reactivar-la a mà (és una acció lliure). Si el combat s'esborra, les ègides pendents es reactiven. | Oriol FM, 2026-09-27 |
| Diverses armadures (Q3) | La protecció la dona **la millor**; les penalitzacions de latència **s'apilen**. | Oriol FM, 2026-09-27 |
| Empat contra la defensa passiva | N'hi ha prou amb igualar-la (l. 3143). El manual es contradiu a la l. ~2904. | Manual |
| PC gastats | PC gastats = cost total de la fitxa − PX gastats. Els canvis manuals en mode edició compten com a PC. | WP-B |
| Escopetes (B13) | Les armadures rígides (`tipus: "fisica"`) protegeixen el doble contra les armes amb la propietat `escopeta`. La millor armadura es tria després de doblar-la. | Manual, l. 3091 |
| Pífia en esquivar (B14) | +1 de dany per cada 1 de la tirada pifiada. Només en esquivar, només si l'atac impacta, i s'afegeix **abans** de l'ègida, l'armadura i la reducció. **Interpretació pròpia, pendent de confirmar.** | Manual, exemple de la l. 4018 |
| Blocar (B15) | Amb el cos, fa servir resistència i només contra atacs naturals. Amb escut (una arma amb la propietat `escut`), armes cos a cos. Amb un altre objecte, armes improvisades. La bonificació no pot superar la reducció natural. | Manual, l. 3177–3185 |
| Retard de barallar-se (B16) | Cada +1 de latència (un tick) dona +1 dau, fins al nivell de barallar-se. No es pot combinar amb una maniobra d'arts marcials. | Manual, l. 2902 i 2927 |
| Requisits de curació (B17) | Primers auxilis, habilitat ≥ 1; tractament mèdic, ≥ 2. Curar-se un mateix només ho pot fer el DJ (que ja equival a la seva aprovació). | Manual, l. 3486–3502 |
| Glossari de traducció | fita → éxito / hit; pífia → pifia / botch; ègida → égida / aegis; latència → latencia / latency; PX → PX / XP; DJ → DJ / GM; PNJ → PNJ / NPC; guanxi no es tradueix; els codis d'atribut (FOR, DES…) es mantenen iguals en tots els idiomes. | WP-D1 |
| Autoritat del DJ | Els canvis a documents aliens passen pel DJ (`module/xarxa/socket.mjs`), amb una llista de camps permesos (`CAMPS_PERMESOS_PER_TIPUS`). Fora de combat, un jugador només pot treure fatiga o ferides a un actor aliè, no afegir-n'hi. | Seguretat, onada 2 |

## Contractes entre mòduls (per a qui continuï)

- **Relé del DJ** (`module/xarxa/socket.mjs`): `actualitzarComGM(doc, canvis, opcions)`, `crearEmbegutsComGM`, `eliminarEmbegutsComGM`, `alternarEstatComGM`. Per a qualsevol camp nou que un jugador hagi d'escriure en un document aliè, cal afegir-lo a `CAMPS_PERMESOS_PER_TIPUS`.
- **Derivats de salut:** `salut.{fatiga,ferides}.{value,max}` (caselles que queden) i `salut.foraDeCombat` (nivell 7).
- **Armadura equipada:** `system.equipada` (per defecte `true`; qualsevol valor que no sigui `false` compta com a equipada).
- **Atac d'una arma:** `atributIHabilitatAtac(item)` a `module/combat/equipament-automatic.mjs`, a partir de `FORJA.ATAC_PER_CATEGORIA` i `FORJA.ATAC_PER_ARMA`.
- **Rellotge:** `flags.forja.{marcador, actiu, actuats}` a `Combat`; `ForjaCombat#fiDeTorn(combatant)` s'executa al DJ quan acaba un torn; `calcularSeguentTorn` és una funció pura.

## Preguntes obertes per a l'Oriol

1. **Dues armadures.** El manual (l. 3337) permet una flexible sobre una de rígida, i la flexible suma **la meitat** de la seva protecció (arrodonint amunt). La resposta de l'Oriol va ser "la millor, i s'apilen les penalitzacions", que és el que està implementat. Quina de les dues val?
2. **Armes improvisades:** l'habilitat i l'atribut que s'han suposat (vegeu la taula de decisions).
3. **Empat contra la defensa passiva:** la contradicció entre les línies ~2904 i 3143.
4. **Pífia en esquivar:** el dany extra s'aplica abans o després de l'armadura i la reducció?

## Pendent

- **Releases a GitHub:** les adreces `manifest` i `download` de `system.json` no funcionaran fins que es publiqui una release amb `system.json` i `forja.zip`.
- **Regles del manual detectades però no implementades:** l'escut dona +1 a la defensa bàsica (l. 2985/3153); la integritat estructural de l'escut en blocar; la pífia de les armes de dispersió ("Perilloses").
- **Retard de barallar-se:** la tirada sense objectiu (`ferTirada`) no hi suma els daus del retard.
- **Traducció de les dades de joc:** els noms i descripcions dels catàlegs (`module/config/dades/*.json`: trets, armes, armadures, artefactes, maniobres) només són en català. Traduir-los demana decidir un mecanisme (claus i18n per entrada, o una capa de localització dels catàlegs).
- **Claus sense ús:** 15 claus de `ca.json` no les fa servir cap codi, probablement restes de la interfície antiga (`FORJA.Tab.*`, `FORJA.Hab.Marca`, `FORJA.Tret.Cost`…). Es mantenen traduïdes; es poden esborrar si es confirma que no calen.
- **Proves de joc** en un Foundry v13 sense pantalla en aquesta màquina, amb Playwright i dues sessions (DJ i jugador). Cal la clau de llicència i l'enllaç temporal de descàrrega.
- **graphify** de tot el projecte, en acabar.
- **Temes menors apuntats pels agents:**
  - Els camps numèrics opcionals dels artefactes es desen com a `0` quan es buiden.
  - La icona de concentració del tracker pot trigar a refrescar-se.
  - Si el relé rebutja una escriptura, l'atac s'atura sense missatge al xat.
