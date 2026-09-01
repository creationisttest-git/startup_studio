#!/usr/bin/env node
/**
 * check-context-budget.js -- proves a project is not paying for its own record on every request.
 *
 * Why this exists. `CLAUDE.md` @-imports the documents a session loads before it starts, so
 * every character in them is re-sent on EVERY request for the life of the session. That is a
 * running charge, not a file size, and S44 is the rule that a cost is reported multiplied out
 * rather than as a size: 165k reads as a big file, ~42k tokens on every call reads as a problem,
 * and they are the same number.
 *
 * `studio.ps1 -Doctor` already measures and reports this correctly, in red, with the remedy
 * printed underneath. It has been doing so for two projects for weeks and nothing acted on it,
 * because -Doctor is something somebody chooses to run, usually on a different day, and the
 * person who GROWS a document is winding down rather than running a health check. This check
 * runs at the moment of cause, which is the only moment the growth can still be undone cheaply.
 *
 *   node tools/check-context-budget.js <path-to-project-directory>
 *   node tools/check-context-budget.js <path> --quiet     only print failures
 *
 * Exit 0 clean, 1 on any failure, 2 on a usage or read error.
 *
 * WHAT IT CHECKS, and why each one is separate:
 *
 *   - EVERY IMPORTED FILE is under the per-file limit. This is the hard one: past it the tool
 *     warns the session on the way in and the whole document is context spent before any work.
 *
 *   - THE TOTAL is under the same limit even when no single file trips it. Measured on a real
 *     project: 306k spread over several files, none individually over, which is the same cost
 *     and no warning at all.
 *
 *   - DISPOSABLE SECTIONS are under their own budget, and this is the finding the check was
 *     built for. Sections describing what to do RIGHT NOW -- the next action, the resume prompt
 *     -- are meant to be REWRITTEN every session, so they cannot legitimately accumulate. In one
 *     project they were 62,340 and 48,970 characters, together 111k of a 165k file, while that
 *     project had no decisions table at all. Archiving history would have returned nothing there.
 *     A section that should be replaced and is being appended to is a different disease from a
 *     record that has honestly grown, and only this check can tell them apart.
 *
 *   - AN ARCHIVE, IF ONE EXISTS, IS POINTED AT from a document that is actually loaded. Moving
 *     decisions out of an imported file is the correct remedy and it has a cost: they stop being
 *     re-read, which is the point, and they also stop being SEEN, which is not. A decision
 *     nobody can find gets re-litigated, and S7 retired an entire document because overlapping
 *     locations meant none of them was trusted. So the trail must stay followable by reading the
 *     live document alone. CEO constraint, 2026-08-28, ST-088.
 *
 * Deliberately generic. It knows nothing about any project's layout and reads only the two
 * conventions every project here uses: `CLAUDE.md` with @-imports, and `##` headings.
 */
'use strict';

const fs = require('fs');
const path = require('path');

// The limit the tool itself warns at. Past this a session opens with a warning and the whole
// document is charged before any work begins.
const FILE_LIMIT = 150000;

// A section that exists to say what is true RIGHT NOW cannot honestly grow, because each
// session replaces it. The budget is deliberately generous -- roughly three times what a
// healthy project writes -- so that tripping it means appending, not verbosity.
const DISPOSABLE_LIMIT = 12000;

// Matched case-insensitively against `##` heading text. These are the sections the wind-down
// protocol says are rewritten every session rather than added to.
//
// `founder brief` joined this list when ST-069 created it, because the wind-down now says to
// rewrite it every session, which is the definition this list uses. A hand-kept list that must
// track something else needs the thing it tracks to be added when it appears (S39); this one had
// already gone stale by one entry on the day the section was invented.
const DISPOSABLE = [/next action/i, /prompt to resume/i, /founder brief/i];

const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const target = args.filter(a => !a.startsWith('--'))[0];

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; if (!quiet) console.log('ok    ' + name); }
  else { fail++; console.log('FAIL  ' + name + (detail ? '  --  ' + detail : '')); }
}
function die(msg) { console.error('check-context-budget: ' + msg); process.exit(2); }

if (!target) die('usage: node tools/check-context-budget.js <path-to-project-directory>');
const claude = path.join(target, 'CLAUDE.md');
if (!fs.existsSync(claude)) die('no CLAUDE.md in ' + target + ', so nothing is loaded automatically');

function read(p) { return fs.readFileSync(p, 'utf8'); }

// The same import rule studio.ps1 uses: a line that is nothing but @something.md.
function importsOf(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.trim().match(/^@([^\s]+\.md)$/);
    if (m) out.push(m[1]);
  }
  return out;
}

const loaded = [{ name: 'CLAUDE.md', chars: read(claude).length, full: claude }];
for (const rel of importsOf(read(claude))) {
  const p = path.join(target, rel);
  // A missing import loads nothing and says nothing. -Doctor reports it separately as DEAD;
  // here it simply contributes zero, and recording it as 0 keeps the arithmetic honest.
  loaded.push({ name: rel, chars: fs.existsSync(p) ? read(p).length : 0, full: p, missing: !fs.existsSync(p) });
}

const total = loaded.reduce((n, f) => n + f.chars, 0);
const tokens = Math.round(total / 4);

if (!quiet) {
  console.log('');
  console.log('  ' + target);
  for (const f of loaded) {
    console.log('    ' + String(f.chars).padStart(7) + '  ' + f.name + (f.missing ? '   (missing, loads nothing)' : ''));
  }
  console.log('    ' + String(total).padStart(7) + '  TOTAL, about ' + tokens + ' tokens on EVERY request');
  console.log('');
}

// --- the hard per-file limit -----------------------------------------------------------------
const over = loaded.filter(f => f.chars > FILE_LIMIT);
ok('no single loaded document is past the limit',
   over.length === 0,
   over.map(f => f.name + ' is ' + f.chars + ', past ' + FILE_LIMIT).join('; '));

// --- the same limit, applied to the total ----------------------------------------------------
// Spreading the weight over several files costs exactly the same and trips no per-file warning.
ok('the total loaded is under the limit as well',
   total <= FILE_LIMIT,
   total + ' chars, about ' + tokens + ' tokens charged on every request before any work');

// --- sections that are meant to be replaced --------------------------------------------------
const offenders = [];
for (const f of loaded) {
  if (f.missing) continue;
  const lines = read(f.full).split(/\r?\n/);
  let heading = null, size = 0;
  const flush = () => {
    if (heading && DISPOSABLE.some(re => re.test(heading)) && size > DISPOSABLE_LIMIT) {
      offenders.push(f.name + ' "' + heading.trim() + '" is ' + size);
    }
  };
  for (const line of lines) {
    if (line.startsWith('## ')) { flush(); heading = line.slice(3); size = 0; }
    size += line.length + 1;
  }
  flush();
}
ok('every section that should be replaced each session is within budget',
   offenders.length === 0,
   offenders.join('; ') + (offenders.length ? '  --  these are rewritten every wind-down, so they cannot grow honestly; they are being appended to' : ''));

// --- an archive must stay findable -----------------------------------------------------------
// CEO constraint, ST-088: archiving is only safe while the trail can still be followed from the
// document that IS loaded. An archive nothing points at is a decision nobody will find.
const archives = fs.readdirSync(target).filter(n => /ARCHIVE.*\.md$/i.test(n));
const loadedText = loaded.filter(f => !f.missing).map(f => read(f.full)).join('\n');
const orphaned = archives.filter(a => loadedText.indexOf(a) === -1);
ok('every archive file is pointed at from a document that is actually loaded',
   orphaned.length === 0,
   orphaned.join(', ') + (orphaned.length ? '  --  archived decisions nothing references are decisions nobody will find, and they get re-litigated' : ''));

if (!quiet) console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
