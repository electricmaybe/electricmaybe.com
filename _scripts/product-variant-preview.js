/**
 * ProductVariantPreview Web Component
 * 
 * Handles hover-triggered fetching of product variant pages and replaces
 * variant-dynamic content without navigation. Provides smooth UX for
 * variant exploration.
 * 
 * @example
 * <a href="/products/product-handle?variant=123" 
 *    data-variant-preview 
 *    data-section-id="product--main">
 *   Variant Option
 * </a>
 */
class ProductVariantPreview extends HTMLElement {
  /** @type {AbortController | null} Current fetch abort controller */
  #abortController = null;
  
  /** @type {number | null} Hover delay timer */
  #hoverTimer = null;
  
  /** @type {boolean} Component connection state */
  #isConnected = false;
  
  /** @type {number} Hover delay before fetch starts (ms) */
  #hoverDelay = 300;
  
  /** @type {boolean} Whether fetch is in progress */
  #isFetching = false;
  
  /** @type {string | null} Currently loaded variant URL */
  #currentVariantUrl = null;

  constructor() {
    super();
  }

  /**
   * Get the href attribute value
   * @returns {string} The href attribute value
   */
  get href() {
    return this.getAttribute('href') || '';
  }

  /**
   * Set the href attribute value
   * @param {string} value - The href value to set
   */
  set href(value) {
    this.setAttribute('href', value);
  }

  connectedCallback() {
    console.log('🔍 ProductVariantPreview: connectedCallback triggered');
    console.log('🔍 ProductVariantPreview: Is connected:', this.#isConnected);
    
    if (this.#isConnected) {
      console.log('🔍 ProductVariantPreview: Already connected, skipping initialization');
      return;
    }
    
    try {
      this.#isConnected = true;
      console.log('🔍 ProductVariantPreview: Set isConnected to true');
      this.#initializeEventListeners();
    } catch (error) {
      console.error('🔍 ProductVariantPreview: Error in connectedCallback:', error);
      this.#handleError('Failed to initialize variant preview', error);
    }
  }

  disconnectedCallback() {
    this.#cleanup();
  }

  /**
   * Initialize event listeners for hover interactions
   * @private
   */
  #initializeEventListeners() {
    console.log('🔍 ProductVariantPreview: Initializing event listeners');
    console.log('🔍 ProductVariantPreview: Element href:', this.href);
    console.log('🔍 ProductVariantPreview: Element href attribute:', this.getAttribute('href'));
    console.log('🔍 ProductVariantPreview: Element dataset:', this.dataset);
    
    // Prevent default navigation on click
    this.addEventListener('click', this.#handleClick.bind(this));
    
    // Handle hover start
    this.addEventListener('mouseenter', this.#handleMouseEnter.bind(this));
    this.addEventListener('focus', this.#handleMouseEnter.bind(this));
    
    // Handle hover end
    this.addEventListener('mouseleave', this.#handleMouseLeave.bind(this));
    this.addEventListener('blur', this.#handleMouseLeave.bind(this));
    
    console.log('🔍 ProductVariantPreview: Event listeners initialized');
  }

  /**
   * Handle click events - prevent default navigation
   * @param {Event} event - Click event
   * @private
   */
  #handleClick(event) {
    console.log('🔍 ProductVariantPreview: Click event triggered');
    console.log('🔍 ProductVariantPreview: Current variant URL:', this.#currentVariantUrl);
    console.log('🔍 ProductVariantPreview: Element href:', this.href);
    console.log('🔍 ProductVariantPreview: Is fetching:', this.#isFetching);
    
    // Only prevent default if we have successfully loaded a variant
    if (this.#currentVariantUrl) {
      console.log('🔍 ProductVariantPreview: Preventing default navigation');
      event.preventDefault();
      
      // Dispatch custom event for parent components to handle
      this.dispatchEvent(new CustomEvent('variant:preview-click', {
        detail: { 
          variantUrl: this.href,
          currentVariantUrl: this.#currentVariantUrl 
        },
        bubbles: true
      }));
      
      console.log('🔍 ProductVariantPreview: Dispatched variant:preview-click event');
    } else {
      console.log('🔍 ProductVariantPreview: No current variant URL, allowing default navigation');
    }
  }

  /**
   * Handle mouse enter/focus events - start hover timer
   * @param {Event} event - Mouse enter or focus event
   * @private
   */
  #handleMouseEnter(event) {
    console.log('🔍 ProductVariantPreview: Mouse enter/focus event');
    console.log('🔍 ProductVariantPreview: Element href:', this.href);
    
    // Clear any existing timer
    clearTimeout(this.#hoverTimer);
    
    // Start new timer
    this.#hoverTimer = setTimeout(() => {
      console.log('🔍 ProductVariantPreview: Hover timer expired, starting fetch');
      this.#fetchVariantContent();
    }, this.#hoverDelay);
    
    console.log('🔍 ProductVariantPreview: Started hover timer for', this.#hoverDelay, 'ms');
  }

  /**
   * Handle mouse leave/blur events - cancel operations
   * @param {Event} event - Mouse leave or blur event
   * @private
   */
  #handleMouseLeave(event) {
    console.log('🔍 ProductVariantPreview: Mouse leave/blur event');
    
    // Clear hover timer
    clearTimeout(this.#hoverTimer);
    this.#hoverTimer = null;
    
    // Abort any ongoing fetch
    if (this.#abortController) {
      console.log('🔍 ProductVariantPreview: Aborting ongoing fetch');
      this.#abortController.abort();
      this.#abortController = null;
    }
    
    console.log('🔍 ProductVariantPreview: Cleared hover timer and aborted fetch');
  }

  /**
   * Get list of sections that need to be fetched based on variant-dynamic elements
   * @returns {string[]} Array of section IDs to fetch
   * @private
   */
  #getSectionsToFetch() {
    const sections = new Set();
    
    // Find all variant-dynamic elements and determine their sections
    document.querySelectorAll('[data-variant-dynamic]').forEach(element => {
      const sectionId = element.dataset.sectionId || this.#getSectionIdFromElement(element);
      if (sectionId) {
        sections.add(sectionId);
      }
    });
    
    // Always include the main product section
    sections.add('product--main');
    
    return Array.from(sections);
  }

  /**
   * Get section ID from element by traversing up the DOM
   * @param {Element} element - The element to find section for
   * @returns {string|null} Section ID or null if not found
   * @private
   */
  #getSectionIdFromElement(element) {
    // Look for section element with id attribute
    const section = element.closest('section[id]');
    if (section) {
      return section.id;
    }
    
    // Look for section element with data-section-id
    const sectionWithData = element.closest('section[data-section-id]');
    if (sectionWithData) {
      return sectionWithData.dataset.sectionId;
    }
    
    return null;
  }

  /**
   * Fetch a specific section using Shopify's section rendering API
   * @param {string} sectionId - The section ID to fetch
   * @returns {Promise<{sectionId: string, html: string}>} Section data
   * @private
   */
  async #fetchSection(sectionId) {
    console.log('🔍 ProductVariantPreview: Fetching section:', sectionId);
    
    const fetchUrl = `${this.href}?section_id=${sectionId}`;
    console.log('🔍 ProductVariantPreview: Section fetch URL:', fetchUrl);
    
    const response = await fetch(fetchUrl, {
      signal: this.#abortController.signal,
      headers: {
        'Accept': 'text/html',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch section ${sectionId}: HTTP ${response.status}`);
    }
    
    const html = await response.text();
    console.log('🔍 ProductVariantPreview: Fetched section', sectionId, 'length:', html.length);
    
    return { sectionId, html };
  }

  /**
   * Fetch variant content from the product page
   * @private
   */
  async #fetchVariantContent() {
    console.log('🔍 ProductVariantPreview: Starting fetchVariantContent');
    console.log('🔍 ProductVariantPreview: Is fetching:', this.#isFetching);
    console.log('🔍 ProductVariantPreview: Element href:', this.href);
    
    if (this.#isFetching || !this.href) {
      console.log('🔍 ProductVariantPreview: Fetch blocked - isFetching:', this.#isFetching, 'href:', this.href);
      return;
    }
    
    try {
      this.#isFetching = true;
      console.log('🔍 ProductVariantPreview: Set isFetching to true');
      
      // Add loading state
      this.setAttribute('data-loading', 'true');
      console.log('🔍 ProductVariantPreview: Added data-loading attribute');
      
      // Create new abort controller for this fetch
      this.#abortController = new AbortController();
      
      // Get all sections that need to be fetched
      const sectionsToFetch = this.#getSectionsToFetch();
      console.log('🔍 ProductVariantPreview: Sections to fetch:', sectionsToFetch);
      
      // Fetch all sections in parallel
      const fetchPromises = sectionsToFetch.map(sectionId => 
        this.#fetchSection(sectionId)
      );
      
      const sectionResults = await Promise.all(fetchPromises);
      console.log('🔍 ProductVariantPreview: All sections fetched successfully');
      
      // Update variant-dynamic content with all fetched sections
      await this.#updateVariantContent(sectionResults, this.href);
      
      // Store current variant URL
      this.#currentVariantUrl = this.href;
      console.log('🔍 ProductVariantPreview: Stored current variant URL:', this.#currentVariantUrl);
      
      // Dispatch success event
      this.dispatchEvent(new CustomEvent('variant:preview-loaded', {
        detail: { variantUrl: this.href, sectionsFetched: sectionsToFetch },
        bubbles: true
      }));
      
      console.log('🔍 ProductVariantPreview: Dispatched variant:preview-loaded event');
      
    } catch (error) {
      // Don't throw for aborted requests
      if (error.name === 'AbortError') {
        console.log('🔍 ProductVariantPreview: Fetch was aborted');
        return;
      }
      
      console.error('🔍 ProductVariantPreview: Fetch error:', error);
      this.#handleError('Failed to fetch variant content', error);
    } finally {
      this.#isFetching = false;
      this.#abortController = null;
      
      // Remove loading state
      this.removeAttribute('data-loading');
      console.log('🔍 ProductVariantPreview: Cleanup completed - isFetching:', this.#isFetching);
    }
  }

  /**
   * Update variant-dynamic content with fetched sections
   * @param {Array<{sectionId: string, html: string}>} sectionResults - Array of fetched sections
   * @param {string} variantUrl - Variant URL being loaded
   * @private
   */
  async #updateVariantContent(sectionResults, variantUrl) {
    console.log('🔍 ProductVariantPreview: Starting updateVariantContent');
    console.log('🔍 ProductVariantPreview: Variant URL:', variantUrl);
    console.log('🔍 ProductVariantPreview: Sections to process:', sectionResults.length);
    
    try {
      // Parse all fetched sections
      const sectionDocs = new Map();
      sectionResults.forEach(({ sectionId, html }) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        sectionDocs.set(sectionId, doc);
        console.log('🔍 ProductVariantPreview: Parsed section:', sectionId);
      });
      
      // Find all variant-dynamic elements in the current page
      const currentElements = document.querySelectorAll('[data-variant-dynamic]');
      console.log('🔍 ProductVariantPreview: Found variant-dynamic elements:', currentElements.length);
      
      if (currentElements.length === 0) {
        console.warn('ProductVariantPreview: No variant-dynamic elements found on current page');
        return;
      }
      
      // Add loading state
      currentElements.forEach(element => {
        element.classList.add('opacity-20', 'transition-opacity', 'duration-200');
      });
      console.log('🔍 ProductVariantPreview: Added loading state to elements');
      
      // Update each variant-dynamic element
      let updatedCount = 0;
      currentElements.forEach(element => {
        const dynamicId = element.dataset.variantDynamic;
        if (!dynamicId) {
          console.log('🔍 ProductVariantPreview: Element missing variantDynamic ID:', element);
          return;
        }
        
        console.log('🔍 ProductVariantPreview: Processing element with ID:', dynamicId);
        
        // Determine which section this element belongs to
        const elementSectionId = element.dataset.sectionId || this.#getSectionIdFromElement(element) || 'product--main';
        console.log('🔍 ProductVariantPreview: Element section ID:', elementSectionId);
        
        // Get the corresponding section document
        const sectionDoc = sectionDocs.get(elementSectionId);
        if (!sectionDoc) {
          console.log('🔍 ProductVariantPreview: No section document found for:', elementSectionId);
          return;
        }
        
        // Find corresponding element in fetched content
        const fetchedElement = sectionDoc.querySelector(`[data-variant-dynamic="${dynamicId}"]`);
        
        if (fetchedElement) {
          console.log('🔍 ProductVariantPreview: Found matching element in fetched content');
          
          // Handle keep/remove attributes
          let updatedContent = fetchedElement.innerHTML;
          
          if (element.dataset.keep) {
            console.log('🔍 ProductVariantPreview: Applying keep attributes:', element.dataset.keep);
            updatedContent = this.#applyKeepAttributes(updatedContent, element.dataset.keep);
          }
          
          if (element.dataset.remove) {
            console.log('🔍 ProductVariantPreview: Applying remove attributes:', element.dataset.remove);
            updatedContent = this.#applyRemoveAttributes(updatedContent, element.dataset.remove);
          }
          
          // Update the content
          element.innerHTML = updatedContent;
          updatedCount++;
          console.log('🔍 ProductVariantPreview: Updated element:', dynamicId);
        } else {
          console.log('🔍 ProductVariantPreview: No matching element found for ID:', dynamicId, 'in section:', elementSectionId);
        }
      });
      
      // Remove loading state
      currentElements.forEach(element => {
        element.classList.remove('opacity-20');
      });
      console.log('🔍 ProductVariantPreview: Removed loading state from elements');
      
      // Dispatch content updated event
      this.dispatchEvent(new CustomEvent('variant:content-updated', {
        detail: { variantUrl, updatedElements: updatedCount, sectionsProcessed: sectionResults.length },
        bubbles: true
      }));
      
      console.log('🔍 ProductVariantPreview: Dispatched content-updated event, updated elements:', updatedCount);
      
    } catch (error) {
      console.error('🔍 ProductVariantPreview: Error in updateVariantContent:', error);
      this.#handleError('Failed to update variant content', error);
    }
  }

  /**
   * Apply keep attributes to preserve specific form elements
   * @param {string} content - HTML content to modify
   * @param {string} keepData - JSON string of attributes to keep
   * @returns {string} Modified content
   * @private
   */
  #applyKeepAttributes(content, keepData) {
    try {
      const keepAttributes = JSON.parse(keepData);
      
      Object.entries(keepAttributes).forEach(([attribute, value]) => {
        if (attribute === 'form') {
          // Preserve form attribute by finding form elements and keeping their form attribute
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = content;
          
          tempDiv.querySelectorAll('input, select, textarea, button').forEach(element => {
            if (element.form) {
              element.setAttribute('form', element.form.id || element.form.name);
            }
          });
          
          content = tempDiv.innerHTML;
        }
      });
      
      return content;
    } catch (error) {
      console.warn('ProductVariantPreview: Failed to parse keep attributes', error);
      return content;
    }
  }

  /**
   * Apply remove attributes to strip specific attributes
   * @param {string} content - HTML content to modify
   * @param {string} removeData - Comma-separated list of attributes to remove
   * @returns {string} Modified content
   * @private
   */
  #applyRemoveAttributes(content, removeData) {
    try {
      const removeAttributes = removeData.split(',').map(attr => attr.trim());
      
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      
      tempDiv.querySelectorAll('*').forEach(element => {
        removeAttributes.forEach(attr => {
          element.removeAttribute(attr);
        });
      });
      
      return tempDiv.innerHTML;
    } catch (error) {
      console.warn('ProductVariantPreview: Failed to apply remove attributes', error);
      return content;
    }
  }

  /**
   * Handle errors gracefully with user feedback
   * @param {string} message - Error message
   * @param {Error} error - Original error object
   * @private
   */
  #handleError(message, error) {
    console.error(`ProductVariantPreview: ${message}`, error);
    
    this.dispatchEvent(new CustomEvent('variant:preview-error', {
      detail: { 
        message, 
        error: error.message,
        variantUrl: this.href 
      },
      bubbles: true
    }));
  }

  /**
   * Clean up resources and event listeners
   * @private
   */
  #cleanup() {
    this.#isConnected = false;
    
    // Clear timers
    clearTimeout(this.#hoverTimer);
    this.#hoverTimer = null;
    
    // Abort any ongoing fetch
    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }
    
    this.#isFetching = false;
    this.#currentVariantUrl = null;
  }
}

// Register the web component
console.log('🔍 ProductVariantPreview: Registering web component');
customElements.define('product-variant-preview', ProductVariantPreview);
console.log('🔍 ProductVariantPreview: Web component registered successfully');

// Link conversion is now handled by electric-variant-link-converter component
// This ensures it works even when scripts are injected after DOM is ready
