## A release note is 200 words or fewer, and it is about value, not mechanism

**Two hundred words is the cap on a release note.** Above that you need the CEO's approval
BEFORE you write it, not after. The cap covers a whole dated section, headings included. Count it
rather than guessing: `node <studio>/tools/check-release-note.js --dir <project>`. What that
command does is documented where it is written, not here.

**Write what the change gives the person using it.** Objective, in their terms: what they can now
do, or what has stopped happening to them. Not what you built, not how it works, not which files
moved. Somebody reading a release note is deciding whether to care, and they cannot judge a
mechanism they have never seen.

**Do not describe what an instrument catches.** A check is almost always narrower than any short
description of it, so a summary broader than the code is false, and most summaries are broader
than the code. If the value is real it can be stated without naming the mechanism at all.

**Let somebody who did not write the sentence be its last reader.** An error that makes the work
sound weaker costs something to write and gets caught in drafting. An error that makes it sound
stronger reads as the sentence you meant, so it survives its author however carefully they look.

**The CEO set this on 2026-09-19, after one paragraph of one release note was rewritten again and
again and falsified again and again, always in the direction that flattered the work.** The
account, with the counts, is in the header of `check-release-note.js`, read when somebody goes
looking rather than charged on every request. A count belongs where it can be corrected without
republishing this file.
