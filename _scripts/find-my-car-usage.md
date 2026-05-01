# Find My Car Component

A lightweight, accessible web component for searching car types (collections) with predictive search and dropdown results.

## Features

- ✅ **Predictive Search** - Real-time collection search as you type
- ✅ **Debounced Input** - Optimized API calls (300ms delay)
- ✅ **Result Caching** - Instant results for repeated searches
- ✅ **Keyboard Navigation** - Full arrow key + Enter/Escape support
- ✅ **Accessibility** - ARIA attributes, screen reader friendly
- ✅ **Click Outside** - Auto-close on outside clicks
- ✅ **Abort Support** - Cancels in-flight requests
- ✅ **Custom Events** - Emit selection and dropdown state events
- ✅ **Error Handling** - Graceful error states with user feedback
- ✅ **Private Methods** - Proper encapsulation with # syntax
- ✅ **Memory Management** - Complete cleanup on disconnect

## Usage

### Basic HTML Structure

```html
<find-my-car>
  <input type="text" placeholder="Search your car">
</find-my-car>
```

### Complete Example

```html
<find-my-car>
  <input
    type="text"
    placeholder="Search your car"
    class="w-full h-16 pl-8 pr-2 rounded-full bg-white text-primary placeholder:text-secondary text-xl shadow-[0px_2px_4px_0px_rgba(0,0,0,0.15)]"
    aria-label="Search for your car type"
    aria-autocomplete="list"
    aria-expanded="false"
    autocomplete="off"
  >
</find-my-car>
```

## API

### Custom Events

The component dispatches the following custom events:

#### `collection:selected`

Fired when a collection is selected from the dropdown.

```javascript
document.querySelector('find-my-car').addEventListener('collection:selected', (event) => {
  console.log('Selected collection:', event.detail);
  // {
  //   handle: 'tesla-model-3',
  //   title: 'Tesla Model 3',
  //   url: '/collections/tesla-model-3'
  // }
});
```

#### `dropdown:opened`

Fired when the dropdown opens.

```javascript
document.querySelector('find-my-car').addEventListener('dropdown:opened', () => {
  console.log('Dropdown opened');
});
```

#### `dropdown:closed`

Fired when the dropdown closes.

```javascript
document.querySelector('find-my-car').addEventListener('dropdown:closed', () => {
  console.log('Dropdown closed');
});
```

#### `search:error`

Fired when a search error occurs.

```javascript
document.querySelector('find-my-car').addEventListener('search:error', (event) => {
  console.error('Search error:', event.detail.message, event.detail.error);
});
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Type` | Start searching, opens dropdown |
| `↓` | Move focus to next result |
| `↑` | Move focus to previous result |
| `Enter` | Select focused result |
| `Escape` | Close dropdown and blur input |

## Styling

The dropdown comes with default styles but can be customized using Tailwind classes:

### Default Dropdown Classes

```
absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-[0px_4px_12px_0px_rgba(0,0,0,0.1)] max-h-80 overflow-y-auto hidden z-50
```

### Default Item Classes

```
block px-6 py-4 hover:bg-gray-50 transition-colors duration-150 focus:bg-gray-100 focus:outline-none
```

### Customizing via CSS

```css
/* Target the dropdown */
find-my-car > div[role="listbox"] {
  /* Custom dropdown styles */
}

/* Target dropdown items */
find-my-car a[role="option"] {
  /* Custom item styles */
}

/* Target focused items */
find-my-car a[role="option"]:focus {
  /* Custom focus styles */
}
```

## States

### Loading State

Displays an animated spinner while searching:

```
┌─────────────────────────┐
│                         │
│    ⟳ Searching...      │
│                         │
└─────────────────────────┘
```

### No Results State

Shows when no collections match the query:

```
┌─────────────────────────┐
│                         │
│    🔍                   │
│    No cars found        │
│    matching your search │
│                         │
└─────────────────────────┘
```

### Error State

Displays when API request fails:

```
┌─────────────────────────┐
│                         │
│    ⚠️                   │
│    Failed to load       │
│    results. Please      │
│    try again.           │
│                         │
└─────────────────────────┘
```

## Performance Optimizations

1. **Debouncing** - 300ms delay prevents excessive API calls
2. **Caching** - Stores previous search results in memory
3. **Abort Controller** - Cancels in-flight requests when new search starts
4. **Efficient DOM Updates** - Only updates when content changes

## Browser Support

- Chrome 74+ (for private class fields)
- Firefox 90+
- Safari 15+
- Edge 79+

## Dependencies

- Native browser APIs only (no external dependencies)
- Requires Shopify Predictive Search API

## Section Integration

The component is integrated into the `product--find-my-car.liquid` section:

```liquid
<script src="{{ '_scripts/find-my-car.js' | asset_url }}" defer></script>

<find-my-car>
  <input
    type="text"
    placeholder="{{ section.settings.placeholder | default: 'Search your car' }}"
    class="w-full h-16 pl-8 pr-2 rounded-full bg-white text-primary placeholder:text-secondary text-xl shadow-[0px_2px_4px_0px_rgba(0,0,0,0.15)]"
    aria-label="Search for your car type"
    aria-autocomplete="list"
    aria-expanded="false"
    autocomplete="off"
  >
</find-my-car>
```

## Advanced Usage

### Programmatic Control

```javascript
const findMyCar = document.querySelector('find-my-car');

// Listen for selection
findMyCar.addEventListener('collection:selected', (e) => {
  // Handle selection
  const { handle, title, url } = e.detail;
  
  // Example: Track analytics
  analytics.track('Car Selected', { handle, title });
  
  // Example: Update other UI elements
  document.querySelector('.selected-car').textContent = title;
});

// Listen for errors
findMyCar.addEventListener('search:error', (e) => {
  // Show custom error message
  showNotification('Search failed. Please try again.', 'error');
});
```

### Integration with Forms

```html
<form action="/cart/add" method="post">
  <find-my-car>
    <input
      type="text"
      name="properties[Car Type]"
      placeholder="Search your car"
    >
  </find-my-car>
  
  <button type="submit">Add to Cart</button>
</form>

<script>
  document.querySelector('find-my-car').addEventListener('collection:selected', (e) => {
    // Update hidden input with selected car
    document.querySelector('input[name="properties[Car Type]"]').value = e.detail.title;
  });
</script>
```

## Troubleshooting

### Dropdown not showing

1. Check that the component has `position: relative` (automatically added)
2. Ensure the dropdown has proper z-index (default: `z-50`)
3. Verify parent containers don't have `overflow: hidden`

### Results not appearing

1. Check browser console for API errors
2. Verify Shopify Predictive Search API is accessible
3. Ensure collections exist with matching titles
4. Check `routes.predictive_search_url` is defined

### Styling issues

1. Ensure Tailwind CSS is loaded
2. Check for CSS specificity conflicts
3. Use browser DevTools to inspect dropdown styles
4. Verify shadow DOM is not interfering

## Code Quality

This component follows the Electric Maybe JavaScript standards:

- ✅ Private methods with `#` syntax
- ✅ Comprehensive JSDoc comments
- ✅ Proper error handling with try-catch
- ✅ AbortController for fetch cancellation
- ✅ Complete cleanup in disconnectedCallback
- ✅ Custom events for communication
- ✅ Accessibility with ARIA attributes
- ✅ Performance optimizations (debounce, cache)
- ✅ Memory leak prevention

## Related Components

- `electric-search.js` - Full search with products and collections
- `electric-modal.js` - Modal functionality reference
- `promo-banner.js` - Gold standard component reference






