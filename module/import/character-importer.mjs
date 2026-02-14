/**
 * FORJA RPG - Character Importer
 * Imports characters from FORJAPP JSON exports into Foundry VTT actors.
 */

// Map FORJAPP character types to Foundry actor types
const TYPE_MAP = {
  PJ: "character",
  PNJ: "npc",
  Criatura: "creature",
  Animal: "animal"
};

// Special camelCase → kebab-case overrides for IDs that don't convert cleanly
const ID_OVERRIDES = {
  armesCosCos: "armes-cos-a-cos",
  armesDistancia: "armes-distancia",
  armesImprovisades: "armes-improvisades",
  artsMarcials: "arts-marcials",
  jocsDelMans: "jocs-de-mans",
  jocsdemans: "jocs-de-mans",
  forcaBruta: "forca-bruta",
  tracteAnimals: "tracte-animals",
  sentitAgutOida: "sentit-agut-oida",
  sentitAgutOlfacte: "sentit-agut-olfacte",
  sentitAgutTacte: "sentit-agut-tacte",
  sentitAgutVista: "sentit-agut-vista",
  sentitsAgutsTots: "sentits-aguts-tots",
  sentitDelPerill: "sentit-del-perill",
  sentitAtrofiatBorni: "sentit-atrofiat-borni",
  sentitAtrofiatCec: "sentit-atrofiat-cec",
  sentitAtrofiatOlfacte: "sentit-atrofiat-olfacte",
  sentitAtrofiatSord: "sentit-atrofiat-sord",
  sentitAtrofiatTacte: "sentit-atrofiat-tacte",
  visioNocturna: "visio-nocturna",
  visioPeriferica: "visio-periferica",
  curacioRapida: "curacio-rapida",
  durDePelar: "dur-de-pelar",
  reflexosRapids: "reflexos-rapids",
  armaduraNatural: "armadura-natural",
  bracosAddicionals: "bracos-addicionals",
  potesAddicionals: "potes-addicionals",
  coordinacioMillorada: "coordinacio-millorada",
  adiccioLleu: "adiccio-lleu",
  adiccioModerada: "adiccio-moderada",
  adiccioSevera: "adiccio-severa",
  alergiaLleu: "alergia-lleu",
  alergiaModerada: "alergia-moderada",
  alergiaSevera: "alergia-severa",
  aparencaAgradable: "aparenca-agradable",
  aparencaNeutra: "aparenca-neutra",
  aparencaDesagradable: "aparenca-desagradable",
  linguistaNatural: "linguista-natural",
  impedimentParla: "impediment-parla",
  recursosProfessional: "recursos-professional",
  recursosAcomodat: "recursos-acomodat",
  recursosElit: "recursos-elit",
  recursosPobre: "recursos-pobre",
  esguerratBrac: "esguerrat-brac",
  esguerratCama: "esguerrat-cama",
  esguerratMa: "esguerrat-ma",
  controlQi: "control-qi",
  noMort: "no-mort",
  processadorCortical: "processador-cortical",
  atributTitanic: "atribut-titanic",
  armamentNaturalBanyes: "armament-natural-banyes",
  armamentNaturalFiblo: "armament-natural-fiblo",
  armamentNaturalMossegada: "armament-natural-mossegada",
  armamentNaturalPinces: "armament-natural-pinces",
  armamentNaturalUrpes: "armament-natural-urpes",
  pocaTraca: "poca-traca"
};

export default class ForjaCharacterImporter {

  /**
   * Convert a camelCase ID to kebab-case, with override support.
   */
  static normalizeId(id) {
    if (!id) return "";
    // Check overrides first
    if (ID_OVERRIDES[id]) return ID_OVERRIDES[id];
    // Already kebab-case?
    if (id.includes("-")) return id;
    // Convert camelCase to kebab-case
    return id.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  }

  /**
   * Find a compendium item by its system ID field.
   */
  static async findCompendiumItem(packName, fieldName, id) {
    const pack = game.packs.get(`forja.${packName}`);
    if (!pack) return null;
    const index = await pack.getDocuments();
    return index.find(i => i.system[fieldName] === id) ?? null;
  }

  /**
   * Show the import dialog.
   */
  static showImportDialog() {
    new Dialog({
      title: game.i18n.localize("FORJA.Import.Title"),
      content: `
        <form class="forja-import-dialog">
          <p class="forja-import-dialog__hint">${game.i18n.localize("FORJA.Import.Hint")}</p>
          <div class="form-group">
            <textarea name="json" rows="12" placeholder='${game.i18n.localize("FORJA.Import.Paste")}'
                      class="forja-import-dialog__textarea"></textarea>
          </div>
          <div class="form-group">
            <label class="forja-import-dialog__file-label">
              <input type="file" name="file" accept=".json" class="forja-import-dialog__file" />
              <i class="fas fa-upload"></i> ${game.i18n.localize("FORJA.Import.Upload")}
            </label>
          </div>
        </form>
      `,
      buttons: {
        import: {
          icon: '<i class="fas fa-file-import"></i>',
          label: game.i18n.localize("FORJA.Import.Button"),
          callback: async (html) => {
            const textarea = html.find("textarea[name='json']");
            const fileInput = html.find("input[name='file']")[0];

            let jsonText = textarea.val()?.trim();

            // If file was selected, read it
            if (fileInput?.files?.length) {
              jsonText = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsText(fileInput.files[0]);
              });
            }

            if (!jsonText) {
              ui.notifications.warn(game.i18n.localize("FORJA.Import.NoData"));
              return;
            }

            try {
              const data = JSON.parse(jsonText);
              await ForjaCharacterImporter.importFromJSON(data);
            } catch (err) {
              console.error("FORJA Import Error:", err);
              ui.notifications.error(`${game.i18n.localize("FORJA.Import.Error")}: ${err.message}`);
            }
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize("Cancel")
        }
      },
      default: "import",
      render: (html) => {
        // When file is selected, load its contents into textarea
        html.find("input[name='file']").on("change", (ev) => {
          const file = ev.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (e) => {
            html.find("textarea[name='json']").val(e.target.result);
          };
          reader.readAsText(file);
        });
      }
    }, { width: 520 }).render(true);
  }

  /**
   * Import a character from FORJAPP JSON data.
   */
  static async importFromJSON(data) {
    // Determine actor type
    const actorType = TYPE_MAP[data.characterType] ?? "character";

    // Build attributes (FORJAPP stores flat numbers, Foundry uses {value: n})
    const attributes = {};
    const rawAttrs = data.attributes ?? {};
    for (const key of ["FOR", "DES", "AGI", "PER", "INT", "APL"]) {
      const val = typeof rawAttrs[key] === "object" ? rawAttrs[key].value : (rawAttrs[key] ?? 1);
      attributes[key] = { value: Math.clamp(val, 0, 5) };
    }

    // Build actor system data
    const systemData = {
      species: data.species ?? "humanoid",
      size: Math.clamp(data.size ?? 3, 1, 5),
      constitution: Math.clamp(data.constitution ?? 3, 1, 5),
      attributes,
      health: {
        wounds: { value: data.currentWounds ?? 0, max: 0 },
        fatigue: { value: data.currentFatigue ?? 0, max: 0 }
      },
      totalPoints: data.totalPoints ?? 100,
      equilibrium: { value: 0, max: 0 },
      biography: data.biography ?? data.notes ?? ""
    };

    // Add character-specific fields
    if (actorType === "character") {
      systemData.concept = data.concept ?? "";
      systemData.origin = data.origin ?? "";
      systemData.gender = data.gender ?? "";
      systemData.age = data.age ?? 0;
      systemData.resources = data.resources ?? "";
      systemData.guanxi = data.guanxi ?? "";
      systemData.notes = data.notes ?? "";
    }

    // Add NPC-specific fields
    if (actorType === "npc") {
      systemData.concept = data.concept ?? "";
      systemData.origin = data.origin ?? "";
      systemData.notes = data.notes ?? "";
    }

    // Create the actor
    const actor = await Actor.create({
      name: data.name || game.i18n.localize("FORJA.Import.UnnamedCharacter"),
      type: actorType,
      system: systemData
    });

    if (!actor) throw new Error("Failed to create actor");

    // Collect all items to add
    const items = [];

    // --- Skills ---
    if (data.skills?.length) {
      for (const s of data.skills) {
        const normalizedId = this.normalizeId(s.skillId);
        const compItem = await this.findCompendiumItem("skills", "skillId", normalizedId);
        if (compItem) {
          const itemData = compItem.toObject();
          itemData.system.level = s.level ?? 0;
          if (s.notes) itemData.system.notes = s.notes;
          delete itemData._id;
          items.push(itemData);
        } else {
          // Fallback: create manually
          items.push({
            name: normalizedId,
            type: "skill",
            system: {
              skillId: normalizedId,
              skillType: "basic",
              relatedAttribute: "FOR",
              level: s.level ?? 0,
              maxLevel: 5,
              notes: s.notes ?? ""
            }
          });
        }
      }
    }

    // --- Traits ---
    if (data.traits?.length) {
      for (const t of data.traits) {
        const normalizedId = this.normalizeId(t.traitId);
        const compItem = await this.findCompendiumItem("traits", "traitId", normalizedId);
        if (compItem) {
          const itemData = compItem.toObject();
          if (t.level != null) itemData.system.level = t.level;
          if (t.variantCost != null) itemData.system.variantCost = t.variantCost;
          if (t.notes) itemData.system.notes = t.notes;
          delete itemData._id;
          items.push(itemData);
        } else {
          items.push({
            name: normalizedId,
            type: "trait",
            system: {
              traitId: normalizedId,
              traitType: "positive",
              category: "general",
              cost: 0,
              level: t.level ?? 0,
              notes: t.notes ?? ""
            }
          });
        }
      }
    }

    // --- Weapons ---
    if (data.weapons?.length) {
      for (const w of data.weapons) {
        const name = w.customName || w.name || "Weapon";
        const weaponId = w.baseWeaponId ? this.normalizeId(w.baseWeaponId) : null;
        let compItem = null;
        if (weaponId) {
          // Try to find by name match in compendium
          const pack = game.packs.get("forja.weapons");
          if (pack) {
            const docs = await pack.getDocuments();
            compItem = docs.find(i => i.name.toLowerCase() === name.toLowerCase()) ?? null;
          }
        }
        if (compItem) {
          const itemData = compItem.toObject();
          itemData.name = name;
          itemData.system.equipped = true;
          delete itemData._id;
          items.push(itemData);
        } else {
          items.push({
            name,
            type: "weapon",
            system: {
              weaponType: w.attackType === "ranged" ? "ranged" : (w.attackType === "natural" ? "natural" : "melee"),
              attackType: w.attackType ?? "melee",
              latencyMod: w.latency ?? 0,
              reach: w.reach ?? "",
              range: w.range ?? "",
              damage: w.damage ?? "FOR+1",
              special: w.special ?? "",
              quantity: w.quantity ?? 1,
              equipped: true
            }
          });
        }
      }
    }

    // --- Armor ---
    const armorData = data.equippedArmor;
    if (armorData) {
      items.push({
        name: armorData.name || "Armor",
        type: "armor",
        system: {
          protection: armorData.protection ?? 0,
          latencyMod: armorData.latencyMod ?? 0,
          equipped: true
        }
      });
    }

    // --- Artifacts ---
    if (data.artifacts?.length) {
      for (const a of data.artifacts) {
        // Try compendium match by name
        let compItem = null;
        const pack = game.packs.get("forja.artifacts");
        if (pack && a.name) {
          const docs = await pack.getDocuments();
          compItem = docs.find(i => i.name.toLowerCase() === a.name.toLowerCase()) ?? null;
        }
        if (compItem) {
          const itemData = compItem.toObject();
          if (a.charges != null) itemData.system.charges.value = a.charges;
          delete itemData._id;
          items.push(itemData);
        } else if (a.name) {
          items.push({
            name: a.name,
            type: "artifact",
            system: {
              cost: a.cost ?? 0,
              activation: a.activation ?? "normal",
              difficulty: a.difficulty ?? 0,
              latencyMod: a.latencyMod ?? 0,
              range: a.range ?? "",
              target: a.target ?? "",
              duration: a.duration ?? "",
              charges: { value: a.charges ?? 0, max: a.maxCharges ?? 0 },
              damageValue: a.damageValue ?? 0,
              damageType: a.damageType ?? "",
              protection: a.protection ?? 0,
              notes: a.notes ?? ""
            }
          });
        }
      }
    }

    // --- Supernatural Effects ---
    if (data.supernaturalEffects?.length) {
      for (const e of data.supernaturalEffects) {
        let compItem = null;
        const pack = game.packs.get("forja.supernatural-effects");
        if (pack && e.name) {
          const docs = await pack.getDocuments();
          compItem = docs.find(i => i.name.toLowerCase() === e.name.toLowerCase()) ?? null;
        }
        if (compItem) {
          const itemData = compItem.toObject();
          delete itemData._id;
          items.push(itemData);
        } else if (e.name) {
          items.push({
            name: e.name,
            type: "supernaturalEffect",
            system: {
              cost: e.cost ?? 0,
              requiredGift: e.requiredGift ?? "magus",
              activation: e.activation ?? "normal",
              difficulty: e.difficulty ?? 0,
              equilibriumCost: e.equilibriumCost ?? 0,
              range: e.range ?? "",
              target: e.target ?? "",
              duration: e.duration ?? "",
              damageValue: e.damageValue ?? 0,
              damageType: e.damageType ?? "",
              notes: e.notes ?? ""
            }
          });
        }
      }
    }

    // Add all items to the actor in one batch
    if (items.length) {
      await actor.createEmbeddedDocuments("Item", items);
    }

    // Open the actor sheet
    actor.sheet.render(true);

    const itemCount = items.length;
    ui.notifications.info(
      game.i18n.format("FORJA.Import.Success", { name: actor.name, count: itemCount })
    );

    return actor;
  }
}
