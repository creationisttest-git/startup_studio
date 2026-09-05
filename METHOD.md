# The studio method

How the agent roster and shared governance are managed across every project.

Read this before changing an agent, adding a project, or wondering why a rule is not
taking effect. It exists so no project has to work any of this out again.

---

## The one rule

**There is one base. Projects layer on top of it. The layered result is generated.**

Nothing is ever copied and then hand-edited. A copy is a fork, and a fork is correct on
the day it is made and silently wrong forever after, because it stops receiving every
improvement made anywhere else.

---

## Where everything lives

| Path | What it is | Edited by |
|---|---|---|
| `_STUDIO\base\agents\<role>.md` | The base roster. Stack-neutral, studio-wide. | Anyone, any project |
| `_STUDIO\base\fragments\<name>.md` | A rule shared by many roles, written once and pulled in with `{{include: name}}`. | Anyone, any project |
| `_STUDIO\base\governance\` | Governance identical in every project. | Anyone, any project |
| `_STUDIO\new-project\` | Scaffold for a project's own docs. | Rarely |
| `<project>\.claude\agent-overlays\_project.md` | That project's stack card, layered onto every role. | That project |
| `<project>\.claude\agent-overlays\<role>.md` | That project's delta for one role. | That project |
| `<project>\.claude\agents\` | Generated. Base plus card plus overlay. | Nobody. It is output |
| `~\.claude\agents\` | Base install for projects with no tuning. | Nobody. It is output |

Claude Code only ever loads agents from `~\.claude\agents\` and
`<project>\.claude\agents\`. Everything else in this table exists to produce those two.

`WAYS_OF_WORKING.md` and `WARM_START.md` belong to each project and are never distributed.
The shared governance files under `base\governance\` always come from the base and are
never edited inside a project. They are one studio's own house rules, so they are not part
of the public export: write your own and put them there.

That split is deliberate. A shared base can tell every project how to work, but it cannot
know where any particular project actually is: what is half-built, what is blocked, what
was decided last week and why. That knowledge only ever exists inside a session, and a
session ends.

So each project keeps its own state, and `/wind-down` writes it before the session closes.
`WAYS_OF_WORKING.md` holds what is durable: the architecture, the data model, the decisions
table, the risks. `WARM_START.md` holds what is current: the state, the next action, what
is half-finished and exactly where.

The part people leave stale is the resume prompt at the bottom of `WARM_START.md`, and it
is worth the most. It is the difference between a new session resuming and re-deriving.

**Both files must be imported from the project's `CLAUDE.md`, with a line reading
`@WARM_START.md`.** `CLAUDE.md` is the only file a session loads on its own. A warm start
that nothing imports gets written carefully at the end of every session and opened at the
start of none, which is the same outcome as never writing it, for more effort. The import
resolves relative to the `CLAUDE.md` that declares it, so if the documents sit in a
subfolder the path has to say so.

This is easy to miss because nothing breaks. The studio itself sat like that for two days
while maintaining everyone else's copies. `studio.ps1 -Status` now reports it under STATE
DOCUMENTS, for every project and for the studio.


### Fragments

A rule that belongs to several roles is written once and included, rather than pasted into
each. Nine roles carried one paragraph about tickets, byte-identical, and it stayed identical
only because nobody had yet needed to change it. The first change would have been nine edits,
and the ninth is the one that gets missed.

```
{{include: ticket-is-the-record}}
```

The composer resolves these on the way out, so a generated agent always carries the rule itself
and never the marker. **A missing or empty fragment refuses to build.** It does not warn and it
does not leave the marker behind: a role that has silently lost a rule looks exactly like one
that never had it, and looking correct while being wrong is the failure this whole model exists
to prevent. `-Doctor` reports any fragment no role includes, because that is a rule that has
quietly stopped applying to anybody.

Not everything repeated belongs in a fragment. Roles that say related things in their own words
are usually right to, and flattening them into one paragraph loses the discipline each was
written from. Extract what is byte-identical; leave what merely rhymes.

---

## The routing test

When you learn something that makes a role better, ask one question.

**Would a project on a different stack benefit?**

Yes. It is a studio lesson. Write it into `_STUDIO\base\agents\<role>.md`, phrased
stack-neutral. Keep the pattern, drop the particulars. "A join against a relationship
that does not exist fails silently" travels. "A PostgREST embed 400s without an FK" does
not. Then run `-Sync` so every project gets it.

No. It is project-specific. It goes in that project's overlay. Use the stack card when it
affects every role, a role overlay when it affects one.

---

## Context, extension, deviation

Three kinds of project-specific content get written the same way if you let them, and
conflating them is exactly how a shared base stops meaning anything.

**Context** is a fact about this project. The stack, where the code lives, how access is
actually enforced. It contradicts nothing, it is most of what a stack card holds, and it
needs no approval.

**Extension** is an extra rule this project needs that the base does not have. Additive,
no conflict, no approval.

**Deviation** is a base rule waived, weakened or replaced. This is the only dangerous
category and the only one that carries ceremony.

Every deviation gets a row in the stack card's register, with the base rule affected, what
changes, why, who approved it, the date, and a review date. A deviation with no owner and
no date is a defect, not a rule. Security gates cannot be waived by an overlay, and neither
can the rule that nothing deploys until the mobile, content and code reviews have all passed.
Waiving either needs sign-off recorded in the shared governance, or the project layer becomes
the route around review.

Deviations are printed at the TOP of every composed agent as well as in the project layer
at the bottom, because a waiver nobody reads gets enforced anyway or ignored in the wrong
direction. `studio.ps1 -Doctor` lists every deviation across every project, flagging any
that is unowned or past its review date.


---

## The five phases

The roster refers to phases by number, so they are defined here rather than only in the shared
governance that ships to projects but not to the world. A published role that names Phase 0 with
no definition anywhere in the export is an instruction nobody outside this studio can follow.

**Phase 0. Discovery, and the right to refuse.** Before any screen or any code, six leads
assess the idea in one pass, one paragraph each, strictly inside their own discipline. The
idea is quoted in the founder's own words rather than paraphrased, and they return BUILD,
KILL or PARK with the measure it must move and the objections, including the ones that lost.
The answer is allowed to be no. This is what `/assess` runs, and it is the last cheap moment.

**Phase 1. The design gate, which is the founder's.** The design direction and the screen
layouts are presented, and nothing is built until the founder approves the look. A gate the
founder does not personally hold is not a gate.

**Phase 2. Build, in parallel.** Product and go-to-market at once, not one after the other, so
the launch is ready when the feature is rather than starting when the feature lands.

**Phase 3. Review.** The build is checked against the approved design, then code review,
security review and a real browser. Any critical finding bounces the work back. The reviewer
never wrote the thing they are reviewing.

**Phase 4. Ship.** The work, the launch, the operational plan and the open questions are
assembled and brought to the founder. Their yes deploys to staging, where it is tested again,
because the environment is part of the change.

The numbers are a shared vocabulary rather than a schedule. A small change passes through all
five in an afternoon; a large one may sit in Phase 0 for a week and be killed there, which is
the phase doing its job.

---

## The front door

An idea is assessed before it is built, and the answer is allowed to be no.

The squad builds what it is asked to build. That is the failure. A founder who asks for a
feature gets one, competently, and nobody ever asked whether anyone wanted it or how you would
know if it worked. The cost is not the wasted build; it is that the founder never finds out the
idea was weak, because a finished feature looks like a success until the numbers arrive.

`/assess` runs six leads over a new idea, one paragraph each, strictly inside their own
discipline. It returns BUILD, KILL or PARK, and three things go on the ticket: the verdict, the
measure it is expected to move, and the objections including the ones that lost. That third is
the one people skip and the one that pays, because a killed idea returns in three weeks and
without it the argument restarts from nothing.

**Nothing is built without a measure agreed beforehand.** If nobody can say what an idea is
supposed to improve, that is the strongest available signal to kill it: a thing that cannot fail
cannot succeed either.

**A kill is the gate working.** If nothing is ever killed at the front door then it is not a
gate, it is a formality, and everyone will work out that it can be walked past.

---

## Releasing

Nothing ships without a changelog entry, and the entry is written before the release.

`CHANGELOG.md` is the single source of what changed and why, written for someone who did
not build it. The release message is generated from its newest dated section, so the
repository history and the changelog cannot disagree. Where a project has a private source
and a public export, one command releases both from the same note.

This is mechanical rather than a matter of care, because the failures it prevents all look
like success at the time: a change committed to one repository and never pushed to the
other, a force-pushed history that leaves nothing to diff, and a commit that silently
failed while the tooling reported it had published.

---

## Commands

Run from `_STUDIO`.

```
.\studio.ps1 -Status                        what exists and what has drifted
.\studio.ps1 -Doctor                        the same, plus what to run to fix it
.\studio.ps1 -Sync                          push base agents and governance everywhere
.\studio.ps1 -Sync -Force                   also reset drifted governance (archives first)
.\studio.ps1 -Tune -Project "<name>"        start tuning a project, scaffolds its stack card
.\studio.ps1 -Compose -Project "<name>"     rebuild one project from the current base
.\studio.ps1 -Compose -All                  rebuild every tuned project
.\studio.ps1 -Governance                    shared governance only
.\studio.ps1 -Release                       commit private and publish public, one note
.\studio.ps1 -Update                        pull upstream changes, then rebuild everything
```

`-WhatIf` previews any of them.

**`-Release` and `-Update` point in opposite directions, and the difference matters most to
somebody running their own copy of this.**

`-Release` sends your work out. It commits, publishes and rebuilds the site from a single note in
`CHANGELOG.md`. If you have cloned this studio and made it yours, this is the command you use:
you are releasing your studio, not ours.

`-Update` brings somebody else's work in. It pulls, then rewrites your machine-wide roster and
recomposes every project from what arrived. Useful for tracking an upstream you trust, and not
something to run casually: it moves the base your projects are built from.

The failure worth naming is running `-Update` when you meant `-Release`. You will have replaced
your own roster with an upstream one and published nothing, and the projects will recompose
against a base you did not write.

---

## The two failure modes, both real

**Editing the install instead of the base.** `~\.claude\agents\` is what Claude Code
loads, so editing it feels correct and works immediately. Then the next sync overwrites
it, no other project ever saw it, and the lesson is gone.

This is not hypothetical. On 2026-08-02 the base sat eight files behind the install, with
improvements to mobile-qa, frontend-engineer, backend-engineer and five other roles
stranded where nothing could reach them, because agents had been updating their own
definitions in the only copy they could see. A routine push would have destroyed all of
it. `-Status` exists to make that visible, and the script refuses to overwrite a modified
target without `-Force` for the same reason.

**Copying the roster into a project.** A project that copies all seventeen roles to change
two of them opts out of every future improvement to the other fourteen, silently. One
project was still instructing its agents to post updates to a chat bridge that had been
retired weeks earlier, because its copy predated the change and nothing could reach it.

Both are solved the same way. One base, layered overlays, generated output.

---

## Starting a new project

1. Copy `_STUDIO\new-project\*` into the project for its own `WAYS_OF_WORKING.md`,
   `WARM_START.md` and `CLAUDE.md`, and fill them in.
2. Run `.\studio.ps1 -Sync` to place the shared governance.
3. Run `.\studio.ps1 -Tune -Project "<name>"` and fill in the stack card. This is the
   single highest-value file for a project: it tells all seventeen roles what the stack is,
   how access is really enforced, and which studio rules are waived.
4. Run `.\studio.ps1 -Compose -Project "<name>"`.
5. Check the roles are there. Ask the session to name them. Composed on disk and loaded in
   the session are different claims, and only the second one matters.

A project with no tuning needs none of steps 3 and 4. It runs on the base install.

**You probably do not need to restart.** Agent files re-register live, confirmed twice
independently. Restart only if the roles do not appear, and if they still do not, run
`studio.ps1 -Doctor` and read its LOADABLE section before assuming the session is at fault.

That check exists because of the failure it was built from. An agent file must open with
`---` at the first byte for its frontmatter to parse. Anything in front of it, most commonly a
byte order mark from a writer defaulting to UTF-8-with-BOM, means no name, so the agent is
never registered and nothing reports an error. Thirteen of sixteen roles were absent from
every project for weeks while every other check said the roster was current.

---

## Autoload

A `SessionStart` hook runs `studio.ps1 -Autoload` for every project. It walks up from the
working directory, finds the owning project, compares its composed roster against the
current base, and rebuilds only if the base or an overlay has moved. When nothing has
changed it exits silently in about a fifth of a second. When it does rebuild, it says so
in one line.

The effect is that a project is always running the current base without anyone
remembering to sync. Register it once in `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "powershell",
        "args": ["-NoProfile", "-File", "<studio-root>/studio.ps1", "-Autoload"],
        "timeout": 30
      }]
    }]
  }
}
```

Use the `args` exec form rather than a single command string. It bypasses shell parsing,
which matters because a studio path containing a space breaks the string form.

---

## After changing anything in the base

```
.\studio.ps1 -Sync
```

That updates the base install and rebuilds every tuned project. Projects pick it up on
their next session start. Nobody else has to do anything.
