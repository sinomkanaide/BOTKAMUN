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

    if (!client) {
      return res.status(500).json({ success: false, error: "Bot no conectado" });
    }

    // 1. Validate token
    const claimData = getClaimData(token);
    if (!claimData) {
      return res.json({
        success: false,
        error: "Enlace expirado",
        details: "Regresa a Discord y genera un nuevo enlace.",
      });
    }

    // 2. Verify wallet signature
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);

      if (recoveredAddress.toLowerCase() !== wallet.toLowerCase()) {
        return res.json({
          success: false,
          error: "Firma inválida",
          details: "La firma no corresponde a la wallet proporcionada.",
        });
      }
    } catch (err) {
      return res.json({
        success: false,
        error: "Error de verificación",
        details: "No se pudo verificar la firma. Intenta de nuevo.",
      });
    }

    // 3. Get API config
    const apiConfig = getApiConfig(claimData.guildId);
    if (!apiConfig) {
      return res.json({
        success: false,
        error: "API no configurada",
        details: "El servidor no tiene configurada la API del juego.",
      });
    }

    // 4. Query game API for player level
    let playerLevel = 0;
    try {
      const endpoint = apiConfig.endpoint.replace("{wallet}", wallet);
      const url = `${apiConfig.baseUrl}${endpoint}`;

      const headers = { "Content-Type": "application/json" };
      if (apiConfig.apiKey) {
        headers["Authorization"] = `Bearer ${apiConfig.apiKey}`;
        headers["X-API-Key"] = apiConfig.apiKey;
      }

      const apiRes = await fetch(url, { headers });

      if (!apiRes.ok) {
        return res.json({
          success: false,
          error: "Wallet no encontrada",
          details: `No se encontró un jugador con esta wallet. (HTTP ${apiRes.status})`,
        });
      }

      const apiData = await apiRes.json();

      // Extract level from nested field (supports "level", "data.level", etc.)
      playerLevel = apiConfig.levelField.split(".").reduce((obj, key) => obj?.[key], apiData);

      if (playerLevel === undefined || playerLevel === null) {
        return res.json({
          success: false,
          error: "Nivel no encontrado",
          details: `La API respondió pero no se encontró el campo "${apiConfig.levelField}".`,
        });
      }

      playerLevel = parseInt(playerLevel, 10);
    } catch (err) {
      console.error("Error calling game API:", err);
      return res.json({
        success: false,
        error: "Error de API",
        details: "No se pudo conectar con la API del juego. Intenta más tarde.",
      });
    }

    // 5. Determine rank
    const ranks = getRanks(claimData.guildId);
    const rank = getRankForLevel(ranks, playerLevel);

    if (!rank) {
      return res.json({
        success: false,
        error: "Nivel insuficiente",
        details: `Tu nivel actual es ${playerLevel}. Necesitas al menos nivel ${ranks.filter(r => r.level > 0).sort((a,b) => a.level - b.level)[0]?.level || '?'} para obtener un rango.`,
      });
    }

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
      }

      // Remove previous Egyptian rank roles
      const allRankNames = ranks.filter((r) => r.level > 0).map((r) => r.name);
      const rolesToRemove = member.roles.cache.filter((r) => allRankNames.includes(r.name));
      if (rolesToRemove.size > 0) {
        await member.roles.remove(rolesToRemove);
      }

      // Add new role
      await member.roles.add(discordRole);

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

      return res.json({
        success: true,
        rankName: rank.name,
        level: playerLevel,
        message: `Nivel ${playerLevel} verificado. Se te ha asignado el rango ${rank.name} en Discord.`,
      });

    } catch (err) {
      console.error("Error assigning role:", err);
      return res.json({
        success: false,
        error: "Error de Discord",
        details: "No se pudo asignar el rol. Verifica que el bot tenga permisos suficientes.",
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
    if (!Array.isArray(ranks)) return res.status(400).json({ error: "ranks debe ser un array" });
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
    const testWallet = req.body.wallet || "0x0000000000000000000000000000000000000000";
    const url = `${config.baseUrl}${config.endpoint.replace("{wallet}", testWallet)}`;
    try {
      const headers = { "Content-Type": "application/json" };
      if (config.apiKey) {
        headers["Authorization"] = `Bearer ${config.apiKey}`;
        headers["X-API-Key"] = config.apiKey;
      }
      const apiRes = await fetch(url, { headers });
      const data = await apiRes.json();
      const level = config.levelField.split(".").reduce((obj, key) => obj?.[key], data);
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
