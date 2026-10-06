import ForjaRoll from "../dice/forja-roll.mjs";
import { gastarReaccio, potReaccionar } from "./reaccions.mjs";
import { mitjansBlocar } from "./propietats.mjs";
import { danyExtraPifiaEsquivar } from "./dany.mjs";
import { restriccionsEstats } from "../estats/regles-estats.mjs";

/**
 * Defensa (S-13, manual p. 703-817; FC001CA, SISTEMES › Combat › Defensar-se).
 * Font ÚNICA de les opcions de defensa (B7): la fan servir tant el diàleg de
 * defensa en resoldre un atac (reaccions) com el diàleg de declarar acció
 * (acció defensiva completa, `declarada: true`).
 *
 *   - **Passiva**: valor `defensa` fix, sense cost ni tirada.
 *   - **Esquivar** / **Parar**: gasten una reacció i fan una tirada — el
 *     resultat (fites, amb un mínim de `defensa bàsica + 1`, manual p. 793/805)
 *     esdevé la dificultat que ha de SUPERAR l'atacant (no només igualar-la;
 *     empat → guanya el defensor, manual p. 777).
 *   - **Blocar**: gasta una reacció, sense tirada (dificultat = defensa
 *     bàsica, també cal superar-la), i suma a la reducció de dany del
 *     defensor l'habilitat del mitjà triat — resistència (cos, atacs sense
 *     armes), armes cos a cos (escut) o armes improvisades (altres objectes)
 *     —, fins a duplicar-la com a màxim (B15, › Defensar-se › Blocar; vegeu
 *     `mitjansBlocar` a `propietats.mjs`). `mitjans` porta les alternatives;
 *     `reduccioExtra` és la del millor mitjà (per defecte).
 *   - **Esquivar** espifiat (B14): +1 dany per cada 1 si l'atac impacta
 *     (vegeu `danyExtraPifiaEsquivar`).
 *
 * Salut (B1; FC001CA › Salut › Fatiga i ferides): la penalització del
 * DEFENSOR s'aplica a la seva tirada d'esquivar/parar restant-la de les
 * fites (en una tirada enfrontada, +X a la dificultat pròpia equival a X
 * fites menys). Un defensor fora de combat (nivell 7: inconscient/
 * incapacitat) no pot defensar-se activament i la seva defensa bàsica és 1
 * (› Defensar-se › Defensa bàsica: "Si l'objectiu ... l'han immobilitzat o
 * incapacitat ... la defensa bàsica és de 1").
 *
 * Estats (Fase 1; manual › Estats): abatut i atrapat no poden esquivar;
 * berserc no fa cap defensa activa; inconscient, incapacitat i marejat
 * tampoc. Immobilitzat, incapacitat i inconscient tenen defensa bàsica 1
 * (› Defensa bàsica, l. 3151). Les opcions bloquejades porten `bloquejatPer`
 * (l'estat que ho impedeix).
 *
 * @param {ForjaActor} objectiu
 * @param {number} [defensaBasica]  Defensa bàsica a fer servir com a base per a
 *   passiva/blocar i com a mínim d'esquivar/parar. Per defecte `objectiu.system.defensa`;
 *   els atacs a distància hi passen la dificultat ja resolta per rang (S-12,
 *   `combat/abast.mjs`) enlloc de la defensa bàsica sense modificar.
 * @param {object} [opcions]
 * @param {boolean} [opcions.declarada=false]  Opcions per a una acció defensiva
 *   DECLARADA (no reacció): sense "passiva", no gasten reacció i sempre disponibles
 *   (llevat que l'actor estigui fora de combat).
 * @param {"natural"|"cosAcos"|"distancia"|null} [opcions.categoriaAtac=null]  Categoria
 *   de l'arma atacant, per saber amb què es pot blocar (B15). `null` = desconeguda.
 * @param {number} [opcions.bonusDauDefensa=0]  Dau addicional a Esquivar/Parar
 *   (manual p. 611, avantatge d'abast en cos a cos — `abast.mjs`,
 *   `avantatgeAbastCosACos`). Passiva i Blocar no tiren daus.
 * @returns {Array<object>} opcions amb `id`, `nom`, `descripcio`, `disponible`, etc.
 */
export function opcionsDefensa(objectiu, defensaBasica = objectiu.system.defensa ?? 0, { declarada = false, categoriaAtac = null, bonusDauDefensa = 0 } = {}) {
  const sys = objectiu.system;
  const habilitat = (id) => sys.habilitats?.[id]?.nivell ?? 0;
  const reduccioNatural = sys.reduccioDany ?? 0;
  const foraDeCombat = !!sys.salut?.foraDeCombat;
  const penalSalut   = sys.salut?.penalitzacio ?? 0;
  const estats = restriccionsEstats(objectiu.statuses ?? []);
  if (foraDeCombat || estats.defensaBasica1) defensaBasica = 1;
  const actiuDisponible = !foraDeCombat && estats.potDefensaActiva && (declarada || potReaccionar(objectiu));
  const bloquejatPer = estats.motiuDefensaActiva;
  const desc = (id) => game.i18n.localize(`FORJA.Combat.Defensa.${id}${declarada ? "Desc" : "ReaccioDesc"}`);


  // Parar (manual p. 805): "DES + Armes cos a cos (si porta armes) o DES +
  // Arts Marcials/Barallar-se (si no en porta)". No es guarda enlloc quina
  // arma es porta "equipada" en aquest sistema, així que es fa servir la
  // millor de les tres habilitats de combat de l'objectiu — coincideix amb
  // l'exemple del manual (el gólem sense armes-cos-a-cos ni arts-marcials
  // para amb barallar-se, p. 1348 de l'exemple de combat).
  const parar = ["armes-cos-a-cos", "arts-marcials", "barallar-se"]
    .map(id => ({ id, nivell: habilitat(id) }))
    .sort((a, b) => b.nivell - a.nivell)[0];

  const opcions = [
    {
      id: "passiva", gastaReaccio: false, disponible: true, senseTirada: true,
      nom:        game.i18n.localize("FORJA.Combat.Defensa.Passiva"),
      descripcio: game.i18n.localize("FORJA.Combat.Defensa.PassivaReaccioDesc"),
      dificultat: defensaBasica,
      exigirSuperar: false
    },
    {
      id: "esquivar", gastaReaccio: true, disponible: actiuDisponible && estats.potEsquivar, senseTirada: false,
      bloquejatPer: estats.motiuEsquivar,
      nom:        game.i18n.localize("FORJA.Combat.Defensa.Esquivar"),
      descripcio: desc("Esquivar"), penalSalut,
      atribut: "AGI", atributVal: sys.atributs?.AGI ?? 0,
      habId: "esquivar", habNivell: habilitat("esquivar"),
      pool: (sys.atributs?.AGI ?? 0) + habilitat("esquivar") + bonusDauDefensa,
      exigirSuperar: true,
      dificultatMinima: defensaBasica + 1
    },
    {
      id: "parar", gastaReaccio: true, disponible: actiuDisponible, senseTirada: false,
      bloquejatPer,
      nom:        game.i18n.localize("FORJA.Combat.Defensa.Parar"),
      descripcio: desc("Parar"), penalSalut,
      atribut: "DES", atributVal: sys.atributs?.DES ?? 0,
      habId: parar.id, habNivell: parar.nivell,
      pool: (sys.atributs?.DES ?? 0) + parar.nivell + bonusDauDefensa,
      exigirSuperar: true,
      dificultatMinima: defensaBasica + 1
    },
    _opcioBlocar({
      disponible: actiuDisponible, bloquejatPer, descripcio: desc("Blocar"), dificultat: defensaBasica,
      mitjans: mitjansBlocar({ items: objectiu.items ?? [], habilitat, reduccioNatural, categoriaAtac })
    })
  ];

  if (!declarada) return opcions;
  return opcions
    .filter(o => o.id !== "passiva")
    .map(o => ({ ...o, gastaReaccio: false }));
}

/**
 * Construeix l'opció "blocar" a partir dels mitjans disponibles (B15).
 * @returns {object}
 */
function _opcioBlocar({ disponible, bloquejatPer = null, descripcio, dificultat, mitjans }) {
  const mitjansAmbNom = mitjans.map(m => ({
    ...m,
    nom: game.i18n.format(`FORJA.Combat.Blocar.Mitja.${m.id}`, { arma: m.nomArma ?? "" })
  }));
  return {
    id: "blocar", gastaReaccio: true, disponible, bloquejatPer, senseTirada: true,
    nom: game.i18n.localize("FORJA.Combat.Defensa.Blocar"),
    descripcio,
    dificultat,
    exigirSuperar: true,
    mitjans: mitjansAmbNom,
    mitjaId: mitjansAmbNom[0]?.id ?? null,
    reduccioExtra: mitjansAmbNom[0]?.reduccioExtra ?? 0
  };
}

/**
 * Aplica a una opció "blocar" el mitjà triat pel defensor (B15, funció pura).
 * Si l'opció no és blocar o el mitjà no és a la llista, la retorna igual.
 * @param {object} opcio
 * @param {string} mitjaId
 * @returns {object}
 */
export function triarMitjaBlocar(opcio, mitjaId) {
  if (opcio?.id !== "blocar" || !mitjaId) return opcio;
  const m = opcio.mitjans?.find(x => x.id === mitjaId);
  if (!m) return opcio;
  return { ...opcio, mitjaId: m.id, reduccioExtra: m.reduccioExtra, nomMitja: m.nom };
}

/**
 * Defensa resultant d'una tirada d'esquivar/parar (funció pura, B1/S-13):
 * fites menys la penalització de salut del defensor, amb un mínim de
 * `defensa bàsica + 1` (FC001CA › Defensar-se › Esquivar / Parar).
 * @param {number} fites
 * @param {number} penalSalut
 * @param {number} dificultatMinima
 * @returns {number}
 */
export function resultatDefensaActiva(fites, penalSalut, dificultatMinima) {
  return Math.max(Math.max(0, fites - (penalSalut ?? 0)), dificultatMinima ?? 0);
}

/**
 * "Defensar els altres" (manual p. 821-829, S-12): un PJ a tocar de
 * l'objectiu d'un atac pot interposar-s'hi, parant o blocant en el seu
 * lloc — mai esquivar (no es pot esquivar en nom d'un altre). Si l'atac
 * impacta, qui en rep el dany és qui s'interposa, no l'objectiu original.
 * Reaprofita `opcionsDefensa` tal qual (mateix mecanisme de Parar/Blocar,
 * amb la defensa bàsica del PROTECTOR): només es filtren les dues opcions
 * rellevants i s'hi marca qui s'interposa.
 *
 * **Deliberadament NO implementat**: la variant d'estirar/empènyer per
 * treure l'objectiu de l'abast de l'atac (manual p. 825, tirada
 * FOR+esquivar, estat Abatut segons diferència de mida) — és un mecanisme
 * propi diferent (mou l'objectiu, no redirigeix dany), no una simple
 * variant de blocar/parar.
 *
 * @param {ForjaActor} protector  Qui s'interposa (ha d'estar a tocar de l'objectiu original)
 * @param {object} [opcions]
 * @param {string|null} [opcions.categoriaAtac=null]  Vegeu `opcionsDefensa` (B15)
 * @returns {Array<object>} només `parar`/`blocar`, amb `interposant` = protector
 */
export function opcionsInterposar(protector, { categoriaAtac = null } = {}) {
  return opcionsDefensa(protector, undefined, { categoriaAtac })
    .filter(o => o.id === "parar" || o.id === "blocar")
    .map(o => ({
      ...o,
      id: `interposar:${protector.id}:${o.id}`,
      nom: game.i18n.format("FORJA.Combat.Defensa.Interposar", { nom: protector.name, accio: o.nom }),
      interposant: protector
    }));
}

/**
 * Resol l'opció de defensa triada: gasta la reacció si escau i, si és
 * esquivar/parar, fa la tirada que fixarà la dificultat de l'atacant i la
 * publica al xat (B10).
 *
 * @param {ForjaActor} objectiu
 * @param {object} opcio  Una de les entrades de `opcionsDefensa`
 * @param {object} [context]
 * @param {string} [context.nomAtacant]  Per al missatge de xat
 * @returns {Promise<{dificultat:number, exigirSuperar:boolean, reduccioExtra:number, danyExtra:number, roll:ForjaRoll|null}|null>}
 *   `danyExtra` (B14): dany addicional que rep el defensor si l'atac impacta
 *   perquè ha espifiat la tirada d'esquivar.
 *   `null` si calia gastar una reacció i l'objectiu ja no en té disponible (concurrència).
 */
export async function resoldreOpcioDefensa(objectiu, opcio, { nomAtacant = null } = {}) {
  if (opcio.gastaReaccio) {
    const ok = await gastarReaccio(objectiu);
    if (!ok) return null;
  }

  if (opcio.senseTirada) {
    return {
      dificultat:    opcio.dificultat,
      exigirSuperar: opcio.exigirSuperar,
      reduccioExtra: opcio.reduccioExtra ?? 0,
      danyExtra:     0,
      roll: null
    };
  }

  const roll = new ForjaRoll(`${Math.max(1, opcio.pool)}d10`, {}, { forja: { dificultat: 1 } });
  await roll.evaluate();

  const penalSalut = opcio.penalSalut ?? 0;
  const dificultat = resultatDefensaActiva(roll.forjaResults.fites, penalSalut, opcio.dificultatMinima);
  const danyExtra  = opcio.id === "esquivar" ? danyExtraPifiaEsquivar(roll.forjaResults) : 0;

  const content = await foundry.applications.handlebars.renderTemplate("systems/forja/templates/combat/missatge-defensa.hbs", {
    // Primer les dades de la tirada: la seva `dificultat` interna (1) no ha de
    // tapar la defensa resultant, que és la que es mostra.
    ...roll.forjaResults,
    nomDefensor: objectiu.name,
    nomAtacant,
    nomOpcio:    opcio.nom,
    atribut:     opcio.atribut,
    habId:       opcio.habId,
    penalSalut,
    dificultatMinima: opcio.dificultatMinima ?? 0,
    minimAplicat: (roll.forjaResults.fites - penalSalut) < (opcio.dificultatMinima ?? 0),
    dificultat,
    danyExtra
  });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: objectiu }),
    content,
    rolls:   [roll],
    sound:   CONFIG.sounds.dice
  });

  return {
    dificultat,
    exigirSuperar: opcio.exigirSuperar,
    reduccioExtra: 0,
    danyExtra,
    roll
  };
}

/**
 * Tria automàtica de la defensa d'un PNJ segons `system.defensaAutomatica`
 * (petició de l'Oriol FM, 2026-09-27: "poder configurar models perquè puguin
 * triar certes accions automàtiques, com a mínim amb els minions"). Funció pura.
 *
 *   - "" (o sense valor): no hi ha tria automàtica → `null` (cal preguntar-ho).
 *   - "passiva": sempre la defensa passiva.
 *   - "esquivar" / "parar" / "blocar": aquesta opció si està disponible (té
 *     reacció i no està concentrat); si no, la passiva.
 *   - "millor": l'esquiva o la parada amb més daus, si en té cap de disponible;
 *     si no, la passiva. (No tria blocar: depèn del mitjà i és una decisió tàctica.)
 *
 * @param {Array<object>} opcions  Sortida d'`opcionsDefensa`
 * @param {string} [mode]
 * @returns {object|null}  L'opció triada, o `null` si cal preguntar
 */
export function triarDefensaAutomatica(opcions, mode) {
  if (!mode) return null;
  const passiva = opcions.find(o => o.id === "passiva") ?? null;
  if (mode === "passiva") return passiva;
  if (mode === "millor") {
    const actives = opcions.filter(o => ["esquivar", "parar"].includes(o.id) && o.disponible);
    if (!actives.length) return passiva;
    return actives.reduce((a, b) => ((b.pool ?? 0) > (a.pool ?? 0) ? b : a));
  }
  const triada = opcions.find(o => o.id === mode && o.disponible);
  return triada ?? passiva;
}
