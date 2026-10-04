/**
 * Anuncis de combat sobre la pantalla (fase de declaració, inici del temps
 * actiu, avanç del rellotge). Es mostren a tots els clients des del hook
 * `updateCombat` (forja.mjs), a partir dels canvis i de les opcions de l'update
 * (`options.forja`), que Foundry difon a tothom. No escriuen cap document.
 *
 * Els anuncis s'encuen: si n'arriben diversos alhora (p. ex. "Comença el temps
 * actiu" i "El rellotge avança 7 tics"), es mostren un darrere l'altre.
 */

const DURADA_MS = 2600;
const cua = [];
let mostrant = false;

/**
 * Mostra un anunci centrat a la pantalla.
 * @param {string} text
 * @param {object} [opts]
 * @param {string} [opts.icona="fa-clock"]  Classe Font Awesome
 */
export function mostrarAnunci(text, { icona = "fa-clock" } = {}) {
  cua.push({ text, icona });
  if (!mostrant) _seguent();
}

function _seguent() {
  const anunci = cua.shift();
  if (!anunci) { mostrant = false; return; }
  mostrant = true;
  const el = document.createElement("div");
  el.className = "forja-anunci";
  el.innerHTML = `<i class="fas ${anunci.icona}"></i><span></span>`;
  el.querySelector("span").textContent = anunci.text;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("visible"));
  setTimeout(() => {
    el.classList.remove("visible");
    setTimeout(() => { el.remove(); _seguent(); }, 400);
  }, DURADA_MS);
}

/**
 * Text de l'avanç del rellotge (singular/plural).
 * @param {number} n
 * @returns {string}
 */
export function textAvancTics(n) {
  return game.i18n.format(n === 1 ? "FORJA.Anunci.AvancTic" : "FORJA.Anunci.AvancTics", { n });
}

/**
 * Anuncis que corresponen a un update del combat (cridar a tots els clients).
 * @param {Combat} combat
 * @param {object} changes
 * @param {object} options
 */
export function anunciarCanvisCombat(combat, changes, options) {
  if (foundry.utils.getProperty(changes, "flags.forja.fase") === "declaracio") {
    mostrarAnunci(game.i18n.localize("FORJA.Anunci.Declareu"), { icona: "fa-stopwatch" });
  }
  const f = options?.forja ?? {};
  if (f.iniciTempsActiu) {
    mostrarAnunci(game.i18n.localize("FORJA.Anunci.IniciTempsActiu"), { icona: "fa-hourglass-start" });
  }
  if (f.avancTics > 0) mostrarAnunci(textAvancTics(f.avancTics));
}
