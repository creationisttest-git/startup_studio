#!/usr/bin/env node
'use strict';
/*
 * A forcible stop on session length.
 *
 * Why this exists. The cost of an agent session grows with the SQUARE of its length, because
 * every request re-sends the whole conversation so far. A tool call made early is not paid
 * once; it is paid again by every request that follows it. Measured on a real build: 574
 * requests, 39.2M weighted input tokens, 115k tokens of output. Three hundred and forty tokens
 * paid for every token produced. The same work split into five shorter agents costs 63 per cent
 * less at identical model, reasoning effort and gates.
 *
 * Nothing in the studio noticed. The ceiling on work in flight is enforced by the board, and
 * the ceiling on session length was enforced by nobody, so it was found by a founder running
 * out of a monthly budget rather than by any control.
 *
 * Advice would not have helped. A rule that says "keep sessions short" is read once at the top
 * of a session and is least likely to be recalled at request 300, which is exactly when it
 * matters. So this refuses instead.
 *
 * WHAT IT WILL NOT DO. It will not brick a session. A wall that blocks every tool call also
 * blocks winding down, which would strand the state documents unwritten and cost more than the
 * tokens it saved. It fires once per threshold: a blocking interrupt the model cannot ignore,
 * followed by permission to continue. Forcible, and recoverable.
 *
 * It also fails OPEN. Every path is wrapped, and any error at all allows the tool call. A
 * budget guard that crashes and denies all work is worse than no budget guard.
 *
 * SECOND JOB, ADDED BY ST-259 ON 2026-09-17: it also refuses a board `answer` for a decision
 * the founder was never shown as a clickable prompt. It lives here because this is the only
 * PreToolUse hook the studio registers, and because the founder asked for the MCQ rule to be
 * ENFORCED rather than counted afterwards. See decisionGate() below for why not in board.js
 * and why not at the release gate. Same fail-open rule: any error allows the call.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

// THE THRESHOLD IS WEIGHTED TOKENS, AND IT USED TO BE CALL COUNT. That was wrong for a reason
// this file could have caught by reading itself: the header argues entirely about COST, the
// tally above computes cost, and then the stop was decided by how many times a tool had been
// called. The token figure was printed in the message and compared to nothing. So a session
// making cheap calls was stopped exactly as hard as one making expensive ones.
//
// MEASURED ACROSS THREE SESSIONS, WEIGHTED INPUT PER CALL: 38.2k on the sitting that raised
// this, 68.3k on the 574-request build quoted in the header above, 69.6k on a long session in
// another project. The two heavy ones set the old threshold of 40 and the light one was stopped
// at the same number, having spent 56 per cent as much to get there.
//
// FIRST_WEIGHTED is derived from the header's own good shape rather than chosen: five agents of
// about thirty-seven requests at the measured 68.3k is about 2.5M weighted per agent. STEP is
// half a segment, so a session that ignores the first stop is stopped again inside the same
// order of magnitude rather than at double the spend.
const FIRST_WEIGHTED = 2500000;
const STEP_WEIGHTED  = 1250000;

// AND A BACKSTOP ON CALL COUNT, WHICH IS NOT BELT AND BRACES. tally() returns zero when the
// transcript cannot be read, and the message above already has a branch that says the token
// total is unavailable, so that state is known to happen. Thresholding on tokens ALONE would
// turn every one of those sessions into a guard that never fires at all, which is strictly
// worse than the defect being fixed. Call count advances whenever the state file can be read, so
// it covers an unreadable TRANSCRIPT, which is the case it is here for. It is NOT immune to state
// being lost: the count lives in that same file, so losing it pins the count at 1 and this
// backstop goes quiet too. Saying otherwise read as a guarantee and was the reasoning that let a
// lost state file turn into a wall. It sits far above the old 40 because it is a floor under a
// broken tally and
// not the working threshold, and the refusal says which of the two fired so a reader can tell a
// long session from an unmeasured one.
const FIRST_CALLS = 150;
const STEP_CALLS  = 100;

// Cache reads bill at roughly a tenth of fresh input. This is the published ratio, not a figure
// measured here, and the number it produces is an estimate that is stated as one.
const CACHE_READ_WEIGHT = 0.1;

function readStdin () {
  try { return fs.readFileSync(0, 'utf8'); } catch (e) { return ''; }
}

// Sum the weighted input cost from the transcript, reading only the bytes that have arrived
// since the last check. Re-reading a whole transcript on every tool call would make the guard
// against expensive work one of the expensive things in the session.
function tally (transcript, state) {
  const out = { tokens: state.tokens || 0, offset: state.offset || 0 };
  if (!transcript) return out;
  let size;
  try { size = fs.statSync(transcript).size; } catch (e) { return out; }
  if (size < out.offset) out.offset = 0;   // transcript replaced, start again
  if (size === out.offset) return out;
  let chunk;
  try {
    const fd = fs.openSync(transcript, 'r');
    const buf = Buffer.alloc(size - out.offset);
    fs.readSync(fd, buf, 0, buf.length, out.offset);
    fs.closeSync(fd);
    chunk = buf.toString('utf8');
  } catch (e) { return out; }
  const lines = chunk.split('\n');
  // Always length-1, and it is worth saying why, because getting this wrong overstated the
  // cost by a factor of forty and the guard reported it with a straight face. On a chunk
  // ending in a newline the final element is the empty string after it; on one that does
  // not, it is a partial line to be left for the next read. Either way the last element is
  // not a complete line. Counting it added a phantom byte, which pushed the stored offset
  // one PAST the file, so the next call saw a transcript shorter than its own offset,
  // assumed the file had been replaced, reset to zero and re-read the whole thing. Every
  // call, forever. A guard against expensive work, quietly being the expensive work.
  const complete = lines.length - 1;
  let consumed = 0;
  for (let i = 0; i < complete; i++) {
    consumed += Buffer.byteLength(lines[i], 'utf8') + 1;
    const t = lines[i].trim();
    if (!t) continue;
    let u;
    try { u = JSON.parse(t); } catch (e) { continue; }
    const usage = u && u.message && u.message.usage;
    if (!usage) continue;
    out.tokens += (usage.input_tokens || 0)
                + (usage.cache_creation_input_tokens || 0)
                + (usage.cache_read_input_tokens || 0) * CACHE_READ_WEIGHT
                + (usage.output_tokens || 0);
  }
  out.offset += consumed;
  return out;
}

// The board lives in .board at the repository root. The path is named ONCE here and asserted
// against the real repository by session-budget.test.js, because a hand-kept path that has to
// track a directory is exactly what went stale when the board moved: this guard kept looking
// in the old place, found nothing, and reported no work in flight while three tickets were
// open. Both the tool and its test named the same dead path, so they agreed with each other
// and neither agreed with the repository.
const BOARD_TICKETS = ['.board', 'tickets'];

// The count of work in flight, read from the board in this repository if it runs one. Session
// length and work in flight are the same question asked twice: a session that is long AND
// holding open tickets cannot simply stop, and that is the situation worth interrupting.
function wip (cwd) {
  try {
    const dir = path.join(cwd, ...BOARD_TICKETS);
    if (!fs.existsSync(dir)) return null;
    let n = 0;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const t = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        if (t && t.status === 'in_progress') n++;
      } catch (e) { /* one unreadable ticket is not a reason to stop counting */ }
    }
    return n;
  } catch (e) { return null; }
}

// ST-257 part two. WHAT THIS SESSION IS SENDING, COUNTED FROM THE PAYLOAD IT IS ALREADY HANDED.
//
// Until 2026-09-17 this file read `message.usage` and nothing else, so it could say what a session
// had COST and never what the cost was made of. Measured across 62 transcripts of this project,
// tool call inputs are 48 per cent of everything in a transcript, and inside them Bash is 50.2 per
// cent, Write 27.7 and Edit 13.6. None of that was visible to any instrument; it took a one-off
// script over the stored transcripts to find it, which means it was not being watched.
//
// THE NUMBER IS COUNTED HERE BECAUSE SOMETHING READS IT. It goes into the stop message below, at
// the one moment a session is actually attending to its own spend. A number nothing reads is a
// number nothing tests, and the last sitting found a word count that had been wrong in every case
// for weeks for exactly that reason (S211). If the line ever comes out of the message, delete the
// counting with it.
//
// WHAT IT DELIBERATELY DOES NOT DO. It does not refuse an oversized call. That rule was measured
// before it was written and it is not worth writing: the twenty largest calls of 11,427 carry 4.1
// per cent of all tool input characters, so the cost is broad rather than concentrated, and a cap
// would refuse correct work to save almost nothing. The measurement is on ST-257.
const INPUT_KINDS = {
  Write: (i) => String(i.content || '').length,
  Edit: (i) => String(i.new_string || '').length + String(i.old_string || '').length,
  Bash: (i) => String(i.command || '').length,
  PowerShell: (i) => String(i.command || '').length,
};

function tallyInput (hook, state) {
  const out = {
    inputChars: state.inputChars || 0,
    writeChars: state.writeChars || 0,
    writeCalls: state.writeCalls || 0,
  };
  const name = String(hook.tool_name || '');
  const fn = INPUT_KINDS[name];
  if (!fn) return out;
  let n = 0;
  try { n = fn(hook.tool_input || {}); } catch (e) { return out; }
  if (!n || !isFinite(n)) return out;
  out.inputChars += n;
  // WRITE IS SEPARATED FROM THE REST BECAUSE IT IS THE ONE A SESSION CAN CHOOSE DIFFERENTLY. It
  // costs 5,704 characters a call against 1,736 for an edit, and the largest calls in the whole
  // measurement are Write calls carrying a SCRIPT that then writes a document, so the transcript
  // pays for the wrapper and the payload both. Naming it separately is what makes that visible at
  // the moment it can still be changed.
  if (name === 'Write') { out.writeChars += n; out.writeCalls += 1; }
  return out;
}

// ST-259. THE MCQ GATE, AND IT IS HERE RATHER THAN IN THE BOARD FOR ONE REASON.
//
// The founder asked on 2026-09-17 whether the work includes ENFORCING the clickable prompt for
// any input needed from them. It did not. The rule reaches 6 of 6 project sessions and the
// instrument that reads it, check-decision-shape.js, ran in the wind-down set only: after every
// decision of the sitting had already been put. By construction it recorded breaches and
// prevented none.
//
// WHY NOT IN board.js, WHICH IS WHERE `answer` LIVES. That file is PUBLISHED. It runs for readers
// who are not using this host and have no transcript to read, so a transcript-reading refusal
// there would either break for them or degrade to nothing, and the published board would carry a
// dependency on one specific coding agent. That is the ST-055 defect, a claim true here and false
// for the reader. This hook is studio-local and registered in this machine's own settings, so the
// enforcement lands exactly where it was decided to land: ST-259 d1, studio only, prove it here
// first, then come back for the other five.
//
// WHY PreToolUse AND NOT THE RELEASE GATE. A release refusal is unrecoverable for this class: a
// decision already written to the board with no prompt cannot be un-written, so refusing at the
// release would reintroduce the exact defect ST-237 removed when it took reply-shape-recent out of
// the gating sets for blocking four of five releases over something no customer reads. The moment
// BETWEEN the board `ask` and the board `answer` is the one where the remedy is performable:
// raise the prompt, run the answer again. An unperformable remedy is the S148, S177, S178 class.
//
// IT FAILS OPEN LIKE EVERYTHING ELSE IN THIS FILE. Any error, any missing field, any unreadable
// transcript allows the call. The only thing that blocks is the unambiguous case the tool exits 1
// on, and even that is cleared by doing the thing the rule asks for.
// THE PROGRAM IS CAPTURED, NOT JUST THE REF, because the program is what says where the board is.
// AND THE PATH MAY BE QUOTED. Every absolute path on this machine contains a space, so a bare \S*
// run silently failed to match `node "C:/.../board.js" answer ST-1` and the gate never fired at
// all. A gate that a quotation mark turns off is worse than no gate, because the transcript shows
// the call sailing through with no refusal and nothing to read. Three alternates: double quoted,
// single quoted, bare.
const ANSWER_CMD = new RegExp(
  '(?:^|[\\s&|;])(?:node\\s+)?'
  + '(?:"([^"]*board(?:-cli)?\\.js)"'
  + "|'([^']*board(?:-cli)?\\.js)'"
  + '|(\\S*board(?:-cli)?\\.js))'
  + '\\s+answer\\s+([A-Za-z]+-\\d+)');

// WHERE THE BOARD IS, ANSWERED THE WAY board.js ANSWERS IT, from the same input the caller used.
//
// check-decision-shape.js defaults the board to <root>/.board/tickets and looks nowhere else.
// board.js:97-113 resolves one in FOUR ordered steps. The two disagreed, and the disagreement was
// not theoretical: the one other project on this machine runs a live board of 154 tickets at board/tickets, resolved
// by rule 2 because its project.json sits beside its own copy of the program. The gate fired there,
// looked for .board/tickets, found nothing, exited 3 for CANNOT TELL and ALLOWED the answer. The
// one other project with a board was the one the gate was blind to, over a directory name.
//
// This mirrors resolveRoot() step for step INCLUDING the .git boundary on the walk, with one
// substitution: board.js uses __dirname because it IS the program, and here the program is the
// path the caller typed, resolved against the cwd the hook was handed. Deriving it from the
// command rather than from a second hand-kept list is what stops the two drifting again (S201).
function boardTicketsFor (cwd, program) {
  const base = path.resolve(String(cwd || process.cwd()));
  // 1. BOARD_HOME, explicit, always wins.
  if (process.env.BOARD_HOME) return path.join(path.resolve(process.env.BOARD_HOME), 'tickets');
  // 2. A project.json sitting NEXT TO the program. Ahead of the walk, exactly as board.js has it,
  //    so a stray .board above the directory cannot silently retarget an existing board.
  if (program) {
    const progDir = path.dirname(path.resolve(base, String(program)));
    if (fs.existsSync(path.join(progDir, 'project.json'))) return path.join(progDir, 'tickets');
  }
  // 3. A .board found by walking up, stopping at a repository boundary.
  let dir = base;
  for (;;) {
    if (fs.existsSync(path.join(dir, '.board', 'project.json'))) {
      return path.join(dir, '.board', 'tickets');
    }
    if (fs.existsSync(path.join(dir, '.git'))) break;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  // 4. Otherwise .board in the working directory.
  return path.join(base, '.board', 'tickets');
}

function decisionGate (hook) {
  if (String(hook.tool_name || '') !== 'Bash') return;
  const input = hook.tool_input || {};
  const cmd = String(input.command || '');
  if (!cmd) return;
  const m = ANSWER_CMD.exec(cmd);
  if (!m) return;
  const program = m[1] || m[2] || m[3] || '';
  const ref = m[4];

  // The decision key, when the command names one. Without it the whole ticket is judged, which is
  // right for a ticket holding one open question and wrong for a ticket holding several, so the
  // key is passed through whenever the command carries it.
  const keyMatch = /--decision\s+(\S+)/.exec(cmd);
  const key = keyMatch ? keyMatch[1] : '';

  const root = String(hook.cwd || process.cwd());
  const tool = path.join(__dirname, 'check-decision-shape.js');
  if (!fs.existsSync(tool)) return;

  let r;
  try {
    r = require('child_process').spawnSync(process.execPath,
      [tool, '--root', root, '--board', boardTicketsFor(root, program), '--at-answer', ref]
        .concat(key ? ['--decision', key] : []),
      {
        encoding: 'utf8',
        timeout: 5000,
        // THE SESSION IS NAMED BY THE PAYLOAD, NOT BY THE AMBIENT ENVIRONMENT. check-decision-shape
        // selects a transcript by CLAUDE_CODE_SESSION_ID with no fallback to newest-by-mtime, which
        // is deliberate (S186, ST-229): this machine holds dozens of transcripts and a peer session
        // writing at the same moment would otherwise be measured instead of this one. A hook
        // subprocess is not guaranteed to inherit that variable, and inheriting it is the wrong
        // source anyway: the payload states which session is making the call, so it is passed
        // explicitly. Found by the gate silently ALLOWING a fixture it was supposed to block.
        env: Object.assign({}, process.env, { CLAUDE_CODE_SESSION_ID: String(hook.session_id || '') })
      });
  } catch (e) { return; }
  // A crash, a timeout, or anything other than the one refusing code ALLOWS the call. Exit 3 is
  // CANNOT TELL and exit 2 is usage, and neither is evidence of a breach.
  if (!r || r.status !== 1) return;

  process.stderr.write(
    'BLOCKED. This would record an answer to a decision the founder was never shown as a\n'
    + 'clickable prompt.\n\n'
    + (r.stdout || '').trim() + '\n\n'
    + 'The rule, from base/fragments/decisions-are-numbered.md: a decision goes to the CEO\n'
    + 'through the host interactive multiple-choice prompt, so they answer by CLICKING. Two to\n'
    + 'four options, a recommendation marked (Recommended) in the first, an explicit escape last,\n'
    + 'and the ticket reference in the question text. A numbered list typed into a reply is the\n'
    + 'fallback for a host that has no prompt, and this host has one.\n\n'
    + 'Do this now:\n'
    + '  1. Raise the prompt with AskUserQuestion, options matching the board ask exactly.\n'
    + '  2. Run this same answer command again. It will pass.\n');
  process.exit(2);   // blocking error, fed back to the model
}

function main () {
  let raw = readStdin();
  let hook = {};
  try { hook = JSON.parse(raw) || {}; } catch (e) { return; }

  // ST-259. THE MCQ GATE RUNS FIRST, and deliberately before the session-id guard. A decision
  // answered in a session this file cannot identify is still a decision answered with no
  // prompt, and the gate needs no id: it reads the board and the transcript the hook names.
  // It is inside main()'s own try/catch at the bottom of this file, so it fails open too.
  decisionGate(hook);

  const id = String(hook.session_id || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!id) return;

  const stateFile = path.join(os.tmpdir(), 'studio-session-budget-' + id + '.json');
  let state = {};
  // WHETHER THE STATE WAS THERE IS ITSELF A READING, AND WITHOUT IT THIS FILE BRICKS A SESSION.
  // Everything that stops it firing twice lives in this one file under the system temp directory:
  // the call count, the transcript offset, and the high-water mark of what has already been
  // announced. Lose it and all three reset, so `fired` is 0 while tally() re-reads the transcript
  // from the beginning and returns the FULL weighted total. On any session already past the first
  // threshold, which is routine here, that means `due` beats `fired` on every call, forever. A tmp
  // cleaner, a lock, or a directory that cannot be written to is enough. Measured against the
  // version this replaced: 60 of 60 calls blocked, where the old one blocked 0 of 60.
  //
  // That is the exact thing the header of this file promises it will not do, because a wall that
  // blocks every tool call also blocks winding down and strands the state documents unwritten.
  // So an unreadable state file degrades to SILENCE, which is what the old one did and what this
  // file's own fail-open rule asks for.
  //
  // STATE THE BOUND HONESTLY, because the sentence here used to read "it costs one missed stop and
  // cannot cost a session" and only the second half is true. Where the file is lost ONCE it costs
  // one delayed stop. Where the directory can never be read or written it costs EVERY stop, which
  // is permanent silence: the fixture that proves this asserts 0 refusals in 20 calls, and 0 in 20
  // is not one missed stop. That is the same state the old guard was in, and it is the trade being
  // made deliberately, because a guard that says nothing is recoverable and a guard that blocks
  // winding down is not.
  let hadState = true;
  try {
    state = JSON.parse(fs.readFileSync(stateFile, 'utf8')) || {};
  } catch (e) { state = {}; hadState = false; }

  const calls = (state.calls || 0) + 1;
  const sent = tallyInput(hook, state);
  const t = tally(hook.transcript_path, state);
  const fired = state.fired || 0;
  // TWO MARKS, NOT ONE, AND A SINGLE MARK IS WHY A SPEND STOP GOES MISSING. `due` used to be the
  // greater of the two thresholds against one high-water mark, so a stop on the call-count
  // backstop ALSO consumed the first spend crossing: the session was told it had been stopped for
  // being long, and the moment it went over budget nothing was said, because the mark had already
  // moved. Confirmed live rather than argued: this repository's own record shows a backstop stop
  // at 150 calls and 1,131k, then the next spend stop reported at 3,752k, which is the SECOND
  // spend threshold. The first was never announced. Reading an old record with only `fired` in it
  // starts both marks from that value, so no session is stopped twice for something it was
  // already told about.
  const firedWeighted = state.firedWeighted === undefined ? fired : state.firedWeighted;
  const firedCalls = state.firedCalls === undefined ? fired : state.firedCalls;

  // Which threshold does this call cross? Whichever of the two is further along. `fired` is a
  // high-water mark, so a session that crosses several at once is stopped once, not repeatedly.
  const dueWeighted = t.tokens < FIRST_WEIGHTED
    ? 0 : 1 + Math.floor((t.tokens - FIRST_WEIGHTED) / STEP_WEIGHTED);
  const dueCalls = calls < FIRST_CALLS
    ? 0 : 1 + Math.floor((calls - FIRST_CALLS) / STEP_CALLS);
  const due = Math.max(dueWeighted, dueCalls);
  const crossedWeighted = dueWeighted > firedWeighted;
  const crossedCalls = dueCalls > firedCalls;

  // Both marks advance on the call that stops, so two thresholds crossed together still stop once.
  // What they no longer do is advance for EACH OTHER on a call that only one of them crossed.
  // A CALL THIS GUARD DELIBERATELY DID NOT JUDGE MUST NOT RECORD A JUDGEMENT. With no state to
  // read, the marks below go back to zero rather than jumping to what was due, so the crossing is
  // announced on the NEXT call instead of being silently marked as dealt with. That is the whole
  // cost of the fix: one delayed stop where the file was lost once, against a session that can
  // never be walled where it is lost repeatedly.
  const next = { calls: calls, tokens: t.tokens, offset: t.offset,
                 inputChars: sent.inputChars, writeChars: sent.writeChars,
                 writeCalls: sent.writeCalls,
                 fired: hadState ? Math.max(fired, due) : 0,
                 firedWeighted: hadState ? Math.max(firedWeighted, dueWeighted) : 0,
                 firedCalls: hadState ? Math.max(firedCalls, dueCalls) : 0 };
  // THE WRITE IS HALF THE QUESTION AND THE FIRST FIX ONLY ASKED THE OTHER HALF. Gating on the READ
  // alone left the wall standing whenever the file can be read and not written: the mark is frozen
  // at whatever it last held while the transcript keeps growing, so the crossing is due on every
  // call and announced on every call. Measured by a reviewer on the first fix: 10 of 10 calls
  // blocked with a read-only state file, which is identical to the version it replaced. The
  // realistic route is not a read-only attribute, it is a FULL DISK, where the write fails and the
  // read does not.
  let recorded = true;
  try { fs.writeFileSync(stateFile, JSON.stringify(next)); } catch (e) { recorded = false; }

  if (!crossedWeighted && !crossedCalls) return;   // already stopped at these; let the work continue
  // NOTHING IS ANNOUNCED THAT CANNOT BE RECORDED, in either direction. If the state could not be
  // read, nothing written now can be trusted to come back. If it could not be written, this stop
  // will be due again on the very next call and every call after it. Either way, firing is what
  // turns a temp directory fault into a wall that also blocks winding down, which is the one thing
  // the header of this file promises. Silence is recoverable; a wall is not.
  if (!hadState || !recorded) return;

  const open = wip(hook.cwd || process.cwd());
  const est = t.tokens ? Math.round(t.tokens / 1000) + 'k weighted input tokens (estimated)'
                       : 'token total unavailable from the transcript';

  // WHICH THRESHOLD FIRED IS PART OF THE FINDING AND NOT DECORATION. A stop on spend and a stop
  // on an unmeasured session call for different responses, and a reader who cannot tell them
  // apart will treat the second as the first and wind down a session that has barely cost
  // anything. That confusion is the whole reason this file was changed.
  // Named from WHICH MARK ACTUALLY MOVED, never from which number happens to be larger. Comparing
  // the two due values reported the backstop whenever the call count was further along, including
  // on calls where spend was readable and had just gone over budget: this session was told
  // "CALL COUNT BACKSTOP, which fires when spend cannot be read" while sitting 564k over.
  const why = crossedWeighted
    ? 'weighted spend, the measure this guard is about'
    : 'CALL COUNT BACKSTOP, which fires when spend cannot be read or a session is very long';
  const perCall = t.tokens ? Math.round(t.tokens / calls / 1000) + 'k per call' : 'per-call cost unknown';

  const msg =
    'STOP. Session budget checkpoint: ' + calls + ' tool calls, ' + est + ', ' + perCall + '.\n' +
    'Fired on: ' + why + '.\n' +
    'You have SENT ' + Math.round(sent.inputChars / 1000) + 'k characters of tool input this\n' +
    'session, of which Write is ' + Math.round(sent.writeChars / 1000) + 'k over ' + sent.writeCalls + ' call(s)'
      + (sent.writeCalls ? ', ' + Math.round(sent.writeChars / sent.writeCalls) + ' per call' : '') + '.\n' +
    'Measured over 62 transcripts here, tool input is 48 per cent of everything in one, and\n' +
    'the studio writing its own record is 42 per cent of that. A size cap is NOT the remedy:\n' +
    'the twenty largest calls of 11,427 carry 4.1 per cent. Writing a document through a\n' +
    'script pays for the wrapper AND the payload, so edit the document directly.\n' +
    'A segment of this work is budgeted at ' + Math.round(FIRST_WEIGHTED / 1000) + 'k weighted, ' +
    'from the measured shape in this file.\n' +
    'Every request re-sends the whole conversation, so cost grows with the SQUARE of session\n' +
    'length. This call was blocked once to make that unignorable. The next call is allowed.\n' +
    (open === null ? '' : 'Work in flight on the board: ' + open + ' ticket(s).\n') +
    '\nDo this now, in order:\n' +
    '  1. Finish or park what is in flight. Leaving it open forces the next session to\n' +
    '     rediscover it, which costs more than it saved.\n' +
    '  2. Run /wind-down so the state documents are written from disk.\n' +
    '  3. Start a FRESH session rather than resuming. Resuming pulls the whole transcript\n' +
    '     back in and defeats the point of stopping.\n' +
    '\nIf the work genuinely cannot be split, say so to the CEO with this count, and continue.';

  process.stderr.write(msg + '\n');
  process.exit(2);   // blocking error, fed back to the model
}

try { main(); } catch (e) { /* fail open, always */ }
process.exit(0);
