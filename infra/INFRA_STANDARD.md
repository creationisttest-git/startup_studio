# The studio infrastructure standard

What to reach for when a project needs hosting, a database, auth or a domain, and when to
deliberately reach for something else.

This exists because every project was deciding all of it from scratch. Across five projects
the studio ran three hosting providers, three datastores and three unrelated authorization
models. The cost is not the bill. It is that "how is access actually enforced" has a
different answer in every project, and that is the single highest-risk thing a reviewer
checks.

---

## The default

**Next.js, Supabase, Cloudflare Pages.**

Reach for this unless one of the triggers below applies. It is not a preference. It is the
stack already proven on the most complete product in the studio.

| Layer | Default | Why this one |
|---|---|---|
| Framework | Next.js, TypeScript, Tailwind | Already the roster's strongest surface. React everywhere means one component idiom |
| Data and auth | Supabase Postgres | Real relational data with row-level security. Auth and storage included, so no second vendor |
| Source control | GitHub | Free for private repositories, and the host builds from it. Named here because it was missing: the rest of this document already treats it as the default, and the row absent from a table is the choice nobody makes deliberately. Do not depend on the git connection alone; see below |
| Hosting | Cloudflare Pages | Free tier covers validation, and it issues its own TLS in minutes |
| DNS | Cloudflare | Same vendor as hosting, which removes an entire class of certificate problem |
| Analytics | GA4 | Free, and the funnel work is already understood |

**Cost ceiling: nothing bills for existing.** Every layer above has a free tier that covers
a validation build, and none of them charges for idle capacity. That is the property that
matters when most projects are meant to be killed rather than scaled.

---

## Free is not unlimited, and the limits are account-wide

The stack is chosen so that nothing bills for existing. That is not the same as nothing
running out, and the difference has already cost a session.

**Check the quota before you promise the thing, not while you are building it.** A dedicated
database was planned, agreed and half-scripted before the dashboard refused to create it: the
free plan allows two projects and both slots were already used by other products. Nothing was
misconfigured. The capacity simply was not there, and nothing said so until the moment of
creation. Thirty seconds of looking first would have changed the plan instead of interrupting
it.

**Know which limits are per project and which are shared.** This is the one that surprises
people. A per-project limit degrades one project. An account-wide limit means another
project's traffic, or another project's build loop, takes yours down. Egress and build
minutes are usually shared. Storage and row counts usually are not.

**Exhaustion mostly does not announce itself as an error you were expecting.** It arrives as
a refusal to create, a project silently paused, a build that queues forever, or a deploy that
reports success while serving the previous version. Read the failure before assuming the code
is wrong.

### What actually bites, by vendor

Quotas change. Treat this as where to look, not as a citation, and confirm against the
dashboard before relying on a number.

**Supabase.** Two active projects per organisation on free, which is the one that stops you.
Projects pause after roughly a week of inactivity, so a board or a validation build nobody
opened for a week is down when someone finally does, and unpausing is a dashboard step. Then
a database size cap per project, and an egress cap shared across the whole account. For a
board, watch stored images rather than row counts; ticket text is negligible and a pasted
screenshot is not.

**GitHub.** Actions minutes are the live one: private repositories draw on a monthly pool and
public repositories on standard runners do not. A busy CI on a private repo exhausts it and
every workflow then queues or fails, across every repository on the account. Artifact and
package storage is a separate, smaller pool. LFS has its own storage and bandwidth allowance,
and LFS bandwidth is the one people are surprised by, because a clone spends it.

**Cloudflare Pages.** Generous where it counts, with unlimited requests and bandwidth, so the
limit that applies is builds per month across the account and a cap on files per deployment.
A deploy loop is what burns this, not traffic.

### The rule

Before standing up any new project, database, or CI workflow, look at the current usage and
the remaining headroom, and say in one line what you found. If there is not room, say so and
propose the alternative rather than creating something that will be refused or paused.

Record the check with its date in the project's warm start. A quota check nobody wrote down
gets re-derived by the next session, or worse, assumed.

---

## Access is enforced in the database, not the application

This is the part that travels with the default, and the part reviewers must know.

Postgres row-level security is the enforcement layer. Application code is not.

The anonymous publishable key is embedded in every public page, so **any permissive read
policy is a public read**. Never write `using(true)` on a table holding drafts, pending,
private, rejected or soft-deleted rows. Default-deny, then expose only genuinely public
states.

Make grants explicit rather than inheriting the platform defaults. State
`grant select/insert/update/delete ... to <role>` and `revoke ... from anon` for every table
a feature touches.

`reference/rls-starter.sql` is a working default-deny schema. Start from it rather than from
an empty table with a policy added later, because the window between the two is a public
database.

---

## When to deviate, and what to use instead

A deviation needs a trigger from this list. Anything else is a preference, and preferences
do not get their own stack.

**Static content or commerce with no user accounts.**
Use a static site generator, Cloudflare Pages and Cloudflare KV. Do not drag Postgres into a
site that has no per-user data; you would be securing a database that holds nothing private.

**The product already exists on another stack.**
Keep it. A working product is not migrated for consistency, and a rewrite buys nothing a
customer can see. What an inherited stack does need is an explicit cost ceiling, because
unlike the default, most cloud-native stacks bill for existing: serverless functions, CDN,
managed queues and transactional email all accrue without traffic.

**A hard requirement the default cannot meet.**
Compliance, data residency, an existing cloud commitment, or a workload the free tier
genuinely cannot hold. Name the requirement in the deviation, not the technology.

Every deviation is recorded in the project's stack card register with the rule affected,
what changes, why, who approved it and a review date. A deviation with no owner and no date
is a defect, not a rule.

---

## Do not run two vendors for one job

A project that already has a platform for auth and data, then adds a second platform for
messaging, now has two auth models, two consoles, two sets of credentials and two places a
leak can start, to solve one problem.

This happens quietly. The second vendor arrives to solve something small and urgent, and
nobody revisits it. Check for it directly: list the platform SDKs in the dependency file and
ask what each one is for. Two answers that overlap is the signal.

Either fold the job into the primary vendor or record why it cannot be folded in. The same
applies to email, storage and analytics. One job, one vendor, or a written reason.

---

## Infrastructure must be reproducible from the repository

If the only record of how a project deploys is a dashboard, the project cannot be rebuilt,
handed over, or reasoned about by anyone who is not logged in.

This is worth checking on a project you believe is fine. A site can serve correctly for
months with no deploy configuration in its repository at all, because the settings live in
the host's console. Nothing is broken, and that is the problem: nothing will be, until the
day it is and there is no reference for what it looked like.

Every project commits its hosting config, its build command, and its environment variable
*names*. Never the values. `reference/` carries the starting set.

---

## DNS and TLS, learned the hard way

**Host and DNS with the same vendor where you can.** Pages hosting on the same vendor's DNS
issues a certificate in minutes with no verification dance, because nothing has to prove
anything to anyone.

**A GitHub Pages site behind a proxying DNS provider is the combination to avoid.** GitHub
will not issue a certificate while it sees the proxy's addresses, so the record must be
DNS-only. A studio site spent more than 47 hours without HTTPS on exactly this pairing, with
every configuration check passing throughout. It was resolved by moving the site to Pages
hosting on the same vendor as its DNS, where the certificate issued in under a minute.

If you are on that pairing anyway:

- Create the DNS record **DNS-only from the start**. Creating it proxied and toggling it off
  afterwards is not equivalent, because the first verification is the one that matters.
- **Never cycle the domain to hurry it.** Removing and re-adding restarts issuance. Cycling
  is what turns a slow certificate into a multi-day outage.
- Verify before escalating: `gh api repos/<owner>/<repo>/pages/health`. If `is_valid` is
  true, `is_cloudflare_ip` false and `caa_error` null, the configuration is correct and the
  remaining wait is the provider's queue. Open a support ticket rather than changing
  anything.

`reference/DNS_TLS_RUNBOOK.md` has the full sequence and the checks.

---

## A git-connected deploy can stop firing and still report itself connected

Confirmed by test, not suspected. A push produced no build at all, while the project settings
showed the repository connected with automatic deployments enabled on the main branch. The
dashboard reported both states at once: a banner saying the project was disconnected from the git
account, and settings saying it was connected.

**Do not treat a git connection as the deploy mechanism.** Trigger the build explicitly from
whatever performs the release, using the host's deploy hook, and treat the git linkage as a
convenience that may or may not work. The hook URL is a credential and belongs with the other
secrets, never in a published script.

The failure mode is the reason this is worth a section. Nothing errors. The release reports
success, the site keeps serving the previous build, and the gap between what was published and
what is live grows silently until somebody loads the page and notices. A release that reports
success over a stale site is worse than one that fails, because only one of them gets fixed.

**Verify the deployment, not the push.** After a release, check that the host recorded a new
build. A green push is not evidence of a deploy.

---

## Secrets

Never in the repository, never in a client bundle, never in a URL.

Environment variables carry values; the repository carries only their names, in
`env.example`. Anything prefixed `NEXT_PUBLIC_` is shipped to the browser and is therefore
public by definition. A service-role key, an admin token or a signing secret prefixed that
way is a disclosed credential, not a configuration mistake.

Local development uses `.env.local`, or `.dev.vars` on Cloudflare. Both are ignored by
`reference/gitignore-fragment`, and that fragment goes in **before** the first commit. A
credential removed after it lands is a history rewrite, not a delete.

Ignore rules stop at a nested repository boundary. A repository inside another repository
inherits none of the parent's protections and needs its own copy.
