import ForjaRoll from "../dice/forja-roll.mjs";

/**
 * Extended Actor document for the FORJA system.
 * Provides roll methods and derived data integration.
 */
export default class ForjaActor extends Actor {

  /** @override */
  prepareData() {
    super.prepareData();
  }

  /**
   * Roll an attribute check (pure attribute, no skill).
   * @param {string} attributeKey - One of FOR, DES, AGI, PER, INT, APL
   * @param {object} options - Additional roll options
   */
  async rollAttribute(attributeKey, options = {}) {
    const attrValue = this.system.attributes[attributeKey]?.value ?? 0;
    if (attrValue <= 0) {
      ui.notifications.warn(game.i18n.localize("FORJA.Warnings.NoAttribute"));
      return null;
    }
    const label = game.i18n.localize(`FORJA.Attributes.${attributeKey}`);
    return this._rollForjaPool(attrValue, `${label}`, options);
  }

  /**
   * Roll a skill check (attribute + skill level).
   * @param {string} itemId - The skill Item ID on this actor
   * @param {object} options - Additional roll options
   */
  async rollSkill(itemId, options = {}) {
    const item = this.items.get(itemId);
    if (!item || item.type !== "skill") return null;

    const attrKey = item.system.relatedAttribute;
    const attrValue = this.system.attributes[attrKey]?.value ?? 0;
    const skillLevel = item.system.level ?? 0;
    const dice = attrValue + skillLevel;

    const attrLabel = game.i18n.localize(`FORJA.Attributes.${attrKey}`);
    const label = `${attrLabel} + ${item.name}`;
    return this._rollForjaPool(dice, label, options);
  }

  /**
   * Roll an attack with a weapon.
   * @param {string} itemId - The weapon Item ID on this actor
   * @param {object} options - Additional roll options
   */
  async rollAttack(itemId, options = {}) {
    const item = this.items.get(itemId);
    if (!item || item.type !== "weapon") return null;

    const formula = CONFIG.FORJA.attackFormulas[item.system.attackType];
    if (!formula) return null;

    const attrValue = this.system.attributes[formula.attribute]?.value ?? 0;

    // Find the matching skill on this actor
    let skillLevel = 0;
    for (const skill of this.items) {
      if (skill.type === "skill" && skill.system.skillId === formula.skill) {
        skillLevel = skill.system.level ?? 0;
        break;
      }
    }

    const dice = attrValue + skillLevel;
    const attrLabel = game.i18n.localize(`FORJA.Attributes.${formula.attribute}`);
    const label = `${item.name} (${attrLabel} ${attrValue} + ${skillLevel})`;
    return this._rollForjaPool(dice, label, { ...options, weapon: item });
  }

  /**
   * Detect trait modifiers on this actor for dice rolls.
   * Returns an object with boolean flags for: adept, inept, specialist, titanic.
   */
  _getTraitModifiers() {
    const modifiers = {};
    for (const item of this.items) {
      if (item.type !== "trait") continue;
      const traitId = item.system.traitId;
      if (traitId === "adepte") modifiers.adept = true;
      if (traitId === "inepte") modifiers.inept = true;
      if (traitId === "especialista") modifiers.specialist = true;
      if (traitId === "atribut-titanic") modifiers.titanic = true;
    }
    return modifiers;
  }

  /**
   * Core FORJA dice pool roll: Xd10, count fites (successes) using ForjaRoll.
   * Automatically applies trait modifiers (adept, inept, specialist, titanic).
   * @param {number} poolSize - Number of d10 to roll
   * @param {string} label - Roll label for chat
   * @param {object} options - Roll options
   */
  async _rollForjaPool(poolSize, label, options = {}) {
    if (poolSize <= 0) poolSize = 1;

    // Detect trait modifiers from this actor's items
    const forjaModifiers = options.forja ?? this._getTraitModifiers();

    const roll = new ForjaRoll(`${poolSize}d10`, {}, { forja: forjaModifiers });
    await roll.evaluate();

    const { dice, fites, isPifia } = roll.forjaResults;

    // Render chat message from template
    const diceData = dice.map(d => ({ value: d, class: ForjaRoll.getDieClass(d) }));
    const resultClass = isPifia ? "roll-pifia" : fites > 0 ? "roll-success" : "roll-failure";
    const content = await renderTemplate("systems/forja/templates/dice/roll-result.hbs", {
      label, dice: diceData, fites, isPifia, resultClass
    });

    // Create the chat message
    const messageData = {
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content,
      rolls: [roll],
      sound: CONFIG.sounds.dice
    };

    await ChatMessage.create(messageData);

    return { roll, dice, fites, isPifia };
  }
}
