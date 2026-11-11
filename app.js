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
    const savingsPct =
      product.priceMlUsd > 0 ? Math.round((savingsUsd / product.priceMlUsd) * 100) : 0;
    const category = getCategoryById(catalog, product.categoryId);
    const waUrl = buildWhatsAppUrl(catalog.settings.whatsappPhone, waMessageForProduct(product));

    return `
    <article class="card card--compact ${product.isSold ? 'is-sold' : ''}" data-product-id="${product.id}" data-category-id="${product.categoryId}" data-open-detail="${product.id}">
      <div class="card__media">
        ${renderCarousel(product)}
        <span class="card__badge">${escapeHtml(product.condition)}</span>
        ${category ? `<span class="card__category">${escapeHtml(category.name)}</span>` : ""}
        ${product.isSold ? `<div class="card__sold-ribbon">VENDIDO</div>` : ""}
      </div>
      <div class="card__body">
        <h3 class="card__title" title="${escapeHtml(product.title)}">${escapeHtml(product.title)}</h3>
        
        <div class="card__pricing">
          <div class="card__price-row">
            <span class="card__price-current">${formatArs(priceArs)}</span>
            <span class="card__price-usd">${formatUsd(product.priceUsd)} USD</span>
          </div>
          ${savingsPct > 0 ? `
          <div class="card__meta-row">
            <span class="card__price-ml">ML ${formatArs(mlArs)}</span>
            <span class="card__savings-tag">-${savingsPct}% OFF</span>
          </div>` : ""}
        </div>

        <div class="card__view-detail">
          <span>Ver características y fotos</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </div>

        <div class="card__actions" style="margin-top: auto; padding-top: 8px;">
          <div class="card__action-row">
            <a class="btn btn--whatsapp btn--compact" href="${waUrl}" target="_blank" rel="noopener noreferrer" title="Consultar por WhatsApp">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/>
              </svg>
              <span>WhatsApp</span>
            </a>
            <button type="button" class="btn btn--share btn--compact" data-share-product="${product.id}" title="Compartir este producto">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
              <span>Compartir</span>
            </button>
          </div>
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

  
  function showToastNotice(text) {
    const existing = document.querySelector(".toast-notice");
    if (existing) existing.remove();
    const toast = document.createElement("div");
    toast.className = "toast-notice";
    toast.innerHTML = `<span style="color:#10b981;font-weight:bold;">✓</span> <span>${escapeHtml(text)}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.4s ease";
      setTimeout(() => toast.remove(), 400);
    }, 3200);
  }

  function initShareButtons(root = document) {
    root.querySelectorAll("[data-share-product]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const productId = btn.dataset.shareProduct;
        const product = catalog.products.find((p) => p.id === productId);
        if (!product) return;

        const rate = catalog.settings.usdToArsRate;
        const priceArs = usdToArs(product.priceUsd, rate);
        const origin = window.location.origin.includes("localhost")
          ? "https://lospimpollos.pages.dev"
          : window.location.origin;
        const shareUrl = `${origin}/p/${product.id}`;

        const shareData = {
          title: `${product.title} - ${formatUsd(product.priceUsd)} USD | El garage de los pimpollos`,
          text: `Mirá esta publicación: ${product.title} (${formatArs(priceArs)} / ${formatUsd(product.priceUsd)} USD) en El garage de los pimpollos:`,
          url: shareUrl,
        };

        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
          try {
            await navigator.share(shareData);
            return;
          } catch (err) {
            if (err.name === "AbortError") return;
          }
        }

        try {
          await navigator.clipboard.writeText(shareUrl);
          showToastNotice("¡Enlace copiado al portapapeles! Listo para enviar por WhatsApp.");
        } catch {
          prompt("Copiá este enlace para compartir el producto:", shareUrl);
        }
      });
    });
  }

  function checkDeepLink() {
    let targetId = null;
    const pathMatch = window.location.pathname.match(/\/p\/([a-zA-Z0-9_-]+)/);
    if (pathMatch) {
      targetId = pathMatch[1];
    } else if (window.location.hash) {
      targetId = window.location.hash.replace(/^#/, "");
    } else {
      const params = new URLSearchParams(window.location.search);
      if (params.get("p")) {
        targetId = params.get("p");
      }
    }

    if (!targetId) return;

    const product = catalog?.products?.find((p) => p.id === targetId);
    if (!product) return;

    if (activeCategory !== "all" && product.categoryId !== activeCategory) {
      activeCategory = "all";
      const container = document.getElementById("category-filters");
      if (container) {
        container.querySelectorAll(".filter-pill").forEach((b) => {
          b.classList.toggle("is-active", b.dataset.category === "all");
        });
      }
      renderProducts();
    }

    setTimeout(() => {
      const card = document.querySelector(`[data-product-id="${targetId}"]`);
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.classList.add("card--highlighted");
        setTimeout(() => {
          card.classList.remove("card--highlighted");
        }, 6000);
      }
      openProductDetailModal(targetId);
    }, 250);
  }

  
  function openProductDetailModal(productId) {
    const product = catalog?.products?.find((p) => p.id === productId);
    if (!product) return;

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

    // Badges
    const condEl = document.getElementById("detail-condition");
    if (condEl) condEl.textContent = product.condition || "Usado";
    const catEl = document.getElementById("detail-category");
    if (catEl) {
      if (category) {
        catEl.textContent = category.name;
        catEl.style.display = "inline-block";
      } else {
        catEl.style.display = "none";
      }
    }

    // Media Carousel
    const mediaContainer = document.getElementById("detail-media-container");
    if (mediaContainer) {
      mediaContainer.innerHTML = renderCarousel(product);
      initCarousels(mediaContainer);
    }

    // Title & Prices
    const titleEl = document.getElementById("detail-title");
    if (titleEl) titleEl.textContent = product.title;
    const priceArsEl = document.getElementById("detail-price-ars");
    if (priceArsEl) priceArsEl.textContent = formatArs(priceArs);
    const priceUsdEl = document.getElementById("detail-price-usd");
    if (priceUsdEl) priceUsdEl.textContent = formatUsd(product.priceUsd) + " USD";

    // ML & Savings
    const mlRow = document.getElementById("detail-ml-row");
    const savingsEl = document.getElementById("detail-savings");
    if (product.priceMlUsd > 0) {
      document.getElementById("detail-price-ml").textContent = formatArs(mlArs);
      document.getElementById("detail-savings-amount").textContent = formatArs(savingsArs);
      document.getElementById("detail-savings-pct").textContent = `(${savingsPct}%)`;
      if (mlRow) mlRow.style.display = "flex";
      if (savingsEl) savingsEl.style.display = "inline-flex";
    } else {
      if (mlRow) mlRow.style.display = "none";
      if (savingsEl) savingsEl.style.display = "none";
    }

    // USD Discount Note
    const usdDiscountEl = document.getElementById("detail-usd-discount");
    if (usdDiscountEl) {
      usdDiscountEl.textContent = `${formatUsd(priceUsdDiscount).replace('USD', '').trim()} USD`;
    }
    const usdNoteEl = document.getElementById("detail-usd-note");
    if (usdNoteEl) usdNoteEl.href = waUsdUrl;

    // Specs
    const specsContainer = document.getElementById("detail-specs-content");
    if (specsContainer) {
      const specsHtml = renderSpecs(product.properties);
      specsContainer.innerHTML = specsHtml || '<p class="hint" style="margin: 0;">Sin especificaciones adicionales.</p>';
    }

    // Note
    const noteSection = document.getElementById("detail-note-section");
    const noteEl = document.getElementById("detail-note-content");
    if (product.note && product.note.trim()) {
      if (noteEl) noteEl.textContent = product.note;
      if (noteSection) noteSection.style.display = "block";
    } else {
      if (noteSection) noteSection.style.display = "none";
    }

    // Action buttons
    const buyBtn = document.getElementById("detail-btn-buy");
    const waBtn = document.getElementById("detail-btn-wa");
    const shareBtn = document.getElementById("detail-btn-share");

    if (buyBtn) {
      if (product.isSold) {
        buyBtn.disabled = true;
        buyBtn.textContent = "VENDIDO";
        buyBtn.style.background = "#9ca3af";
        buyBtn.style.cursor = "not-allowed";
      } else {
        buyBtn.disabled = false;
        buyBtn.textContent = "Comprar / Pagar con Mercado Pago";
        buyBtn.style.background = "";
        buyBtn.style.cursor = "pointer";
        buyBtn.onclick = () => {
          document.getElementById("product-detail-modal")?.close();
          openPaymentModal(product.id);
        };
      }
    }

    if (waBtn) waBtn.href = waUrl;
    if (shareBtn) shareBtn.dataset.shareProduct = product.id;

    const modal = document.getElementById("product-detail-modal");
    if (modal) {
      modal.showModal();
    }
  }

  function initDetailTriggers(root = document) {
    root.querySelectorAll("[data-open-detail]").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest("button, a, .carousel__btn, .carousel__dot")) {
          return;
        }
        const productId = card.dataset.openDetail;
        openProductDetailModal(productId);
      });
    });
  }

  function initProductDetailModal() {
    const modal = document.getElementById("product-detail-modal");
    const closeBtn = document.getElementById("close-detail-modal");
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

    const shareBtn = document.getElementById("detail-btn-share");
    if (shareBtn) {
      shareBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        const pId = shareBtn.dataset.shareProduct;
        if (!pId) return;
        const p = catalog.products.find((prod) => prod.id === pId);
        if (!p) return;
        const rate = catalog.settings.usdToArsRate;
        const priceArs = usdToArs(p.priceUsd, rate);
        const origin = window.location.origin.includes("localhost")
          ? "https://lospimpollos.pages.dev"
          : window.location.origin;
        const shareUrl = `${origin}/p/${p.id}`;

        const shareData = {
          title: `${p.title} - ${formatUsd(p.priceUsd)} USD | El garage de los pimpollos`,
          text: `Mirá esta publicación: ${p.title} (${formatArs(priceArs)} / ${formatUsd(p.priceUsd)} USD) en El garage de los pimpollos:`,
          url: shareUrl,
        };

        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
          try {
            await navigator.share(shareData);
            return;
          } catch (err) {
            if (err.name === "AbortError") return;
          }
        }

        try {
          await navigator.clipboard.writeText(shareUrl);
          showToastNotice("¡Enlace copiado al portapapeles! Listo para enviar por WhatsApp.");
        } catch {
          prompt("Copiá este enlace para compartir el producto:", shareUrl);
        }
      });
    }
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
    initShareButtons(grid);
    initDetailTriggers(grid);
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
    initProductDetailModal();
    const sortSelect = document.getElementById("sort-select");
    if (sortSelect) {
      sortSelect.addEventListener("change", () => {
        renderProducts();
      });
    }
    await refreshStore();
    checkDeepLink();
    window.addEventListener("hashchange", checkDeepLink);
    window.addEventListener("popstate", checkDeepLink);
    document.getElementById("year").textContent = String(new Date().getFullYear());
  }

  window.addEventListener("storage", (event) => {
    if (event.key === PUBLISHED_KEY) refreshStore();
  });

  init();
})();
