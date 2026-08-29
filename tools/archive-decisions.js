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
  stop(rows.length + ' decision(s), keeping ' + KEEP + ', so there is nothing to archive yet');
}

// --- work out which end is newest -------------------------------------------------------------
// Both directions exist in this studio today, so this is established rather than assumed.
function idOf(line) {
  const m = line.match(/^\|\s*([A-Za-z]*)(\d+)\s*\|/);
  return m ? parseInt(m[2], 10) : null;
}
const firstId = idOf(rows[0].line);
const lastId = idOf(rows[rows.length - 1].line);
if (firstId === null || lastId === null || firstId === lastId) {
  stop('cannot tell which end of the table is newest from the row identifiers, so nothing was ' +
       'written. Archiving the wrong rows discards exactly what somebody needs.');
}
const newestFirst = firstId > lastId;

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
const pointer = 'Decisions ' + span + ' are in [' + ARCHIVE_NAME + '](' + ARCHIVE_NAME + '), which ' +
  'is deliberately not imported. Read it when looking for a decision that is not listed above.';

console.log('');
console.log('  ' + target);
console.log('    ' + rows.length + ' decision(s), ' + (newestFirst ? 'newest first' : 'oldest first'));
console.log('    keep    ' + keep.length);
console.log('    archive ' + archive.length + '  (' + span + ')');
console.log('    pointer ' + pointer.slice(0, 72) + '...');
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

// --- only now rewrite the source ---------------------------------------------------------------
const rebuilt = lines.slice(0, headerAt + 2)
  .concat(keep.map(r => r.line))
  .concat([''], [pointer])
  .concat(lines.slice(end));
fs.writeFileSync(target, rebuilt.join(nl), 'utf8');

console.log('archived ' + archive.length + ' decision(s) to ' + ARCHIVE_NAME);
console.log('kept ' + keep.length + ' in ' + path.basename(target) + ', with a pointer to the rest');
process.exit(0);
