import { FORJA } from "../config/constants.mjs";

/**
 * Mapeig tret d'armament natural (manual, cap. Trets) → arma del catàleg
 * que tot actor que el posseeixi hauria de tenir.
 */
export const ARMAMENT_NATURAL_PER_TRET = {
  "armament-urpes":     "urpes",
  "armament-mossegada": "ullals",
  "armament-banyes":    "banyes",
  "armament-pinces":    "pinces",
  "armament-fiblons":   "fiblons-i-espines"
};

/**
 * D2: crea a l'actor un item (arma/armadura/artefacte) a partir d'una entrada
 * del catàleg (FORJA.CATALEG_ARMES/CATALEG_ARMADURES/CATALEG_ARTEFACTES),
 * mapejant els seus camps als de l'schema de l'Item corresponent. Sempre
 * marca l'item amb `flags.forja.catalegId = entrada.id` — imprescindible per
 * B11 (aparellar l'arma natural amb el tret que la concedeix) i per evitar
 * duplicats (`afegirArmaDelCataleg`).
 * @param {Actor} actor
 * @param {"arma"|"armadura"|"artefacte"} tipus
 * @param {object} entrada  Entrada del catàleg corresponent
 * @param {object} [extra]  Camps addicionals de `system` (p. ex. `{ basic: true }`)
 * @returns {Promise<Item|null>} L'item creat, o `null` si `tipus` no és vàlid
 */
export async function crearItemDesDeCataleg(actor, tipus, entrada, extra = {}) {
  const system = _dadesSystemPerTipus(tipus, entrada);
  if (!system) return null;
  const [item] = await actor.createEmbeddedDocuments("Item", [{
    name: entrada.nom,
    type: tipus,
    system: { ...system, ...extra },
    flags: { forja: { catalegId: entrada.id } }
  }]);
  return item ?? null;
}

/** @returns {object|null} Camps de `system` per tipus, a partir d'una entrada de catàleg. */
function _dadesSystemPerTipus(tipus, e) {
  switch (tipus) {
    case "arma":
      return {
        categoria:   e.categoria,
        modLatencia: e.modLatencia,
        abast:       e.abast,
        danyBase:    e.danyBase,
        maniobra:    e.maniobra ?? "",
        rangExtrem:  e.rangExtrem ?? false,
        descripcio:  e.descripcio ?? ""
      };
    case "armadura":
      return {
        tipus:       e.tipus,
        reduccio:    e.reduccio,
        modLatencia: e.modLatencia,
        egida:       e.egida ?? { activa: false, absorcio: 0, tornsInactiva: 0 },
        descripcio:  e.descripcio ?? ""
      };
    case "artefacte":
      return {
        cost:       e.cost,
        categoria:  e.categoria,
        activacio:  e.activacio ?? {},
        us:         e.us ?? {},
        carrega:    e.carrega ?? {},
        mecanica:   e.mecanica ?? "",
        descripcio: e.descripcio ?? ""
      };
    default:
      return null;
  }
}

/**
 * Afegeix a l'actor l'arma `catalegId` del catàleg si encara no la té
 * (es marca amb el flag `forja.catalegId` per evitar duplicats).
 */
export async function afegirArmaDelCataleg(actor, catalegId, { basic = false } = {}) {
  if (actor.items.some(i => i.type === "arma" && i.getFlag("forja", "catalegId") === catalegId)) return;
  const entrada = FORJA.CATALEG_ARMES.find(a => a.id === catalegId);
  if (!entrada) return;
  await crearItemDesDeCataleg(actor, "arma", entrada, basic ? { basic: true } : {});
}

/**
 * B11: catalegId de l'arma natural que concedeix un tret, si n'és un
 * d'"Armament Natural". Es determina primer pel flag `forja.catalegId` del
 * tret (font fiable: coincideix amb la clau d'`ARMAMENT_NATURAL_PER_TRET`,
 * ja que els trets del catàleg usen el mateix id, p. ex. "armament-urpes").
 * Per a trets antics creats abans d'existir aquest flag, es recorre al mètode
 * anterior (coincidència pel nom).
 * @param {Item} tret
 * @returns {string|null}
 */
export function armaNaturalPerTret(tret) {
  const catalegId = tret.getFlag("forja", "catalegId");
  if (catalegId && ARMAMENT_NATURAL_PER_TRET[catalegId]) return ARMAMENT_NATURAL_PER_TRET[catalegId];

  // Compatibilitat enrere (B11): trets sense flag encara es detecten pel nom.
  const nom = (tret.name ?? "").toLowerCase();
  const trobat = Object.entries(ARMAMENT_NATURAL_PER_TRET).find(([tretId]) =>
    nom.includes(tretId.replace("armament-", ""))
  );
  return trobat?.[1] ?? null;
}

/**
 * Comprova que l'actor disposi de l'atac bàsic "Cop" i de l'atac natural
 * corresponent a cada tret d'"Armament Natural" que tingui, afegint-los
 * si manquen. Útil tant en crear l'actor/tret com per "reparar" personatges
 * ja existents (p. ex. en entrar en mode d'edició).
 */
export async function assegurarAtacsAutomatics(actor) {
  if (!["personatge", "pnj"].includes(actor.type)) return;

  await afegirArmaDelCataleg(actor, "cop", { basic: true });

  for (const tret of actor.items.filter(i => i.type === "tret")) {
    const catalegId = armaNaturalPerTret(tret);
    if (catalegId) await afegirArmaDelCataleg(actor, catalegId);
  }
}

/**
 * B11: en eliminar un tret d'"Armament Natural", elimina l'arma que
 * concedia — llevat que un altre tret restant de l'actor encara en concedeixi
 * la mateixa (p. ex. dos trets diferents apuntant al mateix catalegId).
 * Pensada per cridar-se des del hook `deleteItem` (forja.mjs) amb el tret ja
 * fora de la col·lecció `actor.items`, però encara amb `.parent` vàlid.
 * @param {Item} tret  El tret que s'acaba d'eliminar
 */
export async function eliminarArmaNaturalDelTret(tret) {
  const actor = tret.parent;
  if (!actor) return;
  const catalegId = armaNaturalPerTret(tret);
  if (!catalegId) return;

  const altreTretElConcedeix = actor.items.some(i =>
    i.type === "tret" && i.id !== tret.id && armaNaturalPerTret(i) === catalegId
  );
  if (altreTretElConcedeix) return;

  const arma = actor.items.find(i => i.type === "arma" && i.getFlag("forja", "catalegId") === catalegId);
  if (arma) await actor.deleteEmbeddedDocuments("Item", [arma.id]);
}

/**
 * Atribut i habilitat que es tiren en atacar amb una arma (D3, B8/Q1 —
 * resolt contra el manual, cap. Combat "Cos a cos"/"A distància"): per
 * defecte segons `FORJA.ATAC_PER_CATEGORIA[categoria]`, amb excepcions per
 * catàleg concret a `FORJA.ATAC_PER_ARMA` (indexat per `flags.forja.catalegId`
 * — p. ex. les llancívoles tiren AGI enlloc de DES tot i ser "distancia").
 *
 * Compartida entre les fitxes (full-actor-base.mjs) i el tracker de combat
 * (tracker-ui.mjs, WP-F): mantenir aquest nom/signatura si es toca.
 * @param {Item} item  Item d'arma
 * @returns {{atribut: string, habId: string}}
 */
export function atributIHabilitatAtac(item) {
  const categoria = item.system?.categoria ?? "cosAcos";
  const base = FORJA.ATAC_PER_CATEGORIA[categoria] ?? FORJA.ATAC_PER_CATEGORIA.cosAcos;
  const catalegId = item.getFlag?.("forja", "catalegId");
  const excepcio  = catalegId ? FORJA.ATAC_PER_ARMA[catalegId] : null;
  if (excepcio) return { atribut: excepcio.atribut ?? base.atribut, habId: excepcio.habId ?? base.habId };

  // Compatibilitat enrere (sense catalegId): les llancívoles fetes a mà abans
  // del flag es detecten pel dany "AGI…" (únic cas conegut amb aquest prefix).
  if (!catalegId && (item.system?.danyBase ?? "").startsWith("AGI")) {
    return { atribut: "AGI", habId: base.habId };
  }
  return base;
}
