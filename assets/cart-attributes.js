class CartAttributes extends HTMLElement {
  constructor() {
    super();
    console.log('CartAttributes component initialized');
    
    // Simple debounce function
    this.debounceTimer = null;
    
    // Listen for changes on radio buttons
    this.addEventListener("change", (event) => {
      console.log('Change event fired:', event.target.name, event.target.value);
      if (event.target.name && event.target.name.startsWith('attributes[')) {
        this.debouncedUpdate();
      }
    });

    // Listen for input on text fields
    this.addEventListener("input", (event) => {
      console.log('Input event fired:', event.target.name, event.target.value);
      if (event.target.name && event.target.name.startsWith('attributes[')) {
        this.debouncedUpdate();
      }
    });
  }
  
  debouncedUpdate() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.updateAttributes();
    }, 300);
  }

  updateAttributes() {
    console.log('Updating attributes...');
    const attributes = {};
    
    // Collect all attribute values
    this.querySelectorAll('input[name^="attributes["]').forEach(input => {
      if (input.type === 'radio') {
        if (input.checked) {
          const name = input.name.slice(11, -1); // Remove 'attributes[' and ']'
          attributes[name] = input.value;
          console.log(`Adding radio attribute: ${name} = ${input.value}`);
        }
      } else {
        const name = input.name.slice(11, -1); // Remove 'attributes[' and ']'
        if (input.value.trim()) {
          attributes[name] = input.value.trim();
          console.log(`Adding text attribute: ${name} = ${input.value.trim()}`);
        }
      }
    });

    const body = JSON.stringify({ attributes });
    console.log('Sending cart update request with body:', body);
    fetch(`${window.routes.cart_update_url}`, { ...fetchConfig(), ...{ body } })
      .then(response => {
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        if (!response.ok) {
          return response.text().then(text => {
            console.log('Error response text:', text);
            throw new Error(`HTTP ${response.status}: ${text}`);
          });
        }
        
        // Try JSON first, fallback to text
        return response.text().then(text => {
          try {
            const json = JSON.parse(text);
            console.log('Cart update response (JSON):', json);
            return json;
          } catch (e) {
            console.log('Cart update response (text):', text);
            return text;
          }
        });
      })
      .catch(error => {
        console.error('Cart update error:', error);
      });
  }
}

customElements.define("cart-attributes", CartAttributes);
console.log('CartAttributes component registered'); 