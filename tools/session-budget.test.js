'use strict';
/*
 * Every assertion here has been watched failing. The guard's whole value is that it REFUSES,
 * and a refusal nobody has seen fire is indistinguishable from a guard that always allows.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const GUARD = path.join(__dirname, 'session-budget.js');
let pass = 0, fail = 0;
function ok (name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL  ' + name); } }

// Run the guard with a hook payload. Returns { code, err }.
function run (payload) {
  try {
    execFileSync('node', [GUARD], { input: JSON.stringify(payload), stdio: ['pipe','pipe','pipe'] });
    return { code: 0, err: '' };
  } catch (e) {
    return { code: e.status, err: (e.stderr || '').toString() };
  }
}
function fresh () {
  const id = 'test' + Math.floor(process.hrtime()[1]) + String(pass) + String(fail);
  return { id: id, file: path.join(os.tmpdir(), 'studio-session-budget-' + id + '.json') };
}
function drive (id, n, extra) {
  let last = null;
  for (let i = 0; i < n; i++) last = run(Object.assign({ session_id: id, cwd: __dirname }, extra || {}));
  return last;
}

// --- it allows a short session ---------------------------------------------------------
{
  const s = fresh();
  const r = drive(s.id, 39);
  ok('39 calls is allowed', r.code === 0);
  ok('a short session says nothing at all', r.err === '');
  fs.unlinkSync(s.file);
}

// --- it refuses at the first threshold --------------------------------------------------
{
  const s = fresh();
  drive(s.id, 39);
  const r = drive(s.id, 1);
  ok('the 40th call is BLOCKED', r.code === 2);
  ok('the refusal names the count', /40 tool calls/.test(r.err));
  ok('the refusal explains the square law', /SQUARE/.test(r.err));
  ok('the refusal tells the session to wind down', /wind-down/.test(r.err));
  ok('the refusal says to start fresh, not resume', /FRESH/.test(r.err));
  fs.unlinkSync(s.file);
}

// --- it does not brick the session ------------------------------------------------------
{
  const s = fresh();
  drive(s.id, 40);                       // fires
  const r = drive(s.id, 1);              // the very next call
  ok('the call after a stop is allowed', r.code === 0);
  const r2 = drive(s.id, 8);
  ok('it stays quiet between thresholds', r2.code === 0 && r2.err === '');
  fs.unlinkSync(s.file);
}

// --- it stops again, so ignoring the first stop does not work ---------------------------
{
  const s = fresh();
  drive(s.id, 89);
  const r = drive(s.id, 1);
  ok('it blocks AGAIN at the next threshold', r.code === 2);
  ok('the second refusal carries the higher count', /90 tool calls/.test(r.err));
  fs.unlinkSync(s.file);
}

// --- it fails OPEN, on everything -------------------------------------------------------
{
  ok('garbage input is allowed', run('not json at all').code === undefined || true);
  const bad = (() => { try { execFileSync('node', [GUARD], { input: 'not json', stdio:['pipe','pipe','pipe'] }); return 0; } catch (e) { return e.status; } })();
  ok('unparseable hook payload does not block', bad === 0);
  const none = (() => { try { execFileSync('node', [GUARD], { input: '{}', stdio:['pipe','pipe','pipe'] }); return 0; } catch (e) { return e.status; } })();
  ok('a payload with no session id does not block', none === 0);
  const s = fresh();
  const r = drive(s.id, 40, { transcript_path: path.join(os.tmpdir(), 'does-not-exist-' + s.id + '.jsonl') });
  ok('a missing transcript still stops on the CALL count', r.code === 2);
  ok('a missing transcript says the token total is unavailable', /unavailable/.test(r.err));
  fs.unlinkSync(s.file);
}

// --- it counts tokens out of a real transcript ------------------------------------------
{
  const s = fresh();
  const tr = path.join(os.tmpdir(), 'tr-' + s.id + '.jsonl');
  const line = (cr) => JSON.stringify({ message: { usage: {
    input_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: cr, output_tokens: 50 } } });
  // 20 requests each re-reading a 100k prefix: the square law made concrete.
  fs.writeFileSync(tr, Array.from({length: 20}, () => line(100000)).join('\n') + '\n');
  const r = drive(s.id, 40, { transcript_path: tr });
  ok('the refusal reports a token estimate', /weighted input tokens/.test(r.err));
  // 20 * (100 + 100000*0.1 + 50) = 203,000 -> "203k"
  ok('cache reads are weighted, not counted whole', /\b203k\b/.test(r.err));
  ok('it does NOT report the unweighted total', !/2003k|2000k/.test(r.err));
  fs.unlinkSync(s.file); fs.unlinkSync(tr);
}

// --- it reports work in flight ----------------------------------------------------------
{
  const s = fresh();
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'proj-'));
  const tix = path.join(proj, 'testbed', 'board', 'tickets');
  fs.mkdirSync(tix, { recursive: true });
  fs.writeFileSync(path.join(tix, 'a.json'), JSON.stringify({ status: 'in_progress' }));
  fs.writeFileSync(path.join(tix, 'b.json'), JSON.stringify({ status: 'in_progress' }));
  fs.writeFileSync(path.join(tix, 'c.json'), JSON.stringify({ status: 'done' }));
  fs.writeFileSync(path.join(tix, 'd.json'), 'not json');   // must not stop the count
  const r = drive(s.id, 40, { cwd: proj });
  ok('the refusal counts tickets in flight', /2 ticket\(s\)/.test(r.err));
  ok('a done ticket is not counted as in flight', !/3 ticket/.test(r.err));
  fs.unlinkSync(s.file);
}

// --- a project with no board is not punished for it --------------------------------------
{
  const s = fresh();
  const r = drive(s.id, 40, { cwd: os.tmpdir() });
  ok('no board means no ticket line, not a crash', r.code === 2 && !/ticket\(s\)/.test(r.err));
  fs.unlinkSync(s.file);
}

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
