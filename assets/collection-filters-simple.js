/**
 * Simple, elegant form-based filter system
 * Leverages native HTML forms and browser APIs
 */

class CollectionFilters extends HTMLElement {
  /** @type {Function | null} Bound scroll handler function */
  #boundScrollHandler = null;

  constructor() {
    super();
    this.debouncedSubmit = this.debounce(this.onSubmitHandler.bind(this), 500);
    this.isUpdating = false;
  }

  connectedCallback() {
    // Delay to ensure drawer content is available
    setTimeout(() => {
      this.setupForms();
      this.bindEvents();
      this.initMoreFiltersToggle();
    }, 100);
  }

  setupForms() {
    // Find all forms, including those in drawers
    this.forms = this.querySelectorAll('form');
  }

  bindEvents() {
    // Listen to all forms (desktop and mobile)
    this.forms.forEach((form, index) => {
      const formType = form.classList.contains('filter-form-mobile') ? 'mobile' : 'desktop';
      
      form.addEventListener('input', (e) => {
        // Sync the other form before submitting
        this.syncFormsFromSource(form);
        this.debouncedSubmit(e);
      });
      form.addEventListener('change', (e) => {
        // Sync the other form before submitting
        this.syncFormsFromSource(form);
        this.debouncedSubmit(e);
      });
    });

    // Add specific event listener for sort radio buttons to close dropdown
    this.addEventListener('change', (e) => {
      if (e.target.name === 'sort_by' && e.target.type === 'radio') {
        this.closeSortDropdown(e.target);
      }
    });
    
    // Listen for popstate (browser back/forward)
    window.addEventListener('popstate', (e) => {
      this.onPopState(e);
    });
    
    // Add scroll event listener to close dropdowns when body is scrolled
    this.#setupScrollCloseHandler();
    
    // Listen for clear all clicks
    this.addEventListener('click', (e) => {
      if (e.target.closest('.clear-all-filters')) {
        e.preventDefault();
        this.handleClearAll();
      }
    });
  }

  syncFormsFromSource(sourceForm) {
    const allForms = this.querySelectorAll('form');
    
    allForms.forEach(form => {
      if (form === sourceForm) return; // Skip the source form
      
      // Sync checkboxes and radios
      sourceForm.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(sourceInput => {
        const targetInput = form.querySelector(`input[name="${sourceInput.name}"][value="${sourceInput.value}"]`);
        if (targetInput) {
          targetInput.checked = sourceInput.checked;
        }
      });
      
      // Sync price range inputs
      sourceForm.querySelectorAll('input[type="number"]').forEach(sourceInput => {
        const targetInput = form.querySelector(`input[name="${sourceInput.name}"]`);
        if (targetInput) {
          targetInput.value = sourceInput.value;
        }
      });
      
      // Sync sort_by radio buttons
      const sourceSort = sourceForm.querySelector('input[name="sort_by"]:checked');
      if (sourceSort) {
        const targetSort = form.querySelector(`input[name="sort_by"][value="${sourceSort.value}"]`);
        if (targetSort) {
          targetSort.checked = true;
        }
      }
    });
  }

  onSubmitHandler(event) {
    if (event) event.preventDefault();
    if (this.isUpdating) {
      return;
    }
    
    // Collect data from all forms
    const searchParams = this.buildSearchParams();
    this.renderPage(searchParams, true, 'form-submit');
  }

  buildSearchParams() {
    const params = new URLSearchParams();
    
    // Collect from a single canonical form.
    // Prefer the drawer (mobile) form because it contains the full filter set
    // even when desktop UI only exposes "Quick Filter".
    const desktopForm = this.querySelector('.filter-form-desktop');
    const mobileForm = this.querySelector('.filter-form-mobile');
    const activeForm = mobileForm || desktopForm;
    
    if (activeForm) {
      const formData = new FormData(activeForm);
      
      for (const [key, value] of formData.entries()) {
        if (!value || value.trim() === '') continue;
        
        // Handle price filters - skip if at min/max
        if (key === 'filter.v.price.gte') {
          const rangeInput = activeForm.querySelector('input[type="range"]:first-child');
          const minLimit = parseInt(rangeInput?.min) || 0;
          if (parseInt(value) <= minLimit) continue;
        }
        if (key === 'filter.v.price.lte') {
          const rangeInput = activeForm.querySelector('input[type="range"]:last-child');
          const maxLimit = parseInt(rangeInput?.max) || 1000;
          if (parseInt(value) >= maxLimit) continue;
        }
        
        // Add to params
        if (key === 'sort_by') {
          params.set(key, value);
        } else if (key.startsWith('filter.')) {
          // For filter params, append to allow multiple values
          params.append(key, value);
        }
      }
    }
    
    // Preserve non-filter params from current URL
    const currentParams = new URLSearchParams(window.location.search);
    for (const [key, value] of currentParams.entries()) {
      if (!key.startsWith('filter.') && key !== 'sort_by' && key !== 'page') {
        params.set(key, value);
      }
    }
    
    return params.toString();
  }

  async renderPage(searchParams, pushState = true, source = 'unknown') {
    const timestamp = new Date().toISOString().split('T')[1];
    
    // Prevent concurrent updates
    if (this.isUpdating) {
      return;
    }
    
    this.isUpdating = true;
    
    // Store current state before update
    const openDropdowns = this.getOpenDropdowns();
    const moreFiltersExpanded = this.getMoreFiltersState();
    const openMobileAccordions = this.getOpenMobileAccordions();
    
    // Show loading state
    this.setLoadingState(true);
    
    if (pushState) {
      this.updateURL(searchParams);
    }
    
    try {
      // Only fetch filters, let infinite scroll handle products
      const filtersResponse = await fetch(`${window.location.pathname}?section_id=api--filters&${searchParams}`);
      const filtersHtml = await filtersResponse.text();
      
      // Update filters
      this.updateFilters(filtersHtml, openDropdowns, moreFiltersExpanded, openMobileAccordions);
      
      // Trigger infinite scroll to reload products
      const infiniteScroll = document.querySelector('infinite-scroll-collection');
      if (infiniteScroll && typeof infiniteScroll.reloadProducts === 'function') {
        infiniteScroll.reloadProducts('filter-change');
      } else {
        // Search (and other non-infinite-scroll contexts): update the results grid via section rendering.
        await this.updateSearchResults(searchParams);
      }
      
      // Trigger event for other components
      this.dispatchFilterChangeEvent(searchParams);
      
    } catch (error) {
      console.error('Error updating filters:', error);
    } finally {
      this.setLoadingState(false);
      // Delay resetting the flag to prevent immediate re-triggers
      setTimeout(() => {
        this.isUpdating = false;
      }, 100);
    }
  }

  updateFilters(html, openDropdowns, moreFiltersExpanded, openMobileAccordions = []) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Update mobile filter count
    this.updateMobileFilterCount();
    
    // Update both desktop and mobile forms entirely
    const desktopForm = this.querySelector('.filter-form-desktop');
    const mobileForm = this.querySelector('.filter-form-mobile');
    
    const newDesktopForm = doc.querySelector('.filter-form-desktop');
    const newMobileForm = doc.querySelector('.filter-form-mobile');
    
    // Update desktop form
    if (desktopForm && newDesktopForm) {
      // Get the manager inside
      const manager = desktopForm.querySelector('electric-filter-manager');
      const newManager = newDesktopForm.querySelector('electric-filter-manager');
      
      if (manager && newManager) {
        // Get the filter container that includes the toggle
        const filterContainer = manager.querySelector('.filter-container');
        const newFilterContainer = newManager.querySelector('.filter-container');
        if (filterContainer && newFilterContainer) {
          // Replace the entire filter container to include the toggle
          filterContainer.innerHTML = newFilterContainer.innerHTML;
          // Restore open dropdowns
          openDropdowns.forEach(summaryText => {
            const summary = [...filterContainer.querySelectorAll('summary')].find(s => 
              s.textContent.trim() === summaryText
            );
            if (summary) {
              summary.closest('details').open = true;
            }
          });
          // Re-initialize all components in the container
          this.initializeComponents(filterContainer);
          
          // Restore More Filters state
          const toggle = filterContainer.querySelector('electric-filter-toggle');
          if (toggle && moreFiltersExpanded[0]) {
            setTimeout(() => {
              toggle.isExpanded = true;
              toggle.updateVisibility();
            }, 0);
          }
        } else {
          // Fallback to replacing entire manager
          manager.innerHTML = newManager.innerHTML;
          
          // Restore open dropdowns
          openDropdowns.forEach(summaryText => {
            const summary = [...manager.querySelectorAll('summary')].find(s => 
              s.textContent.trim() === summaryText
            );
            if (summary) {
              summary.closest('details').open = true;
            }
          });
          
          // Re-initialize components
          this.initializeComponents(manager);
          
          // Restore More Filters state
          const toggle = manager.querySelector('electric-filter-toggle');
          if (toggle && moreFiltersExpanded[0]) {
            setTimeout(() => {
              toggle.isExpanded = true;
              toggle.updateVisibility();
            }, 0);
          }
        }
      }
    }
    
    // Update mobile form
    if (mobileForm && newMobileForm) {
      const manager = mobileForm.querySelector('electric-filter-manager');
      const newManager = newMobileForm.querySelector('electric-filter-manager');
      
      if (manager && newManager) {
        manager.innerHTML = newManager.innerHTML;
        
        // Restore mobile accordion states
        openMobileAccordions.forEach(accordionText => {
          const summaries = [...manager.querySelectorAll('summary')];
          const summary = summaries.find(s => s.textContent.trim() === accordionText);
          if (summary) {
            const details = summary.closest('details');
            if (details) {
              details.open = true;
            }
          }
        });
        
        // Re-initialize components
        this.initializeComponents(manager);
        
        // Restore More Filters state for mobile
        const toggle = manager.querySelector('electric-filter-toggle');
        if (toggle && moreFiltersExpanded[1]) {
          toggle.isExpanded = true;
          toggle.updateVisibility();
        }
      }
    }
    // Don't rebind events - they're already bound from initial setup
    // The forms themselves aren't replaced, just their inner content
    // This prevents duplicate event firing when filters are removed
    
    // Update filter removers
    this.updateFilterRemovers(doc);
    
    // Update facet count
    this.updateFacetCount(doc);
  }

  /**
   * Update search results grid when infinite scroll is not present.
   * Falls back to a full page navigation if section rendering fails.
   * @param {string} searchParams
   */
  async updateSearchResults(searchParams) {
    const resultsContainer = document.querySelector('[data-search-results-container]');
    if (!resultsContainer) return;

    const url = `${window.location.pathname}?section_id=api--search-results&${searchParams}`;

    try {
      const response = await fetch(url, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch search results section: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const newContainer = doc.querySelector('[data-search-results-container]');
      if (!newContainer) {
        throw new Error('Missing [data-search-results-container] in section response');
      }

      resultsContainer.innerHTML = newContainer.innerHTML;
    } catch (error) {
      console.error('Error updating search results:', error);

      // Ensure UI is consistent even if section rendering fails.
      const fallbackUrl = `${window.location.pathname}${searchParams ? `?${searchParams}` : ''}`;
      window.location.assign(fallbackUrl);
    }
  }

  updateFilterRemovers(doc) {
    // Update desktop removers
    const desktopRemovers = this.querySelector('.desktop-filter-removers');
    const newDesktopRemovers = doc.querySelector('.desktop-filter-removers');
    if (desktopRemovers && newDesktopRemovers) {
      desktopRemovers.innerHTML = newDesktopRemovers.innerHTML;
      // Update visibility
      const hasActiveFilters = desktopRemovers.querySelectorAll('facet-remove').length > 0;
      desktopRemovers.classList.toggle('hidden', !hasActiveFilters);
      desktopRemovers.classList.toggle('flex', hasActiveFilters);
    }
    
    // Update mobile removers  
    const mobileRemovers = this.querySelector('.mobile-filter-removers');
    const newMobileRemovers = doc.querySelector('.mobile-filter-removers');
    if (mobileRemovers && newMobileRemovers) {
      mobileRemovers.innerHTML = newMobileRemovers.innerHTML;
      const hasActiveFilters = mobileRemovers.querySelectorAll('facet-remove').length > 0;
      mobileRemovers.classList.toggle('hidden', !hasActiveFilters);
      mobileRemovers.classList.toggle('flex', hasActiveFilters);
    }
  }

  updateFacetCount(doc) {
    const counts = this.querySelectorAll('electric-filter-count');
    const newCounts = doc.querySelectorAll('electric-filter-count');
    counts.forEach((count, index) => {
      if (newCounts[index]) {
        count.innerHTML = newCounts[index].innerHTML;
      }
    });
  }

  updateMobileFilterCount() {
    // Calculate active filter count from current form state
    const form = this.querySelector('.filter-form-desktop') || this.querySelector('.filter-form-mobile');
    if (!form) return;
    
    let activeCount = 0;
    
    // Count checked checkboxes (excluding availability toggle if needed)
    const checkboxes = form.querySelectorAll('input[type="checkbox"]:checked');
    activeCount += checkboxes.length;
    
    // Check if price range is active
    const priceMinInput = form.querySelector('input[name="filter.v.price.gte"]');
    const priceMaxInput = form.querySelector('input[name="filter.v.price.lte"]');
    if (priceMinInput && priceMaxInput) {
      const rangeMin = form.querySelector('input[type="range"]:first-child');
      const rangeMax = form.querySelector('input[type="range"]:last-child');
      const minLimit = parseInt(rangeMin?.min) || 0;
      const maxLimit = parseInt(rangeMax?.max) || 1000;
      
      const minValue = parseInt(priceMinInput.value) || minLimit;
      const maxValue = parseInt(priceMaxInput.value) || maxLimit;
      
      if (minValue > minLimit || maxValue < maxLimit) {
        activeCount++;
      }
    }
    
    // Update the mobile filter count display
    const mobileCountElement = document.querySelector('.mobile-filter-count');
    if (mobileCountElement) {
      mobileCountElement.textContent = activeCount > 0 ? `(${activeCount})` : '';
    }
  }

  handleClearAll() {
    // Reset all forms
    const currentForms = this.querySelectorAll('form');
    currentForms.forEach(form => {
      // Uncheck all checkboxes and radios
      form.querySelectorAll('input[type="checkbox"]:checked, input[type="radio"]:checked').forEach(input => {
        input.checked = false;
      });
      
      // Reset price ranges
      const priceRanges = form.querySelectorAll('price-range');
      priceRanges.forEach(range => {
        if (range.reset) range.reset();
      });
    });
    
    // Update mobile filter count immediately
    this.updateMobileFilterCount();
    
    // Render page with empty search params to reload everything
    this.renderPage('', true, 'clear-all');
  }

  onPopState(event) {
    const searchParams = event.state?.searchParams || window.location.search.substring(1);
    
    // Update form inputs based on URL
    this.updateFormsFromURL(searchParams);
    
    // Render page without pushing state
    this.renderPage(searchParams, false, 'popstate');
  }

  updateFormsFromURL(searchParams) {
    const params = new URLSearchParams(searchParams);
    
    const currentForms = this.querySelectorAll('form');
    currentForms.forEach(form => {
      // Reset all inputs first
      form.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(input => {
        input.checked = false;
      });
      
      // Set inputs based on URL params
      for (const [key, value] of params.entries()) {
        const inputs = form.querySelectorAll(`input[name="${key}"]`);
        inputs.forEach(input => {
          if (input.type === 'checkbox' || input.type === 'radio') {
            input.checked = input.value === value;
          } else {
            input.value = value;
          }
        });
      }
      
      // Update price ranges
      const priceRanges = form.querySelectorAll('price-range');
      priceRanges.forEach(range => {
        if (range.setFromURLParams) {
          range.setFromURLParams(params);
        }
      });
    });
    
    // Update mobile filter count after forms are updated
    this.updateMobileFilterCount();
  }

  updateURL(searchParams) {
    const newURL = `${window.location.pathname}${searchParams ? `?${searchParams}` : ''}`;
    if (newURL !== window.location.href) {
      history.pushState({ searchParams }, '', newURL);
    }
  }

  setLoadingState(loading) {
    // Add loading state to opened dropdowns
    this.querySelectorAll('details[open] label').forEach(details => {
      if (loading) {
        details.classList.add('cursor-not-allowed', 'pointer-events-none');
      } else {
        details.classList.remove('cursor-not-allowed', 'pointer-events-none');
      }
    });
    
    // Trigger loading banner if available
    const loadingBanner = document.querySelectorAll('loading-banner[data-target="collection-filters"]');
    for (const banner of loadingBanner) {
      if (loading && typeof banner.startLoading === 'function') {
        banner.startLoading();
      } else if (!loading && typeof banner.completeLoading === 'function') {
        banner.completeLoading();
      }
    }
  }

  getOpenDropdowns() {
    return [...this.querySelectorAll('details[open] summary')].map(s => s.textContent.trim());
  }

  getMoreFiltersState() {
    const toggles = this.querySelectorAll('electric-filter-toggle');
    const states = {};
    toggles.forEach((toggle, index) => {
      states[index] = toggle ? toggle.isExpanded : false;
    });
    return states;
  }

  getOpenMobileAccordions() {
    // Find open accordion details in mobile drawer
    const mobileForm = this.querySelector('.filter-form-mobile');
    if (!mobileForm) return [];
    
    // Get all open accordion details (these use m--accordion component)
    return [...mobileForm.querySelectorAll('details[open]')].map(details => {
      const summary = details.querySelector('summary');
      return summary ? summary.textContent.trim() : null;
    }).filter(Boolean);
  }

  initMoreFiltersToggle() {
    const toggles = this.querySelectorAll('electric-filter-toggle');
    toggles.forEach(toggle => {
      if (!toggle.initialized && toggle.connectedCallback) {
        toggle.connectedCallback();
      }
    });
  }

  initializeComponents(container) {
    // Upgrade custom elements first
    if (window.customElements) {
      customElements.upgrade(container);
    }
    
    // Re-initialize price ranges
    const priceRanges = container.querySelectorAll('price-range');
    priceRanges.forEach(range => {
      // Call connectedCallback to re-initialize
      if (range.connectedCallback) {
        range.connectedCallback();
      }
    });
    
    // Re-initialize filter toggle
    const toggle = container.querySelector('electric-filter-toggle');
    if (toggle) {
      // Reset the toggle component state
      toggle.reset();
      // Trigger connectedCallback to re-setup everything
      if (toggle.connectedCallback) {
        toggle.connectedCallback();
      }
    }
  }

  dispatchFilterChangeEvent(searchParams) {
    window.dispatchEvent(new CustomEvent('filters:changed', {
      detail: { searchParams },
      bubbles: true
    }));
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  disconnectedCallback() {
    // Clean up scroll event listener
    if (this.#boundScrollHandler) {
      document.removeEventListener('scroll', this.#boundScrollHandler, { passive: true });
      this.#boundScrollHandler = null;
    }
  }

  /**
   * Set up scroll event listener to close dropdowns when body is scrolled
   * @private
   */
  #setupScrollCloseHandler() {
    // Bind the handler to maintain proper context
    this.#boundScrollHandler = this.#handleScrollClose.bind(this);
    
    // Add scroll event listener with passive option for better performance
    document.addEventListener('scroll', this.#boundScrollHandler, { passive: true });
  }

  /**
   * Handle scroll events to close open dropdown-disclosure elements
   * @private
   * @param {Event} event - Scroll event
   */
  #handleScrollClose(event) {
    try {
      // Only close dropdowns if the scroll target is the document body or html element
      const scrollTarget = event.target;
      if (scrollTarget !== document.body && scrollTarget !== document.documentElement && scrollTarget !== document) {
        return;
      }

      // Find all open dropdown-disclosure elements - try multiple selectors
      const selectors = [
        'dropdown-disclosure details[open]',
        'electric-filter dropdown-disclosure details[open]',
        'collection-filters dropdown-disclosure details[open]'
      ];
      
      let openDropdowns = [];
      for (const selector of selectors) {
        const found = document.querySelectorAll(selector);
        if (found.length > 0) {
          openDropdowns = found;
          break;
        }
      }
      
      if (openDropdowns.length > 0) {
        // Close each open dropdown
        openDropdowns.forEach(details => {
          details.open = false;
          
          // Dispatch a custom event to notify the dropdown-disclosure component
          const disclosure = details.closest('dropdown-disclosure');
          if (disclosure) {
            disclosure.dispatchEvent(new CustomEvent('dropdown:closed-by-scroll', {
              bubbles: true,
              detail: { reason: 'scroll' }
            }));
          }
        });
      }
        } catch (error) {
      console.error('[CollectionFilters] Error handling scroll close', error);
    }
  }

  /**
   * Close the sort dropdown when a sort option is selected and update display
   * @param {HTMLInputElement} sortRadio - The radio button that was clicked
   */
  closeSortDropdown(sortRadio) {
    try {
      // Find the closest details element (the dropdown)
      const details = sortRadio.closest('details');
      if (details && details.open) {
        details.open = false;
        
        // Dispatch a custom event to notify the dropdown-disclosure component
        const disclosure = details.closest('dropdown-disclosure');
        if (disclosure) {
          disclosure.dispatchEvent(new CustomEvent('dropdown:closed-by-selection', {
            bubbles: true,
            detail: { reason: 'sort-selection' }
          }));
        }
      }

      // Update the selected sort option display
      this.updateSelectedSortDisplay(sortRadio);
    } catch (error) {
      console.error('[CollectionFilters] Error closing sort dropdown', error);
    }
  }

  /**
   * Update the selected sort option display text
   * @param {HTMLInputElement} sortRadio - The radio button that was clicked
   */
  updateSelectedSortDisplay(sortRadio) {
    try {
      // Find the label containing the radio button to get the option text
      const label = sortRadio.closest('label');
      if (!label) return;

      const optionText = label.textContent.trim();

      // Find the span with the selected-sort-option class in the same electric-filter-sort component
      const electricFilterSort = sortRadio.closest('electric-filter-sort');
      if (electricFilterSort) {
        const sortDisplaySpan = electricFilterSort.querySelector('.selected-sort-option');
        if (sortDisplaySpan) {
          sortDisplaySpan.textContent = optionText;
        }
      }

      // Also update the other electric-filter-sort component (mobile/desktop counterpart)
      const allElectricFilterSorts = document.querySelectorAll('electric-filter-sort');
      allElectricFilterSorts.forEach(sortComponent => {
        if (sortComponent !== electricFilterSort) {
          const otherSortDisplaySpan = sortComponent.querySelector('.selected-sort-option');
          if (otherSortDisplaySpan) {
            otherSortDisplaySpan.textContent = optionText;
          }
        }
      });
    } catch (error) {
      console.error('[CollectionFilters] Error updating sort display', error);
    }
  }
}

// Define custom element
customElements.define('collection-filters', CollectionFilters);

/**
 * Facet Remove - Handles individual filter removal
 */
class FacetRemove extends HTMLElement {
  connectedCallback() {
    const link = this.querySelector('a');
    if (!link) return;
    
    link.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Get the URL from the link
      const url = new URL(link.href, window.location.origin);
      const searchParams = url.search.substring(1);
      
      // Find parent collection-filters and trigger update
      const collectionFilters = this.closest('collection-filters');
      if (collectionFilters) {
        collectionFilters.renderPage(searchParams, true, 'facet-remove');
      }
    });
  }
}

customElements.define('facet-remove', FacetRemove);
// Native Price Range Slider with dual overlapped ranges
class PriceRange extends HTMLElement {
  #abortController;
  
  connectedCallback() {
    this.#abortController = new AbortController();
    const signal = { signal: this.#abortController.signal };
    
    // Cache DOM references
    const rangeLowerBound = this.querySelector('input[type="range"].from');
    const rangeHigherBound = this.querySelector('input[type="range"].to');
    const textInputLowerBound = this.querySelector('input[name="filter.v.price.gte"]');
    const textInputHigherBound = this.querySelector('input[name="filter.v.price.lte"]');
    
    // Ensure elements exist before adding listeners
    if (!rangeLowerBound || !rangeHigherBound || !textInputLowerBound || !textInputHigherBound) {
      console.warn('PriceRange: Missing required elements');
      return;
    }
    
    // Text input handlers - select all on focus
    textInputLowerBound.addEventListener("focus", () => textInputLowerBound.select(), signal);
    textInputHigherBound.addEventListener("focus", () => textInputHigherBound.select(), signal);
    
    // Text input change handlers with validation
    textInputLowerBound.addEventListener("change", (event) => {
      event.preventDefault();
      const max = parseInt(textInputHigherBound.value || event.target.max);
      event.target.value = Math.max(Math.min(parseInt(event.target.value), max - 1), event.target.min || 0);
      rangeLowerBound.value = event.target.value;
      this.#updateRangeVisual(rangeLowerBound, rangeHigherBound);
    }, signal);
    
    textInputHigherBound.addEventListener("change", (event) => {
      event.preventDefault();
      const min = parseInt(textInputLowerBound.value || event.target.min);
      event.target.value = Math.min(Math.max(parseInt(event.target.value), min + 1), event.target.max);
      rangeHigherBound.value = event.target.value;
      this.#updateRangeVisual(rangeLowerBound, rangeHigherBound);
    }, signal);
    
    // Range slider change handlers - update number input and let it handle the event
    rangeLowerBound.addEventListener("change", (event) => {
      event.stopPropagation();
      const max = parseInt(textInputHigherBound.value || event.target.max);
      const newValue = Math.min(parseInt(event.target.value), max - 1);
      textInputLowerBound.value = newValue;
      textInputLowerBound.dispatchEvent(new Event("input", { bubbles: true }));
    }, signal);
    
    rangeHigherBound.addEventListener("change", (event) => {
      event.stopPropagation();
      const min = parseInt(textInputLowerBound.value || event.target.min);
      const newValue = Math.max(parseInt(event.target.value), min + 1);
      textInputHigherBound.value = newValue;
      textInputHigherBound.dispatchEvent(new Event("input", { bubbles: true }));
    }, signal);
    
    // Range slider input handlers - update visual styling and text input values in real-time
    rangeLowerBound.addEventListener("input", (event) => {
      event.target.value = Math.min(parseInt(event.target.value), parseInt(textInputHigherBound.value || event.target.max) - 1);
      event.target.parentElement.style.setProperty("--range-min", `${parseInt(event.target.value) / parseInt(event.target.max) * 100}%`);
      textInputLowerBound.value = event.target.value;
    }, signal);
    
    rangeHigherBound.addEventListener("input", (event) => {
      event.target.value = Math.max(parseInt(event.target.value), parseInt(textInputLowerBound.value || event.target.min) + 1);
      event.target.parentElement.style.setProperty("--range-max", `${parseInt(event.target.value) / parseInt(event.target.max) * 100}%`);
      textInputHigherBound.value = event.target.value;
    }, signal);
    
    // Initialize visual state
    this.#updateRangeVisual(rangeLowerBound, rangeHigherBound);
  }
  
  #updateRangeVisual(rangeLower, rangeHigher) {
    if (!rangeLower || !rangeHigher) return;
    
    const rangeMax = parseInt(rangeLower.max) || 100;
    const minValue = parseInt(rangeLower.value) || 0;
    const maxValue = parseInt(rangeHigher.value) || rangeMax;
    
    const minPercent = (minValue / rangeMax) * 100;
    const maxPercent = (maxValue / rangeMax) * 100;
    
    const container = rangeLower.parentElement;
    if (container) {
      container.style.setProperty("--range-min", `${minPercent}%`);
      container.style.setProperty("--range-max", `${maxPercent}%`);
    }
  }
  
  disconnectedCallback() {
    this.#abortController?.abort();
  }
  
  // Public reset method for filter clearing
  reset() {
    const textInputLowerBound = this.querySelector('input[name="filter.v.price.gte"]');
    const textInputHigherBound = this.querySelector('input[name="filter.v.price.lte"]');
    const rangeLowerBound = this.querySelector('input[type="range"]:first-child');
    const rangeHigherBound = this.querySelector('input[type="range"]:last-child');
    
    if (textInputLowerBound) textInputLowerBound.value = "";
    if (textInputHigherBound) textInputHigherBound.value = "";
    if (rangeLowerBound) rangeLowerBound.value = rangeLowerBound.min || "0";
    if (rangeHigherBound) rangeHigherBound.value = rangeHigherBound.max || "100";
    
    if (rangeLowerBound && rangeHigherBound) {
      this.#updateRangeVisual(rangeLowerBound, rangeHigherBound);
    }
  }
  
  // Method to set values from URL params (for consistency with old implementation)
  setFromURLParams(urlParams) {
    const minPrice = urlParams.get('filter.v.price.gte');
    const maxPrice = urlParams.get('filter.v.price.lte');
    
    const textInputLowerBound = this.querySelector('input[name="filter.v.price.gte"]');
    const textInputHigherBound = this.querySelector('input[name="filter.v.price.lte"]');
    const rangeLowerBound = this.querySelector('input[type="range"]:first-child');
    const rangeHigherBound = this.querySelector('input[type="range"]:last-child');
    
    if (minPrice && textInputLowerBound && rangeLowerBound) {
      textInputLowerBound.value = minPrice;
      rangeLowerBound.value = minPrice;
    }
    
    if (maxPrice && textInputHigherBound && rangeHigherBound) {
      textInputHigherBound.value = maxPrice;
      rangeHigherBound.value = maxPrice;
    }
    
    if (rangeLowerBound && rangeHigherBound) {
      this.#updateRangeVisual(rangeLowerBound, rangeHigherBound);
    }
  }
}
if (!window.customElements.get("price-range")) {
  window.customElements.define("price-range", PriceRange);
}

/**
 * Simple More/Less Filters Toggle
 */
class ElectricFilterToggle extends HTMLElement {
  /** @type {boolean} Whether the filters are expanded */
  #isExpanded = false;
  
  /** @type {boolean} Whether the component has been initialized */
  #initialized = false;
  
  /** @type {number} Threshold for showing more/less toggle */
  #threshold = 4;
  
  /** @type {string} Text for expanded state */
  #moreText = 'More filters';
  
  /** @type {string} Text for collapsed state */
  #lessText = 'Less filters';
  
  /** @type {Function | null} Click handler reference for cleanup */
  #clickHandler = null;

  constructor() {
    super();
  }

  connectedCallback() {
    if (this.#initialized) return;
    
    this.#threshold = parseInt(this.dataset.threshold) || 4;
    this.#moreText = this.dataset.moreText || 'More filters';
    this.#lessText = this.dataset.lessText || 'Less filters';
    
    // The toggle is clickable itself, not a button inside
    this.style.cursor = 'pointer';
    
    // Remove any existing click listener before adding new one
    if (this.#clickHandler) {
      this.removeEventListener('click', this.#clickHandler);
    }
    this.#clickHandler = this.#handleClick.bind(this);
    this.addEventListener('click', this.#clickHandler);
    
    // Set initial state
    this.#hideEmptyFilters();
    this.#updateVisibility();
    this.#initialized = true;
  }
  
  get filters() {
    // Find the flex container that holds filters
    const container = this.parentElement;
    if (!container) {
      return [];
    }
    
    // Find all electric-filter elements that are siblings
    const allFilters = [];
    for (let child of container.children) {
      if (child.tagName === 'ELECTRIC-FILTER') {
        allFilters.push(child);
      }
    }
    
    return allFilters;
  }

  /**
   * Get only the visible filters (filters that have visible label elements)
   * @returns {Array<HTMLElement>} Array of visible filter elements
   * @private
   */
  get #visibleFilters() {
    return this.filters.filter(filter => {
      // Check if filter is hidden via any mechanism
      const isHiddenByDisplay = filter.style.display === 'none';
      const isHiddenByClass = filter.classList.contains('hidden');
      const isHiddenByAria = filter.getAttribute('aria-hidden') === 'true';
      
      // If filter itself is hidden, it's not visible
      if (isHiddenByDisplay || isHiddenByClass || isHiddenByAria) {
        return false;
      }
      
      // Check if filter has any visible label elements
      const visibleLabels = filter.querySelectorAll('label:not(.hidden)');
      return visibleLabels.length > 0;
    });
  }

  /**
   * Handle click events for the toggle
   * @private
   */
  #handleClick() {
    this.#toggle();
  }

  /**
   * Toggle the expanded state of filters
   * @private
   */
  #toggle() {
    this.#isExpanded = !this.#isExpanded;
    this.#updateVisibility();
  }

  /**
   * Hide filters that have no visible label elements
   * @private
   */
  #hideEmptyFilters() {
    this.filters.forEach(filter => {
      const isListFilter = filter.querySelector('.filter-list-content');
      const visibleLabels = filter.querySelectorAll('.filter-list-content li:not(.hidden)');
      if (visibleLabels.length === 0 && isListFilter) {
        filter.style.display = 'none';
        filter.setAttribute('aria-hidden', 'true');
      } else {
        filter.style.display = '';
        filter.removeAttribute('aria-hidden');
      }
    });
  }

  /**
   * Update the visibility of filters based on expanded state
   * @private
   */
  #updateVisibility() {
    // First hide any filters that have no visible labels
    this.#hideEmptyFilters();
    
    const visibleFilters = this.#visibleFilters;
    
    // Hide button if visible filters count is <= threshold, show if > threshold
    if (visibleFilters.length <= this.#threshold) {
      this.style.display = 'none';
    } else {
      this.style.display = '';
    }
    
    // Show/hide visible filters beyond threshold
    visibleFilters.forEach((filter, index) => {
      if (index >= this.#threshold) {
        filter.style.display = this.#isExpanded ? '' : 'none';
        filter.setAttribute('aria-hidden', !this.#isExpanded);
      }
    });
    
    // Update toggle text - find the text node that's a direct child
    const textNodes = Array.from(this.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
    if (textNodes.length > 0) {
      textNodes[0].textContent = this.#isExpanded ? this.#lessText : this.#moreText;
    } else {
      // If no text node found, update the entire text content before the icon
      const icon = this.querySelector('svg');
      if (icon) {
        const newText = document.createTextNode(this.#isExpanded ? this.#lessText : this.#moreText);
        this.insertBefore(newText, icon);
      }
    }
    
    // Update icon rotation
    const icon = this.querySelector('svg');
    if (icon) {
      icon.style.transform = this.#isExpanded ? 'rotate(45deg)' : 'rotate(0deg)';
      icon.style.transition = 'transform 0.3s';
    }
  }

  /**
   * Public method to toggle filters (for external use)
   */
  toggle() {
    this.#toggle();
  }

  /**
   * Public method to update visibility (for external use)
   */
  updateVisibility() {
    this.#updateVisibility();
  }

  /**
   * Public setter for initialized state (for external use)
   */
  set initialized(value) {
    this.#initialized = value;
  }

  /**
   * Public getter for initialized state (for external use)
   */
  get initialized() {
    return this.#initialized;
  }

  /**
   * Public method to reset the component state
   */
  reset() {
    this.#initialized = false;
    this.#isExpanded = false;
    this.#updateVisibility();
  }

  /**
   * Clean up resources when component is disconnected
   */
  disconnectedCallback() {
    if (this.#clickHandler) {
      this.removeEventListener('click', this.#clickHandler);
      this.#clickHandler = null;
    }
    this.#initialized = false;
  }
}

customElements.define('electric-filter-toggle', ElectricFilterToggle);