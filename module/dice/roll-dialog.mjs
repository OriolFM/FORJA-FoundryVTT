/**
 * Dialog for configuring and executing FORJA dice pool rolls.
 */
export default class ForjaRollDialog extends foundry.applications.api.DialogV2 {

  /**
   * Show a roll dialog and return the roll result.
   * @param {object} options
   * @param {string} options.title - Dialog title
   * @param {number} options.poolSize - Base dice pool size
   * @param {string} options.label - Roll label (e.g., "AGI + Acrobatics")
   * @param {ForjaActor} options.actor - The rolling actor
   * @param {object} [options.modifiers] - Trait modifiers { adept, inept, specialist, titanic }
   * @returns {Promise<{roll, fites, isPifia}|null>}
   */
  static async roll({ title, poolSize, label, actor, modifiers = {} } = {}) {
    const content = `
      <form class="forja-roll-dialog">
        <div class="form-group">
          <label>${game.i18n.localize("FORJA.Dice.pool")}</label>
          <input type="number" name="pool" value="${poolSize}" min="1" max="20" />
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("FORJA.Dice.modifier")}</label>
          <input type="number" name="modifier" value="0" min="-10" max="10" />
        </div>
      </form>
    `;

    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: title || game.i18n.localize("FORJA.Dice.roll") },
      content,
      ok: {
        label: game.i18n.localize("FORJA.Dice.roll"),
        callback: (event, button, dialog) => {
          const form = button.form;
          return {
            pool: parseInt(form.elements.pool.value) || poolSize,
            modifier: parseInt(form.elements.modifier.value) || 0
          };
        }
      }
    });

    if (!result) return null;

    const finalPool = Math.max(1, result.pool + result.modifier);
    return actor._rollForjaPool(finalPool, label, { forja: modifiers });
  }
}
