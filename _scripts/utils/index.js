/**
 * Utilities Index Module
 * 
 * Main entry point for all utility modules.
 * Loads and initializes all shared utilities for web components.
 * 
 * @module Utils
 */

// Import all utility modules
import './dom.js';
import './network.js';
import './functional.js';

/**
 * Main Utilities Class
 * Provides unified access to all utility modules
 */
class Utils {
  /**
   * Get DOM utilities
   * @returns {DOMUtils} DOM utilities instance
   */
  static get dom() {
    return window.DOMUtils;
  }

  /**
   * Get network utilities
   * @returns {NetworkUtils} Network utilities instance
   */
  static get network() {
    return window.NetworkUtils;
  }

  /**
   * Get functional utilities
   * @returns {FunctionalUtils} Functional utilities instance
   */
  static get functional() {
    return window.FunctionalUtils;
  }

  /**
   * Clear all caches across all utility modules
   */
  static clearAllCaches() {
    this.dom.clearCache();
    this.network.clearCache();
    this.functional.clearCache();
  }

  /**
   * Get cache statistics across all modules
   * @returns {Object} Cache statistics
   */
  static getCacheStats() {
    return {
      dom: {
        fragmentCache: this.dom.getCachedFragment ? 'Available' : 'N/A',
        selectorCache: 'Available'
      },
      network: {
        requestCache: 'Available'
      },
      functional: {
        functionCache: this.functional.getCacheSize()
      }
    };
  }

  /**
   * Initialize all utilities
   * @param {Object} options - Initialization options
   */
  static init(options = {}) {
    console.log('[Utils] Initializing utility modules...');
    
    // Log cache stats in development
    if (options.debug) {
      console.log('[Utils] Cache stats:', this.getCacheStats());
    }
    
    // Dispatch ready event
    window.dispatchEvent(new CustomEvent('utils:ready', {
      detail: { modules: ['dom', 'network', 'functional'] }
    }));
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Utils.init());
} else {
  Utils.init();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Utils;
}

// Make available globally
window.Utils = Utils;

// Also expose individual modules for backward compatibility
window.DOMUtils = window.DOMUtils || {};
window.NetworkUtils = window.NetworkUtils || {};
window.FunctionalUtils = window.FunctionalUtils || {}; 