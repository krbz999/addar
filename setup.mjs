/* getData function. */
function getData(key, data) {
  if (!key) return false;
  const name = `flags.addar.resource.${key}`;

  return {
    label: (foundry.utils.getProperty(data, "label") || "").trim(),
    sr: !!foundry.utils.getProperty(data, "sr"),
    lr: !!foundry.utils.getProperty(data, "lr"),
    value: foundry.utils.getProperty(data, "value") || "",
    max: foundry.utils.getProperty(data, "max") || "",
    name,
    id: key
  };
}

/* Add custom resource as a consumption option for items. */
Hooks.once("setup", function() {
  CONFIG.DND5E.abilityConsumptionTypes["flags.addar.resource"] = game.i18n.localize("ADDAR.CustomResource");
});

/* Inject resources onto sheet. */
Hooks.on("renderActorSheet", async function(sheet, html) {
  if (sheet.object.type !== "character") return;
  const box = html[0].querySelector("form > .sheet-body > .tab.attributes.flexrow > .center-pane.flexcol > .attributes.flexrow");
  const DIV = document.createElement("DIV");
  const data = Object.entries(sheet.object.getFlag("addar", "resource") ?? {});
  const resources = [];
  for (const [id, vals] of data) {
    const inner = getData(id, vals);
    if (!inner) continue;
    resources.push(inner);
  }

  const template = "modules/addar/templates/resource.hbs";
  DIV.innerHTML = await renderTemplate(template, { resources });
  box.append(...DIV.children);

  html[0].querySelectorAll(".delete-resource.config-button").forEach((trash) => {
    trash.addEventListener("click", (event) => {
      return sheet.document.unsetFlag("addar", `resource.${event.currentTarget.dataset.id}`);
    });
  });

  html[0].querySelector(".addar.add-resource").addEventListener("click", () => {
    return sheet.object.setFlag("addar", `resource.${foundry.utils.randomID()}`, {});
  });
});

/* Inject custom resource consumption option onto item sheet. */
Hooks.on("renderItemSheet", function(sheet, html) {
  if (sheet.item.system.consume?.type !== "flags.addar.resource") return;
  const actor = sheet.item.actor;
  const ids = Object.keys(actor?.flags.addar?.resource ?? {});
  if (!ids.length) return;
  const selected = sheet.item.system.consume.target;
  const options = ids.reduce((acc, id) => {
    const label = actor.flags.addar.resource[id].label || game.i18n.localize("ADDAR.Resource");
    const value = `flags.addar.resource.${id}.value`;
    const s = value === selected ? "selected" : "";
    return acc + `<option value="${value}" ${s}>${label}</option>`;
  }, "");
  const tar = html[0].querySelector("[name='system.consume.target']");
  if (tar) tar.innerHTML = options;
});

/* Adjust consumed target during item usage. */
Hooks.on("dnd5e.preItemUsageConsumption", function(item, options, config) {
  if (options.consumeResource && item.system.consume.target.startsWith("flags.addar.resource")) {
    options.consumeResource = false;
    options.consumeCustomResource = item.system.consume.target;
  }
});

/* Adjust consumed target during item usage. */
Hooks.on("dnd5e.itemUsageConsumption", function(item, options, config, updates) {
  const name = options.consumeCustomResource;
  if (!name) return;
  const newValue = foundry.utils.getProperty(item.actor, name) - (item.system.consume.amount || 1);
  if (newValue < 0) {
    const typeLabel = CONFIG.DND5E.abilityConsumptionTypes[item.system.consume.type];
    ui.notifications.warn(game.i18n.format("DND5E.ConsumeWarningNoQuantity", { name: item.name, type: typeLabel }));
    return false;
  }
  updates.actorUpdates[name] = newValue;
});

/* Restore resources during a short or long rest. */
Hooks.on("dnd5e.preRestCompleted", function(actor, update) {
  const data = Object.entries(actor.getFlag("addar", "resource") ?? {});
  const LR = update.longRest;
  for (const [id, vals] of data) {
    if ((vals.sr) || (vals.lr && LR)) {
      update.updateData[`flags.addar.resource.${id}.value`] = vals.max;
    }
  }
});
