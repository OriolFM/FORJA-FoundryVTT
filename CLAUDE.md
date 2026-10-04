# CLAUDE.md — FORJA RPG per a Foundry VTT

Guia per a treballar amb l'IA en aquest repositori. Descriu l'arquitectura **tal
com és al codi**, no un disseny previst. Si trobes cap discrepància entre
aquest document i el codi, el codi mana; actualitza aquest fitxer.

## Què és això

Sistema oficial de **FORJA RPG** per a **Foundry VTT**, escrit en ES Modules
(`.mjs`), sense build step (Foundry serveix els fitxers tal qual). Compatible
amb **Foundry VTT v13–v14** (`system.json`: `compatibility.minimum = "13"`,
`compatibility.verified = "14"`). Usa `DataModel`s moderns
(`foundry.abstract.TypeDataModel`) i fitxes `ApplicationV2`
(`foundry.applications.sheets.ActorSheetV2` / `ItemSheetV2`).

Mecànica central:
- **Daus**: pool de d10 amb fites (6–9 = 1 fita, 10 = 2 fites) i pífia (cap
  fita + algun 1).
- **Combat**: sense tirada d'iniciativa; un "rellotge de temps actiu" on cada
  combatent ocupa una posició (tick) i declarar una acció hi suma la seva
  latència.

## Estructura real del projecte

```
FORJA-FoundryVTT/
├── system.json              # Manifest del sistema
├── forja.mjs                 # Entry point (Hooks.once("init"/"ready"), hooks globals)
├── package.json               # Scripts npm: test, test:joc, versio, build:manual
├── CHANGELOG.md               # Canvis per versió ([Pendent] = feina en curs)
├── module/
│   ├── config/
│   │   ├── constants.mjs      # CONFIG.FORJA: costos, taules, càrrega de dades/*.json
│   │   └── dades/*.json       # Catàlegs editables: armadures, armes, artefactes,
│   │                          # estats, incompatibilitats, maniobres-arts-marcials, trets
│   ├── data/                  # DataModels d'actors i items
│   │   ├── _camps.mjs         # Camps compartits (campsBase, campsHabilitats)
│   │   ├── actor-personatge.mjs  # ActorPersonatge + _prepararDerivats (compartit amb PNJ)
│   │   ├── actor-pnj.mjs
│   │   ├── item-tret.mjs
│   │   ├── item-arma.mjs
│   │   ├── item-armadura.mjs
│   │   └── item-artefacte.mjs
│   ├── documents/
│   │   ├── actor.mjs          # ForjaActor (helpers aplicarDany/curar)
│   │   ├── combat.mjs         # ForjaCombat: rellotge de temps, ègides
│   │   └── token.mjs          # TokenDocument de FORJA: límit de moviment per torn (WP-M)
│   ├── canvas/
│   │   └── token.mjs          # Token (canvas) de FORJA: bloqueig entre tokens i pathfinding A* (WP-M)
│   ├── apps/                  # Fitxes (ApplicationV2) i diàlegs
│   │   ├── full-actor-base.mjs   # Classe base compartida per PJ i PNJ
│   │   ├── full-personatge.mjs   # Fitxa de Personatge (extén la base)
│   │   ├── full-pnj.mjs          # Fitxa de PNJ (extén la base)
│   │   ├── full-item.mjs         # Fitxa única per als 4 tipus d'Item
│   │   └── dialeg-*.mjs          # Diàlegs (trets, equipament, millora, curació, defensa, declarar acció)
│   ├── combat/                # Pipeline de combat
│   │   ├── atac.mjs           # ferAtac: tirada, dany, ègida, concentració, maniobres
│   │   ├── defensa.mjs        # opcionsDefensa / resoldreOpcioDefensa / triarDefensaAutomatica
│   │   ├── decisio-defensa.mjs # Qui tria la defensa: automàtica, propietari o DJ (pregunta pel socket)
│   │   ├── propietats.mjs     # Propietats d'arma (escut, escopeta) i mitjans de blocar
│   │   ├── dany.mjs           # calcularDany (ègida → armadura → reducció), funcions pures
│   │   ├── curacio.mjs        # Primers auxilis / tractament mèdic / repòs natural
│   │   ├── reaccions.mjs      # Reaccions per torn i concentració
│   │   ├── abast.mjs          # Distàncies i bandes de rang (vora a vora)
│   │   ├── moviment.mjs       # Moviment: distàncies, bloqueig, permís per torn, A* (funcions pures)
│   │   ├── equipament-automatic.mjs  # Atacs automàtics (Cop, armament natural), atributIHabilitatAtac
│   │   └── tracker-ui.mjs     # ForjaCombatTracker (extén el Combat Tracker natiu)
│   ├── dice/
│   │   ├── forja-roll.mjs     # ForjaRoll (Roll amb fites/pífia)
│   │   ├── tirada.mjs         # ferTirada: obre el diàleg i executa la tirada
│   │   └── dialeg-tirada.mjs  # Diàleg de configuració d'una tirada
│   ├── estats/estats.mjs      # Registra CONFIG.statusEffects + estat "dead"
│   ├── progressio/millora.mjs # Millora amb PX (mateixos costos que la creació)
│   ├── validacio/coherencia.mjs # Avisos (no bloquegen): PC/PX excedits, incompatibilitats
│   └── xarxa/socket.mjs       # Relé d'autoritat del DJ (vegeu més avall)
├── templates/                 # Plantilles Handlebars, organitzades com module/apps i module/combat
│   ├── actor/                 # Fitxes de personatge/pnj i diàlegs d'actor
│   ├── combat/                # Diàlegs i missatges de xat de combat
│   ├── dice/                  # Diàleg i missatge de tirada
│   └── item/                  # Una plantilla per tipus d'item + item-body.hbs (contenidor)
├── styles/forja.css
├── lang/                      # i18n: ca.json (font), es.json, en.json
├── packs/
│   ├── _source/manual/        # Fonts JSON (JournalEntry) del compendi "Manual FORJA"
│   └── manual/                # Compendi compilat (LevelDB) — generat, no s'edita a mà
├── scripts/
│   ├── build-manual.mjs       # Genera packs/_source/manual/*.json des de Markdown extern
│   └── versio.mjs             # npm run versio: tanca una versió (i actualitza graphify)
├── tests/
│   ├── unitaris/              # npm test — lògica pura, sense Foundry
│   └── joc/                   # Proves en un Foundry real sense pantalla (v13 i v14)
└── docs/
    ├── manual/FORJA_FC001CA_CORE.md  # Manual complet del joc — font de veritat de les regles
    ├── REVIEW-PLAN.md         # Troballes de la revisió de codi i pla de treball per paquets
    ├── REGISTRE-TREBALL.md    # REGISTRE DE TOTS ELS CANVIS DE LA BRANCA: commits, decisions, troballes, pendents
    ├── PROVES.md              # Totes les proves: què, com, com s'executen, resultats v13/v14
    └── VERSIONS.md            # Control de versions
```

No hi ha `assets/`, `module/sheets/`, `module/helpers/`, `docs/PLAN.md` ni
`scripts/build-packs.mjs`: si algun document antic els esmenta, són obsolets.

## Tipus d'actor i d'item

Registrats a `forja.mjs` (`CONFIG.Actor.dataModels`, `CONFIG.Item.dataModels`,
`DocumentSheetConfig.registerSheet`) i a `system.json` (`documentTypes`):

| Actor | DataModel | Fitxa | Descripció |
|-------|-----------|-------|------------|
| `personatge` | `ActorPersonatge` (`module/data/actor-personatge.mjs`) | `FullPersonatge` | Personatge Jugador (PJ) |
| `pnj` | `ActorPNJ` (`module/data/actor-pnj.mjs`) | `FullPNJ` | PNJ; camp `tier` (extra/antagonista/nemesis/criatura/animal) |

| Item | DataModel | Camps propis |
|------|-----------|---------------|
| `tret` | `ItemTret` | `cost`, `descripcio`, `efecte` (opcional: `{stat, delta}` o `{flag}`, aplicat als derivats) |
| `arma` | `ItemArma` | `categoria` (`natural`/`cosAcos`/`distancia`), `modLatencia`, `abast`, `danyBase`, `maniobra`, `rangExtrem`, `basic` |
| `armadura` | `ItemArmadura` | `tipus` (`fisica`/`flexible`/`natural`), `reduccio`, `modLatencia`, `equipada`, `egida.{activa,absorcio,tornsInactiva}` |
| `artefacte` | `ItemArtefacte` | `cost`, `categoria`, `activacio`, `us`, `carrega`, `mecanica` — dades de referència del catàleg; **no s'automatitza** (motor d'artefactes encara no existeix) |

Els actors comparteixen els camps base de `module/data/_camps.mjs`
(`campsBase`): atributs (FOR/DES/AGI/PER/INT/APL, 0–5), `especie`, `mida`
(1–5), `constitucio` (1–5), 46 habilitats fixes (`campsHabilitats`), salut
(`fatiga`/`ferides`, només `marcats` a l'schema), `reaccions.gastades`,
`concentrat`, `pc`, `px.{total,gastats}`, `biografia`.

Un únic `FullItem` (`module/apps/full-item.mjs`) serveix els 4 tipus
d'item; tria la plantilla concreta (`templates/item/<type>.hbs`) a
`_prepareContext` i la injecta com a HTML ja renderitzat dins l'únic
`PARTS.body`. El camp `efecte` d'`ItemTret` (un `ObjectField` lliure)
s'edita a la plantilla com a text JSON pla i es reinterpreta a
`_processSubmitData`.

## Catàlegs de dades (`module/config/dades/*.json`)

`module/config/constants.mjs` carrega en paral·lel (`Promise.all`, URL
relativa via `import.meta.url`, no un camí fix) els fitxers
`trets.json`, `armes.json`, `armadures.json`, `maniobres-arts-marcials.json`,
`incompatibilitats.json`, `estats.json` i `artefactes.json`, i els publica a
`CONFIG.FORJA` (`LLISTA_TRETS`, `CATALEG_ARMES`, `CATALEG_ARMADURES`,
`LLISTA_MANIOBRES`, `LLISTA_INCOMPATIBILITATS`, `CATALEG_ESTATS`,
`CATALEG_ARTEFACTES`). Un fetch fallit es registra a consola i cau a `[]`
(no bloqueja `init`). `CONFIG.FORJA` també conté les taules de cost
(`COST_ATRIBUT`, `COST_ESPECIE`, `COST_MIDA`, `COST_CONSTITUCIO`,
`COST_HABILITAT`), la llista de 46 habilitats (`LLISTA_HABILITATS`) i la
taula d'atribut/habilitat d'atac per categoria d'arma (`HAB_PER_CATEGORIA`,
`ATAC_PER_CATEGORIA`, `ATAC_PER_ARMA` — excepcions per `flags.forja.catalegId`,
p. ex. les llancívoles tiren AGI en lloc de DES).

Els ítems creats des d'un catàleg sempre porten `flags.forja.catalegId`
(`module/combat/equipament-automatic.mjs#crearItemDesDeCataleg`), imprescindible
per aparellar armes naturals amb el tret que les concedeix i per evitar
duplicats.

## Derivats (`module/data/actor-personatge.mjs`, `_prepararDerivats`)

Compartit per `ActorPersonatge` i `ActorPNJ` (el PNJ crida la mateixa funció).
Calculat a `prepareDerivedData()`:

- `latenciaBase = max(1, 10 + mida − AGI×2)`, més el `modLatencia` de
  **totes** les armadures equipades (`system.equipada !== false`) sumat —
  les penalitzacions de latència **s'apilen**.
- `defensa = AGI + MIDA_DEFENSA[mida]`
- `reduccioDany = FOR`
- `reaccionsMax = 1` (± efectes de trets)
- `moviment.{caminar, correr, saltar}` en metres (`combat/moviment.mjs`,
  `distanciesMoviment`): caminar = AGI×2 + MID − 3, córrer = AGI×5 +
  (MID − 3)×2, saltar = AGI×3 + ⌈(MID − 3)/2⌉, mínim 1. Fórmules de l'Oriol
  FM, no del manual. Es mostren a les dues fitxes, amb la resta de derivats.
- Efectes mecànics de trets (`item.system.efecte`): `{stat, delta}` suma a un
  derivat de la whitelist (`reaccionsMax`, `latenciaBase`, `defensa`,
  `reduccioDany`); `{flag}` activa un indicador booleà (p. ex.
  `ignoraPenalitzacioFerides`).
- Salut: `salut.{fatiga,ferides}.perNivell` (constitució / mida),
  `nivellActiu` (1–7, `floor(marcats/perNivell)+1`), `nivellEfectiu =
  max(fatiga.nivellActiu, ferides.nivellActiu)`. `{value, max}` per a les
  barres de token: `max = 6×perNivell + 1`, `value = max − marcats`.
  `salut.foraDeCombat = nivellEfectiu >= 7` (el personatge no pot actuar).
  `salut.penalitzacio` ve de `FORJA.SALUT_PENALITZACIO[nivell]`
  (`0/0/0/1/2/4/null`), llegint el nivell de fatiga en lloc de l'efectiu si
  el tret `ignoraPenalitzacioFerides` és actiu.
- **PC gastats** = cost total de la construcció actual (atributs + espècie +
  mida + constitució + habilitats + trets) **menys** `px.gastats`. Com que
  qualsevol compra amb PX (`module/progressio/millora.mjs`) puja `costTotal`
  i `px.gastats` pel mateix import, això cancel·la exactament les compres
  amb PX i només compta com a "PC gastat" allò triat a la creació (o editat
  a mà sense passar per `millora.mjs`).
- `px.lliures = px.total − px.gastats`.

## Daus (`module/dice/forja-roll.mjs`)

`ForjaRoll` extén `Roll` (`CONFIG.Dice.rolls.push(ForjaRoll)`):
- Cada d10 `≥ 6` = 1 fita; `10` = 2 fites (doble fita).
- **Pífia**: cap fita i almenys un 1 entre els daus.
- `exit = !pifia && fites >= dificultat` (o `>` si la tirada exigeix superar,
  p. ex. defensa activa contra atac); `excedent = fites − dificultat` si hi
  ha èxit.

## Combat

### Rellotge de temps (`module/documents/combat.mjs`, `ForjaCombat`)

No hi ha tirada d'iniciativa: `Combatant#initiative` és la **posició** al
rellotge (tick en què actuarà), ordre ascendent (posició més baixa primer).
Estat persistit a `flags.forja`:
- `marcador` — posició actual del marcador de temps.
- `actiu` — id del combatent amb el torn (font de veritat; `turn` és només
  un índex que Foundry pot desalinear quan `declararAccio` reordena `turns`
  — `setupTurns()` el torna a apuntar al combatent actiu després d'ordenar).
- `actuats` — ids que ja han actuat a la casella del `marcador`.

`declararAccio(combatantId, latencia)` suma la latència a la posició actual
del combatent i reordena. `nextTurn()` (funció pura `calcularSeguentTorn`)
tria el proper combatent (algú pendent a la casella del marcador; si no,
avança el marcador a la propera casella ocupada) i escriu `round`, `turn` i
els tres flags en un sol `update` (evita doble escriptura). `fiDeTorn`
reinicia les reaccions del combatent sortint; s'executa només al DJ actiu,
des del hook `updateCombat` de `forja.mjs`.

### Tracker (`module/combat/tracker-ui.mjs`, `ForjaCombatTracker`)

Extén el `CombatTracker` natiu: elimina els controls d'iniciativa (irrellevants
en aquest sistema), mostra el marcador de temps i la posició de cada
combatent, i afegeix botons "declarar acció" / "resoldre" / "marcar
emboscada" — **només visibles** per al DJ o el propietari del combatent
(`_potControlar`). Declarar acció obre `DiategDeclararAccio` amb la latència
i les opcions d'atac/defensa/maniobres calculades; resoldre obre el diàleg de
tirada (o el flux d'atac complet si hi ha un objectiu marcat al canvas).

### Moviment (WP-M)

Lògica pura a `module/combat/moviment.mjs` (sense globals de Foundry); la
part de Foundry, a dues classes registrades a `forja.mjs` que estenen les
que Foundry fa servir per defecte (`CONFIG.Token.documentClass` /
`objectClass`, amb les factories `crearTokenDocumentForja` / `crearTokenForja`):

- **Declarar** (`dialeg-declarar-accio.mjs`): tota acció porta implícit un
  moviment bàsic (caminar). Es pot triar moviment especial (+2 latència,
  tirada a càrrec del DJ) o, amb un atac cos a cos / natural, càrrega
  (córrer + atac, +2 latència). El moviment ràpid (córrer) només amb el
  tipus d'acció "Només moviment", perquè no es combina amb cap altra acció.
  Es desa a `flags.forja.accioPendent.moviment`, amb `combatId`,
  `declaradaAlMarcador` i `movimentEnCurs` (el moviment del torn que s'està
  jugant, si es redeclara durant el propi torn; vegeu `movimentDelTorn`).
- **Límit per torn** (`documents/token.mjs`, `_preUpdateMovement`, al client
  que mou): en un combat començat i per als tokens combatents, un jugador
  (el DJ mai) només pot moure el token del combatent actiu
  (`flags.forja.actiu`), sense teletransport, fins al permís del moviment
  del torn (caminar o córrer) **acumulat**: historial de moviment del torn
  (Foundry el buida a l'inici de cada torn) + el tram nou. Cap token pot
  acabar a l'espai d'un altre. Els tokens que no són al combat es mouen
  lliurement.
- **Bloqueig i pathfinding** (`canvas/token.mjs`): les caselles ocupades per
  tokens que bloquegen (`bloquejaPas`: mida ≥ 3 sempre; mida ≤ 2 només si és
  enemic; els morts i els que l'usuari no veu, mai) tenen cost infinit
  (`_getMovementCostFunction`), i `findMovementPath` busca una ruta A* al
  voltant de parets i tokens (quadrícula quadrada i hexagonal, tokens de
  diverses caselles, límit de nodes). Sense quadrícula, el natiu. El DJ amb
  "moviment sense restriccions" ho ignora tot.
- **Càrrega**: en resoldre l'atac, si el token s'ha mogut 2 m o més aquest
  torn (historial), +1 dau a l'atac i +1 al dany si impacta (manual l. 2794;
  `ferAtac`, paràmetre `bonusCarrega`).

### Pipeline d'atac → defensa → dany

1. **Abast** (`combat/abast.mjs`): distàncies mesurades **vora a vora**
   (bounds dels tokens, no centre a centre), traduïdes a bandes de rang per a
   armes a distància (`bandaDistancia`) o a "a tocar" per a cos a cos
   (`tokensATocar`).
2. **Defensa** (`combat/defensa.mjs`, `opcionsDefensa`/`resoldreOpcioDefensa`
   — font única, usada tant pel diàleg de resoldre un atac com pel de
   declarar una acció defensiva): passiva (sense cost), esquivar/parar
   (gasten una reacció, tirada enfrontada que cal **superar**), blocar (gasta
   reacció, sense tirada, suma `min(resistència, reduccioDany)` a la reducció
   de dany). El resultat de la defensa activa es publica al xat.
   **Qui tria la defensa** (`combat/decisio-defensa.mjs`, `decidirDefensa`):
   primer la defensa automàtica del PNJ (`system.defensaAutomatica`,
   `triarDefensaAutomatica`); si no en té, el jugador propietari del defensor
   si està connectat; si no, el DJ. El diàleg s'obre al client que ha de
   decidir mitjançant una pregunta pel socket (`preguntarA`). Mai el tria el
   jugador que ataca un PNJ. Si ningú respon en 2 minuts, s'aplica la defensa passiva.
3. **Atac** (`combat/atac.mjs`, `ferAtac`): tira contra la dificultat
   resolta per la defensa; bloqueja si l'atacant està `foraDeCombat`; aplica
   la penalització de salut i el dau extra de concentració a la dificultat/pool.
4. **Dany** (`combat/dany.mjs`, `calcularDany`, funció pura): ègida → armadura
   → reducció de dany, en aquest ordre, amb "dany mínim" quan la reducció
   (no l'armadura) porta el dany a zero. Protecció d'armadures
   (`proteccioArmadura`, manual l. 3337): la millor rígida (o natural) més la
   meitat, arrodonint amunt, de la millor flexible; les latències s'apilen
   totes. Si el DJ no pot aplicar el dany o els estats, la tirada es publica
   igualment amb una nota perquè ho faci a mà.
   Ègides trencades es reactiven quan el marcador del rellotge arriba al
   tick desat (`flags.forja.egidaReactivaAlTick`), gestionat pel DJ actiu a
   `ForjaCombat#reactivarEgides`/`tancarEgidesPendents`.
5. **Concentració** (`combat/reaccions.mjs`): es declara en declarar l'acció,
   dona +1 dau a la propera tirada pròpia i es consumeix; rebre dany la
   trenca (i pot atordir si el dany supera la FOR de l'objectiu).
6. **Maniobres d'arts marcials**: només amb l'atac "Cop" i habilitat
   `arts-marcials`; sumen dificultat i poden aplicar un estat en impactar.

7. **Regles del manual B13–B17** (`combat/propietats.mjs`, `dany.mjs`,
   `defensa.mjs`, `curacio.mjs`): escopetes contra armadura rígida, pífia en
   esquivar (+1 de dany per cada 1, al dany final), mitjans de blocar (cos,
   escut o objecte), retard de barallar-se i requisits d'habilitat per curar.
   Les decisions i les fonts són a `docs/REGISTRE-TREBALL.md`.

## Xarxa: relé d'autoritat del DJ (`module/xarxa/socket.mjs`)

Un jugador no és propietari dels documents d'altri (PNJ, combat...). Quan cal
escriure-hi (dany, reaccions, concentració, ègida, avançar el rellotge...),
**no s'actualitza mai el document directament**: es crida una de les
funcions exportades, que actuen de manera immediata si l'usuari ja n'és
propietari, o passen per `game.socket` (canal `"system.forja"`, requereix
`"socket": true` a `system.json`) perquè el DJ actiu apliqui el canvi:

- `actualitzarComGM(document, changes, options)`
- `crearEmbegutsComGM(actor, type, data[])`
- `eliminarEmbegutsComGM(actor, type, ids[])`
- `alternarEstatComGM(actor, statusId, active)`
- `preguntarA(usuari, nom, dades)` / `registrarPregunta(nom, gestor)`: no
  modifica documents; demana una **decisió** a un altre usuari (p. ex. la
  defensa d'un PNJ, al DJ) i en retorna la resposta. El destinatari executa
  el gestor registrat, que sol obrir un diàleg.

**Regla del projecte: qualsevol escriptura a un document que l'usuari
actual no posseeix ha de passar per aquestes funcions.** El DJ que atén la
petició valida el tipus de document (`Actor`/`Item`/`ActiveEffect`/`Combat`/
`Combatant`), una llista blanca de camps per tipus
(`CAMPS_PERMESOS_PER_TIPUS`, p. ex. `system.salut.fatiga.marcats`,
`flags.forja.*`) i, per a Actor/Item, que hi hagi un combat actiu (o que la
salut només **baixi**, per permetre curació fora de combat). Amplia aquesta
llista blanca quan afegeixis un nou flux que escrigui un camp addicional per
encàrrec — no relaxis les comprovacions de context per compensar-ho.
`registrarSocket()` es crida un sol cop, a `Hooks.once("ready")`
(`forja.mjs`).

## Hooks globals (`forja.mjs`)

Els hooks que creen/actualitzen documents estan guardats perquè no
s'executin a tots els clients connectats alhora:
- `createActor` / `createItem` / `deleteItem`: només si
  `userId === game.user.id` (el client que ha fet l'acció, no tots els
  altres).
- `updateCombat` (fi de torn → reinicia reaccions): només si
  `game.users.activeGM?.isSelf`.

En tocar aquests hooks o afegir-ne de nous que escriguin documents,
mantingues aquest patró (`userId`/`activeGM` guard) — la manca d'aquest
control és una classe de bug ja detectada al pla de revisió (A1).

## i18n

`lang/ca.json` és **la font**: totes les claus `FORJA.*` neixen aquí. Tota
clau usada al codi o a les plantilles ha d'existir a `ca.json`, `es.json` i
`en.json` amb el mateix conjunt de claus (encara en curs — vegeu
`docs/REVIEW-PLAN.md`, finding C1, WP-D1). No facis servir text fix a les
plantilles ni al JS; sempre `game.i18n.localize`/`format` o
`{{localize "FORJA.…"}}`.

## El manual com a font de veritat

`docs/FORJA_FC001CA_CORE.md` és el manual físic complet (català).
**Abans d'implementar o canviar qualsevol mecànica de joc, busca-hi la
secció rellevant** (`grep -n` hi funciona bé, és un sol fitxer llarg) i
cita-la als comentaris/JSDoc (secció i, quan calgui, número de línia
aproximat). No inventis regles a partir del nom d'un camp.

`packs/_source/manual/*.json` són les fonts (JournalEntry/JournalEntryPage)
del compendi "Manual FORJA" que es distribueix amb el sistema (registrat a
`system.json` → `packs`); `packs/manual/` és el compendi ja compilat
(LevelDB) — **no s'edita a mà**, es regenera.

## Compilar el compendi del manual

```
FORJA_MD_DIR=/ruta/als/capitols/markdown npm run build:manual
```

`scripts/build-manual.mjs` converteix capítols en Markdown (`# Títol` →
JournalEntry, `## Secció` → JournalEntryPage) a JSON dins
`packs/_source/manual/`, i `npm run build:manual` ho encadena amb
`@foundryvtt/foundryvtt-cli package pack` per compilar-ho a
`packs/manual/` (LevelDB). Si no es dona `FORJA_MD_DIR`, per defecte cerca
`../../FOUNDRY/MD` relatiu a l'arrel del projecte (una carpeta fora del
repositori, específica de la màquina de l'autor) — normalment caldrà
indicar la variable d'entorn. El script comprova que la carpeta d'entrada
existeixi **abans** d'esborrar res de `packs/_source/manual`. Cal
`npm install` (depèn de `marked` i `@foundryvtt/foundryvtt-cli`) i Node.js
(recomanat ≥ 20 per al CLI de Foundry).

## Com provar

Tot el detall és a **`docs/PROVES.md`**. En resum:

1. **Sintaxi:** `node --check` de cada `.mjs` tocat.
2. **Proves unitàries:** `npm test` (`tests/unitaris/`, sense Foundry). Obligatori abans de cada commit que toqui `module/`. La lògica nova s'ha d'escriure com a funcions pures i provar-se aquí.
3. **Proves de joc:** `tests/joc/proves.mjs`, `proves-combat.mjs` i `proves-moviment.mjs`, en un Foundry v13 i v14 real sense pantalla, amb sessions de DJ i de Jugador (Playwright). Cal passar-les si el canvi toca el joc, i sempre abans de tancar una versió.
   - Després, restaura `packs/manual`, que Foundry reescriu.
   - Afegeix els resultats a `docs/PROVES.md`.

## Convencions

- Codi en ES Modules (`.mjs`), sense build step.
- **Identificadors i comentaris en català** (noms de funcions, variables,
  JSDoc); és l'estil de tot el codi existent.
- Cada funció que implementi una regla ha de citar la secció del manual
  (`docs/FORJA_FC001CA_CORE.md`) al JSDoc, i sovint l'ID de finding
  del pla de revisió (`docs/REVIEW-PLAN.md`, p. ex. "B3", "A2") quan el canvi
  ve d'allà.
- Automatitza el càlcul, mai la decisió: quan una regla depèn de judici del
  DJ (rang variable, aplicar repòs quan "ha passat prou temps", concedir una
  millora amb PX...), el codi ofereix l'eina però no decideix per ell.
- Cap escriptura a un document que l'usuari actual no posseeix sense passar
  pel relé del DJ (`module/xarxa/socket.mjs`).
- **Documenta-ho tot, amb cada commit.** La documentació és clau en aquest projecte.
  - `docs/REGISTRE-TREBALL.md` és el registre de tots els canvis de la branca: el commit, què s'ha fet i per què, les decisions i els pendents.
  - `CHANGELOG.md` (`[Pendent]`) recull els canvis visibles per a l'usuari.
  - `docs/PROVES.md` recull les proves noves i els resultats.

## Versions i registre de canvis

- Versionat semàntic, amb la mateixa versió a `system.json` i `package.json` (ho comprova `tests/unitaris/versio.test.mjs`). Procediment complet: `docs/VERSIONS.md`.
- **Cada canvi que notaria un usuari s'apunta a `## [Pendent]` de `CHANGELOG.md`**, a la subsecció que toqui (Afegit, Canviat, Corregit, Eliminat, Seguretat, Atenció). El detall tècnic i les decisions van a `docs/REGISTRE-TREBALL.md`.
- Per tancar una versió: `npm run versio -- patch|minor|major`, i després commit i etiqueta anotada `vX.Y.Z`. En les MINOR i MAJOR l'script també actualitza el graf de graphify.
