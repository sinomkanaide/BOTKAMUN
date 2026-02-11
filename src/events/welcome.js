const { EmbedBuilder } = require("discord.js");
const { settings } = require("../utils/database");

async function onMemberJoin(member, client) {
  // Find configured or auto-detected welcome channel
  const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
  let channel = null;

  if (welcomeChannelId) {
    channel = member.guild.channels.cache.get(welcomeChannelId);
  }

  if (!channel) {
    channel = member.guild.channels.cache.find(
      (c) =>
        c.name.includes("welcome") ||
        c.name.includes("introductions") ||
        c.name.includes("bienvenida") ||
        c.name.includes("presentaciones")
    );
  }

  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("👋 Welcome!")
    .setDescription(
      `Hello ${member}! Welcome to **${member.guild.name}**.\n\n` +
        `You are member #${member.guild.memberCount}.\n` +
        `Check the rules and enjoy your stay.`
    )
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: `ID: ${member.id}` })
    .setTimestamp();

  channel.send({ embeds: [embed] });
}

module.exports = { onMemberJoin };
