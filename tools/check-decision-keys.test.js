#!/usr/bin/env node
'use strict';
/*
 * Tests for check-decision-keys.js.
 *
 * Every assertion here has been watched failing, by breaking the checker and confirming this
 * suite goes red. A check nobody has seen fail is indistinguishable from one that always passes.
 *
 * THE THREE ANSWERS ARE ASSERTED SEPARATELY AND AGAINST EACH OTHER, because the value of this
 * check is that A KEY USED TWICE and A TABLE THIS CANNOT READ are different verdicts. Collapsing
 * them either way is the failure mode: one way a project writing keys in an unexpected shape is
 * refused forever with nothing it can do about it, the other way an unreadable table reports
 * clean and the check is decorative. The first draft did exactly the second thing, passing at
 * exit 0 on five sections it had found zero keys in.
 *
 * A DUPLICATE IS ASSERTED WITH THE REASON AND NOT ONLY THE EXIT CODE, because exit 1 is reached
 * by two different faults and only the printed reason tells them apart.
 *
 * THE TWO SHAPES THAT MUST NOT BE CALLED DUPLICATES ARE FIXTURED AS HARD AS THE DUPLICATE ITSELF,
 * because both were false findings in this tool's own first run against real projects. An INDEX
 * beside a full table repeats every key on purpose and one project on this machine says so in its
 * own text; pooling documents blindly reported 95 duplicates there, all of them correct entries.
 * And a STATUS row labelled with a decision key is a report on that decision, not a declaration
 * of it, so a scan that recognised rows by shape rather than by section counted those too.
 *
 * KEY SHAPES ARE FIXTURED THREE WAYS because assuming one shape was the other first-run false
 * finding: this studio writes S114, most projects write D-091, one writes a bare integer.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TOOL = path.join(__dirname, 'check-decision-keys.js');
let pass = 0, fail = 0;
function ok (name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL  ' + name); } }

const junk = [];
let n = 0;

const HEAD = '## Known decisions (append-only)\n\n| # | Decision | Resolution | Date |\n|---|---|---|---|\n';
function row (key, what) { return '| ' + key + ' | ' + (what || 'a decision') + ' | resolved | 2026-09-06 |\n'; }

function world () {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'decision-keys-' + process.pid + '-' + (n++) + '-'));
  junk.push(d);
  return d;
}
function doc (root, name, text) {
  fs.writeFileSync(path.join(root, name), text, 'utf8');
  return root;
}
function run (root) {
  try {
    return { code: 0, out: execFileSync('node', [TOOL, '--root', root], { stdio: ['pipe', 'pipe', 'pipe'] }).toString() };
  } catch (e) {
    return { code: e.status, out: ((e.stdout || '') + (e.stderr || '')).toString() };
  }
}

// --- a key naming two decisions: this one refuses ----------------------------------------------
{
  const w = world();
  doc(w, 'WAYS_OF_WORKING.md', HEAD + row('D-090') + row('D-091', 'theirs') + row('D-091', 'mine'));
  const r = run(w);
  ok('a key declared twice in one document refuses', r.code === 1);
  ok('and it names the key, so the row can be found', /D-091/.test(r.out));
  ok('and it gives the reason, because exit 1 is reached two different ways',
    /declared twice in one document/.test(r.out));
  ok('and it prints both places, which is what makes it actionable',
    (r.out.match(/WAYS_OF_WORKING\.md:/g) || []).length === 2);
  ok('and the key that is fine is not reported', !/D-090/.test(r.out));
}
{
  const w = world();
  doc(w, 'WAYS_OF_WORKING.md', HEAD + row('D-090') + row('D-090') + row('D-091') + row('D-091'));
  const r = run(w);
  ok('two separate collisions are both counted rather than the first one stopping the scan',
    /2 key\(s\) name more than one decision/.test(r.out));
}

// --- a move that did not finish is a different fault with the same exit code --------------------
{
  const w = world();
  doc(w, 'WAYS_OF_WORKING.md', HEAD + row('D-090'));
  doc(w, 'DECISIONS-ARCHIVE.md', HEAD + row('D-090'));
  const r = run(w);
  ok('the same key in a live table and in an archive refuses, because archiving MOVES a row',
    r.code === 1);
  ok('and it says so, rather than reporting it as a second declaration',
    /a move did not finish/.test(r.out));
}

// --- the two shapes that are NOT duplicates, both of them real false findings once --------------
{
  const w = world();
  doc(w, 'WAYS_OF_WORKING.md', HEAD + row('D-090'));
  doc(w, 'WARM_START.md', HEAD + row('D-090'));
  const r = run(w);
  ok('an index repeating a key beside the full table is not a duplicate', r.code === 0);
}
{
  const w = world();
  doc(w, 'WAYS_OF_WORKING.md', HEAD + row('D-090') +
    '\n## Build status\n\n| Ticket | State |\n|---|---|\n| D-090 | half closed |\n');
  const r = run(w);
  ok('a key used as a row label OUTSIDE the decisions section is a report, not a declaration',
    r.code === 0);
  ok('and the section really did end at that heading, so the row was never read',
    /1 decision key\(s\)/.test(r.out));
}
{
  const w = world();
  doc(w, 'WAYS_OF_WORKING.md', HEAD + row('D-090') +
    '\n### Why D-090 was taken\n\n| # | Decision | Resolution | Date |\n|---|---|---|---|\n' + row('D-091'));
  const r = run(w);
  ok('a DEEPER heading does not end the section, so the table under it is still read',
    /2 decision key\(s\)/.test(r.out));
}

// --- could not read: advisory, and it must NOT be either of the two above -----------------------
{
  const w = world();
  doc(w, 'WAYS_OF_WORKING.md', '## Build status\n\n| Ticket | State |\n|---|---|\n| TCK-1 | done |\n');
  const r = run(w);
  ok('no decisions table anywhere is advisory, not a refusal and not a pass', r.code === 3);
  ok('and it says WHICH of the two advisory reasons it is, because both exit 3',
    /no decisions table in any state document/.test(r.out));
}
{
  const w = world();
  doc(w, 'WAYS_OF_WORKING.md', '## Known decisions (append-only)\n\nProse about decisions, no table at all.\n');
  const r = run(w);
  ok('a heading naming decisions with no table under it is not a section', r.code === 3);
}
{
  const w = world();
  doc(w, 'WAYS_OF_WORKING.md', '## Known decisions (append-only)\n\n| # | Decision |\n| D-090 | a decision |\n');
  const r = run(w);
  ok('rows with no separator line are not a table, so a heading plus bare rows is not a section',
    /no decisions table in any state document/.test(r.out));
}
{
  const w = world();
  doc(w, 'WAYS_OF_WORKING.md', HEAD + '| a decision written as prose | x | y | z |\n');
  const r = run(w);
  ok('a decisions table whose keys are unreadable is advisory rather than a clean pass', r.code === 3);
  ok('and it names THAT reason rather than the no-table one, which is the other exit 3',
    /no key in any of them was readable/.test(r.out));
}

// --- the three key shapes actually in use ------------------------------------------------------
{
  const w = world();
  doc(w, 'WAYS_OF_WORKING.md', HEAD + row('1') + row('2') + row('2'));
  ok('a bare integer is a key, which is how one project on this machine writes them',
    run(w).code === 1);
}
{
  const w = world();
  doc(w, 'WARM_START.md', '## Decisions\n\n| # | Decision | Resolution | Date |\n|---|---|---|---|\n' +
    row('S113') + row('S114') + row('S114'));
  const r = run(w);
  ok('a key with no hyphen is a key, which is how this studio writes them', r.code === 1);
  ok('and the heading does not have to say KNOWN decisions', /S114/.test(r.out));
}
{
  const w = world();
  doc(w, 'WAYS_OF_WORKING.md', HEAD + row('D-090') + row('D-091'));
  const r = run(w);
  ok('the separator row is not read as a key, which would collide with itself', r.code === 0);
  ok('and a clean table reports how many keys it actually read', /2 decision key\(s\)/.test(r.out));
}

for (const d of junk) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} }

/* Exit 1 in this tool is the code for A KEY NAMING TWO DECISIONS, so a crash that reached it
   published a raw stack trace as a positive finding. Measured: drop the guard and this suite reads
   23 passed, 3 failed, all three below. --root alone throws out of path.resolve at exit 1, and
   --root --quiet resolves to a directory named for the flag and answers cannot-tell to a question
   nobody asked. */
{
  const raw = (extra) => {
    try {
      return { code: 0, out: execFileSync('node', [TOOL].concat(extra), { stdio: ['pipe', 'pipe', 'pipe'] }).toString() };
    } catch (e) {
      return { code: e.status, out: ((e.stdout || '') + (e.stderr || '')).toString() };
    }
  };
  const a = raw(['--root']);
  ok('--root with nothing after it is a usage error rather than a finding about decision keys',
    a.code === 2);
  ok('and it names the flag it wanted a value for', /--root needs a value/.test(a.out));
  const b = raw(['--root', '--quiet']);
  ok('a flag that would swallow the next flag as its value is the same usage error, not a silent '
   + 'verdict about the working directory', b.code === 2);
}

const EXPECTED_ASSERTIONS = 26;
if (pass + fail !== EXPECTED_ASSERTIONS) {
  fail++;
  console.log('FAIL  the suite ran every assertion: ran ' + (pass + fail - 1) + ' of ' + EXPECTED_ASSERTIONS +
    '. A block was skipped or deleted. Find out which before you change the number.');
}
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
