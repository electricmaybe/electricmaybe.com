/**
 * Functional Utilities Module
 * 
 * Shared functional programming utilities for web components.
 * Includes debouncing, throttling, and other performance optimizations.
 * 
 * @module FunctionalUtils
 */

/**
 * Functional Utilities Class
 * Provides optimized functional programming utilities
 */
class FunctionalUtils {
  // Private static cache for debounced/throttled functions
  static #functionCache = new Map();

  /**
   * Debounce function to limit execution frequency
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @param {Object} options - Debounce options
   * @param {boolean} options.leading - Whether to execute on leading edge
   * @param {boolean} options.trailing - Whether to execute on trailing edge
   * @returns {Function} Debounced function
   */
  static debounce(func, wait, options = {}) {
    const { leading = false, trailing = true } = options;
    const cacheKey = `debounce-${func.toString()}-${wait}-${leading}-${trailing}`;
    
    if (this.#functionCache.has(cacheKey)) {
      return this.#functionCache.get(cacheKey);
    }

    let timeoutId;
    let lastCallTime;
    let lastInvokeTime = 0;
    let result;

    const debounced = function(...args) {
      const time = Date.now();
      const timeSinceLastCall = time - lastCallTime;
      const timeSinceLastInvoke = time - lastInvokeTime;
      const isInvoking = (lastCallTime === undefined) || (timeSinceLastCall >= wait) || (timeSinceLastCall < 0) || (timeSinceLastInvoke >= wait);

      lastCallTime = time;

      if (isInvoking) {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
        if (leading) {
          result = func.apply(this, args);
        }
        lastInvokeTime = time;
      } else if (timeoutId === undefined && trailing) {
        timeoutId = setTimeout(() => {
          const time = Date.now();
          const timeSinceLastCall = time - lastCallTime;
          const timeSinceLastInvoke = time - lastInvokeTime;
          const shouldInvoke = (lastCallTime === undefined) || (timeSinceLastCall >= wait) || (timeSinceLastCall < 0) || (timeSinceLastInvoke >= wait);
          
          if (shouldInvoke) {
            const args = lastCallTime;
            lastCallTime = lastInvokeTime = time;
            result = func.apply(debounced, args);
            return result;
          }
          timeoutId = setTimeout(arguments.callee, wait - (time - lastCallTime));
        }, wait);
      }

      return result;
    };

    // Add utility methods
    debounced.cancel = () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      lastInvokeTime = 0;
      lastCallTime = timeoutId = undefined;
    };

    debounced.flush = () => {
      return timeoutId === undefined ? result : (() => {
        const time = Date.now();
        const args = lastCallTime;
        lastCallTime = lastInvokeTime = time;
        result = func.apply(debounced, args);
        return result;
      })();
    };

    debounced.pending = () => {
      return timeoutId !== undefined;
    };

    this.#functionCache.set(cacheKey, debounced);
    return debounced;
  }

  /**
   * Throttle function to limit execution frequency
   * @param {Function} func - Function to throttle
   * @param {number} wait - Wait time in milliseconds
   * @param {Object} options - Throttle options
   * @param {boolean} options.leading - Whether to execute on leading edge
   * @param {boolean} options.trailing - Whether to execute on trailing edge
   * @returns {Function} Throttled function
   */
  static throttle(func, wait, options = {}) {
    const { leading = true, trailing = true } = options;
    const cacheKey = `throttle-${func.toString()}-${wait}-${leading}-${trailing}`;
    
    if (this.#functionCache.has(cacheKey)) {
      return this.#functionCache.get(cacheKey);
    }

    let timeoutId;
    let lastCallTime;
    let lastInvokeTime = 0;
    let result;

    const throttled = function(...args) {
      const time = Date.now();
      const timeSinceLastCall = time - lastCallTime;
      const timeSinceLastInvoke = time - lastInvokeTime;
      const isInvoking = (lastCallTime === undefined) || (timeSinceLastCall >= wait) || (timeSinceLastCall < 0) || (timeSinceLastInvoke >= wait);

      lastCallTime = time;

      if (isInvoking) {
        if (timeoutId === undefined) {
          if (leading) {
            lastInvokeTime = time;
            result = func.apply(this, args);
          } else {
            timeoutId = setTimeout(() => {
              const time = Date.now();
              const timeSinceLastCall = time - lastCallTime;
              const timeSinceLastInvoke = time - lastInvokeTime;
              const shouldInvoke = (lastCallTime === undefined) || (timeSinceLastCall >= wait) || (timeSinceLastCall < 0) || (timeSinceLastInvoke >= wait);
              
              if (shouldInvoke) {
                lastInvokeTime = time;
                result = func.apply(throttled, arguments);
                return result;
              }
              timeoutId = setTimeout(arguments.callee, wait - (time - lastCallTime));
            }, wait);
          }
        }
      } else if (timeoutId === undefined && trailing) {
        timeoutId = setTimeout(() => {
          const time = Date.now();
          const timeSinceLastCall = time - lastCallTime;
          const timeSinceLastInvoke = time - lastInvokeTime;
          const shouldInvoke = (lastCallTime === undefined) || (timeSinceLastCall >= wait) || (timeSinceLastCall < 0) || (timeSinceLastInvoke >= wait);
          
          if (shouldInvoke) {
            lastInvokeTime = time;
            result = func.apply(throttled, arguments);
            return result;
          }
          timeoutId = setTimeout(arguments.callee, wait - (time - lastCallTime));
        }, wait);
      }

      return result;
    };

    // Add utility methods
    throttled.cancel = () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      lastInvokeTime = 0;
      lastCallTime = timeoutId = undefined;
    };

    throttled.flush = () => {
      return timeoutId === undefined ? result : (() => {
        lastInvokeTime = Date.now();
        result = func.apply(throttled, arguments);
        return result;
      })();
    };

    throttled.pending = () => {
      return timeoutId !== undefined;
    };

    this.#functionCache.set(cacheKey, throttled);
    return throttled;
  }

  /**
   * Memoize function with cache
   * @param {Function} func - Function to memoize
   * @param {Function} resolver - Cache key resolver
   * @returns {Function} Memoized function
   */
  static memoize(func, resolver = null) {
    const cache = new Map();
    
    const memoized = function(...args) {
      const key = resolver ? resolver.apply(this, args) : args[0];
      
      if (cache.has(key)) {
        return cache.get(key);
      }
      
      const result = func.apply(this, args);
      cache.set(key, result);
      return result;
    };

    memoized.cache = cache;
    memoized.clear = () => cache.clear();
    
    return memoized;
  }

  /**
   * Once function - ensures function is called only once
   * @param {Function} func - Function to call once
   * @returns {Function} Function that can only be called once
   */
  static once(func) {
    let called = false;
    let result;
    
    return function(...args) {
      if (called) return result;
      called = true;
      result = func.apply(this, args);
      return result;
    };
  }

  /**
   * Delay function execution
   * @param {Function} func - Function to delay
   * @param {number} wait - Delay time in milliseconds
   * @param {...any} args - Arguments to pass to function
   * @returns {Promise<any>} Promise that resolves with function result
   */
  static delay(func, wait, ...args) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(func.apply(null, args));
      }, wait);
    });
  }

  /**
   * Retry function with exponential backoff
   * @param {Function} func - Function to retry
   * @param {Object} options - Retry options
   * @param {number} options.retries - Number of retry attempts (default: 3)
   * @param {number} options.baseDelay - Base delay for exponential backoff (default: 1000)
   * @param {Function} options.shouldRetry - Function to determine if should retry (default: retry on any error)
   * @returns {Promise<any>} Promise that resolves with function result
   */
  static async retry(func, options = {}) {
    const {
      retries = 3,
      baseDelay = 1000,
      shouldRetry = () => true
    } = options;

    for (let i = 0; i < retries; i++) {
      try {
        return await func();
      } catch (error) {
        if (i === retries - 1 || !shouldRetry(error)) {
          throw error;
        }
        
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Queue function execution with concurrency limit
   * @param {Function[]} functions - Array of functions to execute
   * @param {number} concurrency - Maximum concurrent executions (default: 1)
   * @returns {Promise<any[]>} Promise that resolves with all results
   */
  static async queue(functions, concurrency = 1) {
    const results = [];
    const executing = new Set();

    for (const func of functions) {
      const promise = func();
      results.push(promise);
      executing.add(promise);

      const clean = () => executing.delete(promise);
      promise.then(clean).catch(clean);

      if (executing.size >= concurrency) {
        await Promise.race(executing);
      }
    }

    return Promise.all(results);
  }

  /**
   * Batch function calls
   * @param {Function} func - Function to batch
   * @param {number} batchSize - Size of each batch (default: 10)
   * @param {number} delay - Delay between batches in milliseconds (default: 0)
   * @returns {Function} Batched function
   */
  static batch(func, batchSize = 10, delay = 0) {
    let batch = [];
    let timeoutId;

    const processBatch = () => {
      if (batch.length > 0) {
        func(batch);
        batch = [];
      }
    };

    return function(...args) {
      batch.push(...args);

      if (batch.length >= batchSize) {
        clearTimeout(timeoutId);
        processBatch();
      } else if (delay > 0) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(processBatch, delay);
      }
    };
  }

  /**
   * Create a function that only executes if not called recently
   * @param {Function} func - Function to limit
   * @param {number} wait - Wait time in milliseconds
   * @returns {Function} Limited function
   */
  static limit(func, wait) {
    let lastCall = 0;
    
    return function(...args) {
      const now = Date.now();
      if (now - lastCall >= wait) {
        lastCall = now;
        return func.apply(this, args);
      }
    };
  }

  /**
   * Create a function that executes after a delay, cancelling previous calls
   * @param {Function} func - Function to delay
   * @param {number} wait - Wait time in milliseconds
   * @returns {Function} Delayed function
   */
  static delayCancel(func, wait) {
    let timeoutId;
    
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
      }, wait);
    };
  }

  /**
   * Clear all cached functions
   */
  static clearCache() {
    this.#functionCache.clear();
  }

  /**
   * Get cache size
   * @returns {number} Number of cached functions
   */
  static getCacheSize() {
    return this.#functionCache.size;
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FunctionalUtils;
}

// Make available globally
window.FunctionalUtils = FunctionalUtils; 