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
   * Core FORJA dice pool roll: Xd10, count fites (successes).
   * 6-9 = 1 fite, 10 = 2 fites, 1 with 0 fites = pifia.
   * @param {number} poolSize - Number of d10 to roll
   * @param {string} label - Roll label for chat
   * @param {object} options - Roll options
   */
  async _rollForjaPool(poolSize, label, options = {}) {
    if (poolSize <= 0) poolSize = 1;

    const roll = new Roll(`${poolSize}d10`);
    await roll.evaluate();

    const dice = roll.dice[0].results.map(r => r.result);
    let fites = 0;
    let hasOnes = false;

    for (const die of dice) {
      if (die >= 10) fites += 2;
      else if (die >= 6) fites += 1;
      if (die === 1) hasOnes = true;
    }

    const isPifia = hasOnes && fites === 0;

    // Build chat message content
    const diceHtml = dice.map(d => {
      let cls = "die-result";
      if (d === 1) cls += " die-fumble";
      else if (d >= 10) cls += " die-critical";
      else if (d >= 6) cls += " die-success";
      return `<span class="${cls}">${d}</span>`;
    }).join(" ");

    const resultClass = isPifia ? "roll-pifia" : fites > 0 ? "roll-success" : "roll-failure";
    const resultLabel = isPifia
      ? game.i18n.localize("FORJA.Dice.pifia")
      : `${fites} ${game.i18n.localize("FORJA.Dice.fites")}`;

    const content = `
      <div class="forja-roll">
        <h4 class="roll-label">${label}</h4>
        <div class="dice-results">${diceHtml}</div>
        <div class="roll-result ${resultClass}">${resultLabel}</div>
      </div>
    `;

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
