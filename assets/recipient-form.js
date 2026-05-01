if (!customElements.get('recipient-form')) {
  customElements.define('recipient-form', class RecipientForm extends HTMLElement {
    /**
     * Gift Message Recipient Form Web Component
     * 
     * Manages gift message form state, cart integration, and checkbox control.
     * Handles form validation, error display, and cart data persistence.
     * 
     * @example
     * <recipient-form data-section-id="123" data-product-variant-id="456">
     *   <input id="Recipient-checkbox-123" type="checkbox">
     *   <div id="Recipient-form-wrapper-123">...</div>
     * </recipient-form>
     */
    /** @type {string} Section ID for unique element targeting */
    #sectionId;
    
    /** @type {string} Current product variant ID */
    #productVariantId;
    
    /** @type {boolean} Component connection state */
    #isConnected;
    
    /** @type {AbortController | null} Controller for cleanup */
    #abortController;
    
    /** @type {HTMLInputElement} Checkbox input element */
    #checkboxInput;
    
    /** @type {HTMLElement} Form wrapper element */
    #formWrapper;
    
    /** @type {HTMLInputElement} Hidden control field */
    #hiddenControlField;
    
    /** @type {HTMLInputElement} Email input element */
    #emailInput;
    
    /** @type {HTMLInputElement} Name input element */
    #nameInput;
    
    /** @type {HTMLTextAreaElement} Message input element */
    #messageInput;
    
    /** @type {HTMLInputElement} Timezone offset field */
    #offsetProperty;
    
    /** @type {HTMLElement} Error message wrapper */
    #errorMessageWrapper;
    
    /** @type {HTMLElement} Error message list */
    #errorMessageList;
    
    /** @type {HTMLElement} Error message element */
    #errorMessage;
    
    /** @type {string} Default error header text */
    #defaultErrorHeader;

    constructor() {
      super();
      
      this.#sectionId = this.dataset.sectionId;
      this.#productVariantId = this.dataset.productVariantId;
      this.#isConnected = false;
      this.#abortController = null;
      
      this.#initializeElements();
      this.#setupEventListeners();
      this.#loadCartData();
    }

    /**
     * Initialize DOM element references
     * @private
     */
    #initializeElements() {
      try {
        // Look for checkbox in the document (it's outside this component)
        this.#checkboxInput = document.querySelector(`#Recipient-checkbox-${this.#sectionId}`) || 
                             document.querySelector(`#add-a-gift-message`);
        
        this.#formWrapper = this.querySelector(`#Recipient-form-wrapper-${this.#sectionId}`);
        this.#hiddenControlField = this.querySelector(`#Recipient-control-${this.#sectionId}`);
        this.#emailInput = this.querySelector(`#Recipient-email-${this.#sectionId}`);
        this.#nameInput = this.querySelector(`#Recipient-name-${this.#sectionId}`);
        this.#messageInput = this.querySelector(`#Recipient-message-${this.#sectionId}`);
        this.#offsetProperty = this.querySelector(`#Recipient-timezone-offset-${this.#sectionId}`);

        this.#errorMessageWrapper = this.querySelector('.product-form__recipient-error-message-wrapper');
        this.#errorMessageList = this.#errorMessageWrapper?.querySelector('ul');
        this.#errorMessage = this.#errorMessageWrapper?.querySelector('.error-message');
        this.#defaultErrorHeader = this.#errorMessage?.innerText;

        // Validate required elements
        if (!this.#checkboxInput) {
          console.warn(`RecipientForm: Checkbox element not found. Tried: #Recipient-checkbox-${this.#sectionId} and #add-a-gift-message`);
        }
        
        if (!this.#formWrapper) {
          console.warn(`RecipientForm: Form wrapper element #Recipient-form-wrapper-${this.#sectionId} not found`);
        }

        // Set initial states for available elements
        if (this.#checkboxInput) {
          this.#checkboxInput.disabled = false;
          // Don't set initial checked state - let cart data determine this
        }
        
        if (this.#hiddenControlField) {
          this.#hiddenControlField.disabled = true;
        }
        
        if (this.#offsetProperty) {
          this.#offsetProperty.value = new Date().getTimezoneOffset();
        }

        // If no checkbox found, assume this is in a modal and show the form
        if (!this.#checkboxInput && this.#formWrapper) {
          this.#formWrapper.style.display = '';
          this.#enableInputFields();
        }
      } catch (error) {
        this.#handleError('Failed to initialize form elements', error);
      }
    }

    /**
     * Setup event listeners with abort controller
     * @private
     */
    #setupEventListeners() {
      try {
        this.#abortController = new AbortController();
        
        // Listen for changes on the external checkbox
        if (this.#checkboxInput) {
          this.#checkboxInput.addEventListener('change', this.#handleChange.bind(this), {
            signal: this.#abortController.signal
          });
        }
        
        // Listen for cart updates to sync checkbox state
        document.addEventListener('gift-message-saved', this.#handleGiftMessageSaved.bind(this), {
          signal: this.#abortController.signal
        });
        
        // Listen for cart data changes
        document.addEventListener('cart:updated', this.#loadCartData.bind(this), {
          signal: this.#abortController.signal
        });
        
      } catch (error) {
        this.#handleError('Failed to setup event listeners', error);
      }
    }

    connectedCallback() {
      if (this.#isConnected) return;
      
      try {
        this.#isConnected = true;
        this.#loadCartData();
      } catch (error) {
        this.#handleError('Failed to connect component', error);
      }
    }

    disconnectedCallback() {
      this.#cleanup();
    }

    /**
     * Load gift message data from cart and update form state
     * @private
     */
    async #loadCartData() {
      try {
        // Ensure elements are available before proceeding
        if (!this.#checkboxInput) {
          console.warn('RecipientForm: Checkbox input not found, skipping cart data load');
          return;
        }

        const response = await fetch('/cart.js');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const cart = await response.json();
        const giftMessageData = this.#extractGiftMessageFromCart(cart);
        
        if (giftMessageData) {
          this.#populateFormWithCartData(giftMessageData);
          this.#checkboxInput.checked = true;
          this.#enableInputFields();
        } else {
          this.#checkboxInput.checked = false;
          this.#disableInputFields();
        }
      } catch (error) {
        this.#handleError('Failed to load cart data', error);
      }
    }

    /**
     * Extract gift message data from cart items
     * @param {Object} cart - Cart object from Shopify API
     * @returns {Object|null} Gift message data or null if not found
     * @private
     */
    #extractGiftMessageFromCart(cart) {
      try {
        // Look for gift message properties in cart items
        for (const item of cart.items) {
          if (item.properties && item.properties['__shopify_send_gift_card_to_recipient']) {
            return {
              recipientName: item.properties['Recipient name'] || '',
              recipientEmail: item.properties['Recipient email'] || '',
              senderName: item.properties['Sender name'] || '',
              message: item.properties['Message'] || ''
            };
          }
        }
        return null;
      } catch (error) {
        this.#handleError('Failed to extract gift message data', error);
        return null;
      }
    }

    /**
     * Populate form fields with cart data
     * @param {Object} giftMessageData - Gift message data from cart
     * @private
     */
    #populateFormWithCartData(giftMessageData) {
      try {
        if (this.#nameInput && giftMessageData.recipientName) {
          this.#nameInput.value = giftMessageData.recipientName;
        }
        
        if (this.#emailInput && giftMessageData.recipientEmail) {
          this.#emailInput.value = giftMessageData.recipientEmail;
        }
        
        if (this.#messageInput && giftMessageData.message) {
          this.#messageInput.value = giftMessageData.message;
        }
        
        // Update character counter if it exists
        const charCount = this.querySelector('.char-count');
        if (charCount && this.#messageInput) {
          charCount.textContent = this.#messageInput.value.length;
        }
      } catch (error) {
        this.#handleError('Failed to populate form with cart data', error);
      }
    }

    /**
     * Handle gift message saved event
     * @param {CustomEvent} event - Gift message saved event
     * @private
     */
    #handleGiftMessageSaved(event) {
      try {
        if (event.detail.sectionId === this.#sectionId && this.#checkboxInput) {
          this.#checkboxInput.checked = true;
          this.#enableInputFields();
        }
      } catch (error) {
        this.#handleError('Failed to handle gift message saved event', error);
      }
    }

    /**
     * Handle checkbox change event
     * @param {Event} event - Change event
     * @private
     */
    #handleChange(event) {
      try {
        if (event.target === this.#checkboxInput) {
          if (this.#checkboxInput.checked) {
            this.#enableInputFields();
          } else {
            this.#clearInputFields();
            this.#disableInputFields();
            this.#clearErrorMessage();
          }
        }
      } catch (error) {
        this.#handleError('Failed to handle change event', error);
      }
    }

    /**
     * Get array of input fields
     * @returns {Array<HTMLElement>} Array of input elements
     * @private
     */
    #getInputFields() {
      return [
        this.#emailInput,
        this.#nameInput,
        this.#messageInput
      ].filter(Boolean);
    }

    /**
     * Get array of fields that can be disabled
     * @returns {Array<HTMLElement>} Array of disableable elements
     * @private
     */
    #getDisableableFields() {
      return [...this.#getInputFields(), this.#offsetProperty].filter(Boolean);
    }

    /**
     * Clear all input field values
     * @private
     */
    #clearInputFields() {
      try {
        this.#getInputFields().forEach((field) => {
          if (field) field.value = '';
        });
        
        // Update character counter
        const charCount = this.querySelector('.char-count');
        if (charCount) {
          charCount.textContent = '0';
        }
      } catch (error) {
        this.#handleError('Failed to clear input fields', error);
      }
    }

    /**
     * Enable input fields and show form
     * @private
     */
    #enableInputFields() {
      try {
        this.#getDisableableFields().forEach((field) => {
          if (field) field.disabled = false;
        });
        
        if (this.#hiddenControlField) {
          this.#hiddenControlField.disabled = false;
        }
        
        if (this.#formWrapper) {
          this.#formWrapper.style.display = '';
        }
      } catch (error) {
        this.#handleError('Failed to enable input fields', error);
      }
    }

    /**
     * Disable input fields and hide form
     * @private
     */
    #disableInputFields() {
      try {
        this.#getDisableableFields().forEach((field) => {
          if (field) field.disabled = true;
        });
        
        if (this.#hiddenControlField) {
          this.#hiddenControlField.disabled = true;
        }
        
        if (this.#formWrapper) {
          this.#formWrapper.style.display = 'none';
        }
      } catch (error) {
        this.#handleError('Failed to disable input fields', error);
      }
    }

    /**
     * Display error messages
     * @param {string} title - Error title
     * @param {string|Object} body - Error message or error object
     * @private
     */
    #displayErrorMessage(title, body) {
      try {
        this.#clearErrorMessage();
        
        if (!this.#errorMessageWrapper) return;
        
        this.#errorMessageWrapper.hidden = false;
        
        if (typeof body === 'object') {
          if (this.#errorMessage) {
            this.#errorMessage.innerText = this.#defaultErrorHeader;
          }
          
          Object.entries(body).forEach(([key, value]) => {
            const errorMessageId = `RecipientForm-${key}-error-${this.#sectionId}`;
            const fieldSelector = `#Recipient-${key}-${this.#sectionId}`;
            const message = Array.isArray(value) ? value.join(', ') : value;
            const errorMessageElement = this.querySelector(`#${errorMessageId}`);
            const errorTextElement = errorMessageElement?.querySelector('.error-message');
            
            if (!errorTextElement) return;

            if (this.#errorMessageList) {
              this.#errorMessageList.appendChild(this.#createErrorListItem(fieldSelector, message));
            }

            errorTextElement.innerText = `${message}.`;
            errorMessageElement.classList.remove('hidden');

            const inputElement = this[`#${key}Input`];
            if (inputElement) {
              inputElement.setAttribute('aria-invalid', 'true');
              inputElement.setAttribute('aria-describedby', errorMessageId);
            }
          });
        } else if (this.#errorMessage) {
          this.#errorMessage.innerText = body;
        }
      } catch (error) {
        this.#handleError('Failed to display error message', error);
      }
    }

    /**
     * Create error list item element
     * @param {string} target - Target selector
     * @param {string} message - Error message
     * @returns {HTMLElement} Error list item
     * @private
     */
    #createErrorListItem(target, message) {
      try {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.setAttribute('href', target);
        a.innerText = message;
        li.appendChild(a);
        li.className = 'error-message';
        return li;
      } catch (error) {
        this.#handleError('Failed to create error list item', error);
        return document.createElement('li');
      }
    }

    /**
     * Clear all error messages
     * @private
     */
    #clearErrorMessage() {
      try {
        if (this.#errorMessageWrapper) {
          this.#errorMessageWrapper.hidden = true;
        }

        if (this.#errorMessageList) {
          this.#errorMessageList.innerHTML = '';
        }

        this.querySelectorAll('.recipient-fields .form__message').forEach(field => {
          field.classList.add('hidden');
          const textField = field.querySelector('.error-message');
          if (textField) textField.innerText = '';
        });

        this.#getInputFields().forEach(inputElement => {
          if (inputElement) {
            inputElement.setAttribute('aria-invalid', 'false');
            inputElement.removeAttribute('aria-describedby');
          }
        });
      } catch (error) {
        this.#handleError('Failed to clear error message', error);
      }
    }

    /**
     * Reset recipient form to initial state
     * @private
     */
    #resetRecipientForm() {
      try {
        if (this.#checkboxInput && this.#checkboxInput.checked) {
          this.#checkboxInput.checked = false;
          this.#clearInputFields();
          this.#clearErrorMessage();
          this.#disableInputFields();
        }
      } catch (error) {
        this.#handleError('Failed to reset recipient form', error);
      }
    }

    /**
     * Handle errors gracefully
     * @param {string} message - Error message
     * @param {Error} error - Original error object
     * @private
     */
    #handleError(message, error) {
      console.error(`RecipientForm: ${message}`, error);
      
      // Dispatch custom error event
      this.dispatchEvent(new CustomEvent('recipient-form:error', {
        detail: { message, error: error.message },
        bubbles: true
      }));
    }

    /**
     * Clean up resources and event listeners
     * @private
     */
    #cleanup() {
      try {
        this.#isConnected = false;
        
        if (this.#abortController) {
          this.#abortController.abort();
          this.#abortController = null;
        }
      } catch (error) {
        console.error('RecipientForm: Failed to cleanup', error);
      }
    }
  });
}
