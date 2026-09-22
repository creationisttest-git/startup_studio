#!/usr/bin/env node
'use strict';

/*
 * check-session-goal.js -- a session commits to a goal BEFORE it works, and is measured
 * against that goal at wind-down.
 *
 * RAISED BY THE CEO on 2026-09-18, in their own words: "we should have clear method for a
 * session to summarize and give me session goals and busines value it brings. at the start of
 * the session and at wind down compare against that. unless its genuinely too large context we
 * should finish the goal for that sesssion without carying over."
 *
 * WHY IT IS AN INSTRUMENT AND NOT A PARAGRAPH IN A SKILL. Twenty-seven sittings had happened
 * before one of them stated its goal out loud, and the one that did so only because the founder
 * said it mid-session. A wind-down writes the record, so a session that never committed to
 * anything can still write a confident account of what it achieved, and nothing can tell that
 * account from a commitment kept. The two are indistinguishable AFTER the fact, which is exactly
 * why the order has to be enforced rather than encouraged. Same argument as S225: the board ask
 * is written before the CEO prompt so the record cannot show an answer to a question nobody put.
 *
 * WHAT IT READS.
 *   1. The `## Session goal` section of the state document, which the wind-down writes. It must
 *      carry a Goal, a Value in the founder's terms, when the goal was Stated, and a Verdict.
 *   2. The BOARD, where the same goal was written as a note before any work started. This is the
 *      half that makes the timestamp real: a goal that first appears at wind-down is a summary,
 *      and the board history says which it was.
 *
 * THE VERDICT IS NOT OPTIONAL AND "MET" IS NOT THE DEFAULT. A session that did not finish says
 * so and says what it is carrying and why. The CEO's rule is to finish rather than carry, so
 * carrying is a thing that gets justified in writing rather than a thing that happens quietly.
 *
 * EXIT CODES, and the asymmetry is deliberate.
 *   0  clean.
 *   1  the section exists and is broken, or the board contradicts it. BLOCKS THE COMMIT.
 *   2  the file could not be read. Say so; do not treat it as a pass.
 *   3  CANNOT TELL. No `## Session goal` section at all, or no board to compare against. This
 *      does NOT block the commit, because the check has to be installable in a project that has
 *      not adopted the section yet without locking that project out of committing (the same
 *      defect check-session-brief.js shipped with and had to fix).
 *
 *   node tools/check-session-goal.js <path-to-WARM_START.md> [--board <dir>] [--today YYYY-MM-DD]
 */

const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
function arg(name, fallback) {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
}
/* Walk by index rather than with find(). find() would re-locate a repeated argument by its
 * FIRST occurrence, so a value that happens to equal an earlier one gets the wrong neighbour
 * tested and a flag's value is silently taken as the target path. */
const TAKES_VALUE = ['--board', '--today'];
let target = null;
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) { if (TAKES_VALUE.indexOf(argv[i]) !== -1) i++; continue; }
  target = argv[i];
  break;
}

if (!target) {
  process.stdout.write('usage: check-session-goal.js <path-to-WARM_START.md> [--board <dir>] [--today YYYY-MM-DD]\n');
  process.exit(2);
}
if (!fs.existsSync(target)) {
  process.stdout.write('CANNOT READ  no such file: ' + target + '\n');
  process.exit(2);
}

let text;
try {
  text = fs.readFileSync(target, 'utf8');
} catch (e) {
  process.stdout.write('CANNOT READ  ' + target + ': ' + e.message + '\n');
  process.exit(2);
}

/* The section, bounded by the next heading of the same level. Bounding matters: without it the
 * rest of the document counts as the goal section and every required line is "present" because
 * some other section happens to use the word. */
function sectionOf(doc, heading) {
  const lines = doc.split(/\r?\n/);
  const start = lines.findIndex(l => l.trim().toLowerCase() === heading.toLowerCase());
  if (start === -1) return null;
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i]) && !/^###\s/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join('\n');
}

const section = sectionOf(text, '## Session goal');
if (section === null) {
  process.stdout.write('CANNOT TELL  ' + path.basename(target) + ' carries no "## Session goal" section.\n');
  process.stdout.write('             This does not block the commit. It does mean nothing can say whether this\n');
  process.stdout.write('             session did what it set out to do.\n');
  process.exit(3);
}

const findings = [];
// Named apart from the board-note array inside the board block below. They collided once and
// the inner one silently swallowed every accepted ordering, so the note was never printed.
const orderingNotes = [];
function field(name) {
  const m = section.match(new RegExp('^\\s*(?:[-*]\\s*)?(?:\\*\\*)?' + name + '(?:\\*\\*)?\\s*:\\s*(.+)$', 'im'));
  return m ? m[1].trim().replace(/\*\*/g, '').trim() : null;
}

const goal = field('Goal');
const value = field('Value');
const stated = field('Stated');
const verdict = field('Verdict');
const carried = field('Carried');

/* A placeholder is worse than an absence, because it satisfies a presence check while telling
 * the reader nothing. These are the strings a session reaches for when it has not decided. */
const PLACEHOLDER = /^(tbd|todo|n\/a|none|various|general|ongoing work|see below|as above|\.\.\.|-+)$/i;

if (!goal) findings.push('no "Goal:" line. The one thing this session set out to FINISH has to be written down.');
else if (PLACEHOLDER.test(goal)) findings.push('the Goal is a placeholder (' + JSON.stringify(goal) + '), which passes a presence check and tells a reader nothing.');
else if (goal.split(/\s+/).length < 4) findings.push('the Goal is ' + goal.split(/\s+/).length + ' word(s) long, which cannot name what finishing looks like.');

if (!value) findings.push('no "Value:" line. The founder asked for the business value, not only the task list.');
else if (PLACEHOLDER.test(value)) findings.push('the Value is a placeholder (' + JSON.stringify(value) + ').');
else if (normalise(value) === normalise(goal || '')) findings.push('the Value repeats the Goal word for word, so the session has not said what the founder GETS.');

if (!stated) findings.push('no "Stated:" line. Without a timestamp, a goal committed to at the start and a summary written at the end read identically.');
else if (!/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2})?/.test(stated)) findings.push('the "Stated:" line is not a date (' + JSON.stringify(stated) + ').');

const VERDICTS = ['MET', 'PARTLY MET', 'NOT MET'];
if (!verdict) findings.push('no "Verdict:" line. A goal with no verdict is a plan, and this document is written at the END.');
else if (VERDICTS.indexOf(verdict.toUpperCase().replace(/[.,].*$/, '').trim()) === -1) {
  findings.push('the Verdict is ' + JSON.stringify(verdict) + ', which is not one of MET, PARTLY MET, NOT MET. A verdict a reader has to interpret is not a verdict.');
}

const cleanVerdict = (verdict || '').toUpperCase().replace(/[.,].*$/, '').trim();
if ((cleanVerdict === 'PARTLY MET' || cleanVerdict === 'NOT MET') && !carried) {
  findings.push('the Verdict is ' + cleanVerdict + ' with no "Carried:" line. The CEO\'s rule is to FINISH rather than carry over, so what is being carried, and why, is written down rather than left to the next session to discover.');
}

function normalise(s) { return String(s).replace(/\s+/g, ' ').trim().toLowerCase(); }

/* ---- the mission half. Does this work head towards what the project is FOR? ----
 *
 * RAISED BY THE CEO, in their words: "we should question their vision and mission
 * against their features and work they plan to do at start of every session."
 *
 * THE DESIGN IS IN WHAT IT DOES NOT PRINT. Six leads assessed this and all six landed on the
 * same place: the check says NOTHING when the planned work fits the mission. Every draft of an
 * agreeing line turned out to be a sentence a stranger could paste into any project unchanged,
 * which is the test for a category rather than for a detail. A line that prints
 * every session becomes the eleventh bullet of a founder brief the CEO already cut at 98 lines,
 * and a check that speaks every time teaches its reader that its speech is noise.
 *
 * THE ESCAPE EXISTS FROM THE FIRST RUN, and that is load-bearing rather than a courtesy. Without
 * a sayable NO this is a rubber stamp, and this studio has spent thirty-nine sittings repairing
 * itself, so a check that refuses every maintenance sitting would be routed around within three.
 * `Off-mission:` with a reason is a PASS. What it is not is silence.
 *
 * A PROJECT WITH NO MISSION IS NOT REFUSED. Same lockout reasoning as the no-section and no-board
 * paths: a check that blocks a commit over a section a project has never had gets deleted rather
 * than adopted. It says the mission is absent and moves on.
 *
 * WHAT IT WILL NOT DO IS INFER ONE. An inferred mission is a founder ruling nobody gave, and the
 * check would then agree with it forever. Absent is a state this tool reports. Invented is not. */
const missionSection = sectionOf(text, '## Mission');
const UNSET = /^\*?(not captured|never|tbd|todo|unanswered|none)\*?\.?$/i;
function missionField(name) {
  if (!missionSection) return null;
  const m = missionSection.match(new RegExp('^\\s*(?:\\*\\*)?' + name + '(?:\\*\\*)?\\s*:\\s*(.+)$', 'im'));
  return m ? m[1].trim() : null;
}
const missionText = missionField('Mission');
const missionCaptured = !!(missionText && !UNSET.test(missionText));
const serves = field('Mission');
const offMission = field('Off-mission');

if (missionCaptured) {
  if (!serves && !offMission) {
    findings.push('the project has a captured mission and this session did not say how the work relates to it. '
      + 'Add either a "Mission:" line naming the clause the work serves, or an "Off-mission:" line with the '
      + 'reason.\n        Off-mission is a PASS. A sitting spent on maintenance says so and moves on. What is '
      + 'refused is neither, because a mission nothing is ever measured against is decoration.\n        mission : '
      + String(missionText).slice(0, 120));
  } else if (serves && PLACEHOLDER.test(serves)) {
    findings.push('the "Mission:" line is a placeholder (' + JSON.stringify(serves) + '), which satisfies the field and names no clause.');
  } else if (offMission && PLACEHOLDER.test(offMission)) {
    findings.push('the "Off-mission:" line is a placeholder (' + JSON.stringify(offMission) + '). The escape costs a reason somebody stands behind, or it is a flag nobody sees.');
  }
}

/* ---- the board half: was the goal a commitment or a summary? ---- */

const boardDir = arg('--board', path.join(path.dirname(path.resolve(target)), '.board'));
const ticketsDir = path.join(boardDir, 'tickets');
let boardVerdict = null;
/* WHICH SITTING THIS RUN IS ABOUT, always printed, so a pass is never silent about it. */
let scoringLine = stated ? 'the sitting stated ' + stated : 'unknown, this document carries no Stated line';
let supersededBy = null;
/* A mission captured at birth is a claim nobody re-verifies, so staleness has to
 * be mechanical rather than remembered. Three sittings running that all declare themselves
 * off-mission is evidence about the MISSION and not about the work, and the tool says so in that
 * direction: it asks the founder to reaffirm or rewrite rather than telling three sittings they
 * were wrong. It does not refuse, because the sittings were probably right. */
let missionStale = false;

if (!fs.existsSync(ticketsDir)) {
  boardVerdict = 'NO BOARD  ' + ticketsDir + ' does not exist, so nothing can say WHEN the goal was written.';
} else {
  const notes = [];
  const mutations = [];
  for (const f of fs.readdirSync(ticketsDir)) {
    if (!f.endsWith('.json')) continue;
    let t;
    try { t = JSON.parse(fs.readFileSync(path.join(ticketsDir, f), 'utf8')); } catch (e) { continue; }
    for (const h of (t.history || [])) {
      if (!h || !h.at) continue;
      if (/^SESSION GOAL/i.test(String(h.what || ''))) notes.push({ at: h.at, ref: t.ref, what: h.what });
      else mutations.push({ at: h.at, ref: t.ref, what: String(h.what || '').slice(0, 60) });
    }
  }
  const today = arg('--today', (stated || '').slice(0, 10)) || new Date().toISOString().slice(0, 10);
  const todaysNotes = notes.filter(n => n.at.slice(0, 10) === today);
  const todaysMutations = mutations.filter(m => m.at.slice(0, 10) === today).sort((a, b) => a.at.localeCompare(b.at));

  if (todaysNotes.length === 0) {
    findings.push('the board carries no "SESSION GOAL" note dated ' + today + '. The goal was written into the record '
      + 'but never committed to on the board, so the document is the only witness to its own claim.');
    boardVerdict = 'no goal note on ' + today;
  } else {
    const earliestNote = todaysNotes.sort((a, b) => a.at.localeCompare(b.at))[0];
    boardVerdict = 'goal noted ' + earliestNote.at + ' on ' + earliestNote.ref;
    if (todaysMutations.length) {
      const firstWork = todaysMutations[0];
      if (earliestNote.at > firstWork.at) {
        /* S207: A REFUSAL MAY NOT ASSERT MORE THAN ITS PREDICATE MEASURED. This used to say
         * flatly that the goal was written after the work started. What it actually measures is
         * the first ticket mutation of the CALENDAR DAY, and a board shared by more than one
         * session in a day carries another session's mutations in that window. It said so on its
         * first real run, naming a ticket touched four hours before this session opened. The
         * message now states the comparison it performed, and the reader judges.
         *
         * THE ESCAPE IS A WRITTEN REASON, not a weakened predicate. Same shape as the exemptions
         * in check-rule-delivery.js and --allow-rise in check-comment-shape.js: an `Ordering:`
         * line in the section explains it, is printed on every run, and is visible to the founder.
         * Without one this still refuses, so the escape costs somebody a sentence they have to
         * stand behind rather than a flag nobody sees. */
        const excuse = field('Ordering');
        const detail = 'The board note is ' + earliestNote.at + ' and the first ticket mutation of the '
          + 'calendar day is ' + firstWork.at + ' on ' + firstWork.ref + '. This check reads the board '
          + 'and cannot tell which session made that earlier mutation, so on a board shared across '
          + 'sessions in one day the earlier one may not be yours.';
        if (excuse) {
          orderingNotes.push('Ordering ACCEPTED: ' + excuse);
          orderingNotes.push(detail);
        } else {
          findings.push('THE GOAL MAY HAVE BEEN WRITTEN AFTER THE WORK STARTED. ' + detail
            + '\n        A goal recorded after the fact is a summary of what happened, and the two are '
            + 'indistinguishable once written down. If the earlier mutation belongs to another session, '
            + 'say so in an "Ordering:" line in this section and it will be printed rather than refused.');
        }
      }
    }
    /* The goal on the board and the goal in the document have to be the same goal. Otherwise
     * the commitment and the account of it can drift apart with both passing on their own. */
    /* ANY of today's notes, not the EARLIEST. S207, found by this check refusing a correct
     * wind-down on 2026-09-18: two sittings ran on one calendar day, the earliest note belonged
     * to the first of them, and the drift finding compared THIS document against THAT sitting's
     * goal. The predicate that matters is whether this session's goal was committed to on the
     * board before the work, and the ordering test above already answers the "before" half from
     * the earliest note. Asking whether ANY note carries the goal is the question this half was
     * always for, and it is the only one the data can answer on a shared board. */
    const goalKey = goal ? normalise(goal).slice(0, Math.min(40, normalise(goal).length)) : '';
    const matchingNote = goal ? todaysNotes.find(nt => normalise(nt.what).includes(goalKey)) : null;
    if (goal && !matchingNote) {
      findings.push('the goal in ' + path.basename(target) + ' does not appear in ANY board note dated ' + today + '. '
        + 'The commitment and the account of it have drifted, and each one passes on its own.\n'
        + '        board    : ' + todaysNotes.map(nt => String(nt.what).slice(0, 70)).join(' // ') + '\n'
        + '        document : ' + String(goal).slice(0, 160));
    }

    /* ---- is this document about the LIVE sitting, or one that is already over? ----
     *
     * THE DEFECT THIS CLOSES. The `## Session goal` section is written at wind-down, so until
     * then it holds the PREVIOUS sitting's goal. Every run before that read an old sitting,
     * found it complete and correct, and exited 0. Green was therefore not evidence about the
     * session being scored, and WARM_START.md described that in prose for three sittings before
     * anybody put it on a ticket.
     *
     * THE DISCRIMINATOR IS THE BOARD AND NOT THE CLOCK, deliberately. Two sittings in one
     * calendar day is ordinary here, so the date alone cannot separate them; and the document's
     * `Stated:` line is minute-resolution while a board stamp carries seconds, so comparing the
     * two timestamps directly invents a difference on a perfectly correct wind-down. What is
     * unambiguous is which NOTE carries this document's goal. If the board holds a later goal
     * note than the one this document is about, then a newer sitting has committed to something
     * and this document is not about it.
     *
     * IT IS CANNOT TELL, NOT A FAILURE. The document is not wrong; it is simply about a session
     * that has finished. Refusing here would block a commit for the ordinary act of running the
     * check mid-session. Exit 3 is already advisory in run-checks.js, so this reports without
     * locking anybody out, which is the same lockout reasoning that shaped the no-section path. */
    const allNotes = notes.slice().sort((a, b) => a.at.localeCompare(b.at));
    const lastThree = allNotes.slice(-3);
    if (lastThree.length === 3 && lastThree.every(nt => /off-mission/i.test(String(nt.what)))) missionStale = true;
    if (allNotes.length) {
      const newest = allNotes[allNotes.length - 1];
      const key = goal ? normalise(goal).slice(0, Math.min(40, normalise(goal).length)) : '';
      const mine = key ? allNotes.filter(nt => normalise(nt.what).includes(key)).pop() : null;
      if (mine) {
        scoringLine = 'the sitting whose goal was noted ' + mine.at + ' on ' + mine.ref;
        if (newest.at > mine.at) {
          supersededBy = newest;
          scoringLine += ', which is NOT the newest goal on this board';
        } else {
          scoringLine += ', which IS the newest goal on this board';
        }
      } else {
        scoringLine = 'a goal that appears in no board note at all, newest on the board is ' + newest.at;
      }
    }
  }
}

process.stdout.write('\nSESSION GOAL  ' + path.basename(target) + '\n');
if (goal) process.stdout.write('  Goal    ' + goal + '\n');
if (value) process.stdout.write('  Value   ' + value + '\n');
if (stated) process.stdout.write('  Stated  ' + stated + '\n');
if (verdict) process.stdout.write('  Verdict ' + verdict + '\n');
if (carried) process.stdout.write('  Carried ' + carried + '\n');
if (boardVerdict) process.stdout.write('  Board   ' + boardVerdict + '\n');
process.stdout.write('  Scoring ' + scoringLine + '\n');
/* NOTHING IS PRINTED HERE TO CONGRATULATE WORK THAT FITS. The clause is echoed so a reader can
 * check the claim, and that is all. */
if (missionCaptured) {
  if (serves) process.stdout.write('  Serves  ' + serves + '\n');
  if (offMission) process.stdout.write('  Off     ' + offMission + '\n');
} else {
  process.stdout.write('  Mission not captured, so nothing here can say whether the work heads towards it.\n');
  process.stdout.write('  Add a "## Mission" section to the state document with a Mission and a Vision line.\n');
}
if (missionStale) {
  process.stdout.write('\n  MISSION STALE. The last three sittings on this board all recorded themselves off-mission.\n');
  process.stdout.write('  That is evidence about the mission rather than about the work. Reaffirm it or rewrite it.\n');
}
/* An accepted ordering is PRINTED on every run rather than silently swallowed. A suppression
 * nobody sees is a suppression nobody revisits. */
for (const nt of orderingNotes) process.stdout.write('  ' + nt + '\n');

/* BEING ABOUT A FINISHED SESSION WINS OVER EVERY FINDING, and that ordering is the whole point.
 * A document about a sitting that is already over will also be missing whatever the live sitting
 * was supposed to add, so its findings are about the dead sitting. Blocking a commit over them
 * reinstates the defect this branch exists to close, one level down. They are printed, because a
 * suppression nobody sees is a suppression nobody revisits, and they are printed as context
 * rather than as a refusal. */
if (supersededBy) {
  process.stdout.write('\nCANNOT TELL  this document is about a sitting that is already over.\n');
  process.stdout.write('             The newest goal on this board was noted ' + supersededBy.at + ' on '
    + supersededBy.ref + ' and this document does not carry it:\n');
  process.stdout.write('               board    ' + String(supersededBy.what).slice(0, 100) + '\n');
  process.stdout.write('               document ' + String(goal || '(none)').slice(0, 100) + '\n');
  for (const f of findings) process.stdout.write('             context: ' + String(f).split('\n')[0] + '\n');
  process.stdout.write('             Everything above is true of the EARLIER sitting and says nothing about the\n');
  process.stdout.write('             live one. This does not block the commit. The wind-down rewrites the section,\n');
  process.stdout.write('             and this check then scores the sitting it claims to.\n\n');
  process.exit(3);
}

if (findings.length === 0) {
  process.stdout.write('\n  the goal was committed to before the work and is answered with a verdict.\n\n');
  process.exit(0);
}

/* Nothing to compare against is CANNOT TELL and never a failure, which is why the no-board
 * path above adds no finding: a project with no board must still be able to commit. */
process.stdout.write('\n');
for (const f of findings) process.stdout.write('FAIL  ' + f + '\n');
process.stdout.write('\n' + findings.length + ' finding(s).\n');
if (boardVerdict && /^NO BOARD/.test(boardVerdict)) process.stdout.write('  ' + boardVerdict + '\n');
process.exit(1);
