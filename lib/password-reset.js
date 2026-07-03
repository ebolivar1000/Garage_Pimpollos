const crypto = require("crypto");

const DEFAULT_ADMIN_PASSWORD = "pimpollos";
const ADMIN_RESET_EMAIL = "ebolivar1000@gmail.com";
const TOKEN_TTL_MS = 60 * 60 * 1000;

function getResetSecret() {
  return process.env.RESET_SECRET || "garage-pimpollos-dev-secret-change-in-prod";
}

function getSiteUrl() {
  return (process.env.SITE_URL || "https://lospimpollos.vercel.app").replace(/\/$/, "");
}

function createResetToken() {
  const payload = Buffer.from(
    JSON.stringify({
      exp: Date.now() + TOKEN_TTL_MS,
      purpose: "admin-reset",
    })
  ).toString("base64url");

  const signature = crypto.createHmac("sha256", getResetSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyResetToken(token) {
  if (!token || typeof token !== "string") return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expected = crypto.createHmac("sha256", getResetSecret()).update(payload).digest("base64url");
  if (signature.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (data.purpose !== "admin-reset") return false;
    if (typeof data.exp !== "number" || Date.now() > data.exp) return false;
    return true;
  } catch {
    return false;
  }
}

function buildResetUrl(token) {
  return `${getSiteUrl()}/gestion.html?resetToken=${encodeURIComponent(token)}`;
}

async function sendResetEmail(resetUrl) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log("[Password Reset] RESEND_API_KEY no configurada.");
    console.log("[Password Reset] Enlace de restablecimiento:", resetUrl);
    return { devMode: true, resetUrl };
  }

  const from = process.env.RESEND_FROM || "El garage de los pimpollos <onboarding@resend.dev>";
  const html = `
    <div style="font-family: Inter, Arial, sans-serif; line-height: 1.6; color: #1a1a1c;">
      <h2 style="margin: 0 0 12px;">Restablecer contraseña de administración</h2>
      <p>Recibiste una solicitud para restablecer el acceso al panel de gestión de <strong>El garage de los pimpollos</strong>.</p>
      <p>Tu contraseña volverá a ser:</p>
      <p style="font-size: 18px; font-weight: 700; letter-spacing: 0.04em;">${DEFAULT_ADMIN_PASSWORD}</p>
      <p>Hacé clic en el botón para aplicar el cambio en tu navegador. El enlace expira en 1 hora.</p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 20px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;">
          Restablecer contraseña
        </a>
      </p>
      <p style="font-size: 13px; color: #5c5c61;">Si el botón no funciona, copiá este enlace:<br><a href="${resetUrl}">${resetUrl}</a></p>
      <p style="font-size: 13px; color: #8e8e93;">Si no solicitaste este restablecimiento, podés ignorar este correo.</p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [ADMIN_RESET_EMAIL],
      subject: "Restablecer contraseña — El garage de los pimpollos",
      html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || "No se pudo enviar el correo de restablecimiento.");
  }

  return { devMode: false };
}

module.exports = {
  DEFAULT_ADMIN_PASSWORD,
  ADMIN_RESET_EMAIL,
  createResetToken,
  verifyResetToken,
  buildResetUrl,
  sendResetEmail,
};
