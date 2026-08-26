# Changelog

What changed and why, written for someone who did not build it.

Newest first. Dates are when the change went public.

---

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
