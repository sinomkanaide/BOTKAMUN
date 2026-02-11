const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} = require("discord.js");

// Server templates
const templates = {
  gaming: {
    name: "🎮 Gaming Community",
    categories: [
      {
        name: "📋 INFORMATION",
        channels: [
          { name: "📜rules", type: "text", topic: "Read the server rules before participating" },
          { name: "📢announcements", type: "announcement", topic: "Important server announcements" },
          { name: "🔐verification", type: "text", topic: "Verify to access the server" },
          { name: "👋introductions", type: "text", topic: "Introduce yourself to the community" },
        ],
      },
      {
        name: "💬 GENERAL",
        channels: [
          { name: "💬general-chat", type: "text", topic: "General conversation — be respectful" },
          { name: "🤖bot-commands", type: "text", topic: "Use bot commands here" },
          { name: "🎵music", type: "text", topic: "Share music and recommendations" },
          { name: "📸media", type: "text", topic: "Share images, videos and memes" },
        ],
      },
      {
        name: "🎮 GAMING",
        channels: [
          { name: "🎮looking-for-group", type: "text", topic: "Find teammates to play with" },
          { name: "🏆tournaments", type: "text", topic: "Tournament info and competitions" },
          { name: "💡clips-and-highlights", type: "text", topic: "Share your best plays" },
          { name: "📊stats", type: "text", topic: "Compare and share your stats" },
        ],
      },
      {
        name: "🔊 VOICE",
        channels: [
          { name: "🎙️General 1", type: "voice" },
          { name: "🎙️General 2", type: "voice" },
          { name: "🎮Gaming 1", type: "voice" },
          { name: "🎮Gaming 2", type: "voice" },
          { name: "🎵Music", type: "voice" },
          { name: "🔇AFK", type: "voice" },
        ],
      },
      {
        name: "🛡️ STAFF",
        channels: [
          { name: "👮staff-chat", type: "text", topic: "Private staff chat", staffOnly: true },
          { name: "📝logs", type: "text", topic: "Moderation action logs", staffOnly: true },
          { name: "📊mod-stats", type: "text", topic: "Moderation statistics", staffOnly: true },
        ],
      },
    ],
    roles: [
      { name: "☀️ Faraón", color: 0xffd700, hoist: true },
      { name: "🐍 Visir", color: 0xe74c3c, hoist: true },
      { name: "🔱 Sumo Sacerdote", color: 0xf1c40f, hoist: true },
      { name: "📜 Scribe", color: 0x9b59b6, hoist: true },
      { name: "🏛️ Official", color: 0x4a90d9, hoist: true },
      { name: "⚒️ Craftsman", color: 0xcd7f32, hoist: true },
      { name: "🏺 Ciudadano de Egipto", color: 0xc8a96e },
      { name: "⛓️ Esclavo", color: 0x6d6d6d },
    ],
  },

  community: {
    name: "🌍 General Community",
    categories: [
      {
        name: "📋 WELCOME",
        channels: [
          { name: "📜rules", type: "text", topic: "Community rules and guidelines" },
          { name: "📢announcements", type: "announcement", topic: "Official news and announcements" },
          { name: "🔐verification", type: "text", topic: "Verify yourself here" },
          { name: "🎭roles", type: "text", topic: "Pick your roles" },
        ],
      },
      {
        name: "💬 CHAT",
        channels: [
          { name: "💬general", type: "text", topic: "Free chat about anything" },
          { name: "🤝help", type: "text", topic: "Ask and offer help" },
          { name: "💡ideas", type: "text", topic: "Share your ideas and suggestions" },
          { name: "📸photos-and-videos", type: "text", topic: "Share multimedia content" },
        ],
      },
      {
        name: "🎨 CREATIVITY",
        channels: [
          { name: "🎨art", type: "text", topic: "Share your art and creations" },
          { name: "✍️writing", type: "text", topic: "Stories, poetry and creative writing" },
          { name: "🎵music", type: "text", topic: "Music discoveries and recommendations" },
          { name: "📚recommendations", type: "text", topic: "Books, movies, shows and more" },
        ],
      },
      {
        name: "🔊 VOICE",
        channels: [
          { name: "☕ Chill", type: "voice" },
          { name: "💬 Chat 1", type: "voice" },
          { name: "💬 Chat 2", type: "voice" },
          { name: "🎵 Music", type: "voice" },
        ],
      },
      {
        name: "🛡️ ADMIN",
        channels: [
          { name: "👮staff", type: "text", topic: "Private staff channel", staffOnly: true },
          { name: "📝logs", type: "text", topic: "Logs", staffOnly: true },
        ],
      },
    ],
    roles: [
      { name: "☀️ Faraón", color: 0xffd700, hoist: true },
      { name: "🐍 Visir", color: 0xe74c3c, hoist: true },
      { name: "🔱 Sumo Sacerdote", color: 0xf1c40f, hoist: true },
      { name: "📜 Scribe", color: 0x9b59b6, hoist: true },
      { name: "🏛️ Official", color: 0x4a90d9, hoist: true },
      { name: "⚒️ Craftsman", color: 0xcd7f32, hoist: true },
      { name: "🏺 Ciudadano de Egipto", color: 0xc8a96e },
      { name: "⛓️ Esclavo", color: 0x6d6d6d },
    ],
  },

  business: {
    name: "💼 Business / Team",
    categories: [
      {
        name: "📋 GENERAL",
        channels: [
          { name: "📢announcements", type: "announcement", topic: "Official communications" },
          { name: "📜guidelines", type: "text", topic: "Guides and documentation" },
          { name: "🔐access", type: "text", topic: "Access verification" },
        ],
      },
      {
        name: "💬 TEAM",
        channels: [
          { name: "💬general", type: "text", topic: "Team conversation" },
          { name: "🎯goals", type: "text", topic: "Goals and tracking" },
          { name: "💡brainstorming", type: "text", topic: "Ideas and proposals" },
          { name: "📊reports", type: "text", topic: "Weekly reports" },
        ],
      },
      {
        name: "🔧 PROJECTS",
        channels: [
          { name: "📌project-1", type: "text", topic: "Main project channel" },
          { name: "📌project-2", type: "text", topic: "Secondary project channel" },
          { name: "🐛bugs", type: "text", topic: "Report bugs and issues" },
          { name: "✅completed", type: "text", topic: "Completed projects" },
        ],
      },
      {
        name: "🔊 MEETINGS",
        channels: [
          { name: "📞 Daily Standup", type: "voice" },
          { name: "🤝 General Meeting", type: "voice" },
          { name: "💼 1-on-1", type: "voice" },
        ],
      },
      {
        name: "🔒 LEADERSHIP",
        channels: [
          { name: "🔒leadership", type: "text", topic: "Leadership channel", staffOnly: true },
          { name: "📝meeting-notes", type: "text", topic: "Meeting minutes", staffOnly: true },
        ],
      },
    ],
    roles: [
      { name: "☀️ Faraón", color: 0xffd700, hoist: true },
      { name: "🐍 Visir", color: 0xe74c3c, hoist: true },
      { name: "🔱 Sumo Sacerdote", color: 0xf1c40f, hoist: true },
      { name: "📜 Scribe", color: 0x9b59b6, hoist: true },
      { name: "🏛️ Official", color: 0x4a90d9, hoist: true },
      { name: "⚒️ Craftsman", color: 0xcd7f32, hoist: true },
      { name: "🏺 Ciudadano de Egipto", color: 0xc8a96e },
      { name: "⛓️ Esclavo", color: 0x6d6d6d },
    ],
  },

  web3: {
    name: "🌐 Web3 / NFT Community",
    categories: [
      {
        name: "📋 START HERE",
        channels: [
          { name: "📜rules", type: "text", topic: "Read the rules before interacting" },
          { name: "📢announcements", type: "announcement", topic: "Official project announcements and updates" },
          { name: "🔐verification", type: "text", topic: "Verify your wallet to access the server" },
          { name: "👋introductions", type: "text", topic: "Introduce yourself — what chain are you on?" },
          { name: "📚faq", type: "text", topic: "Frequently asked questions" },
        ],
      },
      {
        name: "💬 COMMUNITY",
        channels: [
          { name: "💬general-chat", type: "text", topic: "General discussion — keep it respectful" },
          { name: "🖼️show-your-nfts", type: "text", topic: "Flex your collection and latest mints" },
          { name: "📈alpha-calls", type: "text", topic: "Share alpha and early opportunities" },
          { name: "🤖bot-commands", type: "text", topic: "Use bot commands here" },
          { name: "📸memes", type: "text", topic: "Web3 memes and shitposts" },
        ],
      },
      {
        name: "🔗 WEB3 HUB",
        channels: [
          { name: "🪙token-talk", type: "text", topic: "Discuss tokenomics, charts and price action" },
          { name: "🖼️nft-drops", type: "text", topic: "Upcoming mints, drops and free mints" },
          { name: "🔗dapp-showcase", type: "text", topic: "Share and discuss dApps and protocols" },
          { name: "⛓️on-chain-analysis", type: "text", topic: "Whale watching, wallet tracking and analytics" },
          { name: "🛡️security-alerts", type: "text", topic: "Scam alerts, rug reports and security tips" },
          { name: "📊defi-strategies", type: "text", topic: "Yield farming, staking and DeFi plays" },
        ],
      },
      {
        name: "🛠️ BUILDERS",
        channels: [
          { name: "💻dev-chat", type: "text", topic: "Solidity, Rust, smart contracts and Web3 dev" },
          { name: "🐛bug-bounties", type: "text", topic: "Bug bounty programs and findings" },
          { name: "📝proposals", type: "text", topic: "DAO proposals and governance discussions" },
          { name: "🤝collabs", type: "text", topic: "Find collaborators for your Web3 project" },
        ],
      },
      {
        name: "🔊 VOICE",
        channels: [
          { name: "🎙️ Lounge", type: "voice" },
          { name: "📡 AMA Stage", type: "voice" },
          { name: "💰 Trading Room", type: "voice" },
          { name: "🛠️ Builder Space", type: "voice" },
          { name: "🔇 AFK", type: "voice" },
        ],
      },
      {
        name: "🔒 CORE TEAM",
        channels: [
          { name: "🔒core-team", type: "text", topic: "Private core team discussion", staffOnly: true },
          { name: "📝mod-logs", type: "text", topic: "Moderation and admin logs", staffOnly: true },
          { name: "📊treasury", type: "text", topic: "Treasury management and multisig ops", staffOnly: true },
        ],
      },
    ],
    roles: [
      { name: "☀️ Faraón", color: 0xffd700, hoist: true },
      { name: "🐍 Visir", color: 0xe74c3c, hoist: true },
      { name: "🔱 Sumo Sacerdote", color: 0xf1c40f, hoist: true },
      { name: "📜 Scribe", color: 0x9b59b6, hoist: true },
      { name: "🏛️ Official", color: 0x4a90d9, hoist: true },
      { name: "⚒️ Craftsman", color: 0xcd7f32, hoist: true },
      { name: "🏺 Ciudadano de Egipto", color: 0xc8a96e },
      { name: "⛓️ Esclavo", color: 0x6d6d6d },
    ],
  },
};

const definitions = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Crea la estructura completa del servidor (canales, roles, categorías)")
    .addStringOption((o) =>
      o.setName("plantilla").setDescription("Plantilla de servidor").setRequired(true)
        .addChoices(
          { name: "🎮 Gaming", value: "gaming" },
          { name: "🌍 Community", value: "community" },
          { name: "💼 Business", value: "business" },
          { name: "🌐 Web3 / NFT", value: "web3" }
        )
    )
    .addBooleanOption((o) =>
      o.setName("borrar_existentes").setDescription("¿Borrar canales existentes? (⚠️ irreversible)").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
];

const CHANNEL_TYPES = {
  text: ChannelType.GuildText,
  voice: ChannelType.GuildVoice,
  announcement: ChannelType.GuildAnnouncement,
  forum: ChannelType.GuildForum,
};

const handlers = {
  async setup(interaction) {
    const templateKey = interaction.options.getString("plantilla");
    const deleteExisting = interaction.options.getBoolean("borrar_existentes");
    const template = templates[templateKey];

    await interaction.deferReply({ ephemeral: true });

    const statusLines = [];
    const addStatus = (msg) => statusLines.push(msg);

    try {
      // 1. Borrar canales existentes si se pidió
      if (deleteExisting) {
        addStatus("🗑️ Eliminando canales existentes...");
        const channels = interaction.guild.channels.cache.filter(
          (c) => c.id !== interaction.channel.id
        );
        for (const [, ch] of channels) {
          try { await ch.delete(); } catch {}
        }
        addStatus(`   ✅ Eliminados ${channels.size} canales`);
      }

      // 2. Crear roles
      addStatus("\n🎭 Creando roles...");
      const createdRoles = {};
      for (const roleData of template.roles) {
        const existing = interaction.guild.roles.cache.find((r) => r.name === roleData.name);
        if (existing) {
          createdRoles[roleData.name] = existing;
          addStatus(`   ⏭️ Rol "${roleData.name}" ya existe`);
        } else {
          const role = await interaction.guild.roles.create({
            name: roleData.name,
            color: roleData.color,
            hoist: roleData.hoist || false,
          });
          createdRoles[roleData.name] = role;
          addStatus(`   ✅ Rol "${roleData.name}" creado`);
        }
      }

      // 3. Crear categorías y canales
      addStatus("\n📁 Creando estructura de canales...");
      for (const cat of template.categories) {
        const category = await interaction.guild.channels.create({
          name: cat.name,
          type: ChannelType.GuildCategory,
        });
        addStatus(`   📁 Categoría: ${cat.name}`);

        for (const ch of cat.channels) {
          let chType = CHANNEL_TYPES[ch.type] || ChannelType.GuildText;
          // Announcement channels require COMMUNITY feature
          if (chType === ChannelType.GuildAnnouncement && !interaction.guild.features.includes("COMMUNITY")) {
            chType = ChannelType.GuildText;
          }
          const options = {
            name: ch.name,
            type: chType,
            parent: category.id,
            topic: ch.topic || undefined,
          };

          const channel = await interaction.guild.channels.create(options);

          // Si es staff only, restringir acceso
          if (ch.staffOnly) {
            await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
              ViewChannel: false,
            });
            // Dar acceso a roles de admin/mod
            for (const [name, role] of Object.entries(createdRoles)) {
              if (name.includes("Faraón") || name.includes("Visir") || name.includes("Admin") || name.includes("Mod")) {
                await channel.permissionOverwrites.edit(role, { ViewChannel: true });
              }
            }
          }

          addStatus(`      ${ch.type === "voice" ? "🔊" : "💬"} #${ch.name}`);
        }
      }

      // 4. Enviar reglas en el canal de reglas
      const rulesChannel = interaction.guild.channels.cache.find(
        (c) => (c.name.includes("rules") || c.name.includes("reglas")) && c.type === ChannelType.GuildText
      );
      if (rulesChannel) {
        const rulesEmbed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("📜 Reglas del Servidor")
          .setDescription(
            "**1.** Sé respetuoso con todos los miembros\n" +
            "**2.** No spam ni flood\n" +
            "**3.** No contenido NSFW fuera de canales designados\n" +
            "**4.** No publicidad sin permiso\n" +
            "**5.** Sigue las instrucciones del staff\n" +
            "**6.** Usa los canales apropiados para cada tema\n" +
            "**7.** No compartas información personal de otros\n" +
            "**8.** Diviértete y sé parte de la comunidad 🎉\n\n" +
            "_El incumplimiento puede resultar en advertencias, mute o ban._"
          )
          .setFooter({ text: "Última actualización" })
          .setTimestamp();
        await rulesChannel.send({ embeds: [rulesEmbed] });
        addStatus("\n📜 Reglas publicadas");
      }

      addStatus(`\n✅ ¡Servidor configurado con la plantilla **${template.name}**!`);

      const resultEmbed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("🏗️ Setup Completado")
        .setDescription(statusLines.join("\n"))
        .setTimestamp();

      await interaction.editReply({ embeds: [resultEmbed] });
    } catch (error) {
      console.error("Error en setup:", error);
      await interaction.editReply({
        content: `❌ Error durante el setup: ${error.message}\n\nProgreso:\n${statusLines.join("\n")}`,
      });
    }
  },
};

module.exports = { definitions, handlers, templates, CHANNEL_TYPES };
