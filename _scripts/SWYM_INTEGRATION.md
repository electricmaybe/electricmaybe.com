# Swym Wishlist Manual Integration

This document explains how to manually integrate Swym's wishlist functionality into your Shopify theme without using the Swym app.

## Overview

After disabling the Swym app, you can still use Swym's wishlist functionality by manually loading their scripts and configuring them with your store credentials.

## Files Added/Modified

### New Files
- `_scripts/electric-swym-loader.js` - Manual Swym script loader
- `snippets/_swym-config.liquid` - Swym configuration snippet
- `_scripts/SWYM_INTEGRATION.md` - This documentation

### Modified Files
- `layout/theme.liquid` - Added Swym configuration to head
- `snippets/_body-script.liquid` - Added Swym loader script
- `_scripts/main.js` - Added Swym loader import
- `config/settings_schema.json` - Added Swym settings section

## Setup Instructions

### 1. Get Your Swym Credentials

Before you can use this integration, you need to get your Swym store credentials:

1. **If you had the Swym app installed before:**
   - Go to your Shopify admin
   - Navigate to Apps > Swym
   - Look for your Store ID and API Key in the app settings

2. **If you don't have Swym credentials:**
   - Contact Swym support to get your store credentials
   - Or sign up for a new Swym account at [swym.it](https://swym.it)

### 2. Configure Swym Settings

1. Go to your Shopify admin
2. Navigate to **Online Store > Themes**
3. Click **Customize** on your active theme
4. Look for the **Swym Wishlist** section in the theme settings
5. Enter your Swym Store ID and API Key
6. Enable the **Enable Swym Wishlist** checkbox
7. Save your changes

### 3. Test the Integration

1. Visit your store's product pages
2. Look for wishlist buttons (electric-wish components)
3. Test adding/removing items from wishlist
4. Check browser console for any errors

## How It Works

### Script Loading Flow

1. **Configuration**: The `_swym-config.liquid` snippet adds your Swym credentials to the page
2. **Loader**: The `electric-swym-loader.js` script loads Swym's core scripts from their CDN
3. **Initialization**: Swym is initialized with your store configuration
4. **Integration**: Your existing `electric-wish.js` components automatically work with Swym

### Key Features

- **Automatic Loading**: Swym scripts load automatically when enabled
- **Fallback Support**: If Swym fails to load, wishlist buttons still work (UI-only mode)
- **Theme Integration**: Uses your existing ElectricWish components
- **Performance Optimized**: Scripts load asynchronously without blocking page render
- **Error Handling**: Graceful fallback if Swym is unavailable

## Troubleshooting

### Swym Not Loading

**Symptoms**: Wishlist buttons don't work, console shows Swym errors

**Solutions**:
1. Check that your Store ID and API Key are correct
2. Verify that Swym is enabled in theme settings
3. Check browser console for specific error messages
4. Ensure your store domain matches what's configured in Swym

### Wishlist Buttons Not Appearing

**Symptoms**: No wishlist buttons visible on product pages

**Solutions**:
1. Check that `electric-wish` components are properly placed in your templates
2. Verify that the main.js script is loading correctly
3. Check that the Swym configuration is being output (view page source)

### Performance Issues

**Symptoms**: Slow page loading, scripts taking too long to load

**Solutions**:
1. The Swym loader has a 10-second timeout
2. Scripts load asynchronously to avoid blocking
3. Consider implementing lazy loading for wishlist functionality

## Customization

### Styling Wishlist Buttons

Your existing `electric-wish` components handle styling. The Swym integration doesn't change the visual appearance.

### Custom Swym Configuration

You can modify the Swym configuration in `_swym-config.liquid` to add additional options:

```javascript
swat.setup({
  storeId: window.SwymConfig.storeId,
  apiKey: window.SwymConfig.apiKey,
  shopDomain: window.SwymConfig.shopDomain,
  currency: window.SwymConfig.currency,
  locale: window.SwymConfig.locale,
  // Add your custom options here
});
```

### Event Handling

The integration dispatches custom events you can listen to:

```javascript
// Swym loaded successfully
document.addEventListener('swym:loaded', (event) => {
  console.log('Swym is ready');
});

// Swym failed to load
document.addEventListener('swym:error', (event) => {
  console.error('Swym failed to load:', event.detail);
});
```

## Migration from Swym App

If you're migrating from the Swym app:

1. **Disable the App**: Remove the Swym app from your Shopify admin
2. **Configure Manual Integration**: Follow the setup instructions above
3. **Test Thoroughly**: Ensure all wishlist functionality works as expected
4. **Monitor Performance**: Check that page load times are acceptable

## Support

If you encounter issues:

1. Check the browser console for error messages
2. Verify your Swym credentials are correct
3. Test with a fresh browser session (clear cache)
4. Contact Swym support if credentials are incorrect
5. Check this documentation for troubleshooting steps

## Security Notes

- Store ID and API Key are visible in the page source (this is normal for Swym)
- These credentials are meant to be public-facing
- Do not use sensitive credentials that should be kept secret
- Swym handles security on their end

## Performance Considerations

- Scripts load asynchronously to avoid blocking page render
- Swym scripts are loaded from their CDN for optimal performance
- Wishlist data is cached in sessionStorage for faster subsequent loads
- The loader has a 10-second timeout to prevent hanging

---

**Last Updated**: 2025-01-08
**Version**: 1.0.0

