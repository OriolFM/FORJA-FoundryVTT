#!/usr/bin/env python3
"""
Prepara els capítols del compendi «Manual FORJA» a partir de
docs/FORJA_FC001CA_CORE.md, la font de veritat (Oriol FM, 2026-10-06).

El manual és un sol fitxer exportat del Word amb pandoc, amb taules de
quadrícula que `marked` (scripts/build-manual.mjs) no entén. Aquest script:
1. el parteix per capítols (`# Títol`) amb els noms de fitxer del compendi
   (FORJA_00_portada_prefaci.md…), perquè build-manual en conservi els `_id`;
2. neteja el que no té sentit a Foundry: atributs de pandoc a les capçaleres,
   imatges (`media/…`), l'índex del llibre (Foundry té el seu) i capçaleres buides;
3. passa cada capítol per `pandoc -f markdown -t gfm` (les taules de quadrícula
   esdevenen taules GFM o HTML).

Ús: python3 scripts/manual-des-de-docs.py <carpeta de sortida>
Després: node scripts/build-manual.mjs --md=<carpeta>  (o npm run build:manual-docs)
"""
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

ARREL = Path(__file__).resolve().parent.parent
MANUAL = ARREL / "docs/FORJA_FC001CA_CORE.md"

# Capítol del manual (títol `#`) → nom del fitxer del compendi.
FITXERS = [
    ("FORJA", "FORJA_00_portada_prefaci.md"),
    ("EL MULTIVERS DE FORJA", "FORJA_01_el_multivers.md"),
    ("PERSONATGE", "FORJA_02_personatge.md"),
    ("SISTEMES", "FORJA_03_sistemes.md"),
    ("CIÈNCIA, TECNOLOGIA, I EL MÓN SOBRENATURAL", "FORJA_04_ciencia_sobrenatural.md"),
    ("EL MODERN DEMIÜRG", "FORJA_05_modern_demiurg.md"),
    ("PERSONATGES NO JUGADORS", "FORJA_06_pnj.md"),
    ("Epíleg", "FORJA_07_epilog.md"),
]


def amplada(text):
    """Amplada visual (com la compta pandoc): els caràcters amples (⬛, ⬜…) ocupen 2."""
    return sum(2 if unicodedata.east_asian_width(c) in "WF" else 0 if unicodedata.combining(c) else 1 for c in text)


def cel_les(linia):
    """Cel·les d'una fila de taula de quadrícula (`| a | b |`); els `\\|` no separen."""
    return [c[1:] if c.startswith(" ") else c for c in re.split(r"(?<!\\)\|", linia)[1:-1]]


def reconstruir_taula(linies):
    """
    Reescriu una taula de quadrícula amb les columnes ben alineades. El Word
    exportat (i algunes edicions a mà) en deixa amb files d'amplada diferent
    o amb caràcters amples, i pandoc no les reconeix com a taula.
    Torna `None` si alguna fila no té el nombre de columnes de la vora.
    """
    vores = [l for l in linies if l.startswith("+")]
    columnes = vores[0].count("+") - 1
    files = [None if l.startswith("+") else cel_les(l.rstrip()) for l in linies]
    if any(f is not None and len(f) != columnes for f in files):
        return None
    amples = [max([amplada(f[i].rstrip()) for f in files if f] + [3]) for i in range(columnes)]
    sortida = []
    for linia, f in zip(linies, files):
        if f is None:
            car = "=" if "=" in linia else "-"
            sortida.append("+" + "+".join(car * (a + 2) for a in amples) + "+")
        else:
            sortida.append("|" + "|".join(" " + c.rstrip() + " " * (a - amplada(c.rstrip())) + " " for c, a in zip(f, amples)) + "|")
    return sortida


def inline_html(text):
    """Markdown en línia mínim de les cel·les (negreta, cursiva, escapades de pandoc)."""
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"(?<![\\*])\*(?!\s)(.+?)(?<![\\\s])\*", r"<em>\1</em>", text)
    return re.sub(r"\\(.)", r"\1", text)


def taula_html(linies):
    """
    Taula de quadrícula amb cel·les fusionades → HTML. Les files es parteixen
    pels `|` (no per posicions, perquè el Word en deixa de desquadrades); el
    colspan de les files amb menys cel·les surt de les vores de sobre.
    """
    vores = [l for l in linies if l.startswith("+")]
    total = max(v.count("+") - 1 for v in vores)
    posicions = next(v for v in vores if v.count("+") - 1 == total)
    talls = [i for i, c in enumerate(posicions) if c == "+"]
    cap, cos, fila, vora_sobre, es_cap = [], [], [], vores[0], True
    html = ["<table>"]
    def tancar(fila, vora_sobre, capcalera):
        if not fila:
            return
        cel = [" ".join(t) for t in zip(*fila)]
        if len(cel) == total:
            spans = [1] * total
        else:
            limits = [i for i, c in enumerate(vora_sobre) if c == "+"]
            spans = [max(1, sum(1 for t in talls[:-1] if a <= t < b)) for a, b in zip(limits, limits[1:])]
            if len(spans) != len(cel):
                spans = [1] * len(cel)
        etiqueta = "th" if capcalera else "td"
        (cap if capcalera else cos).append("<tr>" + "".join(
            f"<{etiqueta}{f' colspan={chr(34)}{n}{chr(34)}' if n > 1 else ''}>{inline_html(c.strip())}</{etiqueta}>"
            for c, n in zip(cel, spans)) + "</tr>")
    for l in linies[1:]:
        if l.startswith("+"):
            capcalera = es_cap and "=" in l
            tancar(fila, vora_sobre, capcalera or (es_cap and l == linies[-1] and False))
            if "=" in l:
                es_cap = False
            elif es_cap and fila and not any("=" in v for v in vores):
                es_cap = False
            fila, vora_sobre = [], l
        else:
            fila.append(cel_les(l))
    if cap:
        html.append("<thead>" + "".join(cap) + "</thead>")
    html.append("<tbody>" + "".join(cos) + "</tbody></table>")
    return "".join(html)


def arreglar_taules(text, html_apart):
    """
    Taules de quadrícula: les reconstrueix alineades perquè pandoc les entengui;
    les que tenen cel·les fusionades les converteix a HTML a part (`html_apart`)
    i deixa un marcador al text, que es substitueix després de pandoc.
    """
    linies = text.split("\n")
    sortida, k = [], 0
    while k < len(linies):
        if re.match(r"^\+[-=:]", linies[k]):
            a = k
            while k + 1 < len(linies) and linies[k + 1].startswith(("|", "+")):
                k += 1
            taula = linies[a:k + 1]
            arreglada = reconstruir_taula(taula)
            if arreglada:
                sortida += arreglada
            else:
                html_apart.append(taula_html(taula))
                sortida.append(f"FORJATAULAHTML{len(html_apart) - 1}")
        else:
            sortida.append(linies[k])
        k += 1
    return "\n".join(sortida)


def netejar(text, html_apart):
    text = re.sub(r"^(#+ .*?)\s*\{[#.][^}]*\}\s*$", r"\1", text, flags=re.M)   # {#id .Classe}
    text = re.sub(r"!\[[^\]]*\]\(media/[^)]*\)(\{[^}]*\})?", "", text)          # imatges del Word
    text = re.sub(r"^#+\s*$\n?", "", text, flags=re.M)                         # capçaleres buides
    return arreglar_taules(text, html_apart)


def capitols(text):
    """[(títol, cos)] separant per `# `. El text abans del primer és la portada («FORJA»)."""
    linies = text.split("\n")
    resultat = [["FORJA", []]]
    for l in linies:
        m = re.match(r"^# (.+)$", l)
        if m and m.group(1).strip() != "Prefaci":
            resultat.append([m.group(1).strip(), []])
            continue
        if m:  # el Prefaci és una pàgina del capítol de portada
            l = "## Prefaci"
        resultat[-1][1].append(l)
    return [(t, "\n".join(c)) for t, c in resultat]


def treure_index(cos):
    """Treu la secció «## Índex» (enllaços a pàgines del llibre en paper)."""
    return re.sub(r"^## Índex\n.*?(?=^## )", "", cos, flags=re.S | re.M)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    sortida = Path(sys.argv[1])
    sortida.mkdir(parents=True, exist_ok=True)
    noms = dict(FITXERS)
    html_apart = []
    for titol, cos in capitols(netejar(MANUAL.read_text(encoding="utf-8"), html_apart)):
        if titol not in noms:
            sys.exit(f"Capítol sense fitxer assignat: «{titol}»")
        if titol == "FORJA":
            cos = treure_index(cos)
        gfm = subprocess.run(
            ["pandoc", "-f", "markdown", "-t", "gfm", "--wrap=none"],
            input=f"# {titol}\n\n{cos}", capture_output=True, text=True, check=True
        ).stdout
        gfm = re.sub(r"FORJATAULAHTML(\d+)", lambda m: html_apart[int(m.group(1))], gfm)
        (sortida / noms[titol]).write_text(gfm, encoding="utf-8")
        print(f"{noms[titol]}: {len(gfm.splitlines())} línies")


if __name__ == "__main__":
    main()
