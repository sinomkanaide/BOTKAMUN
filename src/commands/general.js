const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const definitions = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Muestra la latencia del bot"),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Muestra información del servidor"),

  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Muestra información de un usuario")
    .addUserOption((o) =>
      o.setName("usuario").setDescription("Usuario (default: tú)")
    ),

  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Muestra el avatar de un usuario")
    .addUserOption((o) =>
      o.setName("usuario").setDescription("Usuario (default: tú)")
    ),

  new SlashCommandBuilder()
    .setName("say")
    .setDescription("El bot dice algo por ti")
    .addStringOption((o) =>
      o.setName("mensaje").setDescription("Mensaje").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Muestra todos los comandos disponibles"),
];

const handlers = {
  async ping(interaction) {
    const sent = await interaction.reply({
      content: "🏓 Calculando...",
      fetchReply: true,
    });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🏓 Pong!")
      .addFields(
        { name: "Latencia", value: `${latency}ms`, inline: true },
        {
          name: "API",
          value: `${interaction.client.ws.ping}ms`,
          inline: true,
        }
      )
      .setTimestamp();
    return interaction.editReply({ content: null, embeds: [embed] });
  },

  async serverinfo(interaction) {
    const guild = interaction.guild;
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📊 ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .addFields(
        { name: "👑 Dueño", value: `<@${guild.ownerId}>`, inline: true },
        {
          name: "👥 Miembros",
          value: `${guild.memberCount}`,
          inline: true,
        },
        {
          name: "📁 Canales",
          value: `${guild.channels.cache.size}`,
          inline: true,
        },
        {
          name: "🎭 Roles",
          value: `${guild.roles.cache.size}`,
          inline: true,
        },
        {
          name: "📅 Creado",
          value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
          inline: true,
        },
        {
          name: "🔒 Nivel de verificación",
          value: `${guild.verificationLevel}`,
          inline: true,
        }
      )
      .setTimestamp();
    return interaction.reply({ embeds: [embed] });
  },

  async userinfo(interaction) {
    const user = interaction.options.getUser("usuario") || interaction.user;
    const member = await interaction.guild.members
      .fetch(user.id)
      .catch(() => null);

    const embed = new EmbedBuilder()
      .setColor(member?.displayHexColor || 0x5865f2)
      .setTitle(`👤 ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "🆔 ID", value: user.id, inline: true },
        {
          name: "📅 Cuenta creada",
          value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
          inline: true,
        }
      );

    if (member) {
      embed.addFields(
        {
          name: "📥 Se unió",
          value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`,
          inline: true,
        },
        {
          name: "🎭 Roles",
          value:
            member.roles.cache
              .filter((r) => r.id !== interaction.guild.id)
              .map((r) => `${r}`)
              .join(", ") || "Ninguno",
        }
      );
    }

    return interaction.reply({ embeds: [embed] });
  },

  async avatar(interaction) {
    const user = interaction.options.getUser("usuario") || interaction.user;
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🖼️ Avatar de ${user.tag}`)
      .setImage(user.displayAvatarURL({ size: 512 }))
      .setTimestamp();
    return interaction.reply({ embeds: [embed] });
  },

  async say(interaction) {
    const message = interaction.options.getString("mensaje");
    await interaction.reply({ content: "✅ Mensaje enviado.", ephemeral: true });
    return interaction.channel.send(message);
  },

  async help(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("📖 Comandos Disponibles")
      .addFields(
        {
          name: "🛡️ Moderación",
          value:
            "`/kick` `/ban` `/mute` `/unmute` `/warn` `/warnings` `/clear`",
        },
        {
          name: "📁 Canales",
          value:
            "`/createchannel` `/deletechannel` `/editchannel` `/lockdown` `/permissions`",
        },
        {
          name: "📢 Anuncios",
          value: "`/announce` `/schedule` `/scheduled`",
        },
        {
          name: "🔐 Verificación",
          value: "`/setupverify`",
        },
        {
          name: "🏗️ Setup",
          value: "`/setup` — Crea estructura completa del servidor",
        },
        {
          name: "🏛️ Rangos Egipcios",
          value: "`/setuproles` `/setgameapi` `/setupclaim` `/ranks`",
        },
        {
          name: "🎮 General",
          value: "`/ping` `/serverinfo` `/userinfo` `/avatar` `/say` `/help`",
        }
      )
      .setFooter({ text: "🌐 Dashboard disponible en el panel web" })
      .setTimestamp();
    return interaction.reply({ embeds: [embed] });
  },
};

module.exports = { definitions, handlers };
