if (!customElements.get("recently-viewed")) {
  customElements.define(
    "recently-viewed",
    class RecentlyViewed extends HTMLElement {
      constructor() {
        super();
        this.isLoaded = false;
      }

      connectedCallback() {
        if ("requestIdleCallback" in window) {
          requestIdleCallback(this.loadProducts.bind(this), { timeout: 1500 });
        } else {
          this.loadProducts();
        }
      }

      getSearchQueryString() {
        const storedData = localStorage.getItem("theme:recently-viewed") || "[]";
        let items = JSON.parse(storedData);
        
        // Handle both old format (array of IDs) and new format (array of objects)
        if (items.length > 0 && typeof items[0] === 'number') {
          // Old format: array of IDs
          items = items;
        } else {
          // New format: array of objects with id property
          items = items.map(item => item.id).filter(Boolean);
        }
        
        const itemSet = new Set(items);
        if (this.hasAttribute("exclude-id")) {
          itemSet.delete(parseInt(this.getAttribute("exclude-id")));
        }
        return Array.from(itemSet.values(), (item) => `id:${item}`).join(" OR ");
      }

      async loadProducts() {
        if (this.isLoaded) return;
        this.isLoaded = true;

        const section = this.closest(".shopify-section");
        const url = `${
          window.routes.root_url
        }search?type=product&q=${this.getSearchQueryString()}&section_id=${extractSectionId(
          section
        )}`;
        const response = await fetch(url, { priority: "low" });
        const tempDiv = new DOMParser().parseFromString(
          await response.text(),
          "text/html"
        );
        const recentlyViewedElement = tempDiv.querySelector(
          "recently-viewed"
        );

        if (recentlyViewedElement.childElementCount > 0) {
          this.replaceChildren(
            ...document.importNode(recentlyViewedElement, true)
              .childNodes
          );
        } else {
          section.remove();
        }
      }
    }
  );
}
function extractSectionId(element) {
  element = element.classList.contains("shopify-section")
    ? element
    : element.closest(".shopify-section");
  return element.id.replace("shopify-section-", "");
}
