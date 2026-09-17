'use strict';
/*
 * Every assertion here has been watched failing, by mutation, against a saved copy of the working
 * file rather than against git (S200), with the separating input named BEFORE the run (S190).
 *
 * WHAT THIS TOOL IS FOR DECIDES WHAT HAS TO BE TRUE OF IT. It exists so an agent reads a RANGE
 * instead of a 15,487-line file, so the two things that matter are that a range is produced at all
 * and that the WORST GAP between ranges stays small. An outline with three entries for two thousand
 * lines is worse than useless: it looks like navigation and still costs a whole read.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TOOL = path.join(__dirname, 'make-outline.js');
const mod = require('./make-outline.js');
let pass = 0, fail = 0;
function ok (name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL  ' + name); } }

function run (args) {
  try {
    return { code: 0, out: execFileSync('node', [TOOL].concat(args), { stdio: ['pipe','pipe','pipe'] }).toString() };
  } catch (e) {
    return { code: e.status === undefined ? -1 : e.status, out: ((e.stdout || '') + (e.stderr || '')).toString() };
  }
}

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'outline-'));
function write (name, lines) {
  const p = path.join(base, name);
  fs.writeFileSync(p, lines.join('\n'), 'utf8');
  return p;
}
// A file with known landmarks at known lines, padded so it clears the size floor. The padding is
// blank so nothing in it can be mistaken for a landmark, which is what makes the gap assertion below
// mean something.
function padded (blocks, toLines) {
  const out = [];
  for (const b of blocks) { while (out.length < b.at - 1) out.push(''); out.push(b.text); }
  while (out.length < toLines) out.push('');
  return out;
}

// 1. THE BASIC CONTRACT: a big file produces ranges, a small one is skipped.
{
  const f = write('big.js', padded([
    { at: 5, text: 'function alpha() {' },
    { at: 900, text: 'function beta() {' },
  ], 1200));
  const o = mod.outlineOf(f, 800);
  ok('a file over the floor is outlined', o !== null);
  ok('it reports the real line count: got ' + (o && o.lines), o && o.lines === 1200);
  ok('every declaration is found', o && o.rows.length === 2);
  ok('the first entry names the symbol and its line', o && o.rows[0].name === 'alpha' && o.rows[0].line === 5);
  // A LINE NUMBER ALONE DOES NOT TELL A READER WHAT TO ASK FOR. The span is the output.
  ok('each entry carries a span that runs to the next one',
    o && o.rows[0].to === 899 && o.rows[1].to === 1200);
  ok('a file UNDER the floor is skipped rather than outlined', mod.outlineOf(f, 5000) === null);
}

// 2. THE ASSERTION THAT ACTUALLY PROTECTS THE PURPOSE. A tool that finds two landmarks in a
// fifteen-thousand-line file has not failed any test above and has not saved a single token.
{
  const blocks = [];
  for (let i = 1; i <= 40; i++) blocks.push({ at: i * 50, text: 'function f' + i + '() {' });
  const f = write('dense.js', padded(blocks, 2000));
  const o = mod.outlineOf(f, 800);
  const worst = Math.max.apply(null, o.rows.map(r => r.to - r.line));
  ok('the WORST gap between entries stays small, which is the whole point: got ' + worst, worst <= 60);
  ok('a dense file yields an entry for every landmark: got ' + o.rows.length, o.rows.length === 40);
}

// 3. BANNER COMMENTS ARE NAMED BY THEIR WORDS, not by the row of equals signs, because an outline
// full of "=====" is an outline nobody can navigate.
{
  const f = write('banner.js', padded([
    { at: 10, text: '/* ============================================================' },
    { at: 11, text: '   AUTH GATE -- who is allowed in' },
    { at: 400, text: 'function later() {' },
  ], 900));
  const o = mod.outlineOf(f, 800);
  ok('a banner is titled from the words under it rather than the rule line',
    o.rows[0].kind === 'banner' && /AUTH GATE/.test(o.rows[0].name));
  ok('the banner title carries no run of equals signs', !/={4}/.test(o.rows[0].name));
}

// 4. LANGUAGES OTHER THAN JAVASCRIPT, because this ships to projects that are not one stack.
{
  const f = write('thing.sql', padded([
    { at: 20, text: 'CREATE TABLE IF NOT EXISTS public.bookings (' },
    { at: 500, text: 'CREATE OR REPLACE FUNCTION add_co_manager()' },
  ], 900));
  const o = mod.outlineOf(f, 800);
  ok('SQL objects are found and named: got ' + JSON.stringify(o.rows.map(r => r.name)),
    o.rows.length === 2 && /bookings/.test(o.rows[0].name) && /add_co_manager/.test(o.rows[1].name));
  const p = write('thing.py', padded([{ at: 30, text: 'def handler(event):' }], 900));
  ok('a python definition is found', mod.outlineOf(p, 800).rows.some(r => r.name === 'handler'));
}

// 5. THE RENDERED PAGE HAS TO TELL A READER WHAT TO DO WITH IT. An outline that does not say to
// read a range is a listing, and a listing is what the session was already paying for.
{
  const f = write('render.js', padded([{ at: 9, text: 'function only() {' }], 900));
  const o = mod.outlineOf(f, 800);
  const text = mod.render(o, base);
  ok('the page names the file it maps', /render\.js/.test(text));
  ok('the page states the cost of reading the file whole', /tokens to read whole/.test(text));
  ok('the page instructs a RANGE read rather than a file read', /Read a RANGE/.test(text) && /offset/.test(text));
  ok('the ranges are rendered as a table a reader can scan', /\| lines \| what \|/.test(text));
}

// 6. THE COMMAND SURFACE, including the refusals, with codes read from the process.
{
  const f = write('cli.js', padded([{ at: 9, text: 'function only() {' }], 900));
  ok('no file at all is a usage error: got ' + run([]).code, run([]).code === 2);
  const small = run([f, '--min-lines', '99999']);
  ok('nothing over the floor reports CANNOT TELL at 3 rather than passing: got ' + small.code,
    small.code === 3);
  const out = path.join(base, 'OUT.md');
  const r = run([f, '--out', out, '--min-lines', '800']);
  ok('a normal run exits 0: got ' + r.code, r.code === 0);
  ok('it writes the file it was asked for', fs.existsSync(out));
  // THE NUMBER THE TOOL IS SOLD ON HAS TO BE IN ITS OWN OUTPUT, or nobody can tell whether it paid.
  ok('the run reports bytes of source made navigable against bytes of outline',
    /bytes of source now navigable in/.test(r.out));
  const missing = run([path.join(base, 'nope.js')]);
  ok('an unreadable file refuses at 1 and names itself: got ' + missing.code,
    missing.code === 1 && /make-outline/.test(missing.out));
}

const EXPECTED_ASSERTIONS = 23;
const ranBefore = pass + fail;
ok('the suite ran every assertion: ran ' + (ranBefore + 1) + ' of ' + EXPECTED_ASSERTIONS
  + '. A block was skipped or deleted. Find out which before you change the number.',
  ranBefore === EXPECTED_ASSERTIONS - 1);

try { fs.rmSync(base, { recursive: true, force: true }); } catch (e) {}
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
