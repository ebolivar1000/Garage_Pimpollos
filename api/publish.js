export default async function handler(req, res) {
  // Configuración de CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
      return res.status(500).json({
        success: false,
        error: "Falta configurar GITHUB_TOKEN en Vercel.",
        needToken: true
      });
    }

    const REPO_OWNER = "ebolivar1000";
    const REPO_NAME = "Garage_Pimpollos";
    const BRANCH = "main";

    const catalogData = req.body;
    if (!catalogData || typeof catalogData !== "object") {
      return res.status(400).json({ error: "Datos del catálogo inválidos" });
    }

    // Preparar el contenido
    const jsonContent = JSON.stringify(catalogData, null, 2);
    const jsContent = `window.GARAGE_CATALOG_FILE = ${jsonContent};\n`;

    const jsonContentB64 = Buffer.from(jsonContent, "utf8").toString("base64");
    const jsContentB64 = Buffer.from(jsContent, "utf8").toString("base64");

    // Función auxiliar para actualizar un archivo en GitHub
    async function updateFileOnGitHub(path, base64Content) {
      const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;
      const headers = {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Vercel-Serverless-Function",
      };

      // 1. Obtener el SHA actual del archivo (necesario para sobreescribir en la API de GitHub)
      let sha = undefined;
      const getRes = await fetch(url + `?ref=${BRANCH}`, { headers });
      if (getRes.ok) {
        const fileData = await getRes.json();
        sha = fileData.sha;
      }

      // 2. Hacer el commit
      const putRes = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: `Publicado desde el Administrador Vercel (${path})`,
          content: base64Content,
          sha: sha,
          branch: BRANCH
        }),
      });

      if (!putRes.ok) {
        const errorData = await putRes.json();
        throw new Error(`Error al actualizar ${path}: ${errorData.message}`);
      }
    }

    // Actualizamos ambos archivos secuencialmente
    await updateFileOnGitHub("catalog.json", jsonContentB64);
    await updateFileOnGitHub("catalog.js", jsContentB64);

    return res.status(200).json({
      success: true,
      message: "Catálogo actualizado exitosamente en GitHub. Vercel comenzará el despliegue automático.",
    });

  } catch (err) {
    console.error("Error en api/publish.js:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Error interno del servidor",
    });
  }
}
