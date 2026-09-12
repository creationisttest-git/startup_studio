#!/usr/bin/env node
/**
 * check-changelog-leak.js -- does CHANGELOG.md name a private project, before a publish is what
 * tells you?
 *
 * WHY THIS EXISTS, AND IT IS A WINDOW RATHER THAN A HOLE. The authoritative leak scan is
 * Test-LeakPatterns in studio.ps1. It runs inside the full PowerShell suite, which takes about
 * five minutes, and at the publish. It does not run at session start and it did not run at the
 * wind-down. A changelog entry is WRITTEN at the wind-down, by the session most likely to be
 * quoting another project's session by name, because that is the session summarising what it just
 * learnt from somewhere else. So the gap between writing a private name into the changelog and
 * anything telling you about it was a whole sitting, and on 2026-09-10 it was one command from a
 * publish: a private project's name sat in CHANGELOG.md at HEAD, zero occurrences at the previous
 * release, so it entered in the unreleased range and would have refused the publish.
 * Third occurrence of the same shape.
 *
 * WHAT THIS IS NOT. It is not the leak scan and it does not replace it. It reads ONE file. The
 * authoritative scan reads the whole publish manifest and stays exactly where it is, for the
 * reason ST-208 paid for: moving a slow, broadly scoped check into a set every reader runs is how
 * a lockout ships. This is the cheap early warning for the one file whose writing schedule
 * guarantees the problem, and it says so rather than letting a green row read as a clean bill.
 *
 * THE PATTERNS ARE DELIBERATELY NOT IN THIS FILE. A list of the exact private names to look for is
 * itself the leak it prevents, which is why they live in studio.config.ps1, which is the private
 * half of the publisher and is absent from the publish manifest on purpose. This reads them from
 * there. That has a consequence worth stating plainly rather than discovering: on a reader's copy
 * of the export there is no config file, so there are no patterns, so this check CANNOT TELL. It
 * says so and stands down as advisory. It never reports clean on an empty pattern list, because a
 * scan with nothing to look for passes everything.
 *
 * THE READER STATES, ENUMERATED RATHER THAN IMAGINED (S175), because the last two sittings both
 * shipped a check that was correct in the only tree its author ever ran it in:
 *   no studio.config.ps1                     exit 3, cannot tell, no patterns to read
 *   a config with no LeakPatterns block      exit 3, cannot tell, same reason said differently
 *   no CHANGELOG.md                          exit 3, nothing to read
 *   patterns and a clean changelog           exit 0
 *   patterns and a private name              exit 1, naming the line and the reason
 *
 * IT DOES NOT PRINT WHAT IT FOUND. The matched text is the private name, and printing it copies
 * that name into a transcript, a terminal buffer and whatever else is watching. The line number
 * and the rule's own reason are enough to find it, and the file is three seconds away.
 *
 * PARSING POWERSHELL WITH A REGULAR EXPRESSION IS A KNOWN COMPROMISE. It reads the `p = '...'`
 * entries out of the LeakPatterns block and nothing else, and it does not attempt allowIn: no
 * rule exempts CHANGELOG.md today, verified rather than assumed, and every exemption in that file
 * is a list of site pages. If a rule ever exempts the changelog this will over-report, which is
 * the safe direction, and the refusal names the rule so the reason is one line away.
 *
 *   node tools/check-changelog-leak.js               read ./CHANGELOG.md
 *   options: --root <dir>  --quiet
 *
 * Exit 0 clean, 1 a private name is in the changelog, 2 usage error, 3 cannot tell.
 */

'use strict'

const fs = require('fs')
const path = require('path')

const NEEDS_VALUE = { needsValue: true }

function flagOf (argv, name, fallback) {
  const i = argv.indexOf('--' + name)
  if (i === -1) return fallback
  const v = argv[i + 1]
  if (v === undefined || v.slice(0, 2) === '--') return NEEDS_VALUE
  return v
}

// WHERE THE BLOCK ENDS, AND IT IS NOT WHERE IT USED TO THINK. The end was matched as the first
// line whose first non-space character is a closing paren. A rule carrying its own array, an
// `allowIn = @(` written over two lines, closes that INNER array on a line of exactly that shape,
// so the block stopped there and every rule below it was never read. The completeness guard could
// not see it, because it counted openers INSIDE the already-truncated text: the count agreed with
// itself, and the scan reported the changelog clean against half a rule list. That is precisely
// the failure the guard exists to stop, one level up from where it was looking.
//
// So the end is found by balancing parentheses instead, and the balance SKIPS anything inside a
// single-quoted string. That is not fussiness: a rule body is a regular expression and regular
// expressions are full of parentheses. `(?i)` happens to be balanced and would survive naive
// counting; `[(]` is not, and would end the block in the middle of a rule.
//
// IF IT CANNOT FIND THE CLOSE IT RETURNS NOTHING, which the caller turns into a refusal rather
// than an empty rule list. A double-quoted string holding an unbalanced paren would land there.
// That is the safe direction: the tool says it cannot read the config, instead of saying the
// changelog is clean because it stopped looking.
function leakBlockBody (raw) {
  const open = raw.match(/LeakPatterns\s*=\s*@\(/)
  if (!open) return null
  const start = open.index + open[0].length
  let depth = 1
  let mode = 'code'
  for (let i = start; i < raw.length; i++) {
    const c = raw[i]
    // SINGLE QUOTES WERE THE ONLY THING SKIPPED AND THAT WAS NOT ENOUGH, which a reviewer proved
    // rather than argued: an unbalanced closing paren inside a HASH COMMENT, "# dropped from the
    // roster :)", or inside a DOUBLE-QUOTED value, ended the block early. The scan then reported
    // the changelog clean against one rule of three with a private name sitting in it, because the
    // completeness guard counts openers inside the text that was already cut short and so agrees
    // with itself. That is word for word the criticism this function makes of the code it
    // replaced, one level up, and today's real config survives it only by luck: its one
    // paren-bearing comment happens to balance.
    //
    // The failure directions are not symmetric and that is worth knowing. An unbalanced OPENING
    // paren never closes the block, so this returns nothing and the caller refuses: it says it
    // cannot read the config. An unbalanced CLOSING paren used to end the block early and report
    // CLEAN. Only the second one is dangerous, and both of the reported cases were that one.
    if (mode === 'single') { if (c === "'") mode = 'code'; continue }
    if (mode === 'double') {
      if (c === '`') { i++; continue }   // the PowerShell escape inside a double-quoted string
      if (c === '"') mode = 'code'
      continue
    }
    if (c === '#') { while (i < raw.length && raw[i] !== '\n') i++; continue }
    if (c === "'") { mode = 'single'; continue }
    if (c === '"') { mode = 'double'; continue }
    if (c === '(') depth++
    else if (c === ')') { depth--; if (depth === 0) return raw.slice(start, i) }
  }
  // THE DOUBLED-QUOTE SKIP THAT USED TO SIT HERE IS DELETED RATHER THAN DOCUMENTED. A quote
  // doubled inside a single-quoted string closes and immediately reopens it, so every character
  // after the pair is classified identically whether the pair is skipped or not. A reviewer
  // measured it: deleting the branch left the suite at 35 passed 0 failed and a differential over
  // 200,000 random inputs found zero disagreements. It carried a four line comment claiming it
  // prevented the bug this function replaced, which is a rule nobody can watch fail. The identical
  // skip in the LINE regex below is real, because that one captures the string CONTENTS, and it is
  // tested.
  return null
}

// The rules, as { source, why }. Returned rather than thrown so every exit code stays in main.
function patternsFrom (configPath) {
  let raw
  try { raw = fs.readFileSync(configPath, 'utf8') } catch (e) {
    return { why: 'the private config could not be read at ' + configPath }
  }
  const body = leakBlockBody(raw)
  if (body === null) return { why: 'the config at ' + configPath + ' carries no LeakPatterns block that closes' }
  const rules = []
  // A SINGLE-QUOTED POWERSHELL STRING ESCAPES ITS OWN QUOTE BY DOUBLING IT, and one rule in this
  // config does exactly that. The obvious [^']+ stops at the first half of that pair, which read
  // one rule as a fragment and lost the rest of the line. Found by running it, not by reading it:
  // 20 rules parsed where the file holds 21, and the twenty-first was the credential rule.
  const line = /@\{\s*p\s*=\s*'((?:[^']|'')*)'\s*;\s*why\s*=\s*'((?:[^']|'')*)'/g
  let m
  while ((m = line.exec(body)) !== null) {
    rules.push({ source: m[1].split("''").join("'"), why: m[2].split("''").join("'") })
  }
  if (!rules.length) return { why: 'the LeakPatterns block at ' + configPath + ' holds no readable rule' }
  // A RULE THIS PARSER CANNOT READ IS A RULE THAT IS NOT LOOKING, AND IT USED TO BE DROPPED IN
  // SILENCE. The line pattern above wants p and why in that order on one line. PowerShell accepts
  // plenty that is not that: allowIn between them, why on the following line, a double-quoted
  // pattern. A reviewer built one fixture for each, every one holding two rules and a private name
  // sitting in the changelog, and every one returned exit 0 saying the changelog named nothing
  // private, against a count of 1. The scan reported clean because it had quietly stopped looking.
  //
  // Counting the openers is the one assertion that covers all three and any fourth nobody has
  // thought of yet. It needs no understanding of the grammar, only the arithmetic that a rule was
  // there and did not arrive.
  const found = (body.match(/@\{/g) || []).length
  if (found !== rules.length) {
    return {
      why: 'the LeakPatterns block at ' + configPath + ' holds ' + found + ' rule(s) and only ' +
        rules.length + ' could be read, so the scan would be incomplete'
    }
  }
  return { rules: rules }
}

// PowerShell writes case sensitivity as an inline flag that JavaScript does not accept in the
// pattern body: (?i) for insensitive and (?-i) for sensitive. BOTH have to be handled and only the
// first was, which is how a rule that had never once been exercised turned out not to compile at
// all. Lifted to a real flag rather than left to throw, because a rule that will not compile is a
// rule that is not looking, and the caller treats any of them as cannot-tell rather than clean.
// (?-i) becomes no flag, since a JavaScript pattern is case sensitive already.
function compile (source) {
  let body = source
  // CASE INSENSITIVE IS THE DEFAULT, BECAUSE IT IS POWERSHELL'S DEFAULT, AND STARTING FROM THE
  // OTHER END MADE THIS CHECK DISAGREE WITH THE PUBLISH ON 9 OF 21 RULES. The first version began
  // with no flag and added one only for an explicit (?i). PowerShell's -match is insensitive
  // unless told otherwise, so every rule carrying no inline flag, which is 9 of them including the
  // AWS key, the GitHub token, the JWT, the backend host and the machine path, was strict here and
  // loose at the publish. Measured: the same private strings in lower case returned exit 0 here
  // and matched in PowerShell. The tool was printing that it gives the same answer as the publish,
  // sooner. It gave a different answer, in the direction that lets a leak through.
  let flags = 'gi'
  if (body.slice(0, 4) === '(?i)') { body = body.slice(4) } else if (body.slice(0, 5) === '(?-i)') { body = body.slice(5); flags = 'g' }
  try { return { re: new RegExp(body, flags) } } catch (e) { return { why: e.message } }
}

function main (argv) {
  const quiet = argv.indexOf('--quiet') !== -1
  const rootArg = flagOf(argv, 'root', process.cwd())
  if (rootArg === NEEDS_VALUE) {
    process.stderr.write('check-changelog-leak: --root needs a directory after it\n')
    return 2
  }
  const root = path.resolve(rootArg)
  const say = l => { if (!quiet) process.stdout.write(l + '\n') }

  const changelog = path.join(root, 'CHANGELOG.md')
  if (!fs.existsSync(changelog)) {
    process.stdout.write('  CANNOT TELL. there is no CHANGELOG.md at ' + root + '.\n')
    return 3
  }

  const p = patternsFrom(path.join(root, 'studio.config.ps1'))
  if (p.why) {
    process.stdout.write('  CANNOT TELL whether the changelog names a private project: ' + p.why + '.\n')
    process.stdout.write('  That file is the private half of the publisher and is deliberately not published,\n')
    process.stdout.write('  so this reads as advisory on any copy of the export. The publish still scans.\n')
    return 3
  }

  let text
  try { text = fs.readFileSync(changelog, 'utf8') } catch (e) {
    process.stdout.write('  CANNOT TELL. CHANGELOG.md could not be read: ' + e.message + '\n')
    return 3
  }
  const lines = text.split(/\r?\n/)

  const hits = []
  const broken = []
  for (const rule of p.rules) {
    const c = compile(rule.source)
    if (c.why) { broken.push({ why: rule.why, err: c.why }); continue }
    for (let i = 0; i < lines.length; i++) {
      c.re.lastIndex = 0
      if (c.re.test(lines[i])) hits.push({ line: i + 1, why: rule.why })
    }
  }

  // A rule that will not compile is a rule that is not looking, and reporting clean while one is
  // broken is exactly the false pass this whole check exists to stop.
  if (broken.length) {
    process.stdout.write('  CANNOT TELL. ' + broken.length + ' of ' + p.rules.length +
      ' rule(s) would not compile here, so the scan is incomplete.\n')
    for (const b of broken) process.stdout.write('    ' + b.why + ': ' + b.err + '\n')
    return 3
  }

  if (hits.length) {
    process.stdout.write('  CHANGELOG.md NAMES SOMETHING PRIVATE. ' + hits.length + ' line(s) match a leak rule.\n')
    // The matched text is the private name. Printing it copies it somewhere new, which is the
    // thing being prevented, so the line number and the rule's reason are all that is printed.
    for (const h of hits) {
      process.stdout.write('    line ' + h.line + '  matches the rule for: ' + h.why + '\n')
    }
    process.stdout.write('  The text is not printed here on purpose: it is the private name.\n')
    process.stdout.write('  Open CHANGELOG.md at those lines. The publish refuses on the same rules,\n')
    process.stdout.write('  so this is the same answer you would get later, sooner.\n')
    return 1
  }

  say('  CHANGELOG.md names no private project, against ' + p.rules.length + ' rule(s).')
  say('  This reads ONE file. The publish scans the whole manifest and is the authority.')
  return 0
}

if (require.main === module) process.exit(main(process.argv.slice(2)))

module.exports = { main, patternsFrom, compile }
