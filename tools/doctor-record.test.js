#!/usr/bin/env node
'use strict';
/*
 * Every assertion here has been watched failing, by breaking doctor-record.js and confirming
 * this suite goes red. Each case builds its own record file (S59), so no case can pass because
 * an earlier one left the right bytes behind.
 *
 * THE CASE THAT CARRIES THE TICKET is the archive one: `archive --write` rebuilds the file from
 * the rows it could PARSE, so an unparseable line was dropped with nothing said. The line most
 * likely to be unparseable is the half-written final row of a wind-down that crashed, and
 * archive is meant to run at every wind-down, so the routine running most often was the one
 * destroying exactly the evidence this record exists to keep. It was found by running the tool
 * and reading the file afterwards rather than by reading the code.
 *
 * THE SECOND IS THE ASYMMETRY THAT FIX RESTS ON: reading a damaged record is tolerant, because
 * a reader that refuses locks out every project at once; REWRITING one is not, because a writer
 * that refuses costs one person one repair. Both halves are asserted, because a tool that
 * refused both ways would pass a test that only checked the refusal.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
/* ST-281: fixture roots come from ONE place that makes them unique and removes them. */
const { fixtureRoot } = require('./tmp-fixtures.js');

const TOOL = path.join(__dirname, 'doctor-record.js');
let pass = 0, fail = 0;
function ok (name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL  ' + name); } }

/* A case that asserts on file CONTENT has to survive the file being absent. The first mutant
 * run of the ST-277 HIGH-2 block threw ENOENT out of readFileSync and killed the whole suite
 * part way through, which reports far less than a red does: the pin below exists precisely
 * because a run that stops early cannot count the assertions it never reached. */
function readOrEmpty (p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } }

const LF = String.fromCharCode(10);
let n = 0;

/* ST-281: A FIXTURE ROOT KEYED ON THE PID ALONE IS NOT UNIQUE, IT IS UNIQUE UNTIL THE PID COMES
 * ROUND AGAIN. This built its directory from the pid and a counter with mkdirSync recursive,
 * which succeeds on an existing directory and clears nothing, so a doctor-findings.jsonl left by
 * an earlier run that happened to draw the same pid was still sitting there when the next run
 * asserted the file did not exist. 2,895 such directories across 140 pids were on this machine
 * when it was found. Reproduced deterministically by seeding the root this suite's own pid would
 * use and watching it report 105 passed 1 failed on "write with no --session leaves no file
 * behind", and observed once in anger at 99 passed 7 failed under a sequential run of every node
 * suite with 106 passed 0 failed three times directly after. A release gate going red on an
 * unmodified tree reads as a flake, and a flake gets re-run rather than read.
 *
 * mkdtempSync appends random characters the OS guarantees are unused, so there is no name for a
 * previous run to have occupied. The roots are then REMOVED at exit rather than per case: the
 * case that forgets to clean up is reliably the one asserting that something is missing, which
 * is exactly the case a leftover file breaks. */
function newFile () {
  return path.join(fixtureRoot('doctor-record'), 'doctor-findings.jsonl');
}

/* CLAUDE_CODE_SESSION_ID and BOARD_HOME are STRIPPED unless a case sets them. The gate falls
 * back to both, so a suite that inherited this session's environment would test the machine it
 * happens to run on rather than the tool, and the day-keyed cases below would pass or fail
 * depending on who was logged in. */
function run (args, env) {
  const clean = Object.assign({}, process.env);
  delete clean.CLAUDE_CODE_SESSION_ID;
  delete clean.BOARD_HOME;
  const r = spawnSync(process.execPath, [TOOL].concat(args), {
    encoding: 'utf8',
    env: Object.assign(clean, env || {})
  });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

const GOOD = f => ['write', '--session', 's1', '--class', 'zero-delta-mutation', '--severity', 'major',
  '--finding', 'a mutation changed the suite output not at all', '--evidence', 'node tools/x.js',
  '--project', 'demo', '--file', f];

function rowsOf (f) {
  return fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean);
}

/* ---- write refuses before it writes ---- */

{
  const f = newFile();
  const r = run(['write', '--class', 'a-b', '--severity', 'major', '--finding', 'one two three four',
    '--evidence', 'cmd', '--file', f]);
  ok('write with no --session refuses', r.code === 1);
  ok('write with no session id names both ways of giving one', /no session id/.test(r.out) && /CLAUDE_CODE_SESSION_ID/.test(r.out));
  ok('write with no --session leaves no file behind', fs.existsSync(f) === false);
}

{
  const f = newFile();
  const r = run(['write', '--session', 's1', '--class', 'Not A Slug', '--severity', 'major',
    '--finding', 'one two three four', '--evidence', 'cmd', '--file', f]);
  ok('a class that is not kebab-case refuses', r.code === 1);
  ok('the class refusal says a class spelled two ways is two classes',
    /is not a kebab-case slug/.test(r.out));
}

{
  const f = newFile();
  const r = run(['write', '--session', 's1', '--class', 'a'.repeat(61), '--severity', 'major',
    '--finding', 'one two three four', '--evidence', 'cmd', '--file', f]);
  ok('a class longer than the cap refuses, because it will never match twice',
    r.code === 1 && /is a finding wearing a slug/.test(r.out));
}

{
  const f = newFile();
  const r = run(['write', '--session', 's1', '--class', 'a-b', '--severity', 'enormous',
    '--finding', 'one two three four', '--evidence', 'cmd', '--file', f]);
  ok('an unknown severity refuses and lists the four that are allowed',
    r.code === 1 && /is not one of critical, major, minor, note/.test(r.out));
}

{
  const f = newFile();
  const r = run(['write', '--session', 's1', '--class', 'a-b', '--severity', 'major',
    '--finding', 'too short', '--evidence', 'cmd', '--file', f]);
  ok('a finding too short to say what went wrong refuses',
    r.code === 1 && /which cannot say what went wrong/.test(r.out));
}

{
  const f = newFile();
  const r = run(['write', '--session', 's1', '--class', 'a-b', '--severity', 'major',
    '--finding', 'one two three four', '--file', f]);
  ok('a row with no evidence command refuses', r.code === 1);
  ok('the evidence refusal says why: somebody who was not here has to be able to check it',
    /checkable by somebody who was not here/.test(r.out));
}

{
  const f = newFile();
  const r = run(GOOD(f).concat(['--ticket', 'not-a-ticket']));
  ok('a --ticket that is not a ticket reference refuses',
    r.code === 1 && /is not a ticket reference/.test(r.out));
  ok('a refused write appends nothing at all', fs.existsSync(f) === false);
}

/* ---- write, the happy path and the schema ---- */

{
  const f = newFile();
  const r = run(GOOD(f));
  ok('a complete row is written and exits 0', r.code === 0);
  ok('exactly one line is appended', rowsOf(f).length === 1);
  const row = JSON.parse(rowsOf(f)[0]);
  ok('the row carries the class, which is the field recurrence is counted on', row.class === 'zero-delta-mutation');
  ok('the row carries the session it was written by', row.session === 's1');
  ok('the row carries the project, so the studio can read across projects', row.project === 'demo');
  ok('the row carries the severity', row.severity === 'major');
  ok('the row carries the evidence command', row.evidence === 'node tools/x.js');
  ok('the row carries a version, so a later schema can be told apart', row.v === 1);
  // THE MARKER IS PART OF THE ASSERTION, NOT DECORATION (ST-283). Written as the bare shape this
  // was green against a stamp built from getHours(), which is what put a local clock and a UTC
  // clock in one board directory. Anchored both ends so a row that loses the Z fails here, which
  // is the only place a silent return to two namespaces would show up.
  ok('the row carries a timestamp, in the marked UTC namespace the board writes',
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}Z$/.test(row.at));
  // And the value is actually UTC rather than merely labelled so. A stamp built from local parts
  // with a Z stuck on the end would pass the shape above and be wrong by the machine's offset.
  ok('and the stamp is the real UTC instant rather than local time wearing a Z',
    Math.abs(Date.parse(row.at) - Date.now()) < 120000);
  ok('a first sighting stamps seenCount 1 and no firstSeen', row.seenCount === 1 && row.firstSeen === null);
  ok('a row with no ticket records that explicitly rather than omitting the field', row.ticket === null);
}

{
  const f = newFile();
  run(GOOD(f));
  const r = run(GOOD(f).map(a => a === 's1' ? 's2' : a));
  ok('a second row of the same class stamps seenCount 2', JSON.parse(rowsOf(f)[1]).seenCount === 2);
  ok('a second row of the same class stamps the first sighting', JSON.parse(rowsOf(f)[1]).firstSeen !== null);
  ok('the second sighting is called out in the output as a standing defect',
    /SEEN 2 TIMES, first on/.test(r.out));
  ok('a repeat with no ticket is named, because ST-245 requires one',
    /THIS ROW CARRIES NO TICKET/.test(r.out));
}

{
  const f = newFile();
  run(GOOD(f));
  const other = GOOD(f).map(a => a === 'demo' ? 'another-project' : a);
  run(other);
  ok('the same class in a DIFFERENT project counts as its own first sighting',
    JSON.parse(rowsOf(f)[1]).seenCount === 1);
}

/* ---- gate: the check that makes the record real ---- */

{
  const f = newFile();
  const r = run(['gate', '--session', 'sX', '--file', f]);
  ok('a session that wrote no row is REFUSED', r.code === 1);
  ok('the refusal says the wind-down leaves no trace that the doctor ran',
    /leaves no trace that it ran at all/.test(r.out));
  ok('the refusal prints the write command', /write --class <slug>/.test(r.out));
  ok('the refusal prints the reason escape as well as the write command',
    /gate --reason/.test(r.out));
  /* THESE TWO USED TO REQUIRE THE OPPOSITE. They asserted that the remedy came with --session and
   * the id already typed in, which is the copy-it-off-the-screen pattern that put two namespaces
   * into one session, and they were green throughout. An assertion can pin a defect as firmly as
   * it pins a fix, and this one did, in the suite of the tool the defect was in. */
  /* The split is guarded, because `split` on a marker that is not there returns the whole string
   * at index 0 and `undefined` at index 1, and `|| ''` then turns a DELETED remedy block into a
   * pass. An assertion about what a section does not contain has to prove the section exists. */
  const remedy = r.out.indexOf('write one:') === -1 ? null : r.out.slice(r.out.indexOf('write one:'));
  ok('and NEITHER remedy carries --session, because a refusal that hands you the wrong command is '
   + 'worse than one that hands you none: the wrong one gets run',
    remedy !== null && /--session/.test(remedy) === false);
  ok('it names where the id actually comes from instead', /CLAUDE_CODE_SESSION_ID/.test(r.out));
}

{
  const f = newFile();
  run(GOOD(f));
  const r = run(['gate', '--session', 's1', '--file', f]);
  ok('a session that wrote a row passes the gate', r.code === 0);
  ok('the gate names the row it found rather than only passing',
    /1 row\(s\) written by this session/.test(r.out));
}

{
  const f = newFile();
  run(GOOD(f));
  const r = run(['gate', '--session', 'sOther', '--file', f]);
  ok('a row written by ANOTHER session does not satisfy this session gate', r.code === 1);
}

{
  const f = newFile();
  const r = run(['gate', '--session', 'sX', '--reason', 'the doctor could not run, the suite was red', '--file', f]);
  ok('a written reason clears the gate (S232: a refusal with no way out gets weakened instead)', r.code === 0);
  ok('the accepted reason is PRINTED rather than swallowed, so somebody can disagree with it',
    /REASON IS ACCEPTED AND PRINTED: the doctor could not run/.test(r.out));
}

{
  const f = newFile();
  run(GOOD(f));
  const r = run(['gate', '--file', f], { CLAUDE_CODE_SESSION_ID: 's1' });
  ok('gate reads the session id from the environment the hooks already set', r.code === 0);
  ok('and it is the session-keyed question, not the weaker day-keyed one',
    /DOCTOR RECORD GATE {2}session s1/.test(r.out));
}

/* With no session id at all the gate asks a WEAKER question and has to say so (S207). */

{
  const r = run(['gate', '--file', newFile()]);
  ok('no session id and no row today REFUSES, because that much is unambiguous', r.code === 1);
  ok('the day-keyed refusal says exactly what it measured: the record did not move today',
    /the record did not move today/.test(r.out));
  ok('the day-keyed run announces that it is the weaker question',
    /this asks a WEAKER question: any row today/.test(r.out));
}

{
  const f = newFile();
  run(GOOD(f));
  const r = run(['gate', '--file', f]);
  ok('no session id but a row written today passes', r.code === 0);
  ok('and it states plainly that it cannot tell whether the row is yours',
    /CANNOT TELL WHETHER ONE OF THEM IS YOURS/.test(r.out));
  ok('and it names the session that did write, so the reader can judge', /by session\(s\) s1\./.test(r.out));
}

{
  const r = run(['gate', '--file', newFile(), '--reason', 'no doctor today, the tree was red']);
  ok('a written reason clears the day-keyed refusal as well', r.code === 0);
  ok('and that reason is printed too', /NO ROW TODAY, AND THE REASON IS ACCEPTED AND PRINTED/.test(r.out));
}

/* ---- reading a damaged record is tolerant ---- */

{
  const f = newFile();
  run(GOOD(f));
  fs.appendFileSync(f, 'half a row {"v":1,' + LF, 'utf8');
  const r = run(['show', '--file', f]);
  ok('a line that will not parse does not make show fail', r.code === 0);
  ok('the unusable line is counted and named rather than ignored',
    /1 line\(s\) of doctor-findings.jsonl could not be used/.test(r.out));
  ok('the unusable line is quoted with its line number', /line 2:/.test(r.out));
  const g = run(['gate', '--session', 's1', '--file', f]);
  ok('a damaged record does not stop the gate finding a real row', g.code === 0);
}

{
  const f = newFile();
  fs.writeFileSync(f, JSON.stringify({ v: 1, at: '2026-01-01 00:00:00', class: 'a-b' }) + LF, 'utf8');
  const r = run(['show', '--file', f]);
  ok('a line that parses but carries no session is unusable rather than a row',
    /parsed but carries no class or session/.test(r.out));
}

{
  const r = run(['show', '--file', newFile()]);
  ok('show on a record that has never been written is CANNOT TELL, exit 3', r.code === 3);
  ok('an absent record says it is an absence of evidence, not a clean bill of health',
    /it is an absence of evidence/.test(r.out));
}

{
  const f = newFile();
  run(GOOD(f));
  run(GOOD(f).map(a => a === 's1' ? 's2' : a));
  const r = run(['show', '--file', f]);
  ok('show reports the classes seen more than once, which is the measure ST-240 drives to zero',
    /CLASSES SEEN MORE THAN ONCE/.test(r.out));
  ok('a repeated class reports how many of its rows carry a ticket',
    /zero-delta-mutation {2}2 time\(s\), 0 row\(s\) carrying a ticket/.test(r.out));
}

/* ---- archive: the rule that is here on day one rather than on the day it hurts ---- */

{
  const f = newFile();
  run(GOOD(f));
  const r = run(['archive', '--keep', '10', '--file', f]);
  ok('archive with nothing to move exits 0', r.code === 0);
  ok('the no-op says to run it anyway, because waiting for a refusal turns a ceiling into a floor',
    /waiting for a refusal is what turns a ceiling into a floor/.test(r.out));
}

{
  const f = newFile();
  run(GOOD(f));
  run(GOOD(f).map(a => a === 's1' ? 's2' : a));
  const r = run(['archive', '--keep', '1', '--file', f]);
  ok('archive without --write is a dry run', r.code === 0 && /DRY RUN/.test(r.out));
  ok('a dry run moves nothing', rowsOf(f).length === 2);
}

{
  const f = newFile();
  run(GOOD(f));
  run(GOOD(f).map(a => a === 's1' ? 's2' : a));
  const r = run(['archive', '--keep', '1', '--write', '--file', f]);
  const arch = path.join(path.dirname(f), 'doctor-findings-archive.jsonl');
  ok('archive --write moves the older row out', r.code === 0 && rowsOf(f).length === 1);
  ok('the moved row is readable at the destination', fs.existsSync(arch) && rowsOf(arch).length === 1);
  ok('the destination was proved before a byte was removed (S106)',
    /proved at the destination before removal/.test(r.out));
  ok('the row left behind is the NEWEST one', JSON.parse(rowsOf(f)[0]).session === 's2');
}

{
  const f = newFile();
  run(GOOD(f));
  fs.appendFileSync(f, 'half a row {"v":1,' + LF, 'utf8');
  run(GOOD(f).map(a => a === 's1' ? 's2' : a));
  const before = fs.readFileSync(f, 'utf8');
  const r = run(['archive', '--keep', '1', '--write', '--file', f]);
  ok('archive --write REFUSES while a line cannot be parsed', r.code === 1);
  ok('the refusal says the damaged line is what a crashed wind-down leaves behind',
    /damaged final line is what a crashed wind-down leaves behind/.test(r.out));
  ok('NOTHING is moved or deleted when it refuses', fs.readFileSync(f, 'utf8') === before);
  ok('the archive file is not created by a refused run',
    fs.existsSync(path.join(path.dirname(f), 'doctor-findings-archive.jsonl')) === false);
}

{
  const f = newFile();
  run(GOOD(f));
  fs.appendFileSync(f, 'half a row {"v":1,' + LF, 'utf8');
  const r = run(['archive', '--keep', '1', '--file', f]);
  ok('a DRY RUN over a damaged record still works, because reading is tolerant', r.code === 0);
}

{
  const r = run(['archive', '--file', newFile()]);
  ok('archive on a record that has never been written is CANNOT TELL, exit 3', r.code === 3);
}

{
  const f = newFile();
  run(GOOD(f));
  const r = run(['archive', '--keep', '0', '--write', '--file', f]);
  ok('--keep 0 is a usage error rather than a command that empties the record', r.code === 2);
}

/* ---- resolution and argument handling ---- */

{
  const dir = fixtureRoot('doctor-home');
  const r = run(['write', '--session', 's1', '--class', 'a-b', '--severity', 'note',
    '--finding', 'one two three four', '--evidence', 'cmd', '--project', 'p'], { BOARD_HOME: dir });
  ok('BOARD_HOME puts the record beside the board, exactly as run-checks.js resolves it',
    r.code === 0 && fs.existsSync(path.join(dir, 'doctor-findings.jsonl')));
}

{
  /* The flag walk must not re-locate a repeated value by its first occurrence. Here the class
   * and the session are the same string, and a find()-based reader takes the wrong neighbour. */
  const f = newFile();
  const r = run(['write', '--session', 'note', '--class', 'note', '--severity', 'note',
    '--finding', 'one two three four', '--evidence', 'cmd', '--project', 'p', '--file', f]);
  ok('a value that repeats an earlier one still reads its own flag', r.code === 0);
  ok('and the repeated value lands in the right field', JSON.parse(rowsOf(f)[0]).session === 'note');
}

{
  const r = run(['jump']);
  ok('an unknown command is a usage error', r.code === 2 && /unknown command/.test(r.out));
}

{
  const r = run([]);
  ok('no command at all prints usage and exits 2', r.code === 2 && /usage: doctor-record.js/.test(r.out));
}

/* ---- ONE SOURCE FOR THE SESSION ID (ST-277 HIGH-2) ----
 *
 * These are the assertions whose ABSENCE let the defect ship. The suite was green on 76
 * assertions while the writer read only the flag and the gate read the flag OR the environment,
 * because every case here passed the same id to both sides by hand and therefore agreed with
 * itself whatever the tool did. The mutation to watch: put `arg('--session', null)` back in
 * cmdWrite and the first four of these go red together.
 *
 * The last pair is the one that matters most and is the least obvious. It is not enough that
 * both sides READ the environment; they have to NORMALISE it the same way, because an id that
 * survives one path unchanged and is rewritten on the other is two namespaces again, just more
 * quietly than before. */
{
  const f = newFile();
  const ENV = { CLAUDE_CODE_SESSION_ID: 'env-session-aaa' };
  const w = run(['write', '--class', 'from-env', '--severity', 'note', '--finding', 'written with no flag at all',
    '--evidence', 'cmd', '--file', f], ENV);
  ok('write with no flag takes the id from the environment', w.code === 0);
  ok('write says WHERE the id came from', /from CLAUDE_CODE_SESSION_ID/.test(w.out));
  ok('the row is keyed to the environment id', /"session":"env-session-aaa"/.test(readOrEmpty(f).replace(/\s*:\s*/g, ':')));

  const g = run(['gate', '--file', f], ENV);
  ok('the gate matches a row the writer just wrote, with no flag on either side', g.code === 0);
  ok('the gate says where its id came from too', /from CLAUDE_CODE_SESSION_ID/.test(g.out));

  const gf = run(['gate', '--file', f, '--session', 'env-session-aaa'], ENV);
  ok('the flag and the environment name the same session', gf.code === 0 && /from --session/.test(gf.out));

  const other = run(['gate', '--file', f], { CLAUDE_CODE_SESSION_ID: 'env-session-bbb' });
  ok('a DIFFERENT session still refuses, so the match above is not vacuous', other.code === 1);
}

{
  const f = newFile();
  const DIRTY = 'dirty session/id!!';
  const w = run(['write', '--class', 'normalised', '--severity', 'note', '--finding', 'an id carrying characters the key may not hold',
    '--evidence', 'cmd', '--file', f], { CLAUDE_CODE_SESSION_ID: DIRTY });
  ok('an id needing normalisation is still written', w.code === 0);
  ok('the writer SAYS it normalised rather than doing it silently', /normalised to/.test(w.out));

  const g = run(['gate', '--file', f, '--session', DIRTY], {});
  ok('the gate normalises the same way, so the flag finds the environment-written row', g.code === 0);
}

// The total is PINNED and written down rather than measured from the run it checks, because a
// self-updating total agrees with any run. Measured elsewhere in this repository: a fatal guard
// firing part way through a suite reported 0 failed and exit 0 having run 22 of 214, so a count
// of failures cannot see an assertion that never ran. Mutation: delete a block above and this
// goes red alone.
/* ---- A PEER APPEND INSIDE THE ARCHIVE WINDOW (ST-277 MEDIUM-4) ----
 *
 * archive --write opened with a snapshot and truncated the file eighty-five lines later, so a row
 * another session appended in between was deleted without a word, IN THE ONE FILE whose format
 * was chosen because peers append to it concurrently. The header of the tool argues for JSON
 * Lines on exactly that ground, so this was not an unconsidered case: it was the documented
 * premise of the file being ignored by the routine that runs against it most often.
 *
 * THE WINDOW IS ENTERED DELIBERATELY RATHER THAN RACED FOR. A preload module wraps
 * fs.appendFileSync so that the archive's own append to the destination also appends one row to
 * the SOURCE, which lands the peer write inside the window every single time. A test that waited
 * for a real race would pass on a fast machine and prove nothing on any machine.
 *
 * Mutation: rebuild keptRows from the opening snapshot with rows.slice(rows.length - keep) and
 * the peer row is destroyed, which is precisely what shipped. */
{
  const f = newFile();
  const rows = [];
  for (let i = 1; i <= 5; i++) {
    rows.push(JSON.stringify({ v: 1, at: '2026-09-1' + i + ' 10:00:00', session: 's' + i, class: 'k-' + i, severity: 'note', finding: 'row ' + i, evidence: 'cmd' }));
  }
  fs.writeFileSync(f, rows.join(LF) + LF);

  const preload = path.join(path.dirname(f), 'peer-append.js');
  fs.writeFileSync(preload, [
    "const fs = require('fs');",
    "const src = process.env.PEER_SOURCE;",
    "const orig = fs.appendFileSync;",
    "let fired = false;",
    "fs.appendFileSync = function (p, data, opts) {",
    "  const r = orig.apply(fs, arguments);",
    "  if (!fired && String(p) !== String(src)) {",
    "    fired = true;",
    "    orig.call(fs, src, JSON.stringify({ v: 1, at: '2026-09-20 09:00:00', session: 'peer', class: 'peer-class', severity: 'note', finding: 'written by another session mid-archive', evidence: 'cmd' }) + '\\n', { encoding: 'utf8' });",
    "  }",
    "  return r;",
    "};"
  ].join(LF) + LF);

  const clean = Object.assign({}, process.env);
  delete clean.CLAUDE_CODE_SESSION_ID;
  delete clean.BOARD_HOME;
  clean.PEER_SOURCE = f;
  const r = spawnSync(process.execPath, ['--require', preload, TOOL, 'archive', '--file', f, '--keep', '2', '--write'],
    { encoding: 'utf8', env: clean });
  const res = { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  const after = readOrEmpty(f);

  ok('the archive still succeeds with a peer append inside the window', res.code === 0);
  ok('THE PEER ROW SURVIVES, which is the whole finding', /"class":"peer-class"/.test(after));
  ok('the rows that were archived are gone from the source', /"class":"k-1"/.test(after) === false && /"class":"k-3"/.test(after) === false);
  ok('the rows that were kept are still there', /"class":"k-4"/.test(after) && /"class":"k-5"/.test(after));
  ok('and the carry is REPORTED rather than done silently, because a row appearing in a file '
   + 'nobody expected to change is worse than one that is explained',
    /1 row\(s\) were appended by another session while this ran/.test(res.out));
  ok('the archived rows are readable at the destination', /"class":"k-1"/.test(readOrEmpty(f.replace(/\.jsonl$/, '-archive.jsonl'))));
}

/* ---- THE BOARD IS FOUND BY SHAPE, NOT BY NAME (S218, ST-277) ----
 *
 * The writer fell back to the literal name '.board' while its reader resolves a board the way
 * board.js defines one. Two projects on this machine keep theirs under another name, so in those
 * the writer would have created a second, empty .board and appended rows nobody reads, while the
 * reader went on reporting a board with no record. Each half would have been working and the pair
 * would have been broken, which is why the assertions below run the two resolutions against the
 * SAME fixture rather than checking either one against a constant.
 *
 * Mutation: put back `path.join(root, '.board', ...)` and the first two go red. */
{
  const proj = path.join(fixtureRoot('doctor-record-shape'), 'my-project');
  const board = path.join(proj, 'roadmap');
  fs.mkdirSync(path.join(board, 'tickets'), { recursive: true });
  fs.writeFileSync(path.join(board, 'project.json'), JSON.stringify({ slug: 'my-project' }), 'utf8');

  /* RUN FROM A SUBDIRECTORY, WHICH IS THE ONLY PLACE THE LABEL ASSERTION CAN BITE. Run with
   * --root at the project itself, path.basename(root) already equals the project name, so the new
   * branch and the old fallback agree and deleting the branch leaves the suite green. The fixture
   * has to be a place where the two answers DIFFER: from here the old code says 'src'. */
  const sub = path.join(proj, 'src');
  fs.mkdirSync(sub, { recursive: true });
  const r = spawnSync(process.execPath, [TOOL, 'write', '--root', sub, '--class', 'shaped',
    '--severity', 'note', '--finding', 'written with no file flag at all', '--evidence', 'cmd'],
  { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CODE_SESSION_ID: 'shape-s1', BOARD_HOME: '' }) });

  ok('a write with no --file lands in the board that EXISTS, whatever it is called',
    fs.existsSync(path.join(board, 'doctor-findings.jsonl')));
  ok('and no second board is invented beside it', fs.existsSync(path.join(proj, '.board')) === false
    && fs.existsSync(path.join(sub, '.board')) === false);
  ok('the row is labelled with the PROJECT directory, which is what the reader labels rows with, '
   + 'and not with wherever the command was typed',
    /"project":"my-project"/.test(readOrEmpty(path.join(board, 'doctor-findings.jsonl')).replace(/\s*:\s*/g, ':')));
  ok('the write itself succeeded', r.status === 0);
}

/* ---- THE OTHER TWO THINGS THAT CAN HAPPEN INSIDE THE ARCHIVE WINDOW ----
 *
 * The re-read added for the peer-append case brought two guards with it, and a reviewer found
 * both alive: removing either left 96 passed, 0 failed. They are reachable by exactly the same
 * preload that reaches the peer append, so leaving them uncovered was not a limit of the harness,
 * it was not having asked. A guard that has never been watched failing and a guard that cannot
 * fail are the same thing until somebody says which.
 *
 * In both cases the rows are already safe in the archive, so refusing here costs a repair and
 * never a row. That asymmetry is the rule this file runs on: reading is tolerant, rewriting is
 * not. */
function archiveWith (body, keep) {
  const f = newFile();
  const rows = [];
  for (let i = 1; i <= 5; i++) {
    rows.push(JSON.stringify({ v: 1, at: '2026-09-1' + i + ' 10:00:00', session: 's' + i, class: 'k-' + i, severity: 'note', finding: 'row ' + i, evidence: 'cmd' }));
  }
  fs.writeFileSync(f, rows.join(LF) + LF);
  const preload = path.join(path.dirname(f), 'inject.js');
  fs.writeFileSync(preload, [
    "const fs = require('fs');",
    "const src = process.env.PEER_SOURCE;",
    "const orig = fs.appendFileSync;",
    "let fired = false;",
    "fs.appendFileSync = function (p) {",
    "  const r = orig.apply(fs, arguments);",
    "  if (!fired && String(p) !== String(src)) { fired = true; " + body + " }",
    "  return r;",
    "};"
  ].join(LF) + LF);
  const env = Object.assign({}, process.env);
  delete env.CLAUDE_CODE_SESSION_ID;
  delete env.BOARD_HOME;
  env.PEER_SOURCE = f;
  const r = spawnSync(process.execPath, ['--require', preload, TOOL, 'archive', '--file', f, '--keep', String(keep || 2), '--write'], { encoding: 'utf8', env: env });
  return { file: f, code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

{
  const r = archiveWith("fs.unlinkSync(src);");
  ok('the source vanishing inside the window is refused rather than recreated from a stale snapshot', r.code === 2);
  ok('and it says it could not re-read, rather than reporting a successful archive', /CANNOT RE-READ/.test(r.out));
  ok('nothing is written back over the gap', fs.existsSync(r.file) === false);
  ok('and the rows are safe in the archive, which is why refusing here costs a repair and not a row',
    /"class":"k-1"/.test(readOrEmpty(r.file.replace(/\.jsonl$/, '-archive.jsonl'))));
}

{
  const r = archiveWith("require('fs').appendFileSync(src, 'half a written row {' + String.fromCharCode(10));");
  ok('a line that will not parse, appearing inside the window, refuses the rewrite', r.code === 1);
  ok('and names it as a line gained while it ran, which is what a crashed peer leaves behind',
    /gained 1 unparseable line/.test(r.out));
  ok('the damaged line is still there rather than being quietly dropped',
    /half a written row/.test(readOrEmpty(r.file)));
  ok('and every original row is still there too', /"class":"k-1"/.test(readOrEmpty(r.file)) && /"class":"k-5"/.test(readOrEmpty(r.file)));
}

const EXPECTED_ASSERTIONS = 107;
if (pass + fail !== EXPECTED_ASSERTIONS) {
  console.log('FAIL  the suite ran ' + (pass + fail) + ' assertion(s) and expects ' + EXPECTED_ASSERTIONS + '. A block was skipped or deleted. Find out which before you change the number.');
  fail++;
}

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
