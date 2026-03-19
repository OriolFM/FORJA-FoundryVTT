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
    if (!item) return null;

    // Resolve attack type: weapon items use attackType directly;
    // artifact weapons look up the base weapon profile from CONFIG.FORJA.weaponBaseStats.
    let attackType;
    if (item.type === "weapon") {
      attackType = item.system.attackType;
    } else if (item.type === "artifact" && item.system.baseWeapon) {
      attackType = CONFIG.FORJA.weaponBaseStats[item.system.baseWeapon]?.attackType ?? "melee";
    } else if (item.type === "artifact") {
      // Standalone artifact weapon (no baseWeapon) — default to melee brawl
      attackType = "melee";
    } else {
      return null;
    }

    const formula = CONFIG.FORJA.attackFormulas[attackType];
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
   * Roll a defense maneuver (active defense with correct FORJA mechanics).
   * - dodge: AGI + Esquivar skill level
   * - parry: DES + best of (armes-cos-a-cos / barallar-se / arts-marcials)
   * - block: returns null (static defense, no dice roll — handled in combat-tracker)
   * @param {string} defenseType - "dodge" | "parry" | "block"
   * @param {object} options
   */
  async rollDefense(defenseType, options = {}) {
    if (defenseType === "dodge") {
      const agi = this.system.attributes?.AGI?.value ?? 0;
      let esquivarLevel = 0;
      for (const item of this.items) {
        if (item.type === "skill" && item.system.skillId === "esquivar") {
          esquivarLevel = item.system.level ?? 0;
          break;
        }
      }
      const dice = agi + esquivarLevel;
      const label = `${game.i18n.localize("FORJA.Combat.DefenseDodge")} (AGI ${agi} + ${esquivarLevel})`;
      return this._rollForjaPool(dice, label, options);
    }

    if (defenseType === "parry") {
      const des = this.system.attributes?.DES?.value ?? 0;
      const meleeIds = ["armes-cos-a-cos", "barallar-se", "arts-marcials"];
      let bestLevel = 0;
      for (const item of this.items) {
        if (item.type === "skill" && meleeIds.includes(item.system.skillId)) {
          if ((item.system.level ?? 0) > bestLevel) bestLevel = item.system.level ?? 0;
        }
      }
      const dice = des + bestLevel;
      const label = `${game.i18n.localize("FORJA.Combat.DefenseParry")} (DES ${des} + ${bestLevel})`;
      return this._rollForjaPool(dice, label, options);
    }

    // block: no roll — caller uses static defense + extraDR
    return null;
  }

  /**
   * Roll an attack with a natural weapon (Cop or trait-based).
   * - "cop" automatically uses the better formula: FOR+barallar-se or DES+arts-marcials
   * - Other natural weapons use FOR+barallar-se
   * @param {string} weaponId - Natural weapon ID (e.g. "cop", "banyes", "urpes")
   * @param {object} options - Additional roll options
   */
  async rollNaturalWeapon(weaponId, options = {}) {
    const cfg = CONFIG.FORJA;

    // Resolve weapon definition
    let weaponDef;
    if (weaponId === "cop") {
      weaponDef = cfg.copWeapon;
    } else {
      weaponDef = Object.values(cfg.naturalWeaponTraits ?? {}).find(d => d.id === weaponId);
    }
    if (!weaponDef) return null;

    let attrKey = "FOR";
    let skillId = "barallar-se";

    if (weaponDef.attackType === "brawl") {
      // For Cop: pick whichever skill gives more total dice
      const forVal = this.system.attributes?.FOR?.value ?? 0;
      const desVal = this.system.attributes?.DES?.value ?? 0;
      let barLevel = 0;
      let martLevel = 0;
      for (const item of this.items) {
        if (item.type !== "skill") continue;
        if (item.system.skillId === "barallar-se") barLevel = item.system.level ?? 0;
        if (item.system.skillId === "arts-marcials") martLevel = item.system.level ?? 0;
      }
      if ((desVal + martLevel) > (forVal + barLevel)) {
        attrKey = "DES";
        skillId = "arts-marcials";
      }
    }

    const attrValue = this.system.attributes[attrKey]?.value ?? 0;
    let skillLevel = 0;
    for (const item of this.items) {
      if (item.type === "skill" && item.system.skillId === skillId) {
        skillLevel = item.system.level ?? 0;
        break;
      }
    }

    const dice = attrValue + skillLevel;
    const weaponName = game.i18n.localize(weaponDef.nameKey);
    const attrLabel = game.i18n.localize(`FORJA.Attributes.${attrKey}`);
    const label = `${weaponName} (${attrLabel} ${attrValue} + ${skillLevel})`;
    return this._rollForjaPool(dice, label, options);
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
   * Get the total penalty to dice pool from wounds and fatigue.
   * In FORJA, wound/fatigue penalties are extra dice the OPPONENT gets,
   * but we model it as a pool reduction for simplicity.
   * @returns {number} Penalty value (0 or positive)
   */
  getCombatPenalty() {
    const cfg = CONFIG.FORJA;
    if (!cfg) return 0;
    let penalty = 0;
    const woundEntry = cfg.woundLevels?.[this.system.woundLevel];
    if (woundEntry?.penalty) penalty += woundEntry.penalty;
    const fatigueEntry = cfg.fatigueLevels?.[this.system.fatigueLevel];
    if (fatigueEntry?.penalty) penalty += fatigueEntry.penalty;
    return penalty;
  }

  /**
   * Check if this actor is concentrating in combat (has +1 die bonus).
   * @returns {boolean}
   */
  isConcentratingInCombat() {
    const combatant = game.combat?.combatants.find(c => c.actorId === this.id);
    return combatant?.isConcentrating ?? false;
  }

  /**
   * Core FORJA dice pool roll: Xd10, count fites (successes) using ForjaRoll.
   * Automatically applies trait modifiers (adept, inept, specialist, titanic).
   * In combat, applies wound/fatigue penalties and concentration bonus.
   * @param {number} poolSize - Number of d10 to roll
   * @param {string} label - Roll label for chat
   * @param {object} options - Roll options
   * @param {boolean} [options.inCombat] - Force combat context (auto-detected if omitted)
   * @param {number} [options.bonusDice] - Extra dice to add
   */
  async _rollForjaPool(poolSize, label, options = {}) {
    if (poolSize <= 0) poolSize = 1;

    // Apply combat modifiers if in combat
    const inCombat = options.inCombat ?? (game.combat?.started ?? false);
    let combatNotes = [];
    if (inCombat) {
      // Concentration: +1 die
      if (this.isConcentratingInCombat()) {
        poolSize += 1;
        combatNotes.push(game.i18n.localize("FORJA.Combat.ConcentrationBonus"));
      }
    }

    // Bonus dice from options
    if (options.bonusDice) poolSize += options.bonusDice;

    // Detect trait modifiers from this actor's items
    const forjaModifiers = options.forja ?? this._getTraitModifiers();

    const roll = new ForjaRoll(`${poolSize}d10`, {}, { forja: forjaModifiers });
    await roll.evaluate();

    const { dice, fites, isPifia } = roll.forjaResults;

    // Render chat message from template
    const diceData = dice.map(d => ({ value: d, class: ForjaRoll.getDieClass(d) }));
    const resultClass = isPifia ? "roll-pifia" : fites > 0 ? "roll-success" : "roll-failure";
    const content = await foundry.applications.handlebars.renderTemplate("systems/forja/templates/dice/roll-result.hbs", {
      label, dice: diceData, fites, isPifia, resultClass, combatNotes
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
