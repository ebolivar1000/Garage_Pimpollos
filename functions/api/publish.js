export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  try {
    const GITHUB_TOKEN = env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Falta configurar GITHUB_TOKEN en las variables de entorno de Cloudflare Pages.",
          needToken: true,
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const REPO_OWNER = "ebolivar1000";
    const REPO_NAME = "Garage_Pimpollos";
    const BRANCH = "main";

    const catalogData = await request.json();
    if (!catalogData || typeof catalogData !== "object") {
      return new Response(JSON.stringify({ error: "Datos del catálogo inválidos" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const jsonContent = JSON.stringify(catalogData, null, 2);
    const jsContent = `window.GARAGE_CATALOG_FILE = ${jsonContent};\n`;

    function toBase64(str) {
      const bytes = new TextEncoder().encode(str);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    }

    const jsonContentB64 = toBase64(jsonContent);
    const jsContentB64 = toBase64(jsContent);

    async function updateFileOnGitHub(path, base64Content) {
      const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;
      const headers = {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Cloudflare-Pages-Function",
      };

      let sha = undefined;
      const getRes = await fetch(url + `?ref=${BRANCH}`, { headers });
      if (getRes.ok) {
        const fileData = await getRes.json();
        sha = fileData.sha;
      }

      const putRes = await fetch(url, {
        method: "PUT",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Publicado desde el Administrador Cloudflare (${path})`,
          content: base64Content,
          sha: sha,
          branch: BRANCH,
        }),
      });

      if (!putRes.ok) {
        const errorData = await putRes.json();
        throw new Error(`Error al actualizar ${path}: ${errorData.message}`);
      }
    }

    await updateFileOnGitHub("catalog.json", jsonContentB64);
    await updateFileOnGitHub("catalog.js", jsContentB64);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Catálogo actualizado exitosamente en GitHub. Cloudflare Pages y Vercel comenzarán el despliegue automático.",
        url: "https://lospimpollos.pages.dev",
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error("Error en functions/api/publish.js:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || "Error interno del servidor",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
