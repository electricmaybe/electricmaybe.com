---
name: changelog-release
description: Generates changelog or release notes from git history using project commit conventions. Use when the user says "changelog", "release notes", "what changed since last tag", or "list commits for release". Follows commit-rules types (feat, fix, refactor, etc.).
---

# Changelog / Release Notes

Builds a changelog or release notes from commits since a ref (e.g. last tag), grouped by project commit types.

## Rules to Apply

When grouping and labeling commits, read and apply:

1. `.cursor/rules/00-rule-index.mdc` — rule index
2. `.cursor/rules/commit-rules.mdc` — commit types (fix, feat, refactor, style, etc.) and format

Use the same type labels for changelog sections so the output matches how the team writes commits.

## Workflow

1. **Determine range** — Since last tag: use the **highest semver** among tags merged into `HEAD` (merged-into + `sort -V`), then `git log TAG..HEAD`. Do not rely on `git describe` alone after branch merges—it can return a **lower** version that is graph-closer on the merged branch. Or use a branch/commit the user specifies. If unclear, default to "since last tag".
2. **Get commits** — Run `git log --oneline [range]` (or with `--pretty=format:...` for message + body). Parse commit messages.
3. **Group by type** — Map each commit to a type from commit-rules.mdc (fix, feat, refactor, style, remove, wip, docs, ai, chore, upgrade). Ignore merge commits. Put "unknown" or "other" for non-matching messages.
4. **Format** — Output markdown:
   - Optional title (e.g. "Changelog since v1.2.0")
   - Sections by type (e.g. "## Features", "## Fixes")
   - Under each section: list of commit descriptions (one line each, link to commit if desired).
5. **Optional** — Add "Breaking changes" subsection if any commit message indicates breaking change (e.g. `!` or "BREAKING CHANGE").

## Output Format

```markdown
# Changelog (since [ref])

## Features
- add product quick view modal
- implement infinite scroll for collections

## Fixes
- resolve cart total calculation error
- modal close button not working

## Refactor
- optimize product card rendering
```

## Example Trigger

User: "Generate changelog since last tag."  
→ Resolve last tag, get `git log` since then, group by commit-rules types, output structured changelog.
