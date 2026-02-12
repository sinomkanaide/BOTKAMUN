const {
  EmbedBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const { settings, verifications } = require("../utils/database");
const { challenges } = require("../commands/verification");
const { getRanks } = require("../commands/egypt-roles");

async function handleButton(interaction, client) {
  if (interaction.customId !== "verify_start") return;

  const config = settings.get(`verify-${interaction.guild.id}`);
  if (!config) {
    return interaction.reply({
      content: "❌ Verification is not configured on this server.",
      ephemeral: true,
    });
  }

  // Check if already verified
  const member = interaction.member;
  if (member.roles.cache.has(config.roleId)) {
    return interaction.reply({
      content: "✅ You are already verified.",
      ephemeral: true,
    });
  }

  // Generate challenge
  const challenge = challenges[config.type]();

  // Save pending challenge
  verifications.set(interaction.user.id, {
    guildId: interaction.guild.id,
    answer: challenge.answer,
    type: config.type,
    roleId: config.roleId,
    timestamp: Date.now(),
  });

  // Create modal for the answer
  const modal = new ModalBuilder()
    .setCustomId("verify_answer")
    .setTitle("🔐 Verification");

  const questionInput = new TextInputBuilder()
    .setCustomId("answer")
    .setLabel(challenge.question.slice(0, 45))
    .setPlaceholder(challenge.hint || "Type your answer here")
    .setStyle(
      config.type === "question" ? TextInputStyle.Paragraph : TextInputStyle.Short
    )
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(questionInput)
  );

  await interaction.showModal(modal);
}

async function handleModal(interaction, client) {
  if (interaction.customId !== "verify_answer") return;

  const pending = verifications.get(interaction.user.id);
  if (!pending) {
    return interaction.reply({
      content: "❌ You have no pending verification. Click the button again.",
      ephemeral: true,
    });
  }

  const answer = interaction.fields.getTextInputValue("answer").trim().toLowerCase();

  let success = false;

  if (pending.type === "question") {
    // For open-ended questions, just check minimum length
    success = answer.split(/\s+/).length >= 10;
  } else {
    success = answer === pending.answer.toString().toLowerCase();
  }

  if (success) {
    // Assign the Citizen role
    try {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      await member.roles.add(pending.roleId);

      // Slave role stays — it's only removed when claiming a game rank

      verifications.delete(interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("✅ Verification Successful!")
        .setDescription(
          `Welcome ${interaction.user}! You now have full access to the server.`
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      console.error("Error assigning verification role:", err);
      return interaction.reply({
        content: "❌ Error assigning the role. Contact an administrator.",
        ephemeral: true,
      });
    }
  } else {
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle("❌ Incorrect Answer")
      .setDescription(
        "Your answer is not correct. Click the button to try again."
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

async function onMemberJoin(member, client) {
  // Check if verification is configured for this server
  const config = settings.get(`verify-${member.guild.id}`);
  if (!config) return;

  // Auto-assign the Slave role (level 0) to new members
  const ranks = getRanks(member.guild.id);
  const slaveRank = ranks.find((r) => r.level === 0);
  if (slaveRank) {
    const slaveRole = member.guild.roles.cache.find((r) => r.name === slaveRank.name);
    if (slaveRole) {
      try {
        await member.roles.add(slaveRole);
        console.log(`⛓️ Assigned Slave role to ${member.user.tag} in ${member.guild.name}`);
      } catch (err) {
        console.error(`Error assigning Slave role to ${member.user.tag}:`, err);
      }
    }
  }
}

module.exports = { handleButton, handleModal, onMemberJoin };
