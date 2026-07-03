const S = window.GarageStore;

let catalog = null;

function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    el.hidden = true;
  }, 2600);
}

let lastPersistError = null;

function persist() {
  try {
    S.saveDraft(catalog);
    updatePublishStatus();
    lastPersistError = null;
    return true;
  } catch (err) {
    lastPersistError = err;
    showToast(err.message || "No se pudo guardar el borrador.");
    return false;
  }
}

function showProductSaveError(err) {
  const errors = [
    "No se pudo guardar el producto.",
    err?.message || "Hubo un problema al escribir en el navegador.",
  ];
  showProductFormErrors(errors);
}

function showValidationDialog(errors) {
  const dialog = document.getElementById("validation-dialog");
  const list = document.getElementById("validation-list");
  if (!dialog || !list) {
    alert(errors.join("\n"));
    return;
  }
  list.innerHTML = errors.map((msg) => `<li>${S.escapeHtml(msg)}</li>`).join("");
  dialog.showModal();
}

function updatePublishStatus() {
  const badge = document.getElementById("publish-badge");
  const status = document.getElementById("publish-status");
  const pending = S.hasUnpublishedChanges();
  const last = S.getLastPublishedLabel();

  if (badge) badge.hidden = !pending;

  if (status) {
    if (pending) {
      status.textContent = "Tenés cambios guardados como borrador. Publicá para que aparezcan en index.html.";
      status.classList.add("is-pending");
    } else if (last) {
      status.textContent = `Última publicación: ${last}. La tienda está actualizada.`;
      status.classList.remove("is-pending");
    } else {
      status.textContent = "Todavía no publicaste. Cuando termines de editar, usá «Publicar en producción».";
      status.classList.add("is-pending");
    }
  }
}

async function handlePublish() {
  const btn = document.getElementById("publish-btn");
  const validationErrors = S.validateCatalog(catalog);
  if (validationErrors.length) {
    showValidationDialog(validationErrors);
    return;
  }

  try {
    btn.disabled = true;
    btn.textContent = "Publicando…";
    const result = await S.publishCatalog(catalog);
    updatePublishStatus();

    const modalBody = document.querySelector("#publish-dialog .modal__body");
    const modalTitle = document.querySelector("#publish-dialog h3");

    if (result && result.method === "api") {
      if (modalTitle) modalTitle.textContent = "¡Publicado con éxito!";
      if (modalBody) {
        modalBody.innerHTML = `
          <div style="padding: 10px 0; text-align: center;">
            <div style="font-size: 3rem; margin-bottom: 15px;">🚀</div>
            <p style="font-size: 1.1rem; font-weight: 600; color: #0d9488; margin-bottom: 12px;">
              ¡Tu catálogo se ha actualizado en vivo!
            </p>
            <p>Se compilaron los archivos y se actualizaron de forma automática en tu servidor de producción.</p>
            <p style="margin: 24px 0 16px;">
              <a href="${result.url}" target="_blank" rel="noopener" class="btn btn--primary" style="display: inline-flex; width: auto; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; background: #2563eb; color: #ffffff;">
                Visitar Tienda en Producción
              </a>
            </p>
            <p class="hint">URL principal: <code>${result.url}</code></p>
            <p class="hint" style="margin-top: 8px; font-size: 0.8rem; color: #8e8e93;">No requieres copiar ningún archivo localmente.</p>
          </div>
        `;
      }
      
      // Update open button link to production
      const openBtn = document.getElementById("open-store-btn");
      if (openBtn) {
        // Change text to show it's opening the production site
        openBtn.textContent = "Ver Tienda Online";
        // Temporarily replace event listener or set href if it was an anchor,
        // but it's a button. Let's make it open the result.url.
        openBtn.onclick = (e) => {
          e.preventDefault();
          window.open(result.url, "_blank");
          document.getElementById("publish-dialog")?.close();
        };
      }
      
      showPublishDialog();
    } else {
      if (modalTitle) modalTitle.textContent = "Publicación lista";
      if (modalBody) {
        modalBody.innerHTML = `
          <p>Se descargaron <strong>2 archivos</strong> en tu carpeta <strong>Descargas</strong>:</p>
          <ol class="publish-steps">
            <li><code>catalog.json</code></li>
            <li><code>catalog.js</code></li>
          </ol>
          <p>Ahora copiá <strong>los dos</strong> a esta carpeta (reemplazando los que ya existen):</p>
          <p class="publish-path"><code>C:\\Users\\everth\\.cursor\\projects\\empty-window\\used-store</code></p>
          <p class="hint">Si solo ves <code>catalog.json</code>, revisá Descargas: a veces el navegador pide confirmación para el segundo archivo.</p>
          <p>Por último, abrí <code>index.html</code> y apretá <strong>Ctrl + F5</strong>.</p>
        `;
      }
      
      const openBtn = document.getElementById("open-store-btn");
      if (openBtn) {
        openBtn.textContent = "Abrir tienda";
        openBtn.onclick = null; // restore default click behavior
      }
      
      showPublishDialog();
    }
  } catch (err) {
    console.error(err);
    if (err.code === "VALIDATION_FAILED" && err.validationErrors?.length) {
      showValidationDialog(err.validationErrors);
    } else if (err.code === "QUOTA_EXCEEDED") {
      showValidationDialog([
        err.message,
        "Tip: comprimí las fotos antes de subirlas o publicá usando node server.js en localhost.",
      ]);
    } else {
      alert(
        err.message ||
          "No se pudo guardar la publicación (tal vez la foto es muy pesada). Probá con imágenes más chicas o en formato JPG."
      );
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "Publicar en producción";
  }
}

function showPublishDialog() {
  const dialog = document.getElementById("publish-dialog");
  if (!dialog) return;
  dialog.showModal();
}

function showAdmin() {
  document.getElementById("login-view").hidden = true;
  document.getElementById("admin-view").hidden = false;
  renderAll();
}

function showLogin() {
  S.setAdminSession(false);
  document.getElementById("login-view").hidden = false;
  document.getElementById("admin-view").hidden = true;
}

function showLoginResetMessage(text, type) {
  const msg = document.getElementById("login-reset-msg");
  if (!msg) return;
  msg.hidden = false;
  msg.className = `login-reset-msg is-${type}`;
  msg.textContent = text;
}

async function handleResetTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("resetToken");
  if (!token) return;

  try {
    await S.confirmPasswordReset(token);
    showLogin();
    showLoginResetMessage(
      `Contraseña restablecida a «${S.DEFAULT_ADMIN_PASSWORD}». Ya podés iniciar sesión.`,
      "success"
    );
    window.history.replaceState({}, "", window.location.pathname);
  } catch (err) {
    showLogin();
    showLoginResetMessage(err.message || "No se pudo restablecer la contraseña.", "error");
    window.history.replaceState({}, "", window.location.pathname);
  }
}

async function handlePasswordResetRequest() {
  const btn = document.getElementById("reset-password-btn");
  if (!btn) return;

  btn.disabled = true;
  btn.textContent = "Enviando…";

  try {
    const result = await S.requestPasswordReset();
    showLoginResetMessage(result.message, "success");
  } catch (err) {
    showLoginResetMessage(err.message || "No se pudo enviar el correo. Intentá más tarde.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Restablecer contraseña por email";
  }
}

async function init() {
  catalog = await S.loadCatalogForAdmin();
  await handleResetTokenFromUrl();
  if (S.isAdminSessionValid()) showAdmin();
  else showLogin();
}

document.getElementById("login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const pass = document.getElementById("login-password").value;
  if (S.verifyAdminPassword(catalog, pass)) {
    S.setAdminSession(true);
    document.getElementById("login-error").hidden = true;
    showAdmin();
  } else {
    document.getElementById("login-error").hidden = false;
  }
});

document.getElementById("reset-password-btn")?.addEventListener("click", handlePasswordResetRequest);

document.getElementById("logout-btn").addEventListener("click", showLogin);

document.getElementById("publish-btn").addEventListener("click", handlePublish);

document.getElementById("preview-btn").addEventListener("click", () => {
  window.open("index.html", "_blank");
});

document.querySelectorAll("[data-close-publish]").forEach((btn) => {
  btn.addEventListener("click", () => document.getElementById("publish-dialog")?.close());
});

document.querySelectorAll("[data-close-validation]").forEach((btn) => {
  btn.addEventListener("click", () => document.getElementById("validation-dialog")?.close());
});

document.getElementById("open-store-btn")?.addEventListener("click", () => {
  window.open("index.html", "_blank");
  document.getElementById("publish-dialog")?.close();
});

document.querySelectorAll(".admin-nav__btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".admin-nav__btn").forEach((b) => b.classList.remove("is-active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("is-active"));
    btn.classList.add("is-active");
    document.getElementById(`panel-${btn.dataset.panel}`).classList.add("is-active");
  });
});

document.querySelectorAll("[data-close-modal]").forEach((btn) => {
  btn.addEventListener("click", () => btn.closest("dialog")?.close());
});

function renderAll() {
  renderProductsTable();
  renderCategoriesList();
  renderSettingsForm();
  updatePublishStatus();
}

function renderProductsTable() {
  const tbody = document.querySelector("#products-table tbody");
  const rate = catalog.settings.usdToArsRate;

  if (!catalog.products.length) {
    tbody.innerHTML = `<tr><td colspan="5">No hay productos. Creá el primero.</td></tr>`;
    return;
  }

  tbody.innerHTML = catalog.products
    .map((p) => {
      const cat = S.getCategoryById(catalog, p.categoryId);
      const ars = S.usdToArs(p.priceUsd, rate);
      return `
        <tr>
          <td><strong>${S.escapeHtml(p.title)}</strong><br><small>${S.escapeHtml(p.condition)}</small></td>
          <td>${cat ? S.escapeHtml(cat.name) : "—"}</td>
          <td>${S.formatUsd(p.priceUsd)}</td>
          <td>${S.formatArs(ars)}</td>
          <td>
            <div class="row-actions">
              <button type="button" class="btn btn--ghost btn--sm" data-edit-product="${p.id}">Editar</button>
              <button type="button" class="btn btn--ghost btn--sm btn--danger" data-delete-product="${p.id}">Borrar</button>
            </div>
          </td>
        </tr>`;
    })
    .join("");

  tbody.querySelectorAll("[data-edit-product]").forEach((btn) => {
    btn.addEventListener("click", () => openProductModal(btn.dataset.editProduct));
  });
  tbody.querySelectorAll("[data-delete-product]").forEach((btn) => {
    btn.addEventListener("click", () => deleteProduct(btn.dataset.deleteProduct));
  });
}

function deleteProduct(id) {
  if (!confirm("¿Eliminar este producto?")) return;
  catalog.products = catalog.products.filter((p) => p.id !== id);
  persist();
  renderProductsTable();
  showToast("Producto eliminado");
}

function renderCategoriesList() {
  const list = document.getElementById("categories-list");
  const cats = S.sortedCategories(catalog);

  if (!cats.length) {
    list.innerHTML = `<p class="hint">No hay categorías. Creá una para clasificar productos.</p>`;
    return;
  }

  list.innerHTML = cats
    .map((cat) => {
      const count = catalog.products.filter((p) => p.categoryId === cat.id).length;
      const tags = (cat.propertyFields || [])
        .map((f) => `<span class="tag">${S.escapeHtml(f)}</span>`)
        .join("");
      return `
        <article class="cat-card">
          <div class="cat-card__head">
            <h3>${S.escapeHtml(cat.name)}</h3>
            <div class="row-actions">
              <button type="button" class="btn btn--ghost btn--sm" data-edit-category="${cat.id}">Editar</button>
              <button type="button" class="btn btn--ghost btn--sm btn--danger" data-delete-category="${cat.id}">Borrar</button>
            </div>
          </div>
          <p class="cat-card__meta">Orden ${cat.order} · ${count} producto(s)</p>
          <div class="cat-card__tags">${tags || '<span class="tag">Sin campos</span>'}</div>
        </article>`;
    })
    .join("");

  list.querySelectorAll("[data-edit-category]").forEach((btn) => {
    btn.addEventListener("click", () => openCategoryModal(btn.dataset.editCategory));
  });
  list.querySelectorAll("[data-delete-category]").forEach((btn) => {
    btn.addEventListener("click", () => deleteCategory(btn.dataset.deleteCategory));
  });
}

function deleteCategory(id) {
  const inUse = catalog.products.some((p) => p.categoryId === id);
  if (inUse) {
    alert("No podés borrar una categoría que tiene productos. Reasigná o eliminá esos productos primero.");
    return;
  }
  if (!confirm("¿Eliminar esta categoría?")) return;
  catalog.categories = catalog.categories.filter((c) => c.id !== id);
  persist();
  renderCategoriesList();
  showToast("Categoría eliminada");
}

function renderSettingsForm() {
  const s = catalog.settings;
  document.getElementById("set-store-name").value = s.storeName;
  document.getElementById("set-whatsapp").value = s.whatsappPhone;
  document.getElementById("set-fx-rate").value = s.usdToArsRate;
  document.getElementById("set-password").value = "";
  renderPaymentMethodsForm();
  updateFxPreview();
}

function renderPaymentMethodsForm() {
  const container = document.getElementById("payment-methods-list");
  if (!container) return;

  const methods = S.normalizePaymentMethods(catalog.settings);
  container.innerHTML = methods
    .map(
      (method) => `
      <label class="payment-method-row">
        <input type="checkbox" class="payment-method-enabled" data-payment-id="${method.id}" ${
          method.enabled ? "checked" : ""
        } />
        <span class="payment-method-row__body">
          <strong>${S.escapeHtml(method.name)}</strong>
          <input
            type="text"
            class="payment-method-account"
            data-payment-id="${method.id}"
            placeholder="Cuenta, wallet, CVU o alias"
            value="${S.escapeHtml(method.account)}"
          />
        </span>
      </label>`
    )
    .join("");
}

function collectPaymentMethodsFromForm() {
  return S.normalizePaymentMethods(catalog.settings).map((method) => {
    const enabled = document.querySelector(
      `.payment-method-enabled[data-payment-id="${method.id}"]`
    )?.checked;
    const account =
      document
        .querySelector(`.payment-method-account[data-payment-id="${method.id}"]`)
        ?.value.trim() || "";
    return { ...method, enabled: Boolean(enabled), account };
  });
}

function updateFxPreview() {
  const rate = Number(document.getElementById("set-fx-rate").value) || catalog.settings.usdToArsRate;
  document.getElementById("fx-preview").textContent = S.formatArs(S.usdToArs(150, rate));
}

document.getElementById("set-fx-rate").addEventListener("input", updateFxPreview);

document.getElementById("settings-form").addEventListener("submit", (e) => {
  e.preventDefault();
  catalog.settings.storeName = document.getElementById("set-store-name").value.trim();
  catalog.settings.whatsappPhone = S.normalizePhone(document.getElementById("set-whatsapp").value);
  catalog.settings.usdToArsRate = Number(document.getElementById("set-fx-rate").value);
  catalog.settings.paymentMethods = collectPaymentMethodsFromForm();
  const mpArs = catalog.settings.paymentMethods.find((method) => method.id === "mp-ars");
  catalog.settings.transferCvu = mpArs?.account || catalog.settings.transferCvu || "";
  const newPass = document.getElementById("set-password").value;
  if (newPass) S.setAdminPassword(newPass);
  if (!persist()) return;
  showToast("Configuración guardada (borrador)");
});

document.getElementById("export-btn").addEventListener("click", async () => {
  await S.exportCatalogFile(catalog);
  showPublishDialog();
});

document.getElementById("import-file").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    catalog = await S.importCatalogFromFile(file);
    renderAll();
    showToast("Importado como borrador. Publicá para ver en la tienda.");
  } catch {
    alert("No se pudo leer el archivo JSON.");
  }
  e.target.value = "";
});

/* --- Product modal --- */

let modalImages = [];

function renderImageGallery() {
  const gallery = document.getElementById("product-image-gallery");
  if (!gallery) return;

  if (!modalImages.length) {
    gallery.innerHTML = `<p class="hint">Todavía no hay imágenes. Seleccioná una o varias arriba.</p>`;
    return;
  }

  gallery.innerHTML = modalImages
    .map(
      (src, index) => `
      <div class="image-gallery__item ${index === 0 ? "is-cover" : ""}">
        <img src="${src}" alt="Imagen ${index + 1}" />
        ${index === 0 ? `<span class="image-gallery__badge">Portada</span>` : ""}
        <div class="image-gallery__actions">
          ${
            index !== 0
              ? `<button type="button" class="btn btn--ghost btn--sm" data-set-cover="${index}">Portada</button>`
              : ""
          }
          <button type="button" class="btn btn--ghost btn--sm" data-move-left="${index}" ${index === 0 ? "disabled" : ""}>←</button>
          <button type="button" class="btn btn--ghost btn--sm" data-move-right="${index}" ${
            index === modalImages.length - 1 ? "disabled" : ""
          }>→</button>
          <button type="button" class="btn btn--ghost btn--sm btn--danger" data-remove-image="${index}">×</button>
        </div>
      </div>`
    )
    .join("");

  gallery.querySelectorAll("[data-set-cover]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.setCover);
      const [img] = modalImages.splice(i, 1);
      modalImages.unshift(img);
      renderImageGallery();
    });
  });

  gallery.querySelectorAll("[data-move-left]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.moveLeft);
      if (i <= 0) return;
      [modalImages[i - 1], modalImages[i]] = [modalImages[i], modalImages[i - 1]];
      renderImageGallery();
    });
  });

  gallery.querySelectorAll("[data-move-right]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.moveRight);
      if (i >= modalImages.length - 1) return;
      [modalImages[i + 1], modalImages[i]] = [modalImages[i], modalImages[i + 1]];
      renderImageGallery();
    });
  });

  gallery.querySelectorAll("[data-remove-image]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.removeImage);
      modalImages.splice(i, 1);
      renderImageGallery();
    });
  });
}

function collectModalImages() {
  return modalImages.filter(Boolean);
}

function fillCategorySelect(selectedId) {
  const select = document.getElementById("product-category");
  select.innerHTML = S.sortedCategories(catalog)
    .map(
      (c) =>
        `<option value="${c.id}" ${c.id === selectedId ? "selected" : ""}>${S.escapeHtml(c.name)}</option>`
    )
    .join("");
}

function renderPropertyFields(categoryId, existingProps = {}) {
  const container = document.getElementById("product-properties");
  container.innerHTML = "";
  const cat = S.getCategoryById(catalog, categoryId);
  const fieldNames = [...(cat?.propertyFields || [])];

  Object.keys(existingProps).forEach((key) => {
    if (!fieldNames.includes(key)) fieldNames.push(key);
  });

  fieldNames.forEach((name) => addPropertyRow(name, existingProps[name] || ""));
}

function addPropertyRow(name = "", value = "") {
  const container = document.getElementById("product-properties");
  const row = document.createElement("div");
  row.className = "prop-row";
  row.innerHTML = `
    <input type="text" class="prop-name" placeholder="Nombre (ej. Resolución)" value="${S.escapeHtml(name)}" />
    <input type="text" class="prop-value" placeholder="Valor" value="${S.escapeHtml(value)}" />
    <button type="button" class="btn btn--ghost btn--sm btn--danger prop-remove">×</button>`;
  row.querySelector(".prop-remove").addEventListener("click", () => row.remove());
  container.appendChild(row);
}

document.getElementById("add-property-btn").addEventListener("click", () => addPropertyRow());

document.getElementById("product-category").addEventListener("change", (e) => {
  const current = collectProperties();
  renderPropertyFields(e.target.value, current);
});

function collectProperties() {
  const props = {};
  document.querySelectorAll("#product-properties .prop-row").forEach((row) => {
    const name = row.querySelector(".prop-name").value.trim();
    const value = row.querySelector(".prop-value").value.trim();
    if (name && value) props[name] = value;
  });
  return props;
}

function buildProductPayloadFromForm() {
  const id = document.getElementById("product-id").value || S.uid("prod");
  const images = collectModalImages();
  return {
    id,
    categoryId: document.getElementById("product-category").value,
    title: document.getElementById("product-title").value.trim(),
    condition: document.getElementById("product-condition").value.trim(),
    priceUsd: Number(document.getElementById("product-price-usd").value),
    priceMlUsd: Number(document.getElementById("product-price-ml").value),
    note: document.getElementById("product-note").value.trim(),
    images: images.length ? images : [S.IMAGE_FALLBACK],
    image: images[0] || S.IMAGE_FALLBACK,
    properties: collectProperties(),
  };
}

function showProductFormErrors(errors) {
  const box = document.getElementById("product-form-errors");
  if (!box) return;
  if (!errors.length) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  box.hidden = false;
  box.innerHTML = `
    <strong>Completá lo siguiente para guardar:</strong>
    <ul>${errors.map((msg) => `<li>${S.escapeHtml(msg)}</li>`).join("")}</ul>
  `;
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function markInvalidProductFields(errors) {
  document
    .querySelectorAll("#product-form .field input, #product-form .field select, #product-form .field textarea, #product-properties .prop-value")
    .forEach((el) => el.classList.remove("is-invalid"));

  errors.forEach((msg) => {
    if (msg.includes("título")) document.getElementById("product-title")?.classList.add("is-invalid");
    if (msg.includes("categoría") || msg.includes("categoria")) {
      document.getElementById("product-category")?.classList.add("is-invalid");
    }
    if (msg.includes("estado")) document.getElementById("product-condition")?.classList.add("is-invalid");
    if (msg.includes("precio USD")) document.getElementById("product-price-usd")?.classList.add("is-invalid");
    if (msg.includes("Mercado Libre")) document.getElementById("product-price-ml")?.classList.add("is-invalid");
    if (msg.includes("imagen")) document.getElementById("product-image-file")?.classList.add("is-invalid");

    const propMatch = msg.match(/«([^»]+)»/);
    if (propMatch) {
      document.querySelectorAll("#product-properties .prop-row").forEach((row) => {
        if (row.querySelector(".prop-name")?.value.trim() === propMatch[1]) {
          row.querySelector(".prop-value")?.classList.add("is-invalid");
        }
      });
    }
  });
}

function openProductModal(productId = null) {
  const modal = document.getElementById("product-modal");
  const product = productId ? catalog.products.find((p) => p.id === productId) : null;

  document.getElementById("product-modal-title").textContent = product ? "Editar producto" : "Nuevo producto";
  document.getElementById("product-id").value = product?.id || "";
  document.getElementById("product-title").value = product?.title || "";
  document.getElementById("product-condition").value = product?.condition || "Usado";
  document.getElementById("product-price-usd").value = product?.priceUsd ?? "";
  document.getElementById("product-price-ml").value = product?.priceMlUsd ?? "";
  document.getElementById("product-note").value = product?.note || "";
  document.getElementById("product-image-file").value = "";
  showProductFormErrors([]);

  modalImages = product ? [...S.getProductImages(product)] : [];

  const defaultCat = product?.categoryId || S.sortedCategories(catalog)[0]?.id || "";
  fillCategorySelect(defaultCat);
  renderPropertyFields(defaultCat, product?.properties || {});

  renderImageGallery();

  modal.showModal();
}

document.getElementById("new-product-btn").addEventListener("click", () => openProductModal());

document.getElementById("product-image-file").addEventListener("change", async (e) => {
  const files = e.target.files;
  if (!files?.length) return;
  const dataUrls = await S.readImageFiles(files);
  modalImages.push(...dataUrls);
  renderImageGallery();
  e.target.value = "";
});

document.getElementById("add-image-url-btn").addEventListener("click", () => {
  const urlInput = document.getElementById("product-image-url");
  const url = urlInput.value.trim();

  if (!url) {
    showToast("Ingresá una URL de imagen.");
    return;
  }
  if (!isValidImageUrl(url)) {
    showToast("Ingresá una URL válida que comience con http:// o https://.");
    return;
  }

  modalImages.push(url);
  renderImageGallery();
  urlInput.value = "";
});

function isValidImageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

document.getElementById("product-form").addEventListener("submit", (e) => {
  e.preventDefault();

  const payload = buildProductPayloadFromForm();
  const errors = S.validateProduct(payload, catalog);
  if (errors.length) {
    showProductFormErrors(errors);
    markInvalidProductFields(errors);
    showToast("Revisá los campos marcados antes de guardar.");
    return;
  }

  showProductFormErrors([]);

  const idx = catalog.products.findIndex((p) => p.id === payload.id);
  const previousProduct = idx >= 0 ? { ...catalog.products[idx] } : null;

  if (idx >= 0) catalog.products[idx] = payload;
  else catalog.products.push(payload);

  if (!persist()) {
    if (idx >= 0) {
      catalog.products[idx] = previousProduct;
    } else {
      catalog.products.pop();
    }
    const err = lastPersistError;
    if (err?.code === "QUOTA_EXCEEDED") {
      showToast("No se pudo guardar: hay poco espacio en el navegador.");
    } else {
      showToast("No se pudo guardar el producto. Revisá el mensaje en pantalla.");
    }
    showProductSaveError(err);
    return;
  }

  document.getElementById("product-modal").close();
  renderProductsTable();
  showToast("Producto guardado (borrador)");
});

/* --- Category modal --- */

function addCategoryFieldRow(value = "") {
  const container = document.getElementById("category-fields");
  const row = document.createElement("div");
  row.className = "prop-row";
  row.style.gridTemplateColumns = "1fr auto";
  row.innerHTML = `
    <input type="text" class="cat-field-name" placeholder="Ej. Resolución, RAM, Estado…" value="${S.escapeHtml(value)}" />
    <button type="button" class="btn btn--ghost btn--sm btn--danger cat-field-remove">×</button>`;
  row.querySelector(".cat-field-remove").addEventListener("click", () => row.remove());
  container.appendChild(row);
}

document.getElementById("add-category-field-btn").addEventListener("click", () => addCategoryFieldRow());

function openCategoryModal(categoryId = null) {
  const modal = document.getElementById("category-modal");
  const cat = categoryId ? catalog.categories.find((c) => c.id === categoryId) : null;

  document.getElementById("category-modal-title").textContent = cat ? "Editar categoría" : "Nueva categoría";
  document.getElementById("category-id").value = cat?.id || "";
  document.getElementById("category-name").value = cat?.name || "";
  document.getElementById("category-order").value = cat?.order ?? catalog.categories.length;

  const container = document.getElementById("category-fields");
  container.innerHTML = "";
  (cat?.propertyFields?.length ? cat.propertyFields : ["Estado"]).forEach(addCategoryFieldRow);

  modal.showModal();
}

document.getElementById("new-category-btn").addEventListener("click", () => openCategoryModal());

document.getElementById("category-form").addEventListener("submit", (e) => {
  e.preventDefault();

  const id = document.getElementById("category-id").value || S.uid("cat");
  const fields = [...document.querySelectorAll("#category-fields .cat-field-name")]
    .map((input) => input.value.trim())
    .filter(Boolean);

  const payload = {
    id,
    name: document.getElementById("category-name").value.trim(),
    order: Number(document.getElementById("category-order").value),
    propertyFields: fields.length ? fields : ["Estado"],
  };

  const idx = catalog.categories.findIndex((c) => c.id === id);
  if (idx >= 0) catalog.categories[idx] = payload;
  else catalog.categories.push(payload);

  if (!persist()) return;

  document.getElementById("category-modal").close();
  renderCategoriesList();
  renderProductsTable();
  showToast("Categoría guardada (borrador)");
});

init();
