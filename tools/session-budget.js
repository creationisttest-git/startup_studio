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

// Thresholds. The first is where a session should already be splitting: the measured
// 63-per-cent-cheaper shape was five agents of about thirty-seven requests each. After that it
// interrupts on every STEP, so a session that ignores the first stop is stopped again, harder.
const FIRST = 40;
const STEP  = 50;

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
  try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')) || {}; } catch (e) { state = {}; }

  const calls = (state.calls || 0) + 1;
  const t = tally(hook.transcript_path, state);
  const fired = state.fired || 0;

  // Which threshold does this call cross? FIRST, then every STEP after it.
  const due = calls < FIRST ? 0 : 1 + Math.floor((calls - FIRST) / STEP);

  const next = { calls: calls, tokens: t.tokens, offset: t.offset, fired: Math.max(fired, due) };
  try { fs.writeFileSync(stateFile, JSON.stringify(next)); } catch (e) { /* fail open */ }

  if (due <= fired) return;   // already stopped at this threshold; let the work continue

  const open = wip(hook.cwd || process.cwd());
  const est = t.tokens ? Math.round(t.tokens / 1000) + 'k weighted input tokens (estimated)'
                       : 'token total unavailable from the transcript';

  const msg =
    'STOP. Session budget checkpoint: ' + calls + ' tool calls, ' + est + '.\n' +
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
