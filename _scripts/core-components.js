import { scrollLockManager, lockScrollForThis, unlockScrollForThis } from './helpers.js';

/**
 * @fileoverview Core Web Components for Electric Maybe Shopify Theme
 * @description This file contains all the foundational web components used throughout the theme.
 * Each component follows modern web standards with proper lifecycle management,
 * accessibility features, and performance optimizations.
 *
 * @author Electric Maybe
 * @version 3.0.0
 * @license MIT
 */

/**
 * LayerManager - Manages z-index stacking context for overlays
 * @class
 * @description Provides dynamic z-index management for modals, drawers, and other overlay elements
 */
class LayerManager {
  constructor() {
    this.layers = [];
    this.baseZIndex = {
      dropdown: 100,    // z-[100]
      sticky: 150,      // z-[150]
      drawer: 200,      // z-[200]
      modal: 300,       // z-[300]
      notification: 400,// z-[400]
      debug: 9999       // z-[9999]
    };
    this.animatingLayers = new Set();
  }

  /**
   * Push a new layer onto the stack with parent tracking
   * @param {string} id - Unique identifier for the layer
   * @param {string} type - Type of layer (modal, drawer, etc.)
   * @param {HTMLElement} element - The element to manage
   * @param {string} parentId - Optional parent layer ID
   * @returns {number} The calculated z-index for this layer
   */
  push(id, type, element, parentId = null) {
    // Remove if already exists (to move to top)
    this.remove(id);

    // Find parent layer if specified
    let parentLayer = null;
    let baseZ = this.baseZIndex[type] || this.baseZIndex.drawer;

    if (parentId) {
      parentLayer = this.layers.find(l => l.id === parentId);
      if (parentLayer) {
        // Child should be above parent by at least 100
        baseZ = Math.max(baseZ, parentLayer.zIndex + 100);
      }
    }

    // Find the highest z-index in use
    const highestZ = this.layers.reduce((max, layer) => {
      return Math.max(max, layer.zIndex);
    }, baseZ - 1);

    // New layer goes above everything else
    const zIndex = Math.max(baseZ, highestZ + 10);

    // Add to stack with parent reference
    this.layers.push({
      id,
      type,
      element,
      zIndex,
      parentId,
      children: []
    });

    // Update parent's children list
    if (parentLayer) {
      parentLayer.children.push(id);
    }

    // Apply z-index
    if (element) {
      element.style.zIndex = zIndex;
      element.dataset.layerZIndex = zIndex;
    }

    return zIndex;
  }

  /**
   * Mark a layer as animating (delays z-index removal)
   */
  startAnimating(id) {
    this.animatingLayers.add(id);
  }

  /**
   * Mark animation as complete and remove if pending
   */
  stopAnimating(id) {
    this.animatingLayers.delete(id);

    // Check if this layer was marked for removal
    const layer = this.layers.find(l => l.id === id);
    if (layer && layer.pendingRemoval) {
      this.remove(id, true);
    }
  }

  /**
   * Remove a layer from the stack
   * @param {string} id - Unique identifier for the layer
   * @param {boolean} immediate - Force immediate removal even if animating
   */
  remove(id, immediate = false) {
    const index = this.layers.findIndex(l => l.id === id);
    if (index === -1) return;

    const layer = this.layers[index];

    // If layer is animating and not forced, mark for removal later
    if (this.animatingLayers.has(id) && !immediate) {
      layer.pendingRemoval = true;
      return;
    }

    // Remove children first
    if (layer.children && layer.children.length > 0) {
      layer.children.forEach(childId => this.remove(childId, immediate));
    }

    // Remove from parent's children list
    if (layer.parentId) {
      const parent = this.layers.find(l => l.id === layer.parentId);
      if (parent && parent.children) {
        parent.children = parent.children.filter(childId => childId !== id);
      }
    }

    // Clear z-index
    if (layer.element) {
      layer.element.style.zIndex = '';
      delete layer.element.dataset.layerZIndex;
    }

    // Remove from stack
    this.layers.splice(index, 1);
  }

  /**
   * Get the current parent context (topmost modal or drawer)
   */
  getCurrentContext() {
    // Find the topmost modal or drawer that could be a parent
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i];
      if (layer.type === 'modal' || layer.type === 'drawer') {
        return layer.id;
      }
    }
    return null;
  }

  /**
   * Get the topmost layer
   * @returns {Object|null} The topmost layer or null
   */
  getTop() {
    return this.layers[this.layers.length - 1] || null;
  }

  /**
   * Check if a specific layer is on top
   * @param {string} id - Unique identifier for the layer
   * @returns {boolean} True if the layer is on top
   */
  isOnTop(id) {
    const top = this.getTop();
    return top && top.id === id;
  }

  /**
   * Debug: Log current layer stack
   */
  debug() {
    // Debug method - uncomment for debugging
    // console.log('LayerManager Stack:');
    // this.layers.forEach(layer => {
    //   console.log(`  ${layer.id} (${layer.type}): z-${layer.zIndex}${layer.parentId ? ` [parent: ${layer.parentId}]` : ''}${layer.pendingRemoval ? ' [pending removal]' : ''}`);
    // });
  }

  /**
   * Clear all layers
   */
  clear() {
    this.layers.forEach(layer => {
      if (layer.element) {
        layer.element.style.zIndex = '';
        delete layer.element.dataset.layerZIndex;
      }
    });
    this.layers = [];
    this.animatingLayers.clear();
  }
}

// Global instance
window.layerManager = window.layerManager || new LayerManager();

/**
 * @typedef {Object} ComponentInfo
 * @property {string} name - Component name
 * @property {string} tag - HTML tag name
 * @property {string} purpose - What the component does
 * @property {string[]} features - Key features
 * @property {string} usage - Basic usage example
 */

/**
 * @const {ComponentInfo[]} COMPONENTS
 * @description List of all web components defined in this file
 */
const COMPONENTS = [
  {
    name: 'DisclosureElement',
    tag: '<disclosure-element>',
    purpose: 'Dropdown/select functionality with keyboard navigation',
    features: ['ESC key support', 'Outside click detection', 'ARIA attributes'],
    usage: '<disclosure-element><button>...</button><ul>...</ul></disclosure-element>'
  },
  {
    name: 'ElectricModal',
    tag: '<electric-modal>',
    purpose: 'Modern modal system with single container approach',
    features: ['ESC key support', 'Focus trapping', 'Dynamic content loading', 'Single container for proper z-index'],
    usage: '<button data-modal-trigger="modal-id">...</button><template data-modal-content="modal-id">...</template>'
  },
  {
    name: 'SectionFetcher',
    tag: '<section-fetcher>',
    purpose: 'Dynamic content loading for sections',
    features: ['URL parameter tracking', 'Intersection observer', 'Debounced fetching'],
    usage: '<section-fetcher data-section-id="..." data-url="...">...</section-fetcher>'
  },
  {
    name: 'DrawerTrigger',
    tag: '<drawer-trigger>',
    purpose: 'Button that triggers a drawer to open/close',
    features: ['Automatic drawer targeting via data-target attribute'],
    usage: '<drawer-trigger data-target="drawer-id">...</drawer-trigger>'
  },
  {
    name: 'DrawerElement',
    tag: '<drawer-element>',
    purpose: 'Slide-out drawer container with animations',
    features: ['Smooth animations', 'Scroll locking', 'Focus management'],
    usage: '<drawer-element><drawer>...</drawer></drawer-element>'
  },

  {
    name: 'ElectricTab',
    tag: '<electric-tab>',
    purpose: 'Accessible tab switching functionality with WCAG 2.1 AA compliance',
    features: ['Keyboard navigation (Arrow keys, Home, End)', 'Screen reader announcements', 'Focus management', 'Custom events', 'CSS class management', 'No auto-scroll on load'],
    usage: '<electric-tab><button data-tab-button data-tab-index="0">...</button><div data-tab-content data-tab-index="0">...</div></electric-tab>'
  }
];

/**
 * @const {Object} FEATURES
 * @description Key features implemented across all components
 */
const FEATURES = {
  performance: [
    'Passive event listeners for scroll/touch events',
    'Debounced network requests',
    'Intersection observer for lazy loading',
    'Proper cleanup in disconnectedCallback',
    'Memory leak prevention'
  ],
  accessibility: [
    'ARIA attributes and roles',
    'Keyboard navigation support',
    'Focus trapping and management',
    'Screen reader compatibility',
    'Reduced motion support'
  ]
};

/**
 * DisclosureElement - A web component for collapsible content with sync group support
 * 
 * This component provides a disclosure widget that can be synchronized with other
 * disclosure elements (including accordion-disclosure) using the data-sync-group attribute.
 * When one element in a sync group is opened, all others in the same group are closed.
 * 
 * @example
 * <disclosure-element data-sync-group="my-group">
 *   <button aria-expanded="false">Toggle</button>
 *   <ul>...</ul>
 * </disclosure-element>
 */
class DisclosureElement extends HTMLElement {
  constructor() {
    super();
    this.elements = {
      button: this.querySelector("button"),
    };
    this.elements.button.addEventListener("click", this.toggle.bind(this));
    this.addEventListener("keyup", this.onContainerKeyUp.bind(this));

    this.listItems = this.querySelectorAll("li[data-value]");
    this.listItems.forEach((item) =>
      item.addEventListener("click", this.onListItemClick.bind(this)),
    );
  }

  /**
   * Initialize the component and set up sync group functionality
   * @private
   */
  connectedCallback() {
    // Sync group functionality is now handled dynamically in the open() method
  }

  // Cleanup function to remove the event listener when the element is disconnected
  disconnectedCallback() {
    document.removeEventListener("click", this.handleDocumentClick);
  }

  onListItemClick(event) {
    const listItem = event.currentTarget;
    const value = listItem.dataset.value;
    this.querySelector(".selected-value").innerText = value;
    this.close();
    this.listItems.forEach((item) => item.classList.remove("font-bold"));
    listItem.classList.add("font-bold");
  }

  onContainerKeyUp(event) {
    if (event.code.toUpperCase() !== "ESCAPE") return;

    this.close();
    this.elements.button.focus();
  }

  toggle() {
    const isExpanded =
      this.elements.button.getAttribute("aria-expanded") === "true";
    if (isExpanded) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Get current sync group members (always returns fresh list)
   * @returns {NodeList | null} Current sync group members or null if no sync group
   * @private
   */
  #getSyncGroup() {
    const syncGroupName = this.dataset?.syncGroup;
    if (!syncGroupName) return null;
    
    return document.querySelectorAll(`[data-sync-group="${syncGroupName}"]`);
  }

  /**
   * Close other elements in the same sync group
   * @private
   */
  #closeSyncGroup() {
    const syncGroupMembers = this.#getSyncGroup();
    if (!syncGroupMembers) return;
    
    syncGroupMembers.forEach((el) => {
      if (el !== this && el !== this.elements.button) {
        if (el.classList.contains('disclosure-element') || el.hasAttribute('is')) {
          // Handle different types of disclosure elements
          if (el.hasAttribute('is')) {
            const elType = el.getAttribute('is');
            if (elType === 'accordion-disclosure' || elType === 'dropdown-disclosure') {
              if (el.open) {
                el.close();
              }
            }
          } else if (el.elements?.button?.getAttribute('aria-expanded') === 'true') {
            el.close();
          }
        }
      }
    });
  }

  /**
   * Open the disclosure and close other elements in the same sync group
   * @private
   */
  open() {
    // Close other elements in the same sync group
    this.#closeSyncGroup();

    this.elements.button.setAttribute("aria-expanded", "true");
    document.addEventListener(
      "click",
      this.handleDocumentClick.bind(this),
      true,
    );
  }

  close() {
    this.elements.button.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", this.handleDocumentClick);
  }

  handleDocumentClick(event) {
    const isOutsideClick = !this.contains(event.target);
    if (isOutsideClick) {
      this.close();
    }
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
      console.warn('DisclosureElement.getSyncGroup: syncGroupName is required');
      return document.querySelectorAll('[data-sync-group="__non_existent__"]'); // Empty NodeList
    }
    
    return document.querySelectorAll(`[data-sync-group="${syncGroupName}"]`);
  }
}

customElements.define("disclosure-element", DisclosureElement);

/**
 * ElectricModal - Modern modal system with single container approach
 * @class
 * @extends HTMLElement
 * @description Creates a single modal container that handles all modal interactions
 */
class ElectricModal extends HTMLElement {
  constructor() {
    super();
    this.modal = null;
    this.backdrop = null;
    this.content = null;
    this.previousFocus = null;
    this.isOpen = false;
    this.scrollPosition = 0;
    this.boundEventHandler = null;
  }

  connectedCallback() {
    // Only create one instance globally
    if (!window.electricModal) {
      window.electricModal = this;
      console.log('ElectricModal: Initializing');
      this.init();
    } else {
      console.log('ElectricModal: Already initialized');
    }
  }

  disconnectedCallback() {
    if (window.electricModal === this) {
      window.electricModal = null;
      this.cleanup();
    }
  }

  init() {
    this.createModalContainer();
    this.setupTriggers();
    this.setupKeyboardListeners();
  }

  cleanup() {
    // Remove event listeners
    if (this.boundEventHandler) {
      document.removeEventListener('click', this.boundEventHandler);
    }
    document.removeEventListener('keydown', this.handleKeydown);

    // Remove modal container
    if (this.modal) {
      this.modal.remove();
    }
  }

  createModalContainer() {
    // Create modal HTML structure
    const modalHTML = `
      <div
        id="electric-modal-container"
        class="fixed inset-0 hidden"
        role="dialog"
        aria-modal="true"
      >
        <!-- Backdrop -->
        <div
          class="electric-modal-backdrop fade-in fixed inset-0 bg-black/50"
          data-modal-close
        ></div>

        <!-- Modal container -->
        <div class="fixed inset-0 overflow-y-auto p-4 sm:p-6 pointer-events-none">
          <div class="flex min-h-full items-stretch lg:items-center justify-center">
            <!-- Modal content -->
            <div
              class="electric-modal-content slide-up-sm relative bg-white shadow-xl w-fit pointer-events-auto"
              role="document"
            >
              <!-- Content will be inserted here -->
            </div>
          </div>
        </div>
      </div>
    `;

    // Add to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Cache elements
    this.modal = document.getElementById('electric-modal-container');
    this.backdrop = this.modal.querySelector('.electric-modal-backdrop');
    this.content = this.modal.querySelector('.electric-modal-content');

    // Setup backdrop click handler
    this.backdrop.addEventListener('click', () => this.close('backdrop'));
  }

  setupTriggers() {
    // Use event delegation for modal triggers
    this.boundEventHandler = (e) => {
      const trigger = e.target.closest('[data-modal-trigger]');
      if (!trigger) return;

      e.preventDefault();
      e.stopPropagation();

      const modalId = trigger.dataset.modalTrigger;
      const data = this.collectTriggerData(trigger);

      console.log('ElectricModal: Opening modal', modalId, data);
      this.open(modalId, data);
    };

    document.addEventListener('click', this.boundEventHandler);
    console.log('ElectricModal: Event listener attached');
  }

  setupKeyboardListeners() {
    this.handleKeydown = (e) => {
      if (!this.isOpen) return;

      if (e.key === 'Escape') {
        this.close('escape');
      }

      // Focus trap
      if (e.key === 'Tab') {
        this.handleTabKey(e);
      }
    };

    document.addEventListener('keydown', this.handleKeydown);
  }

  collectTriggerData(trigger) {
    const data = {};

    // Collect all data-modal-* attributes
    Array.from(trigger.attributes).forEach(attr => {
      if (attr.name.startsWith('data-modal-') && attr.name !== 'data-modal-trigger') {
        const key = attr.name.replace('data-modal-', '');
        data[key] = attr.value;
      }
    });

    return data;
  }

  async open(modalId, data = {}) {
    console.log('ElectricModal.open called with:', modalId, data);
    if (this.isOpen) {
      console.log('ElectricModal: Already open, returning');
      return;
    }

    try {
      // Store current focus
      this.previousFocus = document.activeElement;

      // Use LayerManager to handle z-index with parent tracking
      const layerId = `modal-${modalId}`;
      if (window.layerManager) {
        const parentContext = window.layerManager.getCurrentContext();
        window.layerManager.push(layerId, 'modal', this.modal, parentContext);
        this.modal.dataset.layerId = layerId;
        this.currentModalId = layerId;

        // Mark as animating (for fade in)
        window.layerManager.startAnimating(layerId);
      }

      // Load content
      await this.loadContent(modalId, data);

      // Lock body scroll
      this.lockBodyScroll();

      // Show modal with animation
      this.modal.classList.remove('hidden');

      // Wait a frame for the display change to take effect
      await new Promise(resolve => requestAnimationFrame(resolve));

      // Add animation classes if they exist
      this.modal.classList.add('modal-open');

      // Set state
      this.isOpen = true;

      // Focus management
      this.trapFocus();

      // Animation complete
      if (window.layerManager && layerId) {
        // Small delay to ensure animation has started
        setTimeout(() => {
          window.layerManager.stopAnimating(layerId);
        }, 300);
      }

      // Dispatch event
      this.dispatchEvent('modal:open', { modalId, data });

    } catch (error) {
      console.error('Error opening modal:', error);
      this.close();
    }
  }

  async loadContent(modalId, data) {
    // Show loading state
    this.content.innerHTML = `
      <div class="p-8 text-center">
        <div class="inline-block w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin"></div>
        <p class="mt-2 text-sm opacity-50">Loading...</p>
      </div>
    `;

    // Check if there's a template element for this modal
    const template = document.querySelector(`template[data-modal-content="${modalId}"]`);

    if (template) {
      // Use template content
      this.content.innerHTML = template.innerHTML;

      // Replace any template variables with data
      this.replaceTemplateVariables(data);

      // Check for section-fetcher and load content if present
      const sectionFetcher = this.content.querySelector('section-fetcher');
      if (sectionFetcher) {
        await sectionFetcher.checkAndFetch?.();
      }

    } else {
      // Try to find existing modal content
      const existingModal = document.querySelector(`[data-modal-id="${modalId}"]`);

      if (existingModal) {
        this.content.innerHTML = existingModal.innerHTML;
      } else {
        // Fallback content
        this.content.innerHTML = `
          <div class="p-6">
            <h3 class="text-lg font-medium mb-4">Modal</h3>
            <p class="opacity-50 mb-6">Modal content for "${modalId}"</p>
            <div class="flex justify-end">
              <button
                type="button"
                class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                data-modal-close
              >
                Close
              </button>
            </div>
          </div>
        `;
      }
    }

    // Setup close buttons
    this.setupCloseButtons();
  }

  replaceTemplateVariables(data) {
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      this.content.innerHTML = this.content.innerHTML.replace(regex, data[key] || '');
    });
  }

  setupCloseButtons() {
    const closeButtons = this.content.querySelectorAll('[data-modal-close]');
    closeButtons.forEach(button => {
      button.addEventListener('click', () => this.close('button'));
    });
  }

  close(reason = 'programmatic') {
    if (!this.isOpen) return;

    try {
      // Dispatch closing event (cancelable)
      const closingEvent = this.dispatchEvent('modal:closing', { reason });
      if (closingEvent.defaultPrevented) return;

      const layerId = this.modal.dataset.layerId;

      // Mark as animating for close animation
      if (window.layerManager && layerId) {
        window.layerManager.startAnimating(layerId);
      }

      // Remove animation classes
      this.modal.classList.remove('modal-open');

      // Wait for fade out animation (if any)
      const animationDuration = 300; // milliseconds
      setTimeout(() => {
        // Hide modal
        this.modal.classList.add('hidden');

        // Animation complete - now remove from LayerManager
        if (window.layerManager && layerId) {
          window.layerManager.stopAnimating(layerId);
          window.layerManager.remove(layerId);
          delete this.modal.dataset.layerId;
        }

        // Restore body scroll
        this.unlockBodyScroll();

        // Restore focus
        if (this.previousFocus && this.previousFocus.focus) {
          // Use setTimeout to avoid scroll issues
          setTimeout(() => {
            if (this.previousFocus && typeof this.previousFocus.focus === 'function') {
              this.previousFocus.focus({ preventScroll: true });
            }
          }, 0);
        }

        // Clear content
        this.content.innerHTML = '';

        // Set state
        this.isOpen = false;
        this.currentModalId = null;

        // Dispatch closed event
        this.dispatchEvent('modal:closed', { reason });
      }, animationDuration);

    } catch (error) {
      console.error('Error closing modal:', error);
      // Force cleanup on error
      this.modal.classList.add('hidden');
      this.isOpen = false;
    }
  }

  lockBodyScroll() {
    if (typeof lockScrollForThis === 'function') {
      lockScrollForThis(this.modal);
    } else {
      // Fallback if helpers not available
      this.scrollPosition = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${this.scrollPosition}px`;
      document.body.style.width = '100%';
    }
  }

  unlockBodyScroll() {
    if (typeof unlockScrollForThis === 'function') {
      unlockScrollForThis(this.modal);
    } else {
      // Fallback if helpers not available
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      if (this.scrollPosition) {
        window.scrollTo(0, this.scrollPosition);
      }
    }
  }

  trapFocus() {
    const focusableElements = this.content.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  }

  handleTabKey(e) {
    const focusableElements = this.content.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

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
  }

  dispatchEvent(name, detail = {}) {
    const event = new CustomEvent(name, {
      detail,
      bubbles: true,
      cancelable: name === 'modal:closing'
    });

    document.dispatchEvent(event);
    return event;
  }

  // Public API methods
  static open(modalId, data = {}) {
    if (window.electricModal) {
      return window.electricModal.open(modalId, data);
    }
  }

  static close(reason = 'programmatic') {
    if (window.electricModal) {
      return window.electricModal.close(reason);
    }
  }

  static isOpen() {
    return window.electricModal ? window.electricModal.isOpen : false;
  }
}
customElements.define("electric-modal", ElectricModal);

// Initialize one instance globally
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!document.querySelector('electric-modal')) {
      const modal = document.createElement('electric-modal');
      document.body.appendChild(modal);
    }
  });
} else {
  // DOM is already loaded
  if (!document.querySelector('electric-modal')) {
    const modal = document.createElement('electric-modal');
    document.body.appendChild(modal);
  }
}

/**
 * DrawerTrigger Web Component
 * 
 * A trigger element that opens/closes a target drawer. Automatically connects
 * to drawer elements and provides proper accessibility attributes and state management.
 * 
 * @example
 * <button is="drawer-trigger" data-target="my-drawer" aria-expanded="false">
 *   Open Menu
 * </button>
 * <drawer-element id="my-drawer">...</drawer-element>
 */
customElements.define(
  "drawer-trigger",
  class DrawerTrigger extends HTMLElement {
    constructor() {
      super();
      
      // Initialize properties
      this.targetDrawer = null;
      this.clickHandler = this.#handleClick.bind(this);
      this.keyHandler = this.#handleKeyDown.bind(this);
      
      // Set default ARIA attributes
      this.setAttribute('role', 'button');
      this.setAttribute('tabindex', '0');
      this.setAttribute('aria-expanded', 'false');
      this.setAttribute('aria-haspopup', 'dialog');
    }

    /**
     * Called when the element is connected to the DOM
     * @private
     */
    connectedCallback() {
      this.#connectToTarget();
      this.#bindEvents();
    }

    /**
     * Disconnect the component and clean up resources
     * @private
     */
    disconnectedCallback() {
      this.#disconnectFromTarget();
      this.#unbindEvents();
    }

    /**
     * Connect this trigger to its target drawer
     * @private
     */
    #connectToTarget() {
      const targetId = this.dataset.target;
      
      if (!targetId) {
        return;
      }

      // Use a small delay to ensure drawer is available
      setTimeout(() => {
        this.targetDrawer = document.getElementById(targetId);
        
        if (!this.targetDrawer) {
          return;
        }

        // Verify it's a drawer element
        if (!this.targetDrawer.matches('drawer-element')) {
          return;
        }

        // Add this trigger to drawer's triggers
        if (!this.targetDrawer.triggers) {
          this.targetDrawer.triggers = new Set();
        }
        this.targetDrawer.triggers.add(this);

        // Update ARIA attributes based on drawer state
        this.#updateAriaAttributes();
        
        // Listen for drawer state changes
        const ariaUpdateHandler = this.#updateAriaAttributes.bind(this);
        this.targetDrawer.addEventListener('drawer:opening', ariaUpdateHandler);
        this.targetDrawer.addEventListener('drawer:closing', ariaUpdateHandler);
        
      }, 100);
    }

    /**
     * Disconnect this trigger from its target drawer
     * @private
     */
    #disconnectFromTarget() {
      if (this.targetDrawer?.triggers) {
        this.targetDrawer.triggers.delete(this);
        
        // Remove event listeners
        this.targetDrawer.removeEventListener('drawer:opening', this.#updateAriaAttributes.bind(this));
        this.targetDrawer.removeEventListener('drawer:closing', this.#updateAriaAttributes.bind(this));
      }
      
      this.targetDrawer = null;
    }

    /**
     * Bind event listeners
     * @private
     */
    #bindEvents() {
      this.addEventListener('click', this.clickHandler);
      this.addEventListener('keydown', this.keyHandler);
    }

    /**
     * Unbind event listeners
     * @private
     */
    #unbindEvents() {
      this.removeEventListener('click', this.clickHandler);
      this.removeEventListener('keydown', this.keyHandler);
    }

    /**
     * Handle click events to toggle drawer
     * @param {Event} event - The click event
     * @private
     */
    #handleClick(event) {
      event.preventDefault();
      
      if (!this.targetDrawer) {
        return;
      }

      if (typeof this.targetDrawer.toggleDrawer === 'function') {
        try {
          this.targetDrawer.toggleDrawer(this);
        } catch (error) {
          // Silently handle errors
        }
      }
    }

    /**
     * Handle keyboard events for accessibility
     * @param {KeyboardEvent} event - The keydown event
     * @private
     */
    #handleKeyDown(event) {
      switch (event.key) {
        case 'Enter':
        case ' ':
          event.preventDefault();
          this.#handleClick(event);
          break;
        case 'Escape':
          // Close drawer if it's open
          if (this.targetDrawer?.isOpen) {
            this.targetDrawer.closeDrawer();
          }
          break;
      }
    }

    /**
     * Update ARIA attributes based on drawer state
     * @private
     */
    #updateAriaAttributes() {
      if (!this.targetDrawer) {
        return;
      }
      
      const isOpen = this.targetDrawer.isOpen || false;
      this.setAttribute('aria-expanded', isOpen.toString());
      
      // Update aria-controls to reference the drawer
      if (this.targetDrawer.id) {
        this.setAttribute('aria-controls', this.targetDrawer.id);
      }
    }

    /**
     * Get the current target drawer element
     * @returns {HTMLElement|null} The target drawer element or null if not connected
     * @public
     */
    getTargetDrawer() {
      return this.targetDrawer;
    }

    /**
     * Check if the trigger is connected to a valid drawer
     * @returns {boolean} True if connected to a valid drawer
     * @public
     */
    isConnected() {
      return this.targetDrawer !== null;
    }

    /**
     * Static method to find all triggers for a specific drawer
     * @param {string} drawerId - The ID of the drawer to find triggers for
     * @returns {DrawerTrigger[]} Array of trigger elements
     * @public
     */
    static getTriggersForDrawer(drawerId) {
      return Array.from(document.querySelectorAll(`drawer-trigger[data-target="${drawerId}"]`));
    }

    /**
     * Static method to validate if an element is a valid drawer trigger
     * @param {HTMLElement} element - The element to validate
     * @returns {boolean} True if the element is a valid drawer trigger
     * @public
     */
    static isValidTrigger(element) {
      return element && 
             element.matches('drawer-trigger') && 
             element.dataset.target &&
             document.getElementById(element.dataset.target);
    }

    /**
     * Debug method to get full diagnostic information about this trigger
     * Call from console: document.querySelector('drawer-trigger').debug()
     * @returns {object} Diagnostic information
     * @public
     */
    debug() {
      const targetId = this.dataset?.target || 'NOT SET';
      const targetDrawer = this.targetDrawer || (targetId !== 'NOT SET' ? document.getElementById(targetId) : null);
      
      const diagnostics = {
        trigger: {
          element: this,
          tagName: this.tagName,
          id: this.id || 'no-id',
          className: this.className || 'no-class',
          dataTarget: targetId,
          isConnected: this.isConnected,
          ariaExpanded: this.getAttribute('aria-expanded'),
          ariaControls: this.getAttribute('aria-controls'),
          ariaHaspopup: this.getAttribute('aria-haspopup'),
          tabindex: this.getAttribute('tabindex'),
          hasClickHandler: !!this.clickHandler,
          hasKeyHandler: !!this.keyHandler
        },
        targetDrawer: targetDrawer ? {
          element: targetDrawer,
          id: targetDrawer.id || 'no-id',
          tagName: targetDrawer.tagName,
          isDrawerElement: targetDrawer.matches('drawer-element'),
          isOpen: targetDrawer.isOpen || false,
          hasToggleMethod: typeof targetDrawer.toggleDrawer === 'function',
          hasCloseMethod: typeof targetDrawer.closeDrawer === 'function',
          hasOpenMethod: typeof targetDrawer.openDrawer === 'function',
          availableMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(targetDrawer)).filter(name => typeof targetDrawer[name] === 'function'),
          triggersCount: targetDrawer.triggers?.size || 0,
          isInTriggers: targetDrawer.triggers?.has(this) || false
        } : {
          found: false,
          reason: targetId === 'NOT SET' ? 'No data-target attribute' : `Element with id "${targetId}" not found`,
          allDrawerElements: Array.from(document.querySelectorAll('drawer-element')).map(el => ({
            id: el.id || 'no-id',
            tagName: el.tagName
          }))
        },
        domState: {
          documentReady: document.readyState,
          triggerInDOM: document.contains(this),
          targetInDOM: targetDrawer ? document.contains(targetDrawer) : false
        }
      };
      
      console.group('[DrawerTrigger] 🔍 Debug Information');
      console.log('Trigger Element:', diagnostics.trigger);
      console.log('Target Drawer:', diagnostics.targetDrawer);
      console.log('DOM State:', diagnostics.domState);
      
      if (!targetDrawer) {
        console.warn('❌ Target drawer not found or not connected');
      } else if (!targetDrawer.matches('drawer-element')) {
        console.warn('❌ Target element is not a drawer-element');
      } else if (typeof targetDrawer.toggleDrawer !== 'function') {
        console.warn('❌ Target drawer does not have toggleDrawer method');
      } else {
        console.log('✅ Trigger appears to be properly configured');
      }
      
      console.groupEnd();
      
      return diagnostics;
    }

    /**
     * Static method to debug all drawer triggers on the page
     * Call from console: customElements.get('drawer-trigger').debugAll()
     * @public
     */
    static debugAll() {
      const triggers = Array.from(document.querySelectorAll('drawer-trigger'));
      
      console.group('[DrawerTrigger] 🔍 Debug All Triggers');
      console.log(`Found ${triggers.length} drawer trigger(s) on the page`);
      
      if (triggers.length === 0) {
        console.warn('No drawer triggers found on the page');
        console.groupEnd();
        return;
      }
      
      triggers.forEach((trigger, index) => {
        console.group(`Trigger ${index + 1}`);
        trigger.debug();
        console.groupEnd();
      });
      
      console.groupEnd();
      
      return triggers.map(trigger => trigger.debug());
    }
  }
);

// Define drawer-element custom element with position-aware animations
customElements.define(
  "drawer-element",
  class DrawerElement extends HTMLElement {
    constructor() {
      super();
      this.drawer = this.querySelector("drawer");
      this.overlay = this.querySelector(".js-overlay");
      this.keepHeader = false;
      this.isOpen = false;
      this.animationDuration =
        parseInt(this.dataset.animationDuration) || window.animation.duration;
      
      // Get position information from data attributes
      this.positionMobile = this.dataset.positionMobile || 'right';
      this.positionDesktop = this.dataset.positionDesktop || 'right';
      
      // Initialize resize handler
      this.resizeHandler = null;
      this.resizeTimeout = null;

      this.bindEvents();
      
      // Listen for search events to close drawer
      this.boundSearchOpenedHandler = this.#handleSearchOpened.bind(this);
      document.addEventListener('search:opened', this.boundSearchOpenedHandler);
    }

    /**
     * Called when the element is connected to the DOM
     * @private
     */
    connectedCallback() {
      // Ensure drawer is properly initialized
      if (!this.drawer) {
        console.error('DrawerElement: No drawer element found');
        return;
      }

      // Set initial state
      this.isOpen = false;
      this.keepHeader = false;

      // Remove the CSS transform classes that might conflict with JS animations
      const removeToOpenClasses = this.drawer.getAttribute('data-remove-to-open');
      if (removeToOpenClasses) {
        const classesToRemove = removeToOpenClasses.trim().split(/\s+/);
        classesToRemove.forEach(cls => {
          this.drawer.classList.remove(cls);
        });
      }

      // Set initial transform based on position using JS instead of CSS
      const currentPosition = this.#getCurrentPosition();
      this.drawer.style.transform = this.#getInitialTransform(currentPosition);
      this.drawer.style.visibility = "hidden";

      // Ensure the drawer element is properly positioned
      this.style.display = 'none';

      // Check for data-load-on-event attribute and set up event listener
      if (this.dataset.loadOnEvent) {
        const eventName = this.dataset.loadOnEvent;

        // Create bound event handler to maintain reference for cleanup
        this.boundEventHandler = async (event) => {
          // Only open if not already open
          if (!this.isOpen) {
            // For cart:added event, refetch the cart section to ensure fresh content
            if (eventName === 'cart:added' && this.id === 'cart-drawer') {
              await this.#refetchCartSection();
            }
            this.openDrawer();
          }
        };

        // Add event listener to document
        document.addEventListener(eventName, this.boundEventHandler);
      }

      // For cart drawer, also listen to cart:update events to handle cart becoming empty
      if (this.id === 'cart-drawer') {
        this.boundCartUpdateHandler = async (event) => {
          console.log('[Cart Drawer] cart:update event received:', {
            isOpen: this.isOpen,
            eventDetail: event.detail,
            cart: event.detail?.cart,
            itemCount: event.detail?.cart?.item_count
          });
          
          // If drawer is open and cart becomes empty, refetch to show empty state
          if (this.isOpen && event.detail?.cart) {
            const itemCount = event.detail.cart.item_count || 0;
            console.log('[Cart Drawer] Item count:', itemCount);
            if (itemCount === 0) {
              console.log('[Cart Drawer] Cart is empty, refetching section...');
              await this.#refetchCartSection();
            }
          }
        };
        
        document.addEventListener('cart:update', this.boundCartUpdateHandler);
      }

      // Listen for search events to close drawer
      if (!this.boundSearchOpenedHandler) {
        this.boundSearchOpenedHandler = this.#handleSearchOpened.bind(this);
        document.addEventListener('search:opened', this.boundSearchOpenedHandler);
      }
    }

    /**
     * Disconnect the component and clean up resources
     * @private
     */
    disconnectedCallback() {
      // Remove resize listener
      if (this.resizeHandler) {
        window.removeEventListener('resize', this.resizeHandler);
      }

      // Clear any timeouts
      if (this.resizeTimeout) {
        clearTimeout(this.resizeTimeout);
      }

      // Remove the data-load-on-event listener if it was added
      if (this.dataset.loadOnEvent && this.boundEventHandler) {
        document.removeEventListener(this.dataset.loadOnEvent, this.boundEventHandler);
      }

      // Remove cart:update listener for cart drawer
      if (this.id === 'cart-drawer' && this.boundCartUpdateHandler) {
        document.removeEventListener('cart:update', this.boundCartUpdateHandler);
      }

      // Remove search event listener
      if (this.boundSearchOpenedHandler) {
        document.removeEventListener('search:opened', this.boundSearchOpenedHandler);
      }

      // Clean up
      this.cleanup();
    }

    /**
     * Bind all event listeners for the drawer component
     * @private
     */
    bindEvents() {
      // Add overlay click listener
      if (this.overlay) {
        this.overlay.addEventListener("click", () => this.closeDrawer());
      }

      // Add event listeners for keyup and focusout
      document.addEventListener("keyup", this.onKeyUp.bind(this));
      
      // Add resize listener to handle position changes
      this.resizeHandler = this.#handleResize.bind(this);
      window.addEventListener('resize', this.resizeHandler);
    }

    /**
     * Handle resize events to update position-based animations
     * @private
     */
    #handleResize() {
      // Debounce resize events
      if (this.resizeTimeout) {
        clearTimeout(this.resizeTimeout);
      }
      
      this.resizeTimeout = setTimeout(() => {
        if (this.isOpen) {
          // Update transform if drawer is open
          const currentPosition = this.#getCurrentPosition();
          this.drawer.style.transform = this.#getOpenTransform(currentPosition);
        }
      }, 100);
    }

    /**
     * Refetch the cart section to update drawer content
     * @returns {Promise<void>}
     * @private
     */
    async #refetchCartSection() {
      try {
        console.log('[Cart Drawer] Refetching cart section...');
        
        // Fetch the cart drawer section with fresh cart data
        const url = `${window.location.pathname}?section_id=cart--drawer`;
        console.log('[Cart Drawer] Fetch URL:', url);
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch cart section: ${response.status}`);
        }
        
        const html = await response.text();
        console.log('[Cart Drawer] Fetched HTML length:', html.length);
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Get the drawer element from the fetched HTML
        const newDrawerElement = doc.querySelector('drawer-element[id="cart-drawer"] drawer');
        const currentDrawerElement = this.querySelector('drawer');
        
        console.log('[Cart Drawer] New drawer element found:', !!newDrawerElement);
        console.log('[Cart Drawer] Current drawer element found:', !!currentDrawerElement);
        
        if (newDrawerElement && currentDrawerElement) {
          // Replace the drawer content with fresh cart data
          console.log('[Cart Drawer] Replacing drawer content');
          currentDrawerElement.innerHTML = newDrawerElement.innerHTML;
          console.log('[Cart Drawer] Content replaced successfully');
        } else {
          console.warn('[Cart Drawer] Could not find drawer elements to replace');
        }
      } catch (error) {
        console.error('[Cart Drawer] Error refetching cart section:', error);
      }
    }

    /**
     * Get the current position based on viewport size
     * @returns {string} Current position for the current viewport
     * @private
     */
    #getCurrentPosition() {
      return window.innerWidth >= 768 ? this.positionDesktop : this.positionMobile;
    }

    /**
     * Get initial transform based on position
     * @param {string} position - The position of the drawer
     * @returns {string} CSS transform value
     * @private
     */
    #getInitialTransform(position) {
      const isMobile = window.innerWidth < 768;
      const actualPosition = isMobile ? this.positionMobile : this.positionDesktop;
      
      switch (actualPosition) {
        case 'left':
          return 'translateX(calc(-100% - 1rem))';
        case 'right':
          return 'translateX(calc(100% + 1rem))';
        case 'bottom-auto':
        case 'bottom-to-top':
        case 'bottom-to-almost-top':
          return 'translateY(3rem) opacity(0)';
        case 'top-to-bottom':
          return 'translateY(-3rem)';
        default:
          return 'translateX(calc(100% + 1rem))';
      }
    }

    /**
     * Get open transform based on position
     * @param {string} position - The position of the drawer
     * @returns {string} CSS transform value
     * @private
     */
    #getOpenTransform(position) {
      const isMobile = window.innerWidth < 768;
      const actualPosition = isMobile ? this.positionMobile : this.positionDesktop;
      
      switch (actualPosition) {
        case 'left':
        case 'right':
        case 'top-to-bottom':
          return 'translate(0, 0)';
        case 'bottom-auto':
        case 'bottom-to-top':
        case 'bottom-to-almost-top':
          return 'translateY(0) opacity(1)';
        default:
          return 'translate(0, 0)';
      }
    }

    /**
     * Get animation keyframes based on position and state
     * @param {string} position - The position of the drawer
     * @param {boolean} isOpening - Whether the drawer is opening
     * @returns {Array} Array of keyframe objects
     * @private
     */
    #getAnimationKeyframes(position, isOpening) {
      const isMobile = window.innerWidth < 768;
      const actualPosition = isMobile ? this.positionMobile : this.positionDesktop;
      
      if (isOpening) {
        // Opening animation
        switch (actualPosition) {
          case 'left':
            return [
              { transform: 'translateX(calc(-100% - 1rem))', opacity: 1 },
              { transform: 'translateX(0)', opacity: 1 }
            ];
          case 'right':
            return [
              { transform: 'translateX(calc(100% + 1rem))', opacity: isMobile ? 1 : 0 },
              { transform: 'translateX(0)', opacity: 1 }
            ];
          case 'bottom-auto':
          case 'bottom-to-top':
          case 'bottom-to-almost-top':
            return [
              { transform: 'translateY(3rem)', opacity: 0 },
              { transform: 'translateY(0)', opacity: 1 }
            ];
          case 'top-to-bottom':
            return [
              { transform: 'translateY(-3rem)', opacity: 1 },
              { transform: 'translateY(0)', opacity: 1 }
            ];
          default:
            return [
              { transform: 'translateX(calc(100% + 1rem))', opacity: isMobile ? 1 : 0 },
              { transform: 'translateX(0)', opacity: 1 }
            ];
        }
      } else {
        // Closing animation
        switch (actualPosition) {
          case 'left':
            return [
              { transform: 'translateX(0)', opacity: 1 },
              { transform: 'translateX(calc(-100% - 1rem))', opacity: 1 }
            ];
          case 'right':
            return [
              { transform: 'translateX(0)', opacity: 1 },
              { transform: 'translateX(calc(100% + 1rem))', opacity: isMobile ? 1 : 0 }
            ];
          case 'bottom-auto':
          case 'bottom-to-top':
          case 'bottom-to-almost-top':
            return [
              { transform: 'translateY(0)', opacity: 1 },
              { transform: 'translateY(3rem)', opacity: 0 }
            ];
          case 'top-to-bottom':
            return [
              { transform: 'translateY(0)', opacity: 1 },
              { transform: 'translateY(-3rem)', opacity: 1 }
            ];
          default:
            return [
              { transform: 'translateX(0)', opacity: 1 },
              { transform: 'translateX(calc(100% + 1rem))', opacity: isMobile ? 1 : 0 }
            ];
        }
      }
    }

    /**
     * Prepare drawer for animation by setting initial state
     * @param {HTMLElement} drawer - The drawer element
     * @param {string} position - The position of the drawer
     * @private
     */
    prepareDrawerForAnimation(drawer, position) {
      drawer.style.visibility = "visible";
      drawer.style.transform = this.#getInitialTransform(position);
    }

    /**
     * Clean up drawer after animation
     * @param {HTMLElement} drawer - The drawer element
     * @param {string} position - The position of the drawer
     * @private
     */
    cleanupDrawerAfterAnimation(drawer, position) {
      if (!this.isOpen) {
        drawer.style.visibility = "hidden";
        drawer.style.transform = this.#getInitialTransform(position);
        // unlockScrollForThis(this)
      }
    }

    /**
     * Get animation options with proper duration and easing
     * @returns {Object} Animation options
     * @private
     */
    getAnimationOptions() {
      return {
        duration: this.animationDuration,
        easing: window.animation.cubicBezier,
        fill: "forwards",
      };
    }

    /**
     * Animation for opening the drawer
     * @returns {Promise} Promise that resolves when animation completes
     * @private
     */
    async openDrawerAnimation() {
      // lockScrollForThis(this)
      const { drawer, overlay } = this;
      const options = this.getAnimationOptions();
      const currentPosition = this.#getCurrentPosition();

      this.prepareDrawerForAnimation(drawer, currentPosition);

      const drawerAnimation = drawer.animate(
        this.#getAnimationKeyframes(currentPosition, true),
        options,
      );

      const overlayAnimation = overlay?.animate(
        [{ opacity: 0 }, { opacity: 0.7 }],
        options,
      );

      await Promise.all([
        drawerAnimation.finished,
        overlayAnimation?.finished,
      ]);

      drawer.style.transform = this.#getOpenTransform(currentPosition);

    }

    /**
     * Animation for closing the drawer
     * @returns {Promise} Promise that resolves when animation completes
     * @private
     */
    async closeDrawerAnimation() {
      const { drawer, overlay } = this;
      const options = this.getAnimationOptions();
      const currentPosition = this.#getCurrentPosition();

      const drawerAnimation = drawer.animate(
        this.#getAnimationKeyframes(currentPosition, false),
        options,
      );

      const overlayAnimation = overlay?.animate(
        [{ opacity: 0.7 }, { opacity: 0 }],
        options,
      );

      await Promise.all([
        drawerAnimation.finished,
        overlayAnimation?.finished,
      ]);

      this.cleanupDrawerAfterAnimation(drawer, currentPosition);
    }

    /**
     * Open the drawer with proper animation
     * @returns {Promise} Promise that resolves when drawer is fully open
     * @private
     */
    async openDrawer() {
      try {
        this.isOpen = true;
        this.keepHeader = true;

        // Use LayerManager to handle z-index with parent tracking
        if (window.layerManager) {
          const drawerId = this.id || `drawer-${Date.now()}`;
          const parentContext = window.layerManager.getCurrentContext();
          window.layerManager.push(drawerId, 'drawer', this, parentContext);
          this.dataset.layerId = drawerId;

          // Mark as animating
          window.layerManager.startAnimating(drawerId);
        }

        // Update header sticky offset before opening drawer
        const headerElement = document.querySelector('header-element');
        if (headerElement && typeof headerElement.updateHeaderStickyOffset === 'function') {
          headerElement.updateHeaderStickyOffset();
        }

        // Show the drawer container
        this.style.display = 'block';
        this.classList.remove('hidden');

        // Handle nested drawer height constraints
        console.log('DrawerElement: Opening drawer', this.id);
        this.#constrainNestedDrawerHeight();

        // Lock scroll for this drawer
        if (typeof lockScrollForThis === 'function') {
          lockScrollForThis(this);
        }

        this.storeHeaderState();
        this.addBodyClass();
        this.dispatchEvent(new CustomEvent('drawer:opening', {
          bubbles: true,
          detail: { drawer: this }
        }));
        await this.openDrawerAnimation();

        // Animation complete
        if (window.layerManager && this.dataset.layerId) {
          window.layerManager.stopAnimating(this.dataset.layerId);
        }

        this.focusFirstFocusableElement();

        // Dispatch opened event
        this.dispatchEvent(new CustomEvent('drawer:opened', {
          bubbles: true,
          detail: { drawer: this }
        }));
      } catch (error) {
        console.error('DrawerElement: Error opening drawer:', error);
        this.isOpen = false;
        this.keepHeader = false;
        this.style.display = 'none';
      }
    }

    /**
     * Close the drawer with proper animation
     * @returns {Promise} Promise that resolves when drawer is fully closed
     * @private
     */
    async closeDrawer() {
      try {
        this.isOpen = false;
        this.keepHeader = false;

        // Mark as animating before removal
        if (window.layerManager && this.dataset.layerId) {
          window.layerManager.startAnimating(this.dataset.layerId);
        }

        this.removeBodyClass();
        this.dispatchEvent(new CustomEvent('drawer:closing', {
          bubbles: true,
          detail: { drawer: this }
        }));
        await this.closeDrawerAnimation();
        
        // Hide the drawer container first to prevent flash
        this.style.display = 'none';
        
        // Unlock scroll for this drawer
        if (typeof unlockScrollForThis === 'function') {
          unlockScrollForThis(this);
        }
        
        // Restore header state after drawer is hidden and scroll is unlocked
        this.restoreHeaderState();
        this.focusLastFocusedElement();

        // Reset height constraints when closing
        this.#resetHeightConstraints();

        // Animation complete - now remove from LayerManager
        if (window.layerManager && this.dataset.layerId) {
          window.layerManager.stopAnimating(this.dataset.layerId);
          window.layerManager.remove(this.dataset.layerId);
          delete this.dataset.layerId;
        }

        // Dispatch closed event
        this.dispatchEvent(new CustomEvent('drawer:closed', {
          bubbles: true,
          detail: { drawer: this }
        }));
      } catch (error) {
        console.error('DrawerElement: Error closing drawer:', error);
        this.isOpen = true;
        this.keepHeader = true;
      }
    }

    /**
     * Toggle the drawer state
     * @param {HTMLElement} trigger - The element that triggered the toggle
     * @private
     */
    toggleDrawer(trigger) {
      if (this.isOpen) {
        this.closeDrawer();
      } else {
        this.openDrawer();
      }
    }

    /**
     * Store the current header state
     * @private
     */
    storeHeaderState() {
      const header = document.querySelector("header");
      if (header) {
        this.dataset.originalStickyState = header.dataset.sticky;
        // header.dataset.sticky = "false";
      }
    }

    /**
     * Restore the original header state
     * @private
     */
    restoreHeaderState() {
      const header = document.querySelector("header");
      if (header && this.dataset.originalStickyState !== undefined) {
        header.dataset.sticky = this.dataset.originalStickyState;
      }
    }

    /**
     * Add body class for drawer open state
     * @private
     */
    addBodyClass() {
      document.body.classList.add("drawer-open", "overflow-hidden");
    }

    /**
     * Remove body class for drawer open state
     * @private
     */
    removeBodyClass() {
      document.body.classList.remove("drawer-open", "overflow-hidden");
    }

    /**
     * Focus the first focusable element in the drawer
     * @private
     */
    focusFirstFocusableElement() {
      const focusableElements = this.drawer.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    }

    /**
     * Focus the last focused element before drawer opened
     * @private
     */
    focusLastFocusedElement() {
      // This would need to be implemented based on your focus management strategy
      // For now, we'll just focus the body
      document.body.focus();
    }

    /**
     * Handle key events for accessibility
     * @param {KeyboardEvent} event - The key event
     * @private
     */
    onKeyUp(event) {
      if (event.key === "Escape" && this.isOpen) {
        this.closeDrawer();
      }
    }

    /**
     * Cleanup method to reset stored states and prevent memory leaks
     * @private
     */
    cleanup() {
      delete this.dataset.originalStickyState;
      
      // Clear resize timeout
      if (this.resizeTimeout) {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = null;
      }
    }

    // Static utility methods for component querying and validation
    static isValidDrawer(element) {
      return element && element.tagName === 'DRAWER-ELEMENT';
    }

    static getDrawerPosition(element) {
      if (!this.isValidDrawer(element)) {
        return null;
      }
      
      return {
        mobile: element.dataset.positionMobile || 'right',
        desktop: element.dataset.positionDesktop || 'right'
      };
    }

    /**
     * Handle search opened event by closing the drawer
     * @param {CustomEvent} event - The search opened event
     * @private
     */
    #handleSearchOpened(event) {
      // Close drawer if it's currently open
      if (this.isOpen) {
        this.closeDrawer();
      }
    }

    /**
     * Constrain nested drawer height to prevent parent drawer bleed-through
     * @private
     */
    #constrainNestedDrawerHeight() {
      // Check if this drawer is nested within another drawer
      const parentDrawer = this.closest('drawer-element');
      
      if (parentDrawer && parentDrawer !== this) {
        // This is a nested drawer - constrain the parent drawer's height
        const parentDrawerElement = parentDrawer.querySelector('drawer');
        if (parentDrawerElement) {
          // Get the current viewport height
          const viewportHeight = window.innerHeight;
          
          // Calculate available height (viewport minus any header offset)
          const headerElement = document.querySelector('header');
          const headerHeight = headerElement ? headerElement.offsetHeight : 0;
          const availableHeight = viewportHeight - headerHeight;
          
          // Apply height constraint to the parent drawer element
          parentDrawerElement.style.maxHeight = `${availableHeight}px`;
          parentDrawerElement.style.height = `${availableHeight}px`;
          
          // Also constrain the parent drawer container
          parentDrawer.style.maxHeight = `${availableHeight}px`;
          parentDrawer.style.height = `${availableHeight}px`;
          
          // Add a class for CSS targeting
          parentDrawer.classList.add('parent-drawer-constrained');
          this.classList.add('nested-drawer-active');
          
          console.log('DrawerElement: Constrained parent drawer height to', availableHeight, 'px');
        }
      } else {
        // This is a top-level drawer - ensure no height constraints
        this.drawer.style.maxHeight = '';
        this.drawer.style.height = '';
        this.style.height = '';
        this.style.maxHeight = '';
        this.classList.remove('nested-drawer-constrained');
      }
    }

    /**
     * Reset height constraints for this drawer
     * @private
     */
    #resetHeightConstraints() {
      // Check if this drawer is nested within another drawer
      const parentDrawer = this.closest('drawer-element');
      
      if (parentDrawer && parentDrawer !== this) {
        // Reset constraints on the parent drawer
        const parentDrawerElement = parentDrawer.querySelector('drawer');
        if (parentDrawerElement) {
          parentDrawerElement.style.maxHeight = '';
          parentDrawerElement.style.height = '';
          parentDrawer.style.maxHeight = '';
          parentDrawer.style.height = '';
          parentDrawer.classList.remove('parent-drawer-constrained');
          
          console.log('DrawerElement: Reset parent drawer height constraints');
        }
      }
      
      // Reset constraints on this drawer
      this.drawer.style.maxHeight = '';
      this.drawer.style.height = '';
      this.style.height = '';
      this.style.maxHeight = '';
      this.classList.remove('nested-drawer-constrained', 'nested-drawer-active');
    }

    /**
     * Cleanup event listeners when element is removed
     */
    disconnectedCallback() {
      if (this.boundSearchOpenedHandler) {
        document.removeEventListener('search:opened', this.boundSearchOpenedHandler);
      }
      
      // Clean up resize handler
      if (this.resizeHandler) {
        window.removeEventListener('resize', this.resizeHandler);
      }
      
      // Clean up timeout
      if (this.resizeTimeout) {
        clearTimeout(this.resizeTimeout);
      }
    }
  }
);

/**
 * AccordionDisclosure - A web component for collapsible accordion sections with sync group support
 * 
 * This component extends the native HTML details element to provide enhanced accordion functionality
 * with smooth animations, keyboard navigation, and sync group support. Can be synchronized with
 * other disclosure elements using the data-sync-group attribute.
 * 
 * @example
 * <details is="accordion-disclosure" data-sync-group="my-group">
 *   <summary>Accordion Title</summary>
 *   <div>Accordion content...</div>
 * </details>
 */


// ElectricTab component - handles tab switching with proper ARIA support
class ElectricTab extends HTMLElement {
  #abortController; // Declare private field
  #isInitialized = false;
  
  constructor() {
    super();
    this.activeTabClass = 'text-body';
    this.inactiveTabClass = 'text-body/50';
    this.hiddenContentClass = 'hidden';
    this.#abortController = new AbortController();
    this.collectionId = null;
    this.collectionHandle = null;
  }

  connectedCallback() {
    this.tabButtons = this.querySelectorAll('[data-tab-button]');
    this.tabContents = this.querySelectorAll('[data-tab-content]');
    
    this.tabButtons.forEach(button => {
      button.addEventListener('click', this.#handleTabClick.bind(this), {
        signal: this.#abortController.signal
      });
      button.addEventListener('keydown', this.#handleKeyDown.bind(this), {
        signal: this.#abortController.signal
      });
    });

    // Activate first tab by default without focusing to prevent auto-scroll
    this.#activateTab(0, false);
  }

  disconnectedCallback() {
    this.#abortController.abort();
  }

  #handleTabClick(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const tabIndex = parseInt(button.dataset.tabIndex, 10);
    this.#activateTab(tabIndex);
  }

  #handleKeyDown(event) {
    const currentIndex = parseInt(event.currentTarget.dataset.tabIndex, 10);
    
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        this.#activateTab(Math.max(0, currentIndex - 1), true);
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.#activateTab(Math.min(this.tabButtons.length - 1, currentIndex + 1), true);
        break;
      case 'Home':
        event.preventDefault();
        this.#activateTab(0, true);
        break;
      case 'End':
        event.preventDefault();
        this.#activateTab(this.tabButtons.length - 1, true);
        break;
    }
  }

  #activateTab(tabIndex, shouldFocus = false) {
    // Update tab buttons
    this.tabButtons.forEach((btn, index) => {
      const isActive = index === tabIndex;
      btn.classList.toggle(this.activeTabClass, isActive);
      btn.classList.toggle(this.inactiveTabClass, !isActive);
      btn.setAttribute('aria-selected', isActive.toString());
      // Keep all tabs focusable for keyboard navigation - WCAG 2.1 compliance
      btn.setAttribute('tabindex', '0');
    });

    // Update tab contents
    this.tabContents.forEach((content, index) => {
      const isActive = index === tabIndex;
      content.classList.toggle(this.hiddenContentClass, !isActive);
      content.setAttribute('aria-hidden', (!isActive).toString());
    });

    // Only focus if explicitly requested (e.g., from keyboard navigation)
    if (shouldFocus) {
      this.tabButtons[tabIndex]?.focus();
    }

    // Announce tab change to screen readers
    this.#announceTabChange(tabIndex);

    // Dispatch custom event for the parent component to handle
    this.dispatchEvent(new CustomEvent('tabChanged', {
      bubbles: true,
      detail: { tabIndex }
    }));
  }

  /**
   * Announce tab change to screen readers
   * @param {number} tabIndex - Index of the activated tab
   * @private
   */
  #announceTabChange(tabIndex) {
    const activeTab = this.tabButtons[tabIndex];
    if (!activeTab) return;

    // Create or get the announcer element
    let announcer = this.querySelector('[aria-live]');
    if (!announcer) {
      announcer = document.createElement('div');
      announcer.setAttribute('aria-live', 'polite');
      announcer.setAttribute('aria-atomic', 'true');
      announcer.className = 'sr-only';
      this.appendChild(announcer);
    }

    // Announce the tab change
    const tabText = activeTab.textContent?.trim() || `Tab ${tabIndex + 1}`;
    announcer.textContent = `Switched to ${tabText} tab`;
  }
}

// Register the custom elements
if (!customElements.get('electric-tab')) {
  customElements.define('electric-tab', ElectricTab);
}
