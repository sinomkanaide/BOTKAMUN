const express = require("express");
const session = require("express-session");
const path = require("path");
const { announcements, warnings, settings, verifications, tickets, ticketConfigs } = require("../utils/database");
const { templates, CHANNEL_TYPES } = require("../commands/setup");
const { ROLE_PERMISSIONS } = require("../commands/egypt-roles");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session para auth
app.use(
  session({
    secret: process.env.DASHBOARD_SECRET || "bot-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 24h
  })
);

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, "public")));

// ─── Discord OAuth2 Config ───
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const AUTHORIZED_USERS = (process.env.AUTHORIZED_DISCORD_USERS || "tapkamun")
  .split(",")
  .map((u) => u.trim().toLowerCase());

function getRedirectUri(req) {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${protocol}://${host}/api/auth/callback`;
}

// Auth middleware
const { requireAuth } = require("./auth-middleware");

// ─── Discord OAuth2 Routes ───
app.get("/api/auth/discord", (req, res) => {
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    return res.status(500).json({ error: "OAuth2 no configurado. Faltan DISCORD_CLIENT_ID o DISCORD_CLIENT_SECRET." });
  }
  const redirectUri = encodeURIComponent(getRedirectUri(req));
  const url = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=identify`;
  res.redirect(url);
});

app.get("/api/auth/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect("/?error=no_code");

  try {
    const redirectUri = getRedirectUri(req);

    // Exchange code for token
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      console.error("OAuth2 token error:", await tokenRes.text());
      return res.redirect("/?error=token_failed");
    }

    const tokenData = await tokenRes.json();

    // Get user info
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      return res.redirect("/?error=user_fetch_failed");
    }

    const user = await userRes.json();
    const username = (user.username || "").toLowerCase();

    // Validate authorized user
    if (!AUTHORIZED_USERS.includes(username)) {
      console.log(`Dashboard login denied for: ${user.username} (${user.id})`);
      return res.redirect("/?error=unauthorized");
    }

    // Authenticated
    req.session.authenticated = true;
    req.session.discordUser = {
      id: user.id,
      username: user.username,
      avatar: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        : null,
    };

    console.log(`Dashboard login: ${user.username} (${user.id})`);
    res.redirect("/");
  } catch (err) {
    console.error("OAuth2 callback error:", err);
    res.redirect("/?error=server_error");
  }
});

// ─── Bot Invite ───
app.get("/api/bot/invite", (req, res) => {
  const clientId = DISCORD_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: "Client ID no configurado" });
  const url = `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot+applications.commands`;
  res.redirect(url);
});

app.post("/api/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get("/api/auth-check", (req, res) => {
  res.json({
    authenticated: !!req.session.authenticated,
    user: req.session.discordUser || null,
  });
});

// ─── Bot Info Routes ───
let botClient = null;

app.get("/api/stats", requireAuth, (req, res) => {
  if (!botClient) return res.json({ error: "Bot no conectado" });

  const guilds = botClient.guilds.cache;
  const totalMembers = guilds.reduce((acc, g) => acc + g.memberCount, 0);
  const totalChannels = guilds.reduce((acc, g) => acc + g.channels.cache.size, 0);

  res.json({
    botName: botClient.user.tag,
    botAvatar: botClient.user.displayAvatarURL({ size: 128 }),
    guilds: guilds.size,
    members: totalMembers,
    channels: totalChannels,
    uptime: process.uptime(),
    ping: botClient.ws.ping,
  });
});

app.get("/api/guilds", requireAuth, (req, res) => {
  if (!botClient) return res.json([]);
  const guilds = botClient.guilds.cache.map((g) => ({
    id: g.id,
    name: g.name,
    icon: g.iconURL({ size: 64 }),
    members: g.memberCount,
    channels: g.channels.cache.size,
  }));
  res.json(guilds);
});

app.get("/api/guilds/:id", requireAuth, (req, res) => {
  if (!botClient) return res.json({ error: "Bot no conectado" });
  const guild = botClient.guilds.cache.get(req.params.id);
  if (!guild) return res.status(404).json({ error: "Servidor no encontrado" });

  res.json({
    id: guild.id,
    name: guild.name,
    icon: guild.iconURL({ size: 128 }),
    members: guild.memberCount,
    channels: guild.channels.cache.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      parent: c.parentId,
    })),
    roles: guild.roles.cache
      .sort((a, b) => b.position - a.position)
      .map((r) => ({
        id: r.id,
        name: r.name,
        color: r.hexColor,
        members: r.members.size,
      })),
  });
});

// ─── Announcements Routes ───
app.get("/api/announcements", requireAuth, (req, res) => {
  res.json(announcements.getAll());
});

app.post("/api/announcements", requireAuth, async (req, res) => {
  const { id, channelId, title, message, cron, color, pingRole, active } = req.body;
  const annId = id || require("crypto").randomUUID().slice(0, 8);

  const ann = {
    channelId,
    title,
    message,
    cron,
    color: color ? parseInt(color.replace("#", ""), 16) : 0x5865f2,
    pingRole: pingRole || null,
    active: active !== false,
    createdAt: new Date().toISOString(),
  };

  announcements.set(annId, ann);

  // Re-schedule
  try {
    const { scheduleAnnouncement } = require("../../index");
    scheduleAnnouncement(annId, ann);
  } catch {}

  res.json({ id: annId, ...ann });
});

app.delete("/api/announcements/:id", requireAuth, (req, res) => {
  announcements.delete(req.params.id);
  try {
    const { activeCrons } = require("../../index");
    if (activeCrons.has(req.params.id)) {
      activeCrons.get(req.params.id).stop();
      activeCrons.delete(req.params.id);
    }
  } catch {}
  res.json({ success: true });
});

// ─── Warnings Routes ───
app.get("/api/warnings", requireAuth, (req, res) => {
  res.json(warnings.getAll());
});

// ─── Send Message from Dashboard ───
app.post("/api/send-message", requireAuth, async (req, res) => {
  const { channelId, content, embed } = req.body;
  try {
    const channel = await botClient.channels.fetch(channelId);
    if (!channel) return res.status(404).json({ error: "Canal no encontrado" });

    const msgOptions = {};
    if (content) msgOptions.content = content;
    if (embed) {
      const { EmbedBuilder } = require("discord.js");
      const e = new EmbedBuilder()
        .setTitle(embed.title || undefined)
        .setDescription(embed.description || undefined)
        .setColor(embed.color ? parseInt(embed.color.replace("#", ""), 16) : 0x5865f2);
      if (embed.footer) e.setFooter({ text: embed.footer });
      e.setTimestamp();
      msgOptions.embeds = [e];
    }

    await channel.send(msgOptions);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Setup Wizard ───
app.get("/api/setup-templates", requireAuth, (req, res) => {
  const summary = {};
  for (const [key, tpl] of Object.entries(templates)) {
    const totalChannels = tpl.categories.reduce((acc, cat) => acc + cat.channels.length, 0);
    summary[key] = {
      name: tpl.name,
      categories: tpl.categories.map((cat) => ({
        name: cat.name,
        channels: cat.channels,
      })),
      roles: tpl.roles,
      totalChannels,
      totalCategories: tpl.categories.length,
      totalRoles: tpl.roles.length,
    };
  }
  res.json(summary);
});

app.post("/api/setup-server", requireAuth, async (req, res) => {
  if (!botClient) return res.status(500).json({ error: "Bot no conectado" });

  const { guildId, templateKey, deleteExisting, categories, roles, enableVerification, verifyType } = req.body;

  const guild = botClient.guilds.cache.get(guildId);
  if (!guild) return res.status(404).json({ error: "Servidor no encontrado" });

  // SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  try {
    const { ChannelType: CT, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

    // 1. Delete existing channels if requested
    if (deleteExisting) {
      send("progress", { message: "Deleting existing channels..." });
      const channels = guild.channels.cache.filter((c) => c.type !== CT.GuildCategory || true);
      let deleted = 0;
      for (const [, ch] of channels) {
        try {
          await ch.delete();
          deleted++;
        } catch {}
      }
      send("progress", { message: `${deleted} channels deleted` });
    }

    // 2. Create roles
    send("progress", { message: "Creating roles..." });
    const createdRoles = {};
    const rolesToCreate = roles || templates[templateKey]?.roles || [];
    for (const roleData of rolesToCreate) {
      if (!roleData.enabled && roleData.enabled !== undefined) continue;
      const existing = guild.roles.cache.find((r) => r.name === roleData.name);
      if (existing) {
        createdRoles[roleData.name] = existing;
        send("progress", { message: `Role "${roleData.name}" already exists` });
      } else {
        const perms = ROLE_PERMISSIONS[roleData.name] || [];
        const role = await guild.roles.create({
          name: roleData.name,
          color: typeof roleData.color === "string" ? parseInt(roleData.color.replace("#", ""), 16) : roleData.color,
          hoist: roleData.hoist || false,
          permissions: perms,
        });
        createdRoles[roleData.name] = role;
        send("progress", { message: `Role "${roleData.name}" created` });
      }
    }

    // 3. Identify key roles for channel permissions
    const slaveRole = Object.entries(createdRoles).find(([n]) => n.includes("Slave"))?.[1];
    const citizenRole = Object.entries(createdRoles).find(([n]) => n.includes("Citizen"))?.[1];
    const staffRoleNames = ["Pharaoh", "Vizier", "High Priest"];
    const staffRoles = Object.entries(createdRoles)
      .filter(([n]) => staffRoleNames.some((s) => n.includes(s)))
      .map(([, r]) => r);

    // 4. Create categories and channels
    send("progress", { message: "Creating channel structure..." });
    const categoriesToCreate = categories || templates[templateKey]?.categories || [];
    let verifyChannelId = null;
    let verifyRoleId = null;

    for (const cat of categoriesToCreate) {
      if (!cat.enabled && cat.enabled !== undefined) continue;
      const category = await guild.channels.create({
        name: cat.name,
        type: CT.GuildCategory,
      });
      send("progress", { message: `Category: ${cat.name}` });

      for (const ch of cat.channels) {
        if (!ch.enabled && ch.enabled !== undefined) continue;
        let chType = CHANNEL_TYPES[ch.type] || CT.GuildText;
        // Announcement channels require COMMUNITY feature
        if (chType === CT.GuildAnnouncement && !guild.features.includes("COMMUNITY")) {
          chType = CT.GuildText;
        }
        const options = {
          name: ch.name,
          type: chType,
          parent: category.id,
          topic: ch.topic || undefined,
        };

        const channel = await guild.channels.create(options);

        const isVerifyChannel = ch.name.includes("verification") || ch.name.includes("access");

        // Apply permission overwrites
        // @everyone: deny ViewChannel on all channels
        await channel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false });

        if (ch.staffOnly) {
          // Staff-only channels: only Pharaoh/Vizier/High Priest
          for (const staffRole of staffRoles) {
            await channel.permissionOverwrites.edit(staffRole, { ViewChannel: true });
          }
        } else if (isVerifyChannel) {
          // Verification channel: Slave can see, Citizen cannot, Staff can see
          if (slaveRole) {
            await channel.permissionOverwrites.edit(slaveRole, {
              ViewChannel: true,
              ReadMessageHistory: true,
              SendMessages: true,
            });
          }
          if (citizenRole) {
            await channel.permissionOverwrites.edit(citizenRole, { ViewChannel: false });
          }
          for (const staffRole of staffRoles) {
            await channel.permissionOverwrites.edit(staffRole, { ViewChannel: true });
          }
        } else {
          // Normal channels: Citizen can see, Staff can see
          if (citizenRole) {
            await channel.permissionOverwrites.edit(citizenRole, {
              ViewChannel: true,
              SendMessages: true,
              ReadMessageHistory: true,
              AttachFiles: true,
            });
          }
          for (const staffRole of staffRoles) {
            await channel.permissionOverwrites.edit(staffRole, { ViewChannel: true });
          }
        }

        // Track verification channel
        if (isVerifyChannel) {
          verifyChannelId = channel.id;
        }

        send("progress", { message: `  #${ch.name}` });
      }
    }

    // 4. Post rules embed
    const rulesChannel = guild.channels.cache.find(
      (c) => (c.name.includes("rules") || c.name.includes("reglas")) && c.type === CT.GuildText
    );
    if (rulesChannel) {
      const rulesEmbed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("Server Rules")
        .setDescription(
          "**1.** Be respectful to all members\n" +
          "**2.** No spam or flooding\n" +
          "**3.** No NSFW content outside designated channels\n" +
          "**4.** No advertising without permission\n" +
          "**5.** Follow staff instructions\n" +
          "**6.** Use the appropriate channels for each topic\n" +
          "**7.** Do not share other people's personal information\n" +
          "**8.** Have fun and be part of the community\n\n" +
          "_Violations may result in warnings, mute or ban._"
        )
        .setFooter({ text: "Last updated" })
        .setTimestamp();
      await rulesChannel.send({ embeds: [rulesEmbed] });
      send("progress", { message: "Rules posted" });
    }

    // 5. Setup verification if enabled
    if (enableVerification && verifyChannelId) {
      // Find or use the "Verificado"/"Miembro" role
      const verifyRole = Object.entries(createdRoles).find(
        ([name]) => name.includes("Citizen") || name.includes("Verified") || name.includes("Member")
      );
      if (verifyRole) {
        verifyRoleId = verifyRole[1].id;
      }

      if (verifyRoleId) {
        const vType = verifyType || "puzzle";
        settings.set(`verify-${guildId}`, {
          channelId: verifyChannelId,
          roleId: verifyRoleId,
          type: vType,
          guildId,
        });

        const typeNames = {
          puzzle: "Solve a riddle",
          colors: "Color sequence",
          math: "Math problem",
          question: "Personal question",
        };

        const verifyChannel = await guild.channels.fetch(verifyChannelId);
        if (verifyChannel) {
          const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle("Verification Required")
            .setDescription(
              `Welcome to the server! To access all channels, you need to verify.\n\n` +
              `**Challenge type:** ${typeNames[vType]}\n\n` +
              `Click the button below to start your verification.`
            )
            .setFooter({ text: "Creative verification system" })
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("verify_start")
              .setLabel("Verify Me")
              .setStyle(ButtonStyle.Primary)
          );

          await verifyChannel.send({ embeds: [embed], components: [row] });
          send("progress", { message: `Verification configured (${typeNames[vType]})` });
        }
      }
    }

    send("complete", { message: `Server configured with template "${templates[templateKey]?.name || templateKey}"` });
  } catch (err) {
    console.error("Error en setup-server:", err);
    send("error", { message: err.message });
  }

  res.end();
});

// ─── Tickets ───
app.get("/api/tickets/config/:guildId", requireAuth, (req, res) => {
  const config = ticketConfigs.get(`guild-${req.params.guildId}`);
  res.json(config || { guildId: req.params.guildId, panelChannelId: null, panelMessageId: null, ticketCounter: 0, types: [] });
});

app.post("/api/tickets/config/:guildId", requireAuth, (req, res) => {
  const configKey = `guild-${req.params.guildId}`;
  const existing = ticketConfigs.get(configKey) || {
    guildId: req.params.guildId,
    panelChannelId: null,
    panelMessageId: null,
    ticketCounter: 0,
    types: [],
  };

  if (req.body.panelChannelId !== undefined) existing.panelChannelId = req.body.panelChannelId;
  if (req.body.types !== undefined) existing.types = req.body.types;

  ticketConfigs.set(configKey, existing);
  res.json(existing);
});

app.post("/api/tickets/deploy/:guildId", requireAuth, async (req, res) => {
  if (!botClient) return res.status(500).json({ error: "Bot not connected" });

  const configKey = `guild-${req.params.guildId}`;
  const config = ticketConfigs.get(configKey);
  if (!config || !config.types.length) return res.status(400).json({ error: "No ticket types configured" });
  if (!config.panelChannelId) return res.status(400).json({ error: "No panel channel configured" });

  try {
    const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ChannelType } = require("discord.js");

    const guild = botClient.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

    const channel = await guild.channels.fetch(config.panelChannelId);
    if (!channel) return res.status(404).json({ error: "Panel channel not found" });

    // Auto-create categories for each ticket type
    for (const type of config.types) {
      let category = type.categoryId
        ? guild.channels.cache.get(type.categoryId)
        : null;
      if (!category) {
        category = guild.channels.cache.find(
          (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === type.name.toLowerCase()
        );
      }
      if (!category) {
        category = await guild.channels.create({
          name: type.name,
          type: ChannelType.GuildCategory,
        });
      }
      type.categoryId = category.id;
    }
    ticketConfigs.set(configKey, config);

    const typesDescription = config.types
      .map((t) => `${t.emoji} **${t.name}** — ${t.description}`)
      .join("\n");

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("Support Tickets")
      .setDescription(`Need help? Select a ticket type from the menu below.\n\n${typesDescription}`)
      .setFooter({ text: "Select from the dropdown to open a ticket" })
      .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("ticket_select")
      .setPlaceholder("Select a ticket type...")
      .addOptions(
        config.types.map((t) => ({
          label: t.name,
          description: t.description,
          emoji: t.emoji,
          value: t.id,
        }))
      );

    const rows = [new ActionRowBuilder().addComponents(selectMenu)];

    if (config.panelMessageId) {
      try {
        const msg = await channel.messages.fetch(config.panelMessageId);
        await msg.edit({ embeds: [embed], components: rows });
        return res.json({ success: true, action: "updated" });
      } catch {}
    }

    const msg = await channel.send({ embeds: [embed], components: rows });
    config.panelMessageId = msg.id;
    ticketConfigs.set(configKey, config);

    res.json({ success: true, action: "created" });
  } catch (err) {
    console.error("Error deploying ticket panel from dashboard:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/tickets/list/:guildId", requireAuth, (req, res) => {
  const all = tickets.getAll();
  const guildTickets = {};
  for (const [key, ticket] of Object.entries(all)) {
    if (ticket.guildId === req.params.guildId) guildTickets[key] = ticket;
  }
  res.json(guildTickets);
});

app.delete("/api/tickets/type/:guildId/:typeId", requireAuth, (req, res) => {
  const configKey = `guild-${req.params.guildId}`;
  const config = ticketConfigs.get(configKey);
  if (!config) return res.status(404).json({ error: "Config not found" });

  config.types = config.types.filter((t) => t.id !== req.params.typeId);
  ticketConfigs.set(configKey, config);
  res.json({ success: true });
});

// ─── Settings ───
app.get("/api/settings/:guildId", requireAuth, (req, res) => {
  const welcomeConfig = settings.get(`welcome-${req.params.guildId}`) || {};
  const verifyConfig = settings.get(`verify-${req.params.guildId}`) || {};
  res.json({ welcome: welcomeConfig, verify: verifyConfig });
});

// Serve the dashboard HTML
app.get("{*splat}", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

function start(client) {
  botClient = client;

  const { registerClaimRoutes } = require("./claim-routes");
  registerClaimRoutes(app, () => botClient);

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🌐 Dashboard: http://localhost:${PORT}`);
  });
}

module.exports = { start, app };
