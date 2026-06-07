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
   * Aplica dany a la pista indicada i actualitza el document.
   * @param {number} quantitat
   * @param {"ferides"|"fatiga"} pista
   */
  async aplicarDany(quantitat, pista = "ferides") {
    if (quantitat <= 0) return;
    const actual = this.system.salut[pista].marcats;
    await this.update({ [`system.salut.${pista}.marcats`]: actual + quantitat });
  }

  /**
   * Cura de la pista indicada.
   * @param {number} quantitat
   * @param {"ferides"|"fatiga"} pista
   */
  async curar(quantitat, pista = "ferides") {
    if (quantitat <= 0) return;
    const actual = this.system.salut[pista].marcats;
    await this.update({ [`system.salut.${pista}.marcats`]: Math.max(0, actual - quantitat) });
  }
}
