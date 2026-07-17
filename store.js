const DRAFT_KEY = "garage-pimpollos-draft";
const PUBLISHED_KEY = "garage-pimpollos-published";
const LEGACY_KEY = "garage-pimpollos-catalog";
const SESSION_KEY = "garage-pimpollos-admin";
const ADMIN_PW_KEY = "garage-pimpollos-admin-pw";
const DEFAULT_ADMIN_PASSWORD = "pimpollos";
const ADMIN_RESET_EMAIL = "ebolivar1000@gmail.com";

const IMAGE_FALLBACK =
  "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&q=80";

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function getDefaultCatalog() {
  return {
    version: 1,
    settings: {
      storeName: "El garage de los Pimpollos",
      whatsappPhone: "541154188294",
      usdToArsRate: 1480,
      transferCvu: "0000003100359754352113",
      paymentMethods: getDefaultPaymentMethods("0000003100359754352113"),
    },
    categories: [
      {
        id: "cat-tablets",
        name: "Tablets",
        order: 0,
        propertyFields: ["Resolución", "RAM", "Almacenamiento", "Batería", "Estado"],
      },
      {
        id: "cat-celulares",
        name: "Celulares",
        order: 1,
        propertyFields: ["Pantalla", "RAM", "Almacenamiento", "Batería", "Estado"],
      },
      {
        id: "cat-audio",
        name: "Audio",
        order: 2,
        propertyFields: ["Autonomía", "Conectividad", "Incluye", "Estado"],
      },
    ],
    products: [
      {
        id: "galaxy-tab-a-s-pen",
        categoryId: "cat-tablets",
        title: "Samsung Galaxy Tab A with S Pen",
        condition: "Usado",
        image: "images/galaxy-tab-a-s-pen.jpg",
        images: ["images/galaxy-tab-a-s-pen.jpg"],
        priceUsd: 150,
        priceMlUsd: 229,
        note: "Incluye S Pen original y cargador USB-C. Pantalla sin rayones.",
        properties: {
          Resolución: "1920×1200 (10.1″)",
          RAM: "3 GB",
          Almacenamiento: "32 GB + microSD hasta 512 GB",
          Batería: "4,200 mAh",
          Estado: "Artículo usado en muy buen estado",
        },
      },
    ],
  };
}

function getProductImages(product) {
  if (Array.isArray(product?.images) && product.images.length) {
    return product.images.filter(Boolean);
  }
  if (product?.image) return [product.image];
  return [];
}

function migrateProduct(product, fallbackCategoryId) {
  const images = getProductImages(product);
  return {
    id: product.id || uid("prod"),
    categoryId: product.categoryId || fallbackCategoryId,
    title: product.title || "Sin título",
    condition: product.condition || "Usado",
    images,
    image: images[0] || "",
    priceUsd: Number(product.priceUsd ?? product.priceNow ?? 0),
    priceMlUsd: Number(product.priceMlUsd ?? product.priceML ?? product.priceMl ?? 0),
    note: product.note || "",
    properties: product.properties && typeof product.properties === "object" ? product.properties : {},
    publishedAt: product.publishedAt || new Date().toISOString(),
    isSold: !!product.isSold,
  };
}

function publicSettings(settings) {
  const copy = { ...(settings || {}) };
  delete copy.adminPassword;
  return copy;
}


function getDefaultPaymentMethods(cvuAccount) {
  return [
    {
      id: "mp-ars",
      name: "Mercado Pago / Transferencia ARS (CVU)",
      enabled: true,
      account: cvuAccount || "0000003100359754352113",
    },
    { id: "paypal", name: "PayPal", enabled: false, account: "" },
    { id: "usd-bank", name: "Cuenta bancaria USD (EE.UU.)", enabled: false, account: "" },
    { id: "usdt", name: "USDT", enabled: false, account: "" },
    { id: "bitcoin", name: "Bitcoin", enabled: false, account: "" },
  ];
}

function normalizePaymentMethods(settings) {
  const cvu = settings?.transferCvu || "0000003100359754352113";
  const defaults = getDefaultPaymentMethods(cvu);
  const raw = settings?.paymentMethods;

  if (!Array.isArray(raw) || !raw.length) {
    return defaults;
  }

  return defaults.map((template) => {
    const saved = raw.find((item) => item.id === template.id);
    if (!saved) return template;
    return {
      id: template.id,
      name: template.name,
      enabled: saved.enabled === true,
      account: String(saved.account || "").trim(),
    };
  });
}

function syncTransferCvu(settings) {
  const mpArs = (settings.paymentMethods || []).find((m) => m.id === "mp-ars");
  if (mpArs?.account) {
    settings.transferCvu = mpArs.account;
  }
  return settings;
}

function getEnabledPaymentMethods(settings) {
  return normalizePaymentMethods(settings).filter((method) => method.enabled && method.account.trim());
}

function validateProduct(product, catalog) {
  const errors = [];
  const title = String(product?.title || "").trim();
  const condition = String(product?.condition || "").trim();
  const priceUsd = Number(product?.priceUsd);
  const priceMlUsd = Number(product?.priceMlUsd);
  const images = getProductImages(product);
  const category = getCategoryById(catalog, product?.categoryId);

  if (!title) errors.push("Falta el título.");
  if (!product?.categoryId) errors.push("Falta elegir una categoría.");
  else if (!category) errors.push("La categoría seleccionada ya no existe.");
  if (!condition) errors.push("Falta el estado (badge).");
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) errors.push("El precio USD debe ser mayor a 0.");
  if (!Number.isFinite(priceMlUsd) || priceMlUsd < 0) {
    errors.push("La referencia de Mercado Libre (USD) debe ser 0 o mayor.");
  }
  const realImages = images.filter((src) => src && src !== IMAGE_FALLBACK);
  if (!realImages.length) errors.push("Falta al menos una imagen.");

  (category?.propertyFields || []).forEach((field) => {
    const value = product?.properties?.[field];
    if (!value || !String(value).trim()) {
      errors.push(`Falta la propiedad «${field}».`);
    }
  });

  return errors;
}

function validateCatalog(catalog) {
  const errors = [];
  const settings = catalog?.settings || {};
  const storeName = String(settings.storeName || "").trim();
  const whatsapp = normalizePhone(settings.whatsappPhone);
  const rate = Number(settings.usdToArsRate);
  const paymentMethods = normalizePaymentMethods(settings);
  const enabledPayments = paymentMethods.filter((m) => m.enabled);

  if (!storeName) errors.push("Configuración: falta el nombre de la tienda.");
  if (!whatsapp) errors.push("Configuración: falta el WhatsApp.");
  if (!Number.isFinite(rate) || rate <= 0) errors.push("Configuración: la cotización USD → ARS debe ser mayor a 0.");

  if (!enabledPayments.length) {
    errors.push("Configuración: activá al menos un método de pago.");
  }

  enabledPayments.forEach((method) => {
    if (!method.account.trim()) {
      errors.push(`Configuración: falta la cuenta o wallet de «${method.name}».`);
    }
  });

  if (!catalog?.categories?.length) {
    errors.push("Necesitás al menos una categoría.");
  }

  if (!catalog?.products?.length) {
    errors.push("No hay productos para publicar.");
  }

  (catalog?.products || []).forEach((product, index) => {
    const productErrors = validateProduct(product, catalog);
    productErrors.forEach((msg) => {
      const label = product.title?.trim() || `Producto ${index + 1}`;
      errors.push(`${label}: ${msg}`);
    });
  });

  return errors;
}

function estimateCatalogBytes(catalog) {
  try {
    return new Blob([JSON.stringify(sanitizeCatalog(catalog))]).size;
  } catch {
    return 0;
  }
}

function getAdminPassword() {
  const stored = localStorage.getItem(ADMIN_PW_KEY);
  if (stored) return stored;

  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "{}");
    if (legacy.settings?.adminPassword) {
      localStorage.setItem(ADMIN_PW_KEY, legacy.settings.adminPassword);
      return legacy.settings.adminPassword;
    }
  } catch {
    /* ignore */
  }

  return DEFAULT_ADMIN_PASSWORD;
}

function setAdminPassword(password) {
  localStorage.setItem(ADMIN_PW_KEY, password);
}

function resetAdminPasswordToDefault() {
  localStorage.removeItem(ADMIN_PW_KEY);

  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "{}");
    if (legacy.settings?.adminPassword) {
      delete legacy.settings.adminPassword;
      localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy));
    }
  } catch {
    /* ignore */
  }

  setAdminPassword(DEFAULT_ADMIN_PASSWORD);
}

async function requestPasswordReset() {
  const res = await fetch("/api/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "No se pudo solicitar el restablecimiento.");
  }
  return data;
}

async function confirmPasswordReset(token) {
  const res = await fetch(`/api/confirm-reset?token=${encodeURIComponent(token)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Enlace inválido o expirado.");
  }
  resetAdminPasswordToDefault();
  return data;
}

function normalizeCatalog(raw) {
  const base = getDefaultCatalog();
  if (!raw || typeof raw !== "object") return base;

  const categories =
    Array.isArray(raw.categories) && raw.categories.length
      ? raw.categories
      : base.categories;

  const defaultCategoryId = categories[0]?.id || "cat-general";

  const products = (Array.isArray(raw.products) ? raw.products : base.products).map((p) =>
    migrateProduct(p, defaultCategoryId)
  );

  const mergedSettings = syncTransferCvu({
    ...base.settings,
    ...publicSettings(raw.settings),
    paymentMethods: normalizePaymentMethods({ ...base.settings, ...raw.settings }),
  });

  return {
    version: 1,
    settings: mergedSettings,
    categories,
    products: products.length ? products : base.products,
  };
}

function sanitizeCatalog(catalog) {
  return {
    ...catalog,
    settings: publicSettings(catalog.settings),
  };
}

function catalogFingerprint(catalog) {
  const copy = sanitizeCatalog(catalog);
  delete copy.publishedAt;
  return JSON.stringify(copy);
}

function readDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return normalizeCatalog(JSON.parse(raw));
  } catch {
    return null;
  }
}

function readPublished() {
  try {
    const raw = localStorage.getItem(PUBLISHED_KEY);
    if (!raw) return null;
    return normalizeCatalog(JSON.parse(raw));
  } catch {
    return null;
  }
}

function saveDraft(catalog) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(sanitizeCatalog(catalog)));
  } catch (err) {
    const quotaError = err?.name === "QuotaExceededError";
    const sizeMb = (estimateCatalogBytes(catalog) / (1024 * 1024)).toFixed(1);
    const message = quotaError
      ? `No hay espacio suficiente en el navegador (${sizeMb} MB). Reducí el tamaño de las imágenes o publicá desde el servidor local.`
      : "No se pudo guardar el borrador en este navegador.";
    const error = new Error(message);
    error.code = quotaError ? "QUOTA_EXCEEDED" : "SAVE_FAILED";
    throw error;
  }
}

async function savePublished(catalog, { download = false } = {}) {
  const published = {
    ...sanitizeCatalog(catalog),
    publishedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(PUBLISHED_KEY, JSON.stringify(published));
  } catch (err) {
    console.warn("No se pudo guardar la versión publicada en LocalStorage:", err);
    if (download) {
      await exportCatalogFile(published);
    } else if (err?.name !== "QuotaExceededError") {
      throw err;
    }
    // Si es QuotaExceededError y no estamos forzando descarga, 
    // lo ignoramos para permitir que el proceso siga hacia la API de Vercel/GitHub
  }
  if (download) await exportCatalogFile(published);
  return published;
}

async function publishCatalog(catalog) {
  const validationErrors = validateCatalog(catalog);
  if (validationErrors.length) {
    const error = new Error(validationErrors.join("\n"));
    error.code = "VALIDATION_FAILED";
    error.validationErrors = validationErrors;
    throw error;
  }

  const published = await savePublished(catalog, { download: false });

  if (window.location.protocol.startsWith("http")) {
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(published),
      });
      
      const result = await res.json();
      
      if (res.ok && result.success) {
        return { method: "api", url: result.url || window.location.origin, message: result.message };
      } else {
        throw new Error(result.error || "No se pudo guardar remotamente.");
      }
    } catch (err) {
      console.warn("Could not publish via local server API, falling back to download:", err);
      alert("Error en la sincronización remota: " + err.message + "\n\nSe descargará una copia de respaldo.");
    }
  }

  await exportCatalogFile(published);
  return { method: "download" };
}

function hasUnpublishedChanges() {
  const draft = readDraft();
  if (!draft) return false;
  const published = readPublished();
  if (!published) return true;
  return catalogFingerprint(draft) !== catalogFingerprint(published);
}

function getLastPublishedLabel() {
  const published = readPublished();
  if (!published?.publishedAt) return null;
  try {
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(published.publishedAt));
  } catch {
    return published.publishedAt;
  }
}

function migrateLegacyStorage() {
  const legacyRaw = localStorage.getItem(LEGACY_KEY);
  if (!legacyRaw) return;

  try {
    const legacy = normalizeCatalog(JSON.parse(legacyRaw));
    if (!readDraft()) saveDraft(legacy);
    if (!readPublished()) savePublished(legacy, { download: false });
  } catch {
    /* ignore */
  }

  localStorage.removeItem(LEGACY_KEY);
}

function readEmbeddedCatalogFile() {
  if (window.GARAGE_CATALOG_FILE && typeof window.GARAGE_CATALOG_FILE === "object") {
    return normalizeCatalog(window.GARAGE_CATALOG_FILE);
  }
  return null;
}

function catalogScore(catalog) {
  if (!catalog) return -1;
  const productScore = (catalog.products?.length || 0) * 100;
  const categoryScore = catalog.categories?.length || 0;
  const timeScore = catalog.publishedAt ? Date.parse(catalog.publishedAt) / 1e12 : 0;
  return productScore + categoryScore + timeScore;
}

function pickBestCatalog(candidates) {
  const valid = candidates.filter(Boolean);
  if (!valid.length) return getDefaultCatalog();
  valid.sort((a, b) => catalogScore(b) - catalogScore(a));
  return valid[0];
}

async function fetchCatalogFile() {
  try {
    const res = await fetch(`catalog.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return normalizeCatalog(await res.json());
  } catch {
    return readEmbeddedCatalogFile();
  }
}

async function loadCatalogForAdmin() {
  migrateLegacyStorage();

  const draft = readDraft();
  if (draft) return draft;

  const published = readPublished();
  if (published) {
    saveDraft(published);
    return published;
  }

  const embedded = readEmbeddedCatalogFile();
  if (embedded) {
    saveDraft(embedded);
    return embedded;
  }

  const fromFile = await fetchCatalogFile();
  if (fromFile) {
    saveDraft(fromFile);
    return fromFile;
  }

  const defaults = getDefaultCatalog();
  saveDraft(defaults);
  return defaults;
}

async function loadCatalogForPublic() {
  migrateLegacyStorage();

  const published = readPublished();
  const embedded = readEmbeddedCatalogFile();
  const fromFile = await fetchCatalogFile();

  return pickBestCatalog([published, fromFile, embedded]);
}

/** @deprecated use saveDraft */
function saveCatalog(catalog) {
  saveDraft(catalog);
}

/** @deprecated use loadCatalogForPublic */
async function loadCatalog() {
  return loadCatalogForPublic();
}

function getCatalogSync() {
  return readDraft() || readPublished() || getDefaultCatalog();
}

function formatUsd(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatArs(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPesosLabel(value) {
  const num = Math.round(Number(value));
  const formatted = new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(num);
  return `Pesos (${formatted})`;
}

function usdToArs(usd, rate) {
  return Math.round(Number(usd) * Number(rate));
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function buildWhatsAppUrl(phone, message) {
  const digits = normalizePhone(phone);
  const base = `https://wa.me/${digits}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function getCategoryById(catalog, categoryId) {
  return catalog.categories.find((c) => c.id === categoryId) || null;
}

function sortedCategories(catalog) {
  return [...catalog.categories].sort((a, b) => a.order - b.order);
}

function isAdminSessionValid() {
  return sessionStorage.getItem(SESSION_KEY) === "1";
}

function setAdminSession(valid) {
  if (valid) sessionStorage.setItem(SESSION_KEY, "1");
  else sessionStorage.removeItem(SESSION_KEY);
}

function verifyAdminPassword(_catalog, password) {
  return getAdminPassword() === password;
}

function downloadTextFile(filename, content, mimeType) {
  return new Promise((resolve) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    window.setTimeout(resolve, 350);
  });
}

async function exportCatalogFile(catalog) {
  const safe = {
    ...catalog,
    settings: publicSettings(catalog.settings),
  };

  await downloadTextFile("catalog.json", JSON.stringify(safe, null, 2), "application/json");
  const jsContent = `window.GARAGE_CATALOG_FILE = ${JSON.stringify(safe, null, 2)};\n`;
  await downloadTextFile("catalog.js", jsContent, "text/javascript");
}

function importCatalogFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = normalizeCatalog(JSON.parse(reader.result));
        saveDraft(imported);
        resolve(imported);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readImageFiles(files) {
  return Promise.all([...files].map((file) => readImageFile(file)));
}

window.GarageStore = {
  DRAFT_KEY,
  PUBLISHED_KEY,
  SESSION_KEY,
  IMAGE_FALLBACK,
  slugify,
  uid,
  getDefaultCatalog,
  loadCatalog,
  loadCatalogForAdmin,
  loadCatalogForPublic,
  getCatalogSync,
  saveDraft,
  saveCatalog,
  publishCatalog,
  hasUnpublishedChanges,
  getLastPublishedLabel,
  normalizeCatalog,
  validateProduct,
  validateCatalog,
  getDefaultPaymentMethods,
  normalizePaymentMethods,
  getEnabledPaymentMethods,
  estimateCatalogBytes,
  formatUsd,
  formatArs,
  formatPesosLabel,
  usdToArs,
  buildWhatsAppUrl,
  escapeHtml,
  getCategoryById,
  sortedCategories,
  isAdminSessionValid,
  setAdminSession,
  verifyAdminPassword,
  getAdminPassword,
  setAdminPassword,
  resetAdminPasswordToDefault,
  requestPasswordReset,
  confirmPasswordReset,
  DEFAULT_ADMIN_PASSWORD,
  ADMIN_RESET_EMAIL,
  exportCatalogFile,
  importCatalogFromFile,
  getProductImages,
  readImageFile,
  readImageFiles,
};
