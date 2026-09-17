#!/usr/bin/env node
'use strict';
/*
 * Tests for archive-sittings.js.
 *
 * This tool rewrites the one artefact the studio treats as the record, unsupervised, so the
 * assertions that matter most are not that it works. They are that it REFUSES, and that what it
 * leaves behind is exactly what it found minus what it proved it had moved.
 *
 * THE ASSERTION THIS SUITE EXISTS FOR is the one about the DURABLE TAIL. A Current state section
 * is dated history followed by live state: which repositories exist, how many roles there are,
 * what the board is. Those paragraphs are bold and look identical to a block's continuation, and
 * archiving them would move facts a session needs today into a file nothing imports. Everything
 * else here is bookkeeping by comparison.
 *
 * Every assertion has been watched failing. A check nobody has seen fail is indistinguishable
 * from one that always passes (S55).
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TOOL = path.join(__dirname, 'archive-sittings.js');
let pass = 0, fail = 0;
function ok (name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL  ' + name); } }

const junk = [];

// A block whose date sits on the SECOND line of its bold header, which is how every real one in
// this project is written and the case a line-wise scan cannot see.
function block (ordinal, date, body) {
  return [
    '**' + ordinal + ' SITTING, AND THE HEADLINE WRAPS ONTO A SECOND LINE BEFORE IT REACHES THE',
    'DATE THAT IDENTIFIES IT. ' + date + ', ' + ordinal + ' sitting.** ' + body,
    '',
    '**A SECOND PARAGRAPH INSIDE THE SAME BLOCK.** ' + body + ' ' + ordinal,
    '',
  ];
}

// A pointer left by an earlier archive that sits INSIDE the dated region rather than after it,
// which is where the real ones sit in this project's own session log. It is the separating input
// for the comma in the opener pattern: "<date> <ORDINAL> sitting" with no comma must read as
// continuation of the block above it, not as a block of its own. Put after the boundary it would
// be excluded by the region rule instead, and the assertion would pass in both worlds.
const INNER_POINTER = [
  '**The 2026-02-10 ELEVENTH sitting block joined them at the TENTH sitting wind-down**, unedited',
  'and in the same order.',
  '',
];

const POINTER = [
  '**Every dated state block up to and including the 2026-01-01 FIRST sitting is now in',
  '[WARM_START-ARCHIVE.md](WARM_START-ARCHIVE.md)**, in this folder, unedited.',
  '',
];
const LOG_POINTER = [
  '**Entries for the session of 2026-01-01, FIRST sitting, and earlier are in',
  '`SESSION-LOG-ARCHIVE.md`**, in this folder, unedited and in the same order.',
  '',
];
const DURABLE = [
  '**Two repositories, in sync.** Private source and public export, released together.',
  '',
  '**Seventeen agent roles**, stack-neutral, composed per project with an overlay.',
  '',
];

const ORD = ['TENTH', 'NINTH', 'EIGHTH', 'SEVENTH', 'SIXTH', 'FIFTH'];
const DAY = ['2026-02-10', '2026-02-09', '2026-02-08', '2026-02-07', '2026-02-06', '2026-02-05'];

function doc (opts) {
  const o = opts || {};
  const n = o.blocks === undefined ? 4 : o.blocks;
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-sit-'));
  junk.push(d);

  let state = [];
  for (let i = 0; i < n; i++) {
    const date = o.ascending ? DAY[n - 1 - i] : DAY[i];
    state = state.concat(block(ORD[i], date, 'state body ' + i));
    if (i === 0 && !o.ascending) state = state.concat(INNER_POINTER);
  }
  if (!o.noPointer) state = state.concat(POINTER);
  state = state.concat(DURABLE);

  let log = [];
  for (let i = 0; i < n; i++) log = log.concat(block(ORD[i], DAY[i], 'log body ' + i));
  if (!o.noPointer) log = log.concat(LOG_POINTER);

  const body = ['# Doc', '', '## Current state', '']
    .concat(state)
    .concat(['---', '', '## Session log', ''])
    .concat(log)
    .concat(['## Prompt to resume this session', '', 'tail text'])
    .join('\n') + '\n';

  const p = path.join(d, 'WARM_START.md');
  fs.writeFileSync(p, body, 'utf8');
  return { dir: d, file: p, lines: body.split('\n') };
}

function run (file, extra) {
  const a = [TOOL, file].concat(extra || []);
  try { return { code: 0, out: execFileSync('node', a, { stdio: ['pipe', 'pipe', 'pipe'] }).toString() }; }
  catch (e) { return { code: e.status, out: ((e.stdout || '') + (e.stderr || '')).toString() }; }
}
const read = p => fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';

// --- a dry run is a dry run ---------------------------------------------------------------------
{
  const { file } = doc();
  const before = read(file);
  const r = run(file);
  ok('a dry run exits clean', r.code === 0);
  ok('and it modifies nothing at all', read(file) === before);
  ok('and it says so rather than looking like it acted', /DRY RUN/.test(r.out));
  // Pinned to the Current state LINE rather than to the whole output. Written loose it was
  // satisfied by the Session log line saying the same thing, so a fault in one section was
  // covered by the other section being fine. Found by a mutation coming back larger than
  // predicted, which is the only reason anybody looked at it.
  ok('and it names the blocks it would keep and move',
     /Current state: .*keep 1 \(TENTH\), archive 3 \(NINTH, EIGHTH, SEVENTH\)/.test(r.out));
}

// --- THE ASSERTION THIS TOOL EXISTS TO EARN: nothing is lost ------------------------------------
{
  const { dir, file, lines } = doc();
  const original = lines.filter(l => l.trim() !== '');
  const r = run(file, ['--write']);
  ok('a write run exits clean', r.code === 0);

  const live = read(file);
  const wa = read(path.join(dir, 'WARM_START-ARCHIVE.md'));
  const sa = read(path.join(dir, 'SESSION-LOG-ARCHIVE.md'));
  const lost = original.filter(l => live.indexOf(l) === -1 && wa.indexOf(l) === -1 && sa.indexOf(l) === -1);
  ok('every original non-blank line survives somewhere', lost.length === 0);

  ok('the current state archive was created', wa.length > 0);
  ok('the session log archive was created', sa.length > 0);
  ok('the oldest state block is out of the loaded document', live.indexOf('state body 3') === -1);
  ok('and it is in the archive instead', wa.indexOf('state body 3') > -1);
  ok('the newest state block stays loaded', live.indexOf('state body 0') > -1);
  ok('the oldest log entry is out of the loaded document', live.indexOf('log body 3') === -1);
  ok('and it is in the session log archive, not the state one',
     sa.indexOf('log body 3') > -1 && wa.indexOf('log body 3') === -1);
}

// --- the durable tail. The reason the boundary rule exists --------------------------------------
{
  const { file } = doc();
  run(file, ['--write']);
  const live = read(file);
  ok('live state after the last dated block is NOT archived',
     /Two repositories, in sync/.test(live) && /Seventeen agent roles/.test(live));
  ok('the pointer left by an earlier archive is not archived either',
     /Every dated state block up to and including/.test(live));
  ok('the section that follows is untouched', /## Prompt to resume this session/.test(live) && /tail text/.test(live));
  ok('and every heading survives',
     /## Current state/.test(live) && /## Session log/.test(live));
}

// --- it leaves a pointer, and the pointer is not decoration -------------------------------------
{
  const { file } = doc();
  run(file, ['--write']);
  const live = read(file);
  ok('the loaded document points at the state archive by name',
     /\[WARM_START-ARCHIVE\.md\]\(WARM_START-ARCHIVE\.md\)/.test(live));
  ok('the pointer names which sittings moved', /NINTH back to SEVENTH sitting state blocks/.test(live));
  ok('the pointer carries the proof, not just the claim',
     /distinct non-blank lines were proved present at the destination/.test(live));
  ok('the pointer says an archived block still binds', /is still binding/.test(live));
  ok('no pointer line is wider than the document it sits in',
     live.split('\n').filter(l => /sitting state blocks were archived/.test(l) || /distinct non-blank lines were proved/.test(l))
         .every(l => l.length <= 98));
}

// --- refusals: each one leaves the source untouched ----------------------------------------------
{
  const { file } = doc({ noPointer: true });
  const before = read(file);
  const r = run(file, ['--write']);
  ok('with nothing marking where history stops, it refuses', r.code === 1);
  ok('and it says nothing was written', /Nothing was written/.test(r.out));
  ok('and it names a remedy that can actually be performed', /--boundary/.test(r.out));
  ok('and the source really is untouched', read(file) === before);
}
{
  // --boundary is one value, so it is taken a section at a time. A section with no marker of its
  // own still refuses, which is why the refusal names the section it refused on.
  const { dir, file } = doc({ noPointer: true });
  const r = run(file, ['--write', '--section', 'Current state', '--boundary', 'Two repositories']);
  ok('naming the boundary makes the same section archivable', r.code === 0);
  const live = read(file);
  ok('and the named paragraph is still live state', /Two repositories, in sync/.test(live));
  ok('and the blocks above it moved', read(path.join(dir, 'WARM_START-ARCHIVE.md')).indexOf('state body 3') > -1);
  ok('and the section that was not named is untouched', live.indexOf('log body 3') > -1);
}
{
  const { dir, file } = doc({ noPointer: true });
  const r = run(file, ['--write', '--boundary', 'Two repositories']);
  ok('a refusal in one section stops the whole run rather than half-doing it', r.code === 1);
  ok('and the refusal names which section it could not read', /"Session log" has dated blocks/.test(r.out));
  ok('so the section that WOULD have worked is still untouched',
     read(file).indexOf('state body 3') > -1 && !fs.existsSync(path.join(dir, 'WARM_START-ARCHIVE.md')));
}
{
  const { file } = doc({ ascending: true });
  const before = read(file);
  const r = run(file, ['--write']);
  ok('dates that rise are refused rather than guessed at', r.code === 1);
  ok('and the refusal says which end could not be established', /no consistent order/.test(r.out));
  ok('and the source is untouched after that refusal', read(file) === before);
}

// --- a no-op is success, deliberately, and not exit 1 (ST-263) -----------------------------------
{
  const { file } = doc({ blocks: 1 });
  const before = read(file);
  const r = run(file, ['--write']);
  ok('nothing to archive exits 0, because a no-op is the healthy case', r.code === 0);
  ok('and it says so in words', /Nothing to archive/.test(r.out));
  ok('and it wrote nothing', read(file) === before);
}

// --- the opener pattern is stricter than it looks, on purpose ------------------------------------
{
  // "2026-01-01 FIRST sitting" with no comma is how an archive pointer reads. Treating it as a
  // block would archive the trail to everything already archived.
  const { dir, file } = doc();
  run(file, ['--write']);
  const wa = read(path.join(dir, 'WARM_START-ARCHIVE.md'));
  ok('a pointer paragraph is never mistaken for a dated block',
     wa.indexOf('Every dated state block up to and including') === -1);
  // The separating assertion. This pointer sits INSIDE the dated region, so only the comma in the
  // opener pattern keeps it attached to the block above it.
  ok('a pointer INSIDE the dated region is not a block of its own, so it stays with the block above',
     read(file).indexOf('ELEVENTH sitting block joined them') > -1);
}
{
  // The date is on the second line of the bold header in every real block in this project.
  const { dir, file } = doc();
  const r = run(file, ['--write']);
  ok('a block whose date wraps onto a second line is still found',
     /Current state: 4 dated block\(s\)/.test(r.out));
  ok('and its body reached the archive',
     read(path.join(dir, 'WARM_START-ARCHIVE.md')).indexOf('state body 1') > -1);
}

// --- keep is respected, and both sections are rewritten in one run --------------------------------
{
  const { dir, file } = doc({ blocks: 5 });
  run(file, ['--write', '--keep', '2']);
  const live = read(file);
  ok('--keep 2 keeps two state blocks', live.indexOf('state body 0') > -1 && live.indexOf('state body 1') > -1);
  ok('and archives the rest', live.indexOf('state body 2') === -1);
  ok('and applies to the log section as well',
     live.indexOf('log body 1') > -1 && live.indexOf('log body 2') === -1);
  const sa = read(path.join(dir, 'SESSION-LOG-ARCHIVE.md'));
  ok('the second splice landed on the right lines, not shifted by the first',
     sa.indexOf('log body 2') > -1 && sa.indexOf('state body 2') === -1);
}

// --- appending to an archive that already exists keeps what is there -------------------------------
{
  const { dir, file } = doc();
  const ap = path.join(dir, 'WARM_START-ARCHIVE.md');
  fs.writeFileSync(ap, '# Current state archive\n\nOLDER CONTENT THAT MUST SURVIVE\n', 'utf8');
  run(file, ['--write']);
  const wa = read(ap);
  ok('an existing archive is appended to, not overwritten', /OLDER CONTENT THAT MUST SURVIVE/.test(wa));
  ok('and the new blocks are in it too', wa.indexOf('state body 3') > -1);
}

// --- usage errors are told apart from refusals ------------------------------------------------------
{
  const r = run(path.join(os.tmpdir(), 'studio-sit-no-such-file.md'), ['--write']);
  ok('a missing file is a usage error, exit 2', r.code === 2);
}
{
  const { file } = doc();
  const r = run(file, ['--keep', '0']);
  ok('--keep 0 is a usage error rather than an empty document', r.code === 2);
}

for (const d of junk) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* leave it */ } }

// ST-266. Every node suite here pins its own total, so a block deleted from this file turns
// it RED rather than quietly shrinking the count. This file shipped without a pin and the
// studio suite's drift notice caught it, which is that notice earning its line: a pin cannot
// see its own deletion, so something outside has to say the pin is written at all (S54, S77).
// The pin assertion counts itself, which is why this is 52 against the 51 the file ran before.
const EXPECTED_ASSERTIONS = 52;
const ranBefore = pass + fail;
ok('the suite ran every assertion: ran ' + (ranBefore + 1) + ' of ' + EXPECTED_ASSERTIONS,
  ranBefore === EXPECTED_ASSERTIONS - 1);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
