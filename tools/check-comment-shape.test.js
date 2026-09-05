#!/usr/bin/env node
'use strict';
/*
 * Tests for check-comment-shape.js. Every assertion here has been watched failing by breaking
 * the tool, and the mutation that turns each group red is written beside the group. A check
 * nobody has seen fail is indistinguishable from one that always passes.
 *
 * The fixtures are written to the temp directory and read back through the tool exactly as a
 * release would read a real tree: the same walk, the same baseline file, the same exit codes.
 * The unit-level checks call the exported functions directly, because a classifier is proved
 * on lines and a ratchet is proved on files, and mixing the two hides which one broke.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TOOL = path.join(__dirname, 'check-comment-shape.js');
const T = require(TOOL);
let pass = 0, fail = 0;
function ok (name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL  ' + name); } }

function run (args, cwd) {
  try {
    const out = execFileSync('node', [TOOL].concat(args), { stdio: ['pipe', 'pipe', 'pipe'], cwd: cwd || __dirname }).toString();
    return { code: 0, out: out };
  } catch (e) {
    return { code: e.status, out: ((e.stdout || '') + (e.stderr || '')).toString() };
  }
}

let n = 0;
const MANIFEST = [
  '$PUBLIC_MANIFEST = @(',
  "    @{ from = 'site.js';    to = 'site.js' },",
  '    # a comment holding a ) paren, a $variable and a += inside the literal',
  "    @{ from = 'base\\board'; to = 'board' },",
  "    @{ from = 'base\\infra'; to = 'infrastructure' }",
  ')'
].join('\n') + '\n';
function fixture (opts) {
  opts = opts || {};
  // A process id is reused by the operating system, and these directories are never removed:
  // 693 of them had accumulated when a reused id landed on one holding a baseline, and three
  // assertions then passed or failed for a reason that had nothing to do with the code.
  const root = path.join(os.tmpdir(), 'studio-comment-shape-' + process.pid + '-' + Date.now().toString(36) + '-' + (n++));
  if (fs.existsSync(root)) throw new Error('fixture path already exists: ' + root);
  fs.mkdirSync(path.join(root, 'base', 'agents'), { recursive: true });
  fs.mkdirSync(path.join(root, 'base', 'board'), { recursive: true });
  fs.mkdirSync(path.join(root, 'tools'), { recursive: true });
  ['qa-tester', 'tech-lead', 'pm'].forEach(function (r) {
    fs.writeFileSync(path.join(root, 'base', 'agents', r + '.md'), '---\nname: ' + r + '\n---\n');
  });
  fs.writeFileSync(path.join(root, 'studio.ps1'),
    "# a fixture program\n$PUBLISHED_TREES = @('base\\board', 'tools')\n" + (opts.manifest ? MANIFEST : '') + "Write-Host 'x'\n");
  return root;
}
function put (root, rel, text) {
  const f = path.join(root, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, text);
  return f;
}
function baselineOf (root) { return path.join(root, 'tools', 'comment-shape-baseline.json'); }
function readBaseline (root) { return JSON.parse(fs.readFileSync(baselineOf(root), 'utf8')); }
function writeBaselineJson (root, b) { fs.writeFileSync(baselineOf(root), JSON.stringify(b, null, 2) + '\n'); }
function lines (arr) { return arr.join('\n') + '\n'; }
function realRoster () {
  const dirs = [path.join(__dirname, '..', 'base', 'agents'), path.join(__dirname, '..', 'agents')];
  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    const names = fs.readdirSync(d).filter(function (f) { return /\.md$/.test(f); }).map(function (f) { return f.replace(/\.md$/, ''); });
    if (names.length) return names;
  }
  return ['qa-tester', 'tech-lead', 'pm', 'design-lead'];
}

const CLEAN_JS = lines([
  '#!/usr/bin/env node',
  '/**', ' * x.js -- a header that describes the file to a stranger.', ' */',
  "'use strict';",
  'var a = 1;',
  '// Why this is here: the value must never be zero, because a zero divides nothing.',
  'var b = a / 1;',
  'var c = b; // trailing note',
  'module.exports = c;'
]);

// --- the classifier, line by line ---------------------------------------------------------
// Mutation that turns this group red: make classify treat a shebang as code, or drop the
// block-comment state so a line inside a slash-star block reads as code.
{
  const k = T.classify(CLEAN_JS, 'c').map(function (l) { return l.kind; });
  ok('a shebang is neither code nor comment', k[0] === 'shebang');
  ok('a block comment opener is a comment line', k[1] === 'comment');
  ok('a line inside a block comment is a comment line', k[2] === 'comment');
  ok('the block closer is a comment line', k[3] === 'comment');
  ok("'use strict' is a directive, neither code nor comment", k[4] === 'directive');
  ok('a code line is code', k[5] === 'code');
  ok('a line-comment line is a comment', k[6] === 'comment');
  ok('a trailing comment leaves the line as code', k[8] === 'code');
  const single = T.classify('/* one line */\nvar x;\n', 'c').map(function (l) { return l.kind; });
  ok('a block that opens and closes on one line does not swallow the next', single[1] === 'code');
  const ps = T.classify('<#\nblock\n#>\n# line\nparam()\n', 'ps').map(function (l) { return l.kind; });
  ok('a PowerShell block comment is read', ps[0] === 'comment' && ps[1] === 'comment' && ps[2] === 'comment');
  ok('a PowerShell hash line is a comment and param() is code', ps[3] === 'comment' && ps[4] === 'code');
  const sql = T.classify('-- note\nselect 1;\n', 'sql').map(function (l) { return l.kind; });
  ok('a SQL double-dash line is a comment', sql[0] === 'comment' && sql[1] === 'code');
  const bom = T.classify('﻿// first\nvar y;\n', 'c').map(function (l) { return l.kind; });
  ok('a byte order mark does not hide the first comment', bom[0] === 'comment');
}

// --- what is a control, what is named ------------------------------------------------------
// Mutation that turns this group red: delete any one alternative from the control or named
// patterns, or drop the encoding exclusion from the ticket pattern. Each alternative named in
// the tool header has its own line here, so removing one turns exactly one line red.
{
  ok('an S-number makes a control', T.isControl('// S61 says a check states its blind spot'));
  ok('a number with a unit makes a control', T.isControl('// deleted 3 files and the suite passed'));
  ok('a word number with a unit makes a control', T.isControl('// thirteen of sixteen roles never registered'));
  ok('the word measured makes a control', T.isControl('// measured before this was written'));
  ok('a mutation makes a control', T.isControl('// a mutation left this green'));
  ok('a suite staying green makes a control', T.isControl('// deleting the guard stayed green'));
  ok('a check proved both ways makes a control', T.isControl('// proved both ways before it shipped'));
  ok('a check that fails alone makes a control', T.isControl('// this cannot fail alone, and says so'));
  ok('a plain why sentence is not a control', !T.isControl('// the walk stops at a repository boundary because a parent may own a board'));
  const roles = T.roleRegex(['qa-tester', 'tech-lead', 'pm']);
  ok('a ticket reference is named', T.namedBy('// fixed on ST-065 at the gate', roles).indexOf('ticket') !== -1);
  ok('a ticket reference with a three-letter prefix is named', T.namedBy('// see TCE-12', roles).indexOf('ticket') !== -1);
  ok('UTF-8 is not a ticket', T.namedBy('// written as UTF-8 without a mark', roles).length === 0);
  ok('a licence version is not a ticket', T.namedBy('// released under AGPL-3.0', roles).length === 0);
  ok('a roster role is named', T.namedBy('// qa-tester found this', roles).indexOf('role') !== -1);
  ok('a role written with a space is named', T.namedBy('// the tech lead objected', roles).indexOf('role') !== -1);
  ok('a role in capitals is named', T.namedBy('// no PM was loaded', roles).indexOf('role') !== -1);
  ok('a name not on the roster is not named', T.namedBy('// the founder decides', roles).length === 0);
  ok('round two is named', T.namedBy('// round two widened the bound', roles).indexOf('round') !== -1);
  ok('third round is named', T.namedBy('// found at the third round', roles).indexOf('round') !== -1);
  ok('gate round is named', T.namedBy('// this cost a gate round', roles).indexOf('round') !== -1);
  ok('a plain why sentence names nothing', T.namedBy('// the value must never be zero', roles).length === 0);
  ok('with no roster, a role name is not named', T.namedBy('// qa-tester found this', null).length === 0);
}

// --- measuring one file: header, controls, named, ratio ------------------------------------
// Mutation that turns this group red: count header lines as counted comment, count a control
// line as named, or compute the ratio over comment lines rather than counted lines.
{
  const roles = T.roleRegex(['qa-tester']);
  const text = lines([
    '// header line one, before any code',
    '// header line two names qa-tester and ST-001 and is still header',
    'var a = 1;',
    '// plain why comment',
    '// qa-tester found this at the gate',
    '// qa-tester deleted it and the suite stayed green at 40',
    '// S12 is the standing rule',
    'var b = 2;',
    'var c = 3;',
    '',
    'var d = 4;'
  ]);
  const m = T.measureText(text, 'c', roles);
  ok('non-blank lines are counted', m.nonblank === 10);
  ok('comment lines are counted', m.comment === 6);
  ok('header lines are the comment lines before the first code line', m.header === 2);
  ok('control lines are counted outside the header', m.controls === 2);
  ok('a named line outside the header and not a control is named', m.named === 1);
  ok('a named line inside a control is reported separately', m.named_in_controls === 1);
  ok('the counted ratio excludes header and control lines', m.ratio === 20);
  ok('the all-comment ratio is also reported', m.ratio_all === 60);
  ok('the named line is reported with its line number', m.lines.some(function (l) { return l.line === 5 && !l.control; }));
  const all = T.measureText('// only\n// comments\n', 'c', roles);
  ok('a file with no code is all header', all.header === 2 && all.ratio === 0);
}

// --- reading what publishes out of the program ---------------------------------------------
// Mutation that turns this group red: count the first assignment only, stop refusing a
// literal that carries a variable, or drop the manifest read.
{
  const root = fixture();
  const p = T.readPublishedPaths(root);
  ok('the tree list is read from the literal, and the program itself is included',
    JSON.stringify(p.entries.map(function (e) { return e.from; })) === JSON.stringify(['base\\board', 'tools', 'studio.ps1']));
  ok('a program with no manifest says so', p.hasManifest === false && p.manifest === 0);
  const withManifest = T.readPublishedPaths(fixture({ manifest: true }));
  ok('manifest entries are read with their exported names', withManifest.manifest === 3
    && withManifest.entries.some(function (e) { return e.from === 'site.js' && e.to === 'site.js'; })
    && withManifest.entries.some(function (e) { return e.from === 'base\\board' && e.to === 'board'; }));
  ok('a paren, a variable or an operator inside a comment in the literal is not refused', withManifest.hasManifest === true);
  function throwsWith (program) {
    put(root, 'studio.ps1', program);
    try { T.readPublishedPaths(root); return ''; } catch (e) { return e.message; }
  }
  ok('two assignments are refused', /2 assignments/.test(throwsWith("$PUBLISHED_TREES = @('a')\n$PUBLISHED_TREES = @('b')\n")));
  ok('an append is refused and named as one', /appended/.test(throwsWith("$PUBLISHED_TREES = @('a')\n$PUBLISHED_TREES += 'b'\n")));
  ok('a second assignment from a variable is refused', /2 assignments/.test(throwsWith("$PUBLISHED_TREES = @('a')\n$PUBLISHED_TREES = $X\n")));
  ok('a literal carrying a variable is refused', /variable|operator/.test(throwsWith("$X = @('c')\n$PUBLISHED_TREES = @('a', $X)\n")));
  ok('an operator after the literal is refused', /variable|operator/.test(throwsWith("$X = @('c')\n$PUBLISHED_TREES = @('a') + $X\n")));
  ok('an appended manifest is refused', /appended/.test(throwsWith("$PUBLISHED_TREES = @('a')\n$PUBLIC_MANIFEST = @(@{ from = 'a'; to = 'a' })\n$PUBLIC_MANIFEST += @{ from = 'b'; to = 'b' }\n")));
  ok('a literal that never closes is refused', /never closes/.test(throwsWith("$PUBLISHED_TREES = @('a', 'b'\n")));
}

// --- the check, the baseline and the ratchet, through the command line --------------------
// Mutation that turns this group red: let compareFile pass a move in either direction, or let
// writeBaseline write when a value moved the wrong way.
{
  const root = fixture();
  put(root, 'base/board/x.js', CLEAN_JS);
  put(root, 'tools/y.ps1', lines(['# header', 'param()', '# qa-tester found this at the gate', '# S3 holds it', 'Write-Host 1']));

  let r = run(['--root', root]);
  ok('with no baseline the check refuses', r.code === 1 && /no baseline/.test(r.out));

  r = run(['--root', root, '--report']);
  ok('--report needs no baseline and prints a total', r.code === 0 && /TOTAL 3 files/.test(r.out));
  r = run(['--root', root, '--list']);
  ok('--list prints the named line with its file and line', r.code === 0 && /named tools\/y\.ps1:3/.test(r.out));

  r = run(['--root', root, '--write-baseline']);
  ok('the first write records what is there', r.code === 0 && fs.existsSync(baselineOf(root)));
  const b = readBaseline(root);
  ok('the baseline holds the named count per file', b.files['tools/y.ps1'].named === 1 && b.files['base/board/x.js'].named === 0);
  ok('the baseline holds the control count per file', b.files['tools/y.ps1'].controls === 1);
  ok('the baseline holds the counted ratio per file', b.files['base/board/x.js'].ratio === 10);
  ok('the baseline starts with no overrides', Array.isArray(b.overrides) && b.overrides.length === 0);

  r = run(['--root', root]);
  ok('an unchanged tree passes', r.code === 0);
  r = run(['--root', root, '--quiet']);
  ok('--quiet prints no ok line for a clean file', r.code === 0 && !/^ok\s+base/m.test(r.out));

  const y = path.join(root, 'tools', 'y.ps1');
  const yText = fs.readFileSync(y, 'utf8');
  fs.writeFileSync(y, yText + '# tech-lead objected on ST-099\n');
  r = run(['--root', root]);
  ok('a named line added is refused', r.code === 1 && /named lines rose from 1 to 2/.test(r.out));
  r = run(['--root', root, '--write-baseline']);
  ok('the baseline refuses to record the rise', r.code === 1 && /nothing written/.test(r.out));
  ok('and the baseline file is unchanged', fs.readFileSync(baselineOf(root), 'utf8') === JSON.stringify(b, null, 2) + '\n');
  r = run(['--root', root, '--write-baseline', '--allow-rise', 'the founder ruled it on the ticket']);
  ok('a rise with a reason is recorded', r.code === 0 && /2 rise\(s\) recorded/.test(r.out));
  const b2 = readBaseline(root);
  ok('the reason is kept in the baseline', b2.overrides.length === 2 && b2.overrides.every(function (o) { return o.reason === 'the founder ruled it on the ticket'; }) && b2.overrides.some(function (o) { return o.field === 'named' && o.to === 2; }));
  fs.writeFileSync(y, yText);
  r = run(['--root', root]);
  ok('a named line removed is refused until recorded', r.code === 1 && /named lines fell from 2 to 1/.test(r.out) && /--write-baseline/.test(r.out));
  r = run(['--root', root, '--write-baseline']);
  ok('recording the fall needs no reason', r.code === 0);

  const x = path.join(root, 'base', 'board', 'x.js');
  const xText = fs.readFileSync(x, 'utf8');
  fs.writeFileSync(x, xText + '// one more why line\n// and another\n// and a third\n');
  r = run(['--root', root]);
  ok('a counted ratio rising is refused', r.code === 1 && /ratio rose/.test(r.out));
  r = run(['--root', root, '--write-baseline']);
  ok('the baseline refuses to record a ratio rise', r.code === 1 && /ratio would move the wrong way/.test(r.out));
  fs.writeFileSync(x, xText.replace('// Why this is here: the value must never be zero, because a zero divides nothing.\n', ''));
  r = run(['--root', root]);
  ok('a counted ratio falling is refused until recorded', r.code === 1 && /ratio fell from 10 to 0/.test(r.out) && /--write-baseline/.test(r.out));
  fs.writeFileSync(x, xText + '// one more line, and it cites S9 so it is a control\n');
  r = run(['--root', root]);
  ok('a control line added moves controls, not the counted ratio, and is refused until recorded', r.code === 1 && /control lines rose from 0 to 1/.test(r.out) && !/ratio rose/.test(r.out));
  fs.writeFileSync(x, xText);

  fs.writeFileSync(y, yText.replace('# S3 holds it\n', ''));
  r = run(['--root', root]);
  ok('a control line deleted is refused', r.code === 1 && /control lines fell/.test(r.out));
  r = run(['--root', root, '--write-baseline']);
  ok('the baseline refuses to record a control fall', r.code === 1 && /controls would move the wrong way/.test(r.out));
  fs.writeFileSync(y, yText);

  const tight = readBaseline(root);
  const loose = JSON.parse(JSON.stringify(tight));
  loose.files['base/board/x.js'].ratio = 60;
  writeBaselineJson(root, loose);
  r = run(['--root', root]);
  ok('a ratio raised by hand in the baseline is refused as slack', r.code === 1 && /ratio fell from 60 to 10/.test(r.out));
  const loose2 = JSON.parse(JSON.stringify(tight));
  loose2.files['tools/y.ps1'].controls = 0;
  writeBaselineJson(root, loose2);
  r = run(['--root', root]);
  ok('a control floor lowered by hand in the baseline is refused as slack', r.code === 1 && /control lines rose from 0 to 1/.test(r.out));
  const loose3 = JSON.parse(JSON.stringify(tight));
  loose3.files['tools/y.ps1'].named = 5;
  writeBaselineJson(root, loose3);
  r = run(['--root', root]);
  ok('a named count raised by hand in the baseline is refused as slack', r.code === 1 && /named lines fell from 5 to 1/.test(r.out));
  writeBaselineJson(root, tight);
  ok('and the tight baseline passes again', run(['--root', root]).code === 0);

  put(root, 'tools/z.js', lines(['// header', 'var a;', '// why one', '// why two', 'var b;', 'var c;']));
  r = run(['--root', root]);
  ok('a new file over the cap is refused', r.code === 1 && /new file at 33.3 per cent/.test(r.out));
  put(root, 'tools/z.js', lines(['// header', 'var a;', '// tech-lead said so', 'var b;']));
  r = run(['--root', root]);
  ok('a new file with a named line is refused', r.code === 1 && /new file with 1 named/.test(r.out));
  put(root, 'tools/z.js', lines(['// header', '// still header', 'var a;', 'var b;']));
  r = run(['--root', root]);
  ok('a new file within the cap passes with a note to record it', r.code === 0 && /not yet in the baseline/.test(r.out));
  fs.unlinkSync(path.join(root, 'tools', 'z.js'));

  put(root, 'tools/.hidden/h.js', lines(['var a;', '// qa-tester wrote this on ST-500']));
  r = run(['--root', root, '--list']);
  ok('a directory whose name begins with a dot is not read', r.code === 0 && !/hidden/.test(r.out));

  fs.unlinkSync(path.join(root, 'base', 'board', 'x.js'));
  r = run(['--root', root]);
  ok('a file gone from disk is noted and not refused', r.code === 0 && /not on disk/.test(r.out));
}

// --- a file the manifest publishes outside every tree --------------------------------------
// Mutation that turns this group red: drop the manifest entries from the paths read.
{
  const root = fixture({ manifest: true });
  put(root, 'site.js', lines(['// header', 'var a;', '// pm asked for this on ST-321']));
  const r = run(['--root', root, '--list']);
  ok('a single file published by the manifest is read', r.code === 0 && /named site\.js:3/.test(r.out));
  ok('and the report says how many manifest entries it read', /3 entr\(ies\) read from PUBLIC_MANIFEST/.test(run(['--root', root, '--report']).out));
}

// --- the export layout, an absent roster, and the error exits ------------------------------
// Mutation that turns this group red: drop the base-prefix fallback or the exported-name
// fallback in resolveEntry, or print ok for a missing roster instead of n/a.
{
  const root = fixture();
  fs.rmSync(path.join(root, 'base'), { recursive: true });
  fs.mkdirSync(path.join(root, 'board'), { recursive: true });
  put(root, 'board/x.js', CLEAN_JS);
  let r = run(['--root', root, '--report']);
  ok('a tree absent under base is read under its name without the prefix', /board\/x\.js/.test(r.out));
  ok('a missing roster is reported as not proved rather than as clean', run(['--root', root, '--write-baseline']).code === 0 && /NOT PROVED/.test(run(['--root', root]).out));

  const exported = fixture({ manifest: true });
  fs.rmSync(path.join(exported, 'base'), { recursive: true });
  put(exported, 'infrastructure/x.js', CLEAN_JS);
  ok('a manifest entry absent under its source name is read under its exported name', /infrastructure\/x\.js/.test(run(['--root', exported, '--report']).out));

  const bare = path.join(os.tmpdir(), 'studio-comment-shape-bare-' + process.pid);
  fs.mkdirSync(bare, { recursive: true });
  r = run(['--root', bare, '--report']);
  ok('no program and no --tree is a usage error, exit 2', r.code === 2 && /no studio\.ps1/.test(r.out));
  put(bare, 'src/a.js', CLEAN_JS);
  r = run(['--root', bare, '--tree', 'src', '--report']);
  ok('--tree measures without the program', r.code === 0 && /src\/a\.js/.test(r.out));
  r = run(['--bogus']);
  ok('an unknown argument is exit 2', r.code === 2 && /usage/.test(r.out));
  r = run(['--root', bare, '--tree', 'src', '--write-baseline', '--allow-rise', '--quiet']);
  ok('a switch is not accepted as the reason for a rise', r.code === 2 && /needs a value/.test(r.out));
  r = run(['--root']);
  ok('a switch with no value is exit 2', r.code === 2 && /needs a value/.test(r.out));
}

// --- the tool holds itself to its own rule --------------------------------------------------
// Mutation that turns this red: add a comment naming a ticket below the header of the tool.
{
  const names = realRoster();
  const roles = T.roleRegex(names);
  ok('the self-check uses the real roster when it can find one', names.length >= 4);
  const self = T.measureText(fs.readFileSync(TOOL, 'utf8'), 'c', roles);
  ok('the instrument names no ticket, role or round below its own header', self.named === 0 && self.named_in_controls === 0);
  ok('the instrument is within the cap it holds new files to', self.ratio <= T.NEW_FILE_CAP);
  const selfTest = T.measureText(fs.readFileSync(__filename, 'utf8'), 'c', roles);
  ok('and so is this suite', selfTest.ratio <= T.NEW_FILE_CAP && selfTest.named === 0);
}

// --- the record is held against a MISSING value, not only against a different one -------------
// Measured: a record with the key deleted passed every comparison, and --write-baseline then
// re-recorded the higher value with no rise reported. Mutation: drop the required-key loop.
{
  const root = fixture();
  put(root, 'base/board/x.js', CLEAN_JS);
  run(['--root', root, '--write-baseline']);
  const good = readBaseline(root);
  const rel = Object.keys(good.files)[0];

  const missing = JSON.parse(JSON.stringify(good));
  delete missing.files[rel].named;
  writeBaselineJson(root, missing);
  let r = run(['--root', root]);
  ok('a record with a deleted value is refused rather than passing',
    r.code === 1 && /no numeric named/.test(r.out));

  const wrong = JSON.parse(JSON.stringify(good));
  wrong.files[rel].ratio = 'plenty';
  writeBaselineJson(root, wrong);
  r = run(['--root', root]);
  ok('a record whose value is not a number is refused too',
    r.code === 1 && /no numeric ratio/.test(r.out));

  writeBaselineJson(root, good);
  r = run(['--root', root]);
  ok('and the restored record passes, so the refusal is about the record and not the file',
    r.code === 0);

  // Measured: the reading half refused and the writing half did not, so --write-baseline
  // re-recorded over a hollow record with no rise reported. Mutation C turns both red.
  const hollow = JSON.parse(JSON.stringify(good));
  delete hollow.files[rel].ratio;
  writeBaselineJson(root, hollow);
  ok('--write-baseline refuses a hollow record rather than re-recording over it',
    run(['--root', root, '--write-baseline']).code === 1);
  ok('and --allow-rise does not waive it, because a hollow record is not a deliberate rise',
    run(['--root', root, '--write-baseline', '--allow-rise', 'stated']).code === 1);
  writeBaselineJson(root, good);
}

// --- a published path the scanner cannot find refuses, and says so under --quiet ---------------
// Measured: this printed only when NOT quiet, and the gate runs quiet. Mutation: put the quiet
// test back and both go red. It reports rather than refusing because a staged partial tree
// legitimately names paths it does not carry, which turned nine assertions red when tried.
{
  const root = fixture();
  put(root, 'base/board/x.js', CLEAN_JS);
  fs.writeFileSync(path.join(root, 'studio.ps1'), lines([
    '# a fixture program',
    "$PUBLISHED_TREES = @('base/board')",
    "$PUBLIC_MANIFEST = @( @{ from = 'tools/gone.js'; to = 'tools/gone.js' } )",
    "Write-Host 'x'"
  ]));
  run(['--root', root, '--write-baseline']);
  const r = run(['--root', root, '--quiet']);
  ok('a published path that cannot be found is named even under --quiet, which the gate runs',
    /path tools\/gone\.js/.test(r.out) && /NOT FOUND/.test(r.out));
  ok('and the count reaches the summary line, so it cannot be scrolled past',
    /1 published path\(s\) not found/.test(r.out));
}

/* Measured: a fatal guard firing part way through the studio suite reported 0 failed
   and exit 0, having run 22 of 214, so a count of failures cannot see an assertion that
   never ran. The total is pinned here, and the number is written down rather than measured
   from the run it checks, because a self-updating total agrees with any run. S35 is the same
   rule applied to the summary. Mutation: delete an assertion above and this goes red alone. */
const EXPECTED_ASSERTIONS = 110;
const ranBefore = pass + fail;
ok('the suite ran every assertion: ran ' + (ranBefore + 1) + ' of ' + EXPECTED_ASSERTIONS
  + '. A block was skipped or deleted. Find out which before you change the number.',
  ranBefore === EXPECTED_ASSERTIONS - 1);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
