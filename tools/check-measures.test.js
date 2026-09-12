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

// --- the record is not work -------------------------------------------------------------------
// Mutation that turns this group red: drop the record argument from isWork, so the set-aside is
// board-only again. That is what shipped, and it reported a ticket-raising commit as work.
{
  const d = fixture();
  write(d, 'CLAUDE.md', '# p\n\n@WARM_START.md\n@base/fragments/brevity.md\n');
  const rec = M.recordFiles(d);
  ok('the entry document counts as the record', () => rec.has('CLAUDE.md'));
  ok('a document imported from the root counts as the record', () => rec.has('WARM_START.md'));
  // THE HALF THAT KEEPS THIS HONEST. A fragment is a RULE that every project is handed, so
  // editing one is work. If this ever passes, the exemption has swallowed the roster.
  ok('a document imported from a SUBDIRECTORY is a rule, not the record, so it stays work', () =>
    !rec.has('base/fragments/brevity.md'));
  ok('a project with no CLAUDE.md still names the entry document rather than throwing', () =>
    M.recordFiles(fixture()).has('CLAUDE.md'));
}
{
  const d = fixture();
  git(d, ['init', '-q']);
  git(d, ['config', 'user.email', 't@example.com']);
  git(d, ['config', 'user.name', 'test']);
  write(d, '.board/project.json', JSON.stringify({ slug: 'test', prefix: 'TS' }));
  write(d, 'CLAUDE.md', '# p\n\n@WARM_START.md\n');
  write(d, 'WARM_START.md', 'state\n');
  write(d, 'src.js', 'var a = 1;\n');
  commit(d, 'the tree before any of this');

  // The real shape of a6c5b10: a ticket raised, and the handover updated so the next session can
  // see it. No work of any kind, and it was reported as work reaching a commit off the board.
  write(d, '.board/tickets/TS-9.json', ticket('TS-9',
    [{ at: '2026-09-01 01:00:00', by: 'x', what: 'created in backlog' }]));
  write(d, 'WARM_START.md', 'state, plus a line about TS-9\n');
  commit(d, 'TS-9: raised, and written into the handover');
  // KEYED ON THE COMMIT, for the same reason as the assertion further down: a count here goes red
  // under a mutation that WIDENS the exemption, which is the opposite defect, and an assertion
  // that cannot tell the two apart is reporting on neither (S137).
  const r = M.frontDoorMeasure(d, path.join(d, '.board'), 10);
  const raised = c => c.subject.indexOf('TS-9: raised') === 0;
  ok('raising a ticket and recording it in the state document is administration, not work', () =>
    r.admin.some(raised));
  ok('and it is therefore not a breach', () => !r.offProcess.some(x => raised(x.commit)));

  // THE EXEMPTION MUST NOT BE A HIDING PLACE, which is this file's own objection to exempting
  // anything. A source file in the same commit still counts, so work cannot be smuggled in
  // behind a handover edit.
  write(d, 'WARM_START.md', 'state, and a second line\n');
  write(d, 'src.js', 'var a = 2;\n');
  commit(d, 'TS-9: a source change hidden behind a handover edit');
  // KEYED ON THE COMMIT AND NOT ON A COUNT. The first version asserted a total of one breach and
  // went red under the mutation that reverts the fix above, for a reason that has nothing to do
  // with hiding places: with the record no longer set aside, the ticket-raising commit becomes a
  // breach too and the total is two. An assertion that fails for a reason its name does not
  // describe is not measuring what it says (S137).
  const r2 = M.frontDoorMeasure(d, path.join(d, '.board'), 10);
  const hidden = c => c.subject.indexOf('hidden behind') !== -1;
  ok('a source file in the same commit is still work, so the record is not a hiding place', () =>
    !r2.admin.some(hidden) && r2.offProcess.some(x => hidden(x.commit)));
}

// --- a commit is judged once, not once per reference --------------------------------------------
// Mutation that turns this group red: push a breach for every reference again, which is what
// refused a commit for naming the ticket it PARKED alongside the one it closed.
{
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
  commit(d, 'TS-1, TS-2: the work belongs to TS-1 and TS-2 was parked in the same commit');
  const r = M.frontDoorMeasure(d, path.join(d, '.board'), 10);
  ok('one named ticket through the door satisfies the measure for the whole commit', () =>
    r.offProcess.length === 0);

  // The other direction, and it is what stops the fix being "any reference excuses the commit".
  write(d, '.board/tickets/TS-3.json', ticket('TS-3', never));
  write(d, 'src.js', 'var a = 2;\n');
  commit(d, 'TS-2, TS-3: neither of these ever went through the door');
  // Keyed on the commit, not on a total. Reverting the fix above makes the FIRST commit a breach
  // as well, so a count here would go red saying this claim had broken when it had not (S137).
  const r2 = M.frontDoorMeasure(d, path.join(d, '.board'), 10);
  const neither = x => x.commit.subject.indexOf('neither of these') !== -1;
  ok('a commit where NO named ticket went through the door is still a breach', () =>
    r2.offProcess.some(neither));
  ok('and the breach names every ticket on the commit, so nobody has to guess which one', () =>
    (r2.offProcess.filter(neither)[0] || {}).ref === 'TS-2, TS-3');
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

// --- a recorded waiver, which is the only path back this measure has ---------------------------
// THIS WAS THE ONE INSTRUMENT HERE WITH NO ESCAPE AT ALL. comment-shape takes a rise with a
// reason, published-counts takes a dated exemption, mutation-coverage takes a baseline entry with
// a reason a stranger can read. This measure said no and stopped, and the suite asserts its exit
// is 0 or 3, so a single breach anywhere in the commit window blocked every release until the
// window rolled, including for a session that had done nothing wrong. That is a rule with no path
// back, which S180 was written about yesterday in a different check.
//
// THE THREE PROPERTIES THAT KEEP IT FROM BECOMING A WAY TO IGNORE THE RULE are each asserted
// below: a waiver names a COMMIT, so nothing can be granted before the act; a waived breach is
// still PRINTED and costs the clean exit, so a waived run can never read as a clean one; and a
// waiver that no longer matches a breach REFUSES rather than standing forever.
{
  const d = repo();
  const wf = path.join(d, '.board', 'front-door-waivers.json');
  const before = M.frontDoorMeasure(d, path.join(d, '.board'), 10);
  const bad = before.offProcess[0].commit.hash;

  fs.writeFileSync(wf, JSON.stringify([{ commit: bad, ref: 'TS-2', by: 'CEO, TS-9 d1',
    reason: 'fixed under gate pressure and ticketed immediately after' }]));
  const r = M.frontDoorMeasure(d, path.join(d, '.board'), 10);
  ok('a waived breach stops counting as a breach', () => r.offProcess.length === 0);
  ok('and it is still carried as waived rather than disappearing, because a waived run must not '
     + 'read as a run with nothing to say', () =>
    r.waived.length === 1 && r.waived[0].ref === 'TS-2');
  ok('and the reason travels with it, so a reader never has to take the waiver on trust', () =>
    /ticketed immediately after/.test(r.waived[0].waiver.reason));

  // Watched failing rather than reasoned about: without this the run exits 0 and a waived pass is
  // byte-identical to a clean one at the gate.
  const out = run(d, []);
  ok('a run carrying a waiver exits 3 and never 0', () => out.code === 3);
  ok('and it prints the waived commit, so the escape is visible in the record it writes', () =>
    /WAIVED/.test(out.out) && out.out.indexOf(bad) !== -1);
  // THE HEADLINE USED TO BE COUNTED AFTER WAIVING, so the single line stating the measure's answer
  // read zero while the line below it said one was waived. A check whose own output disproves its
  // own summary is worse than one that says nothing at all.
  ok('and the headline counts the breach it waived, so the summary cannot contradict the detail '
     + 'printed underneath it', () => /1 of 3 work commits/.test(out.out) && /of which 1 are waived/.test(out.out));

  // A WAIVER THAT HAS OUTLIVED ITS REASON REFUSES. Pointed at a commit in the window that is NOT a
  // breach, it is a standing exemption nobody can account for.
  const clean = before.admin.length ? before.admin[0].hash : bad;
  fs.writeFileSync(wf, JSON.stringify([{ commit: clean, ref: 'TS-3', by: 'CEO',
    reason: 'granted for something that is not a breach' }]));
  const stale = M.frontDoorMeasure(d, path.join(d, '.board'), 10);
  ok('a waiver naming a commit in the window that is not a breach is a fault', () =>
    !!stale.fault && /outlived/.test(stale.fault));

  // A waiver missing the reason is refused, because the reason is the entire point of recording it
  // rather than editing the check.
  fs.writeFileSync(wf, JSON.stringify([{ commit: bad, by: 'CEO' }]));
  const thin = M.frontDoorMeasure(d, path.join(d, '.board'), 10);
  ok('a waiver with no reason is a fault, not a silent exemption', () =>
    !!thin.fault && /reason/.test(thin.fault));

  // THE RISKIEST LINE IN THE MECHANISM WAS ASSERTED BY NOTHING, and two reviewers broke it in
  // ways no fixture here could see, because every fixture used the exact short hash and so could
  // not tell a prefix match from an equality one. A waiver of the empty array is truthy,
  // stringifies to nothing, and every hash starts with nothing, so ONE entry turned the whole
  // measure off while the gate still read advisory. A one-character entry waived nine breaches at
  // once. An entry written before its commit existed lay dormant and then waived a commit made 79
  // commits later, which is the thing the mechanism's own comment said could not happen.
  for (const [what, value] of [['one character', '3'], ['an empty array', []], ['a number', 7]]) {
    fs.writeFileSync(wf, JSON.stringify([{ commit: value, by: 'CEO', reason: 'x' }]));
    const r2 = M.frontDoorMeasure(d, path.join(d, '.board'), 10);
    ok('a waiver naming ' + what + ' is a fault, because a string shorter than a hash names a SET '
       + 'of commits and that set includes ones nobody has written yet', () =>
      // KEYED ON THE HEXADECIMAL WORDING AND NOT ON "not a commit", because the existence check
      // one line down says "not a commit in this repository" and the first version of this matched
      // both. Deleting the shape rule left all three green, which is an assertion holding for a
      // reason its own name does not describe, in the very sitting a reviewer named that defect.
      !!r2.fault && /hexadecimal/.test(r2.fault));
  }

  // A PREFIX OF THE RIGHT LENGTH STILL DESCRIBES A COMMIT THAT DOES NOT EXIST, so length alone
  // cannot enforce "the act has to have happened". This is the assertion that does.
  fs.writeFileSync(wf, JSON.stringify([{ commit: 'abcdef1234567', by: 'CEO', reason: 'x' }]));
  const ghost = M.frontDoorMeasure(d, path.join(d, '.board'), 10);
  ok('a waiver naming a commit this repository does not have is a fault, so one cannot be '
     + 'written ahead of the act it excuses', () =>
    !!ghost.fault && /not a commit in this repository/.test(ghost.fault));

  // The changelog advertises that somebody's name is on every waiver. Dropping the requirement
  // returned delta 0 before this existed.
  fs.writeFileSync(wf, JSON.stringify([{ commit: bad, reason: 'no name on it' }]));
  const anon = M.frontDoorMeasure(d, path.join(d, '.board'), 10);
  ok('a waiver with nobody granting it is a fault, because an exemption nobody signed is one '
     + 'nobody can be asked about', () => !!anon.fault && /by/.test(anon.fault));

  fs.unlinkSync(wf);
  const back = M.frontDoorMeasure(d, path.join(d, '.board'), 10);
  ok('and with the file gone the measure is exactly what it was before, so the escape costs '
     + 'nothing when nobody uses it', () => back.offProcess.length === before.offProcess.length);
}

/* Measured: a fatal guard firing part way through the studio suite reported 0 failed
   and exit 0, having run 22 of 214, so a count of failures cannot see an assertion that
   never ran. The total is pinned here, and the number is written down rather than measured
   from the run it checks, because a self-updating total agrees with any run. S35 is the same
   rule applied to the summary. Mutation: delete an assertion above and this goes red alone. */
const EXPECTED_ASSERTIONS = 58;
const ranBefore = pass + fail;
ok('the suite ran every assertion: ran ' + (ranBefore + 1) + ' of ' + EXPECTED_ASSERTIONS
  + '. A block was skipped or deleted. Find out which before you change the number.',
  ranBefore === EXPECTED_ASSERTIONS - 1);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
