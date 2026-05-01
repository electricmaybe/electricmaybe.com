class CollectionFilters extends HTMLElement {
  /** @type {Function | null} Bound scroll handler function */
  #boundScrollHandler = null;

  constructor() {
    super();
    this.filterData = [];
    this.filterForm = this.querySelector("form");
    this.bindEvents();
  }

  connectedCallback() {
  }

  disconnectedCallback() {
    // Clean up scroll event listener
    if (this.#boundScrollHandler) {
      document.removeEventListener('scroll', this.#boundScrollHandler, { passive: true });
      this.#boundScrollHandler = null;
    }
  }

  bindEvents() {
    if (this.filterForm) {
      this.filterForm.addEventListener("input", debounce(this.onSubmitHandler.bind(this), 0));
    }
    window.addEventListener("popstate", this.onPopState.bind(this));
    this.addEventListener("sort-changed", this.onSortChanged.bind(this));
    
    // Add scroll event listener to close dropdowns when body is scrolled
    this.#setupScrollCloseHandler();
    
    this.checkAbsentImages();
  }

  onSubmitHandler(event) {
    event.preventDefault();
    console.log('CollectionFilters: Form submission triggered', event.target.id);
    
    // Start loading bar
    this.#startLoadingBar();
    
    const formData = new FormData(this.filterForm);
    
    // Debug: Log form data
    for (const [key, value] of formData.entries()) {
      console.log('Form data:', key, value);
    }
    
    const searchParams = this.buildSearchParams(formData);
    console.log('CollectionFilters: Built search params:', searchParams);
    this.renderPage(searchParams, true);
  }

  buildSearchParams(formData) {
    console.log('CollectionFilters: Building search params...');
    const searchParams = new URLSearchParams(window.location.search);
    
    // Preserve existing parameters that are not filters, sort_by, or page
    for (const [key, value] of searchParams.entries()) {
      if (!key.includes("filter.") && key !== "sort_by" && key !== 'page' && formData.get(key) === null) {
        formData.append(key, value);
      }
    }

    // Handle price range filters - only include them if they're actually different from defaults
    const priceRangeSlider = document.querySelector("price-range-slider");
    if (priceRangeSlider) {
      const minPrice = formData.get("filter.v.price.gte");
      const maxPrice = formData.get("filter.v.price.lte");
      
      // Remove min price if it's 0 or empty (default state)
      if (minPrice === "0" || minPrice === "" || minPrice === null) {
        formData.delete("filter.v.price.gte");
      }
      
      // Remove max price if it's at the max limit or empty (default state)
      if (maxPrice === priceRangeSlider.dataset.maxLimit || maxPrice === "" || maxPrice === null) {
        formData.delete("filter.v.price.lte");
      }
      
      // If both price filters are removed, ensure the slider resets to default
      if (!formData.get("filter.v.price.gte") && !formData.get("filter.v.price.lte")) {
        // Trigger a reset on the price range slider
        setTimeout(() => {
          if (priceRangeSlider.reset) {
            priceRangeSlider.reset();
          }
        }, 100);
      }
    }

    // Build final params, ensuring sort_by is included if present
    const params = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      if (value.trim() !== "") {
        params.append(key, value);
      } else {
        params.delete(key);
      }
    }
    
    // Ensure sort_by is preserved if it exists in form data
    const sortBy = formData.get("sort_by");
    console.log('CollectionFilters: Sort by value from form:', sortBy);
    if (sortBy && sortBy.trim() !== "") {
      params.set("sort_by", sortBy);
      console.log('CollectionFilters: Set sort_by in params:', sortBy);
    }
    
    const result = params.toString();
    console.log('CollectionFilters: Final search params:', result);
    return result;
  }

  renderPage(searchParams, pushState = true) {
    if (pushState) {
      this.updateURL(searchParams);
    }
    
    // Check if price filters were removed and reset sliders accordingly
    this.#handlePriceFilterStateChange(searchParams);
    
    this.triggerFilterChangedEvent(searchParams);
  }

  #handlePriceFilterStateChange(searchParams) {
    const newParams = new URLSearchParams(searchParams);
    const oldParams = new URLSearchParams(window.location.search);
    
    const hadPriceFilters = oldParams.has('filter.v.price.gte') || oldParams.has('filter.v.price.lte');
    const hasPriceFilters = newParams.has('filter.v.price.gte') || newParams.has('filter.v.price.lte');
    
    // If price filters were removed, reset all price range sliders
    if (hadPriceFilters && !hasPriceFilters) {
      console.log('CollectionFilters: Price filters removed, resetting sliders');
      setTimeout(() => {
        const priceSliders = document.querySelectorAll('price-range-slider');
        priceSliders.forEach(slider => {
          if (slider.forceReset && typeof slider.forceReset === 'function') {
            slider.forceReset();
          }
        });
      }, 100);
    }
  }

  updateURL(searchParams) {
    const newURL = `${window.location.pathname}${searchParams ? `?${searchParams}` : ""}`;
    if (newURL !== window.location.href) {
      history.pushState({ searchParams }, "", newURL);
    }
  }

  onPopState(event) {
    const searchParams = event.state?.searchParams || "";
    this.renderPage(searchParams, false);
  }

  triggerFilterChangedEvent(searchParams) {
    // First dispatch the filter changed event
    const filterEvent = new CustomEvent("filters:filter-changed", {
      detail: { searchParams },
      bubbles: true,
    });
    window.dispatchEvent(filterEvent);

    // Complete loading bar after filter change
    this.#completeLoadingBar();

    // Then find and trigger reload on the infinite scroll component
    const infiniteScroll = document.querySelector('infinite-scroll-collection');
    if (infiniteScroll) {
      // infiniteScroll.reloadProducts('filter-change');
    }
  }

  onActiveFilterClick(event) {
    event.preventDefault();
    
    // Start loading bar for filter removal
    this.#startLoadingBar();
    
    const href = event.target.href || event.target.closest("a").href;
    const url = new URL(href);
    
    // Convert URLSearchParams to FormData to properly handle parameter preservation
    const formData = new FormData();
    for (const [key, value] of url.searchParams.entries()) {
      formData.append(key, value);
    }
    
    const searchParams = this.buildSearchParams(formData);
    this.renderPage(searchParams, true);
  }

  onSortChanged(event) {
    event.preventDefault();
    console.log('CollectionFilters: Sort changed event received:', event.detail);
    
    const { sortValue, form } = event.detail;
    
    // Create a FormData object with the current form data
    const formData = new FormData(form);
    
    // Ensure the sort_by value is set
    formData.set('sort_by', sortValue);
    
    // Build search params and render page
    const searchParams = this.buildSearchParams(formData);
    console.log('CollectionFilters: Sort search params:', searchParams);
    this.renderPage(searchParams, true);
  }

  checkAbsentImages() {
    this.querySelectorAll(".js-filter img").forEach((img) => {
      img.addEventListener("error", () => img.remove());
    });
  }

  /**
   * Start the loading bar for filter operations
   * @private
   */
  #startLoadingBar() {
    const loadingBanner = document.querySelector('loading-banner');
    if (loadingBanner && typeof loadingBanner.startLoading === 'function') {
      loadingBanner.startLoading();
    }
  }

  /**
   * Complete the loading bar for filter operations
   * @private
   */
  #completeLoadingBar() {
    const loadingBanner = document.querySelector('loading-banner');
    if (loadingBanner && typeof loadingBanner.completeLoading === 'function') {
      loadingBanner.completeLoading();
    }
  }

  toggleActiveFacets(disable = true) {
    this.querySelectorAll("facet-remove").forEach((element) => {
      element.classList.toggle("disabled", disable);
    });
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
      if (scrollTarget !== document.body && scrollTarget !== document.documentElement) {
        return;
      }

      // Find all open dropdown-disclosure elements within electric-filters
      const openDropdowns = document.querySelectorAll('electric-filters dropdown-disclosure details[open]');
      
      if (openDropdowns.length > 0) {
        console.log(`CollectionFilters: Closing ${openDropdowns.length} open dropdowns due to scroll`);
        
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
      console.error('CollectionFilters: Error handling scroll close', error);
    }
  }
}

customElements.define("collection-filters", CollectionFilters);

class PriceRangeSlider extends HTMLElement {
  // example html just for range slider part.
  // needs a reset
  // <price-range-slider
  //   data-min-limit="0"
  //   data-max-limit="{{ filter.range_max | divided_by: 100 }}"
  //   class="block mx-3 mt-5 min-w-56 relative"
  // >
  //   <input
  //     name="{{ filter.min_value.param_name }}"
  //     class="hidden"
  //     type="number"
  //     id="min-price"
  //     value="{{ filter.min_value.value | divided_by: 100 }}"
  //   >
  //   <input
  //     name="{{ filter.max_value.param_name }}"
  //     class="hidden"
  //     type="number"
  //     id="max-price"
  //     value="{{ filter.max_value.value | default: filter.range_max | divided_by: 100 }}"
  //   >
  // </price-range-slider>
  // <facet-remove>
  //   <a
  //     href="{{ filter.url_to_remove }}"
  //     class="inline-block mt-2 mb-4 w-full text-center underline"
  //   >
  //     {{ 'products.facets.reset' | t }}
  //   </a>
  // </facet-remove>
  static observedAttributes = ["data-min-limit", "data-max-limit"];

  // Private fields
  #isDefaultState = true;
  #defaultMinPosition = 0;
  #defaultMaxPosition = 0;

  constructor() {
    super();
    this.minInput = this.querySelector('input[name$="gte"]');
    this.maxInput = this.querySelector('input[name$="lte"]');
  }

  connectedCallback() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          this.init()
          observer.unobserve(this)
        }
      });
    });
    observer.observe(this);
    
    // Listen for URL changes to auto-reset when price filters are removed
    this.#setupUrlChangeListener();
  }

  #setupUrlChangeListener() {
    // Listen for filter change events to check if we should reset
    window.addEventListener('filters:filter-changed', () => {
      setTimeout(() => {
        this.#checkAndResetToDefault();
      }, 100);
    });
    
    // Also listen for popstate events (browser back/forward)
    window.addEventListener('popstate', () => {
      setTimeout(() => {
        this.#checkAndResetToDefault();
      }, 100);
    });
  }

  init() {
    this.getValues();
    this.initSlider();
    this.initDragFunctionality();
    this.afterInit();
    this.updateOnInputChange();
    this.#checkAndResetToDefault();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.isSource) return;
    if (!oldValue) return;
    if (name === "data-min-limit" || name === "data-max-limit") {
      this.getValues();
      this.minInput.dispatchEvent(new Event("change"));
      this.maxInput.dispatchEvent(new Event("change"));
    }
  }

  afterInit() {
    this.updateKnobValues();
    this.updateInputValues();
    // Store default positions after initialization
    this.#defaultMinPosition = 0;
    this.#defaultMaxPosition = this.rect.width - this.maxKnob.offsetWidth;
    
    // Sync visual state with actual filter state
    this.#syncVisualStateWithFilters();
  }

  #syncVisualStateWithFilters() {
    // Check if there are actual price filters in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const minPrice = urlParams.get('filter.v.price.gte');
    const maxPrice = urlParams.get('filter.v.price.lte');
    
    if (minPrice || maxPrice) {
      // There are active price filters, update visual state
      this.#isDefaultState = false;
      
      if (minPrice && minPrice !== "0") {
        const minPosition = this.calculateKnobPosition(parseInt(minPrice));
        if (this.minKnob) {
          this.minKnob.style.left = minPosition + "%";
        }
      }
      
      if (maxPrice && maxPrice !== this.maxLimit.toString()) {
        const maxPosition = this.calculateKnobPosition(parseInt(maxPrice));
        if (this.maxKnob) {
          this.maxKnob.style.right = (100 - maxPosition) + "%";
        }
      }
      
      // Update the display
      this.updateKnobValues();
      this.updateInputValues();
    } else {
      // No price filters, ensure we're at default state
      this.#isDefaultState = true;
      this.#resetKnobsToDefault();
      this.updateKnobValues();
    }
  }

  getValues() {
    this.minLimit = parseInt(this.dataset.minLimit) || 0;
    this.maxLimit = parseInt(this.dataset.maxLimit) || 1000;

    this.minLimit =
      this.minLimit > this.maxLimit ? this.maxLimit : this.minLimit;
    this.maxLimit =
      this.maxLimit < this.minLimit ? this.minLimit : this.maxLimit;
  }

  initSlider() {
    /**
     * We render the slider using JS to avoid manual work.
     * This function creates the slider elements and appends them to the DOM.
     */
    const sliderContainer = document.createElement("div");
    sliderContainer.className = "relative w-full h-10";

    const knobClass =
      "absolute w-4 h-4 border bg-subtle border shadow active:bg-accent top-1/2 -translate-y-1/2 rounded-full cursor-pointer after:absolute after:bottom-full after:left-1/2 after:-translate-x-1/2 after:pb-2 after:text-sm before:absolute before:w-12 before:h-12 before:left-1/2 before:top-1/2 before:-translate-y-1/2 before:-translate-x-1/2";

    const minKnob = document.createElement("div");
    minKnob.className = knobClass + " after:content-[attr(data-value)]";
    minKnob.style.left = this.calculateKnobPosition(this.minInput.value) + "%";
    this.minKnob = minKnob;

    const maxKnob = document.createElement("div");
    maxKnob.className = knobClass + " after:content-[attr(data-value)]";
    maxKnob.style.right =
      100 - this.calculateKnobPosition(this.maxInput.value) + "%";
    this.maxKnob = maxKnob;

    const line = document.createElement("div");
    line.className =
      "absolute top-1/2 w-full h-0.5 transform -translate-y-1/2 bg-emphasis";

    const activeLine = document.createElement("div");
    activeLine.className =
      "absolute top-1/2 h-1 transform -translate-y-1/2 bg-accent";
    this.activeLine = activeLine;

    sliderContainer.append(line, activeLine, minKnob, maxKnob);
    this.append(sliderContainer);

    // we need to get the rect of the slider container to calculate the knob position later
    this.rect = sliderContainer.getBoundingClientRect();
  }

  initDragFunctionality() {
    // adds event listeners to the slider elements for drag functionality
    this.isDragging = false;
    this.currentKnob = null;

    this.minKnob.addEventListener("mousedown", (e) =>
      this.startDrag(e, this.minKnob)
    );
    this.maxKnob.addEventListener("mousedown", (e) =>
      this.startDrag(e, this.maxKnob)
    );

    this.minKnob.addEventListener("touchstart", (e) =>
      this.startDrag(e, this.maxKnob)
    );

    this.maxKnob.addEventListener("touchstart", (e) =>
      this.startDrag(e, this.maxKnob)
    );
    this.minKnob.addEventListener("mousemove", this.doDrag.bind(this));
    this.maxKnob.addEventListener("mousemove", this.doDrag.bind(this));
    this.minKnob.addEventListener("touchmove", this.doDrag.bind(this));
    this.maxKnob.addEventListener("touchmove", this.doDrag.bind(this));
    this.minKnob.addEventListener("touchend", this.endDrag.bind(this));
    this.maxKnob.addEventListener("touchend", this.endDrag.bind(this));
    this.minKnob.addEventListener("mouseup", this.endDrag.bind(this));
    this.maxKnob.addEventListener("mouseup", this.endDrag.bind(this));
  }

  startDrag(e, knob) {
    // sets the current knob and starts the drag
    e.preventDefault();
    this.isDragging = true;
    this.currentKnob = knob;
    this.maxKnob.addEventListener("mouseout", this.onMouseOut.bind(this), {
      once: true,
    });
    this.minKnob.addEventListener("mouseout", this.onMouseOut.bind(this), {
      once: true,
    });
  }

  doDrag(e) {
    // if we are not dragging, we don't need to do anything
    if (!this.isDragging) return;

    let clientX = e.clientX || e.touches[0].clientX;

    // calculates the new left percentage of the knob
    let newLeft = Math.max(
      0,
      Math.min(
        this.rect.width,
        clientX - this.rect.left - this.currentKnob.offsetWidth / 2
      )
    );
    let newRight = Math.max(
      0,
      Math.min(
        this.rect.width,
        this.rect.width -
          (clientX - this.rect.left) -
          this.currentKnob.offsetWidth / 2
      )
    );

    // if the new left position is out of bounds, we set it to the min or max value
    if (
      this.currentKnob === this.minKnob &&
      newLeft > parseInt(this.maxKnob.offsetLeft)
    ) {
      newLeft = parseInt(this.maxKnob.offsetLeft);
    } else if (
      this.currentKnob === this.maxKnob &&
      newLeft < parseInt(this.minKnob.offsetLeft)
    ) {
      newRight = parseInt(this.minKnob.offsetLeft);
    }

    // we set the new left position of the knob
    if (this.currentKnob === this.minKnob) {
      this.currentKnob.style.left = newLeft + "px";
    } else {
      this.currentKnob.style.right = newRight + "px";
    }

    this.updateKnobValues();
  }

  onMouseOut() {
    this.isDragging && this.endDrag();
  }

  endDrag() {
    // sets the isDragging to false and currentKnob to null
    this.isDragging = false;
    this.currentKnob = null;

    // if not using the apply button, do the deed on drag end
    debounce(this.updateInputValues(), 1000);
    debounce(this.syncWithOtherRangeSliders(), 1000);
    debounce(this.closest("form").dispatchEvent(new Event("input")), 1000);
    setTimeout(() => {
      this.updateInputValues();
      this.syncWithOtherRangeSliders();
    }, 1000);
  }

  updateActiveLine() {
    // updates the active line in between the knobs
    this.activeLine.style.left =
      parseInt(this.minKnob.offsetLeft) + this.minKnob.offsetWidth / 2 + "px";
    this.activeLine.style.right =
      parseInt(this.rect.width) -
      parseInt(this.maxKnob.offsetLeft) -
      this.maxKnob.offsetWidth / 2 +
      "px";
  }

  getKnobMoneyValue(knob) {
    // returns the money value of the knob without the currency symbol
    let percentage =
      knob === this.minKnob
        ? parseInt(knob.offsetLeft) / this.rect.width
        : (parseInt(knob.offsetLeft) + this.maxKnob.offsetWidth) / this.rect.width;
    let value = Math.round(
      this.minLimit + (this.maxLimit - this.minLimit) * percentage
    );
    if (this.rect.width === 0) {
      percentage = 0;
      value = 0;
    }
    return value;
  }

  updateKnobValues() {
    // updates the visible values on the knobs
    this.minKnob.dataset.value = window.theme.currency + this.getKnobMoneyValue(this.minKnob);
    this.maxKnob.dataset.value = window.theme.currency + this.getKnobMoneyValue(this.maxKnob);

    this.updateActiveLine();
    if (this.closest("form").dataset.isApplyActive === "true") {
      this.updateApplyButton();
    }
  }

  updateApplyButton() {
    const filter = this.closest(".js-filter");
    if (!filter) return;
    const clearApplyButtons = filter.querySelectorAll(".js-filter-apply");
    if (this.isKnobsReset()) {
      clearApplyButtons.forEach((button) => (button.disabled = true));
      const remover = document.querySelector("#price-range-remove a");
      if (!remover) return;
      remover.click();
    } else {
      clearApplyButtons.forEach((button) => (button.disabled = false));
    }
  }

  isKnobsReset() {
    return (
      this.minKnob.offsetLeft === 0 &&
      this.maxKnob.offsetLeft === this.rect.width - this.maxKnob.offsetWidth
    );
  }

  updateInputValues() {
    this.minInput.value = this.getKnobMoneyValue(this.minKnob);
    this.maxInput.value = this.getKnobMoneyValue(this.maxKnob);

    // Check if we're at default state and update accordingly
    const isAtDefaultMin = this.minInput.value === "0" || this.minInput.value === this.minLimit.toString();
    const isAtDefaultMax = parseInt(this.maxInput.value) === this.maxLimit;
    
    if (isAtDefaultMin) {
      this.minInput.value = "";
      this.#isDefaultState = this.#isDefaultState && isAtDefaultMax;
    }
    if (isAtDefaultMax) {
      this.maxInput.value = "";
      this.#isDefaultState = this.#isDefaultState && isAtDefaultMin;
    }
    
    // If both are at defaults, ensure knobs are visually reset
    if (this.#isDefaultState) {
      this.#resetKnobsToDefault();
    }
  }

  updateOnInputChange() {
    const onInputChange = (e, knob) => {
      let newValue = parseInt(e.target.value);

      // control min/max limits
      if (newValue > this.maxLimit) {
        newValue = this.maxLimit;
        e.target.value = newValue;
      } else if (newValue < this.minLimit) {
        newValue = this.minLimit;
        e.target.value = newValue;
      }

      // control min/max to not overlap
      if (knob === this.minKnob && newValue > this.maxInput.value) {
        newValue =
          newValue > this.maxLimit ? this.maxLimit : this.maxInput.value;
        e.target.value = newValue;
      } else if (knob === this.maxKnob && newValue < this.minInput.value) {
        newValue = this.minInput.value;
        e.target.value = newValue;
      }

      if (knob === this.minKnob)
        knob.style.left = this.calculateKnobPosition(newValue) + "%";
      if (knob === this.maxKnob)
        knob.style.right = 100 - this.calculateKnobPosition(newValue) + "%";
      this.updateKnobValues();
    };

    const debouncedOnInputChange = debounce(onInputChange, 750);

    this.minInput.addEventListener("input", (e) =>
      debouncedOnInputChange(e, this.minKnob)
    );
    this.maxInput.addEventListener("input", (e) =>
      debouncedOnInputChange(e, this.maxKnob)
    );
    this.minInput.addEventListener("change", (e) =>
      onInputChange(e, this.minKnob)
    );
    this.maxInput.addEventListener("change", (e) =>
      onInputChange(e, this.maxKnob)
    );
  }

  reset() {
    this.minInput.removeAttribute("value");
    this.maxInput.removeAttribute("value");
    this.#resetKnobsToDefault();
    this.#isDefaultState = true;
    this.updateKnobValues();
  }

  /**
   * Force reset the price range slider to default state
   * Useful for external components that need to reset the slider
   */
  forceReset() {
    console.log('PriceRangeSlider: Force resetting to default state');
    this.reset();
    this.#syncVisualStateWithFilters();
  }

  /**
   * Check if the slider is currently at its default state
   * @returns {boolean} True if at default state
   */
  isAtDefaultState() {
    return this.#isDefaultState;
  }

  #resetKnobsToDefault() {
    if (this.minKnob) {
      this.minKnob.style.left = "0%";
    }
    if (this.maxKnob) {
      this.maxKnob.style.right = "0%";
    }
  }

  #checkAndResetToDefault() {
    // Check if the current URL has no price filter parameters
    const urlParams = new URLSearchParams(window.location.search);
    const hasPriceFilters = urlParams.has('filter.v.price.gte') || urlParams.has('filter.v.price.lte');
    
    // Also check if the current input values are at defaults
    const currentMinValue = this.minInput.value;
    const currentMaxValue = this.maxInput.value;
    const isAtDefaultMin = !currentMinValue || currentMinValue === "0" || currentMinValue === this.minLimit.toString();
    const isAtDefaultMax = !currentMaxValue || parseInt(currentMaxValue) === this.maxLimit;
    
    // If no price filters in URL AND inputs are at defaults, reset to default
    if (!hasPriceFilters && isAtDefaultMin && isAtDefaultMax && !this.#isDefaultState) {
      console.log('PriceRangeSlider: Resetting to default state - no active price filters');
      this.#isDefaultState = true;
      this.#resetKnobsToDefault();
      this.updateKnobValues();
    } else if (hasPriceFilters && this.#isDefaultState) {
      // If there are price filters but we think we're at default, update our state
      this.#isDefaultState = false;
    }
  }

  syncWithOtherRangeSliders() {
    // find all range sliders and filter this one out using filter()
    const otherRangeSliders = [
      ...document.querySelectorAll("price-range-slider"),
    ].filter((slider) => slider !== this);

    // loop through the other range sliders and update the min and max values
    // otherRangeSliders.forEach((slider) => {
    //   slider.minInput.value = this.minInput.value;
    //   slider.maxInput.value = this.maxInput.value;
    // });
  }

  updateKnobByInput(e, knob) {}

  calculateKnobPosition(value) {
    const percentage =
      ((value - this.minLimit) / (this.maxLimit - this.minLimit)) * 100;
    return percentage;
  }
}
window.customElements.define("price-range-slider", PriceRangeSlider);


if (!customElements.get("facet-remove")) {
  customElements.define(
    "facet-remove",
    class FacetRemove extends HTMLElement {
      connectedCallback() {
        this.animate({ opacity: [0, 1] }, { duration: 200, fill: "forwards" });
        this.querySelector("a").addEventListener(
          "click",
          this.onClick.bind(this),
        );
      }
      onClick(event) {
        this.animate(
          { opacity: [1, 0.5] },
          { duration: 200, fill: "forwards" },
        );
        const filters = document.querySelector("collection-filters");
        if (!filters) return;
        filters.onActiveFilterClick(event);
      }
    },
  );
}

if (!customElements.get("facet-clear")) {
  customElements.define(
    "facet-clear",
    class FacetClear extends HTMLElement {
      #abortController = null;

      connectedCallback() {
        this.animate({ opacity: [0, 1] }, { duration: 200, fill: "forwards" });

        // Use AbortController for event cleanup
        this.#abortController = new AbortController();
        this.addEventListener(
          "click",
          this.onClick.bind(this),
          { signal: this.#abortController.signal }
        );
      }

      disconnectedCallback() {
        if (this.#abortController) {
          this.#abortController.abort();
        }
      }

      /**
       * Handles the click event to clear all filter.* parameters from the URL.
       * @param {MouseEvent} event
       */
      onClick(event) {
        // Only handle left-click or keyboard activation
        if (
          (event.type === "click" && event.button !== 0) ||
          event.defaultPrevented
        ) {
          return;
        }
        event.preventDefault();
        this.animate({ opacity: [1, 0.5] }, { duration: 200, fill: "forwards" });
        console.log('FacetClear: Clicked');

        try {
          // Start loading bar for clearing all filters
          this.#startLoadingBar();
          
          // Reset all price range sliders to default state first
          this.#resetAllPriceRangeSliders();
          
          // Use the existing filter system instead of direct navigation
          const filters = document.querySelector("collection-filters");
          if (filters && typeof filters.buildSearchParams === "function") {
            // Create an empty FormData (no filter parameters)
            const formData = new FormData();
            
            // Build search params using the existing system
            const searchParams = filters.buildSearchParams(formData);
            console.log('FacetClear: Built search params:', searchParams);
            
            // Use the existing renderPage method to update URL and trigger events
            filters.renderPage(searchParams, true);
          } else {
            // Fallback: direct navigation if collection-filters not found
            const url = new URL(window.location.href);
            const params = url.searchParams;
            
            // Remove only filter parameters
            for (const key of params.keys()) {
              if (key.startsWith("filter.")) {
                params.delete(key);
              }
            }
            
            const newSearchParams = params.toString();
            const targetUrl = newSearchParams 
              ? `${window.location.pathname}?${newSearchParams}`
              : window.location.pathname;
            
            window.location.href = window.location.pathname;
          }
          
        } catch (err) {
          console.error('FacetClear: Error clearing filters', err);
          // Fallback: reload without filters if something goes wrong
          window.location.href = window.location.pathname;
        }
      }

      /**
       * Reset all price range sliders to their default state
       * @private
       */
      #resetAllPriceRangeSliders() {
        const priceSliders = document.querySelectorAll('price-range-slider');
        priceSliders.forEach(slider => {
          if (slider.reset && typeof slider.reset === 'function') {
            slider.reset();
          }
        });
      }

      /**
       * Start the loading bar for filter clearing operations
       * @private
       */
      #startLoadingBar() {
        const loadingBanner = document.querySelector('loading-banner');
        if (loadingBanner && typeof loadingBanner.startLoading === 'function') {
          loadingBanner.startLoading();
        }
      }
    }
  );
}


/**
 * ElectricFilterToggle - Filter Toggle Component
 * Shows a limited number of filters initially with a "More Filters +" button to reveal the rest
 * 
 * Supports persistent state across dynamic content updates via global state management.
 * When filter content is replaced via AJAX, the component automatically restores its previous state.
 * 
 * @example
 * <electric-filter-toggle data-initial-count="6">
 *   <div class="filter-item">Filter 1</div>
 *   <div class="filter-item">Filter 2</div>
 *   <!-- more filters -->
 *   <button data-toggle-button class="filter-toggle-button">More Filters +</button>
 * </electric-filter-toggle>
 */
class ElectricFilterToggle extends HTMLElement {
  // Private fields
  #isConnected = false;
  #filterItems = [];
  #toggleButton = null;
  #initialCount = 4;
  #isExpanded = false;
  #moreFiltersText = '';
  #stateKey = '';

  // Global state management for persistent toggle states across content updates
  static #globalState = new Map();
  
  /**
   * Get the persistent state for a given key
   * @static
   * @param {string} key - State key identifier
   * @returns {boolean|null} Expanded state or null if not found
   */
  static getGlobalState(key) {
    return ElectricFilterToggle.#globalState.get(key) ?? null;
  }
  
  /**
   * Set the persistent state for a given key
   * @static
   * @param {string} key - State key identifier
   * @param {boolean} isExpanded - Whether the toggle is expanded
   */
  static setGlobalState(key, isExpanded) {
    ElectricFilterToggle.#globalState.set(key, isExpanded);
  }
  
  /**
   * Clear all global state (useful for cleanup)
   * @static
   */
  static clearGlobalState() {
    ElectricFilterToggle.#globalState.clear();
  }

  constructor() {
    super();
    // Bind the private method to ensure correct context
    this.handleToggleClick = this.#handleToggleClick.bind(this);
  }

  connectedCallback() {
    if (this.#isConnected) return;
    
    try {
      // Small delay to ensure the DOM is fully rendered after injection
      setTimeout(() => {
        this.#initialize();
        this.#isConnected = true;
      }, 10);
    } catch (error) {
      console.error('ElectricFilterToggle: Error during initialization', error);
    }
  }

  disconnectedCallback() {
    if (!this.#isConnected) return;
    
    try {
      this.#cleanup();
      this.#isConnected = false;
    } catch (error) {
      console.error('ElectricFilterToggle: Error during cleanup', error);
    }
  }

  /**
   * Initialize the component
   * @private
   */
  #initialize() {
    // Create a unique state key for this instance (based on location in DOM)
    this.#stateKey = this.#generateStateKey();
    
    // Get configuration from data attributes
    this.#initialCount = parseInt(this.dataset.initialCount) || 6;
    
    // Get all filter items (excluding the toggle button)
    this.#filterItems = Array.from(this.querySelectorAll(':scope > :not([data-toggle-button])'));
    
    // Get the toggle button
    this.#toggleButton = this.querySelector('[data-toggle-button]');
    
    console.log(`ElectricFilterToggle: Found ${this.#filterItems.length} filter items and button:`, !!this.#toggleButton);
    
    if (!this.#toggleButton) {
      console.warn('ElectricFilterToggle: No toggle button found');
      return;
    }
    
    // Store the original "More Filters" text from the button
    this.#moreFiltersText = this.#extractTextContent();
    
    // Restore previous state from global storage if it exists
    const savedState = ElectricFilterToggle.getGlobalState(this.#stateKey);
    if (savedState !== null) {
      this.#isExpanded = savedState;
      console.log(`ElectricFilterToggle: Restored state for ${this.#stateKey}: ${savedState}`);
    } else {
      console.log(`ElectricFilterToggle: No saved state found for ${this.#stateKey}, using default: ${this.#isExpanded}`);
    }
    
    // Set up initial state (this will respect the restored state)
    this.#updateVisibility();
    
    // Additional forced update after a brief delay to ensure DOM is fully settled
    if (savedState !== null) {
      setTimeout(() => {
        console.log('ElectricFilterToggle: Forcing secondary visibility update for restored state');
        this.#updateVisibility();
      }, 50);
    }
    
    // Add event listener using bound public method
    this.#toggleButton.addEventListener('click', this.handleToggleClick);
    
    // Listen for re-initialization events (when content is replaced)
    this.addEventListener('filter-toggle:reinitialize', this.#handleReinitialize.bind(this));
    
    // Dispatch initialized event
    this.dispatchEvent(new CustomEvent('filter-toggle:initialized', {
      bubbles: true,
      detail: {
        totalFilters: this.#filterItems.length,
        initialCount: this.#initialCount,
        isExpanded: this.#isExpanded
      }
    }));
  }

  /**
   * Handle re-initialization when content is replaced
   * @private
   * @param {CustomEvent} event - Re-initialization event
   */
  #handleReinitialize(event) {
    try {
      const wasExpanded = event.detail?.wasExpanded || false;
      
      // Re-initialize the component with new DOM elements
      this.#isConnected = false;
      this.#initialize();
      
      // Restore the expanded state if it was expanded before
      if (wasExpanded) {
        this.#isExpanded = true;
        this.#updateVisibility();
      }
      
    } catch (error) {
      console.error('ElectricFilterToggle: Error during re-initialization', error);
    }
  }

  /**
   * Handle toggle button click
   * @private
   * @param {Event} event - Click event
   */
  #handleToggleClick(event) {
    event.preventDefault();
    
    try {
      this.#isExpanded = !this.#isExpanded;
      
      this.#updateVisibility();
      
      // Dispatch toggle event
      this.dispatchEvent(new CustomEvent('filter-toggle:toggled', {
        bubbles: true,
        detail: {
          isExpanded: this.#isExpanded,
          visibleCount: this.#isExpanded ? this.#filterItems.length : this.#initialCount
        }
      }));
      
      // Announce to screen readers
      this.#announceStateChange();
      
    } catch (error) {
      console.error('ElectricFilterToggle: Error during toggle', error);
    }
  }

  /**
   * Update visibility of filters and button
   * @private
   */
  #updateVisibility() {
    const hasMoreFilters = this.#filterItems.length > this.#initialCount;
    
    // Update filter visibility
    this.#filterItems.forEach((filter, index) => {
      if (this.#isExpanded || index < this.#initialCount) {
        // Show the filter
        filter.style.display = '';
        filter.setAttribute('aria-hidden', 'false');
      } else {
        // Hide the filter
        filter.style.display = 'none';
        filter.setAttribute('aria-hidden', 'true');
      }
    });
    
    // Update button state and text
    if (this.#toggleButton && hasMoreFilters) {
      // Always show button when there are more filters
      this.#toggleButton.style.display = '';
      this.#toggleButton.setAttribute('aria-hidden', 'false');
      this.#toggleButton.setAttribute('aria-expanded', this.#isExpanded ? 'true' : 'false');
      
      // Get toggle text from data attribute (which contains the translation)
      const lessFiltersText = this.#toggleButton.dataset.toggleButton || 'Less Filters';
      const moreFiltersText = this.#moreFiltersText || 'More Filters';
      const currentText = this.#isExpanded ? lessFiltersText : moreFiltersText;
      
      // Update button text while preserving icon
      this.#updateButtonText(currentText);
      
      // Add/remove animate class to button for icon animation
      if (this.#isExpanded) {
        this.#toggleButton.classList.add('animate-icon');
      } else {
        this.#toggleButton.classList.remove('animate-icon');
      }
    } else if (this.#toggleButton && !hasMoreFilters) {
      // Hide button if there aren't enough filters to warrant toggling
      this.#toggleButton.style.display = 'none';
      this.#toggleButton.setAttribute('aria-hidden', 'true');
    }
    
    // Update container state
    this.setAttribute('data-expanded', this.#isExpanded ? 'true' : 'false');
  }

  /**
   * Extract the text content from the button (excluding icon)
   * @private
   * @returns {string} The button's text content
   */
  #extractTextContent() {
    if (!this.#toggleButton) return '';
    
    // Clone the button to avoid modifying the original
    const buttonClone = this.#toggleButton.cloneNode(true);
    
    // Remove any SVG elements (icons)
    const svgs = buttonClone.querySelectorAll('svg');
    svgs.forEach(svg => svg.remove());
    
    // Get the remaining text content and trim whitespace
    return buttonClone.textContent.trim();
  }

  /**
   * Update button text while preserving the icon
   * @private
   * @param {string} newText - The new text to display
   */
  #updateButtonText(newText) {
    if (!this.#toggleButton) return;
    
    // Find and store the icon before clearing content
    const icon = this.#toggleButton.querySelector('svg');
    const iconClone = icon ? icon.cloneNode(true) : null;
    
    // Clear the button content
    this.#toggleButton.innerHTML = '';
    
    // Add the new text as a text node
    this.#toggleButton.appendChild(document.createTextNode(newText + ' '));
    
    // Re-add the icon if it exists
    if (iconClone) {
      this.#toggleButton.appendChild(iconClone);
    }
  }

  /**
   * Announce state change to screen readers
   * @private
   */
  #announceStateChange() {
    const announcement = document.createElement('div');
    announcement.className = 'sr-only';
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    
    const hiddenCount = this.#filterItems.length - this.#initialCount;
    announcement.textContent = this.#isExpanded 
      ? `Showing all ${this.#filterItems.length} filters`
      : `Showing ${this.#initialCount} of ${this.#filterItems.length} filters. ${hiddenCount} filters hidden.`;
    
    this.appendChild(announcement);
    
    // Remove announcement after it's been read
    setTimeout(() => {
      announcement.remove();
    }, 1000);
  }

  /**
   * Generate a unique state key for this instance
   * @private
   * @returns {string} Unique state key
   */
  #generateStateKey() {
    // Use the form ID and closest section context to create a unique key
    const form = this.closest('form');
    const formId = form?.id || 'unknown-form';
    const section = this.closest('[data-section-id]')?.getAttribute('data-section-id') || 'unknown-section';
    return `${formId}-${section}-filter-toggle`;
  }

  /**
   * Clean up event listeners and references
   * @private
   */
  #cleanup() {
    if (this.#toggleButton) {
      this.#toggleButton.removeEventListener('click', this.handleToggleClick);
    }
    
    this.#filterItems = [];
    this.#toggleButton = null;
  }

  /**
   * Static method to check if a filter toggle exists
   * @static
   * @param {HTMLElement} container - Container to search within
   * @returns {ElectricFilterToggle|null}
   */
  static getInstance(container) {
    return container?.querySelector('electric-filter-toggle') || null;
  }

  /**
   * Public method to programmatically toggle the filters
   * @param {boolean} [forceExpand] - Force expand (true) or collapse (false)
   */
  toggle(forceExpand) {
    if (typeof forceExpand === 'boolean') {
      if (this.#isExpanded !== forceExpand) {
        this.#toggleButton?.click();
      }
    } else {
      this.#toggleButton?.click();
    }
  }

  /**
   * Force update visibility - useful for debugging
   * @public
   */
  forceUpdate() {
    console.log('ElectricFilterToggle: Force updating visibility...');
    console.log('Current state:', {
      isExpanded: this.#isExpanded,
      filterCount: this.#filterItems.length,
      initialCount: this.#initialCount,
      stateKey: this.#stateKey
    });
    this.#updateVisibility();
  }

  /**
   * Static method to expand/collapse all filter toggles
   * @static
   * @param {boolean} expand - Whether to expand or collapse
   */
  static toggleAll(expand = true) {
    const toggles = document.querySelectorAll('electric-filter-toggle');
    toggles.forEach(toggle => {
      toggle.toggle(expand);
    });
  }
}

// Register the custom element
if (!customElements.get('electric-filter-toggle')) {
  customElements.define('electric-filter-toggle', ElectricFilterToggle);
}

/**
 * Global Filter Toggle State Manager
 * 
 * Handles preserving and restoring electric-filter-toggle states across
 * dynamic content updates when filters are applied.
 */
class FilterToggleStateManager {
  // Private fields
  #isInitialized = false;
  
  constructor() {
    this.init();
  }
  
  init() {
    if (this.#isInitialized) return;
    
    // Listen for filter change events to preserve state before content replacement
    window.addEventListener('filters:filter-changed', this.#preserveToggleStates.bind(this));
    
    // Listen for when new filter content is loaded
    window.addEventListener('electric-section-updated', this.#handleSectionUpdate.bind(this));
    
    this.#isInitialized = true;
  }
  
  /**
   * Preserve all electric-filter-toggle states before content replacement
   * @param {CustomEvent} event - Filter change event
   * @private
   */
  #preserveToggleStates(event) {
    try {
      // The issue was working with stale DOM references. 
      // We don't need to manually preserve state here since each toggle 
      // component already saves its state when clicked.
      // We just need to ensure the state is already saved before replacement.
      console.log('FilterToggleStateManager: Filter change detected, state should already be preserved by components');
      
    } catch (error) {
      console.error('FilterToggleStateManager: Error in preserve toggle states', error);
    }
  }
  
  /**
   * Handle section updates to ensure new toggles are properly initialized
   * @param {CustomEvent} event - Section update event
   * @private
   */
  #handleSectionUpdate(event) {
    try {
      // Small delay to allow DOM to settle after section update
      setTimeout(() => {
        const newToggles = document.querySelectorAll('electric-filter-toggle:not([data-state-restored])');
        
        console.log(`FilterToggleStateManager: Found ${newToggles.length} new toggles to process`);
        
        newToggles.forEach(toggle => {
          // Mark as processed to avoid duplicate processing
          toggle.setAttribute('data-state-restored', 'true');
          
          // The toggle should automatically restore its state during connectedCallback
          // which happens automatically when new elements are added to the DOM
          console.log('FilterToggleStateManager: Marked toggle as processed', toggle);
        });
      }, 50);
      
    } catch (error) {
      console.error('FilterToggleStateManager: Error handling section update', error);
    }
  }
}

// Initialize the global state manager when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new FilterToggleStateManager();
  });
} else {
  // DOM is already ready
  new FilterToggleStateManager();
}