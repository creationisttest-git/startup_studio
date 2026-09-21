# CLAUDE.md

Read all files listed below at the start of every session before doing any work. Claude Code maintains them directly, updating them in place under the read-before-write protocol every session, before any item is called complete. The CEO watches the work and answers in the Claude Code session; there is no separate chat and nothing is relayed by hand.

@GOVERNANCE_CORE.md
@WAYS_OF_WORKING.md
@WARM_START.md
@AGENTS.md
@BRIDGE_PROTOCOL.md

`WAYS_OF_WORKING.md` and `WARM_START.md` come with this scaffold. The other three are part of
your studio's shared governance, placed by `studio.ps1 -Sync` from `base\governance\`, which the
public export does not carry. Write your own there before you sync, or delete those three
lines so the session is not looking for files that do not exist.

**The sync places FOUR files and this imports THREE of them, deliberately.**
`GLOBAL_WAYS_OF_WORKING.md` is the full reference and is NOT imported: it is four times the size
of the core and is re-sent on every request of every session if you load it. `GOVERNANCE_CORE.md`
carries the rules and points at it. This scaffold imported the reference and not the core until
2026-09-21, so a project created from it loaded the one document its own governance says to leave
alone.

Current focus: [fill in per project]
