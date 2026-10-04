// Proves de joc del pla (docs/REVIEW-PLAN.md, "Verification after all waves").
// Dues sessions en el mateix navegador: DJ i Jugador. Cada prova escriu OK/KO.
import { navegador, registrarErrors, unirse } from "./comu.mjs";
const resultats = [];
const prova = async (nom, fn) => {
  try { const detall = await fn(); resultats.push({ nom, ok: true, detall }); }
  catch (e) { resultats.push({ nom, ok: false, detall: String(e.message ?? e).slice(0, 400) }); }
};
const esperar = (ms) => new Promise(r => setTimeout(r, ms));
const b = await navegador();
const ctxDJ = await b.newContext({ viewport: { width: 1400, height: 900 } });
const dj = await ctxDJ.newPage(); const errDJ = registrarErrors(dj, "DJ");
await unirse(dj, "Gamemaster");

// Preparació: usuari Jugador, actors nets
const ids = await dj.evaluate(async () => {
  for (const a of game.actors.filter(a => a.name.startsWith("Prova"))) await a.delete();
  for (const c of game.combats.contents) await c.delete();
  let u = game.users.getName("Jugador") ?? await User.create({ name: "Jugador", role: CONST.USER_ROLES.PLAYER });
  return { jugador: u.id };
});

const ctxJ = await b.newContext({ viewport: { width: 1400, height: 900 } });
const jug = await ctxJ.newPage(); const errJ = registrarErrors(jug, "Jugador");
await unirse(jug, "Jugador");
await esperar(2000);

await prova("1. Crear PJ i PNJ amb dos clients connectats: exactament un 'Cop' cadascun", async () => {
  const r = await dj.evaluate(async (jugadorId) => {
    const pj  = await Actor.create({ name: "Prova PJ", type: "personatge", ownership: { default: 0, [jugadorId]: 3 } });
    const pnj = await Actor.create({ name: "Prova PNJ", type: "pnj" });
    await new Promise(r => setTimeout(r, 4000));
    const cops = a => game.actors.get(a.id).items.filter(i => i.type === "arma" && i.getFlag("forja", "catalegId") === "cop").length;
    return { pj: cops(pj), pnj: cops(pnj) };
  }, ids.jugador);
  if (r.pj !== 1 || r.pnj !== 1) throw new Error(`Cops: ${JSON.stringify(r)}`);
  return r;
});

await prova("2. Fitxes: PJ, PNJ i objecte s'obren sense errors", async () => {
  const r = await dj.evaluate(async () => {
    const pj = game.actors.getName("Prova PJ"), pnj = game.actors.getName("Prova PNJ");
    await pj.sheet.render(true); await pnj.sheet.render(true);
    await new Promise(r => setTimeout(r, 2500));
    const item = pj.items.find(i => i.type === "arma"); await item.sheet.render(true);
    await new Promise(r => setTimeout(r, 2000));
    const out = { pj: !!pj.sheet.rendered, pnj: !!pnj.sheet.rendered, item: !!item.sheet.rendered, classeItem: item.sheet.constructor.name };
    return out;
  });
  await dj.screenshot({ path: `${process.env.FORJA_CAPTURES ?? process.env.HOME + "/foundry/proves/captures"}/20-fitxes.png` });
  await dj.evaluate(() => { for (const w of foundry.applications.instances.values()) if (w.document) w.close(); });
  if (!r.pj || !r.pnj || !r.item) throw new Error(JSON.stringify(r));
  return r;
});

await prova("3. Barres de salut del token: value/max derivats", async () => {
  return dj.evaluate(async () => {
    const a = game.actors.getName("Prova PJ");
    await a.update({ "system.salut.fatiga.marcats": 4 });
    const f = a.system.salut.fatiga;
    const bar = a.getBarAttribute?.("salut.fatiga");
    if (!(f.max === 6 * a.system.constitucio + 1 && f.value === f.max - 4)) throw new Error(JSON.stringify(f));
    if (bar && !(bar.value === f.value && bar.max === f.max)) throw new Error("getBarAttribute: " + JSON.stringify(bar));
    await a.update({ "system.salut.fatiga.marcats": 0 });
    return { max: f.max, value: f.value, bar: bar ? `${bar.value}/${bar.max}` : "n/d" };
  });
});

await prova("4. Gastar PX no consumeix pressupost de PC", async () => {
  return dj.evaluate(async () => {
    const { millorarAtribut, millorarHabilitat } = await import("/systems/forja/module/progressio/millora.mjs");
    const a = game.actors.getName("Prova PJ");
    await a.update({ "system.px.total": 50 });
    const abans = a.system.pcLliures;
    const r1 = await millorarAtribut(a, "FOR"); const r2 = await millorarHabilitat(a, "medicina");
    const despres = game.actors.get(a.id).system.pcLliures;
    if (abans !== despres) throw new Error(`pcLliures ${abans} → ${despres}`);
    return { pcLliures: despres, pxGastats: a.system.px.gastats, r1, r2 };
  });
});

await prova("5. Marcar un actor com a derrotat (estat 'dead')", async () => {
  return dj.evaluate(async () => {
    const a = game.actors.getName("Prova PNJ");
    await a.toggleStatusEffect(CONFIG.specialStatusEffects.DEFEATED, { active: true, overlay: true });
    const ok = a.statuses.has("dead");
    await a.toggleStatusEffect(CONFIG.specialStatusEffects.DEFEATED, { active: false });
    if (!ok) throw new Error("no té l'estat dead");
    return { defeated: CONFIG.specialStatusEffects.DEFEATED };
  });
});

await prova("6. Ordre de torns: empat a 0, A declara 5, el següent és B; reaccions reiniciades per A", async () => {
  return dj.evaluate(async () => {
    const A = game.actors.getName("Prova PJ"), B = game.actors.getName("Prova PNJ");
    const scene = game.scenes.active ?? await Scene.create({ name: "Prova", active: true });
    if (!scene.active) await scene.activate();
    for (const t of scene.tokens.contents) await t.delete();
    const [tA, tB] = await scene.createEmbeddedDocuments("Token", [
      { actorId: A.id, name: "A", x: 1000, y: 1000 }, { actorId: B.id, name: "B", x: 1100, y: 1000 }]);
    const combat = await Combat.create({ scene: scene.id, active: true });
    await combat.createEmbeddedDocuments("Combatant", [{ tokenId: tA.id, sceneId: scene.id, actorId: A.id }, { tokenId: tB.id, sceneId: scene.id, actorId: B.id }]);
    await combat.startCombat();
    for (const c of combat.combatants) await combat.situarCombatent(c.id, 0);
    const primer = combat.combatant;
    const altre  = combat.combatants.find(c => c.id !== primer.id);
    await primer.actor.update({ "system.reaccions.gastades": 1 });
    await combat.declararAccio(primer.id, 5);
    const actiuDespresDeclarar = combat.combatant?.id;
    await combat.nextTurn();
    await new Promise(r => setTimeout(r, 3000));
    const seguent = combat.combatant;
    const reaccionsPrimer = game.actors.get(primer.actorId).system.reaccions.gastades;
    const res = { primer: primer.name, actiuDespresDeclarar: actiuDespresDeclarar === primer.id ? "mateix" : "UN ALTRE", seguent: seguent?.name, esperat: altre.name, marcador: combat.marcador, reaccionsPrimer };
    if (seguent?.id !== altre.id) throw new Error("torn saltat: " + JSON.stringify(res));
    if (reaccionsPrimer !== 0) throw new Error("reaccions no reiniciades: " + JSON.stringify(res));
    return res;
  });
});

await prova("7. El jugador ataca el PNJ (que no és seu): dany aplicat via DJ, sense errors de permís", async () => {
  const abans = await dj.evaluate(() => game.actors.getName("Prova PNJ").system.salut.ferides.marcats);
  const r = await jug.evaluate(async () => {
    const { ferAtac } = await import("/systems/forja/module/combat/atac.mjs");
    const atacant = game.actors.getName("Prova PJ"); const objectiu = game.actors.getName("Prova PNJ");
    if (objectiu.isOwner) throw new Error("el jugador no hauria de ser propietari del PNJ");
    const arma = atacant.items.find(i => i.getFlag("forja", "catalegId") === "cop");
    let intents = 0, res;
    do { res = await ferAtac({ actor: atacant, objectiu, arma, poolFinal: 12, dificultat: 0 }); intents++; } while (!(res?.dany?.danyFinal > 0) && intents < 5);
    return { exit: res?.exit, danyFinal: res?.dany?.danyFinal, intents };
  });
  await esperar(2500);
  const despres = await dj.evaluate(() => game.actors.getName("Prova PNJ").system.salut.ferides.marcats);
  if (!(r.danyFinal > 0) || despres - abans !== r.danyFinal) throw new Error(`abans ${abans}, després ${despres}, ${JSON.stringify(r)}`);
  return { ...r, feridesAbans: abans, feridesDespres: despres };
});

await prova("8. El jugador defensa amb una reacció del PNJ? (ha de passar pel DJ) — gastar reacció d'un actor aliè", async () => {
  const r = await jug.evaluate(async () => {
    const { gastarReaccio } = await import("/systems/forja/module/combat/reaccions.mjs");
    const pnj = game.actors.getName("Prova PNJ");
    const ok = await gastarReaccio(pnj);
    return { ok };
  });
  await esperar(1500);
  const g = await dj.evaluate(() => game.actors.getName("Prova PNJ").system.reaccions.gastades);
  if (!r.ok || g < 1) throw new Error(JSON.stringify({ ...r, gastades: g }));
  return { ...r, gastades: g };
});

await prova("9. Seguretat: el jugador NO pot canviar camps no permesos d'un actor aliè", async () => {
  const r = await jug.evaluate(async () => {
    const { actualitzarComGM } = await import("/systems/forja/module/xarxa/socket.mjs");
    const pnj = game.actors.getName("Prova PNJ");
    try { await actualitzarComGM(pnj, { "system.atributs.FOR": 5 }); return { rebutjat: false }; }
    catch (e) { return { rebutjat: true, missatge: String(e.message).slice(0, 120) }; }
  });
  const f = await dj.evaluate(() => game.actors.getName("Prova PNJ").system.atributs.FOR);
  if (!r.rebutjat || f === 5) throw new Error(JSON.stringify({ ...r, FOR: f }));
  return r;
});

await prova("10. Idiomes: cap clau FORJA.* sense traduir a la fitxa en ca/es/en", async () => {
  const sortida = {};
  for (const lang of ["ca", "es", "en"]) {
    sortida[lang] = await dj.evaluate(async (lang) => {
      const t = await fetch(`/systems/forja/lang/${lang}.json`).then(r => r.json());
      const orig = game.i18n.translations; game.i18n.translations = foundry.utils.mergeObject(foundry.utils.deepClone(orig), foundry.utils.expandObject(t));
      const a = game.actors.getName("Prova PJ"); await a.sheet.render(true); await new Promise(r => setTimeout(r, 2000));
      const html = a.sheet.element.innerText; await a.sheet.close();
      game.i18n.translations = orig;
      return [...new Set(html.match(/FORJA\.[A-Za-z0-9.\-_]+/g) ?? [])];
    }, lang);
  }
  const falten = Object.entries(sortida).filter(([, v]) => v.length);
  if (falten.length) throw new Error(JSON.stringify(sortida));
  return "cap clau crua";
});

await dj.screenshot({ path: `${process.env.FORJA_CAPTURES ?? process.env.HOME + "/foundry/proves/captures"}/30-final-dj.png` });
await jug.screenshot({ path: `${process.env.FORJA_CAPTURES ?? process.env.HOME + "/foundry/proves/captures"}/31-final-jugador.png` });
console.log(JSON.stringify({ resultats, errorsDJ: errDJ, errorsJugador: errJ }, null, 2));
await b.close();
