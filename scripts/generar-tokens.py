#!/usr/bin/env python3
"""
Tokens provisionals dels actors dels compendis (Oriol FM, 2026-10-06).

Per a cada actor de `packs/_source/{pj,pnj,animals,criatures}/*.json` genera
`assets/tokens/<pack>/<slug>.webp`: un cercle gris neutre amb l'anella i el
nom corbat a la banda, com els tokens de `mon-proves/assets`. Si l'actor ja
té un token dibuixat (`TOKENS_REALS`), en copia el PNG tal qual (`<slug>.png`)
en lloc del provisional. `scripts/build-packs.mjs` els assigna (`img` i
`prototypeToken.texture.src`) quan el fitxer existeix.

Ús: python3 scripts/generar-tokens.py   (cal Pillow)
Després: npm run build:packs
"""
import json
import math
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ARREL = Path(__file__).resolve().parent.parent
FONTS = ARREL / "packs/_source"
SORTIDA = ARREL / "assets/tokens"
PACKS = ["pj", "pnj", "animals", "criatures"]

# Tokens ja dibuixats (mon-proves/assets) per a actors dels compendis.
TOKENS_REALS = {
    ("pj", "yoko-1"): "mon-proves/assets/Yoko-1.png",
    ("pj", "trace"): "mon-proves/assets/Trace.png",
    ("pj", "marvin-el-delfic"): "mon-proves/assets/Marvin.png",
    ("criatures", "golem-de-carn"): "mon-proves/assets/Necrogolem.png",
    ("criatures", "hekate-aracnid-acherontia-xm976"): "mon-proves/assets/Aracnid.png",
}

MIDA = 265          # px, com els tokens existents
ESCALA = 4          # supermostreig per suavitzar les vores
FONT = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"

GRIS_CERCLE = (150, 150, 150, 255)
GRIS_BANDA = (92, 92, 92, 255)
NEGRE = (25, 25, 25, 255)
TEXT = (225, 225, 225, 255)

# Banda: de dalt a la dreta fins a baix a l'esquerra (graus, sentit horari
# des de les 3 en punt, com PIL).
BANDA_INICI, BANDA_FI = -65, 150


def token_provisional(nom: str) -> Image.Image:
    s = ESCALA
    m = MIDA * s
    c = m / 2
    r_ext = 128 * s
    r_int = 102 * s
    vora = 4 * s
    img = Image.new("RGBA", (m, m), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Cercle exterior (retrat, gris neutre) amb contorn negre.
    caixa = lambda r: (c - r, c - r, c + r, c + r)
    d.ellipse(caixa(r_ext + vora), fill=NEGRE)
    d.ellipse(caixa(r_ext), fill=GRIS_CERCLE)
    # Banda (anell parcial) dins el cercle, amb contorn a la vora interior i
    # als extrems; el retrat ocupa la resta.
    d.pieslice(caixa(r_ext), BANDA_INICI, BANDA_FI, fill=GRIS_BANDA, outline=NEGRE, width=vora)
    d.pieslice(caixa(r_int + vora), BANDA_INICI, BANDA_FI, fill=NEGRE)
    d.ellipse(caixa(r_int), fill=GRIS_CERCLE)

    # Nom corbat sobre la banda, començant a baix a l'esquerra.
    r_text = (r_ext + r_int) / 2
    arc_max = math.radians(BANDA_FI - BANDA_INICI - 12) * r_text
    mida_font = 26 * s
    while True:
        font = ImageFont.truetype(FONT, mida_font)
        llarg = sum(font.getlength(ch) for ch in nom)
        if llarg <= arc_max or mida_font <= 12 * s:
            break
        mida_font -= s
    alt = mida_font * 1.3
    angle = math.radians(BANDA_FI - 6)
    for ch in nom:
        avanc = font.getlength(ch)
        mig = angle - (avanc / 2) / r_text
        lletra = Image.new("RGBA", (int(avanc + alt), int(alt * 1.2)), (0, 0, 0, 0))
        ld = ImageDraw.Draw(lletra)
        ld.text((lletra.width / 2, lletra.height / 2), ch, font=font, fill=TEXT,
                anchor="mm", stroke_width=s, stroke_fill=NEGRE)
        rot = lletra.rotate(-(math.degrees(mig) - 90), resample=Image.BICUBIC, expand=True)
        x = c + r_text * math.cos(mig) - rot.width / 2
        y = c + r_text * math.sin(mig) - rot.height / 2
        img.alpha_composite(rot, (int(x), int(y)))
        angle -= avanc / r_text

    return img.resize((MIDA, MIDA), Image.LANCZOS)


def main():
    total = 0
    for pack in PACKS:
        dest = SORTIDA / pack
        dest.mkdir(parents=True, exist_ok=True)
        for f in sorted((FONTS / pack).glob("*.json")):
            if f.stem.startswith("_"):
                continue  # carpetes
            slug = f.stem
            nom = json.loads(f.read_text(encoding="utf-8"))["name"]
            real = TOKENS_REALS.get((pack, slug))
            if real:
                # Còpia exacta, sense convertir: els dibuixos són PNG de 16 bits amb
                # un bloc cICP (espai de color) que Pillow ignora; convertits a WEBP
                # perdien saturació (proves 2026-10-10).
                (dest / f"{slug}.webp").unlink(missing_ok=True)
                shutil.copyfile(ARREL / real, dest / f"{slug}.png")
            else:
                token_provisional(nom).save(dest / f"{slug}.webp", "WEBP", quality=90, method=6)
            total += 1
    print(f"{total} tokens a {SORTIDA.relative_to(ARREL)}")


if __name__ == "__main__":
    main()
