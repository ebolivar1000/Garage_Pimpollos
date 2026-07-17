(function () {
  const GS = window.GarageStore;
  if (!GS) {
    showError("No se pudo cargar store.js. Recargá la página con Ctrl+F5.");
    return;
  }

  const loadCatalogForPublic = GS.loadCatalogForPublic || GS.loadCatalog;
  const {
    PUBLISHED_KEY,
    sortedCategories,
    getCategoryById,
    getProductImages,
    formatUsd,
    formatArs,
    formatPesosLabel,
    usdToArs,
    buildWhatsAppUrl,
    escapeHtml,
    IMAGE_FALLBACK,
    getEnabledPaymentMethods,
  } = GS;

  let catalog = null;
  let activeCategory = "all";

  function showError(message) {
    const el = document.getElementById("store-error");
    if (el) {
      el.textContent = message;
      el.hidden = false;
    }
  }

  function escapeAttr(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function waMessageForProduct(product) {
    const rate = catalog.settings.usdToArsRate;
    const ars = usdToArs(product.priceUsd, rate);
    return [
      `Hola, me interesa: ${product.title}`,
      `Precio: ${formatArs(ars)} (${formatUsd(product.priceUsd)} USD)`,
      `¿Sigue disponible?`,
    ].join("\n");
  }

  function renderSpecs(properties) {
    const entries = Object.entries(properties || {}).filter(([, v]) => v && String(v).trim());
    if (!entries.length) return "";

    const items = entries
      .map(
        ([key, value]) => `
        <li class="specs__item">
          <span class="specs__key">${escapeHtml(key)}</span>
          <span class="specs__val">${escapeHtml(value)}</span>
        </li>`
      )
      .join("");

    return `<ul class="specs">${items}</ul>`;
  }

  function renderCarousel(product) {
    const images = getProductImages(product);
    const slides = (images.length ? images : [IMAGE_FALLBACK])
      .map(
        (src, index) => `
        <img
          class="carousel__slide${index === 0 ? " is-active" : ""}"
          src="${escapeAttr(src)}"
          alt="${escapeHtml(product.title)} — foto ${index + 1}"
          loading="${index === 0 ? "eager" : "lazy"}"
          width="800"
          height="600"
          data-index="${index}"
          onerror="this.onerror=null;this.src='${IMAGE_FALLBACK}'"
        />`
      )
      .join("");

    const controls =
      images.length > 1
        ? `
        <button type="button" class="carousel__btn carousel__btn--prev" aria-label="Foto anterior">‹</button>
        <button type="button" class="carousel__btn carousel__btn--next" aria-label="Foto siguiente">›</button>
        <div class="carousel__dots" role="tablist" aria-label="Fotos del producto">
          ${images
            .map(
              (_, index) =>
                `<button type="button" class="carousel__dot${index === 0 ? " is-active" : ""}" data-index="${index}" aria-label="Foto ${index + 1}"></button>`
            )
            .join("")}
        </div>`
        : "";

    return `
      <div class="card__carousel" data-carousel>
        <div class="carousel__viewport">${slides}</div>
        ${controls}
      </div>`;
  }

  function initCarousels(root = document) {
    root.querySelectorAll("[data-carousel]").forEach((carousel) => {
      const slides = [...carousel.querySelectorAll(".carousel__slide")];
      if (slides.length <= 1) return;

      let current = slides.findIndex((s) => s.classList.contains("is-active"));
      if (current < 0) current = 0;

      const dots = [...carousel.querySelectorAll(".carousel__dot")];

      function goTo(index) {
        current = (index + slides.length) % slides.length;
        slides.forEach((slide, i) => slide.classList.toggle("is-active", i === current));
        dots.forEach((dot, i) => dot.classList.toggle("is-active", i === current));
      }

      carousel.querySelector(".carousel__btn--prev")?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        goTo(current - 1);
      });

      carousel.querySelector(".carousel__btn--next")?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        goTo(current + 1);
      });

      dots.forEach((dot) => {
        dot.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          goTo(Number(dot.dataset.index));
        });
      });
    });
  }

  function renderProductCard(product) {
    const rate = catalog.settings.usdToArsRate;
    const priceArs = usdToArs(product.priceUsd, rate);
    const mlArs = usdToArs(product.priceMlUsd, rate);
    const savingsUsd = Math.max(0, product.priceMlUsd - product.priceUsd);
    const savingsArs = usdToArs(savingsUsd, rate);
    const savingsPct =
      product.priceMlUsd > 0 ? Math.round((savingsUsd / product.priceMlUsd) * 100) : 0;
    const usdDiscountPct = 10;
    const priceUsdDiscount = product.priceUsd * (1 - usdDiscountPct / 100);
    const category = getCategoryById(catalog, product.categoryId);
    const waUrl = buildWhatsAppUrl(catalog.settings.whatsappPhone, waMessageForProduct(product));
    const waUsdMsg = `Hola! Me interesa pagar en USD el producto: *${escapeHtml(product.title)}*. ¿Cómo coordino el pago con el ${usdDiscountPct}% de descuento?`;
    const waUsdUrl = buildWhatsAppUrl(catalog.settings.whatsappPhone, waUsdMsg);

    return `
    <article class="card ${product.isSold ? 'is-sold' : ''}" data-product-id="${product.id}" data-category-id="${product.categoryId}">
      <div class="card__media">
        ${renderCarousel(product)}
        <span class="card__badge">${escapeHtml(product.condition)}</span>
        ${category ? `<span class="card__category">${escapeHtml(category.name)}</span>` : ""}
        ${product.isSold ? `<div class="card__sold-ribbon">VENDIDO</div>` : ""}
      </div>
      <div class="card__body">
        <h3 class="card__title">${escapeHtml(product.title)}</h3>
        <div class="prices">
          <div class="price-row price-row--primary">
            <span class="price-row__label">Precio en Pesos</span>
            <div class="price-stack">
              <span class="price-current price-current--ars">${formatArs(priceArs)}</span>
              <span class="price-secondary price-secondary--usd">${formatUsd(product.priceUsd)} USD</span>
            </div>
          </div>
          <div class="price-row">
            <span class="price-row__label">Referencia Mercado Libre</span>
            <div class="price-stack price-stack--ml">
              <span class="price-ml">
                <span class="ml-pill">ML</span>
                ${formatArs(mlArs)}
              </span>
            </div>
          </div>
        </div>
        <div class="savings" aria-label="Ahorro estimado">
          Ahorro · ${formatArs(savingsArs)} <span>(${savingsPct}%)</span>
        </div>
        ${renderSpecs(product.properties)}
        ${product.note ? `<p class="card__note">${escapeHtml(product.note)}</p>` : ""}
        <div class="card__actions">
          ${product.isSold 
            ? `<button type="button" class="btn btn--buy" style="background: #9ca3af; color: #fff; cursor: not-allowed; opacity: 0.8;" disabled>VENDIDO</button>`
            : `<button type="button" class="btn btn--buy" data-buy-product="${product.id}">Comprar / Pagar con Mercado Pago</button>
               <a class="usd-note" href="${waUsdUrl}" target="_blank" rel="noopener noreferrer">
                 💵 Pagando en USD tenés un ${usdDiscountPct}% de descuento (${formatUsd(priceUsdDiscount).replace('USD','').trim()} USD) · <strong>Consultanos por WhatsApp</strong>
               </a>
               <a class="btn btn--whatsapp btn--secondary" href="${waUrl}" target="_blank" rel="noopener noreferrer">Consultar por WhatsApp</a>`
          }
        </div>
      </div>
    </article>`;
  }

  function renderCategoryFilters() {
    const container = document.getElementById("category-filters");
    if (!container) return;

    const categories = sortedCategories(catalog);
    const buttons = [
      `<button type="button" class="filter-pill is-active" data-category="all">Todos</button>`,
      ...categories.map(
        (cat) =>
          `<button type="button" class="filter-pill" data-category="${cat.id}">${escapeHtml(cat.name)}</button>`
      ),
    ];

    container.innerHTML = buttons.join("");
    container.querySelectorAll(".filter-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeCategory = btn.dataset.category;
        container.querySelectorAll(".filter-pill").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        renderProducts();
      });
    });
  }

  function renderProducts() {
    const grid = document.getElementById("product-grid");
    if (!grid) return;

    let products = [...catalog.products];
    if (activeCategory !== "all") {
      products = products.filter((p) => p.categoryId === activeCategory);
    }

    const sortSelect = document.getElementById("sort-select");
    const sortBy = sortSelect ? sortSelect.value : "date-desc";

    products.sort((a, b) => {
      // Sold items always go last
      if (a.isSold && !b.isSold) return 1;
      if (!a.isSold && b.isSold) return -1;

      // Regular sort criteria
      if (sortBy === "date-desc") {
        return new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0);
      } else if (sortBy === "date-asc") {
        return new Date(a.publishedAt || 0) - new Date(b.publishedAt || 0);
      } else if (sortBy === "price-asc") {
        return a.priceUsd - b.priceUsd;
      } else if (sortBy === "price-desc") {
        return b.priceUsd - a.priceUsd;
      }
      return 0;
    });

    if (!products.length) {
      grid.innerHTML = `<p class="empty-state">No hay productos publicados todavía. Publicá desde gestion.html.</p>`;
      return;
    }

    grid.innerHTML = products.map(renderProductCard).join("");
    initCarousels(grid);
    initBuyButtons(grid);
  }

  function applyBranding() {
    const name = catalog.settings.storeName;
    document.title = name;
    document.querySelectorAll(".logo, .brand-name").forEach((el) => {
      el.textContent = name;
    });

    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.content = `${name} — productos usados en excelente estado. Precios en USD y pesos.`;
    }

    const rateEl = document.getElementById("fx-rate-display");
    if (rateEl) {
      rateEl.textContent = `1 USD = ${formatPesosLabel(catalog.settings.usdToArsRate)} (tipo de cambio de referencia)`;
    }
  }

  function initGlobalWhatsApp() {
    const link = document.getElementById("global-wa");
    if (!link) return;
    const preset = `Hola, quiero consultar disponibilidad en ${catalog.settings.storeName}.`;
    link.href = buildWhatsAppUrl(catalog.settings.whatsappPhone, preset);
  }

  async function refreshStore() {
    try {
      catalog = await loadCatalogForPublic();
      document.getElementById("store-error").hidden = true;
      applyBranding();
      renderCategoryFilters();
      renderProducts();
      initGlobalWhatsApp();
    } catch (err) {
      console.error(err);
      showError("Error al cargar el catálogo. Probá Ctrl+F5 o volvé a publicar desde gestion.html.");
    }
  }

  function initTopBanner() {
    const banner = document.getElementById("top-banner");
    const closeBtn = document.getElementById("close-banner");
    if (!banner || !closeBtn) return;

    const isClosed = localStorage.getItem("garage-banner-closed") === "true";
    if (isClosed) {
      banner.hidden = true;
      return;
    }

    banner.removeAttribute("hidden");

    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      banner.classList.add("top-banner--hidden");
      localStorage.setItem("garage-banner-closed", "true");

      banner.addEventListener("transitionend", function handler(event) {
        if (event.propertyName === "max-height" || event.propertyName === "opacity") {
          banner.hidden = true;
          banner.removeEventListener("transitionend", handler);
        }
      });
    });
  }

  function initBuyButtons(root = document) {
    root.querySelectorAll("[data-buy-product]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        openPaymentModal(btn.dataset.buyProduct);
      });
    });
  }

  function openPaymentModal(productId) {
    const product = catalog.products.find((p) => p.id === productId);
    if (!product) return;

    const rate = catalog.settings.usdToArsRate;
    const priceArs = usdToArs(product.priceUsd, rate);
    const methods = getEnabledPaymentMethods(catalog.settings);
    const cvuMethod = methods.find((m) => m.id === "mp-ars");
    const cvu = cvuMethod?.account || catalog.settings.transferCvu || "0000003100359754352113";

    document.getElementById("pay-product-title").textContent = product.title;
    document.getElementById("pay-price-ars").textContent = formatArs(priceArs);
    document.getElementById("pay-price-usd").textContent = formatUsd(product.priceUsd) + " USD";

    const mpAmount = priceArs;
    const mpDeepLink = `https://mpago.la/links/transfer?receiver_cvu=${encodeURIComponent(cvu)}&amount=${mpAmount}`;
    const mpWebLink = `https://www.mercadopago.com.ar/transfers/new?cvu=${encodeURIComponent(cvu)}&amount=${mpAmount}`;
    const mpLink = document.getElementById("btn-open-mp");
    if (mpLink) {
      mpLink.href = mpDeepLink;
      mpLink.dataset.mpWeb = mpWebLink;
      mpLink.hidden = !cvuMethod;
    }

    const paymentLines = methods.map((method) => `- ${method.name}: ${method.account}`).join("\n");
    const waPhone = catalog.settings.whatsappPhone;
    const waText = [
      `¡Hola! Quiero pagar el producto: *${product.title}*.`,
      `Monto: *${formatArs(priceArs)}* (${formatUsd(product.priceUsd)} USD)`,
      "",
      "Métodos disponibles:",
      paymentLines,
      "",
      "Adjunto comprobante de pago:",
    ].join("\n");
    const waConfirmLink = document.getElementById("pay-wa-confirm");
    if (waConfirmLink) {
      waConfirmLink.href = buildWhatsAppUrl(waPhone, waText);
    }

    renderPaymentMethodsDisplay(methods, cvuMethod);

    const modal = document.getElementById("payment-modal");
    if (modal) {
      modal.showModal();
    }
  }

  function renderPaymentMethodsDisplay(methods, cvuMethod) {
    const container = document.getElementById("payment-methods-display");
    if (!container) return;

    if (!methods.length) {
      container.innerHTML = `<p class="hint">No hay métodos de pago configurados todavía.</p>`;
      return;
    }

    container.innerHTML = methods
      .map((method) => {
        const isCvu = method.id === "mp-ars";
        const hint = isCvu
          ? "Transferí el monto en pesos o usá Mercado Pago con el botón de abajo."
          : "Copiá la cuenta o wallet y coordiná el pago en esa moneda.";
        return `
          <article class="payment-method-card">
            <div class="payment-method-card__head">
              <strong>${escapeHtml(method.name)}</strong>
              <p class="hint">${hint}</p>
            </div>
            <div class="cvu-container">
              <div class="cvu-box">
                <span class="cvu-label">${escapeHtml(isCvu ? "CVU DE DESTINO" : "CUENTA / WALLET")}</span>
                <span class="cvu-value">${escapeHtml(method.account)}</span>
              </div>
              <button type="button" class="btn-copy" data-copy-value="${escapeAttr(method.account)}">
                <span class="btn-copy__text">Copiar</span>
              </button>
            </div>
          </article>`;
      })
      .join("");

    container.querySelectorAll("[data-copy-value]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const value = btn.dataset.copyValue;
        navigator.clipboard
          .writeText(value)
          .then(() => {
            const btnText = btn.querySelector(".btn-copy__text");
            if (btnText) {
              btnText.textContent = "¡Copiado!";
              btn.classList.add("is-success");
              setTimeout(() => {
                btnText.textContent = "Copiar";
                btn.classList.remove("is-success");
              }, 2000);
            }
          })
          .catch((err) => console.error("Could not copy text: ", err));
      });
    });
  }

  function initPaymentModal() {
    const modal = document.getElementById("payment-modal");
    const closeBtn = document.getElementById("close-payment-modal");
    if (!modal || !closeBtn) return;

    closeBtn.addEventListener("click", () => {
      modal.close();
    });

    modal.addEventListener("click", (e) => {
      const rect = modal.getBoundingClientRect();
      const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
      if (!isInDialog) {
        modal.close();
      }
    });
  }

  async function init() {
    initTopBanner();
    initPaymentModal();
    const sortSelect = document.getElementById("sort-select");
    if (sortSelect) {
      sortSelect.addEventListener("change", () => {
        renderProducts();
      });
    }
    await refreshStore();
    document.getElementById("year").textContent = String(new Date().getFullYear());
  }

  window.addEventListener("storage", (event) => {
    if (event.key === PUBLISHED_KEY) refreshStore();
  });

  init();
})();
