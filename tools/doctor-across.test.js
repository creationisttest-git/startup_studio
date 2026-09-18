#!/usr/bin/env node
'use strict';
/*
 * Every assertion here has been watched failing, by breaking doctor-across.js and confirming this
 * suite goes red. Each case builds its own projects root (S59).
 *
 * THE CASE THAT CARRIES THE TICKET is the sittings one. A class written twice by the SAME session
 * is one fault found twice in one afternoon; the same class returning in a LATER session is the
 * thing this studio keeps paying for. Counting rows instead of sittings would refuse the first
 * and miss nothing, which is the wrong way round, so both are asserted separately.
 *
 * THE SECOND IS THE BOARD SHAPE. A board here is found the way board.js defines one, a directory
 * holding project.json beside a tickets directory, and never by a directory called `.board`. A
 * fixture deliberately keeps its board in a directory called `board`, because a real project does
 * and the instrument that looked only for the other name reported a 154-ticket board as absent
 * (S218).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const TOOL = path.join(__dirname, 'doctor-across.js');
let pass = 0, fail = 0;
function ok (name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL  ' + name); } }

const LF = String.fromCharCode(10);
let n = 0;

function row (o) {
  return JSON.stringify(Object.assign({
    v: 1, at: '2026-09-18 10:00:00', session: 's1', project: 'p', commit: 'abc',
    class: 'a-class', severity: 'major', finding: 'something went wrong here',
    evidence: 'node x.js', ticket: null, firstSeen: null, seenCount: 1
  }, o));
}

/* spec: { projectName: { boardDir: 'board'|'.board'|null, rows: [...], raw: '...' } } */
function world (spec) {
  const root = path.join(os.tmpdir(), 'doctor-across-' + process.pid + '-' + (n++));
  fs.mkdirSync(root, { recursive: true });
  for (const name of Object.keys(spec)) {
    const s = spec[name];
    const proj = path.join(root, name);
    fs.mkdirSync(proj, { recursive: true });
    if (!s.boardDir) continue;
    const b = path.join(proj, s.boardDir);
    if (s.noTickets) fs.mkdirSync(b, { recursive: true });
    else fs.mkdirSync(path.join(b, 'tickets'), { recursive: true });
    fs.writeFileSync(path.join(b, 'project.json'), JSON.stringify({ slug: name }), 'utf8');
    if (s.rows || s.raw) {
      const body = (s.rows || []).map(row).join(LF) + ((s.rows || []).length ? LF : '') + (s.raw || '');
      fs.writeFileSync(path.join(b, 'doctor-findings.jsonl'), body, 'utf8');
    }
    if (s.archived) {
      fs.writeFileSync(path.join(b, 'doctor-findings-archive.jsonl'), s.archived.map(row).join(LF) + LF, 'utf8');
    }
  }
  return root;
}

/* EVERY RUN IS POINTED AT AN ALLOW FILE INSIDE ITS OWN FIXTURE, even the cases that have nothing
 * to do with the escape. The tool's own refusal tells a reader to create tools/doctor-across-allow.json,
 * and the default path is that file, so the day somebody follows that instruction this suite starts
 * reading the REAL one: a single stale entry in it would exit 1 and redden roughly a dozen
 * assertions here that are about something else entirely. A suite that depends on a file the tool
 * invites you to create is not hermetic, and it fails on the day of a correct action. */
function run (root, extra) {
  const args = (extra || []).slice();
  if (args.indexOf('--allow-file') === -1) args.push('--allow-file', path.join(root, 'no-allow-file.json'));
  const r = spawnSync(process.execPath, [TOOL, '--projects-root', root].concat(args), { encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

/* ---- finding the board at all ---- */

{
  const root = world({ alpha: { boardDir: 'board', rows: [{ class: 'x-y', session: 's1' }] } });
  const r = run(root);
  ok('a board in a directory NOT called .board is still found (S218)', /1 project\(s\) with a record/.test(r.out));
  ok('and its rows are read', /1 row\(s\)/.test(r.out));
}

{
  const root = world({ alpha: { boardDir: '.board', rows: [{ class: 'x-y' }] } });
  ok('a board in .board is found too', /1 project\(s\) with a record/.test(run(root).out));
}

{
  const root = world({ alpha: { boardDir: null } });
  const r = run(root);
  ok('a project with no file board is NOT reported as running no board', /runs no board at all/.test(r.out) === false);
  ok('it is reported as a claim about this instrument instead',
    /no FILE board this tool can read/.test(r.out));
  ok('and the database board is named as the reason not to read it that way',
    /database board is invisible here/.test(r.out));
}

{
  const root = world({ alpha: { boardDir: '.board' } });
  const r = run(root);
  ok('a board with no record is an absence of evidence rather than a clean run',
    /have a board and NO record, which is an absence/.test(r.out));
}

{
  /* A project.json with no tickets directory beside it is not a board, it is a stray config file.
   * Treating one as a board would invent boards in projects that do not run one, and then report
   * them as having no record, which is a false finding about somebody else's project. */
  const root = world({ alpha: { boardDir: 'config', noTickets: true, rows: [{ class: 'x-y' }] } });
  const r = run(root);
  ok('a project.json with no tickets directory beside it is NOT a board',
    /1 project\(s\) with a record/.test(r.out) === false);
  ok('and the project is reported as holding no file board this tool can read',
    /no FILE board this tool can read/.test(r.out));
}

/* ---- the rule: a class seen in two SITTINGS must carry a ticket ---- */

{
  const root = world({ alpha: { boardDir: '.board', rows: [
    { class: 'heredoc-escape-collapse', session: 's1', at: '2026-09-17 10:00:00' },
    { class: 'heredoc-escape-collapse', session: 's2', at: '2026-09-18 10:00:00' }
  ] } });
  const r = run(root);
  ok('a class seen in two sittings with no ticket REFUSES', r.code === 1);
  ok('the refusal names the class and the number of sittings',
    /REFUSED {2}heredoc-escape-collapse has been seen in 2 sittings/.test(r.out));
  ok('the refusal says a class seen twice is a standing defect rather than an incident',
    /A class seen twice is a standing/.test(r.out));
  ok('the refusal prints the command that raises a ticket', /board\.js raise/.test(r.out));
}

{
  const root = world({ alpha: { boardDir: '.board', rows: [
    { class: 'heredoc-escape-collapse', session: 's1', ticket: 'ST-079' },
    { class: 'heredoc-escape-collapse', session: 's2' }
  ] } });
  const r = run(root);
  ok('a recurring class carrying a ticket on ANY of its rows passes', r.code === 0);
  ok('and the summary shows the ticket it is attached to', /ticket ST-079/.test(r.out));
}

{
  const root = world({ alpha: { boardDir: '.board', rows: [
    { class: 'same-day-twice', session: 's1', at: '2026-09-18 10:00:00' },
    { class: 'same-day-twice', session: 's1', at: '2026-09-18 14:00:00' }
  ] } });
  const r = run(root);
  ok('the same class twice in ONE sitting is an incident, not a recurrence, and does not refuse', r.code === 0);
  ok('and it is not listed as a recurring class', /No class has been seen in more than one sitting/.test(r.out));
}

/* ---- reading across projects, which is the reason this tool exists ---- */

{
  const root = world({
    alpha: { boardDir: '.board', rows: [{ class: 'shared-fault', session: 's1' }] },
    beta: { boardDir: 'board', rows: [{ class: 'shared-fault', session: 's2' }] }
  });
  const r = run(root);
  ok('rows from two different projects are read in one pass', /2 row\(s\) from 2 project\(s\)/.test(r.out));
  ok('a class seen in two projects refuses when it carries no ticket', r.code === 1);
  ok('and it is called out as not being one project habit',
    /so it is not one project's habit/.test(r.out));
  ok('the projects it was seen in are named', /seen in alpha, beta/.test(r.out));
}

/* ---- the cap, because this is read at session start ---- */

{
  const spec = { alpha: { boardDir: '.board', rows: [] } };
  for (let i = 0; i < 6; i++) {
    spec.alpha.rows.push({ class: 'klass-' + i, session: 'sA', ticket: 'ST-1' });
    spec.alpha.rows.push({ class: 'klass-' + i, session: 'sB', ticket: 'ST-1' });
  }
  const root = world(spec);
  const r = run(root, ['--cap', '2']);
  ok('the summary is capped', /4 more not shown/.test(r.out));
  ok('the cap says WHY, which is that an uncapped summary is charged on every request',
    /a charge on every request/.test(r.out));
  ok('the cap prints the command that shows the rest', /doctor-across\.js --full/.test(r.out));
  /* --full AND --cap 2 TOGETHER, WHICH IS THE ONLY COMBINATION THAT CAN SEE THIS (ST-277
   * MEDIUM-6). Two things were wrong with the assertion that stood here. It tested the ABSENCE
   * of the hidden-count notice, which is itself printed under `if (!full)` and so cannot appear
   * under --full whatever the cap did. And the first correction, counting the classes, still did
   * not redden the mutant, because the --full run passed no --cap and the DEFAULT cap is larger
   * than this fixture: the slice was never short, so there was nothing for --full to override.
   * A flag that overrides a limit can only be tested against a limit that would otherwise bite.
   * Mutation: drop `full ?` from the slice and this counts 2 where it wants 6. */
  const f = run(root, ['--full', '--cap', '2']);
  const shown = (f.out.match(/klass-\d/g) || []).filter((v, i, a) => a.indexOf(v) === i).length;
  ok('--full overrides a cap that WOULD have bitten, counted: ' + shown + ' of 6', shown === 6);
  ok('and the hidden-count notice is absent, which is necessary and was never sufficient',
    /4 more not shown/.test(f.out) === false);
  ok('--full also lists the classes seen only once', /SEEN ONCE, 0 class\(es\)/.test(f.out));
}

/* ---- damage, absence, and the shapes that must not read as clean ---- */

{
  const root = world({ alpha: { boardDir: '.board', rows: [{ class: 'x-y' }], raw: 'half a row {' + LF } });
  const r = run(root);
  ok('a line that will not parse does not make the read fail', r.code === 0);
  ok('the unusable line is counted rather than ignored',
    /1 line\(s\) could not be parsed and were counted/.test(r.out));
}

{
  const root = world({ alpha: { boardDir: '.board' }, beta: { boardDir: null } });
  const r = run(root);
  ok('no record anywhere is CANNOT TELL, exit 3', r.code === 3);
  ok('and it says plainly that this is not a clean bill of health',
    /That is not a clean/.test(r.out));
  ok('and it names the writing half so the reader knows what is missing', /ST-244 is the writing half/.test(r.out));
}

{
  const r = run(path.join(os.tmpdir(), 'no-such-root-' + process.pid));
  ok('an unreadable projects root is exit 2 and not a pass', r.code === 2);
}

/* ---- filtering and read-only ---- */

{
  const root = world({
    alpha: { boardDir: '.board', rows: [{ class: 'a-one', session: 's1' }] },
    beta: { boardDir: '.board', rows: [{ class: 'b-one', session: 's1' }] }
  });
  const r = run(root, ['--project', 'beta']);
  ok('--project reads one project only', /1 row\(s\) from 1 project\(s\)/.test(r.out));
}

{
  const root = world({ alpha: { boardDir: '.board', rows: [{ class: 'a-one', session: 's1' }] } });
  const file = path.join(root, 'alpha', '.board', 'doctor-findings.jsonl');
  const before = fs.readFileSync(file, 'utf8');
  const stamped = fs.statSync(file).mtimeMs;
  run(root);
  run(root, ['--full']);
  ok('reading another project writes nothing back to it', fs.readFileSync(file, 'utf8') === before);
  ok('and does not even touch the file mtime', fs.statSync(file).mtimeMs === stamped);
}

/* ---- --brief: the only output of this tool that is charged on every request ----
 *
 * ST-276. This block is injected at session start and then re-sent with every request for the
 * life of that session, so its cost is the session length rather than one read. Everything
 * asserted here is about keeping it small and keeping it from taking a session down with it. */

{
  const root = world({ alpha: { boardDir: '.board', rows: [
    { class: 'clean-one', session: 's1' }, { class: 'clean-two', session: 's2' }
  ] } });
  const r = run(root, ['--brief']);
  ok('--brief prints NOTHING when there is nothing to act on', r.out.trim() === '');
  ok('and still exits 0', r.code === 0);
}

{
  const root = world({ alpha: { boardDir: '.board', rows: [
    { class: 'came-back', session: 's1' }, { class: 'came-back', session: 's2' }
  ] } });
  const plain = run(root);
  const brief = run(root, ['--brief']);
  ok('the ordinary run refuses on this record', plain.code === 1);
  ok('--brief on the SAME record exits 0, because it feeds a session start that must not fail',
    brief.code === 0);
  ok('--brief names the class', /came-back {2}2 sittings/.test(brief.out));
  ok('--brief prints no cross-project header, which is noise at this price',
    /DOCTOR, ACROSS PROJECTS/.test(brief.out) === false);
  ok('--brief points at the full record rather than carrying it', /--full/.test(brief.out));
}

{
  const root = world({ alpha: { boardDir: '.board', rows: [
    { class: 'no-ticket', session: 's1' }, { class: 'no-ticket', session: 's2' },
    { class: 'has-ticket', session: 's1', ticket: 'ST-1' }, { class: 'has-ticket', session: 's2' }
  ] } });
  const r = run(root, ['--brief']);
  ok('--brief counts the recurring classes that already carry a ticket without listing them',
    /\(1 more recurring class\(es\) already carry a ticket\.\)/.test(r.out));
  ok('and it does not name the ticketed class, which needs no action', /has-ticket/.test(r.out) === false);
}

{
  const spec = { alpha: { boardDir: '.board', rows: [] } };
  for (let i = 0; i < 20; i++) {
    spec.alpha.rows.push({ class: 'klass-' + i, session: 'sA' });
    spec.alpha.rows.push({ class: 'klass-' + i, session: 'sB' });
  }
  const root = world(spec);
  const r = run(root, ['--brief']);
  const lines = r.out.trim().split(/\r?\n/);
  /* <= 8 AND NOT <= 9. At nine this assertion could not see MAX_BRIEF_LINES move from 8 to 9,
   * which is the one mutation it exists to catch, and that mutant survived. A cap assertion has
   * to be the cap. */
  ok('--brief is hard-capped on lines', lines.length <= 8);
  ok('and the truncation is REPORTED rather than silent, because a block that stops at the cap',
    /more class line\(s\), capped here because this block is re-sent on every request/.test(r.out));
  ok('and the whole block stays under the character cap', r.out.trim().length <= 700);
  /* THE ONE LINE THAT SAYS WHAT TO DO SURVIVES THE CAP, at twenty classes and with no escape
   * involved at all. Ordering the escape notices last fixed the six-class case and left this one
   * exactly as broken: the class list alone reached the cap and the instruction was what fell
   * off, so a session was handed twenty names, no command, and no way to see the rest. What a
   * cap can afford to lose is a name; the count then reports it. */
  ok('and the line saying what to DO survives, which is the only actionable line in the block',
    /Full record: node tools\/doctor-across\.js --full/.test(r.out));
}

{
  /* The LINE cap and the CHARACTER cap are two controls, and a fixture with short class names
   * exercises only the first. The writer caps a class at 60 characters; this reader does not
   * write the rows it reads, so a long class can arrive from anywhere and a handful of them fit
   * inside the line cap while blowing the cost the cap exists for. */
  const spec = { alpha: { boardDir: '.board', rows: [] } };
  for (let i = 0; i < 6; i++) {
    const long = ('very-long-class-name-that-eats-the-character-budget-on-its-own-and-more-' + i);
    spec.alpha.rows.push({ class: long, session: 'sA' });
    spec.alpha.rows.push({ class: long, session: 'sB' });
  }
  const root = world(spec);
  const r = run(root, ['--brief']);
  /* THE CHARACTER CAP DROPS THE SAME THING THE LINE CAP DROPS, which is a class NAME, and the
   * count then reports it. It used to slice the finished string from the end, so the instruction
   * that had been reserved out of the LINE cap was put straight back at the bottom of the thing
   * being cut: fixed on one axis, left broken on the other, and the assertion written for the fix
   * lived in the 20-class fixture, which is 421 characters and cannot reach this cap at all. This
   * fixture does reach it, and it is the one that has to carry the guarantee. */
  ok('the character cap drops class names and SAYS how many, rather than slicing the block',
    /more class line\(s\), capped here/.test(r.out));
  ok('THE INSTRUCTION SURVIVES THE CHARACTER CAP, which is what the line-axis fix only half did',
    /Full record: node tools\/doctor-across\.js --full/.test(r.out));
  ok('and the block really is inside the character cap it names, not merely near it',
    r.out.trim().length <= 700);
  ok('and inside the line cap too', r.out.trim().split(/\r?\n/).length <= 8);
}

{
  const root = world({ alpha: { boardDir: null } });
  const r = run(root, ['--brief']);
  ok('--brief over a machine with no record at all exits 0 rather than 3', r.code === 0);
  ok('and prints nothing, because an absence is not something a session can act on', r.out.trim() === '');
}

// The total is PINNED and written down rather than measured from the run it checks, because a
// self-updating total agrees with any run. Mutation: delete a block above and this goes red alone.
/* ---- THE ARCHIVE COUNTS FOR RECURRENCE (ST-277 MEDIUM-5) ----
 *
 * doctor-record rolls old rows into an archive at every wind-down, and until this was fixed the
 * file it wrote was read by nothing on the machine. Recurrence is the count of distinct sittings
 * a class appears in, so archiving took a sitting off that count and a class first seen long ago
 * and seen again today came back as seen ONCE. The classes that stopped refusing were exactly the
 * ones that had been coming back longest, and the number ST-240 drives to zero was being reset on
 * a schedule nobody chose.
 *
 * Mutation: read only RECORD in the project loop and the first two go red, because one sitting
 * cannot recur. */
{
  const root = world({
    alpha: {
      boardDir: '.board',
      archived: [{ class: 'old-fault', session: 'sOLD', at: '2026-01-01 10:00:00' }],
      rows: [{ class: 'old-fault', session: 'sNEW', at: '2026-09-18 10:00:00' }]
    }
  });
  const r = run(root);
  ok('a class whose earlier sitting is in the ARCHIVE still counts as recurring', r.code === 1);
  ok('and it is named as two sittings rather than one', /old-fault  2 sitting\(s\)/.test(r.out));
  ok('the archived rows are counted out loud, because the finding was that this file was read by nothing',
    /1 row\(s\) are held in an archive/.test(r.out));
}

/* ---- THE WRITTEN-REASON ESCAPE (S232, ST-277) ----
 *
 * This tool shipped with no escape while its sibling had one, and the pressure was real rather
 * than theoretical: it reads across projects, so the studio's session start can be refused on a
 * class belonging to a project the studio is instructed not to touch. S232 is about what happens
 * next. The predicate gets weakened instead, which makes the instrument quietly weaker everywhere
 * to fix one case.
 *
 * All four properties S232 names are asserted, and the LAST is the one that matters most: an
 * entry that no longer excuses anything must be reported STALE and must still FAIL. Without that
 * clause the list outlives what it excused and every later reader treats it as load-bearing. */
{
  const root = world({ alpha: { boardDir: '.board', rows: [
    { class: 'not-ours', session: 's1' }, { class: 'not-ours', session: 's2' }
  ] } });
  const allowFile = path.join(root, 'allow.json');

  const before = run(root, ['--allow-file', allowFile]);
  ok('with no escape file the recurring unticketed class refuses', before.code === 1);
  ok('and the refusal names the escape, because a refusal with no way out gets the predicate '
   + 'weakened instead (S232)', /Or say in writing why it is not work/.test(before.out));

  fs.writeFileSync(allowFile, JSON.stringify([{ class: 'not-ours', reason: 'owned by a project this studio is instructed not to touch', by: 'studio', at: '2026-09-18' }]), 'utf8');
  const after = run(root, ['--allow-file', allowFile]);
  ok('a class with a written reason no longer refuses', after.code === 0);
  ok('the reason is PRINTED on every run rather than swallowed', /owned by a project this studio is instructed not to touch/.test(after.out));
  ok('and the ending says a reason was accepted rather than claiming every class carries a ticket, '
   + 'which would report an empty list where somebody actually signed for one',
    /or a written reason/.test(after.out));
  const quiet = run(root, ['--allow-file', allowFile, '--quiet']);
  ok('and --quiet cannot hide it, because an escape nobody sees is an exception nobody reviews',
    /owned by a project this studio is instructed not to touch/.test(quiet.out));

  /* STALE IS PROVED ON A TREE WITH NOTHING ELSE TO REFUSE ON, which is the only fixture where the
   * exit code is evidence about the stale branch. Run against the fixture above, the class is
   * unticketed and refuses anyway, so deleting the stale exit entirely left this green: an
   * assertion certifying a branch it never entered, which is the exact class this same commit
   * fixed in the --full case. Everything here carries a ticket, so exit 1 has one cause. */
  const clean = world({ beta: { boardDir: '.board', rows: [
    { class: 'has-ticket', session: 's1', ticket: 'ST-9' }, { class: 'has-ticket', session: 's2', ticket: 'ST-9' }
  ] } });
  const cleanAllow = path.join(clean, 'allow.json');
  ok('the control: with no escape file this tree is clean', run(clean, ['--allow-file', cleanAllow]).code === 0);
  fs.writeFileSync(cleanAllow, JSON.stringify([{ class: 'never-happened', reason: 'excuses nothing', by: 'studio', at: '2026-09-18' }]), 'utf8');
  const staleRun = run(clean, ['--allow-file', cleanAllow]);
  ok('AN ESCAPE THAT SUPPRESSES NOTHING IS STALE AND STILL FAILS, on a tree with nothing else to '
   + 'refuse on, so the exit code is evidence about this branch and no other', staleRun.code === 1);
  ok('and it is named, so the entry can be removed rather than inherited', /STALE.*never-happened/.test(staleRun.out));

  /* A stale entry used to exit on the spot, so a tree carrying both printed the paperwork and
   * hid the finding. The finding is the more urgent of the two. */
  fs.writeFileSync(allowFile, JSON.stringify([{ class: 'never-happened', reason: 'excuses nothing' }]), 'utf8');
  const both = run(root, ['--allow-file', allowFile]);
  ok('with a stale escape AND a real finding, both are reported rather than the first one winning',
    /STALE.*never-happened/.test(both.out) && /REFUSED  not-ours/.test(both.out) && both.code === 1);

  /* The brief is the mode a SessionStart hook runs and the only mode most sessions ever see. */
  const brief = run(clean, ['--allow-file', cleanAllow, '--brief']);
  ok('the brief surfaces a stale escape, because an escape nobody sees is an exception nobody reviews',
    /stale escape\(s\)/.test(brief.out));
  /* ORDER, ASSERTED. The escape notice used to be pushed FIRST, and with the cap cutting from the
   * bottom a single housekeeping line displaced the instruction on a six-class fixture. Mutation:
   * push the notices before the findings again and this goes red while everything else stays
   * green, which is how it got through the first time. */
  {
    const spec = { gamma: { boardDir: '.board', rows: [] } };
    for (let i = 0; i < 6; i++) {
      spec.gamma.rows.push({ class: 'kk-' + i, session: 'sA' });
      spec.gamma.rows.push({ class: 'kk-' + i, session: 'sB' });
    }
    const busy = world(spec);
    const busyAllow = path.join(busy, 'allow.json');
    fs.writeFileSync(busyAllow, JSON.stringify([{ class: 'never-happened', reason: 'excuses nothing' }]), 'utf8');
    const b = run(busy, ['--allow-file', busyAllow, '--brief']);
    const iDo = b.out.indexOf('Raise each or attach it');
    const iNote = b.out.indexOf('stale escape(s)');
    ok('with findings AND an escape notice, the instruction comes before the housekeeping',
      iDo !== -1 && iNote !== -1 && iDo < iNote);
  }
  ok('and the brief still exits 0, because its contract is that it never takes a session down',
    brief.code === 0);

  fs.writeFileSync(cleanAllow, JSON.stringify([{ class: 'has-ticket' }]), 'utf8');
  const incomplete = run(clean, ['--allow-file', cleanAllow]);
  ok('an entry with no reason excuses nothing and is NAMED rather than dropped in silence',
    /IGNORED.*no reason given/.test(incomplete.out));

  /* ON THE CLEAN TREE AGAIN, for the reason M3 was raised about three lines above: run against a
   * fixture that refuses anyway, exit 1 has two possible causes and the assertion is evidence for
   * neither. Verified: an unreadable allow file on an otherwise clean tree exits 0, so the code
   * below pins the MESSAGE and says plainly that the exit code is not the thing being tested. */
  fs.writeFileSync(cleanAllow, 'not json at all {', 'utf8');
  const broken = run(clean, ['--allow-file', cleanAllow]);
  ok('an unreadable escape list excuses NOTHING rather than everything, so a clean tree stays clean '
   + 'instead of a damaged file turning into a blanket excuse', broken.code === 0);
  ok('and says so, because a file that silently excused everything would be the worst outcome here',
    /CANNOT READ/.test(broken.out));

  /* All three escape faults have to reach the mode the hook runs, not just the stale one. An
   * unreadable list is WORSE than a stale entry, because it empties the whole list rather than
   * one line of it, and an entry with no reason is somebody who believes they excused a class. */
  const briefBroken = run(clean, ['--allow-file', cleanAllow, '--brief']);
  ok('the brief reports an unreadable escape list', /cannot be read, so NOTHING is excused/.test(briefBroken.out));
  fs.writeFileSync(cleanAllow, JSON.stringify([{ class: 'has-ticket' }]), 'utf8');
  ok('and the brief reports an entry that excuses nothing for want of a reason',
    /carries has-ticket \(no reason given\)/.test(run(clean, ['--allow-file', cleanAllow, '--brief']).out));
}

/* A row in BOTH the live record and the archive is ONE row. Every failure exit of archiving
 * deliberately leaves rows in both files rather than in neither (S106), and a retry re-appends, so
 * duplicates are what a half-finished archive is DESIGNED to leave behind. */
{
  const root = world({ alpha: { boardDir: '.board',
    rows: [{ class: 'dup', session: 's1', at: '2026-01-01 10:00:00' }, { class: 'dup', session: 's2', at: '2026-02-02 10:00:00' }],
    archived: [{ class: 'dup', session: 's1', at: '2026-01-01 10:00:00' }] } });
  const r = run(root);
  ok('a row present in both files is counted once', /  2 row\(s\) from 1 project/.test(r.out));
  /* THE COUNT IS TAKEN FROM THE FILE AND BEFORE ANY SUPPRESSION. Counting only rows found SOLELY
   * in the archive reported zero for a half-finished archive, which is precisely the state the
   * count was written to make visible, and the comment beside it claimed a zero there would be
   * the defect back. This fixture IS a half-finished archive. */
  ok('and the archive is still reported as read, in the one state the count exists for',
    /1 row\(s\) are held in an archive/.test(r.out));
}

/* DEDUPE IS ARCHIVE-AGAINST-LIVE AND MUST NOT REACH INSIDE ONE FILE. `at` is second-granularity
 * and the first key carried no content, so two genuinely different findings written by one session
 * in the same second and the same class collapsed into one, and which one survived was arbitrary.
 * They are both visible under --full, which is the mode somebody opens to investigate. */
{
  const root = world({ alpha: { boardDir: '.board', rows: [
    { class: 'same', session: 's1', at: '2026-01-01 10:00:00', finding: 'the first finding' },
    { class: 'same', session: 's1', at: '2026-01-01 10:00:00', finding: 'a SECOND and different finding' },
    { class: 'same', session: 's2', at: '2026-02-01 10:00:00', finding: 'third' }
  ] } });
  const r = run(root, ['--full']);
  ok('two distinct findings sharing a session, a class and a second are both kept',
    /the first finding/.test(r.out) && /a SECOND and different finding/.test(r.out));
  ok('and the row count says three rather than two', /  3 row\(s\) from 1 project/.test(r.out));
}

/* THE FINDING IS PART OF THE KEY, AND THAT ONLY SHOWS WHERE THE KEY IS CONSULTED. Suppression is
 * archive-against-live and archive-against-archive, never live-against-live, so a fixture whose
 * twins both sit in the live record proves nothing about the key at all: it passes with the
 * finding dropped from it. The twin has to be ARCHIVED. */
{
  const root = world({ alpha: { boardDir: '.board',
    rows: [
      { class: 'same', session: 's1', at: '2026-01-01 10:00:00', finding: 'the live finding' },
      { class: 'same', session: 's2', at: '2026-02-01 10:00:00', finding: 'a later sitting' }
    ],
    archived: [
      { class: 'same', session: 's1', at: '2026-01-01 10:00:00', finding: 'an ARCHIVED twin that differs only in its words' }
    ] } });
  const r = run(root, ['--full']);
  ok('an archived row sharing a session, a class and a second with a live row, but NOT its finding, '
   + 'is a different row and is kept', /an ARCHIVED twin that differs only in its words/.test(r.out));
  ok('and the count says three', /  3 row\(s\) from 1 project/.test(r.out));
}

/* ARCHIVE-AGAINST-ARCHIVE, which the narrower key lost when it replaced the cruder one. Append
 * succeeds, the rewrite fails, the operator retries: the archive holds the row twice and the live
 * record holds it none. That is a documented outcome of this tool's own failure exits. */
{
  const twin = { class: 'dupe', session: 's1', at: '2026-01-01 10:00:00', finding: 'appended twice by a retry' };
  const root = world({ alpha: { boardDir: '.board',
    rows: [{ class: 'dupe', session: 's2', at: '2026-03-01 10:00:00', finding: 'a later sitting' }],
    archived: [twin, twin] } });
  const r = run(root, ['--full']);
  ok('a row appended to the archive twice by a retry is counted once', /  2 row\(s\) from 1 project/.test(r.out));
}

/* THE ESCAPE NOTICES ARE AN UNCAPPED LIST WRITTEN BY HAND, and they were reserved ahead of
 * everything. Ten allow entries with no reason produced ten notices in an eight-line block, and
 * the header and all twenty class names went out to make room: a reservation that can be repeated
 * without limit is a second uncapped list wearing the word reserved. Reachable by writing the
 * allow file as a list of strings, which is what somebody does before reading the format. */
{
  const spec = { alpha: { boardDir: '.board', rows: [] } };
  for (let i = 0; i < 20; i++) {
    spec.alpha.rows.push({ class: 'kx-' + i, session: 'sA' });
    spec.alpha.rows.push({ class: 'kx-' + i, session: 'sB' });
  }
  const root = world(spec);
  const allowFile = path.join(root, 'allow.json');
  const many = [];
  for (let i = 0; i < 10; i++) many.push({ class: 'no-reason-' + i });
  fs.writeFileSync(allowFile, JSON.stringify(many), 'utf8');
  const r = run(root, ['--allow-file', allowFile, '--brief']);
  const lines = r.out.trim().split(/\r?\n/);
  ok('ten escape notices cannot break the line cap', lines.length <= 8);
  ok('and the block still says what came back, rather than being all housekeeping',
    /fault class\(es\) have come back/.test(r.out));
  ok('and it still says what to do about it', /Full record: node tools\/doctor-across\.js --full/.test(r.out));
  ok('while the notices are rolled up rather than dropped in silence',
    /more problem\(s\) with allow\.json/.test(r.out));
  ok('and the character cap holds', r.out.trim().length <= 700);
}

/* ONE CLASS, LONGER ON ITS OWN THAN THE WHOLE CHARACTER BUDGET. This is the fixture that drives
 * the character loop to n = 0, and without it the floor in that loop is unproved: changing `n > 0`
 * to `n > 1` leaves every other case green, and one over-long class then falls through to the hard
 * slice with the instruction gone, which is the round-three HIGH returning by a different door.
 * The 6x73 fixture stops at n = 1 and can never reach it. */
{
  const long = 'x'.repeat(900);
  const root = world({ alpha: { boardDir: '.board', rows: [
    { class: long, session: 'sA' }, { class: long, session: 'sB' }
  ] } });
  const r = run(root, ['--brief']);
  ok('a single class longer than the whole budget is dropped rather than sliced',
    r.out.indexOf(long) === -1);
  ok('and the instruction survives even when NOTHING can be shown',
    /Full record: node tools\/doctor-across\.js --full/.test(r.out));
  ok('and the count says one', /1 more class line\(s\)/.test(r.out));
  ok('and the block is inside the character cap', r.out.trim().length <= 700);
  ok('and no truncation notice is needed, because a name was dropped instead of the text sliced',
    /truncated at 700 characters/.test(r.out) === false);
}

/* THE NUMBER IN THE CUT NOTICE, ASSERTED AS ARITHMETIC. It was covered only by its wording, so
 * `dropped + 1` was green: the notice said 21 for 20, which is the LOW that started this. What
 * makes it checkable is that shown plus dropped must equal the total the header names. */
{
  const spec = { alpha: { boardDir: '.board', rows: [] } };
  for (let i = 0; i < 20; i++) {
    spec.alpha.rows.push({ class: 'kn-' + i, session: 'sA' });
    spec.alpha.rows.push({ class: 'kn-' + i, session: 'sB' });
  }
  const r = run(world(spec), ['--brief']);
  /* THE TOTAL IS READ OUT OF THE HEADER, not written here as a literal. This assertion was NAMED
   * 'equal the 20 the header names' and compared against the number 20, so the header's own count
   * was pinned nowhere and could say anything. A name that claims to check one thing while the
   * code checks another is the comment-contradicts-code class wearing an assertion. */
  const shown = (r.out.match(/^ {2}kn-\d+ /gm) || []).length;
  const m = r.out.match(/and (\d+) more class line\(s\)/);
  const dropped = m ? Number(m[1]) : -1;
  const h = r.out.match(/DOCTOR: (\d+) fault class\(es\) have come back/);
  const total = h ? Number(h[1]) : -1;
  ok('the header counts the 20 classes that recurred', total === 20);
  ok('and the names shown plus the names dropped equal what the header names: ' + shown + ' + ' + dropped + ' vs ' + total,
    total > 0 && shown + dropped === total);
}

/* An allow file that is valid JSON and the wrong shape. The loop that reads it sits outside the
 * read's try, so an object under "allowed" threw a TypeError that left as exit 1 with nothing
 * printed, from the one mode whose contract is that it always exits 0. */
{
  const root = world({ beta: { boardDir: '.board', rows: [
    { class: 'has-ticket', session: 's1', ticket: 'ST-9' }, { class: 'has-ticket', session: 's2', ticket: 'ST-9' }
  ] } });
  const f = path.join(root, 'allow.json');
  fs.writeFileSync(f, '{"allowed":{}}', 'utf8');
  const r = run(root, ['--allow-file', f]);
  ok('an allow file of the wrong shape does not crash the reader', r.code === 0);
  ok('and it is reported rather than treated as an empty list', /neither a list of entries/.test(r.out));
  const b = run(root, ['--allow-file', f, '--brief']);
  ok('and the brief still exits 0, which is the contract it was breaking', b.code === 0);

  fs.writeFileSync(f, JSON.stringify(['a', 'b']), 'utf8');
  const dup = run(root, ['--allow-file', f, '--brief']);
  /* === 1 AND NOT <= 1, because <= 1 is green at ZERO. Rename the notice and this assertion,
   * whose name says it produces ONE, passes with the notice gone entirely. It is the same shape
   * as the cap assertion that said <= 9 against a cap of 8 and could not see the cap move. An
   * assertion about a count has to be the count. */
  ok('two entries with the same fault produce ONE notice, not two spending the whole budget',
    (dup.out.match(/an entry with no class/g) || []).length === 1);
}

const EXPECTED_ASSERTIONS = 99;
if (pass + fail !== EXPECTED_ASSERTIONS) {
  console.log('FAIL  the suite ran ' + (pass + fail) + ' assertion(s) and expects ' + EXPECTED_ASSERTIONS + '. A block was skipped or deleted. Find out which before you change the number.');
  fail++;
}

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
