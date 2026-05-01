# Electric Rebuy - Recommended Products Usage

The `electric-rebuy` component now supports the Rebuy API's `/products/recommended` endpoint for AI-based product recommendations.

## Usage

### Basic Setup

Add the `recommended` source to your data-sources configuration and provide at least one of the recommendation parameters:

```html
<electric-rebuy
  data-rebuy-name="product-recommendations"
  data-sources='{"recommended": 5}'
  data-recommended-product-ids="123456789,987654321"
  data-product-limit="10">
</electric-rebuy>
```

### Attributes

#### Required Attributes (at least one must be provided)

- `data-recommended-product-ids` - Comma-separated list of Shopify Product IDs to base recommendations on
- `data-recommended-collection-id` - Single Shopify Collection ID to base recommendations on  
- `data-recommended-variant-ids` - Comma-separated list of Shopify Variant IDs to base recommendations on

#### Optional Attributes

- `data-collection-handle` - Filter recommended products to only show products from this collection
- `data-product-limit` - Maximum number of total products to display

### Examples

#### Recommend based on specific products
```html
<electric-rebuy
  data-rebuy-name="cross-sell"
  data-sources='{"recommended": 8}'
  data-recommended-product-ids="123456789,987654321,456789123"
  data-product-limit="8">
</electric-rebuy>
```

#### Recommend based on collection
```html
<electric-rebuy
  data-rebuy-name="collection-recommendations"
  data-sources='{"recommended": 6}'
  data-recommended-collection-id="456789123"
  data-product-limit="6">
</electric-rebuy>
```

#### Recommend based on variants
```html
<electric-rebuy
  data-rebuy-name="variant-recommendations"
  data-sources='{"recommended": 4}'
  data-recommended-variant-ids="789123456,321654987"
  data-product-limit="4">
</electric-rebuy>
```

#### Mixed sources with recommendations
```html
<electric-rebuy
  data-rebuy-name="mixed-recommendations"
  data-sources='{"recommended": 4, "trending": 3, "native_viewed": 3}'
  data-recommended-product-ids="123456789"
  data-product-limit="10">
</electric-rebuy>
```

### Dynamic Usage with JavaScript

You can also set recommendation parameters dynamically:

```javascript
const rebuyElement = document.querySelector('electric-rebuy[data-rebuy-name="dynamic-recs"]');

// Set product IDs based on current product
rebuyElement.setAttribute('data-recommended-product-ids', currentProductId);

// Trigger re-initialization if needed
rebuyElement.connectedCallback();
```

### API Parameters

The component automatically sets these Rebuy API parameters:
- `filter_oos: 'yes'` - Filters out of stock products by default
- `context: 'default'` - Uses default AI recommendation context
- `limit: {specified-limit}` - Based on your source configuration

### Debugging

Add `?debug_rebuy=1` to your URL to see detailed logging of the recommendation process, including:
- API parameters being sent
- Products returned from the API
- Filtering and deduplication steps
- Final product list

### Notes

- The recommended source fetches products directly from the Rebuy API (not from global cache like trending)
- Products are automatically deduplicated across all sources
- Collection filtering is applied after fetching recommendations if `data-collection-handle` is specified
- The component requires a valid Rebuy API key configured in `window.theme.rebuy_key`
