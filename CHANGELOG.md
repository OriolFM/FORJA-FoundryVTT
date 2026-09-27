# Registre de canvis

Tots els canvis rellevants del sistema FORJA per a Foundry VTT, per versions.

- El format segueix [Keep a Changelog](https://keepachangelog.com/ca/1.1.0/).
- La numeració segueix el [versionat semàntic](https://semver.org/lang/ca/) (`MAJOR.MINOR.PATCH`). Mentre som a `0.x`, una MINOR pot trencar la compatibilitat de mons existents; quan passi, s'indica a "Atenció".
- Cada versió té una etiqueta de git anotada (`vX.Y.Z`) al commit on es tanca.
- Com treballar-hi: [`docs/VERSIONS.md`](docs/VERSIONS.md). El detall tècnic i les decisions: [`docs/REGISTRE-TREBALL.md`](docs/REGISTRE-TREBALL.md).

## [Pendent]

### Afegit
- Moviment en temps actiu (en curs):
  - bloqueig entre tokens segons la mida i el bàndol;
  - distàncies de caminar, córrer i saltar;
  - moviment només en el propi torn, amb la distància acumulada;
  - càrrega;
  - camí que voreja parets i tokens.

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
