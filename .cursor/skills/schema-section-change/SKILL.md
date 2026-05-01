---
name: schema-section-change
description: Adds or changes a section setting (schema) and keeps section Liquid in sync. Use when the user asks to "add a section setting", "add schema setting", "new section option", or "change section config". Follows schema and section rules.
---

# Schema / Section Change

Safely adds or changes a section setting: updates both the section Liquid and the `{% schema %}` block, with defaults and locales in mind.

## Rules to Apply

Before making changes, read and apply:

1. `.cursor/rules/00-rule-index.mdc` — rule index
2. `.cursor/rules/schemas.mdc` — minimal settings, no redundancy, translation keys, max 5 settings, "question every setting"
3. `.cursor/rules/sections.mdc` — section structure and schema requirement

## Workflow

1. **Clarify** — Which section file? What setting (e.g. toggle, select, range, color)? Should it be in a block or at section level?
2. **Validate need** — Per schemas.mdc: Is this necessary? Could it be translation/CSS/existing theme setting instead? If adding multiple settings, confirm with user.
3. **Schema** — Add or edit the setting in `{% schema %}`:
   - Use correct type (checkbox, select, range, color, text, etc.).
   - Sensible default. For text, prefer translation key reference in schema (e.g. label only) and actual copy in locales.
   - Keep max 5 settings per section; use headers to group if needed.
4. **Section Liquid** — Use the new setting in the section (e.g. `section.settings.setting_id`). Provide defaults in Liquid if needed (e.g. `section.settings.foo | default: 'bar'`).
5. **Locales** — If the setting exposes a label or option text that should be translatable, add or point to keys in `locales/` (e.g. `en.default.json`). Don’t duplicate long copy in schema.
6. **Blocks** — If the setting is on a block, ensure block schema and Liquid both use it; preserve existing block structure.

## Output

- List exact edits (file + snippet of change).
- Note any new locale keys to add.
- Remind about max 5 settings and "prefer translations over schema text" if relevant.

## Example Trigger

User: "Add a setting to turn the heading off in the FAQ section."  
→ Edit `sections/collection--faq.liquid` (or the correct FAQ section): add a checkbox in schema, use it in Liquid to hide the heading, add/use a translation key for the setting label if needed.
