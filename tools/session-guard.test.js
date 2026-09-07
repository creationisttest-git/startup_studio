'use strict';
/*
 * Every assertion here has been watched failing on its own. The guard's whole value is that it
 * REFUSES, and a refusal nobody has seen fire cannot be told apart from a guard that always
 * allows. The refusals are also SPENT after one use, so half of these check that it gets out of
 * the way afterwards: a guard that keeps refusing the same compaction wedges the session it was
 * built to protect, which is a worse failure than the one it prevents.
 *
 * TWO THINGS HERE ARE UNIQUE PER RUN AND BOTH HAD TO BE. Fixture directories named from the
 * process id alone collided in this repository once: the operating system reused an id, a run
 * landed on a directory another run had already prepared, and three assertions went red against
 * a tool nobody had touched. Session identifiers are worse, because the guard keeps one small
 * file per session in the temporary folder so that a refusal is spent after one use; a fixed
 * identifier carries that spent refusal into the NEXT run, which is how this suite passed once
 * and then reported nine failures on an unchanged tool. The tool was right and the test was
 * wrong, which is the harder way round to notice.
 *
 * Identifiers are memoised per tag, so two calls inside one block share a session, which is what
 * the spent-refusal assertions depend on, while two runs of this file never do.
 *
 * Fixtures are removed at the end. Left behind they accumulate, and a few hundred stale
 * directories in the temporary folder here have already exhausted memory and had two long runs
 * killed by the operating system, which then reads as a code failure to whoever debugs it next.
 * Failures to clean up are ignored, because a tidy-up that can fail the suite makes the suite
 * report a fault in the tool it is testing.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const GUARD = path.join(__dirname, 'session-guard.js');

// The real log this tool writes to when nothing overrides it. Its state is captured before a
// single assertion runs and compared at the end, because eight calls in an earlier version of
// this file left the override off and put 295 fixture paths into the production log, which is the
// one instrument proving these hooks fire at all. The suite that polluted it could not see itself
// doing so.
const REAL_LOG = path.join(__dirname, '..', '.studio-hooks.log');
function realLogState () {
  try { return String(fs.statSync(REAL_LOG).size); } catch (e) { return 'absent'; }
}
const REAL_LOG_BEFORE = realLogState();
let pass = 0, fail = 0;
function ok (name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL  ' + name); } }

let seq = 0;
const RUN = Date.now() + '-' + process.pid;
const made = [];

const ids = {};
function sid (tag) {
  if (!ids[tag]) ids[tag] = 'test-' + tag + '-' + RUN + '-' + (seq++);
  return ids[tag];
}

function fixture (withDoc) {
  const dir = path.join(os.tmpdir(), 'session-guard-' + RUN + '-' + (seq++));
  if (fs.existsSync(dir)) throw new Error('fixture already exists, refusing to reuse it: ' + dir);
  fs.mkdirSync(dir, { recursive: true });
  made.push(dir);
  const git = function () {
    execFileSync('git', Array.prototype.slice.call(arguments),
                 { cwd: dir, stdio: 'ignore', timeout: 20000 });
  };
  git('init', '-q');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'test');
  git('config', 'commit.gpgsign', 'false');
  fs.writeFileSync(path.join(dir, 'keep.txt'), 'x\n');
  if (withDoc) fs.writeFileSync(path.join(dir, 'WARM_START.md'), '# committed\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  return { dir: dir, doc: path.join(dir, 'WARM_START.md'), git: git };
}

// Returns the exit code, stderr, and every line the run appended to its own log. The log is
// ALWAYS redirected, whether or not a caller asked, so no path through this file can reach the
// real one.
function run (event, payload, logFile, extraEnv) {
  const env = Object.assign({}, process.env, extraEnv || {});
  env.STUDIO_HOOK_LOG = logFile || SCRATCH_LOG;
  let code = 0, err = '';
  try {
    execFileSync('node', [GUARD, '--event', event],
                 { input: JSON.stringify(payload), stdio: ['pipe', 'pipe', 'pipe'], env: env });
  } catch (e) {
    code = e.status;
    err = (e.stderr || '').toString();
  }
  let lines = [];
  if (logFile && fs.existsSync(logFile)) {
    lines = fs.readFileSync(logFile, 'utf8').split(/\r?\n/).filter(function (l) { return l.trim(); });
  }
  return { code: code, err: err, log: lines };
}

function logFileFor (f) { return path.join(f.dir, 'hooks.log'); }

const SCRATCH_DIR = path.join(os.tmpdir(), 'session-guard-' + RUN + '-scratch');
fs.mkdirSync(SCRATCH_DIR, { recursive: true });
made.push(SCRATCH_DIR);
const SCRATCH_LOG = path.join(SCRATCH_DIR, 'hooks.log');

{
  const dir = path.join(os.tmpdir(), 'session-guard-' + RUN + '-brokengit');
  fs.mkdirSync(dir, { recursive: true });
  made.push(dir);
  fs.writeFileSync(path.join(dir, '.git'), 'this is not a repository\n');
  fs.writeFileSync(path.join(dir, 'WARM_START.md'), '# state\n');
  const logged = path.join(dir, 'hooks.log');
  const r = run('precompact', { session_id: sid('j1'), cwd: dir }, logged);
  ok('A TREE WHOSE VERSION CONTROL CANNOT BE READ IS ALLOWED THROUGH. This is the branch the '
   + 'whole safety claim rests on: no git, a broken repository, a timeout. It must never block',
     r.code === 0);
  ok('and it is recorded as no opinion, which is what proves the branch was taken rather than '
   + 'the failure being swallowed somewhere above it',
     r.log.some(function (l) { return / precompact {2}no-opinion {2}/.test(l); }));
}

{
  const a = fixture(true);
  const b = fixture(true);
  fs.writeFileSync(a.doc, '# uncommitted\n');
  fs.writeFileSync(b.doc, '# uncommitted\n');
  ok('a payload with no session id still refuses', run('precompact', { cwd: a.dir }).code === 2);
  ok('AND A DIFFERENT DIRECTORY WITH NO SESSION ID REFUSES TOO. They used to share one spend '
   + 'file, so an unrelated session was silently allowed through on another session refusal',
     run('precompact', { cwd: b.dir }).code === 2);
}

{
  const f = fixture(true);
  const r = run('precompact', { session_id: sid('a1'), cwd: f.dir }, logFileFor(f));
  ok('a clean state document allows compaction', r.code === 0);
  ok('and it says nothing to the session', r.err === '');
  ok('and it still records that it ran, because a silent guard cannot be told from a dead one',
     r.log.length === 1 && / precompact {2}ok {2}/.test(r.log[0]));
}

{
  const f = fixture(true);
  fs.writeFileSync(f.doc, '# rewritten by a wind-down and not committed\n');
  const first = run('precompact', { session_id: sid('b1'), cwd: f.dir }, logFileFor(f));
  ok('an uncommitted state document BLOCKS compaction', first.code === 2);
  ok('the refusal names the file, so the reader does not have to guess which one',
     /WARM_START\.md/.test(first.err));
  ok('the refusal gives the command that clears it', /git add WARM_START\.md/.test(first.err));
  ok('and it is recorded as a refusal rather than as an ok',
     first.log.some(function (l) { return / precompact {2}refused {2}/.test(l); }));

  const second = run('precompact', { session_id: sid('b1'), cwd: f.dir }, logFileFor(f));
  ok('THE SECOND ATTEMPT IS ALLOWED, because a guard that keeps refusing wedges the session',
     second.code === 0);
  ok('and the spent refusal is recorded as spent, not as a pass',
     second.log.some(function (l) { return / precompact {2}spent {2}/.test(l); }));
}

{
  const f = fixture(true);
  fs.writeFileSync(f.doc, '# first wind-down\n');
  ok('the first episode refuses', run('precompact', { session_id: sid('c1'), cwd: f.dir }).code === 2);
  ok('the same episode does not refuse twice',
     run('precompact', { session_id: sid('c1'), cwd: f.dir }).code === 0);
  f.git('add', '-A');
  f.git('commit', '-q', '-m', 'wind down');
  ok('a committed document allows compaction',
     run('precompact', { session_id: sid('c1'), cwd: f.dir }).code === 0);
  fs.writeFileSync(f.doc, '# a second wind-down in the same session\n');
  ok('AND THE NEXT EPISODE REFUSES AGAIN, so the protection is per episode and not per session',
     run('precompact', { session_id: sid('c1'), cwd: f.dir }).code === 2);
}

{
  const f = fixture(true);
  fs.writeFileSync(f.doc, '# uncommitted\n');
  const r = run('stop', { session_id: sid('d1'), cwd: f.dir }, logFileFor(f));
  ok('an uncommitted state document BLOCKS the turn ending', r.code === 2);
  ok('and the refusal says not to stop rather than repeating the compaction wording',
     /DO NOT STOP YET/.test(r.err));
  ok('and it is recorded', r.log.some(function (l) { return / stop {2}refused {2}/.test(l); }));
  ok('the second attempt in the same episode is allowed',
     run('stop', { session_id: sid('d1'), cwd: f.dir }).code === 0);
}

{
  const f = fixture(true);
  fs.writeFileSync(f.doc, '# uncommitted\n');
  const r = run('stop', { session_id: sid('e1'), cwd: f.dir, stop_hook_active: true }, logFileFor(f));
  ok('A CONTINUATION THAT IS ALREADY THE RESULT OF A STOP HOOK IS NEVER BLOCKED AGAIN. The '
   + 'runtime overrides a hook after eight consecutive blocks and ends the turn anyway, so a '
   + 'guard that ignores the flag spends someone else\'s allowance and then dies silently',
     r.code === 0);
  ok('and it stays silent, so nothing is written for a turn it did not act on', r.log.length === 0);
  ok('the same payload without the flag DOES block, so the flag is what made the difference',
     run('stop', { session_id: sid('e2'), cwd: f.dir }).code === 2);
}

{
  const f = fixture(true);
  const r = run('stop', { session_id: sid('f1'), cwd: f.dir }, logFileFor(f));
  ok('a turn with nothing wrong is allowed', r.code === 0);
  ok('AND WRITES NOTHING AT ALL. This event fires on every turn, so a guard that logs each one '
   + 'buries the firings that matter in the ones that do not',
     r.err === '' && r.log.length === 0);
}

{
  const f = fixture(true);
  fs.writeFileSync(f.doc, '# uncommitted at the moment the session ended\n');
  const r = run('sessionend', { session_id: sid('g1'), cwd: f.dir, reason: 'clear' }, logFileFor(f));
  ok('SESSION END NEVER BLOCKS, even with the record unwritten. The runtime discards its output '
   + 'and cannot be refused, so a guard pretending otherwise would be a control that does nothing',
     r.code === 0);
  ok('it records that the record was left uncommitted',
     r.log.some(function (l) { return / sessionend {2}state-uncommitted {2}/.test(l); }));
  ok('and it records WHY the session ended, which is the part nobody could count before',
     r.log.some(function (l) { return /state-uncommitted {2}clear /.test(l); }));
}

{
  const f = fixture(true);
  const r = run('sessionend', { session_id: sid('h1'), cwd: f.dir, reason: 'clear' }, logFileFor(f));
  ok('a session that ended with its record committed is recorded as ok',
     r.code === 0 && r.log.some(function (l) { return / sessionend {2}ok {2}/.test(l); }));
}

{
  const bare = path.join(os.tmpdir(), 'session-guard-bare-' + Date.now() + '-' + process.pid);
  fs.mkdirSync(bare, { recursive: true });
  made.push(bare);
  const logged = path.join(bare, 'hooks.log');
  const r = run('precompact', { session_id: sid('i1'), cwd: bare }, logged);
  ok('a directory in no repository is allowed', r.code === 0);
  ok('and it is recorded as no opinion rather than as a pass, because a guard that cannot see '
   + 'anything must not report the same word as one that looked and found nothing wrong',
     r.log.some(function (l) { return / precompact {2}no-opinion {2}/.test(l); }));

  const f = fixture(false);
  ok('a repository with no state document is allowed',
     run('precompact', { session_id: sid('i2'), cwd: f.dir }).code === 0);
  ok('and so is a turn ending there', run('stop', { session_id: sid('i3'), cwd: f.dir }).code === 0);
}

{
  let code = 0;
  try {
    execFileSync('node', [GUARD, '--event', 'precompact'],
                 { input: 'not json at all', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) { code = e.status; }
  ok('a payload that is not valid input allows the action', code === 0);

  let unknown = 0, uerr = '';
  try {
    execFileSync('node', [GUARD, '--event', 'nosuchevent'],
                 { input: '{}', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) { unknown = e.status; uerr = (e.stderr || '').toString(); }
  ok('an event this guard does not handle allows the action rather than blocking it', unknown === 0);

  let noargs = 0;
  try {
    execFileSync('node', [GUARD], { input: '{}', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) { noargs = e.status; }
  ok('and so does being run with no event at all', noargs === 0);
}

{
  const src = fs.readFileSync(GUARD, 'utf8');
  const m = src.match(/const STATE_DOC = '([^']+)'/);
  ok('the guard names the state document exactly once, as a constant', !!m);
  ok('AND THAT FILE EXISTS IN THIS REPOSITORY. A guard and its tests can agree with each other '
   + 'about a path while neither agrees with the tree, which is how a check went on watching a '
   + 'directory that had moved and reported nothing wrong for weeks',
     !!m && fs.existsSync(path.join(__dirname, '..', m[1])));
}

/* The stamp is read under two imposed time zones rather than against this machine's own clock.
   Comparing it to a locally computed hour proves nothing on a machine whose clock is already at
   universal time, because there the two are the same string: the assertion passed here only
   because this machine happens to sit ten hours east of it, and it would have been inert on any
   build server. Two zones twenty-five hours apart cannot produce the same hour under any clock,
   so a stamp built from universal time makes the two runs agree and the last assertion below go
   red wherever it is run. */
function hourIn (zone, when) {
  const parts = {};
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
  for (const part of fmt.formatToParts(when)) parts[part.type] = part.value;
  return parts.year + '-' + parts.month + '-' + parts.day + 'T' + parts.hour;
}

{
  const runs = [];
  for (const zone of ['Pacific/Kiritimati', 'Pacific/Niue']) {
    const f = fixture(true);
    const before = new Date();
    const r = run('precompact', { session_id: sid('k-' + zone), cwd: f.dir }, logFileFor(f),
                  { TZ: zone });
    const after = new Date();
    const hour = ((r.log[0] || '').split('  ')[0]).slice(0, 13);
    runs.push({ zone: zone, hour: hour, before: before, after: after });
    ok('THE LOG STAMP FOLLOWS THE CLOCK OF THE MACHINE IT RUNS ON, tested here by imposing ' +
       zone + ' on the run. The other writer to this same file is local and the health report ' +
       'prints both under one heading with nothing marking which is which, so a line written a ' +
       'minute ago can read as older than one from this morning',
       hour === hourIn(zone, before) || hour === hourIn(zone, after));
  }
  ok('AND NEITHER STAMP IS UNIVERSAL TIME, WHICH IS THE PART THAT CANNOT GO INERT. Both zones sit '
   + 'a whole number of hours off universal time and neither is zero, so this holds wherever it '
   + 'is run: comparing the stamp against a locally computed hour instead proves nothing at all '
   + 'on a machine already keeping universal time, and passed here only because this one does not',
     runs.every(x => x.hour !== hourIn('UTC', x.before) && x.hour !== hourIn('UTC', x.after)));
}

for (const dir of made) {
  try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }); } catch (e) { /* best effort */ }
}
for (const tag of Object.keys(ids)) {
  try { fs.unlinkSync(path.join(os.tmpdir(), 'studio-session-guard-' + ids[tag] + '.json')); }
  catch (e) { /* best effort */ }
}

ok('THIS SUITE NEVER WRITES TO THE REAL HOOK LOG. It is machine-local evidence that the session '
 + 'hooks fire, and a suite that appends fixture paths to it destroys the only reading anyone has',
   realLogState() === REAL_LOG_BEFORE);

/* The total is pinned because a suite bound only by "N passed, 0 failed" for any N loses
   assertions in silence: a deleted block shrinks the count and the run still reads green. The
   number is READ from a run of this file rather than typed beside it. Mutation: delete any
   assertion above and this goes red on its own. */
const EXPECTED_ASSERTIONS = 44;
const ranBefore = pass + fail;
ok('the suite ran every assertion: ran ' + (ranBefore + 1) + ' of ' + EXPECTED_ASSERTIONS
  + '. A block was skipped or deleted. Find out which before you change the number.',
  ranBefore === EXPECTED_ASSERTIONS - 1);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
