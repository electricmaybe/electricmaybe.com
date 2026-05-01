/**
 * Dynamic section loader for Shopify themes (Refactored)
 * 
 * Handles lazy loading, content replacement, and URL-based updates
 * for Shopify theme sections with performance optimizations.
 * 
 * @example
 * <electric-section 
 *   data-section-id="collection-main"
 *   data-url="/collections/all"
 *   data-animate="true"
 *   data-onload="true"
 *   data-fire-event="section-updated">
 * </electric-section>
 * 
 * @example
 * // With custom event trigger
 * <electric-section 
 *   data-section-id="product-grid"
 *   data-load-on-event="filter-changed"
 *   data-animate="false">
 * </electric-section>
 * 
 * @example
 * // Prefetch and fetch events
 * const section = document.querySelector('electric-section');
 * 
 * // Prefetch content without replacing
 * section.dispatchEvent(new CustomEvent('electric-section:prefetch', {
 *   detail: { url: '/collections/all?sort_by=price-ascending' }
 * }));
 * 
 * // Fetch and replace content immediately
 * section.dispatchEvent(new CustomEvent('electric-section:fetch', {
 *   detail: { url: '/collections/all?sort_by=price-descending' }
 * }));
 */
class ElectricSection extends HTMLElement {
  // Private fields
  #intersectionObserver = null;
  #isInitializing = true;
  #lastFetchedUrl = null;
  #debouncedCheckAndFetch = null;
  #temporaryData = new WeakMap();
  #connectionState = 'disconnected';

  // Observed attributes for reactive updates
  static observedAttributes = [
    "data-url",
    "data-section-id",
    "data-selector",
    "data-animate",
    "data-fire-event",
    "data-onload",
    "data-load-on-event",
    "data-to-keep",
    "data-disable-pop-events"
  ];

  // Relevant URL parameters for change detection
  static #RELEVANT_PARAMS = new Set([
    "sort_by",
    "page",
    "q",
    "view",
    "limit"
  ]);

  constructor() {
    super();
    
    // Use new functional utilities for debouncing
    this.#debouncedCheckAndFetch = FunctionalUtils.debounce(
      this.#checkAndFetch.bind(this),
      250
    );
  }

  /**
   * Called when element is connected to DOM
   * @private
   */
  connectedCallback() {
    if (this.#connectionState === 'connected') return;
    
    try {
      this.#setupInitialState();
      this.#addEventListeners();
      this.#restoreTemporaryData();
      
      // Setup lazy loading if enabled
      if (this.dataset.onload === "true") {
        this.#setupIntersectionObserver();
      }
      
      this.#isInitializing = false;
      this.#connectionState = 'connected';
      
      // Use new DOM utilities for event dispatching
      DOMUtils.dispatchEvent(this, 'electric-section-ready', { 
        sectionId: this.#getSectionId() 
      });
      
    } catch (error) {
      console.error('[ElectricSection] Initialization error:', error);
      DOMUtils.dispatchEvent(this, 'electric-section-error', { error });
    }
  }

  /**
   * Called when element is disconnected from DOM
   * @private
   */
  disconnectedCallback() {
    this.#connectionState = 'disconnected';
    this.#removeEventListeners();
    this.#removeIntersectionObserver();
  }

  /**
   * Called when observed attributes change
   * @param {string} name - Attribute name
   * @param {string} oldValue - Previous value
   * @param {string} newValue - New value
   * @private
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || this.#isInitializing) return;

    switch (name) {
      case 'data-url':
        // Pass the new URL value to ensure we use the updated value
        this.#debouncedCheckAndFetch(false, true, newValue);
        break;
      case 'data-onload':
        if (newValue === "true") {
          this.#setupIntersectionObserver();
        } else {
          this.#removeIntersectionObserver();
        }
        break;
    }
  }

  /**
   * Setup intersection observer for lazy loading
   * @private
   */
  #setupIntersectionObserver() {
    if (this.#intersectionObserver) return;

    const options = {
      rootMargin: "0px 0px 800px 0px", // 800px below viewport
      threshold: 0
    };

    this.#intersectionObserver = new IntersectionObserver(
      (entries) => this.#handleIntersection(entries),
      options
    );

    this.#intersectionObserver.observe(this);
  }

  /**
   * Handle intersection observer callback
   * @param {IntersectionObserverEntry[]} entries - Intersection entries
   * @private
   */
  #handleIntersection(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting && this.dataset.onload === "true") {
        queueMicrotask(() => this.#checkAndFetch(true));
        this.#removeIntersectionObserver();
      }
    });
  }

  /**
   * Remove intersection observer
   * @private
   */
  #removeIntersectionObserver() {
    if (this.#intersectionObserver) {
      this.#intersectionObserver.disconnect();
      this.#intersectionObserver = null;
    }
  }

  /**
   * Setup initial state and URL
   * @private
   */
  #setupInitialState() {
    const defaultUrl = new URL(window.location.href);
    defaultUrl.searchParams.delete("section_id");
    
    this.#lastFetchedUrl = this.dataset.url || window.location.href;
    
    // Set ARIA attributes for accessibility
    this.setAttribute('aria-live', 'polite');
    this.setAttribute('role', 'region');
  }

  /**
   * Add event listeners for navigation and custom events
   * @private
   */
  #addEventListeners() {
    if (this.dataset.disablePopEvents !== "true") {
      window.addEventListener("popstate", () => this.#handlePopState(), { passive: true });
    }
    
    if (this.dataset.loadOnEvent) {
      window.addEventListener(this.dataset.loadOnEvent, () => this.#handlePopState(), { passive: true });
    }

    // Listen for prefetch and fetch events
    this.addEventListener('electric-section:prefetch', (e) => this.#handlePrefetchEvent(e));
    this.addEventListener('electric-section:fetch', (e) => this.#handleFetchEvent(e));
  }

  /**
   * Remove event listeners
   * @private
   */
  #removeEventListeners() {
    // Note: We can't remove arrow function listeners, but this is acceptable
    // since the element will be garbage collected when disconnected
  }

  /**
   * Handle browser navigation events
   * @private
   */
  #handlePopState() {
    this.dataset.url = NetworkUtils.buildFetchUrl(window.location.href, this.#getSectionId());
    this.#debouncedCheckAndFetch(false);
  }

  /**
   * Handle prefetch event - fetch and cache content without replacing
   * @param {CustomEvent} event - Prefetch event
   * @private
   */
  #handlePrefetchEvent(event) {
    const url = NetworkUtils.buildFetchUrl(event.detail?.url, this.#getSectionId());
    if (!url) {
      console.warn('[ElectricSection] Prefetch event missing URL in detail');
      return;
    }

    this.#prefetchContent(url);
  }

  /**
   * Handle fetch event - fetch and replace content immediately
   * @param {CustomEvent} event - Fetch event
   * @private
   */
  #handleFetchEvent(event) {
    const url = NetworkUtils.buildFetchUrl(event.detail?.url, this.#getSectionId());
    if (!url) {
      console.warn('[ElectricSection] Fetch event missing URL in detail');
      return;
    }

    // Update the data-url attribute to trigger normal fetch flow
    this.dataset.url = url;
  }

  /**
   * Check if content should be fetched and fetch if needed
   * @param {boolean} isInitialLoad - Whether this is the initial load
   * @param {boolean} isAttributeChange - Whether triggered by attribute change
   * @param {string} newUrl - New URL value (for attribute changes)
   * @returns {Promise<boolean>} Whether content was fetched
   * @private
   */
  async #checkAndFetch(isInitialLoad = false, isAttributeChange = false, newUrl = null) {
    try {
      // Use the new URL if provided (for attribute changes), otherwise use dataset.url
      const urlToUse = newUrl || this.dataset.url;
      const currentUrl = new URL(urlToUse, window.location.origin);
      const dataUrl = new URL(this.#lastFetchedUrl, window.location.origin);

      // Get all relevant parameters including dynamic filters using new utilities
      const relevantParams = NetworkUtils.getRelevantParameters(currentUrl, ElectricSection.#RELEVANT_PARAMS);
      
      // Always fetch on attribute change, otherwise check if it's initial load
      let shouldFetch = isAttributeChange || isInitialLoad;

      if (shouldFetch) {
        const fetchUrl = NetworkUtils.buildFetchUrl(urlToUse, this.#getSectionId());

        if (fetchUrl !== this.#lastFetchedUrl) {
          this.#lastFetchedUrl = fetchUrl;

          const success = await this.#fetchAndReplaceContent(fetchUrl, isAttributeChange);
          
          DOMUtils.dispatchEvent(this, 'electric-section-updated', { 
            url: fetchUrl,
            isAttributeChange 
          });
          
          return success;
        }
      }
      
      return false;
    } catch (error) {
      console.error('[ElectricSection] Check and fetch error:', error);
      DOMUtils.dispatchEvent(this, 'electric-section-error', { error });
      return false;
    }
  }

  /**
   * Store temporary data before content replacement
   * @private
   */
  #storeTemporaryData() {
    if (!this.dataset.toKeep) return;
    
    const dataToKeep = {};
    this.dataset.toKeep.split(",").forEach(key => {
      dataToKeep[key.trim()] = this.dataset[key.trim()];
    });
    
    this.#temporaryData.set(this, dataToKeep);
    
    // Auto-cleanup after 3 seconds
    setTimeout(() => {
      this.#temporaryData.delete(this);
    }, 3000);
  }

  /**
   * Restore temporary data after content replacement
   * @private
   */
  #restoreTemporaryData() {
    const savedData = this.#temporaryData.get(this);
    if (!savedData) return;
    
    Object.entries(savedData).forEach(([key, value]) => {
      this.dataset[key] = value;
    });
  }

  /**
   * Fetch and replace content using new utilities
   * @param {string} url - URL to fetch from
   * @param {boolean} isAttributeChange - Whether triggered by attribute change
   * @returns {Promise<boolean>} Whether operation was successful
   * @private
   */
  async #fetchAndReplaceContent(url, isAttributeChange = false) {
    try {
      this.setAttribute('aria-busy', 'true');
      this.#storeTemporaryData();
      
      // Use new network utilities for fetching
      const response = await NetworkUtils.fetchWithRetry(url, {
        retries: 3,
        cache: true,
        cacheTTL: 300000 // 5 minutes
      });
      
      const html = await response.text();
      
      // Use new DOM utilities for parsing
      const newContent = DOMUtils.parseHTML(html, this.#getOptimizedSelector(this.#getSectionId()));
      
      if (newContent === null) {
        this.remove();
        return false;
      }

      // Use new DOM utilities for content replacement
      await DOMUtils.replaceContent(this, newContent, {
        animate: this.dataset.animate !== "false",
        preserveData: true
      });

      this.#fireCustomEvent(newContent);
      
      return true;
    } catch (error) {
      console.error('[ElectricSection] Fetch and replace error:', error);
      DOMUtils.dispatchEvent(this, 'electric-section-error', { error });
      return false;
    } finally {
      this.removeAttribute('aria-busy');
    }
  }

  /**
   * Prefetch content without replacing current content using new utilities
   * @param {string} url - URL to prefetch
   * @private
   */
  async #prefetchContent(url) {
    try {
      // Use new network utilities for prefetching
      await NetworkUtils.prefetchContent(url, {
        cacheTTL: 300000 // 5 minutes
      });
      
      // Dispatch prefetch success event
      DOMUtils.dispatchEvent(this, 'electric-section:prefetch-success', { 
        url,
        cached: true 
      });
    } catch (error) {
      console.error('[ElectricSection] Prefetch error:', error);
      DOMUtils.dispatchEvent(this, 'electric-section:prefetch-error', { 
        url, 
        error: error.message 
      });
    }
  }

  /**
   * Get the section ID from the closest section element or data attribute
   * @returns {string|null} Section ID or null if not found
   * @private
   */
  #getSectionId() {
    // First check if we have a data-section-id attribute
    if (this.dataset.sectionId) {
      return this.dataset.sectionId;
    }
    
    // Find the closest section element
    const sectionElement = this.closest('section');
    if (sectionElement) {
      // Try to get the section ID from the section element's ID
      const sectionId = sectionElement.id;
      if (sectionId && sectionId.startsWith('shopify-section-')) {
        return sectionId.replace('shopify-section-', '');
      }
      
      // Try to get from data-section-id attribute on the section
      if (sectionElement.dataset.sectionId) {
        return sectionElement.dataset.sectionId;
      }
    }
    
    return null;
  }

  /**
   * Get optimized selector for section ID using new DOM utilities
   * @param {string} sectionId - Section ID
   * @returns {string} Optimized selector
   * @private
   */
  #getOptimizedSelector(sectionId) {
    // Use new DOM utilities for selector optimization
    const selectors = [
      `#shopify-section-${sectionId}`, // Most specific, fastest
      `[data-section-id="${sectionId}"]`,
      `[data-section="${sectionId}"]`
    ];
    
    // Return the first working selector using DOM utilities
    for (const selector of selectors) {
      if (document.querySelector(selector)) {
        return selector;
      }
    }
    
    // Fallback to first selector
    return selectors[0];
  }

  /**
   * Fire custom event after content update using new DOM utilities
   * @param {Element} newContent - New content element
   * @private
   */
  #fireCustomEvent(newContent) {
    if (this.dataset.fireEvent) {
      DOMUtils.dispatchEvent(this, this.dataset.fireEvent, {
        source: this.#getSectionId(),
        found: newContent !== null,
        url: this.dataset.url
      });
    }
  }

  // Static utility methods for external use

  /**
   * Find all electric-section elements in the document
   * @param {string} sectionId - Optional section ID to filter by
   * @returns {ElectricSection[]} Array of electric-section elements
   * @static
   */
  static findAll(sectionId = null) {
    const selector = sectionId 
      ? `electric-section[data-section-id="${sectionId}"]`
      : 'electric-section';
    return Array.from(document.querySelectorAll(selector));
  }

  /**
   * Find electric-section element by section ID
   * @param {string} sectionId - Section ID to find
   * @returns {ElectricSection|null} Electric section element or null
   * @static
   */
  static findBySectionId(sectionId) {
    return document.querySelector(`electric-section[data-section-id="${sectionId}"]`);
  }

  /**
   * Trigger content update for all electric-section elements
   * @param {string} sectionId - Optional section ID to filter by
   * @static
   */
  static async updateAll(sectionId = null) {
    const elements = this.findAll(sectionId);
    await Promise.all(elements.map(el => el.#checkAndFetch(false, true)));
  }

  /**
   * Clear all cached content using new utilities
   * @static
   */
  static clearCache() {
    DOMUtils.clearCache();
    NetworkUtils.clearCache();
  }

  /**
   * Prefetch content for a specific section
   * @param {string} sectionId - Section ID to prefetch for
   * @param {string} url - URL to prefetch
   * @static
   */
  static prefetch(sectionId, url) {
    const section = this.findBySectionId(sectionId);
    if (section) {
      DOMUtils.dispatchEvent(section, 'electric-section:prefetch', {
        url
      });
    }
  }

  /**
   * Fetch and replace content for a specific section
   * @param {string} sectionId - Section ID to fetch for
   * @param {string} url - URL to fetch
   * @static
   */
  static fetch(sectionId, url) {
    const section = this.findBySectionId(sectionId);
    if (section) {
      DOMUtils.dispatchEvent(section, 'electric-section:fetch', {
        url
      });
    }
  }

  /**
   * Prefetch content for all sections
   * @param {string} url - URL to prefetch
   * @static
   */
  static prefetchAll(url) {
    const sections = this.findAll();
    sections.forEach(section => {
      DOMUtils.dispatchEvent(section, 'electric-section:prefetch', {
        url
      });
    });
  }
}

// Register the custom element with safety check
if (!customElements.get('electric-section')) {
  customElements.define('electric-section', ElectricSection);
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ElectricSection;
} 