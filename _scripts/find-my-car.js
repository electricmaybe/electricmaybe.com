/**
 * FindMyCar Web Component
 * 
 * A lightweight search component for finding car types (collections).
 * Provides predictive search with debounced input handling and dropdown results.
 * 
 * @example
 * <find-my-car>
 *   <input type="text" placeholder="Search your car">
 * </find-my-car>
 */
class FindMyCar extends HTMLElement {
  /** @type {HTMLInputElement | null} Search input element */
  #input = null;

  /** @type {HTMLDivElement | null} Results dropdown container */
  #dropdown = null;

  /** @type {Object<string, string>} Cached search results */
  #cachedResults = {};

  /** @type {number | null} Debounce timer ID */
  #debounceTimer = null;

  /** @type {number} Debounce delay in milliseconds */
  #debounceDelay = 300;

  /** @type {AbortController | null} Fetch abort controller */
  #abortController = null;

  /** @type {boolean} Component connection state */
  #isConnected = false;

  /** @type {boolean} Whether dropdown is currently open */
  #isOpen = false;

  constructor() {
    super();
  }

  connectedCallback() {
    if (this.#isConnected) return;

    try {
      this.#isConnected = true;
      this.#initialize();
    } catch (error) {
      this.#handleError('Failed to initialize find-my-car component', error);
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
    this.#input = this.querySelector('input[type="text"]');
    
    if (!this.#input) {
      throw new Error('FindMyCar requires an input[type="text"] element');
    }

    this.#createDropdown();
    this.#setupEventListeners();
  }

  /**
   * Create the dropdown element
   * @private
   */
  #createDropdown() {
    this.#dropdown = document.createElement('div');
    this.#dropdown.className = 'absolute bg-white top-1/2 -left-px -right-px pt-8 max-h-80 overflow-y-auto hidden peer-focus:border-secondary border-transparent border-x border-b rounded-b-4xl';
    this.#dropdown.setAttribute('role', 'listbox');
    this.#dropdown.setAttribute('aria-label', 'Car search results');
    
    // Make the container relative for absolute positioning
    this.classList.add('relative', 'block');
    
    this.appendChild(this.#dropdown);
  }

  /**
   * Setup event listeners
   * @private
   */
  #setupEventListeners() {
    // Input events
    this.#input.addEventListener('input', this.#handleInput.bind(this));
    this.#input.addEventListener('focus', this.#handleFocus.bind(this));
    this.#input.addEventListener('keydown', this.#handleKeydown.bind(this));
    
    // Click outside to close
    document.addEventListener('click', this.#handleClickOutside.bind(this));
    
    // Escape key to close
    document.addEventListener('keydown', this.#handleEscape.bind(this));
  }

  /**
   * Handle input events
   * @param {Event} event - Input event
   * @private
   */
  #handleInput(event) {
    const query = this.#getQuery();
    
    // Clear debounce timer
    clearTimeout(this.#debounceTimer);
    
    // If empty, close dropdown
    if (!query) {
      this.#closeDropdown();
      return;
    }
    
    // Debounce the search
    this.#debounceTimer = setTimeout(() => {
      this.#performSearch(query);
    }, this.#debounceDelay);
  }

  /**
   * Handle focus events
   * @param {Event} event - Focus event
   * @private
   */
  #handleFocus(event) {
    const query = this.#getQuery();
    
    // If we have a query and cached results, show them
    if (query && this.#cachedResults[query.toLowerCase()]) {
      this.#renderResults(this.#cachedResults[query.toLowerCase()]);
      this.#openDropdown();
    }
  }

  /**
   * Handle keyboard navigation
   * @param {KeyboardEvent} event - Keyboard event
   * @private
   */
  #handleKeydown(event) {
    if (!this.#isOpen) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.#focusNextItem();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.#focusPreviousItem();
        break;
      case 'Enter':
        event.preventDefault();
        this.#selectFocusedItem();
        break;
      case 'Escape':
        event.preventDefault();
        this.#closeDropdown();
        this.#input.blur();
        break;
    }
  }

  /**
   * Handle click outside component
   * @param {MouseEvent} event - Click event
   * @private
   */
  #handleClickOutside(event) {
    if (!this.contains(event.target)) {
      this.#closeDropdown();
    }
  }

  /**
   * Handle escape key globally
   * @param {KeyboardEvent} event - Keyboard event
   * @private
   */
  #handleEscape(event) {
    if (event.key === 'Escape' && this.#isOpen) {
      this.#closeDropdown();
    }
  }

  /**
   * Get trimmed query from input
   * @returns {string} Trimmed query
   * @private
   */
  #getQuery() {
    return this.#input?.value.trim() || '';
  }

  /**
   * Perform search for collections
   * @param {string} query - Search query
   * @private
   */
  async #performSearch(query) {
    const queryKey = query.toLowerCase();
    
    // Check cache first
    if (this.#cachedResults[queryKey]) {
      this.#renderResults(this.#cachedResults[queryKey]);
      this.#openDropdown();
      return;
    }

    // Show loading state
    this.#showLoading();

    // Abort previous request if exists
    if (this.#abortController) {
      this.#abortController.abort();
    }

    this.#abortController = new AbortController();

    try {
      const response = await fetch(
        `${routes.predictive_search_url}?q=${encodeURIComponent(query)}&resources[type]=collection&section_id=api--search--predictive`,
        { signal: this.#abortController.signal }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const section = doc.querySelector('#shopify-section-api--search--predictive');

      if (section) {
        // Extract collections from the response
        const collections = this.#extractCollections(section);
        
        // Cache the results
        this.#cachedResults[queryKey] = collections;
        
        // Render results
        this.#renderResults(collections);
        this.#openDropdown();
      } else {
        this.#showNoResults();
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        // Request was aborted, ignore
        return;
      }
      
      this.#handleError('Failed to fetch search results', error);
      this.#showError();
    }
  }

  /**
   * Extract collections from search results
   * @param {HTMLElement} section - Section element containing results
   * @returns {Array<{title: string, url: string, handle: string}>} Array of collection objects
   * @private
   */
  #extractCollections(section) {
    const collections = [];
    const collectionElements = section.querySelectorAll('[data-collection-handle]');
    
    collectionElements.forEach(element => {
      const title = element.querySelector('[data-collection-title]')?.textContent?.trim() || 
                   element.textContent?.trim();
      const url = element.getAttribute('href') || 
                 element.querySelector('a')?.getAttribute('href');
      const handle = element.getAttribute('data-collection-handle');
      
      if (title && url && handle) {
        collections.push({ title, url, handle });
      }
    });

    // Fallback: try to find any links with collection URLs
    if (collections.length === 0) {
      const links = section.querySelectorAll('a[href*="/collections/"]');
      links.forEach(link => {
        const url = link.getAttribute('href');
        const title = link.textContent?.trim();
        const handle = url?.split('/collections/')[1]?.split('?')[0];
        
        if (title && url && handle) {
          collections.push({ title, url, handle });
        }
      });
    }

    return collections;
  }

  /**
   * Render search results in dropdown
   * @param {Array<{title: string, url: string, handle: string}>} collections - Collections to render
   * @private
   */
  #renderResults(collections) {
    if (!collections || collections.length === 0) {
      this.#showNoResults();
      return;
    }

    const html = collections.map((collection, index) => `
      <a
        href="${this.#escapeHtml(collection.url)}"
        class="block px-6 py-4 hover:bg-surface transition-colors duration-150 focus:bg-gray-100 focus:outline-none"
        role="option"
        data-collection-handle="${this.#escapeHtml(collection.handle)}"
        tabindex="-1"
      >
        <div class="font-medium text-primary">${this.#escapeHtml(collection.title)}</div>
      </a>
    `).join('');

    this.#dropdown.innerHTML = html;
    
    // Setup click handlers for collection items
    this.#dropdown.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', (e) => {
        this.#handleCollectionSelect(e, link);
      });
    });
  }

  /**
   * Handle collection selection
   * @param {Event} event - Click event
   * @param {HTMLElement} link - Selected link element
   * @private
   */
  #handleCollectionSelect(event, link) {
    const collectionHandle = link.getAttribute('data-collection-handle');
    const collectionTitle = link.textContent.trim();
    
    // Dispatch custom event
    this.dispatchEvent(new CustomEvent('collection:selected', {
      detail: {
        handle: collectionHandle,
        title: collectionTitle,
        url: link.getAttribute('href')
      },
      bubbles: true
    }));
    
    // Update input with selected value
    this.#input.value = collectionTitle;
    
    // Close dropdown
    this.#closeDropdown();
  }

  /**
   * Show loading state
   * @private
   */
  #showLoading() {
    this.#dropdown.innerHTML = `
      <div class="px-6 py-8 text-center text-secondary">
        <div class="inline-block w-5 h-5 border-2 border-primary-sub border-t-transparent rounded-full animate-spin"></div>
        <div class="mt-2">Searching...</div>
      </div>
    `;
    this.#openDropdown();
  }

  /**
   * Show no results message
   * @private
   */
  #showNoResults() {
    this.#dropdown.innerHTML = `
      <div class="px-6 py-8 text-center text-secondary">
        <div class="text-lg mb-2">🔍</div>
        <div>No cars found matching your search</div>
      </div>
    `;
    this.#openDropdown();
  }

  /**
   * Show error message
   * @private
   */
  #showError() {
    this.#dropdown.innerHTML = `
      <div class="px-6 py-8 text-center text-system-red">
        <div class="text-lg mb-2">⚠️</div>
        <div>Failed to load results. Please try again.</div>
      </div>
    `;
    this.#openDropdown();
  }

  /**
   * Open dropdown
   * @private
   */
  #openDropdown() {
    if (this.#isOpen) return;
    
    this.#dropdown.classList.remove('hidden');
    this.#isOpen = true;
    this.#input.setAttribute('aria-expanded', 'true');
    
    // Dispatch opened event
    this.dispatchEvent(new CustomEvent('dropdown:opened', {
      bubbles: true
    }));
  }

  /**
   * Close dropdown
   * @private
   */
  #closeDropdown() {
    if (!this.#isOpen) return;
    
    this.#dropdown.classList.add('hidden');
    this.#isOpen = false;
    this.#input.setAttribute('aria-expanded', 'false');
    
    // Dispatch closed event
    this.dispatchEvent(new CustomEvent('dropdown:closed', {
      bubbles: true
    }));
  }

  /**
   * Focus next item in dropdown
   * @private
   */
  #focusNextItem() {
    const items = Array.from(this.#dropdown.querySelectorAll('a'));
    const currentIndex = items.findIndex(item => item === document.activeElement);
    
    if (currentIndex === -1) {
      // Focus first item
      items[0]?.focus();
    } else if (currentIndex < items.length - 1) {
      // Focus next item
      items[currentIndex + 1]?.focus();
    } else {
      // Loop back to input
      this.#input?.focus();
    }
  }

  /**
   * Focus previous item in dropdown
   * @private
   */
  #focusPreviousItem() {
    const items = Array.from(this.#dropdown.querySelectorAll('a'));
    const currentIndex = items.findIndex(item => item === document.activeElement);
    
    if (currentIndex === -1 || currentIndex === 0) {
      // Focus input
      this.#input?.focus();
    } else {
      // Focus previous item
      items[currentIndex - 1]?.focus();
    }
  }

  /**
   * Select currently focused item
   * @private
   */
  #selectFocusedItem() {
    const focusedItem = this.#dropdown.querySelector('a:focus');
    
    if (focusedItem) {
      focusedItem.click();
    } else {
      // If no item is focused, close dropdown
      this.#closeDropdown();
    }
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped HTML
   * @private
   */
  #escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Handle errors gracefully
   * @param {string} message - Error message
   * @param {Error} error - Original error object
   * @private
   */
  #handleError(message, error) {
    console.error(`FindMyCar: ${message}`, error);
    
    this.dispatchEvent(new CustomEvent('search:error', {
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
    
    // Clear timers
    clearTimeout(this.#debounceTimer);
    this.#debounceTimer = null;
    
    // Abort pending requests
    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }
    
    // Remove event listeners
    document.removeEventListener('click', this.#handleClickOutside);
    document.removeEventListener('keydown', this.#handleEscape);
    
    // Clear cache
    this.#cachedResults = {};
  }
}

// Register the custom element
customElements.define('find-my-car', FindMyCar);

