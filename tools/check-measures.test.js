#!/usr/bin/env node
/**
 * Tests for check-measures.js.
 *
 * Every case runs against a REAL throwaway git repository with a real board inside it, because
 * the thing under test is a claim about commits and ticket history and a stub of either would
 * only prove the stub. The fixture path carries a timestamp and the helper refuses a directory
 * that already exists: fixtures named from the process id alone collided once the operating
 * system reused an id, and three assertions went red on an unchanged tool.
 *
 *   node tools/check-measures.test.js
 * Exit code 0 = all passed, 1 = at least one failed.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const TOOL = path.join(__dirname, 'check-measures.js');
const M = require('./check-measures.js');

let pass = 0, fail = 0;
// Measured: an assertion reading through a value the tool is documented to return crashed the
// run rather than going red, and a dead run prints no count. S35, one level down.
function ok (name, cond) {
  var v, why = '';
  try { v = (typeof cond === 'function') ? cond() : cond; }
  catch (e) { v = false; why = '  [threw: ' + String(e.message).split('\n')[0] + ']'; }
  if (v) { pass++; } else { fail++; console.log('FAIL  ' + name + why); }
}

let seq = 0;
function fixture () {
  const d = path.join(os.tmpdir(), 'measures-' + Date.now() + '-' + process.pid + '-' + (seq++));
  if (fs.existsSync(d)) throw new Error('fixture path already exists: ' + d);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function git (d, args) {
  return execFileSync('git', ['-C', d].concat(args), { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

function ticket (ref, history) {
  return JSON.stringify({ ref: ref, num: 1, title: ref, status: 'todo', history: history }, null, 2);
}

function write (d, rel, text) {
  const f = path.join(d, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, text);
}

function commit (d, subject) {
  git(d, ['add', '-A']);
  git(d, ['commit', '-q', '-m', subject]);
}

/* A repository with one commit of each kind the measure has to tell apart. */
function repo () {
  const d = fixture();
  git(d, ['init', '-q']);
  git(d, ['config', 'user.email', 't@example.com']);
  git(d, ['config', 'user.name', 'test']);
  write(d, '.board/project.json', JSON.stringify({ slug: 'test', prefix: 'TS' }));

  const through = [{ at: '2026-09-01 01:00:00', by: 'x', what: 'created in backlog' },
    { at: '2026-09-01 02:00:00', by: 'x', what: 'moved backlog -> in_progress' }];
  const never = [{ at: '2026-09-01 01:00:00', by: 'x', what: 'created in backlog' }];
  write(d, '.board/tickets/TS-1.json', ticket('TS-1', through));
  write(d, '.board/tickets/TS-2.json', ticket('TS-2', never));
  write(d, 'src.js', 'var a = 1;\n');
  commit(d, 'TS-1: work on a ticket that went through the door');

  write(d, '.board/tickets/TS-3.json', ticket('TS-3', never));
  commit(d, 'TS-3: raised, board only');

  write(d, 'src.js', 'var a = 2;\n');
  commit(d, 'TS-2: work on a ticket that never entered in_progress');

  write(d, 'src.js', 'var a = 3;\n');
  commit(d, 'Wind-down: no ticket named');
  return d;
}

function run (d, args) {
  try {
    const out = execFileSync('node', [TOOL, '--root', d].concat(args || []),
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { code: 0, out: out };
  } catch (e) {
    return { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') };
  }
}

// --- the history reader ---------------------------------------------------------------------
// Mutation that turns this group red: read ticket.status instead of walking the history.
{
  ok('a ticket whose history holds a move into in_progress counts as having entered it', () =>
    M.everEnteredInProgress({ history: [{ what: 'moved backlog -> in_progress' }] }) === true);
  ok('a ticket that only ever went to uat did not enter in_progress', () =>
    M.everEnteredInProgress({ history: [{ what: 'moved todo -> uat' }] }) === false);
  ok('a ticket that came back out of in_progress still entered it once', () =>
    M.everEnteredInProgress({ history: [{ what: 'moved backlog -> in_progress' },
      { what: 'moved in_progress -> backlog' }] }) === true);
  ok('a ticket with no history at all did not enter in_progress', () =>
    M.everEnteredInProgress({ history: [] }) === false);
  ok('a malformed ticket does not throw and does not pass', () =>
    M.everEnteredInProgress(null) === false);
}

// --- the ticket prefix is read from the board ------------------------------------------------
{
  const d = fixture();
  fs.mkdirSync(path.join(d, '.board'), { recursive: true });
  fs.writeFileSync(path.join(d, '.board', 'project.json'), JSON.stringify({ prefix: 'ZZ' }));
  const re = M.refPattern(path.join(d, '.board'));
  ok('the prefix comes from the board and not from a constant', () => re && re.test('ZZ-14'));
  ok('and a different prefix does not match', () => !new RegExp(re.source).test('TS-14'));
  ok('no project.json means no pattern rather than a wrong one', () =>
    M.refPattern(path.join(d, 'nothing')) === null);
  // Measured: a lower-case reference evaded the measure entirely, the pattern carrying no
  // ignore-case flag. Mutation M6 turns this red by returning no pattern at all.
  ok('a lower-case reference is still recognised', () => {
    const re = M.refPattern(path.join(d, '.board'));
    // Measured: the first version built a fresh expression carrying its own ignore-case flag,
    // so removing the flag from the tool left it green. S76. Mutation: set the tool flags back
    // to a bare global and this goes red, which it did not before.
    return re.flags.indexOf('i') !== -1 && new RegExp(re.source, re.flags).test('zz-14');
  });
}

// --- work against ticket administration -------------------------------------------------------
// Mutation that turns this group red: drop the isWork call so every commit is examined. That is
// what the first build did, and it reported three breaches on a tree whose true answer was zero.
{
  const d = repo();
  const r = M.frontDoorMeasure(d, path.join(d, '.board'), 10);
  ok('all four commits are examined', () => r.examined === 4);
  ok('the board-only commit is set aside as administration', () => r.admin.length === 1);
  // Measured: unguarded, a mutation emptying this list crashed the suite instead of going red.
  // A dead run prints no count, so 0 failed and a crash are indistinguishable. S35.
  ok('and it is the one that raised a ticket', () =>
    r.admin.length === 1 && r.admin[0].subject.indexOf('TS-3') === 0);
  ok('three commits changed something outside the board', () => r.work === 3);
  ok('the work commit whose ticket never entered in_progress is the only breach', () =>
    r.offProcess.length === 1 && r.offProcess[0].ref === 'TS-2');
  ok('a work commit naming no ticket is reported and not counted as a breach', () =>
    r.noRef.length === 1 && r.noRef[0].subject.indexOf('Wind-down') === 0);
}

// --- a reference to a ticket that does not exist ----------------------------------------------
{
  const d = repo();
  write(d, 'src.js', 'var a = 9;\n');
  commit(d, 'TS-99: names a ticket with no file');
  const r = M.frontDoorMeasure(d, path.join(d, '.board'), 10);
  ok('a reference with no ticket file is reported separately, not silently dropped', () =>
    r.unknownRef.length === 1 && r.unknownRef[0].ref === 'TS-99');
  ok('and it is not counted as a breach, because the answer is unknown rather than no', () =>
    !r.offProcess.some(x => x.ref === 'TS-99'));
}

// --- the override ledger ------------------------------------------------------------------------
// Measured: a stamp with no zone is read as local time, which moved the reported window a whole
// day. The board writes UTC, so these assertions hold the boundary rather than the arithmetic.
{
  const d = fixture();
  fs.mkdirSync(path.join(d, '.board'), { recursive: true });
  const B = path.join(d, '.board');

  ok('no ledger means nothing to rate rather than a rate of zero', () =>
    M.overrideMeasure(B, null).empty === true);

  fs.writeFileSync(path.join(B, 'overrides.json'), JSON.stringify([
    { at: '2026-09-04 05:23:00', gate: 'ceiling', ref: 'TS-1', reason: 'stated' }
  ]));
  const one = M.overrideMeasure(B, null);
  ok('the window opens on the day of the first entry, read as UTC', () =>
    new Date(one.shipped).toISOString().slice(0, 10) === '2026-09-04');
  ok('and closes fourteen days later', () =>
    new Date(one.end).toISOString().slice(0, 10) === '2026-09-18');
  ok('the one entry is inside the window', () => one.entries.length === 1);

  fs.writeFileSync(path.join(B, 'overrides.json'), JSON.stringify([
    { at: '2026-09-04 05:23:00', gate: 'ceiling', ref: 'TS-1', reason: 'stated' },
    { at: '2026-10-30 05:23:00', gate: 'ceiling', ref: 'TS-2', reason: 'stated' }
  ]));
  ok('an entry past the end of the window is not counted', () =>
    M.overrideMeasure(B, null).entries.length === 1);

  fs.writeFileSync(path.join(B, 'overrides.json'), JSON.stringify([
    { at: 'not a date', gate: 'ceiling', ref: 'TS-1', reason: 'stated' },
    { at: '2026-09-04 05:23:00', gate: 'ceiling', ref: 'TS-2', reason: 'stated' }
  ]));
  ok('an unreadable stamp counts as inside the window rather than ageing itself out', () =>
    M.overrideMeasure(B, null).entries.length === 2);

  fs.writeFileSync(path.join(B, 'overrides.json'), '{ not json');
  ok('a corrupt ledger is a fault and never an empty one', () =>
    M.overrideMeasure(B, null).fault !== undefined);

  fs.writeFileSync(path.join(B, 'overrides.json'), JSON.stringify({ not: 'an array' }));
  ok('a ledger that is not an array is a fault too', () =>
    M.overrideMeasure(B, null).fault !== undefined);
}

// --- exit codes -----------------------------------------------------------------------------
// Mutation that turns this group red: return 0 where the tool returns 3. A pass and an absence
// of evidence printing the same code is the whole reason three exists.
{
  const d = repo();
  const breach = run(d, []);
  ok('a breach exits 1', () => breach.code === 1);
  ok('and names the offending commit', () => breach.out.indexOf('BREACH') !== -1);

  const clean = fixture();
  git(clean, ['init', '-q']);
  git(clean, ['config', 'user.email', 't@example.com']);
  git(clean, ['config', 'user.name', 'test']);
  write(clean, '.board/project.json', JSON.stringify({ slug: 'c', prefix: 'TS' }));
  write(clean, '.board/tickets/TS-1.json', ticket('TS-1',
    [{ at: '2026-09-01 01:00:00', by: 'x', what: 'moved backlog -> in_progress' }]));
  write(clean, 'src.js', 'var a = 1;\n');
  commit(clean, 'TS-1: through the door');
  const r0 = run(clean, []);
  ok('no breach and no unreadable measure exits 0', () => r0.code === 0);

  fs.writeFileSync(path.join(clean, '.board', 'overrides.json'), JSON.stringify([
    { at: '2026-09-04 05:23:00', gate: 'ceiling', ref: 'TS-1', reason: 'stated' }
  ]));
  const r3 = run(clean, []);
  ok('an unreadable measure exits 3 rather than 0', () => r3.code === 3);
  ok('and says NOT PROVED in words as well as in the code', () =>
    r3.out.indexOf('NOT PROVED') !== -1);
  ok('the denominator is named as missing rather than estimated', () =>
    r3.out.indexOf('NOT RECORDED ANYWHERE') !== -1);

  const nowhere = fixture();
  ok('no board at all is a fault, exit 2', () => run(nowhere, []).code === 2);

  // Measured: this exited 1, telling the reader work had reached a commit off the board when
  // the real cause was no commit log to read at all. S99.
  const norepo = fixture();
  write(norepo, '.board/project.json', JSON.stringify({ slug: 'n', prefix: 'TS' }));
  ok('a board with no git repository around it is a fault, exit 2', () => run(norepo, []).code === 2);
}

/* Measured: a fatal guard firing part way through the studio suite reported 0 failed
   and exit 0, having run 22 of 214, so a count of failures cannot see an assertion that
   never ran. The total is pinned here, and the number is written down rather than measured
   from the run it checks, because a self-updating total agrees with any run. S35 is the same
   rule applied to the summary. Mutation: delete an assertion above and this goes red alone. */
const EXPECTED_ASSERTIONS = 34;
const ranBefore = pass + fail;
ok('the suite ran every assertion: ran ' + (ranBefore + 1) + ' of ' + EXPECTED_ASSERTIONS
  + '. A block was skipped or deleted. Find out which before you change the number.',
  ranBefore === EXPECTED_ASSERTIONS - 1);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
