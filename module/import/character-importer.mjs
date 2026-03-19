/**
 * FORJA RPG - Character Importer
 * Imports characters from FORJAPP JSON exports or directly from FORJAPP cloud
 * into Foundry VTT actors.
 */

import * as ForjappService from "./forjapp-service.mjs";

// Map FORJAPP character types to Foundry actor types
const TYPE_MAP = {
  PJ: "character",
  PNJ: "npc",
  Criatura: "creature",
  Animal: "animal"
};

// Map character types to i18n keys for display
const TYPE_LABELS = {
  PJ: "FORJA.ActorType.character",
  PNJ: "FORJA.ActorType.npc",
  Criatura: "FORJA.ActorType.creature",
  Animal: "FORJA.ActorType.animal"
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

  /* -------------------------------------------- */
  /*  Import Dialog                                */
  /* -------------------------------------------- */

  /**
   * Show the import dialog with JSON and FORJAPP tabs.
   */
  static showImportDialog() {
    const i18n = (key) => game.i18n.localize(key);

    new Dialog({
      title: i18n("FORJA.Import.Title"),
      content: `
        <form class="forja-import-dialog">
          <nav class="forja-import-tabs">
            <button type="button" class="forja-import-tab forja-import-tab--active" data-tab="json">
              <i class="fas fa-code"></i> ${i18n("FORJA.Import.TabJSON")}
            </button>
            <button type="button" class="forja-import-tab" data-tab="forjapp">
              <i class="fas fa-cloud-download-alt"></i> ${i18n("FORJA.Import.TabForjapp")}
            </button>
          </nav>

          <!-- JSON Tab -->
          <div class="forja-import-panel" data-panel="json">
            <p class="forja-import-dialog__hint">${i18n("FORJA.Import.Hint")}</p>
            <div class="form-group">
              <textarea name="json" rows="12" placeholder='${i18n("FORJA.Import.Paste")}'
                        class="forja-import-dialog__textarea"></textarea>
            </div>
            <div class="form-group">
              <label class="forja-import-dialog__file-label">
                <input type="file" name="file" accept=".json" class="forja-import-dialog__file" />
                <i class="fas fa-upload"></i> ${i18n("FORJA.Import.Upload")}
              </label>
            </div>
          </div>

          <!-- FORJAPP Tab -->
          <div class="forja-import-panel" data-panel="forjapp" style="display:none;">
            <div class="forja-import-auth">
              <div class="forja-import-auth__disconnected">
                <p class="forja-import-dialog__hint">${i18n("FORJA.Import.ForjappHint")}</p>
                <div class="forja-import-auth__steps">
                  <div class="forja-import-auth__step">
                    <span class="forja-import-auth__step-num">1</span>
                    <button type="button" class="forja-import-auth__btn forja-import-auth__btn--google">
                      <i class="fab fa-google"></i> ${i18n("FORJA.Import.ConnectGoogle")}
                    </button>
                  </div>
                  <div class="forja-import-auth__step">
                    <span class="forja-import-auth__step-num">2</span>
                    <div class="forja-import-auth__code-input">
                      <input type="text" name="authCode" placeholder="${i18n("FORJA.Import.PasteCode")}"
                             class="forja-import-auth__code" />
                      <button type="button" class="forja-import-auth__btn forja-import-auth__btn--connect">
                        <i class="fas fa-plug"></i> ${i18n("FORJA.Import.Connect")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div class="forja-import-auth__connected" style="display:none;">
                <div class="forja-import-auth__status">
                  <span class="forja-import-auth__user"></span>
                  <button type="button" class="forja-import-auth__disconnect">
                    <i class="fas fa-sign-out-alt"></i> ${i18n("FORJA.Import.Disconnect")}
                  </button>
                </div>
                <div class="forja-import-source-tabs">
                  <button type="button" class="forja-import-source-tab forja-import-source-tab--active" data-source="mine">
                    <i class="fas fa-user"></i> ${i18n("FORJA.Import.MyCharacters")}
                  </button>
                  <button type="button" class="forja-import-source-tab" data-source="public">
                    <i class="fas fa-globe"></i> ${i18n("FORJA.Import.PublicCharacters")}
                  </button>
                </div>
              </div>
            </div>
            <div class="forja-import-charlist">
              <div class="forja-import-charlist__search" style="display:none;">
                <i class="fas fa-search forja-picker-search__icon"></i>
                <input type="text" class="forja-picker-search__input forja-import-charlist__search-input"
                       placeholder="${i18n("FORJA.Search")}…" autocomplete="off" />
              </div>
              <div class="forja-import-charlist__loading" style="display:none;">
                <i class="fas fa-spinner fa-spin"></i> ${i18n("FORJA.Import.Loading")}
              </div>
              <div class="forja-import-charlist__empty" style="display:none;">
                <i class="fas fa-inbox"></i> ${i18n("FORJA.Import.NoCharacters")}
              </div>
              <div class="forja-import-charlist__items"></div>
            </div>
            <div class="forja-import-charlist__actions" style="display:none;">
              <label class="forja-import-charlist__select-all">
                <input type="checkbox" name="selectAll" /> ${i18n("FORJA.Import.SelectAll")}
              </label>
              <button type="button" class="forja-import-charlist__import-btn">
                <i class="fas fa-file-import"></i> ${i18n("FORJA.Import.ImportSelected")}
              </button>
            </div>
          </div>
        </form>
      `,
      buttons: {
        import: {
          icon: '<i class="fas fa-file-import"></i>',
          label: i18n("FORJA.Import.Button"),
          callback: async (html) => {
            // Only handle JSON tab import via this button
            const activePanel = html.find(".forja-import-panel:visible").data("panel");
            if (activePanel !== "json") return;

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
              ui.notifications.warn(i18n("FORJA.Import.NoData"));
              return;
            }

            try {
              const data = JSON.parse(jsonText);
              await ForjaCharacterImporter.importFromJSON(data);
            } catch (err) {
              console.error("FORJA Import Error:", err);
              ui.notifications.error(`${i18n("FORJA.Import.Error")}: ${err.message}`);
            }
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: i18n("Cancel")
        }
      },
      default: "import",
      render: (html) => {
        ForjaCharacterImporter._setupDialogEvents(html);
      }
    }, { width: 580, height: "auto", classes: ["forja-import-wrapper"] }).render(true);
  }

  /**
   * Set up all event handlers for the import dialog.
   */
  static _setupDialogEvents(html) {
    const i18n = (key, data) => data ? game.i18n.format(key, data) : game.i18n.localize(key);

    // --- Tab switching ---
    html.find(".forja-import-tab").on("click", (ev) => {
      const tab = ev.currentTarget.dataset.tab;
      html.find(".forja-import-tab").removeClass("forja-import-tab--active");
      ev.currentTarget.classList.add("forja-import-tab--active");
      html.find(".forja-import-panel").hide();
      html.find(`.forja-import-panel[data-panel="${tab}"]`).show();

      // Hide/show the Import button based on active tab
      const importBtn = html.closest(".dialog").find("button[data-button='import']");
      if (tab === "forjapp") {
        importBtn.hide();
      } else {
        importBtn.show();
      }
    });

    // --- JSON file upload into textarea ---
    html.find("input[name='file']").on("change", (ev) => {
      const file = ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        html.find("textarea[name='json']").val(e.target.result);
      };
      reader.readAsText(file);
    });

    // --- Step 1: Open auth.html in a new window ---
    html.find(".forja-import-auth__btn--google").on("click", () => {
      window.open(
        "/systems/forja/auth.html",
        "forjapp-auth",
        "width=500,height=600,menubar=no,toolbar=no,location=no"
      );
      // Focus the code input after opening
      html.find("input[name='authCode']").focus();
    });

    // --- Step 2: Paste code and connect (Enter key support) ---
    html.find("input[name='authCode']").on("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        html.find(".forja-import-auth__btn--connect").trigger("click");
      }
    });

    html.find(".forja-import-auth__btn--connect").on("click", async () => {
      const code = html.find("input[name='authCode']").val()?.trim();
      if (!code) {
        ui.notifications.warn(i18n("FORJA.Import.NoData"));
        return;
      }
      try {
        html.find(".forja-import-auth__btn--connect").prop("disabled", true);
        // Pre-init Firebase while processing
        ForjappService.preload().catch(() => {});
        console.log("FORJA | Processing auth code...");
        const user = await ForjappService.signInWithCode(code);
        console.log("FORJA | signIn resolved, user:", user?.displayName || user?.email);
        ForjaCharacterImporter._showConnected(html, user);
        console.log("FORJA | Loading characters...");
        await ForjaCharacterImporter._loadCharacters(html, "mine");
        console.log("FORJA | Characters loaded.");
      } catch (err) {
        console.error("FORJA | Firebase auth error:", err);
        ui.notifications.error(`${i18n("FORJA.Import.ConnectionError")}: ${err.message}`);
        html.find(".forja-import-auth__btn--connect").prop("disabled", false);
      }
    });

    // --- Disconnect ---
    html.find(".forja-import-auth__disconnect").on("click", async () => {
      await ForjappService.signOut();
      ForjaCharacterImporter._showDisconnected(html);
    });

    // --- Source tabs (mine/public) ---
    html.find(".forja-import-source-tab").on("click", async (ev) => {
      const source = ev.currentTarget.dataset.source;
      html.find(".forja-import-source-tab").removeClass("forja-import-source-tab--active");
      ev.currentTarget.classList.add("forja-import-source-tab--active");
      await ForjaCharacterImporter._loadCharacters(html, source);
    });

    // --- Character search/filter ---
    html.find(".forja-import-charlist__search-input").on("input", (ev) => {
      const q = ev.target.value.trim().toLowerCase();
      html.find(".forja-import-charlist__items .forja-import-charlist__item").each((_, el) => {
        const name = el.querySelector(".forja-import-charlist__name")?.textContent.toLowerCase() ?? "";
        el.style.display = name.includes(q) ? "" : "none";
      });
    });

    // --- Prevent type select from toggling checkbox (inside label) ---
    html.find(".forja-import-charlist__items").on("click", ".forja-import-charlist__type", (ev) => {
      ev.stopPropagation();
    });

    // --- Select all (only visible items) ---
    html.find("input[name='selectAll']").on("change", (ev) => {
      const checked = ev.target.checked;
      html.find(".forja-import-charlist__items .forja-import-charlist__item:visible input[type='checkbox']").prop("checked", checked);
    });

    // --- Import selected ---
    html.find(".forja-import-charlist__import-btn").on("click", async () => {
      const checked = html.find(".forja-import-charlist__items input[type='checkbox']:checked");
      if (!checked.length) {
        ui.notifications.warn(i18n("FORJA.Import.NoData"));
        return;
      }

      const importBtn = html.find(".forja-import-charlist__import-btn");
      importBtn.prop("disabled", true).html(`<i class="fas fa-spinner fa-spin"></i> ${i18n("FORJA.Import.Loading")}`);

      let imported = 0;
      for (const el of checked) {
        try {
          const charData = JSON.parse(el.dataset.character);
          // Apply the selected type from the dropdown
          const typeSelect = el.closest(".forja-import-charlist__item")?.querySelector(".forja-import-charlist__type");
          if (typeSelect) charData.characterType = typeSelect.value;
          await ForjaCharacterImporter.importFromJSON(charData);
          imported++;
        } catch (err) {
          console.error("FORJA | Import error for character:", err);
          ui.notifications.error(`${i18n("FORJA.Import.Error")}: ${err.message}`);
        }
      }

      importBtn.prop("disabled", false).html(`<i class="fas fa-file-import"></i> ${i18n("FORJA.Import.ImportSelected")}`);

      if (imported > 0) {
        ui.notifications.info(i18n("FORJA.Import.SuccessMultiple", { count: imported }));
      }
    });
  }

  /**
   * Show connected state in the FORJAPP tab.
   */
  static _showConnected(html, user) {
    const i18n = (key, data) => data ? game.i18n.format(key, data) : game.i18n.localize(key);
    html.find(".forja-import-auth__disconnected").hide();
    html.find(".forja-import-auth__connected").show();
    html.find(".forja-import-auth__user").text(
      i18n("FORJA.Import.ConnectedAs", { name: user.displayName || user.email })
    );
  }

  /**
   * Show disconnected state in the FORJAPP tab.
   */
  static _showDisconnected(html) {
    html.find(".forja-import-auth__connected").hide();
    html.find(".forja-import-auth__disconnected").show();
    html.find(".forja-import-auth__btn--google").prop("disabled", false);
    html.find(".forja-import-charlist__items").empty();
    html.find(".forja-import-charlist__actions").hide();
    html.find(".forja-import-charlist__empty").hide();
  }

  /**
   * Load characters from FORJAPP and populate the list.
   */
  static async _loadCharacters(html, source) {
    const loading = html.find(".forja-import-charlist__loading");
    const empty = html.find(".forja-import-charlist__empty");
    const items = html.find(".forja-import-charlist__items");
    const actions = html.find(".forja-import-charlist__actions");

    const searchWrap = html.find(".forja-import-charlist__search");
    loading.show();
    empty.hide();
    items.empty();
    actions.hide();
    searchWrap.hide();
    html.find(".forja-import-charlist__search-input").val("");

    try {
      let characters;
      if (source === "mine") {
        const user = await ForjappService.getCurrentUser();
        console.log("FORJA | _loadCharacters: currentUser =", user?.uid || "null");
        if (!user) {
          loading.hide();
          return;
        }
        characters = await ForjappService.getUserCharacters(user.uid);
      } else {
        characters = await ForjappService.getPublicCharacters();
      }

      console.log("FORJA | _loadCharacters: got", characters?.length ?? 0, "characters");
      loading.hide();

      if (!characters?.length) {
        empty.show();
        return;
      }

      // Render character list
      const typeOptions = ["PJ", "PNJ", "Criatura", "Animal"];
      for (const char of characters) {
        const date = char.updatedAt ? new Date(char.updatedAt).toLocaleDateString() : "";
        const points = char.totalPoints ?? "?";
        const currentType = char.characterType || "PJ";

        // Store character data as JSON in data attribute
        const charJson = JSON.stringify(char).replace(/"/g, "&quot;");

        // Build type selector options
        const selectOptions = typeOptions.map(t => {
          const label = game.i18n.localize(TYPE_LABELS[t] ?? "FORJA.ActorType.character");
          const selected = t === currentType ? "selected" : "";
          return `<option value="${t}" ${selected}>${label}</option>`;
        }).join("");

        const itemHtml = `
          <label class="forja-import-charlist__item">
            <input type="checkbox" data-character="${charJson}" />
            <div class="forja-import-charlist__info">
              <span class="forja-import-charlist__name">${char.name}</span>
              <span class="forja-import-charlist__meta">
                ${points} PC · ${date}
              </span>
            </div>
            <select class="forja-import-charlist__type">${selectOptions}</select>
          </label>
        `;
        items.append(itemHtml);
      }

      searchWrap.show();
      actions.show();
      html.find("input[name='selectAll']").prop("checked", false);
    } catch (err) {
      loading.hide();
      console.error("FORJA | Error loading characters:", err);
      ui.notifications.error(`${game.i18n.localize("FORJA.Import.ConnectionError")}: ${err.message}`);
    }
  }

  /* -------------------------------------------- */
  /*  Character Import Logic                       */
  /* -------------------------------------------- */

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

    // Create the actor (add incremental suffix if name already exists)
    let actorName = data.name || game.i18n.localize("FORJA.Import.UnnamedCharacter");
    const existingNames = new Set(game.actors.map(a => a.name));
    if (existingNames.has(actorName)) {
      let suffix = 2;
      while (existingNames.has(`${actorName} (${suffix})`)) suffix++;
      actorName = `${actorName} (${suffix})`;
    }

    const actor = await Actor.create({
      name: actorName,
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
      // First pass: normalize all traits and resolve duplicates (keep highest level)
      const traitMap = new Map(); // normalizedId → { normalizedId, level, variantCost, notes }
      for (const t of data.traits) {
        let normalizedId = this.normalizeId(t.traitId);
        let level = t.level ?? 0;

        // FORJAPP may append level to parametric trait IDs (e.g. "armaduraNatural2" → "armadura-natural2")
        // Strip trailing digits and use them as the level if no explicit level is set
        const levelSuffix = normalizedId.match(/^(.+?)[-]?(\d+)$/);
        if (levelSuffix && !level) {
          const baseId = levelSuffix[1];
          const suffixLevel = parseInt(levelSuffix[2]);
          // Only use suffix as level if the base ID exists in compendium
          const baseItem = await this.findCompendiumItem("traits", "traitId", baseId);
          if (baseItem) {
            normalizedId = baseId;
            level = suffixLevel;
          }
        }

        // Deduplicate: keep the entry with the highest level
        const existing = traitMap.get(normalizedId);
        if (!existing || level > (existing.level ?? 0)) {
          traitMap.set(normalizedId, { normalizedId, level, variantCost: t.variantCost, notes: t.notes });
        }
      }

      // Second pass: create items from deduplicated traits
      for (const [, t] of traitMap) {
        let compItem = await this.findCompendiumItem("traits", "traitId", t.normalizedId);
        if (compItem) {
          const itemData = compItem.toObject();
          if (t.level) itemData.system.level = t.level;
          if (t.variantCost != null) itemData.system.variantCost = t.variantCost;
          if (t.notes) itemData.system.notes = t.notes;
          delete itemData._id;
          items.push(itemData);
        } else {
          items.push({
            name: t.normalizedId,
            type: "trait",
            system: {
              traitId: t.normalizedId,
              traitType: "positive",
              category: "general",
              cost: 0,
              level: t.level,
              notes: t.notes ?? ""
            }
          });
        }
      }
    }

    // --- Natural Weapons (always added; derived from CONFIG.FORJA + traits) ---
    // "Cop" is always available to all actors; additional natural weapons come from traits.
    // These are created as real weapon items so they appear in the combat tracker.
    {
      const naturalDefs = CONFIG.FORJA?.naturalWeaponTraits ?? {};
      const copDef = CONFIG.FORJA?.copWeapon ?? { id: "cop", nameKey: "FORJA.Natural.Cop", damage: "FOR+1", latencyMod: 0, reach: "0", attackType: "brawl" };

      const makNaturalItem = (def) => ({
        name: game.i18n.localize(def.nameKey) || def.id,
        type: "weapon",
        system: {
          weaponType: "natural",
          attackType: def.attackType ?? "natural",
          latencyMod: def.latencyMod ?? 0,
          reach: def.reach ?? "0",
          range: "",
          damage: def.damage ?? "FOR+1",
          special: def.specialKey ? (game.i18n.localize(def.specialKey) || "") : "",
          quantity: 1,
          equipped: true
        }
      });

      // Always add Cop (unless actor already has a natural weapon with id "cop" in data.weapons)
      const hasNaturalCop = (data.weapons ?? []).some(w => w.attackType === "natural" && w.name?.toLowerCase() === "cop");
      if (!hasNaturalCop) {
        items.push(makNaturalItem(copDef));
      }

      // Add additional natural weapons from trait IDs present in this character
      const importedTraitIds = new Set((data.traits ?? []).map(t => this.normalizeId(t.traitId)));
      const addedNaturalIds = new Set(["cop"]);
      for (const [traitId, def] of Object.entries(naturalDefs)) {
        if (!importedTraitIds.has(traitId)) continue;
        if (addedNaturalIds.has(def.id)) continue;
        addedNaturalIds.add(def.id);
        items.push(makNaturalItem(def));
      }
    }

    // --- Weapons ---
    if (data.weapons?.length) {
      for (const w of data.weapons) {
        const name = w.customName || w.name || "Weapon";
        const weaponId = w.baseWeaponId ? this.normalizeId(w.baseWeaponId) : null;
        let compItem = null;
        if (weaponId) {
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
        let compItem = null;
        const pack = game.packs.get("forja.artifacts");
        if (pack) {
          const docs = await pack.getDocuments();
          // Try matching by artifactId (stored in flags.forja.sourceId) — works regardless of language
          if (a.artifactId) {
            compItem = docs.find(i => i.flags?.forja?.sourceId === a.artifactId) ?? null;
          }
          // Fallback: match by name (case-insensitive) — works if FORJAPP language matches compendium (Catalan)
          if (!compItem && a.name) {
            compItem = docs.find(i => i.name.toLowerCase() === a.name.toLowerCase()) ?? null;
          }
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
