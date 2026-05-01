function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

function fetchConfig(type = "json") {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: `application/${type}`,
    },
  };
}

// Scroll lock manager with reference counting
const scrollLockManager = {
  lockedBy: new Set(),
  scrollY: 0,

  lock(element) {
    // Store scroll position on first lock
    if (this.lockedBy.size === 0) {
      this.scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${this.scrollY}px`;
      document.body.style.width = "100%";
    }

    // Add element to locked set
    this.lockedBy.add(element);
    element.dataset.scrollY = this.scrollY;
  },

  unlock(element) {
    // Remove element from locked set
    this.lockedBy.delete(element);

    // Only unlock body if no more elements need lock
    if (this.lockedBy.size === 0) {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo({
        behavior: "instant",
        left: 0,
        top: this.scrollY,
      });
      console.log('Body scroll unlocked');
    }
  },

  isLocked() {
    return this.lockedBy.size > 0;
  },

  clear() {
    this.lockedBy.clear();
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";
  }
};

// Maintain backward compatibility
function lockScrollForThis(element) {
  scrollLockManager.lock(element);
}

function unlockScrollForThis(element) {
  scrollLockManager.unlock(element);
}

// fix childMenu positions
const fixChildMenuPositions = () => {
  const viewport = window.visualViewport;
  if (viewport && typeof viewport.scale === "number" && Math.abs((viewport.scale || 1) - 1) > 0.001) {
    return;
  }
  const childMenus = document.querySelectorAll("._headerChildMenu");
  const isRTL = document.body.style.direction === "rtl";
  const windowWidth = window.innerWidth;

  childMenus.forEach((childMenu) => {
    let isOffScreen = false;
    const childMenuRect = childMenu.getBoundingClientRect();

    // Check if the child menu itself is off-screen
    if (isRTL) {
      isOffScreen = childMenuRect.left < 0;
    } else {
      isOffScreen = childMenuRect.right > windowWidth;
    }

    // If child menu is not off-screen, check its grandchild menus
    if (!isOffScreen) {
      const grandChildMenus = childMenu.querySelectorAll(
        "._headerGrandChildMenu",
      );
      grandChildMenus.forEach((grandChildMenu) => {
        // Temporarily make the grandchild menu visible for accurate measurements
        const originalDisplay = grandChildMenu.style.display;
        grandChildMenu.style.display = "block";
        grandChildMenu.style.visibility = "hidden";

        const grandChildMenuRect = grandChildMenu.getBoundingClientRect();

        // Restore original display
        grandChildMenu.style.display = originalDisplay;
        grandChildMenu.style.visibility = "";

        if (isRTL) {
          if (grandChildMenuRect.left < 0) isOffScreen = true;
        } else {
          if (grandChildMenuRect.right > windowWidth) isOffScreen = true;
        }
      });
    }

    if (isOffScreen) {
      childMenu.setAttribute("data-offscreen", "true");
    } else {
      childMenu.removeAttribute("data-offscreen");
    }
  });
};

window.addEventListener("resize", debounce(fixChildMenuPositions, 150));
window.addEventListener("DOMContentLoaded", fixChildMenuPositions);


function initImageTextSliders() {
  document.querySelectorAll('.js-image-text-toggle').forEach((el) => {
    el.addEventListener('click', () => {
      el.classList.toggle('active');
    });
  });
}

['DOMContentLoaded', 'shopify:section:load'].forEach((event) => {
  document.addEventListener(event, initImageTextSliders);
});

const normalize = (str) => str?.toString().trim().toLowerCase() || '';
(function () {
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
})();
(function () {
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
})();
(function () {
class RevealStack extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    document.fonts.ready.then(() => {
      this.init();
    });
  }

  init() {
    const children = Array.from(this.children);

    // Use reduce to keep track of total lines processed
    children.reduce((totalLines, child, index) => {
      // Only split text if the element has data-split="true"
      if (child.hasAttribute('data-split') && child.textContent.trim()) {
        const splitText = new SplitText(child, {
          type: "lines",
          linesClass: "line line++",
          onSplit: (self) => {
            // Wrap each line in a div for better control
            self.lines.forEach(line => {
              line.classList.add('overflow-hidden');
              const wrapper = document.createElement('div');
              wrapper.classList.add('overflow-hidden');
              line.parentNode.insertBefore(wrapper, line);
              wrapper.appendChild(line);
            });

            // Animate each line with stagger, adding delay based on total lines processed
            gsap.from(self.lines, {
              duration: 0.8,
              y: '100%',
              opacity: 0,
              ease: 'power4.out',
              stagger: 0.15,
              delay: totalLines * 0.15,
              scrollTrigger: {
                trigger: this,
                start: 'top 80%',
                once: true
              },
              onComplete: () => {
                // Revert split text and remove wrappers
                // self.revert();
                // Remove overflow-hidden class from the original element
                child.classList.remove('overflow-hidden');
              }
            });

            // Store the split text instance for cleanup
            child._splitText = self;
          }
        });


        // Return updated total lines count
        return totalLines + splitText.lines.length;
      } else {
        // For non-split elements, wrap them in a container for overflow control
        // child has margins, move the margins to the wrapper
        const wrapper = document.createElement('div');
        const innerWrapper = document.createElement('div');
        wrapper.classList.add('overflow-hidden');
        wrapper.style.marginTop = window.getComputedStyle(child).marginTop;
        wrapper.style.marginBottom = window.getComputedStyle(child).marginBottom;
        wrapper.style.marginLeft = window.getComputedStyle(child).marginLeft;
        wrapper.style.marginRight = window.getComputedStyle(child).marginRight;
        child.style.margin = '0';
        child.parentNode.insertBefore(wrapper, child);
        innerWrapper.appendChild(child);
        wrapper.appendChild(innerWrapper);

        const y = child.dataset.y || '100%';

        // Animate with the same style as text, adding delay based on total lines processed
        gsap.from(innerWrapper, {
          duration: 0.8,
          y: y,
          opacity: 0,
          ease: 'power4.out',
          delay: totalLines * 0.15,
          scrollTrigger: {
            trigger: this,
            start: '10% 80%',
            once: true
          },
          onComplete: () => {
            // Move the child back to its original position
            const parent = wrapper.parentNode;
            parent.insertBefore(child, wrapper);
            // Restore original margins
            child.style.margin = '';
            // Remove the wrapper
            parent.removeChild(wrapper);
          }
        });

        // Return updated total lines count (increment by 1 for non-split elements)
        return totalLines + 1;
      }
    }, 0); // Start with 0 total lines

    // Clean up on unmount
    this.addEventListener('unmount', () => {
      children.forEach(child => {
        if (child._splitText) {
          child._splitText.revert();
        }
      });
    });
  }
}

customElements.define('reveal-stack', RevealStack);

class ParallaxBackground extends HTMLElement {
  constructor() {
    super();
    this.preloadBackgroundImage();
  }

  connectedCallback() {
    if (!this.closest('animated-section')) {
      this.init();
    }
  }

  preloadBackgroundImage() {
    // Get the background image URL from the style attribute
    const style = this.getAttribute('style');
    if (style && style.backgroundImage) {
      const imageUrl = style.backgroundImage.replace('url(', '').replace(')', '');
      if (imageUrl) {
        // Create link preload element for highest priority
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = imageUrl;
        link.fetchPriority = 'high';
        document.head.appendChild(link);

        // Also create an Image object as backup
        const img = new Image();
        img.src = imageUrl;
      }
    }
  }

  init() {
      let { backgroundSize = 100, y = 100 } = this.dataset;
      let fromBackgroundSize = '';
      let toBackgroundSize = '';

      // detect the aspect ratio of the background image and 'this's ratio and switch the place of 'auto' in the gsap set and gsap to.
      const backgroundImage = this.style.backgroundImage;
      const backgroundImageUrl = backgroundImage.replace('url(', '').replace(')', '');
      // Skip if no background image or regex match failed
      if (!backgroundImage || !backgroundImageUrl) {
        return;
      }

      const backgroundImageObj = new Image();
      backgroundImageObj.src = backgroundImageUrl;
      const backgroundImageAspectRatio = parseInt(this.dataset.width) / parseInt(this.dataset.height);
      const thisAspectRatio = this.offsetWidth / this.offsetHeight;
      if (backgroundImageAspectRatio > thisAspectRatio) {
        fromBackgroundSize = `auto ${backgroundSize}%`;
        toBackgroundSize = `auto 100%`;
      } else {
        fromBackgroundSize = `${backgroundSize}% auto`;
        toBackgroundSize = `100% auto`;
      }

      gsap.set(this, {
        backgroundPosition: `50% ${y}%`,
        backgroundSize: fromBackgroundSize
      })

      gsap.to(this, {
        backgroundPosition: '50% 50%',
        backgroundSize: toBackgroundSize,
        ease: 'none',
        scrollTrigger: {
          trigger: this,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true
        }
      });
  }
}

customElements.define('parallax-background', ParallaxBackground);

class AnimatedSection extends HTMLElement {
  constructor() {
    super();
    this.parallaxItems = [];
  }

  connectedCallback() {
    ScrollTrigger.refresh();
    this.init();
  }

  init() {
    // Check if user prefers reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    this.initParallaxItems();
    this.initParallaxBackground();
    this.initFadeInItems();
  }

  initFadeInItems() {
    this.fadeInItems = Array.from(this.querySelectorAll('fade-in-item'));
    this.fadeInItems.forEach(item => {
      // Set initial state
      gsap.set(item, {
        opacity: 0,
        y: 30
      });

      // Create scroll trigger
      ScrollTrigger.create({
        trigger: item,
        start: 'top 80%',
        onEnter: () => {
          gsap.to(item, {
            opacity: 1,
            y: 0,
            duration: 1.2,
            ease: 'power2.out'
          });
        },
        once: true
      });
    });
  }

  initParallaxBackground() {
    this.parallaxBackgrounds = Array.from(this.querySelectorAll('parallax-background'))

    this.parallaxBackgrounds.forEach(background => {
      background.init();
    });
  }

  initParallaxItems() {
    this.parallaxItems = Array.from(this.querySelectorAll('parallax-item'));

    this.parallaxItems.forEach(item => {
      const yPercent = parseInt(item.dataset.y) || 100;

      // Set initial position
      gsap.set(item, {
        yPercent: -yPercent
      });

      // Animate to final position
      gsap.to(item, {
        yPercent: yPercent,
        ease: 'power2.inOut',
        scrollTrigger: {
          trigger: this,
          start: 'top bottom',
          end: 'bottom top',
          scrub: item.dataset.scrub || 0.8,
        }
      });
    });
  }
}

class ParallaxItem extends HTMLElement {
  constructor() {
    super();
  }
}

customElements.define('animated-section', AnimatedSection);
customElements.define('parallax-item', ParallaxItem);
})();
(function () {

})();
(function () {
/**
 * Dynamic section loader for Shopify themes
 * 
 * Handles lazy loading, content replacement, and URL-based updates
 * for Shopify theme sections with performance optimizations.
 * 
 * @example
 * <electric-section 
 *   data-section-id="collection-main"
 *   data-url="/collections/all"
 *   data-animate="true"
 *   data-onload="true"
 *   data-fire-event="section-updated">
 * </electric-section>
 * 
 * @example
 * // With custom event trigger
 * <electric-section 
 *   data-section-id="product-grid"
 *   data-load-on-event="filter-changed"
 *   data-animate="false">
 * </electric-section>
 * 
 * @example
 * // Prefetch and fetch events
 * const section = document.querySelector('electric-section');
 * 
 * // Prefetch content without replacing
 * section.dispatchEvent(new CustomEvent('electric-section:prefetch', {
 *   detail: { url: '/collections/all?sort_by=price-ascending' }
 * }));
 * 
 * // Fetch and replace content immediately
 * section.dispatchEvent(new CustomEvent('electric-section:fetch', {
 *   detail: { url: '/collections/all?sort_by=price-descending' }
 * }));
 */
class ElectricSection extends HTMLElement {
  // Private fields
  #intersectionObserver = null;
  #isInitializing = true;
  #lastFetchedUrl = null;
  #debouncedCheckAndFetch = null;
  #temporaryData = new WeakMap();
  #connectionState = 'disconnected';
  #selectorCache = new Map();
  #fragmentCache = new Map();
  #cacheSize = 0;
  #maxCacheSize = 10; // Maximum number of cached fragments
  #performanceObserver = null;

  // Observed attributes for reactive updates
  static observedAttributes = [
    "data-url",
    "data-section-id",
    "data-selector",
    "data-animate",
    "data-fire-event",
    "data-onload",
    "data-load-on-event",
    "data-to-keep",
    "data-disable-pop-events"
  ];

  // Relevant URL parameters for change detection
  static #RELEVANT_PARAMS = new Set([
    "sort_by",
    "page",
    "q",
    "view",
    "limit"
  ]);

  constructor() {
    super();
    
    // Create debounced fetch function once
    this.#debouncedCheckAndFetch = this.#debounce(
      this.#checkAndFetch.bind(this),
      250
    );

    // Setup performance monitoring
    this.#setupPerformanceMonitoring();
  }

  /**
   * Called when element is connected to DOM
   * @private
   */
  connectedCallback() {
    if (this.#connectionState === 'connected') return;
    
    try {
      this.#setupInitialState();
      this.#addEventListeners();
      this.#restoreTemporaryData();
      
      // Setup lazy loading if enabled
      if (this.dataset.onload === "true") {
        this.#setupIntersectionObserver();
      }
      
      this.#isInitializing = false;
      this.#connectionState = 'connected';
      
      // Dispatch ready event
      this.#dispatchEvent('electric-section-ready', { 
        sectionId: this.#getSectionId() 
      });
      
    } catch (error) {
      console.error('[ElectricSection] Initialization error:', error);
      this.#dispatchEvent('electric-section-error', { error });
    }
  }

  /**
   * Called when element is disconnected from DOM
   * @private
   */
  disconnectedCallback() {
    this.#connectionState = 'disconnected';
    this.#removeEventListeners();
    this.#removeIntersectionObserver();
    this.#removePerformanceObserver();
  }

  /**
   * Called when observed attributes change
   * @param {string} name - Attribute name
   * @param {string} oldValue - Previous value
   * @param {string} newValue - New value
   * @private
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || this.#isInitializing) return;

    switch (name) {
      case 'data-url':
        // Pass the new URL value to ensure we use the updated value
        this.#debouncedCheckAndFetch(false, true, newValue);
        break;
      case 'data-onload':
        if (newValue === "true") {
          this.#setupIntersectionObserver();
        } else {
          this.#removeIntersectionObserver();
        }
        break;
    }
  }

  /**
   * Setup intersection observer for lazy loading
   * @private
   */
  #setupIntersectionObserver() {
    if (this.#intersectionObserver) return;

    const options = {
      rootMargin: "0px 0px 800px 0px", // 800px below viewport
      threshold: 0
    };

    this.#intersectionObserver = new IntersectionObserver(
      (entries) => this.#handleIntersection(entries),
      options
    );

    this.#intersectionObserver.observe(this);
  }

  /**
   * Handle intersection observer callback
   * @param {IntersectionObserverEntry[]} entries - Intersection entries
   * @private
   */
  #handleIntersection(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting && this.dataset.onload === "true") {
        queueMicrotask(() => this.#checkAndFetch(true));
        this.#removeIntersectionObserver();
      }
    });
  }

  /**
   * Remove intersection observer
   * @private
   */
  #removeIntersectionObserver() {
    if (this.#intersectionObserver) {
      this.#intersectionObserver.disconnect();
      this.#intersectionObserver = null;
    }
  }

  /**
   * Setup initial state and URL
   * @private
   */
  #setupInitialState() {
    const defaultUrl = new URL(window.location.href);
    defaultUrl.searchParams.delete("section_id");
    
    this.#lastFetchedUrl = this.dataset.url || window.location.href;
    
    // Set ARIA attributes for accessibility
    this.setAttribute('aria-live', 'polite');
    this.setAttribute('role', 'region');
  }

  /**
   * Add event listeners for navigation and custom events
   * @private
   */
  #addEventListeners() {
    if (this.dataset.disablePopEvents !== "true") {
      window.addEventListener("popstate", () => this.#handlePopState(), { passive: true });
    }
    
    if (this.dataset.loadOnEvent) {
      window.addEventListener(this.dataset.loadOnEvent, () => this.#handlePopState(), { passive: true });
    }

    // Listen for prefetch and fetch events
    this.addEventListener('electric-section:prefetch', (e) => this.#handlePrefetchEvent(e));
    this.addEventListener('electric-section:fetch', (e) => this.#handleFetchEvent(e));
  }

  /**
   * Remove event listeners
   * @private
   */
  #removeEventListeners() {
    // Note: We can't remove arrow function listeners, but this is acceptable
    // since the element will be garbage collected when disconnected
  }

  /**
   * Handle browser navigation events
   * @private
   */
  #handlePopState() {
    this.dataset.url = this.#buildFetchUrl(window.location.href);
    this.#debouncedCheckAndFetch(false);
  }

  /**
   * Handle prefetch event - fetch and cache content without replacing
   * @param {CustomEvent} event - Prefetch event
   * @private
   */
  #handlePrefetchEvent(event) {
    const url = this.#buildFetchUrl(event.detail?.url);
    if (!url) {
      console.warn('[ElectricSection] Prefetch event missing URL in detail');
      return;
    }

    this.#prefetchContent(url);
  }

  /**
   * Handle fetch event - fetch and replace content immediately
   * @param {CustomEvent} event - Fetch event
   * @private
   */
  #handleFetchEvent(event) {
    const url = this.#buildFetchUrl(event.detail?.url);
    if (!url) {
      console.warn('[ElectricSection] Fetch event missing URL in detail');
      return;
    }

    // Update the data-url attribute to trigger normal fetch flow
    this.dataset.url = url;
  }

  /**
   * Check if content should be fetched and fetch if needed
   * @param {boolean} isInitialLoad - Whether this is the initial load
   * @param {boolean} isAttributeChange - Whether triggered by attribute change
   * @param {string} newUrl - New URL value (for attribute changes)
   * @returns {Promise<boolean>} Whether content was fetched
   * @private
   */
  async #checkAndFetch(isInitialLoad = false, isAttributeChange = false, newUrl = null) {
    const startTime = performance.now();
    
    try {
      // Use the new URL if provided (for attribute changes), otherwise use dataset.url
      const urlToUse = newUrl || this.dataset.url;
      const currentUrl = new URL(urlToUse, window.location.origin);
      const dataUrl = new URL(this.#lastFetchedUrl, window.location.origin);

      // Get all relevant parameters including dynamic filters
      const relevantParams = this.#getRelevantParameters(currentUrl, dataUrl);
      
      // Always fetch on attribute change, otherwise check if it's initial load
      let shouldFetch = isAttributeChange || isInitialLoad;

      if (shouldFetch) {
        const fetchUrl = this.#buildFetchUrl(urlToUse);

        if (fetchUrl !== this.#lastFetchedUrl) {
          this.#lastFetchedUrl = fetchUrl;

          const success = await this.#fetchAndReplaceContent(fetchUrl, isAttributeChange);
          
          // Log performance if operation took longer than 16ms
          const duration = performance.now() - startTime;
          if (duration > 16) {
            console.warn(`[ElectricSection] Slow operation: ${duration.toFixed(2)}ms`);
          }
          
          return success;
        }
      }
      
      return false;
    } catch (error) {
      console.error('[ElectricSection] Check and fetch error:', error);
      this.#dispatchEvent('electric-section-error', { error });
      return false;
    }
  }

  /**
   * Get all relevant URL parameters including dynamic filters
   * @param {URL} currentUrl - Current URL
   * @param {URL} dataUrl - Data URL
   * @returns {Set<string>} Set of relevant parameter names
   * @private
   */
  #getRelevantParameters(currentUrl, dataUrl) {
    const params = new Set(ElectricSection.#RELEVANT_PARAMS);
    
    // Add dynamic filter parameters
    [currentUrl, dataUrl].forEach(url => {
      Array.from(url.searchParams.keys())
        .filter(key => key.startsWith('filter.'))
        .forEach(key => params.add(key));
    });
    
    return params;
  }

  /**
   * Update URL parameters with new values
   * @param {URL} url - URL to update
   * @param {string} param - Parameter name
   * @param {string[]} values - New values
   * @private
   */
  #updateUrlParameters(url, param, values) {
    url.searchParams.delete(param);
    values.forEach(value => url.searchParams.append(param, value));
  }

  /**
   * Build fetch URL with section ID
   * @param {string} url - Base URL
   * @returns {string} Fetch URL with section ID
   * @private
   */
  #buildFetchUrl(url) {
    const fetchUrl = new URL(url, window.location.origin);
    const sectionId = this.#getSectionId();
    if (sectionId) {
      fetchUrl.searchParams.set("section_id", sectionId);
    }
    return fetchUrl.toString();
  }

  /**
   * Get the section ID from the closest section element or data attribute
   * @returns {string|null} Section ID or null if not found
   * @private
   */
  #getSectionId() {
    // First check if we have a data-section-id attribute
    if (this.dataset.sectionId) {
      return this.dataset.sectionId;
    }
    
    // Find the closest section element
    const sectionElement = this.closest('section');
    if (sectionElement) {
      // Try to get the section ID from the section element's ID
      const sectionId = sectionElement.id;
      if (sectionId && sectionId.startsWith('shopify-section-')) {
        return sectionId.replace('shopify-section-', '');
      }
      
      // Try to get from data-section-id attribute on the section
      if (sectionElement.dataset.sectionId) {
        return sectionElement.dataset.sectionId;
      }
    }
    
    return null;
  }

  /**
   * Get optimized selector for section ID
   * @param {string} sectionId - Section ID
   * @returns {string} Optimized selector
   * @private
   */
  #getOptimizedSelector(sectionId) {
    if (!this.#selectorCache.has(sectionId)) {
      // Try selectors in order of specificity and performance
      const selectors = [
        `#shopify-section-${sectionId}`, // Most specific, fastest
        `[data-section-id="${sectionId}"]`,
        `[data-section="${sectionId}"]`
      ];
      
      // Cache the first working selector
      for (const selector of selectors) {
        if (document.querySelector(selector)) {
          this.#selectorCache.set(sectionId, selector);
          break;
        }
      }
      
      // Fallback to first selector if none found
      if (!this.#selectorCache.has(sectionId)) {
        this.#selectorCache.set(sectionId, selectors[0]);
      }
    }
    
    return this.#selectorCache.get(sectionId);
  }

  /**
   * Store temporary data before content replacement
   * @private
   */
  #storeTemporaryData() {
    if (!this.dataset.toKeep) return;
    
    const dataToKeep = {};
    this.dataset.toKeep.split(",").forEach(key => {
      dataToKeep[key.trim()] = this.dataset[key.trim()];
    });
    
    this.#temporaryData.set(this, dataToKeep);
    
    // Auto-cleanup after 3 seconds
    setTimeout(() => {
      this.#temporaryData.delete(this);
    }, 3000);
  }

  /**
   * Restore temporary data after content replacement
   * @private
   */
  #restoreTemporaryData() {
    const savedData = this.#temporaryData.get(this);
    if (!savedData) return;
    
    Object.entries(savedData).forEach(([key, value]) => {
      this.dataset[key] = value;
    });
  }

  /**
   * Fetch and replace content
   * @param {string} url - URL to fetch from
   * @param {boolean} isAttributeChange - Whether triggered by attribute change
   * @returns {Promise<boolean>} Whether operation was successful
   * @private
   */
  async #fetchAndReplaceContent(url, isAttributeChange = false) {
    const startTime = performance.now();
    
    try {
      this.setAttribute('aria-busy', 'true');
      this.#storeTemporaryData();
      
      let newContent = this.#getCachedFragment(url);
      
      if (!newContent) {
        const response = await this.#fetchWithRetry(url);
        const html = await response.text();
        newContent = this.#parseHTML(html);
        
        if (newContent === null) {
          this.remove();
          return false;
        }
        
        // Cache the parsed fragment
        this.#cacheFragment(url, newContent);
      }

      // Replace content with or without animation
      if (this.dataset.animate !== "false") {
        await this.#animateTransition(newContent);
      } else {
        this.#replaceContent(newContent);
      }

      this.#fireCustomEvent(newContent);
      
      const duration = performance.now() - startTime;
      this.#dispatchEvent('electric-section-updated', { 
        url, 
        duration,
        isAttributeChange 
      });
      
      return true;
    } catch (error) {
      console.error('[ElectricSection] Fetch and replace error:', error);
      this.#dispatchEvent('electric-section-error', { error });
      return false;
    } finally {
      this.removeAttribute('aria-busy');
    }
  }

  /**
   * Get cached fragment if available
   * @param {string} url - URL to check cache for
   * @returns {Element|null} Cached fragment or null
   * @private
   */
  #getCachedFragment(url) {
    const cached = this.#fragmentCache.get(url);
    if (cached) {
      // Move to end for LRU behavior
      this.#fragmentCache.delete(url);
      this.#fragmentCache.set(url, cached);
      return cached.cloneNode(true);
    }
    return null;
  }

  /**
   * Cache fragment with LRU behavior
   * @param {string} url - URL to cache
   * @param {Element} fragment - Fragment to cache
   * @private
   */
  #cacheFragment(url, fragment) {
    // Remove oldest entry if cache is full
    if (this.#cacheSize >= this.#maxCacheSize) {
      const firstKey = this.#fragmentCache.keys().next().value;
      this.#fragmentCache.delete(firstKey);
      this.#cacheSize--;
    }
    
    this.#fragmentCache.set(url, fragment.cloneNode(true));
    this.#cacheSize++;
    
    // Auto-cleanup after 5 minutes
    setTimeout(() => {
      if (this.#fragmentCache.has(url)) {
        this.#fragmentCache.delete(url);
        this.#cacheSize--;
      }
    }, 300000);
  }

  /**
   * Prefetch content without replacing current content
   * @param {string} url - URL to prefetch
   * @private
   */
  async #prefetchContent(url) {
    try {
      // Check if already cached
      if (this.#getCachedFragment(url)) {
        return;
      }

      // Fetch and cache the content
      const response = await this.#fetchWithRetry(url);
      const html = await response.text();

      // Validate the content can be parsed
      const parsed = this.#parseHTML(html);
      if (parsed) {
        this.#cacheFragment(url, parsed);
        
        // Dispatch prefetch success event
        this.#dispatchEvent('electric-section:prefetch-success', { 
          url,
          cached: true 
        });
      } else {
        throw new Error('Failed to parse prefetched content');
      }
    } catch (error) {
      console.error('[ElectricSection] Prefetch error:', error);
      this.#dispatchEvent('electric-section:prefetch-error', { 
        url, 
        error: error.message 
      });
    }
  }

  /**
   * Fetch with retry logic and exponential backoff
   * @param {string} url - URL to fetch
   * @param {number} retries - Number of retry attempts
   * @returns {Promise<Response>} Fetch response
   * @private
   */
  async #fetchWithRetry(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          headers: {
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return response;
      } catch (error) {
        if (i === retries - 1) throw error;
        
        const delay = 1000 * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Parse HTML and extract section content with optimized selector
   * @param {string} html - HTML string to parse
   * @returns {Element|null} Parsed section element or null
   * @private
   */
  #parseHTML(html) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      
      // Check for parsing errors
      const parseError = doc.querySelector('parsererror');
      if (parseError) {
        throw new Error('HTML parsing failed');
      }
      
      const sectionId = this.#getSectionId();
      if (!sectionId) {
        console.warn('[ElectricSection] No section ID found for parsing');
        return null;
      }
      
      // Use optimized selector
      const selector = this.#getOptimizedSelector(sectionId);
      const element = doc.querySelector(selector);
      
      return element || null;
    } catch (error) {
      console.error('[ElectricSection] HTML parsing error:', error);
      return null;
    }
  }

  /**
   * Animate content transition using CSS transitions
   * @param {Element} newContent - New content to animate in
   * @private
   */
  async #animateTransition(newContent) {
    try {
      // Add transition class
      this.classList.add('electric-section-transitioning');
      
      // Fade out current content
      this.style.opacity = '0';
      this.style.transition = 'opacity 150ms ease-out';
      
      // Wait for fade out
      await new Promise(resolve => setTimeout(resolve, 150));
      
      this.#replaceContent(newContent);
      
      // Fade in new content
      this.style.transition = 'opacity 150ms ease-in';
      this.style.opacity = '1';
      
      // Clean up after animation
      setTimeout(() => {
        this.classList.remove('electric-section-transitioning');
        this.style.transition = '';
        this.style.opacity = '';
      }, 150);
      
    } catch (error) {
      console.error('[ElectricSection] Animation error:', error);
      // Fallback to immediate replacement
      this.#replaceContent(newContent);
    }
  }

  /**
   * Replace current content with new content using DocumentFragment
   * @param {Element} newContent - New content element
   * @private
   */
  #replaceContent(newContent) {
    // Preserve any temporary data
    const tempData = this.#temporaryData.get(this);
    
    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();
    while (newContent.firstChild) {
      fragment.appendChild(newContent.firstChild);
    }
    
    // Clear and replace content
    this.innerHTML = '';
    this.appendChild(fragment);
    
    // Restore temporary data to new element
    if (tempData) {
      this.#temporaryData.set(this, tempData);
    }
  }

  /**
   * Fire custom event after content update
   * @param {Element} newContent - New content element
   * @private
   */
  #fireCustomEvent(newContent) {
    if (this.dataset.fireEvent) {
      const event = new CustomEvent(this.dataset.fireEvent, {
        bubbles: true,
        detail: {
          source: this.#getSectionId(),
          found: newContent !== null,
          url: this.dataset.url
        }
      });
      this.dispatchEvent(event);
    }
  }

  /**
   * Dispatch internal event
   * @param {string} eventName - Event name
   * @param {object} detail - Event detail
   * @private
   */
  #dispatchEvent(eventName, detail = {}) {
    const event = new CustomEvent(eventName, {
      bubbles: true,
      detail: {
        sectionId: this.#getSectionId(),
        ...detail
      }
    });
    this.dispatchEvent(event);
  }

  /**
   * Setup performance monitoring
   * @private
   */
  #setupPerformanceMonitoring() {
    if ('PerformanceObserver' in window) {
      try {
        this.#performanceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'measure' && entry.name.includes('electric-section')) {
              if (entry.duration > 100) {
                console.warn(`[ElectricSection] Slow operation detected: ${entry.name} took ${entry.duration.toFixed(2)}ms`);
              }
            }
          }
        });
        
        this.#performanceObserver.observe({ entryTypes: ['measure'] });
      } catch (error) {
        console.warn('[ElectricSection] Performance monitoring not available:', error);
      }
    }
  }

  /**
   * Remove performance observer
   * @private
   */
  #removePerformanceObserver() {
    if (this.#performanceObserver) {
      this.#performanceObserver.disconnect();
      this.#performanceObserver = null;
    }
  }

  /**
   * Debounce function to limit execution frequency
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @returns {Function} Debounced function
   * @private
   */
  #debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Static utility methods for external use

  /**
   * Find all electric-section elements in the document
   * @param {string} sectionId - Optional section ID to filter by
   * @returns {ElectricSection[]} Array of electric-section elements
   * @static
   */
  static findAll(sectionId = null) {
    const selector = sectionId 
      ? `electric-section[data-section-id="${sectionId}"]`
      : 'electric-section';
    return Array.from(document.querySelectorAll(selector));
  }

  /**
   * Find electric-section element by section ID
   * @param {string} sectionId - Section ID to find
   * @returns {ElectricSection|null} Electric section element or null
   * @static
   */
  static findBySectionId(sectionId) {
    return document.querySelector(`electric-section[data-section-id="${sectionId}"]`);
  }

  /**
   * Trigger content update for all electric-section elements
   * @param {string} sectionId - Optional section ID to filter by
   * @static
   */
  static async updateAll(sectionId = null) {
    const elements = this.findAll(sectionId);
    await Promise.all(elements.map(el => el.#checkAndFetch(false, true)));
  }

  /**
   * Clear all cached content
   * @static
   */
  static clearCache() {
    // This would need to be implemented if we want to expose cache clearing
    console.warn('[ElectricSection] Cache clearing not implemented in this version');
  }

  /**
   * Prefetch content for a specific section
   * @param {string} sectionId - Section ID to prefetch for
   * @param {string} url - URL to prefetch
   * @static
   */
  static prefetch(sectionId, url) {
    const section = this.findBySectionId(sectionId);
    if (section) {
      section.dispatchEvent(new CustomEvent('electric-section:prefetch', {
        detail: { url },
        bubbles: false
      }));
    }
  }

  /**
   * Fetch and replace content for a specific section
   * @param {string} sectionId - Section ID to fetch for
   * @param {string} url - URL to fetch
   * @static
   */
  static fetch(sectionId, url) {
    const section = this.findBySectionId(sectionId);
    if (section) {
      section.dispatchEvent(new CustomEvent('electric-section:fetch', {
        detail: { url },
        bubbles: false
      }));
    }
  }

  /**
   * Prefetch content for all sections
   * @param {string} url - URL to prefetch
   * @static
   */
  static prefetchAll(url) {
    const sections = this.findAll();
    sections.forEach(section => {
      section.dispatchEvent(new CustomEvent('electric-section:prefetch', {
        detail: { url },
        bubbles: false
      }));
    });
  }
}

// Register the custom element with safety check
if (!customElements.get('electric-section')) {
  customElements.define('electric-section', ElectricSection);
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ElectricSection;
}
})();
(function () {
/**
 * Electric Property Updater Web Component
 * 
 * Transfers data-* attributes from clicked buttons to a target element.
 * 
 * Usage:
 * <electric-property-updater data-target-selector="#target-element">
 *   <button data-url="/some-url" data-custom="value">Click me</button>
 * </electric-property-updater>
 */
class ElectricPropertyUpdater extends HTMLElement {
  constructor() {
    super();
    this.targetSelector = this.getAttribute('data-target-selector');
    this.targetElement = null;
    this.activeButton = null;
  }

  connectedCallback() {
    this.initialize();
  }

  disconnectedCallback() {
    this.removeEventListeners();
  }

  initialize() {
    // Find the target element
    this.targetElement = document.querySelector(this.targetSelector);
    
    if (!this.targetElement) {
      console.warn(`ElectricPropertyUpdater: Target element not found for selector "${this.targetSelector}"`);
      return;
    }

    // Find all buttons within this component
    const buttons = this.querySelectorAll('button');
    
    if (buttons.length === 0) {
      console.warn('ElectricPropertyUpdater: No buttons found within the component');
      return;
    }

    // Set the first button as active by default
    this.activeButton = buttons[0];
    this.updateTargetProperties(this.activeButton);
    this.updateButtonStates();

    // Add click listeners to all buttons
    buttons.forEach(button => {
      button.addEventListener('click', this.handleButtonClick.bind(this));
    });
  }

  handleButtonClick(event) {
    const button = event.currentTarget;
    
    // Update active button
    this.activeButton = button;
    
    // Update target element properties
    this.updateTargetProperties(button);
    
    // Update button visual states
    this.updateButtonStates();
  }

  updateTargetProperties(button) {
    if (!this.targetElement) return;

    // Get all data-* attributes from the button
    const dataAttributes = Array.from(button.attributes)
      .filter(attr => attr.name.startsWith('data-'))
      .filter(attr => attr.name !== 'data-target-selector'); // Exclude our own attribute

    // Apply each data attribute to the target element
    dataAttributes.forEach(attr => {
      this.targetElement.setAttribute(attr.name, attr.value);
    });

    // Dispatch a custom event to notify other components
    this.targetElement.dispatchEvent(new CustomEvent('electric-property-updated', {
      detail: {
        sourceButton: button,
        attributes: Object.fromEntries(
          dataAttributes.map(attr => [attr.name, attr.value])
        )
      },
      bubbles: true
    }));
  }

  updateButtonStates() {
    const buttons = this.querySelectorAll('button');
    
    buttons.forEach(button => {
      // Remove active state classes
      button.classList.remove('underline', 'active', 'text-primary');
      
      // Add active state to current button
      if (button === this.activeButton) {
        button.classList.add('underline');
      }
    });
  }

  removeEventListeners() {
    const buttons = this.querySelectorAll('button');
    buttons.forEach(button => {
      button.removeEventListener('click', this.handleButtonClick.bind(this));
    });
  }
}

// Register the web component
customElements.define('electric-property-updater', ElectricPropertyUpdater);
})();
(function () {
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
})();
(function () {
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
})();
(function () {
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
})();
(function () {
// Core functionality interfaces
class SearchFeature {
  constructor(host) {
    this.host = host;
  }

  init() {} // Optional initialization
  destroy() {} // Cleanup if needed
}
class ProductTypeFilter extends SearchFeature {
  constructor(host) {
    super(host);
    this.productTypeSelector = host.querySelector('.js-product-type');
    this.input = host.querySelector('input[type="search"]');
    this.boundFilterChange = this.handleFilterChange.bind(this);
  }

  init() {
    if (this.productTypeSelector) {
      this.productTypeSelector.addEventListener('change', this.boundFilterChange);
    }
  }

  destroy() {
    if (this.productTypeSelector) {
      this.productTypeSelector.removeEventListener('change', this.boundFilterChange);
    }
  }

  handleFilterChange() {
    this.applyFilter();
    // Trigger search with new filter if there's an active search
    if (this.input.value.trim()) {
      // If predictive search is enabled, trigger it
      if (!this.host.dataset?.disabled) {
        this.host.features.search.onChange();
      }
    }
  }

  getFilter() {
    return this.productTypeSelector?.value.replace(' ', '+') || '';
  }

  applyFilter() {
    const cloneNode = this.input.cloneNode(true);
    cloneNode.setAttribute("type", "hidden");
    cloneNode.value = '';

    const productTypeFilter = this.getFilter();

    if (productTypeFilter !== '') {
      cloneNode.value += "product_type:" + productTypeFilter;
      if (this.input.value !== '') {
        cloneNode.value += " AND ";
      }
    }
    cloneNode.value += this.input.value;

    this.input.removeAttribute("name");
    this.input.insertAdjacentElement("afterend", cloneNode);
  }
}

class KeyboardManager extends SearchFeature {
  constructor(host) {
    super(host);
    this.input = host.querySelector('input[type="search"]');
    this.boundShortcutHandler = this.handleShortcut.bind(this);
  }

  init() {
    document.addEventListener("keydown", this.boundShortcutHandler);
  }

  destroy() {
    document.removeEventListener("keydown", this.boundShortcutHandler);
  }

  handleShortcut(event) {
    // Ignore if another handler already handled it
    if (event.defaultPrevented) return;

    // Normalize key
    const key = (event.key || '').toLowerCase();

    // Do not trigger on plain '/' while typing in editable fields
    const activeElement = document.activeElement;
    const isEditable =
      activeElement && (
        activeElement.isContentEditable ||
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute?.('role') === 'textbox'
      );

    // Slash to focus only when not inside an editable target
    const isSlashFocus = key === '/' && !isEditable;

    // Cmd/Ctrl+K anywhere (avoid with extra modifiers)
    const isShortcutFocus =
      key === 'k' && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey;

    if (isSlashFocus || isShortcutFocus) {
      event.preventDefault();
      
      // Find and click the search drawer trigger
      const searchTrigger = document.querySelector('drawer-trigger[data-target="search-drawer"]');
      if (searchTrigger) {
        searchTrigger.click();
      }
    }
  }
}

class PredictiveSearchCore extends SearchFeature {
  constructor(host) {
    super(host);
    this.cachedResults = {};
    this.input = host.querySelector('input[type="search"]');
    this.outputWrapper = host.querySelector(".js-search-output-wrapper");
    this.resultsList = host.querySelector("#predictive-search-results-list");
    this.statusElement = host.querySelector(".predictive-search-status");
    this.displayElement = host.querySelector(".search-input-display");
    this.isOpen = false;
    this.noResults = false;
    this.show_collections = host.dataset.collections === 'true';
    this.isOpenedByClick = false; // Track if search was opened by click vs focus
    this.isSubmitting = false; // Track if form is being submitted
    this.isShowingSuggestions = false; // Track if suggestions are currently being shown to prevent duplicate calls

    this.boundHandlers = {
      onChange: debounce(this.onChange.bind(this), 300),
      onInput: this.onInput.bind(this),
      onFocus: this.onFocus.bind(this),
      onKeyup: this.onKeyup.bind(this),
      onKeydown: this.onKeydown.bind(this),
      onRecentSearchClick: this.onRecentSearchClick.bind(this)
    };
  }

  init() {
    console.log('🔍 [Electric Search] Initializing search component...');
    
    if (this.host.dataset?.disabled) {
      console.log('🔍 [Electric Search] Search component is disabled, skipping initialization');
      return;
    }

    this.setupEventListeners();
    this.saveSuggestions();
    this.setupDrawerListeners();

    // Check if input already has a value (e.g., on search page)
    const currentQuery = this.getQuery();
    if (currentQuery.length > 0) {
      // If we have search terms, mark that we have results
      this.host.setAttribute("results", true);
      // Update search form visibility
      this.updateSearchForm();
    }

    // Inject recent searches into saved suggestions
    const tempWrapper = document.createElement('div');
    tempWrapper.innerHTML = this.suggestions;
    const popularSearchesList = tempWrapper.querySelector('ul.space-y-3.font-medium.mb-6');
    if (popularSearchesList) {
      const recentSearchesHtml = this.generateRecentSearchesHtml();
      if (recentSearchesHtml) {
        // Create wrapper for recent searches
        const recentWrapper = document.createElement('div');
        recentWrapper.setAttribute('data-recent-searches', 'true');
        recentWrapper.className = 'mb-6 px-b-lg';
        recentWrapper.innerHTML = recentSearchesHtml;

        // Insert before popular searches
        popularSearchesList.parentNode.insertBefore(recentWrapper, popularSearchesList);
        this.suggestions = tempWrapper.innerHTML;
      }
    }
  }

  destroy() {
    this.removeEventListeners();
    this.removeDrawerListeners();
  }

  /**
   * Setup drawer event listeners
   * @private
   */
  setupDrawerListeners() {
    this.boundDrawerOpenHandler = this.handleDrawerOpen.bind(this);
    this.boundDrawerCloseHandler = this.handleDrawerClose.bind(this);
    
    // Find the search drawer element
    this.searchDrawer = document.getElementById('search-drawer');
    if (this.searchDrawer) {
      this.searchDrawer.addEventListener('drawer:opened', this.boundDrawerOpenHandler);
      this.searchDrawer.addEventListener('drawer:closed', this.boundDrawerCloseHandler);
    }
  }

  /**
   * Remove drawer event listeners
   * @private
   */
  removeDrawerListeners() {
    if (this.searchDrawer) {
      this.searchDrawer.removeEventListener('drawer:opened', this.boundDrawerOpenHandler);
      this.searchDrawer.removeEventListener('drawer:closed', this.boundDrawerCloseHandler);
    }
  }

  /**
   * Handle drawer open event
   * @private
   */
  handleDrawerOpen() {
    this.isOpen = true;
    
    // Focus the input when drawer opens
    setTimeout(() => {
      this.input?.focus({ preventScroll: true });
      this.positionCursorAtEnd();
    }, 100);

    const searchTerm = this.getQuery();
    if (!searchTerm.length) {
      this.showSuggestions();
    } else if (this.host.getAttribute("results") === "true") {
      // Results already loaded
    } else {
      this.getSearchResults(searchTerm);
    }
  }

  /**
   * Handle drawer close event
   * @private
   */
  handleDrawerClose() {
    this.isOpen = false;
    
    const selected = this.host.querySelector('[aria-selected="true"]');
    if (selected) selected.setAttribute("aria-selected", false);
    
    this.input.setAttribute("aria-activedescendant", "");
  }

  setupEventListeners() {
    this.input.addEventListener("input", this.boundHandlers.onChange);
    this.input.addEventListener("input", this.boundHandlers.onInput);
    this.input.addEventListener("focus", this.boundHandlers.onFocus);
    this.host.addEventListener("keyup", this.boundHandlers.onKeyup);
    this.host.addEventListener("keydown", this.boundHandlers.onKeydown);
    if (this.outputWrapper) {
      this.outputWrapper.addEventListener("click", this.boundHandlers.onRecentSearchClick);
    }
  }

  removeEventListeners() {
    this.input.removeEventListener("input", this.boundHandlers.onChange);
    this.input.removeEventListener("input", this.boundHandlers.onInput);
    this.input.removeEventListener("focus", this.boundHandlers.onFocus);
    this.host.removeEventListener("keyup", this.boundHandlers.onKeyup);
    this.host.removeEventListener("keydown", this.boundHandlers.onKeydown);
    if (this.outputWrapper) {
      this.outputWrapper.removeEventListener("click", this.boundHandlers.onRecentSearchClick);
    }
  }

  saveSuggestions() {
    this.suggestions = this.outputWrapper.innerHTML;
  }

  /**
   * Generate recent searches HTML
   * @private
   * @returns {string} HTML string for recent searches section
   */
  generateRecentSearchesHtml() {
    let recentSearches = [];
    try {
      recentSearches = JSON.parse(localStorage.getItem('recent_searches') || '[]');
    } catch (e) {
      // Clear corrupted data
      localStorage.removeItem('recent_searches');
      return '';
    }

    if (!Array.isArray(recentSearches) || recentSearches.length === 0) return '';

    // Ensure all searches are strings and clean up localStorage if needed
    const validSearches = recentSearches.filter(q => typeof q === 'string' && q.trim());

    // If we filtered out invalid entries, update localStorage
    if (validSearches.length !== recentSearches.length) {
      localStorage.setItem('recent_searches', JSON.stringify(validSearches));
    }

    if (validSearches.length === 0) return '';

    return `
      <ul class="space-y-b-sm mb-6">
        ${validSearches.map((query, index) => `
          <li class="slide-right-sm" style="--nth-child:${index + 1}" data-recent-search-item="true" data-query="${this.escapeHtml(query)}">
            <div class="flex justify-between items-center gap-x-3">
              <a
                href="${routes.search_url}?q=${encodeURIComponent(query)}"
                class="hover:underline w-full block"
                data-recent-search-link="true"
              >
                ${this.escapeHtml(query)}
              </a>
              <button
                type="button"
                class="shrink-0 cursor-pointer hover:opacity-70"
                data-recent-search-delete="true"
                aria-label="Remove ${this.escapeHtml(query)} from recent searches"
              >
                ${window.icons.trash}
              </button>
            </div>
          </li>
        `).join('')}
      </ul>
    `;
  }

  /**
   * Handle click events for recent search actions (e.g., delete)
   * Uses event delegation to avoid per-item listeners.
   * @param {MouseEvent} event
   * @private
   */
  onRecentSearchClick(event) {
    const deleteButton = event.target.closest('[data-recent-search-delete="true"]');
    if (!deleteButton) return;

    // Prevent navigation when trash icon is clicked
    event.preventDefault();
    event.stopPropagation();

    const item = deleteButton.closest('[data-recent-search-item="true"]');
    if (!item) return;

    const query = item.getAttribute('data-query') || '';
    if (!query) return;

    // Update localStorage
    try {
      const stored = JSON.parse(localStorage.getItem('recent_searches') || '[]');
      if (Array.isArray(stored)) {
        const updated = stored.filter(search => search !== query);
        localStorage.setItem('recent_searches', JSON.stringify(updated));
      }
    } catch (error) {
      console.warn('Failed to remove recent search:', error);
    }

    // Remove item from DOM
    const list = item.parentElement;
    item.remove();

    // If list is empty, remove the wrapper container
    if (list && list.children.length === 0) {
      const wrapper = list.closest('[data-recent-searches="true"]');
      if (wrapper) {
        wrapper.remove();
      }
    }
  }

  /**
   * Escape HTML to prevent XSS
   * @private
   * @param {string} text
   * @returns {string}
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Inject recent searches above popular searches
   * @private
   */
  injectRecentSearches() {
    // Check if recent searches already injected
    if (this.outputWrapper.querySelector('[data-recent-searches]')) return;

    const popularSearchesList = this.outputWrapper.querySelector('.trending-searches-title');
    if (!popularSearchesList) return;

    const recentSearchesHtml = this.generateRecentSearchesHtml();
    if (recentSearchesHtml) {
      // Create a wrapper div with the recent searches
      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-recent-searches', 'true');
      wrapper.className = 'mb-6 px-b-lg';
      wrapper.innerHTML = recentSearchesHtml;

      // Insert before popular searches
      popularSearchesList.parentNode.insertBefore(wrapper, popularSearchesList);
    }
  }

  getQuery() {
    return this.input.value.trim();
  }


  /**
   * Update search form visibility and content based on input length
   * @private
   */
  updateSearchForm() {
    const searchFormContainer = this.host.querySelector('#search-form-container');
    const searchFormInput = this.host.querySelector('#search-form-input');
    const searchFormLabel = this.host.querySelector('#search-form-label');
    
    if (!searchFormContainer || !searchFormInput || !searchFormLabel) return;

    const value = this.input.value.trim();
    
    // Show form if input has 3+ characters, hide otherwise
    if (value.length >= 3) {
      searchFormContainer.classList.remove('hidden');
      
      // Update the hidden input value
      searchFormInput.value = value;
      
      // Update the button label with the search term
      const searchForText = window.theme?.strings?.templates?.search?.search_for || 'View all products for {{ terms }}';
      searchFormLabel.textContent = searchForText.replace('{{ terms }}', `"${value}"`);
    } else {
      searchFormContainer.classList.add('hidden');
    }
  }

  /**
   * Position cursor at the end of the input text
   * @private
   */
  positionCursorAtEnd() {
    if (!this.input) return;
    
    const value = this.input.value;
    if (value.length > 0) {
      // Use setTimeout to ensure the focus has been applied before setting cursor position
      setTimeout(() => {
        this.input.setSelectionRange(value.length, value.length);
      }, 0);
    }
  }

  /**
   * Handle input events for real-time form sync
   * @private
   */
  onInput() {
    this.updateSearchForm();
  }

  /**
   * Check if current device is mobile based on breakpoint
   * @returns {boolean} True if mobile device
   * @private
   */
  isMobile() {
    const mobileBreakpoints = ["xs", "sm", "md"];
    const currentBreakpoint = getCurrentBreakpoint();
    return mobileBreakpoints.includes(currentBreakpoint);
  }


  onChange() {
    // Don't handle change events during form submission
    if (this.isSubmitting) return;

    const searchTerm = this.getQuery();
    console.log('🔍 [Electric Search] onChange called with searchTerm:', searchTerm);
    this.host.querySelector(".js-error-message").style.display = "";

    if (!searchTerm.length) {
      console.log('🔍 [Electric Search] No search term, showing suggestions');
      this.showSuggestions();
      return;
    }

    console.log('🔍 [Electric Search] Getting search results for:', searchTerm);
    this.getSearchResults(searchTerm);
  }

  onFocus() {
    // Don't handle focus events during form submission
    if (this.isSubmitting) return;

    // Position cursor at end of text when focusing
    this.positionCursorAtEnd();

    const searchTerm = this.getQuery();

    if (!searchTerm.length) {
      this.showSuggestions();
      return;
    }

    if (this.host.getAttribute("results") === "true") {
      // Results already loaded, just make sure they're visible
    } else {
      this.getSearchResults(searchTerm);
    }
  }


  onKeyup(event) {
    // Don't handle keyboard events during form submission
    if (this.isSubmitting) return;

    switch (event.code) {
      case "Escape": {
        event.preventDefault();
        // Close the drawer by clicking the drawer trigger
        if (this.searchDrawer) {
          const drawerTrigger = this.searchDrawer.querySelector('drawer-trigger[data-target="search-drawer"]');
          if (drawerTrigger) drawerTrigger.click();
        }
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        this.switchOption("up");
        break;
      }
      case "ArrowDown": {
        event.preventDefault();
        this.switchOption("down");
        break;
      }
      case "Enter": {
        // Only prevent default when we actively trigger a selection click.
        // Otherwise allow native form submit via Enter.
        const selectedOption = this.host.querySelector('[aria-selected="true"] a, [aria-selected="true"] button');
        if (selectedOption) {
          event.preventDefault();
          selectedOption.click();
        }
        break;
      }
    }
  }

  onKeydown(event) {
    // Don't handle keyboard events during form submission
    if (this.isSubmitting) return;

    if (event.code === "ArrowUp" || event.code === "ArrowDown") {
      event.preventDefault();
    }
  }

  showSuggestions() {
    if (this.host.dataset?.disabled) return;
    // Don't show suggestions during form submission
    if (this.isSubmitting) return;
    // Prevent duplicate calls in quick succession
    if (this.isShowingSuggestions) {
      return;
    }

    this.isShowingSuggestions = true;

    // Clear results attribute since we're showing suggestions now
    this.host.removeAttribute("results");

    // Check for actual elements that exist in the template: .trending-searches-title and #promoted-list
    const hasPopularCars = this.outputWrapper.querySelector('.trending-searches-title');
    const hasPromotedList = this.outputWrapper.querySelector('#promoted-list');
    const hasRecentSearches = this.outputWrapper.querySelector('[data-recent-searches]');
    
    // Only reset if we don't have the core suggestion elements
    if (!hasPopularCars || !hasPromotedList) {
      this.outputWrapper.innerHTML = this.suggestions;
    }

    // Inject recent searches
    this.injectRecentSearches();

    this.input.setAttribute("aria-expanded", true);
    if (this.resultsList) this.resultsList.classList.remove('[&_>_*]:opacity-50');
    
    // Reset flag after a short delay to allow for async operations
    setTimeout(() => {
      this.isShowingSuggestions = false;
    }, 200);
  }

  switchOption(direction) {
    if (!this.isOpen) return;

    const moveUp = direction === "up";
    const selectedElement = this.host.querySelector('[aria-selected="true"]');
    const allVisibleElements = Array.from(
      this.host.querySelectorAll("li, button.predictive-search__item")
    ).filter((element) => element.offsetParent !== null);

    let activeElementIndex = 0;
    if (moveUp && !selectedElement) return;

    let selectedElementIndex = allVisibleElements.findIndex(
      element => element === selectedElement
    );

    if (this.statusElement) this.statusElement.textContent = "";

    if (!moveUp && selectedElement) {
      activeElementIndex =
        selectedElementIndex === allVisibleElements.length - 1
          ? 0
          : selectedElementIndex + 1;
    } else if (moveUp) {
      activeElementIndex =
        selectedElementIndex === 0
          ? allVisibleElements.length - 1
          : selectedElementIndex - 1;
    }

    if (activeElementIndex === selectedElementIndex) return;

    const activeElement = allVisibleElements[activeElementIndex];
    activeElement.setAttribute("aria-selected", true);
    if (selectedElement) selectedElement.setAttribute("aria-selected", false);

    this.input.setAttribute("aria-activedescendant", activeElement.id);
  }


  async getSearchResults(searchTerm) {
    // Don't fetch search results during form submission
    if (this.isSubmitting) return;

    let queryKey = searchTerm.replace(" ", "+").toLowerCase();
    const productTypeFilter = this.host.features.productTypeFilter?.getFilter() || '';

    if (productTypeFilter !== '') {
      queryKey = `product_type:${productTypeFilter} AND ${queryKey}`;
    }

    this.setLiveRegionLoadingState();

    if (this.cachedResults[queryKey]) {
      this.noResults = false;
      this.renderSearchResults(this.cachedResults[queryKey]);
      return;
    }

    try {
      const response = await fetch(
        `${routes.predictive_search_url}?q=${encodeURIComponent(
          queryKey
        )}&${encodeURIComponent(
          "resources[type]"
        )}=product${this.show_collections ? ',collection' : ''}&section_id=api--search--predictive`
      );

      if (!response.ok) {
        throw new Error(response.status);
      }

      const text = await response.text();
      const resultsMarkup = new DOMParser()
        .parseFromString(text, "text/html")
        .querySelector("#shopify-section-api--search--predictive");

      const noResultsItem = resultsMarkup.querySelector("#no-results");
      const noResultsText = this.host.querySelector(".js-error-message");

      this.noResults = false;
      if (noResultsItem) {
        this.noResults = true;
        noResultsText.innerHTML = noResultsItem.innerHTML;
      } else {
        this.cachedResults[queryKey] = resultsMarkup.innerHTML;
        noResultsText.innerHTML = "";
      }

      this.renderSearchResults(resultsMarkup.innerHTML);
    } catch (error) {
      this.close();
      throw error;
    }
  }

  setLiveRegionLoadingState() {
    // Don't set loading state during form submission
    if (this.isSubmitting) return;

    this.statusElement = this.statusElement || this.host.querySelector(".predictive-search-status");
    this.loadingText = this.loadingText || this.host.getAttribute("data-loading-text");

    this.setLiveRegionText(this.loadingText);
    this.host.setAttribute("loading", true);
    if (this.resultsList) this.resultsList.classList.add('[&_>_*]:opacity-50');
  }

  setLiveRegionText(statusText) {
    this.statusElement.setAttribute("aria-hidden", "false");
    this.statusElement.textContent = statusText;

    setTimeout(() => {
      this.statusElement.setAttribute("aria-hidden", "true");
    }, 1000);
  }

  renderSearchResults(resultsMarkup) {
    // Don't render search results during form submission
    if (this.isSubmitting) return;
    
    // Reset the showing suggestions flag since we're showing results now
    this.isShowingSuggestions = false;

    console.log('🔍 [Electric Search] Rendering search results...', {
      noResults: this.noResults,
      hasResultsMarkup: !!resultsMarkup,
      resultsLength: resultsMarkup?.length
    });

    if (this.noResults) {
      this.host.querySelector(".js-error-message").style.display = "block";
      // Only clear if we have content to clear
      if (this.outputWrapper.children.length > 0) {
        this.outputWrapper.innerHTML = "";
      }
    } else {
      this.host.querySelector(".js-error-message").style.display = "";
      // Only update if content is different
      if (this.outputWrapper.innerHTML !== resultsMarkup) {
        console.log('🔍 [Electric Search] Updating outputWrapper with search results');
        this.outputWrapper.innerHTML = resultsMarkup;
      } else {
        console.log('🔍 [Electric Search] Results already match, skipping update');
      }
      this.host.setAttribute("results", true);
      this.setLiveRegionResults();
      console.log('🔍 [Electric Search] Results rendered successfully');
    }
  }

  setLiveRegionResults() {
    this.host.removeAttribute("loading");
    this.setLiveRegionText(
      this.host.querySelector("[data-predictive-search-live-region-count-value]")
        .textContent
    );
    if (this.resultsList) this.resultsList.classList.remove('[&_>_*]:opacity-50');
  }

}

class PredictiveSearch extends HTMLElement {
  constructor() {
    super();

    // Initialize features
    this.features = {
      productTypeFilter: new ProductTypeFilter(this),
      keyboard: new KeyboardManager(this),
      search: new PredictiveSearchCore(this)
    };
  }

connectedCallback() {
    // Initialize all features that should work regardless of disabled state
    this.features.keyboard.init();
    this.features.productTypeFilter.init(); // Initialize product type filter

    // Initialize predictive search only if not disabled
    if (!this.dataset?.disabled) {
      this.features.search.init();
    }

    // Set up form submission handling
    const form = this.querySelector('form[role="search"]');
    form.addEventListener("submit", this.handleFormSubmit.bind(this));
  }

  disconnectedCallback() {
    // Cleanup all features
    Object.values(this.features).forEach(feature => feature.destroy?.());
  }

  handleFormSubmit(event) {
    // Some search apps (e.g. snize/Searchanise) may rewrite form actions to custom pages.
    // Ensure drawer search submits to Shopify's native search endpoint.
    try {
      const form = event?.currentTarget;
      if (form?.dataset?.forceNativeSearch === 'true') {
        const nativeSearchUrl = window?.routes?.search_url || '/search';
        form.setAttribute('action', nativeSearchUrl);
      }
    } catch (error) {
      // Non-blocking: if something goes wrong, allow normal submit flow.
      console.warn('[Electric Search] Failed to enforce native search action', error);
    }

    if (this.dataset?.disabled) {
      event.preventDefault();
      this.removeAttribute("data-disabled");
      setTimeout(() => {
        this.closest('form').submit();
      }, 1000);
      return;
    }

    // If there's a selected option, let it handle the click instead
    const selectedOption = this.querySelector('[aria-selected="true"] a');
    if (selectedOption) {
      event.preventDefault();
      selectedOption.click();
      return;
    }

    // If there's no search query, prevent submission
    if (!this.features.search.getQuery().length) {
      event.preventDefault();
      return;
    }

    // For Enter key navigation to search page, save the search term and navigate smoothly
    const searchQuery = this.features.search.getQuery();
    if (searchQuery.length) {
      // Set submitting flag to prevent focus events from firing
      this.features.search.isSubmitting = true;

      // Apply filter after setting the flag to prevent focus issues
      this.features.productTypeFilter.applyFilter();

      // Save to recent searches before navigating
      this.#saveRecentSearch(searchQuery);
      // Allow form to submit naturally - don't close search UI
      // The navigation will happen and the search UI will remain open until page unloads
    }
  }

  /**
   * Save search query to recent searches
   * @param {string} query - Search query to save
   * @private
   */
  #saveRecentSearch(query) {
    if (!query || typeof query !== 'string') return;
    
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    try {
      let recentSearches = JSON.parse(localStorage.getItem('recent_searches') || '[]');
      
      // Remove if already exists to avoid duplicates
      recentSearches = recentSearches.filter(search => search !== cleanQuery);
      
      // Add to beginning
      recentSearches.unshift(cleanQuery);
      
      // Keep only last 5 searches
      recentSearches = recentSearches.slice(0, 5);
      
      localStorage.setItem('recent_searches', JSON.stringify(recentSearches));
    } catch (error) {
      console.warn('Failed to save recent search:', error);
    }
  }
}

customElements.define("electric-search", PredictiveSearch);

// Global native search enforcement (covers search forms outside <electric-search>)
// Some third-party search apps may replace the search form node entirely and/or rewrite form actions.
// We enforce Shopify's native search endpoint at submit time for any form explicitly marked with
// `data-force-native-search="true"`.
(() => {
  try {
    // Theme setting: allow merchants to fall back to a search app redirect page.
    // When disabled, we must not force `/search`.
    if (window?.theme_settings?.force_native_search === false) return;

    if (window.__electricForceNativeSearchInstalled) return;
    window.__electricForceNativeSearchInstalled = true;

    const nativeSearchUrl = window?.routes?.search_url || '/search';
    const nativeSearchAbsUrl = (() => {
      try {
        return new URL(nativeSearchUrl, window.location.origin).toString();
      } catch (e) {
        return (window.location.origin || '') + '/search';
      }
    })();

    document.addEventListener('submit', (event) => {
      try {
        const form = event?.target;
        if (!(form instanceof HTMLFormElement)) return;
        if (form?.dataset?.forceNativeSearch !== 'true') return;

        // Always enforce action to native search.
        form.setAttribute('action', nativeSearchAbsUrl);

        // Hard-guard: if something intercepts submit and navigates elsewhere, force navigation ourselves.
        const currentAction = String(form.getAttribute('action') || form.action || '');
        if (currentAction && !currentAction.startsWith(nativeSearchAbsUrl)) {
          event.preventDefault();
          event.stopImmediatePropagation?.();

          const params = new URLSearchParams();
          const data = new FormData(form);
          for (const [key, value] of data.entries()) {
            if (typeof value === 'string') params.append(key, value);
          }
          window.location.assign(`${nativeSearchAbsUrl}?${params.toString()}`);
        }
      } catch (e) {
        // ignore
      }
    }, true);

    // Some apps redirect on Enter keydown without submitting the form.
    // Capture Enter and route to native /search when the form is explicitly marked.
    document.addEventListener('keydown', (event) => {
      try {
        if (!event || event.defaultPrevented) return;
        if (event.key !== 'Enter') return;

        const target = event.target;
        if (!target || !target.closest) return;

        const form = target.form || target.closest('form');
        if (!(form instanceof HTMLFormElement)) return;
        if (form?.dataset?.forceNativeSearch !== 'true') return;

        // If inside predictive <electric-search> and a suggestion is selected, let it handle Enter.
        const electricHost = target.closest('electric-search');
        if (electricHost) {
          const selected = electricHost.querySelector('[aria-selected="true"] a, [aria-selected="true"] button');
          if (selected) return;
        }

        event.preventDefault();
        event.stopImmediatePropagation?.();

        form.setAttribute('action', nativeSearchAbsUrl);

        const params = new URLSearchParams();
        const data = new FormData(form);
        for (const [key, value] of data.entries()) {
          if (typeof value === 'string') params.append(key, value);
        }
        window.location.assign(`${nativeSearchAbsUrl}?${params.toString()}`);
      } catch (e) {
        // ignore
      }
    }, true);
  } catch (e) {
    // ignore
  }
})();
})();
(function () {
if (!customElements.get("product-form")) {
  customElements.define(
    "product-form",
    class ProductForm extends HTMLElement {
      constructor() {
        super();
        // Don't initialize anything in constructor - element might not be in DOM yet
        this._cutoffTimer = null;
      }

      connectedCallback() {
        // Initialize all properties when element is in DOM
        this.productParentElement = this.closest(`[data-section][data-product]`);

        if (this.productParentElement) {
          this.dataset.section = this.productParentElement.dataset.section;
          this.dataset.product = this.productParentElement.dataset.product;
        }

        this.form = this.querySelector("form");
        if (this.form) {
          const idInput = this.form.querySelector('[name="id"]');
          if (idInput) {
            idInput.disabled = false;
          }

          // Remove old listener if exists
          if (this._submitHandler) {
            this.form.removeEventListener("submit", this._submitHandler);
          }

          // Add new listener
          this._submitHandler = this.onSubmitHandler.bind(this);
          this.form.addEventListener("submit", this._submitHandler);
        }

        this.informationModal = document.querySelector("information-modal");

        // Find all add to cart buttons: main form buttons and sticky buttons
        if (this.productParentElement) {
          const mainButtons = this.productParentElement.querySelectorAll(
            'product-buttons [type="submit"]'
          );
          const stickyButtons = this.productParentElement.querySelectorAll(
            'sticky-atc [type="submit"]'
          );
          this.atcButtons = [...mainButtons, ...stickyButtons];
        }

        this.updateCutoffDispatchMessage();
        this._cutoffTimer = setInterval(() => {
          this.updateCutoffDispatchMessage();
        }, 60000);

        Shopify?.PaymentButton?.init();
      }

      disconnectedCallback() {
        if (this._submitHandler && this.form) {
          this.form.removeEventListener("submit", this._submitHandler);
        }

        if (this._cutoffTimer) {
          clearInterval(this._cutoffTimer);
          this._cutoffTimer = null;
        }
      }

      onSubmitHandler(evt) {
        evt.preventDefault();
        if (this.productParentElement.dataset.variantSelected === "false") {
          const submitter = evt.submitter || evt.submitterPolyfill;

          this.handleErrorMessage(window.variantStrings.selectVariant);
          return;
        }

        // Check if the current selection should block add to cart.
        const productButtons = this.productParentElement.querySelector("product-buttons");
        const variantRadios = this.productParentElement.querySelector("variant-radios");

        const availabilityState = productButtons?.getAttribute("availability");
        if (availabilityState === "unavailable") {
          const unavailableMessage = window.variantStrings?.unavailable || "This combination is unavailable";
          this.handleErrorMessage(unavailableMessage);
          return;
        }

        if (availabilityState === "sold-out") {
          const soldOutMessage = window.variantStrings?.outOfStock || window.variantStrings?.soldOut || "Out of stock";
          this.handleErrorMessage(soldOutMessage);
          return;
        }

        // Also check if variant-radios has a null currentVariant (combination doesn't exist)
        if (variantRadios) {
          const hasSelectedVariantGetter = typeof variantRadios.getSelectedVariant === "function";
          const hasVariantGetter = typeof variantRadios.getCurrentVariant === "function";
          const hasCurrentVariantProp = "currentVariant" in variantRadios;
          const selectedVariant = hasSelectedVariantGetter
            ? variantRadios.getSelectedVariant()
            : null;
          const currentVariant = selectedVariant
            || (hasVariantGetter
              ? variantRadios.getCurrentVariant()
              : hasCurrentVariantProp
                ? variantRadios.currentVariant
                : null);

          // Only block if variant-radios actually provides variant state.
          // Some templates include <variant-radios> but manage selection elsewhere.
          if ((hasSelectedVariantGetter || hasVariantGetter || hasCurrentVariantProp) && !currentVariant) {
            const unavailableMessage = window.variantStrings?.unavailable || "This combination is unavailable";
            this.handleErrorMessage(unavailableMessage);
            return;
          }
        }

        this.handleAtcButtonStates("loading");

        this.handleErrorMessage();

        const config = fetchConfig("javascript");
        config.headers["X-Requested-With"] = "XMLHttpRequest";
        delete config.headers["Content-Type"];

        // redeclare form to gather updater inputs
        this.form = this.querySelector("form");

        const formData = new FormData(this.form);

        this.dynamicSectionsNodes = document.querySelectorAll("cart-dynamic");

        let dynamicSections = [];
        if (this.dynamicSectionsNodes) {
          dynamicSections = [...this.dynamicSectionsNodes].map(
            (item) => item.dataset.sectionId
          );
        }

        // unique dynamic sections
        dynamicSections = [...new Set(dynamicSections)];

        formData.append("sections", dynamicSections.join(","));
        // formData.append("quantity", this.querySelector('[name="quantity"]').value)
        config.body = formData;

        fetch(`${routes.cart_add_url}`, config)
          .then((response) => response.json())
          .then((response) => {
            if (response.status) {
              let errorMessage = "";
              // if response description is a string
              if (typeof response.description === "string") {
                errorMessage = response.description;
              } else {
                Object.keys(response.description).forEach((key) => {
                  if (key !== "status" && key !== "sections") {
                    errorMessage += `${response.description[key]}\n`;
                  }
                });
              }

              this.handleErrorMessage(errorMessage);
              this.handleAtcButtonStates("error");
              // this.productParentElement.dataset.variantSelected = false;
              return;
            }

            // update dynamic sections
            this.dynamicSectionsNodes.forEach((node) => {
              const htmlString = response.sections[node.dataset.sectionId];
              const html = new DOMParser().parseFromString(
                htmlString,
                "text/html"
              );
              node.innerHTML = html.querySelector(
                `cart-dynamic[data-section-id='${node.dataset.sectionId}']`
              ).innerHTML;
              node.classList = html.querySelector(
                `cart-dynamic[data-section-id='${node.dataset.sectionId}']`
              ).classList;
              node.modified();
            });

            this.handleAtcButtonStates("success");

            // Dispatch cart:added event to trigger cart drawer
            document.dispatchEvent(new CustomEvent('cart:added', {
              bubbles: true,
              detail: {
                source: 'product-form',
                product: response
              }
            }));
          })
          .catch((e) => {
            console.log(e);
          })
          .finally(() => {});
      }

      handleAtcButtonStates(state) {
        this.atcButtons.forEach((button) => {
          switch (state) {
            case "loading":
              if (button.dataset.state == "loading") return;
              button.setAttribute("aria-disabled", true);
              button.dataset.state = "loading";
              break;

            case "error":
              button.dataset.state = "error";
              button.removeAttribute("aria-disabled");
              navigator.vibrate?.(100);
              setTimeout(() => button.removeAttribute("data-state"), 3000);
              break;

            case "success":
              // Don't show success state, just reset to default
              button.removeAttribute("data-state");
              button.removeAttribute("aria-disabled");
              navigator.vibrate?.(100);
              break;
          }
        });
      }
      handleStickySubmit(submitter) {
        if (submitter.closest("sticky-mobile")) {
          const mobileFormDrawer = this.productParentElement.querySelector(
            `drawer-element[id^="product-form-template"]`
          );
          mobileFormDrawer.openDrawer();
          return;
        }

        if (submitter.closest("sticky-desktop")) {
          const variantSelector = submitter
            .closest("sticky-desktop")
            .querySelector(".variant-selector");
          variantSelector.classList.add(
            "outline-offset-2",
            "outline-2",
            "outline-highlight-red"
          );
          variantSelector.addEventListener("click", () => {
            variantSelector.classList.remove(
              "outline-offset-2",
              "outline-2",
              "outline-highlight-red"
            );
          });
          return;
        }
      }

      handleErrorMessage(errorMessage = false) {
        this.errorMessageWrappers =
          this.errorMessageWrappers ||
          this.productParentElement.querySelectorAll("error-message");

        this.errorMessageWrappers.forEach((errorMessageWrapper) => {
          if (errorMessage) {
            const errorMessageOutput =
              errorMessageWrapper.querySelector("span");
            errorMessageOutput.textContent = errorMessage;
            errorMessageWrapper.classList.remove("hidden");
            setTimeout(() => {
              errorMessageWrapper.classList.add("hidden");
            }, 3000);
          } else {
            errorMessageWrapper.classList.add("hidden");
          }
        });
      }

      updateCutoffDispatchMessage() {
        const dispatchMessageNode = this.querySelector("[data-cutoff-dispatch]");
        if (!dispatchMessageNode) return;
        const skeletonNode = dispatchMessageNode.querySelector("[data-cutoff-skeleton]");
        const textNode = dispatchMessageNode.querySelector("[data-cutoff-text]");

        const revealCutoffMessage = () => {
          dispatchMessageNode.dataset.cutoffReady = "true";
          skeletonNode?.classList.add("hidden");
          textNode?.classList.remove("hidden");
        };

        const cutoffRange = dispatchMessageNode.dataset.cutoffRange || "";
        const remainingTemplate = dispatchMessageNode.dataset.cutoffTemplate || "";
        const rangeMatch = cutoffRange.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);

        if (!rangeMatch || !remainingTemplate.includes("__REMAINING__")) {
          revealCutoffMessage();
          return;
        }

        const startHour = Number(rangeMatch[1]);
        const startMinute = Number(rangeMatch[2]);
        const endHour = Number(rangeMatch[3]);
        const endMinute = Number(rangeMatch[4]);

        if (
          Number.isNaN(startHour) || Number.isNaN(startMinute) ||
          Number.isNaN(endHour) || Number.isNaN(endMinute) ||
          startHour > 23 || endHour > 23 || startMinute > 59 || endMinute > 59
        ) {
          revealCutoffMessage();
          return;
        }

        const startTotalMinutes = (startHour * 60) + startMinute;
        const endTotalMinutes = (endHour * 60) + endMinute;
        const now = new Date();
        const nowTotalMinutes = (now.getHours() * 60) + now.getMinutes();

        const isOvernightRange = endTotalMinutes <= startTotalMinutes;
        const isInRange = isOvernightRange
          ? nowTotalMinutes >= startTotalMinutes || nowTotalMinutes < endTotalMinutes
          : nowTotalMinutes >= startTotalMinutes && nowTotalMinutes < endTotalMinutes;

        if (!isInRange) {
          revealCutoffMessage();
          return;
        }

        let remainingMinutes = 0;
        if (isOvernightRange && nowTotalMinutes >= startTotalMinutes) {
          remainingMinutes = (24 * 60) - nowTotalMinutes + endTotalMinutes;
        } else {
          remainingMinutes = endTotalMinutes - nowTotalMinutes;
        }

        if (remainingMinutes <= 0) {
          revealCutoffMessage();
          return;
        }

        const hours = Math.floor(remainingMinutes / 60);
        const minutes = remainingMinutes % 60;

        let remainingText = "";
        if (hours > 0 && minutes > 0) {
          remainingText = `${hours}h ${minutes}m`;
        } else if (hours > 0) {
          remainingText = `${hours}h`;
        } else {
          remainingText = `${minutes}m`;
        }

        if (textNode) {
          textNode.innerHTML = remainingTemplate.replace("__REMAINING__", remainingText);
        }
        revealCutoffMessage();
      }
    }
  );
}

// Klaviyo Waitlist Form Handler
if (!customElements.get("klaviyo-waitlist-form")) {
  customElements.define(
    "klaviyo-waitlist-form",
    class KlaviyoWaitlistForm extends HTMLFormElement {
      constructor() {
        super();
        this.variantInput = null;
      }

      connectedCallback() {
        this.addEventListener("submit", this.onSubmit.bind(this));
        // Find the hidden variant ID input from the main product form
        this.variantInput = document.querySelector('product-form input[name="id"]');
      }

      async onSubmit(e) {
        e.preventDefault();
        e.stopPropagation(); // Prevent event from bubbling to parent form
        e.stopImmediatePropagation(); // Ensure no other handlers are called
        
        const submitButton = this.querySelector('button[type="submit"]');
        const emailInput = this.querySelector("#klaviyo-waitlist-email");
        
        if (!emailInput.value || !this.variantInput || !this.variantInput.value) {
          this.fail("Missing email or variant information");
          return;
        }

        // Set button to loading state
        if (submitButton) {
          submitButton.dataset.state = "loading";
          submitButton.setAttribute("aria-disabled", true);
        }

        try {
          const result = await this.backInStockSubscription(
            emailInput.value,
            this.variantInput.value
          );
          
          if (!result.ok) {
            throw new Error("Failed to subscribe");
          }
          
          this.success(submitButton);
        } catch (error) {
          this.fail(error.message, submitButton);
        }
      }

      success(button) {
        if (button) {
          button.dataset.state = "success";
          button.removeAttribute("aria-disabled");
        }
        
        // Show success message
        const errorMessageWrapper = document.querySelector("error-message");
        if (errorMessageWrapper) {
          const errorMessageOutput = errorMessageWrapper.querySelector("span");
          errorMessageOutput.textContent = window.variantStrings?.waitlistSuccess || "You're now on the waitlist!";
          errorMessageWrapper.classList.remove("hidden");
          errorMessageWrapper.classList.add("!bg-success", "!text-white");
          setTimeout(() => {
            errorMessageWrapper.classList.add("hidden");
            errorMessageWrapper.classList.remove("!bg-success", "!text-white");
          }, 3000);
        }
        
        // Reset button state after delay
        setTimeout(() => {
          if (button) {
            button.removeAttribute("data-state");
          }
        }, 3000);
      }

      fail(message, button) {
        if (button) {
          button.dataset.state = "error";
          button.removeAttribute("aria-disabled");
          setTimeout(() => {
            button.removeAttribute("data-state");
          }, 3000);
        }
        
        // Show error message
        const errorMessageWrapper = document.querySelector("error-message");
        if (errorMessageWrapper) {
          const errorMessageOutput = errorMessageWrapper.querySelector("span");
          errorMessageOutput.textContent = `Failed to join waitlist: ${message}`;
          errorMessageWrapper.classList.remove("hidden");
          setTimeout(() => {
            errorMessageWrapper.classList.add("hidden");
          }, 3000);
        }
        
        console.error("Klaviyo waitlist error:", message);
      }

      async backInStockSubscription(email, variantId) {
        const raw = {
          data: {
            type: "back-in-stock-subscription",
            attributes: {
              profile: {
                data: {
                  type: "profile",
                  attributes: {
                    email: email,
                  },
                },
              },
              channels: ["EMAIL"],
            },
            relationships: {
              variant: {
                data: {
                  type: "catalog-variant",
                  id: `$shopify:::$default:::${variantId}`,
                },
              },
            },
          },
        };

        const options = {
          method: "POST",
          headers: {
            accept: "application/json",
            revision: "2023-10-15",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(raw),
        };

        return fetch(
          "https://a.klaviyo.com/client/back-in-stock-subscriptions/?company_id=NnE5A3",
          options
        ).catch((err) => {
          console.error("Klaviyo API error:", err);
          throw err;
        });
      }
    },
    { extends: "form" }
  );
}

// Product Buttons Custom Element
// Observes the 'available' attribute and updates button text/styling accordingly
if (!customElements.get("product-buttons")) {
  customElements.define(
    "product-buttons",
    class ProductButtons extends HTMLElement {
      static get observedAttributes() {
        return ["availability", "available"];
      }

      constructor() {
        super();
        this.button = null;
        this.buttonTextElement = null;
        this.originalText = null;
        this.originalHTML = null;
      }

      connectedCallback() {
        this.button = this.querySelector('button[type="submit"]');
        if (!this.button) return;

        // Find the text element within the button
        // The button structure has a span with class "default-context" containing the text
        this.buttonTextElement = this.button.querySelector('.default-context');
        if (this.buttonTextElement) {
          // Always store original content immediately when connected
          // This ensures we have it before any state changes
          this.originalText = this.buttonTextElement.textContent.trim();
          this.originalHTML = this.buttonTextElement.innerHTML;
        }

        // Update initial state (also update when available attribute changes on connect)
        // Use a small delay to ensure attribute is set
        requestAnimationFrame(() => {
          this.updateButtonState();
        });
      }

      attributeChangedCallback(name, oldValue, newValue) {
        if (name !== "availability" && name !== "available") return;

        // If button or textElement not found, try to find them again
        if (!this.button || !this.buttonTextElement) {
          this.button = this.querySelector('button[type="submit"]');
          if (this.button) {
            this.buttonTextElement = this.button.querySelector('.default-context');
            if (this.buttonTextElement && !this.originalHTML) {
              this.originalHTML = this.buttonTextElement.innerHTML;
              this.originalText = this.buttonTextElement.textContent.trim();
            }
          }
        }

        // Always update, even if values appear the same (they might be string vs boolean)
        this.updateButtonState();
      }

      updateButtonState() {
        if (!this.button) {
          this.button = this.querySelector('button[type="submit"]');
        }
        if (!this.buttonTextElement && this.button) {
          this.buttonTextElement = this.button.querySelector('.default-context');
        }
        if (!this.button) return;

        const availabilityState = this.#getAvailabilityState();
        const isAvailable = availabilityState === "available";
        const unavailableText = window.variantStrings?.unavailable || "Unavailable";
        const soldOutText = window.variantStrings?.outOfStock || window.variantStrings?.soldOut || "Out of stock";
        const disabledText = availabilityState === "sold-out" ? soldOutText : unavailableText;

        if (this.buttonTextElement && !this.originalHTML) {
          const currentText = this.buttonTextElement.textContent.trim();
          if (currentText !== unavailableText && currentText !== soldOutText) {
            this.originalHTML = this.buttonTextElement.innerHTML;
            this.originalText = currentText;
          }
        }

        // Always ensure originalHTML is stored when available
        // Store it if we're switching to available and don't have it yet
        if (isAvailable && this.buttonTextElement && !this.originalHTML) {
          // Only store if current content is not "Unavailable" (meaning it's the actual original)
          const currentText = this.buttonTextElement.textContent.trim();
          if (currentText !== unavailableText && currentText !== soldOutText) {
            this.originalHTML = this.buttonTextElement.innerHTML;
            this.originalText = currentText;
          }
        }

        if (isAvailable) {
          // Available state - restore original text and styling
          if (this.buttonTextElement && this.originalHTML) {
            // Restore original content
            this.buttonTextElement.innerHTML = this.originalHTML;
          } else if (this.buttonTextElement && this.originalText) {
            // Fallback to text only if HTML not stored
            this.buttonTextElement.textContent = this.originalText;
          } else if (this.buttonTextElement) {
            // Last resort: try to find the original text from the button's dataset or just use default
            const addToCartText = window.variantStrings?.addToCart || "Add to Cart";
            this.buttonTextElement.textContent = addToCartText;
            this.originalHTML = this.buttonTextElement.innerHTML;
            this.originalText = addToCartText;
          }
          // Restore original styling
          this.button.style.backgroundColor = "";
          this.button.style.opacity = "";
          this.button.style.cursor = "";
          this.button.style.color = "";
          this.button.removeAttribute("aria-disabled");
          this.button.removeAttribute("disabled");
        } else {
          // Disabled state - show the matching label and mute the button
          if (this.buttonTextElement) {
            const currentText = this.buttonTextElement.textContent.trim();
            if (!this.originalHTML && currentText !== unavailableText && currentText !== soldOutText) {
              this.originalHTML = this.buttonTextElement.innerHTML;
              this.originalText = currentText;
            }

            // Preserve icon if present, update text only
            const icon = this.buttonTextElement.querySelector('svg');
            if (icon) {
              // Rebuild the content so the label never duplicates when toggling states.
              const iconClone = icon.cloneNode(true);
              const textWrapper = document.createElement('div');
              textWrapper.textContent = disabledText;
              this.buttonTextElement.replaceChildren(iconClone, textWrapper);
            } else {
              // No icon - just update text
              this.buttonTextElement.textContent = disabledText;
            }
          }
          
          // Apply disabled styling (grey, disabled appearance)
          this.button.style.backgroundColor = 'rgb(156 163 175)'; // gray-400
          this.button.style.opacity = '0.5';
          this.button.style.cursor = 'not-allowed';
          this.button.style.color = 'rgb(107 114 128)'; // gray-500
          this.button.setAttribute("aria-disabled", "true");
          this.button.setAttribute("disabled", "disabled");
        }
      }

      #getAvailabilityState() {
        const availabilityAttr = this.getAttribute("availability");
        if (availabilityAttr === "available" || availabilityAttr === "sold-out" || availabilityAttr === "unavailable") {
          return availabilityAttr;
        }

        const availableAttr = this.getAttribute("available");
        const isAvailable = availableAttr === "true" || availableAttr === "" || availableAttr === null;
        return isAvailable ? "available" : "unavailable";
      }
    }
  );
}
})();
(function () {
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
})();
(function () {
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
})();
(function () {
/**
 * ProductVariantPreview Web Component
 * 
 * Handles hover-triggered fetching of product variant pages and replaces
 * variant-dynamic content without navigation. Provides smooth UX for
 * variant exploration.
 * 
 * @example
 * <a href="/products/product-handle?variant=123" 
 *    data-variant-preview 
 *    data-section-id="product--main">
 *   Variant Option
 * </a>
 */
class ProductVariantPreview extends HTMLElement {
  /** @type {AbortController | null} Current fetch abort controller */
  #abortController = null;
  
  /** @type {number | null} Hover delay timer */
  #hoverTimer = null;
  
  /** @type {boolean} Component connection state */
  #isConnected = false;
  
  /** @type {number} Hover delay before fetch starts (ms) */
  #hoverDelay = 300;
  
  /** @type {boolean} Whether fetch is in progress */
  #isFetching = false;
  
  /** @type {string | null} Currently loaded variant URL */
  #currentVariantUrl = null;

  constructor() {
    super();
  }

  /**
   * Get the href attribute value
   * @returns {string} The href attribute value
   */
  get href() {
    return this.getAttribute('href') || '';
  }

  /**
   * Set the href attribute value
   * @param {string} value - The href value to set
   */
  set href(value) {
    this.setAttribute('href', value);
  }

  connectedCallback() {
    console.log('🔍 ProductVariantPreview: connectedCallback triggered');
    console.log('🔍 ProductVariantPreview: Is connected:', this.#isConnected);
    
    if (this.#isConnected) {
      console.log('🔍 ProductVariantPreview: Already connected, skipping initialization');
      return;
    }
    
    try {
      this.#isConnected = true;
      console.log('🔍 ProductVariantPreview: Set isConnected to true');
      this.#initializeEventListeners();
    } catch (error) {
      console.error('🔍 ProductVariantPreview: Error in connectedCallback:', error);
      this.#handleError('Failed to initialize variant preview', error);
    }
  }

  disconnectedCallback() {
    this.#cleanup();
  }

  /**
   * Initialize event listeners for hover interactions
   * @private
   */
  #initializeEventListeners() {
    console.log('🔍 ProductVariantPreview: Initializing event listeners');
    console.log('🔍 ProductVariantPreview: Element href:', this.href);
    console.log('🔍 ProductVariantPreview: Element href attribute:', this.getAttribute('href'));
    console.log('🔍 ProductVariantPreview: Element dataset:', this.dataset);
    
    // Prevent default navigation on click
    this.addEventListener('click', this.#handleClick.bind(this));
    
    // Handle hover start
    this.addEventListener('mouseenter', this.#handleMouseEnter.bind(this));
    this.addEventListener('focus', this.#handleMouseEnter.bind(this));
    
    // Handle hover end
    this.addEventListener('mouseleave', this.#handleMouseLeave.bind(this));
    this.addEventListener('blur', this.#handleMouseLeave.bind(this));
    
    console.log('🔍 ProductVariantPreview: Event listeners initialized');
  }

  /**
   * Handle click events - prevent default navigation
   * @param {Event} event - Click event
   * @private
   */
  #handleClick(event) {
    console.log('🔍 ProductVariantPreview: Click event triggered');
    console.log('🔍 ProductVariantPreview: Current variant URL:', this.#currentVariantUrl);
    console.log('🔍 ProductVariantPreview: Element href:', this.href);
    console.log('🔍 ProductVariantPreview: Is fetching:', this.#isFetching);
    
    // Only prevent default if we have successfully loaded a variant
    if (this.#currentVariantUrl) {
      console.log('🔍 ProductVariantPreview: Preventing default navigation');
      event.preventDefault();
      
      // Dispatch custom event for parent components to handle
      this.dispatchEvent(new CustomEvent('variant:preview-click', {
        detail: { 
          variantUrl: this.href,
          currentVariantUrl: this.#currentVariantUrl 
        },
        bubbles: true
      }));
      
      console.log('🔍 ProductVariantPreview: Dispatched variant:preview-click event');
    } else {
      console.log('🔍 ProductVariantPreview: No current variant URL, allowing default navigation');
    }
  }

  /**
   * Handle mouse enter/focus events - start hover timer
   * @param {Event} event - Mouse enter or focus event
   * @private
   */
  #handleMouseEnter(event) {
    console.log('🔍 ProductVariantPreview: Mouse enter/focus event');
    console.log('🔍 ProductVariantPreview: Element href:', this.href);
    
    // Clear any existing timer
    clearTimeout(this.#hoverTimer);
    
    // Start new timer
    this.#hoverTimer = setTimeout(() => {
      console.log('🔍 ProductVariantPreview: Hover timer expired, starting fetch');
      this.#fetchVariantContent();
    }, this.#hoverDelay);
    
    console.log('🔍 ProductVariantPreview: Started hover timer for', this.#hoverDelay, 'ms');
  }

  /**
   * Handle mouse leave/blur events - cancel operations
   * @param {Event} event - Mouse leave or blur event
   * @private
   */
  #handleMouseLeave(event) {
    console.log('🔍 ProductVariantPreview: Mouse leave/blur event');
    
    // Clear hover timer
    clearTimeout(this.#hoverTimer);
    this.#hoverTimer = null;
    
    // Abort any ongoing fetch
    if (this.#abortController) {
      console.log('🔍 ProductVariantPreview: Aborting ongoing fetch');
      this.#abortController.abort();
      this.#abortController = null;
    }
    
    console.log('🔍 ProductVariantPreview: Cleared hover timer and aborted fetch');
  }

  /**
   * Get list of sections that need to be fetched based on variant-dynamic elements
   * @returns {string[]} Array of section IDs to fetch
   * @private
   */
  #getSectionsToFetch() {
    const sections = new Set();
    
    // Find all variant-dynamic elements and determine their sections
    document.querySelectorAll('[data-variant-dynamic]').forEach(element => {
      const sectionId = element.dataset.sectionId || this.#getSectionIdFromElement(element);
      if (sectionId) {
        sections.add(sectionId);
      }
    });
    
    // Always include the main product section
    sections.add('product--main');
    
    return Array.from(sections);
  }

  /**
   * Get section ID from element by traversing up the DOM
   * @param {Element} element - The element to find section for
   * @returns {string|null} Section ID or null if not found
   * @private
   */
  #getSectionIdFromElement(element) {
    // Look for section element with id attribute
    const section = element.closest('section[id]');
    if (section) {
      return section.id;
    }
    
    // Look for section element with data-section-id
    const sectionWithData = element.closest('section[data-section-id]');
    if (sectionWithData) {
      return sectionWithData.dataset.sectionId;
    }
    
    return null;
  }

  /**
   * Fetch a specific section using Shopify's section rendering API
   * @param {string} sectionId - The section ID to fetch
   * @returns {Promise<{sectionId: string, html: string}>} Section data
   * @private
   */
  async #fetchSection(sectionId) {
    console.log('🔍 ProductVariantPreview: Fetching section:', sectionId);
    
    const fetchUrl = `${this.href}?section_id=${sectionId}`;
    console.log('🔍 ProductVariantPreview: Section fetch URL:', fetchUrl);
    
    const response = await fetch(fetchUrl, {
      signal: this.#abortController.signal,
      headers: {
        'Accept': 'text/html',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch section ${sectionId}: HTTP ${response.status}`);
    }
    
    const html = await response.text();
    console.log('🔍 ProductVariantPreview: Fetched section', sectionId, 'length:', html.length);
    
    return { sectionId, html };
  }

  /**
   * Fetch variant content from the product page
   * @private
   */
  async #fetchVariantContent() {
    console.log('🔍 ProductVariantPreview: Starting fetchVariantContent');
    console.log('🔍 ProductVariantPreview: Is fetching:', this.#isFetching);
    console.log('🔍 ProductVariantPreview: Element href:', this.href);
    
    if (this.#isFetching || !this.href) {
      console.log('🔍 ProductVariantPreview: Fetch blocked - isFetching:', this.#isFetching, 'href:', this.href);
      return;
    }
    
    try {
      this.#isFetching = true;
      console.log('🔍 ProductVariantPreview: Set isFetching to true');
      
      // Add loading state
      this.setAttribute('data-loading', 'true');
      console.log('🔍 ProductVariantPreview: Added data-loading attribute');
      
      // Create new abort controller for this fetch
      this.#abortController = new AbortController();
      
      // Get all sections that need to be fetched
      const sectionsToFetch = this.#getSectionsToFetch();
      console.log('🔍 ProductVariantPreview: Sections to fetch:', sectionsToFetch);
      
      // Fetch all sections in parallel
      const fetchPromises = sectionsToFetch.map(sectionId => 
        this.#fetchSection(sectionId)
      );
      
      const sectionResults = await Promise.all(fetchPromises);
      console.log('🔍 ProductVariantPreview: All sections fetched successfully');
      
      // Update variant-dynamic content with all fetched sections
      await this.#updateVariantContent(sectionResults, this.href);
      
      // Store current variant URL
      this.#currentVariantUrl = this.href;
      console.log('🔍 ProductVariantPreview: Stored current variant URL:', this.#currentVariantUrl);
      
      // Dispatch success event
      this.dispatchEvent(new CustomEvent('variant:preview-loaded', {
        detail: { variantUrl: this.href, sectionsFetched: sectionsToFetch },
        bubbles: true
      }));
      
      console.log('🔍 ProductVariantPreview: Dispatched variant:preview-loaded event');
      
    } catch (error) {
      // Don't throw for aborted requests
      if (error.name === 'AbortError') {
        console.log('🔍 ProductVariantPreview: Fetch was aborted');
        return;
      }
      
      console.error('🔍 ProductVariantPreview: Fetch error:', error);
      this.#handleError('Failed to fetch variant content', error);
    } finally {
      this.#isFetching = false;
      this.#abortController = null;
      
      // Remove loading state
      this.removeAttribute('data-loading');
      console.log('🔍 ProductVariantPreview: Cleanup completed - isFetching:', this.#isFetching);
    }
  }

  /**
   * Update variant-dynamic content with fetched sections
   * @param {Array<{sectionId: string, html: string}>} sectionResults - Array of fetched sections
   * @param {string} variantUrl - Variant URL being loaded
   * @private
   */
  async #updateVariantContent(sectionResults, variantUrl) {
    console.log('🔍 ProductVariantPreview: Starting updateVariantContent');
    console.log('🔍 ProductVariantPreview: Variant URL:', variantUrl);
    console.log('🔍 ProductVariantPreview: Sections to process:', sectionResults.length);
    
    try {
      // Parse all fetched sections
      const sectionDocs = new Map();
      sectionResults.forEach(({ sectionId, html }) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        sectionDocs.set(sectionId, doc);
        console.log('🔍 ProductVariantPreview: Parsed section:', sectionId);
      });
      
      // Find all variant-dynamic elements in the current page
      const currentElements = document.querySelectorAll('[data-variant-dynamic]');
      console.log('🔍 ProductVariantPreview: Found variant-dynamic elements:', currentElements.length);
      
      if (currentElements.length === 0) {
        console.warn('ProductVariantPreview: No variant-dynamic elements found on current page');
        return;
      }
      
      // Add loading state
      currentElements.forEach(element => {
        element.classList.add('opacity-20', 'transition-opacity', 'duration-200');
      });
      console.log('🔍 ProductVariantPreview: Added loading state to elements');
      
      // Update each variant-dynamic element
      let updatedCount = 0;
      currentElements.forEach(element => {
        const dynamicId = element.dataset.variantDynamic;
        if (!dynamicId) {
          console.log('🔍 ProductVariantPreview: Element missing variantDynamic ID:', element);
          return;
        }
        
        console.log('🔍 ProductVariantPreview: Processing element with ID:', dynamicId);
        
        // Determine which section this element belongs to
        const elementSectionId = element.dataset.sectionId || this.#getSectionIdFromElement(element) || 'product--main';
        console.log('🔍 ProductVariantPreview: Element section ID:', elementSectionId);
        
        // Get the corresponding section document
        const sectionDoc = sectionDocs.get(elementSectionId);
        if (!sectionDoc) {
          console.log('🔍 ProductVariantPreview: No section document found for:', elementSectionId);
          return;
        }
        
        // Find corresponding element in fetched content
        const fetchedElement = sectionDoc.querySelector(`[data-variant-dynamic="${dynamicId}"]`);
        
        if (fetchedElement) {
          console.log('🔍 ProductVariantPreview: Found matching element in fetched content');
          
          // Handle keep/remove attributes
          let updatedContent = fetchedElement.innerHTML;
          
          if (element.dataset.keep) {
            console.log('🔍 ProductVariantPreview: Applying keep attributes:', element.dataset.keep);
            updatedContent = this.#applyKeepAttributes(updatedContent, element.dataset.keep);
          }
          
          if (element.dataset.remove) {
            console.log('🔍 ProductVariantPreview: Applying remove attributes:', element.dataset.remove);
            updatedContent = this.#applyRemoveAttributes(updatedContent, element.dataset.remove);
          }
          
          // Update the content
          element.innerHTML = updatedContent;
          updatedCount++;
          console.log('🔍 ProductVariantPreview: Updated element:', dynamicId);
        } else {
          console.log('🔍 ProductVariantPreview: No matching element found for ID:', dynamicId, 'in section:', elementSectionId);
        }
      });
      
      // Remove loading state
      currentElements.forEach(element => {
        element.classList.remove('opacity-20');
      });
      console.log('🔍 ProductVariantPreview: Removed loading state from elements');
      
      // Dispatch content updated event
      this.dispatchEvent(new CustomEvent('variant:content-updated', {
        detail: { variantUrl, updatedElements: updatedCount, sectionsProcessed: sectionResults.length },
        bubbles: true
      }));
      
      console.log('🔍 ProductVariantPreview: Dispatched content-updated event, updated elements:', updatedCount);
      
    } catch (error) {
      console.error('🔍 ProductVariantPreview: Error in updateVariantContent:', error);
      this.#handleError('Failed to update variant content', error);
    }
  }

  /**
   * Apply keep attributes to preserve specific form elements
   * @param {string} content - HTML content to modify
   * @param {string} keepData - JSON string of attributes to keep
   * @returns {string} Modified content
   * @private
   */
  #applyKeepAttributes(content, keepData) {
    try {
      const keepAttributes = JSON.parse(keepData);
      
      Object.entries(keepAttributes).forEach(([attribute, value]) => {
        if (attribute === 'form') {
          // Preserve form attribute by finding form elements and keeping their form attribute
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = content;
          
          tempDiv.querySelectorAll('input, select, textarea, button').forEach(element => {
            if (element.form) {
              element.setAttribute('form', element.form.id || element.form.name);
            }
          });
          
          content = tempDiv.innerHTML;
        }
      });
      
      return content;
    } catch (error) {
      console.warn('ProductVariantPreview: Failed to parse keep attributes', error);
      return content;
    }
  }

  /**
   * Apply remove attributes to strip specific attributes
   * @param {string} content - HTML content to modify
   * @param {string} removeData - Comma-separated list of attributes to remove
   * @returns {string} Modified content
   * @private
   */
  #applyRemoveAttributes(content, removeData) {
    try {
      const removeAttributes = removeData.split(',').map(attr => attr.trim());
      
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      
      tempDiv.querySelectorAll('*').forEach(element => {
        removeAttributes.forEach(attr => {
          element.removeAttribute(attr);
        });
      });
      
      return tempDiv.innerHTML;
    } catch (error) {
      console.warn('ProductVariantPreview: Failed to apply remove attributes', error);
      return content;
    }
  }

  /**
   * Handle errors gracefully with user feedback
   * @param {string} message - Error message
   * @param {Error} error - Original error object
   * @private
   */
  #handleError(message, error) {
    console.error(`ProductVariantPreview: ${message}`, error);
    
    this.dispatchEvent(new CustomEvent('variant:preview-error', {
      detail: { 
        message, 
        error: error.message,
        variantUrl: this.href 
      },
      bubbles: true
    }));
  }

  /**
   * Clean up resources and event listeners
   * @private
   */
  #cleanup() {
    this.#isConnected = false;
    
    // Clear timers
    clearTimeout(this.#hoverTimer);
    this.#hoverTimer = null;
    
    // Abort any ongoing fetch
    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }
    
    this.#isFetching = false;
    this.#currentVariantUrl = null;
  }
}

// Register the web component
console.log('🔍 ProductVariantPreview: Registering web component');
customElements.define('product-variant-preview', ProductVariantPreview);
console.log('🔍 ProductVariantPreview: Web component registered successfully');

// Link conversion is now handled by electric-variant-link-converter component
// This ensures it works even when scripts are injected after DOM is ready
})();
(function () {
/**
 * Product Card Add to Cart Component
 * 
 * Handles add-to-cart functionality for product cards with add-to-bag icons.
 * Provides loading states, error handling, and cart updates.
 * 
 * @example
 * <button data-add-to-cart-trigger data-product-id="123" data-variant-id="456">
 *   <icon>add-to-bag</icon>
 * </button>
 */
class ProductCardATC extends HTMLElement {
  /** @type {HTMLButtonElement | null} Add to cart trigger button */
  #trigger = null;
  
  /** @type {HTMLFormElement | null} Hidden product form */
  #form = null;
  
  /** @type {boolean} Component connection state */
  #isConnected = false;
  
  /** @type {AbortController | null} Event listener controller */
  #abortController = null;

  constructor() {
    super();
  }

  connectedCallback() {
    if (this.#isConnected) return;
    
    try {
      this.#isConnected = true;
      this.#initialize();
    } catch (error) {
      this.#handleError('Failed to initialize product card ATC', error);
    }
  }

  disconnectedCallback() {
    this.#cleanup();
  }

  /**
   * Initialize the component
   * @private
   */
  #initialize() {
    this.#trigger = this.querySelector('[data-add-to-cart-trigger]');
    this.#form = this.querySelector('form[data-type="add-to-cart-form"]');
    
    if (!this.#trigger || !this.#form) {
      this.#logError(new Error('Missing required elements: trigger button or form'));
      return;
    }

    this.#setupEventListeners();
  }

  /**
   * Setup event listeners for add to cart functionality
   * @private
   */
  #setupEventListeners() {
    this.#abortController = new AbortController();
    
    this.#trigger.addEventListener('click', this.#handleAddToCart.bind(this), {
      signal: this.#abortController.signal,
      passive: false
    });
    
    this.#trigger.addEventListener('keydown', this.#handleKeydown.bind(this), {
      signal: this.#abortController.signal,
      passive: false
    });
  }

  /**
   * Handle add to cart button click
   * @param {Event} event - Click event
   * @private
   */
  async #handleAddToCart(event) {
    event.preventDefault();
    
    if (this.#trigger.disabled) return;
    
    try {
      this.#setLoadingState(true);
      
      const formData = new FormData(this.#form);
      
      // Get dynamic sections for cart updates
      const dynamicSectionsNodes = document.querySelectorAll('cart-dynamic');
      const sectionIds = dynamicSectionsNodes.length
        ? [...dynamicSectionsNodes].map(n => n.dataset.sectionId)
        : [];
      
      formData.append('sections', sectionIds.join(','));
      
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.status) {
        throw new Error(result.description || 'Failed to add to cart');
      }
      
      this.#handleSuccess(result);
      
    } catch (error) {
      this.#handleError('Failed to add product to cart', error);
    } finally {
      this.#setLoadingState(false);
    }
  }

  /**
   * Handle keyboard navigation
   * @param {KeyboardEvent} event - Keydown event
   * @private
   */
  #handleKeydown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.#trigger.click();
    }
  }

  /**
   * Set loading state for the button
   * @param {boolean} isLoading - Whether to show loading state
   * @private
   */
  #setLoadingState(isLoading) {
    if (isLoading) {
      this.#trigger.setAttribute('data-state', 'loading');
      this.#trigger.setAttribute('aria-label', 'Adding to cart...');
    } else {
      this.#trigger.removeAttribute('data-state');
      this.#trigger.setAttribute('aria-label', 'Add to cart');
    }
  }

  /**
   * Handle successful add to cart
   * @param {Object} result - Cart add result
   * @private
   */
  #handleSuccess(result) {
    // Set success state on button
    this.#trigger.setAttribute('data-state', 'success');
    
    // Update dynamic sections if provided
    const dynamicSectionsNodes = document.querySelectorAll('cart-dynamic');
    if (dynamicSectionsNodes.length && result.sections) {
      [...dynamicSectionsNodes].forEach(node => {
        const htmlString = result.sections[node.dataset.sectionId];
        if (!htmlString) return;
        
        const html = new DOMParser().parseFromString(htmlString, 'text/html');
        const updated = html.querySelector(`cart-dynamic[data-section-id='${node.dataset.sectionId}']`);
        if (!updated) return;
        
        node.innerHTML = updated.innerHTML;
        node.className = updated.className;
        
        // Call lifecycle hook if present
        if (typeof node.modified === 'function') {
          node.modified();
        }
      });
    }
    
    // Dispatch cart update event
    document.dispatchEvent(new CustomEvent('cart:update', {
      detail: {
        items: [result],
        source: 'product-card-atc'
      },
      bubbles: true
    }));

    // Haptic feedback if available
    navigator.vibrate?.(100);

    // On cart page, do not open cart drawer again.
    if (!document.body.classList.contains('template-cart')) {
      document.dispatchEvent(new CustomEvent('cart:added', {
        bubbles: true,
        detail: {
          source: 'product-card-atc',
          product: result
        }
      }));
    }
  }

  /**
   * Show notification in top-right corner
   * @param {string} message - Notification message
   * @private
   */
  #showNotification(message) {
    // Remove existing notification if present
    const existingNotification = document.querySelector('.product-card-notification');
    if (existingNotification) {
      existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'product-card-notification fixed top-4 right-4 z-[9999] color-schema-contrast bg-surface px-4 py-2 shadow-lg transform translate-x-full transition-transform duration-300 ease-out';
    notification.textContent = message;
    
    // Add to document
    document.body.appendChild(notification);
    
    // Animate in
    requestAnimationFrame(() => {
      notification.classList.remove('translate-x-full');
    });
    
    // Remove after delay
    setTimeout(() => {
      notification.classList.add('translate-x-full');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }, 2000);
  }

  /**
   * Handle errors gracefully
   * @param {string} message - Error message
   * @param {Error} error - Original error
   * @private
   */
  #handleError(message, error) {
    console.error(`ProductCardATC: ${message}`, error);
    
    // Set error state on button
    this.#trigger.setAttribute('data-state', 'error');
    
    // Haptic feedback for error
    navigator.vibrate?.(200);
    
    // Remove error state after delay
    setTimeout(() => {
      this.#trigger.removeAttribute('data-state');
    }, 3000);
  }

  /**
   * Log errors for debugging
   * @param {Error} error - Error to log
   * @private
   */
  #logError(error) {
    console.error('ProductCardATC:', error);
  }

  /**
   * Clean up resources and event listeners
   * @private
   */
  #cleanup() {
    this.#isConnected = false;
    this.#abortController?.abort();
    this.#abortController = null;
  }
}

// Register the component
customElements.define('product-card-atc', ProductCardATC);
})();
(function () {
/**
 * Debug logging function that only logs if 'debug_quick_atc=1' is present in URL query parameters
 * @param {...any} args - Arguments to log
 */
function debugLog(...args) {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('debug_quick_atc') === '1') {
    console.log(...args);
  }
}

/**
 * QuickATCTrigger Web Component
 *
 * Custom element that automatically initializes when connected to DOM.
 * Manages quick add-to-cart modal functionality with product content preloading
 * and dynamic section fetching.
 *
 * Features:
 * - Auto-initialization via connectedCallback
 * - Hover-based content preloading
 * - Modal state management
 * - Automatic cleanup on disconnect
 *
 * @example
 * // HTML markup (auto-initialized when added to DOM):
 * <quick-atc-trigger data-modal-id="quick-atc-modal-123"
 *                    data-product-handle="product-handle"
 *                    data-product-url="/products/handle?section_id=product--main">
 *   <button data-modal-trigger="quick-atc-modal-123">Quick Add</button>
 * </quick-atc-trigger>
 */
class QuickATCTrigger extends HTMLElement {
  #modalId = '';
  #productHandle = '';
  #productUrl = '';
  #isInitialized = false;
  #preloadedHTML = null;
  #isLoading = false;
  #abortController = null;
  #modalOpenHandler = null;
  #modalCloseHandler = null;
  #hoverHandler = null;

  /**
   * Web Component lifecycle - called when element is added to DOM
   */
  connectedCallback() {
    debugLog('🔌 QuickATCTrigger: Connected to DOM');
    this.#init();
  }

  /**
   * Web Component lifecycle - called when element is removed from DOM
   */
  disconnectedCallback() {
    debugLog('🔌 QuickATCTrigger: Disconnected from DOM');
    this.#cleanup();
  }

  /**
   * Initialize the component
   * @private
   */
  #init() {
    if (this.#isInitialized) return;

    // Extract data from attributes
    this.#modalId = this.dataset.modalId || '';
    this.#productHandle = this.dataset.productHandle || '';
    this.#productUrl = this.dataset.productUrl || '';

    if (!this.#modalId || !this.#productHandle || !this.#productUrl) {
      console.warn('⚠️ QuickATCTrigger: Missing required data attributes', {
        modalId: this.#modalId,
        productHandle: this.#productHandle,
        productUrl: this.#productUrl
      });
      return;
    }

    // Ensure product URL has section_id parameter for product--quick-atc section
    this.#productUrl = this.#ensureSectionId(this.#productUrl);

    debugLog('✅ QuickATCTrigger: Initializing', {
      modalId: this.#modalId,
      productHandle: this.#productHandle,
      productUrl: this.#productUrl
    });

    try {
      this.#setupEventListeners();
      this.#addHoverListeners();
      this.#isInitialized = true;
    } catch (error) {
      this.#handleError('Failed to initialize QuickATCTrigger', error);
    }
  }

  /**
   * Ensure the URL has the section_id parameter for product--quick-atc
   * @param {string} url - The product URL
   * @returns {string} URL with section_id parameter
   * @private
   */
  #ensureSectionId(url) {
    try {
      // Parse the URL
      const urlObj = new URL(url, window.location.origin);

      // Check if section_id is already present
      if (!urlObj.searchParams.has('section_id')) {
        // Add section_id=product--quick-atc parameter
        urlObj.searchParams.set('section_id', 'product--quick-atc');
      }

      // Return the pathname + search params (relative URL)
      return urlObj.pathname + urlObj.search;
    } catch (error) {
      console.warn('⚠️ QuickATCTrigger: Failed to parse URL, using as-is', error);
      // Fallback: append section_id if not present
      const separator = url.includes('?') ? '&' : '?';
      return url.includes('section_id') ? url : `${url}${separator}section_id=product--quick-atc`;
    }
  }

  /**
   * Setup event listeners for modal operations
   * @private
   */
  #setupEventListeners() {
    // Create bound handlers for cleanup
    this.#modalOpenHandler = this.#handleModalOpen.bind(this);
    this.#modalCloseHandler = this.#handleModalClose.bind(this);

    // Listen for modal events
    document.addEventListener('modal:open', this.#modalOpenHandler, { passive: true });
    document.addEventListener('modal:close', this.#modalCloseHandler, { passive: true });
  }

  /**
   * Add hover listener for content preloading
   * @private
   */
  #addHoverListeners() {
    // Find parent product card or use self as hover target
    const hoverTarget = this.closest('.product-card') || this;

    this.#hoverHandler = () => {
      if (!this.#preloadedHTML && !this.#isLoading) {
        this.#preloadContent();
      }
    };

    hoverTarget.addEventListener('mouseenter', this.#hoverHandler, { once: true, passive: true });
  }

  /**
   * Preload product content for faster modal display
   * @private
   */
  async #preloadContent() {
    if (this.#isLoading || this.#preloadedHTML) return;

    debugLog('🔄 QuickATCTrigger: Preloading content', { modalId: this.#modalId });
    this.#isLoading = true;

    try {
      this.#abortController = new AbortController();

      const response = await fetch(this.#productUrl, {
        signal: this.#abortController.signal,
        headers: {
          'Accept': 'text/html',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      this.#preloadedHTML = html;
      this.#isLoading = false;

      debugLog('✅ QuickATCTrigger: Preload successful', { modalId: this.#modalId });

      // Dispatch preload success event
      this.dispatchEvent(new CustomEvent('quick-atc:preload-success', {
        detail: { productHandle: this.#productHandle, modalId: this.#modalId },
        bubbles: true
      }));

    } catch (error) {
      this.#isLoading = false;
      if (error.name !== 'AbortError') {
        console.error('❌ QuickATCTrigger: Preload failed', error);
        this.#preloadedHTML = null;
      }
    }
  }

  /**
   * Handle modal open events
   * @private
   */
  async #handleModalOpen(event) {
    const { modalId } = event.detail || {};
    if (modalId !== this.#modalId) return;

    debugLog('🚀 QuickATCTrigger: Handling modal open', { modalId: this.#modalId });

    // Show loading state when modal opens
    this.#setLoadingState(true);

    try {
      // Wait for modal DOM
      await new Promise(resolve => setTimeout(resolve, 50));

      const modalElements = this.#getModalElements();
      if (!modalElements) {
        console.error('❌ QuickATCTrigger: Modal elements not found');
        this.#setLoadingState(false);
        return;
      }

      const { loadingEl, errorEl, productEl } = modalElements;

      if (this.#preloadedHTML) {
        debugLog('✅ QuickATCTrigger: Using preloaded content');
        this.#displayContent(productEl, this.#preloadedHTML);
        this.#setLoadingState(false);
      } else {
        debugLog('🔄 QuickATCTrigger: Fetching content...');
        // Don't hide content if we don't have loading elements
        if (loadingEl) {
          this.#showState(loadingEl);
        }
        await this.#fetchAndDisplayContent(productEl, errorEl);
        this.#setLoadingState(false);
      }
    } catch (error) {
      this.#handleError('Failed to handle modal open', error);
      this.#setLoadingState(false);
    }
  }

  /**
   * Handle modal close events
   * @private
   */
  #handleModalClose(event) {
    const { modalId } = event.detail || {};
    if (modalId === this.#modalId) {
      if (this.#abortController) {
        this.#abortController.abort();
        this.#abortController = null;
      }
      // Reset loading state when modal closes
      this.#setLoadingState(false);
    }
  }

  /**
   * Set loading state for the trigger button
   * @param {boolean} isLoading - Whether to show loading state
   * @private
   */
  #setLoadingState(isLoading) {
    const triggerButton = this.querySelector('[data-quick-atc-trigger]') ||
                         document.querySelector(`[data-quick-atc-trigger="${this.#modalId}"]`);
    if (!triggerButton) return;

    const iconElement = triggerButton.querySelector('[data-icon]');
    const spinnerElement = triggerButton.querySelector('[data-spinner]');

    if (isLoading) {
      triggerButton.disabled = true;
      triggerButton.setAttribute('aria-label', 'Loading product...');
      if (iconElement) iconElement.classList.add('opacity-0');
      if (spinnerElement) spinnerElement.classList.remove('hidden');
    } else {
      triggerButton.disabled = false;
      const productTitle = this.#productHandle || 'product';
      triggerButton.setAttribute('aria-label', `Quick add ${productTitle} to cart`);
      if (iconElement) iconElement.classList.remove('opacity-0');
      if (spinnerElement) spinnerElement.classList.add('hidden');
    }
  }

  /**
   * Get modal DOM elements
   * @private
   */
  #getModalElements() {
    const modal = document.getElementById('electric-modal-container');
    if (!modal) return null;

    const modalContent = modal.querySelector('.electric-modal-content');
    if (!modalContent) return null;

    // Look for the section-fetcher element which contains the actual content
    const sectionFetcher = modalContent.querySelector('section-fetcher');

    return {
      loadingEl: modalContent.querySelector('.quick-atc-loading'),
      errorEl: modalContent.querySelector('.quick-atc-error'),
      productEl: sectionFetcher || modalContent.querySelector('.quick-atc-product-content')
    };
  }

  /**
   * Fetch and display product content
   * @private
   */
  async #fetchAndDisplayContent(productEl, errorEl) {
    try {
      this.#abortController = new AbortController();

      const response = await fetch(this.#productUrl, {
        signal: this.#abortController.signal,
        headers: {
          'Accept': 'text/html',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      this.#preloadedHTML = html;
      this.#displayContent(productEl, html);

    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('❌ QuickATCTrigger: Fetch failed', error);
        this.#showState(errorEl);
      }
    }
  }

  /**
   * Display product content in modal
   * @private
   */
  #displayContent(productEl, html) {
    if (!productEl) return;

    try {
      productEl.innerHTML = html;

      // Reinitialize Shopify scripts
      if (window.Shopify?.PaymentButton?.init) {
        window.Shopify.PaymentButton.init();
      }
      if (window.ProductForm?.init) {
        window.ProductForm.init();
      }

      // Dispatch content loaded event
      this.dispatchEvent(new CustomEvent('quick-atc:content-loaded', {
        detail: { productHandle: this.#productHandle, modalId: this.#modalId },
        bubbles: true
      }));

      // Only show state if we have loading/error elements to manage
      const modal = document.getElementById('electric-modal-container');
      if (modal?.querySelector('.quick-atc-loading')) {
        this.#showState(productEl);
      }

    } catch (error) {
      console.error('❌ QuickATCTrigger: Failed to display content', error);
    }
  }

  /**
   * Show specific modal state
   * @private
   */
  #showState(elementToShow) {
    const modalElements = this.#getModalElements();
    if (!modalElements) return;

    const { loadingEl, errorEl, productEl } = modalElements;

    // Hide all states
    [loadingEl, errorEl, productEl].forEach(el => {
      if (el) el.classList.add('hidden');
    });

    // Show specified state
    if (elementToShow) {
      elementToShow.classList.remove('hidden');
    }
  }

  /**
   * Handle errors
   * @private
   */
  #handleError(message, error) {
    console.error(`QuickATCTrigger [${this.#modalId}]: ${message}`, error);

    this.dispatchEvent(new CustomEvent('quick-atc:error', {
      detail: {
        message,
        error: error.message,
        modalId: this.#modalId,
        productHandle: this.#productHandle
      },
      bubbles: true
    }));
  }

  /**
   * Cleanup resources
   * @private
   */
  #cleanup() {
    // Abort any ongoing requests
    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }

    // Remove event listeners
    if (this.#modalOpenHandler) {
      document.removeEventListener('modal:open', this.#modalOpenHandler);
    }
    if (this.#modalCloseHandler) {
      document.removeEventListener('modal:close', this.#modalCloseHandler);
    }

    // Remove hover listener
    if (this.#hoverHandler) {
      const hoverTarget = this.closest('.product-card') || this;
      hoverTarget.removeEventListener('mouseenter', this.#hoverHandler);
    }

    // Clear state
    this.#isInitialized = false;
    this.#preloadedHTML = null;
  }
}

// Register the custom element
customElements.define('quick-atc-trigger', QuickATCTrigger);

/**
 * Legacy support - convert existing buttons to web components
 * This observer watches for dynamically added elements with data-quick-atc-trigger
 * and wraps them in the custom element
 */
class QuickATCLegacyAdapter {
  #observer = null;
  #processedElements = new WeakSet();

  constructor() {
    this.#init();
  }

  #init() {
    // Process existing elements
    this.#processExistingElements();

    // Setup mutation observer for dynamic content
    this.#setupObserver();
  }

  #processExistingElements() {
    const triggers = document.querySelectorAll('[data-quick-atc-trigger]:not(quick-atc-trigger [data-quick-atc-trigger])');
    triggers.forEach(trigger => this.#wrapTrigger(trigger));
  }

  #wrapTrigger(trigger) {
    // Skip if already processed
    if (this.#processedElements.has(trigger)) return;
    if (trigger.closest('quick-atc-trigger')) return;

    const modalId = trigger.dataset.quickAtcTrigger;
    const productHandle = trigger.dataset.modalProductHandle;
    let productUrl = trigger.dataset.modalProductUrl;

    if (!modalId || !productHandle || !productUrl) return;

    debugLog('🔄 QuickATCLegacyAdapter: Converting legacy trigger', { modalId, productUrl });

    // Create web component wrapper
    const wrapper = document.createElement('quick-atc-trigger');
    wrapper.dataset.modalId = modalId;
    wrapper.dataset.productHandle = productHandle;
    wrapper.dataset.productUrl = productUrl;

    // Wrap the trigger element
    trigger.parentNode.insertBefore(wrapper, trigger);
    wrapper.appendChild(trigger);

    this.#processedElements.add(trigger);
  }

  #setupObserver() {
    this.#observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if the node itself is a trigger
              if (node.matches?.('[data-quick-atc-trigger]:not(quick-atc-trigger [data-quick-atc-trigger])')) {
                this.#wrapTrigger(node);
              }

              // Check for triggers within the node
              const triggers = node.querySelectorAll?.('[data-quick-atc-trigger]:not(quick-atc-trigger [data-quick-atc-trigger])');
              triggers?.forEach(trigger => this.#wrapTrigger(trigger));
            }
          });
        }
      }
    });

    this.#observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  destroy() {
    if (this.#observer) {
      this.#observer.disconnect();
      this.#observer = null;
    }
  }
}

// Initialize legacy adapter when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.quickATCLegacyAdapter = new QuickATCLegacyAdapter();
  });
} else {
  window.quickATCLegacyAdapter = new QuickATCLegacyAdapter();
}

// Global handler for quick-atc button clicks to show spinner
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-quick-atc-trigger]');
  if (button) {
    const iconElement = button.querySelector('[data-icon]');
    const spinnerElement = button.querySelector('[data-spinner]');

    if (iconElement && spinnerElement) {
      iconElement.classList.add('opacity-0');
      spinnerElement.classList.remove('hidden');
    }
  }
}, true);

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { QuickATCTrigger, QuickATCLegacyAdapter };
}
})();
(function () {
/**
 * ElectricDOMReady Web Component
 * 
 * Handles scripts that need to run when DOM is ready, particularly useful
 * for injected content where DOMContentLoaded has already fired.
 * This component runs initialization scripts when connected to the DOM.
 * 
 * @example
 * <electric-dom-ready></electric-dom-ready>
 */
class ElectricDOMReady extends HTMLElement {
  /** @type {boolean} Component connection state */
  #isConnected = false;
  
  /** @type {AbortController | null} Event listener controller */
  #abortController = null;
  
  /** @type {ResizeObserver | null} Resize observer instance */
  #resizeObserver = null;

  constructor() {
    super();
  }

  connectedCallback() {
    if (this.#isConnected) return;
    
    try {
      this.#isConnected = true;
      this.#abortController = new AbortController();
      this.#initializeAllScripts();
    } catch (error) {
      this.#handleError('Failed to initialize DOM ready scripts', error);
    }
  }

  disconnectedCallback() {
    this.#cleanup();
  }

  /**
   * Initialize all DOM-ready scripts
   * @private
   */
  #initializeAllScripts() {
    // Run all initialization scripts
    this.#handleClickOnLoadElements();
    this.#calculateFirstSectionMargin();
    this.#initializeLazyBlurImages();
    this.#adjustSliderOpacity();
  }

  /**
   * Handle elements that should be clicked on load
   * @private
   */
  #handleClickOnLoadElements() {
    try {
      const clickOnLoadElements = document.querySelectorAll(".click-on-load");
      clickOnLoadElements.forEach((element) => {
        // Add a small delay to ensure proper initialization
        requestAnimationFrame(() => {
          element.click();
        });
      });
    } catch (error) {
      this.#handleError('Failed to handle click-on-load elements', error);
    }
  }

  /**
   * Calculate and set first section margin CSS custom property
   * @private
   */
  #calculateFirstSectionMargin() {
    try {
      const firstSection = document.querySelector(
        "#MainContent .shopify-section:not(.shopify-section-group-header-group)",
      );
      
      if (!firstSection) return;
      
      const firstSectionMarginTop = parseInt(
        window.getComputedStyle(firstSection).marginTop,
      );
      
      document.body.style.setProperty(
        "--first-section-margin-top",
        `${firstSectionMarginTop}px`,
      );

      // Listen for section loads to recalculate
      document.addEventListener('shopify:section:load', () => {
        this.#calculateFirstSectionMargin();
      }, { signal: this.#abortController.signal });

    } catch (error) {
      this.#handleError('Failed to calculate first section margin', error);
    }
  }

  /**
   * Initialize lazy loading blur effect for images
   * @private
   */
  #initializeLazyBlurImages() {
    try {
      const images = document.querySelectorAll("img.js-lazyloadBlur");
      
      images.forEach((image) => {
        const placeholder = image.nextElementSibling;
        if (!placeholder) return;

        // Set up intersection observer for lazy loading
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                this.#loadBlurImage(image, placeholder);
                observer.unobserve(image);
              }
            });
          },
          {
            rootMargin: '50px',
            threshold: 0.1
          }
        );

        observer.observe(image);
      });
    } catch (error) {
      this.#handleError('Failed to initialize lazy blur images', error);
    }
  }

  /**
   * Load blur image with fade effect
   * @param {HTMLImageElement} image - Image element
   * @param {HTMLElement} placeholder - Placeholder element
   * @private
   */
  #loadBlurImage(image, placeholder) {
    try {
      image.addEventListener('load', () => {
        requestAnimationFrame(() => {
          image.style.opacity = '1';
          placeholder.style.opacity = '0';
          
          // Clean up placeholder after transition
          setTimeout(() => {
            if (placeholder.parentNode) {
              placeholder.parentNode.removeChild(placeholder);
            }
          }, 300);
        });
      }, { once: true });

      // Trigger load if not already loaded
      if (image.complete) {
        image.dispatchEvent(new Event('load'));
      }
    } catch (error) {
      this.#handleError('Failed to load blur image', error);
    }
  }

  /**
   * Adjust slider opacity based on content
   * @private
   */
  #adjustSliderOpacity() {
    try {
      const sliders = document.querySelectorAll('[data-slider-opacity]');
      
      sliders.forEach((slider) => {
        this.#setupSliderOpacityObserver(slider);
      });
    } catch (error) {
      this.#handleError('Failed to adjust slider opacity', error);
    }
  }

  /**
   * Set up resize observer for slider opacity adjustment
   * @param {HTMLElement} slider - Slider element
   * @private
   */
  #setupSliderOpacityObserver(slider) {
    try {
      if (!this.#resizeObserver) {
        this.#resizeObserver = new ResizeObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.target.hasAttribute('data-slider-opacity')) {
              this.#calculateSliderOpacity(entry.target);
            }
          });
        });
      }

      this.#resizeObserver.observe(slider);
      
      // Initial calculation
      this.#calculateSliderOpacity(slider);
    } catch (error) {
      this.#handleError('Failed to setup slider opacity observer', error);
    }
  }

  /**
   * Calculate and apply slider opacity
   * @param {HTMLElement} slider - Slider element
   * @private
   */
  #calculateSliderOpacity(slider) {
    try {
      const slides = slider.querySelectorAll('.slide');
      const visibleSlides = Array.from(slides).filter(slide => {
        const rect = slide.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });

      const opacity = Math.max(0.3, Math.min(1, visibleSlides.length / slides.length));
      slider.style.setProperty('--slider-opacity', opacity.toString());
    } catch (error) {
      this.#handleError('Failed to calculate slider opacity', error);
    }
  }

  /**
   * Handle errors gracefully with user feedback
   * @param {string} message - Error message
   * @param {Error} error - Original error object
   * @private
   */
  #handleError(message, error) {
    console.error(`ElectricDOMReady: ${message}`, error);
    
    this.dispatchEvent(new CustomEvent('electric:dom-ready-error', {
      detail: { message, error: error.message },
      bubbles: true
    }));
  }

  /**
   * Clean up resources and event listeners
   * @private
   */
  #cleanup() {
    this.#isConnected = false;
    
    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }
    
    if (this.#resizeObserver) {
      this.#resizeObserver.disconnect();
      this.#resizeObserver = null;
    }
  }
}

// Register the custom element
if (!customElements.get('electric-dom-ready')) {
  customElements.define('electric-dom-ready', ElectricDOMReady);
}
})();
(function () {
/**
 * FindMyCar Web Component
 * 
 * A lightweight search component for finding car types (collections).
 * Provides predictive search with debounced input handling and dropdown results.
 * 
 * @example
 * <find-my-car>
 *   <input type="text" placeholder="Search your car">
 * </find-my-car>
 */
class FindMyCar extends HTMLElement {
  /** @type {HTMLInputElement | null} Search input element */
  #input = null;

  /** @type {HTMLDivElement | null} Results dropdown container */
  #dropdown = null;

  /** @type {Object<string, string>} Cached search results */
  #cachedResults = {};

  /** @type {number | null} Debounce timer ID */
  #debounceTimer = null;

  /** @type {number} Debounce delay in milliseconds */
  #debounceDelay = 300;

  /** @type {AbortController | null} Fetch abort controller */
  #abortController = null;

  /** @type {boolean} Component connection state */
  #isConnected = false;

  /** @type {boolean} Whether dropdown is currently open */
  #isOpen = false;

  constructor() {
    super();
  }

  connectedCallback() {
    if (this.#isConnected) return;

    try {
      this.#isConnected = true;
      this.#initialize();
    } catch (error) {
      this.#handleError('Failed to initialize find-my-car component', error);
    }
  }

  disconnectedCallback() {
    this.#cleanup();
  }

  /**
   * Initialize the component
   * @private
   */
  #initialize() {
    this.#input = this.querySelector('input[type="text"]');
    
    if (!this.#input) {
      throw new Error('FindMyCar requires an input[type="text"] element');
    }

    this.#createDropdown();
    this.#setupEventListeners();
  }

  /**
   * Create the dropdown element
   * @private
   */
  #createDropdown() {
    this.#dropdown = document.createElement('div');
    this.#dropdown.className = 'absolute bg-white top-1/2 -left-px -right-px pt-8 max-h-80 overflow-y-auto hidden peer-focus:border-secondary border-transparent border-x border-b rounded-b-4xl';
    this.#dropdown.setAttribute('role', 'listbox');
    this.#dropdown.setAttribute('aria-label', 'Car search results');
    
    // Make the container relative for absolute positioning
    this.classList.add('relative', 'block');
    
    this.appendChild(this.#dropdown);
  }

  /**
   * Setup event listeners
   * @private
   */
  #setupEventListeners() {
    // Input events
    this.#input.addEventListener('input', this.#handleInput.bind(this));
    this.#input.addEventListener('focus', this.#handleFocus.bind(this));
    this.#input.addEventListener('keydown', this.#handleKeydown.bind(this));
    
    // Click outside to close
    document.addEventListener('click', this.#handleClickOutside.bind(this));
    
    // Escape key to close
    document.addEventListener('keydown', this.#handleEscape.bind(this));
  }

  /**
   * Handle input events
   * @param {Event} event - Input event
   * @private
   */
  #handleInput(event) {
    const query = this.#getQuery();
    
    // Clear debounce timer
    clearTimeout(this.#debounceTimer);
    
    // If empty, close dropdown
    if (!query) {
      this.#closeDropdown();
      return;
    }
    
    // Debounce the search
    this.#debounceTimer = setTimeout(() => {
      this.#performSearch(query);
    }, this.#debounceDelay);
  }

  /**
   * Handle focus events
   * @param {Event} event - Focus event
   * @private
   */
  #handleFocus(event) {
    const query = this.#getQuery();
    
    // If we have a query and cached results, show them
    if (query && this.#cachedResults[query.toLowerCase()]) {
      this.#renderResults(this.#cachedResults[query.toLowerCase()]);
      this.#openDropdown();
    }
  }

  /**
   * Handle keyboard navigation
   * @param {KeyboardEvent} event - Keyboard event
   * @private
   */
  #handleKeydown(event) {
    if (!this.#isOpen) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.#focusNextItem();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.#focusPreviousItem();
        break;
      case 'Enter':
        event.preventDefault();
        this.#selectFocusedItem();
        break;
      case 'Escape':
        event.preventDefault();
        this.#closeDropdown();
        this.#input.blur();
        break;
    }
  }

  /**
   * Handle click outside component
   * @param {MouseEvent} event - Click event
   * @private
   */
  #handleClickOutside(event) {
    if (!this.contains(event.target)) {
      this.#closeDropdown();
    }
  }

  /**
   * Handle escape key globally
   * @param {KeyboardEvent} event - Keyboard event
   * @private
   */
  #handleEscape(event) {
    if (event.key === 'Escape' && this.#isOpen) {
      this.#closeDropdown();
    }
  }

  /**
   * Get trimmed query from input
   * @returns {string} Trimmed query
   * @private
   */
  #getQuery() {
    return this.#input?.value.trim() || '';
  }

  /**
   * Perform search for collections
   * @param {string} query - Search query
   * @private
   */
  async #performSearch(query) {
    const queryKey = query.toLowerCase();
    
    // Check cache first
    if (this.#cachedResults[queryKey]) {
      this.#renderResults(this.#cachedResults[queryKey]);
      this.#openDropdown();
      return;
    }

    // Show loading state
    this.#showLoading();

    // Abort previous request if exists
    if (this.#abortController) {
      this.#abortController.abort();
    }

    this.#abortController = new AbortController();

    try {
      const response = await fetch(
        `${routes.predictive_search_url}?q=${encodeURIComponent(query)}&resources[type]=collection&section_id=api--search--predictive`,
        { signal: this.#abortController.signal }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const section = doc.querySelector('#shopify-section-api--search--predictive');

      if (section) {
        // Extract collections from the response
        const collections = this.#extractCollections(section);
        
        // Cache the results
        this.#cachedResults[queryKey] = collections;
        
        // Render results
        this.#renderResults(collections);
        this.#openDropdown();
      } else {
        this.#showNoResults();
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        // Request was aborted, ignore
        return;
      }
      
      this.#handleError('Failed to fetch search results', error);
      this.#showError();
    }
  }

  /**
   * Extract collections from search results
   * @param {HTMLElement} section - Section element containing results
   * @returns {Array<{title: string, url: string, handle: string}>} Array of collection objects
   * @private
   */
  #extractCollections(section) {
    const collections = [];
    const collectionElements = section.querySelectorAll('[data-collection-handle]');
    
    collectionElements.forEach(element => {
      const title = element.querySelector('[data-collection-title]')?.textContent?.trim() || 
                   element.textContent?.trim();
      const url = element.getAttribute('href') || 
                 element.querySelector('a')?.getAttribute('href');
      const handle = element.getAttribute('data-collection-handle');
      
      if (title && url && handle) {
        collections.push({ title, url, handle });
      }
    });

    // Fallback: try to find any links with collection URLs
    if (collections.length === 0) {
      const links = section.querySelectorAll('a[href*="/collections/"]');
      links.forEach(link => {
        const url = link.getAttribute('href');
        const title = link.textContent?.trim();
        const handle = url?.split('/collections/')[1]?.split('?')[0];
        
        if (title && url && handle) {
          collections.push({ title, url, handle });
        }
      });
    }

    return collections;
  }

  /**
   * Render search results in dropdown
   * @param {Array<{title: string, url: string, handle: string}>} collections - Collections to render
   * @private
   */
  #renderResults(collections) {
    if (!collections || collections.length === 0) {
      this.#showNoResults();
      return;
    }

    const html = collections.map((collection, index) => `
      <a
        href="${this.#escapeHtml(collection.url)}"
        class="block px-6 py-4 hover:bg-surface transition-colors duration-150 focus:bg-gray-100 focus:outline-none"
        role="option"
        data-collection-handle="${this.#escapeHtml(collection.handle)}"
        tabindex="-1"
      >
        <div class="font-medium text-primary">${this.#escapeHtml(collection.title)}</div>
      </a>
    `).join('');

    this.#dropdown.innerHTML = html;
    
    // Setup click handlers for collection items
    this.#dropdown.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', (e) => {
        this.#handleCollectionSelect(e, link);
      });
    });
  }

  /**
   * Handle collection selection
   * @param {Event} event - Click event
   * @param {HTMLElement} link - Selected link element
   * @private
   */
  #handleCollectionSelect(event, link) {
    const collectionHandle = link.getAttribute('data-collection-handle');
    const collectionTitle = link.textContent.trim();
    
    // Dispatch custom event
    this.dispatchEvent(new CustomEvent('collection:selected', {
      detail: {
        handle: collectionHandle,
        title: collectionTitle,
        url: link.getAttribute('href')
      },
      bubbles: true
    }));
    
    // Update input with selected value
    this.#input.value = collectionTitle;
    
    // Close dropdown
    this.#closeDropdown();
  }

  /**
   * Show loading state
   * @private
   */
  #showLoading() {
    this.#dropdown.innerHTML = `
      <div class="px-6 py-8 text-center text-secondary">
        <div class="inline-block w-5 h-5 border-2 border-primary-sub border-t-transparent rounded-full animate-spin"></div>
        <div class="mt-2">Searching...</div>
      </div>
    `;
    this.#openDropdown();
  }

  /**
   * Show no results message
   * @private
   */
  #showNoResults() {
    this.#dropdown.innerHTML = `
      <div class="px-6 py-8 text-center text-secondary">
        <div class="text-lg mb-2">🔍</div>
        <div>No cars found matching your search</div>
      </div>
    `;
    this.#openDropdown();
  }

  /**
   * Show error message
   * @private
   */
  #showError() {
    this.#dropdown.innerHTML = `
      <div class="px-6 py-8 text-center text-system-red">
        <div class="text-lg mb-2">⚠️</div>
        <div>Failed to load results. Please try again.</div>
      </div>
    `;
    this.#openDropdown();
  }

  /**
   * Open dropdown
   * @private
   */
  #openDropdown() {
    if (this.#isOpen) return;
    
    this.#dropdown.classList.remove('hidden');
    this.#isOpen = true;
    this.#input.setAttribute('aria-expanded', 'true');
    
    // Dispatch opened event
    this.dispatchEvent(new CustomEvent('dropdown:opened', {
      bubbles: true
    }));
  }

  /**
   * Close dropdown
   * @private
   */
  #closeDropdown() {
    if (!this.#isOpen) return;
    
    this.#dropdown.classList.add('hidden');
    this.#isOpen = false;
    this.#input.setAttribute('aria-expanded', 'false');
    
    // Dispatch closed event
    this.dispatchEvent(new CustomEvent('dropdown:closed', {
      bubbles: true
    }));
  }

  /**
   * Focus next item in dropdown
   * @private
   */
  #focusNextItem() {
    const items = Array.from(this.#dropdown.querySelectorAll('a'));
    const currentIndex = items.findIndex(item => item === document.activeElement);
    
    if (currentIndex === -1) {
      // Focus first item
      items[0]?.focus();
    } else if (currentIndex < items.length - 1) {
      // Focus next item
      items[currentIndex + 1]?.focus();
    } else {
      // Loop back to input
      this.#input?.focus();
    }
  }

  /**
   * Focus previous item in dropdown
   * @private
   */
  #focusPreviousItem() {
    const items = Array.from(this.#dropdown.querySelectorAll('a'));
    const currentIndex = items.findIndex(item => item === document.activeElement);
    
    if (currentIndex === -1 || currentIndex === 0) {
      // Focus input
      this.#input?.focus();
    } else {
      // Focus previous item
      items[currentIndex - 1]?.focus();
    }
  }

  /**
   * Select currently focused item
   * @private
   */
  #selectFocusedItem() {
    const focusedItem = this.#dropdown.querySelector('a:focus');
    
    if (focusedItem) {
      focusedItem.click();
    } else {
      // If no item is focused, close dropdown
      this.#closeDropdown();
    }
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped HTML
   * @private
   */
  #escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Handle errors gracefully
   * @param {string} message - Error message
   * @param {Error} error - Original error object
   * @private
   */
  #handleError(message, error) {
    console.error(`FindMyCar: ${message}`, error);
    
    this.dispatchEvent(new CustomEvent('search:error', {
      detail: { message, error: error.message },
      bubbles: true
    }));
  }

  /**
   * Clean up resources and event listeners
   * @private
   */
  #cleanup() {
    this.#isConnected = false;
    
    // Clear timers
    clearTimeout(this.#debounceTimer);
    this.#debounceTimer = null;
    
    // Abort pending requests
    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }
    
    // Remove event listeners
    document.removeEventListener('click', this.#handleClickOutside);
    document.removeEventListener('keydown', this.#handleEscape);
    
    // Clear cache
    this.#cachedResults = {};
  }
}

// Register the custom element
customElements.define('find-my-car', FindMyCar);
})();
// Main script file - imports all individual scripts


















function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

function fetchConfig(type = "json") {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: `application/${type}`,
    },
  };
}

function triggerEvent(element, name, data = {}) {
  window.events = window.events || {};
  if (!window.events[name]) {
    window.events[name] = debounce((element, name, data) => {
      element.dispatchEvent(
        new CustomEvent(name, {
          bubbles: true,
          detail: data,
        }),
      );
    }, 300);
  }
  window.events[name](element, name, data);
};
function delegate(parent, eventName, childSelector, callback) {
  if (typeof childSelector === "function") {
    callback = childSelector;
    childSelector = null;
  }
  const selector = childSelector
    ? childSelector
    : "." + [...parent.classList].join(".").replaceAll(":", "\\:");
  parent.addEventListener(eventName, (event) => {
    const target = event.target.closest(selector);
    if (target) {
      callback(event, target);
    }
  });
}


function getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      "summary, a[href], button:enabled, [tabindex]:not([tabindex^='-']), [draggable], area, input:not([type=hidden]):enabled, select:enabled, textarea:enabled, object, iframe",
    ),
  );
}

let trapFocusHandlers = {};

function trapFocus(container, elementToFocus = container) {
  var elements = getFocusableElements(container);
  var first = elements[0];
  var last = elements[elements.length - 1];

  removeTrapFocus();

  trapFocusHandlers.focusin = (event) => {
    if (
      event.target !== container &&
      event.target !== last &&
      event.target !== first
    )
      return;

    document.addEventListener("keydown", trapFocusHandlers.keydown);
  };

  trapFocusHandlers.focusout = function (e) {
    document.removeEventListener("keydown", trapFocusHandlers.keydown);
  };

  trapFocusHandlers.keydown = function (event) {
    if (event.code.toUpperCase() !== "TAB") return; // If not TAB key
    // On the last focusable element and tab forward, focus the first element.
    if (event.target === last && !event.shiftKey) {
      event.preventDefault();
      first.focus();
    }

    //  On the first focusable element and tab backward, focus the last element.
    if (
      (event.target === container || event.target === first) &&
      event.shiftKey
    ) {
      event.preventDefault();
      last.focus();
    }
  };

  document.addEventListener("focusout", trapFocusHandlers.focusout);
  document.addEventListener("focusin", trapFocusHandlers.focusin);

  elementToFocus.focus();
}

function removeTrapFocus(elementToFocus = null) {
  document.removeEventListener("focusin", trapFocusHandlers.focusin);
  document.removeEventListener("focusout", trapFocusHandlers.focusout);
  document.removeEventListener("keydown", trapFocusHandlers.keydown);

  if (elementToFocus) elementToFocus.focus();
}

function pauseAllMedia() {
  document.querySelectorAll(".js-youtube").forEach((video) => {
    video.contentWindow.postMessage(
      '{"event":"command","func":"' + "pauseVideo" + '","args":""}',
      "*",
    );
  });
  document.querySelectorAll(".js-vimeo").forEach((video) => {
    video.contentWindow.postMessage('{"method":"pause"}', "*");
  });
  document.querySelectorAll("video").forEach((video) => video.pause());
  document
    .querySelectorAll("model-viewer")
    .forEach((model) => model.modelViewerUI?.pause());
}

function pauseThisMedia(media) {
  if (media.tagName === "VIDEO") {
    media.pause();
  } else if (media.tagName === "IFRAME") {
    if (media.classList.contains("js-youtube")) {
      media.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "stopVideo", args: [] }),
        "*",
      );
    } else if (media.classList.contains("js-vimeo")) {
      media.contentWindow.postMessage('{"method":"pause"}', "*");
    }
  } else if (media.tagName === "MODEL-VIEWER") {
    media.modelViewerUI?.pause();
  }
}




// Convert the bg color to rgba format with specific opacity
function setOpacity(color, opacity) {
  // If it's a named color like 'white'
  if (!color.startsWith("oklch") && !color.startsWith("rgb")) {
    const tempDiv = document.createElement("div");
    tempDiv.style.color = color;
    document.body.appendChild(tempDiv);
    color = getComputedStyle(tempDiv).color;
    tempDiv.remove();
  }

  // Convert RGB to OKLCH if needed
  if (color.startsWith("rgb")) {
    const [r, g, b] = color.match(/\d+/g).map(Number);
    const rgbColor = `rgb(${r}, ${g}, ${b})`;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = rgbColor;
    color = ctx.fillStyle;
    canvas.remove();
  }

  // Extract OKLCH values
  const [l, c, h] = color.match(/[\d.]+/g).map(Number);
  return `oklch(${l} ${c} ${h} / ${opacity})`;
}

function getPathWithoutQuery(url) {
  return new URL(url, window.location.origin).pathname;
}


function replaceNodeWithNodeList(nodeToReplace, nodeList) {
  if (!(nodeList instanceof NodeList) && !Array.isArray(nodeList)) {
    throw new Error("Second argument must be a NodeList or an array of nodes");
  }

  const parent = nodeToReplace.parentNode;
  if (!parent) {
    throw new Error("Cannot replace a node that is not in the DOM");
  }

  const fragment = document.createDocumentFragment();

  // If it's an array, we need to iterate differently
  if (Array.isArray(nodeList)) {
    nodeList.forEach((node) => fragment.appendChild(node));
  } else {
    // NodeList is array-like but not an array, so we use this method
    fragment.append(...nodeList);
  }

  parent.replaceChild(fragment, nodeToReplace);
}




class SectionFetcher extends HTMLElement {
  static observedAttributes = [
    "data-url",
    "data-section-id",
    "data-selector",
    "data-animate",
    "data-fire-event",
    "data-onload",
    "data-load-on-event",
  ];

  constructor() {
    super();
    this.handlePopState = this.handlePopState.bind(this);
    this.debouncedCheckAndFetch = this.debounce(
      this.checkAndFetch.bind(this),
      250,
    );
    this.intersectionObserver = null;
  }

  connectedCallback() {
    this.setupInitialState();
    this.addEventListeners();
    this.reWriteData();
    if (this.dataset.onload === "true") {
      this.setupIntersectionObserver();
    }
  }

  disconnectedCallback() {
    this.removeEventListeners();
    this.removeIntersectionObserver();
  }

  setupIntersectionObserver() {
    const options = {
      rootMargin: "0px 0px 800px 0px",
      threshold: 0,
    };

    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && this.dataset.onload === "true") {
          queueMicrotask(() => this.checkAndFetch(true));
          this.removeIntersectionObserver();
        }
      });
    }, options);

    this.intersectionObserver.observe(this);
  }

  removeIntersectionObserver() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || name !== "data-url") return;
    this.debouncedCheckAndFetch(false, true);
  }

  setupInitialState() {
    const defaultUrl = new URL(window.location.href);
    defaultUrl.searchParams.delete("section_id");
    this.dataset.url = this.dataset.url || defaultUrl.toString();
    this.lastFetchedUrl = this.dataset.url || window.location.href;
  }

  addEventListeners() {
    if (!this.disablePopEvents) {
      window.addEventListener("popstate", this.handlePopState, {
        passive: true,
      });
    }
    if (this.dataset.loadOnEvent) {
      window.addEventListener(this.dataset.loadOnEvent, this.handlePopState, {
        passive: true,
      });
    }
  }

  removeEventListeners() {
    window.removeEventListener("popstate", this.handlePopState);
    if (this.dataset.loadOnEvent) {
      window.removeEventListener(this.dataset.loadOnEvent, this.handlePopState);
    }
  }

  handlePopState() {
    this.dataset.url = this.buildFetchUrl(window.location.href);
    this.debouncedCheckAndFetch(false);
  }

  async checkAndFetch(isInitialLoad = true, isAttributeChange) {
    const currentUrl = new URL(this.dataset.url, window.location.origin);
    const dataUrl = new URL(this.lastFetchedUrl, window.location.origin);

    const relevantParams = new Set([
      "sort_by",
      "page",
      "q",
      ...Array.from(dataUrl.searchParams.keys()).filter((key) =>
        key.startsWith("filter."),
      ),
      ...Array.from(currentUrl.searchParams.keys()).filter((key) =>
        key.startsWith("filter."),
      ),
    ]);

    let shouldFetch = isInitialLoad;

    for (const param of relevantParams) {
      const currentValues = currentUrl.searchParams.getAll(param);
      const dataValues = dataUrl.searchParams.getAll(param);

      if (param === "page" && currentValues[0] == 1 && dataValues.length === 0)
        return;

      if (JSON.stringify(currentValues) !== JSON.stringify(dataValues)) {
        shouldFetch = true;
        dataUrl.searchParams.delete(param); // Remove all existing values for this param
        currentValues.forEach((value) => {
          dataUrl.searchParams.append(param, value); // Add each value individually
        });
      }
    }

    if (shouldFetch) {
      const newUrl = dataUrl.toString();
      const fetchUrl = this.buildFetchUrl(newUrl);

      if (fetchUrl !== this.lastFetchedUrl) {
        this.lastFetchedUrl = fetchUrl;
        await this.fetchAndReplaceContent(fetchUrl, isAttributeChange);
        return true;
      }
    }
  }

  buildFetchUrl(url) {
    const fetchUrl = new URL(url, window.location.origin);
    fetchUrl.searchParams.set("section_id", this.dataset.sectionId);
    return fetchUrl.toString();
  }

  keepData() {
    if (!this.dataset.toKeep) return;
    window.temporaryDatas = window.temporaryDatas || {};
    window.temporaryDatas[this.id] = {};
    this.dataset.toKeep.split(",").forEach((data) => {
      window.temporaryDatas[this.id][data] = this.dataset[data];
    });
    setTimeout(() => (window.temporaryDatas = {}), 3000);
  }

  reWriteData() {
    if (!window.temporaryDatas || !window.temporaryDatas[this.id]) return;
    Object.entries(window.temporaryDatas[this.id]).forEach(([key, value]) => {
      this.dataset[key] = value;
    });
  }

  async fetchAndReplaceContent(url, isAttributeChange) {
    try {
      this.keepData();
      let newContent;
      if (
        window.temporaryFeeds &&
        window.temporaryFeeds[this.id] &&
        window.temporaryFeeds[this.id][this.dataset.url]
      ) {
        newContent = this.parseHTML(
          window.temporaryFeeds[this.id][this.dataset.url],
        );
        this.dataset.animate = "false";
      }

      if (!newContent) {
        const response = await this.fetchWithRetry(url);
        const html = await response.text();
        newContent = this.parseHTML(html);
        if (newContent === null) {
          this.remove();
          return;
        }
      }

      if (this.dataset.animate !== "false") {
        await this.animateTransition(newContent);
      } else {
        this.replaceWith(newContent);
      }

      this.fireCustomEvent(newContent);
      return true;
    } catch (error) {
      console.error("Error fetching content:", error);
    }
  }

  async fetchWithRetry(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url);
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        return response;
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * Math.pow(2, i)),
        );
      }
    }
  }

  parseHTML(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    return (
      doc.querySelector(`[data-section-id="${this.dataset.sectionId}"]`) ??
      doc.querySelector(`[data-section="${this.dataset.sectionId}"]`)
    );
  }

  async animateTransition(newContent) {
    await this.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 100,
    }).finished;

    this.replaceWith(newContent);

    this.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 100,
    });
  }

  replaceContent(newContent) {
    replaceNodeWithNodeList(this, newContent);
  }

  fireCustomEvent(newContent) {
    if (this.dataset.fireEvent) {
      const event = new CustomEvent(this.dataset.fireEvent, {
        bubbles: true,
        detail: {
          source: this.dataset.id,
          found: newContent.length > 0,
        },
      });
      this.dispatchEvent(event);
    }
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
}

customElements.define("section-fetcher", SectionFetcher);



if (!customElements.get("cart-dynamic")) {
  customElements.define(
    "cart-dynamic",
    class CartDynamic extends SectionFetcher {
      constructor() {
        super();
        this.disablePopEvents = true;
      }

      connectedCallback() {
        super.connectedCallback();
        document.addEventListener("cart:update", (e) => {
          if (e.detail.source !== "quantity-input") {
            // Build the fetch URL with the section_id parameter
            const fetchUrl = this.buildFetchUrl(window.location.href);
            this.fetchAndReplaceContent(fetchUrl);
          }
        });
      }

      modified(miliseconds = 1000) {
        this.dataset.modified = true;

        setTimeout(() => {
          this.removeAttribute("data-modified");
        }, miliseconds);
      }
    },
  );
}

// Ensure the cart page can switch to the empty-state layout after JS-driven removal.

// Only cart-delete dispatches a full cart payload in `e.detail.cart`.
if (!window.__voldtCartEmptyReloadBound) {
  window.__voldtCartEmptyReloadBound = true;
  document.addEventListener("cart:update", (e) => {
    try {
      if (window.location.pathname !== "/cart") return;
      const cart = e?.detail?.cart;
      if (!cart) return;
      const itemCount = Number(cart.item_count);
      if (Number.isFinite(itemCount) && itemCount === 0) {
        window.location.reload();
      }
    } catch (err) {
      // no-op: never break cart interactions due to telemetry errors
    }
  });
}

if (!window.__voldtCartCountSyncBound) {
  window.__voldtCartCountSyncBound = true;
  document.addEventListener("cart:update", (e) => {
    try {
      const itemCount = Number(e?.detail?.cart?.item_count);
      if (!Number.isFinite(itemCount)) return;

      document.querySelectorAll("[data-cart-item-count]").forEach((node) => {
        node.textContent = String(itemCount);
      });
    } catch (err) {
      // no-op: cart count sync should never block interactions
    }
  });
}

if (!customElements.get('cart-delete')) {
  customElements.define(
    'cart-delete',
    class CartDelete extends HTMLElement {
      /** @type {number | null} Line item ID to delete */
      #lineItemId = null;
      
      /** @type {boolean} Component connection state */
      #isConnected = false;
      
      /** @type {AbortController | null} Abort controller for fetch operations */
      #abortController = null;

      constructor() {
        super();
        this.deleteHandler = this.#onClick.bind(this);
      }

      connectedCallback() {
        if (this.#isConnected) return;
        
        try {
          this.#isConnected = true;
          this.#lineItemId = this.dataset.lineItemId;
          
          if (!this.#lineItemId) {
            this.#logError(new Error('Missing line-item-id data attribute'));
            return;
          }

          this.#initializeEventListeners();
        } catch (error) {
          this.#logError(error);
        }
      }

      disconnectedCallback() {
        this.#cleanup();
      }

      /**
       * Initialize event listeners for delete functionality
       * @private
       */
      #initializeEventListeners() {
        this.addEventListener('click', this.deleteHandler, { passive: false });
        this.addEventListener('keydown', this.#onKeydown.bind(this), { passive: false });
        
        // Set proper ARIA attributes for accessibility
        this.setAttribute('role', 'button');
        this.setAttribute('tabindex', '0');
        this.setAttribute('aria-label', 'Remove item from cart');
      }

      /**
       * Handle keyboard navigation for accessibility
       * @param {KeyboardEvent} event - Keyboard event
       * @private
       */
      #onKeydown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.#onClick(event);
        }
      }

      /**
       * Handle click events for cart item deletion
       * @param {Event} event - Click event
       * @private
       */
      async #onClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        if (this.dataset.state === 'loading') return;

        try {
          this.#setState('loading');
          
          // Get dynamic sections for updates
          const dynamicSectionsNodes = document.querySelectorAll('cart-dynamic');
          const sectionIds = dynamicSectionsNodes.length
            ? [...dynamicSectionsNodes].map((n) => n.dataset.sectionId)
            : [];

          // Prepare cart change request
          const config = this.#getFetchConfig('json');
          config.headers['X-Requested-With'] = 'XMLHttpRequest';
          
          const body = {
            id: this.#lineItemId,
            quantity: 0,
            sections: sectionIds.join(',')
          };

          config.body = JSON.stringify(body);

          // Abort any existing requests
          if (this.#abortController) {
            this.#abortController.abort();
          }
          
          this.#abortController = new AbortController();
          config.signal = this.#abortController.signal;

          const response = await fetch(`${routes.cart_change_url}`, config);
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }

          const data = await response.json();

          if (data.status) {
            this.#setState('error');
            this.#dispatchErrorEvent('Failed to remove item from cart', data.description);
            navigator.vibrate?.(100);
            return;
          }

          // When the last item is removed on the cart page, the surrounding page
          // markup (empty state) won't be re-rendered by section updates alone.
          // Match quantity-input behavior and reload to show the empty state.
          if (data.item_count === 0 && window.location.pathname === "/cart") {
            window.location.reload();
            return;
          }

          // Update dynamic sections if provided
          if (data.sections && dynamicSectionsNodes.length) {
            this.#updateDynamicSections(data.sections, dynamicSectionsNodes);
          }

          this.#setState('success');
          this.#dispatchSuccessEvent();
          navigator.vibrate?.(100);

          // Dispatch cart update event for other components
          // Note: Shopify's cart API returns the cart object directly, not nested
          this.dispatchEvent(new CustomEvent('cart:item-removed', {
            detail: { 
              lineItemId: this.#lineItemId,
              cart: data 
            },
            bubbles: true
          }));

          // Dispatch standard cart:update event for consistency
          document.dispatchEvent(new CustomEvent('cart:update', {
            detail: { 
              source: 'cart-delete',
              lineItemId: this.#lineItemId,
              cart: data 
            },
            bubbles: true
          }));

        } catch (error) {
          if (error.name === 'AbortError') return; // Request was cancelled
          
          this.#logError(error);
          this.#setState('error');
          this.#dispatchErrorEvent('Failed to remove item from cart', error.message);
          navigator.vibrate?.(100);
        }
      }

      /**
       * Update dynamic sections with new cart data
       * @param {Object} sections - Section HTML data from response
       * @param {NodeList} dynamicSectionsNodes - Dynamic section nodes to update
       * @private
       */
      #updateDynamicSections(sections, dynamicSectionsNodes) {
        [...dynamicSectionsNodes].forEach((node) => {
          const htmlString = sections[node.dataset.sectionId];
          if (!htmlString) return;
          
          try {
            const html = new DOMParser().parseFromString(htmlString, 'text/html');
            const updated = html.querySelector(
              `cart-dynamic[data-section-id='${node.dataset.sectionId}']`
            );
            
            if (!updated) return;
            
            // Update the node content and classes
            node.innerHTML = updated.innerHTML;
            node.className = updated.className;
            
            // Call lifecycle hook if present
            if (typeof node.modified === 'function') {
              node.modified();
            }
          } catch (parseError) {
            this.#logError(new Error(`Failed to parse section HTML: ${parseError.message}`));
          }
        });
      }

      /**
       * Set component state for visual feedback
       * @param {string} state - State to set ('loading', 'success', 'error')
       * @private
       */
      #setState(state) {
        this.dataset.state = state;
        
        switch (state) {
          case 'loading':
            this.setAttribute('aria-disabled', 'true');
            this.setAttribute('aria-label', 'Removing item...');
            break;
          case 'error':
            this.removeAttribute('aria-disabled');
            this.setAttribute('aria-label', 'Error removing item');
            // Reset state after delay
            setTimeout(() => this.removeAttribute('data-state'), 3000);
            break;
          case 'success':
            this.removeAttribute('aria-disabled');
            this.setAttribute('aria-label', 'Item removed successfully');
            // Reset state after delay
            setTimeout(() => this.removeAttribute('data-state'), 3000);
            break;
        }
      }

      /**
       * Dispatch success event for parent components
       * @private
       */
      #dispatchSuccessEvent() {
        this.dispatchEvent(new CustomEvent('cart-delete:success', {
          detail: { lineItemId: this.#lineItemId },
          bubbles: true
        }));
      }

      /**
       * Dispatch error event for parent components
       * @param {string} message - Error message
       * @param {string} details - Error details
       * @private
       */
      #dispatchErrorEvent(message, details) {
        this.dispatchEvent(new CustomEvent('cart-delete:error', {
          detail: { 
            message, 
            details, 
            lineItemId: this.#lineItemId 
          },
          bubbles: true
        }));
      }

      /**
       * Get fetch configuration for cart operations
       * @param {string} type - Response type ('json', 'javascript')
       * @returns {Object} Fetch configuration object
       * @private
       */
      #getFetchConfig(type = 'json') {
        // Prefer global fetchConfig if available
        try {
          if (typeof fetchConfig === 'function') return fetchConfig(type);
        } catch (_) {}
        
        return {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: `application/${type}`,
          },
        };
      }

      /**
       * Log errors with component context
       * @param {Error} error - Error to log
       * @private
       */
      #logError(error) {
        console.error(`[cart-delete] Line item ${this.#lineItemId}:`, error);
      }

      /**
       * Clean up resources and event listeners
       * @private
       */
      #cleanup() {
        this.#isConnected = false;
        
        if (this.#abortController) {
          this.#abortController.abort();
          this.#abortController = null;
        }
        
        this.removeEventListener('click', this.deleteHandler);
        this.removeEventListener('keydown', this.#onKeydown.bind(this));
      }
    }
  );
}

customElements.define(
  "eye-in-the-sky",
  class EyeInTheSky extends HTMLElement {
    constructor() {
      super();
      this.password = document.getElementById(this.dataset.target);
    }

    connectedCallback() {
      this.addEventListener("click", () => this.handleClick());
    }

    handleClick() {
      this.classList.toggle("active");
      const isPassword = this.password.type === "password";
      this.password.type = isPassword ? "text" : "password";
    }
  },
);

class CartNote extends HTMLElement {
  constructor() {
    super();

    this.addEventListener(
      "change",
      debounce((event) => {
        const body = JSON.stringify({ note: event.target.value });
        fetch(`${routes.cart_update_url}`, { ...fetchConfig(), ...{ body } });
      }, 300),
    );
  }
}

customElements.define("cart-note", CartNote);
if (!customElements.get("slider-component")) {
  class SliderComponent extends HTMLElement {
    constructor() {
      super();
      this.slider = this.querySelector("ul");
      this.sliderItems = this.querySelectorAll(".slider-items");
      this.sliderThumbnails = this.querySelectorAll("slider-thumbnails li");
      this.pageCount = this.querySelector(".slider-counter--current");
      this.pageTotal = this.querySelector(".slider-counter--total");
      this.prevButton = this.querySelector('button[aria-label="previous"]');
      this.nextButton = this.querySelector('button[aria-label="next"]');

      this.initThumbnails();

      this.lightbox = this.querySelector(".lightbox");
      if (this.lightbox) this.initLightbox();

      if (!this.slider || !this.nextButton) return;

      const resizeObserver = new ResizeObserver((entries) => this.initPages());
      resizeObserver.observe(this.slider);

      this.slider.addEventListener("scroll", this.update.bind(this));
      this.prevButton.addEventListener("click", this.onButtonClick.bind(this));
      this.nextButton.addEventListener("click", this.onButtonClick.bind(this));

      this.initVideoListeners();
    }

    initPages() {
      if (!this.sliderItems.length === 0) return;
      this.slidesPerPage = Math.floor(
        this.slider.clientWidth / this.sliderItems[0].clientWidth,
      );
      this.totalPages = this.sliderItems.length - this.slidesPerPage + 1;
      this.update();
    }

    initThumbnails() {
      this.sliderThumbnails.forEach((thumb, index) => {
        thumb.addEventListener("click", () => {
          this.slideTo(index);
        });
      });
    }

    initVideoListeners() {
      const videoElements = this.querySelectorAll(
        "video, .js-youtube, .js-vimeo",
      );
      videoElements.forEach((video) => {
        // is video intersecting
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) {
              pauseThisMedia(video);
            } else {
              if (video.tagName === "VIDEO" && video.autoplay) video.play();
            }
          });
        });
        observer.observe(video);
      });
    }

    update() {
      this.currentPage =
        Math.round(this.slider.scrollLeft / this.sliderItems[0].clientWidth) +
        1;

      const img = this.sliderItems[this.currentPage]?.querySelector("img");
      if (img && !img.complete) {
        const image = new Image();
        image.src = img.src;
        if (img.srcset) image.srcset = img.srcset;
      }

      if (this.currentPage === 1) {
        this.prevButton.setAttribute("disabled", true);
      } else {
        this.prevButton.removeAttribute("disabled");
      }

      if (this.currentPage === this.totalPages) {
        this.nextButton.setAttribute("disabled", true);
      } else {
        this.nextButton.removeAttribute("disabled");
      }

      if (!this.pageCount || !this.pageTotal) return;
      this.pageCount.textContent = this.currentPage;
      this.pageTotal.textContent = this.totalPages;
    }

    slideTo(index) {
      this.slider.scrollTo({
        left: this.sliderItems[0].clientWidth * index,
      });
    }

    onButtonClick(event) {
      event.preventDefault();
      const slideScrollPosition =
        event.currentTarget.name === "next"
          ? this.slider.scrollLeft + this.sliderItems[0].clientWidth
          : this.slider.scrollLeft - this.sliderItems[0].clientWidth;
      this.slider.scrollTo({
        left: slideScrollPosition,
      });
    }

    initLightbox() {
      this.lightboxSlider = this.lightbox.querySelector("slider-component ul");
      this.sliderItems.forEach((item, index) => {
        const trigger = item.classList.contains("js-lightbox")
          ? item
          : item.querySelector(".js-lightbox");
        trigger?.addEventListener("click", () => {
          this.lightbox.querySelector("fader-component").activate(index);
          this.lightbox.classList.replace("hidden", "fixed");
          // record the scroll position
          this.scrollPosition = window.scrollY;
          document.body.classList.add("fixed");
        });
      });

      this.slider.addEventListener("scroll", (e) => {
        this.lightboxSlider.scrollLeft =
          (this.slider.scrollLeft / this.slider.scrollWidth) *
          this.lightboxSlider.scrollWidth;
      });

      this.lightboxCloser = this.lightbox.querySelector("#close-lightbox");

      this.lightboxCloser.addEventListener("click", () => {
        document.body.classList.remove("fixed");
        pauseAllMedia();
        this.lightbox.classList.replace("fixed", "hidden");
        // instant scroll
        window.scrollTo({
          top: this.scrollPosition,
          behavior: "instant",
        });
      });
    }
  }

  customElements.define("slider-component", SliderComponent);
}

if (!customElements.get("fader-component")) {
  class FaderComponent extends HTMLElement {
    constructor() {
      super();
      this.sliderItems = this.querySelectorAll(".fader-item");
      this.sliderThumbnails = this.querySelectorAll(`fader-thumbnails li`);
      this.initThumbnails();
    }

    initThumbnails() {
      this.sliderThumbnails.forEach((thumb, index) => {
        thumb.addEventListener("click", () => {
          this.activate(index);
        });
      });
    }

    activate(index) {
      this.querySelectorAll(".fader-item img").forEach((img) => {
        if (img.complete) return;
        const image = new Image();
        image.src = img.src;
        if (img.srcset) image.srcset = img.srcset;
      });
      this.sliderItems.forEach((item) => item.classList.add("hidden"));
      this.sliderItems[index].classList.remove("hidden");
    }
  }

  customElements.define("fader-component", FaderComponent);
}

if (!customElements.get("video-player")) {
  class VideoPlayer extends HTMLElement {
    connectedCallback() {
      this.template = this.querySelector("template");
      this.button = this.querySelector("._playButton");
      
      this.loaders();
      this.setIframeAspectRatio();
    }

    loaders() {
      if (!this.template) {
        return;
      }
      
      // Check if video has autoplay attribute - load immediately
      const videoInTemplate = this.template.content.querySelector('video');
      const iframeInTemplate = this.template.content.querySelector('iframe');
      const hasAutoplay = videoInTemplate?.hasAttribute('autoplay') || 
                         (iframeInTemplate && (iframeInTemplate.src.includes('autoplay=1') || iframeInTemplate.src.includes('autoplay=true')));
      
      if (hasAutoplay && !this.button) {
        this.load();
        return;
      }
      
      if (this.button) {
        this.button.addEventListener("click", this.load.bind(this));
        return;
      }
      
      const observer = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this.load();
              observer.unobserve(this);
            }
          });
        },
        { threshold: 0, rootMargin: "400px" },
      );
      observer.observe(this);
    }

    load() {
      if (this.button) {
        this.style.height = this.getBoundingClientRect().height + "px";
        this.style.width = this.getBoundingClientRect().width + "px";
        this.stopAllVideos();
      }
      
      const clonedContent = this.template.content.cloneNode(true);
      
      this.appendChild(clonedContent);
      this.button?.classList.add("hidden");
      
      const videoElement = this.querySelector('video');

      // Setup video controls and play video
      if (videoElement) {
        // Remove native controls if present (we're using custom controls)
        videoElement.removeAttribute('controls');
        
        // Add cursor pointer to video so users know it's clickable
        videoElement.style.cursor = 'pointer';
        
        // Setup controls immediately (they'll be hidden until video plays)
        this.setupVideoControls(videoElement);
        
        // If this was triggered by play button click, play the video
        if (this.button) {
          // Play video immediately when play button is clicked
          const playPromise = videoElement.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {});
          }
        } else if (videoElement.hasAttribute('autoplay')) {
          // Autoplay video - ensure it plays
          
          // Try to play immediately if ready, otherwise wait for canplay event
          if (videoElement.readyState >= 3) { // HAVE_FUTURE_DATA or higher
            this.playVideo(videoElement);
          } else {
            videoElement.addEventListener('canplay', () => {
              this.playVideo(videoElement);
            }, { once: true });
          }
        }
      }

      setTimeout(() => {
        this.style.height = "";
        this.style.width = "";
      }, 1000);
    }

    setupVideoControls(videoElement) {
      const controls = this.querySelector('._videoControls');
      if (!controls) {
        return;
      }

      const pausePlayButton = controls.querySelector('._pausePlayButton');
      const muteButton = controls.querySelector('._muteButton');
      const pauseIcon = controls.querySelector('._pauseIcon');
      const playIcon = controls.querySelector('._playIcon');
      const volumeIcon = controls.querySelector('._volumeIcon');
      const muteIcon = controls.querySelector('._muteIcon');

      if (!pausePlayButton || !muteButton) {
        return;
      }

      // Keep controls hidden initially - they'll show after video starts
      controls.classList.add('opacity-0');
      controls.classList.remove('opacity-100');
      controls.style.pointerEvents = 'auto'; // Always allow clicks even when hidden

      // Track if video has started playing
      let videoHasStarted = false;
      const markVideoStarted = () => {
        videoHasStarted = true;
        // Show controls when video starts
        controls.classList.remove('opacity-0');
        controls.classList.add('opacity-100');
      };
      videoElement.addEventListener('play', markVideoStarted, { once: true });
      // Also check if video is already playing or has played
      if (!videoElement.paused || videoElement.currentTime > 0) {
        videoHasStarted = true;
        controls.classList.remove('opacity-0');
        controls.classList.add('opacity-100');
      }

      // Show controls on hover (only after video has started)
      const showControlsOnHover = () => {
        if (videoHasStarted) {
          controls.classList.remove('opacity-0');
          controls.classList.add('opacity-100');
        }
      };

      const hideControlsOnLeave = () => {
        // Keep controls visible after video starts, only hide when mouse leaves
        if (videoHasStarted) {
          controls.classList.remove('opacity-100');
          controls.classList.add('opacity-0');
        }
      };

      // Show on hover over video player
      this.addEventListener('mouseenter', showControlsOnHover);
      this.addEventListener('mouseleave', hideControlsOnLeave);
      
      // Also show controls when hovering directly on controls
      controls.addEventListener('mouseenter', () => {
        if (videoHasStarted) {
          controls.classList.remove('opacity-0');
          controls.classList.add('opacity-100');
        }
      });
      
      controls.addEventListener('mouseleave', () => {
        // Check if we're still hovering over the video player
        setTimeout(() => {
          if (!this.matches(':hover')) {
            hideControlsOnLeave();
          }
        }, 50);
      });

      // Click on video element to pause/play
      videoElement.addEventListener('click', (e) => {
        // Don't toggle if clicking on controls
        const clickedControls = e.target.closest('._videoControls');
        if (clickedControls) {
          return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        
        if (videoElement.paused) {
          videoElement.play().catch(() => {});
        } else {
          videoElement.pause();
        }
      });

      // Pause/Play toggle button
      pausePlayButton.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        if (videoElement.paused) {
          videoElement.play().catch(() => {});
        } else {
          videoElement.pause();
        }
      });

      // Mute/Unmute toggle button
      muteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        videoElement.muted = !videoElement.muted;
        
        if (videoElement.muted) {
          volumeIcon.classList.add('hidden');
          muteIcon.classList.remove('hidden');
          muteButton.setAttribute('aria-label', 'Unmute video');
        } else {
          volumeIcon.classList.remove('hidden');
          muteIcon.classList.add('hidden');
          muteButton.setAttribute('aria-label', 'Mute video');
        }
      });

      // Update pause/play button icon when video state changes
      const updatePlayPauseIcon = () => {
        if (videoElement.paused) {
          pauseIcon.classList.add('hidden');
          playIcon.classList.remove('hidden');
          pausePlayButton.setAttribute('aria-label', 'Play video');
        } else {
          pauseIcon.classList.remove('hidden');
          playIcon.classList.add('hidden');
          pausePlayButton.setAttribute('aria-label', 'Pause video');
        }
      };

      videoElement.addEventListener('play', updatePlayPauseIcon);
      videoElement.addEventListener('pause', updatePlayPauseIcon);
      
      // Initialize icon state
      updatePlayPauseIcon();

      // Initialize mute icon state
      if (videoElement.muted) {
        volumeIcon.classList.add('hidden');
        muteIcon.classList.remove('hidden');
        muteButton.setAttribute('aria-label', 'Unmute video');
      } else {
        volumeIcon.classList.remove('hidden');
        muteIcon.classList.add('hidden');
        muteButton.setAttribute('aria-label', 'Mute video');
      }
    }

    playVideo(videoElement) {
      const playPromise = videoElement.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay was prevented, usually due to browser policy
          // This is expected behavior on some browsers/contexts
        });
      }
    }

    stopAllVideos() {
      const videos = document.querySelectorAll("video");
      videos.forEach((video) => {
        if (video !== this.querySelector("video") && !video.autoplay) {
          video.pause();
        }
      });

      const iframes = document.querySelectorAll("iframe");
      iframes.forEach((iframe) => {
        if (iframe !== this.querySelector("iframe")) {
          iframe.contentWindow.postMessage(
            JSON.stringify({ event: "command", func: "pauseVideo" }),
            "*",
          );
        }
      });
    }
    async setIframeAspectRatio() {
      if (!this.template) {
        return;
      }
      
      const iframe = this.template.content.querySelector("iframe");
      if (!iframe) {
        return;
      }
      
      if (iframe.src.includes("youtube")) {
        return;
      }
      
      const { width, height } = await this.getIframeWidthHeight(iframe);
      iframe.style.aspectRatio = `${width}/${height}`;
      
      if (this.querySelector("iframe")) {
        this.querySelector("iframe").style.aspectRatio = `${width}/${height}`;
        this.style.setProperty("--aspect-ratio", `${width} / ${height}`);
      }
    }
    
    async getIframeWidthHeight(iframe) {
      let url = `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${iframe.dataset.videoId}`;
      const { width, height } = await fetch(url).then((resp) => resp.json());
      return { width, height };
    }
  }
  customElements.define("video-player", VideoPlayer);
}
if (!customElements.get("pagination-element")) {
  class PaginationElement extends HTMLElement {
    connectedCallback() {
      if (!this.hasAttribute("data-section-fetcher-target")) return;
      this.sectionFetcherTarget = document.getElementById(
        this.dataset.sectionFetcherTarget,
      );
      this.querySelectorAll("a").forEach((link) => {
        // create new href from a href with sectionFetcherTarget's data-section-id value as a parameter to query key section_id
        const newHref = new URL(link.href);
        newHref.searchParams.set(
          "section_id",
          this.sectionFetcherTarget.dataset.sectionId,
        );
        link.href = newHref.toString();
      });
      delegate(this, "click", "a", this.onLinkClicked.bind(this));
      window.addEventListener("popstate", (event) => {
        this.handlePopState(event);
      });
    }

    handlePopState(event) {
      const page = event.state && event.state.page ? event.state.page : "1";

      const target = this.querySelector(`a[data-page="${page}"]`);

      if (target) {
        this.onLinkClicked(new Event("click"), target, true);
      }
    }

    onLinkClicked(event, target, isPopState = false) {
      event.preventDefault();

      const page = target.getAttribute("data-page");
      const searchParams = new URLSearchParams(window.location.search);
      target.style.position =
        getComputedStyle(target).position === "absolute" ? "" : "relative";
      target.innerHTML += window.icons.spinner;

      if (page === "1") {
        searchParams.delete("page");
      } else {
        searchParams.set("page", page);
      }

      const newUrl = `${window.location.pathname}${
        searchParams.toString() ? "?" + searchParams.toString() : ""
      }`;

      // if isPopState is false and the section fetcher url is the same with our current url, push a new state
      // this is to prevent pushing a new url state if we are on homepage etc.
      const targetPath = getPathWithoutQuery(
        this.sectionFetcherTarget.dataset.url,
      );
      const currentPath = getPathWithoutQuery(window.location.href);
      if (!isPopState && targetPath === currentPath) {
        window.history.pushState({ page: page }, "", newUrl);
      }

      triggerEvent(this, "pagination:page-changed", {
        searchParams: searchParams.toString(),
        sectionFetcherTarget: this.sectionFetcherTarget.id,
      });

      this.sectionFetcherTarget.dataset.skeletonItems =
        target.dataset.nextItems;
      this.sectionFetcherTarget.dataset.url = `${targetPath}${
        searchParams.toString() ? "?" + searchParams.toString() : ""
      }`;
    }
  }

  window.customElements.define("pagination-element", PaginationElement);
}

class GradientFinish extends HTMLElement {
  connectedCallback() {
    // reduce opacity when scroll of parent reaches end, parent could be vertical or horizontal scroll
    this.slider = document.querySelector(
      `[data-slider="${this.dataset.sliderTarget}"]`,
    );
    // find parent that has a class starting with bg-
    if (!this.slider) {
      this.remove();
      return;
    }

    // initial adjustment
    this.adjustColor();

    // Opacity adjustment is now handled by electric-dom-ready component
    // Set data attribute for the component to handle this slider
    this.slider.setAttribute('data-slider-opacity', 'true');

    // adjust opacity on scroll
    this.slider.addEventListener("scroll", this.adjustOpacity.bind(this));

    // adjust opacity on resize
    window.addEventListener(
      "resize",
      debounce(this.adjustOpacity.bind(this), 100),
    );
    // adjust opacity on resize
    window.addEventListener(
      "resize",
      debounce(this.adjustColor.bind(this), 400),
    );
  }

  adjustColor() {
    let bgParentWithStyle = this.parentElement.closest("[class*='bg-']");
    if (
      bgParentWithStyle &&
      getComputedStyle(bgParentWithStyle).backgroundColor === "rgba(0, 0, 0, 0)"
    ) {
      bgParentWithStyle =
        bgParentWithStyle.parentElement.closest("[class*='bg-']");
    }
    let bg = bgParentWithStyle
      ? getComputedStyle(bgParentWithStyle).backgroundColor
      : "white";
    this.style.setProperty("--from-bg", setOpacity(bg, 0.0));
    this.style.setProperty("--to-bg", setOpacity(bg, 1));
  }

  adjustOpacity() {
    const isVertical = this.slider.scrollHeight > this.slider.clientHeight;
    const isHorizontal = this.slider.scrollWidth > this.slider.clientWidth;

    let ratio = 1;

    if (isVertical) {
      const scrollEnd = this.slider.scrollHeight - this.slider.clientHeight;
      ratio = scrollEnd > 0 ? this.slider.scrollTop / scrollEnd : 1;
    } else if (isHorizontal) {
      const scrollEnd = this.slider.scrollWidth - this.slider.clientWidth;
      ratio = scrollEnd > 0 ? this.slider.scrollLeft / scrollEnd : 1;
    }

    this.style.opacity = ratio == 1 ? 0 : 1;
  }
}
customElements.define("gradient-finish", GradientFinish);

class ProductCard extends HTMLElement {
  connectedCallback() {
    let image = this.querySelector("img.js-lazyloadBlur");
    let placeholder = this.querySelector(".js-lazyloadBlurPlaceholder");
    if (!placeholder) return;
    if (image.complete) {
      placeholder.style.opacity = 0;
      setTimeout(() => {
        placeholder.remove();
      }, 100);
      return;
    }
    image.addEventListener("load", () => {
      placeholder.style.opacity = 0;
      setTimeout(() => {
        placeholder.remove();
      }, 100);
    });
  }
}
customElements.define("product-card", ProductCard);

if (!customElements.get("scroll-top")) {
  customElements.define(
    "scroll-top",
    class extends HTMLElement {
      connectedCallback() {
        window.addEventListener("scroll", this.toggle.bind(this));
      }
      disconnectedCallback() {
        window.removeEventListener("scroll", this.toggle.bind(this));
      }
      toggle() {
        this.dataset.fadeIn = window.scrollY > 200 ? true : false;
      }
    },
  );
}

if (!customElements.get("quantity-input")) {
  class QuantityInput extends HTMLElement {
    connectedCallback() {
      this.input = this.querySelector('input[name="quantity"]');
      this.changeEvent = new Event("change", { bubbles: true });
      this.form = this.querySelector("form");
      this.quantityDisplay = this.querySelector("[data-quantity-display]");

      this.querySelectorAll("button").forEach((button) =>
        button.addEventListener("click", this.onButtonClick.bind(this)),
      );
      this.input.addEventListener("change", this.onInputChange.bind(this));
    }

    onButtonClick(event) {
      event.preventDefault();
      this.previousValue = this.input?.value;

      event.currentTarget.ariaLabel === "plus"
        ? this.input.stepUp()
        : this.input.stepDown();

      if (this.dataset.mode == "qty") return;

      if (this.previousValue !== this.input.value)
        this.input.dispatchEvent(this.changeEvent);
      this.querySelector(".hide-when-spinner")?.classList.add("opacity-0");
      const spinner = this.querySelector(".spinner");
      if (spinner) {
        spinner.classList.remove("hidden");
        spinner.querySelector("svg").classList.add("animate-spin");
      }

      document.querySelectorAll(".cart-spinner").forEach((spinner) => {
        spinner.classList.remove("hidden");
      });
    }

    onInputChange(event) {
      const config = fetchConfig("javascript");
      config.headers["X-Requested-With"] = "XMLHttpRequest";
      delete config.headers["Content-Type"];

      const formData = new FormData(this.form);

      this.dynamicSectionsNodes = document.querySelectorAll("cart-dynamic");

      let dynamicSections = [];
      if (this.dynamicSectionsNodes) {
        dynamicSections = [...this.dynamicSectionsNodes].map(
          (item) => item.dataset.sectionId,
        );
      }

      formData.append("sections", dynamicSections.join(","));
      config.body = formData;

      let url =
        this.dataset.quantity == 0
          ? routes.cart_add_url
          : routes.cart_change_url;

      fetch(url, config)
        .then((response) => response.json())
        .then((response) => {
          if (response.status === 422) {
            this.input.value = this.previousValue;
            this.handleErrorMessage(response.message);
          }
          if (
            response.item_count === 0 &&
            window.location.pathname === "/cart"
          ) {
            window.location.reload();
          }

          this.response = response;

          let cartItem =
            this.dataset.quantity == 0
              ? response
              : response.items.find(
                  (item) => item.variant_id == this.dataset.id,
                );

          this.dataset.quantity = cartItem ? cartItem.quantity : 0;
          this.quantityDisplay.innerText = this.dataset.quantity;

          this.updateClones();

          // update dynamic sections
          this.dynamicSectionsNodes.forEach((node) => {
            const htmlString = this.response.sections[node.dataset.sectionId];
            const html = new DOMParser().parseFromString(
              htmlString,
              "text/html",
            );
            node.animate([{ opacity: 0 }, { opacity: 1 }], {
              duration: 150,
              easing: "ease-in-out",
              fill: "forwards",
            });
            node.innerHTML = html.querySelector(
              `cart-dynamic[data-section-id='${node.dataset.sectionId}']`,
            ).innerHTML;
            node.classList = html.querySelector(
              `cart-dynamic[data-section-id='${node.dataset.sectionId}']`,
            ).classList;
            node.animate([{ opacity: 0 }, { opacity: 1 }], {
              duration: 150,
              easing: "ease-in-out",
              fill: "forwards",
            });
            node.modified();
          });

          // if the cart is updated, trigger the event
          // add the tag name of this
          triggerEvent(document, "cart:update", {
            source: this.tagName.toLowerCase(),
            found: response.item_count > 0,
          });
        })
        .catch((e) => {
          console.error(e);
        })
        .finally(() => {
          const spinner = this.querySelector(".spinner");
          if (spinner) {
            spinner.classList.add("hidden");
            spinner.querySelector("svg").classList.remove("animate-spin");
          }
          this.querySelector(".hide-when-spinner")?.classList.remove(
            "opacity-0",
          );
          document.querySelectorAll(".cart-spinner").forEach((spinner) => {
            spinner.classList.add("hidden");
          });
        });
    }

    updateClones() {
      const clones = document.querySelectorAll(
        `quantity-input[data-id="${this.dataset.id}"]:not([data-mode="qty"])`,
      );

      for (const clone of clones) {
        if (clone == this) continue;
        if (clone.dataset.linkMode == "true") continue;

        clone.dataset.quantity = this.dataset.quantity;
        clone.quantityDisplay.innerText = this.dataset.quantity;
        clone.input.value = this.dataset.quantity;
      }
    }

    handleErrorMessage(errorMessage = false) {
      this.errorMessageWrappers =
        this.errorMessageWrappers || this.querySelectorAll("error-message");

      this.errorMessageWrappers.forEach((errorMessageWrapper) => {
        if (errorMessage) {
          const errorMessageOutput = errorMessageWrapper.querySelector("span");
          errorMessageOutput.textContent = errorMessage;
          errorMessageWrapper.classList.remove("hidden");
          setTimeout(() => {
            errorMessageWrapper.classList.add("hidden");
          }, 3000);
        } else {
          errorMessageWrapper.classList.add("hidden");
        }
      });
      throw new Error(errorMessage);
    }
  }
  customElements.define("quantity-input", QuantityInput);
}

// Click-on-load functionality is now handled by electric-dom-ready component
// This ensures it works even when scripts are injected after DOM is ready

/**
 * Mobile Popover System
 * 
 * Handles lightweight mobile popovers that appear below trigger elements
 * and disappear when clicking anywhere or clicking the trigger again.
 * Uses CSS-only animations for smooth performance.
 */
class MobilePopoverManager {
  /** @type {HTMLElement | null} Currently open popover */
  #currentPopover = null;
  /** @type {HTMLElement | null} Currently active trigger */
  #currentTrigger = null;
  /** @type {AbortController | null} Event listener controller */
  #abortController = null;

  constructor() {
    this.#initialize();
  }

  /**
   * Initialize the popover system
   * @private
   */
  #initialize() {
    this.#setupEventListeners();
  }

  /**
   * Setup event listeners for popover triggers and document clicks
   * @private
   */
  #setupEventListeners() {
    this.#abortController = new AbortController();
    
    // Handle popover triggers
    document.addEventListener('click', this.#handleTriggerClick.bind(this), {
      signal: this.#abortController.signal
    });
    
    // Handle document clicks to close popovers
    document.addEventListener('click', this.#handleDocumentClick.bind(this), {
      signal: this.#abortController.signal
    });
    
    // Handle escape key to close popovers
    document.addEventListener('keydown', this.#handleKeydown.bind(this), {
      signal: this.#abortController.signal
    });
  }

  /**
   * Handle clicks on popover trigger elements
   * @param {Event} event - Click event
   * @private
   */
  #handleTriggerClick(event) {
    const trigger = event.target.closest('[data-popover-trigger]');
    if (!trigger) return;

    event.preventDefault();
    event.stopPropagation();

    const popoverId = trigger.dataset.popoverTrigger;
    const popover = document.getElementById(popoverId);
    
    if (!popover) return;

    // If clicking the same trigger, toggle the popover
    if (this.#currentTrigger === trigger && this.#currentPopover === popover) {
      this.#closePopover();
      return;
    }

    // Close any existing popover
    this.#closePopover();

    // Open the new popover
    this.#openPopover(popover, trigger);
  }

  /**
   * Handle document clicks to close popovers
   * @param {Event} event - Click event
   * @private
   */
  #handleDocumentClick(event) {
    // Don't close if clicking inside the popover or on the trigger
    if (event.target.closest('[data-popover]') || 
        event.target.closest('[data-popover-trigger]')) {
      return;
    }

    this.#closePopover();
  }

  /**
   * Handle keyboard events (escape key)
   * @param {Event} event - Keydown event
   * @private
   */
  #handleKeydown(event) {
    if (event.key === 'Escape') {
      this.#closePopover();
    }
  }

  /**
   * Open a popover
   * @param {HTMLElement} popover - Popover element to open
   * @param {HTMLElement} trigger - Trigger element that opened the popover
   * @private
   */
  #openPopover(popover, trigger) {
    this.#currentPopover = popover;
    this.#currentTrigger = trigger;

    // Show the popover with animation
    popover.style.opacity = '1';
    popover.style.pointerEvents = 'auto';
    
    // Add active state to trigger
    trigger.setAttribute('aria-expanded', 'true');
    
    // Dispatch custom event
    popover.dispatchEvent(new CustomEvent('popover:opened', {
      detail: { trigger, popover },
      bubbles: true
    }));
  }

  /**
   * Close the currently open popover
   * @private
   */
  #closePopover() {
    if (!this.#currentPopover || !this.#currentTrigger) return;

    // Hide the popover with animation
    this.#currentPopover.style.opacity = '0';
    this.#currentPopover.style.pointerEvents = 'none';
    
    // Remove active state from trigger
    this.#currentTrigger.setAttribute('aria-expanded', 'false');
    
    // Dispatch custom event
    this.#currentPopover.dispatchEvent(new CustomEvent('popover:closed', {
      detail: { trigger: this.#currentTrigger, popover: this.#currentPopover },
      bubbles: true
    }));

    // Clear references
    this.#currentPopover = null;
    this.#currentTrigger = null;
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.#closePopover();
    this.#abortController?.abort();
    this.#abortController = null;
  }
}

// Initialize mobile popover system
const mobilePopoverManager = new MobilePopoverManager();


class MenuDrawer extends HTMLElement {
  constructor() {
    super();

    this.mainDetailsToggle = this.querySelector("details");

    this.addEventListener("keyup", this.onKeyUp.bind(this));
    this.addEventListener("focusout", this.onFocusOut.bind(this));
    this.bindEvents();
    
    // Listen for search events to close drawer
    this.boundSearchOpenedHandler = this.#handleSearchOpened.bind(this);
    document.addEventListener('search:opened', this.boundSearchOpenedHandler);
  }

  bindEvents() {
    this.querySelectorAll("summary").forEach((summary) =>
      summary.addEventListener("click", this.onSummaryClick.bind(this)),
    );
    this.querySelectorAll("button:not(.dropdown-trigger)").forEach((button) =>
      button.addEventListener("click", this.onCloseButtonClick.bind(this)),
    );
  }

  onKeyUp(event) {
    if (event.code.toUpperCase() !== "ESCAPE") return;

    const openDetailsElement =
      event.target.parentElement.closest("details[open]");
    if (!openDetailsElement) return;

    openDetailsElement === this.mainDetailsToggle
      ? this.closeMenuDrawer(
          event,
          this.mainDetailsToggle.querySelector("summary"),
        )
      : this.closeSubmenu(openDetailsElement);
  }

  onSummaryClick(event) {
    const summaryElement = event.currentTarget;
    const detailsElement = summaryElement.parentNode;
    const parentMenuElement =
      detailsElement.parentElement.closest(".has-submenu");
    const isOpen = detailsElement.hasAttribute("open");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const input = summaryElement.querySelector("input");
    if (input) input.checked = !input.checked;

    function addTrapFocus() {
      trapFocus(
        summaryElement.nextElementSibling,
        detailsElement.querySelector("button"),
      );
      summaryElement.nextElementSibling.removeEventListener(
        "transitionend",
        addTrapFocus,
      );
    }

    if (detailsElement === this.mainDetailsToggle) {
      if (isOpen) event.preventDefault();
      isOpen
        ? this.closeMenuDrawer(event, summaryElement)
        : this.openMenuDrawer(summaryElement);

      if (window.matchMedia("(max-width: 990px)")) {
        document.documentElement.style.setProperty(
          "--viewport-height",
          `${window.innerHeight}px`,
        );
      }
    } else {
      setTimeout(() => {
        detailsElement.classList.add("menu-opening");
        summaryElement.setAttribute("aria-expanded", true);
        parentMenuElement && parentMenuElement.classList.add("submenu-open");
        !reducedMotion || reducedMotion.matches
          ? addTrapFocus()
          : summaryElement.nextElementSibling.addEventListener(
              "transitionend",
              addTrapFocus,
            );
      }, 1);
    }
  }

  openMenuDrawer(summaryElement) {
    setTimeout(() => {
      this.mainDetailsToggle.classList.add("menu-opening");
    });
    summaryElement.setAttribute("aria-expanded", true);
    trapFocus(this.mainDetailsToggle, summaryElement);
    document.body.classList.add(`overflow-hidden`);
  }

  closeMenuDrawer(event, elementToFocus = false) {
    if (event === undefined) return;

    // this.mainDetailsToggle.removeAttribute("open");
    this.mainDetailsToggle.classList.remove("menu-opening");
    this.mainDetailsToggle.querySelectorAll("details").forEach((details) => {
      details.removeAttribute("open");
      details.classList.remove("menu-opening");
    });
    this.mainDetailsToggle
      .querySelectorAll(".submenu-open")
      .forEach((submenu) => {
        submenu.classList.remove("submenu-open");
      });
    document.body.classList.remove(`overflow-hidden`);
    removeTrapFocus(elementToFocus);
    this.closeAnimation(this.mainDetailsToggle);

    if (event instanceof KeyboardEvent)
      elementToFocus?.setAttribute("aria-expanded", false);
  }

  onFocusOut(e) {
    setTimeout(() => {
      if (
        this.mainDetailsToggle.hasAttribute("open") &&
        !this.mainDetailsToggle.contains(document.activeElement)
      )
        this.closeMenuDrawer();
    });
  }

  onCloseButtonClick(event) {
    const detailsElement = event.currentTarget.parentElement.closest("details");
    this.closeSubmenu(detailsElement);
  }

  closeSubmenu(detailsElement) {
    const parentMenuElement =
      detailsElement.parentElement.closest(".submenu-open");
    parentMenuElement && parentMenuElement.classList.remove("submenu-open");
    detailsElement.classList.remove("menu-opening");
    detailsElement
      .querySelector("summary")
      .setAttribute("aria-expanded", false);
    removeTrapFocus(detailsElement.querySelector("summary"));
    this.closeAnimation(detailsElement);
  }

  closeAnimation(detailsElement) {
    let animationStart;

    const handleAnimation = (time) => {
      if (animationStart === undefined) {
        animationStart = time;
      }

      const elapsedTime = time - animationStart;

      if (elapsedTime < 1) {
        window.requestAnimationFrame(handleAnimation);
      } else {
        detailsElement.removeAttribute("open");
        if (detailsElement.parentElement.closest("details[open]")) {
          trapFocus(
            detailsElement.parentElement.closest("details[open]"),
            detailsElement.querySelector("summary"),
          );
        }
      }
    };

    window.requestAnimationFrame(handleAnimation);
  }

  /**
   * Handle search opened event by closing the drawer
   * @param {CustomEvent} event - The search opened event
   * @private
   */
  #handleSearchOpened(event) {
    // Check if drawer is open and close it
    if (this.mainDetailsToggle && this.mainDetailsToggle.hasAttribute('open')) {
      const summaryElement = this.mainDetailsToggle.querySelector('summary');
      this.closeMenuDrawer(event, summaryElement);
    }
  }

  /**
   * Cleanup event listeners when element is removed
   */
  disconnectedCallback() {
    if (this.boundSearchOpenedHandler) {
      document.removeEventListener('search:opened', this.boundSearchOpenedHandler);
    }
  }
}

customElements.define("menu-drawer", MenuDrawer);
/**
 * HeaderDrawer - Mobile menu drawer component for header navigation
 * 
 * Extends MenuDrawer to provide mobile-specific navigation functionality
 * with proper focus management and responsive behavior.
 * 
 * @extends MenuDrawer
 * @fires menu:opened - When the menu drawer is opened
 * @fires menu:closed - When the menu drawer is closed
 * 
 * @example
 * <header-drawer>
 *   <details id="menu-drawer">
 *     <summary>Menu</summary>
 *     <nav>...</nav>
 *   </details>
 * </header-drawer>
 */
class HeaderDrawer extends MenuDrawer {
  // Private fields
  #header = null;
  #menuDrawer = null;
  #resizeHandler = null;
  
  constructor() {
    super();
    
    // Bind event handlers
    this.#resizeHandler = this.#handleResize.bind(this);
  }
  
  connectedCallback() {
    super.connectedCallback?.();
    
    try {
      this.#setupDOM();
      this.#adjustMenuPosition();
    } catch (error) {
      console.error('HeaderDrawer: Error in connectedCallback', error);
    }
  }
  
  /**
   * Opens the menu drawer with proper animations and focus management
   * @param {HTMLElement} summaryElement - The summary element that triggered opening
   */
  openMenuDrawer(summaryElement) {
    try {
      document.body.classList.add("overflow-hidden");
      this.#header = this.#header || document.querySelector("header-element");
      
      if (this.#header) {
        this.#header.classList.add("menu-open");
      }
      
      setTimeout(() => {
        this.mainDetailsToggle?.classList.add("menu-opening");
      });
      
      summaryElement.setAttribute("aria-expanded", "true");
      window.addEventListener("resize", this.#resizeHandler);
      
      // Call parent's focus trap if available
      if (typeof trapFocus === 'function') {
        trapFocus(this.mainDetailsToggle, summaryElement);
      }
      
      
      this.dispatchEvent(new CustomEvent('menu:opened', {
        bubbles: true,
        detail: { drawer: this }
      }));
    } catch (error) {
      console.error('HeaderDrawer: Error opening menu', error);
    }
  }
  
  /**
   * Closes the menu drawer and restores focus
   * @param {Event} event - The event that triggered closing
   * @param {HTMLElement} elementToFocus - Element to focus after closing
   */
  closeMenuDrawer(event, elementToFocus) {
    if (!elementToFocus) return;
    
    try {
      super.closeMenuDrawer?.(event, elementToFocus);
      
      if (this.#header) {
        this.#header.classList.remove("menu-open");
      }
      
      window.removeEventListener("resize", this.#resizeHandler);
      
      this.dispatchEvent(new CustomEvent('menu:closed', {
        bubbles: true,
        detail: { drawer: this }
      }));
    } catch (error) {
      console.error('HeaderDrawer: Error closing menu', error);
    }
  }
  
  // Private methods
  #setupDOM() {
    this.#menuDrawer = this.querySelector("#menu-drawer");
  }
  
  #adjustMenuPosition() {
    if (!this.#menuDrawer) return;
    
    const headerElement = document.querySelector("header-element");
    if (!headerElement) return;
    
    const computedStyle = window.getComputedStyle(headerElement);
    const paddingBottom = parseInt(computedStyle.paddingBottom, 10) || 0;
    
    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    this.#menuDrawer.style.marginTop = `-${paddingBottom / rootFontSize}rem`;
  }
  
  #handleResize() {
    if (!this.#header) return;
    
    const rect = this.#header.getBoundingClientRect();
    const bottomPosition = rect.bottom - (this.borderOffset || 0);
    
    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    document.documentElement.style.setProperty(
      "--header-bottom-position",
      `${(Math.round(bottomPosition) / rootFontSize)}rem`
    );
    
    document.documentElement.style.setProperty(
      "--viewport-height",
      `${(window.innerHeight / rootFontSize)}rem`
    );
  }
}

// Register custom element
if (!customElements.get("header-drawer")) {
  customElements.define("header-drawer", HeaderDrawer);
}

/**
 * HeaderElement - Advanced sticky header component with scroll-based visibility
 * 
 * Provides a high-performance sticky header that hides/shows based on scroll
 * direction and position. Includes comprehensive state management and 
 * accessibility features.
 * 
 * @fires header:state-change - When header state changes
 * @fires header:visibility-change - When header visibility changes
 * 
 * @example
 * <header-element data-sticky="true">
 *   <div class="js-announcement-bar">...</div>
 *   <nav class="header__desktop-navigation">...</nav>
 * </header-element>
 * 
 * @example CSS usage with state attributes
 * header-element[data-visibility="hidden"] { transform: translateY(-100%); }
 * header-element[data-threshold-passed="true"] { backdrop-filter: blur(10px); }
 * header-element[data-scroll-range="far"] { background: solid; }
 */
class HeaderElement extends HTMLElement {
  // Private fields
  #isConnected = false;
  #abortController = null;
  #rafId = null;
  #scrollTimeout = null;
  #resizeTimeout = null;
  #transitionTimeout = null;
  #lastScrollTime = 0;
  #isViewportZoomed = false;
  #viewportZoomResetTimeout = null;
  #viewportScale = 1;
  
  // DOM references
  #header = null;
  #announcementBar = null;
  #headerOffset = null;
  
  // Event handlers
  #scrollHandler = null;
  #resizeHandler = null;
  
  // State management
  #state = {
    scrollPosition: 0,
    lastScrollPosition: 0,
    headerHeight: 0,
    announcementHeight: 0,
    visibility: 'visible',
    scrollDirection: 'none',
    thresholdPassed: false,
    isTransitioning: false,
    animationDuration: 300,
    isSticky: false
  };
  
  // Configuration
  #config = {
    threshold: 200,
    thresholdHysteresis: 20, // Prevents oscillation near threshold
    scrollDebounceDelay: 10,
    resizeDebounceDelay: 150,
    hideOffset: 5,
    showOffset: 5,
    lastStateChangeTime: 0,
    minStateChangeInterval: 100 // Minimum time between state changes
  };
  
  // Constants
  static #TRANSITION_DELAY = 500;
  static #VIEWPORT_ZOOM_RESET_DELAY = 250;
  
  // Observed attributes
  static observedAttributes = ["data-sticky"];
  
  constructor() {
    super();
    
    // Bind event handlers
    this.#scrollHandler = this.#handleScroll.bind(this);
    this.#resizeHandler = this.#handleResize.bind(this);
  }
  
  connectedCallback() {
    if (this.#isConnected) return;
    
    try {
      this.#setupDOM();
      
      if (!this.#state.isSticky || !this.#header) {
        this.#isConnected = true;
        return;
      }
      
      this.#setupAnimationDurations();
      this.#setupHeaderOffset();
      this.#setupHeaderStickyOffset();
      this.#updateHeaderHeight();
      this.#setupEventListeners();
      this.#setupInitialStickyState();
      
      // Set initial scroll position
      this.#state.scrollPosition = window.scrollY || document.documentElement.scrollTop;
      this.#state.lastScrollPosition = this.#state.scrollPosition;
      
      this.#updateStateAttributes();
      
      this.#isConnected = true;
      
      this.dispatchEvent(new CustomEvent('header:ready', {
        detail: { header: this },
        bubbles: true
      }));
    } catch (error) {
      console.error('HeaderElement: Error in connectedCallback', error);
    }
  }
  
  disconnectedCallback() {
    if (!this.#isConnected) return;
    
    try {
      this.#cleanup();
      this.#isConnected = false;
    } catch (error) {
      console.error('HeaderElement: Error in disconnectedCallback', error);
    }
  }
  
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    
    if (name === "data-sticky") {
      this.#state.isSticky = newValue === "true";
      
      if (this.#isConnected) {
        if (this.#state.isSticky) {
          this.#setupEventListeners();
        } else {
          this.#cleanup();
        }
      }
    }
  }
  
  // Public API methods
  /**
   * Get current header state
   * @returns {Object} Current state object
   */
  getState() {
    return { ...this.#state };
  }
  
  /**
   * Force show the header
   */
  show() {
    this.#showHeader();
  }
  
  /**
   * Force hide the header
   */
  hide() {
    this.#hideHeader();
  }
  
  /**
   * Update header sticky offset CSS variable
   * Public method to allow external components to trigger offset recalculation
   */
  updateHeaderStickyOffset() {
    this.#setupHeaderStickyOffset();
  }
  
  // Private methods
  #setupDOM() {
    this.#header = this.closest(".header-elements");
    this.#announcementBar = this.querySelector(".js-announcement-bar");
    this.#state.isSticky = this.dataset.sticky === "true";
  }
  
  #setupAnimationDurations() {
    if (!this.#header) return;
    
    const computedStyle = window.getComputedStyle(this.#header);
    const transitionDuration = computedStyle.transitionDuration || '0.3s';
    
    const durationInMs = transitionDuration.includes('ms') 
      ? parseFloat(transitionDuration)
      : parseFloat(transitionDuration) * 1000;
    
    this.#state.animationDuration = durationInMs || 300;
  }
  
  #setupHeaderOffset() {
    const setHeaderOffset = () => {
      const headerElements = document.querySelectorAll("header-element");
      if (!headerElements.length) return;
      
      const headerHeight = Array.from(headerElements).reduce(
        (acc, el) => acc + el.offsetHeight,
        0
      );
      
      const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
      document.body.style.setProperty("--header-offset", `${(headerHeight) / rootFontSize}rem`);
    };
    
    setHeaderOffset();
  }
  
  #setupHeaderStickyOffset() {
    setTimeout(() => {
      if (!this.isConnected) return;
      
      const mainHeader = this.querySelector('.header__main');
      const promoBanner = this.querySelector('promo-banner');
      let headerHeight = mainHeader?.offsetHeight || 0;

      // Add promoBanner height if data-threshold-passed is true
      // MAYBE CALL THIS WHEN THREHOLD PASSED STATE IS CHANGED?
      if (promoBanner && this.getAttribute('data-threshold-passed') !== 'true') {
        headerHeight += promoBanner.offsetHeight || 0;
      }
      
      const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
      document.body.style.setProperty(
        "--header-sticky-offset",
        `${(headerHeight) / rootFontSize}rem`
      );
    }, HeaderElement.#TRANSITION_DELAY);
  }
  
  #setupInitialStickyState() {
    if (!this.#header) return;
    
    this.#headerOffset = document.createElement("div");
    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    this.#headerOffset.style.height = `${this.#state.headerHeight / rootFontSize}rem`;
    this.#headerOffset.className = 
      "absolute inset-0 bg-background1 shopify-section-group-header-group";
    this.#headerOffset.setAttribute("aria-hidden", "true");
    
    this.#header.classList.add(
      "transition-transform",
      "duration-300",
      "sticky",
      "top-0",
      "z-20",
      "bg-transparent"
    );
  }
  
  #setupEventListeners() {
    // Create abort controller for cleanup
    this.#abortController = new AbortController();
    const { signal } = this.#abortController;

    this.#setupViewportZoomDetection(signal);
    
    // Throttled scroll handler
    const throttledScroll = this.#throttle(
      this.#scrollHandler,
      this.#config.scrollDebounceDelay
    );
    
    // Debounced resize handler
    const debouncedResize = this.#debounce(
      this.#resizeHandler,
      this.#config.resizeDebounceDelay
    );
    
    // Add listeners with signal
    window.addEventListener("scroll", throttledScroll, { 
      passive: true, 
      signal 
    });
    
    window.addEventListener("resize", debouncedResize, { 
      signal 
    });
    
    document.addEventListener("promo-banner:closed", this.#handlePromoBannerClosed.bind(this), { 
      signal 
    });
    
    document.addEventListener("promo-banner:visible", this.#handlePromoBannerVisible.bind(this), { 
      signal 
    });
  }

  #setupViewportZoomDetection(signal) {
    const viewport = window.visualViewport;
    if (!viewport || typeof viewport.scale !== "number") return;

    const scheduleReset = () => {
      clearTimeout(this.#viewportZoomResetTimeout);
      this.#viewportZoomResetTimeout = setTimeout(() => {
        if (Math.abs((this.#viewportScale || 1) - 1) < 0.001) {
          this.#setViewportZoomed(false);
        }
      }, HeaderElement.#VIEWPORT_ZOOM_RESET_DELAY);
    };

    const handleViewportChange = () => {
      const scale = viewport.scale || 1;
      this.#viewportScale = scale;

      const isZoomed = Math.abs(scale - 1) > 0.001;
      this.#setViewportZoomed(isZoomed);
      scheduleReset();
    };

    viewport.addEventListener("resize", handleViewportChange, { passive: true, signal });
    viewport.addEventListener("scroll", handleViewportChange, { passive: true, signal });

    handleViewportChange();
  }

  #setViewportZoomed(isZoomed) {
    if (this.#isViewportZoomed === isZoomed) return;
    this.#isViewportZoomed = isZoomed;

    const html = document.documentElement;
    if (isZoomed) {
      html.setAttribute("data-viewport-zoomed", "true");

      // Stabilize header state while zooming to reduce layout + GPU pressure
      this.#state.visibility = "visible";
      this.#state.isTransitioning = false;
      if (this.#header) {
        this.#header.classList.remove("-translate-y-(--header-offset)");
      }
    } else {
      html.removeAttribute("data-viewport-zoomed");
    }
  }
  
  #cleanup() {
    // Abort all event listeners
    this.#abortController?.abort();
    this.#abortController = null;
    
    // Cancel animation frames
    if (this.#rafId) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }
    
    // Clear timeouts
    clearTimeout(this.#scrollTimeout);
    clearTimeout(this.#resizeTimeout);
    clearTimeout(this.#transitionTimeout);
    clearTimeout(this.#viewportZoomResetTimeout);
    
    // Reset state
    this.#state.visibility = 'visible';
    this.#state.isTransitioning = false;
  }
  
  #updateHeaderHeight() {
    if (!this.#header) return;
    
    this.#state.headerHeight = this.#header.offsetHeight;
    this.#state.announcementHeight = this.#announcementBar?.offsetHeight || 0;
    
    if (this.#headerOffset) {
      const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
      this.#headerOffset.style.height = `${this.#state.headerHeight / rootFontSize}rem`;
    }
  }
  
  // Event handlers
  #handleScroll() {
    if (this.#isViewportZoomed) return;
    const now = Date.now();
    if (now - this.#lastScrollTime < this.#config.scrollDebounceDelay) {
      return;
    }
    this.#lastScrollTime = now;
    
    // Cancel previous frame
    if (this.#rafId) {
      cancelAnimationFrame(this.#rafId);
    }
    
    // Schedule update in next frame
    this.#rafId = requestAnimationFrame(() => {
      this.#updateScrollState();
    });
  }
  
  #handleResize() {
    if (this.#isViewportZoomed) return;
    try {
      this.#setupHeaderOffset();
      this.#updateHeaderHeight();
      this.#setupHeaderStickyOffset();
    } catch (error) {
      console.error('HeaderElement: Error handling resize', error);
    }
  }
  
  #handlePromoBannerClosed() {
    try {
      this.#setupHeaderOffset();
      this.#setupHeaderStickyOffset();
    } catch (error) {
      console.error('HeaderElement: Error handling promo banner close', error);
    }
  }

  #handlePromoBannerVisible() {
    try {
      this.#setupHeaderOffset();
      this.#setupHeaderStickyOffset();
    } catch (error) {
      console.error('HeaderElement: Error handling promo banner visible', error);
    }
  }
  
  #updateScrollState() {
    if (this.#isViewportZoomed) return;
    const scrollPosition = window.scrollY || document.documentElement.scrollTop;
    const scrollDelta = scrollPosition - this.#state.lastScrollPosition;
    
    this.#state.scrollPosition = scrollPosition;
    
    // Set scroll direction
    if (Math.abs(scrollDelta) < 1) {
      this.#state.scrollDirection = 'none';
    } else {
      this.#state.scrollDirection = scrollDelta > 0 ? 'down' : 'up';
    }
    
    // Check threshold with hysteresis to prevent oscillation
    const wasThresholdPassed = this.#state.thresholdPassed;
    if (!wasThresholdPassed && scrollPosition > this.#config.threshold + this.#config.thresholdHysteresis) {
      this.#state.thresholdPassed = true;
    } else if (wasThresholdPassed && scrollPosition < this.#config.threshold - this.#config.thresholdHysteresis) {
      this.#state.thresholdPassed = false;
    }
    
    // Always update state attributes to ensure scroll range is current
    this.#updateStateAttributes();
    
    // Handle header visibility only for significant movements
    if (Math.abs(scrollDelta) >= 1) {
      this.#handleHeaderVisibility(scrollPosition, scrollDelta);
    }
    
    this.#state.lastScrollPosition = scrollPosition;
  }
  
  #handleHeaderVisibility(scrollPosition, scrollDelta) {
    // Prevent rapid state changes
    const now = Date.now();
    if (now - this.#config.lastStateChangeTime < this.#config.minStateChangeInterval) {
      return;
    }
    
    // Always show header when at the top of the page
    if (scrollPosition <= this.#state.announcementHeight) {
      if (this.#state.visibility !== 'visible' && this.#state.visibility !== 'showing') {
        this.#showHeader();
        this.#config.lastStateChangeTime = now;
      }
      return;
    }
    
    const isHidden = this.#state.visibility === 'hidden' || this.#state.visibility === 'hiding';
    const isVisible = this.#state.visibility === 'visible' || this.#state.visibility === 'showing';
    
    const shouldHide = 
      this.#state.thresholdPassed && 
      scrollDelta > this.#config.hideOffset && 
      !isHidden;
    
    const shouldShow = 
      scrollDelta < -this.#config.showOffset &&
      !isVisible;
    
    if (shouldHide) {
      this.#hideHeader();
      this.#config.lastStateChangeTime = now;
    } else if (shouldShow) {
      this.#showHeader();
      this.#config.lastStateChangeTime = now;
    }
  }
  
  #hideHeader() {
    if (this.#state.visibility === 'hidden') return;
    
    // Clear any pending show transition
    clearTimeout(this.#transitionTimeout);
    
    this.#state.isTransitioning = true;
    this.#state.visibility = 'hiding';
    this.#updateStateAttributes();
    
    if (this.#header) {
      this.#header.classList.add("-translate-y-(--header-offset)");
    }
    
    this.#transitionTimeout = setTimeout(() => {
      // Only finalize hide if we're still in hiding state
      if (this.#state.visibility === 'hiding') {
        this.#state.visibility = 'hidden';
        this.#state.isTransitioning = false;
        this.#updateStateAttributes();
        // Delay sticky offset update to prevent layout shift during scroll
        setTimeout(() => {
          if (this.#state.visibility === 'hidden') {
            this.#setupHeaderStickyOffset();
          }
        }, 100);
        
        this.dispatchEvent(new CustomEvent('header:visibility-change', {
          detail: { visibility: 'hidden' },
          bubbles: true
        }));
      }
    }, this.#state.animationDuration);
  }
  
  #showHeader() {
    if (this.#state.visibility === 'visible') return;
    
    // Clear any pending hide transition
    clearTimeout(this.#transitionTimeout);
    
    this.#state.isTransitioning = true;
    this.#state.visibility = 'showing';
    this.#updateStateAttributes();
    
    if (this.#header) {
      this.#header.classList.remove("-translate-y-(--header-offset)");
    }
    
    this.#transitionTimeout = setTimeout(() => {
      // Only finalize show if we're still in showing state
      if (this.#state.visibility === 'showing') {
        this.#state.visibility = 'visible';
        this.#state.isTransitioning = false;
        this.#updateStateAttributes();
        // Delay sticky offset update to prevent layout shift during scroll
        setTimeout(() => {
          if (this.#state.visibility === 'visible') {
            this.#setupHeaderStickyOffset();
          }
        }, 100);
        
        this.dispatchEvent(new CustomEvent('header:visibility-change', {
          detail: { visibility: 'visible' },
          bubbles: true
        }));
      }
    }, this.#state.animationDuration);
  }
  
  #updateStateAttributes() {
    // Set visibility states
    this.setAttribute('data-visibility', this.#state.visibility);
    this.setAttribute('data-scroll-direction', this.#state.scrollDirection);
    this.setAttribute('data-threshold-passed', String(this.#state.thresholdPassed));
    this.setAttribute('data-scroll-position', String(Math.round(this.#state.scrollPosition)));
    this.setAttribute('data-scrolled', String(this.#state.scrollPosition > 0));
    
    // Update HTML tag with header visibility state
    const isVisible = this.#state.visibility === 'visible' || this.#state.visibility === 'showing';
    const htmlElement = document.documentElement;
    
    if (isVisible) {
      htmlElement.setAttribute('data-header-visible', 'true');
    } else {
      htmlElement.removeAttribute('data-header-visible');
    }
    
    // Set scroll range
    const scrollPosition = this.#state.scrollPosition;
    let scrollRangeName = 'top';
    
    if (scrollPosition < 50) {
      scrollRangeName = 'top';
    } else if (scrollPosition < 150) {
      scrollRangeName = 'near-top';
    } else if (scrollPosition < 1000) {
      scrollRangeName = 'mid';
    } else {
      scrollRangeName = 'far';
    }
    
    this.setAttribute('data-scroll-range', scrollRangeName);
    htmlElement.setAttribute('data-scroll-range', scrollRangeName);
    
    // Dispatch state change event
    this.dispatchEvent(new CustomEvent('header:state-change', {
      detail: {
        visibility: this.#state.visibility,
        scrollDirection: this.#state.scrollDirection,
        thresholdPassed: this.#state.thresholdPassed,
        scrollPosition: this.#state.scrollPosition,
        isTransitioning: this.#state.isTransitioning
      },
      bubbles: true
    }));
  }
  
  // Utility methods
  #throttle(func, delay) {
    let lastCall = 0;
    let timeout = null;
    
    return (...args) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCall;
      
      if (timeSinceLastCall >= delay) {
        lastCall = now;
        func.apply(this, args);
      } else {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          lastCall = Date.now();
          func.apply(this, args);
        }, delay - timeSinceLastCall);
      }
    };
  }
  
  #debounce(func, delay) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  }
  
  // Static utility methods
  /**
   * Find header element by selector
   * @param {string} selector - CSS selector
   * @returns {HeaderElement|null}
   */
  static find(selector) {
    return document.querySelector(selector);
  }
  
  /**
   * Get all header elements
   * @returns {NodeList}
   */
  static findAll() {
    return document.querySelectorAll('header-element');
  }
}

// Register custom element
if (!customElements.get("header-element")) {
  customElements.define("header-element", HeaderElement);
}

/**
 * LocalizationForm - Handles language and country selection
 * 
 * Manages form submission for changing locale settings with
 * accessible dropdown interactions.
 * 
 * @fires localization:change - When locale is changed
 * 
 * @example
 * <localization-form>
 *   <form>
 *     <input name="language_code" type="hidden">
 *     <a data-value="en">English</a>
 *     <a data-value="fr">Français</a>
 *   </form>
 * </localization-form>
 */
class LocalizationForm extends HTMLElement {
  // Private fields
  #isConnected = false;
  #form = null;
  #input = null;
  #links = [];
  #abortController = null;
  
  constructor() {
    super();
  }
  
  connectedCallback() {
    if (this.#isConnected) return;
    
    try {
      this.#setupDOM();
      this.#setupEventListeners();
      this.#isConnected = true;
    } catch (error) {
      console.error('LocalizationForm: Error in connectedCallback', error);
    }
  }
  
  disconnectedCallback() {
    if (!this.#isConnected) return;
    
    try {
      this.#cleanup();
      this.#isConnected = false;
    } catch (error) {
      console.error('LocalizationForm: Error in disconnectedCallback', error);
    }
  }
  
  // Private methods
  #setupDOM() {
    this.#form = this.querySelector("form");
    this.#input = this.querySelector(
      'input[name="language_code"], input[name="locale_code"], input[name="country_code"]'
    );
    this.#links = Array.from(this.querySelectorAll("a[data-value]"));
  }
  
  #setupEventListeners() {
    if (!this.#links.length) return;
    
    this.#abortController = new AbortController();
    const { signal } = this.#abortController;
    
    this.#links.forEach(link => {
      link.addEventListener("click", this.#handleItemClick.bind(this), { signal });
    });
  }
  
  #cleanup() {
    this.#abortController?.abort();
    this.#abortController = null;
  }
  
  #handleItemClick(event) {
    event.preventDefault();
    
    if (!this.#input || !this.#form) return;
    
    try {
      const value = event.currentTarget.dataset.value;
      this.#input.value = value;
      
      this.dispatchEvent(new CustomEvent('localization:change', {
        detail: { value, form: this.#form },
        bubbles: true,
        cancelable: true
      }));
      
      this.#form.submit();
    } catch (error) {
      console.error('LocalizationForm: Error handling click', error);
    }
  }
}

// Register custom element
if (!customElements.get("localization-form")) {
  customElements.define("localization-form", LocalizationForm);
}

/**
 * CountryStateProvinceSelector - Dynamic location-based dealer selector
 * 
 * Provides a multi-level selector for country, state/province with
 * dynamic dealer results display based on selection.
 * 
 * @fires dealer:selected - When a dealer location is selected
 * @fires dealer:cleared - When dealer results are cleared
 * 
 * @example
 * <country-state-province-selector data-dealers='[...]' data-inline="false">
 *   <select id="country">...</select>
 *   <select id="states">...</select>
 *   <select id="province">...</select>
 *   <div id="dealer-results"></div>
 * </country-state-province-selector>
 */
class CountryStateProvinceSelector extends HTMLElement {
  // Private fields
  #isConnected = false;
  #abortController = null;
  
  // DOM elements
  #countrySelect = null;
  #stateSelect = null;
  #provinceSelect = null;
  #dealerBox = null;
  
  // Data
  #cleanedDealers = [];
  #rawDealers = [];
  
  // Event handlers
  #countryChangeHandler = null;
  #stateChangeHandler = null;
  
  constructor() {
    super();
    
    // Bind event handlers
    this.#countryChangeHandler = this.#handleCountryChange.bind(this);
    this.#stateChangeHandler = this.#handleStateProvinceChange.bind(this);
  }
  
  connectedCallback() {
    if (this.#isConnected) return;
    
    try {
      this.#setupDOM();
      this.#processDealerData();
      this.#setupEventListeners();
      this.#initializeSelectors();
      
      this.#isConnected = true;
      
      this.dispatchEvent(new CustomEvent('selector:ready', {
        detail: { selector: this },
        bubbles: true
      }));
    } catch (error) {
      console.error('CountryStateProvinceSelector: Error in connectedCallback', error);
    }
  }
  
  disconnectedCallback() {
    if (!this.#isConnected) return;
    
    try {
      this.#cleanup();
      this.#isConnected = false;
    } catch (error) {
      console.error('CountryStateProvinceSelector: Error in disconnectedCallback', error);
    }
  }
  
  // Private methods
  #setupDOM() {
    this.#countrySelect = this.querySelector('#country');
    this.#stateSelect = this.querySelector('#states');
    this.#provinceSelect = this.querySelector('#province');
    this.#dealerBox = this.querySelector('#dealer-results');
  }
  
  #processDealerData() {
    try {
      const dealersData = this.dataset.dealers;
      if (!dealersData) return;
      
      this.#rawDealers = JSON.parse(dealersData);
      
      this.#cleanedDealers = this.#rawDealers.map(dealer => ({
        address: dealer.address?.replaceAll('\\n', '<br>') || '',
        contact_info: dealer.contact_info?.replaceAll('\\n', '<br>') || '',
        country: this.#normalize(dealer.country),
        google_maps: dealer.google_maps?.replaceAll('\\/', '/') || '',
        name: dealer.name || '',
        state: this.#normalize(dealer.state),
        logo: dealer.logo || ''
      }));
    } catch (error) {
      console.error('CountryStateProvinceSelector: Error processing dealer data', error);
      this.#cleanedDealers = [];
    }
  }
  
  #setupEventListeners() {
    this.#abortController = new AbortController();
    const { signal } = this.#abortController;
    
    this.#countrySelect?.addEventListener('change', this.#countryChangeHandler, { signal });
    this.#stateSelect?.addEventListener('change', this.#stateChangeHandler, { signal });
    this.#provinceSelect?.addEventListener('change', this.#stateChangeHandler, { signal });
  }
  
  #cleanup() {
    this.#abortController?.abort();
    this.#abortController = null;
    this.#cleanedDealers = [];
    this.#rawDealers = [];
  }
  
  #initializeSelectors() {
    this.#hideStateProvinceSelectors();
    this.#clearDealerResults();
  }
  
  #handleCountryChange() {
    try {
      this.#hideStateProvinceSelectors();
      
      const countryValue = this.#countrySelect?.value;
      
      if (countryValue === 'us') {
        this.#showStateSelector();
      } else if (countryValue === 'ca') {
        this.#showProvinceSelector();
      } else {
        this.#showCountryDealers();
      }
    } catch (error) {
      console.error('CountryStateProvinceSelector: Error handling country change', error);
    }
  }
  
  #handleStateProvinceChange() {
    try {
      const selectedCountry = this.#getSelectedCountryText();
      const regionSelect = this.#countrySelect?.value === 'us' 
        ? this.#stateSelect 
        : this.#provinceSelect;
      const selectedRegion = this.#normalize(regionSelect?.value || '');
      
      const matching = this.#cleanedDealers.filter(d =>
        d.country === selectedCountry &&
        d.state.includes(selectedRegion)
      );
      
      this.#updateDealerResults(matching);
    } catch (error) {
      console.error('CountryStateProvinceSelector: Error handling state/province change', error);
    }
  }
  
  #showStateSelector() {
    if (!this.#stateSelect) return;
    
    this.#stateSelect.style.display = 'block';
    this.#stateSelect.disabled = false;
    
    const icon = this.#stateSelect.parentElement?.querySelector('.pointer-events-none.absolute.right-4');
    if (icon) icon.style.display = 'block';
    
    if (this.#stateSelect.value) {
      this.#handleStateProvinceChange();
    } else {
      this.#clearDealerResults();
    }
  }
  
  #showProvinceSelector() {
    if (!this.#provinceSelect) return;
    
    this.#provinceSelect.style.display = 'block';
    this.#provinceSelect.disabled = false;
    
    const icon = this.#provinceSelect.parentElement?.querySelector('.pointer-events-none.absolute.right-4');
    if (icon) icon.style.display = 'block';
    
    if (this.#provinceSelect.value) {
      this.#handleStateProvinceChange();
    } else {
      this.#clearDealerResults();
    }
  }
  
  #showCountryDealers() {
    const selectedCountry = this.#getSelectedCountryText();
    const matching = this.#cleanedDealers.filter(d => d.country === selectedCountry);
    this.#updateDealerResults(matching);
  }
  
  #getSelectedCountryText() {
    if (!this.#countrySelect) return '';
    
    const selectedOption = this.#countrySelect.options[this.#countrySelect.selectedIndex];
    return this.#normalize(selectedOption?.text || '');
  }
  
  #updateDealerResults(matchingDealers) {
    if (!this.#dealerBox) return;
    
    this.#dealerBox.innerHTML = '';
    this.#dealerBox.style.display = '';
    
    if (matchingDealers && matchingDealers.length > 0) {
      const html = matchingDealers.map(dealer => this.#createDealerCard(dealer)).join('');
      this.#dealerBox.innerHTML = html;
      
      this.dispatchEvent(new CustomEvent('dealer:selected', {
        detail: { dealers: matchingDealers },
        bubbles: true
      }));
    } else {
      this.#showHQFallback();
    }
  }
  
  #createDealerCard(dealer) {
    const cardClass = this.dataset.inline === 'false' 
      ? 'p-4 lg:p-12 lg:w-1/3 w-full' 
      : '';
    
    return `
      <div class="uppercase bg-beige ${cardClass}">
        ${dealer.logo ? `
          <img src="${dealer.logo}" 
               alt="${dealer.name} logo" 
               class="w-48 object-contain mb-6" 
               loading="lazy" 
               decoding="async" />
        ` : ''}
        <h4 class="font-bold mb-2">${dealer.name}</h4>
        <p>${dealer.address}</p>
        <h4 class="font-bold mt-4 mb-2">Contact</h4>
        <p>${dealer.contact_info}</p>
        ${dealer.google_maps ? `
          <a href="${dealer.google_maps}" 
             class="underline mt-2 block"
             target="_blank"
             rel="noopener noreferrer">
            Open Google Maps
          </a>
        ` : ''}
      </div>
    `;
  }
  
  #clearDealerResults() {
    if (!this.#dealerBox) return;
    
    this.#dealerBox.innerHTML = '';
    this.#dealerBox.style.display = 'none';
    
    this.dispatchEvent(new CustomEvent('dealer:cleared', {
      bubbles: true
    }));
  }
  
  #hideStateProvinceSelectors() {
    [this.#stateSelect, this.#provinceSelect].forEach(selector => {
      if (!selector) return;
      
      selector.style.display = 'none';
      selector.disabled = true;
      
      const icon = selector.parentElement?.querySelector('.pointer-events-none.absolute.right-4');
      if (icon) {
        icon.style.display = 'none';
      }
    });
  }
  
  #showHQFallback() {
    const hq = this.#cleanedDealers.find(d => 
      d.name.toLowerCase().includes('hq')
    );
    
    if (hq) {
      this.#dealerBox.innerHTML = this.#createDealerCard(hq);
    } else {
      this.#dealerBox.innerHTML = '<p>No dealers found.</p>';
    }
  }
  
  #normalize(str) {
    // This function should be implemented based on your normalization needs
    // For now, returning lowercase trimmed string
    return (str || '').toLowerCase().trim();
  }
  
  // Static utility methods
  /**
   * Find selector by ID
   * @param {string} id - Element ID
   * @returns {CountryStateProvinceSelector|null}
   */
  static find(id) {
    return document.getElementById(id);
  }
}

// Register custom element
if (!customElements.get('country-state-province-selector')) {
  customElements.define('country-state-province-selector', CountryStateProvinceSelector);
}

// Module exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    HeaderDrawer,
    HeaderElement,
    LocalizationForm,
    CountryStateProvinceSelector
  };
}
