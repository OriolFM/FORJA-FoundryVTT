#!/usr/bin/env python3
"""
Compara el text d'un PDF del manual (maqueta) amb docs/FORJA_FC001CA_CORE.md
per trobar paràgrafs que no hi siguin (Oriol FM, 2026-10-06).

Extreu el text amb `pdftotext -bbox-layout` (poppler) i el reordena per
columnes (la maqueta és a doble pàgina i a dues columnes: 4 columnes per full
del PDF). Per a cada paràgraf calcula quina part dels seus grups de 4 paraules
(normalitzades: sense accents ni signes) apareix al Markdown. Els paràgrafs
per sota del llindar surten a l'informe: sovint són fragments de taules o
paràgrafs tallats per un salt de columna; cal revisar-los a mà.

Ús: python3 scripts/comparar-pdf.py manual.pdf [informe.md] [--llindar 0.6]
"""
import html
import re
import subprocess
import sys
import tempfile
import unicodedata
from pathlib import Path

ARREL = Path(__file__).resolve().parent.parent
MANUAL = ARREL / "docs/FORJA_FC001CA_CORE.md"
K = 4


def normalitzar(text):
    text = (text.replace("ŀl", "l·l").replace("Ŀl", "L·l").replace("’", "'")
            .replace("ﬁ", "fi").replace("ﬂ", "fl"))
    text = unicodedata.normalize("NFD", text).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", text).split()


def paragrafs_pdf(pdf):
    """[(full del PDF, paràgraf)] en ordre de lectura per columnes."""
    with tempfile.TemporaryDirectory() as tmp:
        sortida = Path(tmp) / "bbox.html"
        subprocess.run(["pdftotext", "-bbox-layout", str(pdf), str(sortida)], check=True)
        text = sortida.read_text(encoding="utf-8")
    resultat = []
    for full, (amplada, cos) in enumerate(re.findall(r'<page width="([\d.]+)" height="[\d.]+">(.*?)</page>', text, re.S), 1):
        blocs = []
        for b in re.finditer(r'<block xMin="([\d.]+)" yMin="([\d.]+)"[^>]*>(.*?)</block>', cos, re.S):
            linies = [" ".join(html.unescape(w) for w in re.findall(r"<word[^>]*>(.*?)</word>", l))
                      for l in re.findall(r"<line[^>]*>(.*?)</line>", b.group(3), re.S)]
            columna = int(float(b.group(1)) / (float(amplada) / 4))
            blocs.append((columna, float(b.group(2)), re.sub(r"(\w)-\s+(\w)", r"\1\2", " ".join(linies))))
        resultat += [(full, t) for _, _, t in sorted(blocs)]
    return resultat


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    llindar = float(sys.argv[sys.argv.index("--llindar") + 1]) if "--llindar" in sys.argv else 0.6
    if not args:
        sys.exit(__doc__)
    pdf = Path(args[0])
    informe = Path(args[1]) if len(args) > 1 else None
    md = normalitzar(MANUAL.read_text(encoding="utf-8"))
    grups = {tuple(md[i:i + K]) for i in range(len(md) - K + 1)}
    total = cobert = 0
    baixos = []
    for full, p in paragrafs_pdf(pdf):
        paraules = normalitzar(p)
        if len(paraules) < 10:
            continue
        g = [tuple(paraules[i:i + K]) for i in range(len(paraules) - K + 1)]
        c = sum(x in grups for x in g) / len(g)
        total += len(paraules)
        cobert += c * len(paraules)
        if c < llindar:
            baixos.append((full, c, p))
    linies = [f"# Comparació de `{pdf.name}` amb el manual en Markdown", "",
              f"Cobertura global: {cobert / max(total, 1):.1%}. Paràgrafs per sota de {llindar:.0%}: {len(baixos)}.", ""]
    linies += [f"- full {f}, {c:.0%}: {p}" for f, c, p in baixos]
    text = "\n".join(linies) + "\n"
    if informe:
        informe.write_text(text, encoding="utf-8")
    print(text if not informe else linies[2])


if __name__ == "__main__":
    main()
