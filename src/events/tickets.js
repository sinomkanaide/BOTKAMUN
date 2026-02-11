const {
  EmbedBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");
const { tickets, ticketConfigs } = require("../utils/database");

async function handleButton(interaction, client) {
  const id = interaction.customId;
  if (!id.startsWith("ticket_")) return;

  // ─── Open ticket ───
  if (id.startsWith("ticket_open_")) {
    const typeId = id.replace("ticket_open_", "");
    const configKey = `guild-${interaction.guild.id}`;
    const config = ticketConfigs.get(configKey);
    if (!config) {
      return interaction.reply({ content: "Ticket system is not configured.", ephemeral: true });
    }

    const type = config.types.find((t) => t.id === typeId);
    if (!type) {
      return interaction.reply({ content: "This ticket type no longer exists.", ephemeral: true });
    }

    // Check for duplicate open ticket of this type
    const allTickets = tickets.getAll();
    const duplicate = Object.values(allTickets).find(
      (t) => t.guildId === interaction.guild.id && t.userId === interaction.user.id && t.typeId === typeId && t.status !== "closed"
    );
    if (duplicate) {
      return interaction.reply({ content: `You already have an open **${type.name}** ticket: <#${duplicate.channelId}>`, ephemeral: true });
    }

    // Show description modal
    const modal = new ModalBuilder()
      .setCustomId(`ticket_modal_${typeId}`)
      .setTitle(`${type.emoji} ${type.name} Ticket`);

    const descInput = new TextInputBuilder()
      .setCustomId("description")
      .setLabel("Describe your request")
      .setPlaceholder("Provide details about your request...")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);

    modal.addComponents(new ActionRowBuilder().addComponents(descInput));
    return interaction.showModal(modal);
  }

  // ─── Claim ticket ───
  if (id.startsWith("ticket_claim_")) {
    const ticketKey = id.replace("ticket_claim_", "");
    const ticket = tickets.get(ticketKey);
    if (!ticket) {
      return interaction.reply({ content: "Ticket not found.", ephemeral: true });
    }
    if (ticket.claimedBy) {
      return interaction.reply({ content: `Already claimed by <@${ticket.claimedBy}>.`, ephemeral: true });
    }

    ticket.claimedBy = interaction.user.id;
    ticket.claimedByTag = interaction.user.tag;
    tickets.set(ticketKey, ticket);

    // Update the welcome embed
    const embed = EmbedBuilder.from(interaction.message.embeds[0])
      .setFields(
        { name: "Opened by", value: `<@${ticket.userId}>`, inline: true },
        { name: "Type", value: ticket.typeId, inline: true },
        { name: "Status", value: "Claimed", inline: true },
        { name: "Claimed by", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Description", value: ticket.description || "No description" }
      );

    // Disable claim button, keep close
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_claim_${ticketKey}`)
        .setLabel("Claimed")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`ticket_close_${ticketKey}`)
        .setLabel("Close")
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.update({ embeds: [embed], components: [row] });
  }

  // ─── Close ticket (show modal) ───
  if (id.startsWith("ticket_close_")) {
    const ticketKey = id.replace("ticket_close_", "");
    const ticket = tickets.get(ticketKey);
    if (!ticket) {
      return interaction.reply({ content: "Ticket not found.", ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId(`ticket_close_modal_${ticketKey}`)
      .setTitle("Close Ticket");

    const reasonInput = new TextInputBuilder()
      .setCustomId("reason")
      .setLabel("Close reason")
      .setPlaceholder("Why is this ticket being closed?")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(500);

    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
    return interaction.showModal(modal);
  }
}

async function handleModal(interaction, client) {
  const id = interaction.customId;
  if (!id.startsWith("ticket_")) return;

  // ─── Create ticket channel ───
  if (id.startsWith("ticket_modal_")) {
    const typeId = id.replace("ticket_modal_", "");
    const configKey = `guild-${interaction.guild.id}`;
    const config = ticketConfigs.get(configKey);
    if (!config) {
      return interaction.reply({ content: "Ticket system is not configured.", ephemeral: true });
    }

    const type = config.types.find((t) => t.id === typeId);
    if (!type) {
      return interaction.reply({ content: "This ticket type no longer exists.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const description = interaction.fields.getTextInputValue("description");

    // Increment ticket counter
    config.ticketCounter = (config.ticketCounter || 0) + 1;
    const ticketNumber = String(config.ticketCounter).padStart(4, "0");
    ticketConfigs.set(configKey, config);

    const ticketKey = `${interaction.guild.id}-${ticketNumber}`;
    const channelName = `${type.emoji}-${ticketNumber}`.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase() || `ticket-${ticketNumber}`;

    // Build permission overwrites
    const permissionOverwrites = [
      {
        id: interaction.guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      {
        id: client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
        ],
      },
    ];

    if (type.handlerRoleId) {
      permissionOverwrites.push({
        id: type.handlerRoleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages,
        ],
      });
    }

    try {
      const channel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: type.categoryId || undefined,
        permissionOverwrites,
      });

      // Save ticket data
      const ticketData = {
        guildId: interaction.guild.id,
        ticketNumber,
        typeId: type.id,
        typeName: type.name,
        channelId: channel.id,
        userId: interaction.user.id,
        userTag: interaction.user.tag,
        description,
        status: "open",
        claimedBy: null,
        claimedByTag: null,
        createdAt: new Date().toISOString(),
        closedAt: null,
        closedBy: null,
        closeReason: null,
      };
      tickets.set(ticketKey, ticketData);

      // Welcome embed
      const color = type.color ? parseInt(String(type.color).replace("#", ""), 16) : 0x5865f2;
      const welcomeEmbed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${type.emoji} Ticket #${ticketNumber} — ${type.name}`)
        .addFields(
          { name: "Opened by", value: `<@${interaction.user.id}>`, inline: true },
          { name: "Type", value: type.name, inline: true },
          { name: "Status", value: "Open", inline: true },
          { name: "Claimed by", value: "Unclaimed", inline: true },
          { name: "Description", value: description || "No description" }
        )
        .setFooter({ text: `Ticket ${ticketKey}` })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_claim_${ticketKey}`)
          .setLabel("Claim")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`ticket_close_${ticketKey}`)
          .setLabel("Close")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({ embeds: [welcomeEmbed], components: [row] });

      // Ping handler role
      if (type.handlerRoleId) {
        const ping = await channel.send(`<@&${type.handlerRoleId}> New ticket opened!`);
        setTimeout(() => ping.delete().catch(() => {}), 5000);
      }

      await interaction.editReply({ content: `Ticket created: ${channel}` });
    } catch (err) {
      console.error("Error creating ticket channel:", err);
      await interaction.editReply({ content: "Failed to create ticket channel. Check bot permissions." });
    }
  }

  // ─── Close ticket ───
  if (id.startsWith("ticket_close_modal_")) {
    const ticketKey = id.replace("ticket_close_modal_", "");
    const ticket = tickets.get(ticketKey);
    if (!ticket) {
      return interaction.reply({ content: "Ticket not found.", ephemeral: true });
    }

    const reason = interaction.fields.getTextInputValue("reason") || "No reason provided";

    ticket.status = "closed";
    ticket.closedAt = new Date().toISOString();
    ticket.closedBy = interaction.user.id;
    ticket.closeReason = reason;
    tickets.set(ticketKey, ticket);

    // Calculate lifetime
    const created = new Date(ticket.createdAt);
    const closed = new Date(ticket.closedAt);
    const diffMs = closed - created;
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    const lifetime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    const closeEmbed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle("Ticket Closed")
      .addFields(
        { name: "Closed by", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Reason", value: reason, inline: true },
        { name: "Opened by", value: `<@${ticket.userId}>`, inline: true },
        { name: "Type", value: ticket.typeName || ticket.typeId, inline: true },
        { name: "Lifetime", value: lifetime, inline: true }
      )
      .setFooter({ text: `Ticket ${ticketKey}` })
      .setTimestamp();

    await interaction.reply({ embeds: [closeEmbed] });

    // Delete channel after 5 seconds
    setTimeout(async () => {
      try {
        const channel = interaction.guild.channels.cache.get(ticket.channelId);
        if (channel) await channel.delete("Ticket closed");
      } catch (err) {
        console.error("Error deleting ticket channel:", err);
      }
    }, 5000);
  }
}

async function handleSelectMenu(interaction, client) {
  if (interaction.customId !== "ticket_select") return;

  const typeId = interaction.values[0];
  const configKey = `guild-${interaction.guild.id}`;
  const config = ticketConfigs.get(configKey);
  if (!config) {
    return interaction.reply({ content: "Ticket system is not configured.", ephemeral: true });
  }

  const type = config.types.find((t) => t.id === typeId);
  if (!type) {
    return interaction.reply({ content: "This ticket type no longer exists.", ephemeral: true });
  }

  // Check for duplicate open ticket of this type
  const allTickets = tickets.getAll();
  const duplicate = Object.values(allTickets).find(
    (t) => t.guildId === interaction.guild.id && t.userId === interaction.user.id && t.typeId === typeId && t.status !== "closed"
  );
  if (duplicate) {
    return interaction.reply({ content: `You already have an open **${type.name}** ticket: <#${duplicate.channelId}>`, ephemeral: true });
  }

  // Show description modal
  const modal = new ModalBuilder()
    .setCustomId(`ticket_modal_${typeId}`)
    .setTitle(`${type.emoji} ${type.name} Ticket`);

  const descInput = new TextInputBuilder()
    .setCustomId("description")
    .setLabel("Describe your request")
    .setPlaceholder("Provide details about your request...")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1000);

  modal.addComponents(new ActionRowBuilder().addComponents(descInput));
  return interaction.showModal(modal);
}

module.exports = { handleButton, handleModal, handleSelectMenu };
