require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes,
} = require("discord.js");
const cron = require("node-cron");
const { announcements } = require("./src/utils/database");

// ─── Validación ───
const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN no encontrado en .env");
  process.exit(1);
}

// ─── Cliente Discord ───
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

client.commands = new Collection();

// ─── Cargar módulos ───
const moderationCommands = require("./src/commands/moderation");
const channelCommands = require("./src/commands/channels");
const announcementCommands = require("./src/commands/announcements");
const verificationCommands = require("./src/commands/verification");
const setupCommands = require("./src/commands/setup");
const generalCommands = require("./src/commands/general");
const ticketCommands = require("./src/commands/tickets");
const egyptCommands = require("./src/commands/egypt-roles");
const welcomeEvents = require("./src/events/welcome");
const verificationEvents = require("./src/events/verification");
const ticketEvents = require("./src/events/tickets");
const claimEvents = require("./src/events/claim");
const automod = require("./src/events/automod");

// ─── Registrar handlers ───
const allHandlers = {
  ...moderationCommands.handlers,
  ...channelCommands.handlers,
  ...announcementCommands.handlers,
  ...verificationCommands.handlers,
  ...setupCommands.handlers,
  ...generalCommands.handlers,
  ...ticketCommands.handlers,
  ...egyptCommands.handlers,
};

// ─── Registrar slash commands al conectar ───
client.once("ready", async () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
  console.log(`📡 En ${client.guilds.cache.size} servidor(es)`);

  // Combinar todos los slash commands
  const allCommands = [
    ...moderationCommands.definitions,
    ...channelCommands.definitions,
    ...announcementCommands.definitions,
    ...verificationCommands.definitions,
    ...setupCommands.definitions,
    ...generalCommands.definitions,
    ...ticketCommands.definitions,
    ...egyptCommands.definitions,
  ].map((c) => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), {
      body: allCommands,
    });
    console.log(`✅ ${allCommands.length} slash commands registrados`);
  } catch (err) {
    console.error("❌ Error registrando comandos:", err);
  }

  client.user.setActivity("🛡️ Moderando | /help");

  // ─── Iniciar anuncios programados ───
  startScheduledAnnouncements();
});

// ─── Manejar interacciones ───
client.on("interactionCreate", async (interaction) => {
  // Slash commands
  if (interaction.isChatInputCommand()) {
    const handler = allHandlers[interaction.commandName];
    if (!handler) return;
    try {
      await handler(interaction, client);
    } catch (error) {
      console.error(`Error en /${interaction.commandName}:`, error);
      const msg = {
        content: "❌ Error al ejecutar este comando.",
        ephemeral: true,
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    }
  }

  // Buttons
  if (interaction.isButton()) {
    if (interaction.customId.startsWith("ticket_")) {
      ticketEvents.handleButton(interaction, client);
    } else if (interaction.customId === "claim_rank" || interaction.customId === "view_my_rank") {
      claimEvents.handleButton(interaction, client);
    } else {
      verificationEvents.handleButton(interaction, client);
    }
  }

  // Select menus
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === "ticket_select") {
      ticketEvents.handleSelectMenu(interaction, client);
    }
  }

  // Modals
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith("ticket_")) {
      ticketEvents.handleModal(interaction, client);
    } else {
      verificationEvents.handleModal(interaction, client);
    }
  }
});

// ─── AutoMod on messages ───
client.on("messageCreate", (message) => {
  automod.handleMessage(message, client);
});

// ─── Eventos ───
client.on("guildMemberAdd", (member) => {
  automod.handleMemberJoin(member, client);
  welcomeEvents.onMemberJoin(member, client);
  verificationEvents.onMemberJoin(member, client);
});

// ─── Anuncios programados con node-cron ───
const activeCrons = new Map();

function startScheduledAnnouncements() {
  const allAnnouncements = announcements.getAll();
  for (const [id, ann] of Object.entries(allAnnouncements)) {
    if (ann.active && ann.cron) {
      scheduleAnnouncement(id, ann);
    }
  }
  console.log(
    `📢 ${Object.keys(allAnnouncements).length} anuncios cargados`
  );
}

function scheduleAnnouncement(id, ann) {
  if (activeCrons.has(id)) {
    activeCrons.get(id).stop();
  }

  if (!cron.validate(ann.cron)) {
    console.error(`❌ Cron inválido para anuncio ${id}: ${ann.cron}`);
    return;
  }

  const task = cron.schedule(ann.cron, async () => {
    try {
      const channel = await client.channels.fetch(ann.channelId);
      if (channel) {
        const { EmbedBuilder } = require("discord.js");
        const embed = new EmbedBuilder()
          .setColor(ann.color || 0x5865f2)
          .setTitle(ann.title || "📢 Anuncio")
          .setDescription(ann.message)
          .setTimestamp();
        await channel.send({
          content: ann.pingRole ? `<@&${ann.pingRole}>` : undefined,
          embeds: [embed],
        });
      }
    } catch (err) {
      console.error(`Error enviando anuncio ${id}:`, err);
    }
  });

  activeCrons.set(id, task);
}

// Exportar para el dashboard
module.exports = { client, scheduleAnnouncement, activeCrons };

// ─── Dashboard ───
const dashboard = require("./src/dashboard/server");
dashboard.start(client);

// ─── Login ───
client.login(TOKEN);
