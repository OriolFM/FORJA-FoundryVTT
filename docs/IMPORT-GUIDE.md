# Guia de l'Importador de Personatges FORJA

Referència tècnica per a `module/import/character-importer.mjs` i `module/import/forjapp-service.mjs`.

---

## Com obrir l'importador

A Foundry VTT, des de la barra lateral d'Actors:

```
Actors → botó dret → Importar des de FORJAPP
```

O des del codi:
```javascript
ForjaCharacterImporter.showImportDialog();
```

---

## Mètodes d'importació

### 1. JSON (pestanya "JSON")

Enganxa el JSON exportat des de FORJAPP, o puja un fitxer `.json`.

- Exporta des de FORJAPP amb el botó "Exportar" de la fitxa del personatge
- Accepta un sol personatge o un array `[...]` de personatges
- Compatible amb el format de FORJAPP v0.3+

### 2. FORJAPP Cloud (pestanya "FORJAPP")

Connexió directa a Firebase amb autenticació Google.

**Passos:**
1. Clic a **Connectar amb Google** → s'obre `auth.html` en una finestra emergent
2. Inicia sessió amb Google a la finestra emergent
3. Copia el codi generat i enganxa'l al camp de la finestra principal
4. Clic a **Connectar**
5. Navega pels teus personatges o pels públics
6. Selecciona els que vols importar i tria el tipus (PJ / PNJ / Criatura / Animal)
7. Clic a **Importar seleccionats**

---

## Mapeig de dades FORJAPP → Foundry

### Tipus d'actor

| FORJAPP `characterType` | Foundry Actor type |
|---|---|
| `"PJ"` | `"character"` |
| `"PNJ"` | `"npc"` |
| `"Criatura"` | `"creature"` |
| `"Animal"` | `"animal"` |

### Camps del sistema de l'actor

| Camp FORJAPP | Camp Foundry (`system.*`) | Notes |
|---|---|---|
| `attributes.FOR/DES/AGI/PER/INT/APL` | `attributes.*.value` | Accepta `{value: n}` o `n` directament |
| `size` | `size` | Clampat 1–5 |
| `constitution` | `constitution` | Clampat 1–5 |
| `species` | `species` | Default: `"humanoid"` |
| `totalPoints` | `totalPoints` | Default: `100` |
| `currentWounds` | `health.wounds.value` | `max` calculat per `prepareDerivedData` |
| `currentFatigue` | `health.fatigue.value` | `max` calculat per `prepareDerivedData` |
| `biography` / `notes` | `biography` | S'usa el primer que no estigui buit |
| `concept` | `concept` | Només PJ i PNJ |
| `origin` | `origin` | Només PJ i PNJ |
| `gender` | `gender` | Només PJ |
| `age` | `age` | Només PJ |
| `resources` | `resources` | Només PJ |
| `guanxi` | `guanxi` | Només PJ |

---

## Importació d'ítems

### Habilitats (`data.skills`)

Cerca l'habilitat al compendium `forja.skills` per `skillId`.

**Camps importats:**
- `skillId` (normalitzat a kebab-case)
- `level`
- `notes`

**Fallback** (si no es troba al compendium): crea l'ítem manualment amb `relatedAttribute: "FOR"` i `skillType: "basic"`.

### Trets (`data.traits`)

Cerca el tret al compendium `forja.traits` per `traitId`.

**Camps importats:**
- `traitId` (normalitzat a kebab-case)
- `level`
- `variantCost`
- `notes`

**Deduplicació:** si hi ha duplicats del mateix `traitId`, es conserva el de nivell més alt.

**Fallback** (si no es troba): crea l'ítem manualment amb `category: "general"`, `traitType: "positive"`.

> ℹ️ **Armament natural i trets:** Els trets d'armament natural (`armament-natural-banyes`, etc.) s'importen com a ítems de tret. A més, l'importador crea automàticament els ítems d'arma natural corresponents (per a que apareguin al tracker de combat). Vegeu secció [Armes naturals](#armes-naturals).

### Armes (`data.weapons`)

Cerca l'arma al compendium `forja.weapons` per nom (cerca insensible a majúscules).

**Camps importats:**
- `name` (prioritza `customName` si n'hi ha)
- `attackType`, `weaponType`
- `latency` → `latencyMod`
- `reach`, `range`, `damage`, `special`
- `quantity`
- `equipped: true` (sempre s'importa equipada)

**Nota:** Les armes naturals (Cop, Banyes, Urpes, etc.) **no s'emmagatzemen** a `data.weapons` a FORJAPP — es calculen des dels trets. Per tant, no es troben aquí.

### Armadura (`data.equippedArmor`)

Importa l'armadura equipada (si n'hi ha). Camps: `name`, `protection`, `latencyMod`, `equipped: true`.

### Artefactes (`data.artifacts`)

Cerca per nom al compendium `forja.artifacts`. Fallback: crea manualment amb tots els camps.

### Efectes sobrenaturals (`data.supernaturalEffects`)

Cerca per nom al compendium `forja.supernatural-effects`. Fallback: crea manualment amb tots els camps.

---

## Armes naturals

Les armes naturals **s'importen com a ítems d'arma reals** (tipus `weapon`, subtipus `natural`). Això permet que apareguin al tracker de combat i als diàlegs de declaració d'acció.

### Lògica d'importació (`importFromJSON`)

1. **Cop** sempre s'afegeix per a tots els actors (FOR+1, lat+0)
2. Per cada tret d'armament natural present (`data.traits`), s'afegeix l'arma corresponent
3. Definicions a `CONFIG.FORJA.naturalWeaponTraits` i `CONFIG.FORJA.copWeapon`

### Lògica de visualització (character sheet)

A `module/sheets/actor/character-sheet.mjs` → `_prepareContext()`:

1. **Cop** i altres armes naturals apareixen a la pestanya Armes (calculats des dels trets, per compatibilitat amb actors creats manualment sense items naturals)
2. Cada tret amb `traitId` que coincideix amb `CONFIG.FORJA.naturalWeaponTraits` afegeix l'arma corresponent

### Mapeig tret → arma

| `traitId` al compendium | Arma mostrada | Dany | Lat |
|---|---|---|---|
| *(cap, tothom)* | Cop | FOR+1 | +0 |
| `armament-natural-banyes` | Banyes | FOR+3 | +1 |
| `armament-natural-urpes` | Urpes | FOR+2 | +1 |
| `armament-natural-mossegada` | Mossegada (ullals) | FOR+2 | +1 |
| `armament-natural-pinces` | Pinces | FOR+3 | +1 |
| `armament-natural-fiblo` | Fiblons i espines | FOR+2 | +0 |
| `tentacles` | Tentacles | FOR+2 | +0 |

### Fórmula de tirada

- **Cop:** usa `FOR + Barallar-se` O `DES + Arts Marcials` — automàticament tria el que dona més daus
- **Altres armes naturals:** usa `FOR + Barallar-se`

---

## Normalització d'IDs (camelCase → kebab-case)

FORJAPP pot emmagatzemar IDs en camelCase. L'importador els normalitza:

```javascript
// Prioritat 1: Override explícit
"armamentNaturalBanyes" → "armament-natural-banyes"

// Prioritat 2: Ja és kebab-case (conté "-")
"armament-natural-banyes" → "armament-natural-banyes"

// Prioritat 3: Conversió automàtica
"artsMarcials" → "arts-marcials"
```

### Overrides principals rellevants

| ID FORJAPP (camelCase) | ID normalitzat (kebab-case) |
|---|---|
| `armamentNaturalBanyes` | `armament-natural-banyes` |
| `armamentNaturalFiblo` | `armament-natural-fiblo` |
| `armamentNaturalMossegada` | `armament-natural-mossegada` |
| `armamentNaturalPinces` | `armament-natural-pinces` |
| `armamentNaturalUrpes` | `armament-natural-urpes` |
| `armesCosCos` | `armes-cos-a-cos` |
| `armesDistancia` | `armes-distancia` |
| `artsMarcials` | `arts-marcials` |
| `atributTitanic` | `atribut-titanic` |
| `armaduraNatural` | `armadura-natural` |
| `reflexosRapids` | `reflexos-rapids` |

La llista completa es troba a `ID_OVERRIDES` (línies 26–83 de `character-importer.mjs`).

---

## Resolució de problemes

### "L'armament natural no apareix"

**Causa:** Els trets d'armament natural no s'han importat correctament.

**Comprovació:** Obre la fitxa del personatge → pestanya Trets → comprova que hi hagi trets com `armament-natural-banyes`. Si no hi ha cap tret d'armament natural, el problema és a l'origen (FORJAPP).

**Resolució:** Torna a importar el personatge. Si el problema persisteix, exporta el JSON des de FORJAPP, comprova que el camp `traits` conté `{ traitId: "armamentNaturalBanyes" }` o `{ traitId: "armament-natural-banyes" }`, i reimporta.

### "Cop no apareix"

**Causa:** Impossible — Cop sempre apareix per a tots els actors independentment dels trets.

**Si no apareix:** Comprova que el sistema FORJA s'ha recarregat correctament (`F5` o reinicia el món).

### "Habilitat/tret no trobat al compendium"

El fallback crea l'ítem manualment amb dades mínimes. Nom visible = ID kebab-case. Edita la fitxa manualment per corregir el nom i els camps que calgui.

### "El personatge s'importa però no té cap ítem"

Comprova la consola del navegador (F12) per errors. Causes habituals:
- Els packs no estan carregats (comprova que el món tingui el sistema FORJA actiu)
- JSON malformat (utilitza un validador de JSON extern)

---

## Estructura del JSON FORJAPP esperat

```json
{
  "name": "Nom del personatge",
  "characterType": "PJ",
  "species": "humanoid",
  "size": 3,
  "constitution": 3,
  "totalPoints": 120,
  "attributes": {
    "FOR": 3, "DES": 2, "AGI": 3,
    "PER": 2, "INT": 2, "APL": 2
  },
  "currentWounds": 0,
  "currentFatigue": 0,
  "biography": "...",
  "concept": "...",
  "skills": [
    { "skillId": "barallarSe", "level": 3 }
  ],
  "traits": [
    { "traitId": "armamentNaturalBanyes" },
    { "traitId": "reflexosRapids" }
  ],
  "weapons": [],
  "equippedArmor": null,
  "artifacts": [],
  "supernaturalEffects": []
}
```

---

*Última actualització: 2026-02-21*
