# FORJA RPG — Regles de creació de personatges (referència completa)

## Costos d'atributs primaris (acumulat des de rang 0)
rang 0 → 0 PC
rang 1 → 0 PC
rang 2 → 10 PC
rang 3 → 30 PC
rang 4 → 60 PC
rang 5 → 100 PC

Cost incremental: 0→1: 0, 1→2: 10, 2→3: 20, 3→4: 30, 4→5: 40

## Atributs secundaris: fórmules

Latència bàsica = 10 + mida_rang - (AGI × 2)
Defensa = AGI + mod_mida
  mod_mida: diminuta(1)→+2, petita(2)→+1, mitjana(3)→0, gran(4)→-1, enorme(5)→-2
Reducció de dany = FOR (per defecte; alguns trets o espècies el modifiquen)
Reacció = 1 (REFLEXOS RÀPIDS → 2)
Fatiga per nivell = constitucio_rang
Ferides per nivell = mida_rang

## Espècies i cost

| Espècie | Cost | Notes |
|---------|------|-------|
| Humanoide | 0 | estàndard |
| Animal | -15 | tractat amb condescendència |
| Artròpode | 5 | pot respirar aire O aigua |
| Cefalòpode | 25 | inclou: AQUÀTIC, GELATINÓS, TENTACLES x2 |
| Constructe | 10 | necessita energia mística |
| Incorpori | 15 | FOR/DES/AGI = 0; PER→AGI, INT→DES, APL→FOR |
| Mecanoide | 20 | no pot tenir trets sobrenaturals |
| Vegetal | 10 | necessita llum i aigua |

## Mida i constitució

### Mida (cost acumulat, rang 3=0)
diminuta(1): -10 PC — defensa+2
petita(2): -5 PC — defensa+1
mitjana(3): 0 PC — defensa+0
gran(4): +10 PC — defensa-1
enorme(5): +25 PC — defensa-2

### Constitució (cost acumulat, rang 3=0)
nyicris(1): -5 PC
magra(2): 0 PC
saludable(3): 0 PC
ferma(4): +10 PC
robusta(5): +25 PC

## Cost d'habilitats (incremental, el cost del rang = el valor del rang)
rang 1 → 1 PC addicional
rang 2 → 2 PC addicionals (acumulat 3)
rang 3 → 3 PC addicionals (acumulat 6)
rang 4 → 4 PC addicionals (acumulat 10)
rang 5 → 5 PC addicionals (acumulat 15)

Nota: cost acumulat des de 0 = rang × (rang+1) / 2

## Habilitats disponibles (B=bàsica, R=restringida)
Acrobàcies, Actuar, Amagar-se(B), Armes a distància, Armes cos a cos,
Armes improvisades(B), Art, Arts marcials, Barallar-se(B), Canalització(R),
Cercar(B), Ciència, Córrer(B), Consciència(B), Disfressar-se, Enginyeria,
Enigmes, Equilibri(B), Equitació, Escalada, Esquitllar-se(B), Esquivar(B),
Explosius, Força bruta, Humanitats, Informàtica(B), Intimidació,
Jocs de mans, Lideratge, Màgia(R), Medicina, Navegació, Nedar,
Negociació, Nyaps, Ofici, Oratòria, Persuasió, Psi(R), Qi(R),
Resistència(B), Supervivència, Tàctica, Tracte amb Animals, Vehicle,
Xerrameca

## Costos de trets (complets)

### Trets positius
ADEPTE/X: 15 — (X = atribut; repeteix 1s en tirades d'X)
AFORTUNAT: 20
AMFIBI: 10
APARENÇA ESTRANYA agradable: 2 / neutra: 0 / desagradable: -2
AQUÀTIC: 5
ARMADURA NATURAL/X: X×(X+1)/2 × 2 (aprox; taula: 1→2, 2→6, 3→12, 4→20, 5→30)
  Taula exacta: /1→2PC, /2→6PC, /3→12PC, /4→20PC, /5→30PC
ARMAMENT NATURAL urpes: 5 / mossegada o bec: 5 / banyes grans: 10 / pinces: 10 / fiblons: 5
ARRAUXAT: 10
ATRIBUT TITÀNIC: 30 (4+ compta com fita, ignora 1s)
BRAÇOS ADDICIONALS/X: 5 per parell
CANALITZADOR: 20
COMPANY: cost_pnj/4
CONTACTES: 10
CONTROL DEL QI: 20
COORDINACIÓ MILLORADA: 15
CUA: 5
CURACIÓ RÀPIDA/X: 15 per punt
DUR DE PELAR: 15
ÈMPATA: 20
ENCANTADOR: 2
ESPECIALISTA: 20
ESTATUS: 10
ETERN: 15
FAMILIAR/X: cost_pnj/3
FEROMONES: 15
FLEXIBLE: 5
GELATINÓS: 10
INCANSABLE: 10
LEVITAR: 15
LINGÜISTA NATURAL: 15
LONGEU: 6
MAGUS: 20
NO-MORT: 20
ORACLE: 30
POTES ADDICIONALS/X: 5 per parell
PROCESSADOR CORTICAL: 40
PSÍQUIC: 20
RECURSOS acomodat: 25 / elit: 50
REFLEXOS RÀPIDS: 30
REGENERACIÓ: 10
SENTIT AGUT un sentit: 10 / tots: 30
SENTIT DEL PERILL: 20
SONAR: 15
TENTACLES/X: 5 per parell
VISIÓ NOCTURNA: 10
VISIÓ PERIFÈRICA: 15
VOLADOR: 25

### Trets negatius (retornen PC)
ADICCIÓ lleu: -2 / moderada: -5 / severa: -10
AL·LÈRGIA lleu: -2 / moderada: -5 / severa: -10
DISCAPACITAT: -5
DRON: -30
EFÍMER: -10
ESGUERRAT mà: -5 / braç: -15 / cama: -5
FIGAFLOR: -10
FORASTER: -10
HEMOFÍLIC: -15
IMPEDIMENT DE LA PARLA: -15
INEPTE/X: -15
LENT: -10
POCA-TRAÇA: -5
REPULSIU: -2
RECURSOS pobre de solemnitat: -10
SENTIT ATROFIAT borni: -5 / cec: -25 / sord: -10 / gust+olfacte: -5 / tacte: -5

## Incompatibilitats de trets

DUR DE PELAR ↔ FIGAFLOR (incompatibles)
DUR DE PELAR ↔ HEMOFÍLIC (incompatibles)
CURACIÓ RÀPIDA ↔ HEMOFÍLIC (incompatibles)
REGENERACIÓ ↔ HEMOFÍLIC (incompatibles)
ADEPTE/X ↔ INEPTE/X (mateix atribut, incompatibles)
ETERN ↔ EFÍMER (incompatibles)
ETERN ↔ LONGEU (incompatibles)
EFÍMER ↔ LONGEU (incompatibles)
ENCANTADOR ↔ REPULSIU (incompatibles)
FLEXIBLE ↔ POCA-TRAÇA (incompatibles)
COORDINACIÓ MILLORADA ↔ POCA-TRAÇA (incompatibles)
INCANSABLE ↔ FIGAFLOR (incompatibles)
LENT ↔ REFLEXOS RÀPIDS (incompatibles)
SENTIT AGUT/X ↔ SENTIT ATROFIAT/X (mateix sentit, incompatibles)
SONAR ↔ SENTIT ATROFIAT/SORD (incompatibles)
FEROMONES ↔ SENTIT ATROFIAT/OLFACTE (incompatibles)
VISIÓ NOCTURNA ↔ SENTIT ATROFIAT/CEC (incompatibles)
VISIÓ PERIFÈRICA ↔ SENTIT ATROFIAT/BORNI (incompatibles)
MECANOIDE ↔ trets sobrenaturals (MAGUS, PSÍQUIC, CONTROL DEL QI, CANALITZADOR, ORACLE)

## Categories de PNJ per cost orientatiu

Figurant: 0–50 PC
Secundari (aliats/antagonistes): 60–220 PC (60–80% de la mitjana dels PJ)
Nèmesis: >200 PC (>200% de la mitjana dels PJ)
PJ estàndard: ~200 PC (campanya alta potència)

## Directrius per animals i criatures

Animals: normalment 1 dau en la majoria d'atributs, 2-3 en els especialitzats.
Trets típics: EFÍMER, ARMAMENT NATURAL, SENTIT AGUT, VISIÓ NOCTURNA, AQUÀTIC.
Criatures: poden tenir atributs més alts, trets inusuals, a vegades NO-MORT o DRON.
