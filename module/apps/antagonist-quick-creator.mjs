import { ANTAGONIST_TEMPLATES, TEMPLATE_GROUPS } from "../helpers/antagonist-templates.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Diàleg de creació ràpida d'antagonistes / PNJ.
 * Accessible des del directori d'actors (botó "Antagonista ràpid").
 */
export class AntagonistQuickCreator extends HandlebarsApplicationMixin(ApplicationV2) {

  // ── Estat intern ──────────────────────────────────────────────────────

  #selectedTemplate = null;
  #quantity = 1;
  #addToCombat = false;

  // ── Opcions estàtiques ─────────────────────────────────────────────────

  static DEFAULT_OPTIONS = {
    id: "forja-antagonist-creator",
    classes: ["forja", "antagonist-creator"],
    window: { title: "FORJA.Antagonist.QuickCreate" },
    position: { width: 560, height: 580 },
    actions: {
      selectTemplate: AntagonistQuickCreator._onSelectTemplate,
      createAntagonists: AntagonistQuickCreator._onCreateAntagonists
    }
  };

  static PARTS = {
    creator: { template: "systems/forja/templates/apps/antagonist-quick-creator.hbs" }
  };

  // ── Context ────────────────────────────────────────────────────────────

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const groups = TEMPLATE_GROUPS.map(group => ({
      labelKey: group.labelKey,
      tier: group.tier,
      templates: group.templates
        .filter(key => ANTAGONIST_TEMPLATES[key])
        .map(key => ({
          key,
          label: game.i18n.localize(ANTAGONIST_TEMPLATES[key].label),
          tier: ANTAGONIST_TEMPLATES[key].tier,
          type: ANTAGONIST_TEMPLATES[key].type,
          selected: key === this.#selectedTemplate
        }))
    }));

    const selected = this.#selectedTemplate ? ANTAGONIST_TEMPLATES[this.#selectedTemplate] : null;

    return {
      ...context,
      groups,
      selectedKey: this.#selectedTemplate,
      selectedLabel: selected ? game.i18n.localize(selected.label) : null,
      selectedPreview: selected ? this._buildPreview(this.#selectedTemplate, selected) : null,
      quantity: this.#quantity,
      addToCombat: this.#addToCombat,
      hasCombat: !!game.combat,
      canCreate: !!this.#selectedTemplate
    };
  }

  _buildPreview(key, tpl) {
    const attrStr = Object.entries(tpl.attributes)
      .map(([k, v]) => `${k}:${v}`)
      .join(" · ");
    const skillStr = Object.entries(tpl.skills ?? {})
      .map(([id, lvl]) => `${id}/${lvl}`)
      .join(", ") || "—";
    const traitStr = (tpl.traitIds ?? []).join(", ") || "—";
    return { attrStr, skillStr, traitStr, type: tpl.type, tier: tpl.tier };
  }

  // ── Gestió d'events de formulari ──────────────────────────────────────

  _onChangeForm(formConfig, event) {
    const target = event.target;
    if (!target) return;
    if (target.name === "quantity") {
      this.#quantity = Math.max(1, Math.min(20, parseInt(target.value) || 1));
    }
    if (target.name === "addToCombat") {
      this.#addToCombat = target.checked;
    }
    this.render();
  }

  // ── Accions ────────────────────────────────────────────────────────────

  static async _onSelectTemplate(event, target) {
    const key = target.dataset.templateKey;
    this.#selectedTemplate = (this.#selectedTemplate === key) ? null : key;
    this.render();
  }

  static async _onCreateAntagonists(event, target) {
    if (!this.#selectedTemplate) return;

    const tpl = ANTAGONIST_TEMPLATES[this.#selectedTemplate];
    if (!tpl) return;

    // Deshabilitar botó mentre es creen
    const btn = this.element?.querySelector("[data-action='createAntagonists']");
    if (btn) btn.disabled = true;

    try {
      const label = game.i18n.localize(tpl.label);
      const created = [];

      for (let i = 1; i <= this.#quantity; i++) {
        const name = this.#quantity > 1 ? `${label} ${i}` : label;
        const actor = await this._createFromTemplate(name, tpl);
        created.push(actor);
      }

      // Afegir al combat actiu si cal
      if (this.#addToCombat && game.combat && created.length) {
        const combatantData = created
          .flatMap(a => a.getActiveTokens())
          .map(t => ({ tokenId: t.id, sceneId: t.scene.id }));
        if (combatantData.length) {
          await game.combat.createEmbeddedDocuments("Combatant", combatantData);
        }
      }

      ui.notifications.info(
        game.i18n.format("FORJA.Antagonist.Created", { count: created.length, name: label })
      );
      this.close();
    } catch (e) {
      console.error("FORJA | Error creating antagonists:", e);
      ui.notifications.error(`FORJA: ${e.message}`);
      if (btn) btn.disabled = false;
    }
  }

  // ── Creació de l'actor ─────────────────────────────────────────────────

  async _createFromTemplate(name, tpl) {
    // Construir l'actor base
    const actorData = {
      name,
      type: tpl.type ?? "npc",
      system: {
        species: tpl.species ?? "humanoid",
        size: tpl.size ?? 3,
        constitution: tpl.constitution ?? 3,
        attributes: Object.fromEntries(
          Object.entries(tpl.attributes).map(([k, v]) => [k, { value: v }])
        ),
        ...(tpl.tier ? { tier: tpl.tier } : {})
      }
    };

    const actor = await Actor.create(actorData);
    if (!actor) throw new Error("No s'ha pogut crear l'actor");

    // Cercar i afegir items des dels compendiums
    const itemsToCreate = await this._resolveTemplateItems(tpl);
    if (itemsToCreate.length) {
      await actor.createEmbeddedDocuments("Item", itemsToCreate);
    }

    return actor;
  }

  async _resolveTemplateItems(tpl) {
    const items = [];

    // Skills
    if (tpl.skills && Object.keys(tpl.skills).length) {
      const skillPack = game.packs.get("forja.skills");
      if (skillPack) {
        const skillDocs = await skillPack.getDocuments();
        for (const [skillId, level] of Object.entries(tpl.skills)) {
          const skillItem = skillDocs.find(i => i.system.skillId === skillId);
          if (skillItem) {
            const data = skillItem.toObject();
            data.system.level = level;
            delete data._id;
            items.push(data);
          } else {
            // Crear skill bàsic si no es troba al compendium
            items.push({
              name: skillId,
              type: "skill",
              system: { skillId, level, skillType: "basic", relatedAttribute: "FOR" }
            });
          }
        }
      }
    }

    // Traits
    if (tpl.traitIds?.length) {
      const traitPack = game.packs.get("forja.traits");
      if (traitPack) {
        const traitDocs = await traitPack.getDocuments();
        for (const traitId of tpl.traitIds) {
          const traitItem = traitDocs.find(i => i.system.traitId === traitId);
          if (traitItem) {
            const data = traitItem.toObject();
            delete data._id;
            items.push(data);
          }
        }
      }
    }

    // Weapons
    if (tpl.weaponIds?.length) {
      const weaponPack = game.packs.get("forja.weapons");
      if (weaponPack) {
        const weaponDocs = await weaponPack.getDocuments();
        for (const weaponId of tpl.weaponIds) {
          const weaponItem = weaponDocs.find(i => i.id === weaponId || i.name.toLowerCase() === weaponId.toLowerCase());
          if (weaponItem) {
            const data = weaponItem.toObject();
            delete data._id;
            items.push(data);
          }
        }
      }
    }

    return items;
  }
}
