// Accepta l'EULA i activa la llicència al servidor local. No imprimeix la clau.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const clau = readFileSync(process.env.FORJA_CLAU, "utf8").trim();
const b = await chromium.launch({ executablePath: process.env.FORJA_CHROMIUM ?? "/snap/bin/chromium", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.goto("http://localhost:30000/license");
await p.waitForTimeout(5000);
if (await p.locator("#eula-agree").count()) {
  await p.locator("#eula-agree").check();
  await p.locator("#sign").click();
  await p.waitForTimeout(5000);
}
const camps = await p.evaluate(() => [...document.querySelectorAll("input,button")].map(e => `${e.tagName}:${e.name}:${e.id}:${e.type}`).join(" | "));
console.log("Després de l'EULA:", p.url(), "\n", camps);
const input = p.locator('input[name="licenseKey"]');
if (await input.count()) {
  await input.fill(clau);
  await p.locator('button[type="submit"]').first().click();
  await p.waitForTimeout(6000);
}
console.log("URL final:", p.url());
await p.screenshot({ path: `${process.env.FORJA_CAPTURES ?? process.env.HOME + "/foundry/proves/captures"}/04-activacio.png` });
await b.close();
