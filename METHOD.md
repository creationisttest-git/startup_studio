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
| `_STUDIO\base\governance\` | Governance identical in every project. | Anyone, any project |
| `_STUDIO\new-project\` | Scaffold for a project's own docs. | Rarely |
| `<project>\.claude\agent-overlays\_project.md` | That project's stack card, layered onto every role. | That project |
| `<project>\.claude\agent-overlays\<role>.md` | That project's delta for one role. | That project |
| `<project>\.claude\agents\` | Generated. Base plus card plus overlay. | Nobody. It is output |
| `~\.claude\agents\` | Base install for projects with no tuning. | Nobody. It is output |

Claude Code only ever loads agents from `~\.claude\agents\` and
`<project>\.claude\agents\`. Everything else in this table exists to produce those two.

`WAYS_OF_WORKING.md`, `WARM_START.md` and `SOURCE_OF_TRUTH.md` belong to each project and
are never distributed. `GLOBAL_WAYS_OF_WORKING.md`, `AGENTS.md` and `BRIDGE_PROTOCOL.md`
are shared and always come from the base.

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
no date is a defect, not a rule. Security gates and the three-gate deploy rule can never
be waived by an overlay; those need sign-off recorded in governance, or the project layer
becomes the route around review.

Deviations are printed at the TOP of every composed agent as well as in the project layer
at the bottom, because a waiver nobody reads gets enforced anyway or ignored in the wrong
direction. `studio.ps1 -Doctor` lists every deviation across every project, flagging any
that is unowned or past its review date.

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
```

`-WhatIf` previews any of them.

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

**Copying the roster into a project.** A project that copies all sixteen roles to change
two of them opts out of every future improvement to the other fourteen, silently. One
project was still instructing its agents to post updates to a chat bridge that had been
retired weeks earlier, because its copy predated the change and nothing could reach it.

Both are solved the same way. One base, layered overlays, generated output.

---

## Starting a new project

1. Copy `_STUDIO\new-project\*` into the project for its own `WAYS_OF_WORKING.md`,
   `WARM_START.md`, `SOURCE_OF_TRUTH.md` and `CLAUDE.md`, and fill them in.
2. Run `.\studio.ps1 -Sync` to place the shared governance.
3. Run `.\studio.ps1 -Tune -Project "<name>"` and fill in the stack card. This is the
   single highest-value file for a project: it tells all sixteen roles what the stack is,
   how access is really enforced, and which studio rules are waived.
4. Run `.\studio.ps1 -Compose -Project "<name>"`.
5. Restart the Claude Code session.

A project with no tuning needs none of steps 3 and 4. It runs on the base install.

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
