# Startup Studio Kanban: required contract

Every project runs the Startup Studio Kanban, and it is the single work queue. This file is the
contract. Build to it exactly rather than inventing a shape per project, because the
agents are written against these statuses and this ownership boundary. Change the shape
and the roster stops matching the tool.

A reference implementation lives in `reference/`. Start from it.

---

## Statuses

Ten. Eight of them are the column statuses, in this order and with these exact keys.
A ticket has exactly one status.

```
backlog  todo  in_progress  uat  uat_complete  prod_ready  prod_deployed  done
```

Two further statuses are terminal and render as no column at all:

```
parked  killed
```

A ticket is `parked` when it was started and deliberately stopped, and `killed` when it was
decided against. Both require a reason. They exist because everything started has to end
explicitly: finished, parked with a reason, or killed. Four things at sixty per cent ship
nothing, and a board that can only express `done` quietly encourages exactly that.

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
| `status` | One of the ten above. |
| `release_version` | The build tag at UAT and at PROD. **Writable by the agents only, read-only in the UI.** |
| `assignee` | Whoever the project says. Declared per board, and declaring nothing means no restriction. A fixed studio-wide list is what made one existing board impossible to migrate. |
| `created_at` / `updated_at` | Timestamps. |
| `deleted_at` | Set when a ticket is hidden. Never removed. See below. |

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
rm <id|titleMatch>                  hides it, does not destroy it
restore <id|titleMatch>             brings a hidden ticket back
deleted                             list what is hidden
```

Matching accepts a full id, an id prefix, or a unique case-insensitive title substring.

**`list` prints titles only.** That is why the standing rule exists that a ticket is never
judged from its title. Open it and read the description first.

## Deletion is recoverable, and the database is what makes it so

Deleting a ticket hides it. The row, its number and its whole running record survive, and
`restore` brings it back. Ticket numbers are never reused, so a restored ticket cannot
collide with one handed out after it was hidden.

**The control is the revoke, not the flag.** Hard delete is taken away from the signed-in
role, so it cannot be issued by the UI, by the CLI, or by anyone holding the publishable key
and a shell. A flag that the application is merely trusted to honour is not a control at all,
because the data API is reachable directly and does not care what the page chose to send.

The confirmation dialog must say what actually happens. It said "permanently" and "cannot be
undone" for some time after both became false, and a warning that overstates its consequence
teaches people to ignore the ones that do not.

## Security, learned the hard way

**No project ever holds a key that bypasses row-level security.** The CLI used to authenticate
with exactly such a key, which meant that on a shared backend every project would have held a
credential able to read and write every other project's board, and no policy could have
revoked it. A policy cannot constrain a key that is defined as outranking policies.

So the CLI signs in as a **per-project bot user** and obeys the same rules as the UI and the
API. One bot per project, never shared: a bot that is a member of two boards can reach both.
The CLI **refuses to start** if it finds a service-role key in its environment, and the deploy
step refuses to publish with one in scope.

Credentials are read from the environment, never embedded. The file holding them is
gitignored, **and the ignore rule goes in before the first commit**. A credential removed
afterwards is a history rewrite, not a delete, and it stays valid until it is rotated.

The repository carries a **hygiene check that fails if a privileged credential appears in any
tracked file**. A rule nobody checks is a rule that eventually breaks, so it is automated
rather than remembered. `reference/hygiene-check.js` is that check.

**Prove the isolation, do not assert it.** `reference/isolation-checks.sql` carries the
proofs with the required result written beside each. The one that counts is the negative
control: a bot pointed at a board it does not belong to must be refused by name. Every other
check confirms a bot can see what it should; only that one confirms it cannot see what it
should not, and a control nobody has seen fail is a control nobody has tested.

---

## Why this is fixed rather than per project

The board is the interface between the founder and the team. Every agent in the roster is
written against these statuses, this ownership boundary and this CLI. A project that
invents its own column names or lets a human set `prod_deployed` has broken the contract
the agents rely on, and the failure will look like the agents behaving strangely rather
than like a board misconfiguration.

Project-specific choices belong in the parts this spec leaves open: where it is hosted,
what backs it, who the assignees are, and how access is gated.
