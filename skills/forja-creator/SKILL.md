---
name: forja-creator
description: >
  Crea i valida personatges jugadors (PJ), personatges no jugadors (PNJ), criatures i animals
  per a FORJA RPG seguint les regles del manual. Usa aquest skill quan l'Oriol demani generar
  nous PJ, PNJ, animals o criatures, o quan vulgui verificar/corregir personatges existents.
  El skill calcula automàticament tots els atributs secundaris, comprova la coherència
  de trets, cost en PC, i genera el full complet llest per incloure al document.
  Sempre executar el codi — mai calcular de memòria.
---

# FORJA RPG — Skill de Creació i Validació de Personatges

## Flux de treball

1. **Llegir la petició**: quin tipus (PJ / PNJ / animal / criatura), quina funció narrativa, quin entorn
2. **Executar `forja_creator.py`** per calcular atributs secundaris i cost
3. **Verificar coherència** (trets incompatibles, habilitats sense atribut, cost correcte)
4. **Formatar la fitxa** al format estàndard del manual

## Eina principal

```bash
cd /home/claude/forja-creator
python3 - << 'PYEOF'
import sys; sys.path.insert(0, '.')
from scripts.forja_creator import *

# Crea o valida un personatge aquí
PYEOF
```

## Referència ràpida → llegir `references/regles.md` per detalls complets

### Atributs primaris
FOR, DES, AGI, PER, INT, APL — escala humana 1–3, excepcional 4, sobrehumà 5

### Atributs secundaris (tots calculats automàticament)

| Atribut | Fórmula |
|---------|---------|
| Latència | `10 + mida - (AGI × 2)` |
| Defensa | `AGI + mod_mida` (mida 1→+2, 2→+1, 3→0, 4→-1, 5→-2) |
| Reducció de dany | `FOR` |
| Reacció | `1` (2 amb REFLEXOS RÀPIDS) |

### Cost en PC (acumulat des de 0)

**Atributs primaris:**
1→0, 2→10, 3→30, 4→60, 5→100

**Mida:** diminuta(1)→-10, petita(2)→-5, mitjana(3)→0, gran(4)→10, enorme(5)→25

**Constitució:** nyicris(1)→-5, magra(2)→0, saludable(3)→0, ferma(4)→10, robusta(5)→25

**Espècie:** animal→-15, artròpode→5, cefalòpode→25, constructe→10, humanoide→0, incorpori→15, mecanoide→20, vegetal→10

**Habilitats:** nivell N costa N PC (cost acumulat = N×(N+1)/2 ... però s'aplica incremental: rang 1→1, 2→2 addicionals, 3→3 addicionals, etc.)

**Trets:** veure `references/regles.md` per llista completa de costos

### Format de fitxa estàndard

```
[Nom]
[Tipus] de cost [X] PC.
Atributs primaris: FOR X, DES X, AGI X, PER X, INT X, APL X.
Atributs secundaris: [Espècie]. Constitució [nom] ([val]), mida [nom] ([val]),
  latència [X], defensa [X], reducció de dany [X], reacció [X].
Habilitats: [habilitat1] [N], [habilitat2] [N], ... (ordre alfabètic)
Trets: [tret1], [tret2], ...
[Artefactes i efectes: ... (si n'hi ha)]
[Descripció narrativa breu]
```

## Validacions que fa el codi

- Atributs secundaris calculats correctament
- Trets incompatibles detectats (ex: DUR DE PELAR + FIGAFLOR)
- Trets que requereixen condicions (ex: CURACIÓ RÀPIDA incompatible amb HEMOFÍLIC)
- Cost total en PC calculat i desglossat
- Habilitats restringides (R) sense nivell mínim 1
- Espècie INCORPORI: atributs físics han de ser 0
- Espècie MECANOIDE: no pot tenir trets sobrenaturals
- Mida coherent amb descripció narrativa
- Advertències si el cost no encaixa amb la categoria (figurant/secundari/nèmesis)
