# Changelog

What changed and why, written for someone who did not build it.

Newest first. Dates are when the change went public.

---

## 2026-08-04

### A warm start that nothing imports is a file nobody opens

**The problem.** Each project keeps its own state in `WARM_START.md`: what is true now, the
single next action, what is deliberately unbuilt, and the decisions already settled. The
`/wind-down` skill writes it carefully at the end of every session.

None of that helps if no session reads it back. `CLAUDE.md` is the only file loaded
automatically, so a warm start is only reachable if `CLAUDE.md` imports it with a line
reading `@WARM_START.md`. Where that line is missing, the state gets written every session
and opened in none, which is the same outcome as never writing it, for more effort.

Nothing breaks when this is wrong, which is why it survives. The studio itself had been in
that state for two days while maintaining the same documents for every other project. Its
own next action and its own settled decisions were sitting in a file no session loaded.

**What changed.** `-Status` and `-Doctor` gained a STATE DOCUMENTS section reporting, for
every project, whether a warm start exists and whether anything actually imports it. Three
outcomes: `ok`, `none` for projects that keep no state, and `UNREAD` for the failure this
describes, with the one-line fix. The check looks beside the warm start and at the project
root, because the import resolves relative to the `CLAUDE.md` that declares it.

The studio is checked first and by name. Project discovery skips folders starting with an
underscore, so without that the guardian would have stayed the one thing not being watched.

`METHOD.md` now states the requirement where the two documents are introduced, rather than
leaving it as something you find out by not doing it.

---

## 2026-08-03

### /wind-down knows what to check before committing

**The problem.** Wind-down often ends with someone asking for the governance documents to be
committed, which is exactly when `git add -A` gets typed. A real session hit two traps in one
go. The documents lived in a nested repository with its own `.git`, so the parent excluded the
folder and force-adding into the parent would have been wrong. And a credentials file sat in
that nested repo untracked but *not ignored*, one `git add -A` from being committed forever,
because every secret rule in the parent gitignore stops at a nested repo boundary.

The session flagged the file as safe on the grounds that nothing had committed it yet. That is
true about the past and wrong about the next command.

**What changed.** The skill now runs four checks before staging anything. Which repository you
are actually in, since a nested `.git` usually explains the ignore rule, and the comment above
a rule tends to hold the answer the rule alone does not. Whether sensitive files are ignored
rather than merely untracked, because only ignored files are actually safe. That a nested repo
inherits none of the parent's protections and needs its own. And whether the repo has a remote
at all, since a commit with nowhere to go buys integrity but not durability, and surviving the
machine is half the point of writing state down.

Staging is by name. `git add -A` is out.
### The new-project scaffold teaches, and SOURCE_OF_TRUTH is retired

**The problem.** `WARM_START.md` in the scaffold was 200 bytes of four headings and four
`[fill per project]` placeholders. Meanwhile the `/wind-down` skill explained in detail what
each section should contain and why. A newcomer reads the template first, writes four thin
paragraphs, gets no value from it and stops maintaining it. That is exactly what happened to
the copies in this studio, which sat unfilled for months.

**What changed.** The template now carries a line of guidance per section with worked
examples, and points at `/wind-down` as the thing that maintains it. It shows the difference
between "continue the build" and "the tenant filter on the property service, service layer
done, controller not started". It adds the two sections that were missing and matter most:
open items, where the reasoning is the valuable half rather than the status, and known gaps
not yet built, which is what stops the same decision being relitigated every few weeks.

`METHOD.md` now explains why each project keeps its own state at all: a shared base can say
how to work, but only a session knows where a project actually is, and sessions end.

`SOURCE_OF_TRUTH.md` is retired as a concept and removed from the scaffold, the method and
the tooling. `/wind-down` will leave an existing one alone and flag it rather than keeping
it alive.
### The studio now records its own state

It had `CLAUDE.md` and `METHOD.md`, so a fresh session knew the model but nothing about
where things stood: what was outstanding, what had been decided, what not to touch and
why. `WARM_START.md` fills that, with current state, next action, open items, known gaps
not yet built, the decisions table, and a resume prompt.

The guardian was the one project not following its own governance rules.
### Skills, starting with /wind-down

**The problem.** The governance is twenty-five sections of prose that a session has to
read, hold in context and voluntarily follow. Several say "mandatory" or "no prompt
needed". In practice the procedural ones get skipped: wind-down is Rule 2 and still had to
be pasted in by hand each time, and the release protocol existed while a change went to
one repository and not the other.

**What changed.** Procedures now ship as skills rather than paragraphs. The distinction:
judgment stays in the agents, because an agent applies it continuously while doing
something else; a procedure has steps and either ran or did not, so it becomes a skill that
can be invoked and cannot be half-remembered.

`/wind-down` is the first. It finds the governance documents even when they sit in a parent
venture folder, warns that anything held in context may be stale, reads each file from disk
in full, edits in place with the decisions table append-only, shows the diff before
applying, and refuses to touch generated agent files. It exists because a document was once
regenerated from memory and twenty-seven recorded decisions vanished.

The studio distributes skills the same way it distributes agents: `base/skills/` installs
to `~/.claude/skills/` on `-Sync`, and `-Status` reports how many exist and how many are
installed. Roles stay agents, because review needs a separate context and the reviewer must
never be the author.
### Releasing is now a single, mandatory action

**The problem.** Committing the private source and publishing the public export were
separate steps someone had to remember. A change reached one repository and not the other,
and nothing reported the gap. Release messages were also hand-written, so history and
changelog could drift apart.

**What changed.** `CHANGELOG.md` is the single source of the release note. The commit
message is generated from its newest dated section, for both repositories, so they cannot
tell different stories about the same change. `studio.ps1 -Release` commits and pushes the
private repo and publishes the leak-scanned public export in one action, from that one
note. `-WhatIf` previews it.

It is now a non-negotiable standing rule in the ways of working and in the tech lead and
PM mandates: no changelog entry, no release. If you cannot describe the change for someone
who did not build it, it is not ready to ship.
### QA now owns the handoff to human testing, and must explain how to test

**The problem.** Whoever built a piece of work was moving it to UAT the moment it
deployed. That is self-certification, and it confuses two different things: the code being
deployed to a test environment, and the work being ready for a person to look at. On top
of that, a ticket could reach the founder with nothing on it saying what to actually do.

**What changed.** Only `qa-tester` can move a ticket to UAT now. The tech lead deploys and
tags the release, then stops; the ticket stays In Progress until QA has verified it,
confirmed the three deploy gates passed, and written test notes onto the ticket. If any of
those is missing the ticket does not move, and QA says what is missing.

**The test notes are a fixed format**, because "write good notes" produces nothing
consistent. They are instructions rather than a report, in plain language, with no
selectors, endpoints or table names:

```
## How to test

Takes about N minutes. Start at <the exact URL or screen>.

1. <what to do, in plain words>
   Expect: <what you should see>

On your phone: <the one thing worth checking at 375px>

Already checked, no need to repeat: <one line>

Not in this ticket: <what it deliberately does not do>

If something is wrong, note it on this ticket rather than fixing it.
```

Three parts earn their place. An expected result after every step, because otherwise you
are guessing whether what you see is correct. How long it takes, because you are deciding
whether to test now or later. And "not in this ticket", which prevents the most common
false bug report: someone testing for something that was never in scope.

If the notes need fifteen steps, the ticket was too big, and QA is told to say so.

Affects `agents/qa-tester.md`, `agents/tech-lead.md`, `board/BOARD_SPEC.md`.

### Publishing keeps history and explains itself

The public repo previously held a single commit that was force-pushed and replaced on
every release, with a hardcoded message. There was nothing to diff, no record of what
changed, and any fork point or contributed commit would have been destroyed silently.

Publishing now updates the repo in place, touches only the paths it owns, and writes a
message describing the actual change. This changelog is the source of that description.

### The page is a real HTML document

It had no doctype, no `html` element, no `body` and no charset declaration, so browsers
were guessing the encoding and rendering in quirks mode. Now a complete document with
`lang`, charset, canonical, Open Graph and Twitter cards, `SoftwareApplication` structured
data, `robots.txt`, `sitemap.xml` and a share card image.

---

## 2026-08-02

### Startup Studio Kanban

The board the agents work from is now specified and shipped, not just described.
`board/BOARD_SPEC.md` fixes the contract: eight statuses, seven columns, the ticket
fields, the ownership boundary and the CLI surface. `board/reference/` is a working
implementation you can start from.

The shape is deliberately not a per-project choice. Every agent is written against these
statuses and this boundary, so a project that renames a column breaks the contract the
agents rely on, and the failure looks like agents behaving strangely rather than a
misconfigured board.

The founder is the tester. Agents take work as far as UAT on their own; nothing leaves UAT
without a human having tested it and said so, and only an explicit instruction moves
anything to production.

### Work comes from the board, and only from the board

Thirteen roles now know the protocol. Take the top ticket in To Do and work down; To Do is
the only place work is picked from. Read the description before judging a ticket, because
the title is a summary and a list view showing titles only makes a fully specified ticket
look empty. Play the plan back before building. Append progress to the ticket as you go so
the ticket is the record.

### Licensed AGPL-3.0

Chosen over a permissive licence deliberately. The point of the model is that an
improvement made anywhere reaches everyone, and a permissive licence would have allowed a
modified version to go closed while the project asked people to share improvements back.
Now the licence and the request say the same thing. See `LICENCE-NOTES.md`.

---

## Earlier

### The composition model

The founding idea. One base roster of sixteen roles, a small per-project layer for what is
genuinely different, and the working files generated from both and rebuilt whenever either
changes.

It exists because copying the roster into each project does not work. A copy is correct on
the day it is made and then silently stops receiving every improvement made anywhere else.
Nothing warns you; it drifts until someone notices output that should not be possible. The
reverse also happens: an agent told to update its own instructions edits the installed
copy rather than the source, it works immediately so nobody questions it, and the next
sync deletes it.

### Design lead split out from designer

Direction and execution were one role, which meant the person setting the standard was
also the person meeting it. `design-lead` now owns the vision, the brand, the anti-slop
bar and the mobile-first standard; `designer` executes to that direction and reviews what
was built against it.
