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
