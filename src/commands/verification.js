const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} = require("discord.js");
const { settings } = require("../utils/database");

const definitions = [
  new SlashCommandBuilder()
    .setName("setupverify")
    .setDescription("Configura el sistema de verificación creativa")
    .addChannelOption((o) => o.setName("canal").setDescription("Canal de verificación").setRequired(true))
    .addRoleOption((o) => o.setName("rol").setDescription("Rol a dar al verificarse").setRequired(true))
    .addStringOption((o) =>
      o.setName("tipo").setDescription("Tipo de verificación").setRequired(true)
        .addChoices(
          { name: "🧩 Puzzle - Resolver un acertijo", value: "puzzle" },
          { name: "🎨 Colores - Encontrar la secuencia", value: "colors" },
          { name: "🔢 Matemáticas - Resolver operación", value: "math" },
          { name: "📝 Pregunta personal - Responder una pregunta", value: "question" }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
];

// Generadores de desafíos
const challenges = {
  puzzle() {
    const puzzles = [
      { q: "Tengo ciudades, pero no casas. Tengo montañas, pero no árboles. Tengo agua, pero no peces. ¿Qué soy?", a: "mapa" },
      { q: "Cuanto más me quitas, más grande me hago. ¿Qué soy?", a: "hoyo" },
      { q: "Tengo manos pero no puedo aplaudir. ¿Qué soy?", a: "reloj" },
      { q: "Camino sin pies, hablo sin boca. ¿Qué soy?", a: "carta" },
      { q: "Siempre viene pero nunca llega. ¿Qué es?", a: "mañana" },
      { q: "No tengo pies y corro, tengo agujas y no coso. ¿Qué soy?", a: "reloj" },
      { q: "Vuelo sin alas, lloro sin ojos, y donde voy oscuridad destruyo. ¿Qué soy?", a: "nube" },
    ];
    const p = puzzles[Math.floor(Math.random() * puzzles.length)];
    return { question: p.q, answer: p.a, hint: `La respuesta tiene ${p.a.length} letras` };
  },

  colors() {
    const emojis = ["🔴", "🟢", "🔵", "🟡", "🟣", "🟠"];
    const sequence = [];
    for (let i = 0; i < 4; i++) sequence.push(emojis[Math.floor(Math.random() * emojis.length)]);
    return {
      question: `Memoriza esta secuencia y escríbela:\n\n# ${sequence.join(" ")}`,
      answer: sequence.join(""),
      hint: "Escribe los emojis en orden sin espacios",
    };
  },

  math() {
    const a = Math.floor(Math.random() * 50) + 10;
    const b = Math.floor(Math.random() * 30) + 5;
    const ops = [
      { sym: "+", fn: (x, y) => x + y },
      { sym: "-", fn: (x, y) => x - y },
      { sym: "×", fn: (x, y) => x * y },
    ];
    const op = ops[Math.floor(Math.random() * ops.length)];
    const result = op.fn(a, b);
    return {
      question: `Resuelve: **${a} ${op.sym} ${b} = ?**`,
      answer: result.toString(),
      hint: `El resultado es un número ${result > 0 ? "positivo" : "negativo"}`,
    };
  },

  question() {
    const questions = [
      "¿Cuál es tu color favorito y por qué? (Responde con al menos 10 palabras)",
      "¿Qué te trajo a este servidor? Cuéntanos en una frase",
      "Describe tu hobby favorito en una oración",
      "¿Cuál es tu comida favorita y dónde la descubriste?",
      "Si pudieras viajar a cualquier lugar, ¿a dónde irías y por qué?",
    ];
    const q = questions[Math.floor(Math.random() * questions.length)];
    return { question: q, answer: "__freeform__", hint: "Responde de forma genuina con al menos 10 palabras" };
  },
};

const handlers = {
  async setupverify(interaction) {
    const channel = interaction.options.getChannel("canal");
    const role = interaction.options.getRole("rol");
    const type = interaction.options.getString("tipo");

    // Guardar configuración
    const key = `verify-${interaction.guild.id}`;
    settings.set(key, {
      channelId: channel.id,
      roleId: role.id,
      type,
      guildId: interaction.guild.id,
    });

    // Crear el embed de verificación en el canal
    const typeNames = {
      puzzle: "🧩 Resolver un acertijo",
      colors: "🎨 Secuencia de colores",
      math: "🔢 Problema matemático",
      question: "📝 Pregunta personal",
    };

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🔐 Verificación Requerida")
      .setDescription(
        `¡Bienvenido al servidor! Para acceder a todos los canales, necesitas verificarte.\n\n` +
        `**Tipo de desafío:** ${typeNames[type]}\n\n` +
        `Haz clic en el botón de abajo para comenzar tu verificación.`
      )
      .setFooter({ text: "Sistema de verificación creativa" })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("verify_start")
        .setLabel("🚀 Verificarme")
        .setStyle(ButtonStyle.Primary)
    );

    await channel.send({ embeds: [embed], components: [row] });

    return interaction.reply({
      content: `✅ Sistema de verificación configurado en ${channel} con el tipo **${typeNames[type]}**.\nRol asignado: @${role.name}`,
      ephemeral: true,
    });
  },
};

module.exports = { definitions, handlers, challenges };
