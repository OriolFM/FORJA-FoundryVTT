/**
 * FORJA Combat Tracker enhancements.
 *
 * Uses Hooks to inject FORJA-specific UI into Foundry's default CombatTracker:
 * - Phase indicator + GM controls
 * - Minimal "Declare" button on each combatant row
 * - Declaration Dialog popup (opened on button click)
 * - Health bars + reaction counters
 * - Deferred movement interception (preUpdateToken hook) + canvas vector
 * - Full attack resolution: defense dialog (socket) → rolls → damage → re-declare
 *
 * Socket protocol: game.socket.on/emit("system.forja", { type, ... })
 *   defenseRequest:  { type, requestId, combatId, attackerCombatantId, targetCombatantId }
 *   defenseResponse: { type, requestId, defenseType, useReaction }
 */

const LOG  = (...args) => console.log("FORJA Combat |", ...args);
const WARN = (...args) => console.warn("FORJA Combat |", ...args);

/* ---------------------------------------- */
/*  Action configuration                    */
/* ---------------------------------------- */

const ACTION_LATENCY_MODS = {
  simple: 0,
  defensive: 0,
  movement: 0,
  special_movement: 2,
  concentrate: 0,
  other: 0
};

const ACTION_ICONS = {
  simple: "fa-sword",
  defensive: "fa-shield-alt",
  movement: "fa-running",
  special_movement: "fa-horse",
  concentrate: "fa-brain",
  other: "fa-ellipsis-h"
};

const DEFENSE_KEYS = {
  dodge: "FORJA.Combat.DefenseDodge",
  parry: "FORJA.Combat.DefenseParry",
  block: "FORJA.Combat.DefenseBlock",
  defend_other: "FORJA.Combat.DefenseOther"
};

/** FOR attribute key used for block's extra DR. */
const BLOCK_EXTRA_DR_ATTR = "FOR";

/** Pending socket defense requests: requestId → { resolve } */
const _pendingDefenseRequests = new Map();

/**
 * When a declaration dialog is open, this holds the dialog's root DOM element
 * so that clicking a tracker combatant row sets it as the target.
 * @type {HTMLElement|null}
 */
let _activeDeclarationRoot = null;

/**
 * Combatant ID whose declaration dialog is currently open.
 * Used to highlight the row and auto-fill hex count from drag.
 * @type {string|null}
 */
let _activeDeclarationCombatantId = null;

/** Map of combatantId → canvas Drawing ID for active resolution rings. */
const _activeRingIds = new Map();

/* ---------------------------------------- */
/*  Registration                            */
/* ---------------------------------------- */

/**
 * Register all combat tracker hooks. Called from forja.mjs init.
 */
export function registerCombatHooks() {
  LOG("Registering combat tracker hooks");
  Hooks.on("renderCombatTracker", _onRenderCombatTracker);
  Hooks.on("preUpdateToken", _onPreUpdateToken);
  Hooks.on("deleteCombat", _onDeleteCombat);
  Hooks.on("controlToken", _onControlToken);
  // Re-draw the declaration ring if Foundry refreshes the token while dialog is open
  Hooks.on("refreshToken", _onRefreshToken);
  // Socket handlers must be set up once Foundry is ready
  Hooks.once("ready", _registerSocketHandlers);
  LOG("Hooks registered: renderCombatTracker, preUpdateToken, deleteCombat, controlToken, refreshToken, ready→socket");
}

/**
 * When a token is clicked on the canvas and a declaration dialog is open,
 * automatically set that token's combatant as the selected target.
 */
function _onControlToken(tokenObject, controlled) {
  if (!controlled || !_activeDeclarationRoot) return;
  const combat = game.combat;
  if (!combat) return;
  const tokenId = tokenObject.document?.id ?? tokenObject.id;
  const combatant = combat.combatants.find(c => c.tokenId === tokenId);
  if (!combatant) return;
  const targetSelect = _activeDeclarationRoot.querySelector("#declare-target");
  if (!targetSelect) return;
  const options = Array.from(targetSelect.options);
  if (!options.some(o => o.value === combatant.id)) return; // not a selectable target
  targetSelect.value = combatant.id;
  // Visual feedback on the tracker row
  document.querySelectorAll(".combatant.forja-target-selected")
    .forEach(r => r.classList.remove("forja-target-selected"));
  document.querySelector(`.combatant[data-combatant-id="${combatant.id}"]`)
    ?.classList.add("forja-target-selected");
  LOG(`Target selected via token click: ${combatant.name}`);
}

/* ---------------------------------------- */
/*  Socket handlers                         */
/* ---------------------------------------- */

function _registerSocketHandlers() {
  game.socket.on("system.forja", _onSocketMessage);
  LOG("Socket handler registered for system.forja");
}

/**
 * Called when a Combat document is deleted.
 * Cleans up all FORJA canvas drawings (movement vectors + active rings).
 */
async function _onDeleteCombat(combat) {
  LOG("Combat deleted, clearing all FORJA drawings");
  // Clear active resolution rings
  await clearActiveRings();
  // Clear movement vector drawings for all combatants
  if (combat?.combatants) {
    for (const combatant of combat.combatants) {
      await _clearMovementVector(combatant);
    }
  }
  // Fallback: delete any remaining FORJA-tagged drawings from the scene
  // (Use .contents to get a plain Array from Foundry's DocumentCollection)
  if (canvas?.scene) {
    const forjaDrawings = (canvas.scene.drawings?.contents ?? [])
      .filter(d => d.flags?.forja)
      .map(d => d.id)
      .filter(Boolean);
    if (forjaDrawings.length > 0) {
      try {
        await canvas.scene.deleteEmbeddedDocuments("Drawing", forjaDrawings);
        LOG(`Cleared ${forjaDrawings.length} remaining FORJA drawings from scene`);
      } catch (err) { WARN("Could not clear FORJA drawings on combat end:", err); }
    }
  }
}

async function _onSocketMessage(data) {
  switch (data.type) {
    case "defenseRequest":
      await _handleIncomingDefenseRequest(data);
      break;
    case "defenseResponse":
      _handleDefenseResponse(data);
      break;
  }
}

/**
 * Received by the TARGET's owner: show defense dialog and emit response.
 */
async function _handleIncomingDefenseRequest(data) {
  const combat = game.combats.get(data.combatId);
  if (!combat) return;
  const targetCombatant = combat.combatants.get(data.targetCombatantId);
  if (!targetCombatant) return;
  // Only handle if this user owns the target
  if (!targetCombatant.isOwner && !game.user.isGM) return;

  const attackerCombatant = combat.combatants.get(data.attackerCombatantId);
  LOG(`Incoming defense request: ${attackerCombatant?.name} → ${targetCombatant.name}`);

  const result = await _showLocalDefenseDialog(attackerCombatant, targetCombatant);
  game.socket.emit("system.forja", {
    type: "defenseResponse",
    requestId: data.requestId,
    defenseType: result?.type ?? "basic",
    useReaction: result?.useReaction ?? false
  });
}

/**
 * Received by the ATTACKER's client: resolve the pending promise.
 */
function _handleDefenseResponse(data) {
  const pending = _pendingDefenseRequests.get(data.requestId);
  if (!pending) return;
  _pendingDefenseRequests.delete(data.requestId);
  pending.resolve({ type: data.defenseType, useReaction: data.useReaction });
}

/* ---------------------------------------- */
/*  Hook: renderCombatTracker               */
/* ---------------------------------------- */

async function _onRenderCombatTracker(app, html, data) {
  const combat = data.combat ?? game.combat;
  if (!combat) return;
  if (!combat.started) return;

  const root = html[0] ?? html;
  const tracker = root.querySelector("#combat-tracker") ?? root;
  // Ensure our CSS selectors (.forja-combat-tracker .combatant) apply to Foundry's default tracker element
  tracker.classList.add("forja-combat-tracker");

  const phase = combat.phase ?? "idle";
  const resolvingIds = combat.resolvingIds ?? [];
  LOG("Render:", { phase, combatants: combat.combatants.size, resolving: resolvingIds.length });

  _injectPhaseIndicator(root, tracker, combat, phase);
  _injectDeclarationSections(root, tracker, combat, phase);

  // Build ordinal rank map: rank 1 = acts first, based on declared position
  const rankMap = {};
  const declared = [...combat.combatants].filter(c => c.declaredAction && c.position > 0);
  declared.sort((a, b) => a.position - b.position);
  declared.forEach((c, i) => { rankMap[c.id] = i + 1; });

  const combatantRows = tracker.querySelectorAll(".combatant");
  for (const row of combatantRows) {
    const combatantId = row.dataset.combatantId;
    if (!combatantId) continue;
    const combatant = combat.combatants.get(combatantId);
    if (!combatant?.actor) continue;
    _enhanceCombatantRow(row, combatant, combat, phase, resolvingIds, rankMap);
  }

  _activateListeners(root, combat);
}

/* ---------------------------------------- */
/*  Phase Indicator                         */
/* ---------------------------------------- */

function _injectPhaseIndicator(root, tracker, combat, phase) {
  root.querySelector(".forja-combat-header")?.remove();
  if (phase === "idle") return;

  const header = document.createElement("div");
  header.classList.add("forja-combat-header");

  // Round counter
  const roundDiv = document.createElement("div");
  roundDiv.classList.add("forja-round-counter");
  roundDiv.innerHTML = `<i class="fas fa-hourglass-half"></i> ${game.i18n.localize("FORJA.Combat.Round")} ${combat.round}`;
  header.appendChild(roundDiv);

  const phaseConfig = {
    declaration:        { icon: "fa-scroll",     key: "FORJA.Combat.PhaseDeclaration" },
    ambush_declaration: { icon: "fa-eye-slash",  key: "FORJA.Combat.PhaseAmbush" },
    resolution:         { icon: "fa-crosshairs", key: "FORJA.Combat.PhaseResolution" },
    ambush_resolution:  { icon: "fa-crosshairs", key: "FORJA.Combat.PhaseResolution" }
  };
  const cfg = phaseConfig[phase];
  if (cfg) {
    const phaseDiv = document.createElement("div");
    phaseDiv.classList.add("forja-combat-phase");
    phaseDiv.innerHTML = `<i class="fas ${cfg.icon}"></i> ${game.i18n.localize(cfg.key)}`;
    header.appendChild(phaseDiv);
  }

  if (combat.isAmbush) {
    const badge = document.createElement("div");
    badge.classList.add("forja-ambush-badge");
    badge.innerHTML = `<i class="fas fa-eye-slash"></i> ${game.i18n.localize("FORJA.Combat.AmbushActive")}`;
    header.appendChild(badge);
  }

  if (game.user.isGM) {
    const controls = document.createElement("div");
    controls.classList.add("forja-combat-controls");
    if (phase === "declaration" || phase === "ambush_declaration") {
      const allDeclared = combat.allDeclared;
      controls.innerHTML = `
        <button type="button" class="forja-combat-controls__btn" data-action="forja-advance" ${allDeclared ? "" : "disabled"}>
          <i class="fas fa-forward"></i> ${game.i18n.localize("FORJA.Combat.Advance")}
        </button>`;
    } else if (phase === "resolution" || phase === "ambush_resolution") {
      controls.innerHTML = `
        <button type="button" class="forja-combat-controls__btn" data-action="forja-finish">
          <i class="fas fa-check-double"></i> ${game.i18n.localize("FORJA.Combat.FinishResolution")}
        </button>`;
    }
    header.appendChild(controls);
  }

  const pending = combat.pendingDamage ?? [];
  if (pending.length > 0) {
    const damageDiv = document.createElement("div");
    damageDiv.classList.add("forja-pending-damage");
    const entries = pending.map(p => {
      const name = combat.combatants.get(p.targetId)?.name ?? "?";
      return `<span class="forja-pending-damage__entry">${name}: ${p.amount}</span>`;
    }).join("");
    damageDiv.innerHTML = `<span class="forja-pending-damage__label"><i class="fas fa-tint"></i> ${game.i18n.localize("FORJA.Combat.PendingDamage")}:</span> ${entries}`;
    header.appendChild(damageDiv);
  }

  if (tracker !== root && tracker.parentNode) {
    tracker.parentNode.insertBefore(header, tracker);
  } else {
    root.prepend(header);
  }
}

/* ---------------------------------------- */
/*  Declaration / Resolution Sections      */
/* ---------------------------------------- */

/**
 * During the declaration phase, inject two mini-sections above the tracker list:
 *   1. "Ordre d'actuació" — already declared, sorted by position ascending (acts first → top)
 *   2. "Pendent de declarar" — not yet declared, sorted by latency descending (declares next → top)
 */
function _injectDeclarationSections(root, tracker, combat, phase) {
  root.querySelector(".forja-declaration-sections")?.remove();
  if (phase !== "declaration" && phase !== "ambush_declaration") return;

  const all = combat.combatants.contents.filter(c => !c.defeated);

  const declaredOrder = all
    .filter(c => c.declaredAction)
    .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));

  const pendingDeclaration = all
    .filter(c => !c.declaredAction)
    .sort((a, b) => {
      const latA = a.actor?.system?.latency ?? 10;
      const latB = b.actor?.system?.latency ?? 10;
      return latB - latA; // highest latency first (declares next)
    });

  if (!declaredOrder.length && !pendingDeclaration.length) return;

  const wrapper = document.createElement("div");
  wrapper.classList.add("forja-declaration-sections");

  const _makeRow = (c, showPosition) => {
    const pos = c.getFlag("forja", "position") ?? 0;
    const lat = c.actor?.system?.latency ?? "?";
    const icon = c.declaredAction?.icon ?? null;
    return `
      <div class="forja-section-row" data-combatant-id="${c.id}">
        <img src="${c.img ?? "icons/svg/mystery-man.svg"}" title="${c.name}" />
        <span class="forja-section-row__name">${c.name}</span>
        ${showPosition
          ? `<span class="forja-section-row__badge forja-section-row__badge--pos" title="${game.i18n.localize("FORJA.Derived.Latency")}">${pos}</span>`
          : `<span class="forja-section-row__badge" title="${game.i18n.localize("FORJA.Derived.Latency")}">Lat. ${lat}</span>`
        }
        ${icon ? `<i class="fas ${icon} forja-section-row__action-icon"></i>` : ""}
      </div>`;
  };

  if (declaredOrder.length) {
    wrapper.innerHTML += `
      <div class="forja-section forja-section--declared">
        <div class="forja-section__title"><i class="fas fa-crosshairs"></i> ${game.i18n.localize("FORJA.Combat.ResolutionOrder")}</div>
        ${declaredOrder.map(c => _makeRow(c, true)).join("")}
      </div>`;
  }

  if (pendingDeclaration.length) {
    wrapper.innerHTML += `
      <div class="forja-section forja-section--pending">
        <div class="forja-section__title"><i class="fas fa-scroll"></i> ${game.i18n.localize("FORJA.Combat.PendingDeclaration")}</div>
        ${pendingDeclaration.map(c => _makeRow(c, false)).join("")}
      </div>`;
  }

  if (tracker !== root && tracker.parentNode) {
    tracker.parentNode.insertBefore(wrapper, tracker);
  } else {
    tracker.before(wrapper);
  }
}

/* ---------------------------------------- */
/*  Combatant Row Enhancement               */
/* ---------------------------------------- */

function _enhanceCombatantRow(row, combatant, combat, phase, resolvingIds, rankMap = {}) {
  const sys = combatant.actor.system;
  const isResolving = resolvingIds.includes(combatant.id);
  const declaredAction = combatant.declaredAction;

  row.classList.add(combatant.side ?? "players");
  if (isResolving) row.classList.add("forja-resolving");
  if (_activeDeclarationCombatantId && combatant.id === _activeDeclarationCombatantId) {
    row.classList.add("forja-declaring-active");
  }

  // --- Position number + ordinal rank ---
  const initEl = row.querySelector(".token-initiative");
  if (initEl) {
    const position = combatant.position ?? 0;
    const rank = rankMap[combatant.id];
    if (declaredAction && position > 0) {
      const rankBadge = rank ? `<span class="forja-combatant-rank">#${rank}</span>` : "";
      initEl.innerHTML = `<span class="forja-combat-position ${isResolving ? "forja-combat-position--resolving" : ""}" title="${game.i18n.localize("FORJA.Derived.Latency")}: ${sys.latency ?? 10}">${position}${rankBadge}</span>`;
    } else {
      initEl.innerHTML = `<span class="forja-combat-position forja-combat-position--pending" title="${game.i18n.localize("FORJA.Derived.Latency")} base: ${sys.latency ?? 10}">—</span>`;
    }
  }

  // --- Declared action icon ---
  if (declaredAction && !row.querySelector(".forja-declared-action")) {
    const actionEl = document.createElement("span");
    actionEl.classList.add("forja-declared-action");
    actionEl.title = declaredAction.description || declaredAction.type;
    actionEl.innerHTML = `<i class="fas ${declaredAction.icon ?? "fa-question"}"></i>`;
    const nameEl = row.querySelector(".token-name") ?? row.querySelector(".combatant-name");
    if (nameEl) nameEl.appendChild(actionEl);
  }

  // --- Pending move indicator (with hex progress) ---
  const pendingMove = combatant.getFlag("forja", "pendingMove");
  if (pendingMove) {
    row.querySelector(".forja-pending-move")?.remove(); // refresh each render
    const hexesMoved = pendingMove.hexesMoved ?? 0;
    const maxHex = declaredAction?.hexCount ?? 0;
    const hexText = maxHex > 0 ? `${hexesMoved}/${maxHex}` : `${hexesMoved}`;
    const moveEl = document.createElement("span");
    moveEl.classList.add("forja-pending-move");
    moveEl.title = game.i18n.localize("FORJA.Combat.MovementDeferred");
    moveEl.innerHTML = `<i class="fas fa-location-arrow"></i> ${hexText}`;
    const nameEl = row.querySelector(".token-name") ?? row.querySelector(".combatant-name");
    if (nameEl) nameEl.appendChild(moveEl);
  }

  // --- Health bars ---
  if (!row.querySelector(".forja-health-bars")) {
    const woundsMax = sys.health?.wounds?.max ?? 0;
    const fatigueMax = sys.health?.fatigue?.max ?? 0;
    const woundsPercent = woundsMax ? Math.round(((sys.health?.wounds?.value ?? 0) / woundsMax) * 100) : 0;
    const fatiguePercent = fatigueMax ? Math.round(((sys.health?.fatigue?.value ?? 0) / fatigueMax) * 100) : 0;
    if (woundsPercent > 0 || fatiguePercent > 0) {
      const healthEl = document.createElement("div");
      healthEl.classList.add("forja-health-bars");
      if (woundsPercent > 0) healthEl.innerHTML += `<div class="health-bar wounds-bar" title="${game.i18n.localize("FORJA.Health.Wounds")}"><div class="bar-fill" style="width:${woundsPercent}%"></div></div>`;
      if (fatiguePercent > 0) healthEl.innerHTML += `<div class="health-bar fatigue-bar" title="${game.i18n.localize("FORJA.Health.Fatigue")}"><div class="bar-fill" style="width:${fatiguePercent}%"></div></div>`;
      row.appendChild(healthEl);
    }
  }

  // --- Reactions ---
  if (!row.querySelector(".forja-reactions")) {
    const maxReactions = combatant.maxReactions;
    const reactionsAvail = maxReactions - combatant.reactionsUsed;
    const reactEl = document.createElement("div");
    reactEl.classList.add("forja-reactions");
    for (let i = 0; i < maxReactions; i++) {
      const cls = i < reactionsAvail ? "forja-reactions--available" : "forja-reactions--used";
      reactEl.innerHTML += `<i class="fas fa-shield-alt ${cls}"></i>`;
    }
    const isResolutionPhase = phase === "resolution" || phase === "ambush_resolution";
    if (isResolutionPhase && !isResolving && combatant.canReact && !combatant.defeated
        && (game.user.isGM || combatant.isOwner)) {
      reactEl.innerHTML += `<button type="button" class="forja-reactions__use-btn" data-action="forja-react" data-combatant-id="${combatant.id}" title="${game.i18n.localize("FORJA.Combat.UseReaction")}"><i class="fas fa-shield-alt"></i></button>`;
    }
    row.appendChild(reactEl);
  }

  // --- Declare button ---
  const canDeclareInPhase = phase === "declaration" || phase === "ambush_declaration";
  const shouldDeclare = combat._shouldDeclare(combatant, phase);
  const isNextToDeclare = canDeclareInPhase && shouldDeclare && !declaredAction
    && !combatant.defeated && (game.user.isGM || combatant.isOwner);

  if (isNextToDeclare && !row.querySelector(".forja-declare-btn")) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("forja-declare-btn");
    btn.dataset.action = "forja-open-declare";
    btn.dataset.combatantId = combatant.id;
    btn.innerHTML = `<i class="fas fa-scroll"></i> ${game.i18n.localize("FORJA.Combat.Declare")}`;

    const declarationOrder = combat.getDeclarationOrder();
    if (declarationOrder[0] === combatant.id) {
      row.classList.add("forja-declaring");
    }
    row.appendChild(btn);
  }

  // --- Roll buttons for resolving combatants ---
  const isResolutionPhase = phase === "resolution" || phase === "ambush_resolution";
  if (isResolving && isResolutionPhase && declaredAction
      && !row.querySelector(".forja-roll-actions")
      && (game.user.isGM || combatant.isOwner)) {
    const rollDiv = document.createElement("div");
    rollDiv.classList.add("forja-roll-actions");

    const attackRolled = combatant.getFlag("forja", "attackRolled");

    if (declaredAction.type === "simple") {
      if (attackRolled) {
        rollDiv.innerHTML = `<span class="forja-roll-done"><i class="fas fa-check-circle"></i> ${game.i18n.localize("FORJA.Combat.AttackRolled")}</span>`;
      } else {
        rollDiv.innerHTML = `<button type="button" class="forja-roll-btn" data-action="forja-roll-attack" data-combatant-id="${combatant.id}" data-weapon-id="${declaredAction.weaponId ?? ""}" data-target-id="${declaredAction.targetId ?? ""}">
          <i class="fas fa-dice-d10"></i> ${game.i18n.localize("FORJA.Combat.RollAttack")}
        </button>`;
      }
    } else if (declaredAction.type === "defensive") {
      const preRolledFites = combatant.getFlag("forja", "preRolledDefenseFites");
      const defenseLabel = game.i18n.localize(DEFENSE_KEYS[declaredAction.defenseType] ?? "FORJA.Combat.DefenseDodge");
      if (preRolledFites != null) {
        rollDiv.innerHTML = `<span class="forja-roll-done forja-defense-ready" title="${defenseLabel}">
          <i class="fas fa-shield-alt"></i> ${defenseLabel}: ${preRolledFites} ●
        </span>`;
      } else {
        rollDiv.innerHTML = `<button type="button" class="forja-roll-btn forja-roll-btn--defense" data-action="forja-roll-defense" data-combatant-id="${combatant.id}" data-defense-type="${declaredAction.defenseType ?? "dodge"}">
          <i class="fas fa-dice-d10"></i> ${game.i18n.localize("FORJA.Combat.RollDefense")}
        </button>`;
      }
    }

    if (rollDiv.children.length > 0) row.appendChild(rollDiv);
  }

  // --- "Move now" button (resolution phase: apply pending move before/after action) ---
  const isResolutionPhaseForMove = phase === "resolution" || phase === "ambush_resolution";
  if (isResolving && isResolutionPhaseForMove && pendingMove
      && !row.querySelector(".forja-move-btn")
      && (game.user.isGM || combatant.isOwner)) {
    const moveBtn = document.createElement("button");
    moveBtn.type = "button";
    moveBtn.classList.add("forja-move-btn");
    moveBtn.dataset.action = "forja-apply-move";
    moveBtn.dataset.combatantId = combatant.id;
    moveBtn.innerHTML = `<i class="fas fa-location-arrow"></i> ${game.i18n.localize("FORJA.Combat.ApplyMovement")}`;
    row.appendChild(moveBtn);
  }
}

/* ---------------------------------------- */
/*  Declaration Dialog                      */
/* ---------------------------------------- */

async function _openDeclarationDialog(combatant, combat) {
  const sys = combatant.actor.system;
  const baseLatency = sys.latency ?? 10;
  const currentPosition = combatant.position ?? 0;

  const weapons = combatant.actor.items
    .filter(i => i.type === "weapon")
    .map(w => ({
      id: w.id,
      name: w.name,
      latencyMod: w.system.latencyMod ?? 0
    }));

  // Also include weapon-type artifacts (cat: "weapon" or has baseWeapon / damageValue set).
  // These use the base weapon's latencyMod + artifact's latencyMod as combined attack latency.
  for (const art of combatant.actor.items) {
    if (art.type !== "artifact") continue;
    if (!art.system.damageValue && !art.system.baseWeapon) continue; // not a weapon artifact
    const base = CONFIG.FORJA.weaponBaseStats[art.system.baseWeapon] ?? null;
    const latencyMod = (base?.latencyMod ?? 0) + (art.system.latencyMod ?? 0);
    weapons.push({
      id: art.id,
      name: art.name,
      latencyMod,
      isArtifactWeapon: true
    });
  }

  // Fallback: if no weapons at all (actor not yet imported or is a bare-bones combatant),
  // add a virtual natural attack option so the combat tracker always has something to roll.
  if (weapons.length === 0) {
    weapons.unshift({
      id: "__natural__",
      name: game.i18n.localize("FORJA.Combat.NaturalAttack"),
      latencyMod: 0,
      isNatural: true
    });
  }

  // Build target list with numbered names for duplicates ("Gòlem de carn 1", "Gòlem de carn 2")
  const allCombatants = [...combat.combatants];
  const nameTotal = {};
  for (const c of allCombatants) nameTotal[c.name] = (nameTotal[c.name] ?? 0) + 1;
  const nameIndex = {};
  const targets = allCombatants
    .filter(c => !c.defeated && c.id !== combatant.id)
    .map(c => {
      nameIndex[c.name] = (nameIndex[c.name] ?? 0) + 1;
      const displayName = nameTotal[c.name] > 1 ? `${c.name} ${nameIndex[c.name]}` : c.name;
      return { id: c.id, name: displayName };
    });

  const agi = sys.attributes?.AGI?.value ?? 0;
  const size = sys.size ?? 0;
  const walkHexes = (agi * 2) + size;
  const runHexes  = (agi * 4) + size;

  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/forja/templates/combat/declare-action-dialog.hbs",
    {
      img: combatant.img ?? combatant.actor?.img ?? "icons/svg/mystery-man.svg",
      name: combatant.name,
      baseLatency,
      currentPosition: currentPosition > 0 ? currentPosition : null,
      weapons,
      targets,
      walkHexes,
      runHexes
    }
  );

  return new Promise(resolve => {
    const _clearDeclareActive = () => {
      // Clear PIXI ring before nulling the ID
      if (_activeDeclarationCombatantId) _clearDeclaringRing(_activeDeclarationCombatantId);
      _activeDeclarationRoot = null;
      _activeDeclarationCombatantId = null;
      document.querySelector("#combat-tracker")?.classList.remove("forja-select-target-mode");
      document.querySelectorAll(".combatant.forja-declaring-active")
        .forEach(r => r.classList.remove("forja-declaring-active"));
    };

    const dialog = new Dialog({
      title: game.i18n.format("FORJA.Combat.DeclareFor", { name: combatant.name }),
      content,
      render: (html) => {
        const root = html[0] ?? html;
        _setupDeclarationDialogListeners(html, weapons, baseLatency, currentPosition);
        // Enable click-to-target mode on the tracker
        _activeDeclarationRoot = root;
        _activeDeclarationCombatantId = combatant.id;
        document.querySelector("#combat-tracker")?.classList.add("forja-select-target-mode");
        // Highlight the declaring combatant row directly
        document.querySelector(`.combatant[data-combatant-id="${combatant.id}"]`)
          ?.classList.add("forja-declaring-active");
        // Draw teal PIXI ring on the declaring token (local client)
        _drawDeclaringRing(combatant.id);
        // Show hint if there are selectable targets
        if (targets.length > 0) {
          const hint = root.querySelector(".forja-target-hint");
          if (hint) hint.style.display = "";
        }
      },
      buttons: {
        declare: {
          icon: '<i class="fas fa-check"></i>',
          label: game.i18n.localize("FORJA.Combat.Declare"),
          callback: async (html) => {
            // Read from the live DOM root (_activeDeclarationRoot) BEFORE clearing it.
            // Foundry v13 may pass a freshly re-rendered 'html' to the callback (losing
            // user selections), whereas _activeDeclarationRoot always points to the
            // actual live DOM element where the user made their selections.
            const liveRoot = _activeDeclarationRoot ?? (html[0] ?? html);
            _clearDeclareActive();
            const result = _readDeclarationDialogValues(liveRoot, combatant, weapons);
            if (result) {
              LOG(`${combatant.name} declares via dialog:`, result);
              await combatant.declareAction(result);
              // Pre-roll defense at declaration time so the value is fixed until next action
              if (result.type === "defensive") {
                const basicFites = combatant.actor?.system?.defense ?? 0;
                if (result.defenseType === "block") {
                  // Block: no dice roll, static defense value
                  await combatant.setFlag("forja", "preRolledDefenseFites", basicFites);
                } else {
                  const rollResult = await combatant.actor.rollDefense(result.defenseType);
                  const rolledFites = Math.max(basicFites, rollResult?.fites ?? 0);
                  await combatant.setFlag("forja", "preRolledDefenseFites", rolledFites);
                  LOG(`${combatant.name} pre-rolled ${result.defenseType} defense: ${rolledFites} fites`);
                }
              }
            }
            resolve(result);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize("Cancel"),
          callback: () => {
            _clearDeclareActive();
            resolve(null);
          }
        }
      },
      default: "declare",
      close: () => _clearDeclareActive()
    }, { classes: ["dialog", "forja-dialog"], width: 420 });
    dialog.render(true);
  });
}

function _setupDeclarationDialogListeners(html, weapons, baseLatency, currentPosition) {
  const root = html[0] ?? html;
  const actionSel   = root.querySelector("#declare-action");
  const weaponSel   = root.querySelector("#declare-weapon");
  const targetSel   = root.querySelector("#declare-target");
  const defenseOpts = root.querySelector("#forja-defense-opts");
  const weaponOpts  = root.querySelector("#forja-weapon-opts");
  const targetOpts  = root.querySelector("#forja-target-opts");
  const posPreview  = root.querySelector("#declare-position-value");
  const hexRow      = root.querySelector("#forja-hex-counter-row");
  const hexInput    = root.querySelector("#declare-hex-count");
  const hexMax      = root.querySelector("#forja-hex-max");

  const weaponMods = {};
  for (const w of weapons) weaponMods[w.id] = w.latencyMod;

  function updateMoveCounter() {
    const selected = root.querySelector("input[name='moveType']:checked")?.value ?? "none";
    if (hexRow) hexRow.style.display = (selected === "none") ? "none" : "";
    if (hexInput && hexMax) {
      const maxVal = selected === "run"
        ? Number(hexInput.dataset.run ?? 1)
        : Number(hexInput.dataset.walk ?? 1);
      hexInput.max = maxVal;
      hexMax.textContent = `/ ${maxVal}`;
      if (Number(hexInput.value) > maxVal) hexInput.value = maxVal;
      if (Number(hexInput.value) < 1) hexInput.value = 1;
    }
    // Running: force action type to "movement" and disable other options
    if (selected === "run") {
      if (actionSel) {
        actionSel.value = "movement";
        for (const opt of actionSel.options) {
          opt.disabled = (opt.value !== "movement" && opt.value !== "special_movement");
        }
      }
    } else {
      // Re-enable all action options when not running
      if (actionSel) {
        for (const opt of actionSel.options) opt.disabled = false;
      }
    }
    updatePreview();
  }

  function updatePreview() {
    const actionType = actionSel?.value ?? "simple";
    const actionMod  = ACTION_LATENCY_MODS[actionType] ?? 0;
    const weaponMod  = weaponSel?.value ? (weaponMods[weaponSel.value] ?? 0) : 0;
    const base  = currentPosition > 0 ? currentPosition : baseLatency;
    const total = Math.max(1, base + actionMod + weaponMod);
    if (posPreview) posPreview.textContent = total;

    if (defenseOpts) defenseOpts.style.display = (actionType === "defensive") ? "" : "none";
    if (weaponOpts) {
      const hide = actionType === "defensive" || actionType === "movement" || actionType === "special_movement" || actionType === "concentrate";
      weaponOpts.style.display = hide ? "none" : "";
      if (weaponSel) weaponSel.disabled = hide;
    }
    if (targetOpts) {
      const hide = actionType === "defensive";
      targetOpts.style.display = hide ? "none" : "";
      if (targetSel) targetSel.disabled = hide;
    }

    // If non-movement action is selected while run radio is checked, switch to walk
    const moveType = root.querySelector("input[name='moveType']:checked")?.value ?? "none";
    const isMovementAction = actionType === "movement" || actionType === "special_movement";
    if (moveType === "run" && !isMovementAction) {
      const walkRadio = root.querySelector("input[name='moveType'][value='walk']");
      if (walkRadio) { walkRadio.checked = true; updateMoveCounter(); return; }
    }
  }

  root.querySelectorAll("input[name='moveType']").forEach(r => {
    r.addEventListener("change", updateMoveCounter);
  });
  actionSel?.addEventListener("change", updatePreview);
  weaponSel?.addEventListener("change", updatePreview);
  updatePreview();
  updateMoveCounter();
}

function _readDeclarationDialogValues(htmlOrRoot, combatant, weapons) {
  // Accept either a plain DOM element (from liveRoot capture) or a jQuery-like wrapper
  const root = htmlOrRoot?.nodeType ? htmlOrRoot : (htmlOrRoot?.[0] ?? htmlOrRoot);
  const actionType  = root.querySelector("#declare-action")?.value ?? "simple";
  const weaponId    = root.querySelector("#declare-weapon")?.value ?? "";
  const defenseType = root.querySelector("#declare-defense-type")?.value ?? null;
  const targetId    = root.querySelector("#declare-target")?.value ?? "";
  const moveType    = root.querySelector("input[name='moveType']:checked")?.value ?? "none";
  const hexInput    = root.querySelector("#declare-hex-count");
  const hexCount    = moveType !== "none" && hexInput ? Math.max(1, Number(hexInput.value) || 1) : 0;
  const description = root.querySelector("#declare-desc")?.value ?? "";

  let latencyMod = ACTION_LATENCY_MODS[actionType] ?? 0;
  if (weaponId) {
    const weapon = weapons.find(w => w.id === weaponId);
    if (weapon) latencyMod += weapon.latencyMod;
  }

  const defenseLabel = defenseType ? game.i18n.localize(DEFENSE_KEYS[defenseType] ?? defenseType) : null;
  const fullDescription = [defenseLabel, description].filter(Boolean).join(": ");

  return {
    type: actionType,
    weaponId,
    defenseType: actionType === "defensive" ? defenseType : null,
    targetId: targetId || null,
    moveType,
    hexCount,
    description: fullDescription,
    latencyModifier: latencyMod,
    icon: ACTION_ICONS[actionType] ?? "fa-question"
  };
}

/* ---------------------------------------- */
/*  Defense Dialog                          */
/* ---------------------------------------- */

/**
 * Show the local defense dialog (for target's owner or GM).
 * @returns {Promise<{type: string, useReaction: boolean}|null>}
 */
async function _showLocalDefenseDialog(attackerCombatant, targetCombatant) {
  const targetSys    = targetCombatant.actor.system;
  const defenseValue = targetSys.defense ?? 0;
  const agiValue     = targetSys.attributes?.AGI?.value ?? 0;
  const desValue     = targetSys.attributes?.DES?.value ?? 0;
  const forValue     = targetSys.attributes?.FOR?.value ?? 0;
  const canReact     = targetCombatant.canReact;
  const reactionsLeft = targetCombatant.maxReactions - targetCombatant.reactionsUsed;

  // Pre-compute block DR for the dialog hint
  const hasMeleeWeapon = [...(targetCombatant.actor?.items ?? [])].some(i =>
    i.type === "weapon" && i.system?.weaponType === "melee"
  );
  let blockDRValue = forValue;
  let blockDRLabel = `FOR ${forValue}`;
  if (hasMeleeWeapon) {
    let aCoCLevel = 0;
    for (const item of (targetCombatant.actor?.items ?? [])) {
      if (item.type === "skill" && item.system.skillId === "armes-cos-a-cos") {
        aCoCLevel = item.system.level ?? 0;
        break;
      }
    }
    blockDRValue = aCoCLevel;
    blockDRLabel = `CaC ${aCoCLevel}`;
  }

  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/forja/templates/combat/defense-dialog.hbs",
    {
      attackerName: attackerCombatant?.name ?? "?",
      attackerImg: attackerCombatant?.img ?? attackerCombatant?.actor?.img ?? "icons/svg/mystery-man.svg",
      defenderName: targetCombatant.name,
      defenderImg: targetCombatant.img ?? targetCombatant.actor?.img ?? "icons/svg/mystery-man.svg",
      defenseValue,
      agiValue,
      desValue,
      forValue,
      blockDRLabel,
      canReact,
      reactionsLeft,
      maxReactions: targetCombatant.maxReactions
    }
  );

  return new Promise(resolve => {
    const dialog = new Dialog({
      title: game.i18n.format("FORJA.Combat.ChooseDefense", { name: targetCombatant.name }),
      content,
      render: (html) => {
        const root = html[0] ?? html;
        const reactionCb = root.querySelector("#forja-use-reaction");
        const maneuverOpts = root.querySelector("#forja-active-defense-opts");
        if (reactionCb && maneuverOpts) {
          reactionCb.addEventListener("change", () => {
            maneuverOpts.style.display = reactionCb.checked ? "" : "none";
          });
        }
      },
      buttons: {
        confirm: {
          icon: '<i class="fas fa-shield-alt"></i>',
          label: game.i18n.localize("FORJA.Combat.Declare"),
          callback: (html) => {
            const root = html[0] ?? html;
            const useReaction = root.querySelector("#forja-use-reaction")?.checked ?? false;
            const defenseType = useReaction
              ? (root.querySelector("input[name='defenseType']:checked")?.value ?? "dodge")
              : "basic";
            resolve({ type: defenseType, useReaction });
          }
        },
        basic: {
          icon: '<i class="fas fa-shield"></i>',
          label: game.i18n.localize("FORJA.Combat.BasicDefense").replace(" ({dice} fites automàtiques)", "").replace(" ({dice} successes)", "").replace(" ({dice} aciertos)", ""),
          callback: () => resolve({ type: "basic", useReaction: false })
        }
      },
      default: "confirm"
    }, { classes: ["dialog", "forja-dialog"], width: 500, resizable: true });
    dialog.render(true);
  });
}

/* ---------------------------------------- */
/*  Attack Resolution Flow                  */
/* ---------------------------------------- */

/**
 * Request defense choice from target's owner.
 * - If target declared "defensive": use their declared defense type.
 * - If target can't react: basic defense.
 * - If this user owns/is GM: show dialog locally.
 * - Otherwise: emit socket request and wait for response (30s timeout).
 * @returns {Promise<{type: string, useReaction: boolean}>}
 */
async function _requestDefenseChoice(attackerCombatant, targetCombatant, combat) {
  if (!targetCombatant) {
    LOG("No target: skipping defense");
    return { type: "basic", useReaction: false };
  }

  // Target already declared defensive action → use their pre-rolled defense value
  if (targetCombatant.declaredAction?.type === "defensive") {
    const defenseType = targetCombatant.declaredAction.defenseType ?? "dodge";
    const preRolledFites = targetCombatant.getFlag("forja", "preRolledDefenseFites");
    LOG(`Target ${targetCombatant.name} already declared ${defenseType} (pre-rolled: ${preRolledFites})`);
    return { type: defenseType, useReaction: false, preRolled: true, preRolledFites };
  }

  // No reactions left → basic defense
  if (!targetCombatant.canReact) {
    LOG(`Target ${targetCombatant.name} has no reactions left: basic defense`);
    return { type: "basic", useReaction: false };
  }

  // Can show dialog locally (GM or owns target)
  if (game.user.isGM || targetCombatant.isOwner) {
    return await _showLocalDefenseDialog(attackerCombatant, targetCombatant);
  }

  // Need to ask target's owner via socket
  const requestId = foundry.utils.randomID();
  game.socket.emit("system.forja", {
    type: "defenseRequest",
    requestId,
    combatId: combat.id,
    attackerCombatantId: attackerCombatant.id,
    targetCombatantId: targetCombatant.id
  });
  LOG(`Emitted defenseRequest ${requestId} for ${targetCombatant.name}`);

  return new Promise(resolve => {
    const timeout = setTimeout(() => {
      _pendingDefenseRequests.delete(requestId);
      WARN(`Defense request ${requestId} timed out, using basic defense`);
      ui.notifications?.warn(game.i18n.localize("FORJA.Combat.DefenseRequestTimeout"));
      resolve({ type: "basic", useReaction: false });
    }, 30_000);

    _pendingDefenseRequests.set(requestId, {
      resolve: (result) => {
        clearTimeout(timeout);
        resolve(result);
      }
    });
  });
}

/**
 * Compute block extra DR for an actor (armes cos-a-cos level, or FOR unarmed).
 */
function _computeBlockDR(actor) {
  const forValue = actor?.system?.attributes?.[BLOCK_EXTRA_DR_ATTR]?.value ?? 0;
  const hasMeleeWeapon = [...(actor?.items ?? [])].some(i =>
    i.type === "weapon" && i.system?.weaponType === "melee"
  );
  if (hasMeleeWeapon) {
    let aCoCLevel = 0;
    for (const item of (actor?.items ?? [])) {
      if (item.type === "skill" && item.system.skillId === "armes-cos-a-cos") {
        aCoCLevel = item.system.level ?? 0;
        break;
      }
    }
    return aCoCLevel;
  }
  return forValue;
}

/**
 * Roll (or auto-compute) defense.
 * Returns { fites, extraDR } where extraDR is bonus damage reduction (only for block).
 * @param {{type: string, useReaction: boolean, preRolled?: boolean, preRolledFites?: number}} defenseResult
 * @param {ForjaCombatant} targetCombatant
 * @returns {Promise<{fites: number, extraDR: number}>}
 */
async function _rollDefense(defenseResult, targetCombatant) {
  if (!targetCombatant) return { fites: 0, extraDR: 0 };
  const defenseType = defenseResult.type ?? "basic";
  const basicFites = targetCombatant.actor?.system?.defense ?? 0;

  if (defenseType === "basic") {
    LOG(`Basic defense for ${targetCombatant.name}: ${basicFites} automatic fites`);
    return { fites: basicFites, extraDR: 0 };
  }

  // Pre-rolled at declaration time: use stored value (never below basic defense)
  if (defenseResult.preRolled && defenseResult.preRolledFites != null) {
    const fites = Math.max(basicFites, defenseResult.preRolledFites);
    if (defenseType === "block") {
      const blockDR = _computeBlockDR(targetCombatant.actor);
      LOG(`Pre-rolled block defense for ${targetCombatant.name}: ${fites} fites + ${blockDR} extra DR`);
      return { fites, extraDR: blockDR };
    }
    LOG(`Pre-rolled ${defenseType} defense for ${targetCombatant.name}: ${fites} fites (raw: ${defenseResult.preRolledFites})`);
    return { fites, extraDR: 0 };
  }

  if (defenseType === "block") {
    // Block: static defense + bonus DR (no dice roll, per FORJA manual)
    const blockDR = _computeBlockDR(targetCombatant.actor);
    LOG(`Block defense for ${targetCombatant.name}: ${basicFites} fites + ${blockDR} extra DR`);
    return { fites: basicFites, extraDR: blockDR };
  }

  // Active maneuver: dodge or parry — use actor.rollDefense()
  // Result can never be worse than basic defense (per FORJA rules)
  LOG(`Rolling ${defenseType} defense for ${targetCombatant.name}`);
  const result = await targetCombatant.actor.rollDefense(defenseType);
  return { fites: Math.max(basicFites, result?.fites ?? 0), extraDR: 0 };
}

/**
 * Parse weapon damage string ("FOR+1", "DES+2", "3") to a numeric base value.
 */
function _parseWeaponDamage(damageStr, actor) {
  if (!damageStr) return 0;
  const numOnly = damageStr.match(/^(\d+)$/);
  if (numOnly) return parseInt(numOnly[1]);
  const attrBonus = damageStr.match(/^([A-Z]+)([+-]\d+)?$/);
  if (attrBonus) {
    const attrVal = actor?.system?.attributes?.[attrBonus[1]]?.value ?? 0;
    const bonus = attrBonus[2] ? parseInt(attrBonus[2]) : 0;
    return attrVal + bonus;
  }
  return 0;
}

/**
 * Calculate final damage dealt using FORJA rules (armor vs DR separation).
 * If armor alone stops all damage: 0. If DR brings the remainder to 0: min 1.
 */
function _calcDamage(weaponItem, attackerActor, netHits, targetCombatant, { weaponBonus = 0, blockExtraDR = 0 } = {}) {
  const base = _parseWeaponDamage(weaponItem?.system?.damage ?? "", attackerActor);
  const totalRaw = base + weaponBonus + netHits;
  const protection = targetCombatant?.actor?.system?.protection ?? 0;
  const dr = (targetCombatant?.actor?.system?.damageReduction ?? 0) + blockExtraDR;
  const minimumDamage = 1 + weaponBonus;

  if (totalRaw <= protection) {
    LOG(`Damage calc: armor stops all (${totalRaw} <= ${protection}) → 0`);
    return 0;
  }
  const afterArmor = totalRaw - protection;
  const afterDR = afterArmor - dr;
  if (afterDR <= 0) {
    LOG(`Damage calc: DR reduces to 0 → minimum ${minimumDamage}`);
    return minimumDamage;
  }
  LOG(`Damage calc: base=${base}+bonus=${weaponBonus}+hits=${netHits} - prot=${protection} - DR=${dr} = ${afterDR}`);
  return afterDR;
}

/**
 * Return the effective range of a weapon in grid units (hexes/squares).
 * Uses reach for melee/natural, range for ranged.
 */
function _getWeaponRange(weapon) {
  if (!weapon) return 1; // natural/unarmed: adjacent only (1 hex reach)
  const weaponType = weapon.system?.weaponType ?? "melee";
  const rangeStr = weaponType === "ranged"
    ? (weapon.system?.range ?? "")
    : (weapon.system?.reach ?? "");
  const parsed = parseFloat(rangeStr);
  if (isNaN(parsed)) return weaponType === "ranged" ? 10 : 1;
  // reach "0" in FORJA means contact/adjacent — treat as 1 hex minimum for range checks
  return weaponType === "ranged" ? parsed : Math.max(1, parsed);
}

/**
 * Measure the grid distance between two token documents (center to center).
 */
function _measureTokenDistance(tokenA, tokenB) {
  if (!tokenA || !tokenB || !canvas?.grid) return 0;
  const gs = canvas.grid.size;
  const ax = tokenA.x + (tokenA.width ?? 1) * gs / 2;
  const ay = tokenA.y + (tokenA.height ?? 1) * gs / 2;
  const bx = tokenB.x + (tokenB.width ?? 1) * gs / 2;
  const by = tokenB.y + (tokenB.height ?? 1) * gs / 2;
  try {
    // v13 API: measurePath returns {distance, spaces}; spaces = count of grid steps (hexes)
    return canvas.grid.measurePath([{ x: ax, y: ay }, { x: bx, y: by }]).spaces ?? 0;
  } catch (e) {
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by)) / gs;
  }
}

/* ---------------------------------------- */
/*  Area-of-Effect Template Helpers         */
/* ---------------------------------------- */

/**
 * Show a PIXI interactive preview on the canvas so the player can choose the
 * direction (linear/angular) or center (circular) of an area template.
 * Resolves with the clicked pixel position {x, y}; rejects if Esc is pressed.
 *
 * @param {string} type          "linear" | "angular" | "circular"
 * @param {{x,y}}  fromPx        Attacker center in canvas world coords
 * @param {number} rangeHexes    Max range in hexes (used for linear/angular)
 * @param {number} templateSize  Radius in hexes (used for circular)
 * @returns {Promise<{x,y}>}
 */
function _placeAreaTemplate(type, fromPx, rangeHexes, templateSize) {
  const gs = canvas.grid?.size ?? 100;
  const maxPixels = rangeHexes * gs;

  const preview = new PIXI.Graphics();
  preview.eventMode = "none";
  canvas.stage.addChild(preview);

  const TEAL_FILL   = 0x0d9488;
  const GOLD_STROKE = 0xffcc00;

  function drawPreview(pos) {
    try { preview.clear(); } catch (_) { return; }
    const dx = pos.x - fromPx.x;
    const dy = pos.y - fromPx.y;
    const rawDist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    if (type === "linear") {
      const clamped = Math.min(rawDist, maxPixels);
      const ex = fromPx.x + Math.cos(angle) * clamped;
      const ey = fromPx.y + Math.sin(angle) * clamped;
      const perp = angle + Math.PI / 2;
      const hw = gs * 0.5;
      const pts = [
        fromPx.x + Math.cos(perp) * hw, fromPx.y + Math.sin(perp) * hw,
        ex       + Math.cos(perp) * hw, ey       + Math.sin(perp) * hw,
        ex       - Math.cos(perp) * hw, ey       - Math.sin(perp) * hw,
        fromPx.x - Math.cos(perp) * hw, fromPx.y - Math.sin(perp) * hw
      ];
      // PIXI v7 API (Foundry v12/v13 compatible)
      preview.lineStyle(2, GOLD_STROKE, 0.85);
      preview.beginFill(TEAL_FILL, 0.3);
      preview.drawPolygon(pts);
      preview.endFill();

    } else if (type === "angular") {
      const clamped = Math.min(rawDist, maxPixels);
      const halfAngle = Math.PI / 6; // 30°
      const steps = 12;
      const pts = [fromPx.x, fromPx.y];
      for (let i = 0; i <= steps; i++) {
        const a = (angle - halfAngle) + (i / steps) * (2 * halfAngle);
        pts.push(fromPx.x + Math.cos(a) * clamped, fromPx.y + Math.sin(a) * clamped);
      }
      preview.lineStyle(2, GOLD_STROKE, 0.85);
      preview.beginFill(TEAL_FILL, 0.3);
      preview.drawPolygon(pts);
      preview.endFill();

    } else if (type === "circular") {
      const radius = templateSize * gs;
      preview.lineStyle(2, GOLD_STROKE, 0.85);
      preview.beginFill(TEAL_FILL, 0.3);
      preview.drawCircle(pos.x, pos.y, radius);
      preview.endFill();
    }
  }

  return new Promise((resolve, reject) => {
    let onMove, onClick, onEscape;

    function cleanup() {
      try {
        canvas.stage.off("pointermove", onMove);
        canvas.stage.off("pointerdown", onClick);
      } catch (_) {}
      document.removeEventListener("keydown", onEscape);
      try { canvas.stage.removeChild(preview); preview.destroy(); } catch (_) {}
    }

    onMove = (event) => {
      try {
        const pos = event.getLocalPosition(canvas.stage);
        drawPreview(pos);
      } catch (_) {}
    };

    onClick = (event) => {
      // Left click only (button 0)
      const btn = event.button ?? event.data?.button ?? 0;
      if (btn !== 0) return;
      try {
        const pos = event.getLocalPosition(canvas.stage);
        cleanup();
        resolve(pos);
      } catch (err) { cleanup(); reject(err); }
    };

    onEscape = (event) => {
      if (event.key === "Escape") { cleanup(); reject(new Error("Cancelled")); }
    };

    canvas.stage.on("pointermove", onMove);
    canvas.stage.on("pointerdown", onClick);
    document.addEventListener("keydown", onEscape);
  });
}

/**
 * Return all non-defeated combatants (excluding attacker) whose token center
 * falls within the area template.
 *
 * @param {string}   type          "linear" | "angular" | "circular"
 * @param {{x,y}}    fromPx        Attacker center (world coords)
 * @param {{x,y}}    toPx          Clicked target point (world coords)
 * @param {number}   rangeHexes    Max range in hexes
 * @param {number}   templateSize  Radius in hexes (circular only)
 * @param {Combat}   combat
 * @param {string}   excludeId     Attacker combatant ID to exclude
 * @returns {Combatant[]}
 */
function _getAffectedCombatants(type, fromPx, toPx, rangeHexes, templateSize, combat, excludeId) {
  const gs = canvas.grid?.size ?? 100;
  const norm = (o) => ({ i: o?.i ?? o?.row ?? 0, j: o?.j ?? o?.col ?? 0 });

  return [...combat.combatants].filter(c => {
    if (c.id === excludeId || c.defeated || !c.token) return false;
    const td = c.token;
    const tw = td.width ?? 1;
    const th = td.height ?? 1;
    const cx = td.x + tw * gs / 2;
    const cy = td.y + th * gs / 2;

    if (type === "linear") {
      const fromOff = norm(canvas.grid.getOffset({ x: fromPx.x, y: fromPx.y }));
      const toOff   = norm(canvas.grid.getOffset({ x: toPx.x,   y: toPx.y   }));
      let path;
      try { path = canvas.grid.getDirectPath(fromOff, toOff); } catch (_) { return false; }
      const tokenOff = norm(canvas.grid.getOffset({ x: cx, y: cy }));
      // Skip the first hex (origin) — start from slice(1)
      return path.slice(1).some(o => { const n = norm(o); return n.i === tokenOff.i && n.j === tokenOff.j; });

    } else if (type === "angular") {
      const dirAngle   = Math.atan2(toPx.y - fromPx.y, toPx.x - fromPx.x);
      const tokenAngle = Math.atan2(cy - fromPx.y, cx - fromPx.x);
      let diff = Math.abs(tokenAngle - dirAngle);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      if (diff > Math.PI / 6) return false; // outside 30° half-angle
      try {
        const hexDist = canvas.grid.measurePath([{ x: fromPx.x, y: fromPx.y }, { x: cx, y: cy }])?.spaces ?? 0;
        return hexDist > 0 && hexDist <= rangeHexes;
      } catch (_) { return false; }

    } else if (type === "circular") {
      try {
        const hexDist = canvas.grid.measurePath([{ x: toPx.x, y: toPx.y }, { x: cx, y: cy }])?.spaces ?? 0;
        return hexDist <= templateSize;
      } catch (_) { return false; }
    }
    return false;
  });
}

/**
 * Draw a permanent scene Drawing for the area template (teal fill + gold stroke).
 * Stores the Drawing ID in combatant flags for later cleanup via _clearAreaTemplate().
 */
async function _drawPermanentTemplate(combatant, type, fromPx, toPx, rangeHexes, templateSize) {
  const gs = canvas.grid?.size ?? 100;
  const dx = toPx.x - fromPx.x;
  const dy = toPx.y - fromPx.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);

  let shapeData, anchorX, anchorY;

  if (type === "linear") {
    const clamped = Math.min(dist, rangeHexes * gs);
    const perp = angle + Math.PI / 2;
    const hw = gs * 0.5;
    const ex = Math.cos(angle) * clamped;
    const ey = Math.sin(angle) * clamped;
    shapeData = {
      type: "p",
      bezierFactor: 0,
      points: [
         Math.cos(perp) * hw,  Math.sin(perp) * hw,
        ex + Math.cos(perp) * hw, ey + Math.sin(perp) * hw,
        ex - Math.cos(perp) * hw, ey - Math.sin(perp) * hw,
        -Math.cos(perp) * hw, -Math.sin(perp) * hw
      ]
    };
    anchorX = fromPx.x;
    anchorY = fromPx.y;

  } else if (type === "angular") {
    const clamped = Math.min(dist, rangeHexes * gs);
    const halfAngle = Math.PI / 6;
    const steps = 16;
    const pts = [0, 0];
    for (let i = 0; i <= steps; i++) {
      const a = (angle - halfAngle) + (i / steps) * (2 * halfAngle);
      pts.push(Math.cos(a) * clamped, Math.sin(a) * clamped);
    }
    shapeData = { type: "p", bezierFactor: 0, points: pts };
    anchorX = fromPx.x;
    anchorY = fromPx.y;

  } else { // circular
    const radius = templateSize * gs;
    shapeData = { type: "e", width: radius * 2, height: radius * 2 };
    anchorX = toPx.x - radius;
    anchorY = toPx.y - radius;
  }

  try {
    const docs = await canvas.scene.createEmbeddedDocuments("Drawing", [{
      x: anchorX, y: anchorY,
      shape: shapeData,
      strokeColor: "#0d9488",
      strokeWidth: 3,
      strokeAlpha: 0.9,
      fillType: 1,
      fillColor: "#0d9488",
      fillAlpha: 0.15,
      flags: { forja: { areaTemplate: true, combatantId: combatant.id } }
    }]);
    if (docs?.[0]?.id) await combatant.setFlag("forja", "areaTemplate", docs[0].id);
  } catch (err) { WARN("Could not draw area template:", err); }
}

/**
 * Delete the area template Drawing stored in a combatant's flags.
 */
async function _clearAreaTemplate(combatant) {
  const drawingId = combatant?.getFlag("forja", "areaTemplate");
  if (!drawingId) return;
  try { await canvas.scene.deleteEmbeddedDocuments("Drawing", [drawingId]); } catch (_) {}
  try { await combatant.setFlag("forja", "areaTemplate", null); } catch (_) {}
}

/**
 * Show the area damage confirmation Dialog (GM/owner only).
 * Pending damage for all targets has already been queued; cancel clears it.
 */
async function _showAreaDamageConfirmDialog(payload, combat) {
  const { attackerCombatant, attackerFites, weaponName, targets, totalDamageAll } = payload;
  const activeCombat = game.combat ?? combat;

  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/forja/templates/combat/area-damage-confirm-dialog.hbs",
    {
      attackerName: attackerCombatant.name,
      attackerImg: attackerCombatant.img ?? attackerCombatant.actor?.img ?? "icons/svg/mystery-man.svg",
      attackerFites, weaponName, targets, totalDamageAll
    }
  );

  const title = game.i18n.format("FORJA.Combat.AreaDamageConfirmTitle", { attacker: attackerCombatant.name });

  return new Promise(resolve => {
    new Dialog({
      title,
      content,
      buttons: {
        confirm: {
          icon: '<i class="fas fa-check"></i>',
          label: game.i18n.localize("FORJA.Combat.ConfirmDamage"),
          callback: async () => { await _tryAutoFinishResolution(activeCombat); resolve(true); }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize("FORJA.Combat.CancelDamage"),
          callback: async () => {
            // Discard all pending damage queued during this area attack
            await activeCombat.setFlag("forja", "pendingDamage", []);
            await _tryAutoFinishResolution(activeCombat);
            resolve(false);
          }
        }
      },
      default: "confirm"
    }, { classes: ["dialog", "forja-dialog"], width: 540 }).render(true);
  });
}

/**
 * Full area-of-effect attack resolution flow.
 * Triggered from _handleAttackFlow when weapon.system.templateType !== "none".
 *
 * Flow:
 *   1. Prompt player to click the canvas to place the template
 *   2. Compute affected combatants from chosen position
 *   3. Draw permanent template on canvas
 *   4. Roll attack once
 *   5. For each target: request defense, roll, calculate damage
 *   6. Post area summary to chat
 *   7. Show combined area damage confirm dialog
 *   8. Clean up template drawing
 */
async function _handleAreaAttackFlow(attackerCombatant, combat, weapon) {
  const weaponId = weapon?.id;
  const templateType = weapon?.system?.templateType ?? "linear";
  const templateSize = weapon?.system?.templateSize ?? 2;
  const rangeHexes = _getWeaponRange(weapon);
  const gs = canvas.grid?.size ?? 100;

  // Attacker world-center pixels
  const td = attackerCombatant.token;
  const fromPx = td
    ? { x: td.x + (td.width ?? 1) * gs / 2, y: td.y + (td.height ?? 1) * gs / 2 }
    : { x: 0, y: 0 };

  // Mark rolled early to prevent double-click before the async canvas interaction
  await attackerCombatant.update({ "flags.forja.attackRolled": true });

  // Step 1: Interactive template placement
  ui.notifications?.info(game.i18n.localize("FORJA.Combat.PlaceTemplate"));
  let toPx;
  try {
    toPx = await _placeAreaTemplate(templateType, fromPx, rangeHexes, templateSize);
  } catch (_) {
    ui.notifications?.warn(game.i18n.localize("FORJA.Combat.AreaTemplateCancelled"));
    await _tryAutoFinishResolution(combat);
    return;
  }

  // Step 2: Compute affected combatants
  const activeCombat = game.combat ?? combat;
  const affected = _getAffectedCombatants(
    templateType, fromPx, toPx, rangeHexes, templateSize,
    activeCombat, attackerCombatant.id
  );
  LOG(`Area attack: ${affected.length} combatant(s) in template`);

  if (affected.length === 0) {
    ui.notifications?.warn(game.i18n.localize("FORJA.Combat.NoTargetsInArea"));
    await _tryAutoFinishResolution(combat);
    return;
  }

  // Step 3: Draw permanent template
  await _drawPermanentTemplate(attackerCombatant, templateType, fromPx, toPx, rangeHexes, templateSize);

  // Step 4: Roll attack once
  let attackerFites = 0;
  if (weaponId && weaponId !== "__natural__") {
    attackerFites = (await attackerCombatant.actor.rollAttack(weaponId))?.fites ?? 0;
  } else {
    attackerFites = (await attackerCombatant.actor.rollAttribute("FOR"))?.fites ?? 0;
  }
  LOG(`Area attackerFites: ${attackerFites}`);

  // Step 5: Per-target defense + damage
  const targetResults = [];
  for (const targetCombatant of affected) {
    const defenseResult = await _requestDefenseChoice(attackerCombatant, targetCombatant, activeCombat);
    if (defenseResult.useReaction) await targetCombatant.useReaction();
    const { fites: defenderFites, extraDR: blockExtraDR } = await _rollDefense(defenseResult, targetCombatant);

    const netHits = attackerFites - defenderFites;
    const isHit   = netHits > 0;
    const totalDamage = isHit ? _calcDamage(weapon, attackerCombatant.actor, netHits, targetCombatant, { blockExtraDR }) : 0;

    const defenseLabel = defenseResult.type === "basic"
      ? game.i18n.localize("FORJA.Combat.BasicDefense").replace("{dice}", defenderFites)
      : game.i18n.localize(DEFENSE_KEYS[defenseResult.type] ?? defenseResult.type);

    if (isHit && totalDamage > 0) {
      await activeCombat.addPendingDamage(targetCombatant.id, totalDamage, attackerCombatant.id, weapon?.name ?? "");
    }

    targetResults.push({
      name: targetCombatant.name,
      img: targetCombatant.img ?? targetCombatant.actor?.img ?? "icons/svg/mystery-man.svg",
      defenseLabel, defenderFites, netHits, isHit, totalDamage
    });
    LOG(`  ${targetCombatant.name}: ${isHit ? `HIT ${totalDamage} dmg` : "MISS"}`);
  }

  // Step 6: Post area summary to chat
  const totalDamageAll = targetResults.reduce((s, t) => s + t.totalDamage, 0);
  const hitCount = targetResults.filter(t => t.isHit).length;
  const lines = targetResults.map(t =>
    `<div class="forja-resolution-summary__row">
      <strong>${t.name}</strong>: ${t.defenseLabel} — ${t.defenderFites} ● / ${attackerFites} ● →
      <span class="${t.isHit ? "forja-resolution--hit" : "forja-resolution--miss"}">
        ${t.isHit ? `${t.totalDamage} dmg` : game.i18n.localize("FORJA.Combat.AttackMissConfirm")}
      </span>
    </div>`
  ).join("");
  await ChatMessage.create({
    content: `<div class="forja-resolution-summary">
      <strong>${game.i18n.localize("FORJA.Combat.AreaAttack")}: ${attackerCombatant.name}</strong>
      <div class="forja-resolution-summary__row">${attackerFites} ● — ${hitCount}/${affected.length} impactes</div>
      ${lines}
    </div>`,
    speaker: { alias: attackerCombatant.name }
  });

  // Step 7: Show area damage confirm dialog
  if (game.user.isGM || attackerCombatant.isOwner) {
    await _showAreaDamageConfirmDialog({
      attackerCombatant, attackerFites,
      weaponName: weapon?.name ?? "—",
      targets: targetResults, totalDamageAll
    }, activeCombat);
  } else {
    await _tryAutoFinishResolution(activeCombat);
  }

  // Step 8: Clean up template drawing
  await _clearAreaTemplate(attackerCombatant);
}

/**
 * Attempt to auto-finish the resolution phase after one combatant resolves their action.
 *
 * When multiple combatants resolve at the same clock position, finishResolution() must NOT
 * fire after just the first one acts — it should only fire once ALL attack-type combatants
 * are done. Non-attack combatants (movement, defensive, etc.) do not block auto-finish.
 *
 * - If all resolving "simple" (attack) combatants have attackRolled = true → finishResolution()
 * - Otherwise, notify the GM that other combatants still need to resolve.
 */
async function _tryAutoFinishResolution(combat) {
  const activeCombat = game.combat ?? combat;
  const resolvingIds = activeCombat.resolvingIds;

  const attackers = resolvingIds
    .map(id => activeCombat.combatants.get(id))
    .filter(c => c?.declaredAction?.type === "simple");

  const allDone = attackers.every(c => c.getFlag("forja", "attackRolled") === true);

  if (allDone) {
    LOG("_tryAutoFinishResolution: all attack combatants done → finishResolution");
    await activeCombat.finishResolution();
  } else {
    const pending = attackers
      .filter(c => !c.getFlag("forja", "attackRolled"))
      .map(c => c.name);
    LOG("_tryAutoFinishResolution: still pending:", pending);
    ui.notifications?.info(
      game.i18n.format("FORJA.Combat.ResolutionPending", { names: pending.join(", ") })
    );
  }
}

/**
 * Full attack resolution flow.
 * Triggered when the "Roll Attack" button is clicked.
 * After rolls, shows a damage confirmation Dialog to GM/owner.
 * _tryAutoFinishResolution() is called from within that Dialog (confirm or cancel).
 */
async function _handleAttackFlow(attackerCombatant, combat, buttonTargetId = null) {
  LOG(`_handleAttackFlow for ${attackerCombatant.name}`);
  const declaredAction = attackerCombatant.declaredAction;
  if (!declaredAction) return;

  const weaponId = declaredAction.weaponId;
  // "__natural__" is the virtual natural attack fallback (no Item document, uses FOR)
  let weapon = (weaponId && weaponId !== "__natural__")
    ? attackerCombatant.actor.items.get(weaponId)
    : null;

  // If the weapon is an artifact, build a virtual weapon descriptor with combined stats
  // so that range checks and damage calculations work correctly.
  if (weapon?.type === "artifact") {
    const art = weapon;
    const base = CONFIG.FORJA.weaponBaseStats[art.system.baseWeapon] ?? null;
    weapon = {
      id: art.id,
      name: art.name,
      type: "artifact",
      _isArtifactWeapon: true,
      _damageBonus: art.system.damageValue ?? 0,
      system: {
        weaponType: base?.weaponType ?? "melee",
        attackType: base?.attackType ?? "melee",
        latencyMod: (base?.latencyMod ?? 0) + (art.system.latencyMod ?? 0),
        reach: base?.reach ?? "A tocar",
        range: "",
        damage: base?.damage ?? "0",
        templateType: "none"
      }
    };
    LOG(`  Artifact weapon: ${weapon.name}, base=${art.system.baseWeapon}, latencyMod=${weapon.system.latencyMod}, damageBonus=${weapon._damageBonus}`);
  }

  // Branch to area-of-effect flow if the weapon has a template type set
  const templateType = weapon?.system?.templateType ?? "none";
  if (templateType !== "none") {
    LOG(`  Weapon has templateType="${templateType}" — delegating to area attack flow`);
    await _handleAreaAttackFlow(attackerCombatant, combat, weapon);
    return;
  }

  // Find target: use flag value first, then button attribute as fallback.
  // Always use game.combat (freshest reference) for the lookup.
  const activeCombat = game.combat ?? combat;
  const targetId = declaredAction.targetId ?? buttonTargetId;
  LOG(`  targetId from flag: ${declaredAction.targetId}, from button: ${buttonTargetId}`);
  const targetCombatant = targetId ? activeCombat.combatants.get(targetId) : null;
  LOG(`  targetCombatant resolved: ${targetCombatant?.name ?? "null"}`);

  // 0a. Cancel attack if no valid target (e.g. target moved away, was removed, or none declared)
  if (!targetCombatant) {
    WARN(`${attackerCombatant.name}: no valid target — cancelling attack`);
    ui.notifications?.warn(game.i18n.localize("FORJA.Combat.AttackCancelledNoTarget"));
    await attackerCombatant.update({ "flags.forja.attackRolled": true });
    await _tryAutoFinishResolution(combat);
    return;
  }

  // 0b. Range check — BEFORE marking as rolled (so action can be cancelled cleanly)
  if (targetCombatant?.token && attackerCombatant.token) {
    const weaponRange = _getWeaponRange(weapon);
    const distance = _measureTokenDistance(attackerCombatant.token, targetCombatant.token);
    if (distance > weaponRange) {
      WARN(`${attackerCombatant.name}: target out of range (${distance} > ${weaponRange})`);
      ui.notifications?.warn(game.i18n.format("FORJA.Combat.TargetOutOfRange", {
        distance: Math.round(distance),
        range: weaponRange
      }));
      await attackerCombatant.update({ "flags.forja.attackRolled": true });
      await _tryAutoFinishResolution(combat);
      return;
    }
    LOG(`Range check OK: ${distance} ≤ ${weaponRange}`);
  }

  // Mark as rolled to prevent double-clicks (only after range check passes)
  await attackerCombatant.update({ "flags.forja.attackRolled": true });

  // 1. Request defense choice from target's owner
  const defenseResult = await _requestDefenseChoice(attackerCombatant, targetCombatant, combat);
  LOG("Defense choice:", defenseResult);

  // 2. Spend reaction immediately (before rolling) to prevent race conditions.
  //    Block, dodge and parry all appear under the "Spend Reaction" checkbox in the
  //    dialog, so all three cost 1 reaction when actively chosen.
  if (defenseResult.useReaction && targetCombatant) {
    await targetCombatant.useReaction();
  }

  // 3. Roll defense
  const { fites: defenderFites, extraDR: blockExtraDR } = await _rollDefense(defenseResult, targetCombatant);
  LOG(`Defender fites: ${defenderFites}, blockExtraDR: ${blockExtraDR}`);

  // 4. Roll attack
  let attackerFites = 0;
  if (weaponId) {
    const attackResult = await attackerCombatant.actor.rollAttack(weaponId);
    attackerFites = attackResult?.fites ?? 0;
  } else {
    const attackResult = await attackerCombatant.actor.rollAttribute("FOR");
    attackerFites = attackResult?.fites ?? 0;
  }
  LOG(`Attacker fites: ${attackerFites}`);

  // 5. Calculate everything
  const netHits = attackerFites - defenderFites;
  const isHit = netHits > 0;
  const baseDamage = isHit ? _parseWeaponDamage(weapon?.system?.damage ?? "", attackerCombatant.actor) : 0;
  const artifactDmgBonus = isHit ? (weapon?._damageBonus ?? 0) : 0;
  const protection = isHit ? (targetCombatant?.actor?.system?.protection ?? 0) : 0;
  const dr = isHit ? (targetCombatant?.actor?.system?.damageReduction ?? 0) : 0;
  // FORJA damage rules: armor stops all → 0 (no minimum); DR brings to 0 → min 1+bonus
  const totalDamage = isHit ? _calcDamage(weapon, attackerCombatant.actor, netHits, targetCombatant, { weaponBonus: artifactDmgBonus, blockExtraDR }) : 0;

  // 6. Post summary to chat (visible to all)
  const attackerName  = attackerCombatant.name;
  const targetName    = targetCombatant?.name ?? "—";
  const defenseLabel  = defenseResult.type === "basic"
    ? game.i18n.localize("FORJA.Combat.BasicDefense").replace("{dice}", defenderFites)
    : game.i18n.localize(DEFENSE_KEYS[defenseResult.type] ?? defenseResult.type);

  const resultMsg = isHit
    ? game.i18n.format("FORJA.Combat.AttackHit", { net: netHits, damage: totalDamage })
    : game.i18n.format("FORJA.Combat.AttackMiss", { net: Math.abs(netHits) });

  const chatContent = `
    <div class="forja-resolution-summary">
      <strong>${game.i18n.localize("FORJA.Combat.ResolutionSummary")}</strong>
      <div class="forja-resolution-summary__row">
        <span>${attackerName}</span> <i class="fas fa-arrow-right"></i> <span>${targetName}</span>
      </div>
      <div class="forja-resolution-summary__row">
        <em>${defenseLabel} — ${defenderFites} ● / ${attackerFites} ●</em>
      </div>
      <div class="forja-resolution-summary__result ${isHit ? "forja-resolution--hit" : "forja-resolution--miss"}">
        ${resultMsg}
      </div>
    </div>`;
  await ChatMessage.create({ content: chatContent, speaker: { alias: attackerName } });

  // 7. Show damage confirmation Dialog (to GM or owner)
  if (game.user.isGM || attackerCombatant.isOwner) {
    await _showDamageConfirmDialog({
      attackerCombatant, targetCombatant,
      attackerFites, defenderFites, netHits, isHit,
      defenseResult, defenseLabel,
      weapon, baseDamage, protection, dr, blockExtraDR, totalDamage
    }, combat);
  }
}

/**
 * Show the GM damage confirmation Dialog with full breakdown.
 * Calls finishResolution() once confirmed or cancelled.
 */
async function _showDamageConfirmDialog(payload, combat) {
  const { attackerCombatant, targetCombatant, attackerFites, defenderFites, netHits,
    isHit, defenseLabel, weapon, baseDamage, protection, dr, blockExtraDR = 0, totalDamage } = payload;

  const attackerName = attackerCombatant.name;
  const targetName   = targetCombatant?.name ?? "—";

  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/forja/templates/combat/damage-confirm-dialog.hbs",
    {
      attackerName, targetName,
      attackerImg: attackerCombatant.img ?? attackerCombatant.actor?.img ?? "icons/svg/mystery-man.svg",
      targetImg: targetCombatant?.img ?? targetCombatant?.actor?.img ?? "icons/svg/mystery-man.svg",
      defenseLabel, defenderFites, attackerFites, netHits,
      isHit,
      weaponName: weapon?.name ?? "—",
      weaponDamageFormula: weapon?.system?.damage ?? "—",
      baseDamage, protection, dr, blockExtraDR: blockExtraDR || 0, totalDamage
    }
  );

  const title = game.i18n.format("FORJA.Combat.DamageConfirmTitle",
    { attacker: attackerName, target: targetName });

  return new Promise(resolve => {
    const dialog = new Dialog({
      title,
      content,
      buttons: {
        confirm: {
          icon: '<i class="fas fa-check"></i>',
          label: game.i18n.localize("FORJA.Combat.ConfirmDamage"),
          callback: async () => {
            if (isHit && totalDamage > 0 && targetCombatant) {
              await combat.addPendingDamage(
                targetCombatant.id, totalDamage,
                attackerCombatant.id, weapon?.name ?? ""
              );
            }
            await _tryAutoFinishResolution(combat);
            resolve(true);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize("FORJA.Combat.CancelDamage"),
          callback: async () => {
            await _tryAutoFinishResolution(combat);
            resolve(false);
          }
        }
      },
      default: "confirm"
    }, { classes: ["dialog", "forja-dialog"], width: 420 });
    dialog.render(true);
  });
}

/* ---------------------------------------- */
/*  Event Listeners                         */
/* ---------------------------------------- */

function _activateListeners(root, combat) {
  // GM: Advance to next
  root.querySelectorAll("[data-action='forja-advance']").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      LOG("Advance clicked");
      await combat.advanceToNext();
    });
  });

  // GM: Finish resolution (manual fallback)
  root.querySelectorAll("[data-action='forja-finish']").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      LOG("Finish resolution clicked");
      await combat.finishResolution();
    });
  });

  // Open declaration dialog
  root.querySelectorAll("[data-action='forja-open-declare']").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const combatant = combat.combatants.get(btn.dataset.combatantId);
      if (!combatant) return;
      LOG(`Opening declaration dialog for ${combatant.name}`);
      await _openDeclarationDialog(combatant, combat);
    });
  });

  // Apply pending movement during resolution ("Move now" button)
  root.querySelectorAll("[data-action='forja-apply-move']").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      btn.disabled = true;
      const combatant = combat.combatants.get(btn.dataset.combatantId);
      if (!combatant) { btn.disabled = false; return; }
      const pendingMove = combatant.getFlag("forja", "pendingMove");
      if (!pendingMove) { btn.disabled = false; return; }
      LOG(`Applying move for ${combatant.name}:`, pendingMove);
      try {
        if (combatant.token) {
          await combatant.token.update(
            { x: pendingMove.x, y: pendingMove.y },
            { forjaApplyingMove: true }
          );
        }
        await _clearMovementVector(combatant);
        await combatant.setFlag("forja", "pendingMove", null);
      } catch (err) {
        WARN("Could not apply movement:", err);
        btn.disabled = false;
      }
    });
  });

  // Roll attack → full resolution flow
  root.querySelectorAll("[data-action='forja-roll-attack']").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      btn.disabled = true; // prevent double-click
      const combatant = combat.combatants.get(btn.dataset.combatantId);
      if (!combatant?.actor) { btn.disabled = false; return; }
      // Pass button's data-target-id as fallback in case the flag read fails
      const buttonTargetId = btn.dataset.targetId || null;
      await _handleAttackFlow(combatant, combat, buttonTargetId);
    });
  });

  // Roll defense (standalone, no full flow)
  root.querySelectorAll("[data-action='forja-roll-defense']").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const combatant = combat.combatants.get(btn.dataset.combatantId);
      if (!combatant?.actor) return;
      const defenseType = btn.dataset.defenseType ?? "dodge";
      if (defenseType === "block") {
        // Block: no roll, just announce the bonus
        const forVal = combatant.actor.system?.attributes?.FOR?.value ?? 0;
        const basicDef = combatant.actor.system?.defense ?? 0;
        ChatMessage.create({
          content: `<strong>${combatant.name}</strong> ${game.i18n.localize("FORJA.Combat.DefenseBlock")}: ${basicDef} fites + ${forVal} DR`,
          speaker: { alias: combatant.name }
        });
      } else {
        await combatant.actor.rollDefense(defenseType);
      }
    });
  });

  // Use reaction (standalone)
  root.querySelectorAll("[data-action='forja-react']").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const combatant = combat.combatants.get(btn.dataset.combatantId);
      if (!combatant) return;
      const success = await combatant.useReaction();
      if (success) {
        ChatMessage.create({
          content: `<strong>${combatant.name}</strong> ${game.i18n.localize("FORJA.Combat.UsedReaction")}`,
          speaker: { alias: combatant.name }
        });
      }
    });
  });

  // Click-to-target: intercept combatant row clicks when declaration dialog is open
  root.querySelectorAll(".combatant[data-combatant-id]").forEach(row => {
    row.addEventListener("click", (e) => {
      if (!_activeDeclarationRoot) return;
      const targetSelect = _activeDeclarationRoot.querySelector("#declare-target");
      if (!targetSelect) return;
      const combatantId = row.dataset.combatantId;
      // Don't allow self-targeting (skip if this combatant's row matches the declarer)
      const options = Array.from(targetSelect.options);
      if (!options.some(o => o.value === combatantId)) return;
      e.preventDefault();
      e.stopPropagation();
      targetSelect.value = combatantId;
      // Visual feedback: highlight selected row
      root.querySelectorAll(".combatant.forja-target-selected").forEach(r => r.classList.remove("forja-target-selected"));
      row.classList.add("forja-target-selected");
    }, { capture: true });
  });
}

/* ---------------------------------------- */
/*  Hook: preUpdateToken (deferred movement)*/
/* ---------------------------------------- */

/**
 * Intercept token movement during active combat.
 * Stores the intended position in combatant flags, cancels the immediate move,
 * and draws a visual vector on the canvas.
 */
function _onPreUpdateToken(tokenDoc, updates, options, userId) {
  if (!("x" in updates) && !("y" in updates)) return;

  const combat = game.combat;
  if (!combat?.started) return;

  const combatant = combat.combatants.find(c => c.tokenId === tokenDoc.id);
  if (!combatant) return;

  const phase = combat.phase;
  if (phase === "idle") return;

  if (options?.forjaApplyingMove) return;

  if (!game.user.isGM && !combatant.isOwner) return;

  LOG(`Intercepting movement for ${combatant.name}: (${updates.x ?? "?"}, ${updates.y ?? "?"})`);

  const newPos = {
    x: updates.x ?? tokenDoc.x,
    y: updates.y ?? tokenDoc.y
  };

  // ── Multi-segment movement + BFS path ────────────────────────────────────
  // If the combatant already has a pending move, the new drag ADDS a segment
  // starting from the previous destination (logicalFrom), NOT from the token's
  // current visual position. This lets players navigate around obstacles with
  // multiple drags: first drag goes around obstacle 1, second around obstacle 2.
  const existingPendingMove = combatant.getFlag("forja", "pendingMove");
  const logicalFrom = existingPendingMove
    ? { x: existingPendingMove.x, y: existingPendingMove.y }
    : { x: tokenDoc.x, y: tokenDoc.y };

  // BFS: find the shortest route from logicalFrom to newPos, returning the
  // actual path as an array of pixel centres (so the drawing follows the detour).
  const pathResult = _computePath(tokenDoc, logicalFrom, newPos);
  if (pathResult.length === Infinity) {
    ui.notifications?.warn(game.i18n.localize("FORJA.Combat.MovementBlocked"));
    return false;
  }

  // Straight-line fallback (if BFS gives 0 for same hex, use measurePath)
  let segmentHexes = pathResult.length;
  if (segmentHexes === 0) {
    try {
      segmentHexes = canvas.grid.measurePath([
        { x: logicalFrom.x, y: logicalFrom.y },
        { x: newPos.x,      y: newPos.y      }
      ]).spaces ?? 0;
    } catch (_) {
      const gs = canvas.grid?.size ?? 100;
      segmentHexes = Math.round(Math.max(
        Math.abs((newPos.x - logicalFrom.x) / gs),
        Math.abs((newPos.y - logicalFrom.y) / gs)
      ));
    }
  }

  // Append the new segment to any existing ones
  const existingSegments = existingPendingMove?.segments ?? [];
  const newSegments = [...existingSegments, {
    fromX: logicalFrom.x, fromY: logicalFrom.y,
    toX:   newPos.x,      toY:   newPos.y,
    hexes: segmentHexes,
    points: pathResult.points   // BFS-computed pixel centres for polyline drawing
  }];
  const totalHexes = newSegments.reduce((s, seg) => s + seg.hexes, 0);

  // Auto-fill hex count in the open declaration dialog (after BFS — correct count)
  if (_activeDeclarationRoot && _activeDeclarationCombatantId === combatant.id) {
    const sys = combatant.actor?.system;
    const agi = sys?.attributes?.AGI?.value ?? 0;
    const size = sys?.size ?? 0;
    _autoFillHexFromDrag(_activeDeclarationRoot, totalHexes, agi, size);
  }

  // Store pending move with segments, then draw the full polyline
  combatant.setFlag("forja", "pendingMove", {
    x: newPos.x, y: newPos.y,
    hexesMoved: totalHexes,
    segments: newSegments
  }).then(async () => {
    ui.notifications?.info(game.i18n.localize("FORJA.Combat.MovementDeferred"));
    await _drawMovementPath(combatant, newSegments);
  });

  return false;
}

/**
 * BFS pathfinding: finds the shortest path from fromPixels to toPixels,
 * avoiding hexes occupied by medium/large/huge tokens (FORJA size ≥ 3).
 *
 * Returns the path as an array of pixel-centre points so the movement drawing
 * can follow the actual detour route instead of a straight line through obstacles.
 *
 * @param {TokenDocument} movingToken  - excluded from blocker set (self)
 * @param {{x,y}} fromPixels           - top-left of logical start position
 * @param {{x,y}} toPixels             - top-left of intended destination
 * @returns {{ length: number, points: {x,y}[] }}
 *   length = Infinity if blocked/unreachable; 0 if same hex.
 *   points = pixel centres of every hex in the path (start → end).
 */
function _computePath(movingToken, fromPixels, toPixels) {
  if (!canvas?.grid) return { length: 0, points: [] };

  const gs = canvas.grid.size;
  const mw = movingToken.width ?? 1;
  const mh = movingToken.height ?? 1;

  // Normalise offset to always use {i, j} (v13 uses {i,j}; legacy may use {row,col})
  const norm     = (o) => ({ i: o?.i ?? o?.row ?? 0, j: o?.j ?? o?.col ?? 0 });
  const key      = (o) => `${o.i}:${o.j}`;
  const pixToOff = (px, py) =>
    norm(canvas.grid.getOffset({ x: px + mw * gs / 2, y: py + mh * gs / 2 }));

  // Convert grid offset {i,j} → pixel centre of that hex
  const offToCenter = (off) => {
    try { return canvas.grid.getCenterPoint(off); } catch (_) {}
    try {
      const tl = canvas.grid.getTopLeftPoint(off);
      return { x: tl.x + gs / 2, y: tl.y + gs / 2 };
    } catch (_) {}
    return { x: (off.j + 0.5) * gs, y: (off.i + 0.5) * gs }; // rough fallback
  };

  const startOff = pixToOff(fromPixels.x, fromPixels.y);
  const endOff   = pixToOff(toPixels.x,   toPixels.y);

  if (key(startOff) === key(endOff)) return { length: 0, points: [] };

  // ── Blocked hex set: one hex per medium/large/huge token (size ≥ 3) ──────
  const blocked = new Set();
  for (const t of (canvas.tokens?.placeables ?? [])) {
    if (t.document === movingToken) continue;
    const tokSize = t.document.actor?.system?.size ?? 3;
    if (tokSize < 3) continue;
    const tokW = t.document.width ?? 1;
    const tokH = t.document.height ?? 1;
    const off  = norm(canvas.grid.getOffset({
      x: t.document.x + tokW * gs / 2,
      y: t.document.y + tokH * gs / 2
    }));
    blocked.add(key(off));
    LOG(`Path blocker: ${t.document.name} (size ${tokSize}) at hex ${key(off)}`);
  }

  const endKey = key(endOff);

  // Destination occupied → always blocked
  if (blocked.has(endKey)) {
    LOG(`Destination hex ${endKey} is occupied — move blocked`);
    return { length: Infinity, points: [] };
  }

  // ── Path reconstruction helper ─────────────────────────────────────────────
  const reconstructPath = (parentMap, offMap, toKey) => {
    const path = [];
    let cur = toKey;
    while (cur !== null) {
      path.unshift(offMap.get(cur));
      cur = parentMap.get(cur);
    }
    // Use exact pixel positions for start and end (token/dest centers)
    const pts = path.map(offToCenter);
    if (pts.length >= 1) pts[0] = { x: fromPixels.x + mw * gs / 2, y: fromPixels.y + mh * gs / 2 };
    if (pts.length >= 2) pts[pts.length - 1] = { x: toPixels.x + mw * gs / 2, y: toPixels.y + mh * gs / 2 };
    return pts;
  };

  // No blockers → use Foundry's direct path for the polyline
  if (blocked.size === 0) {
    let pts = [];
    try {
      pts = canvas.grid.getDirectPath([startOff, endOff]).map(o => offToCenter(norm(o)));
    } catch (_) {}
    if (pts.length >= 2) {
      pts[0] = { x: fromPixels.x + mw * gs / 2, y: fromPixels.y + mh * gs / 2 };
      pts[pts.length - 1] = { x: toPixels.x + mw * gs / 2, y: toPixels.y + mh * gs / 2 };
    } else {
      pts = [
        { x: fromPixels.x + mw * gs / 2, y: fromPixels.y + mh * gs / 2 },
        { x: toPixels.x  + mw * gs / 2, y: toPixels.y  + mh * gs / 2 }
      ];
    }
    return { length: Math.max(1, pts.length - 1), points: pts };
  }

  // ── BFS with parent tracking for path reconstruction ──────────────────────
  const startKey = key(startOff);
  const parent   = new Map([[startKey, null]]);
  const offMap   = new Map([[startKey, startOff]]);
  const queue    = [startOff];
  const MAX_ITER = 2000;
  let iter = 0;

  outer: while (queue.length > 0 && iter < MAX_ITER) {
    iter++;
    const current = queue.shift();
    const ck      = key(current);

    let neighbours;
    try { neighbours = canvas.grid.getAdjacentOffsets(current); }
    catch (e) { WARN("getAdjacentOffsets failed:", e.message); break; }

    for (const raw of (neighbours ?? [])) {
      const nb    = norm(raw);
      const nbKey = key(nb);
      if (parent.has(nbKey)) continue;
      if (blocked.has(nbKey)) continue;

      parent.set(nbKey, ck);
      offMap.set(nbKey, nb);

      if (nbKey === endKey) {
        const pts = reconstructPath(parent, offMap, endKey);
        LOG(`BFS path: ${pts.length - 1} hexes (iter=${iter})`);
        return { length: pts.length - 1, points: pts };
      }
      queue.push(nb);
    }
  }

  LOG(`BFS: no path to ${endKey} (iter=${iter})`);
  return { length: Infinity, points: [] };
}

/**
 * Auto-fill the hex count input in an open declaration dialog based on drag distance.
 * Automatically selects walk/run radio based on how far the token was dragged.
 */
function _autoFillHexFromDrag(root, hexesMoved, agi, size) {
  const hexInput  = root.querySelector("#declare-hex-count");
  if (!hexInput) return;

  const walkMax = (agi * 2) + size;
  const runMax  = (agi * 4) + size;

  const noneRadio = root.querySelector("input[name='moveType'][value='none']");
  const walkRadio = root.querySelector("input[name='moveType'][value='walk']");
  const runRadio  = root.querySelector("input[name='moveType'][value='run']");

  if (hexesMoved <= 0) {
    if (noneRadio) noneRadio.checked = true;
  } else if (hexesMoved <= walkMax) {
    if (walkRadio) walkRadio.checked = true;
    hexInput.value = hexesMoved;
  } else if (hexesMoved <= runMax) {
    if (runRadio) runRadio.checked = true;
    hexInput.value = hexesMoved;
  } else {
    // Exceeds run max — cap at run max and warn
    if (runRadio) runRadio.checked = true;
    hexInput.value = runMax;
    ui.notifications?.warn(`${game.i18n.localize("FORJA.Combat.Run")}: max ${runMax}`);
  }

  // Fire change event to update the preview and hex counter visibility
  const changed = root.querySelector("input[name='moveType']:checked");
  changed?.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Draw the full movement path on the canvas as a yellow polyline.
 * Each segment may carry a BFS-computed `points` array; if absent a straight
 * line between endpoints is used as fallback.
 * Stores the drawing ID in the combatant's flags for later removal.
 *
 * @param {ForjaCombatant} combatant
 * @param {Array<{fromX,fromY,toX,toY,hexes,points?}>} segments
 */
async function _drawMovementPath(combatant, segments) {
  if (!canvas?.scene || !segments?.length) return;

  await _clearMovementVector(combatant);

  // Collect all pixel-centre points across all segments.
  // Segments share a join point, so skip the first point of segments after the first.
  const allPoints = [];
  for (let s = 0; s < segments.length; s++) {
    const seg = segments[s];
    const pts = (seg.points?.length >= 2)
      ? seg.points
      : [{ x: seg.fromX, y: seg.fromY }, { x: seg.toX, y: seg.toY }];
    const startIdx = s === 0 ? 0 : 1;
    for (let i = startIdx; i < pts.length; i++) allPoints.push(pts[i]);
  }

  if (allPoints.length < 2) return;

  const anchor  = allPoints[0];
  const relPts  = allPoints.flatMap(p => [p.x - anchor.x, p.y - anchor.y]);

  try {
    const docs = await canvas.scene.createEmbeddedDocuments("Drawing", [{
      x: anchor.x,
      y: anchor.y,
      shape: {
        type: "p",        // polygon / polyline
        points: relPts,
        bezierFactor: 0   // no curve smoothing
      },
      strokeColor: "#ffcc00",
      strokeWidth: 4,
      strokeAlpha: 0.85,
      fillType: 0,
      flags: { forja: { movementVector: true, combatantId: combatant.id } }
    }]);
    if (docs?.[0]) {
      await combatant.setFlag("forja", "movementDrawingId", docs[0].id);
      LOG(`Movement path drawn for ${combatant.name}: ${allPoints.length} pts, drawingId=${docs[0].id}`);
    }
  } catch (err) {
    WARN("Could not draw movement path:", err);
  }
}

/**
 * Remove the movement vector canvas drawing for a combatant.
 */
async function _clearMovementVector(combatant) {
  const drawingId = combatant.getFlag("forja", "movementDrawingId");
  if (!drawingId || !canvas?.scene) return;
  try {
    await canvas.scene.deleteEmbeddedDocuments("Drawing", [drawingId]);
    await combatant.setFlag("forja", "movementDrawingId", null);
    LOG(`Movement vector cleared for ${combatant.name}`);
  } catch (err) {
    WARN("Could not clear movement vector:", err);
  }
}

/**
 * Exported helper so ForjaCombat.advanceToNext() / finishResolution() can clear vectors.
 */
export async function clearMovementVectors(combatantIds, combat) {
  for (const id of combatantIds) {
    const combatant = combat.combatants.get(id);
    if (combatant) await _clearMovementVector(combatant);
  }
}

/* ---------------------------------------- */
/*  PIXI Declaration Ring                   */
/* ---------------------------------------- */

const FORJA_DECLARING_RING = "forja-declaring-ring";

/**
 * Add a teal PIXI circle to a token PIXI container.
 * Used locally to show which combatant is currently in the declaration dialog.
 * The ring is re-added via _onRefreshToken if Foundry refreshes the token.
 */
function _addDeclaringRingToToken(tokenObj, tokenDoc) {
  _removeChildByName(tokenObj, FORJA_DECLARING_RING);
  const g = new PIXI.Graphics();
  g.name = FORJA_DECLARING_RING;
  const gs = canvas.grid.size;
  const tw = tokenDoc.width ?? 1;
  const th = tokenDoc.height ?? 1;
  const radius = Math.max(tw, th) * gs / 2 + 8;
  g.lineStyle(3, 0x14b8a6, 0.85); // FORJA teal (--forja-primary)
  g.drawCircle(tw * gs / 2, th * gs / 2, radius);
  tokenObj.addChild(g);
}

/** Draw a PIXI declaration ring around the token of the given combatant ID. */
function _drawDeclaringRing(combatantId) {
  const combatant = game.combat?.combatants.get(combatantId);
  if (!combatant?.token) return;
  const tokenObj = canvas.tokens?.placeables?.find(t => t.document.id === combatant.token.id);
  if (!tokenObj) return;
  _addDeclaringRingToToken(tokenObj, combatant.token);
  LOG(`Declaration ring drawn for ${combatant.name}`);
}

/** Remove the PIXI declaration ring from the token of the given combatant ID. */
function _clearDeclaringRing(combatantId) {
  const combatant = game.combat?.combatants.get(combatantId);
  if (!combatant?.token) return;
  const tokenObj = canvas.tokens?.placeables?.find(t => t.document.id === combatant.token.id);
  if (!tokenObj) return;
  _removeChildByName(tokenObj, FORJA_DECLARING_RING);
  LOG(`Declaration ring cleared for ${combatant.name}`);
}

/** Remove a named direct child from a PIXI container. */
function _removeChildByName(container, name) {
  const child = container.children?.find(c => c.name === name);
  if (child) {
    child.clear?.();
    container.removeChild(child);
    try { child.destroy({ children: true }); } catch (_) { /* ignore */ }
  }
}

/**
 * Hook: refreshToken — re-draw the declaration ring if Foundry refreshes
 * the token while its declaration dialog is still open.
 */
function _onRefreshToken(tokenObj) {
  if (!_activeDeclarationCombatantId || !game.combat?.started) return;
  const combatant = game.combat.combatants.get(_activeDeclarationCombatantId);
  if (!combatant?.token || combatant.token.id !== tokenObj.document.id) return;
  _addDeclaringRingToToken(tokenObj, combatant.token);
}

/**
 * Draw a yellow ellipse ring around each resolving combatant's token.
 * Stores drawing IDs in module-level _activeRingIds map.
 */
export async function drawActiveRings(combatantIds, combat) {
  if (!canvas?.scene) return;
  for (const id of combatantIds) {
    const combatant = combat.combatants.get(id);
    const tokenDoc = combatant?.token;
    if (!tokenDoc) continue;
    try {
      const gs = canvas.grid.size;
      const tw = tokenDoc.width ?? 1;
      const th = tokenDoc.height ?? 1;
      const radius = Math.max(tw, th) * gs / 2 + 10;
      const cx = tokenDoc.x + tw * gs / 2;
      const cy = tokenDoc.y + th * gs / 2;
      const docs = await canvas.scene.createEmbeddedDocuments("Drawing", [{
        x: cx - radius,
        y: cy - radius,
        shape: { type: "e", width: radius * 2, height: radius * 2 },
        strokeColor: "#ffcc00",
        strokeWidth: 3,
        strokeAlpha: 0.85,
        fillType: 0,
        flags: { forja: { activeRing: true } }
      }]);
      if (docs?.[0]) {
        _activeRingIds.set(id, docs[0].id);
        LOG(`Active ring drawn for ${combatant.name}: drawingId=${docs[0].id}`);
      }
    } catch (err) {
      WARN("Could not draw active ring:", err);
    }
  }
}

/**
 * Clear all active resolution rings from the canvas.
 */
export async function clearActiveRings() {
  if (!canvas?.scene || _activeRingIds.size === 0) return;
  const ids = [..._activeRingIds.values()];
  _activeRingIds.clear();
  try {
    await canvas.scene.deleteEmbeddedDocuments("Drawing", ids);
    LOG(`Cleared ${ids.length} active rings`);
  } catch (err) {
    WARN("Could not clear active rings:", err);
  }
}
