#!/usr/bin/env node
'use strict';
/*
 * Every assertion here has been watched failing, by breaking check-print-anchors.js and
 * confirming this suite goes red. Each case builds its own fixture (S59).
 *
 * THE MOST IMPORTANT CASE IN THIS FILE is the one that proves the detector sees a REGEX
 * assertion. The first version of the tool read only quoted strings, found nine findings, and
 * missed every one of the three instances it was written for, because the assertions that
 * matter are written as /Session: s1\.jsonl/ with no quotation mark on the line. A detector
 * that cannot see the case it was built for is S219: a check that never fires and a check with
 * nothing to report produce byte-identical evidence.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
/* ST-281: fixture roots come from ONE place that makes them unique and removes them at exit. */
const { fixtureRoot } = require('./tmp-fixtures.js');

const TOOL = path.join(__dirname, 'check-print-anchors.js');
let pass = 0, fail = 0;
function ok (name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL  ' + name); } }

const LF = String.fromCharCode(10);
const BS = String.fromCharCode(92);
let n = 0;

function world (files, config, baseline) {
  const dir = path.join(fixtureRoot('print-anchors'), 'tree');
  fs.mkdirSync(path.join(dir, 'tools'), { recursive: true });
  for (const rel of Object.keys(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, files[rel], 'utf8');
  }
  if (config) fs.writeFileSync(path.join(dir, 'tools', 'print-anchors.json'), JSON.stringify(config), 'utf8');
  if (baseline) fs.writeFileSync(path.join(dir, 'tools', 'print-anchors-baseline.json'), JSON.stringify(baseline), 'utf8');
  return dir;
}

function run (dir, extra) {
  const args = [TOOL, '--root', dir].concat(extra || []);
  try { return { code: 0, out: execFileSync('node', args, { stdio: ['pipe', 'pipe', 'pipe'] }).toString() }; }
  catch (e) { return { code: e.status, out: ((e.stdout || '') + (e.stderr || '')).toString() }; }
}

const PAIR = { pairs: [{ tool: 'tools/t.js', suite: 'tools/t.test.js' }], accept: [] };

// ---------------------------------------------------------------- the defect it exists for

{
  // S223 exactly: one string, two print sites, one assertion over the whole output.
  // The two sites print the SAME literal, which is what makes them one message emitted twice.
  // Two different literals are two different messages and correctly are not this defect.
  const dir = world({
    'tools/t.js': "process.stdout.write('  Session: ' + a);" + LF + "process.stdout.write('  Session: ' + b);" + LF,
    'tools/t.test.js': "ok('names the transcript', /Session: one/.test(out));" + LF,
  }, PAIR, { counts: { 'tools/t.js': 0 } });
  const r = run(dir);
  ok('an assertion matching a string printed from two places is reported', /1 unanchored assertion/.test(r.out));
  ok('the finding names every print site by line, not just the count', /lines 1, 2/.test(r.out));
  ok('the finding explains WHY it matters rather than only flagging it', /UNION of those sites/.test(r.out));
  ok('a rise above the baseline refuses', r.code === 1 && /ROSE/.test(r.out));
}

{
  // The case the first version of this tool could not see at all.
  const dir = world({
    'tools/t.js': "process.stdout.write('  Session: ' + name);" + LF + "process.stdout.write('  Session: ' + other);" + LF,
    'tools/t.test.js': '/Session: s1' + BS + '.jsonl/.test(r.out);' + LF,
  }, PAIR, { counts: { 'tools/t.js': 0 } });
  const r = run(dir);
  ok('a REGEX assertion is read, which is the form the known instances are written in', /1 unanchored assertion/.test(r.out));
  ok('the regex escape is unescaped before matching, so s1\\.jsonl finds the printed fragment', /Session:/.test(r.out));
}

// ---------------------------------------------------------------- what it must NOT report

{
  const dir = world({
    'tools/t.js': "process.stdout.write('  Session: only here' + LF);" + LF,
    'tools/t.test.js': "ok('names it', /Session: only here/.test(out));" + LF,
  }, PAIR, { counts: { 'tools/t.js': 0 } });
  const r = run(dir);
  ok('a string printed from ONE place is not a finding, or every assertion is one', r.code === 0);
}

{
  const dir = world({
    'tools/t.js': "process.stdout.write('FAIL one' + LF);" + LF + "process.stdout.write('FAIL two' + LF);" + LF,
    'tools/t.test.js': "ok('fails', /FAIL/.test(out));" + LF,
  }, PAIR, { counts: { 'tools/t.js': 0 } });
  ok('a short shared word is below the distinctiveness floor and is not reported', run(dir).code === 0);
}

{
  const dir = world({
    'tools/t.js': '// process.stdout.write("  Session: in a comment");' + LF
      + "process.stdout.write('  Session: real' + LF);" + LF,
    'tools/t.test.js': "ok('x', /Session: real/.test(out));" + LF,
  }, PAIR, { counts: { 'tools/t.js': 0 } });
  ok('a commented-out print is not a print site, or every long header in this repo is one', run(dir).code === 0);
}

// ---------------------------------------------------------------- the accept list

{
  const files = {
    'tools/t.js': "process.stdout.write('  Session: ' + a);" + LF + "process.stdout.write('  Session: ' + b);" + LF,
    'tools/t.test.js': "ok('counts both', /Session: one/.test(out));" + LF,
  };
  const dir = world(files, {
    pairs: [{ tool: 'tools/t.js', suite: 'tools/t.test.js' }],
    accept: [{ pair: 'tools/t.js', literal: 'Session: one', reason: 'this assertion counts both sites deliberately' }],
  }, { counts: { 'tools/t.js': 0 } });
  ok('an accept with a reason suppresses the finding', run(dir).code === 0);
}

{
  const dir = world({
    'tools/t.js': "process.stdout.write('  Session: one' + LF);" + LF,
    'tools/t.test.js': "ok('x', /Session: one/.test(out));" + LF,
  }, {
    pairs: [{ tool: 'tools/t.js', suite: 'tools/t.test.js' }],
    accept: [{ pair: 'tools/t.js', literal: 'Session: one', reason: 'was two sites once' }],
  }, { counts: { 'tools/t.js': 0 } });
  const r = run(dir);
  ok('an accept that no longer suppresses anything FAILS as stale', r.code === 1 && /STALE ACCEPT/.test(r.out));
  ok('the stale message says it would hide the next real finding', /hide the next real one/.test(r.out));
}

// ---------------------------------------------------------------- the ratchet

{
  const files = {
    'tools/t.js': "process.stdout.write('  Session: ' + a);" + LF + "process.stdout.write('  Session: ' + b);" + LF,
    'tools/t.test.js': "ok('x', /Session: one/.test(out));" + LF,
  };
  const dir = world(files, PAIR, { counts: { 'tools/t.js': 1 } });
  const r = run(dir);
  ok('a count at the baseline passes, because the existing instances are not all fixable at once', r.code === 0);
  ok('and the findings are STILL PRINTED at the baseline, so the list is not hidden by the number',
    /unanchored assertion/.test(r.out));
}

{
  const files = {
    'tools/t.js': "process.stdout.write('  Session: ' + a);" + LF + "process.stdout.write('  Session: ' + b);" + LF,
    'tools/t.test.js': "ok('x', /Session: one/.test(out));" + LF,
  };
  const dir = world(files, PAIR, { counts: { 'tools/other.js': 0 } });
  const r = run(dir);
  ok('a pair missing from the baseline refuses rather than being recorded silently', r.code === 1 && /NEW PAIR/.test(r.out));
}

{
  const files = {
    'tools/t.js': "process.stdout.write('  Session: one' + LF);" + LF,
    'tools/t.test.js': "ok('x', /Session: one/.test(out));" + LF,
  };
  const dir = world(files, PAIR, { counts: { 'tools/t.js': 3 } });
  const r = run(dir);
  ok('a count BELOW the baseline passes and says to lock it in', r.code === 0 && /fell/.test(r.out));
}

{
  const dir = world({ 'tools/t.js': 'x' + LF, 'tools/t.test.js': 'y' + LF }, PAIR, null);
  ok('no baseline at all is CANNOT TELL, exit 2, and not a pass', run(dir).code === 2);
}

{
  const dir = world({ 'tools/t.js': 'x' + LF, 'tools/t.test.js': 'y' + LF }, null, null);
  ok('no config is CANNOT TELL, exit 2', run(dir).code === 2);
}

{
  const dir = world({ 'tools/t.js': 'x' + LF, 'tools/t.test.js': 'y' + LF }, PAIR, { counts: {} });
  const r = run(dir, ['--write-baseline']);
  ok('--write-baseline without --allow-rise refuses', r.code === 1);
  ok('and it says why: a baseline nobody had to justify', /nobody had to justify/.test(r.out));
}

{
  const dir = world({ 'tools/t.js': 'x' + LF, 'tools/t.test.js': 'y' + LF }, PAIR, null);
  const r = run(dir, ['--write-baseline', '--allow-rise', 'because']);
  ok('--write-baseline with a reason writes the file', r.code === 0
    && fs.existsSync(path.join(dir, 'tools', 'print-anchors-baseline.json')));
  const written = JSON.parse(fs.readFileSync(path.join(dir, 'tools', 'print-anchors-baseline.json'), 'utf8'));
  ok('the written baseline records the reason, so the number has its justification beside it', written.reason === 'because');
}

{
  const dir = world({ 'tools/t.test.js': 'y' + LF }, PAIR, { counts: {} });
  const r = run(dir);
  ok('a pair whose tool does not exist is reported rather than skipped in silence', /CANNOT READ the pair/.test(r.out));
}


// The total is PINNED and written down rather than measured from the run it checks, because a
// self-updating total agrees with any run. Measured elsewhere in this repository: a fatal guard
// firing part way through a suite reported 0 failed and exit 0 having run 22 of 214, so a count
// of failures cannot see an assertion that never ran. Mutation: delete a block above and this
// goes red alone.
const EXPECTED_ASSERTIONS = 23;
if (pass + fail !== EXPECTED_ASSERTIONS) {
  console.log('FAIL  the suite ran ' + (pass + fail) + ' assertion(s) and expects ' + EXPECTED_ASSERTIONS + '. A block was skipped or deleted. Find out which before you change the number.');
  fail++;
}

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
