const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const { v4: uuidv4 } = require("uuid");
const { announcements } = require("../utils/database");

const definitions = [
  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Envía un anuncio inmediato")
    .addChannelOption((o) => o.setName("canal").setDescription("Canal donde enviar").setRequired(true))
    .addStringOption((o) => o.setName("titulo").setDescription("Título del anuncio").setRequired(true))
    .addStringOption((o) => o.setName("mensaje").setDescription("Contenido del anuncio").setRequired(true))
    .addStringOption((o) => o.setName("color").setDescription("Color hex (ej: #FF5733)"))
    .addRoleOption((o) => o.setName("ping").setDescription("Rol a mencionar"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("schedule")
    .setDescription("Programa un anuncio recurrente")
    .addChannelOption((o) => o.setName("canal").setDescription("Canal").setRequired(true))
    .addStringOption((o) => o.setName("titulo").setDescription("Título").setRequired(true))
    .addStringOption((o) => o.setName("mensaje").setDescription("Mensaje").setRequired(true))
    .addStringOption((o) =>
      o.setName("frecuencia").setDescription("Frecuencia").setRequired(true)
        .addChoices(
          { name: "Cada hora", value: "0 * * * *" },
          { name: "Cada 6 horas", value: "0 */6 * * *" },
          { name: "Diario (8:00 AM)", value: "0 8 * * *" },
          { name: "Diario (12:00 PM)", value: "0 12 * * *" },
          { name: "Diario (8:00 PM)", value: "0 20 * * *" },
          { name: "Lunes a Viernes (9:00 AM)", value: "0 9 * * 1-5" },
          { name: "Semanal (Lunes 9 AM)", value: "0 9 * * 1" },
          { name: "Mensual (día 1)", value: "0 9 1 * *" }
        )
    )
    .addRoleOption((o) => o.setName("ping").setDescription("Rol a mencionar"))
    .addStringOption((o) => o.setName("color").setDescription("Color hex"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("scheduled")
    .setDescription("Ver o gestionar anuncios programados")
    .addStringOption((o) =>
      o.setName("accion").setDescription("Acción").setRequired(true)
        .addChoices(
          { name: "📋 Listar todos", value: "list" },
          { name: "⏸️ Pausar", value: "pause" },
          { name: "▶️ Reanudar", value: "resume" },
          { name: "🗑️ Eliminar", value: "delete" }
        )
    )
    .addStringOption((o) => o.setName("id").setDescription("ID del anuncio (para pausar/reanudar/eliminar)"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
];

const handlers = {
  async announce(interaction) {
    const channel = interaction.options.getChannel("canal");
    const title = interaction.options.getString("titulo");
    const message = interaction.options.getString("mensaje");
    const colorStr = interaction.options.getString("color");
    const pingRole = interaction.options.getRole("ping");

    const color = colorStr ? parseInt(colorStr.replace("#", ""), 16) : 0x5865f2;
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`📢 ${title}`)
      .setDescription(message)
      .setFooter({ text: `Anuncio por ${interaction.user.tag}` })
      .setTimestamp();

    await channel.send({
      content: pingRole ? `<@&${pingRole.id}>` : undefined,
      embeds: [embed],
    });

    return interaction.reply({ content: `✅ Anuncio enviado a ${channel}`, ephemeral: true });
  },

  async schedule(interaction, client) {
    const channel = interaction.options.getChannel("canal");
    const title = interaction.options.getString("titulo");
    const message = interaction.options.getString("mensaje");
    const cronExpr = interaction.options.getString("frecuencia");
    const pingRole = interaction.options.getRole("ping");
    const colorStr = interaction.options.getString("color");

    const id = uuidv4().slice(0, 8);
    const ann = {
      guildId: interaction.guild.id,
      channelId: channel.id,
      title,
      message,
      cron: cronExpr,
      color: colorStr ? parseInt(colorStr.replace("#", ""), 16) : 0x5865f2,
      pingRole: pingRole?.id || null,
      active: true,
      createdBy: interaction.user.tag,
      createdAt: new Date().toISOString(),
    };

    announcements.set(id, ann);

    // Registrar el cron job
    const { scheduleAnnouncement } = require("../../index");
    scheduleAnnouncement(id, ann);

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle("📅 Anuncio Programado")
      .addFields(
        { name: "ID", value: `\`${id}\``, inline: true },
        { name: "Canal", value: `${channel}`, inline: true },
        { name: "Frecuencia", value: `\`${cronExpr}\``, inline: true },
        { name: "Título", value: title },
        { name: "Mensaje", value: message.slice(0, 200) }
      )
      .setTimestamp();
    return interaction.reply({ embeds: [embed] });
  },

  async scheduled(interaction) {
    const action = interaction.options.getString("accion");
    const id = interaction.options.getString("id");

    if (action === "list") {
      const all = announcements.getAll();
      const guildAnns = Object.entries(all).filter(
        ([, a]) => a.guildId === interaction.guild.id
      );

      if (!guildAnns.length)
        return interaction.reply({ content: "📭 No hay anuncios programados.", ephemeral: true });

      const desc = guildAnns
        .map(
          ([id, a]) =>
            `**ID:** \`${id}\` ${a.active ? "🟢" : "🔴"}\n📌 ${a.title}\n📺 <#${a.channelId}> | ⏰ \`${a.cron}\``
        )
        .join("\n\n");

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("📅 Anuncios Programados")
        .setDescription(desc)
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (!id) return interaction.reply({ content: "❌ Debes proporcionar un ID.", ephemeral: true });

    const ann = announcements.get(id);
    if (!ann || ann.guildId !== interaction.guild.id)
      return interaction.reply({ content: "❌ Anuncio no encontrado.", ephemeral: true });

    if (action === "pause") {
      ann.active = false;
      announcements.set(id, ann);
      const { activeCrons } = require("../../index");
      if (activeCrons.has(id)) { activeCrons.get(id).stop(); activeCrons.delete(id); }
      return interaction.reply({ content: `⏸️ Anuncio \`${id}\` pausado.`, ephemeral: true });
    }

    if (action === "resume") {
      ann.active = true;
      announcements.set(id, ann);
      const { scheduleAnnouncement } = require("../../index");
      scheduleAnnouncement(id, ann);
      return interaction.reply({ content: `▶️ Anuncio \`${id}\` reanudado.`, ephemeral: true });
    }

    if (action === "delete") {
      announcements.delete(id);
      const { activeCrons } = require("../../index");
      if (activeCrons.has(id)) { activeCrons.get(id).stop(); activeCrons.delete(id); }
      return interaction.reply({ content: `🗑️ Anuncio \`${id}\` eliminado.`, ephemeral: true });
    }
  },
};

module.exports = { definitions, handlers };
