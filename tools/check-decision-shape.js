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
//
// THROUGH THE ONE PARSER (ST-283). This file worked out the right rule on its own and then held
// a second copy of it, which is how the board came to have two clocks in the first place: every
// copy is correct on the day it is written. The local regex also tested for [Zz] ANYWHERE in the
// string rather than at its end, so it agreed with clock.parse by luck on every stamp either
// will ever see and not by construction.
const clock = require('./clock.js')
function boardTime (s) {
  const t = clock.parse(s)
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

// Every option label a prompt actually put in front of the founder. Flattened across questions,
// because the board records one option set per decision and a prompt may carry more than one
// question; a decision bundled with another is its own fault and is not what this measures.
// Anything unreadable returns an empty list.
//
// THIS COMMENT USED TO SAY THAT AN EMPTY LIST IS "reported as CANNOT TELL", AND IT WAS NOT. The
// empty list reached optionOrder, which returned the same null it returns for a clean match, and
// the caller reads that null as agreement and stops looking. So the one shape this function
// cannot parse was the one silently counted as correct. Fixed at optionOrder below; the comment
// is corrected here rather than deleted, because a false comment about a control is how the next
// reader learns not to check. ST-240.
function labelsOf (input) {
  if (!input || typeof input !== 'object') return []
  const qs = Array.isArray(input.questions) ? input.questions : []
  const out = []
  for (const q of qs) {
    if (!q || !Array.isArray(q.options)) continue
    for (const o of q.options) {
      if (o && typeof o.label === 'string') out.push(o.label)
    }
  }
  return out
}

// THE COMPARISON, AND IT IS DELIBERATELY NOT AN EQUALITY TEST. The host marks a recommendation and
// may present a label differently from the string written to the board, so demanding byte equality
// would refuse correct work. What is unambiguous is the COUNT: a board ask naming more options than
// the prompt carried is a record of something that did not happen. Returns null when either side is
// unreadable, so silence never reads as agreement.
function optionGap (boardOptions, promptLabels) {
  if (!Array.isArray(boardOptions) || !boardOptions.length) return null
  if (!Array.isArray(promptLabels) || !promptLabels.length) return null
  if (promptLabels.length >= boardOptions.length) return null
  return { onBoard: boardOptions.length, shown: promptLabels.length, missing: boardOptions.length - promptLabels.length }
}

// AND THE ORDER, WHICH IS THE SECOND SHAPE AND THE ONE THAT CAN WRITE A FALSE RULING. The board
// answers by NUMBER and stores the TEXT of that option, so if the prompt lists the same options in
// a different order the record says the founder chose something they did not click. Measured once:
// an answer recorded as option 3 had been clicked in position 1, because the prompt puts the
// recommendation first and the ask did not. Nobody was misled, and the RECORD was wrong, which is
// the half that outlives the conversation.
//
// NORMALISED, because the host marks the recommendation and the board does not. Only a genuine
// reordering of the SAME options is reported: when the two sides carry different text this returns
// null, because that is a different fault and saying both at once names neither.
function normaliseLabel (s) {
  return String(s).toLowerCase().replace(/\(recommended\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

// PAIRED BY WORD OVERLAP, NOT BY EQUALITY OR BY PREFIX, AND THIS IS THE WHOLE OF ST-304 HIGH 1.
// The first version required the two sides to carry the same text after normalising, which is
// unachievable by construction: the host caps a prompt label at 82 characters and a board option
// in this project runs to 503, so a label is a SHORT PARAPHRASE of the option it names. Measured
// across the real record, of 24,790 comparable pairs it could say anything about THREE, and it
// returned null on ST-296 d5, the one recorded instance of the defect and the reason the rule
// exists. A check built on an assumption nobody had measured.
//
// PREFIX MATCHING WAS THE SECOND WRONG ANSWER AND IT FAILED ON THE SAME CASE. The founder was
// shown "The method is the product" against a board option reading "Any founder can run a
// studio-grade process alone, and the method is the product": the paraphrase is of the TAIL, so
// neither string starts with the other. Word overlap is what actually holds, and it is measured
// as the share of the LABEL's words present in the option, because the label is the short side.
//
// AMBIGUITY AND SILENCE ARE DIFFERENT ANSWERS AND USED TO BE THE SAME ONE. In order and cannot-
// tell both returned null, so a reader could not tell a check that agreed from one with nothing
// to compare. S219. The unknown case is now a value the caller has to print.
// ONE SET PER QUESTION, BECAUSE A PROMPT CAN CARRY MORE THAN ONE AND FLATTENING THEM MAKES THE
// COMPARISON IMPOSSIBLE. The real ST-296 prompt put TWO questions, so labelsOf returned eight
// labels against a four-option board ask: the counts never matched, optionGap saw a prompt with
// MORE options than the board and said nothing, and optionOrder refused to compare different
// lengths. The one recorded instance of the defect was unreachable by construction, on top of
// being unmatchable by text. Bundling several decisions into one prompt is its own fault and is
// not what this measures; what this needs is to know which question belongs to which ask.
function labelSetsOf (input) {
  if (!input || typeof input !== 'object') return []
  const qs = Array.isArray(input.questions) ? input.questions : []
  const out = []
  for (const q of qs) {
    if (!q || !Array.isArray(q.options)) continue
    const set = []
    for (const o of q.options) if (o && typeof o.label === 'string') set.push(o.label)
    if (set.length) out.push(set)
  }
  return out
}

// EVERY WORD, INCLUDING THE SHORT ONES. A first version dropped words of two characters or fewer
// as noise, which is harmless on the real data and fatal on anything terse: a label reading "do
// it" or "a" has NO words left, scores zero against everything and comes back as cannot-tell. The
// overlap is measured as a share of the label's own words and the margin below does the
// discriminating, so common words cost nothing here and dropping them costs the short cases.
function wordsOf (s) {
  return normaliseLabel(s).split(' ').filter(w => w.length > 0)
}

function overlap (labelWords, optionWords) {
  if (!labelWords.length) return 0
  const have = new Set(optionWords)
  let hit = 0
  for (const w of labelWords) if (have.has(w)) hit++
  return hit / labelWords.length
}

// Which board option each prompt label names, or null when that cannot be established. A clear
// winner means most of the label's words appear in one option and in no other as strongly; two
// options scoring alike is CANNOT TELL rather than a guess, because guessing invents an ordering
// finding out of nothing.
function pairLabels (boardOptions, promptLabels) {
  const opts = boardOptions.map(o => wordsOf(o))
  const used = new Set()
  const map = []
  for (const label of promptLabels) {
    const lw = wordsOf(label)
    let best = -1, bestScore = 0, runnerUp = 0
    for (let i = 0; i < opts.length; i++) {
      if (used.has(i)) continue
      const sc = overlap(lw, opts[i])
      if (sc > bestScore) { runnerUp = bestScore; bestScore = sc; best = i }
      else if (sc > runnerUp) { runnerUp = sc }
    }
    if (best === -1 || bestScore < 0.6 || bestScore - runnerUp < 0.2) return null
    used.add(best)
    map.push(best)
  }
  return map
}

// THREE ANSWERS AND NOT TWO, AND CONFLATING TWO OF THEM MADE SILENCE READ AS AGREEMENT. This
// returned null both when the options were IN ORDER and when they could not be compared at all,
// and the caller treats null as a clean match that settles the whole decision and stops looking.
// So one unreadable prompt anywhere in the window ERASED a real finding already made against the
// same ask. Two asks in flight with one prompt each is the ordinary shape here, which makes the
// erasing case ordinary too. A reviewer found it by running it, not by reading it. ST-240.
//
// So: null is AGREEMENT and nothing else. { unknown: true } is CANNOT TELL, which is printed
// rather than swallowed. Anything else is a finding.
function optionOrder (boardOptions, promptLabels) {
  if (!Array.isArray(boardOptions) || !Array.isArray(promptLabels)) return { unknown: true }
  if (!boardOptions.length || !promptLabels.length) return { unknown: true }
  // A PROMPT CARRYING MORE OPTIONS THAN THE ASK IS NOT AGREEMENT EITHER, AND IT USED TO PASS HERE.
  // optionGap only refuses the other direction, the board naming more than the prompt showed, so a
  // prompt showing a fourth option FIRST fell through to this length test and was read as a match,
  // while a click on position 1 writes board option 1. That is the false-ruling shape the rule
  // shipped to every role describes. Reported as cannot-tell rather than as a finding, because
  // this tool does not invent an ordering it has not established.
  if (boardOptions.length !== promptLabels.length) return { unknown: true }
  const map = pairLabels(boardOptions, promptLabels)
  if (!map) return { unknown: true }
  for (let i = 0; i < map.length; i++) {
    if (map[i] !== i) {
      // THE BOARD SIDE IS THE OPTION AT THIS POSITION, NOT THE ONE THE LABEL PAIRED TO. It used to
      // be boardOptions[map[i]], which is BY CONSTRUCTION the option the shown label matches, so
      // the refusal quoted the same string on both sides of a disagreement and told a founder that
      // two identical sentences differ. A refusal a reader cannot act on is worse than silence,
      // because it spends their trust in the next one.
      return { at: i + 1, onBoard: boardOptions[i], shown: promptLabels[i] }
    }
  }
  return null
}

// THE WORST MISMATCH ACROSS EVERY PROMPT IN THE WINDOW, AND null THE MOMENT ONE OF THEM MATCHES.
// This used to take the FIRST prompt at or after the ask and judge that one alone, which made the
// refusal unclearable by the remedy it prints: raise a corrected prompt showing every option, and
// the check still reads the earlier bad one and refuses forever. A reviewer reproduced it with an
// ask, a short prompt and then a corrected prompt, and the exit stayed 1. S243 is the rule it
// broke: a control with no way out gets one built under pressure, and the way out has to be the
// one the message names. The no-prompt check beside it already asks whether ANY prompt satisfies
// it, so this is the same question asked the same way. ST-304.
// RANKED, BECAUSE THE TWO FINDINGS USED TO OVERWRITE EACH OTHER AND THE LAST ONE SEEN WON. A gap
// overwrote an order finding and an order finding overwrote a gap, so which fault a reader was
// shown depended on the order the prompts happened to sit in the transcript, and the heading names
// the remedy for whichever survived. Severity is fixed here instead: a gap outranks an order
// finding, because an option the founder was NEVER SHOWN is worse than options shown in the wrong
// sequence, and both outrank cannot-tell.
const MISMATCH_RANK = { gap: 3, order: 2, unknown: 1 }
function rankOf (w) {
  if (!w) return 0
  if (w.gap) return MISMATCH_RANK.gap
  if (w.order) return MISMATCH_RANK.order
  return MISMATCH_RANK.unknown
}

function worstMismatch (options, prompts) {
  let worst = null
  for (const p of prompts) {
    // EACH QUESTION IS ITS OWN CANDIDATE. A prompt carrying two questions offers two label sets
    // and only one of them can be the ask being measured, so a clean match on ANY of them settles
    // the decision. Falling back to the flattened list keeps a prompt this cannot parse readable.
    const sets = (p.labelSets && p.labelSets.length) ? p.labelSets : [p.labels]
    for (const labels of sets) {
      const gap = optionGap(options, labels)
      if (gap) {
        const cand = { gap: gap, labels: labels }
        // Between two gaps the bigger one wins: it names more options the founder never saw.
        if (rankOf(cand) > rankOf(worst) || (worst && worst.gap && gap.missing > worst.gap.missing)) worst = cand
        continue
      }
      const order = optionOrder(options, labels)
      // null NOW MEANS AGREEMENT AND ONLY AGREEMENT. It used to mean that AND "could not be
      // compared", so this short-circuit cleared decisions it had never actually read.
      if (!order) return null
      // CANNOT TELL NEVER REFUSES AND NEVER COUNTS AS AGREEMENT. It is the weakest of the three
      // answers and is only kept when nothing worse was found, so a reader is told the check had
      // nothing to compare rather than being left to read silence as a pass. S219.
      if (order.unknown) {
        const cand = { unknown: true, labels: labels }
        if (rankOf(cand) > rankOf(worst)) worst = cand
        continue
      }
      const cand = { order: order, labels: labels }
      if (rankOf(cand) > rankOf(worst)) worst = cand
    }
  }
  return worst
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
        // THE LABELS, NOT ONLY THAT IT HAPPENED. Every option the founder could actually click,
        // flattened across the prompt's questions, so the board's claim about what was offered can
        // be held against what was shown. ST-304.
        prompts.push({ at: ts, name: block.name, labels: labelsOf(block.input), labelSets: labelSetsOf(block.input) })
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
        // ST-304. THE OPTIONS, BECAUSE THE RECORD CAN OVERSTATE WHAT THE FOUNDER WAS SHOWN. This
        // check asked only whether a prompt was raised, and a prompt was raised on all five
        // decisions of the sitting that found this, so it exited 0 while three of them wrote four
        // options to the board and put three to the founder, dropping the explicit escape every
        // time. Nobody was trapped, because the host adds an Other of its own, and that is exactly
        // why it survived: the prompt LOOKS complete and the defect is in the record. A record
        // that overstates what was put to the founder is the one kind that must never be wrong,
        // because the next session cites it and cannot tell the two apart.
        options: Array.isArray(d.options) ? d.options.map(o => String(o)) : [],
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
  if (naked.length) return { code: 1, naked: naked, prompts: s.prompts.length, decisions: open }

  // ST-304. AND THE OPTIONS HAVE TO MATCH WHAT WAS SHOWN. This is the moment to refuse it: the
  // answer has not been written yet, so raising a corrected prompt still clears it, which is the
  // same reason this command exists at all. After the answer there is no remedy left except
  // editing the record, and a record edited to agree with itself proves nothing.
  const gaps = []
  const unknowns = []
  for (const d of open) {
    const inWindow = s.prompts.filter(p => p.at !== null && p.at >= d.at)
    if (!inWindow.length) continue
    const worst = worstMismatch(d.options, inWindow)
    // A cannot-tell is reported at the end of the run and does not hold the answer up, because
    // refusing on it would make an unparseable prompt unanswerable.
    if (worst && worst.unknown) { unknowns.push({ decision: d, labels: worst.labels }); continue }
    if (worst) gaps.push({ decision: d, gap: worst.gap, order: worst.order, labels: worst.labels })
  }
  if (gaps.length) return { code: 1, gaps: gaps, unknowns: unknowns, prompts: s.prompts.length, decisions: open }
  return { code: 0, decisions: open, unknowns: unknowns, prompts: s.prompts.length }
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
    // A CANNOT TELL IS PRINTED ON EVERY PATH, AND UNTIL NOW IT WAS PRINTED ON NONE OF THEM. The
    // unknowns were collected here and never written, so a decision this could not compare came
    // back as the same bare OK line as one it had checked and agreed with. The rule composed into
    // all seventeen roles told its reader to READ WHAT IT PRINTED rather than trust the exit code,
    // and there was nothing printed to read. A reviewer found it by running the case. ST-240.
    //
    // It is said out loud rather than made a refusal, because refusing on a prompt this cannot
    // parse would leave the decision unanswerable and the remedy would be to reword a question the
    // founder has already been shown. Silence is the thing being fixed, not leniency.
    const sayUnknowns = (list) => {
      if (!list || !list.length) return
      for (const u of list) {
        say('  CANNOT TELL  ' + u.decision.ref + ' ' + u.decision.key + ': the prompt and the ask '
          + 'could not be compared, so this is NOT a statement that they agree. The board names '
          + u.decision.options.length + ' option(s) and the prompt showed ' + u.labels.length
          + '. Check by eye that the same options were put in the same order.')
      }
    }
    if (r.code === 0) {
      say('OK  ' + r.decisions.length + ' open decision(s) on ' + atRef + ' had a clickable prompt '
        + 'raised at or after the ask was written')
      sayUnknowns(r.unknowns)
      return 0
    }
    // ST-304. THE RECORD SAYS MORE OPTIONS WERE PUT THAN WERE SHOWN, and the option that goes
    // missing is almost always the explicit escape, because it is the one the host appears to
    // supply for you. The remedy is the same shape as the one below and is still available at
    // this moment: raise the prompt again carrying every option the ask names, then answer.
    if (r.gaps && r.gaps.length) {
      // THE HEADING NAMES WHAT WAS ACTUALLY FOUND, AND USED TO NAME ONE SHAPE FOR BOTH. It said
      // the board claimed an option that was never shown, and printed that over a REORDERING,
      // where every option WAS shown and the remedy it named reproduced the refusal. A content
      // reviewer ran it. The wind-down printer had already been corrected for the same fault and
      // this one was not: the second time in one sitting a fix reached one of two call sites.
      const anyGap = r.gaps.some(g => g.gap)
      const anyOrder = r.gaps.some(g => g.order)
      process.stdout.write('FAIL  ' + r.gaps.length + ' decision(s) on ' + atRef + ' do not match '
        + 'the prompt the founder was shown. The board is the record the next session cites, so '
        + 'it must describe what was actually put to them.' + '\n')
      if (anyGap) {
        process.stdout.write('      Where the board names MORE options than were shown: raise the '
          + 'prompt again with every option the ask names, including the explicit escape, then '
          + 'run this answer again.' + '\n')
      }
      if (anyOrder) {
        process.stdout.write('      Where the options were REORDERED: every option WAS shown, so '
          + 'raising the same prompt again will not clear it. Put the ask and the prompt in the '
          + 'same order, recommended option first. The answer is written BY NUMBER against the '
          + 'ask.' + '\n')
      }
      for (const g of r.gaps) {
        if (g.order) {
          process.stdout.write('  ' + g.decision.ref + ' ' + g.decision.key + ': the same '
            + 'options in a different order. They first disagree at position ' + g.order.at
            + ', where the board says ' + JSON.stringify(g.order.onBoard) + ' and the prompt '
            + 'showed ' + JSON.stringify(g.order.shown) + '. The answer is written BY NUMBER, so '
            + 'that number does not address the option the founder clicked.' + '\n')
          continue
        }
        process.stdout.write('  ' + g.decision.ref + ' ' + g.decision.key + ': board names '
          + g.gap.onBoard + ' option(s), prompt showed ' + g.gap.shown + ', ' + g.gap.missing
          + ' missing' + '\n')
        process.stdout.write('    on the board: ' + g.decision.options.join(' | ') + '\n')
        process.stdout.write('    shown:        ' + g.labels.join(' | ') + '\n')
      }
      // A refusal about one decision must not silence a cannot-tell about another.
      sayUnknowns(r.unknowns)
      return 1
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

  // ST-304. WHAT THE BOARD CLAIMS WAS OFFERED, AGAINST WHAT THE PROMPT SHOWED. REPORTED HERE AND
  // REFUSED ONLY AT --at-answer, because by the time a session reads this the answer is written
  // and the only thing left to change is the record. Said out loud anyway, because the wind-down
  // is where a sitting finds out what its own record now claims, and three of five decisions went
  // out this way in the sitting that found it without one of five rounds of checking noticing.
  const shownGaps = []
  for (const d of mine) {
    const upper = d.answeredAt !== null ? d.answeredAt : s.last
    const inWindow = s.prompts.filter(p => p.at !== null && p.at >= d.at && p.at <= upper)
    if (!inWindow.length) continue
    const worst = worstMismatch(d.options, inWindow)
    if (worst) shownGaps.push({ decision: d, gap: worst.gap, order: worst.order, unknown: worst.unknown })
  }
  // THREE SHAPES REACH THIS PRINTER AND IT USED TO HANDLE TWO, SO THE THIRD CRASHED IT. A row
  // carrying neither a gap nor an order finding is a CANNOT TELL, and the loop below fell past the
  // order branch and read g.gap.onBoard on it: TypeError, exit 1, the wind-down reading dead. It
  // killed the real session that recorded the defect this whole check was built for, where THREE
  // decisions pair as cannot-tell. The heading had already been corrected once
  // for exactly this, one field over, and the comment describing that fix sat directly above the
  // line that still had it. A reviewer found it by RUNNING the case, which is the second time in
  // two rounds that a fix reached one of two call sites. ST-240.
  //
  // A cannot-tell is also SEPARATED FROM THE COUNT. It is not a decision that failed to match; it
  // is one nothing could be said about, and folding it into the mismatch total overstates the
  // finding in a record whose entire job is not to overstate what was put to the founder.
  const shownMismatch = shownGaps.filter(g => g.gap || g.order)
  const shownUnknown = shownGaps.filter(g => !g.gap && !g.order)
  if (shownMismatch.length) {
    say('  ' + shownMismatch.length + ' decision(s) do not match the prompt the founder was shown. '
      + 'REPORTED, NOT REFUSED ON at this moment: the answer is already written, so the remedy is '
      + 'at --at-answer and not here. The record is what is wrong, and it is what the next '
      + 'session will cite.')
    for (const g of shownMismatch) {
      if (g.order) {
        say('  SHOWN   ' + g.decision.ref + ' ' + g.decision.key + '  same options, different '
          + 'order, first disagreeing at position ' + g.order.at)
        continue
      }
      say('  SHOWN   ' + g.decision.ref + ' ' + g.decision.key + '  board ' + g.gap.onBoard
        + ', prompt ' + g.gap.shown + ', ' + g.gap.missing + ' missing')
    }
  }
  if (shownUnknown.length) {
    say('  ' + shownUnknown.length + ' decision(s) could not be compared with the prompt at all. '
      + 'This is NOT a statement that they agree. Check by eye that the same options were put in '
      + 'the same order.')
    for (const g of shownUnknown) {
      say('  CANNOT TELL  ' + g.decision.ref + ' ' + g.decision.key + '  the board names '
        + g.decision.options.length + ' option(s)')
    }
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

module.exports = { main, atAnswer, promptsIn, proseAskCandidates, decisionsOnBoard, boardTime, transcriptsFor, labelsOf, labelSetsOf, optionGap, optionOrder, pairLabels, PROMPT_TOOLS }
