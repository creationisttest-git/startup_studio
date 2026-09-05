#!/usr/bin/env node
/**
 * check-resume-pointer.js -- proves a warm start's resume prompt still aims at current state.
 *
 * Why this exists. A wind-down adds a new block of current state and marks the previous one
 * superseded, then leaves the resume prompt saying "work from the block headed <the old date>".
 * The document now contradicts itself: one part says that block is superseded, another sends
 * the next session straight to it. Nothing read both halves, so nobody found out until a fresh
 * session was handed state that was days old and believed it.
 *
 * The instruction to rewrite the prompt every session already existed in the wind-down skill.
 * It was skipped. That is the whole argument for this file: a rule that is only written down
 * is not a control, and a hand-kept reference that must track something else needs a check
 * comparing the two.
 *
 *   node tools/check-resume-pointer.js <path-to-WARM_START.md>
 *   node tools/check-resume-pointer.js <path> --quiet     only print failures
 *
 * Exit 0 clean, 1 on any failure, 2 on a usage or read error.
 *
 * What it checks, each with a test in check-resume-pointer.test.js:
 *   - a resume section exists at all
 *   - that section contains a fenced block, because that is what the warm-start skill
 *     extracts. A prompt written as bare prose is not findable and gets handed over as
 *     whatever text happened to sit nearby.
 *   - the prompt names no date the document itself marks superseded
 *   - if the document declares a newest current block and the prompt names one, they match
 *
 * Deliberately generic. It knows nothing about any project's layout and reads only the two
 * conventions the studio's own documents use: a resume heading, and dated current blocks.
 */
'use strict';

const fs = require('fs');

// Two matchers, tried in order, and the order is the control. A hashed heading is preferred; the
// loose form is a fallback used only when the document has no hashed resume heading at all.
//
// Why not simply require the hash. Measured across the eight warm starts on this machine: six
// carry a hashed resume heading, one carries none, and one carries the heading as bare prose with
// no hashed equivalent anywhere in the file. Requiring the hash would silently stop finding that
// last document and report it as having no resume section, a false FAIL at the moment a
// wind-down is trying to commit state.
//
// Why not keep the loose form alone. It matched any line BEGINNING with the words, so a paragraph
// wrapped onto a line starting "resume prompt" was taken as the section start. In the safe
// direction that reported zero fences under a section that was really prose, and refused a commit
// it should have allowed. In the unsafe direction the same looseness lets prose that happens to
// carry a fence satisfy the check while the real prompt sits unread further down. Both directions
// are in check-resume-pointer.test.js.
var RESUME_HEADING_HASHED = /^#{1,6}\s+[^\n]*(prompt to resume|resume prompt|prompt to restart|prompt for a fresh session)/i;
var RESUME_LINE_LOOSE = /^\s*#{0,6}\s*(prompt to resume|resume prompt|prompt to restart|prompt for a fresh session)/i;
var HEADING = /^#{1,6}\s+\S/;
var DATED_BLOCK = /(WAS\s+)?CURRENT\s+AS\s+OF\s+(\d{4}-\d{2}-\d{2})/gi;

// Read the file and split it, keeping line numbers so a finding can be pointed at.
function readLines (file) {
  var text = fs.readFileSync(file, 'utf8');
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  return text.split(/\r?\n/);
}

// The resume section runs from its heading to the next markdown heading, or to end of file.
// Not to end of file unconditionally: some documents carry sections after the prompt, and
// sweeping those in makes every date in them look like part of the prompt.
function firstMatching (lines, pattern) {
  for (var i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) return i;
  }
  return -1;
}

function findResume (lines) {
  var start = firstMatching(lines, RESUME_HEADING_HASHED);
  if (start === -1) start = firstMatching(lines, RESUME_LINE_LOOSE);
  if (start === -1) return null;
  var end = lines.length;
  for (var j = start + 1; j < lines.length; j++) {
    if (HEADING.test(lines[j])) { end = j; break; }
  }
  return { start: start, end: end, lines: lines.slice(start, end) };
}

// Every dated block marker in the document, split into those still claimed current and those
// explicitly demoted. "superseded <date>" is NOT read as marking that date superseded: it names
// the date the demotion happened, which is usually the newest block of all.
function scanBlocks (lines) {
  var current = [], superseded = [];
  for (var i = 0; i < lines.length; i++) {
    var m; DATED_BLOCK.lastIndex = 0;
    while ((m = DATED_BLOCK.exec(lines[i])) !== null) {
      var entry = { date: m[2], line: i + 1 };
      if (m[1]) superseded.push(entry); else current.push(entry);
    }
  }
  return { current: current, superseded: superseded };
}

function newest (entries) {
  return entries.reduce(function (a, b) { return (a === null || b.date > a.date) ? b : a; }, null);
}

function check (file) {
  var findings = [];
  var lines = readLines(file);
  var resume = findResume(lines);

  if (!resume) {
    findings.push({ ok: false, what: 'a resume section exists',
      why: 'no heading matching a resume prompt was found, so a fresh session is handed nothing.' });
    return findings;
  }
  findings.push({ ok: true, what: 'a resume section exists',
    why: 'line ' + (resume.start + 1) });

  var fences = resume.lines.filter(function (l) { return /^\s*```/.test(l); }).length;
  findings.push({ ok: fences >= 2, what: 'the resume section carries a fenced block',
    why: fences >= 2
      ? fences + ' fence line(s) in the section'
      : 'found ' + fences + ' fence line(s). The warm-start skill takes the first FENCED block '
        + 'under this heading. Without one it has nothing to extract and hands over whatever '
        + 'prose sits nearby, which is how a stale pointer reaches a fresh session unnoticed.' });

  var blocks = scanBlocks(lines);
  var supersededDates = {};
  blocks.superseded.forEach(function (s) { supersededDates[s.date] = s.line; });

  var resumeText = resume.lines.join('\n');
  var referenced = [];
  var m; DATED_BLOCK.lastIndex = 0;
  while ((m = DATED_BLOCK.exec(resumeText)) !== null) {
    if (!m[1]) referenced.push(m[2]);
  }

  var aimedAtDead = referenced.filter(function (d) { return supersededDates[d] !== undefined; });
  findings.push({ ok: aimedAtDead.length === 0, what: 'the prompt names no superseded block',
    why: aimedAtDead.length === 0
      ? (referenced.length ? 'names ' + referenced.join(', ') : 'names no dated block')
      : 'the prompt sends the next session to ' + aimedAtDead.join(', ')
        + ', and this same document marks that superseded at line '
        + supersededDates[aimedAtDead[0]] + '. Rewrite the prompt to aim at the current block.' });

  var live = blocks.current.filter(function (c) { return supersededDates[c.date] === undefined; });
  var top = newest(live);
  if (top && referenced.length) {
    var newestReferenced = referenced.slice().sort().pop();
    findings.push({ ok: newestReferenced === top.date, what: 'the prompt names the newest block',
      why: newestReferenced === top.date
        ? 'both are ' + top.date
        : 'the newest current block is ' + top.date + ' at line ' + top.line
          + ', the prompt names ' + newestReferenced + '.' });
  }

  return findings;
}

function main (argv) {
  var args = argv.filter(function (a) { return a !== '--quiet'; });
  var quiet = argv.indexOf('--quiet') !== -1;
  if (args.length !== 1) {
    console.error('usage: node tools/check-resume-pointer.js <path-to-WARM_START.md> [--quiet]');
    return 2;
  }
  var findings;
  try {
    findings = check(args[0]);
  } catch (e) {
    console.error('cannot read ' + args[0] + ': ' + e.message);
    return 2;
  }
  var failed = findings.filter(function (f) { return !f.ok; });
  findings.forEach(function (f) {
    if (quiet && f.ok) return;
    console.log((f.ok ? 'ok    ' : 'FAIL  ') + f.what + '  --  ' + f.why);
  });
  if (failed.length) {
    console.log('');
    console.log(failed.length + ' failure(s). The resume prompt does not match the state below it.');
  }
  return failed.length ? 1 : 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { check: check, findResume: findResume, scanBlocks: scanBlocks };
