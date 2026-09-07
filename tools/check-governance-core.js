#!/usr/bin/env node
/**
 * check-governance-core.js -- proves the governance split did not quietly retire a rule, and
 * that the rules actually reach the sessions they bind.
 *
 * WHY THIS EXISTS. Shared governance was one 48,860-character file that every project
 * `@`-imported, so it was re-sent on EVERY request for the life of every session, about 12,200
 * tokens a call. Two of five projects that HELD the file imported nothing at all, so no rule
 * placed there reached them (ST-119). The CEO ruled on 2026-09-04 to split it: a small core that
 * is imported, and the bulk left as a reference nothing loads.
 *
 * A split like that has one failure mode and it is silent. Moving a rule out of what is loaded
 * stops it being re-read, which is the point, and it also stops it being OBEYED, which is not.
 * S7 retired a whole document because overlapping locations meant none of the three was trusted.
 * So the core names, in its own text, which reference section holds the reasoning for each of its
 * rules, and separately names the sections that deliberately carry no rule. This check reads both
 * lists and refuses when they do not add up.
 *
 *   node tools/check-governance-core.js
 *   node tools/check-governance-core.js --gov <dir>     governance dir (default base/governance)
 *   node tools/check-governance-core.js --root <dir>    also check reach across projects there
 *   node tools/check-governance-core.js --quiet         print failures only
 *
 * Exit 0 clean, 1 on any failure, 2 on a usage or read error, 3 when there is no governance
 * directory here at all. That third code exists because the governance text is deliberately not
 * published: a copy installed from the public export carries this check and cannot carry the
 * documents it reads, and a gate that refuses on something a legitimate install can never satisfy
 * locks that install out of releasing for good. A directory that EXISTS with the documents missing
 * is still a read error, because that is a real defect rather than an absence.
 *
 * WHAT IT REFUSES, and each one is a different defect:
 *
 *   - AN ORPHANED SECTION. A `## ` section of the reference that is neither pointed at from a
 *     rule in the core nor listed as reference-only. That is a rule that has quietly stopped
 *     applying to anybody, and it is the exact thing the split is capable of causing. It also
 *     catches the future case: somebody adds a binding section to the reference and never puts
 *     it in the core.
 *
 *   - A DANGLING POINTER. A name in the core's `*Reasons:*` or `*Reference-only:*` lists that
 *     matches no section in the reference. This is the OTHER direction, and it is the half a
 *     hand-written claim never has: without it a pointer rots unnoticed the moment a section is
 *     renamed, and the core goes on citing a reason nobody can find. S123.
 *
 *   - A DUPLICATE SECTION. Two `## ` headings with the same title in the reference. Found on the
 *     day this was written: `## The CEO channel (Remote Control)` appeared twice, byte-identical,
 *     750 characters paid for twice on every request of every session, and an edit to one would
 *     have left the other stale. That is the canonical-source failure the same document preaches
 *     against, inside the document itself.
 *
 *   - A PROJECT THAT HOLDS THE CORE AND DOES NOT IMPORT IT, with `--root`. Delivered is not
 *     loaded (S70). This is the original ST-119 defect and it was invisible for weeks because
 *     `-Sync` places the file and a project's own `CLAUDE.md` decides whether to read it, so the
 *     two halves are owned by different things and nothing compared them.
 *
 * WHAT IT REPORTS AND DELIBERATELY DOES NOT REFUSE ON, and there are two:
 *
 *   - THE SIZE of the core and the saving against the reference. A size CAP would be met by
 *     moving rules out to the reference, which is the failure this check exists to catch, so the
 *     number is printed and the coverage rules are what refuse. S126 is the same hazard in the
 *     reply-shape tool: a cap becomes a target.
 *
 *   - A VENTURE SUB-PROJECT that inherits the core from the venture root. `-Sync` places one copy
 *     at the venture root, so such a project would have to import it upward as
 *     `@../GOVERNANCE_CORE.md`, and NOTHING in this studio has proved that an upward relative
 *     import resolves in this host. Every relative import in use here points downward. Refusing
 *     on an unverified remedy publishes a claim nobody measured, which is S128, so these are
 *     listed and the refusal is kept to the case that is provably wrong. ST-169 carries the
 *     verification, and it also carries the second finding: reach was published as 2 of 5
 *     projects and is 5 of 8 counted at the level a session actually opens at (S125).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const CORE_NAME = 'GOVERNANCE_CORE.md';
const REF_NAME = 'GLOBAL_WAYS_OF_WORKING.md';

// Full text, parentheses and dates included: they are what makes a pointer specific.
function normalise(s) {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

function sectionsOf(text) {
  const out = [];
  const re = /^## (.+)$/gm;
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[1].trim());
  return out;
}

// One line each, closed by an asterisk. A wrapped line reads as an orphan, so it refuses.
function listedNames(text, label) {
  const re = new RegExp('^\\*' + label + ':\\s*(.+?)\\*\\s*$', 'gm');
  const names = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    for (const part of m[1].split(';')) {
      const n = part.replace(/\.$/, '').trim();
      if (n) names.push(n);
    }
  }
  return names;
}

// Holding is the file beside CLAUDE.md or one up; loading is the @-import. See the header.
function projectsUnder(root) {
  const found = [];
  let top;
  try { top = fs.readdirSync(root, { withFileTypes: true }); } catch { return found; }
  for (const d of top) {
    if (!d.isDirectory() || d.name.startsWith('_') || d.name.startsWith('.')) continue;
    const outer = path.join(root, d.name);
    const consider = [outer];
    try {
      for (const s of fs.readdirSync(outer, { withFileTypes: true })) {
        if (s.isDirectory() && !s.name.startsWith('.') && s.name !== 'node_modules') {
          consider.push(path.join(outer, s.name));
        }
      }
    } catch { /* unreadable sub-tree is not a project */ }
    for (const p of consider) {
      if (fs.existsSync(path.join(p, 'CLAUDE.md'))) found.push(p);
    }
  }
  return found;
}

function importsCore(claudeMd) {
  return /^@(?:.*[\\/])?GOVERNANCE_CORE\.md\s*$/m.test(claudeMd);
}

function main(argv) {
  const args = argv.slice(2);
  const quiet = args.includes('--quiet');
  let govDir = path.join(__dirname, '..', 'base', 'governance');
  let root = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--gov' || args[i] === '--root') {
      const v = args[i + 1];
      if (!v || v.startsWith('--')) {
        process.stderr.write('usage: ' + args[i] + ' needs a directory after it\n');
        return 2;
      }
      if (args[i] === '--gov') govDir = v; else root = v;
      i++;
    }
  }

  const corePath = path.join(govDir, CORE_NAME);
  const refPath = path.join(govDir, REF_NAME);
  if (!fs.existsSync(govDir)) {
    process.stdout.write('no governance directory at ' + govDir + ', so there is nothing here to check\n');
    return 3;
  }
  let core, ref;
  try {
    core = fs.readFileSync(corePath, 'utf8');
    ref = fs.readFileSync(refPath, 'utf8');
  } catch (e) {
    process.stderr.write('cannot read governance in ' + govDir + ': ' + e.message + '\n');
    return 2;
  }

  const say = (s) => { if (!quiet) process.stdout.write(s + '\n'); };
  const fail = (s) => { process.stdout.write('  FAIL ' + s + '\n'); };
  const failures = [];

  const secs = sectionsOf(ref);
  // Match normalised, print verbatim: a lowercased name sends the reader hunting for no line.
  const pointed = listedNames(core, 'Reasons');
  const refOnly = listedNames(core, 'Reference-only');
  const known = new Set([...pointed, ...refOnly].map(normalise));

  say('GOVERNANCE CORE  ' + corePath);
  say('  reference ' + REF_NAME + ': ' + secs.length + ' section(s), ' +
      new Set(secs.map(normalise)).size + ' distinct');
  say('  core cites ' + pointed.length + ' as reasoning, ' + refOnly.length + ' as reference-only');

  const counts = new Map();
  for (const s of secs) counts.set(normalise(s), (counts.get(normalise(s)) || 0) + 1);
  for (const [n, c] of counts) {
    if (c > 1) {
      failures.push('duplicate section in ' + REF_NAME + ', ' + c + ' times: ' + n);
    }
  }

  for (const s of secs) {
    if (!known.has(normalise(s))) {
      failures.push('orphaned section, neither cited as reasoning nor listed reference-only: ' + s);
    }
  }

  const present = new Set(secs.map(normalise));
  for (const n of [...pointed, ...refOnly]) {
    if (!present.has(normalise(n))) {
      failures.push('the core names a section that does not exist in ' + REF_NAME + ': ' + n);
    }
  }

  say('  core ' + core.length + ' chars unexpanded, reference ' + ref.length +
      ' chars, so the imported document is ' + Math.round(100 * core.length / ref.length) +
      ' per cent of what it replaces');

  if (root) {
    const projects = projectsUnder(root);
    let holds = 0, loads = 0;
    const inherited = [];
    say('  reach across ' + projects.length + ' project(s) under ' + root);
    for (const p of projects) {
      const here = fs.existsSync(path.join(p, CORE_NAME));
      const up = fs.existsSync(path.join(path.dirname(p), CORE_NAME));
      if (!here && !up) continue;
      let cm = '';
      try { cm = fs.readFileSync(path.join(p, 'CLAUDE.md'), 'utf8'); } catch { /* absent reads as no import */ }
      // Inherited from the venture root: reported, never refused. See the header.
      if (!here && up) { if (!importsCore(cm)) inherited.push(p); continue; }
      holds++;
      if (importsCore(cm)) loads++;
      else failures.push('holds ' + CORE_NAME + ' and its CLAUDE.md does not import it: ' + p);
    }
    say('  ' + loads + ' of ' + holds + ' project(s) holding the core also import it');
    if (inherited.length) {
      say('  ' + inherited.length + ' venture sub-project(s) inherit the core from the venture root and' +
          ' import nothing; reported, not refused (ST-169):');
      for (const p of inherited) say('      ' + p);
    }
  }

  if (failures.length) {
    for (const f of failures) fail(f);
    process.stdout.write('\n  ' + failures.length + ' failure(s)\n');
    return 1;
  }
  say('\n  OK, every reference section is accounted for and every pointer resolves');
  return 0;
}

if (require.main === module) process.exit(main(process.argv));
module.exports = { main, sectionsOf, listedNames, normalise, importsCore };
