---
name: commit
description: Groups working-tree changes into logical commits and commits them using conventional commit rules (type, optional scope, subject; commitlint). Use when the user asks to commit, group commits, stage and commit, or write conventional commits.
---

# Commit (group + conventional)

Group changes by purpose, then commit each group. A conventional message is optional; when the user provides or wants one, use the format below so commitlint and semantic-release stay happy.

## Workflow

1. **Inspect** — Get full picture of changes (git status, git diff).
2. **Group** — Partition by type: feat, fix, docs, style, refactor, perf, test, build, ci, chore.
3. **Commit each group** — If the user wants a message: type(scope): subject, imperative, lowercase, no period, ≤100 chars. If they don't, commit without message or with a minimal one (e.g. chore: wip).
4. **Validate** — commit-msg hook may reject invalid messages when a message is used.

## Message rules (commitlint, when a message is used)

- **Types:** feat, fix, docs, style, refactor, perf, test, build, ci, chore.
- **Header:** type(scope): subject — subject optional; max 100 chars when present. Body lines max 200.
- **Imperative, present tense:** "add feature" not "added feature".

## Examples

feat(init): add store alias prompt
fix(sync): prevent overwrite of unchanged files
docs: add conventional commit section to CONTRIBUTING
