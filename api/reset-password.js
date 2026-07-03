const {
  ADMIN_RESET_EMAIL,
  createResetToken,
  buildResetUrl,
  sendResetEmail,
} = require("../lib/password-reset");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }

  try {
    const token = createResetToken();
    const resetUrl = buildResetUrl(token);
    const emailResult = await sendResetEmail(resetUrl);

    const response = {
      success: true,
      message: `Te enviamos un correo a ${ADMIN_RESET_EMAIL} con instrucciones para restablecer tu contraseña.`,
    };

    if (emailResult.devMode) {
      response.devMode = true;
      response.resetUrl = resetUrl;
      response.message =
        "Servicio de correo no configurado en el servidor. Copiá este enlace para restablecer la contraseña: " +
        resetUrl;
    }

    res.status(200).json(response);
  } catch (err) {
    console.error("[reset-password]", err);
    res.status(500).json({ error: err.message || "No se pudo procesar el restablecimiento." });
  }
};
