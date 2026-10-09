import DiategDefensa from "../apps/dialeg-defensa.mjs";
import { opcionsDefensa, opcionsInterposar, triarDefensaAutomatica, triarMitjaBlocar } from "./defensa.mjs";
import { preguntarA, registrarPregunta } from "../xarxa/socket.mjs";
import { potReaccionar, gastarReaccio } from "./reaccions.mjs";
import { manifestarIAplicar } from "./usar-efecte.mjs";

/**
 * Efectes que el defensor pot manifestar com a reacció (Fase 3; manual › Ús,
 * l. 4808: «poden activar-se o manifestar-se gastant un punt de reacció»),
 * p. ex. L'armadura del queloni o Negar el dany. Només els ofereix qui
 * decideix la defensa (és qui posseeix el defensor i pot manifestar-los).
 * @param {Actor} defensor
 * @returns {object[]}
 */
export function opcionsEfectesReaccio(defensor) {
  if (!defensor?.system?.dotat) return [];
  const disponible = potReaccionar(defensor) && !defensor.system.salut?.foraDeCombat;
  return defensor.items
    .filter(i => i.type === "efecte" && (i.system.parametres ?? []).some(p => p.tipus === "reaccio"))
    .map(i => ({
      id: `efecte:${i.id}`, efecteId: i.id, gastaReaccio: true, senseTirada: true, disponible,
      nom: game.i18n.format("FORJA.Combat.Defensa.EfecteReaccio", { nom: i.name }),
      descripcio: game.i18n.format("FORJA.Combat.Defensa.EfecteReaccioDesc", { dificultat: i.system.dificultat })
    }));
}

/**
 * Qui decideix com es defensa l'objectiu d'un atac (Oriol FM, 2026-09-27:
 * "Quan un PNJ s'ha de defensar el DJ decideix amb un modal").
 *
 * Abans, el diàleg de defensa s'obria al client que resolia l'atac: si un
 * jugador atacava un PNJ, era el jugador qui triava com es defensava el PNJ.
 * Ara:
 *   1. Si el defensor té una defensa automàtica configurada
 *      (`system.defensaAutomatica`, típicament els figurants), s'aplica sense
 *      preguntar.
 *   2. Si no, decideix el jugador propietari del defensor, si està connectat
 *      (el PJ el defensa el seu jugador, encara que ataqui el DJ).
 *   3. Si no, el DJ actiu.
 * La pregunta viatja pel socket (`preguntarA`); el destinatari recalcula les
 * opcions a partir del defensor real i només en retorna la tria.
 */

/** Nom de la pregunta del socket. */
const PREGUNTA = "defensa";

/** Registra el gestor de la pregunta a tots els clients. Cridar a `ready`. */
export function registrarPreguntaDefensa() {
  registrarPregunta(PREGUNTA, async ({ uuidDefensor, defensaBasica, categoriaAtac, bonusDauDefensa = 0, uuidsProtectors = [], nomAtacant, idsPermesos = null }) => {
    const defensor = await fromUuid(uuidDefensor);
    if (!defensor) throw new Error(`defensor no trobat (${uuidDefensor})`);
    const protectors = (await Promise.all(uuidsProtectors.map(u => fromUuid(u)))).filter(Boolean);
    const opcions = [
      ..._opcions(defensor, defensaBasica, categoriaAtac, bonusDauDefensa, protectors, idsPermesos),
      ...opcionsEfectesReaccio(defensor)
    ];
    const eleccio = await DiategDefensa.obrir({
      nomAtacant,
      nomDefensor:  defensor.name,
      foraDeCombat: !!defensor.system.salut?.foraDeCombat,
      opcions,
      ultima: defensor.getFlag("forja", "ultimaDefensa") ?? null
    });
    if (!eleccio) return null;
    // Fase 3: efecte com a reacció. Gasta la reacció, el manifesta (i
    // n'aplica el resultat, p. ex. l'armadura temporal) i l'atac es resol
    // contra la defensa bàsica.
    if (eleccio.efecteId) {
      const efecte = defensor.items.get(eleccio.efecteId);
      if (efecte && await gastarReaccio(defensor)) {
        await manifestarIAplicar(defensor, {
          efecteId: efecte.id, dificultatBase: efecte.system.dificultat ?? 1,
          modDaus: 0, modDificultat: 0, puntsExtra: 0, usPuntsExtra: "cap", descripcio: efecte.name
        }, { objectius: [] });
      }
      return { opcioId: "passiva", mitjaId: null };
    }
    // Es recorda per proposar-la la propera vegada (s'esborra en acabar el combat).
    if (!eleccio.interposant && defensor.isOwner) {
      await defensor.setFlag("forja", "ultimaDefensa", { opcioId: eleccio.id, mitjaId: eleccio.mitjaId ?? null });
    }
    return { opcioId: eleccio.id, mitjaId: eleccio.mitjaId ?? null };
  });
}

/**
 * Opcions de defensa completes: les del defensor (amb l'avantatge d'abast,
 * S-12) i, si n'hi ha, les dels protectors que s'hi poden interposar
 * (defensar els altres, manual p. 821-829).
 * @private
 */
function _opcions(defensor, defensaBasica, categoriaAtac, bonusDauDefensa, protectors, idsPermesos = null) {
  // Les opcions es recalculen al client de qui decideix: cal respectar les que
  // l'atacant ha exclòs (p. ex. el contraatac o l'escopeta no es poden parar ni blocar).
  return [
    ...opcionsDefensa(defensor, defensaBasica, { categoriaAtac, bonusDauDefensa })
      .filter(o => !idsPermesos || idsPermesos.includes(o.id)),
    ...protectors.flatMap(p => opcionsInterposar(p, { categoriaAtac }))
  ];
}

/**
 * Usuari que ha de decidir la defensa de `defensor`: el jugador propietari
 * connectat o, si no n'hi ha, el DJ actiu.
 * @param {Actor} defensor
 * @returns {User|null}
 */
export function decisorDefensa(defensor) {
  const jugador = game.users.find(u => u.active && !u.isGM && defensor.testUserPermission(u, "OWNER"));
  return jugador ?? game.users.activeGM ?? null;
}

/**
 * Obté la defensa triada per a un atac.
 * @param {object} p
 * @param {Actor}  p.defensor
 * @param {Array<object>} p.opcions   Opcions calculades per l'atacant (`opcionsDefensa`)
 * @param {number} p.defensaBasica
 * @param {string|null} p.categoriaAtac
 * @param {number} [p.bonusDauDefensa=0]  Avantatge d'abast del defensor (S-12)
 * @param {Actor[]} [p.protectors=[]]    Actors a tocar que s'hi poden interposar
 * @param {string} p.nomAtacant
 * @returns {Promise<{eleccio:object, automatica?:boolean, perDefecte?:boolean}|null>}
 *   `null` si qui decideix cancel·la el diàleg (l'atac no es resol).
 */
export async function decidirDefensa({ defensor, opcions, defensaBasica, categoriaAtac, bonusDauDefensa = 0, protectors = [], nomAtacant }) {
  const passiva = opcions.find(o => o.id === "passiva") ?? null;

  const automatica = triarDefensaAutomatica(opcions, defensor.system?.defensaAutomatica);
  if (automatica) return { eleccio: automatica, automatica: true };

  // Sense cap reacció lliure (ni seva ni d'un protector) no hi ha res a
  // decidir: defensa bàsica, sense preguntar.
  const potReaccionar = opcions.some(o => o.id !== "passiva" && o.disponible);
  if (!potReaccionar && passiva) {
    ui.notifications?.info(game.i18n.format("FORJA.Combat.SenseReaccionsPassiva", { nom: defensor.name }));
    const nom = `${passiva.nom} (${game.i18n.localize("FORJA.Combat.SenseReaccions")})`;
    return { eleccio: { ...passiva, nom }, automatica: true };
  }

  const desti = decisorDefensa(defensor);
  if (!desti) {
    ui.notifications?.warn(game.i18n.format("FORJA.Combat.DefensaSenseDecisor", { nom: defensor.name }));
    return passiva ? { eleccio: passiva, perDefecte: true } : null;
  }

  if (desti.id !== game.user.id) {
    ui.notifications?.info(game.i18n.format("FORJA.Combat.EsperantDefensa", { nom: desti.name, defensor: defensor.name }));
  }

  let resposta;
  try {
    resposta = await preguntarA(desti, PREGUNTA, {
      uuidDefensor: defensor.uuid, defensaBasica, categoriaAtac, bonusDauDefensa,
      uuidsProtectors: protectors.map(p => p.uuid), nomAtacant,
      idsPermesos: opcions.map(o => o.id)
    });
  } catch (err) {
    console.warn(err);
    ui.notifications?.warn(game.i18n.format("FORJA.Combat.DefensaSenseResposta", { nom: desti.name, defensor: defensor.name }));
    return passiva ? { eleccio: passiva, perDefecte: true } : null;
  }
  if (!resposta) return null;

  const opcio = opcions.find(o => o.id === resposta.opcioId);
  if (!opcio) return passiva ? { eleccio: passiva, perDefecte: true } : null;
  return { eleccio: triarMitjaBlocar(opcio, resposta.mitjaId) };
}
