#!/usr/bin/env node
/**
 * check-roster-count.js -- holds every published or distributed claim about how many roles
 * this studio has to the number of roles actually on disk.
 *
 * WHY THIS EXISTS. The size of the roster is stated as a word, by hand, in dozens of places:
 * page titles, share-card metadata, section headings, the tool's own console output, the
 * method document, the scaffold a new project is built from. Not one of them was compared to
 * the directory the roles live in. Adding or removing a role therefore breaks a claim on
 * every one of those surfaces at once, silently, and the first person to notice is a reader
 * counting the cards on a page. A hand-kept number repeated across surfaces is exactly the
 * class of defect this repository has fixed three times before by adding a check, and never
 * fixed by being more careful.
 *
 * WHAT IT COUNTS AS A CLAIM. A number, written as a word or as digits, immediately before the
 * word role or agent. That is a deliberately blunt matcher, and it catches sentences that are
 * NOT claims about the size of the roster: nine roles inside the build loop, six leads at the
 * front door, one role per file. Those are true statements about a subset, and a check that
 * demanded they equal the roster size would be wrong.
 *
 * SO THE EXEMPTION IS RECORDED RATHER THAN GUESSED. Every claim using a number that is not
 * the current roster size must appear in the committed baseline beside this tool, with the
 * count of times it appears in that file and a reason a stranger can read. Anything else
 * fails. This has the property that matters: on the day the roster changes size, every claim
 * that states the old number stops being the roster size, is not in the baseline, and fails.
 * The breaking event and the check fire together, which is the whole point.
 *
 * WHAT IS DELIBERATELY NOT SCANNED, AND WHY IT WOULD BE WRONG TO. The changelog and the
 * releases page generated from it are dated history. A release note saying sixteen roles was
 * true on the day it was written and rewriting it would be falsifying a record to satisfy a
 * check. After the roster changes size those pages and the current pages disagree, both are
 * correct, and the release note is the thing that reconciles them. The session state
 * documents and the decision and session archives are excluded for the same reason: they are
 * a dated record of what was true, not a claim being made to a reader today.
 *
 *   node tools/check-roster-count.js                     check every surface
 *   node tools/check-roster-count.js --report            every claim found, with file and line
 *   node tools/check-roster-count.js --write-baseline    record the exemptions as they stand
 *   options: --root <dir>  --baseline <file>  --quiet
 *
 * Exit 0 clean, 1 refused, 2 on a usage or read error.
 *
 * A NOTE ON --write-baseline, WHICH IS THE COMMAND A PERSON ACTUALLY TYPES. It refuses to
 * record an exemption that has no reason attached, because a baseline written by a tool with
 * a blank reason is a list of things nobody looked at. Write the reasons into the file by
 * hand once and the tool will carry them forward.
 */

'use strict'

const fs = require('fs')
const path = require('path')

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen', 'twenty']

const CLAIM = new RegExp('\\b(' + WORDS.join('|') + '|[0-9]{1,3})[ \\-](?:ai[ \\-])?(agent|role)s?\\b', 'gi')

// The second shape, and it was found only because the first missed it. A handover document
// says "name the roles you can dispatch and count them. Expect sixteen." with no noun after
// the number, so a matcher looking for a number in front of a roster noun reads straight past
// the one sentence whose whole job is to state the size of the roster. It counts only on a
// line that is already talking about roles or agents.
const EXPECT = new RegExp('\\bexpect(?:s|ing)?\\s+(' + WORDS.join('|') + '|[0-9]{1,3})\\b', 'gi')
const ABOUT_ROSTER = /\b(role|agent)s?\b/i

// The state documents are dated history and are excluded below, correctly: rewriting what was
// true on a past date to satisfy a check falsifies the record. But one line in them is not
// history at all, it is the instruction the next session is given at start: count your roles and
// expect this many. That line was left saying sixteen against a roster of seventeen, in the very
// document that tells a session to count them, because the exclusion that protects the history
// also hid the instruction. These files are scanned with the expect matcher only.
const EXPECT_ONLY = new Set(['WARM_START.md', 'CLAUDE.md'])

// The export flattens the source layout, so a path that is right here is wrong in the copy
// people install. Both shapes are looked for and the first that exists wins.
const AGENT_DIRS = ['base/agents', 'agents']

const SCAN = [
  { dir: '.', depth: 0, ext: ['.html', '.md', '.ps1'] },
  { dir: 'base/agents', depth: 3, ext: ['.md'] },
  { dir: 'agents', depth: 3, ext: ['.md'] },
  { dir: 'base/fragments', depth: 3, ext: ['.md'] },
  { dir: 'fragments', depth: 3, ext: ['.md'] },
  { dir: 'base/governance', depth: 3, ext: ['.md'] },
  { dir: 'governance', depth: 3, ext: ['.md'] },
  { dir: 'base/skills', depth: 3, ext: ['.md'] },
  { dir: 'skills', depth: 3, ext: ['.md'] },
  { dir: 'new-project', depth: 3, ext: ['.md'] }
]

const NOT_A_CLAIM_TO_A_READER = new Set([
  'CHANGELOG.md', 'releases.html', 'WARM_START.md', 'DECISIONS-ARCHIVE.md',
  'SESSION-LOG-ARCHIVE.md', 'REPOS.md', 'LICENCE-NOTES.md', 'CLAUDE.md'
])

function say (quiet, line) { if (!quiet) process.stdout.write(line + '\n') }

function flagOf (argv, name, fallback) {
  const i = argv.indexOf('--' + name)
  if (i === -1 || i === argv.length - 1) return fallback
  return argv[i + 1]
}

function has (argv, name) { return argv.indexOf('--' + name) !== -1 }

function numberOf (token) {
  const t = String(token).toLowerCase()
  const w = WORDS.indexOf(t)
  if (w !== -1) return w
  if (/^[0-9]{1,3}$/.test(t)) return parseInt(t, 10)
  return null
}

function rosterSize (root) {
  for (const d of AGENT_DIRS) {
    const abs = path.join(root, d.split('/').join(path.sep))
    if (!fs.existsSync(abs)) continue
    const files = fs.readdirSync(abs).filter(f => f.toLowerCase().endsWith('.md'))
    if (files.length) return { dir: d, count: files.length }
  }
  return { dir: null, count: null }
}

function collect (root) {
  const files = []
  for (const spec of SCAN) {
    const base = path.join(root, spec.dir.split('/').join(path.sep))
    if (!fs.existsSync(base)) continue
    const stack = [[base, 0]]
    while (stack.length) {
      const [dir, depth] = stack.pop()
      let entries
      try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch (e) { continue }
      for (const e of entries) {
        const abs = path.join(dir, e.name)
        if (e.isDirectory()) {
          if (depth < spec.depth && !e.name.startsWith('.') && e.name !== 'node_modules') stack.push([abs, depth + 1])
          continue
        }
        if (!e.isFile()) continue
        if (!spec.ext.some(x => e.name.toLowerCase().endsWith(x))) continue
        const rel = path.relative(root, abs).split(path.sep).join('/')
        if (NOT_A_CLAIM_TO_A_READER.has(rel) && !EXPECT_ONLY.has(rel)) continue
        if (files.indexOf(rel) === -1) files.push(rel)
      }
    }
  }
  return files.sort()
}

function claimsIn (root, rel) {
  let text
  try { text = fs.readFileSync(path.join(root, rel.split('/').join(path.sep)), 'utf8') } catch (e) { return [] }
  const out = []
  const expectOnly = EXPECT_ONLY.has(rel)
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    let m
    if (!expectOnly) {
      CLAIM.lastIndex = 0
      while ((m = CLAIM.exec(lines[i])) !== null) {
        const n = numberOf(m[1])
        if (n === null) continue
        out.push({ file: rel, line: i + 1, n: n, text: m[0], context: lines[i].trim().slice(0, 120) })
      }
    }
    // The previous line counts as context. One of these claims sits in wrapped prose with the
    // word "roles" on the line above and "(expect sixteen)" on the line below, so a matcher
    // reading one line at a time saw a bare number and moved on.
    if (!ABOUT_ROSTER.test(lines[i] + ' ' + (i > 0 ? lines[i - 1] : ''))) continue
    EXPECT.lastIndex = 0
    while ((m = EXPECT.exec(lines[i])) !== null) {
      const n = numberOf(m[1])
      if (n === null) continue
      out.push({ file: rel, line: i + 1, n: n, text: m[0], context: lines[i].trim().slice(0, 120) })
    }
  }
  return out
}

function tally (claims, size) {
  const off = {}
  for (const c of claims) {
    if (c.n === size) continue
    if (!off[c.file]) off[c.file] = {}
    const key = String(c.n)
    if (!off[c.file][key]) off[c.file][key] = { count: 0, why: '' }
    off[c.file][key].count++
  }
  return off
}

function readBaseline (file) {
  if (!fs.existsSync(file)) return { state: 'absent', data: null }
  let parsed
  try { parsed = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')) } catch (e) { return { state: 'corrupt', data: null, why: e.message } }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !parsed.exempt || typeof parsed.exempt !== 'object')
    return { state: 'corrupt', data: null, why: 'no exempt object' }
  return { state: 'ok', data: parsed }
}

function main (argv) {
  const root = path.resolve(flagOf(argv, 'root', path.join(__dirname, '..')))
  if (!fs.existsSync(root)) { process.stderr.write('check-roster-count: no such directory: ' + root + '\n'); return 2 }
  const baselineFile = path.resolve(flagOf(argv, 'baseline', path.join(__dirname, 'roster-count-baseline.json')))
  const quiet = has(argv, 'quiet')

  const roster = rosterSize(root)
  if (roster.count === null) {
    process.stderr.write('check-roster-count: no agents directory under ' + root + ', so there is nothing to compare against\n')
    return 2
  }

  const files = collect(root)
  let claims = []
  for (const f of files) claims = claims.concat(claimsIn(root, f))

  if (has(argv, 'report')) {
    process.stdout.write('\nroster on disk: ' + roster.count + ' role(s) in ' + roster.dir + '\n\n')
    for (const c of claims)
      process.stdout.write('  ' + (c.n === roster.count ? 'match  ' : 'other  ') +
        c.file + ':' + c.line + '  "' + c.text + '"   ' + c.context + '\n')
    process.stdout.write('\n' + claims.length + ' claim(s) in ' + files.length + ' file(s)\n\n')
    return 0
  }

  const measured = tally(claims, roster.count)

  if (has(argv, 'write-baseline')) {
    const prior = readBaseline(baselineFile)
    const carried = prior.state === 'ok' ? prior.data.exempt : {}
    const blanks = []
    for (const f of Object.keys(measured)) {
      for (const n of Object.keys(measured[f])) {
        const why = (carried[f] && carried[f][n] && carried[f][n].why) || ''
        measured[f][n].why = why
        if (!why.trim()) blanks.push(f + ' "' + (WORDS[Number(n)] || n) + '"')
      }
    }
    if (blanks.length) {
      process.stderr.write('check-roster-count: REFUSED to record ' + blanks.length +
        ' exemption(s) with no reason. Say why each one is not a claim about the size of the roster:\n')
      for (const b of blanks) process.stderr.write('  ' + b + '\n')
      process.stderr.write('Write the reason into ' + path.basename(baselineFile) + ' by hand, then run this again.\n')
      return 1
    }
    fs.writeFileSync(baselineFile, JSON.stringify({ roster: roster.count, exempt: measured }, null, 2) + '\n', 'utf8')
    process.stdout.write('recorded ' + Object.keys(measured).length + ' file(s) of exemptions against a roster of ' + roster.count + '\n')
    return 0
  }

  const base = readBaseline(baselineFile)
  if (base.state !== 'ok') {
    process.stderr.write('check-roster-count: baseline is ' + base.state +
      (base.why ? ' (' + base.why + ')' : '') + '. Nothing can be compared, so this refuses rather than passing.\n')
    return 1
  }

  const problems = []
  for (const f of Object.keys(measured)) {
    for (const n of Object.keys(measured[f])) {
      const rec = base.data.exempt[f] && base.data.exempt[f][n]
      const found = measured[f][n].count
      if (!rec) {
        problems.push(f + ': ' + found + ' claim(s) of "' + (WORDS[Number(n)] || n) +
          ' role/agent" and the roster holds ' + roster.count +
          '. Either the text is stale or it is a claim about a subset; if it is a subset, record it with its reason.')
        continue
      }
      if (rec.count !== found)
        problems.push(f + ': ' + found + ' claim(s) of "' + (WORDS[Number(n)] || n) +
          '" where the record holds ' + rec.count + '. Held exact, so a new one and a deleted one both refuse.')
    }
  }
  for (const f of Object.keys(base.data.exempt)) {
    for (const n of Object.keys(base.data.exempt[f])) {
      if (!measured[f] || !measured[f][n])
        problems.push(f + ': the record holds ' + base.data.exempt[f][n].count + ' claim(s) of "' +
          (WORDS[Number(n)] || n) + '" and none is there now. Record the change with --write-baseline.')
    }
  }

  const matching = claims.filter(c => c.n === roster.count).length
  say(quiet, 'roster ' + roster.count + ' in ' + roster.dir + ': ' + matching + ' claim(s) state it, ' +
    (claims.length - matching) + ' state something else, across ' + files.length + ' file(s)')
  if (!problems.length) return 0

  process.stdout.write('FAIL  ' + problems.length + ' roster claim(s) do not match what is on disk\n')
  for (const p of problems) process.stdout.write('  ' + p + '\n')
  return 1
}

module.exports = { main, rosterSize, collect, claimsIn, tally, CLAIM }

if (require.main === module) process.exit(main(process.argv.slice(2)))
