---
name: section-from-spec
description: Creates new Shopify theme sections and snippets from a spec or description. Use when the user asks for a new section, new snippet, "section from spec", "create section", or "add a section/snippet". Follows project section, snippet, schema, and Liquid doc rules.
---

# Section / Snippet from Spec

Creates a new section (and optional snippet) from a user spec, following project conventions.

## Rules to Apply

Before creating any section or snippet, read and apply (in order):

1. `.cursor/rules/00-rule-index.mdc` — rule index
2. `.cursor/rules/sections.mdc` — section structure, schema requirement, performance
3. `.cursor/rules/snippets.mdc` — snippet patterns, LiquidDoc, parameter handling
4. `.cursor/rules/schemas.mdc` — minimal settings, no redundancy, translation keys, max 5 settings
5. `.cursor/rules/liquid.mdc` — Liquid syntax
6. `.cursor/rules/liquid-doc-rules.mdc` — required `{% doc %}` block format for snippets

## Workflow

1. **Clarify scope** — Section only, or section + snippet(s)? Which template(s) will use it?
2. **Naming** — Use project convention: `section-name--variant.liquid` or `snippets/prefix--name.liquid`. Check existing `sections/` and `snippets/` for patterns.
3. **Schema** — Minimal settings only. Prefer translation keys over schema text inputs. Max 5 settings per section (excluding headers). No redundant toggles.
4. **Section file** — Semantic HTML, section-scoped CSS classes, `{% schema %}` with valid JSON. Include translation keys for all user-facing text.
5. **Snippet(s)** — If needed: LiquidDoc at top (`{%- doc -%}`), parameter defaults and validation, one clear responsibility per snippet.
6. **Templates** — If the user specified a template (e.g. product, collection), add the section to the appropriate JSON template in `templates/` if requested.

## Output

- Create or edit files under `sections/` and optionally `snippets/`.
- Summarize what was created and where (file paths, schema settings, snippet params).
- Note any translation keys added that need entries in `locales/`.

## Example Trigger

User: "Add a section that shows a heading and a grid of 4 product cards, with a setting for the collection."  
→ Create `sections/s--product-grid.liquid` with minimal schema (e.g. collection picker, heading key), optional snippet for the card if it doesn’t exist.
