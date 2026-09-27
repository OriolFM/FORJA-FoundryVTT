import FullActorBase from "./full-actor-base.mjs";
import DiategTrets   from "./dialeg-trets.mjs";
import DiategMillora from "./dialeg-millora.mjs";
import { avisosCoherencia } from "../validacio/coherencia.mjs";
import {
  costSeguentAtribut, costSeguentHabilitat,
  millorarAtribut, millorarHabilitat, afegirTretPositiuAmbPX, treureTretNegatiuAmbPX
} from "../progressio/millora.mjs";

/**
 * D1: fitxa de Personatge Jugador. Motor compartit a `FullActorBase`; aquí
 * només hi ha el que li és exclusiu: capçalera amb concepte/origen/PC/PX i
 * la millora amb PX (S-28).
 */
export default class FullPersonatge extends FullActorBase {

  static DEFAULT_OPTIONS = {
    classes: ["forja", "full-personatge"],
    actions: {
      // Millora amb PX (S-28)
      forjaObrirMillora: FullPersonatge._onObrirMillora
    }
  };

  static PARTS = {
    header: { template: "systems/forja/templates/actor/personatge-header.hbs" },
    body:   { template: "systems/forja/templates/actor/personatge-body.hbs" }
  };

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const sys = this.actor.system;

    return {
      ...ctx,
      pc: {
        total:   sys.pc,
        gastats: sys.pcGastats ?? 0,
        lliures: sys.pcLliures ?? 0
      },
      px: {
        total:   sys.px.total,
        gastats: sys.px.gastats ?? 0,
        lliures: sys.px.lliures ?? 0
      },
      avisos: avisosCoherencia(this.actor)
    };
  }

  // ── Millora amb PX (S-28) ────────────────────────────────────────────────

  static async _onObrirMillora(event, target) {
    const actor = this.actor;
    const sys   = actor.system;
    const cfg   = CONFIG.FORJA;

    const atributs = cfg.ATRIBUTS.map(attr => {
      const actual = sys.atributs[attr] ?? 0;
      return {
        id: attr, nom: game.i18n.localize(`FORJA.Attr.${attr}`),
        actual, seguent: actual + 1, cost: costSeguentAtribut(actual)
      };
    });

    const habilitats = cfg.LLISTA_HABILITATS.map(h => {
      const actual = sys.habilitats[h.id]?.nivell ?? 0;
      return {
        id: h.id, nom: game.i18n.localize(h.nom),
        actual, seguent: actual + 1, cost: costSeguentHabilitat(actual)
      };
    }).sort((a, b) => a.nom.localeCompare(b.nom, "ca"));

    const tretsNegatius = actor.items
      .filter(i => i.type === "tret" && (i.system.cost ?? 0) < 0)
      .map(i => ({ id: i.id, nom: i.name, cost: -(i.system.cost ?? 0) }));

    const eleccio = await DiategMillora.obrir({
      nomActor: actor.name,
      pxLliures: sys.px?.lliures ?? 0,
      atributs, habilitats, tretsNegatius
    });
    if (!eleccio) return;

    let resultat = null;
    if (eleccio.categoria === "atribut") {
      resultat = await millorarAtribut(actor, eleccio.attrId);
    } else if (eleccio.categoria === "habilitat") {
      resultat = await millorarHabilitat(actor, eleccio.habId);
    } else if (eleccio.categoria === "tret-afegir") {
      const tret = await DiategTrets.obrir();
      if (!tret) return;
      resultat = await afegirTretPositiuAmbPX(actor, tret);
    } else if (eleccio.categoria === "tret-treure") {
      const item = actor.items.get(eleccio.tretNegatiuId);
      if (!item) return;
      resultat = await treureTretNegatiuAmbPX(actor, item);
    }

    if (!resultat) return;
    if (resultat.error === "max") {
      ui.notifications?.warn(game.i18n.localize("FORJA.Millora.JaAlMaxim"));
    } else if (resultat.error === "px") {
      ui.notifications?.warn(game.i18n.localize("FORJA.Millora.PXInsuficients"));
    } else if (resultat.error === "negatiu") {
      ui.notifications?.warn(game.i18n.localize("FORJA.Millora.NomesTretsPositius"));
    } else if (resultat.error === "positiu") {
      ui.notifications?.warn(game.i18n.localize("FORJA.Millora.NomesTretsNegatius"));
    } else {
      ui.notifications?.info(game.i18n.format("FORJA.Millora.Aplicada", { nom: actor.name, cost: resultat.cost }));
    }
  }
}
