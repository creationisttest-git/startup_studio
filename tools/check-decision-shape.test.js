'use strict';
/*
 * Every assertion here has been watched failing, by mutation, against a saved copy of the working
 * file rather than against git (S200). The two mutations that drove the design are named on the
 * assertions they redden: dropping the UPPER bound on the prompt window, and letting a board
 * timestamp parse in the local zone instead of UTC.
 *
 * WHY THIS FILE EXISTS AT ALL. This repository has twice shipped a proof nothing ran: a refusals
 * test that was executed by no test run anywhere (ST-065), and board.js, which enforced the
 * studio's rules for every rehearsal with no tests of any kind. A new instrument with a hand-run
 * mutation behind it and no committed assertion is the same defect with a fresher date on it.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TOOL = path.join(__dirname, 'check-decision-shape.js');
const mod = require('./check-decision-shape.js');
const gate = require('./check-gate-dispatch.js');
/* ST-281: fixture roots come from ONE place that makes them unique and removes them at exit. */
const { fixtureRoot } = require('./tmp-fixtures.js');

let pass = 0, fail = 0;
function ok (name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL  ' + name); } }

// Exit codes are read from the PROCESS and never through a pipe. A pipe reports the exit of the
// last command in it, which has said 0 over a refusal in this project more than once (S159).
function run (args, env) {
  try {
    const out = execFileSync('node', [TOOL].concat(args), {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: Object.assign({}, process.env, env || {}),
    });
    return { code: 0, out: out.toString() };
  } catch (e) {
    return { code: e.status === undefined ? -1 : e.status, out: ((e.stdout || '') + (e.stderr || '')).toString() };
  }
}

// A fixture world: a home holding one transcript for one project, and a board beside it. The
// transcript spans 00:00 to 00:20 with a single clickable prompt at 00:10, so every decision below
// can be placed deliberately before, inside or after that prompt.
const SID = 'fixture-session-decision-shape';
const T_START = '2026-01-01T00:00:00.000Z';
const T_PROMPT = '2026-01-01T00:10:00.000Z';
const T_END = '2026-01-01T00:20:00.000Z';

function world (tag, opts) {
  const o = opts || {};
  const base = fixtureRoot('dsh-' + tag);
  const root = path.join(base, 'proj');
  fs.mkdirSync(root, { recursive: true });
  const tdir = path.join(base, '.claude', 'projects', gate.projectDirName(root));
  fs.mkdirSync(tdir, { recursive: true });

  const lines = [];
  const reply = (ts, text) => lines.push(JSON.stringify({
    timestamp: ts, message: { role: 'assistant', content: [{ type: 'text', text: text }] },
  }));
  reply(T_START, 'the session opens');
  if (o.noPrompt !== true) {
    lines.push(JSON.stringify({
      timestamp: T_PROMPT,
      message: { role: 'assistant', content: [{ type: 'tool_use', name: 'AskUserQuestion', input: {} }] },
    }));
  }
  if (o.extraReply) reply(T_PROMPT, o.extraReply);
  reply(T_END, 'the session closes');
  fs.writeFileSync(path.join(tdir, SID + '.jsonl'), lines.join('\n') + '\n', 'utf8');

  const board = path.join(base, 'board');
  if (o.noBoard !== true) {
    fs.mkdirSync(board, { recursive: true });
    for (const d of (o.decisions || [])) {
      fs.writeFileSync(path.join(board, d.ref + '.json'), JSON.stringify({
        ref: d.ref, title: 'fixture', status: 'backlog',
        decisions: [Object.assign({ key: 'd1', at: d.at, by: 'studio',
          question: d.q || 'fixture question', options: ['a', 'b'], recommend: 1 },
        // AN OPEN DECISION IS NOT AN ANSWERED ONE WITH A BLANK, it is one carrying neither
        // field, which is what the board writes between `ask` and `answer`. Spelling that
        // out here rather than passing answer: null matters, because the tool's own
        // readable-answer test treats null and absent alike and a fixture that only ever
        // produced one of them would prove nothing about the other.
        d.unanswered ? {} : { answer: 1, answered_at: d.answered })],
      }), 'utf8');
    }
    for (let i = 0; i < (o.corrupt || 0); i++) {
      fs.writeFileSync(path.join(board, 'ST-99' + i + '.json'), '{ "ref": "ST-99' + i + '", oops', 'utf8');
    }
  }
  return { base: base, root: root, board: board, env: { CLAUDE_CODE_SESSION_ID: SID } };
}

// 1 and 2. THE PASS AND THE REFUSAL, which are the same fixture with the window moved. Without
// both, a green run cannot be told from a check that never looks.
{
  const w = world('pass', { decisions: [{ ref: 'ST-901', at: '2026-01-01 00:05:00', answered: '2026-01-01 00:15:00' }] });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board], w.env);
  ok('a decision whose window CONTAINS the prompt passes: got exit ' + r.code, r.code === 0);
}
{
  const w = world('fail', { decisions: [{ ref: 'ST-902', at: '2026-01-01 00:12:00', answered: '2026-01-01 00:18:00', q: 'put after the prompt' }] });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board], w.env);
  ok('a decision whose window holds NO prompt refuses at 1: got exit ' + r.code, r.code === 1);
  ok('the refusal names the ticket, so the reader can find it', /ST-902/.test(r.out));
  ok('the refusal says what the rule actually is rather than only that it failed',
    /clickable|clicking/i.test(r.out));

  // ST-251. THIS FIXTURE RAISES A PROMPT. The refusal used to say the decision reached the founder
  // WITHOUT a clickable prompt, contradicting the count printed three lines above it in the same
  // output, and asserting something the tool cannot see. What it can see is that no prompt falls
  // inside this decision's window, which is an ordering fault with a different remedy.
  ok('the ordering refusal calls it an ordering fault rather than a missing prompt',
    /ORDERING fault/.test(r.out));
  ok('the ordering refusal reports how many prompts the session did raise',
    /this session raised 1\b/.test(r.out));
  ok('the ordering refusal does not claim the founder got no clickable prompt at all',
    !/reached the founder without a clickable prompt/.test(r.out));
}

// 2b. ST-251. THE OTHER CAUSE OF AN EMPTY WINDOW, AND THE ONE THE SINGLE MESSAGE USED TO ASSERT IN
// BOTH CASES. `noPrompt` existed as a fixture option from the first version of this file and NO
// CALLER EVER PASSED IT, so the one input separating "no prompt was raised at all" from "a prompt
// was raised outside the window" was never exercised, and the wording could be rewritten freely
// without reddening anything. A product review named the mutation before running it: adding
// "inside its own window" to the one message left the suite at 20 passed, 0 failed.
{
  const w = world('noprompt', { noPrompt: true, decisions: [{ ref: 'ST-904', at: '2026-01-01 00:05:00', answered: '2026-01-01 00:15:00' }] });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board, '--report'], w.env);
  ok('a session that raised NO prompt at all still refuses at 1: got exit ' + r.code, r.code === 1);
  ok('the no-prompt refusal says the decision reached the founder without one',
    /reached the founder without a clickable prompt/.test(r.out));
  ok('the no-prompt refusal is not the ordering message', !/ORDERING fault/.test(r.out));
  ok('the no-prompt report labels the decision PROSE', /PROSE\s+ST-904/.test(r.out));
}

// 3. THE UPPER BOUND, which is mutation m1. Removing `p.at <= upper` took this fixture from exit 1
// to exit 0, because the 00:10 prompt is merely LATER than an ask at 00:02. One prompt would
// otherwise satisfy every later decision in the session at once.
{
  const w = world('upper', { decisions: [{ ref: 'ST-903', at: '2026-01-01 00:02:00', answered: '2026-01-01 00:04:00' }] });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board], w.env);
  ok('a prompt AFTER the answer does not satisfy the decision, so the window is bounded above: got exit ' + r.code,
    r.code === 1);
}

// 4. CANNOT TELL IS NOT A PASS, and each of its three causes is separated. Collapsing any of them
// into 0 would report a clean bill of health over a measure that never ran.
{
  const w = world('outside', { decisions: [{ ref: 'ST-904', at: '2025-12-31 00:00:00', answered: '2025-12-31 00:01:00' }] });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board], w.env);
  ok('a decision OUTSIDE the session window is not judged, exit 3: got exit ' + r.code, r.code === 3);
}
{
  const w = world('noboard', { noBoard: true });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board], w.env);
  ok('no board gives CANNOT TELL rather than a refusal, because a project with no board is not '
    + 'a project in breach (S202): got exit ' + r.code, r.code === 3);
}
{
  const w = world('notrans', {});
  const r = run(['--root', path.join(w.base, 'nowhere'), '--home', w.base, '--board', w.board], w.env);
  ok('no transcript directory gives CANNOT TELL: got exit ' + r.code, r.code === 3);
}

// 5. A PROMPT WITH NO BOARD ASK IS REPORTED AND NOT REFUSED ON. The ask may sit on a ticket this
// board cannot see, so the tool says so rather than calling it a breach.
{
  const w = world('noask', { decisions: [] });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board], w.env);
  ok('a prompt with no board ask is reported, not refused: got exit ' + r.code, r.code === 3);
  ok('and the report says the prompt was raised, so the reader is not left guessing',
    /prompt\(s\) WERE raised/.test(r.out));
}

// 6. USAGE. A flag given without its value must refuse rather than silently taking the next flag
// as a directory, which is how a check ends up measuring the wrong tree.
ok('--board with no value exits 2', run(['--board']).code === 2);
ok('--root with no value exits 2', run(['--root']).code === 2);

// 7. boardTime IS MUTATION m2. The board stamps UTC and this machine is on UTC+10, so dropping the
// forced Z shifted every decision out of its own session and turned exit 0 into exit 3.
ok('a board timestamp is read as UTC whatever the local zone is',
  mod.boardTime('2026-01-01 00:05:00') === Date.parse('2026-01-01T00:05:00Z'));
ok('an explicit zone on a board timestamp is respected rather than overwritten',
  mod.boardTime('2026-01-01T00:05:00+10:00') === Date.parse('2026-01-01T00:05:00+10:00'));
ok('rubbish reads as no timestamp rather than as the epoch', mod.boardTime('not a date') === null);

// 8. THE REPORTED HALF IS DELIBERATELY LOOSE AND MUST STAY LOOSE. It needs two numbered items AND a
// question mark, and it must not see numbered lines inside a fenced block, because pasting a tool's
// numbered output is the behaviour the brevity rule asks for.
ok('one numbered item and a question is not a candidate',
  mod.proseAskCandidates([{ at: 1, text: '1. only one\nshall I?' }]).length === 0);
ok('two numbered items with no question is not a candidate',
  mod.proseAskCandidates([{ at: 1, text: '1. one\n2. two\nhere they are.' }]).length === 0);
ok('two numbered items and a question IS a candidate',
  mod.proseAskCandidates([{ at: 1, text: '1. one\n2. two\nwhich?' }]).length === 1);
ok('numbered lines inside a fenced block do not count, so quoted tool output is not a candidate',
  mod.proseAskCandidates([{ at: 1, text: '```\n1. one\n2. two\n```\nwhich?' }]).length === 0);

// 9. ST-252. A BOARD NOBODY CAN READ IS NOT A BOARD WITH NOTHING ON IT, and the exit code cannot
// tell them apart: both are CANNOT TELL at 3. That is exactly why the first assertion here is
// worth little on its own and the two below it are the measure. Reverting the new branch leaves
// this fixture at exit 3 and changes only the words, which is the S190 check made before running:
// name the input on which mutant and original differ, and here it is the message and not the code.
{
  const w = world('allcorrupt', { corrupt: 3 });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board], w.env);
  ok('a board whose every ticket file fails to parse is CANNOT TELL, not a pass and not a '
    + 'refusal: got exit ' + r.code, r.code === 3);
  ok('and it says the files could not be parsed, so the reader knows the reading never happened',
    /3 ticket file\(s\) on the board failed to parse/.test(r.out));
  ok('and it does NOT claim no decision was written, which is asserting more than it measured '
    + '(S207)', !/No decision was written to the board/.test(r.out));
}

// 9b. THE ESCALATION MUST NOT SWALLOW A REAL REFUSAL. Widening its predicate from nothing was
// readable to something was unreadable turns this fixture from exit 1 into exit 3, which is a
// breach reported as unknowable. One corrupt file beside one readable decision with no prompt in
// its window is the input that separates the two.
{
  const w = world('partcorrupt', { corrupt: 1, decisions: [{ ref: 'ST-905', at: '2026-01-01 00:12:00', answered: '2026-01-01 00:18:00' }] });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board], w.env);
  ok('a PARTLY corrupt board still judges what it could read, so the refusal survives: got exit '
    + r.code, r.code === 1);
  ok('and the note says how many files of how many were skipped, so the verdict carries its own '
    + 'coverage', /note  1 of 2 ticket file\(s\) could not be parsed/.test(r.out));
}

// 9c. THE DEFECT ITSELF. The note used to print only on the path where a decision had been found,
// so the one case that most needs it, an empty result, was the one case that never got it. A
// corrupt file beside a decision dated outside the session reaches the empty path with something
// genuinely unread, and moving the note back below the branch reddens this and nothing else.
{
  const w = world('corruptempty', { corrupt: 1, decisions: [{ ref: 'ST-906', at: '2025-12-31 00:00:00', answered: '2025-12-31 00:01:00' }] });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board], w.env);
  ok('an empty result still reports the files it could not read: got exit ' + r.code, r.code === 3);
  ok('the note reaches the path where NO decision was found, which is where it was missing',
    /could not be parsed/.test(r.out));
}


// 13. ST-259. THE GATE AT THE MOMENT THE SESSION CAN STILL ACT, which is the whole reason this
// second entry point exists. The wind-down reading above runs after every decision of the sitting
// has been put and can only record; --at-answer runs before the board answer is written, so a
// refusal is cleared by raising the prompt and running the command again. These assertions were
// watched failing by mutation against a saved copy of the working file, not against git (S200).
{
  // THE PASS. An OPEN decision with a prompt raised after its ask.
  const w = world('gate-pass', {
    decisions: [{ ref: 'ST-911', at: '2026-01-01 00:05:00', unanswered: true }],
  });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board, '--at-answer', 'ST-911'], w.env);
  ok('--at-answer passes an open decision that has a prompt after its ask: got exit ' + r.code,
    r.code === 0);
  ok('the pass names the ticket it cleared', /ST-911/.test(r.out));
}
{
  // THE REFUSAL, and it is the one the founder asked for. Same fixture, no prompt anywhere.
  const w = world('gate-fail', {
    noPrompt: true,
    decisions: [{ ref: 'ST-912', at: '2026-01-01 00:05:00', unanswered: true, q: 'park it or carry it' }],
  });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board, '--at-answer', 'ST-912'], w.env);
  ok('--at-answer REFUSES an open decision with no prompt raised since the ask: got exit ' + r.code,
    r.code === 1);
  ok('the refusal names the ticket so the reader can find it', /ST-912/.test(r.out));
  ok('the refusal quotes the question, not only the reference', /park it or carry it/.test(r.out));
  // THE REMEDY HAS TO BE PERFORMABLE, WHICH IS THE DIFFERENCE FROM THE ORDER FAULT ABOVE. Nothing
  // clears a decision already stamped before its prompt; this one is cleared by raising the prompt
  // now. An unperformable remedy is the S148, S177, S178 class and it is what this avoids.
  ok('the refusal tells the session what to do NOW rather than next time',
    /then run this answer again/i.test(r.out));
  ok('the refusal names the clicking, because that is the rule being enforced',
    /CLICKING/.test(r.out));
}
{
  // A PROMPT RAISED BEFORE THE ASK DOES NOT COUNT, which is the ordering rule enforced at the only
  // moment it can still be obeyed. The prompt sits at 00:10 and the ask at 00:15.
  const w = world('gate-order', {
    decisions: [{ ref: 'ST-913', at: '2026-01-01 00:15:00', unanswered: true }],
  });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board, '--at-answer', 'ST-913'], w.env);
  ok('--at-answer refuses when the only prompt predates the ask: got exit ' + r.code, r.code === 1);
}
{
  // AN ALREADY ANSWERED DECISION IS NOT HELD UP. Re-answering is how a wrong answer gets corrected,
  // and a gate that blocked the repair would be worse than the defect.
  const w = world('gate-answered', {
    decisions: [{ ref: 'ST-914', at: '2026-01-01 00:05:00', answered: '2026-01-01 00:15:00' }],
  });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board, '--at-answer', 'ST-914'], w.env);
  ok('--at-answer does not refuse a decision that already carries an answer: got exit ' + r.code,
    r.code === 3);
}
{
  // A TICKET WITH NO DECISION AT ALL IS CANNOT TELL, NOT A BREACH. Most board commands touch
  // tickets that were never put to the founder, and refusing on those would make the gate noise.
  const w = world('gate-none', {
    decisions: [{ ref: 'ST-915', at: '2026-01-01 00:05:00', unanswered: true }],
  });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board, '--at-answer', 'ST-999'], w.env);
  ok('--at-answer on a ticket holding no open decision reports rather than refuses: got exit '
    + r.code, r.code === 3);
}
{
  // --decision NARROWS TO ONE KEY. Without it a ticket holding several open questions is judged as
  // a whole, which would refuse a correct answer to the one question that did get its prompt.
  const w = world('gate-key', {
    decisions: [{ ref: 'ST-916', at: '2026-01-01 00:05:00', unanswered: true }],
  });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board,
    '--at-answer', 'ST-916', '--decision', 'd9'], w.env);
  ok('--at-answer with a key that matches no open decision reports rather than refuses: got exit '
    + r.code, r.code === 3);
}
{
  // USAGE. A flag with no value is a typo, and answering it with a pass would let the gate be
  // switched off by accident.
  const w = world('gate-usage', { decisions: [] });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board, '--at-answer'], w.env);
  ok('--at-answer with no reference after it exits 2 rather than passing: got exit ' + r.code,
    r.code === 2);
}

const EXPECTED_ASSERTIONS = 46;
const ranBefore = pass + fail;
ok('the suite ran every assertion: ran ' + (ranBefore + 1) + ' of ' + EXPECTED_ASSERTIONS
  + '. A block was skipped or deleted. Find out which before you change the number.',
  ranBefore === EXPECTED_ASSERTIONS - 1);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
