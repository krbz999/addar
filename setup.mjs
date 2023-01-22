async function resource(key, data) {
  if (!key) return false;
  const name = `flags.addar.resource.${key}`;

  const props = {
    label: foundry.utils.getProperty(data, "label") ?? "",
    sr: !!foundry.utils.getProperty(data, "sr"),
    lr: !!foundry.utils.getProperty(data, "lr"),
    value: foundry.utils.getProperty(data, "value") ?? "",
    max: foundry.utils.getProperty(data, "max") ?? "",
    name,
    id: key
  };

  const template = "modules/addar/templates/resource.hbs";
  return renderTemplate(template, props);
}

Hooks.on("renderActorSheet", async function(sheet, html) {
  const box = html[0].querySelector("form > .sheet-body > .tab.attributes.flexrow > .center-pane.flexcol > .attributes.flexrow");
  const DIV = document.createElement("DIV");
  const data = Object.entries(sheet.object.getFlag("addar", "resource") ?? {});
  for (const [id, vals] of data) {
    const inner = await resource(id, vals);
    if (!inner) continue;
    DIV.innerHTML = inner;
    const res = box.appendChild(DIV.firstElementChild);
    res.querySelector("[data-id]").addEventListener("click", async (event) => {
      await sheet.object.unsetFlag("addar", `resource.${event.currentTarget.dataset.id}`);
    });
  }

  DIV.innerHTML = `<a class="addar add-resource"><i class="fa-solid fa-plus"></i></a>`;
  const add = box.appendChild(DIV.firstElementChild);
  add.addEventListener("click", async (event) => {
    await sheet.object.setFlag("addar", `resource.${foundry.utils.randomID()}`, {});
  });
});

Hooks.on("dnd5e.preRestCompleted", function(actor, update) {
  const data = Object.entries(actor.getFlag("addar", "resource") ?? {});
  const LR = update.longRest;
  for (const [id, vals] of data) {
    if ((vals.sr) || (vals.lr && LR)) {
      update.updateData[`flags.addar.resource.${id}.value`] = vals.max;
    }
  }
});
