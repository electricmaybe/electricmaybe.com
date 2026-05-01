# Product Variant Preview

A web component that provides hover-triggered fetching of product variant pages and replaces variant-dynamic content without navigation. This creates a smooth user experience for exploring product variants.

## Features

- **Hover-triggered fetching**: Starts fetching variant content after a 300ms hover delay
- **Smooth transitions**: Loading states with opacity transitions
- **Abort on hover end**: Cancels ongoing requests when user stops hovering
- **Variant-dynamic support**: Updates all elements with `data-variant-dynamic` attributes
- **Form preservation**: Maintains form attributes during content updates
- **Accessibility**: Full keyboard navigation and screen reader support
- **Performance optimized**: Debounced requests and proper cleanup

## Usage

### Basic Implementation

Add the `data-variant-preview` attribute to any link that points to a product variant:

```html
<a href="/products/product-handle?variant=123" 
   data-variant-preview 
   data-section-id="product-main">
   Variant Option
</a>
```

### In Product Sections

For product variant swatches or buttons:

```liquid
{% for value in option.values %}
  <a href="{{ value.product_url }}" 
     data-variant-preview 
     data-section-id="product-main"
     class="variant-option {% if value.selected %}active{% endif %}">
    {{ value.name }}
  </a>
{% endfor %}
```

### Variant-Dynamic Elements

Mark elements that should update when variants change:

```html
<!-- Price that updates with variant -->
<div data-variant-dynamic="price" data-keep='{"form": ""}'>
  {{ product.price | money }}
</div>

<!-- Inventory that updates with variant -->
<div data-variant-dynamic="inventory" data-remove="form">
  {{ product.selected_or_first_available_variant.inventory_quantity }} in stock
</div>

<!-- Description that updates with variant -->
<div data-variant-dynamic="description">
  {{ product.description }}
</div>
```

## Data Attributes

### `data-variant-preview`
Enables variant preview functionality on a link element.

### `data-section-id`
Specifies which section to fetch from the variant page. Defaults to "product-main".

### `data-variant-dynamic`
Identifies elements that should be updated when variant content is fetched.

### `data-keep`
JSON string specifying attributes to preserve during content updates:
```html
data-keep='{"form": ""}'
```

### `data-remove`
Comma-separated list of attributes to remove from fetched content:
```html
data-remove="form,data-test"
```

## Events

The component dispatches custom events for integration:

### `variant:preview-loaded`
Fired when variant content is successfully loaded:
```javascript
document.addEventListener('variant:preview-loaded', (event) => {
  console.log('Variant loaded:', event.detail.variantId);
});
```

### `variant:content-updated`
Fired when variant-dynamic content is updated:
```javascript
document.addEventListener('variant:content-updated', (event) => {
  console.log('Content updated:', event.detail.updatedElements);
});
```

### `variant:preview-error`
Fired when an error occurs:
```javascript
document.addEventListener('variant:preview-error', (event) => {
  console.error('Error:', event.detail.message);
});
```

### `variant:preview-click`
Fired when a variant preview link is clicked (after successful load):
```javascript
document.addEventListener('variant:preview-click', (event) => {
  console.log('Variant clicked:', event.detail.variantUrl);
});
```

## Styling

### Loading States

The component adds loading states automatically:

```css
/* Loading animation for variant-dynamic elements */
[data-variant-dynamic].opacity-20 {
  transition: opacity 0.2s ease-in-out;
}

/* Loading spinner for variant preview links */
a[data-variant-preview][data-loading="true"]::after {
  content: '';
  position: absolute;
  /* ... spinner styles ... */
  animation: variant-preview-spin 1s linear infinite;
}
```

### Custom Styling

You can customize the appearance:

```css
/* Custom hover states */
a[data-variant-preview]:hover {
  transform: scale(1.05);
}

/* Custom loading states */
a[data-variant-preview][data-loading="true"] {
  pointer-events: none;
}
```

## Performance Considerations

### Debouncing
The component uses a 300ms hover delay to prevent excessive requests.

### Abort Controller
Ongoing requests are automatically aborted when:
- User stops hovering
- Component is disconnected
- New request starts

### Memory Management
All timers and event listeners are properly cleaned up on component disconnect.

## Browser Support

- Chrome 74+ (for private class fields)
- Firefox 90+
- Safari 15+
- Edge 79+

## Integration with Existing Code

The component is designed to work alongside existing variant handling:

1. **Compatible with existing variant radios**: Works with current `product--variant-radios.js`
2. **Preserves form functionality**: Maintains form attributes during updates
3. **Non-intrusive**: Only activates on elements with `data-variant-preview`

## Testing

Use the provided test file to verify functionality:

```bash
# Open the test file in a browser
open _scripts/product-variant-preview-test.html
```

The test file includes:
- Mock fetch responses for different variants
- Visual feedback for loading states
- Console logging for all events
- Example variant-dynamic elements

## Troubleshooting

### Common Issues

1. **No content updates**: Ensure elements have `data-variant-dynamic` attributes
2. **Form breaks**: Use `data-keep='{"form": ""}'` to preserve form attributes
3. **Loading not visible**: Check CSS for `.opacity-20` and loading spinner styles
4. **Network errors**: Verify the variant URL is correct and accessible

### Debug Mode

Enable debug logging:

```javascript
// Add before component initialization
localStorage.setItem('variant-preview-debug', 'true');
```

## Future Enhancements

- [ ] Preload variant content on page load
- [ ] Cache variant responses for better performance
- [ ] Support for custom loading animations
- [ ] Integration with product image galleries
- [ ] Analytics tracking for variant interactions
