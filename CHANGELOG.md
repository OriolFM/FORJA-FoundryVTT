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
- **Orientació dels tokens:** el dibuix es queda sempre dret i un triangle a la vora marca cap on mira el personatge. Canvia en moure'l (rotació automàtica de Foundry) i a mà amb el token seleccionat: Ctrl + roda del ratolí (30°) o Maj + roda (60°, una cara de l'hexàgon). Sense triangle si el token té la rotació bloquejada.
- **Salut al mapa:** una insígnia vermella damunt del token mostra la penalització per salut a les tirades (p. ex. «+2»; «✕» fora de combat). En passar el ratolí, sota el token surten el nivell de fatiga i de ferides i els estats actius. Només ho veu qui pot veure la fitxa (el DJ i el propietari).
- **No-mort a la fitxa:** la secció de salut indica «No-mort: sense penalització» i la taula marca (+0) a tots els nivells (el tret ja eximia de la penalització, però la fitxa no ho deia).
- **Adepte i inepte a les tirades:** si el personatge en té, el diàleg de tirada deixa triar l'àmbit (físic, mental, social o tècnic) quan l'activitat ho és. Adepte repeteix un cop els 1; inepte fa que els 10 no comptin doble i que cada 1 resti una fita.
- **Eina del DJ per al contingut:** botó «Nou actor FORJA» al directori d'actors (PJ amb l'assistent de creació, PNJ, criatura o animal) i opció «Desa al compendi del món» al menú de cada actor. Desa els actors en compendis del món (`FORJA (món): …`), que no es perden en actualitzar el sistema.
- **Mòdul «La porta d'Hèkate»** (`moduls/forja-la-porta-dhekate`): l'aventura introductòria en un compendi de diari, amb el mateix estil que el manual. S'instal·la a part, com qualsevol mòdul.
- **Actors de «La porta d'Hèkate»** als compendis del sistema, en una carpeta pròpia: 8 PJ pregenerats, 13 PNJ (Hèkate, Orfeu, la magistrada Blume…) i 4 criatures (Aràcnid Acherontia, amb el seu token). Venen d'unes regles anteriors i s'han convertit a les actuals; el que no s'ha pogut mapar és a `moduls/forja-la-porta-dhekate/CONVERSIO.md`.
- **Nous al catàleg:** el tret **Tòxic** (atordit, lent, sagnat o toxina) i l'artefacte **Ègida ancestral** (contra dany físic o energètic, protecció 8, 28 PC cadascuna), tots dos de «La porta d'Hèkate».
- **Tokens per als actors dels compendis:** Yoko-1, Trace, Marvin el dèlfic i el Gólem de carn porten el seu token; la resta, un de provisional (cercle gris amb el nom a l'anella).
- **Estats amb efecte** (manual › Estats; Oriol FM, 2026-10-06):
  - **Abatut:** +2 a la latència; no pot córrer, saltar (càrrega) ni esquivar.
  - **Atrapat** i **immobilitzat:** el token no es pot moure; atrapat no pot esquivar; immobilitzat té defensa bàsica 1.
  - **Acovardit:** només pot declarar defensa o moviment.
  - **Berserc:** cap defensa activa ni concentració (excepte en atac); sense penalització de salut.
  - **Atordit:** perd l'acció en arribar el seu torn i ha de tornar a declarar.
  - **Marejat:** perd l'acció; per declarar-ne una altra ha de superar FOR o APL + resistència.
  - **Inconscient** i **incapacitat:** es posen sols al nivell 7 de fatiga o de ferides i es treuen en curar-se; no poden actuar i el rellotge continua sense ells.
  - **Vigilant:** +1 reacció.
  - **Tirades d'estat** des de la fitxa: escapar-se d'atrapat, superar acovardit, mantenir-se dempeus (empès), resistir una malaltia o toxina, actuar marejat, forçar una extremitat esguerrada.
  - La fitxa mostra els estats actius, amb un botó per tirar i un per treure'ls.
- **Constructor d'efectes i artefactes per paràmetres:** s'hi afegeixen paràmetres de qualsevol tipus i es poden repetir; inclou els que faltaven (recàrrega, acumulador, arma i armadura base, dificultat i latència declarades, artefactes permanents). Reprodueix el cost, la dificultat i la latència de les 83 plantilles del manual.
- **Els 18 artefactes i els 65 efectes del manual porten els seus paràmetres**, i la fitxa en mostra el desglossament amb el cost calculat i un botó per editar-los amb el constructor. Millorar un efecte parteix dels seus paràmetres.
- **Fitxa d'objecte per als efectes**; la d'artefacte mostra també la tirada d'activació (atribut + habilitat), la càrrega actual, la fase de prototip i si és modular.
- **Migració:** els efectes i artefactes del catàleg que ja hi hagi en un món reben els paràmetres en entrar el DJ.
- **Efectes i artefactes amb resultat automàtic:** en manifestar un efecte o activar un artefacte, s'apliquen sols el dany (indirecte, directe o drenatge), la curació, els estats, les bonificacions (atributs, habilitats, trets, armadura i ègida temporals) i es publica al xat; el que és narratiu (il·lusions, telecinesi, invocació…) queda indicat per al DJ. Funciona amb diversos objectius marcats.
- **Declarar al tracker** «Manifestar un efecte» i «Activar un artefacte», amb la latència de l'efecte o artefacte i l'objectiu; es resolen al seu torn.
- **Efectes de reacció** (L'armadura del queloni, Negar el dany…) al diàleg de defensa.
- **Efectes d'àrea:** afecten els tokens dins la plantilla dibuixada.
- **Resistir i contrarestar** un efecte ho decideix el jugador de l'objectiu o el DJ, no qui el manifesta.
- **Ressonància** (cinc nivells) i tria de fatiga o ferides al diàleg de manifestar.
- **Activar un artefacte:** tirada d'atribut + habilitat contra la dificultat d'activació (es demana si l'artefacte no la té), càrrega i prototips que es trenquen en pifiar.
- **Armes i armadures que són artefactes** (Espasa d'energia, Holocapa, Servoarmadura…): apareixen com a arma o armadura i funcionen al combat (dany directe, estats en impactar, càrrega per atac, ègida). Els artefactes permanents i els que es porten donen les seves bonificacions mentre estan equipats; la fitxa les mostra amb un «+n».
- **Modes de tret:** ràfega (+1 dau o +1 dany) i automàtic; **atacs d'àrea** amb plantilla per a escopetes, armes de dispersió (llàgrima de 15 m, fuga si pifien) i foc automàtic; les armes feixugues no disparen si s'han mogut. Armes de dispersió i de suport al catàleg.
- **Maniobres d'arts marcials:** Combinació (dos cops amb una tirada, cada un amb la seva defensa), Contraatac (en guàrdia: contraataca si para o bloca) i Dim Mak (ferides o fatiga doble, sense armadura).
- **Escut:** +1 a la defensa bàsica.
- **Compendis amb el contingut del manual:** 6 PJ d'exemple, 25 PNJ, 7 animals, 9 criatures, i els trets, armes, armadures, 18 artefactes i 65 efectes. Ja no cal FORJAPP ni Firebase per tenir-los.
- **Repartir PX** (botó del DJ al directori d'actors): objectius de grup i individuals, virtuts i PX addicionals, amb la taula del manual.
- **Historial de PX** a la fitxa del PJ: el que s'ha guanyat i el que s'ha gastat (millores, trets, efectes).
- **Textos flotants al costat del token** (com als videojocs): estats guanyats i perduts, fatiga, ferides i curació. Si un jugador intenta fer una cosa que un estat li impedeix, l'estat torna a sortir.
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

### Eliminat
- `criatures-exemple.json`: les criatures del manual són ara al compendi «Criatures».

### Canviat
- **Dany dels jugadors fora del combat obert:** el DJ accepta el dany i els canvis de combat de qualsevol combat començat o en declaració, en qualsevol escena (combats paral·lels sense fusionar-los). Si no hi ha cap combat (p. ex. una emboscada), li surt una pregunta per acceptar-lo o no.
- **Adepte i inepte** són per àmbit d'activitat (físic, mental, social o tècnic), no per atribut, com al manual original. Els actors que ja tinguin un «Adepte (FOR)»… el conserven; el DJ el pot canviar pel de l'àmbit que toqui.
- **Manual:** el compendi es genera ara des del manual complet revisat; hi han aparegut apartats que faltaven (p. ex. Adepte, Animal) i les referències creuades són enllaços.
- **Compendis:** capçalera gris pla (provisional).
- **Manual:** els capítols surten en l'ordre del llibre, amb el número al davant, i les pàgines tenen l'estil de la maqueta del llibre: Fira Sans justificada, títols en Akrobat i capçaleres de taula en verd petroli. També s'aplica al diari de «La porta d'Hèkate».
- **Blocar amb el cos** també contra atacs armats si el defensor té armament natural (urpes, banyes…) o armadura natural, com a l'exemple del gólem del manual.
- Si el defensor no té cap reacció lliure, es defensa amb la defensa bàsica sense diàleg, però amb un avís i «(sense reaccions)» al xat.
- Les maniobres d'arts marcials es trien en declarar l'acció (ja no en resoldre-la).

### Corregit
- **Token en canviar la imatge d'un actor:** el token prototip ara segueix el retrat nou si encara era el del sistema, el genèric o el mateix retrat (abans, en arrossegar l'actor a l'escena sortia el token antic). Un token personalitzat no es toca.
- **Tokens dibuixats dels compendis** (Yoko-1, Trace, Marvin, Gólem de carn, Aràcnid): es veien poc saturats, com amb un vel gris. Ara són una còpia exacta del dibuix original (PNG), sense convertir-los a WEBP.
- **Capçalera de la fitxa de PJ:** els PC i PX es mostren en una graella 2×2 (a dalt els totals, a sota els lliures) i, amb la fitxa estreta, baixen de línia en lloc de superposar-se al nom.
- **PC gastats:** ara compten els efectes i els artefactes, com al manual (p. ex. Anya Barker, 200 PC). Els prototips fets en joc no compten, i un efecte après amb PX no gasta PC.
- **Defensa contra un contraatac o una escopeta:** el diàleg de qui es defensa oferia parar i blocar, que no es poden fer servir (i triar-los acabava en defensa passiva).
- **Moviment en combat:** durant la fase de declaració els jugadors ja no poden moure els seus tokens (el DJ sí). I el límit de moviment s'aplica encara que el tracker del jugador mostri un altre combat.
- **Arma de dispersió:** si el DJ no podia aplicar el dany de la fuga a algun adjacent, es perdia tot el missatge; ara surt amb una nota.
- **Combinació:** després del primer cop, l'atacant passa al tic següent sense declarar; el segon cop arriba en aquest tic i només llavors es declara la propera acció (abans demanava declarar abans del segon cop).
- **Combinació:** el segon cop es perdia si el DJ mirava una altra escena que la del combat.
- **Atacs i efectes d'àrea:** si la plantilla s'acabava de dibuixar i el canvas encara no l'havia refrescat, no hi trobava cap token.
- El missatge de tirada diu «1 fita» (abans, «1 fites»).
- Les tirades d'activació, de resistència i les tirades úniques d'àrea surten amb els daus i les fites al xat.
- Els estats que aplica un efecte instantani (p. ex. Sagnant/X) ja no desapareixen quan avança el rellotge.
- Els textos flotants i els estats per salut també funcionen amb els tokens no enllaçats.
- **Incorporis:** la latència, la defensa, el moviment i la reducció de dany es calculen amb PER i APL, com diu el manual.
- **Recuperació/X:** amb fatiga i ferides al mateix nivell, ara cura primer la fatiga (abans, les ferides); des del nivell 7 (inconscient o incapacitat) passa al nivell 6, com diu el manual.
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
