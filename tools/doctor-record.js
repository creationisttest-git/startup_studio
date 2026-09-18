#!/usr/bin/env node
'use strict';

/*
 * doctor-record.js -- the durable record of what the doctor found. One row per session,
 * appended at wind-down after the suite is quiet, read back across projects at warm-start.
 *
 * SLICE 2 OF ST-240 AND THE FIRST SLICE THAT CHANGES BEHAVIOUR.
 *
 * WHY THIS EXISTS, AND IT IS ONE NUMBER. No instrument in this studio has ever opened a review
 * transcript. Verified: grep -rlE 'subagents|agentType|toolUseId' over tools/ returns nothing,
 * exit 1. So every finding any reviewer has ever made lives in scrollback and dies with the
 * session that heard it, which is why the same classes keep coming back: fix-contains-its-own-
 * defect ran four consecutive sittings and zero-delta mutation ran three, each time discovered
 * fresh by somebody who had no way of knowing it was the fourth time.
 *
 * CEO DECISION ST-240 d1, in their own words: "every wind down of every project runs the doctor
 * for their own project and the doctor funnels that info to the studio so that when studio is
 * doing a warm start it knows what happened in each project and is able to plan improvements".
 * So every project writes rows FOR ITSELF and the studio reads across them. This file is the
 * writing half. ST-245 is the reading half and is deliberately a separate ticket.
 *
 * WHO WRITES, AND IT IS NOT THE SUBAGENT. The constraint is not that a subagent cannot write:
 * the doctor role carries Bash. It is that a tree write DURING a suite or gate run invalidates
 * the run it is part of, because every instrument here fingerprints the tree it measured. The
 * parent session at wind-down is the only actor that knows the tree is quiet, and it already
 * writes the state document at exactly that moment. So the parent writes the doctor's returned
 * text as a row, after the suite.
 *
 * THE PRECEDENT THIS COPIES is run-checks.js: a committed record file, excluded from its own
 * fingerprint, whose history is git's problem rather than the file's. 79 versions and counting.
 *
 * THE PRECEDENT THIS AVOIDS is .studio-hooks.log: 407 lines, gitignored, Detail field empty on
 * every one of them, read by nothing. That file proves a hook fired and never where, and a grep
 * across the tree returns only the three copies of the line that writes it. A durable row that
 * no check consumes is that file wearing a schema, and it is the single most likely way this
 * ticket fails. The gate below is the answer: a wind-down whose doctor ran and wrote no row
 * REFUSES, so the record cannot quietly stop being written.
 *
 * WHY JSON LINES AND NOT ONE JSON OBJECT. Peer sessions write into this repository at the same
 * time; that happened twice in the last two sittings and once mid-wind-down. A single mutable
 * object rewritten by two sessions merges silently and wrongly, because git sees one changed
 * region and takes a side. One self-contained object per line, only ever appended, turns the
 * same race into an ordinary textual conflict that a human is shown. Losing a row loudly beats
 * keeping the wrong one quietly.
 *
 * WHERE IT LIVES. Beside the board, honouring BOARD_HOME exactly as run-checks.js does, so a
 * project whose board sits outside its repository keeps its record with its board. It is
 * committed, and it is NEVER @-imported: an imported record is a charge on every request for
 * the life of every session, measured at 36k here and at 324k and 387k in two sibling projects.
 * The reader loads a capped summary and opens the full file on demand.
 *
 * RECOVERY IS DEFINED BEFORE THE FIRST ROW, because a reader that refuses on a damaged record
 * locks out every project at once. A wind-down that crashes half way leaves a truncated final
 * line. So a line that will not parse is COUNTED and NAMED and never fatal: reads report what
 * they could not use and carry on with what they could, and a record that is absent entirely is
 * CANNOT TELL rather than a pass or a failure.
 *
 * THE ARCHIVE RULE IS HERE ON DAY ONE rather than on the day it hurts. S153 and S221: a saving
 * taken only when a limit refuses makes the limit into a floor, and this repository spent six
 * consecutive sittings proving that about its own state document. `archive` runs unconditionally
 * and a no-op is free.
 *
 * FIRST-SEEN AND SEEN-COUNT ARE STAMPED AT WRITE and are a claim about the moment of writing,
 * never a running total to be trusted later. They are stamped anyway so that one row read alone
 * still says whether it is the first of its kind, and `show` recomputes from the whole file so
 * the two can be compared rather than assumed.
 *
 *   node tools/doctor-record.js write --session <id> --class <slug> --severity <s>
 *        --finding "<what>" --evidence "<the command that shows it>" [--ticket ST-000]
 *        [--project <name>] [--root <dir>] [--file <path>]
 *   node tools/doctor-record.js show [--class <slug>] [--limit <n>]
 *   node tools/doctor-record.js gate --session <id> [--reason "<why there is no row>"]
 *   node tools/doctor-record.js archive [--keep <n>] [--write]
 *
 * Exit 0 clean, 1 refused, 2 usage or read error, 3 cannot tell.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RECORD_VERSION = 1;
const SEVERITIES = ['critical', 'major', 'minor', 'note'];
const CLASS_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CLASS_MAX = 60;
const FINDING_MIN_WORDS = 4;
const DEFAULT_KEEP = 200;

const argv = process.argv.slice(2);

/* Walk by index rather than with find(). find() re-locates a repeated argument by its FIRST
 * occurrence, so a value that happens to equal an earlier flag gets the wrong neighbour read
 * and a flag's value is silently taken as something else. check-session-goal.js paid for this. */
const TAKES_VALUE = ['--session', '--class', '--severity', '--finding', '--evidence',
  '--ticket', '--project', '--root', '--file', '--limit', '--keep', '--reason'];

function arg (name, fallback) {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === name) return argv[i + 1] === undefined ? fallback : argv[i + 1];
  }
  return fallback;
}
function has (name) { return argv.indexOf(name) !== -1; }

/* THE ONE SOURCE OF THE SESSION ID. It is a function because it used to be two expressions.
 *
 * ST-277 HIGH-2, found by a dispatched code-reviewer on the exact range that would have shipped.
 * `write` read the flag and nothing else; `gate` read the flag OR CLAUDE_CODE_SESSION_ID. So a
 * wind-down that typed an id by hand wrote rows in one namespace and was then gated against
 * another, and the registered check could never match a row it had just watched be written. The
 * only way past it was --reason at every wind-down in every project, which is a control that
 * always refuses, which is the predicate-weakening S232 exists to stop, in the file that cites
 * S232. Two expressions for one identity IS the defect, so there is one expression now.
 *
 * The normalisation is applied to BOTH paths on purpose. Stripping it from one side is how the
 * two namespaces would come back: an id that survives the flag unchanged and gets rewritten on
 * the way out of the environment is two ids again, just more quietly.
 *
 * It returns the source as well as the id, because the one thing nobody could see while this
 * defect was live was WHERE each side got its id from. Both callers print it. */
function sessionId () {
  const flag = arg('--session', null);
  const fromFlag = flag !== null;
  const raw = String(fromFlag ? flag : (process.env.CLAUDE_CODE_SESSION_ID || ''));
  const id = raw.replace(/[^A-Za-z0-9_-]/g, '') || null;
  return { id, raw, source: fromFlag ? '--session' : 'CLAUDE_CODE_SESSION_ID', changed: id !== null && id !== raw };
}

function command () {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { if (TAKES_VALUE.indexOf(argv[i]) !== -1) i++; continue; }
    return argv[i];
  }
  return null;
}

function out (s) { process.stdout.write(s + '\n'); }

function usage (why) {
  if (why) out('doctor-record: ' + why);
  out('usage: doctor-record.js write|show|gate|archive [options]');
  out('  write    [--session <id>] --class <slug> --severity ' + SEVERITIES.join('|'));
  out('           --finding "<what>" --evidence "<the command that shows it>" [--ticket ST-000]');
  out('  show     [--class <slug>] [--limit <n>]');
  out('  gate     [--session <id>] [--reason "<why there is no row>"]');
  out('           Both default to CLAUDE_CODE_SESSION_ID. One source, so the gate cannot be');
  out('           asked about a namespace the writer never used (ST-277).');
  out('  archive  [--keep <n>] [--write]');
  process.exit(2);
}

function stamp (d) {
  const t = d || new Date();
  const p = n => String(n).padStart(2, '0');
  return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate()) + ' ' +
    p(t.getHours()) + ':' + p(t.getMinutes()) + ':' + p(t.getSeconds());
}

const root = path.resolve(arg('--root', process.cwd()));

/* Same resolution as run-checks.js, deliberately. Two files that sit beside each other must
 * agree about where "beside the board" is, or a project with BOARD_HOME set keeps its checks
 * in one place and its findings in another and nothing says so. */
/* A BOARD IS FOUND BY SHAPE, WHICH IS HOW ITS READER FINDS ONE (S218, ST-277). This writer used
 * to fall back to the literal name '.board', while doctor-across.js resolves a board the way
 * board.js DEFINES one: a directory holding project.json with a tickets directory beside it. Two
 * projects here keep theirs under different names, so in those the writer would have created a
 * second, empty .board and appended rows nobody reads, while the reader went on reporting that
 * the project had a board and no record. Both halves would have been working and the pair would
 * have been broken, which is the failure mode S218 is about: an absence reported by an instrument
 * that looked in one place is a claim about the instrument.
 *
 * The name is still the last resort, because a project with no board at all has to write
 * somewhere, and a fresh .board beside the work is the least surprising place. */
function findBoardDir (start) {
  const isBoard = d => { try { return fs.existsSync(path.join(d, 'project.json')) && fs.statSync(path.join(d, 'tickets')).isDirectory(); } catch (e) { return false; } };
  let dir = path.resolve(start);
  for (let up = 0; up < 4; up++) {
    if (isBoard(dir)) return dir;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { entries = []; }
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const cand = path.join(dir, ent.name);
      if (isBoard(cand)) return cand;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function boardDir () {
  const home = process.env.BOARD_HOME;
  if (home) return path.resolve(home);
  return findBoardDir(root) || path.join(root, '.board');
}

function recordPath (override) {
  if (override) return path.resolve(override);
  return path.join(boardDir(), 'doctor-findings.jsonl');
}

function archivePath (file) {
  return path.join(path.dirname(file), path.basename(file).replace(/\.jsonl$/, '') + '-archive.jsonl');
}

function git (args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (r.error || r.status !== 0) return null;
  return (r.stdout || '').trim();
}

/* The label is the PROJECT directory, which is the directory holding the board, and not whatever
 * directory the command happened to be typed in. doctor-across.js labels every row it reads with
 * the project folder's name, so a row stamped from a subdirectory arrived under a name that tool
 * would never produce, and the same fault in two projects would have been counted as two classes
 * in two places instead of one class recurring. S218, the same defect as the path above. */
function projectName () {
  const given = arg('--project', null);
  if (given) return given;
  const b = findBoardDir(root);
  if (b) return path.basename(path.dirname(b));
  return path.basename(root);
}

/* A damaged line is counted and named, never thrown. A wind-down that died half way through
 * its own write is exactly the case this record exists to survive, and the reader that refuses
 * on it takes every project down at once rather than the one that crashed. */
function readRows (file) {
  if (!fs.existsSync(file)) return { state: 'absent', rows: [], bad: [] };
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch (e) {
    return { state: 'unreadable', rows: [], bad: [], why: e.message };
  }
  const rows = [];
  const bad = [];
  const lines = raw.replace(/^﻿/, '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    let o;
    try { o = JSON.parse(line); } catch (e) {
      bad.push({ line: i + 1, why: e.message, text: line.slice(0, 80) });
      continue;
    }
    if (!o || typeof o !== 'object' || Array.isArray(o) || !o.class || !o.session) {
      bad.push({ line: i + 1, why: 'parsed but carries no class or session', text: line.slice(0, 80) });
      continue;
    }
    rows.push(o);
  }
  return { state: 'ok', rows: rows, bad: bad };
}

function reportBad (read, file) {
  if (!read.bad.length) return;
  out('  ' + read.bad.length + ' line(s) of ' + path.basename(file) + ' could not be used, and are');
  out('  named rather than ignored. A crashed wind-down leaves exactly this.');
  for (const b of read.bad.slice(0, 5)) out('    line ' + b.line + ': ' + b.why + '  ' + JSON.stringify(b.text));
}

/* The identity of a row, in one place. It was written out twice inside the archive read-back and
 * is now also what the rewrite removes by, and two spellings of an identity is how the session id
 * ended up with two namespaces in this same file (ST-277 HIGH-2). */
function rowKey (r) { return r.at + '|' + r.session + '|' + r.class; }

/* ------------------------------------------------------------------ write */

function cmdWrite () {
  const file = recordPath(arg('--file', null));
  const sid = sessionId();
  const session = sid.id;
  const cls = arg('--class', null);
  const severity = (arg('--severity', null) || '').toLowerCase();
  const finding = arg('--finding', null);
  const evidence = arg('--evidence', null);
  const ticket = arg('--ticket', null);

  const refusals = [];
  if (!session) refusals.push('no session id. Set CLAUDE_CODE_SESSION_ID, which is what the gate reads too. Rows are keyed by session so the gate can tell whether THIS wind-down wrote one, and --session exists for a caller that has no environment rather than for a person to type.');
  if (!cls) refusals.push('no --class. Without a class nothing can count recurrence, and recurrence is the whole measure.');
  else if (!CLASS_RE.test(cls)) refusals.push('--class ' + JSON.stringify(cls) + ' is not a kebab-case slug. A class that is spelled two ways is two classes, and each one is then seen once.');
  else if (cls.length > CLASS_MAX) refusals.push('--class is ' + cls.length + ' characters. A class longer than ' + CLASS_MAX + ' is a finding wearing a slug, and it will never match a second time.');
  if (!severity) refusals.push('no --severity. One of ' + SEVERITIES.join(', ') + '.');
  else if (SEVERITIES.indexOf(severity) === -1) refusals.push('--severity ' + JSON.stringify(severity) + ' is not one of ' + SEVERITIES.join(', ') + '.');
  if (!finding) refusals.push('no --finding. A row with no finding is a timestamp.');
  else if (finding.trim().split(/\s+/).length < FINDING_MIN_WORDS) refusals.push('the --finding is ' + finding.trim().split(/\s+/).length + ' word(s), which cannot say what went wrong.');
  if (!evidence) refusals.push('no --evidence. The command that SHOWS the finding is what makes the row checkable by somebody who was not here.');
  if (ticket && !/^[A-Z]{1,6}-\d+$/.test(ticket)) refusals.push('--ticket ' + JSON.stringify(ticket) + ' is not a ticket reference.');

  if (refusals.length) {
    out('');
    for (const r of refusals) out('REFUSED  ' + r);
    out('');
    out(refusals.length + ' refusal(s). Nothing was written. ST-244.');
    return 1;
  }

  const read = readRows(file);
  if (read.state === 'unreadable') {
    out('CANNOT READ  ' + file + ': ' + read.why);
    return 2;
  }

  const project = projectName();
  const sameClass = read.rows.filter(r => r.class === cls && r.project === project);
  const firstSeen = sameClass.length ? sameClass.map(r => r.at).sort()[0] : null;

  const row = {
    v: RECORD_VERSION,
    at: stamp(),
    session: session,
    project: project,
    commit: git(['rev-parse', '--short', 'HEAD']),
    class: cls,
    severity: severity,
    finding: finding.trim(),
    evidence: evidence.trim(),
    ticket: ticket || null,
    firstSeen: firstSeen,
    seenCount: sameClass.length + 1
  };

  /* One line, one write, O_APPEND. Two sessions appending at the same moment interleave whole
   * lines rather than halves of two objects, and a line is the unit this file is read in. */
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify(row) + '\n', { encoding: 'utf8' });
  } catch (e) {
    out('CANNOT WRITE  ' + file + ': ' + e.message);
    return 2;
  }

  out('');
  /* The id and WHERE IT CAME FROM, on the writing side and the gating side both. While ST-277
   * HIGH-2 was live, every output on this path printed an id and no output anywhere printed its
   * source, so two sides disagreeing about the namespace looked identical to two sides agreeing. */
  out('DOCTOR RECORD  ' + path.basename(file) + '  session ' + session + ' (from ' + sid.source + ')');
  if (sid.changed) out('  NOTE  the id given was ' + JSON.stringify(sid.raw) + ' and was normalised to ' + JSON.stringify(session) + '. The gate normalises identically.');
  out('  ' + row.at + '  ' + row.project + '  ' + row.severity.toUpperCase() + '  ' + row.class);
  out('  ' + row.finding);
  out('  evidence  ' + row.evidence);
  if (row.seenCount > 1) {
    out('  SEEN ' + row.seenCount + ' TIMES, first on ' + row.firstSeen + '. A class seen twice is a');
    out('  standing defect rather than an incident, and ST-245 requires it to carry a ticket.');
    if (!row.ticket) out('  THIS ROW CARRIES NO TICKET.');
  }
  reportBad(read, file);
  out('');
  return 0;
}

/* ------------------------------------------------------------------ show */

function cmdShow () {
  const file = recordPath(arg('--file', null));
  const read = readRows(file);
  if (read.state === 'unreadable') { out('CANNOT READ  ' + file + ': ' + read.why); return 2; }
  if (read.state === 'absent') {
    out('');
    out('CANNOT TELL  no record at ' + file);
    out('             No doctor row has ever been written here. That is not a clean bill of');
    out('             health, it is an absence of evidence. ST-244.');
    out('');
    return 3;
  }

  const only = arg('--class', null);
  const limit = parseInt(arg('--limit', '0'), 10) || 0;
  let rows = read.rows.slice().sort((a, b) => String(a.at).localeCompare(String(b.at)));
  if (only) rows = rows.filter(r => r.class === only);

  /* Recomputed from the whole file rather than read off the row. A stamped count is a claim
   * about the moment it was written; this is the count now, and the two are allowed to differ
   * because rows get archived. Printing both is what makes that visible instead of confusing. */
  const counts = new Map();
  for (const r of rows) counts.set(r.class, (counts.get(r.class) || 0) + 1);

  const shown = limit > 0 ? rows.slice(-limit) : rows;
  out('');
  out('DOCTOR RECORD  ' + path.basename(file) + '  ' + rows.length + ' row(s)' + (only ? ', class ' + only : ''));
  for (const r of shown) {
    out('');
    out('  ' + r.at + '  ' + (r.project || '?') + '  ' + String(r.severity || '?').toUpperCase() +
      '  ' + r.class + '  seen ' + counts.get(r.class) + ' (stamped ' + (r.seenCount === undefined ? '?' : r.seenCount) + ')');
    out('    ' + (r.finding || ''));
    out('    evidence  ' + (r.evidence || '') + (r.ticket ? '   ticket ' + r.ticket : ''));
  }

  const repeats = [...counts.entries()].filter(e => e[1] > 1).sort((a, b) => b[1] - a[1]);
  out('');
  if (repeats.length) {
    out('  CLASSES SEEN MORE THAN ONCE, which is the number ST-240 exists to drive to zero:');
    for (const [c, n] of repeats) {
      const withTicket = rows.filter(r => r.class === c && r.ticket).length;
      out('    ' + c + '  ' + n + ' time(s), ' + withTicket + ' row(s) carrying a ticket');
    }
  } else {
    out('  No class has been seen more than once.');
  }
  reportBad(read, file);
  out('');
  return 0;
}

/* ------------------------------------------------------------------ gate */

/* THE CHECK THAT MAKES THE RECORD REAL. Without it this is .studio-hooks.log again: a file
 * that gets written until the day somebody is in a hurry, and then never again, with nothing
 * anywhere reporting that it stopped. */
function cmdGate () {
  const file = recordPath(arg('--file', null));
  /* Same source as the writer, which is the whole of the ST-277 HIGH-2 fix. See sessionId(). */
  const sid = sessionId();
  const session = sid.id;

  const reason = arg('--reason', null);
  const read = readRows(file);
  if (read.state === 'unreadable') { out('CANNOT READ  ' + file + ': ' + read.why); return 2; }

  const rows = read.state === 'ok' ? read.rows : [];

  /* S207: A REFUSAL MAY NOT ASSERT MORE THAN ITS PREDICATE MEASURED. With no session id there
   * is still a question worth asking, and it is a weaker one: was ANY row written today? Zero
   * rows today is unambiguous and refuses. A row written today by somebody else is NOT evidence
   * that this session wrote one, and saying so out loud is the difference between this check and
   * one that quietly passes every wind-down after the first. */
  if (!session) {
    const today = stamp().slice(0, 10);
    const todays = rows.filter(r => String(r.at).slice(0, 10) === today);
    out('');
    out('DOCTOR RECORD GATE  no session id, so this asks a WEAKER question: any row today?');
    out('  record  ' + file + (read.state === 'absent' ? '  (absent)' : '  ' + rows.length + ' row(s)'));
    reportBad(read, file);
    if (todays.length) {
      out('  ' + todays.length + ' row(s) written on ' + today + ', by session(s) ' +
        [...new Set(todays.map(r => r.session))].join(', ') + '.');
      out('  THIS CHECK CANNOT TELL WHETHER ONE OF THEM IS YOURS. Set CLAUDE_CODE_SESSION_ID,');
      out('  which is the one source both halves read, to ask the question this gate exists to ask.');
      out('');
      return 0;
    }
    if (reason) {
      out('  NO ROW TODAY, AND THE REASON IS ACCEPTED AND PRINTED: ' + reason);
      out('');
      return 0;
    }
    out('');
    out('REFUSED  no doctor row was written on ' + today + ' by anybody.');
    out('         That much is unambiguous without a session id: the record did not move today.');
    out('');
    out('ST-244.');
    return 1;
  }

  const mine = rows.filter(r => r.session === session);

  out('');
  out('DOCTOR RECORD GATE  session ' + session + ' (from ' + sid.source + ')');
  out('  record  ' + file + (read.state === 'absent' ? '  (absent)' : '  ' + rows.length + ' row(s)'));
  reportBad(read, file);

  if (mine.length) {
    out('  ' + mine.length + ' row(s) written by this session.');
    for (const r of mine) out('    ' + r.severity.toUpperCase() + '  ' + r.class + '  ' + String(r.finding).slice(0, 90));
    out('');
    return 0;
  }

  /* S232. The escape is a WRITTEN REASON, printed on every run, never a flag nobody sees.
   * A refusal with no way out gets its predicate weakened instead, and a weakened predicate is
   * quietly weaker everywhere in order to fix the one awkward instance in front of somebody. */
  if (reason) {
    out('  NO ROW, AND THE REASON IS ACCEPTED AND PRINTED: ' + reason);
    out('  A session that ran the doctor and recorded nothing has to say so in words somebody');
    out('  can disagree with. This line is the whole of that cost.');
    out('');
    return 0;
  }

  out('');
  out('REFUSED  this session wrote no doctor row.');
  out('         The doctor runs at every wind-down and its findings are the only thing standing');
  out('         between a defect class and its fifth appearance. A wind-down that ran it and');
  out('         recorded nothing leaves no trace that it ran at all.');
  out('');
  /* NO --session IN EITHER REMEDY, AND THE ID IS NOT PRE-FILLED. This refusal used to print both
   * commands with the resolved id typed in, which is the copy-it-off-the-screen pattern that put
   * two namespaces into one session in the first place, and base/skills/wind-down/SKILL.md now
   * forbids it in words. A refusal that hands you the wrong command is a worse instrument than a
   * refusal that hands you none: the wrong one gets run. */
  out('  write one:   node tools/doctor-record.js write --class <slug> \\');
  out('                 --severity ' + SEVERITIES.join('|') + ' --finding "<what>" --evidence "<command>"');
  out('  or say why:  node tools/doctor-record.js gate --reason "<why>"');
  out('  Both take the session id from CLAUDE_CODE_SESSION_ID. Do not type one in.');
  out('');
  out('ST-244.');
  return 1;
}

/* ------------------------------------------------------------------ archive */

function cmdArchive () {
  const file = recordPath(arg('--file', null));
  const keep = parseInt(arg('--keep', String(DEFAULT_KEEP)), 10);
  if (!(keep > 0)) usage('--keep must be a positive number of rows.');
  const write = has('--write');

  const read = readRows(file);
  if (read.state === 'unreadable') { out('CANNOT READ  ' + file + ': ' + read.why); return 2; }
  if (read.state === 'absent') {
    out('');
    out('CANNOT TELL  no record at ' + file + '. Nothing to archive.');
    out('');
    return 3;
  }

  const rows = read.rows.slice().sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const move = rows.length > keep ? rows.slice(0, rows.length - keep) : [];

  out('');
  out('DOCTOR RECORD ARCHIVE  ' + rows.length + ' row(s), keeping ' + keep);

  /* FOUND BY WATCHING THIS RUN, in the sitting that wrote it. The rewrite below is built from
   * PARSED rows, so any line this file could not parse was dropped on the floor and the file
   * came back one line shorter with nothing said. The line most likely to be unparseable is the
   * half-written final row of a wind-down that crashed, which is the single case the recovery
   * rule above exists to preserve, and archive runs at every wind-down. So the routine that runs
   * most often was the one destroying the evidence the record was built to keep.
   *
   * Reading is tolerant and REWRITING is not, and that asymmetry is the whole fix. A reader that
   * refuses locks out every project; a writer that refuses costs one person one repair. */
  if (read.bad.length && write) {
    reportBad(read, file);
    out('');
    out('REFUSED  ' + read.bad.length + ' line(s) cannot be parsed, and this rewrites the file from');
    out('         the lines it CAN parse. Archiving now would delete them with nothing said, and a');
    out('         damaged final line is what a crashed wind-down leaves behind.');
    out('         Repair or delete those lines by hand, then run this again. Nothing was moved.');
    out('');
    out('ST-244.');
    return 1;
  }
  if (!move.length) {
    /* The no-op is free and is the point. S221: a reduction taken only when a limit refuses
     * turns that limit into a floor, proved here across six consecutive sittings of a state
     * document that was cut to just under its ceiling and never once went below it. */
    out('  nothing to move. Run this every wind-down anyway; the no-op costs nothing and');
    out('  waiting for a refusal is what turns a ceiling into a floor (S221).');
    out('');
    return 0;
  }

  out('  ' + move.length + ' row(s) would move to ' + path.basename(archivePath(file)));
  out('  oldest ' + move[0].at + '  newest moved ' + move[move.length - 1].at);
  if (!write) {
    out('  DRY RUN. Add --write to move them.');
    out('');
    return 0;
  }

  /* Archive BEFORE truncating, and read the destination back, so a failure half way leaves the
   * rows in the source rather than in neither file. S106: prove the destination holds them
   * before a byte is removed from the origin. */
  const dest = archivePath(file);
  const payload = move.map(r => JSON.stringify(r)).join('\n') + '\n';
  try {
    fs.appendFileSync(dest, payload, { encoding: 'utf8' });
  } catch (e) {
    out('CANNOT WRITE  ' + dest + ': ' + e.message + '. Nothing was removed.');
    return 2;
  }
  const back = readRows(dest);
  const present = new Set(back.rows.map(rowKey));
  const missing = move.filter(r => !present.has(rowKey(r)));
  /* THIS BRANCH IS THE ONE MUTATION THIS TOOL'S SUITE CANNOT KILL, and it is written down here
   * rather than left as a silent gap. Replacing the condition with `false` leaves the suite green,
   * because the branch only differs on a filesystem that ACCEPTS the append above and then hands
   * back different bytes. Nothing reachable from the front door produces that: a destination that
   * cannot be written throws and is caught one step earlier.
   *
   * IT IS THE ONE AGAIN, AND IT BRIEFLY WAS NOT. The re-read guards added below arrived with two
   * more survivors and this paragraph still said "the one" and still quoted 67 assertions, so the
   * sentence recording an honest gap had itself gone stale and was understating it. Both are now
   * covered by entering the window with a preload. A note about what is not proved has to be
   * re-read every time the thing it describes is touched, or it becomes the most confident wrong
   * claim in the file.
   *
   * It stays because the alternative is deleting the rows from the source on the strength of a
   * write nobody read back, and this repository has a rule about that (S106) precisely because
   * the failure is silent when it happens. A control nobody has watched fail and a control that
   * always passes are the same thing until somebody says which this is. This is the first. */
  if (missing.length) {
    out('REFUSED  ' + missing.length + ' of ' + move.length + ' row(s) are not readable at the');
    out('         destination. Nothing was removed from ' + path.basename(file) + '.');
    return 1;
  }

  /* THE SOURCE IS RE-READ HERE, IMMEDIATELY BEFORE IT IS TRUNCATED, AND THAT IS ST-277 MEDIUM-4.
   * The snapshot this function opened with was taken eighty-five lines earlier, and everything
   * between then and now is file work: an append to the destination and a read-back of it. A peer
   * session appending a row inside that window had it silently deleted by the rewrite, IN THE ONE
   * FILE whose format was chosen because peers append to it concurrently. The header above argues
   * for JSON Lines on exactly that ground, so the defect was not a missed possibility, it was the
   * documented premise of the file being ignored by the routine that runs most often against it.
   *
   * The rows to remove are named rather than counted. Keeping `rows.length - keep` by POSITION
   * assumes the file is the length it was at the snapshot, which is the same assumption in a
   * different costume: a peer append would have shifted the boundary and truncated a row that was
   * never archived. So the removal is by key, with multiplicity, and anything the peer added is
   * carried through untouched and reported.
   *
   * A line that will not parse and was not there at the snapshot REFUSES, for the reason stated
   * above the first refusal: reading is tolerant and rewriting is not. */
  const now = readRows(file);
  if (now.state !== 'ok') {
    out('CANNOT RE-READ  ' + file + ' before rewriting it. The rows are in the archive and nothing was removed here.');
    return 2;
  }
  if (now.bad.length > read.bad.length) {
    out('REFUSED  ' + file + ' gained ' + (now.bad.length - read.bad.length) + ' unparseable line(s) while this ran.');
    out('         The rows are in the archive and nothing was removed here. Repair the file and run this again.');
    return 1;
  }

  const toRemove = new Map();
  for (const r of move) { const k = rowKey(r); toRemove.set(k, (toRemove.get(k) || 0) + 1); }
  const keptRows = [];
  for (const r of now.rows) {
    const k = rowKey(r);
    const n = toRemove.get(k) || 0;
    if (n > 0) { toRemove.set(k, n - 1); continue; }
    keptRows.push(r);
  }

  const appended = now.rows.length - read.rows.length;
  if (appended > 0) {
    out('  ' + appended + ' row(s) were appended by another session while this ran, and are kept.');
  }

  try {
    fs.writeFileSync(file, keptRows.map(r => JSON.stringify(r)).join('\n') + '\n', { encoding: 'utf8' });
  } catch (e) {
    out('CANNOT WRITE  ' + file + ': ' + e.message + '. The rows are in the archive and still here.');
    return 2;
  }

  out('  ' + move.length + ' row(s) moved and proved at the destination before removal (S106).');
  out('  ' + keptRows.length + ' row(s) remain.');
  out('');
  return 0;
}

/* ------------------------------------------------------------------ main */

const cmd = command();
if (!cmd) usage(null);
let code;
switch (cmd) {
  case 'write': code = cmdWrite(); break;
  case 'show': code = cmdShow(); break;
  case 'gate': code = cmdGate(); break;
  case 'archive': code = cmdArchive(); break;
  default: usage('unknown command ' + JSON.stringify(cmd));
}
process.exit(code);
