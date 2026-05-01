/**
 * Dynamic section loader for Shopify themes
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
  #selectorCache = new Map();
  #fragmentCache = new Map();
  #cacheSize = 0;
  #maxCacheSize = 10; // Maximum number of cached fragments
  #performanceObserver = null;

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
    
    // Create debounced fetch function once
    this.#debouncedCheckAndFetch = this.#debounce(
      this.#checkAndFetch.bind(this),
      250
    );

    // Setup performance monitoring
    this.#setupPerformanceMonitoring();
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
      
      // Dispatch ready event
      this.#dispatchEvent('electric-section-ready', { 
        sectionId: this.#getSectionId() 
      });
      
    } catch (error) {
      console.error('[ElectricSection] Initialization error:', error);
      this.#dispatchEvent('electric-section-error', { error });
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
    this.#removePerformanceObserver();
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
    this.dataset.url = this.#buildFetchUrl(window.location.href);
    this.#debouncedCheckAndFetch(false);
  }

  /**
   * Handle prefetch event - fetch and cache content without replacing
   * @param {CustomEvent} event - Prefetch event
   * @private
   */
  #handlePrefetchEvent(event) {
    const url = this.#buildFetchUrl(event.detail?.url);
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
    const url = this.#buildFetchUrl(event.detail?.url);
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
    const startTime = performance.now();
    
    try {
      // Use the new URL if provided (for attribute changes), otherwise use dataset.url
      const urlToUse = newUrl || this.dataset.url;
      const currentUrl = new URL(urlToUse, window.location.origin);
      const dataUrl = new URL(this.#lastFetchedUrl, window.location.origin);

      // Get all relevant parameters including dynamic filters
      const relevantParams = this.#getRelevantParameters(currentUrl, dataUrl);
      
      // Always fetch on attribute change, otherwise check if it's initial load
      let shouldFetch = isAttributeChange || isInitialLoad;

      if (shouldFetch) {
        const fetchUrl = this.#buildFetchUrl(urlToUse);

        if (fetchUrl !== this.#lastFetchedUrl) {
          this.#lastFetchedUrl = fetchUrl;

          const success = await this.#fetchAndReplaceContent(fetchUrl, isAttributeChange);
          
          // Log performance if operation took longer than 16ms
          const duration = performance.now() - startTime;
          if (duration > 16) {
            console.warn(`[ElectricSection] Slow operation: ${duration.toFixed(2)}ms`);
          }
          
          return success;
        }
      }
      
      return false;
    } catch (error) {
      console.error('[ElectricSection] Check and fetch error:', error);
      this.#dispatchEvent('electric-section-error', { error });
      return false;
    }
  }

  /**
   * Get all relevant URL parameters including dynamic filters
   * @param {URL} currentUrl - Current URL
   * @param {URL} dataUrl - Data URL
   * @returns {Set<string>} Set of relevant parameter names
   * @private
   */
  #getRelevantParameters(currentUrl, dataUrl) {
    const params = new Set(ElectricSection.#RELEVANT_PARAMS);
    
    // Add dynamic filter parameters
    [currentUrl, dataUrl].forEach(url => {
      Array.from(url.searchParams.keys())
        .filter(key => key.startsWith('filter.'))
        .forEach(key => params.add(key));
    });
    
    return params;
  }

  /**
   * Update URL parameters with new values
   * @param {URL} url - URL to update
   * @param {string} param - Parameter name
   * @param {string[]} values - New values
   * @private
   */
  #updateUrlParameters(url, param, values) {
    url.searchParams.delete(param);
    values.forEach(value => url.searchParams.append(param, value));
  }

  /**
   * Build fetch URL with section ID
   * @param {string} url - Base URL
   * @returns {string} Fetch URL with section ID
   * @private
   */
  #buildFetchUrl(url) {
    const fetchUrl = new URL(url, window.location.origin);
    const sectionId = this.#getSectionId();
    if (sectionId) {
      fetchUrl.searchParams.set("section_id", sectionId);
    }
    return fetchUrl.toString();
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
   * Get optimized selector for section ID
   * @param {string} sectionId - Section ID
   * @returns {string} Optimized selector
   * @private
   */
  #getOptimizedSelector(sectionId) {
    if (!this.#selectorCache.has(sectionId)) {
      // Try selectors in order of specificity and performance
      const selectors = [
        `#shopify-section-${sectionId}`, // Most specific, fastest
        `[data-section-id="${sectionId}"]`,
        `[data-section="${sectionId}"]`
      ];
      
      // Cache the first working selector
      for (const selector of selectors) {
        if (document.querySelector(selector)) {
          this.#selectorCache.set(sectionId, selector);
          break;
        }
      }
      
      // Fallback to first selector if none found
      if (!this.#selectorCache.has(sectionId)) {
        this.#selectorCache.set(sectionId, selectors[0]);
      }
    }
    
    return this.#selectorCache.get(sectionId);
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
   * Fetch and replace content
   * @param {string} url - URL to fetch from
   * @param {boolean} isAttributeChange - Whether triggered by attribute change
   * @returns {Promise<boolean>} Whether operation was successful
   * @private
   */
  async #fetchAndReplaceContent(url, isAttributeChange = false) {
    const startTime = performance.now();
    
    try {
      this.setAttribute('aria-busy', 'true');
      this.#storeTemporaryData();
      
      let newContent = this.#getCachedFragment(url);
      
      if (!newContent) {
        const response = await this.#fetchWithRetry(url);
        const html = await response.text();
        newContent = this.#parseHTML(html);
        
        if (newContent === null) {
          this.remove();
          return false;
        }
        
        // Cache the parsed fragment
        this.#cacheFragment(url, newContent);
      }

      // Replace content with or without animation
      if (this.dataset.animate !== "false") {
        await this.#animateTransition(newContent);
      } else {
        this.#replaceContent(newContent);
      }

      this.#fireCustomEvent(newContent);
      
      const duration = performance.now() - startTime;
      this.#dispatchEvent('electric-section-updated', { 
        url, 
        duration,
        isAttributeChange 
      });
      
      return true;
    } catch (error) {
      console.error('[ElectricSection] Fetch and replace error:', error);
      this.#dispatchEvent('electric-section-error', { error });
      return false;
    } finally {
      this.removeAttribute('aria-busy');
    }
  }

  /**
   * Get cached fragment if available
   * @param {string} url - URL to check cache for
   * @returns {Element|null} Cached fragment or null
   * @private
   */
  #getCachedFragment(url) {
    const cached = this.#fragmentCache.get(url);
    if (cached) {
      // Move to end for LRU behavior
      this.#fragmentCache.delete(url);
      this.#fragmentCache.set(url, cached);
      return cached.cloneNode(true);
    }
    return null;
  }

  /**
   * Cache fragment with LRU behavior
   * @param {string} url - URL to cache
   * @param {Element} fragment - Fragment to cache
   * @private
   */
  #cacheFragment(url, fragment) {
    // Remove oldest entry if cache is full
    if (this.#cacheSize >= this.#maxCacheSize) {
      const firstKey = this.#fragmentCache.keys().next().value;
      this.#fragmentCache.delete(firstKey);
      this.#cacheSize--;
    }
    
    this.#fragmentCache.set(url, fragment.cloneNode(true));
    this.#cacheSize++;
    
    // Auto-cleanup after 5 minutes
    setTimeout(() => {
      if (this.#fragmentCache.has(url)) {
        this.#fragmentCache.delete(url);
        this.#cacheSize--;
      }
    }, 300000);
  }

  /**
   * Prefetch content without replacing current content
   * @param {string} url - URL to prefetch
   * @private
   */
  async #prefetchContent(url) {
    try {
      // Check if already cached
      if (this.#getCachedFragment(url)) {
        return;
      }

      // Fetch and cache the content
      const response = await this.#fetchWithRetry(url);
      const html = await response.text();

      // Validate the content can be parsed
      const parsed = this.#parseHTML(html);
      if (parsed) {
        this.#cacheFragment(url, parsed);
        
        // Dispatch prefetch success event
        this.#dispatchEvent('electric-section:prefetch-success', { 
          url,
          cached: true 
        });
      } else {
        throw new Error('Failed to parse prefetched content');
      }
    } catch (error) {
      console.error('[ElectricSection] Prefetch error:', error);
      this.#dispatchEvent('electric-section:prefetch-error', { 
        url, 
        error: error.message 
      });
    }
  }

  /**
   * Fetch with retry logic and exponential backoff
   * @param {string} url - URL to fetch
   * @param {number} retries - Number of retry attempts
   * @returns {Promise<Response>} Fetch response
   * @private
   */
  async #fetchWithRetry(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          headers: {
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return response;
      } catch (error) {
        if (i === retries - 1) throw error;
        
        const delay = 1000 * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Parse HTML and extract section content with optimized selector
   * @param {string} html - HTML string to parse
   * @returns {Element|null} Parsed section element or null
   * @private
   */
  #parseHTML(html) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      
      // Check for parsing errors
      const parseError = doc.querySelector('parsererror');
      if (parseError) {
        throw new Error('HTML parsing failed');
      }
      
      const sectionId = this.#getSectionId();
      if (!sectionId) {
        console.warn('[ElectricSection] No section ID found for parsing');
        return null;
      }
      
      // Use optimized selector
      const selector = this.#getOptimizedSelector(sectionId);
      const element = doc.querySelector(selector);
      
      return element || null;
    } catch (error) {
      console.error('[ElectricSection] HTML parsing error:', error);
      return null;
    }
  }

  /**
   * Animate content transition using CSS transitions
   * @param {Element} newContent - New content to animate in
   * @private
   */
  async #animateTransition(newContent) {
    try {
      // Add transition class
      this.classList.add('electric-section-transitioning');
      
      // Fade out current content
      this.style.opacity = '0';
      this.style.transition = 'opacity 150ms ease-out';
      
      // Wait for fade out
      await new Promise(resolve => setTimeout(resolve, 150));
      
      this.#replaceContent(newContent);
      
      // Fade in new content
      this.style.transition = 'opacity 150ms ease-in';
      this.style.opacity = '1';
      
      // Clean up after animation
      setTimeout(() => {
        this.classList.remove('electric-section-transitioning');
        this.style.transition = '';
        this.style.opacity = '';
      }, 150);
      
    } catch (error) {
      console.error('[ElectricSection] Animation error:', error);
      // Fallback to immediate replacement
      this.#replaceContent(newContent);
    }
  }

  /**
   * Replace current content with new content using DocumentFragment
   * @param {Element} newContent - New content element
   * @private
   */
  #replaceContent(newContent) {
    // Preserve any temporary data
    const tempData = this.#temporaryData.get(this);
    
    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();
    while (newContent.firstChild) {
      fragment.appendChild(newContent.firstChild);
    }
    
    // Clear and replace content
    this.innerHTML = '';
    this.appendChild(fragment);
    
    // Restore temporary data to new element
    if (tempData) {
      this.#temporaryData.set(this, tempData);
    }
  }

  /**
   * Fire custom event after content update
   * @param {Element} newContent - New content element
   * @private
   */
  #fireCustomEvent(newContent) {
    if (this.dataset.fireEvent) {
      const event = new CustomEvent(this.dataset.fireEvent, {
        bubbles: true,
        detail: {
          source: this.#getSectionId(),
          found: newContent !== null,
          url: this.dataset.url
        }
      });
      this.dispatchEvent(event);
    }
  }

  /**
   * Dispatch internal event
   * @param {string} eventName - Event name
   * @param {object} detail - Event detail
   * @private
   */
  #dispatchEvent(eventName, detail = {}) {
    const event = new CustomEvent(eventName, {
      bubbles: true,
      detail: {
        sectionId: this.#getSectionId(),
        ...detail
      }
    });
    this.dispatchEvent(event);
  }

  /**
   * Setup performance monitoring
   * @private
   */
  #setupPerformanceMonitoring() {
    if ('PerformanceObserver' in window) {
      try {
        this.#performanceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'measure' && entry.name.includes('electric-section')) {
              if (entry.duration > 100) {
                console.warn(`[ElectricSection] Slow operation detected: ${entry.name} took ${entry.duration.toFixed(2)}ms`);
              }
            }
          }
        });
        
        this.#performanceObserver.observe({ entryTypes: ['measure'] });
      } catch (error) {
        console.warn('[ElectricSection] Performance monitoring not available:', error);
      }
    }
  }

  /**
   * Remove performance observer
   * @private
   */
  #removePerformanceObserver() {
    if (this.#performanceObserver) {
      this.#performanceObserver.disconnect();
      this.#performanceObserver = null;
    }
  }

  /**
   * Debounce function to limit execution frequency
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @returns {Function} Debounced function
   * @private
   */
  #debounce(func, wait) {
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
   * Clear all cached content
   * @static
   */
  static clearCache() {
    // This would need to be implemented if we want to expose cache clearing
    console.warn('[ElectricSection] Cache clearing not implemented in this version');
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
      section.dispatchEvent(new CustomEvent('electric-section:prefetch', {
        detail: { url },
        bubbles: false
      }));
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
      section.dispatchEvent(new CustomEvent('electric-section:fetch', {
        detail: { url },
        bubbles: false
      }));
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
      section.dispatchEvent(new CustomEvent('electric-section:prefetch', {
        detail: { url },
        bubbles: false
      }));
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