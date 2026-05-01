/**
 * ElectricModal - Advanced Modal Dialog Component
 * 
 * A flexible modal system that supports dynamic content, multiple triggers,
 * accessibility features, and smooth animations.
 * 
 * @example Basic modal with trigger
 * <button data-modal-trigger="my-modal">Open Modal</button>
 * <electric-modal id="my-modal">
 *   <div slot="content">
 *     <h2>Modal Title</h2>
 *     <p>Modal content goes here</p>
 *   </div>
 * </electric-modal>
 * 
 * @example Quick add to cart modal
 * <electric-modal id="quick-add-modal" data-size="medium" data-close-on-backdrop="true">
 *   <div slot="content">
 *     <!-- Dynamic content will be injected here -->
 *   </div>
 * </electric-modal>
 * 
 * @example Programmatic usage
 * const modal = document.querySelector('#my-modal');
 * modal.open({ productId: '123' });
 * modal.close();
 */
class ElectricModal extends HTMLElement {
  // Private fields
  #isConnected = false;
  #openingTimeout = null;
  #closingTimeout = null;
  #previousFocus = null;
  #escapeHandler = null;
  #clickHandler = null;
  #focusTrap = null;
  #scrollPosition = 0;
  #animationDuration = 300;
  #content = null;
  #backdrop = null;
  #dialog = null;
  #closeButtons = [];
  #openData = null;
  
  // Constants
  static #FOCUSABLE_ELEMENTS = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

  constructor() {
    super();
    
    // Bind event handlers
    this.#escapeHandler = this.#handleEscape.bind(this);
    this.#clickHandler = this.#handleClick.bind(this);
    
    // Set up shadow DOM with slots
    this.attachShadow({ mode: 'open' });
    this.#render();
  }

  connectedCallback() {
    if (this.#isConnected) return;
    
    try {
      this.#moveToBody();
      this.#setupTriggers();
      this.#setupAccessibility();
      this.#isConnected = true;
      
      // Dispatch ready event
      this.dispatchEvent(new CustomEvent('modal:ready', {
        detail: { modal: this },
        bubbles: true
      }));
    } catch (error) {
      console.error('ElectricModal: Error in connectedCallback', error);
    }
  }

  disconnectedCallback() {
    if (!this.#isConnected) return;
    
    try {
      this.#cleanup();
      this.#isConnected = false;
    } catch (error) {
      console.error('ElectricModal: Error in disconnectedCallback', error);
    }
  }

  /**
   * Open the modal
   * @param {Object} data - Optional data to pass to the modal
   * @returns {CustomEvent} The dispatched open event
   */
  open(data = {}) {
    if (this.hasAttribute('open')) return;
    
    try {
      // Store data for potential use
      this.#openData = data;
      
      // Store current focus
      this.#previousFocus = document.activeElement;
      
      // Store scroll position and lock body
      this.#scrollPosition = window.scrollY;
      
      // Add modal-open class to body for styling hooks
      document.body.classList.add('modal-open');
      
      // Lock body scroll without causing layout shift
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollbarWidth}px`;
      
      // Show modal with animation
      this.setAttribute('opening', '');
      this.style.display = 'block';
      
      // Start enter animation using CSS classes
      requestAnimationFrame(() => {
        this.#backdrop.classList.add('fade-in-sm');
        this.#content.classList.add('slide-up-md');
      });
      
      // Complete opening after animation
      this.#openingTimeout = setTimeout(() => {
        this.removeAttribute('opening');
        this.setAttribute('open', '');
        this.#trapFocus();
        
        // Dispatch open event
        const event = new CustomEvent('modal:open', {
          detail: { modal: this, data },
          bubbles: true,
          cancelable: true
        });
        this.dispatchEvent(event);
      }, 50);
      
      // Add event listeners
      document.addEventListener('keydown', this.#escapeHandler);
      this.shadowRoot.addEventListener('click', this.#clickHandler);
      
    } catch (error) {
      console.error('ElectricModal: Error opening modal', error);
      this.#cleanup();
    }
  }

  /**
   * Close the modal
   * @param {string} reason - Optional reason for closing (e.g., 'escape', 'backdrop', 'button')
   * @returns {CustomEvent} The dispatched close event
   */
  close(reason = 'programmatic') {
    if (!this.hasAttribute('open') && !this.hasAttribute('opening')) return;
    
    try {
      // Dispatch closing event (cancelable)
      const closingEvent = new CustomEvent('modal:closing', {
        detail: { modal: this, reason },
        bubbles: true,
        cancelable: true
      });
      
      if (!this.dispatchEvent(closingEvent)) {
        return; // Closing was cancelled
      }
      
      // Start leave animation
      this.removeAttribute('open');
      this.setAttribute('closing', '');
      
      // Remove animation classes to trigger reverse transition
      this.#backdrop.classList.remove('fade-in-sm');
      this.#content.classList.remove('slide-up-md');
      
      // Complete closing after animation
      this.#closingTimeout = setTimeout(() => {
        this.removeAttribute('closing');
        this.style.display = 'none';
        
        // Restore body scroll
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        window.scrollTo(0, this.#scrollPosition);
        
        // Restore focus
        if (this.#previousFocus && this.#previousFocus.focus) {
          this.#previousFocus.focus();
        }
        
        // Remove event listeners
        document.removeEventListener('keydown', this.#escapeHandler);
        this.shadowRoot.removeEventListener('click', this.#clickHandler);
        
        // Clear focus trap
        this.#focusTrap = null;
        
        // Clear data
        this.#openData = null;
        
        // Dispatch closed event
        const event = new CustomEvent('modal:closed', {
          detail: { modal: this, reason },
          bubbles: true
        });
        this.dispatchEvent(event);
        
      }, this.#animationDuration);
      
    } catch (error) {
      console.error('ElectricModal: Error closing modal', error);
      this.#cleanup();
    }
  }

  /**
   * Update modal content
   * @param {string|HTMLElement} content - New content for the modal
   */
  updateContent(content) {
    try {
      const slot = this.querySelector('[slot="content"]');
      if (!slot) {
        console.warn('ElectricModal: No content slot found');
        return;
      }
      
      if (typeof content === 'string') {
        slot.innerHTML = content;
      } else if (content instanceof HTMLElement) {
        slot.innerHTML = '';
        slot.appendChild(content);
      }
      
      // Re-setup close buttons
      this.#setupCloseButtons();
      
      // Dispatch content update event
      this.dispatchEvent(new CustomEvent('modal:content-updated', {
        detail: { modal: this },
        bubbles: true
      }));
      
    } catch (error) {
      console.error('ElectricModal: Error updating content', error);
    }
  }

  /**
   * Get the current open data
   * @returns {Object} The data passed when opening the modal
   */
  getOpenData() {
    return this.#openData;
  }

  // Private methods
  #moveToBody() {
    // Move modal to document.body if it's not already there
    if (this.parentNode !== document.body) {
      document.body.appendChild(this);
    }
  }

  #render() {
    const size = this.dataset.size || 'medium';
    const sizeClasses = {
      small: 'max-w-sm',
      medium: 'max-w-lg',
      large: 'max-w-2xl',
      full: 'max-w-full mx-4'
    };
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: none;
          position: fixed;
          inset: 0;
          z-index: 9999;
        }
        
        :host([open]),
        :host([opening]),
        :host([closing]) {
          display: block;
        }
        
        .backdrop {
          position: fixed;
          inset: 0;
          background-color: rgba(0, 0, 0, 0.5);
        }
        
        .container {
          position: fixed;
          inset: 0;
          overflow-y: auto;
          padding: 1rem;
        }
        
        .wrapper {
          display: flex;
          min-height: 100%;
          align-items: center;
          justify-content: center;
        }
        
        .content {
          position: relative;
          background: white;
          border-radius: 0.5rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          width: 100%;
          ${sizeClasses[size] ? `max-width: ${this.#getMaxWidth(size)};` : ''}
        }
        
        /* Responsive adjustments */
        @media (min-width: 640px) {
          .container {
            padding: 2rem;
          }
        }
        
        /* Focus visible styles */
        :focus-visible {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }
      </style>
      
      <div class="backdrop" part="backdrop"></div>
      <div class="container" part="container">
        <div class="wrapper">
          <div 
            class="content" 
            part="content"
            role="dialog" 
            aria-modal="true"
            aria-labelledby="modal-title"
            aria-describedby="modal-description"
          >
            <slot name="content"></slot>
          </div>
        </div>
      </div>
    `;
    
    // Cache elements
    this.#backdrop = this.shadowRoot.querySelector('.backdrop');
    this.#content = this.shadowRoot.querySelector('.content');
    this.#dialog = this.shadowRoot.querySelector('[role="dialog"]');
  }

  #getMaxWidth(size) {
    const sizes = {
      small: '24rem',
      medium: '32rem', 
      large: '48rem',
      full: '100%'
    };
    return sizes[size] || sizes.medium;
  }

  #setupTriggers() {
    // Find all triggers for this modal
    const modalId = this.id;
    if (!modalId) return;
    
    const triggers = document.querySelectorAll(`[data-modal-trigger="${modalId}"]`);
    triggers.forEach(trigger => {
      trigger.addEventListener('click', (e) => {
        console.log('trigger', trigger);
        e.preventDefault();
        const data = {};
        
        // Collect data attributes from trigger
        Array.from(trigger.attributes).forEach(attr => {
          if (attr.name.startsWith('data-modal-')) {
            const key = attr.name.replace('data-modal-', '');
            if (key !== 'trigger') {
              data[key] = attr.value;
            }
          }
        });
        
        this.open(data);
      });
    });
  }

  #setupAccessibility() {
    // Set initial ARIA attributes
    if (!this.#dialog) return;
    
    const title = this.querySelector('[data-modal-title]');
    if (title && !title.id) {
      title.id = `modal-title-${Math.random().toString(36).substr(2, 9)}`;
      this.#dialog.setAttribute('aria-labelledby', title.id);
    }
    
    const description = this.querySelector('[data-modal-description]');
    if (description && !description.id) {
      description.id = `modal-desc-${Math.random().toString(36).substr(2, 9)}`;
      this.#dialog.setAttribute('aria-describedby', description.id);
    }
  }

  #setupCloseButtons() {
    // Find all close buttons within the modal
    this.#closeButtons = Array.from(this.querySelectorAll('[data-modal-close]'));
    this.#closeButtons.forEach(button => {
      button.addEventListener('click', () => this.close('button'));
    });
  }

  #trapFocus() {
    const focusableElements = this.querySelectorAll(ElectricModal.#FOCUSABLE_ELEMENTS);
    const focusableArray = Array.from(focusableElements);
    
    if (focusableArray.length === 0) return;
    
    const firstElement = focusableArray[0];
    const lastElement = focusableArray[focusableArray.length - 1];
    
    // Focus first element
    setTimeout(() => firstElement.focus(), 100);
    
    this.#focusTrap = (e) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };
    
    this.addEventListener('keydown', this.#focusTrap);
  }

  #handleEscape(e) {
    if (e.key === 'Escape' && this.dataset.closeOnEscape !== 'false') {
      this.close('escape');
    }
  }

  #handleClick(e) {
    // Close on backdrop click if enabled
    if (this.dataset.closeOnBackdrop === 'false') return;
    
    // Check if the click is outside the content area
    if (this.#content && !this.#content.contains(e.target)) {
      this.close('backdrop');
    }
  }

  #cleanup() {
    // Clear timeouts
    if (this.#openingTimeout) {
      clearTimeout(this.#openingTimeout);
      this.#openingTimeout = null;
    }
    
    if (this.#closingTimeout) {
      clearTimeout(this.#closingTimeout);
      this.#closingTimeout = null;
    }
    
    // Remove attributes
    this.removeAttribute('open');
    this.removeAttribute('opening');
    this.removeAttribute('closing');
    this.style.display = 'none';
    
    // Restore body
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    
    // Remove listeners
    document.removeEventListener('keydown', this.#escapeHandler);
    this.shadowRoot?.removeEventListener('click', this.#clickHandler);
    
    if (this.#focusTrap) {
      this.removeEventListener('keydown', this.#focusTrap);
      this.#focusTrap = null;
    }
  }

  // Static utility methods
  /**
   * Open a modal by ID
   * @param {string} modalId - The ID of the modal to open
   * @param {Object} data - Optional data to pass to the modal
   * @returns {ElectricModal|null} The modal instance if found
   */
  static open(modalId, data = {}) {
    const modal = document.getElementById(modalId);
    if (modal && modal instanceof ElectricModal) {
      modal.open(data);
      return modal;
    }
    console.warn(`ElectricModal: Modal with ID "${modalId}" not found`);
    return null;
  }

  /**
   * Close all open modals
   * @param {string} reason - Optional reason for closing
   */
  static closeAll(reason = 'programmatic') {
    const openModals = document.querySelectorAll('electric-modal[open]');
    openModals.forEach(modal => modal.close(reason));
  }

  /**
   * Get the currently open modal
   * @returns {ElectricModal|null} The open modal or null
   */
  static getCurrent() {
    return document.querySelector('electric-modal[open]');
  }
}

// Register the custom element
if (!customElements.get('electric-modal')) {
  customElements.define('electric-modal', ElectricModal);
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ElectricModal;
}
