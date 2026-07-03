const { DEFAULT_ADMIN_PASSWORD, verifyResetToken } = require("../lib/password-reset");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }

  const token = req.query?.token;
  if (!verifyResetToken(token)) {
    res.status(400).json({ error: "Enlace inválido o expirado." });
    return;
  }

  res.status(200).json({
    success: true,
    password: DEFAULT_ADMIN_PASSWORD,
  });
};
