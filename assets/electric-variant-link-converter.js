/**
 * ElectricVariantLinkConverter Web Component
 * 
 * Converts regular links with data-variant-preview attributes into 
 * ProductVariantPreview web components when connected to the DOM.
 * This ensures the conversion works even when scripts are injected
 * after the DOM is already loaded.
 * 
 * @example
 * <electric-variant-link-converter></electric-variant-link-converter>
 */
class ElectricVariantLinkConverter extends HTMLElement {
  /** @type {boolean} Component connection state */
  #isConnected = false;

  constructor() {
    super();
  }

  connectedCallback() {
    if (this.#isConnected) return;
    
    try {
      this.#isConnected = true;
      this.#convertVariantPreviewLinks();
    } catch (error) {
      this.#handleError('Failed to convert variant preview links', error);
    }
  }

  /**
   * Convert regular links with data-variant-preview to web components
   * @private
   */
  #convertVariantPreviewLinks() {
    try {
      // Find all links with data-variant-preview attribute
      const variantPreviewLinks = document.querySelectorAll('a[data-variant-preview]');
      
      if (variantPreviewLinks.length === 0) {
        return;
      }
      
      variantPreviewLinks.forEach((link, index) => {
        this.#convertSingleLink(link, index);
      });
      
      // Dispatch event to notify conversion is complete
      this.dispatchEvent(new CustomEvent('electric:variant-links-converted', {
        detail: { convertedCount: variantPreviewLinks.length },
        bubbles: true
      }));
      
    } catch (error) {
      this.#handleError('Failed during variant preview link conversion', error);
    }
  }

  /**
   * Convert a single link to ProductVariantPreview web component
   * @param {HTMLAnchorElement} link - Link element to convert
   * @param {number} index - Index for logging purposes
   * @private
   */
  #convertSingleLink(link, index) {
    try {
      // Create a new ProductVariantPreview element
      const previewElement = document.createElement('product-variant-preview');
      
      // Copy all attributes from the original link
      Array.from(link.attributes).forEach(attr => {
        previewElement.setAttribute(attr.name, attr.value);
      });
      
      // Explicitly set the href attribute
      if (link.href) {
        previewElement.setAttribute('href', link.href);
      }
      
      // Copy the content
      previewElement.innerHTML = link.innerHTML;
      
      // Replace the original link with animation frame for smooth transition
      requestAnimationFrame(() => {
        if (link.parentNode) {
          link.parentNode.replaceChild(previewElement, link);
        }
      });
      
    } catch (error) {
      this.#handleError(`Failed to convert link ${index + 1}`, error);
    }
  }

  /**
   * Handle errors gracefully with user feedback
   * @param {string} message - Error message
   * @param {Error} error - Original error object
   * @private
   */
  #handleError(message, error) {
    console.error(`ElectricVariantLinkConverter: ${message}`, error);
    
    this.dispatchEvent(new CustomEvent('electric:variant-converter-error', {
      detail: { message, error: error.message },
      bubbles: true
    }));
  }
}

// Register the custom element
if (!customElements.get('electric-variant-link-converter')) {
  customElements.define('electric-variant-link-converter', ElectricVariantLinkConverter);
}
