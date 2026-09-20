#!/usr/bin/env node
'use strict';
/*
 * Every assertion here has been watched failing, by breaking patch.js and confirming this
 * suite goes red. A check nobody has seen fail is indistinguishable from one that always passes.
 *
 * Each assertion is also written so it can fail ALONE (S59). Every case builds its own file in
 * its own temp directory rather than reusing one and varying a field, because the single most
 * important property of this tool is that a REFUSED patch leaves the target byte-identical,
 * and a shared fixture cannot prove that.
 *
 * THE BACKSLASH IS THE SUBJECT, so it is never typed as an escape in this file. BS is built
 * with String.fromCharCode(92). Writing this suite with literal escapes would reproduce ST-079
 * inside the suite that exists to prove ST-079 is fixed, and the suite would still pass.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const P = require('./patch.js');
/* ST-281: fixture roots come from ONE place that makes them unique and removes them at exit. */
const { fixtureRoot } = require('./tmp-fixtures.js');

const TOOL = path.join(__dirname, 'patch.js');
const BS = String.fromCharCode(92);
const LF = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const NUL = String.fromCharCode(0);

let pass = 0, fail = 0;
function ok (name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL  ' + name); } }

let n = 0;
function fixture (name, body) {
  const dir = fixtureRoot('studio-patch');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, body, 'utf8');
  return file;
}
function read (file) { return fs.readFileSync(file, 'utf8'); }

// Returns { threw, message, result }. Never let a throw escape: the point of most cases is
// WHAT it refused with, not that it refused.
function attempt (fn) {
  try { return { threw: false, result: fn() }; } catch (e) { return { threw: true, message: e.message || String(e), error: e }; }
}

// ---------------------------------------------------------------- the happy path

{
  const f = fixture('a.js', 'const x = 1;' + LF + 'const y = 2;' + LF);
  const r = P.patch({ file: f, anchor: 'const y = 2;', replacement: 'const y = 3;' });
  ok('a matching anchor is replaced and the file is written', read(f).indexOf('const y = 3;') !== -1);
  ok('a matching anchor leaves the rest of the file alone', read(f).indexOf('const x = 1;') !== -1);
  ok('the report says it was written', r.written === true);
  ok('the report names the file it wrote', r.file === f);
  ok('the report carries the before and after sizes', r.bytes.before === 26 && r.bytes.after === 26);
}

// ---------------------------------------------------------------- control 3, the count

{
  const before = 'alpha' + LF + 'beta' + LF;
  const f = fixture('b.txt', before);
  const a = attempt(() => P.patch({ file: f, anchor: 'gamma-that-is-not-there', replacement: 'x' }));
  ok('an anchor matching zero times refuses', a.threw);
  ok('a zero-match refusal says how many times it matched', /matched 0 time/.test(a.message));
  ok('a zero-match refusal says what it expected', /expected exactly 1/.test(a.message));
  ok('a REFUSED patch leaves the file byte-identical', read(f) === before);
}

{
  const before = 'dup' + LF + 'dup' + LF;
  const f = fixture('c.txt', before);
  const a = attempt(() => P.patch({ file: f, anchor: 'dup', replacement: 'x' }));
  ok('an anchor matching twice with expect 1 refuses', a.threw && /matched 2 time/.test(a.message));
  ok('a two-match refusal writes nothing', read(f) === before);
}

{
  const f = fixture('d.txt', 'dup' + LF + 'dup' + LF);
  P.patch({ file: f, anchor: 'dup', replacement: 'x', expect: 2 });
  ok('expect 2 replaces both occurrences', read(f) === 'x' + LF + 'x' + LF);
}

{
  const before = 'dup' + LF + 'dup' + LF + 'dup' + LF;
  const f = fixture('e.txt', before);
  const a = attempt(() => P.patch({ file: f, anchor: 'dup', replacement: 'x', expect: 2 }));
  ok('expect 2 against three matches refuses rather than doing two of them', a.threw);
  ok('expect 2 against three matches writes nothing', read(f) === before);
}

// ---------------------------------------------------------------- ST-079 itself

{
  // The file holds the SOURCE TEXT backslash-n inside a string literal, which is what every
  // real target of this defect looked like.
  const before = 'const NL = ' + "'" + BS + 'n' + "'" + ';' + LF;
  const f = fixture('f.js', before);
  // The anchor a collapsing heredoc delivers: a REAL line feed where the file has two characters.
  const mangled = 'const NL = ' + "'" + LF + "'" + ';';
  const a = attempt(() => P.patch({ file: f, anchor: mangled, replacement: 'const NL = "x";' }));
  ok('a collapsed escape refuses instead of writing', a.threw);
  ok('a collapsed escape is NAMED as an escape collapse', /ESCAPE COLLAPSE/.test(a.message));
  ok('a collapsed escape cites the ticket so the reader can find the history', /ST-079/.test(a.message));
  ok('a collapsed escape names the character that was SENT', /LINE FEED/.test(a.message));
  ok('a collapsed escape names the character the file HOLDS', /BACKSLASH/.test(a.message));
  ok('a collapsed escape tells the caller what to do instead', /fromCharCode\(92\)/.test(a.message));
  ok('a collapsed escape leaves the file byte-identical', read(f) === before);
}

{
  // The same defect one layer along: the anchor is close but diverges on an ordinary character,
  // which must NOT be reported as an escape collapse. A diagnosis that fires for everything
  // tells the reader nothing.
  const f = fixture('g.txt', 'the quick brown fox jumps' + LF);
  const a = attempt(() => P.patch({ file: f, anchor: 'the quick brown cat jumps', replacement: 'x' }));
  ok('an ordinary near miss refuses', a.threw);
  ok('an ordinary near miss is NOT called an escape collapse', !/ESCAPE COLLAPSE/.test(a.message));
  ok('an ordinary near miss still names the divergence point', /first difference at column/.test(a.message));
}

{
  const f = fixture('h.txt', 'nothing in here resembles it at all' + LF);
  const a = attempt(() => P.patch({ file: f, anchor: 'ZZZZZZZZZZZZZZZZ', replacement: 'x' }));
  ok('an anchor with no overlap says so rather than pointing at an unrelated line', /NO SIMILAR TEXT/.test(a.message));
}

{
  // The diagnosis must survive the anchor being multi-line, which is the ordinary case for a
  // real patch and the case where splitting on newlines used to lose the fault.
  const content = 'function f () {' + LF + '  return ' + "'" + BS + 't' + "'" + ';' + LF + '}' + LF;
  const d = P.diagnoseMiss(content, 'function f () {' + LF + '  return ' + "'" + String.fromCharCode(9) + "'" + ';');
  ok('a multi-line anchor still reaches the collapsed character', d.verdict === 'ESCAPE COLLAPSE (ST-079)');
  ok('a multi-line anchor reports the line the divergence is on, not line 1', d.line === 2);
}

// ---------------------------------------------------------------- control 2, the replacement

{
  const before = 'keep me' + LF;
  const f = fixture('i.txt', before);
  const a = attempt(() => P.patch({ file: f, anchor: 'keep me', replacement: 'bad' + NUL + 'value' }));
  ok('a replacement carrying a NUL refuses', a.threw && /refused/.test(a.message));
  ok('a refused replacement names the character by code point', /U\+0000/.test(a.message));
  ok('a refused replacement writes nothing', read(f) === before);
}

{
  const f = fixture('j.txt', 'keep me' + LF);
  const a = attempt(() => P.patch({ file: f, anchor: 'keep me', replacement: 'half' + CR + 'ending' }));
  ok('a replacement carrying a lone CARRIAGE RETURN refuses', a.threw && /CARRIAGE RETURN/.test(a.message));
}

{
  const f = fixture('k.txt', 'one' + LF);
  P.patch({ file: f, anchor: 'one', replacement: 'two' + LF + String.fromCharCode(9) + 'three' });
  ok('a replacement carrying LINE FEED and TAB is allowed through', read(f).indexOf('two' + LF) === 0);
}

// ---------------------------------------------------------------- control 4, the parse

{
  const before = 'const s = "ok";' + LF;
  const f = fixture('l.js', before);
  const a = attempt(() => P.patch({ file: f, anchor: '"ok"', replacement: '"unterminated' }));
  ok('a patch that would break a JS file refuses', a.threw && /does not parse/.test(a.message));
  ok('a patch that would break a JS file writes NOTHING, so the program still runs', read(f) === before);
}

{
  const before = '{ "a": 1 }' + LF;
  const f = fixture('m.json', before);
  const a = attempt(() => P.patch({ file: f, anchor: '"a": 1', replacement: '"a": }{' }));
  ok('a patch that would break a JSON file refuses', a.threw && /does not parse/.test(a.message));
  ok('a broken JSON patch writes nothing', read(f) === before);
}

{
  const f = fixture('n.md', 'a heading' + LF);
  const r = P.patch({ file: f, anchor: 'a heading', replacement: 'another heading' });
  ok('a prose file is patched without a parse check', r.parseChecked === false);
  ok('a prose file SAYS the parse check did not run rather than implying it did', /no parser for \.md/.test(r.parseReason));
}

// ---------------------------------------------------------------- all or nothing

{
  const before = 'first' + LF + 'second' + LF;
  const f = fixture('o.txt', before);
  const a = attempt(() => P.patchFile({
    file: f,
    edits: [
      { anchor: 'first', replacement: 'FIRST' },
      { anchor: 'this anchor is not in the file', replacement: 'x' },
    ],
  }));
  ok('a multi-edit patch refuses when any one edit fails', a.threw);
  ok('a failing second edit does not leave the first one written', read(f) === before);
  ok('a multi-edit refusal names WHICH edit failed', /edit 2 of 2/.test(a.message));
}

{
  const f = fixture('p.txt', 'first' + LF + 'second' + LF);
  P.patchFile({ file: f, edits: [
    { anchor: 'first', replacement: 'FIRST' },
    { anchor: 'second', replacement: 'SECOND' },
  ] });
  ok('a multi-edit patch applies every edit when all of them match', read(f) === 'FIRST' + LF + 'SECOND' + LF);
}

// ---------------------------------------------------------------- the quiet failures

{
  const before = 'unchanged' + LF;
  const f = fixture('q.txt', before);
  const a = attempt(() => P.patch({ file: f, anchor: 'unchanged', replacement: 'unchanged' }));
  ok('a patch whose replacement equals its anchor refuses rather than reporting success', a.threw);
  ok('a no-op patch says what it almost certainly is', /does nothing/.test(a.message));
}

{
  const f = fixture('r.txt', 'anything' + LF);
  const a = attempt(() => P.patch({ file: f, anchor: '', replacement: 'x' }));
  ok('an empty anchor refuses', a.threw && /matches everywhere/.test(a.message));
}

{
  const a = attempt(() => P.patch({ file: path.join(os.tmpdir(), 'no-such-file-' + process.pid + '.txt'), anchor: 'x', replacement: 'y' }));
  ok('a missing target refuses by name rather than throwing a raw ENOENT', a.threw && /target does not exist/.test(a.message));
}

{
  // A dollar sign in the replacement is ORDINARY TEXT. String.replace would read $& as the
  // whole match and silently double it, which is the escape-collapse class one layer up.
  const f = fixture('s.txt', 'price here' + LF);
  P.patch({ file: f, anchor: 'price here', replacement: 'cost $& and $1 and $$' });
  ok('a dollar sign in the replacement is written literally', read(f) === 'cost $& and $1 and $$' + LF);
}

{
  const before = 'preview me' + LF;
  const f = fixture('t.txt', before);
  const r = P.patch({ file: f, anchor: 'preview me', replacement: 'changed', dryRun: true });
  ok('a dry run reports that it did not write', r.written === false && r.dryRun === true);
  ok('a dry run leaves the file byte-identical', read(f) === before);
  ok('a dry run still reports the size it would have produced', r.bytes.after === 8);
}

{
  // The dry run must run every control, or it is a preview of something else.
  const f = fixture('u.js', 'const s = "ok";' + LF);
  const a = attempt(() => P.patch({ file: f, anchor: '"ok"', replacement: '"unterminated', dryRun: true }));
  ok('a dry run refuses a patch that would not parse, rather than previewing it as fine', a.threw && /does not parse/.test(a.message));
}

{
  // Called directly, because control 1 refuses an empty anchor before patchFile can ever reach
  // this function, so no end-to-end case can exercise it. That is exactly why the fault lived
  // here: an empty needle made indexOf advance by zero and the loop never ended. A function that
  // hangs only when its caller is wrong will hang the day it gets a second caller.
  ok('counting occurrences of an empty needle returns 0 rather than looping forever', P.countOccurrences('abc', '') === 0);
  ok('counting occurrences still counts a real needle', P.countOccurrences('abcabc', 'abc') === 2);
  ok('counting occurrences does not overlap a needle with itself', P.countOccurrences('aaaa', 'aa') === 2);
}

{
  const dir = path.dirname(fixture('v.txt', 'x'));
  const f = path.join(dir, 'v.txt');
  P.patch({ file: f, anchor: 'x', replacement: 'y' });
  const leftovers = fs.readdirSync(dir).filter((e) => e.indexOf('.patch-') !== -1);
  ok('an atomic write leaves no temp file behind', leftovers.length === 0);
}

// ---------------------------------------------------------------- the CLI

function cli (args) {
  try {
    const out = execFileSync('node', [TOOL].concat(args), { stdio: ['pipe', 'pipe', 'pipe'] }).toString();
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: ((e.stdout || '') + (e.stderr || '')).toString() };
  }
}

{
  const f = fixture('w.txt', 'from the cli' + LF);
  const dir = path.dirname(f);
  const af = path.join(dir, 'anchor.txt');
  const rf = path.join(dir, 'replacement.txt');
  fs.writeFileSync(af, 'from the cli', 'utf8');
  fs.writeFileSync(rf, 'through a file', 'utf8');
  const r = cli(['--file', f, '--anchor-file', af, '--replacement-file', rf]);
  ok('the CLI patches from an anchor file', r.code === 0 && read(f).indexOf('through a file') !== -1);
}

{
  const f = fixture('x.txt', 'cli miss' + LF);
  const dir = path.dirname(f);
  const af = path.join(dir, 'anchor.txt');
  fs.writeFileSync(af, 'not present anywhere', 'utf8');
  const r = cli(['--file', f, '--anchor-file', af]);
  ok('the CLI exits non-zero when a patch is refused', r.code === 1);
  ok('the CLI says nothing was written for a refused target', /Nothing was written/.test(r.out));
  ok('a CLI refusal leaves the file byte-identical', read(f) === 'cli miss' + LF);
}

{
  const r = cli([]);
  ok('the CLI with no arguments prints usage and exits 2', r.code === 2 && /usage: patch\.js/.test(r.out));
  ok('the usage says WHY the anchor comes from a file', /defect this tool exists for/.test(r.out));
}

{
  const f = fixture('y.txt', 'spec driven' + LF);
  const dir = path.dirname(f);
  const sp = path.join(dir, 'spec.json');
  fs.writeFileSync(sp, JSON.stringify({ file: f, edits: [{ anchor: 'spec driven', replacement: 'spec applied' }] }), 'utf8');
  const r = cli(['--spec', sp]);
  ok('the CLI applies a spec file', r.code === 0 && read(f).indexOf('spec applied') !== -1);
}

{
  const f = fixture('z.txt', 'dry from cli' + LF);
  const dir = path.dirname(f);
  const sp = path.join(dir, 'spec.json');
  fs.writeFileSync(sp, JSON.stringify({ file: f, edits: [{ anchor: 'dry from cli', replacement: 'changed' }] }), 'utf8');
  const r = cli(['--spec', sp, '--dry-run']);
  ok('the CLI honours --dry-run', r.code === 0 && read(f) === 'dry from cli' + LF);
  ok('the CLI says a dry run was a dry run', /DRY RUN/.test(r.out));
}


// The total is PINNED and written down rather than measured from the run it checks, because a
// self-updating total agrees with any run. Measured elsewhere in this repository: a fatal guard
// firing part way through a suite reported 0 failed and exit 0 having run 22 of 214, so a count
// of failures cannot see an assertion that never ran. Mutation: delete a block above and this
// goes red alone.
const EXPECTED_ASSERTIONS = 64;
if (pass + fail !== EXPECTED_ASSERTIONS) {
  console.log('FAIL  the suite ran ' + (pass + fail) + ' assertion(s) and expects ' + EXPECTED_ASSERTIONS + '. A block was skipped or deleted. Find out which before you change the number.');
  fail++;
}

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
