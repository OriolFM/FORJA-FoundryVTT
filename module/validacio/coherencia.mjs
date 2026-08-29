import { FORJA } from "../config/constants.mjs";

/**
 * Validació de coherència de la creació per punts (S-05, "automatitza el
 * càlcul, mai la decisió" — DA-5/G-3): mai bloqueja ni impedeix desar res,
 * només retorna avisos perquè el DJ decideixi. Es calcula a partir de l'estat
 * actual de l'actor (no cal cap pas de "validar" separat).
 *
 * Comprova només allò que es pot verificar amb dades ja modelades:
 *   - Pressupost de PC excedit.
 *   - Parelles de trets mútuament incompatibles (`incompatibilitats.json`).
 *   - Trets que pressuposen un do actiu (Màgus, Psíquic, Control del Qi,
 *     Canalitzador, Oracle) amb l'espècie Mecanoide (regles.md).
 *
 * Nota: els trets creats abans d'existir el flag `forja.catalegId` (o abans
 * d'aquesta funcionalitat) no es poden identificar per id — cal eliminar-los
 * i tornar-los a afegir amb el selector perquè entrin a la comprovació
 * d'incompatibilitats (mateixa limitació que `system.efecte`, vegeu
 * 09_CONTEXT_SESSIONS.md).
 *
 * @param {ForjaActor} actor
 * @returns {string[]} avisos (ja localitzats), buit si tot és coherent
 */
export function avisosCoherencia(actor) {
  const avisos = [];
  const sys = actor.system;

  if ((sys.pcLliures ?? 0) < 0) {
    avisos.push(game.i18n.format("FORJA.Avis.PressupostExcedit", { valor: -sys.pcLliures }));
  }

  if ((sys.px?.lliures ?? 0) < 0) {
    avisos.push(game.i18n.format("FORJA.Avis.PXExcedit", { valor: -sys.px.lliures }));
  }

  const idsTrets = new Set(
    actor.items
      .filter(i => i.type === "tret")
      .map(i => i.getFlag("forja", "catalegId"))
      .filter(Boolean)
  );

  const nomTret = (id) => FORJA.LLISTA_TRETS.find(t => t.id === id)?.nom ?? id;

  for (const [a, b] of FORJA.LLISTA_INCOMPATIBILITATS) {
    if (idsTrets.has(a) && idsTrets.has(b)) {
      avisos.push(game.i18n.format("FORJA.Avis.TretsIncompatibles", { a: nomTret(a), b: nomTret(b) }));
    }
  }

  if (sys.especie === "mecanoide") {
    for (const id of idsTrets) {
      if (FORJA.TRETS_SOBRENATURALS.includes(id)) {
        avisos.push(game.i18n.format("FORJA.Avis.MecanoideSobrenatural", { nom: nomTret(id) }));
      }
    }
  }

  // Dons mútuament excloents (S-20, manual p. 168): un PJ només pot fer
  // servir un sol do — si té trets de més d'un, és un error de creació.
  const dons = new Set([...idsTrets].map(id => FORJA.TRETS_DO[id]).filter(Boolean));
  if (dons.size > 1) {
    avisos.push(game.i18n.format("FORJA.Avis.MesDunDo", { dons: [...dons].join(", ") }));
  }

  return avisos;
}
