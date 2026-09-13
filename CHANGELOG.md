# Changelog

What changed and why, written for someone who did not build it.

Newest first. Dates are when the change went public.

---

## 2026-09-13

### A decision now reaches you as something you click, and the release gate no longer demands a reviewer nobody could prove existed

**What this gives you.** Three things, in the order they will matter to you. When an agent needs a
decision from you, it has to raise your tool's interactive multiple-choice prompt so you answer by
clicking, rather than typing a list into a reply and hoping you scroll. There is now an instrument
that measures whether that actually happened, and it is the first one this project has ever had for
it. And the release gate no longer names a reviewer role that nothing anywhere proved was real.

- **The rule you were given told every agent to do the wrong thing.** The shared rule about asking
  for a decision said "numbered options, so the reply can be a single character". That describes a
  list typed into a reply. It is now the interactive prompt, with the prose list demoted to a
  fallback for the one case that genuinely has no prompt available, which is a dispatched subagent
  handing its options back to the session that dispatched it. The rule is one file composed into
  seventeen roles and into the shared governance, so it changed in one place and arrives everywhere.
- **Nothing had ever measured it, and that is the part worth knowing.** A search for the prompt by
  name across every document under the venture root found it in no governance file and no
  instrument. The companion rule about brevity has had a measuring tool for weeks. So one of the two
  rules about how you are spoken to was enforced and the other was decoration, and no report would
  have told you which.
- **`tools/check-decision-shape.js` is the new instrument.** It reads the session's own record and
  the project's board and reports how many decisions were put to you against how many prompts were
  actually raised, marking each decision as PROMPT or PROSE. It refuses on the board record, which
  is unambiguous, and only reports on whether a reply merely looks like a list of options, because
  numbered steps followed by a question is how anybody writes ordinary instructions and refusing on
  that shape would fail correct work. It runs in the wind-down set. Twenty assertions, and a project
  with no board reads as cannot-tell rather than as a project in breach.
- **The role that reports on your sessions now leads with those two.** Brevity and the clickable
  decision are sections one and two of the doctor's review, ahead of the instruments and the
  process, because those are the only two surfaces you actually see.

**The release gate demanded a role name and nothing proved the name existed.** The gate required a
reviewer called `doctor` and matched it by exact name against a hand written constant. Deleting that
role from the repository moved no number anywhere: the session start set, the gate's own suite and
the roster count were all identical either way, because the roster check counts FILES and the gate
matches NAMES. Two surfaces were being compared to each other and neither to the roster, so they
could agree perfectly about a role that did not exist.

- **It was live rather than theoretical.** The roster installed on the machine that publishes this
  project held the role under its old name and no `doctor.md` at all, so the gate was printing "start
  one of: doctor" to an install that could not start one.
- **And a sync could not have fixed it, which is why the rename had quietly been blocked.** The
  global install wrote every file the base defines and removed nothing the base had dropped, so a
  sync would have installed the new name and left the old one in place for ever, still dispatchable
  and still carrying claims that had just been corrected. The install now prunes what it placed and
  no longer recognises, and it keeps anything hand edited unless you pass `-Force`.
- **The split between refusing and reporting is deliberate.** The test suite REFUSES when the gate's
  constants disagree with the roles in this repository, because that is ours and a disagreement is a
  defect. The tool only REPORTS on the roster installed in your own home directory, because you may
  be running the method with no roster or with one you wrote yourself, and there is no way to tell a
  broken install from a different setup by looking at it.

**A sentence in the shared governance had been false for months and was about to be copied into
every project.** `AGENTS.md` said that each reviewer returns PASS or FAIL and that only then is a
deploy permitted. No reviewer's verdict has ever blocked anything here, and that includes the work
reviewers: nothing in this repository opens a review transcript, so no PASS and no FAIL has ever
been read by the gate. What the gate does refuse on is whether a review HAPPENED, which is a
different question and the only one it can answer from the record it keeps. A forced governance sync
was about to push the old sentence into five projects, so it was corrected first. It now says
plainly that no verdict stops a deploy, and that the teeth are the ticket a finding gets written to
rather than the gate.

**The method reviewer is called the doctor everywhere.** The role that checked the installation
across projects and the role that checked whether a session followed the method were doing one job
from opposite ends, and neither was read by anything. They are one role now. The rename touched the
roster, the shared governance, the gate tool and the published site, and every edit was applied by a
script that refused unless its pattern matched exactly once, because a plain search for the old name
returned more than fourteen hundred hits across a hundred and seventy five files and almost all of
them were the word directory.

**A review of this release found three things in it that should not have gone out, and the worst
one would have deleted most of your roster.** None of them reached you, because the review ran
before the publish rather than after it, which is the whole reason that step exists.

- **`-Sync -Only <role>` deleted every role it was told to skip.** The prune added earlier in this
  same release read the filtered list of roles rather than the full one, so every role you asked it
  to leave alone looked exactly like a role that no longer exists. Running it for one role reported
  sixteen others as dropped from the source and would have removed all sixteen from your machine,
  giving a reason that was untrue of every one of them. `-Update` went through the same code. It now
  refuses to prune at all on a filtered run and says why, and it refuses again if the source
  directory is empty, which would otherwise have turned a sync into an uninstall.
- **The note describing that fix repeated the false claim it was describing.** The entry above about
  reviewers and deploys said the blocking rule was true of the work reviewers. It is true of neither.
  Nothing in this tool has ever read a reviewer's verdict, so no PASS and no FAIL has ever stopped
  anything; what the gate checks is whether a review happened at all. The sentence has been rewritten
  from the code rather than from memory of it, which is the third time in two releases that
  correcting a false claim produced a new one.
- **The new check for clickable decisions accused a session of something it had not done.** When a
  decision had no prompt inside its own window it said the decision had reached you without one,
  printed directly under a line counting the prompts that were raised. The two causes are different
  faults: no prompt at all, or a prompt raised before the question was written down. It now names
  which, and for the second it says what to do next time rather than printing an instruction that
  cannot be carried out now.

## 2026-09-12

### Your session start is five checks instead of eleven, and a release no longer waits half an hour on a check nobody reads

**What this gives you.** The set that runs when you open a session dropped from eleven checks to
five. The set that runs before a release dropped from fourteen to nine and from about thirty six
minutes to about four. Nothing that protects you was removed. What was removed had, between all of
it, refused once in seventy nine recorded runs, and that one refusal was this project tripping over
its own paperwork.

- **The measurement that prompted this.** Every check writes a row to a ledger, and that ledger is
  committed, so there are seventy nine recorded versions of it to read. Counting refusals across all
  of them: `health-report`, `hook-wiring`, `decision-keys`, `board-doctor`, `resume-pointer` and
  `session-brief` have never refused once between them. `comment-shape` refused a single time, and
  that time it was this repository's own new comments raising its own baseline. Each of those was
  standing in the path between writing a change and being able to test it.
- **They are not deleted, they are in a set called `deep` that nothing gates on.** Run them with
  `node tools/run-checks.js --set deep` whenever you want the full picture. A check that has earned
  its keep as a diagnostic has not automatically earned a place in front of your work.
- **`mutation-coverage` left the release path for the same reason, and it is the big one.** It takes
  about thirty minutes. Its findings are real and they are never urgent: the two open when this
  change was made were fragments of a diagnostic message that no user of this tool will ever see. A
  slow check belongs on a schedule you choose, not between you and a release.
- **`health-report` alone was eighty two per cent of the time your session start took**, 3,351ms of
  4,065ms, for a row that always exits zero and that no gate can read.
- **The method review now reports and never blocks.** When a release has been reviewed for its work
  but not for its method, that is recorded as advisory rather than refused. It used to exit 1 and
  stop the release. It now exits 4, which the runner treats as a notice. A release with no code
  review of any kind still stops at exit 1, and so does one where a commit landed after the
  review read the tree.
- **The first version of that change quietly removed a second guard, and a reviewer caught it.**
  The two places that report a missing method review sit above the check asking whether the tree
  moved after the review started. While both returned a refusal the order could not matter,
  because either way the release stopped. Making one of them advisory made the order load
  bearing: a session with a code review and a commit landing after it reached a green gate with
  nothing having looked at the newer commit. The missing method review is now carried to the end
  and answered last, so the tree question is always asked. Four assertions cover it and go red
  when the early return is put back.
- **Why that split, rather than trusting the reviewer less.** Nothing in this tool has ever read a
  reviewer's verdict. No instrument opens a review transcript, so a review's conclusions have never
  gated anything mechanically. What gated a release was whether a review had been STARTED. Making
  the method half advisory removes a refusal that was never measuring what it appeared to measure,
  and the findings still reach a ticket, which is where they were always meant to live.
- **`reply-shape-recent` left the release set.** It refused a release when a single banned character
  appeared in the session's own replies, with no way to clear it, and by this project's own record
  it blocked four of the last five releases. Nothing a reader of this tool sees was ever at stake.
  The absolute count is still recorded at every wind-down, so no slip is hidden.
- **`board-doctor` left the session-start set for a different reason.** It exits 1 in a tree that has
  never run `init`, so a fresh clone of the published export reported it red before the reader had
  touched anything. It still runs before a release, where a board is expected to exist.
- **What is kept, and why.** `changelog-leak`, because it is the one check here that has ever stood
  between a private name and a public repository. `suite`, because it is the tool you install.
  `board-audit`, `roster-count`, `published-counts`, `governance-core` and `releases-page`, because
  each polices a number or a page that a reader actually sees.
- **Every assertion that encoded the old behaviour was restated rather than deleted.** Eleven
  assertions across two test files named the old exit code or the old set membership. Each one still
  makes its claim, against what the tool does now. Both suites are green: 78 and 137.

---

## 2026-09-11

### Writing your own changelog no longer fails a check every time you start a session

**What this gives you.** You can keep your changelog in your own house style. The releases page
check now tells you it has nothing to compare rather than refusing, unless your configuration
declares that this repository is the one publishing the page.

- **The rule and the check disagreed, and the check was the one you met first.** This project's own
  non-negotiable rule is that nothing ships without a changelog entry written first. Write one
  without the `**What this gives you.**` marker this repository happens to use, and the generator
  could build no page at all, which read as a failure at exit 1. That check runs in the set every
  install runs at session start, so the refusal arrived before any work did, every time, and the
  remedy printed alongside it told you to rewrite your own file.
- **Whether the page is yours is now declared, not guessed.** Set `$PublishesReleasesPage = $true`
  in your configuration and the check holds your page to your changelog as before. Leave it unset,
  which is every install that has not deliberately opted in, and a changelog the generator cannot
  build is reported as nothing to compare. An earlier version of this change inferred the answer
  from whether the tool was configured at all, which is true of every install, so the refusal came
  straight back for anyone who set the tool up. A reviewer measured that before it shipped.
- **The guard for this already existed and could never run.** A test asking whose tree this is sat
  at the bottom of the page comparison. Getting there means the changelog parsed into a page first,
  and the ordinary case does not parse, so the guard only ever protected readers who did not need
  it. It now also covers the failure to build, and it is one named function rather than two copies
  of the same condition, so both refusals move together when the evidence changes.
- **Only the comparison is affected.** Run the generator yourself and a changelog that cannot build
  still fails at exit 1 with the real reason, because then you asked for a page and the error is the
  answer. And in the repository that does publish the page, a page that disagrees with its changelog
  is still a refusal, which is the entire reason the check exists.
- **Measured in a reader's layout rather than in ours.** In a tree holding the tools, a changelog
  and no publisher configuration, the ordinary entry moved from exit 1 to exit 3. Built out to the
  full export from the publish manifest, the session start row moved from FAILED to ADVISORY. Three
  assertions cover it and three separate mutations each break at least one of them.

### A check meant to judge your session could read a different session's instead

**What this gives you.** The two checks that read session transcripts now ask the host which session
is running, instead of taking whichever transcript was written most recently.

- **Two sessions in one repository is normal, and it broke the measurement.** Both checks ranked
  every transcript for the project by modification time and took the newest. Where a second session
  is open on the same repository, the newest file is whichever session typed last, so a check could
  report another session's conduct as yours. On the machine this was found on, the project directory
  held 54 transcripts and a second session had written into the repository in four consecutive
  sittings.
- **There is deliberately no fallback.** Where the session cannot be identified, both checks now say
  so and exit advisory rather than guessing. Falling back to the most recent file is the fault
  itself, and a guess that reads like an answer is worse than no answer: it is the number somebody
  then quotes.
- **Nothing here gets stricter.** Both checks already treated this exit as advisory, so a tree that
  cannot identify its session gets a row saying why and is not blocked.
- **Two of the first four mutations proved nothing and were redone.** One left the refusal in place
  so the fallback was never reached; the other made the match looser in a way no test fixture could
  see, because no session in them was named after another. A fixture was added for the second and
  the first was restated as the edit that actually performs the fallback. All four now break
  assertions.

### A retired rule was still being sent to every project's tech lead

**What this gives you.** The role that actually picks work now carries the queue rule the governance
document publishes, rather than the one it retired.

- **The contradiction shipped inside a single release.** `base/governance/GOVERNANCE_CORE.md` says a
  CEO instruction jumps the queue only if it belongs to the initiative in flight or is a defect we
  introduced, and says in so many words that this replaces the older rule that a direct CEO
  instruction is always top of the queue. `base/agents/tech-lead.md` still carried the older rule,
  word for word, in the same range.
- **Why the role file is the one that matters.** A role reads its own definition as its instructions
  and does not go looking through governance for contradictions. That file composes into five
  projects and publishes in the export, so the studio was distributing a rule it had just published
  a decision to retire, to the one agent whose job is deciding what to work on next.
- **Measured rather than asserted.** Searching `base/` for the retired wording returned two files
  before the change and one after, and the survivor is the sentence that does the retiring, which
  has to keep the words or the retirement stops being findable.

### The mobile gate could report a clean pass over 1,395 pixels of content running off the side

**What this gives you.** Two roster changes, both found by a real defect on a live project the same
night, and both of a kind that will be silently wrong on any project rather than only the one that
found them.

- **The mobile gate now measures element rectangles instead of a document width.** An app shell that
  hides its own horizontal overflow at a mobile breakpoint also hides it from the instrument, so the
  gate reads exactly the viewport width no matter what the content does. The roster already told the
  gate to lift both overflow axes before trusting a width, which works but only if you correctly
  guessed every element that needed lifting; on the project that found this there were 144 of them.
  Reading each element's bounding rectangle against the window width needs no lifting, no restoring
  and no guessing, and cannot be defeated by a stylesheet nobody has written yet. Lifting stays, as
  the way to show how much is hidden and to prove the instrument can see, rather than as the verdict.

- **The frontend role now knows which of the two wrapping rules actually works.** A row containing a
  long unbroken string, such as an email address used where a name was expected, runs off the side of
  a phone even when the container carries the flex settings everybody reaches for. `overflow-wrap:
  break-word` looks like the fix and is not: it wraps the text visually and still lets the unbroken
  string set the minimum width, so the row overflows by exactly as much as it did with no rule at
  all, verified to the pixel. `word-break: break-word` and `overflow-wrap: anywhere` are the two
  spellings that work. The trap is somebody later tidying the one that works into the one that does
  not, so the rule now asks for a comment saying which is load-bearing.

### A whole section of your changelog could vanish from the page while the check said it was current

**What this gives you.** The tool that builds the releases page reads your changelog by date
heading. A heading that is nearly a date, but not exactly one, matched nothing, and everything
under it was quietly discarded while the build carried on and the staleness check reported the page
current.

- **This was not hypothetical.** Someone wrote a second entry for the same day and spelled the
  heading in a way that got past the duplicate-date rule. Their whole entry was in the file, was
  going to ship, and would have been announced on no page and in no release note. Nothing anywhere
  could see it, because a parser that stops looking reports exactly what a parser with nothing to
  report does.
- **A heading that is nearly a date now refuses**, naming the heading and the date to write
  instead. That case is never deliberate.
- **Any other unrecognised heading is counted and warned about, not refused**, because your
  changelog may carry headings this tool knows nothing about and refusing on those would lock you
  out of your own file.

### The check on your own process was the one rule here with no way back

**What this gives you.** The front door measure reports work that reached a commit without its
ticket going through the board, and it refused. There was no exemption, no waiver, no recorded
escape of any kind, and a release is gated on it, so one breach anywhere in the recent commits
blocked every release until those commits scrolled out of range, including for a session that had
done nothing wrong.

- **Every other check here already had a way back, and this one did not.** The comment checker
  takes a recorded rise with a reason. The published numbers checker takes a dated exemption. The
  coverage checker takes a baseline entry with a reason a stranger can read, and refuses when that
  reason no longer applies. This measure said no and stopped, which turns a rule into a wall, and a
  wall does not produce compliance, it produces a queue of work that cannot ship.
- **A waiver names a commit, so nothing can be excused in advance.** A commit that does not exist
  yet cannot be waived. The act has to have happened and somebody has to have written down why it
  stands, with their name on it.
- **A waived breach is still counted and still printed.** The line stating the answer counts it as
  a breach and says how many were waived, so the summary cannot contradict the detail below it, and
  each one carries its full reason and the name of whoever granted it. Worth being exact about the
  limit, because the first version of this note was not: what a reader sees is honest, and the exit
  code on its own does not distinguish a waived run from a clean one, since it was already advisory
  for a different reason. Making that machine readable is written down as its own work rather than
  claimed here.
- **Every waiver must resolve to a commit that already exists.** This is the part that stops it
  becoming a way to ignore the rule, and the first version did not have it. A reviewer wrote one
  waiver that turned the whole measure off, another that excused nine unrelated commits at once,
  and a third that sat dormant and then silently excused a commit made 79 commits later. An entry
  is now checked as a real hexadecimal hash and resolved against the repository, so it cannot be
  written ahead of the thing it excuses.
- **A waiver that no longer matches a breach refuses.** Point one at a commit that is not a breach
  and the check stops and says so, rather than leaving a standing exemption nobody can account for.

### The guard that watches what a session costs could stop every call you made

**What this gives you.** The budget guard runs before every tool call in every project, and it kept
a small file of its own in your system temp directory to remember what it had already told you.
Two faults in that arrangement, both fixed, and the first one is the serious one.

- **Losing that file turned the guard into a wall.** The call count, its place in the transcript,
  and the record of what it had already announced all lived in that one file. Lose it, to a temp
  cleaner, a lock, or a directory it cannot write to, and all three reset: the record of what it
  had announced went back to nothing while it re-read your whole session and got the full total.
  On any session that had already passed the first threshold, which is most long ones, that meant
  a stop on every call for the rest of the session. A stop on every call also stops you winding
  down, so the very thing the guard exists to protect, the state written at the end of a session,
  was what it would have cost you. Measured against the version before it: 60 of 60 calls blocked,
  where the older one blocked none. It now stays quiet on any call where it could not read that
  file, and also on any call where it could not write it, because a stop it cannot record is a
  stop it would make again on every call after that one. The honest bound: where the file is lost
  once, this costs one delayed warning. Where the directory can never be read or written, a full
  disk being the realistic way in, it costs every warning, which is silence. That is the trade,
  taken deliberately, because a guard that says nothing is recoverable and a guard that blocks
  you winding down is not.
- **Being stopped for a long session hid the moment you went over budget.** The guard has two
  thresholds, one on what the session has cost and one on how many calls it has made, and they
  shared a single mark for what had already been announced. So a stop on the call count also
  marked the spend threshold as dealt with, and the session then crossed it in silence. The two
  now keep their own marks, and the message names whichever one actually moved rather than
  whichever number happens to be larger, which is what it was doing when it told this session it
  had stopped because spend could not be read while spend was readable and over.

### Three refusals that told you the wrong way out, found by the review gate before you saw them

**What this gives you.** Every refusal below was correct about there being a problem and wrong
about what to do next, which is worse than staying quiet, because a remedy that cannot be performed
sends you looking for a fault in your own repository.

- **The board could refuse every command and print three ways out, none of which worked.** If an
  eviction is interrupted it leaves a journal file behind, and every command that writes refuses
  while that file exists, which is right: the board is half moved and you need to see it before you
  build on it. If the file itself is damaged, the escape was a loop. Commands that write sent you
  to the rollback command. Rollback refused, because it cannot know what to put back, and sent you
  to a command that writes. And the health command, which is where people actually look when a
  board is behaving oddly, told you to restore the file from version control. It is excluded from
  version control on purpose, so that was impossible by construction. All three now name the same
  real escape, deleting the file, and they name it FIRST, because every other step they suggest is
  refused until it is gone. There is now a test that performs that escape and checks the board is
  free afterwards, rather than checking the sentence was printed.
- **The leak check could report your changelog clean against half of its own rule list.** It reads
  the list of private names from your configuration, and it found the end of that list by looking
  for the first line starting with a closing bracket. A rule carrying its own list of exemptions
  ends on a line of exactly that shape, so every rule below it was never read. The guard meant to
  catch this counted the rules inside the text it had already cut short, so it agreed with itself.
  Watched failing on a three rule config: the old version says clean against two rules with the
  third name sitting in the file. It now reads the list by matching brackets, ignoring anything
  inside a quoted value of either kind and anything in a comment, because the rules are patterns,
  patterns are full of brackets, and a stray bracket in a comment ended the list just as
  effectively. The first attempt at this fix skipped only single quotes, and a reviewer broke it
  again in two lines: a smiley in a comment, and a bracket inside a double-quoted value. Worth
  knowing which way it fails now, because the two are not the same: a bracket that never closes
  makes it say it cannot read your configuration, which is safe, and that is the only direction
  left.
- **Asking to check a release without naming which one reported success and checked nothing.**
  Typing the gate option with nothing after it silently fell back to running a different set of
  checks, overwriting the very record it had been asked to read back, and exiting zero. Naming an
  option and getting the default is now a usage error, for that option and for its partner.

### A rule you cannot come back from stops being a rule and starts being a wall

**What this gives you.** The check that reads your session and refuses a release over an em-dash
now asks a narrower question at release time, and the same absolute question as before at the
wind-down.

- **The problem was that a slip could not be undone.** The check reads the session transcript, and
  a reply that has been sent cannot be unsent. So one slip in the first minute condemned every
  reply after it, however clean, for the rest of that session. Four of the last five releases here
  died that way, including one session that went 45 consecutive clean replies after its slip and
  still could not publish.
- **The obvious fix was measured and thrown away.** Moving the release to the front of a session,
  where the transcript is short, sounds right. Across 50 stored sessions, 43 of 50 would still have
  breached inside their first five replies. That is a change worth two sessions in fifty, so it was
  not built. The number that mattered pointed the other way: sessions recover once they notice.
- **So a breach ages out at release time and never in the record.** The release asks whether the
  last twenty replies are clean. The wind-down still counts every slip in the session, because that
  number is read into the compliance table and a slip you recovered from still happened.
- **They are two separate rows rather than one row with two settings**, because the gate keys its
  record on the row name. One row would have let a windowed pass overwrite the absolute count,
  which is the record disappearing through the change meant to protect it.
- **Twenty is a judgement and is written down as one.** Long enough that you cannot slip and
  publish a minute later, short enough to reach inside one sitting.
- **A pass after a slip says so.** It reports what the session did earlier rather than printing the
  same line a spotless session gets, because those two are not the same and the one line most
  people read should not pretend otherwise.

### The measure that watches the front door was failing honest work

**What this gives you.** The check that reports whether work reached a commit without its ticket
being started had been refusing since a week earlier, and both reasons were faults in the check.

- **Raising a ticket counted as work.** The check already sets aside a commit that touches only the
  board, because raising, parking and annotating tickets is administration. But raising a ticket
  also writes the handover document the next session reads, and that one extra file flipped the
  same act back into work. The set-aside now covers the board and the project's own record, and the
  record is derived from what your entry document actually imports rather than from a list of names.
- **It is not a hiding place.** A commit is only set aside when its entire footprint is the board
  and the record, so bundling a source change into a handover edit still counts.
- **A commit was judged once per ticket it named.** A commit that closed one ticket and parked
  another was refused for the parked one, so naming both tickets failed where naming one would have
  passed, for identical work. The check was rewarding a thinner commit message. It now asks whether
  any ticket the commit names went through the door, and names all of them when none did.
- **Found by bisecting rather than guessing**, and the ticket's own first hypothesis about the cause
  was wrong. Worth saying because the session that broke it published its tree as green with this
  check inside the suite it was quoting.

### The fix for a lockout was a lockout, and the review round that caught it

**What this gives you.** Everything in the three entries below was reviewed before it shipped, and
the review failed it. This entry is what changed as a result, because a changelog that only records
what worked is a sales document.

- **The check that stops a review certifying the wrong code could not be cleared.** It refuses when
  a commit lands after your reviewers started, and it prints one remedy: start them again. The
  window opened at the *first* reviewer of the session, and a session log only ever grows, so
  starting them again added a later entry and could not move it. Anyone who reviewed, fixed
  something and reviewed again was refused for the rest of that session with nothing they could do.
  The window now opens at the earlier of your two most recent reviewers, one of each kind, so the
  remedy works. Earlier rather than later is the whole point: taking the later of the two would let
  re-running one reviewer clear a window the other has not looked at, so both have to be started
  again before the window moves. There is now a test that performs the remedy and checks it clears,
  and another checking that re-running only one kind does NOT clear it, which is what was missing:
  the old test checked that the sentence was printed.
- **The same check passed when it had not looked at all.** A timestamp it could not read went
  straight to the tool that lists commits, which accepts anything it cannot parse and quietly reads
  it as the current moment, producing an empty result and a clean pass. It now says it cannot tell.
- **The leak check reported clean on text the publish refuses, two different ways.** It dropped
  rules written in grammars it did not expect, without a word, so the scan reported clean because
  it had stopped looking; it now counts the rules it found against the rules it read and refuses to
  report on a partial scan. And it was matching case exactly where the publish ignores case, which
  was wrong for nine of twenty-one rules including keys, tokens and file paths, always in the
  direction that lets something through.
- **Twenty-five new checks were being run by nothing.** The list of test files is kept by hand and
  the new one was not added to it. That is this project's own oldest finding, in the sitting that
  cites it.

One report was itself wrong and is recorded as wrong: one of the three grammars said to be dropped
is read correctly, and the test now asserts what the tool does rather than what the report said.

### Assessments and building are different jobs, so they no longer have to use the same model

**What this gives you.**
- **The front door now names its own model.** An assessment is six disciplines taking positions
  and writing a verdict. Building is code, tools and tests. There was never a reason those two
  wanted the same model, and until now there was no obvious way to say so.
- **The setting sits on the dispatch, not on the roles.** Those six leads get sent for plenty of
  work that is not an assessment, in every project that runs the roster. Naming the model in the
  role file would have changed all of it. Naming it where the assessment starts scopes the choice
  to the room it was decided for, and it is one place to undo.
- **The thing that had to be established first was whether this could be scoped at all**, and it
  turned out to be already wired. Every role carries a model field, set to inherit, and it survives
  composition into the installed roster. So this was never going to require anybody remembering to
  flip a setting at each boundary, which is the version of the idea that would have been skipped
  within a fortnight.
- **A renamed model does not take the front door with it.** If the name is refused, the leads are
  dispatched without it and the verdict says so. A gate that dies because a vendor renamed
  something is worse than a gate running on the wrong model.

Not claimed: nobody has yet assessed the same idea on both models and compared them. This puts the
lever where it belongs and sets it. Whether it is the better choice is unmeasured.

### A private client's name could sit in your changelog for a whole day before anything said so

**What this gives you.**
- **The check now runs when the entry is written, not when you publish.** The leak scan that keeps
  private project names out of a public repository lives in the full test suite and in the publish
  step. A changelog entry is written at the wind-down, by the session most likely to be quoting
  another project by name, because that is the session summarising what it just learnt elsewhere.
  So the gap between writing a private name and hearing about it was a whole sitting, and it has
  now closed on a real name three times.
- **It reads one file, and says so out loud.** The authoritative scan reads the entire publish
  manifest and has not moved. Widening a slow, broadly scoped check into a set that strangers run
  is how a lockout ships, which this project did last week and spent a sitting undoing. This is
  the cheap early warning for the one file whose writing schedule guarantees the problem.
- **It does not print what it finds.** The matched text is the private name, so printing it to
  prove the tool worked would copy that name into a terminal, a transcript and a log. You get the
  line number and the kind of rule that matched, which is enough to open the file.
- **On a copy of this repository it says it cannot tell, and never blocks.** The rules are a list
  of exactly the names to look for, so the list is itself the leak: it lives in the private half of
  the publisher, which is not published. A reader therefore has no rules, and a scan with nothing
  to look for passes everything. It reports that it cannot tell instead, and the same answer covers
  a missing changelog and a rule that will not compile.

Measured: 25 assertions, 0 failed. Two defects in it were found by running it against the real rule
list rather than by reading the code: one PowerShell spelling of case sensitivity would not compile
at all, and the string parser stopped at the first half of a doubled quote, silently reading 20
rules where the file holds 21. Both now have their own fixture. A third was in a test rather than
the tool: the usage fixture supplied a valid argument in front of the empty one it meant to test.

### The brief checker enforced half of a rule it published in full

**What this gives you.**
- **The banned character had three definitions and one of them was wrong.** The check that reads
  every reply counts two code points, U+2014 and U+2015 horizontal bar, because the two are
  indistinguishable at every size a reader sees. The check that reads the founder brief borrowed
  that tool's prose limit and its preamble test, then tested the character by hand against one of
  the two. So the rule the changelog published was enforced on replies and half enforced on the
  one piece of text nobody can edit afterwards.
- **What that cost, concretely.** A brief carrying a horizontal bar passed the wind-down, was
  printed verbatim by the session-start hook as the first thing the session said, and then refused
  the release from inside the first reply of the session, where there is no override and no way to
  take it back. That is the exact failure the brief checker was built to prevent, arriving one
  character over.
- **It is now the same definition, not a matching one.** The hand-written test is gone and the
  borrowed predicate answers all three questions it can refuse on. The refusal also says why it
  cannot be fixed later, because a reader who does not know that will try.
- **The test that certified the rule could not fail on half of it.** The fixture used one code
  point while the assertion was named for the rule, so no change to the other branch could ever
  redden it. Both characters now have their own fixture.

Measured: 107 assertions, 0 failed, up from 104. Three mutations against the same tree: putting
back the code that shipped 2, deleting the refusal 5, dropping the sentence that explains the
timing 1. One of the two new assertions was itself falsified on the first run, returning 1 where
it should have returned 2, because it matched wording the passing branch also prints. It was
restated rather than removed.

### Your reviewers can approve one version of the code while another one ships

**What this gives you.**
- **A review is now evidence about a particular tree, and it was not before.** The gate that asks
  whether anybody reviewed the change proved only that review agents were STARTED. It said nothing
  about when, so a reviewer could read one version of the work and the release could publish
  another, with every check green and no surface anywhere reporting it.
- **This is not hypothetical and it was not caught by an instrument.** Two review agents were
  dispatched at 07:52 against one commit. A SECOND coding session, working on a different project
  on the same machine, committed into this repository at 07:59:23 while both were still reading.
  Four files moved. Two were the source and the tests of an instrument the release itself depends
  on, and one was the changelog, which the publish reads to build the releases page. The release
  was one command away. It was found by a person reading the git log by hand.
- **The rule now is that the reviewers must have been dispatched after the last commit.** If any
  commit lands after the first reviewer starts, the gate refuses and prints the commit: its hash,
  its time and its subject. The remedy is one line and the refusal states it, which is dispatch
  them again.
- **It does not ask whose commit it was, and that is deliberate.** Committing your own work after
  dispatching your reviewers leaves the release exactly as unproved as somebody else doing it, so
  the refusal says in as many words that it is not an accusation. A reader who takes it for one
  goes looking for a person who does not exist.
- **Two designs were tried and abandoned, and the reasons are worth more than the fix.** Forgiving
  the session's own commits by reading the session identifier off each commit cannot be built: the
  identifier written into a commit and the one a session can read about itself are different kinds
  of identifier, with no mapping between them on the machine. Counting how often a foreign
  identifier appears cannot be built either. One identifier was found spanning 80 commits across
  four days, so it does not mark a sitting, and 76 of 377 commits carry none at all.
- **Not being able to tell is a third answer, not a pass.** Outside a git repository, or where a
  dispatch carries no timestamp, it says it cannot tell and stands down as advisory. A reader
  running the method without git is never locked out, and is never told the tree held still when
  nobody looked.

Measured: 116 assertions, 0 failed. Six mutations, each the exact edit named, against the same
copy: removing the refusal 5, making the window always empty 5, treating an absent repository as a
pass 2, treating an absent timestamp as a pass 2, dropping the line that states the tree did not
move 1, and no longer naming the offending commit 1.

### The check that reads your replies never once looked for the character we ban

**What this gives you.**
- **The em-dash ban now has an instrument.** The ban is permanent, retroactive, and named in the
  governance core as applying to every string a reader sees. The check that reads every reply a
  session wrote to the founder measured prose blocks and preamble, and did not count the banned
  character at all. The rule was being enforced by whoever happened to be looking.
- **The measurement that forced it.** A method reviewer caught one em-dash by hand and reported
  one. The instrument, the moment it could count, found FOUR across two replies in the same
  session, three of them inside the very reply that was reporting a content gate's em-dash
  findings. A rule enforced by hand is enforced at whatever rate the hand is having a good day,
  and here the hand belonged to the reviewer whose whole job was catching it.
- **Quoting a tool still works.** Fenced blocks are excluded, because pasting output that happens
  to contain an em-dash is showing your working, which these rules ask for everywhere else.
  Refusing a session for that teaches people to stop pasting the numbers, which costs more than
  the dashes it saves.
- **No documented way around it.** U+2015 horizontal bar is counted alongside U+2014, because the
  two are indistinguishable at every size a reader sees. The en-dash is not counted, so page
  ranges and score lines are safe.
- **Eight new controls, and the count is asserted.** Each edge is pinned by its own fixture,
  including both sides of the fence rule, and the suite refuses if the total moves. 66 assertions
  to 74, 0 failed.

- **The fence exclusion is now reported rather than silently dropped.** The same method gate that
  approved excluding fenced blocks also named it as a real hole: quoted tool output is evidence,
  but a fenced paragraph still reaches the founder carrying the banned character. In-fence
  em-dashes are counted and printed as a second number marked REPORTED, NOT REFUSED ON, which is
  the pattern this tool already uses for prose share. It becomes a refusal when the person
  watching the number decides it should. 74 assertions to 76.

Found by another project's round-four method gate.

### Your mobile gate could report a clean pass on a page that is unreadable

**What this gives you.**
- **The width check was structurally blind to text running out of its own box.** Overflowing text
  does not enlarge the box, so the document scroll width and every bounding rectangle read exactly
  the same whether a title fits or overflows by nine thousand pixels. Measured on the tree that
  found it: document scrollWidth 375 in both cases, element bounding right 353 in both, and only
  the element's own scrollWidth against its clientWidth moved, 331 against 331 staying silent
  versus 9534 against 331 firing. A page could be unreadable past thirty characters and pass.
- **The gate now asserts `scrollWidth <= clientWidth + 1` on every visible text-bearing element**,
  and reports the node, the overflow in pixels and the offending string.
- **It also feeds absurd fixtures on purpose.** A 1000-character title, a long URL, a string with
  no spaces at all. Realistic test data is precisely what hides this class of defect.
- **A second blindness, in the shell rather than in the text.** An app shell setting `overflow-x:
  hidden` at a mobile breakpoint clamps the reading to the viewport width whatever the content
  does. Lifting that axis alone changes nothing, because `overflow-x: visible` beside `overflow-y:
  auto` computes straight back to `auto`. Both axes must be lifted together, and every reading now
  states whether it was taken lifted or unlifted, because the two are not comparable.
- **And the sticky bar that pins on desktop but never on mobile.** The obvious explanation, that
  the element has no slack to travel through, is usually wrong and is worth disproving before it
  is written down: if the same rule pins at desktop width it is not about slack. The common real
  cause is `html, body` taking `overflow-y: auto` at the breakpoint, which makes body the scroll
  container and therefore makes the sticky view rectangle the whole document. Where it was found,
  lifting overflow and nothing else moved the control 866 pixels with the slack untouched.

Found by another project's round-four mobile gate, which proposed the fix by running it rather
than by suggesting it. All three are the same root cause wearing different symptoms, so a project
that has one very likely has the others.

### A check we moved to help you would have refused your project at every session start

**What this gives you.**
- **You can keep your own changelog without our tooling turning red.** The releases-page check
  holds a generated page to the changelog it came from. It was moved into the set that runs at
  every session start, and the export ships our changelog, our page and the tool together, so the
  moment you followed our own rule and wrote your first changelog entry the check called it drift
  and refused. Every session, with one documented remedy: regenerate the page, which writes our
  marketing domain into your repository.
- **The check now asks whose page it is holding.** If the tree does not publish that page it says
  so and stands down as advisory. Your changelog is yours and the page arrived with the export.
- **It has not been blunted where it does apply.** In a tree that does publish the page, a page
  that disagrees with its changelog is still a refusal. That direction is asserted on its own, so
  a scope that quietly stopped the check working would fail the suite rather than pass quietly.
- **The check that finds unproved code had itself not run for six commits.** It lives in the
  release set only, and no release had happened, so a guard added last week sat unproved and
  nothing said so. That guard is now proved, along with the line that tells you which session
  file was read when a review is reported missing. Lines proved by mutation in that tool went
  from 95 to 97, and the four remaining exempt lines are explanatory prose in one message,
  each carrying a written reason rather than an exemption nobody has to justify.
- **Preamble is now caught behind the bullet character we actually write.** The rule that refuses
  an opening line of throat-clearing stripped the asterisk, underscore and hash markers before
  reading the line, and not the hyphen. So the same sentence was refused as a bullet written one
  way and waved through written the other, and the immune form was the common one. Both the reply
  rule and the founder brief rule read that one predicate, so both were holed and both are fixed.

**Why.** Two faults with one shape: a rule written where its author lives, then shipped to people
whose folders look different. The page check had never once been wrong in the repository that
wrote it, because that repository always has a page it generated itself. The preamble check had a
fixture for every marker except the one this project's own writing rule produces, so the suite
certified a branch no real document could take. Both were found by review rather than by any
instrument, and neither would have been visible from inside this tree.

**What was deliberately not done.** No second copy of the shape rule was made. The founder brief
borrows the reply checker's predicate, so widening the strip set fixed both at once, and the
measurement was taken before widening rather than after: across 49 transcripts and 3,822 replies,
one opened with a hyphen bullet and none would be newly refused. The scope on the page check asks
one question about the tree rather than trying to tell two identical files apart, because a
reader's drift and ours are the same bytes in the same relation and nothing inside either file
can separate them.

### Two of our own checks disagreed about the same text, and it blocked every release for three sittings

**What this gives you.**
- **The brief you read at the start of every session is now written in point form.** Same eleven
  lines, 171 words of paragraph down to 151 words of bullets, and none of them in a prose block.
  Two clauses were dropped in the rewrite rather than reshaped, which is worth saying plainly in an
  entry whose whole argument is that the rule is met by writing better and not by cutting: the rule
  does not require it, and the next brief should carry its full content.
- **A brief may not open with throat-clearing either.** The same instrument refuses a reply whose
  first line is preamble, and the first version of this only read the paragraph rule, which left
  the identical fault reachable through the other field.
- **Publishing is unblocked.** The check that reads what a session actually sent you sits in the
  release set and has no override, so while the two disagreed nothing could go out at all.
- **The rule is enforced where it can still be fixed.** The brief is now held to its shape at the
  wind-down, against the document, before it is ever handed over. The other check reads a
  transcript, so it can only tell you after the message has been sent, and a sent message cannot
  be unsent.

**Why.** One instrument capped the brief in LINES. The other capped an unbroken run of prose in
WORDS. Both were right inside their own unit and neither could see the other, so an eleven-line
brief was simultaneously within its cap and a hundred and seventy-one words past a limit of eighty.
The session-start hook orders that brief printed word for word, so the breach arrived in the first
reply of every session, was nobody's writing, and could not be edited away afterwards.

**What was deliberately not done.** A second number was not chosen here. Picking one would have
reproduced the fault one level down: a third unit, agreeing with the other two only for as long as
somebody remembered to keep it agreeing. The predicate and the limit are imported from the
instrument that does the refusing, so there is one definition and the two cannot drift.

The rule is a shape and not a length. The same content that fails as a paragraph passes as bullets,
and there is a test that asserts exactly that, because otherwise this is a word cap wearing a
different name and it would be met by hiding detail rather than by writing better.

### The published releases page could go stale at the commit that made it stale

**What this gives you.** The check comparing the published releases page against the changelog it
is generated from now runs at session start as well as at release. If the page is behind, you are
told in the first three seconds of the next session rather than the next time somebody publishes.
A tree with no page, or a changelog with nothing dated in it yet, now reports advisory instead of
red: that is somebody running the method without publishing a website, which is an absence rather
than a disagreement, and every neighbouring check already draws the same distinction.

**Why.** It ran in the release set only. Every wind-down writes a release note into the changelog
and does not rebuild the page, so the page broke at the exact commit that broke it and the only
thing watching did not run again until a publish. That is not theoretical: the page was found
drifted at HEAD, confirmed by running the suite against a clean archive of HEAD rather than
assumed, and the same failure took an entire test run down with it. The check compares two files
already on disk, wants no network and no git, and costs about fifty milliseconds.

### One initiative at a time, and the board now knows which work belongs to it

**What this gives you.**
- **One large item in progress instead of two, and the small work in flight has to belong to it.**
  Start a small that belongs to nothing while an initiative is running and the board refuses,
  names the initiative, and prints the command that attaches it. The old limit was two large and
  three small, which was the right shape for work that has nothing to do with itself.
- **A ticket can be put UNDER another.** `add --under <ref>` when you raise it, or
  `under <ref> --under <ref>` for anything already on the board. Nothing needs migrating: a ticket
  with no initiative is simply a ticket whose field is absent, and every existing ticket stays as
  it is.
- **An initiative cannot be marked done while its work is still open.** It names the tickets that
  are, rather than counting them. Parking or killing it is still allowed, because deciding the
  rest is not being done is a real ending and refusing every ending leaves work nobody can abandon.
- **Dropping an initiative is one command.** `evict` moves it and everything under it out
  together, with one reason recorded on every ticket. It either happens or it does not: a journal
  is written before the first ticket moves, and if a write fails part way the tickets that moved
  are put back. If the board is ever left part way through, every command that WRITES refuses and
  says how to undo it, while every command that READS still works, because a half-finished board
  is exactly the thing you need to be able to look at.
- **`wip` and the rendered board show the relation**, so you can see which initiative each piece
  of work serves without opening it, and an initiative whose work is all closed says so.

**Why.** The limit on work in progress was a COUNT, and a count cannot tell a small that FINISHES
an initiative from one that STARTS a fourth. Measured before any of this was built: 71 of 74
starts finished without being sent back, the median time in progress was under two hours, and the
limit had been reached once in the board's life. So starting was never the problem. The board
still reached ninety waiting items, and 73 of those named the work they belonged to in prose that
nothing could read. Tightening the number would have changed none of that; making the relationship
real is what lets the board refuse the thing that actually goes wrong.

**A rule about how work is picked has changed with it.** An instruction that arrives mid-session
now jumps the queue only if it belongs to the initiative already running, or is a defect we
introduced. Anything else becomes a ticket and you are told that is where it went, with a count of
what is already running. It is not refused and it is not silently absorbed, because both of those
end with work nobody chose. Reprioritising is still yours to do at any moment, and it now means
evicting the initiative rather than starting a second one beside it. The older rule put every
mid-session idea straight to the top, which is how the waiting list grew from arrivals rather than
from starts: 2.45 things arriving for every one closed, over fourteen active days.

**Two things worth knowing about the checks.** Moving that limit turned nineteen published claims
red at once across nine files, seven of which are handed to every project rather than being pages
on the site, and all nineteen were rewritten in the same change. And the release gate that asks
whether anyone reviewed the work had to be split first: the same role now both reviews the method
and reports breaches, so being started is no longer enough on its own, and the dispatch has to say
which of the two it is. A forgotten marker refuses a release rather than clearing one, which is
the direction that fails safely.

### Two published numbers now have an owner, and the session guard measures cost rather than counting calls

**What this gives you.**
- **A number published on a page is now held to the thing it counts.** The reference page said it
  carried eighteen defined terms and carried nineteen. It also published the limit on how much
  work may be in progress as a sentence, with nothing anywhere comparing that sentence to the
  constant the board actually refuses on. Both are checked on every session start and before every
  release, in both directions: a page stating the wrong number fails, and so does a page that has
  quietly lost the claim altogether.
- **The eighteen is corrected to nineteen.** That was live on the site.
- **The limit turned out to be published in nine places, not two.** Two are on the website. The
  other seven are files handed to every project: two role definitions, the board specification, the
  shared session rules, two skills and the testbed notes. Changing that limit changes the
  instruction given to agents in five projects at once, and until now nothing would have said so.
- **The session guard stops a session on what it has SPENT rather than on how many times it has
  done something.** It used to interrupt at the fortieth tool call regardless of cost. Measured
  across three sessions, the cost per call ranged from 38,200 to 69,600 tokens, so a session
  costing little was stopped exactly as hard as one costing nearly twice as much. The threshold is
  now the spend itself, derived from the same measurement the guard was originally built on, with a
  backstop on call count for the case where the spend cannot be read at all. The interruption now
  says which of the two fired, so a long cheap session is not mistaken for an expensive one.

**Why it was wrong before.** A number written once in prose, on a page nobody edits again, goes
false on the day somebody changes the thing it counts, and the first person to notice is a reader.
That had already happened twice on this site. The guard had a subtler version of the same fault: its
own explanation argued entirely about cost, it computed the cost on every call, and then it decided
when to stop by counting calls and printed the cost as decoration.

**One thing found while doing it.** The releases page had drifted from the changelog it is generated
from: the previous release note was written and the page never rebuilt, so the newest entry was
missing from the published page. It is rebuilt here.

### The start-of-session brief is off the warning channel, so it is no longer red at all

**What this gives you.**
- **The brief that greets you when a session opens now arrives as ordinary text.** No warning
  colour, no prefix stamped on every line, and no disclaimer at the top explaining that it is not
  an error. On a session where nothing is wrong, the start-of-session step now prints nothing red
  whatsoever, where it used to print thirteen warning-coloured lines.
- **The previous attempt at this fixed the wrong thing, and the founder said so.** They had
  complained about the colour. The change made in response altered the words instead, adding two
  lines to the top of the brief saying it was not an error. That spends two lines of a twelve-line
  brief apologising for a colour, at every session start, forever. Their words: "i was only
  complaning why it appears in red almost as an error".
- **It was built on a claim that turned out to be false, and the counterexample was in the same
  file.** The reasoning recorded at the time said the warning-coloured channel is the only one a
  start-of-session step has, so the text was the only thing that could be changed. Half of that is
  true and does not matter: the colour genuinely is not configurable, checked rather than assumed.
  The other half was wrong. There is a second channel, it is neutral, and another part of the same
  file had been using it since it was written. The reasoning walked past our own code.
- **Findings stay red, because red is right for them.** A finding is a warning about the project
  you are opening and belongs in warning colour. Only the standing brief moved. The two are now
  guarded by a test that fails if either ends up on the other's channel, which is a different
  property from each simply being present.
- **The cost of the trade, stated because it is real.** The warning channel always prints. The
  neutral one hands the brief to the session, which then prints it, so delivery now depends on the
  session doing its job. That was put to the founder with the trade named and they took it, on the
  argument that a brief being read as a failure is a brief that is already not landing. A test
  checks that the instruction to print it verbatim is still attached, because shipping the brief
  without it would stop the founder seeing it at all, silently, which is worse than red.
- **One defect was created by this change and caught by running it rather than by reading it.** The
  rebuild step contributes an entry even when it has nothing to say, so the warning channel was
  emitting an empty string rather than being absent. An empty warning-coloured line is still a
  warning-coloured line, which is the entire complaint. It could not have shown up before, because
  the brief used to live on that channel and was never empty.
- **The reading budget did not quietly get bigger.** The cap on how much arrives at a session start
  was ruled on how much a founder reads, and they read both channels, so the cap still spans both
  rather than being reset to the smaller half. Dropping the brief out of that sum would have turned
  a real limit into a check that cannot fail.
- **The two tests that guarded the old behaviour were restated, not deleted.** Both required the
  brief to lead with the words that are now gone. What has to be true changed from what the brief
  says to which channel it arrives on, so that is what they check now. Proved by putting the brief
  back on the warning channel in a full copy of the repository: seven tests go red, and the same
  run with the change in place has all seven green.

---

## 2026-09-10

### The message that greets you at the start of a session looked like something had gone wrong

**What this gives you.**
- **The studio hands you a short brief when a session opens, and it was being read as a stack of
  errors.** It is not one, and it never was: the thing that produces it finishes cleanly, writes
  nothing to the error channel, and hands over a valid message every time. That was measured by
  running it, twice, on two different days. The problem is that the only channel a start-of-session
  message has is painted in warning colour by the terminal, with a prefix stamped on every line,
  and none of that is ours to change. So thirteen lines of ordinary text arrive looking like
  thirteen lines of failure.
- **The founder reported it as an error two sittings running, and the second report is the reason
  this is a change rather than an answer.** The first time it was explained. Explaining it again
  would have meant explaining it every sitting until the brief stopped being read, which is
  exactly the fate this studio has already recorded for another line it prints: nine projects
  learned to ignore that one. A question asked twice is a defect in the thing being asked about.
- **The fix is one line and it leads rather than merely appears.** The brief now opens by saying
  what it is not, before anything else. A correction printed underneath the thing it corrects is
  not a correction, so two separate tests guard it: one that the label begins with those words,
  and one that no line of the brief is read before the label. The second exists because the first
  was published as if it checked both, and it does not: move the brief above the label and the
  first test stays green, which is exactly the arrangement the fix exists to prevent.
- **It cost nothing you were already paying for.** No line was spent to buy the label: one line of
  the message was replaced by one line, and the caps that keep this brief short and narrow are
  untouched.

### The check that measures what a session costs could only see one level, and neither could the health report

**What this gives you.**
- **The budget check was blind to anything a nested document pulled in.** Every project loads a
  set of documents before a session starts, and every character in them is re-sent on every
  single request for the life of that session. There is a check that measures this and refuses
  when it is too much. It read the top document's own imports and stopped there. So a project
  whose top document loads another one that loads five more was charged for all of it and
  measured for none of it, and the check reported a clean bill on a project that was already
  eleven per cent past the limit it exists to enforce. It now follows imports all the way down.
- **It was found by another project's session reading our tool, not by us.** That is worth
  saying plainly, because it is the second time this week that the useful finding came from
  somebody else's numbers rather than from our own review.
- **The same blindness was in the health report, and that is the command you are told to run.**
  The number `-Doctor` prints is worked out by a completely separate piece of code that had the
  identical defect. Fixing only the check would have left the two disagreeing, with nothing
  anywhere that would notice, so both were fixed together and there is now a test that runs both
  and refuses if they give different answers. That test earned itself immediately: the repair to
  the health report went in with a mangled pattern that silently dropped every document whose
  path contained the letter s, and comparing the two answers side by side is the only thing that
  caught it.
- **Two rules decide the number, and both were measured rather than assumed.** An import is
  resolved next to the file that declares it, not at the top of the project, which was confirmed
  against a real project where every second-level document is absent under the other reading.
  And a document reached by two different paths is charged once, not twice, which on that same
  project is the difference between a true number and one inflated by a hundred and twenty
  thousand characters. A loop of documents importing each other now reaches a verdict instead of
  running until it runs out of memory.
- **The health report had never been tested at all.** The suite drives the tool as a program and
  had never reached the function that works this out, which is why a defect in it survived in a
  published script. It has two tests now.

### A tool that could not see a hyphen, and a check that finds documents nothing can read

**What this gives you.**
- **The archiver refused to work for anyone who numbers their decisions with a dash.** It
  reads the decision numbers to work out which end of the table is newest, and the pattern it
  used allowed letters straight against digits and nothing in between. So a table numbered S147
  was read and a table numbered D-001 was not, which meant the tool worked perfectly in the
  project it was written in and refused in the one that needed it, whose decisions table had
  grown past the size where archiving is supposed to happen. Two separate sessions there recorded
  the refusal and moved on.
- **Worse, it told them the wrong reason.** The single message it printed said it could not tell
  which end of the table was newest, and that condition had never been tested. Their table was
  unbroken from the first decision to the hundred and twenty-first, in order, with no gaps. Two
  sessions read that sentence and believed their own records were ambiguous. There are now three
  separate refusals, each naming what actually happened, and when it succeeds it says which
  signal told it the order. It also reads every row rather than only the first and last, so one
  unreadable line no longer refuses a table the rest of the rows settle beyond doubt.
- **A new check finds documents that look organised to a person and are unreadable to every
  tool.** Everything here locates things by shape: a heading to find a section, a table header to
  find the decisions. A document can be perfectly clear to a reader and have none of that, and
  when that happens the tools do not fail loudly, they find nothing and say nothing, and the
  project carries on believing it is covered. One document was fifty-seven thousand characters
  with not a single heading. Three separate instruments had been silently doing nothing there for
  months. The check refuses four things, each one something a tool actually needs rather than a
  matter of taste, and it looks across every project rather than only the one it lives in.
- **That new check was scoped before it shipped, because the first version would have refused on
  your files.** It reads the folder holding the studio, which here is a folder of studio projects
  and on your machine is wherever you happened to clone it. Measured before release: put any
  unrelated project beside it and the check reported that project's notes as broken, in the set
  that runs at the start of every session, on a document we did not write and you have no reason
  to change. It now only looks at projects that actually load the studio's own governance
  documents, and a fresh install with none beside it says there is nothing here to check and
  passes, rather than showing you a red line you cannot clear.
- **A rule about getting text safely through the shell now reaches every project, instead of one.**
  Long commands typed straight into a shell break on an unclosed quote, and one project here lost
  sixty two tool calls to it over four weeks: fifty four unterminated single quotes, six double,
  two backticks. Backticks are the worst of the three because they do not announce themselves, the
  shell runs whatever sits between them and drops the output into your text, which silently deleted
  three references from a paragraph here and reported success. The fix was already written down and
  it was written down in one project's private notes, where no other project could ever read it. It
  is now a shared rule carried by all seventeen roles and by the governance document every project
  loads on every request, from a single file, so the two cannot drift apart.

- **It immediately found an invisible character in the file every session reads first.** Three
  projects were loading a main instruction file that began with a mark you cannot see in any
  diff or review tool. That exact character stopped thirteen of sixteen team-role files loading
  a month ago; it was fixed for those and nobody thought to re-check the instruction documents.
  All of them are clean now.

---

## 2026-09-08

### Two checks that were quietly wrong about a missing file, and one of them was wrong for every reader

**What this gives you.**
- **A check that is supposed to notice deleted files stopped noticing whole deleted folders.**
  The tool that keeps the written descriptions of the team honest refuses when a document it has
  a record for is no longer there, because a record with nothing behind it is a claim nobody can
  check. It had to be taught that a published copy legitimately does not carry every folder this
  source tree does. The version released this morning learned that lesson too well: it forgave
  any missing folder anywhere, so deleting an entire directory of shared rules made it report
  success and, in the mode both automatic runs use, print nothing at all. Deleting a single file
  out of that same directory still failed correctly, which is what made it hard to see. It now
  decides by which layout it is looking at rather than by what happens to be missing: in the
  source tree nothing is forgiven and an absent record is a deletion, and only an installed copy
  can have had a folder taken away from it.
- **The comment ratchet passed here and failed for everybody who installed it, and now it does
  not.** The instrument that stops comments quietly bloating held its record against paths from
  this source tree, and publishing flattens those paths. So on every installed copy eleven
  published files looked like files the record had never seen, were held to the strict limit that
  exists for genuinely new files, and refused, in both the automatic run at session start and the
  one that gates a release. There was nothing the reader could do about it, because the obvious
  remedy rewrites a file they received rather than wrote. One record now serves both layouts, and
  the proof is that the two now report the same numbers: forty-eight files, four hundred and
  ninety-two control lines, the same ratio, in the source tree and in a rebuilt copy of the
  published export.
- **Both were found by pointing the reviewer at the repair rather than at the thing repaired.**
  The first is a fault introduced by this morning's own fix, an hour old, that a suite of five
  hundred and eighty-three assertions could not see. Both now have assertions, each proved by
  putting the fault back and watching exactly the named assertions fail while the controls beside
  them stay green.

### The review gate now asks two questions instead of one, and the page and the tool finally name the same roles

**What this gives you.**
- **The page that sells the method said five checks and the tool that detects them counted a
  different five.** Both listed five, and they were not the same five: the page drew the studio
  director as a gate and the tool did not count it, and the tool counted the QA tester which the
  page did not draw. So a session that started exactly the reviewers the published page advertises
  could be told that nobody had reviewed anything, and the release would refuse. Both surfaces now
  name the same six, and a check compares them in both directions on every test run, along with
  the number written in prose beside them, so neither can drift from the other again and the count
  cannot go stale a third time.
- **A reviewer is now two kinds, and a release needs one of each.** Five of them read the WORK:
  the QA tester, the code, security and content reviewers, and the mobile check. The studio
  director reads the METHOD instead, meaning whether the process was actually followed and whether
  the replies you were sent are the shape this studio publishes. It never reads the change, so it
  can never stand in for the five, and holding them in one list would have meant a session that
  started only the director cleared a gate whose entire question is whether anybody read the work.
- **Being long-winded with you can now stop a release.** The instrument that measures reply shape
  existed and only ran at the end of a session, where it could report and never refuse. It runs in
  the release set now, so a session that buried the answer in a wall of prose cannot ship until it
  is fixed. It measures shape rather than length on purpose: a long list of bullets passes and one
  dense paragraph does not, because a length cap becomes a target met by hiding detail.
- **A check that every installed copy failed and nobody could clear now passes.** The roster
  check compared its record of exceptions against paths from the private source tree, and the
  published copy lays those files out differently and leaves some of them out entirely. So every
  reader who installed it got a permanent red mark with nothing they could do about it, while it
  passed here on every run. One record now serves both layouts, and an exception for a file the
  published copy does not carry is named rather than treated as a broken record.
- **An unfinished code block no longer hides the rest of a reply.** The reply measurement treated
  a code fence as opening a block and never reconciled it at the end of the text, so a reply whose
  last fence was never closed scored nothing from that point on, and the densest paragraph in it
  was invisible.
- **The release command can now tell a branch with no commits from a detached one.** It asked git
  a question that answers the same way for both, so on a branch with nothing committed it reported
  the wrong reason. Neither state is reachable on the ordinary path, and it now says which.
- **The coverage tool can be pointed at any tool, and at itself.** It compared whatever you named
  against one particular tool's tests, which were hardcoded. So asking it about anything else gave
  a confident answer to a question you had not asked. It now works out which tests belong to the
  tool you named.
- **Smaller repairs.** Loading the hook check from another program used to run it and then kill
  that program. The session guard left one small file behind in the temporary directory for every
  session ever run, and wrote Windows line endings on any machine. The coverage tool silently
  dropped any line of code that shared a line with the end of a comment, so its count of code
  lines was quietly short. And the published note about where the reply measurement gets its
  evidence claimed the whole derivation was shared with another tool when only part of it is.

---

## 2026-09-07

**What this gives you.**
- **Releasing can no longer leave your private copy behind the public one.** The release command
  publishes to the public repository and, before that, saves and uploads your own private copy.
  The upload was written inside the branch that only runs when there is something new to save, so
  a session that had already saved its work as it went was told there was nothing to do, and the
  upload was skipped. The public repository then received work that the private one had never
  sent anywhere, and the command reported success. Measured on a real release: four saved changes
  sat on this machine only, at the moment strangers could read the same work publicly. The upload
  now runs whichever way the work got there, and it is checked by asking the server what it holds
  rather than by trusting that the upload said it worked. If the private copy cannot be uploaded,
  nothing is published at all, because the public copy is the one a stranger clones and it must
  never be the only copy that exists.
- **The shared rules now arrive as a short document instead of a long one, and every project actually loads them.** The one file every project carried was about 12,200 tokens re-sent on every single request for the life of a session. Two projects held that file and imported nothing at all, so no rule written in it ever reached them. The rules are now in `GOVERNANCE_CORE.md`, roughly a quarter of the size, and the long document stays beside it as the reasoning behind each rule.
- **The reasons did not go missing, they moved.** Each section of the short document names which part of the long one explains it. That matters because moving a rule out of what a session loads also stops anyone finding out why it exists, and a rule nobody can explain is the first one somebody deletes.
- **Nothing can be quietly dropped in the move, and that is checked rather than promised.** A new check reads both documents and refuses if any section of the long one is neither pointed at by a rule nor declared as background only. It refuses in the other direction too, when a rule points at a section that has been renamed or removed, which is the half a hand-written list never has.
- **It also refuses when a project has the file and does not read it.** Being delivered a document and loading it are different things, and until now nothing compared the two. That is the defect this whole change came from, and it had been sitting there for weeks.
- **A duplicate was found inside the shared rules themselves.** One section appeared twice, word for word, in the file every project loads on every request. Editing one copy would have left the other saying something else. It has been removed and the check now refuses on repeats.
- **Three sub-projects are reported rather than fixed, on purpose.** They inherit the file from their parent folder and would have to reach upward to import it, and nothing here has ever confirmed that works. The obvious fix is not applied while it is still a guess; it is written down as work with the verification attached.
- **A release can be made at all again, and this is why nothing shipped for five sittings.** The
  record of which checks passed carries a fingerprint of the code they measured, so a green result
  from an hour ago cannot stand in for the code in front of you. That fingerprint included the
  commit. Releasing commits and pushes the work before it publishes, so the act of committing
  invalidated the record the publish then read, and every release refused with every check
  reported as never proved. The fingerprint is now taken from the content of the tree rather than
  the commit the content happens to be sitting on. Committing changes which commit the bytes sit
  on. It does not change the bytes.
- **A check that no reader could ever have cleared is fixed before anyone received it.** One of
  the checks reads the shared governance documents, and those documents deliberately do not
  publish. On any copy installed from the public repository the check was therefore red for good,
  in the set that runs at session start and in the set that guards a release. It now reports that
  there is nothing here to look at, while a governance folder that exists with its documents
  missing is still an error, because that is a defect rather than an absence.
- **Four checks could return a verdict about a file they never opened.** A flag typed with nothing
  after it was swallowing the next flag as its value. In one check that produced a clean bill of
  health, silently, about settings it had not read. In another it produced the exit code that
  means a duplicate decision key was found, with a stack trace where the finding should be. Each
  now refuses and names the flag it wanted a value for.
- **A release is refused when nobody reviewed the work.** Every review here is carried out by a separate agent that a session has to choose to start, and nothing recorded whether one ever did. The honest baseline, measured before the check was written: of the 21 releases this project has made, 4 shipped with no review agent started at any point in the session that shipped them. Two of those four predate the vendor setting that was blamed for it, so this was an old hole rather than a new one. From this release forward, a release is refused when the session shipping it started no reviewer.
- **That check says plainly what it does not prove.** It proves a reviewer was started. It does not prove the reviewer read the change, and it does not prove it came back clean. A session can start a reviewer, be told the work is broken, and ship anyway with this green. Nothing on this machine can see that, and a check claiming otherwise would be worse than none.
- **A test suite's own claim about what it proves is now worked out by the machine instead of written by hand.** A paragraph at the top of one suite listed which parts of the tool were genuinely covered and which were not. Three separate reviews falsified that paragraph, and each correction was wrong again. It is now derived: every line of the tool is removed in turn, the suite is run, and any line nothing depends on is reported. An exemption has to be written down with a reason, and it is refused once the line becomes covered, which is the half a hand-written list never has.
- **A session can no longer end or run out of room with its own state written down and uncommitted.** That is how a session's record of what it measured used to disappear.
- **The standing rules are re-delivered after a session runs out of room and reloads.** For two weeks that repair reported success nine times and delivered nothing.
- **Every hook is held to the event that can actually deliver it.** A hook registered against an event that never fires looks identical to one that works, in both of the two forms this tool writes.
- **Two sessions working on one project can no longer allocate the same decision number in silence.** It happened: two sessions read the same table, each took the next free number, and one project ended up with two decisions numbered 91 and two numbered 92. Neither writer could see the other. Decisions are referenced by number for the life of a project and are never renumbered, so a duplicate is permanent.
- **A check that ignored dated archives by name now ignores them by shape.** The name list could not name a file that did not exist yet, so the act of archiving a document turned a check red at the next session start on work nobody had changed.
- **The rule about writing short now has an instrument, and it fails on our own history.** It measures the shape of a reply rather than its length, deliberately: a limit becomes a target, and a target gets met by hiding detail rather than by writing better. Two hundred lines of bullet points pass; one dense paragraph does not. Run over 3,020 past replies in this project, 120 were past the limit and 48 opened with throat-clearing.

- **The picture of the method was missing one of its own roles, and a count beside it was wrong.** The page that explains how this works lists the team, then draws the flow they work through. One role was in the list and not in the drawing, so a single page disagreed with itself about who is involved. Reading the rest of it turned up worse: a sentence four lines under that list said four checks have to pass, where five roles are listed. Both are corrected.
- **The release preview now says what it will do with your own copy, and warns you when the release will stop.** The command has a preview that shows what a release would do before it does it. It described the save and the publish and said nothing about uploading your private copy, which is the step that can now refuse the whole release. Measured on a real release: the preview said there was nothing to save and that it would publish, while the private copy sat seven changes behind. The preview now names the upload, or says it is not needed, and it says plainly when the release would refuse: no server configured, a server that does not answer, a detached checkout, or a server holding work your copy does not have. In those cases it no longer goes on to say it would publish. It reads the server to find out and never writes to it.

### The picture of the method disagreed with the page it was drawn on

The page that explains the method lists the roles, then draws the flow they work through. One
role was in the list and not in the drawing. It now sits where that role actually acts, between
the quality gates and the release: it records what was proved, so a release can refuse on it.
The row of the diagram was already full, so every box, arrow and label in it was laid out again
rather than one being squeezed in, and the description read aloud to anyone using a screen
reader moved with the picture instead of describing the old one.

Four lines under that same list, a sentence said four checks have to pass, with proof, before
anything goes out. Five are listed. The count went stale when the fifth was added and nothing
moved the number written below it. Nobody had asked about it, and no check anywhere reads a
number written in a sentence, so it had been telling every reader of that page something that
was not true.

### A preview that said nothing about the step that can stop a release

Releasing saves and uploads your private copy first, and if that upload cannot be done, nothing
is published at all. That gate is new, and the preview never mentioned it. It printed that there
was nothing to save and that it would publish, which is a preview of the easy half: the one step
that can stop everything was the step it did not describe. Measured on a real release, the
preview said exactly that while the private copy sat seven changes behind the server.

The preview now names the upload it would make, or says the server already has the work. It
reads the server to find out and never writes to it, so a preview stays a preview.

Saying something is not the same as saying which, and the first version of this fix proved that
the hard way. It printed one calm line for four different situations, and in three of them the
release stops: there is no server configured, the server does not answer, or the server holds
work your copy does not have. Worse, the situation where it stops because no server is
configured printed the same sentence, word for word, as the ordinary case where your branch is
simply new. A preview that reassures you in exactly the situations it exists to warn about is
the original fault with a positive sentence in place of the silence. Each of those situations
now says the release would refuse, says why, and stops rather than going on to tell you it would
publish. The last line you read is the one you act on.

### Publishing could leave your own copy behind the public one

The release command saves and uploads your private copy, then publishes the public one. The
upload was written inside the branch that only runs when there is something new to save. A
session that had already saved its work as it went was therefore told there was nothing to do,
the upload was skipped, and the public repository received work the private one had never sent
anywhere. The command reported success. Measured on a real release: four saved changes sat on
this machine only, at the moment a stranger could read the same work publicly.

The upload now runs whichever way the work got there, and if it cannot be done, nothing is
published at all. That order is deliberate. The public copy is the one a stranger clones, and it
must never be the only copy that exists.

Two things came out of proving it that are worth more than the fix. The first is that asking the
server what it holds is not the same as trusting the upload to say it worked, so the check now
reads the answer back; that is what the public half of the same command already did. The second
is that the first attempt at the fix asked the server about a branch by its short name, and a
server answers a short name with any branch whose name merely ends that way, sorted. A leftover
backup branch could therefore answer for the real one and report everything already uploaded
when nothing was. That is the original fault reappearing inside its own repair, and it was found
by a review that was asked to attack the repair rather than admire it.

### A release could be made with nobody having looked

The rule was that quality gates run before anything ships, carried out by an agent that did not
build the work. Nothing recorded whether one had been started. Four of the twenty-one releases
this project has made went out with no reviewer started at any point in the session that shipped
them, and no surface anywhere said so at the time or afterwards.

That number is published here rather than kept internally, because a number a reader can check is
the whole case this project makes about itself, and because two of the four predate the vendor
setting that had been blamed for the gap. The honest version is stronger than the excuse.

The check is deliberately narrow about what it proves, and it says so in its own first paragraph.
It proves a reviewer was started in the session making the release. It cannot prove the reviewer
read the change or that it returned a pass. It also gives three answers rather than two: a
reviewer ran, no reviewer ran, or the record could not be read at all. Collapsing the last two
would mean an install whose host writes no session record is locked out of releasing for good,
and reading the first two as one would let not being able to look count as having looked.

### A claim about what is tested is the claim most likely to be false

One suite carried a paragraph naming which of its tool's guards were genuinely proved and which
were deliberately left. Three consecutive reviews falsified that paragraph, and the correction
written after each one was falsified by the next. Being more careful was tried and failed, for a
structural reason: the person writing the claim is the person who wrote the code.

So the claim is no longer written. A tool removes each line of the file in turn, asks whether what
is left is still a program, runs the suite, and reports every line the suite does not depend on.
Anything left uncovered has to be written down with a reason, and the reason expires: once a line
becomes covered, the exemption is refused rather than sitting there for months describing a state
that ended. On its first run it found four uncovered lines in a file that had already passed three
reviews, one of them the definition of which roles count as a review at all.

### Writing short, measured rather than asked for

The rule to keep replies short has existed here for weeks and was carried by every role. Fourteen
checks were running at the time and not one of them read a reply. Delivering a rule and enforcing
it are different things, and the gap between them is invisible without an instrument.

The instrument measures the largest unbroken block of prose in a reply, not its length. That
distinction is the whole design: the rule itself forbids a line limit, because a cap becomes a
target and the target gets met by cutting detail rather than by writing better. A long reply in
point form passes. A short one written as a wall of prose does not.

The first version counted consecutive lines of prose and was thrown away within a minute of being
run over real history, because a paragraph is one soft-wrapped line and the longest run anywhere in
three thousand replies was four. A threshold above that would have refused nothing and passed
forever, which is indistinguishable from a check that does not work. The limit that shipped is
derived from the corpus instead, and it fails on the history it came from.

---

## 2026-09-05

**What this gives you.**
- **A release now refuses while anything says the checks were skipped, failed, or were run against different code.** The checks themselves are not new. What was missing was any record that they had run at all, so a release could be made on code nobody had measured and nothing anywhere would say so.
- **The record is written by the tools, not by anyone reporting on them.** Each check writes down the result it actually returned. Nothing in the chain summarises a run, because a summary is a description of evidence and the difference only shows up on the day the summary is wrong.
- **A pass expires when the code changes.** Every result is stamped with a fingerprint of the code it measured. A green result from an hour ago is not evidence about what is in front of you now, and the release says so and stops.
- **A check your copy does not have is reported as missing, not as passing.** The public copy of this project does not carry the full test suite, so on your machine that line reads absent and the summary says so out loud rather than reporting a clean bill of health over a partial install.
- **One check is reported as unproved, honestly.** The health report always exits successfully and prints prose, so its result carries no information about what it found. It is named as unproved every time rather than counted as a pass it never earned.
- **A seventeenth role, the studio director.** It runs the checks and reads the record back. It checks and records; it does not fix, build, or direct the work, and it is given no editing tools.
- **Every published claim about how many roles there are is now held to the roles on disk.** That number was written by hand in page titles, share cards, headings and the tool's own output, and nothing compared any of them to the directory the roles live in. Adding this role broke twenty-eight of those claims at once and the new check named every one.
- **The note about running this on a different coding agent now says what is true.** It said the roles are just markdown files and the only thing that needs changing is where they land. The roles are markdown. The tooling is not, and one role does its job by running it.

### A check nobody recorded is a check nobody ran

The rule in this studio has always been that nothing ships without its checks passing. The
rule was kept by people remembering it. Nothing wrote down that a check had run, which means
nothing could tell the difference between a check that passed and a check that was skipped,
and a release could go out either way.

What is new is a single command that runs the checks and writes down what each one returned,
against a fingerprint of the code it measured, into a file that is committed alongside the
work. The release reads that file back and refuses while it says a check failed, was never
run, or was run against different code.

Two properties matter more than the feature. The first is that the tools write their own
results. Anyone asked to run the checks and report how they went produces a summary, and a
summary is a description of evidence rather than evidence. The second is that a missing check
is never a passing one. A copy of this project that does not carry an instrument has not
passed it, and the summary names what was measured and, just as loudly, what was not.

### The number of roles was written by hand in twenty-eight places

Nothing compared any of them to the roles on disk. Adding the seventeenth role broke all of
them at once, silently, and the first person to notice would have been a reader counting cards
on a page. There is now a check that holds every live claim to the directory the roles live
in, with a recorded reason for each sentence that is deliberately talking about a subset
rather than the whole roster.

It leaves the dated entries on this page alone, deliberately. A release note saying sixteen
roles was true on the day it was published, and editing history to satisfy a check is the one
thing a changelog must never do. After a change like this one, the older notes and the current
pages disagree, both are correct, and this entry is what reconciles them.

**What this gives you.**
- **The comments in the code you install explain the code, and no longer name our internal work.** Forty-five comment lines across the published files named a ticket, a role or a review round. That is provenance you cannot look up and do not need. There are now none, across thirty files, and a release refuses to go out if one comes back.
- **Closing a session now archives the decision table instead of reminding somebody to.** The rule to do it was already written and already specific. The step that had never once happened was a person choosing to run it, so the tool runs it.
- **Every role now carries the instruction to read that archive**, so a decision moved out of the document loaded on every request is still a decision anybody can find.
- **The limit on how much work can be in flight can now be overridden, and it cannot be overridden quietly.** It refuses once, then asks for a reason, refuses a blank reason as hard as no reason, and writes what it was told into a file that is committed alongside the tickets. Three overrides inside fourteen days and it stops accepting them.
- **The health check reads the session hook log**, which nothing had ever read, and reports when each hook last fired, where, and how it ended.
- **Every test suite states how many assertions it expects.** Before this, a suite that lost half its checks reported a smaller number and stayed green.

### A comment should be useful to a stranger holding only the code

A comment naming a ticket number sends the reader somewhere they cannot go. Ours did that forty-five times in the files that ship to you, because the person writing the comment had the ticket open and it felt like context.

Every one of those lines was rewritten rather than deleted, and the reason the code is the way it is survived the rewrite. That distinction is the whole change. A rule that simply capped comments would have been met most cheaply by deleting the longest ones, and the longest ones here are the paragraphs that sit beside a check and explain what breaks if you remove it.

Fifteen references remain, deliberately, inside those explanatory paragraphs, because a paragraph recording that a specific check was added after a specific failure is evidence rather than decoration.

A tool now counts the offending shape per file and holds each file to a recorded figure, exactly, in both directions. A file that gets worse is refused. A file that gets better is also refused until the improvement is recorded, so a number that has been loosened by hand cannot hide as slack.

### The archiving rule now executes

A project's state document is re-read by the assistant on every single request. An append-only decision table inside it therefore charges you for the entire history of the project on every call, for as long as the session runs.

The rule to move older decisions into a separate file that is not loaded had been written down for some time. It did not run, in five projects, because running it depended on a person remembering at the end of a long session.

The wind-down does it now. On this project's own document the first real run took ninety-six decisions, kept the twenty most recent in the loaded document, and moved seventy-six into an archive beside it. The document fell from 140,779 characters to 108,758. Nothing was lost, nothing was altered, and the order was preserved on both sides, which was checked by rebuilding the original from the previous commit and comparing.

Moving a decision out of the loaded document has an obvious cost: it also moves it out of sight. Every role file, and the project instructions themselves, now carry a short rule saying the visible table is not all of them and where the rest are. Sixteen of sixteen installed roles carry it, and so do the composed roles in every project on this machine.

### A limit that could not be overridden was a limit people worked around

The cap on how many things can be in progress at once was a constant with no way past it. When it refused something its owner had explicitly authorised, the only two ways forward were to edit a ticket file by hand or to do the work off the board entirely. Both destroy the record the board exists to keep.

It now refuses the first time, and takes an override only with a reason attached. The reason is held back until every other refusal that could still fire has passed, and is only written once the move has actually happened, so the ledger records what was done rather than what was attempted. The next refusal quotes the history back. At three overrides inside fourteen days it hardens and stops accepting them at all, on the argument that a limit overridden that often is not being applied.

The health check reads that ledger, which was the one file it could not see.

### Smaller things

The session hook log now records where it ran and how it ended, and it no longer starts with a byte order mark. The health check gained a section that reports it.

Each of the ten test suites that run inside the main suite now pins its own expected total, and each pin was read from that suite's own output rather than typed beside it. A suite run on its own is protected too, which matters because one of them usually is.

A new check reads the two measures this project's process work was accepted on, from the commit log and the committed ticket history rather than from anything specific to one machine. Where a measure cannot honestly be produced, it reports that it is not proved and exits accordingly, rather than passing.

The resume-prompt check now prefers a properly marked heading and falls back to looser matching only where no marked heading exists, which was measured against every such document on this machine before it was written.

---

## 2026-09-02

**What this gives you.**
- **The board's required contract now describes the board you actually get.** It specified seven columns; the program has always drawn eight, one for each status. It required a field the board you install has never had. It listed ten commands the program does not have and left out all nineteen it does. Every one of those is corrected, and the reference page and the how-to page were redrawn to match.
- **The page that explains the board no longer says two different things about the one decision that is yours.** Accepting work is the single move on the board that belongs to you and to nobody else. The board drawing labelled that column as the team's while the table two inches below it labelled the same status as yours.
- **A part of the toolkit that ships to you had never been checked for the fault that once broke thirteen of sixteen roles.** The list of directories the health check reads was missing one, and that directory publishes. Nothing was wrong inside it, and nothing had been looking.
- **Three rules the contract states are now checked against the program rather than against another document.** The board is rendered and compared. The commands it documents are compared to the commands it has. Two directories that are supposed to hold the same list are compared by reading both.
- **Every project on this machine was carrying a rule that told it to invent its own board shape**, twenty-five lines above a rule saying the shape is fixed. That file loads at the start of every session in every project.

### Three descriptions of one board, all agreeing with each other and none with the board

The contract, the reference page and the how-to page all said the board has seven columns, with a tested item and an accepted item sharing one column and a small marker telling them apart. The program has never done that. It draws one column per status, so an accepted item sits in its own column and needs no marker.

Nothing caught it for months, and the reason is worth more than the fix. Every check compared a page to another page, or a page to the contract. The three of them agreed, so every check passed. None of them was ever compared to the board itself.

The correction is not only the number. What a board looks like is now written down twice, in two places, on purpose: what the file-based board draws, and what a version built on the web has to draw, which is the seven-column layout and which is a requirement only of that version. A test now renders a real board and compares it to the contract, in both directions and in order.

### The claim in a comment is a claim

Four separate times this release, a sentence written beside a check said the check caught something it did not catch. A check that skips what it cannot read is worse than no check at all, because the record then says the claim is guarded.

One example, because it is the clearest. The comparison between the board drawing and the table beneath it read the table with a text pattern. Add one space inside a cell and that row stops matching, and the comparison then skipped that row in silence. Everything stayed green while the two halves of the page said opposite things. It now counts how many pairs it actually compared and fails if that is fewer than the number it was supposed to.

Where a check genuinely cannot fail on its own, that is now written next to it along with the experiment that proved it, rather than claimed otherwise.

### A directory that ships to you and was never scanned

The health check reads a list of directories looking for invisible control characters, which is the fault that once left thirteen of sixteen roles silently unusable across every project for weeks. The tooling directory publishes to you and was not on that list.

It was found only because two lists that are supposed to be identical were finally compared by reading both of them, rather than by searching one file for the text of the other. The old comparison could not have failed for any change made to either list. Nothing was wrong inside the directory; it had simply never been looked at.

### Not marketing, and worth saying plainly

Two things were released here that a reader receives and one that only this machine sees. Nothing in this release changes what the board does. It changes what the board says about itself, which was wrong in eleven measurable ways, and it adds the checks that stop it going wrong again in the same way.

---

## 2026-09-01

**What this gives you.**
- **The message you see when a session opens is now written for you rather than for the assistant.** It used to read out the whole operating manual: ninety six lines and 977 words, every time, whether or not any of it concerned you. It is now fourteen lines and 197 words that say what is being worked on, why it matters, and what is needed from you. Both numbers are counted from what the tool actually emits.
- **It cannot quietly grow back, because two caps are now enforced when you save your work.** Twenty five lines for the whole message, twelve for the part addressed to you. This matters more than it sounds: the message grew twenty two lines in a single day before this, because every session had a reason to add to it and none had a reason to cut.
- **A project that has never had one of these is told about it, never locked out.** The check reports a missing brief and lets the save through. An earlier version of it refused, and it turned out that almost every project on the machine that built it would have hit a wall it could not pass on its next save. You adopt the rule by writing the section once, and until then you are only reminded.
- **The check tells the difference between broken and absent, and only one of those stops you.** A brief that is too long, too wide, or identical to the session text is a genuine problem and blocks the save. A project that simply has not written one yet is not.
- **What is written for you and what is written for the assistant are now separate text on separate routes, so neither can swallow the other.** The founder-facing block is read to you at session start. The assistant's instructions reach it another way and are never read out.
- **Asking for a summary of where things stand now leads with the answer.** The corrections come second and the full record third, instead of the answer arriving after eighty lines of process notes.

### The session start now speaks to the founder, and the long version was a duplicate

The obvious fix was to write something shorter. The actual finding was that the long version never needed to be sent at all.

The assistant was already receiving the full record by a completely separate route, on every single request, because the project's main instruction file imports it. So the ninety six lines being read out at session start were a duplicate of something already in hand. They were spending the founder's attention to deliver text to a reader that had it before the greeting began.

Once that was measured, the split cost almost nothing. The founder gets a brief. The assistant keeps the manual by the route that was always carrying it.

### A cap becomes a target, which is why it is split rather than flat

A single limit for the whole message would have left roughly a dozen spare lines, and "we are still under the cap" is precisely the argument that produced the ninety six line version in the first place.

So the spare room is fenced off. The part written for you has its own tighter limit, because it is the part you read every day and the part with nothing else stopping it expanding. The remaining room belongs to warnings about problems in your project, and those are self limiting: there are only a few of them and each one stops appearing once the thing it reports is fixed. The growth has nowhere to go.

### Four rounds of review, three failures, and all three were in the evidence

This is worth publishing because the pattern is more useful than the feature.

The change itself was substantially right after the first attempt. What failed review, three times running, was the proof that it was right. A control was added that no test would notice being deleted. A section boundary was fixed and the fix was described as complete when it covered only part of the case. And a test named after the exact situation it was meant to prove turned out not to contain that situation at all, so it had been passing for the wrong reason.

Every one of those was found by someone other than the author, by deliberately breaking the thing and checking that the tests complained. Two controls that could not fail were repaired during review rather than shipped. The rule this reinforces is one this project has written down before and keeps relearning: a check nobody has watched fail cannot be distinguished from a check that always passes, and that applies to the check itself as much as to the code beneath it.

---

## 2026-08-30

**What this gives you.**
- **Large work cannot start until somebody has written down what it is for and how you will know it worked.** The board now refuses to move a large item into progress without a recorded verdict and one named measure. It does not perform the assessment and does not pretend to. It refuses to let the work begin without one, which is the only part a program can honestly enforce.
- **A measure is required, not optional, and that is the point.** An assessment with no measure is an opinion with a verdict attached, and the measure is the part that gets skipped.
- **Small work is deliberately exempt, and the exemption is tested rather than trusted.** Making the gate fire on small items turns the test suite red on purpose. A gate that fires on everything gets routed around, and then it protects nothing.
- **A guard that was quietly reporting that nothing was in flight now reads the right place.** The session cost guard counted open work from a folder that had been moved, so for a whole session it reported an empty board while three items were open. It was confident and wrong, which is worse than silent.
- **Two rules that were written down and guarded by nothing are now genuinely guarded.** One is a decision about how the board may be written to; the other is a sentence published on this site. Either could have been deleted in full with every test still passing.
- **New projects are no longer sent to the board that was replaced.** Two roles in the shared team still pointed at the older tool.

### Why this is a refusal rather than a reminder

The instruction to assess an idea before building it had been written down here for months, and it kept being skipped. That is not unusual and it is not a discipline problem. Every rule in this project that now holds became a rule the software enforces, and every rule that stayed a paragraph eventually stopped applying.

So the front door stopped being a sentence in a document. A large ticket cannot enter progress without a verdict and a measure attached to it, and the attempt fails with an explanation of what is missing.

The immediate cost is real and worth stating plainly, because it is what the change is for: work already sitting in the backlog cannot start until each item has been through that step. That is not a side effect.

### A test that cannot fail is not a test

Two of the things repaired here were rules with tests that could not fail.

The first was a decision about how the board may be written to. Deleting the entire paragraph implementing it left the suite fully green. The second was a sentence describing what the published board is. Replacing it with the older, wrong description also left the suite fully green.

Both had been reviewed. Both had tests near them. Neither had a test that would notice if the thing it described disappeared, because the tests asserted that nothing bad happened rather than asserting that the right thing was present.

The rule that came out of it, and it is the more useful half: check what the code did, never that it failed to misbehave. Read the record back and confirm it changed.


---

## 2026-08-29

**What this gives you.**
- **Your project now tells you when its own record has grown too big to load, at the moment you are writing that record.** The health check has reported this correctly for weeks. It only helps if somebody chooses to run it, and the person who makes a document longer is winding down, not running a health check, usually on a different day.
- **It separates two problems that look identical and have opposite remedies.** A record that has honestly grown needs archiving. A section that is supposed to be rewritten every session, and is being added to instead, needs rewriting. Archiving would return nothing there, and until now nothing could tell you which one you had.
- **The cost is reported as a running charge rather than a file size.** A document of 165,000 characters is roughly 42,000 tokens re-sent on every single request for the whole session, before any work happens at all. Those are the same number and only one of them reads as a problem.
- **An archive stays findable.** If a project moves older decisions into an archive file, the check refuses unless a document the session actually loads points at it. Decisions nobody can find get argued again from the start.
- **There is now a command that moves older decisions out of the file a session loads, and loses none of them.** It reports what it would do and changes nothing at all until you ask it to write.
- **It refuses to guess.** A decisions table can run newest first or oldest first, and both are in use here. If it cannot establish which end is which from the row numbers, it stops rather than archiving the wrong twenty.
- **It writes the copy first and reads it back before touching the original.** If anything fails in between, you are left with a duplicate rather than a truncated record.
- **You can now run the same board this studio runs, in a repository you already have.** One file per ticket in a folder, committed beside your code. No database, no account, no service to sign up for, and nothing to keep running.
- **Its rules refuse instead of reminding.** Only QA moves work into acceptance testing, and only once test notes a person can follow have been written. Nothing closes over a question nobody answered. Work in progress has a ceiling. Each of those is a refusal in the program rather than a paragraph somebody is trusted to remember.
- **You can read it without opening a terminal.** A rendered board file is rewritten on every change and committed with the tickets, so it opens on a phone in any code host. Acceptance testing is the one column that waits for you, and it would be a poor joke if that were the one thing you could not look at.
- **The documentation now matches the board.** Two states the board has always had, parked and killed, were described nowhere. The vocabulary of record now defines Board, which was the most used word on this site and the only one never explained.

### Why a size is not a cost

The file that holds a project's state is loaded automatically at the start of every session, and it is re-sent with every request in that session. So its length is not paid once. It is paid on every exchange, for hours, before anybody types anything.

Measured across the projects on this machine, the worst was loading just over 307,000 characters on every request. That is about 77,000 tokens of context before a single question is asked, and across two hundred requests it is more than fifteen million tokens spent on re-reading a record rather than doing work.

The health check has been printing that number in red for weeks. Nothing acted on it, because reading it required choosing to run a separate command, and the growth happens somewhere else entirely.

### The two diseases

The obvious remedy is to archive old history, and for one project that is exactly right: it had accumulated 141 decisions in a single loaded document.

The project that raised the alarm had no decisions table at all. Its weight was in two sections that are supposed to be replaced every session, the next action and the prompt used to resume work. Together they were 111,000 of its 165,000 characters. Nothing there was history. It was current state, written five times over and never cleared out.

Those two problems look identical from the outside, they have opposite remedies, and choosing the wrong one leaves the file exactly as large as it was. The new check names which sections are the offenders, so the remedy follows from the report instead of from a guess.

### The board you can have on the first day

The board this studio uses to run itself was, until now, not something you could have. What was published needed a hosted database, a project, a bot user, policies and a deploy before it would show you a single ticket, against a free tier that allows two projects. So the one board a new project could realistically start with was the one thing that was never shipped.

That is what changes. The board is a directory of files in your own repository. Git is the durable store, which means your board is versioned, diffable and reviewable exactly like the work it tracks, and a ticket carries a real history rather than a last-modified date. Starting one takes a single command and produces something you can read, commit and push in the same minute.

A visual version on the web remains a decision you make for one project, and it is not an upgrade. The board in your repository is the one every project starts with.

### Two states that existed and were nowhere written down

A board that can only say done quietly encourages the worst habit in software, which is four things at sixty per cent and nothing shipped.

This board has always had two more endings. Work can be parked, meaning it was started and deliberately stopped, and it can be killed, meaning it was decided against. Both require a reason. Neither appeared in the specification or on the reference page, which described eight states for a board that has ten, so a reader learned about them by accident or not at all. They are now written down where they belong, and the rendered board shows them, because a board that displays only its columns hides every ending it recorded.

### One limitation, stated rather than discovered

The board expects a single writer. Ticket changes happen on one branch.

Two branches can each work out the next ticket number, each write a different file, and the merge will succeed without a conflict, so the collision is silent. The tool detects a duplicate afterwards and does not prevent one. That is a real constraint and it is now in the program's own opening paragraph, rather than being something you find out when two numbers collide.

### Moving history out of the way without losing it

The remedy for a record that has honestly grown is to move the older entries somewhere that is
read on demand instead of on every request. Nothing is deleted and the trail stays whole. The
policy for this has been written down for months and no project had ever carried it out, which
is the ordinary fate of a policy that depends on somebody remembering it.

The new command carries it out. It is a dry run unless you ask it to write, it proves that what
it keeps plus what it moves equals what it started with before it changes a single byte, and it
leaves a line in the document you keep saying which entries moved and where they went. That last
part is the one that matters most. Moving a decision out of the loaded file stops it being read
every time, which is the point, and stops it being seen, which is not. A decision nobody can find
gets argued again from the beginning.

### It reports, and it does not refuse

A failing check here does not stop the session from saving its state.

That is deliberate, and it is the opposite of the other pre-commit check that ships alongside it. A guard that blocks the save leaves the record unwritten, and losing a session's state costs far more than a document that is too long. The check reports the numbers, names the section responsible, and lets the save go through.

## 2026-08-26

**What this gives you.**
- **The command reference tells you when to reach for each command, not only what it does.** Every row now opens with the situation you are in: after you change a shared role, the first time a project needs to differ, when a file was edited where it was installed.
- **What each command writes is spelled out in plain sentences.** It used to be a list of paths, which only helps a reader who already knows what those paths are.
- **The two commands nobody should ever run by hand say so.** They are hooks. Your tooling runs them for you, and the table used to describe them as though you would type them.
- **The three worked examples are numbered steps.** What you are trying to do, the commands in order, then one sentence saying what changed as a result.
- **Releasing says what it ships and what it does not.** It ships the studio itself: the shared roles, the skills and the website. It does not deploy the product a project builds, and a reader could previously have assumed it did.
- **One limitation is now stated on the page rather than left to be discovered.** The roster installs into the directories one specific coding agent reads. The method does not depend on any particular agent, but this tool does, and other agents are not supported yet.

### Written for the person about to type it

The command reference shipped yesterday answered the wrong half of the question. It said what each command did, in the vocabulary of somebody who already knew, and it listed the directories each one touched as bare paths. That is a reference for people who do not need one.

Every row now opens with the trigger. You reach for the sync after changing a shared role so that every project receives it. You reach for the forced version when a file was edited where it was installed and you have decided the shared version should win. The same wording opens twelve of the nineteen rows, deliberately, because a reader scanning the column gets the same kind of answer in the same place every time.

The writes column is now sentences. Overwrites the sixteen role files in the machine-wide agents directory and the skills beside it. Creates the project file if there is none, and otherwise edits only the block between two markers and leaves the rest of the file unchanged. Read-only, no file created, modified or deleted. A reader can now tell, before pressing enter, whether a command is about to rewrite something they have been editing.

### What releasing actually is

It ships the studio: the shared roles, the skills, the method and the website. It is not a product deploy. A project built with this team ships its product through its own pipeline, and nothing in this tool touches that.

It is one command rather than two because it used to be two. A change was committed to the private repository and never published to the public one, nothing compared them, and the public copy stayed behind for weeks. One dated entry in the changelog now drives both, so the two repositories cannot describe the same day differently.

### The tables had never fitted on a screen, and the fix was one selector

Reported yesterday and worth repeating with the numbers, because the cause is the interesting part. A rule that keeps one table's short labels on a single line had been written against every table on the site, while the comment directly above it described the one table it was meant for. Measured in a browser: two tables rendered at nearly three times and more than twice the width of the column holding them, scrolling sideways on a desktop rather than only on a phone.

Every check this project owns reads text. None of them could see this, because it does not exist until a browser has laid the page out. A comment is not a selector.

---

## 2026-08-25

**What this gives you.**
- **The page that explains how to run this now tells you what to type.** It covered installing the team and tuning it, and never mentioned the four commands you actually use in a session. They were in the repository, working, and findable only if you already knew to look.
- **The command list no longer calls itself complete while leaving out the one that ships anything.** It was headed as the whole workflow and did not include releasing.
- **Every command the tool accepts is now written down, with what each one changes on disk.** Seventeen switches. The site had shown five of them in a code block with a one-line comment each, so anyone evaluating this had to clone the repository and read a file to find out what it does.
- **The two commands that point in opposite directions now sit next to each other.** One sends your work out. The other pulls somebody else's in and rebuilds every project on your machine from it, publishing nothing. They are one letter apart in a terminal history, and only the first of them was named on the site.
- **Three worked examples, for the three things people actually do.** Improve one role for every project at once. Make a single project behave differently without forking anything. Publish your own version.
- **The two pages you read before you type are much shorter.** Same ground, written the way developer documentation is written: a table you can scan and code you can copy, instead of paragraphs you have to read in order.
- **Two tables on the site were wider than the screen and are now not.** The stack table and the skills table were each forced onto a single line per row, so they scrolled sideways on a desktop monitor, not only on a phone.

### Four commands nobody was told about

The commands for building and maintaining the team were on the site from early on. A second set was not: the ones you type inside a session once the team is running. Opening a session and being handed where the work actually got to. Putting an idea in front of the leads before anything is built, and getting a no when a no is the right answer. Reading what a project genuinely earned and cost before deciding anything from a roadmap. Closing a session so the next one starts from a record instead of a memory.

All four shipped in the repository and none of them appeared on any page of the site. Checked rather than assumed: a search for their names across every published page returned nothing at all.

This is the fourth time the same thing has happened here, and the pattern is worth naming rather than fixing quietly each time. Something gets built, it goes into the repository, and the website is never told. Board columns, the technology choices, the vocabulary, and now the commands. Each was correct where it lived and absent from the place a reader would look.

The closing one is the one worth reading twice. Skipping it loses everything since the last update: what got decided, what is half finished, and where exactly it stopped. That is written on the page now, next to the reason.

### The site told you what the tool was for and never what to type

The pages explained the idea well enough. One shared team, tuned per project, rebuilt whenever either half moves. What they never did was tell you the commands. Five appeared in a code block on the how-to page with a comment each, and the reference page, which exists precisely so a reader can look something up, did not mention a single one.

Every switch is now documented in one table: what it does, when you would reach for it, and what it changes on disk. That last column is the one worth having. A command that quietly rewrites a directory you have been editing is only surprising once, and it should not be surprising at all.

Two of them deserve their own section, and now have one. One command sends your work out to the world. The other pulls the upstream version in and rebuilds every project on your machine from it. They differ by one letter in a terminal history, and running the wrong one leaves every project on the machine briefed by somebody else's team while publishing nothing at all. Both are previewable before you commit to them, and the page says so.

### Shorter, in the register of documentation rather than argument

The rest of this site is written in the first person, because it is an argument for a way of working. The two pages you actually run the tool from are not an argument, and writing them that way made them long. They are now dense and scannable, in plain professional English, with the recommended order of operations first and the reference material after it. Nothing was dropped: the board, the skills, the composition model and the three ways a project may differ are all still there, and shorter.

### Two tables that had never fitted on a screen

A rule that keeps the board table's short labels on one line was written against every table on the site. Two of the other tables are three columns of prose with the long one last, so that rule forced each row onto a single line and pushed the table far past the width of the page. Measured on a desktop before the fix: one rendered at nearly three times the width of the column that holds it, the other at more than twice.

The comment above that rule had described the board table alone for as long as the rule has existed. A comment is not a selector, and nothing was comparing the two.

### A page that cannot quietly go stale

A published command list is a hand-kept copy of something that moves. Add a switch to the tool and the page silently omits it. Remove one and the page keeps recommending it, which is worse, because a reader types it and gets an error from the document that was supposed to be the reference.

Both directions are now checked on every test run. It found a real gap on its first run, before it had been proved: one modifier was documented only as part of a longer command and never on its own.

---

## 2026-08-24

**What this gives you.**
- **Winding down now saves the record it just wrote.** It used to write the state of a session and leave it sitting on the disk unless somebody thought to ask for it, and the session that would have noticed had already ended.
- **The check that should have caught that is now a measurement.** It asks for the reference of the save or the count of lines still unsaved, rather than a judgement from the session being judged.
- **The prompt that gets you back into a project is handed to you when you open it.** No finding the file and copying it out. There is a command, `/warm-start`, for asking on demand, and it tells you which parts have gone out of date rather than handing them to you as though they were checked.
- **The two commands that point in opposite directions are written down.** One sends your work out; the other pulls somebody else's in and rewrites what your projects are built from. The published guide named only the first.
- **A long session now stops itself.** Cost grows with the square of how long a session runs, so the expensive sessions are the ones that feel productive. It counts, and it interrupts, and it tells you what is still open before you go.
- **You can see what a project costs to open, and what that adds up to.** The health check already reported how much a project loads. It now converts that to what you pay on every single request, and multiplies it out across a session, which is the number that actually decides anything.
- **Two test suites that nothing was running now run.** They were sitting in the repository being nobody's job.
- **A resume prompt can no longer send you to state it has already replaced.** Closing a session adds a new block of current state and marks the previous one superseded. The line telling the next session which block to start from is written by hand, and it could be left pointing at the old one. Nothing compared the two, so the document could contradict itself and still look finished.

### The wind-down was saving everything except its own work

Closing a session writes down what happened: what was decided, what is half-finished, what the next session should pick up. The whole point is that the next session starts from a record rather than a memory.

It was writing that record and not saving it. One project ended a session with a hundred and thirty lines of new history written to the disk and filed nowhere durable, including two decisions and the whole account of that day, because the instruction said not to save anything unless asked and nobody thought to ask on the way out. The session that would have spotted it was the one that had just ended.

The instruction is now the other way round. Saving the record is the default and the four safety checks still run first, each of them there because of a real failure: which repository you are actually in, whether an untracked file is genuinely ignored, whether a repository inside another one inherits its protections, and whether there is anywhere to send it. Only the two documents are saved, named individually. Anything else you had open stays yours, and it says how many it left alone.

### A row that graded itself

The same file kept a small table at the end of every session, and one line of it read "state is durable: repository exists, has a remote, documents committed". A session that had just left everything unsaved could tick that line, because the line was a judgement made by the party being judged.

It now asks for evidence: run the command, and write down either the reference of the save or the number of lines still sitting unsaved. If you cannot run it, that is unknown, and unknown counts as a gap rather than a pass.

This is the same rule this studio applies to everything else, finally applied to its own scorecard.

### Getting back into a project

A project can keep a prompt describing where the work is: the next thing to do, what is deliberately unbuilt, and the rules that were expensive to learn. It sits inside a long document, and getting it meant opening the file and hunting for it.

Now it arrives when you open the project. It comes through unchanged, with a line saying it was written at the end of the last session and every number in it is worth checking rather than trusting. That warning is not decoration: this studio's own prompt was telling sessions to expect three hundred and eight checks when the real number was three hundred and sixty, and pointing at work that had shipped two days earlier. Nothing had read it in between, because the only thing that read it was a person copying it, and copying is not checking.

There is a command for asking on demand too, `/warm-start`. It hands you the same prompt and adds what it found: which numbers in it no longer match, and whether the work it points at is still open. What it will not do is quietly correct the file, because that document is written at the close of a session from a reading of the whole session, and a session that has done no work yet should not be editing it.

### Which command is yours

If you have taken this studio and made it your own, the command that sends your work out is the release. The other one pulls in changes from wherever you took it from, and rewrites the team every one of your projects is built against.

The published guide listed the first and never mentioned the second, which left the more dangerous of the two undocumented. Both are now described, along with what happens if you run the wrong one: you can end up with somebody else's team in place of your own, you publish nothing, and every project recomposes against a base you did not write.

### The most expensive session is the one that feels like it is going well

Every request an assistant makes re-sends the whole conversation so far. So a step taken early is not paid for once, it is paid for again by every step that follows it, and the total grows with the square of how long the session runs rather than in proportion to it.

Nobody noticed, because nothing about it feels wasteful from the inside. One build was measured afterwards from the records the runtime already keeps: five hundred and seventy four requests, and three hundred and forty units of input paid for every unit of output produced. The largest single file it read in the whole run was small. Nothing was careless. The shape was wrong. The same work, at the same quality and with the same checks, split into five shorter runs instead of one long one, costs about a third of that.

This was found because somebody ran out of a monthly budget, which is the worst way to find anything.

There is now a guard that counts and refuses. It stops the session at a threshold and again at every interval after it, and the message says how long it has run, roughly what it has cost, and how much work is still open on the board. What it will not do is trap you: it blocks once, then lets you carry on, because a wall that blocks everything also blocks the tidy-up on the way out and would cost more than it saved. It also fails open, so if any part of it breaks, work continues.

Sixteen roles were given the reasoning as well as the rule, because a rule with no defect attached is one the next person deletes as noise.

### What a project costs to open

The health check already told you how much a project loads before any work starts. That is a size, and a size is easy to look at and do nothing about.

It now reports it as what it is: a charge on every request, projected across a session. The same figure that reads as unremarkable when stated once becomes hard to ignore when multiplied by two hundred, and that is the same number.

Running it found one project paying seventy per cent more per request than the one that had already caused a problem, and another close behind. Both are heavy for the same reason: they keep an honest, growing record of every decision ever made, and they re-read all of it every time. The fix is not to delete history. It is to split each document into the current part that gets loaded and an archive that is pointed at, which keeps the trail whole and stops paying for it repeatedly.

The tool now says that, in the place where you see the number.

### Two suites nobody was running

Two sets of tests lived in the repository with nothing to run them. The instructions carried a note saying so, which is another way of saying the checks were optional.

They now run inside the suite that does get run. While wiring that up, the new guard's own tests caught a real defect in the guard: it was re-reading its whole record on every check and reporting a cost forty times higher than the truth, with a straight face. A guard against expensive work, quietly being the expensive work. Every check here has been proved by breaking the thing it exists to catch and watching it go red.

---

### The document that disagreed with itself

Closing a session writes a block of current state and marks the previous block superseded, so the record keeps its whole history without pretending the old part is still true. Separately, near the bottom, sits the prompt that tells the next session where to begin.

One of those was updated on the way out and the other was not. The new block was written, the old block was correctly marked superseded, and the prompt was left saying to start from the old one. The document now held both statements at once: that the block was history, and that it was the place to begin.

The next session read the prompt. A prompt reads as instruction rather than as a claim, so nothing about it invited checking, and the work carried on from state that was three days stale.

The instruction to rewrite that prompt every time already existed and had done for months. It was skipped, which is the ordinary fate of an instruction nothing verifies. So it is now checked instead of asked for: the newest dated block and the prompt are compared, and a wind-down will not commit while they disagree. The failure names the line that demoted the block, so the fix is obvious rather than a hunt.

The same check found a second thing. The tool that hands you a prompt takes the fenced block under the heading, and one document had never had a fence, so there was nothing to take and the surrounding paragraphs went out instead. Handing over the wrong text confidently is worse than handing over nothing, so both are now refusals rather than guesses.

Eighteen assertions cover this, and every one has been watched failing by breaking the checker and confirming the suite goes red. One further assertion was written, proved unable to fail, and deleted rather than shipped: a check that cannot go red is indistinguishable from one that always passes, and this file has published that mistake before.

## 2026-08-23

**What this gives you.**
- **You can see what each project loads before it starts working.** Two projects had quietly grown past the point where a session can open without a warning, and the only thing that reported it was the session that hit it. The health check now shows the number for every project, so a project approaching the ceiling is named weeks before it gets there.
- **What a session has to read before it starts stops growing without limit.** The record itself keeps everything, as it always has. What changes is that older entries move somewhere they are kept and can be looked up, rather than being loaded every single time.

### A project can now tell you what it costs to open

Every project loads its own documents at the start of every session: what was decided, what is half-built, how it works. That is the point, and it is what stops a session repeating a conversation from three weeks ago. It also has a running cost, and nothing was watching it.

Two projects had crossed the line where those documents no longer load quietly. One of them announced itself, because somebody opened a session there and got a warning. The other had been over for an unknown length of time, further past the limit than the first, and nobody knew because nobody had opened it lately.

The health check now reports what each project loads and flags anything approaching the limit. There is also a middle state for the case that would otherwise never be reported at all: a project can spread the same weight across several documents, trip no warning anywhere, and still spend a large part of a session's attention before any work begins. At least one project is in that position today. Splitting a file to silence a warning, without reducing what is actually loaded, only moves the problem somewhere nothing looks.

### A decision worth recording is a rule and a reason, not a story

The cause was measured rather than guessed at. In the project that raised this, the decisions table was seventy-one per cent of the file: ninety-five entries averaging around twelve hundred characters, the longest over three and a half thousand. Individually every one of them is worth having. Together they are the single largest thing every session reads before it can start.

The rule for writing one now says so, in both places that create these records: the entry is what was settled and what it cost to learn, in two or three sentences, and the story of how it was found belongs in the session history or on the ticket, where somebody goes looking for it rather than loading it every time. Past roughly a hundred entries, the older ones move to a separate file that is kept and pointed at but not loaded automatically. Nothing is deleted, and the trail stays whole.

This studio wrote the rule that caused the problem. Every project was on the same curve by construction, which is why the fix is here and not in the project that noticed.

---

## 2026-08-22

**What this gives you.**
- **A project tells you what is wrong with it, in the project.** The health check has always run here and reported on everything else, so the session that could fix a problem was the one session that never heard about it. It now speaks up where the work happens, names the rule and the fix, and says nothing at all when nothing is wrong.
- **The rules are put back at the moment they are most likely to be lost.** When a long session drops context, the standing rules are restated and the team is asked to prove its roster is actually loaded rather than assert it.
- **The board now refuses what it used to merely describe.** Seven rules every project was trusted to remember are enforced by the tool, and the proofs ship with it.
- **Both new hooks record that they ran**, which closes a gap that had been open for weeks: nothing could tell a hook that did nothing from a hook that was never running.
- **A web address that does not exist now says so.** Every unknown address on the site used to return the home page and report success, so a mistyped or out-of-date link never told anyone it was wrong, and search engines could file the same page under any number of junk addresses.
- **The reference page says what it is for, and what each board status means.** It opens with its purpose instead of listing what you are assumed to know, and a table now gives every status, what it means, and who is allowed to move it.
- **The infrastructure standard names its source control.** It was relied on throughout the document and missing from the list of defaults.
- **A deploy that silently stops happening is now written down as a known failure.** A git connection can stop triggering builds while every dashboard still reports it healthy, so the release reports success over a site serving the previous version.

### A project can finally see itself

The health check reported on nine projects and only ever ran in one of them. So a project could be
running a stale team, or loading a document that had been deleted, and every session opened there
would be told nothing, because the only thing that knew was somewhere else. One project ran a
retired process for weeks. Another loaded a pointer to a document deleted seventeen days earlier
while reporting itself healthy.

A session opened in a project now gets a short brief at the start. It names the rule that is
broken, what is actually wrong, and the one thing to do about it. When nothing is wrong it says
nothing, which is what makes the rest of it worth reading.

**A third check was written and then cut, before any of this shipped.** It reported projects that
have never recorded how they are actually doing. Run against the real portfolio it fired on five
of nine, with the same sentence every time, and it failed a second test nobody had written down:
the session cannot act on it. That needs numbers only the founder has. A brief that greets five of
every nine sessions with work they cannot do is training people to skip the brief, so it was
removed rather than reworded. What survives is the change rather than the standing condition: a
project that was recording how it was doing and then stopped.

### The rules are restated exactly when they are being dropped

Long sessions have been blamed for the team quietly stopping following its own rules. The most
likely cause is the moment a conversation gets too long and older context is discarded, and that
moment is now the trigger: the standing rules are put back in front of the team as it happens,
rather than on a timer that mostly fires when nothing is going on.

The block is deliberately short, because one nobody finishes reading does not work, and it ends
with an instruction rather than a reminder: name your team members and count them. Not "the team
is configured", which is a claim about files. Name them. Thirteen of sixteen were missing from
every project for weeks while every check reported them present and correct, and the only thing
that would have caught it was somebody being asked to list who they could actually call.

Two words were separated first, because they were being used for one thing and have opposite
fixes. Files go stale, and a command fixes that without anyone noticing. A session slips, and no
command can fix it; only reading something again can. One word covering both would have produced a
message telling somebody to run a tool that cannot help them.

### A missing page used to answer as if it were there

Every address the site could not match returned the home page, and returned it as a success. A
link that had gone out of date never told anyone. A search engine could file the same page under
any number of wrong addresses. And a page that had not been published yet was indistinguishable
from one that had.

That last consequence is how it was found, and it is the part worth keeping. A health check ran
over all seven pages and reported every one healthy, including one that did not exist yet. It was
not wrong about what it measured; it was answering a different question from the one it was asked.
Anything checking only whether an address responds, against a site that answers everything, cannot
tell a published page from an absent one.

There is a proper not-found page now. It carries the same navigation as everything else, so
somebody who arrives by a broken link can still get where they were going, and it asks search
engines not to file it, because an error page that gets indexed collects the same junk addresses
the old behaviour was collecting.

### The board refuses, where it used to explain

The board this method ships has always documented its rules and enforced none of them, so every
project built from it was trusted to remember the most important one: whoever built the thing does
not get to be the one who says it works. Seven rules are now refused by the tool rather than
written down for you. Only QA can send work for your approval, and only with notes a person can
follow. Nothing gets started past the limit on work in flight. A decision you were asked for
cannot be quietly closed unanswered. A question cannot reach you without numbered options and a
recommendation. And a ticket number can never be reused, because a reused number points two
pieces of history at the same address.

The proofs ship with it. Each rule is tested twice, once that it refuses the thing it names and
once that it does not refuse anything legitimate, because a rule that refuses everything is as
useless as one that refuses nothing and only the second kind announces itself.

**It refused the person who wrote it, on the day it was written.** Work was started while two
larger pieces were already open, and the tool declined. That is the argument for it, in one
instance.

### The reference page tells you what it is for

The page opened by naming three things the reader was assumed to already know, which is an unfriendly way to greet somebody who came looking for a definition. It now opens with what the page is and who it is for, in two sentences, and gets out of the way.

The board section gained a table: every column, the status underneath it, what that status means, and who may move a ticket into it. The last of those was the point. There is exactly one move on the board that belongs to you, accepting the work, and the old wording used four different labels across eight rows which buried it. Every row now reads the same except the ones that genuinely differ.

Roughly four hundred words came out. What is left is shorter and says more, because a reference page is looked things up in rather than read.

### The stack list was missing the thing everything else sits on

The standard named five layers and left out source control, while the rest of the same document leaned on it constantly: the account wide limit that binds first, the rule that a project must be reproducible from its repository, and the hosting combination to avoid. A default that everything depends on and nothing states is not a default, it is an assumption.

It is written down now, in the standard first and then on the page. That order matters. A page that gets ahead of its own source of truth is how the two quietly stop agreeing.

---

## 2026-08-21

**What this gives you.**
- **Release notes generated from a single source of truth**, so the page and the record cannot drift, and a stale page is detected rather than shipped.
- **Every question an agent asks you now arrives as numbered options** with a recommendation and an explicit way out, so you answer with one character instead of doing the analysis yourself.
- **A check that every project's imports resolve.** One project had been loading a pointer to a document deleted seventeen days earlier, silently, while reporting healthy.
- **A clean-checkout test run**, so what another person receives is what we actually tested.
- **Thirteen dangling references fixed in the published docs**, including the starter template we ask people to copy.
- **A reference page on the site.** The board and its columns, the infrastructure the method runs on and why each part was chosen, and a glossary of every term that is not ordinary English. All of it was already written down, in a repository, where you could only read it by cloning.
- **Six silent failures in the tool, fixed.** In each one the tool reported success while the disk held something else: a role composed to an agent with no instructions, a half-applied install left behind by a command that said it had failed, a session-start rebuild that failed without a word.
- **A copy of the studio can no longer reach your real projects.** Copying the tree to work somewhere safe now does what it looks like it does, and says so when it cannot.
- **Forty-eight new checks, and twenty-nine deliberate breakages run against them** to confirm they go red rather than assuming it. Three of the breakages found the check itself was faulty.

### The reference page

The method assumes you know what a roster is, which board column is yours, and what the stack
runs on. All three were written down and none of them were on the site, so unless you cloned the
repository you could not check any of it. Release notes kept stopping to define their own
vocabulary, and still left anyone landing on note eight without the definitions from note one.

There is now a seventh page. The board is drawn as a board, seven columns with the eight
underlying statuses, showing which moves belong to the agents and which single move is yours. The
stack names Next.js, Supabase and Cloudflare Pages with the reason for each, because the reason is
the part another founder needs and the logo list is not. The glossary defines sixteen terms in a
sentence each, and every term has its own address so anything on the site can link straight to a
definition rather than to the page and a hunt.

A check now compares all seven pages against each other: the same navigation in the same order,
each page marking only itself as current, every internal link resolving to a page or an anchor
that exists, and every page present in both the sitemap and the publish list. A page can otherwise
be added, linked, and quietly never indexed or published, which looks perfectly fine locally.

### Every question to you arrives as a shortlist

An agent that needs a decision used to be able to ask an open question. That hands the founder
the whole job of working out what the alternatives even are, which is the agent offloading its
own analysis, and the answer then lives in a conversation rather than on a ticket.

Every role now carries the format: numbered options answerable with one character, a
recommendation naming which the agent would take and why, an explicit escape as the last option
because a forced choice between wrong answers is worse than the open question it replaced, and
the ticket reference so the decision lands on the record.

The value is upstream of convenience. An agent cannot write the options until it has thought the
alternatives through, so the format forces the work the open question was avoiding. The rule was
raised on 2026-08-17 and sat unbuilt for four days because it would have meant sixteen
near-identical edits. With inherited rules it was one file.

### An import that resolves to nothing loads nothing, and says nothing

A project was importing a document retired on 2026-08-04. The file did not exist. Every session
opened there for seventeen days loaded a pointer to nothing, and neither the roster check nor
the state-document check noticed, because both were asking different questions: one compares
hashes, the other confirms the state file is imported. Nothing confirmed the imports RESOLVE.

A second project was importing the same retired document where it did still exist, which is
worse: it was loading a retired file as though it were current.

Both are fixed, and the health check now reports any import that points at a file which is not
there, naming the project and the file. The instances were one edit each. The check is the half
that matters, because the class recurs: a document is retired at source, the scaffold is
updated, and nothing sweeps the projects that already had it.

### Every release now says what it gives you

The changelog is written for someone maintaining the studio. It names encodings, mutation
testing and guards, and almost none of that answers the only question a reader has, which is
what a release did for them.

Every release now carries a short block saying that, in the changelog itself, and the public
page is generated from those blocks so the two cannot disagree. Thirteen releases were written
back through, including the first, which had never said what Startup Studio actually is.

One rule came out of the review and is worth keeping. An early draft allowed a release to say
nothing visible changed, on the grounds that an invented benefit is worse than a boring true
one. That was overruled: every release was funded, so a note saying there is nothing to say is
an admission the spend was not justified. There are releases whose benefit is a feature and
releases whose benefit is a risk removed, and the second is often the more expensive one to
have skipped.

A second rule, same review. A public note says a security improvement was made and what it
protects, never the mechanism. Naming the shape of what was wrong is an instruction to anyone
still running the older copy, and every reader of an open method may be running exactly that.
The full detail stays in the technical sections below, which publish; what changes is that the
summary does not hand it to a casual visitor.

### The release notes are a page now, generated from this file

Every change was published in one long file written for whoever maintains the studio.
Anyone deciding whether to use it had to read about byte order marks and PowerShell
decoding to work out what they would actually get.

There is now a Releases page on the site, newest release first, with a dropdown that
filters to a single release by date. Every word on it comes from the short "What this
gives you" block under each dated heading in this file, and nothing else from here
reaches it. So the page and the changelog cannot drift apart, and the internal half
cannot leak onto the public page by accident.

It is generated by `tools/build-releases.js`, which ships beside it so a fork can rebuild
the page rather than inherit one it cannot regenerate. A release with no value block is
skipped and named on the way past rather than published as an empty card, and if no
release has one the tool refuses to write anything at all, because a release notes page
with nothing on it reads as a broken site rather than as missing content. Running it
twice produces the same bytes, and `--check` fails if the page has fallen behind this
file.

The sixth tab forced the top bar up as well. Six tabs need roughly 1145px, and below that
the links strip scrolled sideways with its scrollbar hidden, so the last tab was present
and invisible. It now folds into the menu button below 1184px. Two touch targets that had
been under the 44px minimum on a phone were raised at the same time.

The dropdown is deliberately absent when scripting is off, rather than present and inert.
A select that submits, reloads a static page and changes nothing is a control that lies
about what it does. Without scripting every release is on the page anyway, newest first,
with the latest one open.

### The export told readers to follow rules it did not give them

Thirteen references across nine published files pointed at documents or roles that only exist in
the private half of this repository. Four roles told an agent to route a decision through "the
CEO's assistant", a job title defined nowhere a reader could see, and which our own house rules
had in fact retired: two of those four files contradicted themselves a line or two earlier by
saying to go to the founder directly. Others cited house-rule documents by filename, and the
starter template a new user is told to copy imported three files they would never have.

All thirteen now either say the rule in full or say plainly which documents do not ship and that
you should write your own. The published description of the assessment step also disagreed with
the assessment step as built, so both were checked against the running thing and made to match it
rather than each other.

The reason this is worth a note rather than a quiet tidy: the same defect was found and fixed one
instance at a time in an earlier round. Fixing the instance and not the class is why the other
twelve were still there.

### The only copy that matters was the one nothing checked

A skill is written here and installed onto the machine that runs it. The health check counted the
installed copies and said three of three, which was true and useless: one of them was an older
build, twenty-seven bytes and nine em dashes away from the text that had passed review, in a
house that bans em dashes outright,
and it stayed that way while every signal read healthy. A count is not a comparison. The health
check now compares the installed text against the source, and a test proves it by installing a
skill, editing the installed copy, and requiring the tool to notice.

The release note had the mirror of the same problem. It is read from this file and used for both
the private commit and the public publish, and the read was fixed three days earlier, inside this
same piece of work, to stop it mangling accented characters. Nothing tested the fix. The test fed
a note with an accent in it and then never looked at the result, so the fix could be reverted and
everything stayed green. It now looks, and the test harness itself was reading its own output the
wrong way for the same reason.

### A rule cannot be checked by searching it for words

The paragraph every role carries about writing work down was guarded by a list of banned phrases
like "this no longer applies". It was defeated three different ways in a single day, the cheapest
being to append one sentence saying the text above is an example of what not to do. The
list also blocked a perfectly ordinary sentence about withdrawing a ticket, so it failed correct
text and passed reversed text.

It is gone. In its place the paragraph is pinned to its exact contents, which answers the question
a machine can answer: has this changed since a person last read it. All three of those attacks
change the text, so all three now fail. Whether a rule still means what it meant is a reading job,
and pretending otherwise was the actual defect.

### Six ways the tool said one thing while the disk held another

These were found and written down over the preceding week and left as tickets rather than fixed
mid-review, because every unrelated edit made during a review is a fresh diff for a reviewer to
read. They are one defect wearing six costumes: a green signal over an incomplete artefact.

A role file that ended on its closing header line composed to an agent whose entire instruction
was three hyphens. Exit code zero, no warning, and it was counted in the roles-composed total. It
would have registered normally, answered when called, and enforced nothing.

Pushing the shared team out to every project installed the machine-wide copy first and only then
discovered a role it could not build. The command exited saying it had failed, having already
moved the roster that every untuned project loads. Everything is validated now before the first
thing is written, so a refusal leaves nothing behind.

The session-start rebuild swallowed its own errors. On a tree where a direct rebuild exits with an
error naming exactly what is missing, the automatic one exited cleanly and printed nothing. It is
the one path that runs unattended, so the first symptom was an agent behaving as though a rule did
not exist. It now says what it could not do, and still lets the session start, because failing the
session over a stale roster trades a missing rule for no session at all.

A public copy of the tool places the team and, deliberately, not the private handbook. Nothing
said so. Anyone running it got sixteen agents referring to a release protocol and a review process
as things that exist, with no way to know the handbook was never delivered. It now says which
documents are missing and what to do about it.

Two smaller ones: an installed team file that still contained an unexpanded placeholder instead of
the rule it names was reported as up to date, and a rebuild that failed partway left some files
new, some old, and the record of the build describing neither.

### A copy is not a sandbox

Copying the whole tree somewhere temporary, to try something without risk, did the opposite of
what it looks like. The configuration file travels with the copy and names the real projects
folder, so a rebuild run from the copy rebuilt the real projects. It was found the hard way, and
the only reason nothing broke is that the output happened to be identical, which is the worst
version of it: there was no signal either way.

A configured projects folder must now contain the script that is running. When it does not, the
copy uses its own parent instead and says loudly that it is a copy and why. Being told is the
point. Somebody in that position believes they are sandboxed, and the whole problem is that they
are not.

### Checks that have been watched failing, and one that had not

Forty-eight new checks and twenty-nine deliberate breakages, each run to confirm a check goes red
rather than assuming it. That is measured from the suite totals and the mutation logs, not
remembered: an earlier draft of this section said twenty-six and named no source.

The count matters less than what the breakages found. Three of them found the check itself was
faulty, against the person who had just written it. And an independent reviewer, doing the same
thing from the other side, deleted one of the new guards and the whole suite stayed green: that
guard sits on a path that pulls before it installs, and no test covered it. It is covered now. The
honest version of this release note is that most of these were proven and one of them was not, and
the only reason anybody can say which is that somebody tried to break each one.

A new check read as green over a clean tree and stayed green when the scan it guards was
deliberately narrowed, because the comparison it used ignored capital letters and was satisfied by
the word "clean" in the all-clear message. It could not have failed. Only a deliberate break
revealed it.

A test written to prove a value could not break out of a page's data block also could not fail:
no such value ever reaches that block. It was replaced with the property that is true and worth
defending, which goes red the moment anyone changes that.

And two invisible control characters were written into the test file itself by a patch script, in
an evening whose whole subject was control characters. A regex silently became two backspaces, the
assertion matched nothing, and it read as a defect in the code under test. The test file is now
checked for them too, which it never was: the tool had that guard, the published files had it, and
the tests had only themselves.

### Smaller things in the same release

A rule for how a public note describes a security fix: say what it now protects, not what was
wrong with it. Anyone reading about a fix may still be running the version being described, so the
reproduction detail is a working instruction handed to them. The note stays true and checkable;
only the recipe is withheld. Both the writer and the reviewer carry it, and the reviewer's copy
says explicitly that this is not permission to be vague, because withholding the mechanism and
withholding the truth are one sentence apart.

The releases page now declares structured data, so a search engine can read it as the ordered list
of releases it actually is. Each release already had its own address and its own machine-readable
date; that was checked before anything was changed, and two of the three gaps originally recorded
turned out to have been closed already.

The organisation chart said a band of fourteen roles was leadership when five of them are. It now
labels each group as what it is.

Two tickets were closed by measuring rather than by working: a corrupted shared document had
already been repaired, and a fresh copy of the repository already passed its own tests. Both were
verified against the thing itself instead of the write-up, which is the standing rule here, and
both turned out to describe a state that no longer existed.

The second of those two was then closed against the wrong copy. The check was run on our own
repository rather than on the one you would actually download, and those are not the same place:
the download had never carried the file that fixes it. Nothing was broken by this, and that was
measured rather than assumed before saying so. What was not true is that the copy you receive
matches the copy that was tested, and that is the whole reason the rule exists. The download
carries it now, and a check refuses to publish without it.

## 2026-08-20

**What this gives you.**
- **A defined intake path for anything you say.** Captured before work begins and before the reply, inherited by all sixteen roles instead of the nine that happened to carry it.
- **A required acknowledgement back to you**, carrying the reference, its queue, what it is blocked behind and when it starts. A receipt, not a promise.
- **Coverage on the dry run of the one irreversible operation**, so a preview cannot execute for real or under-report what it will commit.

### The rule about writing things down did not cover the way the founder actually works

The studio has always said work arrives as a ticket. Read closely, that rule described work
arriving from the board by way of the tech lead, which is not how a founder operates: they say
something in conversation, an agent starts building, and the request exists nowhere but a
transcript.

The gap was measured rather than assumed, after a project was observed acting on things the
founder had said without a ticket. Nine of sixteen roles carried the ticket rule at all. The
line about the founder's words not being allowed to evaporate existed in one role. Nothing
anywhere said to raise the ticket before replying. So the project was not breaking a rule, it
was following one that did not reach the case.

Now: when the CEO speaks, the PM picks it up and raises the ticket, before the work and before
the reply. Whoever the founder happened to be addressing does not quietly absorb it. The work
already in flight then gets finished; the new ticket waits its turn, because dropping the
current piece is how a project ends up with several things at sixty per cent and nothing
shippable, and "stop everything" is rarely what was meant.

Two exceptions and no others: the founder says do it now, recorded as their call, or the PM
judges it genuinely part of the work in flight and says so out loud rather than deciding it
silently. Either way it still gets its own ticket. An exception changes what happens next; it
never changes whether the thing was written down. Work folded into another ticket because it
looked related is work nobody can find later.

The founder should never have to ask whether something was captured, so the PM confirms in one
line carrying four facts: the reference, where it landed, what it is waiting behind, and when it
will be picked up. A confirmation without a ticket number is not a confirmation, and neither is
"noted", which is indistinguishable from having been forgotten.

The rule is now in all sixteen role definitions, and eleven separate checks hold its clauses in
place, with a twelfth pinning the shared paragraph they all include, so a quiet reword of it
cannot pass unread. Pinning the sixteen role bodies as well is a separate open question, because
it would put a mandatory check on every ordinary wording change. A single check on one
phrase would have gone green after a rewrite that dropped the rest.

Both of those numbers are now counted by the test suite and compared against this paragraph. That
is not caution for its own sake. This one section published ten wrong numbers before the check
existed, and the cause never varied: the sentence was written from the last measurement rather
than from a run, then something was added and nobody re-counted. It happened inside the paragraph
warning against it. A number a person has to remember to update is a number that will be wrong,
so this one goes red instead.

### The preview of the only irreversible action had no test

`-Release -WhatIf` previews the one thing the studio does that cannot be taken back. A reviewer
deleted its guard so the preview fell through and pushed to the public remote for real, and the
whole suite stayed green. Then reintroduced an older defect where a preview staged forty-six
paths in the real repository, including an untracked file that had nothing to do with the
studio. Also green.

No fixture had ever run `git init`, so the branch could not execute in a test at all. It now
can, and both of those mutations fail loudly.

The health check also had a headline that named one cause for four faults: a file with an
unresolved marker in its header was reported as beginning with a byte order mark, and the remedy
told the reader to strip a mark that was not there. Worse, the check written to catch that
could never fire, because the headline and the detail sit on different lines and the pattern
could not cross one. It passed on every run while the tool printed the wrong diagnosis.

## 2026-08-18

**What this gives you.**
- **Rule inheritance across the roster.** A shared rule is defined once and inherited at compose time. One edit instead of eleven, and a missing rule fails the build rather than composing an agent with a hole in it.
- **Your ideas get pressure-tested before anyone builds them.** Six leads challenge a new idea from their own disciplines and can come back with a no. You find out an idea is weak at the cheapest possible moment, rather than after you have paid for it.
- **A safe mode for automated runs**, refusing writes to live projects by default. Documented intent is not an access control; this is.

### One rule, written once, and the four ways that nearly went wrong

The advocacy for this was that a rule belonging to every role was copied into every role by
hand. Change one rule, edit eleven files, and the eleventh is the one that gets missed. So a
shared rule now lives once in `base/fragments/<name>.md` and a role pulls it in with
`{{include: name}}`. Four exist: the ticket rule that nine roles carried verbatim, the advocacy
tail described below, a brevity
rule, and the front door described below.

A missing fragment refuses to build. It does not warn and it does not leave the marker in
place, because a role that silently loses a rule is indistinguishable from one that never had
it, and that is the byte order mark failure wearing a new costume.

**The measurement that said this was already done was wrong, and it was ours.** Partway through,
the roster was measured for leftover duplication and reported clean: no role contained the word
"advocacy", and no byte-identical paragraph of sixty characters or more remained anywhere. The
state document had said eleven of sixteen roles carried an advocacy block, so that number was
corrected to zero, in this changelog and in the state document, citing the rule that a claim is
not evidence.

The original number was right. Eleven of sixteen roles do carry it, and nine share two hundred
and forty-six byte-identical characters. The measurement compared whole PARAGRAPHS, and each role
opens the block in its own words -- "Advocacy: Fight for correctness and maintainability",
"Fight for reach and a launch that lands" -- so no two paragraphs ever matched while the tail
of every one of them was the same sentence. A tool was written, it ran, it produced a number,
and the number was an artefact of where the comparison happened to cut.

That tail is now a fragment and the nine roles include it. Two roles carrying a differently
worded advocacy section are deliberately left alone, because they are not copies.

The rule this breaks is the studio's own, and it is worth stating rather than quietly fixing:
**a measurement is only as good as the boundary it measures across, and a measurement that
overturns a written record deserves more scepticism than the record, not less.** A correct
number was replaced with an incorrect one, in a file that publishes, by a process that
announced it was being rigorous.

**More than twenty defects were found in this, and almost none by the person who wrote it.**
The worst was not about fragments at all. `Get-Content -Raw` decodes a file with no byte order
mark using the ANSI code page rather than UTF-8, so reading a role and writing it back mangles
every non-ASCII character, and mangles the mangling on the next pass. An em dash went from
eight bytes to eighteen in one round trip. The old code escaped this only because it copied
files rather than reading them. It reached every composed agent, not just the new ones, and the
symptom was that syncing never finished converging: three roles changed on every run, changed
by the sync itself.

The other three worth naming. The export would have published sixteen role files each
containing a literal marker and no fragments folder, while the leak scan reported clean
throughout, because that scanner looks for credentials and not for whether a file makes sense.
The report that lists which projects are out of date compared an expanded install against an
unexpanded source, so every role would have shown as stale forever and no amount of syncing
could satisfy it. And the health check died on the exact condition its own new section exists
to report: a missing fragment threw several sections before the line that would have named it,
taking the rest of the report with it. It had only ever been watched working against an empty
install, which is the one state no real machine is ever in.

### A front door, and the right to say no

The squad built whatever it was asked to build. That is the failure this closes. A new idea now
goes through `/assess` before anything is built: six leads, one paragraph each, strictly inside
their own discipline, and the answer is allowed to be no.

Three things are recorded on the ticket at the kill point: the verdict, the measure it is
supposed to move, and the objections including the ones that lost. The third is the one people
skip and the one that pays, because without it a killed idea returns in three weeks and the
argument starts from nothing.

A kill counts as the gate working. If nothing is ever killed at the front door then the door is
a formality, and everyone works out that it can be walked past.

### An instruction is not a control

A subagent explicitly told not to touch live projects composed one anyway. Nothing was lost,
because generated agents are rebuilt from scratch and the project's own overlays were untouched,
and the health check caught it by reporting that one project was stale for a different number of
roles than the others. But writing it down had already failed.

`STUDIO_SAFE=1` in the environment now makes every writer refuse: composing, tuning, connecting,
both installers, governance, update, publish and release. Automated runs set it.

Two other guards were failing open rather than closed. A project name was resolved with wildcard
matching, so `_STUDI[O]` matched the studio, walked past a guard comparing exact paths, reported
success and created a phantom folder. And composition, tuning and connect tested the studio's
exact path while discovery had always excluded its whole subtree, so a folder inside the studio
could still be composed and connected.

Killing any of the eight guards turns the test suite red, measured two ways: neutering the
condition so the guard never fires, and leaving the condition intact while replacing the
refusal with a message. Eight of eight under each.

What that does and does not establish, because the difference is the whole point. Six are
caught behaviourally: the command is run and observed to refuse. Two are caught only by a
check that reads the script and confirms the guard is still written there, because every route
into them refuses at an earlier guard first and no test reaches them alone. Presence is not
behaviour. Those two are guarded and watched, not proved.

Five of the eight also have the other half, a positive control that watches the same command
still work when the switch is off. Three do not: the skills installer, the governance sync and
update. A guard proved only by its refusal could refuse everything and still pass.

That sentence was published with the two numbers the wrong way round, in the paragraph directly
above the one saying a number here is expected to come from a run rather than a recollection.
It was written from the previous round's measurement and was stale before the ink dried, because
the release preview gained its positive control in the same afternoon's work.

This paragraph has now been wrong six times, in both directions, and each correction was
written from the last measurement rather than a fresh one. The sixth was found by a reviewer
noticing that the test file says, in its own comments, that the structural check cannot prove
a guard works, while this section said proved.

The number is stated because it was wrong four times, in both directions. Early versions of
these checks passed while four guards could be deleted silently, then while any could be
replaced by a comment that merely mentioned the variable, then while a guard could be inverted.
Each time the claim written here was "every guard is proved" and a different reviewer disproved
it by trying. The correction after that one under-claimed instead, saying six of eight, which
was equally unmeasured. A number in this file is now expected to come from a run, not from a
recollection of the last run.

## 2026-08-17

**What this gives you.**
- **A concurrency limit**, two large items and three small. Ideas arrive faster than anything finishes; without a ceiling the squad context-switches across five threads and completes none. At the limit you get the count and a question, not silent queueing.
- **Guaranteed capture of anything you say.** Everything gets written down. Not everything gets started.
- **A self-assessment each session**, read by the next before it plans, so standards slipping is visible from the centre.
- **The health check now covers the studio itself**, which had been the one thing it never looked at, so a problem in the place that owns the rules is now as visible as a problem anywhere else.
- **Each project can now reach only its own data**, so one project's credentials are worth nothing anywhere else.

### The gates were run against the studio's own work, and stopped it

Three review agents were pointed at code and copy published earlier the same day. None of it
had been independently reviewed, which is the thing the method exists to prevent, so the run
was as much a test of the gates as of the work. They found one critical each and did not sign
it off.

**A name check is not a key check.** The board CLI refused to start if a variable called
`SUPABASE_SERVICE_KEY` existed. It never looked at what was actually inside `SUPABASE_ANON_KEY`.
Paste the service-role key into the publishable slot, which sits next to it on the same
dashboard page the setup guide sends you to, and every control in the toolchain passed while
every request ran with a credential that bypasses row-level security across every project on
the shared backend. Worse, the deploy step substitutes that value into the page and publishes
it, so the end state was a service-role key on a public URL. All three programs now decode the
key and assert its role claim, and refuse anything that is not publishable. Proved by pasting a
service-role key in and watching each one refuse.

**A migration that fails after it has already destroyed something.** The schema drops a column,
then adds a status constraint that omits a legacy value the page and the CLI both still map. On
a board carrying that value the run stops with the table already altered, and the error reads
as a schema bug rather than a data mismatch. That is the same failure recorded a week earlier
for a different column, in the same file, fixed there and left standing here. The values are
now normalised before the constraint is added.

**Per-project assignees shipped in two of the three places that needed them.** The schema and
the command line read the project's own list; the page kept a hardcoded one, never fetched the
column, and stamped a name from another studio onto every ticket it created. Any board
declaring its own vocabulary would have had every ticket creation refused by the very trigger
that was added to help it. The page now reads the list from the board.

**An elevated trigger answering for boards you are not a member of.** The assignee check ran
with definer rights and fired before the row-level security check, so naming any project id
returned that board's permitted names in the error message, and a removed member kept the
read. It does not need the elevation and no longer has it.

**And the ignore rule that three documents promised did not exist.** The fragment every project
is told to paste covers `.env` and `.env.*`. It does not match `.board.env`, which is the file
the board setup tells you to create, holding a live bot password. Untracked but not ignored is
one command away from permanent. Fixed in the fragment, in the reference directory, and in this
repository, which turned out to carry no secret rules at all while shipping them to everyone
else. The credential scanner also gained patterns for the current secret-key format and for the
board password it exists to protect.

**What the exercise says about the method.** Every one of these was found by pointing an agent
at work with instructions to disbelieve it, and three of them are recurrences of lessons already
written down here. A rule in a file does not stop the same mistake; a reviewer who did not write
the code does. The gates were also caught skipping their own standard: the credential check
shipped with no sample and no self-test five days after the studio decided that every check must
prove it fires.


### Two large things at once, and nothing said out loud is allowed to evaporate

**The problem.** Two failures, and they feed each other.

An idea raised in conversation is the easiest thing in the world to lose. Everyone is mid-task
when it is said, it sounds like thinking aloud rather than a request, and nobody writes it
down. Weeks later it resurfaces and nobody can say whether it was rejected, forgotten, or
quietly done already. An idea that was never recorded is indistinguishable from one that was
never had.

Meanwhile the work that did get started accumulates. Nothing in the method ever said no, or
even said "there are already four of these". Silently accepting more is the cheapest thing an
agent can do in the moment and the most expensive over a month: it produces several features
at sixty per cent, none of which can ship, each decaying while it waits.

**What changed. A ceiling, stated out loud.** Two large items in progress and three small ones,
where large means more than one session of work or work crossing more than one discipline.
It is a ceiling rather than a target. When the board is at it and more arrives, the product
manager and the tech lead now say so with the count, name what is already running, and ask what
gets parked. Going over is a legitimate call and it is the founder's to make knowingly, recorded
on the ticket with the reason. What is no longer available is absorbing it in silence.

**Everything raised becomes a ticket or a backlog row before the conversation moves on**, even
when the answer is no. "Not now" is a backlog row, and a backlog row is a decision that
something is not next.

**And everything that starts, ends explicitly.** No ticket is left in progress at the end of a
session without its real state written into it: what is done, what is not, what the next
session picks up. Finished, parked with a reason, and killed are all endings. Going quiet is
not, and a ticket that has been in progress across three sessions is not in progress, it is
abandoned with the light left on.

Both are now scored at wind-down, because a rule that only lives in a role file is a rule
nobody can audit.

### Every session now scores itself, and the score is the first thing the next one reads

**The problem.** A method is only followed while somebody is checking, and nothing was
checking. The studio could be immaculate on every measure it had, and every measure it had
reported on artefacts rather than on behaviour: files present, rosters composed, documents
current. None of them could tell you whether the way of working had actually been followed.

**What changed.** `/wind-down` now closes a session by scoring it against eight standing
checks and writing the result into `WARM_START.md`. Because that file is imported by
`CLAUDE.md`, the next session reads it on the way in without any hook having to fire, which
matters given the one hook this studio has has never been observed firing.

The checks are chosen because each leaves evidence: whether every role was actually
dispatchable, whether anything shipped that broke, whether any check ran with nothing to act
on, whether a check was added and never watched fail, whether work happened off the board,
whether anything reached acceptance without test notes or was called done without a measure,
and whether the project's own records are somewhere durable.

**It is reported as two numbers rather than a percentage: gaps open, and gaps with no owner.**
A target of a hundred percent makes people stop measuring, because falling short creates work
and the sessions that break a rule are the least likely to volunteer it. It also treats every
gap as a failure when some are deliberate, which is what the deviation register exists for. An
owned gap with a review date is a plan. An unowned one is the defect.

**The first score is three gaps, and they are left visible on purpose.** A balance count that
reported green twice while the thing it checked was structurally wrong. This new table itself,
which has been filled in exactly once by the session that wrote it, and which earns its place
only when it catches something nobody had already noticed. And a site shipped with no measure
agreed beforehand, eight days after the studio published the rule that nothing gets built
until someone can say how we will know it worked.

### The last outstanding lesson is routed, and the intake queue is empty

Data arriving from a third party does not match its own documentation: column names spelled
differently between releases, header rows in another case, rows that break the shape entirely.
Rejecting the file at parse time makes an import brittle in exactly the situation it exists
for. The data engineer now tolerates known variations through a named alias table that records
when each was first seen, keeps the safety nets downstream of the cleaner because a converter
can only absorb the anomalies somebody has already met, and treats defaults applied during
parsing as the specific trap: correct when creating a record, quietly destructive when
updating one.

Every lesson identified across the portfolio has now been written into the base and published.

### The site is five short pages instead of one long one

**The problem.** Everything lived on a single scrolling document behind a floating side rail.
That made every section compete with every other one, and it meant the whole site had one
title and one description, so a search result for any part of it described all of it.

**What changed.** Five real pages, each with its own address, title and description: the home
page, the problem, the solution, the product prototypes, and how to run it. A top bar
replaces the side rail, and collapses to a menu on a narrow screen with the repository link
pinned so it never scrolls out of reach.

The home page now opens by typing itself out, one character at a time, before anything else
appears. The layout is measured and held at its finished size first, so the page does not
shove itself around while the text arrives.

**The content moved as well as the furniture.** The problem page now states three problems
rather than one, because the framework had grown two more answers since it was written and
only ever described the oldest. Each carries what it actually cost. The solution page picks
those up, and the roster of sixteen roles moved onto it, since the page claimed sixteen
agents and never showed them while a separate page listed them and never said how they
worked.

**One thing the split broke, and the check caught it.** Leak-scan exemptions are scoped by
file name, and every one of them named `index.html`. Splitting the site into five files
silently invalidated all of them, and the publish refused with nine findings before anything
reached the internet. That is the check working exactly as intended, and it is a reminder
that an exemption list is a piece of configuration that goes stale like any other.

Links, canonicals and the sitemap all use the address the host actually serves. The host
rewrites `/problem.html` to `/problem`, so shipping the longer form meant every click paid for
a redirect and every canonical pointed at a URL that immediately moved.

The prototypes page links the products that are actually public, and labels the two that are
not rather than leaving them looking like an oversight.

### Six lessons from a product build, encoded into the roles that should have caught them

Contributed from a live project, each one written into the role responsible for it.

**The tech lead could not delegate.** Its description promised orchestration across the other
roles while its tool list contained no way to invoke one, so every project quietly fell back
to the main session doing the coordinating by hand. A description is not a capability.

**A test suite can certify a defect as safe.** A change arrived with tests whose names read as
guarantees, every one passing, none of them exercising the thing its name claimed. That is
worse than no suite, because it converts an unknown into a false assurance.

**A test that reads an ignored file passes by never running.** A conformance check opened a
reference file, returned early when it was absent, and asserted nothing on every run for its
entire life.

**A brand guide outside version control is not a source of truth.** It is routinely written
into a scratch directory that the repository ignores wholesale, which leaves the one artefact
every role aligns to living on a single machine with no history. Track the guide and the
document it is written from, and check how the exclusion is worded: an ignore rule naming a
directory stops the tool descending into it at all, so an exception written underneath is
never read.

**Defaults applied while parsing poison everything downstream.** An importer filled in sensible
values while reading each row, which is correct when creating a record and destructive when
updating one.

**Deleting copy can delete the element other code writes into.** A line removed as redundant
turned out to be the container several error handlers rendered into.

### The tool that inspects every project has started inspecting the one it lives in

`studio.ps1 -Doctor` reported on eight projects and said nothing at all about the studio. Its
discovery function skips any folder whose name starts with an underscore, and the studio is
called `_STUDIO`, so the guardian of the method was the single thing the method never looked
at. That exclusion was deliberate and is still right for everything that WRITES: whatever
discovery returns gets composed, synced and written into, and the studio must never be in that
list, because generating a private copy of the roster inside the project that owns the roster
is the exact fork the whole model exists to prevent.

The two ideas had been collapsed into one. They are now separate: the reports add the studio
back by name and tag it `studio`, and every path that COMPOSES still uses the old discovery,
which still excludes it. One writer is not yet covered and is named here rather than left to
be discovered: `-Connect -Project` aimed explicitly at the studio still resolves, and would
write a pointer block into the studio's own `CLAUDE.md` telling the reader to run a command
that now refuses. It is unreachable by default, because `-Connect` with no project uses the
same discovery as everything else. Composing or tuning the studio is refused outright, with the reason,
rather than quietly doing nothing.

The refusal tests the resolved path rather than the folder name. A name test is defeated by
renaming the folder, and the failure would be silent and bad: the studio would become a
project, and its `new-project\` folder, which carries a `CLAUDE.md` as the scaffold it is,
would be discovered as a further project that the next `-Sync` would write into.

Proved by diffing the full `-Doctor` report before and after against the real studio: the only
difference is the two new lines naming the studio. The change also ships the first automated
tests in this repository. They build a throwaway studio and two throwaway projects in a temp
folder, so they assert the same thing on any machine, and they were run against the old script
to watch fourteen of them fail before being trusted. One had to be rewritten after that run:
it looked for the words "never composed" anywhere in the section, which an unrelated line about
an uncomposed project satisfied, so it passed against a version of the tool that had none of
this in it.

---

## 2026-08-16

**What this gives you.**
- **A step that forces a project to look at what it earned, cost and attracted.** One project here took card payments for six weeks with nothing in its record about whether a single order landed.
- **A monthly check on every project's numbers, enforced centrally.** An owner can skip it, but the skip is recorded as their decision. Skipping is allowed. Saying nothing is not.

### A second skill, /reality-check, because nothing in this method ever made anyone look

**The problem.** A studio can be immaculate and still be several projects nobody has checked
the numbers for. Every document current, every roster composed, every deploy green, and no
idea whether any of it sells anything.

One project here took real card payments for six weeks. Every session in that period worked
on the top of the funnel: the journal, social posts, SEO, a video rotation. Its entire written
record was silent on whether a single order had been placed. Nobody was careless. Building is
pleasant and looking is not, and no step in the process ever forced the look.

The board tracks work inside a project. The wind-down records what a session learned. Nothing
asked whether the project was working.

**What changed.** `/reality-check` is the step that asks, and the discipline is the product
rather than any automation.

It takes the founder's **guess first**, before anything is opened. That costs thirty seconds
and converts a chore into calibration: someone who guessed forty orders and finds three has
learned something that someone who only reads three has not, and the size of that gap over
several readings says how well they understand their own product.

It names its sources **before** reading them, which is a cherry-picking guard, because after
you have seen the numbers it is very easy to decide which dashboard was the meaningful one.

It records six things and not a dashboard's worth: revenue, the denominator over the same
period, conversion, where the converting traffic came from, what the project costs per month,
and how much attention it consumed. The last two are what make it a founder's instrument
rather than a marketing report. Revenue alone says almost nothing; revenue against cost
against attention is the entire question.

**The founder chooses how the data arrives.** Automatically where a project already holds the
access, pasted from a dashboard, or simply spoken aloud. A figure read off a phone is a real
figure. What matters is that it is attributed and dated, never how it was fetched, and the
skill will not ask for a credential a project does not already have.

**It fails closed.** It will not invent a figure to complete a row, because a number nobody
sourced reads as evidence while being none. It refuses "up" and "growing" as results. It
records zero plainly, since most readings on most projects are zero and that is the
information. Everything unsourceable goes in a "Not known" line, which doubles as the list of
instruments the project does not yet have.

It states what the numbers imply and then stops. Deciding what to do is the founder's, needs
more than one reading, and a skill that hands down verdicts is a skill founders quietly stop
running.

**Declining is a legitimate answer, and it is recorded as one.** When a reading is overdue and
a build decision is being made anyway, the skill raises it once, before the decision rather
than after. If the founder says not now, that becomes a DEFERRED row with their reason, so the
gap shows in the trend instead of looking like a month nobody thought about. It is not raised
again that session, because a nagging check gets switched off. Two consecutive deferrals is a
different thing and gets a decision row, since running a project without knowing whether it
works may be perfectly deliberate, and deliberate decisions get written down.

**`-Doctor` gained a REALITY section** listing when each project was last read. On the first
run every single project reported "never", which is the correct answer and is precisely why
the section exists.

### You probably never needed to restart, and the advice to do so hid the real defect

**The problem.** This tool has told you to restart your session after every sync and compose,
and the method document made it step 5 of setting up a project. That advice was wrong often
enough to be worth correcting, and worse, it was absorbing a real failure.

A project once lost a role mid-session immediately after a sync. That was recorded as the
session dropping agents and failing to re-register them, and a guard warning before syncing
into active projects was proposed on the strength of it.

The likelier explanation is the byte order mark fixed yesterday. Compose was stamping one onto
every file it wrote, so the role was not dropped by the session; it was rewritten into a file
that could no longer be parsed. The agent that disappeared was the one that had just been
rewritten, which is precisely what a sync does and precisely what dropping would look like.

An explanation that fits the symptom is not the same as the cause, and this one was comfortable
enough to stop anybody measuring for weeks.

**What changed.** Agent files re-register live. Confirmed twice independently, once in the
studio's own session when thirteen repaired roles became available the moment the marks came
off, and once in a project session that re-measured its own bytes before agreeing.

So the tool now asks you to have the session name its roles rather than telling you to restart,
the method document says the same, and the proposed guard is cancelled rather than built.

**The rule underneath it.** Composed on disk and loaded in the session are different claims,
and only the second one matters. Every check the studio had was answering the first.

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

**What this gives you.**
- **A load check on every agent in your roster**, the set of sixteen each project runs. Thirteen had been failing to parse for weeks, in every project, while reporting as installed and current.
- **Presence is never accepted as proof of working**, so you cannot be shown a healthy roster that no session can load.

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

**What this gives you.**
- **Some data issues in the published repository fixed.**
- **Verified removal.** A correction is confirmed against the live source rather than reported complete and assumed.

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

**What this gives you.**
- **Self-testing credential scans.** Every pattern is asserted against a known-bad sample, and the publish refuses if any fails its own test.
- **The defects a first clean install finds, fixed at the source**, found by provisioning our own board from scratch, so the next project does not rediscover them. They are named below.
- **A quota check before provisioning.** Free-tier limits are account-wide, so one project cannot consume what the next one needed.
- **Deleting a ticket now hides it and keeps it**, and that protection holds however the data is reached, not only through the board's own screens.

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

**What this gives you.**
- **Five acceptance criteria before a review may pass an animated page**, so nothing is signed off because it happened to render on a fast machine.
- **Skipped checks reported as having proved nothing**, so you are never shown a green result that never ran.

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

**What this gives you.**
- **A shared multi-tenant backend.** Every project's board on one free instance, all visible in one place.
- **Row-level isolation at the database**, applied to the page, the command line and any direct API call alike.
- **Per-tenant ticket numbering**, so one project's sequence reveals nothing about another's volume.
- **Runnable proofs of that isolation, including the negative case**, so you can verify it rather than trust it.

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

**What this gives you.**
- **Direction-aware drift detection.** The tool now tells stale apart from locally-modified, so a project cannot overwrite an improvement that exists in only one place.
- **A default infrastructure standard**, so projects stop picking stacks independently. Every service in it is free until a project earns revenue.
- **A check that a project's state is actually loaded**, so history is not written to a file nothing imports.

### The public site moved to Cloudflare Pages, and now has HTTPS

**The problem.** The site had been served over plain HTTP for more than 47 hours because
GitHub Pages never issued a TLS certificate. Every check passed throughout: DNS resolved to
the right place, the record was unproxied, the `CNAME` file was present, the ACME challenge
path was reachable over HTTP and returned a clean 404 rather than a redirect, CAA permitted
the issuing authority, and GitHub's own health endpoint reported `is_valid: true` with no
error. The certificate state simply sat at `new`. The request had never started.

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
to reach for `-Force` reflexively, and a guard that is always overridden is not a guard.
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

**What changed.** `base/infra/INFRA_STANDARD.md` names a default, Next.js, Supabase,
Cloudflare Pages, chosen because nothing in it bills for existing, and because one auth
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

**What this gives you.**
- **Four checks before anything is committed**, so a project cannot put a secret into its history. Removing one afterwards is a rewrite, not a delete.
- **An atomic release.** One command, both repositories, one changelog entry, so they cannot disagree about what shipped.
- **Build and verification separated.** Nobody marks their own work ready, and test notes say what to expect.
- **Persisted session state**, so a project's history survives the session and you can resume it without interrogating it.

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

**What this gives you.**
- **Startup Studio, first release.** Sixteen specialist agents, one shared roster, composed per project. Engineering, design, content, marketing, operations, QA and review, all working from one board and one set of rules, so a solo founder runs a product team instead of a prompt.
- **A fixed board schema**, 8 statuses and 7 columns. Every agent is written against it, so a renamed column breaks the contract instead of quietly diverging.
- **Base-plus-overlay composition**, so a project overrides a role without forking the roster, and any improvement propagates to everyone.
- **A single intake path.** Work comes from a ticket, never from conversation.
- **A human approval gate.** No agent marks its own work ready, and nothing reaches production without your instruction.

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
