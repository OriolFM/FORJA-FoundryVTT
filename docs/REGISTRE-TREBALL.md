# Registre de treball — branca `Aw`

**Aquest és el document de referència de tots els canvis de la branca `Aw`.** Recull què s'ha fet, per què, amb quines decisions i què queda pendent. S'actualitza amb cada commit.

| Document | Per a què |
|----------|-----------|
| **Aquest registre** | Història detallada de la branca: commits, decisions, contractes entre mòduls, troballes i pendents. |
| [`../CHANGELOG.md`](../CHANGELOG.md) | Canvis per versió, pensat per als usuaris del sistema. La feina en curs va a `[Pendent]`. |
| [`VERSIONS.md`](VERSIONS.md) | Com es numeren i es tanquen les versions. |
| [`PROVES.md`](PROVES.md) | Totes les proves: què proven, com es fan, com s'executen i els resultats. |
| [`REVIEW-PLAN.md`](REVIEW-PLAN.md) | La revisió de codi original: troballes (A1, B3…) i pla per paquets. |
| [`../CLAUDE.md`](../CLAUDE.md) | Arquitectura del codi tal com és ara. |
| [`manual/FORJA_FC001CA_CORE.md`](manual/FORJA_FC001CA_CORE.md) | El manual del joc: font de veritat de les regles. |

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
| Blocar (B15) | Cos → resistència (només contra atacs naturals); escut → armes cos a cos; objecte → armes improvisades. La bonificació no supera la reducció natural. | Manual, l. 3177–3185 |
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
- **Acció declarada:** `flags.forja.accioPendent` del combatent, amb `tipus`, `moviment`, `combatId`, `declaradaAlMarcador` i `movimentEnCurs`.
- **Moviment:**
  - `module/combat/moviment.mjs`: lògica pura;
  - `module/documents/token.mjs`: límit per torn a `_preUpdateMovement`;
  - `module/canvas/token.mjs`: cost infinit a caselles bloquejades i A*.
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
| **U3:** després que el DJ triï la defensa, l'atac no apareix al xat dins l'espera de la prova (v13 i v14). | **En investigació** |

## Graf de coneixement (graphify)

- **Eina:** [graphify](https://github.com/safishamsi/graphify), instal·lada amb `uv tool install graphifyy` (`~/.local/bin/graphify`).
- **Darrera generació:** versió 0.4.0 (etiqueta `v0.4.0`), a partir d'una còpia neta. 993 nodes, 1.485 arestes i 50 comunitats; cap cicle d'imports.
- **Contingut:** només codi (`.mjs` i `.json`); les plantilles `.hbs` i el Markdown no hi són.
- **On és:** `graphify-out/` (fora de git): `graph.html` (interactiu), `GRAPH_REPORT.md` i `graph.json`.
- **Quan s'actualitza:** amb cada versió MINOR o MAJOR (`npm run versio`), o a mà amb `graphify update .`.

## Preguntes obertes per a l'Oriol

Contradiccions del manual o punts on no diu res:

1. **Empat contra la defensa passiva:** les l. 2354 i 3143 diuen que un empat impacta, i la l. ~2904 que falla. Ara impacta.
2. **Esquivar per sota de la defensa:** la l. 3159 diu que el resultat no pot ser inferior a la defensa bàsica +1, però l'exemple de la l. ~4016 fa servir la defensa sense el +1. Ara s'aplica el +1.
3. **Armes improvisades:** quin atribut fan servir. Ara, DES a cos a cos i AGI si es llancen.

## Pendent

- **U3:** investigar per què l'atac no surt al xat després que el DJ triï la defensa (vegeu les troballes).
- **Pujar la branca a GitHub.** Ara és només local: `origin` és el repo de l'Oriol, i cal permís d'escriptura o un fork a `ArnauFerma`. També cal pujar les etiquetes (`git push origin --tags`).
- **Releases a GitHub:** les adreces `manifest` i `download` de `system.json` no funcionaran fins que es publiqui una release amb `system.json` i `forja.zip`.
- **Tancar la versió 0.5.0** quan el moviment estigui validat per l'Oriol.
- **Regles del manual detectades però no implementades:**
  - l'escut dona +1 a la defensa bàsica (l. 2985/3153);
  - la integritat estructural de l'escut en blocar;
  - la pífia de les armes de dispersió.
- **Moviment, límits coneguts:**
  - l'elevació no es té en compte (els tokens a diferent alçada també es bloquegen);
  - una càrrega resolta sense objectiu no té bonus;
  - els tokens que no són al combat es mouen lliurement durant un combat.
- **Retard de barallar-se:** la tirada sense objectiu (`ferTirada`) no hi suma els daus.
- **Traducció de les dades de joc:** els noms i descripcions dels catàlegs (`module/config/dades/*.json`) només són en català.
- **Claus sense ús:** 15 claus de `ca.json` no les fa servir cap codi (`FORJA.Tab.*`, `FORJA.Hab.Marca`, `FORJA.Tret.Cost`…).
- **Temes menors:**
  - els camps numèrics opcionals dels artefactes es desen com a `0` quan es buiden;
  - la icona de concentració del tracker pot trigar a refrescar-se.
