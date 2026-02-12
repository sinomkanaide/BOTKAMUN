const { EmbedBuilder } = require("discord.js");
const { settings } = require("../utils/database");
const { getRanks } = require("../commands/egypt-roles");

async function onMemberJoin(member, client) {
  // ─── Assign Slave role (level 0) to new members ───
  try {
    const ranks = getRanks(member.guild.id);
    const slaveRank = ranks.find((r) => r.level === 0);
    if (slaveRank) {
      let slaveRole = member.guild.roles.cache.find((r) => r.name === slaveRank.name);
      if (!slaveRole) {
        slaveRole = await member.guild.roles.create({
          name: slaveRank.name,
          color: slaveRank.color,
          hoist: true,
          reason: "Auto-created for new member entry rank",
        });
      }
      await member.roles.add(slaveRole);
    }
  } catch (err) {
    console.error("Error assigning Slave role:", err);
  }

  // ─── Welcome message ───
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
