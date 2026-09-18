#!/usr/bin/env node
'use strict';

/*
 * check-print-anchors.js -- find every string a tool prints from MORE THAN ONE place, and every
 * assertion that matches it against the whole output with nothing pinning it to a site.
 *
 * WHY AN INSTRUMENT AND NOT A THIRD CLAUSE. S223 says an assertion satisfied by either of two
 * places is satisfied by the wrong one. It has now happened THREE times, in two files and two
 * languages, and each fix was one more hand-written clause on the one instance somebody noticed:
 *
 *   1. archive-sittings: one line per section, both sections printed the same string, so the
 *      assertion was green whenever EITHER was right and a mutation breaking one was masked by
 *      the other. It surfaced only because a mutation came back LARGER than predicted.
 *   2. studio-self.tests.ps1: a banner counted twice after a fix made it print twice. Changing
 *      the real publish to a dry run keeps the count at 2 and publishes nothing.
 *   3. check-gate-dispatch: "Session:" prints from EIGHT places, one of them a summary, and six
 *      assertions matched it anywhere in the output. Deleting any single site left another
 *      printing it.
 *
 * Three clauses fixed three instances and found none of the others. The general form is
 * mechanical and therefore findable by a program: a string printed from N places is an
 * assertion about the UNION of N code paths, and a union hides exactly the single-component
 * failures a suite exists to find.
 *
 * WHAT IT DOES. For each (tool, suite) pair it reads the TOOL for string literals that reach
 * stdout, grouped by the line they print from, and the SUITE for string literals used in a match
 * against the tool's output. An assertion literal contained in a tool literal printed from two
 * or more distinct lines is reported, with every print site named.
 *
 * IT IS A HEURISTIC AND SAYS SO. It reads source text rather than running anything, so it cannot
 * know that an assertion counts occurrences deliberately, or that two sites are genuinely one
 * message. That is what the accept list is for: an entry names the pair, the literal and a
 * REASON, and an accept whose finding has gone is reported STALE and still fails, so the list
 * cannot quietly outlive the thing it excused.
 *
 * IT IS ALSO A RATCHET. The existing instances are real and are not all fixable in one sitting,
 * so the baseline records the count per pair and the check refuses a RISE. Every finding is
 * printed every run whether or not it is under the baseline, because a number that hides the
 * list is how the last one went unread for five days (S222).
 *
 *   node tools/check-print-anchors.js [--root <dir>] [--quiet]
 *   node tools/check-print-anchors.js --write-baseline --allow-rise "<reason>"
 *
 * Exit 0 clean or at/below baseline, 1 a rise or a stale accept, 2 the config cannot be read.
 */

const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
function arg(name, fallback) {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
}
const quiet = argv.includes('--quiet');
const writeBaseline = argv.includes('--write-baseline');
const allowRise = arg('--allow-rise', null);
const root = path.resolve(arg('--root', path.join(__dirname, '..')));
const configPath = path.join(root, 'tools', 'print-anchors.json');
const baselinePath = path.join(root, 'tools', 'print-anchors-baseline.json');

function out(s) { if (!quiet) process.stdout.write(s + '\n'); }

if (!fs.existsSync(configPath)) {
  process.stdout.write('CANNOT TELL  no config at ' + configPath + '\n');
  process.exit(2);
}
let config;
try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (e) {
  process.stdout.write('CANNOT TELL  config does not parse: ' + e.message + '\n');
  process.exit(2);
}

/* A literal has to be distinctive before an overlap means anything. "  " and "FAIL" appear
 * everywhere and an assertion matching them is not evidence of the defect this looks for.
 * Six characters and at least one run of three letters is the floor; it was chosen by running
 * the tool against the three KNOWN instances and confirming all three survive it. */
const MIN_LEN = 8;
function distinctive(s) {
  if (s.trim().length < MIN_LEN) return false;
  if (!/[a-z]{3}/i.test(s)) return false;
  return true;
}

/* REGEX LITERALS ARE THE MAJORITY OF THE ASSERTIONS THAT MATTER, and reading only quoted
 * strings missed every one of them. The first version of this tool found nine findings and
 * NOT the known instance it was written for: check-gate-dispatch.test.js asserts with
 * /Session: s1\.jsonl/ and there is no quotation mark on the line. A detector that cannot see
 * the case it was built for is the S219 defect, a check that never fires being indistinguishable
 * from a check with nothing to report, so this is the part to get right rather than the count.
 *
 * Recover the LITERAL RUNS from a regex: unescape punctuation escapes, then split on the
 * metacharacters that end a literal run. A run is what the regex requires to appear verbatim. */
function regexRuns(source) {
  const unescaped = source.replace(/\\([.^$*+?()[\]{}|/\\-])/g, '$1');
  /* Anything that is not a verbatim requirement ends the run: character classes, groups,
   * alternation, quantifiers, anchors, and the escape sequences that stand for a class. */
  return unescaped
    .split(/\\[nrtsSwWdDbB]|\[[^\]]*\]|[()|*+?{}^$]/)
    .map(s => s.trim())
    .filter(s => s.length >= MIN_LEN);
}

function regexLiteralsOn(line) {
  const out = [];
  /* A regex literal in an assertion sits after ( , = ! & | or the start of the line, which is
   * what separates it from a division. */
  const re = /(^|[(,=!&|:?\s])\/((?:[^/\\\n[]|\\.|\[[^\]]*\])+)\/[gimsuyd]*/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    for (const run of regexRuns(m[2])) out.push(run);
  }
  return out;
}

/* Pull quoted literals out of a line. Deliberately simple: it reads source text, not an AST,
 * because the two languages here do not share one and the question being asked survives a few
 * missed literals. A literal it fails to see produces a MISSED finding, never a false one. */
function literalsOn(line) {
  const out = [];
  const re = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    const raw = m[1] !== undefined ? m[1] : m[2];
    if (raw && raw.trim().length) out.push(raw);
  }
  return out;
}

const PRINT_JS = /(?:process\.stdout\.write|process\.stderr\.write|console\.log|console\.error)\s*\(|(?:^|[^\w.])say\s*\(|(?:^|[^\w.])die\s*\(/;
const PRINT_PS = /Write-Host|Write-Output|Write-Warning/i;
const ASSERT_JS = /\.test\s*\(|\.indexOf\s*\(|\.includes\s*\(|\.match\s*\(|ok\s*\(/;
const ASSERT_PS = /Assert-\w+|-match|-like|-contains/i;

function scan(file, isPS) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const prints = new Map();   // literal -> Set of line numbers
  const asserts = [];         // { literal, line }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    /* A comment is not a print site and not an assertion. Without this the long headers every
     * tool in this repository carries dominate the result and bury the real findings. */
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('#')) continue;
    const isPrint = isPS ? PRINT_PS.test(line) : PRINT_JS.test(line);
    const isAssert = isPS ? ASSERT_PS.test(line) : ASSERT_JS.test(line);
    if (isPrint) {
      for (const lit of literalsOn(line)) {
        if (!distinctive(lit)) continue;
        if (!prints.has(lit)) prints.set(lit, new Set());
        prints.get(lit).add(i + 1);
      }
    }
    if (isAssert) {
      for (const lit of literalsOn(line).concat(isPS ? [] : regexLiteralsOn(line))) {
        if (!distinctive(lit)) continue;
        asserts.push({ literal: lit.trim(), line: i + 1 });
      }
    }
  }
  return { prints, asserts };
}

const findings = [];
const pairsSeen = [];
const usedAccepts = new Set();

function acceptFor(pairName, literal) {
  for (const a of (config.accept || [])) {
    if (a.pair === pairName && a.literal === literal) return a;
  }
  return null;
}

for (const pair of (config.pairs || [])) {
  const toolPath = path.resolve(root, pair.tool);
  const suitePath = path.resolve(root, pair.suite);
  if (!fs.existsSync(toolPath) || !fs.existsSync(suitePath)) {
    findings.push({
      pair: pair.tool, unaccepted: true,
      text: 'CANNOT READ the pair: ' + (fs.existsSync(toolPath) ? suitePath : toolPath) + ' does not exist',
    });
    continue;
  }
  const isPS = /\.ps1$/i.test(toolPath);
  const tool = scan(toolPath, isPS);
  const suite = scan(suitePath, /\.ps1$/i.test(suitePath));
  pairsSeen.push(pair.tool);

  /* An assertion literal is unanchored when the text it matches is printed from two or more
   * distinct lines of the tool. Substring, not equality: an assertion nearly always matches a
   * fragment of the printed line rather than the whole of it, and equality would find nothing. */
  const reported = new Set();
  for (const a of suite.asserts) {
    const sites = new Set();
    for (const [lit, lines] of tool.prints) {
      /* Overlap in EITHER direction, using the shorter as the needle. A print site is usually a
       * fragment the assertion embeds in a longer expected string ("  Session: " inside
       * /Session: s1\.jsonl/), and testing only tool-contains-suite finds none of those. The
       * needle still has to clear MIN_LEN, so a short shared word is not an overlap. */
      const t = lit.trim();
      const s = a.literal;
      const needle = t.length <= s.length ? t : s;
      const hay = t.length <= s.length ? s : t;
      if (needle.length >= MIN_LEN && hay.indexOf(needle) !== -1) for (const l of lines) sites.add(l);
    }
    if (sites.size < 2) continue;
    const key = a.literal;
    if (reported.has(key)) continue;
    reported.add(key);
    const accepted = acceptFor(pair.tool, a.literal);
    if (accepted && accepted.reason) { usedAccepts.add(pair.tool + '|' + a.literal); continue; }
    findings.push({
      pair: pair.tool,
      literal: a.literal,
      sites: Array.from(sites).sort((x, y) => x - y),
      suiteLine: a.line,
      suitePath,
      toolPath,
      unaccepted: !accepted,
      text: null,
    });
  }
}

/* An accept that no longer excuses anything is suppressing nothing and would hide the next real
 * one. Same rule as the exemptions in check-rule-delivery.js and the accepted lines in
 * check-mutation-coverage.js: a suppression that outlives its reason is worse than none. */
const stale = [];
for (const a of (config.accept || [])) {
  if (!usedAccepts.has(a.pair + '|' + a.literal)) stale.push(a);
}

out('');
out('PRINT ANCHORS  ' + pairsSeen.length + ' pair(s) read');

const byPair = {};
for (const f of findings) {
  if (!byPair[f.pair]) byPair[f.pair] = [];
  byPair[f.pair].push(f);
}

for (const pairName of Object.keys(byPair)) {
  out('');
  out('  ' + pairName + '  ' + byPair[pairName].length + ' unanchored assertion(s)');
  for (const f of byPair[pairName]) {
    if (f.text) { out('    ' + f.text); continue; }
    out('    ' + path.relative(root, f.suitePath) + ':' + f.suiteLine);
    out('      matches ' + JSON.stringify(f.literal) + ', which ' + path.relative(root, f.toolPath)
      + ' prints from ' + f.sites.length + ' places: lines ' + f.sites.join(', '));
    out('      so the assertion is satisfied by the UNION of those sites and cannot tell them apart.');
  }
}

const counts = {};
for (const p of pairsSeen) counts[p] = (byPair[p] || []).length;

if (writeBaseline) {
  if (!allowRise) {
    process.stdout.write('\nREFUSED. --write-baseline needs --allow-rise "<reason>" saying why the number may go up.\n');
    process.stdout.write('A baseline written without one is a number nobody had to justify.\n');
    process.exit(1);
  }
  fs.writeFileSync(baselinePath, JSON.stringify({
    _why: 'Per-pair count of unanchored assertions. The check refuses a RISE. Lower it by anchoring an assertion to the line under test, never by widening the accept list without a reason.',
    written: new Date().toISOString().slice(0, 19).replace('T', ' '),
    reason: allowRise,
    counts,
  }, null, 2) + '\n', 'utf8');
  process.stdout.write('\nbaseline written: ' + JSON.stringify(counts) + '\n');
  process.exit(0);
}

let failed = 0;
if (fs.existsSync(baselinePath)) {
  let base;
  try { base = JSON.parse(fs.readFileSync(baselinePath, 'utf8')); } catch (e) {
    process.stdout.write('\nCANNOT TELL  baseline does not parse: ' + e.message + '\n');
    process.exit(2);
  }
  process.stdout.write('\n');
  for (const p of pairsSeen) {
    const was = (base.counts || {})[p];
    const now = counts[p];
    if (was === undefined) {
      process.stdout.write('NEW PAIR  ' + p + ' is not in the baseline, ' + now + ' finding(s). Record it deliberately.\n');
      failed++;
    } else if (now > was) {
      process.stdout.write('ROSE  ' + p + '  ' + was + ' -> ' + now + '. A new assertion matches a string printed from more than one place.\n');
      failed++;
    } else if (now < was) {
      process.stdout.write('  fell ' + p + '  ' + was + ' -> ' + now + '. Re-run with --write-baseline to lock it in.\n');
    }
  }
} else {
  process.stdout.write('\nCANNOT TELL  no baseline at ' + baselinePath + '. Write one with --write-baseline --allow-rise "<reason>".\n');
  process.exit(2);
}

for (const s of stale) {
  process.stdout.write('STALE ACCEPT  ' + s.pair + '  ' + JSON.stringify(s.literal)
    + ' no longer matches anything, so this accept suppresses nothing and would hide the next real one. Delete it.\n');
  failed++;
}

if (failed) {
  process.stdout.write('\n' + failed + ' refusal(s). S223, ST-269.\n');
  process.exit(1);
}
process.stdout.write('\nat or below baseline. ' + findings.length + ' known unanchored assertion(s) still listed above.\n');
process.exit(0);
