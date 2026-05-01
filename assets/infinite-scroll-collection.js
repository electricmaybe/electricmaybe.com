class InfiniteScrollCollection extends HTMLElement {
  constructor() {
    super();
    this.currentPage = 1;
    this.isLoading = false;
    this.hasMoreProducts = true;
    this.collectionHandle = this.dataset.collectionHandle;
    
    // Resize handling for dynamic CSS variable updates
    this.onResizeBound = this.handleResize.bind(this);
    this.resizeRafId = null;
    
    // Check for ss=0 query parameter to disable saved state caching
    const url = new URL(window.location);
    const params = new URLSearchParams(url.search);
    this.disableSavedState = params.get('ss') === '0';
    
    // Support removess query parameter to clear saved sessionStorage caches
    // Examples:
    //  - ?removess or ?removess=1 -> clears cache for current collection
    //  - ?removess=all -> clears cache for all collections
    const removeSSParam = params.get('removess');
    const hasRemoveSS = params.has('removess');
    if (hasRemoveSS) {
      const clearAll = removeSSParam === 'all';
      this.clearAllSavedStates(clearAll);
    }
    
    this.productsGrid = this.querySelector('#products-grid');
    this.productsPerPage = this.productsGrid.dataset.productsPerPage || 24;
    this.loadingIndicator = this.querySelector('#loading-indicator');
    this.endOfProducts = this.querySelector('#end-of-products');
    this.smartCrossSellSlider = document.querySelector('#smart-cross-sell');
    this.errorIndicator = this.querySelector('#error-indicator');
    
    // Reference to sentinel element for re-observation after cache restoration
    this.sentinel = null;
    
    // Generate unique key for this collection + filter state
    this.stateKey = this.generateStateKey();
    
    this.init();
  }
  
  /**
   * Lifecycle: element added to DOM
   * Calculate product card image height and set CSS variable; attach resize listener
   */
  connectedCallback() {
    try {
      this.calculateAndSetProductCardHeight();
      this.setupShowMoreEventDelegation();
    } catch (error) {
      console.error('InfiniteScrollCollection: error on connectedCallback height calc', error);
    }
    // Resize listener to keep variable in sync
    window.addEventListener('resize', this.onResizeBound);
  }
  
  /**
   * Set up event delegation for show-more elements
   * Uses event delegation to handle dynamically added show-more elements
   */
  setupShowMoreEventDelegation() {
    // Use event delegation on the products grid to catch all show-more events
    this.productsGrid.addEventListener('show-more:load-requested', async (event) => {
      // Resume infinite scroll and load more products
      this.hasMoreProducts = true;
      
      // Hide the show-more button that was clicked
      const showMore = event.detail.showMoreElement;
      if (showMore) {
        showMore.style.display = 'none';
      }
      
      try {
        await this.loadMoreProducts();
        
        // Remove the show-more element after successful load
        if (showMore && showMore.parentNode) {
          showMore.remove();
        }
        
        // Re-enable sentinel observation now that show-more is gone
        this.#ensureSentinel();
      } catch (error) {
        // Handle error and reset show-more element state
        if (showMore) {
          showMore.style.display = '';
          if (typeof showMore.resetLoadingState === 'function') {
            showMore.resetLoadingState();
          }
          if (typeof showMore.showElement === 'function') {
            showMore.showElement();
          }
        }
        console.error('Failed to load more products from show-more:', error);
      }
    });
  }
  
  generateStateKey() {
    const url = new URL(window.location);
    const params = new URLSearchParams(url.search);
    
    // Remove page parameter as it shouldn't affect the state key
    params.delete('page');
    
    // Sort parameters to ensure consistent state keys
    const sortedParams = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    
    // Include a layout version to avoid restoring stale cached DOM when the grid structure changes.
    // Example: content cards inserted via collection metafields.
    const layoutKey = (this.dataset.layoutKey || '').trim();
    const layoutHash = layoutKey ? this.#hashString(layoutKey) : 'v0';

    return `infinite-scroll-${this.collectionHandle}-${sortedParams}-${layoutHash}`;
  }

  /**
   * Small, deterministic hash to keep state keys short.
   * FNV-1a 32-bit, encoded as base36.
   * @param {string} str
   * @returns {string}
   */
  #hashString(str) {
    // FNV-1a 32-bit
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      // hash *= 16777619 (via bit operations)
      hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
    }
    return hash.toString(36);
  }
  
  init() {
    // Try to restore previous state
    this.restoreState();
    this.#syncPriceText();
    
    // Set up intersection observer for infinite scroll
    this.setupIntersectionObserver();
    
    // Check if we have fewer products than per page limit (no more pages)
    const initialProductCount = this.productsGrid.children.length;
    if (initialProductCount < this.productsPerPage && this.currentPage === 1) {
      this.hasMoreProducts = false;
      this.showEndOfProducts();
      this.showSmartCrossSellSlider();
    }
    
    // Save state when user navigates away
    this.setupStatePreservation();
  }

  /**
   * Ensure product card prices match server-rendered text.
   * Some third-party scripts overwrite price HTML (e.g. dualPrice/finalPrice).
   * @private
   */
  #syncPriceText() {
    try {
      if (!this.productsGrid) return;
      const els = this.productsGrid.querySelectorAll('[data-price-text][data-price]');
      els.forEach((el) => {
        const expected = (el.getAttribute('data-price-text') || '').trim();
        if (!expected) return;
        const current = (el.textContent || '').trim();
        if (current !== expected) {
          el.textContent = expected;
        }
      });
    } catch (error) {
      console.error('InfiniteScrollCollection: failed to sync price text', error);
    }
  }

  /**
   * Initialize dynamic product card rating widgets.
   * Inline scripts inside fetched HTML are not executed when nodes are cloned.
   * @param {ParentNode} scope - Scope containing new product cards
   * @private
   */
  #initializeProductRatings(scope) {
    try {
      if (typeof window.__voldtInitProductRating === 'function') {
        window.__voldtInitProductRating(scope);
        return;
      }

      // Fallback for dynamically appended cards when inline scripts were not executed.
      const roots = scope?.querySelectorAll?.('[data-product-rating-root]') || [];
      if (!roots.length) return;

      const globalState = window.__voldtProductRatings || (window.__voldtProductRatings = {
        cache: new Map(),
        inflight: new Map()
      });

      const fetchRatingData = (skuKey) => {
        if (globalState.cache.has(skuKey)) return Promise.resolve(globalState.cache.get(skuKey));
        if (globalState.inflight.has(skuKey)) return globalState.inflight.get(skuKey);

        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 5000);
        const apiUrl = `https://app-dev.voldt.com/api/shopify/reviews/${skuKey}&rating=4,5`;

        const request = fetch(apiUrl, {
          method: 'GET',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal
        })
          .then((response) => (response.ok ? response.json() : null))
          .then((data) => {
            const payload = { items: Array.isArray(data?.items) ? data.items : [] };
            globalState.cache.set(skuKey, payload);
            return payload;
          })
          .catch(() => ({ items: [] }))
          .finally(() => {
            window.clearTimeout(timeoutId);
            globalState.inflight.delete(skuKey);
          });

        globalState.inflight.set(skuKey, request);
        return request;
      };

      roots.forEach((root) => {
        if (!(root instanceof HTMLElement)) return;
        if (root.dataset.ratingInitialized === 'true') return;

        const isCompact = root.dataset.isCompact === 'true';
        const hasReviewHint = root.dataset.hasReviewHint === 'true';
        if (!isCompact || !hasReviewHint) return;

        const skuList = root.dataset.skuList || '';
        const ratingScaleMax = Number(root.dataset.ratingScaleMax || 5);
        const loadingEl = root.querySelector('[data-product-rating-loading]');
        const compactStarsEl = root.querySelector('[data-product-rating-stars-compact]');
        const compactTextEl = root.querySelector('[data-product-rating-text-compact]');
        const srEl = root.querySelector('[data-product-rating-sr]');

        if (!skuList || !compactStarsEl || !compactTextEl) {
          root.style.display = 'none';
          root.dataset.ratingInitialized = 'true';
          return;
        }

        root.dataset.ratingInitialized = 'true';

        const setLoadingState = (isLoading) => {
          if (loadingEl) loadingEl.hidden = !isLoading;
          compactStarsEl.hidden = isLoading;
          compactTextEl.hidden = isLoading;
        };

        const hideRating = () => {
          setLoadingState(false);
          root.style.display = 'none';
        };

        const updateDisplay = (ratingValue, ratingCount) => {
          const safeRating = Number.isFinite(ratingValue) ? ratingValue : 5;
          const safeCount = Number.isFinite(ratingCount) ? ratingCount : 0;
          const ratingDisplay = safeRating.toFixed(1);
          const ratingPercent = Math.max(0, Math.min((safeRating / ratingScaleMax) * 100, 100));

          compactStarsEl.style.setProperty('--percent', `${ratingPercent}%`);
          compactStarsEl.setAttribute('aria-label', `Rated ${ratingDisplay} out of ${ratingScaleMax} stars`);
          compactTextEl.textContent = ratingDisplay;
          if (srEl) srEl.textContent = `${safeCount} reviews`;
        };

        const runFetch = () => {
          setLoadingState(true);
          fetchRatingData(skuList).then((payload) => {
            const items = payload.items;
            if (!items.length) {
              hideRating();
              return;
            }

            let reviewSum = 0;
            for (const item of items) {
              reviewSum += Number.parseFloat(item?.rating) || 0;
            }

            updateDisplay(reviewSum / items.length, items.length);
            setLoadingState(false);
          });
        };

        if ('IntersectionObserver' in window) {
          const observer = new IntersectionObserver((entries) => {
            const [entry] = entries;
            if (!entry?.isIntersecting) return;
            observer.disconnect();
            runFetch();
          }, { rootMargin: '120px 0px' });
          observer.observe(root);
        } else {
          runFetch();
        }
      });
    } catch (error) {
      console.error('InfiniteScrollCollection: failed to initialize product ratings', error);
    }
  }
  
  restoreState() {
    // Skip state restoration if ss=0 is set
    if (this.disableSavedState) {
      // Clear any existing saved state for this key
      try {
        sessionStorage.removeItem(this.stateKey);
      } catch (error) {
        console.error('Error clearing saved state:', error);
      }
      return;
    }
    
    try {
      const savedState = sessionStorage.getItem(this.stateKey);
      if (savedState) {
        const state = JSON.parse(savedState);
        
        console.log(`Restoring state from ${this.stateKey}:`, {
          currentPage: state.currentPage,
          productsCount: state.productsData ? state.productsData.length : 0,
          hasMore: state.hasMoreProducts,
          timestamp: state.timestamp ? new Date(state.timestamp).toISOString() : 'unknown'
        });
        
        this.currentPage = state.currentPage || 1;
        this.hasMoreProducts = state.hasMoreProducts !== false;
        
        // If we have saved products, restore the complete state
        if (state.productsData && state.productsData.length > 0) {
          console.log(`Restoring ${state.productsData.length} products from session storage`);
          this.#restoreProductsFromData(state.productsData);
          
          // Restore scroll position after a short delay
          setTimeout(() => {
            if (state.scrollPosition) {
              window.scrollTo(0, state.scrollPosition);
            }
          }, 100);
        }
        
        if (!this.hasMoreProducts) {
          this.showEndOfProducts();
          this.showSmartCrossSellSlider();
        }
      } else {
        console.log(`No saved state found for ${this.stateKey}`);
      }
    } catch (error) {
      console.error('Error restoring infinite scroll state:', error);
      // Clear corrupted state
      try {
        sessionStorage.removeItem(this.stateKey);
      } catch (e) {
        console.error('Error clearing corrupted state:', e);
      }
    }
  }
  
  /**
   * Restore products from saved data instead of HTML string
   * @param {Array} productsData - Array of product data objects
   * @private
   */
  #restoreProductsFromData(productsData) {
    if (!Array.isArray(productsData) || productsData.length === 0) return;
    
    // Clear the grid and restore ALL elements from saved state
    this.productsGrid.innerHTML = '';
    
    let showMoreCount = 0;
    let productCount = 0;
    
    // Add ALL elements from saved state (products and show-more buttons)
    productsData.forEach(elementData => {
      const restoredElement = this.#createProductElement(elementData);
      if (restoredElement) {
        this.productsGrid.appendChild(restoredElement);
        
        // Count elements for logging
        if (elementData.tagName === 'show-more') {
          showMoreCount++;
          // Check if show-more indicates we should stop infinite scroll
          this.hasMoreProducts = false;
        } else {
          productCount++;
        }
      }
    });
    
    console.log(`Restored ${productCount} products and ${showMoreCount} show-more buttons from cache`);
    this.#initializeProductRatings(this.productsGrid);
    
    // Ensure sentinel is properly positioned after restoration
    this.#ensureSentinel();
  }
  
  /**
   * Create a product element from saved data
   * @param {Object} productData - Product data object
   * @returns {HTMLElement|null} Created product element or null if invalid
   * @private
   */
  #createProductElement(productData) {
    try {
      // Check if productData has the html property
      if (!productData || !productData.html) {
        console.warn('Product data missing html property:', productData);
        return null;
      }
      
      // Create a temporary container to parse the HTML safely
      const tempContainer = document.createElement('div');
      tempContainer.innerHTML = productData.html;
      
      const productElement = tempContainer.firstElementChild;
      if (!productElement) {
        console.warn('No product element found in HTML:', productData.html);
        return null;
      }
      
      // Restore any custom properties or data attributes
      if (productData.attributes) {
        Object.entries(productData.attributes).forEach(([key, value]) => {
          productElement.setAttribute(key, value);
        });
      }
      
      return productElement;
    } catch (error) {
      console.error('Error creating product element from saved data:', error, productData);
      return null;
    }
  }

  /**
   * Ensure sentinel exists and is properly positioned at the end of the grid
   * @private
   */
  #ensureSentinel() {
    // Remove existing sentinel if it exists
    if (this.sentinel && this.sentinel.parentNode) {
      this.sentinel.remove();
    }
    
    // Create a new sentinel element
    this.sentinel = document.createElement('div');
    this.sentinel.id = 'scroll-sentinel';
    this.sentinel.setAttribute('data-sentinel', 'true');
    this.sentinel.style.display = 'contents';
    this.sentinel.style.height = '10px';
    this.sentinel.style.width = '100%';
    this.sentinel.style.position = 'relative';
    this.sentinel.style.zIndex = '1';
    this.sentinel.style.pointerEvents = 'none';
    this.sentinel.style.order = '9999'; // Ensure it's always last
    
    // Append sentinel to the products grid (not the component)
    this.productsGrid.appendChild(this.sentinel);
    
    // Observe the sentinel if we have an observer and should continue loading
    if (this.observer && this.hasMoreProducts) {
      // Check if there's a show-more button - if so, don't observe sentinel
      const showMore = this.productsGrid.querySelector('show-more');
      if (!showMore) {
        this.observer.observe(this.sentinel);
        console.log('Sentinel created and observed');
      } else {
        console.log('Sentinel created but not observed (show-more button present)');
      }
    }
  }
  
  /**
   * Re-observe the sentinel element after DOM restoration
   * This ensures the intersection observer works properly after cache restoration
   * @private
   */
  #reobserveSentinel() {
    // Simply ensure the sentinel is properly positioned and observed
    this.#ensureSentinel();
  }
  
  saveState() {
    // Skip state saving if ss=0 is set
    if (this.disableSavedState) {
      return;
    }
    
    try {
      // Collect product data instead of HTML string
      const productsData = this.#collectProductsData();
      
      const state = {
        currentPage: this.currentPage,
        hasMoreProducts: this.hasMoreProducts,
        productsData: productsData,
        scrollPosition: window.scrollY,
        timestamp: Date.now()
      };
      
      console.log(`Saving state for ${this.stateKey}:`, {
        currentPage: state.currentPage,
        productsCount: productsData.length,
        hasMore: state.hasMoreProducts
      });
      
      sessionStorage.setItem(this.stateKey, JSON.stringify(state));
    } catch (error) {
      console.error('Error saving infinite scroll state:', error);
    }
  }
  
  /**
   * Collect product data for state saving
   * @returns {Array} Array of product data objects
   * @private
   */
  #collectProductsData() {
    const productsData = [];
    const allProducts = Array.from(this.productsGrid.children);
    
    // Save ALL elements in the grid except the sentinel
    allProducts.forEach((element) => {
      // Skip the sentinel element
      if (element.hasAttribute('data-sentinel')) {
        return;
      }
      
      try {
        const elementData = {
          html: element.outerHTML,
          tagName: element.tagName.toLowerCase(),
          attributes: {}
        };
        
        // Save important attributes that might be dynamic
        const importantAttributes = ['data-product-id', 'data-variant-id', 'data-collection-id', 'class', 'style'];
        importantAttributes.forEach(attr => {
          if (element.hasAttribute(attr)) {
            elementData.attributes[attr] = element.getAttribute(attr);
          }
        });
        
        productsData.push(elementData);
      } catch (error) {
        console.error('Error collecting element data:', error);
      }
    });
    
    console.log(`Saving complete state: ${productsData.length} total elements (products + show-more buttons, excluding sentinel)`);
    
    return productsData;
  }
  
  setupStatePreservation() {
    // Skip state preservation setup if ss=0 is set
    if (this.disableSavedState) {
      return;
    }
    
    // Save state before page unload
    window.addEventListener('beforeunload', () => {
      this.saveState();
    });
    
    // Save state when clicking on product links
    this.productsGrid.addEventListener('click', (event) => {
      const productLink = event.target.closest('a[href*="/products/"]');
      if (productLink) {
        this.saveState();
      }
    });
    
    // Listen for URL changes to detect filter changes
    // Since filters update the URL, this is the single source of truth
    let currentUrl = window.location.href;
    
    this.urlCheckInterval = setInterval(() => {
      if (window.location.href !== currentUrl) {
        const oldUrl = new URL(currentUrl);
        const newUrl = new URL(window.location.href);
        
        // Only reload if the search parameters actually changed (not just page number)
        const oldParams = new URLSearchParams(oldUrl.search);
        const newParams = new URLSearchParams(newUrl.search);
        oldParams.delete('page');
        newParams.delete('page');
        
        if (oldParams.toString() !== newParams.toString()) {
          currentUrl = window.location.href;
          
          // Clear old state and generate new state key
          try {
            sessionStorage.removeItem(this.stateKey);
          } catch (error) {
            console.error('Error clearing old state on URL change:', error);
          }
          
          this.stateKey = this.generateStateKey();
          
          // Reset component state
          this.currentPage = 1;
          this.hasMoreProducts = true;
          this.isLoading = false;
          
          if (this.endOfProducts) {
            this.endOfProducts.classList.add('hidden');
          }
          
          this.hideError();
          
          // Reload products with new filters
          this.reloadProducts('url-change');
        } else {
          // Just update the current URL reference
          currentUrl = window.location.href;
        }
      }
    }, 100); // Check every 100ms
  }
  
  setupIntersectionObserver() {
    const options = {
      root: null,
      rootMargin: '2000px', // Increased from 1000px to catch fast scrolling
      threshold: [0, 0.1, 0.5, 1] // Multiple thresholds for better detection
    };
    
    // Create the observer
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.isLoading && this.hasMoreProducts) {
          // Check if there's a show-more button - if so, don't auto-load
          const showMore = this.productsGrid.querySelector('show-more');
          if (!showMore) {
            this.loadMoreProducts();
          }
        }
      });
    }, options);
    
    // Create and position the sentinel
    this.#ensureSentinel();
    
    // Add fallback scroll listener for fast scrolling scenarios
    this.setupScrollFallback();
    
    // Add periodic sentinel check as final safety net
    this.setupPeriodicSentinelCheck();
  }
  
  /**
   * Setup fallback scroll listener for fast scrolling detection
   * @private
   */
  setupScrollFallback() {
    let scrollTimeout = null;
    let lastScrollTop = 0;
    let scrollVelocity = 0;
    let lastScrollTime = Date.now();
    
    const handleScroll = () => {
      if (this.isLoading || !this.hasMoreProducts) return;
      
      const currentTime = Date.now();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const timeDelta = currentTime - lastScrollTime;
      
      if (timeDelta > 0) {
        scrollVelocity = Math.abs(scrollTop - lastScrollTop) / timeDelta;
      }
      
      lastScrollTop = scrollTop;
      lastScrollTime = currentTime;
      
      // Clear existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      
      // For very fast scrolling, use shorter timeout
      const timeoutDelay = scrollVelocity > 2 ? 50 : 100;
      
      // Set a timeout to detect when scrolling stops
      scrollTimeout = setTimeout(() => {
        this.#checkSentinelPosition();
      }, timeoutDelay);
      
      // Immediate check for very fast scrolling - if sentinel is already past viewport
      if (scrollVelocity > 3) {
        this.#checkSentinelPosition(true);
      }
    };
    
    // Use passive scroll listener for performance
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Store cleanup reference
    this.scrollFallbackHandler = handleScroll;
  }
  
  /**
   * Check sentinel position and trigger load if needed
   * @param {boolean} immediate - Whether to check immediately (bypass velocity check)
   * @private
   */
  #checkSentinelPosition(immediate = false) {
    if (this.isLoading || !this.hasMoreProducts) return;
    
    if (!this.sentinel) return;
    
    // Don't trigger if there's a show-more button
    const showMore = this.productsGrid.querySelector('show-more');
    if (showMore) return;
    
    const sentinelRect = this.sentinel.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    
    // If sentinel is within 500px of viewport, trigger load
    if (sentinelRect.top <= viewportHeight + 500) {
      this.loadMoreProducts();
    }
  }
  
  /**
   * Setup periodic sentinel check as final safety net
   * @private
   */
  setupPeriodicSentinelCheck() {
    // Check every 2 seconds if sentinel might have been missed
    this.sentinelCheckInterval = setInterval(() => {
      if (!this.isLoading && this.hasMoreProducts) {
        this.#checkSentinelPosition();
      }
    }, 2000);
  }
  
  async loadMoreProducts() {
    if (this.isLoading || !this.hasMoreProducts) return;
    
    this.isLoading = true;
    this.showLoading();
    
    try {
      const nextPage = this.currentPage + 1;
      
      // Get current URL parameters to preserve filters
      const currentUrl = new URL(window.location);
      const searchParams = new URLSearchParams(currentUrl.search);
      
      // Add page parameter and view parameter
      searchParams.set('page', nextPage);
      searchParams.set('view', 'products');
      
      const url = `/collections/${this.collectionHandle}?${searchParams.toString()}`;
      
      const response = await fetch(url, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load products: ${response.status} ${response.statusText}`);
      }
      
      const html = await response.text();
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const newProducts = doc.querySelectorAll('#products-grid > *');
      
      if (newProducts.length === 0) {
        this.hasMoreProducts = false;
        this.showEndOfProducts();
        this.showSmartCrossSellSlider();
      } else {
        // Check if the fetched content contains a <show-more> element
        // Check both direct children and nested elements
        const hasShowMore = Array.from(newProducts).some(element => {
          // Check if the element itself is show-more
          if (element.tagName && element.tagName.toLowerCase() === 'show-more') {
            return true;
          }
          // Also check if show-more is nested inside this element
          return element.querySelector && element.querySelector('show-more') !== null;
        });

                  // If there's a show-more element, stop infinite scroll
          if (hasShowMore) {
            this.hasMoreProducts = false;
            
            // Show-more elements will be handled by event delegation
          }
        
        // Add new products to the grid as DOM nodes
        const addedCards = [];
        newProducts.forEach(product => {
          const clonedProduct = product.cloneNode(true);
          this.productsGrid.appendChild(clonedProduct);
          addedCards.push(clonedProduct);
        });
        this.#initializeProductRatings(this.productsGrid);
        this.#syncPriceText();
        
        // Stagger animate the new product cards
        await this.staggerNewProductCards(addedCards);
        
        this.currentPage = nextPage;
        
        // Ensure sentinel is at the end after adding products
        this.#ensureSentinel();
        
        // Check if we got fewer products than expected (last page)
        if (newProducts.length < this.productsPerPage) {
          this.hasMoreProducts = false;
          this.showEndOfProducts();
          this.showSmartCrossSellSlider();
        }
        
        // Save state after successful load
        this.saveState();
        
        // Clear any previous error state
        this.hideError();
      }
    } catch (error) {
      console.error('Error loading more products:', error);
      this.showError(error.message);
    } finally {
      this.isLoading = false;
      this.hideLoading();
    }
  }

  /**
   * Stagger animate newly added product cards
   * @param {Array} addedCards - Array of newly added product card elements
   * @returns {Promise} Animation completion promise
   * @private
   */
  async staggerNewProductCards(addedCards) {
    // Skip animation if user prefers reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return Promise.resolve();
    }
    
    if (addedCards.length === 0) return Promise.resolve();
    
    // Set initial state for new product cards
    addedCards.forEach(card => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
    });
    
    // Animate new product cards with fast stagger
    const animations = addedCards.map((card, index) => {
      return card.animate([
        { opacity: 0, transform: 'translateY(20px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], {
        duration: 300,
        delay: index * 30, // Much faster: 30ms delay between cards
        easing: 'ease-out',
        fill: 'forwards'
      });
    });
    
    // Wait for all animations to complete
    await Promise.all(animations.map(anim => anim.finished));
    
    // Clean up inline styles
    addedCards.forEach(card => {
      card.style.opacity = '';
      card.style.transform = '';
    });
  }
  
  showLoading() {
    if (!this.loadingIndicator) return;
    this.loadingIndicator.classList.remove('hidden');
  }
  
  hideLoading() {
    if (!this.loadingIndicator) return;
    this.loadingIndicator.classList.add('hidden');
  }
  
  showEndOfProducts() {
    if (!this.endOfProducts) return;
    this.endOfProducts.classList.remove('hidden');
  }

  showSmartCrossSellSlider() {
    if (!this.smartCrossSellSlider) return;
    this.smartCrossSellSlider.classList.remove('hidden');
  }
  
  showError(message) {
    if (this.errorIndicator) {
      const errorMessage = this.errorIndicator.querySelector('.error-message');
      if (errorMessage) {
        errorMessage.textContent = message || 'Failed to load more products. Please try again.';
      }
      this.errorIndicator.classList.remove('hidden');
    }
  }
  
  hideError() {
    if (this.errorIndicator) {
      this.errorIndicator.classList.add('hidden');
    }
  }
  
  retryLoadProducts() {
    this.hideError();
    this.loadMoreProducts();
  }
  
  /**
   * Reload products with current filters
   * Used when filters change to get fresh products
   */
  async reloadProducts(type) {
    if (this.isLoading) return;
    
    this.isLoading = true;
    
    // Reset pagination state
    this.currentPage = 1;
    this.hasMoreProducts = true;
    
    // Step 1: Add opacity-50 and transition to the grid
    this.productsGrid.classList.add('opacity-50', 'transition-opacity', 'duration-300');
    
    try {
      // Get current URL parameters to preserve filters
      const currentUrl = new URL(window.location);
      const searchParams = new URLSearchParams(currentUrl.search);
      
      // Remove page parameter to get first page
      searchParams.delete('page');
      searchParams.set('view', 'products');
      
      const url = `/collections/${this.collectionHandle}?${searchParams.toString()}`;
      
      const response = await fetch(url, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to reload products: ${response.status} ${response.statusText}`);
      }
      
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const newProducts = doc.querySelectorAll('#products-grid > *');
      
      // Step 2: Replace all products in the grid using DOM nodes
      this.productsGrid.innerHTML = '';
      newProducts.forEach(product => {
        this.productsGrid.appendChild(product.cloneNode(true));
      });
      this.#initializeProductRatings(this.productsGrid);
      this.#syncPriceText();
      
      // Step 3: Remove opacity classes from new grid
      this.productsGrid.classList.remove('opacity-50', 'transition-opacity', 'duration-300');
      
      // Step 4: Stagger animate product cards
      await this.staggerProductCards();
      
      // Ensure sentinel is properly positioned after reload
      this.#ensureSentinel();
      
      // Check if we have fewer products than per page limit (no more pages)
      if (newProducts.length < this.productsPerPage) {
        this.hasMoreProducts = false;
        this.showEndOfProducts();
        this.showSmartCrossSellSlider();
      } else {
        this.hasMoreProducts = true;
        if (this.endOfProducts) {
          this.endOfProducts.classList.add('hidden');
        }
      }
      
      // Reset to page 1
      this.currentPage = 1;
      
      // Save state after successful reload
      this.saveState();
      
      // Clear any previous error state
      this.hideError();
      
    } catch (error) {
      console.error('Error reloading products:', error);
      this.showError(error.message);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Stagger animate product cards
   * @returns {Promise} Animation completion promise
   * @private
   */
  async staggerProductCards() {
    // Skip animation if user prefers reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return Promise.resolve();
    }

    const productCards = this.productsGrid.querySelectorAll('product-card');
    
    if (productCards.length === 0) return Promise.resolve();
    
    // Set initial state for product cards
    productCards.forEach(card => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
    });
    
    // Animate product cards with fast stagger
    const animations = Array.from(productCards).map((card, index) => {
      return card.animate([
        { opacity: 0, transform: 'translateY(20px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], {
        duration: 300,
        delay: index * 30, // Much faster: 30ms delay between cards
        easing: 'ease-out',
        fill: 'forwards'
      });
    });
    
    // Wait for all animations to complete
    await Promise.all(animations.map(anim => anim.finished));
    
    // Clean up inline styles
    productCards.forEach(card => {
      card.style.opacity = '';
      card.style.transform = '';
    });
  }

  /**
   * Add loading state with opacity-50 and transition
   * @private
   */
  addLoadingState() {
    if (this.productsGrid) {
      this.productsGrid.classList.add('opacity-50', 'transition-opacity', 'duration-300');
    }
  }

  /**
   * Remove loading state
   * @private
   */
  removeLoadingState() {
    if (this.productsGrid) {
      this.productsGrid.classList.remove('opacity-50', 'transition-opacity', 'duration-300');
    }
  }

  /**
   * Clear all saved states for this collection
   * Useful for debugging or when filters are reset
   */
  clearAllSavedStates(clearAll = false) {
    try {
      // Clear all session storage items that start with this collection's prefix
      const keysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (!key) continue;
        if (
          (clearAll && key.startsWith('infinite-scroll-')) ||
          (!clearAll && key.startsWith(`infinite-scroll-${this.collectionHandle}-`))
        ) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    } catch (error) {
      console.error('Error clearing saved states:', error);
    }
  }
  
  /**
   * Public method to manually check sentinel position
   * Useful for debugging or manual triggers
   */
  checkSentinel() {
    this.#checkSentinelPosition(true);
  }
  
  disconnectedCallback() {
    if (this.observer) {
      this.observer.disconnect();
    }
    
    // Clean up sentinel element
    if (this.sentinel && this.sentinel.parentNode) {
      this.sentinel.remove();
      this.sentinel = null;
    }
    
    // Clean up URL check interval if it exists
    if (this.urlCheckInterval) {
      clearInterval(this.urlCheckInterval);
    }
    
    // Clean up scroll fallback handler
    if (this.scrollFallbackHandler) {
      window.removeEventListener('scroll', this.scrollFallbackHandler);
      this.scrollFallbackHandler = null;
    }
    
    // Clean up periodic sentinel check interval
    if (this.sentinelCheckInterval) {
      clearInterval(this.sentinelCheckInterval);
      this.sentinelCheckInterval = null;
    }
    
    // Remove resize listener and pending RAF
    window.removeEventListener('resize', this.onResizeBound);
    if (this.resizeRafId) {
      cancelAnimationFrame(this.resizeRafId);
      this.resizeRafId = null;
    }
  }
  
  /**
   * Calculate first product card image height and set :root CSS variable
   * Sets `--product-card-height` on documentElement
   */
  calculateAndSetProductCardHeight() {
    try {
      const root = document.documentElement;
      const grid = this.productsGrid || this.querySelector('#products-grid') || this;
      const productCard = grid.querySelector('product-card');
      if (!productCard) return;
      // Try common image selectors inside product card
      const image = productCard.querySelector('picture');
      if (!image) return;
      
      const setVar = () => {
        const height = Math.round((image.getBoundingClientRect().height || image.clientHeight || 0));
        if (height > 0) {
          root.style.setProperty('--product-card-height', `${height}px`);
        }
      };
      
      // If image not laid out yet, wait for it
      if ('complete' in image && !image.complete) {
        image.addEventListener('load', setVar, { once: true });
        image.addEventListener('error', setVar, { once: true });
      }
      // Always attempt immediate set as well
      setVar();
    } catch (error) {
      console.error('InfiniteScrollCollection: failed to set --product-card-height', error);
    }
  }
  
  /**
   * Debounced resize handler (via requestAnimationFrame)
   */
  handleResize() {
    if (this.resizeRafId) {
      cancelAnimationFrame(this.resizeRafId);
    }
    this.resizeRafId = requestAnimationFrame(() => {
      this.resizeRafId = null;
      this.calculateAndSetProductCardHeight();
    });
  }
}

/**
 * ShowMore Web Component
 * 
 * A button component that triggers the next page load for infinite scroll
 * by updating the URL with the appropriate page parameter.
 * 
 * Can be used as a button itself or as a wrapper for a button element.
 * 
 * @example
 * <!-- As a button itself -->
 * <show-more class="btn">Load More Products</show-more>
 * 
 * @example
 * <!-- As a wrapper -->
 * <show-more>
 *   <button type="button">Load More Products</button>
 * </show-more>
 */
class ShowMore extends HTMLElement {
  /** @type {HTMLElement | null} The clickable element (either this or child button) */
  #clickableElement = null;
  
  /** @type {boolean} Component connection state */
  #isConnected = false;
  
  /** @type {boolean} Loading state to prevent double clicks */
  #isLoading = false;
  
  /** @type {Function | null} Click handler reference for cleanup */
  #clickHandler = null;
  
  /** @type {Function | null} Keydown handler reference for cleanup */
  #keydownHandler = null;

  constructor() {
    super();
  }

  connectedCallback() {
    if (this.#isConnected) return;
    
    try {
      this.#isConnected = true;
      this.#initializeButton();
    } catch (error) {
      this.#handleError('Failed to initialize show-more button', error);
    }
  }

  disconnectedCallback() {
    this.#cleanup();
  }

  /**
   * Initialize the button and add event listener
   * @private
   */
  #initializeButton() {
    // Check if there's a button inside, otherwise use this element as the button
    const childButton = this.querySelector('button');
    
    if (childButton) {
      // Use the child button
      this.#clickableElement = childButton;
    } else {
      // Use this element as the button
      this.#clickableElement = this;
      
      // Add button semantics for accessibility
      this.setAttribute('role', 'button');
      this.setAttribute('tabindex', '0');
      
      // Add keyboard support
      this.#keydownHandler = (event) => this.#handleKeydown(event);
      this.addEventListener('keydown', this.#keydownHandler);
    }
    
    this.#clickHandler = (event) => this.#handleClick(event);
    this.#clickableElement.addEventListener('click', this.#clickHandler, { passive: true });
  }

  /**
   * Handle keyboard events for accessibility
   * @param {KeyboardEvent} event - Keyboard event
   * @private
   */
  #handleKeydown(event) {
    // Trigger click on Enter or Space key
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.#handleClick(event);
    }
  }

  /**
   * Handle button click to load next page
   * @param {Event} event - Click event
   * @private
   */
  async #handleClick(event) {
    event.preventDefault();
    
    if (this.#isLoading) return;
    
    try {
      this.#isLoading = true;
      this.#updateButtonState(true);
      
      // Dispatch event to trigger infinite scroll to load more products
      this.#dispatchLoadMoreEvent();
      
      // Hide this show-more element after triggering load
      this.style.display = 'none';
      
    } catch (error) {
      this.#handleError('Failed to load more products', error);
      this.#isLoading = false;
      this.#updateButtonState(false);
    }
  }

  /**
   * Update button visual state during loading
   * @param {boolean} isLoading - Loading state
   * @private
   */
  #updateButtonState(isLoading) {
    if (!this.#clickableElement) return;
    
    if (isLoading) {
      // Handle both button and custom element cases
      if (this.#clickableElement.tagName === 'BUTTON') {
        this.#clickableElement.disabled = true;
      } else {
        this.#clickableElement.setAttribute('aria-disabled', 'true');
        this.#clickableElement.style.pointerEvents = 'none';
      }
      
      this.#clickableElement.setAttribute('aria-busy', 'true');
      this.#clickableElement.classList.add('loading');
    } else {
      if (this.#clickableElement.tagName === 'BUTTON') {
        this.#clickableElement.disabled = false;
      } else {
        this.#clickableElement.removeAttribute('aria-disabled');
        this.#clickableElement.style.pointerEvents = '';
      }
      
      this.#clickableElement.removeAttribute('aria-busy');
      this.#clickableElement.classList.remove('loading');
    }
  }

  /**
   * Dispatch custom event when load more is triggered
   * @private
   */
  #dispatchLoadMoreEvent() {
    // Dispatch event that infinite scroll collection will listen for
    this.dispatchEvent(new CustomEvent('show-more:load-requested', {
      detail: { 
        showMoreElement: this,
        timestamp: Date.now()
      },
      bubbles: true
    }));
  }

  /**
   * Handle errors gracefully
   * @param {string} message - Error message
   * @param {Error} error - Original error object
   * @private
   */
  #handleError(message, error) {
    console.error(`ShowMore: ${message}`, error);
    
    this.dispatchEvent(new CustomEvent('show-more:error', {
      detail: { message, error: error.message },
      bubbles: true
    }));
  }

  /**
   * Clean up event listeners
   * @private
   */
  #cleanup() {
    this.#isConnected = false;
    
    if (this.#clickableElement && this.#clickHandler) {
      this.#clickableElement.removeEventListener('click', this.#clickHandler);
      this.#clickHandler = null;
    }
    
    if (this.#keydownHandler) {
      this.removeEventListener('keydown', this.#keydownHandler);
      this.#keydownHandler = null;
    }
    
    this.#clickableElement = null;
  }

  /**
   * Static helper to find all show-more elements
   * @returns {NodeList} All show-more elements
   */
  static findAll() {
    return document.querySelectorAll('show-more');
  }

  /**
   * Static helper to hide all show-more elements
   */
  static hideAll() {
    ShowMore.findAll().forEach(element => {
      element.style.display = 'none';
    });
  }

  /**
   * Public method to reset loading state (called by infinite scroll)
   */
  resetLoadingState() {
    this.#isLoading = false;
    this.#updateButtonState(false);
  }

  /**
   * Public method to show element again (called on error)
   */
  showElement() {
    this.style.display = '';
  }
  
  /**
   * Public method to manually check sentinel position
   * Useful for debugging or manual triggers
   */
  checkSentinel() {
    // Find the infinite scroll collection and call its checkSentinel method
    const infiniteScrollCollection = document.querySelector('infinite-scroll-collection');
    if (infiniteScrollCollection && typeof infiniteScrollCollection.checkSentinel === 'function') {
      infiniteScrollCollection.checkSentinel();
    }
  }
}

customElements.define('infinite-scroll-collection', InfiniteScrollCollection);
customElements.define('show-more', ShowMore);
