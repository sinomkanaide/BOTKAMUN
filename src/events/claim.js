const { EmbedBuilder } = require("discord.js");
const crypto = require("crypto");
const { settings } = require("../utils/database");
const { getRanks, getApiConfig, getRankForLevel } = require("../commands/egypt-roles");

// Temporary tokens for wallet verification (userId -> token data)
// Stored in memory, expire after 10 minutes
const pendingClaims = new Map();

function generateClaimToken(userId, guildId) {
  const token = crypto.randomBytes(32).toString("hex");
  const data = {
    userId,
    guildId,
    token,
    createdAt: Date.now(),
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 min
  };
  pendingClaims.set(token, data);

  // Clean expired tokens every time we create one
  for (const [t, d] of pendingClaims) {
    if (Date.now() > d.expiresAt) pendingClaims.delete(t);
  }

  return token;
}

function getClaimData(token) {
  const data = pendingClaims.get(token);
  if (!data) return null;
  if (Date.now() > data.expiresAt) {
    pendingClaims.delete(token);
    return null;
  }
  return data;
}

function consumeClaim(token) {
  pendingClaims.delete(token);
}

// Get base URL for the verification page
function getBaseUrl() {
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  if (process.env.BASE_URL) {
    return process.env.BASE_URL;
  }
  const port = process.env.PORT || 3000;
  return `http://localhost:${port}`;
}

async function handleButton(interaction, client) {
  const guildId = interaction.guild.id;

  if (interaction.customId === "claim_rank") {
    // Generate unique token and URL
    const token = generateClaimToken(interaction.user.id, guildId);
    const baseUrl = getBaseUrl();
    const verifyUrl = `${baseUrl}/verify/${token}`;

    const embed = new EmbedBuilder()
      .setColor(0xd4a843)
      .setTitle("🔱 Verificación de Wallet")
      .setDescription(
        `Haz clic en el enlace para conectar tu wallet y reclamar tu rango.\n\n` +
        `**[➡️ Conectar Wallet](${verifyUrl})**\n\n` +
        `⏰ Este enlace expira en **10 minutos**.\n` +
        `🔒 Solo tú puedes usarlo.`
      )
      .setFooter({ text: "Deberás firmar un mensaje con MetaMask para verificar tu identidad" })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (interaction.customId === "view_my_rank") {
    const ranks = getRanks(guildId);
    const memberRoles = interaction.member.roles.cache;

    // Find current Egyptian rank
    const currentRank = ranks.find((r) => {
      const role = interaction.guild.roles.cache.find((gr) => gr.name === r.name);
      return role && memberRoles.has(role.id);
    });

    // Find linked wallet
    const walletData = settings.get(`wallet-${guildId}-${interaction.user.id}`);

    const embed = new EmbedBuilder()
      .setColor(currentRank ? currentRank.color : 0x6d6d6d)
      .setTitle(`📊 Tu Rango en el Imperio`)
      .addFields(
        {
          name: "Rango actual",
          value: currentRank ? `${currentRank.name}` : "⛓️ Sin rango",
          inline: true,
        },
        {
          name: "Wallet vinculada",
          value: walletData
            ? `\`${walletData.wallet.slice(0, 6)}...${walletData.wallet.slice(-4)}\``
            : "No vinculada",
          inline: true,
        },
        {
          name: "Último claim",
          value: walletData?.lastClaim
            ? `<t:${Math.floor(new Date(walletData.lastClaim).getTime() / 1000)}:R>`
            : "Nunca",
          inline: true,
        }
      )
      .setTimestamp();

    // Show next rank
    if (walletData?.lastLevel !== undefined) {
      const gameRanks = ranks.filter((r) => r.level > 0).sort((a, b) => a.level - b.level);
      const nextRank = gameRanks.find((r) => r.level > walletData.lastLevel);
      if (nextRank) {
        embed.addFields({
          name: "Próximo rango",
          value: `${nextRank.name} — necesitas nivel **${nextRank.level}** (tienes **${walletData.lastLevel}**)`,
        });
      } else {
        embed.addFields({ name: "Estado", value: "🏆 ¡Has alcanzado el rango máximo!" });
      }
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

module.exports = {
  handleButton,
  pendingClaims,
  getClaimData,
  consumeClaim,
  generateClaimToken,
};
