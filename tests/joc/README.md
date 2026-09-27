# Proves de joc (Foundry v13 sense pantalla)

Proves automàtiques en un **Foundry real**, amb dues sessions de navegador obertes alhora (DJ i Jugador), controlades amb Playwright i un Chromium sense pantalla. Serveixen per comprovar allò que no es pot verificar només llegint el codi: permisos entre clients, el relé del DJ, l'ordre de torns, les fitxes i les traduccions.

## Preparació (un sol cop)

1. **Instal·la Foundry** (build per a NodeJS) a `~/foundry/v13`, amb les dades a `~/foundrydata`.
2. **Enllaça el sistema:** `ln -s <repo> ~/foundrydata/Data/systems/forja`.
3. **Contrasenya d'administrador:** desa'n una d'aleatòria en un fitxer privat, **fora del repo**:
   `~/foundry/proves/.admin`, amb permisos `600`. Una altra ruta es pot indicar amb `FORJA_ADMIN_FILE`.
4. **Arrenca el servidor** (Node ≥ 20):
   `node ~/foundry/v13/main.js --dataPath=$HOME/foundrydata --adminPassword="$(cat ~/foundry/proves/.admin)"`
5. **Activa la llicència i accepta l'EULA:** `FORJA_CLAU=<fitxer privat amb la clau> node tests/joc/activar.mjs`.
   La clau **mai** es desa al repo ni s'imprimeix.
6. **Crea el món:** `node tests/joc/mon.mjs` crea el món `proves-forja` amb el sistema `forja`.
7. **Llança'l:** `node tests/joc/llancar.mjs`. Hi entra com a DJ i comprova que el sistema carrega sense errors.

Per defecte les proves fan servir `/snap/bin/chromium`. El Chromium que baixa Playwright necessita llibreries del sistema que en aquesta màquina no hi són. Es pot canviar amb `FORJA_CHROMIUM`.

## Atenció: el compendi del manual

Com que el sistema està enllaçat al repo, quan Foundry obre el compendi `packs/manual` (LevelDB) en reescriu els fitxers, i `git status` els mostrarà modificats. No s'han de pujar. Per deixar-los com estaven, atura el servidor i fes `git checkout -- packs/manual`, esborrant abans els fitxers nous que hi hagi aparegut.

Les captures de pantalla es desen a `~/foundry/proves/captures`, fora del repo. Es pot canviar amb `FORJA_CAPTURES`.

## Execució

```bash
npm run test:joc        # o: node tests/joc/proves.mjs
```

Escriu un JSON amb el resultat de cada prova (`ok`) i els errors de consola de cada sessió. Cada vegada crea de nou els actors `Prova PJ` i `Prova PNJ`, l'usuari `Jugador`, una escena i un combat.

## Què es prova

| # | Prova |
|---|-------|
| 1 | Crear un PJ i un PNJ amb dos clients connectats dona exactament un "Cop" a cadascun (A1). |
| 2 | Les fitxes de PJ, de PNJ i d'objecte s'obren sense errors. |
| 3 | La fatiga i les ferides tenen `value`/`max` derivats, que alimenten les barres del token (A6). |
| 4 | Gastar PX no consumeix pressupost de PC (A4). |
| 5 | Es pot marcar un actor com a derrotat (estat `dead`, A8). |
| 6 | Ordre de torns: amb un empat a 0, A declara 5 i el torn següent és de B; les reaccions es reinicien per a A (A3). |
| 7 | Un jugador ataca un PNJ que no és seu: el dany s'aplica a través del DJ, sense errors de permís (A2). |
| 8 | Un jugador fa gastar una reacció a un actor aliè a través del DJ. |
| 9 | Seguretat: el relé rebutja camps no permesos (p. ex. `system.atributs.FOR`). |
| 10 | Les fitxes no mostren claus `FORJA.*` sense traduir en ca, es ni en. |
