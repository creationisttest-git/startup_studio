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

function main () {
  let raw = readStdin();
  let hook = {};
  try { hook = JSON.parse(raw) || {}; } catch (e) { return; }

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
