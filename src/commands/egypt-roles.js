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
  { level: 0, roleKey: "slave", name: "⛓️ Slave", color: 0x6d6d6d, description: "Newcomer to the kingdom" },
  { level: -1, roleKey: "citizen", name: "🏺 Citizen", color: 0xc8a96e, description: "Verified in the kingdom" },
  { level: 3, roleKey: "craftsman", name: "⚒️ Craftsman", color: 0xcd7f32, description: "Artisan of the Pharaoh" },
  { level: 10, roleKey: "official", name: "🏛️ Official", color: 0x4a90d9, description: "Officer of the empire" },
  { level: 25, roleKey: "scribe", name: "📜 Scribe", color: 0x9b59b6, description: "Sacred scribe" },
  { level: 50, roleKey: "high_priest", name: "🔱 High Priest", color: 0xf1c40f, description: "Right hand of the Pharaoh" },
];

// Role permissions by role name
const ROLE_PERMISSIONS = {
  "☀️ Pharaoh": [PermissionFlagsBits.Administrator],
  "🐍 Vizier": [
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.ManageRoles,
  ],
  "🔱 High Priest": [
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.ModerateMembers,
  ],
  "📜 Scribe": [PermissionFlagsBits.ManageMessages],
};

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
    .setDescription("Configure the Egyptian Rank Claim channel")
    .addChannelOption((o) =>
      o.setName("channel").setDescription("Channel where the claim button will be").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("setgameapi")
    .setDescription("Configure the game API URL for level lookup")
    .addStringOption((o) =>
      o.setName("url").setDescription("Base API URL (e.g. https://api.mygame.com)").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("endpoint").setDescription("Endpoint with {wallet} placeholder (e.g. /player/{wallet}/level)").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("level_field").setDescription("JSON field containing the level (e.g. level, data.level)").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("api_key").setDescription("API Key if required (optional)")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("ranks")
    .setDescription("View the Egyptian rank hierarchy for this server"),

  new SlashCommandBuilder()
    .setName("setuproles")
    .setDescription("Create all Egyptian hierarchy roles in the server automatically")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("clearroles")
    .setDescription("Delete all bot-created roles (Egyptian hierarchy)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
];

const handlers = {
  async setupclaim(interaction, client) {
    const channel = interaction.options.getChannel("channel");

    // Check that the API is configured
    const apiConfig = getApiConfig(interaction.guild.id);
    if (!apiConfig) {
      return interaction.reply({
        content: "❌ First configure the game API with `/setgameapi`",
        ephemeral: true,
      });
    }

    const ranks = getRanks(interaction.guild.id);

    // Build the ranks display
    const ranksDisplay = ranks
      .filter((r) => r.level > 0)
      .sort((a, b) => a.level - b.level)
      .map((r) => `${r.name} — Level ${r.level}+`)
      .join("\n");

    const embed = new EmbedBuilder()
      .setColor(0xd4a843)
      .setTitle("🏛️ Temple of Ranks — Claim Your Position")
      .setDescription(
        `The gods of the Nile have heard of your deeds.\n\n` +
        `Connect your wallet and prove your worth to ascend the empire's hierarchy.\n\n` +
        `**📊 Sacred Hierarchy:**\n${ranksDisplay}\n\n` +
        `**How does it work?**\n` +
        `1. Click the button below\n` +
        `2. Connect your wallet (MetaMask)\n` +
        `3. Sign the message to verify your identity\n` +
        `4. The oracle will check your level and assign your rank\n\n` +
        `_Only the true owner of the wallet can claim their rank._`
      )
      .setImage("https://teal-delicate-halibut-560.mypinata.cloud/ipfs/bafybeid6hn6gpf2s2bzteyniwy5gwc3jb7g5qsqquidnnf62dusbumbzfm")
      .setFooter({ text: "⚡ Wallet verification system" })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("claim_rank")
        .setLabel("🔱 Claim Your Rank")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("view_my_rank")
        .setLabel("📊 My Current Rank")
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
      content: `✅ Claim channel configured in ${channel}.\n\n**Configuration summary:**\n• API: \`${apiConfig.baseUrl}${apiConfig.endpoint}\`\n• Level field: \`${apiConfig.levelField}\`\n• Ranks: ${ranks.filter((r) => r.level > 0).length} levels configured`,
      ephemeral: true,
    });
  },

  async setgameapi(interaction) {
    const url = interaction.options.getString("url").replace(/\/$/, "");
    const endpoint = interaction.options.getString("endpoint");
    const levelField = interaction.options.getString("level_field");
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
        `✅ Game API configured:\n\n` +
        `**Example URL:** \`${exampleUrl}\`\n` +
        `**Level field:** \`${levelField}\`\n` +
        `**API Key:** ${apiKey ? "Configured ✅" : "Not required"}\n\n` +
        `Now use \`/setupclaim\` to create the claim channel.`,
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
        if (r.level === -1) return `${r.name} — _${r.description}_ (verified)`;
        return `${r.name} — Level **${r.level}**+ — _${r.description}_`;
      })
      .join("\n\n");

    const embed = new EmbedBuilder()
      .setColor(0xd4a843)
      .setTitle("🏺 Egyptian Empire Hierarchy")
      .setDescription(display)
      .setFooter({ text: "Use /setupclaim to configure the claim channel" })
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
        created.push(`⏭️ ${rank.name} (already exists)`);
        continue;
      }
      try {
        const perms = ROLE_PERMISSIONS[rank.name] || [];
        await interaction.guild.roles.create({
          name: rank.name,
          color: rank.color,
          hoist: true,
          permissions: perms,
          reason: "Egyptian hierarchy setup",
        });
        created.push(`✅ ${rank.name}`);
      } catch (err) {
        created.push(`❌ ${rank.name}: ${err.message}`);
      }
    }

    // Also create admin roles
    const adminRoles = [
      { name: "☀️ Pharaoh", color: 0xffd700, hoist: true },
      { name: "🐍 Vizier", color: 0xe74c3c, hoist: true },
    ];

    for (const role of adminRoles) {
      const existing = interaction.guild.roles.cache.find((r) => r.name === role.name);
      if (existing) {
        created.push(`⏭️ ${role.name} (already exists)`);
      } else {
        try {
          const perms = ROLE_PERMISSIONS[role.name] || [];
          await interaction.guild.roles.create({
            ...role,
            permissions: perms,
            reason: "Egyptian hierarchy setup",
          });
          created.push(`✅ ${role.name}`);
        } catch (err) {
          created.push(`❌ ${role.name}: ${err.message}`);
        }
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0xd4a843)
      .setTitle("🎭 Egyptian Roles Created")
      .setDescription(created.join("\n"))
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },

  async clearroles(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const ranks = getRanks(interaction.guild.id);
    // Include both old Spanish names and new English names for migration
    const adminNames = [
      "☀️ Pharaoh", "🐍 Vizier",
      "☀️ Faraón", "🐍 Visir",
    ];
    const oldSpanishNames = [
      "⛓️ Esclavo", "🏺 Ciudadano de Egipto", "🔱 Sumo Sacerdote",
    ];
    const allBotRoleNames = [
      ...ranks.map((r) => r.name),
      ...adminNames,
      ...oldSpanishNames,
    ];

    // Deduplicate
    const uniqueNames = [...new Set(allBotRoleNames)];

    const results = [];
    let deleted = 0;

    for (const roleName of uniqueNames) {
      const matching = interaction.guild.roles.cache.filter((r) => r.name === roleName);
      for (const [, role] of matching) {
        try {
          await role.delete("clearroles command");
          deleted++;
          results.push(`🗑️ ${role.name}`);
        } catch (err) {
          results.push(`❌ ${role.name}: ${err.message}`);
        }
      }
    }

    if (!deleted && !results.length) {
      results.push("No bot roles found to delete.");
    }

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle("🗑️ Roles Deleted")
      .setDescription(results.join("\n"))
      .setFooter({ text: `${deleted} roles deleted. Use /setuproles to recreate them.` })
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
  setApiConfig,
  getRankForLevel,
  ROLE_PERMISSIONS,
};
