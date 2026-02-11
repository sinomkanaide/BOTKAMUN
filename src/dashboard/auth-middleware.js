function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  if (req.path === "/api/login") return next();
  return res.status(401).json({ error: "No autenticado" });
}

module.exports = { requireAuth };
