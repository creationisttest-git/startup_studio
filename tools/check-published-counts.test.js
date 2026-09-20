#!/usr/bin/env node
'use strict';
/*
 * Tests for check-published-counts.js. Every assertion has been watched failing by breaking the
 * tool, and the mutation that reddens each group is written beside the group.
 *
 * THE INTERESTING PROPERTY IS PROVED BY THE SECOND GROUP RATHER THAN THE FIRST. Moving the
 * ceiling in board.js turns every previously correct claim red AT ONCE, across every surface.
 * That is the event this check exists for, and a suite that only ever tests a matching pair
 * never sees it. The first group, where everything agrees, is the one that would pass against a
 * tool that did nothing at all.
 *
 * The fixture path carries a timestamp as well as the process id, and the helper REFUSES if the
 * directory already exists. A precondition an assertion stands on is asserted, not assumed.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
/* ST-281: fixture roots come from ONE place that makes them unique and removes them at exit. */
const { fixtureRoot } = require('./tmp-fixtures.js');

const TOOL = path.join(__dirname, 'check-published-counts.js');
let pass = 0, fail = 0;
function ok (name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL  ' + name); } }

// stdio is pipe on ALL THREE streams. Inheriting stderr lets a fixture's usage error print into
// the parent harness, which reads any stderr from a node suite as the run having died: it once
// reported 579 passed of 586 where the missing assertions were ABSENT rather than failing (S149).
function run (args) {
  try {
    const out = execFileSync('node', [TOOL].concat(args), { stdio: ['pipe', 'pipe', 'pipe'] }).toString();
    return { code: 0, out: out };
  } catch (e) {
    return { code: e.status, out: ((e.stdout || '') + (e.stderr || '')).toString() };
  }
}

let n = 0;
function fixture () {
  const dir = path.join(fixtureRoot('pubcount'), 'tree');
  if (fs.existsSync(dir)) throw new Error('fixture path already exists, which every assertion below assumes it does not: ' + dir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function put (root, rel, body) {
  const p = path.join(root, rel.split('/').join(path.sep));
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
  return p;
}

function board (root, large, small, dir) {
  return put(root, (dir || 'base/board') + '/board.js',
    'const COLUMNS = []\nconst CEILING = { large: ' + large + ', small: ' + small + ' };\n');
}

// A glossary of `terms` anchors, with the page stating `states` of them. Keeping the two apart
// is the whole point: the defect this tool was built for was a page counting itself wrong.
function reference (root, terms, states) {
  let body = '<html><p class="rel-intro">The ' + states + ' defined terms used here.</p>\n';
  for (let i = 0; i < terms; i++) body += '<dt id="g-t' + i + '">term ' + i + '</dt>\n';
  return put(root, 'reference.html', body + '</html>\n');
}

function baseline (root, obj) {
  const p = path.join(root, 'baseline.json');
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
  return p;
}

function check (root, extra) {
  return run(['--root', root, '--baseline', path.join(root, 'baseline.json')].concat(extra || []));
}

/* Mutation: delete the `x.n !== truth[x.claim].n` filter and the whole first group goes red. */
{
  const root = fixture();
  board(root, 2, 3);
  reference(root, 4, 'four');
  put(root, 'page.html', '<p>The ceiling is two large and three small in progress.</p>\n');
  baseline(root, {});
  const r = check(root);
  ok('a tree where every published number matches what it counts is clean', r.code === 0);
  ok('and it says how many claims it read', /claim\(s\) across/.test(r.out));
  ok('and it names each number with the source it was read from',
     /ceiling\.large = 2/.test(r.out) && /ceiling\.small = 3/.test(r.out) && /glossary\.terms = 4/.test(r.out));
}

/* THE EVENT THIS CHECK EXISTS FOR. Mutation: read CEILING from anywhere but board.js. */
{
  const root = fixture();
  board(root, 1, 3);                       // the ceiling has MOVED to one large
  reference(root, 4, 'four');
  put(root, 'a.html', '<p>The ceiling is two large and three small in progress.</p>\n');
  put(root, 'b.md', 'Hold the line at two large items in progress.\n');
  put(root, 'base/agents/pm.md', 'The ceiling is two large and three small, in progress.\n');
  // A surface stating the CORRECT number, and it is load bearing rather than scenery.
  // Without it the absence check also fires, so this group refused on whichever mechanism
  // was still working and stayed GREEN under the mutation named above it. Measured: with
  // the stale-number filter removed the group passed, because "no surface states 1"
  // produced the same exit code as a stale number correctly detected.
  put(root, 'correct.md', 'The ceiling is one large in progress.\n');
  baseline(root, {});
  const r = check(root);
  ok('moving the ceiling in board.js turns the stale claims red', r.code === 1);
  ok('and it names EVERY surface still stating the old number, not just the first',
     /a\.html/.test(r.out) && /b\.md/.test(r.out) && /pm\.md/.test(r.out));
  ok('and it states what the number should be and where that was read from',
     /is 1, read from CEILING in board\.js/.test(r.out));
  ok('the small number, which did NOT move, is not reported', !/ceiling\.small/.test(r.out));
}

/* THE OTHER DIRECTION, AND ONLY A CHECK THAT EXPECTS A CLAIM CAN SEE AN ABSENCE.
   Mutation: delete the `!live.length` block and this goes red alone. */
{
  const root = fixture();
  board(root, 2, 3);
  reference(root, 4, 'four');
  put(root, 'page.html', '<p>Work in progress is capped.</p>\n');   // states no number at all
  baseline(root, {});
  const r = check(root);
  ok('a surface that has LOST its claim is a failure, not a pass', r.code === 1);
  ok('and the refusal says no surface states it at all', /no scanned surface states it at all/.test(r.out));
}

/* Mutation: drop ABOUT_CEILING from the guard and this goes red. Ordinary prose about one large
   thing is not a claim about how much work may be in flight. */
{
  const root = fixture();
  board(root, 2, 3);
  reference(root, 4, 'four');
  put(root, 'page.html', '<p>The ceiling is two large and three small in progress.</p>\n');
  put(root, 'prose.md', 'We shipped one large change and four small corrections last week.\n');
  baseline(root, {});
  const r = check(root);
  ok('a number in front of large or small is NOT a ceiling claim without ceiling context', r.code === 0);
}

/* DATED HISTORY IS NOT A CLAIM TO A READER TODAY, and rewriting it would falsify the record that
   reconciles the old number with the new one. Mutation: delete datedRecord and this goes red. */
{
  const root = fixture();
  board(root, 1, 3);
  reference(root, 4, 'four');
  put(root, 'page.html', '<p>The ceiling is one large and three small in progress.</p>\n');
  put(root, 'CHANGELOG.md', 'A concurrency limit, two large items and three small in progress.\n');
  put(root, 'releases.html', '<li>two large items and three small, in progress</li>\n');
  put(root, 'WARM_START-ARCHIVE.md', 'the ceiling was two large and three small in progress\n');
  baseline(root, {});
  const r = check(root);
  ok('a changelog stating the OLD number is left alone', r.code === 0);
  ok('and so is an archive recognised by the SHAPE of its name rather than by a list',
     !/ARCHIVE/.test(r.out));
}

/* CODE IS NOT SCANNED, AND THE EXTENSION FILTER IS WHAT DOES IT. This block used to name a
   provenElsewhere() predicate excluding .test.js by name. Mutation proved that predicate DEAD:
   deleting it changed nothing, because SCAN never collects .js in the first place, so the block
   passed against a tool carrying the rule and against one without it. The predicate was removed
   and this asserts the mechanism that is actually load bearing.
   Mutation that reddens this: add '.js' to the root SCAN entry's ext list. */
{
  const root = fixture();
  board(root, 1, 3);
  reference(root, 4, 'four');
  put(root, 'page.html', '<p>The ceiling is one large and three small in progress.</p>\n');
  put(root, 'stale.js', 'const DOC = "the ceiling is two large and three small in progress"\n');
  baseline(root, {});
  const r = check(root);
  ok('a .js file stating the old number is not scanned, because code is never collected', r.code === 0);
}

/* THE EXEMPTION HAS TO BE RECORDED RATHER THAN GUESSED, and it is keyed by count so it cannot
   quietly cover a second occurrence somebody added later. */
{
  const root = fixture();
  board(root, 1, 3);
  reference(root, 4, 'four');
  put(root, 'page.html', '<p>The ceiling is one large and three small in progress.</p>\n');
  put(root, 'note.md', 'the ceiling used to be two large in progress\n');
  baseline(root, { truth: { 'ceiling.large': 1 },
    exempt: { 'ceiling.large': { 'note.md': { '2': { count: 1, why: 'a dated sentence about what the ceiling used to be' } } } } });
  const r = check(root);
  ok('a claim exempted with a reason and a matching count passes', r.code === 0);

  put(root, 'note.md', 'the ceiling used to be two large in progress\nand two large in progress again\n');
  const r2 = check(root);
  ok('a SECOND occurrence under the same exemption is refused', r2.code === 1);
  ok('and the refusal says how many were expected against how many were found',
     /exempt for 1 occurrence\(s\), found 2/.test(r2.out));

  put(root, 'note.md', 'the ceiling used to be two large in progress\n');
  baseline(root, { truth: { 'ceiling.large': 1 },
    exempt: { 'ceiling.large': { 'note.md': { '2': { count: 1, why: '   ' } } } } });
  const r3 = check(root);
  ok('an exemption with a BLANK reason is refused as hard as none at all', r3.code === 1);
}

/* THE EXPORT FLATTENS base/ AWAY, and a baseline keyed on source paths matched nothing there for
   weeks while passing on the tree it was written against (S133). One canonical key serves both. */
{
  for (const layout of ['base/agents', 'agents']) {
    const root = fixture();
    board(root, 1, 3, layout === 'agents' ? 'board' : 'base/board');
    reference(root, 4, 'four');
    put(root, 'page.html', '<p>The ceiling is one large and three small in progress.</p>\n');
    put(root, layout + '/pm.md', 'the old ceiling was two large in progress\n');
    baseline(root, { truth: { 'ceiling.large': 1 },
      exempt: { 'ceiling.large': { 'agents/pm.md': { '2': { count: 1, why: 'a dated line' } } } } });
    const r = check(root);
    ok('the baseline key works in the ' + layout + ' layout', r.code === 0);
  }
}

/* A LOCKOUT A READER CANNOT CLEAR IS THE DEFECT THIS REPOSITORY HAS SHIPPED THREE TIMES
   (S133, S151, ST-139). A tree holding neither source of truth is not one this tool has standing
   to refuse on. Mutation: return 1 instead of 3 and this goes red. */
{
  const root = fixture();
  put(root, 'page.html', '<p>The ceiling is nine large in progress.</p>\n');
  baseline(root, {});
  const r = check(root);
  ok('a tree with no board.js and no reference.html is ADVISORY, never a refusal', r.code === 3);
  ok('and it says plainly that nothing is claimed either way', /nothing is claimed either way/.test(r.out));
}

/* ABSENT AND CORRUPT ARE DIFFERENT ANSWERS AND MUST NEVER BE THE SAME ONE, which is the rule
   board.js states about its own override ledger. Mutation: fall through to 3 and this goes red. */
{
  const root = fixture();
  put(root, 'base/board/board.js', 'const COLUMNS = []\n// no ceiling in here at all\n');
  reference(root, 4, 'four');
  baseline(root, {});
  const r = check(root);
  ok('a board.js present but carrying no readable CEILING is an ERROR, not an absence', r.code === 2);
  ok('and the error names what it looked for', /no "const CEILING/.test(r.out));

  const root2 = fixture();
  put(root2, 'base/board/board.js', 'const CEILING = { large: 2 };\n');
  reference(root2, 4, 'four');
  baseline(root2, {});
  ok('a CEILING carrying only one of the two numbers is also an error', check(root2).code === 2);
}

/* A DAMAGED BASELINE READ AS EMPTY TURNS EVERY EXEMPTION INTO A FAILURE, and the fix a reader
   then reaches for is --write-baseline, which would overwrite the file and lose every reason in
   it. Mutation: swallow the parse error and this goes red. */
{
  const root = fixture();
  board(root, 2, 3);
  reference(root, 4, 'four');
  put(root, 'page.html', '<p>The ceiling is two large and three small in progress.</p>\n');
  fs.writeFileSync(path.join(root, 'baseline.json'), '{ this is not json');
  const r = check(root);
  ok('an unreadable baseline REFUSES rather than reading as empty', r.code === 2);
  ok('and it says to restore it from git rather than to rewrite it', /Restore it from git/.test(r.out));
}

/* --write-baseline IS THE COMMAND A PERSON ACTUALLY TYPES, and a baseline written with a blank
   reason is a list of things nobody looked at. */
{
  const root = fixture();
  board(root, 1, 3);
  reference(root, 4, 'four');
  put(root, 'page.html', '<p>The ceiling is one large and three small in progress.</p>\n');
  put(root, 'note.md', 'the ceiling used to be two large in progress\n');
  baseline(root, {});
  const r = check(root, ['--write-baseline']);
  ok('--write-baseline refuses to record an exemption with no reason', r.code === 2);
  ok('and it says nothing has been written', /Nothing has been written/.test(r.out));
  ok('and the file really is unchanged', fs.readFileSync(path.join(root, 'baseline.json'), 'utf8').indexOf('note.md') === -1);

  baseline(root, { truth: {}, exempt: { 'ceiling.large': { 'note.md': { '2': { count: 1, why: 'a dated line about the old ceiling' } } } } });
  const r2 = check(root, ['--write-baseline']);
  ok('with the reason present it writes, carrying the reason forward', r2.code === 0);
  ok('and the written baseline records the truth it was measured against',
     JSON.parse(fs.readFileSync(path.join(root, 'baseline.json'), 'utf8')).truth['ceiling.large'] === 1);
  ok('and a check run against what it wrote is clean', check(root).code === 0);
}

/* Measured: a fatal error part way through a suite reports 0 failed and exit 0, because a count
   of failures cannot see an assertion that never ran. The total is pinned, and it is written
   down rather than measured from the run it checks, because a self-updating total agrees with
   any run at all. Mutation: delete any block above and this goes red alone. */
const EXPECTED_ASSERTIONS = 33;
const ranBefore = pass + fail;
ok('the suite ran every assertion: ran ' + (ranBefore + 1) + ' of ' + EXPECTED_ASSERTIONS
   + '. A block was skipped or deleted. Find out which before you change the number.',
   ranBefore === EXPECTED_ASSERTIONS - 1);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
