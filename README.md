# ⚡️ Voldt Shopify Theme

Modern Shopify theme for Voldt built with Tailwind CSS v4, a custom JavaScript build system, and Shopify CLI. It focuses on responsive design, performance optimization, and modular component architecture.
## Tech Stack

- **Shopify CLI** - Theme development and deployment
- **Tailwind CSS v4** - Utility-first CSS framework with CLI
- **Custom Build System** - JavaScript bundling and processing
- **Liquid** - Shopify templating language
- **PostCSS** - CSS processing and optimization

## Installation
### 1. Install Shopify CLI
- Make sure you have [Homebrew](https://brew.sh/) installed
- Open your terminal app
- Run `brew tap shopify/shopify`
- Run `brew install shopify-cli`
- After the installation is completed, run `shopify version`, if this outputs a version number you've successfully installed the CLI.

### 2. Authenticate Shopify CLI

Authenticate with the Voldt Shopify store:

```shell
$ shopify login --store=<your-voldt-store>.myshopify.com
```

When prompted, open the provided URL in your browser and log in with your Shopify partner account.

### 3. Clone and Setup

Clone this repository and install dependencies:

```shell
$ git clone https://github.com/electricmaybe/electricmaybe.com.git
$ cd electricmaybe.com
$ npm install
```

## Development

### Start Development Server

```shell
$ npm run tailwind:watch
```

This command runs:
- Tailwind CSS compilation with watch mode
- JavaScript build system with file watching
- Shopify theme development server
- All processes run concurrently for optimal development experience

### Build for Production

```shell
$ npm run tailwind:build
```

Generates minified CSS and optimized JavaScript bundles for production deployment.

### Available Scripts

- `npm run shopify:serve` - Start Shopify development server only
- `npm run scripts:build` - Build JavaScript files once
- `npm run scripts:watch` - Watch and rebuild JavaScript files
- `npm run lint:liquid` - Lint Liquid templates
- `npm run lint:js` - Lint JavaScript files  
- `npm run lint:css` - Lint CSS files

## Architecture

### Build System

The theme uses a custom JavaScript build system (`build-scripts.js`) that:
- Processes ES6 imports from `_scripts/` directory
- Concatenates files in dependency order
- Outputs bundled JavaScript to `assets/index.js`

**Entry Point:** `_scripts/main.js`
**Output:** `assets/index.js`

### CSS Processing

Tailwind CSS v4 with CLI processes styles:
- Source: `_styles/main.css`
- Output: `assets/style.css`
- Includes PostCSS processing and autoprefixing

## Git Workflow

### Branch Strategy
- `main` - Production branch synced with live theme
- Feature branches for development
- Pull requests required for main branch

### Issue Tracking
Issues tracked via project management system.

### Commit Convention

Follow conventional commit format with emoji prefixes:

```
<emoji> <type>: <description>
```

**Types:**
- 🔨 `fix:` - Bug fixes
- 🚀 `feat:` - New features  
- 🏗️ `refactor:` - Code refactoring
- 🎨 `style:` - UI/styling changes
- 🔥 `remove:` - Code removal
- 🤖 `chore:` - Maintenance tasks
- 📝 `docs:` - Documentation
- ⬆️ `upgrade:` - Dependencies

**Example:**
```
🔨 fix: modal close button not working

Click event was failing due to querySelector typo
```

## Project Structure

```text
Voldt/
├── _scripts/                  📁 JavaScript source files
│   ├── main.js               📄 Build system entry point
│   ├── utils/                📁 Utility functions
│   └── *.js                  📄 Component scripts
├── _styles/                   📁 CSS source files  
│   ├── main.css              📄 Tailwind entry point
│   ├── atoms/                📁 Atomic design components
│   ├── molecules/            📁 Molecular design components
│   └── core/                 📁 Base styles
├── assets/                    📁 Compiled assets & static files
│   ├── index.js              📄 Compiled JavaScript bundle
│   ├── style.css             📄 Compiled CSS
│   └── *.{woff2,png,js}      📄 Fonts, images, vendor scripts
├── blocks/                    📁 Theme blocks (Shopify 2.0)
├── config/                    📁 Theme settings
├── layout/                    📁 Layout templates
├── locales/                   📁 Translation files
├── sections/                  📁 Theme sections
│   ├── s--*.liquid           📄 Standalone sections
│   ├── api--*.liquid         📄 API/AJAX sections
│   └── *.liquid              📄 Standard sections
├── snippets/                  📁 Reusable code snippets
│   ├── a--*.liquid           📄 Atomic components
│   ├── m--*.liquid           📄 Molecular components
│   └── *.liquid              📄 Utility snippets
├── templates/                 📁 Page templates
├── build-scripts.js           📄 Custom JavaScript build system
├── nodemon.json              📄 File watcher configuration
└── package.json              📄 Dependencies and scripts
```

### Naming Conventions

- `s--` prefix for standalone sections
- `api--` prefix for AJAX/API sections  
- `<template>--` prefix for template specific sections
- `a--` prefix for atomic components
- `m--` prefix for molecular components
- `_` prefix for source directories (not deployed)
- test
