/**
 * @fileoverview Electric Disclosure System for Electric Maybe Shopify Theme
 * @description Shared disclosure system providing both accordion and dropdown functionality
 * with comprehensive accessibility, keyboard navigation, and sync group support.
 * 
 * @author Electric Maybe
 * @version 3.0.0
 * @license MIT
 */

/**
 * Base disclosure class that provides shared functionality for both accordion and dropdown variants
 * 
 * This class handles common disclosure patterns including:
 * - Sync group management (closing other disclosures when one opens)
 * - Keyboard navigation (Enter, Space, Arrow keys, Escape)
 * - Accessibility attributes (ARIA expanded, controls, labelledby)
 * - Event handling and cleanup
 * - Error handling and logging
 * 
 * @example
 * // For accordion disclosure
 * <accordion-disclosure data-sync-group="faq">
 *   <details>
 *     <summary>FAQ Item</summary>
 *     <div>Answer content</div>
 *   </details>
 * </accordion-disclosure>
 * 
 * @example
 * // For dropdown disclosure  
 * <dropdown-disclosure data-sync-group="filters">
 *   <details>
 *     <summary>Filter Options</summary>
 *     <div class="dropdown-content">Filter content</div>
 *   </details>
 * </dropdown-disclosure>
 */
class ElectricDisclosure extends HTMLElement {
  /** @type {boolean} Component connection state */
  #isConnected = false;
  
  /** @type {HTMLDetailsElement | null} Details element */
  #details = null;
  
  /** @type {HTMLElement | null} Summary element */
  #summary = null;
  
  /** @type {HTMLElement | null} Content element */
  #content = null;

  /**
   * Get the details element (protected for child classes)
   * @protected
   */
  get details() {
    return this.#details;
  }

  /**
   * Get the summary element (protected for child classes)
   * @protected
   */
  get summary() {
    return this.#summary;
  }

  /**
   * Get the content element (protected for child classes)
   * @protected
   */
  get content() {
    return this.#content;
  }
  
  /** @type {NodeList | null} Other elements in sync group */
  #syncGroup = null;
  
  /** @type {string} Disclosure type (accordion or dropdown) */
  #disclosureType = '';

  constructor() {
    super();
  }

  /**
   * Initialize the disclosure component
   * @private
   */
  connectedCallback() {
    if (this.#isConnected) return;
    
    try {
      this.#isConnected = true;
      this.#disclosureType = this.tagName.toLowerCase();
      this.#initializeElements();
      this.#setupAccessibility();
      this.#setupEventListeners();
      this.#setupSyncGroup();
      this.#setupInitialState();
    } catch (error) {
      this.#handleError('Failed to initialize disclosure', error);
    }
  }

  /**
   * Clean up resources when component is disconnected
   * @private
   */
  disconnectedCallback() {
    this.#isConnected = false;
    this.#cleanup();
  }

  /**
   * Initialize DOM elements
   * @private
   */
  #initializeElements() {
    this.#details = this.querySelector('details');
    this.#summary = this.#details?.querySelector('summary');
    // Find the first content element that is not a descendant of <summary>
    this.#content = null;
    if (this.#details) {
      const candidates = Array.from(this.#details.querySelectorAll('div, ul, ol, section, article'));
      for (const el of candidates) {
        // Exclude elements that are inside a <summary>
        if (!el.closest('summary')) {
          this.#content = el;
          break;
        }
      }
    }
    
    if (!this.#details) {
      throw new Error('ElectricDisclosure: Details element is required');
    }
    
    if (!this.#summary) {
      throw new Error('ElectricDisclosure: Summary element is required');
    }
    
    if (!this.#content) {
      throw new Error('ElectricDisclosure: Content element is required');
    }
  }

  /**
   * Setup accessibility attributes and roles
   * @private
   */
  #setupAccessibility() {
    // Set up summary accessibility
    this.#summary.setAttribute('tabindex', '0');
    this.#summary.setAttribute('role', 'button');
    this.#summary.setAttribute('aria-expanded', 'false');
    
    // Generate unique IDs for ARIA relationships
    const contentId = `${this.id || 'disclosure'}-content`;
    const summaryId = `${this.id || 'disclosure'}-summary`;
    
    this.#content.id = contentId;
    this.#summary.id = summaryId;
    
    // Set up ARIA relationships
    this.#summary.setAttribute('aria-controls', contentId);
    this.#content.setAttribute('aria-labelledby', summaryId);
    
    // Set appropriate role for content
    if (this.#disclosureType === 'dropdown-disclosure') {
      this.#content.setAttribute('role', 'menu');
    } else {
      this.#content.setAttribute('role', 'region');
    }
  }

  /**
   * Setup event listeners for keyboard and mouse interactions
   * @private
   */
  #setupEventListeners() {
    // Click handler
    this.#summary.addEventListener('click', this.#handleClick.bind(this));
    
    // Keyboard navigation
    this.#summary.addEventListener('keydown', this.#handleKeydown.bind(this));
    
    // Outside click detection for dropdowns
    if (this.#disclosureType === 'dropdown-disclosure') {
      document.addEventListener('click', this.#handleDocumentClick.bind(this), true);
    }
  }

  /**
   * Get current sync group members (always returns fresh list)
   * @returns {NodeList | null} Current sync group members or null if no sync group
   * @private
   */
  #getSyncGroup() {
    const syncGroupName = this.dataset.syncGroup;
    if (!syncGroupName) return null;
    
    return document.querySelectorAll(`[data-sync-group="${syncGroupName}"]`);
  }

  /**
   * Setup sync group functionality
   * @private
   */
  #setupSyncGroup() {
    // Store initial sync group reference for validation
    this.#syncGroup = this.#getSyncGroup();
  }

  /**
   * Setup initial state based on attributes
   * @private
   */
  #setupInitialState() {
    // Check if should be open by default
    if (this.#details.hasAttribute('open')) {
      this.setAttribute('aria-expanded', 'true');
      
      // For accordions, trigger the open animation
      if (this.#disclosureType === 'accordion-disclosure') {
        this.open();
      }
    }
  }

  /**
   * Handle click events on the summary
   * @param {Event} event - Click event
   * @private
   */
  #handleClick(event) {
    event.preventDefault();
    
    if (this.#details.open) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Handle keyboard navigation
   * @param {KeyboardEvent} event - Keydown event
   * @private
   */
  #handleKeydown(event) {
    // Prevent default behavior for these keys
    if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Enter", " "].includes(event.key)) {
      event.preventDefault();
    }

    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        if (!this.#details.open) {
          this.open();
        } else if (this.#disclosureType === 'accordion-disclosure') {
          // Move focus to first focusable element in content
          const firstFocusable = this.#content.querySelector('[tabindex="0"], button, a, input, select, textarea');
          if (firstFocusable) {
            firstFocusable.focus();
          }
        }
        break;
        
      case "ArrowUp":
      case "ArrowLeft":
        if (this.#details.open && this.#disclosureType === 'accordion-disclosure') {
          this.close();
        }
        break;
        
      case "Enter":
      case " ": // Space key
        this.#handleClick(event);
        break;
        
      case "Escape":
        if (this.#details.open) {
          this.close();
          this.#summary.focus();
        }
        break;
    }
  }

  /**
   * Handle clicks outside the disclosure (for dropdowns)
   * @param {Event} event - Click event
   * @private
   */
  #handleDocumentClick(event) {
    if (!this.contains(event.target)) {
      this.close();
    }
  }

  /**
   * Open the disclosure and close others in sync group
   * @private
   */
  open() {
    // Close other elements in the same sync group
    this.#closeSyncGroup();
    
    // Set open state
    this.#details.open = true;
    this.setAttribute('aria-expanded', 'true');
    
    // Dispatch custom event
    this.dispatchEvent(new CustomEvent('disclosure:opened', {
      detail: { type: this.#disclosureType },
      bubbles: true
    }));
  }

  /**
   * Close the disclosure
   * @private
   */
  close() {
    this.#details.open = false;
    this.setAttribute('aria-expanded', 'false');
    
    // Dispatch custom event
    this.dispatchEvent(new CustomEvent('disclosure:closed', {
      detail: { type: this.#disclosureType },
      bubbles: true
    }));
  }

  /**
   * Close other elements in the same sync group
   * @private
   */
  #closeSyncGroup() {
    const syncGroupMembers = this.#getSyncGroup();
    if (!syncGroupMembers) return;
    
    syncGroupMembers.forEach((el) => {
      // Skip if element is being replaced or not connected
      if (el === this || !el.isConnected) return;
      
      // Handle different types of disclosure elements
      const tagName = el.tagName.toLowerCase();
      
      if (tagName === 'accordion-disclosure' || tagName === 'dropdown-disclosure') {
        // Check if element has the close method (properly initialized)
        if (typeof el.close === 'function' && el.details?.open) {
          try {
            el.close();
          } catch (error) {
            console.warn('Failed to close sync group member:', error);
          }
        }
      } else if (el.classList.contains('disclosure-element')) {
        // Handle legacy disclosure-element components
        if (el.elements?.button?.getAttribute('aria-expanded') === 'true') {
          try {
            el.close();
          } catch (error) {
            console.warn('Failed to close sync group member:', error);
          }
        }
      }
    });
  }

  /**
   * Handle errors gracefully with logging and events
   * @param {string} message - Error message
   * @param {Error} error - Original error object
   * @private
   */
  #handleError(message, error) {
    console.error(`ElectricDisclosure: ${message}`, error);
    
    this.dispatchEvent(new CustomEvent('disclosure:error', {
      detail: { message, error: error.message, type: this.#disclosureType },
      bubbles: true
    }));
  }

  /**
   * Clean up resources and event listeners
   * @private
   */
  #cleanup() {
    if (this.#disclosureType === 'dropdown-disclosure') {
      document.removeEventListener('click', this.#handleDocumentClick, true);
    }
  }

  /**
   * Static utility method to find disclosure elements
   * @param {string} type - Disclosure type to find
   * @returns {NodeList} Matching disclosure elements
   * @static
   */
  static findDisclosures(type = '') {
    const selector = type ? `${type}` : 'accordion-disclosure, dropdown-disclosure';
    return document.querySelectorAll(selector);
  }

  /**
   * Static utility method to close all disclosures of a specific type
   * @param {string} type - Disclosure type to close
   * @static
   */
  static closeAll(type = '') {
    const disclosures = this.findDisclosures(type);
    disclosures.forEach(disclosure => {
      if (disclosure.details?.open) {
        disclosure.close();
      }
    });
  }

  /**
   * Static utility method to get sync group members by group name
   * Always returns fresh list of current DOM elements
   * @param {string} syncGroupName - Name of the sync group
   * @returns {NodeList} Current sync group members
   * @static
   */
  static getSyncGroup(syncGroupName) {
    if (!syncGroupName) {
      console.warn('ElectricDisclosure.getSyncGroup: syncGroupName is required');
      return document.querySelectorAll('[data-sync-group="__non_existent__"]'); // Empty NodeList
    }
    
    return document.querySelectorAll(`[data-sync-group="${syncGroupName}"]`);
  }
}

/**
 * Accordion Disclosure - Animated collapsible content sections
 * 
 * Extends ElectricDisclosure to provide smooth height animations
 * and accordion-specific behavior for content sections.
 * 
 * @example
 * <accordion-disclosure data-sync-group="faq">
 *   <details>
 *     <summary>FAQ Item</summary>
 *     <div>Answer content with smooth animations</div>
 *   </details>
 * </accordion-disclosure>
 */
class AccordionDisclosure extends ElectricDisclosure {
  /** @type {Animation | null} Current animation instance */
  #animation = null;
  
  /** @type {boolean} Whether accordion is currently closing */
  #isClosing = false;
  
  /** @type {boolean} Whether accordion is currently expanding */
  #isExpanding = false;

  constructor() {
    super();
  }

  /**
   * Override open method to add accordion-specific behavior
   * @private
   */
  open() {
    // Prevent interaction while animations are in progress
    if (this.#isClosing || this.#isExpanding) {
      return;
    }

    // Ensure any ongoing animation is canceled before starting a new one
    if (this.#animation) {
      this.#animation.cancel();
      this.#animation = null;
    }

    // Preset the host element height to the closed (summary-only) height so the
    // expand animation has a correct starting value even after base open logic
    const summaryHeight = `${this.summary?.offsetHeight || 0}px`;
    this.style.display = "block";
    this.style.height = summaryHeight;
    this.style.overflow = "hidden";

    // Call base open to handle sync-group closing, aria, and events
    super.open();

    // Animate to full height on next frame when layout has updated
    window.requestAnimationFrame(() => this.#expand());
  }

  /**
   * Override close method to add accordion-specific behavior
   * @private
   */
  close() {
    // Prevent interaction while animations are in progress
    if (this.#isClosing || this.#isExpanding) {
      return;
    }
    
    this.#shrink();
  }

  /**
   * Animate the accordion shrinking
   * @param {number} duration - Animation duration in milliseconds
   * @private
   */
  async #shrink(duration = window.animation.duration) {
    this.#isClosing = true;
    this.setAttribute('aria-expanded', 'false');

    const startHeight = `${this.offsetHeight + 1}px`;
    const endHeight = `${this.summary.offsetHeight + 2}px`;

    try {
        if (this.#animation) {
          this.#animation.cancel();
        }

        this.#animation = this.animate(
          {
            height: [startHeight, endHeight],
          },
          {
            duration,
            easing: window.animation.cubicBezier
          }
        );

        // Animate content opacity
        this.content.animate(
          {
            opacity: [1, 0],
            transform: ["translateY(0px)", "translateY(4px)"]
          },
          {
            duration: window.animation.durationShort,
            easing: window.animation.cubicBezier,
            fill: "forwards",
          }
        );

        this.#animation.onfinish = () => this.#onAnimationFinish(false);
        this.#animation.oncancel = () => (this.#isClosing = false);
    } catch (error) {
      console.error('AccordionDisclosure: Shrink animation failed', error);
      // Graceful degradation - just close without animation
      this.style.height = endHeight;
      this.#onAnimationFinish(false);
    }
  }

  /**
   * Animate the accordion expanding
   * @private
   */
  async #expand() {
    this.#isExpanding = true;
    const startHeight = `${this.offsetHeight + 2}px`;
    const endHeight = `${this.summary.offsetHeight + this.content?.offsetHeight + 1}px`;
    
    try {
        // Fallback to Web Animations API
        if (this.#animation) {
          this.#animation.cancel();
        }

        this.#animation = this.animate(
          {
            height: [startHeight, endHeight],
          },
          {
            duration: window.animation.duration,
            easing: window.animation.cubicBezier
          }
        );

        // Animate content opacity
        this.content.animate(
          {
            opacity: [0, 1],
            transform: ["translateY(4px)", "translateY(0)"]
          },
          {
            duration: window.animation.durationShort,
            easing: "ease-out",
            fill: "forwards",
          }
        );

        this.#animation.onfinish = () => this.#onAnimationFinish(true);
        this.#animation.oncancel = () => (this.#isExpanding = false);
    } catch (error) {
      console.error('AccordionDisclosure: Expand animation failed', error);
      // Graceful degradation - just open without animation
      this.style.height = 'auto';
      this.#onAnimationFinish(true);
    }
  }

  /**
   * Handle animation completion
   * @param {boolean} open - Whether the accordion is now open
   * @private
   */
  #onAnimationFinish(open) {
    this.details.open = open;
    this.#animation = null;
    this.#isClosing = false;
    this.#isExpanding = false;
    this.style.height = this.style.overflow = "";

    // When an accordion finishes closing, force a reflow on children
    // with slide-up-sm to reset their CSS animations/transitions
    if (!open) {
      this.#forceReflowOnSlideUpElements();
    }
  }

  /**
   * Public method to shrink accordion (for external control)
   * @param {number} duration - Animation duration
   */
  shrink(duration) {
    this.#shrink(duration);
  }

  /**
   * Force a synchronous reflow on elements that should re-run their CSS animations
   * Targets children with class `slide-up-sm` inside the accordion content
   * @private
   */
  #forceReflowOnSlideUpElements() {
    try {
      const targets = this.content?.querySelectorAll('.slide-up-sm');
      if (!targets || targets.length === 0) return;

      targets.forEach((node) => {
        // Force a reflow to restart CSS animations/transitions reliably
        // eslint-disable-next-line no-unused-expressions
        node.classList.remove('slide-up-sm');
        setTimeout(() => {
          void document.body.offsetHeight;
        }, 100);
        setTimeout(() => {
          node.classList.add('slide-up-sm');
        }, 200);
      });
    } catch (error) {
      console.error('AccordionDisclosure: failed to force reflow', error);
      this.dispatchEvent(new CustomEvent('disclosure:error', {
        detail: { message: 'Failed to force reflow', error: error?.message, type: 'accordion-disclosure' },
        bubbles: true
      }));
    }
  }
  
  /**
   * Clean up resources on disconnect
   * Per javascript-standards.mdc Line 156-173
   */
  disconnectedCallback() {
    super.disconnectedCallback();
    
    // Cancel any ongoing animations
    if (this.#animation) {
      this.#animation.cancel();
      this.#animation = null;
    }
  }
}

/**
 * Dropdown Disclosure - Dropdown menu functionality
 * 
 * Extends ElectricDisclosure to provide dropdown-specific behavior
 * with absolute positioning and outside click detection.
 * 
 * @example
 * <dropdown-disclosure data-sync-group="filters">
 *   <details>
 *     <summary>Filter Options</summary>
 *     <div class="absolute top-full left-0 z-50">Filter content</div>
 *   </details>
 * </dropdown-disclosure>
 */
class DropdownDisclosure extends ElectricDisclosure {
  constructor() {
    super();
  }

  /**
   * Override open method to add dropdown-specific behavior
   * @private
   */
  open() {
    super.open();
    
    // Ensure dropdown content is properly positioned
    if (this.content) {
      this.content.style.display = 'block';
    }
  }

  /**
   * Override close method to add dropdown-specific behavior
   * @private
   */
  close() {
    super.close();
    
    // Hide dropdown content
    if (this.content) {
      this.content.style.display = 'none';
    }
  }
}

/**
 * Register all disclosure components when DOM is ready
 * @private
 */
function registerDisclosureComponents() {
  // Register accordion disclosure
  if (!customElements.get('accordion-disclosure')) {
    customElements.define('accordion-disclosure', AccordionDisclosure);
  }
  
  // Register dropdown disclosure
  if (!customElements.get('dropdown-disclosure')) {
    customElements.define('dropdown-disclosure', DropdownDisclosure);
  }
}

// Register components when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', registerDisclosureComponents);
} else {
  registerDisclosureComponents();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ElectricDisclosure,
    AccordionDisclosure,
    DropdownDisclosure
  };
}
