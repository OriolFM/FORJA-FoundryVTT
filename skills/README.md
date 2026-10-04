# Skills de referència de FORJA

Còpia dels skills de Claude que fem servir per calcular i validar el contingut de FORJA, tal com eren el 2026-10-04. Són la referència per comprovar que els creadors del sistema de Foundry calculen el mateix.

| Carpeta | Què és |
|---------|--------|
| `forja-parametres/` | Cost, dificultat i latència d'**artefactes i efectes** amb la taula de paràmetres del manual v3 (cap. 4), revisada el 2026-10-04. `SKILL.md` són les regles; `motor/forja_parametres.py` és el càlcul; `motor/plantilles.py` té les 83 plantilles del manual (18 artefactes i 65 efectes) amb els seus paràmetres; `motor/run.py` les comprova totes (`python run.py` des de `motor/`). Substitueix el skill antic `forja-artefactes`, que no s'inclou perquè fa servir taules que no són les del manual v3. |
| `forja-creator/` | Creació i validació de **PJ, PNJ, criatures i animals** (costos d'atributs, espècie, mida, constitució, habilitats i trets; derivats). **Atenció:** vegeu més avall, té taules desfasades. |

## Cal comprovar que els creadors de Foundry coincideixen amb aquests skills

Quan es canviï una regla de creació, o quan es toqui algun d'aquests fitxers, cal verificar que tots dos costats donen el mateix resultat. Si no coincideixen, mana el manual (`docs/FORJA_FC001CA_CORE.md`): corregiu el costat que estigui malament i anoteu-ho a `docs/REGISTRE-TREBALL.md`.

| Skill | Al projecte |
|-------|-------------|
| `forja-parametres` | `module/config/dades/parametres.json` (taula de paràmetres), `module/progressio/construccio.mjs` (càlcul) i `module/apps/dialeg-constructor.mjs` (constructor). Dades: `module/config/dades/artefactes.json` i `efectes.json`. |
| `forja-creator` | `module/config/constants.mjs` (`COST_ATRIBUT`, `COST_ESPECIE`, `COST_MIDA`, `COST_CONSTITUCIO`, `COST_HABILITAT`), `module/config/dades/trets.json` i `module/data/actor-personatge.mjs` (`_prepararDerivats`). |

### Estat de la comprovació (2026-10-04)

**Artefactes i efectes (`forja-parametres`):**
- **Dades:** les 83 plantilles de `plantilles.py` coincideixen amb `artefactes.json` i `efectes.json` en cost, dificultat i latència. L'única diferència és de nom: «Cibermòdem d'interfície neural» al skill, «…neural directa» al manual i al projecte.
- **Taula de paràmetres:** `parametres.json` té els mateixos valors que el skill (abast, objectius, durada, ús, ritual +10 de latència, dany, curació, protecció, habilitats amb autoeina 5/nivell, els 20 estats, percepció, alteració, transformació, translocació, mentals, telecinesi, replicació i invocació).
- **Pendent al constructor del projecte** (`construccio.mjs` i el diàleg). Li falta el que el skill sí que té, i per això encara no pot reproduir totes les plantilles:
  - recàrrega (−2 PC per unitat d'espera) i acumulador (+3 PC per càrrega addicional);
  - armes i armadures bàsiques a cost 0, pagant només el que s'hi afegeix (dany o protecció per sobre de la base, latència per sota);
  - dificultat declarada (±5 PC per punt respecte de la calculada) i latència declarada (±2 PC per punt, límit ±12, latència final entre 2 i 24). Ara el projecte només puja automàticament la dificultat a 1;
  - excepció dels artefactes permanents (poden tenir dificultat inferior a 1);
  - diversos paràmetres del mateix grup alhora: diverses capacitats mentals (Sonda neural), atribut i tret a l'alteració (Vestit lleuger de reconeixement).
  - Proposta: una prova unitària que reprodueixi les 83 plantilles de `plantilles.py` amb `calcularConstruccio` i comprovi el cost, la dificultat i la latència.

**PJ, PNJ, criatures i animals (`forja-creator`):**
- **El projecte coincideix amb el manual v3:**
  - atributs: −5 / 0 / 10 / 20 / 30 / 50;
  - mida i constitució: −20 / −10 / 0 / 10 / 20;
  - habilitats: n(n+1)/2;
  - espècies: animal −15, mecanoide 20…;
  - trets: tots els costos de `trets.json` coincideixen amb el manual.
  - Exemple de comprovació: la Yoko-1 del manual surt a 200 PC, exactament.
- **El skill `forja-creator` està desfasat:** fa servir les taules antigues d'atributs (0 / 0 / 10 / 30 / 60 / 100), mida (−10 / −5 / 0 / 10 / 25) i constitució (−5 / 0 / 0 / 10 / 25). Amb aquestes taules, la Yoko-1 sortiria a 225 PC en lloc de 200. **Cal corregir el skill** (`references/regles.md` i `scripts/forja_creator.py`) amb les taules del manual v3 abans de fer-lo servir per crear o validar personatges. Els trets i les espècies del skill sí que són correctes.

## Com actualitzar aquesta còpia

Els skills originals es mantenen a Claude (i el motor de `forja-parametres`, també a `FORJA_RPG/FORJA_CORE/forja-parametres/`). Quan es corregeixin, torneu-los a copiar aquí i actualitzeu la secció «Estat de la comprovació». Aquests fitxers no contenen cap secret, i no n'hi ha de posar cap: el repositori és públic.
