---
name: warm-start
description: Hand over this project's resume prompt, checked against reality first. Use at the start of a session, after a compaction, or any time you need to know where the work actually is. The session start hands over only the founder brief, unchecked; this is the version that verifies.
---

# warm-start

Reads the resume prompt out of `WARM_START.md`, verifies the claims in it, and hands it over
with anything stale corrected.

## Why this is not just a copy

The prompt is the most valuable thing in the state document and the most often wrong, because
nothing reads it between wind-downs. A human copying it does not verify it.

Measured on the day this was built: the studio's own prompt named an expected number of
assertions that the suite had long since passed, and a next action that had shipped two days
earlier. A session pasting it would have believed dozens of assertions had vanished, or started
work that was already finished. **Handing over a confidently wrong number is worse than handing over nothing**,
because a number looks measured.

So this fetches, then checks.

## Step 1: find the prompt

Read `WARM_START.md` from disk, in this project or the nearest parent that has one. Look for a
heading about resuming or restarting, usually `## Prompt to resume this session`, and take the
first fenced block under it.

It is often near the end and it is not reliably the last section: the studio's own has another
section below it. Take the fenced block, not the rest of the section, or you sweep in whatever
follows.

If there is no such section, say so and stop. Do not invent one: a resume prompt assembled on the
spot is a guess about the state of work dressed as a record of it.

**If the section exists but has no fenced block, say that and stop as well.** Do not hand over the
prose around it. A document was found whose resume prompt was written as bare paragraphs, so there
was nothing to extract, and what got handed over was whatever text sat nearby. That text pointed
the session at a block the same document marked superseded, and the session believed it, because
anything returned under this heading reads as the record. Returning nothing is recoverable.
Returning the wrong thing confidently is not.

## Step 2: check what it claims

The prompt makes claims. Check the ones that are cheap to check, and only report the ones that are
actually wrong.

- **A test count.** If it names an expected number of assertions, run the suite and compare. If it
  differs, give both numbers and say which is current.
- **A next action.** If it names a ticket, look it up on the board. Report if that ticket is
  closed, or if it no longer exists.
- **A role count.** If it says to expect a number of roles, that is for the session to verify by
  naming them, not for this skill to answer on its behalf. Pass it through untouched.
- **A file it tells you to read.** If the path does not exist, say so.
- **A pointer into the document itself.** If the prompt says to work from a dated block, check that
  the document does not mark that block superseded, and that no newer one exists. Run
  `node <studio>/tools/check-resume-pointer.js <path>` if the studio is reachable, or read the
  dated blocks and compare. This is the check that was missing: the prompt is written by hand at
  wind-down and has to track state that moves underneath it, and nothing compared the two.

Anything you cannot check cheaply, pass through unchanged and do not comment on. A skill that
editorialises about every line is one people stop reading.

## Step 3: hand it over, answer first

**Three parts, in this order. The order is the whole fix.**

1. **The answer, in about four lines.** What we are working on, why it matters, what done looks
   like, and what is needed from the founder. If the document carries a `## Founder brief`, that
   IS the answer: print it. If it does not, take the four facts from the top of the prompt and
   say you did.
2. **The corrections**, under a plain heading, in the table below.
3. **THE GOAL AND BUSINESS VALUE of this session, in two lines**, and nothing else.

Why the order and not a trim. The founder asked what we are working on and received 98 lines. The
CEO's words on ST-069: *"warm start does not really help me as it just gives me this massive
verbose message, but I only care about what."*

**Part 3 used to be "the prompt in full, verbatim", and deleting it is ST-275.** Its stated reason
was that the founder should see what the record CLAIMS against what is TRUE, because the gap is
itself information. But part 2 already prints that gap, computed and labelled CURRENT, STALE,
BROKEN, two paragraphs above. So part 3 was redundant with the instrument printed directly above
it, at roughly 2,000 words per session start in every project, serving neither reader: the founder
did not want it and the session had already read the document from disk.

**That redundancy is why five sittings of delivering a 300-word reply cap changed nothing.** A cap
cannot beat a direct instruction to print the manual. S227. Do not restore it; if you need the
prompt, read the file.

### What goes in part 3

Two lines, written BEFORE any work starts, in the founder's terms rather than the board's:

```
GOAL AND BUSINESS VALUE
Goal:  <the one thing this session will FINISH, naming the tickets>
Value: <what the founder gets that they did not have, in their terms>
```

**Write the same two lines onto the board as a note before you touch a line of code**, on the
initiative in flight. The order matters for the same reason the board `ask` is written before the
CEO prompt (S225): a goal recorded at the end is a description of what happened, not a commitment
the session can be measured against, and the two are indistinguishable once written down.
`check-session-goal.js` reads both and refuses when the goal first appears at wind-down.

**The goal is FINISHED in this session, not carried.** The CEO's words on 2026-09-18: *"unless its
genuinely too large context we should finish the goal for that sesssion without carying over."* If
the context genuinely will not hold it, say so EARLY and say which items you are dropping.

Never silently rewrite the prompt.

```
CURRENT   the prompt, verbatim
STALE     expects <n> assertions, the suite reports <m>
STALE     names <ticket> as next; that shipped on <date>
STALE     points at the block dated <old>, which this document marks superseded by <new>
BROKEN    the resume section carries no fenced block, so there was nothing to extract
```

## Step 4: read the budget (archiving moved to wind-down, CEO ruling 2026-09-21)

**ARCHIVING NO LONGER RUNS HERE.** The CEO ruled on 2026-09-21, in their words, *"i prefer
archieving happening at wind down and not at start of a session"*. That reverses S221 and the
reasoning kept below, which is left in place because it is the argument that lost rather than a
mistake. `base/skills/wind-down/SKILL.md` owns the archiving step now, and this skill and that one
said opposite things to every project for a day. Read the budget, and run the commands below only
if a human has decided to archive at the opening for a reason they can state:

```
node <studio>/tools/archive-sittings.js <path-to-the-state-document>
node <studio>/tools/archive-sittings.js <path-to-the-state-document> --write
node <studio>/tools/archive-decisions.js --file <path-to-the-state-document> --write
node <studio>/tools/check-context-budget.js <project-dir>
```

**Do not wait for the budget check to refuse.** That was the rule until 2026-09-17 and it made the
limit into the target: the document was cut back to just under the ceiling, grew to it again by the
next wind-down, and never once went below. Six consecutive sittings of this studio's own record
describe the move as "the documented fallback rather than the plan". A saving you take only when
you are forced to is a saving you never compound. `archive-sittings.js` keeps the most recent
sitting in Current state and in Session log, moves the rest to the archive file beside the
document, and exits 0 when there is nothing to move, so running it every sitting is free.

Run each one without `--write` first: that is a dry run and touches nothing.

**It refuses rather than guessing, and the refusal names a remedy you can perform.** It bounds the
dated history at the first paragraph naming the archive file, because in a Current state section
the blocks are followed by LIVE state that looks identical to a block and must never be moved. If
there is no such paragraph it writes nothing and tells you to name the boundary yourself with
`--boundary "<a phrase from the first paragraph that is not dated history>"`.

THE SUPERSEDED REASONING, kept for the argument and not as an instruction. Do it first for a
structural reason rather than a tidy one. At wind-down the session is out of
budget and archiving is the last act before stopping, so it is the thing that gets deferred: one
project declined the manual cut eleven sittings running while it was a wind-down job, and this
studio's own state document sat 23 per cent over its limit having had a wind-down every sitting
for weeks. The project that moved it to the opening act is three for three. And the saving is
collected on every request of the session that does the work, which is the session paying for it.

**Prove nothing was lost at the destination before you remove anything from the source.** Count
the non-blank lines out and read them back in. The archiver does this for the decisions table
itself; a hand-moved block has no such guard, so you are the guard.

## Step 5: do not fix the file

Report staleness. Do not edit `WARM_START.md` to correct it.

That document is written at wind-down, deliberately, from a reading of the whole session. Editing
it at session start means a document that describes the end of the last session gets quietly
amended by one that has done no work yet, and the amendment is not reviewed by anybody. If the
prompt is badly out of date, the answer is a wind-down, not a patch.

**Archiving is not an exception to this and never was.** Correcting the file means changing what
it CLAIMS. Archiving changes no claim: it moves rows unchanged into an append-only file beside the
document and leaves a pointer naming what moved, so the trail is followable and nothing is
reworded by a session that has done no work. Move, never amend.
