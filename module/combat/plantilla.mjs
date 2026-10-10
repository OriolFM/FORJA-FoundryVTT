import { OBERTURA_CON, dinsCon, direccioCap, direccioDeRotacio, poligonCon } from "./area-con.mjs";
/**
 * Lectura de plantilles de mesura NATIVES de Foundry per a atacs/efectes
 * d'àrea esfèrica o de llàgrima (motor a `area.mjs`). Flux en dos passos
 * (Opció A, confirmada amb l'Oriol): l'usuari dibuixa una
 * `MeasuredTemplate` amb l'eina de mesura ja nativa de Foundry i després
 * resol l'atac/efecte — moment en què només es llegeix la POSICIÓ
 * (esfèric) o la DIRECCIÓ (llàgrima) de la plantilla. La mida/distància
 * que l'usuari hagi dibuixat s'ignora SEMPRE: el radi o llargada reals
 * venen fixats per l'arma/efecte/artefacte, no per l'usuari (confirmat
 * amb l'Oriol: "el radi ha d'anar definit en crear cada arma").
 *
 * Una interacció pròpia d'arrossegar-i-confirmar en un sol pas (com fan
 * alguns sistemes, p. ex. dnd5e) queda documentada com a millora futura
 * (M-18, `07_MILLORES_FUTUR.md`) — Foundry no dona cap ajudant natiu
 * per fer-ho (comprovat aquesta sessió: `drawPreview` és una comoditat
 * de sistema, no de core).
 *
 * S'agafa el DARRER element de `canvas.scene.templates` d'aquest
 * usuari: les col·leccions de Foundry preserven l'ordre d'inserció, i
 * `MeasuredTemplateDocument` no té cap timestamp fiable a `_stats` en
 * aquesta versió. Assumeix que l'usuari només en té una de pendent de
 * resoldre a la vegada — el flux normal (dibuixar, després resoldre).
 */

/**
 * @param {User} [user=game.user]
 * @returns {MeasuredTemplateDocument|null}
 */
export function darreraPlantilla(user = game.user) {
  const propies = canvas.scene.templates.filter(t => t.author?.id === user.id);
  return propies.at(-1) ?? null;
}

/**
 * Centre (offset de graella) d'una plantilla ESFÈRICA — ignora el radi
 * que l'usuari hagi dibuixat.
 * @param {MeasuredTemplateDocument} template
 * @returns {{i:number,j:number}}
 */
export function centreDePlantilla(template) {
  return canvas.grid.getOffset({ x: template.x, y: template.y });
}

/**
 * Punt final d'una LLÀGRIMA: des de `origenToken` (el personatge que
 * dispara/manifesta — NO la plantilla), en la direcció que marca la
 * plantilla, a `llargadaCaselles` de distància. Ignora tant l'origen
 * com la distància que l'usuari hagi dibuixat — només es fa servir
 * `template.direction`.
 * @param {Token} origenToken
 * @param {MeasuredTemplateDocument} template
 * @param {number} llargadaCaselles
 * @returns {{x:number,y:number}}
 */
export function destiDeLlagrimaDesDe(origenToken, template, llargadaCaselles) {
  const angle = Math.toRadians(template.direction ?? 0);
  const pixelsPerCasella = canvas.grid.size / (canvas.grid.distance || 1);
  const origen = origenToken.center;
  return {
    x: origen.x + Math.cos(angle) * llargadaCaselles * pixelsPerCasella,
    y: origen.y + Math.sin(angle) * llargadaCaselles * pixelsPerCasella
  };
}

/**
 * Actors dels tokens que queden dins la forma d'una plantilla (Fase 3,
 * efectes i artefactes d'àrea). El manual no dona la mida de l'àrea dels
 * efectes (› Objectius, l. 4852), de manera que aquí sí que mana la
 * plantilla que dibuixa l'usuari (amb el vistiplau del DJ). Es compta el
 * centre de cada token.
 * @param {MeasuredTemplateDocument} template
 * @returns {Actor[]}
 */
export function actorsDinsPlantilla(template) {
  const forma = formaPlantilla(template);
  if (!forma) return [];
  return (canvas.tokens?.placeables ?? [])
    .filter(t => t.actor && forma.contains(t.center.x - template.x, t.center.y - template.y))
    .map(t => t.actor);
}

/**
 * Forma (relativa a l'origen) d'una plantilla dibuixada. Foundry la calcula
 * al primer refresc del canvas (`MeasuredTemplate#_refreshShape`); si encara
 * no hi és (plantilla acabada de crear, client lent), es calcula ara.
 * @param {MeasuredTemplateDocument} template
 * @returns {PIXI.Circle|PIXI.Rectangle|PIXI.Polygon|null}
 */
export function formaPlantilla(template) {
  const objecte = template?.object;
  return objecte?.shape ?? objecte?._computeShape?.() ?? null;
}

/** Elimina la plantilla un cop consumida, perquè no es reaprofiti per error en properes resolucions. */
export async function consumirPlantilla(template) {
  if (template) await template.delete();
}

/**
 * Con automàtic d'un tret en llàgrima (escopeta, arma de dispersió): a la v14
 * no es poden dibuixar plantilles de mesura. Origen al centre del tirador,
 * cap a l'objectiu declarat (o cap on mira el token), de 15° i amb la llargada
 * de l'abast de l'arma (`combat/area-con.mjs`). Es dibuixa al mapa i es demana
 * confirmació, amb la llista dels qui hi queden dins. (No és pura: canvas.)
 * @param {object} p
 * @param {Token} p.tokenAtacant
 * @param {Token|null} [p.tokenObjectiu]
 * @param {number} p.llargadaMetres
 * @param {string} p.nomArma
 * @returns {Promise<object|null>}  El con, o null si es cancel·la
 */
export async function triarCon({ tokenAtacant, tokenObjectiu = null, llargadaMetres, nomArma }) {
  const origen = tokenAtacant.center;
  const direccio = tokenObjectiu ? direccioCap(origen, tokenObjectiu.center) : direccioDeRotacio(tokenAtacant.document.rotation);
  const llargada = llargadaMetres * (canvas.dimensions?.distancePixels ?? (canvas.grid.size / canvas.grid.distance));
  const con = { origen, direccio, llargada, obertura: OBERTURA_CON };
  const dibuix = new PIXI.Graphics();
  dibuix.lineStyle(3, 0xf59e0b, 0.95).beginFill(0xf59e0b, 0.25).drawPolygon(poligonCon(con)).endFill();
  canvas.controls?.addChild(dibuix);
  const afectats = (canvas.tokens?.placeables ?? [])
    .filter(t => t.actor && t !== tokenAtacant && dinsCon(con, t.center)).map(t => t.name);
  try {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.format("FORJA.Combat.ConTitol", { arma: nomArma }) },
      content: `<p>${game.i18n.format("FORJA.Combat.ConConfirmar", { metres: llargadaMetres, graus: OBERTURA_CON })}</p>
        <p><strong>${afectats.length ? Handlebars.escapeExpression(game.i18n.format("FORJA.Combat.ConAfectats", { noms: afectats.join(", ") })) : game.i18n.localize("FORJA.Combat.ConCap")}</strong></p>`,
      rejectClose: false
    });
    return ok ? con : null;
  } finally {
    dibuix.destroy();
  }
}
