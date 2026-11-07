import { DEFAULT_ADMIN_PASSWORD, verifyResetToken } from "../lib/password-reset.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método no permitido." });
  }

  const token = req.query?.token;
  if (!verifyResetToken(token)) {
    return res.status(400).json({ error: "Enlace inválido o expirado." });
  }

  return res.status(200).json({
    success: true,
    password: DEFAULT_ADMIN_PASSWORD,
  });
}
