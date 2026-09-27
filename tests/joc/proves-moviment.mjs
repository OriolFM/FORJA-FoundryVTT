// Proves de joc del moviment (0.5.0): límit per torn, distància acumulativa,
// bloqueig entre tokens i camí que voreja obstacles. Sessions de DJ i Jugador.
// Escena quadrada de 100 px per casella i 1 m per casella. Vegeu tests/joc/README.md.
import { navegador, registrarErrors, unirse } from "./comu.mjs";
const LIMIT_PROVA = Number(process.env.FORJA_LIMIT_PROVA ?? 240000);
const resultats = [];
const esperar = (ms) => new Promise(r => setTimeout(r, ms));
const prova = async (nom, fn) => {
  const limit = new Promise((_, rej) => setTimeout(() => rej(new Error("temps esgotat")), LIMIT_PROVA));
  try { resultats.push({ nom, ok: true, detall: await Promise.race([fn(), limit]) }); }
  catch (e) { resultats.push({ nom, ok: false, detall: String(e.message ?? e).slice(0, 500) }); }
  const r = resultats.at(-1); console.error(`${r.ok ? "OK" : "KO"} ${nom}`);
};
const b = await navegador();
const dj = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
const errDJ = registrarErrors(dj, "DJ");
await unirse(dj, "Gamemaster");

// ---- Preparació ----
const ids = await dj.evaluate(async () => {
  for (const a of game.actors.filter(a => a.name.startsWith("Prova"))) await a.delete();
  for (const c of game.combats.contents) await c.delete();
  const jug = game.users.getName("Jugador") ?? await User.create({ name: "Jugador", role: CONST.USER_ROLES.PLAYER });
  const scene = game.scenes.active ?? await Scene.create({ name: "Prova", active: true });
  await scene.update({ "grid.size": 100, "grid.type": CONST.GRID_TYPES.SQUARE, "grid.distance": 1, width: 4000, height: 3000 });
  for (const t of scene.tokens.contents) await t.delete();
  for (const w of scene.walls.contents) await w.delete();
  const pj = await Actor.create({ name: "Prova PJ", type: "personatge", ownership: { default: 0, [jug.id]: 3 } });
  await pj.update({ "system.atributs.AGI": 3, "system.mida": 3 });
  const nou = async (nom, mida) => { const a = await Actor.create({ name: nom, type: "pnj" }); await a.update({ "system.mida": mida }); return a; };
  const aliat3 = await nou("Prova Aliat3", 3), aliat2 = await nou("Prova Aliat2", 2), enemic2 = await nou("Prova Enemic2", 2), enemic = await nou("Prova Enemic", 3);
  const D = CONST.TOKEN_DISPOSITIONS;
  const tok = async (a, x, y, disposition) => ({ ...(await a.getTokenDocument({ x, y })).toObject(), disposition });
  // Bloquejadors aparcats lluny (fila y = 2500); cada prova els col·loca on toca.
  const toks = await scene.createEmbeddedDocuments("Token", [
    await tok(pj, 1000, 1000, D.FRIENDLY), await tok(aliat3, 500, 2500, D.FRIENDLY), await tok(aliat2, 700, 2500, D.FRIENDLY),
    await tok(enemic2, 900, 2500, D.HOSTILE), await tok(enemic, 3500, 2500, D.HOSTILE)]);
  const [tPJ, tA3, tA2, tE2, tE] = toks.map(t => t.id);
  const combat = await Combat.create({ scene: scene.id, active: true });
  await combat.createEmbeddedDocuments("Combatant", [{ tokenId: tPJ, sceneId: scene.id, actorId: pj.id }, { tokenId: tE, sceneId: scene.id, actorId: enemic.id }]);
  const cPJ = combat.combatants.find(c => c.tokenId === tPJ).id, cE = combat.combatants.find(c => c.tokenId === tE).id;
  return { jug: jug.id, scene: scene.id, pj: pj.id, tPJ, tA3, tA2, tE2, tE, combat: combat.id, cPJ, cE };
});
const jug = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
const errJ = registrarErrors(jug, "Jugador");
await unirse(jug, "Jugador");
await esperar(2000);

// Utilitats (a la pàgina): posició del PJ, moure'l, i col·locar un token (DJ).
const posPJ = () => dj.evaluate((ids) => { const t = game.scenes.get(ids.scene).tokens.get(ids.tPJ); return { x: t.x, y: t.y }; }, ids);
const moureJugador = (dx, dy) => jug.evaluate(async ({ ids, dx, dy }) => {
  const t = game.scenes.get(ids.scene).tokens.get(ids.tPJ);
  let ok;
  try { ok = await t.move([{ x: t.x + dx, y: t.y + dy }], { animation: { duration: 0 } }); } catch (e) { ok = `error: ${e.message}`; }
  await new Promise(r => setTimeout(r, 1500));
  return ok;
}, { ids, dx, dy });
const posar = (tokenId, x, y) => dj.evaluate(async ({ ids, tokenId, x, y }) => {
  await game.scenes.get(ids.scene).tokens.get(tokenId).update({ x, y }, { animate: false, teleport: true, forjaDJ: true });
}, { ids, tokenId, x, y });
// Dona el torn a un combatent (nextTurn fins que li toqui) i espera que el jugador ho vegi.
const ferActiu = async (cId) => {
  await dj.evaluate(async ({ ids, cId }) => {
    // Com fa el sistema: el torn és de qui marca flags.forja.actiu (i l'índex turn que hi apunta).
    const c = game.combats.get(ids.combat);
    await c.situarCombatent(cId, c.marcador ?? 0);
    const turn = c.turns.findIndex(t => t.id === cId);
    await c.update({ turn, "flags.forja.actiu": cId });
  }, { ids, cId });
  const fi = Date.now() + 60000;
  while (Date.now() < fi) {
    const vist = await jug.evaluate(({ ids, cId }) => game.combats.get(ids.combat)?.combatant?.id === cId, { ids, cId });
    if (vist) return true;
    await esperar(500);
  }
  return false;
};
const reiniciarTorn = () => dj.evaluate(async (ids) => { await game.scenes.get(ids.scene).tokens.get(ids.tPJ).clearMovementHistory(); }, ids);
const camiJugador = (dx, dy) => jug.evaluate(async ({ ids, dx, dy }) => {
  const tok = canvas.tokens.get(ids.tPJ);
  const o = { x: tok.document.x, y: tok.document.y, elevation: 0 };
  const job = tok.findMovementPath([o, { x: o.x + dx, y: o.y + dy, elevation: 0 }], { preview: true });
  const cami = await job.promise;
  const ultim = cami.at(-1);
  return { punts: cami.length, cami: cami.map(w => `${w.x},${w.y}`).join(" → "), arriba: ultim?.x === o.x + dx && ultim?.y === o.y + dy };
}, { ids, dx, dy });

await prova("M1. Fitxa: caminar 6, córrer 15, saltar 9 (AGI 3, MID 3)", async () => {
  const m = await dj.evaluate((pj) => game.actors.get(pj).system.moviment, ids.pj);
  if (m?.caminar !== 6 || m?.correr !== 15 || m?.saltar !== 9) throw new Error(JSON.stringify(m));
  return m;
});

await prova("M2. Fora del seu torn, el jugador no pot moure el token", async () => {
  await dj.evaluate(async (ids) => {
    const c = game.combats.get(ids.combat);
    await c.startCombat();
    for (const cb of c.combatants) await c.situarCombatent(cb.id, 0);   // tothom al rellotge
  }, ids);
  await esperar(1500);
  const actiu = await ferActiu(ids.cE);
  const abans = await posPJ(); const r = await moureJugador(100, 0); const despres = await posPJ();
  if (!actiu || despres.x !== abans.x) throw new Error(JSON.stringify({ actiuEsEnemic: actiu, abans, despres, r }));
  return { actiuEsEnemic: actiu, bloquejat: true };
});

await prova("M3. En el seu torn: caminar acumulatiu (2 + 3 + 1 = 6 m permesos; 1 m més, bloquejat)", async () => {
  const actiu = await ferActiu(ids.cPJ);
  await reiniciarTorn(); await esperar(1000);
  const x0 = (await posPJ()).x;
  const passos = [];
  for (const m of [2, 3, 1, 1]) { await moureJugador(100 * m, 0); passos.push(((await posPJ()).x - x0) / 100); }
  // esperat: 2, 5, 6, 6
  if (!actiu || passos.join() !== "2,5,6,6") throw new Error(JSON.stringify({ actiu, passos }));
  return { actiu, metresAcumulats: passos };
});

// A partir d'aquí es proven els camins: es torna el PJ a (1000,1000) i es buida l'historial abans de cada prova.
const inici = async () => { await ferActiu(ids.cPJ); await posar(ids.tPJ, 1000, 1000); await reiniciarTorn(); await esperar(1500); };

await prova("M4. Un aliat de mida 3 al mig: el camí el voreja", async () => {
  await inici(); await posar(ids.tA3, 1100, 1000); await esperar(1500);
  const c = await camiJugador(200, 0);
  await posar(ids.tA3, 500, 2500);
  if (!c.arriba || c.punts < 3 || c.cami.includes("1100,1000")) throw new Error(JSON.stringify(c));
  return c;
});

await prova("M5. Un aliat de mida 2 al mig: es travessa en línia recta", async () => {
  await inici(); await posar(ids.tA2, 1100, 1000); await esperar(1500);
  const c = await camiJugador(200, 0);
  const abans = await posPJ(); await moureJugador(200, 0); const despres = await posPJ();
  await posar(ids.tA2, 700, 2500);
  if (!c.arriba || c.punts !== 2 || despres.x - abans.x !== 200) throw new Error(JSON.stringify({ c, abans, despres }));
  return { ...c, mogut: (despres.x - abans.x) / 100 };
});

await prova("M6. Un enemic de mida 2 al mig: el camí el voreja", async () => {
  await inici(); await posar(ids.tE2, 1100, 1000); await esperar(1500);
  const c = await camiJugador(200, 0);
  await posar(ids.tE2, 900, 2500);
  if (!c.arriba || c.punts < 3 || c.cami.includes("1100,1000")) throw new Error(JSON.stringify(c));
  return c;
});

await prova("M7. No es pot acabar el moviment sobre un altre token (aliat de mida 2)", async () => {
  await inici(); await posar(ids.tA2, 1100, 1000); await esperar(1500);
  const abans = await posPJ(); await moureJugador(100, 0); const despres = await posPJ();
  await posar(ids.tA2, 700, 2500);
  if (despres.x === 1100) throw new Error(JSON.stringify({ abans, despres }));
  return { abans, despres };
});

await prova("M8. Un mort de mida 3 al mig: no bloqueja", async () => {
  await inici(); await posar(ids.tA3, 1100, 1000);
  await dj.evaluate(async (ids) => { const a = game.scenes.get(ids.scene).tokens.get(ids.tA3).actor; await a.toggleStatusEffect(CONFIG.specialStatusEffects.DEFEATED, { active: true, overlay: true }); }, ids);
  await esperar(1500);
  const c = await camiJugador(200, 0);
  await dj.evaluate(async (ids) => { const a = game.scenes.get(ids.scene).tokens.get(ids.tA3).actor; await a.toggleStatusEffect(CONFIG.specialStatusEffects.DEFEATED, { active: false }); }, ids);
  await posar(ids.tA3, 500, 2500);
  if (!c.arriba || c.punts !== 2) throw new Error(JSON.stringify(c));
  return c;
});

await prova("M9. Una paret al mig: el camí la voreja", async () => {
  await inici();
  await dj.evaluate(async (ids) => { await game.scenes.get(ids.scene).createEmbeddedDocuments("Wall", [{ c: [1200, 900, 1200, 1200] }]); }, ids);
  await esperar(2000);
  const c = await camiJugador(200, 0);
  await dj.evaluate(async (ids) => { const s = game.scenes.get(ids.scene); await s.deleteEmbeddedDocuments("Wall", s.walls.map(w => w.id)); }, ids);
  if (!c.arriba || c.punts < 3) throw new Error(JSON.stringify(c));
  return c;
});

await prova("M10. El DJ mou el token del PJ fora del torn i sense límit", async () => {
  await dj.evaluate(async (ids) => { const c = game.combats.get(ids.combat); await c.situarCombatent(ids.cE, 0); await c.situarCombatent(ids.cPJ, 5); }, ids);
  await esperar(1500);
  const abans = await posPJ();
  await dj.evaluate(async (ids) => { const t = game.scenes.get(ids.scene).tokens.get(ids.tPJ); await t.move([{ x: t.x + 1000, y: t.y }], { animation: { duration: 0 } }); }, ids);
  await esperar(2000);
  const despres = await posPJ();
  if (despres.x - abans.x !== 1000) throw new Error(JSON.stringify({ abans, despres }));
  return { metres: (despres.x - abans.x) / 100 };
});

console.log(JSON.stringify({ resultats, errorsDJ: errDJ, errorsJugador: errJ }, null, 2));
await b.close();
