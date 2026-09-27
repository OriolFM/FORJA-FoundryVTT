# Proves del sistema FORJA

Com es prova el sistema, què cobreix cada prova, com s'executa i quins resultats ha donat. Els canvis del codi són al registre de la branca ([`REGISTRE-TREBALL.md`](REGISTRE-TREBALL.md)).

## Els tres nivells

| Nivell | Què comprova | Com s'executa | Temps |
|--------|--------------|---------------|-------|
| **1. Sintaxi** | Que cap mòdul tingui errors de sintaxi. | `for f in $(git ls-files '*.mjs'); do node --check "$f"; done` | Segons |
| **2. Proves unitàries** | La lògica pura (càlculs, regles, torns, relé, traduccions, versions) sense Foundry. | `npm test` | Segons |
| **3. Proves de joc** | El sistema funcionant dins un **Foundry real**, amb dues persones connectades (DJ i Jugador): permisos, diàlegs, combat, moviment. | `node tests/joc/<bateria>.mjs` | 10–30 min per bateria |

**Quan executar què:**
- **Abans de cada commit que toqui `module/`:** nivells 1 i 2.
- **Abans de tancar una versió, o si el canvi toca el joc** (combat, fitxes, moviment, socket): també el nivell 3, a la v13 i a la v14.

---

## 2. Proves unitàries (`tests/unitaris/`)

Fitxers `*.test.mjs` que s'executen amb el runner de Node (`node --test`), Node ≥ 20. No carreguen Foundry. Substitueixen `foundry`, `CONFIG`, `game` i `fetch` pel mínim necessari i importen els mòduls reals del sistema (no còpies).

| Fitxer | Què prova |
|--------|-----------|
| `combat-wpf.test.mjs` | Dany (ègida → armadura → reducció, dany mínim), protecció d'armadures, ègides per ticks, concentració, abast de vora a vora, bandes de rang, opcions de defensa. |
| `regles-manual-wpi.test.mjs` | Escopetes (B13), pífia en esquivar (B14), mitjans de blocar (B15), retard de barallar-se (B16), requisits de curació (B17), propietats d'arma, exemples de dues armadures del manual (Von Blum 7, Bauer 2). |
| `defensa-automatica.test.mjs` | Tria automàtica de la defensa dels PNJ. |
| `torns.test.mjs` | Ordre de torns del rellotge, empats i el cas "A i B a 0, A declara 5, el següent és B". |
| `socket.test.mjs` | Relé del DJ: camps permesos i rebutjats, estats, dany fora de combat, peticions del DJ. |
| `derivats.test.mjs` | PC i PX, barres de salut, `foraDeCombat`, latència d'armadures. |
| `moviment.test.mjs` | Distàncies, bloqueig segons mida i bàndol, permís acumulatiu per torn, càrrega, A* (voreja, bloquejat del tot, destinació ocupada, límit de nodes). |
| `i18n.test.mjs` | Els tres fitxers de `lang/` tenen les mateixes claus; totes les claus que fa servir el codi existeixen; els `{placeholders}` coincideixen. |
| `versio.test.mjs` | `system.json` i `package.json` tenen la mateixa versió, i aquesta té entrada al `CHANGELOG.md`. |

**Resultat actual:** 9 fitxers, 27 proves de primer nivell (el fitxer de moviment n'agrupa 19) i unes 250 comprovacions, totes OK.

Els missatges `FORJA | No s'ha pogut carregar …` en executar-les són esperats: el `fetch` dels catàlegs JSON està desactivat.

---

## 3. Proves de joc (`tests/joc/`)

### Entorn

Tot corre en aquesta màquina, **sense pantalla**:

| Peça | v13 | v14 |
|------|-----|-----|
| Foundry (build NodeJS) | `~/foundry/v13` (13.351) | `~/foundry/v14` (14.368) |
| Node del servidor | 22 | 24 (via nvm; el per defecte continua sent el 22) |
| Carpeta de dades | `~/foundrydata` | `~/foundrydata14` (separada perquè el món de la v13 no es migri) |
| Sistema | enllaç simbòlic `Data/systems/forja` → el repo | ídem |
| Món de proves | `proves-forja` | `proves-forja` |

- **Navegador:** Chromium de snap (`/snap/bin/chromium`), controlat amb Playwright (dependència de desenvolupament del repo). El Chromium que baixa Playwright necessita llibreries que la màquina no té. Es pot canviar amb `FORJA_CHROMIUM`.
- **Credencials:** res no va a git.
  - La contrasenya d'administrador del servidor és aleatòria i es desa a `~/foundry/proves/.admin` (permisos 600; ruta canviable amb `FORJA_ADMIN_FILE`).
  - La clau de llicència es llegeix d'un fitxer privat indicat amb `FORJA_CLAU`.
- **Captures de pantalla:** a `~/foundry/proves/captures` (canviable amb `FORJA_CAPTURES`), fora del repo.

### Preparació (un sol cop per versió)

```bash
# servidor (v13 amb Node 22; v14 amb Node 24 i --dataPath=$HOME/foundrydata14)
node ~/foundry/v13/main.js --dataPath=$HOME/foundrydata --adminPassword="$(cat ~/foundry/proves/.admin)"

FORJA_CLAU=<fitxer privat amb la clau> node tests/joc/activar.mjs   # EULA i llicència
node tests/joc/mon.mjs       # crea el món proves-forja (v13: /setup; v14: /create)
node tests/joc/llancar.mjs   # llança el món, hi entra com a DJ i comprova que FORJA carrega sense errors
```

### Execució

```bash
node tests/joc/proves.mjs            # general (també: npm run test:joc)
node tests/joc/proves-combat.mjs     # combat
node tests/joc/proves-moviment.mjs   # moviment
```

Cada bateria escriu un JSON amb el resultat de cada prova (`ok`, `detall`) i els errors de consola de les dues sessions. També n'escriu el progrés (`OK`/`KO` per prova) a la sortida d'errors.

**Després de provar:** en obrir el compendi del manual, Foundry reescriu `packs/manual` (LevelDB). Cal aturar el servidor i restaurar-lo (esborrar els fitxers nous de `packs/manual` i fer `git checkout -- packs/manual`) abans de fer commit.

### Com estan fetes (tècniques)

- **Dues sessions reals.** Dos contextos de navegador independents entren com a `Gamemaster` i com a `Jugador` (usuari amb rol de jugador, propietari només del PJ). Així es proven de veritat els permisos i el relé del DJ.
- **Entrar al món** (`comu.mjs`, `unirse`): a la v13 es tria l'usuari d'una llista; a la v14 s'escriu. Després es tanca la finestra de "tria de personatge" que Foundry obre al jugador la primera vegada.
- **Clics a la interfície.** Els botons del tracker i de les fitxes es premen amb `dispatchEvent("click")`, que dispara les accions d'ApplicationV2. Els formularis dels diàlegs s'envien amb `requestSubmit` i **el botó del mateix diàleg** (el primer botó *submit* del formulari és el de la capçalera de la finestra).
- **Esperes per polling.** Amb el canvas renderitzat per programari, Foundry va molt lent i les esperes de Playwright basades en `requestAnimationFrame` gairebé no avancen. Les proves comproven l'estat cada mig segon (`esperarElement`, `esperarQue`) fins a un límit. Hi ha un límit per prova (`FORJA_LIMIT_PROVA`, 4 min per defecte), i les captures de pantalla no poden bloquejar la bateria.
- **Daus forçats** (regles deterministes): es substitueix `CONFIG.Dice.randomUniform` per una cua de valors. Foundry calcula la cara com `ceil((1 − r) · 10)`, així que per obtenir la cara `c` es fa servir `r = (10.5 − c) / 10`.
- **Tokens com al joc real:** es creen a partir del token prototip de l'actor (`actor.getTokenDocument()`), com quan s'arrossega un actor al canvas. Així el PJ queda enllaçat i els PNJ no.
- **Lectura del resultat:** cada dada es llegeix a la sessió que la rep abans. Per exemple, el que canvia el jugador en el seu propi actor es llegeix a la seva sessió, perquè la del DJ el rep amb retard en aquesta màquina.
- **Torn actiu:** per donar el torn a un combatent, la prova fa el mateix que el sistema: `flags.forja.actiu` i l'índex `turn`.

### Bateries i resultats

#### General (`proves.mjs`)

| # | Prova | v13 | v14 |
|---|-------|-----|-----|
| 1 | Crear PJ i PNJ amb dos clients connectats: exactament un "Cop" cadascun | OK | OK |
| 2 | Les fitxes de PJ, PNJ i objecte s'obren sense errors | OK | OK |
| 3 | Barres de salut del token (`value`/`max`) | OK | OK |
| 4 | Gastar PX no consumeix PC | OK | OK |
| 5 | Marcar un actor com a derrotat (`dead`) | OK | OK |
| 6 | Ordre de torns amb empat; reaccions reiniciades per a qui acaba | OK | OK |
| 7 | Un jugador ataca un PNJ aliè: dany aplicat a través del DJ | OK | OK |
| 8 | Un jugador fa gastar una reacció a un actor aliè a través del DJ | OK | OK |
| 9 | Seguretat: el relé rebutja camps no permesos | OK | OK |
| 10 | Cap clau `FORJA.*` sense traduir en ca, es ni en | OK | OK |

#### Combat (`proves-combat.mjs`)

| # | Prova | v13 | v14 |
|---|-------|-----|-----|
| U0 | El PJ neix amb el token enllaçat; el PNJ no | OK | OK |
| U1 | Tracker: el jugador només veu els controls del seu combatent; tothom veu el marcador | OK | OK |
| U2 | Declarar un atac amb "Cop" i concentració (diàleg real) | OK | OK |
| U3 | Resoldre l'atac contra el PNJ: el diàleg de defensa s'obre **al DJ**; atac al xat; concentració gastada | **KO** | **KO** |
| U6 | PNJ amb defensa automàtica: no pregunta a ningú i l'atac es resol sol | OK | OK |
| U4 | Diàleg de curació des de la fitxa | OK | OK |
| U5 | Diàleg de tirada (atribut + habilitat) | OK | OK |
| R1 | Escopeta contra armadura rígida (protecció doblada) | OK | OK |
| R2 | Dues armadures: 3 + ⌈3/2⌉ = 5 | OK | OK |
| R3 | Pífia en esquivar: +1 per cada 1 | OK | OK |
| R4 | Concentració trencada pel dany; dany > FOR → atordit | OK | OK |
| R5 | Maniobra d'arts marcials: +dificultat i estat | OK | OK |
| R6 | Mitjans de blocar segons l'arma i l'escut | OK | OK |
| R7 | Retard de barallar-se: +1 dau per tick | OK | OK |
| R8 | Penalització de salut i bloqueig a nivell 7 | OK | OK |
| R9 | Ègida trencada i reactivada al tick | OK | OK |
| R10 | Abast cos a cos amb tokens de 2×2 | OK | OK |

**U3, en investigació:** el diàleg de defensa arriba al DJ i el DJ l'envia, però l'atac no apareix al xat dins l'espera de la prova. En una execució anterior la causa va ser que el DJ no confirmava a temps l'aplicació del dany, i per això l'atac ja no es perd (surt al xat amb una nota) i el temps d'espera del relé ha passat a 30 s. Ara s'està analitzant amb una prova dedicada amb registres complets.

#### Moviment (`proves-moviment.mjs`)

Escena quadrada, 100 px i 1 m per casella; PJ amb AGI 3 i MID 3 (caminar 6 m).

| # | Prova | v13 | v14 |
|---|-------|-----|-----|
| M1 | Fitxa: caminar 6, córrer 15, saltar 9 | OK | OK |
| M2 | Fora del seu torn, el jugador no pot moure el token | OK | OK |
| M3 | En el seu torn: 2 + 3 + 1 = 6 m permesos; 1 m més, bloquejat | OK | OK |
| M4 | Un aliat de mida 3 al mig: el camí el voreja | OK | OK |
| M5 | Un aliat de mida 2 al mig: es travessa en línia recta | OK | OK |
| M6 | Un enemic de mida 2 al mig: el camí el voreja | OK | OK |
| M7 | No es pot acabar el moviment sobre un altre token | OK | OK |
| M8 | Un mort de mida 3 no bloqueja | OK | OK |
| M9 | Una paret al mig: el camí la voreja | OK | OK |
| M10 | El DJ mou sense límit i fora del torn | OK | OK |

### Errors del sistema trobats gràcies a aquestes proves

| Error | Correcció |
|-------|-----------|
| La icona de l'estat *sagnant* no existeix a Foundry | `icons/svg/blood.svg` |
| Els PJ es creaven amb el token no enllaçat | `ForjaActor#_preCreate` |
| El diàleg de defensa del PNJ s'obria al jugador que ataca | `decisio-defensa.mjs` i preguntes pel socket |
| El camí no vorejava una paret | Sense retallar cantonades en diagonal |
| Un atac es perdia si el relé no responia | Nota al xat; espera de 30 s |

### Afegir una prova

1. **On posar-la:** a la bateria que toqui, amb `await prova("Nom", async () => { … })`. La funció ha de llançar un error si el resultat no és l'esperat, i retornar un objecte amb el detall si ho és.
2. **Preparació:** com a DJ (`dj.evaluate`). Les accions del jugador, a la seva sessió (`jug.evaluate` o clics).
3. **Esperes:** amb `esperarElement` i `esperarQue`, no amb les esperes de Playwright.
4. **Daus:** si la regla depèn dels daus, amb `window.__daus(...)`.
5. **Documentació:** afegir-la a la taula d'aquest document i, quan es passi, el resultat a v13 i v14.
