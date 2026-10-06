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
| `estats.test.mjs` | Regles dels estats (Fase 1): què pot fer cada estat (actuar, moure's, córrer, esquivar, defensa activa, concentrar-se), tipus d'acció i moviments bloquejats, latència d'abatut, reacció de vigilant, inconscient/incapacitat per salut, Recuperació/X (pista i pas del nivell 7 al 6), tirada d'atrapat. `combat-wpf.test.mjs` hi afegeix les opcions de defensa amb estats. |
| `construccio.test.mjs` | Constructor d'efectes i artefactes (Fase 2): reprodueix el cost, la dificultat i la latència de les 83 plantilles del manual (`parametres` de `artefactes.json` i `efectes.json`); dificultat i latència declarades, recàrrega, acumulador, armes i armadures base, compatibilitat amb la selecció antiga. |
| `experiencia.test.mjs` | Repartir PX (Fase 4): taula de recompenses, virtuts repetides, historial. |
| `contingut.test.mjs` | Compendis (Fase 5): nombre de documents de cada compendi i, per a cada PJ, PNJ, animal i criatura, cost en PC i derivats (latència, defensa, reducció de dany) iguals que al manual. |
| `modes-tret.test.mjs` | Modes de tret i àrees (Fase 6): modes per propietats, regles d'àrea, abast (rang mitjà, 15 m), dany de la fuga. |
| `i18n.test.mjs` | Els tres fitxers de `lang/` tenen les mateixes claus; totes les claus que fa servir el codi existeixen; els `{placeholders}` coincideixen. |
| `versio.test.mjs` | `system.json` i `package.json` tenen la mateixa versió, i aquesta té entrada al `CHANGELOG.md`. |
| `secrets.test.mjs` | Cap fitxer del repositori conté claus d'API, tokens ni claus privades (el repositori és públic). |

**Resultat actual (2026-10-06):** 16 fitxers, 78 proves de primer nivell, totes OK.

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
| U3 | Resoldre l'atac contra el PNJ: el diàleg de defensa s'obre **al DJ**; atac al xat; concentració gastada | *(a repetir)* | OK |
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

**U3, resolta (no era un error del sistema).** El diàleg arriba al DJ, el DJ tria i l'atac surt al xat amb 5 daus i la concentració gastada. En aquesta màquina, però, la resposta del DJ triga més dels 30 s que esperava la prova. Ara la prova espera fins a 200 s. U6 ara espera que el jugador vegi la configuració de defensa automàtica abans de resoldre. A la v14 dona 17/17; a la v13 s'ha de repetir la bateria amb aquestes esperes.

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

**Historial de resultats:** v13 — general 10/10, combat 16/17 (U3 per l'espera), moviment 10/10. v14 — general 10/10, combat 17/17, moviment 10/10.

### Afegir una prova

1. **On posar-la:** a la bateria que toqui, amb `await prova("Nom", async () => { … })`. La funció ha de llançar un error si el resultat no és l'esperat, i retornar un objecte amb el detall si ho és.
2. **Preparació:** com a DJ (`dj.evaluate`). Les accions del jugador, a la seva sessió (`jug.evaluate` o clics).
3. **Esperes:** amb `esperarElement` i `esperarQue`, no amb les esperes de Playwright.
4. **Daus:** si la regla depèn dels daus, amb `window.__daus(...)`.
5. **Documentació:** afegir-la a la taula d'aquest document i, quan es passi, el resultat a v13 i v14.

---

## 4. Proves contra el Foundry local (Windows)

Per provar canvis al mateix Foundry on juga l'Oriol (l'aplicació d'Electron a Windows), sense tancar-li la sessió. Es va fer servir el 2026-10-04 per verificar els canvis de combat d'aquella sessió.

### Com funciona

- L'aplicació d'Electron també té un servidor a `http://localhost:30000`.
- [`tests/joc/local.mjs`](../tests/joc/local.mjs) hi entra com a **segon client** del mateix usuari DJ (`Gamemaster`), amb Playwright i l'**Edge** de Windows sense pantalla (no cal baixar cap navegador).
- El segon client carrega el codi actual del repositori. El de l'Oriol no, fins que fa F5.
- **Instal·lació:** `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install`.

```js
import { obrir } from "./local.mjs";
const { b, p, errors } = await obrir();
console.log(await p.evaluate(() => game.combats.map(c => [c.marcador, c.combatant?.name])));
await b.close();
```

### Normes

- **No toquis les dades de qui juga.** Per a proves que creen o modifiquen coses, fes servir una escena, actors i un combat **temporals** (amb nom que comenci per `_Prova`) i esborra'ls en acabar, també si la prova falla (`try … finally`).
- Per veure al tracker un combat que no és el de l'escena activa: `ui.combat.initialize({ combat })`. Només afecta el segon client.
- Abans de fer clic a la barra lateral: `ui.sidebar.expand()`.
- **Dues sessions del mateix DJ:** els hooks «només al DJ actiu» s'executen a totes dues. Per això `iniciarTempsActiu` i els anuncis estan protegits contra execucions repetides.
- Les captures de pantalla surten bé amb WebGL per programari (ja configurat a `local.mjs`).

### Proves fetes el 2026-10-04 (Foundry v14.368)

| Prova | Resultat |
|-------|----------|
| Combat començat abans del codi nou (marcador 0, Yoko al 7): «Avança» porta el marcador al 7 i anuncia «avança 7 tics» | OK |
| Fase de declaració: no arrenca fins que declara l'últim; després tic de la primera posició i anuncis | OK |
| Cicle de torn amb clics: declarar, resoldre, redeclarar, «Avança» al tic següent | OK |
| Blocar del gòlem (urpes) contra un atac cos a cos: ofereix el cos (+4) | OK |
| Defensa completa: tirada en declarar (6 daus, concentrada), dos atacs contra la mateixa tirada sense diàleg, un al mateix tic que el defensor | OK |
| Final del combat: reaccions a 0, concentració fora, estats temporals fora, *sagnant* es manté | OK |
| Missatge de defensa: mostra la defensa resultant (mínim defensa +1) | OK |
| Últimes tries als diàlegs de declarar i de reacció; s'obliden en acabar el combat | OK |

### Proves unitàries a Windows

`npm test` falla a Windows: les proves fan `import("E:\…")`, i Node a Windows només accepta URL `file://`. Mentre no es corregeixi (vegeu «Pendent» a `REGISTRE-TREBALL.md`), es poden executar en una còpia temporal que embolcalli cada `import()` amb `pathToFileURL(...).href`.

### Pendent de provar a Foundry: Fase 1 (estats), 2026-10-06

Al contenidor del núvol no hi ha Foundry. Cal comprovar-ho en local (v13 i v14):

1. **Textos flotants:** marcar i treure un estat des del HUD (surt «▼ Abatut» / «✕ Abatut» a tots els clients, i no surt també el text natiu de Foundry); fer dany i curar (surt «−3 fatiga», «−2 ferides», «+2 fatiga»).
2. **Moure's:** un jugador amb el token atrapat o immobilitzat no el pot moure (en combat i fora), i torna a sortir l'estat. El DJ sí que el pot moure.
3. **Declarar:** abatut (+2 de latència, sense córrer ni càrrega); acovardit (només defensa o moviment); berserc (sense defensa completa ni concentració, excepte en atac); en clicar un tipus bloquejat torna a sortir l'estat.
4. **Marejat:** en declarar, demana la tirada FOR/APL + resistència; si falla, no declara.
5. **Atordit:** quan arriba el torn, perd l'acció, l'estat s'acaba i ha de tornar a declarar.
6. **Inconscient/incapacitat:** arribar al nivell 7 de fatiga/ferides posa l'estat; curar-se el treu; al seu torn perd l'acció i el rellotge continua (el botó «Avança» no queda bloquejat). Un combat amb un inconscient sense posició pot començar.
7. **Defensa:** abatut i atrapat no poden esquivar; berserc cap defensa activa; immobilitzat té defensa bàsica 1. El diàleg diu quin estat ho impedeix.
8. **Vigilant:** +1 reacció a la fitxa i al combat.
9. **Recuperació/X:** amb fatiga i ferides al mateix nivell, cura primer la fatiga; des del nivell 7 passa al 6.
10. **Fitxa:** la llista d'estats actius, amb la tirada (atrapat, acovardit, empès, malaltia/toxina, marejat, esguerrat) i el botó de treure'l.

### Pendent de provar a Foundry: Fase 2 (creació d'artefactes i efectes), 2026-10-06

1. **Constructor** (fitxa › «Construir efecte nou» i «Dissenyar artefacte»): afegir i treure paràmetres de tots els tipus, repetir-ne (dues capacitats mentals), declarar dificultat i latència; el cost es recalcula en directe. Reproduir una plantilla (p. ex. Espasa d'energia: arma espasa lat 1 dany 2, dany directe 6 ferides, acumulador 3, recàrrega 11, mode d'espera → 21 PC).
2. **Fitxa d'efecte** (nova) i **fitxa d'artefacte** (tirada d'activació, càrrega actual, fase, modular): els paràmetres es veuen amb el cost calculat, i «Editar amb el constructor» desa el resultat.
3. **Millorar un efecte** (progressió sobrenatural): el constructor parteix dels paràmetres de l'efecte.
4. **Migració:** en un món amb efectes o artefactes antics del catàleg, en entrar el DJ reben els paràmetres (un sol cop).

### Pendent de provar a Foundry: Fase 3 (ús d'artefactes i efectes), 2026-10-06

1. **Manifestar** des de la fitxa amb un o diversos objectius marcats: el jugador de l'objectiu (o el DJ) decideix si es resisteix; s'aplica el dany (indirecte amb armadura/reducció; directe sense), la curació, els estats (Sagnant/X amb la X) i les bonificacions; el xat ho resumeix. Ressonància i tria de fatiga o ferides.
2. **Àrea:** dibuixar una plantilla i manifestar Bola de foc: afecta els tokens de dins; la plantilla desapareix.
3. **Activar un artefacte** (Ulleres intel·ligents, Cibermòdem): tirada (o la demana), càrrega, bonificació d'habilitat amb «+n» a la fitxa durant l'escena i que desapareix en acabar el combat. Un prototip que pifia queda trencat.
4. **Armes artefacte:** afegir l'Espasa serra a un PJ → apareix com a arma; atacar → FOR+4 i sagnant/3; l'Espasa d'energia gasta càrrega i fa dany directe; sense càrrega no ataca. Treure l'artefacte esborra l'arma.
5. **Armadures artefacte:** la Holocapa i la Servoarmadura apareixen com a armadura; la Servoarmadura suma FOR +3 (es veu «+3») sense canviar els PC; desequipar-la ho treu. Espasa pretoriana: ègida 9 que es trenca i es reactiva.
6. **Tracker:** declarar «Manifestar un efecte» / «Activar un artefacte» amb objectiu; latència correcta; resoldre-ho al seu torn.
7. **Reacció:** L'armadura del queloni apareix al diàleg de defensa; en triar-la gasta la reacció, dona armadura 10 i l'atac es resol contra la defensa bàsica; l'armadura desapareix quan avança el rellotge.
8. **Relé:** un jugador aplica estats i bonificacions a un PNJ (sense ser-ne propietari).

### Pendent de provar a Foundry: Fase 4 (experiència), 2026-10-06

1. El DJ veu «Repartir PX» al directori d'actors; afegeix objectius de grup, individuals, virtuts i altres; els totals es recalculen; en confirmar se sumen a cada PJ i surt un missatge al xat.
2. Millorar un atribut, una habilitat, un tret o un efecte amb PX queda a l'historial de la fitxa (en vermell), i els PX guanyats en verd.

### Pendent de provar a Foundry: Fase 5 (compendis), 2026-10-06

1. Els 9 compendis nous apareixen a la pestanya Compendis; importar un PJ (Yoko-1), un PNJ, un animal i una criatura: la fitxa mostra els mateixos PC i derivats que el manual, amb els trets, les armes i els artefactes o efectes.
2. Arrossegar un artefacte o un efecte del compendi a una fitxa: porta els paràmetres (els artefactes basats en armes o armadures creen els objectes vinculats).

### Pendent de provar a Foundry: Fase 6, 2026-10-06

1. **Ràfega i automàtic** (subfusell, arma d'assalt): el diàleg ofereix el mode i la latència puja (+1, +2); la ràfega dona +1 dau o +1 dany.
2. **Àrees:** escopeta (llàgrima fins al rang mitjà, defensa 1, es pot esquivar), arma de dispersió (llàgrima de 15 m, defensa 5) i automàtic/foc automàtic (àrea al punt objectiu): una tirada, cada objectiu amb la seva defensa; sense plantilla, avís. Pífia amb arma de dispersió: fuga a l'usuari i adjacents.
3. **Feixugues:** l'arma de suport no dispara si el token s'ha mogut.
4. **Combinació:** primer cop ara; el segon arriba sol al proper torn de l'atacant, amb una defensa nova (sense reacció, no pot esquivar).
5. **Contraatac:** declarar-lo; quan l'ataquen i para o bloca amb èxit, contraataca; l'atacant no pot parar ni blocar.
6. **Dim Mak:** triar ferides o fatiga doble; ignora l'armadura.
7. **Escut:** portar-ne un dona +1 a la defensa a la fitxa.

### Pendent de provar a Foundry: presentació, aventura i eina del DJ, 2026-10-06
- Compendis: capçalera gris; el manual surt amb els capítols numerats i en ordre, i les pàgines tenen l'estil de llibre (taules, títols).
- Actors dels compendis: cada un porta el seu token (Yoko-1, Trace, Marvin, Gólem de carn i Aràcnid, els dibuixats; la resta, el gris provisional), també en arrossegar-lo a l'escena.
- Carpeta «La porta d'Hèkate» als compendis `pj`, `pnj` i `criatures`; importar-ne un i obrir-ne la fitxa (derivats, trets, habilitats amb especialitat).
- Mòdul `forja-la-porta-dhekate`: s'activa, el compendi de diari mostra els 9 capítols en ordre i les taules dels PJ pregenerats es llegeixen bé.
- Eina del DJ: botó «Nou actor FORJA» al directori d'actors (PJ → assistent de creació; PNJ, criatura, animal → fitxa amb el tier); menú d'un actor → «Desa al compendi del món» crea `FORJA (món): …` la primera vegada, hi copia l'actor i, si ja n'hi ha un amb el mateix nom, demana si el reemplaça. Els jugadors no veuen ni el botó ni l'opció.

### Pendent de provar a Foundry: adepte/inepte per àmbits, 2026-10-06
- Un PJ amb «Adepte (social)»: tirada des de la fitxa → el diàleg mostra «Àmbit de la tirada»; amb «Adepte (social)», els 1 es repeteixen (al xat no surt el 1 repetit) i el missatge ho indica.
- Un PJ amb «Inepte (tècnic)»: amb l'àmbit marcat, un 10 val 1 fita i cada 1 en resta una; amb una habilitat a 0 surt l'avís al diàleg i al xat.
- Sense cap d'aquests trets, el diàleg no mostra el desplegable.
- Compendi del manual regenerat: capítols i pàgines amb els mateixos `_id` (les còpies importades als mons no es dupliquen), enllaços creuats que obren la pàgina i l'apartat, taules de l'exemple de combat (caselles de salut) i de visibilitat.
