const { ethers } = require("ethers");
const { getClaimData, consumeClaim } = require("../events/claim");
const { getRanks, getApiConfig, setApiConfig, getRankForLevel, setRanks } = require("../commands/egypt-roles");
const { settings } = require("../utils/database");

function registerClaimRoutes(app, getClient) {
  // ─── Serve verification page ───
  app.get("/verify/:token", (req, res) => {
    res.sendFile(require("path").join(__dirname, "public", "verify.html"));
  });

  // ─── Check if token is valid ───
  app.get("/api/claim/check/:token", (req, res) => {
    const data = getClaimData(req.params.token);
    res.json({ valid: !!data });
  });

  // ─── Main verification endpoint ───
  app.post("/api/claim/verify", async (req, res) => {
    const { token, wallet, signature, message } = req.body;
    const client = getClient();

    console.log(`[CLAIM] Verification request — wallet: ${wallet}, token: ${token?.slice(0, 8)}...`);

    if (!client) {
      return res.status(500).json({ success: false, error: "Bot not connected" });
    }

    // 1. Validate token
    const claimData = getClaimData(token);
    if (!claimData) {
      console.log(`[CLAIM] Token invalid or expired: ${token?.slice(0, 8)}...`);
      return res.json({
        success: false,
        error: "Link expired",
        details: "Go back to Discord and generate a new link.",
      });
    }

    console.log(`[CLAIM] Token valid — userId: ${claimData.userId}, guildId: ${claimData.guildId}`);

    // 2. Verify wallet signature
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);

      if (recoveredAddress.toLowerCase() !== wallet.toLowerCase()) {
        console.log(`[CLAIM] Signature mismatch — recovered: ${recoveredAddress}, provided: ${wallet}`);
        return res.json({
          success: false,
          error: "Invalid signature",
          details: "The signature does not match the provided wallet.",
        });
      }
      console.log(`[CLAIM] Signature verified — wallet: ${wallet}`);
    } catch (err) {
      console.error(`[CLAIM] Signature verification error:`, err.message);
      return res.json({
        success: false,
        error: "Verification error",
        details: "Could not verify the signature. Please try again.",
      });
    }

    // 3. Get API config
    const apiConfig = getApiConfig(claimData.guildId);
    if (!apiConfig) {
      console.log(`[CLAIM] No API config for guild ${claimData.guildId}`);
      return res.json({
        success: false,
        error: "API not configured",
        details: "The server has not configured the game API.",
      });
    }

    // 4. Query game API for player level
    let playerLevel = 0;
    try {
      // Try both original and lowercase wallet
      const walletLower = wallet.toLowerCase();
      const endpoint = apiConfig.endpoint.replace("{wallet}", walletLower);
      const url = `${apiConfig.baseUrl}${endpoint}`;

      const headers = {};
      if (apiConfig.apiKey) {
        headers["Authorization"] = `Bearer ${apiConfig.apiKey}`;
        headers["X-API-Key"] = apiConfig.apiKey;
      }

      console.log(`[CLAIM] Calling game API: ${url}`);
      console.log(`[CLAIM] Headers: ${JSON.stringify(headers)}`);

      const apiRes = await fetch(url, { headers });

      console.log(`[CLAIM] API Response status: ${apiRes.status}`);
      const responseText = await apiRes.text();
      console.log(`[CLAIM] API Response body: ${responseText}`);

      if (!apiRes.ok) {
        return res.json({
          success: false,
          error: "Could not verify wallet",
          details: `Could not verify your wallet. This may mean your wallet is not registered in the game. Make sure you're using the same wallet linked to your Tapkamun account. (HTTP ${apiRes.status})`,
        });
      }

      // Parse the response text as JSON
      let apiData;
      try {
        apiData = JSON.parse(responseText);
      } catch {
        console.error(`[CLAIM] Failed to parse API response as JSON`);
        return res.json({
          success: false,
          error: "API error",
          details: "The game API returned an invalid response.",
        });
      }

      // Extract level from nested field (supports "level", "data.level", etc.)
      playerLevel = apiConfig.levelField.split(".").reduce((obj, key) => obj?.[key], apiData);

      if (playerLevel === undefined || playerLevel === null) {
        console.log(`[CLAIM] Level field "${apiConfig.levelField}" not found in response: ${responseText.slice(0, 200)}`);
        return res.json({
          success: false,
          error: "Level not found",
          details: `The API responded but the field "${apiConfig.levelField}" was not found in the response.`,
        });
      }

      playerLevel = parseInt(playerLevel, 10);
      console.log(`[CLAIM] Player level: ${playerLevel}`);
    } catch (err) {
      console.error("[CLAIM] Error calling game API:", err);
      return res.json({
        success: false,
        error: "API error",
        details: "Could not connect to the game API. Please try again later.",
      });
    }

    // 5. Determine rank
    const ranks = getRanks(claimData.guildId);
    const rank = getRankForLevel(ranks, playerLevel);

    if (!rank) {
      const minLevel = ranks.filter(r => r.level > 0).sort((a,b) => a.level - b.level)[0]?.level || '?';
      console.log(`[CLAIM] Level ${playerLevel} insufficient — minimum required: ${minLevel}`);
      return res.json({
        success: false,
        error: "Insufficient level",
        details: `Your current level is ${playerLevel}. You need at least level ${minLevel} to claim a rank.`,
      });
    }

    console.log(`[CLAIM] Rank determined: ${rank.name} (level ${rank.level})`);

    // 6. Assign role in Discord
    try {
      const guild = await client.guilds.fetch(claimData.guildId);
      const member = await guild.members.fetch(claimData.userId);

      // Find the Discord role
      let discordRole = guild.roles.cache.find((r) => r.name === rank.name);

      if (!discordRole) {
        // Create the role if it doesn't exist
        discordRole = await guild.roles.create({
          name: rank.name,
          color: rank.color,
          hoist: true,
          reason: "Auto-created by rank claim system",
        });
        console.log(`[CLAIM] Created role: ${rank.name}`);
      }

      // Remove previous Egyptian rank roles
      const allRankNames = ranks.filter((r) => r.level > 0).map((r) => r.name);
      const rolesToRemove = member.roles.cache.filter((r) => allRankNames.includes(r.name));
      if (rolesToRemove.size > 0) {
        await member.roles.remove(rolesToRemove);
        console.log(`[CLAIM] Removed old rank roles: ${rolesToRemove.map(r => r.name).join(', ')}`);
      }

      // Add new role
      await member.roles.add(discordRole);
      console.log(`[CLAIM] Assigned role ${rank.name} to ${member.user.tag}`);

      // Also make sure they have citizen role (verified)
      const citizenRank = ranks.find((r) => r.level === -1);
      if (citizenRank) {
        let citizenRole = guild.roles.cache.find((r) => r.name === citizenRank.name);
        if (citizenRole && !member.roles.cache.has(citizenRole.id)) {
          await member.roles.add(citizenRole);
        }
      }

      // Remove slave role if they have it
      const slaveRank = ranks.find((r) => r.level === 0);
      if (slaveRank) {
        const slaveRole = guild.roles.cache.find((r) => r.name === slaveRank.name);
        if (slaveRole && member.roles.cache.has(slaveRole.id)) {
          await member.roles.remove(slaveRole);
          console.log(`[CLAIM] Removed Slave role from ${member.user.tag}`);
        }
      }

      // Save wallet link
      settings.set(`wallet-${claimData.guildId}-${claimData.userId}`, {
        wallet: wallet.toLowerCase(),
        lastLevel: playerLevel,
        lastClaim: new Date().toISOString(),
        lastRank: rank.name,
      });

      // Consume the token
      consumeClaim(token);

      console.log(`[CLAIM] SUCCESS — ${member.user.tag} got ${rank.name} (level ${playerLevel})`);

      return res.json({
        success: true,
        rankName: rank.name,
        level: playerLevel,
        message: `Level ${playerLevel} verified. You have been assigned the rank ${rank.name} in Discord.`,
      });

    } catch (err) {
      console.error("[CLAIM] Error assigning role:", err);
      return res.json({
        success: false,
        error: "Discord error",
        details: "Could not assign the role. Please verify the bot has sufficient permissions.",
      });
    }
  });

  // ─── Dashboard: Ranks management API ───
  const { requireAuth } = require("./auth-middleware");

  app.get("/api/ranks/:guildId", requireAuth, (req, res) => {
    const ranks = getRanks(req.params.guildId);
    res.json(ranks);
  });

  app.put("/api/ranks/:guildId", requireAuth, (req, res) => {
    const { ranks } = req.body;
    if (!Array.isArray(ranks)) return res.status(400).json({ error: "ranks must be an array" });
    setRanks(req.params.guildId, ranks);
    res.json({ success: true, ranks });
  });

  app.post("/api/ranks/:guildId/add", requireAuth, (req, res) => {
    const { level, name, color, description, roleKey } = req.body;
    const ranks = getRanks(req.params.guildId);
    ranks.push({
      level: parseInt(level, 10),
      roleKey: roleKey || name.toLowerCase().replace(/\s+/g, "_"),
      name,
      color: typeof color === "string" ? parseInt(color.replace("#", ""), 16) : color,
      description: description || "",
    });
    setRanks(req.params.guildId, ranks);
    res.json({ success: true, ranks });
  });

  app.delete("/api/ranks/:guildId/:roleKey", requireAuth, (req, res) => {
    let ranks = getRanks(req.params.guildId);
    ranks = ranks.filter((r) => r.roleKey !== req.params.roleKey);
    setRanks(req.params.guildId, ranks);
    res.json({ success: true, ranks });
  });

  // ─── Game API config ───
  app.get("/api/gameapi/:guildId", requireAuth, (req, res) => {
    const config = getApiConfig(req.params.guildId);
    res.json(config || { baseUrl: "", endpoint: "", levelField: "", apiKey: "" });
  });

  app.put("/api/gameapi/:guildId", requireAuth, (req, res) => {
    const { baseUrl, endpoint, levelField, apiKey } = req.body;
    if (!baseUrl || !endpoint || !levelField) {
      return res.status(400).json({ error: "baseUrl, endpoint, and levelField are required" });
    }
    setApiConfig(req.params.guildId, {
      baseUrl: baseUrl.replace(/\/$/, ""),
      endpoint,
      levelField,
      apiKey: apiKey || null,
    });
    res.json({ success: true });
  });

  app.post("/api/gameapi/:guildId/test", requireAuth, async (req, res) => {
    const config = getApiConfig(req.params.guildId);
    if (!config || !config.baseUrl || !config.endpoint) {
      return res.status(400).json({ error: "Save the API config first" });
    }
    const testWallet = (req.body.wallet || "0x0000000000000000000000000000000000000000").toLowerCase();
    const url = `${config.baseUrl}${config.endpoint.replace("{wallet}", testWallet)}`;
    try {
      const headers = {};
      if (config.apiKey) {
        headers["Authorization"] = `Bearer ${config.apiKey}`;
        headers["X-API-Key"] = config.apiKey;
      }
      console.log(`[CLAIM:TEST] Testing API: ${url}`);
      const apiRes = await fetch(url, { headers });
      const text = await apiRes.text();
      console.log(`[CLAIM:TEST] Response: ${apiRes.status} — ${text.slice(0, 500)}`);
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      const level = typeof data === 'object' ? config.levelField.split(".").reduce((obj, key) => obj?.[key], data) : null;
      res.json({ status: apiRes.status, url, data, levelField: config.levelField, levelValue: level !== undefined ? level : null });
    } catch (err) {
      res.status(502).json({ error: err.message, url });
    }
  });

  // ─── Linked wallets ───
  app.get("/api/wallets/:guildId", requireAuth, (req, res) => {
    const all = settings.getAll();
    const prefix = `wallet-${req.params.guildId}-`;
    const wallets = Object.entries(all)
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, v]) => ({ userId: k.replace(prefix, ""), ...v }));
    res.json(wallets);
  });
}

module.exports = { registerClaimRoutes };
