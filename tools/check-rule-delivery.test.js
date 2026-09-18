#!/usr/bin/env node
'use strict';
/*
 * Every assertion here has been watched failing, by breaking check-rule-delivery.js and
 * confirming this suite goes red. A check nobody has seen fail is indistinguishable from one
 * that always passes.
 *
 * Each case builds its own throwaway project (S59). The tool's whole subject is WHICH FILE a
 * rule reached, so a shared fixture would let one case's destination satisfy another's claim,
 * which is the exact defect the tool exists to find, reproduced inside its own suite.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const TOOL = path.join(__dirname, 'check-rule-delivery.js');
let pass = 0, fail = 0;
function ok (name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL  ' + name); } }

const LF = String.fromCharCode(10);
let n = 0;

// files: { 'CLAUDE.md': 'text', 'sub/x.md': 'text' }. manifest is written to tools/rule-delivery.json
// inside the fixture so the tool's own default path resolution is exercised rather than bypassed.
function project (files, manifest) {
  const dir = path.join(os.tmpdir(), 'studio-ruled-' + process.pid + '-' + (n++));
  fs.mkdirSync(path.join(dir, 'tools'), { recursive: true });
  for (const rel of Object.keys(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, files[rel], 'utf8');
  }
  if (manifest !== null) fs.writeFileSync(path.join(dir, 'tools', 'rule-delivery.json'), JSON.stringify(manifest), 'utf8');
  return dir;
}

function run (dir, extra) {
  const args = [TOOL, '--root', dir].concat(extra || []);
  try {
    return { code: 0, out: execFileSync('node', args, { stdio: ['pipe', 'pipe', 'pipe'] }).toString() };
  } catch (e) {
    return { code: e.status, out: ((e.stdout || '') + (e.stderr || '')).toString() };
  }
}

// ---------------------------------------------------------------- the rule is there

{
  const dir = project({ 'doc.md': 'the rule says NO EM-DASH anywhere' + LF },
    { rules: [{ name: 'r', present: ['no em-dash'], files: ['doc.md'] }] });
  const r = run(dir);
  ok('a rule present in the file it is claimed to be in passes', r.code === 0);
  ok('a passing run says every rule arrived', /present where it is claimed/.test(r.out));
}

{
  const dir = project({ 'doc.md': 'THE  RULE' + LF + '  SAYS no em-dash' + LF },
    { rules: [{ name: 'r', present: ['the rule says no em-dash'], files: ['doc.md'] }] });
  ok('a rule wrapped across lines still counts as present, so the check does not refuse on formatting', run(dir).code === 0);
}

// ---------------------------------------------------------------- ST-272, claimed and absent

{
  const dir = project({ 'doc.md': 'this document says nothing about it' + LF },
    { rules: [{ name: 'no-em-dash', ticket: 'ST-272', present: ['No em-dash'], files: ['doc.md'] }] });
  const r = run(dir);
  ok('a rule absent from the file it is claimed to be in FAILS', r.code === 1);
  ok('the refusal says the rule was claimed shipped', /CLAIMED SHIPPED, ABSENT/.test(r.out));
  ok('the refusal quotes the text it went looking for', /"No em-dash"/.test(r.out));
  ok('the refusal names the ticket', /ST-272/.test(r.out));
  ok('the refusal names the file it read, because an absence is a claim about where you looked', /doc\.md/.test(r.out));
}

// ---------------------------------------------------------------- ST-271 and S224, the loaded set

{
  // The rule is in a file that EXISTS and is NOT imported. This is the whole ST-271 finding:
  // every individual file is innocent and the rule still never reaches the reader.
  const dir = project({
    'CLAUDE.md': '# project' + LF + '@GOVERNANCE.md' + LF,
    'GOVERNANCE.md': 'nothing relevant here' + LF,
    'base/fragments/brevity.md': 'Three hundred words is the cap' + LF,
  }, { rules: [{ name: 'cap', present: ['Three hundred words is the cap'], loaded_by: ['CLAUDE.md'] }] });
  const r = run(dir);
  ok('a rule that reaches no loaded document FAILS even though the file carrying it exists', r.code === 1);
  ok('the refusal says it reaches no document the session loads', /REACHES NO DOCUMENT THE SESSION LOADS/.test(r.out));
  ok('the refusal cites S224 so the reader gets the reasoning and not only the verdict', /S224/.test(r.out));
  ok('the refusal lists CLAUDE.md as searched', /CLAUDE\.md/.test(r.out));
  ok('the refusal lists the imported document as searched', /GOVERNANCE\.md/.test(r.out));
}

{
  const dir = project({
    'CLAUDE.md': '# project' + LF + '@GOVERNANCE.md' + LF,
    'GOVERNANCE.md': 'Three hundred words is the cap' + LF,
  }, { rules: [{ name: 'cap', present: ['Three hundred words is the cap'], loaded_by: ['CLAUDE.md'] }] });
  const r = run(dir);
  ok('a rule in a document reached by an import passes', r.code === 0);
  ok('a passing loaded_by run names WHICH document carries it', /carried by GOVERNANCE\.md/.test(r.out));
}

{
  // An import resolves against the file that DECLARES it, not the project root. Getting this
  // wrong gives a confident answer that is wrong, which is why it has its own case (ST-190).
  const dir = project({
    'CLAUDE.md': '@sub/inner.md' + LF,
    'sub/inner.md': '@deep.md' + LF,
    'sub/deep.md': 'the rule lives two levels down' + LF,
  }, { rules: [{ name: 'deep', present: ['the rule lives two levels down'], loaded_by: ['CLAUDE.md'] }] });
  ok('an import two levels down is still part of the loaded set', run(dir).code === 0);
}

{
  const dir = project({ 'CLAUDE.md': 'no imports at all' + LF },
    { rules: [{ name: 'x', present: ['absent rule text here'], loaded_by: ['CLAUDE.md'] }] });
  const r = run(dir);
  ok('a document with no imports is still searched rather than skipped', r.code === 1 && /CLAUDE\.md/.test(r.out));
}

{
  const dir = project({ 'CLAUDE.md': '@missing.md' + LF },
    { rules: [{ name: 'x', present: ['absent rule text here'], loaded_by: ['CLAUDE.md'] }] });
  const r = run(dir);
  ok('an import that does not exist is reported as loading nothing rather than passed over in silence', /MISSING, loads nothing/.test(r.out));
}

// ---------------------------------------------------------------- retired wording

{
  const dir = project({ 'doc.md': 'the cap is 300 words. There is deliberately no line limit here.' + LF },
    { rules: [{ name: 'cap', present: ['the cap is 300 words'], retired: ['there is deliberately no line limit'], files: ['doc.md'] }] });
  const r = run(dir);
  ok('a rule present alongside the wording it REPLACED still fails', r.code === 1);
  ok('the refusal says the retired wording is still present', /RETIRED WORDING STILL PRESENT/.test(r.out));
}

{
  const dir = project({
    'CLAUDE.md': '@gov.md' + LF,
    'gov.md': 'the cap is 300 words. There is deliberately no line limit here.' + LF,
  }, { rules: [{ name: 'cap', present: ['the cap is 300 words'], retired: ['there is deliberately no line limit'], loaded_by: ['CLAUDE.md'] }] });
  const r = run(dir);
  ok('retired wording inside the LOADED set fails, which is the case where a session reads both', r.code === 1);
  ok('the loaded-set refusal explains the contradiction rather than only naming it', /contradict each other/.test(r.out));
}

// ---------------------------------------------------------------- exemptions

{
  const dir = project({ 'doc.md': 'it used to say: there is deliberately no line limit. It no longer does.' + LF },
    { rules: [{ name: 'cap', present: ['it used to say'], retired: ['there is deliberately no line limit'],
      files: ['doc.md'], exempt: [{ file: 'doc.md', reason: 'the document quotes the retired wording in order to retire it' }] }] });
  ok('an exemption with a reason suppresses the finding', run(dir).code === 0);
}

{
  const dir = project({ 'doc.md': 'it used to say: there is deliberately no line limit.' + LF },
    { rules: [{ name: 'cap', present: ['it used to say'], retired: ['there is deliberately no line limit'],
      files: ['doc.md'], exempt: [{ file: 'doc.md' }] }] });
  const r = run(dir);
  ok('an exemption with NO reason fails, so a pattern cannot be switched off quietly', r.code === 1);
  ok('the refusal says an unjustified exemption is a pattern switched off', /EXEMPTION WITH NO REASON/.test(r.out));
}

{
  const dir = project({ 'doc.md': 'the retired wording is gone from here entirely' + LF },
    { rules: [{ name: 'cap', present: ['the retired wording is gone'], retired: ['there is deliberately no line limit'],
      files: ['doc.md'], exempt: [{ file: 'doc.md', reason: 'was quoting it' }] }] });
  const r = run(dir);
  ok('an exemption that no longer suppresses anything FAILS as stale', r.code === 1);
  ok('the stale refusal says it would hide the next real finding', /hide the next real one/.test(r.out));
}

// ---------------------------------------------------------------- the manifest itself

{
  const dir = project({ 'doc.md': 'x' + LF }, { rules: [{ name: 'r', present: ['some rule text'] }] });
  const r = run(dir);
  ok('a rule naming no destination fails, because "shipped" with no destination is not testable', r.code === 1);
  ok('the refusal says the claim is not testable', /not a claim anything can test/.test(r.out));
}

{
  const dir = project({ 'doc.md': 'x' + LF }, { rules: [{ name: 'r', files: ['doc.md'] }] });
  const r = run(dir);
  ok('a rule naming no required text fails, because it can never go red', r.code === 1);
  ok('the refusal says it proves nothing', /proves nothing/.test(r.out));
}

{
  const dir = project({ 'doc.md': 'x' + LF }, { rules: [{ name: 'r', present: ['x rule'], files: ['gone.md'] }] });
  const r = run(dir);
  ok('a destination file that does not exist fails rather than being skipped', r.code === 1 && /does not exist/.test(r.out));
}

{
  const dir = project({ 'doc.md': 'x' + LF }, null);
  const r = run(dir);
  ok('no manifest is CANNOT TELL, exit 2, and not a pass', r.code === 2 && /CANNOT TELL/.test(r.out));
}

{
  const dir = project({ 'doc.md': 'x' + LF }, { rules: [] });
  const r = run(dir);
  ok('an EMPTY manifest is CANNOT TELL rather than clean, because it passes everything', r.code === 2);
  ok('the empty-manifest message says an empty manifest proves nothing', /proves nothing/.test(r.out));
}

{
  const dir = project({ 'doc.md': 'x' + LF }, null);
  fs.writeFileSync(path.join(dir, 'tools', 'rule-delivery.json'), '{ not json', 'utf8');
  ok('an unparseable manifest is CANNOT TELL, exit 2', run(dir).code === 2);
}


// The total is PINNED and written down rather than measured from the run it checks, because a
// self-updating total agrees with any run. Measured elsewhere in this repository: a fatal guard
// firing part way through a suite reported 0 failed and exit 0 having run 22 of 214, so a count
// of failures cannot see an assertion that never ran. Mutation: delete a block above and this
// goes red alone.
const EXPECTED_ASSERTIONS = 36;
if (pass + fail !== EXPECTED_ASSERTIONS) {
  console.log('FAIL  the suite ran ' + (pass + fail) + ' assertion(s) and expects ' + EXPECTED_ASSERTIONS + '. A block was skipped or deleted. Find out which before you change the number.');
  fail++;
}

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
