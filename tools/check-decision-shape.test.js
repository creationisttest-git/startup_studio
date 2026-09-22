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
      // ST-304. THE PROMPT'S OWN OPTION LABELS, so the board's claim about what was offered can be
      // held against what was shown. Absent by default, which keeps every fixture above testing
      // only whether a prompt happened and keeps a shape this cannot read from reading as a gap.
      message: { role: 'assistant', content: [{ type: 'tool_use', name: 'AskUserQuestion',
        input: o.promptLabels
          ? { questions: [{ question: 'fixture', options: o.promptLabels.map(l => ({ label: l, description: 'what happens' })) }] }
          : {} }] },
    }));
  }
  // A SECOND PROMPT INSIDE THE SAME WINDOW, which every fixture above was unable to build and
  // which is the ordinary shape here: two asks in flight, one prompt each, both inside both
  // windows. It is the input that exposed the erasure, where one prompt this tool could not read
  // cleared a finding another prompt had already earned. ST-240.
  //
  // ORDER MATTERS AND THE CALLER CONTROLS IT BY CHOOSING WHICH SET IS THE MAIN PROMPT. The main
  // prompt is written first and these are written after it, so putting the unreadable labels in
  // promptLabels and the reordering in extraPromptLabels tests the other direction. A fixture that
  // can only build one ordering measures one direction while reading as though it covered both,
  // and a mutation stopping a finding from displacing a cannot-tell survived the first version of
  // this suite for exactly that reason.
  const emitPrompt = (labels) => lines.push(JSON.stringify({
    timestamp: T_PROMPT,
    message: { role: 'assistant', content: [{ type: 'tool_use', name: 'AskUserQuestion',
      input: { questions: [{ question: 'second', options: labels.map(l => ({ label: l, description: 'what happens' })) }] } }] },
  }));
  // A PROMPT THIS TOOL CANNOT PARSE AT ALL, which is a different input from one it can parse and
  // disagrees with. labelsOf returns an empty list for it, and that list used to reach optionOrder
  // and come back as agreement.
  if (o.extraEmptyPrompt) lines.push(JSON.stringify({
    timestamp: T_PROMPT,
    message: { role: 'assistant', content: [{ type: 'tool_use', name: 'AskUserQuestion', input: {} }] },
  }));
  if (o.extraPromptLabels) emitPrompt(o.extraPromptLabels);
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
          question: d.q || 'fixture question', options: d.options || ['a', 'b'], recommend: 1 },
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

// --- THE RECORD MUST NOT CLAIM AN OPTION THAT WAS NEVER SHOWN -----------------------------------
/* ST-304. This check asked one question, whether a prompt was raised, and on the sitting that found
   this it exited 0 on all five decisions while THREE of them wrote four options to the board and
   put three to the founder, dropping the explicit escape every time. Nobody was ever trapped,
   because the host adds an Other of its own, and that is exactly why it survived five rounds of
   self-checking: the prompt LOOKS complete and the defect is in the RECORD. The next session cites
   the board and cannot tell a recorded escape from an offered one.

   IT REFUSES AT --at-answer AND NOWHERE ELSE, which is a deliberate choice about remedies. At that
   moment the answer has not been written, so raising a corrected prompt clears it. After the answer
   the only thing left to edit is the record, and a record edited to agree with itself proves
   nothing.

   AND IT COUNTS RATHER THAN COMPARING TEXT. The host marks a recommendation and may present a label
   differently from the string written to the board, so demanding equality would refuse correct
   work. A board naming MORE options than the prompt carried is unambiguous. A prompt carrying more
   than the board names is not this defect: that is the host's own Other, and the negative control
   below holds that line. */
{
  const w = world('gap', { promptLabels: ['do it', 'do not', 'wait'],
    decisions: [{ ref: 'ST-910', at: '2026-01-01 00:05:00', unanswered: true,
      options: ['do it', 'do not', 'wait', 'something else, say what'] }] });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board, '--at-answer', 'ST-910'], w.env);
  ok('a board naming four options against a prompt showing three REFUSES: got exit ' + r.code,
    r.code === 1);
  ok('and it says which way round the mismatch is, in numbers',
    /board names 4 option\(s\), prompt showed 3, 1 missing/.test(r.out));
  ok('and it prints BOTH lists, because the missing one is what the reader has to see',
    /something else, say what/.test(r.out) && /shown:/.test(r.out));
  /* The remedy is now stated PER SHAPE, because one sentence covering both was false over a
     reordering: it said the board had claimed an option that was never shown when every option
     had been shown, and the remedy it named reproduced the refusal. ST-304, content gate. */
  ok('and it names the remedy that is still available at this moment, for the shape it found',
    /raise the prompt again with every option the ask names/i.test(r.out));
}
{
  // THE CONTROL THAT STOPS THIS BECOMING A REFUSAL OF EVERY DECISION. Same shape, matching counts.
  const w = world('nogap', { promptLabels: ['do it', 'do not', 'something else, say what'],
    decisions: [{ ref: 'ST-911', at: '2026-01-01 00:05:00', unanswered: true,
      options: ['do it', 'do not', 'something else, say what'] }] });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board, '--at-answer', 'ST-911'], w.env);
  ok('matching option counts pass: got exit ' + r.code, r.code === 0);
  ok('and the pass says nothing about options, because a check that speaks when it agrees teaches '
    + 'its reader to ignore it', !/option\(s\), prompt showed/.test(r.out));
}
{
  // AND THE OTHER DIRECTION IS NOT A DEFECT. The host adds an escape of its own, so a prompt can
  // legitimately carry more than the ask names. Refusing on that would punish the correct case.
  const w = world('extra', { promptLabels: ['do it', 'do not', 'mine', 'Other'],
    decisions: [{ ref: 'ST-912', at: '2026-01-01 00:05:00', unanswered: true,
      options: ['do it', 'do not', 'mine'] }] });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board, '--at-answer', 'ST-912'], w.env);
  ok('a prompt showing MORE than the board names is not refused: got exit ' + r.code, r.code === 0);
}
{
  // A PROMPT THIS CANNOT READ IS NOT EVIDENCE THAT FEWER OPTIONS WERE SHOWN. Every fixture above
  // this block records a prompt with no readable options at all, and none of them may start
  // failing on that account. S219: silence about a thing and a finding about it are different.
  const w = world('unreadable', {
    decisions: [{ ref: 'ST-913', at: '2026-01-01 00:05:00', unanswered: true,
      options: ['do it', 'do not', 'wait', 'something else, say what'] }] });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board, '--at-answer', 'ST-913'], w.env);
  ok('a prompt whose options cannot be read passes rather than inventing a gap: got exit ' + r.code,
    r.code === 0);
}
{
  // The two helpers directly, because the null cases decide whether silence can ever be mistaken
  // for agreement and no end-to-end fixture distinguishes them from a genuine match.
  ok('labelsOf reads every label across a prompt\'s questions',
    mod.labelsOf({ questions: [{ options: [{ label: 'x' }, { label: 'y' }] }, { options: [{ label: 'z' }] }] })
      .join(',') === 'x,y,z');
  ok('labelsOf returns nothing for a shape it does not recognise', mod.labelsOf(null).length === 0);
  ok('optionGap is null when the board records no options', mod.optionGap([], ['a']) === null);
  ok('optionGap is null when the prompt could not be read', mod.optionGap(['a', 'b'], []) === null);
  ok('optionGap counts the shortfall when the board names more', 
    mod.optionGap(['a', 'b', 'c'], ['a', 'b']).missing === 1);
}

// --- AND THE SAME OPTIONS IN A DIFFERENT ORDER, WHICH CAN WRITE A FALSE RULING -------------------
/* ST-304, second shape, found the sitting after the first. The board answers by NUMBER and stores
   the TEXT of that option, so a prompt listing the same options in a different order means the
   number the session passes does not address the option the founder clicked. Measured once: an
   answer recorded as option 3 had been clicked in position 1, because the prompt marks the
   recommendation first and the ask did not. Nobody was misled in the room, and the RECORD was
   wrong, which is the half that outlives the conversation.

   NORMALISED BEFORE COMPARING, because the host marks the recommendation and the board does not,
   so a raw comparison would fire on every correctly ordered decision. And it reports ONLY a
   genuine reordering of the same options: when the two sides carry different text this says
   nothing, because that is the other fault and a message naming both names neither. */
{
  const w = world('order', { promptLabels: ['wait (Recommended)', 'do it', 'do not'],
    decisions: [{ ref: 'ST-914', at: '2026-01-01 00:05:00', unanswered: true,
      options: ['do it', 'do not', 'wait'] }] });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board, '--at-answer', 'ST-914'], w.env);
  ok('the same options in a different order REFUSE, because the answer is written by number: got exit '
    + r.code, r.code === 1);
  ok('and it names the position where the two disagree, so the reader can see which number is wrong',
    /position 1/.test(r.out));
}
{
  // THE CONTROL. Same order, and the host's (Recommended) marking must not be read as a difference.
  const w = world('sameorder', { promptLabels: ['do it (Recommended)', 'do not', 'wait'],
    decisions: [{ ref: 'ST-915', at: '2026-01-01 00:05:00', unanswered: true,
      options: ['do it', 'do not', 'wait'] }] });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board, '--at-answer', 'ST-915'], w.env);
  ok('matching order passes, and the recommendation marking is not a difference: got exit ' + r.code,
    r.code === 0);
}
{
  ok('optionOrder finds the first position where the two disagree',
    mod.optionOrder(['a', 'b', 'c'], ['b (Recommended)', 'a', 'c']).at === 1);
  ok('optionOrder says nothing when the order matches',
    mod.optionOrder(['a', 'b'], ['a (Recommended)', 'b']) === null);
  /* THIS ASSERTION ENCODED THE OLD BELIEF AND HAD TO CHANGE. It required silence when the two
     sides carry different text, which is exactly the condition the real data is ALWAYS in: a host
     label is a short paraphrase of a board option. Under the old predicate that silence was the
     defect, not the feature, and it is why the one recorded instance of the reordering passed. The
     honest answer for a label that names no option is CANNOT TELL, which the caller prints. */
  ok('optionOrder says CANNOT TELL when a label names no option it can pair, rather than passing',
    mod.optionOrder(['a', 'b'], ['a', 'zzz']).unknown === true);
  ok('and a paraphrased label still pairs, which is what the real record always looks like',
    mod.optionOrder(['the studio runs itself towards the founder goals', 'the method is the product'],
      ['the studio runs itself (Recommended)', 'the method is the product']) === null);
  ok('and a paraphrased label that is REORDERED is found, which the old predicate could not do',
    mod.optionOrder(['any founder can run a studio-grade process alone, and the method is the product',
      'the studio runs itself towards the founder goals without them holding it up'],
      ['the studio runs itself (Recommended)', 'the method is the product']).at === 1);
  /* THIS ASSERTION WAS THE DEFECT WRITTEN DOWN AS A REQUIREMENT, AND IT PASSED FOR THAT REASON.
     It demanded null, which this file's own caller reads as AGREEMENT and uses to clear the whole
     decision, so a single prompt with a different option count anywhere in the window erased a
     real finding already made against the same ask. Two asks in flight with one prompt each is the
     ordinary shape here. Its stated justification, that optionGap already covers it, is only half
     true: optionGap covers the board naming MORE than the prompt showed and is silent on the other
     direction, where a prompt shows a fourth option FIRST and a click on position 1 writes board
     option 1. A reviewer found it by running it. Counts differing is now CANNOT TELL, which is
     printed and never counts as agreement. ST-240. */
  ok('counts differing is CANNOT TELL, not agreement, because the caller clears on agreement',
    mod.optionOrder(['a', 'b', 'c'], ['a', 'b']).unknown === true);
  ok('and the other direction too: a prompt showing MORE than the ask names is not a match either',
    mod.optionOrder(['a', 'b', 'c'], ['zzz', 'a', 'b', 'c']).unknown === true);
  /* THE BOARD SIDE OF THE REFUSAL IS THE OPTION AT THAT POSITION. It used to be the option the
     shown label PAIRED to, which by construction reads the same as the label, so the message
     quoted one string twice and told a founder two identical sentences differed. Nothing covered
     the wording of that refusal, which is why it shipped. */
  ok('the refusal names the board option AT the disagreeing position, not the one the label paired to',
    mod.optionOrder(['do it', 'do not', 'wait'], ['wait (Recommended)', 'do it', 'do not']).onBoard === 'do it');
  ok('and the shown side is the label the founder actually saw at that position',
    mod.optionOrder(['do it', 'do not', 'wait'], ['wait (Recommended)', 'do it', 'do not']).shown === 'wait (Recommended)');
  /* THE CANNOT TELL PATH, WHICH THE SHARED RULE NOW PROMISES OUT LOUD. Two options that a single
     label paraphrases equally well cannot be paired, and guessing would invent an ordering finding
     out of nothing. The fragment tells every project that a silent run is not the same as a run
     that agreed, so that sentence needs a test behind it or it is the same unbacked promise the
     content gate already failed once today. */
  ok('two options a label paraphrases alike are CANNOT TELL rather than a guess',
    mod.optionOrder(['deploy the service now', 'deploy the service later'],
      ['deploy the service', 'something else']).unknown === true);
  ok('and a cannot-tell does not refuse: the at-answer gate treats it as a pass',
    mod.pairLabels(['deploy the service now', 'deploy the service later'],
      ['deploy the service', 'something else']) === null);
  /* AND THE REAL RECORDED CASE, which is the whole reason this predicate was rewritten. These are
     the actual strings: the board option set from ST-296 d5 and the labels the founder was shown.
     The previous predicate returned null on exactly this, so the one measured instance of the
     defect passed silently while the shared rule told every project it was caught. */
  ok('the real recorded reordering is FOUND, where the previous predicate returned null',
    mod.optionOrder([
      'Any founder can run a studio-grade process alone, and the method is the product',
      'Projects built here reach customers and revenue rather than stalling',
      "The studio runs itself towards the founder's goals without them holding it up",
      'None of these, and here are my words',
    ], [
      'The studio runs itself (Recommended)',
      'The method is the product',
      'Projects here reach customers',
      'None of these, here are my words',
    ]).at === 1);
}

// --- AND THE WIND-DOWN READING, WHICH IS WHERE IT CRASHED ----------------------------------------
/* A content reviewer found this by RUNNING the case, in the same round that failed the sentence
   claiming this path worked. Every ordering assertion above uses --at-answer, so the session-level
   reading was described in a ticket, in a commit message and in a governance fragment, and executed
   by nothing. It pushed a row carrying `order` and then read `gap.onBoard` on it unconditionally,
   so a reordering threw a TypeError and took the whole check down. check-decision-shape is in the
   wind-down set, so the one moment this reading exists for is the moment it would have died.

   S219 again, in the shape that hurts most: the path had no coverage, so its absence and its
   correctness produced identical evidence, and three separate documents asserted the latter.

   Both shapes are asserted here, not only the one that broke, because a crash fixed by a branch
   is a branch that can be deleted. */
{
  const w = world('sessionorder', { promptLabels: ['wait (Recommended)', 'do it', 'do not'],
    decisions: [{ ref: 'ST-916', at: '2026-01-01 00:05:00', answered: '2026-01-01 00:15:00',
      options: ['do it', 'do not', 'wait'] }] });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board], w.env);
  ok('the wind-down reading survives an ORDER mismatch rather than throwing: got exit ' + r.code,
    r.code === 0 || r.code === 1);
  ok('and it does not throw', !/TypeError/.test(r.out));
  ok('and it says what it found, naming the position', /different order/.test(r.out)
    && /position 1/.test(r.out));
}
{
  const w = world('sessiongap', { promptLabels: ['do it', 'do not', 'wait'],
    decisions: [{ ref: 'ST-917', at: '2026-01-01 00:05:00', answered: '2026-01-01 00:15:00',
      options: ['do it', 'do not', 'wait', 'something else, say what'] }] });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board], w.env);
  ok('the wind-down reading reports a COUNT mismatch too', /board 4, prompt 3, 1 missing/.test(r.out));
  ok('and it does not throw on that shape either', !/TypeError/.test(r.out));
  ok('and its heading covers both shapes rather than naming only the count one',
    /do not match the prompt the founder was shown/.test(r.out));
}

/* --- THE THIRD SHAPE, WHICH CRASHED THE READING IT WAS BUILT FOR -------------------------------
   ST-240. A row carrying neither a gap nor an order finding is a CANNOT TELL, and the wind-down
   printer handled the other two and fell through to read g.gap.onBoard on this one: TypeError,
   exit 1, the whole reading dead. It killed the REAL recorded session fb888d61, where THREE
   decisions pair as cannot-tell: ST-240 d33, ST-296 d3 and ST-296 d4. The heading directly above
   the faulty line describes fixing this same crash for the neighbouring field, one round earlier,
   which is the tell: a fix reached one of two call sites twice running.

   Watched failing: with the printer reverted, all FOUR below redden and the first two redden with
   a TypeError rather than a wrong string, which is what tells the crash apart from a bad message.
   Against the whole suite the same mutation reddened FIVE, the extra being a pre-existing
   assertion this fix had also been protecting without anybody knowing.

   BOTH COUNTS IN THIS COMMENT WERE WRONG WHEN IT WAS FIRST WRITTEN, and a content reviewer caught
   them by running the case. It said "two" where the tool's own output on that session says three,
   output this session had already read and quoted, and "three below" where the block carries four.
   A count is the one kind of claim this project treats as proof, so a wrong one here is worse than
   no comment at all. Read the number off the run, every time, including inside the fix for exactly
   this class of defect. */
{
  const w = world('sessionunknown', { promptLabels: ['zzz one', 'zzz two', 'zzz three'],
    decisions: [{ ref: 'ST-921', at: '2026-01-01 00:05:00', answered: '2026-01-01 00:15:00',
      options: ['do it', 'do not', 'wait'] }] });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board], w.env);
  ok('the wind-down reading does not THROW on a prompt it cannot pair', !/TypeError/.test(r.out));
  ok('and it exits cleanly rather than dying: got exit ' + r.code, r.code === 0);
  ok('and it SAYS cannot tell rather than printing nothing, which is the whole claim the shared '
    + 'rule makes about this tool', /CANNOT TELL/.test(r.out) && /ST-921/.test(r.out));
  ok('and it does not count a cannot-tell as a decision that failed to match',
    !/1 decision\(s\) do not match/.test(r.out));
}

/* --- CANNOT TELL HAS TO REACH THE SCREEN AT --at-answer TOO ------------------------------------
   The unknowns were collected here and never written, so a decision the check could not read came
   back as the same bare OK line as one it had read and agreed with. The rule composed into all
   seventeen roles tells its reader to READ WHAT IT PRINTED rather than trust the exit code, and
   there was nothing printed to read. That sentence was false on the day it shipped. */
{
  const w = world('atanswerunknown', { promptLabels: ['zzz one', 'zzz two'],
    decisions: [{ ref: 'ST-922', at: '2026-01-01 00:05:00', unanswered: true,
      options: ['do it', 'do not'] }] });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board, '--at-answer', 'ST-922'], w.env);
  ok('a cannot-tell still PASSES at the answer gate, because refusing would make it unanswerable: '
    + 'got exit ' + r.code, r.code === 0);
  ok('but it is PRINTED, so a silent run and an agreeing run are no longer the same output',
    /CANNOT TELL/.test(r.out) && /ST-922/.test(r.out));
  ok('and it says plainly that this is not agreement',
    /NOT a statement that they agree/.test(r.out));
}

/* --- ONE UNREADABLE PROMPT MUST NOT ERASE A FINDING ANOTHER PROMPT EARNED -----------------------
   ST-240 HIGH 2, found by a reviewer running it. optionOrder returned null both for IN ORDER and
   for CANNOT COMPARE, and the caller reads null as a clean match that settles the whole decision
   and stops looking. So a second prompt in the window with a different option count cleared a
   reordering already found against the same ask. Two asks in flight with one prompt each is the
   ordinary shape here, so this is not an exotic input.

   The control underneath is the half that makes it a measurement: the same reordering ALONE must
   still refuse, otherwise this pair would pass with the check simply broken. */
{
  const w = world('erasure', { promptLabels: ['wait (Recommended)', 'do it', 'do not'],
    extraPromptLabels: ['one', 'two', 'three', 'four', 'five'],
    decisions: [{ ref: 'ST-923', at: '2026-01-01 00:05:00', unanswered: true,
      options: ['do it', 'do not', 'wait'] }] });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board, '--at-answer', 'ST-923'], w.env);
  ok('a later prompt the tool cannot compare does NOT clear a reordering already found: got exit '
    + r.code, r.code === 1);
  ok('and the refusal still names the reordering rather than the unreadable prompt',
    /different order/.test(r.out));
  const c = world('erasurecontrol', { promptLabels: ['wait (Recommended)', 'do it', 'do not'],
    decisions: [{ ref: 'ST-924', at: '2026-01-01 00:05:00', unanswered: true,
      options: ['do it', 'do not', 'wait'] }] });
  const rc = run(['--root', c.root, '--home', c.base, '--board', c.board, '--at-answer', 'ST-924'], c.env);
  ok('CONTROL: the same reordering alone refuses, so the pair above measures the erasure and not '
    + 'a check that has simply stopped working: got exit ' + rc.code, rc.code === 1);
  ok('CONTROL: and the refusal quotes two DIFFERENT strings, having once quoted the same one twice',
    /board says "do it" and the prompt showed "wait \(Recommended\)"/.test(rc.out));
}

/* --- THE ERASURE IN THE OTHER TRANSCRIPT ORDER -------------------------------------------------
   A re-review mutated the rank so a finding could no longer displace a cannot-tell, and the block
   above SURVIVED it, because its fixture happens to meet the reordering first. Order is the whole
   mechanism here and a fixture that can only build one direction measures half of it while reading
   as though it covered both. That is the same fault as a fixture that cannot reach its own branch.
   Here the unreadable prompt is seen FIRST and the reordering has to displace it. */
{
  const w = world('erasurereverse', { promptLabels: ['zzz one', 'zzz two', 'zzz three'],
    extraPromptLabels: ['wait (Recommended)', 'do it', 'do not'],
    decisions: [{ ref: 'ST-925', at: '2026-01-01 00:05:00', unanswered: true,
      options: ['do it', 'do not', 'wait'] }] });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board, '--at-answer', 'ST-925'], w.env);
  ok('a reordering found AFTER a cannot-tell still refuses, so the answer does not depend on which '
    + 'prompt the transcript happened to carry first: got exit ' + r.code, r.code === 1);
  ok('and the finding reported is the reordering rather than the cannot-tell',
    /different order/.test(r.out));
}

/* --- A PROMPT WITH NO READABLE OPTIONS AT ALL --------------------------------------------------
   Distinct from one this tool can read and disagrees with. labelsOf returns an empty list for it,
   and that empty list used to reach optionOrder and come back as null, which the caller reads as
   agreement. So the single shape the tool cannot parse was the one that cleared the decision. The
   comment on labelsOf claimed the opposite for months. */
{
  const w = world('erasureempty', { promptLabels: ['wait (Recommended)', 'do it', 'do not'],
    extraEmptyPrompt: true,
    decisions: [{ ref: 'ST-926', at: '2026-01-01 00:05:00', unanswered: true,
      options: ['do it', 'do not', 'wait'] }] });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board, '--at-answer', 'ST-926'], w.env);
  ok('a prompt carrying NO readable options does not clear a reordering either: got exit ' + r.code,
    r.code === 1);
  ok('and the reordering is still what gets reported', /different order/.test(r.out));
}

/* --- WHICH OF TWO FINDINGS THE READER IS SHOWN, WHEN BOTH ARE TRUE -----------------------------
   The two used to overwrite each other so the survivor was whichever prompt sat later in the
   transcript, and the heading prints the REMEDY for the survivor. Those remedies point in opposite
   directions: raise the prompt again for a gap, and do not bother for a reordering because every
   option was shown. So the old behaviour could hand a reader the one instruction that cannot work.
   A gap outranks a reordering, because an option the founder NEVER SAW is the worse fault. */
{
  const w = world('rankgap', { promptLabels: ['wait (Recommended)', 'do it', 'do not'],
    extraPromptLabels: ['do it', 'do not'],
    decisions: [{ ref: 'ST-927', at: '2026-01-01 00:05:00', unanswered: true,
      options: ['do it', 'do not', 'wait'] }] });
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board, '--at-answer', 'ST-927'], w.env);
  ok('with a gap and a reordering both available, the GAP is what gets reported: got exit ' + r.code,
    r.code === 1 && /MORE options/.test(r.out));
  ok('and the reordering remedy, which says raising the prompt again will not help, is NOT printed '
    + 'over a gap that raising the prompt again is exactly the fix for',
    !/were REORDERED/.test(r.out));
}

// --- THE REMEDY THE REFUSAL PRINTS HAS TO CLEAR THE REFUSAL ---------------------------------------
/* ST-304 HIGH 2, found by a pre-release code reviewer running the case. The refusal took the FIRST
   prompt at or after the ask and judged that one alone, so raising a corrected prompt showing every
   option left it refusing on the earlier one, permanently, while telling the reader to do the thing
   that could not work. S243 is the rule it broke: a control with no way out gets one built under
   pressure, and the pressure here is a session that cannot write its own answer.

   The no-prompt check beside it already asks whether ANY prompt in the window satisfies it, so this
   is the same question asked the same way. Silence now means one prompt matched; a finding now means
   none did, and the worst of them is what gets reported.

   Watched failing: predicted 2 would redden against the old first-prompt-only pairing and ONE did,
   and the prediction being wrong is the useful part. The worst-of-them assertion below could not
   fail, because its fixture happened to put the WORST prompt first, so first-prompt-only and
   worst-of-all give the same answer there. The fixture is now ordered the other way round. A
   prediction wrong toward FEWER failures is the cheapest tell there is for an assertion that
   cannot fail, and that is twice in one sitting. S242. */
{
  const w = world('remedy', { promptLabels: ['do it', 'do not', 'wait'],
    decisions: [{ ref: 'ST-920', at: '2026-01-01 00:05:00', unanswered: true,
      options: ['do it', 'do not', 'wait', 'something else, say what'] }] });
  const r1 = run(['--root', w.root, '--home', w.base, '--board', w.board, '--at-answer', 'ST-920'], w.env);
  ok('the short prompt is refused, which is the finding this check exists for: got exit ' + r1.code,
    r1.code === 1);

  // The remedy, done exactly as the refusal words it: raise the prompt again with every option.
  const tdir = path.join(w.base, '.claude', 'projects', gate.projectDirName(w.root));
  const f = path.join(tdir, SID + '.jsonl');
  const fixed = JSON.stringify({
    timestamp: '2026-01-01T00:12:00.000Z',
    message: { role: 'assistant', content: [{ type: 'tool_use', name: 'AskUserQuestion',
      input: { questions: [{ question: 'again', options:
        ['do it', 'do not', 'wait', 'something else, say what'].map(l => ({ label: l, description: 'd' })) }] } }] },
  });
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').trimEnd() + '\n' + fixed + '\n', 'utf8');

  const r2 = run(['--root', w.root, '--home', w.base, '--board', w.board, '--at-answer', 'ST-920'], w.env);
  ok('and RAISING THE PROMPT AGAIN WITH EVERY OPTION CLEARS IT, which is the remedy the refusal '
    + 'names and could not previously be performed: got exit ' + r2.code, r2.code === 0);
}
{
  // THE CONTROL. Two prompts, BOTH short, must still refuse. Otherwise the fix above is just a way
  // of satisfying the check by raising more prompts, which is worse than the defect it replaced.
  const w = world('remedynone', { promptLabels: ['do it', 'do not', 'wait'],
    decisions: [{ ref: 'ST-921', at: '2026-01-01 00:05:00', unanswered: true,
      options: ['do it', 'do not', 'wait', 'something else, say what'] }] });
  const tdir = path.join(w.base, '.claude', 'projects', gate.projectDirName(w.root));
  const f = path.join(tdir, SID + '.jsonl');
  // The SECOND prompt is the worse one, so first-prompt-only and worst-of-all disagree here and
  // the assertion below can actually fail. In the first draft the worst prompt came first and the
  // two answers were identical, which is an assertion that cannot fail wearing a fixture.
  const second = JSON.stringify({
    timestamp: '2026-01-01T00:12:00.000Z',
    message: { role: 'assistant', content: [{ type: 'tool_use', name: 'AskUserQuestion',
      input: { questions: [{ question: 'again', options:
        ['do it', 'do not'].map(l => ({ label: l, description: 'd' })) }] } }] },
  });
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').trimEnd() + '\n' + second + '\n', 'utf8');
  const r = run(['--root', w.root, '--home', w.base, '--board', w.board, '--at-answer', 'ST-921'], w.env);
  ok('two prompts that BOTH fall short still refuse: got exit ' + r.code, r.code === 1);
  ok('and it reports the WORST of them rather than the first, so the reader is told how far off '
    + 'they still are', /prompt showed 2, 2 missing/.test(r.out));
}

const EXPECTED_ASSERTIONS = 101;
const ranBefore = pass + fail;
ok('the suite ran every assertion: ran ' + (ranBefore + 1) + ' of ' + EXPECTED_ASSERTIONS
  + '. A block was skipped or deleted. Find out which before you change the number.',
  ranBefore === EXPECTED_ASSERTIONS - 1);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
