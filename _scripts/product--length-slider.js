/**
 * Length Slider Component
 * 
 * Single-value range slider for selecting product length variants.
 * Controls hidden radio buttons to maintain compatibility with variant-radios component.
 * Filters available lengths based on currently selected variant combination.
 */

if (!customElements.get('length-slider')) {
  class LengthSlider extends HTMLElement {
    #abortController;
    #mutationObserver;
    #rangeInput;
    #radioInputs;
    #selectedOption;
    #markers;
    #isUpdating = false; // Flag to prevent recursive updates
    
    constructor() {
      super();
      this.#abortController = new AbortController();
    }
    
    connectedCallback() {
      const signal = { signal: this.#abortController.signal };
      
      // Cache DOM references
      this.#rangeInput = this.querySelector('input[type="range"].length-range-slider');
      this.#radioInputs = [...this.querySelectorAll('input[type="radio"].length-radio')];
      this.#selectedOption = this.querySelector('._selectedOption');
      this.#markers = [...this.querySelectorAll('.length-marker')];
      
      if (!this.#rangeInput || this.#radioInputs.length === 0) {
        console.warn('LengthSlider: Missing required elements');
        return;
      }

      const checkedIndex = this.#radioInputs.findIndex((radio) => radio.checked);
      if (checkedIndex >= 0) {
        this.#rangeInput.value = checkedIndex;
      }
      
      // Initialize visual state
      this.#updateVisualState();

      this.#mutationObserver = new MutationObserver(() => {
        const checkedIndex = this.#radioInputs.findIndex((radio) => radio.checked);
        if (checkedIndex >= 0 && parseInt(this.#rangeInput.value) !== checkedIndex) {
          this.#rangeInput.value = checkedIndex;
        }
        this.#updateVisualState();
      });

      this.#mutationObserver.observe(this, {
        subtree: true,
        attributes: true,
        attributeFilter: ['checked', 'available', 'disabled']
      });
      
      // Range slider input handler - apply selection immediately for live price updates.
      this.#rangeInput.addEventListener('input', (e) => {
        const index = parseInt(e.target.value);
        if (index < 0 || index >= this.#radioInputs.length) {
          return;
        }

        this.#handleSliderChange(index, true);
      }, signal);
      
      // Change still fires on release; keep it visual-only to avoid duplicate variant cascades.
      this.#rangeInput.addEventListener('change', (e) => {
        const index = parseInt(e.target.value);
        if (index < 0 || index >= this.#radioInputs.length) {
          return;
        }
        this.#updateVisualState();
      }, signal);
      
      // Radio button change handler - sync slider when radio changes externally
      // Only update if the change came from outside (not from our slider)
      this.#radioInputs.forEach((radio, index) => {
        radio.addEventListener('change', (e) => {
          // Prevent recursive updates - if we're updating, ignore this event
          if (this.#isUpdating) return;
          
          // Only sync if the radio is checked and slider value doesn't match
          if (radio.checked && parseInt(this.#rangeInput.value) !== index) {
            this.#rangeInput.value = index;
            this.#updateVisualState();
          }
        }, signal);
      });

      this.addEventListener('click', (event) => {
        this.#handleMarkerClick(event);
      }, signal);

      this.addEventListener('keydown', (event) => {
        this.#handleMarkerKeydown(event);
      }, signal);
    }

    /**
     * Re-sync the slider UI from the current radio state.
     * Useful after parent variant availability changes where radio properties
     * are updated programmatically.
     */
    refreshFromRadios() {
      this.#radioInputs = [...this.querySelectorAll('input[type="radio"].length-radio')];
      this.#markers = [...this.querySelectorAll('.length-marker')];

      if (!this.#rangeInput || this.#radioInputs.length === 0) {
        return;
      }

      const selectableRadios = this.#radioInputs.filter((radio) => !radio.disabled);

      if (selectableRadios.length === 0) {
        this.#syncAtcAvailability();
        return;
      }

      const checkedIndex = this.#radioInputs.findIndex((radio) => radio.checked);
      if (checkedIndex >= 0) {
        this.#rangeInput.value = checkedIndex;
      }

      this.#updateVisualState();
    }
    
    
    /**
     * Handle slider value change
     * @param {number} index - Selected option index
     * @param {boolean} dispatchChange - Whether to dispatch change event
     * @private
     */
    #handleSliderChange(index, dispatchChange = false) {
      if (index < 0 || index >= this.#radioInputs.length) return;
      if (this.#isUpdating) return; // Prevent recursive calls
      
      const selectedRadio = this.#radioInputs[index];
      if (!selectedRadio) return;
      
      // Check if radio is already selected - if so, only update visual if needed
      if (selectedRadio.checked) {
        // If already checked and we're just updating visual, do that and return
        if (!dispatchChange) {
          this.#updateVisualState();
          return;
        }
        // If already checked but we need to dispatch, just dispatch without setting checked again
        if (dispatchChange) {
          this.#updateVisualState();
          requestAnimationFrame(() => {
            selectedRadio.dispatchEvent(new Event('change', { bubbles: true }));
          });
          return;
        }
      }
      
      // Radio is not checked, so we need to update it
      this.#isUpdating = true;
      
      // Uncheck all radios first to ensure clean state
      this.#radioInputs.forEach(radio => {
        if (radio.checked) {
          radio.checked = false;
        }
      });
      
      // Set the selected radio
      selectedRadio.checked = true;
      
      // Update visual state
      this.#updateVisualState();
      
      // Dispatch change event to trigger variant-radios update (only on final selection)
      if (dispatchChange) {
        // Use requestAnimationFrame to ensure DOM is updated before dispatching
        requestAnimationFrame(() => {
          selectedRadio.dispatchEvent(new Event('change', { bubbles: true }));
          this.#isUpdating = false;
        });
      } else {
        this.#isUpdating = false;
      }
    }
    
    /**
     * Update visual state of slider and markers
     * @private
     */
    #updateVisualState() {
      if (!this.#rangeInput) return;
      
      const maxIndex = this.#radioInputs.length - 1;
      const rawSelectedIndex = parseInt(this.#rangeInput.value);
      const selectedIndex = Number.isNaN(rawSelectedIndex)
        ? 0
        : Math.min(Math.max(rawSelectedIndex, 0), maxIndex);
      this.#rangeInput.value = selectedIndex;
      
      // Calculate progress percentage - account for markers being positioned at specific percentages
      // First marker at 0%, last at 100%, others evenly spaced
      let progress = 0;
      if (maxIndex === 0) {
        progress = 100;
      } else if (maxIndex > 0) {
        progress = (selectedIndex / maxIndex) * 100;
      }
      
      // Update slider track progress
      const track = this.querySelector('.length-slider-track');
      if (track) {
        track.style.setProperty('--length-progress', `${progress}%`);
      }
      
      // Update selected option text
      const selectedRadio = this.#radioInputs[selectedIndex];
      if (selectedRadio && this.#selectedOption) {
        this.#selectedOption.textContent = selectedRadio.value;
      }
      
      // Update markers visual state (skip the zero marker)
      const valueMarkers = this.#markers.filter(marker => 
        marker.dataset.markerIndex !== undefined && !marker.classList.contains('length-marker-zero')
      );
      
      valueMarkers.forEach((marker) => {
        const markerIndex = parseInt(marker.dataset.markerIndex);
        if (isNaN(markerIndex)) return;
        
        const dot = marker.querySelector('.length-marker-dot');
        const label = marker.querySelector('.length-marker-label');
        const badge = marker.querySelector('.length-marker-badge');
        const markerRadio = this.#radioInputs[markerIndex];
        
        const isSelected = markerIndex === selectedIndex;
        const isUnavailable = markerRadio?.disabled || markerRadio?.getAttribute('available') === 'false';
        
        if (dot) {
          dot.classList.toggle('bg-subtle', isSelected && !isUnavailable);
          dot.classList.toggle('bg-emphasis', !isSelected || isUnavailable);
          dot.classList.toggle('opacity-50', isUnavailable);
          if (isSelected) {
            dot.style.width = '0.5rem';
            dot.style.height = '0.5rem';
          } else {
            dot.style.width = '0.25rem';
            dot.style.height = '0.25rem';
          }
        }
        
        if (label) {
          label.classList.toggle('font-medium', isSelected && !isUnavailable);
          label.classList.toggle('text-primary', isSelected && !isUnavailable);
          label.classList.toggle('opacity-50', !isSelected || isUnavailable);
          if (isSelected && !isUnavailable) {
            label.classList.add('bg-blue-700', 'rounded-full', 'text-on-accent!', 'px-2', 'py-0.5');
          } else {
            label.classList.remove('bg-blue-700', 'rounded-full', 'text-on-accent!', 'px-2', 'py-0.5');
          }
        }
        
        // Show badge only on selected marker
        if (badge) {
          badge.style.display = isSelected ? 'block' : 'none';
        }
      });

      this.#syncAtcAvailability();
    }

    /**
     * Handle marker click interactions.
     * @param {MouseEvent} event - Click event from marker area.
     * @private
     */
    #handleMarkerClick(event) {
      const marker = event.target.closest('.length-marker[data-marker-index]');
      if (!marker || !this.contains(marker)) {
        return;
      }

      this.#activateMarker(marker, event);
    }

    /**
     * Handle keyboard activation for focused markers.
     * @param {KeyboardEvent} event - Keyboard event on marker.
     * @private
     */
    #handleMarkerKeydown(event) {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      const marker = event.target.closest('.length-marker[data-marker-index]');
      if (!marker || !this.contains(marker)) {
        return;
      }

      this.#activateMarker(marker, event);
    }

    /**
     * Activate a length marker by selecting its matching radio.
     * This follows the same radio change path as the range input so sticky
     * dropdown and variant state stay in sync.
     * @param {HTMLElement} marker - Marker element to activate.
     * @param {Event} event - Source event to prevent default behavior.
     * @private
     */
    #activateMarker(marker, event) {
      const markerIndex = Number.parseInt(marker.dataset.markerIndex, 10);
      if (Number.isNaN(markerIndex) || markerIndex < 0 || markerIndex >= this.#radioInputs.length) {
        return;
      }

      const markerRadio = this.#radioInputs[markerIndex];
      if (!markerRadio || markerRadio.disabled) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (Number.parseInt(this.#rangeInput.value, 10) !== markerIndex) {
        this.#rangeInput.value = markerIndex;
      }

      this.#handleSliderChange(markerIndex, true);
    }

    /**
     * Ensure add-to-cart reflects the selected length radio availability.
     * This guards against stale button state when slider-driven changes finish
     * slightly before the parent variant component recomputes availability.
     * @private
     */
    #syncAtcAvailability() {
      const variantRadios = this.closest('variant-radios');
      if (!variantRadios || typeof variantRadios.updateButtonAvailability !== 'function') {
        return;
      }

      if (this.#radioInputs.filter((radio) => !radio.disabled).length === 0) {
        const productParent = this.closest('[data-section][data-product]');
        const productButtons = productParent?.querySelectorAll('product-buttons') || [];
        const quantityInput = productParent?.querySelector('quantity-input');

        productButtons.forEach((button) => {
          button.setAttribute('availability', 'unavailable');
          button.setAttribute('available', 'false');
          if (typeof button.updateButtonState === 'function') {
            button.updateButtonState();
          }
        });

        quantityInput?.setAttribute('available', 'false');
        return;
      }

      const selectedIndex = parseInt(this.#rangeInput?.value);
      const selectedRadio = Number.isNaN(selectedIndex)
        ? null
        : this.#radioInputs[selectedIndex];
      const isSelectedLengthUnavailable = !!selectedRadio
        && (selectedRadio.disabled || selectedRadio.getAttribute('available') === 'false');

      if (isSelectedLengthUnavailable) {
        const productParent = this.closest('[data-section][data-product]');
        const productButtons = productParent?.querySelectorAll('product-buttons') || [];
        const quantityInput = productParent?.querySelector('quantity-input');

        productButtons.forEach((button) => {
          button.setAttribute('availability', 'unavailable');
          button.setAttribute('available', 'false');
          if (typeof button.updateButtonState === 'function') {
            button.updateButtonState();
          }
        });

        quantityInput?.setAttribute('available', 'false');
        return;
      }

      variantRadios.updateButtonAvailability();
      requestAnimationFrame(() => {
        variantRadios.updateButtonAvailability();
      });
    }
    
    disconnectedCallback() {
      this.#abortController?.abort();
      this.#mutationObserver?.disconnect();
      // Clear references to prevent memory leaks
      this.#rangeInput = null;
      this.#radioInputs = [];
      this.#selectedOption = null;
      this.#markers = [];
    }
  }
  
  customElements.define('length-slider', LengthSlider);
  
  // Check for existing elements that might need upgrading when DOM is ready
  const checkAndUpgrade = () => {
  };
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndUpgrade);
  } else {
    checkAndUpgrade();
  }
  
  // Also check after a delay to catch dynamically added elements
  setTimeout(checkAndUpgrade, 1000);
}

