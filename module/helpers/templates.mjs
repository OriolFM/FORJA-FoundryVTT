/**
 * Register custom Handlebars helpers for the FORJA system.
 */
export function registerHandlebarsHelpers() {

  /**
   * Repeat a block N times.
   * {{#times 5}}...{{/times}}
   */
  Handlebars.registerHelper("times", function (n, block) {
    let result = "";
    for (let i = 0; i < n; i++) {
      result += block.fn(i);
    }
    return result;
  });

  /**
   * Check equality.
   * {{#ifeq value "expected"}}...{{/ifeq}}
   */
  Handlebars.registerHelper("ifeq", function (a, b, options) {
    return a === b ? options.fn(this) : options.inverse(this);
  });

  /**
   * Check inequality.
   * {{#ifneq value "unexpected"}}...{{/ifneq}}
   */
  Handlebars.registerHelper("ifneq", function (a, b, options) {
    return a !== b ? options.fn(this) : options.inverse(this);
  });

  /**
   * Greater than comparison.
   * {{#ifgt value 0}}...{{/ifgt}}
   */
  Handlebars.registerHelper("ifgt", function (a, b, options) {
    return a > b ? options.fn(this) : options.inverse(this);
  });

  /**
   * Localize a FORJA key with a dynamic suffix.
   * {{forjaLocalize "FORJA.WoundLevel" woundLevel}}
   */
  Handlebars.registerHelper("forjaLocalize", function (prefix, key) {
    return game.i18n.localize(`${prefix}.${key}`);
  });

  /**
   * Get a config label (localized) by key.
   * {{configLabel cfg.species species}}
   */
  Handlebars.registerHelper("configLabel", function (configObj, key) {
    const i18nKey = configObj?.[key];
    return i18nKey ? game.i18n.localize(i18nKey) : key;
  });

  /**
   * Calculate percentage for progress bars.
   * {{percentage current max}}
   */
  Handlebars.registerHelper("percentage", function (current, max) {
    if (!max || max <= 0) return 0;
    return Math.clamp(Math.round((current / max) * 100), 0, 100);
  });

  /**
   * Add two numbers.
   * {{add a b}}
   */
  Handlebars.registerHelper("add", function (a, b) {
    return (Number(a) || 0) + (Number(b) || 0);
  });

  /**
   * Generate dot indicators for level display.
   * {{#levelDots level maxLevel}}...{{/levelDots}}
   */
  Handlebars.registerHelper("levelDots", function (level, maxLevel, options) {
    let result = "";
    for (let i = 1; i <= maxLevel; i++) {
      const filled = i <= level;
      result += options.fn({ index: i, filled });
    }
    return result;
  });

  /**
   * Sign a number with + or - prefix.
   * {{signed 3}} -> "+3"
   */
  Handlebars.registerHelper("signed", function (value) {
    const num = Number(value) || 0;
    return num >= 0 ? `+${num}` : `${num}`;
  });
}
