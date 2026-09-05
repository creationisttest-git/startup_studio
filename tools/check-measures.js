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
 *   board is ticket administration: raising one, recording an assessment, parking one, writing
 *   a note. None of that is work passing through the door. Counting it produced three breaches
 *   on the first run of this file where the true answer was zero, and a check that reports a
 *   breach every session is one nobody reads by the second week.
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
const { execFileSync } = require('child_process');

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

function isWork (root, hash, boardRel) {
  return changedFiles(root, hash).some(f => f.indexOf(boardRel) !== 0);
}

/* Measured: an entry written at 2026-09-04 05:23 reported a window opening 2026-09-03, because a
   stamp carrying no zone is read as local time while the board writes UTC. */
function parseStamp (at) {
  return Date.parse(String(at).replace(' ', 'T') + 'Z');
}

function frontDoorMeasure (root, boardDir, commits) {
  const pattern = refPattern(boardDir);
  if (!pattern) return { fault: 'no project.json, so ticket references cannot be recognised' };

  let log;
  try { log = gitLog(root, commits); } catch (e) {
    return { fault: 'the commit log cannot be read (' + String(e.message).split('\n')[0] + ')' };
  }
  const boardRel = path.basename(boardDir) + '/';
  const offProcess = [];
  const unknownRef = [];
  const noRef = [];
  const admin = [];

  for (const c of log) {
    let work;
    try { work = isWork(root, c.hash, boardRel); } catch (e) {
      return { fault: 'commit ' + c.hash + ' cannot be read (' + String(e.message).split('\n')[0] + ')' };
    }
    if (!work) { admin.push(c); continue; }
    const refs = c.subject.match(pattern);
    if (!refs) { noRef.push(c); continue; }
    for (const ref of refs) {
      const t = readTicket(boardDir, ref);
      if (!t) { unknownRef.push({ commit: c, ref: ref }); continue; }
      if (!everEnteredInProgress(t)) offProcess.push({ commit: c, ref: ref });
    }
  }
  return {
    examined: log.length, work: log.length - admin.length,
    offProcess: offProcess, unknownRef: unknownRef, noRef: noRef, admin: admin
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
    say('  ' + n + ' of ' + one.work + ' work commits name a ticket that never entered in_progress');
    for (const x of one.offProcess) say('    BREACH  ' + x.commit.hash + '  ' + x.ref + '  ' + x.commit.subject);
    for (const x of one.unknownRef) say('    unknown ticket  ' + x.commit.hash + '  ' + x.ref);
    if (one.admin.length) {
      say('  ' + one.admin.length + ' touched only the board and are set aside as ticket admin:');
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

module.exports = { frontDoorMeasure, overrideMeasure, everEnteredInProgress, refPattern, main };

if (require.main === module) process.exit(main(process.argv.slice(2)));
