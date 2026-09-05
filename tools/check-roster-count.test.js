#!/usr/bin/env node
'use strict';
/*
 * Tests for check-roster-count.js. Every assertion has been watched failing by breaking the
 * tool, and the mutation that turns each group red is written beside the group.
 *
 * The interesting property is proved by the last group rather than the first: adding a role to
 * the fixture roster turns every previously correct claim red at once. That is the event this
 * check exists for, and a suite that only ever tests a matching count never sees it.
 *
 * The fixture path carries a timestamp as well as the process id and the helper REFUSES if the
 * directory exists. A precondition an assertion stands on is asserted, not assumed.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TOOL = path.join(__dirname, 'check-roster-count.js');
const T = require(TOOL);
let pass = 0, fail = 0;
function ok (name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL  ' + name); } }

function run (args) {
  try {
    const out = execFileSync('node', [TOOL].concat(args), { stdio: ['pipe', 'pipe', 'pipe'], cwd: __dirname }).toString();
    return { code: 0, out: out };
  } catch (e) {
    return { code: e.status, out: ((e.stdout || '') + (e.stderr || '')).toString() };
  }
}

let n = 0;
function fixture () {
  const dir = path.join(os.tmpdir(), 'roster-count-' + Date.now() + '-' + process.pid + '-' + (++n));
  if (fs.existsSync(dir)) throw new Error('fixture path already exists, which every assertion below assumes it does not: ' + dir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function put (root, rel, body) {
  const p = path.join(root, rel.split('/').join(path.sep));
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
  return p;
}

function roster (root, count, dir) {
  for (let i = 0; i < count; i++) put(root, (dir || 'base/agents') + '/role-' + i + '.md', 'a role\n');
  return root;
}

function baseline (root, obj) {
  const p = path.join(root, 'baseline.json');
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
  return p;
}

function check (root, extra) {
  return run(['--root', root, '--baseline', path.join(root, 'baseline.json')].concat(extra || []));
}

/* Mutation: drop the word boundary or the roster noun from CLAIM and the negative ones go red. */
{
  const root = fixture();
  put(root, 'page.html', [
    'this studio has three roles',
    'and a paragraph mentioning three things that are not roles',
    'a three-legged stool is not a claim',
    'six agents is a claim'
  ].join('\n'));
  const claims = T.claimsIn(root, 'page.html');
  ok('a number in front of the word roles is a claim', claims.some(c => c.n === 3 && /role/i.test(c.text)));
  ok('a number in front of the word agents is a claim', claims.some(c => c.n === 6));
  ok('a number in front of anything else is not', claims.length === 2);
}
{
  const root = fixture();
  put(root, 'a.md', 'name the roles you can dispatch and count them. Expect four.\n');
  put(root, 'b.md', 'expect four of these, on a line that is not about the roster at all\n');
  ok('a bare number after expect counts when the line is about roles',
    T.claimsIn(root, 'a.md').some(c => c.n === 4));
  ok('and does not count when the line is not', T.claimsIn(root, 'b.md').length === 0);
}

/* Mutation: hard-code the count and the first goes red; drop the export path and the second does. */
{
  const root = roster(fixture(), 5);
  ok('the roster size is the number of role files', T.rosterSize(root).count === 5);
  ok('and it names the directory it counted', T.rosterSize(root).dir === 'base/agents');
}
{
  const root = roster(fixture(), 4, 'agents');
  ok('the flattened path the export publishes is read too', T.rosterSize(root).count === 4);
}
{
  const root = fixture();
  ok('no roster at all is a usage error rather than a pass', check(root).code === 2);
}

/* Mutation: compare against the wrong number and this goes red. */
{
  const root = roster(fixture(), 3);
  put(root, 'page.html', 'the squad is three roles working together\n');
  baseline(root, { roster: 3, exempt: {} });
  const r = check(root);
  ok('a claim stating the roster size passes', r.code === 0);
  ok('and the summary says how many claims were checked', /3 role|claim/.test(r.out));
}

/* Mutation: treat an unrecorded number as exempt and both go red. */
{
  const root = roster(fixture(), 3);
  put(root, 'page.html', 'the squad is nine roles working together\n');
  baseline(root, { roster: 3, exempt: {} });
  const r = check(root);
  ok('a claim that is not the roster size and is not recorded refuses', r.code === 1);
  ok('and the message names the file, the number and what to do about it',
    /page\.html/.test(r.out) && /nine/.test(r.out) && /subset/.test(r.out));
}

/* Mutation: compare with >= instead of !== and the second of these goes red, which is the
   shape that lets a record hold slack the tree does not have. */
{
  const root = roster(fixture(), 3);
  put(root, 'page.html', 'nine roles carried the same paragraph, a subset\n');
  baseline(root, { roster: 3, exempt: { 'page.html': { 9: { count: 1, why: 'a subset' } } } });
  ok('a recorded exemption passes', check(root).code === 0);
  put(root, 'page.html', 'nine roles carried it, and nine roles is now said twice\n');
  const r = check(root);
  ok('a second claim under the same exemption refuses, because the count is exact', r.code === 1);
  ok('and says what the record held against what was found', /record holds 1/.test(r.out));
}
{
  const root = roster(fixture(), 3);
  put(root, 'page.html', 'three roles\n');
  baseline(root, { roster: 3, exempt: { 'page.html': { 9: { count: 1, why: 'a subset' } } } });
  const r = check(root);
  ok('an exemption the tree no longer has refuses rather than passing quietly', r.code === 1);
  ok('and asks for the change to be recorded', /--write-baseline/.test(r.out));
}

/* Mutation: drop the blank-reason guard and the first goes red. The write command is the one a
   person actually types, so a guard only on the read side is not a guard. */
{
  const root = roster(fixture(), 3);
  put(root, 'page.html', 'nine roles, unexplained\n');
  const r = check(root, ['--write-baseline']);
  ok('recording an exemption with no reason is refused', r.code === 1);
  ok('and it names the file it refused to record blind', /page\.html/.test(r.out));
  ok('and nothing is written', !fs.existsSync(path.join(root, 'baseline.json')));
}
{
  const root = roster(fixture(), 3);
  put(root, 'page.html', 'nine roles carried the same paragraph\n');
  baseline(root, { roster: 3, exempt: { 'page.html': { 9: { count: 1, why: 'a subset, measured' } } } });
  const w = check(root, ['--write-baseline']);
  const after = JSON.parse(fs.readFileSync(path.join(root, 'baseline.json'), 'utf8'));
  ok('a reason already written by hand is carried forward rather than blanked', w.code === 0 &&
    after.exempt['page.html']['9'].why === 'a subset, measured');
  ok('and the roster size on the record is refreshed', after.roster === 3);
}

/* Mutation: default a missing baseline to an empty object and the first goes red. */
{
  const root = roster(fixture(), 3);
  put(root, 'page.html', 'three roles\n');
  ok('no baseline at all refuses rather than passing on a tree it cannot compare', check(root).code === 1);
  baseline(root, { nope: true });
  ok('a baseline with no exempt object refuses', check(root).code === 1);
  fs.writeFileSync(path.join(root, 'baseline.json'), '{ not json');
  const r = check(root);
  ok('a corrupt baseline refuses rather than throwing', r.code === 1 && !/SyntaxError/.test(r.out));
}

/* Mutation: remove the exclusion list and this goes red. A release note saying sixteen roles
   was true on the day it was written, and rewriting it to satisfy a check falsifies a record. */
{
  const root = roster(fixture(), 3);
  put(root, 'CHANGELOG.md', 'on that day the roster was nine roles\n');
  put(root, 'releases.html', 'on that day the roster was nine roles\n');
  put(root, 'WARM_START.md', 'the roster was nine roles when this was written\n');
  baseline(root, { roster: 3, exempt: {} });
  ok('the changelog, the releases page and the state document are left alone', check(root).code === 0);
}

/* This is the reason the check exists. Mutation: any change that makes the comparison lenient
   turns this group green when it should be red. */
{
  const root = roster(fixture(), 3);
  put(root, 'page.html', 'a squad of three roles, and three roles again in the metadata\n');
  put(root, 'other.md', 'three roles\n');
  baseline(root, { roster: 3, exempt: {} });
  ok('every claim matches while the roster is unchanged', check(root).code === 0);
  put(root, 'base/agents/role-new.md', 'the seventeenth\n');
  const r = check(root);
  ok('adding one role turns every stale claim red at once', r.code === 1);
  ok('across every file that carries one', /page\.html/.test(r.out) && /other\.md/.test(r.out));
  ok('and the message states what the roster now holds', /roster holds 4/.test(r.out));
}

/* Mutation: make --report exit non-zero on a mismatch and the second goes red. It is a
   reading tool and must be usable while the tree is red. */
{
  const root = roster(fixture(), 3);
  put(root, 'page.html', 'nine roles\n');
  const r = run(['--root', root, '--report']);
  ok('the report lists each claim with its file and line', /page\.html:1/.test(r.out));
  ok('and exits 0 even while the tree would refuse', r.code === 0);
}

/* Measured: a fatal guard firing part way through a suite reported 0 failed and exit 0, having
   run 22 of 214, so a count of failures cannot see an assertion that never ran. The total is
   pinned here and the number is written down rather than measured from the run it checks.
   Mutation: delete an assertion above and this goes red alone. */
const EXPECTED_ASSERTIONS = 34;
const ranBefore = pass + fail;
ok('the suite ran every assertion: ran ' + (ranBefore + 1) + ' of ' + EXPECTED_ASSERTIONS
  + '. A block was skipped or deleted. Find out which before you change the number.',
  ranBefore === EXPECTED_ASSERTIONS - 1);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
