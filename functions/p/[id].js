function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function onRequest(context) {
  const { params, request, env } = context;
  const productId = params.id;
  const url = new URL(request.url);
  const origin = url.origin;

  try {
    const [indexRes, catalogRes] = await Promise.all([
      env.ASSETS.fetch(new URL('/', origin)),
      env.ASSETS.fetch(new URL('/catalog.json', origin)),
    ]);

    let html = await indexRes.text();
    const catalog = await catalogRes.json();

    const product = (catalog.products || []).find((p) => p.id === productId);

    if (product) {
      const rate = Number(catalog.settings?.usdToArsRate || 1500);
      const priceUsd = Number(product.priceUsd || 0);
      const priceArs = Math.round(priceUsd * rate);

      const priceArsFormatted = new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0,
      }).format(priceArs);

      const priceUsdFormatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(priceUsd);

      const fullTitle = `${product.title} - ${priceUsdFormatted} (${priceArsFormatted}) | El garage de los pimpollos`;

      const descParts = [];
      if (product.condition) descParts.push(`Estado: ${product.condition}.`);
      if (product.note) descParts.push(product.note);
      if (product.properties && typeof product.properties === 'object') {
        const specs = Object.entries(product.properties)
          .slice(0, 3)
          .map(([k, v]) => `${k}: ${v}`)
          .join(' | ');
        if (specs) descParts.push(specs);
      }
      descParts.push(`Precios: ${priceUsdFormatted} USD / ${priceArsFormatted} ARS.`);
      const fullDesc = descParts.join(' ');

      const images = Array.isArray(product.images) && product.images.length ? product.images : [product.image];
      const rawImage = images.filter(Boolean)[0] || '';
      let imageUrl = '';

      if (rawImage.startsWith('http://') || rawImage.startsWith('https://')) {
        imageUrl = rawImage;
      } else if (rawImage) {
        const cleanPath = rawImage.startsWith('/') ? rawImage : '/' + rawImage;
        imageUrl = `${origin}${cleanPath}`;
      }

      const canonicalUrl = `${origin}/p/${product.id}`;

      const ogMeta = [
        `<title>${escapeHtml(fullTitle)}</title>`,
        `<meta name="description" content="${escapeAttr(fullDesc)}" />`,
        `<link rel="canonical" href="${canonicalUrl}" />`,
        '<!-- Open Graph / WhatsApp / Facebook -->',
        '<meta property="og:type" content="product" />',
        `<meta property="og:site_name" content="${escapeAttr(catalog.settings?.storeName || 'El garage de los pimpollos')}" />`,
        `<meta property="og:title" content="${escapeAttr(fullTitle)}" />`,
        `<meta property="og:description" content="${escapeAttr(fullDesc)}" />`,
        `<meta property="og:url" content="${canonicalUrl}" />`,
        imageUrl ? `<meta property="og:image" content="${imageUrl}" />` : '',
        imageUrl ? `<meta property="og:image:secure_url" content="${imageUrl}" />` : '',
        imageUrl ? '<meta property="og:image:type" content="image/jpeg" />' : '',
        imageUrl ? `<meta property="og:image:alt" content="${escapeAttr(product.title)}" />` : '',
        '<!-- Twitter -->',
        '<meta name="twitter:card" content="summary_large_image" />',
        `<meta name="twitter:title" content="${escapeAttr(fullTitle)}" />`,
        `<meta name="twitter:description" content="${escapeAttr(fullDesc)}" />`,
        imageUrl ? `<meta name="twitter:image" content="${imageUrl}" />` : '',
      ].filter(Boolean).join('\n    ');

      html = html.replace(/<title>[\s\S]*?<\/title>/i, '');
      html = html.replace(/<meta\s+name=["']description["'][\s\S]*?>/i, '');
      html = html.replace(/<meta\s+property=["']og:[\s\S]*?>/gi, '');
      html = html.replace(/<meta\s+name=["']twitter:[\s\S]*?>/gi, '');

      html = html.replace('</head>', `    ${ogMeta}\n  </head>`);
    }

    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=60, s-maxage=300',
      },
    });
  } catch (err) {
    console.error('Error in /p/[id] handler:', err);
    return env.ASSETS.fetch(new URL('/', origin));
  }
}
