# Registre de treball

**Aquest és el document de referència de tots els canvis del sistema.** Recull què s'ha fet, per què, amb quines decisions i què queda pendent. S'actualitza amb cada commit.

Fins al 2026-10-04 hi havia dues línies de treball:
- **`main` (Oriol):** onades 0–4 del pla original, fins al sobrenatural i els artefactes (S-xx, M-xx).
- **`Aw` (Arnau):** revisió de codi, relé del DJ, moviment i proves (WP-xx).

El 2026-10-04 es van fusionar a `main` (vegeu «Sessió 2026-10-04»). La història de `main` abans de la fusió és a la carpeta de disseny, fora del repositori (`FORJA_RPG/FOUNDRY/08_PLA_IMPLEMENTACIO.md` i `09_CONTEXT_SESSIONS.md`).

| Document | Per a què |
|----------|-----------|
| **Aquest registre** | Història detallada de la branca: commits, decisions, contractes entre mòduls, troballes i pendents. |
| [`../CHANGELOG.md`](../CHANGELOG.md) | Canvis per versió, pensat per als usuaris del sistema. La feina en curs va a `[Pendent]`. |
| [`VERSIONS.md`](VERSIONS.md) | Com es numeren i es tanquen les versions. |
| [`PROVES.md`](PROVES.md) | Totes les proves: què proven, com es fan, com s'executen i els resultats. |
| [`PLA-MANUAL-COMPLET.md`](PLA-MANUAL-COMPLET.md) | Què falta del manual bàsic i pla per fases (2026-10-06). |
| [`REVIEW-PLAN.md`](REVIEW-PLAN.md) | La revisió de codi original: troballes (A1, B3…) i pla per paquets. |
| [`../CLAUDE.md`](../CLAUDE.md) | Arquitectura del codi tal com és ara. |
| [`FORJA_FC001CA_CORE.md`](FORJA_FC001CA_CORE.md) | El manual del joc (v3, revisat el 2026-10-04): font de veritat de les regles. |
| [`../mon-proves/README.md`](../mon-proves/README.md) | El món de proves compartit i com fer-lo servir. |

## Com s'ha treballat

1. **Revisió de codi** (2026-09-27) de tot el repositori, contra l'API de Foundry v13. Les troballes són a `REVIEW-PLAN.md`.
2. **Pla per paquets de treball** (WP-A … WP-I, WP-D1–D3, WP-M). Cada paquet té els seus fitxers en exclusiva, perquè diversos agents puguin treballar alhora a la mateixa carpeta.
3. **Agents per onades.**
   - Els agents no fan commits: el coordinador revisa la feina, passa les proves i fa el commit.
   - Model per tasca: Opus per al que és crític (multijugador, torns, combat, moviment), Sonnet per a feina especificada que demana criteri, i Haiku per a canvis mecànics.
4. **Criteri de regles:** mana el manual, tret que es contradigui (Oriol FM). Les contradiccions i els buits es documenten aquí i es pregunten.
5. **Verificació a cada canvi:**
   - `node --check` de tots els mòduls;
   - proves unitàries (`npm test`);
   - proves de joc en un Foundry real sense pantalla, v13 i v14.

   Tot el detall és a [`PROVES.md`](PROVES.md).

## Commits

| Commit | Versió | Contingut |
|--------|--------|-----------|
| `f972f65` | 0.2.0 | Estat del repositori abans de la revisió. |
| `156f185` | | Revisió i pla (`docs/REVIEW-PLAN.md`); `system.json` amb `"socket": true`. |
| `76bfdbc` | | **Onada 1:** relé del DJ pel socket (A2); hooks només al client que toca (A1); ordre de torns estable i `nextTurn` amb una sola escriptura (A3, D5); els PC ja no compten els PX (A4); barres de salut del token (A6); latència de les armadures (B2); càrrega de JSON robusta (D4); estat `dead` (A8); fora les sobreescriptures d'ajudants Handlebars (A7); codi mort (C4); fitxers LevelDB fora de git (C7); `build-manual.mjs` segur (A5); manual del joc a `docs/manual/`. |
| `01fa086` | | **Onada 2:** regles de combat (WP-F: B1, B3–B7, B9, B10, C2); fitxes amb classe base comuna i fitxa d'objectes (WP-G); atributs d'atac segons el manual (Q1); llista blanca del relé. |
| `e78b51b` | | Registre de treball i paquet WP-I al pla. |
| `ac8f587` | | **Onada 3:** les cinc regles pendents del manual (WP-I: B13–B17), documentació (WP-D3) i camp `propietats` de les armes. |
| `2660bc8` | | **Onada 4a:** identificadors de diàleg únics (D7) i textos fixos passats a claus de traducció (C1). |
| `4c44401` | | **Onada 4b:** traduccions completes ca/es/en (WP-D1). |
| `92dbacc`, `e846ea1` | | Registre: hash de l'onada 4b i graf de graphify. |
| `2b34cde` | 0.3.0 | Registre: l'Oriol confirma DES per impactar i FOR per al dany en cos a cos. |
| `f29ba61` | | Dues armadures i pífia en esquivar tal com diu el manual. |
| `f7790a4` | | Primera bateria de proves de joc a Foundry 13.351 (10/10); icona de *sagnant* corregida. |
| `5c77b8c` | | Bateria de combat a Foundry (16/16), proves unitàries al repo, PJ amb el token enllaçat. |
| `18e104a` | | La defensa del PNJ la decideix el DJ (o el propietari del defensor); defensa automàtica configurable. |
| `7de4b7a` | 0.4.0 | Control de versions: `CHANGELOG.md`, `VERSIONS.md`, `npm run versio`, etiquetes. |
| `0c3bcd0` | | Moviment en temps actiu (WP-M). |
| `4d36051` | | Proves de moviment (10/10); camí sense retallar cantonades; l'atac no es perd si falla el relé. |
| `518c932` | | Proves a Foundry v14 i proves compatibles amb v13 i v14. |
| `fd5f25b` | | Documentació: registre reescrit, `docs/PROVES.md`, README i `CLAUDE.md` al dia. |
| `38a0328` | | Proves de combat: esperes adaptades a la lentitud de la màquina (U3, U6). **Primer push de la branca i de les etiquetes a GitHub.** |
| `e9bd940` | | Resultats: combat a la v14, 17/17. |

### Sessió 2026-10-04 (Oriol, amb Claude): fusió i proves a Foundry v14

Proves fetes a mà per l'Oriol al món `forja-betatest` (Foundry v14, Windows) i verificades amb Playwright contra el mateix Foundry (vegeu `PROVES.md`). Proves unitàries: 27/27 a cada commit.

| Commit | Contingut |
|--------|-----------|
| `3a4ce13` | Dades i construcció d'efectes alineades amb el manual v3: latència de ritual 10, autoeina 5 PC/nivell, activació complexa d'artefactes, dificultat mínima 1 amb retorn de 5 PC per punt, efectes i artefactes recalculats. |
| `13a0834` | **Fusió de `Aw` a `main`.** Torns d'`Aw` (flag `actiu` + `fiDeTorn`) amb l'equilibri, la recàrrega d'artefactes i els tics d'estats de `main`. Moviment d'`Aw`. Abast vora a vora (`Aw`) amb el rang per FOR i l'avantatge d'abast (`main`). Decisió de defensa d'`Aw` amb defensar els altres (`main`). Maniobres triades en declarar (`Aw`), sense el diàleg de maniobra en resoldre. Fitxes amb la base `FullActorBase` d'`Aw` i tots els handlers de `main`. Relé ampliat (Token x/y, `nyapsActiu`, Lent/2 d'Interrupció, disputa de control). Traduccions unides (641 claus). |
| `4ebff92` | Una sola còpia del manual, a `docs/FORJA_FC001CA_CORE.md`. |
| `6a3d46b` | L'objectiu de l'atac es declara en declarar (amb la distància de cada combatent) i l'atac es resol contra aquell token. |
| `bc25ca2` | Fase de declaració, anuncis sobre la pantalla, icones destacades; un atac sense objectiu el demana en resoldre. |
| `4a6c2f3` | Tracker: files de qui no li toca deshabilitades; títol «Tic N» i botó «Avança» del DJ. |
| `7ecd928` | Blocar amb el cos contra atacs armats si el defensor té armament o armadura natural. |
| `5265da1` | Defensa completa: es tira en declarar (concentrada) i val per a tots els atacs fins al final del torn. |
| `70c095e` | Avís quan el defensor no té reaccions i es defensa amb la defensa bàsica. |
| `9c886b9` | En acabar el combat: reaccions recuperades i estats temporals esborrats. |
| `d9a2808` | El missatge de defensa mostrava 1 en lloc de la defensa resultant. |
| `d8ee275` | Els diàlegs proposen l'última tria de cada combatent durant el combat. |
| *(aquest)* | Món de proves al repositori (`mon-proves/`) i documentació al dia. |

### Sessió 2026-10-06 (Oriol, amb Claude, al núvol): completar el manual bàsic

Pla aprovat a [`PLA-MANUAL-COMPLET.md`](PLA-MANUAL-COMPLET.md) (fases 1–7). Al contenidor del núvol no hi ha Foundry: les proves de joc de cada fase queden anotades a `PROVES.md` per passar-les en local.

| Commit | Contingut |
|--------|-----------|
| `4050ff8` | Revisió del que falta del manual i pla per fases. |
| `7470c32` | **Estats amb efecte i textos flotants.** Regles pures a `module/estats/regles-estats.mjs` (restriccions per estat, tipus d'acció i moviments bloquejats, estats per salut, Recuperació/X, tirades d'estat); part de Foundry a `aplicacio-estats.mjs` (sincronitzar inconscient/incapacitat amb la salut, pèrdua d'acció a l'inici del torn, tirades d'estat, llista per a la fitxa) i `notificacions.mjs` (textos flotants). Connectat a derivats (abatut +2 latència, vigilant +1 reacció, berserc sense penalització), diàleg de declarar, resoldre, defensa, moviment del token, `totsHanDeclarat` i `_estaHabilitat`. Recuperació/X corregida. |
| `8d15c01` | **Creació d'artefactes i efectes per paràmetres.** `construccio.mjs`: `costParametre` i `calcularParametres` (mateixos valors que `skills/forja-parametres`), amb recàrrega, acumulador, armes i armadures base (`parametres.json`: `armesBase`, `armaduresBase`, `artefacteCarrega`), dificultat i latència declarades, permanents i paràmetres repetits; `calcularConstruccio` (selecció antiga) hi delega. Les 83 plantilles porten `parametres` i `construccio` (convertits de `plantilles.py`); prova 83/83. Constructor nou (llista de paràmetres, pot partir d'un efecte existent). `ItemEfecte`/`ItemArtefacte`: `parametres`, `construccio`; artefacte: `activacio.atribut/habilitat`; mòduls amb `parametres`. Fitxa d'efecte i d'artefacte completes amb el desglossament. Migració 1 (`module/migracio/migracio.mjs`). |
| `cd4c2b3` | **Ús d'efectes i artefactes (primera part).** `combat/resultat-parametres.mjs` (pur): què fa cada paràmetre (dany = nivell + excedent, directe/drenatge, curació, estats amb X o modificador, bonificacions, autoeines, narratius) i armes/armadures que són artefactes. `combat/aplicar-efecte.mjs`: aplica el resultat pel relé (estats com a ActiveEffect amb `flags.forja.efecteForja`, bonificacions a `flags.forja.bonus`, armadura i ègida temporals) i el publica al xat; `netejarTemporals` (escena en acabar el combat, instantània quan avança el rellotge). `combat/artefactes-vinculats.mjs`: arma i armadures vinculades a cada artefacte basat en arma o armadura (hooks create/update/deleteItem). `ferAtac`: càrrega de l'artefacte, dany directe, pista i estats en impactar. Derivats: bonificacions d'artefactes sempre actius i d'efectes; la fitxa i les millores fan servir els valors base (`valorsBase`). `combat/decisio-resistencia.mjs`: la resistència la decideix el jugador de l'objectiu o el DJ. `combat/usar-efecte.mjs`: manifestar (diversos objectius, ressonància, pista) i activar artefactes (tirada d'activació, prototips). Relé: `esCreacioEfecteForja`. |
| `5909132` | Tracker: declarar «Manifestar un efecte» i «Activar un artefacte» (latència bàsica + la de l'efecte o artefacte, objectiu declarat) i resoldre-ho. Efectes de reacció al diàleg de defensa (`opcionsEfectesReaccio`, decisio-defensa). Àrees: els objectius són els tokens dins la plantilla dibuixada (`actorsDinsPlantilla`). Estats: manifestar i activar compten com a «altra acció». |
| `fb4dc9f` | **Experiència.** `progressio/experiencia.mjs` (pur): taula de recompenses, 16 virtuts, regla d'una virtut per PJ, historial. `apps/dialeg-repartir-px.mjs`: eina del DJ (botó al directori d'actors) amb objectius de grup, individuals, virtut i altres; suma `px.total` i anota l'historial. `px.historial` a l'schema; totes les despeses (`canvisDespesaPX`) s'hi anoten; la fitxa del PJ mostra l'historial. |
| `512be74` | **Contingut del manual en compendis** (feta per un agent Sonnet en una còpia de treball, recuperada i regenerada amb els catàlegs actuals). `scripts/build-packs.mjs` llegeix els blocs del manual (6 PJ, 25 PNJ, 7 animals, 9 criatures) i els catàlegs (95 trets, 27 armes, 5 armadures, 18 artefactes i 65 efectes amb paràmetres) i genera `packs/_source/<compendi>/`; `npm run build:packs` els compila. `tests/unitaris/contingut.test.mjs` recalcula el cost i els derivats de cada actor contra el manual: cap diferència. Incidències i suposicions a `docs/CONTINGUT-INFORME.md`. |
| *(fase 6)* | **Maniobres, modes de tret, àrees i escut.** `combat/modes-tret.mjs` (pur): ràfega, automàtic, regles d'àrea (escopeta, dispersió, automàtic, foc automàtic), abast i fuga. `combat/atac-multi.mjs`: tirada única, atac contra un objectiu amb la seva defensa (`atacarAmbDefensa`), atac d'àrea per plantilla, Combinació (segon cop al torn següent, hook del DJ) i Contraatac (en parar o blocar un atac). `ferAtac`: `rollPrevi`, `bonusMode`, `dimMak`. Catàleg: propietats `rafega`, `automatic`, `feixuga`, `focAutomatic`, `areaDispersio`, `perillosa`; armes de dispersió i de suport noves. Escut: +1 a la defensa bàsica. |

## Versions

Versionat semàntic, `CHANGELOG.md` i etiquetes de git anotades. El procediment és a [`VERSIONS.md`](VERSIONS.md).

| Versió | Etiqueta | Contingut |
|--------|----------|-----------|
| 0.2.0 | `v0.2.0` → `f972f65` | Estat inicial del repositori. |
| 0.3.0 | `v0.3.0` → `2b34cde` | Revisió de codi, onades 1–4. Etiqueta posada a posteriori. |
| 0.4.0 | `v0.4.0` → `7de4b7a` | Regles segons el manual, proves de joc, token del PJ enllaçat, defensa decidida pel DJ, control de versions. |
| 0.5.0 | *(en curs)* | Moviment en temps actiu i correccions trobades amb les proves. |

En tancar cada versió MINOR o MAJOR, `npm run versio` també actualitza el graf de graphify.

## Decisions de disseny

| Tema | Decisió | Font |
|------|---------|------|
| Atribut dels atacs (Q1) | Armes cos a cos: **DES** + armes cos a cos. Arts marcials: **DES**. Barallar-se i armes naturals: **FOR**. Distància: **DES**, excepte les llancívoles, que van amb **AGI**. El dany de les armes cos a cos és FOR + bonus (`danyBase`, p. ex. `FOR+2`). | Manual, l. ~2896 i 3024. Confirmat per l'Oriol FM (2026-09-27). |
| Armes improvisades | Habilitat *armes improvisades*; si es llancen, AGI. **Interpretació pròpia: el manual no ho especifica.** | Manual, l. 1295, 2975, 3024, 3055 |
| Ègides (Q2) | El temps inactiu compta en **ticks del rellotge**. Fora de combat, s'avisa que cal reactivar-la a mà (és una acció lliure). Si el combat s'esborra, les ègides pendents es reactiven. | Oriol FM, 2026-09-27 |
| Dues armadures (Q3) | La base és la millor armadura rígida (o natural), i una flexible hi suma **la meitat** de la seva protecció (arrodonint amunt). Dues rígides no s'apilen. Les latències s'apilen senceres. Reprodueix els exemples del manual: Von Blum 5 + ⌈3/2⌉ = 7; Bauer 1 + ⌈1/2⌉ = 2. | Manual, l. 3337 (l'Oriol va establir que mana el manual). |
| Empat contra la defensa passiva | N'hi ha prou amb igualar-la. **Contradicció del manual pendent de l'Oriol.** | Manual, l. 2354 i 3143 (impacta) contra l. ~2904 (falla) |
| PC gastats | PC gastats = cost total de la fitxa − PX gastats. Els canvis manuals en mode edició compten com a PC. | WP-B |
| Escopetes (B13) | Les armadures rígides protegeixen el doble contra les armes amb la propietat `escopeta`. | Manual, l. 3091 |
| Pífia en esquivar (B14) | +1 de dany per cada 1 de la tirada pifiada, només en esquivar i si l'atac impacta, sumat al **dany final**. | Manual, l. ~4018 |
| Blocar (B15) | Cos → resistència contra atacs naturals, **i també contra atacs armats si el defensor té armament natural (no el Cop bàsic) o armadura natural**; escut → armes cos a cos; objecte → armes improvisades. La bonificació no supera la reducció natural. | Manual, l. 3177–3185 i exemple l. 3832–3836 (el gólem bloca l'espasa de la Yoko). Oriol FM, 2026-10-04 |
| Retard de barallar-se (B16) | Cada +1 de latència dona +1 dau, fins al nivell de barallar-se. No es combina amb maniobres. | Manual, l. 2902 i 2927 |
| Requisits de curació (B17) | Primers auxilis ≥ 1; tractament mèdic ≥ 2. Curar-se un mateix, només el DJ. | Manual, l. 3486–3502 |
| Glossari de traducció | fita → éxito / hit; pífia → pifia / botch; ègida → égida / aegis; latència → latencia / latency; PX → PX / XP; DJ → DJ / GM; PNJ → PNJ / NPC; guanxi no es tradueix; els codis d'atribut no es tradueixen. | WP-D1 |
| Qui tria la defensa | La configuració automàtica del PNJ, si en té. Si no, el jugador propietari del defensor connectat. Si no, el DJ, amb un diàleg que li arriba pel socket. Mai el jugador que ataca un PNJ. | Oriol FM, 2026-09-27 |
| Defensa automàtica | Per PNJ: pregunta-ho al DJ (per defecte), sempre passiva, la millor activa, esquivar, parar o blocar. Sense reacció, passiva. | Oriol FM ("com a mínim amb els minions") |
| Token del PJ enllaçat | Els personatges es creen amb el token enllaçat i amistós. Els PNJ, no enllaçats. | Error trobat a les proves de joc |
| Moviment: bloqueig | Mida ≥ 3 bloqueja sempre; mida ≤ 2 només si és enemic. Els morts no bloquegen. No es pot acabar sobre un altre token. | Oriol FM, 2026-09-27 |
| Moviment: distàncies | Caminar = AGI×2 + MID − 3; córrer (i càrrega) = AGI×5 + (MID − 3)×2; saltar = AGI×3 + ⌈(MID − 3)/2⌉. En metres, mínim 1. Fórmules de la versió antiga (el manual no dona xifres). | Oriol FM, 2026-09-27 |
| Moviment en el torn | En el seu torn d'acció, un personatge sempre pot caminar a més de l'acció declarada; amb una defensa completa com a acció també; com a reacció, no. Distància acumulativa en tot el torn. Fora de combat, sense límit. El DJ, sense límit. | Oriol FM, 2026-09-27; manual l. 2742+ |
| Tipus de moviment | Bàsic (caminar, amb l'acció); ràpid (córrer, acció "Només moviment"); especial (+2 latència); càrrega (córrer + atac cos a cos, +2 latència; si s'ha mogut ≥ 2 m, +1 dau i +1 de dany). | Manual, l. 2742–2794 |
| Camí | El token voreja parets i tokens que bloquegen (A* sobre la quadrícula). En quadrícula quadrada no es retallen cantonades en diagonal. | Queixa de l'Oriol ("ho compta tot en línia recta") |
| Fase de declaració | En començar el combat, si algú no ha declarat, el combat no arrenca: s'anuncia «Declareu les accions». Quan declara l'últim, comença el temps actiu i el marcador salta directament a la primera posició ocupada. | Oriol FM, 2026-10-04 |
| Anuncis | Sobre la pantalla, a tots els clients: «Declareu les accions», «Comença el temps actiu» i «El rellotge de temps actiu avança n tics» a cada avanç. | Oriol FM, 2026-10-04 |
| Qui pot actuar | Només el combatent actiu, si és a la casella del marcador, té la fila habilitada i pot resoldre o declarar. Els altres surten atenuats i bloquejats. Qui entra al combat sense posició pot declarar. | Oriol FM, 2026-10-04 |
| Avançar el temps | El DJ té el botó «Avança» al títol del tracker («Tic N»). Només s'activa quan ningú ha d'actuar al tic actual. | Oriol FM, 2026-10-04 |
| Objectiu de l'atac | Es declara en declarar l'atac. L'atac es resol contra aquell token encara que s'hagi mogut. Si és cos a cos i s'ha allunyat, l'acció es perd. Si no n'hi ha cap de declarat ni marcat, es demana en resoldre. | Oriol FM, 2026-10-04 |
| Defensa completa | Es tira en declarar-la, sempre concentrada (+1 dau). Tots els atacs que rep es resolen contra aquesta tirada, sense preguntar ni gastar reaccions. Dura fins al final del seu torn: en el seu tic, els atacs que rep es resolen abans (ordre de `_sortCombatants`), i en declarar la propera acció s'acaba. Mínim: defensa bàsica +1 (o la de l'atac concret, si és més alta). | Oriol FM, 2026-10-04; manual l. 3159 i 3171 |
| Sense reaccions | Si el defensor no té cap reacció lliure, s'aplica la defensa bàsica sense preguntar, amb un avís i «(sense reaccions)» al xat. Les reaccions es recuperen al final del propi torn. | Manual (reaccions); Oriol FM, 2026-10-04 |
| Final del combat | Es recuperen les reaccions, es treu la concentració i s'esborren els estats temporals (`fiCombat: true` a `estats.json`: abatut, atordit, atrapat, concentrat, empès, immobilitzat, llançat, marejat, lent). Els persistents es mantenen. | Oriol FM, 2026-10-04 |
| Últimes tries | Durant un combat, el diàleg de declarar proposa l'última tria del combatent (tipus, arma, maniobra, defensa, moviment, retard, objectiu) i el de reacció l'última defensa. En acabar el combat s'oblida. | Oriol FM, 2026-10-04 |
| Estats (Fase 1) | Els efectes dels estats s'apliquen (qui no es pot moure no es mou fins que pertoqui). Visualment, text flotant al costat del token quan es guanya o es perd un estat, quan es rep fatiga, ferides o curació, i quan s'intenta una acció que l'estat impedeix. | Oriol FM, 2026-10-06 |
| Estats que no actuen | Inconscient, incapacitat i marejat no poden actuar. Inconscient i incapacitat perden el torn i es tornen a situar al rellotge amb la latència bàsica (perquè el rellotge no s'encalli i tornin a tenir torn quan es recuperin); no cal que declarin per començar el combat. Marejat pot provar la tirada per declarar. | Manual l. 3602, 3612, 3640. **Interpretació pròpia** (com no encallar el rellotge). |
| Atordit | Perd l'acció declarada quan arriba el seu torn, ha de tornar a declarar (latència habitual des de la casella actual) i l'estat s'acaba, tant si tenia acció declarada com si no. | Manual l. 3564 |
| Moviment i estats | Atrapat, immobilitzat, inconscient, incapacitat i marejat no mouen el token (en combat i fora; el DJ sí). Abatut no pot córrer: el permís es limita a caminar encara que hagués declarat córrer o càrrega. | Manual l. 3554, 3566, 3596. Oriol FM, 2026-10-06 |
| Defensa i estats | Abatut i atrapat no esquiven; berserc cap defensa activa; immobilitzat, incapacitat i inconscient tenen defensa bàsica 1. Atrapat no té defensa bàsica 1 (el manual no ho diu). | Manual l. 3151, 3554, 3568, 3578 |
| Berserc | Compta com a dur de pelar i incansable: cap penalització de salut (ni de ferides ni de fatiga). | Manual l. 3578, 1557, 1593 |
| No automatitzat dels estats | Esguerrat (quina extremitat; restriccions de cama), malaltia/toxina (efectes variables), empès i llançat (distància i dany contra superfícies), acovardit (que el moviment sigui per allunyar-se). Tenen la tirada a la fitxa i el DJ n'aplica la resta. | Judici del DJ |
| Paràmetres d'efectes i artefactes (Fase 2) | Cada efecte o artefacte es descriu amb una llista de paràmetres (com el skill `forja-parametres`). Sense dificultat declarada (armes, armadures i artefactes sense tirada) no hi ha ajust de cost; el constructor puja a 1 la dificultat calculada inferior als efectes i dispositius (−5 PC per punt). La latència total d'un artefacte basat en arma o armadura és la de la base declarada més la de cada eina (+1), com a la Holocapa (0 + 1 + 1 = 2). | Manual l. 4758, 4776, 4163; skill `forja-parametres` (83/83) |
| Tirada d'activació d'artefactes | Atribut + habilitat al mateix artefacte (`activacio.atribut/habilitat`). El manual només la diu al Tornavís sònic (INT + enginyeria); per a la resta es demanarà en activar-lo (Fase 3). | Manual l. 4143, 4157 |
| Resultat dels efectes (Fase 3) | Automàtic. Dany = modificador + excedent de la tirada de manifestar/activar; indirecte passa per ègida, armadura i reducció; directe i drenatge no. Curació sense excedent. Estats parametritzats: X = nivell; la resta: el nivell suma a la dificultat per resistir-los (base: la dificultat de l'efecte). | Manual l. 4949–5135; Oriol FM, 2026-10-06 |
| Pista del dany per tipus | Foc, àcid i electricitat → ferides; fred i malaltia → fatiga; explosió i radiació → totes dues; «fatiga o ferides» es tria (o la més greu). **Electricitat, àcid i malaltia són interpretació pròpia.** | Manual l. 3271 |
| Armes i armadures artefacte | Objectes vinculats (arma/armadura) amb `flags.forja.artefacteId`. Dany de l'arma = atribut del catàleg + dany de la base + dany del paràmetre (Espasa d'energia: FOR+8 directe). Latència de l'armadura = la de l'artefacte (Holocapa 2). Cada atac gasta una càrrega. | Manual l. 4163, exemples de la Trace (l. 3247) |
| Bonificacions | Atributs i habilitats d'artefactes sempre actius (permanents, armes, armadures equipades) i d'efectes actius se sumen als derivats; els PC i les millores es calculen amb els valors base. Les eines sense habilitat (Ciberbraç) no compten fins que es defineix l'habilitat. | Oriol FM, 2026-10-06 |
| Resistència a efectes | Decideix el jugador propietari de l'objectiu o el DJ (com la defensa). Amb diversos objectius, cadascun queda afectat si qui manifesta treu més fites que la seva resistència. | Manual l. 4622 |
| Àrea dels efectes | El manual no en dona la mida: mana la plantilla que dibuixa l'usuari (es consumeix). Sense plantilla, els objectius marcats. | Manual l. 4852 |
| Efectes en temps actiu | Es poden declarar els efectes que no són rituals ni només narratius, i els artefactes d'activació normal o trivial. Latència = bàsica + modificador. L'activació trivial també es declara (interpretació: el manual diu que no compta com a acció). | Manual l. 4796, 4889 |
| Efectes de reacció | Els ofereix qui decideix la defensa; gasten la reacció, es manifesten i l'atac es resol contra la defensa bàsica (amb la protecció que hagin donat). | Manual l. 4808 |
| Repartir PX (Fase 4) | Valors de la taula del manual (grup 4/8/16/32, individual 2/4/8/16, virtut +1). L'eina avisa si una virtut es repeteix però no ho impedeix (el grup pot decidir amb el DJ). Només PJ amb jugador. | Manual l. 6577–6665 |
| Contingut en compendis (Fase 5) | Compendis del sistema: `pj`, `pnj`, `animals`, `criatures`, `trets`, `armes`, `armadures`, `artefactes`, `efectes`. Les maniobres no són Items i no en tenen. Els actors porten trets, armes naturals i el Cop, artefactes i efectes. | Oriol FM, 2026-10-06 |
| Incorporis | El manual (l. 1218) diu que fan servir PER, INT i APL en lloc d'AGI, DES i FOR als derivats; `_prepararDerivats` no ho fa (l'IAssistent surt amb latència 12 en lloc de 6). **Pendent.** | Trobat per la Fase 5 |
| Àrees d'armes (Fase 6) | Escopeta: llàgrima fins al rang mitjà, defensa bàsica 1 + distància, es pot esquivar. Dispersió: llàgrima de 15 m, defensa 5 + distància. Automàtic: àrea al punt objectiu, cal superar la defensa bàsica. Foc automàtic: àrea al punt objectiu, defensa 5 + distància. Plantilla dibuixada per l'usuari; una sola tirada; cada objectiu es defensa per separat. | Oriol FM, 2026-10-06; manual l. 3075–3103 |
| Combinació | Una tirada; el primer cop ara i el segon al proper torn de l'atacant (el resol el DJ); cada cop amb la seva defensa: si s'ha gastat la reacció, el segon ja no es pot esquivar. | Oriol FM, 2026-10-06 |
| Contraatac | En declarar-lo queda en guàrdia; si para o bloca un atac que no impacta, contraataca a l'instant (DES + arts marcials, l'atacant no pot parar ni blocar). Al seu torn ja ha actuat. | Manual l. 2951 |
| Dim Mak | Ignora l'armadura; es tria en declarar: dany normal de ferides o el doble de fatiga després de la reducció. | Manual l. 2955 |
| Escut | +1 a la defensa bàsica sempre que es porti (simplificació: el sistema no sap si s'està fent servir en l'acció). | Manual l. 2985 |
| Autoritat del DJ | Els canvis a documents aliens passen pel DJ (`module/xarxa/socket.mjs`), amb una llista de camps permesos. Fora de combat, un jugador només pot treure fatiga o ferides a un actor aliè. Si el DJ no pot aplicar el resultat d'un atac, la tirada surt igualment al xat amb una nota. | Seguretat |

## Contractes entre mòduls (per a qui continuï)

- **Relé del DJ** (`module/xarxa/socket.mjs`):
  - `actualitzarComGM`, `crearEmbegutsComGM`, `eliminarEmbegutsComGM` i `alternarEstatComGM` per aplicar canvis;
  - `preguntarA(usuari, nom, dades)` i `registrarPregunta(nom, gestor)` per demanar una decisió a un altre usuari.
  - Tot camp nou que un jugador hagi d'escriure en un document aliè s'ha d'afegir a `CAMPS_PERMESOS_PER_TIPUS`.
- **Decisió de defensa** (`module/combat/decisio-defensa.mjs`): `decidirDefensa(...)` tria entre la defensa automàtica, el propietari i el DJ.
- **Derivats:**
  - salut: `salut.{fatiga,ferides}.{value,max}` i `salut.foraDeCombat`;
  - moviment: `moviment.{caminar,correr,saltar}`.
- **Armadura equipada:** `system.equipada` (tot el que no sigui `false` compta com a equipada).
- **Atac d'una arma:** `atributIHabilitatAtac(item)` a `module/combat/equipament-automatic.mjs`.
- **Rellotge:** `flags.forja.{marcador, actiu, actuats}` a `Combat`. El torn és de qui marca `actiu`. `ForjaCombat#fiDeTorn` s'executa al DJ; `calcularSeguentTorn` és una funció pura.
- **Acció declarada:** `flags.forja.accioPendent` del combatent, amb `tipus`, `moviment`, `combatId`, `declaradaAlMarcador`, `movimentEnCurs` i, en un atac, `objectiuTokenId`/`objectiuNom`.
- **Fase i torn:** `flags.forja.fase` a `Combat` (`"declaracio"`/`"actiu"`); `ForjaCombat#iniciarTempsActiu`; `flags.forja.estatTorn` al combatent (`"resolta"`/`"redeclarada"`), que neteja el DJ en acabar el torn. L'avanç es passa a `options.forja.avancTics` i l'inici a `options.forja.iniciTempsActiu` (`combat/anuncis.mjs` els anuncia).
- **Defensa completa** (`combat/defensa-completa.mjs`): `flags.forja.defensaCompleta` al combatent (`opcioId`, `dificultat`, `danyExtra`, `mitjaId`, `combatId`). `resolucioDefensaCompleta` dona la resolució per a un atac concret.
- **Últimes tries:** `flags.forja.ultimaDeclaracio` al combatent; `flags.forja.ultimaDefensa` a l'actor (s'esborra en acabar el combat).
- **Moviment:**
  - `module/combat/moviment.mjs`: lògica pura;
  - `module/documents/token.mjs`: límit per torn a `_preUpdateMovement`;
  - `module/canvas/token.mjs`: cost infinit a caselles bloquejades i A*.
- **Estats** (`module/estats/`): `restriccionsEstats(statuses)` (pura) diu què pot fer un actor; `restriccionsActor(actor)` i `comprovarEstat(actor, motiu, clauAccio)` (que mostra l'estat i avisa) per als fluxos de Foundry. Les opcions de defensa porten `bloquejatPer`. Textos flotants: `textFlotant`, `mostrarCanviEstat`, `mostrarCanviSalut`, `avisarBloqueigEstat` (`notificacions.mjs`); només dibuixen al client local, per això els canvis s'escolten amb hooks a tots els clients.
- **Actor del món i actor del token:** els PNJ tenen tokens no enllaçats. El combat treballa amb l'actor del token, i una macro que passi l'actor del món escriuria en un altre actor.

## Troballes de les proves de joc

Errors que només es veien executant el sistema en un Foundry real (detall a [`PROVES.md`](PROVES.md)):

| Troballa | Estat |
|----------|-------|
| La icona de l'estat *sagnant* no existeix a Foundry (404). | Corregit (`f7790a4`) |
| Els PJ es creaven amb el token no enllaçat: el combat escrivia en una còpia i la fitxa no ho reflectia. | Corregit (`5c77b8c`). Els PJ antics s'han d'enllaçar a mà. |
| El diàleg de defensa del PNJ s'obria al jugador que atacava. | Corregit (`18e104a`): el decideix el DJ. |
| El camí no vorejava una paret (passos en diagonal per l'extrem de la paret). | Corregit (`4d36051`) |
| Si el relé no responia, l'atac desapareixia sense deixar rastre. | Corregit (`4d36051`): surt al xat amb una nota. |
| El combat començat abans de carregar el codi nou quedava amb el marcador a 0 i la Yoko (tic 7) sense torn. | Resolt amb el botó «Avança» del DJ (`4a6c2f3`). |
| A la v14, el títol natiu del tracker («Round N») tapava el marcador. | Corregit (`4a6c2f3`): el títol passa a ser «Tic N». |
| Foundry v14 llança `Cannot use 'in' operator to search for 'turn' in undefined` (`CombatTracker#_onRender`) quan s'actualitza un combat que no és el que mostra el tracker. | Error del nucli de Foundry, sense efecte al sistema. |
| El missatge de defensa mostrava la dificultat interna de la tirada (1) en lloc de la defensa resultant. | Corregit (`d9a2808`). |
| Els avantatges de defensa de l'antic tracker de combat (pregunta al propietari, defensa i dany automàtics) havien desaparegut. | El tracker antic (`module/combat/combat-tracker.mjs`) es va esborrar per accident al commit `b04cf5f` (2026-06-07). El flux equivalent actual és el de `decisio-defensa.mjs`. |
| **U3:** després que el DJ triï la defensa, l'atac no apareixia al xat dins l'espera de la prova. | **No era un error del sistema:** en aquesta màquina la resposta del DJ triga més de 30 s. La prova ara espera fins a 200 s; a la v14, combat 17/17. |

## Graf de coneixement (graphify)

- **Eina:** [graphify](https://github.com/safishamsi/graphify), instal·lada amb `uv tool install graphifyy` (`~/.local/bin/graphify`).
- **Darrera generació:** 2026-09-27, sobre el commit `866e284` (branca `Aw`, amb el moviment de la 0.5.0 en curs): 1.072 nodes, 1.653 arestes i 72 comunitats. Els nodes més connectats són `FullActorBase`, `ForjaCombat`, `actualitzarComGM()` i `ferAtac()`.
- **Generació anterior:** versió 0.4.0 (etiqueta `v0.4.0`), a partir d'una còpia neta: 993 nodes, 1.485 arestes i 50 comunitats.
- **Contingut:** només codi (`.mjs` i `.json`); les plantilles `.hbs` i el Markdown no hi són.
- **On és:** `graphify-out/` (fora de git): `graph.html` (interactiu), `GRAPH_REPORT.md` i `graph.json`.
- **Quan s'actualitza:** amb cada versió MINOR o MAJOR (`npm run versio`), o a mà amb `graphify update .`.

## Preguntes obertes per a l'Oriol

- **Escut, integritat estructural 10 en blocar** (l. 2985): no està automatitzat. Es trenca quan ha absorbit 10 punts? Es pot reparar?
- **Esquivar contra àrees** (l. 3163: «es pot fer servir per posar-se a cobert o tirar-se a terra; el dany es redueix a la meitat»): ara les àrees de dispersió, automàtic i foc automàtic no ofereixen esquivar (el DJ pot reduir el dany a mà). L'escopeta sí que deixa esquivar normalment.
- **Munició** (ràfega 3 bales, automàtic 10): el sistema no compta munició.

Contradiccions del manual o punts on no diu res:

1. **Empat contra la defensa passiva:** les l. 2354 i 3143 diuen que un empat impacta, i la l. ~2904 que falla. Ara impacta.
2. ~~**Esquivar per sota de la defensa**~~ — resolt: el mínim és la defensa bàsica +1 (l. 3159, 3171 i exemple l. 3912). Confirmat per l'Oriol FM (2026-10-04).
3. **Armes improvisades:** quin atribut fan servir. Ara, DES a cos a cos i AGI si es llancen.

## Pendent

> **2026-10-06:** revisió completa del que falta del manual bàsic (estats, artefactes i efectes, experiència, contingut en compendis) i pla per fases a [`PLA-MANUAL-COMPLET.md`](PLA-MANUAL-COMPLET.md). Aquest pla substitueix la llista «A» de sota quan s'aprovi.

### Prioritat (estat a 2026-10-04)

**A. Contingut del manual dins de Foundry** (es fa al món de proves, `mon-proves/`, i després es pot passar a compendis):

Amb tot aquest contingut al repositori, FORJA ja no necessita FORJAPP ni Firebase per importar personatges (Oriol FM, 2026-10-04). El món antic encara guarda un paràmetre de FORJAPP d'una versió anterior que el codi actual no fa servir.

1. **Artefactes del manual (18 plantilles, l. 5361–5516).** El motor ja hi és (catàleg, activació i càrrega S-26, constructor S-23, R+D i modulars S-30), però els artefactes només existeixen com a dades de catàleg (`module/config/dades/artefactes.json`). Cal:
   - revisar-ne el cost, la dificultat i la latència amb les taules del manual v3 (el skill `forja-parametres` els calcula);
   - crear-los com a objectes de Foundry al món de proves (i, més endavant, un compendi);
   - simular-ne l'ús bàsic (activar, gastar càrrega, recarregar, prototip, modular) i anotar-ne els resultats.
2. **Efectes sobrenaturals del manual (65 plantilles, l. 5517–6880: canalització 12, màgia 21, psíquics 13, Qi 19).** Mateix estat: el motor hi és (manifestar, resistir, contrarestar, desfer, prendre el control, equilibri, constructor), però els efectes són dades de catàleg (`efectes.json`). Cal:
   - revisar-los contra el manual v3;
   - crear-los com a objectes de Foundry al món de proves;
   - simular els usos bàsics de cada do (manifestar, resistir, contrarestar, desfer, equilibri i fatiga) i dels efectes.
3. **Personatges del manual al món de proves:**
   - **PJ pregenerats (5, l. 2110–2290):** Magistrada Blume, Magistrat Nagata, Marvin el dèlfic, Trace i Yoko-1. Ara només hi ha la Yoko.
   - **PNJ (l. 6889–7360):** 2 figurants, 22 secundaris (aliats i antagonistes) i la nèmesi d'exemple (Renegat).
   - **Animals (7) i criatures (9) (l. 7361–7649).** Ara només hi ha el gòlem de carn. `criatures-exemple.json` en té dos (gólem de carn menor i aràcnid).
   - Fer servir el skill `forja-creator` per validar-ne el cost i els derivats.

**B. Sistema:**

- **Creadors contra els skills de referència** (`skills/README.md`): el constructor d'efectes i artefactes no té recàrrega, acumulador, armes i armadures base, dificultat i latència declarades, ni l'excepció dels artefactes permanents; cal una prova que reprodueixi les 83 plantilles. El skill `forja-creator` té taules de cost desfasades respecte del manual v3 (el projecte és correcte).

4. **Moviments especials d'armes a distància** (Ràfega, Automàtic, Foc automàtic) i armes que encara no són al catàleg (armes de dispersió i de suport), amb les àrees (esfèric, lliure, llàgrima). Pla detallat a `FOUNDRY/09_CONTEXT_SESSIONS.md`, «PENDENT — moviments especials d'armes a distància». Cal decidir amb l'Oriol la llargada de la llàgrima de les escopetes, el «15*» de les armes de dispersió i el radi de l'automàtic.
5. **Connectar el motor d'àrea** (`area.mjs`, `plantilla.mjs`, `selector-caselles-lliures.mjs`) als efectes i artefactes amb àrea.
6. **Maniobres d'arts marcials pendents:** Dim Mak, Combinació i Contraatac.
7. **Fitxa d'objecte per als efectes** (`efecte`): `FullItem` cobreix tret, arma, armadura i artefacte; els efectes s'obren amb la fitxa genèrica de Foundry. La plantilla d'artefacte tampoc mostra els camps nous (fase de prototip, modular, càrrega).

**C. Proves i versió:**

8. **Repetir les bateries de joc** (`tests/joc/`) a la v13 i la v14 amb els canvis d'aquesta sessió. La bateria de combat s'ha d'adaptar a la fase de declaració, a l'objectiu declarat i al botó «Avança».
9. **Proves unitàries a Windows:** `npm test` falla a Windows perquè les proves importen rutes `E:\…` en lloc d'URL `file://` (vegeu `PROVES.md`). Cal fer servir `pathToFileURL`.
10. **Tancar la versió 0.5.0** quan l'Oriol hagi validat el combat i el moviment: `npm run versio -- minor`, commit, etiqueta `v0.5.0` i push.
11. **Respostes de l'Oriol a les preguntes obertes** que queden: empat contra la defensa passiva i armes improvisades.
12. **Decidir si el manual complet ha de ser públic.** `docs/FORJA_FC001CA_CORE.md` és visible al repositori públic.

### Altres

- **Releases a GitHub:** les adreces `manifest` i `download` de `system.json` no funcionaran fins que es publiqui una release amb `system.json` i `forja.zip`.
- **Regles del manual detectades però no implementades:**
  - l'escut dona +1 a la defensa bàsica (l. 2985/3153);
  - la integritat estructural de l'escut en blocar;
  - la pífia de les armes de dispersió.
- **Moviment, límits coneguts:**
  - l'elevació no es té en compte (els tokens a diferent alçada també es bloquegen);
  - una càrrega resolta sense objectiu no té bonus;
  - els tokens que no són al combat es mouen lliurement durant un combat.
- **Retard de barallar-se:** la tirada sense objectiu (`ferTirada`) no hi suma els daus.
- **Defensar els altres:** qui decideix la defensa del defensor també tria per als protectors que s'hi poden interposar (s'hauria de preguntar a cada protector).
- **Defensa completa i protectors:** contra un defensor amb defensa completa no s'ofereix que ningú s'hi interposi.
- **Concentració de la defensa completa:** el +1 dau s'aplica a la tirada, però l'actor no queda marcat com a concentrat (no perd la concentració si rep dany).
- **Traducció de les dades de joc:** els noms i descripcions dels catàlegs (`module/config/dades/*.json`) només són en català.
- **Claus sense ús:** 15 claus de `ca.json` no les fa servir cap codi (`FORJA.Tab.*`, `FORJA.Hab.Marca`, `FORJA.Tret.Cost`…).
- **Temes menors:**
  - els camps numèrics opcionals dels artefactes es desen com a `0` quan es buiden;
  - la icona de concentració del tracker pot trigar a refrescar-se.
