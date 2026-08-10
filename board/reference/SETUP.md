# Standing up a board

The shape of the board is fixed studio-wide in `../BOARD_SPEC.md`. Nothing here changes the
eight statuses, the seven columns or the ownership boundary. This is only the wiring.

Some steps need a browser and an authenticated dashboard, so they belong to whoever owns the
accounts. They are marked **OWNER**. Everything else runs from a session once those values
exist.

---

## Before step 1: check the free tier will actually take this

Do this first, every time. It is thirty seconds and it has already cost a session once.

**Supabase allows two active projects on the free plan.** A studio with two products already
has both slots used, and the dashboard does not warn you until you try. The refusal arrives
after you have planned around having a new database. Check the project list before promising
anyone a board.

If both slots are used, the options are: put this board on the existing shared boards
database as another `board_project` row, which is what the shared backend is for and costs
nothing; pause a project that is genuinely idle; or upgrade. **Never** resolve it by putting
the board in a product's database. That breaks the rule the shared backend exists to keep.

Also worth knowing before you commit to a free project:

| Limit | Why it bites |
|---|---|
| Projects paused after ~7 days idle | A board nobody touched for a week is down when someone finally opens it, and unpausing is a dashboard step |
| Database size cap | Ticket text is tiny; pasted images in `images` are not. Watch that column, not the row count |
| Egress cap | Shared across every project on the account, so another project's traffic can take your board down |
| Auth user cap | Each project's bot is a user, and so is every person |

**Cloudflare Pages** is generous by comparison: unlimited requests and bandwidth on the free
plan, with a build cap that a static board will not approach. The limit that does apply is
500 builds per month across the account, shared with every other Pages project.

Record the check. If you looked and there was room, say so in the project's warm start with
the date, so the next session does not re-derive it.

---

## What is here

| File | What it is |
|---|---|
| `tickets-schema.sql` | Projects, membership, tickets, and the policies that separate them. Safe to re-run. |
| `register-project.sql` | Registers one project and its members. Four placeholders to fill. |
| `isolation-checks.sql` | Five proofs, with the required result written next to each. |
| `board-cli.js` | The CLI the agents drive. Node built-ins only. Holds no key; reads everything from the environment. |
| `board.ps1` | Loads `.board.env` and forwards to the CLI, so credentials never reach shell history. |
| `deploy.js` | Substitutes credentials into a gitignored `.dist/` and publishes. Refuses if a placeholder survives. |
| `hygiene-check.js` | Fails if a privileged credential reaches a tracked file. Run it in CI. |
| `.board.env.example` | Names only, no values. Committed. |
| `.board.env` | The real credentials. **Gitignored, and the rule goes in before the first commit.** |
| `site/board.html` | The board UI. |
| `site/_headers` | `X-Robots-Tag: noindex` plus frame, sniff and referrer defaults. |
| `site/robots.txt` | Disallow all. The header is the real control; this is the courtesy copy. |
| `site/index.html` | Redirect to `/board.html`, because the sign-in flow returns to that exact path. |

---

## Step 1, OWNER. The backend

Either use the existing shared boards database, or create a **new free project** for boards.

It holds no product data, ever. A board is project management, not product data, and a board
inside a product's database means the product's credentials reach the board and the board's
reach the product.

Then open **Project Settings > API** and hand back two values:

- **Project URL**, the `https://<ref>.supabase.co` one
- **Publishable / anon key**, the long `eyJ...` string labelled `anon` `public`

**Do not hand back the `service_role` key.** It bypasses row-level security by definition, so
any project holding it could read and write every other board no matter what the policies
said. It stays in the dashboard and is used only to run migrations from the SQL editor.
`board-cli.js` refuses to start if it ever finds one in its environment, and `deploy.js`
refuses to publish with one in scope.

---

## Step 2, OWNER. Enable sign-in, then sign in once

The board signs in with Google. Under **Authentication > Sign In / Providers**, enable
**Google**, and paste the callback URL it gives you into the Google Cloud OAuth client's
authorised redirect URIs.

Then, after step 5 has put the board on a hostname, open it and sign in once. That first
sign-in is what creates the user row.

Hand back: the **user id** from **Authentication > Users**, the `uuid` column.

---

## Step 3, OWNER. Create the bot user, for this project only

**Authentication > Users > Add user > Create new user.**

| Field | Value |
|---|---|
| Email | `bot+<your-slug>@<your-domain>` |
| Password | Generate a strong one. Store it in the password manager. |
| Auto confirm user | **Yes.** The bot has no inbox and cannot click a confirmation link. |

One bot per project, never shared. A bot that is a member of two boards can reach both, which
is precisely what the isolation model exists to prevent.

Hand back: the bot **email**, its **password**, and its **user id**.

---

## Step 4, session. Schema, registration, first isolation check

1. Paste `tickets-schema.sql` into the SQL editor and run it.
2. Fill the placeholders in `register-project.sql` and run it. Expect two rows back.
3. Run `isolation-checks.sql`. **Check 1 must return 0.** If it returns anything else, stop:
   every ticket on every board here would be publicly readable, and no ticket gets created on
   a board in that state.

If you script this, note two things that have caught people. The auth admin API needs an
`apikey` header as well as the bearer token. And a script that treats any SQL error as fatal
will read check 1's permission denial as a failure when it is the strongest possible pass.

---

## Step 5, OWNER. Deploy

```
cp .board.env.example .board.env      # then fill it in
node deploy.js --build                # check the substitution before publishing anything
node deploy.js
```

`wrangler` needs `npx wrangler login`, which opens a browser. That is the OWNER step.

Values are substituted at build time into a gitignored `.dist/`, never written into a tracked
file. The publishable key in a public file is expected and safe; it is governed by the same
row-level security as everything else, which is exactly what check 1 proves.

**Hostname.** Pages gives `<project>.pages.dev` for free. A custom hostname on an existing
zone is easier to remember and easier to revoke. Either works.

Whatever hostname is chosen, add it to **Authentication > URL Configuration** as
`https://<hostname>/board.html`, or sign-in returns to nowhere.

Verify the header is actually served rather than assuming the file was read:

```
curl -sI https://<hostname>/board.html | grep -i x-robots-tag
```

**After any redeploy, verify against the response, not a browser tab.** A reload, a hard
reload and a cache-busting query string have all been observed serving the previous document
while `curl` returned the new one. That failure reads exactly like a bug in the change you
just made, and it has cost three separate debugging sessions. Use a new tab, or use `curl`.

---

## Step 6, session. Prove it, then use it

```
.\board.ps1 whoami
```

Must name this project and count only its tickets. Then re-run `isolation-checks.sql` and
paste the raw output.

**Run the negative control.** A control never seen to fail has not been tested. Point
`BOARD_PROJECT` at a board this bot does not belong to and confirm the CLI refuses with
`not visible to this bot user`. If there is only one board, create a throwaway second one,
leave the bot out of its membership, prove the refusal, then delete it.

Wire `hygiene-check.js` into CI while you are here:

```
node hygiene-check.js <path-to-repo>
```

Then, and only then:

```
.\board.ps1 add "Board is live and the studio protocol is wired" todo
.\board.ps1 desc <id> "<the acceptance criteria>"
.\board.ps1 list
```

`list` prints titles only. That is why a ticket is never judged from its title: open it and
read the description first, every time.
