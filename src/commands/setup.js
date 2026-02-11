const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} = require("discord.js");

// Plantillas de servidor predefinidas
const templates = {
  gaming: {
    name: "🎮 Comunidad Gaming",
    categories: [
      {
        name: "📋 INFORMACIÓN",
        channels: [
          { name: "📜reglas", type: "text", topic: "Lee las reglas del servidor antes de participar" },
          { name: "📢anuncios", type: "announcement", topic: "Anuncios importantes del servidor" },
          { name: "🔐verificación", type: "text", topic: "Verifícate para acceder al servidor" },
          { name: "👋presentaciones", type: "text", topic: "Preséntate a la comunidad" },
        ],
      },
      {
        name: "💬 GENERAL",
        channels: [
          { name: "💬chat-general", type: "text", topic: "Conversación general — respeta a los demás" },
          { name: "🤖bot-commands", type: "text", topic: "Usa los comandos del bot aquí" },
          { name: "🎵música", type: "text", topic: "Comparte música y recomendaciones" },
          { name: "📸multimedia", type: "text", topic: "Comparte imágenes, videos y memes" },
        ],
      },
      {
        name: "🎮 GAMING",
        channels: [
          { name: "🎮buscar-equipo", type: "text", topic: "Encuentra compañeros para jugar" },
          { name: "🏆torneos", type: "text", topic: "Información sobre torneos y competencias" },
          { name: "💡clips-y-highlights", type: "text", topic: "Comparte tus mejores jugadas" },
          { name: "📊estadísticas", type: "text", topic: "Compara y comparte tus stats" },
        ],
      },
      {
        name: "🔊 VOZ",
        channels: [
          { name: "🎙️General 1", type: "voice" },
          { name: "🎙️General 2", type: "voice" },
          { name: "🎮Gaming 1", type: "voice" },
          { name: "🎮Gaming 2", type: "voice" },
          { name: "🎵Música", type: "voice" },
          { name: "🔇AFK", type: "voice" },
        ],
      },
      {
        name: "🛡️ STAFF",
        channels: [
          { name: "👮staff-chat", type: "text", topic: "Chat privado del equipo de moderación", staffOnly: true },
          { name: "📝logs", type: "text", topic: "Registro de acciones de moderación", staffOnly: true },
          { name: "📊estadísticas-mod", type: "text", topic: "Estadísticas de moderación", staffOnly: true },
        ],
      },
    ],
    roles: [
      { name: "👑 Owner", color: 0xf1c40f, hoist: true },
      { name: "🛡️ Admin", color: 0xe74c3c, hoist: true },
      { name: "🔧 Moderador", color: 0xe67e22, hoist: true },
      { name: "✅ Verificado", color: 0x2ecc71 },
      { name: "🎮 Gamer", color: 0x9b59b6 },
      { name: "🆕 Nuevo", color: 0x95a5a6 },
    ],
  },

  community: {
    name: "🌍 Comunidad General",
    categories: [
      {
        name: "📋 BIENVENIDA",
        channels: [
          { name: "📜reglas", type: "text", topic: "Reglas de convivencia de la comunidad" },
          { name: "📢anuncios", type: "announcement", topic: "Noticias y anuncios oficiales" },
          { name: "🔐verificación", type: "text", topic: "Verifícate aquí" },
          { name: "🎭roles", type: "text", topic: "Elige tus roles" },
        ],
      },
      {
        name: "💬 CONVERSACIÓN",
        channels: [
          { name: "💬general", type: "text", topic: "Chat libre sobre cualquier tema" },
          { name: "🤝ayuda", type: "text", topic: "Pide y ofrece ayuda" },
          { name: "💡ideas", type: "text", topic: "Comparte tus ideas y sugerencias" },
          { name: "📸fotos-y-videos", type: "text", topic: "Comparte contenido multimedia" },
        ],
      },
      {
        name: "🎨 CREATIVIDAD",
        channels: [
          { name: "🎨arte", type: "text", topic: "Comparte tu arte y creaciones" },
          { name: "✍️escritura", type: "text", topic: "Textos, poesía y relatos" },
          { name: "🎵música", type: "text", topic: "Descubrimientos musicales" },
          { name: "📚recomendaciones", type: "text", topic: "Libros, películas, series y más" },
        ],
      },
      {
        name: "🔊 VOZ",
        channels: [
          { name: "☕ Chill", type: "voice" },
          { name: "💬 Chat 1", type: "voice" },
          { name: "💬 Chat 2", type: "voice" },
          { name: "🎵 Música", type: "voice" },
        ],
      },
      {
        name: "🛡️ ADMINISTRACIÓN",
        channels: [
          { name: "👮staff", type: "text", topic: "Canal privado de staff", staffOnly: true },
          { name: "📝logs", type: "text", topic: "Registros", staffOnly: true },
        ],
      },
    ],
    roles: [
      { name: "👑 Fundador", color: 0xf1c40f, hoist: true },
      { name: "🛡️ Admin", color: 0xe74c3c, hoist: true },
      { name: "🔧 Mod", color: 0xe67e22, hoist: true },
      { name: "⭐ VIP", color: 0x3498db, hoist: true },
      { name: "✅ Miembro", color: 0x2ecc71 },
      { name: "🆕 Sin verificar", color: 0x95a5a6 },
    ],
  },

  business: {
    name: "💼 Empresa / Equipo",
    categories: [
      {
        name: "📋 GENERAL",
        channels: [
          { name: "📢anuncios", type: "announcement", topic: "Comunicados oficiales" },
          { name: "📜guías", type: "text", topic: "Guías y documentación" },
          { name: "🔐acceso", type: "text", topic: "Verificación de acceso" },
        ],
      },
      {
        name: "💬 EQUIPO",
        channels: [
          { name: "💬general", type: "text", topic: "Conversación del equipo" },
          { name: "🎯objetivos", type: "text", topic: "Metas y seguimiento" },
          { name: "💡brainstorming", type: "text", topic: "Ideas y propuestas" },
          { name: "📊reportes", type: "text", topic: "Reportes semanales" },
        ],
      },
      {
        name: "🔧 PROYECTOS",
        channels: [
          { name: "📌proyecto-1", type: "text", topic: "Canal del proyecto principal" },
          { name: "📌proyecto-2", type: "text", topic: "Canal del proyecto secundario" },
          { name: "🐛bugs", type: "text", topic: "Reportar bugs y problemas" },
          { name: "✅completados", type: "text", topic: "Proyectos finalizados" },
        ],
      },
      {
        name: "🔊 REUNIONES",
        channels: [
          { name: "📞 Daily Standup", type: "voice" },
          { name: "🤝 Reunión General", type: "voice" },
          { name: "💼 1-on-1", type: "voice" },
        ],
      },
      {
        name: "🔒 DIRECCIÓN",
        channels: [
          { name: "🔒dirección", type: "text", topic: "Canal de dirección", staffOnly: true },
          { name: "📝minutas", type: "text", topic: "Actas de reuniones", staffOnly: true },
        ],
      },
    ],
    roles: [
      { name: "👔 Director", color: 0xf1c40f, hoist: true },
      { name: "📋 Manager", color: 0xe74c3c, hoist: true },
      { name: "💻 Developer", color: 0x3498db, hoist: true },
      { name: "🎨 Designer", color: 0x9b59b6, hoist: true },
      { name: "✅ Miembro", color: 0x2ecc71 },
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
          { name: "🌍 Comunidad General", value: "community" },
          { name: "💼 Empresa / Equipo", value: "business" }
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
          const options = {
            name: ch.name,
            type: CHANNEL_TYPES[ch.type] || ChannelType.GuildText,
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
              if (name.includes("Admin") || name.includes("Mod") || name.includes("Director") || name.includes("Owner") || name.includes("Fundador") || name.includes("Manager")) {
                await channel.permissionOverwrites.edit(role, { ViewChannel: true });
              }
            }
          }

          addStatus(`      ${ch.type === "voice" ? "🔊" : "💬"} #${ch.name}`);
        }
      }

      // 4. Enviar reglas en el canal de reglas
      const rulesChannel = interaction.guild.channels.cache.find(
        (c) => c.name.includes("reglas") && c.type === ChannelType.GuildText
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

module.exports = { definitions, handlers };
