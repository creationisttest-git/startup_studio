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
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-' + tag + '-'));
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
        decisions: [{ key: 'd1', at: d.at, by: 'studio', question: d.q || 'fixture question',
          options: ['a', 'b'], recommend: 1, answer: 1, answered_at: d.answered }],
      }), 'utf8');
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

const EXPECTED_ASSERTIONS = 27;
const ranBefore = pass + fail;
ok('the suite ran every assertion: ran ' + (ranBefore + 1) + ' of ' + EXPECTED_ASSERTIONS
  + '. A block was skipped or deleted. Find out which before you change the number.',
  ranBefore === EXPECTED_ASSERTIONS - 1);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
