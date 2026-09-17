#!/usr/bin/env node
'use strict'

/**
 * check-decision-shape.js
 *
 * DOES EVERY DECISION PUT TO THE CEO REACH THEM AS A CLICKABLE PROMPT.
 *
 * WHY THIS EXISTS. On 2026-09-13 the founder said, of the studio and of every project under it:
 * "They also don't give me mcq prompts to respond via click inputs. these 2 need to be the top 2
 * priorities for the doctor to monitor." A grep that day for AskUserQuestion, "click input",
 * "clicking an option" and "respond via click" across every markdown file under the venture root
 * returned four files: one fragment rewritten that sitting, two archives of this project's own
 * record, and one project's state document. ZERO governance files and ZERO instruments. The rule
 * that did exist told every reader the opposite of what was wanted: "numbered options, so the reply
 * can be a single character", which describes a list typed into a reply rather than a prompt.
 *
 * So this is the second of the founder's two top measures and the one nothing had ever counted.
 * The first, brevity, is check-reply-shape.js and has existed for weeks. The asymmetry is the
 * finding: a rule can be published, composed into seventeen roles, imported by every project and
 * still be invisible, because nothing reads the surface it governs.
 *
 * THE MEASURE IS SPLIT BY WHAT CAN BE KNOWN, WHICH IS S202. The board is this studio's record of
 * every decision put to the CEO: `ask` writes the question, the options and a timestamp, and
 * `answer` writes the reply. That record is unambiguous, so a decision sitting in it with no prompt
 * raised in its window is a BREACH and this refuses. The other half, whether a reply LOOKS like a
 * prose list of options, cannot be decided by shape: a numbered list followed by a question mark is
 * how anybody writes ordinary numbered steps, and refusing on it would fail correct work. That half
 * is REPORTED with the replies quoted and never exits 1.
 *
 * WHAT IT DELIBERATELY DOES NOT JUDGE. Whether the decision was worth asking at all. A question the
 * session could have settled by reading the code or running the tool is a worse fault than a badly
 * shaped one, and it belongs to the PM and the tech lead. This counts form and record only.
 *
 * A DISPATCHED SUBAGENT IS NOT A BREACH AND THE REASON IS STRUCTURAL. A subagent has no interactive
 * prompt to raise, so handing its options back to the driving session as text is the correct
 * behaviour and the fragment says so. Only the session that actually faces the founder is measured
 * here, which is the session whose transcript is selected below.
 *
 * TRANSCRIPT SELECTION IS BORROWED RATHER THAN REWRITTEN, ON PURPOSE. sessionTranscript() keys on
 * CLAUDE_CODE_SESSION_ID with no fallback to newest-by-mtime, because falling back IS the defect
 * that S186 and ST-229 were about: this project holds dozens of transcripts and a peer session
 * writing at the same moment would otherwise be measured instead of this one.
 *
 * EXIT CODES, the same family the rest of these tools use:
 *   0  every decision in the window was put as a clickable prompt
 *   1  a decision reached the founder without one. This is the breach.
 *   2  usage
 *   3  CANNOT TELL: no transcript, no session, no board, or no decision in the window. Advisory.
 *
 * usage: node check-decision-shape.js [--root <dir>] [--home <dir>] [--board <dir>] [--report] [--quiet]
 *        node check-decision-shape.js --at-answer <ref> [--decision <key>]
 *        which is the ST-259 gate: the same question asked before an answer is written, when
 *        raising the prompt can still clear it.
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

const gate = require('./check-gate-dispatch.js')
const projectDirName = gate.projectDirName
const sessionTranscript = gate.sessionTranscript

// The host's interactive multiple-choice prompt. A name rather than a shape, because the whole
// point is that the founder clicked something, and only the tool can tell you that happened.
const PROMPT_TOOLS = ['AskUserQuestion']

// A board timestamp is "YYYY-MM-DD HH:MM:SS" and is stamped UTC; a transcript timestamp is ISO
// with a Z. Comparing the two as strings would be wrong by whatever the local offset is, which on
// this machine is ten hours and would put every decision outside its own window.
function boardTime (s) {
  if (typeof s !== 'string' || !s.trim()) return null
  const iso = s.trim().replace(' ', 'T') + (/[Zz]|[+-]\d\d:?\d\d$/.test(s) ? '' : 'Z')
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : null
}

function isoTime (s) {
  if (typeof s !== 'string' || !s.trim()) return null
  const t = Date.parse(s)
  return Number.isFinite(t) ? t : null
}

function flagOf (argv, name, fallback) {
  const i = argv.indexOf('--' + name)
  if (i === -1) return fallback
  const v = argv[i + 1]
  if (v === undefined || v.slice(0, 2) === '--') return null
  return v
}

function has (argv, name) { return argv.indexOf('--' + name) !== -1 }

function transcriptsFor (root, home) {
  const dir = path.join(home, '.claude', 'projects', projectDirName(root))
  if (!fs.existsSync(dir)) return { why: 'no transcript directory for this project at ' + dir }
  let names
  try { names = fs.readdirSync(dir) } catch (e) { return { why: 'the transcript directory could not be listed: ' + e.message } }
  const files = names.filter(n => n.endsWith('.jsonl')).map(n => path.join(dir, n))
  if (!files.length) return { why: 'the transcript directory holds no session' }
  return { files: files }
}

// Every interactive prompt raised in one transcript, with its timestamp, and the session's own
// first and last timestamp so a board row can be placed inside or outside this sitting.
function promptsIn (file) {
  let raw
  try { raw = fs.readFileSync(file, 'utf8') } catch (e) { return { why: 'the session could not be read: ' + e.message } }
  const prompts = []
  const replies = []
  let first = null
  let last = null
  for (const line of raw.split(/\r?\n/)) {
    if (!line) continue
    let rec
    try { rec = JSON.parse(line) } catch (e) { continue }
    if (!rec) continue
    const ts = isoTime(rec.timestamp)
    if (ts !== null) {
      if (first === null || ts < first) first = ts
      if (last === null || ts > last) last = ts
    }
    const content = rec.message && rec.message.content
    if (!Array.isArray(content)) continue
    for (const block of content) {
      if (!block) continue
      if (block.type === 'tool_use' && PROMPT_TOOLS.indexOf(block.name) !== -1) {
        prompts.push({ at: ts, name: block.name })
      }
      // Assistant text is kept for the reported half only. A tool result is not a reply and a
      // user turn is not ours, so both are skipped the way check-reply-shape skips them.
      if (block.type === 'text' && rec.message.role === 'assistant'
        && typeof block.text === 'string' && block.text.trim()) {
        replies.push({ at: ts, text: block.text })
      }
    }
  }
  return { prompts: prompts, replies: replies, first: first, last: last }
}

// THE REPORTED HALF. A reply is a CANDIDATE prose ask when it carries at least two numbered items
// and asks a question. That is deliberately loose and deliberately not refused on: numbered steps
// ending in a question is ordinary writing, and a predicate this shape would fail correct work.
// Its job is to give a reviewer something to quote, not to decide anything.
function proseAskCandidates (replies) {
  const out = []
  for (const r of replies) {
    const lines = r.text.split(/\r?\n/)
    let numbered = 0
    let fenced = false
    for (const line of lines) {
      const t = line.trim()
      if (t.slice(0, 3) === '```') { fenced = !fenced; continue }
      if (fenced) continue
      if (/^(?:\*\*)?\d+[.)]/.test(t)) numbered++
    }
    if (numbered < 2) continue
    if (r.text.indexOf('?') === -1) continue
    const firstLine = (lines.find(l => l.trim()) || '').trim()
    out.push({ at: r.at, numbered: numbered, first: firstLine })
  }
  return out
}

// Every decision on the board, flattened, with the ticket it belongs to.
function decisionsOnBoard (dir) {
  if (!fs.existsSync(dir)) return { why: 'no board at ' + dir }
  let names
  try { names = fs.readdirSync(dir) } catch (e) { return { why: 'the board could not be listed: ' + e.message } }
  const out = []
  let unreadable = 0
  let readable = 0
  for (const n of names) {
    if (!n.endsWith('.json')) continue
    let t
    try { t = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8')) } catch (e) { unreadable++; continue }
    readable++
    if (!t || !Array.isArray(t.decisions)) continue
    for (const d of t.decisions) {
      if (!d || typeof d !== 'object') continue
      out.push({
        ref: t.ref || n.replace(/\.json$/, ''),
        key: d.key || '',
        at: boardTime(d.at),
        answeredAt: boardTime(d.answered_at),
        answered: d.answer !== undefined && d.answer !== null && d.answer !== '',
        question: typeof d.question === 'string' ? d.question : '',
      })
    }
  }
  return { decisions: out, unreadable: unreadable, readable: readable }
}

// ST-259. THE SAME PREDICATE ASKED AT A MOMENT THE SESSION CAN STILL ACT ON IT.
//
// WHY A SECOND ENTRY POINT RATHER THAN A SECOND TOOL. main() above runs in the wind-down set, which
// is AFTER every decision of the sitting has already been put. By construction it can record a
// breach and can never prevent one, and the founder's ask on 2026-09-17 was to ENFORCE the prompt
// rather than to count the misses afterwards. The recoverable moment is the one between the board
// `ask` and the board `answer`: the ask is written, the prompt is supposed to go up, the answer is
// written after it. A refusal delivered at `answer` time is cleared by raising the prompt and
// running the command again, which is the opposite of the ORDER fault below, where nothing the
// running session can do clears a decision already stamped the wrong way round (S148, S177, S178).
//
// IT IS A FUNCTION IN THIS FILE AND NOT A FILE OF ITS OWN, ON PURPOSE. Two instruments answering
// the same question drift into agreeing with each other and with nothing else, which is S201: a
// release gate and a roster count agreed perfectly about a role that did not exist. One predicate,
// two moments, so a change to what counts as a prompt cannot reach one caller and miss the other.
//
// THE WINDOW HAS NO UPPER BOUND HERE AND THAT IS THE DIFFERENCE FROM main(). At answer time the
// decision has no answered_at yet, because the command that would write it is the one being held.
// So the question is only whether a prompt was raised at or after the ask. Bounding the top would
// refuse every correct call, since the only thing above the ask is the present moment.
function atAnswer (opts) {
  const board = opts.board
  const ref = String(opts.ref || '').trim()
  const key = String(opts.key || '').trim()
  if (!ref) return { code: 3, why: 'no ticket reference was given, so no decision could be located' }

  const s = promptsIn(opts.transcript)
  if (s.why) return { code: 3, why: s.why }

  const b = decisionsOnBoard(board)
  if (b.why) return { code: 3, why: b.why + ', so there is nothing to check the prompts against' }

  // UNANSWERED ONLY. A decision already carrying an answer is being corrected or superseded, and
  // holding that up would block the very repair the rule asks for. The open ones are the ones this
  // command is about to close, so they are the only ones whose window is still being decided.
  const open = b.decisions.filter(d => d.ref.toUpperCase() === ref.toUpperCase() && !d.answered
    && (!key || d.key === key) && d.at !== null)
  if (!open.length) {
    return {
      code: 3,
      why: 'no unanswered decision ' + (key ? key + ' ' : '') + 'on ' + ref + ' carries a readable '
        + 'timestamp, so its window cannot be placed'
    }
  }

  const naked = open.filter(d => !s.prompts.some(p => p.at !== null && p.at >= d.at))
  if (!naked.length) return { code: 0, decisions: open, prompts: s.prompts.length }
  return { code: 1, naked: naked, prompts: s.prompts.length, decisions: open }
}

function main (argv) {
  const args = argv.slice(2)
  const quiet = has(args, 'quiet')
  const report = has(args, 'report')
  const say = (s) => { if (!quiet) process.stdout.write(s + '\n') }

  const rootArg = flagOf(args, 'root', process.cwd())
  const homeArg = flagOf(args, 'home', os.homedir())
  for (const pair of [['root', rootArg], ['home', homeArg]]) {
    if (pair[1] === null) {
      process.stderr.write('check-decision-shape: --' + pair[0] + ' needs a directory after it\n')
      return 2
    }
  }
  const boardArg = flagOf(args, 'board', path.join(rootArg, '.board', 'tickets'))
  if (boardArg === null) {
    process.stderr.write('check-decision-shape: --board needs a directory after it\n')
    return 2
  }

  const t = transcriptsFor(rootArg, homeArg)
  if (t.why) {
    say('DECISION SHAPE  CANNOT TELL. ' + t.why)
    return 3
  }
  const pick = sessionTranscript(t.files)
  if (pick.why) {
    say('DECISION SHAPE  CANNOT TELL. ' + pick.why)
    return 3
  }

  // ST-259. --at-answer <ref> turns this file into the gate a PreToolUse hook calls BEFORE a board
  // answer is written. Same predicate as the wind-down reading, earlier moment, and a refusal here
  // is CLEARABLE: raise the prompt, run the answer again. That is the whole reason it exists.
  if (args.indexOf('--at-answer') !== -1) {
    const atRef = flagOf(args, 'at-answer', null)
    if (atRef === null) {
      process.stderr.write('check-decision-shape: --at-answer needs a ticket reference after it\n')
      return 2
    }
    const r = atAnswer({
      board: boardArg,
      ref: atRef,
      key: flagOf(args, 'decision', '') || '',
      transcript: pick.file
    })
    if (r.code === 3) {
      say('DECISION SHAPE  CANNOT TELL. ' + r.why)
      return 3
    }
    if (r.code === 0) {
      say('OK  ' + r.decisions.length + ' open decision(s) on ' + atRef + ' had a clickable prompt '
        + 'raised at or after the ask was written')
      return 0
    }
    process.stdout.write('FAIL  ' + r.naked.length + ' decision(s) on ' + atRef + ' would be '
      + 'answered with no clickable prompt raised since the ask was written. Raise it with the '
      + 'host interactive multiple-choice tool so the founder answers by CLICKING, then run this '
      + 'answer again. A numbered list typed into a reply is not it.\n')
    for (const d of r.naked) {
      process.stdout.write('  ' + d.ref + ' ' + d.key + ': ' + d.question.slice(0, 90) + '\n')
    }
    return 1
  }
  const s = promptsIn(pick.file)
  if (s.why) {
    say('DECISION SHAPE  CANNOT TELL. ' + s.why)
    return 3
  }
  if (s.first === null || s.last === null) {
    say('DECISION SHAPE  CANNOT TELL. the session carries no timestamp, so no board row can be '
      + 'placed inside or outside it')
    return 3
  }

  const b = decisionsOnBoard(boardArg)
  if (b.why) {
    say('DECISION SHAPE  CANNOT TELL. ' + b.why + ', so there is no record of a decision to check '
      + 'the prompts against. A project with no board is not a project in breach.')
    return 3
  }

  if (b.readable === 0 && b.unreadable > 0) {
    say('DECISION SHAPE  CANNOT TELL. all ' + b.unreadable + ' ticket file(s) on the board failed '
      + 'to parse, so no decision could be read and the absence of one proves nothing. Run the '
      + 'board\'s own doctor command, which names each unparseable file and its line.')
    return 3
  }

  // A decision belongs to this sitting when the board wrote its QUESTION inside the session's own
  // span. Keying on the question rather than the answer is deliberate: an old decision answered
  // today was not put to the founder today, and this measures the putting.
  const mine = b.decisions.filter(d => d.at !== null && d.at >= s.first && d.at <= s.last)

  say('DECISION SHAPE  ' + mine.length + ' decision(s) put in this session, '
    + s.prompts.length + ' clickable prompt(s) raised')
  if (b.unreadable) say('  note  ' + b.unreadable + ' of ' + (b.readable + b.unreadable)
    + ' ticket file(s) could not be parsed, so this reading is over the rest')

  if (!mine.length) {
    say('  CANNOT TELL. No decision was written to the board inside this session, so there is '
      + 'nothing to hold the prompts against.')
    if (s.prompts.length) {
      say('  note  ' + s.prompts.length + ' prompt(s) WERE raised. A prompt with no board ask is '
        + 'its own fault, against the rule that the ask is written first, and it is reported here '
        + 'rather than refused on because the ask may live on a ticket this board cannot see.')
    }
    const cand0 = proseAskCandidates(s.replies)
    if (cand0.length) {
      say('  ' + cand0.length + ' repl(ies) carry two or more numbered items and a question mark. '
        + 'REPORTED, NOT REFUSED ON: numbered steps followed by a question is ordinary writing.')
      if (report) for (const c of cand0) say('  CANDIDATE  x' + c.numbered + '  ' + c.first.slice(0, 70))
    }
    return 3
  }

  // THE REFUSAL. Each decision must have a prompt inside its own window: at or after the ask, and
  // at or before the answer. Bounding both ends is what makes this a measure of THIS decision
  // rather than of the session's prompt count, which a single prompt could otherwise satisfy for
  // every decision at once.
  const naked = []
  for (const d of mine) {
    const upper = d.answeredAt !== null ? d.answeredAt : s.last
    const hit = s.prompts.find(p => p.at !== null && p.at >= d.at && p.at <= upper)
    if (!hit) naked.push(d)
  }

  const cand = proseAskCandidates(s.replies)
  say('  ' + cand.length + ' repl(ies) carry two or more numbered items and a question mark. '
    + 'REPORTED, NOT REFUSED ON: numbered steps followed by a question is ordinary writing.')
  if (report) {
    for (const d of mine) {
      const upper = d.answeredAt !== null ? d.answeredAt : s.last
      const hit = s.prompts.find(p => p.at !== null && p.at >= d.at && p.at <= upper)
      say('  ' + (hit ? 'PROMPT' : (s.prompts.length ? 'ORDER ' : 'PROSE ')) + '  '
        + d.ref + ' ' + d.key + '  ' + d.question.slice(0, 60))
    }
    for (const c of cand) say('  CANDIDATE  x' + c.numbered + '  ' + c.first.slice(0, 70))
  }

  // ST-251. TWO DIFFERENT FAULTS PRODUCE AN EMPTY WINDOW AND ONLY ONE OF THEM IS THE PROSE ASK,
  // SO THEY MAY NOT SHARE A SENTENCE. Either no prompt was raised at all, which is the breach this
  // check exists for, or one was raised OUTSIDE the window, which means the board ask was written
  // after the prompt instead of before it. The single message asserted the first in both cases,
  // and in the second it contradicted the count printed three lines above it: "1 clickable
  // prompt(s) raised" followed by "reached the founder without a clickable prompt". This tool can
  // see that no prompt falls inside a window. It cannot see that none was raised, and saying so
  // is the class of claim that costs a reader their trust in every other number here.
  //
  // THE ORDERING CASE ALSO HAS A REMEDY AND THE PROSE CASE DOES NOT, WHICH IS THE PRACTICAL HALF.
  // Once an ask is stamped after its prompt, nothing the running session can do clears it, so the
  // message has to say what to do NEXT TIME rather than print an instruction that cannot be
  // carried out now. An unperformable remedy is the S148, S177 and S178 class.
  if (naked.length) {
    if (s.prompts.length) {
      process.stdout.write('FAIL  ' + naked.length + ' of ' + mine.length + ' decision(s) has no '
        + 'clickable prompt inside its own window, though this session raised ' + s.prompts.length
        + '. That is an ORDERING fault, not a prose ask: write the board ask BEFORE raising the '
        + 'prompt and the answer after it, so the record cannot show an answer to a question '
        + 'nobody asked. Nothing clears it for a decision already stamped this way.\n')
    } else {
      process.stdout.write('FAIL  ' + naked.length + ' of ' + mine.length + ' decision(s) reached the '
        + 'founder without a clickable prompt. The rule is the host\'s interactive multiple-choice '
        + 'prompt, so they answer by clicking, and a numbered list typed into a reply is not it.\n')
    }
    for (const d of naked) {
      process.stdout.write('  ' + d.ref + ' ' + d.key + ': ' + d.question.slice(0, 90) + '\n')
    }
    return 1
  }

  say('OK  every decision put in this session reached the founder as a clickable prompt')
  return 0
}

if (require.main === module) process.exit(main(process.argv))

module.exports = { main, atAnswer, promptsIn, proseAskCandidates, decisionsOnBoard, boardTime, transcriptsFor, PROMPT_TOOLS }
