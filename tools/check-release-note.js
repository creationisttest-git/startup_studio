#!/usr/bin/env node
'use strict';

/*
 * check-release-note.js -- the newest release note is under 200 words, or the CEO approved it first.
 *
 * WHY THIS EXISTS, AND IT IS A RULE WITH ITS DEFECT ATTACHED. On 2026-09-19 the CEO read a
 * sitting that had spent three full code-review rounds on ONE paragraph of a release note and
 * said, in their own words: "A release note should not have more than 200 words. If it is
 * anything more than that get my approval before. Keep the release note objective and explain the
 * feature and why it is valuable to the human. No need to explain the mechanism, only focus on
 * the value." Then: "They should be part of the doctor and they should be a rule going forward",
 * and "This goes for other projects as well".
 *
 * THE DEFECT THE CAP IS ACTUALLY FOR. That note ran to 708 words, almost all of it mechanism.
 * Every single false statement the review rounds found was a MECHANISM claim: a sentence
 * describing what a new check CATCHES. THE FINAL COUNT FOR THAT SITTING, which this header
 * carried as three and two until the sitting ended: one such sentence was written FIVE times and
 * FOUR were false, every one in the direction that made the check sound stronger. No version was
 * caught by its author, and two of the four were written while actively hunting that exact fault.
 * Each was falsified by a reviewer PLANTING a case, never by reading, because reading the
 * sentence agrees with it. That is S240. A note that carries no mechanism cannot carry a false
 * mechanism, so the cap is not a style preference: it removes the surface the defect lives on.
 *
 * THE COUNTS LIVE HERE RATHER THAN IN THE FRAGMENT because this file is read on demand and the
 * fragment is composed into five roles and re-sent on every request. A number that keeps moving
 * belongs where correcting it is cheap. The fragment's own third paragraph forbids describing
 * what an instrument catches, and it described this one until 2026-09-19; that sentence is now
 * deleted rather than narrowed a sixth time.
 *
 * WHY A WORD COUNT AND NOT A CONTENT CHECK. Whether a sentence is "about value" is not decidable
 * by a program, and a check that guesses would be worse than none. A word count is exact, it is
 * the thing the CEO actually said, and it is strongly correlated with the failure: you cannot fit
 * 700 words about a release without describing how it works. The content half of the rule lives
 * in base/fragments/release-notes-are-short-and-about-value.md, which composes into the doctor
 * and four other roles, and the doctor reads the note itself.
 *
 * THE ESCAPE, AND WHY IT IS SHAPED THIS WAY (S232). A refusal that names no way out gets the
 * predicate weakened instead, so this one has a written-reason escape: the CEO's approval, keyed
 * to the exact section date, in release-note-waivers.json BESIDE THE CHANGELOG IT EXCUSES. It is PRINTED ON
 * EVERY RUN rather than swallowed, so a reader always sees what was waived and why. A waiver
 * whose date no longer appears in the changelog is reported STALE and still fails, because a list
 * of excuses that outlives what it excused is how the cap quietly stops applying.
 *
 * EXIT CODES. 0 fine. 1 the newest note is over the cap with no approval, or a waiver is stale.
 * 2 usage. 3 there is no changelog here, which is not a fault: a project that has never released
 * is not reported red for it, the same placement board-clock needed.
 */

const fs = require('fs');
const path = require('path');

const CAP = 200;

/*
 * H1, found by the product reviewer on 2026-09-19 against a REAL sibling changelog. This required
 * the date to be the WHOLE heading. A sibling project writes "## 2026-09-18 <title>", so 68 of
 * its 98 sections were absorbed into the section above and the tool reported on a note nobody was
 * writing. The first version of the test PINNED that behaviour as correct, which is why reading
 * the code could never have found it: the assertion agreed with the defect.
 */
const DATE_HEADING = /^## (\d{4}-\d{2}-\d{2})\b/;

/*
 * H5. The subject is chosen with --dir and can be any project; the waiver file used to be only
 * the studio's own, so one approval excused every project's note of that date, and a waiver
 * written for another project reported STALE here and refused. Waivers now sit BESIDE the
 * changelog they excuse, which is the only place a maintainer of that project can reach, with the
 * studio's own file used when the subject IS the studio.
 */
function waiverPathFor (changelogFile) {
  return path.join(path.dirname(changelogFile), 'release-note-waivers.json');
}

/*
 * H8. THE PARENT FALLBACK IS KEPT AND IS NOW ANNOUNCED. Pointing --dir at a directory with no
 * changelog silently measured the PARENT's, and the PASSING line named no file while only the
 * FAILING line did, so the misdirection was invisible in the only direction that matters: a
 * maintainer whose note was never checked read "cap 200" and believed it. Two nested projects
 * exist in this studio today, so the fallback is load-bearing and removing it would break them.
 * It now says which file it landed on, every run, pass or fail. Found by the fourth content gate
 * reading on 2026-09-19 by running --dir at base/, which reported the studio's own note.
 */
function findChangelog (startDir) {
  // --dir at a FILE made the fallback name the same path twice, once as the directory that held
  // no changelog and once as the changelog it found above it. Harmless and unreadable, which is
  // the combination that gets a message ignored the day it matters.
  try {
    if (fs.statSync(startDir).isFile()) {
      return { file: path.resolve(startDir), fromParent: false, wasFile: true };
    }
  } catch (e) { /* no such path; the existsSync checks below report it in the usual words */ }
  const here = path.join(startDir, 'CHANGELOG.md');
  if (fs.existsSync(here)) return { file: path.resolve(here), fromParent: false };
  const up = path.join(startDir, '..', 'CHANGELOG.md');
  if (fs.existsSync(up)) return { file: path.resolve(up), fromParent: true };
  return null;
}

/*
 * A HEADING THAT LOOKS LIKE A DATE IS NOT ENOUGH, IT HAS TO BE ONE. `2026-13-45` matched the
 * pattern, sorted above every real date as a string, and so became the section under test: a
 * typo in one heading disarmed the cap for the whole file, and a 403-word note passed with
 * exit 0. Found by the content gate on 2026-09-19 by typing a bad date, not by reading.
 */
function isRealDate (s) {
  const p = s.split('-');
  const y = +p[0], mo = +p[1], d = +p[2];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const probe = new Date(Date.UTC(y, mo - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d;
}

/*
 * H7, AND IT IS S233 ON THE SAME FILE ON THE SAME DAY. isRealDate above was added because
 * `2026-13-45` sorted above every real date as a string and became the section under test, so a
 * typo disarmed the cap for the whole file. The repair was correct and complete on the axis it
 * was reported on, IMPOSSIBLE dates, and the same property sat untouched one axis over: a
 * mistyped YEAR is a perfectly valid date. `## 2027-01-01` wins the latest-date comparison just
 * as `2026-13-45` did, and a 305-word note below it passes with exit 0. Proved by fixture on
 * 2026-09-19, not by reading.
 *
 * THE TOLERANCE IS DELIBERATE AND IS ONE DAY. The changelog is written by a person whose clock
 * may be up to fourteen hours ahead of UTC, and refusing their honest "today" would be the
 * writer-and-reader clock disagreement this studio has now shipped twice. One day absorbs every
 * real timezone and still refuses a mistyped year, which is the whole population of this defect.
 *
 * --today EXISTS SO THIS IS TESTABLE. A check whose behaviour depends on the wall clock cannot be
 * proved by a fixture, and a control that cannot be watched failing is indistinguishable from one
 * that always passes.
 */
function isFutureDate (s, todayUtcMs) {
  const p = s.split('-');
  const at = Date.UTC(+p[0], +p[1] - 1, +p[2]);
  return at > todayUtcMs + 86400000;
}

/*
 * H6. A FENCED CODE BLOCK IS SHOWN TO A READER, NOT PUBLISHED AS A RELEASE. sections() had no
 * fence state, so a dated heading inside ``` counted as a real section: a note explaining a
 * changelog convention split in two, the tool asserted two releases where there is one, and the
 * excess escaped the cap. Proved with a 315-word section carrying a fenced "## 2026-09-19
 * example heading": the tool reported 163 words and exit 0, so 152 words walked past the cap.
 * A release note explaining this very convention is exactly the note that contains such a
 * heading, so this is the ordinary case and not a corner.
 *
 * THE CLOSING RULE IS THE HARD PART AND THE FIRST FIX GOT IT WRONG, WHICH IS THIS DEFECT
 * SURVIVING ONE AXIS OVER FOR THE SECOND TIME ON THIS FILE. That fix required a closer to be at
 * least as long as its opener and made of the same character, and stopped there. CommonMark also
 * forbids a CLOSING fence from carrying an info string, so a line like "```js" inside a block is
 * ordinary content and not a close. Treating it as a close ended the block early and put 165
 * words of a 337-word section back outside the cap, at exit 0. A product reviewer proved it by
 * planting the case on 2026-09-19, hours after the comment above was written naming that exact
 * lenient direction as the way back in.
 *
 * So a closer is: same character, at least as long, and NOTHING after it but whitespace. An
 * opener may carry an info string, except that a backtick opener's info string may not itself
 * contain a backtick, which is also CommonMark and is what stops "``` `` ```" opening a block.
 */
const FENCE = /^ {0,3}((`{3,})|(~{3,}))([^\n]*)$/;

function fenceParts (line) {
  const f = FENCE.exec(line);
  if (!f) return null;
  const run = f[2] || f[3];
  const rest = f[4] || '';
  return {
    run: run,
    char: run[0],
    len: run.length,
    closes: rest.trim() === '',
    // A backtick opener cannot have a backtick in its info string. A tilde one can.
    opens: run[0] === '~' || rest.indexOf('`') === -1,
  };
}

function sections (text, opts) {
  const todayUtcMs = (opts && opts.todayUtcMs !== undefined) ? opts.todayUtcMs : Date.now();
  const lines = text.split(/\r?\n/);
  const out = [];
  let cur = null;
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const f = fenceParts(lines[i]);
    if (f && !fence && f.opens) {
      fence = { char: f.char, len: f.len, run: f.run, line: i + 1 };
      if (cur) cur.body.push(lines[i]);
      continue;
    }
    if (f && fence && f.char === fence.char && f.len >= fence.len && f.closes) {
      fence = null;
      if (cur) cur.body.push(lines[i]);
      continue;
    }
    if (fence) {
      if (cur) cur.body.push(lines[i]);
      continue;
    }
    const m = DATE_HEADING.exec(lines[i]);
    if (m && !isRealDate(m[1])) {
      process.stdout.write('  note  line ' + (i + 1) + ' heading "' + m[1] + '" is not a real date, so it is not a release.\n');
      if (cur) cur.body.push(lines[i]);
      continue;
    }
    if (m && isFutureDate(m[1], todayUtcMs)) {
      process.stdout.write('  note  line ' + (i + 1) + ' heading "' + m[1] + '" is dated in the future, so it is not a release yet.\n');
      if (cur) cur.body.push(lines[i]);
      continue;
    }
    if (m) {
      if (cur) out.push(cur);
      cur = { date: m[1], line: i + 1, body: [lines[i]] };
    } else if (cur) {
      cur.body.push(lines[i]);
    }
  }
  if (cur) out.push(cur);
  /*
   * AN UNCLOSED FENCE IS A REFUSAL, NOT A NOTE, AND THE FIRST VERSION GOT THAT WRONG TOO. It
   * swallows every heading below it, so a changelog whose PREAMBLE opens a fence and never closes
   * it reports "holds no dated section" at exit 3. Exit 3 is registered advisory, so the release
   * gate reads green while an over-cap note sits in the file unmeasured. A product reviewer
   * proved it with a 405-word note below an unclosed preamble fence. The tool cannot measure this
   * file, and a check that cannot measure must say so loudly rather than quietly pass.
   */
  out.unclosedFence = fence;
  return out;
}

function countWords (body) {
  const joined = body.join('\n').trim();
  if (!joined) return 0;
  return joined.split(/\s+/).filter(Boolean).length;
}

function readWaivers (waiverFile) {
  if (!fs.existsSync(waiverFile)) return [];
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(waiverFile, 'utf8'));
  } catch (e) {
    process.stdout.write('  ' + waiverFile + ' is not readable as JSON: ' + e.message + '\n');
    return null;
  }
  const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.waivers) ? raw.waivers : null);
  if (!list) {
    process.stdout.write('  ' + waiverFile + ' must hold an array, or an object with a waivers array.\n');
    return null;
  }
  return list;
}

function main (argv) {
  const args = argv.slice(2);
  let dir = process.cwd();
  let todayUtcMs = Date.now();
  const usage = 'usage: check-release-note.js [--dir <project>] [--today YYYY-MM-DD]\n';
  /*
   * H9. `--dir` WITH NO VALUE THREW ERR_INVALID_ARG_TYPE AND A STACK TRACE, and exited 1 rather
   * than the 2 this block plainly intends, so a usage mistake was reported as an over-cap note.
   * The fragment that ships to every project publishes this invocation to strangers, so the
   * first thing a stranger could get wrong printed a crash. A flag that takes a value must check
   * it got one; `args[++i]` past the end is undefined and undefined reaches the filesystem.
   */
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir') {
      if (i + 1 >= args.length) { process.stdout.write('  --dir needs a directory.\n' + usage); return 2; }
      dir = args[++i]; continue;
    }
    if (args[i] === '--today') {
      const v = args[i + 1];
      if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v) || !isRealDate(v)) {
        process.stdout.write('  --today needs a real YYYY-MM-DD date.\n' + usage); return 2;
      }
      i++;
      const p = v.split('-');
      todayUtcMs = Date.UTC(+p[0], +p[1] - 1, +p[2]);
      continue;
    }
    /*
     * `--cap` is REFUSED rather than silently ignored. It used to fall through to `continue`,
     * so `--cap 500` looked accepted and the 200-word cap applied anyway, which is a flag that
     * appears to work and does nothing. The cap is the CEO's number and is not a command-line
     * option; a caller who wants a different one is asking for the rule to be different.
     */
    if (args[i] === '--cap') {
      process.stdout.write('  --cap is not a setting. 200 words is the rule, set by the owner on\n' +
        '  2026-09-19, and a longer note needs their approval rather than a larger cap.\n' + usage);
      return 2;
    }
    process.stdout.write(usage);
    return 2;
  }

  const found = findChangelog(dir);
  if (!found) {
    process.stdout.write('RELEASE NOTE  no CHANGELOG.md at or above ' + dir + ', nothing to check.\n');
    return 3;
  }
  const file = found.file;
  if (found.fromParent) {
    process.stdout.write('  note  ' + dir + ' holds no CHANGELOG.md, so the one above it is measured: ' + file + '\n');
  }

  const all = sections(fs.readFileSync(file, 'utf8'), { todayUtcMs: todayUtcMs });
  // Before anything else, because an unclosed fence swallows every heading below it. Whether that
  // leaves NO sections or merely hides the later ones, the answer this tool would give is about a
  // file it could not read, and an answer like that is worse than a refusal.
  if (all.unclosedFence) {
    process.stdout.write('RELEASE NOTE FAIL  ' + file + ' opens a "' + all.unclosedFence.run +
      '" code fence at line ' + all.unclosedFence.line + ' and never closes it, so every heading\n' +
      '       below it was read as code. This is refused rather than reported, because exit 3 is\n' +
      '       advisory and a note under that fence would ship unmeasured. Close the fence.\n');
    return 1;
  }
  if (!all.length) {
    process.stdout.write('RELEASE NOTE  ' + file + ' holds no dated "## YYYY-MM-DD" section.\n');
    return 3;
  }

  const waiverFile = waiverPathFor(file);
  const waivers = readWaivers(waiverFile);
  if (waivers === null) return 1;

  /*
   * THE SECTION UNDER TEST IS THE ONE WITH THE LATEST DATE, NOT THE FIRST IN THE FILE. The first
   * version took all[0], which is right for this repository's newest-first convention and wrong
   * for anybody else's. A content reviewer proved it on 2026-09-19 with an oldest-first fixture:
   * a 400-word section added at the BOTTOM was never counted and the tool returned exit 0 on the
   * ten-word section at the top. This file ships to every project, so the reader it misled was a
   * maintainer whose changelog is not ordered like ours.
   *
   * File order is still reported when it disagrees with date order, because that disagreement is
   * a real defect in a changelog and silently sorting would hide it. Reported, not refused: a
   * house convention is not this tool's business to enforce.
   */
  let latest = all[0].date;
  for (let i = 1; i < all.length; i++) if (all[i].date > latest) latest = all[i].date;

  /*
   * EVERY SECTION SHARING THE LATEST DATE IS CONSIDERED, NOT THE FIRST OF THEM. The tool cannot
   * know which one somebody is adding, and resolving the tie by file position measured the wrong
   * one: a project publishing twice in a day had a 403-word note pass because a fourteen-word
   * sibling above it was checked instead. A real sibling changelog here holds eight or more
   * duplicate dates, so this is the ordinary case and not a corner. The LONGEST decides, because a cap is
   * a limit and a limit is broken by the largest.
   */
  const sameDay = all.filter(s => s.date === latest);
  let newest = sameDay[0];
  for (let i = 1; i < sameDay.length; i++) {
    if (countWords(sameDay[i].body) > countWords(newest.body)) newest = sameDay[i];
  }
  if (sameDay.length > 1) {
    process.stdout.write('  note  ' + sameDay.length + ' sections share ' + latest +
      '. The longest is measured, at line ' + newest.line + '.\n');
  }
  if (newest !== all[0]) {
    process.stdout.write('  note  the section measured is ' + newest.date + ' at line ' + newest.line +
      ', not the first in the file (' + all[0].date + ').\n');
  }
  const words = countWords(newest.body);
  const dates = {};
  // The LONGEST at each date, for the same reason the measured section is the longest: a waiver
  // is stale only when nothing at that date needs it, and the last one written is not the test.
  for (let i = 0; i < all.length; i++) {
    const w = countWords(all[i].body);
    if (!(all[i].date in dates) || w > dates[all[i].date]) dates[all[i].date] = w;
  }

  let stale = 0;
  for (let i = 0; i < waivers.length; i++) {
    const w = waivers[i] || {};
    const known = Object.prototype.hasOwnProperty.call(dates, w.date);
    const live = known && dates[w.date] > CAP;
    if (!known || !live) stale++;
    process.stdout.write('  waiver  ' + (w.date || '(no date)') + '  ' +
      (!known ? 'STALE, no such section' : (!live ? 'STALE, that section is ' + dates[w.date] + ' words and needs no waiver' : 'live')) +
      '  --  ' + (w.reason || '(NO REASON, which is refused)') + '\n');
  }

  let code = 0;
  if (stale) {
    process.stdout.write('RELEASE NOTE FAIL  ' + stale + ' waiver(s) no longer excuse anything. Remove them: a list of\n' +
      '       excuses that outlives what it excused is how a cap quietly stops applying.\n');
    code = 1;
  }

  const waived = waivers.filter(w => w && w.date === newest.date && String(w.reason || '').trim());
  if (words > CAP && !waived.length) {
    process.stdout.write('RELEASE NOTE FAIL  the ' + newest.date + ' note is ' + words + ' words against a cap of ' + CAP + '.\n' +
      '       ' + file + ':' + newest.line + '\n' +
      '       The CEO set this on 2026-09-19: over 200 words needs their approval BEFORE it is\n' +
      '       written, not after. Say what the change gives the reader and cut the mechanism.\n' +
      '       Every false claim the review rounds behind this rule found was a MECHANISM claim,\n' +
      '       so a note with no mechanism cannot carry a false one.\n' +
      '       With their approval, add {"date":"' + newest.date + '","reason":"<their words>"} to\n' +
      '       ' + waiverFile + '\n');
    return 1;
  }

  // The PASSING line names the file too. It used to name none, so a run that measured the wrong
  // project's changelog looked identical to one that measured yours, in the direction nobody
  // checks: the direction where everything is fine.
  process.stdout.write('RELEASE NOTE  ' + newest.date + ' is ' + words + ' word(s), cap ' + CAP +
    (waived.length ? ', APPROVED: ' + waived[0].reason : '') + '.\n' +
    '       ' + file + ':' + newest.line + '\n');
  return code;
}

if (require.main === module) process.exit(main(process.argv));
module.exports = { sections, countWords, CAP };
