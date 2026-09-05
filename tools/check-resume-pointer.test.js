#!/usr/bin/env node
'use strict';
/*
 * Every assertion here has been watched failing, by breaking the checker and confirming this
 * suite goes red. A check nobody has seen fail is indistinguishable from one that always passes,
 * and this file exists because a rule that was only written down got skipped for days.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TOOL = path.join(__dirname, 'check-resume-pointer.js');
let pass = 0, fail = 0;
function ok (name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL  ' + name); } }

let n = 0;
function write (body) {
  const f = path.join(os.tmpdir(), 'studio-resume-' + process.pid + '-' + (n++) + '.md');
  fs.writeFileSync(f, body, 'utf8');
  return f;
}
// Returns { code, out }. The tool exits 1 on a finding, so a throw is the normal path.
function run (file) {
  try {
    const out = execFileSync('node', [TOOL, file], { stdio: ['pipe','pipe','pipe'] }).toString();
    return { code: 0, out: out };
  } catch (e) {
    return { code: e.status, out: ((e.stdout || '') + (e.stderr || '')).toString() };
  }
}

const FENCED = [
  '# WARM_START.md', '', '## Current state', 'Things are fine.', '',
  '## Prompt to resume this session', '', '```', 'You are the session for this project.', '```', ''
].join('\n');

// --- the healthy shape passes -------------------------------------------------------------
{
  const r = run(write(FENCED));
  ok('a fenced prompt with no dated blocks is clean', r.code === 0);
  ok('a clean run says the section exists', /ok\s+a resume section exists/.test(r.out));
}

// --- no resume section at all --------------------------------------------------------------
{
  const r = run(write('# WARM_START.md\n\n## Current state\nNo prompt anywhere.\n'));
  ok('a document with no resume section fails', r.code === 1);
  ok('and says a fresh session is handed nothing', /handed nothing/.test(r.out));
}

// --- a resume section written as bare prose, which is what broke the extraction -------------
{
  const r = run(write([
    'WARM_START.md', '', 'Prompt to resume this session', '',
    'Read the docs and continue. Work from the top.'
  ].join('\n')));
  ok('a prompt with no fenced block fails', r.code === 1);
  ok('and names the fence as the reason', /fence line\(s\)/.test(r.out));
  ok('but still finds the section itself', /ok\s+a resume section exists/.test(r.out));
}

// --- a prose line that begins with the words is not the section, when a real heading exists ---
// A paragraph elsewhere in the document wrapped onto a line starting "resume prompt". With the
// loose matcher alone that line became the section start, the section held no fence, and a
// wind-down was refused for a document whose real prompt was fine. Safe direction, wrong answer.
{
  const r = run(write([
    '# WARM_START.md', '', '## Current state', '',
    'The pointer check refused once, on a wrapped line beginning with the words',
    'resume prompt, which it took as the section heading.', '',
    '## Prompt to resume this session', '', '```', 'You are the session for this project.', '```', ''
  ].join('\n')));
  ok('a wrapped prose line beginning "resume prompt" is not taken as the section', r.code === 0);
  ok('and the section reported is the real heading', /a resume section exists\s+--\s+line 8\b/.test(r.out));
}

// --- the same looseness in the unsafe direction -------------------------------------------
// Prose beginning with the words, then a fenced code sample, then the real heading further down
// with NO fence under it. The loose matcher alone found the sample's fence and passed a document
// whose actual prompt was unextractable.
{
  const r = run(write([
    '# WARM_START.md', '', '## Current state', '',
    'resume prompt handling is shown below as a sample.', '',
    '```', 'a code sample that is not the prompt', '```', '',
    '## Prompt to resume this session', '',
    'Written as prose, so the warm-start skill has nothing to extract.', ''
  ].join('\n')));
  ok('a fence under prose that begins "resume prompt" does not satisfy the check', r.code === 1);
  ok('and the finding is reported against the real heading', /fence line\(s\)/.test(r.out) && /line 11\b/.test(r.out));
}

// --- and the loose form still finds a document whose only heading is unhashed prose ---------
// One warm start on this machine writes its resume heading with no hash at all. Requiring the
// hash would report it as having no resume section: a false FAIL at the moment a wind-down is
// trying to commit state, on a document that is in fact fine.
{
  const r = run(write([
    '# WARM_START.md', '', '## Current state', 'Things are fine.', '',
    'Prompt to resume this session', '', '```', 'You are the session for this project.', '```', ''
  ].join('\n')));
  ok('an unhashed resume heading is still found when no hashed one exists', r.code === 0);
  ok('at its own line', /a resume section exists\s+--\s+line 6\b/.test(r.out));
}

// --- the defect this file was written for --------------------------------------------------
{
  const r = run(write([
    '# WARM_START.md', '',
    'CURRENT AS OF 2026-08-24. Work from THIS block.', 'The new state.', '',
    'WAS CURRENT AS OF 2026-08-19, superseded 2026-08-24. Older record.', 'The old state.', '',
    '## Prompt to resume this session', '', '```',
    'Work from the block headed CURRENT AS OF 2026-08-19 in the Next action section.',
    '```', ''
  ].join('\n')));
  ok('a prompt aimed at a superseded block fails', r.code === 1);
  ok('and quotes the date it was sent to', /2026-08-19/.test(r.out));
  ok('and names the line that demoted it', /marks that superseded at line/.test(r.out));
  ok('and separately reports the newest block', /the newest current block is 2026-08-24/.test(r.out));
}

// --- the same document with the pointer corrected ------------------------------------------
{
  const r = run(write([
    '# WARM_START.md', '',
    'CURRENT AS OF 2026-08-24. Work from THIS block.', 'The new state.', '',
    'WAS CURRENT AS OF 2026-08-19, superseded 2026-08-24. Older record.', '',
    '## Prompt to resume this session', '', '```',
    'Work from the block headed CURRENT AS OF 2026-08-24.',
    '```', ''
  ].join('\n')));
  ok('the corrected pointer passes', r.code === 0);
}

// --- "superseded <date>" must not demote the date it names ---------------------------------
// If it did, the newest block would be read as dead and a correct document would fail. This is
// the false positive that would have made the check worse than useless, because a check that
// cries wolf on healthy documents gets switched off.
{
  const r = run(write([
    '# WARM_START.md', '',
    'CURRENT AS OF 2026-08-24. Work from THIS block.', '',
    'WAS CURRENT AS OF 2026-08-19, superseded 2026-08-24.', '',
    '## Prompt to resume this session', '', '```', 'Work from CURRENT AS OF 2026-08-24.', '```'
  ].join('\n')));
  ok('the date a block was superseded ON is not itself treated as dead', r.code === 0);
}

// --- an older block that was never explicitly demoted --------------------------------------
{
  const r = run(write([
    '# WARM_START.md', '',
    'CURRENT AS OF 2026-08-24. The new state.', '',
    'CURRENT AS OF 2026-08-14. Kept because the record is append-only.', '',
    '## Prompt to resume this session', '', '```', 'Work from CURRENT AS OF 2026-08-14.', '```'
  ].join('\n')));
  ok('a prompt aimed at an older block fails even with no WAS marker', r.code === 1);
  ok('and names both dates', /2026-08-24/.test(r.out) && /2026-08-14/.test(r.out));
}

// --- the section must stop at the next heading ---------------------------------------------
// Otherwise every date in every later section counts as part of the prompt, and a document that
// keeps history after the prompt fails for no reason.
{
  const r = run(write([
    '# WARM_START.md', '',
    'CURRENT AS OF 2026-08-24. The new state.', '',
    'WAS CURRENT AS OF 2026-08-19, superseded 2026-08-24.', '',
    '## Prompt to resume this session', '', '```', 'Work from CURRENT AS OF 2026-08-24.', '```', '',
    '## An appendix kept after the prompt', 'Refers to CURRENT AS OF 2026-08-19 on purpose.', ''
  ].join('\n')));
  ok('a superseded date after the prompt section is not read as the pointer', r.code === 0);
}

// --- a byte order mark carries NO assertion, deliberately ------------------------------------
// The tool strips a leading mark, and removing that strip leaves this suite fully green: the
// heading match already tolerates leading whitespace, and a mark counts as whitespace. So an
// assertion here could never go red. It is recorded rather than written, because a check that
// cannot fail is indistinguishable from one that always passes, and shipping it as proof is
// the exact defect this file exists to stop.

// --- usage and read errors are exit 2, distinct from a finding -------------------------------
{
  const r = run(path.join(os.tmpdir(), 'studio-resume-does-not-exist-' + process.pid + '.md'));
  ok('an unreadable file is exit 2, not a silent pass', r.code === 2);
  ok('and says which file it could not read', /cannot read/.test(r.out));
}

/* Measured: a fatal guard firing part way through the studio suite reported 0 failed
   and exit 0, having run 22 of 214, so a count of failures cannot see an assertion that
   never ran. The total is pinned here, and the number is written down rather than measured
   from the run it checks, because a self-updating total agrees with any run. S35 is the same
   rule applied to the summary. Mutation: delete an assertion above and this goes red alone. */
const EXPECTED_ASSERTIONS = 25;
const ranBefore = pass + fail;
ok('the suite ran every assertion: ran ' + (ranBefore + 1) + ' of ' + EXPECTED_ASSERTIONS
  + '. A block was skipped or deleted. Find out which before you change the number.',
  ranBefore === EXPECTED_ASSERTIONS - 1);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
