---
name: commit-in-groups
description: Groups current working tree changes into logical commits and suggests commit messages per project convention. Use when the user says "/commit-in-groups", "commit in groups", "group my commits", "suggest separate commits", or "split my changes into commits". Follows commit-rules.mdc (type + description).
---

# Commit in Groups

Analyzes uncommitted changes, groups them into logical commits, and suggests one message per group using the project's commit format.

**Preference:** Prefer multiple commits unless changes are closely related. When in doubt, split into separate commits (e.g. tooling vs theme code, different features or areas). Only group into one commit when the changes clearly belong together (e.g. one feature and its snippet, or a single refactor touching several files for the same purpose).

## Rules to Apply

Before suggesting any commit messages, read and apply:

1. `.cursor/rules/00-rule-index.mdc` — rule index
2. `.cursor/rules/commit-rules.mdc` — commit format (type + description), types (fix, feat, refactor, style, etc.), imperative mood, optional scope

Use the exact format and types from commit-rules; no period at end; lowercase description.

## Workflow

1. **Get change summary** — Run `git status` and `git diff` (and `git diff --staged` if anything is staged). Identify all modified, added, and deleted files.
2. **Group logically** — Prefer more, smaller commits when changes are unrelated. Cluster only when clearly the same intent:
   - Unrelated areas (e.g. tooling/skills vs theme snippet, cart fix vs collection style) → separate commits
   - One feature (e.g. new section + its snippet) → one commit
   - Refactor in one area, fix in another → separate commits
   - Locale/schema/docs can be separate if they form a clear unit
   - When in doubt, split rather than combine
3. **Assign type** — For each group, pick the best type from commit-rules (fix, feat, refactor, style, remove, docs, chore, etc.) and optional scope (e.g. `sections`, `cart`, `locales`).
4. **Write messages** — One line per commit: `<type>(scope): <description>`. Imperative, lowercase, no period. Multi-line body only if the change is complex and warrants bullets.
5. **Output and execute** — List the suggested commits (message + files per commit), then **run the commits yourself**: for each group, run `git add` on the listed files and `git commit -m "..."` with the exact message. Do not only suggest commands; execute them so the working tree is left with the changes committed. Summarize what was committed at the end.

## Output Format

Show the plan briefly, then run it:

```markdown
## Suggested commits

**Commit 1:** `feat(sections): add featured collection section`
- `sections/s--featured-collection.liquid`
- `snippets/m--product-card.liquid`

**Commit 2:** `style(cart): adjust drawer spacing`
- `sections/cart--drawer.liquid`
- `assets/style.css`
```

Then execute: `git add` + `git commit` for each group in order. After running, confirm: "Done. Created N commits: …"

## Example Trigger

User: "/commit-in-groups" or "group my changes into separate commits."  
→ Run git status/diff, group changes, list commits with messages and file lists, then **run** `git add` and `git commit` for each group (do not only suggest commands).
