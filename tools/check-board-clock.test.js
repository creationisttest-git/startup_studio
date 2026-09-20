#!/usr/bin/env node
'use strict';
/*
 * Every assertion here has been watched failing, by breaking check-board-clock.js and confirming
 * this suite goes red. Each case builds its own board fixture, so no case can pass because an
 * earlier one left the right bytes behind (S59).
 *
 * THE CASE THAT CARRIES THE TICKET is the rise: a fixture whose only change is ONE stamp written
 * without its namespace marker, which is precisely what a fourth writer into a board directory
 * would produce. A check that counts something and never refuses is the shape this studio keeps
 * finding: a control nobody has watched fail and a control that always passes are the same thing
 * until somebody says which.
 *
 * THE SECOND IS THE FALSE POSITIVE, and it is here because it nearly shipped. The findings this
 * record holds QUOTE timestamps, because the defect being recorded was about timestamps. A scan
 * over every string value would have counted the quotation as a bad stamp, the baseline would
 * have absorbed it on the first run, and the check would have been grading its own subject
 * matter for ever after with nothing saying so.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const TOOL = path.join(__dirname, 'check-board-clock.js');
let pass = 0, fail = 0;
function ok (name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL  ' + name); } }

const LF = String.fromCharCode(10);
let n = 0;
const junk = [];
function fixtureRootFor (name) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), name + '-' + process.pid + '-' + (n++) + '-'));
  junk.push(d);
  return d;
}

// THE CLEANUP IS REGISTERED ON EXIT, NOT WRITTEN AT A POSITION (ST-291).
// It used to be a bare statement partway down the file, so every fixture made by a block
// BELOW it was created after the only thing that removes them, and stayed on the machine.
// Moving the statement to the end did not fix it either: the file ends in process.exit, so
// a line after that never runs at all, which is the same defect wearing the opposite
// costume. Measured while believing it was fixed: leftovers went 29 to 44 in one run.
// An exit handler has no position to get wrong and survives an early exit.
// This matters beyond tidiness. Those leftovers are what made check-board-clock resolve an
// empty directory to a board belonging to a neighbour, which is the defect this suite was
// being run to fix.
process.on('exit', () => {
  junk.forEach(d => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* the OS will */ } });
});

/* Keyed on the pid AND a counter AND a random suffix, and REMOVED at the end. ST-281 is the
 * ticket for what happens without all three: a fixture keyed on the pid alone collides with a
 * leftover run that had the same pid, and the release gate goes red on a clean tree. */
function newBoard (files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'board-clock-' + process.pid + '-' + (n++) + '-'));
  junk.push(dir);
  const board = path.join(dir, '.board');
  fs.mkdirSync(path.join(board, 'tickets'), { recursive: true });
  fs.writeFileSync(path.join(board, 'project.json'),
    JSON.stringify({ slug: 'fx', prefix: 'FX', assignees: [], created_at: '2026-01-01 00:00:00Z' }) + LF);
  for (const [rel, body] of Object.entries(files || {})) {
    const p = path.join(board, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, typeof body === 'string' ? body : JSON.stringify(body, null, 2) + LF);
  }
  return { root: dir, board: board };
}

function baselineFile (dir, value) {
  const p = path.join(dir, 'baseline.json');
  if (value !== null) fs.writeFileSync(p, typeof value === 'string' ? value : JSON.stringify(value) + LF);
  return p;
}

function run (args) {
  const r = spawnSync(process.execPath, [TOOL].concat(args), { encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

const TICKET = (ref, createdAt) => ({
  ref: ref, title: 'fixture', status: 'backlog', size: 'small',
  created_at: createdAt, updated_at: createdAt,
  history: [{ at: createdAt, by: 'fx', what: 'created' }],
  decisions: []
});

/* ---- no board is not a breach ---- */

{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'board-clock-none-' + process.pid + '-'));
  junk.push(dir);
  const r = run(['--board', dir, '--baseline', baselineFile(dir, { bare: 0 })]);
  ok('a directory with no board CANNOT TELL rather than refusing', r.code === 3);
  ok('and it says what a board is, so the answer can be checked rather than believed',
    /project\.json/.test(r.out) && /tickets/.test(r.out));
}

/* ---- the happy path ---- */

{
  const fx = newBoard({ 'tickets/FX-001.json': TICKET('FX-001', '2026-02-02 03:04:05Z') });
  const r = run(['--board', fx.root, '--baseline', baselineFile(fx.root, { bare: 0 })]);
  ok('a board whose stamps all carry the marker passes', r.code === 0);
  // FOUR AND NOT THREE: created_at, updated_at and one history entry on the ticket, plus the one
  // project.json carries. This assertion was written as three and failed on its first run,
  // because it was written from the ticket the case creates rather than from the board the
  // fixture builder actually produces. Left recorded because it is the cheap half of S228: a
  // count asserted from what you meant to create cannot see what you created.
  ok('and it counts the marked stamps rather than only announcing success', /marked +4\b/.test(r.out));
  ok('and it reports zero bare', /bare +0\b/.test(r.out));
}

/* ---- THE CASE THAT CARRIES THE TICKET: one unmarked stamp refuses ---- */

{
  const fx = newBoard({
    'tickets/FX-001.json': TICKET('FX-001', '2026-02-02 03:04:05Z'),
    'tickets/FX-002.json': TICKET('FX-002', '2026-02-02 03:04:06')
  });
  const r = run(['--board', fx.root, '--baseline', baselineFile(fx.root, { bare: 0 })]);
  ok('ONE stamp written without its namespace marker refuses', r.code === 1);
  ok('and the refusal gives both numbers, so the size of the regression is readable',
    /rose from 0 to 3/.test(r.out));
  ok('and it quotes the offending stamp rather than only counting it',
    /2026-02-02 03:04:06/.test(r.out));
  ok('and it names WHERE the stamp is, which is the only part that shortens the search',
    /FX-002\.json\.created_at/.test(r.out));
  ok('and it names the module a writer is supposed to stamp through',
    /base\/board\/clock\.js/.test(r.out));
}

/* ---- a nested stamp is not a hiding place ---- */

{
  const t = TICKET('FX-001', '2026-02-02 03:04:05Z');
  t.decisions = [{ key: 'd1', at: '2026-02-02 03:04:07', by: 'fx', question: 'q', answer: null }];
  const fx = newBoard({ 'tickets/FX-001.json': t });
  const r = run(['--board', fx.root, '--baseline', baselineFile(fx.root, { bare: 0 })]);
  ok('a bare stamp nested inside a decision is found, not just the top-level fields', r.code === 1);
  ok('and it is addressed through the path that holds it',
    /decisions\[0\]\.at/.test(r.out));
}

/* ---- THE FALSE POSITIVE THAT NEARLY SHIPPED ---- */

{
  const row = {
    v: 1, at: '2026-02-02 03:04:05Z', session: 's1', project: 'fx', class: 'two-clocks',
    severity: 'major',
    finding: 'decision d7 reads 2026-09-18 11:06:22 and the commit carrying it reads 2026-09-18 21:06:50',
    /* THE EVIDENCE FIELD OPENS WITH A BARE STAMP ON PURPOSE, AND THE FIRST VERSION OF THIS CASE
     * DID NOT. Without this, every quoted timestamp in the fixture sat in the MIDDLE of its
     * string, so the leading anchor in classify() rejected them and the key restriction under
     * test was doing no work at all. Proved by mutation: making isTimeKey return true for every
     * key left the suite green at 30 passed 0 failed. A value that BEGINS with a stamp is the
     * only shape that separates the two controls, and free-text evidence beginning with a time
     * is an ordinary thing for a reviewer to write. */
    evidence: '2026-09-18 21:06:50 was the commit time; grep -n toISOString base/board/board.js',
    ticket: 'ST-283'
  };
  const fx = newBoard({ 'doctor-findings.jsonl': JSON.stringify(row) + LF });
  const r = run(['--board', fx.root, '--baseline', baselineFile(fx.root, { bare: 0 })]);
  ok('a finding that QUOTES two timestamps in its prose is not counted as two bad stamps',
    r.code === 0);
  ok('and the one real stamp on that row is still counted', /marked +2\b/.test(r.out));
}

/* ---- a stamp has to BE the value, not sit inside it ---- */

{
  /* THE SECOND CONTROL, SEPARATED FROM THE FIRST. The key restriction and the leading anchor in
   * classify() were each sufficient for every fixture above, so each masked the other: removing
   * the anchor left the suite green at 30 passed 0 failed. This case reaches classify() through
   * a key it CANNOT filter, `at`, carrying a value that mentions a stamp rather than being one.
   * A time field holding prose is damaged data, and the thing this asserts is that it is not
   * quietly counted as a good stamp, which would let a marked-looking row pass while the field
   * a reader orders by is unusable. */
  const t = TICKET('FX-001', '2026-02-02 03:04:05Z');
  t.history = [{ at: 'see the commit, 2026-02-02 03:04:09Z', by: 'fx', what: 'created' }];
  const fx = newBoard({ 'tickets/FX-001.json': t });
  const r = run(['--board', fx.root, '--baseline', baselineFile(fx.root, { bare: 0 })]);
  ok('a time field that MENTIONS a stamp is not counted as one', /marked +3\b/.test(r.out));
  ok('and it is not counted as a bare one either, so it cannot inflate the ratchet',
    /bare +0\b/.test(r.out));
}

/* ---- a date with no clock in it is not the defect ---- */

{
  const fx = newBoard({
    'front-door-waivers.json': [{ commit: 'abc1234', ref: 'ST-220', at: '2026-09-11', by: 'CEO', reason: 'fixture' }]
  });
  const r = run(['--board', fx.root, '--baseline', baselineFile(fx.root, { bare: 0 })]);
  ok('a date-only stamp passes, because there is no clock in it to disagree about', r.code === 0);
  ok('and it is counted separately rather than folded into either of the other two',
    /date-only +1\b/.test(r.out) && /bare +0\b/.test(r.out));
}

/* ---- a fall is reported and does not rewrite itself ---- */

{
  const fx = newBoard({ 'tickets/FX-001.json': TICKET('FX-001', '2026-02-02 03:04:05Z') });
  const bf = baselineFile(fx.root, { bare: 4 });
  const r = run(['--board', fx.root, '--baseline', bf]);
  ok('a bare count BELOW the baseline passes', r.code === 0);
  ok('and it says so rather than passing silently, because a number nobody reads stops being one',
    /FELL/.test(r.out) && /4 to 0/.test(r.out));
  ok('and it prints the command that rewrites the baseline',
    /--write-baseline/.test(r.out));
  ok('and it did NOT rewrite the baseline by itself: a number that lowers itself agrees with any run',
    JSON.parse(fs.readFileSync(bf, 'utf8')).bare === 4);
}

/* ---- --write-baseline writes what was measured ---- */

{
  const fx = newBoard({ 'tickets/FX-001.json': TICKET('FX-001', '2026-02-02 03:04:05') });
  const bf = baselineFile(fx.root, { bare: 0 });
  const r = run(['--board', fx.root, '--baseline', bf, '--write-baseline']);
  ok('--write-baseline exits 0 even though the count rose, because it is the act of agreeing',
    r.code === 0);
  ok('and the file now holds the measured count', JSON.parse(fs.readFileSync(bf, 'utf8')).bare === 3);
  ok('and the file says what the number means to somebody who did not write it',
    /may only fall/.test(fs.readFileSync(bf, 'utf8')));
}

/* ---- an unreadable baseline is not a baseline of zero ---- */

{
  const fx = newBoard({ 'tickets/FX-001.json': TICKET('FX-001', '2026-02-02 03:04:05') });
  const r = run(['--board', fx.root, '--baseline', baselineFile(fx.root, '{ not json')]);
  ok('a corrupt baseline exits 2 rather than being read as zero', r.code === 2);
  ok('and it says so in those words, because that is the assumption it is refusing to make',
    /not a baseline of zero/.test(r.out));
}

{
  const fx = newBoard({ 'tickets/FX-001.json': TICKET('FX-001', '2026-02-02 03:04:05') });
  const r = run(['--board', fx.root, '--baseline', path.join(fx.root, 'absent.json')]);
  ok('an ABSENT baseline exits 2 as well, and does not quietly pass on a board it has never seen',
    r.code === 2);
  ok('and it names the one command that creates one', /--write-baseline/.test(r.out));
}

/* ---- a damaged record line is reported, not fatal ---- */

{
  const good = { v: 1, at: '2026-02-02 03:04:05Z', session: 's1', class: 'x', severity: 'note', finding: 'f', evidence: 'e' };
  const fx = newBoard({ 'doctor-findings.jsonl': JSON.stringify(good) + LF + '{ half a row' + LF });
  const r = run(['--board', fx.root, '--baseline', baselineFile(fx.root, { bare: 0 })]);
  ok('a half-written record line does not take the scan down', r.code === 0);
  ok('and the damaged line is named with its number rather than swallowed',
    /UNREADABLE/.test(r.out) && /line 2/.test(r.out));
  ok('and the readable row beside it was still counted', /marked +2\b/.test(r.out));
}


/* Pinned rather than measured from the run it checks, because a self-updating total agrees with
 * any run, including one that stopped a third of the way through. A fatal guard firing part way
 * through a suite reports 0 failed and exit 0, so a count of FAILURES cannot see an assertion
 * that never ran. Written as an equality and not a floor: an assertion written `<= 9` against a
 * cap of 8 cannot see the cap move, and one written `<= 1` is green at zero. */

/* ST-291: A BOARD BELONGING TO SOMEBODY ELSE IS NOT THIS BOARD.
   findBoardDir climbed four levels unconditionally and scanned EVERY child at each one, so a
   directory with no board of its own resolved to a board belonging to a sibling of one of its
   ancestors. On this machine that was a leftover fixture in the shared operating-system temp
   folder: the check reported on it and exited 0 where the answer is CANNOT TELL. Two assertions
   above had been red for at least two commits, the release suite carried the failure, and
   nothing named it.

   THE TWO ASSERTIONS ABOVE COULD NOT HAVE CAUGHT IT ON A CLEAN MACHINE, which is why these
   exist. They assert that an EMPTY directory finds no board, and on a machine with nothing
   lying in temp they pass whether the walk is bounded or not. These PLANT the sibling.

   Mutation, run alone and the file diffed byte-identical afterwards: restore the unbounded
   walk and the first two below go red while the repository ones stay green. */
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'board-clock-sibling-' + process.pid + '-' + (n++) + '-'));
  junk.push(base);
  /* A real board, shaped exactly as one: project.json with tickets beside it. */
  const other = path.join(base, 'someone-elses-project');
  fs.mkdirSync(path.join(other, 'tickets'), { recursive: true });
  fs.writeFileSync(path.join(other, 'project.json'), '{"slug":"other"}' + LF);
  fs.writeFileSync(path.join(other, 'tickets', 'ST-1.json'), JSON.stringify(TICKET('ST-1', '2026-01-01T00:00:00Z')) + LF);
  /* And the directory actually being asked about, empty, beside it. */
  const mine = path.join(base, 'mine');
  fs.mkdirSync(mine, { recursive: true });

  const r = run(['--board', mine, '--baseline', baselineFile(base, { bare: 0 })]);
  ok('a directory whose SIBLING holds a board finds no board of its own', r.code === 3);
  ok('and it does not report on the neighbour, which is the defect this is here for',
    r.out.indexOf('someone-elses-project') === -1);
}

{
  /* THE CONVENIENCE MUST SURVIVE THE FIX. Standing inside a repository, the walk up still finds
     the board at the repository root. Without this the bound above could be tightened to
     "never walk" and the suite would not notice. */
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'board-clock-repo-' + process.pid + '-' + (n++) + '-'));
  junk.push(repo);
  fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  const board = path.join(repo, '.board');
  fs.mkdirSync(path.join(board, 'tickets'), { recursive: true });
  fs.writeFileSync(path.join(board, 'project.json'), '{"slug":"mine"}' + LF);
  fs.writeFileSync(path.join(board, 'tickets', 'ST-1.json'), JSON.stringify(TICKET('ST-1', '2026-01-01T00:00:00Z')) + LF);
  const deep = path.join(repo, 'tools', 'nested');
  fs.mkdirSync(deep, { recursive: true });

  const r = run(['--board', deep, '--baseline', baselineFile(repo, { bare: 0 })]);
  ok('inside a repository the walk up still reaches the board at its root', r.code !== 3);
  ok('and it names that board rather than saying it cannot tell', r.out.indexOf(board) !== -1);
}

{
  /* Pointed straight at a board, with no walking involved at all. */
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'board-clock-direct-' + process.pid + '-' + (n++) + '-'));
  junk.push(base);
  fs.mkdirSync(path.join(base, 'tickets'), { recursive: true });
  fs.writeFileSync(path.join(base, 'project.json'), '{"slug":"direct"}' + LF);
  fs.writeFileSync(path.join(base, 'tickets', 'ST-1.json'), JSON.stringify(TICKET('ST-1', '2026-01-01T00:00:00Z')) + LF);
  const r = run(['--board', base, '--baseline', path.join(base, 'baseline.json')]);
  ok('a directory that IS a board resolves without any walk and outside any repository',
    r.code !== 3);
}


/* ST-290 REVIEW ROUND, HIGH-1: THE FIRST BOUND DID NOT HOLD AND NOTHING WENT RED WHEN IT WAS
   FIXED, which is the more useful half of this finding. The bound asked whether the start was
   inside a repository and then scanned every ancestor it had collected, so a directory that IS
   a repository passed the test and the walk carried straight out of it into its parent's
   children. A reviewer planted it with a real git init and this tool reported on the neighbour
   at exit 0. The sentence claiming the defect was fixed had already been written into the
   published release note.

   The assertions above could not catch it: none of them starts inside a repository.

   Mutation, run alone and the file diffed byte-identical afterwards: restore the exact
   pre-review form, meaning `insideRepo = isRepo(dir0) || ancestors.some(isRepo)` followed by
   an unconditional scan of every collected ancestor. The first pair below goes red.

   THE MUTATION FIRST WRITTEN HERE SURVIVED, and saying so is worth more than quietly swapping
   it. It deleted `if (isRepo(dir0)) return null` alone, which changes nothing for this fixture
   because the restructure underneath already refuses to scan an ancestor unless a repository
   boundary is found above. That line is load-bearing only for a repository NESTED inside
   another, which the second pair below covers. Two controls, each doing a different job, and
   only a mutation of each one separately tells them apart (S237). */
{
  const base = fixtureRootFor('board-clock-repo-neighbour');
  /* The directory being asked about: a repository in its own right, holding NO board. */
  const mine = path.join(base, 'myrepo');
  fs.mkdirSync(path.join(mine, '.git'), { recursive: true });
  /* And a board belonging to somebody else, sitting beside it rather than inside it. */
  const other = path.join(base, 'neighbour-board');
  fs.mkdirSync(path.join(other, 'tickets'), { recursive: true });
  fs.writeFileSync(path.join(other, 'project.json'), '{"slug":"neighbour"}' + LF);
  fs.writeFileSync(path.join(other, 'tickets', 'ST-1.json'), JSON.stringify(TICKET('ST-1', '2026-01-01T00:00:00Z')) + LF);

  const r = run(['--board', mine, '--baseline', baselineFile(base, { bare: 0 })]);
  ok('a REPOSITORY holding no board does not walk out of itself into a neighbour', r.code === 3);
  ok('and it does not name the neighbour it used to report on',
    r.out.indexOf('neighbour-board') === -1);
}


{
  /* A repository NESTED inside another, which is the only case where the repository-root guard
     is the line that matters. Without it the walk leaves the inner repository, finds the outer
     one, scans its children and reports on a board belonging to a sibling project. Nested
     repositories are real here: this studio's own record warns that one inherits none of the
     parent's protections.

     Mutation, run alone: delete `if (isRepo(dir0)) return null` and both of these go red while
     the pair above stays green. */
  const outer = fixtureRootFor('board-clock-nested');
  fs.mkdirSync(path.join(outer, '.git'), { recursive: true });
  /* A board belonging to the OUTER project, beside the inner repository rather than in it. */
  const outerBoard = path.join(outer, '.board');
  fs.mkdirSync(path.join(outerBoard, 'tickets'), { recursive: true });
  fs.writeFileSync(path.join(outerBoard, 'project.json'), '{"slug":"outer"}' + LF);
  fs.writeFileSync(path.join(outerBoard, 'tickets', 'ST-1.json'), JSON.stringify(TICKET('ST-1', '2026-01-01T00:00:00Z')) + LF);
  /* The inner repository, holding no board of its own. */
  const inner = path.join(outer, 'vendored');
  fs.mkdirSync(path.join(inner, '.git'), { recursive: true });

  const r = run(['--board', inner, '--baseline', baselineFile(outer, { bare: 0 })]);
  ok('a repository nested inside another does not adopt the outer project\'s board', r.code === 3);
  ok('and it does not name that board either', r.out.indexOf(outerBoard) === -1);
}

const EXPECTED_ASSERTIONS = 41;
const ran = pass + fail;
if (ran !== EXPECTED_ASSERTIONS) {
  console.log('FAIL  the suite ran ' + ran + ' assertion(s) and expects ' + EXPECTED_ASSERTIONS
    + '. A block was skipped or deleted. Find out which before you change the number.');
  fail++;
}

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

