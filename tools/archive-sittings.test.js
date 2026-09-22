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

/* ST-281: a fixture root that nothing can collide with and that is removed at EXIT. The junk
 * array below is swept by a top-level statement partway down this file, so anything created by a
 * helper defined AFTER that line is never cleaned up. That is not a hazard, it happened: the
 * receipt fixtures at the foot of this file leaked 2 directories per run and the suite's own
 * residue check caught it at 676 passed 1 failed. Use this rather than mkdtemp plus junk. */
const { fixtureRoot } = require('./tmp-fixtures.js');

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
  // THIS BLOCK USED TO ASSERT THE DEFECT. It checked that --boundary with no --section applied the
  // phrase to every section and refused on whichever one lacked it, which reads as careful and is
  // the hazard: a boundary phrase belongs to ONE section, and the refusal that recommends one names
  // the section it is about. A reviewer obeyed such a refusal literally, ran it without --section,
  // and archived the live tail of a DIFFERENT section into a file nothing imports. --boundary end
  // made it worse, because "this section is history all the way down" is a claim about one section
  // and was being read as a claim about all of them.
  const { dir, file } = doc({ noPointer: true });
  const before = read(file);
  const r = run(file, ['--write', '--boundary', 'Two repositories']);
  ok('--boundary with no --section refuses rather than aiming one section phrase at all of them',
     r.code === 2);
  ok('and it names the flag that makes it safe', /--section/.test(r.out));
  ok('and nothing was written at all',
     read(file) === before && !fs.existsSync(path.join(dir, 'WARM_START-ARCHIVE.md')));
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
// --- THE RECEIPTS ARE ONE PARAGRAPH PER ARCHIVE, NOT ONE PER RUN ------------------------------
// Every archive leaves a receipt saying what moved and how many lines were proved, and the receipt
// NEVER LEAVES. Measured on the real WARM_START.md at the thirty-fifth sitting: 22,756 characters
// of archiver residue, 20.4 per cent of the document, so the only project that had ever archived
// was the only one paying for it. Two defects were found HERE by running it rather than reading it:
// the receipt is wrapped by this same tool so the archive filename lands on line two and matching
// line one found nothing at all; and the filename class [A-Z-]+ matched SESSION-LOG-ARCHIVE.md
// while silently missing WARM_START-ARCHIVE.md, so half consolidated and the run reported success.
function receiptDoc (opts) {
  const o = opts || {};
  const d = fixtureRoot('studio-rcpt');
  const ords = ['THIRTIETH', 'TWENTY-NINTH', 'TWENTY-EIGHTH'];
  const receipt = (ord, arch, noun) => [
    // THE ARCHIVE NAME IS ON LINE TWO ON PURPOSE, because that is where the real ones put it: this
    // tool wraps its own receipts at 98 characters. The first version of this fixture kept the name
    // on line one, and the mutation swapping p.text for all[p.start] then SURVIVED at 69 passed 0
    // failed while reproducing, on the real document, a bug I had already watched happen. A fixture
    // that cannot express the defect proves nothing about the control that fixes it. S245.
    '**The ' + ord + ' sitting ' + noun + ' was archived on 2026-09-20 to',
    '[' + arch + '](' + arch + ')**, unedited and in the same order. 40 of 40',
    'distinct non-blank lines were proved present at the destination and read back from disk before a',
    'byte was removed here (S106), 0 missing. This file is @-imported and an archive is not, so a block',
    'moved out is still binding, exactly like an archived decision: read ' + arch + ' when you are',
    'looking for what an earlier sitting found.',
    '',
  ];
  // WORD FOR WORD WHAT pointerFor GENERATES, and it used to be an abbreviation of it. That was
  // survivable while the consolidation identified a receipt by its first sentence, and it stops
  // being survivable the moment the guard is the WHOLE paragraph: an approximate fixture would
  // then be reported as hand-edited and every assertion about consolidating would pass or fail
  // for a reason unrelated to the one it names.
  let state = ['**2026-09-21, THIRTY-FIRST sitting.** live body.', ''];
  for (const ord of ords) state = state.concat(receipt(ord, 'WARM_START-ARCHIVE.md', 'state block'));
  state = state.concat(['**Durable state that must never be touched.**', '']);
  let log = ['**2026-09-21, THIRTY-FIRST sitting.** log body.', ''];
  for (const ord of ords) log = log.concat(receipt(ord, 'SESSION-LOG-ARCHIVE.md', 'session log entry'));

  fs.writeFileSync(path.join(d, 'WARM_START.md'),
    ['# Doc', '', '## Current state', ''].concat(state)
      .concat(['---', '', '## Session log', '']).concat(log)
      .concat(['## Prompt to resume this session', '', 'tail text']).join('\n') + '\n', 'utf8');
  const holds = o.archiveMissingOrdinal ? ords.slice(0, 2) : ords;
  for (const a of ['WARM_START-ARCHIVE.md', 'SESSION-LOG-ARCHIVE.md']) {
    fs.writeFileSync(path.join(d, a), holds.map(x => '## ' + x + ' sitting\n\nbody\n').join('\n'), 'utf8');
  }
  return { dir: d, file: path.join(d, 'WARM_START.md') };
}

{
  const { file } = receiptDoc();
  const before = fs.readFileSync(file, 'utf8');
  const dry = run(file, []);
  ok('a document with nothing to archive still reports the receipts it can consolidate',
    /receipt\(s\) consolidated to 1/.test(dry.out));
  ok('and a dry run changes nothing', fs.readFileSync(file, 'utf8') === before);
  /* The wording lost its shouted EVERY when all three saving lines moved through savingLine, which
     is what makes a negative saving say so instead of printing a minus sign. Updated rather than
     loosened: it still requires the figure and the per-request framing, which is the claim. */
  ok('and it says what the consolidation is worth, in characters off every request',
    /\d+ off every request/.test(dry.out));

  const r = run(file, ['--write']);
  const after = fs.readFileSync(file, 'utf8');
  const receipts = after.split('\n').filter(l => /sitting [a-z ]+ was archived on/.test(l));
  ok('after the write no per-run receipt is left', receipts.length === 0);
  ok('WARM_START-ARCHIVE receipts consolidate, which the filename class once silently missed',
    /Sitting blocks for the THIRTIETH back to the TWENTY-EIGHTH sittings were archived to \[WARM_START-ARCHIVE/.test(after.replace(/\n/g, ' ')));
  ok('and SESSION-LOG-ARCHIVE receipts consolidate too, as their own group',
    /Sitting blocks for the THIRTIETH back to the TWENTY-EIGHTH sittings were archived to \[SESSION-LOG-ARCHIVE/.test(after.replace(/\n/g, ' ')));
  ok('the consolidated receipt still says a moved block is BINDING, which is the only part a later '
    + 'session has to act on', /still binding/.test(after));
  ok('durable state next to the receipts is untouched',
    after.includes('**Durable state that must never be touched.**'));
  ok('the live sitting block is untouched', after.includes('live body.'));
  ok('prose after the sections is untouched', after.includes('tail text'));
  /* Wording moved when this third call site was routed through savingLine, which is what makes a
     negative saving say so instead of printing a minus sign. Updated rather than loosened: it
     still requires a figure and the per-request framing, which is the claim. */
  ok('and the run reports the saving it actually made', /\d+ off every request/.test(r.out));
  ok('and it exits clean', r.code === 0);
  ok('the document got smaller', after.length < before.length);
}

{
  // PROVE IT BEFORE REMOVING IT. A receipt naming a sitting the archive does not hold is the only
  // trail to that sitting, so it stays. Same protection a decision row gets, and the same reason.
  const { file } = receiptDoc({ archiveMissingOrdinal: true });
  const r = run(file, ['--write']);
  const after = fs.readFileSync(file, 'utf8');
  ok('a receipt naming a sitting absent from the archive is NOT consolidated',
    after.includes('The TWENTY-EIGHTH sitting state block was archived on'));
  ok('and the run says so rather than doing it silently', /NOT consolidated/.test(r.out));
  // Pinned to the refusal LINE and not to the whole output. Written loose as /TWENTY-EIGHTH/ it was
  // satisfied by any other mention anywhere, and it survived the mutation that removed the guard.
  ok('and it names the ordinal it could not find, on the line that reports the refusal',
    /NOT consolidated, TWENTY-EIGHTH absent from the archive/.test(r.out));
  ok('and the group that IS provable is unaffected by the group that is not',
    /SESSION-LOG-ARCHIVE\.md: 3 receipt\(s\) NOT consolidated/.test(r.out) ||
    /WARM_START-ARCHIVE\.md: 3 receipt\(s\) NOT consolidated/.test(r.out));
}

// --- THE SECOND DATE CONVENTION, WHICH IS EVERY PROJECT THAT IS NOT THIS ONE --------------------
// Measured 2026-09-20 under ST-294. The bold "<date>, <ORDINAL> sitting" opener is how _STUDIO
// writes history and how NO other project does. A sibling project's Session log was 217,682
// characters, 89 per cent of its WARM_START.md, written as unbolded paragraphs opening
// "2026-09-20 (" and "2026-09-19, evening (". The tool matched 0 of 78 and said "nothing to
// archive" about a quarter-megabyte of dated history, which is S219: a check that never fires and
// a check with nothing to report are byte-identical from the outside.
{
  const d = fixtureRoot('studio-datefmt');
  const file = path.join(d, 'WARM_START.md');
  const entry = (date, body) => [date + ' (' + body + '): first line of the entry.', '',
    'A second paragraph inside the same entry, ' + body + '.', ''];
  const log = entry('2026-09-20', 'newest')
    .concat(entry('2026-09-19, evening', 'second'))
    .concat(entry('2026-09-19, afternoon', 'third'))
    .concat(entry('2026-09-18', 'fourth'))
    .concat(['Live state that is NOT dated history and must never move.', '']);
  fs.writeFileSync(file, ['# Doc', '', '## Session log', ''].concat(log)
    .concat(['## Prompt to resume this session', '', 'tail text']).join('\n') + '\n', 'utf8');

  const dry = run(file, ['--section', 'Session log', '--boundary', 'Live state that is NOT']);
  ok('a bare dated paragraph is recognised as a block, which the bold-ordinal pattern never was',
    /Session log: 4 dated block\(s\)/.test(dry.out));
  ok('and the block is named by its date, because there is no ordinal to name it with',
    /keep 1 \(2026-09-20\)/.test(dry.out));
  /* THIS ASSERTION USED TO PIN THE DEFECT. It required the name to be "2026-09-19 evening", the
     comma-dropped rebuild, which is a string the archive can never hold because the document wrote
     a comma. So the one check covering this convention demanded exactly the value that made the
     receipt proof fail, and reading it agreed with it. S256: a check encodes a belief, and when the
     belief is wrong the check becomes a machine for reinstating it. ST-302 HIGH 3. */
  ok('and a time-of-day word after the comma is carried AS THE DOCUMENT WROTE IT, so two sittings '
    + 'in one day stay distinct',
    /2026-09-19, evening/.test(dry.out) && /2026-09-19, afternoon/.test(dry.out));
  ok('and the comma is NOT dropped, because the name is looked up in the archive and the archive '
    + 'holds the original',
    !/2026-09-19 evening/.test(dry.out));

  const r = run(file, ['--section', 'Session log', '--boundary', 'Live state that is NOT', '--write']);
  // read(), not fs.readFileSync. The mutation that removes the date convention stops the archive
  // from being created at all, and an unguarded read then throws and takes the whole suite down
  // mid-file. The harness reports that as 0 failed, which is byte-identical to a surviving mutant.
  // A test that CRASHES under a mutation proves nothing about the control it names.
  const live = read(file);
  const arch = read(path.join(d, 'SESSION-LOG-ARCHIVE.md'));
  ok('the write exits clean', r.code === 0);
  ok('the newest dated entry stays loaded', live.includes('newest'));
  ok('the older ones are out of the loaded document', !live.includes('fourth'));
  ok('and they are in the archive instead', arch.includes('fourth') && arch.includes('third'));
  ok('a second paragraph belonging to an archived entry goes with it, not left orphaned',
    arch.includes('A second paragraph inside the same entry, fourth.'));
  ok('LIVE STATE AFTER THE LAST DATED ENTRY IS NOT ARCHIVED, which is the assertion this whole '
    + 'boundary rule exists for', live.includes('Live state that is NOT dated history'));
  ok('the section that follows is untouched', live.includes('tail text'));
  ok('the receipt it leaves names the dated blocks it moved',
    /2026-09-18/.test(live) && /archived on/.test(live));
}

{
  // A DATE INSIDE A SENTENCE IS NOT A BLOCK. The pattern is anchored at the first character of the
  // paragraph for exactly this reason: unanchored it would cut a document at any sentence that
  // happens to mention a date, and the pointer paragraphs left by earlier archives would match too.
  const d = fixtureRoot('studio-datemid');
  const file = path.join(d, 'WARM_START.md');
  fs.writeFileSync(file, ['# Doc', '', '## Session log', '',
    '2026-09-20 (newest): the only real entry.', '',
    'On 2026-09-19 we shipped the thing, and that sentence is not a block header.', '',
    'Nothing here opens with a date either.', '',
    'Live state that is NOT dated history.', '',
    '## Prompt to resume this session', '', 'tail text'].join('\n') + '\n', 'utf8');
  const r = run(file, ['--section', 'Session log', '--boundary', 'Live state that is NOT']);
  ok('a date in the middle of a sentence does not start a block',
    /1 dated block\(s\)/.test(r.out) || /nothing to archive/i.test(r.out));
  ok('and nothing was written on a dry run either way',
    !fs.existsSync(path.join(d, 'SESSION-LOG-ARCHIVE.md')));
}

// --- TEN SITTINGS IN A ROW, WHICH IS THE ONLY SHAPE THAT SHOWS ACCUMULATION ---------------------
// EVERY OTHER BLOCK IN THIS FILE BUILDS A FRESH FIXTURE AND RUNS THE TOOL ONCE, and the whole
// receipt change is about behaviour ACROSS RUNS. archive-decisions.test.js runs its tool three
// times and asserts the pointer count stays 1, which is exactly why the decisions side was right
// and this side was not: the consolidation was called from one branch taken only when there is
// nothing to archive, so it never ran at a real wind-down, and ten simulated sittings grew the
// document while archiving it. A fix that runs only in the corner case reads as a fix. S250.
{
  const ORDS = ['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'SIXTH', 'SEVENTH', 'EIGHTH',
                'NINTH', 'TENTH', 'ELEVENTH', 'TWELFTH', 'THIRTEENTH', 'FOURTEENTH'];
  const d = fixtureRoot('studio-sit-across');
  const file = path.join(d, 'WARM_START.md');

  // A sitting written the way a wind-down writes one: the date lands on the second line.
  const sitting = (n) => [
    '**A HEADLINE THAT WRAPS ONTO A SECOND LINE BEFORE IT REACHES THE DATE THAT NAMES IT.',
    '2026-03-' + String(n + 1).padStart(2, '0') + ', ' + ORDS[n] + ' sitting.** body ' + n + '.',
    '',
  ];

  const tail = POINTER.concat(DURABLE).concat(['## Prompt to resume this session', '', 'tail text']);
  fs.writeFileSync(file, ['# Doc', '', '## Current state', '']
    .concat(sitting(3), sitting(2), sitting(1), sitting(0), tail).join('\n') + '\n', 'utf8');

  // Both shapes count: the per-archive receipt this tool writes, and the consolidated paragraph
  // it replaces them with. Counting only the first would report success the moment the tool
  // stopped recognising its own output, which is the second defect this block exists to catch.
  // COUNTED ON THE PARAGRAPH, NOT THE LINE. This tool wraps what it writes at 98 characters, so
  // the archive filename that identifies a receipt routinely lands on the line after the verb.
  // Counted line-wise this read 0 against a document holding exactly 1, and the assertion failed
  // against a tool that was already correct.
  const receipts = (t) => {
    const flat = t.replace(/\s+/g, ' ');
    return (flat.match(/archived on \d{4}-\d\d-\d\d to \[WARM_START-ARCHIVE/g) || []).length
         + (flat.match(/sittings were archived to \[WARM_START-ARCHIVE/g) || []).length;
  };

  const size = [];
  let broke = '';
  for (let n = 4; n < 14; n++) {
    const cur = read(file).split('\n');
    const at = cur.indexOf('## Current state') + 2;
    fs.writeFileSync(file, cur.slice(0, at).concat(sitting(n), cur.slice(at)).join('\n'), 'utf8');
    const r = run(file, ['--section', 'Current state', '--write']);
    if (r.code !== 0 && !broke) broke = 'sitting ' + n + ' exited ' + r.code + ': ' + r.out.slice(0, 160);
    size.push(read(file).length);
  }

  const live = read(file);
  ok('ten sittings in a row each archive cleanly' + (broke ? ', got ' + broke : ''), broke === '');
  ok('and they leave ONE archive receipt behind, not ten', receipts(live) === 1);
  // The document is archived on every one of those runs, so it must not be BIGGER at the end than
  // it was near the beginning. Measured against the third run rather than the first because the
  // first archives three blocks at once and the steady state is one.
  ok('and the loaded document does not GROW while it is being archived',
     size[size.length - 1] - size[2] < 400);
}

// --- PROSE APPENDED TO A RECEIPT IS SOMEBODY'S WRITING, NOT THE TOOL'S ---------------------------
// CRITICAL. The consolidation identified a receipt by matching the HEAD of the paragraph and then
// dropped every LINE of it, so a sentence a human added to the end was deleted into no archive
// while the run reported success. The tool's own header five lines above promises the opposite:
// that it only touches receipts it wrote.
{
  const d = fixtureRoot('studio-sit-byhand');
  const file = path.join(d, 'WARM_START.md');
  const A = 'WARM_START-ARCHIVE.md';
  // The exact sentence this tool generates, so the fixture cannot pass by being unrecognisable.
  const receipt = (ord, date) => '**The ' + ord + ' sitting state block was archived on ' + date +
    ' to [' + A + '](' + A + ')**, unedited and in the same order. 9 of 9 distinct non-blank lines ' +
    'were proved present at the destination and read back from disk before a byte was removed here ' +
    '(S106), 0 missing. This file is @-imported and an archive is not, so a block moved out is ' +
    'still binding, exactly like an archived decision: read ' + A + ' when you are looking for ' +
    'what an earlier sitting found.';
  const HUMAN = 'AND A HUMAN ADDED THIS SENTENCE AFTERWARDS, WHICH NO ARCHIVE HOLDS.';

  fs.writeFileSync(file, ['# Doc', '', '## Current state', '',
    '**THE ONLY LIVE BLOCK. 2026-03-09, NINTH sitting.** body.', '',
    receipt('EIGHTH', '2026-03-08'), '',
    receipt('SEVENTH', '2026-03-07') + ' ' + HUMAN, '',
    receipt('SIXTH', '2026-03-06'), '',
    'Live state that is NOT dated history.', '',
    '## Prompt to resume this session', '', 'tail text'].join('\n') + '\n', 'utf8');
  fs.writeFileSync(path.join(d, A), 'EIGHTH SEVENTH SIXTH all present in the archive.\n', 'utf8');

  const r = run(file, ['--section', 'Current state', '--write']);
  const live = read(file);
  ok('a run over an edited receipt still exits clean', r.code === 0);
  ok('PROSE APPENDED TO A RECEIPT IS NOT DELETED', live.indexOf(HUMAN) > -1);
  // PINNED TO THE WORD THE TOOL ACTUALLY PRINTS. Written as /edited|left alone/ it was satisfied
  // by the fixture's own directory name appearing in the tool's first output line, so it passed
  // on a run that had just deleted the sentence above. A check nobody has watched fail and a
  // check that cannot fail are the same thing (S242).
  ok('and the tool REPORTS leaving it alone rather than doing it silently',
     /HAND-EDITED/.test(r.out));
}

// --- A DATE THAT OPENS A LIVE FACT IS NOT A SITTING BLOCK ----------------------------------------
// The bold pattern carries a comma as a real discriminator. The anchored date pattern carried
// none, so any paragraph opening with a date read as a block. A live line dated the same day as
// the newest block therefore became block one, was KEPT because it sorts first, and pushed the
// genuinely newest block out into the archive. That decides what gets moved out of somebody's
// record, so the pattern now requires a separator after the date rather than a word.
{
  const d = fixtureRoot('studio-sit-livedate');
  const file = path.join(d, 'WARM_START.md');
  const NEWEST = 'the newest sitting block, which must NOT be archived.';
  const LIVE = '2026-03-05 is the day the board reached 295 live, and this is live state.';
  fs.writeFileSync(file, ['# Doc', '', '## Session log', '',
    LIVE, '',
    '2026-03-05, morning (' + NEWEST + ')', '',
    '2026-03-04 (an older sitting block.)', '',
    '2026-03-03 (an older sitting block still.)', '',
    'Live state that is NOT dated history.', '',
    '## Prompt to resume this session', '', 'tail text'].join('\n') + '\n', 'utf8');

  const r = run(file, ['--section', 'Session log', '--boundary', 'Live state that is NOT', '--write']);
  const live = read(file);
  ok('a dated LIVE line does not displace the newest block into the archive', live.indexOf(NEWEST) > -1);
  ok('and the live line itself is still in the loaded document', live.indexOf(LIVE) > -1);
  ok('and the run did not fail while getting that right', r.code === 0 || /REFUSED/.test(r.out));
}
// --- A THIRD DATE CONVENTION, WHICH IS WHAT MAKES THIS TOOL USABLE ANYWHERE ----------------------
// A sibling project's "## Build status" is 94,965 characters across 244 paragraphs, and its entry
// headings open "Added 2026-09-20 AT THE CLOSE, and it SUPERSEDES every commit count below it".
// The bold ordinal pattern cannot see it and the anchored date pattern cannot either, because the
// date is not at the first character. Reachable by this tool as it stood: none of it. S249.
{
  const d = fixtureRoot('studio-sit-lead');
  const file = path.join(d, 'WAYS_OF_WORKING.md');
  const KEEP = 'the newest entry, which must stay loaded.';
  const CONT = 'A CONTINUATION PARAGRAPH that belongs to the newest entry and goes nowhere.';
  fs.writeFileSync(file, ['# Doc', '', '## Build status', '',
    'Added 2026-03-05 AT THE CLOSE, and it SUPERSEDES every count below it. ' + KEEP, '',
    CONT, '',
    'Added 2026-03-04, and it supersedes every count below it. middle body.', '',
    'Added 2026-03-03, and it supersedes every count below it. oldest body.', '',
    'Live state that is NOT dated history.', '',
    '## Next', '', 'tail text'].join('\n') + '\n', 'utf8');

  const r = run(file, ['--section', 'Build status', '--archive', 'BUILD-STATUS-ARCHIVE.md',
    '--opener', 'lead:Added', '--noun', 'build status entry',
    '--boundary', 'Live state that is NOT', '--write']);
  const live = read(file);
  const arch = read(path.join(d, 'BUILD-STATUS-ARCHIVE.md'));
  const flat = live.replace(/\s+/g, ' ');
  ok('a lead-word convention finds blocks neither built-in convention can see', r.code === 0 &&
     arch.indexOf('middle body') > -1 && arch.indexOf('oldest body') > -1);
  ok('and the newest entry and its continuation both stay loaded',
     live.indexOf(KEEP) > -1 && live.indexOf(CONT) > -1);
  // THE PLURAL IS WRITTEN INTO SOMEBODY ELSE'S DOCUMENT AND STAYS THERE. noun + 's' would have
  // put "build status entrys" in a sibling project's record, permanently, by the tool whose
  // whole claim is that it does not damage what it edits.
  ok('and the receipt speaks the section own words rather than calling it a sitting',
     /build status entries were archived on/.test(flat) && live.indexOf('entrys') === -1);
}

// --- A PROJECT DESCRIBES ITS OWN SECTIONS, AND A BROKEN DESCRIPTION REFUSES ----------------------
{
  const d = fixtureRoot('studio-sit-config');
  const file = path.join(d, 'WAYS_OF_WORKING.md');
  const body = ['# Doc', '', '## Build status', '',
    'Added 2026-03-05, and it supersedes every count below it. newest body.', '',
    'Added 2026-03-04, and it supersedes every count below it. older body.', '',
    'Live state that is NOT dated history.', '',
    '## Next', '', 'tail text'].join('\n') + '\n';
  fs.writeFileSync(file, body, 'utf8');
  const cfg = path.join(d, '.studio-archive.json');
  fs.writeFileSync(cfg, JSON.stringify({ sections: [{ heading: 'Build status',
    archive: 'BUILD-STATUS-ARCHIVE.md', noun: 'build status entry', opener: 'lead:Added',
    boundary: 'Live state that is NOT' }] }), 'utf8');

  const r = run(file, ['--write']);
  ok('a project config replaces the built-in sections with its own', r.code === 0 &&
     read(path.join(d, 'BUILD-STATUS-ARCHIVE.md')).indexOf('older body') > -1);

  // A TOOL THAT FALLS BACK TO ITS DEFAULTS WHEN A PROJECT'S CONFIGURATION IS BROKEN ARCHIVES THE
  // WRONG SECTION AND REPORTS SUCCESS, which is the same shape as every other defect in this file.
  fs.writeFileSync(file, body, 'utf8');
  fs.writeFileSync(cfg, '{ this is not json', 'utf8');
  const bad = run(file, ['--write']);
  ok('a config that is not readable JSON refuses rather than guessing', bad.code === 2);
  ok('and it names the file instead of silently using the built-in defaults',
     /\.studio-archive\.json/.test(bad.out) && read(file) === body);
}

// --- A SECTION NOBODY HAS DESCRIBED YET, FROM THE COMMAND LINE -----------------------------------
// Every rollout starts with one document nobody has written a config for, so the tool has to be
// usable before it is configured or the config never gets written.
{
  const d = fixtureRoot('studio-sit-adhoc');
  const file = path.join(d, 'NOTES.md');
  fs.writeFileSync(file, ['# Doc', '', '## Rounds', '',
    '2026-03-05 (the newest round, which stays.)', '',
    '2026-03-04 (an older round.)', '',
    'Live state that is NOT dated history.', '',
    '## Next', '', 'tail text'].join('\n') + '\n', 'utf8');
  const r = run(file, ['--section', 'Rounds', '--archive', 'ROUNDS-ARCHIVE.md', '--noun', 'round',
    '--boundary', 'Live state that is NOT', '--write']);
  ok('a section nothing has described is archivable from the command line', r.code === 0 &&
     read(path.join(d, 'ROUNDS-ARCHIVE.md')).indexOf('an older round') > -1 &&
     read(file).indexOf('the newest round, which stays') > -1);

  const miss = run(file, ['--section', 'Nothing Called This', '--write']);
  ok('and an unnamed section refuses while saying how to describe one',
     miss.code === 2 && /--archive/.test(miss.out));
}

// --- THE RECEIPTS THIS PROJECT ALREADY CARRIES MUST STILL BE RECOGNISED --------------------------
// Generalising the wording is a migration, not a rewrite: WARM_START.md holds receipts in both
// shapes written by earlier versions of this tool. A pattern that stops matching them does not
// fail loudly, it simply consolidates nothing and lets residue accumulate again in silence, which
// is the defect being fixed reintroduced by the fix.
{
  const d = fixtureRoot('studio-sit-legacy');
  const file = path.join(d, 'WARM_START.md');
  const A = 'WARM_START-ARCHIVE.md';
  const tailOf = () => 'This file is @-imported and an archive is not, so a block moved out is ' +
    'still binding, exactly like an archived decision: read ' + A + ' when you are looking for ' +
    'what an earlier sitting found.';
  const legacySingle = (ord) => '**The ' + ord + ' sitting state block was archived on 2026-09-21 ' +
    'to [' + A + '](' + A + ')**, unedited and in the same order. 68 of 68 distinct non-blank lines ' +
    'were proved present at the destination and read back from disk before a byte was removed here ' +
    '(S106), 0 missing. ' + tailOf();
  const legacyGroup = '**Sitting blocks for the THIRTY-THIRD back to the NINETEENTH sittings were ' +
    'archived to [' + A + '](' + A + ')**, unedited and in the same order, every distinct non-blank ' +
    'line proved present at the destination and read back from disk before a byte was removed here ' +
    '(S106). ' + tailOf();

  fs.writeFileSync(path.join(d, A), 'THIRTY-FOURTH THIRTY-THIRD NINETEENTH all present.\n', 'utf8');
  fs.writeFileSync(file, ['# Doc', '', '## Current state', '',
    '**THE ONLY LIVE BLOCK. 2026-09-22, THIRTY-SIXTH sitting.** body.', '',
    legacySingle('THIRTY-FOURTH'), '',
    legacyGroup, '',
    'Live state that is NOT dated history.', '',
    '## Prompt to resume this session', '', 'tail text'].join('\n') + '\n', 'utf8');

  const r = run(file, ['--section', 'Current state', '--write']);
  const flat = read(file).replace(/\s+/g, ' ');
  ok('both receipt shapes already in this project are still recognised', r.code === 0 &&
     /1 \(THIRTY-FOURTH back to NINETEENTH\)/.test(r.out));
  ok('and the two collapse to exactly one paragraph',
     (flat.match(/archived on 2026/g) || []).length === 0 &&
     (flat.match(/were archived to \[WARM_START-ARCHIVE/g) || []).length === 1);
}
// --- TWO REFUSALS THE FIRST DRAFT SHIPPED WITH NO TEST AT ALL ------------------------------------
// Found by asking which of the new controls a mutation could remove without reddening anything,
// rather than by reading the diff. Both are refusals, which is the half of this tool that matters:
// what it declines to do unsupervised is worth more than what it does.
{
  const d = fixtureRoot('studio-sit-refusals');
  const file = path.join(d, 'WAYS_OF_WORKING.md');
  const body = ['# Doc', '', '## Rounds', '',
    '2026-03-05 (the newest round.)', '',
    '2026-03-04 (an older round.)', '',
    'Live state that is NOT dated history.', '',
    '## Next', '', 'tail text'].join('\n') + '\n';
  fs.writeFileSync(file, body, 'utf8');

  // THE ARCHIVE FILENAME IS PART OF THE CONTRACT, not decoration. The receipt left behind is found
  // again by a pattern that expects capitals and .md, so a section pointed at 'notes.txt' would
  // archive once and then never have its receipt recognised, and residue would accrue in silence.
  const badName = run(file, ['--section', 'Rounds', '--archive', 'rounds.txt', '--write']);
  ok('an archive filename the receipt pattern could never find again refuses',
     badName.code === 2 && read(file) === body);

  const badConv = run(file, ['--section', 'Rounds', '--archive', 'ROUNDS-ARCHIVE.md',
    '--opener', 'whatever-i-felt-like', '--write']);
  ok('an opener convention that does not exist refuses and names the ones that do',
     badConv.code === 2 && /lead:/.test(badConv.out) && read(file) === body);
}
// --- A SECTION THAT IS HISTORY ALL THE WAY DOWN --------------------------------------------------
// The boundary rule exists because live state sits under the dated blocks in this project's own
// documents and looks identical to them. A sibling's "## Build status" has no live tail at all:
// 244 dated paragraphs and then the next heading. Found by running the dry run against the real
// file, which reported nothing to archive about 94,965 characters. Reading the code would not
// have shown it and neither would any fixture written by the person who wrote the rule.
{
  const d = fixtureRoot('studio-sit-toend');
  const file = path.join(d, 'WAYS_OF_WORKING.md');
  const body = ['# Doc', '', '## Build status', '',
    'Added 2026-03-05, and it supersedes every count below it. newest body.', '',
    'Added 2026-03-04, and it supersedes every count below it. middle body.', '',
    'Added 2026-03-03, and it supersedes every count below it. oldest body.', '',
    '## Risks', '', 'a different section entirely'].join('\n') + '\n';

  fs.writeFileSync(file, body, 'utf8');
  const refused = run(file, ['--section', 'Build status', '--archive', 'BUILD-STATUS-ARCHIVE.md',
    '--opener', 'lead:Added', '--noun', 'build status entry', '--write']);
  ok('with no boundary the tool still refuses rather than guessing where history stops',
     refused.code === 1 && read(file) === body && /--boundary end/.test(refused.out));

  fs.writeFileSync(file, body, 'utf8');
  const r = run(file, ['--section', 'Build status', '--archive', 'BUILD-STATUS-ARCHIVE.md',
    '--opener', 'lead:Added', '--noun', 'build status entry', '--boundary', 'end', '--write']);
  const live = read(file);
  const arch = read(path.join(d, 'BUILD-STATUS-ARCHIVE.md'));
  ok('and --boundary end archives a section that runs to the next heading', r.code === 0 &&
     arch.indexOf('middle body') > -1 && arch.indexOf('oldest body') > -1);
  ok('while the newest entry and the section after it are both untouched',
     live.indexOf('newest body') > -1 && live.indexOf('a different section entirely') > -1 &&
     live.indexOf('oldest body') === -1);
}
// --- TWO SECTIONS OVER THE SAME LINES, WHICH TRUNCATED THE DOCUMENT AND CALLED IT A SAVING -------
// A reviewer found this in the generalisation the same day it was written. The splices run bottom
// up so an earlier one cannot move indices a later one holds, which protects regions that do not
// overlap and is nothing at all for regions that do: both plans index the ORIGINAL array, so the
// second splice runs against an array the first already shortened. Observed before the fix: exit
// 0, a character saving printed as success, and 11 lines gone into no archive including every
// live-state line, the next heading and the tail of the file.
{
  const d = fixtureRoot('studio-sit-overlap');
  const file = path.join(d, 'WAYS_OF_WORKING.md');
  // EIGHT ROUNDS, NOT THREE, AND THE COUNT IS LOAD-BEARING. With three, the replacement the first
  // splice writes is LONGER than the region it replaces, so the second splice garbles the document
  // without losing a line, and the end-to-end net has nothing to find. That version of this fixture
  // caught the overlap and could not have caught the data loss the overlap causes, which is a
  // fixture that cannot express the defect it is named after. With eight the region SHRINKS, the
  // second splice reads past its own end, and the tail of the file is destroyed.
  const rounds = [];
  for (let n = 12; n >= 5; n--) rounds.push('2026-03-' + n + ' (round ' + n + ', dated history.)', '');
  const body = ['# Doc', '', '## Rounds', ''].concat(rounds).concat([
    'LIVE STATE that is NOT dated history and is in no archive.', '',
    '## Next', '', 'tail text']).join('\n') + '\n';
  fs.writeFileSync(file, body, 'utf8');
  // DIFFERING ONLY IN CASE, because sectionRange matches case-insensitively, so this is the same
  // section twice and is the disguise the fault would have travelled in.
  fs.writeFileSync(path.join(d, '.studio-archive.json'), JSON.stringify({ sections: [
    { heading: 'Rounds', archive: 'A-ARCHIVE.md', noun: 'round', boundary: 'LIVE STATE that is NOT' },
    { heading: 'rounds', archive: 'B-ARCHIVE.md', noun: 'round', boundary: 'LIVE STATE that is NOT' },
  ] }), 'utf8');

  const r = run(file, ['--write']);
  ok('two sections resolving to the same lines refuse rather than rewriting them twice',
     r.code === 1 && /resolve to the same lines/.test(r.out));
  ok('and the document is byte-identical afterwards', read(file) === body);
}

// --- A SENTENCE IN THE MIDDLE OF A RECEIPT IS STILL SOMEBODY'S WRITING ---------------------------
// The first version of this guard matched the HEAD and the TAIL and left the middle free, then
// dropped the whole paragraph anyway. It caught the case that had been reported and not the case
// it claimed to cover, which is an error in the direction that flatters the fix. The guard is now
// the whole paragraph, anchored at both ends, so anything added anywhere fails to match.
{
  const d = fixtureRoot('studio-sit-midreceipt');
  const file = path.join(d, 'WARM_START.md');
  const A = 'WARM_START-ARCHIVE.md';
  const HUMAN = 'CORRECTION: the oldest block was REDACTED BY HAND and is in no archive.';
  const head = (ord, date) => '**The ' + ord + ' sitting state block was archived on ' + date +
    ' to [' + A + '](' + A + ')**, unedited and in the same order. ';
  const rest = 'distinct non-blank lines were proved present at the destination and read back from ' +
    'disk before a byte was removed here (S106), 0 missing. This file is @-imported and an archive ' +
    'is not, so a block moved out is still binding, exactly like an archived decision: read ' + A +
    ' when you are looking for what an earlier sitting found.';

  fs.writeFileSync(path.join(d, A), 'EIGHTH SEVENTH SIXTH all present.\n', 'utf8');
  fs.writeFileSync(file, ['# Doc', '', '## Current state', '',
    '**THE ONLY LIVE BLOCK. 2026-03-09, NINTH sitting.** body.', '',
    head('EIGHTH', '2026-03-08') + '9 of 9 ' + rest, '',
    // THE INSERTION IS BETWEEN THE FIRST SENTENCE AND THE COUNT, so head and tail both still match.
    head('SEVENTH', '2026-03-07') + HUMAN + ' 9 of 9 ' + rest, '',
    head('SIXTH', '2026-03-06') + '9 of 9 ' + rest, '',
    'Live state that is NOT dated history.', '',
    '## Prompt to resume this session', '', 'tail text'].join('\n') + '\n', 'utf8');

  const r = run(file, ['--section', 'Current state', '--write']);
  const live = read(file);
  ok('a sentence inserted in the MIDDLE of a receipt is not deleted', live.indexOf(HUMAN) > -1);
  ok('and it is reported rather than dropped silently', /HAND-EDITED/.test(r.out) && r.code === 0);
  ok('while the two untouched receipts still consolidate',
     /2 receipt\(s\) consolidated to 1/.test(r.out));
}
// --- EVERY SHAPE OF LIVE SENTENCE THAT OPENS WITH A DATE -----------------------------------------
// The first fixture written for this used ONE shape, a date followed by a word, and the guard
// caught that one. A reviewer archived live state through four others. The shapes below are that
// list plus the comma, which is the mutation my own comment argued against and which no assertion
// could see. A colon, a full stop and a dash are all things a SENTENCE puts after a date; an
// opening bracket is not, and it is what both real conventions in the estate use.
{
  const SHAPES = {
    word:  '2026-03-06 is the day the board reached 295 live, and this is live state.',
    stop:  '2026-03-06. The board reached 295 live, and this is a sentence about it.',
    colon: '2026-03-06: the board reached 295 live, and this is a sentence about it.',
    dash:  '2026-03-06 - the board reached 295 live, and this is a sentence about it.',
    range: '2026-03-06 to 2026-03-09 was the week the board reached 295 live.',
    comma: '2026-03-06, the board reached 295 live, and this is a sentence about it.',
  };
  const NEWEST = 'the newest block, which must NOT be archived.';
  for (const name of Object.keys(SHAPES)) {
    const d = fixtureRoot('studio-sit-shape-' + name);
    const file = path.join(d, 'NOTES.md');
    fs.writeFileSync(file, ['# Doc', '', '## Rounds', '',
      SHAPES[name], '',
      '2026-03-05 (' + NEWEST + ')', '',
      '2026-03-04 (an older block.)', '',
      '2026-03-03 (an older block still.)', '',
      'LIVE STATE that is NOT dated history.', '',
      '## Next', '', 'tail text'].join('\n') + '\n', 'utf8');
    run(file, ['--section', 'Rounds', '--archive', 'ROUNDS-ARCHIVE.md', '--noun', 'round',
      '--boundary', 'LIVE STATE that is NOT', '--write']);
    const live = read(file);
    const arch = read(path.join(d, 'ROUNDS-ARCHIVE.md'));
    ok('a live sentence opening with a date is not a block: the "' + name + '" shape',
       live.indexOf(SHAPES[name]) > -1 && live.indexOf(NEWEST) > -1 && arch.indexOf(NEWEST) === -1);
  }
}

// --- A PROJECT WHOSE BLOCKS ARE NAMED BY DATE, ACROSS RUNS ---------------------------------------
// The across-runs test above uses ORDINALS, which is this project's own convention, so it could
// not see that the noun pattern was allowed to match nothing: NAME's optional trailing word then
// swallowed the first word of the noun, last parsed as "2026-03-01 rounds", a string no archive
// will ever hold, the proof failed and the receipts never consolidated. Residue accrued forever
// for every project except the one that wrote the test. S249 inside one regular expression.
{
  const d = fixtureRoot('studio-sit-datenamed');
  const file = path.join(d, 'NOTES.md');
  const round = (n) => ['2026-03-' + String(n).padStart(2, '0') + ' (round ' + n + ', history.)', ''];
  // THE POINTER IS THE BOUNDARY, AND THAT IS WHAT PUTS THE RECEIPTS WHERE CONSOLIDATION CAN SEE
  // THEM. The first version of this fixture named a live phrase with --boundary instead, which put
  // every receipt INSIDE the archived region: each run then moved the previous receipt into the
  // archive along with the block, exactly one receipt ever existed, and the consolidation path was
  // never reached. Reinstating the defect this block is named after left the suite at 120 passed
  // 0 failed. A fixture that cannot reach the code it is about proves nothing (S245), and this is
  // the second one of those written in a single sitting.
  const tail = ['**Earlier rounds are in [ROUNDS-ARCHIVE.md](ROUNDS-ARCHIVE.md)**, unedited.', '',
                'LIVE STATE that is NOT dated history.', '', '## Next', '', 'tail text'];
  fs.writeFileSync(file, ['# Doc', '', '## Rounds', '']
    .concat(round(3), round(2), round(1), tail).join('\n') + '\n', 'utf8');

  const sizes = [];
  let broke = '';
  for (let n = 4; n < 10; n++) {
    const cur = read(file).split('\n');
    const at = cur.indexOf('## Rounds') + 2;
    fs.writeFileSync(file, cur.slice(0, at).concat(round(n), cur.slice(at)).join('\n'), 'utf8');
    const r = run(file, ['--section', 'Rounds', '--archive', 'ROUNDS-ARCHIVE.md', '--noun', 'round',
      '--write']);
    if (r.code !== 0 && !broke) broke = 'run ' + n + ' exited ' + r.code + ': ' + r.out.slice(0, 160);
    sizes.push(read(file).length);
  }
  const flat = read(file).replace(/\s+/g, ' ');
  const receipts = (flat.match(/archived on \d{4}-\d\d-\d\d to \[ROUNDS-ARCHIVE/g) || []).length
                 + (flat.match(/rounds were archived to \[ROUNDS-ARCHIVE/g) || []).length;
  ok('a date-named project archives cleanly run after run' + (broke ? ', got ' + broke : ''), broke === '');
  ok('and it can read its own consolidated output, so ONE receipt survives six runs', receipts === 1);
  ok('and its document does not grow while it is being archived',
     sizes[sizes.length - 1] - sizes[1] < 400);
}
// --- AND THE SAME PROJECT WITH A TIME OF DAY ON THE DATE ------------------------------------------
/* ST-302 HIGH 3. The block above is named for six runs and its fixture cannot reach the branch it
   is about: it uses a date with NO trailing word, which is the only form that avoids the defect.
   DATE_OPENER reads "2026-03-01, evening" and CONVENTIONS.date used to rebuild the name as
   "2026-03-01 evening", dropping the comma the document actually carries. The archive holds the
   original, so the proof that every receipt names something present in the archive looked for a
   string no archive will ever contain, the receipts never folded, and six runs left six of them.

   THIS IS THE REAL SIBLING CONVENTION, not an invented one: the header of this tool names the
   comma form as the shape it was built for. Adding ONE WORD to the fixture above would have found
   it, which is why this is a separate fixture rather than a change to that one: both forms are
   real and both must keep working.

   Watched failing, count predicted first: 2 of these 3 redden against the old name, the receipt
   count and the document growing, while "archives cleanly" stays green because nothing exits
   non-zero. A tool that silently declines to consolidate looks exactly like one with nothing to
   consolidate, which is S219 and is why the count is asserted rather than the exit code. */
{
  const d = fixtureRoot('studio-sit-datecomma');
  const file = path.join(d, 'NOTES.md');
  const round = (n) => ['2026-03-' + String(n).padStart(2, '0') + ', evening (round ' + n + ', history.)', ''];
  const tail = ['**Earlier rounds are in [ROUNDS-ARCHIVE.md](ROUNDS-ARCHIVE.md)**, unedited.', '',
                'LIVE STATE that is NOT dated history.', '', '## Next', '', 'tail text'];
  fs.writeFileSync(file, ['# Doc', '', '## Rounds', '']
    .concat(round(3), round(2), round(1), tail).join('\n') + '\n', 'utf8');

  const sizes = [];
  let broke = '';
  for (let n = 4; n < 10; n++) {
    const cur = read(file).split('\n');
    const at = cur.indexOf('## Rounds') + 2;
    fs.writeFileSync(file, cur.slice(0, at).concat(round(n), cur.slice(at)).join('\n'), 'utf8');
    const r = run(file, ['--section', 'Rounds', '--archive', 'ROUNDS-ARCHIVE.md', '--noun', 'round',
      '--write']);
    if (r.code !== 0 && !broke) broke = 'run ' + n + ' exited ' + r.code + ': ' + r.out.slice(0, 160);
    sizes.push(read(file).length);
  }
  const flat = read(file).replace(/\s+/g, ' ');
  const receipts = (flat.match(/archived on \d{4}-\d\d-\d\d to \[ROUNDS-ARCHIVE/g) || []).length
                 + (flat.match(/rounds were archived to \[ROUNDS-ARCHIVE/g) || []).length;
  ok('a date-and-time-of-day project archives cleanly run after run' + (broke ? ', got ' + broke : ''),
     broke === '');
  ok('and ONE receipt survives six runs when the date carries a comma and a word', receipts === 1);
  ok('and its document does not grow while it is being archived',
     sizes[sizes.length - 1] - sizes[1] < 400);

  const arch = read(path.join(d, 'ROUNDS-ARCHIVE.md'));
  ok('the archived block kept the comma the document wrote, so the receipt names something real',
     arch.includes('2026-03-01, evening'));
}

// --- THE BACKSTOP THAT NOTHING COULD REACH --------------------------------------------------------
/* ST-302 MEDIUM 4. The orphan check asserts the direction the read-back cannot: that no line LEFT
   the document without an archive holding it. A reviewer guarded it with if (false) and the suite
   stayed at 120 passed 0 failed, while the control mutation in the same file killed five, so the
   harness worked and this branch simply had no fixture.

   IT HAS NO NATURAL INPUT, AND THAT IS THE POINT OF IT. plan() proves the blocks tile the region
   exactly, line for line, before anything is written, so under a correct splice every line is
   either kept or archived and this can never fire. It is there for the ways the splice goes wrong
   that nobody has found yet. A guard like that cannot be reached by writing a cleverer document:
   the only honest way to watch it fail is to BREAK THE SPLICE and confirm it refuses.

   So this runs a COPY of the tool with one moved block dropped from the archive body, which is the
   simplest possible splice bug: the document loses the block and the archive never receives it.
   The assertion that matters is not the message, it is that the SOURCE IS UNTOUCHED afterwards,
   because that is what the refusal promises and it is the whole reason the check runs before the
   write rather than after it. S55: a check nobody has watched fail cannot be told from one that
   always passes, and this one had never been watched. */
{
  const d = fixtureRoot('studio-sit-orphan');
  const file = path.join(d, 'NOTES.md');
  const round = (n) => ['2026-03-' + String(n).padStart(2, '0') + ' (round ' + n + ', history.)',
                        'DISTINCT BODY LINE FOR ROUND ' + n + '.', ''];
  fs.writeFileSync(file, ['# Doc', '', '## Rounds', '']
    .concat(round(5), round(4), round(3), round(2), round(1),
            ['LIVE STATE that is NOT dated history.', '', '## Next', '', 'tail text']).join('\n') + '\n',
    'utf8');

  const src = fs.readFileSync(TOOL, 'utf8');
  const whole = 'for (const b of move) for (let i = b.start; i <= b.end; i++) body.push(lines[i]);';
  ok('the line the splice bug is injected into is still in the tool, so this fixture still bites',
     src.indexOf(whole) !== -1);
  const brokenTool = path.join(d, 'archive-sittings-broken.js');
  fs.writeFileSync(brokenTool, src.replace(whole,
    'for (const b of move.slice(0, -1)) for (let i = b.start; i <= b.end; i++) body.push(lines[i]);'),
    'utf8');

  const before = read(file);
  const a = [brokenTool, file, '--section', 'Rounds', '--archive', 'ROUNDS-ARCHIVE.md',
             '--noun', 'round', '--boundary', 'LIVE STATE that is NOT', '--write'];
  let out = '', code = 0;
  try { out = execFileSync('node', a, { stdio: ['pipe', 'pipe', 'pipe'] }).toString(); }
  catch (e) { code = e.status; out = ((e.stdout || '') + (e.stderr || '')).toString(); }

  ok('a splice that drops a block from the archive is REFUSED rather than written', code !== 0);
  ok('and the refusal says what it caught, so the reader is not left guessing',
     /without being present in any archive/.test(out));
  ok('and it quotes the first line it could not find, so the loss is identifiable',
     /2 line\(s\) would leave/.test(out) && /2026-03-01 \(round 1/.test(out));
  /* AND THE READ-BACK PASSED ON THE SAME RUN. "6 of 6 distinct non-blank lines read back from
     disk, 0 missing" is printed by this very run, while two lines are being lost. That is the
     whole argument for this check existing: the read-back proves the archive received what was
     SENT to it and can say nothing at all about what was sent. */
  ok('and the read-back proof was GREEN on the same run, which is why this check is not redundant',
     /0 missing/.test(out));
  ok('and THE SOURCE IS BYTE FOR BYTE WHAT IT WAS, which is what the refusal promises',
     read(file) === before);
}

// --- THE WRITE THAT DELETES TEXT IS THE ONE THAT WAS NOT READ BACK --------------------------------
/* ST-302 LOW 6. The no-op path, which only folds receipts and removes nothing, read its own write
   back. The archiving path, which has just taken dated history OUT of the document, wrote and
   exited. That is the wrong way round: the write with something to lose was the unchecked one.

   WATCHED FAILING THE SAME WAY THE ORPHAN BACKSTOP WAS, because a read-back guards against the
   filesystem and no fixture can make a real filesystem lie. A copy of the tool is given a
   truncating write, which is what a partial write looks like from the outside, and the question is
   whether anything notices. Predicted 2 of these redden before the fix, the refusal and its
   message, and the shape guard and the disk-agrees-with-the-report assertion stay green in both
   directions. */
{
  const d = fixtureRoot('studio-sit-readback');
  const file = path.join(d, 'NOTES.md');
  const round = (n) => ['2026-04-' + String(n).padStart(2, '0') + ' (round ' + n + ', history.)',
                        'DISTINCT BODY LINE FOR ROUND ' + n + '.', ''];
  const doc = ['# Doc', '', '## Rounds', '']
    .concat(round(5), round(4), round(3), round(2), round(1),
            ['LIVE STATE that is NOT dated history.', '', '## Next', '', 'tail text']).join('\n') + '\n';
  fs.writeFileSync(file, doc, 'utf8');

  const args = ['--section', 'Rounds', '--archive', 'ROUNDS-ARCHIVE.md', '--noun', 'round',
                '--boundary', 'LIVE STATE that is NOT', '--write'];
  const real = run(file, args);
  const onDisk = read(file);
  const claimed = (real.out.match(/went \d+ to (\d+) characters/) || [])[1];
  ok('a real archiving run reports the size it left behind', claimed !== undefined);
  ok('and the document on disk is exactly that many characters, so the report is about the file '
    + 'rather than about the plan', onDisk.length === parseInt(claimed, 10));

  const src = fs.readFileSync(TOOL, 'utf8');
  const theWrite = "fs.writeFileSync(target, after, 'utf8');";
  ok('the final source write is still written the way this test mutates it', src.indexOf(theWrite) !== -1);
  const brokenTool = path.join(d, 'archive-sittings-halfwrite.js');
  fs.writeFileSync(brokenTool, src.replace(theWrite,
    "fs.writeFileSync(target, after.slice(0, after.length - 40), 'utf8');"), 'utf8');

  const file2 = path.join(d, 'NOTES2.md');
  fs.writeFileSync(file2, doc, 'utf8');
  let out = '', code = 0;
  try { out = execFileSync('node', [brokenTool, file2].concat(args), { stdio: ['pipe', 'pipe', 'pipe'] }).toString(); }
  catch (e) { code = e.status; out = ((e.stdout || '') + (e.stderr || '')).toString(); }
  ok('a write that does not land whole is caught rather than reported as a successful archive',
     code !== 0);
  ok('and it says the document did not survive the write, naming the two sizes',
     /did not survive the write/.test(out));
}

// --- A NOUN THE RECEIPT PATTERN CANNOT READ ------------------------------------------------------
/* ST-295 MEDIUM, and it has the same cause as the defect that stopped this tool reading its own
   output: a field a PROJECT supplies is interpolated into a pattern without being constrained.
   `archive` is validated for exactly this reason and says so in its own refusal. `noun` was not,
   and RECEIPT_RE can only read lower-case words, so a project whose entries are "Round" or
   "build-status" gets receipts written that the consolidation can never match. Six sittings leave
   six receipts, growing the document the tool exists to shrink, silently, in somebody else's
   record rather than in this one.

   REFUSED RATHER THAN COERCED. Lower-casing it quietly would write a word into a sibling project's
   own document that its authors did not choose, which is the fault pluralOf already exists to
   avoid. The remedy is one flag and the refusal names it.

   Watched failing, predicted 3 and measured 3: without the check the run SUCCEEDS, so the refusal,
   its message and the untouched-source assertion all redden together. */
{
  const d = fixtureRoot('studio-sit-noun');
  const file = path.join(d, 'NOTES.md');
  const round = (n) => ['2026-05-' + String(n).padStart(2, '0') + ' (round ' + n + ', history.)', ''];
  fs.writeFileSync(file, ['# Doc', '', '## Rounds', '']
    .concat(round(3), round(2), round(1),
            ['LIVE STATE that is NOT dated history.', '', '## Next', '', 'tail text']).join('\n') + '\n',
    'utf8');
  const before = read(file);
  const r = run(file, ['--section', 'Rounds', '--archive', 'ROUNDS-ARCHIVE.md', '--noun', 'Round',
    '--boundary', 'LIVE STATE that is NOT', '--write']);
  ok('a noun the receipt pattern cannot read is refused rather than written into the record: got exit '
    + r.code, r.code !== 0);
  ok('and the refusal says what a noun may contain, so the reader can fix it in one go',
    /lower-case/.test(r.out) && /noun/.test(r.out));
  ok('and nothing was written, because the damage is in the document and not in the run',
    read(file) === before);

  /* AND THE REMEDY IT NAMES HAS TO WORK. The first version told the reader to supply nounPlural,
     which is held to the SAME predicate, so following the instruction produced the identical
     refusal. A content reviewer proved it with a config. This asserts the escape route is not
     offered, rather than asserting a sentence is present, because a presence test cannot see a
     remedy that does not work. */
  const cfg = path.join(d, '.studio-archive.json');
  fs.writeFileSync(cfg, JSON.stringify({ sections: [
    { heading: 'Rounds', archive: 'ROUNDS-ARCHIVE.md', noun: 'Round', nounPlural: 'rounds',
      boundary: 'LIVE STATE that is NOT' },
  ] }), 'utf8');
  const rp = run(file, ['--write']);
  ok('supplying nounPlural does NOT buy a way past the noun rule: got exit ' + rp.code, rp.code !== 0);
  ok('and the refusal does not offer nounPlural as the escape, because it is held to the same rule',
    /will not help/.test(rp.out));
  ok('and it shows what a good one looks like rather than only what is banned',
    /build status entry/.test(rp.out));
  fs.unlinkSync(cfg);

  // THE CONTROL, and it is the whole reason this is a constraint rather than a ban: a multi-word
  // lower-case noun is exactly what a sibling project uses and it must keep working.
  const r2 = run(file, ['--section', 'Rounds', '--archive', 'ROUNDS-ARCHIVE.md',
    '--noun', 'build status entry', '--boundary', 'LIVE STATE that is NOT', '--write']);
  ok('a multi-word lower-case noun is accepted: got exit ' + r2.code, r2.code === 0);
  ok('and its plural reached the receipt rather than being guessed at with an s',
    read(file).indexOf('build status entries') !== -1);
}

// --- TWO SECTIONS, ONE ARCHIVE FILE ---------------------------------------------------------------
/* ST-295 MEDIUM. Two DIFFERENT sections pointed at the same archive filename pass the overlap
   refusal above, because their regions are disjoint and that check is about lines. What they share
   is the destination, and everything downstream is keyed on the archive NAME: the receipts are
   grouped by it, so the second section's receipt is folded into the first section's group and the
   pointer that belongs to it is erased. No text is lost, the archive holds both, and the TRAIL to
   the second section stops existing.

   REFUSED, NOT MERGED. A merged group cannot say which section a block came from, and the boundary
   marker each section needs is per-section. Two files is one line of config; a wrong trail is
   permanent. */
{
  const d = fixtureRoot('studio-sit-onearchive');
  const file = path.join(d, 'NOTES.md');
  const rows = (tag, lo, hi) => {
    const out = [];
    for (let n = hi; n >= lo; n--) out.push('2026-06-' + String(n).padStart(2, '0') + ' (' + tag + ' ' + n + ', dated history.)', '');
    return out;
  };
  const body = ['# Doc', '', '## Rounds', ''].concat(rows('round', 1, 5))
    .concat(['LIVE ROUND STATE that is not dated history.', '', '## Builds', ''])
    .concat(rows('build', 1, 5))
    .concat(['LIVE BUILD STATE that is not dated history.', '', '## Next', '', 'tail text']).join('\n') + '\n';
  fs.writeFileSync(file, body, 'utf8');
  fs.writeFileSync(path.join(d, '.studio-archive.json'), JSON.stringify({ sections: [
    { heading: 'Rounds', archive: 'SHARED-ARCHIVE.md', noun: 'round', boundary: 'LIVE ROUND STATE' },
    { heading: 'Builds', archive: 'SHARED-ARCHIVE.md', noun: 'build', boundary: 'LIVE BUILD STATE' },
  ] }), 'utf8');

  const r = run(file, ['--write']);
  ok('two sections writing to ONE archive file are refused: got exit ' + r.code, r.code === 1);
  /* TIGHTENED AFTER IT PROVED NOTHING. The first version asked only that the output mention the
     shared filename and both headings, and an ordinary successful run prints all three, so it
     passed against the unfixed tool. Predicted 4 would redden and 3 did, which is what exposed it:
     a prediction wrong in the direction of FEWER failures is usually an assertion that cannot
     fail. S242. */
  ok('and the refusal says they share one archive, rather than merely mentioning the names',
     /same archive file/.test(r.out) && /SHARED-ARCHIVE\.md/.test(r.out)
     && /Rounds/.test(r.out) && /Builds/.test(r.out));
  ok('and the document is byte-identical afterwards', read(file) === body);
  ok('and no archive was created, because the refusal runs before anything is written',
     !fs.existsSync(path.join(d, 'SHARED-ARCHIVE.md')));
}

// --- A NEGATIVE SAVING IS NOT A SAVING -------------------------------------------------------------
/* ST-295 LOW. Three call sites printed "N off every request" with N computed as before minus after,
   so a run that GREW the document reported the growth as a benefit with a minus sign in front of it.
   That is the one number anybody reads to decide whether archiving is working, and it was the number
   that could not tell them it had stopped. Ten simulated sittings once grew a document from 1,134 to
   5,642 characters while archiving it, and every one of those runs printed a saving.

   PROVED BY MAKING A COPY OF THE TOOL GROW THE DOCUMENT, because the consolidation now prevents
   growth on any real input and an unreachable branch is exactly the kind that ships wrong. Same
   technique as the orphan backstop above: the behaviour under test is what the tool SAYS, and the
   only way to reach it is to make the thing it describes actually happen. */
{
  const d = fixtureRoot('studio-sit-grew');
  const file = path.join(d, 'NOTES.md');
  const round = (n) => ['2026-07-' + String(n).padStart(2, '0') + ' (round ' + n + ', history.)', ''];
  fs.writeFileSync(file, ['# Doc', '', '## Rounds', '']
    .concat(round(3), round(2), round(1),
            ['LIVE STATE that is NOT dated history.', '', '## Next', '', 'tail text']).join('\n') + '\n',
    'utf8');

  const src = fs.readFileSync(TOOL, 'utf8');
  const theJoin = 'const after = settled.lines.join(nl);';
  ok('the line the growth is injected into is still in the tool', src.indexOf(theJoin) !== -1);
  const grower = path.join(d, 'archive-sittings-grows.js');
  fs.writeFileSync(grower, src.replace(theJoin,
    "const after = settled.lines.join(nl) + new Array(5001).join('x');"), 'utf8');

  let out = '';
  try {
    out = execFileSync('node', [grower, file, '--section', 'Rounds', '--archive', 'ROUNDS-ARCHIVE.md',
      '--noun', 'round', '--boundary', 'LIVE STATE that is NOT', '--write'],
      { stdio: ['pipe', 'pipe', 'pipe'] }).toString();
  } catch (e) { out = ((e.stdout || '') + (e.stderr || '')).toString(); }

  ok('a run that GREW the document does not call the growth a saving', !/-\d+ off every request/.test(out));
  ok('and it says plainly that the document got bigger', /MORE on every request/.test(out));
  ok('and it says archiving was supposed to shrink it, so the reader knows it is a fault',
     /supposed to shrink/.test(out));
}

const EXPECTED_ASSERTIONS = 152;
const ranBefore = pass + fail;
ok('the suite ran every assertion: ran ' + (ranBefore + 1) + ' of ' + EXPECTED_ASSERTIONS,
  ranBefore === EXPECTED_ASSERTIONS - 1);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
