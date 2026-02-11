const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} = require("discord.js");

const definitions = [
  new SlashCommandBuilder()
    .setName("createchannel")
    .setDescription("Crea un canal de texto o voz")
    .addStringOption((o) => o.setName("nombre").setDescription("Nombre del canal").setRequired(true))
    .addStringOption((o) =>
      o.setName("tipo").setDescription("Tipo de canal").setRequired(true)
        .addChoices({ name: "Texto", value: "text" }, { name: "Voz", value: "voice" }, { name: "Categoría", value: "category" }, { name: "Foro", value: "forum" }, { name: "Anuncios", value: "announcement" })
    )
    .addChannelOption((o) => o.setName("categoria").setDescription("Categoría donde crear el canal"))
    .addStringOption((o) => o.setName("descripcion").setDescription("Descripción/tema del canal"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("deletechannel")
    .setDescription("Elimina un canal")
    .addChannelOption((o) => o.setName("canal").setDescription("Canal a eliminar").setRequired(true))
    .addStringOption((o) => o.setName("razon").setDescription("Razón"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("editchannel")
    .setDescription("Edita un canal existente")
    .addChannelOption((o) => o.setName("canal").setDescription("Canal a editar").setRequired(true))
    .addStringOption((o) => o.setName("nombre").setDescription("Nuevo nombre"))
    .addStringOption((o) => o.setName("descripcion").setDescription("Nueva descripción"))
    .addBooleanOption((o) => o.setName("nsfw").setDescription("Marcar como NSFW"))
    .addIntegerOption((o) => o.setName("slowmode").setDescription("Slowmode en segundos (0 para desactivar)").setMinValue(0).setMaxValue(21600))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("lockdown")
    .setDescription("Bloquea/desbloquea un canal")
    .addStringOption((o) =>
      o.setName("accion").setDescription("Acción").setRequired(true)
        .addChoices({ name: "Bloquear", value: "lock" }, { name: "Desbloquear", value: "unlock" })
    )
    .addChannelOption((o) => o.setName("canal").setDescription("Canal (default: este canal)"))
    .addStringOption((o) => o.setName("razon").setDescription("Razón"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("permissions")
    .setDescription("Gestiona permisos de un canal")
    .addChannelOption((o) => o.setName("canal").setDescription("Canal").setRequired(true))
    .addRoleOption((o) => o.setName("rol").setDescription("Rol a modificar").setRequired(true))
    .addStringOption((o) =>
      o.setName("permiso").setDescription("Permiso a cambiar").setRequired(true)
        .addChoices(
          { name: "Ver canal", value: "ViewChannel" },
          { name: "Enviar mensajes", value: "SendMessages" },
          { name: "Adjuntar archivos", value: "AttachFiles" },
          { name: "Usar reacciones", value: "AddReactions" },
          { name: "Conectar (voz)", value: "Connect" },
          { name: "Hablar (voz)", value: "Speak" },
          { name: "Mencionar @everyone", value: "MentionEveryone" },
          { name: "Gestionar mensajes", value: "ManageMessages" }
        )
    )
    .addStringOption((o) =>
      o.setName("valor").setDescription("Permitir o denegar").setRequired(true)
        .addChoices({ name: "✅ Permitir", value: "allow" }, { name: "❌ Denegar", value: "deny" }, { name: "⬜ Neutral", value: "neutral" })
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
];

const CHANNEL_TYPES = {
  text: ChannelType.GuildText,
  voice: ChannelType.GuildVoice,
  category: ChannelType.GuildCategory,
  forum: ChannelType.GuildForum,
  announcement: ChannelType.GuildAnnouncement,
};

const handlers = {
  async createchannel(interaction) {
    const name = interaction.options.getString("nombre");
    const type = interaction.options.getString("tipo");
    const category = interaction.options.getChannel("categoria");
    const topic = interaction.options.getString("descripcion");

    const options = { name, type: CHANNEL_TYPES[type] };
    if (category) options.parent = category.id;
    if (topic && type !== "voice" && type !== "category") options.topic = topic;

    const channel = await interaction.guild.channels.create(options);
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle("✅ Canal Creado")
      .addFields(
        { name: "Canal", value: `${channel}`, inline: true },
        { name: "Tipo", value: type, inline: true },
        { name: "Categoría", value: category ? category.name : "Ninguna", inline: true }
      )
      .setTimestamp();
    return interaction.reply({ embeds: [embed] });
  },

  async deletechannel(interaction) {
    const channel = interaction.options.getChannel("canal");
    const reason = interaction.options.getString("razon") || "Sin razón";
    const name = channel.name;
    await channel.delete(reason);
    return interaction.reply({ content: `🗑️ Canal **#${name}** eliminado. Razón: ${reason}` });
  },

  async editchannel(interaction) {
    const channel = interaction.options.getChannel("canal");
    const updates = {};
    const name = interaction.options.getString("nombre");
    const topic = interaction.options.getString("descripcion");
    const nsfw = interaction.options.getBoolean("nsfw");
    const slowmode = interaction.options.getInteger("slowmode");

    if (name !== null) updates.name = name;
    if (topic !== null) updates.topic = topic;
    if (nsfw !== null) updates.nsfw = nsfw;
    if (slowmode !== null) updates.rateLimitPerUser = slowmode;

    await channel.edit(updates);
    return interaction.reply({ content: `✅ Canal **${channel}** actualizado.` });
  },

  async lockdown(interaction) {
    const action = interaction.options.getString("accion");
    const channel = interaction.options.getChannel("canal") || interaction.channel;
    const reason = interaction.options.getString("razon") || "";
    const everyone = interaction.guild.roles.everyone;

    if (action === "lock") {
      await channel.permissionOverwrites.edit(everyone, { SendMessages: false });
      const embed = new EmbedBuilder().setColor(0xed4245).setTitle("🔒 Canal Bloqueado")
        .setDescription(`${channel} ha sido bloqueado.${reason ? `\nRazón: ${reason}` : ""}`).setTimestamp();
      return interaction.reply({ embeds: [embed] });
    } else {
      await channel.permissionOverwrites.edit(everyone, { SendMessages: null });
      const embed = new EmbedBuilder().setColor(0x57f287).setTitle("🔓 Canal Desbloqueado")
        .setDescription(`${channel} ha sido desbloqueado.`).setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }
  },

  async permissions(interaction) {
    const channel = interaction.options.getChannel("canal");
    const role = interaction.options.getRole("rol");
    const perm = interaction.options.getString("permiso");
    const value = interaction.options.getString("valor");

    const permObj = {};
    if (value === "allow") permObj[perm] = true;
    else if (value === "deny") permObj[perm] = false;
    else permObj[perm] = null;

    await channel.permissionOverwrites.edit(role, permObj);
    const icons = { allow: "✅", deny: "❌", neutral: "⬜" };
    return interaction.reply({
      content: `${icons[value]} Permiso **${perm}** para @${role.name} en ${channel}: **${value}**`,
    });
  },
};

module.exports = { definitions, handlers };
