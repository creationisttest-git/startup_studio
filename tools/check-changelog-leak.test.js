#!/usr/bin/env node
'use strict';
/*
 * Tests for check-changelog-leak.js.
 *
 * Every assertion here has been watched failing. A check nobody has seen fail is
 * indistinguishable from one that always passes.
 *
 * THE FIXTURES CARRY INVENTED NAMES, NEVER THE REAL ONES. The rules this tool reads are the list
 * of private names it exists to keep out of a published file, so a fixture quoting a real one
 * would put that name into a file that IS published, which is the defect wearing the costume of a
 * test. Every fixture below writes its own tiny config with made-up patterns, which also means
 * these tests do not depend on the private config existing at all.
 *
 * THE READER STATES ARE THE POINT, not an afterthought. Two sittings running shipped a check that
 * was correct in the only tree its author ever ran it in, so the states a stranger can be standing
 * in are asserted first and by name: no private config, a config with no rule block, no changelog.
 * Each of those is CANNOT TELL and none of them refuses.
 *
 * ONE ASSERTION IS ABOUT WHAT IS NOT PRINTED, and it is the one most likely to be quietly lost.
 * The matched text is the private name; printing it to prove the tool found it would copy that
 * name into a terminal, a transcript and a CI log. So the refusal names the line number and the
 * rule's reason, and there is an assertion that the matched string is absent from the output.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TOOL = path.join(__dirname, 'check-changelog-leak.js');
let pass = 0, fail = 0;
function ok (name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL  ' + name); } }

let n = 0;
const junk = [];
function project (opts) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-leak-' + process.pid + '-' + (n++) + '-'));
  junk.push(dir);
  if (opts.changelog !== undefined) fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), opts.changelog, 'utf8');
  if (opts.config !== undefined) fs.writeFileSync(path.join(dir, 'studio.config.ps1'), opts.config, 'utf8');
  return dir;
}
// A config in the real file's shape, with invented patterns. See the header.
function config (rules) {
  const lines = ['$SitePages = @(' + "'index.html'" + ')', '$Cfg = @{', '    LeakPatterns = @('];
  for (const r of rules) lines.push("        @{ p = '" + r.p + "'; why = '" + r.why + "'; sample = 'x' }");
  lines.push('    )', '}');
  return lines.join('\n');
}
function run (dir, extra) {
  const args = [TOOL, '--root', dir].concat(extra || []);
  try {
    return { code: 0, out: execFileSync('node', args, { stdio: ['pipe', 'pipe', 'pipe'] }).toString() };
  } catch (e) {
    return { code: e.status, out: ((e.stdout || '') + (e.stderr || '')).toString() };
  }
}

// --- the clean case ---------------------------------------------------------------------------
{
  const d = project({ changelog: '# Changelog\n\nNothing private here.\n', config: config([{ p: '(?i)\\bzephyrine', why: 'project name' }]) });
  const r = run(d);
  ok('a changelog naming nothing private passes', r.code === 0);
  // A PASS THAT DOES NOT SAY HOW MANY RULES IT APPLIED IS INDISTINGUISHABLE FROM A PASS OVER AN
  // EMPTY LIST, which is the exact false pass this whole check exists to avoid.
  ok('and it says how many rules it applied, so a pass over an empty list cannot hide',
     /against 1 rule\(s\)/.test(r.out));
  ok('and it says it read only one file, so the row is not read as a clean bill for the publish',
     /reads ONE file/.test(r.out));
}

// --- the case the ticket was written from -----------------------------------------------------
{
  const d = project({
    changelog: '# Changelog\n\nline two\nFound by ZEPHYRINE round-four method gate.\n',
    config: config([{ p: '(?i)\\bzephyrine', why: 'project name' }])
  });
  const r = run(d);
  ok('a private project name in the changelog refuses', r.code === 1);
  ok('and it names the line number, which is what makes it fixable', /line 4/.test(r.out));
  ok('and it names the rule that matched rather than only that something did',
     /matches the rule for: project name/.test(r.out));
  // THE ASSERTION ABOUT WHAT IS NOT THERE. Printing the match would copy the private name into
  // the output, which is the thing being prevented.
  ok('and it does NOT print the private name it found', !/ZEPHYRINE/i.test(r.out));
  ok('and it says the omission is deliberate, so nobody reads it as the tool being unhelpful',
     /not printed here on purpose/.test(r.out));
}

// --- reader state: no private config ----------------------------------------------------------
{
  const d = project({ changelog: '# Changelog\n\nZEPHYRINE\n' });
  const r = run(d);
  ok('a copy of the export with no private config cannot tell, and does not refuse', r.code === 3);
  ok('and it says which file it could not read', /studio\.config\.ps1/.test(r.out));
  ok('and it explains that the file is unpublished on purpose rather than missing by accident',
     /deliberately not published/.test(r.out));
  // The state that would be a lockout is the one asserted against: this must never be exit 1 for
  // a reader who simply does not have the private half of the publisher.
  ok('and it is emphatically not a refusal', r.code !== 1);
}

// --- reader state: a config with no rule block ------------------------------------------------
{
  const d = project({ changelog: '# Changelog\n\nfine\n', config: '$SitePages = @()\n$Cfg = @{ Something = 1 }\n' });
  const r = run(d);
  ok('a config carrying no LeakPatterns block cannot tell', r.code === 3);
  ok('and says the block is what is missing, not the file', /carries no LeakPatterns block/.test(r.out));
}

// --- reader state: no changelog ---------------------------------------------------------------
{
  const d = project({ config: config([{ p: 'zephyrine', why: 'project name' }]) });
  const r = run(d);
  ok('no CHANGELOG.md at all cannot tell rather than passing', r.code === 3);
  ok('and says so in words naming the file', /no CHANGELOG\.md/.test(r.out));
}

// --- a rule that will not compile is not a clean scan -----------------------------------------
// A rule that cannot be compiled is a rule that is not looking. Reporting clean while one of them
// is broken is the false pass in its purest form, so this is a separate case from a match.
{
  const d = project({ changelog: '# Changelog\n\nfine\n', config: config([{ p: 'ok', why: 'fine rule' }, { p: '[unclosed', why: 'broken rule' }]) });
  const r = run(d);
  ok('a rule that will not compile makes the whole scan cannot-tell, never clean', r.code === 3);
  ok('and it says how many of how many failed, so the reader knows the size of the hole',
     /1 of 2 rule\(s\) would not compile/.test(r.out));
  ok('and it names the rule by its reason', /broken rule/.test(r.out));
}

// --- the two PowerShell spellings that broke the first version --------------------------------
// Both of these were found by RUNNING the tool against the real config, not by reading it. The
// first version handled (?i) and not (?-i), and its string parser stopped at the first half of a
// doubled quote, so it silently read 20 rules where the file holds 21.
{
  const d = project({ changelog: '# Changelog\n\nZEPHYRINE in capitals\n', config: config([{ p: '(?-i)zephyrine', why: 'case sensitive rule' }]) });
  const r = run(d);
  ok('a (?-i) rule compiles and stays case SENSITIVE, so capitals do not match a lower-case rule',
     r.code === 0);
}
{
  const d = project({ changelog: '# Changelog\n\nzephyrine lower case\n', config: config([{ p: '(?-i)zephyrine', why: 'case sensitive rule' }]) });
  const r = run(d);
  ok('and the same rule still matches the case it was written for', r.code === 1);
}
{
  // A pattern containing PowerShell's doubled-quote escape. Written raw rather than through
  // config(), because the escape is the thing under test.
  const d = project({
    changelog: "# Changelog\n\ntokenz: abcdefghijklmnop\n",
    config: ['$Cfg = @{', '    LeakPatterns = @(',
      "        @{ p = 'tokenz: ''?[a-z]{16,}'; why = 'credential'; sample = 'x' }",
      '    )', '}'].join('\n')
  });
  const r = run(d);
  ok('a rule whose pattern carries a doubled single quote is read whole, not truncated at it',
     r.code === 1);
  ok('and it is the credential rule that catches it', /matches the rule for: credential/.test(r.out));
}

// --- a rule this parser cannot read must never read as a clean scan ---------------------------
// THE FALSE PASS THIS TOOL SHIPPED, IN THREE GRAMMARS POWERSHELL ACCEPTS. The line pattern wants
// p and why in that order on one line. A reviewer wrote one fixture for each departure from that,
// every one holding two rules and the private name sitting in the changelog, and every one
// returned exit 0 reporting that the changelog named nothing private, against a count of 1. The
// count of openers is what catches all three and any fourth nobody has thought of.
{
  const raw = ['$Cfg = @{', '    LeakPatterns = @(',
    "        @{ p = 'safe'; why = 'harmless' }",
    "        @{ p = 'zephyrine'; allowIn = @('x.html'); why = 'project name' }",
    '    )', '}'].join('\n');
  const d = project({ changelog: '# Changelog\n\nzephyrine\n', config: raw });
  const r = run(d);
  ok('a rule with allowIn between p and why is not silently dropped', r.code === 3);
  ok('and it says how many rules were there against how many were read',
     /holds 2 rule\(s\) and only 1 could be read/.test(r.out));
  ok('and above all it does not report the changelog clean', !/names no private project/.test(r.out));
}
{
  const raw = ['$Cfg = @{', '    LeakPatterns = @(',
    "        @{ p = 'safe'; why = 'harmless' }",
    "        @{ p = 'zephyrine';", "           why = 'project name' }",
    '    )', '}'].join('\n');
  const d = project({ changelog: '# Changelog\n\nzephyrine\n', config: raw });
  // THIS ONE IS READ CORRECTLY AND THE ASSERTION SAYS SO RATHER THAN WHAT I FIRST EXPECTED. The
  // review reported this grammar as a silent drop alongside the other two. It is not, in this
  // shape: the whitespace between the fields is \s*, which spans a newline, so the rule parses,
  // the count agrees and the private name is caught. Asserted as exit 1 rather than 3 because
  // that is what it does, and an assertion written to match a report instead of the tool is how a
  // suite ends up certifying something nobody checked. The other two shapes did reproduce.
  ok('a rule whose why sits on the next line is read, and the name is caught', run(d).code === 1);
}
{
  const raw = ['$Cfg = @{', '    LeakPatterns = @(',
    "        @{ p = 'safe'; why = 'harmless' }",
    '        @{ p = "zephyrine"; why = \'project name\' }',
    '    )', '}'].join('\n');
  const d = project({ changelog: '# Changelog\n\nzephyrine\n', config: raw });
  ok('a double-quoted pattern is not silently dropped', run(d).code === 3);
}

// --- case: this tool must agree with the thing it claims to pre-empt --------------------------
// POWERSHELL MATCHING IS CASE INSENSITIVE BY DEFAULT. The first version started with no flag and
// added one only for an explicit (?i), so every rule carrying no inline flag was strict here and
// loose at the publish. That was 9 of the 21 real rules, including the AWS key, the GitHub token,
// the JWT and the machine path, and the tool was printing that it gives the same answer as the
// publish, sooner. It gave a different one, in the direction that lets a leak through.
{
  const d = project({ changelog: '# Changelog\n\nzephyrine in lower case\n', config: config([{ p: 'ZEPHYRINE', why: 'project name' }]) });
  ok('a rule with no inline flag matches regardless of case, as PowerShell does', run(d).code === 1);
}
{
  const d = project({ changelog: '# Changelog\n\nZQKABCDEFGHIJKLMNOPQ\n', config: config([{ p: 'zqka[0-9a-z]{16}', why: 'AWS key' }]) });
  ok('and the same holds for a credential rule written in the other case', run(d).code === 1);
}
{
  // The explicit case-sensitive flag still means what it says, so the default did not swallow it.
  const d = project({ changelog: '# Changelog\n\nZEPHYRINE\n', config: config([{ p: '(?-i)zephyrine', why: 'case sensitive rule' }]) });
  ok('and an explicit (?-i) is still honoured, so the new default did not swallow it', run(d).code === 0);
}

// --- usage -------------------------------------------------------------------------------------
{
  // NOT through run(), which supplies its own --root and would have put a valid value in front of
  // the empty one. The first version of this did exactly that: it asserted exit 2 against a
  // command line reading --root <dir> --root, where the first flag answers and the trailing one is
  // never reached. It failed honestly and the fixture was the thing that was wrong.
  let code = 0;
  try {
    execFileSync('node', [TOOL, '--root'], { stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) { code = e.status; }
  ok('a --root with nothing after it is a usage error, never a silent default', code === 2);
}

// --- a rule that carries its own nested array --------------------------------------------------
// THE RULE LIST USED TO END AT THE FIRST LINE STARTING WITH A CLOSING PAREN, WHICH IS WHERE AN
// INNER ARRAY ENDS AND NOT WHERE THE LIST DOES. A rule with an `allowIn = @(` written over two
// lines closes on exactly such a line, so every rule below it was never read. The completeness
// guard could not catch it either, because it counted openers INSIDE the already-truncated text:
// the count agreed with itself and the scan reported the changelog clean against half a list.
//
// Watched failing rather than reasoned about: with the old extraction restored, this same fixture
// returns exit 0 and "against 2 rule(s)" while the third name sits in the changelog. The assertion
// below is keyed on the reason belonging to THAT THIRD RULE rather than on a count, because an
// assertion keyed on a total goes red for reasons its own name does not describe.
{
  const cfg = [
    '$Cfg = @{',
    '    LeakPatterns = @(',
    "        @{ p = '(?i)\\bacme'; why = 'a client name'; sample = 'x' }",
    "        @{ p = '(?i)\\bwidgetco'; why = 'a client name'; sample = 'x'",
    '           allowIn = @(',
    "               'index.html'",
    '           )',
    '         }',
    "        @{ p = '(?i)\\bzephyrine'; why = 'a project name'; sample = 'x' }",
    '    )',
    '}'
  ].join('\n');
  const d = project({ changelog: '# Changelog\n\nWe shipped this for zephyrine first.\n', config: cfg });
  const r = run(d);
  ok('a rule carrying its own array does not end the rule list early', r.code === 1);
  ok('and the rule BELOW that nested array is the one that catches it, which is the rule the old '
     + 'extraction dropped in silence', /a project name/.test(r.out));
}

// --- A CLOSING PAREN THAT IS NOT CODE ----------------------------------------------------------
// SKIPPING SINGLE-QUOTED STRINGS WAS NOT ENOUGH AND A REVIEWER PROVED IT. An unbalanced closing
// paren inside a hash comment, or inside a double-quoted value, ended the rule list early and the
// scan reported the changelog CLEAN against a fraction of its own rules, because the completeness
// guard counts openers inside the text that was already cut short. Both fixtures below returned
// exit 0 with the third private name sitting in the changelog.
//
// Each assertion is keyed on the reason belonging to the rule that was being LOST, never on a
// count, because an assertion keyed on a total goes red for reasons its name does not describe.
{
  const cfg = [
    '$Cfg = @{',
    '    LeakPatterns = @(',
    "        @{ p = '(?i)\\bacme'; why = 'a client name'; sample = 'x' }   # dropped from the roster :)",
    "        @{ p = '(?i)\\bwidgetco'; why = 'a client name'; sample = 'x' }",
    "        @{ p = '(?i)\\bzephyrine'; why = 'a project name'; sample = 'x' }",
    '    )',
    '}'
  ].join('\n');
  const d = project({ changelog: '# Changelog\n\nWe shipped this for zephyrine first.\n', config: cfg });
  const r = run(d);
  ok('a closing paren inside a hash comment does not end the rule list', r.code === 1);
  ok('and the rules below that comment are still applied', /a project name/.test(r.out));
}
{
  const cfg = [
    '$Cfg = @{',
    '    LeakPatterns = @(',
    "        @{ p = '(?i)\\bacme'; why = 'a client name'; sample = \"b)ravo-thing\" }",
    "        @{ p = '(?i)\\bwidgetco'; why = 'a client name'; sample = 'x' }",
    "        @{ p = '(?i)\\bzephyrine'; why = 'a project name'; sample = 'x' }",
    '    )',
    '}'
  ].join('\n');
  const d = project({ changelog: '# Changelog\n\nWe shipped this for zephyrine first.\n', config: cfg });
  const r = run(d);
  ok('a closing paren inside a double-quoted value does not end the rule list', r.code === 1);
  ok('and the rules below that value are still applied', /a project name/.test(r.out));
}
// THE TWO DIRECTIONS ARE NOT SYMMETRIC, and this is the safe one stated so it is not mistaken for
// the dangerous one: an unbalanced OPENING paren never closes the block, so the tool says it
// cannot read the config rather than reporting a clean changelog.
{
  const cfg = '$Cfg = @{\n    LeakPatterns = @(\n        @{ p = \'(?i)\\bacme\'; why = \'a client name (unclosed\'; sample = \'x\' }\n';
  const d = project({ changelog: '# Changelog\n\nnothing private here.\n', config: cfg });
  const r = run(d);
  ok('a block that never closes is CANNOT TELL rather than a clean report', r.code === 3);
}

for (const d of junk) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} }

const EXPECTED_ASSERTIONS = 40;
const ranBefore = pass + fail;
ok('the suite ran every assertion: ran ' + (ranBefore + 1) + ' of ' + EXPECTED_ASSERTIONS
  + '. A block was skipped or deleted. Find out which before you change the number.',
  ranBefore === EXPECTED_ASSERTIONS - 1);

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
