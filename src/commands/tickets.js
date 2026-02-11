const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ChannelType,
} = require("discord.js");
const { ticketConfigs } = require("../utils/database");

const definitions = [
  new SlashCommandBuilder()
    .setName("setuptickets")
    .setDescription("Initialize the ticket system for this server")
    .addChannelOption((o) =>
      o.setName("channel").setDescription("Channel to post the ticket panel in").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("tickettype")
    .setDescription("Add or edit a ticket type")
    .addStringOption((o) => o.setName("id").setDescription("Unique type ID (e.g. collabs, support)").setRequired(true))
    .addStringOption((o) => o.setName("name").setDescription("Display name").setRequired(true))
    .addStringOption((o) => o.setName("emoji").setDescription("Emoji for the button").setRequired(true))
    .addStringOption((o) => o.setName("description").setDescription("Short description shown on panel").setRequired(true))
    .addRoleOption((o) => o.setName("handler_role").setDescription("Role that handles this ticket type").setRequired(true))
    .addStringOption((o) => o.setName("color").setDescription("Hex color (e.g. #5865f2)").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("deploytickets")
    .setDescription("Deploy or update the ticket panel in the configured channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
];

const handlers = {
  async setuptickets(interaction) {
    const channel = interaction.options.getChannel("channel");
    const configKey = `guild-${interaction.guild.id}`;
    const existing = ticketConfigs.get(configKey);

    const config = existing || {
      guildId: interaction.guild.id,
      panelChannelId: null,
      panelMessageId: null,
      ticketCounter: 0,
      types: [],
    };

    config.panelChannelId = channel.id;
    ticketConfigs.set(configKey, config);

    return interaction.reply({
      content: `Ticket system initialized! Panel channel set to ${channel}.\nUse \`/tickettype\` to add ticket types, then \`/deploytickets\` to post the panel.`,
      ephemeral: true,
    });
  },

  async tickettype(interaction) {
    const configKey = `guild-${interaction.guild.id}`;
    const config = ticketConfigs.get(configKey);
    if (!config) {
      return interaction.reply({
        content: "Run `/setuptickets` first to initialize the ticket system.",
        ephemeral: true,
      });
    }

    const typeId = interaction.options.getString("id").toLowerCase().replace(/\s+/g, "-");
    const name = interaction.options.getString("name");
    const emoji = interaction.options.getString("emoji");
    const description = interaction.options.getString("description");
    const handlerRole = interaction.options.getRole("handler_role");
    const color = interaction.options.getString("color") || "#5865f2";

    const typeData = {
      id: typeId,
      name,
      emoji,
      description,
      handlerRoleId: handlerRole.id,
      color,
    };

    // Add or update
    const idx = config.types.findIndex((t) => t.id === typeId);
    if (idx >= 0) {
      config.types[idx] = typeData;
    } else {
      config.types.push(typeData);
    }
    ticketConfigs.set(configKey, config);

    return interaction.reply({
      content: `Ticket type **${emoji} ${name}** (${typeId}) ${idx >= 0 ? "updated" : "added"}!\nHandler: @${handlerRole.name} | Category will be auto-created on deploy.\nUse \`/deploytickets\` to update the panel.`,
      ephemeral: true,
    });
  },

  async deploytickets(interaction) {
    const configKey = `guild-${interaction.guild.id}`;
    const config = ticketConfigs.get(configKey);
    if (!config) {
      return interaction.reply({
        content: "Run `/setuptickets` first to initialize the ticket system.",
        ephemeral: true,
      });
    }
    if (!config.types.length) {
      return interaction.reply({
        content: "Add at least one ticket type with `/tickettype` before deploying.",
        ephemeral: true,
      });
    }
    if (!config.panelChannelId) {
      return interaction.reply({
        content: "No panel channel configured. Run `/setuptickets` first.",
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const channel = await interaction.guild.channels.fetch(config.panelChannelId);
      if (!channel) {
        return interaction.editReply({ content: "Panel channel not found." });
      }

      // Auto-create categories for each ticket type
      for (const type of config.types) {
        let category = type.categoryId
          ? interaction.guild.channels.cache.get(type.categoryId)
          : null;
        if (!category) {
          category = interaction.guild.channels.cache.find(
            (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === type.name.toLowerCase()
          );
        }
        if (!category) {
          category = await interaction.guild.channels.create({
            name: type.name,
            type: ChannelType.GuildCategory,
          });
        }
        type.categoryId = category.id;
      }
      ticketConfigs.set(configKey, config);

      // Build panel embed
      const typesDescription = config.types
        .map((t) => `${t.emoji} **${t.name}** — ${t.description}`)
        .join("\n");

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("Support Tickets")
        .setDescription(
          `Need help? Select a ticket type from the menu below.\n\n${typesDescription}`
        )
        .setFooter({ text: "Select from the dropdown to open a ticket" })
        .setTimestamp();

      // Build dropdown select menu
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("ticket_select")
        .setPlaceholder("Select a ticket type...")
        .addOptions(
          config.types.map((t) => ({
            label: t.name,
            description: t.description,
            emoji: t.emoji,
            value: t.id,
          }))
        );

      const rows = [new ActionRowBuilder().addComponents(selectMenu)];

      // Edit existing or send new
      if (config.panelMessageId) {
        try {
          const msg = await channel.messages.fetch(config.panelMessageId);
          await msg.edit({ embeds: [embed], components: rows });
          return interaction.editReply({ content: "Ticket panel updated!" });
        } catch {
          // Message no longer exists, send new one
        }
      }

      const msg = await channel.send({ embeds: [embed], components: rows });
      config.panelMessageId = msg.id;
      ticketConfigs.set(configKey, config);

      return interaction.editReply({ content: `Ticket panel deployed in ${channel}!` });
    } catch (err) {
      console.error("Error deploying ticket panel:", err);
      return interaction.editReply({ content: "Failed to deploy panel. Check bot permissions." });
    }
  },
};

module.exports = { definitions, handlers };
