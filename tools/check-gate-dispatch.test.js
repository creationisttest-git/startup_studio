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
const { execFileSync } = require('child_process');
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

function world () {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-dispatch-' + process.pid + '-' + (n++) + '-'));
  junk.push(d);
  const home = path.join(d, 'home');
  const root = path.join(d, 'work');
  fs.mkdirSync(root, { recursive: true });
  return { dir: d, home: home, root: root };
}
function transcriptDir (w) {
  const p = path.join(w.home, '.claude', 'projects', projectDirName(w.root));
  fs.mkdirSync(p, { recursive: true });
  return p;
}
function dispatch (role) {
  return JSON.stringify({
    type: 'assistant',
    timestamp: '2026-09-06T04:00:09.953Z',
    message: { content: [{ type: 'tool_use', name: 'Agent', input: { subagent_type: role } }] }
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
function run (w, extra) {
  const args = [TOOL, '--root', w.root, '--home', w.home].concat(extra || []);
  try {
    return { code: 0, out: execFileSync('node', args, { stdio: ['pipe', 'pipe', 'pipe'] }).toString() };
  } catch (e) {
    return { code: e.status, out: ((e.stdout || '') + (e.stderr || '')).toString() };
  }
}

// --- a review agent was started: the half that announces a check gone paranoid ----------------
{
  const w = world();
  session(w, 's1', [dispatch('code-reviewer')]);
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
  session(w, 'z-real', [dispatch('qa-tester')]);
  const r = run(w);
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
  ok('and it says nothing could be stat-ed rather than that no review ran',
    /could be stat-ed/.test(r.out) && !/NO REVIEW RAN/.test(r.out));
  ok('and it stops there rather than falling through and saying it cannot tell a second time',
    (r.out.match(/CANNOT TELL/g) || []).length === 1);
}

// --- the newest session is the one that is read -----------------------------------------------
// Sorts second AND is written second, so name, creation and metadata order all disagree with
// modification order. Both directions are asserted. See the header.
{
  const w = world();
  session(w, 'a-oldest', [dispatch('qa-tester')], 1000000);
  session(w, 'm-newest', [dispatch('pm')], 3000000);
  session(w, 'z-middle', [dispatch('code-reviewer')], 2000000);
  const r = run(w);
  ok('a reviewer in an OLDER session does not clear the current one', r.code === 1);
  ok('and the session it read is the newest by modification time, not the first or last listed',
    /m-newest\.jsonl/.test(r.out));
}
{
  const w = world();
  session(w, 'a-oldest', [dispatch('pm')], 1000000);
  session(w, 'm-newest', [dispatch('mobile-qa')], 3000000);
  session(w, 'z-middle', [dispatch('tech-lead')], 2000000);
  const r = run(w);
  ok('and a reviewer in the NEWEST session passes, so the rule is a rule and not an accident',
    r.code === 0);
  ok('and that pass names the newest session too, so it passed for the right file',
    /m-newest\.jsonl/.test(r.out));
}

// --- shapes the host really produces ----------------------------------------------------------
{
  const w = world();
  session(w, 's1', [dispatch('security-reviewer'), '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Task","input":{"subagent_type":"code-rev']);
  const r = run(w);
  ok('a half-written last line is skipped rather than crashing the check', r.code === 0);
  ok('and nothing about the failure reaches the reader as an error', !/SyntaxError/.test(r.out));
}
{
  const w = world();
  session(w, 's1', ['{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Task","input":{"subagent_type":"code-rev', dispatch('security-reviewer')]);
  const r = run(w);
  ok('a half-written line does not stop the scan finding a reviewer AFTER it', r.code === 0);
  ok('and that reviewer is the one counted, so a bad record is skipped and not the rest of the file',
    /security-reviewer 1/.test(r.out));
}
{
  const w = world();
  session(w, 's1', [JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: 'Task', input: { subagent_type: 'content-reviewer' } }] }
  })]);
  ok('the older name for the dispatch tool is recognised, so a rename is not a silent miss',
    run(w).code === 0);
}
{
  const w = world();
  session(w, 's1', [JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: 'Bash', input: { subagent_type: 'code-reviewer' } }] }
  })]);
  ok('a tool that is not the dispatch tool does not count as a review, whatever it carries',
    run(w).code === 1);
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
  session(w, 's1', ['null', dispatch('qa-tester')]);
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
  session(w, 's1', [nullContent, dispatch('qa-tester')]);
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
  session(w, 's1', [stringContent, dispatch('qa-tester')]);
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
  session(w, 's1', [objectContent, dispatch('qa-tester')]);
  const r = run(w);
  ok('a record whose content is an OBJECT is skipped rather than walked', r.code === 0);
  ok('and the reviewer after it is still counted, so the file was not abandoned',
    /qa-tester 1/.test(r.out));
}
{
  const w = world();
  session(w, 's1', [JSON.stringify({
    type: 'assistant',
    message: { content: [null, { type: 'tool_use', name: 'Agent', input: { subagent_type: 'qa-tester' } }] }
  })]);
  const r = run(w);
  ok('an empty block inside the content array does not stop the blocks after it', r.code === 0);
}
{
  const w = world();
  session(w, 's1', [JSON.stringify({
    type: 'assistant',
    message: {
      content: [
        { type: 'tool_use', name: 'Agent' },
        { type: 'tool_use', name: 'Agent', input: { subagent_type: 'qa-tester' } }
      ]
    }
  })]);
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
  session(w2, 's1', [odd, dispatch('qa-tester')]);
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
  session(w, 's1', [dispatch('qa-tester')]);
  const env = Object.assign({}, process.env, { USERPROFILE: w.home, HOME: w.home });
  let code = 0, out = '';
  try { out = execFileSync('node', [TOOL, '--root', w.root], { env: env, stdio: ['pipe', 'pipe', 'pipe'] }).toString(); }
  catch (e) { code = e.status; out = ((e.stdout || '') + (e.stderr || '')).toString(); }
  ok('with --home omitted the home directory falls back to the real one, which is the only shape the release set uses',
    code === 0 && /qa-tester 1/.test(out));
}
{
  // The other half of the same fallback line.
  const w = world();
  session(w, 's1', [dispatch('code-reviewer')]);
  let code = 0, out = '';
  try { out = execFileSync('node', [TOOL, '--home', w.home], { cwd: w.root, stdio: ['pipe', 'pipe', 'pipe'] }).toString(); }
  catch (e) { code = e.status; out = ((e.stdout || '') + (e.stderr || '')).toString(); }
  ok('and with --root omitted the project root falls back to the working directory',
    code === 0 && /code-reviewer 1/.test(out));
}
{
  const w = world();
  session(w, 's1', [dispatch('qa-tester')]);
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

junk.forEach(d => fs.rmSync(d, { recursive: true, force: true }));
/* Measured: a fatal guard firing part way through the studio suite reported 0 failed
   and exit 0, having run 22 of 214, so a count of failures cannot see an assertion that
   never ran. The total is pinned here, and the number is written down rather than measured
   from the run it checks, because a self-updating total agrees with any run. S35 is the same
   rule applied to the summary. Mutation: delete an assertion above and this goes red alone. */
const EXPECTED_ASSERTIONS = 65;
const ranBefore = pass + fail;
ok('the suite ran every assertion: ran ' + (ranBefore + 1) + ' of ' + EXPECTED_ASSERTIONS
  + '. A block was skipped or deleted. Find out which before you change the number.',
  ranBefore === EXPECTED_ASSERTIONS - 1);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
