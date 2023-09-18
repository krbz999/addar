class Addar {
  static init() {
    Hooks.once("setup", Addar.setup);
    Hooks.on("renderActorSheet", Addar.renderActorSheet);
    Hooks.on("renderItemSheet", Addar.renderItemSheet);
    Hooks.on("dnd5e.preItemUsageConsumption", Addar.preItemUsageConsumption);
    Hooks.on("dnd5e.itemUsageConsumption", Addar.itemUsageConsumption);
    Hooks.on("dnd5e.preRestCompleted", Addar.preRestCompleted);
  }

  static get resourceField() {
    return class AddarResourceField extends foundry.abstract.DataModel {
      static defineSchema() {
        return {
          value: new foundry.data.fields.NumberField({integer: true}),
          max: new foundry.data.fields.NumberField({integer: true}),
          sr: new foundry.data.fields.BooleanField(),
          lr: new foundry.data.fields.BooleanField(),
          label: new foundry.data.fields.StringField()
        };
      }
    };
  }

  /* Add custom resource as a consumption option for items. */
  static setup() {
    CONFIG.DND5E.abilityConsumptionTypes["flags.addar.resource"] = game.i18n.localize("ADDAR.CustomResource");
  }

  /* Inject resources onto sheet. */
  static async renderActorSheet(sheet, html) {
    if (sheet.document.type !== "character") return;
    const box = html[0].querySelector(".dnd5e.sheet.actor .center-pane ul.attributes");
    const div = document.createElement("DIV");
    const resources = Object.entries(sheet.document.flags.addar?.resource ?? {}).reduce((acc, [id, data]) => {
      if (!id) return acc;
      acc.push({name: `flags.addar.resource.${id}`, id, ...new Addar.resourceField(data).toObject()});
      return acc;
    }, []);
    div.innerHTML = await renderTemplate("modules/addar/templates/resource.hbs", {resources});

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
  }

  /* Inject custom resource consumption option onto item sheet. */
  static async renderItemSheet(sheet, html) {
    if (sheet.item.system.consume?.type !== "flags.addar.resource") return;
    const actor = sheet.item.actor;
    const ids = Object.keys(actor?.flags.addar?.resource ?? {});
    if (!ids.length) return;
    const options = {hash: {selected: sheet.item.system.consume.target, blank: "", localize: true}};
    const choices = ids.reduce((acc, id) => {
      acc[`flags.addar.resource.${id}.value`] = actor.flags.addar.resource[id].label || "ADDAR.Resource";
      return acc;
    }, {});
    const tar = html[0].querySelector("[name='system.consume.target']");
    if (tar) tar.innerHTML = HandlebarsHelpers.selectOptions(choices, options);
  }

  /* Adjust consumed target during item usage. */
  static preItemUsageConsumption(item, config) {
    if (config.consumeResource && item.system.consume.target.startsWith("flags.addar.resource")) {
      config.consumeResource = false;
      config.consumeCustomResource = item.system.consume.target;
    }
  }

  /* Adjust consumed target during item usage. */
  static itemUsageConsumption(item, config, options, updates) {
    const name = config.consumeCustomResource;
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
  }

  /* Restore resources during a short or long rest. */
  static preRestCompleted(actor, update) {
    const data = Object.entries(actor.flags.addar?.resource ?? {});
    const LR = update.longRest;
    for (const [id, vals] of data) {
      if ((vals.sr) || (vals.lr && LR)) {
        update.updateData[`flags.addar.resource.${id}.value`] = vals.max;
      }
    }
  }
}

Hooks.once("init", Addar.init);
