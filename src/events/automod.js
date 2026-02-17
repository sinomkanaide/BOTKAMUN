const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { settings, warnings } = require("../utils/database");

// ─── In-memory trackers (reset on restart, that's fine) ───
const messageTracker = new Map(); // guildId-userId → [timestamps]
const duplicateTracker = new Map(); // guildId-userId → [messageContents]
const joinTracker = new Map(); // guildId → [timestamps]
const lockdownGuilds = new Map(); // guildId → { originalPermissions } (saved before lockdown)

// ─── Default config ───
const DEFAULT_AUTOMOD = {
  enabled: false,
  logChannelId: null,
  immuneRoleIds: [],
  spamFilter: {
    enabled: true,
    maxMessages: 5,
    timeWindow: 5000,
    duplicateThreshold: 3,
    action: "mute",
    muteDuration: 10,
  },
  wordFilter: {
    enabled: true,
    blacklist: [],
    action: "delete_warn",
  },
  linkFilter: {
    enabled: true,
    blockInvites: true,
    blockAllLinks: false,
    whitelist: ["youtube.com", "twitter.com", "x.com", "github.com", "imgur.com"],
    action: "delete_warn",
  },
  mentionSpam: {
    enabled: true,
    maxMentions: 5,
    action: "mute",
    muteDuration: 5,
  },
  capsFilter: {
    enabled: true,
    maxCapsPercent: 70,
    minLength: 10,
    action: "delete_warn",
  },
  antiRaid: {
    enabled: false,
    maxJoins: 10,
    timeWindow: 30,
    action: "lockdown",
    lockdownDuration: 300,
  },
  escalation: {
    enabled: true,
    thresholds: [
      { warns: 3, action: "mute", duration: 60 },
      { warns: 5, action: "kick" },
      { warns: 7, action: "ban" },
    ],
  },
};

function getAutomodConfig(guildId) {
  return settings.get(`automod-${guildId}`) || DEFAULT_AUTOMOD;
}

function setAutomodConfig(guildId, config) {
  settings.set(`automod-${guildId}`, config);
}

// ─── Mod log helper ───
async function modLog(guild, config, embed) {
  if (!config.logChannelId) return;
  try {
    const channel = guild.channels.cache.get(config.logChannelId);
    if (channel) await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[AutoMod] Failed to send mod log:", err.message);
  }
}

function logEmbed(title, description, color = 0xffa500) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

// ─── Check if user is immune ───
// NOTE: Admins and ManageGuild users are ALWAYS immune.
// To test AutoMod, use an account WITHOUT these permissions.
function isImmune(member, config) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  if (config.immuneRoleIds?.length) {
    return member.roles.cache.some((r) => config.immuneRoleIds.includes(r.id));
  }
  return false;
}

// ─── Add warning and check escalation ───
async function addWarnAndEscalate(member, guild, config, reason) {
  const key = `${guild.id}-${member.id}`;
  const list = warnings.get(key) || [];
  list.push({ reason, mod: "AutoMod", date: new Date().toISOString() });
  warnings.set(key, list);
  console.log(`[AutoMod] Warning added to ${member.user.tag} (${list.length} total): ${reason}`);

  if (!config.escalation?.enabled) return;

  const count = list.length;
  const sorted = [...config.escalation.thresholds].sort((a, b) => b.warns - a.warns);
  const threshold = sorted.find((t) => count >= t.warns);
  if (!threshold) return;

  try {
    if (threshold.action === "mute" && member.moderatable) {
      await member.timeout((threshold.duration || 60) * 60 * 1000, `AutoMod: ${count} warnings`);
      console.log(`[AutoMod] Escalation: Muted ${member.user.tag} (${count} warns)`);
      await modLog(guild, config, logEmbed(
        "🔇 Auto-Mute (Escalation)",
        `**${member.user.tag}** muted for ${threshold.duration || 60}min\n**Warnings:** ${count}\n**Threshold:** ${threshold.warns}+ warns`,
        0xf0b232
      ));
    } else if (threshold.action === "kick" && member.kickable) {
      console.log(`[AutoMod] Escalation: Kicking ${member.user.tag} (${count} warns)`);
      await modLog(guild, config, logEmbed(
        "👢 Auto-Kick (Escalation)",
        `**${member.user.tag}** kicked\n**Warnings:** ${count}\n**Threshold:** ${threshold.warns}+ warns`,
        0xfee75c
      ));
      await member.kick(`AutoMod: ${count} warnings`);
    } else if (threshold.action === "ban" && member.bannable) {
      console.log(`[AutoMod] Escalation: Banning ${member.user.tag} (${count} warns)`);
      await modLog(guild, config, logEmbed(
        "🔨 Auto-Ban (Escalation)",
        `**${member.user.tag}** banned\n**Warnings:** ${count}\n**Threshold:** ${threshold.warns}+ warns`,
        0xed4245
      ));
      await member.ban({ reason: `AutoMod: ${count} warnings` });
    }
  } catch (err) {
    console.error(`[AutoMod] Escalation error for ${member.user.tag}:`, err.message);
  }
}

// ─── SPAM FILTER ───
function checkSpam(message, config) {
  const cfg = config.spamFilter;
  if (!cfg?.enabled) return false;

  const key = `${message.guild.id}-${message.author.id}`;
  const now = Date.now();

  // Rate limit check
  const timestamps = messageTracker.get(key) || [];
  timestamps.push(now);
  const recent = timestamps.filter((t) => now - t < cfg.timeWindow);
  messageTracker.set(key, recent);

  if (recent.length > cfg.maxMessages) return "rate";

  // Duplicate check
  const dupes = duplicateTracker.get(key) || [];
  dupes.push(message.content.toLowerCase().trim());
  if (dupes.length > 10) dupes.shift();
  duplicateTracker.set(key, dupes);

  const lastN = dupes.slice(-cfg.duplicateThreshold);
  if (lastN.length >= cfg.duplicateThreshold && lastN.every((d) => d === lastN[0]) && lastN[0].length > 0) {
    return "duplicate";
  }

  return false;
}

// ─── WORD FILTER ───
function checkWords(message, config) {
  const cfg = config.wordFilter;
  if (!cfg?.enabled || !cfg.blacklist?.length) return false;

  const content = message.content.toLowerCase();
  return cfg.blacklist.some((word) => content.includes(word.toLowerCase()));
}

// ─── LINK FILTER ───
function checkLinks(message, config) {
  const cfg = config.linkFilter;
  if (!cfg?.enabled) return false;

  const content = message.content;

  // Discord invites
  if (cfg.blockInvites && /discord\.(gg|com\/invite)\/\w+/i.test(content)) {
    return "invite";
  }

  // All links
  if (cfg.blockAllLinks) {
    const urlRegex = /https?:\/\/[^\s]+/gi;
    const urls = content.match(urlRegex);
    if (urls) {
      const whitelist = cfg.whitelist || [];
      const blocked = urls.some((url) => {
        return !whitelist.some((w) => url.toLowerCase().includes(w.toLowerCase()));
      });
      if (blocked) return "link";
    }
  }

  return false;
}

// ─── MENTION SPAM ───
function checkMentions(message, config) {
  const cfg = config.mentionSpam;
  if (!cfg?.enabled) return false;

  const mentionCount = message.mentions.users.size + message.mentions.roles.size;
  return mentionCount >= cfg.maxMentions;
}

// ─── CAPS FILTER ───
function checkCaps(message, config) {
  const cfg = config.capsFilter;
  if (!cfg?.enabled) return false;

  const text = message.content.replace(/[^a-zA-Z]/g, "");
  if (text.length < (cfg.minLength || 10)) return false;

  const caps = text.replace(/[^A-Z]/g, "").length;
  const percent = (caps / text.length) * 100;
  return percent >= (cfg.maxCapsPercent || 70);
}

// ─── ANTI-RAID ───
function checkRaid(guild, config) {
  const cfg = config.antiRaid;
  if (!cfg?.enabled) return false;

  const key = guild.id;
  const now = Date.now();
  const joins = joinTracker.get(key) || [];
  joins.push(now);
  const recent = joins.filter((t) => now - t < (cfg.timeWindow || 30) * 1000);
  joinTracker.set(key, recent);

  return recent.length >= (cfg.maxJoins || 10);
}

// ─── Main message handler ───
async function handleMessage(message, client) {
  if (!message.guild || message.author.bot) return;

  const config = getAutomodConfig(message.guild.id);
  if (!config.enabled) return;

  const member = message.member;
  if (!member) return;

  if (isImmune(member, config)) {
    // Don't log every immune message to avoid spam, but this is where
    // admin messages get skipped. Test with a non-admin account.
    return;
  }

  // ─── Spam Filter ───
  const spamResult = checkSpam(message, config);
  if (spamResult) {
    try {
      await message.delete();
      console.log(`[AutoMod] Spam(${spamResult}) — deleted message from ${member.user.tag} in #${message.channel.name}`);
      if (config.spamFilter.action === "mute" && member.moderatable) {
        await member.timeout((config.spamFilter.muteDuration || 10) * 60 * 1000, `AutoMod: Spam (${spamResult})`);
        console.log(`[AutoMod] Muted ${member.user.tag} for ${config.spamFilter.muteDuration || 10}min (spam)`);
      }
      await addWarnAndEscalate(member, message.guild, config, `Spam detected (${spamResult})`);
      await modLog(message.guild, config, logEmbed(
        "🚫 Spam Detected",
        `**User:** ${member.user.tag}\n**Type:** ${spamResult}\n**Channel:** <#${message.channel.id}>`,
        0xed4245
      ));
    } catch (err) {
      console.error(`[AutoMod] Spam handler error for ${member.user.tag}:`, err.message);
    }
    return;
  }

  // ─── Word Filter ───
  if (checkWords(message, config)) {
    try {
      await message.delete();
      console.log(`[AutoMod] WordFilter — deleted message from ${member.user.tag} in #${message.channel.name}: "${message.content.slice(0, 50)}"`);
      if (config.wordFilter.action === "delete_warn") {
        await addWarnAndEscalate(member, message.guild, config, "Blocked word/phrase");
      }
      await modLog(message.guild, config, logEmbed(
        "🚫 Word Filter",
        `**User:** ${member.user.tag}\n**Channel:** <#${message.channel.id}>\n**Content:** ||${message.content.slice(0, 100)}||`,
        0xffa500
      ));
    } catch (err) {
      console.error(`[AutoMod] Word filter error for ${member.user.tag}:`, err.message);
    }
    return;
  }

  // ─── Link Filter ───
  const linkResult = checkLinks(message, config);
  if (linkResult) {
    try {
      await message.delete();
      console.log(`[AutoMod] LinkFilter(${linkResult}) — deleted message from ${member.user.tag} in #${message.channel.name}`);
      if (config.linkFilter.action === "delete_warn") {
        await addWarnAndEscalate(member, message.guild, config, `Blocked link (${linkResult})`);
      }
      await modLog(message.guild, config, logEmbed(
        "🔗 Link Filter",
        `**User:** ${member.user.tag}\n**Type:** ${linkResult}\n**Channel:** <#${message.channel.id}>`,
        0xffa500
      ));
    } catch (err) {
      console.error(`[AutoMod] Link filter error for ${member.user.tag}:`, err.message);
    }
    return;
  }

  // ─── Mention Spam ───
  if (checkMentions(message, config)) {
    try {
      await message.delete();
      console.log(`[AutoMod] MentionSpam — deleted message from ${member.user.tag} (${message.mentions.users.size + message.mentions.roles.size} mentions)`);
      if (member.moderatable) {
        await member.timeout((config.mentionSpam.muteDuration || 5) * 60 * 1000, "AutoMod: Mention spam");
        console.log(`[AutoMod] Muted ${member.user.tag} for ${config.mentionSpam.muteDuration || 5}min (mention spam)`);
      }
      await addWarnAndEscalate(member, message.guild, config, "Mention spam");
      await modLog(message.guild, config, logEmbed(
        "📢 Mention Spam",
        `**User:** ${member.user.tag}\n**Mentions:** ${message.mentions.users.size + message.mentions.roles.size}\n**Channel:** <#${message.channel.id}>`,
        0xf0b232
      ));
    } catch (err) {
      console.error(`[AutoMod] Mention spam error for ${member.user.tag}:`, err.message);
    }
    return;
  }

  // ─── Caps Filter ───
  if (checkCaps(message, config)) {
    try {
      await message.delete();
      console.log(`[AutoMod] CapsFilter — deleted message from ${member.user.tag} in #${message.channel.name}`);
      if (config.capsFilter.action === "delete_warn") {
        await addWarnAndEscalate(member, message.guild, config, "Excessive caps");
      }
      await modLog(message.guild, config, logEmbed(
        "🔠 Caps Filter",
        `**User:** ${member.user.tag}\n**Channel:** <#${message.channel.id}>`,
        0xf0b232
      ));
    } catch (err) {
      console.error(`[AutoMod] Caps filter error for ${member.user.tag}:`, err.message);
    }
    return;
  }
}

// ─── Raid detection on member join ───
// SAFE: Saves @everyone permissions before lockdown, restores exactly on unlock.
// Does NOT touch individual channel overwrites.
async function handleMemberJoin(member, client) {
  const config = getAutomodConfig(member.guild.id);
  if (!config.enabled) return;

  if (checkRaid(member.guild, config)) {
    if (lockdownGuilds.has(member.guild.id)) return;

    try {
      const everyone = member.guild.roles.everyone;

      // Save original @everyone permissions BEFORE modifying
      const originalBits = everyone.permissions.bitfield;
      lockdownGuilds.set(member.guild.id, { originalPermissions: originalBits });

      // Only remove SendMessages from @everyone role
      await everyone.setPermissions(everyone.permissions.remove(PermissionFlagsBits.SendMessages), "AutoMod: Raid detected — lockdown");
      console.log(`[AutoMod] RAID LOCKDOWN activated for guild ${member.guild.name} (saved permissions: ${originalBits})`);

      await modLog(member.guild, config, logEmbed(
        "🛡️ RAID DETECTED — LOCKDOWN",
        `**Joins detected:** ${config.antiRaid.maxJoins}+ in ${config.antiRaid.timeWindow}s\n**Action:** Server locked down\n**Duration:** ${config.antiRaid.lockdownDuration || 300}s\n\n_Send messages disabled for @everyone_`,
        0xed4245
      ));

      // Auto-unlock after duration — restore EXACT original permissions
      const duration = (config.antiRaid.lockdownDuration || 300) * 1000;
      setTimeout(async () => {
        try {
          const saved = lockdownGuilds.get(member.guild.id);
          if (!saved) return;

          const everyoneRole = member.guild.roles.everyone;
          // Restore the EXACT permissions that existed before lockdown
          await everyoneRole.setPermissions(saved.originalPermissions, "AutoMod: Lockdown ended — permissions restored");
          lockdownGuilds.delete(member.guild.id);
          console.log(`[AutoMod] Lockdown ended for guild ${member.guild.name} — permissions restored to ${saved.originalPermissions}`);

          await modLog(member.guild, config, logEmbed(
            "🔓 Lockdown Ended",
            "Server permissions restored to their original state. Monitoring continues.",
            0x57f287
          ));
        } catch (err) {
          console.error("[AutoMod] Failed to restore after lockdown:", err.message);
          lockdownGuilds.delete(member.guild.id);
        }
      }, duration);
    } catch (err) {
      console.error("[AutoMod] Raid lockdown error:", err.message);
      lockdownGuilds.delete(member.guild.id);
    }
  }
}

module.exports = {
  handleMessage,
  handleMemberJoin,
  getAutomodConfig,
  setAutomodConfig,
  DEFAULT_AUTOMOD,
};
