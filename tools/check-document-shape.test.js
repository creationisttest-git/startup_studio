#!/usr/bin/env node
/**
 * check-document-shape.test.js
 *
 * Every assertion below drives the real program as a child process and reads its exit code and
 * its output, rather than calling the functions in process. A shape check that is only ever
 * exercised through its own helpers cannot see the case where the helper is right and the wiring
 * that calls it is wrong, and an in-process call also makes every throwing mutation kill the run
 * and report no count at all (S127).
 *
 * The named mutations are written beside the groups they redden. A group with no mutation named
 * is a group nobody has watched fail.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const TOOL = path.join(__dirname, 'check-document-shape.js');
let pass = 0;
let fail = 0;
let n = 0;

function ok(name, cond) {
  if (cond) { pass++; console.log('ok    ' + name); }
  else { fail++; console.log('FAIL  ' + name); }
}

function fixture() {
  // A process id is reused by the operating system and these directories are never removed, so
  // the counter and the timestamp are both needed to keep two runs apart.
  const dir = path.join(os.tmpdir(), 'doc-shape-' + process.pid + '-' + Date.now().toString(36) + '-' + (++n));
  if (fs.existsSync(dir)) throw new Error('fixture path already exists: ' + dir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function put(root, rel, text, bom) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, (bom ? '﻿' : '') + text, 'utf8');
  return p;
}

// stdio IS NOT OPTIONAL HERE, AND LEAVING IT OUT KILLED THE WHOLE STUDIO SUITE. execFileSync
// pipes stdout and INHERITS stderr unless told otherwise, so every exit-2 fixture below printed
// its usage error straight through this process into the parent harness, which reads any stderr
// from a node suite as the run having died. It reported 579 passed, 1 failed, run DIED, having
// run 580 of 586, and the assertions it had not reached were simply absent. The suite's own death
// guard is what caught it (S35): a count of failures cannot see an assertion that never ran.
function run(args) {
  const opts = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] };
  try {
    const out = execFileSync(process.execPath, [TOOL].concat(args), opts);
    return { code: 0, out: out };
  } catch (e) {
    return { code: e.status === undefined ? -1 : e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}

const GOOD = '# Title\n\nsome prose\n\n## A section\n\nmore prose\n';

// --- the byte order mark ------------------------------------------------------------------------
/* THE FINDING THAT PAID FOR THIS TOOL. S24 was closed for agent files and nobody re-measured the
   GOVERNANCE documents, so three projects were loading a CLAUDE.md with a mark before its first
   character, the file every session reads first. Mutation: drop the 0xEF check in the bom test
   and the first assertion goes red while the clean control below stays green, which is what makes
   it a proof about the mark rather than about the file being read at all. */
{
  const root = fixture();
  put(root, 'a.md', GOOD, true);
  const r = run(['--file', path.join(root, 'a.md')]);
  ok('a byte order mark is refused', r.code === 1);
  ok('and the refusal says why it matters rather than only naming it',
    /invisible in every diff/.test(r.out) && /S24/.test(r.out));
}
{
  const root = fixture();
  put(root, 'a.md', GOOD, false);
  const r = run(['--file', path.join(root, 'a.md')]);
  ok('the same document without the mark passes', r.code === 0);
}

// --- headings -----------------------------------------------------------------------------------
/* Mutation: change headings.length > 0 to >= 0 and the first goes red while the control holds. */
{
  const root = fixture();
  put(root, 'a.md', 'WAYS_OF_WORKING\n\nArchitecture\n\nsome prose that reads as a section to a person\n');
  const r = run(['--file', path.join(root, 'a.md')]);
  ok('a document with no markdown heading at all is refused', r.code === 1);
  ok('and it reports the size, because the number is what makes it alarming',
    /NOT ONE heading/.test(r.out));
}
{
  // The control that keeps the group honest: bare-line titles are prose, a real heading is not.
  const root = fixture();
  put(root, 'a.md', GOOD);
  const r = run(['--file', path.join(root, 'a.md')]);
  ok('one real heading is enough to have a shape', r.code === 0);
}
{
  /* A # inside a fenced block is a shell comment or an example and has never been a section of the
     file. Without this the resume prompt in every WARM_START here, which is a fenced block full of
     shell lines, would invent dozens of headings and then collide with each other. Mutation: drop
     the inFence guard and this goes red. */
  const root = fixture();
  put(root, 'a.md', 'prose with no heading\n\n```\n# not a heading\n# also not a heading\n```\n');
  const r = run(['--file', path.join(root, 'a.md')]);
  ok('a hash inside a fenced block is not a heading', r.code === 1 && /NOT ONE heading/.test(r.out));
}

// --- the same heading twice ---------------------------------------------------------------------
/* Mutation: key `seen` on the text alone and the different-level control goes red; drop the dupes
   push and the first pair goes red while that control stays green. */
{
  const root = fixture();
  put(root, 'a.md', '# T\n\n## Risks\n\nx\n\n## Risks\n\ny\n');
  const r = run(['--file', path.join(root, 'a.md')]);
  ok('the same heading twice is refused', r.code === 1);
  ok('and it names both line numbers, because a duplicate nobody can find is not actionable',
    /Risks \(lines 3 and 7\)/.test(r.out));
}
{
  // The control. A section and a sub-section may legitimately share a name, and refusing that
  // would make the rule unusable in documents that nest.
  const root = fixture();
  put(root, 'a.md', '# T\n\n## Risks\n\nx\n\n### Risks\n\ny\n');
  const r = run(['--file', path.join(root, 'a.md')]);
  ok('the same text at a different heading level is NOT a duplicate', r.code === 0);
}

// --- decisions claimed with no table --------------------------------------------------------
/* Mutation: make hasDecisionsTable always return true and the first goes red while the
   with-a-table control stays green. */
{
  const root = fixture();
  put(root, 'a.md', '# T\n\n## Decisions\n\nWe decided in prose, at length, with no table anywhere.\n');
  const r = run(['--file', path.join(root, 'a.md')]);
  ok('a Decisions section with no table is refused', r.code === 1);
  ok('and it says which instruments go silent, not just that the table is missing',
    /archive policy/.test(r.out) && /duplicate-key/.test(r.out));
}
{
  const root = fixture();
  put(root, 'a.md', '# T\n\n## Decisions\n\n| # | Decision | Resolution | Date |\n|---|---|---|---|\n| S1 | a | b | 2026-01-01 |\n');
  const r = run(['--file', path.join(root, 'a.md')]);
  ok('a Decisions section with a real table passes', r.code === 0);
}
{
  /* THE FALSE POSITIVE, CAUGHT WITHIN A MINUTE OF THE FIRST RUN AND KEPT AS AN ASSERTION. The rule
     first matched the word anywhere in a heading, which refused a fragment whose whole subject is
     where the decisions live and which correctly holds no table. Over-counting a finding is the
     same error as missing one (S148). Mutation: loosen the test back to a word match and this
     goes red alone. */
  const root = fixture();
  put(root, 'a.md', '# T\n\n## Where the decisions are, and why the live table is not all of them\n\nprose\n');
  const r = run(['--file', path.join(root, 'a.md')]);
  ok('a heading that MENTIONS decisions does not claim to hold them', r.code === 0);
}

// --- walking a project ------------------------------------------------------------------------
/* Mutation: drop the fs.existsSync filter on imports and the missing-import assertion goes red,
   because a file that loads nothing has no shape to judge and must not be reported as broken. */
{
  const root = fixture();
  put(root, 'CLAUDE.md', '# Project\n\n@state.md\n@gone.md\n');
  put(root, 'state.md', GOOD);
  const r = run([root]);
  ok('it walks the @-imports the same way a session loads them', r.code === 0);
  ok('and an import that does not exist is not reported as a shape fault', !/gone\.md/.test(r.out));
}
{
  const root = fixture();
  put(root, 'CLAUDE.md', '# Project\n\n@state.md\n');
  put(root, 'state.md', 'no heading here at all\n');
  const r = run([root]);
  ok('a fault in an IMPORTED document fails the project, not just the root file',
    r.code === 1 && /state\.md/.test(r.out));
}

// --- one project, or the directory holding several ----------------------------------------------
/* A SHAPE FAULT IS A PROPERTY OF THE OTHER PROJECTS. This repository is the one place it has never
   been true, so a check that could only ever look at itself would pass forever and prove nothing,
   which is the register-it-and-forget-it failure ST-176 was raised about. Mutation: drop the
   subdirectory walk and the first pair goes red while the single-project assertions above stay
   green, which is what makes this a proof about REACH rather than about the checks themselves. */
{
  const root = fixture();
  fs.mkdirSync(path.join(root, 'alpha'));
  fs.mkdirSync(path.join(root, 'beta'));
  put(root, 'alpha/CLAUDE.md', '# Alpha\n\n@state.md\n');
  put(root, 'alpha/state.md', GOOD);
  put(root, 'beta/CLAUDE.md', '# Beta\n\n@state.md\n');
  put(root, 'beta/state.md', 'no heading in here at all\n');
  const r = run([root]);
  ok('a directory with no CLAUDE.md of its own checks every project under it', r.code === 1);
  ok('and it names which project the fault is in, because a filename alone is not actionable',
    /beta\/state\.md/.test(r.out) && !/alpha\/state\.md/.test(r.out.split('FAIL').slice(1).join('')));
}
{
  // The control: the same walk must not invent a fault where there is none.
  const root = fixture();
  fs.mkdirSync(path.join(root, 'alpha'));
  put(root, 'alpha/CLAUDE.md', '# Alpha\n\n@state.md\n');
  put(root, 'alpha/state.md', GOOD);
  const r = run([root]);
  ok('and a directory of healthy projects passes', r.code === 0);
}

// --- refusing to guess --------------------------------------------------------------------------
/* Mutation: make die() exit 1 instead of 2 and all three of these go red together, while every
   verdict assertion above stays green. That is what separates "nothing could be read" from "what
   was read is broken", and the two must never share a code. */
{
  ok('a directory with no CLAUDE.md anywhere under it is exit 2, not a pass', run([fixture()]).code === 2);
  ok('a file that does not exist is exit 2, not a pass',
    run(['--file', path.join(fixture(), 'nope.md')]).code === 2);
  ok('--file with nothing after it is a usage error rather than a verdict about the cwd',
    run(['--file']).code === 2);
  // ST-187 m2. An I/O failure must not wear the code that means "this document has no shape".
  // Unguarded, readFileSync throws EISDIR and node exits 1, which is exactly the finding code.
  const dirAsDoc = fixture();
  fs.mkdirSync(path.join(dirAsDoc, 'notes.md'));
  ok('a path that cannot be READ is exit 2, not a shape finding',
    run(['--file', path.join(dirAsDoc, 'notes.md')]).code === 2);
}

// --- who this check has standing to refuse on ---------------------------------------------------
/* ST-187. Pointed at the directory holding this repository, the walk reaches every project, which
   is the whole value of the check. Pointed at the same place on a copy installed from the public
   export it reaches the READER'S OWN unrelated work: measured before --governed-only existed, a
   parent holding one unrelated project gave "FAIL some-unrelated-app/CLAUDE.md: has markdown
   headings", exit 1, in the session-start set, on a document we did not write and cannot fix.

   THE FIXTURE HOLDS A GOVERNED PROJECT AND AN UNGOVERNED ONE AT ONCE, deliberately. Written once
   as a basename compared upper-case against a mixed-case list, the rule matched NOTHING and took
   the studio's own reach from five projects to zero while still exiting cleanly. A scoping rule
   that admits nobody is indistinguishable from one that works unless something in scope is
   required to still be checked (S141). Mutation: drop the governedOnly guard in loadProject and
   the skip assertion goes red while the in-scope pair stays green; invert it and the pair goes
   red while the skip stays green. */
{
  const root = fixture();
  fs.mkdirSync(path.join(root, 'ours'));
  fs.mkdirSync(path.join(root, 'theirs'));
  put(root, 'ours/CLAUDE.md', '# Ours\n\n@GOVERNANCE_CORE.md\n');
  put(root, 'ours/GOVERNANCE_CORE.md', 'no heading in this one at all\n');
  // THE UNGOVERNED PROJECT MUST IMPORT SOMETHING, AND SOMETHING GENERICALLY NAMED. Written as a
  // project that imported NOTHING, this fixture made loadsGovernance([]) trivially false, so the
  // branch that decides scope was never exercised at all and the assertion below read as a
  // guarantee it could not give. The tool shipped scoping on AGENTS.MD, WAYS_OF_WORKING.MD and
  // WARM_START.MD, every one of which a stranger owns for their own reasons, and this fixture
  // reported it safe. AGENTS.md is the sharpest case because it is an industry-wide convention.
  // Mutation: put any of those three names back in STUDIO_DOCS and this pair goes red.
  put(root, 'theirs/CLAUDE.md', '# Theirs\n\n@AGENTS.md\n@WAYS_OF_WORKING.md\n@WARM_START.md\n');
  put(root, 'theirs/AGENTS.md', 'someone elses notes, no headings anywhere\n');
  put(root, 'theirs/WAYS_OF_WORKING.md', 'nor here\n');
  put(root, 'theirs/WARM_START.md', 'nor in this one\n');
  const r = run([root, '--governed-only']);
  ok('a project that loads studio governance is still checked under --governed-only',
    r.code === 1 && /ours\/GOVERNANCE_CORE\.md/.test(r.out));
  ok('and a project that loads none of it is not refused on, because it is not ours to refuse on',
    !/theirs/.test(r.out));
  // The same fixture without the flag: proof the flag is what changed the answer, and not the
  // fixture. Both projects are broken, so an unscoped run must name theirs too.
  ok('without the flag the same directory still reaches every project under it',
    /theirs/.test(run([root]).out));
}
{
  // THE STUDIO'S OWN SHAPE. It imports no core at all, it imports its rules out of base/fragments,
  // so the LOCATION is what marks them as ours. Without this the fix that removed the generic
  // names would have taken the guardian project itself out of scope and nothing would have said so.
  const root = fixture();
  fs.mkdirSync(path.join(root, 'guardian/base/fragments'), { recursive: true });
  put(root, 'guardian/CLAUDE.md', '# Guardian\n\n@base/fragments/brevity.md\n');
  put(root, 'guardian/base/fragments/brevity.md', 'a rule with no heading on it\n');
  const r = run([root, '--governed-only']);
  ok('a project whose only studio document is one under base/fragments is in scope',
    r.code === 1 && /guardian\/base\/fragments\/brevity\.md/.test(r.out));
}

// --- the import walk ----------------------------------------------------------------------------
/* S154. This tool's header claimed it used the same import rule as the two other implementations
   of the same question. ST-190 had already fixed those two to walk the whole graph and to resolve
   each path against the file that declares it; this one still walked a single level from the
   project root, so on the one real project that reaches governance through a nested directory the
   nested documents were never read and the tool returned a clean bill. Measured after the fix on
   that project: 5 documents checked became 7. */
{
  const root = fixture();
  fs.mkdirSync(path.join(root, 'nested/sub'), { recursive: true });
  put(root, 'nested/CLAUDE.md', '# Nested\n\n@GOVERNANCE_CORE.md\n@sub/CLAUDE.md\n');
  put(root, 'nested/GOVERNANCE_CORE.md', '# Fine\n\ncontent\n');
  put(root, 'nested/sub/CLAUDE.md', '# Sub\n\n@INNER.md\n');
  put(root, 'nested/sub/INNER.md', 'reached only through the nested document, and no heading\n');
  const r = run([root, '--governed-only']);
  ok('a document reached only through a nested CLAUDE.md is checked, not skipped',
    r.code === 1 && /sub\/INNER\.md/.test(r.out));
  // The rule that decides it. Resolved against the PROJECT ROOT, nested/INNER.md does not exist,
  // so the walk would find nothing and look correct. Nothing at the root is named INNER.md, which
  // is what makes this assertion able to tell the two rules apart.
  ok('an import resolves against the file that declares it, not against the project root',
    !fs.existsSync(path.join(root, 'nested/INNER.md')) && /sub\/INNER\.md/.test(r.out));
}
{
  // A CYCLE MUST REACH A VERDICT. Without the seen set this recurses until the stack gives out,
  // and node exits 1 on an uncaught throw exactly as this tool exits 1 on a finding, so an
  // assertion that only asked whether the run survived could not tell a crash from a result
  // (S156). Asking for the summary line is what distinguishes them.
  const root = fixture();
  fs.mkdirSync(path.join(root, 'loop'));
  put(root, 'loop/CLAUDE.md', '# Loop\n\n@GOVERNANCE_CORE.md\n@OTHER.md\n');
  put(root, 'loop/GOVERNANCE_CORE.md', '# Fine\n\ncontent\n');
  put(root, 'loop/OTHER.md', '# Other\n\n@CLAUDE.md\n');
  const r = run([root, '--governed-only']);
  ok('a cycle of imports reaches a verdict rather than running out of stack',
    /\d+ passed, \d+ failed/.test(r.out));
  // Charged once. Three imports on one real project are reached by two different paths, so a walk
  // without the seen set counts the same text twice and reports a document it already reported.
  ok('and a document reached twice is checked once, not twice',
    (r.out.match(/loop\/OTHER\.md: has markdown headings/g) || []).length === 1);
}
{
  // ONE UNREADABLE DOCUMENT UNDER THE READER'S PARENT MUST NOT END THE RUN. A directory named like
  // a document makes readFileSync throw EISDIR, which is the case the tool's own comment names.
  // Unguarded that is exit 2 with "nothing could be read", which is untrue: everything before it
  // had been read. run-checks lists only 3 as advisory, so exit 2 turns a reader's session-start
  // red on a stranger's locked file.
  const root = fixture();
  fs.mkdirSync(path.join(root, 'partly'));
  fs.mkdirSync(path.join(root, 'partly/LOCKED.md'));
  put(root, 'partly/CLAUDE.md', '# Partly\n\n@GOVERNANCE_CORE.md\n@LOCKED.md\n');
  put(root, 'partly/GOVERNANCE_CORE.md', 'no heading here either\n');
  const r = run([root, '--governed-only']);
  ok('an unreadable document contributes no assertion instead of ending the run',
    r.code === 1 && /\d+ passed, \d+ failed/.test(r.out));
  ok('and the documents beside it are still checked and still reported',
    /partly\/GOVERNANCE_CORE\.md/.test(r.out));
}
{
  // THE READER'S ORDINARY STATE. A fresh install sits beside work that is not studio work, and a
  // check nobody can clear trains its reader to override it, so this is exit 3 and advisory
  // rather than a failure. Distinct from exit 2 above: that is a person's mistake, this is not.
  const root = fixture();
  fs.mkdirSync(path.join(root, 'theirs'));
  put(root, 'theirs/CLAUDE.md', 'someone elses notes, no headings anywhere\n');
  const r = run([root, '--governed-only']);
  ok('nothing governed beside this install is exit 3, which run-checks.js lists as advisory',
    r.code === 3);
  ok('and it says what would put a project in scope, rather than only that it found nothing',
    /compose the roster/.test(r.out));
}

/* Measured elsewhere in this studio: a fatal guard firing part way through a suite reported 0
   failed and exit 0, having run 22 of 214, so a count of failures cannot see an assertion that
   never ran. The total is written down rather than measured from the run it checks.
   Mutation: delete an assertion above and this goes red alone. */
const EXPECTED_ASSERTIONS = 37;
const ranBefore = pass + fail;
ok('the suite ran every assertion: ran ' + (ranBefore + 1) + ' of ' + EXPECTED_ASSERTIONS
  + '. A block was skipped or deleted. Find out which before you change the number.',
  ranBefore === EXPECTED_ASSERTIONS - 1);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
