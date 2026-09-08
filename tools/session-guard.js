#!/usr/bin/env node
'use strict';
/*
 * A guard on the one window where a session can lose everything it did.
 *
 * WHY THIS EXISTS. The end of a session is the only moment its record gets written: the state
 * document is rewritten from disk, then committed. Between those two acts the whole session
 * exists as one uncommitted file. Two things land in that window and both have. The context
 * window fills and compaction fires, taking with it the reading of the session that the rewrite
 * was based on. Or the turn simply ends and the file sits there, which has meant the next
 * session rediscovering work that was already done.
 *
 * A rule cannot cover this. "Commit the state document before you stop" is read at the start of
 * a session and is least likely to be recalled at the end of one, which is the only time it
 * applies. So this refuses instead, on a fact rather than on a judgement: the version control
 * system says whether the state document is modified and uncommitted, and it says so with an
 * exit code.
 *
 * WHAT EACH EVENT CAN ACTUALLY DO, because three of them differ and the difference is the whole
 * design. Before a compaction, a hook can refuse and the compaction does not happen. At the end
 * of a turn, a hook can refuse and the conversation continues; the runtime sets a flag saying
 * the turn is only still going because a hook made it so, and it overrides any hook that blocks
 * eight times in a row. At the end of a session, a hook can do neither: that event runs after the
 * decision and its output is discarded, so the only honest thing left is to write down what
 * happened. Each mode below does the most its event permits and nothing it does not.
 *
 * WHAT IT WILL NOT DO, and this is the whole safety argument. It will not brick a session and it
 * will not fail a request. Refusing a compaction is only safe while it is rare: one that fires
 * early is skipped harmlessly, but one that fires to recover from a context limit the model has
 * ALREADY hit will surface that error and fail the request if it is refused. So each refusal
 * happens at most once per episode, and an episode ends the moment the file is committed. Refuse
 * once, then get out of the way. The turn-ending mode also stands down the moment the
 * runtime's own flag says a hook is already holding the conversation open, so this can never be
 * the thing that spends those eight blocks and then dies silently at the ninth.
 *
 * It fails OPEN at every step. No repository, no state document, an unreadable file, a missing
 * version control system, a malformed payload: all of them allow the action. A guard that
 * crashes and blocks everything is worse than no guard, and this one runs on every turn.
 *
 * THAT IS BUILT AS THREE OVERLAPPING LAYERS AND NOT ONE OF THEM IS INDIVIDUALLY LOAD BEARING,
 * which is worth stating because the opposite was written here and was wrong. Removing the inner
 * catch around reading the payload, the catch around the input, or the wrapper at the bottom of
 * the file each leaves every test passing, because whichever two remain absorb what the third
 * would have caught. That is the intended shape rather than an accident: the guarantee is that
 * NOTHING here reaches the runtime as a failure, and a guarantee resting on a single statement
 * is one edit from being gone. It also means no test can prove any one of them is needed, so
 * measure before deleting one and do not read a green run as permission.
 *
 * WHO ACTUALLY HEARS THE COMPACTION REFUSAL, which is less than it looks and is the reason the
 * turn-ending mode exists as well. On a MANUAL compaction the reference says the stderr message is
 * shown to the user. On an AUTOMATIC one it says only that the compaction is blocked, so the text
 * below reaches nobody and the only surviving record is the log line. That is deliberate rather
 * than accepted: the protection is the block itself, the log is what makes it countable, and the
 * turn-ending mode is the one whose stderr the reference does route back to the session. Anyone
 * tempted to invest in the wording here should know it is mostly writing to a wall.
 *
 * WHAT IT DELIBERATELY DOES NOT SAY. The turn-ending mode writes nothing to the log on a turn it
 * did not act on. That event fires on every single turn, so a guard that records each one buries
 * the firings that matter under thousands that do not, and a log nobody can read is the same as
 * no log. "No opinion" is recorded as its own outcome rather than as a pass, because a guard that
 * could not see anything must not report the same word as one that looked and found nothing.
 *
 * The watched document is named once as a constant, so this file and its tests cannot disagree
 * about which file they watch and then agree with each other while neither agrees with the tree.
 * The log is resolved from this file rather than from the working directory, because the hook
 * fires wherever the session happens to be and the log belongs with the tool; the environment
 * override exists so the tests can assert what a line looks like without writing into the real
 * one, which would otherwise leave the only lasting artefact this tool produces unchecked.
 */

const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const STATE_DOC = 'WARM_START.md';

const HOOK_LOG = process.env.STUDIO_HOOK_LOG || path.join(__dirname, '..', '.studio-hooks.log');

function readStdin () {
  try { return fs.readFileSync(0, 'utf8'); } catch (e) { return ''; }
}

// Walks rather than shelling out, because a process launch per turn is a cost paid forever.
function repoRoot (start) {
  let cur = path.resolve(start || process.cwd());
  for (let i = 0; i < 64; i++) {
    if (fs.existsSync(path.join(cur, '.git'))) return cur;
    const up = path.dirname(cur);
    if (!up || up === cur) return null;
    cur = up;
  }
  return null;
}

// Null means "no opinion", which the callers treat as permission. Staged counts as in flight:
// staged and uncommitted is the same exposure as modified and unstaged.
function windDownInFlight (cwd) {
  const root = repoRoot(cwd);
  if (!root) return null;
  const doc = path.join(root, STATE_DOC);
  if (!fs.existsSync(doc)) return null;
  let out;
  try {
    out = execFileSync('git', ['status', '--porcelain', '--', STATE_DOC],
                       { cwd: root, encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) { return null; }
  return { root: root, dirty: String(out).trim().length > 0 };
}

// One small file per session, holding which refusals have already been spent.
function statePath (id) {
  return path.join(os.tmpdir(), 'studio-session-guard-' + id + '.json');
}

function readState (id) {
  try { return JSON.parse(fs.readFileSync(statePath(id), 'utf8')) || {}; } catch (e) { return {}; }
}

// Every session left one of these behind for good, so the temp directory grew a file per session
// forever. They are swept on write rather than on read, because a read happens on every turn and
// a write happens only when a refusal is spent. A week is well past the life of any session, and
// the whole thing fails open: a guard that cannot clean up is still a guard, and one that throws
// while tidying is worse than the litter.
const STATE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

function sweepState (now) {
  try {
    for (const f of fs.readdirSync(os.tmpdir())) {
      if (f.indexOf('studio-session-guard-') !== 0) continue;
      const p = path.join(os.tmpdir(), f);
      try {
        if (now - fs.statSync(p).mtimeMs > STATE_LIFETIME_MS) fs.unlinkSync(p);
      } catch (e) { /* gone, or someone else's; either way not ours to worry about */ }
    }
  } catch (e) { /* fail open */ }
}

function writeState (id, state) {
  try { fs.writeFileSync(statePath(id), JSON.stringify(state)); } catch (e) { /* fail open */ }
  sweepState(Date.now());
}

// Two spaces between fields and no byte order mark, which is the format the health report parses.
// LOCAL time, not UTC, because the other writer to this same file is local and the health report
// prints both under one heading with nothing marking which is which. Measured at ten hours apart
// in the same second, which made a line written a minute ago read as older than one from
// this morning.
function localStamp () {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
         'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

function log (event, outcome, detail) {
  try {
    // os.EOL rather than a literal CRLF. The format the health report parses is the two spaces
    // between fields, not the line ending, and writing CRLF on a host that does not use it puts
    // a stray carriage return into every line of a file two writers append to.
    const line = localStamp() +
                 '  ' + event + '  ' + outcome + '  ' + (detail || '') + os.EOL;
    fs.appendFileSync(HOOK_LOG, line, { encoding: 'utf8' });
  } catch (e) { /* the log is evidence, never a dependency */ }
}

const REFUSAL =
  'The state document is written and NOT COMMITTED, so this session currently exists only as an\n' +
  'uncommitted file. Commit it before going further:\n' +
  '\n' +
  '    git add ' + STATE_DOC + ' && git commit -m "Wind-down: <what this session did>"\n' +
  '\n' +
  'Losing this window has cost whole sessions here. This refuses once and then allows the action,\n' +
  'so if the file is deliberately left open, say so and continue.';

function guardCompaction (hook, id) {
  const st = windDownInFlight(hook.cwd);
  if (!st) { log('precompact', 'no-opinion', String(hook.cwd || '')); return 0; }
  const state = readState(id);
  if (!st.dirty) {
    if (state.compactionRefused) { state.compactionRefused = false; writeState(id, state); }
    log('precompact', 'ok', st.root);
    return 0;
  }
  if (state.compactionRefused) { log('precompact', 'spent', st.root); return 0; }
  state.compactionRefused = true;
  writeState(id, state);
  log('precompact', 'refused', st.root);
  process.stderr.write('COMPACTION REFUSED, once.\n' + REFUSAL + '\n');
  return 2;
}

function guardStop (hook, id) {
  // Compared against the documented boolean rather than taken as truthy, so the string "false"
  // cannot stand the guard down. Wrong either way is safe here; wrong quietly is not.
  if (hook.stop_hook_active === true) return 0;
  const st = windDownInFlight(hook.cwd);
  if (!st) return 0;
  const state = readState(id);
  if (!st.dirty) {
    if (state.stopRefused) { state.stopRefused = false; writeState(id, state); }
    return 0;
  }
  if (state.stopRefused) return 0;
  state.stopRefused = true;
  writeState(id, state);
  log('stop', 'refused', st.root);
  process.stderr.write('DO NOT STOP YET.\n' + REFUSAL + '\n');
  return 2;
}

// A session that ended with its record unwritten used to leave no trace at all, and a failure
// nobody can count is one nobody fixes.
function recordEnd (hook) {
  const st = windDownInFlight(hook.cwd);
  const why = String(hook.reason || 'unknown');
  if (!st) { log('sessionend', 'no-opinion', why); return 0; }
  log('sessionend', st.dirty ? 'state-uncommitted' : 'ok', why + ' ' + st.root);
  return 0;
}

const EVENTS = {
  precompact: guardCompaction,
  stop:       guardStop,
  sessionend: function (hook) { return recordEnd(hook); }
};

function main () {
  const argv = process.argv.slice(2);
  const at = argv.indexOf('--event');
  const name = at >= 0 ? argv[at + 1] : '';
  const handler = EVENTS[name];
  if (!handler) {
    process.stderr.write('usage: session-guard.js --event ' + Object.keys(EVENTS).join('|') + '\n');
    return 0;
  }
  let hook = {};
  try { hook = JSON.parse(readStdin()) || {}; } catch (e) { return 0; }
  // A payload with no usable session id used to fall back to one shared name, so two unrelated
  // sessions shared a spend file and the second was silently refused nothing. The working
  // directory is the next best partition available here.
  let id = String(hook.session_id || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!id) id = 'nosession-' + crypto.createHash('sha1')
                                     .update(String(hook.cwd || process.cwd())).digest('hex').slice(0, 16);
  return handler(hook, id) || 0;
}

let code = 0;
try { code = main(); } catch (e) { code = 0; }   // fail open, always
process.exit(code);
