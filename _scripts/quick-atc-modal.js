/**
 * Debug logging function that only logs if 'debug_quick_atc=1' is present in URL query parameters
 * @param {...any} args - Arguments to log
 */
function debugLog(...args) {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('debug_quick_atc') === '1') {
    console.log(...args);
  }
}

/**
 * QuickATCTrigger Web Component
 *
 * Custom element that automatically initializes when connected to DOM.
 * Manages quick add-to-cart modal functionality with product content preloading
 * and dynamic section fetching.
 *
 * Features:
 * - Auto-initialization via connectedCallback
 * - Hover-based content preloading
 * - Modal state management
 * - Automatic cleanup on disconnect
 *
 * @example
 * // HTML markup (auto-initialized when added to DOM):
 * <quick-atc-trigger data-modal-id="quick-atc-modal-123"
 *                    data-product-handle="product-handle"
 *                    data-product-url="/products/handle?section_id=product--main">
 *   <button data-modal-trigger="quick-atc-modal-123">Quick Add</button>
 * </quick-atc-trigger>
 */
class QuickATCTrigger extends HTMLElement {
  #modalId = '';
  #productHandle = '';
  #productUrl = '';
  #isInitialized = false;
  #preloadedHTML = null;
  #isLoading = false;
  #abortController = null;
  #modalOpenHandler = null;
  #modalCloseHandler = null;
  #hoverHandler = null;

  /**
   * Web Component lifecycle - called when element is added to DOM
   */
  connectedCallback() {
    debugLog('🔌 QuickATCTrigger: Connected to DOM');
    this.#init();
  }

  /**
   * Web Component lifecycle - called when element is removed from DOM
   */
  disconnectedCallback() {
    debugLog('🔌 QuickATCTrigger: Disconnected from DOM');
    this.#cleanup();
  }

  /**
   * Initialize the component
   * @private
   */
  #init() {
    if (this.#isInitialized) return;

    // Extract data from attributes
    this.#modalId = this.dataset.modalId || '';
    this.#productHandle = this.dataset.productHandle || '';
    this.#productUrl = this.dataset.productUrl || '';

    if (!this.#modalId || !this.#productHandle || !this.#productUrl) {
      console.warn('⚠️ QuickATCTrigger: Missing required data attributes', {
        modalId: this.#modalId,
        productHandle: this.#productHandle,
        productUrl: this.#productUrl
      });
      return;
    }

    // Ensure product URL has section_id parameter for product--quick-atc section
    this.#productUrl = this.#ensureSectionId(this.#productUrl);

    debugLog('✅ QuickATCTrigger: Initializing', {
      modalId: this.#modalId,
      productHandle: this.#productHandle,
      productUrl: this.#productUrl
    });

    try {
      this.#setupEventListeners();
      this.#addHoverListeners();
      this.#isInitialized = true;
    } catch (error) {
      this.#handleError('Failed to initialize QuickATCTrigger', error);
    }
  }

  /**
   * Ensure the URL has the section_id parameter for product--quick-atc
   * @param {string} url - The product URL
   * @returns {string} URL with section_id parameter
   * @private
   */
  #ensureSectionId(url) {
    try {
      // Parse the URL
      const urlObj = new URL(url, window.location.origin);

      // Check if section_id is already present
      if (!urlObj.searchParams.has('section_id')) {
        // Add section_id=product--quick-atc parameter
        urlObj.searchParams.set('section_id', 'product--quick-atc');
      }

      // Return the pathname + search params (relative URL)
      return urlObj.pathname + urlObj.search;
    } catch (error) {
      console.warn('⚠️ QuickATCTrigger: Failed to parse URL, using as-is', error);
      // Fallback: append section_id if not present
      const separator = url.includes('?') ? '&' : '?';
      return url.includes('section_id') ? url : `${url}${separator}section_id=product--quick-atc`;
    }
  }

  /**
   * Setup event listeners for modal operations
   * @private
   */
  #setupEventListeners() {
    // Create bound handlers for cleanup
    this.#modalOpenHandler = this.#handleModalOpen.bind(this);
    this.#modalCloseHandler = this.#handleModalClose.bind(this);

    // Listen for modal events
    document.addEventListener('modal:open', this.#modalOpenHandler, { passive: true });
    document.addEventListener('modal:close', this.#modalCloseHandler, { passive: true });
  }

  /**
   * Add hover listener for content preloading
   * @private
   */
  #addHoverListeners() {
    // Find parent product card or use self as hover target
    const hoverTarget = this.closest('.product-card') || this;

    this.#hoverHandler = () => {
      if (!this.#preloadedHTML && !this.#isLoading) {
        this.#preloadContent();
      }
    };

    hoverTarget.addEventListener('mouseenter', this.#hoverHandler, { once: true, passive: true });
  }

  /**
   * Preload product content for faster modal display
   * @private
   */
  async #preloadContent() {
    if (this.#isLoading || this.#preloadedHTML) return;

    debugLog('🔄 QuickATCTrigger: Preloading content', { modalId: this.#modalId });
    this.#isLoading = true;

    try {
      this.#abortController = new AbortController();

      const response = await fetch(this.#productUrl, {
        signal: this.#abortController.signal,
        headers: {
          'Accept': 'text/html',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      this.#preloadedHTML = html;
      this.#isLoading = false;

      debugLog('✅ QuickATCTrigger: Preload successful', { modalId: this.#modalId });

      // Dispatch preload success event
      this.dispatchEvent(new CustomEvent('quick-atc:preload-success', {
        detail: { productHandle: this.#productHandle, modalId: this.#modalId },
        bubbles: true
      }));

    } catch (error) {
      this.#isLoading = false;
      if (error.name !== 'AbortError') {
        console.error('❌ QuickATCTrigger: Preload failed', error);
        this.#preloadedHTML = null;
      }
    }
  }

  /**
   * Handle modal open events
   * @private
   */
  async #handleModalOpen(event) {
    const { modalId } = event.detail || {};
    if (modalId !== this.#modalId) return;

    debugLog('🚀 QuickATCTrigger: Handling modal open', { modalId: this.#modalId });

    // Show loading state when modal opens
    this.#setLoadingState(true);

    try {
      // Wait for modal DOM
      await new Promise(resolve => setTimeout(resolve, 50));

      const modalElements = this.#getModalElements();
      if (!modalElements) {
        console.error('❌ QuickATCTrigger: Modal elements not found');
        this.#setLoadingState(false);
        return;
      }

      const { loadingEl, errorEl, productEl } = modalElements;

      if (this.#preloadedHTML) {
        debugLog('✅ QuickATCTrigger: Using preloaded content');
        this.#displayContent(productEl, this.#preloadedHTML);
        this.#setLoadingState(false);
      } else {
        debugLog('🔄 QuickATCTrigger: Fetching content...');
        // Don't hide content if we don't have loading elements
        if (loadingEl) {
          this.#showState(loadingEl);
        }
        await this.#fetchAndDisplayContent(productEl, errorEl);
        this.#setLoadingState(false);
      }
    } catch (error) {
      this.#handleError('Failed to handle modal open', error);
      this.#setLoadingState(false);
    }
  }

  /**
   * Handle modal close events
   * @private
   */
  #handleModalClose(event) {
    const { modalId } = event.detail || {};
    if (modalId === this.#modalId) {
      if (this.#abortController) {
        this.#abortController.abort();
        this.#abortController = null;
      }
      // Reset loading state when modal closes
      this.#setLoadingState(false);
    }
  }

  /**
   * Set loading state for the trigger button
   * @param {boolean} isLoading - Whether to show loading state
   * @private
   */
  #setLoadingState(isLoading) {
    const triggerButton = this.querySelector('[data-quick-atc-trigger]') ||
                         document.querySelector(`[data-quick-atc-trigger="${this.#modalId}"]`);
    if (!triggerButton) return;

    const iconElement = triggerButton.querySelector('[data-icon]');
    const spinnerElement = triggerButton.querySelector('[data-spinner]');

    if (isLoading) {
      triggerButton.disabled = true;
      triggerButton.setAttribute('aria-label', 'Loading product...');
      if (iconElement) iconElement.classList.add('opacity-0');
      if (spinnerElement) spinnerElement.classList.remove('hidden');
    } else {
      triggerButton.disabled = false;
      const productTitle = this.#productHandle || 'product';
      triggerButton.setAttribute('aria-label', `Quick add ${productTitle} to cart`);
      if (iconElement) iconElement.classList.remove('opacity-0');
      if (spinnerElement) spinnerElement.classList.add('hidden');
    }
  }

  /**
   * Get modal DOM elements
   * @private
   */
  #getModalElements() {
    const modal = document.getElementById('electric-modal-container');
    if (!modal) return null;

    const modalContent = modal.querySelector('.electric-modal-content');
    if (!modalContent) return null;

    // Look for the section-fetcher element which contains the actual content
    const sectionFetcher = modalContent.querySelector('section-fetcher');

    return {
      loadingEl: modalContent.querySelector('.quick-atc-loading'),
      errorEl: modalContent.querySelector('.quick-atc-error'),
      productEl: sectionFetcher || modalContent.querySelector('.quick-atc-product-content')
    };
  }

  /**
   * Fetch and display product content
   * @private
   */
  async #fetchAndDisplayContent(productEl, errorEl) {
    try {
      this.#abortController = new AbortController();

      const response = await fetch(this.#productUrl, {
        signal: this.#abortController.signal,
        headers: {
          'Accept': 'text/html',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      this.#preloadedHTML = html;
      this.#displayContent(productEl, html);

    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('❌ QuickATCTrigger: Fetch failed', error);
        this.#showState(errorEl);
      }
    }
  }

  /**
   * Display product content in modal
   * @private
   */
  #displayContent(productEl, html) {
    if (!productEl) return;

    try {
      productEl.innerHTML = html;

      // Reinitialize Shopify scripts
      if (window.Shopify?.PaymentButton?.init) {
        window.Shopify.PaymentButton.init();
      }
      if (window.ProductForm?.init) {
        window.ProductForm.init();
      }

      // Dispatch content loaded event
      this.dispatchEvent(new CustomEvent('quick-atc:content-loaded', {
        detail: { productHandle: this.#productHandle, modalId: this.#modalId },
        bubbles: true
      }));

      // Only show state if we have loading/error elements to manage
      const modal = document.getElementById('electric-modal-container');
      if (modal?.querySelector('.quick-atc-loading')) {
        this.#showState(productEl);
      }

    } catch (error) {
      console.error('❌ QuickATCTrigger: Failed to display content', error);
    }
  }

  /**
   * Show specific modal state
   * @private
   */
  #showState(elementToShow) {
    const modalElements = this.#getModalElements();
    if (!modalElements) return;

    const { loadingEl, errorEl, productEl } = modalElements;

    // Hide all states
    [loadingEl, errorEl, productEl].forEach(el => {
      if (el) el.classList.add('hidden');
    });

    // Show specified state
    if (elementToShow) {
      elementToShow.classList.remove('hidden');
    }
  }

  /**
   * Handle errors
   * @private
   */
  #handleError(message, error) {
    console.error(`QuickATCTrigger [${this.#modalId}]: ${message}`, error);

    this.dispatchEvent(new CustomEvent('quick-atc:error', {
      detail: {
        message,
        error: error.message,
        modalId: this.#modalId,
        productHandle: this.#productHandle
      },
      bubbles: true
    }));
  }

  /**
   * Cleanup resources
   * @private
   */
  #cleanup() {
    // Abort any ongoing requests
    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }

    // Remove event listeners
    if (this.#modalOpenHandler) {
      document.removeEventListener('modal:open', this.#modalOpenHandler);
    }
    if (this.#modalCloseHandler) {
      document.removeEventListener('modal:close', this.#modalCloseHandler);
    }

    // Remove hover listener
    if (this.#hoverHandler) {
      const hoverTarget = this.closest('.product-card') || this;
      hoverTarget.removeEventListener('mouseenter', this.#hoverHandler);
    }

    // Clear state
    this.#isInitialized = false;
    this.#preloadedHTML = null;
  }
}

// Register the custom element
customElements.define('quick-atc-trigger', QuickATCTrigger);

/**
 * Legacy support - convert existing buttons to web components
 * This observer watches for dynamically added elements with data-quick-atc-trigger
 * and wraps them in the custom element
 */
class QuickATCLegacyAdapter {
  #observer = null;
  #processedElements = new WeakSet();

  constructor() {
    this.#init();
  }

  #init() {
    // Process existing elements
    this.#processExistingElements();

    // Setup mutation observer for dynamic content
    this.#setupObserver();
  }

  #processExistingElements() {
    const triggers = document.querySelectorAll('[data-quick-atc-trigger]:not(quick-atc-trigger [data-quick-atc-trigger])');
    triggers.forEach(trigger => this.#wrapTrigger(trigger));
  }

  #wrapTrigger(trigger) {
    // Skip if already processed
    if (this.#processedElements.has(trigger)) return;
    if (trigger.closest('quick-atc-trigger')) return;

    const modalId = trigger.dataset.quickAtcTrigger;
    const productHandle = trigger.dataset.modalProductHandle;
    let productUrl = trigger.dataset.modalProductUrl;

    if (!modalId || !productHandle || !productUrl) return;

    debugLog('🔄 QuickATCLegacyAdapter: Converting legacy trigger', { modalId, productUrl });

    // Create web component wrapper
    const wrapper = document.createElement('quick-atc-trigger');
    wrapper.dataset.modalId = modalId;
    wrapper.dataset.productHandle = productHandle;
    wrapper.dataset.productUrl = productUrl;

    // Wrap the trigger element
    trigger.parentNode.insertBefore(wrapper, trigger);
    wrapper.appendChild(trigger);

    this.#processedElements.add(trigger);
  }

  #setupObserver() {
    this.#observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if the node itself is a trigger
              if (node.matches?.('[data-quick-atc-trigger]:not(quick-atc-trigger [data-quick-atc-trigger])')) {
                this.#wrapTrigger(node);
              }

              // Check for triggers within the node
              const triggers = node.querySelectorAll?.('[data-quick-atc-trigger]:not(quick-atc-trigger [data-quick-atc-trigger])');
              triggers?.forEach(trigger => this.#wrapTrigger(trigger));
            }
          });
        }
      }
    });

    this.#observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  destroy() {
    if (this.#observer) {
      this.#observer.disconnect();
      this.#observer = null;
    }
  }
}

// Initialize legacy adapter when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.quickATCLegacyAdapter = new QuickATCLegacyAdapter();
  });
} else {
  window.quickATCLegacyAdapter = new QuickATCLegacyAdapter();
}

// Global handler for quick-atc button clicks to show spinner
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-quick-atc-trigger]');
  if (button) {
    const iconElement = button.querySelector('[data-icon]');
    const spinnerElement = button.querySelector('[data-spinner]');

    if (iconElement && spinnerElement) {
      iconElement.classList.add('opacity-0');
      spinnerElement.classList.remove('hidden');
    }
  }
}, true);

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { QuickATCTrigger, QuickATCLegacyAdapter };
}