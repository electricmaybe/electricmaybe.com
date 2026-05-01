---
name: liquid-doc-comments
description: Adds or updates LiquidDoc documentation blocks in Liquid snippets and blocks. Use when the user says "add LiquidDoc", "document this snippet", "add doc block", or "update snippet docs". Follows liquid-doc-rules.mdc.
---

# Liquid Doc Comments

Adds or updates the `{%- doc -%}` block at the top of a snippet or block so it meets project LiquidDoc standards.

## Rules to Apply

Before writing or editing doc blocks, read and apply:

1. `.cursor/rules/00-rule-index.mdc` — rule index
2. `.cursor/rules/liquid-doc-rules.mdc` — required structure, @param format, @example, types, placement

## Workflow

1. **Identify file** — Snippet in `snippets/` or block in `blocks/`. If user didn’t specify, use current file or ask.
2. **Load rules** — Read liquid-doc-rules.mdc for exact `{%- doc -%}` format, parameter types, and example requirements.
3. **Inspect snippet/block** — List parameters (from `render` usage or Liquid assigns). Note required vs optional. Infer types (string, number, boolean, object).
4. **Write or replace doc block** — At top of file (after any initial comment):
   - One-sentence description, then 2–3 sentences detail.
   - `@param {type} name` for each parameter; `[optional_param]` for optional.
   - At least one `@example` with realistic `{% render 'snippet', param: value %}`.
5. **Preserve whitespace** — Use `{%- doc -%}` and `{%- enddoc -%}`. No stray newlines that would break LiquidDoc parsing.
6. **If updating** — Merge new params into existing doc; don’t remove existing examples unless redundant.

## Output

- Edit the file(s) with the new or updated doc block.
- Briefly list what was added (params, examples) so the user can verify.

## Example Trigger

User: "Add LiquidDoc to this snippet" (with a snippet open).  
→ Add a full `{%- doc -%}` block at the top per liquid-doc-rules.mdc, with params and at least one example.
