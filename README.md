# FORJA RPG — Sistema per a Foundry VTT

Sistema oficial de **FORJA RPG** per a [Foundry Virtual Tabletop](https://foundryvtt.com/),
amb pool de daus d10 i un combat sense tirada d'iniciativa: un rellotge de
temps actiu on cada combatent ocupa una posició i avança segons la latència
de les seves accions.

## Característiques

- Fitxes de **Personatge Jugador** i **PNJ** (`ApplicationV2`), amb mode joc
  (tirades ràpides clicant atributs/habilitats/armes) i mode edició.
- Objectes (**trets**, **armes**, **armadures**, **artefactes**) amb fitxa
  pròpia per tipus.
- Combat basat en el **rellotge de temps actiu**: sense iniciativa amb daus,
  pipeline complet d'atac → defensa (passiva/esquivar/parar/blocar) → dany
  (ègida → armadura → reducció), reaccions, concentració i maniobres d'arts
  marcials.
- **Relé d'autoritat del DJ**: les accions d'un jugador que afecten documents
  d'altri (dany a un PNJ, avançar el rellotge de combat...) es resolen de
  forma segura encara que el jugador no en sigui propietari.
- **Defensa dels PNJ decidida pel DJ** (amb un diàleg que li arriba a ell), o
  **automàtica** per als figurants (passiva, la millor activa, esquivar,
  parar o blocar).
- **Moviment en temps actiu**: distàncies de caminar, córrer i saltar;
  moviment només en el propi torn, amb la distància acumulada; bloqueig entre
  tokens segons la mida i el bàndol; camí que voreja parets i tokens;
  càrrega.
- Compendi **Manual FORJA** (JournalEntry) generable des dels capítols en
  Markdown del manual complet.
- Interfície en **català, castellà i anglès**, amb les mateixes claus als
  tres idiomes (el català és la font).

## Instal·lació

**Via manifest** (recomanat un cop hi hagi releases publicades): a Foundry,
"Game Systems" → "Install System" → enganxa la URL del manifest:

```
https://github.com/OriolFM/FORJA-FoundryVTT/releases/latest/download/system.json
```

**Manual / desenvolupament**: copia o fes un enllaç simbòlic d'aquest
repositori a la carpeta de dades de Foundry:

```
{FoundryData}/Data/systems/forja
```

i reinicia Foundry (o recarrega la llista de sistemes).

## Compatibilitat

Foundry VTT **v13–v14** (`compatibility.minimum: "13"`,
`compatibility.verified: "14"` a `system.json`).

## Idiomes

Català (`lang/ca.json`, font), castellà (`lang/es.json`) i anglès
(`lang/en.json`).

## Desenvolupament

Aquest sistema no té pas de compilació: Foundry serveix els `.mjs`, `.hbs` i
`.css` directament. Només cal Node.js per generar el compendi del manual.

```bash
npm install
FORJA_MD_DIR=/ruta/als/capitols/markdown npm run build:manual
```

`build:manual` regenera `packs/_source/manual/*.json` a partir de capítols en
Markdown i compila el compendi LevelDB a `packs/manual/`. Vegeu
[`CLAUDE.md`](CLAUDE.md) per als detalls de l'script.

### Proves

```bash
npm test                              # proves unitàries (segons)
node tests/joc/proves.mjs             # proves de joc en un Foundry real (vegeu docs/PROVES.md)
```

### Versions

Versionat semàntic. Els canvis de cada versió són a [`CHANGELOG.md`](CHANGELOG.md),
i el procediment per tancar-ne una a [`docs/VERSIONS.md`](docs/VERSIONS.md)
(`npm run versio -- minor`).

Documentació addicional:
- [`CLAUDE.md`](CLAUDE.md) — arquitectura del codi, convencions, com provar.
- [`docs/REVIEW-PLAN.md`](docs/REVIEW-PLAN.md) — revisió de codi i pla de
  treball per paquets.
- [`docs/REGISTRE-TREBALL.md`](docs/REGISTRE-TREBALL.md) — **registre de tots
  els canvis de la branca**, decisions de disseny, troballes i pendents.
- [`docs/PROVES.md`](docs/PROVES.md) — totes les proves: què proven, com es
  fan, com s'executen i resultats (Foundry v13 i v14).
- [`CHANGELOG.md`](CHANGELOG.md) i [`docs/VERSIONS.md`](docs/VERSIONS.md) —
  canvis per versió i control de versions.
- [`docs/manual/FORJA_FC001CA_CORE.md`](docs/manual/FORJA_FC001CA_CORE.md) —
  manual complet del joc, font de veritat de totes les regles.

## Crèdits

FORJA RPG — autor: **Oriol FM**.

---

## English summary

Official Foundry VTT system for **FORJA RPG**, a d10 dice-pool game with
initiative-less combat driven by an active-time clock. Compatible with
Foundry VTT v13–v14. Install via the manifest URL above once releases are
published, or copy/symlink this repository into
`{FoundryData}/Data/systems/forja` for development. No build step is
required to run the system; `npm install` + `npm run build:manual`
(with `FORJA_MD_DIR` pointing at the manual's Markdown chapters) regenerates
the in-game manual compendium. `npm test` runs the unit tests; live gameplay
tests against a headless Foundry v13/v14 are described in
[`docs/PROVES.md`](docs/PROVES.md). See [`CLAUDE.md`](CLAUDE.md) for the
architecture, [`CHANGELOG.md`](CHANGELOG.md) for changes per version, and
[`docs/REGISTRE-TREBALL.md`](docs/REGISTRE-TREBALL.md) for the detailed work
log of the current branch. Author: Oriol FM.
