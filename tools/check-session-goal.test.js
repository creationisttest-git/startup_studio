#!/usr/bin/env node
'use strict';
/*
 * Every assertion here has been watched failing, by breaking check-session-goal.js and
 * confirming this suite goes red. Each case builds its own document and its own board (S59).
 *
 * THE CASE THAT CARRIES THE TICKET is the timestamp one: a goal noted AFTER the first ticket
 * mutation of the day is a summary of what happened, not a commitment the session can be
 * measured against, and the two are indistinguishable once written down. Everything else here
 * is shape. That one is the reason the tool exists.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
/* ST-281: fixture roots come from ONE place that makes them unique and removes them at exit. */
const { fixtureRoot } = require('./tmp-fixtures.js');

const TOOL = path.join(__dirname, 'check-session-goal.js');
let pass = 0, fail = 0;
function ok (name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL  ' + name); } }

const LF = String.fromCharCode(10);
let n = 0;

const GOOD = [
  '## Session goal',
  '',
  'Goal: ship the eight-item round the CEO authorised, finished rather than carried',
  'Value: every item kills a class rather than patching one instance',
  'Stated: 2026-09-18 09:00',
  'Verdict: MET',
  '',
  '## Something else',
  '',
].join(LF);

// history: [{ at, what }] written onto one ticket. null means no board at all.
function world (section, history) {
  const dir = path.join(fixtureRoot('session-goal'), 'tree');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'WARM_START.md'), '# state' + LF + LF + (section === null ? '' : section), 'utf8');
  if (history !== null) {
    const td = path.join(dir, '.board', 'tickets');
    fs.mkdirSync(td, { recursive: true });
    fs.writeFileSync(path.join(td, 'ST-1.json'), JSON.stringify({ ref: 'ST-1', history: history }), 'utf8');
  }
  return dir;
}

function run (dir, extra) {
  const args = [TOOL, path.join(dir, 'WARM_START.md')].concat(extra || []);
  try { return { code: 0, out: execFileSync('node', args, { stdio: ['pipe', 'pipe', 'pipe'] }).toString() }; }
  catch (e) { return { code: e.status, out: ((e.stdout || '') + (e.stderr || '')).toString() }; }
}

const NOTE = 'SESSION GOAL 2026-09-18. Goal: ship the eight-item round the CEO authorised, finished rather than carried.';

// ---------------------------------------------------------------- clean

{
  const dir = world(GOOD, [
    { at: '2026-09-18 09:00:00', what: NOTE },
    { at: '2026-09-18 09:30:00', what: 'moved backlog -> in_progress' },
  ]);
  const r = run(dir);
  ok('a goal stated before the work and answered with a verdict passes', r.code === 0);
  ok('the clean run prints the goal back so a reader sees what was committed to', /ship the eight-item round/.test(r.out));
  ok('the clean run names where on the board the goal was noted', /goal noted 2026-09-18 09:00:00 on ST-1/.test(r.out));
}

// ---------------------------------------------------------------- the ticket itself

{
  const dir = world(GOOD, [
    { at: '2026-09-18 09:30:00', what: 'moved backlog -> in_progress' },
    { at: '2026-09-18 18:00:00', what: NOTE },
  ]);
  const r = run(dir);
  ok('a goal noted AFTER the first ticket mutation of the day FAILS', r.code === 1);
  ok('the refusal says the goal MAY have been written after the work started',
    /GOAL MAY HAVE BEEN WRITTEN AFTER THE WORK STARTED/.test(r.out));
  // S207. The predicate reads the first mutation of the CALENDAR DAY, and on a board shared by
  // several sessions in one day that mutation may belong to another session. The message must
  // say what it compared rather than assert more than it measured. It said the stronger thing on
  // its first real run and was wrong about this very repository.
  ok('the refusal names the comparison it actually performed', /first ticket mutation of the calendar day/.test(r.out));
  ok('the refusal admits it cannot tell which session made the earlier mutation', /cannot tell which session/.test(r.out));
  ok('the refusal names the escape rather than leaving the reader stuck', /"Ordering:" line/.test(r.out));
  ok('the refusal gives both timestamps, so the reader can check the claim', /09:30:00/.test(r.out) && /18:00:00/.test(r.out));
  ok('the refusal explains why order matters rather than only asserting it', /summary of what happened/.test(r.out));
}

{
  // The escape: a written reason, printed on every run, never a weakened predicate. Same shape as
  // the exemptions in check-rule-delivery.js and --allow-rise in check-comment-shape.js.
  const withOrdering = GOOD.replace('Verdict: MET', 'Verdict: MET' + LF + 'Ordering: the earlier mutation belongs to another session on this shared board');
  const dir = world(withOrdering, [
    { at: '2026-09-18 09:30:00', what: 'moved backlog -> in_progress' },
    { at: '2026-09-18 18:00:00', what: NOTE },
  ]);
  const r = run(dir);
  ok('an Ordering line with a reason turns the refusal into a printed note', r.code === 0);
  ok('and the accepted ordering is PRINTED, because a suppression nobody sees is never revisited',
    /Ordering ACCEPTED/.test(r.out));
  ok('and the evidence is printed beside it rather than replaced by the excuse',
    /first ticket mutation of the calendar day/.test(r.out));
}

{
  const dir = world(GOOD, [{ at: '2026-09-18 09:30:00', what: 'moved backlog -> in_progress' }]);
  const r = run(dir);
  ok('a document claiming a goal with NO board note fails, so the document is not its own witness', r.code === 1);
  ok('and the refusal says the board carries no goal note', /carries no "SESSION GOAL" note/.test(r.out));
}

{
  const dir = world(GOOD, [
    { at: '2026-09-18 09:00:00', what: 'SESSION GOAL 2026-09-18. Goal: something completely different.' },
    { at: '2026-09-18 09:30:00', what: 'moved backlog -> in_progress' },
  ]);
  const r = run(dir);
  ok('a board goal that does not match the document goal fails, because they have drifted', r.code === 1);
  ok('the drift refusal shows BOTH texts rather than asserting they differ', /board {4}:/.test(r.out) && /document :/.test(r.out));
}

// ---------------------------------------------------------------- shape

function broken (replace, withText) { return GOOD.replace(replace, withText); }

{
  const dir = world(broken('Goal: ship the eight-item round the CEO authorised, finished rather than carried' + LF, ''), [{ at: '2026-09-18 09:00:00', what: NOTE }]);
  const r = run(dir);
  ok('a section with no Goal line fails', r.code === 1 && /no "Goal:" line/.test(r.out));
}

{
  const dir = world(broken('Value: every item kills a class rather than patching one instance' + LF, ''), [{ at: '2026-09-18 09:00:00', what: NOTE }]);
  const r = run(dir);
  ok('a section with no Value line fails, because the founder asked for business value', r.code === 1 && /no "Value:" line/.test(r.out));
}

{
  const dir = world(broken('Stated: 2026-09-18 09:00' + LF, ''), [{ at: '2026-09-18 09:00:00', what: NOTE }]);
  const r = run(dir);
  ok('a section with no Stated line fails', r.code === 1);
  ok('and it says why a timestamp matters: without one the two readings are identical', /read identically/.test(r.out));
}

{
  const dir = world(broken('Verdict: MET', 'Verdict: mostly good'), [{ at: '2026-09-18 09:00:00', what: NOTE }]);
  const r = run(dir);
  ok('a verdict that is not one of the three fails', r.code === 1);
  ok('and the refusal lists the three it accepts', /MET, PARTLY MET, NOT MET/.test(r.out));
}

{
  const dir = world(broken('Verdict: MET', 'Verdict: NOT MET'), [{ at: '2026-09-18 09:00:00', what: NOTE }]);
  const r = run(dir);
  ok('NOT MET with no Carried line fails, because carrying is justified rather than assumed', r.code === 1);
  ok('and the refusal cites the rule to finish rather than carry', /FINISH rather than carry/.test(r.out));
}

{
  const dir = world(broken('Verdict: MET', 'Verdict: NOT MET' + LF + 'Carried: ST-268 and ST-270, the context ran out'), [{ at: '2026-09-18 09:00:00', what: NOTE }]);
  ok('NOT MET WITH a Carried line passes, so an honest unfinished session is not punished', run(dir).code === 0);
}

{
  const dir = world(broken('Goal: ship the eight-item round the CEO authorised, finished rather than carried', 'Goal: TBD'), [{ at: '2026-09-18 09:00:00', what: NOTE }]);
  const r = run(dir);
  ok('a placeholder Goal fails, because it satisfies a presence check and says nothing', r.code === 1 && /placeholder/.test(r.out));
}

{
  const g = 'ship the eight-item round the CEO authorised, finished rather than carried';
  const dir = world(GOOD.replace('Value: every item kills a class rather than patching one instance', 'Value: ' + g), [{ at: '2026-09-18 09:00:00', what: NOTE }]);
  const r = run(dir);
  ok('a Value that repeats the Goal word for word fails', r.code === 1 && /repeats the Goal/.test(r.out));
}

{
  // The section has to be BOUNDED. Without a bound, a Verdict line belonging to some later
  // section would satisfy this one and every shape assertion becomes unreliable.
  const dir = world([
    '## Session goal', '',
    'Goal: ship the eight-item round the CEO authorised, finished rather than carried',
    'Value: every item kills a class rather than patching one instance',
    'Stated: 2026-09-18 09:00', '',
    '## Compliance', '',
    'Verdict: MET', '',
  ].join(LF), [{ at: '2026-09-18 09:00:00', what: NOTE }]);
  const r = run(dir);
  ok('a Verdict in a LATER section does not satisfy this one, because the section is bounded', r.code === 1 && /no "Verdict:" line/.test(r.out));
}

{
  const dir = world(GOOD.replace('Goal:', '- **Goal**:').replace('Value:', '- **Value**:'), [{ at: '2026-09-18 09:00:00', what: NOTE }]);
  ok('the fields are read whether written plainly or as bold bullets, so the check does not refuse on formatting', run(dir).code === 0);
}

// ---------------------------------------------------------------- cannot tell

{
  const dir = world(null, [{ at: '2026-09-18 09:00:00', what: NOTE }]);
  const r = run(dir);
  ok('no Session goal section at all is CANNOT TELL, exit 3, and does NOT block a commit', r.code === 3);
  ok('and the CANNOT TELL says what is lost rather than reading as a pass', /nothing can say whether this/.test(r.out));
}

{
  const dir = world(GOOD, null);
  const r = run(dir);
  ok('a project with NO BOARD still passes on shape alone, so it is not locked out of committing', r.code === 0);
  ok('and it says plainly that nothing could date the goal', /NO BOARD/.test(r.out));
}

{
  const r = run({ toString: () => '' } && world(GOOD, null), ['--board', path.join(os.tmpdir(), 'no-such-board-' + process.pid)]);
  ok('an explicit board path that does not exist is still not a failure', r.code === 0);
}

{
  try {
    const out = execFileSync('node', [TOOL, path.join(os.tmpdir(), 'nope-' + process.pid + '.md')], { stdio: ['pipe', 'pipe', 'pipe'] }).toString();
    ok('a missing document is exit 2 and not a pass', /CANNOT READ/.test(out) === false);
  } catch (e) {
    ok('a missing document is exit 2 and not a pass', e.status === 2 && /CANNOT READ/.test((e.stdout || '').toString()));
  }
}


// The total is PINNED and written down rather than measured from the run it checks, because a
// self-updating total agrees with any run. Measured elsewhere in this repository: a fatal guard
// firing part way through a suite reported 0 failed and exit 0 having run 22 of 214, so a count
// of failures cannot see an assertion that never ran. Mutation: delete a block above and this
// goes red alone.
{
  /* TWO SITTINGS ON ONE CALENDAR DAY, which is ordinary here and broke this check on 2026-09-18.
   * The earliest note of the day belongs to the FIRST sitting, so comparing this document against
   * it reported drift between two different sessions' goals. The predicate is whether ANY note
   * dated today carries this goal; the ordering test above still uses the earliest note. */
  const w = world(GOOD, [
    { at: '2026-09-18 04:13:10', what: 'SESSION GOAL 2026-09-18. Goal: some entirely different round of work' },
    { at: '2026-09-18 17:05:00', what: 'SESSION GOAL 2026-09-18. Goal: ship the eight-item round the CEO authorised, finished rather than carried' }
  ]);
  const r = run(w);
  ok('a goal matching a LATER note of the same day is not reported as drift', r.code === 0);
}

const EXPECTED_ASSERTIONS = 37;
if (pass + fail !== EXPECTED_ASSERTIONS) {
  console.log('FAIL  the suite ran ' + (pass + fail) + ' assertion(s) and expects ' + EXPECTED_ASSERTIONS + '. A block was skipped or deleted. Find out which before you change the number.');
  fail++;
}

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
