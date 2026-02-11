const express = require("express");
const session = require("express-session");
const path = require("path");
const { announcements, warnings, settings, verifications } = require("../utils/database");

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
function requireAuth(req, res, next) {
  if (req.session.authenticated) return next();
  return res.status(401).json({ error: "No autenticado" });
}

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

// ─── Settings ───
app.get("/api/settings/:guildId", requireAuth, (req, res) => {
  const welcomeConfig = settings.get(`welcome-${req.params.guildId}`) || {};
  const verifyConfig = settings.get(`verify-${req.params.guildId}`) || {};
  res.json({ welcome: welcomeConfig, verify: verifyConfig });
});

// Serve the dashboard HTML
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

function start(client) {
  botClient = client;
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🌐 Dashboard: http://localhost:${PORT}`);
  });
}

module.exports = { start, app };
