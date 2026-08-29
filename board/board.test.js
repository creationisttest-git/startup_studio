#!/usr/bin/env node
'use strict';
/*
 * Tests for board.js.
 *
 * Every assertion here has been watched failing, by breaking board.js and confirming this suite
 * goes red. A check nobody has seen fail is indistinguishable from one that always passes.
 *
 * Why this file exists. A board that ENFORCES its rules is only as trustworthy as the proof
 * that those refusals still refuse. One of them stopped working silently once: with several
 * questions open on a ticket, answering resolved to the most recently asked one and offered no
 * way to name a different one, so an answer was filed against the wrong question. It happened
 * to match the recommended option, which made the false record read as agreement rather than
 * as an error. Nothing caught it, because nothing was testing it.
 *
 * Each rule is asserted twice where it can be: once that it refuses what it names, and once
 * that it does NOT refuse a legitimate case. A guard that refuses everything passes the first
 * half and is useless, and only the second failure mode announces itself.
 */
const NLT = String.fromCharCode(10);
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

let pass = 0, fail = 0;
function ok (name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL  ' + name); } }

// The board RESOLVES its directory rather than sitting in one, so isolating a test means
// POINTING it at a sandbox with BOARD_HOME instead of copying the program and trusting it to
// write nowhere else. Trusting was not good enough: the moment board.js stopped rooting itself
// at __dirname, this harness silently created a real board at the repository ROOT and went on
// reading an empty sandbox. The copy is kept anyway, so the file under test is still the one a
// project would install rather than the one we develop against.
const SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-board-'));
const TOOL = path.join(SANDBOX, 'board.js');
fs.copyFileSync(path.join(__dirname, 'board.js'), TOOL);

// Time is SUPPLIED rather than read, which is what BOARD_NOW exists for: a run that is
// reproducible and a diff that is reviewable. It is also what makes the byte comparison further
// down deterministic.
//
// qa-tester proved the first version of that comparison green against a mutation adding save(t)
// to a refusal path. save() stamps updated_at, so the write SHOULD have shown up. It did not,
// because now() has one-second resolution and the clock had not ticked since the previous
// command, so the file came back byte-identical by luck. That is worse than a weak assertion: it
// would have gone red at a second boundary and nowhere else, which is a test that fails once a
// month for no reason anybody can reproduce. Every command now gets its own distinct timestamp.
let tick = 0;
function stamp () {
  const t = ++tick;
  const pad = n => String(n).padStart(2, '0');
  return '2026-01-01 ' + pad(Math.floor(t / 3600) % 24) + ':' + pad(Math.floor(t / 60) % 60) + ':' + pad(t % 60);
}
function run (args) {
  const env = Object.assign({}, process.env, { BOARD_NOW: stamp(), BOARD_HOME: SANDBOX });
  try {
    const out = execFileSync('node', [TOOL].concat(args), { stdio: ['pipe', 'pipe', 'pipe'], env: env }).toString();
    return { code: 0, out: out };
  } catch (e) {
    return { code: e.status, out: ((e.stdout || '') + (e.stderr || '')).toString() };
  }
}
// A refusal that re-saves an unmodified ticket still stamps updated_at, so it is still a write to
// a record that nothing changed. This is the assertion that sees it.
function ticket (ref) {
  return JSON.parse(fs.readFileSync(path.join(SANDBOX, 'tickets', ref + '.json'), 'utf8'));
}

run(['init', 'sandbox']);
run(['add', 'A ticket carrying several open questions', '--desc', 'fixture', '--size', 'small']);

// Three questions, asked in order, exactly as ST-065 carried them.
run(['ask', 'SA-001', 'FIRST question, asked earliest', '--options', 'alpha|beta', '--recommend', '1', '--by', 'pm']);
run(['ask', 'SA-001', 'SECOND question', '--options', 'gamma|delta', '--recommend', '1', '--by', 'tech-lead']);
const asked = run(['ask', 'SA-001', 'THIRD question, asked most recently', '--options', 'epsilon|zeta', '--recommend', '2', '--by', 'content-lead']);

// --- ask names the decision, so three questions do not carry one identical instruction -------
{
  ok('ask prints the decision key in its reply instruction', /--decision d3/.test(asked.out));
  ok('and the key it prints is the question just asked', ticket('SA-001').decisions[2].key === 'd3');
  ok('every decision asked carries a stored key', ticket('SA-001').decisions.every((d, i) => d.key === 'd' + (i + 1)));
}

// --- the clock is asserted, because the byte comparison is only as good as the clock ---------
// qa-tester's finding on the re-gate, and it is the same shape as the finding above it one level
// up: the strongest assertion in this file depends on a precondition that nothing checked.
//
// Two mutations proved it. Freezing the counter, and dropping BOARD_NOW from run()'s env, which
// is what an ordinary refactor does rather than an act of sabotage. Both restore the original
// flakiness silently and permanently, and both leave the suite green at 36 with a live defect
// underneath. Commands finish inside a second, so the real clock almost never ticks between them
// and the damage would read as health.
{
  run(['note', 'SA-001', 'first stamped write', '--by', 'pm']);
  const first = ticket('SA-001').updated_at;
  run(['note', 'SA-001', 'second stamped write', '--by', 'pm']);
  const second = ticket('SA-001').updated_at;
  ok('two consecutive commands write DIFFERENT timestamps', first !== second);
  ok('and the clock is the supplied one, not the wall clock', /^2026-01-01 /.test(second));
}

// --- the defect itself: answering without naming a decision ---------------------------------
{
  const p = path.join(SANDBOX, 'tickets', 'SA-001.json');
  const before = fs.readFileSync(p);
  const r = run(['answer', 'SA-001', '1']);
  ok('answering with several open decisions and no key is REFUSED', r.code === 1);
  ok('the refusal says how many were open', /3 open decisions/.test(r.out));
  ok('the refusal names the first open decision', /d1\s+FIRST question/.test(r.out));
  ok('the refusal names the second', /d2\s+SECOND question/.test(r.out));
  ok('the refusal names the third', /d3\s+THIRD question/.test(r.out));
  ok('the refusal says how to name one', /--decision <key>/.test(r.out));
  // The old code would have silently answered d3 here. Refusing is only useful if it also wrote
  // nothing, so this is the assertion that actually protects the record.
  //
  // It compares the FILE, not one field of it. qa-tester found the first version of this line
  // asserting only that every answer was still null, and proved it green against a mutation that
  // called save(t) on the refusal path. A refusal that still writes is worse than the defect it
  // replaced, and a future edit that logs or timestamps on that path would have gone unseen.
  ok('and NOTHING was recorded by the refusal', ticket('SA-001').decisions.every(d => d.answer === null));
  ok('and the ticket file is BYTE-IDENTICAL after the refusal', fs.readFileSync(p).equals(before));
}

// --- naming a decision answers THAT one, not the most recent --------------------------------
{
  const r = run(['answer', 'SA-001', '2', '--decision', 'd1', '--note', 'a note belonging to the first question']);
  const t = ticket('SA-001');
  ok('answering by key succeeds', r.code === 0);
  ok('the confirmation names the key it answered', /d1/.test(r.out));
  ok('the named decision carries the answer', t.decisions[0].answer === 2);
  ok('and the note went with it', /belonging to the first question/.test(t.decisions[0].answer_note));
  // This is the whole ticket. Under the old code the answer and its note landed here instead.
  ok('the most recently asked decision was NOT touched', t.decisions[2].answer === null);
  ok('nor was the one in between', t.decisions[1].answer === null);
  ok('the history records WHICH decision was answered', t.history.some(h => /decided \[d1\]/.test(h.what)));
}

// --- an unknown key is refused, and says what is open ---------------------------------------
{
  const r = run(['answer', 'SA-001', '1', '--decision', 'd9']);
  // On the exit code alone this assertion passed over the very defect it names: deleting the
  // refusal throws a TypeError, which also exits 1. qa-tester caught it. An exit code is exactly
  // what lied when a crashed run still printed a healthy summary (S35), and it lied again here.
  ok('an unknown decision key is refused', r.code === 1 && /no decision d9 on SA-001/.test(r.out));
  ok('and the refusal is a refusal rather than a crash', !/TypeError|Error:|at Object\./.test(r.out));
  ok('and the refusal lists the keys that ARE open', /d2, d3/.test(r.out));
}

// --- a decision already answered is refused rather than overwritten -------------------------
{
  const r = run(['answer', 'SA-001', '1', '--decision', 'd1']);
  ok('answering an already-answered decision is refused', r.code === 1);
  ok('and the refusal quotes the answer that stands', /beta/.test(r.out));
  ok('the standing answer is unchanged', ticket('SA-001').decisions[0].answer === 2);
}

// --- it does NOT over-refuse: one open decision still answers with no key --------------------
// A guard that refuses everything passes every assertion above and is useless. This is the half
// that announces nothing when it breaks.
{
  run(['answer', 'SA-001', '1', '--decision', 'd2']);
  const r = run(['answer', 'SA-001', '1']);
  ok('with exactly ONE decision open, no key is needed', r.code === 0);
  ok('and it answered the one that was open', ticket('SA-001').decisions[2].answer === 1);
}

// --- show prints the keys, or the CEO cannot use them ----------------------------------------
{
  const r = run(['show', 'SA-001']);
  ok('show prints the key beside each question', /Q \[d1\]/.test(r.out) && /Q \[d3\]/.test(r.out));
}

// --- audit names EVERY open decision, not only the first --------------------------------------
{
  run(['add', 'A second ticket', '--desc', 'fixture', '--size', 'small']);
  run(['ask', 'SA-002', 'AUDIT question one', '--options', 'a|b', '--recommend', '1', '--by', 'pm']);
  run(['ask', 'SA-002', 'AUDIT question two', '--options', 'c|d', '--recommend', '1', '--by', 'pm']);
  const r = run(['audit']);
  ok('audit reports the open decisions', /2 unanswered decision/.test(r.out));
  ok('audit names the first open decision', /\[d1\] AUDIT question one/.test(r.out));
  // The old line quoted open[0] alone, so the second question was invisible to the audit.
  ok('audit names the second as well', /\[d2\] AUDIT question two/.test(r.out));
}

// --- close refuses over an open decision and names which one ----------------------------------
{
  const r = run(['close', 'SA-002', '--as', 'done', '--by', 'pm']);
  ok('close is still refused while a decision is open', r.code === 1);
  ok('and close names the open decisions by key', /\[d1\]/.test(r.out) && /\[d2\]/.test(r.out));
}

// --- decisions asked BEFORE keys existed still resolve -----------------------------------------
// The real board carries decisions written before this field existed. Keys are derived from
// position on read, so an old ticket must answer exactly like a new one. Without the fallback in
// decisionKey every one of those decisions becomes unanswerable.
{
  const p = path.join(SANDBOX, 'tickets', 'SA-002.json');
  const t = JSON.parse(fs.readFileSync(p, 'utf8'));
  t.decisions.forEach(d => { delete d.key; });
  fs.writeFileSync(p, JSON.stringify(t, null, 2) + '\n');

  const listed = run(['show', 'SA-002']);
  ok('a decision with no stored key is still shown with one', /Q \[d2\] .*AUDIT question two/.test(listed.out));

  const r = run(['answer', 'SA-002', '2', '--decision', 'd1']);
  ok('and a keyless decision can be answered by its derived key', r.code === 0);
  ok('the answer landed on the derived target', ticket('SA-002').decisions[0].answer === 2);
  ok('and not on the other one', ticket('SA-002').decisions[1].answer === null);
}

// ---- where the board lives ---------------------------------------------------------------
//
// board.js used to root itself at __dirname, which made the PROGRAM and a project's TICKETS the
// same folder by construction and is what blocked publishing it. These prove the four
// resolution rules, and one of them proves the ORDER, which is the part a comment can only
// claim. S25: a claim about a thing is not evidence about the thing.

const TMP = os.tmpdir();
const junk = [];
function tmpdir(tag) { const d = fs.mkdtempSync(path.join(TMP, 'studio-' + tag + '-')); junk.push(d); return d; }

// A program directory with NO board beside it, which is what a published copy looks like.
function freshProgram() {
  const d = tmpdir('prog');
  fs.copyFileSync(path.join(__dirname, 'board.js'), path.join(d, 'board.js'));
  return d;
}
function runAt(prog, cwd, args, env) {
  const e = Object.assign({}, process.env, { BOARD_NOW: stamp() });
  // An inherited BOARD_HOME would satisfy rule 1 and make every rule below untested while
  // still passing. The precondition an assertion depends on must itself be asserted (S54).
  delete e.BOARD_HOME;
  Object.assign(e, env || {});
  try {
    const out = execFileSync('node', [path.join(prog, 'board.js')].concat(args),
      { cwd: cwd, stdio: ['pipe', 'pipe', 'pipe'], env: e }).toString();
    return { code: 0, out: out };
  } catch (err) {
    return { code: err.status, out: ((err.stdout || '') + (err.stderr || '')).toString() };
  }
}

// RULE 1, explicit wins.
{
  const prog = freshProgram();
  const home = tmpdir('home');
  runAt(prog, TMP, ['init', 'explicit'], { BOARD_HOME: home });
  ok('BOARD_HOME puts the board where it says', fs.existsSync(path.join(home, 'project.json')));
  ok('and leaves no board beside the program', !fs.existsSync(path.join(prog, 'project.json')));
}

// RULE 4 then RULE 3. With no board anywhere, init creates one in the WORKING directory and not
// beside the installed program, which is the entire point of the split. It is then found from a
// subdirectory by walking up, the way git finds a repository.
const walkProg = freshProgram();
const walkWork = tmpdir('work');
{
  runAt(walkProg, walkWork, ['init', 'proj']);
  ok('init creates .board in the working directory',
     fs.existsSync(path.join(walkWork, '.board', 'project.json')));
  ok('and writes nothing at all beside the program',
     !fs.existsSync(path.join(walkProg, 'project.json')) && !fs.existsSync(path.join(walkProg, 'tickets')));

  // The board must be FOUND, not merely not-complained-about. The first version of this
  // assertion checked only that list did not say 'no board here', and list against a board that
  // does not exist prints empty columns and exits 0. Deleting the walk-up rule entirely left it
  // green, which is a check structurally incapable of returning the answer asked of it. It now
  // looks for a ticket that only the real board contains.
  runAt(walkProg, walkWork, ['add', 'found by walking up', '--desc', 'fixture', '--size', 'small']);
  const sub = path.join(walkWork, 'a', 'b');
  fs.mkdirSync(sub, { recursive: true });
  const r = runAt(walkProg, sub, ['list']);
  ok('a .board above the working directory is found by walking up',
     r.code === 0 && /found by walking up/.test(r.out));
}

// RULE 2, and the PRECEDENCE that makes it safe. A board sitting beside the program predates
// this split, and the studio's own tickets are exactly that, so it must keep resolving with no
// migration. It must also not be hijacked by a stray .board above the working directory: the
// other ordering silently retargets an existing board's tickets, and silently retargeting a
// record is the failure mode this studio has written down more often than any other.
{
  const prog = freshProgram();
  runAt(prog, TMP, ['init', 'legacy'], { BOARD_HOME: prog });
  runAt(prog, TMP, ['add', 'lives beside the program', '--desc', 'fixture', '--size', 'small'],
        { BOARD_HOME: prog });
  const work = tmpdir('work');
  const r = runAt(prog, work, ['list']);
  // Same weakness as the walk-up assertion above, and it was equally invisible: removing rule 2
  // left this green because the fallback produced an empty board that also exits 0.
  ok('a board beside the program still resolves from any working directory',
     r.code === 0 && /lives beside the program/.test(r.out));

  fs.mkdirSync(path.join(work, '.board', 'tickets'), { recursive: true });
  fs.writeFileSync(path.join(work, '.board', 'project.json'),
    JSON.stringify({ slug: 'stray', prefix: 'SY', assignees: [], created_at: '2026-01-01 00:00:00' }) + String.fromCharCode(10));
  runAt(prog, work, ['add', 'must land on the board beside the program', '--desc', 'fixture', '--size', 'small']);
  ok('a stray .board does not hijack a board beside the program',
     fs.readdirSync(path.join(prog, 'tickets')).length === 2);
  ok('and the stray board was not written to at all',
     fs.readdirSync(path.join(work, '.board', 'tickets')).length === 0);
}

// ---- the board diagnoses itself ------------------------------------------------------------
//
// One unparseable ticket file used to take down every command with a raw SyntaxError naming the
// offending TOKEN and never the FILE. On a board of seventy tickets that is a total outage with
// no way to find the cause except by opening files one at a time.
const NL = String.fromCharCode(10);
{
  const prog = freshProgram();
  const home = tmpdir('sick');
  runAt(prog, TMP, ['init', 'sick'], { BOARD_HOME: home });
  runAt(prog, TMP, ['add', 'a healthy ticket', '--desc', 'fixture', '--size', 'small'], { BOARD_HOME: home });

  const clean = runAt(prog, TMP, ['doctor'], { BOARD_HOME: home });
  ok('doctor reports no faults on a healthy board', clean.code === 0 && /no faults/.test(clean.out));

  const bad = path.join(home, 'tickets', 'SI-099.json');
  fs.writeFileSync(bad, '<<<<<<< HEAD' + NL + '{"ref":"SI-099"}' + NL + '=======' + NL + '{}' + NL + '>>>>>>> b' + NL);

  const listed = runAt(prog, TMP, ['list'], { BOARD_HOME: home });
  ok('one bad file no longer crashes every command', listed.code === 1 && !/SyntaxError/.test(listed.out));
  ok('and the refusal NAMES the file', /SI-099[.]json/.test(listed.out));
  ok('and calls the conflict marker what it is', /conflict marker at line 1/.test(listed.out));

  const doc = runAt(prog, TMP, ['doctor'], { BOARD_HOME: home });
  ok('doctor finds the conflict marker and exits non-zero',
     doc.code === 1 && /SI-099[.]json: unresolved git conflict marker/.test(doc.out));

  // A file that is simply not JSON, with no marker, gets a different and equally specific answer.
  fs.writeFileSync(bad, 'this is not json at all' + NL);
  const doc2 = runAt(prog, TMP, ['doctor'], { BOARD_HOME: home });
  ok('doctor separates plain invalid JSON from a conflict', /SI-099[.]json: not valid JSON/.test(doc2.out));

  // The filename IS the address every command resolves through, so a ref that disagrees with the
  // file holding it means show and move reach a different record from the one list drew. Both
  // this and the duplicate number must appear in ONE run: a board that reports only its first
  // fault makes recovery serial, and a merge that broke six files would take six rounds.
  fs.writeFileSync(bad, JSON.stringify({ ref: 'SI-001', num: 1, title: 'wrong address', status: 'backlog' }) + NL);
  const doc3 = runAt(prog, TMP, ['doctor'], { BOARD_HOME: home });
  ok('doctor finds a ref that disagrees with its filename', /SI-099[.]json: holds ref SI-001/.test(doc3.out));
  ok('and finds the duplicate number in the same run', /number 1 is held by 2 files/.test(doc3.out));
}

// The git warning must FAIL OPEN. A board outside a repository, or on a machine with no git at
// all, is a legitimate way to run this and must never be nagged or blocked. A control that
// refuses a legitimate case is as broken as one that permits an illegitimate one, and only the
// second failure mode announces itself.
{
  const prog = freshProgram();
  const home = tmpdir('nogit');
  runAt(prog, TMP, ['init', 'nogit'], { BOARD_HOME: home });
  const r = runAt(prog, TMP, ['add', 'outside any repository', '--desc', 'fixture', '--size', 'small'],
                  { BOARD_HOME: home });
  ok('a mutation outside a git repository still succeeds', r.code === 0);
}

// S39 APPLIED TO A PROGRAM RATHER THAN A PAGE. The usage header is a hand-kept list shadowing
// the commands object and nothing compared the two, so `doctor` shipped documented nowhere and
// this check is what found it. Both directions, because a command the header NAMES and the
// program does not have is the worse of the two: a reader types it and gets an error from the
// text that claims to be the reference.
{
  const srcText = fs.readFileSync(path.join(__dirname, 'board.js'), 'utf8');
  const header = srcText.split('*/')[0];
  const defined = (srcText.match(/^commands[.](\w+) =/gm) || [])
    .map(s => s.replace('commands.', '').replace(' =', ''));
  const documented = (header.match(/node board[.]js (\w+)/g) || [])
    .map(s => s.replace('node board.js ', ''));
  const undocumented = defined.filter(c => documented.indexOf(c) === -1);
  const phantom = documented.filter(c => defined.indexOf(c) === -1);
  ok('the board defines a plausible number of commands', defined.length >= 12);
  ok('every command the board has appears in its usage header, missing: ' + undocumented.join(','),
     undocumented.length === 0);
  ok('and every command the header names actually exists, phantom: ' + phantom.join(','),
     phantom.length === 0);
}

// ---- what the gate found -------------------------------------------------------------------
//
// Every assertion below exists because qa-tester broke something these tests could not see.

// spawnSync, because the durable-store warning goes to STDERR and execFileSync discards stderr on
// success. The original test could not have seen the warning even if it had looked for it.
function runCapture(prog, cwd, args, env) {
  const e = Object.assign({}, process.env, { BOARD_NOW: stamp() });
  delete e.BOARD_HOME;
  Object.assign(e, env || {});
  const r = require('child_process').spawnSync('node', [path.join(prog, 'board.js')].concat(args),
    { cwd: cwd, encoding: 'utf8', env: e });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

// CRITICAL, and it was reachable only because ST-072 made resolution depend on the working
// directory. init used resolveRoot, which WALKS UP, and had no existence check, so running it
// anywhere inside a project resolved that project's board and rewrote its identity in place
// while printing success. init now resolves an explicit location only, and refuses.
{
  const prog = freshProgram();
  const proj = tmpdir('proj');
  const deep = path.join(proj, 'src', 'deep');
  fs.mkdirSync(deep, { recursive: true });
  runAt(prog, proj, ['init', 'myproj', '--assignees', 'alice,bob']);
  runAt(prog, proj, ['add', 'a ticket the ancestor board owns', '--desc', 'x', '--size', 'small']);
  const before = fs.readFileSync(path.join(proj, '.board', 'project.json'), 'utf8');

  const nested = runAt(prog, deep, ['init', 'someothername']);
  const after = fs.readFileSync(path.join(proj, '.board', 'project.json'), 'utf8');
  ok('init from a subdirectory does NOT touch the board above it', before === after);
  ok('and it creates its own board where it was run', fs.existsSync(path.join(deep, '.board', 'project.json')));

  const again = runAt(prog, proj, ['init', 'replacement']);
  ok('init REFUSES to overwrite a board that already exists', again.code === 1);
  ok('and says what would have been destroyed', /slug, prefix and permitted assignees/.test(again.out));
  const forced = runAt(prog, proj, ['init', 'replacement', '--force']);
  // Asserting only that --force did not REFUSE is an assertion on the absence of an effect,
  // and qa-tester proved it hollow: --force reduced to a no-op that exits 0 and writes
  // nothing left this green. Same shape as the git control one round earlier, and the second
  // time that shape reached a gate in one session. Read the record back instead.
  const forcedSlug = JSON.parse(fs.readFileSync(path.join(proj, '.board', 'project.json'), 'utf8')).slug;
  ok('and --force is the way through, so the refusal is a guard and not a wall',
     forced.code === 0 && forcedSlug === 'replacement');
}

// THE WALK NEEDS A BOUNDARY. Without one it climbed to the filesystem root, so a board anywhere
// above was reachable -- including above a temp directory during a test run, which is how a
// clean suite could have written to a real board.
{
  const prog = freshProgram();
  const outer = tmpdir('outer');
  fs.mkdirSync(path.join(outer, '.board', 'tickets'), { recursive: true });
  fs.writeFileSync(path.join(outer, '.board', 'project.json'),
    JSON.stringify({ slug: 'outer', prefix: 'OU', assignees: [], created_at: '2026-01-01 00:00:00' }) + NL);
  const repo = path.join(outer, 'repo');
  fs.mkdirSync(repo, { recursive: true });
  require('child_process').spawnSync('git', ['init', '-q', repo], { encoding: 'utf8' });
  const r = runAt(prog, repo, ['list']);
  ok('the walk stops at a repository boundary and does not reach a board above it',
     r.code === 1 && /no board here/.test(r.out));
}

// AN EMPTY BOARD AND NO BOARD ARE DIFFERENT ANSWERS. list, wip and audit gave the same one for
// both, so a wrong resolved root was invisible in the three most used commands.
{
  const prog = freshProgram();
  const empty = tmpdir('nowhere');
  for (const c of ['list', 'wip', 'audit']) {
    const r = runAt(prog, empty, [c]);
    ok(c + ' refuses rather than reporting a healthy empty board', r.code === 1 && /no board here/.test(r.out));
  }
  const d = runAt(prog, empty, ['doctor']);
  ok('doctor says no board resolved rather than no faults',
     d.code === 1 && /no board resolved/.test(d.out));
}

// doctor pointed at itself as the way to investigate a corrupt project.json and could not see
// one. A command named as the way to investigate must be able to see the fault that named it.
{
  const prog = freshProgram();
  const home = tmpdir('badproj');
  runAt(prog, TMP, ['init', 'badproj'], { BOARD_HOME: home });
  fs.writeFileSync(path.join(home, 'project.json'), 'not json at all' + NL);
  const d = runAt(prog, TMP, ['doctor'], { BOARD_HOME: home });
  ok('doctor sees a corrupt project.json', d.code === 1 && /project[.]json: not valid JSON/.test(d.out));
}

// THE DURABLE-STORE WARNING, ASSERTED POSITIVELY. The first version asserted only that a mutation
// outside a repository still SUCCEEDS, which is the absence of an effect and passes just as well
// when the feature has been deleted. qa-tester deleted the whole control and the suite stayed
// green. A guard nobody has watched fire is not a guard.
{
  const prog = freshProgram();
  const repo = tmpdir('repo');
  require('child_process').spawnSync('git', ['init', '-q', repo], { encoding: 'utf8' });
  const home = path.join(repo, '.board');
  runAt(prog, repo, ['init', 'durable'], { BOARD_HOME: home });
  runAt(prog, repo, ['add', 'one', '--desc', 'x', '--size', 'small'], { BOARD_HOME: home });
  runAt(prog, repo, ['add', 'two', '--desc', 'x', '--size', 'small'], { BOARD_HOME: home });
  const r = runCapture(prog, repo, ['add', 'three', '--desc', 'x', '--size', 'small'], { BOARD_HOME: home });
  ok('a mutation inside a repository warns that the record is uncommitted',
     /uncommitted/.test(r.out));
  // The COUNT is the entire design rationale (S44) and it counted porcelain LINES. git collapses
  // an untracked directory into ONE entry, so a board never committed always reported 1 however
  // many tickets it held, which is the number reading as trivial exactly when it is not.
  ok('and it counts FILES, not porcelain lines', /3 ticket file/.test(r.out));
}

// --- ORDERING: a column has an explicit order, and a ticket can be dropped between two -------
// tech-lead objection 4 at the ST-065 front door. The web board orders a column by an explicit
// position; this board sorted by ticket number, so the top of a column named the OLDEST item
// rather than the most important. ST-080.
//
// Every assertion here reads the record back and requires it to have CHANGED. S55: the two
// controls that shipped broken in the previous session were both asserted by the ABSENCE of an
// effect, and both stayed green when the feature they guarded was deleted outright.
{
  const mk = title => run(['add', title, '--desc', 'fixture', '--size', 'small']).out.trim().split(' ')[0];
  const A = mk('ORDER first'), B = mk('ORDER second'), C = mk('ORDER third');
  const refsOf = out => (out.match(/SA-[0-9]+/g) || []);
  const eff = r => { const t = ticket(r); return typeof t.position === 'number' ? t.position : t.num; };
  const snap = () => {
    const d = path.join(SANDBOX, 'tickets'), m = {};
    for (const f of fs.readdirSync(d)) m[f] = fs.readFileSync(path.join(d, f), 'utf8');
    return m;
  };
  const at = (out, ref) => out.indexOf(ref);

  // ZERO MIGRATION is the whole reason an absent position means the ticket NUMBER and not zero.
  ok('a new ticket carries no position field at all', ticket(A).position === undefined);
  const l0 = run(['list', 'backlog']).out;
  ok('and unranked tickets still order by creation', at(l0, A) < at(l0, B) && at(l0, B) < at(l0, C));

  // THE MEASURE: a ticket moves between two neighbours without rewriting any other file.
  const before = snap();
  run(['rank', C, '--after', A, '--by', 'pm']);
  const after = snap();
  const changed = Object.keys(after).filter(f => after[f] !== before[f]);
  ok('ranking between two neighbours rewrites exactly ONE ticket file', changed.length === 1);
  ok('and the one it rewrites is the ticket that moved', changed[0] === C + '.json');
  const l1 = run(['list', 'backlog']).out;
  ok('the ranked ticket now sits between its neighbours', at(l1, A) < at(l1, C) && at(l1, C) < at(l1, B));
  ok('and its position is strictly between theirs', eff(C) > eff(A) && eff(C) < eff(B));
  // An integer index could not have expressed this without renumbering the column.
  ok('and it is a fraction, which is why the field is a float', eff(C) % 1 !== 0);

  run(['rank', C, '--top', '--by', 'pm']);
  ok('--top moves it to the head of its column', refsOf(run(['list', 'backlog']).out)[0] === C);
  run(['rank', C, '--bottom', '--by', 'pm']);
  const tail = refsOf(run(['list', 'backlog']).out);
  ok('--bottom moves it to the tail', tail[tail.length - 1] === C);

  // Checking the MESSAGE, not only the exit code: with the guard removed this command still
  // exits 1, via 'no ticket undefined' from the neighbour lookup, so the code alone proves
  // nothing about the guard it is named after.
  const noPlace = run(['rank', C, '--by', 'pm']);
  ok('rank refuses when no placement is given', noPlace.code === 1 && /exactly one of/.test(noPlace.out));
  ok('rank refuses when two placements are given', run(['rank', C, '--top', '--bottom', '--by', 'pm']).code === 1);
  // The same shape: without the guard this becomes 'no ticket true' and still exits 1.
  const bareBefore = run(['rank', C, '--before', '--by', 'pm']);
  ok('rank refuses --before with no ticket to rank against', bareBefore.code === 1 && /need a ticket ref/.test(bareBefore.out));
  ok('rank refuses a ticket ranked against itself', run(['rank', C, '--after', C, '--by', 'pm']).code === 1);
  ok('rank refuses an unattributed change', run(['rank', C, '--top']).code === 1);

  const quiet = snap();
  run(['rank', C, '--by', 'pm']);
  ok('a refused rank writes nothing at all', JSON.stringify(snap()) === JSON.stringify(quiet));

  // Ordering is per COLUMN, so ranking across one is meaningless rather than merely odd.
  run(['move', A, 'todo', '--by', 'pm']);
  ok('rank refuses to order against a ticket in another column',
     run(['rank', C, '--after', A, '--by', 'pm']).code === 1);
}

// --- THE MUTATOR LIST IS HAND-KEPT AND LOAD-BEARING, SO IT IS CHECKED AGAINST THE CODE ------
// qa-tester found rank missing from MUTATORS at the ST-080 gate, so ST-073's durable-store
// warning did not fire for the one command that ticket added. That is the THIRD time this list
// has gone stale: delete and restore were both missing from it one session earlier. A hand-kept
// list that must track something else gets a CHECK, never a third correction. S39.
//
// WHAT THIS CHECK CANNOT SEE, stated because a blind spot nobody has written down reads as
// completeness. It finds writers by searching each command body for save( or writeJson( BY
// NAME, so a command that writes through fs directly is invisible to it: qa-tester added a
// guarded fs.writeFileSync to commands.show and this suite stayed GREEN. That is not
// hypothetical -- board.js already calls fs.mkdirSync inside commands.init today, and init
// passes only because it ALSO calls writeJson. The body parse has one further hole: a command
// NOT in MUTATORS whose save() sits after a nested arrow closing at column 0 is missed, and
// direction two cannot rescue it because the command is not listed. The symmetric case IS
// caught. These are the limits of reading text rather than running commands, and the honest
// response is to say so here rather than to build an ever cleverer parser.
{
  const SQ = String.fromCharCode(39);
  const srcTxt = fs.readFileSync(path.join(__dirname, 'board.js'), 'utf8');
  const mstart = srcTxt.indexOf('const MUTATORS = [');
  const listed = srcTxt.slice(mstart, srcTxt.indexOf(']', mstart)).split(SQ).filter((s, i) => i % 2 === 1);
  const writes = [];
  for (const p of srcTxt.split('commands.').slice(1)) {
    const name = p.slice(0, p.indexOf(' ='));
    if (!/^[a-z]+$/.test(name)) continue;
    // The top-level close is at column 0; a nested arrow body closes indented, so it is not cut.
    const body = p.split(NLT + '};')[0];
    if (body.indexOf('save(') > -1 || body.indexOf('writeJson(') > -1) writes.push(name);
  }
  // Without this, two empty lists would satisfy both checks below and prove nothing.
  ok('the two lists are non-empty, so this check cannot pass vacuously', listed.length > 5 && writes.length > 5);
  ok('every command that writes to disk is named in MUTATORS', writes.every(w => listed.indexOf(w) > -1));
  ok('and MUTATORS names no command that does not write', listed.every(m => writes.indexOf(m) > -1));
}

// --- --before HAS BEHAVIOUR, NOT ONLY REFUSALS ----------------------------------------------
// qa-tester: three separate mutations of --before left the suite green at 87. The refusals were
// asserted and the placement never was, so one of the four documented placements could have been
// silently broken. Asserting the ORDER it produces and the VALUE it writes, not that it ran.
{
  const mk2 = title => run(['add', title, '--desc', 'fixture', '--size', 'small']).out.trim().split(' ')[0];
  const D = mk2('BEFORE anchor'), E = mk2('BEFORE target'), G = mk2('BEFORE mover');
  const refs2 = out => (out.match(/SA-[0-9]+/g) || []);
  const eff2 = r => { const x = ticket(r); return typeof x.position === 'number' ? x.position : x.num; };
  const at2 = (out, ref) => out.indexOf(ref);

  // S54, from qa-tester: everything below depends on D being E's immediate predecessor, and
  // nothing asserted it. Inserting a fourth fixture between them left the suite green, so the
  // assertions passed while THE ONE ABOVE IT was a ticket the fixture never named.
  const layout = refs2(run(['list', 'backlog']).out);
  ok('the fixture layout the --before assertions stand on actually holds',
     layout.indexOf(E) === layout.indexOf(D) + 1);

  run(['rank', G, '--before', E, '--by', 'pm']);
  const lb = run(['list', 'backlog']).out;
  ok('--before places the ticket immediately ahead of its target', at2(lb, D) < at2(lb, G) && at2(lb, G) < at2(lb, E));
  ok('and --before writes a position strictly between the target and the one above it',
     eff2(G) > eff2(D) && eff2(G) < eff2(E));
  // An assertion that could not fail independently was DELETED here (ST-087). It read
  // ok('and --before is not --after', eff2(G) < eff2(E)) and that is a strict conjunct of the
  // assertion directly above, so it went red only when that one did. It added no discrimination
  // and inflated the count by one. An assertion that cannot fail alone is a count, not a check.

  const headRef = refs2(run(['list', 'backlog']).out).filter(r => r !== G)[0];
  run(['rank', G, '--before', headRef, '--by', 'pm']);
  ok('--before the head of a column puts the ticket at the head', refs2(run(['list', 'backlog']).out)[0] === G);
  ok('and it writes a position below the old head rather than tying with it', eff2(G) < eff2(headRef));
}

// --- THE RANKING CONTROLS THAT NOTHING HELD IN PLACE ----------------------------------------
// qa-tester's round-one minors. Every one of these works today and was held in place by
// nothing, so an ordinary refactor could have removed it with the suite green. That is the S55
// shape one level down: not a break, an unguarded correctness.
{
  const mk3 = title => run(['add', title, '--desc', 'fixture', '--size', 'small']).out.trim().split(' ')[0];
  const refs3 = out => (out.match(/SA-[0-9]+/g) || []);

  // 1. THE SELF-EXCLUSION. rank builds its column EXCLUDING the ticket being ranked. Without
  // that, --bottom measures against the ticket's own position and walks it further out on every
  // call. Idempotence is what proves the exclusion is there, and it is asserted by reading the
  // position back rather than by the command not refusing.
  const X = mk3('EXCL mover');
  run(['rank', X, '--bottom', '--by', 'pm']);
  const settled = ticket(X).position;
  run(['rank', X, '--bottom', '--by', 'pm']);
  ok('ranking a ticket to the bottom twice leaves it exactly where it was', ticket(X).position === settled);

  // 2. THE TWO OUTPUT SURFACES. A founder reads these two lines and nothing else, and both
  // could be deleted with a green suite.
  const V = mk3('SHOW rank');
  const ranked = run(['rank', V, '--bottom', '--by', 'pm']);
  const printed = refs3(ranked.out);
  ok('rank prints the resulting column order, not just a confirmation', printed.length > 3);
  ok('and the printed order reflects the move just made', printed[printed.length - 1] === V);
  ok('show reports the rank of a ranked ticket', run(['show', V]).out.indexOf('rank ' + ticket(V).position) > -1);
  const NEVER = mk3('NEVER ranked');
  ok('and show says nothing about rank for a ticket never ranked', run(['show', NEVER]).out.indexOf('rank ') === -1);

  // 3. THE FINITE-POSITION GUARD. Two neighbours at the top of the double range make their own
  // midpoint overflow to Infinity, which sorts unpredictably and cannot be diagnosed by reading
  // the file. qa-tester proved the guard reachable by hand; nothing asserted it. This is last
  // because it deliberately poisons two fixtures.
  const P = mk3('GUARD low'), Q = mk3('GUARD high'), R = mk3('GUARD mover');
  const huge = 1.7976931348623157e308;
  for (const ref of [P, Q]) {
    const f = path.join(SANDBOX, 'tickets', ref + '.json');
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    j.position = huge;
    fs.writeFileSync(f, JSON.stringify(j, null, 2) + NLT);
  }
  const overflow = run(['rank', R, '--after', P, '--by', 'pm']);
  ok('a midpoint that would overflow to Infinity is refused', overflow.code === 1);
  ok('and the refusal names what went wrong', /not a finite number/.test(overflow.out));
  ok('and the refused ticket really was left unwritten', ticket(R).position === undefined);
}

// --- THE READABLE SURFACE: BOARD.md is rendered on every mutation ---------------------------
// design-lead raised this at the front door as objection 7: the site says UAT is the one point
// on the board that waits for a PERSON, and a board readable only through a CLI would make that
// the one thing they cannot look at. Asserted by reading the rendered file back, never by the
// command not refusing (S55).
{
  const boardMd = path.join(SANDBOX, 'BOARD.md');
  const ref = run(['add', 'RENDER a visible ticket', '--desc', 'fixture', '--size', 'small']).out.trim().split(' ')[0];
  ok('a mutation writes BOARD.md', fs.existsSync(boardMd));
  const first = fs.readFileSync(boardMd, 'utf8');
  ok('and it lists the ticket that was just created', first.indexOf(ref) > -1);
  ok('and it says it is generated, so nobody edits it by hand', /Do not edit by hand/.test(first));
  ok('and it names the columns a reader is looking for', /## BACKLOG/.test(first));

  // It must be REWRITTEN rather than appended to, or the readable surface becomes the very
  // thing it exists to prevent: a document that grows forever and is never true.
  fs.writeFileSync(boardMd, 'STALE CONTENT', 'utf8');
  run(['add', 'RENDER a second ticket', '--desc', 'fixture', '--size', 'small']);
  const second = fs.readFileSync(boardMd, 'utf8');
  ok('a later mutation rewrites it rather than leaving stale content', second.indexOf('STALE CONTENT') === -1);
  ok('and the rewrite still carries the earlier ticket', second.indexOf(ref) > -1);

  // A read-only command must not write, or every glance at the board dirties the repository.
  fs.writeFileSync(boardMd, 'UNTOUCHED', 'utf8');
  run(['list']);
  ok('a command that changes nothing does not rewrite BOARD.md',
     fs.readFileSync(boardMd, 'utf8') === 'UNTOUCHED');

  // Parked and killed are statuses and not columns. A render that shows only columns hides
  // every ending, which is the half of S27 that a board usually gets wrong.
  const kref = run(['add', 'RENDER a killed ticket', '--desc', 'fixture', '--size', 'small']).out.trim().split(' ')[0];
  run(['close', kref, '--as', 'killed', '--reason', 'decided against', '--by', 'pm']);
  const third = fs.readFileSync(boardMd, 'utf8');
  ok('an ending is visible in the rendered board, not just the columns',
     /## KILLED/.test(third) && third.indexOf(kref) > -1);
}
junk.forEach(d => fs.rmSync(d, { recursive: true, force: true }));
fs.rmSync(SANDBOX, { recursive: true, force: true });
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
