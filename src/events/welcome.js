const { EmbedBuilder } = require("discord.js");
const { settings } = require("../utils/database");

async function onMemberJoin(member, client) {
  // Buscar canal de bienvenida configurado o por nombre
  const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
  let channel = null;

  if (welcomeChannelId) {
    channel = member.guild.channels.cache.get(welcomeChannelId);
  }

  if (!channel) {
    channel = member.guild.channels.cache.find(
      (c) =>
        c.name.includes("bienvenida") ||
        c.name.includes("welcome") ||
        c.name.includes("presentaciones")
    );
  }

  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("👋 ¡Bienvenido/a!")
    .setDescription(
      `¡Hola ${member}! Bienvenido/a a **${member.guild.name}**.\n\n` +
        `Eres el miembro #${member.guild.memberCount}.\n` +
        `Revisa las reglas y disfruta tu estancia.`
    )
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: `ID: ${member.id}` })
    .setTimestamp();

  channel.send({ embeds: [embed] });
}

module.exports = { onMemberJoin };
