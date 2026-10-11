/**
 * Identificadors dels documents dels compendis (Node), compartits per
 * `scripts/build-packs.mjs` i altres eines.
 */
import crypto from "node:crypto";

const ALFABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** _id determinista de 16 caràcters alfanumèrics a partir d'una clau (hash). */
export function idDeterminista(clau) {
  const hash = crypto.createHash("sha256").update(clau).digest();
  let id = "";
  for (let i = 0; i < 16; i++) id += ALFABET[hash[i] % ALFABET.length];
  return id;
}

/** _id aleatori de 16 caràcters, com els de Foundry. */
export function idAleatori() {
  return [...crypto.randomBytes(16)].map(b => ALFABET[b % ALFABET.length]).join("");
}
