# Changelog

What changed and why, written for someone who did not build it.

Newest first. Dates are when the change went public.

---

## 2026-08-16

### A claim about a thing is not evidence about the thing

**The problem.** A project ran five rounds of content review on the same body of work, and all
five failed on the same defect wearing a different hat each time: a confident sentence written
from a filename, or from a metadata field, rather than from the artefact it described.

Copy described what was in a photograph, and the photograph showed something else. Copy stated
how long a video was and who made it, taken from the record rather than from the file. A price
claim contradicted the product's own listing. Each round the reviewers read the words carefully
and passed them, because the words were well written, internally consistent, and about
something nobody opened.

That is the whole failure mode, and it is not about photographs. **A string cannot be evidence
for a claim the string is making.** Reviewing copy against itself will confirm it is
well-formed and tell you nothing about whether it is true.

**It generalises further than its own project, and further than copy.** The same week, the same
team found two more instances in their own documentation, both load-bearing. A brand standard
named one typeface while the product shipped another, and would have been copied forward into a
new document as fact. And a decision to keep a live credential rested on the claim that a weekly
job depended on it; the job had been reading a different source since months earlier. Both were
caught the same way, by opening the artefact instead of trusting the description of it. The
second one would have left a credential in place to protect a dependency that did not exist.

Documentation is an artefact too, and an old document is exactly as unverified as a filename.

**What changed.** The content reviewer gains a sixth hard failure: a claim whose truth depends
on an artefact must be checked against that artefact, or against the stored record of it, and
reporting PASS on a claim nobody verified is itself the failure. Unverifiable is not a pass. The
content lead gains the writing-side rule, which is the cheaper end: open the thing before
describing it, and treat your own project's older documents as claims rather than as facts.

The test reviewer already carried the companion rule from an earlier lesson, that a check
guarding a defect must be mutation tested by reintroducing the defect, so it needed nothing.

---

## 2026-08-15

### Thirteen of the sixteen agents have never loaded, in any project, for weeks

**If you have installed this roster, you have been running three of sixteen roles.** Update,
run `studio.ps1 -Sync -Force`, and restart your session. `-Doctor` now tells you if it happens
again.

**The problem.** An agent file has to begin with `---` at the very first byte, because that
opens the YAML frontmatter carrying its name and description. Thirteen of the sixteen files
began with a byte order mark instead: three invisible bytes in front of the `---`. The
frontmatter therefore never parsed, the agent had no name, and it was silently not registered.

Every check said everything was fine. The files were present. They matched the base
byte-for-byte. `-Doctor` reported "composed and current" for every project. The agents simply
were not there, and nothing anywhere said so, because presence and loadability are different
questions and only the first was being asked.

The effect was not subtle in hindsight. Work ran with no product manager, no tech lead, no
design lead and no content writer, while the reviewers, which happened to be among the three
clean files, kept working. One project's record blames repeated rounds of copy coming back as
unusable on exactly this, without knowing the cause.

**Two separate faults, which is why a partial fix would have looked like a fix.** Thirteen of
the source files already carried the mark, so the byte-copy that installs them propagated it
faithfully. And the composer wrote its output with an encoding flag that means "UTF-8 with a
byte order mark" on Windows PowerShell 5.1, so it added the mark even to the three clean ones.
Repairing the generated files without repairing both writers would have worked until the next
compose.

**What changed.** Every file this tool writes now goes through one function that writes UTF-8
without a byte order mark. The source files are repaired. The same defective call was also
writing the studio block into projects' own `CLAUDE.md` files and corrupting those; that is
fixed by the same change, and it explains a corruption another project reported and correctly
refused to paper over locally.

Script files keep their byte order mark deliberately. Windows PowerShell 5.1 reads a script
without one as legacy-encoded, which mangles any non-ASCII character in it. Stripping the mark
everywhere would have introduced the very corruption being removed here.

**And `-Doctor` now asks the question that was missing.** A new LOADABLE section checks that
every composed agent opens with parseable frontmatter, and names any that does not. Verified
by putting the mark back and watching the check fail, then removing it and watching it pass.
The lesson is the one this changelog keeps re-learning: a check that reports on the artefact
is not a check on the behaviour, and only the second one was ever the point.

---

## 2026-08-11

### Rewriting history did not remove anything, and the public repository had to be rebuilt

**If you had cloned this repository before today, your copy is broken.** Delete it and clone
again. Every commit has a new identifier. Nothing in the content changed.

**The problem.** A client's project name had reached the public export inside an example
string, and the decision was that the engagement should not be named publicly at all. The
obvious remedy is to rewrite history and force-push, and that was done: all 25 commits were
rewritten, the name was gone from every one of them, and a fresh clone confirmed it.

The name was still publicly readable.

Rewriting history makes the old objects **unreachable, not deleted**. The host kept serving
them by direct commit identifier long after nothing pointed at them. Requesting the old file
at the old commit returned it, intact, with the name still in it, after the rewrite had been
verified as clean. A force-push is a remedy for what people will *browse*, not for what is
*retrievable*.

This is worth stating plainly because the intuition runs the other way. The check that looks
authoritative, cloning fresh and finding nothing, is exactly the check that cannot see the
problem, since a clone only ever fetches what is reachable.

**What changed.** The repository was deleted and recreated from the rewritten history, which
is the only self-serve action that actually discards the old objects. The alternative is a
support request to the host, which takes days. The old commits now return 404 rather than
their contents, and that was verified against the specific identifiers that had been serving
the name.

**What made this cheap, and would not always.** The repository had no stars, no watchers and
**no forks**. Forks are the thing to check first: a fork network shares object storage, so a
single fork would have kept the old objects alive and deleting the original would not have
helped. Check that before assuming this route is available.

**The rule that follows.** Treat "it is in a public repository's history" as published, not as
recoverable. The fix for a leaked credential is rotation, and history surgery is cleanup after
that, never instead of it. For a name rather than a credential, decide whether it may be
public **before** the first push, because every remedy afterwards is worse than the decision
would have been.

---

## 2026-08-10

### The thing that decides what may be published had never been watched fail

**The problem.** The leak scanner is the only control between the private repository and a
public one. It ran, reported clean, and published a name it was configured to block. It did
not error and it did not warn.

The pattern was anchored at both ends, so it required a non-word character after the name,
and the name appeared inside a compound word. The list was inconsistent about this: some
entries would catch compounds and some could not, and nothing distinguished them from the
outside. Today that cost one low-value word. The same list also guards AWS keys, GitHub
tokens, service keys and JWTs, and those patterns looked equally correct.

A check that cannot be seen to fail is indistinguishable from a check that always passes.

**What changed.** Every pattern now carries a known-bad sample it is required to match, and
the publish refuses to run if any pattern has no sample or fails its own. Where the blocked
thing is a name, the sample is a compound rather than the bare word, because the bare word
would have passed on the day it leaked.

The samples live in the private configuration beside the patterns, and deliberately not in
the published script: a file listing a known-bad example of every blocked name is exactly the
leak the scanner exists to prevent.

Both failure paths were then proved rather than assumed, by reintroducing the original defect
and confirming the publish refused, and by removing a sample and confirming the same. That is
the discipline this whole entry is about, and it came from another project in the studio,
which had already learned it the hard way: it proved each of its own content checks by
re-injecting a defect the check was supposed to catch, and found two that had never fired.
That lesson existed here for three days before this scanner needed it.

### The board reference had five defects that could only appear on a fresh install

**The problem.** The board reference was lifted from a board that had been running for months
and working fine. That board's database had drifted away from the schema file that supposedly
built it: a column had been added by hand and never written back, and the project it belonged
to was the one whose ticket code sat hardcoded in the page. None of this was visible from the
reference, because on the board it came from, every one of these defects was masked.

The first project to stand a board up from the reference alone hit all five in one sitting.

1. **A missing column reported itself as a missing table.** The page selects `image_count` and
   the schema file never creates it. The page detects a missing table by matching the error
   text for "does not exist", so a missing *column* produced "the tickets table is not there
   yet", which sends you to re-run a schema file that is already correctly applied. That is the
   worst kind of error message: it is confident, it is specific, and it points at the one thing
   that is not wrong.

2. **Cards showed another project's ticket code.** One function read the project's real prefix
   from the database and another used a hardcoded constant, so the same ticket displayed two
   different references depending on where it was drawn.

3. **Sign-out did not sign you out.** The session was stored under one browser storage key and
   cleared under a different one, so the token survived the sign-out it was supposed to end.

4. **An empty allow-list locked out everybody, including the owner.** Its own comment said an
   empty list should defer to board membership. The code read the list unguarded, so an empty
   list matched nobody.

5. **The header wore the original project's initial** on every board built from it.

**What changed.** All five are fixed at the source, so no project hits them again. The lesson
worth keeping is the one about where they came from: a reference implementation extracted from
a running system inherits that system's undocumented drift, and every defect it carries stays
invisible until somebody installs it clean. The first install is therefore a test of the
reference, not just of the project doing it, and its findings belong upstream the same day.

**Deleting a ticket is now recoverable, and the database enforces that, not the page.** A
deleted ticket is flagged and hidden; its number and its whole running record survive, and it
can be restored. The half that matters is a revoke rather than a flag: hard delete is taken
away from the signed-in role, so it cannot be issued by the page, by the command line, or by
anyone holding the publishable key and a shell. A flag the application is merely trusted to
honour would not have been a control, because the data API is reachable directly whatever the
page chooses to send.

The confirmation dialog used to say the deletion was permanent and could not be undone. That
had quietly become false, and a warning that overstates its consequence teaches people to
ignore the ones that do not.

**The assignee constraint no longer hardcodes one studio's role names.** It allowed exactly
three values, which meant any existing board whose tickets used different ones could not be
migrated onto the shared backend at all: the constraint is added part-way through the schema
file, so the run fails with the table already half-altered. Projects now declare their own
permitted assignees, and declaring none means no restriction.

**And the reference now carries the tooling a project actually needs to stand a board up.** A
credential hygiene check that fails if a privileged key reaches a tracked file, a deploy step
that substitutes secrets at publish time and refuses to publish if a placeholder survives, the
isolation checks including the negative control that proves one project cannot read another,
and a setup runbook. All of it existed only inside the first project to do this, which meant
the second project would have written it again.

### Free tiers run out, and they run out across the whole account

**The problem.** The studio's cost rule is that nothing bills for existing, and every default
in the stack has a free tier that honours it. That was read as though free meant available,
which is a different claim.

A dedicated database was planned, agreed and half-scripted before the dashboard refused to
create it: the free plan allows two projects and both slots were already used by other
products. Nothing was misconfigured. The capacity simply was not there, and nothing said so
until the moment of creation, by which point the plan had been built around having it.

**What changed.** The infrastructure standard now carries what actually bites, per vendor,
and the discipline around it: check the headroom before promising the thing rather than while
building it, know which limits are per project and which are shared across the whole account,
and expect exhaustion to arrive as a refusal to create, a silently paused project or a build
that queues forever rather than as the error you were watching for. The account-wide half is
the one that surprises people, because it means another project's build loop can take yours
down.

The devops engineer, tech lead and PM now carry it as a standing check, and the answer is
recorded with its date in the project's warm start rather than left in somebody's memory.

### The board's own security rules were describing a model that had been replaced

`BOARD_SPEC.md` and the devops engineer both still said the board CLI holds a privileged key
and told you how to look after it. That stopped being true when the CLI moved to a per-project
bot user, precisely because such a key on a shared backend would give every project access to
every other board that no policy could revoke. Both now say what is actually true, which
matters more than usual here: the old text told a reader to protect a credential the design
no longer issues, which reads as permission to have one.

## 2026-08-06

### The reviewers learned five ways an animated sequence hides a defect from its own tests

**The problem.** A project's map opening broke five separate times in a single day. Every
break was obvious to anyone who loaded the page, and every one passed the automated checks
that existed at the time. Each fix was reported back as a new defect by the person looking
at it. That is not a story about one animation; it is five distinct ways a check can be
green while the thing it guards is visibly broken, and none of them are specific to a
stack, a framework or a product.

**What changed.** The visual reviewer and the test reviewer now carry those five patterns
as standing checks.

An entrance animation verified as "did it run" instead of "what was on screen before it".
A defect that lives in the order of two events is invisible to a check that only confirms
both events happened, so the reviewer now records when content is genuinely visible AND
when it starts animating, then asserts the ordering.

Suppressing one visual layer at a time, which regenerates the defect once per layer.
Hiding a composite element leaves its siblings painted, and hiding all of them leaves
whatever is drawn into a canvas, which no stylesheet reaches and no element walk sees.

A visibility probe that reads only the element and not its ancestors. Opacity does not
inherit as a computed value, so a child of a fully transparent parent still reports itself
as fully opaque, and a probe built that way calls hidden content visible.

A defect reproducible only on a slower device, chased by reasoning rather than by
reproduction. Three fixes shipped without reproducing it and all three were wrong. The
reviewer now reproduces the condition, with deliberate delay or contention, and prefers
asserting on data over timing-dependent visual state, because a count means the same thing
on every device and a brightness does not.

A timed failsafe that expires before the thing it protects, so the safety net fires first
and the sequence then plays onto an already-revealed surface.

**And one rule about the checks themselves.** A check that skips counts as a pass in every
runner and every summary line. That is right for a check with nothing to act on and
dangerous for one guarding a behaviour, because the run stays green while the behaviour is
unchecked. Projects now name the checks that are not allowed to go quiet and fail the run
when one of them skipped, reporting it as "this guard proved nothing" rather than burying
it in a count. This has escaped twice: once behind ninety-three silent skips, with a
feature that never wrote a row shipping behind them.

## 2026-08-05

### One board backend for every project, and tickets that cannot cross between them

**The problem.** The board reference assumed one database per project. That does not
survive five projects on a free tier, and the alternative, putting the board in each
product's own database, is ruled out because a board is project management rather than
product data. So the boards have to share a backend, and sharing a backend means the
separation has to be real.

The obvious version of this is a `project_id` column and a policy. That is not enough,
because of how the CLI worked.

**The CLI was the hole.** `board-cli.js` authenticated with the service-role key, which
bypasses row-level security by definition. On a shared backend, every project would hold a
credential that could read and write every other project's tickets, and no policy could
have stopped it. A policy cannot constrain a key that is defined as outranking policies.

**What changed.** The CLI no longer holds a privileged key at all. It signs in as that
project's own bot user and is subject to exactly the same rules as the browser and as any
anonymous caller hitting the API directly. Three routes in, one enforcement point. It also
refuses to start if it finds a service key in its environment, because a service key
reaching a project is itself the failure and should be loud rather than convenient.

The schema now carries `board_project`, `board_member`, and membership-scoped policies on
all three tables, forced so the table owner is subject to them too. Beyond the obvious:

- **Ticket numbers count per project.** A shared sequence would leak the existence and
  volume of other projects' work through the gaps in your own numbering.
- **`project_id` is immutable**, enforced by a trigger. Without it, someone belonging to
  two projects could move a ticket and its whole history between boards, and the policy
  would allow it because both ids pass the membership check.
- **A member can only see the projects they belong to**, so a board cannot enumerate the
  names of other people's projects.
- **The membership check is a `security definer` function with an empty `search_path`**,
  which breaks the recursion of checking membership from inside the membership policy
  without opening a path-injection hole.

The UI resolves its board before issuing any ticket query, and shows a refusal rather than
falling through to an unscoped read. Its client-side allowlist is now documented as a
courtesy gate rather than access control, because anything in a file the browser loads is
editable by whoever loads it.

**Also removed:** a live publishable key for a real project was sitting in the published
`board.html`. Publishable keys are designed to be public and the data behind it was
protected, so this was untidy rather than dangerous, but it identified a specific backend
and has been replaced with a placeholder.

The README now ends with instructions for proving the isolation rather than trusting it,
including pointing the CLI at a board its bot does not belong to and confirming the refusal.
A control nobody has watched fail is a control nobody has tested.

---

### Assistants are allowed to read this site, and only this site

**The problem.** The host was blocking AI crawlers across the entire zone, including
`ClaudeBot`, `GPTBot`, `Google-Extended` and `CCBot`, through a managed `robots.txt` block
prepended to whatever the site serves.

For most sites that is a sensible default. For this one it is backwards. The framework is
given away under AGPL, the code is already public, and the founders it is written for
increasingly ask an assistant rather than a search engine. Being unreadable by assistants
costs discovery and protects nothing that was not already public.

**Why it is done here rather than in the host's settings.** That control has no
per-hostname granularity. Both the managed block and the per-crawler blocking apply to the
whole zone, and the other hostnames on this zone, including a UAT environment, should stay
blocked. `robots.txt` is the only lever that is per-hostname, so the exception is declared
in this site's own file and nothing else changes.

Same-agent groups are merged by conforming parsers, and on an equal-length path the least
restrictive rule wins, so the allows here should override the managed disallows. That
behaviour is documented by Google and followed by most crawlers but guaranteed by none, so
the served file is verified after release rather than assumed correct.

---

### The sitemap was unreadable, and three other things search engines were seeing

**The sitemap started with a byte order mark.** `sitemap.xml` began with the bytes `EF BB BF`
before its XML declaration. The XML specification requires the declaration first, so strict
parsers reject the file outright, and a rejected sitemap means the only page on the site was
relying entirely on being found by other means. It was written by a tool that adds a BOM by
default, which is the same defect that once put a BOM in a commit subject line. Rewritten
without one, and the last-modified date brought up to date, since it had been stale for two
days across several content changes.

**There was no icon.** No `rel="icon"` was declared, so the tab and the search result showed
a blank page glyph, which reads as abandoned next to results that have one. Now an inline
SVG of a terminal prompt, as a data URI, so it costs no request and cannot 404.

**The structured data described the software and nothing else.** A single
`SoftwareApplication` node with the author inlined as a bare name. Replaced with a linked
graph: `WebSite`, `Person` with a verifiable profile, `SoftwareSourceCode` for the repository
and licence, and `SoftwareApplication` referencing the others by id rather than repeating
them. Search engines and AI crawlers can now follow the relationship between the project, the
code and the person, instead of reading four unconnected facts.

**Headers were left at the platform defaults.** A `_headers` file now sets HSTS, a referrer
policy, frame denial and a permissions policy, and caches the share card hard since its
contents never change without its name changing. The HTML is deliberately left revalidating
on every request, because this page changes on every release and a stale copy of the only
page on the site is worse than a request that almost always returns 304.

---

### The public page opens with the founder's problem instead of the product's mechanics

**The problem.** The page led with how the framework works: drop an idea on the board, agents
build a v1. That tells a reader what happens without telling them why they should care, and
it asks them to understand a process before they have been given a reason to want one.

**What changed.** The opening now states the two problems a founder actually has, validating
the idea and getting it built into anything real, and says plainly that with current AI
coding tools the building is no longer the hard one. Only then does it describe what this is.

It also stops hedging about what "built" means. The claim is a working product in under two
days with sign-in, features that deliver real value and usage analytics, explicitly not a
demo that falls over when someone touches it. That distinction is the whole difference
between a prototype and something you can put in front of a customer, and it is the reason
the framework exists.

The page speaks in the first person now, because the honest version of this is a founder
saying what did not work for them before this did. "I tried and tested a lot of setups
before landing on this one" is doing more work than any claim about the framework, since it
tells the reader the thing was arrived at rather than designed in the abstract.

A short note under the repository link answers the question a reader will have at the moment
they consider cloning: it runs on Claude Code, the roles are plain markdown, and moving to
Codex changes where the files land rather than requiring a rewrite.

The four metadata descriptions, which had drifted into repeating the old mechanics line, now
carry one short value statement instead.

---

## 2026-08-04

### The public site moved to Cloudflare Pages, and now has HTTPS

**The problem.** The site had been served over plain HTTP for more than 47 hours because
GitHub Pages never issued a TLS certificate. Every check passed throughout: DNS resolved to
the right place, the record was unproxied, the `CNAME` file was present, the ACME challenge
path was reachable over HTTP and returned a clean 404 rather than a redirect, CAA permitted
the issuing authority, and GitHub's own health endpoint reported `is_valid: true` with no
error. The certificate state simply sat at `new` — the request had never started.

Two days went into diagnosing a configuration that was never wrong, including one full
teardown and rebuild that changed nothing because there was nothing to fix.

**What changed.** The site is now served by Cloudflare Pages from the same repository, with
the domain on the same vendor. The certificate issued in under a minute. HTTP redirects to
HTTPS automatically.

That is not a workaround, it is the infrastructure standard published earlier the same day
being applied to the studio's own site. The standard already said to host and DNS with one
vendor, and named a static-host-behind-a-different-DNS-provider pairing as the combination
to avoid. The site was the counter-example in its own documentation.

**Pushing turned out not to be publishing.** The host's git webhook does not fire. Its
dashboard says the project is "disconnected from your Git account" while simultaneously
showing the repository connected with automatic deployments enabled on `main`, and a test
push provably produced no build. A release that reports success while the site keeps serving
an older build is the exact failure this changelog rule exists to prevent, so it was not
left as a manual step.

`-Release` now asks for the rebuild directly, via a deploy hook that does not depend on that
linkage. The hook URL is a credential and lives in the private config rather than in the
published script. If the rebuild is refused or unreachable, the release says so plainly and
states that the site is still serving the previous build, rather than printing success.

Otherwise releasing is unchanged: one command, one note, both repositories. No build
command, no framework preset, static files from the repository root.

The runbook in `infra/reference/DNS_TLS_RUNBOOK.md` now records the outcome as well as the
procedure, including the checks that correctly proved the configuration was fine. Those
checks were not wasted; they are what made it safe to stop trying to fix it.

---

### Drift now says which direction it drifted

**The problem.** When an installed agent differed from the base, the tool called it "drift"
and said someone had edited the install. That is one of two possible causes and it is a
coin flip which. Either the base moved forward and the install has not caught up, which is
harmless, or the install was edited directly and holds a lesson that exists nowhere else.

The two need opposite responses, and both wrong answers destroy something. Syncing over a
hand-edited install erases the only copy of that change. Promoting a merely stale install
into the base reverts the improvement for every project. This ambiguity has already come
within one command of force-pushing away eight files of accumulated agent learnings.

There was also no way to tell them apart even in principle, because nothing recorded what
each installed file had been installed *from*.

**What changed.** The installer now writes `.install-manifest.json` alongside the installed
roles, recording the base hash each one came from. `-Status` classifies every difference
against it and reports four states rather than one: missing, out of date, hand-edited, and
unknown. Each carries the response that fits, and unknown is reported honestly as unknown
rather than guessed.

The guard also stopped crying wolf. Previously any difference required `-Force` to
overwrite, including the ordinary case of the base having moved on, which trains a person
to reach for `-Force` reflexively — and a guard that is always overridden is not a guard.
Now a file that still matches what it was installed from is simply updated, and `-Force` is
demanded only where something would genuinely be lost.

A role skipped as hand-edited deliberately keeps its stale manifest entry. That entry is
the evidence, and overwriting it would erase the thing that proves the install diverged.

---

### An infrastructure standard, so every project stops choosing a stack from scratch

**The problem.** Five projects had reached three hosting providers, three datastores and
three unrelated authorization models. The cost of that is not the bill. It is that "how is
access actually enforced here" has a different answer in every project, and that is the
single highest-risk thing a reviewer checks. A role that has to relearn the enforcement
model per project will eventually check the wrong one and find nothing wrong.

**What changed.** `base/infra/INFRA_STANDARD.md` names a default — Next.js, Supabase,
Cloudflare Pages — chosen because nothing in it bills for existing, and because one auth
model studio-wide means one thing to review. It is not aspirational; it is the stack already
proven on the most complete product here.

Deviation stays legitimate but needs a named trigger: a static site with no accounts should
not have Postgres dragged into it, and a product already running on another stack is not
migrated for consistency, it gets a cost ceiling instead. Anything else is a preference, and
preferences do not get their own stack.

Beside it, `base/infra/reference/` carries working starting points rather than prose: ignore
rules meant to go in before the first commit, an `env.example` that explains the public
versus server-side prefix boundary as a security boundary rather than a naming style, a
default-deny row-level security schema with the verification queries to run instead of
trusting the policy text, and a DNS and TLS runbook.

Four rules in it were learned rather than designed. Enable row-level security in the same
migration that creates the table, because the gap between the two is a public database.
Do not run two vendors for one job. Infrastructure that exists only in a hosting dashboard
cannot be rebuilt or handed over, and a site can serve correctly for months that way before
anyone notices. And never cycle a domain to hurry a certificate: a studio site spent more
than 47 hours without HTTPS while every configuration check passed, and re-adding the domain
restarts issuance from zero.

The standard reaches the roster rather than sitting in a document. tech-lead does not open a
stack debate on a new project, devops-engineer owns the reproducibility and DNS rules,
backend-engineer starts tables from the default-deny schema, and security-reviewer audits
against four failures that have each been found true of a live project here.

---

### A warm start that nothing imports is a file nobody opens

**The problem.** Each project keeps its own state in `WARM_START.md`: what is true now, the
single next action, what is deliberately unbuilt, and the decisions already settled. The
`/wind-down` skill writes it carefully at the end of every session.

None of that helps if no session reads it back. `CLAUDE.md` is the only file loaded
automatically, so a warm start is only reachable if `CLAUDE.md` imports it with a line
reading `@WARM_START.md`. Where that line is missing, the state gets written every session
and opened in none, which is the same outcome as never writing it, for more effort.

Nothing breaks when this is wrong, which is why it survives. The studio itself had been in
that state for two days while maintaining the same documents for every other project. Its
own next action and its own settled decisions were sitting in a file no session loaded.

**What changed.** `-Status` and `-Doctor` gained a STATE DOCUMENTS section reporting, for
every project, whether a warm start exists and whether anything actually imports it. Three
outcomes: `ok`, `none` for projects that keep no state, and `UNREAD` for the failure this
describes, with the one-line fix. The check looks beside the warm start and at the project
root, because the import resolves relative to the `CLAUDE.md` that declares it.

The studio is checked first and by name. Project discovery skips folders starting with an
underscore, so without that the guardian would have stayed the one thing not being watched.

`METHOD.md` now states the requirement where the two documents are introduced, rather than
leaving it as something you find out by not doing it.

---

## 2026-08-03

### /wind-down knows what to check before committing

**The problem.** Wind-down often ends with someone asking for the governance documents to be
committed, which is exactly when `git add -A` gets typed. A real session hit two traps in one
go. The documents lived in a nested repository with its own `.git`, so the parent excluded the
folder and force-adding into the parent would have been wrong. And a credentials file sat in
that nested repo untracked but *not ignored*, one `git add -A` from being committed forever,
because every secret rule in the parent gitignore stops at a nested repo boundary.

The session flagged the file as safe on the grounds that nothing had committed it yet. That is
true about the past and wrong about the next command.

**What changed.** The skill now runs four checks before staging anything. Which repository you
are actually in, since a nested `.git` usually explains the ignore rule, and the comment above
a rule tends to hold the answer the rule alone does not. Whether sensitive files are ignored
rather than merely untracked, because only ignored files are actually safe. That a nested repo
inherits none of the parent's protections and needs its own. And whether the repo has a remote
at all, since a commit with nowhere to go buys integrity but not durability, and surviving the
machine is half the point of writing state down.

Staging is by name. `git add -A` is out.
### The new-project scaffold teaches, and SOURCE_OF_TRUTH is retired

**The problem.** `WARM_START.md` in the scaffold was 200 bytes of four headings and four
`[fill per project]` placeholders. Meanwhile the `/wind-down` skill explained in detail what
each section should contain and why. A newcomer reads the template first, writes four thin
paragraphs, gets no value from it and stops maintaining it. That is exactly what happened to
the copies in this studio, which sat unfilled for months.

**What changed.** The template now carries a line of guidance per section with worked
examples, and points at `/wind-down` as the thing that maintains it. It shows the difference
between "continue the build" and "the tenant filter on the property service, service layer
done, controller not started". It adds the two sections that were missing and matter most:
open items, where the reasoning is the valuable half rather than the status, and known gaps
not yet built, which is what stops the same decision being relitigated every few weeks.

`METHOD.md` now explains why each project keeps its own state at all: a shared base can say
how to work, but only a session knows where a project actually is, and sessions end.

`SOURCE_OF_TRUTH.md` is retired as a concept and removed from the scaffold, the method and
the tooling. `/wind-down` will leave an existing one alone and flag it rather than keeping
it alive.
### The studio now records its own state

It had `CLAUDE.md` and `METHOD.md`, so a fresh session knew the model but nothing about
where things stood: what was outstanding, what had been decided, what not to touch and
why. `WARM_START.md` fills that, with current state, next action, open items, known gaps
not yet built, the decisions table, and a resume prompt.

The guardian was the one project not following its own governance rules.
### Skills, starting with /wind-down

**The problem.** The governance is twenty-five sections of prose that a session has to
read, hold in context and voluntarily follow. Several say "mandatory" or "no prompt
needed". In practice the procedural ones get skipped: wind-down is Rule 2 and still had to
be pasted in by hand each time, and the release protocol existed while a change went to
one repository and not the other.

**What changed.** Procedures now ship as skills rather than paragraphs. The distinction:
judgment stays in the agents, because an agent applies it continuously while doing
something else; a procedure has steps and either ran or did not, so it becomes a skill that
can be invoked and cannot be half-remembered.

`/wind-down` is the first. It finds the governance documents even when they sit in a parent
venture folder, warns that anything held in context may be stale, reads each file from disk
in full, edits in place with the decisions table append-only, shows the diff before
applying, and refuses to touch generated agent files. It exists because a document was once
regenerated from memory and twenty-seven recorded decisions vanished.

The studio distributes skills the same way it distributes agents: `base/skills/` installs
to `~/.claude/skills/` on `-Sync`, and `-Status` reports how many exist and how many are
installed. Roles stay agents, because review needs a separate context and the reviewer must
never be the author.
### Releasing is now a single, mandatory action

**The problem.** Committing the private source and publishing the public export were
separate steps someone had to remember. A change reached one repository and not the other,
and nothing reported the gap. Release messages were also hand-written, so history and
changelog could drift apart.

**What changed.** `CHANGELOG.md` is the single source of the release note. The commit
message is generated from its newest dated section, for both repositories, so they cannot
tell different stories about the same change. `studio.ps1 -Release` commits and pushes the
private repo and publishes the leak-scanned public export in one action, from that one
note. `-WhatIf` previews it.

It is now a non-negotiable standing rule in the ways of working and in the tech lead and
PM mandates: no changelog entry, no release. If you cannot describe the change for someone
who did not build it, it is not ready to ship.
### QA now owns the handoff to human testing, and must explain how to test

**The problem.** Whoever built a piece of work was moving it to UAT the moment it
deployed. That is self-certification, and it confuses two different things: the code being
deployed to a test environment, and the work being ready for a person to look at. On top
of that, a ticket could reach the founder with nothing on it saying what to actually do.

**What changed.** Only `qa-tester` can move a ticket to UAT now. The tech lead deploys and
tags the release, then stops; the ticket stays In Progress until QA has verified it,
confirmed the three deploy gates passed, and written test notes onto the ticket. If any of
those is missing the ticket does not move, and QA says what is missing.

**The test notes are a fixed format**, because "write good notes" produces nothing
consistent. They are instructions rather than a report, in plain language, with no
selectors, endpoints or table names:

```
## How to test

Takes about N minutes. Start at <the exact URL or screen>.

1. <what to do, in plain words>
   Expect: <what you should see>

On your phone: <the one thing worth checking at 375px>

Already checked, no need to repeat: <one line>

Not in this ticket: <what it deliberately does not do>

If something is wrong, note it on this ticket rather than fixing it.
```

Three parts earn their place. An expected result after every step, because otherwise you
are guessing whether what you see is correct. How long it takes, because you are deciding
whether to test now or later. And "not in this ticket", which prevents the most common
false bug report: someone testing for something that was never in scope.

If the notes need fifteen steps, the ticket was too big, and QA is told to say so.

Affects `agents/qa-tester.md`, `agents/tech-lead.md`, `board/BOARD_SPEC.md`.

### Publishing keeps history and explains itself

The public repo previously held a single commit that was force-pushed and replaced on
every release, with a hardcoded message. There was nothing to diff, no record of what
changed, and any fork point or contributed commit would have been destroyed silently.

Publishing now updates the repo in place, touches only the paths it owns, and writes a
message describing the actual change. This changelog is the source of that description.

### The page is a real HTML document

It had no doctype, no `html` element, no `body` and no charset declaration, so browsers
were guessing the encoding and rendering in quirks mode. Now a complete document with
`lang`, charset, canonical, Open Graph and Twitter cards, `SoftwareApplication` structured
data, `robots.txt`, `sitemap.xml` and a share card image.

---

## 2026-08-02

### Startup Studio Kanban

The board the agents work from is now specified and shipped, not just described.
`board/BOARD_SPEC.md` fixes the contract: eight statuses, seven columns, the ticket
fields, the ownership boundary and the CLI surface. `board/reference/` is a working
implementation you can start from.

The shape is deliberately not a per-project choice. Every agent is written against these
statuses and this boundary, so a project that renames a column breaks the contract the
agents rely on, and the failure looks like agents behaving strangely rather than a
misconfigured board.

The founder is the tester. Agents take work as far as UAT on their own; nothing leaves UAT
without a human having tested it and said so, and only an explicit instruction moves
anything to production.

### Work comes from the board, and only from the board

Thirteen roles now know the protocol. Take the top ticket in To Do and work down; To Do is
the only place work is picked from. Read the description before judging a ticket, because
the title is a summary and a list view showing titles only makes a fully specified ticket
look empty. Play the plan back before building. Append progress to the ticket as you go so
the ticket is the record.

### Licensed AGPL-3.0

Chosen over a permissive licence deliberately. The point of the model is that an
improvement made anywhere reaches everyone, and a permissive licence would have allowed a
modified version to go closed while the project asked people to share improvements back.
Now the licence and the request say the same thing. See `LICENCE-NOTES.md`.

---

## Earlier

### The composition model

The founding idea. One base roster of sixteen roles, a small per-project layer for what is
genuinely different, and the working files generated from both and rebuilt whenever either
changes.

It exists because copying the roster into each project does not work. A copy is correct on
the day it is made and then silently stops receiving every improvement made anywhere else.
Nothing warns you; it drifts until someone notices output that should not be possible. The
reverse also happens: an agent told to update its own instructions edits the installed
copy rather than the source, it works immediately so nobody questions it, and the next
sync deletes it.

### Design lead split out from designer

Direction and execution were one role, which meant the person setting the standard was
also the person meeting it. `design-lead` now owns the vision, the brand, the anti-slop
bar and the mobile-first standard; `designer` executes to that direction and reviews what
was built against it.
