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
 * IT IS NOW A LENGTH CAP AS WELL, AND THIS PARAGRAPH USED TO ARGUE THE OPPOSITE. Until
 * 2026-09-17 nothing here counted how long a reply was, on the reasoning that a cap becomes a
 * target met by hiding detail rather than by writing better, and that it pushes detail into
 * ticket notes the founder never reads. That hazard is real and has not gone away. What
 * overturned the conclusion is that the founder complained for four sittings, the rule was
 * measured reaching 11 of 11 sessions, and nothing improved: a rule that caps SHAPE does not cap
 * AMOUNT, and a forty-bullet reply was fully compliant with every measure this file had (S209).
 * An unfalsifiable claim about brevity is worth less than a cap with a known cost, so the cost
 * is stated rather than hidden: detail moved off a reply must land on the ticket, and a session
 * that empties its replies into notes nobody opens has broken the rule in a way this cannot see.
 *
 * THE THIRD MEASURE, EM-DASHES, AND THE DEFECT THAT ADDED IT. The em-dash ban is permanent,
 * retroactive, and named in the governance core as applying to every string a reader sees. This
 * check read every reply a session wrote to the founder and did not once count the banned
 * character. On 2026-09-10 a method reviewer caught one by hand and reported ONE; the instrument,
 * the moment it could count, found FOUR across two replies in the same session, three of them in
 * the very reply that was reporting a content gate's em-dash findings. A rule enforced by hand is
 * enforced at whatever rate the hand is having a good day, and the hand here belonged to the
 * reviewer whose whole job was catching it.
 *
 * TWO DELIBERATE EDGES ON THAT COUNT. Fenced blocks are EXCLUDED, because pasting a tool's output
 * that contains an em-dash is quoting evidence, which these rules ask for everywhere else;
 * refusing a session for showing its working teaches people to stop pasting the numbers, which
 * costs more than the dashes it saves. And U+2015 HORIZONTAL BAR is counted alongside U+2014,
 * because it is visually identical at every size a reader sees and a check that refuses one while
 * passing the other ships with a documented way around it. The en-dash is a different character
 * and is not counted, because counting it would refuse page ranges and score lines.
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
 *   REPLY WORDS  every word in one reply, prose and point form together, excluding fenced
 *                blocks. Fences are excluded for the same reason they are excluded from the
 *                em-dash count: pasting the line a tool printed is the behaviour the rule asks
 *                for, and charging a session for its own evidence teaches it to stop showing
 *                the numbers. That does mean a reply can pass this while being long on screen,
 *                which is the deliberate trade and is stated so nobody reports it as a defect.
 *
 * WHERE THE REPLY-WORD LIMIT COMES FROM, AND THE CRITERION IS NAMED SO "DERIVED" MEANS SOMETHING.
 * Counted 2026-09-17 across this project's 61 transcripts: 4,598 replies, 315,929 words. The
 * distribution is sharply bimodal, because most replies are a line between two tool calls: p50
 * is 26 words, p75 52, p90 235, p95 316, p97 367, p99 455, maximum 905. The criterion was the
 * cheapest cap that still reaches the bulk of the words, and the candidates were costed before
 * one was picked: 400 refuses 2.0 per cent of replies and reaches 14.1 per cent of the words,
 * 300 refuses 5.9 and reaches 33.6, 250 refuses 8.9 and reaches 45.6, 200 refuses 12.1 and
 * reaches 56.1. The limit is 300, where a third of every word ever written to the founder here
 * sits inside one reply in seventeen. It holds 46 of 60 sessions to at least one rewrite, and
 * the excess above the cap is 7.8 per cent of all words.
 *
 * IT SITS AT ROUGHLY THE NINETY-FOURTH PERCENTILE, WHICH IS JUST BELOW p95 AND NOT ABOVE IT, so
 * it is deliberately a shade tighter than the prose limit's convention. Said plainly rather than
 * rounded past, because the prose paragraph two above claims the ninety-fifth percentile as its
 * boundary and a reader comparing the two would otherwise assume this one matched it.
 *
 * THESE FIGURES MOVED ONCE ALREADY, BETWEEN THE FIRST DERIVATION AND THIS ONE, and the reason is
 * worth keeping: the first pass counted the bullet, the number, the heading hash and the table
 * pipes as words, so point form paid about one phantom word per line and prose paid none. The
 * measure was biased against the exact shape the rule asks for. It was fixed and everything here
 * was counted again rather than adjusted, which is why p95 reads 316 and not 325. Population,
 * boundary and date are given together because a number without the boundary it was counted
 * across carries nothing (S125).
 *
 * WHAT THE SAME COUNT SAYS ABOUT HOW MUCH THIS CAN POSSIBLY SAVE, WHICH IS THE HONEST CAVEAT AND
 * IS THE MOST USEFUL THING IN THIS HEADER. Measured 2026-09-17 by CHARACTERS, over the 61
 * transcript files above, 60 of which hold content. Of everything IN A TRANSCRIPT: replies to the
 * founder 2,054,200, which is 7.1 per cent; tool call INPUTS 13,939,042, 48.0 per cent; tool
 * RESULTS 11,401,358, 39.2 per cent; and the founder's OWN messages 1,656,646, 5.7 per cent.
 * Inside the inputs: Bash 6,944,407 over 8,338 calls, Write 3,857,331 over 660, Edit 1,934,942
 * over 1,113.
 *
 * NAME THE DENOMINATOR, BECAUSE THIS PARAGRAPH ONCE DID NOT AND THE CONTENT GATE CAUGHT IT. It
 * said replies were "7.1 per cent of everything a session GENERATES", and that total includes the
 * founder's own messages, which a session plainly does not generate. The sentence disproved
 * itself on its own arithmetic: 7.1 plus 48.0 plus 39.2 is 94.3, and the missing 5.7 was the
 * founder talking. Against what the session actually WRITES, which is replies plus tool call
 * inputs, replies are 12.8 per cent. Both figures are true and they answer different questions,
 * so neither means anything without the word before "per cent of".
 *
 * EITHER WAY THE CONCLUSION HOLDS AND IT IS THE POINT OF THE CAVEAT: a session's writing to the
 * founder is a single-digit to low-double-digit share of its own transcript, and that is before
 * the loaded context, which is re-sent whole on every request, is counted at all. This file is
 * worth having because an unmeasured rule stays unfalsifiable forever, not because reply words
 * are where the money goes. Anyone arriving here to cut a token bill is holding the small lever;
 * the large ones are what a session loads before it starts and what it pushes through a tool
 * call, in that order. Four sittings of the same complaint were spent on the seven per cent.
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
 * disagree about where a project's sessions live, and sessionTranscript is imported from it too,
 * so they cannot disagree about WHICH session is running either. transcriptsFor is still a COPY:
 * it differs only by carrying the directory in what it returns, and being nearly identical today
 * is not the same as being unable to diverge, which is the whole property an import buys.
 * A claim that two things cannot disagree is worth exactly
 * as much as the import that makes it true, so it is stated for the half that has one. That
 * derivation is undocumented and one
 * silent rename away from being wrong; when it is wrong, or the host writes no transcript, this
 * reports that it cannot see and does NOT refuse, because a gate refusing on something a
 * legitimate install can never satisfy locks that install out for good.
 *
 *   node tools/check-reply-shape.js                     the CURRENT session for this project
 *   node tools/check-reply-shape.js --report            every reply over the limit, with numbers
 *   node tools/check-reply-shape.js --all               every transcript, not only this session
 *   options: --root <dir>  --home <dir>  --max-prose <n>  --max-words <n>  --quiet
 *
 * Exit 0 clean, 1 refused, 2 on a usage error, 3 when no transcript could be read. Those are
 * the same four a reader of check-gate-dispatch.js already knows, and 3 is advisory by the same
 * argument: not being able to look must never count as having looked, and must never refuse.
 *
 * THE LIMIT WORTH KNOWING BEFORE TRUSTING A NUMBER FROM THIS. It reads what the session wrote,
 * not what the founder saw. And the transcript it reads is this session's own, still being
 * appended to as it reads, so a session cannot score its own final reply. It scores the ones already sent, which is why its home is the wind-down set.
 */
'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')

const { projectDirName, sessionTranscript } = require('./check-gate-dispatch.js')

const MAX_PROSE_WORDS = 80

// Derived, not chosen. See the header for the population, the boundary and the date.
const MAX_REPLY_WORDS = 300

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
  let dashes = 0
  let fencedDashes = 0
  for (const raw of lines) {
    const t = raw.trim()
    if (t.slice(0, 3) === '```') {
      fencesSeen++
      if (!(unterminated && fencesSeen === fenceLines)) fenced = !fenced
      run = 0
      continue
    }
    const em = raw.match(/[—―]/g)
    if (em) { if (fenced) fencedDashes += em.length; else dashes += em.length }
    if (fenced) continue
    if (!t) { run = 0; continue }
    if (first === null) first = t
    const w = wordsIn(t)
    if (/^([-*+]|\d+[.)])\s/.test(t) || /^#{1,6}\s/.test(t) || t[0] === '|' || t[0] === '>') {
      // THE MARKER IS NOT A WORD, AND COUNTING IT BIASED THE MEASURE AGAINST THE SHAPE THE RULE
      // ASKS FOR. A bullet, a number, a heading hash, a quote caret and a table's pipes were
      // each counted as words, so point form paid roughly one phantom word per line while prose
      // paid none: a forty-bullet reply was scored forty words heavier than the same words as a
      // paragraph. It went unnoticed while nothing read this number, and it matters the moment a
      // word limit reads it. Counted before the limit was derived, so the two agree.
      point += wordsIn(t.replace(/^([-*+]|\d+[.)]|#{1,6}|>)\s+/, '').replace(/\|/g, ' '))
      run = 0
      continue
    }
    prose += w
    run += w
    if (run > biggest) biggest = run
  }
  // EM-DASHES ARE COUNTED OUTSIDE FENCES ONLY, and the distinction is the whole point rather
  // than a nicety. Pasting a tool's output that happens to contain an em-dash is quoting
  // evidence, which the rules ask for; writing one into your own sentence is the thing that is
  // banned. Counting inside fences would refuse a session for showing its working, which is the
  // fastest way to teach everybody to stop pasting the numbers.
  //
  // U+2015 HORIZONTAL BAR IS COUNTED WITH U+2014, because it is visually identical at every size
  // a reader sees and a check that refuses one while passing the other is a check with a
  // documented way around it.
  // THE HYPHEN IS IN THIS SET BECAUSE IT IS THE BULLET THIS STUDIO ACTUALLY WRITES, and for
  // three sittings it was the one marker missing. The class stripped asterisk, underscore and
  // hash, so "* Let me walk you through" was tested for preamble and "- Let me walk you
  // through" was immune -- the instrument was strictest on the writers who least needed it, and
  // the founder brief, which is eleven hyphen bullets, could open with throat-clearing and pass
  // both this check and check-session-brief.js, which borrows this predicate.
  //
  // MEASURED BEFORE WIDENING, because a check that suddenly refuses a large share of historical
  // replies is one everybody routes around: 49 transcripts, 3,822 assistant replies, 1 opening
  // with a hyphen bullet, 51 tripping THROAT already, and ZERO newly refused by adding it. The
  // blast radius the ticket was written around did not exist.
  const opener = first === null ? '' : first.replace(/^[-*_#\s]+/, '')
  return {
    biggestProseBlock: biggest,
    proseWords: prose,
    pointWords: point,
    // PROSE PLUS POINT FORM, WHICH IS EVERY WORD OUTSIDE A FENCE. Derived here rather than by
    // the caller so the two numbers cannot drift apart, and so a reply of pure bullets is
    // counted at its real size: that shape was fully compliant before this existed (S209).
    totalWords: prose + point,
    throat: opener !== '' && THROAT.some(re => re.test(opener)),
    emDashes: dashes,
    fencedEmDashes: fencedDashes,
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
  const maxWordsArg = flagOf(argv, 'max-words', String(MAX_REPLY_WORDS))
  for (const pair of [['root', rootArg], ['home', homeArg], ['max-prose', maxArg], ['max-words', maxWordsArg]]) {
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
  let maxWords = Number(maxWordsArg)
  if (!Number.isInteger(maxWords) || maxWords < 1) {
    process.stderr.write('check-reply-shape: --max-words needs a whole number of words, at least 1\n')
    return 2
  }
  // THE REPLY CAP CANNOT SIT BELOW THE PROSE CAP. A reply is prose plus point form, so a
  // reply limit under the prose limit makes the prose branch unreachable and every refusal
  // would name the wrong rule. Refused as a usage error rather than silently reconciled,
  // because reconciling two numbers by picking one is how an unmeasured number gets published.
  // ONLY WHEN THE CALLER GAVE BOTH. The guard exists to catch an inconsistent PAIR, and a
  // default the caller never chose is not half of a pair: refusing --max-prose 500 on its own,
  // because the untouched reply cap sits below it, would lock out the one flag a reader reaches
  // for first. When only one is given, the other yields to it rather than refusing.
  if (has(argv, 'max-words') && has(argv, 'max-prose') && maxWords < max) {
    process.stderr.write('check-reply-shape: --max-words (' + maxWords + ') cannot be below --max-prose ('
      + max + '), because a reply contains its own prose\n')
    return 2
  }
  // AND THIS IS THE YIELDING THE COMMENT ABOVE PROMISES. Raising --max-prose alone used to leave
  // the default reply cap sitting underneath it, so the reply branch refused what the caller had
  // just deliberately allowed, and the message named a limit they never set.
  if (!has(argv, 'max-words') && maxWords < max) maxWords = max

  // --recent N: REFUSE on the last N replies only, and REPORT the whole session regardless. See
  // the header for why this exists and what it costs. Zero is not a window, it is a way of
  // switching the check off while it still prints, so it is refused like any other bad value.
  const recentArg = flagOf(argv, 'recent', null)
  let recent = null
  if (has(argv, 'recent')) {
    if (recentArg === null || !/^\d+$/.test(recentArg) || Number(recentArg) < 1) {
      process.stderr.write('check-reply-shape: --recent needs a whole number of replies, at least 1\n')
      return 2
    }
    recent = Number(recentArg)
    // REPLIES FROM DIFFERENT SESSIONS HAVE NO ORDER BETWEEN THEM. --all sorts files by NAME,
    // which is a uuid here, so "the last twenty" across sessions would be twenty replies chosen
    // by an alphabet. A window over a set with no order is a number that looks like a measure
    // and is not one, so this is a usage error rather than a quiet approximation.
    if (all) {
      process.stderr.write('check-reply-shape: --recent cannot be combined with --all, because '
        + 'replies from different sessions have no order between them\n')
      return 2
    }
  }

  const t = transcriptsFor(rootArg, homeArg)
  if (t.why) {
    say(quiet, 'REPLY SHAPE  CANNOT TELL. ' + t.why)
    return 3
  }
  // --all IS THE ONE CASE THAT WANTS EVERY SESSION, so it keeps every file. Every other
  // caller is asking about THIS session, and asking the host beats ranking by mtime: see
  // sessionTranscript in check-gate-dispatch.js for what mtime was actually selecting.
  let files
  if (all) {
    files = t.files.slice().sort()
  } else {
    const pick = sessionTranscript(t.files)
    if (pick.why) {
      say(quiet, 'REPLY SHAPE  CANNOT TELL. ' + pick.why)
      return 3
    }
    files = [pick.file]
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

  // THE REFUSAL AND THE RECORD ARE NOW TWO DIFFERENT POPULATIONS, AND THAT IS THE WHOLE OF ST-219.
  // Everything printed below counts the WHOLE session, because the record must not shrink: the
  // wind-down reads these numbers into the compliance table and a slip a session recovered from
  // still happened. Only `judged` is what the exit code is computed from, and with no --recent it
  // IS the whole session, so the default behaviour is byte-identical to before.
  const judged = recent === null ? rows : rows.slice(-recent)
  const over = judged.filter(r => r.biggestProseBlock > max)
  const long = judged.filter(r => r.totalWords > maxWords)
  const longWords = long.reduce((s, r) => s + r.totalWords, 0)
  const sessionLong = rows.filter(r => r.totalWords > maxWords)
  const sessionWords = rows.reduce((s, r) => s + r.totalWords, 0)
  const throats = judged.filter(r => r.throat)
  const dashed = judged.filter(r => r.emDashes > 0)
  const dashTotal = dashed.reduce((s, r) => s + r.emDashes, 0)
  const sessionDashed = rows.filter(r => r.emDashes > 0)
  const sessionDashTotal = sessionDashed.reduce((s, r) => s + r.emDashes, 0)
  const fencedTotal = rows.reduce((s, r) => s + r.fencedEmDashes, 0)
  const worst = rows.reduce((a, b) => (b.biggestProseBlock > a.biggestProseBlock ? b : a), rows[0])
  const substantial = rows.filter(r => r.proseWords + r.pointWords > 40)
  const proseShare = substantial.length
    ? Math.round(100 * substantial.reduce((s, r) => s + r.proseWords, 0)
      / substantial.reduce((s, r) => s + r.proseWords + r.pointWords, 0))
    : 0

  say(quiet, 'REPLY SHAPE  ' + rows.length + ' repl(ies) across ' + files.length + ' session(s)')
  say(quiet, '  largest prose block: ' + worst.biggestProseBlock + ' word(s), against a limit of ' + max)
  say(quiet, '  ' + rows.filter(r => r.biggestProseBlock > max).length + ' past the limit, '
    + rows.filter(r => r.throat).length + ' opening with preamble')
  say(quiet, '  ' + sessionWords + ' word(s) written to the founder, ' + sessionLong.length
    + ' repl(ies) past the reply limit of ' + maxWords
    + (rows.length ? ', longest ' + rows.reduce((a, b) => (b.totalWords > a.totalWords ? b : a), rows[0]).totalWords : ''))
  say(quiet, '  ' + sessionDashTotal + ' em-dash(es) across ' + sessionDashed.length
    + ' repl(ies), outside fenced blocks')
  if (recent !== null) {
    say(quiet, '  JUDGED ON THE LAST ' + recent + ' repl(ies) of ' + rows.length + ', which is '
      + judged.length + ' repl(ies) carrying ' + dashTotal + ' em-dash(es). The count above is the '
      + 'whole session and is the record; this window is what the exit code is computed from.')
  }
  say(quiet, '  ' + fencedTotal + ' more inside fenced blocks. REPORTED, NOT REFUSED ON: quoted tool '
    + 'output is evidence, but a fenced paragraph still reaches the founder.')
  say(quiet, '  prose share of the ' + substantial.length + ' repl(ies) over 40 words: ' + proseShare
    + ' per cent. REPORTED, NOT REFUSED ON: see the header for why.')
  for (const u of unreadable) say(quiet, '  note  ' + u)
  // THE REPORT LISTS THE WHOLE SESSION EVEN WHEN THE REFUSAL DOES NOT. A reader asking for the
  // detail is asking what happened, not what is still being held against them.
  if (report) {
    for (const r of rows.filter(x => x.biggestProseBlock > max)) say(quiet, '  OVER  ' + r.biggestProseBlock + ' words  ' + r.first.slice(0, 70))
    for (const r of rows.filter(x => x.throat)) say(quiet, '  PREAMBLE  ' + r.first.slice(0, 70))
    for (const r of sessionDashed) say(quiet, '  EM-DASH  x' + r.emDashes + '  ' + r.first.slice(0, 70))
    for (const r of sessionLong) say(quiet, '  LONG  ' + r.totalWords + ' words  ' + r.first.slice(0, 70))
  }

  if (over.length || throats.length || dashed.length || long.length) {
    process.stdout.write('FAIL  ' + over.length + ' repl(ies) carry a prose block past ' + max
      + ' word(s), ' + long.length + ' run past ' + maxWords + ' word(s) carrying ' + longWords
      + ' of them, ' + throats.length + ' open with preamble, and ' + dashTotal
      + ' em-dash(es) reached the founder across ' + dashed.length + ' repl(ies)'
      + (recent === null ? '' : ', in the last ' + recent + ' repl(ies)') + '\n')
    for (const r of over) process.stdout.write('  ' + r.biggestProseBlock + ' words: ' + r.first.slice(0, 70) + '\n')
    // THE REMEDY IS NAMED ON THE LINE, because a length refusal with no remedy is the one a
    // session satisfies by deleting the finding rather than by moving it (S207).
    for (const r of long) process.stdout.write('  long ' + r.totalWords + ' words, move the detail to the ticket: ' + r.first.slice(0, 70) + '\n')
    for (const r of throats) process.stdout.write('  preamble: ' + r.first.slice(0, 70) + '\n')
    for (const r of dashed) process.stdout.write('  em-dash x' + r.emDashes + ': ' + r.first.slice(0, 70) + '\n')
    return 1
  }
  // THE PASS MUST NOT CLAIM MORE THAN IT MEASURED. With a window, a clean exit says the session
  // has recovered, not that it never slipped, and printing the older wording would make a
  // recovered session read exactly like a spotless one in the only line most readers see.
  if (recent !== null && (sessionDashTotal || sessionLong.length || rows.length !== judged.length)) {
    say(quiet, 'OK  the last ' + recent + ' repl(ies) are point form, open with the answer, stay under '
      + maxWords + ' words and carry no em-dash. Earlier in this session: ' + sessionDashTotal
      + ' em-dash(es) across ' + sessionDashed.length + ' repl(ies) and ' + sessionLong.length
      + ' repl(ies) past the word limit, which is recorded and no longer refused on.')
    return 0
  }
  say(quiet, 'OK  every reply is point form, opens with the answer, stays under ' + maxWords
    + ' words, and carries no em-dash')
  return 0
}

if (require.main === module) process.exit(main(process.argv.slice(2)))

module.exports = { main, shapeOf, repliesIn, transcriptsFor, THROAT, MAX_PROSE_WORDS, MAX_REPLY_WORDS }
