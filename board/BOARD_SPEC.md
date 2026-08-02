# Startup Studio Kanban: required contract

Every project runs the Startup Studio Kanban, and it is the single work queue. This file is the
contract. Build to it exactly rather than inventing a shape per project, because the
agents are written against these statuses and this ownership boundary. Change the shape
and the roster stops matching the tool.

A reference implementation lives in `reference/`. Start from it.

---

## Statuses

Eight, in this order, and these exact keys. A ticket has exactly one.

```
backlog  todo  in_progress  uat  uat_complete  prod_ready  prod_deployed  done
```

## Columns

Seven display columns. `uat` and `uat_complete` both render in the UAT column, with
`uat_complete` carrying a visible chip so a tested ticket is distinguishable at a glance.

```
BACKLOG  TO DO  IN PROGRESS  UAT  PROD READY  PROD DEPLOYED  DONE
```

Only Backlog and To Do get an "add ticket" control. Work is never created directly into
a later column, because a ticket that appears mid-board has skipped the queue.

## Ticket fields

| Field | Rule |
|---|---|
| `title` | A short summary. Never the requirements. |
| `description` | Where the real requirements live, and the running record. Agents append progress, decisions and assumptions here as they work. |
| `status` | One of the eight above. |
| `release_version` | The build tag at UAT and at PROD. **Writable by the agents only, read-only in the UI.** |
| `assignee` | The agent squad, the founder, or unassigned. |
| `created_at` / `updated_at` | Timestamps. |

## The ownership boundary, non-negotiable

The agents move a ticket as far as `uat` on their own, tagging `release_version` with the
UAT build. Within the team that move belongs to qa-tester alone: the tech lead deploys and
tags, and the ticket only reaches the UAT column once QA has verified it and written test
notes a person can follow. A ticket in UAT without test notes is a process failure.

The founder tests in UAT and sets `uat_complete`. Nothing leaves UAT without that. This is
the whole point of the board and it is never automated away.

`prod_deployed` is set by the agents only, and only on an explicit instruction to deploy.
The UI must block a human from selecting it, and must block editing `release_version`, so
the boundary is enforced by the tool rather than by everyone remembering it.

`done` means live in production. Not merged, not deployed to a test environment, live.

## Driving it

The agents drive the board from the terminal through a CLI, never by hand in the UI and
never by asking a person to click. The command surface:

```
list [status]                       titles by column
add "Title" [status] [assignee]     create, into backlog or todo only
move <id|titleMatch> <status>       progress a ticket
assign <id|titleMatch> <who>
title <id|titleMatch> "New title"
desc <id|titleMatch> "New description"
version <id|titleMatch> "uat-YYYYMMDD"
rm <id|titleMatch>
```

Matching accepts a full id, an id prefix, or a unique case-insensitive title substring.

**`list` prints titles only.** That is why the standing rule exists that a ticket is never
judged from its title. Open it and read the description first.

## Security, learned the hard way

The CLI holds a privileged key that bypasses row-level access rules. Three rules follow,
and they are not optional.

The CLI file is **server-side only** and never copied into any public or client directory.

The CLI file is **in `.gitignore`**, so the key cannot be committed by accident.

The repository carries a **hygiene test that fails if a privileged key appears in any
tracked file**. A rule nobody checks is a rule that eventually breaks, so the check is
automated rather than remembered.

Better still, read the key from the environment rather than embedding it. The reference
implementation does this.

---

## Why this is fixed rather than per project

The board is the interface between the founder and the team. Every agent in the roster is
written against these statuses, this ownership boundary and this CLI. A project that
invents its own column names or lets a human set `prod_deployed` has broken the contract
the agents rely on, and the failure will look like the agents behaving strangely rather
than like a board misconfiguration.

Project-specific choices belong in the parts this spec leaves open: where it is hosted,
what backs it, who the assignees are, and how access is gated.
