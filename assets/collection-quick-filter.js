/**
 * CollectionQuickFilter - Desktop-only quick filter toggle controller
 *
 * Controls the open/closed state of the quick filter panel in `m--filters.liquid`.
 * Uses data attributes to avoid tight coupling to markup structure.
 *
 * Expected markup:
 * <collection-quick-filter>
 *   <button data-quick-filter-toggle>...</button>
 *   <div data-quick-filter-panel class="hidden">...</div>
 * </collection-quick-filter>
 */
class CollectionQuickFilter extends HTMLElement {
  /** @type {AbortController | null} */
  #abortController = null;

  /** @type {HTMLButtonElement | null} */
  #toggle = null;

  /** @type {HTMLElement | null} */
  #panel = null;

  /** @type {HTMLElement | null} */
  #iconPlus = null;

  /** @type {HTMLElement | null} */
  #iconMinus = null;

  connectedCallback() {
    try {
      this.#abortController?.abort();
      this.#abortController = new AbortController();
      const signal = { signal: this.#abortController.signal };

      this.#toggle = this.querySelector('[data-quick-filter-toggle]');
      this.#panel = this.querySelector('[data-quick-filter-panel]');
      this.#iconPlus = this.querySelector('[data-quick-filter-icon-plus]');
      this.#iconMinus = this.querySelector('[data-quick-filter-icon-minus]');

      if (!this.#toggle || !this.#panel) return;

      // Initialize state from attribute (defaults to true if not set)
      const isOpen = this.getAttribute('data-open') !== 'false';
      this.#setOpen(isOpen);

      this.#toggle.addEventListener('click', (event) => {
        event.preventDefault();
        this.#setOpen(!this.#isOpen());
      }, signal);
    } catch (error) {
      console.error('CollectionQuickFilter: failed to initialize', error);
    }
  }

  disconnectedCallback() {
    this.#abortController?.abort();
    this.#abortController = null;
  }

  /**
   * @returns {boolean}
   */
  #isOpen() {
    return this.getAttribute('data-open') === 'true';
  }

  /**
   * @param {boolean} open
   */
  #setOpen(open) {
    try {
      this.setAttribute('data-open', open ? 'true' : 'false');

      if (this.#toggle) {
        this.#toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      }

      if (this.#panel) {
        this.#panel.classList.toggle('hidden', !open);
      }

      if (this.#iconPlus) {
        this.#iconPlus.classList.toggle('hidden', open);
      }

      if (this.#iconMinus) {
        this.#iconMinus.classList.toggle('hidden', !open);
      }

      this.dispatchEvent(new CustomEvent('quick-filter:toggle', {
        detail: { open },
        bubbles: true
      }));
    } catch (error) {
      console.error('CollectionQuickFilter: failed to update state', error);
    }
  }
}

if (!customElements.get('collection-quick-filter')) {
  customElements.define('collection-quick-filter', CollectionQuickFilter);
}


