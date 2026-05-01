# Electric Modal Component Usage Guide

## Overview

The Electric Modal component is a modern, accessible, and performant modal dialog system built as a web component. It supports dynamic content, smooth animations, focus management, and various interaction patterns.

## Basic Usage

### 1. Simple Modal with Trigger

```liquid
<!-- Button to open modal -->
<button data-modal-trigger="my-modal">Open Modal</button>

<!-- Modal definition -->
{%- render 'm--modal', 
  id: 'my-modal',
  heading: 'Modal Title',
  body: 'Modal content goes here',
  primary_label: 'Confirm',
  secondary_label: 'Cancel'
-%}
```

### 2. Quick Add to Cart Modal

Include the quick-add modal once in your theme (typically in theme.liquid):

```liquid
{%- render 'm--quick-add-modal' -%}
```

Then trigger it from any product card:

```liquid
<button 
  data-modal-trigger="quick-add-modal"
  data-modal-product-handle="{{ product.handle }}"
  data-modal-variant-id="{{ product.selected_or_first_available_variant.id }}"
  class="btn btn-primary"
>
  Quick Add
</button>
```

### 3. Custom Content Modal

```liquid
{%- capture modal_content -%}
  <div class="p-6">
    <h3 class="text-lg font-medium mb-4" data-modal-title>Custom Modal</h3>
    <div class="space-y-4">
      <!-- Your custom content here -->
    </div>
    <button data-modal-close class="btn btn-primary mt-4">Close</button>
  </div>
{%- endcapture -%}

{%- render 'm--modal',
  id: 'custom-modal',
  content: modal_content,
  size: 'large'
-%}
```

## Modal Options

### Size Options
- `small` - Max width of 24rem
- `medium` - Max width of 32rem (default)
- `large` - Max width of 48rem
- `full` - Full width with margins

### Behavior Options
- `close_on_backdrop` - Allow closing by clicking backdrop (default: true)
- `close_on_escape` - Allow closing with escape key (default: true)

### Variant Options
- `default` - Standard modal with header, body, and footer
- `alert` - Alert-style modal with icon
- `confirm` - Confirmation dialog
- `custom` - Fully custom content

## JavaScript API

### Opening a Modal Programmatically

```javascript
// Method 1: Using the static method
ElectricModal.open('modal-id', {
  productId: '123',
  customData: 'value'
});

// Method 2: Direct instance method
const modal = document.getElementById('modal-id');
modal.open({ customData: 'value' });
```

### Closing a Modal

```javascript
// Close specific modal
const modal = document.getElementById('modal-id');
modal.close('reason');

// Close all modals
ElectricModal.closeAll();
```

### Modal Events

```javascript
const modal = document.getElementById('modal-id');

// Modal ready
modal.addEventListener('modal:ready', (event) => {
  console.log('Modal initialized');
});

// Modal opening
modal.addEventListener('modal:open', (event) => {
  console.log('Modal opened with data:', event.detail.data);
});

// Modal closing (cancelable)
modal.addEventListener('modal:closing', (event) => {
  if (shouldPreventClose) {
    event.preventDefault();
  }
});

// Modal closed
modal.addEventListener('modal:closed', (event) => {
  console.log('Modal closed with reason:', event.detail.reason);
});

// Content updated
modal.addEventListener('modal:content-updated', (event) => {
  console.log('Modal content was updated');
});
```

### Dynamic Content Updates

```javascript
const modal = document.getElementById('modal-id');

// Update with HTML string
modal.updateContent('<div>New content</div>');

// Update with DOM element
const element = document.createElement('div');
element.textContent = 'New content';
modal.updateContent(element);
```

## Advanced Patterns

### Loading Dynamic Content

```javascript
document.addEventListener('modal:open', async (event) => {
  if (event.detail.modal.id !== 'dynamic-modal') return;
  
  const modal = event.detail.modal;
  const productId = event.detail.data['product-id'];
  
  try {
    const response = await fetch(`/products/${productId}.json`);
    const data = await response.json();
    
    modal.updateContent(`
      <div class="p-6">
        <h3>${data.title}</h3>
        <p>${data.description}</p>
      </div>
    `);
  } catch (error) {
    modal.updateContent('<p class="error">Failed to load content</p>');
  }
});
```

### Auto-closing Toast Modal

```javascript
document.addEventListener('modal:open', (event) => {
  if (event.detail.modal.id === 'toast-modal') {
    setTimeout(() => {
      event.detail.modal.close('auto-close');
    }, 3000);
  }
});
```

### Form Validation Before Closing

```javascript
modal.addEventListener('modal:closing', (event) => {
  const form = modal.querySelector('form');
  if (form && !form.checkValidity()) {
    event.preventDefault();
    form.reportValidity();
  }
});
```

## Styling

The modal uses Shadow DOM for encapsulation but exposes CSS custom properties and parts for styling:

```css
/* Custom positioning */
electric-modal {
  --modal-offset-y: 2rem;
  --modal-max-width: 40rem;
}

/* Style the backdrop */
electric-modal::part(backdrop) {
  background-color: rgba(0, 0, 0, 0.8);
}

/* Style the content container */
electric-modal::part(content) {
  border-radius: 1rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}
```

## Best Practices

1. **Accessibility**: Always provide proper ARIA labels using `data-modal-title` and `data-modal-description` attributes
2. **Performance**: For heavy content, load it dynamically after the modal opens
3. **Mobile**: Test on mobile devices to ensure proper touch interactions
4. **Memory**: The component automatically cleans up event listeners and references
5. **Focus Management**: The modal traps focus and returns it to the trigger element on close

## Migration from Old Modal

If migrating from the old `modal-dialog` component:

1. Replace `<modal-dialog>` with `<electric-modal>`
2. Update trigger buttons to use `data-modal-trigger` instead of custom JavaScript
3. Move content into a `<div slot="content">` wrapper
4. Update event listeners from custom events to the new event names
5. Test thoroughly, especially focus management and animations

