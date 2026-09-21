#!/usr/bin/env node
/**
 * archive-decisions.js -- moves older decisions out of a loaded document and leaves the trail
 * followable from the one that remains.
 *
 * Why this exists. A decisions table is append-only and is read in full at the start of every
 * session, by every session, forever, because `CLAUDE.md` @-imports the document holding it. One
 * project reached 141 rows inside a single loaded file of 181,000 characters. The policy for this
 * has existed in the wind-down skill for months and is specific: archive all but the most recent
 * twenty, move them to a file that is NOT @-imported, leave a line saying which numbers went
 * where. Five projects sailed past it. An instruction that is 0 for 5 is not a control, so this
 * executes the policy rather than restating it a sixth time.
 *
 *   node tools/archive-decisions.js <path-to-markdown-file> [--keep N] [--write]
 *
 * DRY RUN BY DEFAULT. Without --write nothing on disk is modified and the split is printed for
 * a human to look at. Exit 0 clean, 1 if there is nothing to do or a check fails, 2 on a usage
 * or read error.
 *
 * WHAT MAKES THIS SAFE TO RUN AUTOMATICALLY, because it rewrites the one artefact the studio
 * treats as the record and getting it wrong is worse than the bloat it fixes:
 *
 *   - IT PROVES NOTHING IS LOST BEFORE IT WRITES ANYTHING. kept + archived must equal the
 *     original row count exactly, and every original row must appear in one side or the other
 *     byte for byte. If that does not hold the run is abandoned with the source untouched.
 *
 *   - IT WRITES THE ARCHIVE FIRST AND READS IT BACK. The source is only rewritten once the
 *     archive exists on disk and contains the rows it is supposed to contain. A crash between
 *     the two steps leaves a complete archive and a complete source, which is duplication and
 *     recoverable, rather than a truncated source, which is not.
 *
 *   - IT REFUSES RATHER THAN GUESSING THE ORDER. A decisions table can be newest-first or
 *     oldest-first, and both exist in this studio right now: one project numbers S61 down to S1
 *     and another numbers 1 up to 141. Archiving the wrong twenty would discard exactly the rows
 *     somebody needs. If the direction cannot be established from the row identifiers, nothing
 *     is written and the run says so.
 *
 *   - IT LEAVES A POINTER, and that is a hard requirement rather than a courtesy. Moving
 *     decisions out of the loaded file stops them being re-read, which is the point, and stops
 *     them being SEEN, which is not. A decision nobody can find gets argued again from the
 *     start, and this studio has already retired an entire document because overlapping
 *     locations meant none of them was trusted.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const KEEP_DEFAULT = 20;
const ARCHIVE_NAME = 'DECISIONS-ARCHIVE.md';

const args = process.argv.slice(2);
const write = args.includes('--write');
const keepArg = args.indexOf('--keep');
const KEEP = keepArg > -1 ? parseInt(args[keepArg + 1], 10) : KEEP_DEFAULT;
const target = args.filter((a, i) => !a.startsWith('--') && !(keepArg > -1 && i === keepArg + 1))[0];

function die(msg) { console.error('archive-decisions: ' + msg); process.exit(2); }
function stop(msg) { console.log(msg); process.exit(1); }
function say(msg) { console.log('  ' + msg); }

// --- THE POINTER IS ONE LINE, NOT ONE LINE PER RUN --------------------------------------------
// This tool used to concatenate a fresh pointer above everything that followed the table, and
// everything that followed the table included every pointer it had ever written. So the receipt
// for archiving accumulated in the file that archiving exists to shrink: WARM_START.md carried 51
// of these, 171 characters each, about 8,700 characters of one sentence repeated, re-sent on
// EVERY request for the life of every session. Measured at the thirty-fifth sitting: the archiver
// residue was 20.4 per cent of that document. The project that did the right thing was the only
// one carrying the penalty for it, which is why this is a PRECONDITION for asking any other
// project to adopt archiving rather than a tidy-up to do afterwards.
//
// THE RANGE IS READ BACK FROM THE ARCHIVE FILE RATHER THAN ACCUMULATED FROM THE OLD POINTERS.
// Summing what the old lines CLAIM would carry any error in them forward forever and would print
// a contiguous span over rows that were never moved. The archive file is the only ground truth
// about what is in the archive, so the pointer is derived from it and is true by construction.
// Gaps are printed as separate ranges rather than smoothed into one, because a pointer that
// overstates its coverage sends the next reader to a file that does not hold what it promised.
//
// THIS RUNS EVEN WHEN THERE IS NOTHING TO ARCHIVE, and that is the difference between a fix that
// pays now and one that pays whenever somebody next happens to cross the retention threshold. The
// residue is already in the file; it is not created by this run and it should not wait for one.
// The real document had 20 live rows against a keep of 20, so the tool exited before it reached
// the consolidation and the entire 8,700 character saving would have sat there until the next
// archive. Found by running the tool on the real file rather than by reading it.
const POINTER_RE = new RegExp('^Decisions (\\d+) to (\\d+) are in \\[' + ARCHIVE_NAME.replace('.', '\\.'));

function rangesOf(list) {
  const sorted = Array.from(new Set(list)).sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < sorted.length; i++) {
    const lo = sorted[i];
    while (i + 1 < sorted.length && sorted[i + 1] === sorted[i] + 1) i++;
    out.push(lo === sorted[i] ? String(lo) : lo + ' to ' + sorted[i]);
  }
  return out;
}

function pointerFor(list) {
  const r = rangesOf(list);
  const span = r.length ? r.join(', ') : 'older entries';
  return 'Decisions ' + span + ' are in [' + ARCHIVE_NAME + '](' + ARCHIVE_NAME + '), which ' +
    'is deliberately not imported. Read it when looking for a decision that is not listed above.';
}

// Returns { lines, removed, unproved } or null when there is nothing it can safely do. It NEVER
// writes: the caller decides, so the dry run stays a dry run.
function consolidate(allLines, from, archivedIds) {
  const found = [];
  for (let i = from; i < allLines.length; i++) {
    const m = allLines[i].match(POINTER_RE);
    if (m) found.push({ at: i, lo: parseInt(m[1], 10), hi: parseInt(m[2], 10) });
  }
  if (found.length < 2) return null;
  const have = new Set(archivedIds);
  const unproved = [];
  for (const p of found) {
    if (!have.has(p.lo)) unproved.push(p.lo);
    if (!have.has(p.hi)) unproved.push(p.hi);
  }
  if (unproved.length) return { lines: null, removed: 0, unproved: Array.from(new Set(unproved)).sort((a, b) => a - b) };
  const drop = new Set(found.map(p => p.at));
  const kept = allLines.slice(0, from);
  let first = true;
  for (let i = from; i < allLines.length; i++) {
    if (!drop.has(i)) { kept.push(allLines[i]); continue; }
    if (first) { kept.push(pointerFor(archivedIds)); first = false; continue; }
    if (kept.length && kept[kept.length - 1] === '') kept.pop();
  }
  return { lines: kept, removed: found.length - 1, unproved: [] };
}

if (!target) die('usage: node tools/archive-decisions.js <file> [--keep N] [--write]');
if (!fs.existsSync(target)) die('no such file: ' + target);
if (!Number.isInteger(KEEP) || KEEP < 1) die('--keep must be a positive whole number');

const src = fs.readFileSync(target, 'utf8');
const nl = src.indexOf('\r\n') > -1 ? '\r\n' : '\n';
const lines = src.split(/\r?\n/);

// --- find the table -------------------------------------------------------------------------
// Located by its HEADER rather than by a heading, because the heading is named differently in
// different projects and the header row is the thing that actually defines the shape.
let headerAt = -1;
for (let i = 0; i < lines.length; i++) {
  if (/^\|/.test(lines[i]) && /decision/i.test(lines[i]) && /^\|[\s:-]+\|/.test(lines[i + 1] || '')) {
    headerAt = i; break;
  }
}
if (headerAt === -1) stop('no decisions table found in ' + target + ', so there is nothing to archive');

const rows = [];
let end = headerAt + 2;
for (; end < lines.length; end++) {
  if (!/^\|/.test(lines[end])) break;
  rows.push({ line: lines[end], index: end });
}
if (rows.length <= KEEP) {
  // NOTHING TO ARCHIVE IS NOT NOTHING TO DO. Accumulated pointers are residue from PREVIOUS runs
  // and they cost on every request whether or not this run has rows to move, so the consolidation
  // is attempted here too. Everything else about the run is unchanged: dry by default, and the
  // pointer is still derived from the archive file read from disk rather than from the old lines.
  const ap = path.join(path.dirname(target), ARCHIVE_NAME);
  if (fs.existsSync(ap)) {
    const ids = fs.readFileSync(ap, 'utf8').split(/\r?\n/).map(idOf).filter(n => n !== null);
    const c = consolidate(lines, end, ids);
    if (c && c.unproved.length) {
      stop(rows.length + ' decision(s), keeping ' + KEEP + ', so there is nothing to archive yet. ' +
        'The pointers were NOT consolidated either: ' + c.unproved.length + ' identifier(s) they ' +
        'name are absent from ' + ARCHIVE_NAME + ' (' + c.unproved.join(', ') + '), and removing a ' +
        'pointer to something this tool cannot find would delete the only trail to it.');
    }
    if (c) {
      const before = src.length;
      const out = c.lines.join(nl);
      say(rows.length + ' decision(s), keeping ' + KEEP + ', so there is nothing to archive yet, ' +
          'but ' + (c.removed + 1) + ' pointer(s) are in the file and ' + c.removed + ' of them ' +
          'are residue from earlier runs');
      say('consolidating to 1 saves ' + (before - out.length) + ' characters on EVERY request');
      if (!write) {
        console.log('DRY RUN. Nothing was modified. Re-run with --write to apply.');
        process.exit(0);
      }
      fs.writeFileSync(target, out, 'utf8');
      const check = fs.readFileSync(target, 'utf8');
      if (check.indexOf(pointerFor(ids)) === -1) {
        die('the consolidated pointer is not in ' + path.basename(target) + ' after the write.');
      }
      console.log('consolidated ' + (c.removed + 1) + ' pointer(s) to 1 in ' + path.basename(target) +
                  ', ' + (before - check.length) + ' characters off every request');
      process.exit(0);
    }
  }
  stop(rows.length + ' decision(s), keeping ' + KEEP + ', so there is nothing to archive yet');
}

// --- work out which end is newest -------------------------------------------------------------
// Both directions exist in this studio today, so this is established rather than assumed.
//
// THE IDENTIFIER MAY CARRY A SEPARATOR, AND FOR WEEKS IT COULD NOT. The pattern was
// ([A-Za-z]*)(\d+), letters immediately against digits, so S147 parsed and D-001 returned null.
// One project numbers its decisions with a hyphen; this one does not. So this tool archived
// cleanly here and refused there, twice, on a table that was contiguous D-001 to D-121 with no
// gaps and nothing ambiguous about it, while that project's decisions table passed 73,193
// characters against a 60,000 trigger with the only tool that could act on it unable to read it.
function idOf(line) {
  const m = line.match(/^\|\s*([A-Za-z]*)[-_ ]?(\d+)\s*\|/);
  return m ? parseInt(m[2], 10) : null;
}

// READ THE WHOLE COLUMN, NOT THE TWO ENDS. Asking only the first and last row let one
// unreadable row at either end refuse a table whose other rows settled the order beyond doubt,
// and it could not see a table that is neither ascending nor descending at all, which is the
// case actually worth refusing.
const rowIds = rows.map(r => idOf(r.line));
const readable = rowIds.filter(v => v !== null).length;
if (readable < 2) {
  stop('could not read a decision number from ' + (rows.length - readable) + ' of ' + rows.length +
       ' row(s), so the order of the table is unknown and nothing was written. A row identifier ' +
       'is optional letters, an optional -, _ or space, then digits, as in S147, D-001 or 91.');
}

let up = 0, down = 0, prev = null;
const breaks = [];
for (let i = 0; i < rowIds.length; i++) {
  if (rowIds[i] === null) continue;
  if (prev !== null) {
    if (rowIds[i] > prev) up++;
    else if (rowIds[i] < prev) down++;
    else breaks.push(rowIds[i]);
  }
  prev = rowIds[i];
}
if (up > 0 && down > 0) {
  stop('the decision numbers rise ' + up + ' time(s) and fall ' + down + ' time(s), so the table ' +
       'is in no consistent order and which end is newest cannot be established. Nothing was ' +
       'written, because archiving the wrong rows discards exactly what somebody needs.');
}
if (up === 0 && down === 0) {
  stop('every readable decision number is the same, so which end is newest cannot be established ' +
       'from them. Nothing was written.');
}
// SAY WHICH SIGNAL DECIDED IT. The old refusal named a condition that had not fired, and two
// sessions read it and believed their data was ambiguous when the fault was this parser (S139).
const newestFirst = down > 0;
say(readable + ' of ' + rows.length + ' row(s) carry a readable number, ' +
    (newestFirst ? 'descending' : 'ascending') + ', so the newest is at the ' +
    (newestFirst ? 'TOP' : 'BOTTOM') +
    (breaks.length ? '. ' + breaks.length + ' repeated number(s), which do not decide the order' : ''));

const keep = newestFirst ? rows.slice(0, KEEP) : rows.slice(rows.length - KEEP);
const archive = newestFirst ? rows.slice(KEEP) : rows.slice(0, rows.length - KEEP);

// --- prove nothing is lost, BEFORE writing anything -------------------------------------------
if (keep.length + archive.length !== rows.length) {
  die('split does not account for every row (' + keep.length + ' + ' + archive.length +
      ' is not ' + rows.length + '). Nothing has been written.');
}
const seen = new Set(keep.concat(archive).map(r => r.index));
if (seen.size !== rows.length) {
  die('a row appears on both sides of the split or on neither. Nothing has been written.');
}

const ids = archive.map(r => idOf(r.line)).filter(n => n !== null);
const span = ids.length ? Math.min(...ids) + ' to ' + Math.max(...ids) : 'older entries';

// The pointer helpers are defined near the top, because the consolidation also has to run on the
// path where there is nothing new to archive. See THE POINTER IS ONE LINE there.
const priorPointers = [];
for (let i = end; i < lines.length; i++) {
  const m = lines[i].match(POINTER_RE);
  if (m) priorPointers.push({ at: i, lo: parseInt(m[1], 10), hi: parseInt(m[2], 10) });
}

const pointer = pointerFor(ids);

console.log('');
console.log('  ' + target);
console.log('    ' + rows.length + ' decision(s), ' + (newestFirst ? 'newest first' : 'oldest first'));
console.log('    keep    ' + keep.length);
console.log('    archive ' + archive.length + '  (' + span + ')');
if (priorPointers.length) {
  console.log('    pointers ' + priorPointers.length + ' already in the file, consolidating to 1, ' +
              'saving about ' + (priorPointers.length * (pointer.length + 1)) + ' characters');
}
console.log('');

if (!write) {
  console.log('DRY RUN. Nothing was modified. Re-run with --write to apply.');
  process.exit(0);
}

// --- write the archive FIRST, and read it back ------------------------------------------------
const archivePath = path.join(path.dirname(target), ARCHIVE_NAME);
const header = [
  '# Decisions archive',
  '',
  'Moved out of `' + path.basename(target) + '` so they are not re-read on every request. Nothing',
  'here is retired: this is the same trail, read on demand instead of every time. This file is',
  'deliberately NOT @-imported.',
  '',
  lines[headerAt],
  lines[headerAt + 1],
].join(nl);

const existing = fs.existsSync(archivePath) ? fs.readFileSync(archivePath, 'utf8') : null;
const body = archive.map(r => r.line).join(nl);
const out = existing
  ? existing.replace(/\s*$/, '') + nl + body + nl
  : header + nl + body + nl;
fs.writeFileSync(archivePath, out, 'utf8');

const readBack = fs.readFileSync(archivePath, 'utf8');
const missing = archive.filter(r => readBack.indexOf(r.line) === -1);
if (missing.length) {
  die(missing.length + ' row(s) did not survive the write to ' + ARCHIVE_NAME +
      '. The source has NOT been touched, so nothing is lost.');
}

// --- derive the consolidated pointer from the archive, and PROVE it before removing anything ----
// Removing a pointer line deletes a claim about where something lives, so this is the same class
// of act as removing a decision row and it gets the same protection as S106: every identifier the
// old lines named is looked for IN THE ARCHIVE FILE READ BACK FROM DISK, and if one is not there
// the old pointers are left exactly where they are. A consolidation that cannot prove it preserved
// the trail is a deletion wearing a consolidation's costume, which is tech-lead's objection 2 at
// the thirty-fifth sitting front door, recorded on ST-257.
const archivedIds = readBack.split(/\r?\n/).map(idOf).filter(n => n !== null);
const archivedSet = new Set(archivedIds);
const unproved = [];
for (const p of priorPointers) {
  if (!archivedSet.has(p.lo)) unproved.push(p.lo);
  if (!archivedSet.has(p.hi)) unproved.push(p.hi);
}

let pointerBlock = [pointer];
let tail = lines.slice(end);
if (priorPointers.length) {
  if (unproved.length) {
    console.log('  ' + priorPointers.length + ' existing pointer(s) were NOT consolidated: ' +
      unproved.length + ' identifier(s) they name are absent from ' + ARCHIVE_NAME +
      ' (' + Array.from(new Set(unproved)).sort((a, b) => a - b).join(', ') + '). ' +
      'They are left where they are, because removing a pointer to something this tool cannot ' +
      'find in the archive would delete the only trail to it.');
  } else {
    pointerBlock = [pointerFor(archivedIds)];
    const priorAt = new Set(priorPointers.map(p => p.at));
    const trimmed = [];
    for (let i = end; i < lines.length; i++) {
      if (priorAt.has(i)) {
        // drop the pointer, and the blank line that was inserted with it, never a line of prose
        if (trimmed.length && trimmed[trimmed.length - 1] === '') trimmed.pop();
        continue;
      }
      trimmed.push(lines[i]);
    }
    tail = trimmed;
  }
}

// --- only now rewrite the source ---------------------------------------------------------------
const rebuilt = lines.slice(0, headerAt + 2)
  .concat(keep.map(r => r.line))
  .concat([''], pointerBlock)
  .concat(tail);
fs.writeFileSync(target, rebuilt.join(nl), 'utf8');

console.log('archived ' + archive.length + ' decision(s) to ' + ARCHIVE_NAME);
console.log('kept ' + keep.length + ' in ' + path.basename(target) + ', with a pointer to the rest');
process.exit(0);
