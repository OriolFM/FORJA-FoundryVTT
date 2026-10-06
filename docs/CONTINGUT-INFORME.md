# Informe del contingut dels compendis (Fase 5)

Generat per `scripts/build-packs.mjs` (no s'edita a mà: es regenera). Fonts: `docs/FORJA_FC001CA_CORE.md` i `module/config/dades/*.json`.

## Comptes

| Compendi | Tipus | Documents |
|---|---|---|
| `pj` | Actor | 6 |
| `pnj` | Actor | 25 |
| `animals` | Actor | 7 |
| `criatures` | Actor | 9 |
| `trets` | Item | 95 |
| `armes` | Item | 29 |
| `armadures` | Item | 5 |
| `artefactes` | Item | 18 |
| `efectes` | Item | 65 |

Les maniobres d'arts marcials (`maniobres-arts-marcials.json`) no tenen compendi: no són un tipus d'Item, només una llista de dades (`FORJA.LLISTA_MANIOBRES`) consultada en declarar un «Cop».

## Elements que no s'han pogut mapar (no s'han inclòs)

Cap.

## Línies no analitzables

Cap.

## Suposicions preses per interpretar el manual

- **Figurant (no combatent)** (`pnj`): El manual diu «un atribut a 2, la resta a 1» sense dir quin; s'ha posat DES a 2 (l'atribut de l'ofici). Latència 11, defensa 1 i reducció de dany 1 del manual només exigeixen AGI i FOR a 1.

## Costos d'artefactes/efectes: manual contra catàleg

Cap.

## Notes de mapeig

- **Figurant (combatent)** (`pnj`): Tret «inepte/mental»: «inepte/mental» s'ha interpretat com inepte (INT)
- **Insecte obrer** (`pnj`): Bloc «Criatura de cost…» dins la secció de secundaris: es publica al compendi `pnj` amb tier «criatura».
- **Gos gros** (`animals`): Tret «sentit agut/olfacte i gust»: sentit concret: olfacte i gust
- **Gos petit** (`animals`): Tret «sentit agut/olfacte i gust»: sentit concret: olfacte i gust
- **Gran felí** (`animals`): Tret «sentit agut/olfacte i gust»: sentit concret: olfacte i gust
- **Megalodon** (`animals`): Tret «sentit agut/olfacte i gust»: sentit concret: olfacte i gust
- **Senglar** (`animals`): Tret «sentit agut/olfacte i gust»: sentit concret: olfacte i gust

## Observacions sobre el sistema (no són errors del contingut)

- **Incorporis** (manual l. 1218): fan servir PER enlloc d'AGI, INT enlloc de DES i APL enlloc de FOR als atributs secundaris. `_prepararDerivats` (module/data/actor-personatge.mjs) no ho implementa: l'actor «IAssistent» (FOR/DES/AGI 0) mostrarà latència 12, defensa 1 i reducció de dany 0 a Foundry en lloc de 6, 4 i 2. Aquest informe fa el càlcul amb la regla del manual.
- **Armadura natural** (trets «armadura-nat-N»): el sistema no crea cap Item d'armadura natural en comprar el tret; als compendis només hi ha el tret, com fa el flux normal de la fitxa.
- **Tentacles** (Kraken): el tret «Tentacles» no és a `ARMAMENT_NATURAL_PER_TRET`, de manera que no s'hi ha afegit l'arma «Tentacles» del catàleg d'armes (és el que farien els hooks del sistema).
- **Biografia / notes**: als PJ, `system.biografia` conté els paràgrafs de presentació del manual que precedeixen la construcció; als PNJ, animals i criatures, `system.notes` conté el paràgraf descriptiu posterior al bloc.

## Diferències entre el cost/derivats del manual i el càlcul amb les taules del sistema

El cost recalculat suma atributs, espècie, mida, constitució, habilitats, trets i els artefactes/efectes (el manual els compta dins els PC: vegeu Anya Barker, 200 PC). Els derivats segueixen `_prepararDerivats`.

Cap diferència.
