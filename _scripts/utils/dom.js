/**
 * DOM Utilities Module
 * 
 * Shared DOM manipulation and querying utilities for web components.
 * Optimized for performance with caching and modern browser APIs.
 * 
 * @module DOMUtils
 */

/**
 * DOM Utilities Class
 * Provides optimized DOM operations with caching and performance monitoring
 */
class DOMUtils {
  // Private static cache for selectors and elements
  static #selectorCache = new Map();
  static #fragmentCache = new Map();
  static #cacheSize = 0;
  static #maxCacheSize = 20;

  /**
   * Get optimized selector with caching
   * @param {string} selector - CSS selector
   * @param {Element} context - Context element (defaults to document)
   * @returns {string} Optimized selector
   */
  static getOptimizedSelector(selector, context = document) {
    const cacheKey = `${selector}-${context === document ? 'doc' : context.tagName}`;
    
    if (!this.#selectorCache.has(cacheKey)) {
      // Test selector performance and cache result
      const start = performance.now();
      const testElement = context.querySelector(selector);
      const duration = performance.now() - start;
      
      // Cache with performance data
      this.#selectorCache.set(cacheKey, {
        selector,
        duration,
        valid: !!testElement
      });
      
      // Limit cache size
      if (this.#selectorCache.size > this.#maxCacheSize) {
        const firstKey = this.#selectorCache.keys().next().value;
        this.#selectorCache.delete(firstKey);
      }
    }
    
    return this.#selectorCache.get(cacheKey).selector;
  }

  /**
   * Parse HTML with error handling and optimization
   * @param {string} html - HTML string to parse
   * @param {string} selector - Optional selector to extract specific element
   * @returns {Element|null} Parsed element or null
   */
  static parseHTML(html, selector = null) {
    const start = performance.now();
    
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      
      // Check for parsing errors
      const parseError = doc.querySelector('parsererror');
      if (parseError) {
        throw new Error('HTML parsing failed');
      }
      
      const result = selector ? doc.querySelector(selector) : doc.body.firstElementChild;
      
      performance.measure('dom-utils:parse-html', { start, end: performance.now() });
      
      return result || null;
    } catch (error) {
      console.error('[DOMUtils] HTML parsing error:', error);
      return null;
    }
  }

  /**
   * Replace content using DocumentFragment for better performance
   * @param {Element} target - Target element to replace content in
   * @param {Element} newContent - New content element
   * @param {Object} options - Options for replacement
   * @param {boolean} options.preserveData - Whether to preserve data attributes
   * @param {boolean} options.animate - Whether to animate the transition
   */
  static async replaceContent(target, newContent, options = {}) {
    const { preserveData = false, animate = false } = options;
    const start = performance.now();
    
    try {
      // Store data if needed
      let savedData = null;
      if (preserveData) {
        savedData = {};
        Array.from(target.attributes).forEach(attr => {
          if (attr.name.startsWith('data-')) {
            savedData[attr.name] = attr.value;
          }
        });
      }
      
      if (animate) {
        await this.#animateTransition(target, newContent);
      } else {
        // Use DocumentFragment for better performance
        const fragment = document.createDocumentFragment();
        while (newContent.firstChild) {
          fragment.appendChild(newContent.firstChild);
        }
        
        target.innerHTML = '';
        target.appendChild(fragment);
      }
      
      // Restore data if needed
      if (savedData) {
        Object.entries(savedData).forEach(([key, value]) => {
          target.setAttribute(key, value);
        });
      }
      
      performance.measure('dom-utils:replace-content', { start, end: performance.now() });
      
    } catch (error) {
      console.error('[DOMUtils] Content replacement error:', error);
      throw error;
    }
  }

  /**
   * Animate content transition using CSS transitions
   * @param {Element} target - Target element
   * @param {Element} newContent - New content
   * @private
   */
  static async #animateTransition(target, newContent) {
    return new Promise((resolve) => {
      // Add transition class
      target.classList.add('dom-utils-transitioning');
      
      // Fade out current content
      target.style.opacity = '0';
      target.style.transition = 'opacity 150ms ease-out';
      
      setTimeout(async () => {
        // Replace content
        const fragment = document.createDocumentFragment();
        while (newContent.firstChild) {
          fragment.appendChild(newContent.firstChild);
        }
        
        target.innerHTML = '';
        target.appendChild(fragment);
        
        // Fade in new content
        target.style.transition = 'opacity 150ms ease-in';
        target.style.opacity = '1';
        
        setTimeout(() => {
          target.classList.remove('dom-utils-transitioning');
          target.style.transition = '';
          target.style.opacity = '';
          resolve();
        }, 150);
      }, 150);
    });
  }

  /**
   * Cache fragment with LRU behavior
   * @param {string} key - Cache key
   * @param {Element} fragment - Fragment to cache
   * @param {number} ttl - Time to live in milliseconds
   */
  static cacheFragment(key, fragment, ttl = 300000) { // 5 minutes default
    // Remove oldest entry if cache is full
    if (this.#cacheSize >= this.#maxCacheSize) {
      const firstKey = this.#fragmentCache.keys().next().value;
      this.#fragmentCache.delete(firstKey);
      this.#cacheSize--;
    }
    
    this.#fragmentCache.set(key, {
      fragment: fragment.cloneNode(true),
      timestamp: Date.now(),
      ttl
    });
    this.#cacheSize++;
    
    // Auto-cleanup
    setTimeout(() => {
      if (this.#fragmentCache.has(key)) {
        this.#fragmentCache.delete(key);
        this.#cacheSize--;
      }
    }, ttl);
  }

  /**
   * Get cached fragment if available and not expired
   * @param {string} key - Cache key
   * @returns {Element|null} Cached fragment or null
   */
  static getCachedFragment(key) {
    const cached = this.#fragmentCache.get(key);
    if (!cached) return null;
    
    // Check if expired
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.#fragmentCache.delete(key);
      this.#cacheSize--;
      return null;
    }
    
    // Move to end for LRU behavior
    this.#fragmentCache.delete(key);
    this.#fragmentCache.set(key, cached);
    
    return cached.fragment.cloneNode(true);
  }

  /**
   * Clear all cached fragments
   */
  static clearCache() {
    this.#fragmentCache.clear();
    this.#cacheSize = 0;
  }

  /**
   * Get focusable elements within a container
   * @param {Element} container - Container element
   * @returns {Element[]} Array of focusable elements
   */
  static getFocusableElements(container) {
    return Array.from(
      container.querySelectorAll(
        "summary, a[href], button:enabled, [tabindex]:not([tabindex^='-']), [draggable], area, input:not([type=hidden]):enabled, select:enabled, textarea:enabled, object, iframe"
      )
    );
  }

  /**
   * Create and dispatch a custom event
   * @param {Element} target - Target element
   * @param {string} eventName - Event name
   * @param {Object} detail - Event detail
   * @param {Object} options - Event options
   * @returns {CustomEvent} Dispatched event
   */
  static dispatchEvent(target, eventName, detail = {}, options = {}) {
    const event = new CustomEvent(eventName, {
      bubbles: true,
      cancelable: true,
      detail,
      ...options
    });
    
    target.dispatchEvent(event);
    return event;
  }

  /**
   * Wait for element to be available in DOM
   * @param {string} selector - CSS selector
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Element>} Promise that resolves with the element
   */
  static waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver((mutations, obs) => {
        const element = document.querySelector(selector);
        if (element) {
          obs.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      // Timeout
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Get element's visible height relative to viewport
   * @param {Element} element - Element to measure
   * @returns {number} Visible height in pixels
   */
  static getVisibleHeight(element) {
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    
    const elementTop = rect.top;
    const elementBottom = rect.bottom;
    
    // Element is completely above or below viewport
    if (elementTop >= viewportHeight || elementBottom <= 0) {
      return 0;
    }
    
    // Element is partially visible
    if (elementTop < 0) {
      return Math.min(elementBottom, viewportHeight);
    }
    
    if (elementBottom > viewportHeight) {
      return viewportHeight - elementTop;
    }
    
    // Element is fully visible
    return rect.height;
  }

  /**
   * Lock scroll for modal/drawer
   * @param {Element} element - Element that triggered scroll lock
   */
  static lockScroll(element) {
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    element.dataset.scrollY = scrollY;
  }

  /**
   * Unlock scroll and restore position
   * @param {Element} element - Element that triggered scroll lock
   */
  static unlockScroll(element) {
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";
    window.scrollTo({
      behavior: "instant",
      left: 0,
      top: parseInt(element.dataset.scrollY || "0"),
    });
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DOMUtils;
}

// Make available globally
window.DOMUtils = DOMUtils; 