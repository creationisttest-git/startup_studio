#!/usr/bin/env node
'use strict';
/*
 * Tests for check-gate-dispatch.js.
 *
 * Every assertion here has been watched failing, by breaking the checker and confirming this
 * suite goes red. A check nobody has seen fail is indistinguishable from one that always passes.
 *
 * The three answers are asserted separately and against each other, because the whole value of
 * this check is that NOT BEING ABLE TO LOOK and HAVING LOOKED AND FOUND NOTHING are different
 * verdicts. Collapsing them in either direction is the failure mode: one way a host that writes
 * no transcript blocks every release it can never satisfy, the other way a release with no
 * review of any kind sails through because the evidence was unreadable.
 *
 * Assertions state the REASON and not only the verdict wherever the tool prints one, because an
 * assertion on the exit code alone stays green when a different branch produces the same number.
 *
 * A FIXTURE'S NAMES MUST OPPOSE WHAT IT CLAIMS TO PROVE. The two sessions proving that the
 * NEWEST one is the one read were called old.jsonl and new.jsonl, and new sorts BEFORE old, so
 * the directory listing agreed with the modification times and any strategy satisfied both
 * assertions: replacing the comparison with take the first name listed left this suite at 38
 * passed, 0 failed. That is the only FALSE PASS this file has shipped and its consequence was
 * the worst of anything found in it, because a reviewer started in an OLDER session of the same
 * project then cleared the release at exit 0. The three sessions below are named so the newest
 * sorts in the MIDDLE: first-listed and last-listed each pick a different wrong file, and the
 * ordering is asserted from both directions, once where the reviewer is in the newest session
 * and once where it is in the other two.
 *
 * AND THE FIRST REPAIR OF THAT DEFECT ONLY OPPOSED THE ORDERING IT HAD JUST BEEN BURNT BY. The
 * names were fixed and the WRITE ORDER was not, so the newest file was still the last one
 * created, and selecting by creation time instead of modification time passed everything. A
 * review round measured it: birthtime 55 passed 0 failed, ctime 55 passed 0 failed. The newest
 * is now written SECOND as well as sorting second, so name order, creation order and
 * metadata-change order all disagree with modification order. Measured on the fixture as it
 * stands: birthtime 61 passed 4 failed, ctime 61 passed 4 failed, first-listed 61 passed 4
 * failed, last-listed 61 passed 4 failed. A fixture opposes EVERY incidental ordering it has,
 * not the one that has already caused an incident.
 *
 * A TRUNCATED FIXTURE LINE IS CUT AFTER subagent_type, NEVER BEFORE IT. The scan skips any line
 * that does not carry that word, so a shorter cut never reaches the parser and the guard against
 * a half-written record becomes load bearing with nothing able to prove it. The first version of
 * that fixture was cut early, and removing the guard entirely left this suite green. The guard
 * matters because a crash here exits 1, which is also the code for NO REVIEW RAN, so a regression
 * would refuse a release and send the reader to the wrong cause.
 *
 * AND A BAD RECORD IS PUT BEFORE A GOOD ONE WHENEVER THE CLAIM IS THAT THE SCAN CONTINUED. A
 * reviewer sitting before the break has already been counted by the time the break is reached,
 * so it cannot tell SKIPPING ONE LINE from ABANDONING THE FILE. The second version of the fixture
 * asserted continuation in exactly that unprovable order, and turning the skip into an abandon
 * left this suite green while a real mid-write transcript refused a release. Both orders are now
 * covered: the truncation last, which is the shape a host actually writes, and the truncation
 * first with a real reviewer after it, which is the only shape that can fail for that reason.
 *
 * WHICH GUARDS HAVE FIXTURES IS NO LONGER WRITTEN HERE, AND THAT IS THE MOST IMPORTANT LINE IN
 * THIS FILE. A paragraph used to stand in this place listing, by hand, which guards were proved
 * and which were knowingly not. THREE separate review rounds proved that paragraph false. It
 * claimed ONE unfixtured guard when there were three. Corrected, it claimed two races could not
 * be fixtured at all, on the strength of one API failing, and both were fixtured in about ten
 * lines each. It never mentioned a line reached only in production that no test had ever run, or
 * four branches whose deletion changed nothing at all. Being more careful was tried four times
 * and failed four times, because the person writing the claim is the person who wrote the code
 * and neither of them can see what they both missed.
 *
 * SO THE CLAIM IS DERIVED INSTEAD OF WRITTEN. tools/check-mutation-coverage.js deletes each line
 * of check-gate-dispatch.js in turn, runs this suite, and records whether anything went red. It
 * refuses in BOTH directions: a line nothing depends on that is not in the baseline fails, and a
 * baseline entry that has since become covered fails too, so an exemption cannot outlive its
 * reason the way this paragraph did. What a person still writes by hand is only the REASON a
 * line is allowed to be silent, which is a judgement and cannot be derived. Run it to see the
 * answer for the tree in front of you rather than the answer that was true when someone typed it.
 *
 * WHAT THAT METHOD CANNOT SEE, SAID HERE SO IT IS NOT OVERCLAIMED IN ITS TURN. It deletes whole
 * LINES, so it proves a line is load bearing and never that every expression on it is. A field
 * nobody reads, sitting on a line that also does the work, is invisible to it. And a deletion
 * that makes the file unparseable is a failed experiment rather than a pass (S112), which is why
 * it reports that count separately instead of folding it into either answer.
 *
 * HOW THE HARDER FIXTURES WORK, because the shape is the reusable part and none of it is a claim
 * about coverage. A plain FILE where the transcript directory belongs gives ENOTDIR: it exists,
 * so the existence check passes, and reading it fails. A DIRECTORY named s1.jsonl gives EISDIR:
 * it is listed, it ends in .jsonl, it stats cleanly, and only the read fails. A dangling entry,
 * which is what a session removed between the listing and the measurement leaves behind, is a
 * JUNCTION to a path that does not exist -- a plain symlink needs a privilege this account does
 * not hold and fails with WinError 1314, which an earlier version of this header read as proof
 * that the case could not be produced at all. Each of those took about a dozen lines after being
 * called impossible.
 *
 * AND THE EXIT CODE THAT MADE THEM WORTH BUILDING. Every one of those guards, removed, crashes
 * the check at exit 1. One is the code for NO REVIEW RAN. So an unguarded crash does not say the
 * gate could not look; it says it looked and found nobody had reviewed anything, refusing a
 * release and sending the reader to the wrong cause. The header used to argue the races were
 * safe to leave because they exited 3. Measured with the guard removed: exit 1, both of them.
 *
 * ONE FIXTURE IS WEAKER THAN IT LOOKS AND IT IS SAID HERE RATHER THAN LEFT TO BE FOUND. Removing
 * the content guard leaves the STRING fixture green, because a string is iterable: the scan walks
 * it character by character and the block-type test discards every character. So that fixture
 * proves the behaviour a real transcript produces and NOT the guard. What proves the guard is a
 * content that cannot be iterated: null, and the object fixture beside it, each of which throws
 * with the guard removed. The string case is kept because it is a shape the corpus really holds.
 *
 * THE CORPUS THE CONTENT GUARD IS JUSTIFIED BY, AND THE BOUNDARY IT WAS COUNTED ACROSS, which
 * two earlier derivations agreed on and both got wrong. What this tool reads is the top-level
 * transcripts of ONE project. Across those, 31 of them: 220 records carried the dispatch key, 0
 * unparseable, 201 holding content that was a list, and 19 that were not -- TWELVE carrying no
 * message object at all, SEVEN a bare string, ZERO null. The number published here before, 891
 * records across 96 transcripts, was counted across EVERY project on the machine, which is 99
 * transcripts and 935 records today. That wider corpus is a fair population for asking what
 * shapes exist, and it is not the population this check looks at, and the sentence never said
 * which one it meant (S104). The composition survives the correction intact: all 19 odd records
 * on the whole machine are in this project's transcripts, so the wider count adds 68 transcripts
 * and 715 records and not one new shape. An earlier version also published 8 null and 5 string,
 * which could not have fallen to zero in an append-only store and so was false when written.
 *
 * THE PAIR, which is the one thing a single deletion genuinely cannot prove, and the reason
 * published here before was backwards. The key prefilter and the record-is-truthy test cannot be
 * proved apart. The PREFILTER is what makes the truthiness test unreachable, not the other way
 * round: a line has to carry the dispatch key to reach the parser, and no line carrying it parses
 * to null. Remove the prefilter alone, 65 passed 0 failed. Remove the truthiness test alone, 65
 * passed 0 failed. Remove BOTH and the bare-null fixture below crashes the check at exit 1, 63
 * passed 2 failed. It is said out loud so a reader who deletes one on the strength of one
 * sentence does not then delete the other on the strength of the next, and the prefilter is
 * carried in the mutation baseline with exactly that reason attached.
 *
 * A FIXTURE IS A FAKE HOME PLUS A FAKE PROJECT ROOT, so the tool derives the transcript
 * directory itself rather than being handed one. That derivation is the part most likely to
 * break, and a fixture pointing straight at a directory would never exercise it. The derivation
 * itself is then held to a LITERAL below rather than to the function under test, because an
 * expectation built by calling the thing it checks agrees with any answer that thing gives.
 *
 * TWO ASSERTIONS HERE EXIST BECAUSE THE OBVIOUS ONE COULD NOT FAIL. A record whose role is not
 * a string is asserted on a fixture where a REAL reviewer follows it, because a crash and a
 * clean refusal both leave exit 1 and only a later record that must still be found tells them
 * apart. And resolving a relative root is asserted on a relative path, because the two slash
 * shapes land on the same character whether the path was resolved or not, so the slash
 * assertion stays green with the resolving removed.
 */
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TOOL = path.join(__dirname, 'check-gate-dispatch.js');
// Used IN PROCESS, so it is wrapped at the CALL and not only at the require. A mutation can leave
// the module loading and make this throw when it runs, here during test SETUP rather than inside
// an assertion, so an unwrapped suite dies and prints no count. Five lines read as CRASHED that
// way, one of them the definition of what counts as a review. Returning a wrong-but-usable name
// lets the fixtures build and turns the same mutation into ordinary red assertions. S127. The
// fallback must be a legal directory name, because callers join it into a real path.
let loaded = null;
try {
  loaded = require('./check-gate-dispatch.js').projectDirName;
} catch (e) {
  loaded = null;
}
// Returning no usable name is the same fault as throwing, arriving the same way: a removed return
// leaves undefined and breaks the path join in setup. Both fold into a wrong name so the suite
// keeps reporting and the assertions below do the judging.
function projectDirName (root) {
  if (!loaded) return 'tool-did-not-load';
  let v;
  try {
    v = loaded(root);
  } catch (e) {
    return 'tool-threw-when-called';
  }
  return typeof v === 'string' && v ? v : 'tool-returned-no-name';
}
let pass = 0, fail = 0;
function ok (name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL  ' + name); } }

const junk = [];
let n = 0;

// EVERY FIXTURE ROOT IS A GIT REPOSITORY, AND ITS FIRST COMMIT IS DATED BEFORE THE DISPATCH.
// The tree half asks git what has landed since the LATEST qualifying reviewer was dispatched, so a bare
// temp directory answers "not a repository" and every one of the twenty-two assertions that
// expect a PASS would have gone advisory instead. They were RESTATED rather than loosened
// (S134): they need a project that looks like a project, and they were never about git.
// The date is fixed and earlier than dispatch()'s fixed timestamp, so nothing here depends on
// what the clock says while the suite runs, which is the defect that makes a suite pass in the
// morning and fail at night.
const BEFORE_DISPATCH = '2026-09-01T00:00:00Z';
function git (root, args, at) {
  const env = Object.assign({}, process.env, {
    GIT_AUTHOR_DATE: at || BEFORE_DISPATCH,
    GIT_COMMITTER_DATE: at || BEFORE_DISPATCH,
    GIT_CONFIG_GLOBAL: path.join(root, 'no-such-gitconfig'),
    GIT_CONFIG_SYSTEM: path.join(root, 'no-such-gitconfig')
  });
  return spawnSync('git', ['-C', root, '-c', 'user.name=fixture', '-c', 'user.email=f@x',
    '-c', 'commit.gpgsign=false'].concat(args), { encoding: 'utf8', env: env, windowsHide: true });
}
// A commit landing at a stated moment, for the fixtures about the tree moving under a review.
function commitAt (w, at, subject) {
  fs.writeFileSync(path.join(w.root, 'moved-' + (n++) + '.txt'), subject + '\n', 'utf8');
  git(w.root, ['add', '-A'], at);
  return git(w.root, ['commit', '-m', subject], at);
}
function world () {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-dispatch-' + process.pid + '-' + (n++) + '-'));
  junk.push(d);
  const home = path.join(d, 'home');
  const root = path.join(d, 'work');
  fs.mkdirSync(root, { recursive: true });
  git(root, ['init', '-q']);
  fs.writeFileSync(path.join(root, 'seed.txt'), 'seed\n', 'utf8');
  git(root, ['add', '-A']);
  git(root, ['commit', '-q', '-m', 'seed']);
  return { dir: d, home: home, root: root };
}
function transcriptDir (w) {
  const p = path.join(w.home, '.claude', 'projects', projectDirName(w.root));
  fs.mkdirSync(p, { recursive: true });
  return p;
}
// A DEFAULT PROMPT THAT SATISFIES THE METHOD MARKER, so the twenty-seven assertions about
// something else entirely -- truncated lines, tool renames, null content, flag fallbacks -- go
// on testing what they are named for rather than the marker. Every one of them went red when the
// marker landed and every one was RESTATED rather than deleted (S134): they need A PASSING
// DOCTOR, they were never about how the doctor qualifies. The marker gets its own fixtures
// below, where the prompt is stated explicitly in both directions.
function dispatch (role, prompt, at) {
  const p = prompt === undefined
    ? (role === 'doctor' ? 'method review of this session' : 'review the change')
    : prompt;
  return JSON.stringify({
    type: 'assistant',
    timestamp: at === undefined ? '2026-09-06T04:00:09.953Z' : at,
    message: { content: [{ type: 'tool_use', name: 'Agent', input: { subagent_type: role, prompt: p } }] }
  });
}
function world_with (w, lines) { session(w, 's1', lines); return w; }
function session (w, name, lines, mtime) {
  const p = path.join(transcriptDir(w), name + '.jsonl');
  fs.writeFileSync(p, lines.join('\n') + '\n', 'utf8');
  if (mtime) fs.utimesSync(p, mtime, mtime);
  return p;
}
// An entry that is LISTED and cannot be STAT-ed. Junction first, then symlink; the caller is told
// which, because a fixture that silently does not exist is worse than one that fails. See header.
function dangling (dir, name) {
  const link = path.join(dir, name);
  const gone = path.join(dir, 'target-that-was-removed');
  for (const type of ['junction', 'file']) {
    try { fs.symlinkSync(gone, link, type); return true; } catch (e) { continue; }
  }
  return false;
}
// A fixture must NAME the session it is pretending to be, because the tool asks the host which
// session is running rather than ranking transcripts by modification time. s1 is the default
// because world_with writes exactly that; cases about choosing BETWEEN sessions pass their own.
function baseEnv () {
  const e = Object.assign({}, process.env);
  delete e.CLAUDE_CODE_SESSION_ID;
  return e;
}
function run (w, extra, id) {
  const args = [TOOL, '--root', w.root, '--home', w.home].concat(extra || []);
  const env = Object.assign(baseEnv(), { CLAUDE_CODE_SESSION_ID: id === undefined ? 's1' : id });
  try {
    return { code: 0, out: execFileSync('node', args, { stdio: ['pipe', 'pipe', 'pipe'], env: env }).toString() };
  } catch (e) {
    return { code: e.status, out: ((e.stdout || '') + (e.stderr || '')).toString() };
  }
}

// --- a review agent was started: the half that announces a check gone paranoid ----------------
{
  const w = world();
  session(w, 's1', [dispatch('code-reviewer'), dispatch('doctor')]);
  const r = run(w);
  ok('a session that started a reviewer passes', r.code === 0);
  ok('and it names which reviewer, so the row is worth reading', /code-reviewer 1/.test(r.out));
  ok('and it says what it does NOT prove, in the output a person actually sees',
    /never that they passed/.test(r.out));
}

// --- looked, and found nothing: this one refuses ----------------------------------------------
{
  const w = world();
  session(w, 's1', [dispatch('pm'), dispatch('tech-lead')]);
  const r = run(w);
  ok('a session that started only non-reviewers refuses', r.code === 1);
  ok('and it refuses for the stated reason rather than by failing to look',
    /NO REVIEW RAN/.test(r.out));
  ok('and it counts the agents it did find, so the reader can tell it looked',
    /2 agent\(s\) started/.test(r.out));
  ok('and it says which roles WOULD have counted, so the refusal is actionable rather than final',
    /A reviewer is one of/.test(r.out) && /qa-tester/.test(r.out));
  ok('and it stops there rather than falling through and refusing a second time for another reason',
    !/NO PRODUCT REVIEW RAN/.test(r.out) && !/NO METHOD REVIEW RAN/.test(r.out));
}
{
  const w = world();
  session(w, 's1', [JSON.stringify({ type: 'user', message: { content: 'hello' } })]);
  const r = run(w);
  ok('a session that started nothing at all refuses too', r.code === 1);
  ok('and it says zero rather than reporting that it could not look', /0 agent\(s\) started/.test(r.out));
}

// --- could not look: advisory, and it must NOT be either of the two above ---------------------
{
  const w = world();
  const r = run(w);
  ok('no transcript directory is advisory, not a refusal', r.code === 3);
  ok('and it says it cannot tell rather than that no review ran', /CANNOT TELL/.test(r.out));
  ok('and it gives THIS reason and not the one the next guard along would give, which is what '
    + 'kept the existence check silent under mutation',
    /no transcript directory for this project/.test(r.out));
  ok('and it prints the directory it looked in, which is the only way to check the derivation',
    r.out.indexOf(projectDirName(w.root)) !== -1);
}
{
  const w = world();
  transcriptDir(w);
  const r = run(w);
  ok('a transcript directory holding no session is advisory', r.code === 3);
  ok('and it names that as the reason', /holds no session/.test(r.out));
}
{
  const w = world();
  fs.writeFileSync(path.join(transcriptDir(w), 'notes.txt'), 'not a session', 'utf8');
  const r = run(w);
  ok('a directory holding no .jsonl is advisory rather than a pass', r.code === 3);
}
{
  // ENOTDIR, on a path that exists so every guard before the read is satisfied. See the header.
  const w = world();
  const projects = path.join(w.home, '.claude', 'projects');
  fs.mkdirSync(projects, { recursive: true });
  fs.writeFileSync(path.join(projects, projectDirName(w.root)), 'not a directory', 'utf8');
  const r = run(w);
  ok('a FILE where the transcript directory belongs is advisory, not a refusal', r.code === 3);
  ok('and it says the directory could not be read rather than that no review ran',
    /directory could not be read/.test(r.out) && !/NO REVIEW RAN/.test(r.out));
}
{
  // EISDIR: listed, ends in .jsonl, stats cleanly, and only the read fails. See the header.
  const w = world();
  fs.mkdirSync(path.join(transcriptDir(w), 's1.jsonl'), { recursive: true });
  const r = run(w);
  ok('a session that cannot be READ is advisory, not a refusal', r.code === 3);
  ok('and it says the session could not be read, which is the reason a reader needs',
    /session could not be read/.test(r.out) && !/NO REVIEW RAN/.test(r.out));
}
{
  // THE FIRST RACE, and it was called impossible to fixture twice. See the header.
  const w = world();
  const made = dangling(transcriptDir(w), 'a-vanished.jsonl');
  session(w, 'z-real', [dispatch('qa-tester'), dispatch('doctor')]);
  const r = run(w, [], 'z-real');
  ok('a session listed and then gone before it can be measured is skipped rather than fatal',
    made && r.code === 0);
  ok('and the real session beside it is still the one read, so the skip did not lose the answer',
    /qa-tester 1/.test(r.out) && /z-real\.jsonl/.test(r.out));
}
{
  // THE SECOND RACE: every entry gone, so there is nothing left to measure. See the header.
  const w = world();
  const d = transcriptDir(w);
  const made = dangling(d, 's1.jsonl') && dangling(d, 's2.jsonl');
  const r = run(w);
  ok('a directory where NO session can be measured is advisory, not a refusal',
    made && r.code === 3);
  ok('and it says the session could not be read rather than that no review ran',
    /could not be read/.test(r.out) && !/NO REVIEW RAN/.test(r.out));
  ok('and it stops there rather than falling through and saying it cannot tell a second time',
    (r.out.match(/CANNOT TELL/g) || []).length === 1);
}

// --- the exported main returns a value, and that value is not the exit code ------------------
// ST-141 round seven M2. The final `return 0` was accepted as SILENT on the written reason that
// no input can tell 0 from undefined, because process.exit(undefined) also exits 0. That reason
// was false from the moment main was exported: called in process the return VALUE is readable,
// and 0 and undefined are different values. An exemption is a claim, and this one was never run.
// Both calls are wrapped, because a mutant that throws would otherwise kill the whole suite and
// be counted as unmeasurable rather than as red, which is S127 and cost a whole derivation once.
{
  const w = world();
  session(w, 's1', [dispatch('code-reviewer'), dispatch('doctor')]);
  // In process, so the stripping done for children does not apply and the real id would name a
  // transcript outside the fixture. Restored afterwards whatever happens, because every case
  // below shares this process.
  const realId = process.env.CLAUDE_CODE_SESSION_ID;
  process.env.CLAUDE_CODE_SESSION_ID = 's1';
  let rv = 'threw';
  try { rv = require('./check-gate-dispatch.js').main(['--root', w.root, '--home', w.home, '--quiet']); }
  catch (e) { rv = 'threw'; }
  ok('the exported main RETURNS zero on a pass rather than only exiting zero', rv === 0);

  const w2 = world();
  session(w2, 's1', [dispatch('pm')]);
  let rv2 = 'threw';
  try { rv2 = require('./check-gate-dispatch.js').main(['--root', w2.root, '--home', w2.home, '--quiet']); }
  catch (e) { rv2 = 'threw'; }
  finally {
    if (realId === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
    else process.env.CLAUDE_CODE_SESSION_ID = realId;
  }
  ok('and it returns one when it refuses, so the two are told apart by value and not by exit code',
    rv2 === 1);
}

// --- a reviewer is TWO kinds, and one of each is required -------------------------------------
// The doctor reads the METHOD and never the diff, so it can never stand in for the five that
// read the WORK, and the five say nothing about whether the studio's own process was followed.
// The published page draws six Gate tiles; this is the half that makes the six true. ST-156.
{
  const w = world();
  session(w, 's1', [dispatch('code-reviewer'), dispatch('security-reviewer')]);
  const r = run(w);
  // The claim is unchanged and the consequence is not. The tool still separates a session that
  // reviewed the work from one that also reviewed the method; 4 says so without refusing.
  ok('a session that reviewed the WORK and not the METHOD is reported, and does not refuse',
     r.code === 4);
  ok('and it says which half is missing rather than that no review ran at all',
    /NO METHOD REVIEW RAN/.test(r.out) && !/NO REVIEW RAN/.test(r.out));
  ok('and it names what to start, so the refusal is actionable rather than final',
    /doctor/.test(r.out));
  ok('and it still names what DID run, so the reader can tell it looked',
    /code-reviewer 1/.test(r.out) && /security-reviewer 1/.test(r.out));
  ok('and it names the session it read, which is the only way to check it read the right one',
    /Session: s1\.jsonl/.test(r.out));
}
{
  const w = world();
  session(w, 's1', [dispatch('doctor')]);
  const r = run(w);
  ok('a session that reviewed the METHOD and not the WORK refuses, which is the whole reason '
    + 'the doctor is held in its own list', r.code === 1);
  ok('and it says the work was not read rather than reporting a clean gate',
    /NO PRODUCT REVIEW RAN/.test(r.out));
  ok('and it names the five that would have counted, none of them the doctor',
    /code-reviewer/.test(r.out) && !/Start one of: [^\n]*doctor/.test(r.out));
  ok('and this branch names the session it read too, so neither refusal loses the file',
    /Session: s1\.jsonl/.test(r.out));
}
{
  const w = world();
  session(w, 's1', [dispatch('mobile-qa'), dispatch('doctor')]);
  const r = run(w);
  ok('one of each passes, and that is the only shape that does', r.code === 0);
  ok('and it names both, so the row says which six the page means',
    /mobile-qa 1/.test(r.out) && /doctor 1/.test(r.out));
}

// --- the session the HOST names is the one that is read ---------------------------------------
// Sorts second AND is written second, so name, creation and metadata order all disagree with
// modification order. That opposition used to prove mtime won; it now proves the id does, which
// is a stronger claim from the same fixture: every other ranking points at a different file.
// Both directions are asserted, and the no-id case is asserted too, because falling back to the
// newest file is the defect and a fallback would be invisible in a fixture with one session.
{
  const w = world();
  session(w, 'a-oldest', [dispatch('qa-tester')], 1000000);
  session(w, 'm-newest', [dispatch('pm')], 3000000);
  session(w, 'z-middle', [dispatch('code-reviewer')], 2000000);
  const r = run(w, [], 'm-newest');
  ok('a reviewer in ANOTHER session does not clear the one being measured', r.code === 1);
  ok('and the session it read is the one the host named, not the first or last listed',
    /m-newest\.jsonl/.test(r.out));
  const older = run(w, [], 'a-oldest');
  // THE VERDICT IS NOT THE CLAIM HERE, and asserting it would hide the one that is: a-oldest
  // carries a qa-tester and no doctor, so it refuses whichever file is read. What is asserted
  // is WHICH FILE was read, and that it is not the one every incidental order points at.
  ok('and naming the OLDEST file reads that one, though it is newest by nothing',
    /a-oldest\.jsonl/.test(older.out) && !/m-newest\.jsonl/.test(older.out));
  const nameless = run(w, [], '');
  ok('with no session id it is CANNOT TELL at 3 and never a silent fall back to the newest file',
    nameless.code === 3 && /CANNOT TELL/.test(nameless.out));
  // THE SAME LINES, REPORTED SILENT BY THE SAME HARNESS, ASSERTED HERE RATHER THAN BASELINED.
  // The last of them is the one that matters most: delete the return and control carries on with
  // no file, dispatchesIn produces its own CANNOT TELL, and the exit code is 3 either way, so
  // nothing but a count of the message can tell a returned refusal from a fallen-through one.
  ok('and it says it will not guess the session from the newest file',
    /deliberately NOT/.test(nameless.out));
  ok('and it prints WHERE it looked, because the derivation is the likeliest thing to be wrong',
    /Looked in:/.test(nameless.out));
  ok('and it says CANNOT TELL exactly ONCE, so the refusal returned rather than falling through',
    (nameless.out.match(/CANNOT TELL/g) || []).length === 1);
  const gone = run(w, [], 'a-session-that-is-not-here');
  ok('a session id naming no transcript here says no verdict is offered, and stops there',
    gone.code === 3 && /no verdict is offered/.test(gone.out) &&
    (gone.out.match(/CANNOT TELL/g) || []).length === 1);
}
{
  const w = world();
  session(w, 'a-oldest', [dispatch('pm')], 1000000);
  session(w, 'm-newest', [dispatch('mobile-qa'), dispatch('doctor')], 3000000);
  session(w, 'z-middle', [dispatch('tech-lead')], 2000000);
  const r = run(w, [], 'm-newest');
  ok('and a reviewer in the NAMED session passes, so the rule is a rule and not an accident',
    r.code === 0);
  ok('and that pass names the session it read too, so it passed for the right file',
    /m-newest\.jsonl/.test(r.out));
}

// --- shapes the host really produces ----------------------------------------------------------
{
  const w = world();
  session(w, 's1', [dispatch('security-reviewer'), '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Task","input":{"subagent_type":"code-rev', dispatch('doctor')]);
  const r = run(w);
  ok('a half-written last line is skipped rather than crashing the check', r.code === 0);
  ok('and nothing about the failure reaches the reader as an error', !/SyntaxError/.test(r.out));
}
{
  const w = world();
  session(w, 's1', ['{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Task","input":{"subagent_type":"code-rev', dispatch('security-reviewer'), dispatch('doctor')]);
  const r = run(w);
  ok('a half-written line does not stop the scan finding a reviewer AFTER it', r.code === 0);
  ok('and that reviewer is the one counted, so a bad record is skipped and not the rest of the file',
    /security-reviewer 1/.test(r.out));
}
{
  const w = world();
  session(w, 's1', [JSON.stringify({
    type: 'assistant',
    timestamp: '2026-09-06T04:00:09.953Z',
    message: { content: [{ type: 'tool_use', name: 'Task', input: { subagent_type: 'content-reviewer' } }] }
  }), dispatch('doctor')]);
  ok('the older name for the dispatch tool is recognised, so a rename is not a silent miss',
    run(w).code === 0);
}
{
  const w = world();
  session(w, 's1', [JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: 'Bash', input: { subagent_type: 'code-reviewer' } }] }
  })]);
  const rNotTool = run(w);
  ok('a tool that is not the dispatch tool does not count as a review, whatever it carries',
    rNotTool.code === 1 && /NO REVIEW RAN/.test(rNotTool.out) && /0 agent\(s\) started/.test(rNotTool.out));
}
{
  const w = world();
  session(w, 's1', [JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'tool_result', name: 'Agent', input: { subagent_type: 'qa-tester' } }] }
  })]);
  const r = run(w);
  ok('a block that is not a tool USE does not count, even carrying the dispatch tool and a role',
    r.code === 1);
  ok('and it is not counted as an agent started either', /0 agent\(s\) started/.test(r.out));
}
{
  const w = world();
  session(w, 's1', [JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: 'Agent', input: { subagent_type: '' } }] }
  })]);
  const r = run(w);
  ok('a dispatch carrying an EMPTY role is not counted as an agent at all',
    r.code === 1 && /0 agent\(s\) started/.test(r.out));
}
{
  // THE PAIR: this goes red only when BOTH guards are gone. See the header.
  const w = world();
  session(w, 's1', ['null', dispatch('qa-tester'), dispatch('doctor')]);
  const r = run(w);
  ok('a bare null line is skipped and the reviewer after it is still found', r.code === 0);
  ok('and nothing about it reaches the reader as an error', !/TypeError/.test(r.out));
}
{
  const w = world();
  const nullContent = JSON.stringify({
    type: 'assistant',
    message: { content: null },
    toolUseResult: { subagent_type: 'code-reviewer' }
  });
  session(w, 's1', [nullContent, dispatch('qa-tester'), dispatch('doctor')]);
  const r = run(w);
  ok('a record whose content is null is skipped, not walked, so the scan survives it', r.code === 0);
  ok('and the reviewer after it is still counted', /qa-tester 1/.test(r.out));
}
{
  const w = world();
  const stringContent = JSON.stringify({
    type: 'assistant',
    message: { content: 'a plain string mentioning subagent_type in prose' }
  });
  session(w, 's1', [stringContent, dispatch('qa-tester'), dispatch('doctor')]);
  const r = run(w);
  ok('a record whose content is a string is skipped the same way', r.code === 0);
  ok('and the reviewer after THAT is still counted', /qa-tester 1/.test(r.out));
}
{
  // NOT iterable, which is what makes the content guard provable. See the header.
  const w = world();
  const objectContent = JSON.stringify({
    type: 'assistant',
    message: { content: { subagent_type: 'code-reviewer' } }
  });
  session(w, 's1', [objectContent, dispatch('qa-tester'), dispatch('doctor')]);
  const r = run(w);
  ok('a record whose content is an OBJECT is skipped rather than walked', r.code === 0);
  ok('and the reviewer after it is still counted, so the file was not abandoned',
    /qa-tester 1/.test(r.out));
}
{
  const w = world();
  session(w, 's1', [JSON.stringify({
    type: 'assistant',
    timestamp: '2026-09-06T04:00:09.953Z',
    message: { content: [null, { type: 'tool_use', name: 'Agent', input: { subagent_type: 'qa-tester' } }] }
  }), dispatch('doctor')]);
  const r = run(w);
  ok('an empty block inside the content array does not stop the blocks after it', r.code === 0);
}
{
  const w = world();
  session(w, 's1', [JSON.stringify({
    type: 'assistant',
    timestamp: '2026-09-06T04:00:09.953Z',
    message: {
      content: [
        { type: 'tool_use', name: 'Agent' },
        { type: 'tool_use', name: 'Agent', input: { subagent_type: 'qa-tester' } }
      ]
    }
  }), dispatch('doctor')]);
  const r = run(w);
  ok('a dispatch block carrying no input at all is skipped rather than crashing the scan', r.code === 0);
}
{
  const w = world();
  const odd = JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: 'Agent', input: { subagent_type: ['qa-tester'] } }] }
  });
  const r = run(world_with(w, [odd]));
  ok('a subagent_type that is not a string is not counted as an agent', /0 agent\(s\) started/.test(r.out));
  const w2 = world();
  session(w2, 's1', [odd, dispatch('qa-tester'), dispatch('doctor')]);
  const r2 = run(w2);
  ok('and an odd record does not stop the scan finding a real reviewer after it', r2.code === 0);
  ok('and the real one is the one counted', /qa-tester 1/.test(r2.out));
}

// --- the derivation, held to a literal rather than to itself ----------------------------------
{
  ok('the transcript directory name replaces every character that is not a letter or a digit',
    projectDirName('C:/Users/someone/AI Projects/_STUDIO').endsWith('C--Users-someone-AI-Projects--STUDIO'));
  ok('and a backslash path derives the same name as a forward slash one',
    projectDirName('C:\\Users\\someone\\AI Projects\\_STUDIO') === projectDirName('C:/Users/someone/AI Projects/_STUDIO'));
  ok('and a relative root derives the same name as the absolute one it points at',
    projectDirName('.') === projectDirName(process.cwd()));
}

// --- usage ------------------------------------------------------------------------------------
{
  const w = world();
  const args = [TOOL, '--root', path.join(w.dir, 'gone'), '--home', w.home];
  let code = 0, out = '';
  try { execFileSync('node', args, { stdio: ['pipe', 'pipe', 'pipe'] }); }
  catch (e) { code = e.status; out = ((e.stdout || '') + (e.stderr || '')).toString(); }
  ok('a root that does not exist is a usage error and not a verdict about reviews', code === 2);
  ok('and it names the directory it could not find, because a usage error nobody can act on is one',
    /no such directory/.test(out) && out.indexOf('gone') !== -1);
}
{
  const w = world();
  session(w, 's1', [dispatch('pm'), dispatch('qa-tester')]);
  const r = run(w, ['--list']);
  ok('--list names every agent the session started, not only the reviewers', /pm/.test(r.out) && /qa-tester/.test(r.out));
}
{
  // A flag typed last used to answer about the working directory instead. See the header.
  const w = world();
  let code = 0, out = '';
  try { execFileSync('node', [TOOL, '--home', w.home, '--root'], { stdio: ['pipe', 'pipe', 'pipe'] }); }
  catch (e) { code = e.status; out = ((e.stdout || '') + (e.stderr || '')).toString(); }
  ok('a flag with nothing after it is a usage error, not a verdict about the working directory',
    code === 2);
  ok('and it names which flag is missing its value', /--root needs a directory/.test(out));
}
{
  const w = world();
  let code = 0;
  try { execFileSync('node', [TOOL, '--root', w.root, '--home', '--quiet'], { stdio: ['pipe', 'pipe', 'pipe'] }); }
  catch (e) { code = e.status; }
  ok('and a flag that would swallow the NEXT flag as its value is refused the same way', code === 2);
}
{
  // THE SHAPE PRODUCTION ACTUALLY USES, which until this existed nothing exercised. See header.
  const w = world();
  session(w, 's1', [dispatch('qa-tester'), dispatch('doctor')]);
  const env = Object.assign(baseEnv(), { USERPROFILE: w.home, HOME: w.home, CLAUDE_CODE_SESSION_ID: 's1' });
  let code = 0, out = '';
  try { out = execFileSync('node', [TOOL, '--root', w.root], { env: env, stdio: ['pipe', 'pipe', 'pipe'] }).toString(); }
  catch (e) { code = e.status; out = ((e.stdout || '') + (e.stderr || '')).toString(); }
  ok('with --home omitted the home directory falls back to the real one, which is the only shape the release set uses',
    code === 0 && /qa-tester 1/.test(out));
}
{
  // The other half of the same fallback line.
  const w = world();
  session(w, 's1', [dispatch('code-reviewer'), dispatch('doctor')]);
  let code = 0, out = '';
  try { out = execFileSync('node', [TOOL, '--home', w.home], { cwd: w.root, stdio: ['pipe', 'pipe', 'pipe'], env: Object.assign(baseEnv(), { CLAUDE_CODE_SESSION_ID: 's1' }) }).toString(); }
  catch (e) { code = e.status; out = ((e.stdout || '') + (e.stderr || '')).toString(); }
  ok('and with --root omitted the project root falls back to the working directory',
    code === 0 && /code-reviewer 1/.test(out));
}
{
  const w = world();
  session(w, 's1', [dispatch('qa-tester'), dispatch('doctor')]);
  const r = run(w, ['--quiet']);
  ok('--quiet says nothing at all on a pass, because the gate prints its own row',
    r.code === 0 && r.out === '');
}
{
  const w = world();
  session(w, 's1', [dispatch('pm')]);
  const r = run(w, ['--quiet']);
  ok('but --quiet still speaks when it REFUSES, because a refusal nobody can read is not one',
    r.code === 1 && /NO REVIEW RAN/.test(r.out));
}

// --- the method half needs the PROMPT as well as the NAME ------------------------------------
// The board's focus rule gives the method role a second job, reporting in-flight breaches. From
// that moment the
// NAME stops meaning "a method review happened", because the same name now covers an errand. The
// marker sits on the REVIEW and not on the errand so a forgotten marker refuses rather than
// clears: a gate that fails open on an omission is the hole this closes, not a fix for it.
// Mutation that proves the pair: drop the .filter on METHOD_REVIEW_MARKER in main() and the
// errand assertions below go red while every other assertion in this file stays green.
{
  const w = world();
  session(w, 's1', [dispatch('code-reviewer'), dispatch('doctor', 'report the WIP breaches on the board')]);
  const r = run(w);
  // 4, not 1. The method half is ADVISORY now: this branch still fires and still names the
  // errand, and what changed is that it reports rather than refusing a release.
  ok('a doctor started ONLY for an errand does not satisfy the method half', r.code === 4);
  ok('and it says the doctor WAS started, so the reader is not sent hunting for a defect in the tool',
    /doctor was started 1 time\(s\)/.test(r.out));
  ok('and it calls that dispatch an ERRAND rather than a missing agent',
    /ERRAND/.test(r.out));
  // WHICH TRANSCRIPT WAS READ IS A FACT AND NOT ADVICE, so unlike the explanatory lines around it
  // this one is asserted. A reader told a review is missing has to be able to check the session
  // the tool actually looked at: this project keeps several transcripts per day and reading the
  // wrong one is the worst false pass this file has ever shipped. Deleting the line left the suite
  // green until this existed.
  ok('and it names the transcript it read, so the reader can check the right session',
    new RegExp('Session: ' + 's1\\.jsonl').test(r.out));
  // RESTATED, NOT DELETED (S134). This assertion encoded the first remedy, which told the reader to
  // put the phrase anywhere in the prompt. That remedy was itself the hole: an errand disclaiming
  // the phrase cleared the gate, so the fix had to name WHERE the phrase goes.
  ok('and it names the remedy precisely enough to be followed, which means naming the FIRST LINE',
    /Open the FIRST LINE of that prompt/.test(r.out) && /"method review"/.test(r.out));
  ok('and it does NOT tell them to start a doctor they can see they already started',
    !/Start one of: doctor/.test(r.out));
}
{
  const w = world();
  session(w, 's1', [dispatch('code-reviewer'), dispatch('doctor', 'do a method review of this session')]);
  const r = run(w);
  ok('a doctor asked for a method review satisfies the method half', r.code === 0);
}
{
  const w = world();
  session(w, 's1', [dispatch('code-reviewer'), dispatch('doctor', 'METHOD REVIEW: did we follow the process')]);
  const r = run(w);
  ok('the marker is case-insensitive, because a prompt written in capitals is still the ask',
    r.code === 0);
}
{
  // The realistic shape once the doctor has two jobs: it is dispatched for both in one session.
  const w = world();
  session(w, 's1', [dispatch('code-reviewer'),
    dispatch('doctor', 'report the WIP breaches'),
    dispatch('doctor', 'method review before the release')]);
  const r = run(w);
  ok('an errand and a review in the same session passes, because the review is what is required',
    r.code === 0);
}
{
  // FAIL CLOSED, stated as its own assertion because it is the whole design choice. A dispatch
  // carrying no prompt at all is the shape every fixture in this file had before the split, and
  // reading it as a review would mean the marker could be skipped by omitting a field.
  const w = world();
  session(w, 's1', [dispatch('code-reviewer'), dispatch('doctor', '')]);
  const r = run(w);
  ok('a doctor dispatch with NO prompt is an errand and not a review, so the marker fails closed',
    r.code === 4 && /ERRAND/.test(r.out));
}
{
  const w = world();
  session(w, 's1', [dispatch('code-reviewer'), dispatch('security-reviewer')]);
  const r = run(w);
  ok('with no doctor at all the message is the OTHER one, naming what to start',
    r.code === 4 && /Start one of: doctor/.test(r.out) && !/ERRAND/.test(r.out));
  ok('and that message now names the marker too, so following it actually clears the gate',
    /open its prompt with "method review"/.test(r.out));
}
{
  // THE HOLE THE FIRST VERSION OF THIS MARKER LEFT OPEN, found by the method reviewer it was built
  // for. A substring match cannot tell a MENTION from an ASK, and the more conscientious the author
  // the more likely they trip it: an errand prompt that carefully disclaims itself contains the
  // phrase, so the disclaimer cleared the gate. All three of these counted as a method review
  // before the first-line-and-not-negated rule went in.
  const disclaimed = [
    'Report the in-flight breach. This is an errand, NOT a method review.',
    'You are being dispatched for a WIP breach report, not for a method review.',
    'Report breaches. Do not do a method review.'
  ];
  disclaimed.forEach((prompt, i) => {
    const w = world();
    session(w, 's1', [dispatch('code-reviewer'), dispatch('doctor', prompt)]);
    const r = run(w);
    ok('an errand that DISCLAIMS being a method review is still an errand (' + (i + 1) + ' of 3)',
       r.code === 4 && /ERRAND/.test(r.out));
  });
}
{
  // WHERE the phrase sits is the other half of the rule. A prompt says what it is for on its first
  // line; a mention three paragraphs down is a mention.
  const w = world();
  session(w, 's1', [dispatch('code-reviewer'),
    dispatch('doctor', 'Report the WIP breaches on the board.\nWhile you are there, a method review would be nice.')]);
  const r = run(w);
  ok('the phrase buried below the first line does not make an errand a review',
     r.code === 4 && /ERRAND/.test(r.out));
}
{
  const w = world();
  session(w, 's1', [dispatch('code-reviewer'),
    dispatch('doctor', 'Do a method review of this session.\nDo NOT fix anything you find.')]);
  const r = run(w);
  ok('but a negation AFTER the ask is just an instruction, and the review still counts',
     r.code === 0);
}
{
  // A count alone stopped being an answer the moment the name had two jobs, and --list is the one
  // command a person runs to find out what a session started.
  const w = world();
  session(w, 's1', [dispatch('qa-tester'),
    dispatch('doctor', 'report the WIP breaches'),
    dispatch('doctor', 'method review before the release')]);
  const r = run(w, ['--list']);
  ok('--list says how many doctor dispatches were reviews and how many were errands',
     /doctor\s+\(1 asked for a method review, 1 errand\)/.test(r.out));
  ok('and it does not break down the product reviewers, for whom the name is still the whole answer',
     !/qa-tester.*asked for a method review/.test(r.out) && /qa-tester/.test(r.out));
}
{
  // The marker is the METHOD half's rule and nothing else's. A product reviewer asked to do
  // anything at all still counts, or this split would have quietly tightened the other half.
  const w = world();
  session(w, 's1', [dispatch('qa-tester', 'check the login flow'), dispatch('doctor')]);
  const r = run(w);
  ok('a product reviewer needs no marker, because the marker exists for the name with two jobs',
    r.code === 0);
}

/* --- the marker predicate called directly, which nothing did -----------------------------
   asksForMethodReview is exported and every case above reaches it through a whole transcript,
   so its own type guard was proved by nothing: deleting that line left this suite at 98 passed
   0 failed while the function throws on any prompt that is not a string. The guard is reachable
   in production, because the prompt comes out of a transcript record where the field can be
   missing, null or a number, so it is asserted rather than deleted.

   EACH CALL IS WRAPPED AND THE VERDICT IS WHAT IS ASSERTED, not the absence of a crash. An
   uncaught throw here would kill the whole suite and report no count at all, which reads as a
   dead run rather than as one red line. */
{
  // THE REQUIRE IS INSIDE THE CATCH ON PURPOSE. Hoisting it out of the guard turned five
  // module-scope constants from COVERED into CRASHED: deleting one makes this file throw at
  // load, which kills the whole suite and reports no count at all rather than reddening the
  // assertions that depend on it. A dead run is not a failing run.
  const verdict = function (p) {
    try { return require('./check-gate-dispatch.js').asksForMethodReview(p); }
    catch (e) { return 'threw'; }
  };
  ok('a missing prompt is not a method review, and does not throw', verdict(undefined) === false);
  ok('a null prompt is not a method review, and does not throw', verdict(null) === false);
  ok('a numeric prompt is not a method review, and does not throw', verdict(42) === false);
  ok('an empty prompt is not a method review', verdict('') === false);
  // The other side of the same predicate, so these cannot all pass by the function being broken.
  ok('and a real ask on the first line still reads as a method review',
    verdict('This is a method review of the studio.\nDetails below.') === true);
}

// --- ST-246: the gate demanded a name and nothing anywhere proved the name existed -----------
// A product review renamed base/agents/doctor.md, deleting the only role the gate requires, and
// measured delta ZERO on every instrument in this repository. Every fixture above writes no
// roster at all, which is the CANNOT TELL case, and that is precisely why adding the check left
// all of them green. Each case below names the input that separates it from its neighbour before
// it is run (S190), because a case that differs from its neighbour in nothing measures nothing.
function roster (dir, names) {
  const p = path.join(dir, '.claude', 'agents');
  fs.mkdirSync(p, { recursive: true });
  // Filename and frontmatter agree here because that is the ordinary case. The one case where
  // they DISAGREE is built by hand below, since it is the whole reason the reader parses
  // frontmatter rather than reading the directory listing.
  for (const nm of names) {
    fs.writeFileSync(path.join(p, nm + '.md'),
      '---\nname: ' + nm + '\ndescription: fixture\n---\n\nbody\n', 'utf8');
  }
  return p;
}
const ALL_SIX = ['qa-tester', 'code-reviewer', 'security-reviewer', 'content-reviewer',
  'mobile-qa', 'doctor'];
const NO_DOCTOR = ALL_SIX.filter(nm => nm !== 'doctor');

{
  // Separating input: a home roster holding five of the six, the absent one being the method
  // role. That is exactly the state the studio's own machine was in when this was found.
  const w = world();
  roster(w.home, NO_DOCTOR);
  session(w, 's1', [dispatch('code-reviewer'), dispatch('doctor')]);
  const r = run(w);
  ok('an install that cannot dispatch a reviewer the gate demands is reported, not passed over',
    /CANNOT DISPATCH 1 REVIEWER\(S\) THIS GATE DEMANDS: doctor/.test(r.out));
  ok('and it is advisory, because the install is the user directory and not ours to refuse over',
    r.code === 4);
  ok('and it names the directory it read, so a reader can check the derivation rather than trust it',
    /Installed at: /.test(r.out));
}
{
  // Separating input: the same session with the SIXTH file present and nothing else changed. A
  // report here would be the check firing on something other than absence.
  const w = world();
  roster(w.home, ALL_SIX);
  session(w, 's1', [dispatch('code-reviewer'), dispatch('doctor')]);
  const r = run(w);
  ok('a complete install says nothing at all and leaves the gate clean',
    r.code === 0 && !/CANNOT DISPATCH/.test(r.out));
}
{
  // Separating input: a roster of the SAME SIZE holding none of these names. A count-based check
  // cannot tell this from the case above. Refusing here would lock out every reader running the
  // method with a roster of their own, which is the S189 class.
  const w = world();
  roster(w.home, ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta']);
  session(w, 's1', [dispatch('code-reviewer'), dispatch('doctor')]);
  const r = run(w);
  ok('a roster holding none of these names belongs to somebody else and is not reported on',
    r.code === 0 && !/CANNOT DISPATCH/.test(r.out));
}
{
  // Separating input: the file is NAMED doctor.md and its frontmatter still declares the old
  // name. A filename check passes this. The agent registers as studio-director and stays
  // unreachable, which is the same defect one layer further in.
  const w = world();
  const p = roster(w.home, NO_DOCTOR);
  fs.writeFileSync(path.join(p, 'doctor.md'),
    '---\nname: studio-director\ndescription: fixture\n---\n\nbody\n', 'utf8');
  session(w, 's1', [dispatch('code-reviewer'), dispatch('doctor')]);
  const r = run(w);
  ok('the dispatch name is the FRONTMATTER name, so a renamed file with a stale one is still absent',
    /CANNOT DISPATCH 1 REVIEWER\(S\) THIS GATE DEMANDS: doctor/.test(r.out));
}
{
  // Separating input: the project roster is complete and the HOME roster is not. A session inside
  // a project loads that project's roster, so the machine-wide one must not be consulted at all.
  const w = world();
  roster(w.home, NO_DOCTOR);
  roster(w.root, ALL_SIX);
  session(w, 's1', [dispatch('code-reviewer'), dispatch('doctor')]);
  const r = run(w);
  ok('a project roster wins over the machine-wide one, because that is the one a session loads',
    r.code === 0 && !/CANNOT DISPATCH/.test(r.out));
}

/* Measured: a fatal guard firing part way through the studio suite reported 0 failed
   and exit 0, having run 22 of 214, so a count of failures cannot see an assertion that
   never ran. The total is pinned here, and the number is written down rather than measured
   from the run it checks, because a self-updating total agrees with any run. S35 is the same
   rule applied to the summary. Mutation: delete an assertion above and this goes red alone. */
// --- the tree half: a review is evidence about ONE tree ---------------------------------------
// The incident these are written from is real and is in check-gate-dispatch.js's own header: two
// gates dispatched at 07:52, a SECOND session committing into the same repository at 07:59:23
// while both were reading, and nothing anywhere reporting it.
{
  const w = world();
  session(w, 's1', [dispatch('code-reviewer'), dispatch('doctor')]);
  const r = run(w);
  ok('with no commit since the dispatch it still passes', r.code === 0);
  // A PASS THAT SAYS NOTHING IS INDISTINGUISHABLE FROM THE HALF NOT RUNNING. Without this, every
  // mutation that deletes the tree half leaves the passing fixtures green, because they only ever
  // asserted the exit code, and exit 0 is what the check returned before the half existed.
  ok('and it SAYS the tree did not move, so the pass is attributable to the half that made it',
    /No commit has landed since the first was dispatched at 2026-09-06T04:00:09/.test(r.out));
}
{
  const w = world();
  session(w, 's1', [dispatch('code-reviewer'), dispatch('doctor')]);
  commitAt(w, '2026-09-06T05:00:00Z', 'a second writer lands mid-review');
  const r = run(w);
  ok('a commit landing AFTER the reviewers were dispatched refuses', r.code === 1);
  ok('and it refuses for the tree reason rather than for a missing reviewer',
    /THE TREE MOVED AFTER THE REVIEW STARTED/.test(r.out));
  ok('and it NAMES the commit, so the reader can go and look at it rather than take its word',
    /a second writer lands mid-review/.test(r.out));
  ok('and it prints the remedy, which is what keeps a closed failure from being a lockout',
    /Dispatch the reviewers again, after the last commit/.test(r.out));
  // The refusal is deliberately not an accusation: the session's own commit lands here too, and a
  // reader who reads it as "somebody else did this" will go looking for a person who does not exist.
  ok('and it says plainly that it is not an accusation of a second writer',
    /not an accusation/.test(r.out));
  // WHICH TRANSCRIPT WAS READ, on the branch that actually refuses a release. The coverage tool
  // found this line silent here while the identical line on two sibling branches was covered,
  // which is the sharpest version of the problem: reading an older session of the same project
  // and refusing on ITS commits is the worst wrong answer this file can give, and the one branch
  // where being wrong costs a release was the one with nothing asserting where it looked.
  ok('and the refusal names the transcript it read, on the branch that stops a release',
    /Session: s1\.jsonl/.test(r.out));
}
{
  // A commit BEFORE the dispatch is the ordinary case and must not refuse, or the check would
  // refuse every session that has ever committed anything.
  const w = world();
  commitAt(w, '2026-09-02T00:00:00Z', 'ordinary work, committed before the review');
  session(w, 's1', [dispatch('code-reviewer'), dispatch('doctor')]);
  const r = run(w);
  ok('a commit BEFORE the dispatch does not refuse', r.code === 0);
}
{
  // NOT A GIT REPOSITORY IS A THING IT CANNOT TELL, NEVER A PASS. A reader running the export
  // outside git must not be told the tree held still, and must not be locked out either.
  const w = world();
  fs.rmSync(path.join(w.root, '.git'), { recursive: true, force: true });
  session(w, 's1', [dispatch('code-reviewer'), dispatch('doctor')]);
  const r = run(w);
  ok('a root that is not a git repository reports it cannot tell rather than passing', r.code === 3);
  ok('and it says so in the words a reader can act on',
    /CANNOT TELL whether the tree moved/.test(r.out));
  // THE TWO FACTS THIS ROW IS ACTED ON, asserted because the coverage tool found both lines
  // silent on THIS branch while the identical lines on the sibling branch were covered. Which
  // reviewers ran tells a reader whether to re-dispatch or to go looking at their git install,
  // and WHICH TRANSCRIPT WAS READ is the fact this file singled out as its worst possible false
  // pass: reporting confidently on somebody else's session.
  ok('a cannot-tell from an unreadable git still names which reviewers ran',
    /code-reviewer 1/.test(r.out));
  ok('and it still names the transcript it read', /Session: s1\.jsonl/.test(r.out));
}
{
  // A dispatch with no timestamp cannot be the start of a window. Same answer, said separately,
  // because it arrives by a different route and a reader needs to know which one they are in.
  const w = world();
  const noStamp = JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: 'Agent', input: { subagent_type: 'code-reviewer', prompt: 'review the change' } }] }
  });
  const noStampDirector = JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: 'Agent', input: { subagent_type: 'doctor', prompt: 'method review of this session' } }] }
  });
  session(w, 's1', [noStamp, noStampDirector]);
  const r = run(w);
  ok('dispatches with no timestamp report it cannot tell rather than passing', r.code === 3);
  ok('and it names the timestamp as the thing that is missing',
    /carries a timestamp that can be read as a date/.test(r.out));
}

// --- the remedy has to WORK, not merely be printed ---------------------------------------------
// THIS IS THE ASSERTION THAT WOULD HAVE CAUGHT THE LOCKOUT, and it did not exist when the lockout
// shipped. The refusal prints "dispatch the reviewers again, after the last commit". The first
// version opened the window at the EARLIEST qualifying dispatch in the session, and a transcript
// is append-only, so performing that remedy added a later entry and could never move the window.
// A reviewer did exactly what the message said and watched the refusal stand. The assertion that
// existed asserted the SENTENCE WAS PRINTED, which stayed green through all of it. An assertion
// about a remedy has to perform the remedy.
{
  const w = world();
  session(w, 's1', [dispatch('code-reviewer'), dispatch('doctor')]);
  commitAt(w, '2026-09-06T05:00:00Z', 'a fix committed after the first review');
  ok('a commit after the first review refuses, which is the state the remedy is printed in',
    run(w).code === 1);
  // Perform the printed remedy: dispatch both kinds again, after that commit.
  session(w, 's1', [dispatch('code-reviewer'), dispatch('doctor'),
    dispatch('code-reviewer', undefined, '2026-09-06T06:00:00.000Z'),
    dispatch('doctor', undefined, '2026-09-06T06:00:01.000Z')]);
  const after = run(w);
  ok('and performing that remedy CLEARS it, which is the whole difference between a refusal and a lockout',
    after.code === 0);
  ok('and the window has moved to the re-dispatch rather than staying at the first one',
    /2026-09-06T06:00:00/.test(after.out));
}
{
  // BOTH KINDS HAVE TO BE RE-DISPATCHED. The window opens at the earlier of the two latest, so
  // re-running only the product reviewer leaves the method reviewer behind the commit and the
  // refusal correctly stands. Without this, taking the latest of ALL dispatches would pass here.
  const w = world();
  session(w, 's1', [dispatch('code-reviewer'), dispatch('doctor')]);
  commitAt(w, '2026-09-06T05:00:00Z', 'a fix committed after the first review');
  session(w, 's1', [dispatch('code-reviewer'), dispatch('doctor'),
    dispatch('code-reviewer', undefined, '2026-09-06T06:00:00.000Z')]);
  ok('re-dispatching only ONE kind does not clear it, because the other still read the older tree',
    run(w).code === 1);
}

// --- a stamp that cannot be read is not a stamp -------------------------------------------------
// git log --since ACCEPTS text it cannot parse and quietly treats it as now, so an unreadable
// timestamp produced an empty window and a green release gate over a tree nobody had looked at.
{
  const w = world();
  session(w, 's1', [dispatch('code-reviewer', undefined, 'not-a-date'),
    dispatch('doctor', undefined, 'not-a-date')]);
  commitAt(w, '2026-09-06T05:00:00Z', 'a commit that a working window would have found');
  const r = run(w);
  ok('an unreadable timestamp is cannot-tell', r.code === 3);
  ok('and above all it is NOT a pass, which is what it used to be', r.code !== 0);
  // THE TWO FACTS A CANNOT-TELL ROW IS ACTED ON, asserted because the coverage tool found both
  // lines silent. Which reviewers ran tells the reader whether to re-dispatch or to look
  // elsewhere, and WHICH TRANSCRIPT WAS READ is the one this project singled out last sitting as
  // the worst false pass this file can ship: reading an older session and reporting on it.
  ok('and the cannot-tell row still names which reviewers ran', /code-reviewer 1/.test(r.out));
  ok('and it names the transcript it read, which is the fact a wrong answer here turns on',
     /Session: s1\.jsonl/.test(r.out));
  // THE TWO CANNOT-TELL ROUTES MUST NOT READ ALIKE, which is the whole reason they were written
  // as two branches. This one is "your dispatches carry no readable stamp"; the other is "git
  // could not be read". A reader fixes those in completely different places, and the sentence
  // naming which one they are in had no assertion at all.
  ok('and it says WHICH cannot-tell this is: the stamps, not git',
     /no dispatch of each kind/.test(r.out));
}
{
  // An empty window is the ordinary case and must produce NO commits. With the redundant early
  // return gone, this is what holds the field-count guard in place: without it an empty git
  // result becomes one commit with no hash and refuses a release nothing is wrong with.
  const w = world();
  session(w, 's1', [dispatch('code-reviewer'), dispatch('doctor')]);
  const r = run(w);
  ok('an empty git result is no commits, not one blank one', r.code === 0);
  ok('and it does not claim a commit landed', !/THE TREE MOVED/.test(r.out));
}
{
  // One kind readable and the other not is still cannot-tell: a window needs both ends.
  const w = world();
  session(w, 's1', [dispatch('code-reviewer'), dispatch('doctor', undefined, 'not-a-date')]);
  commitAt(w, '2026-09-06T05:00:00Z', 'a commit that a working window would have found');
  ok('one kind readable and the other not is still cannot-tell, never a pass', run(w).code === 3);
}

{
  // THE HOLE THE ADVISORY CHANGE OPENED, found by the reviewer it was dispatched to. Both method
  // branches used to RETURN 4, and they sit ABOVE the tree half, so a session with a product
  // reviewer and a commit landing after it reached a GREEN gate: the question of whether the tree
  // moved was never asked. While both branches returned 1 the ordering could not matter, because
  // either way the release was refused. Making one of them advisory made the ordering load bearing.
  const w = world();
  session(w, 's1', [dispatch('code-reviewer')]);
  commitAt(w, '2026-09-06T05:00:00Z', 'a commit lands after the only reviewer');
  const r = run(w);
  ok('a commit after the PRODUCT reviewer still refuses when no method review ran', r.code === 1);
  ok('and it refuses for the TREE reason, which is the guard an early return skipped',
    /THE TREE MOVED AFTER THE REVIEW STARTED/.test(r.out));
}
{
  // The other side of the same rule. A missing method review on a tree that HELD is advisory and
  // not a refusal, and the window opens at the product reviewer alone, because with the method
  // half advisory that is the only dispatch still certifying anything.
  const w = world();
  session(w, 's1', [dispatch('code-reviewer')]);
  const r = run(w);
  ok('no method review on a tree that held is advisory rather than a refusal', r.code === 4);
  ok('and it still names the half that did not run, so the reader can put it on a ticket',
    /NO METHOD REVIEW RAN/.test(r.out));
}

// MOVED HERE FROM MID-FILE, WHICH IS ST-246 M5. It used to run before roughly fifteen further
// blocks, so every world those built was never removed: a product review counted 11,630
// gate-dispatch-* directories in the temp directory, each one a git repository. Nothing failed,
// which is why it survived. It has to be the last statement before the tally.
junk.forEach(d => fs.rmSync(d, { recursive: true, force: true }));

const EXPECTED_ASSERTIONS = 148;
const ranBefore = pass + fail;
ok('the suite ran every assertion: ran ' + (ranBefore + 1) + ' of ' + EXPECTED_ASSERTIONS
  + '. A block was skipped or deleted. Find out which before you change the number.',
  ranBefore === EXPECTED_ASSERTIONS - 1);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
