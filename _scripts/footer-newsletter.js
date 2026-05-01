/**
 * Footer Newsletter Form Component
 * Handles newsletter form validation and accessibility enhancements
 */
class FooterNewsletter extends HTMLElement {
  #form = null;
  #emailInput = null;
  #errorElement = null;
  #isConnected = false;

  constructor() {
    super();
    this.#bindEventHandlers();
  }

  #bindEventHandlers() {
    // No binding needed for private methods; remove assignments to avoid errors.
  }

  connectedCallback() {
    if (this.#isConnected) return;
    this.#isConnected = true;

    try {
      this.#initializeElements();
      this.#attachEventListeners();
    } catch (error) {
      console.error('FooterNewsletter: Initialization error:', error);
    }
  }

  disconnectedCallback() {
    this.#removeEventListeners();
    this.#isConnected = false;
  }

  #initializeElements() {
    this.#form = this.querySelector('#footer-newsletter-form');
    this.#emailInput = this.querySelector('#footer-subscription');
    this.#errorElement = this.querySelector('#newsletter-error');

    if (!this.#form || !this.#emailInput || !this.#errorElement) {
      throw new Error('Required form elements not found');
    }
  }

  #attachEventListeners() {
    this.#emailInput.addEventListener('input', this.#handleInput, { passive: true });
    this.#form.addEventListener('submit', this.#handleSubmit);
    this.#emailInput.addEventListener('keydown', this.#handleKeydown);
  }

  #removeEventListeners() {
    if (this.#emailInput) {
      this.#emailInput.removeEventListener('input', this.#handleInput);
      this.#emailInput.removeEventListener('keydown', this.#handleKeydown);
    }
    if (this.#form) {
      this.#form.removeEventListener('submit', this.#handleSubmit);
    }
  }

  #handleInput() {
    const isValid = this.#emailInput.checkValidity();
    this.#emailInput.setAttribute('aria-invalid', !isValid);
    
    if (isValid) {
      this.#errorElement.classList.add('hidden');
      this.#errorElement.textContent = '';
    }
  }

  #handleSubmit(e) {
    if (!this.#emailInput.checkValidity()) {
      e.preventDefault();
      this.#emailInput.setAttribute('aria-invalid', 'true');
      this.#errorElement.classList.remove('hidden');
      this.#errorElement.textContent = 'Please enter a valid email address.';
      this.#emailInput.focus();
    }
  }

  #handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.#form.requestSubmit();
    }
  }

  // Static utility methods for testing and external access
  static getForm(formId = 'footer-newsletter-form') {
    return document.getElementById(formId);
  }

  static getEmailInput(inputId = 'footer-subscription') {
    return document.getElementById(inputId);
  }
}

// Register component with safety check
if (!customElements.get('footer-newsletter')) {
  customElements.define('footer-newsletter', FooterNewsletter);
}

// Module export support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FooterNewsletter;
} 