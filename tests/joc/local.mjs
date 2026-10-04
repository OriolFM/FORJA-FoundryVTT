// Connexió a un Foundry local ja obert (p. ex. l'aplicació d'Electron a
// Windows) com a segon client, per fer proves o inspeccionar l'estat del món
// sense tancar la sessió de qui juga. Vegeu docs/PROVES.md, «Proves contra el
// Foundry local (Windows)».
//
//   import { obrir } from "./local.mjs";
//   const { b, p, errors } = await obrir();      // p = pàgina de Playwright amb el joc carregat
//   console.log(await p.evaluate(() => game.combat?.marcador));
//   await b.close();
//
// Variables d'entorn:
//   FORJA_URL        (per defecte http://localhost:30000)
//   FORJA_USUARI     (per defecte Gamemaster)
//   FORJA_NAVEGADOR  (per defecte l'Edge de Windows)
import { chromium } from "playwright";

const URL_FOUNDRY = process.env.FORJA_URL ?? "http://localhost:30000";
const NAVEGADOR = process.env.FORJA_NAVEGADOR ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

export async function obrir(usuari = process.env.FORJA_USUARI ?? "Gamemaster", contrasenya = "") {
  const b = await chromium.launch({
    executablePath: NAVEGADOR,
    headless: true,
    // Sense GPU, el canvas surt negre: WebGL per programari.
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
  });
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", e => errors.push(`pageerror: ${e.message}\n${(e.stack ?? "").split("\n").slice(0, 6).join("\n")}`));
  p.on("console", m => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`); });
  await p.goto(`${URL_FOUNDRY}/join`);
  await p.waitForTimeout(2500);
  // v14: camp de text; v13: llista desplegable.
  if (await p.locator('input[name="username"]').count()) {
    await p.fill('input[name="username"]', usuari);
  } else {
    const id = await p.evaluate(nom => [...document.querySelectorAll('select[name="userid"] option')].find(o => o.textContent.trim() === nom)?.value, usuari);
    await p.selectOption('select[name="userid"]', id);
  }
  if (contrasenya) await p.fill('input[name="password"]', contrasenya);
  await p.locator('button[name="join"]').click();
  await p.waitForFunction(() => window.game?.ready === true, null, { timeout: 120000 });
  await p.waitForTimeout(2000);
  return { b, p, errors };
}
