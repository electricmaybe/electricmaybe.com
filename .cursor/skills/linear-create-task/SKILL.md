---
name: linear-create-task
description: Creates Linear issues in the Voldt Redesign project with PRD-style descriptions. Use when the user says "create Linear task", "add Linear issue", "create task in Linear", "/linear-task", or describes a feature/fix and asks to put it in Linear. Assigns to Berk (coding) or Taha (design). Supports attaching images/videos to the issue and using them to enrich the PRD. Uses user-Linear MCP.
---

# Linear Create Task

Creates a Linear issue in the **Voldt Redesign** project with a PRD-style description, sensible defaults for milestone and labels, and assignee by task type. Uploads user-provided images/videos as attachments and uses them to enhance the description.

## Rules to Apply

Before creating a task, read `.cursor/rules/00-rule-index.mdc`. No other rule file is required; mention commit-rules only if the user wants a branch name convention.

## Linear Context

- **Project:** `Voldt Redesign — [12.07]` or `voldt redesign`
- **Team:** `Electric Maybe` (required for `save_issue`)

**Milestones (use exact name):**

| Name | Description |
|------|-------------|
| Core Commerce Design | Product, cart, header, footer templates |
| Merch Design | Home, collection, search templates |
| Content Design | The rest of the templates |
| Core Commerce Dev | Product, cart, header, footer |
| Merch Dev | Home, collection, search |
| Content Dev | The rest |

**Labels (team Electric Maybe) — use as needed:**

- **Type:** `🚀 feat`, `🔨 fix`, `🔁 change`, `🔥 remove`, `🤖 chore`, `✅ QA`, `📣 marketing`, `💫 revision`, `🧱 section`, `📄 template`
- **Origin:** `project-requirement`, `client-request`, `qa-found`, `bug-discovered`, `internal-decision`
- **Team:** `dev`, `design`
- **Risk:** `!`, `!!`, `!!!`
- **Scope:** `collection template`, `product template`, `cart template`, or section/snippet names (e.g. `s--featured-collection`, `m--filters`)

If in doubt, call MCP `user-Linear` **list_milestones** with `project: "Voldt Redesign — [12.07]"` or **list_issue_labels** with `team: "Electric Maybe"` to refresh.

## PRD Description Structure

- **Title:** Short, clear (e.g. problem + solution in a few words).
- **Description (Markdown):**
  - Problem/context (1–2 sentences or bullets).
  - `### Requirements` or `### Structure` — e.g. metaobject fields, API, data model.
  - `### Proposed solution` — numbered steps (1. … 2. …).
  - `### Related files` — bullet list of paths (`snippets/…`, `sections/…`).
  - If user attached media: add `### Screenshots / reference` and describe what they show (do not invent; only what can be inferred).

Optional on the issue: **estimate** (points), **dueDate** (ISO), **parentId** (sub-task), **links** `[{url, title}]`, **state** (from **list_issue_statuses** for team).

## Workflow

1. **Gather input** — Title (required; from user or derived). Description/PRD: freeform; if minimal, expand into PRD structure above. Type: coding vs design (for assignee and labels). Milestone: from user or default `Merch Dev`. Labels: from user or defaults. Optional: estimate, due date, parent issue, state, links.
2. **Enhance PRD from media** — If the user attached images or videos, describe what they show and add a `### Screenshots / reference` section to the description. Do not invent details.
3. **Resolve project and team** — Use project `Voldt Redesign — [12.07]` and team `Electric Maybe`.
4. **Create issue** — Call MCP **user-Linear** tool **save_issue** with: `title`, `description` (Markdown), `team`, `project`, `milestone`, `labels`, `assignee` (Berk or Taha per rule below); optional `estimate`, `dueDate`, `state`, `parentId`, `links`. Capture the returned issue identifier (e.g. EM-xxxx).
5. **Attach media** — For each user-provided image/video: if you have file content or path, encode to base64 and call **user-Linear** **create_attachment** with the new issue identifier, `base64Content`, `filename`, `contentType` (e.g. `image/png`, `video/mp4`), and optional `title`.
6. **Confirm** — Reply with issue identifier (e.g. EM-xxxx), Linear URL, and what was set (title, assignee, milestone, labels, attachments). If assignee by name fails, use **list_users** to resolve by name and retry with the returned user id/email.

## Assignee Rule

- **Coding task** (implementation, fix, refactor, backend, Liquid/JS/CSS, “dev”): assignee **Berk** (e.g. `assignee: "Berk"` or email if needed).
- **Design task** (Figma, UI/UX, visual, layout, “design”): assignee **Taha** (e.g. `assignee: "Taha"` or email if needed).
- If unclear, ask or default to Berk. Resolve via **list_users** if name resolution fails.

## Defaults (when user does not specify)

- **Milestone:** `Merch Dev`
- **Labels:** at least `project-requirement` + `dev` (coding) or `design` (design) + one type label: `🚀 feat`, `🔨 fix`, or `🤖 chore` as appropriate
- **State:** leave unset (Linear default) unless the user specifies one; optionally call **list_issue_statuses** with `team: "Electric Maybe"` and pick Backlog/Todo if you want to set state explicitly.

## MCP Tools (user-Linear)

- **save_issue** — Create the issue (required: `title`, `team`; use `project`, `milestone`, `labels`, `assignee`, `description`; optional: `estimate`, `dueDate`, `state`, `parentId`, `links`).
- **create_attachment** — After issue is created: `issue` (identifier from save_issue response), `base64Content`, `filename`, `contentType`, optional `title`, `subtitle`.
- **list_milestones** — Optional: `project: "Voldt Redesign — [12.07]"` to refresh milestone list.
- **list_issue_labels** — Optional: `team: "Electric Maybe"` to refresh labels.
- **list_issue_statuses** — Optional: `team: "Electric Maybe"` to set state.
- **list_users** — If assignee by name fails, resolve Berk/Taha and retry with id or email.
- **get_issue** — Optional: confirm issue after creation.
