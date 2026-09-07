#!/usr/bin/env node
/**
 * check-decision-keys.js -- does any decision key in this project name more than one decision?
 *
 * WHY THIS EXISTS. A decisions table is append-only and is referenced by key for the life of the
 * project, so a key that names two different decisions makes every later reference ambiguous and
 * silently rewrites what was agreed. It happened here on 2026-09-06: two sessions writing to one
 * project on the same day each read the table, each took the highest key it could see, and each
 * appended from its own count, so D-091 and D-092 ended up naming four different decisions. The
 * board program already documents this hazard for TICKET numbers and calls it single writer,
 * declared rather than enforced. Nobody had noticed it applies just as hard to decisions, which
 * are the one structure in this method that is never renumbered and never reused.
 *
 * IT WAS ONLY VISIBLE BECAUSE THAT PROJECT GOT A REPOSITORY THE SAME DAY. Before that there was
 * no diff to read, and the second writer would simply have won with nothing anywhere reporting
 * it. Two people caught this one between them; no tool could see it.
 *
 * WHAT COUNTS AS A DUPLICATE, AND THE DISTINCTION THAT COST THREE FALSE FINDINGS ON THE FIRST
 * RUN. A key twice inside ONE document is always a fault, and that is the shape the real
 * collision took. Across documents it depends on which document: a key in a live table and again
 * in its ARCHIVE is a fault, because archiving MOVES a row rather than copying it, and this
 * studio has recorded one move that wrote to the archive and then failed to remove from the
 * source. A key in two non-archive documents is NOT a fault: a project may keep a short index
 * beside the full table, and one on this machine says so in its own text. Pooling every document
 * together reported 95 duplicates in that project, all of them the index doing its job.
 *
 * WHY THE SECTION HEADING BOUNDS THE SCAN, AND NOT THE SHAPE OF A ROW. These documents are full
 * of tables, and several use a decision key as an ordinary row label: a status row reading
 * D-076 page-view conversion is a report ON that decision, not a second declaration of it. A
 * scan recognising rows by shape counted those as duplicates. So the scan runs only between a
 * heading that names decisions and the next heading of the same or a higher level.
 *
 * AND A HEADING IS NOT ENOUGH ON ITS OWN. These documents carry prose headings that merely
 * mention the word, so a section counts only once a table actually starts beneath it. Without
 * that, a project with no decisions table at all reported five sections and zero keys and then
 * PASSED, which is a check reporting clean on a document it could not read.
 *
 * KEYS ARE NOT WRITTEN THE SAME WAY EVERYWHERE, and assuming one shape is how the second false
 * finding happened. This studio writes S114, most projects write D-091, and one writes a bare
 * integer. All three are accepted; anything else in a first cell is prose and is not a key.
 *
 * WHAT IT PROVES, AND IT IS NARROWER THAN IT LOOKS. It proves no key is declared twice where
 * that is a fault. It does not prove the decisions are consistent, that a reversal was recorded
 * as a new row rather than an edit, or that a key referenced elsewhere exists at all. It reads
 * committed text and nothing else.
 *
 * THREE ANSWERS, AND THE THIRD IS WHY IT LOCKS NOBODY OUT. A key naming two decisions: exit 1,
 * and that refuses, because it is a positive finding. Every key unique: exit 0. NO DECISIONS
 * TABLE ANYWHERE, or one whose keys this cannot read: exit 3, advisory, named out loud and never
 * a refusal. That branch is not hypothetical -- of the projects on the machine this was written
 * on, two keep no decisions table at all, and a check refusing on something a legitimate project
 * can never satisfy locks that project out for good.
 */
'use strict';
const fs = require('fs');
const path = require('path');

// The documents a project keeps decisions in, live and archived. Named rather than found by
// walking every markdown file, because this check runs at session start and has to stay cheap.
const DOCS = [
  'WARM_START.md',
  'WAYS_OF_WORKING.md',
  'DECISIONS-ARCHIVE.md',
  'WARM_START-ARCHIVE.md',
  'GLOBAL_WAYS_OF_WORKING.md'
];
const SKIP_DIRS = ['.git', 'node_modules', '.archive', '.public', '.publish-work', '.dist'];
const HEADING = /^(#+)\s*(.*)$/;
const NAMES_DECISIONS = /decision/i;
const SEPARATOR = /^\|\s*:?-{3}/;
const KEY = /^[A-Za-z]{0,6}-?\d{1,5}$/;
const IS_ARCHIVE = /archive/i;

function findDocs (root, depth) {
  const out = [];
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of entries) {
    const full = path.join(root, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.indexOf(e.name) !== -1 || e.name.charAt(0) === '.') continue;
      if (depth > 0) out.push.apply(out, findDocs(full, depth - 1));
    } else if (DOCS.indexOf(e.name) !== -1) {
      out.push(full);
    }
  }
  return out;
}

function keysIn (file) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch (e) { return { why: e.message }; }
  const lines = raw.split(/\r?\n/);
  const found = [];
  let tables = 0;
  let level = 0;
  let inSection = false;
  let tabled = false;
  for (let i = 0; i < lines.length; i++) {
    const h = HEADING.exec(lines[i]);
    if (h) {
      if (inSection && h[1].length <= level) { inSection = false; tabled = false; }
      if (!inSection && NAMES_DECISIONS.test(h[2])) { inSection = true; tabled = false; level = h[1].length; }
      continue;
    }
    if (!inSection) continue;
    const line = lines[i];
    if (line.charAt(0) !== '|') continue;
    if (!tabled) {
      if (SEPARATOR.test(line)) { tabled = true; tables++; }
      continue;
    }
    const end = line.indexOf('|', 1);
    const cell = line.slice(1, end === -1 ? line.length : end).trim();
    if (!KEY.test(cell)) continue;
    found.push({ key: cell, file: file, line: i + 1 });
  }
  return { found: found, tables: tables };
}

function clashesIn (all) {
  const seen = Object.create(null);
  for (const k of all) {
    if (!seen[k.key]) seen[k.key] = [];
    seen[k.key].push(k);
  }
  const out = [];
  for (const key of Object.keys(seen).sort()) {
    const rows = seen[key];
    if (rows.length < 2) continue;
    const byFile = Object.create(null);
    for (const r of rows) byFile[r.file] = (byFile[r.file] || 0) + 1;
    const twiceInOne = Object.keys(byFile).some(f => byFile[f] > 1);
    const files = Object.keys(byFile);
    const live = files.filter(f => !IS_ARCHIVE.test(path.basename(f)));
    const archived = files.filter(f => IS_ARCHIVE.test(path.basename(f)));
    if (twiceInOne) out.push({ key: key, rows: rows, why: 'declared twice in one document' });
    else if (live.length && archived.length) out.push({ key: key, rows: rows, why: 'in a live table and in an archive, so a move did not finish' });
  }
  return out;
}

function main (argv) {
  const quiet = argv.indexOf('--quiet') !== -1;
  const say = m => { if (!quiet) process.stdout.write(m + '\n'); };
  const ri = argv.indexOf('--root');
  // A flag with nothing after it, or one that would swallow the next flag as its value, is a
  // usage error. Without this the first case threw out of path.resolve at exit 1, and exit 1 in
  // this tool is the code for a DUPLICATE DECISION KEY, so a typo published as a positive
  // finding; the second silently measured the working directory and answered a question nobody
  // asked.
  if (ri !== -1) {
    const v = argv[ri + 1];
    if (v === undefined || v.slice(0, 2) === '--') {
      process.stderr.write('check-decision-keys: --root needs a value after it\n');
      return 2;
    }
  }
  const root = path.resolve(ri === -1 ? process.cwd() : argv[ri + 1]);

  const all = [];
  let tables = 0;
  for (const d of findDocs(root, 2)) {
    const r = keysIn(d);
    if (r.why) continue;
    tables += r.tables;
    all.push.apply(all, r.found);
  }

  if (!tables) {
    process.stdout.write('  CANNOT TELL. no decisions table in any state document under ' + root + '\n');
    process.stdout.write('  Looked in: ' + DOCS.join(', ') + ', two levels deep.\n');
    return 3;
  }
  if (!all.length) {
    process.stdout.write('  CANNOT TELL. ' + tables + ' decisions table(s) found and no key in any of them was readable.\n');
    process.stdout.write('  A key is letters and digits, hyphen optional, or a bare number. This is not a pass.\n');
    return 3;
  }

  const clashes = clashesIn(all);
  if (clashes.length) {
    process.stdout.write('  DUPLICATE DECISION KEY. ' + clashes.length + ' key(s) name more than one decision.\n');
    for (const c of clashes) {
      process.stdout.write('    ' + c.key + ', ' + c.why + ':\n');
      for (const at of c.rows) process.stdout.write('      ' + path.relative(root, at.file) + ':' + at.line + '\n');
    }
    process.stdout.write('  Renumber the later one and leave a forwarding row. Never reuse a key.\n');
    return 1;
  }

  say('  ' + all.length + ' decision key(s) across ' + tables + ' table(s), every one unique.');
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { main, keysIn, clashesIn, findDocs, KEY, DOCS };
