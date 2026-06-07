const { HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Fitxa simplificada de PNJ — Onada 0.
 * Reutilitza el mateix motor de derivats que el personatge.
 */
export default class FullPNJ extends HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["forja", "full-pnj"],
    position: { width: 600, height: 560 },
    actions: {
      toggleSalut: FullPNJ._onToggleSalut
    },
    form: { submitOnChange: true }
  };

  static PARTS = {
    sheet: { template: "systems/forja/templates/actor/pnj.hbs", scrollable: [""] }
  };

  /** @override */
  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const sys = this.actor.system;
    const cfg = CONFIG.FORJA;
    return {
      ...ctx,
      actor: this.actor,
      sys,
      campos: { especie: Object.keys(cfg.COST_ESPECIE), atributs: cfg.ATRIBUTS },
      derivats: {
        latenciaBase: sys.latenciaBase,
        defensa:      sys.defensa,
        reduccioDany: sys.reduccioDany
      },
      salutFatiga:  _prepPista(sys.salut.fatiga),
      salutFerides: _prepPista(sys.salut.ferides),
      nivellEfectiu: sys.salut.nivellEfectiu,
      penalitzacio:  sys.salut.penalitzacio,
      tiers: ["extra", "antagonista", "nemesis"]
    };
  }

  static async _onToggleSalut(event, target) {
    const track  = target.dataset.track;
    const idx    = parseInt(target.dataset.idx);
    const actual = this.actor.system.salut[track].marcats;
    const nouValor = actual === idx ? idx - 1 : idx;
    await this.actor.update({ [`system.salut.${track}.marcats`]: Math.max(0, nouValor) });
  }
}

function _prepPista(pista) {
  const { marcats, perNivell = 3, nivellActiu } = pista;
  const nivells = [];
  for (let n = 1; n <= 6; n++) {
    const caselles = [];
    for (let c = 1; c <= perNivell; c++) {
      const idx = (n - 1) * perNivell + c;
      caselles.push({ idx, marcat: idx <= marcats });
    }
    nivells.push({ num: n, caselles });
  }
  const idx7 = 6 * perNivell + 1;
  nivells.push({ num: 7, caselles: [{ idx: idx7, marcat: marcats >= idx7 }] });
  return { nivells, nivellActiu };
}
