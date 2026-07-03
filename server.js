const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const {
  ADMIN_RESET_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
  createResetToken,
  verifyResetToken,
  buildResetUrl,
  sendResetEmail,
} = require('./lib/password-reset');

const PORT = 3000;
const PUBLIC_DIR = __dirname;

if (!process.env.SITE_URL) {
  process.env.SITE_URL = `http://localhost:${PORT}`;
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/reset-password') {
    (async () => {
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
            'Servicio de correo no configurado en el servidor. Copiá este enlace para restablecer la contraseña: ' +
            resetUrl;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (err) {
        console.error('[Server] Reset password error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'No se pudo procesar el restablecimiento.' }));
      }
    })();
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/api/confirm-reset')) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const token = url.searchParams.get('token');

    if (!verifyResetToken(token)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Enlace inválido o expirado.' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, password: DEFAULT_ADMIN_PASSWORD }));
    return;
  }

  // API Endpoint to publish/save changes
  if (req.method === 'POST' && req.url === '/api/publish') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const catalogData = JSON.parse(body);

        // 1. Save locally to catalog.json
        fs.writeFileSync(
          path.join(PUBLIC_DIR, 'catalog.json'),
          JSON.stringify(catalogData, null, 2),
          'utf8'
        );

        // 2. Save locally to catalog.js
        fs.writeFileSync(
          path.join(PUBLIC_DIR, 'catalog.js'),
          `window.GARAGE_CATALOG_FILE = ${JSON.stringify(catalogData, null, 2)};\n`,
          'utf8'
        );

        console.log('[Server] catalog.json and catalog.js updated locally.');

        // 3. Trigger automatic deployment to Vercel (Production)
        console.log('[Server] Deploying to Vercel production...');
        
        // Execute vercel --prod --yes. Since this is a static project, it builds in milliseconds.
        exec('npx vercel --prod --yes', { cwd: PUBLIC_DIR }, (err, stdout, stderr) => {
          if (err) {
            console.error('[Server] Vercel deployment error:', err);
            console.error('[Server] Stderr:', stderr);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message || 'Error en despliegue' }));
            return;
          }

          console.log('[Server] Deployment successful:', stdout);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: true, 
            url: 'https://lospimpollos.vercel.app' // Primary friendly domain
          }));
        });

      } catch (err) {
        console.error('[Server] Publish error:', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'JSON inválido' }));
      }
    });
    return;
  }

  // Serve static files
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') {
    urlPath = '/index.html';
  }

  const filePath = path.join(PUBLIC_DIR, urlPath);
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Archivo no encontrado');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Error interno del servidor');
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content, 'utf-8');
  });
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Servidor local activo en: http://localhost:${PORT}`);
  console.log(` Abre http://localhost:${PORT}/gestion.html para administrar`);
  console.log(`====================================================`);
});
