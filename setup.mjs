/* Add custom resource as a consumption option for items. */
Hooks.once("setup", function() {
  CONFIG.DND5E.abilityConsumptionTypes["flags.addar.resource"] = game.i18n.localize("ADDAR.CustomResource");
});

/* Inject resources onto sheet. */
Hooks.on("renderActorSheet", async function(sheet, html) {
  if (sheet.document.type !== "character") return;
  const box = html[0].querySelector(".dnd5e.sheet.actor .center-pane ul.attributes");
  const div = document.createElement("DIV");
  const resources = Object.entries(sheet.document.flags.addar?.resource ?? {}).reduce((acc, [id, data]) => {
    if (!id) return acc;
    acc.push({
      label: (data.label || "").trim(),
      name: `flags.addar.resource.${id}`,
      id,
      sr: !!data.sr,
      lr: !!data.lr,
      value: data.value || null,
      max: data.max || null
    });
    return acc;
  }, []);
  const template = "modules/addar/templates/resource.hbs";
  div.innerHTML = await renderTemplate(template, {resources});

  div.querySelectorAll("[data-action='delete-resource']").forEach(trash => {
    trash.addEventListener("click", (event) => {
      return sheet.document.unsetFlag("addar", `resource.${event.currentTarget.dataset.id}`);
    });
  });

  div.querySelector("[data-action='add-resource']").addEventListener("click", () => {
    return sheet.document.setFlag("addar", `resource.${foundry.utils.randomID()}`, {});
  });

  div.querySelectorAll("input[type='text'][data-dtype='Number']").forEach(input => {
    input.addEventListener("change", sheet._onChangeInputDelta.bind(sheet));
  });

  const foc = div.querySelector(`[name="${sheet._addarFocus}"]`);
  box.append(...div.children);
  if (foc && sheet._addarFocus.includes("addar")) foc.focus();

  html[0].querySelectorAll("input").forEach(input => input.addEventListener("focus", (event) => {
    sheet._addarFocus = event.currentTarget.name;
    if (event.currentTarget.closest(".addar")) event.currentTarget.select();
  }));
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
    const s = (value === selected) ? "selected" : "";
    return acc + `<option value="${value}" ${s}>${label}</option>`;
  }, "<option value=''></option>");
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
    ui.notifications.warn(game.i18n.format("DND5E.ConsumeWarningNoQuantity", {
      name: item.name,
      type: CONFIG.DND5E.abilityConsumptionTypes[item.system.consume.type]
    }));
    return false;
  }
  updates.actorUpdates[name] = newValue;
});

/* Restore resources during a short or long rest. */
Hooks.on("dnd5e.preRestCompleted", function(actor, update) {
  const data = Object.entries(actor.flags.addar?.resource ?? {});
  const LR = update.longRest;
  for (const [id, vals] of data) {
    if ((vals.sr) || (vals.lr && LR)) {
      update.updateData[`flags.addar.resource.${id}.value`] = vals.max;
    }
  }
});
