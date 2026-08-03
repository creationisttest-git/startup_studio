# WARM_START.md

Where this project is right now. Its job is to let a session with none of your context pick
up exactly where the last one stopped.

The `/wind-down` skill maintains this file. Run it before you close a session; it reads from
disk, updates in place and shows you the diff. Never write it from memory.

Delete the italic guidance as you fill each section in.

---

## Current state

*What is true of the project today. What exists, what works, what is deployed where. Enough
that someone new could describe the project accurately without reading the code.*

---

## Next action

*The single next thing, specific enough to start without asking a question.*

*"Continue the build" is not a next action. "The tenant filter on the property service,
service layer done, controller not started" is.*

---

## Open items

*Things in flight, waiting on someone, or blocked. Each carries the reasoning, not just the
status.*

*The reasoning is the valuable half. An item that records only what is broken invites the
next session to try the obvious fix, which is often the thing that broke it. Where there is
something not to do, say so and say why: "do not retry the deploy, it was cycled three times
already and each cycle restarts the queue".*

---

## Known gaps, not yet built

*Things deliberately left undone, and why.*

*Without this the next session either rebuilds them or assumes they were forgotten. This is
what stops the same decision being relitigated every few weeks.*

---

## Decisions

*Append-only. A reversal is a new row explaining the reversal, never an edit to the
original. This is an audit trail.*

| # | Decision | Resolution | Date |
|---|---|---|---|
|  |  |  |  |

---

## Session log

*Append what each session did. Do not rewrite earlier entries.*

---

## Prompt to resume this session

*Rewrite this every time the state changes. It is the most valuable thing in the file and
the most often left stale.*

*Someone pasting it into a fresh session must be able to continue with zero additional
context. Give it the facts it cannot cheaply discover, tell it what to read first, and tell
it what not to do.*

```
[the resume prompt goes here]
```
