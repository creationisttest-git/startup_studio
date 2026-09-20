#!/usr/bin/env node
/**
 * check-measures.js -- reads the acceptance measures a gate was started on and reports them as
 * numbers rather than as sentences.
 *
 * WHY THIS EXISTS. A front-door gate is allowed to start large work only once somebody writes
 * down the measure it will be judged by. Nothing then required that measure to OUTLIVE the
 * ticket, so both measures lived on the one ticket that named them, and accepting that ticket
 * would have deleted them. A measure nobody reads is a sentence. This file is the difference.
 *
 * WHAT IT READS, AND WHY THOSE SOURCES ONLY. Both numbers come from what git already keeps: the
 * commit log, the ticket files, and the override ledger beside them. Nothing here reads a log
 * that is machine-local or ignored by git, because a measure only one computer can answer is
 * not a measure of the method.
 *
 *   node tools/check-measures.js [--root <dir>] [--commits N] [--since YYYY-MM-DD] [--quiet]
 *
 * MEASURE ONE. Work must not reach a commit without its ticket having entered in_progress. The
 * target is zero of the last ten.
 *
 *   WORK IS DECIDED BY WHAT A COMMIT CHANGED, NEVER BY WHAT IT SAYS. A commit touching only the
 *   board and the project's own record is ticket administration: raising one, recording an
 *   assessment, parking one, writing a note. None of that is work passing through the door.
 *   Counting it produced three breaches on the first run of this file where the true answer was
 *   zero, and a check that reports a breach every session is one nobody reads by the second week.
 *   THE RECORD WAS LEFT OUT OF THAT SET AT FIRST and the same defect came back one file over,
 *   because raising a ticket also writes the state document. See recordFiles below.
 *
 *   A COMMIT IS JUDGED ONCE, NOT ONCE PER REFERENCE. One body of work can name several tickets,
 *   and the measure is satisfied when any of the named tickets went through the door. Judging
 *   each reference separately refused a commit for mentioning a ticket it PARKED, which made a
 *   fuller commit message the thing that failed.
 *
 *   A commit naming NO ticket is reported beside the count and never inside it. Some are the
 *   wind-down and the board state itself, which have no ticket by design, and nothing available
 *   here tells those apart from work done off the board. Naming them beats counting them wrong.
 *
 *   WHAT THIS CANNOT SEE. A merge commit lists no files without -m, so it reads as
 *   administration. A commit changing nothing outside the board reads the same way, which is
 *   the intended behaviour and is also the way to hide work from this measure.
 *
 * MEASURE TWO. The ceiling gate must not be overridden more often than one session in five, over
 * the fourteen days after the override mechanism shipped.
 *
 *   THE NUMERATOR IS EXACT and comes from the committed ledger. THE DENOMINATOR DOES NOT EXIST.
 *   There is no session identity anywhere in this board: no session row, no session id, nothing
 *   a ticket file records. That was already known when the override mechanism was built, and is
 *   why its own escalation counts overrides per FOURTEEN DAYS rather than per session. A proxy
 *   could be invented -- distinct dates carrying a board write, or a count of wind-down commits
 *   -- and either would be a number this file made up and then reported under a rule it did not
 *   write. So the rate is NOT REPORTED, the numerator is, and the gap is named in the output.
 *
 * EXIT CODES.
 *   0  every measure that can be read today is met.
 *   1  a measure is breached. This is the one that should stop something.
 *   2  a fault in the sources: no board, or a ledger that cannot be read.
 *   3  advisory. Nothing is breached and at least one measure CANNOT BE READ AT ALL. Three
 *      rather than zero on purpose: a pass and an absence of evidence must never print the
 *      same, and measure two is an absence of evidence until a session has an identity.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const DEFAULT_COMMITS = 10;
const WINDOW_DAYS = 14;

function arg (argv, name, fallback) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}

// From the board, never a constant: every project numbers its own tickets.
function refPattern (boardDir) {
  const p = path.join(boardDir, 'project.json');
  let prefix = null;
  if (fs.existsSync(p)) {
    try { prefix = JSON.parse(fs.readFileSync(p, 'utf8')).prefix; } catch (e) { prefix = null; }
  }
  if (!prefix) return null;
  return new RegExp('\\b' + prefix + '-\\d{1,4}\\b', 'gi');
}

function readTicket (boardDir, ref) {
  const f = path.join(boardDir, 'tickets', ref + '.json');
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; }
}

// The history and never the current status: a ticket in backlog today may have gone through the
// door and come back, and one sitting in uat may have jumped straight there.
function everEnteredInProgress (ticket) {
  if (!ticket || !Array.isArray(ticket.history)) return false;
  return ticket.history.some(h => String(h.what || '').indexOf('-> in_progress') !== -1);
}

function gitLog (root, n) {
  const out = execFileSync('git', ['-C', root, 'log', '-n', String(n), '--format=%h%x1f%s%x1e'],
    { encoding: 'utf8' });
  return out.split('\x1e').map(s => s.trim()).filter(Boolean).map(function (rec) {
    const parts = rec.split('\x1f');
    return { hash: parts[0], subject: parts[1] || '' };
  });
}

/* Measured: without --root the FIRST commit in a repository lists no files and is read as
   administration, which turned two assertions red in the suite beside this file. The real tree
   could not have shown it, its root commit being far outside the ten examined. */
function changedFiles (root, hash) {
  const out = execFileSync('git',
    ['-C', root, 'diff-tree', '--no-commit-id', '--name-only', '-r', '--root', hash],
    { encoding: 'utf8' });
  return out.split('\n').map(s => s.trim()).filter(Boolean);
}

/* THE RECORD IS NOT WORK, AND THE SET-ASIDE USED TO BE ONE FILE TOO NARROW. Raising a ticket
   writes the board AND the state document the next session reads on the way in, because a ticket
   nobody can see from the handover is a ticket nobody picks up. This file already sets a
   board-only commit aside as administration for exactly that reason, and then counted the very
   same act as work the moment it also touched the document. Measured on the real tree: a6c5b10
   changed .board/BOARD.md, .board/tickets/ST-218.json and WARM_START.md, nothing else, and was
   reported as work reaching a commit without its ticket going through the door.

   THE SET IS DERIVED AND NOT HAND-KEPT (S39), from the one convention every project here uses:
   the state document is whatever CLAUDE.md @-imports from the repository ROOT. A fragment under
   base/ is a RULE, and editing a rule is work, so only root-level imports count and nothing is
   exempt by name. A reader whose project imports different documents gets their own answer.

   IT DOES NOT WIDEN THE HIDING PLACE, which is the objection this file's own header raises
   against exempting anything: a commit is set aside only when its ENTIRE footprint is the board
   and the record, so bundling a source file into a wind-down commit still counts as work. */
function recordFiles (root) {
  const set = new Set(['CLAUDE.md']);
  let text;
  try { text = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8'); } catch (e) { return set; }
  const re = /^@([^\s]+)\s*$/gm;
  let m;
  while ((m = re.exec(text))) {
    const rel = m[1].replace(/\\/g, '/');
    if (rel.indexOf('/') === -1) set.add(rel);
  }
  return set;
}

function isWork (root, hash, boardRel, record) {
  return changedFiles(root, hash).some(f =>
    f.indexOf(boardRel) !== 0 && !(record && record.has(f)));
}

/* Measured: an entry written at 2026-09-04 05:23 reported a window opening 2026-09-03, because a
   stamp carrying no zone is read as local time while the board writes UTC.

   THE FIX ABOVE WAS APPENDING 'Z' UNCONDITIONALLY, AND THAT BECAME A DEFECT THE DAY THE BOARD
   STARTED SAYING Z ITSELF (ST-283). "2026-09-18T22:30:06Z" + "Z" is not a date, and Date.parse
   returns NaN for it, so every override written after the clock change would have read as an
   unparseable stamp and dropped out of the fourteen-day window silently. Going through the one
   parser is what stops a reader and a writer disagreeing about the format again: clock.parse
   adds the marker only when the string does not already carry one. */
const clock = require('./clock.js');
function parseStamp (at) {
  return clock.parse(at);
}

// A WAIVER NAMES A COMMIT AND NOTHING ELSE, WHICH IS THE WHOLE REASON IT CANNOT BECOME A WAY TO
// IGNORE THIS RULE. A commit that does not exist yet cannot be waived, so nothing here is ever
// granted in advance: the act has to have happened, and somebody has to have looked at it and
// written down why it stands.
//
// WHY THIS EXISTS AT ALL. Every other instrument in this repository has a recorded escape.
// comment-shape takes a rise with a reason, published-counts takes a dated exemption,
// mutation-coverage takes a baseline entry with a reason a stranger can read. This measure was the
// only one that said no and stopped, and the suite asserts its exit is 0 or 3, so ONE breach
// anywhere in the commit window blocked every release until that window rolled, including for a
// fresh session that had done nothing wrong. S180 was written yesterday about exactly that shape,
// in a different check, and the tell it names was present here too: the sitting that hit this had
// already recognised the defect, recorded it on each ticket rather than backdating, and corrected
// it inside the same hour, and the rule refused anyway.
function waivers (root, boardDir) {
  const f = path.join(boardDir, 'front-door-waivers.json');
  // ABSENT AND UNREADABLE ARE DIFFERENT ANSWERS, and swallowing both made an authorised waiver
  // vanish on a locked file while the run refused with no hint why. overrideMeasure below already
  // had this shape and this did not.
  if (!fs.existsSync(f)) return { entries: [] };
  let raw;
  try { raw = fs.readFileSync(f, 'utf8'); } catch (e) {
    return { fault: 'front-door-waivers.json exists and cannot be read (' + e.message + ')' };
  }
  let list;
  try { list = JSON.parse(raw); } catch (e) {
    return { fault: 'front-door-waivers.json is not readable JSON (' + e.message + ')' };
  }
  if (!Array.isArray(list)) return { fault: 'front-door-waivers.json is not a JSON array' };
  for (const w of list) {
    if (!w || !w.reason || !w.by) {
      return { fault: 'every waiver needs commit, reason and by. One has ' + JSON.stringify(w) };
    }
    // TRUTHINESS WAS THE ONLY TEST AND THAT IS NOT A COMMIT. A reviewer turned this whole measure
    // off with one entry: the empty array is truthy, it stringifies to the empty string, and every
    // hash starts with the empty string, so a single waiver excused every breach for good while
    // the gate still read advisory and passed. A one-character entry waived nine breaches at once,
    // and an entry written before its commit existed lay dormant and then waived a commit made 79
    // commits later. Every one of those is the thing this file's own comment said cannot happen.
    if (typeof w.commit !== 'string' || !/^[0-9a-f]{7,40}$/.test(w.commit)) {
      return { fault: 'a waiver names ' + JSON.stringify(w.commit) + ', which is not a commit. ' +
        'It must be 7 to 40 hexadecimal characters, because a shorter string names a SET of ' +
        'commits and that set includes commits nobody has written yet.' };
    }
    // AND IT MUST RESOLVE TO A REAL OBJECT, which is what makes "the act has to have happened" a
    // check rather than an argument. It is the only line here that can refuse a waiver written in
    // advance, because a prefix of the right length still describes a commit that does not exist.
    const r = spawnSync('git', ['rev-parse', '--verify', '--quiet', w.commit + '^{commit}'],
      { cwd: root, encoding: 'utf8' });
    if (r.status !== 0) {
      return { fault: 'a waiver names ' + w.commit + ', which is not a commit in this repository. ' +
        'A waiver is granted for something that has already happened, so it cannot be written ' +
        'ahead of the commit it excuses.' };
    }
  }
  return { entries: list };
}

function sameCommit (a, b) {
  const x = String(a); const y = String(b);
  return x.indexOf(y) === 0 || y.indexOf(x) === 0;
}

function frontDoorMeasure (root, boardDir, commits) {
  const pattern = refPattern(boardDir);
  if (!pattern) return { fault: 'no project.json, so ticket references cannot be recognised' };

  let log;
  try { log = gitLog(root, commits); } catch (e) {
    return { fault: 'the commit log cannot be read (' + String(e.message).split('\n')[0] + ')' };
  }
  const boardRel = path.basename(boardDir) + '/';
  const record = recordFiles(root);
  const offProcess = [];
  const unknownRef = [];
  const noRef = [];
  const admin = [];

  for (const c of log) {
    let work;
    try { work = isWork(root, c.hash, boardRel, record); } catch (e) {
      return { fault: 'commit ' + c.hash + ' cannot be read (' + String(e.message).split('\n')[0] + ')' };
    }
    if (!work) { admin.push(c); continue; }
    const refs = c.subject.match(pattern);
    if (!refs) { noRef.push(c); continue; }
    // A COMMIT IS JUDGED ONCE, NOT ONCE PER REFERENCE, AND THE FIRST VERSION PENALISED A COMMIT
    // FOR BEING CLEAR ABOUT WHAT IT TOUCHED. The measure asks whether WORK reached a commit
    // without ITS ticket going through the door, and a commit carries one body of work however
    // many tickets its subject names. Measured on the real tree: 2b0117d closed ST-214, which had
    // entered in_progress, and in the same commit parked ST-211, which by definition never does.
    // The parked reference alone was reported as a breach. So naming both tickets was refused and
    // naming only ST-214 would have passed, for byte-identical work, which is an instrument
    // rewarding a thinner commit message. One named ticket through the door satisfies it, and the
    // breach names every ticket on the commit so a reader is not left guessing which one it meant.
    const known = [];
    for (const ref of refs) {
      const t = readTicket(boardDir, ref);
      if (!t) { unknownRef.push({ commit: c, ref: ref }); continue; }
      known.push({ ref: ref, ticket: t });
    }
    if (known.length && !known.some(k => everEnteredInProgress(k.ticket))) {
      offProcess.push({ commit: c, ref: known.map(k => k.ref).join(', ') });
    }
  }
  const w = waivers(root, boardDir);
  if (w.fault) return { fault: w.fault };

  const breaches = [];
  const waived = [];
  for (const x of offProcess) {
    const hit = w.entries.filter(e => sameCommit(x.commit.hash, e.commit))[0];
    if (hit) waived.push({ commit: x.commit, ref: x.ref, waiver: hit });
    else breaches.push(x);
  }

  // A WAIVER THAT HAS OUTLIVED ITS REASON REFUSES, which is the rule mutation-coverage already
  // applies to its own baseline. Scoped to the window on purpose: once the commit has rolled out
  // of it the waiver is simply no longer applied, and refusing on that would be a lockout that
  // arrives on its own with no change to the tree.
  const stale = w.entries.filter(e =>
    log.some(c => sameCommit(c.hash, e.commit)) && !waived.some(v => v.waiver === e));
  if (stale.length) {
    return { fault: 'a waiver names ' + stale[0].commit + ', which is in the window and is NOT a ' +
      'breach, so it has outlived what it was granted for. Remove it rather than leaving a ' +
      'standing exemption nobody can account for.' };
  }

  return {
    examined: log.length, work: log.length - admin.length,
    offProcess: breaches, waived: waived, unknownRef: unknownRef, noRef: noRef, admin: admin
  };
}

function overrideMeasure (boardDir, since) {
  const f = path.join(boardDir, 'overrides.json');
  if (!fs.existsSync(f)) return { entries: [], since: since, shipped: null, empty: true };

  let ledger;
  try { ledger = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) {
    return { fault: 'overrides.json is not readable JSON (' + e.message + ')' };
  }
  if (!Array.isArray(ledger)) return { fault: 'overrides.json is not a JSON array' };

  const stamped = ledger.map(function (o) {
    return { at: String(o && o.at || ''), gate: o && o.gate, ref: o && o.ref, reason: o && o.reason };
  });

  // The ledger dates its own beginning: it cannot have been overridden before it could record
  // one, so the earliest entry is the day the mechanism existed. A date written in here would
  // need editing to stay true.
  const parsed = stamped
    .map(o => parseStamp(o.at))
    .filter(n => !isNaN(n));
  const shipped = since ? Date.parse(since + 'T00:00:00Z') : (parsed.length ? Math.min.apply(null, parsed) : null);
  if (shipped === null) return { entries: [], since: null, shipped: null, empty: true };

  const end = shipped + WINDOW_DAYS * 24 * 3600 * 1000;
  const inWindow = stamped.filter(function (o) {
    const t = parseStamp(o.at);
    // An unreadable stamp counts as inside: it must not age itself out by being broken.
    return isNaN(t) ? true : (t >= shipped && t <= end);
  });
  return { entries: inWindow, all: stamped, shipped: shipped, end: end, empty: false };
}

function iso (ms) { return new Date(ms).toISOString().slice(0, 10); }

function main (argv) {
  const root = path.resolve(arg(argv, '--root', path.join(__dirname, '..')));
  const commits = parseInt(arg(argv, '--commits', String(DEFAULT_COMMITS)), 10);
  const since = arg(argv, '--since', null);
  const quiet = argv.indexOf('--quiet') !== -1;
  const boardDir = path.join(root, '.board');
  const say = function (s) { if (!quiet) console.log(s); };

  if (!fs.existsSync(boardDir)) {
    console.log('FAULT  no .board directory at ' + root);
    return 2;
  }

  let breached = false;
  let unproved = false;
  let fault = false;

  say('');
  say('MEASURES  the acceptance measures the front-door gate was started on');
  say('');

  const one = frontDoorMeasure(root, boardDir, commits);
  say('FRONT DOOR  work must not reach a commit without its ticket entering in_progress');
  if (one.fault) {
    say('  FAULT  ' + one.fault);
    fault = true;
  } else {
    const n = one.offProcess.length;
    say('  target 0 of the last ' + one.examined + ' commits');
    say('  ' + one.work + ' of ' + one.examined + ' changed something outside the board and count as work');
    // THE HEADLINE NUMBER USED TO BE TAKEN AFTER WAIVING, so the one line stating the measure's
    // answer read zero while the next line said four were waived. A check whose own output
    // disproves its own summary is worse than one that says nothing. The total is the measure; the
    // waived count is how many of them somebody has accounted for.
    const waivedN = (one.waived || []).length;
    say('  ' + (n + waivedN) + ' of ' + one.work + ' work commits name a ticket that never ' +
      'entered in_progress' + (waivedN ? ', of which ' + waivedN + ' are waived below' : ''));
    for (const x of one.offProcess) say('    BREACH  ' + x.commit.hash + '  ' + x.ref + '  ' + x.commit.subject);
    // A WAIVED BREACH IS PRINTED, NEVER HIDDEN, AND IT COSTS THE CLEAN EXIT. Reporting it as a
    // pass would make a waived run indistinguishable from a run with nothing to say, which is the
    // false pass every check in this repository is written to avoid. Exit 3 is the same advisory
    // state releases-page uses: the gate accepts it, and no reader can mistake it for zero.
    if (one.waived && one.waived.length) {
      say('  ' + one.waived.length + ' breach(es) WAIVED, still counted as breaches and not as a pass:');
      for (const x of one.waived) {
        say('    WAIVED  ' + x.commit.hash + '  ' + x.ref + '  by ' + x.waiver.by);
        say('            ' + x.waiver.reason);
      }
      unproved = true;
    }
    for (const x of one.unknownRef) say('    unknown ticket  ' + x.commit.hash + '  ' + x.ref);
    if (one.admin.length) {
      say('  ' + one.admin.length + ' touched only the board and the record, set aside as ticket admin:');
      for (const c of one.admin) say('    ' + c.hash + '  ' + c.subject);
    }
    if (one.noRef.length) {
      say('  ' + one.noRef.length + ' work commit(s) name no ticket at all, reported and NOT counted:');
      for (const c of one.noRef) say('    ' + c.hash + '  ' + c.subject);
      say('    Nothing here can tell process work with no ticket from work done off the board.');
    }
    if (n > 0) breached = true;
  }
  say('');

  const two = overrideMeasure(boardDir, since);
  say('CEILING OVERRIDE  the gate must not be overridden more than one session in five');
  if (two.fault) {
    say('  FAULT  ' + two.fault);
    fault = true;
  } else if (two.empty) {
    say('  no override has ever been recorded, so there is nothing to rate yet');
  } else {
    say('  window ' + iso(two.shipped) + ' to ' + iso(two.end) + ', first reading due ' + iso(two.end));
    say('  ' + two.entries.length + ' override(s) in the window, from the committed ledger');
    for (const o of two.entries) say('    ' + o.at + '  ' + o.gate + '  ' + o.ref);
    say('  sessions in the window: NOT RECORDED ANYWHERE');
    say('  NOT PROVED. The numerator above is exact and the denominator does not exist: this');
    say('  board has no session identity of any kind, which is why the escalation built into');
    say('  the gate counts overrides per fourteen days rather than per session. Inventing a');
    say('  proxy here would report a number this check made up under a rule it did not write.');
    unproved = true;
  }
  say('');

  if (fault) return 2;
  if (breached) return 1;
  if (unproved) return 3;
  return 0;
}

module.exports = { frontDoorMeasure, overrideMeasure, everEnteredInProgress, refPattern, recordFiles, main };

if (require.main === module) process.exit(main(process.argv.slice(2)));
