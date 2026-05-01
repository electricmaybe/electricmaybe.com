# ElectricDOMReady Web Component Usage

The `ElectricDOMReady` web component solves the problem of scripts that need to run when the DOM is ready, especially for injected content where `DOMContentLoaded` has already fired.

## Problem Solved

Previously, scripts used `DOMContentLoaded` event listeners that wouldn't work when injected into pages after the DOM was already loaded. This component runs initialization scripts when connected to the DOM, making it perfect for:

- Injected content
- Dynamic page updates
- Scripts loaded after initial page load

## Usage

Simply add the component to any page or section where you need DOM-ready functionality:

```html
<electric-dom-ready></electric-dom-ready>
```

For pages with variant preview links, also include the variant link converter:

```html
<electric-dom-ready></electric-dom-ready>
<electric-variant-link-converter></electric-variant-link-converter>
```

## Features Handled

### 1. Click-on-Load Elements
Automatically clicks elements with the `.click-on-load` class when the component connects:

```html
<electric-dom-ready></electric-dom-ready>
<button class="click-on-load" data-action="initialize">Auto-click me</button>
```

### 2. First Section Margin Calculation
Calculates and sets the `--first-section-margin-top` CSS custom property based on the first main content section:

```css
/* This CSS variable is automatically set */
.header {
  top: var(--first-section-margin-top, 0px);
}
```

### 3. Lazy Blur Image Loading
Handles images with the `.js-lazyloadBlur` class and their placeholders:

```html
<electric-dom-ready></electric-dom-ready>
<img src="image.jpg" class="js-lazyloadBlur" style="opacity: 0;">
<div class="placeholder">Loading...</div>
```

### 4. Slider Opacity Adjustment
Automatically adjusts slider opacity based on content. Add `data-slider-opacity` attribute to sliders:

```html
<electric-dom-ready></electric-dom-ready>
<div class="slider" data-slider-opacity="true">
  <div class="slide">Slide 1</div>
  <div class="slide">Slide 2</div>
</div>
```

### 5. Variant Preview Link Conversion
The `electric-variant-link-converter` component converts regular links with `data-variant-preview` attributes into `ProductVariantPreview` web components:

```html
<electric-variant-link-converter></electric-variant-link-converter>
<a href="/products/example" data-variant-preview="true">Product Link</a>
<!-- Automatically converted to: <product-variant-preview href="/products/example">Product Link</product-variant-preview> -->
```

## Events

The component dispatches custom events for error handling:

```javascript
document.addEventListener('electric:dom-ready-error', (event) => {
  console.error('DOM Ready Error:', event.detail.message);
});
```

## Implementation Notes

### Replaced DOMContentLoaded Patterns

**Before (problematic for injected content):**
```javascript
document.addEventListener('DOMContentLoaded', () => {
  // This won't run if DOM is already loaded
  const elements = document.querySelectorAll('.click-on-load');
  elements.forEach(el => el.click());
});
```

**After (works with injected content):**
```html
<electric-dom-ready></electric-dom-ready>
```

### Performance Optimizations

- Uses `requestAnimationFrame` for smooth DOM updates
- Implements `IntersectionObserver` for lazy loading
- Uses `ResizeObserver` for efficient slider monitoring
- Proper cleanup with `AbortController` and observer disconnection

### Accessibility Features

- Maintains proper focus management
- Preserves ARIA attributes
- Ensures screen reader compatibility

## Integration with Shopify Sections

Perfect for Shopify section templates where content might be loaded dynamically:

```liquid
<!-- sections/my-section.liquid -->
<div class="my-section">
  <electric-dom-ready></electric-dom-ready>
  
  {% comment %} Your section content {% endcomment %}
  <img src="{{ image | img_url: '800x' }}" class="js-lazyloadBlur">
  <div class="placeholder">{{ 'loading' | t }}</div>
  
  <button class="click-on-load" data-modal-trigger>
    {{ 'open_modal' | t }}
  </button>
</div>
```

## Error Handling

The component includes comprehensive error handling:

- Try-catch blocks around all operations
- Custom error events for debugging
- Graceful degradation when features fail
- Console logging with component context

## Browser Support

- Chrome 74+ (for private class fields)
- Firefox 90+
- Safari 15+
- Edge 79+

## Migration Guide

### From DOMContentLoaded Scripts

1. Remove `DOMContentLoaded` event listeners from your scripts
2. Add `<electric-dom-ready></electric-dom-ready>` to your templates
3. Use data attributes where needed (e.g., `data-slider-opacity`)

### From Manual Initialization

1. Replace manual initialization calls with the component
2. Update CSS classes to use the supported patterns
3. Test with injected content scenarios

## Best Practices

1. **Single Instance**: Only one `<electric-dom-ready>` component per page section
2. **Early Placement**: Place the component early in your HTML for faster initialization
3. **CSS Classes**: Use the supported CSS classes (`.click-on-load`, `.js-lazyloadBlur`)
4. **Error Monitoring**: Listen for error events in production

## Example: Complete Implementation

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    .js-lazyloadBlur { opacity: 0; transition: opacity 0.3s; }
    .placeholder { transition: opacity 0.3s; }
    .slider { --slider-opacity: 1; opacity: var(--slider-opacity); }
  </style>
</head>
<body>
  <electric-dom-ready></electric-dom-ready>
  
  <!-- Auto-clicked elements -->
  <button class="click-on-load" onclick="console.log('Auto-clicked!')">
    Initialize
  </button>
  
  <!-- Lazy loaded images -->
  <img src="hero.jpg" class="js-lazyloadBlur" alt="Hero">
  <div class="placeholder">Loading hero image...</div>
  
  <!-- Slider with automatic opacity -->
  <div class="slider" data-slider-opacity="true">
    <div class="slide">Slide 1</div>
    <div class="slide">Slide 2</div>
  </div>
  
  <script src="path/to/electric-dom-ready.js"></script>
</body>
</html>
```

This component ensures all DOM-ready functionality works reliably, whether the content is loaded initially or injected dynamically.
