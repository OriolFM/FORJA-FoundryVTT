# Registre de canvis

Tots els canvis rellevants del sistema FORJA per a Foundry VTT, per versions.

- El format segueix [Keep a Changelog](https://keepachangelog.com/ca/1.1.0/).
- La numeració segueix el [versionat semàntic](https://semver.org/lang/ca/) (`MAJOR.MINOR.PATCH`). Mentre som a `0.x`, una MINOR pot trencar la compatibilitat de mons existents; quan passi, s'indica a "Atenció".
- Cada versió té una etiqueta de git anotada (`vX.Y.Z`) al commit on es tanca.
- Com treballar-hi: [`docs/VERSIONS.md`](docs/VERSIONS.md). El detall tècnic i les decisions: [`docs/REGISTRE-TREBALL.md`](docs/REGISTRE-TREBALL.md).

## [Pendent]

### Atenció
- **Fusió de les branques `main` (Oriol) i `Aw` (Arnau)** el 2026-10-04: aquesta versió inclou tot el sobrenatural i els artefactes de `main` (equilibri, manifestar, resistir, contrarestar, desfer, prendre el control, constructor d'efectes i artefactes, R+D, artefactes modulars, assistent de creació, accions complexes) i tota la feina d'`Aw`.
- Els combats començats amb una versió anterior poden tenir el marcador desfasat: el DJ el corregeix amb el botó «Avança».

### Afegit
- **Fase de declaració:** en començar el combat, si algú no ha declarat, s'anuncia «Declareu les accions» i el combat no arrenca fins que declara l'últim. Llavors comença el temps actiu i el rellotge salta directament fins al primer que actua.
- **Anuncis sobre la pantalla:** «Declareu les accions», «Comença el temps actiu» i «El rellotge de temps actiu avança n tics».
- **Tracker:** el títol mostra el tic («Tic N»); el DJ hi té el botó **Avança**, actiu només quan ningú ha d'actuar al tic actual. Les files de qui no li toca surten atenuades i amb els botons bloquejats; les icones que toca fer servir fan pampallugues.
- **Objectiu de l'atac** al diàleg de declarar, amb la distància a cada combatent i un avís si un atac cos a cos no arriba. L'atac es resol contra aquell token; si no n'hi ha cap, es demana en resoldre.
- **Defensa completa:** es tira en declarar-la, sempre concentrada (+1 dau), i tots els atacs que rep fins al final del seu torn es resolen contra aquesta tirada, sense diàleg ni reaccions.
- **Últimes tries:** durant un combat, els diàlegs de declarar i de reacció proposen el que cada combatent va triar l'últim cop.
- **En acabar el combat** es recuperen les reaccions i s'esborren els estats temporals (abatut, atordit, atrapat, concentrat, empès, immobilitzat, llançat, marejat, lent).
- **Món de proves compartit** a `mon-proves/`, amb instruccions.
- **Moviment en temps actiu** (decisions de l'Oriol FM, 2026-09-27):
  - **Distàncies**, a les fitxes de PJ i PNJ: caminar = AGI×2 + MID − 3; córrer = AGI×5 + (MID − 3)×2; saltar = AGI×3 + ⌈(MID − 3)/2⌉. En metres, amb un mínim d'1.
  - **Bloqueig entre tokens:** la mida mitjana o més gran bloqueja sempre; la petita o diminuta només bloqueja si és enemiga. Els morts no bloquegen, i no es pot acabar sobre un altre token.
  - **Camí:** el token voreja parets i tokens que bloquegen (A* sobre la quadrícula quadrada o hexagonal) en lloc d'anar en línia recta.
  - **Moviment en el torn:** amb un combat començat, el jugador només mou el seu token quan el seu combatent actua. Sempre pot caminar amb l'acció declarada. La distància és acumulativa en tot el torn, repartida en tants trams com vulgui. El DJ no té límit.
  - **Tipus de moviment al diàleg de declarar:**
    - bàsic;
    - ràpid (acció "Només moviment");
    - especial, amb +2 de latència;
    - càrrega, amb +2 de latència i, si s'ha mogut 2 m o més, +1 dau i +1 de dany (manual, l. 2794).

### Canviat
- **Blocar amb el cos** també contra atacs armats si el defensor té armament natural (urpes, banyes…) o armadura natural, com a l'exemple del gólem del manual.
- Si el defensor no té cap reacció lliure, es defensa amb la defensa bàsica sense diàleg, però amb un avís i «(sense reaccions)» al xat.
- Les maniobres d'arts marcials es trien en declarar l'acció (ja no en resoldre-la).

### Corregit
- El missatge de defensa mostrava «Defensa 1» en lloc de la defensa resultant (mínim defensa bàsica +1).
- Les defenses completes ja no tornen a demanar la tirada al torn del defensor.
- Si el DJ no pot aplicar el dany o els estats d'un atac (desconnectat, massa lent o camp rebutjat), l'atac ja no desapareix: la tirada surt al xat amb una nota perquè el DJ ho apliqui a mà. El temps d'espera del relé passa de 15 a 30 segons.
- El camí del moviment ja no es queda a mig fer quan passa per l'extrem d'una paret (sense retallar cantonades en diagonal).
- En tornar a declarar una acció, les dades de l'acció anterior (maniobra, retard…) ja no es barregen amb les de la nova.

## [0.4.0] - 2026-09-27

### Afegit
- **Defensa decidida per qui toca:** quan s'ataca un PNJ, el diàleg de defensa s'obre al DJ (o al jugador propietari del defensor), no al jugador que ataca. Si no respon, s'aplica la defensa passiva.
- **Defensa automàtica per als PNJ** (selector "Defensa" a la fitxa): pregunta-ho al DJ, sempre passiva, la millor activa, esquivar, parar o blocar.
- Mecanisme de preguntes pel socket (`preguntarA` / `registrarPregunta`).
- **Proves unitàries** a `tests/unitaris/` (`npm test`).
- **Proves de joc en un Foundry real sense pantalla** a `tests/joc/` (Playwright, sessions de DJ i Jugador): bateria general i bateria de combat.

### Canviat
- **Dues armadures:** es calcula com diu el manual (l. 3337): la rígida més la meitat de la flexible, arrodonint amunt.
- **Pífia en esquivar:** el dany extra se suma al dany final, després de la protecció (manual, l. ~4018).

### Corregit
- Els personatges jugadors es creen amb el token enllaçat. Abans, el combat escrivia la concentració, el dany i les ègides en una còpia del token.
- La icona de l'estat *sagnant* no existia a Foundry (error 404).

### Atenció
- Els PJ creats abans d'aquesta versió s'han d'enllaçar a mà: Configurar token prototip → "Enllaçar dades de l'actor".

## [0.3.0] - 2026-09-27

Revisió completa del codi (vegeu [`docs/REVIEW-PLAN.md`](docs/REVIEW-PLAN.md)), en quatre onades.

### Afegit
- **Relé d'autoritat del DJ pel socket:** els jugadors poden atacar i curar actors que no són seus. Inclou una llista blanca de camps permesos.
- **Regles de combat:**
  - penalització de salut;
  - armadures equipades;
  - ègides que es reactiven per ticks del rellotge;
  - concentració;
  - maniobres d'arts marcials;
  - abast de vora a vora;
  - tirada de defensa al xat.
- **Regles del manual:** escopetes, pífia en esquivar, mitjans de blocar, retard de barallar-se i requisits de curació.
- **Fitxes:** fitxa d'objectes, classe base comuna per a PJ i PNJ, biografia, confirmació en esborrar, armadura equipable.
- **Idiomes:** traduccions completes en català, castellà i anglès.
- **Documentació:** el manual del joc a `docs/manual/`, `CLAUDE.md` i el README reescrits.

### Canviat
- **Atributs d'atac segons el manual:** armes cos a cos, DES; barallar-se, FOR; llancívoles, AGI.
- **Els PC gastats descompten els PX:** millorar amb PX ja no esgota el pressupost de creació.

### Corregit
- Hooks que s'executaven a tots els clients, cosa que duplicava l'atac "Cop".
- Torns que se saltaven després de declarar una acció.
- Barres de salut del token.
- Estat "mort" per marcar derrotats.
- Sobreescriptures d'ajudants Handlebars del nucli.
- `build-manual.mjs` esborrava les fonts si faltava la carpeta d'entrada.

### Eliminat
- Codi mort: el diàleg de tirada antic, plantilles sense ús i dades d'exemple.

## [0.2.0] - 2026-08-28

Estat del repositori abans de la revisió (commit `f972f65`): manual integrat com a compendi de referència.

[Pendent]: https://github.com/OriolFM/FORJA-FoundryVTT/compare/v0.4.0...Aw
[0.4.0]: https://github.com/OriolFM/FORJA-FoundryVTT/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/OriolFM/FORJA-FoundryVTT/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/OriolFM/FORJA-FoundryVTT/releases/tag/v0.2.0
