if (!customElements.get("variant-radios")) {
  class VariantRadios extends HTMLElement {
    constructor() {
      super();
      // Don't initialize anything in constructor - element might not be in DOM yet
      // All initialization happens in connectedCallback
    }

    connectedCallback() {
      // Initialize all properties when element is in DOM
      this.quickAtcMode = this.dataset.quickAtcMode;
      this.productParentElement = this.closest(`[data-section][data-product]`);

      if (this.productParentElement) {
        this.dataset.section = this.dataset.section || this.productParentElement.dataset.section;
        this.dataset.product = this.productParentElement.dataset.product;
      }

      // Get all fieldsets (including length-slider)
      this.fieldsets = [...this.querySelectorAll("fieldset")];

      if (this.productParentElement) {
        this.qtyInput = this.productParentElement.querySelector("quantity-input");
        this.productButtons = this.productParentElement.querySelectorAll("product-buttons");
        this.productForms = this.productParentElement.querySelectorAll("product-form");
        this.outputs = this.productParentElement.querySelectorAll("._selectedOption");
      }

      this.stickyOutput = document.querySelector('._stickyOutput');
      this.stickyImageOutput = document.querySelector('._stickyImageOutput');

      if (this.productParentElement) {
        this.quantitySelector = this.productParentElement.querySelector("quantity-input");
      }

      // Combined listings support
      if (!this.optionUrls) {
        this.optionUrls = null;
      }
      if (!this.currentProductUrl) {
        this.currentProductUrl = null;
      }
      if (!this.currentTargetVariantId) {
        this.currentTargetVariantId = null;
      }
      if (!this.explicitTargetVariantId) {
        this.explicitTargetVariantId = null;
      }
      if (!this.explicitProductUrl) {
        this.explicitProductUrl = null;
      }
      if (!this.combinedListingsMap) {
        this.combinedListingsMap = null;
      }
      if (!this.selectionLinkIndex) {
        this.selectionLinkIndex = new Map();
      }
      if (!this.hasCombinedListings) {
        this.hasCombinedListings = false;
      }

      // Set up change event listener
      if (!this._changeHandler) {
        this._changeHandler = this.onVariantChange.bind(this);
      }
      this.addEventListener("change", this._changeHandler);
      if (!this._clickHandler) {
        this._clickHandler = this.onVariantClick.bind(this);
      }
      this.addEventListener("click", this._clickHandler);

      if (!document.getElementById('vr-no-flash')) {
        const s = document.createElement('style');
        s.id = 'vr-no-flash';
        s.textContent = 'variant-radios[data-computing],variant-radios[data-computing] *{transition:none!important}';
        document.head.append(s);
      }

      this.#loadOptionData();
      this.updateOptions();
      this.updateVariantsAvailability();
      this.updateVariantSelectedState(this.#hasCompleteSelection());
      this.updateButtonAvailability();
    }

    handleFirstClick() {}

    /**
     * Load combined listings map
     * @private
     */
    #loadOptionData() {
      try {
        const combinedListingsElement = this.querySelector('.combined-listings-map');
        if (combinedListingsElement) {
          this.combinedListingsMap = JSON.parse(combinedListingsElement.textContent);
          this.hasCombinedListings = Array.isArray(this.combinedListingsMap) && this.combinedListingsMap.length > 0;
        }

        const selectionLinkMapElement = this.querySelector('.selection-link-map');
        if (selectionLinkMapElement) {
          const selectionLinkEntries = JSON.parse(selectionLinkMapElement.textContent);
          this.#loadSelectionLinkIndex(selectionLinkEntries);
        }

        // Also load the old optionUrls for updateCurrentProductUrl (still needed for URL navigation)
        const optionUrlsElement = this.querySelector('.variant-option-urls-json');
        if (optionUrlsElement) {
          this.optionUrls = JSON.parse(optionUrlsElement.textContent);
        }
      } catch (error) {
        console.error('Failed to load combined listings data:', error);
      }
    }

    /**
     * Load the exact selection-to-link index prepared in Liquid.
     * @param {Array<Object>} selectionLinkEntries - Server-rendered selection link entries
     * @private
     */
    #loadSelectionLinkIndex(selectionLinkEntries) {
      this.selectionLinkIndex = new Map();

      if (!Array.isArray(selectionLinkEntries)) {
        return;
      }

      for (const entry of selectionLinkEntries) {
        if (!entry || typeof entry.key !== "string" || !entry.url) {
          continue;
        }

        const candidates = this.selectionLinkIndex.get(entry.key) || [];
        candidates.push(entry);
        this.selectionLinkIndex.set(entry.key, candidates);
      }
    }

    onVariantChange(e) {
      // Only respond to radio button changes
      if (!e.target || e.target.type !== 'radio') {
        return;
      }

      const changedFieldset = e.target.closest('fieldset');
      const changedFieldsetIndex = this.fieldsets.findIndex((fieldset) => fieldset === changedFieldset);
      this.#setExplicitProductUrl(changedFieldsetIndex, e.target);
      this.#syncSelectionState(changedFieldsetIndex);
    }

    onVariantClick(e) {
      if (!e.target || e.target.type !== 'radio') {
        return;
      }

      const clickedFieldset = e.target.closest('fieldset');
      const clickedFieldsetIndex = this.fieldsets.findIndex((fieldset) => fieldset === clickedFieldset);
      if (clickedFieldsetIndex < 0) {
        return;
      }

      const currentOptions = Array.isArray(this.options) ? this.options : [];
      if (currentOptions[clickedFieldsetIndex] !== e.target.value) {
        return;
      }

      // Re-clicking the already-selected option should also re-run the cascade so
      // downstream options snap back to the first valid available choices.
      this.#setExplicitProductUrl(clickedFieldsetIndex, e.target);
      this.#syncSelectionState(clickedFieldsetIndex);
    }

    /**
     * Persist the explicitly chosen product URL for the last clicked option.
     * @param {number} fieldsetIndex - Fieldset index for the changed radio
     * @param {HTMLInputElement} radio - Selected radio
     * @private
     */
    #setExplicitProductUrl(fieldsetIndex, radio) {
      if (!radio || fieldsetIndex < 0) {
        return;
      }

      const fieldset = this.fieldsets[fieldsetIndex];
      const optionUrl = this.#getOptionUrlForRadio(fieldset, fieldsetIndex, radio);
      const targetVariantId = this.#getOptionTargetVariantIdForRadio(fieldset, fieldsetIndex, radio);
      this.explicitProductUrl = optionUrl || null;
      this.explicitTargetVariantId = targetVariantId || null;
    }

    /**
     * Clear checked radios after the changed fieldset so downstream options can be rebuilt.
     * @param {number} changedFieldsetIndex - Index of the fieldset that initiated the change
     * @private
     */
    #resetSelectionsAfter(changedFieldsetIndex) {
      if (typeof changedFieldsetIndex !== "number" || changedFieldsetIndex < 0) {
        return;
      }

      this.fieldsets.forEach((fieldset, fieldsetIndex) => {
        if (fieldsetIndex <= changedFieldsetIndex) {
          return;
        }

        [...fieldset.elements].forEach((radio) => {
          if (radio.type === "radio" && radio.checked) {
            radio.checked = false;
          }
        });
      });
    }

    /**
     * Recompute selection, availability, URL, and product state after a variant choice.
     * @param {number} changedFieldsetIndex - Index of the fieldset that initiated the change
     * @private
     */
    #syncSelectionState(changedFieldsetIndex) {
      this.dataset.computing = '';
      this.updateOptions();
      this.updateVariantsAvailability(changedFieldsetIndex);
      this.#resolveDeadlockedFieldsets(changedFieldsetIndex);
      void this.offsetHeight;
      delete this.dataset.computing;
      this.#refreshLengthSliderState();
      this.updateVariantSelectedState(this.#hasCompleteSelection());
      this.updateOutputs();

      // Update which product URL we're using (for combined listings).
      this.updateCurrentProductUrl();

      // Update variant ID immediately based on selected options.
      // The section fetch below may not always return a product context that updates
      // `product.selected_or_first_available_variant`, so we can't rely on Liquid for this.
      const selectedVariant = this.#getSelectedVariantFromOptions();
      this.updateButtonAvailability();
      const hasLocalVariant = !!selectedVariant?.id;
      if (hasLocalVariant) {
        this.#updateVariantInputWithId(selectedVariant.id);
        this.updateStickyOutput();
        this.#syncCurrentVariantJson(selectedVariant);
      }

      // Always update the URL to reflect the current product context, even when the
      // variant can't be resolved locally (cross-product navigation).
      this.updateURL();

      const shouldSkipFetchForLengthChange = this.#shouldSkipFetchForLengthChange(changedFieldsetIndex);
      if (hasLocalVariant && shouldSkipFetchForLengthChange) {
        this.#updateLocalLengthPrice(selectedVariant);
        return;
      }

      // Fetch updated section with new variant data
      // Keep variant changes lightweight: only update price UI (and keep sliders/media intact).
      this.renderProductInfo(hasLocalVariant);
    }

    /**
     * After the forward cascade, check if any non-length fieldset has zero available
     * options. If so, switch the first adjustable upstream fieldset to an alternative
     * value and re-run availability — a "reverse cascade."
     * @param {number} changedFieldsetIndex - Index the user changed (never adjusted)
     * @private
     */
    #resolveDeadlockedFieldsets(changedFieldsetIndex) {
      const lengthOptionIndex = this.#getLengthOptionIndex();

      const isDeadlocked = (fieldset, idx) => {
        if (idx === lengthOptionIndex) return false;
        const radios = [...fieldset.elements].filter((r) => r.type === 'radio');
        return radios.length > 0
          && !radios.some((r) => !r.disabled && r.getAttribute('available') === 'true');
      };

      if (!this.fieldsets.some(isDeadlocked)) return;

      for (let i = 0; i < this.fieldsets.length; i++) {
        if (i === changedFieldsetIndex || i === lengthOptionIndex) continue;

        const radios = [...this.fieldsets[i].elements].filter((r) => r.type === 'radio');
        const currentChecked = radios.find((r) => r.checked);

        const alternative = radios.find(
          (r) => r !== currentChecked && !r.disabled && r.getAttribute('available') === 'true'
        ) || radios.find((r) => r !== currentChecked && !r.disabled);

        if (!alternative) continue;

        if (currentChecked) currentChecked.checked = false;
        alternative.checked = true;
        this.updateOptions();
        this.updateVariantsAvailability(-1);

        if (!this.fieldsets.some(isDeadlocked)) return;
      }
    }

    updateVariantSelectedState(boolean) {
      this.productParentElement.dataset.variantSelected = boolean;
    }

    updateOutputs() {
      this.outputs.forEach((output) => {
        const index = parseInt(output.dataset.index);
        if (!isNaN(index) && this.options && this.options[index]) {
          output.innerHTML = this.options[index];
        }
      });
    }

    /**
     * Determine whether a section fetch can be skipped for the current change.
     * Length-only changes on the same product can update price from local variant JSON.
     * @param {number} changedFieldsetIndex - Index of the changed option fieldset
     * @returns {boolean} True when local update is safe
     * @private
     */
    #shouldSkipFetchForLengthChange(changedFieldsetIndex) {
      const lengthOptionIndex = this.#getLengthOptionIndex();
      if (lengthOptionIndex < 0 || changedFieldsetIndex !== lengthOptionIndex) {
        return false;
      }

      const baseUrl = this.currentProductUrl || this.dataset.url;
      const normalizedBaseUrl = this.#normalizeProductUrl(baseUrl);
      const normalizedDatasetUrl = this.#normalizeProductUrl(this.dataset.url);
      const isCrossProductNavigation = normalizedBaseUrl !== "" && normalizedBaseUrl !== normalizedDatasetUrl;
      return !isCrossProductNavigation;
    }

    /**
     * Keep current-variant-json aligned with selected local variant.
     * @param {Object} selectedVariant - Currently selected variant
     * @private
     */
    #syncCurrentVariantJson(selectedVariant) {
      if (!selectedVariant) {
        return;
      }

      const variantJsonElement = this.querySelector(".current-variant-json");
      if (!variantJsonElement) {
        return;
      }

      try {
        variantJsonElement.textContent = JSON.stringify(selectedVariant);
      } catch (error) {}
    }

    /**
     * Update product form price UI instantly for length-only changes.
     * @param {Object} selectedVariant - Currently selected variant
     * @private
     */
    #updateLocalLengthPrice(selectedVariant) {
      if (!selectedVariant || !this.productParentElement) {
        return;
      }

      const targets = this.productParentElement.querySelectorAll(
        'product-form [data-variant-dynamic="variant-price"]'
      );
      if (!targets.length) {
        return;
      }

      const formattedPrice = this.#formatMoney(selectedVariant.price);
      const chipMarkup = this.#buildLengthPriceChipMarkup(selectedVariant);

      targets.forEach((target) => {
        target.innerHTML = `${formattedPrice}${chipMarkup}`;
      });
    }

    /**
     * Build the "/m + saved%" chip HTML for the selected length.
     * Mirrors product--form.liquid output for rapid local updates.
     * @param {Object} selectedVariant - Currently selected variant
     * @returns {string} Chip HTML or empty string
     * @private
     */
    #buildLengthPriceChipMarkup(selectedVariant) {
      const lengthOptionIndex = this.#getLengthOptionIndex();
      if (lengthOptionIndex < 0) {
        return "";
      }

      const selectedMeters = this.#extractMetersFromVariantOption(selectedVariant, lengthOptionIndex);
      if (selectedMeters <= 0) {
        return "";
      }

      const allVariants = this.#getAllVariants();
      const firstVariant = Array.isArray(allVariants) ? allVariants[0] : null;
      const firstVariantMeters = this.#extractMetersFromVariantOption(firstVariant, lengthOptionIndex);

      const pricePerMeter = Math.round(Number(selectedVariant.price || 0) / selectedMeters);
      const firstVariantPricePerMeter = firstVariantMeters > 0
        ? Math.round(Number(firstVariant?.price || 0) / firstVariantMeters)
        : 0;

      let savingsPercentage = 0;
      if (firstVariantPricePerMeter > 0) {
        savingsPercentage = Math.round(
          ((firstVariantPricePerMeter - pricePerMeter) * 100) / firstVariantPricePerMeter
        );
      }

      const priceTarget = this.productParentElement.querySelector(
        'product-form [data-variant-dynamic="variant-price"]'
      );
      const savedLabel = priceTarget?.dataset.savedLabel || 'saved';

      return `<span class="rounded-full bg-white px-2 pt-1 pb-0.5 flex items-end gap-1 w-fit text-primary hidden!"><span class="text-ui-small font-medium">${this.#formatMoney(pricePerMeter)}/m <span class="opacity-50">${savingsPercentage}% ${savedLabel}</span></span></span>`;
    }

    /**
     * Parse numeric meters value from a variant option.
     * @param {Object|null} variant - Variant object
     * @param {number} optionIndex - Length option index
     * @returns {number} Parsed meters value or 0
     * @private
     */
    #extractMetersFromVariantOption(variant, optionIndex) {
      if (!variant || !Array.isArray(variant.options) || optionIndex < 0) {
        return 0;
      }

      const rawOption = variant.options[optionIndex];
      if (typeof rawOption !== "string") {
        return 0;
      }

      const normalized = rawOption
        .replace(",", ".")
        .replace(/[^0-9.]/g, "")
        .trim();
      const parsed = Number.parseFloat(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    /**
     * Format cents using locale/currency data available on the storefront.
     * @param {number|string} cents - Amount in cents
     * @returns {string} Formatted money text
     * @private
     */
    #formatMoney(cents) {
      const amount = Number(cents);
      if (!Number.isFinite(amount)) {
        return "";
      }

      const locale = document.documentElement.lang || "en";
      const currency =
        window.Shopify?.currency?.active || window.Shopify?.currency?.code || "EUR";

      /** CLDR uses "kr" for these; force ISO codes for clearer storefront labeling. */
      const useCurrencyCode =
        currency === "NOK" || currency === "DKK" || currency === "SEK";

      try {
        return new Intl.NumberFormat(locale, {
          style: "currency",
          currency,
          ...(useCurrencyCode ? { currencyDisplay: "code" } : {}),
        }).format(amount / 100);
      } catch (error) {
        return `${(amount / 100).toFixed(2)} ${currency}`;
      }
    }

    /**
     * Refresh nested length slider UI after radio availability changes.
     * @private
     */
    #refreshLengthSliderState() {
      const lengthSliders = this.querySelectorAll('length-slider');
      lengthSliders.forEach((slider) => {
        if (typeof slider.refreshFromRadios === 'function') {
          slider.refreshFromRadios();
        }
      });
    }

    updateStickyOutput() {
      if (!this.stickyOutput) return;

      const currentVariant = this.#getSelectedVariantFromOptions() || this.getCurrentVariant();
      if (!currentVariant) return;

      try {
        this.stickyOutput.innerHTML = currentVariant.title || '';
        if (this.stickyImageOutput && currentVariant.featured_image?.src) {
          this.stickyImageOutput.src = currentVariant.featured_image.src;
        }
      } catch (error) {}
    }

    /**
     * Update the current product URL based on selected options (for combined listings).
     *
     * Checks option groups in order (0, 1, 2...). The first option that resolves to a URL
     * different from the current page determines `currentProductUrl`. This ensures the
     * primary product-family option always takes priority, while Shopify's `option_values`
     * param handles the concrete variant selection inside that product.
     */
    updateCurrentProductUrl() {
      if (!this.options) {
        this.currentProductUrl = null;
        this.currentTargetVariantId = null;
        return;
      }

      try {
        const currentPageUrl = this.#normalizeProductUrl(this.dataset.url);
        this.#logSelectedRadioTargets();
        const selectionCandidates = this.#getSelectionCandidates(this.options);
        this.#logSelectionCandidates(this.options, selectionCandidates);
        const resolvedTarget = this.#resolveSelectionTarget(this.options);

        if (this.combinedListingsMap?.length) {
          if (resolvedTarget?.url) {
            const resolvedUrl = this.#normalizeProductUrl(resolvedTarget.url);
            this.currentProductUrl = resolvedTarget.url;
            this.currentTargetVariantId = resolvedTarget.variantId || null;

            if (resolvedUrl === currentPageUrl && !this.currentTargetVariantId) {
              this.currentProductUrl = this.dataset.url;
            }

            return;
          }

          // Combined-listings-map couldn't resolve a target — the map may not contain
          // entries for the selected product (e.g. switching Schuko → CEE across products).
          // Fall back to the checked radio's data-product-url for cross-product navigation.
          const radioFallback = this.#getCheckedRadioCrossProductUrl(currentPageUrl);
          if (radioFallback) {
            this.currentProductUrl = radioFallback.url;
            this.currentTargetVariantId = radioFallback.variantId || null;
            return;
          }

          this.currentProductUrl = null;
          this.currentTargetVariantId = null;
          return;
        }

        this.currentTargetVariantId = null;

        if (!this.optionUrls) {
          this.currentProductUrl = null;
          return;
        }

        for (let optionIndex = 0; optionIndex < this.options.length; optionIndex++) {
          const selectedValue = this.options[optionIndex];
          if (!selectedValue) continue;

          const fieldset = this.fieldsets[optionIndex];
          if (!fieldset || !this.optionUrls[optionIndex]) continue;

          const radios = [...fieldset.elements].filter(el => el.type === 'radio');
          const optionValues = radios.map(radio => radio.value);

          const selectedIndex = optionValues.findIndex(value => {
            const normalizedValue = typeof value === 'string' ? value.trim() : value;
            const normalizedSelected = typeof selectedValue === 'string' ? selectedValue.trim() : selectedValue;
            return normalizedValue === normalizedSelected;
          });

          if (selectedIndex >= 0 && selectedIndex < this.optionUrls[optionIndex].length) {
            const url = this.optionUrls[optionIndex][selectedIndex];
            if (url && typeof url === 'string' && url.trim() !== '') {
              const trimmedUrl = url.trim();
              if (this.#normalizeProductUrl(trimmedUrl) !== currentPageUrl) {
                // First cross-product option wins — it defines the product family URL
                this.currentProductUrl = trimmedUrl;
                return;
              }
              // Same page — keep scanning higher option groups
            }
          }
        }

        this.currentProductUrl = null;
      } catch (error) {
        this.currentProductUrl = null;
        this.currentTargetVariantId = null;
      }
    }

    /**
     * Check checked radios for a data-product-url pointing to a different product.
     * Used as a fallback when the combined-listings-map has no entries for the target.
     * @param {string} currentPageUrl - Normalized current page URL
     * @returns {{ url: string, variantId: string|null }|null}
     * @private
     */
    #getCheckedRadioCrossProductUrl(currentPageUrl) {
      if (!Array.isArray(this.fieldsets)) return null;

      for (const fieldset of this.fieldsets) {
        const checked = [...fieldset.elements].find((r) => r.type === 'radio' && r.checked);
        if (!checked?.dataset.productUrl) continue;

        const radioUrl = checked.dataset.productUrl.trim();
        if (!radioUrl) continue;

        const normalized = this.#normalizeProductUrl(radioUrl);
        if (normalized && normalized !== currentPageUrl) {
          return {
            url: radioUrl,
            variantId: checked.dataset.targetVariantId || null
          };
        }
      }

      return null;
    }

    /**
     * Resolve the linked product URL for a radio option in combined listings.
     * @param {HTMLFieldSetElement} fieldset - Fieldset containing the radio
     * @param {number} optionIndex - Option group index
     * @param {HTMLInputElement} radio - Radio input to resolve
     * @returns {string|null} Linked product URL or null
     * @private
     */
    #getOptionUrlForRadio(fieldset, optionIndex, radio) {
      if (!fieldset || !radio) {
        return null;
      }

      const explicitUrl = typeof radio.dataset.productUrl === "string" ? radio.dataset.productUrl.trim() : "";
      if (explicitUrl) {
        return explicitUrl;
      }

      if (!this.optionUrls?.[optionIndex]) {
        return null;
      }

      const radios = [...fieldset.elements].filter((element) => element.type === 'radio');
      const optionValues = radios.map((element) => element.value);
      const selectedIndex = optionValues.findIndex((value) => {
        const normalizedValue = typeof value === 'string' ? value.trim() : value;
        const normalizedRadioValue = typeof radio.value === 'string' ? radio.value.trim() : radio.value;
        return normalizedValue === normalizedRadioValue;
      });

      if (selectedIndex < 0 || selectedIndex >= this.optionUrls[optionIndex].length) {
        return null;
      }

      const url = this.optionUrls[optionIndex][selectedIndex];
      return typeof url === 'string' && url.trim() !== '' ? url.trim() : null;
    }

    /**
     * Resolve the linked target variant ID for a radio option.
     * @param {HTMLFieldSetElement} fieldset - Fieldset containing the radio
     * @param {number} optionIndex - Option group index
     * @param {HTMLInputElement} radio - Radio input to resolve
     * @returns {string|null} Linked target variant ID or null
     * @private
     */
    #getOptionTargetVariantIdForRadio(fieldset, optionIndex, radio) {
      if (!fieldset || !radio) {
        return null;
      }

      const explicitVariantId = typeof radio.dataset.targetVariantId === "string"
        ? radio.dataset.targetVariantId.trim()
        : "";
      if (explicitVariantId) {
        return explicitVariantId;
      }

      return null;
    }

    /**
     * Resolve the product URL implied by the currently selected option radios.
     * The first selected cross-product option wins and becomes the active product context.
     * @returns {string} Selected product URL or empty string
     * @private
     */
    #getSelectedOptionProductUrl() {
      if (this.explicitProductUrl && !this.#hasCompleteSelection()) {
        return this.explicitProductUrl;
      }

      if (!Array.isArray(this.fieldsets) || !Array.isArray(this.options)) {
        return "";
      }

      for (let optionIndex = 0; optionIndex < this.options.length; optionIndex++) {
        const selectedValue = this.options[optionIndex];
        if (!selectedValue) continue;

        const fieldset = this.fieldsets[optionIndex];
        if (!fieldset) continue;

        const selectedRadio = [...fieldset.elements].find((radio) => (
          radio.type === "radio" && radio.checked && radio.value === selectedValue
        ));
        if (!selectedRadio) continue;

        const optionUrl = this.#getOptionUrlForRadio(fieldset, optionIndex, selectedRadio);
        if (optionUrl) {
          return optionUrl;
        }
      }

      return "";
    }

    /**
     * Check whether a provided option set is complete.
     * @param {Array<string|null>} optionSet - Option values to validate
     * @returns {boolean} True when every option has a non-empty value
     * @private
     */
    #hasCompleteOptionSet(optionSet) {
      return Array.isArray(optionSet)
        && optionSet.length > 0
        && optionSet.every((option) => typeof option === "string" && option.trim() !== "");
    }

    /**
     * Count selected non-empty option values.
     * @param {Array<string|null>} optionSet - Option values to inspect
     * @returns {number} Number of selected options
     * @private
     */
    #countSelectedOptions(optionSet) {
      if (!Array.isArray(optionSet)) {
        return 0;
      }

      return optionSet.filter((option) => typeof option === "string" && option.trim() !== "").length;
    }

    /**
     * Build a stable key for an option combination.
     * @param {Array<string|null>} optionSet - Option values
     * @returns {string} Serialized option key
     * @private
     */
    #buildSelectionKey(optionSet) {
      if (!Array.isArray(optionSet) || optionSet.length === 0) {
        return "";
      }

      return optionSet.map((option) => (
        typeof option === "string" ? option.trim() : ""
      )).join("|||");
    }

    /**
     * Get all target candidates that match the current selected options.
     * @param {Array<string>} [selectedOptions=this.options] - Selected option values
     * @returns {Array<Object>} Matching target candidates
     * @private
     */
    #getSelectionCandidates(selectedOptions = this.options) {
      if (!Array.isArray(selectedOptions) || selectedOptions.length === 0) {
        return [];
      }

      if (this.#hasCompleteOptionSet(selectedOptions) && this.selectionLinkIndex instanceof Map) {
        const key = this.#buildSelectionKey(selectedOptions);
        const exactCandidates = this.selectionLinkIndex.get(key) || [];
        if (exactCandidates.length > 0) {
          return exactCandidates;
        }
      }

      if (!Array.isArray(this.combinedListingsMap)) {
        return [];
      }

      return this.combinedListingsMap.filter((entry) => {
        if (!entry || !Array.isArray(entry.options)) {
          return false;
        }

        for (let i = 0; i < selectedOptions.length; i++) {
          const option = selectedOptions[i];
          if (typeof option !== "string" || option.trim() === "") {
            continue;
          }

          if (entry.options[i] !== option) {
            return false;
          }
        }

        return true;
      });
    }

    /**
     * Log the current selection candidates to the browser console for debugging.
     * @param {Array<string>} selectedOptions - Selected option values
     * @param {Array<Object>} candidates - Matching target candidates
     * @private
     */
    #logSelectionCandidates(selectedOptions, candidates) {
      const formattedCandidates = Array.isArray(candidates)
        ? candidates.map((entry) => ({
          url: entry?.url || null,
          variantId: entry?.variantId || null,
          available: entry?.available ?? null,
          options: Array.isArray(entry?.options) ? entry.options.join(" | ") : null,
        }))
        : [];

      console.info("[variant-radios] selection candidates", {
        selectedOptions,
        candidateCount: formattedCandidates.length,
        candidates: formattedCandidates,
      });
    }

    /**
     * Log the currently selected radios and their resolved link data.
     * @private
     */
    #logSelectedRadioTargets() {
      if (!Array.isArray(this.fieldsets)) {
        return;
      }

      const selectedRadios = [];

      this.fieldsets.forEach((fieldset, fieldsetIndex) => {
        const selectedRadio = [...fieldset.elements].find((radio) => radio.type === "radio" && radio.checked);
        if (!selectedRadio) {
          selectedRadios.push({
            fieldsetIndex,
            value: null,
            productUrl: null,
            targetVariantId: null,
          });
          return;
        }

        selectedRadios.push({
          fieldsetIndex,
          value: selectedRadio.value,
          productUrl: this.#getOptionUrlForRadio(fieldset, fieldsetIndex, selectedRadio),
          targetVariantId: this.#getOptionTargetVariantIdForRadio(fieldset, fieldsetIndex, selectedRadio),
        });
      });

      console.info("[variant-radios] selected radio targets", selectedRadios);
    }

    /**
     * Resolve the canonical target product for the current selection.
     * Uses exact selection links when all options are chosen and falls back to the
     * selected option URL while the user is still building the combination.
     * @param {Array<string>} [selectedOptions=this.options] - Selected option values
     * @returns {Object|null} Resolved target entry with url and variantId
     * @private
     */
    #resolveSelectionTarget(selectedOptions = this.options) {
      if (!Array.isArray(selectedOptions) || selectedOptions.length === 0) {
        return null;
      }

      const candidates = this.#getSelectionCandidates(selectedOptions);
      if (!candidates.length) {
        return null;
      }

      const uniqueUrls = [...new Set(
        candidates
          .map((entry) => this.#normalizeProductUrl(entry?.url))
          .filter(Boolean)
      )];

      if (uniqueUrls.length !== 1) {
        return null;
      }

      const targetUrl = uniqueUrls[0];
      const urlCandidates = candidates.filter((entry) => this.#normalizeProductUrl(entry?.url) === targetUrl);
      const availableCandidates = urlCandidates.filter((entry) => entry.available === true);
      const explicitTargetVariantId = this.explicitTargetVariantId ? String(this.explicitTargetVariantId) : "";
      const currentTargetVariantId = this.currentTargetVariantId ? String(this.currentTargetVariantId) : "";
      const winner = availableCandidates.find((entry) => explicitTargetVariantId && String(entry.variantId) === explicitTargetVariantId)
        || availableCandidates.find((entry) => currentTargetVariantId && String(entry.variantId) === currentTargetVariantId)
        || availableCandidates[0]
        || urlCandidates.find((entry) => explicitTargetVariantId && String(entry.variantId) === explicitTargetVariantId)
        || urlCandidates.find((entry) => currentTargetVariantId && String(entry.variantId) === currentTargetVariantId)
        || urlCandidates[0];

      return winner || null;
    }

    /**
     * Resolve the best combined-listing entry for the current selection.
     * Tries exact selection first, then progressively relaxes trailing options
     * so switching product families still works when the current length does not exist there.
     * @returns {Object|null} Matching combined listing entry
     * @private
     */
    #getBestCombinedListingMatch(selectedOptions = this.options) {
      if (!Array.isArray(selectedOptions) || !Array.isArray(this.combinedListingsMap) || this.combinedListingsMap.length === 0) {
        return null;
      }

      const normalizedSelectedOptions = [...selectedOptions];
      const selectedCount = this.#countSelectedOptions(normalizedSelectedOptions);
      const explicitSelectedUrl = this.#hasCompleteOptionSet(selectedOptions)
        || selectedCount > 1
        ? ""
        : this.#normalizeProductUrl(this.#getSelectedOptionProductUrl());
      const preferredUrl = this.#normalizeProductUrl(
        this.#getPreferredProductUrlForSelection(normalizedSelectedOptions) || this.currentProductUrl || this.dataset.url
      );

      for (let end = normalizedSelectedOptions.length; end > 0; end--) {
        const candidateOptions = normalizedSelectedOptions.map((option, index) => (index < end ? option : ''));
        const matches = this.combinedListingsMap.filter((entry) => {
          if (!Array.isArray(entry?.options)) return false;

          for (let i = 0; i < candidateOptions.length; i++) {
            const candidate = candidateOptions[i];
            if (!candidate) continue;
            if (entry.options[i] !== candidate) return false;
          }

          return true;
        });

        if (matches.length > 0) {
          return matches.find((entry) => explicitSelectedUrl && this.#normalizeProductUrl(entry.url) === explicitSelectedUrl)
            || matches.find((entry) => entry.available === true && this.#normalizeProductUrl(entry.url) === preferredUrl)
            || matches.find((entry) => this.#normalizeProductUrl(entry.url) === preferredUrl)
            || matches.find((entry) => entry.available === true)
            || matches[0];
        }
      }

      return null;
    }

    /**
     * Get all variants that match the current test option set.
     * Null/empty options are ignored so partial selections still work.
     * @param {Array<string|null>} testOptions - Option values to match
     * @param {Array<Object>} allVariants - Variant dataset
     * @returns {Array<Object>} Matching variants
     * @private
     */
    #getMatchingVariants(testOptions, allVariants) {
      if (!Array.isArray(testOptions) || !Array.isArray(allVariants)) {
        return [];
      }

      return allVariants.filter((variant) => {
        if (!variant || !Array.isArray(variant.options)) return false;

        for (let i = 0; i < testOptions.length; i++) {
          const testOpt = testOptions[i];
          if (testOpt === null || testOpt === undefined || testOpt === '') continue;
          if (variant.options[i] !== testOpt) return false;
        }

        return true;
      });
    }

    /**
     * Get combined-listing entries that match a partial option set.
     * Null/empty options are ignored so upstream selections can drive downstream availability.
     * @param {Array<string|null>} testOptions - Option values to match
     * @returns {Array<Object>} Matching combined listing entries
     * @private
     */
    #getMatchingCombinedListings(testOptions) {
      if (!Array.isArray(testOptions) || !Array.isArray(this.combinedListingsMap)) {
        return [];
      }

      const matches = this.combinedListingsMap.filter((entry) => {
        if (!entry || !Array.isArray(entry.options)) return false;

        for (let i = 0; i < testOptions.length; i++) {
          const testOpt = testOptions[i];
          if (testOpt === null || testOpt === undefined || testOpt === '') continue;
          if (entry.options[i] !== testOpt) return false;
        }

        return true;
      });

      const explicitUrl = this.#normalizeProductUrl(this.explicitProductUrl);
      const shouldPinExplicitUrl = !!explicitUrl && !this.#hasCompleteOptionSet(testOptions);
      if (!shouldPinExplicitUrl) {
        return matches;
      }

      const explicitMatches = matches.filter((entry) => this.#normalizeProductUrl(entry.url) === explicitUrl);
      return explicitMatches.length > 0 ? explicitMatches : matches;
    }

    /**
     * Build the option set used to evaluate a fieldset radio.
     * Only upstream selections are locked so earlier changes can repopulate downstream choices.
     * Indices listed in excludeIndices are always nulled out regardless of position.
     * @param {Array<string|null>} selectedOptions - Current selected option values
     * @param {number} fieldsetIndex - Fieldset index being evaluated
     * @param {string} radioValue - Candidate radio value
     * @param {Array<number>} [excludeIndices=[]] - Option indices to ignore (always null)
     * @returns {Array<string|null>} Prefix-based option set
     * @private
     */
    #buildAvailabilityTestOptions(selectedOptions, fieldsetIndex, radioValue, excludeIndices = []) {
      if (!Array.isArray(selectedOptions)) {
        return [];
      }

      return selectedOptions.map((option, index) => {
        if (excludeIndices.includes(index)) {
          return null;
        }

        if (index < fieldsetIndex) {
          return option;
        }

        if (index === fieldsetIndex) {
          return radioValue;
        }

        return null;
      });
    }

    /**
     * Apply visual availability state to a radio and its label.
     * On the last non-length fieldset, unavailable options are hidden entirely.
     * On other fieldsets they are dimmed.
     * @param {HTMLInputElement} radio
     * @param {HTMLLabelElement|null} optionLabel
     * @param {boolean} isAvailable
     * @param {boolean} hideWhenUnavailable
     * @private
     */
    #applyAvailabilityStyles(radio, optionLabel, isAvailable, hideWhenUnavailable) {
      const wrapper = radio.parentElement;

      if (isAvailable) {
        radio.classList.remove('disabled');
        wrapper?.classList.remove('disabled');
        if (wrapper) wrapper.hidden = false;
        if (optionLabel) {
          optionLabel.style.opacity = '';
          optionLabel.style.textDecoration = '';
        }
      } else if (hideWhenUnavailable) {
        radio.classList.add('disabled');
        wrapper?.classList.add('disabled');
        if (wrapper) wrapper.hidden = true;
      } else {
        radio.classList.add('disabled');
        wrapper?.classList.add('disabled');
        if (wrapper) wrapper.hidden = false;
        if (optionLabel) {
          optionLabel.style.opacity = '0.5';
          optionLabel.style.textDecoration = 'none';
        }
      }
    }

    /**
     * Find the option index rendered as the length selector.
     * @returns {number} Length option index or -1 when absent
     * @private
     */
    #getLengthOptionIndex() {
      if (!Array.isArray(this.fieldsets)) {
        return -1;
      }

      return this.fieldsets.findIndex((fieldset) => fieldset.closest("length-slider"));
    }

    /**
     * Resolve the preferred product URL for the current non-length selections.
     * This keeps length changes anchored to the product family chosen by the other options.
     * @param {Array<string>} [selectedOptions=this.options] - Selected option values
     * @returns {string} Preferred product URL or empty string
     * @private
     */
    #getPreferredProductUrlForSelection(selectedOptions = this.options) {
      if (!Array.isArray(selectedOptions) || !Array.isArray(this.combinedListingsMap) || !this.combinedListingsMap.length) {
        return "";
      }

      const selectedOptionUrl = this.#getSelectedOptionProductUrl();
      if (selectedOptionUrl) {
        return selectedOptionUrl;
      }

      const lengthOptionIndex = this.#getLengthOptionIndex();
      if (lengthOptionIndex < 0 || !selectedOptions[lengthOptionIndex]) {
        return "";
      }

      const nonLengthOptions = selectedOptions.map((option, index) => (
        index === lengthOptionIndex ? null : option
      ));
      const matches = this.#getMatchingCombinedListings(nonLengthOptions);

      if (!matches.length) {
        return "";
      }

      const currentUrl = this.#normalizeProductUrl(this.currentProductUrl || this.dataset.url);
      const preferredMatch = matches.find((entry) => this.#normalizeProductUrl(entry.url) === currentUrl)
        || matches.find((entry) => entry.available === true)
        || matches[0];

      return preferredMatch?.url || "";
    }

    /**
     * Normalize product URLs so cross-product comparisons stay consistent.
     * @param {string} rawUrl - URL to normalize
     * @returns {string} Normalized pathname
     * @private
     */
    #normalizeProductUrl(rawUrl) {
      if (typeof rawUrl !== "string" || rawUrl.trim() === "") {
        return "";
      }

      try {
        const url = new URL(rawUrl, window.location.origin);
        const pathname = url.pathname.replace(/\/+$/, "");
        return pathname || "/";
      } catch (error) {
        const trimmedUrl = rawUrl.trim().replace(window.location.origin, "");
        const pathname = trimmedUrl.replace(/\/+$/, "");
        return pathname || "/";
      }
    }

    /**
     * Find a variant in the collected variant dataset by ID.
     * @param {number|string} variantId - Variant ID to resolve
     * @param {Array<Object>} allVariants - Variant dataset
     * @returns {Object|null} Matching variant object
     * @private
     */
    #findVariantById(variantId, allVariants) {
      if (!variantId || !Array.isArray(allVariants)) {
        return null;
      }

      const normalizedVariantId = String(variantId);
      return allVariants.find((variant) => String(variant?.id) === normalizedVariantId) || null;
    }

    /**
     * Resolve the exact combined-listing entry for the current full selection.
     * When duplicate option combinations exist, prefer the explicitly targeted entry,
     * then the current product context, and finally an available entry.
     * @param {Array<string>} [selectedOptions=this.options] - Selected option values
     * @returns {Object|null} Matching combined-listing entry
     * @private
     */
    #getExactCombinedListingMatch(selectedOptions = this.options) {
      if (!Array.isArray(selectedOptions) || !selectedOptions.length) {
        return null;
      }

      const matches = this.#getMatchingCombinedListings(selectedOptions).filter((entry) => {
        if (!entry || !Array.isArray(entry.options) || entry.options.length < selectedOptions.length) {
          return false;
        }

        for (let i = 0; i < selectedOptions.length; i++) {
          if (entry.options[i] !== selectedOptions[i]) {
            return false;
          }
        }

        return true;
      });

      if (!matches.length) {
        return null;
      }

      const targetVariantId = this.currentTargetVariantId ? String(this.currentTargetVariantId) : "";
      const preferredUrl = this.#normalizeProductUrl(
        this.#getPreferredProductUrlForSelection(selectedOptions) || this.currentProductUrl || this.dataset.url
      );
      const availableMatches = matches.filter((entry) => entry.available === true);

      return availableMatches.find((entry) => targetVariantId && String(entry.variantId) === targetVariantId)
        || availableMatches.find((entry) => this.#normalizeProductUrl(entry.url) === preferredUrl)
        || availableMatches[0]
        || matches.find((entry) => this.#normalizeProductUrl(entry.url) === preferredUrl && targetVariantId && String(entry.variantId) === targetVariantId)
        || matches.find((entry) => this.#normalizeProductUrl(entry.url) === preferredUrl)
        || matches.find((entry) => targetVariantId && String(entry.variantId) === targetVariantId)
        || matches[0];
    }

    updateOptions() {
      // Refresh fieldsets in case DOM was replaced
      this.fieldsets = [...this.querySelectorAll("fieldset")];

      // Get currently selected value from each fieldset
      this.options = this.fieldsets.map((fieldset) => {
        const checkedRadio = [...fieldset.elements].find((radio) => radio.checked && radio.type === 'radio');
        return checkedRadio ? checkedRadio.value : "";
      });
    }

    /**
     * Update availability states for all variant options
     * Cascading availability: First fieldset is always standard, second checks first,
     * third checks first+second, fourth checks first+second+third
     *
     * For combined listings: Check if option combination exists in any child product
     * For regular variants: Check variant data for availability
     */
    updateVariantsAvailability(changedFieldsetIndex = -1, pass = 0) {
      // Get all variants from JSON
      const allVariants = this.#getAllVariants();
      if (!allVariants || allVariants.length === 0) return;
      if (pass > this.fieldsets.length) return;
      let selectionChanged = false;

      // Get currently selected options
      const selectedOptions = this.fieldsets.map((fieldset) => {
        const checked = [...fieldset.elements].find((radio) => radio.checked && radio.type === 'radio');
        return checked ? checked.value : null;
      });

      // Determine how many fieldsets are combined listings vs regular variants
      // Combined listings fieldsets come first, then regular variant fieldsets
      const numCombinedListingsOptions = this.combinedListingsMap && this.combinedListingsMap.length > 0
        ? (this.combinedListingsMap[0]?.options?.length || 0)
        : 0;

      // The length option should never constrain availability of other option groups.
      // When evaluating type/power/cable, exclude the length index from the test options.
      const lengthOptionIndex = this.#getLengthOptionIndex();
      const lastNonLengthIndex = lengthOptionIndex >= 0
        ? this.fieldsets.length - (lengthOptionIndex === this.fieldsets.length - 1 ? 2 : 1)
        : this.fieldsets.length - 1;

      // For each fieldset, check which options are available
      this.fieldsets.forEach((fieldset, fieldsetIndex) => {
        const isCombinedListingsFieldset = fieldsetIndex < numCombinedListingsOptions;
        const excludeIndices = (lengthOptionIndex >= 0 && fieldsetIndex !== lengthOptionIndex)
          ? [lengthOptionIndex]
          : [];

        [...fieldset.elements].forEach((radio) => {
          if (radio.type !== 'radio') return;

          let isSelectable = false;
          let isAvailable = false;
          const optionLabel = radio.nextElementSibling?.tagName === 'LABEL'
            ? radio.nextElementSibling
            : null;

          // First fieldset: Always standard (no disabled classes)
          if (fieldsetIndex === 0) {
            if (isCombinedListingsFieldset && this.combinedListingsMap) {
              const optionUrl = this.#getOptionUrlForRadio(fieldset, fieldsetIndex, radio);
              const hasOptionUrl = !!optionUrl;
              const testOptions = this.#buildAvailabilityTestOptions(selectedOptions, fieldsetIndex, radio.value, excludeIndices);
              const matchingListings = this.#getMatchingCombinedListings(testOptions);

              isSelectable = matchingListings.length > 0;
              if (!isSelectable && hasOptionUrl) {
                isSelectable = true;
              }
              isAvailable = matchingListings.some((entry) => entry.available === true);
            } else {
              const testOptions = this.#buildAvailabilityTestOptions(selectedOptions, fieldsetIndex, radio.value, excludeIndices);
              const matchingVariants = this.#getMatchingVariants(testOptions, allVariants);

              isSelectable = matchingVariants.length > 0;
              isAvailable = matchingVariants.some((variant) => variant.available === true);
            }

            radio.setAttribute("available", isAvailable ? "true" : "false");
            radio.disabled = !isSelectable;

            if (!isSelectable && radio.checked) {
              radio.checked = false;
              selectionChanged = true;
            }

            this.#applyAvailabilityStyles(radio, optionLabel, isAvailable, fieldsetIndex === lastNonLengthIndex);
            return;
          }

          // For subsequent fieldsets: Check based on type (combined listings vs regular variants)
          if (isCombinedListingsFieldset && this.combinedListingsMap) {
            const optionUrl = this.#getOptionUrlForRadio(fieldset, fieldsetIndex, radio);
            const hasOptionUrl = !!optionUrl;
            const testOptions = this.#buildAvailabilityTestOptions(selectedOptions, fieldsetIndex, radio.value, excludeIndices);
            const matchingListings = this.#getMatchingCombinedListings(testOptions);

            isSelectable = matchingListings.length > 0;
            if (!isSelectable && hasOptionUrl) {
              isSelectable = true;
            }
            isAvailable = matchingListings.some((entry) => entry.available === true);
          } else {
            const testOptions = this.#buildAvailabilityTestOptions(selectedOptions, fieldsetIndex, radio.value, excludeIndices);
            const matchingVariants = this.#getMatchingVariants(testOptions, allVariants);

            isSelectable = matchingVariants.length > 0;
            isAvailable = matchingVariants.some((variant) => variant.available === true);
          }

          radio.setAttribute("available", isAvailable ? "true" : "false");
          radio.disabled = !isSelectable;

          if (!isSelectable && radio.checked) {
            radio.checked = false;
            selectionChanged = true;
          }

          this.#applyAvailabilityStyles(radio, optionLabel, isAvailable, fieldsetIndex === lastNonLengthIndex);
        });

        const fieldsetRadios = [...fieldset.elements].filter((radio) => radio.type === 'radio');
        const hasCheckedRadio = fieldsetRadios.some((radio) => radio.checked);
        const checkedRadio = fieldsetRadios.find((radio) => radio.checked) || null;
        const shouldCascadeSelect = changedFieldsetIndex >= 0 && fieldsetIndex > changedFieldsetIndex;
        const firstAvailableRadio = fieldsetRadios.find((radio) => !radio.disabled && radio.getAttribute("available") === "true");

        if (
          shouldCascadeSelect
          && checkedRadio
          && (checkedRadio.disabled || checkedRadio.getAttribute("available") !== "true")
          && firstAvailableRadio
          && firstAvailableRadio !== checkedRadio
        ) {
          checkedRadio.checked = false;
          firstAvailableRadio.checked = true;
          selectionChanged = true;
          return;
        }

        if (!hasCheckedRadio) {
          const fallbackSelectableRadio = shouldCascadeSelect ? null : fieldsetRadios.find((radio) => !radio.disabled);
          const autoSelectRadio = firstAvailableRadio || fallbackSelectableRadio;
          if (autoSelectRadio) {
            autoSelectRadio.checked = true;
            selectionChanged = true;
          }
        }
      });

      if (selectionChanged) {
        this.updateOptions();
        this.updateVariantsAvailability(changedFieldsetIndex, pass + 1);
      }
    }

    /**
     * Get current variant from the single-variant JSON
     * This is the Horizon approach - server sends back the selected variant
     * @returns {Object|null} Current variant object
     */
    getCurrentVariant() {
      try {
        // Be explicit: this component also contains other JSON scripts (all variants, URLs, etc.)
        // so we must target the *current variant* only.
        const variantJsonElement = this.querySelector(".current-variant-json");
        if (!variantJsonElement) return null;

        const variant = JSON.parse(variantJsonElement.textContent);
        return variant || null;
      } catch (error) {
        console.error('Failed to parse current variant:', error);
        return null;
      }
    }

    /**
     * Get all variants from the all-variants JSON (for availability checking)
     * @returns {Array} Array of all variant objects
     * @private
     */
    #getAllVariants() {
      try {
        const variantJsonElement = this.querySelector(".variant-json");
        if (!variantJsonElement) return [];

        const variants = JSON.parse(variantJsonElement.textContent);
        return Array.isArray(variants) ? variants : [];
      } catch (error) {
        console.error('Failed to parse variants:', error);
        return [];
      }
    }

    /**
     * Fetch and render updated product info based on current selections
     * Uses data-variant-dynamic to update specific sections
     */
    renderProductInfo(hasLocalVariant = false) {
      try {
        const sectionId = this.dataset.section;

        // Build fetch URL using option_values (Horizon's approach)
        const baseUrl = this.currentProductUrl || this.dataset.url;
        const normalizedBaseUrl = this.#normalizeProductUrl(baseUrl);
        const normalizedDatasetUrl = this.#normalizeProductUrl(this.dataset.url);

        // Only update the parts we actually want to change on variant switch.
        // For combined listing cross-product navigation, also update the media slider
        // and product title so the UI matches the product URL.
        // For same-product variant changes, keep slider intact to avoid resets/layout shifts.
        const isCrossProductNavigation = normalizedBaseUrl !== "" && normalizedBaseUrl !== normalizedDatasetUrl;
        const selectedOptionValueIds = [];
        this.fieldsets.forEach((fieldset) => {
          const checkedRadio = fieldset.querySelector('input[type="radio"]:checked');
          if (checkedRadio && checkedRadio.dataset.optionValueId) {
            selectedOptionValueIds.push(checkedRadio.dataset.optionValueId);
          }
        });

        let fetchUrl = `${baseUrl}?section_id=${sectionId}`;
        if (isCrossProductNavigation) {
          if (this.currentTargetVariantId) {
            fetchUrl = `${baseUrl}?variant=${this.currentTargetVariantId}&section_id=${sectionId}`;
          } else if (selectedOptionValueIds.length > 0) {
            // When we know the target product URL but do not yet have an exact variant ID,
            // ask Shopify to resolve the selection by option values instead of falling back
            // to the target product's default variant.
            fetchUrl = `${baseUrl}?option_values=${selectedOptionValueIds.join(',')}&section_id=${sectionId}`;
          }
        } else {
          if (selectedOptionValueIds.length === 0) return;
          fetchUrl = `${baseUrl}?option_values=${selectedOptionValueIds.join(',')}&section_id=${sectionId}`;
        }

        const DYNAMIC_IDS_TO_UPDATE = isCrossProductNavigation
          ? ["variant-price", "product-slider-main", "product-title", "variant-radios"]
          : ["variant-price", "product-title"];
        const elementsToUpdate = DYNAMIC_IDS_TO_UPDATE
          .flatMap((id) => Array.from(
            this.productParentElement.querySelectorAll(`[data-variant-dynamic="${id}"]`)
          ))
          .filter(Boolean);

        if (elementsToUpdate.length === 0) return;
        elementsToUpdate.forEach((item) => item.classList.add("opacity-20"));

        // Abort any previous in-flight fetch so stale responses never overwrite newer selections.
        if (this._renderFetchController) {
          this._renderFetchController.abort();
        }
        this._renderFetchController = new AbortController();
        const { signal } = this._renderFetchController;

        fetch(fetchUrl, { signal })
          .then((response) => response.text())
          .then((responseText) => {
            const html = new DOMParser().parseFromString(responseText, "text/html");
            const sourceProductParent = html.querySelector("[data-section][data-product]");
            if (sourceProductParent?.dataset.product) {
              this.productParentElement.dataset.product = sourceProductParent.dataset.product;
            }

            // Update only whitelisted dynamic blocks (e.g. price).
            DYNAMIC_IDS_TO_UPDATE.forEach((id) => {
              const source = html.querySelector(`[data-variant-dynamic="${id}"]`);
              if (!source) return;

              const targets = this.productParentElement.querySelectorAll(
                `[data-variant-dynamic="${id}"]`
              );
              if (!targets.length) return;

              targets.forEach((target) => {
                Array.from(target.attributes).forEach((attribute) => {
                  if (!source.hasAttribute(attribute.name)) {
                    target.removeAttribute(attribute.name);
                  }
                });
                Array.from(source.attributes).forEach((attribute) => {
                  target.setAttribute(attribute.name, attribute.value);
                });
                target.innerHTML = source.innerHTML;
              });
            });

            if (isCrossProductNavigation) {
              this.#refreshStateAfterProductSwap(baseUrl, hasLocalVariant);
            }

            // Remove loading state
            elementsToUpdate.forEach((item) => item.classList.remove("opacity-20"));
          })
          .catch((error) => {
            if (error.name === 'AbortError') return;
            console.error('Failed to fetch product info:', error);
            elementsToUpdate.forEach((item) => item.classList.remove("opacity-20"));
          });
      } catch (error) {
        console.error('Error in renderProductInfo:', error);
      }
    }

    /**
     * Update product-buttons availability based on current variant
     */
    updateButtonAvailability() {
      const currentVariant = this.#hasCompleteSelection()
        ? this.#getSelectedVariantFromOptions()
        : this.getCurrentVariant();
      const availabilityState = this.#getAvailabilityState(currentVariant);
      const isAvailable = availabilityState === "available";
      const availableString = isAvailable ? "true" : "false";

      this.productButtons = this.productParentElement.querySelectorAll("product-buttons");
      this.productButtons.forEach((button) => {
        button.setAttribute("availability", availabilityState);
        button.setAttribute("available", availableString);

        // Force update if method exists
        if (button.updateButtonState && typeof button.updateButtonState === 'function') {
          button.updateButtonState();
        }
      });

      // Re-apply on next frame so UI never stays stale after nested radio/slider updates.
      requestAnimationFrame(() => {
        this.productButtons.forEach((button) => {
          button.setAttribute("availability", availabilityState);
          button.setAttribute("available", availableString);
          if (button.updateButtonState && typeof button.updateButtonState === 'function') {
            button.updateButtonState();
          }
        });
      });

      this.qtyInput?.setAttribute("available", availableString);
    }

    /**
     * Public accessor for the currently selected variant based on checked options.
     * Returns null when the current checked combination does not resolve to a variant.
     * @returns {Object|null}
     */
    getSelectedVariant() {
      return this.#getSelectedVariantFromOptions();
    }

    updateURL() {
      // Check if URL updates are disabled
      if (this.dataset.updateUrl === "false") return;

      // If we have a currentProductUrl from combined listings, always use it —
      // even when the selected variant is not resolvable in the local JSON yet.
      if (this.currentProductUrl) {
        try {
          const url = new URL(this.currentProductUrl, window.location.origin);
          if (this.currentTargetVariantId) {
            url.searchParams.set('variant', this.currentTargetVariantId);
          }
          window.history.replaceState({}, "", url.toString());
        } catch (error) {}
        return;
      }

      const currentVariant = this.#getSelectedVariantFromOptions() || this.getCurrentVariant();
      if (!currentVariant) return;

      // Regular variant URL update
      if (!this.quickAtcMode || !window.location.pathname.includes("/products/")) {
        return;
      }

      try {
        const url = new URL(window.location.href);
        url.searchParams.set('variant', currentVariant.id);
        window.history.replaceState({}, "", url.toString());
      } catch (error) {}
    }

    updateVariantInput() {
      const currentVariant = this.#getSelectedVariantFromOptions() || this.getCurrentVariant();
      if (!currentVariant) return;
      this.#updateVariantInputWithId(currentVariant.id);
    }

    /**
     * Find the selected variant by matching current option values against `variant-json`.
     * @returns {Object|null} Variant object
     * @private
     */
    #getSelectedVariantFromOptions() {
      try {
        // Ensure we have latest option selections.
        if (!this.options) this.updateOptions();
        if (!this.options || this.options.length === 0) return null;
        if (!this.#hasCompleteSelection()) return null;

        const allVariants = this.#getAllVariants();
        if (!allVariants || allVariants.length === 0) return null;

        const combinedListingMatch = this.#getExactCombinedListingMatch(this.options);
        if (combinedListingMatch?.variantId) {
          const matchedVariant = this.#findVariantById(combinedListingMatch.variantId, allVariants);
          if (matchedVariant) {
            return matchedVariant;
          }
        }

        const matchingVariants = this.#getMatchingVariants(this.options, allVariants);
        if (!matchingVariants.length) {
          return null;
        }

        const targetVariantId = this.currentTargetVariantId ? String(this.currentTargetVariantId) : "";
        return matchingVariants.find((variant) => targetVariantId && String(variant?.id) === targetVariantId)
          || matchingVariants.find((variant) => variant?.available === true)
          || matchingVariants[0]
          || null;
      } catch (error) {
        return null;
      }
    }

    /**
     * Resolve the add-to-cart availability state for the current selection.
     * @param {Object|null} currentVariant - Currently matched variant
     * @returns {string} One of "available", "sold-out", or "unavailable"
     * @private
     */
    #getAvailabilityState(currentVariant) {
      if (!this.#hasCompleteSelection() || this.#hasDisabledCheckedOption()) {
        return "unavailable";
      }

      const combinedListingMatch = this.#getExactCombinedListingMatch();
      if (combinedListingMatch) {
        return combinedListingMatch.available === true ? "available" : "sold-out";
      }

      if (this.#hasUnavailableCheckedOption()) {
        return currentVariant?.available === false ? "sold-out" : "unavailable";
      }

      if (!currentVariant) {
        return "unavailable";
      }

      if (currentVariant.available !== true) {
        return "sold-out";
      }

      return "available";
    }

    /**
     * Check whether all option groups currently have a selected value.
     * @returns {boolean} True when every fieldset has a selection
     * @private
     */
    #hasCompleteSelection() {
      if (!this.options) {
        this.updateOptions();
      }

      return Array.isArray(this.options)
        && this.options.length > 0
        && this.options.every((option) => typeof option === "string" && option.trim() !== "");
    }

    /**
     * Check if the current checked selection includes an option that cannot be selected.
     * @returns {boolean} True when any checked radio is disabled
     * @private
     */
    #hasDisabledCheckedOption() {
      const checkedRadios = this.querySelectorAll('input[type="radio"]:checked');

      for (const radio of checkedRadios) {
        if (radio.disabled) {
          return true;
        }
      }

      return false;
    }

    /**
     * Check if the current checked selection includes an option marked unavailable.
     * @returns {boolean} True when any checked radio is marked unavailable
     * @private
     */
    #hasUnavailableCheckedOption() {
      const checkedRadios = this.querySelectorAll('input[type="radio"]:checked');

      for (const radio of checkedRadios) {
        if (radio.getAttribute("available") === "false") {
          return true;
        }
      }

      return false;
    }

    /**
     * Refresh cached references and rerun availability logic after swapping to another product context.
     * @private
     */
    #refreshStateAfterProductSwap(baseUrl, hasLocalVariant = false) {
      this.fieldsets = [...this.querySelectorAll("fieldset")];
      this.qtyInput = this.productParentElement.querySelector("quantity-input");
      this.productButtons = this.productParentElement.querySelectorAll("product-buttons");
      this.productForms = this.productParentElement.querySelectorAll("product-form");
      this.outputs = this.productParentElement.querySelectorAll("._selectedOption");
      this.quantitySelector = this.productParentElement.querySelector("quantity-input");

      this.#loadOptionData();
      if (typeof baseUrl === "string" && baseUrl.trim() !== "") {
        this.dataset.url = baseUrl;
      }
      this.currentProductUrl = null;
      this.currentTargetVariantId = null;
      this.updateOptions();
      this.updateVariantsAvailability();
      this.#refreshLengthSliderState();
      this.updateVariantSelectedState(this.#hasCompleteSelection());
      this.updateOutputs();

      const currentVariant = this.#getSelectedVariantFromOptions() || this.getCurrentVariant();
      if (currentVariant?.id) {
        this.#updateVariantInputWithId(currentVariant.id);
      }

      this.updateButtonAvailability();
      this.updateStickyOutput();
    }

    /**
     * Update variant input fields with a specific variant ID
     * @param {number|string} variantId - The variant ID to set
     * @private
     */
    #updateVariantInputWithId(variantId) {
      if (!variantId) return;

      try {
        // Update forms in product-form components
        const productForms = this.productParentElement?.querySelectorAll('product-form') || [];
        productForms.forEach((productForm) => {
          const input = productForm.querySelector('input[name="id"]');
          if (input) {
            input.value = variantId;
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }
        });

        // Also update forms in product-card-atc components
        const productCardAtcs = this.productParentElement?.querySelectorAll('product-card-atc') || [];
        productCardAtcs.forEach((atcComponent) => {
          const form = atcComponent.querySelector('form[data-type="add-to-cart-form"]');
          if (form) {
            const input = form.querySelector('input[name="id"]');
            if (input) {
              input.value = variantId;
              input.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }
        });

        // Update quantity selector
        const quantitySelector = this.productParentElement?.querySelector("quantity-input");
        if (quantitySelector) {
          quantitySelector.dataset.id = variantId;
        }
      } catch (error) {
        console.error('Failed to update variant input:', error);
      }
    }
  }

  customElements.define("variant-radios", VariantRadios);
}
