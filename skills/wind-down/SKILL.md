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
- **A decision row is the rule and the reason it exists. Not the case study.** Two or three
  sentences: what was settled, and what it cost to learn. The story of how it was found belongs
  in the session log, and the detail belongs on the ticket. Both of those are read when somebody
  goes looking; this table is read in full at the start of every session, by every session,
  forever.

  This is not a style preference. These documents are `@`-imported by `CLAUDE.md`, so the whole
  table loads before any work begins, and Claude Code refuses to load a large one quietly. The
  figure it warns at is not documented here; what was observed is a session opening where one
  imported document had reached about 161,000 characters, and being warned before any work began. Two projects crossed that line without anyone noticing, because the only
  thing that reports it is the session that opens there and finds a warning. In one, decisions
  were 71 per cent of the file: ninety-five rows averaging 1,194 characters, the longest 3,607.

  If a row is running long, that is a signal the reasoning wants to live somewhere else, not a
  signal to write smaller. Put it on the ticket and leave the row saying what was decided.
- **When the table passes about 60,000 characters, archive rather than trim.** Size is the
  trigger rather than a row count, because rows vary: at the length they reached in the project
  that raised this, a hundred rows was already 119,000 characters and past the point of warning.
  As a rough guide that is somewhere around fifty entries, but measure rather than count.
  **Archive all but the most recent twenty**, move them to `DECISIONS-ARCHIVE.md` in the same
  folder, leave a line in the live table saying which numbers went where, and do not `@`-import
  the archive. Nothing is ever
  deleted and the trail stays whole; it is simply read on demand instead of every time.
  `studio.ps1 -Doctor` reports what each project loads under CONTEXT, so this is visible well
  before it becomes a warning.
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

**Commit the governance documents. Do not deploy anything.** Those are different acts and the
difference matters: winding down makes the record durable, and it does not ship product.

This rule used to say do not commit unless asked, and that was wrong. A wind-down wrote a hundred
and thirty lines of state into a project and left every one of them uncommitted, because nobody
thought to ask on the way out. The session that would have noticed had already ended. A record
that exists on one disk is not a record, it is a draft, and the next session opens against
whatever was last committed.

The four checks in the next section run FIRST, every time, and none of them is optional. Then you
stage the two documents **by name** and commit. Never `git add -A` and never `git add .`.

---

## Committing the governance documents

This is the moment wind-down turns dangerous, because it is when someone reaches for
`git add -A`. Four checks first, in order. None is optional. Every one of them came from a real
failure during a real wind-down, which is why none of them is skippable on a quiet day.

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

**Then check the repository has a remote.** `git remote -v`. Without one there is nowhere for the
record to go, and the four checks end here.

After committing, confirm what actually went in with `git show --stat`, and say if anything
unexpected came along.

**Then push, and say plainly whether it worked.** A commit with no remote, or a push that failed,
buys integrity and not durability: the history dies with the disk, and surviving the machine is
half the point of writing any of this down. If there is no remote, say so rather than reporting
the wind-down as done.

**Say what you did NOT touch.** A project usually has other modified files at the end of a
session, and they are not yours to commit. Name the count so the founder knows they are still
there and still theirs.

---

## Step 5b: score the session against the standing checks

Write the result into a `## Compliance` section in `WARM_START.md`, replacing the previous
table. The next session reads that file on its own, so this is what makes the standing checks
arrive at the start without any new tooling to remember.

Answer each line from evidence, never from impression. A line you cannot evidence is `unknown`,
and `unknown` is a gap.

| Check | How it is answered |
|---|---|
| All roles dispatchable | the count named at session start. Composed on disk and loaded in the session are different claims |
| Defects introduced | anything shipped that broke, or a gate stepped around |
| Checks that proved nothing | any check that skipped, or ran with nothing to act on |
| New check never watched fail | anything added this session and not yet proven by re-injecting the defect |
| Built off-board | work done with no ticket behind it |
| UAT without test notes | the board's own history |
| Done without a measure | the measure field on the ticket |
| Loose ends | anything the CEO raised this session that did not become a ticket or a backlog row |
| In-flight ceiling | count of large items In Progress. Two large and three small is the ceiling |
| State is durable | **measured, not judged.** The commit hash from `git show --stat`, or the count of lines `git status --short` still reports uncommitted |

Record each as `ok`, `n/a`, or a gap with an **owner and a review date**.

**The last row is measured, not judged, and that is deliberate.** It used to read "repository
exists, has a remote, documents committed", which a session could tick while a hundred and thirty
lines of the state it had just written sat uncommitted on the disk. It did. The row that exists to
catch that failure was a self-report by the party being assessed, which is this studio's own rule
about a claim not being evidence, aimed at its own instrument. So run the command and write down
what it says:

```
| State is durable | ok, both documents committed at 4a91c2f and pushed |
| State is durable | GAP, 130 lines still uncommitted in WARM_START.md   |
```

If you cannot run it, that is `unknown`, and `unknown` is a gap.

**Report two numbers, not a percentage: how many gaps are open, and how many have no owner.**
A score out of a hundred makes people stop looking, because falling short creates work and the
sessions that break a rule are the ones least likely to volunteer it. It also treats every gap
as a failure when some are deliberate, which is what the deviation register is for. An owned
gap with a date is a plan. An unowned one is the defect.

**The two hardest to answer honestly are the last ones you should skip.** A loose end is
invisible by definition: it is the idea nobody wrote down, so the only way to find it is to
re-read what was actually discussed rather than what was done. And a ticket that has sat In
Progress across three sessions is not in progress, it is abandoned with the light left on.

Do not carry a gap forward silently. If a gap from the previous table is still open, say how
long it has been open.

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
