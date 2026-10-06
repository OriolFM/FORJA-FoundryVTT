/**
 * Eina del DJ per crear PJ, PNJ, criatures i animals des de Foundry i
 * desar-los als compendis del món (Oriol FM, 2026-10-06).
 *
 * Els compendis del sistema (`forja.pj`, `forja.pnj`…) es sobreescriuen en
 * actualitzar el sistema; per això el DJ desa els seus actors en compendis
 * del MÓN (`world.forja-pj`, `world.forja-pnj`, `world.forja-criatures`,
 * `world.forja-animals`), que es creen la primera vegada que calen.
 *
 * - `categoriaCompendi` (pura): a quin compendi va cada actor.
 * - `crearActorDJ`: diàleg de tipus i nom; el PJ obre l'assistent de creació.
 * - `desarACompendiMon`: copia l'actor al compendi del món (reemplaça el del
 *   mateix nom si el DJ ho confirma).
 */

/** Tipus que ofereix el diàleg de creació: tipus d'actor i tier del PNJ. */
export const TIPUS_NOU_ACTOR = {
  pj: { type: "personatge" },
  extra: { type: "pnj", tier: "extra" },
  antagonista: { type: "pnj", tier: "antagonista" },
  nemesis: { type: "pnj", tier: "nemesis" },
  criatura: { type: "pnj", tier: "criatura" },
  animal: { type: "pnj", tier: "animal" }
};

/**
 * Compendi (categoria) d'un actor, com els del sistema.
 * @param {string} type  `personatge` o `pnj`.
 * @param {string} [tier]
 * @returns {"pj"|"pnj"|"criatures"|"animals"}
 */
export function categoriaCompendi(type, tier) {
  if (type === "personatge") return "pj";
  if (tier === "criatura") return "criatures";
  if (tier === "animal") return "animals";
  return "pnj";
}

/** Nom del compendi del món d'una categoria (`forja-pj`…). */
export const nomCompendiMon = categoria => `forja-${categoria}`;

/**
 * Diàleg del DJ: tria el tipus i el nom i crea l'actor. Un PJ obre
 * l'assistent de creació; la resta, la fitxa.
 * @returns {Promise<Actor|null>}
 */
export async function crearActorDJ() {
  const opcions = Object.keys(TIPUS_NOU_ACTOR).map(k =>
    `<option value="${k}">${game.i18n.localize(k === "pj" ? "FORJA.Contingut.TipusPJ" : `FORJA.TierOpcio.${k}`)}</option>`).join("");
  const dades = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.localize("FORJA.Contingut.NouTitol") },
    content: `<div class="form-group"><label>${game.i18n.localize("FORJA.Contingut.Tipus")}</label>
        <select name="tipus">${opcions}</select></div>
      <div class="form-group"><label>${game.i18n.localize("FORJA.Contingut.Nom")}</label>
        <input type="text" name="nom" autofocus></div>`,
    ok: {
      label: game.i18n.localize("FORJA.Contingut.Crear"),
      callback: (ev, button) => ({ tipus: button.form.elements.tipus.value, nom: button.form.elements.nom.value.trim() })
    },
    rejectClose: false
  });
  if (!dades) return null;
  const def = TIPUS_NOU_ACTOR[dades.tipus];
  const nom = dades.nom || game.i18n.localize(dades.tipus === "pj" ? "FORJA.Contingut.TipusPJ" : `FORJA.TierOpcio.${dades.tipus}`);
  const actor = await Actor.create({
    name: nom,
    type: def.type,
    ...(def.tier ? { system: { tier: def.tier } } : {}),
    prototypeToken: { actorLink: def.type === "personatge", disposition: def.type === "personatge" ? 1 : -1 }
  });
  if (!actor) return null;
  if (def.type === "personatge") {
    const { default: AssistentCreacio } = await import("../apps/assistent-creacio.mjs");
    AssistentCreacio.obrir(actor);
  } else actor.sheet.render(true);
  return actor;
}

/**
 * Compendi del món d'una categoria; el crea si no existeix.
 * @param {string} categoria
 * @returns {Promise<CompendiumCollection>}
 */
async function compendiMon(categoria) {
  const nom = nomCompendiMon(categoria);
  const existent = game.packs.get(`world.${nom}`);
  if (existent) return existent;
  const Compendis = foundry.documents?.collections?.CompendiumCollection ?? CompendiumCollection;
  return Compendis.createCompendium({
    type: "Actor",
    name: nom,
    label: game.i18n.localize(`FORJA.Contingut.Compendi.${categoria}`),
    package: "world"
  });
}

/**
 * Desa una còpia de l'actor al compendi del món que li toca. Si ja n'hi ha
 * un amb el mateix nom, demana si s'ha de reemplaçar.
 * @param {Actor} actor
 * @returns {Promise<Actor|null>} El document del compendi.
 */
export async function desarACompendiMon(actor) {
  if (!game.user.isGM || !actor) return null;
  const categoria = categoriaCompendi(actor.type, actor.system?.tier);
  const pack = await compendiMon(categoria);
  if (pack.locked) {
    ui.notifications.warn(game.i18n.format("FORJA.Contingut.Bloquejat", { compendi: pack.title }));
    return null;
  }
  const index = await pack.getIndex();
  const repetit = index.find(e => e.name === actor.name);
  if (repetit) {
    const reemplacar = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("FORJA.Contingut.DesarTitol") },
      content: `<p>${game.i18n.format("FORJA.Contingut.JaExisteix", { nom: actor.name, compendi: pack.title })}</p>`,
      rejectClose: false
    });
    if (!reemplacar) return null;
    const vell = await pack.getDocument(repetit._id);
    await vell?.delete();
  }
  const doc = await pack.importDocument(actor);
  ui.notifications.info(game.i18n.format("FORJA.Contingut.Desat", { nom: actor.name, compendi: pack.title }));
  return doc;
}

/**
 * Registra el botó «Nou actor» al directori d'actors i l'opció «Desa al
 * compendi del món» al menú contextual de cada actor (només el DJ).
 */
export function registrarEinaContingut() {
  Hooks.on("renderActorDirectory", (app, html) => {
    if (!game.user.isGM) return;
    const arrel = html instanceof HTMLElement ? html : html?.[0];
    if (!arrel || arrel.querySelector(".forja-nou-actor")) return;
    const boto = document.createElement("button");
    boto.type = "button";
    boto.className = "forja-nou-actor";
    boto.innerHTML = `<i class="fas fa-user-plus"></i> ${game.i18n.localize("FORJA.Contingut.BotoNou")}`;
    boto.addEventListener("click", () => crearActorDJ());
    (arrel.querySelector(".header-actions") ?? arrel.querySelector(".directory-header") ?? arrel).append(boto);
  });

  const opcio = {
    name: "FORJA.Contingut.Desar",
    icon: '<i class="fas fa-book-medical"></i>',
    condition: () => game.user.isGM,
    callback: li => {
      const el = li instanceof HTMLElement ? li : li?.[0];
      const id = el?.dataset?.entryId ?? el?.dataset?.documentId;
      return desarACompendiMon(game.actors.get(id));
    }
  };
  // v13+ (compatibilitat mínima del sistema): `getActorContextOptions`.
  Hooks.on("getActorContextOptions", (app, opcions) => opcions.push(opcio));
}
