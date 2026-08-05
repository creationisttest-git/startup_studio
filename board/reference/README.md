# Startup Studio Kanban: reference implementation

A working board, taken from a live project and stripped of its credentials and names.
It is a starting point, not a finished product. Read ../BOARD_SPEC.md first; that file
is the contract and this is one way to meet it.

One backend serves every project. Each project gets its own board, and tickets cannot
cross between them.

## Files

`board.html`          the board UI. Seven columns, drag to move, ticket detail panel.
`board-cli.js`        the terminal CLI the agents drive. Node built-ins only.
`tickets-schema.sql`  projects, membership, tickets, and the policies that separate them.

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

## Setup

1. Run `tickets-schema.sql` against your database. It is safe to re-run.
2. Register the project:
   `insert into public.board_project (slug, name, ticket_prefix) values ('your-slug', 'Your Project', 'ABC');`
3. Create a bot user for this project in the auth panel. One per project, never shared.
4. Add the humans and the bot to `board_member` for that project. Membership is the only
   thing that grants access; nothing in `board.html` does.
5. Set `SB_URL`, `SB_KEY` and `BOARD_PROJECT` at the top of `board.html`, and serve it with
   a `noindex` header. A board has no reason to be in a search index.
6. Give the CLI its environment: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `BOARD_PROJECT`,
   `BOARD_BOT_EMAIL`, `BOARD_BOT_PASSWORD`. Never hardcode them, and add the file holding
   them to `.gitignore` before the first commit, not after.
7. Add a hygiene test that fails the build if a privileged key appears in any tracked file.
8. Replace the assignee list (`SQUAD`, `FOUNDER`) with your own.

## Prove it rather than trusting it

```bash
node board-cli.js whoami      # names the board and counts what this credential can reach
```

```sql
set role anon;                          -- must return no rows
select count(*) from public.tickets;
reset role;
```

If you have two boards, point `BOARD_PROJECT` at the one the bot does not belong to and
confirm the CLI refuses with "not visible to this bot user". A control you have never seen
fail is a control you have not tested.

## What you must not change

The eight statuses, the seven columns, and the ownership boundary. The agents are written
against them. Everything else, the host, the database, the styling, the auth, is yours.
