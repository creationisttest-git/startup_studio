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
// CEO constraint, ST-088: archiving is only safe while the trail can still be followed from the
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

junk.forEach(d => fs.rmSync(d, { recursive: true, force: true }));
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
