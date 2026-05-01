if (!customElements.get('sticky-atc')) {
  customElements.define(
    'sticky-atc',
    class StickyAtc extends HTMLElement {
      #formWrapper;
      #stickyElement;
      #isVisible = false;
      #animation = null;
      #observer;
      #isAtBottom = false;
      #scrollHandler;
      #abortController = null;
      #radiosAbortController = null;
      #lengthMutationObserver = null;
      #isSyncingLength = false;
      #isLengthRefreshQueued = false;

      constructor() {
        super();
      }

      connectedCallback() {
        this.#formWrapper = document.querySelector('product-buttons');
        this.#stickyElement = this.firstElementChild;
        if (!this.#stickyElement) return;
        this.#stickyElement.id = 'sticky-atc';
        this.#scrollHandler = () => this.#handleScroll();
        this.#setupObserver();
        this.#setupLengthDropdownSync();
        window.addEventListener('scroll', this.#scrollHandler, { passive: true });
      }

      /**
       * Lifecycle: When element is removed from DOM
       */
      disconnectedCallback() {
        this.#observer?.disconnect();
        this.#animation?.cancel();
        this.#abortController?.abort();
        this.#radiosAbortController?.abort();
        this.#lengthMutationObserver?.disconnect();
        window.removeEventListener('scroll', this.#scrollHandler);
      }

      /**
       * Two-way sync between sticky length dropdown and main form length radios.
       * Dropdown → radios: user picks a value in the dropdown, the matching radio is checked.
       * Radios → dropdown: main slider (or any other source) checks a radio, the dropdown follows.
       */
      #setupLengthDropdownSync() {
        const select = this.querySelector('[data-length-dropdown]');
        if (!select) return;

        this.#abortController = new AbortController();
        const { signal } = this.#abortController;

        select.addEventListener('change', (e) => this.#handleDropdownChange(e), { signal });
        this.#refreshLengthDropdownSync();
        this.#observeLengthSourceChanges();
      }

      /**
       * Observe variant-radios subtree so sticky dropdown can refresh
       * when the length slider/radios are replaced after variant refetches.
       */
      #observeLengthSourceChanges() {
        const variantRadios = document.querySelector('variant-radios');
        if (!variantRadios) return;

        this.#lengthMutationObserver?.disconnect();
        this.#lengthMutationObserver = new MutationObserver((mutations) => {
          const hasChildListChanges = mutations.some((mutation) => mutation.type === 'childList');
          if (!hasChildListChanges) return;
          this.#queueLengthDropdownRefresh();
        });

        this.#lengthMutationObserver.observe(variantRadios, {
          childList: true,
          subtree: true
        });
      }

      /**
       * Queue a single dropdown refresh in the next frame.
       */
      #queueLengthDropdownRefresh() {
        if (this.#isLengthRefreshQueued) return;
        this.#isLengthRefreshQueued = true;

        requestAnimationFrame(() => {
          this.#isLengthRefreshQueued = false;
          this.#refreshLengthDropdownSync();
        });
      }

      /**
       * Rebuild sticky length options from the current main form radios,
       * then rebind change listeners to the latest radios.
       */
      #refreshLengthDropdownSync() {
        const select = this.querySelector('[data-length-dropdown]');
        if (!select) return;

        const radios = this.#getLengthRadios(select);
        if (!radios.length) return;

        const checkedValue = radios.find((radio) => radio.checked)?.value;
        const currentValue = select.value;
        const nextValues = radios.map((radio) => radio.value);
        const nextLabels = radios.map((radio) => radio.value.replace(' Meter', 'm'));

        select.replaceChildren();
        nextValues.forEach((value, index) => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = nextLabels[index];
          select.append(option);
        });

        const selectedValue = checkedValue
          || (nextValues.includes(currentValue) ? currentValue : nextValues[0]);
        if (selectedValue) {
          select.value = selectedValue;
        }

        this.#bindLengthRadioListeners(select, radios);
      }

      /**
       * Get length radios associated with sticky dropdown metadata.
       * @param {HTMLSelectElement} select - Sticky length select element.
       * @returns {HTMLInputElement[]} Current length radios in main form.
       */
      #getLengthRadios(select) {
        const { optionName, optionPosition, optionNameAttr } = select.dataset;
        if (!optionName || optionPosition == null || !optionNameAttr) {
          return [];
        }

        const radioName = `${optionName}-${optionPosition}-${optionNameAttr}`;
        const variantRadios = document.querySelector('variant-radios');
        const scopedRadios = variantRadios
          ? Array.from(
              variantRadios.querySelectorAll(
                `input[type="radio"].length-radio[name="${radioName}"]`
              )
            )
          : [];

        if (scopedRadios.length > 0) {
          const currentFormId = scopedRadios[0].getAttribute('form');
          if (currentFormId && select.dataset.formId !== currentFormId) {
            select.dataset.formId = currentFormId;
          }
          return scopedRadios;
        }

        const formId = select.dataset.formId;
        if (!formId) {
          return [];
        }

        return Array.from(
          document.querySelectorAll(
            `input[type="radio"].length-radio[form="${formId}"][name="${radioName}"]`
          )
        );
      }

      /**
       * Bind sticky dropdown sync listeners to current radios.
       * @param {HTMLSelectElement} select - Sticky length select element.
       * @param {HTMLInputElement[]} radios - Current length radios.
       */
      #bindLengthRadioListeners(select, radios) {
        this.#radiosAbortController?.abort();
        this.#radiosAbortController = new AbortController();
        const { signal } = this.#radiosAbortController;

        radios.forEach((radio) => {
          radio.addEventListener('change', () => {
            if (this.#isSyncingLength) return;
            this.#refreshLengthDropdownSync();
            if (radio.checked && select.value !== radio.value) {
              select.value = radio.value;
            }
          }, { signal });
        });
      }

      /**
       * When sticky dropdown changes, check the matching length radio in the main form so variant-radios and slider update.
       */
      #handleDropdownChange(event) {
        const select = event.target;
        const radios = this.#getLengthRadios(select);
        const radio = radios.find((r) => r.value === select.value);
        if (!radio) return;

        this.#isSyncingLength = true;
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        this.#isSyncingLength = false;
      }

      /**
       * Sync dropdown selected value from the main form's checked length radio (e.g. when bar becomes visible).
       */
      #syncDropdownFromForm() {
        const select = this.querySelector('[data-length-dropdown]');
        if (!select) return;
        this.#refreshLengthDropdownSync();
        const radios = this.#getLengthRadios(select);
        const checked = radios.find((radio) => radio.checked) || null;
        if (checked && select.value !== checked.value) select.value = checked.value;
      }

      /**
       * Initialize Intersection Observer to watch form wrapper
       */
      #setupObserver() {
        const options = {
          threshold: 0,
          rootMargin: '0px'
        };

        this.#observer = new IntersectionObserver(
          this.#handleIntersect.bind(this),
          options
        );
        this.#observer.observe(this.#formWrapper);
      }

      /**
       * Handle intersection changes
       */
      #handleIntersect(entries) {
        const [entry] = entries;
        const { bottom } = this.#formWrapper.getBoundingClientRect();
        const isFormAboveFold = bottom < 100;

        if (!entry.isIntersecting && isFormAboveFold) {
          this.#show();
        } else {
          this.#hide();
        }
      };

      /**
       * Show sticky element with animation
       */
      #show() {
        if (this.#isVisible) return;

        this.#stickyElement.classList.remove('translate-y-full', 'opacity-0');
        this.#isVisible = true;
        this.#syncDropdownFromForm();

        const chatButton = document.getElementById('chat-button');
        if (chatButton) chatButton.style.display = 'none';
      }

      /**
       * Hide sticky element with animation
       */
      #hide() {
        if (!this.#isVisible) return;

        this.#stickyElement.classList.add('translate-y-full', 'opacity-0');
        this.#isVisible = false;
        
        // Show chat button when sticky ATC is hidden
        const chatButton = document.getElementById('chat-button');
        if (chatButton) {
          chatButton.style.display = '';
        }
      }

      /**
       * Handle window scroll events
       */
      #handleScroll() {
        if (!this.#stickyElement) return;

        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const footerHeight = 200; // Approximate footer height
        
        // Check if we're near the bottom (with footer consideration)
        const isAtBottom = (windowHeight + scrollTop) >= (documentHeight - footerHeight);
        
        if (isAtBottom !== this.#isAtBottom) {
          this.#isAtBottom = isAtBottom;
          
          if (isAtBottom) {
            this.#hide();
          } else if (!this.#isVisible) {
            // Only show if we were previously hidden by scroll and the form is above fold
            const { bottom } = this.#formWrapper.getBoundingClientRect();
            const isFormAboveFold = bottom < 100;
            if (isFormAboveFold) {
              this.#show();
            }
          }
        }
      }
    }
  );
}
