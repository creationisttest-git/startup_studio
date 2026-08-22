# WAYS_OF_WORKING.md

---

## Overview

[fill per project]

---

## Architecture

[fill per project]

---

## Schema and data model

[fill per project]

---

## Kanban board (project work queue)

This project uses a kanban board as its single work queue. The standing rules are below.

Columns: Backlog -> To Do -> In Progress -> UAT Deployed -> PROD Deployed -> Done. Every new request (chat or code) becomes a ticket; move To Do -> In Progress -> UAT Deployed as work progresses; append progress to the ticket description. Claude Code moves items no further than UAT Deployed; the human promotes to PROD Deployed and Done.

Execution: always take the top ticket in To Do. Review it for detail and ask if it is insufficient. If understood, play back the plan and get approval, then build in one go to UAT Deployed, stopping mid-way only if a critical issue arises.

To Do is the only place work is picked from; go to Backlog only when To Do is empty, and pull the item into To Do rather than working it in place. Read the ticket's DESCRIPTION before judging it or starting: the title is only a summary, and list views usually print titles alone.

[fill per project: the board location/URL, its storage (table or file), and how Claude Code drives it (e.g. a CLI)]

---

## Known decisions (append-only)

Append-only: a reversal is a new row explaining the reversal, never an edit to the original.

**A row is the rule and the reason it exists, in two or three sentences.** Not the case study.
This whole table is loaded at the start of every session, by every session, so it is the one part
of this document with a running cost. The story of how something was found belongs in the session
log in `WARM_START.md`, and the detail belongs on the ticket; both are read when somebody goes
looking. If a row is running long, that is a sign the reasoning wants to live somewhere else.

**Once this table passes about 60,000 characters, move all but the most recent twenty entries to
`DECISIONS-ARCHIVE.md`** in this folder, and leave a line here saying which numbers went where.
Trigger on size rather than a row count: rows vary, and in the project that prompted this rule a
hundred rows was already past the point where a session refuses to load the file quietly. Do not `@`-import the archive. Nothing is
deleted, the trail stays whole, and it is read on demand rather than every time. Two projects
crossed the point where a session refuses to load a document quietly before anyone noticed;
`studio.ps1 -Doctor` now reports what each project loads, under CONTEXT.

| # | Decision | Resolution | Date |
|---|---|---|---|
| - | [fill per project] | - | - |

---

## Build status

[fill per project]

---

## Risks and known issues

[fill per project]
