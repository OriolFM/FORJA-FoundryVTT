// Crea (si cal) i llança el món de proves amb el sistema forja.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const admin = readFileSync(process.env.FORJA_ADMIN_FILE ?? `${process.env.HOME}/foundry/proves/.admin`, "utf8").trim();
const b = await chromium.launch({ executablePath: process.env.FORJA_CHROMIUM ?? "/snap/bin/chromium", args: ["--no-sandbox"] });
const p = await b.newPage();
const errors = [];
p.on("pageerror", e => errors.push(e.message));
await p.goto("http://localhost:30000/auth");
await p.waitForTimeout(3000);
await p.fill('input[name="adminPassword"]', admin);
await p.locator('button[type="submit"]').first().click();
await p.waitForTimeout(6000);
console.log("URL:", p.url());
// v13: POST /setup; v14: la creació de mons és a POST /create.
const post = (body, ruta = "/setup") => p.evaluate(async ({ b, ruta }) => {
  const r = await fetch(ruta, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
  return { status: r.status, text: (await r.text()).slice(0, 300) };
}, { b: body, ruta });
const sistemes = await p.evaluate(() => [...(game.systems?.keys?.() ?? [])]);
console.log("Sistemes detectats:", JSON.stringify(sistemes));
const dadesMon = { action: "createWorld", id: "proves-forja", title: "Proves FORJA", system: "forja" };
let res = await post(dadesMon);
if (res.status === 400 && res.text.includes("Unsupported")) res = await post(dadesMon, "/create");
console.log("Crear món:", JSON.stringify(res));
console.log("Errors de pàgina:", errors.slice(0, 5));
await b.close();
