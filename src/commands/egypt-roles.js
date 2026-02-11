const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { settings } = require("../utils/database");

// Default Egyptian hierarchy
const DEFAULT_RANKS = [
  { level: 0, roleKey: "slave", name: "⛓️ Esclavo", color: 0x6d6d6d, description: "Recién llegado al reino" },
  { level: -1, roleKey: "citizen", name: "🏺 Ciudadano de Egipto", color: 0xc8a96e, description: "Verificado en el reino" },
  { level: 3, roleKey: "craftsman", name: "⚒️ Craftsman", color: 0xcd7f32, description: "Artesano del faraón" },
  { level: 10, roleKey: "official", name: "🏛️ Official", color: 0x4a90d9, description: "Oficial del imperio" },
  { level: 25, roleKey: "scribe", name: "📜 Scribe", color: 0x9b59b6, description: "Escriba sagrado" },
  { level: 50, roleKey: "high_priest", name: "🔱 Sumo Sacerdote", color: 0xf1c40f, description: "Mano derecha del faraón" },
];

function getRanks(guildId) {
  return settings.get(`ranks-${guildId}`) || DEFAULT_RANKS;
}

function setRanks(guildId, ranks) {
  settings.set(`ranks-${guildId}`, ranks);
}

function getClaimConfig(guildId) {
  return settings.get(`claim-${guildId}`) || null;
}

function setClaimConfig(guildId, config) {
  settings.set(`claim-${guildId}`, config);
}

function getApiConfig(guildId) {
  return settings.get(`gameapi-${guildId}`) || null;
}

function setApiConfig(guildId, config) {
  settings.set(`gameapi-${guildId}`, config);
}

// Find which rank a level qualifies for (game-level ranks only, level >= 0)
function getRankForLevel(ranks, playerLevel) {
  const gameRanks = ranks
    .filter((r) => r.level > 0)
    .sort((a, b) => b.level - a.level);

  for (const rank of gameRanks) {
    if (playerLevel >= rank.level) return rank;
  }
  return null;
}

const definitions = [
  new SlashCommandBuilder()
    .setName("setupclaim")
    .setDescription("Configura el canal de Claim de Rangos Egipcios")
    .addChannelOption((o) =>
      o.setName("canal").setDescription("Canal donde estará el botón de claim").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("setgameapi")
    .setDescription("Configura la URL de la API del juego para consultar niveles")
    .addStringOption((o) =>
      o.setName("url").setDescription("URL base de la API (ej: https://api.myjuego.com)").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("endpoint").setDescription("Endpoint con {wallet} como placeholder (ej: /player/{wallet}/level)").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("campo_nivel").setDescription("Campo JSON que contiene el nivel (ej: level, data.level)").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("api_key").setDescription("API Key si la necesita (opcional)")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("ranks")
    .setDescription("Ver la jerarquía de rangos egipcios del servidor"),

  new SlashCommandBuilder()
    .setName("setuproles")
    .setDescription("Crea todos los roles egipcios en el servidor automáticamente")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
];

const handlers = {
  async setupclaim(interaction, client) {
    const channel = interaction.options.getChannel("canal");

    // Verificar que la API esté configurada
    const apiConfig = getApiConfig(interaction.guild.id);
    if (!apiConfig) {
      return interaction.reply({
        content: "❌ Primero configura la API del juego con `/setgameapi`",
        ephemeral: true,
      });
    }

    const ranks = getRanks(interaction.guild.id);

    // Build the ranks display
    const ranksDisplay = ranks
      .filter((r) => r.level > 0)
      .sort((a, b) => a.level - b.level)
      .map((r) => `${r.name} — Nivel ${r.level}+`)
      .join("\n");

    const embed = new EmbedBuilder()
      .setColor(0xd4a843)
      .setTitle("🏛️ Templo de los Rangos — Claim tu Posición")
      .setDescription(
        `Los dioses del Nilo han escuchado tus hazañas.\n\n` +
        `Conecta tu wallet y demuestra tu valía para ascender en la jerarquía del imperio.\n\n` +
        `**📊 Jerarquía Sagrada:**\n${ranksDisplay}\n\n` +
        `**¿Cómo funciona?**\n` +
        `1. Haz clic en el botón de abajo\n` +
        `2. Conecta tu wallet (MetaMask)\n` +
        `3. Firma el mensaje para verificar tu identidad\n` +
        `4. El oráculo consultará tu nivel y asignará tu rango\n\n` +
        `_Solo el verdadero dueño de la wallet puede reclamar su rango._`
      )
      .setImage("https://i.imgur.com/8QjGqXj.png") // placeholder, can be changed
      .setFooter({ text: "⚡ Sistema de verificación por wallet" })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("claim_rank")
        .setLabel("🔱 Claim tu Rango")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("view_my_rank")
        .setLabel("📊 Mi Rango Actual")
        .setStyle(ButtonStyle.Secondary)
    );

    await channel.send({ embeds: [embed], components: [row] });

    // Save config
    setClaimConfig(interaction.guild.id, {
      channelId: channel.id,
      setupBy: interaction.user.id,
      createdAt: new Date().toISOString(),
    });

    return interaction.reply({
      content: `✅ Canal de claim configurado en ${channel}.\n\n**Resumen de configuración:**\n• API: \`${apiConfig.baseUrl}${apiConfig.endpoint}\`\n• Campo nivel: \`${apiConfig.levelField}\`\n• Rangos: ${ranks.filter((r) => r.level > 0).length} niveles configurados`,
      ephemeral: true,
    });
  },

  async setgameapi(interaction) {
    const url = interaction.options.getString("url").replace(/\/$/, "");
    const endpoint = interaction.options.getString("endpoint");
    const levelField = interaction.options.getString("campo_nivel");
    const apiKey = interaction.options.getString("api_key");

    setApiConfig(interaction.guild.id, {
      baseUrl: url,
      endpoint,
      levelField,
      apiKey: apiKey || null,
    });

    const exampleUrl = `${url}${endpoint.replace("{wallet}", "0x1234...")}`;

    return interaction.reply({
      content:
        `✅ API del juego configurada:\n\n` +
        `**URL ejemplo:** \`${exampleUrl}\`\n` +
        `**Campo nivel:** \`${levelField}\`\n` +
        `**API Key:** ${apiKey ? "Configurada ✅" : "No requerida"}\n\n` +
        `Ahora usa \`/setupclaim\` para crear el canal de claim.`,
      ephemeral: true,
    });
  },

  async ranks(interaction) {
    const ranks = getRanks(interaction.guild.id);

    const display = ranks
      .sort((a, b) => {
        if (a.level === 0) return -1;
        if (b.level === 0) return -1;
        if (a.level === -1) return -1;
        if (b.level === -1) return -1;
        return a.level - b.level;
      })
      .map((r) => {
        if (r.level === 0) return `${r.name} — _${r.description}_`;
        if (r.level === -1) return `${r.name} — _${r.description}_ (verificado)`;
        return `${r.name} — Nivel **${r.level}**+ — _${r.description}_`;
      })
      .join("\n\n");

    const embed = new EmbedBuilder()
      .setColor(0xd4a843)
      .setTitle("🏺 Jerarquía del Imperio Egipcio")
      .setDescription(display)
      .setFooter({ text: "Usa /setupclaim para configurar el canal de claim" })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },

  async setuproles(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const ranks = getRanks(interaction.guild.id);
    const created = [];

    for (const rank of ranks) {
      const existing = interaction.guild.roles.cache.find((r) => r.name === rank.name);
      if (existing) {
        created.push(`⏭️ ${rank.name} (ya existe)`);
        continue;
      }
      try {
        await interaction.guild.roles.create({
          name: rank.name,
          color: rank.color,
          hoist: true,
          reason: "Setup de jerarquía egipcia",
        });
        created.push(`✅ ${rank.name}`);
      } catch (err) {
        created.push(`❌ ${rank.name}: ${err.message}`);
      }
    }

    // Also create admin roles
    const adminRoles = [
      { name: "☀️ Faraón", color: 0xffd700, hoist: true },
      { name: "🐍 Visir", color: 0xe74c3c, hoist: true },
    ];

    for (const role of adminRoles) {
      const existing = interaction.guild.roles.cache.find((r) => r.name === role.name);
      if (existing) {
        created.push(`⏭️ ${role.name} (ya existe)`);
      } else {
        try {
          await interaction.guild.roles.create({ ...role, reason: "Setup de jerarquía egipcia" });
          created.push(`✅ ${role.name}`);
        } catch (err) {
          created.push(`❌ ${role.name}: ${err.message}`);
        }
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0xd4a843)
      .setTitle("🎭 Roles Egipcios Creados")
      .setDescription(created.join("\n"))
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};

module.exports = {
  definitions,
  handlers,
  getRanks,
  setRanks,
  getClaimConfig,
  getApiConfig,
  getRankForLevel,
};
