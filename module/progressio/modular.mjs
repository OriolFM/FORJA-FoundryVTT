/**
 * Artefactes modulars (S-30, manual p. 576-588).
 *
 * "Els dispositius modulars... estan basats en petits mòduls que agrupen
 * part de les funcionalitats de l'artefacte... i que acostumen a tenir un
 * cost baix." El manual no dona cap fórmula de conversió (quant "menys"
 * costa exactament un mòdul respecte construir l'artefacte sencer de nou) —
 * només ho qualifica narrativament. Per això cada mòdul es construeix amb
 * el mateix motor de paràmetres que qualsevol altre artefacte
 * (`DiategConstructor.obrir({esArtefacte:true})`, S-23), sense cap descompte
 * artificial inventat: el cost total de l'artefacte modular és, senzillament,
 * la suma del xassís (`system.cost`, el que ja tenia l'artefacte quan es va
 * dissenyar/afegir) més el cost de cada mòdul instal·lat.
 *
 * **Abast d'aquesta implementació ("nucli")**: afegir/treure mòduls i sumar
 * el seu cost/dificultat/latència al de l'artefacte. El manual també parla
 * de canviar un mòdul "sense eines" en temps de joc (manual p. 582: "pot no
 * requerir ni eines, segons com hagi estat el disseny") i de redissenyar un
 * mòdul concret enlloc de tot l'artefacte quan es vol modificar — aquí això
 * es tradueix directament en "treure un mòdul + afegir-ne un altre", no cal
 * cap mecànica addicional (no hi ha cap tirada ni cost narratiu específic
 * que el manual quantifiqui per l'acte de canviar un mòdul en si).
 */

/** @returns {{cost:number, dificultat:number, modLatencia:number}} Suma del xassís + tots els mòduls. */
export function costTotalModular(item) {
  const base = {
    cost: item.system.cost ?? 0,
    dificultat: item.system.activacio?.dificultat ?? 0,
    modLatencia: item.system.us?.modLatencia ?? 0
  };
  for (const m of item.system.moduls ?? []) {
    base.cost += m.cost ?? 0;
    base.dificultat += m.dificultat ?? 0;
    base.modLatencia += m.modLatencia ?? 0;
  }
  return base;
}

/**
 * Afegeix un mòdul (resultat de `DiategConstructor.obrir({esArtefacte:true})`)
 * a un artefacte modular.
 * @param {Item} item
 * @param {object} construit
 */
export async function afegirModul(item, construit) {
  const moduls = [...(item.system.moduls ?? []), {
    nom: construit.nom,
    cost: construit.cost,
    dificultat: construit.dificultat,
    modLatencia: construit.modLatencia,
    mecanica: construit.mecanica
  }];
  await item.update({ "system.moduls": moduls });
}

/**
 * Treu el mòdul a l'índex indicat (per exemple, per substituir-lo per un
 * altre — "canviar un mòdul", manual p. 582).
 * @param {Item} item
 * @param {number} index
 */
export async function treureModul(item, index) {
  const moduls = (item.system.moduls ?? []).filter((_, i) => i !== index);
  await item.update({ "system.moduls": moduls });
}
