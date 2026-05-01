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