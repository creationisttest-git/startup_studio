#!/usr/bin/env node
'use strict';
/**
 * archive-sittings.js -- moves older DATED SITTING BLOCKS out of a loaded state document and
 * leaves the trail followable from the one that remains.
 *
 * WHY THIS EXISTS, WHICH IS NOT THE SAME AS WHY archive-decisions.js EXISTS.
 *
 * A state document is @-imported, so it is re-sent on EVERY request for the life of every
 * session. Its two largest sections are dated history: a Current state block and a Session log
 * entry are written at every wind-down and neither is ever read again after the sitting that
 * follows it. `archive-decisions.js` already moves the decisions table out unsupervised. The two
 * sections that actually dominate the file had no equivalent and were moved BY HAND, at a
 * wind-down, by a session that had already spent its budget.
 *
 * THE DEFECT THIS FIXES IS THE TRIGGER, NOT THE MOVE. Archiving fired only when
 * `check-context-budget.js` REFUSED. So the limit became the target: the document was cut to
 * just under the ceiling and grew back to it, every sitting, and never went below. Six sittings
 * of this project's own record show the same shape, each one describing the move as "the
 * documented fallback rather than the plan". A saving you only take when you are forced to is a
 * saving you never compound.
 *
 *   node tools/archive-sittings.js <path-to-markdown-file> [--keep N] [--write]
 *                                  [--section "<heading>"] [--boundary "<text>"]
 *
 * DRY RUN BY DEFAULT, for the same reason archive-decisions.js is: this rewrites the one
 * artefact the studio treats as the record, and getting it wrong is worse than the bloat it
 * fixes. Without --write nothing on disk is modified and the plan is printed for a human.
 *
 * EXIT CODES, AND ONE OF THEM IS A DELIBERATE DEPARTURE FROM ITS SIBLING.
 *
 *     0   archived cleanly, OR there was nothing to archive
 *     1   refused: something could not be established safely, and nothing was written
 *     2   usage or read error
 *
 * `archive-decisions.js` exits 1 when there is nothing to do, and ST-263 records what that
 * costs: the wind-down runs it every sitting, a healthy document is the common case, so the
 * correct outcome is a non-zero code that every session must learn to ignore, sitting next to
 * three checks whose non-zero codes block a commit. Teaching a reader that an exit code carries
 * no information is worse than printing nothing at all. Here a no-op is success, because it is.
 *
 * HOW A DATED BLOCK IS RECOGNISED, and why each refusal is a refusal rather than a guess.
 *
 *   - AN OPENER IS A PARAGRAPH WHOSE LEADING BOLD SPAN CARRIES "<date>, <ORDINAL> sitting".
 *     The comma matters and is not cosmetic. Without it this pattern also matches the pointer
 *     paragraphs a previous archive left behind, which say things like "the 2026-09-10 TENTH
 *     sitting block is now in" and "Archived again 2026-09-10, at the FOURTH sitting WIND-DOWN".
 *     Archiving a pointer removes the trail to everything already archived.
 *
 *   - THE DATED REGION ENDS AT THE FIRST PARAGRAPH NAMING THE ARCHIVE FILE. This is the part
 *     that cannot be inferred from shape, and it is the reason this tool refuses instead of
 *     guessing. In a Current state section the dated blocks are followed by DURABLE state:
 *     which repositories exist, how many roles there are, what the board is. Those paragraphs
 *     are bold, look exactly like a block's continuation, and must never be archived, because
 *     they are the only copy of facts a session needs today. The existing pointer paragraph is
 *     the one reliable marker of where history stops and live state begins.
 *
 *   - IF THERE IS NO SUCH PARAGRAPH THE RUN REFUSES AND NAMES A REMEDY YOU CAN PERFORM.
 *     `--boundary "<text>"` names the first paragraph that is NOT dated history. A refusal with
 *     no performable remedy is the failure class this studio keeps recording, so this one has
 *     an answer rather than an apology.
 *
 *   - THE BLOCK DATES MUST NOT ASCEND. Newest first is the convention here, and archiving the
 *     wrong end discards exactly what the next session needs. If the dates rise anywhere in the
 *     region, which end is newest cannot be established and nothing is written.
 *
 * WHAT MAKES IT SAFE TO RUN UNSUPERVISED, which is the whole point of building it:
 *
 *   - IT PROVES THE SPLIT ACCOUNTS FOR EVERY LINE BEFORE IT WRITES ANYTHING. Kept plus archived
 *     must equal the region exactly, line for line, or the run is abandoned with the source
 *     untouched.
 *
 *   - IT WRITES EVERY ARCHIVE FIRST AND READS EACH ONE BACK FROM DISK. The source is rewritten
 *     only once every archive exists and every distinct non-blank line is proved present in it
 *     (S106). A crash between the two steps leaves duplication, which is recoverable, rather
 *     than a truncated record, which is not.
 *
 *   - IT LEAVES A POINTER, as a hard requirement. Moving history out of the loaded file stops it
 *     being re-read, which is the point, and stops it being SEEN, which is not.
 */

const fs = require('fs');
const path = require('path');

const KEEP_DEFAULT = 1;

// The sections this tool knows, each with the archive that belongs to it. Kept as data rather
// than as two code paths, because the two sections differ only in their names and a second code
// path is a second place for the safety proofs to be almost right.
const SECTIONS = [
  { heading: 'Current state', archive: 'WARM_START-ARCHIVE.md', noun: 'state block',
    title: 'Current state archive' },
  { heading: 'Session log', archive: 'SESSION-LOG-ARCHIVE.md', noun: 'session log entry',
    title: 'Session log archive' },
];

// The comma is load-bearing. See the header.
const OPENER = /(\d{4}-\d{2}-\d{2}),\s+([A-Z][A-Z-]*)\s+sitting/;

const args = process.argv.slice(2);
function flagValue (name) {
  const i = args.indexOf(name);
  return i > -1 ? args[i + 1] : null;
}
const write = args.includes('--write');
const KEEP = args.indexOf('--keep') > -1 ? parseInt(flagValue('--keep'), 10) : KEEP_DEFAULT;
const onlySection = flagValue('--section');
const boundaryOpt = flagValue('--boundary');

const valued = ['--keep', '--section', '--boundary'];
const consumed = new Set();
for (const v of valued) { const i = args.indexOf(v); if (i > -1) consumed.add(i + 1); }
const target = args.filter((a, i) => !a.startsWith('--') && !consumed.has(i))[0];

function die (msg) { console.error('archive-sittings: ' + msg); process.exit(2); }
function refuse (msg) { console.log('REFUSED  ' + msg); process.exit(1); }
function say (msg) { console.log('  ' + msg); }

if (!target) die('usage: node tools/archive-sittings.js <file> [--keep N] [--write]');
if (!fs.existsSync(target)) die('no such file: ' + target);
if (!Number.isInteger(KEEP) || KEEP < 1) die('--keep must be a positive whole number');

const src = fs.readFileSync(target, 'utf8');
const nl = src.indexOf('\r\n') > -1 ? '\r\n' : '\n';
const lines = src.split(/\r?\n/);

// --- reading the document ----------------------------------------------------------------------

// A paragraph is a run of non-blank lines. Blocks are found at paragraph level and not at line
// level because a block's opening sentence wraps: the date that identifies a sitting is routinely
// on the SECOND line of its own bold header, so any line-wise scan misses every block in the file.
function paragraphs (lo, hi) {
  const out = [];
  let buf = [], start = -1;
  for (let i = lo; i <= hi && i < lines.length; i++) {
    if (lines[i].trim() === '') {
      if (buf.length) { out.push({ start: start, end: i - 1, text: buf.join(' ') }); buf = []; }
      continue;
    }
    if (!buf.length) start = i;
    buf.push(lines[i]);
  }
  if (buf.length) out.push({ start: start, end: Math.min(hi, lines.length - 1), text: buf.join(' ') });
  return out;
}

function boldHead (text) {
  const m = text.match(/^\*\*([\s\S]+?)\*\*/);
  return m ? m[1] : '';
}

function sectionRange (heading) {
  const want = new RegExp('^##\\s+' + heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'i');
  let at = -1;
  for (let i = 0; i < lines.length; i++) { if (want.test(lines[i])) { at = i; break; } }
  if (at === -1) return null;
  let end = lines.length - 1;
  for (let i = at + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i]) || /^---\s*$/.test(lines[i])) { end = i - 1; break; }
  }
  return { start: at, end: end };
}

// --- planning one section -----------------------------------------------------------------------

function plan (section) {
  const range = sectionRange(section.heading);
  if (!range) return { section: section, skip: 'no "## ' + section.heading + '" section in this file' };

  const paras = paragraphs(range.start + 1, range.end);
  const openers = paras.filter(p => OPENER.test(boldHead(p.text)));
  if (!openers.length) return { section: section, skip: 'no dated sitting blocks under "' + section.heading + '"' };

  const first = openers[0];

  // Where history stops. The archive pointer is the marker; --boundary overrides it by naming
  // the first paragraph that is not dated history.
  const marker = boundaryOpt || section.archive;
  const bound = paras.find(p => p.start > first.start && p.text.indexOf(marker) > -1);
  if (!bound) {
    refuse('"' + section.heading + '" has dated blocks but nothing marking where they stop. This ' +
      'tool bounds the dated region at the first paragraph naming ' + section.archive + ', because ' +
      'the paragraphs after the last block are live state that looks identical to a block and must ' +
      'not be archived. Nothing was written. Re-run naming the first paragraph that is NOT dated ' +
      'history: --boundary "<a distinctive phrase from it>".');
  }

  const regionStart = first.start;
  const regionEnd = bound.start - 1;
  const inRegion = openers.filter(o => o.start >= regionStart && o.start <= regionEnd);

  const blocks = inRegion.map((o, i) => {
    const next = inRegion[i + 1];
    const m = boldHead(o.text).match(OPENER);
    return {
      start: o.start,
      end: next ? next.start - 1 : regionEnd,
      date: m[1],
      ordinal: m[2],
    };
  });

  // Newest first is the convention. If the dates rise anywhere, which end is newest cannot be
  // established and archiving the wrong end discards what the next session needs.
  const rises = [];
  for (let i = 1; i < blocks.length; i++) {
    if (blocks[i].date > blocks[i - 1].date) rises.push(blocks[i - 1].date + ' then ' + blocks[i].date);
  }
  if (rises.length) {
    refuse('the dates under "' + section.heading + '" rise ' + rises.length + ' time(s) (' +
      rises[0] + '), so they are in no consistent order and which end is newest cannot be ' +
      'established. Nothing was written.');
  }

  if (blocks.length <= KEEP) {
    return { section: section, skip: blocks.length + ' block(s) under "' + section.heading +
      '", keeping ' + KEEP + ', so there is nothing to archive yet' };
  }

  const keep = blocks.slice(0, KEEP);
  const move = blocks.slice(KEEP);

  // Prove the split accounts for every line of the region BEFORE anything is written.
  const regionLines = regionEnd - regionStart + 1;
  const counted = blocks.reduce((n, b) => n + (b.end - b.start + 1), 0);
  if (counted !== regionLines) {
    die('the split does not account for every line of "' + section.heading + '" (' + counted +
      ' against ' + regionLines + '). Nothing has been written.');
  }
  const seen = new Set();
  for (const b of blocks) for (let i = b.start; i <= b.end; i++) {
    if (seen.has(i)) die('line ' + (i + 1) + ' falls in two blocks at once. Nothing has been written.');
    seen.add(i);
  }
  if (seen.size !== regionLines) {
    die('a line of "' + section.heading + '" falls in no block. Nothing has been written.');
  }

  const body = [];
  for (const b of move) for (let i = b.start; i <= b.end; i++) body.push(lines[i]);
  while (body.length && body[body.length - 1].trim() === '') body.pop();

  return {
    section: section, regionStart: regionStart, regionEnd: regionEnd,
    blocks: blocks, keep: keep, move: move, body: body,
  };
}

// --- the pointer left behind ---------------------------------------------------------------------

function today () {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

// Wrapped to the width the rest of the document uses, and bold on the LEAD SENTENCE only rather
// than on the whole paragraph. Both are house style here, and a pointer that does not look like
// the document it sits in reads as machine exhaust, which is the first thing a reader skips.
const WIDTH = 98;
function wrap (text) {
  const out = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && (line + ' ' + word).length > WIDTH) { out.push(line); line = word; }
    else line = line ? line + ' ' + word : word;
  }
  if (line) out.push(line);
  return out;
}

function pointerFor (p, proved) {
  const s = p.section;
  const names = p.move.map(b => b.ordinal);
  const which = names.length === 1
    ? 'The ' + names[0] + ' sitting ' + s.noun
    : 'The ' + names[0] + ' back to ' + names[names.length - 1] + ' sitting ' + s.noun + 's';
  const verb = names.length === 1 ? 'was' : 'were';
  const lead = '**' + which + ' ' + verb + ' archived on ' + today() + ' to [' + s.archive + '](' +
    s.archive + ')**, unedited and in the same order.';
  const rest = proved + ' of ' + proved + ' distinct non-blank lines were proved present at the ' +
    'destination and read back from disk before a byte was removed here (S106), 0 missing. This ' +
    'file is @-imported and an archive is not, so a block moved out is still binding, exactly ' +
    'like an archived decision: read ' + s.archive + ' when you are looking for what an earlier ' +
    'sitting found.';
  return wrap(lead + ' ' + rest);
}

// --- run ------------------------------------------------------------------------------------------

const wanted = onlySection ? SECTIONS.filter(s => s.heading.toLowerCase() === onlySection.toLowerCase()) : SECTIONS;
if (!wanted.length) die('no section called "' + onlySection + '". Known: ' + SECTIONS.map(s => s.heading).join(', '));

const plans = wanted.map(plan);
const doable = plans.filter(p => !p.skip);

console.log('');
console.log('  ' + target + '  ' + src.length + ' characters');
for (const p of plans) {
  if (p.skip) { say(p.section.heading + ': ' + p.skip); continue; }
  say(p.section.heading + ': ' + p.blocks.length + ' dated block(s), keep ' + p.keep.length +
      ' (' + p.keep.map(b => b.ordinal).join(', ') + '), archive ' + p.move.length +
      ' (' + p.move.map(b => b.ordinal).join(', ') + ')');
  say('  ' + p.body.length + ' line(s) to ' + p.section.archive);
}
console.log('');

if (!doable.length) {
  console.log('Nothing to archive. The document is already inside the shape this tool keeps.');
  process.exit(0);
}

if (!write) {
  console.log('DRY RUN. Nothing was modified. Re-run with --write to apply.');
  process.exit(0);
}

// --- write every archive FIRST, and read each one back --------------------------------------------
const dir = path.dirname(target);
for (const p of doable) {
  const archivePath = path.join(dir, p.section.archive);
  const exists = fs.existsSync(archivePath);
  const header = [
    '# ' + p.section.title,
    '',
    'Moved out of `' + path.basename(target) + '` so they are not re-read on every request.',
    'Nothing here is retired: this is the same record, read on demand instead of every time.',
    'This file is deliberately NOT @-imported.',
    '',
  ].join(nl);
  const body = p.body.join(nl);
  const existing = exists ? fs.readFileSync(archivePath, 'utf8') : null;
  const out = exists
    ? existing.replace(/\s*$/, '') + nl + nl + body + nl
    : header + body + nl;
  fs.writeFileSync(archivePath, out, 'utf8');

  const readBack = fs.readFileSync(archivePath, 'utf8');
  const distinct = Array.from(new Set(p.body.filter(l => l.trim() !== '')));
  const missing = distinct.filter(l => readBack.indexOf(l) === -1);
  if (missing.length) {
    die(missing.length + ' of ' + distinct.length + ' distinct non-blank line(s) did not survive ' +
      'the write to ' + p.section.archive + '. The source has NOT been touched, so nothing is lost.');
  }
  p.proved = distinct.length;
  say(p.section.archive + ': ' + p.proved + ' of ' + p.proved + ' distinct non-blank lines read ' +
      'back from disk, 0 missing');
}

// --- only now rewrite the source --------------------------------------------------------------------
// Bottom up, so an earlier splice cannot move the line numbers a later one was computed against.
let rebuilt = lines.slice();
for (const p of doable.slice().sort((a, b) => b.regionStart - a.regionStart)) {
  const kept = [];
  for (const b of p.keep) for (let i = b.start; i <= b.end; i++) kept.push(lines[i]);
  while (kept.length && kept[kept.length - 1].trim() === '') kept.pop();
  const replacement = kept.concat([''], pointerFor(p, p.proved), ['']);
  rebuilt = rebuilt.slice(0, p.regionStart).concat(replacement, rebuilt.slice(p.regionEnd + 1));
}
const after = rebuilt.join(nl);
fs.writeFileSync(target, after, 'utf8');

console.log('');
console.log('archived ' + doable.reduce((n, p) => n + p.move.length, 0) + ' dated block(s)');
console.log(path.basename(target) + ' went ' + src.length + ' to ' + after.length + ' characters, ' +
  (src.length - after.length) + ' off every request');
process.exit(0);
