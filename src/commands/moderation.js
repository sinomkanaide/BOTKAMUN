const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const { warnings } = require("../utils/database");

const definitions = [
  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user from the server")
    .addUserOption((o) => o.setName("user").setDescription("User to kick").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason"))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user from the server")
    .addUserOption((o) => o.setName("user").setDescription("User to ban").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason"))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Timeout a user")
    .addUserOption((o) => o.setName("user").setDescription("User to mute").setRequired(true))
    .addIntegerOption((o) =>
      o.setName("minutes").setDescription("Duration in minutes").setRequired(true).setMinValue(1).setMaxValue(40320)
    )
    .addStringOption((o) => o.setName("reason").setDescription("Reason"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Remove timeout from a user")
    .addUserOption((o) => o.setName("user").setDescription("User to unmute").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user")
    .addUserOption((o) => o.setName("user").setDescription("User to warn").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("View warnings for a user")
    .addUserOption((o) => o.setName("user").setDescription("User to check").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Delete messages from the channel")
    .addIntegerOption((o) =>
      o.setName("amount").setDescription("Amount (1-100)").setRequired(true).setMinValue(1).setMaxValue(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
];

const handlers = {
  async kick(interaction) {
    const member = interaction.options.getMember("user");
    const reason = interaction.options.getString("reason") || "No reason";
    if (!member.kickable) return interaction.reply({ content: "Cannot kick this user.", ephemeral: true });
    await member.kick(reason);
    const embed = new EmbedBuilder().setColor(0xfee75c).setTitle("👢 User Kicked")
      .addFields({ name: "User", value: member.user.tag, inline: true }, { name: "Moderator", value: interaction.user.tag, inline: true }, { name: "Reason", value: reason }).setTimestamp();
    return interaction.reply({ embeds: [embed] });
  },

  async ban(interaction) {
    const member = interaction.options.getMember("user");
    const reason = interaction.options.getString("reason") || "No reason";
    if (!member.bannable) return interaction.reply({ content: "Cannot ban this user.", ephemeral: true });
    await member.ban({ reason });
    const embed = new EmbedBuilder().setColor(0xed4245).setTitle("🔨 User Banned")
      .addFields({ name: "User", value: member.user.tag, inline: true }, { name: "Moderator", value: interaction.user.tag, inline: true }, { name: "Reason", value: reason }).setTimestamp();
    return interaction.reply({ embeds: [embed] });
  },

  async mute(interaction) {
    const member = interaction.options.getMember("user");
    const minutes = interaction.options.getInteger("minutes");
    const reason = interaction.options.getString("reason") || "No reason";
    if (!member.moderatable) return interaction.reply({ content: "Cannot mute this user.", ephemeral: true });
    await member.timeout(minutes * 60 * 1000, reason);
    const embed = new EmbedBuilder().setColor(0xf0b232).setTitle("🔇 User Muted")
      .addFields({ name: "User", value: member.user.tag, inline: true }, { name: "Duration", value: `${minutes} min`, inline: true }, { name: "Reason", value: reason }).setTimestamp();
    return interaction.reply({ embeds: [embed] });
  },

  async unmute(interaction) {
    const member = interaction.options.getMember("user");
    await member.timeout(null);
    return interaction.reply({ content: `**${member.user.tag}** has been unmuted.` });
  },

  async warn(interaction) {
    const user = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");
    const key = `${interaction.guild.id}-${user.id}`;
    const list = warnings.get(key) || [];
    list.push({ reason, mod: interaction.user.tag, date: new Date().toISOString() });
    warnings.set(key, list);
    const embed = new EmbedBuilder().setColor(0xffa500).setTitle("⚠️ Warning")
      .addFields({ name: "User", value: user.tag, inline: true }, { name: "Total", value: `${list.length}`, inline: true }, { name: "Reason", value: reason }).setTimestamp();
    return interaction.reply({ embeds: [embed] });
  },

  async warnings(interaction) {
    const user = interaction.options.getUser("user");
    const key = `${interaction.guild.id}-${user.id}`;
    const list = warnings.get(key) || [];
    if (!list.length) return interaction.reply({ content: `**${user.tag}** has no warnings.`, ephemeral: true });
    const desc = list.map((w, i) => `**${i + 1}.** ${w.reason}\n   _by ${w.mod} — ${new Date(w.date).toLocaleDateString()}_`).join("\n\n");
    const embed = new EmbedBuilder().setColor(0xffa500).setTitle(`Warnings for ${user.tag}`).setDescription(desc).setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  },

  async clear(interaction) {
    const amount = interaction.options.getInteger("amount");
    const deleted = await interaction.channel.bulkDelete(amount, true);
    return interaction.reply({ content: `Deleted **${deleted.size}** messages.`, ephemeral: true });
  },
};

module.exports = { definitions, handlers };
