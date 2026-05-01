/**
 * ElectricPub - Simple Event Publisher
 * Dispatches custom events when buttons or radio buttons inside are interacted with
 * 
 * @example
 * <electric-pub data-channel=".my-section" data-hover-event="prefetch" data-click-event="fetch">
 *   <button data-detail-url="/collections/all" data-detail-foo="bar">All Products</button>
 * </electric-pub>
 * 
 * @example With radio buttons for tabs
 * <electric-pub data-channel=".my-section" data-change-event="fetch">
 *   <input type="radio" name="tabs" id="tab1" data-detail-url="/collections/all" checked>
 *   <label for="tab1">All Products</label>
 * </electric-pub>
 */
class ElectricPub extends HTMLElement {
  #isConnected = false;

  constructor() {
    super();
    this.handleMouseOver = this.handleMouseOver.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.handleFocus = this.handleFocus.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  connectedCallback() {
    if (this.#isConnected) return;
    
    this.addEventListener('mouseover', this.handleMouseOver, { passive: true });
    this.addEventListener('click', this.handleClick, { passive: true });
    this.addEventListener('change', this.handleChange, { passive: true });
    this.addEventListener('focus', this.handleFocus, { passive: true });
    this.addEventListener('keydown', this.handleKeyDown);
    this.#isConnected = true;
  }

  disconnectedCallback() {
    if (!this.#isConnected) return;
    
    this.removeEventListener('mouseover', this.handleMouseOver);
    this.removeEventListener('click', this.handleClick);
    this.removeEventListener('change', this.handleChange);
    this.removeEventListener('focus', this.handleFocus);
    this.removeEventListener('keydown', this.handleKeyDown);
    this.#isConnected = false;
  }

  handleMouseOver(event) {
    this.#processEvent(event, 'hoverEvent');
  }

  handleClick(event) {
    this.#processEvent(event, 'clickEvent');
  }

  handleChange(event) {
    this.#processEvent(event, 'changeEvent');
  }

  handleFocus(event) {
    this.#processEvent(event, 'focusEvent');
  }

  handleKeyDown(event) {
    const target = event.target;
    if (target.role !== 'tab') return;

    const tabs = Array.from(this.querySelectorAll('[role="tab"]'));
    const currentIndex = tabs.indexOf(target);

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        const prevIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
        this.#activateTab(tabs[prevIndex]);
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        const nextIndex = currentIndex === tabs.length - 1 ? 0 : currentIndex + 1;
        this.#activateTab(tabs[nextIndex]);
        break;
      case 'Home':
        event.preventDefault();
        this.#activateTab(tabs[0]);
        break;
      case 'End':
        event.preventDefault();
        this.#activateTab(tabs[tabs.length - 1]);
        break;
    }
  }

  #processEvent(event, eventTypeKey) {
    // Handle both button clicks and radio button changes
    const interactiveElement = event.target.closest('button') || event.target.closest('input[type="radio"]') || event.target.querySelector('input[type="radio"]');

    if (!interactiveElement) return;

    // For tab buttons, activate the tab on click
    if (eventTypeKey === 'clickEvent' && interactiveElement.role === 'tab') {
      this.#activateTab(interactiveElement);
    }

    const eventName = this.dataset[eventTypeKey];
    if (!eventName) return;

    const channel = this.dataset.channel;
    if (!channel) return;

    const targetElement = document.querySelector(channel);
    if (!targetElement) return;

    const detail = {};
    
    // Add all data-detail-* properties to the detail object
    Array.from(interactiveElement.attributes).forEach(attr => {
      if (attr.name.startsWith('data-detail-')) {
        const key = attr.name.replace('data-detail-', '');
        detail[key] = attr.value;
      }
    });

    // For radio buttons, add the checked state
    if (interactiveElement.type === 'radio') {
      detail.checked = interactiveElement.checked;
      detail.name = interactiveElement.name;
      detail.value = interactiveElement.value;
    }

    // For tab buttons, add active state
    if (interactiveElement.role === 'tab') {
      detail.active = interactiveElement.getAttribute('aria-selected') === 'true';
      detail.tabId = interactiveElement.id;
    }

    targetElement.dispatchEvent(new CustomEvent(eventName, {
      detail,
      bubbles: true,
      cancelable: true
    }));
  }

  #activateTab(tab) {
    // Deactivate all tabs
    const tabs = Array.from(this.querySelectorAll('[role="tab"]'));
    tabs.forEach(t => {
      t.setAttribute('aria-selected', 'false');
      t.setAttribute('tabindex', '-1');
      t.removeAttribute('data-active');
    });

    // Activate selected tab
    tab.setAttribute('aria-selected', 'true');
    tab.setAttribute('tabindex', '0');
    tab.setAttribute('data-active', 'true');
    tab.focus();
  }

  /**
   * Get all radio buttons within this component
   * @returns {NodeListOf<HTMLInputElement>}
   */
  static getRadioButtons(element) {
    return element.querySelectorAll('input[type="radio"]');
  }

  /**
   * Get the currently checked radio button
   * @returns {HTMLInputElement|null}
   */
  static getCheckedRadio(element) {
    return element.querySelector('input[type="radio"]:checked');
  }

  /**
   * Check a specific radio button by value
   * @param {string} value - The value of the radio button to check
   */
  static checkRadioByValue(element, value) {
    const radio = element.querySelector(`input[type="radio"][value="${value}"]`);
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}

if (!customElements.get('electric-pub')) {
  customElements.define('electric-pub', ElectricPub);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ElectricPub;
}