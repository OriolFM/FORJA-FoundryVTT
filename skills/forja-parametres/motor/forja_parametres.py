# -*- coding: utf-8 -*-
"""Calculador de cost d'artefactes i efectes de FORJA v3 (cap. 4, taula de paràmetres).

Cada paràmetre suma (cost, dificultat, latència). Després:
  - cost += 5 per cada punt que la dificultat declarada sigui MÉS BAIXA que la calculada
    (i -5 per cada punt més alta), comptant des de la calculada encara que sigui 0 o negativa.
    La dificultat final mínima és 1,
    excepte artefactes permanents.
  - cost -= 2 per cada punt de latència declarada per sobre de la calculada (+2 per cada punt per sota).
Armes i armadures bàsiques del manual: cost 0; només es paga el que s'hi afegeix.
"""
import math

# ---------------- opcions (dubtes de regles) ----------------
OPC = {
    'ritual_lat': 10,          # taula original deia +5; totes les plantilles fan servir +10
    'autoeina_nivell': 5,      # taula original deia +0,5
    'trivial': 10,             # taula: +10; Botes antigravetat quadra amb +2
    'complexa': (-10, -1, 0),  # "activació complexa" = només temps narratiu (decisió Oriol)
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
         'pistola': (0, 2), 'subfusell': (1, 2), 'arma d\'assalt': (1, 3), 'rifle': (2, 4), 'escopeta': (2, 3)}
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
    if k == 'àrea': return (5, 1, 0, 'àrea d\'efecte')
    if k == 'durada': return (5, 1, 0, 'durada')
    if k == 'trivial': return (o['trivial'], 0, 0, 'activació trivial')
    if k == 'complexa': c, d, l = o['complexa']; return (c, d, l, 'activació complexa')
    if k == 'recàrrega': return (-2 * a[0], 0, 0, f'recàrrega {a[0]}')
    if k == 'acumulador': return (3 * a[0], 0, 0, f'acumulador +{a[0]}')
    if k == 'espera': return (5, 0, 0, 'mode d\'espera')
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
    if k == 'arma':  # arma base + latència i dany declarats
        nom, lat, dany = a; bl, bd = ARMES[nom]
        return (2 * max(0, dany - bd) - 2 * (lat - bl), 0, lat, f'{nom} (lat {lat}, dany {dany})')
    if k == 'armadura base':
        nom, lat, prot = a; bl, bp = ARMADURES[nom]
        return (2 * (prot - bp) - 2 * (lat - bl), 0, lat, f'{nom} (lat {lat}, prot {prot})')
    raise ValueError(k)


def calcula(params, dif_decl=None, lat_decl=None, permanent=False, base_lat_fix=False):
    rows = [p(*x) for x in params]
    c = sum(r[0] for r in rows); d = sum(r[1] for r in rows); l = sum(r[2] for r in rows)
    adj = []
    if dif_decl is not None and not permanent:
        # la dificultat mínima és 1; pujar-la des de la calculada (encara que sigui 0 o negativa) abaixa el cost
        if dif_decl != d:
            adj.append((-5 * (dif_decl - d), f'dificultat {d}→{dif_decl}')); c += adj[-1][0]
    if lat_decl is not None and not base_lat_fix and lat_decl != l:
        adj.append((-2 * (lat_decl - l), f'latència {l}→{lat_decl}')); c += adj[-1][0]
    cost = math.ceil(c - 1e-9) if OPC['arrodonir'] == 'amunt' else round(c)
    return cost, (dif_decl if dif_decl is not None else max(d, 1)), l, rows, adj


def desglos(params, **kw):
    cost, d, l, rows, adj = calcula(params, **kw)
    out = [f'  {r[3]:40} {r[0]:+7.2f} PC  dif {r[1]:+d}  lat {r[2]:+d}' for r in rows]
    out += [f'  {a[1]:40} {a[0]:+7.2f} PC' for a in adj]
    out.append(f'  TOTAL {cost} PC, dificultat {d}, latència calculada +{l}')
    return '\n'.join(out)
