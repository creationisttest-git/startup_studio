---
name: warm-start
description: Hand over this project's resume prompt, checked against reality first. Use at the start of a session, after a compaction, or any time you need to know where the work actually is. The session start hands the prompt over on its own, unchecked; this is the version that verifies it.
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

Anything you cannot check cheaply, pass through unchanged and do not comment on. A skill that
editorialises about every line is one people stop reading.

## Step 3: hand it over

Print the prompt as it stands, in full, then any corrections underneath it under a plain heading.
Do not silently rewrite it: the founder should see what the record says AND what is actually true,
because the gap between them is itself information about how long it has been since a wind-down.

```
CURRENT   the prompt, verbatim
STALE     expects <n> assertions, the suite reports <m>
STALE     names <ticket> as next; that shipped on <date>
```

## Step 4: do not fix the file

Report staleness. Do not edit `WARM_START.md` to correct it.

That document is written at wind-down, deliberately, from a reading of the whole session. Editing
it at session start means a document that describes the end of the last session gets quietly
amended by one that has done no work yet, and the amendment is not reviewed by anybody. If the
prompt is badly out of date, the answer is a wind-down, not a patch.
