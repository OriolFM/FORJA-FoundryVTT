/**
 * Factories de camps compartits entre DataModels d'actors FORJA.
 * Importat per actor-personatge.mjs i actor-pnj.mjs.
 */
import { FORJA } from "../config/constants.mjs";

/**
 * Genera l'SchemaField de habilitats (mapa fix de 46 habilitats).
 * Cada entrada: { nivell: 0–10, marca: ""/"B"/"R" }
 */
export function campsHabilitats(fields) {
  const entrades = {};
  for (const h of FORJA.LLISTA_HABILITATS) {
    entrades[h.id] = new fields.SchemaField({
      nivell:       new fields.NumberField({ integer: true, min: 0, max: 10, initial: 0, nullable: false }),
      marca:        new fields.StringField({ initial: "", blank: true }),
      especialitat: new fields.StringField({ initial: "", blank: true })
    });
  }
  return new fields.SchemaField(entrades);
}

/**
 * Camps base compartits per tots els actors FORJA
 * (personatge, pnj, criatura, animal).
 */
export function campsBase(fields) {
  return {
    // --- Atributs principals ---
    atributs: new fields.SchemaField({
      FOR: new fields.NumberField({ integer: true, min: 0, max: 5, initial: 1, nullable: false }),
      DES: new fields.NumberField({ integer: true, min: 0, max: 5, initial: 1, nullable: false }),
      AGI: new fields.NumberField({ integer: true, min: 0, max: 5, initial: 1, nullable: false }),
      PER: new fields.NumberField({ integer: true, min: 0, max: 5, initial: 1, nullable: false }),
      INT: new fields.NumberField({ integer: true, min: 0, max: 5, initial: 1, nullable: false }),
      APL: new fields.NumberField({ integer: true, min: 0, max: 5, initial: 1, nullable: false })
    }),

    // --- Atributs secundaris d'espècie/cos ---
    especie:     new fields.StringField({ initial: "humanoide", blank: false }),
    mida:        new fields.NumberField({ integer: true, min: 1, max: 5, initial: 3, nullable: false }),
    constitucio: new fields.NumberField({ integer: true, min: 1, max: 5, initial: 3, nullable: false }),

    // --- Habilitats (mapa fix, E-1) ---
    habilitats: campsHabilitats(fields),

    // --- Salut: caselles marcades per pista (S-15) ---
    salut: new fields.SchemaField({
      fatiga:  new fields.SchemaField({
        marcats: new fields.NumberField({ integer: true, min: 0, initial: 0, nullable: false })
      }),
      ferides: new fields.SchemaField({
        marcats: new fields.NumberField({ integer: true, min: 0, initial: 0, nullable: false })
      })
    }),

    // --- Recursos de combat ---
    reaccions: new fields.SchemaField({
      gastades: new fields.NumberField({ integer: true, min: 0, initial: 0, nullable: false })
    }),
    concentrat: new fields.BooleanField({ initial: false }),

    // --- Progressió ---
    pc: new fields.NumberField({ integer: true, min: 0, initial: 200, nullable: false }),
    px: new fields.SchemaField({
      total:   new fields.NumberField({ integer: true, min: 0, initial: 0, nullable: false }),
      gastats: new fields.NumberField({ integer: true, min: 0, initial: 0, nullable: false })
    }),

    // --- Biografia ---
    biografia: new fields.HTMLField({ initial: "" })
  };
}
