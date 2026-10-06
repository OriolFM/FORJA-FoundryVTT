import FullActorBase from "./full-actor-base.mjs";
import { valorsBase } from "../data/actor-personatge.mjs";

/**
 * Text d'un motiu de l'historial de PX (Fase 4, `progressio/experiencia.mjs`).
 * @param {object} m
 * @returns {string}
 */
function descriureMotiuPX(m = {}) {
  const desc = m.descripcio ? ` — ${m.descripcio}` : "";
  switch (m.tipus) {
    case "grup":
    case "individual":
      return `${game.i18n.localize(`FORJA.Experiencia.Motiu.${m.tipus}`)} (${game.i18n.localize(`FORJA.Experiencia.Nivell.${m.nivell}`)})${desc}`;
    case "virtut":    return `${game.i18n.localize("FORJA.Experiencia.Motiu.virtut")}: ${game.i18n.localize(`FORJA.Experiencia.Virtut.${m.virtut}`)}`;
    case "atribut":   return `${m.id} → ${m.valor}`;
    case "habilitat": return `${game.i18n.localize(`FORJA.Hab.${m.id}`)} → ${m.valor}`;
    default:          return `${game.i18n.localize(`FORJA.Experiencia.Motiu.${m.tipus ?? "altres"}`)}${desc}`;
  }
}
import DiategTrets   from "./dialeg-trets.mjs";
import DiategMillora from "./dialeg-millora.mjs";
import AssistentCreacio from "./assistent-creacio.mjs";
import DiategConstructor from "./dialeg-constructor.mjs";
import { potManifestar } from "../combat/manifestar.mjs";
import { avisosCoherencia } from "../validacio/coherencia.mjs";
import {
  costSeguentAtribut, costSeguentHabilitat,
  millorarAtribut, millorarHabilitat, afegirTretPositiuAmbPX, treureTretNegatiuAmbPX
} from "../progressio/millora.mjs";
import {
  provarManifestacio, aplicarPenalitzacioFallada, aplicarEfecteProgressio
} from "../progressio/progressio-sobrenatural.mjs";

/**
 * D1: fitxa de Personatge Jugador. Motor compartit a `FullActorBase`; aquí
 * només hi ha el que li és exclusiu: capçalera amb concepte/origen/PC/PX i
 * la millora amb PX (S-28), l'assistent de creació (M-03) i la progressió
 * sobrenatural amb PX (S-29).
 */
export default class FullPersonatge extends FullActorBase {

  static DEFAULT_OPTIONS = {
    classes: ["forja", "full-personatge"],
    actions: {
      // Millora amb PX (S-28)
      forjaObrirMillora: FullPersonatge._onObrirMillora,
      // Assistent de creació (M-03)
      forjaObrirAssistent: FullPersonatge._onObrirAssistent,
      // Progressió sobrenatural (S-29)
      forjaObrirProgressio: FullPersonatge._onObrirProgressio
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
      avisos: avisosCoherencia(this.actor),
      // Fase 4: darreres entrades de l'historial de PX, la més nova primer.
      historialPX: (sys.px.historial ?? []).slice(-30).reverse().map(h => ({
        data: h.data ? new Date(h.data).toLocaleDateString(game.i18n.lang) : "",
        guany: h.px > 0,
        pxText: `${h.px > 0 ? "+" : ""}${h.px} PX`,
        motiu: descriureMotiuPX(h.motiu)
      }))
    };
  }

  // ── Millora amb PX (S-28) ────────────────────────────────────────────────

  static async _onObrirMillora(event, target) {
    const actor = this.actor;
    const sys   = actor.system;
    const cfg   = CONFIG.FORJA;
    // Fase 3: es millora el valor base, sense bonificacions d'efectes i artefactes.
    const base  = valorsBase(actor);

    const atributs = cfg.ATRIBUTS.map(attr => {
      const actual = base.atributs[attr] ?? 0;
      return {
        id: attr, nom: game.i18n.localize(`FORJA.Attr.${attr}`),
        actual, seguent: actual + 1, cost: costSeguentAtribut(actual)
      };
    });

    const habilitats = cfg.LLISTA_HABILITATS.map(h => {
      const actual = base.habilitats[h.id]?.nivell ?? 0;
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

  // ── Assistent de creació (M-03) ──────────────────────────────────────────

  static async _onObrirAssistent(event, target) {
    AssistentCreacio.obrir(this.actor);
  }
  // ── Progressió sobrenatural (S-29) ───────────────────────────────────────

  static async _onObrirProgressio(event, target) {
    const actor = this.actor;
    if (!potManifestar(actor)) return;

    const efectesActor = actor.items.filter(i => i.type === "efecte");
    let itemExistent = null;

    if (efectesActor.length) {
      const opcions = efectesActor
        .map(i => `<option value="${i.id}">${i.name} (${i.system.cost} PC)</option>`)
        .join("");
      const content = `
        <form class="forja-progressio-tria">
          <div class="form-group">
            <label><input type="radio" name="mode" value="nou" checked> ${game.i18n.localize("FORJA.Progressio.Nou")}</label>
          </div>
          <div class="form-group">
            <label><input type="radio" name="mode" value="millorar"> ${game.i18n.localize("FORJA.Progressio.Millorar")}</label>
            <select name="itemId">${opcions}</select>
          </div>
          <p class="dm-desc">${game.i18n.localize("FORJA.Progressio.AvisRecerca")}</p>
        </form>`;
      const tria = await foundry.applications.api.DialogV2.prompt({
        window: { title: game.i18n.localize("FORJA.Progressio.TitolTria") },
        content,
        ok: {
          label: game.i18n.localize("FORJA.Progressio.Continuar"),
          callback: (ev, button) => ({
            mode:   button.form.elements.mode.value,
            itemId: button.form.elements.itemId.value
          })
        }
      });
      if (!tria) return;
      if (tria.mode === "millorar") itemExistent = actor.items.get(tria.itemId) ?? null;
    } else {
      const continuar = await foundry.applications.api.DialogV2.confirm({
        window: { title: game.i18n.localize("FORJA.Progressio.TitolTria") },
        content: `<p class="dm-desc">${game.i18n.localize("FORJA.Progressio.AvisRecerca")}</p>`
      });
      if (!continuar) return;
    }

    // Fase 2: per millorar un efecte, el constructor parteix dels seus paràmetres.
    const construit = await DiategConstructor.obrir({
      inicial: itemExistent ? {
        nom: itemExistent.name, do: itemExistent.system.do,
        parametres: itemExistent.system.parametres, construccio: itemExistent.system.construccio
      } : undefined
    });
    if (!construit) return;

    let exit = false;
    while (!exit) {
      const resultat = await provarManifestacio(actor, construit.dificultat, construit.nom);
      if (!resultat) return;
      exit = resultat.exit;
      if (!exit) {
        const continuar = await foundry.applications.api.DialogV2.confirm({
          window: { title: game.i18n.localize("FORJA.Progressio.TitolFallada") },
          content: `<p>${game.i18n.localize("FORJA.Progressio.TextFallada")}</p>`
        });
        if (!continuar) return;
        const penalitzacio = await aplicarPenalitzacioFallada(actor);
        if (penalitzacio.error === "px") {
          ui.notifications?.warn(game.i18n.localize("FORJA.Millora.PXInsuficients"));
          return;
        }
      }
    }

    const aplicat = await aplicarEfecteProgressio(actor, construit, itemExistent);
    if (aplicat.error === "px") {
      ui.notifications?.warn(game.i18n.localize("FORJA.Millora.PXInsuficients"));
      return;
    }
    ui.notifications?.info(game.i18n.format("FORJA.Progressio.Aplicat", { nom: construit.nom, cost: aplicat.cost }));
  }}
