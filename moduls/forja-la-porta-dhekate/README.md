# FORJA — La porta d'Hèkate (mòdul de Foundry VTT)

Aventura introductòria de FORJA RPG (`FM000CA_La_porta_dHekate`, esborrany v0.2), empaquetada com a mòdul de Foundry. Requereix el sistema `forja`.

- `font/*.md`: el text del mòdul en Markdown. Un fitxer per capítol (`# Títol`); cada `##` és una pàgina del diari. Convertit del `.docx` amb `pandoc -t gfm` i dividit per capítols.
- `packs/_source/aventura/`: fonts JSON del compendi (generades, no s'editen a mà).
- `packs/aventura/`: compendi compilat (LevelDB).

## Instal·lar-lo en local

Enllaça aquesta carpeta a `Data/modules/forja-la-porta-dhekate`. A Windows (PowerShell):

```powershell
New-Item -ItemType Junction -Path "$env:LOCALAPPDATA\FoundryVTT\Data\modules\forja-la-porta-dhekate" -Target "<repo>\moduls\forja-la-porta-dhekate"
```

Reinicia Foundry i activa el mòdul al món.

## Regenerar el compendi

Després d'editar `font/*.md`, des de l'arrel del repositori:

```
npm run build:hekate
```

## Actors de l'aventura

Els 8 PJ pregenerats, els 13 PNJ i les 4 criatures són als compendis del **sistema** (`pj`, `pnj`, `criatures`), dins la carpeta «La porta d'Hèkate». Els genera `scripts/build-packs.mjs` a partir de `font/` (`scripts/aventura-hekate.mjs`).

El mòdul segueix unes regles anteriors. Es converteixen així (Oriol FM, 2026-10-06):
- constitució, esglaó a esglaó: feble → magra, saludable → saludable, robusta → ferma, massissa → robusta;
- mida col·losal → enorme;
- es mantenen els atributs, les habilitats i els trets, i el cost i els derivats es recalculen.

Tot el que no s'ha pogut mapar i les diferències amb el mòdul són a [`CONVERSIO.md`](CONVERSIO.md).
