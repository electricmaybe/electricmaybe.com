// Core functionality interfaces
class SearchFeature {
  constructor(host) {
    this.host = host;
  }

  init() {} // Optional initialization
  destroy() {} // Cleanup if needed
}
class ProductTypeFilter extends SearchFeature {
  constructor(host) {
    super(host);
    this.productTypeSelector = host.querySelector('.js-product-type');
    this.input = host.querySelector('input[type="search"]');
    this.boundFilterChange = this.handleFilterChange.bind(this);
  }

  init() {
    if (this.productTypeSelector) {
      this.productTypeSelector.addEventListener('change', this.boundFilterChange);
    }
  }

  destroy() {
    if (this.productTypeSelector) {
      this.productTypeSelector.removeEventListener('change', this.boundFilterChange);
    }
  }

  handleFilterChange() {
    this.applyFilter();
    // Trigger search with new filter if there's an active search
    if (this.input.value.trim()) {
      // If predictive search is enabled, trigger it
      if (!this.host.dataset?.disabled) {
        this.host.features.search.onChange();
      }
    }
  }

  getFilter() {
    return this.productTypeSelector?.value.replace(' ', '+') || '';
  }

  applyFilter() {
    const cloneNode = this.input.cloneNode(true);
    cloneNode.setAttribute("type", "hidden");
    cloneNode.value = '';

    const productTypeFilter = this.getFilter();

    if (productTypeFilter !== '') {
      cloneNode.value += "product_type:" + productTypeFilter;
      if (this.input.value !== '') {
        cloneNode.value += " AND ";
      }
    }
    cloneNode.value += this.input.value;

    this.input.removeAttribute("name");
    this.input.insertAdjacentElement("afterend", cloneNode);
  }
}

class KeyboardManager extends SearchFeature {
  constructor(host) {
    super(host);
    this.input = host.querySelector('input[type="search"]');
    this.boundShortcutHandler = this.handleShortcut.bind(this);
  }

  init() {
    document.addEventListener("keydown", this.boundShortcutHandler);
  }

  destroy() {
    document.removeEventListener("keydown", this.boundShortcutHandler);
  }

  handleShortcut(event) {
    // Ignore if another handler already handled it
    if (event.defaultPrevented) return;

    // Normalize key
    const key = (event.key || '').toLowerCase();

    // Do not trigger on plain '/' while typing in editable fields
    const activeElement = document.activeElement;
    const isEditable =
      activeElement && (
        activeElement.isContentEditable ||
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute?.('role') === 'textbox'
      );

    // Slash to focus only when not inside an editable target
    const isSlashFocus = key === '/' && !isEditable;

    // Cmd/Ctrl+K anywhere (avoid with extra modifiers)
    const isShortcutFocus =
      key === 'k' && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey;

    if (isSlashFocus || isShortcutFocus) {
      event.preventDefault();
      
      // Find and click the search drawer trigger
      const searchTrigger = document.querySelector('drawer-trigger[data-target="search-drawer"]');
      if (searchTrigger) {
        searchTrigger.click();
      }
    }
  }
}

class PredictiveSearchCore extends SearchFeature {
  constructor(host) {
    super(host);
    this.cachedResults = {};
    this.input = host.querySelector('input[type="search"]');
    this.outputWrapper = host.querySelector(".js-search-output-wrapper");
    this.resultsList = host.querySelector("#predictive-search-results-list");
    this.statusElement = host.querySelector(".predictive-search-status");
    this.displayElement = host.querySelector(".search-input-display");
    this.isOpen = false;
    this.noResults = false;
    this.show_collections = host.dataset.collections === 'true';
    this.isOpenedByClick = false; // Track if search was opened by click vs focus
    this.isSubmitting = false; // Track if form is being submitted
    this.isShowingSuggestions = false; // Track if suggestions are currently being shown to prevent duplicate calls

    this.boundHandlers = {
      onChange: debounce(this.onChange.bind(this), 300),
      onInput: this.onInput.bind(this),
      onFocus: this.onFocus.bind(this),
      onKeyup: this.onKeyup.bind(this),
      onKeydown: this.onKeydown.bind(this),
      onRecentSearchClick: this.onRecentSearchClick.bind(this)
    };
  }

  init() {
    console.log('🔍 [Electric Search] Initializing search component...');
    
    if (this.host.dataset?.disabled) {
      console.log('🔍 [Electric Search] Search component is disabled, skipping initialization');
      return;
    }

    this.setupEventListeners();
    this.saveSuggestions();
    this.setupDrawerListeners();

    // Check if input already has a value (e.g., on search page)
    const currentQuery = this.getQuery();
    if (currentQuery.length > 0) {
      // If we have search terms, mark that we have results
      this.host.setAttribute("results", true);
      // Update search form visibility
      this.updateSearchForm();
    }

    // Inject recent searches into saved suggestions
    const tempWrapper = document.createElement('div');
    tempWrapper.innerHTML = this.suggestions;
    const popularSearchesList = tempWrapper.querySelector('ul.space-y-3.font-medium.mb-6');
    if (popularSearchesList) {
      const recentSearchesHtml = this.generateRecentSearchesHtml();
      if (recentSearchesHtml) {
        // Create wrapper for recent searches
        const recentWrapper = document.createElement('div');
        recentWrapper.setAttribute('data-recent-searches', 'true');
        recentWrapper.className = 'mb-6 px-b-lg';
        recentWrapper.innerHTML = recentSearchesHtml;

        // Insert before popular searches
        popularSearchesList.parentNode.insertBefore(recentWrapper, popularSearchesList);
        this.suggestions = tempWrapper.innerHTML;
      }
    }
  }

  destroy() {
    this.removeEventListeners();
    this.removeDrawerListeners();
  }

  /**
   * Setup drawer event listeners
   * @private
   */
  setupDrawerListeners() {
    this.boundDrawerOpenHandler = this.handleDrawerOpen.bind(this);
    this.boundDrawerCloseHandler = this.handleDrawerClose.bind(this);
    
    // Find the search drawer element
    this.searchDrawer = document.getElementById('search-drawer');
    if (this.searchDrawer) {
      this.searchDrawer.addEventListener('drawer:opened', this.boundDrawerOpenHandler);
      this.searchDrawer.addEventListener('drawer:closed', this.boundDrawerCloseHandler);
    }
  }

  /**
   * Remove drawer event listeners
   * @private
   */
  removeDrawerListeners() {
    if (this.searchDrawer) {
      this.searchDrawer.removeEventListener('drawer:opened', this.boundDrawerOpenHandler);
      this.searchDrawer.removeEventListener('drawer:closed', this.boundDrawerCloseHandler);
    }
  }

  /**
   * Handle drawer open event
   * @private
   */
  handleDrawerOpen() {
    this.isOpen = true;
    
    // Focus the input when drawer opens
    setTimeout(() => {
      this.input?.focus({ preventScroll: true });
      this.positionCursorAtEnd();
    }, 100);

    const searchTerm = this.getQuery();
    if (!searchTerm.length) {
      this.showSuggestions();
    } else if (this.host.getAttribute("results") === "true") {
      // Results already loaded
    } else {
      this.getSearchResults(searchTerm);
    }
  }

  /**
   * Handle drawer close event
   * @private
   */
  handleDrawerClose() {
    this.isOpen = false;
    
    const selected = this.host.querySelector('[aria-selected="true"]');
    if (selected) selected.setAttribute("aria-selected", false);
    
    this.input.setAttribute("aria-activedescendant", "");
  }

  setupEventListeners() {
    this.input.addEventListener("input", this.boundHandlers.onChange);
    this.input.addEventListener("input", this.boundHandlers.onInput);
    this.input.addEventListener("focus", this.boundHandlers.onFocus);
    this.host.addEventListener("keyup", this.boundHandlers.onKeyup);
    this.host.addEventListener("keydown", this.boundHandlers.onKeydown);
    if (this.outputWrapper) {
      this.outputWrapper.addEventListener("click", this.boundHandlers.onRecentSearchClick);
    }
  }

  removeEventListeners() {
    this.input.removeEventListener("input", this.boundHandlers.onChange);
    this.input.removeEventListener("input", this.boundHandlers.onInput);
    this.input.removeEventListener("focus", this.boundHandlers.onFocus);
    this.host.removeEventListener("keyup", this.boundHandlers.onKeyup);
    this.host.removeEventListener("keydown", this.boundHandlers.onKeydown);
    if (this.outputWrapper) {
      this.outputWrapper.removeEventListener("click", this.boundHandlers.onRecentSearchClick);
    }
  }

  saveSuggestions() {
    this.suggestions = this.outputWrapper.innerHTML;
  }

  /**
   * Generate recent searches HTML
   * @private
   * @returns {string} HTML string for recent searches section
   */
  generateRecentSearchesHtml() {
    let recentSearches = [];
    try {
      recentSearches = JSON.parse(localStorage.getItem('recent_searches') || '[]');
    } catch (e) {
      // Clear corrupted data
      localStorage.removeItem('recent_searches');
      return '';
    }

    if (!Array.isArray(recentSearches) || recentSearches.length === 0) return '';

    // Ensure all searches are strings and clean up localStorage if needed
    const validSearches = recentSearches.filter(q => typeof q === 'string' && q.trim());

    // If we filtered out invalid entries, update localStorage
    if (validSearches.length !== recentSearches.length) {
      localStorage.setItem('recent_searches', JSON.stringify(validSearches));
    }

    if (validSearches.length === 0) return '';

    return `
      <ul class="space-y-b-sm mb-6">
        ${validSearches.map((query, index) => `
          <li class="slide-right-sm" style="--nth-child:${index + 1}" data-recent-search-item="true" data-query="${this.escapeHtml(query)}">
            <div class="flex justify-between items-center gap-x-3">
              <a
                href="${routes.search_url}?q=${encodeURIComponent(query)}"
                class="hover:underline w-full block"
                data-recent-search-link="true"
              >
                ${this.escapeHtml(query)}
              </a>
              <button
                type="button"
                class="shrink-0 cursor-pointer hover:opacity-70"
                data-recent-search-delete="true"
                aria-label="Remove ${this.escapeHtml(query)} from recent searches"
              >
                ${window.icons.trash}
              </button>
            </div>
          </li>
        `).join('')}
      </ul>
    `;
  }

  /**
   * Handle click events for recent search actions (e.g., delete)
   * Uses event delegation to avoid per-item listeners.
   * @param {MouseEvent} event
   * @private
   */
  onRecentSearchClick(event) {
    const deleteButton = event.target.closest('[data-recent-search-delete="true"]');
    if (!deleteButton) return;

    // Prevent navigation when trash icon is clicked
    event.preventDefault();
    event.stopPropagation();

    const item = deleteButton.closest('[data-recent-search-item="true"]');
    if (!item) return;

    const query = item.getAttribute('data-query') || '';
    if (!query) return;

    // Update localStorage
    try {
      const stored = JSON.parse(localStorage.getItem('recent_searches') || '[]');
      if (Array.isArray(stored)) {
        const updated = stored.filter(search => search !== query);
        localStorage.setItem('recent_searches', JSON.stringify(updated));
      }
    } catch (error) {
      console.warn('Failed to remove recent search:', error);
    }

    // Remove item from DOM
    const list = item.parentElement;
    item.remove();

    // If list is empty, remove the wrapper container
    if (list && list.children.length === 0) {
      const wrapper = list.closest('[data-recent-searches="true"]');
      if (wrapper) {
        wrapper.remove();
      }
    }
  }

  /**
   * Escape HTML to prevent XSS
   * @private
   * @param {string} text
   * @returns {string}
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Inject recent searches above popular searches
   * @private
   */
  injectRecentSearches() {
    // Check if recent searches already injected
    if (this.outputWrapper.querySelector('[data-recent-searches]')) return;

    const popularSearchesList = this.outputWrapper.querySelector('.trending-searches-title');
    if (!popularSearchesList) return;

    const recentSearchesHtml = this.generateRecentSearchesHtml();
    if (recentSearchesHtml) {
      // Create a wrapper div with the recent searches
      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-recent-searches', 'true');
      wrapper.className = 'mb-6 px-b-lg';
      wrapper.innerHTML = recentSearchesHtml;

      // Insert before popular searches
      popularSearchesList.parentNode.insertBefore(wrapper, popularSearchesList);
    }
  }

  getQuery() {
    return this.input.value.trim();
  }


  /**
   * Update search form visibility and content based on input length
   * @private
   */
  updateSearchForm() {
    const searchFormContainer = this.host.querySelector('#search-form-container');
    const searchFormInput = this.host.querySelector('#search-form-input');
    const searchFormLabel = this.host.querySelector('#search-form-label');
    
    if (!searchFormContainer || !searchFormInput || !searchFormLabel) return;

    const value = this.input.value.trim();
    
    // Show form if input has 3+ characters, hide otherwise
    if (value.length >= 3) {
      searchFormContainer.classList.remove('hidden');
      
      // Update the hidden input value
      searchFormInput.value = value;
      
      // Update the button label with the search term
      const searchForText = window.theme?.strings?.templates?.search?.search_for || 'View all products for {{ terms }}';
      searchFormLabel.textContent = searchForText.replace('{{ terms }}', `"${value}"`);
    } else {
      searchFormContainer.classList.add('hidden');
    }
  }

  /**
   * Position cursor at the end of the input text
   * @private
   */
  positionCursorAtEnd() {
    if (!this.input) return;
    
    const value = this.input.value;
    if (value.length > 0) {
      // Use setTimeout to ensure the focus has been applied before setting cursor position
      setTimeout(() => {
        this.input.setSelectionRange(value.length, value.length);
      }, 0);
    }
  }

  /**
   * Handle input events for real-time form sync
   * @private
   */
  onInput() {
    this.updateSearchForm();
  }

  /**
   * Check if current device is mobile based on breakpoint
   * @returns {boolean} True if mobile device
   * @private
   */
  isMobile() {
    const mobileBreakpoints = ["xs", "sm", "md"];
    const currentBreakpoint = getCurrentBreakpoint();
    return mobileBreakpoints.includes(currentBreakpoint);
  }


  onChange() {
    // Don't handle change events during form submission
    if (this.isSubmitting) return;

    const searchTerm = this.getQuery();
    console.log('🔍 [Electric Search] onChange called with searchTerm:', searchTerm);
    this.host.querySelector(".js-error-message").style.display = "";

    if (!searchTerm.length) {
      console.log('🔍 [Electric Search] No search term, showing suggestions');
      this.showSuggestions();
      return;
    }

    console.log('🔍 [Electric Search] Getting search results for:', searchTerm);
    this.getSearchResults(searchTerm);
  }

  onFocus() {
    // Don't handle focus events during form submission
    if (this.isSubmitting) return;

    // Position cursor at end of text when focusing
    this.positionCursorAtEnd();

    const searchTerm = this.getQuery();

    if (!searchTerm.length) {
      this.showSuggestions();
      return;
    }

    if (this.host.getAttribute("results") === "true") {
      // Results already loaded, just make sure they're visible
    } else {
      this.getSearchResults(searchTerm);
    }
  }


  onKeyup(event) {
    // Don't handle keyboard events during form submission
    if (this.isSubmitting) return;

    switch (event.code) {
      case "Escape": {
        event.preventDefault();
        // Close the drawer by clicking the drawer trigger
        if (this.searchDrawer) {
          const drawerTrigger = this.searchDrawer.querySelector('drawer-trigger[data-target="search-drawer"]');
          if (drawerTrigger) drawerTrigger.click();
        }
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        this.switchOption("up");
        break;
      }
      case "ArrowDown": {
        event.preventDefault();
        this.switchOption("down");
        break;
      }
      case "Enter": {
        // Only prevent default when we actively trigger a selection click.
        // Otherwise allow native form submit via Enter.
        const selectedOption = this.host.querySelector('[aria-selected="true"] a, [aria-selected="true"] button');
        if (selectedOption) {
          event.preventDefault();
          selectedOption.click();
        }
        break;
      }
    }
  }

  onKeydown(event) {
    // Don't handle keyboard events during form submission
    if (this.isSubmitting) return;

    if (event.code === "ArrowUp" || event.code === "ArrowDown") {
      event.preventDefault();
    }
  }

  showSuggestions() {
    if (this.host.dataset?.disabled) return;
    // Don't show suggestions during form submission
    if (this.isSubmitting) return;
    // Prevent duplicate calls in quick succession
    if (this.isShowingSuggestions) {
      return;
    }

    this.isShowingSuggestions = true;

    // Clear results attribute since we're showing suggestions now
    this.host.removeAttribute("results");

    // Check for actual elements that exist in the template: .trending-searches-title and #promoted-list
    const hasPopularCars = this.outputWrapper.querySelector('.trending-searches-title');
    const hasPromotedList = this.outputWrapper.querySelector('#promoted-list');
    const hasRecentSearches = this.outputWrapper.querySelector('[data-recent-searches]');
    
    // Only reset if we don't have the core suggestion elements
    if (!hasPopularCars || !hasPromotedList) {
      this.outputWrapper.innerHTML = this.suggestions;
    }

    // Inject recent searches
    this.injectRecentSearches();

    this.input.setAttribute("aria-expanded", true);
    if (this.resultsList) this.resultsList.classList.remove('[&_>_*]:opacity-50');
    
    // Reset flag after a short delay to allow for async operations
    setTimeout(() => {
      this.isShowingSuggestions = false;
    }, 200);
  }

  switchOption(direction) {
    if (!this.isOpen) return;

    const moveUp = direction === "up";
    const selectedElement = this.host.querySelector('[aria-selected="true"]');
    const allVisibleElements = Array.from(
      this.host.querySelectorAll("li, button.predictive-search__item")
    ).filter((element) => element.offsetParent !== null);

    let activeElementIndex = 0;
    if (moveUp && !selectedElement) return;

    let selectedElementIndex = allVisibleElements.findIndex(
      element => element === selectedElement
    );

    if (this.statusElement) this.statusElement.textContent = "";

    if (!moveUp && selectedElement) {
      activeElementIndex =
        selectedElementIndex === allVisibleElements.length - 1
          ? 0
          : selectedElementIndex + 1;
    } else if (moveUp) {
      activeElementIndex =
        selectedElementIndex === 0
          ? allVisibleElements.length - 1
          : selectedElementIndex - 1;
    }

    if (activeElementIndex === selectedElementIndex) return;

    const activeElement = allVisibleElements[activeElementIndex];
    activeElement.setAttribute("aria-selected", true);
    if (selectedElement) selectedElement.setAttribute("aria-selected", false);

    this.input.setAttribute("aria-activedescendant", activeElement.id);
  }


  async getSearchResults(searchTerm) {
    // Don't fetch search results during form submission
    if (this.isSubmitting) return;

    let queryKey = searchTerm.replace(" ", "+").toLowerCase();
    const productTypeFilter = this.host.features.productTypeFilter?.getFilter() || '';

    if (productTypeFilter !== '') {
      queryKey = `product_type:${productTypeFilter} AND ${queryKey}`;
    }

    this.setLiveRegionLoadingState();

    if (this.cachedResults[queryKey]) {
      this.noResults = false;
      this.renderSearchResults(this.cachedResults[queryKey]);
      return;
    }

    try {
      const response = await fetch(
        `${routes.predictive_search_url}?q=${encodeURIComponent(
          queryKey
        )}&${encodeURIComponent(
          "resources[type]"
        )}=product${this.show_collections ? ',collection' : ''}&section_id=api--search--predictive`
      );

      if (!response.ok) {
        throw new Error(response.status);
      }

      const text = await response.text();
      const resultsMarkup = new DOMParser()
        .parseFromString(text, "text/html")
        .querySelector("#shopify-section-api--search--predictive");

      const noResultsItem = resultsMarkup.querySelector("#no-results");
      const noResultsText = this.host.querySelector(".js-error-message");

      this.noResults = false;
      if (noResultsItem) {
        this.noResults = true;
        noResultsText.innerHTML = noResultsItem.innerHTML;
      } else {
        this.cachedResults[queryKey] = resultsMarkup.innerHTML;
        noResultsText.innerHTML = "";
      }

      this.renderSearchResults(resultsMarkup.innerHTML);
    } catch (error) {
      this.close();
      throw error;
    }
  }

  setLiveRegionLoadingState() {
    // Don't set loading state during form submission
    if (this.isSubmitting) return;

    this.statusElement = this.statusElement || this.host.querySelector(".predictive-search-status");
    this.loadingText = this.loadingText || this.host.getAttribute("data-loading-text");

    this.setLiveRegionText(this.loadingText);
    this.host.setAttribute("loading", true);
    if (this.resultsList) this.resultsList.classList.add('[&_>_*]:opacity-50');
  }

  setLiveRegionText(statusText) {
    this.statusElement.setAttribute("aria-hidden", "false");
    this.statusElement.textContent = statusText;

    setTimeout(() => {
      this.statusElement.setAttribute("aria-hidden", "true");
    }, 1000);
  }

  renderSearchResults(resultsMarkup) {
    // Don't render search results during form submission
    if (this.isSubmitting) return;
    
    // Reset the showing suggestions flag since we're showing results now
    this.isShowingSuggestions = false;

    console.log('🔍 [Electric Search] Rendering search results...', {
      noResults: this.noResults,
      hasResultsMarkup: !!resultsMarkup,
      resultsLength: resultsMarkup?.length
    });

    if (this.noResults) {
      this.host.querySelector(".js-error-message").style.display = "block";
      // Only clear if we have content to clear
      if (this.outputWrapper.children.length > 0) {
        this.outputWrapper.innerHTML = "";
      }
    } else {
      this.host.querySelector(".js-error-message").style.display = "";
      // Only update if content is different
      if (this.outputWrapper.innerHTML !== resultsMarkup) {
        console.log('🔍 [Electric Search] Updating outputWrapper with search results');
        this.outputWrapper.innerHTML = resultsMarkup;
      } else {
        console.log('🔍 [Electric Search] Results already match, skipping update');
      }
      this.host.setAttribute("results", true);
      this.setLiveRegionResults();
      console.log('🔍 [Electric Search] Results rendered successfully');
    }
  }

  setLiveRegionResults() {
    this.host.removeAttribute("loading");
    this.setLiveRegionText(
      this.host.querySelector("[data-predictive-search-live-region-count-value]")
        .textContent
    );
    if (this.resultsList) this.resultsList.classList.remove('[&_>_*]:opacity-50');
  }

}

class PredictiveSearch extends HTMLElement {
  constructor() {
    super();

    // Initialize features
    this.features = {
      productTypeFilter: new ProductTypeFilter(this),
      keyboard: new KeyboardManager(this),
      search: new PredictiveSearchCore(this)
    };
  }

connectedCallback() {
    // Initialize all features that should work regardless of disabled state
    this.features.keyboard.init();
    this.features.productTypeFilter.init(); // Initialize product type filter

    // Initialize predictive search only if not disabled
    if (!this.dataset?.disabled) {
      this.features.search.init();
    }

    // Set up form submission handling
    const form = this.querySelector('form[role="search"]');
    form.addEventListener("submit", this.handleFormSubmit.bind(this));
  }

  disconnectedCallback() {
    // Cleanup all features
    Object.values(this.features).forEach(feature => feature.destroy?.());
  }

  handleFormSubmit(event) {
    // Some search apps (e.g. snize/Searchanise) may rewrite form actions to custom pages.
    // Ensure drawer search submits to Shopify's native search endpoint.
    try {
      const form = event?.currentTarget;
      if (form?.dataset?.forceNativeSearch === 'true') {
        const nativeSearchUrl = window?.routes?.search_url || '/search';
        form.setAttribute('action', nativeSearchUrl);
      }
    } catch (error) {
      // Non-blocking: if something goes wrong, allow normal submit flow.
      console.warn('[Electric Search] Failed to enforce native search action', error);
    }

    if (this.dataset?.disabled) {
      event.preventDefault();
      this.removeAttribute("data-disabled");
      setTimeout(() => {
        this.closest('form').submit();
      }, 1000);
      return;
    }

    // If there's a selected option, let it handle the click instead
    const selectedOption = this.querySelector('[aria-selected="true"] a');
    if (selectedOption) {
      event.preventDefault();
      selectedOption.click();
      return;
    }

    // If there's no search query, prevent submission
    if (!this.features.search.getQuery().length) {
      event.preventDefault();
      return;
    }

    // For Enter key navigation to search page, save the search term and navigate smoothly
    const searchQuery = this.features.search.getQuery();
    if (searchQuery.length) {
      // Set submitting flag to prevent focus events from firing
      this.features.search.isSubmitting = true;

      // Apply filter after setting the flag to prevent focus issues
      this.features.productTypeFilter.applyFilter();

      // Save to recent searches before navigating
      this.#saveRecentSearch(searchQuery);
      // Allow form to submit naturally - don't close search UI
      // The navigation will happen and the search UI will remain open until page unloads
    }
  }

  /**
   * Save search query to recent searches
   * @param {string} query - Search query to save
   * @private
   */
  #saveRecentSearch(query) {
    if (!query || typeof query !== 'string') return;
    
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    try {
      let recentSearches = JSON.parse(localStorage.getItem('recent_searches') || '[]');
      
      // Remove if already exists to avoid duplicates
      recentSearches = recentSearches.filter(search => search !== cleanQuery);
      
      // Add to beginning
      recentSearches.unshift(cleanQuery);
      
      // Keep only last 5 searches
      recentSearches = recentSearches.slice(0, 5);
      
      localStorage.setItem('recent_searches', JSON.stringify(recentSearches));
    } catch (error) {
      console.warn('Failed to save recent search:', error);
    }
  }
}

customElements.define("electric-search", PredictiveSearch);

// Global native search enforcement (covers search forms outside <electric-search>)
// Some third-party search apps may replace the search form node entirely and/or rewrite form actions.
// We enforce Shopify's native search endpoint at submit time for any form explicitly marked with
// `data-force-native-search="true"`.
(() => {
  try {
    // Theme setting: allow merchants to fall back to a search app redirect page.
    // When disabled, we must not force `/search`.
    if (window?.theme_settings?.force_native_search === false) return;

    if (window.__electricForceNativeSearchInstalled) return;
    window.__electricForceNativeSearchInstalled = true;

    const nativeSearchUrl = window?.routes?.search_url || '/search';
    const nativeSearchAbsUrl = (() => {
      try {
        return new URL(nativeSearchUrl, window.location.origin).toString();
      } catch (e) {
        return (window.location.origin || '') + '/search';
      }
    })();

    document.addEventListener('submit', (event) => {
      try {
        const form = event?.target;
        if (!(form instanceof HTMLFormElement)) return;
        if (form?.dataset?.forceNativeSearch !== 'true') return;

        // Always enforce action to native search.
        form.setAttribute('action', nativeSearchAbsUrl);

        // Hard-guard: if something intercepts submit and navigates elsewhere, force navigation ourselves.
        const currentAction = String(form.getAttribute('action') || form.action || '');
        if (currentAction && !currentAction.startsWith(nativeSearchAbsUrl)) {
          event.preventDefault();
          event.stopImmediatePropagation?.();

          const params = new URLSearchParams();
          const data = new FormData(form);
          for (const [key, value] of data.entries()) {
            if (typeof value === 'string') params.append(key, value);
          }
          window.location.assign(`${nativeSearchAbsUrl}?${params.toString()}`);
        }
      } catch (e) {
        // ignore
      }
    }, true);

    // Some apps redirect on Enter keydown without submitting the form.
    // Capture Enter and route to native /search when the form is explicitly marked.
    document.addEventListener('keydown', (event) => {
      try {
        if (!event || event.defaultPrevented) return;
        if (event.key !== 'Enter') return;

        const target = event.target;
        if (!target || !target.closest) return;

        const form = target.form || target.closest('form');
        if (!(form instanceof HTMLFormElement)) return;
        if (form?.dataset?.forceNativeSearch !== 'true') return;

        // If inside predictive <electric-search> and a suggestion is selected, let it handle Enter.
        const electricHost = target.closest('electric-search');
        if (electricHost) {
          const selected = electricHost.querySelector('[aria-selected="true"] a, [aria-selected="true"] button');
          if (selected) return;
        }

        event.preventDefault();
        event.stopImmediatePropagation?.();

        form.setAttribute('action', nativeSearchAbsUrl);

        const params = new URLSearchParams();
        const data = new FormData(form);
        for (const [key, value] of data.entries()) {
          if (typeof value === 'string') params.append(key, value);
        }
        window.location.assign(`${nativeSearchAbsUrl}?${params.toString()}`);
      } catch (e) {
        // ignore
      }
    }, true);
  } catch (e) {
    // ignore
  }
})();
