# Startup Studio Kanban: reference implementation

A working board, taken from a live project and stripped of its credentials and names.
It is a starting point, not a finished product. Read ../BOARD_SPEC.md first; that file
is the contract and this is one way to meet it.

## Files

`board.html`          the board UI. Seven columns, drag to move, ticket detail panel.
`board-cli.js`        the terminal CLI the agents drive. Node built-ins only.
`tickets-schema.sql`  the tickets table, access rules, and a seed row.

## Setup

1. Run `tickets-schema.sql` against your database. It is safe to re-run.
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in your environment. The CLI refuses
   to start without them, which is deliberate: the previous version of this file carried
   a hardcoded service key and only a gitignore entry stood between it and a commit.
3. Add the CLI to `.gitignore` anyway, and add a hygiene test that fails if a privileged
   key appears in any tracked file.
4. Serve `board.html` behind your existing login. Gate it to your own accounts.
5. Replace the assignee list (`SQUAD`, `FOUNDER`) with your own.

## What you must not change

The eight statuses, the seven columns, and the ownership boundary. The agents are written
against them. Everything else, the host, the database, the styling, the auth, is yours.
