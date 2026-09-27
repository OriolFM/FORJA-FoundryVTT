// Utilitats compartides per a les proves de joc.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
export const BASE = "http://localhost:30000";
export const admin = () => readFileSync(process.env.FORJA_ADMIN_FILE ?? `${process.env.HOME}/foundry/proves/.admin`, "utf8").trim();
export async function navegador() {
  return chromium.launch({ executablePath: process.env.FORJA_CHROMIUM ?? "/snap/bin/chromium", args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
}
export function registrarErrors(p, etiqueta) {
  const errors = [];
  p.on("pageerror", e => errors.push(`[${etiqueta}] pageerror: ${e.message}`));
  p.on("console", m => { if (m.type() === "error") errors.push(`[${etiqueta}] console: ${m.text().slice(0, 300)}`); });
  return errors;
}
export async function entrarSetup(p) {
  await p.goto(`${BASE}/auth`); await p.waitForTimeout(2500);
  if (p.url().includes("/auth")) {
    await p.fill('input[name="adminPassword"]', admin());
    await p.locator('button[type="submit"]').first().click(); await p.waitForTimeout(4000);
  }
}
export async function unirse(p, usuari, contrasenya = "") {
  await p.goto(`${BASE}/join`); await p.waitForTimeout(4000);
  const idUsuari = await p.evaluate((nom) => [...document.querySelectorAll('select[name="userid"] option')].find(o => o.textContent.trim() === nom)?.value, usuari);
  if (!idUsuari) throw new Error(`Usuari ${usuari} no trobat a /join`);
  await p.selectOption('select[name="userid"]', idUsuari);
  if (contrasenya) await p.fill('input[name="password"]', contrasenya);
  await p.locator('button[name="join"]').click();
  await p.waitForFunction(() => window.game?.ready === true, null, { timeout: 120000 });
  // En la primera entrada d'un jugador, Foundry obre la tria de personatge (UserConfig): es tanca.
  await p.evaluate(() => { for (const a of foundry.applications.instances.values()) if (a.constructor.name === "UserConfig") a.close(); });
}
