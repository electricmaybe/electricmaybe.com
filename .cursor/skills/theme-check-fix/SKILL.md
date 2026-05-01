---
name: theme-check-fix
description: Runs Theme Check (or similar) and suggests fixes using project Liquid and section rules. Use when the user says "theme check", "run theme check", "fix theme errors", or "lint theme". Follows liquid and section rules.
---

# Theme Check + Fix

Runs theme linting (e.g. Shopify Theme Check) and maps each finding to project rules, then suggests concrete fixes.

## Rules to Apply

When interpreting results and suggesting fixes, read and apply:

1. `.cursor/rules/00-rule-index.mdc` — rule index
2. `.cursor/rules/liquid.mdc` — Liquid syntax and usage
3. `.cursor/rules/sections.mdc` — section structure and schema
4. `.cursor/rules/snippets.mdc` — snippet patterns

## Workflow

1. **Run Theme Check** — Execute the project’s theme check command (e.g. `theme check`, or `shopify theme check`). If no command is known, suggest the user run it and paste the output, or run a generic check if available.
2. **Parse output** — List each issue: file, line (if any), rule/code, message.
3. **Map to project rules** — For each issue, determine which project rule applies (Liquid, sections, snippets) and load that rule file if not already in context.
4. **Suggest fixes** — For each finding, provide:
   - Short explanation (why it’s flagged)
   - Exact edit (or step) to fix it, consistent with project rules
   - File and location
5. **Prioritize** — Errors first, then warnings. Security and correctness before style.

## Output Format

```markdown
## Theme Check results

### Errors
- **[file:line]** [rule] — [message]. **Fix:** [concrete suggestion]

### Warnings
- ...
```

If the user wants fixes applied, make the edits; otherwise output the list and let them choose.

## Example Trigger

User: "Run theme check and fix what you can."  
→ Run (or ask for) theme check output, then go through each item with rule-based fix suggestions and apply edits where appropriate.
