# Control de versions

Com es numeren i es tanquen les versions del sistema FORJA, per no perdre l'ordre del que es va fent.

## Numeració

Versionat semàntic: `MAJOR.MINOR.PATCH`.

| Canvi | Quan | Exemple |
|-------|------|---------|
| **PATCH** (`0.4.0 → 0.4.1`) | Correccions d'errors, textos, traduccions. No canvia el comportament esperat ni les dades. | Una icona que no existeix, un càlcul mal arrodonit. |
| **MINOR** (`0.4.x → 0.5.0`) | Funcionalitats noves o regles noves. | El moviment en temps actiu, la defensa automàtica. |
| **MAJOR** (`0.x → 1.0.0`) | Primera versió estable per jugar-hi, o canvis que trenquen mons existents quan ja som a 1.x. | — |

Mentre som a `0.x`, una MINOR pot trencar la compatibilitat de mons existents (camps nous, tokens que canvien). Quan passi, s'ha d'indicar a la secció **Atenció** del `CHANGELOG.md`.

La versió és la mateixa a `system.json` (la que veu Foundry) i a `package.json`. La prova `tests/unitaris/versio.test.mjs` falla si no coincideixen o si la versió no té entrada al `CHANGELOG.md`.

## Mentre es treballa

- Els commits es fan a la branca de treball (ara `Aw`), amb missatges en català que diguin què canvia i per què.
- **Cada canvi que notaria un usuari** s'apunta a la secció `## [Pendent]` del `CHANGELOG.md`, dins de *Afegit*, *Canviat*, *Corregit*, *Eliminat*, *Seguretat* o *Atenció*.
- El detall tècnic i les decisions de disseny van a `docs/REGISTRE-TREBALL.md`.
- Abans de fer commit: `npm test` (proves unitàries). Si el canvi toca el joc, també les proves de Foundry (`tests/joc/`).

## Tancar una versió

```bash
npm test
npm run versio -- minor        # o patch, major, o una versió exacta: 0.5.0
# revisa package.json, system.json i CHANGELOG.md
git add package.json system.json CHANGELOG.md
git commit -m "Versió 0.5.0"
git tag -a v0.5.0 -m "Versió 0.5.0"
```

L'script `scripts/versio.mjs`:

1. calcula la versió nova i l'escriu a `package.json` i `system.json`;
2. converteix la secció `Pendent` del `CHANGELOG.md` en `[0.5.0] - data` i en deixa una de nova buida;
3. **en les versions MINOR i MAJOR, actualitza el graf de coneixement amb graphify** (`graphify update .`, local i sense cost d'API). El resultat queda a `graphify-out/`, que no va a git;
4. no fa cap commit ni cap etiqueta: mostra les ordres perquè es pugui revisar abans.

S'atura si la secció `Pendent` és buida o si la versió nova no és més gran que l'actual.

## Etiquetes

Cada versió té una **etiqueta anotada** (`git tag -a vX.Y.Z`) al commit on es tanca. Per tornar a una versió: `git checkout v0.4.0`. Per veure què va canviar entre dues versions: `git log v0.3.0..v0.4.0` o `git diff v0.3.0 v0.4.0`.

| Etiqueta | Commit | Nota |
|----------|--------|------|
| `v0.2.0` | `f972f65` | Estat del repositori abans de la revisió. |
| `v0.3.0` | `2b34cde` | Final de la revisió (onades 1–4). Etiqueta posada a posteriori: en aquell commit els fitxers encara deien 0.2.0. |
| `v0.4.0` | commit "Versió 0.4.0" | Primera versió tancada amb aquest procediment. |

Les etiquetes són locals fins que es pugen (`git push origin --tags`). Una release de GitHub amb `system.json` i `forja.zip` és el que fa funcionar les adreces `manifest` i `download` de `system.json`.
