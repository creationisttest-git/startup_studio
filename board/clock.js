'use strict';

/*
 * clock.js -- ONE clock for everything written into a board directory.
 *
 * THE DEFECT THIS EXISTS FOR (ST-283). Two programs wrote into the same `.board/` and stamped
 * time in two different namespaces while producing the SAME TEXT SHAPE. board.js built its
 * stamp from toISOString(), which is UTC. doctor-record.js and run-checks.js built theirs from
 * getHours(), which is local. On the machine where it was found those are ten hours apart:
 * decision ST-240 d7 reads 11:06:22 and the commit carrying that decision reads 21:06:50+10:00.
 * Both files were correct on their own and the pair was broken, which is the failure mode that
 * costs the most to find, because every instrument reports clean.
 *
 * WHY THE SHAPE BEING IDENTICAL IS THE WHOLE PROBLEM. "2026-09-18 11:06:22" and
 * "2026-09-18 21:06:50" are both valid, both sort, and both look like an answer. Nothing on the
 * row says which clock produced it, so a reader cannot tell that two rows are in different
 * units, and the one thing a board directory exists for is letting a later session reconstruct
 * an order of events it did not witness. Two namespaces make that reconstruction wrong rather
 * than impossible, which is worse: it returns an answer.
 *
 * WHY UTC RATHER THAN LOCAL. A board crosses machines. It is committed to git, read by agents
 * dispatched elsewhere, compared against commit timestamps that carry their own offset, and
 * exported to a public repository that strangers clone in their own timezones. A local stamp is
 * only meaningful beside the machine that wrote it, and that machine is not part of the record.
 * The cost is real and is accepted: the founder reading a row at 21:06 local sees 11:06 here.
 * That cost is paid ONCE per reader, and it is paid visibly, because the stamp says Z.
 *
 * WHY THE STAMP CARRIES A VISIBLE MARKER. The obvious fix was to switch the two local writers to
 * UTC and leave the format alone. That would have silently reinterpreted every row already on
 * disk by ten hours with nothing saying so, which is a rewrite of history rather than a repair.
 * A trailing "Z" costs one character, is what ISO 8601 already means by it, keeps lexicographic
 * order identical to the bare form, and makes a row written before this change visibly different
 * from one written after. Old rows are LEFT EXACTLY AS THEY ARE and are ambiguous on purpose;
 * check-board-clock.js holds the count of them to a baseline so the ambiguity can only shrink.
 *
 * WHY IT IS A FILE AND NOT A RULE. base/board/board.js publishes as board/board.js and tools/
 * publishes as tools/, so this file publishes as board/clock.js and every writer can reach it in
 * both trees. A rule saying "use UTC" is what the three writers already believed they followed.
 *
 * Verified before it was relied on: Date.parse accepts the space-separated form with the marker.
 *   node -e "console.log(Date.parse('2026-09-18 22:30:06Z'))"   ->  1789770606000
 */

const MARKER = 'Z';

/* A stamp for right now, or for a supplied Date, in the one namespace.
 *
 * The supplied-Date argument is not decoration: it is the only way a test can drive this
 * function to a known instant, and a clock nobody can freeze is a clock nobody can assert on. */
function now (d) {
  const t = d || new Date();
  return t.toISOString().slice(0, 19).replace('T', ' ') + MARKER;
}

/* Milliseconds, or NaN. Accepts three things on purpose:
 *   1. the current form, "YYYY-MM-DD HH:MM:SSZ";
 *   2. a full ISO string with a T and an offset, which is what a git or transcript stamp is;
 *   3. THE LEGACY BARE FORM, "YYYY-MM-DD HH:MM:SS", which is read as UTC.
 *
 * Reading the bare form as UTC is a CHOICE and it is wrong for some of the rows on disk. Bare
 * rows written by board.js are UTC and bare rows written by the two tools are local, and by the
 * time a reader has the string in its hand the file it came from is gone. UTC is the reading
 * that is right for the majority of them and right for every row written from here on, and the
 * alternative, refusing to parse a legacy row at all, would break readers that work today over
 * history nobody can fix. The count of ambiguous rows is what shrinks, not their meaning. */
function parse (s) {
  if (typeof s !== 'string' || !s.trim()) return NaN;
  const raw = s.trim();
  const zoned = /[Zz]$|[+-]\d\d:?\d\d$/.test(raw);
  return Date.parse(raw.replace(' ', 'T') + (zoned ? '' : MARKER));
}

/* Does this stamp say which clock produced it? A bare stamp is legacy and answers false.
 * This is the predicate check-board-clock.js counts, so it lives beside the writer rather than
 * beside the check: the thing that decides what a good stamp looks like must be the thing that
 * writes one, or the two drift and the check starts grading a format nobody emits. */
function isMarked (s) {
  return typeof s === 'string' && /[Zz]$|[+-]\d\d:?\d\d$/.test(s.trim());
}

module.exports = { now, parse, isMarked, MARKER };
