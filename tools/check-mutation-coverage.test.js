#!/usr/bin/env node
'use strict';
/*
 * Tests for check-mutation-coverage.js.
 *
 * Every assertion here has been watched failing, by breaking the checker and confirming this
 * suite goes red. A check nobody has seen fail is indistinguishable from one that always passes,
 * and this particular check exists because four rounds of review found a hand-written claim about
 * exactly that. It would be a poor joke to ship it unproved.
 *
 * THE FIXTURE IS A TINY TOOL AND A TINY SUITE, not the real pair. The real pair takes minutes,
 * because it runs one full suite per line. The fixture is eight code lines chosen so that all
 * three verdicts appear at once and the expected answer can be worked out by hand and written
 * down: three lines nothing depends on, three the suite catches, and two whose deletion makes the
 * file unparseable. A fixture that produced only one verdict would leave the other two proved by
 * nothing, which is the shape this whole tool was built to stop.
 *
 * THE EXPECTED SPLIT IS 3 SILENT, 3 COVERED AND 2 NOT MUTABLE, and here is why each, because a
 * number in a test that nobody can rederive is a number somebody will later change to whatever
 * makes the suite green. 'use strict' changes nothing the fixture suite can observe. The unused
 * variable is dead. The exports line is never required by the fixture suite. The two flag branches
 * and the entry point are all asserted. And the function signature and its closing brace cannot
 * be removed without the file ceasing to parse, which is a FAILED EXPERIMENT and not a pass.
 *
 * IT IS ASSERTED THAT THE TREE IS NEVER WRITTEN TO, by hashing the fixture tool before and after
 * a full run. That is not a nicety: the previous way of getting these numbers was to edit the real
 * file, run, and edit it back, which is safe exactly until the run is interrupted. The whole
 * design of the checker rests on mutating a copy, so the copy is what this proves.
 *
 * AND THAT ONE IS A PAIR, which is said here because a reader who breaks half of it will see
 * nothing. Pointing the mutation at the source file instead of the copy leaves the hash unchanged
 * on its own, because the checker writes the original back when it finishes; removing that
 * restore leaves the hash unchanged too, because the mutation was in a copy. Measured: source and
 * no restore together, 19 passed 5 failed with this assertion among them; no restore alone, 24
 * passed 0 failed; source alone, 20 passed 4 failed and this assertion still green. Neither half
 * proves it and the two together do.
 *
 * BOTH DIRECTIONS OF THE REFUSAL ARE ASSERTED, because only one of them was ever the point. A
 * silent line missing from the baseline is the obvious half. A baseline entry that is no longer
 * silent is the half the hand-written paragraph never had: its claims could rot without anything
 * going red, and they did, three times.
 */
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TOOL = path.join(__dirname, 'check-mutation-coverage.js');
const { candidates } = require('./check-mutation-coverage.js');
let pass = 0, fail = 0;
function ok (name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL  ' + name); } }

const junk = [];
let n = 0;

// Eight code lines, and the verdict for each is worked out in the header rather than observed.
const FIXTURE_TOOL = [
  "'use strict'",
  'function main (argv) {',
  "  if (argv.indexOf('--yes') !== -1) return 0",
  '  var unused = 1',
  '  return 1',
  '}',
  'if (require.main === module) process.exit(main(process.argv.slice(2)))',
  'module.exports = { main }',
  ''
].join('\n');

const FIXTURE_SUITE = [
  "'use strict'",
  "const { execFileSync } = require('child_process')",
  "const path = require('path')",
  "const T = path.join(__dirname, 't.js')",
  'let p = 0, f = 0',
  "function ok (nm, c) { if (c) { p++ } else { f++; console.log('FAIL  ' + nm) } }",
  'function code (args) {',
  "  try { execFileSync(process.execPath, [T].concat(args), { stdio: ['pipe', 'pipe', 'pipe'] }); return 0 }",
  '  catch (e) { return e.status }',
  '}',
  "ok('the yes flag passes', code(['--yes']) === 0)",
  "ok('and without it the tool refuses', code([]) === 1)",
  "console.log(p + ' passed, ' + f + ' failed')",
  'process.exit(f ? 1 : 0)',
  ''
].join('\n');

function world (baseline) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mutcov-test-' + process.pid + '-' + (n++) + '-'));
  junk.push(d);
  fs.writeFileSync(path.join(d, 't.js'), FIXTURE_TOOL, 'utf8');
  fs.writeFileSync(path.join(d, 't.test.js'), FIXTURE_SUITE, 'utf8');
  if (baseline !== undefined) fs.writeFileSync(path.join(d, 'base.json'), JSON.stringify(baseline, null, 2), 'utf8');
  return d;
}

function run (d, extra) {
  const args = [TOOL, '--root', d, '--tool', 't.js', '--suite', 't.test.js', '--baseline', 'base.json']
    .concat(extra || []);
  try {
    return { code: 0, out: execFileSync(process.execPath, args, { stdio: ['pipe', 'pipe', 'pipe'] }).toString() };
  } catch (e) {
    return { code: e.status, out: ((e.stdout || '') + (e.stderr || '')).toString() };
  }
}

function md5 (p) { return crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex'); }

const ALL_THREE = {
  't.js': [
    { text: "'use strict'", count: 1, reason: 'strict mode changes nothing the fixture suite observes' },
    { text: 'var unused = 1', count: 1, reason: 'dead, and kept only so this fixture has a silent line to find' },
    { text: 'module.exports = { main }', count: 1, reason: 'the fixture suite spawns the tool rather than requiring it' }
  ]
};

// --- the derived answer itself ----------------------------------------------------------------
{
  const d = world(ALL_THREE);
  const before = md5(path.join(d, 't.js'));
  const r = run(d);
  ok('a tool whose every silent line is accepted passes', r.code === 0);
  ok('and it derives the split rather than being told it: three silent, three covered, two the parser refuses',
    /8 code line\(s\): 3 covered, 3 silent, 0 crashed, 2 refused by the parser/.test(r.out));
  ok('and this fixture has NO crashed lines, which is what makes the crashed block below a real control',
    /0 crashed/.test(r.out));
  ok('and it states what the suite did BEFORE any mutation, so a suite already red cannot be read as coverage',
    /before any mutation: 2 passed, 0 failed/.test(r.out));
  ok('and it names each silent line with the reason a person wrote for it',
    /SILENT  :4  var unused = 1/.test(r.out) && /dead, and kept only so this fixture/.test(r.out));
  ok('and it writes to a copy, never to the file it is measuring',
    md5(path.join(d, 't.js')) === before);
}

// --- the refusal, in the obvious direction ----------------------------------------------------
{
  const d = world({ 't.js': ALL_THREE['t.js'].slice(0, 2) });
  const r = run(d);
  ok('a line nothing depends on that is not in the baseline refuses', r.code === 1);
  ok('and it names the line rather than only counting it',
    /SILENT and not accepted: module\.exports = \{ main \}/.test(r.out));
}
{
  const d = world({ 't.js': [{ text: "'use strict'", count: 1, reason: '' }].concat(ALL_THREE['t.js'].slice(1)) });
  const r = run(d);
  ok('an accepted line with an empty reason refuses, because a reason nobody wrote is a line nobody looked at',
    r.code === 1 && /no reason/.test(r.out));
}
{
  const d = world({ 't.js': ALL_THREE['t.js'].concat([{ text: 'var unused = 1', count: 2, reason: 'x' }]) });
  const r = run(d);
  ok('a count that disagrees with what was measured refuses', r.code === 1);
}

// --- the refusal in the direction the hand-written paragraph never had -------------------------
{
  const d = world({
    't.js': ALL_THREE['t.js'].concat([
      { text: "  if (argv.indexOf('--yes') !== -1) return 0", count: 1, reason: 'was silent once' }
    ])
  });
  const r = run(d);
  ok('a baseline entry for a line that is now COVERED refuses, so an exemption cannot outlive its reason',
    r.code === 1);
  ok('and it says so in those terms rather than reporting a bare mismatch',
    /outlived its reason/.test(r.out));
}

// --- a failed experiment is not a pass --------------------------------------------------------
{
  const d = world(ALL_THREE);
  const r = run(d, ['--report']);
  ok('a deletion that leaves the file unparseable is reported as its own verdict, not as covered',
    /NOT MUTABLE  :2  function main \(argv\) \{/.test(r.out));
  ok('and the closing brace is the other one, so the count of two is derived and not asserted blind',
    /NOT MUTABLE  :6  \}/.test(r.out));
}

// --- writing the baseline ---------------------------------------------------------------------
{
  const d = world({});
  const r = run(d, ['--write-baseline']);
  ok('writing a baseline refuses when a silent line has no reason yet, rather than recording a blank one',
    r.code === 2);
  ok('and it lists the lines a person now has to write a reason for',
    /var unused = 1/.test(r.out));
  ok('and it does not write the file it refused to write',
    JSON.stringify(JSON.parse(fs.readFileSync(path.join(d, 'base.json'), 'utf8'))) === '{}');
}
{
  const d = world(ALL_THREE);
  const r = run(d, ['--write-baseline']);
  const written = JSON.parse(fs.readFileSync(path.join(d, 'base.json'), 'utf8'));
  ok('writing a baseline carries the existing reasons forward rather than blanking them',
    r.code === 0 && written['t.js'].length === 3 && written['t.js'].every(e => e.reason));
}

// --- it refuses to measure what it cannot measure ---------------------------------------------
{
  const d = world(ALL_THREE);
  fs.writeFileSync(path.join(d, 't.js'), FIXTURE_TOOL.replace('return 1', 'return 2'), 'utf8');
  const r = run(d);
  ok('a suite that is already red before any mutation is a read error, not a report of no coverage',
    r.code === 2 && /already red before any mutation/.test(r.out));
}
{
  const d = world(ALL_THREE);
  fs.rmSync(path.join(d, 't.js'));
  ok('a tool that is not there is a usage error', run(d).code === 2);
}
{
  const d = world(ALL_THREE);
  const other = path.join(d, 'elsewhere');
  fs.mkdirSync(other);
  fs.writeFileSync(path.join(other, 't.test.js'), FIXTURE_SUITE, 'utf8');
  const args = [TOOL, '--root', d, '--tool', 't.js', '--suite', 'elsewhere/t.test.js', '--baseline', 'base.json'];
  let code = 0, out = '';
  try { execFileSync(process.execPath, args, { stdio: ['pipe', 'pipe', 'pipe'] }); }
  catch (e) { code = e.status; out = ((e.stdout || '') + (e.stderr || '')).toString(); }
  ok('a suite in a different directory from its tool is refused, because the copy can only hold one',
    code === 2 && /one directory/.test(out));
}
{
  let code = 0, out = '';
  try { execFileSync(process.execPath, [TOOL, '--tool'], { stdio: ['pipe', 'pipe', 'pipe'] }); }
  catch (e) { code = e.status; out = ((e.stdout || '') + (e.stderr || '')).toString(); }
  ok('a flag with nothing after it is a usage error naming the flag, not a verdict about the default pair',
    code === 2 && /--tool needs a value/.test(out));
}

/* ST-141 round seven M3. THE SUITE USED TO BE A HARDCODED DEFAULT, and that default was this
   tool's own first subject. So --tool <anything else> with no --suite measured that tool against
   a suite belonging to a different one and printed a confident verdict about nothing: pointed at
   ITSELF it reported 217 code lines, 0 covered, 131 silent. Zero covered is not a finding about
   coverage, it is the shape of an answer to a question nobody asked, and it is why this tool
   could not measure itself. Mutation: put the constant back as the fallback and the first two go
   red while the explicit --suite one stays green, which is what makes it a proof about the
   DEFAULT rather than about the flag working at all. */
{
  const { suiteFor } = require('./check-mutation-coverage.js');
  ok('the suite is derived from the tool rather than defaulted to one particular pair',
    suiteFor('tools/check-reply-shape.js') === 'tools/check-reply-shape.test.js');
  ok('and the derivation is the tool name, so a tool can measure ITSELF',
    suiteFor('tools/check-mutation-coverage.js') === 'tools/check-mutation-coverage.test.js');
  ok('and only the trailing .js is replaced, so a dotted directory name survives it',
    suiteFor('a.b/c.js') === 'a.b/c.test.js');
}

// --- quiet, and what counts as a line worth mutating ------------------------------------------
{
  const d = world(ALL_THREE);
  const r = run(d, ['--quiet']);
  ok('--quiet says nothing at all on a pass, because the gate prints its own row',
    r.code === 0 && r.out === '');
}
{
  const lines = ['#!/usr/bin/env node', "'use strict'", '', '// a comment', '/* a block', ' * of comment',
    ' */', 'const x = 1', '/* one line */', 'const y = 2'];
  const got = candidates(lines);
  ok('blank lines, comments and the shebang are not mutated, because deleting one proves nothing',
    got.length === 3 && got[0] === 1 && got[1] === 7 && got[2] === 9);
}
/* ST-141 m3, and it is the case the fixture above could never reach. Every comment in it closes
   on a line of its own, so a line that CLOSES a block and carries code after it was dropped from
   every bucket and the N code lines summary was quietly short. Nothing here could see it, which
   is why it survived seven review rounds on this file. Mutation: put back the branch that
   continued unconditionally once a block comment closed, and both of the first two go red. */
{
  const got = candidates(['/* a block', ' * of comment', ' */ const x = 1', 'const y = 2']);
  ok('code sharing a line with the CLOSE of a block comment is still a line worth mutating',
    got.length === 2 && got[0] === 2 && got[1] === 3);
}
{
  const got = candidates(['/* one line */ const x = 1', 'const y = 2']);
  ok('and code sharing a line with a whole one-line block comment is too',
    got.length === 2 && got[0] === 0 && got[1] === 1);
}
{
  // The control. Without it the two above are indistinguishable from a classifier that has
  // stopped excluding comments at all, which would report every header line as a code line.
  const got = candidates(['/* a block', ' * of comment', ' */', 'const x = 1']);
  ok('a line that closes a block and carries nothing else is still not a line worth mutating',
    got.length === 1 && got[0] === 3);
}

/* CRASHED IS ITS OWN VERDICT AND IS HELD TO THE SAME ACCOUNT AS SILENT. A crash used to be ORed
   into the PARSER's not-mutable bucket, which needs no reason and can never refuse, so a real
   finding could disappear while the header still read true. The fixture above asserts 0 crashed,
   so these blocks are the only thing here that can produce one. S127 is the mechanism: a suite
   that uses its tool IN PROCESS dies on a mutation that throws, and a dead suite prints no count. */
const CRASH_SUITE = [
  "'use strict'",
  "const path = require('path')",
  "const { main } = require(path.join(__dirname, 't.js'))",
  'let p = 0, f = 0',
  "function ok (nm, c) { if (c) { p++ } else { f++; console.log('FAIL  ' + nm) } }",
  "ok('the yes flag passes', main(['--yes']) === 0)",
  "ok('and without it the tool refuses', main([]) === 1)",
  "console.log(p + ' passed, ' + f + ' failed')",
  'process.exit(f ? 1 : 0)',
  ''
].join('\n');

function crashWorld (baseline) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mutcov-test-' + process.pid + '-' + (n++) + '-'));
  junk.push(d);
  fs.writeFileSync(path.join(d, 't.js'), FIXTURE_TOOL, 'utf8');
  fs.writeFileSync(path.join(d, 't.test.js'), CRASH_SUITE, 'utf8');
  if (baseline !== undefined) fs.writeFileSync(path.join(d, 'base.json'), JSON.stringify(baseline, null, 2), 'utf8');
  return d;
}

{
  const d = crashWorld({ 't.js': [] });
  const r = run(d);
  ok('a line whose deletion kills the suite is CRASHED and not folded into the parser bucket',
    /1 crashed/.test(r.out));
  ok('and the line that crashes is the export the in-process suite requires',
    /CRASHED :8  module\.exports = \{ main \}/.test(r.out));
  ok('and it still PARSES, which is the whole distinction: the parser bucket is not 3',
    /2 refused by the parser/.test(r.out));
  ok('and an unaccounted crashed line refuses, exactly as an unaccounted silent one does',
    r.code === 1 && /CRASHED and not accepted: module\.exports = \{ main \}/.test(r.out));
}
{
  const d = crashWorld({ 't.js': [
    { text: "'use strict'", count: 1, verdict: 'silent', reason: 'strict mode changes nothing this suite observes' },
    { text: 'var unused = 1', count: 1, verdict: 'silent', reason: 'dead, and kept so the crash fixture also has silent lines' },
    { text: 'if (require.main === module) process.exit(main(process.argv.slice(2)))', count: 1, verdict: 'silent', reason: 'this suite requires the tool rather than spawning it, so the entry point never runs' },
    { text: 'module.exports = { main }', count: 1, verdict: 'crashed', reason: 'the suite requires the tool in process, so removing the export throws before any assertion runs' }
  ] });
  const r = run(d);
  ok('a crashed line accepted AS crashed, with a reason, passes', r.code === 0);
}
{
  const d = crashWorld({ 't.js': [
    { text: "'use strict'", count: 1, verdict: 'silent', reason: 'strict mode changes nothing this suite observes' },
    { text: 'var unused = 1', count: 1, verdict: 'silent', reason: 'dead, and kept so the crash fixture also has silent lines' },
    { text: 'if (require.main === module) process.exit(main(process.argv.slice(2)))', count: 1, verdict: 'silent', reason: 'this suite requires the tool rather than spawning it, so the entry point never runs' },
    { text: 'module.exports = { main }', count: 1, verdict: 'silent', reason: 'accepted as silent, which it is not' }
  ] });
  const r = run(d);
  ok('a line accepted as SILENT that is now CRASHED refuses, so a reason cannot describe the wrong thing',
    r.code === 1 && /accepted as silent and is now crashed/.test(r.out));
}
{
  // An entry written before the two were separated carries no verdict field at all. Every one of
  // those was recorded under the old rule, which accepted only silent, so it must read as silent
  // and NOT quietly grant a crashed line an exemption nobody wrote.
  const d = crashWorld({ 't.js': [
    { text: "'use strict'", count: 1, reason: 'no verdict field, written before the split' },
    { text: 'var unused = 1', count: 1, reason: 'no verdict field, written before the split' },
    { text: 'if (require.main === module) process.exit(main(process.argv.slice(2)))', count: 1, reason: 'no verdict field, written before the split' },
    { text: 'module.exports = { main }', count: 1, reason: 'no verdict field, written before the split' }
  ] });
  const r = run(d);
  ok('a pre-split entry with no verdict is read as silent, so the crashed line still refuses',
    r.code === 1 && /accepted as silent and is now crashed/.test(r.out));
  ok('and the genuinely silent one is NOT dragged into the same complaint',
    !/is now crashed: 'use strict'/.test(r.out));
}

junk.forEach(d => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* temp */ } });

/* The total is pinned here rather than measured from the run it checks, because a self-updating
   total agrees with any run. Mutation: delete an assertion above and this goes red alone. */
/* The guard for --root sat AFTER path.resolve(value || '.'), so a missing value had already
   become the working directory and the guard could never match. The test named for that guard
   exercised --tool only, so no mutation of the --root handling could redden it, which is the
   defect that hid the defect. Measured: resolve before the guard again and this suite reads
   33 passed, 2 failed, which is both of these. */
{
  const raw = (extra) => {
    try {
      return { code: 0, out: execFileSync(process.execPath, [TOOL].concat(extra), { stdio: ['pipe', 'pipe', 'pipe'] }).toString() };
    } catch (e) {
      return { code: e.status, out: ((e.stdout || '') + (e.stderr || '')).toString() };
    }
  };
  const a = raw(['--root']);
  ok('--root with nothing after it is a usage error naming root, and not a run against the '
   + 'working directory', a.code === 2 && /--root needs a value/.test(a.out));
  const b = raw(['--root', '--quiet']);
  ok('and a flag that would swallow the next flag as its value is the same', b.code === 2 &&
    /--root needs a value/.test(b.out));
}

const EXPECTED_ASSERTIONS = 41;
const ranBefore = pass + fail;
ok('the suite ran every assertion: ran ' + (ranBefore + 1) + ' of ' + EXPECTED_ASSERTIONS
  + '. A block was skipped or deleted. Find out which before you change the number.',
  ranBefore === EXPECTED_ASSERTIONS - 1);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
