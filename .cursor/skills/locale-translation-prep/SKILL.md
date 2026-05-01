---
name: locale-translation-prep
description: Compares locale files and lists new or changed keys that need translation. Use when the user says "translation prep", "locale diff", "what needs translating", "missing translations", or "locale sync". Uses project locales (e.g. locales/*.json).
---

# Locale / Translation Prep

Compares the default locale with others and reports which keys are new or changed so translators know what to update.

## Rules to Apply

For context on how the project uses locales (e.g. in sections/snippets), the rule index is useful:

1. `.cursor/rules/00-rule-index.mdc` — rule index (schemas.mdc prefers translation keys over schema text; locales live in `locales/`)

No single "locale rules" file is required; this skill focuses on file comparison and reporting. To **generate** translations across locales after English changes, use the **theme-translator** subagent (`/theme-translator`), installed with the Cursor bundle under `.cursor/agents/`.

## Workflow

1. **Identify default locale** — Usually `locales/en.default.json` or `locales/en.json`. Confirm by checking `locales/` directory. List other locale files (e.g. `de.json`, `fr.json`).
2. **Collect keys** — Parse default locale (and schema locale files if present) to get the full list of translation keys (including nested keys; use dot or path notation for nesting).
3. **Compare** — For each other locale file:
   - Keys in default but missing in locale → "Missing"
   - Keys in default with different value in locale → "Changed" (default changed; translation may need update)
   - Keys in locale but not in default → "Obsolete" (optional to report)
4. **Report** — Output a concise list per locale:
   - **Missing keys** — List key paths so translators can add them.
   - **Possibly stale** — Keys where default changed (if we can detect; e.g. compare to previous default or just list "present in both" and note that defaults were updated).
5. **Optional** — Output a minimal JSON or CSV of missing keys for import into a translation tool. Or suggest adding keys to locale files with empty or placeholder values.

## Output Format

```markdown
## Translation prep (default: en.default.json)

### de.json
- **Missing:** `section.foo.title`, `snippet.bar.label`, ...
- **Note:** Default locale has X keys; de has Y. Z keys missing.

### fr.json
- **Missing:** ...
```

If the user wants, add stub entries (e.g. empty string or key as value) for missing keys in each locale file.

## Example Trigger

User: "What needs translating?"  
→ Compare `locales/en.default.json` (or project default) to other `locales/*.json`, list missing and optionally changed keys per file.
