import { ferAtac } from "./atac.mjs";
import { opcionsDefensa, resoldreOpcioDefensa } from "./defensa.mjs";
import { objectiusEsferic, puntColisio, tokensEnCaselles } from "./area.mjs";
import { aplicarDanyAPista } from "./dany.mjs";
import { actualitzarComGM, alternarEstatComGM, crearEmbegutsComGM } from "../xarxa/socket.mjs";

/**
 * Maniobres d'Arts Marcials (S-12, manual p. 631-651). Només disponibles
 * atacant amb "Cop" (l'única arma natural que la taula del manual llista
 * amb l'opció d'Arts Marcials — la resta d'armes naturals tenen el seu
 * propi moviment especial, diferent per a cadascuna i encara sense fer).
 *
 * Abast d'aquesta peça: els efectes que es poden aplicar com a pas
 * POSTERIOR a un `ferAtac` normal ja reeixit (aplicar un estat, o
 * —Puntada de peu giratòria— repetir la resolució contra més d'un
 * objectiu) — i que per tant no calia tocar `ferAtac`/`calcularDany` per
 * dins. L'estat de la maniobra i Cop penetrant (ignora armadures naturals i
 * flexibles) ja els aplica `ferAtac` (B6). **Deliberadament fora d'aquesta
 * peça** (necessiten tocar el pipeline de dany o l'economia de reaccions
 * per dins, cadascuna amb el seu propi matís, documentat com a pendent):
 *   - Dim Mak (triar dany a ferides o el doble a fatiga): toca el
 *     pipeline de dany per dins.
 *   - Combinació (2 cops en 2 torns consecutius): estat entre activacions.
 *   - Contraatac (reacció fora de seqüència): s'ha d'enganxar al flux
 *     de `resoldreOpcioDefensa`, no al de declarar.
 *
 * Llançament SÍ és en aquest fitxer (`resoldreLlancament`, més avall):
 * un cop l'atac normal ja ha impactat, només cal moure el token de
 * l'objectiu i, si topa amb un mur o un altre combatent, preguntar al DJ
 * quant dany addicional vol aplicar-hi — no toca el pipeline de dany de
 * `ferAtac`.
 */

/** Maniobres que apliquen un estat senzill en impactar (Dislocar, Engrapar, Interrupció). */
export async function aplicarEfecteManiobra(maniobra, objectiu) {
  if (!maniobra?.estat) return;
  if (!objectiu.statuses?.has(maniobra.estat)) {
    await alternarEstatComGM(objectiu, maniobra.estat, true);
  }
  // Interrupció (manual p. 641): a més de l'atordit, +2 de llatència a la
  // PROPERA acció de l'objectiu — reaprofita el mateix mecanisme de
  // Lent/X (M-05, estats-parametritzats.mjs) amb una marca `autoconsum`
  // perquè es retiri sol un cop usat (consumit a `tracker-ui.mjs`, quan
  // l'objectiu torna a declarar).
  if (maniobra.id === "interrupcio") {
    await crearEmbegutsComGM(objectiu, "ActiveEffect", [{
      name: game.i18n.format("FORJA.Combat.LentPerManiobra", { nom: maniobra.nom }),
      statuses: ["lent"],
      img: "icons/svg/downgrade.svg",
      flags: { forja: { valorX: 2, autoconsum: true } }
    }]);
  }
}

/**
 * Puntada de peu giratòria (manual p. 651): esfèric radi 2 centrat en
 * l'atacant (només caselles adjacents — radi 2 = l'atacant, que no
 * s'afecta, + 1 anell), resolt SEQÜENCIALMENT (no tots els objectius
 * alhora): continua colpejant fins que s'acaben els objectius o algun
 * PARA o BLOCA el cop (esquivar-lo NO l'atura — l'atac segueix girant
 * cap al següent).
 *
 * Per cada objectiu es mostra el mateix diàleg de defensa que un atac
 * normal (mateixa `opcionsDefensa`/`DiategDefensa`/`resoldreOpcioDefensa`
 * ja existents) — l'única diferència és que s'encadenen diversos, un
 * darrere l'altre, en lloc d'un de sol.
 *
 * @param {object} p
 * @param {ForjaActor} p.actor       Atacant
 * @param {Token} p.tokenAtacant
 * @param {Item} p.arma              Ha de ser "Cop"
 * @param {number} p.poolFinal       Ja calculat amb Arts Marcials + maniobra
 * @param {object} p.maniobra
 * @param {(objectiu:ForjaActor)=>Promise<object|null>} p.demanarDefensa
 *   Crida que obre el diàleg de defensa per a `objectiu` i retorna
 *   l'opció triada (o `null` si es cancel·la) — injectada des de
 *   `tracker-ui.mjs` perquè aquest mòdul no depengui de `DiategDefensa`.
 * @returns {Promise<{resultats:Array<object>, aturat:boolean}>}
 */
export async function resoldrePuntadaDePeuGiratoria({ actor, tokenAtacant, arma, poolFinal, maniobra, demanarDefensa }) {
  const centreOffset = canvas.grid.getOffset({ x: tokenAtacant.center.x, y: tokenAtacant.center.y });
  const objectius = objectiusEsferic({
    origen: tokenAtacant.center,
    centreOffset,
    radi: 2,
    excloure: [tokenAtacant]
  });

  const resultats = [];
  let aturat = false;

  for (const tokenObjectiu of objectius) {
    const objectiu = tokenObjectiu.actor;
    if (!objectiu) continue;

    const eleccio = await demanarDefensa(objectiu);
    if (!eleccio) continue; // DJ ha cancel·lat aquest objectiu concret, continua amb el següent

    const resolucio = await resoldreOpcioDefensa(objectiu, eleccio);
    if (!resolucio) continue;

    const resultat = await ferAtac({
      actor, objectiu, arma, poolFinal,
      dificultat: resolucio.dificultat,
      exigirSuperar: resolucio.exigirSuperar,
      reduccioExtra: resolucio.reduccioExtra,
      maniobra,
      etiquetaDefensa: eleccio.nom,
      label: arma.name
    });
    resultats.push({ objectiu, eleccio, resultat });

    // Manual: "continua impactant fins que... li parin o bloquin el cop"
    // — esquivar NO l'atura (encara que l'esquivada tingui èxit), només
    // parar/blocar que aconsegueixin fer fallar l'atac ho fan.
    if ((eleccio.id === "parar" || eleccio.id === "blocar") && !resultat.exit) {
      aturat = true;
      break;
    }
  }

  return { resultats, aturat };
}

/**
 * Llançament (manual p. 649, estat "Llançat"): un cop l'atac normal ja ha
 * impactat, mou el token de l'objectiu `distancia` caselles lluny de
 * l'atacant, en línia recta a través seu. Si topa amb un mur o un altre
 * combatent pel camí — "cosa dura", segons l'Oriol, s'interpreta com a
 * murs o altres PJs — es queda just abans de l'obstacle, i es demana al
 * DJ per popup si vol aplicar-hi dany addicional (DA-5/G-3: mai es
 * calcula automàticament el dany d'impacte contra un obstacle no
 * especificat).
 *
 * Simplificació deliberada: només es comprova el mur al llarg de tot el
 * trajecte (precís, `puntColisio`) i l'ocupació de la casella final
 * d'aterratge — no cada casella intermèdia. Amb tokens estàndard (no en
 * fila davant d'una trajectòria de llançament) és el cas pràctic més
 * habitual, i evita geometria de segment-contra-múltiples-caselles
 * addicional per a un maniobra ja marcada com "a discreció del DJ".
 *
 * Distància = FOR(atacant) + 2 + mida(atacant). El manual diu "en metres"
 * però no defineix cap taula mida->metres — s'utilitza directament el
 * valor numèric de `mida` (1-5), la mateixa escala que ja fan servir
 * MIDA_DEFENSA/COST_MIDA (constants.mjs). Assumpció documentada, fàcil
 * d'ajustar si cal.
 *
 * @param {object} p
 * @param {ForjaActor} p.actorAtacant
 * @param {Token} p.tokenAtacant
 * @param {Token} p.tokenObjectiu  Token de qui es llança (ja pot ser un
 *   interposant, no necessàriament l'objectiu original de l'atac).
 */
export async function resoldreLlancament({ actorAtacant, tokenAtacant, tokenObjectiu }) {
  const distanciaCaselles = (actorAtacant.system.atributs?.FOR ?? 0) + 2 + (actorAtacant.system.mida ?? 3);
  const pixelsPerCasella  = canvas.grid.size / (canvas.grid.distance || 1);

  const origen = tokenObjectiu.center;
  const angle  = Math.atan2(origen.y - tokenAtacant.center.y, origen.x - tokenAtacant.center.x);
  const destiIdeal = {
    x: origen.x + Math.cos(angle) * distanciaCaselles * pixelsPerCasella,
    y: origen.y + Math.sin(angle) * distanciaCaselles * pixelsPerCasella
  };

  const xocMur = puntColisio(origen, destiIdeal);
  const destiOffset = xocMur ? null : canvas.grid.getOffset(destiIdeal);
  const xocToken = destiOffset ? tokensEnCaselles([destiOffset], [tokenObjectiu, tokenAtacant])[0] : null;

  let puntFinal = destiIdeal;
  let obstacle  = null;
  if (xocMur) {
    obstacle = { tipus: "mur" };
    const recular = pixelsPerCasella * 0.5;
    puntFinal = { x: xocMur.x - Math.cos(angle) * recular, y: xocMur.y - Math.sin(angle) * recular };
  } else if (xocToken) {
    obstacle = { tipus: "token", nom: xocToken.name };
    puntFinal = { x: destiIdeal.x - Math.cos(angle) * pixelsPerCasella, y: destiIdeal.y - Math.sin(angle) * pixelsPerCasella };
  }

  const tlFinal = canvas.grid.getTopLeftPoint(canvas.grid.getOffset(puntFinal));
  // {animate:false}: un llançament reposiciona el token a l'instant (com
  // qualsevol altre efecte de joc que el mou), no com un arrossegament
  // manual del jugador — no té sentit una animació de lliscament.
  await actualitzarComGM(tokenObjectiu.document, { x: tlFinal.x, y: tlFinal.y }, { animate: false });

  if (obstacle) {
    const dany = await demanarDanyColisio(tokenObjectiu.name);
    if (dany > 0) {
      const marcatsActuals = tokenObjectiu.actor.system.salut.ferides.marcats;
      const nous = aplicarDanyAPista({ ferides: { marcats: marcatsActuals } }, "ferides", dany, {
        noMort: !!tokenObjectiu.actor.system.noMort
      });
      await actualitzarComGM(tokenObjectiu.actor, { "system.salut.ferides.marcats": nous });
    }
    const clau = obstacle.tipus === "mur" ? "FORJA.Combat.LlancamentXocMur" : "FORJA.Combat.LlancamentXocObjecte";
    const content = `<div class="forja-missatge-atac">`
      + `<strong>${game.i18n.format(clau, { nom: tokenObjectiu.name, obstacle: obstacle.nom ?? "" })}</strong>`
      + (dany > 0 ? `<p>${game.i18n.format("FORJA.Combat.LlancamentDanyAfegit", { dany })}</p>` : "")
      + `</div>`;
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: actorAtacant }), content });
  }
}

/** Demana al DJ, per popup, quant dany addicional vol aplicar per un xoc de Llançament. */
async function demanarDanyColisio(nom) {
  return new Promise(resolve => {
    let resolt = false;
    foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.format("FORJA.Combat.LlancamentColisioTitol", { nom }) },
      content: `<div class="form-group"><label>${game.i18n.localize("FORJA.Combat.LlancamentColisioDany")}</label>
                 <input type="number" name="dany" value="0" min="0" step="1" autofocus></div>`,
      buttons: [{
        action: "ok",
        label: game.i18n.localize("FORJA.Combat.LlancamentColisioConfirmar"),
        default: true,
        callback: (event, button) => {
          resolt = true;
          resolve(Math.max(0, parseInt(button.form.elements.dany.value) || 0));
        }
      }],
      rejectClose: false,
      close: () => { if (!resolt) resolve(0); }
    });
  });
}
