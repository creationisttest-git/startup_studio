'use strict';
/*
 * Assertions for check-release-note.js. Every one below was watched failing by mutating the
 * working file, not by reasoning about it (S200).
 *
 * THE MUTATIONS THAT DROVE THE DESIGN, recorded because a control nobody has seen fail and a
 * control that always passes are the same thing until somebody says which:
 *   - `words > CAP` to `words >= CAP`: caught only by the exactly-200 case, which is why the
 *     boundary is asserted from BOTH sides rather than once.
 *   - dropping the `String(w.reason || '').trim()` filter: a waiver with an empty reason then
 *     excused the note, which is a box ticked rather than an approval given.
 *   - returning early on the newest section before the waiver sweep: every stale waiver then went
 *     unreported whenever the newest note was short, which is the state a repository is in almost
 *     all the time, so the sweep is asserted on a PASSING note specifically.
 *   - taking `all[0]` instead of the latest date: right for this repository's newest-first
 *     changelog and wrong for every other ordering, so it is caught only by the oldest-first
 *     fixture and by nothing else in this file.
 *   - dropping the line that reports file order disagreeing with date order: silently sorting
 *     would hide a real defect in somebody's changelog, so the disagreement is stated and the
 *     newest is still the one checked.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { fixtureRoot } = require('./tmp-fixtures.js');

const TOOL = path.join(__dirname, 'check-release-note.js');
const mod = require('./check-release-note.js');

let pass = 0, fail = 0;
function ok (name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL  ' + name); } }

function run (args) {
  try {
    const out = execFileSync('node', [TOOL].concat(args || []), { stdio: ['pipe', 'pipe', 'pipe'] });
    return { code: 0, out: out.toString() };
  } catch (e) {
    return { code: e.status === undefined ? -1 : e.status, out: ((e.stdout || '') + (e.stderr || '')).toString() };
  }
}

const root = fixtureRoot('release-note');

/*
 * A fixture project owns BOTH its changelog and its waivers. The first version of this file wrote
 * forged approvals and deliberate garbage into the real tools/release-note-waivers.json and
 * restored it in a `finally`, which a killed run does not reach, and that file is published and
 * not gitignored. A test that can leave an approval behind is a test that can excuse this
 * repository's own next release, which is the exact failure the check exists to prevent. Moving
 * waivers beside the changelog (H5) made this both correct and simple.
 */
function project (name, changelog, waivers) {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  if (changelog !== null) fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), changelog, 'utf8');
  if (waivers !== undefined && waivers !== null) {
    fs.writeFileSync(path.join(dir, 'release-note-waivers.json'),
      typeof waivers === 'string' ? waivers : JSON.stringify(waivers, null, 2), 'utf8');
  }
  return dir;
}

function note (date, words) {
  return '## ' + date + '\n\n' + new Array(words + 1).join('w ') + '\n';
}

// ---- the cap, from both sides of the boundary ----
const at = run(['--dir', project('at-cap', note('2026-09-19', 198))]);
ok('exactly at the cap passes', at.code === 0 && /is 200 word\(s\)/.test(at.out));

const over = run(['--dir', project('over-cap', note('2026-09-19', 199))]);
ok('one word over the cap fails', over.code === 1);
ok('the refusal states both numbers', /is 201 words against a cap of 200/.test(over.out));
ok('the refusal names the file and line', /CHANGELOG\.md:1/.test(over.out));
ok('the refusal says approval comes BEFORE', /BEFORE it is\n\s+written, not after/.test(over.out));
ok('the refusal names the escape and its shape', /"date":"2026-09-19","reason"/.test(over.out));

const under = run(['--dir', project('under-cap', note('2026-09-19', 10))]);
ok('a short note passes', under.code === 0);
ok('a passing run still prints the count', /is 12 word\(s\), cap 200/.test(under.out));

// ---- the escape ----
let r = run(['--dir', project('waived', note('2026-09-19', 400), [{ date: '2026-09-19', reason: 'CEO approved: this one carries the migration steps.' }])]);
ok('an approved over-cap note passes', r.code === 0);
ok('the approval is quoted on the passing line', /APPROVED: CEO approved/.test(r.out));
ok('a live waiver is printed on every run', /waiver {2}2026-09-19 {2}live/.test(r.out));

r = run(['--dir', project('blank-reason', note('2026-09-19', 400), [{ date: '2026-09-19', reason: '   ' }])]);
ok('a waiver with a blank reason does NOT excuse the note', r.code === 1);

r = run(['--dir', project('no-reason', note('2026-09-19', 400), [{ date: '2026-09-19' }])]);
ok('a waiver with no reason at all is refused', r.code === 1);
ok('and the missing reason is named rather than left blank', /NO REASON, which is refused/.test(r.out));

// ---- stale escapes, which is the half that stops the list outliving what it excused ----
r = run(['--dir', project('stale-date', note('2026-09-19', 10), [{ date: '2001-01-01', reason: 'long gone' }])]);
ok('a waiver for a section that does not exist fails', r.code === 1);
ok('and says so with the date', /2001-01-01 {2}STALE, no such section/.test(r.out));
ok('a stale waiver is reported even when the newest note passes', /is 12 word\(s\), cap 200/.test(r.out) && r.code === 1);

r = run(['--dir', project('stale-short', note('2026-09-19', 10), [{ date: '2026-09-19', reason: 'no longer needed' }])]);
ok('a waiver on a section now under the cap is stale', r.code === 1);
ok('and the message says how long that section actually is', /that section is 12 words and needs no waiver/.test(r.out));

// ---- a refusal names the thing it is about ----
r = run(['--dir', project('bad-json', note('2026-09-19', 10), '{ not json')]);
ok('an unreadable waiver file fails rather than being ignored', r.code === 1);
ok('and names the file', r.out.indexOf('release-note-waivers.json') !== -1);
ok('and carries the parser message, not just the token', /is not readable as JSON: /.test(r.out));

r = run(['--dir', project('bad-shape', note('2026-09-19', 10), { waivers: 'nope' })]);
ok('a waiver file of the wrong shape fails', r.code === 1);
ok('and says what shape it must be', /must hold an array/.test(r.out));

// ---- the not-a-fault cases ----
const none = run(['--dir', project('no-changelog', null)]);
ok('a project with no changelog exits 3, not 1', none.code === 3);
ok('and says nothing is wrong', /nothing to check/.test(none.out));

const empty = run(['--dir', project('no-sections', '# Changelog\n\nNothing dated here.\n')]);
ok('a changelog with no dated section exits 3', empty.code === 3);
ok('and names what it looked for', /## YYYY-MM-DD/.test(empty.out));

ok('an unknown switch is a usage error', run(['--nonsense']).code === 2);

// ---- newest is the latest DATE, whatever order the file is in ----
// This pair used to assert the opposite and pinned a defect: taking the first section in file
// order is right for a newest-first changelog and wrong for anybody else's, and this tool is
// pointed at other projects on purpose. A content reviewer proved it with an oldest-first fixture
// where a 400-word section at the bottom was never counted and the run returned 0.
r = run(['--dir', project('newest-first', note('2026-09-19', 400) + '\n' + note('2026-01-01', 10))]);
ok('a newest-first changelog checks the top section', r.code === 1 && /the 2026-09-19 note is 402 words/.test(r.out));

r = run(['--dir', project('oldest-first', note('2026-01-01', 10) + '\n' + note('2026-09-19', 400))]);
ok('an oldest-first changelog checks the BOTTOM section', r.code === 1);
ok('and names the later date, not the first in the file', /the 2026-09-19 note is 402 words/.test(r.out));
ok('and says plainly that file order disagrees with date order',
  /the section measured is 2026-09-19 at line \d+, not the first in the file \(2026-01-01\)/.test(r.out));
// A DATE THAT IS NOT A DATE USED TO DISARM THE CAP FOR THE WHOLE FILE. "2026-13-45" matched the
// pattern and sorted above every real date as a string, so a typo in one heading made a 403-word
// note pass with exit 0. Found by typing a bad date, not by reading the code.
r = run(['--dir', project('bad-date', note('2026-13-45', 10) + '\n' + note('2026-09-19', 400))]);
ok('a heading that is not a real date does not become the release', r.code === 1);
ok('and it is named so the typo can be found', /"2026-13-45" is not a real date/.test(r.out));
ok('and the real newest section is the one measured', /the 2026-09-19 note is 402 words/.test(r.out));
ok('31 February is refused too, which a range check alone would pass',
  /"2026-02-31" is not a real date/.test(run(['--dir', project('feb31', note('2026-02-31', 10) + '\n' + note('2026-01-01', 10))]).out));

// TIES GO TO THE LONGEST, NOT TO FILE POSITION. A project publishing twice in one day had its
// 403-word note pass because a short sibling above it was measured instead. A real sibling
// changelog here holds eight or more duplicate dates, so this is the ordinary case.
r = run(['--dir', project('same-day', note('2026-09-19', 10) + '\n' + note('2026-09-19', 400))]);
ok('where two sections share the latest date, the longest is measured', r.code === 1);
ok('and the tie is stated rather than resolved silently', /2 sections share 2026-09-19/.test(r.out));
ok('a waiver is not stale while any section at that date needs it',
  run(['--dir', project('same-day-waived', note('2026-09-19', 10) + '\n' + note('2026-09-19', 400),
    [{ date: '2026-09-19', reason: 'approved' }])]).code === 0);

ok('a newest-first file says nothing about ordering',
  run(['--dir', project('quiet-order', note('2026-09-19', 10) + '\n' + note('2026-01-01', 10))]).out.indexOf('not the first in the file') === -1);

// ---- the counter agrees with wc -w, which is the whole point of choosing it ----
ok('countWords matches whitespace splitting', mod.countWords(['one two', '', ' three  four ']) === 4);
ok('countWords is 0 for an empty body', mod.countWords(['', '   ', '']) === 0);
ok('the cap is exported so nothing holds a second copy of it', mod.CAP === 200);
ok('sections finds every dated heading', mod.sections('## 2026-01-01\na\n## 2026-02-02\nb\n').length === 2);
ok('sections records the line a heading is on', mod.sections('x\n\n## 2026-01-01\na\n')[0].line === 3);
// H1. This used to assert the OPPOSITE and pinned the defect as correct. A real sibling project
// writes "## 2026-09-18 <title>", and requiring the date to be the whole heading absorbed 68 of
// its 98 sections into their neighbour. An assertion that agrees with the defect is the reason
// reading the code could never have found it.
ok('a dated heading with a title after it IS a section', mod.sections('## 2026-01-01 and more\nx\n').length === 1);
ok('and the date is taken without the title', mod.sections('## 2026-01-01 and more\nx\n')[0].date === '2026-01-01');
ok('a longer digit run is not a date', mod.sections('## 2026-01-011 nope\n').length === 0);

// H4. The guard tying an approval to ITS OWN section was unasserted: replacing
// `w.date === newest.date` with `true` left 37 of 37 green, so one approval for any section
// excused every other. A waiver approves one note, never the habit.
r = run(['--dir', project('waiver-other-section',
  note('2026-01-01', 400) + '\n' + note('2025-12-01', 400),
  [{ date: '2025-12-01', reason: 'CEO approved the DECEMBER note, not this one.' }])]);
ok('an approval for a different section does not excuse the newest note', r.code === 1);

// H5. Waivers are read beside the changelog under test, never from the studio's own copy, so one
// project's approval cannot excuse another's note and a maintainer is pointed at their own file.
r = run(['--dir', project('own-waivers', note('2026-09-19', 400),
  [{ date: '2026-09-19', reason: 'approved in this project' }])]);
ok('a waiver beside the subject changelog is the one that counts', r.code === 0);
ok('and the refusal points at the subject project, not the studio',
  /points-home[\\/]release-note-waivers\.json/.test(run(['--dir', project('points-home', note('2026-09-19', 400))]).out));

// H6. A DATED HEADING INSIDE A FENCED CODE BLOCK IS SHOWN, NOT PUBLISHED. With no fence state the
// tool split one 318-word section in two, reported "2 sections share 2026-09-19", measured the
// 163-word half and exited 0, so 152 words walked past the cap. Mutating the fence branch away
// reproduces exactly that, which is how this was watched failing.
const fenced = '## 2026-09-19 the only release\n\n' + new Array(160).join('w ') +
  '\n\nHow to write a heading:\n\n```\n## 2026-09-19 example heading\n```\n\n' + new Array(160).join('w ') + '\n';
// Counted from the fixture rather than typed, so the assertion cannot quietly agree with a
// half-measured section: a hand-typed number is satisfied by the wrong reading as easily as the
// right one, which is the defect that let the first version of this tool ship.
const fencedWords = fenced.trim().split(/\s+/).filter(Boolean).length;
r = run(['--dir', project('fenced-heading', fenced), '--today', '2026-09-19']);
ok('a dated heading inside a code fence is not a second release', r.code === 1);
ok('and the WHOLE section is measured, fence included',
  new RegExp('is ' + fencedWords + ' words against a cap of 200').test(r.out) && fencedWords > 300);
ok('so the tool no longer claims two sections share the date', !/sections share/.test(r.out));

// The closing fence must match the opener's character and be at least as long, which is the
// CommonMark rule. Being lenient here ends the fence early and reopens H6 on any block whose body
// holds a shorter run of backticks.
const nested = '## 2026-09-19 note\n\n````\n```\n## 2026-09-19 inner\n```\n````\n\n' + new Array(210).join('w ') + '\n';
r = run(['--dir', project('nested-fence', nested), '--today', '2026-09-19']);
ok('a shorter fence inside a longer one does not close it', r.code === 1 && !/sections share/.test(r.out));

// AN UNCLOSED FENCE IS REFUSED, NOT REPORTED, and the exit code is the half that matters. The
// first version asserted only the message. A product reviewer then showed that a fence opened in
// the PREAMBLE swallows every heading below it, so the tool says "holds no dated section" at exit
// 3, which run-checks registers as ADVISORY, so the release gate reads GREEN with an over-cap
// note sitting in the file unmeasured. Asserting the message and not the code is how that shipped.
r = run(['--dir', project('unclosed-fence', '## 2026-09-19 note\n\n```\nstill open\n'), '--today', '2026-09-19']);
ok('an unclosed fence is REFUSED, not merely reported', r.code === 1 && /never closes it/.test(r.out));

r = run(['--dir', project('unclosed-preamble', 'Preamble\n\n```\nopened and never closed\n\n' + note('2026-09-19', 400)), '--today', '2026-09-19']);
ok('an unclosed fence in the preamble does not become an advisory exit 3', r.code === 1);
ok('and the refusal names the line the fence was opened on', /code fence at line 3/.test(r.out));

// THE CRITICAL THE PRODUCT REVIEWER FOUND, and it is this defect surviving one axis over for the
// SECOND time on this file. CommonMark forbids a CLOSING fence from carrying an info string, so
// "```js" inside a block is content. The first fix checked character and length and stopped, so
// such a line closed the block early and put 165 words of a 337-word section back outside the cap
// at exit 0. The comment naming that exact lenient direction was written hours before.
// THE ASSERTION HAD TO BE REDESIGNED BECAUSE THE FIRST ONE PASSED UNDER THE MUTANT. Checking
// exit 1 was satisfied by the WRONG refusal: under the mutant the third fence line opens a block
// nobody closes, so the tool refuses for an unclosed fence and the code is 1 either way. That is
// an assertion satisfied by something other than the thing it names, which is S223. The two
// readings are separated by WHICH refusal comes back, so that is what is asserted.
const infoClose = '## 2026-09-19 note\n\n```\n## 2026-09-19 inner\n```js\nstill inside the block\n```\n\n' + new Array(210).join('w ') + '\n';
const infoWords = infoClose.trim().split(/\s+/).filter(Boolean).length;
r = run(['--dir', project('info-string-close', infoClose), '--today', '2026-09-19']);
ok('a fence line carrying an info string does not CLOSE a block',
  r.code === 1 && new RegExp('is ' + infoWords + ' words against a cap').test(r.out) && !/never closes it/.test(r.out));

// M1 SURVIVED MY OWN MUTATION RUN: no fixture used a tilde, so "both fence characters are
// handled" was unmeasured. Dropping the tilde alternation left the suite at 70 passed 0 failed.
const tilde = '## 2026-09-19 note\n\n~~~\n## 2026-09-19 inner\n~~~\n\n' + new Array(210).join('w ') + '\n';
r = run(['--dir', project('tilde-fence', tilde), '--today', '2026-09-19']);
ok('a tilde fence hides a dated heading exactly as a backtick fence does', r.code === 1 && !/sections share/.test(r.out));

// M2 SURVIVED TOO: nothing reached the same-character check, so a tilde line could have closed a
// backtick block and the control was unproven.
const mixed = '## 2026-09-19 note\n\n```\n~~~\n## 2026-09-19 inner\n~~~\n```\n\n' + new Array(210).join('w ') + '\n';
r = run(['--dir', project('mixed-fence', mixed), '--today', '2026-09-19']);
ok('a tilde line does not close a backtick block', r.code === 1 && !/sections share/.test(r.out));

// M4 SURVIVED: the one-day tolerance the header argues hardest for was pinned by nothing, so
// widening it to thirty days left the suite green. The boundary is asserted from BOTH sides.
r = run(['--dir', project('two-days-ahead', note('2026-09-21', 5) + '\n' + note('2026-09-19', 302)), '--today', '2026-09-19']);
ok('two days ahead is past the tolerance and is not a release', r.code === 1 && /"2026-09-21" is dated in the future/.test(r.out));

// H7, AND IT IS S233: isRealDate was added because an IMPOSSIBLE date disarmed the cap, and a
// mistyped YEAR is a perfectly valid date, so the same defect survived one axis over. A 305-word
// note under a "## 2027-01-01 placeholder" exited 0 on the placeholder.
r = run(['--dir', project('future-date', note('2027-01-01', 5) + '\n' + note('2026-09-19', 302)), '--today', '2026-09-19']);
ok('a future-dated section does not become the section under test', r.code === 1);
ok('the real note below it is the one measured', /is 30[0-9] words against a cap of 200/.test(r.out));
ok('and the future heading is named rather than dropped in silence', /"2027-01-01" is dated in the future/.test(r.out));

// The tolerance is one day and it is deliberate: a writer up to fourteen hours ahead of UTC is
// not mistyping. Refusing their honest "today" is the writer-and-reader clock disagreement this
// studio has already shipped twice.
r = run(['--dir', project('tomorrow-ok', note('2026-09-20', 5)), '--today', '2026-09-19']);
ok('a section dated one day ahead is still a release, for timezone skew', r.code === 0);

// H8. --dir at a directory with no changelog silently measured the PARENT's, and only the FAILING
// line named a file, so the misdirection was invisible in the direction nobody checks.
const parent = project('nested-parent', note('2026-09-19', 10));
fs.mkdirSync(path.join(parent, 'child'), { recursive: true });
r = run(['--dir', path.join(parent, 'child'), '--today', '2026-09-19']);
ok('the parent fallback still works, because two nested projects rely on it', r.code === 0);
ok('but it now says it fell back and to where', /holds no CHANGELOG\.md, so the one above it is measured/.test(r.out));
ok('and a PASSING run names the file it measured', /nested-parent[\\/]CHANGELOG\.md:1/.test(r.out));

// H9. `--dir` with no value threw ERR_INVALID_ARG_TYPE and exited 1, so a usage mistake was
// reported as an over-cap note. The fragment publishes this invocation to strangers.
r = run(['--dir']);
ok('--dir with no value exits 2, not 1', r.code === 2);
ok('and prints the usage line rather than a stack trace', /--dir needs a directory/.test(r.out) && !/ERR_INVALID_ARG_TYPE/.test(r.out));
r = run(['--today', 'not-a-date']);
ok('--today with a bad value exits 2', r.code === 2 && /--today needs a real/.test(r.out));
r = run(['--today']);
ok('--today with no value exits 2 as well', r.code === 2);
r = run(['--cap', '500']);
ok('--cap is refused rather than silently ignored', r.code === 2 && /not a setting/.test(r.out));

// HALF THE FENCE FIX WAS UNPROVEN AND A REVIEWER FOUND IT BY MUTATION. `opens` refuses a backtick
// opener whose info string contains a backtick, which is CommonMark, and mutating it to `true`
// left the suite at 77 passed 0 failed. The fixture below separates the two readings by EXIT
// CODE: correctly, "``` `` ```" opens nothing and the short newest note passes; under the mutant
// it opens a fence that swallows the newest heading, leaving one 400-word section that refuses.
const falseOpener = '## 2026-09-18 an older note\n\n``` `` ```\n\n' + new Array(400).join('w ') +
  '\n\n## 2026-09-19 the newest note\n\n' + new Array(11).join('w ') + '\n';
r = run(['--dir', project('false-opener', falseOpener), '--today', '2026-09-19']);
ok('a backtick fence whose info string holds a backtick opens nothing', r.code === 0);
ok('so the newest heading below it is still a section', /2026-09-19 is 1[0-9] word\(s\)/.test(r.out));

// Found by the fifth content gate reading. --dir at a FILE named the same path twice, once as
// the directory holding no changelog and once as the changelog found above it.
const fileTarget = path.join(project('dir-is-a-file', note('2026-09-19', 10)), 'CHANGELOG.md');
r = run(['--dir', fileTarget, '--today', '2026-09-19']);
ok('--dir at a file reads that file', r.code === 0 && /is 12 word\(s\)/.test(r.out));
ok('and does not claim it fell back to a parent', !/holds no CHANGELOG\.md/.test(r.out));

const EXPECTED_ASSERTIONS = 79;
console.log((fail ? 'FAIL  ' : 'ok    ') + 'check-release-note.test.js: ' + pass + ' passed, ' + fail + ' failed');
if (pass + fail !== EXPECTED_ASSERTIONS) {
  console.log('FAIL  assertion count is ' + (pass + fail) + ', pinned at ' + EXPECTED_ASSERTIONS +
    '. Update the pin deliberately when you add one.');
  process.exit(1);
}
process.exit(fail ? 1 : 0);
