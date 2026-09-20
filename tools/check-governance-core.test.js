#!/usr/bin/env node
'use strict';
/*
 * Tests for check-governance-core.js.
 *
 * Every assertion here has been watched failing, by breaking the checker on a COPY and confirming
 * this suite goes red. A check nobody has seen fail is indistinguishable from one that always
 * passes, and this tool went red on its own author's file within a minute of being written: the
 * `*Reference-only:*` line was wrapped across two lines, so the parser saw none of it and reported
 * four orphaned sections. That is the behaviour under test in the wrapped-pointer block below.
 *
 * THE TOOL IS SPAWNED, NEVER CALLED IN PROCESS. A mutation that makes the tool throw would kill an
 * in-process suite, which then prints no count at all, and a coverage derivation cannot tell that
 * from a line nothing depends on. S127 cost 37 covered lines to exactly that.
 *
 * THE THREE COVERAGE FAULTS ARE ASSERTED SEPARATELY AND BY THEIR REASON, not by the exit code,
 * because exit 1 is reached four different ways here and only the printed reason tells them apart.
 * An ORPHANED section is a rule that has silently stopped applying; a DANGLING pointer is a reason
 * nobody can find; a DUPLICATE heading is one document disagreeing with itself. Collapsing any two
 * of them makes the refusal unactionable.
 *
 * THE ORPHAN AND THE DANGLING POINTER ARE THE SAME MECHANISM RUN IN OPPOSITE DIRECTIONS, and both
 * are fixtured, because the second direction is the half a hand-written coverage claim never has:
 * without it a pointer rots unnoticed the moment somebody renames a section. S123.
 *
 * REACH IS FIXTURED AT BOTH LEVELS. A project holding the core in its OWN directory and not
 * importing it must REFUSE, because delivered is not loaded (S70). A venture sub-project that
 * inherits the file from one directory up must be REPORTED and NOT refused, because the remedy
 * for it, an upward relative import, has never been verified in this host and refusing on an
 * unverified remedy publishes a claim nobody measured (S128, ST-169). Those two are asserted
 * against each other in one world, so a change that collapses them cannot pass.
 *
 * THE SIZE LINE IS ASSERTED TO BE A REPORT AND NOT A REFUSAL. A core LARGER than its reference
 * still exits 0. That is deliberate and it is the S126 hazard: a size cap would be met by moving
 * rules out into the un-imported reference, which is the precise failure this tool exists to
 * catch, so coverage refuses and size only prints.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
/* ST-281: fixture roots come from ONE place that makes them unique and removes them at exit. */
const { fixtureRoot } = require('./tmp-fixtures.js');

const TOOL = path.join(__dirname, 'check-governance-core.js');
let pass = 0, fail = 0;
function ok (name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL  ' + name); } }

const junk = [];
let n = 0;

function world () {
  const d = fixtureRoot('gov-core');
  junk.push(d);
  return d;
}

// The smallest fixture that is still the real shape: headings on one side, pointer lines on the
// other, closed by an asterisk.
function gov (root, refSections, reasons, refOnly) {
  const g = path.join(root, 'gov');
  fs.mkdirSync(g, { recursive: true });
  fs.writeFileSync(path.join(g, 'GLOBAL_WAYS_OF_WORKING.md'),
    '# ref\n\n' + refSections.map(s => '## ' + s + '\n\nbody for ' + s + '\n').join('\n'), 'utf8');
  let core = '# core\n\n';
  if (reasons.length) core += '## 1. rules\n\n*Reasons: ' + reasons.join('; ') + '.*\n\n- a rule\n\n';
  if (refOnly && refOnly.length) core += '*Reference-only: ' + refOnly.join('; ') + '.*\n';
  fs.writeFileSync(path.join(g, 'GOVERNANCE_CORE.md'), core, 'utf8');
  return g;
}

function run (args) {
  try {
    return { code: 0, out: execFileSync('node', [TOOL].concat(args), { stdio: ['pipe', 'pipe', 'pipe'] }).toString() };
  } catch (e) {
    return { code: e.status, out: ((e.stdout || '') + (e.stderr || '')).toString() };
  }
}

// A project tree for the reach half. See the header for what holding and loading mean.
function projects (root, spec) {
  const r = path.join(root, 'projects');
  fs.mkdirSync(r, { recursive: true });
  for (const p of spec) {
    const dir = path.join(r, p.name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'),
      '# ' + p.name + '\n\n' + (p.imports ? '@GOVERNANCE_CORE.md\n' : '') + '@WARM_START.md\n', 'utf8');
    if (p.holds) fs.writeFileSync(path.join(dir, 'GOVERNANCE_CORE.md'), 'core\n', 'utf8');
    if (p.sub) {
      const s = path.join(dir, p.sub);
      fs.mkdirSync(s, { recursive: true });
      fs.writeFileSync(path.join(s, 'CLAUDE.md'), '# ' + p.sub + '\n\nno imports at all\n', 'utf8');
    }
  }
  return r;
}

{
  const w = world();
  const g = gov(w, ['Alpha rule', 'Beta rule', 'Just a diagram'], ['Alpha rule', 'Beta rule'], ['Just a diagram']);
  const r = run(['--gov', g]);
  ok('a core accounting for every reference section passes', r.code === 0);
  ok('and it says so rather than printing nothing', /every reference section is accounted for/.test(r.out));
  ok('and it reports how many it cited each way, so the split is readable',
    /cites 2 as reasoning, 1 as reference-only/.test(r.out));
}

{
  const w = world();
  const g = gov(w, ['Alpha rule', 'Beta rule'], ['Alpha rule'], []);
  const r = run(['--gov', g]);
  ok('a reference section the core never accounts for refuses', r.code === 1);
  ok('and it names the section, so it can be found', /Beta rule/.test(r.out));
  ok('and it gives THIS reason, because exit 1 is reached four ways here',
    /orphaned section, neither cited as reasoning nor listed reference-only/.test(r.out));
}

{
  const w = world();
  const g = gov(w, ['Alpha rule'], ['Alpha rule', 'Gamma rule that was renamed'], []);
  const r = run(['--gov', g]);
  ok('a core citing a section that does not exist refuses', r.code === 1);
  ok('and it names the pointer rather than the section it expected',
    /Gamma rule that was renamed/.test(r.out));
  ok('and it gives THIS reason and not the orphan one',
    /the core names a section that does not exist/.test(r.out));
  ok('and the orphan reason is absent, so the two verdicts are distinguishable',
    !/orphaned section/.test(r.out));
}

{
  const w = world();
  const g = gov(w, ['Alpha rule', 'Beta rule', 'Alpha rule'], ['Alpha rule', 'Beta rule'], []);
  const r = run(['--gov', g]);
  ok('the same heading twice in the reference refuses', r.code === 1);
  ok('and it says how many times, because twice and five times are different problems',
    /duplicate section .*2 times/.test(r.out));
  ok('and a duplicate does NOT also read as an orphan, which would double-count one fault',
    !/orphaned section/.test(r.out));
  ok('and the count line separates total sections from distinct ones',
    /3 section\(s\), 2 distinct/.test(r.out));
}

{
  const w = world();
  const g = path.join(w, 'gov');
  fs.mkdirSync(g, { recursive: true });
  fs.writeFileSync(path.join(g, 'GLOBAL_WAYS_OF_WORKING.md'), '## Alpha rule\n\nbody\n', 'utf8');
  fs.writeFileSync(path.join(g, 'GOVERNANCE_CORE.md'),
    '# core\n\n*Reasons: Alpha\nrule.*\n\n- a rule\n', 'utf8');
  const r = run(['--gov', g]);
  ok('a pointer line wrapped across two lines is not silently accepted', r.code === 1);
  ok('and the failure is the orphan, which is what a session would actually suffer',
    /orphaned section/.test(r.out));
  ok('and it counts zero pointers rather than pretending it parsed one',
    /cites 0 as reasoning/.test(r.out));
}

{
  const w = world();
  const g = gov(w, ['Alpha rule'], ['Alpha rule'], []);
  const p = projects(w, [
    { name: 'loads', holds: true, imports: true },
    { name: 'silent', holds: true, imports: false },
    { name: 'venture', holds: true, imports: true, sub: 'child' }
  ]);
  const r = run(['--gov', g, '--root', p]);
  ok('a project holding the core and not importing it refuses', r.code === 1);
  ok('and it names that project and not the one that loads it',
    /does not import it: .*silent/.test(r.out) && !/does not import it: .*[\\/]loads/.test(r.out));
  ok('and it prints the ratio, so the gap is a number rather than a list',
    /2 of 3 project\(s\) holding the core also import it/.test(r.out));
  ok('a sub-project inheriting the file from the venture root is REPORTED',
    /venture sub-project\(s\) inherit the core/.test(r.out));
  ok('and it is not counted as a holder, which would make the ratio wrong',
    !/of 4 project\(s\) holding/.test(r.out));
  ok('and the report names the ticket that carries the unverified remedy', /ST-169/.test(r.out));
}
{
  // The same tree with the one silent project fixed. Without this the refusal above could be
  // coming from the sub-project after all, and the pair would prove nothing about which is which.
  const w = world();
  const g = gov(w, ['Alpha rule'], ['Alpha rule'], []);
  const p = projects(w, [
    { name: 'loads', holds: true, imports: true },
    { name: 'venture', holds: true, imports: true, sub: 'child' }
  ]);
  const r = run(['--gov', g, '--root', p]);
  ok('a sub-project importing nothing does NOT by itself refuse', r.code === 0);
  ok('and it is still reported, so it cannot be forgotten',
    /1 venture sub-project\(s\) inherit the core/.test(r.out));
}

{
  const w = world();
  const g = gov(w, ['Alpha rule'], ['Alpha rule'], []);
  const r = run(['--gov', g]);
  ok('without --root the tool says nothing about reach', !/reach across/.test(r.out));
  ok('and still returns the coverage verdict', r.code === 0);
}

{
  const w = world();
  const g = path.join(w, 'gov');
  fs.mkdirSync(g, { recursive: true });
  fs.writeFileSync(path.join(g, 'GLOBAL_WAYS_OF_WORKING.md'), '## Alpha rule\n\nb\n', 'utf8');
  fs.writeFileSync(path.join(g, 'GOVERNANCE_CORE.md'),
    '# core\n\n*Reasons: Alpha rule.*\n\n' + 'padding padding padding\n'.repeat(200), 'utf8');
  const r = run(['--gov', g]);
  ok('a core LARGER than the reference it replaces still passes, because a cap becomes a target',
    r.code === 0);
  ok('and the ratio is printed anyway, so the reader can see it went the wrong way',
    /per cent of what it replaces/.test(r.out));
}

{
  const r = run(['--gov']);
  ok('a flag with nothing after it is a usage error naming the flag', r.code === 2 && /--gov/.test(r.out));
}
{
  const w = world();
  const r = run(['--gov', path.join(w, 'nowhere')]);
  ok('a governance directory that does not exist is cannot-tell and never a coverage finding',
    r.code === 3);
  ok('and it names the directory it could not read', /nowhere/.test(r.out));
}
{
  const w = world();
  const g = path.join(w, 'gov');
  fs.mkdirSync(g, { recursive: true });
  fs.writeFileSync(path.join(g, 'GOVERNANCE_CORE.md'), '# core\n', 'utf8');
  const r = run(['--gov', g]);
  ok('a core with no reference beside it is exit 2, not a clean pass on zero sections', r.code === 2);
}

{
  const w = world();
  const g = gov(w, ['Alpha rule'], ['Alpha rule'], []);
  const r = run(['--gov', g, '--quiet']);
  ok('--quiet on a clean run prints nothing at all', r.code === 0 && r.out.trim() === '');
}
{
  const w = world();
  const g = gov(w, ['Alpha rule', 'Beta rule'], ['Alpha rule'], []);
  const r = run(['--gov', g, '--quiet']);
  ok('--quiet still prints the failure, because a silent refusal is unactionable',
    r.code === 1 && /orphaned section/.test(r.out));
}

for (const d of junk) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} }

/* A copy installed from the public export carries this check and CANNOT carry base/governance,
   which deliberately does not publish. While a missing directory read as a failure, that copy was
   red in the session-start and release sets on every machine forever and no reader could ever
   clear it, which is the thing a sibling gate forbids in its own header. Measured: return 2 rather
   than 3 for the absent directory and this suite reads 36 passed, 2 failed, the two being the
   absent-directory assertions here and below, while the exists-but-empty case stays green, which
   is what says the fix distinguishes an absence from a defect rather than accepting both. */
{
  const gone = path.join(os.tmpdir(), 'gov-core-absent-' + process.pid);
  const r = run(['--gov', gone, '--root', os.tmpdir(), '--quiet']);
  ok('a governance directory that is not there AT ALL is cannot-tell rather than a failure, '
   + 'because a public install can never carry one', r.code === 3);
  ok('and it names the directory it went looking for', r.out.indexOf(gone) !== -1);
  const empty = fixtureRoot('gov-core-empty');
  const r2 = run(['--gov', empty, '--root', os.tmpdir(), '--quiet']);
  ok('while a directory that EXISTS with the documents missing is still a read error, because '
   + 'that is a defect rather than an absence', r2.code === 2);
}

const EXPECTED_ASSERTIONS = 38;
if (pass + fail !== EXPECTED_ASSERTIONS) {
  fail++;
  console.log('FAIL  the suite ran every assertion: ran ' + (pass + fail - 1) + ' of ' + EXPECTED_ASSERTIONS +
    '. A block was skipped or deleted. Find out which before you change the number.');
}
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
