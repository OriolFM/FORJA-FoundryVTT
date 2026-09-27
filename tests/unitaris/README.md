# Proves unitàries

> La guia completa de proves (els tres nivells, les tècniques i els resultats a v13 i v14) és a [`docs/PROVES.md`](../../docs/PROVES.md).

Proves de la lògica pura del sistema, amb Node. No calen ni Foundry ni navegador: substitueixen `foundry`, `CONFIG` o `game` pel mínim imprescindible.

```bash
npm test     # node --test "tests/unitaris/*.test.mjs"  (Node ≥ 20)
```

| Fitxer | Què prova |
|--------|-----------|
| `combat-wpf.test.mjs` | Càlcul del dany (ègida → armadura → reducció, dany mínim), protecció de les armadures, tick de reactivació de les ègides, concentració, abast de vora a vora, bandes de rang i opcions de defensa. |
| `regles-manual-wpi.test.mjs` | Regles del manual: escopetes (B13), pífia en esquivar (B14), mitjans de blocar (B15), retard de barallar-se (B16), requisits de curació (B17) i propietats d'arma. També els exemples del manual de dues armadures (Von Blum 7, Bauer 2). |
| `torns.test.mjs` | Ordre de torns del rellotge (`calcularSeguentTorn`). Inclou el cas "A i B a 0, A declara 5, el següent és B" i empats sense declarar. |
| `socket.test.mjs` | Relé del DJ: llista de camps permesos, rebuig de camps i estats no permesos, dany fora de combat, peticions del DJ. |
| `derivats.test.mjs` | Derivats de l'actor: els PC no compten els PX, barres de salut `value`/`max`, `foraDeCombat` i latència de les armadures. |
| `defensa-automatica.test.mjs` | Tria automàtica de la defensa dels PNJ (`system.defensaAutomatica`): preguntar, passiva, la millor activa, una opció concreta, i passiva si no té reacció. |
| `versio.test.mjs` | Control de versions: `system.json` i `package.json` tenen la mateixa versió, que té entrada al `CHANGELOG.md` (ordenat de més nova a més antiga). Vegeu `docs/VERSIONS.md`. |
| `moviment.test.mjs` | Moviment (WP-M, `module/combat/moviment.mjs`): distàncies de caminar/córrer/saltar i el mínim d'1 m; regla de bloqueig entre tokens (mida, enemics, morts, amagats); permís per tipus de moviment, acumulatiu durant el torn (2 + 3 + 1 m de 6, i 1 més bloquejat); moviment del torn si es redeclara; bonificació de càrrega; A* (rodejar un obstacle, camí parcial si és bloquejat, destinació ocupada, límit de nodes). |
| `i18n.test.mjs` | Els tres fitxers `lang/` tenen les mateixes claus; totes les claus que fa servir el codi (literals i famílies dinàmiques) existeixen; els `{placeholders}` coincideixen. |

Els missatges `FORJA | No s'ha pogut carregar …` que surten en executar-les són esperats: `constants.mjs` intenta carregar els catàlegs JSON amb `fetch`, que en aquestes proves està desactivat.

Per a les proves en un Foundry real, vegeu [`../joc/README.md`](../joc/README.md).
