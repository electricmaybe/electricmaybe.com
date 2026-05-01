if (!customElements.get("related-products")) {
  customElements.define(
    "related-products",
class RelatedProducts extends HTMLElement {
  constructor() {
    super();
  }

  #initializeProductRatings(scope) {
    try {
      if (typeof window.__voldtInitProductRating === 'function') {
        window.__voldtInitProductRating(scope);
        return;
      }

      const roots = scope?.querySelectorAll?.('[data-product-rating-root]') || [];
      if (!roots.length) return;

      const globalState = window.__voldtProductRatings || (window.__voldtProductRatings = {
        cache: new Map(),
        inflight: new Map()
      });

      const fetchRatingData = (skuKey) => {
        if (globalState.cache.has(skuKey)) return Promise.resolve(globalState.cache.get(skuKey));
        if (globalState.inflight.has(skuKey)) return globalState.inflight.get(skuKey);

        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 5000);
        const apiUrl = `https://app-dev.voldt.com/api/shopify/reviews/${skuKey}&rating=4,5`;

        const request = fetch(apiUrl, {
          method: 'GET',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal
        })
          .then((response) => (response.ok ? response.json() : null))
          .then((data) => {
            const payload = { items: Array.isArray(data?.items) ? data.items : [] };
            globalState.cache.set(skuKey, payload);
            return payload;
          })
          .catch(() => ({ items: [] }))
          .finally(() => {
            window.clearTimeout(timeoutId);
            globalState.inflight.delete(skuKey);
          });

        globalState.inflight.set(skuKey, request);
        return request;
      };

      roots.forEach((root) => {
        if (!(root instanceof HTMLElement)) return;
        if (root.dataset.ratingInitialized === 'true') return;

        const isCompact = root.dataset.isCompact === 'true';
        const hasReviewHint = root.dataset.hasReviewHint === 'true';
        if (!isCompact || !hasReviewHint) return;

        const skuList = root.dataset.skuList || '';
        const ratingScaleMax = Number(root.dataset.ratingScaleMax || 5);
        const loadingEl = root.querySelector('[data-product-rating-loading]');
        const compactStarsEl = root.querySelector('[data-product-rating-stars-compact]');
        const compactTextEl = root.querySelector('[data-product-rating-text-compact]');
        const srEl = root.querySelector('[data-product-rating-sr]');

        if (!skuList || !compactStarsEl || !compactTextEl) {
          root.style.display = 'none';
          root.dataset.ratingInitialized = 'true';
          return;
        }

        root.dataset.ratingInitialized = 'true';

        const setLoadingState = (isLoading) => {
          if (loadingEl) loadingEl.hidden = !isLoading;
          compactStarsEl.hidden = isLoading;
          compactTextEl.hidden = isLoading;
        };

        const hideRating = () => {
          setLoadingState(false);
          root.style.display = 'none';
        };

        const updateDisplay = (ratingValue, ratingCount) => {
          const safeRating = Number.isFinite(ratingValue) ? ratingValue : 5;
          const safeCount = Number.isFinite(ratingCount) ? ratingCount : 0;
          const ratingDisplay = safeRating.toFixed(1);
          const ratingPercent = Math.max(0, Math.min((safeRating / ratingScaleMax) * 100, 100));

          compactStarsEl.style.setProperty('--percent', `${ratingPercent}%`);
          compactStarsEl.setAttribute('aria-label', `Rated ${ratingDisplay} out of ${ratingScaleMax} stars`);
          compactTextEl.textContent = ratingDisplay;
          if (srEl) srEl.textContent = `${safeCount} reviews`;
        };

        const runFetch = () => {
          setLoadingState(true);
          fetchRatingData(skuList).then((payload) => {
            const items = payload.items;
            if (!items.length) {
              hideRating();
              return;
            }

            let reviewSum = 0;
            for (const item of items) {
              reviewSum += Number.parseFloat(item?.rating) || 0;
            }

            updateDisplay(reviewSum / items.length, items.length);
            setLoadingState(false);
          });
        };

        if ('IntersectionObserver' in window) {
          const observer = new IntersectionObserver((entries) => {
            const [entry] = entries;
            if (!entry?.isIntersecting) return;
            observer.disconnect();
            runFetch();
          }, { rootMargin: '120px 0px' });
          observer.observe(root);
        } else {
          runFetch();
        }
      });
    } catch (error) {
      console.error('RelatedProducts: failed to initialize product ratings', error);
    }
  }

  connectedCallback() {
    const load = () => {
      if (this.dataset.loaded === 'true') return;
      this.dataset.loaded = 'true';

      const primaryUrl = this.dataset.url;
      const fallbackUrl = this.dataset.fallbackUrl;
      const minCount = Number.parseInt(this.dataset.minCount || '0', 10) || 0;

      const fetchAndExtract = (url) => {
        if (!url) return Promise.resolve({ html: null, inner: "" });

        return fetch(url)
          .then((response) => response.text())
          .then((text) => {
            const html = document.createElement('div');
            html.innerHTML = text;
            const recommendations = html.querySelector('related-products');
            const inner = recommendations?.innerHTML?.trim() || "";
            return { html, inner };
          });
      };

      const countItems = (inner) => {
        try {
          if (!inner) return 0;
          const tmp = document.createElement('div');
          tmp.innerHTML = inner;
          // Most of our recommendation blocks render buttons with this attribute.
          const byAtc = tmp.querySelectorAll('[data-add-to-cart-trigger]').length;
          if (byAtc) return byAtc;
          // Fallback: count direct product-card nodes.
          const byCard = tmp.querySelectorAll('product-card, .grid__item, li').length;
          return byCard || 0;
        } catch (e) {
          return 0;
        }
      };

      fetchAndExtract(primaryUrl)
        .then(({ html, inner }) => {
          // Fallback: if related is empty, try complementary (or any provided fallback).
          if (fallbackUrl) {
            const n = countItems(inner);
            if (!inner) return fetchAndExtract(fallbackUrl);
            if (minCount > 0 && n > 0 && n < minCount) return fetchAndExtract(fallbackUrl);
          }
          return { html, inner };
        })
        .then(({ html, inner }) => {
          if (inner) this.innerHTML = inner;
          this.#initializeProductRatings(this);

          // Keep legacy behavior for existing usages.
          if (!this.querySelector('slideshow-component') && this.classList.contains('related-products')) {
            this.remove();
          }

          if (html?.querySelector?.('.grid__item')) {
            this.classList.add('product-recommendations--loaded');
          }
        })
        .catch((e) => {
          console.error('related-products: fetch failed', e);
        });
    };

    // If eager, skip IO and load immediately.
    if (this.dataset.eager === 'true') {
      load();
      return;
    }

    const handleIntersection = (entries, observer) => {
      if (!entries[0].isIntersecting) return;
      observer.unobserve(this);
      load();
    };

    const rootMargin = this.dataset.rootMargin || '0px 0px 400px 0px';
    new IntersectionObserver(handleIntersection.bind(this), { rootMargin }).observe(this);
  }
}
  )}
