/**
 * Network Utilities Module
 * 
 * Shared network request and URL handling utilities for web components.
 * Includes retry logic, caching, and performance optimizations.
 * 
 * @module NetworkUtils
 */

/**
 * Network Utilities Class
 * Provides optimized network operations with retry logic and caching
 */
class NetworkUtils {
  // Private static cache for requests
  static #requestCache = new Map();
  static #cacheSize = 0;
  static #maxCacheSize = 50;

  /**
   * Fetch with retry logic and exponential backoff
   * @param {string} url - URL to fetch
   * @param {Object} options - Fetch options
   * @param {number} options.retries - Number of retry attempts (default: 3)
   * @param {number} options.baseDelay - Base delay for exponential backoff (default: 1000)
   * @param {boolean} options.cache - Whether to cache the response (default: false)
   * @param {number} options.cacheTTL - Cache TTL in milliseconds (default: 300000)
   * @returns {Promise<Response>} Fetch response
   */
  static async fetchWithRetry(url, options = {}) {
    const {
      retries = 3,
      baseDelay = 1000,
      cache = false,
      cacheTTL = 300000,
      ...fetchOptions
    } = options;

    const start = performance.now();
    
    // Generate cache key inline
    const { method = 'GET', headers = {}, body } = fetchOptions;
    const keyData = {
      url,
      method,
      headers: Object.keys(headers).sort().reduce((obj, key) => {
        obj[key] = headers[key];
        return obj;
      }, {}),
      body
    };
    const cacheKey = btoa(JSON.stringify(keyData));

    // Check cache first
    if (cache) {
      const cached = this.#requestCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp <= cached.ttl) {
        // Move to end for LRU behavior
        this.#requestCache.delete(cacheKey);
        this.#requestCache.set(cacheKey, cached);
        return cached.response.clone();
      }
    }

    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
            ...fetchOptions.headers
          },
          ...fetchOptions
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Cache successful response
        if (cache) {
          // Remove oldest entry if cache is full
          if (this.#cacheSize >= this.#maxCacheSize) {
            const firstKey = this.#requestCache.keys().next().value;
            this.#requestCache.delete(firstKey);
            this.#cacheSize--;
          }
          
          this.#requestCache.set(cacheKey, {
            response: response.clone(),
            timestamp: Date.now(),
            ttl: cacheTTL
          });
          this.#cacheSize++;
          
          // Auto-cleanup
          setTimeout(() => {
            if (this.#requestCache.has(cacheKey)) {
              this.#requestCache.delete(cacheKey);
              this.#cacheSize--;
            }
          }, cacheTTL);
        }

        performance.measure('network-utils:fetch-with-retry', { start, end: performance.now() });
        
        return response;
      } catch (error) {
        if (i === retries - 1) throw error;
        
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Build fetch URL with section ID for Shopify themes
   * @param {string} url - Base URL
   * @param {string} sectionId - Section ID to append
   * @returns {string} Fetch URL with section ID
   */
  static buildFetchUrl(url, sectionId = null) {
    const fetchUrl = new URL(url, window.location.origin);
    if (sectionId) {
      fetchUrl.searchParams.set("section_id", sectionId);
    }
    return fetchUrl.toString();
  }

  /**
   * Update URL parameters with new values
   * @param {URL} url - URL to update
   * @param {string} param - Parameter name
   * @param {string[]} values - New values
   * @returns {URL} Updated URL
   */
  static updateUrlParameters(url, param, values) {
    const newUrl = new URL(url);
    newUrl.searchParams.delete(param);
    values.forEach(value => newUrl.searchParams.append(param, value));
    return newUrl;
  }

  /**
   * Get relevant URL parameters for change detection
   * @param {URL} url - URL to analyze
   * @param {Set<string>} relevantParams - Set of relevant parameter names
   * @returns {Set<string>} Set of relevant parameter names found in URL
   */
  static getRelevantParameters(url, relevantParams = new Set([
    "sort_by",
    "page",
    "q",
    "view",
    "limit"
  ])) {
    const params = new Set(relevantParams);
    
    // Add dynamic filter parameters
    Array.from(url.searchParams.keys())
      .filter(key => key.startsWith('filter.'))
      .forEach(key => params.add(key));
    
    return params;
  }

  /**
   * Update search parameters in current URL
   * @param {string} searchParams - New search parameters
   * @param {string[]} keepKeys - Keys to keep from current URL
   * @returns {string} Updated URL
   */
  static updateSearchParams(searchParams, keepKeys = []) {
    const urlParams = new URLSearchParams(window.location.search);
    const activeParams = [];
    const newParams = searchParams.split("&");
    
    if (keepKeys.length > 0) {
      urlParams.forEach((value, key) => {
        if (keepKeys.includes(key)) {
          newParams.push(`${key}=${value}`);
        }
      });
    }

    const baseUrl = window.location.href.split("?")[0];
    return `${baseUrl}?${newParams.join("&")}`;
  }

  /**
   * Get path without query parameters
   * @param {string} url - URL to process
   * @returns {string} Path without query
   */
  static getPathWithoutQuery(url) {
    return new URL(url, window.location.origin).pathname;
  }

  /**
   * Prefetch content without replacing current content
   * @param {string} url - URL to prefetch
   * @param {Object} options - Prefetch options
   * @returns {Promise<Response|null>} Fetch response or null if cached
   */
  static async prefetchContent(url, options = {}) {
    // Generate cache key inline
    const { method = 'GET', headers = {}, body } = options;
    const keyData = {
      url,
      method,
      headers: Object.keys(headers).sort().reduce((obj, key) => {
        obj[key] = headers[key];
        return obj;
      }, {}),
      body
    };
    const cacheKey = btoa(JSON.stringify(keyData));
    
    // Check if already cached
    const cached = this.#requestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp <= cached.ttl) {
      return null;
    }

    try {
      const response = await this.fetchWithRetry(url, {
        ...options,
        cache: true,
        cacheTTL: options.cacheTTL || 300000 // 5 minutes default
      });

      return response;
    } catch (error) {
      console.error('[NetworkUtils] Prefetch error:', error);
      throw error;
    }
  }

  /**
   * Clear all cached requests
   */
  static clearCache() {
    this.#requestCache.clear();
    this.#cacheSize = 0;
  }

  /**
   * Get fetch configuration for common request types
   * @param {string} type - Response type (default: 'json')
   * @returns {Object} Fetch configuration
   */
  static fetchConfig(type = "json") {
    return {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: `application/${type}`,
      },
    };
  }

  /**
   * Create a form and submit it programmatically
   * @param {string} path - Form action path
   * @param {Object} options - Form options
   * @param {string} options.method - HTTP method (default: 'post')
   * @param {Object} options.parameters - Form parameters
   */
  static postLink(path, options = {}) {
    const method = options.method || "post";
    const params = options.parameters || {};

    const form = document.createElement("form");
    form.setAttribute("method", method);
    form.setAttribute("action", path);

    for (const [key, value] of Object.entries(params)) {
      const hiddenField = document.createElement("input");
      hiddenField.setAttribute("type", "hidden");
      hiddenField.setAttribute("name", key);
      hiddenField.setAttribute("value", value);
      form.appendChild(hiddenField);
    }
    
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }

  /**
   * Wait for scroll to end before making requests
   * @returns {Promise<void>} Promise that resolves when scrolling ends
   */
  static waitForScrollToEnd() {
    return new Promise((resolve) => {
      let scrollTimeout;
      let isScrolling = false;

      function handleScroll() {
        isScrolling = true;
        clearTimeout(scrollTimeout);

        scrollTimeout = setTimeout(() => {
          isScrolling = false;
          resolve();
        }, 150);
      }

      if (!isScrolling) {
        resolve();
      } else {
        window.addEventListener("scroll", handleScroll, { passive: true });
      }
    });
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NetworkUtils;
}

// Make available globally
window.NetworkUtils = NetworkUtils; 