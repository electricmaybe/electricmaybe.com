if (!customElements.get("electric-slider")) {
  class ElectricSlider extends HTMLElement {
    constructor() {
      super();
      this.state = {
        isDragging: false,
        wasDragged: false,
        dragThreshold: 10,
        pos: { left: 0, x: 0 },
        isTransitioning: false,
        lastWheelTime: 0
      };
      
      this.observers = [];
      this.eventRegistry = [];
      this.items = [];
      
      // Pre-bind critical methods to avoid repeated binding
      this.dragMove = this.dragMove.bind(this);
      this.dragEnd = this.dragEnd.bind(this);
      this.resetScrollSnap = this.resetScrollSnap.bind(this);
    }

    connectedCallback() {
      try {
        this.cacheElements();
        this.setupObservers();
        this.attachEvents();
        
        // Reset drag state if drag is disabled
        if (this.dataset.drag === "false") {
          this.state.wasDragged = false;
          this.state.isDragging = false;
        }
      } catch (error) {
        console.error('ElectricSlider initialization error:', error);
      }
    }

    disconnectedCallback() {
      this.detachEvents();
      this.disconnectObservers();
      
      // Clean up content update timeout
      if (this.contentUpdateTimeout) {
        clearTimeout(this.contentUpdateTimeout);
        this.contentUpdateTimeout = null;
      }
    }

    get els() {
      const target = this.dataset.id;
      return {
        slider: this.querySelector(".electric-slider__feed") || (() => { throw new Error("Slider feed not found"); })(),
        prevBtn: this.querySelector(`button[aria-label="previous"][data-slider-target="${target}"]`),
        nextBtn: this.querySelector(`button[aria-label="next"][data-slider-target="${target}"]`),
        upBtn: this.querySelector(`button[name="up"][data-slider-target="${target}"]`),
        downBtn: this.querySelector(`button[name="down"][data-slider-target="${target}"]`),
        gradient: this.querySelector("gradient-finish"),
        dots: this.querySelector('.electric-slider__dots'),
        thumbnails: this.querySelector('.electric-slider__thumbnails'),
        sliderBar: this.querySelector(`[data-slider-target="${target}"].electric-slider__bar`),
        verticalBarWrapper: this.querySelector(`.electric-slider__vertical-bar-wrapper[data-slider-target="${target}"]`),
      }
    }

    cacheElements() {
      this.els.prevWrapper = this.els.prevBtn?.parentElement === this ? 
        this.els.prevBtn : this.els.prevBtn?.parentElement;
    }

    attachEvents() {
      const { slider, prevBtn, nextBtn, sliderBar } = this.els;
      
      // Common event handler setup
      // Only prevent clicks if drag is enabled AND was dragged
      if (this.dataset.drag !== "false") {
        this.addEvent(slider, 'click', e => this.state.wasDragged && (e.preventDefault(), e.stopPropagation(), this.state.wasDragged = false), true);
      }
      this.addEvent(slider, 'scroll', () => this.throttleUpdate(), { passive: true });
      
      // Drag events
      if (this.dataset.drag !== "false") {
        this.addEvent(slider, 'mousedown', e => this.startDrag(e));
        if (this.dataset.carouselMode === "fade") {
          this.addEvent(slider, 'touchstart', e => {
            // Store initial touch position
            this.state.initialTouch = {
              x: e.touches[0].clientX,
              y: e.touches[0].clientY,
              time: Date.now()
            };
            
            // Don't prevent default yet, we'll do it in touchmove if needed
            this.startDrag(e, false);
          }, { passive: true });
        }
      }
      
      // Fade mode specific
      if (this.dataset.carouselMode === "fade") {
        this.addEvent(slider, 'wheel', e => this.handleWheel(e), { passive: false });
      }
      
      // Navigation buttons
      this.addEvent(prevBtn, 'click', e => this.handleDirectionClick(e));
      this.addEvent(nextBtn, 'click', e => this.handleDirectionClick(e));
      
      // Vertical navigation buttons
      const { upBtn, downBtn } = this.els;
      this.addEvent(upBtn, 'click', e => this.handleVerticalDirectionClick(e));
      this.addEvent(downBtn, 'click', e => this.handleVerticalDirectionClick(e));
      
      // Listen for product fetch completion events
      this.addEvent(this, 'rebuy-products-loaded', () => this.handleProductsLoaded());
      this.addEvent(this, 'rebuy-shopify-products-loaded', () => this.handleProductsLoaded());
    }
    
    addEvent(element, eventType, handler, options = {}) {
      if (!element) return;
      element.addEventListener(eventType, handler, options);
      this.eventRegistry.push([element, eventType, handler, options]);
    }

    detachEvents() {
      this.eventRegistry.forEach(([element, eventType, handler, options]) => {
        element?.removeEventListener(eventType, handler, options);
      });
      this.eventRegistry = [];
      this.cleanUpGlobalEvents();
    }

    cleanUpGlobalEvents() {
      document.removeEventListener('mousemove', this.dragMove);
      document.removeEventListener('touchmove', this.dragMove);
      document.removeEventListener('mouseup', this.dragEnd);
      document.removeEventListener('mouseleave', this.dragEnd);
      document.removeEventListener('touchend', this.dragEnd);
      document.removeEventListener('touchcancel', this.dragEnd);
    }

    addGlobalEvents(isTouch) {
      const events = isTouch 
        ? [['touchmove', this.dragMove, {passive: false}], ['touchend', this.dragEnd], ['touchcancel', this.dragEnd]]
        : [['mousemove', this.dragMove], ['mouseup', this.dragEnd], ['mouseleave', this.dragEnd]];
      
      events.forEach(([event, handler, options]) => 
        document.addEventListener(event, handler, options));
    }

    setupObservers() {
      const { slider } = this.els;

      // Dynamic content changes
      if (this.dataset.dummy === "true") {
        this.addObserver(new MutationObserver(() => this.initSlider()), 
          slider, { childList: true });
      }
      
      // Content change observer - detects when items are added/removed
      const contentObserver = new MutationObserver((mutations) => {
        let shouldUpdate = false;
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            // Check if any added nodes are slider items
            const addedItems = Array.from(mutation.addedNodes).some(node => 
              node.nodeType === Node.ELEMENT_NODE && 
              (node.classList?.contains('electric-slider__item') || 
               node.querySelector?.('.electric-slider__item'))
            );
            if (addedItems) {
              shouldUpdate = true;
            }
          }
        });
        
        if (shouldUpdate) {
          // Debounce updates to avoid excessive calls
          clearTimeout(this.contentUpdateTimeout);
          this.contentUpdateTimeout = setTimeout(() => {
            this.handleContentChange();
          }, 100);
        }
      });
      
      this.addObserver(contentObserver, slider, { childList: true, subtree: true });
      
      // Resize observer for content dimension changes
      const resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          this.handleContentChange();
        });
      });
      
      this.addObserver(resizeObserver, slider);
      
      // Visibility observer
      const visibilityObserver = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) {
          this.initSlider();
          visibilityObserver.unobserve(slider);
        }
      });
      
      this.addObserver(visibilityObserver, slider);
      
      // Attribute observer for dynamic drag toggle
      const attributeObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'data-drag') {
            this.handleDragAttributeChange();
          }
        });
      });
      
      attributeObserver.observe(this, { attributes: true, attributeFilter: ['data-drag'] });
      this.observers.push({ observer: attributeObserver, target: this, options: { attributes: true, attributeFilter: ['data-drag'] } });
    }
    
    addObserver(observer, target, options = {}) {
      observer.observe(target, options);
      this.observers.push({ observer, target, options });
    }
    
    /**
     * Handle dynamic changes to the data-drag attribute
     * @private
     */
    handleDragAttributeChange() {
      const isDragDisabled = this.dataset.drag === "false";
      
      // Reset drag state when drag is disabled
      if (isDragDisabled) {
        this.state.wasDragged = false;
        this.state.isDragging = false;
        
        // Clean up any active drag operations
        this.cleanUpGlobalEvents();
      }
    }
    
    /**
     * Handle product fetch completion events
     * Updates navigation visibility and edge states when products are dynamically loaded
     * @private
     */
    handleProductsLoaded() {
      // Wait a brief moment for DOM to update with new products
      requestAnimationFrame(() => {
        // Re-cache items if they've changed
        const { slider } = this.els;
        if (slider) {
          const newItems = slider.querySelector(".electric-slider__feed > *.contents") 
            ? this.querySelectorAll(".electric-slider__feed .contents > *") 
            : this.querySelectorAll(".electric-slider__feed > *");
          
          if (newItems.length !== this.items?.length) {
            this.handleContentChange();
          } else {
            // Just update UI state
            this.updateUI();
            this.updateEdgeStates();
          }
        }
      });
    }
    
    /**
     * Handle content changes (items added/removed)
     * @private
     */
    handleContentChange() {
      const { slider } = this.els;
      
      // Re-cache slider items
      this.items = slider.querySelector(".electric-slider__feed > *.contents") 
        ? this.querySelectorAll(".electric-slider__feed .contents > *") 
        : this.querySelectorAll(".electric-slider__feed > *");
      
      if (!this.items.length) return;
      
      // Wait for elements to be properly rendered before finding first/last
      requestAnimationFrame(() => {
        // Find first and last visible elements (don't mutate original array)
        const itemsArray = [...this.items];
        this.firstEl = itemsArray.map(item => this.#getFirstChildWithWidth(item)).find(el => el);
        this.lastEl = [...itemsArray].reverse().map(item => this.#getLastChildWithWidth(item)).find(el => el);
        
        // If elements still don't have width, wait a bit more
        if (!this.firstEl || !this.lastEl || this.firstEl.clientWidth === 0 || this.lastEl.clientWidth === 0) {
          setTimeout(() => {
            this.firstEl = itemsArray.map(item => this.#getFirstChildWithWidth(item)).find(el => el);
            this.lastEl = [...itemsArray].reverse().map(item => this.#getLastChildWithWidth(item)).find(el => el);
            
            if (this.firstEl && this.lastEl) {
              this.setupEdgeDetection();
              this.updateUI();
              this.updateEdgeStates();
            }
          }, 100);
          return;
        }
        this.setupEdgeDetection();
        
        // Update UI state
        this.updateUI();
        
        // Update edge states after content change
        this.updateEdgeStates();
      });
    }
    
    /**
     * Handle content resize events
     * @private
     */
    handleContentResize() {
      // Only update if slider is already initialized
      if (!this.items?.length) return;
      
      // Re-cache first and last elements in case they changed
      const itemsArray = [...this.items];
      this.firstEl = itemsArray.map(item => this.#getFirstChildWithWidth(item)).find(el => el);
      this.lastEl = [...itemsArray].reverse().map(item => this.#getLastChildWithWidth(item)).find(el => el);
      
      // Update UI state
      this.updateUI();
      
      // Update edge states after resize
      setTimeout(() => this.updateEdgeStates(), 50);
    }
    
    createObserver(callback, options = {}) {
      return new IntersectionObserver(callback, options);
    }
    
    disconnectObservers() {
      this.observers.forEach(({ observer }) => observer.disconnect());
      this.observers = [];
    }

    /**
     * Get the first child element with actual width, handling display: contents
     * @param {Element} element - Element to check
     * @returns {Element|null} First child with width > 0, or null
     * @private
     */
    #getFirstChildWithWidth(element) {
      if (!element) return null;
      
      // Check if element itself has width
      if (element.clientWidth > 0) return element;
      
      // Check if element has display: contents
      const computedStyle = window.getComputedStyle(element);
      if (computedStyle.display === 'contents') {
        // Recursively check first child
        const firstChild = element.firstElementChild;
        if (firstChild) {
          return this.#getFirstChildWithWidth(firstChild);
        }
      }
      
      return null;
    }

    /**
     * Get the last child element with actual width, handling display: contents
     * @param {Element} element - Element to check
     * @returns {Element|null} Last child with width > 0, or null
     * @private
     */
    #getLastChildWithWidth(element) {
      if (!element) return null;
      
      // Check if element itself has width
      if (element.clientWidth > 0) return element;
      
      // Check if element has display: contents
      const computedStyle = window.getComputedStyle(element);
      if (computedStyle.display === 'contents') {
        // Recursively check last child
        const lastChild = element.lastElementChild;
        if (lastChild) {
          return this.#getLastChildWithWidth(lastChild);
        }
      }
      
      return null;
    }

    initSlider() {
      const { slider, sliderBar, dots, thumbnails } = this.els;

      // attempts to check if slider is loaded late
      if (!slider.clientWidth) {
        let attempts = 0;
        const maxAttempts = 10;
        
        const tryInit = () => {
          if (attempts >= maxAttempts) return;
          attempts++;
          
          setTimeout(() => {
            if (!slider.clientWidth) {
              tryInit();
            } else {
              this.initSlider();
            }
          }, 100);
        };
        
        tryInit();
        return;
      }

      
      // Cache slider items
      this.items = slider.querySelector(".electric-slider__feed > *.contents") 
        ? this.querySelectorAll(".electric-slider__feed .contents > *") 
        : this.querySelectorAll(".electric-slider__feed > *");
      
      if (!this.items.length) return;

      // Find first and last visible elements
      const itemsArray = [...this.items];
      this.firstEl = itemsArray.map(item => this.#getFirstChildWithWidth(item)).find(el => el);
      this.lastEl = [...itemsArray].reverse().map(item => this.#getLastChildWithWidth(item)).find(el => el);
      
      if (!this.firstEl || !this.lastEl) return;

      if (sliderBar) {
        // Initialize progress bar at 10% minimum
        sliderBar.style.setProperty('--slider-bar-progress', '0.1');
      }
            
      this.currentIndex = 0;

      if (dots) {
        [...dots.children].forEach((dot, index) => {
          dot.dataset.active = index === 0 ? 'true' : 'false';
          this.addEvent(dot, 'click', () => this.navigateSlider(index, 'instant'));
        });
      }

      if (thumbnails) {
        [...thumbnails.children].forEach((thumbnail, index) => {
          thumbnail.dataset.active = index === 0 ? 'true' : 'false';
          this.addEvent(thumbnail, 'click', () => this.navigateSlider(index, 'instant'));
        });
      }

      // Set up carousel modes
      this.setupSliderMode();

      // Setup edge detection
      this.setupEdgeDetection();
      
      // Initialize UI state
      this.updateUI();
      
      // Ensure edge states are correct after initialization
      setTimeout(() => this.updateEdgeStates(), 100);
    }
    
    setupSliderMode() {
      if (this.dataset.carouselMode === "fade") {
        this.setupFadeMode();
      } else if (this.dataset.carouselMode === "slide") {
        this.setupSlideMode();
      }
    }
    
    setupEdgeDetection() {
      const { slider } = this.els;
      
      // Use scroll-based edge detection for more reliable results
      this.addEvent(slider, 'scroll', () => this.updateEdgeStates(), { passive: true });
      
      // Initial edge state update
      this.updateEdgeStates();
      
      // Fallback intersection observer for additional reliability
      const options = { 
        threshold: [0, 0.1, 0.9, 1], 
        root: slider,
        rootMargin: '0px -1px 0px -1px' // Small margin to account for sub-pixel rendering
      };
      
      this.startObserver = this.createObserver(entries => {
        const entry = entries[0];
        const isAtStart = entry.intersectionRatio >= 0.99;
        this.els.prevBtn?.toggleAttribute("disabled", isAtStart);
        this.updateNavVisibility();
      }, options);
      
      this.endObserver = this.createObserver(entries => {
        const entry = entries[0];
        const isAtEnd = entry.intersectionRatio >= 0.99;
        this.els.nextBtn?.toggleAttribute("disabled", isAtEnd);
        this.updateNavVisibility();
      }, options);
      
      // Observer to manage activation
      this.elementObserver = this.createObserver(entries => {
        if (entries[0].isIntersecting) {
          if (this.firstEl) this.startObserver.observe(this.firstEl);
          if (this.lastEl) this.endObserver.observe(this.lastEl);
        } else {
          if (this.firstEl) this.startObserver.unobserve(this.firstEl);
          if (this.lastEl) this.endObserver.unobserve(this.lastEl);
        }
      }, { threshold: 0.1 });
      
      this.elementObserver.observe(slider);
    }
    
    setupFadeMode() {
      const { slider } = this.els;
      
      slider.style.position = 'relative';
      slider.style.overflow = 'hidden';
      
      this.items.forEach(item => {
        item.style.position = 'absolute';
        item.style.inset = '0';
      });
    }
    
    setupSlideMode() {
      const { slider, sliderBar } = this.els;
      
      // Clone the first element and add it as the last item to create an infinite loop effect
      const clonedFirstElement = this.firstEl.cloneNode(true);
      clonedFirstElement.classList.add('cloned-slide');
      slider.appendChild(clonedFirstElement);
      
      // Set up intersection observer to detect when the clone is in view
      const firstCloneObserver = this.createObserver(entries => {
        if (entries[0].isIntersecting && !this.state.isTransitioning) {
          this.state.isTransitioning = true;
          slider.scrollTo({ left: slider.clientWidth, behavior: 'instant' });
          setTimeout(() => { this.state.isTransitioning = false; }, 50);
        }
      }, { threshold: 1.0, root: slider });
      
      firstCloneObserver.observe(clonedFirstElement);
      this.observers.push({ observer: firstCloneObserver, target: clonedFirstElement, options: { threshold: 1.0, root: slider } });

      // Clone the last element and add it as the first item
      const clonedLastElement = this.lastEl.cloneNode(true);
      clonedLastElement.classList.add('cloned-slide');
      slider.insertBefore(clonedLastElement, slider.firstChild);
      slider.scrollTo({ left: slider.clientWidth, behavior: 'instant' });

      const lastCloneObserver = this.createObserver(entries => {
        if (entries[0].isIntersecting && !this.state.isTransitioning) {
          this.state.isTransitioning = true;
          slider.scrollTo({ left: slider.scrollWidth - (2 * slider.clientWidth), behavior: 'instant' });
          setTimeout(() => { this.state.isTransitioning = false; }, 50);
        }
      }, { threshold: 1.0, root: slider });
      
      lastCloneObserver.observe(clonedLastElement);
      this.observers.push({ observer: lastCloneObserver, target: clonedLastElement, options: { threshold: 1.0, root: slider } });

      if (sliderBar) {
        this.cloneSliderBar = sliderBar.cloneNode(true);
        this.cloneSliderBar.style.transform = `translateX(calc(var(--slider-bar-clone-position) - var(--slider-bar-width)))`;
        this.cloneSliderBar.style.willChange = 'transform';
        sliderBar.parentElement.appendChild(this.cloneSliderBar);
      }
    }

    updateUI() {
      this.updateGradient();
      this.updateScrollability();
      this.updateSliderBar();
      this.updateVerticalBar();
      this.updateEdgeStates();
    }

    updateGradient() {
      const { gradient, slider } = this.els;
      
      if (gradient && this.items?.[0]) {
        const height = this.items[0].clientHeight || 0;
        slider.style.setProperty("--gradient-height", `${height}px`);
      }
    }

    updateScrollability() {
      const { slider, nav, sliderBar, dots, thumbnails, prevBtn, nextBtn, verticalBarWrapper } = this.els;
      const isHidden = this.dataset.carouselMode === "fade" ? this.items.length <= 1 : slider.scrollWidth <= slider.clientWidth;
      nav?.classList.toggle("hidden", isHidden);
      sliderBar?.parentElement?.classList.toggle("hidden", isHidden);
      dots?.classList.toggle("hidden", isHidden);
      thumbnails?.classList.toggle("hidden", isHidden);
      prevBtn?.classList.toggle("hidden", isHidden);
      nextBtn?.classList.toggle("hidden", isHidden);
      
      // Vertical bar visibility is handled in updateVerticalBar() method
      // since it depends on vertical scrollability, not horizontal
    }

    updateNavVisibility() {
      const { prevBtn, nextBtn, prevWrapper, sliderBar } = this.els;
      
      if (!prevBtn || !nextBtn) return;
      
      const isHidden = prevBtn.hasAttribute("disabled") && nextBtn.hasAttribute("disabled");
      prevWrapper?.classList.toggle("opacity-0", isHidden);
    }

    /**
     * Update edge states based on scroll position - more reliable than intersection observer alone
     * @private
     */
    updateEdgeStates() {
      const { slider, prevBtn, nextBtn } = this.els;
      if (!slider || (!prevBtn && !nextBtn)) return;
      
      // Handle different carousel modes
      if (this.dataset.carouselMode === "fade") {
        this.updateFadeEdgeStates();
        return;
      }
      
      // Calculate scroll boundaries with tolerance for sub-pixel precision
      const tolerance = 2; // 2px tolerance for edge detection
      const scrollLeft = Math.round(slider.scrollLeft);
      const maxScrollLeft = Math.round(slider.scrollWidth - slider.clientWidth);
      
      // Account for slide mode offset (cloned elements)
      const startOffset = this.dataset.carouselMode === "slide" ? slider.clientWidth : 0;
      const adjustedScrollLeft = scrollLeft - startOffset;
      const adjustedMaxScroll = maxScrollLeft - (this.dataset.carouselMode === "slide" ? slider.clientWidth : 0);
      
      // Update button states
      const isAtStart = adjustedScrollLeft <= tolerance;
      const isAtEnd = adjustedScrollLeft >= (adjustedMaxScroll - tolerance);
      
      prevBtn?.toggleAttribute("disabled", isAtStart);
      nextBtn?.toggleAttribute("disabled", isAtEnd);
      
      this.updateNavVisibility();
    }

    /**
     * Update edge states for fade mode carousel
     * @private
     */
    updateFadeEdgeStates() {
      const { prevBtn, nextBtn } = this.els;
      const currentIdx = this.currentIndex;
      const totalSlides = this.items.length;
      
      // In fade mode, disable based on current index
      prevBtn?.toggleAttribute("disabled", currentIdx === 0);
      nextBtn?.toggleAttribute("disabled", currentIdx === totalSlides - 1);
      
      this.updateNavVisibility();
    }

    handleWheel(e) {
      if (this.dataset.carouselMode !== "fade" || 
          Math.abs(e.deltaX) <= Math.abs(e.deltaY) || 
          Math.abs(e.deltaX) < 1 ||
          this.state.isTransitioning || 
          (Date.now() - this.state.lastWheelTime) < 200) return;
      
      e.preventDefault();
      
      this.state.lastWheelTime = Date.now();
      this.state.isTransitioning = true;
      
      const direction = e.deltaX > 0 ? 1 : -1;
      this.navigateSlider(this.currentIndex + direction);
      
      setTimeout(() => { this.state.isTransitioning = false; }, 800);
    }

    //amk currentindexi ilk basta set olamiyor dataset active falan olmadigi icin
    get currentIndex() {
      return [...this.items].findIndex(item => item.dataset.active === 'true') || 0;
    }

    set currentIndex(index) {
      this.items.forEach(item => item.dataset.active = 'false');
      this.items[index].dataset.active = 'true';
      this.updateNavs(index)
    }

    updateNavs(targetIndex) {
      // Update dots
      if (this.els.dots) {
        const dots = [...this.els.dots.children];
        dots.forEach(dot => dot.dataset.active = 'false');
        dots[targetIndex].dataset.active = 'true';
      }

      // Update thumbnails
      if (this.els.thumbnails) {
        const thumbnails = [...this.els.thumbnails.children];
        thumbnails.forEach(thumbnail => thumbnail.dataset.active = 'false');
        thumbnails[targetIndex].dataset.active = 'true';
      }

      this.updateSliderBar()
    }

    handleDirectionClick(event) {
      event.preventDefault();
      const { slider } = this.els;
      const { clientWidth } = this.values;
      const direction = event.currentTarget.name === "next" ? 1 : -1;
      const step = this.dataset.sliderStepBy === "page" 
      ? clientWidth || 0
      : this.firstEl?.clientWidth || 0;

      if(step) {
        slider.scrollTo({
          left: slider.scrollLeft + (direction * step),
          behavior: 'smooth'
        });
      }
    }

    /**
     * Handle vertical navigation button clicks
     * Scrolls the slider vertically when up/down buttons are clicked
     * @param {Event} event - Click event from vertical navigation button
     * @private
     */
    handleVerticalDirectionClick(event) {
      event.preventDefault();
      const { slider } = this.els;
      const direction = event.currentTarget.name === "down" ? 1 : -1;
      const clientHeight = slider.clientHeight;
      const step = clientHeight || 0;

      if (step) {
        slider.scrollTo({
          top: slider.scrollTop + (direction * step),
          behavior: 'smooth'
        });
      }
    }

    navigateSlider(index, behavior = 'smooth') {
      const { slider } = this.els;
      const { clientWidth } = this.values;
      
      if (this.dataset.carouselMode === "fade") {
        const totalSlides = this.items.length;
        if (index < 0) index = totalSlides - 1;
        if (index >= totalSlides) index = 0;
      } else {
        const step = this.dataset.sliderStepBy === "page" 
          ? clientWidth || 0
          : this.firstEl?.clientWidth || 0;
          
        if (step) {
          const targetScrollLeft = (index + (this.dataset.carouselMode === "slide" ? 1 : 0)) * step;
          
          if (behavior === 'instant') {
            // Disable smooth scrolling CSS for instant navigation
            // This overrides the scroll-smooth Tailwind class
            slider.style.scrollBehavior = 'auto';
            slider.style.scrollSnapType = 'none';
            
            // Force a reflow to ensure style changes take effect before scrolling
            void slider.offsetHeight;
            
            // Direct assignment for truly instant navigation
            slider.scrollLeft = targetScrollLeft;
            
            // Update UI immediately after instant scroll
            requestAnimationFrame(() => {
              this.updateSliderBar();
              this.updateEdgeStates();
              // Restore smooth scrolling and scroll snap by removing inline styles
              slider.style.scrollBehavior = '';
              slider.style.scrollSnapType = '';
            });
          } else {
            // Use scrollTo for smooth scrolling
            slider.scrollTo({
              left: targetScrollLeft,
              behavior: behavior
            });
          }
        }
      }

      this.currentIndex = index;
      
      // Update edge states after navigation (only for smooth scrolling)
      if (behavior !== 'instant') {
        setTimeout(() => this.updateEdgeStates(), 50);
      }
    }

    shouldStartDrag(e) {
      const isTouchEvent = e.type.includes('touch');
      const clientX = isTouchEvent ? e.touches[0].clientX : e.clientX;
      const { slider } = this.els;
      
      // Store initial position
      this.state.initialPos = {
        left: slider.scrollLeft,
        x: clientX
      };
      
      return true;
    }

    startDrag(e, preventDefault = true) {
      if (this.state.isDragging) return;
      
      const isTouchEvent = e.type.includes('touch');
      // Return early if it's a touch event but not in carousel mode
      if (isTouchEvent && !this.dataset.carouselMode) return;
      
      const clientX = isTouchEvent ? e.touches[0].clientX : e.clientX;
      const { slider } = this.els;
      
      this.state = {
        ...this.state,
        isDragging: true,
        wasDragged: false,
        pos: {
          left: slider.scrollLeft,
          x: clientX
        }
      };
      
      // Disable smooth scrolling during drag
      slider.style.scrollBehavior = "auto";
      slider.style.scrollSnapType = "none";
      
      this.addGlobalEvents(isTouchEvent);
    }

    dragMove(e) {
      if (!this.state.isDragging) return;
      
      const isTouchEvent = e.type.includes('touch');
      if (isTouchEvent) {
        // Check if we've moved enough to consider this a drag
        const touch = e.touches[0];
        const dx = Math.abs(touch.clientX - this.state.initialTouch.x);
        const dy = Math.abs(touch.clientY - this.state.initialTouch.y);
        const timeDiff = Date.now() - this.state.initialTouch.time;
        
        // If we've moved enough horizontally and not too much vertically, prevent default
        if (dx > 10 && dy < 20 && timeDiff < 300) {
          e.preventDefault();
        }
      }
      
      const clientX = isTouchEvent ? e.touches[0].clientX : e.clientX;
      const { pos, dragThreshold } = this.state;
      const dx = clientX - pos.x;
      
      if (Math.abs(dx) <= dragThreshold) {
        return;
      }
      this.state.wasDragged = true;
      
      if (this.dataset.carouselMode === "fade") {
        this.dragDistance = dx;
        return;
      }
      
      const { slider } = this.els;
      slider.scrollLeft = pos.left - dx;
      this.updateSliderBar();
    }

    dragEnd() {
      if (!this.state.isDragging) return;
      
      this.state.isDragging = false;
      
      // Remove all event listeners
      this.cleanUpGlobalEvents();
      
      const { slider } = this.els;
      
      if (this.dataset.carouselMode === "fade") {
        if (Math.abs(this.dragDistance) > this.state.dragThreshold) {
          const direction = this.dragDistance < 0 ? 1 : -1;
          this.navigateSlider(this.currentIndex + direction);
        }
        this.dragDistance = 0;
        return;
      }

      if (!this.state.wasDragged) return;
      
      const direction = slider.scrollLeft > this.state.pos.left ? "right" : "left";
      const target = this.findSnapPoint({
        currentScrollLeft: slider.scrollLeft,
        dragDirection: direction,
        by: 'page'
      });
      
      slider.scrollTo({ left: target, behavior: 'smooth' });
      slider.addEventListener('wheel', this.resetScrollSnap);
      
      // Update edge states after drag end
      setTimeout(() => this.updateEdgeStates(), 100);
    }

    resetScrollSnap() {
      setTimeout(() => {
        const { slider } = this.els;
        slider.style.scrollSnapType = "x mandatory";
        slider.style.scrollBehavior = "smooth";
        slider.removeEventListener('wheel', this.resetScrollSnap);
      }, 100);
    }

    findSnapPoint({currentScrollLeft, dragDirection, by = 'page' }) {
      const { slider } = this.els;
      let targetScrollLeft = currentScrollLeft;
      let closestDiff = Infinity;
      
      const padding = parseInt(getComputedStyle(slider).scrollPaddingLeft) || 0;
      const gap = parseInt(getComputedStyle(slider).gap) || 0;
      
      if (by === 'item') {
        for (const item of slider.children) {
          const itemLeft = item.offsetLeft - padding;
          const diff = itemLeft - currentScrollLeft;
          const absDiff = Math.abs(diff);
          
          if ((dragDirection === "right" && diff >= 0) || 
              (dragDirection === "left" && diff <= 0) || 
              diff === 0) {
            if (absDiff < closestDiff) {
              closestDiff = absDiff;
              targetScrollLeft = itemLeft;
            }
          }
        }
      } else if (by === 'page') {
        const times = currentScrollLeft / slider.clientWidth;
        targetScrollLeft = (slider.clientWidth - padding - padding + gap) * (dragDirection === "right" ? Math.ceil(times) : Math.floor(times))
      }

      return Math.max(0, Math.min(targetScrollLeft, slider.scrollWidth - slider.clientWidth));
    }

    get values() {
      const { slider } = this.els;
      const scrollPaddingLeft = parseInt(getComputedStyle(slider).scrollPaddingLeft) || 0;
      const scrollPaddingRight = parseInt(getComputedStyle(slider).scrollPaddingRight) || 0;
      const paddingRight = parseInt(getComputedStyle(slider).paddingRight) || 0;
      const paddingLeft = parseInt(getComputedStyle(slider).paddingLeft) || 0;
      const gap = parseInt(getComputedStyle(slider).gap) || 0;
      const totalPadding = scrollPaddingLeft + scrollPaddingRight + paddingRight + paddingLeft;
      const clientWidth = slider.clientWidth - totalPadding + gap;
      const scrollWidth = this.dataset.carouselMode === "slide" 
        ? slider.scrollWidth - (2 * clientWidth) - totalPadding 
        : slider.scrollWidth - totalPadding;
      const scrollable = scrollWidth - clientWidth;

      return {
        scrollPaddingLeft,
        scrollPaddingRight,
        clientWidth,
        scrollWidth,
        scrollable
      };
    }

    throttleUpdate() {
      requestAnimationFrame(() => {
        this.updateSliderBar();
        this.updateVerticalBar();
        this.updateCurrentIndexFromScroll();
      });
    }

    /**
     * Update current index based on scroll position
     * This ensures dots and navigation stay in sync with manual scrolling
     * @private
     */
    updateCurrentIndexFromScroll() {
      const { slider } = this.els;
      if (!slider || !this.items.length) return;

      const { clientWidth } = this.values;
      const scrollLeft = slider.scrollLeft;
      
      // Account for slide mode offset (cloned elements)
      const startOffset = this.dataset.carouselMode === "slide" ? clientWidth : 0;
      const adjustedScrollLeft = scrollLeft - startOffset;

      let newIndex = 0;

      if (this.dataset.sliderStepBy === "page") {
        // Calculate index based on page width
        const step = clientWidth || 0;
        if (step > 0) {
          newIndex = Math.round(adjustedScrollLeft / step);
        }
      } else {
        // Calculate index based on item positions
        const padding = parseInt(getComputedStyle(slider).scrollPaddingLeft) || 0;
        let closestIndex = 0;
        let closestDistance = Infinity;

        this.items.forEach((item, index) => {
          const itemLeft = item.offsetLeft - padding;
          const distance = Math.abs(itemLeft - adjustedScrollLeft);
          
          if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = index;
          }
        });

        newIndex = closestIndex;
      }

      // Clamp index to valid range
      const maxIndex = this.items.length - 1;
      newIndex = Math.max(0, Math.min(newIndex, maxIndex));

      // Only update if index actually changed to avoid unnecessary updates
      if (newIndex !== this.currentIndex) {
        // Update items' data-active without triggering setter (to avoid circular updates)
        this.items.forEach((item, index) => {
          item.dataset.active = index === newIndex ? 'true' : 'false';
        });
        
        // Update dots and thumbnails directly
        this.updateNavs(newIndex);
      }
    }

    updateSliderBar() {
      const { slider, sliderBar } = this.els;
      if (!sliderBar || slider.scrollWidth === 0) return;

      const { scrollable, clientWidth } = this.values;
      
      // Calculate progress as 0.1-1 value (minimum 10% width)
      const scrollLeft = slider.scrollLeft - (this.dataset.carouselMode === "slide" ? clientWidth : 0);
      const rawProgress = scrollable > 0 ? Math.max(0, Math.min(1, scrollLeft / scrollable)) : 0;
      const progress = 0.1 + (rawProgress * 0.9); // Scale from 10% to 100%

      // Set progress for scaleX transform (progress bar grows from left)
      sliderBar.style.setProperty('--slider-bar-progress', progress);
    }

    /**
     * Update vertical scrollbar indicator
     * Shows a vertical progress bar when the slider is vertically scrollable
     * Updates button states based on scroll position
     * @private
     */
    updateVerticalBar() {
      const { slider, verticalBarWrapper, upBtn, downBtn } = this.els;
      if (!verticalBarWrapper) return;

      // Get the actual track element for accurate height calculations
      const track = verticalBarWrapper.querySelector('.electric-slider__vertical-bar-track');
      if (!track) return;

      // Wait for track to have dimensions if not yet initialized
      const trackHeight = track.clientHeight;
      if (trackHeight === 0) {
        requestAnimationFrame(() => this.updateVerticalBar());
        return;
      }

      // Check if slider is vertically scrollable
      const scrollHeight = slider.scrollHeight;
      const clientHeight = slider.clientHeight;
      const computedStyle = window.getComputedStyle(slider);
      const overflowY = computedStyle.overflowY;
      
      // Only show vertical bar if content overflows and vertical scrolling is enabled
      const isVerticallyScrollable = scrollHeight > clientHeight && 
        (overflowY === 'scroll' || overflowY === 'auto' || overflowY === 'overlay');
      
      if (!isVerticallyScrollable) {
        verticalBarWrapper.style.opacity = '0';
        verticalBarWrapper.style.pointerEvents = 'none';
        upBtn?.toggleAttribute("disabled", true);
        downBtn?.toggleAttribute("disabled", true);
        return;
      }

      // Show the vertical bar and enable interactions
      verticalBarWrapper.style.opacity = '1';
      verticalBarWrapper.style.pointerEvents = 'auto';
      
      // Ensure buttons are interactive
      if (upBtn) upBtn.style.pointerEvents = 'auto';
      if (downBtn) downBtn.style.pointerEvents = 'auto';

      // Calculate vertical scroll metrics
      const scrollTop = slider.scrollTop;
      const scrollableHeight = scrollHeight - clientHeight;

      // Calculate the height of the vertical bar (proportional to visible area)
      const barHeightPercent = (clientHeight / scrollHeight) * 100;
      
      // Set the height first so we can read the actual rendered height
      verticalBarWrapper.style.setProperty('--vertical-bar-height', `${barHeightPercent}%`);
      
      // Get the fill element to read its actual rendered height
      const fill = track.querySelector('.electric-slider__vertical-bar-fill');
      let thumbHeight = 0;
      
      if (fill) {
        // Force a reflow to ensure the percentage height is applied
        void fill.offsetHeight;
        // Read the actual computed height, accounting for any rounding
        thumbHeight = fill.getBoundingClientRect().height || (barHeightPercent / 100) * trackHeight;
      } else {
        // Fallback to calculated height if fill element not found
        thumbHeight = (barHeightPercent / 100) * trackHeight;
      }
      
      // Calculate the maximum position the thumb can reach without overflowing
      // Subtract thumb height to ensure the bottom edge of thumb stays within track bounds
      const maxPosition = Math.max(0, trackHeight - thumbHeight);
      
      // Calculate scroll progress (0 to 1)
      const scrollProgress = scrollableHeight > 0 ? Math.min(1, Math.max(0, scrollTop / scrollableHeight)) : 0;
      
      // Calculate the thumb position, clamped to prevent overflow
      const barPosition = Math.min(Math.max(0, scrollProgress * maxPosition), maxPosition);

      // Update position CSS variable
      verticalBarWrapper.style.setProperty('--vertical-bar-position', `${barPosition}px`);

      // Update button states based on scroll position
      const tolerance = 2; // 2px tolerance for edge detection
      const isAtTop = scrollTop <= tolerance;
      const isAtBottom = scrollTop >= (scrollableHeight - tolerance);

      upBtn?.toggleAttribute("disabled", isAtTop);
      downBtn?.toggleAttribute("disabled", isAtBottom);
    }
  }

  customElements.define("electric-slider", ElectricSlider);
}