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

This project uses a kanban board as its single work queue. See "Kanban work protocol" in GLOBAL_WAYS_OF_WORKING.md for the standing rules.

Columns: Backlog -> To Do -> In Progress -> UAT Deployed -> PROD Deployed -> Done. Every new request (chat or code) becomes a ticket; move To Do -> In Progress -> UAT Deployed as work progresses; append progress to the ticket description. Claude Code moves items no further than UAT Deployed; the human promotes to PROD Deployed and Done.

Execution: always take the top ticket in To Do. Review it for detail and ask if it is insufficient. If understood, play back the plan and get approval, then build in one go to UAT Deployed, stopping mid-way only if a critical issue arises.

To Do is the only place work is picked from; go to Backlog only when To Do is empty, and pull the item into To Do rather than working it in place. Read the ticket's DESCRIPTION before judging it or starting: the title is only a summary, and list views usually print titles alone. Both rules are stated in full under "Kanban work protocol" in GLOBAL_WAYS_OF_WORKING.md.

[fill per project: the board location/URL, its storage (table or file), and how Claude Code drives it (e.g. a CLI)]

---

## Known decisions (append-only)

| # | Decision | Resolution | Date |
|---|---|---|---|
| - | [fill per project] | - | - |

---

## Build status

[fill per project]

---

## Risks and known issues

[fill per project]
