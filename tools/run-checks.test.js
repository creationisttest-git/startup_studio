#!/usr/bin/env node
'use strict';
/*
 * Tests for run-checks.js. Every assertion here has been watched failing by breaking the tool,
 * and the mutation that turns each group red is written beside the group.
 *
 * The fixtures are real directories holding real stub instruments, and the tool spawns them
 * exactly as it spawns the real ones. A stub that exits 1 is indistinguishable to the runner
 * from a check that refused, which is the whole point: the runner has no opinion about what
 * any instrument means, it only records what came back.
 *
 * The fixture path carries a timestamp as well as the process id, and the helper REFUSES if
 * the directory already exists. Fixtures named from the pid alone accumulated 693 leftovers in
 * one day here, the operating system reused an id, and three assertions in another suite went
 * red against an unchanged tool. A precondition an assertion stands on is asserted, not assumed.
 */
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TOOL = path.join(__dirname, 'run-checks.js');
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
function fixture () {
  const dir = path.join(os.tmpdir(), 'run-checks-' + Date.now() + '-' + process.pid + '-' + (++n));
  if (fs.existsSync(dir)) throw new Error('fixture path already exists, which every assertion below assumes it does not: ' + dir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function put (root, rel, body) {
  const p = path.join(root, rel.split('/').join(path.sep));
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
  return p;
}

function stub (root, rel, code) {
  put(root, rel, 'process.stdout.write("stub ' + rel + '\\n");\nprocess.exit(' + code + ');\n');
}

// A tree carrying every node instrument, all green. The health report and the suite are
// deliberately left out so they record as absent unless a test puts them there.
function greenTree (code) {
  const root = fixture();
  stub(root, 'base/board/board.js', code === undefined ? 0 : code);
  stub(root, 'tools/check-comment-shape.js', 0);
  stub(root, 'tools/check-roster-count.js', 0);
  stub(root, 'tools/check-hook-registration.js', 0);
  stub(root, 'tools/build-releases.js', 0);
  return root;
}

function ledgerOf (root) {
  return JSON.parse(fs.readFileSync(path.join(root, '.board', 'checks.json'), 'utf8'));
}

/* Mutation: make runOne return status 'ok' regardless of the exit code and the first two
   go red; return a fixed exit of 0 and the third goes red alone. */
{
  const root = greenTree();
  const r = run(['--root', root, '--set', 'session-start']);
  const led = ledgerOf(root);
  ok('a clean run exits 0', r.code === 0);
  // Named against the session-start set as it stands. Six checks left it for the deep set,
  // which nothing gates on, so naming them here would assert a membership that is gone.
  ok('every check in the set gets a row', led.checks['board-audit'] && led.checks['roster-count'] &&
    led.checks['published-counts'] && led.checks['governance-core'] && led.checks['releases-page']);
  ok('the row carries the instrument own exit code and not a verdict about it',
    led.checks['board-audit'].exit === 0 && led.checks['board-audit'].status === 'ok');
  ok('the row carries the command line it was actually run as, so a reader can run it again',
    /board\.js audit$/.test(led.checks['board-audit'].cmd || ''));
  // governance-core, because greenTree stubs board.js, comment-shape, roster-count,
  // hook-registration and build-releases and nothing else. health-report used to serve here
  // and is no longer in this set.
  ok('an instrument this install does not carry is recorded absent and never ok',
    led.checks['governance-core'].status === 'absent');
  // Counted from the ledger, never typed: a literal goes stale the next time a check joins the set.
  const absent = Object.keys(led.checks).filter(k => led.checks[k].status === 'absent').length;
  ok('and the summary says how many were absent rather than reporting a clean run',
    absent > 0 && new RegExp('\\b' + absent + ' absent\\b').test(r.out));
}

/* Mutation: treat a non-zero exit as ok and both of these go red. */
{
  const root = greenTree(1);
  const r = run(['--root', root, '--set', 'session-start']);
  const led = ledgerOf(root);
  ok('an instrument that refuses is recorded failed with its exit code',
    led.checks['board-audit'].status === 'failed' && led.checks['board-audit'].exit === 1);
  ok('and the run itself exits non-zero', r.code === 1);
  ok('the last lines the instrument printed are kept, so the fault has a name in the record',
    /stub base\/board\/board\.js/.test(led.checks['board-audit'].tail || ''));
}

/* Mutation: make doGate ignore row.status and the first goes red; make it ignore a missing
   row and the second goes red. */
{
  const root = greenTree(1);
  run(['--root', root, '--set', 'session-start']);
  const g = run(['--root', root, '--gate', 'session-start']);
  ok('the gate refuses on a recorded failure', g.code === 1);
  ok('and names the check, the exit code and a command that clears it',
    /NOT PROVED\s+board-audit/.test(g.out) && /exit 1/.test(g.out) && /--set session-start/.test(g.out));
}
{
  const root = greenTree();
  run(['--root', root, '--set', 'session-start']);
  const g = run(['--root', root, '--gate', 'release']);
  ok('a check in the gated set that has never been recorded refuses', g.code === 1);
  ok('and says so in those words rather than reporting it as passing',
    /has never been recorded/.test(g.out));
}
{
  const root = greenTree();
  run(['--root', root, '--set', 'deep']);
  const g = run(['--root', root, '--gate', 'deep']);
  ok('an absent instrument does NOT refuse the gate, because a legitimate partial install ' +
    'that can never satisfy it would be locked out for good', g.code === 0);
  ok('and it is named in the summary, so a partial run is never read as a clean one',
    /ABSENT\s+health-report/.test(g.out) && /absent from this install/.test(g.out));
}

/* Mutation: drop the tree comparison in doGate and both of these go red while everything
   else stays green, which is exactly how a stale green row passes for a fresh one. */
{
  const root = greenTree();
  run(['--root', root, '--set', 'session-start']);
  const before = run(['--root', root, '--gate', 'session-start']);
  put(root, 'something-new.txt', 'the tree moved after the checks ran\n');
  const after = run(['--root', root, '--gate', 'session-start']);
  ok('the gate passes on the tree the checks were run against', before.code === 0);
  ok('and refuses once the tree has changed underneath the record', after.code === 1);
  ok('naming it as a different tree rather than as a failure, which is a different fix',
    /recorded against a different tree/.test(after.out));
}

/* Mutation: pass no ignore path to treeState and this goes red alone. Writing the rows moves
   the tree, so every row would be stale the instant it was written and the gate would refuse
   a run that had just completed cleanly. */
{
  const root = greenTree();
  run(['--root', root, '--set', 'session-start']);
  const g = run(['--root', root, '--gate', 'session-start']);
  ok('writing the record does not itself make the record stale', g.code === 0);
}
{
  const root = greenTree();
  const rel = '.board/checks.json';
  const a = T.treeKey(T.treeState(root, rel));
  put(root, rel, '{"version":1,"checks":{}}');
  const b = T.treeKey(T.treeState(root, rel));
  ok('the fingerprint ignores the record file, proved by writing it and re-measuring', a === b);
  const c = T.treeKey(T.treeState(root, null));
  ok('and a fingerprint taken without that exclusion does see it, so the exclusion is doing the work',
    c !== b);
}

/* The two fingerprint methods are different code paths and only one of them was ever exercised
   by the tree this suite runs in. Mutation: remove the exclude pathspec from the git branch and
   the first of these goes red while the walk-based one above stays green. */
{
  const root = greenTree();
  const g = spawnSync('git', ['init', '-q'], { cwd: root });
  // Measured: the else branch here used to call ok(name, true) three times, so a fixture where
  // git was unavailable reported three passes for a code path that had not run, and the pin
  // below cannot see a skip that still counts. Forcing the guard false gave 45 passed, 0 failed.
  ok('git is available, so the git fingerprint path can be proved at all', g.status === 0);
  if (g.status === 0) {
    spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '-A'], { cwd: root });
    spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'fixture'], { cwd: root });
    const rel = '.board/checks.json';
    const a = T.treeState(root, rel);
    put(root, rel, '{"version":1,"checks":{}}');
    const b = T.treeState(root, rel);
    ok('inside a git repository the git path runs, and the commit is recorded beside the '
     + 'fingerprint rather than inside it', a.by === 'git' && a.head);
    ok('and it still ignores the record file', T.treeKey(a) === T.treeKey(b));
    put(root, 'other.txt', 'x');
    ok('while any other untracked file does move it',
      T.treeKey(T.treeState(root, rel)) !== T.treeKey(b));

    /* -Release commits and pushes the work BEFORE it publishes, and the publish reads this
       record back. While rev-parse HEAD was inside the hash, committing invalidated the record
       one step before the only thing that reads it, so every release refused with every row NOT
       PROVED and nothing shipped for five sittings. Mutation: put the commit back into the hash
       and the first of these two goes red while the second stays green. */
    put(root, 'shipped.txt', 'work');
    const beforeCommit = T.treeKey(T.treeState(root, rel));
    spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '-A'], { cwd: root });
    spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'release'], { cwd: root });
    ok('COMMITTING THE TREE DOES NOT MOVE THE FINGERPRINT, because the content is what was '
     + 'measured and committing does not change the content',
      T.treeKey(T.treeState(root, rel)) === beforeCommit);
    put(root, 'shipped.txt', 'work and one byte more');
    ok('and one byte of that same file still moves it, so it is content and not a constant',
      T.treeKey(T.treeState(root, rel)) !== beforeCommit);
  }
}

/* Mutation: replace readLedger's try/catch with a bare JSON.parse and the first goes red by
   crashing rather than refusing, which prints no count at all. */
{
  const root = greenTree();
  run(['--root', root, '--set', 'session-start']);
  put(root, '.board/checks.json', '{ this is not json');
  const g = run(['--root', root, '--gate', 'session-start']);
  ok('a corrupt record refuses the gate rather than throwing', g.code === 1 && !/SyntaxError/.test(g.out));
  ok('and names the file and the command that rebuilds it',
    /\.board\/checks\.json is corrupt/.test(g.out) && /--set session-start/.test(g.out));
  const again = run(['--root', root, '--set', 'session-start']);
  ok('and the runner writes straight over it rather than dying on it', again.code === 0);
  ok('the bytes on disk are not destroyed before they are read, so the corruption can be looked at',
    ledgerOf(root).checks['board-audit'].status === 'ok');
}
{
  const root = greenTree();
  const g = run(['--root', root, '--gate', 'session-start']);
  ok('no record at all refuses rather than passing vacuously', g.code === 1);
  ok('and says the file does not exist rather than blaming a check',
    /does not exist/.test(g.out));
}

/* Mutation: drop the unproved branch in runOne and this records ok, which is the exact claim
   the reshape of this design exists to refuse. */
{
  // Against the deep set, because that is where health-report lives now. The claim being
  // proved is about the unproved MECHANISM, which is a property of runOne and not of a set.
  const root = greenTree();
  put(root, 'studio.ps1', 'Write-Host "stub health report"\n');
  const r = run(['--root', root, '--set', 'deep']);
  const led = ledgerOf(root);
  ok('an instrument whose exit code carries no information is recorded unproved, never ok',
    led.checks['health-report'].status === 'unproved');
  ok('with the reason on the row rather than in someone memory',
    /always exits zero/.test(led.checks['health-report'].why || ''));
  ok('it does not refuse, because it is a permanent property of that instrument',
    run(['--root', root, '--gate', 'deep']).code === 0);
  ok('and it is not counted among the checks that passed',
    /not machine-readable/.test(run(['--root', root, '--gate', 'deep']).out));
  ok('the run itself is not failed by it', r.code === 0);
}

/* Mutation: drop the second candidate path and this goes red. The export flattens the board
   directory, so a runner that only knows the source layout reports the board absent on every
   copy anybody actually installs, and that is invisible from inside this tree. */
{
  const root = fixture();
  stub(root, 'board/board.js', 0);
  stub(root, 'tools/check-comment-shape.js', 0);
  stub(root, 'tools/check-roster-count.js', 0);
  const r = run(['--root', root, '--set', 'session-start']);
  const led = ledgerOf(root);
  ok('the board is found at the path the export puts it at', led.checks['board-audit'].status === 'ok');
  ok('and the run is clean there', r.code === 0);
}

/* Mutation: delete the second treeState call and this goes red. Two gates once ran in parallel
   on one tree and both printed a clean restore over a change neither intended. */
{
  const root = greenTree();
  put(root, 'tools/check-roster-count.js',
    'require("fs").writeFileSync(require("path").join(process.cwd(), "wrote-during-the-run.txt"), "x");\nprocess.exit(0);\n');
  const r = run(['--root', root, '--set', 'session-start', '--quiet']);
  const led = ledgerOf(root);
  ok('a tree that moved while the checks ran is marked on every row',
    led.checks['board-audit'].tree === 'moved-during-run');
  ok('and the gate then refuses all of them, because none measured the tree in front of it',
    run(['--root', root, '--gate', 'session-start']).code === 1);
  ok('the run still writes the record rather than throwing it away', r.code === 0 || r.code === 1);
}

/* Mutation: accept any string as a set name and the first two go red. */
{
  const root = greenTree();
  ok('an unknown set is a usage error and not a silent empty run',
    run(['--root', root, '--set', 'everything']).code === 2);
  ok('an unknown gate set is the same', run(['--root', root, '--gate', 'everything']).code === 2);
  ok('a root that does not exist is a usage error',
    run(['--root', path.join(root, 'nope'), '--set', 'session-start']).code === 2);
  run(['--root', root, '--set', 'session-start']);
  const s = run(['--root', root, '--show']);
  ok('--show prints the record and what is stale', s.code === 0 && /board-audit/.test(s.out));
}

/* A FLAG PRESENT WITH NOTHING AFTER IT USED TO CHOOSE THE DEFAULT, AND FOR --gate THAT MEANT
 * RUNNING. flagOf returns its fallback when the flag is last on the line, so `--gate` alone read
 * as no gate at all: the program fell through, RAN the session-start set, OVERWROTE the ledger it
 * had just been asked to read back, and returned 0. Somebody gating a release got a green zero
 * from a run that gated nothing, and the row proving the previous state was gone.
 *
 * THE EXIT CODE IS THE WEAKER HALF OF THIS AND IS DELIBERATELY NOT THE ONLY ASSERTION, because a
 * tool can refuse and still have written first. The second one is about the file, which is where
 * the actual damage was.
 *
 * Mutation: delete the loop in main() that refuses, and the first two go red.
 */
{
  const root = greenTree();
  const r = run(['--root', root, '--gate']);
  ok('a --gate with nothing after it is a usage error, never a silent run of the default set',
    r.code === 2);
  ok('and it writes no ledger, so the record it was asked to read back is still there to read',
    !fs.existsSync(path.join(root, '.board', 'checks.json')));
  ok('a --set with nothing after it is the same, because the default set is the one thing you '
    + 'were ruling out by naming another', run(['--root', root, '--set']).code === 2);
}

/* THE RECORD CANNOT BE LOOSENED BY HAND, and none of this was covered until a gate found it.
   Measured before the fix, on a record whose rows were otherwise clean: a status misspelt as
   "faled", a status field deleted, and a row cut down to nothing but its tree all read as
   passed, exit 0. Mutation: restore the fall-through to a pass and the last three go red.

   BUILT ON AN ALL-GREEN TREE DELIBERATELY, and the first version of this block was not. It used
   a tree whose board.js exited 1, and that ONE file backs BOTH board-audit and board-doctor, so
   the gate exited 1 whatever the row under test said and the exit code was not attributable to
   the branch being proved. Measured: deleting the malformed-status branch left 54 passed, 1
   failed, red only on a match against the output string. An assertion aimed at a new code path
   pointed at input that took the old one. */
{
  const root = greenTree();
  run(['--root', root, '--set', 'session-start']);
  const file = path.join(root, '.board', 'checks.json');
  const pristine = fs.readFileSync(file, 'utf8');
  const tree = JSON.parse(pristine).checks['board-audit'].tree;
  const edited = fn => {
    const led = JSON.parse(pristine);
    fn(led);
    fs.writeFileSync(file, JSON.stringify(led));
    return run(['--root', root, '--gate', 'session-start']);
  };
  ok('the gate passes the record as recorded, so a refusal below is attributable to the edit',
    run(['--root', root, '--gate', 'session-start']).code === 0);

  const misspelt = edited(led => { led.checks['board-audit'].status = 'faled'; });
  ok('a status the gate does not recognise refuses instead of passing', misspelt.code === 1);
  ok('and it says the row is malformed rather than blaming the instrument',
    /not a result this gate recognises/.test(misspelt.out));
  ok('a row with no status at all refuses',
    edited(led => { delete led.checks['board-audit'].status; }).code === 1);
  ok('a row cut down to nothing but its tree refuses',
    edited(led => { led.checks['board-audit'] = { tree: tree }; }).code === 1);
  fs.writeFileSync(file, pristine);
}

/* A FAILURE CANNOT BE CLEARED BY REMOVING THE INSTRUMENT THAT FOUND IT. Measured before the
   fix: with the record red, renaming the instrument took the gate from exit 1 to exit 0
   reporting 3 passed, 0 to fix, 2 absent. Absent is for an install that never had the
   instrument, never for one that has just deleted the evidence. Mutation: drop the carry-forward
   in doRun and both of these go red. */
{
  const root = greenTree(1);
  run(['--root', root, '--set', 'session-start']);
  ok('the gate refuses while the instrument is present and refusing',
    run(['--root', root, '--gate', 'session-start']).code === 1);
  fs.renameSync(path.join(root, 'base', 'board', 'board.js'), path.join(root, 'base', 'board', 'board.js.off'));
  run(['--root', root, '--set', 'session-start']);
  const led = ledgerOf(root);
  ok('removing the instrument does not turn its recorded failure into absent',
    led.checks['board-audit'].status === 'failed');
  ok('and the row says the instrument has since been removed',
    /has since been removed/.test(led.checks['board-audit'].why || ''));
  ok('so the gate still refuses', run(['--root', root, '--gate', 'session-start']).code === 1);
}

/* Measured: a fatal guard firing part way through a suite reported 0 failed and exit 0, having
   run 22 of 214, so a count of failures cannot see an assertion that never ran. The total is
   pinned here and the number is written down rather than measured from the run it checks,
   because a self-updating total agrees with any run. Mutation: delete an assertion above and
   this goes red alone. */
/* An instrument that has something to say and nothing to refuse. Reporting that as a pass writes
   it into the record and shows it to nobody, because this runner captures each instrument's
   output rather than letting it through, and prints it only for a row that failed. Mutation: drop
   the advisory list from the hook-wiring definition and the first two go red; drop the tail from
   the advisory reason and the third does. */
{
  const root = greenTree();
  put(root, 'tools/check-hook-registration.js',
      'process.stdout.write("note  two hooks of ours are registered nowhere\\n");\n' +
      'process.exit(3);\n');
  const r = run(['--root', root, '--set', 'deep']);
  ok('AN INSTRUMENT WITH A NOTICE AND NO REFUSAL IS REPORTED AS ADVISORY, not as a pass',
    /ADVISORY\s+hook-wiring/.test(r.out));
  ok('and it does not refuse, so a notice can never lock anybody out',
    r.code === 0 && /0 failed/.test(r.out));
  ok('AND THE ROW CARRIES WHAT THE INSTRUMENT ACTUALLY SAID. A runner that swallows the message '
   + 'and prints only its own word for it leaves the reader knowing something is advisory and not '
   + 'what', /registered nowhere/.test(r.out));
}

/* The gate side of the same row, which nothing bound. Recording a result the gate does not
   recognise is worse than recording a failure: the advisory row fell into the catch-all for a
   record edited by hand, so one hook not registered refused a RELEASE and blamed a file nobody
   had touched. Mutation: delete the advisory branch in doGate and all three go red. */
{
  const root = greenTree();
  put(root, 'tools/check-hook-registration.js',
      'process.stdout.write("note  two hooks of ours are registered nowhere\\n");\n' +
      'process.exit(3);\n');
  run(['--root', root, '--set', 'deep']);
  const g = run(['--root', root, '--gate', 'deep']);
  ok('AN ADVISORY ROW DOES NOT REFUSE THE GATE. This check sat in the release set when the rule '
   + 'was written, where refusing on one would have meant a single unregistered hook stopped a '
   + 'release', g.code === 0);
  ok('and it is not reported as a record that was edited by hand, which sends the reader to the '
   + 'wrong file entirely', !/edited by hand/.test(g.out));
  ok('and it is COUNTED as advisory in the summary and named with what it said, so it is not '
   + 'silently taken for a pass. The count is asserted as well as the listing, because the listing '
   + 'is kept alive by any absent row and stayed green while the counter was gone',
    /1 advisory/.test(g.out) && /ADVISORY\s+hook-wiring/.test(g.out) &&
    /registered nowhere/.test(g.out));
}

/* A row gets ONE verdict. The listing used to work the answer out a second time, so a row refused
   as recorded against a different tree was labelled advisory in the same output, leaving a reader
   two verdicts and no way to tell which the gate acted on. Mutation: list by re-deriving the
   status instead of from what the loop counted, and this goes red. */
{
  const root = greenTree();
  put(root, 'tools/check-hook-registration.js',
      'process.stdout.write("note  two hooks of ours are registered nowhere\\n");\n' +
      'process.exit(3);\n');
  run(['--root', root, '--set', 'deep']);
  const led = ledgerOf(root);
  led.checks['hook-wiring'].tree = 'git:deadbeefdeadbeef';
  put(root, '.board/checks.json', JSON.stringify(led, null, 2) + '\n');
  const g = run(['--root', root, '--gate', 'deep']);
  ok('A ROW REFUSED AS STALE IS NOT ALSO LISTED AS ADVISORY. One row, one verdict: the refusal is '
   + 'what the gate acted on and a second label beside it is not a detail, it is a contradiction',
    /recorded against a different tree/.test(g.out) && !/ADVISORY\s+hook-wiring/.test(g.out));
}

/* The word alone must not be a way through. A status is only honoured when the definition says
   that exit code is advisory for that check, because a record that can be loosened by hand is not
   a record, and this one is read by every gate rather than by one check. Mutation: drop the
   advisory list test in doGate and both go red. */
{
  const root = greenTree();
  run(['--root', root, '--set', 'deep']);
  const led = ledgerOf(root);
  led.checks['comment-shape'].status = 'advisory';
  led.checks['comment-shape'].exit = 1;
  put(root, '.board/checks.json', JSON.stringify(led, null, 2) + '\n');
  const g = run(['--root', root, '--gate', 'deep']);
  ok('A CHECK WITH NO ADVISORY RESULT OF ITS OWN CANNOT BE MADE ADVISORY BY WRITING THE WORD INTO '
   + 'THE RECORD. It carried a real refusal and the gate would have waved it through', g.code === 1);
  ok('and it is reported as a record that does not hold up rather than as an advisory result',
    /NOT PROVED\s+comment-shape/.test(g.out) && !/ADVISORY\s+comment-shape/.test(g.out));
}

/* ST-187. THE WIRING IS WHERE THIS CHECK'S DEFECT LIVED BOTH TIMES AND NOTHING ASSERTED IT.
   doc-shape was first pointed at THIS repository, the one place a shape fault has never been
   true, so it would have passed forever; corrected to the parent, it then walked the READER'S own
   unrelated work on every installed copy and refused on it, exit 1, in the session-start set. Both
   defects are one argument in one line of a definition, and the release gate proved a suite cannot
   see either: restoring path.dirname(root) to root left run-checks.test.js at 66 passed 0 failed
   and check-document-shape.test.js at 24 passed 0 failed, everything green.
   Mutation: change the argument back to root and the reach assertion goes red; drop
   --governed-only and the scope assertion does; drop advisory:[3] and the third does. */
{
  const defs = T.definitions('C:' + path.sep + 'somewhere' + path.sep + 'startup_studio');
  const doc = defs.filter(d => d.name === 'doc-shape')[0];
  const built = doc.build({ abs: 'TOOL' }, { abs: 'TOOL' });
  ok('doc-shape is pointed at the directory HOLDING this repository, not at this repository, '
   + 'because the fault it hunts has never once been true here',
    built.args.indexOf('C:' + path.sep + 'somewhere') !== -1);
  ok('AND IT IS SCOPED TO PROJECTS THAT LOAD STUDIO GOVERNANCE, because that same directory is '
   + 'the reader\'s own work on every installed copy and refusing on it is worse than not looking',
    built.args.indexOf('--governed-only') !== -1);
  ok('and finding nothing in scope is advisory, so a fresh install is never locked out',
    !!doc.advisory && doc.advisory.indexOf(3) !== -1);
}

/* THE SETS FIELD IS AN ARGUMENT AND NOTHING ASSERTED IT, WHICH IS HOW ONE LIVED WRONG FOR EIGHT
   SITTINGS. releases-page ran in the release set alone, so every wind-down wrote a release note
   into the changelog, left the published page behind, and the only thing watching did not run
   again until somebody published. Reverting sets to ['release'] left this suite at 69 passed
   0 failed, so the fix that closed it was worth exactly nothing to any instrument.
   The advisory escape is asserted beside it for the reason the neighbouring block records: this
   check moved into the set a reader runs FIRST, and a reader who runs the method without
   publishing a site has no page and no dated changelog, which is an absence and not a drift.
   Mutation: drop 'session-start' from sets and the first goes red; drop advisory:[3] and the
   second does. Both run, both delta 1. */
{
  const defs = T.definitions('C:' + path.sep + 'somewhere' + path.sep + 'startup_studio');
  const rp = defs.filter(d => d.name === 'releases-page')[0];
  ok('releases-page runs at session start and not only at release, because the commit that '
   + 'breaks the published page is a wind-down and a wind-down never runs the release set',
    !!rp && rp.sets.indexOf('session-start') !== -1 && rp.sets.indexOf('release') !== -1);
  ok('and a tree with no page or nothing dated to hold it to is advisory rather than a lockout',
    !!rp && !!rp.advisory && rp.advisory.indexOf(3) !== -1);
}

/* ST-219 d1 SPLIT REPLY SHAPE IN TWO AND THE SPLIT IS THE WHOLE FIX, so it is asserted rather
   than described. The wind-down keeps the ABSOLUTE count, because that number is read into the
   compliance table and a slip a session recovered from still happened; the release judges a
   RECENT window, because a sent reply cannot be unsent and one slip in the first minute had
   blocked four of the last five releases. Two NAMES rather than one name with two argument sets,
   because the gate keys the ledger on the name and a windowed pass would otherwise overwrite the
   absolute row, which is the record disappearing through the fix meant to preserve it.
   Mutations, each delta 1: put 'release' back on reply-shape; delete reply-shape-recent; drop the
   --recent argument from its build; give the absolute one a --recent argument. */
{
  const defs = T.definitions('C:' + path.sep + 'somewhere' + path.sep + 'startup_studio');
  const abs = defs.filter(d => d.name === 'reply-shape')[0];
  const win = defs.filter(d => d.name === 'reply-shape-recent')[0];
  const argsOf = d => d.build({ abs: 'w' }, { abs: 't' }).args;
  ok('the absolute reply-shape check is in the wind-down set and NOT in the release set, so a '
   + 'windowed pass can never stand in for the record the compliance table reads',
    !!abs && abs.sets.indexOf('wind-down') !== -1 && abs.sets.indexOf('release') === -1);
  ok('and it is still absolute, carrying no window argument of its own',
    !!abs && argsOf(abs).indexOf('--recent') === -1);
  // The windowed row has LEFT the release set. It refused a release over a single banned
  // character in the session's own replies, with no override, and blocked four of the last
  // five. What the claim below still protects is the separation: it keeps its own name and
  // its own ledger entry, so a windowed pass can never be written over the absolute record.
  ok('the windowed row keeps its own name and stands in neither gating set',
    !!win && win.sets.indexOf('release') === -1 && win.sets.indexOf('wind-down') === -1);
  ok('and the windowed row actually passes a window, which is the only thing that makes it differ',
    !!win && argsOf(win).indexOf('--recent') !== -1);
}

const EXPECTED_ASSERTIONS = 78;
const ranBefore = pass + fail;
ok('the suite ran every assertion: ran ' + (ranBefore + 1) + ' of ' + EXPECTED_ASSERTIONS
  + '. A block was skipped or deleted. Find out which before you change the number.',
  ranBefore === EXPECTED_ASSERTIONS - 1);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
