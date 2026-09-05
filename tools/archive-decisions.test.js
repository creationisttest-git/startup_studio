#!/usr/bin/env node
'use strict';
/*
 * Tests for archive-decisions.js.
 *
 * Every assertion here has been watched failing, by breaking the tool and confirming this suite
 * goes red. A check nobody has seen fail is indistinguishable from one that always passes.
 *
 * This tool rewrites the one artefact the studio treats as the record, so the assertions that
 * matter most are not that it works, but that it REFUSES: refuses when it cannot tell which end
 * of the table is newest, refuses when there is no table, and above all never writes a source
 * file it has not already proved it can reconstruct. Nothing lost and nothing duplicated are
 * asserted by reading both files back and comparing against the original rows, not by trusting
 * a count the tool printed about itself.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TOOL = path.join(__dirname, 'archive-decisions.js');
let pass = 0, fail = 0;
function ok (name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL  ' + name); } }

const junk = [];
function doc (rows, opts) {
  const o = opts || {};
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-arch-'));
  junk.push(d);
  const head = o.noTable
    ? ['# Doc', '', 'no table here', '']
    : ['# Doc', '', '## Decisions', '', '| # | Decision | Resolution | Date |', '|---|---|---|---|'];
  const body = head.concat(rows, ['', '## After', '', 'tail text']).join('\n') + '\n';
  const p = path.join(d, 'WARM_START.md');
  fs.writeFileSync(p, body, 'utf8');
  return { dir: d, file: p };
}
function run (file, extra) {
  const a = [TOOL, file].concat(extra || []);
  try { return { code: 0, out: execFileSync('node', a, { stdio: ['pipe', 'pipe', 'pipe'] }).toString() }; }
  catch (e) { return { code: e.status, out: ((e.stdout || '') + (e.stderr || '')).toString() }; }
}
const desc = n => Array.from({ length: n }, (_, i) => '| S' + (n - i) + ' | decision | reason | 2026-01-01 |');
const asc = n => Array.from({ length: n }, (_, i) => '| ' + (i + 1) + ' | decision | reason | 2026-01-01 |');

// --- a dry run is a dry run -------------------------------------------------------------------
{
  const { file } = doc(desc(30));
  const before = fs.readFileSync(file, 'utf8');
  const r = run(file);
  ok('a dry run exits clean', r.code === 0);
  ok('and it modifies nothing at all', fs.readFileSync(file, 'utf8') === before);
  ok('and it says so rather than looking like it acted', /DRY RUN/.test(r.out));
}

// --- THE ASSERTION THIS TOOL EXISTS TO EARN: nothing is lost -----------------------------------
{
  const rows = desc(30);
  const { dir, file } = doc(rows);
  run(file, ['--write']);
  const live = fs.readFileSync(file, 'utf8');
  const arch = fs.readFileSync(path.join(dir, 'DECISIONS-ARCHIVE.md'), 'utf8');
  ok('every original decision survives somewhere',
     rows.every(r => live.indexOf(r) > -1 || arch.indexOf(r) > -1));
  ok('and none of them survives in BOTH places',
     rows.every(r => !(live.indexOf(r) > -1 && arch.indexOf(r) > -1)));
  ok('the live document keeps exactly the number asked for',
     rows.filter(r => live.indexOf(r) > -1).length === 20);
  ok('and the live document points at the archive', /DECISIONS-ARCHIVE\.md/.test(live));
  ok('content after the table is untouched', /## After/.test(live) && /tail text/.test(live));
}

// --- the direction of the table is established, never assumed ----------------------------------
// Both directions exist in this studio right now, and archiving the wrong twenty would discard
// exactly the rows somebody needs.
{
  const rows = desc(30); // S30 down to S1, newest first
  const { dir, file } = doc(rows);
  run(file, ['--write']);
  const live = fs.readFileSync(file, 'utf8');
  ok('newest-first: the NEWEST rows are the ones kept', live.indexOf('| S30 |') > -1);
  ok('newest-first: the OLDEST rows are the ones archived', live.indexOf('| S1 |') === -1);
}
{
  const rows = asc(30); // 1 up to 30, oldest first
  const { dir, file } = doc(rows);
  run(file, ['--write']);
  const live = fs.readFileSync(file, 'utf8');
  ok('oldest-first: the NEWEST rows are still the ones kept', live.indexOf('| 30 |') > -1);
  ok('oldest-first: the OLDEST rows are still the ones archived', live.indexOf('| 1 |') === -1);
}

// --- it refuses rather than guessing -----------------------------------------------------------
{
  const rows = Array.from({ length: 30 }, () => '| x | decision | reason | 2026-01-01 |');
  const { file } = doc(rows);
  const before = fs.readFileSync(file, 'utf8');
  const r = run(file, ['--write']);
  ok('an unreadable row order is refused', r.code === 1);
  ok('and the refusal explains why rather than just failing', /cannot tell which end/.test(r.out));
  ok('and nothing was written when it refused', fs.readFileSync(file, 'utf8') === before);
}
{
  const { file } = doc(['not a table'], { noTable: true });
  const r = run(file, ['--write']);
  ok('a document with no decisions table is refused', r.code === 1);
}
{
  const { file } = doc(desc(5));
  const before = fs.readFileSync(file, 'utf8');
  const r = run(file, ['--write']);
  ok('a table smaller than the keep count is left alone', r.code === 1);
  ok('and that document is untouched too', fs.readFileSync(file, 'utf8') === before);
}

// --- a second run must not destroy the first archive -------------------------------------------
// Archiving happens every wind-down, so appending is the normal path, not the exception.
{
  const first = desc(30);
  const { dir, file } = doc(first);
  run(file, ['--write']);
  const archOne = fs.readFileSync(path.join(dir, 'DECISIONS-ARCHIVE.md'), 'utf8');
  const archivedFirst = first.filter(r => archOne.indexOf(r) > -1);
  // Grow the live table again, the way a working project does, then archive a second time.
  const grown = fs.readFileSync(file, 'utf8').replace('|---|---|---|---|\n',
    '|---|---|---|---|\n' + desc(15).map(r => r.replace('| S', '| S1')).join('\n') + '\n');
  fs.writeFileSync(file, grown, 'utf8');
  run(file, ['--write']);
  const archTwo = fs.readFileSync(path.join(dir, 'DECISIONS-ARCHIVE.md'), 'utf8');
  ok('a second archiving run does not discard what the first one saved',
     archivedFirst.every(r => archTwo.indexOf(r) > -1));
}

junk.forEach(d => fs.rmSync(d, { recursive: true, force: true }));
/* Measured: a fatal guard firing part way through the studio suite reported 0 failed
   and exit 0, having run 22 of 214, so a count of failures cannot see an assertion that
   never ran. The total is pinned here, and the number is written down rather than measured
   from the run it checks, because a self-updating total agrees with any run. S35 is the same
   rule applied to the summary. Mutation: delete an assertion above and this goes red alone. */
const EXPECTED_ASSERTIONS = 20;
const ranBefore = pass + fail;
ok('the suite ran every assertion: ran ' + (ranBefore + 1) + ' of ' + EXPECTED_ASSERTIONS
  + '. A block was skipped or deleted. Find out which before you change the number.',
  ranBefore === EXPECTED_ASSERTIONS - 1);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
