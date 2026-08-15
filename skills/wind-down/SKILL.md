---
name: wind-down
description: Close a session safely by updating the project's governance documents from disk. Use when the user says wind down, shutting down, closing up, end of session, or any equivalent. Also use before deliberately restarting a session, because a session that ends without this loses everything since the last update.
---

# Wind down

Stop all other work. This takes priority over anything in progress.

The job is to leave the project's record accurate enough that a fresh session, with none of
your context, can pick up exactly where this one stopped.

---

## The rule that makes this safe

**Everything you are holding in context may be stale.** Files change on disk while a
session runs: another session edits them, a sync overwrites them, the user edits them by
hand. If you write a governance document from what you remember, you silently delete
whatever changed since you loaded it.

This has happened. A document was regenerated from memory rather than from disk and
twenty-seven recorded decisions disappeared without anyone noticing.

So, for every file you touch, without exception:

1. **Read it from disk, in full, now.** Not from context, not from a summary, not from
   what you wrote earlier in this session.
2. **Edit that content in place.** Append rows; never regenerate a table.
3. **Show the diff before applying it.**

If you cannot read a file, say so and stop. Do not create a replacement.

---

## Step 1: find the documents

They are not always in the folder you are running in. Check, in order:

- the current directory
- its parent, if the parent is a venture folder holding several projects
- any path the project's `CLAUDE.md` imports with `@`

You are looking for `WARM_START.md` and `WAYS_OF_WORKING.md`.

Older projects may also carry a `SOURCE_OF_TRUTH.md`. That is retired. Leave it alone
rather than updating it, and mention it so it can be folded into the other two and removed.

If they genuinely do not exist, say so plainly and ask whether to scaffold them from
`_STUDIO/new-project/`. Do not invent them silently at wind-down; that is the worst moment
to be authoring a first draft.

---

## Step 2: read them, and say what you found

Report the path, the size and the last-modified time of each file before you change
anything. If a file was modified after this session started, say so explicitly. That is
the signal that something else has been writing, and the user needs to know before you
edit.

---

## Step 3: update WARM_START.md

This is session state. It answers "where are we right now".

- **Current state.** What is true of the project as of this moment.
- **Next action.** The single next thing, specific enough to act on without asking.
- **Session log.** Append what this session did. Do not rewrite earlier entries.
- **Decisions made.** Anything settled this session, with who settled it.
- **Prompt to resume.** Rewrite this every time. Someone pasting it into a fresh session
  must be able to continue with zero additional context. It is the most valuable thing in
  the file and the most often left stale.

Record what is half-finished and exactly where it stopped. "Mid-way through the tenant
filter on the property service, service layer done, controller not started" is useful.
"In progress" is not.

---

## Step 4: update WAYS_OF_WORKING.md

This is the durable record: architecture, decisions, schema, status, risks.

- **Decisions table is append-only.** A reversal is a new row explaining the reversal, not
  an edit to the original. Never delete a row. It is an audit trail.
- **Schema or data-model changes** get recorded even if not yet built.
- **New screens, tables, endpoints or agents** get recorded when identified, not when
  finished.
- **Risks and known issues** get added as found, with severity.
- **Build status** reflects reality, including what is broken.

---

## Step 5: show the diff, then apply

For each file, show: rows added, rows edited, and confirmation that untouched sections
were preserved verbatim. Then apply the edits.

The diff is the user's review point. Never apply silently.

---

## What not to touch

**Do not edit `.claude/agents/`.** Those files are generated from the studio base plus this
project's overlay. Anything written there is destroyed on the next compose, and it will
not reach any other project.

**Do not `git add .claude/agents/`.** It is build output.

**Do not commit or deploy anything as part of winding down**, unless the user asks. Winding
down records state; it does not ship.

---

## If you are asked to commit the governance documents

This is the moment wind-down turns dangerous, because it is when someone reaches for
`git add -A`. Four checks first, in order. None is optional.

**Which repository are you actually in?** Run `git rev-parse --show-toplevel`. A project
folder can contain a nested repository with its own `.git`, and a parent `.gitignore`
excluding that folder is usually why: you cannot sensibly track a nested repo's files from
outside it. If the documents live in the nested repo, commit them there.

Read the comment above an ignore rule, not just the rule. The rule tells you what is
excluded; the comment tells you why, and the why usually contains the answer.

**Untracked is not the same as ignored.** A file that is untracked *and unignored* appears
as `??` in `git status` and is one `git add -A` from being committed permanently. An
ignored file does not appear at all. Never conclude a sensitive file is safe because
nothing has committed it yet.

Before staging anything, list what is untracked and unignored, and look for credential
shapes in the names and contents: `.env`, anything with `secret`, `key`, `token` or
`credentials` in the name, service-account JSON, and long base64-looking strings. Report
what you find without opening or printing the values.

**A nested repository inherits none of the parent's protections.** Every secret rule in the
parent `.gitignore` stops at that boundary. If the nested repo needs the same rules, it
needs its own copy of them. Fix the ignore rules *before* the first commit, not after; once
a credential is in history, removing it is a rewrite, not a delete.

**Stage by name. Never `git add -A` or `git add .`** in a wind-down. You are committing two
or three known documents, so name them.

**Then check the repository has a remote.** `git remote -v`. A commit with no remote buys
integrity but not durability: the history dies with the disk, and surviving the machine is
half the point of writing state down. If there is no remote, say so plainly rather than
reporting the commit as done.

After committing, confirm what actually went in with `git show --stat`, and say if anything
unexpected came along.

---

## Step 6: confirm and stop

Say "wind-down complete" and stop. State in one line what a fresh session should do next.

If anything could not be completed, say what and why rather than reporting success. An
incomplete wind-down that is reported honestly is recoverable. One reported as done is not.

---

## After this

If the session is being restarted rather than closed, tell the user to start a **fresh**
session rather than resuming. Resuming restores the transcript, which brings the stale
context straight back and defeats the point of the read-before-write you just did.
