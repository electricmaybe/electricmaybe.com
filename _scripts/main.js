// Main script file - imports all individual scripts
import "./helpers.js";
import "./core-components.js";
import "./electric-disclosure.js";
import "./animations.js";
import "./header.js";
import "./electric-section.js";
import "./electric-property-updater.js";
import "./electric-pub.js";

import "./electric-slider.js";
import "./footer-newsletter.js";
import "./electric-search.js";
import "./product--form.js";
import "./product--length-slider.js";
import "./product--variant-radios.js";
import "./product-variant-preview.js";
import "./product-card-atc.js";
import "./quick-atc-modal.js";
import "./electric-dom-ready.js"
import "./electric-variant-link-converter.js"
import "./find-my-car.js"

function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

function fetchConfig(type = "json") {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: `application/${type}`,
    },
  };
}

function triggerEvent(element, name, data = {}) {
  window.events = window.events || {};
  if (!window.events[name]) {
    window.events[name] = debounce((element, name, data) => {
      element.dispatchEvent(
        new CustomEvent(name, {
          bubbles: true,
          detail: data,
        }),
      );
    }, 300);
  }
  window.events[name](element, name, data);
};
function delegate(parent, eventName, childSelector, callback) {
  if (typeof childSelector === "function") {
    callback = childSelector;
    childSelector = null;
  }
  const selector = childSelector
    ? childSelector
    : "." + [...parent.classList].join(".").replaceAll(":", "\\:");
  parent.addEventListener(eventName, (event) => {
    const target = event.target.closest(selector);
    if (target) {
      callback(event, target);
    }
  });
}


function getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      "summary, a[href], button:enabled, [tabindex]:not([tabindex^='-']), [draggable], area, input:not([type=hidden]):enabled, select:enabled, textarea:enabled, object, iframe",
    ),
  );
}

let trapFocusHandlers = {};

function trapFocus(container, elementToFocus = container) {
  var elements = getFocusableElements(container);
  var first = elements[0];
  var last = elements[elements.length - 1];

  removeTrapFocus();

  trapFocusHandlers.focusin = (event) => {
    if (
      event.target !== container &&
      event.target !== last &&
      event.target !== first
    )
      return;

    document.addEventListener("keydown", trapFocusHandlers.keydown);
  };

  trapFocusHandlers.focusout = function (e) {
    document.removeEventListener("keydown", trapFocusHandlers.keydown);
  };

  trapFocusHandlers.keydown = function (event) {
    if (event.code.toUpperCase() !== "TAB") return; // If not TAB key
    // On the last focusable element and tab forward, focus the first element.
    if (event.target === last && !event.shiftKey) {
      event.preventDefault();
      first.focus();
    }

    //  On the first focusable element and tab backward, focus the last element.
    if (
      (event.target === container || event.target === first) &&
      event.shiftKey
    ) {
      event.preventDefault();
      last.focus();
    }
  };

  document.addEventListener("focusout", trapFocusHandlers.focusout);
  document.addEventListener("focusin", trapFocusHandlers.focusin);

  elementToFocus.focus();
}

function removeTrapFocus(elementToFocus = null) {
  document.removeEventListener("focusin", trapFocusHandlers.focusin);
  document.removeEventListener("focusout", trapFocusHandlers.focusout);
  document.removeEventListener("keydown", trapFocusHandlers.keydown);

  if (elementToFocus) elementToFocus.focus();
}

function pauseAllMedia() {
  document.querySelectorAll(".js-youtube").forEach((video) => {
    video.contentWindow.postMessage(
      '{"event":"command","func":"' + "pauseVideo" + '","args":""}',
      "*",
    );
  });
  document.querySelectorAll(".js-vimeo").forEach((video) => {
    video.contentWindow.postMessage('{"method":"pause"}', "*");
  });
  document.querySelectorAll("video").forEach((video) => video.pause());
  document
    .querySelectorAll("model-viewer")
    .forEach((model) => model.modelViewerUI?.pause());
}

function pauseThisMedia(media) {
  if (media.tagName === "VIDEO") {
    media.pause();
  } else if (media.tagName === "IFRAME") {
    if (media.classList.contains("js-youtube")) {
      media.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "stopVideo", args: [] }),
        "*",
      );
    } else if (media.classList.contains("js-vimeo")) {
      media.contentWindow.postMessage('{"method":"pause"}', "*");
    }
  } else if (media.tagName === "MODEL-VIEWER") {
    media.modelViewerUI?.pause();
  }
}




// Convert the bg color to rgba format with specific opacity
function setOpacity(color, opacity) {
  // If it's a named color like 'white'
  if (!color.startsWith("oklch") && !color.startsWith("rgb")) {
    const tempDiv = document.createElement("div");
    tempDiv.style.color = color;
    document.body.appendChild(tempDiv);
    color = getComputedStyle(tempDiv).color;
    tempDiv.remove();
  }

  // Convert RGB to OKLCH if needed
  if (color.startsWith("rgb")) {
    const [r, g, b] = color.match(/\d+/g).map(Number);
    const rgbColor = `rgb(${r}, ${g}, ${b})`;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = rgbColor;
    color = ctx.fillStyle;
    canvas.remove();
  }

  // Extract OKLCH values
  const [l, c, h] = color.match(/[\d.]+/g).map(Number);
  return `oklch(${l} ${c} ${h} / ${opacity})`;
}

function getPathWithoutQuery(url) {
  return new URL(url, window.location.origin).pathname;
}


function replaceNodeWithNodeList(nodeToReplace, nodeList) {
  if (!(nodeList instanceof NodeList) && !Array.isArray(nodeList)) {
    throw new Error("Second argument must be a NodeList or an array of nodes");
  }

  const parent = nodeToReplace.parentNode;
  if (!parent) {
    throw new Error("Cannot replace a node that is not in the DOM");
  }

  const fragment = document.createDocumentFragment();

  // If it's an array, we need to iterate differently
  if (Array.isArray(nodeList)) {
    nodeList.forEach((node) => fragment.appendChild(node));
  } else {
    // NodeList is array-like but not an array, so we use this method
    fragment.append(...nodeList);
  }

  parent.replaceChild(fragment, nodeToReplace);
}




class SectionFetcher extends HTMLElement {
  static observedAttributes = [
    "data-url",
    "data-section-id",
    "data-selector",
    "data-animate",
    "data-fire-event",
    "data-onload",
    "data-load-on-event",
  ];

  constructor() {
    super();
    this.handlePopState = this.handlePopState.bind(this);
    this.debouncedCheckAndFetch = this.debounce(
      this.checkAndFetch.bind(this),
      250,
    );
    this.intersectionObserver = null;
  }

  connectedCallback() {
    this.setupInitialState();
    this.addEventListeners();
    this.reWriteData();
    if (this.dataset.onload === "true") {
      this.setupIntersectionObserver();
    }
  }

  disconnectedCallback() {
    this.removeEventListeners();
    this.removeIntersectionObserver();
  }

  setupIntersectionObserver() {
    const options = {
      rootMargin: "0px 0px 800px 0px",
      threshold: 0,
    };

    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && this.dataset.onload === "true") {
          queueMicrotask(() => this.checkAndFetch(true));
          this.removeIntersectionObserver();
        }
      });
    }, options);

    this.intersectionObserver.observe(this);
  }

  removeIntersectionObserver() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || name !== "data-url") return;
    this.debouncedCheckAndFetch(false, true);
  }

  setupInitialState() {
    const defaultUrl = new URL(window.location.href);
    defaultUrl.searchParams.delete("section_id");
    this.dataset.url = this.dataset.url || defaultUrl.toString();
    this.lastFetchedUrl = this.dataset.url || window.location.href;
  }

  addEventListeners() {
    if (!this.disablePopEvents) {
      window.addEventListener("popstate", this.handlePopState, {
        passive: true,
      });
    }
    if (this.dataset.loadOnEvent) {
      window.addEventListener(this.dataset.loadOnEvent, this.handlePopState, {
        passive: true,
      });
    }
  }

  removeEventListeners() {
    window.removeEventListener("popstate", this.handlePopState);
    if (this.dataset.loadOnEvent) {
      window.removeEventListener(this.dataset.loadOnEvent, this.handlePopState);
    }
  }

  handlePopState() {
    this.dataset.url = this.buildFetchUrl(window.location.href);
    this.debouncedCheckAndFetch(false);
  }

  async checkAndFetch(isInitialLoad = true, isAttributeChange) {
    const currentUrl = new URL(this.dataset.url, window.location.origin);
    const dataUrl = new URL(this.lastFetchedUrl, window.location.origin);

    const relevantParams = new Set([
      "sort_by",
      "page",
      "q",
      ...Array.from(dataUrl.searchParams.keys()).filter((key) =>
        key.startsWith("filter."),
      ),
      ...Array.from(currentUrl.searchParams.keys()).filter((key) =>
        key.startsWith("filter."),
      ),
    ]);

    let shouldFetch = isInitialLoad;

    for (const param of relevantParams) {
      const currentValues = currentUrl.searchParams.getAll(param);
      const dataValues = dataUrl.searchParams.getAll(param);

      if (param === "page" && currentValues[0] == 1 && dataValues.length === 0)
        return;

      if (JSON.stringify(currentValues) !== JSON.stringify(dataValues)) {
        shouldFetch = true;
        dataUrl.searchParams.delete(param); // Remove all existing values for this param
        currentValues.forEach((value) => {
          dataUrl.searchParams.append(param, value); // Add each value individually
        });
      }
    }

    if (shouldFetch) {
      const newUrl = dataUrl.toString();
      const fetchUrl = this.buildFetchUrl(newUrl);

      if (fetchUrl !== this.lastFetchedUrl) {
        this.lastFetchedUrl = fetchUrl;
        await this.fetchAndReplaceContent(fetchUrl, isAttributeChange);
        return true;
      }
    }
  }

  buildFetchUrl(url) {
    const fetchUrl = new URL(url, window.location.origin);
    fetchUrl.searchParams.set("section_id", this.dataset.sectionId);
    return fetchUrl.toString();
  }

  keepData() {
    if (!this.dataset.toKeep) return;
    window.temporaryDatas = window.temporaryDatas || {};
    window.temporaryDatas[this.id] = {};
    this.dataset.toKeep.split(",").forEach((data) => {
      window.temporaryDatas[this.id][data] = this.dataset[data];
    });
    setTimeout(() => (window.temporaryDatas = {}), 3000);
  }

  reWriteData() {
    if (!window.temporaryDatas || !window.temporaryDatas[this.id]) return;
    Object.entries(window.temporaryDatas[this.id]).forEach(([key, value]) => {
      this.dataset[key] = value;
    });
  }

  async fetchAndReplaceContent(url, isAttributeChange) {
    try {
      this.keepData();
      let newContent;
      if (
        window.temporaryFeeds &&
        window.temporaryFeeds[this.id] &&
        window.temporaryFeeds[this.id][this.dataset.url]
      ) {
        newContent = this.parseHTML(
          window.temporaryFeeds[this.id][this.dataset.url],
        );
        this.dataset.animate = "false";
      }

      if (!newContent) {
        const response = await this.fetchWithRetry(url);
        const html = await response.text();
        newContent = this.parseHTML(html);
        if (newContent === null) {
          this.remove();
          return;
        }
      }

      if (this.dataset.animate !== "false") {
        await this.animateTransition(newContent);
      } else {
        this.replaceWith(newContent);
      }

      this.fireCustomEvent(newContent);
      return true;
    } catch (error) {
      console.error("Error fetching content:", error);
    }
  }

  async fetchWithRetry(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url);
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        return response;
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * Math.pow(2, i)),
        );
      }
    }
  }

  parseHTML(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    return (
      doc.querySelector(`[data-section-id="${this.dataset.sectionId}"]`) ??
      doc.querySelector(`[data-section="${this.dataset.sectionId}"]`)
    );
  }

  async animateTransition(newContent) {
    await this.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 100,
    }).finished;

    this.replaceWith(newContent);

    this.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 100,
    });
  }

  replaceContent(newContent) {
    replaceNodeWithNodeList(this, newContent);
  }

  fireCustomEvent(newContent) {
    if (this.dataset.fireEvent) {
      const event = new CustomEvent(this.dataset.fireEvent, {
        bubbles: true,
        detail: {
          source: this.dataset.id,
          found: newContent.length > 0,
        },
      });
      this.dispatchEvent(event);
    }
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
}

customElements.define("section-fetcher", SectionFetcher);



if (!customElements.get("cart-dynamic")) {
  customElements.define(
    "cart-dynamic",
    class CartDynamic extends SectionFetcher {
      constructor() {
        super();
        this.disablePopEvents = true;
      }

      connectedCallback() {
        super.connectedCallback();
        document.addEventListener("cart:update", (e) => {
          if (e.detail.source !== "quantity-input") {
            // Build the fetch URL with the section_id parameter
            const fetchUrl = this.buildFetchUrl(window.location.href);
            this.fetchAndReplaceContent(fetchUrl);
          }
        });
      }

      modified(miliseconds = 1000) {
        this.dataset.modified = true;

        setTimeout(() => {
          this.removeAttribute("data-modified");
        }, miliseconds);
      }
    },
  );
}

// Ensure the cart page can switch to the empty-state layout after JS-driven removal.

// Only cart-delete dispatches a full cart payload in `e.detail.cart`.
if (!window.__voldtCartEmptyReloadBound) {
  window.__voldtCartEmptyReloadBound = true;
  document.addEventListener("cart:update", (e) => {
    try {
      if (window.location.pathname !== "/cart") return;
      const cart = e?.detail?.cart;
      if (!cart) return;
      const itemCount = Number(cart.item_count);
      if (Number.isFinite(itemCount) && itemCount === 0) {
        window.location.reload();
      }
    } catch (err) {
      // no-op: never break cart interactions due to telemetry errors
    }
  });
}

if (!window.__voldtCartCountSyncBound) {
  window.__voldtCartCountSyncBound = true;
  document.addEventListener("cart:update", (e) => {
    try {
      const itemCount = Number(e?.detail?.cart?.item_count);
      if (!Number.isFinite(itemCount)) return;

      document.querySelectorAll("[data-cart-item-count]").forEach((node) => {
        node.textContent = String(itemCount);
      });
    } catch (err) {
      // no-op: cart count sync should never block interactions
    }
  });
}

if (!customElements.get('cart-delete')) {
  customElements.define(
    'cart-delete',
    class CartDelete extends HTMLElement {
      /** @type {number | null} Line item ID to delete */
      #lineItemId = null;
      
      /** @type {boolean} Component connection state */
      #isConnected = false;
      
      /** @type {AbortController | null} Abort controller for fetch operations */
      #abortController = null;

      constructor() {
        super();
        this.deleteHandler = this.#onClick.bind(this);
      }

      connectedCallback() {
        if (this.#isConnected) return;
        
        try {
          this.#isConnected = true;
          this.#lineItemId = this.dataset.lineItemId;
          
          if (!this.#lineItemId) {
            this.#logError(new Error('Missing line-item-id data attribute'));
            return;
          }

          this.#initializeEventListeners();
        } catch (error) {
          this.#logError(error);
        }
      }

      disconnectedCallback() {
        this.#cleanup();
      }

      /**
       * Initialize event listeners for delete functionality
       * @private
       */
      #initializeEventListeners() {
        this.addEventListener('click', this.deleteHandler, { passive: false });
        this.addEventListener('keydown', this.#onKeydown.bind(this), { passive: false });
        
        // Set proper ARIA attributes for accessibility
        this.setAttribute('role', 'button');
        this.setAttribute('tabindex', '0');
        this.setAttribute('aria-label', 'Remove item from cart');
      }

      /**
       * Handle keyboard navigation for accessibility
       * @param {KeyboardEvent} event - Keyboard event
       * @private
       */
      #onKeydown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.#onClick(event);
        }
      }

      /**
       * Handle click events for cart item deletion
       * @param {Event} event - Click event
       * @private
       */
      async #onClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        if (this.dataset.state === 'loading') return;

        try {
          this.#setState('loading');
          
          // Get dynamic sections for updates
          const dynamicSectionsNodes = document.querySelectorAll('cart-dynamic');
          const sectionIds = dynamicSectionsNodes.length
            ? [...dynamicSectionsNodes].map((n) => n.dataset.sectionId)
            : [];

          // Prepare cart change request
          const config = this.#getFetchConfig('json');
          config.headers['X-Requested-With'] = 'XMLHttpRequest';
          
          const body = {
            id: this.#lineItemId,
            quantity: 0,
            sections: sectionIds.join(',')
          };

          config.body = JSON.stringify(body);

          // Abort any existing requests
          if (this.#abortController) {
            this.#abortController.abort();
          }
          
          this.#abortController = new AbortController();
          config.signal = this.#abortController.signal;

          const response = await fetch(`${routes.cart_change_url}`, config);
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }

          const data = await response.json();

          if (data.status) {
            this.#setState('error');
            this.#dispatchErrorEvent('Failed to remove item from cart', data.description);
            navigator.vibrate?.(100);
            return;
          }

          // When the last item is removed on the cart page, the surrounding page
          // markup (empty state) won't be re-rendered by section updates alone.
          // Match quantity-input behavior and reload to show the empty state.
          if (data.item_count === 0 && window.location.pathname === "/cart") {
            window.location.reload();
            return;
          }

          // Update dynamic sections if provided
          if (data.sections && dynamicSectionsNodes.length) {
            this.#updateDynamicSections(data.sections, dynamicSectionsNodes);
          }

          this.#setState('success');
          this.#dispatchSuccessEvent();
          navigator.vibrate?.(100);

          // Dispatch cart update event for other components
          // Note: Shopify's cart API returns the cart object directly, not nested
          this.dispatchEvent(new CustomEvent('cart:item-removed', {
            detail: { 
              lineItemId: this.#lineItemId,
              cart: data 
            },
            bubbles: true
          }));

          // Dispatch standard cart:update event for consistency
          document.dispatchEvent(new CustomEvent('cart:update', {
            detail: { 
              source: 'cart-delete',
              lineItemId: this.#lineItemId,
              cart: data 
            },
            bubbles: true
          }));

        } catch (error) {
          if (error.name === 'AbortError') return; // Request was cancelled
          
          this.#logError(error);
          this.#setState('error');
          this.#dispatchErrorEvent('Failed to remove item from cart', error.message);
          navigator.vibrate?.(100);
        }
      }

      /**
       * Update dynamic sections with new cart data
       * @param {Object} sections - Section HTML data from response
       * @param {NodeList} dynamicSectionsNodes - Dynamic section nodes to update
       * @private
       */
      #updateDynamicSections(sections, dynamicSectionsNodes) {
        [...dynamicSectionsNodes].forEach((node) => {
          const htmlString = sections[node.dataset.sectionId];
          if (!htmlString) return;
          
          try {
            const html = new DOMParser().parseFromString(htmlString, 'text/html');
            const updated = html.querySelector(
              `cart-dynamic[data-section-id='${node.dataset.sectionId}']`
            );
            
            if (!updated) return;
            
            // Update the node content and classes
            node.innerHTML = updated.innerHTML;
            node.className = updated.className;
            
            // Call lifecycle hook if present
            if (typeof node.modified === 'function') {
              node.modified();
            }
          } catch (parseError) {
            this.#logError(new Error(`Failed to parse section HTML: ${parseError.message}`));
          }
        });
      }

      /**
       * Set component state for visual feedback
       * @param {string} state - State to set ('loading', 'success', 'error')
       * @private
       */
      #setState(state) {
        this.dataset.state = state;
        
        switch (state) {
          case 'loading':
            this.setAttribute('aria-disabled', 'true');
            this.setAttribute('aria-label', 'Removing item...');
            break;
          case 'error':
            this.removeAttribute('aria-disabled');
            this.setAttribute('aria-label', 'Error removing item');
            // Reset state after delay
            setTimeout(() => this.removeAttribute('data-state'), 3000);
            break;
          case 'success':
            this.removeAttribute('aria-disabled');
            this.setAttribute('aria-label', 'Item removed successfully');
            // Reset state after delay
            setTimeout(() => this.removeAttribute('data-state'), 3000);
            break;
        }
      }

      /**
       * Dispatch success event for parent components
       * @private
       */
      #dispatchSuccessEvent() {
        this.dispatchEvent(new CustomEvent('cart-delete:success', {
          detail: { lineItemId: this.#lineItemId },
          bubbles: true
        }));
      }

      /**
       * Dispatch error event for parent components
       * @param {string} message - Error message
       * @param {string} details - Error details
       * @private
       */
      #dispatchErrorEvent(message, details) {
        this.dispatchEvent(new CustomEvent('cart-delete:error', {
          detail: { 
            message, 
            details, 
            lineItemId: this.#lineItemId 
          },
          bubbles: true
        }));
      }

      /**
       * Get fetch configuration for cart operations
       * @param {string} type - Response type ('json', 'javascript')
       * @returns {Object} Fetch configuration object
       * @private
       */
      #getFetchConfig(type = 'json') {
        // Prefer global fetchConfig if available
        try {
          if (typeof fetchConfig === 'function') return fetchConfig(type);
        } catch (_) {}
        
        return {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: `application/${type}`,
          },
        };
      }

      /**
       * Log errors with component context
       * @param {Error} error - Error to log
       * @private
       */
      #logError(error) {
        console.error(`[cart-delete] Line item ${this.#lineItemId}:`, error);
      }

      /**
       * Clean up resources and event listeners
       * @private
       */
      #cleanup() {
        this.#isConnected = false;
        
        if (this.#abortController) {
          this.#abortController.abort();
          this.#abortController = null;
        }
        
        this.removeEventListener('click', this.deleteHandler);
        this.removeEventListener('keydown', this.#onKeydown.bind(this));
      }
    }
  );
}

customElements.define(
  "eye-in-the-sky",
  class EyeInTheSky extends HTMLElement {
    constructor() {
      super();
      this.password = document.getElementById(this.dataset.target);
    }

    connectedCallback() {
      this.addEventListener("click", () => this.handleClick());
    }

    handleClick() {
      this.classList.toggle("active");
      const isPassword = this.password.type === "password";
      this.password.type = isPassword ? "text" : "password";
    }
  },
);

class CartNote extends HTMLElement {
  constructor() {
    super();

    this.addEventListener(
      "change",
      debounce((event) => {
        const body = JSON.stringify({ note: event.target.value });
        fetch(`${routes.cart_update_url}`, { ...fetchConfig(), ...{ body } });
      }, 300),
    );
  }
}

customElements.define("cart-note", CartNote);
if (!customElements.get("slider-component")) {
  class SliderComponent extends HTMLElement {
    constructor() {
      super();
      this.slider = this.querySelector("ul");
      this.sliderItems = this.querySelectorAll(".slider-items");
      this.sliderThumbnails = this.querySelectorAll("slider-thumbnails li");
      this.pageCount = this.querySelector(".slider-counter--current");
      this.pageTotal = this.querySelector(".slider-counter--total");
      this.prevButton = this.querySelector('button[aria-label="previous"]');
      this.nextButton = this.querySelector('button[aria-label="next"]');

      this.initThumbnails();

      this.lightbox = this.querySelector(".lightbox");
      if (this.lightbox) this.initLightbox();

      if (!this.slider || !this.nextButton) return;

      const resizeObserver = new ResizeObserver((entries) => this.initPages());
      resizeObserver.observe(this.slider);

      this.slider.addEventListener("scroll", this.update.bind(this));
      this.prevButton.addEventListener("click", this.onButtonClick.bind(this));
      this.nextButton.addEventListener("click", this.onButtonClick.bind(this));

      this.initVideoListeners();
    }

    initPages() {
      if (!this.sliderItems.length === 0) return;
      this.slidesPerPage = Math.floor(
        this.slider.clientWidth / this.sliderItems[0].clientWidth,
      );
      this.totalPages = this.sliderItems.length - this.slidesPerPage + 1;
      this.update();
    }

    initThumbnails() {
      this.sliderThumbnails.forEach((thumb, index) => {
        thumb.addEventListener("click", () => {
          this.slideTo(index);
        });
      });
    }

    initVideoListeners() {
      const videoElements = this.querySelectorAll(
        "video, .js-youtube, .js-vimeo",
      );
      videoElements.forEach((video) => {
        // is video intersecting
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) {
              pauseThisMedia(video);
            } else {
              if (video.tagName === "VIDEO" && video.autoplay) video.play();
            }
          });
        });
        observer.observe(video);
      });
    }

    update() {
      this.currentPage =
        Math.round(this.slider.scrollLeft / this.sliderItems[0].clientWidth) +
        1;

      const img = this.sliderItems[this.currentPage]?.querySelector("img");
      if (img && !img.complete) {
        const image = new Image();
        image.src = img.src;
        if (img.srcset) image.srcset = img.srcset;
      }

      if (this.currentPage === 1) {
        this.prevButton.setAttribute("disabled", true);
      } else {
        this.prevButton.removeAttribute("disabled");
      }

      if (this.currentPage === this.totalPages) {
        this.nextButton.setAttribute("disabled", true);
      } else {
        this.nextButton.removeAttribute("disabled");
      }

      if (!this.pageCount || !this.pageTotal) return;
      this.pageCount.textContent = this.currentPage;
      this.pageTotal.textContent = this.totalPages;
    }

    slideTo(index) {
      this.slider.scrollTo({
        left: this.sliderItems[0].clientWidth * index,
      });
    }

    onButtonClick(event) {
      event.preventDefault();
      const slideScrollPosition =
        event.currentTarget.name === "next"
          ? this.slider.scrollLeft + this.sliderItems[0].clientWidth
          : this.slider.scrollLeft - this.sliderItems[0].clientWidth;
      this.slider.scrollTo({
        left: slideScrollPosition,
      });
    }

    initLightbox() {
      this.lightboxSlider = this.lightbox.querySelector("slider-component ul");
      this.sliderItems.forEach((item, index) => {
        const trigger = item.classList.contains("js-lightbox")
          ? item
          : item.querySelector(".js-lightbox");
        trigger?.addEventListener("click", () => {
          this.lightbox.querySelector("fader-component").activate(index);
          this.lightbox.classList.replace("hidden", "fixed");
          // record the scroll position
          this.scrollPosition = window.scrollY;
          document.body.classList.add("fixed");
        });
      });

      this.slider.addEventListener("scroll", (e) => {
        this.lightboxSlider.scrollLeft =
          (this.slider.scrollLeft / this.slider.scrollWidth) *
          this.lightboxSlider.scrollWidth;
      });

      this.lightboxCloser = this.lightbox.querySelector("#close-lightbox");

      this.lightboxCloser.addEventListener("click", () => {
        document.body.classList.remove("fixed");
        pauseAllMedia();
        this.lightbox.classList.replace("fixed", "hidden");
        // instant scroll
        window.scrollTo({
          top: this.scrollPosition,
          behavior: "instant",
        });
      });
    }
  }

  customElements.define("slider-component", SliderComponent);
}

if (!customElements.get("fader-component")) {
  class FaderComponent extends HTMLElement {
    constructor() {
      super();
      this.sliderItems = this.querySelectorAll(".fader-item");
      this.sliderThumbnails = this.querySelectorAll(`fader-thumbnails li`);
      this.initThumbnails();
    }

    initThumbnails() {
      this.sliderThumbnails.forEach((thumb, index) => {
        thumb.addEventListener("click", () => {
          this.activate(index);
        });
      });
    }

    activate(index) {
      this.querySelectorAll(".fader-item img").forEach((img) => {
        if (img.complete) return;
        const image = new Image();
        image.src = img.src;
        if (img.srcset) image.srcset = img.srcset;
      });
      this.sliderItems.forEach((item) => item.classList.add("hidden"));
      this.sliderItems[index].classList.remove("hidden");
    }
  }

  customElements.define("fader-component", FaderComponent);
}

if (!customElements.get("video-player")) {
  class VideoPlayer extends HTMLElement {
    connectedCallback() {
      this.template = this.querySelector("template");
      this.button = this.querySelector("._playButton");
      
      this.loaders();
      this.setIframeAspectRatio();
    }

    loaders() {
      if (!this.template) {
        return;
      }
      
      // Check if video has autoplay attribute - load immediately
      const videoInTemplate = this.template.content.querySelector('video');
      const iframeInTemplate = this.template.content.querySelector('iframe');
      const hasAutoplay = videoInTemplate?.hasAttribute('autoplay') || 
                         (iframeInTemplate && (iframeInTemplate.src.includes('autoplay=1') || iframeInTemplate.src.includes('autoplay=true')));
      
      if (hasAutoplay && !this.button) {
        this.load();
        return;
      }
      
      if (this.button) {
        this.button.addEventListener("click", this.load.bind(this));
        return;
      }
      
      const observer = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this.load();
              observer.unobserve(this);
            }
          });
        },
        { threshold: 0, rootMargin: "400px" },
      );
      observer.observe(this);
    }

    load() {
      if (this.button) {
        this.style.height = this.getBoundingClientRect().height + "px";
        this.style.width = this.getBoundingClientRect().width + "px";
        this.stopAllVideos();
      }
      
      const clonedContent = this.template.content.cloneNode(true);
      
      this.appendChild(clonedContent);
      this.button?.classList.add("hidden");
      
      const videoElement = this.querySelector('video');

      // Setup video controls and play video
      if (videoElement) {
        // Remove native controls if present (we're using custom controls)
        videoElement.removeAttribute('controls');
        
        // Add cursor pointer to video so users know it's clickable
        videoElement.style.cursor = 'pointer';
        
        // Setup controls immediately (they'll be hidden until video plays)
        this.setupVideoControls(videoElement);
        
        // If this was triggered by play button click, play the video
        if (this.button) {
          // Play video immediately when play button is clicked
          const playPromise = videoElement.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {});
          }
        } else if (videoElement.hasAttribute('autoplay')) {
          // Autoplay video - ensure it plays
          
          // Try to play immediately if ready, otherwise wait for canplay event
          if (videoElement.readyState >= 3) { // HAVE_FUTURE_DATA or higher
            this.playVideo(videoElement);
          } else {
            videoElement.addEventListener('canplay', () => {
              this.playVideo(videoElement);
            }, { once: true });
          }
        }
      }

      setTimeout(() => {
        this.style.height = "";
        this.style.width = "";
      }, 1000);
    }

    setupVideoControls(videoElement) {
      const controls = this.querySelector('._videoControls');
      if (!controls) {
        return;
      }

      const pausePlayButton = controls.querySelector('._pausePlayButton');
      const muteButton = controls.querySelector('._muteButton');
      const pauseIcon = controls.querySelector('._pauseIcon');
      const playIcon = controls.querySelector('._playIcon');
      const volumeIcon = controls.querySelector('._volumeIcon');
      const muteIcon = controls.querySelector('._muteIcon');

      if (!pausePlayButton || !muteButton) {
        return;
      }

      // Keep controls hidden initially - they'll show after video starts
      controls.classList.add('opacity-0');
      controls.classList.remove('opacity-100');
      controls.style.pointerEvents = 'auto'; // Always allow clicks even when hidden

      // Track if video has started playing
      let videoHasStarted = false;
      const markVideoStarted = () => {
        videoHasStarted = true;
        // Show controls when video starts
        controls.classList.remove('opacity-0');
        controls.classList.add('opacity-100');
      };
      videoElement.addEventListener('play', markVideoStarted, { once: true });
      // Also check if video is already playing or has played
      if (!videoElement.paused || videoElement.currentTime > 0) {
        videoHasStarted = true;
        controls.classList.remove('opacity-0');
        controls.classList.add('opacity-100');
      }

      // Show controls on hover (only after video has started)
      const showControlsOnHover = () => {
        if (videoHasStarted) {
          controls.classList.remove('opacity-0');
          controls.classList.add('opacity-100');
        }
      };

      const hideControlsOnLeave = () => {
        // Keep controls visible after video starts, only hide when mouse leaves
        if (videoHasStarted) {
          controls.classList.remove('opacity-100');
          controls.classList.add('opacity-0');
        }
      };

      // Show on hover over video player
      this.addEventListener('mouseenter', showControlsOnHover);
      this.addEventListener('mouseleave', hideControlsOnLeave);
      
      // Also show controls when hovering directly on controls
      controls.addEventListener('mouseenter', () => {
        if (videoHasStarted) {
          controls.classList.remove('opacity-0');
          controls.classList.add('opacity-100');
        }
      });
      
      controls.addEventListener('mouseleave', () => {
        // Check if we're still hovering over the video player
        setTimeout(() => {
          if (!this.matches(':hover')) {
            hideControlsOnLeave();
          }
        }, 50);
      });

      // Click on video element to pause/play
      videoElement.addEventListener('click', (e) => {
        // Don't toggle if clicking on controls
        const clickedControls = e.target.closest('._videoControls');
        if (clickedControls) {
          return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        
        if (videoElement.paused) {
          videoElement.play().catch(() => {});
        } else {
          videoElement.pause();
        }
      });

      // Pause/Play toggle button
      pausePlayButton.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        if (videoElement.paused) {
          videoElement.play().catch(() => {});
        } else {
          videoElement.pause();
        }
      });

      // Mute/Unmute toggle button
      muteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        videoElement.muted = !videoElement.muted;
        
        if (videoElement.muted) {
          volumeIcon.classList.add('hidden');
          muteIcon.classList.remove('hidden');
          muteButton.setAttribute('aria-label', 'Unmute video');
        } else {
          volumeIcon.classList.remove('hidden');
          muteIcon.classList.add('hidden');
          muteButton.setAttribute('aria-label', 'Mute video');
        }
      });

      // Update pause/play button icon when video state changes
      const updatePlayPauseIcon = () => {
        if (videoElement.paused) {
          pauseIcon.classList.add('hidden');
          playIcon.classList.remove('hidden');
          pausePlayButton.setAttribute('aria-label', 'Play video');
        } else {
          pauseIcon.classList.remove('hidden');
          playIcon.classList.add('hidden');
          pausePlayButton.setAttribute('aria-label', 'Pause video');
        }
      };

      videoElement.addEventListener('play', updatePlayPauseIcon);
      videoElement.addEventListener('pause', updatePlayPauseIcon);
      
      // Initialize icon state
      updatePlayPauseIcon();

      // Initialize mute icon state
      if (videoElement.muted) {
        volumeIcon.classList.add('hidden');
        muteIcon.classList.remove('hidden');
        muteButton.setAttribute('aria-label', 'Unmute video');
      } else {
        volumeIcon.classList.remove('hidden');
        muteIcon.classList.add('hidden');
        muteButton.setAttribute('aria-label', 'Mute video');
      }
    }

    playVideo(videoElement) {
      const playPromise = videoElement.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay was prevented, usually due to browser policy
          // This is expected behavior on some browsers/contexts
        });
      }
    }

    stopAllVideos() {
      const videos = document.querySelectorAll("video");
      videos.forEach((video) => {
        if (video !== this.querySelector("video") && !video.autoplay) {
          video.pause();
        }
      });

      const iframes = document.querySelectorAll("iframe");
      iframes.forEach((iframe) => {
        if (iframe !== this.querySelector("iframe")) {
          iframe.contentWindow.postMessage(
            JSON.stringify({ event: "command", func: "pauseVideo" }),
            "*",
          );
        }
      });
    }
    async setIframeAspectRatio() {
      if (!this.template) {
        return;
      }
      
      const iframe = this.template.content.querySelector("iframe");
      if (!iframe) {
        return;
      }
      
      if (iframe.src.includes("youtube")) {
        return;
      }
      
      const { width, height } = await this.getIframeWidthHeight(iframe);
      iframe.style.aspectRatio = `${width}/${height}`;
      
      if (this.querySelector("iframe")) {
        this.querySelector("iframe").style.aspectRatio = `${width}/${height}`;
        this.style.setProperty("--aspect-ratio", `${width} / ${height}`);
      }
    }
    
    async getIframeWidthHeight(iframe) {
      let url = `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${iframe.dataset.videoId}`;
      const { width, height } = await fetch(url).then((resp) => resp.json());
      return { width, height };
    }
  }
  customElements.define("video-player", VideoPlayer);
}
if (!customElements.get("pagination-element")) {
  class PaginationElement extends HTMLElement {
    connectedCallback() {
      if (!this.hasAttribute("data-section-fetcher-target")) return;
      this.sectionFetcherTarget = document.getElementById(
        this.dataset.sectionFetcherTarget,
      );
      this.querySelectorAll("a").forEach((link) => {
        // create new href from a href with sectionFetcherTarget's data-section-id value as a parameter to query key section_id
        const newHref = new URL(link.href);
        newHref.searchParams.set(
          "section_id",
          this.sectionFetcherTarget.dataset.sectionId,
        );
        link.href = newHref.toString();
      });
      delegate(this, "click", "a", this.onLinkClicked.bind(this));
      window.addEventListener("popstate", (event) => {
        this.handlePopState(event);
      });
    }

    handlePopState(event) {
      const page = event.state && event.state.page ? event.state.page : "1";

      const target = this.querySelector(`a[data-page="${page}"]`);

      if (target) {
        this.onLinkClicked(new Event("click"), target, true);
      }
    }

    onLinkClicked(event, target, isPopState = false) {
      event.preventDefault();

      const page = target.getAttribute("data-page");
      const searchParams = new URLSearchParams(window.location.search);
      target.style.position =
        getComputedStyle(target).position === "absolute" ? "" : "relative";
      target.innerHTML += window.icons.spinner;

      if (page === "1") {
        searchParams.delete("page");
      } else {
        searchParams.set("page", page);
      }

      const newUrl = `${window.location.pathname}${
        searchParams.toString() ? "?" + searchParams.toString() : ""
      }`;

      // if isPopState is false and the section fetcher url is the same with our current url, push a new state
      // this is to prevent pushing a new url state if we are on homepage etc.
      const targetPath = getPathWithoutQuery(
        this.sectionFetcherTarget.dataset.url,
      );
      const currentPath = getPathWithoutQuery(window.location.href);
      if (!isPopState && targetPath === currentPath) {
        window.history.pushState({ page: page }, "", newUrl);
      }

      triggerEvent(this, "pagination:page-changed", {
        searchParams: searchParams.toString(),
        sectionFetcherTarget: this.sectionFetcherTarget.id,
      });

      this.sectionFetcherTarget.dataset.skeletonItems =
        target.dataset.nextItems;
      this.sectionFetcherTarget.dataset.url = `${targetPath}${
        searchParams.toString() ? "?" + searchParams.toString() : ""
      }`;
    }
  }

  window.customElements.define("pagination-element", PaginationElement);
}

class GradientFinish extends HTMLElement {
  connectedCallback() {
    // reduce opacity when scroll of parent reaches end, parent could be vertical or horizontal scroll
    this.slider = document.querySelector(
      `[data-slider="${this.dataset.sliderTarget}"]`,
    );
    // find parent that has a class starting with bg-
    if (!this.slider) {
      this.remove();
      return;
    }

    // initial adjustment
    this.adjustColor();

    // Opacity adjustment is now handled by electric-dom-ready component
    // Set data attribute for the component to handle this slider
    this.slider.setAttribute('data-slider-opacity', 'true');

    // adjust opacity on scroll
    this.slider.addEventListener("scroll", this.adjustOpacity.bind(this));

    // adjust opacity on resize
    window.addEventListener(
      "resize",
      debounce(this.adjustOpacity.bind(this), 100),
    );
    // adjust opacity on resize
    window.addEventListener(
      "resize",
      debounce(this.adjustColor.bind(this), 400),
    );
  }

  adjustColor() {
    let bgParentWithStyle = this.parentElement.closest("[class*='bg-']");
    if (
      bgParentWithStyle &&
      getComputedStyle(bgParentWithStyle).backgroundColor === "rgba(0, 0, 0, 0)"
    ) {
      bgParentWithStyle =
        bgParentWithStyle.parentElement.closest("[class*='bg-']");
    }
    let bg = bgParentWithStyle
      ? getComputedStyle(bgParentWithStyle).backgroundColor
      : "white";
    this.style.setProperty("--from-bg", setOpacity(bg, 0.0));
    this.style.setProperty("--to-bg", setOpacity(bg, 1));
  }

  adjustOpacity() {
    const isVertical = this.slider.scrollHeight > this.slider.clientHeight;
    const isHorizontal = this.slider.scrollWidth > this.slider.clientWidth;

    let ratio = 1;

    if (isVertical) {
      const scrollEnd = this.slider.scrollHeight - this.slider.clientHeight;
      ratio = scrollEnd > 0 ? this.slider.scrollTop / scrollEnd : 1;
    } else if (isHorizontal) {
      const scrollEnd = this.slider.scrollWidth - this.slider.clientWidth;
      ratio = scrollEnd > 0 ? this.slider.scrollLeft / scrollEnd : 1;
    }

    this.style.opacity = ratio == 1 ? 0 : 1;
  }
}
customElements.define("gradient-finish", GradientFinish);

class ProductCard extends HTMLElement {
  connectedCallback() {
    let image = this.querySelector("img.js-lazyloadBlur");
    let placeholder = this.querySelector(".js-lazyloadBlurPlaceholder");
    if (!placeholder) return;
    if (image.complete) {
      placeholder.style.opacity = 0;
      setTimeout(() => {
        placeholder.remove();
      }, 100);
      return;
    }
    image.addEventListener("load", () => {
      placeholder.style.opacity = 0;
      setTimeout(() => {
        placeholder.remove();
      }, 100);
    });
  }
}
customElements.define("product-card", ProductCard);

if (!customElements.get("scroll-top")) {
  customElements.define(
    "scroll-top",
    class extends HTMLElement {
      connectedCallback() {
        window.addEventListener("scroll", this.toggle.bind(this));
      }
      disconnectedCallback() {
        window.removeEventListener("scroll", this.toggle.bind(this));
      }
      toggle() {
        this.dataset.fadeIn = window.scrollY > 200 ? true : false;
      }
    },
  );
}

if (!customElements.get("quantity-input")) {
  class QuantityInput extends HTMLElement {
    connectedCallback() {
      this.input = this.querySelector('input[name="quantity"]');
      this.changeEvent = new Event("change", { bubbles: true });
      this.form = this.querySelector("form");
      this.quantityDisplay = this.querySelector("[data-quantity-display]");

      this.querySelectorAll("button").forEach((button) =>
        button.addEventListener("click", this.onButtonClick.bind(this)),
      );
      this.input.addEventListener("change", this.onInputChange.bind(this));
    }

    onButtonClick(event) {
      event.preventDefault();
      this.previousValue = this.input?.value;

      event.currentTarget.ariaLabel === "plus"
        ? this.input.stepUp()
        : this.input.stepDown();

      if (this.dataset.mode == "qty") return;

      if (this.previousValue !== this.input.value)
        this.input.dispatchEvent(this.changeEvent);
      this.querySelector(".hide-when-spinner")?.classList.add("opacity-0");
      const spinner = this.querySelector(".spinner");
      if (spinner) {
        spinner.classList.remove("hidden");
        spinner.querySelector("svg").classList.add("animate-spin");
      }

      document.querySelectorAll(".cart-spinner").forEach((spinner) => {
        spinner.classList.remove("hidden");
      });
    }

    onInputChange(event) {
      const config = fetchConfig("javascript");
      config.headers["X-Requested-With"] = "XMLHttpRequest";
      delete config.headers["Content-Type"];

      const formData = new FormData(this.form);

      this.dynamicSectionsNodes = document.querySelectorAll("cart-dynamic");

      let dynamicSections = [];
      if (this.dynamicSectionsNodes) {
        dynamicSections = [...this.dynamicSectionsNodes].map(
          (item) => item.dataset.sectionId,
        );
      }

      formData.append("sections", dynamicSections.join(","));
      config.body = formData;

      let url =
        this.dataset.quantity == 0
          ? routes.cart_add_url
          : routes.cart_change_url;

      fetch(url, config)
        .then((response) => response.json())
        .then((response) => {
          if (response.status === 422) {
            this.input.value = this.previousValue;
            this.handleErrorMessage(response.message);
          }
          if (
            response.item_count === 0 &&
            window.location.pathname === "/cart"
          ) {
            window.location.reload();
          }

          this.response = response;

          let cartItem =
            this.dataset.quantity == 0
              ? response
              : response.items.find(
                  (item) => item.variant_id == this.dataset.id,
                );

          this.dataset.quantity = cartItem ? cartItem.quantity : 0;
          this.quantityDisplay.innerText = this.dataset.quantity;

          this.updateClones();

          // update dynamic sections
          this.dynamicSectionsNodes.forEach((node) => {
            const htmlString = this.response.sections[node.dataset.sectionId];
            const html = new DOMParser().parseFromString(
              htmlString,
              "text/html",
            );
            node.animate([{ opacity: 0 }, { opacity: 1 }], {
              duration: 150,
              easing: "ease-in-out",
              fill: "forwards",
            });
            node.innerHTML = html.querySelector(
              `cart-dynamic[data-section-id='${node.dataset.sectionId}']`,
            ).innerHTML;
            node.classList = html.querySelector(
              `cart-dynamic[data-section-id='${node.dataset.sectionId}']`,
            ).classList;
            node.animate([{ opacity: 0 }, { opacity: 1 }], {
              duration: 150,
              easing: "ease-in-out",
              fill: "forwards",
            });
            node.modified();
          });

          // if the cart is updated, trigger the event
          // add the tag name of this
          triggerEvent(document, "cart:update", {
            source: this.tagName.toLowerCase(),
            found: response.item_count > 0,
          });
        })
        .catch((e) => {
          console.error(e);
        })
        .finally(() => {
          const spinner = this.querySelector(".spinner");
          if (spinner) {
            spinner.classList.add("hidden");
            spinner.querySelector("svg").classList.remove("animate-spin");
          }
          this.querySelector(".hide-when-spinner")?.classList.remove(
            "opacity-0",
          );
          document.querySelectorAll(".cart-spinner").forEach((spinner) => {
            spinner.classList.add("hidden");
          });
        });
    }

    updateClones() {
      const clones = document.querySelectorAll(
        `quantity-input[data-id="${this.dataset.id}"]:not([data-mode="qty"])`,
      );

      for (const clone of clones) {
        if (clone == this) continue;
        if (clone.dataset.linkMode == "true") continue;

        clone.dataset.quantity = this.dataset.quantity;
        clone.quantityDisplay.innerText = this.dataset.quantity;
        clone.input.value = this.dataset.quantity;
      }
    }

    handleErrorMessage(errorMessage = false) {
      this.errorMessageWrappers =
        this.errorMessageWrappers || this.querySelectorAll("error-message");

      this.errorMessageWrappers.forEach((errorMessageWrapper) => {
        if (errorMessage) {
          const errorMessageOutput = errorMessageWrapper.querySelector("span");
          errorMessageOutput.textContent = errorMessage;
          errorMessageWrapper.classList.remove("hidden");
          setTimeout(() => {
            errorMessageWrapper.classList.add("hidden");
          }, 3000);
        } else {
          errorMessageWrapper.classList.add("hidden");
        }
      });
      throw new Error(errorMessage);
    }
  }
  customElements.define("quantity-input", QuantityInput);
}

// Click-on-load functionality is now handled by electric-dom-ready component
// This ensures it works even when scripts are injected after DOM is ready

/**
 * Mobile Popover System
 * 
 * Handles lightweight mobile popovers that appear below trigger elements
 * and disappear when clicking anywhere or clicking the trigger again.
 * Uses CSS-only animations for smooth performance.
 */
class MobilePopoverManager {
  /** @type {HTMLElement | null} Currently open popover */
  #currentPopover = null;
  /** @type {HTMLElement | null} Currently active trigger */
  #currentTrigger = null;
  /** @type {AbortController | null} Event listener controller */
  #abortController = null;

  constructor() {
    this.#initialize();
  }

  /**
   * Initialize the popover system
   * @private
   */
  #initialize() {
    this.#setupEventListeners();
  }

  /**
   * Setup event listeners for popover triggers and document clicks
   * @private
   */
  #setupEventListeners() {
    this.#abortController = new AbortController();
    
    // Handle popover triggers
    document.addEventListener('click', this.#handleTriggerClick.bind(this), {
      signal: this.#abortController.signal
    });
    
    // Handle document clicks to close popovers
    document.addEventListener('click', this.#handleDocumentClick.bind(this), {
      signal: this.#abortController.signal
    });
    
    // Handle escape key to close popovers
    document.addEventListener('keydown', this.#handleKeydown.bind(this), {
      signal: this.#abortController.signal
    });
  }

  /**
   * Handle clicks on popover trigger elements
   * @param {Event} event - Click event
   * @private
   */
  #handleTriggerClick(event) {
    const trigger = event.target.closest('[data-popover-trigger]');
    if (!trigger) return;

    event.preventDefault();
    event.stopPropagation();

    const popoverId = trigger.dataset.popoverTrigger;
    const popover = document.getElementById(popoverId);
    
    if (!popover) return;

    // If clicking the same trigger, toggle the popover
    if (this.#currentTrigger === trigger && this.#currentPopover === popover) {
      this.#closePopover();
      return;
    }

    // Close any existing popover
    this.#closePopover();

    // Open the new popover
    this.#openPopover(popover, trigger);
  }

  /**
   * Handle document clicks to close popovers
   * @param {Event} event - Click event
   * @private
   */
  #handleDocumentClick(event) {
    // Don't close if clicking inside the popover or on the trigger
    if (event.target.closest('[data-popover]') || 
        event.target.closest('[data-popover-trigger]')) {
      return;
    }

    this.#closePopover();
  }

  /**
   * Handle keyboard events (escape key)
   * @param {Event} event - Keydown event
   * @private
   */
  #handleKeydown(event) {
    if (event.key === 'Escape') {
      this.#closePopover();
    }
  }

  /**
   * Open a popover
   * @param {HTMLElement} popover - Popover element to open
   * @param {HTMLElement} trigger - Trigger element that opened the popover
   * @private
   */
  #openPopover(popover, trigger) {
    this.#currentPopover = popover;
    this.#currentTrigger = trigger;

    // Show the popover with animation
    popover.style.opacity = '1';
    popover.style.pointerEvents = 'auto';
    
    // Add active state to trigger
    trigger.setAttribute('aria-expanded', 'true');
    
    // Dispatch custom event
    popover.dispatchEvent(new CustomEvent('popover:opened', {
      detail: { trigger, popover },
      bubbles: true
    }));
  }

  /**
   * Close the currently open popover
   * @private
   */
  #closePopover() {
    if (!this.#currentPopover || !this.#currentTrigger) return;

    // Hide the popover with animation
    this.#currentPopover.style.opacity = '0';
    this.#currentPopover.style.pointerEvents = 'none';
    
    // Remove active state from trigger
    this.#currentTrigger.setAttribute('aria-expanded', 'false');
    
    // Dispatch custom event
    this.#currentPopover.dispatchEvent(new CustomEvent('popover:closed', {
      detail: { trigger: this.#currentTrigger, popover: this.#currentPopover },
      bubbles: true
    }));

    // Clear references
    this.#currentPopover = null;
    this.#currentTrigger = null;
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.#closePopover();
    this.#abortController?.abort();
    this.#abortController = null;
  }
}

// Initialize mobile popover system
const mobilePopoverManager = new MobilePopoverManager();


class MenuDrawer extends HTMLElement {
  constructor() {
    super();

    this.mainDetailsToggle = this.querySelector("details");

    this.addEventListener("keyup", this.onKeyUp.bind(this));
    this.addEventListener("focusout", this.onFocusOut.bind(this));
    this.bindEvents();
    
    // Listen for search events to close drawer
    this.boundSearchOpenedHandler = this.#handleSearchOpened.bind(this);
    document.addEventListener('search:opened', this.boundSearchOpenedHandler);
  }

  bindEvents() {
    this.querySelectorAll("summary").forEach((summary) =>
      summary.addEventListener("click", this.onSummaryClick.bind(this)),
    );
    this.querySelectorAll("button:not(.dropdown-trigger)").forEach((button) =>
      button.addEventListener("click", this.onCloseButtonClick.bind(this)),
    );
  }

  onKeyUp(event) {
    if (event.code.toUpperCase() !== "ESCAPE") return;

    const openDetailsElement =
      event.target.parentElement.closest("details[open]");
    if (!openDetailsElement) return;

    openDetailsElement === this.mainDetailsToggle
      ? this.closeMenuDrawer(
          event,
          this.mainDetailsToggle.querySelector("summary"),
        )
      : this.closeSubmenu(openDetailsElement);
  }

  onSummaryClick(event) {
    const summaryElement = event.currentTarget;
    const detailsElement = summaryElement.parentNode;
    const parentMenuElement =
      detailsElement.parentElement.closest(".has-submenu");
    const isOpen = detailsElement.hasAttribute("open");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const input = summaryElement.querySelector("input");
    if (input) input.checked = !input.checked;

    function addTrapFocus() {
      trapFocus(
        summaryElement.nextElementSibling,
        detailsElement.querySelector("button"),
      );
      summaryElement.nextElementSibling.removeEventListener(
        "transitionend",
        addTrapFocus,
      );
    }

    if (detailsElement === this.mainDetailsToggle) {
      if (isOpen) event.preventDefault();
      isOpen
        ? this.closeMenuDrawer(event, summaryElement)
        : this.openMenuDrawer(summaryElement);

      if (window.matchMedia("(max-width: 990px)")) {
        document.documentElement.style.setProperty(
          "--viewport-height",
          `${window.innerHeight}px`,
        );
      }
    } else {
      setTimeout(() => {
        detailsElement.classList.add("menu-opening");
        summaryElement.setAttribute("aria-expanded", true);
        parentMenuElement && parentMenuElement.classList.add("submenu-open");
        !reducedMotion || reducedMotion.matches
          ? addTrapFocus()
          : summaryElement.nextElementSibling.addEventListener(
              "transitionend",
              addTrapFocus,
            );
      }, 1);
    }
  }

  openMenuDrawer(summaryElement) {
    setTimeout(() => {
      this.mainDetailsToggle.classList.add("menu-opening");
    });
    summaryElement.setAttribute("aria-expanded", true);
    trapFocus(this.mainDetailsToggle, summaryElement);
    document.body.classList.add(`overflow-hidden`);
  }

  closeMenuDrawer(event, elementToFocus = false) {
    if (event === undefined) return;

    // this.mainDetailsToggle.removeAttribute("open");
    this.mainDetailsToggle.classList.remove("menu-opening");
    this.mainDetailsToggle.querySelectorAll("details").forEach((details) => {
      details.removeAttribute("open");
      details.classList.remove("menu-opening");
    });
    this.mainDetailsToggle
      .querySelectorAll(".submenu-open")
      .forEach((submenu) => {
        submenu.classList.remove("submenu-open");
      });
    document.body.classList.remove(`overflow-hidden`);
    removeTrapFocus(elementToFocus);
    this.closeAnimation(this.mainDetailsToggle);

    if (event instanceof KeyboardEvent)
      elementToFocus?.setAttribute("aria-expanded", false);
  }

  onFocusOut(e) {
    setTimeout(() => {
      if (
        this.mainDetailsToggle.hasAttribute("open") &&
        !this.mainDetailsToggle.contains(document.activeElement)
      )
        this.closeMenuDrawer();
    });
  }

  onCloseButtonClick(event) {
    const detailsElement = event.currentTarget.parentElement.closest("details");
    this.closeSubmenu(detailsElement);
  }

  closeSubmenu(detailsElement) {
    const parentMenuElement =
      detailsElement.parentElement.closest(".submenu-open");
    parentMenuElement && parentMenuElement.classList.remove("submenu-open");
    detailsElement.classList.remove("menu-opening");
    detailsElement
      .querySelector("summary")
      .setAttribute("aria-expanded", false);
    removeTrapFocus(detailsElement.querySelector("summary"));
    this.closeAnimation(detailsElement);
  }

  closeAnimation(detailsElement) {
    let animationStart;

    const handleAnimation = (time) => {
      if (animationStart === undefined) {
        animationStart = time;
      }

      const elapsedTime = time - animationStart;

      if (elapsedTime < 1) {
        window.requestAnimationFrame(handleAnimation);
      } else {
        detailsElement.removeAttribute("open");
        if (detailsElement.parentElement.closest("details[open]")) {
          trapFocus(
            detailsElement.parentElement.closest("details[open]"),
            detailsElement.querySelector("summary"),
          );
        }
      }
    };

    window.requestAnimationFrame(handleAnimation);
  }

  /**
   * Handle search opened event by closing the drawer
   * @param {CustomEvent} event - The search opened event
   * @private
   */
  #handleSearchOpened(event) {
    // Check if drawer is open and close it
    if (this.mainDetailsToggle && this.mainDetailsToggle.hasAttribute('open')) {
      const summaryElement = this.mainDetailsToggle.querySelector('summary');
      this.closeMenuDrawer(event, summaryElement);
    }
  }

  /**
   * Cleanup event listeners when element is removed
   */
  disconnectedCallback() {
    if (this.boundSearchOpenedHandler) {
      document.removeEventListener('search:opened', this.boundSearchOpenedHandler);
    }
  }
}

customElements.define("menu-drawer", MenuDrawer);
/**
 * HeaderDrawer - Mobile menu drawer component for header navigation
 * 
 * Extends MenuDrawer to provide mobile-specific navigation functionality
 * with proper focus management and responsive behavior.
 * 
 * @extends MenuDrawer
 * @fires menu:opened - When the menu drawer is opened
 * @fires menu:closed - When the menu drawer is closed
 * 
 * @example
 * <header-drawer>
 *   <details id="menu-drawer">
 *     <summary>Menu</summary>
 *     <nav>...</nav>
 *   </details>
 * </header-drawer>
 */
class HeaderDrawer extends MenuDrawer {
  // Private fields
  #header = null;
  #menuDrawer = null;
  #resizeHandler = null;
  
  constructor() {
    super();
    
    // Bind event handlers
    this.#resizeHandler = this.#handleResize.bind(this);
  }
  
  connectedCallback() {
    super.connectedCallback?.();
    
    try {
      this.#setupDOM();
      this.#adjustMenuPosition();
    } catch (error) {
      console.error('HeaderDrawer: Error in connectedCallback', error);
    }
  }
  
  /**
   * Opens the menu drawer with proper animations and focus management
   * @param {HTMLElement} summaryElement - The summary element that triggered opening
   */
  openMenuDrawer(summaryElement) {
    try {
      document.body.classList.add("overflow-hidden");
      this.#header = this.#header || document.querySelector("header-element");
      
      if (this.#header) {
        this.#header.classList.add("menu-open");
      }
      
      setTimeout(() => {
        this.mainDetailsToggle?.classList.add("menu-opening");
      });
      
      summaryElement.setAttribute("aria-expanded", "true");
      window.addEventListener("resize", this.#resizeHandler);
      
      // Call parent's focus trap if available
      if (typeof trapFocus === 'function') {
        trapFocus(this.mainDetailsToggle, summaryElement);
      }
      
      
      this.dispatchEvent(new CustomEvent('menu:opened', {
        bubbles: true,
        detail: { drawer: this }
      }));
    } catch (error) {
      console.error('HeaderDrawer: Error opening menu', error);
    }
  }
  
  /**
   * Closes the menu drawer and restores focus
   * @param {Event} event - The event that triggered closing
   * @param {HTMLElement} elementToFocus - Element to focus after closing
   */
  closeMenuDrawer(event, elementToFocus) {
    if (!elementToFocus) return;
    
    try {
      super.closeMenuDrawer?.(event, elementToFocus);
      
      if (this.#header) {
        this.#header.classList.remove("menu-open");
      }
      
      window.removeEventListener("resize", this.#resizeHandler);
      
      this.dispatchEvent(new CustomEvent('menu:closed', {
        bubbles: true,
        detail: { drawer: this }
      }));
    } catch (error) {
      console.error('HeaderDrawer: Error closing menu', error);
    }
  }
  
  // Private methods
  #setupDOM() {
    this.#menuDrawer = this.querySelector("#menu-drawer");
  }
  
  #adjustMenuPosition() {
    if (!this.#menuDrawer) return;
    
    const headerElement = document.querySelector("header-element");
    if (!headerElement) return;
    
    const computedStyle = window.getComputedStyle(headerElement);
    const paddingBottom = parseInt(computedStyle.paddingBottom, 10) || 0;
    
    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    this.#menuDrawer.style.marginTop = `-${paddingBottom / rootFontSize}rem`;
  }
  
  #handleResize() {
    if (!this.#header) return;
    
    const rect = this.#header.getBoundingClientRect();
    const bottomPosition = rect.bottom - (this.borderOffset || 0);
    
    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    document.documentElement.style.setProperty(
      "--header-bottom-position",
      `${(Math.round(bottomPosition) / rootFontSize)}rem`
    );
    
    document.documentElement.style.setProperty(
      "--viewport-height",
      `${(window.innerHeight / rootFontSize)}rem`
    );
  }
}

// Register custom element
if (!customElements.get("header-drawer")) {
  customElements.define("header-drawer", HeaderDrawer);
}

/**
 * HeaderElement - Advanced sticky header component with scroll-based visibility
 * 
 * Provides a high-performance sticky header that hides/shows based on scroll
 * direction and position. Includes comprehensive state management and 
 * accessibility features.
 * 
 * @fires header:state-change - When header state changes
 * @fires header:visibility-change - When header visibility changes
 * 
 * @example
 * <header-element data-sticky="true">
 *   <div class="js-announcement-bar">...</div>
 *   <nav class="header__desktop-navigation">...</nav>
 * </header-element>
 * 
 * @example CSS usage with state attributes
 * header-element[data-visibility="hidden"] { transform: translateY(-100%); }
 * header-element[data-threshold-passed="true"] { backdrop-filter: blur(10px); }
 * header-element[data-scroll-range="far"] { background: solid; }
 */
class HeaderElement extends HTMLElement {
  // Private fields
  #isConnected = false;
  #abortController = null;
  #rafId = null;
  #scrollTimeout = null;
  #resizeTimeout = null;
  #transitionTimeout = null;
  #lastScrollTime = 0;
  #isViewportZoomed = false;
  #viewportZoomResetTimeout = null;
  #viewportScale = 1;
  
  // DOM references
  #header = null;
  #announcementBar = null;
  #headerOffset = null;
  
  // Event handlers
  #scrollHandler = null;
  #resizeHandler = null;
  
  // State management
  #state = {
    scrollPosition: 0,
    lastScrollPosition: 0,
    headerHeight: 0,
    announcementHeight: 0,
    visibility: 'visible',
    scrollDirection: 'none',
    thresholdPassed: false,
    isTransitioning: false,
    animationDuration: 300,
    isSticky: false
  };
  
  // Configuration
  #config = {
    threshold: 200,
    thresholdHysteresis: 20, // Prevents oscillation near threshold
    scrollDebounceDelay: 10,
    resizeDebounceDelay: 150,
    hideOffset: 5,
    showOffset: 5,
    lastStateChangeTime: 0,
    minStateChangeInterval: 100 // Minimum time between state changes
  };
  
  // Constants
  static #TRANSITION_DELAY = 500;
  static #VIEWPORT_ZOOM_RESET_DELAY = 250;
  
  // Observed attributes
  static observedAttributes = ["data-sticky"];
  
  constructor() {
    super();
    
    // Bind event handlers
    this.#scrollHandler = this.#handleScroll.bind(this);
    this.#resizeHandler = this.#handleResize.bind(this);
  }
  
  connectedCallback() {
    if (this.#isConnected) return;
    
    try {
      this.#setupDOM();
      
      if (!this.#state.isSticky || !this.#header) {
        this.#isConnected = true;
        return;
      }
      
      this.#setupAnimationDurations();
      this.#setupHeaderOffset();
      this.#setupHeaderStickyOffset();
      this.#updateHeaderHeight();
      this.#setupEventListeners();
      this.#setupInitialStickyState();
      
      // Set initial scroll position
      this.#state.scrollPosition = window.scrollY || document.documentElement.scrollTop;
      this.#state.lastScrollPosition = this.#state.scrollPosition;
      
      this.#updateStateAttributes();
      
      this.#isConnected = true;
      
      this.dispatchEvent(new CustomEvent('header:ready', {
        detail: { header: this },
        bubbles: true
      }));
    } catch (error) {
      console.error('HeaderElement: Error in connectedCallback', error);
    }
  }
  
  disconnectedCallback() {
    if (!this.#isConnected) return;
    
    try {
      this.#cleanup();
      this.#isConnected = false;
    } catch (error) {
      console.error('HeaderElement: Error in disconnectedCallback', error);
    }
  }
  
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    
    if (name === "data-sticky") {
      this.#state.isSticky = newValue === "true";
      
      if (this.#isConnected) {
        if (this.#state.isSticky) {
          this.#setupEventListeners();
        } else {
          this.#cleanup();
        }
      }
    }
  }
  
  // Public API methods
  /**
   * Get current header state
   * @returns {Object} Current state object
   */
  getState() {
    return { ...this.#state };
  }
  
  /**
   * Force show the header
   */
  show() {
    this.#showHeader();
  }
  
  /**
   * Force hide the header
   */
  hide() {
    this.#hideHeader();
  }
  
  /**
   * Update header sticky offset CSS variable
   * Public method to allow external components to trigger offset recalculation
   */
  updateHeaderStickyOffset() {
    this.#setupHeaderStickyOffset();
  }
  
  // Private methods
  #setupDOM() {
    this.#header = this.closest(".header-elements");
    this.#announcementBar = this.querySelector(".js-announcement-bar");
    this.#state.isSticky = this.dataset.sticky === "true";
  }
  
  #setupAnimationDurations() {
    if (!this.#header) return;
    
    const computedStyle = window.getComputedStyle(this.#header);
    const transitionDuration = computedStyle.transitionDuration || '0.3s';
    
    const durationInMs = transitionDuration.includes('ms') 
      ? parseFloat(transitionDuration)
      : parseFloat(transitionDuration) * 1000;
    
    this.#state.animationDuration = durationInMs || 300;
  }
  
  #setupHeaderOffset() {
    const setHeaderOffset = () => {
      const headerElements = document.querySelectorAll("header-element");
      if (!headerElements.length) return;
      
      const headerHeight = Array.from(headerElements).reduce(
        (acc, el) => acc + el.offsetHeight,
        0
      );
      
      const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
      document.body.style.setProperty("--header-offset", `${(headerHeight) / rootFontSize}rem`);
    };
    
    setHeaderOffset();
  }
  
  #setupHeaderStickyOffset() {
    setTimeout(() => {
      if (!this.isConnected) return;
      
      const mainHeader = this.querySelector('.header__main');
      const promoBanner = this.querySelector('promo-banner');
      let headerHeight = mainHeader?.offsetHeight || 0;

      // Add promoBanner height if data-threshold-passed is true
      // MAYBE CALL THIS WHEN THREHOLD PASSED STATE IS CHANGED?
      if (promoBanner && this.getAttribute('data-threshold-passed') !== 'true') {
        headerHeight += promoBanner.offsetHeight || 0;
      }
      
      const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
      document.body.style.setProperty(
        "--header-sticky-offset",
        `${(headerHeight) / rootFontSize}rem`
      );
    }, HeaderElement.#TRANSITION_DELAY);
  }
  
  #setupInitialStickyState() {
    if (!this.#header) return;
    
    this.#headerOffset = document.createElement("div");
    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    this.#headerOffset.style.height = `${this.#state.headerHeight / rootFontSize}rem`;
    this.#headerOffset.className = 
      "absolute inset-0 bg-background1 shopify-section-group-header-group";
    this.#headerOffset.setAttribute("aria-hidden", "true");
    
    this.#header.classList.add(
      "transition-transform",
      "duration-300",
      "sticky",
      "top-0",
      "z-20",
      "bg-transparent"
    );
  }
  
  #setupEventListeners() {
    // Create abort controller for cleanup
    this.#abortController = new AbortController();
    const { signal } = this.#abortController;

    this.#setupViewportZoomDetection(signal);
    
    // Throttled scroll handler
    const throttledScroll = this.#throttle(
      this.#scrollHandler,
      this.#config.scrollDebounceDelay
    );
    
    // Debounced resize handler
    const debouncedResize = this.#debounce(
      this.#resizeHandler,
      this.#config.resizeDebounceDelay
    );
    
    // Add listeners with signal
    window.addEventListener("scroll", throttledScroll, { 
      passive: true, 
      signal 
    });
    
    window.addEventListener("resize", debouncedResize, { 
      signal 
    });
    
    document.addEventListener("promo-banner:closed", this.#handlePromoBannerClosed.bind(this), { 
      signal 
    });
    
    document.addEventListener("promo-banner:visible", this.#handlePromoBannerVisible.bind(this), { 
      signal 
    });
  }

  #setupViewportZoomDetection(signal) {
    const viewport = window.visualViewport;
    if (!viewport || typeof viewport.scale !== "number") return;

    const scheduleReset = () => {
      clearTimeout(this.#viewportZoomResetTimeout);
      this.#viewportZoomResetTimeout = setTimeout(() => {
        if (Math.abs((this.#viewportScale || 1) - 1) < 0.001) {
          this.#setViewportZoomed(false);
        }
      }, HeaderElement.#VIEWPORT_ZOOM_RESET_DELAY);
    };

    const handleViewportChange = () => {
      const scale = viewport.scale || 1;
      this.#viewportScale = scale;

      const isZoomed = Math.abs(scale - 1) > 0.001;
      this.#setViewportZoomed(isZoomed);
      scheduleReset();
    };

    viewport.addEventListener("resize", handleViewportChange, { passive: true, signal });
    viewport.addEventListener("scroll", handleViewportChange, { passive: true, signal });

    handleViewportChange();
  }

  #setViewportZoomed(isZoomed) {
    if (this.#isViewportZoomed === isZoomed) return;
    this.#isViewportZoomed = isZoomed;

    const html = document.documentElement;
    if (isZoomed) {
      html.setAttribute("data-viewport-zoomed", "true");

      // Stabilize header state while zooming to reduce layout + GPU pressure
      this.#state.visibility = "visible";
      this.#state.isTransitioning = false;
      if (this.#header) {
        this.#header.classList.remove("-translate-y-(--header-offset)");
      }
    } else {
      html.removeAttribute("data-viewport-zoomed");
    }
  }
  
  #cleanup() {
    // Abort all event listeners
    this.#abortController?.abort();
    this.#abortController = null;
    
    // Cancel animation frames
    if (this.#rafId) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }
    
    // Clear timeouts
    clearTimeout(this.#scrollTimeout);
    clearTimeout(this.#resizeTimeout);
    clearTimeout(this.#transitionTimeout);
    clearTimeout(this.#viewportZoomResetTimeout);
    
    // Reset state
    this.#state.visibility = 'visible';
    this.#state.isTransitioning = false;
  }
  
  #updateHeaderHeight() {
    if (!this.#header) return;
    
    this.#state.headerHeight = this.#header.offsetHeight;
    this.#state.announcementHeight = this.#announcementBar?.offsetHeight || 0;
    
    if (this.#headerOffset) {
      const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
      this.#headerOffset.style.height = `${this.#state.headerHeight / rootFontSize}rem`;
    }
  }
  
  // Event handlers
  #handleScroll() {
    if (this.#isViewportZoomed) return;
    const now = Date.now();
    if (now - this.#lastScrollTime < this.#config.scrollDebounceDelay) {
      return;
    }
    this.#lastScrollTime = now;
    
    // Cancel previous frame
    if (this.#rafId) {
      cancelAnimationFrame(this.#rafId);
    }
    
    // Schedule update in next frame
    this.#rafId = requestAnimationFrame(() => {
      this.#updateScrollState();
    });
  }
  
  #handleResize() {
    if (this.#isViewportZoomed) return;
    try {
      this.#setupHeaderOffset();
      this.#updateHeaderHeight();
      this.#setupHeaderStickyOffset();
    } catch (error) {
      console.error('HeaderElement: Error handling resize', error);
    }
  }
  
  #handlePromoBannerClosed() {
    try {
      this.#setupHeaderOffset();
      this.#setupHeaderStickyOffset();
    } catch (error) {
      console.error('HeaderElement: Error handling promo banner close', error);
    }
  }

  #handlePromoBannerVisible() {
    try {
      this.#setupHeaderOffset();
      this.#setupHeaderStickyOffset();
    } catch (error) {
      console.error('HeaderElement: Error handling promo banner visible', error);
    }
  }
  
  #updateScrollState() {
    if (this.#isViewportZoomed) return;
    const scrollPosition = window.scrollY || document.documentElement.scrollTop;
    const scrollDelta = scrollPosition - this.#state.lastScrollPosition;
    
    this.#state.scrollPosition = scrollPosition;
    
    // Set scroll direction
    if (Math.abs(scrollDelta) < 1) {
      this.#state.scrollDirection = 'none';
    } else {
      this.#state.scrollDirection = scrollDelta > 0 ? 'down' : 'up';
    }
    
    // Check threshold with hysteresis to prevent oscillation
    const wasThresholdPassed = this.#state.thresholdPassed;
    if (!wasThresholdPassed && scrollPosition > this.#config.threshold + this.#config.thresholdHysteresis) {
      this.#state.thresholdPassed = true;
    } else if (wasThresholdPassed && scrollPosition < this.#config.threshold - this.#config.thresholdHysteresis) {
      this.#state.thresholdPassed = false;
    }
    
    // Always update state attributes to ensure scroll range is current
    this.#updateStateAttributes();
    
    // Handle header visibility only for significant movements
    if (Math.abs(scrollDelta) >= 1) {
      this.#handleHeaderVisibility(scrollPosition, scrollDelta);
    }
    
    this.#state.lastScrollPosition = scrollPosition;
  }
  
  #handleHeaderVisibility(scrollPosition, scrollDelta) {
    // Prevent rapid state changes
    const now = Date.now();
    if (now - this.#config.lastStateChangeTime < this.#config.minStateChangeInterval) {
      return;
    }
    
    // Always show header when at the top of the page
    if (scrollPosition <= this.#state.announcementHeight) {
      if (this.#state.visibility !== 'visible' && this.#state.visibility !== 'showing') {
        this.#showHeader();
        this.#config.lastStateChangeTime = now;
      }
      return;
    }
    
    const isHidden = this.#state.visibility === 'hidden' || this.#state.visibility === 'hiding';
    const isVisible = this.#state.visibility === 'visible' || this.#state.visibility === 'showing';
    
    const shouldHide = 
      this.#state.thresholdPassed && 
      scrollDelta > this.#config.hideOffset && 
      !isHidden;
    
    const shouldShow = 
      scrollDelta < -this.#config.showOffset &&
      !isVisible;
    
    if (shouldHide) {
      this.#hideHeader();
      this.#config.lastStateChangeTime = now;
    } else if (shouldShow) {
      this.#showHeader();
      this.#config.lastStateChangeTime = now;
    }
  }
  
  #hideHeader() {
    if (this.#state.visibility === 'hidden') return;
    
    // Clear any pending show transition
    clearTimeout(this.#transitionTimeout);
    
    this.#state.isTransitioning = true;
    this.#state.visibility = 'hiding';
    this.#updateStateAttributes();
    
    if (this.#header) {
      this.#header.classList.add("-translate-y-(--header-offset)");
    }
    
    this.#transitionTimeout = setTimeout(() => {
      // Only finalize hide if we're still in hiding state
      if (this.#state.visibility === 'hiding') {
        this.#state.visibility = 'hidden';
        this.#state.isTransitioning = false;
        this.#updateStateAttributes();
        // Delay sticky offset update to prevent layout shift during scroll
        setTimeout(() => {
          if (this.#state.visibility === 'hidden') {
            this.#setupHeaderStickyOffset();
          }
        }, 100);
        
        this.dispatchEvent(new CustomEvent('header:visibility-change', {
          detail: { visibility: 'hidden' },
          bubbles: true
        }));
      }
    }, this.#state.animationDuration);
  }
  
  #showHeader() {
    if (this.#state.visibility === 'visible') return;
    
    // Clear any pending hide transition
    clearTimeout(this.#transitionTimeout);
    
    this.#state.isTransitioning = true;
    this.#state.visibility = 'showing';
    this.#updateStateAttributes();
    
    if (this.#header) {
      this.#header.classList.remove("-translate-y-(--header-offset)");
    }
    
    this.#transitionTimeout = setTimeout(() => {
      // Only finalize show if we're still in showing state
      if (this.#state.visibility === 'showing') {
        this.#state.visibility = 'visible';
        this.#state.isTransitioning = false;
        this.#updateStateAttributes();
        // Delay sticky offset update to prevent layout shift during scroll
        setTimeout(() => {
          if (this.#state.visibility === 'visible') {
            this.#setupHeaderStickyOffset();
          }
        }, 100);
        
        this.dispatchEvent(new CustomEvent('header:visibility-change', {
          detail: { visibility: 'visible' },
          bubbles: true
        }));
      }
    }, this.#state.animationDuration);
  }
  
  #updateStateAttributes() {
    // Set visibility states
    this.setAttribute('data-visibility', this.#state.visibility);
    this.setAttribute('data-scroll-direction', this.#state.scrollDirection);
    this.setAttribute('data-threshold-passed', String(this.#state.thresholdPassed));
    this.setAttribute('data-scroll-position', String(Math.round(this.#state.scrollPosition)));
    this.setAttribute('data-scrolled', String(this.#state.scrollPosition > 0));
    
    // Update HTML tag with header visibility state
    const isVisible = this.#state.visibility === 'visible' || this.#state.visibility === 'showing';
    const htmlElement = document.documentElement;
    
    if (isVisible) {
      htmlElement.setAttribute('data-header-visible', 'true');
    } else {
      htmlElement.removeAttribute('data-header-visible');
    }
    
    // Set scroll range
    const scrollPosition = this.#state.scrollPosition;
    let scrollRangeName = 'top';
    
    if (scrollPosition < 50) {
      scrollRangeName = 'top';
    } else if (scrollPosition < 150) {
      scrollRangeName = 'near-top';
    } else if (scrollPosition < 1000) {
      scrollRangeName = 'mid';
    } else {
      scrollRangeName = 'far';
    }
    
    this.setAttribute('data-scroll-range', scrollRangeName);
    htmlElement.setAttribute('data-scroll-range', scrollRangeName);
    
    // Dispatch state change event
    this.dispatchEvent(new CustomEvent('header:state-change', {
      detail: {
        visibility: this.#state.visibility,
        scrollDirection: this.#state.scrollDirection,
        thresholdPassed: this.#state.thresholdPassed,
        scrollPosition: this.#state.scrollPosition,
        isTransitioning: this.#state.isTransitioning
      },
      bubbles: true
    }));
  }
  
  // Utility methods
  #throttle(func, delay) {
    let lastCall = 0;
    let timeout = null;
    
    return (...args) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCall;
      
      if (timeSinceLastCall >= delay) {
        lastCall = now;
        func.apply(this, args);
      } else {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          lastCall = Date.now();
          func.apply(this, args);
        }, delay - timeSinceLastCall);
      }
    };
  }
  
  #debounce(func, delay) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  }
  
  // Static utility methods
  /**
   * Find header element by selector
   * @param {string} selector - CSS selector
   * @returns {HeaderElement|null}
   */
  static find(selector) {
    return document.querySelector(selector);
  }
  
  /**
   * Get all header elements
   * @returns {NodeList}
   */
  static findAll() {
    return document.querySelectorAll('header-element');
  }
}

// Register custom element
if (!customElements.get("header-element")) {
  customElements.define("header-element", HeaderElement);
}

/**
 * LocalizationForm - Handles language and country selection
 * 
 * Manages form submission for changing locale settings with
 * accessible dropdown interactions.
 * 
 * @fires localization:change - When locale is changed
 * 
 * @example
 * <localization-form>
 *   <form>
 *     <input name="language_code" type="hidden">
 *     <a data-value="en">English</a>
 *     <a data-value="fr">Français</a>
 *   </form>
 * </localization-form>
 */
class LocalizationForm extends HTMLElement {
  // Private fields
  #isConnected = false;
  #form = null;
  #input = null;
  #links = [];
  #abortController = null;
  
  constructor() {
    super();
  }
  
  connectedCallback() {
    if (this.#isConnected) return;
    
    try {
      this.#setupDOM();
      this.#setupEventListeners();
      this.#isConnected = true;
    } catch (error) {
      console.error('LocalizationForm: Error in connectedCallback', error);
    }
  }
  
  disconnectedCallback() {
    if (!this.#isConnected) return;
    
    try {
      this.#cleanup();
      this.#isConnected = false;
    } catch (error) {
      console.error('LocalizationForm: Error in disconnectedCallback', error);
    }
  }
  
  // Private methods
  #setupDOM() {
    this.#form = this.querySelector("form");
    this.#input = this.querySelector(
      'input[name="language_code"], input[name="locale_code"], input[name="country_code"]'
    );
    this.#links = Array.from(this.querySelectorAll("a[data-value]"));
  }
  
  #setupEventListeners() {
    if (!this.#links.length) return;
    
    this.#abortController = new AbortController();
    const { signal } = this.#abortController;
    
    this.#links.forEach(link => {
      link.addEventListener("click", this.#handleItemClick.bind(this), { signal });
    });
  }
  
  #cleanup() {
    this.#abortController?.abort();
    this.#abortController = null;
  }
  
  #handleItemClick(event) {
    event.preventDefault();
    
    if (!this.#input || !this.#form) return;
    
    try {
      const value = event.currentTarget.dataset.value;
      this.#input.value = value;
      
      this.dispatchEvent(new CustomEvent('localization:change', {
        detail: { value, form: this.#form },
        bubbles: true,
        cancelable: true
      }));
      
      this.#form.submit();
    } catch (error) {
      console.error('LocalizationForm: Error handling click', error);
    }
  }
}

// Register custom element
if (!customElements.get("localization-form")) {
  customElements.define("localization-form", LocalizationForm);
}

/**
 * CountryStateProvinceSelector - Dynamic location-based dealer selector
 * 
 * Provides a multi-level selector for country, state/province with
 * dynamic dealer results display based on selection.
 * 
 * @fires dealer:selected - When a dealer location is selected
 * @fires dealer:cleared - When dealer results are cleared
 * 
 * @example
 * <country-state-province-selector data-dealers='[...]' data-inline="false">
 *   <select id="country">...</select>
 *   <select id="states">...</select>
 *   <select id="province">...</select>
 *   <div id="dealer-results"></div>
 * </country-state-province-selector>
 */
class CountryStateProvinceSelector extends HTMLElement {
  // Private fields
  #isConnected = false;
  #abortController = null;
  
  // DOM elements
  #countrySelect = null;
  #stateSelect = null;
  #provinceSelect = null;
  #dealerBox = null;
  
  // Data
  #cleanedDealers = [];
  #rawDealers = [];
  
  // Event handlers
  #countryChangeHandler = null;
  #stateChangeHandler = null;
  
  constructor() {
    super();
    
    // Bind event handlers
    this.#countryChangeHandler = this.#handleCountryChange.bind(this);
    this.#stateChangeHandler = this.#handleStateProvinceChange.bind(this);
  }
  
  connectedCallback() {
    if (this.#isConnected) return;
    
    try {
      this.#setupDOM();
      this.#processDealerData();
      this.#setupEventListeners();
      this.#initializeSelectors();
      
      this.#isConnected = true;
      
      this.dispatchEvent(new CustomEvent('selector:ready', {
        detail: { selector: this },
        bubbles: true
      }));
    } catch (error) {
      console.error('CountryStateProvinceSelector: Error in connectedCallback', error);
    }
  }
  
  disconnectedCallback() {
    if (!this.#isConnected) return;
    
    try {
      this.#cleanup();
      this.#isConnected = false;
    } catch (error) {
      console.error('CountryStateProvinceSelector: Error in disconnectedCallback', error);
    }
  }
  
  // Private methods
  #setupDOM() {
    this.#countrySelect = this.querySelector('#country');
    this.#stateSelect = this.querySelector('#states');
    this.#provinceSelect = this.querySelector('#province');
    this.#dealerBox = this.querySelector('#dealer-results');
  }
  
  #processDealerData() {
    try {
      const dealersData = this.dataset.dealers;
      if (!dealersData) return;
      
      this.#rawDealers = JSON.parse(dealersData);
      
      this.#cleanedDealers = this.#rawDealers.map(dealer => ({
        address: dealer.address?.replaceAll('\\n', '<br>') || '',
        contact_info: dealer.contact_info?.replaceAll('\\n', '<br>') || '',
        country: this.#normalize(dealer.country),
        google_maps: dealer.google_maps?.replaceAll('\\/', '/') || '',
        name: dealer.name || '',
        state: this.#normalize(dealer.state),
        logo: dealer.logo || ''
      }));
    } catch (error) {
      console.error('CountryStateProvinceSelector: Error processing dealer data', error);
      this.#cleanedDealers = [];
    }
  }
  
  #setupEventListeners() {
    this.#abortController = new AbortController();
    const { signal } = this.#abortController;
    
    this.#countrySelect?.addEventListener('change', this.#countryChangeHandler, { signal });
    this.#stateSelect?.addEventListener('change', this.#stateChangeHandler, { signal });
    this.#provinceSelect?.addEventListener('change', this.#stateChangeHandler, { signal });
  }
  
  #cleanup() {
    this.#abortController?.abort();
    this.#abortController = null;
    this.#cleanedDealers = [];
    this.#rawDealers = [];
  }
  
  #initializeSelectors() {
    this.#hideStateProvinceSelectors();
    this.#clearDealerResults();
  }
  
  #handleCountryChange() {
    try {
      this.#hideStateProvinceSelectors();
      
      const countryValue = this.#countrySelect?.value;
      
      if (countryValue === 'us') {
        this.#showStateSelector();
      } else if (countryValue === 'ca') {
        this.#showProvinceSelector();
      } else {
        this.#showCountryDealers();
      }
    } catch (error) {
      console.error('CountryStateProvinceSelector: Error handling country change', error);
    }
  }
  
  #handleStateProvinceChange() {
    try {
      const selectedCountry = this.#getSelectedCountryText();
      const regionSelect = this.#countrySelect?.value === 'us' 
        ? this.#stateSelect 
        : this.#provinceSelect;
      const selectedRegion = this.#normalize(regionSelect?.value || '');
      
      const matching = this.#cleanedDealers.filter(d =>
        d.country === selectedCountry &&
        d.state.includes(selectedRegion)
      );
      
      this.#updateDealerResults(matching);
    } catch (error) {
      console.error('CountryStateProvinceSelector: Error handling state/province change', error);
    }
  }
  
  #showStateSelector() {
    if (!this.#stateSelect) return;
    
    this.#stateSelect.style.display = 'block';
    this.#stateSelect.disabled = false;
    
    const icon = this.#stateSelect.parentElement?.querySelector('.pointer-events-none.absolute.right-4');
    if (icon) icon.style.display = 'block';
    
    if (this.#stateSelect.value) {
      this.#handleStateProvinceChange();
    } else {
      this.#clearDealerResults();
    }
  }
  
  #showProvinceSelector() {
    if (!this.#provinceSelect) return;
    
    this.#provinceSelect.style.display = 'block';
    this.#provinceSelect.disabled = false;
    
    const icon = this.#provinceSelect.parentElement?.querySelector('.pointer-events-none.absolute.right-4');
    if (icon) icon.style.display = 'block';
    
    if (this.#provinceSelect.value) {
      this.#handleStateProvinceChange();
    } else {
      this.#clearDealerResults();
    }
  }
  
  #showCountryDealers() {
    const selectedCountry = this.#getSelectedCountryText();
    const matching = this.#cleanedDealers.filter(d => d.country === selectedCountry);
    this.#updateDealerResults(matching);
  }
  
  #getSelectedCountryText() {
    if (!this.#countrySelect) return '';
    
    const selectedOption = this.#countrySelect.options[this.#countrySelect.selectedIndex];
    return this.#normalize(selectedOption?.text || '');
  }
  
  #updateDealerResults(matchingDealers) {
    if (!this.#dealerBox) return;
    
    this.#dealerBox.innerHTML = '';
    this.#dealerBox.style.display = '';
    
    if (matchingDealers && matchingDealers.length > 0) {
      const html = matchingDealers.map(dealer => this.#createDealerCard(dealer)).join('');
      this.#dealerBox.innerHTML = html;
      
      this.dispatchEvent(new CustomEvent('dealer:selected', {
        detail: { dealers: matchingDealers },
        bubbles: true
      }));
    } else {
      this.#showHQFallback();
    }
  }
  
  #createDealerCard(dealer) {
    const cardClass = this.dataset.inline === 'false' 
      ? 'p-4 lg:p-12 lg:w-1/3 w-full' 
      : '';
    
    return `
      <div class="uppercase bg-beige ${cardClass}">
        ${dealer.logo ? `
          <img src="${dealer.logo}" 
               alt="${dealer.name} logo" 
               class="w-48 object-contain mb-6" 
               loading="lazy" 
               decoding="async" />
        ` : ''}
        <h4 class="font-bold mb-2">${dealer.name}</h4>
        <p>${dealer.address}</p>
        <h4 class="font-bold mt-4 mb-2">Contact</h4>
        <p>${dealer.contact_info}</p>
        ${dealer.google_maps ? `
          <a href="${dealer.google_maps}" 
             class="underline mt-2 block"
             target="_blank"
             rel="noopener noreferrer">
            Open Google Maps
          </a>
        ` : ''}
      </div>
    `;
  }
  
  #clearDealerResults() {
    if (!this.#dealerBox) return;
    
    this.#dealerBox.innerHTML = '';
    this.#dealerBox.style.display = 'none';
    
    this.dispatchEvent(new CustomEvent('dealer:cleared', {
      bubbles: true
    }));
  }
  
  #hideStateProvinceSelectors() {
    [this.#stateSelect, this.#provinceSelect].forEach(selector => {
      if (!selector) return;
      
      selector.style.display = 'none';
      selector.disabled = true;
      
      const icon = selector.parentElement?.querySelector('.pointer-events-none.absolute.right-4');
      if (icon) {
        icon.style.display = 'none';
      }
    });
  }
  
  #showHQFallback() {
    const hq = this.#cleanedDealers.find(d => 
      d.name.toLowerCase().includes('hq')
    );
    
    if (hq) {
      this.#dealerBox.innerHTML = this.#createDealerCard(hq);
    } else {
      this.#dealerBox.innerHTML = '<p>No dealers found.</p>';
    }
  }
  
  #normalize(str) {
    // This function should be implemented based on your normalization needs
    // For now, returning lowercase trimmed string
    return (str || '').toLowerCase().trim();
  }
  
  // Static utility methods
  /**
   * Find selector by ID
   * @param {string} id - Element ID
   * @returns {CountryStateProvinceSelector|null}
   */
  static find(id) {
    return document.getElementById(id);
  }
}

// Register custom element
if (!customElements.get('country-state-province-selector')) {
  customElements.define('country-state-province-selector', CountryStateProvinceSelector);
}

// Module exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    HeaderDrawer,
    HeaderElement,
    LocalizationForm,
    CountryStateProvinceSelector
  };
}