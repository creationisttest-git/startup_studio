# Roadmap Actions Kanban: reference implementation

A working board, taken from a live project and stripped of its credentials and names.
It is a starting point, not a finished product. Read ../BOARD_SPEC.md first; that file
is the contract and this is one way to meet it.

One backend serves every project. Each project gets its own board, and tickets cannot
cross between them.

## Files

```
SETUP.md               the runbook. Start there; it is ordered and it names who does what.
tickets-schema.sql     projects, membership, tickets, and the policies that separate them.
register-project.sql   register one project and its members.
isolation-checks.sql   five proofs, with the required result written next to each.
board-cli.js           the terminal CLI the agents drive. Node built-ins only.
board.ps1              loads .board.env and forwards, so credentials miss shell history.
deploy.js              substitutes credentials into a gitignored .dist/ and publishes.
hygiene-check.js       fails if a privileged credential reaches a tracked file.
.board.env.example     names only, no values.
site/                  what actually gets deployed: board.html, index.html, robots.txt, _headers.
```

**A note on where this came from.** The first four versions of this reference were extracted
from a board that had been running for months, and inherited that board's undocumented drift:
a column added by hand and never written back, another project's ticket code hardcoded, a
sign-out that cleared the wrong storage key, an allow-list whose empty state locked everyone
out, and a dead script tag. Every one of them worked on the board it came from and failed on
the first clean install. If you are the first to install this after a change, you are testing
the reference as much as your own project, and what you find belongs back here the same day.

## How isolation actually works

Tickets for every project live in one table, separated by `project_id` and enforced by
row-level security tied to membership. There are three ways in and all three go through
the same policy:

- **UI**, `board.html`, holding the publishable key and the signed-in user's token
- **API**, anyone calling PostgREST directly with the publishable key
- **CLI**, `board-cli.js`, signed in as that project's bot **user**

**The service-role key is never issued to a project.** It bypasses row-level security by
definition, so any project holding it could read and write every other board no matter
what the policies said. It stays with whoever owns the database and is used only to run
migrations. `board-cli.js` refuses to start if it finds one in the environment.

That is the whole design. The CLI is not trusted to stay in its lane. It is given a
credential that cannot leave it.

## Deleting a ticket

Deletion is soft. A deleted ticket is flagged and hidden; its number and its whole running
record survive, and `board-cli.js restore <id>` brings it back.

The control is the revoke, not the flag. `DELETE` is taken away from the signed-in role in
`tickets-schema.sql`, so a hard delete cannot be issued by the page, by the CLI, or by anyone
with the publishable key and a shell. A flag the application is merely trusted to honour would
not have been a control at all, because the data API is reachable directly.

Ticket numbers are never reused: a hidden row keeps its number, so restoring one can never
collide with a number handed out after it was hidden.

## Setup

Follow `SETUP.md`. It is ordered, it says which steps need a browser, and it starts by having
you check that the free tier will actually take another project, which is not obvious until
the dashboard refuses you.

## Prove it rather than trusting it

Run `isolation-checks.sql` and paste the raw output. A summary is not evidence.

```bash
node board-cli.js whoami      # names the board and counts what this credential can reach
```

The one that matters is the negative control: point `BOARD_PROJECT` at a board the bot does
not belong to and confirm the CLI refuses with "not visible to this bot user". Every other
check confirms the bot can see what it should. Only this one confirms it cannot see what it
should not, and those are different claims. A control you have never seen fail is a control
you have not tested.

## What you must not change

The eight statuses, the seven columns, and the ownership boundary. The agents are written
against them. Everything else, the host, the database, the styling, the auth, is yours.
