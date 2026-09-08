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
 * AND THAT EXCLUSION IS BY SHAPE AND NOT ONLY BY NAME, WHICH IT WAS NOT FOR ONE DAY. The list of
 * names could only ever hold archives that already existed. WARM_START-ARCHIVE.md was created by
 * a wind-down commit, carried six historical claims about a sixteen-role roster into a file
 * nobody had listed, and turned this check red at the next session start on a roster that had not
 * changed. The wind-down had run its checks BEFORE that commit, which is the only order available
 * to it, so nothing could have caught it. Any file whose name ends -ARCHIVE is a dated record by
 * construction, so it is excluded by that shape, and the named entries stay for the files that
 * are not archives. The shape is what covers the archive nobody has created yet. ST-168.
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

// AND THE BASELINE HAS TO SURVIVE THAT FLATTENING TOO, which it did not for weeks. Every key was
// a source-tree path, so on the published export base/fragments/x.md was measured as fragments/x.md
// and matched no record, and the check was red on every installed copy in the session-start AND
// release sets with nothing the reader could do about it. It passed here on every run because
// here the paths are the ones it was written against (S133). One canonical key serves both.
function canonicalKey (rel) { return rel.replace(/^base\//, '') }

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

// A dated record rather than a claim to a reader today, asked by SHAPE as well as by name. See
// the header for why the name list alone could never have been enough.
function datedRecord (rel) {
  return NOT_A_CLAIM_TO_A_READER.has(rel) || /-ARCHIVE\.md$/i.test(rel)
}

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
        if (datedRecord(rel) && !EXPECT_ONLY.has(rel)) continue
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

  // Both sides keyed the same way, so a record written in one layout is found in the other.
  const record = {}
  for (const f of Object.keys(base.data.exempt)) {
    const k = canonicalKey(f)
    record[k] = record[k] || {}
    for (const n of Object.keys(base.data.exempt[f])) record[k][n] = base.data.exempt[f][n]
  }
  // KEYED ON THE LAYOUT, NOT THE FILE AND NOT THE DIRECTORY, AND THE DIFFERENCE IS A REFUSAL.
  // Forgiving an absent FILE forgives a deletion; forgiving an absent DIRECTORY forgives a
  // deleted TREE, which is the same defect one level up. Measured on a copy of HEAD: removing
  // base/fragments/advocacy.md exits 1, removing the whole tree exits 0 and prints nothing under
  // --quiet. Absence is legitimate only where the EXPORT caused it, so here, where base/agents
  // exists, nothing is forgiven and an absent record is a deletion (S145).
  const sourceLayout = AGENT_DIRS.some(function (d) {
    return d.indexOf('base/') === 0 && fs.existsSync(path.join(root, d.split('/').join(path.sep)))
  })
  const scannedDirs = {}
  for (const f of files) {
    const k = canonicalKey(f)
    const cut = k.lastIndexOf('/')
    scannedDirs[cut === -1 ? '.' : k.slice(0, cut)] = true
  }
  function dirOf (k) { const cut = k.lastIndexOf('/'); return cut === -1 ? '.' : k.slice(0, cut) }

  const problems = []
  for (const f of Object.keys(measured)) {
    for (const n of Object.keys(measured[f])) {
      const rec = record[canonicalKey(f)] && record[canonicalKey(f)][n]
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
  // A record for a file this install does not carry is NOT a stale record. base/governance is
  // deliberately not published, so on the export those entries name files that were never copied.
  // Counted and NAMED in the summary rather than refused, because refusing on something a
  // legitimate install can never satisfy locks that install out for good. The names matter: a
  // bare integer here is a number nobody can act on, and the assertion covering it could not
  // fail for the reason it gave. A record for a file whose DIRECTORY is here and whose claim has
  // gone is still a refusal, which is the case the rule was written for.
  // Named once per FILE rather than once per (file, number): two exempt numbers in one absent
  // file printed the same name twice, which reads as two problems.
  const notCarried = []
  const measuredByKey = {}
  for (const f of Object.keys(measured)) measuredByKey[canonicalKey(f)] = measured[f]
  for (const f of Object.keys(record)) {
    for (const n of Object.keys(record[f])) {
      if (measuredByKey[f] && measuredByKey[f][n]) continue
      if (!sourceLayout && !scannedDirs[dirOf(f)]) { notCarried.push(f); continue }
      problems.push(f + ': the record holds ' + record[f][n].count + ' claim(s) of "' +
        (WORDS[Number(n)] || n) + '" and none is there now. Record the change with --write-baseline.')
    }
  }

  const matching = claims.filter(c => c.n === roster.count).length
  say(quiet, 'roster ' + roster.count + ' in ' + roster.dir + ': ' + matching + ' claim(s) state it, ' +
    (claims.length - matching) + ' state something else, across ' + files.length + ' file(s)' +
    (notCarried.length ? ', ' + new Set(notCarried).size + ' exemption(s) for file(s) this install does ' +
      'not carry: ' + Array.from(new Set(notCarried)).sort().join(', ') : ''))
  if (!problems.length) return 0

  process.stdout.write('FAIL  ' + problems.length + ' roster claim(s) do not match what is on disk\n')
  for (const p of problems) process.stdout.write('  ' + p + '\n')
  return 1
}

module.exports = { main, rosterSize, collect, claimsIn, tally, CLAIM }

if (require.main === module) process.exit(main(process.argv.slice(2)))
