#!/usr/bin/env node
/**
 * check-mutation-coverage.js -- derives which lines of a tool its own suite actually proves, by
 * deleting each line and running the suite, and refuses when a line nobody's assertion depends on
 * is not recorded as accepted.
 *
 * WHY THIS EXISTS, AND IT IS THE ONLY REASON. check-gate-dispatch.test.js carried a hand-written
 * paragraph listing which guards had fixtures and which deliberately did not. That paragraph was
 * proved FALSE by three separate review rounds. Round four found it claiming ONE unfixtured guard
 * where there were three, and built deterministic fixtures for two of them. Round five found the
 * corrected version claiming two races could not be fixtured at all, on the strength of one API
 * failing, and fixtured both. The same round found a line reached only in production that no test
 * had ever touched, and a branch whose deletion changed nothing while the suite stayed green.
 *
 * Every one of those is the same defect: a claim about coverage, written by the person who wrote
 * the code, checked by nobody, and re-sent to every future reader as fact. Being more careful was
 * tried four times. So the claim is no longer written. It is DERIVED, here, by an experiment that
 * anybody can rerun, and the only thing a person writes by hand is the REASON a line is allowed to
 * be silent -- which is a judgement, and cannot be derived.
 *
 * THE EXPERIMENT. For each line of the tool that is code rather than comment or blank: delete it,
 * run the suite, and read the result.
 *
 *   COVERED       the suite went red. Some assertion depends on that line. This is the good case.
 *   SILENT        the suite stayed green. Nothing anybody wrote depends on that line being there.
 *   CRASHED       the suite ran and printed no count at all. Deleting the line did not stop the
 *                 file being a program; it stopped the SUITE being able to report. That is a
 *                 FAILED EXPERIMENT (S112) and it is usually a real finding about the suite: an
 *                 in-process call with no catch turns every throwing mutation into this, and one
 *                 such call cost 37 lines their classification in a single run (S127).
 *   NOT MUTABLE   the PARSER refused the mutant, so it is no longer a program at all. Nothing
 *                 could depend on a line whose removal leaves no program, so this needs no reason
 *                 and can never refuse.
 *
 * CRASHED AND NOT MUTABLE ARE KEPT APART, AND ROUND SIX OF THE GATE IS WHY. This header used to
 * say a not-mutable line was one the parser refused, and the code then ORed that with a crash
 * inferred from the suite printing no count. So the one bucket that needs no account was quietly
 * absorbing lines that had never been shown to be unparseable: on the release gate the 39 was 34
 * unparseable and 5 CRASHED, all five of which still parse, and one of them was the definition of
 * what counts as a review. A line in a bucket that needs no reason can never refuse, so folding
 * the two together is how a real finding disappears while the header still reads true.
 *
 * SILENT IS NOT AUTOMATICALLY A DEFECT, WHICH IS WHY THIS TOOL DOES NOT JUST COUNT THEM. A line
 * can be silent because it guards a case nobody has written an assertion for, which is a hole. It
 * can also be silent because it is genuinely redundant with the line above it, or because it is
 * defensive against something the suite cannot produce. Those are different, a machine cannot tell
 * them apart, and pretending otherwise produces a check people learn to ignore. So every silent
 * line must appear in the baseline beside this tool with a reason a stranger can read, and
 * anything else refuses. CRASHED IS HELD TO THE SAME STANDARD, for the same reason and one step
 * harder: a crash is a statement about the SUITE rather than about the line, so its reason has to
 * say why the suite cannot be made to report instead.
 *
 * IT REFUSES IN BOTH DIRECTIONS, WHICH IS THE PART THAT KEEPS THE RECORD HONEST. An unaccounted
 * line fails, so a new guard nobody proved cannot arrive quietly. A baseline entry that is no
 * longer in the state it was accepted for ALSO fails, so an exemption written months ago cannot
 * outlive the reason for it, and a line accepted as CRASHED that has since become merely silent
 * is caught by the same rule, because the baseline records which of the two it was. That second
 * half is the one the hand-written paragraph never had: its claims could rot, and did, without
 * anything going red.
 *
 * NO MUTATION EVER TOUCHES THE WORKING TREE. The tool's whole directory is copied to a temporary
 * one and every mutation is applied to the copy, so an interrupted run cannot leave a mutated file
 * behind. That is deliberate: the previous way of getting these numbers was to edit the real file,
 * run, and edit it back, which is safe exactly until the run is interrupted. THE TOOL DOES MAKE
 * ONE WRITE INTO YOUR REPOSITORY, and it is the only one: --write-baseline rewrites the baseline
 * file named below. Nothing else here writes anywhere but the copy.
 *
 * WHAT IT ASSUMES OF A SUITE. That it prints a line matching "N passed, M failed" and that it can
 * be run as "node <suite>" with no arguments. Every node suite in this repository does both.
 *
 *   node tools/check-mutation-coverage.js                     the gate-dispatch pair
 *   node tools/check-mutation-coverage.js --report            every line and its classification
 *   node tools/check-mutation-coverage.js --write-baseline    record the accountable lines as they are
 *   options: --tool <file>  --suite <file>  --root <dir>  --baseline <file>  --quiet
 *
 * Exit 0 clean, 1 refused, 2 on a usage or read error.
 *
 * IT IS SLOW ON PURPOSE AND BELONGS IN THE RELEASE SET, NOT AT SESSION START. One full suite run
 * per line of the tool is the only way to know, and there is no cheaper honest version of this.
 */

'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const DEFAULT_TOOL = 'tools/check-gate-dispatch.js'
const DEFAULT_SUITE = 'tools/check-gate-dispatch.test.js'
const DEFAULT_BASELINE = 'tools/mutation-coverage-baseline.json'

const COUNT = /(\d+) passed, (\d+) failed/

function say (quiet, line) { if (!quiet) process.stdout.write(line + '\n') }

function flagOf (argv, name, fallback) {
  const i = argv.indexOf('--' + name)
  if (i === -1) return fallback
  const v = argv[i + 1]
  if (v === undefined || v.slice(0, 2) === '--') return null
  return v
}

function has (argv, name) { return argv.indexOf('--' + name) !== -1 }

// A line is a candidate if it carries code. Blank lines and comments are skipped because deleting
// one proves nothing about the program, and running the suite for each would triple the wall time
// for no answer. The block-comment state is tracked rather than pattern-matched per line, because
// a header of sixty lines is the normal shape here and every one of its lines starts with a star.
function candidates (lines) {
  const out = []
  let inBlock = false
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    const wasInBlock = inBlock
    if (inBlock) {
      if (t.indexOf('*/') !== -1) inBlock = false
      continue
    }
    if (t.slice(0, 2) === '/*') {
      if (t.indexOf('*/') === -1) inBlock = true
      continue
    }
    if (!t) continue
    if (t.slice(0, 2) === '//') continue
    if (t.slice(0, 2) === '#!') continue
    if (wasInBlock) continue
    out.push(i)
  }
  return out
}

// Whether the mutant still parses, asked of the PARSER rather than inferred from what the suite
// did. It matters more than it looks. A suite that requires its tool dies outright on a syntax
// error and reports no count, which reads as not mutable; a suite that only SPAWNS its tool sees
// the same syntax error as a non-zero exit and reddens, which reads as covered. The same mutation
// would then be classified two different ways depending on how the suite happens to load the
// thing, and one of those ways is a lie: nothing anybody asserted depends on that line, the file
// merely stopped being a program. So it is settled here, before the suite ever runs.
function parses (file) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: ['pipe', 'pipe', 'pipe'] })
    return true
  } catch (e) {
    return false
  }
}

function runSuite (suitePath) {
  let out = ''
  try {
    out = execFileSync(process.execPath, [suitePath], { stdio: ['pipe', 'pipe', 'pipe'] }).toString()
  } catch (e) {
    out = ((e.stdout || '') + (e.stderr || '')).toString()
  }
  const m = COUNT.exec(out)
  if (!m) return { crashed: true }
  return { crashed: false, passed: Number(m[1]), failed: Number(m[2]) }
}

function classify (root, toolRel, suiteRel, quiet) {
  const toolAbs = path.join(root, toolRel)
  const suiteAbs = path.join(root, suiteRel)
  for (const p of [toolAbs, suiteAbs]) {
    if (!fs.existsSync(p)) return { error: 'no such file: ' + p }
  }
  const srcDir = path.dirname(toolAbs)
  if (path.dirname(suiteAbs) !== srcDir) {
    return { error: 'the tool and its suite must sit in one directory, so the copy can hold both' }
  }

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'mutation-coverage-'))
  try {
    fs.cpSync(srcDir, work, { recursive: true })
    const toolCopy = path.join(work, path.basename(toolAbs))
    const suiteCopy = path.join(work, path.basename(suiteAbs))
    const original = fs.readFileSync(toolCopy, 'utf8')
    const lines = original.split('\n')
    const idx = candidates(lines)

    const base = runSuite(suiteCopy)
    if (base.crashed) return { error: 'the suite does not report a count before any mutation' }
    if (base.failed !== 0) {
      return { error: 'the suite is already red before any mutation: ' + base.passed + ' passed, ' + base.failed + ' failed' }
    }

    const rows = []
    for (let k = 0; k < idx.length; k++) {
      const i = idx[k]
      const kept = lines.slice(0, i).concat(lines.slice(i + 1))
      fs.writeFileSync(toolCopy, kept.join('\n'), 'utf8')
      const r = parses(toolCopy) ? runSuite(suiteCopy) : { unparseable: true }
      const verdict = r.unparseable ? 'not-mutable'
        : r.crashed ? 'crashed'
          : r.failed > 0 ? 'covered' : 'silent'
      rows.push({ line: i + 1, text: lines[i].trim(), verdict: verdict, result: r })
      say(quiet, '  ' + String(i + 1).padStart(4) + '  ' + verdict.padEnd(12)
        + (r.unparseable ? 'the mutant does not parse'
          : r.crashed ? 'no count reported' : r.passed + ' passed, ' + r.failed + ' failed'))
    }
    fs.writeFileSync(toolCopy, original, 'utf8')
    return { rows: rows, total: lines.length, baseline: base }
  } finally {
    try { fs.rmSync(work, { recursive: true, force: true }) } catch (e) { /* a temp dir, not the tree */ }
  }
}

// The lines needing an account, with the verdict that earned it, so a reason cannot survive the
// state changing under it. Only covered and parser-refused are outside this map.
function accountable (rows) {
  const m = new Map()
  for (const r of rows) {
    if (r.verdict !== 'silent' && r.verdict !== 'crashed') continue
    const e = m.get(r.text) || { count: 0, verdict: r.verdict }
    e.count++
    if (e.verdict !== r.verdict) e.verdict = 'silent and crashed'
    m.set(r.text, e)
  }
  return m
}

function readBaseline (p) {
  if (!fs.existsSync(p)) return {}
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch (e) { return { __unreadable: e.message } }
}

function main (argv) {
  const quiet = has(argv, 'quiet')
  const report = has(argv, 'report')
  const write = has(argv, 'write-baseline')
  // Guarded BEFORE resolving, not after. path.resolve(null || '.') is the working directory, so
  // the guard below could never see a missing --root value and the test named for it exercised
  // --tool instead: a usage error that silently became a verdict about the default pair.
  const rootRel = flagOf(argv, 'root', process.cwd())
  const toolRel = flagOf(argv, 'tool', DEFAULT_TOOL)
  const suiteRel = flagOf(argv, 'suite', DEFAULT_SUITE)
  const baselineRel = flagOf(argv, 'baseline', DEFAULT_BASELINE)
  for (const pair of [['tool', toolRel], ['suite', suiteRel], ['baseline', baselineRel], ['root', rootRel]]) {
    if (pair[1] === null) {
      process.stderr.write('check-mutation-coverage: --' + pair[0] + ' needs a value after it\n')
      return 2
    }
  }
  const root = path.resolve(rootRel)

  const res = classify(root, toolRel, suiteRel, quiet || !report)
  if (res.error) {
    process.stderr.write('check-mutation-coverage: ' + res.error + '\n')
    return 2
  }

  const covered = res.rows.filter(r => r.verdict === 'covered').length
  const silent = res.rows.filter(r => r.verdict === 'silent')
  const crashed = res.rows.filter(r => r.verdict === 'crashed')
  const notMutable = res.rows.filter(r => r.verdict === 'not-mutable').length
  const counts = accountable(res.rows)

  const baselinePath = path.join(root, baselineRel)
  const store = readBaseline(baselinePath)
  if (store.__unreadable) {
    process.stderr.write('check-mutation-coverage: the baseline could not be read: ' + store.__unreadable + '\n')
    return 2
  }

  if (write) {
    const prior = new Map((store[toolRel] || []).map(e => [e.text, e.reason]))
    const missing = []
    const entries = []
    for (const [text, e] of counts) {
      const reason = prior.get(text) || ''
      if (!reason) missing.push(text)
      entries.push({ text: text, count: e.count, verdict: e.verdict, reason: reason })
    }
    if (missing.length) {
      process.stderr.write('check-mutation-coverage: refusing to record ' + missing.length
        + ' unaccounted line(s) with no reason. Write the reason into ' + baselineRel + ' first:\n')
      for (const t of missing) process.stderr.write('  ' + t + '\n')
      return 2
    }
    store[toolRel] = entries
    fs.writeFileSync(baselinePath, JSON.stringify(store, null, 2) + '\n', 'utf8')
    say(quiet, 'recorded ' + entries.length + ' accepted line(s) for ' + toolRel)
    return 0
  }

  // A pre-split entry carries no verdict. The old rule accepted only silent, so that is what one
  // means; guessing otherwise grants a crashed line an exemption nobody wrote.
  const accepted = new Map((store[toolRel] || []).map(e => [e.text, e]))
  const faults = []
  for (const [text, now] of counts) {
    const e = accepted.get(text)
    const was = e && (e.verdict || 'silent')
    if (!e) { faults.push(now.verdict.toUpperCase() + ' and not accepted: ' + text); continue }
    if (!e.reason) { faults.push('accepted with no reason, which is a line nobody looked at: ' + text); continue }
    if (was !== now.verdict) {
      faults.push('accepted as ' + was + ' and is now ' + now.verdict
        + ', so the reason is about the wrong thing: ' + text)
      continue
    }
    if (e.count !== now.count) {
      faults.push('accepted ' + e.count + ' time(s) and ' + now.verdict + ' ' + now.count + ' time(s) now: ' + text)
    }
  }
  for (const [text, e] of accepted) {
    if (!counts.has(text)) {
      faults.push('accepted as ' + (e.verdict || 'silent')
        + ' and is now COVERED or gone, so the exemption has outlived its reason: ' + text)
    }
  }

  say(quiet, 'MUTATION COVERAGE  ' + toolRel + '  against  ' + suiteRel)
  say(quiet, '  ' + res.rows.length + ' code line(s): ' + covered + ' covered, ' + silent.length
    + ' silent, ' + crashed.length + ' crashed, ' + notMutable + ' refused by the parser')
  say(quiet, '  the suite before any mutation: ' + res.baseline.passed + ' passed, ' + res.baseline.failed + ' failed')
  for (const r of silent.concat(crashed)) {
    const e = accepted.get(r.text)
    say(quiet, '  ' + r.verdict.toUpperCase().padEnd(7) + ' :' + r.line + '  ' + r.text)
    say(quiet, '          ' + (e && e.reason ? e.reason : 'NOT ACCEPTED'))
  }
  if (report) {
    for (const r of res.rows.filter(x => x.verdict === 'not-mutable')) {
      say(quiet, '  NOT MUTABLE  :' + r.line + '  ' + r.text)
    }
  }

  if (faults.length) {
    process.stdout.write('FAIL  ' + faults.length + ' line(s) disagree with ' + baselineRel + '\n')
    for (const f of faults) process.stdout.write('  ' + f + '\n')
    return 1
  }
  say(quiet, "OK  every silent or crashed line is accepted with a reason, and every accepted line is still in the state it was accepted for")
  return 0
}

if (require.main === module) process.exit(main(process.argv.slice(2)))

module.exports = { main, candidates, accountable }
