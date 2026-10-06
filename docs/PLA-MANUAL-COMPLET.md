# Pla: completar el manual bàsic a Foundry

Revisió del 2026-10-06 (sessió al núvol, branca `claude/forja-foundryvtt-kodk9f`), sobre el commit `77c5566`. Compara el manual (`docs/FORJA_FC001CA_CORE.md`) amb el codi i proposa un pla per fases.

**Estat:** pendent de l'aprovació de l'Oriol. Les decisions obertes són a la secció 3.

## 1. Què hi ha i què falta

Llegenda: ✅ fet · 🟡 parcial · ❌ no hi és.

### 1.1 Estats (manual l. 3546–3695)

Els 19 estats estan registrats (`estats.json`, `estats/estats.mjs`) i es poden marcar des del HUD. Només 4 tenen mecànica (`estats-parametritzats.mjs`). La resta són una icona i prou.

| Estat | Regla del manual | Al codi |
|-------|------------------|---------|
| Lent/X, Ràpid/X | ±X a la latència | ✅ en declarar |
| Sagnant/X | −X fatiga cada cop que actua | ✅ tic a l'inici del torn |
| Recuperació/X | +X cada 8 torns; primer la condició més greu, **la fatiga si empaten**; inconscient/incapacitat: 8 torns per pujar de nivell | 🟡 en cas d'empat cura les ferides (error); no fa el cas d'inconscient/incapacitat |
| Concentrat | +1 dau, no pot defensar-se ni reaccionar, el dany > FOR l'atordeix | ✅ (`reaccions.mjs`, `atac.mjs`) |
| Atordit | Perd la següent acció i ha de tornar a declarar | 🟡 s'aplica (concentració, maniobres), però no anul·la l'acció declarada |
| Abatut | +2 latència a tot (també aixecar-se); no pot córrer, saltar ni esquivar | ❌ |
| Acovardit | Només accions defensives o allunyar-se; s'acaba amb APL + resistència/Psi | ❌ |
| Atrapat | No es mou ni esquiva; tirada d'escapar-se (FOR + força bruta o FOR/DES + arts marcials) contra la de qui atrapa; qui atrapa manté, deixa o millora la presa | ❌ |
| Berserc | Dur de pelar i incansable; cap acció defensiva ni de concentració (excepte en atac) | ❌ |
| Empès | Retrocedeix segons el dany; AGI + acrobàcies/equilibri o queda abatut | ❌ |
| Immobilitzat | No es mou; pot atacar, parar i blocar | 🟡 defensa bàsica 1; el token es pot moure igualment |
| Incapacitat, Inconscient | No pot actuar | 🟡 bloqueig per nivell 7 de salut; l'estat no es posa sol |
| Llançat | Llançat FOR + 2 + mida (m) | ❌ (la maniobra Llançament té lògica pròpia) |
| Malaltia/Toxina | FOR + resistència contra la virulència; efectes variables | ❌ (només es cura) |
| Marejat | No pot actuar; per actuar, FOR o APL + resistència contra la causa | ❌ |
| Esguerrat | Més d'un nivell de salut d'un cop en una extremitat; cama: immobilitzat i després meitat de moviment | ❌ |
| Vigilant | +1 reacció | ❌ |

### 1.2 Artefactes i efectes: creació (manual l. 4696–5360)

| Peça | Estat |
|------|-------|
| Taula de paràmetres (`parametres.json`) | ✅ coincideix amb el skill `forja-parametres` |
| Catàleg: 18 artefactes i 65 efectes (`artefactes.json`, `efectes.json`) | ✅ cost, dificultat i latència correctes |
| Paràmetres de cada plantilla | ❌ només hi ha text (`mecanica`). Els paràmetres estructurats ja existeixen a `skills/forja-parametres/motor/plantilles.py` |
| Constructor (`construccio.mjs`, `dialeg-constructor.mjs`) | 🟡 falten: recàrrega i acumulador; armes i armadures base a cost 0; dificultat i latència declarades (±5 i ±2 PC per punt); artefactes permanents amb dificultat < 1; diversos paràmetres del mateix grup alhora |
| Prova que el constructor reprodueix les 83 plantilles | ❌ |
| Fitxa d'objecte per als efectes | ❌ fan servir la genèrica de Foundry |
| Fitxa d'artefacte | 🟡 no mostra prototip, modular ni càrrega |

### 1.3 Artefactes i efectes: ús (manual l. 4111–4695)

| Peça | Estat |
|------|-------|
| Manifestar: tirada, equilibri, fatiga/ferides per equilibri negatiu | ✅ (`manifestar.mjs`) |
| Resistir, contrarestar, desfer, prendre el control | ✅ |
| Ressonància | 🟡 només com a modificador numèric lliure |
| Rituals | ✅ (modificadors a mà, com diu el manual) |
| Artefactes: càrrega, recàrrega, mode d'espera, prototips, modulars | ✅ |
| Artefactes: tirada d'activació | ❌ l'objecte no sap amb quin atribut i habilitat s'activa |
| **Resultat de l'efecte o l'artefacte** (dany, curació, estats, protecció, ègida, bonus d'habilitat, tret temporal, durada) | ❌ s'aplica a mà llegint el text |
| Manifestar o activar com a **acció declarada** al tracker, amb la latència de l'efecte | ❌ el diàleg de declarar només té atac, defensa, moviment i «altra» |
| Efectes de **reacció** (Negar el dany, Pas al costat, L'armadura del queloni) | ❌ |
| Artefactes que són armes o armadures (espases, servoarmadura…) | ❌ no ataquen ni protegeixen com a arma o armadura |
| Àrees (`area.mjs`, `plantilla.mjs`) | 🟡 el motor hi és, però no està connectat als efectes |
| Invocació (Animar gólem…) | ❌ hauria de posar la criatura a l'escena |

### 1.4 Experiència i millores (manual l. 6555–6762)

| Peça | Estat |
|------|-------|
| Gastar PX: atributs, habilitats, trets (`millora.mjs`) | ✅ |
| Aprendre i millorar efectes, 2 PX per intent fallit (`progressio-sobrenatural.mjs`) | ✅ |
| Convertir-se en dotat | ✅ (habilitat del do + tret Dotat/X) |
| R+D: disseny, prototip 1 i 2, modulars (`rd-artefactes.mjs`, `modular.mjs`) | ✅ |
| **Repartir PX (eina del DJ)**: objectius de grup i individuals (menor/rutinari/major/èpic) i virtuts | ❌ el DJ edita `px.total` a mà |
| Historial de PX guanyats i gastats | ❌ |
| Recompensa en forma d'efecte o artefacte | ❌ (es pot fer a mà) |

### 1.5 Contingut del manual dins de Foundry

L'únic compendi és el **Manual FORJA** (JournalEntry). La resta només són catàlegs JSON que fan servir els diàlegs.

| Contingut | Manual | Al sistema |
|-----------|--------|-----------|
| PJ d'exemple | 6 (Anya Barker, Blume, Nagata, Marvin, Trace, Yoko-1), l. 2074–2289 | ❌ (la Yoko és al món de proves) |
| PNJ | 2 figurants, 22 secundaris, 1 nèmesi (Renegat), l. 6889–7360 | ❌ |
| Animals | 7, l. 7371–7478 | ❌ |
| Criatures | 9, l. 7479–7612 | 🟡 `criatures-exemple.json` en té 2 (una és una extrapolació) |
| Artefactes | 18 | 🟡 només catàleg |
| Efectes | 65 | 🟡 només catàleg |
| Trets, armes, armadures, maniobres | 95 / 27 / 5 / 10 | 🟡 només catàleg |

Els blocs de PNJ, animals i criatures tenen un format regular («Atributs primaris…», «Habilitats…», «Trets…», «Artefactes…»), de manera que es poden convertir amb un script i validar amb el cost i els derivats que dona el manual.

### 1.6 Altres pendents ja coneguts (`REGISTRE-TREBALL.md`)

- Maniobres d'arts marcials que falten: Dim Mak, Combinació, Contraatac.
- Moviments especials d'armes a distància (Ràfega, Automàtic, Foc automàtic) i armes de dispersió i de suport.
- Escut: +1 a la defensa bàsica i integritat estructural en blocar.
- Regles generals sense eina: col·laborar, èxit garantit, força bruta (cansament, sobrecàrrega), flanquejar i guanyar l'esquena. La majoria són a judici del DJ.

## 2. Pla per fases

Cada fase acaba amb commit i push, proves unitàries (`npm test`), `node --check`, i el registre, el CHANGELOG i `PROVES.md` al dia. La lògica nova s'escriu com a funcions pures, amb proves.

**Limitació d'aquest entorn:** al contenidor del núvol no hi ha cap Foundry amb llicència. Les proves de joc (`tests/joc/`) les haurà de passar l'Oriol en local (`tests/joc/local.mjs`) al final de cada fase, o abans de tancar la versió.

### Fase 1 · Estats

1. Funcions pures (`estats/regles-estats.mjs`): què pot fer un actor segons els seus estats (actuar, moure's, esquivar, defensar-se, concentrar-se, córrer), modificador de latència i reaccions addicionals.
2. Connectar-les:
   - al diàleg de declarar (opcions deshabilitades, +2 d'abatut);
   - a la defensa (sense esquivar, sense defensa activa en berserc);
   - al moviment del token (atrapat i immobilitzat no es mouen);
   - als derivats (vigilant +1 reacció; berserc = dur de pelar i incansable).
3. Atordit anul·la l'acció declarada i obliga a tornar a declarar.
4. Tirades d'estat amb botó al xat: escapar-se d'atrapat, superar acovardit o marejat, mantenir-se dempeus en ser empès, resistir malaltia/toxina, forçar una extremitat esguerrada.
5. Inconscient i incapacitat es posen sols en arribar al nivell 7 de fatiga o ferides.
6. Corregir Recuperació/X (fatiga si empaten; cas d'inconscient/incapacitat).

### Fase 2 · Artefactes i efectes: dades i creació

1. Afegir els paràmetres estructurats (`parametres: [...]`) a les 83 plantilles, a partir de `plantilles.py`.
2. Completar el constructor amb el que li falta (recàrrega, acumulador, armes i armadures base, dificultat i latència declarades, permanents, paràmetres repetits).
3. Prova unitària: el constructor reprodueix el cost, la dificultat i la latència de les 83 plantilles.
4. Fitxa d'objecte per als efectes i fitxa d'artefacte completa (paràmetres, càrrega, prototip, mòduls).
5. Atribut i habilitat d'activació dels artefactes.

### Fase 3 · Artefactes i efectes: ús

1. Al diàleg de declarar, nous tipus d'acció: **manifestar un efecte** i **activar un artefacte**, amb la latència de l'efecte i l'objectiu.
2. Tirada d'activació dels artefactes (amb càrrega i prototips).
3. Aplicar el resultat segons els paràmetres, pel relé del DJ:
   - dany (amb `calcularDany`), curació i estats amb X;
   - protecció, ègida, bonus d'habilitat, atribut o tret temporal, com a ActiveEffect amb la durada de l'efecte.
4. Connectar el motor d'àrees (esfèrica, lliure, llàgrima) als efectes amb àrea.
5. Efectes de reacció, oferts al diàleg de defensa.
6. Artefactes que són armes o armadures: es poden fer servir com a arma o armadura al combat.
7. Invocació: posa la criatura del compendi a l'escena.
8. Ressonància: selector de cinc nivells al diàleg de manifestar.

### Fase 4 · Experiència

1. Eina del DJ «Repartir PX»: tria dels PJ, objectius (grup o individual; menor, rutinari, major, èpic) i virtuts, amb els valors de la taula del manual (l. ~6640).
2. Historial de PX guanyats i gastats a la fitxa.
3. Revisar els fluxos de millora contra el manual i completar el que falti.

### Fase 5 · Contingut del manual en compendis

1. Script `scripts/build-packs.mjs`: llegeix els blocs del manual i genera les fonts JSON a `packs/_source/<compendi>/`.
2. Prova unitària: el cost i els derivats de cada actor coincideixen amb els que diu el manual. Les discrepàncies es documenten al registre.
3. Compendis nous a `system.json`, compilats amb `@foundryvtt/foundryvtt-cli`:
   - `pj` (6), `pnj` (25), `animals` (7), `criatures` (9);
   - `artefactes` (18), `efectes` (65);
   - `trets`, `armes`, `armadures`, `maniobres`.
4. Substituir `criatures-exemple.json` pels compendis. Amb això, FORJAPP i Firebase ja no calen.

### Fase 6 · Altres pendents (opcional)

Maniobres que falten, moviments especials d'armes a distància, regles de l'escut. Cal decidir-les abans amb l'Oriol (vegeu el registre).

### Fase 7 · Tancament

Documentació (`CLAUDE.md`, registre, `PROVES.md`), traduccions es/en de les claus noves, proves de joc a la v13 i la v14 (en local) i versió 0.6.0.

## 3. Decisions obertes

Les respostes de l'Oriol s'anotaran aquí i al registre.

1. **On va el contingut:** compendis del sistema (proposta) o només el món de proves.
2. **Grau d'automatització dels estats:** bloquejar el que el manual diu clarament i avisar del que és judici del DJ (proposta), o només avisos.
3. **Resultat dels efectes:** aplicar-lo automàticament en tenir èxit, com el dany dels atacs (proposta), o amb un botó «Aplicar» al xat per al DJ.
4. **Fase 6:** dins d'aquest pla o més endavant.
