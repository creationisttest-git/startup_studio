#!/usr/bin/env node
/**
 * check-published-counts.js -- holds a number published to a reader against the thing it counts.
 *
 * WHY THIS EXISTS. Two claims went false on the live site at once and neither had anything
 * watching it. reference.html said "The eighteen defined terms" over a glossary carrying
 * nineteen. reference.html also published the in-flight ceiling as prose, "two large items and
 * three small ones", with nothing anywhere comparing that sentence to CEILING in board.js, which
 * is the constant the board actually refuses on. Both were found by a person reading the page,
 * which is the same way ST-173 was found: solution.html said four checks over a flow chart of
 * five gate roles, and the FOUNDER found it.
 *
 * THE CLASS OF DEFECT IS A HAND-KEPT NUMBER WITH NO OWNER. It is written once, in prose, on a
 * surface nobody edits again, and it goes false on the day somebody changes the thing it counts.
 * The repository has fixed this three times by adding a check and never once by being careful:
 * check-roster-count.js does it for the size of the roster, and the published command table is
 * compared against the param() block of studio.ps1 in both directions. This tool is that pattern
 * for two more numbers, and the shape is deliberately a TABLE so the next one is a row.
 *
 * WHY THE CEILING NUMBER IS WORSE THAN IT LOOKS. The ticket that asked for this named two lines
 * in one file. There are NINE live surfaces, and only two of them are on the website. The other
 * seven are the roster and the shared documents this studio distributes to every project:
 * base/agents/pm.md, base/agents/tech-lead.md, base/board/BOARD_SPEC.md, base/skills/assess,
 * base/skills/wind-down and base/governance/SESSION_RECALL.md, plus the testbed README. So
 * changing the ceiling changes the instruction handed to agents in five projects, and a check
 * that watched only the website would have reported success while seven surfaces went false.
 *
 * WHAT COUNTS AS A CLAIM, AND WHY THE MATCHER NEEDS A CONTEXT GUARD. A number in front of the
 * word large or small is far too common to treat as a ceiling claim on its own: a sentence may
 * describe one large ticket, or two small changes, without saying anything about how much work
 * may be in flight. So a line is only read as a ceiling claim when it is already talking about
 * the ceiling: the words ceiling, in progress, in flight, at once, at a time, at any time or max.
 * Every one of the nine real surfaces carries one of those words, and the guard is what keeps the
 * blunt matcher from turning ordinary prose into a refusal.
 *
 * WHAT IS DELIBERATELY NOT SCANNED, AND WHY REWRITING IT WOULD BE FALSIFYING A RECORD. The
 * changelog and the releases page generated from it are dated history: a release note saying two
 * large and three small was TRUE on the day it was written, and editing it to satisfy a check
 * would destroy the one artefact that reconciles the old number with the new one. The state
 * document and the decision and session archives are excluded for the same reason, and archives
 * are recognised by the SHAPE of their name as well as by a list, because the list could only
 * ever hold archives that already exist and a wind-down commit has created a new one before.
 *
 * CODE IS NOT SCANNED AT ALL, AND THAT IS DONE BY THE EXTENSION FILTER RATHER THAN BY A RULE.
 * SCAN below collects .html, .md and .ps1 and never .js, so a test encoding the old ceiling is
 * already out of reach. This file briefly carried a second mechanism, a provenElsewhere()
 * predicate excluding .test.js by name, with a comment explaining why it was needed. Mutation
 * proved it DEAD: deleting it changed nothing, because nothing it named was ever collected. It
 * was removed rather than kept, because a rule that cannot be watched failing is indistinguishable
 * from one that does nothing, and a comment asserting it matters is a claim nothing measures
 * (S163). The real argument still holds and belongs to the extension filter: a test encoding the
 * old number goes red by itself, so a second instrument reporting it would only teach a reader to
 * clear a row that had already done its job.
 *
 * SO THE EXEMPTION IS RECORDED RATHER THAN GUESSED, which is check-roster-count's design and is
 * reused here on purpose. A claim whose number is not the current truth must appear in the
 * committed baseline beside this tool, keyed by file and number, with a count and a reason a
 * stranger can read. Anything else fails. That gives the property that matters: on the day the
 * ceiling changes, every surface still stating the old number stops matching the truth, is not in
 * the baseline, and fails. The breaking event and the check fire together.
 *
 *   node tools/check-published-counts.js                  check every surface
 *   node tools/check-published-counts.js --report         every claim found, with file and line
 *   node tools/check-published-counts.js --write-baseline record the exemptions as they stand
 *   options: --root <dir>  --baseline <file>  --quiet
 *
 * Exit 0 clean, 1 refused, 2 on a usage or read error, 3 when no source of truth can be found
 * at all, which means this is not a studio tree rather than that a claim is wrong.
 *
 * EXIT 3 IS ADVISORY AND IS LOAD BEARING. A check that refuses on a layout its author never ran
 * it in is a lockout the reader cannot clear, which this repository has now shipped three times
 * (S133, S151, ST-139). Both sources of truth publish, so the ordinary reader has them; a tree
 * holding neither is not one this tool has standing to refuse on.
 *
 * A NOTE ON --write-baseline, WHICH IS THE COMMAND A PERSON ACTUALLY TYPES. It refuses to record
 * an exemption that has no reason attached, because a baseline written by a tool with a blank
 * reason is a list of things nobody looked at. Write the reasons in by hand once and the tool
 * carries them forward.
 */

'use strict'

const fs = require('fs')
const path = require('path')

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen', 'twenty', 'twentyone', 'thirty', 'forty', 'fifty']

const NUM = '(' + WORDS.join('|') + '|[0-9]{1,3})'

// A line is only read as a ceiling claim when it is already talking about work in flight. See
// the header: without this guard, ordinary prose about one large ticket becomes a refusal.
const ABOUT_CEILING = /\bceiling\b|\bin progress\b|\bin[- ]flight\b|\bat once\b|\bat a time\b|\bat any time\b|\bmax\b/i

// The two sources of truth, each read from the repository rather than written down here. Both
// publish, so both are present in the layout a reader installs.
const BOARD_FILES = ['base/board/board.js', 'board/board.js']
const REFERENCE = 'reference.html'

// THE TABLE. Each row is one published number: where its truth is counted from, what a claim
// about it looks like, and the human name used in the refusal. Adding the next hand-kept number
// is a row here and a reason in the baseline, which is the whole point of the shape.
const CLAIMS = [
  {
    name: 'ceiling.large',
    what: 'the number of LARGE items that may be in progress at once',
    truth: readCeilingLarge,
    source: 'CEILING in board.js',
    pattern: new RegExp('\\b' + NUM + '[ \\-]large\\b', 'gi'),
    guard: ABOUT_CEILING
  },
  {
    name: 'ceiling.small',
    what: 'the number of SMALL items that may be in progress at once',
    truth: readCeilingSmall,
    source: 'CEILING in board.js',
    pattern: new RegExp('\\b' + NUM + '[ \\-]small\\b', 'gi'),
    guard: ABOUT_CEILING
  },
  {
    name: 'glossary.terms',
    what: 'the number of defined terms in the glossary',
    truth: readGlossarySize,
    source: 'id="g-" anchors in reference.html',
    pattern: new RegExp('\\b' + NUM + '\\s+defined terms\\b', 'gi'),
    guard: null
  }
]

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
  { dir: 'base/board', depth: 2, ext: ['.md'] },
  { dir: 'board', depth: 2, ext: ['.md'] },
  { dir: 'new-project', depth: 3, ext: ['.md'] },
  { dir: 'testbed', depth: 2, ext: ['.md'] }
]

// Dated history. Rewriting any of these to satisfy a check would falsify the record that
// reconciles the old number with the new one.
const NOT_A_CLAIM_TO_A_READER = new Set([
  'CHANGELOG.md', 'releases.html', 'WARM_START.md', 'DECISIONS-ARCHIVE.md',
  'SESSION-LOG-ARCHIVE.md', 'REPOS.md', 'LICENCE-NOTES.md', 'CLAUDE.md', 'METHOD.md'
])

function datedRecord (rel) {
  return NOT_A_CLAIM_TO_A_READER.has(rel) || /-ARCHIVE\.md$/i.test(rel)
}

// The export flattens the source layout, so a path that is right here is wrong in the copy
// people install, and a baseline keyed on source paths matches nothing there. That is exactly
// how check-roster-count was red on every installed copy for weeks (S133). One canonical key
// serves both layouts.
function canonicalKey (rel) { return rel.replace(/^base\//, '') }

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
  if (w !== -1) return w === 21 ? 21 : w
  if (/^[0-9]{1,3}$/.test(t)) return parseInt(t, 10)
  return null
}

function findBoard (root) {
  for (const rel of BOARD_FILES) {
    const abs = path.join(root, rel.split('/').join(path.sep))
    if (fs.existsSync(abs)) return abs
  }
  return null
}

// ABSENT and CORRUPT are different answers and must never be the same one, which is the rule
// board.js states about its own override ledger. A board.js that exists and holds no readable
// CEILING is a real fault and refuses; a board.js that is not there at all is a layout question
// and is answered by exit 3 further down.
function readCeiling (root) {
  const abs = findBoard(root)
  if (!abs) return null
  let text
  try { text = fs.readFileSync(abs, 'utf8') } catch (e) { return null }
  const m = /const\s+CEILING\s*=\s*\{([^}]*)\}/.exec(text)
  if (!m) {
    return { unreadable: true, at: abs,
      why: 'board.js is present but no "const CEILING = { ... }" could be read from it' }
  }
  const large = /\blarge\s*:\s*([0-9]+)/.exec(m[1])
  const small = /\bsmall\s*:\s*([0-9]+)/.exec(m[1])
  if (!large || !small) {
    return { unreadable: true, at: abs,
      why: 'CEILING was found in board.js but does not carry both a large and a small number' }
  }
  return { large: parseInt(large[1], 10), small: parseInt(small[1], 10), at: abs }
}

function readCeilingLarge (root) {
  const c = readCeiling(root)
  if (!c) return null
  if (c.unreadable) return c
  return { n: c.large, at: c.at }
}

function readCeilingSmall (root) {
  const c = readCeiling(root)
  if (!c) return null
  if (c.unreadable) return c
  return { n: c.small, at: c.at }
}

function readGlossarySize (root) {
  const abs = path.join(root, REFERENCE)
  if (!fs.existsSync(abs)) return null
  let text
  try { text = fs.readFileSync(abs, 'utf8') } catch (e) { return null }
  const m = text.match(/id="g-/g)
  if (!m) {
    return { unreadable: true, at: abs,
      why: 'reference.html is present but carries no id="g-" glossary anchors at all' }
  }
  return { n: m.length, at: abs }
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
          if (depth < spec.depth && !e.name.startsWith('.') && e.name !== 'node_modules') {
            stack.push([abs, depth + 1])
          }
          continue
        }
        if (!e.isFile()) continue
        if (!spec.ext.some(x => e.name.toLowerCase().endsWith(x))) continue
        const rel = path.relative(root, abs).split(path.sep).join('/')
        if (datedRecord(rel)) continue
        if (files.indexOf(rel) === -1) files.push(rel)
      }
    }
  }
  return files.sort()
}

function claimsIn (root, rel, claim) {
  let text
  try { text = fs.readFileSync(path.join(root, rel.split('/').join(path.sep)), 'utf8') }
  catch (e) { return [] }
  const out = []
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    if (claim.guard && !claim.guard.test(lines[i])) continue
    claim.pattern.lastIndex = 0
    let m
    while ((m = claim.pattern.exec(lines[i])) !== null) {
      const n = numberOf(m[1])
      if (n === null) continue
      out.push({ claim: claim.name, file: rel, line: i + 1, n: n, text: m[0],
        context: lines[i].trim().slice(0, 140) })
    }
  }
  return out
}

function readBaseline (file) {
  if (!fs.existsSync(file)) return { truth: {}, exempt: {} }
  let raw
  try { raw = fs.readFileSync(file, 'utf8') } catch (e) {
    return { fatal: 'the baseline could not be read: ' + file + '\n       ' + e.message }
  }
  let parsed
  try { parsed = JSON.parse(raw) } catch (e) {
    // Swallowed, a damaged baseline reads as no exemptions, every exemption becomes a failure,
    // and the fix a reader reaches for is --write-baseline, which would then overwrite the file
    // and lose every reason in it. Refuse instead and name the file.
    return { fatal: 'the baseline is unreadable: ' + file + '\n       ' + e.message +
      '\n       Refusing rather than treating it as empty. Restore it from git.' }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { fatal: 'the baseline is not a JSON object: ' + file }
  }
  return { truth: parsed.truth || {}, exempt: parsed.exempt || {} }
}

// main RETURNS a code rather than calling process.exit, so the suite can require this file and
// drive it in process without the require itself ending the run. An unguarded in-process call
// once turned 37 measured lines into unmeasurable ones here (S127).
function main (argv) {
  const quiet = has(argv, 'quiet')
  const report = has(argv, 'report')
  const write = has(argv, 'write-baseline')
  const root = path.resolve(flagOf(argv, 'root', process.cwd()))
  const baselineFile = path.resolve(flagOf(argv, 'baseline',
    path.join(__dirname, 'published-counts-baseline.json')))

  if (!fs.existsSync(root)) {
    process.stderr.write('published-counts: no such directory: ' + root + '\n')
    return 2
  }

  const base = readBaseline(baselineFile)
  if (base.fatal) {
    process.stderr.write('published-counts: ' + base.fatal + '\n')
    return 2
  }

  // Resolve every source of truth first. A claim cannot be judged against a number that could
  // not be read, and saying so is not the same as saying the claim is wrong.
  const truth = {}
  const unreadable = []
  let found = 0
  for (const c of CLAIMS) {
    const t = c.truth(root)
    if (t === null) continue
    found++
    if (t.unreadable) { unreadable.push({ claim: c.name, why: t.why, at: t.at }); continue }
    truth[c.name] = t
  }

  if (found === 0) {
    say(quiet, 'published-counts: no board.js and no reference.html under ' + root)
    say(quiet, '  Nothing to hold a published number against, so nothing is claimed either way.')
    return 3
  }

  if (unreadable.length) {
    for (const u of unreadable) {
      process.stderr.write('published-counts: ' + u.claim + ': ' + u.why + '\n')
      process.stderr.write('       ' + u.at + '\n')
    }
    return 2
  }

  const files = collect(root)
  const all = []
  for (const c of CLAIMS) {
    if (!truth[c.name]) continue
    for (const rel of files) all.push(...claimsIn(root, rel, c))
  }

  if (report) {
    for (const c of CLAIMS) {
      if (!truth[c.name]) continue
      say(quiet, c.name + '  truth ' + truth[c.name].n + '  (' + c.source + ')')
      const mine = all.filter(x => x.claim === c.name)
      if (!mine.length) say(quiet, '    no claim found on any scanned surface')
      for (const x of mine) {
        say(quiet, '    ' + (x.n === truth[c.name].n ? 'ok  ' : 'DIFF') + ' ' +
          x.file + ':' + x.line + '  "' + x.text + '"')
      }
    }
  }

  // Every claim whose number is not the truth has to be accounted for by name, by number and by
  // count, so an exemption cannot quietly cover a second occurrence somebody added later.
  const off = all.filter(x => x.n !== truth[x.claim].n)
  const seen = {}
  for (const x of off) {
    const key = canonicalKey(x.file)
    seen[x.claim] = seen[x.claim] || {}
    seen[x.claim][key] = seen[x.claim][key] || {}
    seen[x.claim][key][x.n] = (seen[x.claim][key][x.n] || 0) + 1
  }

  if (write) {
    const out = { truth: {}, exempt: {} }
    for (const c of CLAIMS) if (truth[c.name]) out.truth[c.name] = truth[c.name].n
    let missing = 0
    for (const claimName of Object.keys(seen).sort()) {
      out.exempt[claimName] = {}
      for (const file of Object.keys(seen[claimName]).sort()) {
        out.exempt[claimName][file] = {}
        for (const n of Object.keys(seen[claimName][file]).sort()) {
          const prior = ((((base.exempt[claimName] || {})[file] || {})[n]) || {}).why
          if (!prior || !String(prior).trim()) {
            missing++
            process.stderr.write('published-counts: no reason recorded for ' + claimName +
              ' stating ' + n + ' in ' + file + '\n')
          }
          out.exempt[claimName][file][n] = { count: seen[claimName][file][n], why: prior || '' }
        }
      }
    }
    if (missing) {
      process.stderr.write('       An exemption with a blank reason is a list of things nobody\n' +
        '       looked at. Write the reasons into ' + path.basename(baselineFile) + ' by hand,\n' +
        '       then run this again. Nothing has been written.\n')
      return 2
    }
    fs.writeFileSync(baselineFile, JSON.stringify(out, null, 2) + '\n', 'utf8')
    say(quiet, 'published-counts: baseline written to ' + baselineFile)
    return 0
  }

  const failures = []
  for (const claimName of Object.keys(seen).sort()) {
    for (const file of Object.keys(seen[claimName]).sort()) {
      for (const n of Object.keys(seen[claimName][file]).sort()) {
        const rec = (((base.exempt[claimName] || {})[file] || {})[n]) || null
        const count = seen[claimName][file][n]
        if (!rec || !String(rec.why || '').trim()) {
          failures.push({ claim: claimName, file: file, n: n, count: count, why: 'not exempt' })
        } else if (rec.count !== count) {
          failures.push({ claim: claimName, file: file, n: n, count: count,
            why: 'exempt for ' + rec.count + ' occurrence(s), found ' + count })
        }
      }
    }
  }

  // The other direction. A surface that has quietly LOST its claim is as wrong as one stating
  // the old number, and only a check that knows a claim is expected can see an absence.
  for (const c of CLAIMS) {
    if (!truth[c.name]) continue
    const live = all.filter(x => x.claim === c.name && x.n === truth[c.name].n)
    if (!live.length) {
      failures.push({ claim: c.name, file: '(anywhere)', n: truth[c.name].n, count: 0,
        why: 'the truth is ' + truth[c.name].n + ' and no scanned surface states it at all' })
    }
  }

  if (!failures.length) {
    say(quiet, 'published-counts: ' + all.length + ' claim(s) across ' + files.length +
      ' file(s), every one matching its source')
    for (const c of CLAIMS) {
      if (!truth[c.name]) continue
      say(quiet, '  ' + c.name + ' = ' + truth[c.name].n + '  (' + c.source + ')')
    }
    return 0
  }

  process.stderr.write('published-counts: ' + failures.length + ' published number(s) disagree with what they count\n')
  for (const f of failures) {
    const c = CLAIMS.filter(x => x.name === f.claim)[0]
    process.stderr.write('  FAIL ' + f.claim + '  ' + f.file + '  states ' + f.n +
      '  (' + f.why + ')\n')
    if (c && truth[f.claim]) {
      process.stderr.write('       ' + c.what + ' is ' + truth[f.claim].n +
        ', read from ' + c.source + '\n')
    }
    for (const x of off.filter(y => y.claim === f.claim && canonicalKey(y.file) === f.file)) {
      process.stderr.write('       ' + x.file + ':' + x.line + '  ' + x.context + '\n')
    }
  }
  process.stderr.write('       Correct the surface, or record it as a dated exemption with a\n' +
    '       reason in ' + path.basename(baselineFile) + '.\n')
  return 1
}


module.exports = { main, readCeiling, readGlossarySize, collect, claimsIn, CLAIMS }

if (require.main === module) process.exit(main(process.argv.slice(2)))
