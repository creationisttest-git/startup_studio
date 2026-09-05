# Roadmap Actions Kanban: required contract

Every project runs the Roadmap Actions Kanban, and it is the single work queue. This file is
the contract. Build to it exactly rather than inventing a shape per project, because the
agents are written against these statuses and this ownership boundary. Change the shape and
the roster stops matching the tool.

**The board is local files plus git, always.** It is `board.js`, in this directory, run inside
the project's own repository: one JSON file per ticket, committed beside the code. No
database, no network, no credentials, no account to create. A project needs a git repository
and nothing else, so there is never a reason to defer standing one up.

**A visual version on the web is a decision the founder makes for one project.** It is never
an upgrade, never a better tier, and a project that has not chosen one does not have one.
`reference/` holds that path, backed by a database, and the last section of this file covers
what it must do: its display model, the two interface rules it carries, and its security
rules. Read it only if a founder has asked for it. Everything before that section is the board
every project starts with.

---

## Statuses

Ten. Eight of them are the column statuses, in this order and with these exact keys.
A ticket has exactly one status.

```
backlog  todo  in_progress  uat  uat_complete  prod_ready  prod_deployed  done
```

Two further statuses are terminal and render as no column at all:

```
parked  killed
```

A ticket is `parked` when it was started and deliberately stopped, and `killed` when it was
decided against. Both require a reason. They exist because everything started has to end
explicitly: finished, parked with a reason, or killed. Four things at sixty per cent ship
nothing, and a board that can only express `done` quietly encourages exactly that.

## What the file board renders

One section per status, never a condensed column. `board.js` rewrites `BOARD.md` on every
mutation and `list` prints the same shape, taking each heading from the status key in upper
case with underscores as spaces:

```
BACKLOG  TODO  IN PROGRESS  UAT  UAT COMPLETE  PROD READY  PROD DEPLOYED  DONE
```

`uat` and `uat_complete` are separate sections, so a tested ticket is distinguishable by where
it sits and carries no marker. `parked` and `killed` render as further sections whenever they
hold anything, because everything started has to end explicitly and a board that renders only
its columns hides every ending. `BOARD.md` prints all eight column sections whether or not
they are empty; `list` prints only the ones that hold something.

**A visual version condenses this to seven display columns, and that is a requirement of the
visual version alone.** It is specified in the last section of this file. This section
describes what a reader of the file board actually sees, and the two were published as one
model for months because the claim was checked by reading the status list rather than by
rendering a board.

Work is only ever created into Backlog or To Do. A ticket that appears mid-board has skipped
the queue.

## Ticket fields

| Field | Rule |
|---|---|
| `ref` | The human identifier: the board prefix, a hyphen and the number, such as `ST-101`. The filename matches it, and `doctor` reports any file where the two disagree. |
| `num` | The number alone. It counts per project and is never reused, so a restored ticket cannot collide with one handed out while it was hidden. |
| `project` | The board slug, which separates one project's tickets from another's. |
| `title` | A short summary. Never the requirements. |
| `description` | Where the real requirements live, and the running record. Agents append progress, decisions and assumptions here as they work. Required at creation: a title is a summary, and work is picked from the description. |
| `size` | `large` or `small`. Two refusals key off this field, so it is the most consequential single word on a ticket. |
| `status` | One of the ten above. |
| `assignee` | Whoever the project says. Declared per board, and declaring nothing means no restriction. A fixed studio-wide list is what made one existing board impossible to migrate. |
| `test_notes` | Written by qa-tester before a ticket may enter UAT, in words a founder can follow. A ticket in UAT without them is a process failure. |
| `decisions` | Questions put to the founder. Each carries a stable key, its options, the recommendation, and the answer once given. |
| `assessment` | The front-door verdict and its measure. Required before a large ticket may start, and not required on a small one, deliberately. `assess` accepts one on a small ticket rather than refusing it: the exemption is from the requirement, not from the command. |
| `history` | Append-only. Every mutation, who made it, and when. |
| `position` | Optional explicit rank within a column. A ticket without one sorts at its own number, which is what makes ranking migration-free. |
| `created_at` / `updated_at` | Timestamps. |
| `deleted_at` | Set when a ticket is hidden, and cleared again by `restore`. The ticket file, its number and its whole history are never removed. See below. |

**The file board has no release version field, deliberately.** An earlier version of this
contract required one of every implementation and `board.js` has never had it, so the contract
demanded a field the board a project starts with could not carry. The release reference goes in
the history entry that records the deployment, where it sits beside who deployed it and when,
and that is what the roster tells the tech lead to write.

The visual version in `reference/` does carry a `release_version` column, in its schema, its
CLI and its interface, and it keeps a rule of its own about who may write it. That rule is in
the last section. This claim is scoped to the file board because, stated universally, it was
false against an implementation shipping in the same directory.

## The ownership boundary, non-negotiable

The agents move a ticket as far as `uat` on their own. Within the team that move belongs to
qa-tester alone: the tech lead deploys and records the release reference, and the ticket only
reaches the UAT column once QA has verified it and written test notes a person can follow.
Both halves are refusals, not conventions. A move to `uat` by anyone other than qa-tester is
refused, and so is a move to `uat` with no test notes.

The founder tests in UAT and sets `uat_complete`. Nothing leaves UAT without that. This is the
whole point of the board and it is never automated away.

`prod_deployed` is set by the agents only, and only on an explicit instruction to deploy. The
release reference goes in the note on that move, which is where the file board keeps it.
Where a project has built the visual version, the interface must block a person from selecting
it, so the boundary is enforced by the tool rather than by everyone remembering it.

`done` means live in production. Not merged, not deployed to a test environment, live.

A ticket that ships nothing does not pass through the deployment columns. Closing it from
`uat_complete` is correct, because moving it through `prod_ready` and `prod_deployed` would
record a deployment that did not happen.

## Driving it

The agents drive the board from the terminal, never by hand and never by asking a person to
click. The command surface:

```
init <slug> [--assignees a,b,c]        create a board here
add "<title>" --desc "..." [--size large|small] [--assignee X]
list [column]                          the board, or one column
show <ref>                             the whole ticket, including its history
move <ref> <column> --by <role> [--notes "..."] [--override "<reason>"]
assign <ref> <name>|none --by <role>
rank <ref> --top|--bottom|--before <ref>|--after <ref> --by <role>
assess <ref> --verdict build|kill|park --measure "..." --by <role>
note <ref> "<text>" --by <role>
ask <ref> "<question>" --options "a|b|c" --recommend <n> --by <role>
answer <ref> <n> [--decision <key>] [--note "..."]
close <ref> --as done|parked|killed --reason "..." --by <role>
reopen <ref> --reason "..." --by <role>
delete <ref> --by <role>               hides it, does not destroy it
restore <ref> --by <role>              brings a hidden ticket back
deleted                                list what is hidden
wip                                    what is in flight, against the ceiling
audit                                  gaps: unowned work, unanswered decisions
doctor                                 every fault in the board, in one run
```

**`list` prints titles only.** That is why the standing rule exists that a ticket is never
judged from its title. Open it with `show` and read the description first.

**Every mutation that changes a ticket names its author.** `--by <role>` is required by `move`,
`assign`, `rank`, `assess`, `note`, `ask`, `close`, `reopen`, `delete` and `restore`, because
an unattributed change to a ticket is not auditable. Three commands sit outside that rule, and
the surface above shows which: `init` creates a board and has no ticket to attribute, `add`
records the author as `unattributed` rather than refusing, and `answer` is the founder speaking
and is logged as the CEO. It is a self-declared string and not an authenticated identity, which
is stated here rather than left for a reader to discover.

## What makes it different is that the rules refuse

A rule nobody can break is the only kind that survives a bad afternoon. These are refusals in
the program, not paragraphs somebody is trusted to remember:

- Only qa-tester moves a ticket to UAT, and only with test notes written first.
- A large ticket cannot enter `in_progress` without a recorded verdict and a measure.
- Work in progress has a ceiling of **two large and three small**, and a move that would exceed
  it is refused with the count. The numbers are part of the contract: two implementations that
  refuse at different counts are not the same board.
- That ceiling can be overridden, and cannot be overridden quietly. The refusal comes first;
  `--override "<reason>"` passes it, and an override whose reason is blank is refused as hard as
  none at all. The reason is written to `overrides.json` beside the tickets, which git commits,
  and to the ticket's own history, and the next refusal reports how often the gate has been waved
  through before. **The record is written only if the move actually happens**, so an override
  stopped by a later refusal leaves nothing behind: a count that includes attempts cannot support
  a rule about how often a gate was really passed. A gate with no override gets hand-edited around
  instead, and then it has no record at all.
- **The override hardens.** When three or more overrides on a gate fall inside fourteen days,
  that gate stops accepting overrides at all and says so. There is no flag for it: the way
  out is to finish or park something, or to let the entries age out of the window. Overriding is
  meant to be the exception, and a gate that can always be waved through is one that eventually
  always is. The unit is deliberately OVERRIDES rather than sessions, because this program has no
  session identity and a proxy for one would be a different rule under the same name.
- A question put to the founder must carry at least two options and a recommendation.
- With more than one decision open, answering without naming which one is refused, and the
  open ones are listed rather than guessed between.
- A ticket cannot be parked or killed without a reason. `done` needs none, deliberately: the
  history already carries how it got there, and a reason demanded for the ordinary ending is a
  field people learn to fill with a full stop.
- A terminal ticket is not moved. It is reopened deliberately or left alone.
- `init` refuses to run where a board already exists, rather than overwriting one. `--force`
  overrides that, and the refusal names the switch rather than hiding it, because somebody who
  genuinely means to replace a board should not have to delete files by hand to do it.
- A ticket file that would overwrite an existing number is refused, because a silent collision
  is worse than a stopped command.

Every one of those must be executed by the board's own test suite. A proof file that ships and
is run by nothing is indistinguishable from no proof at all, and that has happened here.

## The front door

Large work is assessed before it starts, and the board is what enforces it. `move` refuses to
put a large ticket into `in_progress` unless `assess` has recorded a verdict and a measure.

The verdict is one of `build`, `kill` or `park`. **A kill is a legitimate outcome and is the
point of the exercise.** The measure answers two questions in one sentence: what should this
move, and what is that number today. Without the second half there is nothing to compare
against when the work is done.

**Small work is exempt, deliberately.** A gate that fires on everything gets routed around,
and a gate that is routed around protects nothing. That exemption is part of the contract and
must be proved by a test rather than assumed.

## Decisions live on the ticket

A question put to the founder is recorded with `ask` and answered with `answer`. It arrives as
numbered options with a recommendation, so the reply can be a single character, and the answer
is appended to the ticket rather than lost in a conversation.

Each decision carries a stable key, such as `d2`. With more than one open on a ticket, `answer`
requires the key and lists the open decisions rather than resolving the most recent one. That
refusal exists because a board without it filed an answer against the wrong question, and the
false record matched the recommended option, so it read as agreement rather than as an error.

`audit` and `close` name every open decision, not only the first. A ticket cannot be closed
over a question nobody answered.

## Single writer, declared rather than enforced

Ticket mutations happen on one branch only. Two branches can each compute the next ticket
number, each write a different filename, and git will merge them without a conflict, so the
collision is silent. `doctor` detects a duplicate after the fact; nothing prevents one.

This is a declaration rather than a control, and it is written down here because a ruling that
is not written into the documentation of the thing it governs is unimplemented. If a project
ever needs parallel writers, renumber the collision and leave a forwarding record rather than
reusing a number.

## Deletion is recoverable, and git is what makes it so

Deleting a ticket hides it by setting `deleted_at`. The file, its number and its whole running
record survive, and `restore` brings it back. `deleted` lists what is hidden.

**Git is the durable store**, so every mutation reports how many ticket files are uncommitted,
as a count rather than as a flag. Nothing written to the board is safe until it is committed
and pushed, and a board whose changes sit uncommitted is one lost working directory away from
having no history at all.

Because the store is a repository, the board is versioned, diffable and reviewable exactly
like the work it tracks, and a ticket's history is a real history rather than a rendered one.

## Where the board lives

`board.js` resolves a board in four ordered steps, and the order is part of the contract
because it is what allows the program and a project's tickets to be separate things:

1. `BOARD_HOME`, if set.
2. A `project.json` sitting beside the program.
3. A `.board` directory found by walking up from the working directory to a repository
   boundary.
4. `.board` in the working directory.

The walk-up is a finder, and it is correct for every command that reads a board. **A command
that creates a board never uses it.** `init` resolves an explicit location only, because a
lookup that searches outward is safe for a reader and dangerous for a writer: run inside a
project, it would otherwise resolve the board it is about to overwrite.

`doctor` reports every fault in one run: unresolved conflict markers with their line numbers,
files that will not parse and which file it was, a `ref` that disagrees with its filename,
duplicate numbers, a corrupt `project.json`, and no board at all. A corrupt ticket must never
take a command down with an error that names the offending character and not the file.

## If you build the visual version

Only if a founder has asked for one. None of the rules below are optional for it, and every one
of them was learned by getting it wrong.

**Seven display columns.** `uat` and `uat_complete` both render in the UAT column, with
`uat_complete` carrying a visible marker so a tested ticket is distinguishable at a glance:

```
Backlog  To Do  In Progress  UAT  PROD Ready  PROD Deployed  Done
```

This is the visual version's model and not the file board's. Somebody reading a screen scans
across, so a condensed board reads better; somebody reading `BOARD.md` scrolls, so a section
per status costs nothing and carries more.

**`release_version` is written by the agents and is read-only in the interface.** The visual
version carries the field the file board does not. The interface must not offer it for editing:
it records what was deployed, and a person changing it afterwards makes the board disagree with
what is live.

**A confirmation dialog must not overstate its consequence.** The delete dialog said
"permanently" and "cannot be undone" for some time after both had become false, and a warning
that overstates its consequence teaches people to ignore the ones that do not. If deletion ever
becomes permanent again, the wording changes back with it.

**No project ever holds a key that bypasses row-level security.** A CLI that authenticates
with such a key means that on a shared backend every project holds a credential able to read
and write every other project's board, and no policy can revoke it. A policy cannot constrain
a key that is defined as outranking policies. Sign in as a per-project bot user instead, one
bot per project and never shared, and refuse to start if a privileged key is found in the
environment. The deploy step refuses to publish with one in scope, because a key that never
reaches the CLI is still a key if the publish carries it.

**The control is the revoke, not the flag.** Hard delete is taken away from the signed-in
role, so it cannot be issued by the interface, by a script, or by anyone holding the
publishable key and a shell. A flag the application is merely trusted to honour is not a
control, because the data API is reachable directly and does not care what the page sent.

**Credentials are read from the environment, never embedded, and the ignore rule goes in
before the first commit.** A credential removed afterwards is a history rewrite rather than a
delete, and it stays valid until it is rotated. Carry a hygiene check that fails if a
privileged credential appears in any tracked file: `reference/hygiene-check.js` is that check,
because a rule nobody runs is a rule that eventually breaks.

**Prove the isolation, do not assert it.** `reference/isolation-checks.sql` carries the proofs
with the required result written beside each. The one that counts is the negative control: a
bot pointed at a board it does not belong to must be refused by name. Every other check confirms a
bot can see what it should; only that one confirms it cannot see what it should not, and a
control nobody has seen fail is a control nobody has tested.

---

## Why this is fixed rather than per project

The board is the interface between the founder and the team. Every agent in the roster is
written against these statuses, this ownership boundary and this command surface. A project
that invents its own column names or lets a person set `prod_deployed` has broken the contract
the agents rely on, and the failure will look like the agents behaving strangely rather than
like a board misconfiguration.

Project-specific choices belong in the parts this contract leaves open: who the assignees are,
whether there is a visual version, and, if there is, where it is hosted and how access to it
is gated.
