/**
 * Product Card Add to Cart Component
 * 
 * Handles add-to-cart functionality for product cards with add-to-bag icons.
 * Provides loading states, error handling, and cart updates.
 * 
 * @example
 * <button data-add-to-cart-trigger data-product-id="123" data-variant-id="456">
 *   <icon>add-to-bag</icon>
 * </button>
 */
class ProductCardATC extends HTMLElement {
  /** @type {HTMLButtonElement | null} Add to cart trigger button */
  #trigger = null;
  
  /** @type {HTMLFormElement | null} Hidden product form */
  #form = null;
  
  /** @type {boolean} Component connection state */
  #isConnected = false;
  
  /** @type {AbortController | null} Event listener controller */
  #abortController = null;

  constructor() {
    super();
  }

  connectedCallback() {
    if (this.#isConnected) return;
    
    try {
      this.#isConnected = true;
      this.#initialize();
    } catch (error) {
      this.#handleError('Failed to initialize product card ATC', error);
    }
  }

  disconnectedCallback() {
    this.#cleanup();
  }

  /**
   * Initialize the component
   * @private
   */
  #initialize() {
    this.#trigger = this.querySelector('[data-add-to-cart-trigger]');
    this.#form = this.querySelector('form[data-type="add-to-cart-form"]');
    
    if (!this.#trigger || !this.#form) {
      this.#logError(new Error('Missing required elements: trigger button or form'));
      return;
    }

    this.#setupEventListeners();
  }

  /**
   * Setup event listeners for add to cart functionality
   * @private
   */
  #setupEventListeners() {
    this.#abortController = new AbortController();
    
    this.#trigger.addEventListener('click', this.#handleAddToCart.bind(this), {
      signal: this.#abortController.signal,
      passive: false
    });
    
    this.#trigger.addEventListener('keydown', this.#handleKeydown.bind(this), {
      signal: this.#abortController.signal,
      passive: false
    });
  }

  /**
   * Handle add to cart button click
   * @param {Event} event - Click event
   * @private
   */
  async #handleAddToCart(event) {
    event.preventDefault();
    
    if (this.#trigger.disabled) return;
    
    try {
      this.#setLoadingState(true);
      
      const formData = new FormData(this.#form);
      
      // Get dynamic sections for cart updates
      const dynamicSectionsNodes = document.querySelectorAll('cart-dynamic');
      const sectionIds = dynamicSectionsNodes.length
        ? [...dynamicSectionsNodes].map(n => n.dataset.sectionId)
        : [];
      
      formData.append('sections', sectionIds.join(','));
      
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.status) {
        throw new Error(result.description || 'Failed to add to cart');
      }
      
      this.#handleSuccess(result);
      
    } catch (error) {
      this.#handleError('Failed to add product to cart', error);
    } finally {
      this.#setLoadingState(false);
    }
  }

  /**
   * Handle keyboard navigation
   * @param {KeyboardEvent} event - Keydown event
   * @private
   */
  #handleKeydown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.#trigger.click();
    }
  }

  /**
   * Set loading state for the button
   * @param {boolean} isLoading - Whether to show loading state
   * @private
   */
  #setLoadingState(isLoading) {
    if (isLoading) {
      this.#trigger.setAttribute('data-state', 'loading');
      this.#trigger.setAttribute('aria-label', 'Adding to cart...');
    } else {
      this.#trigger.removeAttribute('data-state');
      this.#trigger.setAttribute('aria-label', 'Add to cart');
    }
  }

  /**
   * Handle successful add to cart
   * @param {Object} result - Cart add result
   * @private
   */
  #handleSuccess(result) {
    // Set success state on button
    this.#trigger.setAttribute('data-state', 'success');
    
    // Update dynamic sections if provided
    const dynamicSectionsNodes = document.querySelectorAll('cart-dynamic');
    if (dynamicSectionsNodes.length && result.sections) {
      [...dynamicSectionsNodes].forEach(node => {
        const htmlString = result.sections[node.dataset.sectionId];
        if (!htmlString) return;
        
        const html = new DOMParser().parseFromString(htmlString, 'text/html');
        const updated = html.querySelector(`cart-dynamic[data-section-id='${node.dataset.sectionId}']`);
        if (!updated) return;
        
        node.innerHTML = updated.innerHTML;
        node.className = updated.className;
        
        // Call lifecycle hook if present
        if (typeof node.modified === 'function') {
          node.modified();
        }
      });
    }
    
    // Dispatch cart update event
    document.dispatchEvent(new CustomEvent('cart:update', {
      detail: {
        items: [result],
        source: 'product-card-atc'
      },
      bubbles: true
    }));

    // Haptic feedback if available
    navigator.vibrate?.(100);

    // On cart page, do not open cart drawer again.
    if (!document.body.classList.contains('template-cart')) {
      document.dispatchEvent(new CustomEvent('cart:added', {
        bubbles: true,
        detail: {
          source: 'product-card-atc',
          product: result
        }
      }));
    }
  }

  /**
   * Show notification in top-right corner
   * @param {string} message - Notification message
   * @private
   */
  #showNotification(message) {
    // Remove existing notification if present
    const existingNotification = document.querySelector('.product-card-notification');
    if (existingNotification) {
      existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'product-card-notification fixed top-4 right-4 z-[9999] color-schema-contrast bg-surface px-4 py-2 shadow-lg transform translate-x-full transition-transform duration-300 ease-out';
    notification.textContent = message;
    
    // Add to document
    document.body.appendChild(notification);
    
    // Animate in
    requestAnimationFrame(() => {
      notification.classList.remove('translate-x-full');
    });
    
    // Remove after delay
    setTimeout(() => {
      notification.classList.add('translate-x-full');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }, 2000);
  }

  /**
   * Handle errors gracefully
   * @param {string} message - Error message
   * @param {Error} error - Original error
   * @private
   */
  #handleError(message, error) {
    console.error(`ProductCardATC: ${message}`, error);
    
    // Set error state on button
    this.#trigger.setAttribute('data-state', 'error');
    
    // Haptic feedback for error
    navigator.vibrate?.(200);
    
    // Remove error state after delay
    setTimeout(() => {
      this.#trigger.removeAttribute('data-state');
    }, 3000);
  }

  /**
   * Log errors for debugging
   * @param {Error} error - Error to log
   * @private
   */
  #logError(error) {
    console.error('ProductCardATC:', error);
  }

  /**
   * Clean up resources and event listeners
   * @private
   */
  #cleanup() {
    this.#isConnected = false;
    this.#abortController?.abort();
    this.#abortController = null;
  }
}

// Register the component
customElements.define('product-card-atc', ProductCardATC);
