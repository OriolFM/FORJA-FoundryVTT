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

## Pendent

Els PJ pregenerats, els PNJ i les criatures del mòdul segueixen una versió anterior de les regles: constitucions «feble» i «massissa», mida «col·losal», defensa i fatiga amb una altra escala. Cal decidir-ne la conversió abans de posar-los als compendis.
