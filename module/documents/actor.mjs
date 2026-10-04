import { actualitzarComGM } from "../xarxa/socket.mjs";

/**
 * Document Actor estès per al sistema FORJA.
 * Onada 0: només estructura base. Les tirades s'afegiran a l'Onada 1.
 */
export default class ForjaActor extends Actor {

  /** @override */
  prepareData() {
    super.prepareData();
  }

  /**
   * @override Els personatges jugadors neixen amb el token ENLLAÇAT a l'actor
   * (i amigable): el dany, la concentració o les ègides que el combat aplica a
   * l'actor del token han de ser els de la fitxa. Per defecte Foundry crea
   * tokens no enllaçats, i el combat escrivia en una còpia del token (trobat a
   * les proves de joc). Els PNJ es mantenen no enllaçats (cada token, una
   * instància). Només si qui crea l'actor no ho ha especificat.
   */
  async _preCreate(data, options, user) {
    if ((await super._preCreate(data, options, user)) === false) return false;
    if (this.type !== "personatge") return;
    const proto = data.prototypeToken ?? {};
    const canvis = {};
    if (proto.actorLink === undefined)   canvis["prototypeToken.actorLink"]   = true;
    if (proto.disposition === undefined) canvis["prototypeToken.disposition"] = CONST.TOKEN_DISPOSITIONS.FRIENDLY;
    if (Object.keys(canvis).length) this.updateSource(canvis);
  }

  /**
   * Aplica dany a la pista indicada i actualitza el document (via el DJ si
   * l'usuari no n'és propietari, A2).
   * @param {number} quantitat
   * @param {"ferides"|"fatiga"} pista
   */
  async aplicarDany(quantitat, pista = "ferides") {
    if (quantitat <= 0) return;
    const actual = this.system.salut[pista].marcats;
    await actualitzarComGM(this, { [`system.salut.${pista}.marcats`]: actual + quantitat });
  }

  /**
   * Cura de la pista indicada.
   * @param {number} quantitat
   * @param {"ferides"|"fatiga"} pista
   */
  async curar(quantitat, pista = "ferides") {
    if (quantitat <= 0) return;
    const actual = this.system.salut[pista].marcats;
    await actualitzarComGM(this, { [`system.salut.${pista}.marcats`]: Math.max(0, actual - quantitat) });
  }
}
