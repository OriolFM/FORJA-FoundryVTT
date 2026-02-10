# Resum de Regles FORJA RPG

Referència ràpida del sistema de joc per al desenvolupament del mòdul Foundry VTT.

---

## Atributs Primaris (6, escala 0-5)

| Atribut | ca | es | en | Descripció |
|---------|----|----|-----|------------|
| FOR | Fortalesa | Fortaleza | Might | Força física |
| DES | Destresa | Destreza | Dexterity | Control motor fi |
| AGI | Agilitat | Agilidad | Agility | Mobilitat i reflexos |
| PER | Percepció | Percepción | Perception | Consciència sensorial |
| INT | Intel·ligència | Inteligencia | Intelligence | Raonament i coneixement |
| APL | Aplom | Aplomo | Aplomb | Voluntat i compostura |

**Costos**: 0→-5PC, 1→0PC, 2→10PC, 3→20PC, 4→30PC, 5→50PC

---

## Espècies (8 tipus)

| Espècie | Cost PC |
|---------|---------|
| Humanoide | 0 |
| Animal | -15 |
| Artròpode | 5 |
| Constructe | 10 |
| Planta | 10 |
| Incorpori | 15 |
| Mecanoide | 20 |
| Cefalòpode | 25 |

---

## Característiques Físiques

### Mida (1-5)
| Mida | Nom | Cost PC | Mod. Defensa | Ferides màx |
|------|-----|---------|-------------|-------------|
| 1 | Diminut | -20 | +2 | 10 |
| 2 | Petit | -10 | +1 | 20 |
| 3 | Mitjà | 0 | 0 | 30 |
| 4 | Gran | +10 | -1 | 40 |
| 5 | Enorme | +20 | -2 | 50 |

### Constitució (1-5)
| Constitució | Nom | Cost PC | Fatiga màx |
|-------------|-----|---------|-----------|
| 1 | Minsa | -20 | 10 |
| 2 | Feble | -10 | 20 |
| 3 | Normal | 0 | 30 |
| 4 | Robusta | +10 | 40 |
| 5 | Excepcional | +20 | 50 |

---

## Estadístiques Derivades

- **Defensa** = AGI + modificador de mida
- **Latència** = max(1, 10 + MIDA - AGI × 2)
- **Reducció de Dany** = FOR
- **Reacció** = 1 base + reflexos ràpids (+1) - lent (-1)
- **Ferides màximes** = MIDA × 10
- **Fatiga màxima** = CONSTITUCIÓ × 10
- **Protecció** = armadura equipada + armadura natural (tret) + artefactes

---

## Mecànica de Daus (D10 Pool)

- **Pool** = atribut + nivell d'habilitat + modificadors
- Per cada D10:
  - **1-5** = 0 èxits
  - **6-9** = 1 èxit ("fite")
  - **10** = 2 èxits
- **Pífia** = qualsevol 1 tirat I total fites = 0

### Modificadors de Trets
- **Adepte**: repetir 1s una vegada
- **Inepte**: 10s no compten doble, cada 1 resta 1 fite
- **Especialista**: ignorar 1s, 9-10 compten doble
- **Atribut Titànic**: ignorar 1s, 4+ compta com 1 èxit

---

## Habilitats (46 totals)

- **Bàsiques (40)**: Nivell màx 5, accessibles a tothom
- **Restringides (6)**: Arts Marcials, Canalització, Màgia, Psi, Qi — requereixen tret sobrenatural

**Taula de costos acumulats**: 0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55
- Amb tret Especialista: permet nivells 6-10 (+20 PC per habilitat)

---

## Trets (~140+, 17 categories)

Categories: atributs, habilitats, addiccions, al·lèrgies, física, armament natural, combat, salut, percepció, social, recursos, discapacitat, companys, longevitat, sobrenatural, sort, especial

- **Positius**: cost en PC positiu
- **Negatius**: donen PC (cost negatiu)
- **Paramètrics**: cost = baseCost + factorCost × nivell
- **Variables**: cost decidit pel jugador (ex: Company, Familiar)

---

## Combat (Rellotge de Latència)

### Fases
1. **Declaració**: Ordre = latència descendent → antagonistes primer → AGI menor primer → atzar
2. **Avanç**: Posició = latència base + modificador d'acció. Rellotge avança pel mínim.
3. **Resolució**: Entitats a posició 0 resolen. Atac vs defensa, càlcul de dany.
4. **Redeclaració**: Entitats resoltes tornen a declarar.

### Fórmules d'Atac
| Tipus | Atribut | Habilitat |
|-------|---------|-----------|
| Cos a cos | DES | Armes cos a cos |
| Distància | DES | Armes a distància |
| Distància (llançat) | AGI | Armes a distància |
| Barallar-se | FOR | Barallar-se |
| Arts Marcials | DES | Arts marcials |
| Natural | FOR | Barallar-se |

### Defensa
- **Bàsica** (passiva): Defensa calculada
- **Esquivar**: AGI + Esquivar (gasta reacció)
- **Parar**: DES + Armes cos a cos (gasta reacció)
- **Blocar**: Defensa estàtica + bonus reducció de dany

### Dany
`Dany = base + fites excedents - protecció - reducció de dany` (mínim 1 si impacta)

---

## Armes

### Naturals (7 tipus)
Cop (FOR+1), Tentacles (FOR+2), Urpes (FOR+2), Mossegada (FOR+2, Sagnat/1), Banyes (FOR+3, Sagnat/2), Pinces (FOR+3, Mutilat), Fibló (FOR+2, Toxina)

### Cos a Cos (12 tipus)
Des d'armes de mà (FOR+1, lat+0) fins a pics (FOR+3, lat+3, -2 protecció)

### Distància (13 tipus)
Des de pistoles (DES+2, lat+0) fins a armes pesades (DES+5, lat+4)

---

## Armadures (6 tipus)
| Tipus | Protecció | Latència |
|-------|-----------|---------|
| Lleugera flexible | 1 | +0 |
| Lleugera rígida | 2 | +1 |
| Mitjana flexible | 3 | +1 |
| Mitjana rígida | 4 | +2 |
| Pesada | 5 | +3 |
| Natural (tret) | 0-10 | +0 |

---

## Efectes Sobrenaturals (48 totals)

### Dons
- **Canalització** (Canalitzador)
- **Màgia** (Magus)
- **Psi** (Psíquic)
- **Qi** (Qi)

### Propietats
- Activació: trivial, normal, complex, ritual, permanent
- Dificultat: 0-3
- Cost d'equilibri
- Abast: tacte, curt, mitjà, llarg, extrem, multiversal
- Objectiu: un mateix, individual, àrea
- Durada: instantani, escena, sostingut, permanent

---

## Nivells de Ferides i Fatiga

### Ferides (% del màxim)
| Llindar | ca | es | en |
|---------|----|----|-----|
| 0% | Il·lès | Ileso | Unscathed |
| 1-16% | Masegat | Magullado | Bruised |
| 17-33% | Nafrat | Rasguñado | Scratched |
| 34-50% | Ferit | Herido | Wounded |
| 51-66% | Malferit | Malherido | Badly Wounded |
| 67-83% | Crític | Crítico | Critical |
| 84-100% | Incapacitat | Incapacitado | Incapacitated |

### Fatiga (% del màxim)
| Llindar | ca | es | en |
|---------|----|----|-----|
| 0% | Reposat | Descansado | Rested |
| 1-16% | Afeblit | Debilitado | Weakened |
| 17-33% | Cansat | Cansado | Tired |
| 34-50% | Defallit | Desfallecido | Exhausted |
| 51-66% | Exhaurit | Agotado | Worn Out |
| 67-83% | Rebentat | Reventado | Spent |
| 84-100% | Inconscient | Inconsciente | Unconscious |

---

## Sistema de Punts

Budget base: 100-150 PC per PJ. Es gasten en:
- Atributs (taula de costos per nivell)
- Espècie (taula fixa)
- Mida (taula fixa)
- Constitució (taula fixa)
- Habilitats (taula acumulativa)
- Trets (cost fix, paramètric o variable)
- Artefactes (cost fix per artefacte)
- Efectes sobrenaturals (cost fix per efecte)
