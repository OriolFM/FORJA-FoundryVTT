# La porta d'Hèkate: conversió dels actors

Generat per `scripts/build-packs.mjs` (no s'edita a mà). Font: `moduls/forja-la-porta-dhekate/font/`. Els actors són als compendis del sistema, dins la carpeta «La porta d'Hèkate».

El mòdul (esborrany v0.2) fa servir unes regles anteriors. Conversió decidida per l'Oriol FM (2026-10-06): constitució esglaó a esglaó (feble → magra, saludable → saludable, robusta → ferma, massissa → robusta), mida col·losal → enorme; es mantenen atributs, habilitats i trets, i el cost i els derivats es recalculen amb les regles actuals.

| Compendi | Actors |
|---|---|
| `pj` | 8 |
| `pnj` | 13 |
| `criatures` | 4 |

## Trets, habilitats o equip que no s'han pogut mapar (no s'han inclòs)

- **Frederick Bauer (Orfeu)** (`pnj`): Artefactes: «Vestit d'infiltració de l'ANM» no és al catàleg d'artefactes ni d'efectes
- **Hèkate** (`pnj`): Artefactes: «Generador de bretxa» no és al catàleg d'artefactes ni d'efectes

## Línies no analitzables

Cap.

## Conversions i suposicions

- **Bretxer 1** (`pj`): «recursos/prof. o emprenedor» és el nivell per defecte (0 PC, manual l. 1673): no cal el tret
- **Bretxer 2** (`pj`): «recursos/prof. o emprenedor» és el nivell per defecte (0 PC, manual l. 1673): no cal el tret
- **Magistrat 1** (`pj`): «recursos/prof. o emprenedor» és el nivell per defecte (0 PC, manual l. 1673): no cal el tret
- **Magistrat 2** (`pj`): «adepte/mental» (grup d'habilitats, regles antigues) → adepte (INT)
- **Magistrat 2** (`pj`): «recursos/prof. o emprenedor» és el nivell per defecte (0 PC, manual l. 1673): no cal el tret
- **Científic** (`pj`): «inepte/social» (grup d'habilitats, regles antigues) → inepte (APL)
- **Dron de manteniment** (`pnj`): constitució «massissa» → robusta (5)
- **Dron de manteniment** (`pnj`): «adepte - tècnic» (grup d'habilitats, regles antigues) → adepte (INT)
- **Dron de manteniment** (`pnj`): «veloç» retirat: no és al manual final
- **Jovenalla del Mur** (`pnj`): constitució «feble» → magra (2)
- **Jörg Marsuí** (`pnj`): constitució «robusta» → ferma (4)
- **Magistrada Blume** (`pnj`): constitució «robusta» → ferma (4)
- **Magistrat Otomo** (`pnj`): «curació ràpida/» sense valor: s'ha pres X=1
- **Magistrat Otomo** (`pnj`): «vincles» → contactes (amb una organització)
- **Sr. Thèvenin** (`pnj`): «adepte - tècnic» (grup d'habilitats, regles antigues) → adepte (INT)
- **Frederick Bauer (Orfeu)** (`pnj`): «adepte - mental» (grup d'habilitats, regles antigues) → adepte (INT)
- **Frederick Bauer (Orfeu)** (`pnj`): «adepte - tècnic» (grup d'habilitats, regles antigues) → adepte (INT)
- **Frederick Bauer (Orfeu)** (`pnj`): «adepte - tècnic» repetit després de convertir-lo (adepte/int): només un cop
- **Frederick Bauer (Orfeu)** (`pnj`): «atribut excepcional» retirat: ja no cal: un atribut a 4 ja inclou el cost al manual v3
- **Frederick Bauer (Orfeu)** (`pnj`): «vincles» → contactes (amb una organització)
- **Líder operatiu** (`pnj`): constitució «robusta» → ferma (4)
- **Líder operatiu** (`pnj`): «vincles» → contactes (amb una organització)
- **Operatiu** (`pnj`): «vincles» → contactes (amb una organització)
- **Agent d'intel·ligència (ISSR)** (`pnj`): «vincles» → contactes (amb una organització)
- **Hèkate** (`pnj`): mida «col·losal» → enorme (5)
- **Hèkate** (`pnj`): constitució «robusta» → ferma (4)
- **Hèkate** (`pnj`): «adepte - tècnic» (grup d'habilitats, regles antigues) → adepte (INT)
- **Hèkate** (`pnj`): «atribut excepcional» retirat: ja no cal: un atribut a 4 ja inclou el cost al manual v3
- **Hèkate** (`pnj`): «curació ràpida/» sense valor: s'ha pres X=1
- **Aràcnid Acherontia XM976** (`criatures`): mida «col·losal» → enorme (5)
- **Aràcnid Acherontia XM976** (`criatures`): constitució «robusta» → ferma (4)
- **Aràcnid Acherontia XM976** (`criatures`): «atribut excepcional» retirat: ja no cal: un atribut a 4 ja inclou el cost al manual v3
- **Aràcnid Acherontia XM976** (`criatures`): «temible/2» retirat: no és al manual final; el cost passa a intimidació i aplom (APL)
- **Aràcnid Acherontia XM976** (`criatures`): temible retirat: +1 a APL i +1 a intimidació en compensació (ajustable)
- **Centpeus gegant** (`criatures`): mida «col·losal» → enorme (5)
- **Centpeus gegant** (`criatures`): constitució «feble» → magra (2)
- **Katydid Acherontia XJ748** (`criatures`): constitució «robusta» → ferma (4)

## Costos d'artefactes/efectes: mòdul contra catàleg

- **Frederick Bauer (Orfeu)** (`pnj`): Ciberbraç: el manual diu 16 PC i el catàleg 22 PC
- **Frederick Bauer (Orfeu)** (`pnj`): Cibermòdem d'interfície neural directa: el manual diu 16 PC i el catàleg 15 PC
- **Hèkate** (`pnj`): Cibermòdem d'interfície neural directa: el manual diu 16 PC i el catàleg 15 PC
- **Hèkate** (`pnj`): Espasa d'energia: el manual diu 44 PC i el catàleg 21 PC
- **Hèkate** (`pnj`): Matar màquina: el manual diu 16 PC i el catàleg 14 PC
- **Hèkate** (`pnj`): Enllaç mental: el manual diu 7 PC i el catàleg 10 PC
- **Hèkate** (`pnj`): Negar el dany: el manual diu 12 PC i el catàleg 15 PC

## Notes

- **Àstrid Corçana** (`pnj`): Habilitat «vehicle» repetida (vehicle (vaixells) 6): es queda el nivell 6
- **Jörg Marsuí** (`pnj`): Habilitat «vehicle» repetida (vehicle (vaixells) 8): es queda el nivell 8
- **Sr. Thèvenin** (`pnj`): Habilitat «vehicle» repetida (vehicle (barques) 3): es queda el nivell 5
- **Sr. Thèvenin** (`pnj`): Habilitat «vehicle» repetida (vehicle (espacial gros) 5): es queda el nivell 5
- **Sr. Thèvenin** (`pnj`): Habilitat «vehicle» repetida (vehicle (espacial petit) 4): es queda el nivell 5
- **Frederick Bauer (Orfeu)** (`pnj`): Habilitat «vehicle» repetida (vehicle (lliscadors) 5): es queda el nivell 5
- **Agent d'intel·ligència (ISSR)** (`pnj`): Habilitat «vehicle» repetida (vehicle (terrestre) 4): es queda el nivell 4
- **Hèkate** (`pnj`): Habilitat «medicina» repetida (medicina (xenomedicina) 6): es queda el nivell 6
- **Hèkate** (`pnj`): Habilitat «vehicle» repetida (vehicle (espacial petit) 6): es queda el nivell 8
- **Hèkate** (`pnj`): Habilitat «vehicle» repetida (vehicle (lliscadors) 8): es queda el nivell 8

## Diferències amb el mòdul (cost i derivats recalculats)

Esperables: la defensa, la salut i part dels costos canvien d'escala entre versions de les regles. Serveix per revisar cada actor.

| Actor | Compendi | Camp | Mòdul | Calculat | Diferència |
|---|---|---|---|---|---|
| Bretxer 1 | `pj` | cost | 150 | 145 | -5 |
| Bretxer 1 | `pj` | defensa | 11 | 3 | -8 |
| Bretxer 1 | `pj` | reduccioDany | 5 | 2 | -3 |
| Bretxer 2 | `pj` | defensa | 10 | 2 | -8 |
| Bretxer 2 | `pj` | reduccioDany | 5 | 2 | -3 |
| Magistrat 1 | `pj` | cost | 150 | 140 | -10 |
| Magistrat 1 | `pj` | defensa | 9 | 1 | -8 |
| Magistrat 1 | `pj` | reduccioDany | 7 | 3 | -4 |
| Magistrat 2 | `pj` | cost | 150 | 147 | -3 |
| Magistrat 2 | `pj` | defensa | 10 | 2 | -8 |
| Magistrat 2 | `pj` | reduccioDany | 5 | 2 | -3 |
| Custodi 1 | `pj` | cost | 150 | 145 | -5 |
| Custodi 1 | `pj` | defensa | 10 | 2 | -8 |
| Custodi 1 | `pj` | reduccioDany | 5 | 2 | -3 |
| Custodi 2 | `pj` | cost | 150 | 135 | -15 |
| Custodi 2 | `pj` | latencia | 10 | 9 | -1 |
| Custodi 2 | `pj` | defensa | 9 | 2 | -7 |
| Custodi 2 | `pj` | reduccioDany | 7 | 3 | -4 |
| Doctor | `pj` | cost | 150 | 140 | -10 |
| Doctor | `pj` | defensa | 9 | 1 | -8 |
| Doctor | `pj` | reduccioDany | 4 | 1 | -3 |
| Científic | `pj` | cost | 150 | 152 | 2 |
| Científic | `pj` | latencia | 11 | 12 | 1 |
| Científic | `pj` | defensa | 9 | 0 | -9 |
| Científic | `pj` | reduccioDany | 5 | 1 | -4 |
| Àstrid Corçana | `pnj` | cost | 221 | 355 | 134 |
| Àstrid Corçana | `pnj` | defensa | 12 | 3 | -9 |
| Àstrid Corçana | `pnj` | reduccioDany | 4 | 2 | -2 |
| Dron de manteniment | `pnj` | cost | 71 | 134 | 63 |
| Dron de manteniment | `pnj` | latencia | 18 | 9 | -9 |
| Dron de manteniment | `pnj` | defensa | 4 | 3 | -1 |
| Dron de manteniment | `pnj` | reduccioDany | 6 | 1 | -5 |
| Jovenalla del Mur | `pnj` | cost | 69 | 130 | 61 |
| Jovenalla del Mur | `pnj` | defensa | 12 | 3 | -9 |
| Jovenalla del Mur | `pnj` | reduccioDany | 2 | 1 | -1 |
| Jörg Marsuí | `pnj` | cost | 224 | 346 | 122 |
| Jörg Marsuí | `pnj` | latencia | 10 | 9 | -1 |
| Jörg Marsuí | `pnj` | defensa | 9 | 2 | -7 |
| Jörg Marsuí | `pnj` | reduccioDany | 6 | 3 | -3 |
| Magistrada Blume | `pnj` | cost | 251 | 364 | 113 |
| Magistrada Blume | `pnj` | defensa | 12 | 3 | -9 |
| Magistrada Blume | `pnj` | reduccioDany | 5 | 2 | -3 |
| Magistrat assistent de l'ANM | `pnj` | cost | 77 | 133 | 56 |
| Magistrat assistent de l'ANM | `pnj` | latencia | 10 | 9 | -1 |
| Magistrat assistent de l'ANM | `pnj` | defensa | 9 | 2 | -7 |
| Magistrat assistent de l'ANM | `pnj` | reduccioDany | 4 | 2 | -2 |
| Magistrat Otomo | `pnj` | cost | 332 | 524 | 192 |
| Magistrat Otomo | `pnj` | latencia | 10 | 9 | -1 |
| Magistrat Otomo | `pnj` | defensa | 9 | 2 | -7 |
| Magistrat Otomo | `pnj` | reduccioDany | 4 | 2 | -2 |
| Sr. Thèvenin | `pnj` | cost | 161 | 225 | 64 |
| Sr. Thèvenin | `pnj` | latencia | 9 | 8 | -1 |
| Sr. Thèvenin | `pnj` | defensa | 8 | 3 | -5 |
| Sr. Thèvenin | `pnj` | reduccioDany | 3 | 1 | -2 |
| Frederick Bauer (Orfeu) | `pnj` | cost | 518 | 569 | 51 |
| Frederick Bauer (Orfeu) | `pnj` | latencia | 10 | 9 | -1 |
| Frederick Bauer (Orfeu) | `pnj` | defensa | 9 | 2 | -7 |
| Frederick Bauer (Orfeu) | `pnj` | reduccioDany | 4 | 2 | -2 |
| Líder operatiu | `pnj` | cost | 240 | 405 | 165 |
| Líder operatiu | `pnj` | latencia | 10 | 9 | -1 |
| Líder operatiu | `pnj` | defensa | 9 | 2 | -7 |
| Líder operatiu | `pnj` | reduccioDany | 5 | 2 | -3 |
| Operatiu | `pnj` | cost | 118 | 210 | 92 |
| Operatiu | `pnj` | latencia | 10 | 9 | -1 |
| Operatiu | `pnj` | defensa | 9 | 2 | -7 |
| Operatiu | `pnj` | reduccioDany | 4 | 2 | -2 |
| Agent d'intel·ligència (ISSR) | `pnj` | cost | 272 | 447 | 175 |
| Agent d'intel·ligència (ISSR) | `pnj` | latencia | 10 | 9 | -1 |
| Agent d'intel·ligència (ISSR) | `pnj` | defensa | 9 | 2 | -7 |
| Agent d'intel·ligència (ISSR) | `pnj` | reduccioDany | 4 | 2 | -2 |
| Hèkate | `pnj` | cost | 841 | 1033 | 192 |
| Hèkate | `pnj` | defensa | 14 | 1 | -13 |
| Hèkate | `pnj` | reduccioDany | 5 | 2 | -3 |
| Aràcnid Acherontia XM976 | `criatures` | cost | 302 | 408 | 106 |
| Aràcnid Acherontia XM976 | `criatures` | defensa | 14 | 1 | -13 |
| Aràcnid Acherontia XM976 | `criatures` | reduccioDany | 7 | 4 | -3 |
| Centpeus gegant | `criatures` | cost | 97 | 148 | 51 |
| Centpeus gegant | `criatures` | defensa | 14 | 1 | -13 |
| Centpeus gegant | `criatures` | reduccioDany | 4 | 3 | -1 |
| Katydid Acherontia XJ748 | `criatures` | cost | 104 | 181 | 77 |
| Katydid Acherontia XJ748 | `criatures` | latencia | 10 | 9 | -1 |
| Katydid Acherontia XJ748 | `criatures` | defensa | 9 | 2 | -7 |
| Katydid Acherontia XJ748 | `criatures` | reduccioDany | 6 | 3 | -3 |
| RMI (Rosegador de Mida Inusual) | `criatures` | cost | 63 | 142 | 79 |
| RMI (Rosegador de Mida Inusual) | `criatures` | latencia | 19 | 10 | -9 |
| RMI (Rosegador de Mida Inusual) | `criatures` | defensa | 5 | 2 | -3 |
| RMI (Rosegador de Mida Inusual) | `criatures` | reduccioDany | 4 | 2 | -2 |
