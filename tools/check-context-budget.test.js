#!/usr/bin/env node
'use strict';
/*
 * Tests for check-context-budget.js.
 *
 * Every assertion here has been watched failing, by breaking the checker and confirming this
 * suite goes red. A check nobody has seen fail is indistinguishable from one that always passes.
 *
 * Each rule is asserted BOTH ways wherever it can be: once that it catches what it names, and
 * once that it does NOT catch a legitimate case. A check that fails everything passes the first
 * half and is useless, and only the second failure mode announces itself quietly.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TOOL = path.join(__dirname, 'check-context-budget.js');
let pass = 0, fail = 0;
function ok (name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL  ' + name); } }

const junk = [];
let n = 0;
function project (files) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-ctx-' + process.pid + '-' + (n++) + '-'));
  junk.push(d);
  for (const name of Object.keys(files)) {
    const p = path.join(d, name);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, files[name], 'utf8');
  }
  return d;
}
// Returns { code, out }. The tool exits 1 on a finding, so a throw is the normal path.
function run (dir) {
  try {
    const out = execFileSync('node', [TOOL, dir, '--quiet'], { stdio: ['pipe', 'pipe', 'pipe'] }).toString();
    return { code: 0, out: out };
  } catch (e) {
    return { code: e.status, out: ((e.stdout || '') + (e.stderr || '')).toString() };
  }
}
const filler = k => 'x'.repeat(k);

// --- a healthy project passes, which is the half that announces a check gone paranoid ---------
{
  const d = project({
    'CLAUDE.md': '# p\n\n@WARM_START.md\n',
    'WARM_START.md': '## Next action\n\ndo the thing\n\n## Session log\n\n' + filler(2000) + '\n',
  });
  const r = run(d);
  ok('a healthy project passes', r.code === 0);
  ok('and it says so rather than printing nothing', /0 failed/.test(r.out));
}

// --- the hard per-file limit ------------------------------------------------------------------
{
  const d = project({ 'CLAUDE.md': '# p\n\n@BIG.md\n', 'BIG.md': '## Session log\n\n' + filler(160000) });
  const r = run(d);
  ok('a single document past the limit is refused', r.code === 1);
  ok('and the refusal NAMES the offending file, not just a total', /BIG\.md/.test(r.out));
}

// --- the same limit applied to the total ------------------------------------------------------
// Measured on a real project: 306k spread over four files, none individually over, which is the
// same cost per request and tripped no per-file warning at all.
{
  const d = project({
    'CLAUDE.md': '# p\n\n@A.md\n@B.md\n@C.md\n',
    'A.md': '## Session log\n\n' + filler(60000),
    'B.md': '## Session log\n\n' + filler(60000),
    'C.md': '## Session log\n\n' + filler(60000),
  });
  const r = run(d);
  ok('weight spread across files with none over the limit is still refused', r.code === 1);
  ok('and the total check is what refuses it, not the per-file one',
     /the total loaded is under the limit/.test(r.out) && !/no single loaded document/.test(r.out.split('\n').filter(l => l.startsWith('FAIL')).join('\n')));
}

// --- sections that are meant to be replaced ---------------------------------------------------
{
  const d = project({
    'CLAUDE.md': '# p\n\n@WARM_START.md\n',
    'WARM_START.md': '## Next action\n\n' + filler(20000) + '\n',
  });
  const r = run(d);
  ok('a disposable section past its budget is refused', r.code === 1);
  ok('and the refusal names the section, so it can be found', /Next action/.test(r.out));
}
// The discrimination half. A session log is history and grows honestly; flagging it would make
// this check indistinguishable from the file-size check it sits beside.
{
  const d = project({
    'CLAUDE.md': '# p\n\n@WARM_START.md\n',
    'WARM_START.md': '## Session log\n\n' + filler(20000) + '\n',
  });
  const r = run(d);
  ok('a section that grows honestly is NOT flagged as disposable',
     r.code === 0 || !/should be replaced/.test(r.out.split('\n').filter(l => l.startsWith('FAIL')).join('\n')));
}

// --- an archive must stay findable ------------------------------------------------------------
// CEO constraint: archiving is only safe while the trail can still be followed from the
// document that IS loaded. A decision nobody can find gets re-litigated.
{
  const d = project({
    'CLAUDE.md': '# p\n\n@WARM_START.md\n',
    'WARM_START.md': '## Next action\n\ngo\n',
    'DECISIONS-ARCHIVE.md': '| 1 | old decision |\n',
  });
  const r = run(d);
  ok('an archive nothing points at is refused', r.code === 1);
  ok('and it names the orphaned archive', /DECISIONS-ARCHIVE\.md/.test(r.out));
}
{
  const d = project({
    'CLAUDE.md': '# p\n\n@WARM_START.md\n',
    'WARM_START.md': '## Next action\n\ngo\n\nOlder decisions moved to DECISIONS-ARCHIVE.md\n',
    'DECISIONS-ARCHIVE.md': '| 1 | old decision |\n',
  });
  ok('an archive the live document points at is accepted', run(d).code === 0);
}

// --- usage and missing imports ----------------------------------------------------------------
{
  const d = project({ 'README.md': 'no claude file here' });
  ok('a directory with no CLAUDE.md is a usage error, not a pass', run(d).code === 2);
}
{
  // A missing import loads nothing and must not crash the check that measures it.
  const d = project({ 'CLAUDE.md': '# p\n\n@GONE.md\n' });
  const r = run(d);
  ok('a missing import contributes nothing and does not crash', r.code === 0 && !/Error/.test(r.out));
}


// --- IMPORTS ARE FOLLOWED ALL THE WAY DOWN ----------------------------------------------------
// This was a single flat loop over CLAUDE.md's own imports, so a project whose CLAUDE.md imports
// another CLAUDE.md had everything below level one invisible, and the tool enforcing the limit
// reported a clean bill on a real project already 11 per cent over it. ST-190.
//
// EVERY FIXTURE BELOW IS SIZED SO THE TWO ANSWERS LAND ON OPPOSITE SIDES OF THE REFUSAL. A walk
// that stops at level one cannot reach the limit and a walk that goes all the way must, so each
// assertion is about the defect rather than about a number that happens to differ.
function runLoud (dir) {
  try { return { code: 0, out: execFileSync('node', [TOOL, dir], { stdio: ['pipe', 'pipe', 'pipe'] }).toString() }; }
  catch (e) { return { code: e.status, out: ((e.stdout || '') + (e.stderr || '')).toString() }; }
}
{
  const d = project({
    'CLAUDE.md': '# p\n\n@sub/CLAUDE.md\n',
    'sub/CLAUDE.md': '# nested\n\n@DEEP.md\n',
    'sub/DEEP.md': filler(160000),
  });
  const r = run(d);
  ok('an import of an import is counted, so a nested project cannot hide its weight',
     r.code === 1 && /past 150000/.test(r.out));
}
{
  // AN IMPORT RESOLVES AGAINST THE FILE THAT DECLARES IT, not against the project root. The decoy
  // at the root has the same NAME and a harmless size, so root-relative resolution finds a real
  // file and passes. WITHOUT the decoy a root-relative walk simply finds nothing at level two,
  // which reads exactly like a project that has no second level, and the fixture would then agree
  // with the defect instead of catching it.
  const d = project({
    'CLAUDE.md': '# p\n\n@sub/CLAUDE.md\n',
    'sub/CLAUDE.md': '# nested\n\n@DEEP.md\n',
    'sub/DEEP.md': filler(160000),
    'DEEP.md': filler(10),
  });
  const r = run(d);
  ok('a nested import resolves beside its own file, not at the project root',
     r.code === 1 && /past 150000/.test(r.out));
}
{
  // A DOCUMENT REACHED TWICE IS LOADED ONCE, which makes the seen-set load bearing for the TOTAL
  // and not only for cycle safety. Charged twice this fixture is over 160,000 and REFUSES; charged
  // once it is about 80,000 and passes.
  const d = project({
    'CLAUDE.md': '# p\n\n@sub/CLAUDE.md\n@sub/DEEP.md\n',
    'sub/CLAUDE.md': '# nested\n\n@DEEP.md\n',
    'sub/DEEP.md': filler(80000),
  });
  ok('a document reached by two paths is charged once, not twice', run(d).code === 0);
}
{
  // A CYCLE MUST NOT HANG. Two documents importing each other is a mistake somebody will make, and
  // a check that never returns is worse than one that refuses: it takes the whole set down with no
  // verdict at all, which is the shape of S149. A timeout kills the child and reddens this line.
  const d = project({
    'CLAUDE.md': '# p\n\n@a.md\n',
    'a.md': '# a\n\n@b.md\n',
    'b.md': '# b\n\n@a.md\n@CLAUDE.md\n',
  });
  // IT MUST REACH A VERDICT, not merely stop. The first version of this assertion asked only
  // whether the child had been killed, and the obvious mutation -- taking the seen-set out -- 
  // recurses until the stack overflows, which exits 1 and is not a kill, so the assertion stayed
  // GREEN while the tool crashed. Node exits 1 on an uncaught throw and this tool exits 1 on a
  // finding, so an exit code cannot tell a crash from a result: only the summary line can. S76.
  const verdict = run(d);
  ok('a cycle of imports reaches a verdict instead of hanging or overflowing',
     /[0-9]+ passed, [0-9]+ failed/.test(verdict.out));
}
{
  // THE TREE IS PRINTED WITH DEPTH. A flat list says WHAT is loaded and never which file pulled in
  // what, and on the nested projects this fix exists for that is the question a reader has.
  // Measured by where the NAME starts, not by leading whitespace: the size column is right
  // aligned, so a one-character file and a six-character one have different leading runs and an
  // indent test would be measuring the number rather than the depth.
  const d = project({
    'CLAUDE.md': '# p\n\n@sub/CLAUDE.md\n',
    'sub/CLAUDE.md': '# nested\n\n@DEEP.md\n',
    'sub/DEEP.md': 'x',
  });
  const lines = runLoud(d).out.split(/\r?\n/);
  const one = lines.filter(l => l.indexOf('sub/CLAUDE.md') !== -1)[0] || '';
  const two = lines.filter(l => l.indexOf('DEEP.md') !== -1)[0] || '';
  ok('the printed tree indents a document under the file that imported it',
     one !== '' && two !== '' && two.indexOf('DEEP.md') > one.indexOf('sub/CLAUDE.md'));
}

junk.forEach(d => fs.rmSync(d, { recursive: true, force: true }));
/* Measured: a fatal guard firing part way through the studio suite reported 0 failed
   and exit 0, having run 22 of 214, so a count of failures cannot see an assertion that
   never ran. The total is pinned here, and the number is written down rather than measured
   from the run it checks, because a self-updating total agrees with any run. S35 is the same
   rule applied to the summary. Mutation: delete an assertion above and this goes red alone. */
const EXPECTED_ASSERTIONS = 20;   // +5, ST-190: transitive walk, file-relative resolution, dedupe, cycle, printed depth
const ranBefore = pass + fail;
ok('the suite ran every assertion: ran ' + (ranBefore + 1) + ' of ' + EXPECTED_ASSERTIONS
  + '. A block was skipped or deleted. Find out which before you change the number.',
  ranBefore === EXPECTED_ASSERTIONS - 1);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
