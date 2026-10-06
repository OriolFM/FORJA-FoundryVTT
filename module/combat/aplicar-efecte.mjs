import {
  resumParametres, danyDeEfecte, pistesDany, bonificacionsDeParametres
} from "./resultat-parametres.mjs";
import { costParametre } from "../progressio/construccio.mjs";
import {
  calcularDany, aplicarDanyAPista, proteccioArmadura, itemEgidaActiva, tickReactivacioEgida, efecteDanyConcentracio
} from "./dany.mjs";
import { trencarConcentracio } from "./reaccions.mjs";
import { actualitzarComGM, alternarEstatComGM, crearEmbegutsComGM } from "../xarxa/socket.mjs";
import { pistaRecuperacio } from "../estats/regles-estats.mjs";

/**
 * Aplica el resultat d'un efecte manifestat o d'un artefacte activat (Fase 3;
 * Oriol FM, 2026-10-06: automàtic, com el dany dels atacs). Les regles de
 * cada paràmetre són a `resultat-parametres.mjs`. Totes les escriptures a
 * actors aliens passen pel relé del DJ (`xarxa/socket.mjs`); les creacions
 * d'ActiveEffect i d'armadures temporals les valida `esCreacioEfecteForja`.
 *
 * Durada (manual › Durada, l. 4875): els efectes amb durada duren una escena;
 * es marquen amb `flags.forja.durada = "escena"` i s'esborren en acabar el
 * combat (`ForjaCombat#netejarFinalCombat`) o a mà des de la fitxa. Els
 * instantanis que donen protecció o bonificacions (p. ex. L'armadura del
 * queloni, com a reacció) duren fins que el rellotge avança
 * (`durada = "instantania"`, `netejarInstantanis`).
 */

/** Estats que són bons per a qui els té (no els treu «Neteja estats negatius»). */
const ESTATS_POSITIUS = new Set(["vigilant", "rapid", "recuperacio", "berserc", "concentrat", "dead"]);

/** Nom traduït d'un estat. */
function nomEstat(id) {
  return game.i18n.localize(`FORJA.Estat.${id}`);
}

/** Icona registrada d'un estat. */
function iconaEstat(id) {
  return CONFIG.statusEffects?.find(e => e.id === id)?.img ?? "icons/svg/aura.svg";
}

/**
 * Aplica un estat (d'un paràmetre `estat` o d'un arma vinculada).
 * - Amb X (lent, ràpid, recuperació, sagnant): un ActiveEffect nou amb
 *   `flags.forja.valorX` (cada causa és independent, M-05).
 * - Sense X: l'estat, amb la dificultat per resistir-lo (`flags.forja.dificultat`,
 *   que proposa la tirada d'estat): la de l'efecte més el modificador del paràmetre.
 * @param {Actor} actor
 * @param {{id:string, valorX:number|null, modificador:number}} estat
 * @param {object} [opcions]
 * @param {string} [opcions.origen]  UUID de l'efecte o artefacte.
 * @param {"escena"|"instantania"|null} [opcions.durada]
 * @param {number} [opcions.dificultatBase=0]
 * @returns {Promise<boolean>}
 */
export async function aplicarEstat(actor, estat, { origen = null, durada = null, dificultatBase = 0 } = {}) {
  if (!actor || !CONFIG.statusEffects?.some(e => e.id === estat.id)) return false;
  const nom = nomEstat(estat.id);
  if (estat.valorX != null) {
    const forja = { efecteForja: true, valorX: estat.valorX, origen, durada };
    if (estat.id === "recuperacio") forja.comptador = 0;
    await crearEmbegutsComGM(actor, "ActiveEffect", [{
      name: `${nom.replace(/\/X$/, "")}/${estat.valorX}`, img: iconaEstat(estat.id), statuses: [estat.id], flags: { forja }
    }]);
    return true;
  }
  if (actor.statuses?.has(estat.id)) return true;
  await crearEmbegutsComGM(actor, "ActiveEffect", [{
    name: nom, img: iconaEstat(estat.id), statuses: [estat.id],
    flags: { forja: { efecteForja: true, origen, durada, dificultat: Math.max(1, dificultatBase + (estat.modificador ?? 0)) } }
  }]);
  return true;
}

/**
 * Aplica bonificacions temporals: atributs, habilitats i trets com a
 * ActiveEffect (`flags.forja.bonus`, els llegeix `_prepararDerivats`), i
 * armadura i ègida com a armadures temporals (les fa servir el combat).
 * @param {Actor} actor
 * @param {object} bonus  `bonificacionsDeParametres`
 * @param {{nom:string, img?:string, origen?:string, durada?:string}} font
 * @returns {Promise<string[]>}  Descripció del que s'ha aplicat
 */
export async function aplicarBonificacions(actor, bonus, { nom, img, origen = null, durada = "escena" }) {
  const fet = [];
  const teAtribHab = Object.keys(bonus.atributs).length || Object.keys(bonus.habilitats).length || bonus.trets.length;
  if (teAtribHab) {
    await crearEmbegutsComGM(actor, "ActiveEffect", [{
      name: nom, img: img ?? "icons/svg/upgrade.svg",
      flags: { forja: { efecteForja: true, bonus: { atributs: bonus.atributs, habilitats: bonus.habilitats, trets: bonus.trets }, origen, durada } }
    }]);
    for (const [k, v] of Object.entries(bonus.atributs)) fet.push(`${k} +${v}`);
    for (const [k, v] of Object.entries(bonus.habilitats)) fet.push(`${game.i18n.localize(`FORJA.Hab.${k}`)} +${v}`);
    for (const t of bonus.trets) fet.push(CONFIG.FORJA?.LLISTA_TRETS?.find(x => x.id === t)?.nom ?? t);
  }
  const armadures = [];
  if (bonus.armadura > 0) {
    armadures.push({ name: `${nom} (${game.i18n.localize("FORJA.Artefacte.ArmaduraNatural")})`, type: "armadura", img,
      system: { tipus: "natural", reduccio: bonus.armadura, equipada: true }, flags: { forja: { temporal: true, origen, durada } } });
    fet.push(game.i18n.format("FORJA.Efecte.Armadura", { n: bonus.armadura }));
  }
  if (bonus.egida > 0) {
    armadures.push({ name: `${nom} (${game.i18n.localize("FORJA.Artefacte.Egida")})`, type: "armadura", img,
      system: { tipus: "natural", reduccio: 0, equipada: true, egida: { activa: true, absorcio: bonus.egida, tornsInactiva: 0 } },
      flags: { forja: { temporal: true, origen, durada } } });
    fet.push(game.i18n.format("FORJA.Efecte.Egida", { n: bonus.egida }));
  }
  if (armadures.length) await crearEmbegutsComGM(actor, "Item", armadures);
  return fet;
}

/**
 * Dany d'un efecte sobre un objectiu: ègida, armadura i reducció si és
 * indirecte; directe si no (manual › Dany directe, l. 3283). Marca les
 * pistes, trenca l'ègida i la concentració com un atac (`ferAtac`).
 * @returns {Promise<{danyFinal:number, pistes:string[], egidaTrencada:boolean}>}
 */
async function aplicarDanyEfecte(objectiu, dany, excedent, eleccioPista) {
  const d = danyDeEfecte(dany, excedent);
  const pistes = pistesDany(dany.danyTipus, eleccioPista);
  const itemEgida = d.directe ? null : itemEgidaActiva(objectiu.items);
  const resultat = calcularDany({
    danyBaseArma: d.danyBaseArma, bonificadorArma: d.bonificadorArma, excedentAtac: d.excedentAtac,
    reduccioDany: d.directe ? 0 : (objectiu.system.reduccioDany ?? 0),
    armadura: d.directe ? 0 : proteccioArmadura(objectiu.items),
    egida: itemEgida ? { activa: true, absorcio: itemEgida.system.egida.absorcio } : null
  });
  const estavaConcentrat = !!objectiu.system.concentrat;
  if (resultat.danyFinal > 0) {
    const canvis = {};
    for (const pista of pistes) {
      const marcats = objectiu.system.salut[pista].marcats;
      canvis[`system.salut.${pista}.marcats`] = aplicarDanyAPista({ [pista]: { marcats } }, pista, resultat.danyFinal, { noMort: !!objectiu.system.noMort });
    }
    await actualitzarComGM(objectiu, canvis);
  }
  if (resultat.egidaTrencada && itemEgida) {
    const combat = game.combats?.find(c => c.started && c.combatants.some(cb => cb.actor?.uuid === objectiu.uuid));
    await actualitzarComGM(itemEgida, {
      "system.egida.activa": false,
      "system.egida.tornsInactiva": resultat.tornsInactivaEgida,
      "flags.forja.egidaReactivaAlTick": combat ? tickReactivacioEgida(combat.marcador ?? 0, resultat.tornsInactivaEgida) : null
    });
  }
  const conc = efecteDanyConcentracio(estavaConcentrat, resultat.danyFinal, objectiu.system.atributs?.FOR);
  if (conc.trenca) await trencarConcentracio(objectiu);
  if (conc.atordit) await alternarEstatComGM(objectiu, "atordit", true);
  return { danyFinal: resultat.danyFinal, pistes, egidaTrencada: resultat.egidaTrencada, drenatge: d.drenatge };
}

/**
 * Curació d'un efecte (manual › Curació, l. 5011): els punts indicats a la
 * pista (fatiga o ferides: la triada o, si no, la més greu; fatiga i
 * ferides: totes dues); i, si en té, neteja els estats negatius i les
 * malalties.
 * @returns {Promise<string[]>}
 */
async function aplicarCura(objectiu, cura, eleccioPista) {
  const fet = [];
  if (cura.nivell > 0 && cura.pista) {
    const salut = objectiu.system.salut;
    const pistes = cura.pista === "fatiga-i-ferides" ? ["fatiga", "ferides"]
      : cura.pista === "fatiga-o-ferides" ? [eleccioPista ?? pistaRecuperacio(salut) ?? "fatiga"]
      : [cura.pista];
    const canvis = {};
    for (const pista of pistes) {
      canvis[`system.salut.${pista}.marcats`] = Math.max(0, (salut[pista]?.marcats ?? 0) - cura.nivell);
      fet.push(game.i18n.format("FORJA.Efecte.Cura", { n: cura.nivell, pista: game.i18n.localize(pista === "ferides" ? "FORJA.Salut.Ferides" : "FORJA.Salut.Fatiga") }));
    }
    await actualitzarComGM(objectiu, canvis);
  }
  if (cura.estats || cura.malalties) {
    for (const id of [...(objectiu.statuses ?? [])]) {
      const esMalaltia = id === "malaltia-toxina";
      if (esMalaltia ? !cura.malalties : (!cura.estats || ESTATS_POSITIUS.has(id))) continue;
      await alternarEstatComGM(objectiu, id, false);
      fet.push(game.i18n.format("FORJA.Efecte.EstatTret", { estat: nomEstat(id) }));
    }
  }
  return fet;
}

/**
 * Aplica el resultat d'un efecte o artefacte i el publica al xat.
 * @param {object} p
 * @param {Actor}  p.actor        Qui l'usa.
 * @param {Item}   p.font         Item `efecte` o `artefacte` (amb `system.parametres`).
 * @param {Actor[]} [p.objectius=[]]  Objectius afectats (ja filtrats per resistència).
 * @param {number} [p.excedent=0]
 * @param {number} [p.dificultat=1]  Dificultat de l'efecte (base de la resistència als estats).
 * @param {"fatiga"|"ferides"|null} [p.eleccioPista=null]  Per al dany o la curació de «fatiga o ferides».
 * @param {string[]} [p.resistits=[]]  Noms dels objectius que s'hi han resistit (per al xat).
 * @returns {Promise<object|null>}  `null` si l'item no té paràmetres (s'aplica a mà).
 */
export async function aplicarResultatEfecte({ actor, font, objectius = [], excedent = 0, dificultat = 1, eleccioPista = null, resistits = [] }) {
  const parametres = font?.system?.parametres ?? [];
  if (!parametres.length) return null;
  const resum = resumParametres(parametres);
  const origen = font.uuid ?? null;
  const durada = resum.durada;
  const dests = resum.objectius === "usuari" ? [actor] : objectius;
  const linies = [];

  for (const obj of dests) {
    const fet = [];
    try {
      if (resum.dany) {
        const r = await aplicarDanyEfecte(obj, resum.dany, excedent, eleccioPista);
        fet.push(r.danyFinal > 0
          ? game.i18n.format("FORJA.Efecte.Dany", { n: r.danyFinal, pista: r.pistes.map(p => game.i18n.localize(p === "ferides" ? "FORJA.Salut.Ferides" : "FORJA.Salut.Fatiga")).join(" + ") })
          : game.i18n.localize("FORJA.Efecte.SenseDany"));
        if (r.egidaTrencada) fet.push(game.i18n.localize("FORJA.Efecte.EgidaTrencada"));
        if (r.drenatge && r.danyFinal > 0) {
          const pista = pistaRecuperacio(actor.system.salut);
          if (pista) {
            await actualitzarComGM(actor, { [`system.salut.${pista}.marcats`]: Math.max(0, actor.system.salut[pista].marcats - r.danyFinal) });
            fet.push(game.i18n.format("FORJA.Efecte.Drenatge", { nom: actor.name, n: r.danyFinal }));
          }
        }
      }
      if (resum.cura) fet.push(...await aplicarCura(obj, resum.cura, eleccioPista));
      for (const estat of resum.estats) {
        if (await aplicarEstat(obj, estat, { origen, durada, dificultatBase: dificultat })) {
          fet.push(game.i18n.format("FORJA.Efecte.EstatAplicat", { estat: estat.valorX != null ? `${nomEstat(estat.id).replace(/\/X$/, "")}/${estat.valorX}` : nomEstat(estat.id) }));
        }
      }
      const b = resum.bonificacions;
      if (Object.keys(b.atributs).length || Object.keys(b.habilitats).length || b.trets.length || b.armadura || b.egida) {
        // Artefactes sempre actius ja donen les bonificacions sense activar-los.
        fet.push(...await aplicarBonificacions(obj, b, { nom: font.name, img: font.img, origen, durada }));
      }
    } catch (err) {
      console.error("FORJA | No s'ha pogut aplicar el resultat de l'efecte", err);
      fet.push(game.i18n.format("FORJA.Combat.ConsequenciesNoAplicades", { nom: obj.name, error: err?.message ?? String(err) }));
    }
    linies.push({ nom: obj.name, fet });
  }

  const extres = [
    ...resum.autoeines.map(a => game.i18n.format("FORJA.Efecte.Autoeina", {
      fites: a.fites, habilitat: a.habilitat ? game.i18n.localize(`FORJA.Hab.${a.habilitat}`) : "—"
    })),
    ...resum.narratius.map(p => costParametre(p)?.etiqueta).filter(Boolean)
  ];
  if (resum.invocacio) extres.push(game.i18n.format("FORJA.Efecte.Invocacio", { cost: resum.invocacio.costCriatura }));

  const content = await foundry.applications.handlebars.renderTemplate("systems/forja/templates/combat/missatge-resultat-efecte.hbs", {
    nomFont: font.name, nomActor: actor.name, linies, extres, resistits,
    senseObjectius: resum.objectius !== "usuari" && !dests.length,
    durada: durada === "escena"
  });
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
  return { resum, linies };
}

/**
 * Esborra els efectes i armadures temporals amb una durada concreta dels
 * actors indicats (DJ). `escena`: en acabar el combat; `instantania`: quan
 * el rellotge avança.
 * @param {Iterable<Actor>} actors
 * @param {"escena"|"instantania"} durada
 */
export async function netejarTemporals(actors, durada) {
  for (const actor of actors) {
    const efectes = actor.effects.filter(e => e.flags?.forja?.efecteForja && e.flags.forja.durada === durada).map(e => e.id);
    if (efectes.length) await actor.deleteEmbeddedDocuments("ActiveEffect", efectes);
    const items = actor.items.filter(i => i.flags?.forja?.temporal && i.flags.forja.durada === durada).map(i => i.id);
    if (items.length) await actor.deleteEmbeddedDocuments("Item", items);
  }
}

export { bonificacionsDeParametres };
