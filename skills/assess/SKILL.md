---
name: assess
description: The front door. Run this when the CEO brings an idea, BEFORE anything is built. The leads assess it from their own disciplines, argue it, and return a verdict with a measure and the objections. "No" is a legitimate outcome and is the point of the exercise.
---

# assess

The front door for a new idea. Nothing gets built until it has been through here.

## Why this exists

The squad builds whatever it is asked to build. That is the failure. A founder who says
"let's add reviews" gets reviews, competently, on time, and nobody ever asked whether anyone
wanted reviews or how you would know if they worked.

The cost of that is not the wasted build. It is that the founder never finds out the idea was
weak, because a finished feature looks like a success until the numbers arrive months later,
and by then three more things have been built on top of it.

So: the leads interrogate the idea first, in one pass, and the answer is allowed to be no.

**A kill is a success for this skill.** If nothing is ever killed here, the skill is not
working, it is rubber-stamping. Report the kill rate when asked.

## When to run it

Any new feature, product, campaign or piece of infrastructure that is not already on the
board as agreed work. Bug fixes and work already assessed do not come back through.

Run it BEFORE the ticket goes to To Do, not after. Assessing something already half-built is
not assessment, it is looking for permission.

## Who attends

**The leads only.** `pm`, `tech-lead`, `design-lead`, `content-lead`, `marketing-lead`,
`operations-lead`. Six voices, one session.

Not the whole squad, deliberately. Sixteen roles assessing every idea is expensive enough
that it would be skipped within a fortnight, and a gate that gets skipped is worse than no
gate because it still appears in the documentation.

The leads carry their disciplines into the room and carry the verdict back out. **Once the
verdict is build, the leads own passing their view to the delivery squad**, so a builder gets
the brief already containing what marketing needs, what operations has to run, and what
design has committed to. The builder should never have to reconstruct the assessment.

## Step 1: state the idea in the founder's words

One paragraph, quoted, not paraphrased. Paraphrasing at this step is how an idea quietly
becomes a different, more sensible idea that nobody actually asked for, and the founder then
gets something they did not want and cannot say why.

If the idea is not clear enough to quote, that is the first finding. Ask.

## Step 2: each lead answers, in one paragraph

Each lead answers only within their own discipline. Nobody speculates outside it.

- **pm.** What problem does this solve, for whom, and what is already on the board that this
  displaces? Name the trade, because at a ceiling of two large items something else stops.
- **tech-lead.** What does this actually require, what does it depend on that does not exist
  yet, and what does it make harder later? Name the prerequisite that is not a real record in
  the data model, because that is the one that turns a two-day build into a two-week one.
- **design-lead.** Does this fit the product someone already understands, or does it add a
  concept the user now has to learn? A feature that needs explaining is a feature that needs
  a reason.
- **content-lead.** Can this be named and explained in the product without a paragraph? If
  the microcopy cannot be written, the concept is not finished.
- **marketing-lead.** Who is this for, and what would make them care? "Everyone" is not an
  answer. If nobody would change their behaviour on hearing about it, say so.
- **operations-lead.** Who runs this after it ships, how often, and what happens when it goes
  wrong at 2am? Anything that quietly becomes a daily manual task is a cost nobody costed.

**Say the objection even when the CEO clearly wants it.** A lead who agrees with everything is
not adding a discipline, and the founder is paying for six views precisely because their own is
one. The objections are recorded whether or not they win.

## Step 3: the measure, agreed before the build

**What is this supposed to improve, and how would we know?** One measure, named, with the
number it is at today if that number is known.

If nobody can name a measure, that is the strongest possible signal to kill. It means nobody
can describe what success looks like, and a thing that cannot fail cannot succeed either.

"We do not have that instrument yet" is a valid answer and becomes part of the build: the
measure ships with the feature or the feature ships blind. It has shipped blind before, which
is why this step exists.

## Step 4: the kill point

The leads return exactly one of:

- **BUILD**, with the measure, and the brief for the delivery squad.
- **KILL**, with the reason. The ticket is closed as killed, not left in Backlog to be
  rediscovered and re-argued in six weeks.
- **PARK**, with the specific thing that would change the answer. "Park until we have a
  hundred users" is a park. "Park for now" is a loose end wearing a label.

**This is the last cheap moment.** After this the answer costs a build. Take it seriously
here or do not take it at all.

**A split decision goes to the CEO as a numbered choice**, not as a discussion: the options,
a recommendation, and an explicit "something else". The leads do the analysis; the founder
makes the call from a shortlist.

## Step 5: write it to the ticket

Three things, on the ticket, always:

1. **The verdict** and who gave it.
2. **The measure** it is expected to move.
3. **The objections**, including the ones that lost.

The third is the one people skip and the one that pays. Without it, a killed idea comes back
in three weeks and the argument starts from zero, because nobody can remember whether it was
rejected on principle or on timing. With it, the answer is one click away and usually still
correct.

If the project runs a board, this goes on the ticket, not in chat. Chat is not searchable in
February.

## Step 6: report, and stop

```
ASSESSED: <the idea, in the founder's words>
VERDICT:  BUILD | KILL | PARK
MEASURE:  <what it must move, and from what>
OBJECTIONS RAISED: <n>, <n> unresolved
TICKET:   <ref>
```

Then stop. If the verdict is BUILD, the PM takes it to the board. Do not start building inside
this skill: the assessment and the build are separate on purpose, and the gap between them is
where a founder gets to change their mind for free.
