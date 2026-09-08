#!/usr/bin/env node
/**
 * check-reply-shape.js -- measures the SHAPE of the replies a session actually wrote to the
 * founder, and refuses when a reply carries a block of prose where the standing rule says point
 * form, or opens with throat-clearing the rule forbids outright.
 *
 * WHY THIS EXISTS, AND THE MEASUREMENT THAT FORCED IT. The reply-shape rule has been delivered
 * everywhere it can be: 17 of 17 roles carry it, 5 of 5 shared governance copies include it, and
 * it is imported by this project's own top-level document so it reaches the session that talks
 * to the founder and not only the agents that session dispatches. The founder has raised the
 * same complaint three sittings running anyway. Measured before this was written: fourteen
 * checks were registered across the check sets and NOT ONE of them read a reply. Delivered is
 * not obeyed, and a rule with no instrument is a note.
 *
 * There is a second cause and it is the more uncomfortable one. Every document a session reads
 * on the way in is written in the style the rule forbids, and the worst offender is this
 * project's own state document. A session imitates the corpus it is given. Nothing here fixes
 * that; this exists so the drift is visible, and so the role whose job is holding sessions to
 * process has a number rather than an opinion.
 *
 * WHY THIS IS NOT A LENGTH CAP, WHICH IS THE FIRST THING A READER WILL ASSUME IT IS. The rule
 * this enforces says in its own text that there is deliberately no line limit, because a cap
 * becomes a target and a target gets met by hiding detail rather than by writing better. The
 * ticket that raised it records the same hazard: a cap pushes detail into ticket notes the
 * founder never reads, trading a visible fault for an invisible one. So nothing here counts how
 * long a reply is. A reply of two hundred lines of bullets passes. A reply of one dense
 * paragraph does not. Both measures below are satisfied by writing in the shape the rule asks
 * for, and NEITHER can be satisfied by removing content, which is the whole design.
 *
 * WHAT IS MEASURED, AND WHY WORDS RATHER THAN LINES. The first version of this counted
 * consecutive prose LINES and was wrong, which the corpus said immediately: across every
 * reply in it the longest run of consecutive prose lines anywhere was FOUR, because a markdown
 * paragraph is one long soft-wrapped line and not several. A limit on that would have refused
 * nothing and passed forever, which is indistinguishable from a check that does not work. The
 * unit is words in a single unbroken prose block.
 *
 *   PROSE BLOCK  the largest unbroken run of prose words in one reply, counting no bullet,
 *                heading, table row, quote or fenced code. The rule is "point form, not prose;
 *                bullets by default; prose is for an argument that genuinely needs one". A
 *                paragraph past the limit is that clause being broken, in the text itself.
 *
 *   PREAMBLE     a reply whose FIRST line is throat-clearing rather than the answer. The rule
 *                says lead with the answer, and separately forbids cheerleading, restating the
 *                request and announcing what is about to be said. That is a property of the
 *                opening line alone, so it is read without guessing at intent.
 *
 * WHERE THE LIMIT COMES FROM, DERIVED AND NOT CHOSEN. Re-derived 2026-09-08 across this
 * project's 39 top-level transcripts: 3,195 assistant replies, of which 3,191 carry a prose
 * block that can be measured at all. The largest prose block per reply runs p50 26 words, p75
 * 41, p90 62, p95 77, p99 99, maximum 154. The limit is 80, just above the ninety-fifth
 * percentile, so it refuses the densest 3.9 per cent (123 of 3,195) and leaves an argument that
 * genuinely needs a paragraph alone. It is stated here with the population, the boundary AND the
 * date, because a number without the boundary it was counted across carries nothing (S125).
 *
 * THIS PARAGRAPH USED TO GIVE TWO DIFFERENT TOTALS FOR ONE CORPUS, 3,019 in one place and 3,020
 * in another, inside the header that argues a number carries its boundary. It was corrected by
 * re-running the derivation rather than by picking whichever of the two looked right, because
 * reconciling two numbers by choosing one is how a number nobody measured gets published twice.
 * The percentiles reproduced on the larger corpus to within one word at p90, so the limit did
 * not move.
 *
 * THE NUMBER THAT IS REPORTED AND NOT REFUSED ON, AND WHY THAT IS NOT A DODGE. Of the 987
 * replies over forty words, the MEDIAN carries 100 per cent of its words in prose and no point
 * form at all, and so does the ninetieth percentile. Refusing on prose share today would refuse
 * essentially every session ever written here, which is a check nobody can act on and everybody
 * learns to route around. It is printed on every run so the drift is visible and so the founder
 * can see the baseline move. When it has moved, it becomes a refusal; that is a decision for
 * the person watching the number, not a default this tool should pick for them.
 *
 * WHAT IT PROVES, AND IT IS LESS THAN A READER WILL ASSUME. It proves what shape the replies in
 * one session had. It does not prove they were useful, correct, or worth sending. A session can
 * write flawless bullets that say nothing and pass this every time. The other clauses of the
 * rule -- show the artifact, one reason not four, speak only when needed -- are judgements about
 * CONTENT and are deliberately not scored, because a tool inventing a verdict on those would be
 * worse than no tool.
 *
 * WHERE THE EVIDENCE COMES FROM. The same per-project transcripts check-gate-dispatch.js reads.
 * ONE HALF OF THAT IS SHARED AND THE OTHER HALF IS NOT, and this used to claim both were. The
 * directory-name derivation, projectDirName, is IMPORTED from that file, so the two tools cannot
 * disagree about where a project's sessions live. transcriptsFor and newest are COPIES: newest is
 * byte-identical to the other one today and transcriptsFor differs only by carrying the directory
 * in what it returns, and being identical today is not the same as being unable to diverge, which
 * is the whole property an import buys. A claim that two things cannot disagree is worth exactly
 * as much as the import that makes it true, so it is stated for the half that has one. That
 * derivation is undocumented and one
 * silent rename away from being wrong; when it is wrong, or the host writes no transcript, this
 * reports that it cannot see and does NOT refuse, because a gate refusing on something a
 * legitimate install can never satisfy locks that install out for good.
 *
 *   node tools/check-reply-shape.js                     the newest session for this project
 *   node tools/check-reply-shape.js --report            every reply over the limit, with numbers
 *   node tools/check-reply-shape.js --all               every transcript, not only the newest
 *   options: --root <dir>  --home <dir>  --max-prose <n>  --quiet
 *
 * Exit 0 clean, 1 refused, 2 on a usage error, 3 when no transcript could be read. Those are
 * the same four a reader of check-gate-dispatch.js already knows, and 3 is advisory by the same
 * argument: not being able to look must never count as having looked, and must never refuse.
 *
 * THE LIMIT WORTH KNOWING BEFORE TRUSTING A NUMBER FROM THIS. It reads what the session wrote,
 * not what the founder saw. And the newest transcript for a project is normally the session
 * running this, still being appended to as it reads, so a session cannot score its own final
 * reply. It scores the ones already sent, which is why its home is the wind-down set.
 */
'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')

const { projectDirName } = require('./check-gate-dispatch.js')

const MAX_PROSE_WORDS = 80

const THROAT = [
  /^(great|good|excellent|perfect|nice|awesome)\b[^.!?]*\b(question|point|catch|idea)\b/i,
  /^(sure|certainly|absolutely|of course|no problem|happy to)\b/i,
  /^(let me|i'll now|i will now|now let me|i'm going to|i am going to|i'll start by|first, let me)\b/i,
  /^(here'?s|here is) (a|the) (summary|overview|breakdown|rundown|quick)/i,
  /^(to summari[sz]e|in summary|in conclusion|as (i )?mentioned (above|earlier))/i,
  /^(you'?re (absolutely |completely )?(right|correct))\b/i,
  /^(i (apologi[sz]e|'m sorry|am sorry))\b/i
]

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

function newest (files) {
  let best = null
  let bestAt = -1
  for (const f of files) {
    let at
    try { at = fs.statSync(f).mtimeMs } catch (e) { continue }
    if (at > bestAt) { bestAt = at; best = f }
  }
  return best
}

// Every assistant reply in one transcript, as text. A tool call is not a reply: the founder
// never sees it, and scoring it would measure the shape of machinery rather than of writing.
function repliesIn (file) {
  let raw
  try { raw = fs.readFileSync(file, 'utf8') } catch (e) { return { why: 'the session could not be read: ' + e.message } }
  const out = []
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.indexOf('assistant') === -1) continue
    let rec
    try { rec = JSON.parse(line) } catch (e) { continue }
    if (!rec || !rec.message || rec.message.role !== 'assistant') continue
    const content = rec.message.content
    if (!Array.isArray(content)) continue
    for (const block of content) {
      if (!block || block.type !== 'text') continue
      if (typeof block.text !== 'string' || !block.text.trim()) continue
      out.push(block.text)
    }
  }
  return { replies: out }
}

function wordsIn (s) { return s.split(/\s+/).filter(Boolean).length }

// A line carries point form when it opens as a bullet, a numbered item, a heading, a table row
// or a quote. Anything inside a fenced block is skipped in BOTH directions, because pasting the
// line a tool printed is the behaviour the rule asks for and scoring it as prose would penalise
// exactly the right answer.
function shapeOf (text) {
  const lines = text.split(/\r?\n/)
  // AN ODD NUMBER OF FENCE LINES USED TO HIDE THE REST OF THE REPLY. The flag was toggled and
  // never reconciled at the end of the text, so a reply whose last fence is never closed scored
  // ZERO from that point on and a dense paragraph below it was invisible. A reply is a fragment
  // of a stream, so an unterminated fence is an ordinary thing rather than a corruption. The last
  // fence is counted first and, when the count is odd, that final one opens nothing.
  const fenceLines = lines.filter(l => l.trim().slice(0, 3) === '```').length
  const unterminated = fenceLines % 2 === 1
  let fencesSeen = 0
  let fenced = false
  let first = null
  let prose = 0
  let point = 0
  let run = 0
  let biggest = 0
  for (const raw of lines) {
    const t = raw.trim()
    if (t.slice(0, 3) === '```') {
      fencesSeen++
      if (!(unterminated && fencesSeen === fenceLines)) fenced = !fenced
      run = 0
      continue
    }
    if (fenced) continue
    if (!t) { run = 0; continue }
    if (first === null) first = t
    const w = wordsIn(t)
    if (/^([-*+]|\d+[.)])\s/.test(t) || /^#{1,6}\s/.test(t) || t[0] === '|' || t[0] === '>') {
      point += w
      run = 0
      continue
    }
    prose += w
    run += w
    if (run > biggest) biggest = run
  }
  const opener = first === null ? '' : first.replace(/^[*_#\s]+/, '')
  return {
    biggestProseBlock: biggest,
    proseWords: prose,
    pointWords: point,
    throat: opener !== '' && THROAT.some(re => re.test(opener)),
    first: first || ''
  }
}

function say (quiet, s) { if (!quiet) process.stdout.write(s + '\n') }

function main (argv) {
  const quiet = has(argv, 'quiet')
  const report = has(argv, 'report')
  const all = has(argv, 'all')
  const rootArg = flagOf(argv, 'root', process.cwd())
  const homeArg = flagOf(argv, 'home', os.homedir())
  const maxArg = flagOf(argv, 'max-prose', String(MAX_PROSE_WORDS))
  for (const pair of [['root', rootArg], ['home', homeArg], ['max-prose', maxArg]]) {
    if (pair[1] === null) {
      process.stderr.write('check-reply-shape: --' + pair[0] + ' needs a value after it\n')
      return 2
    }
  }
  const max = Number(maxArg)
  if (!Number.isInteger(max) || max < 1) {
    process.stderr.write('check-reply-shape: --max-prose needs a whole number of words, at least 1\n')
    return 2
  }

  const t = transcriptsFor(rootArg, homeArg)
  if (t.why) {
    say(quiet, 'REPLY SHAPE  CANNOT TELL. ' + t.why)
    return 3
  }
  const files = all ? t.files.slice().sort() : [newest(t.files)]
  if (!files[0]) {
    say(quiet, 'REPLY SHAPE  CANNOT TELL. no session in the transcript directory could be measured')
    return 3
  }

  const rows = []
  const unreadable = []
  for (const f of files) {
    const r = repliesIn(f)
    if (r.why) { unreadable.push(path.basename(f) + ': ' + r.why); continue }
    for (const text of r.replies) rows.push(shapeOf(text))
  }
  if (!rows.length) {
    say(quiet, 'REPLY SHAPE  CANNOT TELL. ' + (unreadable.length ? unreadable.join('; ') : 'the session holds no reply to the founder yet'))
    return 3
  }

  const over = rows.filter(r => r.biggestProseBlock > max)
  const throats = rows.filter(r => r.throat)
  const worst = rows.reduce((a, b) => (b.biggestProseBlock > a.biggestProseBlock ? b : a), rows[0])
  const substantial = rows.filter(r => r.proseWords + r.pointWords > 40)
  const proseShare = substantial.length
    ? Math.round(100 * substantial.reduce((s, r) => s + r.proseWords, 0)
      / substantial.reduce((s, r) => s + r.proseWords + r.pointWords, 0))
    : 0

  say(quiet, 'REPLY SHAPE  ' + rows.length + ' repl(ies) across ' + files.length + ' session(s)')
  say(quiet, '  largest prose block: ' + worst.biggestProseBlock + ' word(s), against a limit of ' + max)
  say(quiet, '  ' + over.length + ' past the limit, ' + throats.length + ' opening with preamble')
  say(quiet, '  prose share of the ' + substantial.length + ' repl(ies) over 40 words: ' + proseShare
    + ' per cent. REPORTED, NOT REFUSED ON: see the header for why.')
  for (const u of unreadable) say(quiet, '  note  ' + u)
  if (report) {
    for (const r of over) say(quiet, '  OVER  ' + r.biggestProseBlock + ' words  ' + r.first.slice(0, 70))
    for (const r of throats) say(quiet, '  PREAMBLE  ' + r.first.slice(0, 70))
  }

  if (over.length || throats.length) {
    process.stdout.write('FAIL  ' + over.length + ' repl(ies) carry a prose block past ' + max
      + ' word(s) and ' + throats.length + ' open with preamble\n')
    for (const r of over) process.stdout.write('  ' + r.biggestProseBlock + ' words: ' + r.first.slice(0, 70) + '\n')
    for (const r of throats) process.stdout.write('  preamble: ' + r.first.slice(0, 70) + '\n')
    return 1
  }
  say(quiet, 'OK  every reply is point form and opens with the answer')
  return 0
}

if (require.main === module) process.exit(main(process.argv.slice(2)))

module.exports = { main, shapeOf, repliesIn, transcriptsFor, newest, THROAT, MAX_PROSE_WORDS }
