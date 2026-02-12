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
    .setDescription("Configure the creative verification system")
    .addChannelOption((o) => o.setName("channel").setDescription("Verification channel").setRequired(true))
    .addRoleOption((o) => o.setName("role").setDescription("Role to assign on verification").setRequired(true))
    .addStringOption((o) =>
      o.setName("type").setDescription("Verification type").setRequired(true)
        .addChoices(
          { name: "🧩 Puzzle - Solve a riddle", value: "puzzle" },
          { name: "🎨 Colors - Find the sequence", value: "colors" },
          { name: "🔢 Math - Solve an equation", value: "math" },
          { name: "📝 Question - Answer a personal question", value: "question" }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
];

// Challenge generators
const challenges = {
  puzzle() {
    const puzzles = [
      { q: "I have cities, but no houses. I have mountains, but no trees. I have water, but no fish. What am I?", a: "map" },
      { q: "The more you take away from me, the bigger I get. What am I?", a: "hole" },
      { q: "I have hands but I can't clap. What am I?", a: "clock" },
      { q: "I walk without feet, I speak without a mouth. What am I?", a: "letter" },
      { q: "It always comes but never arrives. What is it?", a: "tomorrow" },
      { q: "I have no feet yet I run, I have needles yet I don't sew. What am I?", a: "clock" },
      { q: "I fly without wings, I cry without eyes, and wherever I go darkness dies. What am I?", a: "cloud" },
    ];
    const p = puzzles[Math.floor(Math.random() * puzzles.length)];
    return { question: p.q, answer: p.a, hint: `The answer has ${p.a.length} letters` };
  },

  colors() {
    const emojis = ["🔴", "🟢", "🔵", "🟡", "🟣", "🟠"];
    const sequence = [];
    for (let i = 0; i < 4; i++) sequence.push(emojis[Math.floor(Math.random() * emojis.length)]);
    return {
      question: `Memorize this sequence and type it:\n\n# ${sequence.join(" ")}`,
      answer: sequence.join(""),
      hint: "Type the emojis in order without spaces",
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
      question: `Solve: **${a} ${op.sym} ${b} = ?**`,
      answer: result.toString(),
      hint: `The result is a ${result > 0 ? "positive" : "negative"} number`,
    };
  },

  question() {
    const questions = [
      "What is your favorite color and why? (Answer with at least 10 words)",
      "What brought you to this server? Tell us in a sentence",
      "Describe your favorite hobby in a sentence",
      "What is your favorite food and where did you discover it?",
      "If you could travel anywhere, where would you go and why?",
    ];
    const q = questions[Math.floor(Math.random() * questions.length)];
    return { question: q, answer: "__freeform__", hint: "Answer genuinely with at least 10 words" };
  },
};

const handlers = {
  async setupverify(interaction) {
    const channel = interaction.options.getChannel("channel");
    const role = interaction.options.getRole("role");
    const type = interaction.options.getString("type");

    const key = `verify-${interaction.guild.id}`;
    settings.set(key, {
      channelId: channel.id,
      roleId: role.id,
      type,
      guildId: interaction.guild.id,
    });

    const typeNames = {
      puzzle: "🧩 Solve a riddle",
      colors: "🎨 Color sequence",
      math: "🔢 Math problem",
      question: "📝 Personal question",
    };

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🔐 Verification Required")
      .setDescription(
        `Welcome to the server! To access all channels, you need to verify.\n\n` +
        `**Challenge type:** ${typeNames[type]}\n\n` +
        `Click the button below to start your verification.`
      )
      .setFooter({ text: "Creative verification system" })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("verify_start")
        .setLabel("🚀 Verify Me")
        .setStyle(ButtonStyle.Primary)
    );

    await channel.send({ embeds: [embed], components: [row] });

    return interaction.reply({
      content: `✅ Verification configured in ${channel} with type **${typeNames[type]}**.\nRole assigned: @${role.name}`,
      ephemeral: true,
    });
  },
};

module.exports = { definitions, handlers, challenges };
