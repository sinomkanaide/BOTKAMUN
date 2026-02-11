const {
  EmbedBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const { settings, verifications } = require("../utils/database");
const { challenges } = require("../commands/verification");

async function handleButton(interaction, client) {
  if (interaction.customId !== "verify_start") return;

  const config = settings.get(`verify-${interaction.guild.id}`);
  if (!config) {
    return interaction.reply({
      content: "❌ La verificación no está configurada en este servidor.",
      ephemeral: true,
    });
  }

  // Comprobar si ya está verificado
  const member = interaction.member;
  if (member.roles.cache.has(config.roleId)) {
    return interaction.reply({
      content: "✅ Ya estás verificado.",
      ephemeral: true,
    });
  }

  // Generar desafío
  const challenge = challenges[config.type]();

  // Guardar desafío pendiente
  verifications.set(interaction.user.id, {
    guildId: interaction.guild.id,
    answer: challenge.answer,
    type: config.type,
    roleId: config.roleId,
    timestamp: Date.now(),
  });

  // Crear modal para la respuesta
  const modal = new ModalBuilder()
    .setCustomId("verify_answer")
    .setTitle("🔐 Verificación");

  const questionInput = new TextInputBuilder()
    .setCustomId("answer")
    .setLabel(challenge.question.slice(0, 45))
    .setPlaceholder(challenge.hint || "Escribe tu respuesta aquí")
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
      content: "❌ No tienes una verificación pendiente. Haz clic en el botón de nuevo.",
      ephemeral: true,
    });
  }

  const answer = interaction.fields.getTextInputValue("answer").trim().toLowerCase();

  let success = false;

  if (pending.type === "question") {
    // Para preguntas abiertas, solo verificar longitud mínima
    success = answer.split(/\s+/).length >= 10;
  } else {
    success = answer === pending.answer.toString().toLowerCase();
  }

  if (success) {
    // Dar el rol
    try {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      await member.roles.add(pending.roleId);
      verifications.delete(interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("✅ ¡Verificación Exitosa!")
        .setDescription(
          `¡Bienvenido/a ${interaction.user}! Ya tienes acceso completo al servidor.`
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      console.error("Error asignando rol de verificación:", err);
      return interaction.reply({
        content: "❌ Error al asignar el rol. Contacta a un administrador.",
        ephemeral: true,
      });
    }
  } else {
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle("❌ Respuesta Incorrecta")
      .setDescription(
        "Tu respuesta no es correcta. Haz clic en el botón para intentarlo de nuevo."
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

async function onMemberJoin(member, client) {
  // Verificar si hay configuración de verificación para este servidor
  const config = settings.get(`verify-${member.guild.id}`);
  if (!config) return;

  // Opcionalmente dar un rol de "no verificado" o limitar acceso
  // Por ahora solo logueamos
  console.log(
    `👤 Nuevo miembro ${member.user.tag} debe verificarse en ${member.guild.name}`
  );
}

module.exports = { handleButton, handleModal, onMemberJoin };
