#!/usr/bin/env node
/**
 * check-document-shape.js -- does a loaded governance document have a shape anything can read?
 *
 * WHY THIS EXISTS. Every instrument this studio ships reads a document by its SHAPE: a heading to
 * find a section, a table header to find the decisions, an identifier to order the rows. A
 * document that a person reads as perfectly structured can have none of that, and when it does,
 * the instruments do not fail loudly. They find nothing and say so quietly, once, in a place
 * nobody is looking, and the project carries on believing it is covered.
 *
 * MEASURED, WHICH IS WHY THIS IS A TOOL AND NOT A NOTE. One project's WAYS_OF_WORKING.md is 739
 * lines and 56,807 characters with ZERO markdown headings and ZERO table rows. Its sections are
 * bare lines like "Mobile navigation rule (standing, BUILD2 2026-06-28)", which reads as structure
 * to a human and is flat text to every parser here. It has no decision identifiers at all, so the
 * archiver cannot order it, the duplicate-key check cannot see it, and the context budget cannot
 * name the section that is growing. Three instruments, all silently inert, for months. The same
 * file also carries a byte order mark at byte 0, which is S24, the defect that stopped 13 of 16
 * agent files parsing, sitting in a governance document nobody had re-measured.
 *
 * WHAT IT REFUSES ON, and each one is a thing an instrument needs rather than a style preference.
 *
 *   A BYTE ORDER MARK. It is invisible in every diff and every review tool, it sits before the
 *   first character, and it has already broken frontmatter parsing across this whole roster once.
 *
 *   NO MARKDOWN HEADING AT ALL. A document with no headings has no sections, so every check that
 *   looks a section up by name reports nothing found, which is indistinguishable from a section
 *   that is within budget.
 *
 *   THE SAME HEADING TWICE. Two sections cannot share a name: anything that looks one up by name
 *   finds the first and never the second, so the second is loaded, paid for on every request, and
 *   unreachable. It is also the signature of a section being APPENDED to under a new date when the
 *   rule says it is replaced.
 *
 *   DECISIONS CLAIMED WITH NO TABLE TO READ. If a heading says the document holds decisions, the
 *   archive policy and the duplicate-key check both expect a table with a header row. Claiming
 *   them in prose is not wrong for a reader and it is invisible to both.
 *
 * WHAT THIS CANNOT SEE, stated here rather than discovered later. It does not judge whether the
 * CONTENT is any good, only whether an instrument can find it. Bare-line titles that a human reads
 * as headings are counted as prose, deliberately, because that is exactly what every parser here
 * does. A heading that differs by a trailing date is NOT a duplicate to this tool, so a section
 * appended under "Risks (Monday)" and "Risks (Tuesday)" passes; catching that needs a rule about
 * which parentheticals are dates and that rule would refuse legitimate history.
 *
 *   usage: node tools/check-document-shape.js <project-dir>   walks CLAUDE.md's @-imports
 *          node tools/check-document-shape.js --file <a.md>   one document
 *          options: --quiet --governed-only
 *   exit:  0 every loaded document has a readable shape
 *          1 at least one does not
 *          2 nothing could be read, so nothing was checked
 *          3 --governed-only and no project beside this one loads studio governance
 *
 * --governed-only IS FOR THE PUBLISHED WIRING AND NOT FOR A PERSON AT A PROMPT. Pointed at the
 * directory holding this repository it reaches every project, which is the whole value of the
 * check; pointed at the same place on a copy installed from the public export it reaches the
 * READER'S own unrelated work, and refusing on documents we did not write is worse than not
 * looking. Measured before the flag existed, on a parent holding one unrelated project:
 * "FAIL some-unrelated-app/CLAUDE.md: has markdown headings", exit 1, in the session-start set,
 * with no command a reader could run to clear it. With the flag a project is in scope only if it
 * LOADS studio governance, so the same directory is exit 3 and advisory. S133, S148, ST-187.
 */
'use strict';

const fs = require('fs');
const path = require('path');

let pass = 0;
let fail = 0;
const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const governedOnly = args.includes('--governed-only');

function ok(name, cond, detail) {
  if (cond) { pass++; if (!quiet) console.log('ok    ' + name); }
  else { fail++; console.log('FAIL  ' + name + (detail ? '  --  ' + detail : '')); }
}
function die(msg) { console.error('check-document-shape: ' + msg); process.exit(2); }

// NOTHING HERE TO CHECK is a different answer from a usage error, and keeping them apart is the
// whole of ST-187. check-governance-core.js draws the same line for the same reason and
// run-checks.js lists exit 3 as advisory for both: a check that can never be cleared on a
// reader's machine trains that reader to override it, which is the failure mode this studio
// refuses everywhere else.
function nothingToCheck(msg) { console.error('check-document-shape: ' + msg); process.exit(3); }

// --- what to read -----------------------------------------------------------------------------
// The import rule ST-190 settled, which this file did NOT follow while its own comment claimed it
// did. The comment used to say the three implementations agree rather than each deciding for
// itself; ST-190 fixed the other two to walk the whole graph and to resolve each path against the
// file that declares it, and this one kept walking a single level from the project root. On the
// one project that reaches governance through a nested directory of its own, that returned a clean
// bill while the nested document had ZERO headings, which is the founding defect this tool exists
// to catch. A comment asserting agreement is not agreement (S154).
function importsOf(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.trim().match(/^@([^\s]+\.md)$/);
    if (m) out.push(m[1]);
  }
  return out;
}

// AN I/O FAILURE IS NOT A FINDING. Unguarded, readFileSync throws and node exits 1, and 1 is the
// code this tool uses for "a document does not have a readable shape", so a directory named like
// a document, or a file another project's live session holds open, would be reported as a shape
// fault nobody could act on. Saying something is not saying WHICH (S139).
function readRaw(p) {
  try { return fs.readFileSync(p); }
  catch (e) { return die('cannot read ' + p + ': ' + (e.code || e.message)); }
}

// ONE UNREADABLE DOCUMENT UNDER THE READER'S PARENT MUST NOT END THE RUN. readRaw exits 2, and
// run-checks lists only 3 as advisory, so a sibling project holding a .md open turned a reader's
// whole session-start red while saying "nothing could be read", which was untrue: everything
// before it had been read. A file we cannot open contributes no assertion, exactly like an import
// that is absent. The explicit --file target keeps readRaw, because there the file IS the request.
function readImport(p) {
  try { return fs.readFileSync(p); }
  catch (e) { return null; }
}

// Walks the whole import graph from one document. TWO RULES, BOTH MEASURED BY ST-190 ON A REAL
// PROJECT RATHER THAN REASONED ABOUT. Each path resolves against the DIRECTORY OF THE FILE THAT
// DECLARES IT: resolved against the project root instead, every second-level import on that
// project is absent, so the walk finds nothing and looks correct. And each file is charged once:
// three of those imports are reached by two different paths, so a walk without the seen set counts
// the same text twice. The seen set is also what lets a cycle reach a verdict at all, and a
// verdict is the only thing that distinguishes this from a crash, because a stack overflow and a
// finding both exit 1 (S156).
function walkProject(dir) {
  const out = [];
  const seen = new Set();
  const queue = [path.join(dir, 'CLAUDE.md')];

  while (queue.length) {
    const full = queue.shift();
    const key = path.resolve(full).toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);

    // A missing import loads nothing, so there is no shape to judge. -Doctor reports it as DEAD.
    if (!fs.existsSync(full)) continue;
    const raw = readImport(full);
    if (raw === null) continue;

    out.push({
      rel: path.relative(dir, full).split(path.sep).join('/'),
      full: full,
      raw: raw
    });
    for (const rel of importsOf(raw.toString('utf8'))) {
      queue.push(path.join(path.dirname(full), rel));
    }
  }
  return out;
}

const fileFlagAt = args.indexOf('--file');
const docs = [];

if (fileFlagAt !== -1) {
  const one = args[fileFlagAt + 1];
  if (!one || one.startsWith('--')) die('--file needs a path after it');
  if (!fs.existsSync(one)) die('no such file: ' + one);
  docs.push({ name: path.basename(one), full: one });
} else {
  const target = args.filter(a => !a.startsWith('--'))[0];
  if (!target) die('usage: node tools/check-document-shape.js <dir> | --file <a.md>');
  if (!fs.existsSync(target)) die('no such directory: ' + target);

  // ONE PROJECT, OR THE DIRECTORY THAT HOLDS SEVERAL. A shape fault is a property of the OTHER
  // projects far more than of this one, and this repository is the single place it has never been
  // true, so a check that could only look at itself would pass forever and prove nothing. Given a
  // directory with no CLAUDE.md of its own, every immediate subdirectory that has one is a
  // project. That is the same reach argument check-governance-core.js makes with --root.
  // WHAT MAKES A PROJECT OURS TO REFUSE ON, under --governed-only. It loads at least one document
  // whose name or location only this studio uses. EVERY GENERIC NAME HAS BEEN REMOVED FROM THIS
  // LIST, and that is the whole of the fix. It used to carry AGENTS.MD, WAYS_OF_WORKING.MD and
  // WARM_START.MD, which a stranger owns for reasons nothing to do with us: AGENTS.md is an
  // industry-wide convention filename. Measured on a reconstructed public export standing beside
  // one unrelated project whose CLAUDE.md imports @AGENTS.md: 9 checks 1 FAILED in the
  // SESSION-START set, exit 1, naming that project's own file, with no command the reader could
  // run to clear it. That is the third time this studio has shipped a check that passes at home
  // and locks out every reader (S133, S151), and each time the cause was a rule keyed on something
  // the reader also happens to have. Scope on provenance, never on a name anyone may pick.
  const STUDIO_DOCS = ['GOVERNANCE_CORE.MD', 'GLOBAL_WAYS_OF_WORKING.MD', 'BRIDGE_PROTOCOL.MD'];
  // The studio's own repository imports no core at all, it imports its rules out of base/fragments,
  // so the LOCATION is the provenance signal there. Dropping the generic names costs no reach
  // precisely because the walk above is transitive: the one project that reaches the core through
  // a nested directory of its own is admitted by that nested import, which a single-level walk
  // could never see. That is why the scoping fix and the parser fix are the same fix.
  const FRAGMENT_PATH = /(^|\/)base\/fragments\//i;
  // Compared upper against upper. Written once as a basename against a mixed-case list it matched
  // NOTHING, and the flag silently took the studio's own reach from five projects to zero while
  // still exiting cleanly, which is the shape of finding nothing and saying so quietly. The
  // assertions below hold a governed project and an ungoverned one in the same fixture for
  // exactly that reason: a scoping rule that admits nobody looks identical to one that works.
  // The ungoverned half of that fixture must IMPORT SOMETHING, and something generically named,
  // or it only ever proves the admits-nobody direction and never the one that reaches readers.
  function loadsGovernance(loaded) {
    return loaded.some(function (d) {
      if (STUDIO_DOCS.indexOf(path.basename(d.rel).toUpperCase()) !== -1) return true;
      return FRAGMENT_PATH.test(d.rel);
    });
  }

  function loadProject(dir, label) {
    if (!fs.existsSync(path.join(dir, 'CLAUDE.md'))) return false;
    const loaded = walkProject(dir);
    if (!loaded.length) return false;
    // Skipped BEFORE anything is pushed, so a project out of scope contributes no assertion at
    // all rather than a passing one. A pass about a document we never had any standing to judge
    // is the same lie as a failure about it.
    if (governedOnly && !loadsGovernance(loaded)) return false;
    for (const d of loaded) docs.push({ name: label + d.rel, full: d.full, raw: d.raw });
    return true;
  }

  if (!loadProject(target, '')) {
    let found = 0;
    for (const name of fs.readdirSync(target).sort()) {
      const dir = path.join(target, name);
      let isDir = false;
      try { isDir = fs.statSync(dir).isDirectory(); } catch (e) { isDir = false; }
      if (!isDir || name.charAt(0) === '.') continue;
      if (loadProject(dir, name + '/')) found++;
    }
    if (!found) {
      // The two answers are deliberately different codes. Without the flag, being pointed at a
      // directory holding nothing is a person's mistake and stays exit 2, exactly as before.
      // With it, finding nothing is the ORDINARY state of a fresh install and is exit 3.
      if (governedOnly) {
        nothingToCheck('no project in ' + target + ' loads studio governance, so there is no '
          + 'document here this check has any standing to refuse on. That is the ordinary state '
          + 'of a fresh install: compose the roster into a project and it will be checked.');
      }
      die('no CLAUDE.md in ' + target + ' and none in any directory under it, so nothing is '
        + 'loaded automatically and there is no shape to check');
    }
  }
}

// --- the shape rules --------------------------------------------------------------------------
// A heading is a markdown ATX heading. Setext underlining is deliberately not accepted: nothing
// in this studio writes it and accepting it would mean guessing which of two adjacent lines is
// the title.
function headingsOf(text) {
  const out = [];
  let inFence = false;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
    // A # inside a fenced block is a shell comment or an example, never a section of this file.
    if (inFence) continue;
    const m = line.match(/^(#{1,6})\s+(.*\S)\s*$/);
    if (m) out.push({ level: m[1].length, text: m[2].trim(), line: i + 1 });
  }
  return out;
}

// The same table detection archive-decisions.js uses, so a document that passes here is one that
// tool can actually read. Kept as its own function rather than shared, because the two must be
// able to disagree loudly if either changes.
function hasDecisionsTable(text) {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (/^\|/.test(lines[i]) && /decision/i.test(lines[i]) && /^\|[\s:-]+\|/.test(lines[i + 1] || '')) return true;
  }
  return false;
}

// STRICT ON PURPOSE, AND THE LOOSE VERSION WAS WRONG WITHIN A MINUTE OF BEING WRITTEN. Matching
// the word anywhere in a heading refused base/fragments/read-the-decision-archive.md, whose whole
// subject is where the decisions live and which correctly holds no table of its own. A document
// that TALKS about decisions is not a document that HOLDS them, and over-counting a finding is
// the same error as missing one (S148). The section this studio writes is headed exactly
// "Decisions", so that is what is asked for.
function claimsDecisions(headings) {
  return headings.some(h => /^decisions?$/i.test(h.text.replace(/[:\s]+$/, '')));
}

if (!quiet) console.log('');

for (const d of docs) {
  // Carried from the walk where there is one, so a document is read once rather than twice and a
  // file that disappears between the two reads cannot turn a finished walk into an exit 2.
  const raw = d.raw || readRaw(d.full);
  const bom = raw.length >= 3 && raw[0] === 0xEF && raw[1] === 0xBB && raw[2] === 0xBF;
  const text = raw.toString('utf8').replace(/^﻿/, '');
  const headings = headingsOf(text);

  ok(d.name + ': no byte order mark', !bom,
    'a BOM sits before the first character, is invisible in every diff, and has broken '
    + 'frontmatter parsing across this whole roster once already (S24)');

  ok(d.name + ': has markdown headings', headings.length > 0,
    text.length + ' characters and NOT ONE heading, so it has no sections any check can find. '
    + 'Titles written as bare lines read as structure to a person and as prose to every parser here');

  const seen = {};
  const dupes = [];
  for (const h of headings) {
    const key = h.level + ' ' + h.text.toLowerCase();
    if (seen[key]) dupes.push(h.text + ' (lines ' + seen[key] + ' and ' + h.line + ')');
    else seen[key] = h.line;
  }
  ok(d.name + ': no heading appears twice', dupes.length === 0,
    dupes.length + ' repeated heading(s): ' + dupes.join('; ')
    + '. Anything looking a section up by name finds the first and never the second, so the '
    + 'second is loaded and paid for on every request and cannot be read');

  if (claimsDecisions(headings)) {
    ok(d.name + ': the decisions it claims are in a table', hasDecisionsTable(text),
      'a heading says this document holds decisions and there is no table with a header row, so '
      + 'the archive policy and the duplicate-key check both read nothing here and say nothing');
  }
}

if (!quiet) console.log('');
console.log(pass + ' passed, ' + fail + ' failed');

// EXPORTED BEFORE THE EXIT, BECAUSE AFTER IT THIS LINE NEVER RUNS. It sat below process.exit and
// was therefore dead: requiring this module ran the whole tool and exited the caller, so the API
// it advertised did not exist and the next test to reach for it would have taken the suite down
// rather than failed (S127). The tests require it for the pure functions, which is why the usage
// path above must stay silent when there is nothing to do rather than throw on the way past.
module.exports = { headingsOf, hasDecisionsTable, claimsDecisions, importsOf };

process.exit(fail ? 1 : 0);
