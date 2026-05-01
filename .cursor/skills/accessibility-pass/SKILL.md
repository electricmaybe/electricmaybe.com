---
name: accessibility-pass
description: Runs an accessibility audit on a section, snippet, or component. Use when the user says "accessibility pass", "a11y audit", "check accessibility", "WCAG check", or "audit this section/snippet". Follows project accessibility rules.
---

# Accessibility Pass

Runs a structured a11y audit on specified file(s) and reports findings with fix suggestions.

## Rules to Apply

Before auditing, read and apply:

1. `.cursor/rules/00-rule-index.mdc` — rule index
2. `.cursor/rules/accessibility-rules.mdc` — WCAG 2.1 AA, semantic HTML, ARIA, keyboard, focus, screen readers

## Workflow

1. **Identify scope** — User specifies file(s) or "current file". If unspecified, ask or assume the file they have open.
2. **Load rules** — Read `accessibility-rules.mdc` and use it as the checklist basis.
3. **Audit** — Go through the file(s) and check:
   - Semantic structure (headings, landmarks, lists)
   - ARIA (only when needed; state sync with JS if applicable)
   - Keyboard (focusable elements, tab order, visible focus, Escape/Enter/Space)
   - Images (alt text; decorative with empty alt or aria-hidden)
   - Forms (labels, errors, required)
   - Links/buttons (descriptive text, no "click here")
   - Dynamic content (live regions if content updates)
4. **Report** — For each finding:
   - Location (element or line)
   - Issue (what’s wrong)
   - WCAG criterion if relevant
   - Suggested fix (concrete code or change)
5. **Severity** — Label as Critical (blocks access), Suggestion (improvement), or Nice-to-have.

## Output Format

```markdown
## Accessibility audit: [file path]

### Critical
- **[Element/location]** — [issue]. [Fix].

### Suggestions
- ...

### Nice-to-have
- ...
```

## Example Trigger

User: "Run an accessibility pass on this section" (with `sections/product--main.liquid` open).  
→ Audit that file against accessibility-rules.mdc and output the structured report.
