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
/* ST-281: fixture roots come from ONE place that makes them unique and removes them at exit. */
const { fixtureRoot } = require('./tmp-fixtures.js');

const TOOL = path.join(__dirname, 'archive-decisions.js');
let pass = 0, fail = 0;
function ok (name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL  ' + name); } }

const junk = [];
function doc (rows, opts) {
  const o = opts || {};
  const d = fixtureRoot('studio-arch');
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
  // Restated, not edited green (S134). This fixture has NO readable number in any row, so the
  // honest refusal is that the numbers could not be READ. The old message said the order could
  // not be told from them, which is a different condition and was printed for both; two sessions
  // in another project read it and believed their table was ambiguous when it was contiguous
  // D-001 to D-121 and the parser simply could not see a hyphen (S139).
  ok('and the refusal names the condition that actually fired, unreadable numbers',
    /could not read a decision number from 30 of 30/.test(r.out));
  ok('and nothing was written when it refused', fs.readFileSync(file, 'utf8') === before);
}
/* ST-187 M3. THE FIXTURE ABOVE HAS ZERO READABLE ROWS, SO IT EXERCISES NEITHER BOUNDARY, and the
   release gate proved both refusals were unwatched: raising the threshold to readable < 1, and
   deleting the all-equal branch outright, each left this suite at 25 passed 0 failed. Both are on
   the --write path and both fail the way this tool must never fail, by acting on a guess.
   Mutation: readable < 2 becomes readable < 1 and the first pair goes red; delete the all-equal
   stop() and the second pair does; the zero-readable fixture above stays green through both,
   which is what makes these boundaries rather than a second copy of it. */
{
  // EXACTLY ONE readable row. One number cannot establish an order, and with the threshold at 1
  // it does not refuse here at all: it falls through to the all-equal branch and refuses with the
  // WRONG REASON, which is the ST-176 defect itself, in the tool that was rewritten to end it.
  const rows = Array.from({ length: 29 }, () => '| x | decision | reason | 2026-01-01 |')
    .concat(['| S7 | decision | reason | 2026-01-01 |']);
  const { file } = doc(rows);
  const before = fs.readFileSync(file, 'utf8');
  const r = run(file, ['--write']);
  ok('ONE readable number out of thirty cannot establish an order and is refused', r.code === 1);
  ok('and it refuses for the reason that actually fired, that the numbers could not be read',
    /could not read a decision number from 29 of 30/.test(r.out));
  ok('and nothing was written', fs.readFileSync(file, 'utf8') === before);
}
{
  // EVERY readable number IDENTICAL. up and down are both zero, so nothing says which end is
  // newest. Without the branch, newestFirst = down > 0 is false, the tool announces ASCENDING
  // and archives from the TOP on a --write: the exact outcome its own refusal calls out, that
  // archiving the wrong rows discards precisely what somebody needs.
  const rows = Array.from({ length: 30 }, () => '| S9 | decision | reason | 2026-01-01 |');
  const { file } = doc(rows);
  const before = fs.readFileSync(file, 'utf8');
  const r = run(file, ['--write']);
  ok('a table whose readable numbers are ALL THE SAME is refused rather than archived', r.code === 1);
  ok('and it names that condition rather than announcing an order it cannot have established',
    /every readable decision number is the same/.test(r.out) && !/ascending/.test(r.out));
  ok('and nothing was written', fs.readFileSync(file, 'utf8') === before);
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

// --- the two conditions the old refusal could not tell apart ------------------------------------
/* THE DEFECT THIS FIX EXISTS FOR. The identifier pattern was letters immediately against digits,
   so S147 parsed and D-001 did not. One project numbers with a hyphen, so this tool archived
   cleanly in the studio and refused there twice while its decisions table passed the size trigger.
   Mutation: drop the [-_ ]? from idOf and the first pair goes red while the ambiguous-order block
   below stays green, which is what makes this a proof about the SEPARATOR rather than about
   refusing less. */
{
  const rows = Array.from({ length: 30 }, (_, i) => '| D-' + String(i + 1).padStart(3, '0') + ' | decision | reason | 2026-01-01 |');
  const { file } = doc(rows);
  const r = run(file, []);
  ok('a hyphenated identifier is read, so an ascending D-001 table is not refused', r.code === 0);
  ok('and it says which signal decided the order rather than leaving the reader to guess',
    /ascending/.test(r.out) && /30 of 30/.test(r.out));
}
{
  // The control, and the case the old message CLAIMED: numbers that genuinely go both ways.
  // Nothing can establish which end is newest here, and it must still refuse.
  const rows = ['| 5 | d | r | 2026-01-01 |', '| 9 | d | r | 2026-01-01 |', '| 2 | d | r | 2026-01-01 |']
    .concat(Array.from({ length: 27 }, (_, i) => '| ' + (i + 20) + ' | d | r | 2026-01-01 |'));
  const { file } = doc(rows);
  const before = fs.readFileSync(file, 'utf8');
  const r = run(file, ['--write']);
  ok('a table that rises AND falls is refused, which is what the old message only claimed',
    r.code === 1);
  ok('and the refusal counts both directions rather than naming a condition it did not test',
    /rise 2[0-9]* time\(s\) and fall/.test(r.out) || /rise \d+ time\(s\) and fall \d+ time\(s\)/.test(r.out));
  ok('and nothing was written', fs.readFileSync(file, 'utf8') === before);
}

// --- THE POINTER IS ONE LINE, NOT ONE PER RUN -------------------------------------------------
// Measured on the real WARM_START.md at the thirty-fifth sitting: 51 pointer lines, 171 characters
// each, about 8,700 characters of ONE SENTENCE REPEATED, re-sent on every request of every session.
// The tool concatenated a new pointer above everything after the table, and everything after the
// table was every pointer it had ever written. So the receipt for archiving accumulated inside the
// document archiving exists to shrink, and the only project that had ever archived was the only
// one paying for it. Watched failing: commenting out `tail = trimmed` returns 1, 2, 3 pointers
// across three runs while the range in the top pointer stays correct, which is what isolates this
// control from the range derivation below it.
{
  const rows = Array.from({ length: 60 }, (_, i) => '| S' + (60 - i) + ' | d | r | 2026-01-01 |');
  const { file } = doc(rows);
  const ptrs = () => fs.readFileSync(file, 'utf8').split('\n')
    .filter(l => /^Decisions .* are in \[DECISIONS-ARCHIVE/.test(l));

  run(file, ['--keep', '40', '--write']);
  ok('the first archive leaves exactly one pointer', ptrs().length === 1);
  ok('and it names the range it moved', /^Decisions 1 to 20 are in/.test(ptrs()[0]));

  const r2 = run(file, ['--keep', '20', '--write']);
  ok('a SECOND archive still leaves exactly one pointer, rather than adding another',
    ptrs().length === 1);
  ok('and the one pointer now covers everything in the archive, not just this run',
    /^Decisions 1 to 40 are in/.test(ptrs()[0]));
  ok('and the run says it consolidated rather than doing it silently',
    /consolidating to 1/.test(r2.out));

  run(file, ['--keep', '10', '--write']);
  ok('a THIRD archive still leaves exactly one pointer', ptrs().length === 1);
  ok('and the range grew again', /^Decisions 1 to 50 are in/.test(ptrs()[0]));

  const after = fs.readFileSync(file, 'utf8');
  ok('prose after the table is never removed by the consolidation', after.includes('tail text'));
  ok('and the heading after the table survives', after.includes('## After'));
  ok('and no run of blank lines is left where the old pointers were', !/\n\n\n/.test(after));
  const arch = fs.readFileSync(path.join(path.dirname(file), 'DECISIONS-ARCHIVE.md'), 'utf8');
  ok('every decision the single pointer claims is actually in the archive: the low end',
    arch.includes('| S1 |'));
  ok('and the high end', arch.includes('| S50 |'));
  ok('and the row just outside the claim is still live in the source', after.includes('| S51 |'));
}

// --- A POINTER IT CANNOT PROVE IS LEFT WHERE IT IS ---------------------------------------------
// Removing a pointer deletes a claim about where something lives, which is the same class of act
// as removing a decision row and gets the same protection as S106: every identifier the old line
// names is looked for IN THE ARCHIVE READ BACK FROM DISK. A consolidation that cannot prove it
// preserved the trail is a deletion wearing a consolidation's costume. tech-lead's objection 2 at
// the thirty-fifth sitting front door, on ST-257.
{
  const rows = Array.from({ length: 60 }, (_, i) => '| S' + (60 - i) + ' | d | r | 2026-01-01 |');
  const { file } = doc(rows);
  const lying = 'Decisions 900 to 999 are in [DECISIONS-ARCHIVE.md](DECISIONS-ARCHIVE.md), which '
    + 'is deliberately not imported. Read it when looking for a decision that is not listed above.';
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('## After', lying + '\n\n## After'), 'utf8');

  const r = run(file, ['--keep', '40', '--write']);
  const after = fs.readFileSync(file, 'utf8');
  ok('a pointer naming identifiers absent from the archive is NOT removed',
    after.includes('Decisions 900 to 999'));
  ok('and the run says so rather than consolidating silently', /NOT consolidated/.test(r.out));
  ok('and it names the identifiers it could not find, so the reader can go and look',
    /900, 999/.test(r.out));
  ok('and the archive still happened, because one unprovable pointer is not a reason to stop',
    after.includes('Decisions 1 to 20 are in'));
  ok('and prose is still untouched on the refusal path', after.includes('tail text'));
}

// --- A GAPPED RANGE IS A POINTER THIS TOOL WROTE AND COULD NOT READ BACK ------------------------
/* HIGH 1 and HIGH 2 on ST-302, and the second is why the first survived. POINTER_RE recognised
   ONE of the three sentences pointerFor emits: the contiguous "N to M" form. It did not recognise
   the GAPPED form, "1 to 27, 32 to 40", which pointerFor writes whenever the archive has a hole in
   it, and it did not recognise the SINGLE form, "Decisions 5 are in", written when exactly one row
   moves. Every fixture in this file used S60..S1 with no gap, so every range it could generate was
   contiguous and the branch was never entered: a confident name over an unexercised path, S254.

   THE REAL FILE HAS THE HOLE. S28 to S31 were never allocated in this project, so WARM_START.md
   carried TWO gapped pointers the tool walked straight past, and the steady state measured on
   ST-302 is one NEW pointer every two runs: the exact residue the consolidation exists to remove.

   WHY IT IS WORSE THAN RESIDUE. archive-decisions.js derives the replacement pointer from THIS
   RUN's archive read back from disk. That is correct, and it is only safe because the unrecognised
   line is still sitting there holding the older claim. Hand-remove the duplicates, which is the
   obvious tidy-up, and the next archive leaves S1 to S237 with no pointer at all. Text is never at
   risk; the TRAIL is.

   WATCHED FAILING, and the count was predicted before it was run: 4 of these assertions redden
   against the old POINTER_RE, two in each block, and they are the pointer COUNT and the
   CONSOLIDATION MESSAGE at the run that follows a gapped or single pointer. The range assertions
   stay green throughout, because the top pointer is always correct and the stale one is below it,
   which is precisely what makes this defect invisible to a reader checking the range. */
{
  // 1..27 and 32..60, descending, which is this project's own shape rather than an invented one.
  const ids = [];
  for (let n = 60; n >= 32; n--) ids.push(n);
  for (let n = 27; n >= 1; n--) ids.push(n);
  const rows = ids.map(n => '| S' + n + ' | decision | reason | 2026-01-01 |');
  const { file } = doc(rows);
  const ptrs = () => fs.readFileSync(file, 'utf8').split('\n')
    .filter(l => /^Decisions .* are in \[DECISIONS-ARCHIVE/.test(l));

  run(file, ['--keep', '40', '--write']);
  ok('gapped table: the first archive leaves exactly one pointer', ptrs().length === 1);
  ok('and its range is contiguous, because the hole is not in what moved',
    /^Decisions 1 to 16 are in/.test(ptrs()[0]));

  const r2 = run(file, ['--keep', '20', '--write']);
  ok('the second archive crosses the hole and still leaves exactly one pointer', ptrs().length === 1);
  ok('and the pointer prints the gap as two ranges rather than smoothing over rows it does not hold',
    /^Decisions 1 to 27, 32 to 40 are in/.test(ptrs()[0]));
  ok('and the second run says it consolidated', /consolidating to 1/.test(r2.out));

  const r3 = run(file, ['--keep', '10', '--write']);
  ok('a THIRD archive reads back the GAPPED pointer it wrote itself and still leaves one',
    ptrs().length === 1);
  ok('and the third run says it consolidated, rather than silently appending a second pointer',
    /consolidating to 1/.test(r3.out));
  ok('and the one pointer covers both sides of the hole',
    /^Decisions 1 to 27, 32 to 50 are in/.test(ptrs()[0]));

  const arch = fs.readFileSync(path.join(path.dirname(file), 'DECISIONS-ARCHIVE.md'), 'utf8');
  ok('the row below the hole is in the archive', arch.includes('| S27 |'));
  ok('and the row above it is too', arch.includes('| S32 |'));
  ok('and no row inside the hole was invented', !/\| S(28|29|30|31) \|/.test(arch));
  ok('prose after the table survived every run',
    fs.readFileSync(file, 'utf8').includes('tail text'));
}

// --- AND THE SINGLE-IDENTIFIER FORM, WHICH IS THE THIRD SENTENCE pointerFor WRITES --------------
/* One row archived produces "Decisions 5 are in [...]" with no "to" in it at all. Same defect,
   different sentence, and it needs its own fixture because a gapped range cannot produce it. */
{
  const { file } = doc(desc(21));
  const ptrs = () => fs.readFileSync(file, 'utf8').split('\n')
    .filter(l => /^Decisions .* are in \[DECISIONS-ARCHIVE/.test(l));

  run(file, ['--keep', '20', '--write']);
  ok('one row archived writes a pointer with no range in it', /^Decisions 1 are in/.test(ptrs()[0]));
  ok('and there is exactly one of them', ptrs().length === 1);

  const r2 = run(file, ['--keep', '19', '--write']);
  ok('the next archive reads that single-identifier pointer back and still leaves one',
    ptrs().length === 1);
  ok('and it says it consolidated', /consolidating to 1/.test(r2.out));
  ok('and the range now names both', /^Decisions 1 to 2 are in/.test(ptrs()[0]));
}

// --- THE TIDY-UP MUST NOT BE ABLE TO LOSE THE TRAIL ---------------------------------------------
/* ST-302 MEDIUM 5, and it is the half of HIGH 1 that survives HIGH 1 being fixed. The replacement
   pointer used to be derived from the rows THIS RUN moved, and it was only the stale line sitting
   below it that still held the older claim. So the moment a pointer is not there to be read, for
   any reason, everything archived before this run silently stops being pointed at. The obvious
   tidy-up on seeing duplicate pointers is to delete them by hand, and that is exactly the input
   that triggers it: the fixture below does the tidy-up and then archives again.

   THE ARCHIVE FILE READ BACK FROM DISK IS THE ONLY GROUND TRUTH about what is in the archive, which
   is what the header of this tool has said since it was written. Deriving the pointer from anything
   else, including from this run, makes it a claim about the run rather than about the file.

   Watched failing: predicted exactly 1 assertion would redden and measured 1. The count assertion
   stays green throughout, which is the point: nothing about the number of pointers is wrong on this
   path, only what the single remaining one covers. */
{
  const { file } = doc(desc(60));
  const ptrs = () => fs.readFileSync(file, 'utf8').split('\n')
    .filter(l => /^Decisions .* are in \[DECISIONS-ARCHIVE/.test(l));

  run(file, ['--keep', '40', '--write']);
  ok('the first archive points at what it moved', /^Decisions 1 to 20 are in/.test(ptrs()[0]));

  // the hand tidy-up WARM_START.md warns about, done exactly as a person would do it
  const tidied = fs.readFileSync(file, 'utf8').split('\n')
    .filter(l => !/^Decisions .* are in \[DECISIONS-ARCHIVE/.test(l)).join('\n');
  fs.writeFileSync(file, tidied, 'utf8');
  ok('the tidy-up really did remove every pointer, so the next run starts with none',
    ptrs().length === 0);

  run(file, ['--keep', '20', '--write']);
  ok('archiving after the tidy-up leaves exactly one pointer', ptrs().length === 1);
  ok('and it covers everything in the ARCHIVE, not only the rows this run moved, so the tidy-up '
    + 'cannot lose the trail', /^Decisions 1 to 40 are in/.test(ptrs()[0]));

  const arch = fs.readFileSync(path.join(path.dirname(file), 'DECISIONS-ARCHIVE.md'), 'utf8');
  ok('the oldest row the pointer claims is genuinely in the archive', arch.includes('| S1 |'));
}

const EXPECTED_ASSERTIONS = 71;
const ranBefore = pass + fail;
ok('the suite ran every assertion: ran ' + (ranBefore + 1) + ' of ' + EXPECTED_ASSERTIONS
  + '. A block was skipped or deleted. Find out which before you change the number.',
  ranBefore === EXPECTED_ASSERTIONS - 1);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
