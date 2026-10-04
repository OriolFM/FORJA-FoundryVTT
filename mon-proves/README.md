# Món de proves: FORJA betatest

Còpia del món on es fan les proves manuals del sistema (`forja-betatest`) i de les imatges que fa servir. Serveix perquè tothom provi amb el mateix món i perquè hi anem afegint el contingut del manual.

| Carpeta | Contingut |
|---------|-----------|
| `forja-betatest/` | El món de Foundry (bases de dades LevelDB a `data/`). |
| `assets/` | Imatges dels tokens i retrats: Aracnid, Marvin, Necrogolem, Trace i Yoko-1. |

**La configuració del món (`data/settings/`) no és al repositori, i no s'hi ha de posar mai:** hi ha claus privades, com la de FORJAPP. Foundry la crea buida en obrir el món; cadascú hi posa les seves claus.

## Què hi ha ara (2026-10-04)

- **Versió de Foundry:** **v14** (14.368). Ja està migrat: no s'obre amb la v13.
- **Usuari:** `Gamemaster` (DJ), sense contrasenya.
- **Actors:**
  - **Yoko-1** (personatge): Cop, Espases i Fulla curta.
  - **Gòlem de carn** (PNJ): Urpes i Cop.
- **Escena «Prova»:** graella hexagonal, amb un token de cada.
- **Combat:** un combat de proves en curs a «Prova». Es pot acabar i començar-ne un de nou.
- **Xat:** uns 330 missatges de les proves de combat. Es pot buidar sense problema.
- **Mòduls:** cap d'activat. El de traducció al català (`foundry-vtt-catala`) és opcional.

**Pendent:** afegir-hi tots els PJ, PNJ, criatures, animals, artefactes i efectes del manual. La llista és a [`../docs/REGISTRE-TREBALL.md`](../docs/REGISTRE-TREBALL.md), a «Pendent».

## Com fer-lo servir

La carpeta de dades de Foundry és la que surt a *Configuració → Dades d'usuari*:
- **Windows (aplicació):** `%LOCALAPPDATA%\FoundryVTT\Data`
- **Linux:** normalment `~/.local/share/FoundryVTT/Data`, o la que indiqui `--dataPath`.

Hi ha dues coses a fer, un sol cop.

### 1. El sistema: un enllaç cap al repositori

Així Foundry llegeix el codi directament del repositori, i n'hi ha prou amb F5 per veure els canvis.

```powershell
# Windows (no cal ser administrador)
New-Item -ItemType Junction -Path "$env:LOCALAPPDATA\FoundryVTT\Data\systems\forja" -Target "<ruta del repositori>"
```
```bash
# Linux
ln -s "<ruta del repositori>" ~/.local/share/FoundryVTT/Data/systems/forja
```

### 2. El món i les imatges: una còpia

**Copia** el món, no l'enllacis. Foundry hi escriu contínuament mentre jugues, i amb un enllaç el repositori s'ompliria de canvis.

```powershell
# Windows, amb Foundry tancat
robocopy "mon-proves\forja-betatest" "$env:LOCALAPPDATA\FoundryVTT\Data\worlds\forja-betatest" /E
Copy-Item "mon-proves\assets\*.png" "$env:LOCALAPPDATA\FoundryVTT\Data\assets\"
```
```bash
# Linux, amb Foundry tancat
cp -r mon-proves/forja-betatest ~/.local/share/FoundryVTT/Data/worlds/
mkdir -p ~/.local/share/FoundryVTT/Data/assets && cp mon-proves/assets/*.png ~/.local/share/FoundryVTT/Data/assets/
```

Si ja tens un món `forja-betatest`, el substitueix. Fes-ne una còpia abans si hi tens canvis teus.

Després, obre Foundry i llança el món **FORJA betatest**.

## Com desar els canvis al repositori

Quan hagis afegit contingut al món (actors, objectes, escenes…) i el vulguis compartir:

1. **Tanca el món** (o Foundry sencer), perquè la base de dades quedi escrita del tot.
2. Copia'l de tornada al repositori, sense els fitxers de bloqueig:
   ```powershell
   robocopy "$env:LOCALAPPDATA\FoundryVTT\Data\worlds\forja-betatest" "mon-proves\forja-betatest" /MIR /XF LOCK LOG LOG.old
   ```
   ```bash
   rsync -a --delete --exclude LOCK --exclude 'LOG*' --exclude settings ~/.local/share/FoundryVTT/Data/worlds/forja-betatest/ mon-proves/forja-betatest/
   ```
3. Si has afegit imatges noves, copia-les també a `mon-proves/assets/`.
4. Commit, i anota què has afegit a «Què hi ha ara» d'aquest fitxer.

**Només una persona alhora** ha de desar canvis al món: les bases de dades LevelDB no es poden fusionar amb git. Si dues persones l'han modificat, cal triar-ne una còpia i refer els canvis de l'altra dins de Foundry.

## Proves automàtiques contra aquest món

Les proves de joc de `tests/joc/` creen el seu propi món (`proves-forja`). Per provar contra aquest món des de Windows, amb l'aplicació d'Electron oberta, vegeu [`../docs/PROVES.md`](../docs/PROVES.md), a «Proves contra el Foundry local (Windows)».
