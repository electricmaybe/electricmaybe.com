# Utilities Module

A modern, performant utilities library for web components with caching, performance monitoring, and optimized operations.

## Overview

This utilities module provides shared functionality across all web components in the Electric Maybe Shopify theme. It's designed with performance, caching, and modern JavaScript practices in mind.

## Structure

```
_scripts/utils/
├── dom.js          # DOM manipulation utilities
├── network.js      # Network request utilities  
├── functional.js   # Functional programming utilities
├── index.js        # Main entry point
└── README.md       # This file
```

## Usage

### Loading the Utilities

The utilities are automatically loaded and available globally:

```javascript
// Access individual modules
const domUtils = window.DOMUtils;
const networkUtils = window.NetworkUtils;
const functionalUtils = window.FunctionalUtils;

// Or use the unified API
const utils = window.Utils;
```

### DOM Utilities (`DOMUtils`)

#### Content Replacement
```javascript
// Replace content with animation
await DOMUtils.replaceContent(targetElement, newContent, {
  animate: true,
  preserveData: true
});

// Simple content replacement
DOMUtils.replaceContent(targetElement, newContent);
```

#### HTML Parsing
```javascript
// Parse HTML with error handling
const element = DOMUtils.parseHTML(htmlString, '#my-selector');
if (element) {
  // Use the parsed element
}
```

#### Caching
```javascript
// Cache a fragment
DOMUtils.cacheFragment('my-key', element, 300000); // 5 minutes

// Get cached fragment
const cached = DOMUtils.getCachedFragment('my-key');
if (cached) {
  // Use cached element
}
```

#### Event Dispatching
```javascript
// Dispatch custom event
DOMUtils.dispatchEvent(element, 'my-event', {
  data: 'value'
}, { bubbles: true });
```

#### Focus Management
```javascript
// Get focusable elements
const focusable = DOMUtils.getFocusableElements(container);

// Lock scroll for modal
DOMUtils.lockScroll(modalElement);

// Unlock scroll
DOMUtils.unlockScroll(modalElement);
```

### Network Utilities (`NetworkUtils`)

#### Fetch with Retry
```javascript
// Fetch with retry logic
const response = await NetworkUtils.fetchWithRetry(url, {
  retries: 3,
  baseDelay: 1000,
  cache: true,
  cacheTTL: 300000
});
```

#### URL Building
```javascript
// Build fetch URL with section ID
const fetchUrl = NetworkUtils.buildFetchUrl('/collections/all', 'collection-main');

// Update URL parameters
const newUrl = NetworkUtils.updateUrlParameters(url, 'sort_by', ['price-ascending']);
```

#### Prefetching
```javascript
// Prefetch content
await NetworkUtils.prefetchContent('/collections/all', {
  cacheTTL: 300000
});
```

#### Search Parameters
```javascript
// Update search parameters
const newUrl = NetworkUtils.updateSearchParams('sort_by=price', ['page']);
```

### Functional Utilities (`FunctionalUtils`)

#### Debouncing
```javascript
// Create debounced function
const debouncedSearch = FunctionalUtils.debounce(searchFunction, 300, {
  leading: false,
  trailing: true
});

// Use with utility methods
debouncedSearch.cancel(); // Cancel pending execution
debouncedSearch.flush();  // Execute immediately
```

#### Throttling
```javascript
// Create throttled function
const throttledScroll = FunctionalUtils.throttle(scrollHandler, 100, {
  leading: true,
  trailing: true
});
```

#### Memoization
```javascript
// Memoize expensive function
const memoizedCalc = FunctionalUtils.memoize(expensiveCalculation);

// With custom resolver
const memoizedWithResolver = FunctionalUtils.memoize(
  expensiveCalculation,
  (a, b) => `${a}-${b}` // Custom cache key
);
```

#### Retry Logic
```javascript
// Retry with exponential backoff
const result = await FunctionalUtils.retry(asyncFunction, {
  retries: 3,
  baseDelay: 1000,
  shouldRetry: (error) => error.status !== 404
});
```

#### Queuing
```javascript
// Queue functions with concurrency limit
const results = await FunctionalUtils.queue([
  () => fetch('/api/1'),
  () => fetch('/api/2'),
  () => fetch('/api/3')
], 2); // Max 2 concurrent
```

## Performance Features

### Caching
- **LRU Cache**: Automatic cleanup of least recently used items
- **TTL Support**: Time-based expiration for cached items
- **Memory Management**: Configurable cache sizes to prevent memory leaks

### Performance Monitoring
- **Automatic Monitoring**: PerformanceObserver integration
- **Slow Operation Detection**: Warnings for operations > 16ms
- **Cache Statistics**: Runtime cache size monitoring

### Optimizations
- **DocumentFragment**: Efficient DOM manipulation
- **Passive Event Listeners**: Better scroll performance
- **Debounced Operations**: Reduced function call frequency
- **Selector Caching**: Optimized DOM queries

## Migration from Old Helpers

### Before (Old helpers.js)
```javascript
// Old debounce
const debounced = debounce(myFunction, 300);

// Old fetch
const response = await fetch(url);

// Old DOM manipulation
element.innerHTML = newHTML;
```

### After (New Utilities)
```javascript
// New debounce with options
const debounced = FunctionalUtils.debounce(myFunction, 300, {
  leading: false,
  trailing: true
});

// New fetch with retry and caching
const response = await NetworkUtils.fetchWithRetry(url, {
  retries: 3,
  cache: true
});

// New DOM manipulation with performance
await DOMUtils.replaceContent(element, newElement, {
  animate: true,
  preserveData: true
});
```

## Best Practices

### 1. Use Caching Appropriately
```javascript
// Good: Cache expensive operations
const cachedElement = DOMUtils.getCachedFragment('expensive-calculation');
if (!cachedElement) {
  const result = expensiveCalculation();
  DOMUtils.cacheFragment('expensive-calculation', result, 300000);
}

// Bad: Cache everything
DOMUtils.cacheFragment('simple-operation', simpleResult); // Unnecessary
```

### 2. Leverage Performance Monitoring
```javascript
// Performance monitoring is automatic
// Check console for warnings about slow operations
// Use performance.measure() for custom measurements
```

### 3. Use Appropriate Debouncing/Throttling
```javascript
// For search input
const debouncedSearch = FunctionalUtils.debounce(searchFunction, 300);

// For scroll events
const throttledScroll = FunctionalUtils.throttle(scrollHandler, 100);
```

### 4. Handle Errors Gracefully
```javascript
try {
  const element = DOMUtils.parseHTML(html);
  if (!element) {
    console.warn('Failed to parse HTML');
    return;
  }
  // Use element
} catch (error) {
  console.error('DOM operation failed:', error);
}
```

## API Reference

### DOMUtils
- `parseHTML(html, selector?)` - Parse HTML with error handling
- `replaceContent(target, newContent, options?)` - Replace content with options
- `cacheFragment(key, fragment, ttl?)` - Cache DOM fragment
- `getCachedFragment(key)` - Get cached fragment
- `dispatchEvent(target, eventName, detail?, options?)` - Dispatch custom event
- `getFocusableElements(container)` - Get focusable elements
- `lockScroll(element)` - Lock scroll for modal
- `unlockScroll(element)` - Unlock scroll
- `clearCache()` - Clear all caches

### NetworkUtils
- `fetchWithRetry(url, options?)` - Fetch with retry logic
- `buildFetchUrl(url, sectionId?)` - Build fetch URL with section ID
- `updateUrlParameters(url, param, values)` - Update URL parameters
- `prefetchContent(url, options?)` - Prefetch content
- `updateSearchParams(searchParams, keepKeys?)` - Update search parameters
- `clearCache()` - Clear request cache

### FunctionalUtils
- `debounce(func, wait, options?)` - Debounce function
- `throttle(func, wait, options?)` - Throttle function
- `memoize(func, resolver?)` - Memoize function
- `retry(func, options?)` - Retry with exponential backoff
- `queue(functions, concurrency?)` - Queue functions
- `clearCache()` - Clear function cache

## Browser Support

- Chrome 74+
- Firefox 90+
- Safari 15+
- Edge 79+

Requires support for:
- Private class fields (`#`)
- `PerformanceObserver`
- `DocumentFragment`
- `DOMParser`

## Contributing

When adding new utilities:

1. Follow the existing patterns
2. Include comprehensive JSDoc documentation
3. Add performance monitoring where appropriate
4. Include error handling
5. Add to the appropriate module (dom/network/functional)
6. Update this README with new API documentation 