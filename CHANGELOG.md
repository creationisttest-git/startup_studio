# Changelog

What changed and why, written for someone who did not build it.

Newest first. Dates are when the change went public.

---

## 2026-08-03

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
