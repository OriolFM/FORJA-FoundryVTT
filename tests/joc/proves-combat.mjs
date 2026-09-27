// Proves de joc, segona bateria: diàlegs de combat clicats de veritat (DJ i
// Jugador) i regles de combat de WP-F/WP-I amb daus forçats (deterministes).
// Vegeu tests/joc/README.md. Execució: node tests/joc/proves-combat.mjs
import { navegador, registrarErrors, unirse } from "./comu.mjs";
const CAPTURES = process.env.FORJA_CAPTURES ?? `${process.env.HOME}/foundry/proves/captures`;
const resultats = [];
const LIMIT_PROVA = Number(process.env.FORJA_LIMIT_PROVA ?? 240000);  // màquines lentes: el canvas es renderitza per programari
const finestres = (p) => p.evaluate(() => [...foundry.applications.instances.values()].filter(a => !a.constructor.name.match(/Directory|Sidebar|ChatLog|Settings|Hotbar|Players|Scene|GamePause|HeadsUp|CombatTracker/)).map(a => `${a.constructor.name}(${a.element?.tagName}.${a.element?.className})`));
const prova = async (nom, fn) => {
  const limit = new Promise((_, rej) => setTimeout(() => rej(new Error(`temps esgotat (${LIMIT_PROVA / 1000} s)`)), LIMIT_PROVA));
  try { resultats.push({ nom, ok: true, detall: await Promise.race([fn(), limit]) }); }
  catch (e) {
    const obertes = { dj: await finestres(dj).catch(() => "?"), jugador: typeof jug !== "undefined" ? await finestres(jug).catch(() => "?") : "-" };
    resultats.push({ nom, ok: false, detall: String(e.message ?? e).slice(0, 300) + " | finestres: " + JSON.stringify(obertes) });
  }
  const r = resultats.at(-1); console.error(`${r.ok ? "OK" : "KO"} ${nom}`);
};
const esperar = (ms) => new Promise(r => setTimeout(r, ms));
// Playwright espera fent polling per requestAnimationFrame, que amb el canvas de
// Foundry renderitzat per programari gairebé no avança: es comprova a mà amb count().
// Envia un formulari de diàleg amb el SEU botó (no el primer submit, que pot ser de la capçalera).
const enviar = (form) => form.evaluate(f => f.requestSubmit([...f.querySelectorAll('button[type="submit"]')].find(b => !b.closest("header"))));
// Espera fins que fn (avaluada a la pàgina) retorni un valor que compleixi `ok`.
const esperarQue = async (p, fn, arg, ok, ms = 30000) => {
  const fi = Date.now() + ms; let v;
  while (Date.now() < fi) { v = await p.evaluate(fn, arg); if (ok(v)) return v; await esperar(500); }
  return v;
};
const esperarElement = async (loc, ms = 20000) => {
  const fi = Date.now() + ms;
  while (Date.now() < fi) { if (await loc.count()) return loc; await esperar(250); }
  throw new Error(`element no trobat en ${ms / 1000} s`);
};
const b = await navegador();
const dj = await (await b.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
const errDJ = registrarErrors(dj, "DJ");
await unirse(dj, "Gamemaster");

// ---- Preparació: actors, escena, tokens adjacents i combat començat ----
const ids = await dj.evaluate(async () => {
  for (const a of game.actors.filter(a => a.name.startsWith("Prova"))) await a.delete();
  for (const c of game.combats.contents) await c.delete();
  const jug = game.users.getName("Jugador") ?? await User.create({ name: "Jugador", role: CONST.USER_ROLES.PLAYER });
  const hab = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [`system.habilitats.${k}.nivell`, v]));
  const pj = await Actor.create({ name: "Prova PJ", type: "personatge", ownership: { default: 0, [jug.id]: 3 } });
  await pj.update({ "system.atributs": { FOR: 2, DES: 3, AGI: 3, PER: 2, INT: 2, APL: 1 },
    ...hab({ "arts-marcials": 2, "barallar-se": 2, medicina: 2, esquivar: 2, "armes-distancia": 2 }) });
  const pnj = await Actor.create({ name: "Prova PNJ", type: "pnj" });
  await pnj.update({ "system.atributs": { FOR: 2, DES: 2, AGI: 2, PER: 1, INT: 1, APL: 1 }, ...hab({ esquivar: 2, resistencia: 3, "armes-cos-a-cos": 2 }) });
  const scene = game.scenes.active ?? await Scene.create({ name: "Prova", active: true });
  for (const t of scene.tokens.contents) await t.delete();
  // Com quan s'arrossega l'actor al canvas: a partir del token prototip.
  const token = async (a, x, y) => (await a.getTokenDocument({ x, y })).toObject();
  const [tA, tB] = await scene.createEmbeddedDocuments("Token", [await token(pj, 1000, 1000), await token(pnj, 1100, 1000)]);
  const combat = await Combat.create({ scene: scene.id, active: true });
  await combat.createEmbeddedDocuments("Combatant", [
    { tokenId: tA.id, sceneId: scene.id, actorId: pj.id }, { tokenId: tB.id, sceneId: scene.id, actorId: pnj.id }]);
  await combat.startCombat();
  for (const c of combat.combatants) await combat.situarCombatent(c.id, 0);
  return { jugador: jug.id, pj: pj.id, pnj: pnj.id, tA: tA.id, tB: tB.id, combat: combat.id,
           cPJ: combat.combatants.find(c => c.actorId === pj.id).id, cPNJ: combat.combatants.find(c => c.actorId === pnj.id).id,
           canvas: !!canvas?.ready };
});

var jug = await (await b.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
const errJ = registrarErrors(jug, "Jugador");
await unirse(jug, "Jugador");
await esperar(2000);
const obrirTracker = (p) => p.evaluate(async () => { ui.sidebar.expand?.(); await ui.sidebar.changeTab("combat", "primary"); await ui.combat.render(true); });
await obrirTracker(dj); await obrirTracker(jug); await esperar(2000);

// ======================= Interfície (clics reals) =======================
await prova("U0. El PJ neix amb el token enllaçat (el combat escriu a la fitxa); el PNJ no", async () => {
  const r = await dj.evaluate(({ pj, pnj, combat, cPJ, cPNJ }) => {
    const c = game.combats.get(combat);
    return { pjEnllacat: game.actors.get(pj).prototypeToken.actorLink, pnjEnllacat: game.actors.get(pnj).prototypeToken.actorLink,
             actorCombatentPJesFitxa: c.combatants.get(cPJ).actor === game.actors.get(pj) };
  }, ids);
  if (!r.pjEnllacat || r.pnjEnllacat || !r.actorCombatentPJesFitxa) throw new Error(JSON.stringify(r));
  return r;
});


await prova("U1. Tracker: el jugador només veu controls al seu combatent; tothom veu el marcador", async () => {
  const vista = (p) => p.evaluate(({ cPJ, cPNJ }) => ({
    marcador: !!document.querySelector("#combat .forja-marcador-temps"),
    controlsPJ:  !!document.querySelector(`#combat .forja-declarar[data-combatant-id="${cPJ}"]`),
    controlsPNJ: !!document.querySelector(`#combat .forja-declarar[data-combatant-id="${cPNJ}"]`)
  }), ids);
  const r = { dj: await vista(dj), jugador: await vista(jug) };
  await jug.screenshot({ path: `${CAPTURES}/40-tracker-jugador.png`, timeout: 10000 }).catch(() => {});
  if (!r.jugador.marcador || !r.jugador.controlsPJ || r.jugador.controlsPNJ || !r.dj.controlsPJ || !r.dj.controlsPNJ) throw new Error(JSON.stringify(r));
  return r;
});

await prova("U2. El jugador declara un atac amb 'Cop' i es concentra (diàleg real)", async () => {
  await jug.locator(`#combat .forja-declarar[data-combatant-id="${ids.cPJ}"]`).dispatchEvent("click");
  const form = jug.locator("form.dialeg-declarar-accio").last();
  await esperarElement(form);
  await form.locator('input[name="tipus"][value="atac"]').evaluate(e => { e.checked = true; e.dispatchEvent(new Event("change", { bubbles: true })); }).catch(() => {});
  const copId = await jug.evaluate((pj) => game.actors.get(pj).items.find(i => i.getFlag("forja", "catalegId") === "cop").id, ids.pj);
  await form.locator('select[name="armaId"]').evaluate((e, v) => { e.value = v; e.dispatchEvent(new Event("change", { bubbles: true })); }, copId).catch(() => {});
  await form.locator('input[name="concentrar"]').evaluate(e => { e.checked = true; e.dispatchEvent(new Event("change", { bubbles: true })); });
  await jug.screenshot({ path: `${CAPTURES}/41-declarar.png`, timeout: 10000 }).catch(() => {});
  await enviar(form);
  // Es llegeix a la sessió del jugador (propietari): la del DJ rep els canvis amb molt retard en aquesta màquina.
  const r = await esperarQue(jug, ({ combat, cPJ, pj }) => {
    const c = game.combats.get(combat).combatants.get(cPJ);
    return { posicio: c.initiative, pendent: c.getFlag("forja", "accioPendent")?.tipus, arma: c.getFlag("forja", "accioPendent")?.label, concentrat: game.actors.get(pj).system.concentrat };
  }, ids, v => v.pendent === "atac" && v.concentrat);
  if (!(r.posicio > 0) || r.pendent !== "atac" || !r.concentrat) throw new Error(JSON.stringify(r));
  return r;
});

await prova("U3. El jugador resol l'atac contra el PNJ marcat: diàleg de defensa, atac al xat i concentració consumida", async () => {
  await jug.evaluate((tB) => canvas.tokens.get(tB).setTarget(true, { releaseOthers: true }), ids.tB);
  await esperar(500);
  const abansMsg = await dj.evaluate(() => game.messages.size);
  await jug.locator(`#combat .forja-resoldre[data-combatant-id="${ids.cPJ}"]`).dispatchEvent("click");
  // El diàleg de defensa del PNJ l'ha de rebre el DJ, no el jugador que ataca (Oriol FM).
  const alJugador = await esperarElement(jug.locator("form.dialeg-defensa").last(), 8000).then(() => true, () => false);
  const form = await esperarElement(dj.locator("form.dialeg-defensa").last(), 30000);
  const onEsObre = alJugador ? "Jugador (MALAMENT)" : "DJ";
  const p = dj;
  await p.screenshot({ path: `${CAPTURES}/42-defensa.png`, timeout: 10000 }).catch(() => {});
  await form.locator('input[name="opcioId"][value="passiva"]').evaluate(e => { e.checked = true; e.dispatchEvent(new Event("change", { bubbles: true })); });
  await enviar(form);
  const r = await esperarQue(dj, ({ pj, abansMsg }) => {
    const nous = game.messages.contents.slice(abansMsg);
    const atac = nous.find(m => m.content.includes("forja-missatge-atac") || m.content.includes("mt-"));
    return { missatgesNous: nous.length, missatgeAtac: !!atac, concentratDespres: game.actors.get(pj).system.concentrat,
             daus: atac?.rolls?.[0]?.dice?.[0]?.results?.length ?? null };
  }, { pj: ids.pj, abansMsg }, v => v.missatgeAtac && !v.concentratDespres);
  r.dialegDefensaObertA = onEsObre;
  if (!r.missatgeAtac || r.concentratDespres || onEsObre !== "DJ") throw new Error(JSON.stringify(r));
  return r;
});

await prova("U6. PNJ amb defensa automàtica: no pregunta a ningú i l'atac es resol sol", async () => {
  await dj.evaluate((pnj) => game.actors.get(pnj).update({ "system.defensaAutomatica": "passiva" }), ids.pnj);
  await esperar(1500);
  const abansMsg = await dj.evaluate(() => game.messages.size);
  await jug.locator(`#combat .forja-resoldre[data-combatant-id="${ids.cPJ}"]`).dispatchEvent("click");
  const r = await esperarQue(dj, (abansMsg) => ({ nous: game.messages.size - abansMsg,
    atac: game.messages.contents.slice(abansMsg).some(m => m.content.includes("forja-missatge-atac") || m.content.includes("mt-")) }), abansMsg, v => v.atac, 60000);
  const dialegs = { dj: await dj.locator("form.dialeg-defensa").count(), jugador: await jug.locator("form.dialeg-defensa").count() };
  await dj.evaluate((pnj) => game.actors.get(pnj).update({ "system.defensaAutomatica": "" }), ids.pnj);
  if (!r.atac || dialegs.dj || dialegs.jugador) throw new Error(JSON.stringify({ ...r, dialegs }));
  return { ...r, dialegs };
});

await prova("U4. Diàleg de curació des de la fitxa del jugador (primers auxilis al PNJ)", async () => {
  await dj.evaluate((pnj) => game.actors.get(pnj).update({ "system.salut.ferides.marcats": 4 }), ids.pnj);
  await jug.evaluate(async (pj) => { await game.actors.get(pj).sheet.render(true); }, ids.pj);
  await esperar(2500);
  const abansMsg = await dj.evaluate(() => game.messages.size);
  await jug.locator('[data-action="forjaObrirCuracio"]').first().dispatchEvent("click");
  const form = jug.locator("form.dialeg-curacio").last();
  await esperarElement(form);
  await form.locator('input[name="tipus"][value="primers-auxilis"]').evaluate(e => { e.checked = true; e.dispatchEvent(new Event("change", { bubbles: true })); });
  await jug.screenshot({ path: `${CAPTURES}/43-curacio.png`, timeout: 10000 }).catch(() => {});
  await enviar(form);
  const r = await esperarQue(dj, ({ pnj, abansMsg }) => ({ missatges: game.messages.size - abansMsg, ferides: game.actors.get(pnj).system.salut.ferides.marcats }), { pnj: ids.pnj, abansMsg }, v => v.missatges >= 1);
  if (r.missatges < 1) throw new Error(JSON.stringify(r));
  return r;
});

await prova("U5. Tirada des de la fitxa (atribut + habilitat) amb el diàleg de tirada", async () => {
  const abansMsg = await dj.evaluate(() => game.messages.size);
  const fitxa = jug.locator(".full-personatge").last();
  await fitxa.locator('.forja-attr-box[data-attr="AGI"]').first().dispatchEvent("click");
  await fitxa.locator('.forja-hab-fila[data-hab-id="esquivar"]').first().dispatchEvent("click");
  const form = jug.locator("form.dialeg-tirada").last();
  await esperarElement(form);
  await enviar(form);
  const r = await esperarQue(dj, (abansMsg) => { const m = game.messages.contents.at(-1); return { nous: game.messages.size - abansMsg, daus: m?.rolls?.[0]?.dice?.[0]?.results?.length, text: m?.content?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 120) }; }, abansMsg, v => v.nous >= 1);
  if (r.nous < 1 || r.daus !== 5) throw new Error(JSON.stringify(r) + " (esperats 5 daus: AGI 3 + esquivar 2)");
  await jug.evaluate(() => { for (const w of foundry.applications.instances.values()) if (w.document) w.close(); });
  return r;
});

// ===== Regles (DJ, daus forçats). Foundry fa cara = ceil((1 − r) · 10), per tant r = (10.5 − cara) / 10 =====
await dj.evaluate(() => {
  window.__cua = [];
  window.__daus = (...cares) => { window.__cua.push(...cares.map(c => (10.5 - c) / 10)); };
  CONFIG.Dice.randomUniform = () => window.__cua.length ? window.__cua.shift() : Math.random();
  window.__m = async () => ({
    atac: await import("/systems/forja/module/combat/atac.mjs"),
    def:  await import("/systems/forja/module/combat/defensa.mjs"),
    abast: await import("/systems/forja/module/combat/abast.mjs")
  });
  window.__reset = async (ids) => {
    for (const id of [ids.pj, ids.pnj]) {
      const a = game.actors.get(id);
      await a.update({ "system.salut.ferides.marcats": 0, "system.salut.fatiga.marcats": 0, "system.concentrat": false, "system.reaccions.gastades": 0 });
      for (const s of [...a.statuses]) await a.toggleStatusEffect(s, { active: false });
      const sobrants = a.items.filter(i => i.type === "armadura" || (i.type === "arma" && i.getFlag("forja", "catalegId") !== "cop")).map(i => i.id);
      if (sobrants.length) await a.deleteEmbeddedDocuments("Item", sobrants);
    }
  };
});
const regla = (nom, fn) => prova(nom, async () => { await dj.evaluate((ids) => window.__reset(ids), ids); return dj.evaluate(fn, ids); });

await regla("R1. Escopeta contra armadura rígida: protecció doblada (B13)", async (ids) => {
  const { atac } = await window.__m();
  const pj = game.actors.get(ids.pj), pnj = game.actors.get(ids.pnj);
  const [esc] = await pj.createEmbeddedDocuments("Item", [{ name: "Escopeta", type: "arma", system: { categoria: "distancia", danyBase: "DES+3", abast: 10, propietats: ["escopeta"] }, flags: { forja: { catalegId: "escopetes" } } }]);
  await pnj.createEmbeddedDocuments("Item", [{ name: "Rígida", type: "armadura", system: { tipus: "fisica", reduccio: 2 } }]);
  window.__daus(10, 10);                                  // 4 fites, excedent 4 → dany total 6+4 = 10
  const r = await atac.ferAtac({ actor: pj, objectiu: pnj, arma: esc, poolFinal: 2, dificultat: 0 });
  // 10 − armadura 2×2 − reducció FOR 2 = 4 (sense escopeta seria 6)
  if (r.dany?.danyFinal !== 4) throw new Error(JSON.stringify(r.dany));
  return r.dany;
});

await regla("R2. Dues armadures: rígida 3 + flexible 3 → 3 + ⌈3/2⌉ = 5 (manual l. 3337)", async (ids) => {
  const { atac } = await window.__m();
  const pj = game.actors.get(ids.pj), pnj = game.actors.get(ids.pnj);
  const cop = pj.items.find(i => i.getFlag("forja", "catalegId") === "cop");
  await pnj.createEmbeddedDocuments("Item", [{ name: "Rígida", type: "armadura", system: { tipus: "fisica", reduccio: 3, modLatencia: 1 } },
                                              { name: "Flexible", type: "armadura", system: { tipus: "flexible", reduccio: 3, modLatencia: 2 } }]);
  const latencia = game.actors.get(ids.pnj).system.latenciaBase;
  window.__daus(10, 10, 10, 10);                          // 8 fites → dany FOR+1 (3) + 8 = 11
  const r = await atac.ferAtac({ actor: pj, objectiu: pnj, arma: cop, poolFinal: 4, dificultat: 0 });
  // 11 − 5 − reducció 2 = 4
  if (r.dany?.danyFinal !== 4) throw new Error(JSON.stringify({ dany: r.dany, latencia }));
  return { dany: r.dany, latenciaPNJ: latencia };
});

await regla("R3. Pífia en esquivar: +1 per cada 1, sumat al dany final (B14)", async (ids) => {
  const { atac, def } = await window.__m();
  const pj = game.actors.get(ids.pj), pnj = game.actors.get(ids.pnj);
  const cop = pj.items.find(i => i.getFlag("forja", "catalegId") === "cop");
  const esquivar = def.opcionsDefensa(pnj).find(o => o.id === "esquivar");
  window.__daus(1, 1, 3, 4);                              // AGI 2 + esquivar 2 = 4 daus: dos 1, cap fita → pífia
  const res = await def.resoldreOpcioDefensa(pnj, esquivar, { nomAtacant: pj.name });
  window.__daus(10, 10, 10, 10, 10, 10);                  // atac de 6 daus: 12 fites
  const r = await atac.ferAtac({ actor: pj, objectiu: pnj, arma: cop, poolFinal: 6, dificultat: res.dificultat, exigirSuperar: res.exigirSuperar, danyExtra: res.danyExtra });
  const esperat = (3 + (12 - res.dificultat)) - 2 + 2;    // FOR+1 + excedent − reducció + pífia
  if (res.danyExtra !== 2 || r.dany?.danyFinal !== esperat) throw new Error(JSON.stringify({ res, dany: r.dany, esperat }));
  return { danyExtra: res.danyExtra, dificultat: res.dificultat, danyFinal: r.dany.danyFinal };
});

await regla("R4. Concentració del defensor trencada pel dany; dany > FOR → atordit (B5)", async (ids) => {
  const { atac } = await window.__m();
  const pj = game.actors.get(ids.pj), pnj = game.actors.get(ids.pnj);
  await pnj.update({ "system.concentrat": true });
  const cop = pj.items.find(i => i.getFlag("forja", "catalegId") === "cop");
  window.__daus(10, 10, 10);                              // 6 fites → dany 3+6−2 = 7 > FOR 2
  const r = await atac.ferAtac({ actor: pj, objectiu: pnj, arma: cop, poolFinal: 3, dificultat: 0 });
  await new Promise(r => setTimeout(r, 1000));
  const a = game.actors.get(ids.pnj);
  if (a.system.concentrat || !a.statuses.has("atordit")) throw new Error(JSON.stringify({ dany: r.dany?.danyFinal, concentrat: a.system.concentrat, estats: [...a.statuses] }));
  return { dany: r.dany.danyFinal, estats: [...a.statuses] };
});

await regla("R5. Maniobra d'arts marcials: +dificultat i estat aplicat en impactar (B6)", async (ids) => {
  const { atac } = await window.__m();
  const pj = game.actors.get(ids.pj), pnj = game.actors.get(ids.pnj);
  const maniobra = CONFIG.FORJA.LLISTA_MANIOBRES.find(m => m.estat && CONFIG.statusEffects.some(s => s.id === m.estat));
  if (!maniobra) throw new Error("cap maniobra amb estat al catàleg");
  const cop = pj.items.find(i => i.getFlag("forja", "catalegId") === "cop");
  window.__daus(10, 10, 10);
  const r = await atac.ferAtac({ actor: pj, objectiu: pnj, arma: cop, poolFinal: 3, dificultat: 1, maniobra });
  await new Promise(r => setTimeout(r, 1000));
  const dif = r.roll?.options?.forja?.dificultat;
  const te = game.actors.get(ids.pnj).statuses.has(maniobra.estat);
  if (dif !== 1 + maniobra.dificultat || !te) throw new Error(JSON.stringify({ maniobra: maniobra.id, dif, te }));
  return { maniobra: maniobra.id, estat: maniobra.estat, dificultat: dif };
});

await regla("R6. Blocar: mitjans segons l'arma atacant i escut (B15)", async (ids) => {
  const { def } = await window.__m();
  const pnj = game.actors.get(ids.pnj);
  const mitjans = (cat) => def.opcionsDefensa(pnj, undefined, { categoriaAtac: cat }).find(o => o.id === "blocar")?.mitjans?.map(m => m.id) ?? [];
  const senseEscut = { natural: mitjans("natural"), cosAcos: mitjans("cosAcos") };
  await pnj.createEmbeddedDocuments("Item", [{ name: "Escut", type: "arma", system: { categoria: "cosAcos", danyBase: "FOR+2", propietats: ["escut"] }, flags: { forja: { catalegId: "escuts" } } }]);
  const ambEscut = mitjans("cosAcos");
  if (senseEscut.natural.includes("resistencia") !== true || senseEscut.cosAcos.includes("resistencia") || !ambEscut.includes("escut"))
    throw new Error(JSON.stringify({ senseEscut, ambEscut }));
  return { senseEscut, ambEscut };
});

await regla("R7. Retard de barallar-se: +1 dau per tick de retard (B16)", async (ids) => {
  const { atac } = await window.__m();
  const pj = game.actors.get(ids.pj), pnj = game.actors.get(ids.pnj);
  const cop = pj.items.find(i => i.getFlag("forja", "catalegId") === "cop");
  const r = await atac.ferAtac({ actor: pj, objectiu: pnj, arma: cop, poolFinal: 4, dificultat: 0, retardBarallarse: 2 });
  const n = r.roll?.dice?.[0]?.results?.length;
  if (n !== 6) throw new Error(`daus: ${n} (esperats 4 + 2)`);
  return { daus: n };
});

await regla("R8. Penalització de salut a l'atac (+2 a nivell 5) i bloqueig a nivell 7 (B1)", async (ids) => {
  const { atac } = await window.__m();
  const pj = game.actors.get(ids.pj), pnj = game.actors.get(ids.pnj);
  const cop = pj.items.find(i => i.getFlag("forja", "catalegId") === "cop");
  await pj.update({ "system.salut.ferides.marcats": 12 });          // mida 3 → nivell 5 → penal 2
  const r1 = await atac.ferAtac({ actor: pj, objectiu: pnj, arma: cop, poolFinal: 2, dificultat: 1 });
  await pj.update({ "system.salut.ferides.marcats": 19 });          // nivell 7
  const r2 = await atac.ferAtac({ actor: pj, objectiu: pnj, arma: cop, poolFinal: 2, dificultat: 1 });
  const dif = r1?.roll?.options?.forja?.dificultat;
  if (dif !== 3 || r2) throw new Error(JSON.stringify({ penal: pj.system.salut.penalitzacio, dif, bloquejat: !r2 }));
  return { dificultatAmbPenal: dif, nivell7Bloquejat: !r2 };
});

await regla("R9. Ègida: es trenca i es reactiva quan el rellotge arriba al tick (B4)", async (ids) => {
  const { atac } = await window.__m();
  // Flux real: l'objectiu és l'actor del token (PNJ no enllaçat), com des del tracker.
  const combat = game.combats.get(ids.combat);
  const pj = game.actors.get(ids.pj), pnj = combat.combatants.get(ids.cPNJ).actor;
  const [arm] = await pnj.createEmbeddedDocuments("Item", [{ name: "Ègida", type: "armadura", system: { tipus: "flexible", reduccio: 0, egida: { activa: true, absorcio: 3 } } }]);
  const cop = pj.items.find(i => i.getFlag("forja", "catalegId") === "cop");
  const marcador0 = combat.marcador;
  window.__daus(10, 10);                                   // 4 fites → dany total 3+4 = 7 > 3
  await atac.ferAtac({ actor: pj, objectiu: pnj, arma: cop, poolFinal: 2, dificultat: 0 });
  await new Promise(r => setTimeout(r, 1000));
  const it = pnj.items.get(arm.id);
  const tick = it.getFlag("forja", "egidaReactivaAlTick");
  const trencada = it.system.egida.activa === false;
  if (typeof tick !== "number") throw new Error(JSON.stringify({ trencada, tick }));
  for (const c of combat.combatants) await combat.situarCombatent(c.id, tick + 1);
  for (let i = 0; i < 4 && !pnj.items.get(arm.id).system.egida.activa; i++) { await combat.nextTurn(); await new Promise(r => setTimeout(r, 1500)); }
  const reactivada = pnj.items.get(arm.id).system.egida.activa;
  if (!trencada || typeof tick !== "number" || !reactivada) throw new Error(JSON.stringify({ trencada, tick, marcador0, marcador: combat.marcador, reactivada }));
  return { marcadorInicial: marcador0, tickReactivacio: tick, marcadorFinal: combat.marcador, reactivada };
});

await regla("R10. Abast cos a cos amb tokens grans, de vora a vora (B9)", async (ids) => {
  const { abast } = await window.__m();
  if (!canvas?.ready) return "canvas no disponible: omesa";
  const scene = canvas.scene;
  const tA = scene.tokens.get(ids.tA), tB = scene.tokens.get(ids.tB);
  await tB.update({ width: 2, height: 2, x: 1100, y: 1000 }, { animate: false });
  await new Promise(r => setTimeout(r, 800));
  const adjacent = abast.tokensATocar(tA.object, tB.object);
  await tB.update({ x: 1200 }, { animate: false });
  await new Promise(r => setTimeout(r, 800));
  const ambForat = abast.tokensATocar(tA.object, tB.object);
  await tB.update({ width: 1, height: 1, x: 1100 }, { animate: false });
  if (!adjacent || ambForat) throw new Error(JSON.stringify({ adjacent, ambForat }));
  return { adjacent, ambForat };
});

await dj.screenshot({ path: `${CAPTURES}/50-final-dj.png`, timeout: 10000 }).catch(() => {});
console.log(JSON.stringify({ canvas: ids.canvas, resultats, errorsDJ: errDJ, errorsJugador: errJ }, null, 2));
await b.close();
