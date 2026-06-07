/**
 * Macro de DJ: importa les criatures d'exemple (Gólem de carn, Aràcnid territorial)
 * des de `module/config/dades/criatures-exemple.json` com a Actors PNJ amb les
 * seves armes naturals incloses.
 *
 * Ús: copia aquest contingut a una macro de Foundry (tipus "Script") i executa-la.
 */
(async () => {
  const dades = await fetch("systems/forja/module/config/dades/criatures-exemple.json")
    .then(r => r.json());

  for (const d of dades) {
    const existent = game.actors.getName(d.name);
    if (existent) {
      ui.notifications.warn(`FORJA | Ja existeix un actor "${d.name}" — se salta.`);
      continue;
    }

    const actor = await Actor.create({
      name: d.name,
      type: d.type,
      system: d.system
    });

    if (d.items?.length) {
      await actor.createEmbeddedDocuments("Item", d.items);
    }

    ui.notifications.info(`FORJA | Creat "${d.name}".`);
  }
})();
