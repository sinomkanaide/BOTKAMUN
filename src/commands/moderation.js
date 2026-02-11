const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const { warnings } = require("../utils/database");

const definitions = [
  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Expulsa a un usuario del servidor")
    .addUserOption((o) => o.setName("usuario").setDescription("Usuario").setRequired(true))
    .addStringOption((o) => o.setName("razon").setDescription("Razón"))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Banea a un usuario del servidor")
    .addUserOption((o) => o.setName("usuario").setDescription("Usuario").setRequired(true))
    .addStringOption((o) => o.setName("razon").setDescription("Razón"))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Silencia a un usuario")
    .addUserOption((o) => o.setName("usuario").setDescription("Usuario").setRequired(true))
    .addIntegerOption((o) =>
      o.setName("minutos").setDescription("Duración en minutos").setRequired(true).setMinValue(1).setMaxValue(40320)
    )
    .addStringOption((o) => o.setName("razon").setDescription("Razón"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Quita el silencio a un usuario")
    .addUserOption((o) => o.setName("usuario").setDescription("Usuario").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Advierte a un usuario")
    .addUserOption((o) => o.setName("usuario").setDescription("Usuario").setRequired(true))
    .addStringOption((o) => o.setName("razon").setDescription("Razón").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("Ver advertencias de un usuario")
    .addUserOption((o) => o.setName("usuario").setDescription("Usuario").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Elimina mensajes del canal")
    .addIntegerOption((o) =>
      o.setName("cantidad").setDescription("Cantidad (1-100)").setRequired(true).setMinValue(1).setMaxValue(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
];

const handlers = {
  async kick(interaction) {
    const member = interaction.options.getMember("usuario");
    const reason = interaction.options.getString("razon") || "Sin razón";
    if (!member.kickable) return interaction.reply({ content: "❌ No puedo expulsar a este usuario.", ephemeral: true });
    await member.kick(reason);
    const embed = new EmbedBuilder().setColor(0xfee75c).setTitle("👢 Usuario Expulsado")
      .addFields({ name: "Usuario", value: member.user.tag, inline: true }, { name: "Moderador", value: interaction.user.tag, inline: true }, { name: "Razón", value: reason }).setTimestamp();
    return interaction.reply({ embeds: [embed] });
  },

  async ban(interaction) {
    const member = interaction.options.getMember("usuario");
    const reason = interaction.options.getString("razon") || "Sin razón";
    if (!member.bannable) return interaction.reply({ content: "❌ No puedo banear a este usuario.", ephemeral: true });
    await member.ban({ reason });
    const embed = new EmbedBuilder().setColor(0xed4245).setTitle("🔨 Usuario Baneado")
      .addFields({ name: "Usuario", value: member.user.tag, inline: true }, { name: "Moderador", value: interaction.user.tag, inline: true }, { name: "Razón", value: reason }).setTimestamp();
    return interaction.reply({ embeds: [embed] });
  },

  async mute(interaction) {
    const member = interaction.options.getMember("usuario");
    const minutes = interaction.options.getInteger("minutos");
    const reason = interaction.options.getString("razon") || "Sin razón";
    if (!member.moderatable) return interaction.reply({ content: "❌ No puedo silenciar a este usuario.", ephemeral: true });
    await member.timeout(minutes * 60 * 1000, reason);
    const embed = new EmbedBuilder().setColor(0xf0b232).setTitle("🔇 Usuario Silenciado")
      .addFields({ name: "Usuario", value: member.user.tag, inline: true }, { name: "Duración", value: `${minutes} min`, inline: true }, { name: "Razón", value: reason }).setTimestamp();
    return interaction.reply({ embeds: [embed] });
  },

  async unmute(interaction) {
    const member = interaction.options.getMember("usuario");
    await member.timeout(null);
    return interaction.reply({ content: `✅ **${member.user.tag}** ya puede hablar.` });
  },

  async warn(interaction) {
    const user = interaction.options.getUser("usuario");
    const reason = interaction.options.getString("razon");
    const key = `${interaction.guild.id}-${user.id}`;
    const list = warnings.get(key) || [];
    list.push({ reason, mod: interaction.user.tag, date: new Date().toISOString() });
    warnings.set(key, list);
    const embed = new EmbedBuilder().setColor(0xffa500).setTitle("⚠️ Advertencia")
      .addFields({ name: "Usuario", value: user.tag, inline: true }, { name: "Total", value: `${list.length}`, inline: true }, { name: "Razón", value: reason }).setTimestamp();
    return interaction.reply({ embeds: [embed] });
  },

  async warnings(interaction) {
    const user = interaction.options.getUser("usuario");
    const key = `${interaction.guild.id}-${user.id}`;
    const list = warnings.get(key) || [];
    if (!list.length) return interaction.reply({ content: `✅ **${user.tag}** no tiene advertencias.`, ephemeral: true });
    const desc = list.map((w, i) => `**${i + 1}.** ${w.reason}\n   _por ${w.mod} — ${new Date(w.date).toLocaleDateString()}_`).join("\n\n");
    const embed = new EmbedBuilder().setColor(0xffa500).setTitle(`📋 Advertencias de ${user.tag}`).setDescription(desc).setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  },

  async clear(interaction) {
    const amount = interaction.options.getInteger("cantidad");
    const deleted = await interaction.channel.bulkDelete(amount, true);
    return interaction.reply({ content: `🧹 Eliminados **${deleted.size}** mensajes.`, ephemeral: true });
  },
};

module.exports = { definitions, handlers };
