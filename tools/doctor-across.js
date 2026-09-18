#!/usr/bin/env node
'use strict';

/*
 * doctor-across.js -- the studio reads every project's doctor rows and says which faults have
 * come back. Slice 3 of ST-240, and the half the CEO asked for in their own words: "the doctor
 * funnels that info to the studio so that when studio is doing a warm start it knows what
 * happened in each project and is able to plan improvements".
 *
 * ST-244 MADE A FINDING DURABLE. THIS MAKES IT READ. A record nobody opens is .studio-hooks.log
 * with a schema: 407 lines, written faithfully for weeks, read by nothing, and the one instrument
 * proving the studio's only session-level control worked could not be read by any check.
 *
 * THE OBLIGATION IS THE WHOLE POINT, and three roles said so independently at the front door.
 * "Assess what to change" is not an obligation, and a row nobody must act on is scrollback with
 * a file extension. So the rule this enforces is narrow and checkable: A CLASS SEEN IN TWO
 * DIFFERENT SITTINGS MUST CARRY A TICKET. Not two rows, two SITTINGS: one session that writes the
 * same class twice has found one fault twice in one afternoon, which is an incident. The same
 * class returning in a later session is the thing this studio keeps paying for.
 *
 * NO NEW RUNNER, AND THAT WAS AN OBJECTION RATHER THAN AN OVERSIGHT. Nine checks already sit in a
 * set nothing triggers (ST-241), so a tenth gate with its own scheduler would be the same defect
 * wearing a new name. This is an ordinary instrument in run-checks' SESSION-START set, which is
 * the set that actually runs, and its refusal is that set's refusal.
 *
 * WHY IT LOOKS FOR A BOARD RATHER THAN FOR A DIRECTORY CALLED .board. S218: a ticket sat open for
 * sittings claiming a sibling project ran off-board and that nothing here could see it. That
 * project had 154 live tickets. Our tools defaulted to one directory name; the program that OWNS
 * the board resolves it four ways. An absence reported by an instrument that looks in one place
 * is a claim about the instrument. So a board here is DEFINED the way board.js defines one, a
 * directory holding project.json beside a tickets directory, and it is found rather than assumed.
 *
 * READ-ONLY, ALWAYS. The standing instruction is not to touch other projects. This opens their
 * files and writes nothing anywhere, which is why the funnel needs no network, no credentials and
 * no cross-repository write. ST-240 d1 authorised each project to write its OWN row at its own
 * wind-down; it did not authorise this studio to write into anybody.
 *
 * WHAT A SESSION SEES AT START IS CAPPED. The full record is read on demand and never imported:
 * an imported record is a charge on every request for the life of the session, measured at 36k
 * here and at 324k and 387k in two sibling projects. The summary names what recurred and what
 * carries no ticket, says how many lines it left out, and prints the command that shows the rest.
 *
 *   node tools/doctor-across.js                       the capped summary
 *   node tools/doctor-across.js --full                every row, on demand
 *   node tools/doctor-across.js --project <name>      one project
 *   node tools/doctor-across.js --brief               the capped block the SessionStart hook injects
 *   options: --projects-root <dir>  --cap <n>  --quiet  --allow-file <path>
 *
 * --brief was missing from this list while being the mode with the most callers, because it is
 * the one a hook runs rather than a person. A usage block that omits the mode nobody types is
 * how a reader concludes a flag does not exist.
 *
 * AND THE LINE ABOVE ONCE READ `--allow <class> --reason "<why>"`, WHICH NO CODE HERE HAS EVER
 * READ. It was written in the same commit as the sentence complaining about a usage block that
 * omits a real mode, which is the opposite error and the more dangerous one: an omission sends a
 * reader to the source, an invention sends them to a flag that is accepted, ignored and silently
 * does nothing. The escape is a FILE, because the caller that needs it most is a hook with no
 * command line of its own.
 *
 * Exit 0 clean, 1 a recurring class carries no ticket, 2 a read error, 3 CANNOT TELL: no record
 * anywhere, which is an absence of evidence and never a clean bill of health.
 */

const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
/* Read by nothing in this file: arg() walks argv directly. Kept and completed rather than deleted
 * because the moment a positional argument is added this is the list that stops it eating a flag's
 * value, and an incomplete list is worse than none. --allow-file was missing from it. */
const TAKES_VALUE = ['--projects-root', '--project', '--cap', '--allow-file'];
function arg (name, fallback) {
  for (let i = 0; i < argv.length; i++) if (argv[i] === name) return argv[i + 1] === undefined ? fallback : argv[i + 1];
  return fallback;
}
function has (name) { return argv.indexOf(name) !== -1; }
const quiet = has('--quiet');
function out (s) { if (!quiet) process.stdout.write(s + '\n'); }
function always (s) { process.stdout.write(s + '\n'); }

const DEFAULT_CAP = 12;
/* BOTH FILES, AND THE ARCHIVE IS NOT OPTIONAL (ST-277 MEDIUM-5). doctor-record rolls old rows
 * into the archive at every wind-down and, until this line, nothing anywhere read the file it
 * wrote. Recurrence is counted as the number of distinct SITTINGS a class appears in, so moving
 * a row out of the live record took a sitting off that count: a class first seen long ago and
 * seen again today came back as seen ONCE, and the check stopped refusing on exactly the classes
 * that have been coming back longest. That is the one number ST-240 exists to drive to zero,
 * being reset by the routine that runs most often, on a schedule nobody chose.
 *
 * The cost of the extra read is paid once by whoever runs the tool. What a session pays for on
 * every request is the --brief block, which is capped in lines and in characters regardless of
 * how many rows were read to produce it. */
const RECORD = 'doctor-findings.jsonl';
const RECORD_ARCHIVE = 'doctor-findings-archive.jsonl';
const WALK_DEPTH = 3;

/* A board is what board.js says a board is: a directory holding project.json with a tickets
 * directory beside it. Found by walking a shallow way into the project rather than by guessing a
 * name, because two projects here keep theirs in directories with different names and the one
 * that looked only for `.board` reported a 154-ticket board as absent (S218). */
function findBoards (projectDir) {
  const found = [];
  const stack = [{ dir: projectDir, depth: 0 }];
  while (stack.length) {
    const { dir, depth } = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { continue; }
    const names = new Set(entries.filter(e => !e.isDirectory()).map(e => e.name));
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    if (names.has('project.json') && dirs.indexOf('tickets') !== -1) { found.push(dir); continue; }
    if (depth >= WALK_DEPTH) continue;
    for (const d of dirs) {
      if (d === '.git' || d === 'node_modules' || d === '.public' || d === '.archive') continue;
      stack.push({ dir: path.join(dir, d), depth: depth + 1 });
    }
  }
  return found;
}

/* Same tolerance as the writer, for the same reason: a reader that refuses on a damaged record
 * locks out every project at once, and the damage this expects is the half-written last row of a
 * wind-down that crashed. Counted and named, never thrown. */
function readRows (file) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch (e) { return { rows: [], bad: [{ why: e.message }] }; }
  const rows = []; const bad = [];
  const lines = raw.replace(/^﻿/, '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    let o;
    try { o = JSON.parse(line); } catch (e) { bad.push({ line: i + 1, why: e.message }); continue; }
    if (!o || typeof o !== 'object' || Array.isArray(o) || !o.class || !o.session) {
      bad.push({ line: i + 1, why: 'no class or session' }); continue;
    }
    rows.push(o);
  }
  return { rows: rows, bad: bad };
}

const studioRoot = path.resolve(__dirname, '..');
const projectsRoot = path.resolve(arg('--projects-root', path.dirname(studioRoot)));
const only = arg('--project', null);
const cap = Math.max(1, parseInt(arg('--cap', String(DEFAULT_CAP)), 10) || DEFAULT_CAP);

let projectDirs;
try {
  projectDirs = fs.readdirSync(projectsRoot, { withFileTypes: true })
    .filter(e => e.isDirectory()).map(e => e.name).sort();
} catch (e) {
  always('CANNOT READ  ' + projectsRoot + ': ' + e.message);
  process.exit(2);
}
if (only) projectDirs = projectDirs.filter(n => n.toLowerCase() === only.toLowerCase());

const all = [];
const withRecord = [];
const withBoardNoRecord = [];
const noBoard = [];
let badLines = 0;
let archivedRows = 0;

for (const name of projectDirs) {
  const boards = findBoards(path.join(projectsRoot, name));
  if (!boards.length) { noBoard.push(name); continue; }
  let any = false;
  for (const b of boards) {
    /* SEEN, so a row that is in BOTH files is one row. Archiving appends to the destination and
     * then rewrites the source, and each of its three failure exits deliberately leaves the rows
     * in both places rather than in neither (S106). A retry then re-appends. So duplicates are
     * not a hypothetical: they are what a half-finished archive is DESIGNED to leave behind, and
     * counting them twice would inflate the row count the report leads with. */
    /* THE DEDUPE IS ARCHIVE-AGAINST-LIVE AND NOTHING ELSE, AND THE SCOPE IS THE WHOLE CARE.
     * Archiving appends to the destination and then rewrites the source, and each of its three
     * failure exits deliberately leaves the rows in both places rather than in neither (S106). A
     * retry then re-appends. So a row in BOTH files is what a half-finished archive is DESIGNED
     * to leave behind, and counting it twice would inflate the row count this report leads with.
     *
     * The first version of this dropped rows INSIDE one file as well, because one `seen` set
     * spanned both passes and the key was at-plus-session-plus-class with no content in it. `at`
     * is second-granularity, so two genuinely different findings written by one session in the
     * same second and the same class collapsed into one, and the one that survived was arbitrary.
     * The justification written above is about two FILES; the code was quietly doing something
     * wider. A key now carries the finding, and the set only suppresses an archive row that the
     * live record already showed. */
    const liveKeys = new Set();
    const archiveKeys = new Set();
    const keyOf = row => row.at + '|' + row.session + '|' + row.class + '|' + String(row.finding || '').slice(0, 120);
    for (const which of [RECORD, RECORD_ARCHIVE]) {
      const file = path.join(b, which);
      if (!fs.existsSync(file)) continue;
      any = true;
      const r = readRows(file);
      badLines += r.bad.length;
      /* Counted from the FILE and before any suppression, because the claim this number backs is
       * that the archive is read at all. Counting only rows found solely in the archive reported
       * zero for a half-finished archive, which is the exact state the count was written for. */
      if (which === RECORD_ARCHIVE) archivedRows += r.rows.length;
      for (const row of r.rows) {
        const k = keyOf(row);
        /* ARCHIVE-AGAINST-LIVE *AND* ARCHIVE-AGAINST-ARCHIVE. The first version of this suppressed
         * only against the live record, which lost a case the cruder key it replaced had covered:
         * append succeeds, rewrite fails, the operator retries, and the ARCHIVE now holds the row
         * twice while the live record holds it none. That is a documented outcome of this tool's
         * own failure exits, not a hypothetical. The live pass still suppresses nothing, because
         * two rows in one live file with different findings are two findings. */
        if (which === RECORD_ARCHIVE) {
          if (liveKeys.has(k) || archiveKeys.has(k)) continue;
          archiveKeys.add(k);
        } else {
          liveKeys.add(k);
        }
        all.push(Object.assign({}, row, { from: name }));
      }
    }
  }
  (any ? withRecord : withBoardNoRecord).push(name);
}

/* Keyed by class alone and NOT by class-plus-project, deliberately. The studio's whole reason for
 * reading across is to notice that a fault found in one project is the fault another project is
 * about to find, which a per-project count can never show. */
const byClass = new Map();
for (const r of all) {
  if (!byClass.has(r.class)) byClass.set(r.class, { rows: [], sessions: new Set(), projects: new Set(), tickets: new Set() });
  const e = byClass.get(r.class);
  e.rows.push(r);
  e.sessions.add(r.session);
  e.projects.add(r.from);
  if (r.ticket) e.tickets.add(r.ticket);
}

const recurring = [...byClass.entries()]
  .filter(e => e[1].sessions.size > 1)
  .sort((a, b) => b[1].sessions.size - a[1].sessions.size);
const allUnticketed = recurring.filter(e => e[1].tickets.size === 0);

/* ---- THE WRITTEN-REASON ESCAPE (S232, ST-277) ----
 *
 * S232 in full: a refusal that names no way out gets the PREDICATE weakened instead. This tool
 * shipped with no escape at all while its sibling doctor-record.js had one, and the pressure was
 * already visible: it reads ACROSS projects, so the studio's session start can be refused on a
 * class belonging to a project the studio has a standing instruction not to touch. The tempting
 * repair is to stop counting other projects' classes, which makes the instrument quietly weaker
 * everywhere in order to fix one case, and leaves the next reader unable to see why.
 *
 * So the escape has the four properties S232 names. It is DECLARED, per class, in a file a reader
 * will find. It carries a REASON in words somebody can disagree with. It is PRINTED on every run
 * rather than swallowed, through always() so --quiet cannot hide it. And an entry that no longer
 * excuses anything is reported STALE and still FAILS, which is what stops the list outliving what
 * it excused. */
const ALLOW_FILE = arg('--allow-file', path.join(__dirname, 'doctor-across-allow.json'));
let allow = [];
let allowWhy = null;
if (fs.existsSync(ALLOW_FILE)) {
  try {
    const parsed = JSON.parse(fs.readFileSync(ALLOW_FILE, 'utf8'));
    /* THE SHAPE IS CHECKED, NOT ASSUMED, and the loop below is the reason. It iterates `allow`,
     * it sits outside this try, and `parsed.allowed || []` handed it whatever was under that key:
     * an object gave a TypeError that escaped as exit 1 with nothing printed, from a mode whose
     * stated contract is that it always exits 0. A file that is valid JSON and the wrong shape is
     * the ordinary case here, because the shape is written by hand from a printed example. */
    if (Array.isArray(parsed)) allow = parsed;
    else if (parsed && Array.isArray(parsed.allowed)) allow = parsed.allowed;
    else allowWhy = 'it parsed, but it is neither a list of entries nor an object with an "allowed" list.';
  } catch (e) { allowWhy = e.message; }
}
const allowByClass = new Map();
const allowIncomplete = [];
for (const a of allow) {
  if (a && a.class && a.reason) { allowByClass.set(a.class, a); continue; }
  /* Dropped entries are NAMED. Failing closed is right, doing it silently is not: an entry written
   * without a reason is somebody who meant to excuse a class and will believe they did. */
  allowIncomplete.push(a && a.class ? a.class + ' (no reason given)' : 'an entry with no class');
}

const excused = allUnticketed.filter(e => allowByClass.has(e[0]));
const unticketed = allUnticketed.filter(e => !allowByClass.has(e[0]));
/* An entry excusing a class that is not currently recurring-and-unticketed is stale. It may have
 * been ticketed since, or stopped recurring, or never matched a real class at all: all three mean
 * the line is now excusing nothing and the next reader would take it as still load-bearing. */
const stale = [...allowByClass.keys()].filter(c => !excused.some(e => e[0] === c));

/* ---- --brief: the only part of this tool that a session PAYS FOR ON EVERY REQUEST ----
 *
 * ST-276. The rest of this program is read once by somebody who ran it. This block is injected
 * into the session at start and then re-sent with every single request for the life of that
 * session, so a line here is priced at the length of the session and not at one read. S210, where
 * a 1,347-character governance addition cost about 62,700 tokens a session and saved 49,700.
 *
 * SO IT PRINTS NOTHING WHEN THERE IS NOTHING TO ACT ON. Not a clean bill of health, not a count
 * of what passed: nothing, and the hook then adds nothing. A reassuring line carries no
 * information and is charged at the same rate as a useful one.
 *
 * AND IT ALWAYS EXITS 0. The refusal below belongs to the check that runs in a set. This mode
 * feeds a SessionStart hook, and a hook that fails takes the session's orientation with it. The
 * founder brief immediately above it in studio.ps1 is wrapped for exactly that reason. */
const MAX_BRIEF_LINES = 8;
const MAX_BRIEF_CHARS = 700;

if (has('--brief')) {
  const lines = [];
  /* THE ESCAPE HAS TO REACH THE MODE THE HOOK RUNS. The S232 comment above says the reason is
   * printed on every run, and that was true of every mode a PERSON types and false of the one a
   * SessionStart hook runs, which is the only mode most sessions ever see. An escape nobody sees
   * is an exception nobody reviews. A stale entry cannot exit non-zero here, because this mode's
   * contract is that it never takes a session down, so it is reported as work instead. */
  /* THE LINE THAT SAYS WHAT TO DO IS RESERVED OUT OF THE CAP, not merely ordered ahead of the
   * things that used to displace it. Reordering the escape notices fixed the six-class case and
   * left the SEVEN-class case exactly as broken: the class list alone reaches the cap and the
   * instruction is the line that falls off, so a session is handed names with nothing to run and
   * no way to see the rest. The cap exists to bound COST, and the instruction is one line; what
   * it can afford to lose is a name, which the count then reports.
   *
   * So the list is built in three parts and only the middle one is cut. */
  const must = [];
  let header = null;
  if (unticketed.length) {
    header = 'DOCTOR: ' + unticketed.length + ' fault class(es) have come back in a later sitting and carry no ticket.';
    for (const [cls, e] of unticketed) {
      lines.push('  ' + cls + '  ' + e.sessions.size + ' sittings, ' + [...e.projects].join(', '));
    }
    const ticketed = recurring.length - unticketed.length;
    if (ticketed) lines.push('  (' + ticketed + ' more recurring class(es) already carry a ticket.)');
    must.push('Raise each or attach it to the ticket that covers it. Full record: node tools/doctor-across.js --full');
  }
  /* THE ESCAPE NOTICES ARE BOUNDED AND THEY ARE NOT THE THING THAT GETS CUT. Each is trimmed, and
   * the list is capped, because it is written by whoever edits the allow file and is therefore
   * the one input here with no natural limit: an allow file holding ten entries with no reason
   * produced ten notices, reserved ahead of everything, and pushed the header and all twenty class
   * names out of an eight-line block. A reserved line that can be repeated without limit is not a
   * reservation, it is a second uncapped list. */
  const NOTE_CAP = 2;
  const NOTE_WIDTH = 160;
  const base = path.basename(ALLOW_FILE);
  let notes = [];
  if (allowWhy) notes.push('DOCTOR: ' + base + ' cannot be read, so NOTHING is excused: ' + allowWhy);
  for (const a of allowIncomplete) notes.push('DOCTOR: ' + base + ' carries ' + a + ', so it excuses nothing.');
  if (stale.length) notes.push('DOCTOR: ' + stale.length + ' stale escape(s) in ' + base + ' now excuse nothing. Remove them or find out why the class stopped appearing.');
  notes = notes.map(s => s.length > NOTE_WIDTH ? s.slice(0, NOTE_WIDTH - 3) + '...' : s);
  /* Deduped BEFORE the cap, because two identical notices spend the whole budget saying one thing.
   * An allow file written as ["a","b"] produces the same "an entry with no class" line twice. */
  notes = notes.filter((s, i) => notes.indexOf(s) === i);
  if (notes.length > NOTE_CAP) {
    notes = notes.slice(0, NOTE_CAP - 1)
      .concat(['DOCTOR: and ' + (notes.length - (NOTE_CAP - 1)) + ' more problem(s) with ' + base + '. node tools/doctor-across.js --full']);
  }

  /* ASSEMBLED AT A GIVEN NUMBER OF CLASS LINES, so the two caps can be applied by ASKING rather
   * than by arithmetic. The previous version reserved the instruction out of the LINE cap and
   * then ran a character cap that sliced the finished string from the end, which put the
   * instruction back at the bottom of the thing being cut: fixed on one axis and left broken on
   * the other, and the assertion written for it lived in the one fixture too short to reach the
   * character cap. Both caps now drop the same thing, which is a class NAME, and the count says
   * how many. The header is not a class line and is no longer counted as one. */
  const classLines = lines.slice();
  const assemble = (n) => {
    const out = [];
    if (header) out.push(header);
    for (let i = 0; i < n && i < classLines.length; i++) out.push(classLines[i]);
    const dropped = classLines.length - Math.min(n, classLines.length);
    if (dropped > 0) out.push('  ... and ' + dropped + ' more class line(s), capped here because this block is re-sent on every request.');
    for (const m of must) out.push(m);
    for (const nline of notes) out.push(nline);
    return out;
  };

  let n = classLines.length;
  while (n > 0 && assemble(n).length > MAX_BRIEF_LINES) n--;
  while (n > 0 && assemble(n).join('\n').length > MAX_BRIEF_CHARS) n--;
  const assembled = assemble(n);
  let text = assembled.join('\n');
  /* THE LAST RESORT. An earlier version of this said it was the only path that can still cut the
   * instruction, and that was false when it was written: assemble() puts the instruction ahead of
   * the notices and this slices from the end, so header plus cut notice plus instruction is about
   * 274 characters against a slice point of 646 and the instruction cannot be reached. The slice
   * leaves room for its own notice, so the block is never longer than the cap it names and a
   * mutation to that number has somewhere to show. */
  /* THIS BRANCH IS UNREACHABLE TODAY AND IS WRITTEN DOWN AS SUCH RATHER THAN LEFT AS A SILENT
   * GAP, which is the same declaration doctor-record.js makes about its read-back control. With n
   * driven to 0 the block is a header, a cut notice, the instruction and at most two notices, and
   * the ceiling is about 649 characters against a cap of 700.
   *
   * THE ARITHMETIC NAMES THE WRONG BOUND IF IT STOPS AT THE 160-CHARACTER TRIM, which an earlier
   * version of this paragraph did, computing 598. The rollup line is BUILT AFTER that trim and
   * carries the basename untrimmed, so it is the one unbounded term here. What actually holds the
   * ceiling is the dedupe two blocks up, which that version did not mention. A reviewer measured
   * the branch firing with NOTE_WIDTH at 400, so it is a live backstop and not dead code: the
   * conclusion was right and the reasoning was incomplete, which is the harder kind to catch.
   *
   * So no input reaches it today, deleting it leaves the suite green, and it stays because the
   * alternative is emitting a block longer than the cap it names if any of those bounds is ever
   * loosened. A control nobody has watched fail and a control that cannot fail are the same thing
   * until somebody says which. This is the second. */
  const TRUNC = '\n  ... truncated at ' + MAX_BRIEF_CHARS + ' characters for the same reason.';
  if (text.length > MAX_BRIEF_CHARS) text = text.slice(0, MAX_BRIEF_CHARS - TRUNC.length) + TRUNC;
  if (text) process.stdout.write(text + '\n');
  process.exit(0);
}

out('');
out('DOCTOR, ACROSS PROJECTS  ' + projectsRoot);
out('  ' + all.length + ' row(s) from ' + withRecord.length + ' project(s) with a record.');
if (withBoardNoRecord.length) {
  out('  ' + withBoardNoRecord.length + ' project(s) have a board and NO record, which is an absence');
  out('  of evidence rather than a clean run: ' + withBoardNoRecord.slice(0, 6).join(', ') +
    (withBoardNoRecord.length > 6 ? ' and ' + (withBoardNoRecord.length - 6) + ' more' : ''));
}
/* S207 AND S218, CORRECTED ON THE FIRST REAL RUN. This line said "run no board at all", and on
 * that run it counted a project that runs 154 live tickets on the Supabase-backed board this
 * studio itself published. The predicate measured is narrower than the claim made: no FILE board
 * was found. A database board is invisible to a tool that reads files, and saying so is the
 * difference between a limitation and a false report about somebody else's project. */
if (noBoard.length) {
  out('  ' + noBoard.length + ' project(s) hold no FILE board this tool can read. That is a claim about');
  out('  this instrument and not about them: the published board also runs on a database, and a');
  out('  database board is invisible here. Do not read this row as "runs no board".');
}
if (badLines) out('  ' + badLines + ' line(s) could not be parsed and were counted rather than ignored.');
/* Printed rather than assumed, because the whole finding was that this file existed and was read
 * by nothing. A count of zero here after a wind-down that archived rows is the same defect back. */
if (archivedRows) out('  ' + archivedRows + ' row(s) are held in an archive and are counted for recurrence exactly as live rows are.');

if (!all.length) {
  out('');
  always('CANNOT TELL  no doctor record exists in any project under ' + projectsRoot + '.');
  always('             Nothing has been written yet, so nothing can be read. That is not a clean');
  always('             bill of health. ST-244 is the writing half. ST-245.');
  out('');
  process.exit(3);
}

const full = has('--full');
out('');
if (recurring.length) {
  out('  CLASSES SEEN IN MORE THAN ONE SITTING. This is the number ST-240 drives to zero:');
  const show = full ? recurring : recurring.slice(0, cap);
  for (const [cls, e] of show) {
    out('    ' + cls + '  ' + e.sessions.size + ' sitting(s), ' + e.projects.size + ' project(s)' +
      (e.tickets.size ? ', ticket ' + [...e.tickets].join(' ') : ', NO TICKET'));
    if (e.projects.size > 1) out('      seen in ' + [...e.projects].join(', ') + ', so it is not one project\'s habit.');
    if (full) for (const r of e.rows) out('      ' + r.at + '  ' + r.from + '  ' + String(r.finding).slice(0, 100));
  }
  if (!full && recurring.length > show.length) {
    out('    ' + (recurring.length - show.length) + ' more not shown. This summary is CAPPED because it');
    out('    is read at session start and an uncapped one is a charge on every request.');
    out('    node tools/doctor-across.js --full');
  }
} else {
  out('  No class has been seen in more than one sitting.');
}

if (full) {
  const once = [...byClass.entries()].filter(e => e[1].sessions.size === 1);
  out('');
  out('  SEEN ONCE, ' + once.length + ' class(es):');
  for (const [cls, e] of once) out('    ' + cls + '  ' + e.rows[0].from + '  ' + String(e.rows[0].finding).slice(0, 100));
}

if (allowWhy) {
  always('');
  always('CANNOT READ  ' + ALLOW_FILE + ': ' + allowWhy);
  always('             An unreadable escape list is treated as EMPTY, so nothing is excused by a');
  always('             file nobody can parse. Repair it or delete it.');
}
if (excused.length) {
  always('');
  always('  EXCUSED, ' + excused.length + ' class(es), each with a written reason (S232):');
  for (const [cls, e] of excused) {
    const a = allowByClass.get(cls);
    always('    ' + cls + '  ' + e.sessions.size + ' sitting(s) in ' + [...e.projects].join(', '));
    always('      ' + a.reason + (a.by ? '  -- ' + a.by : '') + (a.at ? ', ' + a.at : ''));
  }
}
/* REPORTED HERE, EXITED ON AT THE END. This block used to exit 1 on the spot, so a tree carrying
 * BOTH a stale escape and a real unticketed class printed the stale entry and then stopped,
 * hiding the finding list, which is the more urgent of the two. A report that suppresses the
 * finding in order to complain about the paperwork has its priorities backwards. */
if (stale.length) {
  always('');
  for (const c of stale) {
    always('STALE  ' + ALLOW_FILE + ' excuses ' + c + ', which is not currently a recurring class with no ticket.');
  }
  always('       An escape that suppresses nothing reads as still load-bearing to the next person.');
  always('       Remove the entry, or find out why the class stopped appearing.');
}

if (allowIncomplete.length) {
  always('');
  for (const a of allowIncomplete) always('IGNORED  ' + ALLOW_FILE + ' carries ' + a + ', so it excuses nothing.');
}

out('');
if (!unticketed.length) {
  /* The two endings are different claims and were printed as one. With a class excused, "every
   * recurring class carries a ticket" is false, and it is false in the direction that matters:
   * it tells a reader the list is empty when what is really true is that somebody signed for it. */
  out(excused.length
    ? '  Every recurring class carries a ticket or a written reason, ' + excused.length + ' of them excused above.'
    : '  Every recurring class carries a ticket.');
  out('');
  if (stale.length) { always(stale.length + ' stale escape(s). S232. ST-277.'); process.exit(1); }
  process.exit(0);
}

/* The refusal, and it is deliberately the ONLY thing this tool refuses on. Recurrence without a
 * ticket is the exact shape of the failure ST-240 was raised about: a fault found, written down,
 * found again, written down again, and never turned into work. */
always('');
for (const [cls, e] of unticketed) {
  always('REFUSED  ' + cls + ' has been seen in ' + e.sessions.size + ' sittings across ' +
    [...e.projects].join(', ') + ' and carries no ticket.');
  always('         first ' + e.rows.map(r => r.at).sort()[0] + '   ' + String(e.rows[0].finding).slice(0, 110));
}
always('');
always(unticketed.length + ' recurring class(es) with no ticket. A class seen twice is a standing');
always('defect rather than an incident. Raise it, or attach the row to the ticket that covers it:');
always('  node base/board/board.js raise "<what>" --size s --by studio');
always('  node tools/doctor-record.js write ... --ticket ST-000');
always('Or say in writing why it is not work, which is printed on every run afterwards (S232):');
always('  ' + ALLOW_FILE);
always('  [{ "class": "<slug>", "reason": "<why this is not work>", "by": "<who>", "at": "<date>" }]');
always('ST-245.');
process.exit(1);
