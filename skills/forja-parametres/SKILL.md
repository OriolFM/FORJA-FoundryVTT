---
name: "forja-parametres"
description: "Calcula i valida el cost en PC, la dificultat i la latència d'artefactes i efectes de FORJA v3 amb la taula de paràmetres del cap. 4. Usa'l per crear-ne de nous o revisar plantilles, en lloc de forja-artefactes."
---

# FORJA v3 — Paràmetres d'artefactes i efectes

Substitueix `forja-artefactes`, que fa servir taules de cost que no són les del manual v3. Calcula sempre amb el codi, mai de memòria.

Les plantilles del manual codificades i el motor també són a `E:\Onedrive\HOBBIES\FORJA_RPG\FORJA_CORE\forja-parametres\` (`forja_parametres.py`, `plantilles.py`, `run.py`).

## Regles (taula del cap. 4 + decisions de l'Oriol, 4/10/2026)

- El cost total és la suma del cost de cada paràmetre; la dificultat i la latència també se sumen.
- **Dificultat**: cada punt que es baixa respecte de la calculada costa +5 PC; cada punt que es puja en retorna 5, comptant des de la calculada encara que sigui 0 o negativa. La dificultat final mínima és 1 (excepte artefactes permanents). Si pujar-la a 1 deixa el cost massa baix, és preferible millorar l'efecte.
- **Latència**: cada punt per sobre de la calculada retorna 2 PC; cada punt per sota costa 2 PC. Límit ±12; latència final entre 2 i 24.
- **Ritual**: −10 PC, −1 dif., **+10 latència** (la taula antiga deia +5).
- **Ús**: només temps narratiu −10 PC / −1 dif.; reacció +5 PC.
- **Abast**: toc 0; a distància +5 PC / +1 dif.
- **Objectius**: només usuari −5 PC; individuals 0; àrea +5 PC / +1 dif.
- **Durada**: instantània 0; durada (1 escena) +5 PC / +1 dif.
- **Artefactes**: activació normal 0; trivial +10 PC; **activació complexa = només temps narratiu** (−10 PC / −1 dif.); recàrrega −2 PC per unitat d'espera; acumulador +3 PC per càrrega addicional; mode d'espera +5 PC.
- **Armes i armadures bàsiques del manual: cost 0.** Només es paga el que s'hi afegeix (dany o protecció per sobre de la base, latència per sota de la base, etc.).
- **Dany**: indirecte 0 + 2/nivell; directe 5 + 4/nivell, +1 dif.; drenatge 10 + 6/nivell, +2 dif. Tipus: fatiga/ferides 0, fatiga o ferides +2, fatiga i ferides +4, àcid/foc/electricitat/fred +3, explosió +4, malaltia 0, radiació +5.
- **Curació** per nivell: fatiga 2, ferides 2, fatiga o ferides 3, fatiga i ferides 4; estats negatius +5; malalties +5.
- **Protecció**: armadura 0 + 2/nivell; ègida 5 + 1/nivell; barrera física 5 + 2/nivell.
- **Habilitats**: eina (1a hab.) 0 + 3/nivell, lat +1; eina (2a hab.) 5 + 3/nivell, lat +1; autoeina (1a hab.) 5 + **5**/nivell, lat +2; autoeina (2a hab.) 10 + 5/nivell, lat +1 (la taula antiga deia +0,5).
- **Estats**: base + per nivell (en estats sense valor, el nivell és el modificador a la resistència) i la dificultat de la taula (vegeu `ESTATS`).
- **Alteració**: atribut 5 + 5/nivell; tret = valor absolut del cost del tret. **Transformació**: 0,25 PC per PC de l'alter ego.
- **Translocació** 5 PC (portals: 0 PC, +1 dif., lat 5) + distància (curta 10/0/1, mitjana 20/1/2, llarga 30/1/3, extrema 50/1/4, multiversal 100/2/5; cost/dif./lat.).
- **Mentals**: llegir/sondar 10, projectar 10, control emocional 15 (+1 dif.), suggestió 15 (+1), control mental 25 (+2). **Telecinesi**: alfa 10, beta 10 (+1), gamma 15 (+2).
- **Replicació**: massa + complexitat (vegeu `MASSA` i `COMPLEX`).
- **Invocació / creació de constructes**: 15 + PC de la criatura × 0,25, dif. 4, lat. 15 (més ritual, narratiu, etc.).
- Arrodoniment final cap amunt.

## Flux de treball

1. Escriu el motor següent a `forja_parametres.py`.
2. Defineix els paràmetres com una llista de tuples, p. ex. `[('distància',), ('dany', 'indirecte', 5, 'foc'), ('àrea',)]`.
3. `calcula(params, dif_decl=..., lat_decl=..., permanent=...)` retorna `(cost, dificultat, latència calculada, files, ajustos)`; `desglos(...)` en dona el detall línia a línia.
4. Per validar el manual, compara el cost declarat de cada plantilla amb el calculat i mostra el desglossament de les que no quadren.
5. Fitxa en el format del manual: «N PC. Efecte <do>, acció de dificultat D, es pot fer servir en temps narratiu i actiu (amb latència +L).» i una línia amb la mecànica.

Quan una correcció canviï el cost d'un artefacte o efecte, revisa també els PJ i PNJ que el porten (Anya, Trace, Il·luminat errant, Ermità psíquic, Magistrat, Ajudant de magistrat, Explorador Klorgh, Guàrdia d'assalt, Tècnic gob, Renegat).

## Motor (`forja_parametres.py`)

```python
# -*- coding: utf-8 -*-
import math

OPC = {
    'ritual_lat': 10,          # la taula antiga deia +5
    'autoeina_nivell': 5,      # la taula antiga deia +0,5
    'trivial': 10,
    'complexa': (-10, -1, 0),  # activació complexa = només temps narratiu
    'arrodonir': 'amunt',
}

DANY_TIPUS = {'fatiga': 0, 'ferides': 0, 'fatiga o ferides': 2, 'fatiga i ferides': 4, 'àcid': 3, 'foc': 3,
              'electricitat': 3, 'explosió': 4, 'fred': 3, 'malaltia': 0, 'radiació': 5}
CURA = {'fatiga': 2, 'ferides': 2, 'fatiga o ferides': 3, 'fatiga i ferides': 4}
ESTATS = {  # base, per nivell, dificultat
    'abatut': (3, 1, 0), 'acovardit': (2, 1, 1), 'atordit': (3, 1, 0), 'atrapat': (3, 1, 1), 'berserc': (3, 1, 1),
    'concentrat': (1, 1, 0), 'empès': (3, 1, 0), 'immobilitzat': (5, 1, 0), 'incapacitat': (5, 1, 1),
    'inconscient': (5, 1, 1), 'lent': (3, 2, 1), 'llançat': (3, 1, 0), 'malaltia': (3, 1, 1), 'toxina': (3, 1, 1),
    'marejat': (1, 1, 0), 'esguerrat': (3, 1, 1), 'ràpid': (3, 2, 1), 'recuperació': (3, 2, 1), 'sagnant': (3, 2, 1),
    'vigilant': (3, 1, 0)}
MENTAL = {'llegir': (10, 0), 'projectar': (10, 0), 'control emocional': (15, 1), 'suggestió': (15, 1), 'control mental': (25, 2)}
TELEC = {'alfa': (10, 0), 'beta': (10, 1), 'gamma': (15, 2)}
TRANSLOC = {'translocació': (5, 0, 0), 'portals': (0, 1, 5)}
DIST = {'curta': (10, 0, 1), 'mitjana': (20, 1, 2), 'llarga': (30, 1, 3), 'extrema': (50, 1, 4), 'multiversal': (100, 2, 5)}
MASSA = {'<1kg': (5, 0, 5), '100kg': (10, 1, 10), 'qualsevol': (15, 2, 15)}
COMPLEX = {'matèria primera': (0, 0, 0), 'monomaterial': (5, 1, 1), 'sense parts mòbils': (5, 1, 1),
           'parts mòbils': (10, 2, 1), 'electrònic': (10, 3, 2), 'nanomaquinària': (15, 4, 2)}
# Armes i armadures bàsiques (latència, dany/protecció) — cost 0
ARMES = {'cop': (0, 1), 'contundent': (2, 2), 'de mà': (0, 1), 'destral': (2, 3), 'escut': (1, 2), 'espasa': (1, 2),
         'fulla curta': (0, 1), 'fulla llarga': (2, 3), 'llança': (3, 3), 'pic': (3, 3),
         'pistola': (0, 2), 'subfusell': (1, 2), "arma d'assalt": (1, 3), 'rifle': (2, 4), 'escopeta': (2, 3)}
ARMADURES = {'lleugera flexible': (0, 1), 'lleugera rígida': (1, 2), 'mitjana flexible': (1, 3),
             'mitjana rígida': (2, 4), 'pesant': (3, 5)}


def p(k, *a):
    """Retorna (cost, dif, lat, etiqueta) d'un paràmetre."""
    o = OPC
    if k == 'ritual': return (-10, -1, o['ritual_lat'], 'ritual')
    if k == 'narratiu': return (-10, -1, 0, 'només temps narratiu')
    if k == 'reacció': return (5, 0, 0, 'reacció')
    if k == 'distància': return (5, 1, 0, 'a distància')
    if k == 'usuari': return (-5, 0, 0, 'només usuari')
    if k == 'àrea': return (5, 1, 0, "àrea d'efecte")
    if k == 'durada': return (5, 1, 0, 'durada')
    if k == 'trivial': return (o['trivial'], 0, 0, 'activació trivial')
    if k == 'complexa': c, d, l = o['complexa']; return (c, d, l, 'activació complexa')
    if k == 'recàrrega': return (-2 * a[0], 0, 0, f'recàrrega {a[0]}')
    if k == 'acumulador': return (3 * a[0], 0, 0, f'acumulador +{a[0]}')
    if k == 'espera': return (5, 0, 0, "mode d'espera")
    if k == 'dany':  # categoria, nivells, tipus
        cat, n, t = a
        base, per, d = {'indirecte': (0, 2, 0), 'directe': (5, 4, 1), 'drenatge': (10, 6, 2)}[cat]
        return (base + per * n + DANY_TIPUS[t], d, 0, f'dany {cat} +{n} {t}')
    if k == 'cura': n, t = a; return (CURA[t] * n, 0, 0, f'cura {n} {t}')
    if k == 'cura estats': return (5, 0, 0, 'cura estats negatius')
    if k == 'cura malalties': return (5, 0, 0, 'cura malalties')
    if k == 'armadura': return (2 * a[0], 0, 0, f'armadura +{a[0]}')
    if k == 'ègida': return (5 + a[0], 0, 0, f'ègida {a[0]}')
    if k == 'barrera': return (5 + 2 * a[0], 0, 0, f'barrera {a[0]}')
    if k == 'eina': return (3 * a[0], 0, 1, f'eina +{a[0]}')
    if k == 'eina2': return (5 + 3 * a[0], 0, 1, f'eina 2a hab. +{a[0]}')
    if k == 'autoeina': return (5 + o['autoeina_nivell'] * a[0], 0, 2, f'autoeina {a[0]} fites')
    if k == 'autoeina2': return (10 + o['autoeina_nivell'] * a[0], 0, 1, f'autoeina 2a hab. {a[0]} fites')
    if k == 'alterar percepció': return (3 + 2 * a[0], 0, 0, f'alterar percepció {a[0]}')
    if k == 'il·lusió': return (5 + a[0], 1, 0, f'il·lusió +{a[0]}')
    if k == 'estat':
        nom, n = a; b, per, d = ESTATS[nom]; return (b + per * n, d, 0, f'{nom} {n}')
    if k == 'atribut': return (5 + 5 * a[0], 0, 0, f'atribut +{a[0]}')
    if k == 'tret': return (abs(a[1]), 0, 0, f'tret {a[0]}')
    if k == 'transformació': return (0.25 * a[0], 0, 0, f'transformació {a[0]} PC')
    if k == 'translocació':
        t, dist = a; c1, d1, l1 = TRANSLOC[t]; c2, d2, l2 = DIST[dist]
        return (c1 + c2, d1 + d2, l1 + l2, f'{t} {dist}')
    if k == 'mental': c, d = MENTAL[a[0]]; return (c, d, 0, a[0])
    if k == 'telecinesi': c, d = TELEC[a[0]]; return (c, d, 0, f'telecinesi {a[0]}')
    if k == 'replicació':
        m, cx = a; c1, d1, l1 = MASSA[m]; c2, d2, l2 = COMPLEX[cx]
        return (c1 + c2, d1 + d2, l1 + l2, f'replicació {m} {cx}')
    if k == 'invocació': return (15 + 0.25 * a[0], 4, 15, f'invocació criatura {a[0]} PC')
    if k == 'arma':  # arma base, latència i dany finals de l'arma (sense els d'eines afegides)
        nom, lat, dany = a; bl, bd = ARMES[nom]
        return (2 * max(0, dany - bd) - 2 * (lat - bl), 0, lat, f'{nom} (lat {lat}, dany {dany})')
    if k == 'armadura base':  # armadura base, latència i protecció finals de l'armadura
        nom, lat, prot = a; bl, bp = ARMADURES[nom]
        return (2 * (prot - bp) - 2 * (lat - bl), 0, lat, f'{nom} (lat {lat}, prot {prot})')
    raise ValueError(k)


def calcula(params, dif_decl=None, lat_decl=None, permanent=False):
    rows = [p(*x) for x in params]
    c = sum(r[0] for r in rows); d = sum(r[1] for r in rows); l = sum(r[2] for r in rows)
    adj = []
    if dif_decl is not None and not permanent and dif_decl != d:
        adj.append((-5 * (dif_decl - d), f'dificultat {d}→{dif_decl}')); c += adj[-1][0]
    if lat_decl is not None and lat_decl != l:
        adj.append((-2 * (lat_decl - l), f'latència {l}→{lat_decl}')); c += adj[-1][0]
    cost = math.ceil(c - 1e-9) if OPC['arrodonir'] == 'amunt' else round(c)
    return cost, (dif_decl if dif_decl is not None else max(d, 1)), l, rows, adj


def desglos(params, **kw):
    cost, d, l, rows, adj = calcula(params, **kw)
    out = [f'  {r[3]:40} {r[0]:+7.2f} PC  dif {r[1]:+d}  lat {r[2]:+d}' for r in rows]
    out += [f'  {a[1]:40} {a[0]:+7.2f} PC' for a in adj]
    out.append(f'  TOTAL {cost} PC, dificultat {d}, latència calculada +{l}')
    return '\n'.join(out)
```