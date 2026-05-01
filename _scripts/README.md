# Script Build System

This folder contains modular JavaScript files that get concatenated into `assets/index.js` during the build process.

## How it works

1. **Main Entry Point**: `main.js` is the entry point that imports all other script files
2. **Modular Scripts**: Each script file contains a specific component or functionality
3. **Build Process**: The build script reads `main.js`, follows all imports, and concatenates them into a single file

## Adding New Scripts

1. Create a new `.js` file in the `_scripts` folder
2. Add your JavaScript code to the file
3. Import it in `main.js`:
   ```javascript
   import './your-new-script.js';
   ```

## Build Commands

- `npm run scripts:build` - Build scripts once
- `npm run scripts:watch` - Watch for changes and rebuild automatically
- `npm run tailwind:watch` - Watch both CSS and JS files (recommended for development)
- `npm run tailwind:build` - Build both CSS and JS files for production

## Example Script Structure

```javascript
// _scripts/quantity-input.js
class QuantityInput extends HTMLElement {
  // Your component code here
}

customElements.define('quantity-input', QuantityInput);
```

```javascript
// _scripts/main.js
import './quantity-input.js';
// Add more imports here
```

## Notes

- The build system automatically handles dependencies and prevents circular imports
- Import statements are removed from the final output
- Files are processed in dependency order
- The final output is written to `assets/index.js`

## Key Components

### Electric Disclosure System (`electric-disclosure.js`)

A comprehensive disclosure system providing both accordion and dropdown functionality with shared base functionality.

#### Features
- **Shared Base Class**: `ElectricDisclosure` provides common functionality
- **Accordion Disclosure**: `AccordionDisclosure` with smooth height animations
- **Dropdown Disclosure**: `DropDownDisclosure` with absolute positioning and outside click detection
- **Sync Groups**: Multiple disclosures can be synchronized to close others when one opens
- **Accessibility**: Full ARIA support, keyboard navigation, and screen reader compatibility
- **Error Handling**: Graceful error handling with custom events

#### Usage

**Accordion Disclosure:**
```html
<accordion-disclosure data-sync-group="faq">
  <details>
    <summary>FAQ Item</summary>
    <div>Answer content with smooth animations</div>
  </details>
</accordion-disclosure>
```

**Dropdown Disclosure:**
```html
<dropdown-disclosure data-sync-group="filters">
  <details>
    <summary>Filter Options</summary>
    <div class="absolute top-full left-0 z-50">Filter content</div>
  </details>
</dropdown-disclosure>
```

**Keyboard Navigation:**
- `Enter` or `Space`: Open/close disclosure
- `Arrow Down/Right`: Open disclosure (accordion) or move to first focusable element
- `Arrow Up/Left`: Close disclosure (accordion)
- `Escape`: Close disclosure and return focus to summary

**Custom Events:**
- `disclosure:opened` - Fired when disclosure opens
- `disclosure:closed` - Fired when disclosure closes
- `disclosure:error` - Fired when an error occurs

**Utility Methods:**
```javascript
// Find all disclosures of a specific type
const accordions = ElectricDisclosure.findDisclosures('accordion-disclosure');

// Close all disclosures of a specific type
ElectricDisclosure.closeAll('dropdown-disclosure');
``` 