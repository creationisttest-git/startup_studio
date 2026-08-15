---
name: reality-check
description: Read what the project actually earned, cost and attracted, and write it down with its source and read date. Use before any roadmap or significant build decision, at least monthly, and whenever someone claims traction. Also use when a project's last reading is overdue.
---

# Reality check

Find out whether the thing is working, record it so nobody has to ask again, and stop.

This is not an analytics report. It is the step that makes a founder look, on a schedule,
before deciding what to build next.

---

## The failure this exists to prevent

A project took real card payments for six weeks. Every session in that period worked on the
top of the funnel: the journal, social, SEO, a video rotation. Nothing in its entire record
said whether it had sold anything.

That was not an oversight by careless people. It is the default. Building is pleasant, looking
is not, and no step in the process ever forced the look. So this is the step.

**Zero is a result.** Most readings on most projects will be zero or near it, and that is the
information. A skill that feels like bad news will not be run twice, so report zero plainly
and without commiserating.

---

## Step 1: write the guess down first

Before opening anything, ask the founder what they expect each number to be. Record their
answer.

This costs thirty seconds and it is the highest-value part of the whole skill. It turns
data-gathering into calibration. A founder who guessed forty orders and finds three has
learned something; a founder who only reads three has not. Over several readings the size of
that gap tells them how well they understand their own product, which is worth more than any
single figure.

If they will not guess, record "declined to guess" and carry on. Do not argue about it.

---

## Step 2: name the sources before you read them

Write down which source will answer which question, in advance, before any of them is opened.

This is a cherry-picking guard. Once you have seen the numbers it becomes very easy to decide
that the flattering dashboard was the meaningful one all along.

---

## Step 3: get the numbers, however the founder prefers

**The founder chooses how the data arrives. You do not insist on a method.** Three ways, all
equally valid:

- **Automatic.** The project has a CLI, an API key already in its environment, or an export
  you can read. Use it. Never ask for a credential the project does not already hold, and
  never write one down.
- **Pasted.** They paste a dashboard screenshot's figures, a CSV, or a report.
- **Spoken.** They simply tell you the numbers.

A figure a founder read aloud from their phone is a real figure. What matters is not how it
arrived but that it is **attributed and dated**, so a later reading is comparable and a stale
one is visibly stale.

Whichever way it arrives, record for each figure: the source by name, the exact period it
covers, and the date it was read. When you queried something yourself, record the query or the
report you ran, because a number nobody can reproduce is an anecdote.

### What to get

| | |
|---|---|
| **Revenue** | gross, net, and the count of orders or subscriptions |
| **Denominator** | sessions or visitors over the **same** period |
| **Conversion** | the two above, divided |
| **Origin** | top three sources of the traffic that **converted**, not of traffic in general |
| **Cost** | what the project actually bills per month, today |
| **Attention** | sessions or hours spent on it during the period |

The last two are what make this a founder's tool rather than a marketing report. Revenue on
its own says almost nothing. Revenue against cost against attention is the whole question.

If the project has no way to take money yet, say so explicitly and record the single most
meaningful leading indicator instead. Silence is not an acceptable output.

---

## Step 4: refuse to fill a gap you cannot source

Fail closed. This whole skill is worthless if its output cannot be trusted.

**Never invent, estimate or round a figure to complete a row.** An open row that is visibly
open beats a guessed one. A number nobody sourced reads as evidence while being none, which is
worse than an admitted blank. One project deliberately left its cost ceiling empty for exactly
this reason, on the grounds that a ceiling guessed from nothing constrains nothing while
looking like a control.

**Refuse directions in place of numbers.** "Up", "growing", "a few", "steady" are not results.
Ask again, once. If the number does not exist, record that it does not exist.

**Do not accept vanity metrics as the answer.** Impressions, followers and pageviews may be
recorded as context. They are never the reading.

Everything you could not source goes in a "Not known" line with the reason. That line is a
feature. It is the list of instruments this project does not yet have.

---

## Step 5: write it down

**Append one row to the Reality table in `WAYS_OF_WORKING.md`.** Create the table if it is not
there. Append only, never edit an earlier row, exactly like the decisions table. The point is
that the trend becomes visible without anyone maintaining a chart.

```
| Read | Period | Revenue | Orders | Sessions | Conv | Cost/mo | Attention | Source | Note |
```

**Update `WARM_START.md` with the latest reading only**, plus what it implies. Current state
belongs there; the history belongs in the table.

---

## Step 6: say what it implies, and stop

Report exactly this:

```
REALITY CHECK -- <project> -- read <date>, covering <period>

Guessed:   <what the founder predicted>
Actual:    <what the numbers say>
Gap:       <the interesting part>

Revenue    <gross / net / count>       source: <named>
Sessions   <n>                         source: <named>
Conversion <%>
Origin     <top 3 converting sources>
Cost       <per month>
Attention  <sessions or hours in period>

What this implies: <one paragraph>
Not known:         <what could not be sourced, and why>
```

**State what the numbers imply. Do not decide what to do about it.** Whether a project
continues, changes direction or stops is the founder's, and it needs more than one reading.
A skill that delivers verdicts is a skill founders stop running.

---

## When a reading is overdue

The default cadence is 30 days. A project may set its own in `WAYS_OF_WORKING.md`.

When a project is past its cadence and a roadmap or significant build decision is being made,
**stop and put it to the founder before the decision is made, not after.** Say how long it has
been and what is about to be decided without evidence.

They may decline, and that is a legitimate answer. If they do:

- Append a row to the Reality table with the period, `DEFERRED`, and the reason in their own
  words. The gap then shows in the trend rather than looking like a month nobody thought
  about.
- Do not raise it again in that session. Once is asking; twice is nagging, and a nagging
  check gets switched off.
- Ask again at the next checkpoint.

**Two consecutive deferrals is different, and gets a row in the decisions table.** At that
point it is no longer a scheduling matter. It is a decision to run the project without knowing
whether it works, which may be entirely deliberate, and deliberate decisions get recorded with
their reasoning like every other one.

---

## What not to do

**Do not ask for credentials the project does not already hold**, and never write one into any
document. If automatic reading needs a secret that is not already there, use one of the other
two methods instead.

**Do not turn this into a dashboard.** No charts, no projections, no forecasts. Six numbers, a
source for each, and a date.

**Do not soften a bad reading.** No encouragement, no context about how early it is, no
comparison to a benchmark nobody chose. The founder can draw their own conclusions from a
plain number and cannot from a padded one.

**Do not run this instead of shipping.** It is a short interruption on a schedule, not a
workstream. If it takes more than a few minutes the project is missing instruments, and that
is a finding for the "Not known" line, not a reason to keep going.
