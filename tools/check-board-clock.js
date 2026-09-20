#!/usr/bin/env node
'use strict';

/*
 * check-board-clock.js -- a board directory holds ONE clock, and the rows say which.
 *
 * WHAT IT IS FOR, AND WHY THE SHARED MODULE IS NOT ENOUGH ON ITS OWN (ST-283). The defect was
 * three programs writing one `.board/` in two clock namespaces, in an identical text shape, so
 * nothing on a row said which clock produced it. base/board/clock.js fixes that for the three
 * writers anybody knows about. It cannot see the FOURTH writer, and a fourth writer is exactly
 * how the third one arrived: doctor-record.js and run-checks.js were each written correctly,
 * months apart, by somebody who had not read board.js.
 *
 * So this reads the FILES rather than the programs. A stamp on disk is the only evidence that
 * does not depend on knowing who wrote it, which is the same reasoning as deriving what a suite
 * proves by deleting lines rather than by reading it (S228), and the same as resolving a board by
 * SHAPE rather than by the name somebody guessed (S218).
 *
 * BUT IT DOES NOT YET CATCH THE FOURTH WRITER, AND THE PARAGRAPH ABOVE OVERSTATED THAT (ST-285).
 * A product reviewer proved it on 2026-09-19 by planting a new ledger and doctor-findings-archive
 * .jsonl, both full of bare stamps, and watching this exit 0 saying "OK one clock". The reason is
 * the line below: the file list is HARDCODED, so a fourth writer is seen only if somebody
 * remembers to add its name here, which is the same act of remembering that missed the THIRD
 * writer and is the whole reason ST-283 existed. Reading files rather than programs was necessary
 * and is not sufficient; the sufficient version reads the directory and classifies BY SHAPE.
 * Two more gaps the same review found, also ST-285: a bare stamp under a field this does not
 * consider time-named is invisible, as is any stamp inside an array, and the ratchet is one
 * aggregate so an archive run can mask a real rise. Until those land, believe the narrow claim
 * only: in the files LISTED BELOW, under the time-named fields listed further down, this reports
 * stamps that do not say which clock produced them.
 *
 * THE THREE STATES A STAMP CAN BE IN.
 *   marked     "2026-09-18 22:30:06Z"   says its namespace. The only state written from now on.
 *   bare       "2026-09-18 22:30:06"    legacy. Ambiguous: bare rows from board.js are UTC and
 *                                       bare rows from the two tools are local, and by the time
 *                                       a reader holds the string that distinction is gone.
 *   date-only  "2026-09-11"             no clock in it. Counted and reported separately rather
 *                                       than lumped in with bare, because a waiver stamped to
 *                                       the day is not the defect and calling it one would
 *                                       inflate the number the ratchet is supposed to drive down.
 *
 * IT IS A RATCHET AND NOT A REFUSAL, AND THAT IS DELIBERATE. There are hundreds of bare stamps
 * on disk in this repository alone. Refusing until they are gone would mean either rewriting
 * history, which is the thing the ticket explicitly forbids, or a check nobody can ever make
 * pass, which gets its predicate weakened instead of satisfied (S232). So the count of bare
 * stamps is pinned to a baseline and may only FALL. One new bare stamp is a new writer, or a
 * writer that stopped using the clock, and both are the defect coming back.
 *
 * A FALL DOES NOT PASS QUIETLY EITHER. It is reported and the baseline has to be rewritten by
 * hand with --write-baseline, because a number that lowers itself agrees with any run.
 *
 * EXIT CODES.
 *   0  bare count is at or below the baseline.
 *   1  bare count ROSE. A stamp was written outside the one namespace.
 *   2  could not read the board or the baseline. Not a pass; say so.
 *   3  CANNOT TELL: there is no board here. A project that has not adopted a board is not a
 *      project in breach, and a check that refuses in that case locks it out of committing.
 *
 *   node tools/check-board-clock.js [--board <dir>] [--baseline <file>] [--write-baseline] [--quiet]
 */

const fs = require('fs');
const path = require('path');
const clock = require('./clock.js');

const argv = process.argv.slice(2);
const TAKES_VALUE = ['--board', '--baseline'];
function arg (name, fallback) {
  const i = argv.indexOf(name);
  if (i === -1) return fallback;
  const v = argv[i + 1];
  return (v === undefined || (v.slice(0, 2) === '--' && TAKES_VALUE.indexOf(v) !== -1)) ? fallback : v;
}
function has (name) { return argv.indexOf(name) !== -1; }

const quiet = has('--quiet');
function out (s) { if (!quiet) process.stdout.write(s + '\n'); }
function always (s) { process.stdout.write(s + '\n'); }

/* A BOARD IS FOUND BY SHAPE, WHICH IS HOW ITS OWNER DEFINES ONE (S218). A directory holding
 * project.json with a tickets directory beside it IS a board, whatever it is called. Looking for
 * the literal name `.board` is what once reported a live 154-ticket board as absent. */
function findBoardDir (start) {
  const isBoard = d => {
    try { return fs.existsSync(path.join(d, 'project.json')) && fs.statSync(path.join(d, 'tickets')).isDirectory(); }
    catch (e) { return false; }
  };
  const isRepo = d => { try { return fs.existsSync(path.join(d, '.git')); } catch (e) { return false; } };
  // A level is the directory itself, or a board-shaped directory sitting directly inside it.
  // The child scan is what finds `.board` when you point at a project root, so it cannot go.
  const atLevel = d => {
    if (isBoard(d)) return d;
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { entries = []; }
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const cand = path.join(d, ent.name);
      if (isBoard(cand)) return cand;
    }
    return null;
  };

  const dir0 = path.resolve(start);
  const hit0 = atLevel(dir0);
  if (hit0) return hit0;

  // THE WALK UP IS BOUNDED BY THE REPOSITORY, AND DOES NOT HAPPEN AT ALL OUTSIDE ONE (ST-291).
  //
  // It used to climb four levels unconditionally, scanning every child at each one. Combined,
  // those two mean a directory with no board of its own finds a board belonging to a SIBLING of
  // one of its ancestors, which is never what anybody wanted. On this machine it resolved an
  // empty directory in the shared operating-system temp folder to a leftover fixture sitting
  // beside it, reported on that board, and exited 0 where the answer is CANNOT TELL. Two
  // assertions had been red for at least two commits and the release suite carried the failure
  // with nothing naming it.
  //
  // It is the same unbounded walk that once made `init` capable of rewriting a real board from
  // a test run, and the answer is the same one board.js already uses: stop at the repository.
  // Walking up is a convenience for somebody standing inside a project. Outside a repository
  // there is no project to walk up into, so the convenience has no meaning and the sibling scan
  // is pure hazard. The level HOLDING the repository marker is still searched, because a board
  // is normally a child of the repository root.
  // THE FIRST VERSION OF THIS BOUND DID NOT HOLD, AND A REVIEWER FALSIFIED IT BY PLANTING.
  // It asked `isRepo(dir0) || ancestors.some(isRepo)` and then scanned EVERY ancestor it had
  // collected. A directory that is itself a repository satisfied the first half, so the walk
  // carried on straight out of that repository and scanned its parent's children. Planted with
  // a real git init: a repository holding no board, a neighbour board beside it, and this tool
  // reported on the neighbour at exit 0, which is the exact defect the bound was added for.
  // The sentence claiming it was fixed had already been written into the release note.
  //
  // The bound that does hold names the boundary instead of testing for one. A repository root
  // has no ancestor worth searching, because a board belongs to a project and not to whatever
  // directory the project happens to sit in. Above dir0, search up to and INCLUDING the first
  // ancestor holding the marker, then stop. Find no marker within the depth cap and search no
  // ancestor at all, because without a repository there is no project to walk up into.
  if (isRepo(dir0)) return null;

  const ancestors = [];
  let probe = dir0;
  for (let up = 0; up < 4; up++) {
    const parent = path.dirname(probe);
    if (parent === probe) break;
    probe = parent;
    ancestors.push(probe);
    if (isRepo(probe)) {
      for (const d of ancestors) {
        const hit = atLevel(d);
        if (hit) return hit;
      }
      return null;
    }
  }
  return null;
}

/* WHICH FIELDS HOLD A TIME. By KEY rather than by scanning every string, and the reason is a
 * false positive that would have been very hard to argue with: a doctor finding is free prose
 * and the findings in this repository QUOTE timestamps, because the defect being recorded was
 * about timestamps. A value-shape scan would have counted the quotation as a bad stamp, the
 * baseline would have absorbed it, and the check would have been grading its own subject matter.
 *
 * The predicate is deliberately open at the end: anything named `*_at`, plus the handful of
 * fields that hold a time under another name. A new temporal field named in the usual way is
 * covered without this file being edited, which is the property that matters, since being edited
 * is what this check exists to not depend on. */
function isTimeKey (k) {
  return k === 'at' || /_at$/.test(k) || k === 'firstSeen' || k === 'written' || k === 'stamped';
}

const STAMP = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function classify (v) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (DATE_ONLY.test(s)) return 'dateOnly';
  if (!STAMP.test(s)) return null;
  return clock.isMarked(s) ? 'marked' : 'bare';
}

/* Walks anything: the ticket files are objects with nested history and decision arrays, the
 * ledgers are arrays of objects, and the record is one object per line. One walker rather than
 * five readers, so a nested stamp cannot hide behind a shape nobody wrote a reader for. */
function walk (node, where, hits) {
  if (Array.isArray(node)) {
    node.forEach((v, i) => walk(v, where + '[' + i + ']', hits));
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (v && typeof v === 'object') { walk(v, where + '.' + k, hits); continue; }
    if (!isTimeKey(k)) continue;
    const kind = classify(v);
    if (kind) hits.push({ kind: kind, where: where + '.' + k, value: String(v) });
  }
}

function readJson (p) {
  try { return { ok: true, data: JSON.parse(fs.readFileSync(p, 'utf8')) }; }
  catch (e) { return { ok: false, why: e.message }; }
}

function scan (boardDir) {
  const hits = [];
  const unreadable = [];
  const files = [];

  const ticketsDir = path.join(boardDir, 'tickets');
  let ticketFiles = [];
  try { ticketFiles = fs.readdirSync(ticketsDir).filter(f => /\.json$/.test(f)); } catch (e) { ticketFiles = []; }
  for (const f of ticketFiles) files.push(path.join(ticketsDir, f));
  for (const f of ['project.json', 'overrides.json', 'front-door-waivers.json', 'checks.json']) {
    const p = path.join(boardDir, f);
    if (fs.existsSync(p)) files.push(p);
  }

  for (const p of files) {
    const r = readJson(p);
    if (!r.ok) { unreadable.push({ file: p, why: r.why }); continue; }
    walk(r.data, path.basename(p), hits);
  }

  /* The record is JSON LINES, so it is read a line at a time and a damaged line is REPORTED
   * rather than taking the scan down. A reader that refuses a damaged record locks out every
   * project at once; that asymmetry is already settled in doctor-record.js and is repeated here
   * rather than re-argued. */
  const rec = path.join(boardDir, 'doctor-findings.jsonl');
  if (fs.existsSync(rec)) {
    let lines = [];
    try { lines = fs.readFileSync(rec, 'utf8').split(/\r?\n/).filter(s => s.trim()); }
    catch (e) { unreadable.push({ file: rec, why: e.message }); }
    lines.forEach((line, i) => {
      let row;
      try { row = JSON.parse(line); } catch (e) { unreadable.push({ file: rec, why: 'line ' + (i + 1) + ': ' + e.message }); return; }
      walk(row, 'doctor-findings.jsonl[' + (i + 1) + ']', hits);
    });
  }

  return { hits: hits, unreadable: unreadable, fileCount: files.length };
}

// ---- run ------------------------------------------------------------------------------------

const root = path.resolve(arg('--board', process.cwd()));
const boardDir = findBoardDir(root);
const baselineFile = path.resolve(arg('--baseline', path.join(__dirname, 'board-clock-baseline.json')));

if (!boardDir) {
  always('CANNOT TELL  no board under ' + root + ', so there are no stamps to hold to one clock.');
  always('  A board is a directory holding project.json with tickets beside it (S218).');
  process.exit(3);
}

const res = scan(boardDir);
const bare = res.hits.filter(h => h.kind === 'bare');
const marked = res.hits.filter(h => h.kind === 'marked');
const dateOnly = res.hits.filter(h => h.kind === 'dateOnly');

let baseline = null;
if (fs.existsSync(baselineFile)) {
  const r = readJson(baselineFile);
  if (!r.ok) {
    always('CANNOT READ  ' + baselineFile + ': ' + r.why);
    always('  A baseline that cannot be read is not a baseline of zero.');
    process.exit(2);
  }
  baseline = r.data;
}

out('');
out('BOARD CLOCK  ' + boardDir);
out('  ' + res.fileCount + ' json file(s) plus the record, ' + res.hits.length + ' stamp(s)');
out('  marked     ' + marked.length + '   carry their namespace, which is the only shape written now');
out('  bare       ' + bare.length + '   legacy and ambiguous, held to a baseline that may only fall');
out('  date-only  ' + dateOnly.length + '   no clock in them, so nothing to disagree about');

for (const u of res.unreadable) out('  UNREADABLE ' + u.file + ': ' + u.why);

if (has('--write-baseline')) {
  const next = { bare: bare.length, note: 'Legacy stamps with no namespace marker, counted by check-board-clock.js. This number may only fall. A rise is a writer that stopped using base/board/clock.js, or a new one that never started (ST-283).' };
  fs.writeFileSync(baselineFile, JSON.stringify(next, null, 2) + '\n', 'utf8');
  always('  BASELINE WRITTEN  bare = ' + bare.length + '  ' + baselineFile);
  process.exit(0);
}

if (!baseline || typeof baseline.bare !== 'number') {
  always('CANNOT READ  no usable baseline at ' + baselineFile);
  always('  Run once with --write-baseline, having read the count above and agreed with it.');
  process.exit(2);
}

if (bare.length > baseline.bare) {
  always('');
  always('BOARD CLOCK  FAIL  bare stamps rose from ' + baseline.bare + ' to ' + bare.length + '.');
  always('  A stamp with no namespace marker was written into ' + boardDir + '.');
  always('  Every writer into a board directory must stamp through base/board/clock.js, so that');
  always('  the rows in it can be put in order against each other (ST-283). The newest ones:');
  for (const h of bare.slice(-8)) always('    ' + h.value + '  ' + h.where);
  always('  Find the writer, give it the clock, and do not raise this number.');
  always('');
  process.exit(1);
}

if (bare.length < baseline.bare) {
  out('  FELL  bare stamps went ' + baseline.bare + ' to ' + bare.length + '. Rewrite the baseline:');
  out('    node tools/check-board-clock.js --write-baseline');
}

out('  OK  one clock, and ' + marked.length + ' row(s) say which.');
out('');
process.exit(0);
