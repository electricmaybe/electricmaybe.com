/**
 * ElectricDOMReady Web Component
 * 
 * Handles scripts that need to run when DOM is ready, particularly useful
 * for injected content where DOMContentLoaded has already fired.
 * This component runs initialization scripts when connected to the DOM.
 * 
 * @example
 * <electric-dom-ready></electric-dom-ready>
 */
class ElectricDOMReady extends HTMLElement {
  /** @type {boolean} Component connection state */
  #isConnected = false;
  
  /** @type {AbortController | null} Event listener controller */
  #abortController = null;
  
  /** @type {ResizeObserver | null} Resize observer instance */
  #resizeObserver = null;

  constructor() {
    super();
  }

  connectedCallback() {
    if (this.#isConnected) return;
    
    try {
      this.#isConnected = true;
      this.#abortController = new AbortController();
      this.#initializeAllScripts();
    } catch (error) {
      this.#handleError('Failed to initialize DOM ready scripts', error);
    }
  }

  disconnectedCallback() {
    this.#cleanup();
  }

  /**
   * Initialize all DOM-ready scripts
   * @private
   */
  #initializeAllScripts() {
    // Run all initialization scripts
    this.#handleClickOnLoadElements();
    this.#calculateFirstSectionMargin();
    this.#initializeLazyBlurImages();
    this.#adjustSliderOpacity();
  }

  /**
   * Handle elements that should be clicked on load
   * @private
   */
  #handleClickOnLoadElements() {
    try {
      const clickOnLoadElements = document.querySelectorAll(".click-on-load");
      clickOnLoadElements.forEach((element) => {
        // Add a small delay to ensure proper initialization
        requestAnimationFrame(() => {
          element.click();
        });
      });
    } catch (error) {
      this.#handleError('Failed to handle click-on-load elements', error);
    }
  }

  /**
   * Calculate and set first section margin CSS custom property
   * @private
   */
  #calculateFirstSectionMargin() {
    try {
      const firstSection = document.querySelector(
        "#MainContent .shopify-section:not(.shopify-section-group-header-group)",
      );
      
      if (!firstSection) return;
      
      const firstSectionMarginTop = parseInt(
        window.getComputedStyle(firstSection).marginTop,
      );
      
      document.body.style.setProperty(
        "--first-section-margin-top",
        `${firstSectionMarginTop}px`,
      );

      // Listen for section loads to recalculate
      document.addEventListener('shopify:section:load', () => {
        this.#calculateFirstSectionMargin();
      }, { signal: this.#abortController.signal });

    } catch (error) {
      this.#handleError('Failed to calculate first section margin', error);
    }
  }

  /**
   * Initialize lazy loading blur effect for images
   * @private
   */
  #initializeLazyBlurImages() {
    try {
      const images = document.querySelectorAll("img.js-lazyloadBlur");
      
      images.forEach((image) => {
        const placeholder = image.nextElementSibling;
        if (!placeholder) return;

        // Set up intersection observer for lazy loading
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                this.#loadBlurImage(image, placeholder);
                observer.unobserve(image);
              }
            });
          },
          {
            rootMargin: '50px',
            threshold: 0.1
          }
        );

        observer.observe(image);
      });
    } catch (error) {
      this.#handleError('Failed to initialize lazy blur images', error);
    }
  }

  /**
   * Load blur image with fade effect
   * @param {HTMLImageElement} image - Image element
   * @param {HTMLElement} placeholder - Placeholder element
   * @private
   */
  #loadBlurImage(image, placeholder) {
    try {
      image.addEventListener('load', () => {
        requestAnimationFrame(() => {
          image.style.opacity = '1';
          placeholder.style.opacity = '0';
          
          // Clean up placeholder after transition
          setTimeout(() => {
            if (placeholder.parentNode) {
              placeholder.parentNode.removeChild(placeholder);
            }
          }, 300);
        });
      }, { once: true });

      // Trigger load if not already loaded
      if (image.complete) {
        image.dispatchEvent(new Event('load'));
      }
    } catch (error) {
      this.#handleError('Failed to load blur image', error);
    }
  }

  /**
   * Adjust slider opacity based on content
   * @private
   */
  #adjustSliderOpacity() {
    try {
      const sliders = document.querySelectorAll('[data-slider-opacity]');
      
      sliders.forEach((slider) => {
        this.#setupSliderOpacityObserver(slider);
      });
    } catch (error) {
      this.#handleError('Failed to adjust slider opacity', error);
    }
  }

  /**
   * Set up resize observer for slider opacity adjustment
   * @param {HTMLElement} slider - Slider element
   * @private
   */
  #setupSliderOpacityObserver(slider) {
    try {
      if (!this.#resizeObserver) {
        this.#resizeObserver = new ResizeObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.target.hasAttribute('data-slider-opacity')) {
              this.#calculateSliderOpacity(entry.target);
            }
          });
        });
      }

      this.#resizeObserver.observe(slider);
      
      // Initial calculation
      this.#calculateSliderOpacity(slider);
    } catch (error) {
      this.#handleError('Failed to setup slider opacity observer', error);
    }
  }

  /**
   * Calculate and apply slider opacity
   * @param {HTMLElement} slider - Slider element
   * @private
   */
  #calculateSliderOpacity(slider) {
    try {
      const slides = slider.querySelectorAll('.slide');
      const visibleSlides = Array.from(slides).filter(slide => {
        const rect = slide.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });

      const opacity = Math.max(0.3, Math.min(1, visibleSlides.length / slides.length));
      slider.style.setProperty('--slider-opacity', opacity.toString());
    } catch (error) {
      this.#handleError('Failed to calculate slider opacity', error);
    }
  }

  /**
   * Handle errors gracefully with user feedback
   * @param {string} message - Error message
   * @param {Error} error - Original error object
   * @private
   */
  #handleError(message, error) {
    console.error(`ElectricDOMReady: ${message}`, error);
    
    this.dispatchEvent(new CustomEvent('electric:dom-ready-error', {
      detail: { message, error: error.message },
      bubbles: true
    }));
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
    
    if (this.#resizeObserver) {
      this.#resizeObserver.disconnect();
      this.#resizeObserver = null;
    }
  }
}

// Register the custom element
if (!customElements.get('electric-dom-ready')) {
  customElements.define('electric-dom-ready', ElectricDOMReady);
}


